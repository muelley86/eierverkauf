# Eierverkauf-Auswertungs-App

## Projektübersicht

Moderne Web-Applikation zur Auswertung von Eierverkäufen, gehostet in einem LXC-Container unter **Debian Trixie**. Zugriff per IP-Adresse im lokalen Netzwerk. CSV-Dateien werden per Browser-Upload importiert, Exporte (Excel, PDF) als Browser-Download bereitgestellt. Daten werden dauerhaft in SQLite gesammelt für Auswertungen über beliebige Zeiträume.

Die App muss **im Betrieb ohne Internetverbindung** funktionieren. Alle Abhängigkeiten werden beim Installieren heruntergeladen und lokal gebündelt.

---

## Tech-Stack

### Backend
- **Python 3.12+** mit **FastAPI** (REST API)
- **SQLite** (lokale Datenbank)
- **pandas** (CSV-Verarbeitung)
- **openpyxl** (Excel-Export)
- **WeasyPrint** (PDF-Export)
- **Uvicorn** (ASGI-Server, Port `8050`)

### Frontend
- **React 18** mit **TypeScript**
- **Vite** (Build-Tool, nur beim Installieren/Updaten)
- **Recharts** (interaktive Diagramme)
- **TanStack Table v8** (sortierbare, filterbare, paginierte Tabellen)
- **React Router v6** (clientseitige Navigation)
- **shadcn/ui + Tailwind CSS** (UI-Komponentensystem)
- **Axios** (API-Requests)
- **date-fns** (Datumsformatierung, Deutsch)

Das Frontend wird mit `npm run build` einmalig gebaut. FastAPI liefert `dist/` als statische Dateien aus. Im Betrieb ist **kein Node.js** erforderlich.

---

## Deployment-Umgebung

- **OS**: Debian Trixie (13) in LXC-Container
- **Python**: System-Python 3.12, venv unter `/opt/eierverkauf/venv`
- **App-Verzeichnis**: `/opt/eierverkauf/`
- **Frontend-Source**: `/opt/eierverkauf/frontend/`
- **Frontend-Build**: `/opt/eierverkauf/frontend/dist/`
- **Datenbank**: `/opt/eierverkauf/data/eierverkauf.db`
- **Uploads (temporär)**: `/opt/eierverkauf/uploads/`
- **Port**: `8050`
- **Systemd-Unit**: `/etc/systemd/system/eierverkauf.service`
- **Systemweiter Befehl**: `/usr/local/bin/eierverkauf` (Symlink auf Helper Script)

---

## Helper Script (`eierverkauf-helper.sh`)

Das zentrale Verwaltungs-Script wird unter `/opt/eierverkauf/eierverkauf-helper.sh` abgelegt und über einen Symlink systemweit als `eierverkauf` verfügbar gemacht:

```bash
ln -sf /opt/eierverkauf/eierverkauf-helper.sh /usr/local/bin/eierverkauf
chmod +x /usr/local/bin/eierverkauf
```

### Aufruf-Varianten

```bash
eierverkauf           # Interaktives Menü starten
eierverkauf update    # Direkt Update ausführen (kein Menü)
eierverkauf status    # Direkt Status anzeigen
eierverkauf logs      # Direkt Logs anzeigen
```

### Interaktives Menü — Aussehen

Das Menü wird mit `whiptail` (auf Debian vorinstalliert) als TUI-Dialog dargestellt:

```
┌─────────────────────────────────────────┐
│   Eierverkauf App — Verwaltung          │
│   Version: 1.0.0  Status: ● Aktiv      │
├─────────────────────────────────────────┤
│                                         │
│  1) Status anzeigen                     │
│  2) Update durchführen                  │
│  3) App neu starten                     │
│  4) App stoppen                         │
│  5) App starten                         │
│  6) Logs anzeigen (live)                │
│  7) Datenbank-Backup erstellen          │
│  8) Backup wiederherstellen             │
│  9) Deinstallieren                      │
│  0) Beenden                             │
│                                         │
└─────────────────────────────────────────┘
```

### Menüpunkte — Verhalten

#### 1) Status anzeigen
Zeigt in einer Infobox:
- Systemd-Service-Status (aktiv/inaktiv + Uptime)
- App-Version (aus `/opt/eierverkauf/VERSION`)
- Port und URL (`http://<IP>:8050`)
- Datenbankgröße
- Anzahl importierter Datensätze (SQL: `SELECT COUNT(*) FROM verkaufspositionen`)
- Letzter Import (Datum + Dateiname)
- Speicherplatz `/opt/eierverkauf/`

#### 2) Update durchführen
Vollautomatischer Update-Ablauf mit Fortschrittsanzeige (`whiptail --gauge`):

```
[  5%] Aktuelle Version prüfen...
[ 10%] Git-Repository aktualisieren (git pull)...
[ 25%] Python-Abhängigkeiten aktualisieren...
[ 40%] Node.js-Abhängigkeiten aktualisieren...
[ 60%] Frontend neu bauen (npm run build)...
[ 80%] Datenbank-Migrationen prüfen...
[ 90%] Dienst neu starten...
[100%] Update abgeschlossen!
```

- Vor dem Update: automatisches Datenbank-Backup nach `/opt/eierverkauf/backups/`
- Bei Fehler: Rollback auf vorherige Version, Backup wiederherstellen, Fehlermeldung anzeigen
- Nach dem Update: neue Version und Changelog anzeigen (aus `CHANGELOG.md`)
- Auch aufrufbar als: `eierverkauf update` (ohne Menü, für Cron/Automatisierung)

#### 3) App neu starten
```bash
systemctl restart eierverkauf
```
Bestätigung abfragen, dann ausführen, Status danach anzeigen.

#### 4/5) App stoppen / starten
```bash
systemctl stop eierverkauf
systemctl start eierverkauf
```
Jeweils mit Bestätigungsdialog.

#### 6) Logs anzeigen (live)
```bash
journalctl -u eierverkauf -f --no-pager
```
Öffnet Live-Log in `whiptail --scrolltext` oder direkt im Terminal (Ctrl+C zum Beenden).

#### 7) Datenbank-Backup erstellen
- Backup-Datei: `/opt/eierverkauf/backups/eierverkauf_YYYY-MM-DD_HH-MM.db`
- Verwendet SQLite `VACUUM INTO` für konsistentes Backup ohne App-Stopp
- Zeigt nach Abschluss Dateipfad und Größe an
- Behält automatisch nur die letzten 10 Backups (älteste löschen)

#### 8) Backup wiederherstellen
- Listet verfügbare Backups mit Datum und Größe in `whiptail --menu`
- Bestätigung abfragen (Warnung: aktuelle Daten werden überschrieben)
- App stoppen → Backup einspielen → App starten

#### 9) Deinstallieren
- Doppelte Bestätigung (zwei whiptail-Dialoge)
- Stopp und Deaktivierung des Systemd-Service
- Entfernung von `/opt/eierverkauf/` und `/usr/local/bin/eierverkauf`
- Optionale Frage: Datenbank-Backup vor Löschung erstellen?

### Fehlerbehandlung im Helper Script

- Jede kritische Operation in `set -e` mit `trap ERR`
- Fehlermeldungen als `whiptail --msgbox` mit konkretem Fehlertext
- Logs bei Fehlern nach `/var/log/eierverkauf-helper.log` schreiben
- Bei fehlgeschlagenem Update: automatischer Rollback

---

## Installationsskript (`install.sh`)

Wird einmalig als root ausgeführt. Startet das Helper Script danach automatisch im Menü.

```bash
#!/bin/bash
set -e

# Farben für Terminal-Output
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  Eierverkauf App — Installation      ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
```

### Ablauf

1. Root-Check (`if [ "$EUID" -ne 0 ]`)
2. Systempakete: `apt-get update && apt-get install -y python3 python3-venv python3-pip git whiptail libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b libfontconfig1`
3. Node.js 20 LTS via NodeSource: `curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs`
4. System-User `eierverkauf` anlegen (kein Login-Shell): `useradd -r -s /usr/sbin/nologin -d /opt/eierverkauf eierverkauf`
5. Verzeichnisse: `/opt/eierverkauf/{data,uploads,backups,logs}`
6. Python venv + `requirements.txt` installieren
7. `cd frontend && npm install && npm run build`
8. Symlink: `ln -sf /opt/eierverkauf/eierverkauf-helper.sh /usr/local/bin/eierverkauf`
9. Systemd-Service installieren und aktivieren
10. Berechtigungen: `chown -R eierverkauf:eierverkauf /opt/eierverkauf`
11. Abschlussmeldung mit URL und Hinweis auf `eierverkauf`-Befehl

---

## Systemd-Service

```ini
[Unit]
Description=Eierverkauf Auswertungs-App
After=network.target

[Service]
Type=simple
User=eierverkauf
WorkingDirectory=/opt/eierverkauf
ExecStart=/opt/eierverkauf/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8050
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

---

## VERSION und CHANGELOG

- `/opt/eierverkauf/VERSION` — enthält nur die Versionsnummer, z.B. `1.0.0`
- `/opt/eierverkauf/CHANGELOG.md` — Changelog im Keep-a-Changelog-Format
- Das Helper Script liest `VERSION` für die Statusanzeige und zeigt nach einem Update den neuesten Changelog-Eintrag an

---

## CSV-Import-Spezifikation

### Dateiformat
- Trennzeichen: Semikolon (`;`)
- Encoding: UTF-8 mit BOM (`utf-8-sig`)
- Erste 7 Zeilen Metadaten → `skiprows=7`
- Zeile 8 ist die Kopfzeile:

```
Datum | Nummer | # | Kunde | Mitarbeiter | Menge | Einheit | #.1 | Beschreibung | Preis/Einh. | Mwst. | Diesel/Einh. | Rabatt Rg. | Rabatt Pos. | Gesamt
```

### Relevante Spalten

| Spalte | Inhalt |
|---|---|
| `Datum` | Rechnungsdatum `DD.MM.YY` |
| `#` (Index 2) | Kundennummer |
| `Kunde` | Kundenname |
| `Menge` | Deutsches Zahlenformat (`1.080,000` → `1080.0`) |
| `Einheit` | `stk`, `PACK`, `kg` oder leer |
| `#.1` (Index 7) | Pack-Code: `110` oder `111` |
| `Beschreibung` | Artikelbezeichnung (wird normiert) |
| `Preis/Einh.` | Deutsches Dezimalformat |
| `Gesamt` | Deutsches Dezimalformat |

### Eiermenge-Berechnung (kritisch)

```python
def berechne_eier(menge: float, einheit: str, pack_code: int | None) -> int | None:
    """
    PACK 110 → Menge × 10   (10er-Verpackung)
    PACK 111 → Menge × 6    (6er-Verpackung)
    stk      → Menge × 1
    kg       → None

    Beispiele:
      180 PACK 110 → 1.800 Eier
      90  PACK 111 → 540 Eier
      360 stk      → 360 Eier
    """
    if einheit == 'PACK':
        if pack_code == 110:
            return int(menge * 10)
        elif pack_code == 111:
            return int(menge * 6)
        else:
            return None
    elif einheit == 'stk':
        return int(menge)
    elif einheit == 'kg':
        return None
    else:
        return int(menge)
```

### Artikelnormierung

| Bedingung | Artikel-Code |
|---|---|
| Pack-Code `110` | `10er Kvp` |
| Pack-Code `111` | `6er Kvp` |
| `stk` + `180 lose` in Beschreibung | `Lose 180` |
| `stk` + `20` in Beschreibung (ohne 180) | `Lose 20` |
| `stk` + `unsortiert` in Beschreibung | `Lose unsortiert` |
| `kg` | `Gewicht (kg)` |

Größe (S/M/L/XL) per Regex extrahieren → Feld `groesse`.

---

## Datenbankschema (SQLite)

```sql
CREATE TABLE IF NOT EXISTS imports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    import_datum TEXT NOT NULL,
    dateiname TEXT NOT NULL,
    datumsbereich TEXT,
    zeilen_importiert INTEGER DEFAULT 0,
    zeilen_uebersprungen INTEGER DEFAULT 0,
    zeilen_fehlerhaft INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS verkaufspositionen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    import_id INTEGER REFERENCES imports(id) ON DELETE CASCADE,
    rechnungsdatum TEXT NOT NULL,
    rechnungsnummer TEXT,
    kundennummer TEXT NOT NULL,
    kundenname TEXT NOT NULL,
    menge REAL NOT NULL,
    einheit TEXT,
    pack_code INTEGER,
    eier_stueck INTEGER,
    artikel_code TEXT,
    groesse TEXT,
    beschreibung TEXT,
    preis_einheit REAL,
    gesamt REAL,
    UNIQUE(rechnungsnummer, kundennummer, menge, einheit, pack_code, beschreibung)
);

CREATE INDEX IF NOT EXISTS idx_datum   ON verkaufspositionen(rechnungsdatum);
CREATE INDEX IF NOT EXISTS idx_kunde   ON verkaufspositionen(kundennummer);
CREATE INDEX IF NOT EXISTS idx_artikel ON verkaufspositionen(artikel_code);
```

---

## API-Endpunkte (FastAPI)

```
POST   /api/import                             # CSV hochladen, importieren
GET    /api/import/preview                     # Vorschau erste 10 Zeilen
GET    /api/imports                            # Importhistorie
DELETE /api/imports/{id}                       # Import löschen (CASCADE)

GET    /api/dashboard?von=&bis=                # KPIs + Top-5
GET    /api/kunden?von=&bis=                   # Kundenübersicht
GET    /api/kunden/{nr}/monate?von=&bis=       # Monatsverlauf eines Kunden
GET    /api/kunden/{nr}/jahresvergleich?jahr=  # Jahresvergleich eines Kunden
GET    /api/artikel?von=&bis=                  # Artikelübersicht
GET    /api/artikel/{code}/monate?von=&bis=    # Monatsverlauf eines Artikels
GET    /api/ranking?von=&bis=&sort=menge       # Top-Kunden (sort=menge|umsatz)
GET    /api/jahresvergleich?jahr=              # Gesamter Jahresvergleich

GET    /api/export/excel?typ=&von=&bis=        # Excel-Download
GET    /api/export/pdf?typ=&von=&bis=          # PDF-Download
```

---

## Frontend (React + TypeScript)

### Routen
```
/                → Dashboard
/import          → CSV-Import
/kunden          → Kundenübersicht
/kunden/:nr      → Kundendetail
/artikel         → Artikelübersicht
/artikel/:code   → Artikeldetail
/ranking         → Top-Kunden-Ranking
/jahresvergleich → Jahresvergleich
```

### Globaler Zeitraumfilter
- Von/Bis DatePicker + Schnellauswahl: Dieser Monat / Dieses Quartal / Dieses Jahr / Letztes Jahr
- State im `ZeitraumContext`, alle Seiten reagieren automatisch

### Seiten

**Dashboard**: KPI-Kacheln (Gesamteier, Umsatz, Kunden, Positionen) + Top-5-Charts, Klick → Drill-Down

**Kundenübersicht**: TanStack Table (sort, filter, paginate), Klick → Detail

**Kundendetail**: Monatsverlauf mit Brush-Zoom, Balken↔Linie-Toggle, Jahresvergleich-Tab, Tabelle, Export-Button

**Artikelübersicht**: TanStack Table, Klick → Detail

**Artikeldetail**: Monatsverlauf mit Brush-Zoom, Balken↔Linie-Toggle, Tabelle, Export-Button

**Ranking**: Horizontales Balkenchart Top-10, Ranglisten-Tabelle (sort Menge/Umsatz), Klick → Drill-Down

**Jahresvergleich**: ComposedChart (Balken Jahr X + Linie Jahr X-1), Tabelle mit Differenz (grün/rot)

**Import**: Drag & Drop Zone (react-dropzone), Vorschau-Tabelle, Importprotokoll, Importhistorie mit Löschen

### Recharts-Standard für alle Zeitreihencharts
- `<ResponsiveContainer width="100%" height={350}>`
- `<Brush dataKey="monat" height={20}>` (Zoom)
- Tooltip: deutsche Zahlenformate
- Farben: Eier `#2563eb`, Umsatz `#16a34a`, Vorjahr `#94a3b8`
- Balken↔Linie ohne API-Call via lokalem State

---

## Export

**Excel (openpyxl)**: Titelzeile "Kerba Bio-Ei GbR" + Zeitraum, Kopfzeile dunkelblau/weiß, Zahlenformate, auto Spaltenbreiten

**PDF (WeasyPrint)**: HTML-Template, Tabelle + matplotlib-Chart als eingebettetes PNG

Dateinamen: `eierverkauf_{typ}_{von}_{bis}.xlsx/.pdf`

---

## Entwicklungshinweise

- Zahlen: `float(s.replace('.', '').replace(',', '.'))`
- Datum: `datetime.strptime(d, '%d.%m.%y')` → `YYYY-MM-DD`
- Kundennummern original belassen (`15.100.008` ≠ `15100080`)
- CSV nach Import löschen
- DB-Operationen in Transaktionen
- `app.mount("/", StaticFiles(...), name="static")` **nach** allen API-Routern
- Vite proxy für Entwicklung: `/api` → `http://localhost:8050`

---

## Projektstruktur

```
/opt/eierverkauf/
├── main.py
├── api/
│   ├── import_router.py
│   ├── auswertung_router.py
│   └── export_router.py
├── data/
│   ├── db.py
│   ├── importer.py
│   └── queries.py
├── export/
│   ├── excel_export.py
│   └── pdf_export.py
├── utils/
│   └── formatierung.py
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/client.ts
│       ├── components/
│       │   ├── Layout.tsx
│       │   ├── KPICard.tsx
│       │   ├── ChartToggle.tsx
│       │   └── DataTable.tsx
│       ├── pages/
│       │   ├── Dashboard.tsx
│       │   ├── Import.tsx
│       │   ├── Kunden.tsx
│       │   ├── KundenDetail.tsx
│       │   ├── Artikel.tsx
│       │   ├── ArtikelDetail.tsx
│       │   ├── Ranking.tsx
│       │   └── Jahresvergleich.tsx
│       ├── context/
│       │   └── ZeitraumContext.tsx
│       └── lib/
│           └── formatierung.ts
├── backups/                        # Datenbank-Backups
├── uploads/                        # Temporäre CSV-Uploads
├── data/
│   └── eierverkauf.db
├── eierverkauf-helper.sh           # Helper Script (Menü + Update)
├── install.sh                      # Erstinstallation
├── requirements.txt
├── VERSION                         # z.B. "1.0.0"
├── CHANGELOG.md
└── README.md
```

---

## requirements.txt

```
fastapi>=0.111
uvicorn[standard]>=0.29
pandas>=2.2
openpyxl>=3.1
weasyprint>=61
python-multipart>=0.0.9
aiosqlite>=0.20
matplotlib>=3.8
```

## package.json (Kern-Dependencies)

```json
{
  "dependencies": {
    "react": "^18.3",
    "react-dom": "^18.3",
    "react-router-dom": "^6.23",
    "recharts": "^2.12",
    "@tanstack/react-table": "^8.17",
    "axios": "^1.7",
    "react-dropzone": "^14.2",
    "date-fns": "^3.6",
    "clsx": "^2.1",
    "lucide-react": "^0.383"
  },
  "devDependencies": {
    "@types/react": "^18.3",
    "@types/react-dom": "^18.3",
    "@vitejs/plugin-react": "^4.3",
    "autoprefixer": "^10.4",
    "postcss": "^8.4",
    "tailwindcss": "^3.4",
    "typescript": "^5.4",
    "vite": "^5.2"
  }
}
```

shadcn/ui-Komponenten: `button card table tabs toast skeleton badge`
