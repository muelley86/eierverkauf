"""Integrationstests für die Import-API: Die Löschung antwortet sofort und
räumt via BackgroundTasks im Hintergrund vollständig auf.

Alle Daten synthetisch.
"""
import re
import threading
import time

import pytest
from fastapi.testclient import TestClient

import api.import_router as import_router
import data.db as db
from data import queries
import main


@pytest.fixture()
def client(tmp_path, monkeypatch):
    """Frische DB unter tmp_path; TestClient triggert den Lifespan (init_db)."""
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")
    db.init_db()
    with TestClient(main.app) as c:
        yield c


def _lege_import_an(import_id: int = 1) -> None:
    conn = db.get_conn()
    try:
        conn.execute(
            "INSERT INTO imports (id, import_datum, dateiname) VALUES (?, '2026-07-13', 'test.csv')",
            (import_id,),
        )
        conn.execute(
            """INSERT INTO verkaufspositionen
                 (import_id, rechnungsdatum, rechnungsnummer, kundennummer, kundenname, menge)
               VALUES (?, '2026-07-01', 'R-1', '10001', 'Testkunde', 10)""",
            (import_id,),
        )
        conn.execute(
            "INSERT INTO import_zeilen_protokoll (import_id, csv_zeile, status, grund) "
            "VALUES (?, 5, 'fehler', 'Test')",
            (import_id,),
        )
        conn.commit()
    finally:
        conn.close()


def test_delete_unbekannter_import_liefert_404(client):
    # Act
    antwort = client.delete("/api/imports/999")

    # Assert
    assert antwort.status_code == 404


def test_delete_antwortet_sofort_und_loescht_im_hintergrund(client):
    # Arrange
    _lege_import_an()

    # Act
    antwort = client.delete("/api/imports/1")

    # Assert: sofortige Antwort, BackgroundTask hat danach alles weggeräumt
    assert antwort.status_code == 200
    assert antwort.json() == {"geloescht_geplant": True}
    assert import_router._loeschungen_laufen == set()
    conn = db.get_conn()
    try:
        assert conn.execute("SELECT COUNT(*) FROM imports").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM verkaufspositionen").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM import_zeilen_protokoll").fetchone()[0] == 0
    finally:
        conn.close()


def test_delete_waehrend_laufender_loeschung_liefert_409(client):
    # Arrange: laufende Löschung simulieren
    _lege_import_an()
    import_router._loeschungen_laufen.add(1)
    try:
        # Act
        antwort = client.delete("/api/imports/1")

        # Assert
        assert antwort.status_code == 409
    finally:
        import_router._loeschungen_laufen.discard(1)


def test_hintergrund_loeschungen_laufen_seriell(monkeypatch):
    # Arrange: zwei parallel gestartete Löschungen dürfen sich nicht überlappen
    # (SQLite-Schreiber konkurrieren sonst und brechen mit "database is locked" ab).
    aktiv = 0
    max_aktiv = 0
    zaehler_lock = threading.Lock()

    def fake_loeschen(_import_id: int) -> int:
        nonlocal aktiv, max_aktiv
        with zaehler_lock:
            aktiv += 1
            max_aktiv = max(max_aktiv, aktiv)
        time.sleep(0.05)
        with zaehler_lock:
            aktiv -= 1
        return 1

    monkeypatch.setattr(queries, "import_loeschen", fake_loeschen)
    threads = [
        threading.Thread(target=import_router._loesche_im_hintergrund, args=(nr,))
        for nr in (1, 2)
    ]

    # Act
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    # Assert
    assert max_aktiv == 1


def test_hintergrund_loeschung_loggt_dauer(monkeypatch, capsys):
    # Arrange
    monkeypatch.setattr(queries, "import_loeschen", lambda _id: 1)

    # Act
    import_router._loesche_im_hintergrund(7)

    # Assert: Dauer in Sekunden in der Abschluss-Logzeile (journalctl-Diagnose)
    ausgabe = capsys.readouterr().out
    assert re.search(r"Import 7 abgeschlossen \(1 Eintrag, \d+\.\d s\)", ausgabe)


def test_hintergrund_loeschung_loggt_fehler_mit_dauer(monkeypatch, capsys):
    # Arrange
    def kaputt(_id: int) -> int:
        raise RuntimeError("kaputt")

    monkeypatch.setattr(queries, "import_loeschen", kaputt)
    import_router._loeschungen_laufen.add(7)

    # Act
    import_router._loesche_im_hintergrund(7)

    # Assert: Fehler-Logzeile mit Dauer, Lauf-Status geräumt
    ausgabe = capsys.readouterr().out
    assert re.search(r"Import 7 nach \d+\.\d s fehlgeschlagen", ausgabe)
    assert 7 not in import_router._loeschungen_laufen


def test_historie_enthaelt_wird_geloescht_feld(client):
    # Arrange
    _lege_import_an()

    # Act
    zeilen = client.get("/api/imports").json()

    # Assert
    assert len(zeilen) == 1
    assert zeilen[0]["wird_geloescht"] is False
