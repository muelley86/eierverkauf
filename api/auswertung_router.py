"""API-Endpunkte für Auswertungen: Dashboard, Verlauf, Kunden, Artikel, Ranking, Jahresvergleich."""
from __future__ import annotations

from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from api.kundenfilter import kunden_param
from data import queries, verlauf

router = APIRouter(tags=["auswertung"])


def _iso(d: Optional[date]) -> Optional[str]:
    return d.isoformat() if d else None


@router.get("/dashboard")
def dashboard(
    von: Optional[date] = Query(None),
    bis: Optional[date] = Query(None),
    kunden: list[str] = Depends(kunden_param),
) -> dict:
    """Dashboard-Antwort inkl. Vorjahresvergleich für Delta-Pills.

    ``vorjahres_kpis`` enthält die gleichen KPIs für den um ein Jahr nach hinten
    verschobenen Zeitraum. Liefert das Frontend in den KPI-Karten als
    „↗ +X % vs. Vorjahr"-Pill. Bei fehlendem Zeitraum-Filter (komplettem
    Datensatz) ist ``vorjahres_kpis`` ``None`` — eine sinnvolle Verschiebung
    ist dort nicht möglich. ``kunden`` beschränkt alle Teile (inkl. Vorjahr)
    auf diese Kundennummern.
    """
    aktuell = queries.dashboard_kpis(_iso(von), _iso(bis), kunden)
    vj_von, vj_bis = verlauf.ein_jahr_zurueck(von), verlauf.ein_jahr_zurueck(bis)
    # Nur vergleichen, wenn jede gesetzte Grenze auch verschiebbar ist.
    verschiebbar = (von is None or vj_von is not None) and (bis is None or vj_bis is not None)
    vorjahres_kpis = (
        queries.dashboard_kpis(_iso(vj_von), _iso(vj_bis), kunden)
        if (vj_von or vj_bis) and verschiebbar else None
    )
    return {
        "kpis": aktuell,
        "vorjahres_kpis": vorjahres_kpis,
        "top5_kunden": queries.top5_kunden(_iso(von), _iso(bis), kunden),
        "top5_artikel": queries.top5_artikel(_iso(von), _iso(bis), kunden),
    }


@router.get("/verlauf")
def zeitraum_verlauf(
    von: Optional[date] = Query(None),
    bis: Optional[date] = Query(None),
    granularitaet: Optional[Literal["tag", "woche", "monat"]] = Query(None),
    kunden: list[str] = Depends(kunden_param),
) -> dict:
    """Verlauf im Zeitraum + positionsgleicher Vorjahreszeitraum.

    Speist die Übersichts-Grafik (Auflösung automatisch) und die Seite
    „Zeitraumvergleich" (``granularitaet=monat``), siehe ``data.verlauf``.
    """
    try:
        return verlauf.zeitraum_verlauf(von, bis, granularitaet, kunden)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.get("/kunden")
def kunden(
    von: Optional[date] = Query(None),
    bis: Optional[date] = Query(None),
    kunden: list[str] = Depends(kunden_param),
) -> list[dict]:
    return queries.kunden_uebersicht(_iso(von), _iso(bis), kunden)


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
    kunden: list[str] = Depends(kunden_param),
) -> list[dict]:
    return queries.artikel_uebersicht(_iso(von), _iso(bis), kunden)


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
    kunden: list[str] = Depends(kunden_param),
) -> list[dict]:
    return queries.belege_uebersicht(_iso(von), _iso(bis), kunden)


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
    kunden: list[str] = Depends(kunden_param),
) -> list[dict]:
    return queries.ranking(_iso(von), _iso(bis), sort, kunden)


@router.get("/jahresvergleich")
def jahresvergleich(
    jahr: int = Query(...),
    kunden: list[str] = Depends(kunden_param),
) -> list[dict]:
    return queries.jahresvergleich(jahr, kunden)


@router.get("/kundenauswahl")
def kundenauswahl() -> list[dict]:
    """Alle Kunden (Nummer + Name) für die Auswahlliste des Kundenfilters."""
    return queries.kundenauswahl()
