#!/usr/bin/env bash
# ===========================================================================
# Eierverkauf — Lokales Setup (macOS / Linux)
#
# Einmalig ausführen, um Python-venv und Node-Abhängigkeiten einzurichten.
# Voraussetzungen: Python 3.12+, Node.js 20+ (im PATH)
# ===========================================================================
set -euo pipefail

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info() { echo -e "${CYAN}[INFO]${NC} $*"; }
ok()   { echo -e "${GREEN}[OK]${NC}   $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()  { echo -e "${RED}[FEHL]${NC} $*"; }

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

# --- Python prüfen ---------------------------------------------------------
info "Prüfe Python-Version…"
if ! command -v python3 >/dev/null 2>&1; then
    err "python3 nicht gefunden. Bitte Python 3.12+ installieren."
    exit 1
fi
PY_VER=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
PY_MAJOR=${PY_VER%%.*}; PY_MINOR=${PY_VER##*.}
if [ "$PY_MAJOR" -lt 3 ] || { [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 12 ]; }; then
    warn "Python-Version $PY_VER < 3.12 — manche Features könnten fehlschlagen."
else
    ok "Python $PY_VER"
fi

# --- Node prüfen -----------------------------------------------------------
info "Prüfe Node-Version…"
if ! command -v node >/dev/null 2>&1; then
    err "node nicht gefunden. Bitte Node.js 20+ installieren (https://nodejs.org)."
    exit 1
fi
NODE_VER=$(node --version | sed 's/^v//')
NODE_MAJOR=${NODE_VER%%.*}
if [ "$NODE_MAJOR" -lt 20 ]; then
    warn "Node $NODE_VER < 20. Bitte aktualisieren."
else
    ok "Node $NODE_VER"
fi

# --- venv anlegen ----------------------------------------------------------
if [ -d ".venv" ]; then
    info "venv existiert bereits — überspringe Erstellung."
else
    info "Erstelle Python-venv unter .venv …"
    python3 -m venv .venv
    ok "venv angelegt"
fi

info "Aktualisiere pip…"
.venv/bin/pip install --upgrade pip --quiet
info "Installiere Python-Abhängigkeiten…"
.venv/bin/pip install -r requirements.txt
ok "Python-Abhängigkeiten installiert"

# --- npm install -----------------------------------------------------------
info "Installiere Node-Abhängigkeiten (kann einige Minuten dauern)…"
(cd frontend && npm install)
ok "Node-Abhängigkeiten installiert"

# --- WeasyPrint-Hinweise ---------------------------------------------------
echo
case "$(uname -s)" in
    Darwin)
        warn "PDF-Export benötigt unter macOS: brew install pango cairo gdk-pixbuf libffi"
        ;;
    Linux)
        warn "Falls PDF-Export fehlschlägt, libpango/libcairo installieren:"
        warn "  sudo apt-get install libpango-1.0-0 libpangoft2-1.0-0 libcairo2 libgdk-pixbuf-2.0-0"
        ;;
esac
echo

ok "Setup abgeschlossen. Nächster Schritt: bash dev-start.sh"
