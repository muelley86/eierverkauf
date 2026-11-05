"""Diagnose für hängende Anfragen.

uvicorn schreibt eine Zugriffszeile erst, wenn die Antwort fertig ist.
Hängt eine Anfrage, taucht sie im Journal nie auf — so sah ein App-Hänger
nach Import/Löschen im Betrieb aus wie „Nutzer hat nichts gemacht".

``LangsameAnfragenMiddleware`` meldet deshalb jede Anfrage, die nach
``LANGSAM_SCHWELLE_S`` noch läuft, sofort („LÄUFT NOCH") und bei Abschluss
mit Dauer („ENDE"). Schnelle Anfragen bleiben stumm. Die Meldung läuft über
einen Timer im Event-Loop; ist der Loop selbst blockiert, hilft der
Thread-Dump per SIGUSR1 (siehe ``thread_dump_aktivieren``).

``flush=True``: unter systemd ist stdout blockgepuffert.
"""
from __future__ import annotations

import asyncio
import faulthandler
import signal
import sys
import time
from typing import Awaitable, Callable

# Ab dieser Laufzeit gilt eine Anfrage als verdächtig. Normale Auswertungen
# brauchen im Betrieb deutlich unter einer Sekunde.
LANGSAM_SCHWELLE_S = 5.0

Scope = dict
Receive = Callable[[], Awaitable[dict]]
Send = Callable[[dict], Awaitable[None]]
ASGIApp = Callable[[Scope, Receive, Send], Awaitable[None]]


def _anfrage_text(scope: Scope) -> str:
    """'GET /api/verlauf?von=…' — Pfad inkl. Query für die Zuordnung."""
    query = scope.get("query_string", b"").decode("latin-1")
    pfad = scope.get("path", "")
    return f"{scope.get('method', '?')} {pfad}{'?' + query if query else ''}"


class LangsameAnfragenMiddleware:
    """Pure ASGI-Middleware: loggt nur Anfragen über der Schwelle."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        text = _anfrage_text(scope)
        start = time.perf_counter()
        schwelle = LANGSAM_SCHWELLE_S
        timer = asyncio.get_running_loop().call_later(
            schwelle,
            lambda: print(f"[anfrage] LÄUFT NOCH {text} (seit {schwelle:.0f} s)", flush=True),
        )
        try:
            await self.app(scope, receive, send)
        finally:
            timer.cancel()
            dauer = time.perf_counter() - start
            if dauer >= schwelle:
                print(f"[anfrage] ENDE {text} nach {dauer:.1f} s", flush=True)


def thread_dump_aktivieren() -> None:
    """``kill -USR1 <pid>`` schreibt die Stacks aller Threads nach stderr (Journal).

    Ohne Neustart sichtbar, wo hängende Anfragen stecken. Auf Windows gibt es
    kein SIGUSR1 — dort ist das ein No-op.
    """
    if not hasattr(signal, "SIGUSR1"):
        return
    faulthandler.register(signal.SIGUSR1, file=sys.__stderr__, all_threads=True)
