"""Gemeinsamer Query-Parameter ``kunden`` (Kundenfilter, seit v1.16.0).

Mehrfachauswahl als wiederholter Parameter: ``?kunden=10001&kunden=10002``.
Leer = alle Kunden. Kundennummern bleiben unverändert (``15.100.008`` ≠
``15100008``). Die Obergrenze hält die SQL-Platzhalterzahl klein.
"""
from __future__ import annotations

from fastapi import HTTPException, Query

from data import queries

MAX_KUNDEN = 500
MAX_LAENGE_KUNDENNUMMER = 64
MAX_NAMEN_IM_TITEL = 3


def kunden_param(
    kunden: list[str] = Query(
        default=[],
        description="Kundennummern für den Kundenfilter (mehrfach angebbar, leer = alle).",
    ),
) -> list[str]:
    """FastAPI-Dependency: prüft und entdoppelt die gewählten Kundennummern."""
    if len(kunden) > MAX_KUNDEN:
        raise HTTPException(status_code=422, detail=f"Höchstens {MAX_KUNDEN} Kunden wählbar.")
    for nummer in kunden:
        if not nummer.strip() or len(nummer) > MAX_LAENGE_KUNDENNUMMER:
            raise HTTPException(status_code=422, detail="Ungültige Kundennummer im Kundenfilter.")
    return list(dict.fromkeys(kunden))


def kunden_hinweis(kunden: list[str]) -> str | None:
    """Kurztext für Export-Titel, z. B. 'Kunden: Anna, Bert und 2 weitere'."""
    if not kunden:
        return None
    namen_je_nummer = {k["kundennummer"]: k["kundenname"] for k in queries.kundenauswahl()}
    namen = [namen_je_nummer.get(nr, nr) for nr in kunden]
    sichtbar = ", ".join(namen[:MAX_NAMEN_IM_TITEL])
    rest = len(namen) - MAX_NAMEN_IM_TITEL
    praefix = "Kunde" if len(namen) == 1 else "Kunden"
    return f"{praefix}: {sichtbar}" + (f" und {rest} weitere" if rest > 0 else "")
