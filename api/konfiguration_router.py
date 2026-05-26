"""API-Endpunkte für die Konfiguration: Eier-pro-Artikel-Faktoren.

Liest und schreibt die `artikel_eier_konfiguration`-Tabelle und löst beim
Schreiben eine rückwirkende Neuberechnung der `verkaufspositionen.eier_stueck`
aus, damit Auswertungen sofort die neuen Werte zeigen.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from data.db import get_conn
from data.konfiguration import lade_eier_konfig, speichere_eier_konfig

router = APIRouter(tags=["konfiguration"])


class ArtikelEierKonfig(BaseModel):
    artikel_code: str
    faktor: int | None


class SpeichernAntwort(BaseModel):
    aktualisiert: int
    neu_berechnete_belege: int


@router.get("/konfiguration/artikel-eier")
def get_artikel_eier_konfig() -> list[ArtikelEierKonfig]:
    """Liefert die aktuelle Faktoren-Konfiguration je Artikel-Code."""
    conn = get_conn()
    try:
        konfig = lade_eier_konfig(conn)
    finally:
        conn.close()
    return [
        ArtikelEierKonfig(artikel_code=code, faktor=faktor)
        for code, faktor in sorted(konfig.items())
    ]


@router.put("/konfiguration/artikel-eier")
def put_artikel_eier_konfig(eintraege: list[ArtikelEierKonfig]) -> SpeichernAntwort:
    """Schreibt die übergebenen Faktoren und berechnet `eier_stueck` neu."""
    if not eintraege:
        raise HTTPException(
            status_code=400, detail="Keine Konfigurations-Einträge übermittelt."
        )
    neu = {e.artikel_code: e.faktor for e in eintraege}
    conn = get_conn()
    try:
        neu_berechnet = speichere_eier_konfig(conn, neu)
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Konfiguration konnte nicht gespeichert werden: {exc}"
        ) from exc
    finally:
        conn.close()
    return SpeichernAntwort(aktualisiert=len(neu), neu_berechnete_belege=neu_berechnet)
