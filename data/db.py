"""SQLite-Datenbankzugriff: Verbindung, Schema-Initialisierung, Hilfsfunktionen."""
from __future__ import annotations

import os
import re
import shutil
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from .konfiguration import EIER_STUECK_CASE_SQL, berechne_eier_stueck_neu

# DB-Pfad konfigurierbar via Env-Variable, sonst projektrelativ.
_DEFAULT_DB = Path(__file__).resolve().parent.parent / "data" / "eierverkauf.db"
DB_PATH = Path(os.environ.get("EIERVERKAUF_DB", str(_DEFAULT_DB)))


def _ensure_parent() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)


# Einmal-Flag: WAL-Warnung nur beim ersten betroffenen get_conn() loggen,
# sonst flutet jede Query das Journal.
_wal_warnung_ausgegeben = False


def get_conn() -> sqlite3.Connection:
    """Liefert eine neue SQLite-Connection mit Foreign-Key-Enforcement und Row-Factory.

    WAL-Modus ist Pflicht: Im Standard-Rollback-Journal blockiert eine
    Schreib-Transaktion (z. B. Import-Löschung) alle Leser, wodurch der
    uvicorn-Threadpool volläuft und die komplette App unerreichbar wird.
    """
    global _wal_warnung_ausgegeben
    _ensure_parent()
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    # busy_timeout VOR der WAL-Umschaltung: die braucht kurz exklusiven Zugriff
    # und liefe sonst nur mit dem 5-s-Default von sqlite3.connect().
    conn.execute("PRAGMA busy_timeout = 10000")
    modus = conn.execute("PRAGMA journal_mode = WAL").fetchone()[0]
    if modus != "wal" and not _wal_warnung_ausgegeben:
        _wal_warnung_ausgegeben = True
        print(f"[db] WARNUNG: WAL-Modus nicht aktiv (journal_mode={modus}). "
              "Schreib-Transaktionen blockieren alle Leser — Dateisystem "
              f"von {DB_PATH} prüfen (WAL braucht lokales Storage mit mmap).",
              flush=True)
    conn.execute("PRAGMA synchronous = NORMAL")
    # WAL-Datei nach Checkpoints wieder auf max. 64 MB stutzen (nicht
    # persistent, muss pro Connection gesetzt werden).
    conn.execute("PRAGMA journal_size_limit = 67108864")
    return conn


@contextmanager
def db_cursor() -> Iterator[sqlite3.Cursor]:
    """Context-Manager: Auto-Commit bei Erfolg, Rollback bei Fehler, Schließen am Ende."""
    conn = get_conn()
    try:
        cur = conn.cursor()
        yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS imports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    import_datum TEXT NOT NULL,
    dateiname TEXT NOT NULL,
    datumsbereich TEXT,
    zeilen_importiert INTEGER DEFAULT 0,
    zeilen_uebersprungen INTEGER DEFAULT 0,
    zeilen_fehlerhaft INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS verkaufspositionen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    import_id INTEGER REFERENCES imports(id) ON DELETE CASCADE,
    rechnungsdatum TEXT NOT NULL,
    rechnungsnummer TEXT,
    kundennummer TEXT NOT NULL,
    kundenname TEXT NOT NULL,
    menge REAL NOT NULL,
    einheit TEXT,
    pack_code INTEGER,
    eier_stueck INTEGER,
    artikel_code TEXT,
    groesse TEXT,
    beschreibung TEXT,
    preis_einheit REAL,
    gesamt REAL,
    UNIQUE(rechnungsdatum, rechnungsnummer, kundennummer, menge, einheit, pack_code, beschreibung)
);

CREATE INDEX IF NOT EXISTS idx_datum   ON verkaufspositionen(rechnungsdatum);
CREATE INDEX IF NOT EXISTS idx_kunde   ON verkaufspositionen(kundennummer);
CREATE INDEX IF NOT EXISTS idx_artikel ON verkaufspositionen(artikel_code);
-- Ohne diesen Index macht die ON-DELETE-CASCADE-Löschung eines Imports einen
-- Full-Table-Scan über alle Verkaufspositionen (Import-Löschung blockiert dann
-- auf großen Beständen die komplette App).
CREATE INDEX IF NOT EXISTS idx_import  ON verkaufspositionen(import_id);

-- Pro übersprungene/fehlerhafte Zeile ein Eintrag mit Rohdaten und Grund.
-- Erlaubt nachträgliche Diagnose über die Importhistorie (Detail-Seite).
CREATE TABLE IF NOT EXISTS import_zeilen_protokoll (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    import_id INTEGER NOT NULL REFERENCES imports(id) ON DELETE CASCADE,
    csv_zeile INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('fehler', 'duplikat')),
    grund TEXT NOT NULL,
    rohdaten TEXT
);

CREATE INDEX IF NOT EXISTS idx_protokoll_import ON import_zeilen_protokoll(import_id);
CREATE INDEX IF NOT EXISTS idx_protokoll_status ON import_zeilen_protokoll(import_id, status);

-- Eier-pro-Einheit-Faktor pro Artikel-Code (ab v1.4.0).
-- Faktor ist konfigurierbar via /api/konfiguration/artikel-eier.
-- NULL erlaubt für Artikel ohne Stückzahl-Aussage (z. B. Gewicht in kg).
CREATE TABLE IF NOT EXISTS artikel_eier_konfiguration (
    artikel_code TEXT PRIMARY KEY,
    faktor INTEGER,
    aktualisiert_am TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""


# Seed-Werte für `artikel_eier_konfiguration`. Zusammen mit der Einheit-Prüfung
# in `berechne_eier()` (Faktor greift nur bei Einheit PACK) entspricht das dem
# hartcodierten Verhalten vor v1.4.0. Idempotent via INSERT OR IGNORE eingespielt,
# sodass ein bestehender User-Override beim Server-Update erhalten bleibt.
_EIER_KONFIG_DEFAULTS: tuple[tuple[str, int | None], ...] = (
    ("10er Kvp", 10),
    ("6er Kvp", 6),
    ("Lose 180", 1),
    ("Lose 20", 1),
    ("Lose unsortiert", 1),
    ("Gewicht (kg)", None),
    ("Sonstige", 1),
)


# Spalten-Reihenfolge der `verkaufspositionen`-Tabelle (für `INSERT … SELECT`
# in der Migration und für Schema-Vergleich). Muss synchron mit `SCHEMA_SQL`
# oben bleiben.
_VKP_COLUMNS = (
    "id", "import_id", "rechnungsdatum", "rechnungsnummer",
    "kundennummer", "kundenname", "menge", "einheit", "pack_code",
    "eier_stueck", "artikel_code", "groesse", "beschreibung",
    "preis_einheit", "gesamt",
)


def _migrate_unique_constraint(conn: sqlite3.Connection) -> bool:
    """Erweitert UNIQUE-Klausel auf `verkaufspositionen` um `rechnungsdatum`.

    Returns:
        True wenn die Migration tatsächlich gelaufen ist,
        False wenn das Schema bereits aktuell war (idempotent).

    Vor v1.0.4 lautete der Constraint
        UNIQUE(rechnungsnummer, kundennummer, menge, einheit, pack_code, beschreibung)
    Das verwarf wiederkehrende Bestellungen (gleicher Kunde + Artikel an
    verschiedenen Tagen) fälschlicherweise als Duplikat. Ab v1.0.4 ist
    `rechnungsdatum` Teil des Schlüssels. SQLite erlaubt keine in-place-
    Constraint-Änderung — daher Tabellen-Rebuild via Backup-Tabelle.
    """
    row = conn.execute(
        "SELECT sql FROM sqlite_master "
        "WHERE type='table' AND name='verkaufspositionen'"
    ).fetchone()
    if row is None:
        return False  # Frische DB — CREATE IF NOT EXISTS hat schon das neue Schema angelegt.

    table_sql = row["sql"] or ""
    # UNIQUE-Klausel extrahieren und prüfen, ob `rechnungsdatum` darin enthalten ist.
    match = re.search(r"unique\s*\(([^)]+)\)", table_sql, re.IGNORECASE)
    if match and "rechnungsdatum" in match.group(1).lower():
        return False  # Schema bereits aktuell.

    # --- Migration durchführen. ---
    # 1) Backup der DB-Datei (nur wenn echte Datei, nicht Memory-DB).
    if DB_PATH.exists():
        backup_path = DB_PATH.with_suffix(DB_PATH.suffix + ".pre-v1.0.4.bak")
        if not backup_path.exists():
            # Verbindung kurz schließen für sauberen File-Snapshot ist nicht nötig
            # — copy2 funktioniert auch bei offener Connection (SQLite-Locking
            # erlaubt parallele Reads des Files auf POSIX und Windows).
            shutil.copy2(DB_PATH, backup_path)
            print(f"[migration] DB-Backup angelegt: {backup_path}")

    # 2) FOREIGN_KEYS temporär aus (sonst löscht das DROP zugehörige imports).
    conn.execute("PRAGMA foreign_keys = OFF")
    try:
        conn.execute("BEGIN")
        # Spalten-Definitionen identisch zur SCHEMA_SQL oben — wenn dort etwas
        # geändert wird, hier mitziehen!
        conn.execute("""
            CREATE TABLE verkaufspositionen_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                import_id INTEGER REFERENCES imports(id) ON DELETE CASCADE,
                rechnungsdatum TEXT NOT NULL,
                rechnungsnummer TEXT,
                kundennummer TEXT NOT NULL,
                kundenname TEXT NOT NULL,
                menge REAL NOT NULL,
                einheit TEXT,
                pack_code INTEGER,
                eier_stueck INTEGER,
                artikel_code TEXT,
                groesse TEXT,
                beschreibung TEXT,
                preis_einheit REAL,
                gesamt REAL,
                UNIQUE(rechnungsdatum, rechnungsnummer, kundennummer, menge,
                       einheit, pack_code, beschreibung)
            )
        """)
        cols = ", ".join(_VKP_COLUMNS)
        conn.execute(
            f"INSERT INTO verkaufspositionen_new ({cols}) "
            f"SELECT {cols} FROM verkaufspositionen"
        )
        # Zeilenanzahl für Log
        n = conn.execute("SELECT COUNT(*) AS c FROM verkaufspositionen_new").fetchone()["c"]
        conn.execute("DROP TABLE verkaufspositionen")
        conn.execute("ALTER TABLE verkaufspositionen_new RENAME TO verkaufspositionen")
        # Indizes waren an die alte Tabelle gebunden — neu anlegen.
        conn.execute("CREATE INDEX IF NOT EXISTS idx_datum   ON verkaufspositionen(rechnungsdatum)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_kunde   ON verkaufspositionen(kundennummer)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_artikel ON verkaufspositionen(artikel_code)")
        conn.commit()
        print(f"[migration] verkaufspositionen UNIQUE-Constraint auf v1.0.4 erweitert "
              f"({n} Zeilen migriert).")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.execute("PRAGMA foreign_keys = ON")

    return True


def _repariere_eier_stueck(conn: sqlite3.Connection) -> bool:
    """Repariert einheit-unbewusst berechnete `eier_stueck`-Werte (v1.4.1).

    Returns:
        True wenn die Reparatur tatsächlich gelaufen ist,
        False wenn alle Werte bereits konsistent waren (idempotent).

    v1.4.0 wendete den Eier-Faktor allein anhand des `artikel_code` an. Dadurch
    wurden stk-Positionen mit PackCode 110/111 (Menge zählt bereits einzelne
    Eier) ver-10-/ver-6-facht — beim Import und bei jeder rückwirkenden
    Neuberechnung über die Konfigurationsseite. Erkennung per NULL-sicherem
    Vergleich gegen den korrekten CASE-Ausdruck; nur bei Abweichungen wird
    (nach Datei-Backup) alles neu berechnet.
    """
    row = conn.execute(
        "SELECT COUNT(*) AS c FROM verkaufspositionen "
        f"WHERE eier_stueck IS NOT ({EIER_STUECK_CASE_SQL})"
    ).fetchone()
    abweichend = int(row["c"])
    if abweichend == 0:
        return False

    # Datei-Backup vor der Daten-Reparatur (analog zur v1.0.4-Migration).
    if DB_PATH.exists():
        backup_path = DB_PATH.with_suffix(DB_PATH.suffix + ".pre-v1.4.1.bak")
        if not backup_path.exists():
            shutil.copy2(DB_PATH, backup_path)
            print(f"[migration] DB-Backup angelegt: {backup_path}")

    try:
        conn.execute("BEGIN")
        n = berechne_eier_stueck_neu(conn)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    print(
        f"[migration] eier_stueck einheit-bewusst neu berechnet: "
        f"{abweichend} von {n} Zeilen korrigiert (v1.4.1)."
    )
    return True


def _migriere_stk_artikel_codes(conn: sqlite3.Connection) -> bool:
    """Weist stk-/leer-Positionen mit PackCode 110/111 eigene Artikel-Codes zu (v1.5.0).

    Returns:
        True wenn die Migration tatsächlich gelaufen ist,
        False wenn alle Artikel-Codes bereits getrennt waren (idempotent).

    Bis v1.4.x ordnete `normiere_artikel()` alle Positionen mit PackCode
    110/111 dem Artikel „10er/6er Kvp" zu — unabhängig von der Einheit. Die
    Artikel-Auswertung mischte dadurch PACK-Mengen (Verpackungen) mit
    stk-Mengen (einzelne Eier) in einer Zeile. Seit v1.5.0 erhalten pro Stück
    fakturierte Positionen den Suffix „(stk)"; die Erkennung hier muss
    synchron mit dem PACK-Kriterium in `normiere_artikel()` bleiben.
    `eier_stueck` ist nicht betroffen (stk zählt 1:1, unabhängig vom Code).
    """
    nicht_pack = "UPPER(TRIM(COALESCE(einheit, ''))) != 'PACK'"
    row = conn.execute(
        "SELECT COUNT(*) AS c FROM verkaufspositionen "
        f"WHERE pack_code IN (110, 111) AND {nicht_pack} "
        "  AND artikel_code NOT LIKE '% (stk)'"
    ).fetchone()
    abweichend = int(row["c"])
    if abweichend == 0:
        return False

    # Datei-Backup vor der Daten-Migration (analog zu v1.0.4 / v1.4.1).
    if DB_PATH.exists():
        backup_path = DB_PATH.with_suffix(DB_PATH.suffix + ".pre-v1.5.0.bak")
        if not backup_path.exists():
            shutil.copy2(DB_PATH, backup_path)
            print(f"[migration] DB-Backup angelegt: {backup_path}")

    try:
        conn.execute("BEGIN")
        for code, artikel in ((110, "10er Kvp (stk)"), (111, "6er Kvp (stk)")):
            conn.execute(
                "UPDATE verkaufspositionen SET artikel_code = ? "
                f"WHERE pack_code = ? AND {nicht_pack} AND artikel_code != ?",
                (artikel, code, artikel),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    print(
        f"[migration] Kvp-Artikel nach Abrechnungsart getrennt: "
        f"{abweichend} stk-/leer-Position(en) mit PackCode 110/111 auf "
        f"eigenen „(stk)“-Artikel-Code umgestellt (v1.5.0)."
    )
    return True


def init_db() -> None:
    """Legt das Schema idempotent an. Wird beim FastAPI-Startup aufgerufen.

    Führt zusätzlich automatisch durch — jeweils nur wenn nötig:
    - v1.0.4-Migration (UNIQUE-Constraint um `rechnungsdatum` erweitert)
    - v1.4.1-Reparatur (`eier_stueck` einheit-bewusst neu berechnet;
      benötigt die geseedete Konfig-Tabelle, daher nach dem Seed)
    - v1.5.0-Migration (stk-Positionen mit PackCode 110/111 erhalten
      eigene Artikel-Codes „10er/6er Kvp (stk)")
    """
    _ensure_parent()
    conn = get_conn()
    try:
        conn.executescript(SCHEMA_SQL)
        conn.commit()
        _migrate_unique_constraint(conn)
        _seed_eier_konfiguration(conn)
        _repariere_eier_stueck(conn)
        _migriere_stk_artikel_codes(conn)
    finally:
        conn.close()


def _seed_eier_konfiguration(conn: sqlite3.Connection) -> None:
    """Trägt die Default-Faktoren idempotent ein.

    Bestehende Einträge (z. B. User-Overrides nach erstem Konfigurations-Speichern)
    bleiben durch INSERT OR IGNORE unberührt.
    """
    conn.executemany(
        "INSERT OR IGNORE INTO artikel_eier_konfiguration (artikel_code, faktor) "
        "VALUES (?, ?)",
        _EIER_KONFIG_DEFAULTS,
    )
    conn.commit()


__all__ = ["DB_PATH", "get_conn", "db_cursor", "init_db", "SCHEMA_SQL"]
