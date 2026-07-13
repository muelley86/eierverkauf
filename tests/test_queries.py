"""Integrationstests gegen tmp-SQLite: ``eier_umsatz`` zählt nur Umsatz aus
Positionen mit Eier-Stückzahl (kg-Positionen ohne ``eier_stueck`` bleiben außen vor).

Alle Daten synthetisch.
"""
from pathlib import Path

import pytest

import data.db as db
from data import queries


@pytest.fixture()
def tmp_db(tmp_path, monkeypatch):
    """Frische DB unter tmp_path; init_db() legt Schema + Seed-Faktoren an."""
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")
    db.init_db()
    conn = db.get_conn()
    yield conn
    conn.close()


def _insert(conn, *, datum, nr, menge, einheit, pack_code, eier_stueck,
            artikel_code, beschreibung, gesamt):
    conn.execute(
        """INSERT INTO verkaufspositionen
             (rechnungsdatum, rechnungsnummer, kundennummer, kundenname,
              menge, einheit, pack_code, eier_stueck, artikel_code, beschreibung, gesamt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (datum, nr, "10001", "Testkunde",
         menge, einheit, pack_code, eier_stueck, artikel_code, beschreibung, gesamt),
    )
    conn.commit()


def _gemischte_positionen(conn) -> None:
    """Ein Kunde mit PACK-Position (100 Eier, 24,80 EUR) und kg-Position
    ohne Eier-Stückzahl (50,00 EUR) im selben Monat/Beleg."""
    _insert(conn, datum="2026-07-01", nr="R-1", menge=10, einheit="PACK",
            pack_code=110, eier_stueck=100, artikel_code="10er Kvp",
            beschreibung="pack", gesamt=24.80)
    _insert(conn, datum="2026-07-01", nr="R-1", menge=25, einheit="kg",
            pack_code=None, eier_stueck=None, artikel_code="Gewicht (kg)",
            beschreibung="kg", gesamt=50.00)


def test_kunden_uebersicht_eier_umsatz_ignoriert_kg_positionen(tmp_db):
    # Arrange
    _gemischte_positionen(tmp_db)

    # Act
    zeilen = queries.kunden_uebersicht(None, None)

    # Assert
    assert len(zeilen) == 1
    kunde = zeilen[0]
    assert kunde["eier"] == 100
    assert kunde["umsatz"] == pytest.approx(74.80)
    assert kunde["eier_umsatz"] == pytest.approx(24.80)


def test_belege_uebersicht_eier_umsatz_bei_gemischtem_beleg(tmp_db):
    # Arrange
    _gemischte_positionen(tmp_db)

    # Act
    belege = queries.belege_uebersicht(None, None)

    # Assert
    assert len(belege) == 1
    beleg = belege[0]
    assert beleg["eier"] == 100
    assert beleg["umsatz"] == pytest.approx(74.80)
    assert beleg["eier_umsatz"] == pytest.approx(24.80)


def test_get_conn_laeuft_im_wal_modus(tmp_db):
    # Assert: WAL + busy_timeout sind Pflicht — im Rollback-Journal-Modus
    # blockiert eine Schreib-Transaktion alle Leser und die App friert ein
    conn = db.get_conn()
    try:
        assert conn.execute("PRAGMA journal_mode").fetchone()[0] == "wal"
        assert conn.execute("PRAGMA busy_timeout").fetchone()[0] == 10000
    finally:
        conn.close()


def test_import_loeschen_entfernt_positionen_und_protokoll(tmp_db):
    # Arrange: Import mit Positionen und Protokollzeile
    tmp_db.execute(
        "INSERT INTO imports (id, import_datum, dateiname) VALUES (1, '2026-07-13', 'test.csv')"
    )
    tmp_db.execute(
        """INSERT INTO verkaufspositionen
             (import_id, rechnungsdatum, rechnungsnummer, kundennummer, kundenname, menge)
           VALUES (1, '2026-07-01', 'R-1', '10001', 'Testkunde', 10)"""
    )
    tmp_db.execute(
        "INSERT INTO import_zeilen_protokoll (import_id, csv_zeile, status, grund) VALUES (1, 5, 'fehler', 'Test')"
    )
    tmp_db.commit()

    # Act
    geloeschte = queries.import_loeschen(1)

    # Assert: Cascade räumt Positionen und Protokoll mit ab
    assert geloeschte == 1
    conn = db.get_conn()
    try:
        assert conn.execute("SELECT COUNT(*) FROM verkaufspositionen").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM import_zeilen_protokoll").fetchone()[0] == 0
    finally:
        conn.close()


def test_import_loeschen_nutzt_index_statt_tablescan(tmp_db):
    # Assert: Cascade-Pfad hat einen Index auf import_id (sonst Full-Table-Scan,
    # der die App bei großen Beständen blockiert)
    plan = tmp_db.execute(
        "EXPLAIN QUERY PLAN DELETE FROM verkaufspositionen WHERE import_id = 1"
    ).fetchall()
    plan_text = " ".join(str(tuple(r)) for r in plan)
    assert "idx_import" in plan_text, f"Query-Plan nutzt keinen Index: {plan_text}"


def test_import_loeschen_loescht_in_batches(tmp_db, monkeypatch):
    # Arrange: mehr Zeilen als eine Batch-Größe, plus zweiter Import als Kontrolle
    monkeypatch.setattr(queries, "LOESCH_BATCH", 2)
    tmp_db.execute(
        "INSERT INTO imports (id, import_datum, dateiname) VALUES (1, '2026-07-13', 'a.csv')"
    )
    tmp_db.execute(
        "INSERT INTO imports (id, import_datum, dateiname) VALUES (2, '2026-07-13', 'b.csv')"
    )
    for i in range(5):
        tmp_db.execute(
            """INSERT INTO verkaufspositionen
                 (import_id, rechnungsdatum, rechnungsnummer, kundennummer, kundenname, menge)
               VALUES (1, '2026-07-01', ?, '10001', 'Testkunde', 1)""",
            (f"R-{i}",),
        )
    tmp_db.execute(
        """INSERT INTO verkaufspositionen
             (import_id, rechnungsdatum, rechnungsnummer, kundennummer, kundenname, menge)
           VALUES (2, '2026-07-02', 'R-99', '10002', 'Anderer Kunde', 1)"""
    )
    for i in range(3):
        tmp_db.execute(
            "INSERT INTO import_zeilen_protokoll (import_id, csv_zeile, status, grund) "
            "VALUES (1, ?, 'fehler', 'Test')",
            (i + 1,),
        )
    tmp_db.commit()

    # Act
    geloeschte = queries.import_loeschen(1)

    # Assert: Batch-Schleife läuft bis zum Ende, fremder Import bleibt unberührt
    assert geloeschte == 1
    conn = db.get_conn()
    try:
        assert conn.execute(
            "SELECT COUNT(*) FROM verkaufspositionen WHERE import_id = 1"
        ).fetchone()[0] == 0
        assert conn.execute(
            "SELECT COUNT(*) FROM import_zeilen_protokoll WHERE import_id = 1"
        ).fetchone()[0] == 0
        assert conn.execute(
            "SELECT COUNT(*) FROM verkaufspositionen WHERE import_id = 2"
        ).fetchone()[0] == 1
        assert conn.execute("SELECT COUNT(*) FROM imports").fetchone()[0] == 1
    finally:
        conn.close()


def test_import_loeschen_stutzt_wal_datei(tmp_db):
    # Arrange
    tmp_db.execute(
        "INSERT INTO imports (id, import_datum, dateiname) VALUES (1, '2026-07-13', 'a.csv')"
    )
    tmp_db.execute(
        """INSERT INTO verkaufspositionen
             (import_id, rechnungsdatum, rechnungsnummer, kundennummer, kundenname, menge)
           VALUES (1, '2026-07-01', 'R-1', '10001', 'Testkunde', 1)"""
    )
    tmp_db.commit()

    # Act
    queries.import_loeschen(1)

    # Assert: Checkpoint TRUNCATE hat das Write-Ahead-Log zurückgestutzt
    wal = Path(str(db.DB_PATH) + "-wal")
    assert not wal.exists() or wal.stat().st_size == 0


def test_jahresvergleich_eier_umsatz_je_vergleichsjahr(tmp_db):
    # Arrange
    _gemischte_positionen(tmp_db)
    _insert(tmp_db, datum="2025-07-05", nr="R-3", menge=6, einheit="PACK",
            pack_code=110, eier_stueck=60, artikel_code="10er Kvp",
            beschreibung="pack-vorjahr", gesamt=15.00)

    # Act
    juli = next(z for z in queries.jahresvergleich(2026) if z["monat"] == 7)

    # Assert
    assert juli["jahr"] == 100
    assert juli["jahr_umsatz"] == pytest.approx(74.80)
    assert juli["jahr_eier_umsatz"] == pytest.approx(24.80)
    assert juli["vorjahr"] == 60
    assert juli["vorjahr_eier_umsatz"] == pytest.approx(15.00)
