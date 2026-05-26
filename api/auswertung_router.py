"""API-Endpunkte für Auswertungen: Dashboard, Kunden, Artikel, Ranking, Jahresvergleich."""
from __future__ import annotations

from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Query

from data import queries

router = APIRouter(tags=["auswertung"])


def _iso(d: Optional[date]) -> Optional[str]:
    return d.isoformat() if d else None


def _ein_jahr_zurueck(d: Optional[date]) -> Optional[date]:
    """Schiebt ein Datum um genau ein Jahr zurück. 29.02. → 28.02."""
    if d is None:
        return None
    try:
        return d.replace(year=d.year - 1)
    except ValueError:
        # Schaltjahr-29.02. — auf 28.02. im Vorjahr zurückfallen.
        return d.replace(year=d.year - 1, day=28)


@router.get("/dashboard")
def dashboard(
    von: Optional[date] = Query(None),
    bis: Optional[date] = Query(None),
) -> dict:
    """Dashboard-Antwort inkl. Vorjahresvergleich für Delta-Pills.

    ``vorjahres_kpis`` enthält die gleichen KPIs für den um ein Jahr nach hinten
    verschobenen Zeitraum. Liefert das Frontend in den KPI-Karten als
    „↗ +X % vs. Vorjahr"-Pill. Bei fehlendem Zeitraum-Filter (komplettem
    Datensatz) ist ``vorjahres_kpis`` ``None`` — eine sinnvolle Verschiebung
    ist dort nicht möglich.
    """
    aktuell = queries.dashboard_kpis(_iso(von), _iso(bis))
    vj_von, vj_bis = _ein_jahr_zurueck(von), _ein_jahr_zurueck(bis)
    vorjahres_kpis = (
        queries.dashboard_kpis(_iso(vj_von), _iso(vj_bis))
        if (vj_von or vj_bis) else None
    )
    return {
        "kpis": aktuell,
        "vorjahres_kpis": vorjahres_kpis,
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


@router.get("/belege")
def belege(
    von: Optional[date] = Query(None),
    bis: Optional[date] = Query(None),
) -> list[dict]:
    return queries.belege_uebersicht(_iso(von), _iso(bis))


@router.get("/belege/{rechnungsnummer}/positionen")
def beleg_positionen(
    rechnungsnummer: str,
    datum: date = Query(..., description="Rechnungsdatum als ISO-String (YYYY-MM-DD)"),
) -> list[dict]:
    return queries.beleg_positionen(rechnungsnummer, datum.isoformat())


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
