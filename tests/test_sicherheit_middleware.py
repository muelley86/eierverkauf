"""Tests für die Request-Schutzschicht (api/sicherheit.py).

Die App hat bewusst keinen Login (reiner LAN-Betrieb). Damit fremde Webseiten
den Browser eines Mitarbeiters nicht als Brücke ins LAN missbrauchen können,
prüft eine Middleware

* den Host-Header gegen eine Erlaubt-Liste (Schutz vor DNS-Rebinding) und
* bei schreibenden Requests die Herkunft (Origin / Sec-Fetch-Site, CSRF).
"""
import pytest
from fastapi.testclient import TestClient

import data.db as db
import main

CSV_MINIMAL = (
    b"Datum;Nummer;#;Kunde;Mitarbeiter;Menge;Einheit;#;Beschreibung;Preis;Gesamt\n"
    b"01.03.25;R-1;10001;Testkunde A;Muster;1;stk;;Eier;0,30;0,30\n"
)


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "test.db")
    monkeypatch.delenv("EIERVERKAUF_ALLOWED_HOSTS", raising=False)
    with TestClient(main.app, base_url="http://eier.example") as c:
        yield c


def _upload(client, **headers):
    return client.post(
        "/api/import",
        files={"file": ("test.csv", CSV_MINIMAL, "text/csv")},
        headers=headers,
    )


# --- Host-Prüfung (DNS-Rebinding) ------------------------------------------

def test_erlaubter_hostname_wird_bedient(client, monkeypatch):
    monkeypatch.setenv("EIERVERKAUF_ALLOWED_HOSTS", "eier.example")

    antwort = client.get("/api/health")

    assert antwort.status_code == 200


def test_fremder_hostname_wird_abgewiesen(client, monkeypatch):
    monkeypatch.setenv("EIERVERKAUF_ALLOWED_HOSTS", "eier.example")

    antwort = client.get("/api/kunden", headers={"Host": "attacker.example:8050"})

    assert antwort.status_code == 400
    assert antwort.json() == {"detail": "Ungültiger Host-Header."}


def test_hostname_vergleich_ignoriert_port_und_grossschreibung(client, monkeypatch):
    monkeypatch.setenv("EIERVERKAUF_ALLOWED_HOSTS", " Eier.Example ,andere.lan")

    antwort = client.get("/api/health", headers={"Host": "EIER.example:80"})

    assert antwort.status_code == 200


@pytest.mark.parametrize("host", ["192.168.1.20:8050", "127.0.0.1", "localhost:8050", "[::1]:8050"])
def test_ip_adressen_und_localhost_sind_immer_erlaubt(client, monkeypatch, host):
    # DNS-Rebinding braucht einen vom Angreifer kontrollierten DNS-Namen;
    # direkter Zugriff per IP bleibt deshalb ohne Konfiguration möglich.
    monkeypatch.setenv("EIERVERKAUF_ALLOWED_HOSTS", "eier.example")

    antwort = client.get("/api/health", headers={"Host": host})

    assert antwort.status_code == 200


def test_ohne_konfiguration_wird_kein_host_abgewiesen(client):
    # Übergangsmodus: Ein Auto-Update darf den Zugriff über den Hostnamen
    # nicht aussperren, solange /etc/default/eierverkauf noch fehlt.
    antwort = client.get("/api/health", headers={"Host": "irgendwas.example"})

    assert antwort.status_code == 200


# --- Herkunftsprüfung (CSRF) -----------------------------------------------

def test_upload_aus_der_app_selbst_ist_erlaubt(client):
    antwort = _upload(client, Origin="http://eier.example", **{"Sec-Fetch-Site": "same-origin"})

    assert antwort.status_code == 200


def test_upload_hinter_tls_proxy_ist_erlaubt(client):
    # Nginx/Caddy terminiert HTTPS, die App selbst sieht http — der
    # Browser-Origin trägt https und Port 443.
    antwort = _upload(client, Origin="https://eier.example", **{"Sec-Fetch-Site": "same-origin"})

    assert antwort.status_code == 200


def test_upload_von_fremder_webseite_wird_abgewiesen(client):
    antwort = _upload(client, Origin="https://evil.example", **{"Sec-Fetch-Site": "cross-site"})

    assert antwort.status_code == 403
    assert antwort.json() == {"detail": "Anfrage von fremder Herkunft abgelehnt."}


def test_upload_mit_fremdem_origin_ohne_fetch_metadata_wird_abgewiesen(client):
    antwort = _upload(client, Origin="https://evil.example")

    assert antwort.status_code == 403


def test_upload_mit_null_origin_wird_abgewiesen(client):
    antwort = _upload(client, Origin="null")

    assert antwort.status_code == 403


def test_cross_site_ohne_origin_wird_abgewiesen(client):
    antwort = _upload(client, **{"Sec-Fetch-Site": "cross-site"})

    assert antwort.status_code == 403


def test_loeschen_von_fremder_webseite_wird_abgewiesen(client):
    antwort = client.delete("/api/imports/1", headers={"Origin": "https://evil.example"})

    assert antwort.status_code == 403


def test_skript_ohne_browser_header_darf_hochladen(client):
    # curl/Skripte senden weder Origin noch Sec-Fetch-Site.
    antwort = _upload(client)

    assert antwort.status_code == 200


def test_vite_dev_server_origin_ist_erlaubt(client):
    # Vite proxyt mit changeOrigin → Host ist das Backend, Origin der Dev-Server.
    antwort = _upload(
        client,
        Host="localhost:8050",
        Origin="http://localhost:5173",
        **{"Sec-Fetch-Site": "same-origin"},
    )

    assert antwort.status_code == 200


def test_lesende_requests_werden_nicht_auf_herkunft_geprueft(client):
    antwort = client.get("/api/health", headers={"Origin": "https://evil.example"})

    assert antwort.status_code == 200
