"""FastAPI-Einstiegspunkt: initialisiert DB, mountet Router und Static Files."""
from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api.auswertung_router import router as auswertung_router
from api.export_router import router as export_router
from api.import_router import router as import_router
from data.db import init_db


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    Path("uploads").mkdir(parents=True, exist_ok=True)
    Path("backups").mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title="Eierverkauf-Auswertung",
    description="Auswertung von Eierverkäufen (Kerba Bio-Ei GbR).",
    version="1.2.1",
    lifespan=lifespan,
)

# CORS für Vite-Dev-Server. In Produktion liefert FastAPI das Frontend selbst.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API-Router VOR StaticFiles mounten.
app.include_router(import_router, prefix="/api")
app.include_router(auswertung_router, prefix="/api")
app.include_router(export_router, prefix="/api")


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


# Frontend-Build statisch ausliefern, falls vorhanden.
_dist = Path(__file__).resolve().parent / "frontend" / "dist"
if _dist.exists():
    app.mount("/", StaticFiles(directory=str(_dist), html=True), name="static")
