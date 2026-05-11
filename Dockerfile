# ===========================================================================
# Eierverkauf-App — Docker-Image (für Tests vor Debian-Deployment)
#
# Stage 1: Frontend mit Node 20 bauen
# Stage 2: Debian Trixie Runtime mit Python 3.12 + WeasyPrint-Deps + dist/
# ===========================================================================

# --- Stage 1: Frontend-Build -----------------------------------------------
FROM node:20-bookworm AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN cd frontend && npm install --no-audit --no-fund
COPY frontend ./frontend
RUN cd frontend && npm run build

# --- Stage 2: Runtime ------------------------------------------------------
FROM debian:trixie-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 python3-venv python3-pip \
        sqlite3 \
        libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b libfontconfig1 \
        libcairo2 libgdk-pixbuf-2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/eierverkauf

# Python-Abhängigkeiten zuerst (Caching)
COPY requirements.txt ./
RUN python3 -m venv venv && \
    venv/bin/pip install --upgrade pip --quiet && \
    venv/bin/pip install -r requirements.txt --quiet

# Backend-Quellen
COPY main.py ./
COPY api ./api
COPY data ./data
COPY export ./export
COPY utils ./utils
COPY VERSION CHANGELOG.md ./

# Vorgebauter Frontend-Build aus Stage 1
COPY --from=frontend /build/frontend/dist ./frontend/dist

# Runtime-Verzeichnisse
RUN mkdir -p data uploads backups logs

EXPOSE 8050

CMD ["venv/bin/uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8050"]
