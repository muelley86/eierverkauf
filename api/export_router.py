"""API-Endpunkte für Excel- und PDF-Export."""
from __future__ import annotations

from datetime import date
from io import BytesIO
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from data import queries
from export.excel_export import build_excel
from export.pdf_export import build_pdf

router = APIRouter(tags=["export"])

ExportTyp = Literal[
    "kunden", "artikel", "ranking",
    "kunde_monate", "artikel_monate", "jahresvergleich",
]


def _iso(d: Optional[date]) -> Optional[str]:
    return d.isoformat() if d else None


def _daten_laden(typ: str, von: Optional[str], bis: Optional[str],
                 kunde_nr: Optional[str], code: Optional[str],
                 jahr: Optional[int], sort: str) -> list[dict]:
    if typ == "kunden":
        return queries.kunden_uebersicht(von, bis)
    if typ == "artikel":
        return queries.artikel_uebersicht(von, bis)
    if typ == "ranking":
        return queries.ranking(von, bis, sort)
    if typ == "kunde_monate":
        if not kunde_nr:
            raise HTTPException(status_code=400, detail="Parameter 'kunde_nr' erforderlich.")
        return queries.kunde_monate(kunde_nr, von, bis)
    if typ == "artikel_monate":
        if not code:
            raise HTTPException(status_code=400, detail="Parameter 'code' erforderlich.")
        return queries.artikel_monate(code, von, bis)
    if typ == "jahresvergleich":
        if not jahr:
            raise HTTPException(status_code=400, detail="Parameter 'jahr' erforderlich.")
        return queries.jahresvergleich(jahr)
    raise HTTPException(status_code=400, detail=f"Unbekannter Export-Typ: {typ}")


def _dateiname(typ: str, ext: str, von: Optional[str], bis: Optional[str]) -> str:
    teile = ["eierverkauf", typ]
    if von:
        teile.append(von)
    if bis:
        teile.append(bis)
    return "_".join(teile) + f".{ext}"


@router.get("/export/excel")
def export_excel(
    typ: ExportTyp = Query(...),
    von: Optional[date] = Query(None),
    bis: Optional[date] = Query(None),
    kunde_nr: Optional[str] = Query(None),
    code: Optional[str] = Query(None),
    jahr: Optional[int] = Query(None),
    sort: Literal["menge", "umsatz"] = "menge",
):
    v, b = _iso(von), _iso(bis)
    daten = _daten_laden(typ, v, b, kunde_nr, code, jahr, sort)
    bytes_ = build_excel(typ, v, b, daten)
    headers = {"Content-Disposition": f'attachment; filename="{_dateiname(typ, "xlsx", v, b)}"'}
    return StreamingResponse(
        BytesIO(bytes_),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )


@router.get("/export/pdf")
def export_pdf(
    typ: ExportTyp = Query(...),
    von: Optional[date] = Query(None),
    bis: Optional[date] = Query(None),
    kunde_nr: Optional[str] = Query(None),
    code: Optional[str] = Query(None),
    jahr: Optional[int] = Query(None),
    sort: Literal["menge", "umsatz"] = "menge",
):
    v, b = _iso(von), _iso(bis)
    daten = _daten_laden(typ, v, b, kunde_nr, code, jahr, sort)
    try:
        bytes_ = build_pdf(typ, v, b, daten)
    except OSError as exc:
        # WeasyPrint kann auf Systemen ohne GTK-Runtime mit OSError fehlschlagen.
        raise HTTPException(
            status_code=500,
            detail=(
                "PDF-Export nicht möglich: WeasyPrint-Systemabhängigkeiten "
                "(GTK / Pango / Cairo) fehlen. " + str(exc)
            ),
        ) from exc
    headers = {"Content-Disposition": f'attachment; filename="{_dateiname(typ, "pdf", v, b)}"'}
    return StreamingResponse(BytesIO(bytes_), media_type="application/pdf", headers=headers)
