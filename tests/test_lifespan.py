"""Startverhalten der App: nur Laufzeit-Ordner anlegen.

``backups/`` gehört seit v1.15.0 root (Modus 0700) und liegt in der
gehärteten systemd-Unit außerhalb der beschreibbaren Pfade — die App darf
ihn deshalb beim Start nicht anfassen.
"""
from fastapi.testclient import TestClient

import data.db as db
import main


def test_start_legt_uploads_an_aber_nicht_backups(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")
    monkeypatch.chdir(tmp_path)

    with TestClient(main.app):
        pass

    assert (tmp_path / "uploads").is_dir()
    assert not (tmp_path / "backups").exists()
