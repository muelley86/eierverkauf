#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Eierverkauf-Helper — Verwaltung der Eierverkauf-Auswertungs-App
#
# Aufrufe:
#   eierverkauf            # Interaktives whiptail-Menü
#   eierverkauf status     # Direkter Status
#   eierverkauf update     # Direktes Update (für Cron geeignet)
#   eierverkauf logs       # Live-Logs
#   eierverkauf backup     # Direktes Backup
# ----------------------------------------------------------------------------
set -euo pipefail

APP_DIR="/opt/eierverkauf"
DB_FILE="$APP_DIR/data/eierverkauf.db"
BACKUP_DIR="$APP_DIR/backups"
VERSION_FILE="$APP_DIR/VERSION"
SERVICE="eierverkauf"
LOG_FILE="/var/log/eierverkauf-helper.log"

mkdir -p "$BACKUP_DIR"
touch "$LOG_FILE" 2>/dev/null || LOG_FILE="/tmp/eierverkauf-helper.log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"; }

# Whiptail-Helfer mit Fallback (für Umgebungen ohne whiptail) ----------------
if command -v whiptail >/dev/null 2>&1; then
    HAS_WT=1
else
    HAS_WT=0
fi

msg() {
    local title="$1" text="$2"
    if [ "$HAS_WT" = 1 ]; then
        whiptail --title "$title" --msgbox "$text" 12 70
    else
        echo "=== $title ==="; echo "$text"; echo
    fi
}

yesno() {
    local title="$1" text="$2"
    if [ "$HAS_WT" = 1 ]; then
        whiptail --title "$title" --yesno "$text" 10 60
    else
        read -r -p "$title — $text [j/N] " ans
        [[ "$ans" =~ ^[jJyY]$ ]]
    fi
}

errortrap() {
    local rc=$?
    log "FEHLER (Exit $rc) in Zeile ${BASH_LINENO[0]}: ${BASH_COMMAND}"
    msg "Fehler" "Ein Fehler ist aufgetreten (Code $rc).\nSiehe Logdatei: $LOG_FILE"
    exit "$rc"
}
trap errortrap ERR

# ---------------------------------------------------------------------------
# Funktionen
# ---------------------------------------------------------------------------

do_status() {
    local svc version db_size record_count last_import ip
    svc=$(systemctl is-active "$SERVICE" 2>/dev/null || echo "unbekannt")
    version=$(cat "$VERSION_FILE" 2>/dev/null || echo "—")
    db_size=$(du -sh "$DB_FILE" 2>/dev/null | cut -f1 || echo "—")
    record_count=$(sqlite3 "$DB_FILE" "SELECT COUNT(*) FROM verkaufspositionen" 2>/dev/null || echo "—")
    last_import=$(sqlite3 "$DB_FILE" \
        "SELECT dateiname || ' (' || import_datum || ')' FROM imports ORDER BY id DESC LIMIT 1" \
        2>/dev/null || echo "Noch kein Import")
    ip=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "—")

    msg "Status" "Dienst:         $svc
Version:        $version
URL:            http://$ip:8050
DB-Größe:       $db_size
Datensätze:     $record_count
Letzter Import: $last_import"
}

do_backup_silent() {
    local backup_file="$BACKUP_DIR/eierverkauf_$(date +%Y-%m-%d_%H-%M).db"
    sqlite3 "$DB_FILE" "VACUUM INTO '$backup_file'"
    # Nur die letzten 10 Backups behalten
    # shellcheck disable=SC2012
    ls -t "$BACKUP_DIR"/*.db 2>/dev/null | tail -n +11 | xargs -r rm -f
    echo "$backup_file"
}

do_backup() {
    local backup_file
    backup_file=$(do_backup_silent)
    local size; size=$(du -h "$backup_file" | cut -f1)
    msg "Backup" "Backup erstellt:\n$backup_file\nGröße: $size"
}

do_restart() {
    yesno "App neu starten" "Dienst '$SERVICE' wirklich neu starten?" || return 0
    systemctl restart "$SERVICE"
    sleep 1
    msg "Neustart" "Status: $(systemctl is-active "$SERVICE")"
}

do_stop() {
    yesno "App stoppen" "Dienst '$SERVICE' wirklich stoppen?" || return 0
    systemctl stop "$SERVICE"
    msg "Gestoppt" "Dienst ist nun: $(systemctl is-active "$SERVICE")"
}

do_start() {
    systemctl start "$SERVICE"
    sleep 1
    msg "Gestartet" "Dienst ist nun: $(systemctl is-active "$SERVICE")"
}

do_logs() {
    if [ "$HAS_WT" = 1 ]; then
        msg "Logs" "Live-Logs öffnen sich im Terminal. Mit Strg+C beenden."
    fi
    journalctl -u "$SERVICE" -f --no-pager
}

# Update-Prozedur ------------------------------------------------------------
do_update() {
    log "Update gestartet"
    local backup_file
    backup_file=$(do_backup_silent)
    log "Pre-Update-Backup: $backup_file"

    local progress_log="/tmp/eierverkauf-update.log"
    : > "$progress_log"

    (
        # Niemals interaktiv auf Credentials warten — sonst friert die whiptail-Gauge
        # bei 15 % ein, wenn git ohne TTY auf einen Auth-Prompt wartet (z. B. nach
        # einer kurzzeitig privaten Repo-Phase mit gecachten Stale-Credentials).
        export GIT_TERMINAL_PROMPT=0
        export GIT_ASKPASS=/bin/true
        export SSH_ASKPASS=/bin/true

        echo 5;  echo "# Aktuelle Version prüfen…"
        cd "$APP_DIR"
        timeout 60 git fetch origin --progress >>"$progress_log" 2>&1 || true

        echo 15; echo "# Git-Repository aktualisieren…"
        pull_rc=0
        timeout 120 git pull --ff-only origin main --progress >>"$progress_log" 2>&1 || pull_rc=$?
        if [ "$pull_rc" -ne 0 ]; then
            if [ "$pull_rc" -eq 124 ]; then
                echo "# GIT-Timeout (>120 s) — vermutlich Auth- oder Netz-Problem"
            else
                echo "# GIT-Fehler (Exit $pull_rc)"
            fi
            sleep 2
            exit 11
        fi

        echo 35; echo "# Python-Abhängigkeiten…"
        timeout 300 "$APP_DIR/venv/bin/pip" install -r "$APP_DIR/requirements.txt" -q >>"$progress_log" 2>&1

        # Kein --silent: npm-Fehler müssen im Progress-Log landen, sonst zeigt
        # die Fehlerbox nach einem Abbruch nichts an. Timeout gegen Netz-Hänger.
        echo 55; echo "# Node.js-Abhängigkeiten…"
        (cd "$APP_DIR/frontend" && timeout 600 npm ci --no-audit --no-fund >>"$progress_log" 2>&1)

        echo 75; echo "# Frontend bauen…"
        (cd "$APP_DIR/frontend" && timeout 600 npm run build >>"$progress_log" 2>&1)

        echo 90; echo "# Dienst neu starten…"
        systemctl restart "$SERVICE"

        echo 100; echo "# Update abgeschlossen"
    ) | (
        if [ "$HAS_WT" = 1 ]; then
            whiptail --gauge "Update wird durchgeführt…" 8 70 0
        else
            cat
        fi
    )
    local rc=${PIPESTATUS[0]}

    if [ "$rc" -ne 0 ]; then
        log "Update fehlgeschlagen (Code $rc) — Rollback"
        systemctl stop "$SERVICE" 2>/dev/null || true
        cp -f "$backup_file" "$DB_FILE"
        # Altes Write-Ahead-Log entfernen, sonst spielt SQLite es in die
        # wiederhergestellte DB ein (App läuft seit v1.11.2 im WAL-Modus).
        rm -f "$DB_FILE-wal" "$DB_FILE-shm"
        systemctl start "$SERVICE" 2>/dev/null || true
        local log_tail
        log_tail=$(tail -15 "$progress_log" 2>/dev/null || echo "(kein Log)")
        msg "Update fehlgeschlagen" "Code: $rc\nBackup wurde wiederhergestellt.\n\n--- Letzte Log-Zeilen ($progress_log) ---\n$log_tail"
        return "$rc"
    fi

    local new_version; new_version=$(cat "$VERSION_FILE" 2>/dev/null || echo "?")
    local changelog=""
    if [ -f "$APP_DIR/CHANGELOG.md" ]; then
        changelog=$(awk '/^## \[/{c++} c==1{print} c==2{exit}' "$APP_DIR/CHANGELOG.md" | head -20)
    fi
    msg "Update erfolgreich" "Neue Version: $new_version\n\n$changelog"
    log "Update abgeschlossen, neue Version: $new_version"
}

do_restore() {
    # shellcheck disable=SC2012
    local backups=( $(ls -t "$BACKUP_DIR"/*.db 2>/dev/null) )
    if [ ${#backups[@]} -eq 0 ]; then
        msg "Wiederherstellung" "Keine Backups vorhanden."
        return 0
    fi

    if [ "$HAS_WT" = 0 ]; then
        echo "Verfügbare Backups:"
        local i=1
        for b in "${backups[@]}"; do echo "  $i) $(basename "$b")"; i=$((i+1)); done
        read -r -p "Nummer wählen (oder leer für Abbruch): " ans
        [ -z "$ans" ] && return 0
        local sel="${backups[$((ans-1))]}"
    else
        local menu=()
        for b in "${backups[@]}"; do
            local size; size=$(du -h "$b" | cut -f1)
            menu+=("$b" "$(basename "$b")  ($size)")
        done
        local sel
        sel=$(whiptail --title "Backup wählen" --menu "Welches Backup wiederherstellen?" 20 78 10 "${menu[@]}" 3>&1 1>&2 2>&3) || return 0
    fi

    yesno "Warnung" "Aktuelle Datenbank wird überschrieben!\nFortfahren?" || return 0

    systemctl stop "$SERVICE"
    cp -f "$sel" "$DB_FILE"
    # Altes Write-Ahead-Log entfernen, sonst spielt SQLite es in die
    # wiederhergestellte DB ein (App läuft seit v1.11.2 im WAL-Modus).
    rm -f "$DB_FILE-wal" "$DB_FILE-shm"
    systemctl start "$SERVICE"
    msg "Wiederherstellung" "Wiederhergestellt: $(basename "$sel")"
}

do_uninstall() {
    yesno "Deinstallation" "App und Daten wirklich entfernen?" || return 0
    yesno "Letzte Warnung" "ALLE Daten gehen verloren. Fortfahren?" || return 0

    if yesno "Backup" "Vorher Datenbank-Backup erstellen?"; then
        local b; b=$(do_backup_silent)
        echo "Backup gespeichert unter: $b"
        msg "Backup" "Backup gespeichert:\n$b\n\nDieses Backup bleibt erhalten."
        # Backup außerhalb von APP_DIR sichern, da wir gleich rm -rf machen.
        cp "$b" "/root/$(basename "$b")"
    fi

    systemctl stop "$SERVICE" 2>/dev/null || true
    systemctl disable "$SERVICE" 2>/dev/null || true
    rm -f "/etc/systemd/system/${SERVICE}.service"
    rm -f "/usr/local/bin/eierverkauf"
    systemctl daemon-reload

    # APP_DIR zuletzt entfernen — sonst kann das Skript sich nicht mehr lesen.
    local script_path="$0"
    if [[ "$script_path" == "$APP_DIR"* ]]; then
        cp "$script_path" "/tmp/eierverkauf-uninstall-$$.sh"
        rm -rf "$APP_DIR"
        echo "App wurde deinstalliert."
    else
        rm -rf "$APP_DIR"
        echo "App wurde deinstalliert."
    fi
}

# ---------------------------------------------------------------------------
# Menü
# ---------------------------------------------------------------------------

show_menu() {
    while true; do
        local svc; svc=$(systemctl is-active "$SERVICE" 2>/dev/null || echo "?")
        local ver; ver=$(cat "$VERSION_FILE" 2>/dev/null || echo "?")
        local choice
        choice=$(whiptail --title "Eierverkauf App — Verwaltung" \
            --menu "Version: $ver  |  Dienst: $svc" 20 60 10 \
            "1" "Status anzeigen" \
            "2" "Update durchführen" \
            "3" "App neu starten" \
            "4" "App stoppen" \
            "5" "App starten" \
            "6" "Logs anzeigen (live)" \
            "7" "Datenbank-Backup erstellen" \
            "8" "Backup wiederherstellen" \
            "9" "Deinstallieren" \
            "0" "Beenden" \
            3>&1 1>&2 2>&3) || break

        case "$choice" in
            1) do_status ;;
            2) do_update ;;
            3) do_restart ;;
            4) do_stop ;;
            5) do_start ;;
            6) do_logs ;;
            7) do_backup ;;
            8) do_restore ;;
            9) do_uninstall ; break ;;
            0) break ;;
        esac
    done
}

# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------

case "${1:-}" in
    status)   do_status ;;
    update)   do_update ;;
    restart)  do_restart ;;
    stop)     do_stop ;;
    start)    do_start ;;
    logs)     do_logs ;;
    backup)   do_backup ;;
    restore)  do_restore ;;
    uninstall) do_uninstall ;;
    "")
        if [ "$HAS_WT" = 1 ]; then
            show_menu
        else
            echo "Whiptail nicht verfügbar. Direkte Aufrufe:"
            echo "  eierverkauf status | update | logs | backup | restore | uninstall"
        fi
        ;;
    *)
        echo "Unbekannter Befehl: $1"
        echo "Aufrufe: status | update | restart | stop | start | logs | backup | restore | uninstall"
        exit 1
        ;;
esac
