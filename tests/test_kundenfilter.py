"""Tests für den Kundenfilter (Mehrfachauswahl) auf Belegen, Kunden, Artikeln,
Zeitraum- und Jahresvergleich sowie deren Export. Alle Daten synthetisch.
"""
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from openpyxl import load_workbook

import data.db as db
import main


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")
    db.init_db()
    with TestClient(main.app) as c:
        yield c


def _position(datum: str, kunde_nr: str, name: str, eier: int, gesamt: float,
              nr: str, artikel: str = "Lose 20") -> None:
    conn = db.get_conn()
    try:
        conn.execute(
            """INSERT INTO verkaufspositionen
                 (rechnungsdatum, rechnungsnummer, kundennummer, kundenname,
                  menge, einheit, pack_code, eier_stueck, artikel_code, beschreibung, gesamt)
               VALUES (?, ?, ?, ?, ?, 'stk', NULL, ?, ?, 'x', ?)""",
            (datum, nr, kunde_nr, name, eier, eier, artikel, gesamt),
        )
        conn.commit()
    finally:
        conn.close()


@pytest.fixture()
def drei_kunden(client):
    _position("2026-03-02", "10001", "Anna", 100, 30.0, "R-1", "Lose 20")
    _position("2026-03-03", "10002", "Bert", 200, 50.0, "R-2", "Lose 180")
    _position("2026-03-04", "15.100.008", "Carla", 400, 90.0, "R-3", "Lose 20")
    _position("2025-03-02", "10001", "Anna", 10, 3.0, "R-0", "Lose 20")
    _position("2025-03-03", "10002", "Bert", 20, 5.0, "R-00", "Lose 180")
    return client


ZR = "von=2026-01-01&bis=2026-12-31"


def test_kundenauswahl_liefert_alle_kunden_nach_name(drei_kunden):
    antwort = drei_kunden.get("/api/kundenauswahl")
    assert antwort.status_code == 200
    assert antwort.json() == [
        {"kundennummer": "10001", "kundenname": "Anna"},
        {"kundennummer": "10002", "kundenname": "Bert"},
        {"kundennummer": "15.100.008", "kundenname": "Carla"},
    ]


def test_belege_ohne_kundenfilter_liefert_alle(drei_kunden):
    assert len(drei_kunden.get(f"/api/belege?{ZR}").json()) == 3


def test_belege_mit_mehreren_kunden(drei_kunden):
    body = drei_kunden.get(f"/api/belege?{ZR}&kunden=10001&kunden=15.100.008").json()
    assert sorted(b["kundennummer"] for b in body) == ["10001", "15.100.008"]


def test_kunden_mit_einem_kunden(drei_kunden):
    body = drei_kunden.get(f"/api/kunden?{ZR}&kunden=10002").json()
    assert [k["kundenname"] for k in body] == ["Bert"]


def test_artikel_summiert_nur_gewaehlte_kunden(drei_kunden):
    body = drei_kunden.get(f"/api/artikel?{ZR}&kunden=10001&kunden=10002").json()
    assert {a["artikel_code"]: a["eier"] for a in body} == {"Lose 20": 100, "Lose 180": 200}


def test_jahresvergleich_mit_kundenfilter(drei_kunden):
    body = drei_kunden.get("/api/jahresvergleich?jahr=2026&kunden=10001").json()
    maerz = body[2]
    assert (maerz["jahr"], maerz["vorjahr"]) == (100, 10)


def test_verlauf_mit_kundenfilter_auch_im_vorjahr(drei_kunden):
    body = drei_kunden.get(
        "/api/verlauf?von=2026-03-01&bis=2026-03-31&granularitaet=monat&kunden=10002"
    ).json()
    assert body["punkte"][0]["eier"] == 200
    assert body["punkte"][0]["vorjahr_eier"] == 20


def test_unbekannter_kunde_liefert_leere_liste(drei_kunden):
    assert drei_kunden.get(f"/api/belege?{ZR}&kunden=99999").json() == []


def test_zu_viele_kunden_ist_422(drei_kunden):
    viele = "&".join(f"kunden={i}" for i in range(501))
    assert drei_kunden.get(f"/api/belege?{ZR}&{viele}").status_code == 422


def test_leere_kundennummer_ist_422(drei_kunden):
    assert drei_kunden.get(f"/api/belege?{ZR}&kunden=").status_code == 422


def test_export_belege_mit_kundenfilter_nennt_kunden_im_titel(drei_kunden):
    antwort = drei_kunden.get(f"/api/export/excel?typ=belege&{ZR}&kunden=10002")
    assert antwort.status_code == 200
    ws = load_workbook(BytesIO(antwort.content)).active
    assert "Bert" in ws.cell(row=1, column=1).value
    zeilen = [z for z in ws.iter_rows(min_row=4, values_only=True) if z[0]]
    assert len(zeilen) == 1


def test_export_zeitraumvergleich_mit_kundenfilter(drei_kunden):
    antwort = drei_kunden.get(
        "/api/export/excel?typ=zeitraumvergleich&von=2026-03-01&bis=2026-03-31&kunden=10001"
    )
    ws = load_workbook(BytesIO(antwort.content)).active
    zeilen = list(ws.iter_rows(min_row=4, values_only=True))
    assert zeilen[0][:4] == ("Mär 2026", 10, 100, 90)


def test_pdf_html_nennt_kundenfilter_maskiert():
    from export.pdf_export import baue_pdf_html
    html = baue_pdf_html("belege", "2026-01-01", "2026-12-31", [],
                         filter_hinweis="Kunden: <b>Anna</b>")
    assert "Kunden: &lt;b&gt;Anna&lt;/b&gt;" in html
