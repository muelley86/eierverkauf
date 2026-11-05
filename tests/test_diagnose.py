"""Tests für die Hänger-Diagnose (api/diagnose.py, Thread-Dump im Lifespan).

Hintergrund: Im Betrieb blieben nach Import/Löschen alle Seiten endlos
hängen, das Journal zeigte aber nichts — uvicorn loggt Zugriffe erst bei
der Antwort. Die Middleware macht hängende Anfragen sichtbar, das
SIGUSR1-Signal liefert die Stacks aller Threads.
"""
import faulthandler
import signal
import time

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import api.diagnose as diagnose
import data.db as db
import main


@pytest.fixture()
def testapp(monkeypatch):
    monkeypatch.setattr(diagnose, "LANGSAM_SCHWELLE_S", 0.05)
    app = FastAPI()

    @app.get("/schnell")
    def schnell() -> dict:
        return {"ok": True}

    @app.get("/langsam")
    def langsam() -> dict:
        time.sleep(0.3)
        return {"ok": True}

    @app.get("/kaputt")
    def kaputt() -> dict:
        time.sleep(0.2)
        raise RuntimeError("absichtlich")

    app.add_middleware(diagnose.LangsameAnfragenMiddleware)
    return app


def test_schnelle_anfrage_wird_nicht_geloggt(testapp, capsys):
    with TestClient(testapp) as client:
        assert client.get("/schnell").status_code == 200

    assert "[anfrage]" not in capsys.readouterr().out


def test_langsame_anfrage_wird_waehrend_und_nach_der_laufzeit_geloggt(testapp, capsys):
    with TestClient(testapp) as client:
        assert client.get("/langsam?von=2025-01-01").status_code == 200

    ausgabe = capsys.readouterr().out
    assert "[anfrage] LÄUFT NOCH GET /langsam?von=2025-01-01" in ausgabe
    assert "[anfrage] ENDE GET /langsam?von=2025-01-01" in ausgabe
    assert ausgabe.index("LÄUFT NOCH") < ausgabe.index("ENDE")


def test_langsame_anfrage_mit_fehler_wird_trotzdem_abgeschlossen_geloggt(testapp, capsys):
    with TestClient(testapp, raise_server_exceptions=False) as client:
        assert client.get("/kaputt").status_code == 500

    assert "[anfrage] ENDE GET /kaputt" in capsys.readouterr().out


@pytest.mark.skipif(not hasattr(signal, "SIGUSR1"), reason="kein SIGUSR1 (Windows)")
def test_start_registriert_thread_dump_auf_sigusr1(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")
    monkeypatch.chdir(tmp_path)
    faulthandler.unregister(signal.SIGUSR1)

    with TestClient(main.app):
        registriert = faulthandler.unregister(signal.SIGUSR1)

    assert registriert is True
