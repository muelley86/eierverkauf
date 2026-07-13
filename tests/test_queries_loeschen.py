"""Tests für die häppchenweise Import-Löschung: adaptives Pacing zwischen
den Batches (50 %-Duty-Cycle, gedeckelt auf LOESCH_PAUSE_MAX), keine Pause
nach dem letzten Batch.

Alle Daten synthetisch.
"""
import time

import pytest

import data.db as db
from data import queries


@pytest.fixture()
def tmp_db(tmp_path, monkeypatch):
    """Frische DB unter tmp_path; init_db() legt Schema + Seed-Faktoren an."""
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")
    db.init_db()


def _lege_import_mit_positionen_an(anzahl: int) -> None:
    conn = db.get_conn()
    try:
        conn.execute(
            "INSERT INTO imports (id, import_datum, dateiname) VALUES (1, '2026-07-13', 'test.csv')"
        )
        conn.executemany(
            """INSERT INTO verkaufspositionen
                 (import_id, rechnungsdatum, rechnungsnummer, kundennummer, kundenname, menge)
               VALUES (1, '2026-07-01', ?, '10001', 'Testkunde', 10)""",
            ((f"R-{i}",) for i in range(anzahl)),
        )
        conn.commit()
    finally:
        conn.close()


def test_loesch_pause_entspricht_batch_dauer():
    assert queries._loesch_pause(0.5) == pytest.approx(0.5)


def test_loesch_pause_ist_auf_maximum_gedeckelt():
    assert queries._loesch_pause(10.0) == pytest.approx(queries.LOESCH_PAUSE_MAX)


def test_loesch_pause_wird_nie_negativ():
    assert queries._loesch_pause(-1.0) == 0.0


def test_import_loeschen_pausiert_adaptiv_nur_zwischen_vollen_batches(tmp_db, monkeypatch):
    # Arrange: 5 Positionen bei Batch-Größe 2 → Batches 2+2+1, Pause nur nach vollen.
    _lege_import_mit_positionen_an(5)
    monkeypatch.setattr(queries, "LOESCH_BATCH", 2)
    gemessene_dauern: list[float] = []

    def fake_pause(batch_dauer: float) -> float:
        gemessene_dauern.append(batch_dauer)
        return 0.0

    monkeypatch.setattr(queries, "_loesch_pause", fake_pause)
    pausen: list[float] = []
    monkeypatch.setattr(time, "sleep", pausen.append)

    # Act
    geloeschte = queries.import_loeschen(1)

    # Assert: 1 Import weg, Pause-Berechnung je vollem Batch mit echter Dauer
    assert geloeschte == 1
    assert len(gemessene_dauern) == 2
    assert all(dauer >= 0.0 for dauer in gemessene_dauern)
    assert pausen == [0.0, 0.0]
    conn = db.get_conn()
    try:
        assert conn.execute("SELECT COUNT(*) FROM verkaufspositionen").fetchone()[0] == 0
    finally:
        conn.close()
