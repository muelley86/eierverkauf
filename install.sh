#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Eierverkauf-Auswertungs-App — Interaktiver Installer
#
# Verwendung:
#   sudo bash install.sh                       # interaktiv (whiptail)
#   sudo NONINTERACTIVE=1 bash install.sh      # ohne Dialoge (für CI/Cron)
#
# Voraussetzungen:
#   - Debian 13 (Trixie) oder kompatibel
#   - Root-Rechte
#   - Internetzugang (Pakete + npm-Registry)
# ----------------------------------------------------------------------------
set -euo pipefail

APP_DIR="/opt/eierverkauf"
SERVICE="eierverkauf"
SERVICE_USER="eierverkauf"
PORT="8050"
LOG_FILE="/var/log/eierverkauf-install.log"
NONINTERACTIVE="${NONINTERACTIVE:-0}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Farben für nicht-whiptail Modus
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

touch "$LOG_FILE" 2>/dev/null || LOG_FILE="/tmp/eierverkauf-install.log"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"; }

# ---------------------------------------------------------------------------
# Helfer
# ---------------------------------------------------------------------------
have_wt() {
    [ "$NONINTERACTIVE" = "0" ] && command -v whiptail >/dev/null 2>&1
}

wmsg() {  # title, text
    if have_wt; then whiptail --title "$1" --msgbox "$2" 14 70
    else echo -e "${GREEN}=== $1 ===${NC}"; echo "$2"; fi
}

werror() { # title, text
    if have_wt; then whiptail --title "$1" --msgbox "$2" 14 70
    else echo -e "${RED}!!! $1 !!!${NC}"; echo "$2" >&2; fi
}

wyesno() { # title, text
    if have_wt; then whiptail --title "$1" --yesno "$2" 10 65
    elif [ "$NONINTERACTIVE" = "1" ]; then return 0
    else read -r -p "$1 — $2 [j/N] " a; [[ "$a" =~ ^[jJyY]$ ]]
    fi
}

wmenu() { # title, prompt, options as alternating key/desc
    local title="$1" prompt="$2"; shift 2
    if have_wt; then
        whiptail --title "$title" --menu "$prompt" 16 70 6 "$@" 3>&1 1>&2 2>&3
    else
        echo "$title — $prompt"
        local key="" desc=""
        local i=1
        while [ $# -gt 0 ]; do
            key="$1"; desc="$2"; shift 2
            echo "  $i) $desc"
            i=$((i+1))
        done
        echo "(Eingabe Zahl, leer = Abbruch):"; read -r ans
        echo "$ans"
    fi
}

errortrap() {
    local rc=$? line=${BASH_LINENO[0]} cmd=${BASH_COMMAND}
    log "FEHLER (Exit $rc) in Zeile $line: $cmd"
    werror "Installation fehlgeschlagen" \
        "Ein Fehler ist aufgetreten.\nExit-Code: $rc\nDetails: $LOG_FILE"
    exit "$rc"
}
trap errortrap ERR

# ---------------------------------------------------------------------------
# Voraussetzungen
# ---------------------------------------------------------------------------
check_root() {
    if [ "$(id -u)" -ne 0 ]; then
        werror "Root erforderlich" "Bitte als root oder mit sudo starten."
        exit 1
    fi
}

check_voraussetzungen() {
    log "Prüfe Voraussetzungen…"
    local issues=""
    if ! grep -qi "trixie\|debian\|ubuntu" /etc/os-release 2>/dev/null; then
        issues+="• Nur auf Debian/Ubuntu getestet.\n"
    fi
    local free_gb
    free_gb=$(df -BG / | awk 'NR==2 {gsub("G","",$4); print $4}')
    if [ -n "$free_gb" ] && [ "$free_gb" -lt 2 ]; then
        issues+="• Wenig Speicher frei ($free_gb GB)\n"
    fi
    if ! ping -c 1 -W 3 deb.debian.org >/dev/null 2>&1; then
        issues+="• Keine Internetverbindung erreichbar\n"
    fi
    if [ -n "$issues" ]; then
        wyesno "Warnung" "Hinweise zum System:\n$issues\nTrotzdem fortfahren?" || exit 0
    fi
}

# ---------------------------------------------------------------------------
# Existierende Installation
# ---------------------------------------------------------------------------
detect_existing() {
    if [ -d "$APP_DIR" ]; then
        local choice
        choice=$(wmenu "Bestehende Installation gefunden" \
            "Was möchten Sie tun?" \
            "reparieren" "Reparieren (Daten erhalten)" \
            "neu" "Neu installieren (alle Daten löschen!)" \
            "abbruch" "Abbrechen")
        case "$choice" in
            reparieren) MODE="repair" ;;
            neu)
                wyesno "Daten löschen" "Wirklich alle Daten und die Datenbank löschen?" || exit 0
                systemctl stop "$SERVICE" 2>/dev/null || true
                rm -rf "$APP_DIR"
                MODE="fresh"
                ;;
            *) exit 0 ;;
        esac
    else
        MODE="fresh"
    fi
    log "Installationsmodus: $MODE"
}

# ---------------------------------------------------------------------------
# Installationsschritte mit Fortschrittsanzeige
# ---------------------------------------------------------------------------
install_steps() {
    local progress_log="/tmp/eierverkauf-install-progress.log"
    : > "$progress_log"

    (
        echo 5;  echo "# Pakete aktualisieren…"
        apt-get update -qq >>"$progress_log" 2>&1

        echo 15; echo "# Systempakete installieren…"
        DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
            python3 python3-venv python3-pip \
            git curl whiptail sqlite3 rsync \
            libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b libfontconfig1 \
            libcairo2 libgdk-pixbuf-2.0-0 >>"$progress_log" 2>&1

        echo 25; echo "# Node.js 20 LTS einrichten…"
        if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v//;s/\..*//')" -lt 20 ]; then
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >>"$progress_log" 2>&1
            DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs >>"$progress_log" 2>&1
        fi

        echo 35; echo "# Systembenutzer anlegen…"
        if ! id "$SERVICE_USER" >/dev/null 2>&1; then
            useradd -r -s /usr/sbin/nologin -d "$APP_DIR" "$SERVICE_USER"
        fi

        echo 40; echo "# Verzeichnisbaum anlegen…"
        mkdir -p "$APP_DIR"/{data,uploads,backups,logs}

        echo 45; echo "# Code kopieren…"
        rsync -a --delete \
            --exclude '.venv' --exclude 'venv' \
            --exclude 'node_modules' --exclude 'frontend/dist' \
            --exclude 'data/*.db' --exclude 'backups' --exclude 'uploads' \
            --exclude '__pycache__' --exclude '.git' \
            "$SCRIPT_DIR/" "$APP_DIR/" >>"$progress_log" 2>&1

        echo 55; echo "# Python venv + Abhängigkeiten…"
        python3 -m venv "$APP_DIR/venv"
        "$APP_DIR/venv/bin/pip" install --upgrade pip -q >>"$progress_log" 2>&1
        "$APP_DIR/venv/bin/pip" install -r "$APP_DIR/requirements.txt" -q >>"$progress_log" 2>&1

        echo 70; echo "# Node-Abhängigkeiten installieren…"
        (cd "$APP_DIR/frontend" && npm install --silent >>"$progress_log" 2>&1)

        echo 85; echo "# Frontend bauen…"
        (cd "$APP_DIR/frontend" && npm run build --silent >>"$progress_log" 2>&1)

        echo 90; echo "# Systemd-Unit installieren…"
        cat > /etc/systemd/system/${SERVICE}.service <<UNIT
[Unit]
Description=Eierverkauf Auswertungs-App
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/venv/bin/uvicorn main:app --host 0.0.0.0 --port $PORT
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
UNIT

        echo 93; echo "# Helper-Symlink anlegen…"
        chmod +x "$APP_DIR/eierverkauf-helper.sh"
        ln -sf "$APP_DIR/eierverkauf-helper.sh" /usr/local/bin/eierverkauf

        echo 96; echo "# Berechtigungen setzen…"
        chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"

        echo 98; echo "# Dienst aktivieren…"
        systemctl daemon-reload
        systemctl enable "$SERVICE" >>"$progress_log" 2>&1
        systemctl restart "$SERVICE"

        echo 100; echo "# Installation abgeschlossen"
        sleep 1
    ) | (
        if have_wt; then
            whiptail --title "Installation" --gauge "Eierverkauf-App wird installiert…" 9 70 0
        else
            cat
        fi
    )
    local rc=${PIPESTATUS[0]}
    if [ "$rc" -ne 0 ]; then
        werror "Installation fehlgeschlagen" "Details siehe $progress_log"
        exit "$rc"
    fi
}

# ---------------------------------------------------------------------------
# Hauptablauf
# ---------------------------------------------------------------------------

main() {
    check_root
    log "Installer gestartet (Modus: ${NONINTERACTIVE:-interaktiv})"

    if have_wt; then
        whiptail --title "Eierverkauf-App — Installation" --msgbox \
            "Willkommen!\n\nDieser Installer richtet die Eierverkauf-Auswertungs-App ein.\n\nZiel: $APP_DIR\nDienst: $SERVICE (Port $PORT)\nProtokoll: $LOG_FILE" 14 70
    fi

    if [ "$NONINTERACTIVE" = "0" ]; then
        wyesno "Installation starten" "App jetzt installieren?" || { echo "Abgebrochen."; exit 0; }
    fi

    check_voraussetzungen
    detect_existing
    install_steps

    sleep 2
    local svc_status; svc_status=$(systemctl is-active "$SERVICE" || echo "?")
    local ip; ip=$(hostname -I | awk '{print $1}')
    local version; version=$(cat "$APP_DIR/VERSION" 2>/dev/null || echo "?")

    wmsg "Installation erfolgreich" "Eierverkauf-App ist eingerichtet.

Version:  $version
Dienst:   $svc_status
URL:      http://$ip:$PORT
Befehl:   eierverkauf

Geben Sie 'eierverkauf' in der Shell ein,
um das Verwaltungsmenü zu öffnen."

    if have_wt && wyesno "Verwaltungsmenü" "Helper-Menü jetzt starten?"; then
        exec /usr/local/bin/eierverkauf
    fi
}

main "$@"
