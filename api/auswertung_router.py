"""API-Endpunkte für Auswertungen: Dashboard, Kunden, Artikel, Ranking, Jahresvergleich."""
from __future__ import annotations

from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Query

from data import queries, verlauf

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


def _effektiver_zeitraum(
    von: Optional[date], bis: Optional[date]
) -> Optional[tuple[date, date]]:
    """Füllt fehlende Grenzen mit dem Datenbereich auf; ``None`` ohne Daten."""
    if von and bis:
        return von, bis
    min_datum, max_datum = queries.datenbereich()
    if min_datum is None or max_datum is None:
        return None
    return (
        von or date.fromisoformat(min_datum),
        bis or date.fromisoformat(max_datum),
    )


@router.get("/dashboard/verlauf")
def dashboard_verlauf(
    von: Optional[date] = Query(None),
    bis: Optional[date] = Query(None),
) -> dict:
    """Verlauf für die Dashboard-Grafik im gewählten Zeitraum.

    Auflösung automatisch (Tag/Woche/Monat, siehe ``data.verlauf``). Der
    Vorjahreszeitraum liegt positionsgleich in ``vorjahr_*``; ohne
    Zeitraum-Filter sind diese Felder ``None`` (analog ``vorjahres_kpis``).
    """
    if von and bis and von > bis:
        raise HTTPException(status_code=422, detail="„von“ liegt nach „bis“.")
    zeitraum = _effektiver_zeitraum(von, bis)
    if zeitraum is None:
        return {"granularitaet": "monat", "punkte": []}
    start, ende = zeitraum
    if start > ende:
        raise HTTPException(status_code=422, detail="Zeitraum enthält keine Daten.")

    granularitaet = verlauf.waehle_granularitaet(start, ende)
    aktuell = verlauf.bucket_verlauf(
        queries.tageswerte(_iso(start), _iso(ende)), start, ende, granularitaet
    )
    mit_vorjahr = bool(von or bis)
    vorjahr: list[dict] = []
    if mit_vorjahr:
        vj_start, vj_ende = _ein_jahr_zurueck(start), _ein_jahr_zurueck(ende)
        vorjahr = verlauf.bucket_verlauf(
            queries.tageswerte(_iso(vj_start), _iso(vj_ende)),
            vj_start, vj_ende, granularitaet,
        )

    def _vj(i: int, feld: str) -> Optional[float]:
        if not mit_vorjahr:
            return None
        return vorjahr[i][feld] if i < len(vorjahr) else 0.0

    return {
        "granularitaet": granularitaet,
        "punkte": [
            {
                **punkt,
                "vorjahr_eier": _vj(i, "eier"),
                "vorjahr_umsatz": _vj(i, "umsatz"),
            }
            for i, punkt in enumerate(aktuell)
        ],
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
