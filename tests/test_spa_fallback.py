"""Integrationstests für das SPA-Fallback: Seiten-Reload auf Client-Routen
(/import, /kunden/…) muss index.html liefern statt 404 — API- und
Asset-Pfade behalten ihr echtes 404.

Benötigt frontend/dist (lokaler Build); ohne Build werden die Tests geskippt.
"""
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import data.db as db
import main

_DIST = Path(main.__file__).resolve().parent / "frontend" / "dist"

pytestmark = pytest.mark.skipif(
    not _DIST.exists(), reason="frontend/dist fehlt (npm run build)")


@pytest.fixture()
def client(tmp_path, monkeypatch):
    """Frische DB unter tmp_path; TestClient triggert den Lifespan (init_db)."""
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")
    with TestClient(main.app) as c:
        yield c


def test_seiten_reload_auf_client_route_liefert_index_html(client):
    # Act
    antwort = client.get("/import")

    # Assert
    assert antwort.status_code == 200
    assert "text/html" in antwort.headers["content-type"]
    assert 'id="root"' in antwort.text


def test_kunden_route_mit_punkten_liefert_index_html(client):
    # Kundennummern enthalten Punkte (15.100.008) — eine Datei-Endungs-
    # Heuristik würde diese Route fälschlich als Asset behandeln.
    antwort = client.get("/kunden/15.100.008")

    assert antwort.status_code == 200
    assert 'id="root"' in antwort.text


def test_unbekannter_api_pfad_bleibt_404(client):
    antwort = client.get("/api/gibtsnicht")

    assert antwort.status_code == 404


def test_fehlendes_asset_bleibt_404(client):
    antwort = client.get("/assets/gibtsnicht.js")

    assert antwort.status_code == 404
