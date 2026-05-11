"""API-Endpunkte für Auswertungen: Dashboard, Kunden, Artikel, Ranking, Jahresvergleich."""
from __future__ import annotations

from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Query

from data import queries

router = APIRouter(tags=["auswertung"])


def _iso(d: Optional[date]) -> Optional[str]:
    return d.isoformat() if d else None


@router.get("/dashboard")
def dashboard(
    von: Optional[date] = Query(None),
    bis: Optional[date] = Query(None),
) -> dict:
    return {
        "kpis": queries.dashboard_kpis(_iso(von), _iso(bis)),
        "top5_kunden": queries.top5_kunden(_iso(von), _iso(bis)),
        "top5_artikel": queries.top5_artikel(_iso(von), _iso(bis)),
    }


@router.get("/kunden")
def kunden(
    von: Optional[date] = Query(None),
    bis: Optional[date] = Query(None),
) -> list[dict]:
    return queries.kunden_uebersicht(_iso(von), _iso(bis))


@router.get("/kunden/{nr}")
def kunde_detail(nr: str) -> dict:
    daten = queries.stammdaten_kunde(nr)
    if not daten:
        raise HTTPException(status_code=404, detail="Kunde nicht gefunden.")
    return daten


@router.get("/kunden/{nr}/monate")
def kunde_monate(
    nr: str,
    von: Optional[date] = Query(None),
    bis: Optional[date] = Query(None),
) -> list[dict]:
    return queries.kunde_monate(nr, _iso(von), _iso(bis))


@router.get("/kunden/{nr}/jahresvergleich")
def kunde_jahresvergleich(nr: str, jahr: int = Query(...)) -> list[dict]:
    return queries.kunde_jahresvergleich(nr, jahr)


@router.get("/artikel")
def artikel(
    von: Optional[date] = Query(None),
    bis: Optional[date] = Query(None),
) -> list[dict]:
    return queries.artikel_uebersicht(_iso(von), _iso(bis))


@router.get("/artikel/{code}/monate")
def artikel_monate(
    code: str,
    von: Optional[date] = Query(None),
    bis: Optional[date] = Query(None),
) -> list[dict]:
    return queries.artikel_monate(code, _iso(von), _iso(bis))


@router.get("/ranking")
def ranking(
    von: Optional[date] = Query(None),
    bis: Optional[date] = Query(None),
    sort: Literal["menge", "umsatz"] = "menge",
) -> list[dict]:
    return queries.ranking(_iso(von), _iso(bis), sort)


@router.get("/jahresvergleich")
def jahresvergleich(jahr: int = Query(...)) -> list[dict]:
    return queries.jahresvergleich(jahr)
