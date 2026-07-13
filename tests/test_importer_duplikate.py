"""Tests: identische Doppel-Positionen einer Rechnung überleben den Import,
und der Re-Import derselben Datei bleibt vollständig idempotent.

Regression März 2026 (zwei Bugs im UNIQUE-Schlüssel):

1. Eine Rechnung enthielt zwei vollständig identische Positionen (gleiche
   Lieferung zweimal am selben Tag) — die zweite wurde als Duplikat verworfen
   (−720 Eier / −255,60 € im Dashboard). Der Vorkommens-Index ``key_lauf``
   macht solche Zeilen unterscheidbar.
2. SQLite behandelt NULLs in UNIQUE-Constraints als paarweise verschieden —
   Positionen ohne Pack-Code (lose Eier, kg) wurden dadurch beim Re-Import
   NIE als Duplikat erkannt und still verdoppelt. Die Duplikat-Erkennung
   läuft jetzt über einen UNIQUE-Index mit COALESCE.

Alle Daten synthetisch.
"""
import sqlite3

import pytest

import data.db as db
from data.importer import import_csv

CSV_KOPF = (
    '"Belege - Rechnungen - Rechnungspositionen"\n'
    'Datumsbereich;"01.03.26 - 31.03.26"\n'
    "\n"
    "Datum;Nummer;#;Kunde;Mitarbeiter;Menge;Einheit;#;Beschreibung;"
    'Preis/Einh.;Mwst.;Diesel/Einh.;"Rabatt Rg.";"Rabatt Pos.";Gesamt\n'
)

BESCHREIBUNG_KVP10 = "110 Bio-Eier 10er Kvp Größe L MHD: ab 17.04.2026"
BESCHREIBUNG_LOSE = "Bio-Eier 90 lose Größe M MHD: 10.04.2026"

ZEILE_KVP10 = (
    '23.03.26;2026-165;15100080;"REWE Markt";"Baasch, Johannes";72,000;PACK;110;'
    f'"{BESCHREIBUNG_KVP10}";3,550;7%;0,000;0%;0%;255,600\n'
)
ZEILE_KVP6 = (
    '23.03.26;2026-165;15100080;"REWE Markt";"Baasch, Johannes";60,000;PACK;111;'
    '"111 Bio-Eier 6er Kvp Größe M MHD: ab 17.04.2026";2,172;7%;0,000;0%;0%;130,320\n'
)
# Lose Ware ohne Pack-Code — pack_code wird NULL (Regressionsfall 2).
ZEILE_LOSE = (
    '23.03.26;2026-165;15100080;"REWE Markt";"Baasch, Johannes";90,000;stk;;'
    f'"{BESCHREIBUNG_LOSE}";0,300;7%;0,000;0%;0%;27,000\n'
)

# Zwei identische 10er-Positionen + 6er-Position + lose Position ohne
# Pack-Code: 720 + 720 + 360 + 90 = 1.890 Eier, 668,52 €.
CSV_MIT_DOPPELPOSITION = CSV_KOPF + ZEILE_KVP10 + ZEILE_KVP10 + ZEILE_KVP6 + ZEILE_LOSE

# Schema der Tabelle `verkaufspositionen` vor Einführung von `key_lauf`
# (Stand v1.0.4 bis v1.12.x) — für die Migrations-Tests.
_ALTES_VKP_SCHEMA = """
CREATE TABLE imports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    import_datum TEXT NOT NULL,
    dateiname TEXT NOT NULL,
    datumsbereich TEXT,
    zeilen_importiert INTEGER DEFAULT 0,
    zeilen_uebersprungen INTEGER DEFAULT 0,
    zeilen_fehlerhaft INTEGER DEFAULT 0
);
CREATE TABLE verkaufspositionen (
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
"""

_ALT_INSERT_KVP10 = (
    """INSERT INTO verkaufspositionen
         (rechnungsdatum, rechnungsnummer, kundennummer, kundenname,
          menge, einheit, pack_code, eier_stueck, artikel_code,
          beschreibung, preis_einheit, gesamt)
       VALUES ('2026-03-23', '2026-165', '15100080', 'REWE Markt',
               72.0, 'PACK', 110, 720, '10er Kvp', ?, 3.55, 255.6)"""
)
_ALT_INSERT_LOSE = (
    """INSERT INTO verkaufspositionen
         (rechnungsdatum, rechnungsnummer, kundennummer, kundenname,
          menge, einheit, pack_code, eier_stueck, artikel_code,
          beschreibung, preis_einheit, gesamt)
       VALUES ('2026-03-23', '2026-165', '15100080', 'REWE Markt',
               90.0, 'stk', NULL, 90, 'Sonstige', ?, 0.3, 27.0)"""
)


@pytest.fixture()
def frische_db(tmp_path, monkeypatch):
    """Frische DB unter tmp_path; init_db() legt Schema + Seed-Faktoren an."""
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")
    db.init_db()


def _schreibe_csv(tmp_path, inhalt: str):
    pfad = tmp_path / "import.csv"
    pfad.write_text(inhalt, encoding="utf-8")
    return pfad


def _vkp_zeilen(spalten: str = "*") -> list:
    conn = db.get_conn()
    try:
        return conn.execute(f"SELECT {spalten} FROM verkaufspositionen").fetchall()
    finally:
        conn.close()


def _alt_schema_db(db_pfad, inserts) -> None:
    """Legt eine DB im Alt-Schema (ohne key_lauf) mit Bestandszeilen an."""
    conn = sqlite3.connect(str(db_pfad))
    conn.executescript(_ALTES_VKP_SCHEMA)
    for sql, params in inserts:
        conn.execute(sql, params)
    conn.commit()
    conn.close()


def test_identische_doppelpositionen_werden_beide_importiert(frische_db, tmp_path):
    # Arrange
    csv_pfad = _schreibe_csv(tmp_path, CSV_MIT_DOPPELPOSITION)

    # Act
    ergebnis = import_csv(csv_pfad, "import.csv")

    # Assert: beide identischen Positionen landen in der DB (1.890 Eier gesamt)
    assert ergebnis.zeilen_importiert == 4
    assert ergebnis.zeilen_uebersprungen == 0
    zeilen = _vkp_zeilen("eier_stueck, gesamt")
    assert len(zeilen) == 4
    assert sum(z["eier_stueck"] for z in zeilen) == 1890
    assert round(sum(z["gesamt"] for z in zeilen), 2) == 668.52


def test_reimport_derselben_datei_bleibt_idempotent(frische_db, tmp_path):
    # Arrange
    csv_pfad = _schreibe_csv(tmp_path, CSV_MIT_DOPPELPOSITION)
    import_csv(csv_pfad, "import.csv")

    # Act: exakt dieselbe Datei erneut importieren
    ergebnis = import_csv(csv_pfad, "import.csv")

    # Assert: nichts neu — auch die lose Position ohne Pack-Code (NULL im
    # Schlüssel) wird als Duplikat erkannt, Bestand bleibt unverändert.
    assert ergebnis.zeilen_importiert == 0
    assert ergebnis.zeilen_uebersprungen == 4
    assert len(_vkp_zeilen("id")) == 4


def test_migration_ergaenzt_key_lauf_und_erhaelt_daten(tmp_path, monkeypatch):
    # Arrange: Alt-Schema-DB mit einer Bestandszeile UND einem Altlast-Paar:
    # zwei identische Zeilen ohne Pack-Code, die der alte Constraint wegen
    # NULL nie als Duplikat erkannte (z. B. durch früheren Re-Import).
    db_pfad = tmp_path / "alt.db"
    monkeypatch.setattr(db, "DB_PATH", db_pfad)
    _alt_schema_db(db_pfad, [
        (_ALT_INSERT_KVP10, (BESCHREIBUNG_KVP10,)),
        (_ALT_INSERT_LOSE, (BESCHREIBUNG_LOSE,)),
        (_ALT_INSERT_LOSE, (BESCHREIBUNG_LOSE,)),
    ])

    # Act
    db.init_db()

    # Assert: Daten vollständig erhalten, Altlast-Paar durchnummeriert (1, 2),
    # Duplikat-Erkennung läuft über den neuen UNIQUE-Index.
    conn = db.get_conn()
    try:
        index_sql = conn.execute(
            "SELECT sql FROM sqlite_master WHERE type='index' AND name='ux_vkp_dedup'"
        ).fetchone()
        zeilen = conn.execute(
            "SELECT pack_code, key_lauf, eier_stueck FROM verkaufspositionen "
            "ORDER BY pack_code IS NULL, key_lauf"
        ).fetchall()
    finally:
        conn.close()
    assert index_sql is not None
    assert "key_lauf" in index_sql["sql"].lower()
    assert len(zeilen) == 3
    kvp = [z for z in zeilen if z["pack_code"] == 110]
    lose = [z for z in zeilen if z["pack_code"] is None]
    assert [z["key_lauf"] for z in kvp] == [1]
    assert sorted(z["key_lauf"] for z in lose) == [1, 2]


def test_migration_aus_pre_v104_schema_laeuft_beide_stufen(tmp_path, monkeypatch):
    """Pre-v1.0.4-DB (UNIQUE noch ohne rechnungsdatum): init_db() muss beide
    Rebuilds nacheinander ausführen (v1.0.4, dann v1.13.0) und die Daten
    vollständig erhalten."""
    # Arrange: Ur-Schema mit UNIQUE ohne rechnungsdatum
    db_pfad = tmp_path / "uralt.db"
    monkeypatch.setattr(db, "DB_PATH", db_pfad)
    ur_schema = _ALTES_VKP_SCHEMA.replace(
        "UNIQUE(rechnungsdatum, rechnungsnummer,", "UNIQUE(rechnungsnummer,"
    )
    conn = sqlite3.connect(str(db_pfad))
    conn.executescript(ur_schema)
    conn.execute(_ALT_INSERT_KVP10, (BESCHREIBUNG_KVP10,))
    conn.commit()
    conn.close()

    # Act
    db.init_db()

    # Assert: Zeile erhalten, key_lauf gesetzt, Dedup-Index vorhanden
    conn = db.get_conn()
    try:
        index_da = conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type='index' AND name='ux_vkp_dedup'"
        ).fetchone()
        zeilen = conn.execute(
            "SELECT key_lauf, eier_stueck FROM verkaufspositionen"
        ).fetchall()
    finally:
        conn.close()
    assert index_da is not None
    assert len(zeilen) == 1
    assert zeilen[0]["key_lauf"] == 1
    assert zeilen[0]["eier_stueck"] == 720


def test_init_db_ist_ueber_neustarts_idempotent(tmp_path, monkeypatch):
    """Zweiter init_db()-Aufruf (App-Neustart) darf weder migrieren noch
    Daten verändern."""
    # Arrange: Alt-Schema-DB einmal migrieren und Bestand einfrieren
    db_pfad = tmp_path / "neustart.db"
    monkeypatch.setattr(db, "DB_PATH", db_pfad)
    _alt_schema_db(db_pfad, [(_ALT_INSERT_KVP10, (BESCHREIBUNG_KVP10,))])
    db.init_db()
    conn = db.get_conn()
    vorher = [dict(r) for r in conn.execute(
        "SELECT * FROM verkaufspositionen ORDER BY id"
    ).fetchall()]
    conn.close()

    # Act: zweiter Startup
    db.init_db()

    # Assert: Bestand byte-identisch, Backup-Datei wurde nicht erneuert
    conn = db.get_conn()
    nachher = [dict(r) for r in conn.execute(
        "SELECT * FROM verkaufspositionen ORDER BY id"
    ).fetchall()]
    conn.close()
    assert nachher == vorher


def test_nachimport_ergaenzt_frueher_verworfene_doppelposition(tmp_path, monkeypatch):
    """Prod-Recovery: Bestand enthält eine der beiden identischen Positionen
    (die zweite wurde vor dem Fix verworfen) sowie die lose Position. Ein
    erneuter Upload derselben CSV importiert genau die fehlenden Zeilen nach —
    ohne die vorhandenen (auch die mit NULL-Pack-Code) zu verdoppeln."""
    # Arrange
    db_pfad = tmp_path / "prod.db"
    monkeypatch.setattr(db, "DB_PATH", db_pfad)
    _alt_schema_db(db_pfad, [
        (_ALT_INSERT_KVP10, (BESCHREIBUNG_KVP10,)),
        (_ALT_INSERT_LOSE, (BESCHREIBUNG_LOSE,)),
    ])
    db.init_db()
    csv_pfad = _schreibe_csv(tmp_path, CSV_MIT_DOPPELPOSITION)

    # Act
    ergebnis = import_csv(csv_pfad, "import.csv")

    # Assert: zweite 10er-Position + 6er-Position neu; erste 10er-Position
    # und lose Position als Duplikat übersprungen.
    assert ergebnis.zeilen_importiert == 2
    assert ergebnis.zeilen_uebersprungen == 2
    zeilen = _vkp_zeilen("eier_stueck")
    assert len(zeilen) == 4
    assert sum(z["eier_stueck"] for z in zeilen) == 1890
