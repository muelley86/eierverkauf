"""SQLite-Datenbankzugriff: Verbindung, Schema-Initialisierung, Hilfsfunktionen."""
from __future__ import annotations

import os
import re
import shutil
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

# DB-Pfad konfigurierbar via Env-Variable, sonst projektrelativ.
_DEFAULT_DB = Path(__file__).resolve().parent.parent / "data" / "eierverkauf.db"
DB_PATH = Path(os.environ.get("EIERVERKAUF_DB", str(_DEFAULT_DB)))


def _ensure_parent() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)


def get_conn() -> sqlite3.Connection:
    """Liefert eine neue SQLite-Connection mit Foreign-Key-Enforcement und Row-Factory."""
    _ensure_parent()
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
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
"""


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


def init_db() -> None:
    """Legt das Schema idempotent an. Wird beim FastAPI-Startup aufgerufen.

    Führt zusätzlich die v1.0.4-Migration (UNIQUE-Constraint um `rechnungsdatum`
    erweitert) automatisch durch — nur wenn nötig.
    """
    _ensure_parent()
    conn = get_conn()
    try:
        conn.executescript(SCHEMA_SQL)
        conn.commit()
        _migrate_unique_constraint(conn)
    finally:
        conn.close()


__all__ = ["DB_PATH", "get_conn", "db_cursor", "init_db", "SCHEMA_SQL"]
