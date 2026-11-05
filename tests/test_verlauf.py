"""Tests für den zeitraumabhängigen Dashboard-Verlauf (v1.16.0).

Reine Bucket-Logik (``data.verlauf``) plus Integration über
``GET /api/dashboard/verlauf``. Alle Daten synthetisch.
"""
from datetime import date

import pytest
from fastapi.testclient import TestClient

import data.db as db
import main
from data.verlauf import bucket_verlauf, waehle_granularitaet


# ---------------------------------------------------------------------------
# waehle_granularitaet
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    ("von", "bis", "erwartet"),
    [
        (date(2026, 1, 1), date(2026, 1, 1), "tag"),
        (date(2026, 1, 1), date(2026, 3, 3), "tag"),     # 62 Tage
        (date(2026, 1, 1), date(2026, 3, 4), "woche"),   # 63 Tage
        (date(2026, 1, 1), date(2026, 7, 2), "woche"),   # 183 Tage
        (date(2026, 1, 1), date(2026, 7, 3), "monat"),   # 184 Tage
        (date(2025, 1, 1), date(2026, 12, 31), "monat"),
    ],
)
def test_waehle_granularitaet_schwellen(von, bis, erwartet):
    assert waehle_granularitaet(von, bis) == erwartet


# ---------------------------------------------------------------------------
# bucket_verlauf
# ---------------------------------------------------------------------------

def _tag(datum: str, eier: float, umsatz: float) -> dict:
    return {"datum": datum, "eier": eier, "umsatz": umsatz}


def test_bucket_tag_fuellt_leere_tage_mit_null():
    # Arrange
    werte = [_tag("2026-11-02", 100, 25.0)]

    # Act
    punkte = bucket_verlauf(werte, date(2026, 11, 1), date(2026, 11, 3), "tag")

    # Assert
    assert [p["start"] for p in punkte] == ["2026-11-01", "2026-11-02", "2026-11-03"]
    assert [p["eier"] for p in punkte] == [0, 100, 0]
    assert punkte[1]["umsatz"] == pytest.approx(25.0)


def test_bucket_woche_relativ_zu_von():
    # Arrange: Mittwoch als Start → Wochen laufen Mi–Di
    werte = [_tag("2026-01-07", 10, 1.0), _tag("2026-01-13", 5, 1.0),
             _tag("2026-01-14", 7, 1.0)]

    # Act
    punkte = bucket_verlauf(werte, date(2026, 1, 7), date(2026, 1, 20), "woche")

    # Assert
    assert [p["start"] for p in punkte] == ["2026-01-07", "2026-01-14"]
    assert [p["eier"] for p in punkte] == [15, 7]


def test_bucket_monat_ueber_jahreswechsel():
    # Arrange
    werte = [_tag("2025-11-15", 1, 1.0), _tag("2025-12-31", 2, 2.0),
             _tag("2026-01-01", 4, 4.0), _tag("2026-02-28", 8, 8.0)]

    # Act
    punkte = bucket_verlauf(werte, date(2025, 11, 15), date(2026, 2, 28), "monat")

    # Assert: erster Bucket beginnt bei von, weitere am Monatsersten
    assert [p["start"] for p in punkte] == [
        "2025-11-15", "2025-12-01", "2026-01-01", "2026-02-01"]
    assert [p["eier"] for p in punkte] == [1, 2, 4, 8]


def test_bucket_ignoriert_werte_ausserhalb_und_mutiert_eingabe_nicht():
    # Arrange
    werte = [_tag("2026-10-31", 99, 9.0), _tag("2026-11-01", 1, 1.0)]
    kopie = [dict(w) for w in werte]

    # Act
    punkte = bucket_verlauf(werte, date(2026, 11, 1), date(2026, 11, 1), "tag")

    # Assert
    assert [p["eier"] for p in punkte] == [1]
    assert werte == kopie


def test_bucket_leere_eingabe_liefert_nullreihe():
    punkte = bucket_verlauf([], date(2026, 1, 1), date(2026, 3, 31), "monat")
    assert len(punkte) == 3
    assert all(p["eier"] == 0 and p["umsatz"] == 0 for p in punkte)


# ---------------------------------------------------------------------------
# GET /api/dashboard/verlauf
# ---------------------------------------------------------------------------

@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")
    db.init_db()
    with TestClient(main.app) as c:
        yield c


def _position(datum: str, eier: int, gesamt: float, nr: str) -> None:
    conn = db.get_conn()
    try:
        conn.execute(
            """INSERT INTO verkaufspositionen
                 (rechnungsdatum, rechnungsnummer, kundennummer, kundenname,
                  menge, einheit, pack_code, eier_stueck, artikel_code, beschreibung, gesamt)
               VALUES (?, ?, '10001', 'Testkunde', ?, 'stk', NULL, ?, 'Lose 20', 'x', ?)""",
            (datum, nr, eier, eier, gesamt),
        )
        conn.commit()
    finally:
        conn.close()


def test_verlauf_folgt_zeitraum_mit_vorjahr(client):
    # Arrange
    _position("2026-11-02", 100, 30.0, "R-1")
    _position("2025-11-02", 80, 20.0, "R-0")
    _position("2026-10-15", 999, 999.0, "R-X")  # außerhalb

    # Act
    antwort = client.get("/api/dashboard/verlauf?von=2026-11-01&bis=2026-11-30")

    # Assert
    assert antwort.status_code == 200
    body = antwort.json()
    assert body["granularitaet"] == "tag"
    assert len(body["punkte"]) == 30
    zweiter = body["punkte"][1]
    assert zweiter["start"] == "2026-11-02"
    assert zweiter["eier"] == 100
    assert zweiter["vorjahr_eier"] == 80
    assert sum(p["eier"] for p in body["punkte"]) == 100


def test_verlauf_schaltjahr_vorjahr_shift(client):
    # Arrange: 29.02.2028 → Vorjahreszeitraum beginnt am 28.02.2027
    _position("2027-02-28", 5, 1.0, "R-1")

    # Act
    antwort = client.get("/api/dashboard/verlauf?von=2028-02-29&bis=2028-03-02")

    # Assert
    punkte = antwort.json()["punkte"]
    assert [p["start"] for p in punkte] == ["2028-02-29", "2028-03-01", "2028-03-02"]
    assert punkte[0]["vorjahr_eier"] == 5


def test_verlauf_ohne_zeitraum_nutzt_datenbereich_ohne_vorjahr(client):
    # Arrange
    _position("2026-01-10", 1, 1.0, "R-1")
    _position("2026-12-10", 2, 2.0, "R-2")

    # Act
    body = client.get("/api/dashboard/verlauf").json()

    # Assert
    assert body["granularitaet"] == "monat"
    assert len(body["punkte"]) == 12
    assert body["punkte"][0]["vorjahr_eier"] is None


def test_verlauf_ohne_daten_liefert_leere_reihe(client):
    body = client.get("/api/dashboard/verlauf").json()
    assert body == {"granularitaet": "monat", "punkte": []}


def test_verlauf_von_nach_bis_ist_422(client):
    antwort = client.get("/api/dashboard/verlauf?von=2026-12-01&bis=2026-11-01")
    assert antwort.status_code == 422
