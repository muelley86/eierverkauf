# Eierverkauf-Auswertungs-App

Webbasierte Auswertung von Eierverkäufen für **Kerba Bio-Ei GbR**.
Backend: FastAPI + SQLite. Frontend: React 18 + TypeScript + Vite + Recharts + shadcn/ui.

- Läuft komplett im lokalen Netzwerk, ohne Internet zur Laufzeit.
- Persistente Datenbank für Auswertungen über beliebige Zeiträume.
- Browser-basierte CSV-Imports, Excel- und PDF-Exporte.

---

## Inhalt

1. [Erstinstallation auf Debian](#erstinstallation-auf-debian)
2. [Der `eierverkauf`-Befehl](#der-eierverkauf-befehl)
3. [Update](#update)
4. [Backup & Restore](#backup--restore)
5. [Manuelle Service-Steuerung](#manuelle-service-steuerung)
6. [Lokale Entwicklung (Windows / macOS / Linux)](#lokale-entwicklung-windows--macos--linux)
7. [Mit Docker Compose](#mit-docker-compose)
8. [Projektstruktur](#projektstruktur)
9. [Troubleshooting](#troubleshooting)

---

## Erstinstallation auf Debian

Voraussetzungen: Debian 13 (Trixie) oder kompatibel, Root-Rechte, Internetzugang während der Installation.

```bash
# 1) Repository klonen (oder Dateien manuell nach /tmp/eierverkauf kopieren)
cd /tmp
git clone <REPO-URL> eierverkauf
cd eierverkauf

# 2) Interaktiv installieren (whiptail-Dialoge, Fortschrittsanzeige)
sudo bash install.sh

# Alternativ ohne Dialoge (für CI/Cron):
sudo NONINTERACTIVE=1 bash install.sh
```

Der Installer:
1. Begrüßt mit Willkommens-Dialog.
2. Prüft Voraussetzungen (Debian-Version, Speicher, Internet).
3. Erkennt vorhandene Installation und bietet **Reparieren / Neu installieren / Abbrechen**.
4. Zeigt eine Gauge-Fortschrittsanzeige durch alle Schritte:
   - System-Pakete (`python3 python3-venv git curl whiptail sqlite3 rsync` + WeasyPrint-Abhängigkeiten)
   - Node.js 20 LTS via NodeSource
   - System-User `eierverkauf` (ohne Login-Shell)
   - `/opt/eierverkauf/{data,uploads,backups,logs}`
   - Python-venv + `pip install -r requirements.txt`
   - `npm install` + `npm run build`
   - Systemd-Unit `eierverkauf.service`
   - Symlink `/usr/local/bin/eierverkauf` → Helper-Script
5. Aktiviert und startet den Dienst.
6. Zeigt URL (`http://<IP>:8050`) und bietet an, das Helper-Menü zu öffnen.

Detail-Logs landen in `/var/log/eierverkauf-install.log` (bei Fehlern automatisch geöffnet).

---

## Der `eierverkauf`-Befehl

Nach der Installation steht der Befehl `eierverkauf` systemweit zur Verfügung.

### Interaktives Menü

```bash
eierverkauf
```

Öffnet ein whiptail-Menü mit folgenden Punkten:

| # | Aktion | Beschreibung |
|---|---|---|
| 1 | Status anzeigen | Dienst-Status, Version, URL, DB-Größe, Datensatzanzahl, letzter Import |
| 2 | Update durchführen | `git pull` + Abhängigkeiten + Frontend-Build + Service-Restart, mit Pre-Update-Backup und Rollback bei Fehler |
| 3 | App neu starten | `systemctl restart eierverkauf` (mit Bestätigung) |
| 4 | App stoppen | `systemctl stop eierverkauf` (mit Bestätigung) |
| 5 | App starten | `systemctl start eierverkauf` |
| 6 | Logs anzeigen (live) | `journalctl -u eierverkauf -f --no-pager` |
| 7 | Datenbank-Backup | SQLite `VACUUM INTO` nach `/opt/eierverkauf/backups/`; behält automatisch nur die letzten 10 |
| 8 | Backup wiederherstellen | Auswahl-Menü aus vorhandenen Backups, Service-Stop/Restore/Start |
| 9 | Deinstallieren | Doppelte Bestätigung, optional Backup vor Löschung, vollständige Entfernung |
| 0 | Beenden | |

### Direkte Subkommandos (für Skripte/Cron)

```bash
eierverkauf status      # Status anzeigen
eierverkauf update      # Update durchführen (Gauge-Anzeige, bei NONINTERACTIVE Text)
eierverkauf restart     # Dienst neu starten
eierverkauf stop        # Dienst stoppen
eierverkauf start       # Dienst starten
eierverkauf logs        # Live-Logs (Strg+C zum Beenden)
eierverkauf backup      # Datenbank-Backup erstellen
eierverkauf restore     # Aus Backup wiederherstellen
eierverkauf uninstall   # Vollständige Deinstallation
```

### Beispiel: Automatisches tägliches Backup um 3 Uhr

```bash
sudo crontab -e
# Folgende Zeile hinzufügen:
0 3 * * * /usr/local/bin/eierverkauf backup >/dev/null 2>&1
```

---

## Update

### Variante A — Über das Menü

```bash
eierverkauf            # Menü öffnen → "2) Update durchführen"
```

### Variante B — Direkt

```bash
sudo eierverkauf update
```

Vor jedem Update wird automatisch ein Datenbank-Backup angelegt. Bei einem Fehler (z. B. Git-Konflikt, Build-Fehler) erfolgt **automatischer Rollback**: das Backup wird zurückgespielt und der Service neu gestartet.

**Voraussetzung**: `/opt/eierverkauf` muss ein Git-Working-Copy mit Remote `origin/main` sein. Falls nicht, einmalig einrichten:

```bash
cd /opt/eierverkauf
sudo git init
sudo git remote add origin <REPO-URL>
sudo git fetch origin
sudo git checkout -t origin/main
```

---

## Backup & Restore

Backups liegen unter `/opt/eierverkauf/backups/` als `eierverkauf_YYYY-MM-DD_HH-MM.db`. Es werden automatisch nur die letzten 10 Backups behalten.

```bash
eierverkauf backup    # Backup erstellen
eierverkauf restore   # Backup wiederherstellen (Menü)
```

Bei Restore wird der Service kurz gestoppt, die `eierverkauf.db` überschrieben und der Service wieder gestartet.

---

## Manuelle Service-Steuerung

```bash
sudo systemctl status eierverkauf      # Status
sudo systemctl start eierverkauf       # Starten
sudo systemctl stop eierverkauf        # Stoppen
sudo systemctl restart eierverkauf     # Neu starten
sudo journalctl -u eierverkauf -f      # Live-Logs
```

---

## Lokale Entwicklung (Windows / macOS / Linux)

Vor dem Debian-Deployment können Sie die App lokal testen.

### Voraussetzungen

| Komponente | Mindestversion | Hinweis |
|---|---|---|
| Python | 3.12 | inkl. `pip` und `venv` |
| Node.js | 20 LTS | inkl. `npm` |
| (optional) GTK | für WeasyPrint | siehe [Troubleshooting](#weasyprint-windows--macos) |

### Schnellstart Windows (PowerShell)

```powershell
# 1) Einmaliges Setup: venv + pip + npm install
.\dev-setup.ps1

# 2) Backend und Frontend starten (öffnet zwei Fenster)
.\dev-start.ps1
# → http://localhost:5173 (Vite Dev mit Hot-Reload, Proxy an Backend)
```

### Schnellstart macOS / Linux (Bash)

```bash
# 1) Einmaliges Setup
bash dev-setup.sh

# 2) Backend + Frontend starten
bash dev-start.sh
# → http://localhost:5173
```

### Funktionsweise

- Backend lauscht auf `localhost:8050` (uvicorn mit `--reload`).
- Vite Dev-Server lauscht auf `localhost:5173`, leitet `/api/*` via Proxy an Backend.
- SQLite-DB wird unter `./data/eierverkauf.db` angelegt (lokal, nicht in `/opt/eierverkauf/`).

---

## Mit Docker Compose

Für vollständige Integrationstests inkl. PDF-Export ohne lokale GTK-Installation:

```bash
docker compose up --build
# → http://localhost:8050
```

Spiegelt die Debian-Produktivumgebung. Volumes für `data/`, `uploads/`, `backups/` bleiben zwischen Starts erhalten. Beendet sich mit `Ctrl+C` (Daten bleiben erhalten); `docker compose down -v` löscht auch die Daten.

---

## Projektstruktur

```
/opt/eierverkauf/                       (auf Debian)
.                                       (im Repo)
├── main.py                             FastAPI-App + Static-Mount
├── api/                                FastAPI-Router
│   ├── import_router.py
│   ├── auswertung_router.py
│   └── export_router.py
├── data/                                Datenschicht
│   ├── db.py                            (SQLite-Connection, Schema-Init)
│   ├── importer.py                      (CSV-Parser + Eier-Berechnung)
│   ├── queries.py                       (alle SQL-Abfragen)
│   └── eierverkauf.db                   (Produktiv-DB, gitignoriert)
├── export/                              Excel- und PDF-Erzeugung
│   ├── excel_export.py
│   └── pdf_export.py
├── utils/                               Server-Helfer
│   └── formatierung.py
├── frontend/                            React + Vite
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── components.json                  (shadcn/ui-Konfiguration)
│   ├── index.html
│   └── src/
│       ├── main.tsx, App.tsx, index.css
│       ├── api/client.ts                (typisierter Axios-Client)
│       ├── lib/utils.ts, formatierung.ts
│       ├── context/ZeitraumContext.tsx  (globaler Zeitraumfilter)
│       ├── components/
│       │   ├── Layout.tsx, KPICard.tsx
│       │   ├── ChartToggle.tsx, DataTable.tsx
│       │   └── ui/                      (shadcn-Komponenten)
│       └── pages/
│           ├── Dashboard.tsx, Import.tsx
│           ├── Kunden.tsx, KundenDetail.tsx
│           ├── Artikel.tsx, ArtikelDetail.tsx
│           ├── Ranking.tsx, Jahresvergleich.tsx
├── uploads/                             Temporäre CSVs (laufzeitbedingt)
├── backups/                             Datenbank-Backups (max. 10 behalten)
├── logs/                                App-Logs
├── eierverkauf-helper.sh                Verwaltungs-Script (Menü + Subcmds)
├── install.sh                            Erstinstallation
├── dev-setup.ps1, dev-setup.sh           Lokales Setup
├── dev-start.ps1, dev-start.sh           Lokaler Dev-Start
├── Dockerfile, docker-compose.yml        Container-Tests
├── VERSION, CHANGELOG.md, README.md
└── requirements.txt
```

---

## Troubleshooting

### Port 8050 ist belegt
```bash
sudo lsof -i :8050        # Linux/macOS
Get-NetTCPConnection -LocalPort 8050   # Windows-PowerShell
# Prozess beenden oder Port in install.sh anpassen.
```

### Python-Version zu alt
Debian Trixie liefert Python 3.12 mit. Bei älteren Distributionen aus den `deadsnakes`-Backports installieren.

### Node-Version zu alt
Der Installer richtet NodeSource Node 20 LTS ein. Bei manueller Installation:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs
```

### WeasyPrint Windows / macOS
PDF-Export benötigt **GTK / Pango / Cairo**. Auf Debian/Ubuntu werden die Abhängigkeiten vom Installer automatisch installiert.

- **macOS**: `brew install pango cairo gdk-pixbuf libffi`
- **Windows**: GTK-Runtime von <https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer/releases> installieren. Alternativ: PDF-Export nur über Docker Compose nutzen.

### Frontend-Build schlägt fehl
```bash
cd frontend
rm -rf node_modules dist
npm install
npm run build
```

### Datenbank zurücksetzen (Achtung: alle Daten löschen!)
```bash
sudo systemctl stop eierverkauf
sudo rm /opt/eierverkauf/data/eierverkauf.db
sudo systemctl start eierverkauf
```

### CSV-Import zählt 0 Zeilen importiert
Mehrere mögliche Ursachen, in dieser Reihenfolge prüfen:

1. **Alle Zeilen sind Duplikate.** Im Importprotokoll steht dann eine hohe
   Zahl bei „Übersprungen". Der UNIQUE-Constraint verhindert
   Doppel-Imports. Kein Fehler.
2. **Alle Zeilen sind fehlerhaft.** Steht „Fehlerhaft" hoch und
   „Importiert" auf 0, zeigt die App seit v1.0.2 ein **Fehlerprotokoll**
   mit Zeilennummer und konkretem Grund unterhalb der KPI-Zahlen. Häufige
   Gründe:
   - `Datum '…' nicht erkannt` → Spalte A enthält keinen Wert im Format
     `DD.MM.YY` oder `DD.MM.YYYY`. Andere Formate (z. B. ISO `2025-11-05`
     oder US `11/05/2025`) werden aktuell nicht unterstützt.
   - `Menge '…' nicht numerisch` → Spalte F enthält Text oder
     Sonderzeichen.
   - `Kundennummer fehlt` / `Kundenname fehlt` → Spalte C bzw. D leer.
3. **Datei wird nach dem Drop nicht angenommen.** Seit v1.0.2 erscheint ein
   Toast „Datei abgelehnt" mit Grund. Vorher landeten unter Windows
   manchmal `.csv`-Dateien stillschweigend im Mülleimer, weil Windows den
   MIME-Type `application/vnd.ms-excel` statt `text/csv` liefert — das ist
   jetzt mit abgedeckt.

### Echte Verkaufszeilen werden als „Duplikat" verworfen
Bis v1.0.3 berücksichtigte der UNIQUE-Constraint auf `verkaufspositionen`
**kein Rechnungsdatum**. Bestellte derselbe Kunde an mehreren Tagen
identische Positionen (gleiche Menge, Einheit, Pack-Code, Beschreibung) und
trug die Quelle entweder keine oder sich wiederholende Rechnungsnummern
ein, verwarf der Importer die zweite Zeile stillschweigend.

Ab v1.0.4 ist `rechnungsdatum` Teil des UNIQUE-Schlüssels — gleiche
Position an verschiedenen Tagen wird nun korrekt als zwei Datensätze
behandelt. Beim ersten Start nach dem Update läuft eine automatische
Schema-Migration (siehe CHANGELOG v1.0.4); ein Backup der DB wird zuvor
unter `data/eierverkauf.db.pre-v1.0.4.bak` abgelegt.

**Bereits importierte CSVs neu einspielen:** Die fälschlicherweise
verworfenen Zeilen sind nicht in der Datenbank, sondern nur im
Protokoll archiviert. Auf der Detail-Seite eines Imports
(`/import/:id`) sehen Sie die Rohdaten. Um die Zeilen tatsächlich zu
übernehmen, den Import in der Historie löschen (Mülleimer-Icon) und
dieselbe CSV erneut hochladen.

### Umsatz wird als `0,00 €` angezeigt, obwohl die CSV Werte enthält
Seit v1.0.3 erkennt der Importer Spalten **per Header-Name** (Substring-Match
auf `gesamt`, `nummer`, `menge`, …) statt sie blind positionsbasiert
zuzuordnen. Vorher konnte es passieren, dass die `Gesamt`-Spalte auf einer
falschen Quellspalte landete, wenn die reale CSV eine andere
Spaltenreihenfolge oder weniger Spalten hatte.

Wenn der Umsatz trotzdem `0` ist:
1. Importhistorie öffnen, **auf den Dateinamen klicken** → `/import/:id`
   öffnet die Detail-Seite. Falls eine Amber-Box mit „Spalte ‚Gesamt' nicht
   im Header gefunden" erscheint, fehlt die Spalte tatsächlich in der CSV
   — neuer Export aus dem Warenwirtschaftssystem mit aktiviertem
   Gesamt-Feld nötig.
2. In den Tabs „Fehlerhaft" / „Übersprungen" zeigt die Spalte „Rohdaten"
   die tatsächlich eingelesenen Werte. Wenn `Gesamt`-Werte da stehen, der
   Umsatz aber 0 ist: Bug, bitte melden.

### CSV: meine Datei hat „Eierverkäufe Je Rechnungsposition" als Vorzeile, geht trotzdem nicht
Bis v1.0.1 war die Anzahl der Metazeilen auf genau 7 fest verdrahtet
(entsprechend der ursprünglichen Spec). Die tatsächlich aus dem
Warenwirtschaftssystem kommenden Exporte haben aber 5 Metazeilen + 3 leere
Zeilen, insgesamt also 8. Seit v1.0.2 wird die Kopfzeile **automatisch
gesucht** (über die Schlüsselwörter Datum/Nummer/Kunde/Menge in den ersten
30 Zeilen) — die Anzahl der Metazeilen davor ist egal.

### PowerShell-Fehler "Die Zeichenfolge hat kein Abschlusszeichen"
PowerShell 5.1 (Windows-Standard) liest `.ps1`-Dateien **ohne UTF-8-BOM als
Windows-1252**. Deutsche Umlaute werden dabei zerschossen (`ä` → `Ã¤`), was
String-Terminierungen zerstört.

Die mitgelieferten Scripts haben bereits ein BOM. Falls Sie ein eigenes
`.ps1`-Script mit Umlauten schreiben und denselben Fehler sehen, BOM
nachträglich einfügen:

```powershell
$f = '.\mein-script.ps1'
$bom = New-Object System.Text.UTF8Encoding($true)
$t   = [System.IO.File]::ReadAllText($f, (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText($f, $t, $bom)
```

Alternativ in VS Code: unten rechts in der Statusleiste auf das Encoding
klicken → **„Save with Encoding"** → **UTF-8 with BOM**.

### pip-Upgrade-Fehler: "To modify pip, please run the following command…"
Auf Windows ist `pip.exe` während der Ausführung gesperrt und kann sich
nicht selbst überschreiben. Korrekter Aufruf:

```powershell
.\.venv\Scripts\python.exe -m pip install --upgrade pip
```

Statt:
```powershell
.\.venv\Scripts\pip.exe install --upgrade pip     # FEHLT auf Windows
```

`dev-setup.ps1` ab v1.0.1 verwendet bereits `python -m pip`.

---

## Lizenz / Kontakt

Internes Werkzeug für **Kerba Bio-Ei GbR**.
