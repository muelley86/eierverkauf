"""Request-Schutzschicht für den LAN-Betrieb ohne Login.

Die App vertraut jedem Client im LAN. Damit eine fremde Webseite den Browser
eines Mitarbeiters nicht als Brücke ins LAN missbrauchen kann, prüft
``SicherheitsMiddleware`` jeden Request:

* **Host-Header** (Schutz vor DNS-Rebinding): erlaubt sind IP-Adressen,
  ``localhost`` und die Namen aus ``EIERVERKAUF_ALLOWED_HOSTS``
  (kommagetrennt, z. B. ``eier.example``). Ist die Variable leer, läuft die
  Prüfung im Übergangsmodus: nichts wird abgewiesen, einmalig wird gewarnt —
  ein Auto-Update darf den Zugriff über den Hostnamen nicht aussperren.
* **Herkunft schreibender Requests** (CSRF): POST/PUT/PATCH/DELETE werden
  abgewiesen, wenn der Browser sie als seitenfremd kennzeichnet
  (``Sec-Fetch-Site``) oder ``Origin`` nicht zum angefragten Host passt.
  Clients ohne diese Header (curl, Skripte) sind nicht betroffen.
"""
from __future__ import annotations

import ipaddress
import json
import os
from typing import Awaitable, Callable, Optional
from urllib.parse import urlsplit

ALLOWED_HOSTS_ENV = "EIERVERKAUF_ALLOWED_HOSTS"

# Origins des Vite-Dev-Servers: Vite proxyt /api mit changeOrigin, dadurch
# passt der Host-Header nicht zum Origin. Gleiche Liste wie für CORS.
DEV_ORIGINS: tuple[str, ...] = ("http://localhost:5173", "http://127.0.0.1:5173")

_SCHREIBENDE_METHODEN = frozenset({"POST", "PUT", "PATCH", "DELETE"})
_ERLAUBTE_FETCH_SITES = frozenset({"same-origin", "none"})
_ORIGIN_SCHEMATA = frozenset({"http", "https"})

MELDUNG_HOST = "Ungültiger Host-Header."
MELDUNG_HERKUNFT = "Anfrage von fremder Herkunft abgelehnt."

Scope = dict
Receive = Callable[[], Awaitable[dict]]
Send = Callable[[dict], Awaitable[None]]
ASGIApp = Callable[[Scope, Receive, Send], Awaitable[None]]


def erlaubte_hosts() -> frozenset[str]:
    """Konfigurierte Hostnamen (lowercase, ohne Leerraum)."""
    roh = os.environ.get(ALLOWED_HOSTS_ENV, "")
    return frozenset(teil.strip().lower() for teil in roh.split(",") if teil.strip())


def _host_ohne_port(host: str) -> str:
    """'eier.example:80' → 'eier.example', '[::1]:8050' → '::1'."""
    host = host.strip().lower()
    if host.startswith("["):
        return host[1:].split("]", 1)[0]
    return host.rsplit(":", 1)[0] if host.count(":") == 1 else host


def _ist_ip(host: str) -> bool:
    try:
        ipaddress.ip_address(host)
    except ValueError:
        return False
    return True


def host_ist_erlaubt(host_header: str, erlaubt: frozenset[str]) -> bool:
    """Prüft einen Host-Header gegen IP/localhost/Erlaubt-Liste."""
    host = _host_ohne_port(host_header)
    if not host:
        return False
    return _ist_ip(host) or host == "localhost" or host in erlaubt


def herkunft_ist_erlaubt(origin: Optional[str], fetch_site: Optional[str], host_header: str) -> bool:
    """Entscheidet, ob ein schreibender Request aus der App selbst stammt.

    Verglichen wird nur der Hostname: Hinter einem TLS-Proxy trägt der
    Browser-Origin ``https``/443, die App selbst sieht ``http``. Gegen
    DNS-Rebinding (Origin == Host) schützt die Host-Erlaubt-Liste.
    """
    if fetch_site is not None and fetch_site.lower() not in _ERLAUBTE_FETCH_SITES:
        return False
    if origin is None:
        return True
    if origin in DEV_ORIGINS:
        return True
    teile = urlsplit(origin)
    if teile.scheme not in _ORIGIN_SCHEMATA or not teile.hostname:
        return False  # u. a. Origin "null" (Sandbox-iframe, file://)
    return teile.hostname.lower() == _host_ohne_port(host_header)


class SicherheitsMiddleware:
    """ASGI-Middleware für Host- und Herkunftsprüfung (siehe Moduldoku)."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app
        self._warnung_ausgegeben = False

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope["headers"]}
        host = headers.get("host", "")

        fehler = self._pruefe(scope, headers, host)
        if fehler is not None:
            status, meldung = fehler
            await _sende_fehler(send, status, meldung)
            return
        await self.app(scope, receive, send)

    def _pruefe(self, scope: Scope, headers: dict[str, str], host: str) -> Optional[tuple[int, str]]:
        erlaubt = erlaubte_hosts()
        if not erlaubt:
            self._warne_einmalig()
        elif not host_ist_erlaubt(host, erlaubt):
            return 400, MELDUNG_HOST

        if scope["method"] in _SCHREIBENDE_METHODEN and not herkunft_ist_erlaubt(
            headers.get("origin"), headers.get("sec-fetch-site"), host
        ):
            return 403, MELDUNG_HERKUNFT
        return None

    def _warne_einmalig(self) -> None:
        if self._warnung_ausgegeben:
            return
        self._warnung_ausgegeben = True
        print(
            f"[sicherheit] WARNUNG: {ALLOWED_HOSTS_ENV} ist nicht gesetzt — "
            "Host-Prüfung gegen DNS-Rebinding ist inaktiv. "
            "Hostnamen in /etc/default/eierverkauf eintragen (siehe DEPLOYMENT.md).",
            flush=True,
        )


async def _sende_fehler(send: Send, status: int, meldung: str) -> None:
    body = json.dumps({"detail": meldung}, ensure_ascii=False).encode("utf-8")
    await send({
        "type": "http.response.start",
        "status": status,
        "headers": [
            (b"content-type", b"application/json; charset=utf-8"),
            (b"content-length", str(len(body)).encode("ascii")),
        ],
    })
    await send({"type": "http.response.body", "body": body})
