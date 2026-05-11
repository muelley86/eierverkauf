# Prompt für Claude Code

Bitte lese zunächst die `CLAUDE.md` im Projektverzeichnis vollständig durch. Sie ist die maßgebliche Spezifikation.

Erstelle die vollständige **Eierverkauf-Auswertungs-App** — Backend FastAPI, Frontend React + TypeScript + Recharts, plus vollständiges Helper Script mit interaktivem Menü.

---

## Architektur-Überblick

- **Backend**: FastAPI + SQLite, Port `8050`, liefert React-Build als statische Dateien aus
- **Frontend**: React 18 + TypeScript, gebaut mit Vite, komplett lokal nach dem Build
- **Deployment**: Debian Trixie LXC-Container, Systemd-Service
- **Verwaltung**: Interaktives `whiptail`-Menü, systemweit als `eierverkauf`-Befehl verfügbar

---

## Kritischste Implementierungsdetails

### CSV-Parsing
- Semikolon-Trennzeichen, `utf-8-sig`, `skiprows=7`
- Deutsches Zahlenformat: `float(s.replace('.', '').replace(',', '.'))`
- Datum `DD.MM.YY` → `YYYY-MM-DD`

### Eiermenge-Berechnung (Pflicht)
```
PACK + Code 110  →  Menge × 10
PACK + Code 111  →  Menge × 6
stk              →  Menge × 1
kg               →  NULL
```

### Duplikatschutz
UNIQUE auf `(rechnungsnummer, kundennummer, menge, einheit, pack_code, beschreibung)` — Konflikte überspringen, zählen, kein Fehler.

### FastAPI + React
```python
# API-Router VOR StaticFiles mounten
app.include_router(import_router, prefix="/api")
app.include_router(auswertung_router, prefix="/api")
app.include_router(export_router, prefix="/api")
app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="static")
```

---

## Reihenfolge der Implementierung

### Phase 1 — Backend
1. `data/db.py` — Schema mit Indizes und CASCADE
2. `data/importer.py` — CSV-Parser, Eiermenge-Berechnung, Artikelnormierung
3. `data/queries.py` — alle SQL-Abfragen
4. `api/import_router.py` — Upload, Vorschau, Import, Protokoll, Löschen
5. `api/auswertung_router.py` — Dashboard, Kunden, Artikel, Ranking, Jahresvergleich
6. `export/excel_export.py` + `export/pdf_export.py`
7. `api/export_router.py`
8. `main.py`

### Phase 2 — Frontend-Grundstruktur
9. Vite-Projekt initialisieren (TypeScript, Tailwind, shadcn/ui)
10. `src/lib/formatierung.ts` — deutsche Zahlen-/Datumsformatierung
11. `src/api/client.ts` — Axios-Instance, alle API-Funktionen typisiert
12. `src/context/ZeitraumContext.tsx` — Von/Bis + Schnellauswahl-Buttons
13. `src/components/Layout.tsx` — Sidebar, Header mit Zeitraumfilter
14. `src/components/DataTable.tsx` — TanStack Table (sort, filter, paginate)
15. `src/components/ChartToggle.tsx` + `src/components/KPICard.tsx`

### Phase 3 — Seiten
16. `pages/Import.tsx` — Drag & Drop, Vorschau, Protokoll, Importhistorie
17. `pages/Dashboard.tsx` — KPIs, Top-5-Charts, Klick → Drill-Down
18. `pages/Kunden.tsx` + `pages/KundenDetail.tsx`
19. `pages/Artikel.tsx` + `pages/ArtikelDetail.tsx`
20. `pages/Ranking.tsx` — horizontales Balkenchart, Tabelle, Klick → Drill-Down
21. `pages/Jahresvergleich.tsx` — ComposedChart, Differenz-Tabelle (grün/rot)
22. `src/App.tsx` — React Router

### Phase 4 — Helper Script und Installation
23. `eierverkauf-helper.sh` — interaktives whiptail-Menü (siehe Spezifikation unten)
24. `install.sh` — Erstinstallation
25. `VERSION` + `CHANGELOG.md`
26. `requirements.txt` + `README.md`

---

## Helper Script — vollständige Spezifikation (`eierverkauf-helper.sh`)

### Systemweiter Befehl
```bash
# Wird von install.sh eingerichtet:
ln -sf /opt/eierverkauf/eierverkauf-helper.sh /usr/local/bin/eierverkauf
chmod +x /usr/local/bin/eierverkauf
```

### Aufruf-Varianten
```bash
eierverkauf           # Interaktives Menü
eierverkauf update    # Direkt Update (kein Menü, für Cron geeignet)
eierverkauf status    # Direkt Status
eierverkauf logs      # Direkt Logs
eierverkauf backup    # Direkt Backup
```

### Menü (whiptail)
```bash
CHOICE=$(whiptail --title "Eierverkauf App — Verwaltung" \
  --menu "Version: $(cat /opt/eierverkauf/VERSION)  |  $(systemctl is-active eierverkauf)" \
  20 60 10 \
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
  3>&1 1>&2 2>&3)
```

### Update-Funktion (Menüpunkt 2 + `eierverkauf update`)
Muss als eigenständige Funktion `do_update()` implementiert sein, die sowohl vom Menü als auch direkt aufgerufen werden kann:

```bash
do_update() {
  # 1. Automatisches DB-Backup vor Update
  do_backup_silent  # Backup ohne Benutzerinteraktion

  # 2. Fortschrittsanzeige mit whiptail --gauge
  {
    echo "5";  echo "# Aktuelle Version prüfen..."
    git -C /opt/eierverkauf fetch origin 2>/dev/null
    
    echo "10"; echo "# Git-Repository aktualisieren..."
    git -C /opt/eierverkauf pull origin main || { echo "GIT_FEHLER"; exit 1; }
    
    echo "30"; echo "# Python-Abhängigkeiten aktualisieren..."
    /opt/eierverkauf/venv/bin/pip install -r /opt/eierverkauf/requirements.txt -q
    
    echo "50"; echo "# Node.js-Abhängigkeiten aktualisieren..."
    cd /opt/eierverkauf/frontend && npm install --silent
    
    echo "65"; echo "# Frontend neu bauen..."
    npm run build --silent
    
    echo "85"; echo "# Dienst neu starten..."
    systemctl restart eierverkauf
    
    echo "100"; echo "# Update abgeschlossen!"
  } | whiptail --gauge "Update wird durchgeführt..." 8 60 0

  # 3. Neue Version anzeigen
  NEW_VERSION=$(cat /opt/eierverkauf/VERSION)
  whiptail --msgbox "Update erfolgreich!\nNeue Version: $NEW_VERSION" 8 40
}
```

Bei Fehler: `trap` aufrufen, letztes Backup wiederherstellen, Fehlermeldung als `whiptail --msgbox`.

### Status-Funktion
```bash
do_status() {
  SERVICE_STATUS=$(systemctl is-active eierverkauf)
  VERSION=$(cat /opt/eierverkauf/VERSION)
  DB_SIZE=$(du -sh /opt/eierverkauf/data/eierverkauf.db 2>/dev/null | cut -f1)
  RECORD_COUNT=$(sqlite3 /opt/eierverkauf/data/eierverkauf.db \
    "SELECT COUNT(*) FROM verkaufspositionen" 2>/dev/null || echo "—")
  LAST_IMPORT=$(sqlite3 /opt/eierverkauf/data/eierverkauf.db \
    "SELECT dateiname || ' (' || import_datum || ')' FROM imports ORDER BY id DESC LIMIT 1" \
    2>/dev/null || echo "Noch kein Import")
  IP=$(hostname -I | awk '{print $1}')

  whiptail --title "Status" --msgbox \
    "Dienst:        $SERVICE_STATUS
Version:       $VERSION
URL:           http://$IP:8050
DB-Größe:      $DB_SIZE
Datensätze:    $RECORD_COUNT
Letzter Import: $LAST_IMPORT" 14 55
}
```

### Backup-Funktion
```bash
do_backup() {
  BACKUP_FILE="/opt/eierverkauf/backups/eierverkauf_$(date +%Y-%m-%d_%H-%M).db"
  sqlite3 /opt/eierverkauf/data/eierverkauf.db "VACUUM INTO '$BACKUP_FILE'"
  
  # Nur die letzten 10 Backups behalten
  ls -t /opt/eierverkauf/backups/*.db | tail -n +11 | xargs rm -f 2>/dev/null
  
  whiptail --msgbox "Backup erstellt:\n$BACKUP_FILE" 8 55
}
```

### Wiederherstellung
```bash
do_restore() {
  # Backups als whiptail --menu auflisten
  BACKUPS=$(ls -t /opt/eierverkauf/backups/*.db 2>/dev/null)
  if [ -z "$BACKUPS" ]; then
    whiptail --msgbox "Keine Backups vorhanden." 7 40
    return
  fi
  # Menü aus Backup-Dateien bauen, nach Auswahl:
  # systemctl stop eierverkauf
  # cp "$SELECTED" /opt/eierverkauf/data/eierverkauf.db
  # systemctl start eierverkauf
}
```

### Deinstallation — doppelte Bestätigung
```bash
do_uninstall() {
  whiptail --yesno "Wirklich deinstallieren?\nAlle Daten gehen verloren!" 8 45 || return
  whiptail --yesno "LETZTE WARNUNG: App und alle Daten löschen?" 8 45 || return
  
  # Optionales Backup anbieten
  whiptail --yesno "Vorher Datenbank-Backup erstellen?" 7 45 && do_backup_silent
  
  systemctl stop eierverkauf 2>/dev/null
  systemctl disable eierverkauf 2>/dev/null
  rm -f /etc/systemd/system/eierverkauf.service
  rm -f /usr/local/bin/eierverkauf
  rm -rf /opt/eierverkauf
  systemctl daemon-reload
  
  echo "Eierverkauf App wurde deinstalliert."
}
```

---

## Recharts-Anforderungen

Alle Zeitreihencharts:
- `<ResponsiveContainer width="100%" height={350}>`
- `<Brush dataKey="monat" height={20}>` für Zoom
- Tooltip: deutsche Zahlenformate (`toLocaleString('de-DE')`)
- Farben: Eier `#2563eb`, Umsatz `#16a34a`, Vorjahr `#94a3b8`
- Balken↔Linie via lokalem State, kein API-Call

Ranking: `<BarChart layout="vertical">` horizontal für Top 10.
Jahresvergleich: `<ComposedChart>` mit Bar (Jahr X) + Line (Jahr X-1).

---

## Qualitätsanforderungen

- Vollständiger, lauffähiger Code — kein Pseudocode, keine `// TODO`
- TypeScript: keine `any`-Typen
- Loading-States: shadcn/ui `Skeleton`
- Fehler: shadcn/ui `Toast`
- Alle UI-Texte Deutsch
- Helper Script: `set -e` + `trap ERR` für Fehlerbehandlung
- `sqlite3`-CLI muss in `install.sh` installiert werden (für Helper Script)
- README muss enthalten: Erstinstallation, verfügbare `eierverkauf`-Befehle, Update-Anleitung

Beginne mit Phase 1. Sequenziell abarbeiten. Keine Rückfragen.
