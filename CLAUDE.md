# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projekt

Web-App zur Auswertung von Eierverkäufen für **Kerba Bio-Ei GbR**. FastAPI-Backend + React/Vite-Frontend, SQLite, läuft im Betrieb ohne Internet. Produktiv-Deployment in LXC unter Debian Trixie nach `/opt/eierverkauf/`. UI ist durchgehend **deutsch** — Symbole, Spaltennamen, Logs und Fehlermeldungen sind deutsch zu halten.

`README.md` ist das **Nutzer-Handbuch** (Installation, Helper-Befehl, Troubleshooting). Diese Datei beschränkt sich auf Entwickler-Orientierung.

## Lokale Entwicklung

Setup einmalig:

```powershell
.\dev-setup.ps1        # Windows: legt .venv an, installiert requirements.txt + npm install
bash dev-setup.sh      # macOS/Linux
```

Dev-Server starten (zwei Prozesse, Vite-Proxy `/api` → Backend):

```powershell
.\dev-start.ps1        # öffnet Browser auf http://localhost:5173
bash dev-start.sh
```

Direkter Backend-Start (ohne Frontend, z. B. für Endpoint-Tests):

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8050
```

Frontend isoliert:

```powershell
cd frontend
npm run dev            # Dev-Server auf 5173
npm run build          # tsc -b && vite build → frontend/dist/ (wird von FastAPI gemountet)
```

**Tests:** Keine vorhanden. Falls welche hinzukommen, im Setup `pytest` zu requirements.txt ergänzen.

**Docker** (spiegelt Debian-Produktion, inkl. WeasyPrint-GTK):

```bash
docker compose up --build           # http://localhost:8050
```

**Windows-Spezialfall:** `pip` darf nicht über `pip.exe install --upgrade pip` aktualisiert werden — die exe sperrt sich selbst. Immer `python -m pip ...` benutzen (`dev-setup.ps1` macht das bereits richtig).

## Architektur — was man nicht aus einer Datei sieht

### Request-Pfad

`main.py` mountet Router unter `/api/*` **vor** dem StaticFiles-Mount auf `/`. Im Produktiv-Build liefert FastAPI `frontend/dist/` aus; im Dev läuft Vite separat und proxy-t `/api/*` zu uvicorn (siehe `frontend/vite.config.ts`). CORS ist nur für `localhost:5173` offen — in Produktion irrelevant.

### Datenschicht (`data/`)

- `db.py`: SQLite-Pfad steuerbar über `EIERVERKAUF_DB`, sonst `data/eierverkauf.db` relativ zum Repo. `init_db()` läuft beim Lifespan-Startup und ist idempotent.
- **Schema-Migration ab v1.0.4** (in `_migrate_unique_constraint`): UNIQUE-Constraint auf `verkaufspositionen` enthält jetzt `rechnungsdatum`. SQLite kann Constraints nicht in-place ändern → Rebuild via temporärer Tabelle, automatisches DB-Backup nach `data/eierverkauf.db.pre-v1.0.4.bak`. Wenn `SCHEMA_SQL` und der Migrations-`CREATE`-Block geändert werden, **müssen beide synchron bleiben** (Kommentar markiert die Stelle).
- `importer.py` ist die einzige Komplexitäts-Konzentration im Backend — siehe nächster Abschnitt.
- `queries.py` ist reine SQL-Schicht ohne ORM. Zeitraumfilter via `_zeitraum_filter(von, bis, prefix=…)` — `prefix` muss `WHERE` oder `AND` sein je nachdem, ob schon eine WHERE-Klausel existiert.

### CSV-Importer (`data/importer.py`) — kritische Invarianten

Der Importer ist **drei Stufen robust** und Tests/Patches dürfen diese Reihenfolge nicht durcheinanderbringen:

1. **Header-Zeile wird gesucht, nicht angenommen.** `_finde_header_zeile()` durchsucht die ersten 30 Zeilen nach gleichzeitigem Vorkommen von `datum`/`nummer`/`kunde`/`menge` (case-insensitive). Die alte `skiprows=7`-Annahme aus der ursprünglichen Spec ist seit v1.0.2 falsch.
2. **Spalten werden per Header-Name zugeordnet** (`_zuordne_spalten`, `HEADER_PATTERNS`). Reihenfolge in `HEADER_PATTERNS` ist **Priorität** — spezifischere kanonische Namen vor allgemeineren (z. B. `Kundennummer` vor `Nummer` vor `Kunde`), sonst beansprucht das Substring-Matching die falsche Spalte. Literale `#`-Spalten (Pandas-Duplikat-Suffixe `#.1`, `#2`) werden vor dem Substring-Match positionsbasiert behandelt: 1. `#` = Kundennummer, 2. `#` = PackCode.
3. **`REQUIRED_CANONICALS` fehlend → ValueError mit konkreter Diagnose; `WICHTIGE_CANONICALS` fehlend → Warnung in `header_warnungen[]`** (im Frontend als Amber-Box auf `/import/:id` sichtbar).

Weitere Eigenheiten:

- `parse_csv()` schneidet **Trailing-Zeilen nach der letzten gültigen Datums-Zeile ab** (Saldo/Gesamtsumme im Warenwirtschafts-Export). Ohne dieses Trimming werden sie fälschlich als „fehlerhaft" gezählt.
- Pro übersprungene oder fehlerhafte CSV-Zeile wird ein Eintrag in `import_zeilen_protokoll` persistiert (CSV-Zeilennummer, Grund, Rohdaten) — auf `/import/:id` einsehbar. **Die ersten 50 Fehler** wandern zusätzlich direkt in die Upload-Response (`fehler_details[]`) für die Toast-Anzeige.
- `berechne_eier()` ist domänenkritisch:
  - `PACK` + `pack_code=110` → `menge × 10` (10er-Verpackung)
  - `PACK` + `pack_code=111` → `menge × 6` (6er-Verpackung)
  - `stk` oder leer → `menge × 1`
  - `kg` → `None` (keine Stückzahl-Aussage)
- `normiere_artikel()` mappt auf einen festen Satz: `10er Kvp`, `6er Kvp`, `Gewicht (kg)`, `Lose 180`, `Lose 20`, `Lose unsortiert`, `Sonstige`. Alle Auswertungen aggregieren auf `artikel_code` — bei Änderungen am Mapping ändern sich Bestandsauswertungen.
- **UNIQUE-Schlüssel ab v1.0.4:** `(rechnungsdatum, rechnungsnummer, kundennummer, menge, einheit, pack_code, beschreibung)`. Duplikat-Treffer → `INSERT OR IGNORE` zählt als „übersprungen", kein Fehler.
- Deutsche Zahlenformate: `parse_german_number("1.080,000")` → `1080.0`. Datum: `parse_german_date` akzeptiert `DD.MM.YY` **und** `DD.MM.YYYY`, zweistellige Jahre werden immer als 20YY interpretiert.
- **Kundennummern original belassen** (`15.100.008` ≠ `15100008`) — als Text speichern, keine Punkte entfernen.

### Frontend (`frontend/src/`)

- `context/ZeitraumContext.tsx` ist der **globale Zeitraumfilter** — alle Auswertungs-Seiten lesen daraus und triggern API-Calls bei Änderung. Wenn neue Auswertungs-Seiten dazukommen, müssen sie den Context konsumieren, nicht eigene State-Variablen halten.
- `api/client.ts` ist **strikt typisiert ohne `any`** — alle API-Response-Shapes als Interfaces. Neue Endpoints kommen mit ihren Typen hierher.
- `lib/formatierung.ts` ist die einzige Quelle für deutsche Zahl-, Datums- und Währungsformatierung. Keine inline-`toLocaleString`-Aufrufe in Components.
- `components/ui/` enthält shadcn/ui-generierte Komponenten — bei Updates über die shadcn-CLI regenerieren, nicht von Hand patchen.
- Charts: Recharts mit `ResponsiveContainer`, `Brush` für Zoom, Standard-Farben **Eier `#2563eb`, Umsatz `#16a34a`, Vorjahr `#94a3b8`** (Konsistenz über alle Seiten).

### Export (`export/`)

- `excel_export.py`: openpyxl. Titelzeile „Kerba Bio-Ei GbR" + Zeitraum, dunkelblauer Header.
- `pdf_export.py`: WeasyPrint. **Auf Windows lokal oft kaputt** (GTK fehlt) → der Endpoint fängt `OSError` und liefert 500 mit klarem Hinweis. PDF-Tests am besten in Docker.

## Versions- und Release-Hygiene

- `VERSION` enthält ausschließlich die Versionsnummer (aktuell `1.0.5`). Helper-Script liest sie für die Statusanzeige.
- `CHANGELOG.md` im Keep-a-Changelog-Format. Bei Bugfixes mit Schema-Auswirkung **Migration in `data/db.py` ergänzen** und CHANGELOG-Eintrag verlinkt halten (Beispiel: v1.0.4-Migration ist im README-Troubleshooting referenziert).
- `main.py:version` ist im FastAPI-Konstruktor noch hartcodiert auf `"1.0.0"` — kein funktionaler Bug, aber bei nächster Version mitziehen oder aus `VERSION` lesen.

## Deployment

Produktivumgebung wird durch `install.sh` aufgesetzt und durch `eierverkauf-helper.sh` (Symlink `/usr/local/bin/eierverkauf`) gepflegt. Details: README → „Erstinstallation" und „Der `eierverkauf`-Befehl". Update-Pipeline macht automatisches Pre-Update-Backup mit Rollback bei Fehler — die Backup-Logik liegt im Helper-Script, nicht in der App.
