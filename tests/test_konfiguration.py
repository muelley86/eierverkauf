"""Integrationstests gegen tmp-SQLite: Konfig-Neuberechnung, Reparatur-Migration,
CSV-Import Ende-zu-Ende.

Alle Daten synthetisch; die Mini-CSV spiegelt die Struktur des
Warenwirtschafts-Exports (Metazeilen, #-Spalten, deutsche Zahlen, Summenzeile).
"""
import pytest

import data.db as db
from data.importer import import_csv
from data.konfiguration import (
    berechne_eier_stueck_neu,
    lade_eier_konfig,
    speichere_eier_konfig,
)


@pytest.fixture()
def tmp_db(tmp_path, monkeypatch):
    """Frische DB unter tmp_path; init_db() legt Schema + Seed-Faktoren an."""
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")
    db.init_db()
    conn = db.get_conn()
    yield conn
    conn.close()


def _insert_position(conn, *, menge, einheit, pack_code, artikel_code,
                     eier_stueck, beschreibung, nr="2026-001"):
    conn.execute(
        """INSERT INTO verkaufspositionen
             (rechnungsdatum, rechnungsnummer, kundennummer, kundenname,
              menge, einheit, pack_code, eier_stueck, artikel_code, beschreibung)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        ("2026-05-01", nr, "10001", "Testkunde",
         menge, einheit, pack_code, eier_stueck, artikel_code, beschreibung),
    )
    conn.commit()


def _eier_je_beschreibung(conn) -> dict[str, int | None]:
    rows = conn.execute(
        "SELECT beschreibung, eier_stueck FROM verkaufspositionen"
    ).fetchall()
    return {r["beschreibung"]: r["eier_stueck"] for r in rows}


def _testpositionen_anlegen(conn, *, mit_falschen_eiern: bool) -> None:
    """Vier Positionen, die alle Einheit-Klassen abdecken.

    ``mit_falschen_eiern=True`` simuliert den v1.4.0-Zustand (Faktor auch auf
    stk angewendet, stk-Positionen noch ohne eigenen „(stk)"-Artikel-Code).
    """
    _insert_position(conn, menge=180, einheit="stk", pack_code=110,
                     artikel_code="10er Kvp" if mit_falschen_eiern else "10er Kvp (stk)",
                     eier_stueck=1800 if mit_falschen_eiern else 180,
                     beschreibung="stk-110")
    _insert_position(conn, menge=36, einheit="PACK", pack_code=110,
                     artikel_code="10er Kvp", eier_stueck=360,
                     beschreibung="PACK-110")
    _insert_position(conn, menge=12.5, einheit="kg", pack_code=None,
                     artikel_code="Gewicht (kg)", eier_stueck=None,
                     beschreibung="kg-Ware")
    _insert_position(conn, menge=25, einheit=None, pack_code=None,
                     artikel_code="Sonstige", eier_stueck=25,
                     beschreibung="ohne-Einheit")


# ---------------------------------------------------------------------------
# speichere_eier_konfig — Neuberechnung muss einheit-bewusst sein
# ---------------------------------------------------------------------------

def test_speichern_wendet_faktor_nur_auf_pack_positionen_an(tmp_db):
    # Arrange: v1.4.0-korrumpierte Werte in der DB
    _testpositionen_anlegen(tmp_db, mit_falschen_eiern=True)

    # Act: unveränderte Default-Faktoren erneut speichern
    speichere_eier_konfig(tmp_db, lade_eier_konfig(tmp_db))

    # Assert: stk zählt 1:1, PACK × Faktor, kg → None, leer 1:1
    assert _eier_je_beschreibung(tmp_db) == {
        "stk-110": 180,
        "PACK-110": 360,
        "kg-Ware": None,
        "ohne-Einheit": 25,
    }


def test_faktor_aenderung_wirkt_nur_auf_pack_positionen(tmp_db):
    # Arrange
    _testpositionen_anlegen(tmp_db, mit_falschen_eiern=False)

    # Act: 10er Kvp künftig als 12er-Verpackung
    speichere_eier_konfig(tmp_db, {"10er Kvp": 12})

    # Assert: nur die PACK-Position ändert sich
    eier = _eier_je_beschreibung(tmp_db)
    assert eier["PACK-110"] == 432
    assert eier["stk-110"] == 180


def test_berechne_eier_stueck_neu_liefert_anzahl_zeilen(tmp_db):
    _testpositionen_anlegen(tmp_db, mit_falschen_eiern=False)

    assert berechne_eier_stueck_neu(tmp_db) == 4


# ---------------------------------------------------------------------------
# Reparatur-Migration beim Startup (init_db)
# ---------------------------------------------------------------------------

def test_migration_repariert_v140_werte(tmp_db, tmp_path, capsys):
    # Arrange: korrumpierte Daten wie nach einem v1.4.0-Import
    _testpositionen_anlegen(tmp_db, mit_falschen_eiern=True)

    # Act: App-Start
    db.init_db()

    # Assert: repariert + Backup angelegt + Migration geloggt
    assert _eier_je_beschreibung(tmp_db)["stk-110"] == 180
    assert (tmp_path / "test.db.pre-v1.4.1.bak").exists()
    assert "[migration]" in capsys.readouterr().out


def test_migration_ist_idempotent(tmp_db, capsys):
    # Arrange: bereits korrekte Daten
    _testpositionen_anlegen(tmp_db, mit_falschen_eiern=False)
    capsys.readouterr()

    # Act
    db.init_db()

    # Assert: kein Reparatur-Lauf
    assert "[migration]" not in capsys.readouterr().out


# ---------------------------------------------------------------------------
# v1.5.0-Migration: stk-Positionen mit PackCode 110/111 bekommen eigenen
# Artikel-Code („10er Kvp (stk)" / „6er Kvp (stk)")
# ---------------------------------------------------------------------------

def _artikel_je_beschreibung(conn) -> dict[str, str]:
    rows = conn.execute(
        "SELECT beschreibung, artikel_code FROM verkaufspositionen"
    ).fetchall()
    return {r["beschreibung"]: r["artikel_code"] for r in rows}


def test_migration_weist_stk_kvp_positionen_eigenen_artikel_zu(tmp_db, tmp_path):
    # Arrange: Bestandsdaten vor v1.5.0 — Eier bereits korrekt, aber
    # stk-Positionen tragen noch den gemeinsamen Kvp-Artikel-Code.
    _insert_position(tmp_db, menge=180, einheit="stk", pack_code=110,
                     artikel_code="10er Kvp", eier_stueck=180,
                     beschreibung="stk-110")
    _insert_position(tmp_db, menge=48, einheit="stk", pack_code=111,
                     artikel_code="6er Kvp", eier_stueck=48,
                     beschreibung="stk-111")
    _insert_position(tmp_db, menge=36, einheit="PACK", pack_code=110,
                     artikel_code="10er Kvp", eier_stueck=360,
                     beschreibung="PACK-110")

    # Act: App-Start
    db.init_db()

    # Assert: nur die stk-Positionen wechseln den Artikel-Code
    assert _artikel_je_beschreibung(tmp_db) == {
        "stk-110": "10er Kvp (stk)",
        "stk-111": "6er Kvp (stk)",
        "PACK-110": "10er Kvp",
    }
    # eier_stueck bleibt unangetastet, Backup wurde angelegt
    assert _eier_je_beschreibung(tmp_db) == {
        "stk-110": 180, "stk-111": 48, "PACK-110": 360,
    }
    assert (tmp_path / "test.db.pre-v1.5.0.bak").exists()


def test_artikel_migration_ist_idempotent(tmp_db, capsys):
    # Arrange: bereits migrierte Daten
    _insert_position(tmp_db, menge=180, einheit="stk", pack_code=110,
                     artikel_code="10er Kvp (stk)", eier_stueck=180,
                     beschreibung="stk-110")
    _insert_position(tmp_db, menge=36, einheit="PACK", pack_code=110,
                     artikel_code="10er Kvp", eier_stueck=360,
                     beschreibung="PACK-110")
    capsys.readouterr()

    # Act
    db.init_db()

    # Assert: kein Migrations-Lauf
    assert "[migration]" not in capsys.readouterr().out


# ---------------------------------------------------------------------------
# import_csv — Ende-zu-Ende mit synthetischer Mini-CSV
# ---------------------------------------------------------------------------

MINI_CSV = '''"Belege - Rechnungen - Rechnungspositionen"

"Eierverkäufe Je Rechnungsposition"
Datumsbereich;"01.05.26 - 31.05.26"
Filter;"Kerba Bio-Ei GbR, Eier, Nach Leistungsdatum"

Datum;Nummer;#;Kunde;Mitarbeiter;Menge;Einheit;#;Beschreibung;Preis/Einh.;Mwst.;Diesel/Einh.;"Rabatt Rg.";"Rabatt Pos.";Gesamt
02.05.26;2026-001;10001;"Testkunde A";"Muster, Max";180,000;stk;110;"110 Bio-Eier 10er Kvp Größe L, Gütekl. A";0,338;7%;0,000;0%;0%;60,840
02.05.26;2026-001;10001;"Testkunde A";"Muster, Max";36,000;PACK;110;"110 Bio-Eier 10er Kvp Größe L, Gütekl. A Kartons: 2";3,550;7%;0,000;0%;0%;127,800
03.05.26;2026-002;10002;"Testkunde B";"Muster, Max";30,000;PACK;111;"111 Bio-Eier 6er Kvp Größe M, Gütekl. A";2,172;7%;0,000;0%;0%;65,160
04.05.26;2026-003;10003;"Testkunde C";"Muster, Max";210,000;stk;;"Bio-Eier 180 lose Größe S, Gütekl. A";0,160;7%;0,000;0%;0%;33,600
;;;;;456,000;;;;;;;;;287,400
'''


def test_import_csv_berechnet_eier_einheit_bewusst(tmp_db, tmp_path):
    # Arrange
    csv_pfad = tmp_path / "mini.csv"
    csv_pfad.write_text(MINI_CSV, encoding="utf-8")

    # Act
    ergebnis = import_csv(csv_pfad, "mini.csv")

    # Assert
    assert ergebnis.zeilen_importiert == 4
    assert ergebnis.zeilen_fehlerhaft == 0
    rows = tmp_db.execute(
        "SELECT einheit, pack_code, eier_stueck, artikel_code "
        "FROM verkaufspositionen ORDER BY id"
    ).fetchall()
    assert [r["eier_stueck"] for r in rows] == [180, 360, 180, 210]
    assert [r["artikel_code"] for r in rows] == [
        "10er Kvp (stk)", "10er Kvp", "6er Kvp", "Lose 180",
    ]
