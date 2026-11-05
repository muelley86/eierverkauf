"""``GET /api/health`` liefert die laufende App-Version (Anzeige in der Sidebar)."""
from pathlib import Path

from fastapi.testclient import TestClient

import main


def test_health_liefert_version_aus_version_datei():
    erwartet = Path(main.__file__).with_name("VERSION").read_text().strip()

    antwort = TestClient(main.app).get("/api/health")

    assert antwort.status_code == 200
    assert antwort.json() == {"status": "ok", "version": erwartet}
