"""SQLite-Datenbankzugriff: Verbindung, Schema-Initialisierung, Hilfsfunktionen."""
from __future__ import annotations

import os
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
    UNIQUE(rechnungsnummer, kundennummer, menge, einheit, pack_code, beschreibung)
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


def init_db() -> None:
    """Legt das Schema idempotent an. Wird beim FastAPI-Startup aufgerufen."""
    _ensure_parent()
    conn = get_conn()
    try:
        conn.executescript(SCHEMA_SQL)
        conn.commit()
    finally:
        conn.close()


__all__ = ["DB_PATH", "get_conn", "db_cursor", "init_db", "SCHEMA_SQL"]
