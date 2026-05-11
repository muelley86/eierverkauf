#!/usr/bin/env bash
# ===========================================================================
# Eierverkauf — Lokaler Dev-Start (macOS / Linux)
#
# Startet Backend (uvicorn) und Frontend (Vite) parallel.
# Beendet sich sauber mit Ctrl+C.
# ===========================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

VENV_PY="$REPO_ROOT/.venv/bin/python"
FRONTEND_DIR="$REPO_ROOT/frontend"

if [ ! -x "$VENV_PY" ]; then
    echo "Bitte zuerst dev-setup.sh ausführen (venv fehlt)." >&2
    exit 1
fi
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo "Bitte zuerst dev-setup.sh ausführen (node_modules fehlt)." >&2
    exit 1
fi

cleanup() {
    echo
    echo "Beende Prozesse…"
    kill "${BACKEND_PID:-}" "${FRONTEND_PID:-}" 2>/dev/null || true
    wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "→ Backend startet auf  http://localhost:8050"
"$VENV_PY" -m uvicorn main:app --reload --port 8050 &
BACKEND_PID=$!

echo "→ Frontend startet auf http://localhost:5173"
(cd "$FRONTEND_DIR" && npm run dev) &
FRONTEND_PID=$!

# Browser auf macOS / Linux öffnen (best effort).
sleep 3
if command -v open >/dev/null 2>&1; then
    open "http://localhost:5173" >/dev/null 2>&1 || true
elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:5173" >/dev/null 2>&1 || true
fi

wait
