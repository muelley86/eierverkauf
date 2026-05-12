"""API-Endpunkte für CSV-Import: Upload, Vorschau, Historie, Löschen."""
from __future__ import annotations

import shutil
import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from data import queries
from data.importer import import_csv, vorschau

router = APIRouter(tags=["import"])

# Upload-Verzeichnis: relativ zum Arbeitsverzeichnis (im Betrieb /opt/eierverkauf/uploads/).
UPLOAD_DIR = Path("uploads")


def _save_upload(file: UploadFile) -> Path:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    suffix = Path(file.filename or "upload.csv").suffix or ".csv"
    target = UPLOAD_DIR / f"{uuid.uuid4().hex}{suffix}"
    with target.open("wb") as fp:
        shutil.copyfileobj(file.file, fp)
    return target


@router.post("/import")
async def upload_import(file: UploadFile = File(...)) -> dict:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Keine Datei übermittelt.")
    target = _save_upload(file)
    try:
        ergebnis = import_csv(target, file.filename)
        return ergebnis.as_dict()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Import fehlgeschlagen: {exc}") from exc
    finally:
        # CSV nach Verarbeitung löschen (auch bei Fehler).
        target.unlink(missing_ok=True)


@router.post("/import/preview")
async def upload_preview(file: UploadFile = File(...)) -> dict:
    """Liefert die ersten 10 Zeilen einer CSV ohne sie zu importieren."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="Keine Datei übermittelt.")
    # Temporäre Datei (nicht in uploads/, da nichts persistiert wird).
    with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = Path(tmp.name)
    try:
        zeilen = vorschau(tmp_path, n=10)
        return {"zeilen": zeilen, "anzahl": len(zeilen)}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Vorschau fehlgeschlagen: {exc}") from exc
    finally:
        tmp_path.unlink(missing_ok=True)


@router.get("/imports")
def liste_imports() -> list[dict]:
    return queries.import_historie()


@router.get("/imports/{import_id}")
def import_detail(import_id: int) -> dict:
    """Vollständige Detail-Antwort für die ``/import/:id``-Seite.

    Liefert den Import-Header zusammen mit den vollständigen Protokoll-Listen
    (``fehler[]`` = fehlerhafte Zeilen, ``duplikat[]`` = übersprungene
    Duplikate). Beide Arrays sind leer, wenn der Import vor v1.0.3 entstanden
    ist (kein Protokoll persistiert) oder wenn alle Zeilen erfolgreich
    importiert wurden.
    """
    eintrag = queries.import_eintrag(import_id)
    if eintrag is None:
        raise HTTPException(status_code=404, detail="Import nicht gefunden.")
    return {
        **eintrag,
        "fehler": queries.protokoll_zeilen(import_id, "fehler"),
        "duplikat": queries.protokoll_zeilen(import_id, "duplikat"),
    }


@router.delete("/imports/{import_id}")
def loesche_import(import_id: int) -> dict:
    geloeschte = queries.import_loeschen(import_id)
    if geloeschte == 0:
        raise HTTPException(status_code=404, detail="Import nicht gefunden.")
    return {"geloescht": geloeschte}
