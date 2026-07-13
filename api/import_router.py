"""API-Endpunkte für CSV-Import: Upload, Vorschau, Historie, Löschen."""
from __future__ import annotations

import shutil
import tempfile
import threading
import time
import traceback
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile

from data import queries
from data.importer import import_csv, vorschau

router = APIRouter(tags=["import"])

# Laufende Hintergrund-Löschungen. Prozesslokal genügt: die App läuft mit
# genau einem uvicorn-Worker. Geht der Prozess mitten in einer Löschung
# unter, bleibt der Import in der Historie sichtbar und kann erneut
# gelöscht werden (import_loeschen ist wiederholbar).
_loeschungen_lock = threading.Lock()
_loeschungen_laufen: set[int] = set()

# Serialisiert die eigentliche Löscharbeit: SQLite verträgt nur einen Schreiber,
# ein zweiter bricht beim Transaktions-Upgrade sofort mit "database is locked"
# ab (der busy-Handler greift dort nicht). Der 409-Guard im Endpoint deckt nur
# dieselbe Import-ID.
_loesch_arbeit_lock = threading.Lock()


def _loesche_im_hintergrund(import_id: int) -> None:
    """Führt die häppchenweise Löschung aus und räumt den Lauf-Status auf.

    ``flush=True`` bei allen Logzeilen: unter systemd ist stdout blockgepuffert,
    ohne Flush erscheinen die Zeilen in journalctl erst verspätet.
    """
    start = time.perf_counter()
    try:
        with _loesch_arbeit_lock:
            geloeschte = queries.import_loeschen(import_id)
        dauer = time.perf_counter() - start
        print(f"[import] Hintergrund-Löschung von Import {import_id} "
              f"abgeschlossen ({geloeschte} Eintrag, {dauer:.1f} s).", flush=True)
    except Exception:
        dauer = time.perf_counter() - start
        print(f"[import] Hintergrund-Löschung von Import {import_id} "
              f"nach {dauer:.1f} s fehlgeschlagen:", flush=True)
        traceback.print_exc()
    finally:
        with _loeschungen_lock:
            _loeschungen_laufen.discard(import_id)

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
def upload_import(file: UploadFile = File(...)) -> dict:
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
def upload_preview(file: UploadFile = File(...)) -> dict:
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
    """Importhistorie, additiv ergänzt um den Hintergrund-Lösch-Status."""
    with _loeschungen_lock:
        laufend = set(_loeschungen_laufen)
    return [
        {**eintrag, "wird_geloescht": eintrag["id"] in laufend}
        for eintrag in queries.import_historie()
    ]


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
def loesche_import(import_id: int, background_tasks: BackgroundTasks) -> dict:
    """Stößt die Löschung an und antwortet sofort.

    Große Löschungen dauern auf langsamem Storage Minuten — synchron gewartet
    liefe jedes Frontend-Timeout ab. Die eigentliche Arbeit läuft daher als
    BackgroundTask im Threadpool; den Fortschritt zeigt ``wird_geloescht``
    in der Historie.
    """
    if queries.import_eintrag(import_id) is None:
        raise HTTPException(status_code=404, detail="Import nicht gefunden.")
    with _loeschungen_lock:
        if import_id in _loeschungen_laufen:
            raise HTTPException(status_code=409, detail="Löschung läuft bereits.")
        _loeschungen_laufen.add(import_id)
    background_tasks.add_task(_loesche_im_hintergrund, import_id)
    return {"geloescht_geplant": True}
