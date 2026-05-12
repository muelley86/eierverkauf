# Changelog

Alle wesentlichen Änderungen an der **Eierverkauf-Auswertungs-App** werden hier dokumentiert.

Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

## [1.0.2] - 2026-05-12

### Behoben
- **CSV-Import scheiterte stillschweigend** bei den real verwendeten
  Exportdateien — drei voneinander unabhängige Ursachen, alle gefixt:
  1. **Anzahl der Metazeilen variabel** (Test-Datei: 8 Zeilen vor dem Header
     statt der spezifizierten 7). Hartes `skiprows=7` interpretierte eine
     leere Zeile als Kopfzeile, sämtliche Spalten hießen `Unnamed: N`, jede
     Datenzeile landete als „fehlerhaft". Der Parser sucht jetzt die
     Kopfzeile in den ersten 30 Zeilen automatisch anhand der
     Spaltennamen *Datum/Nummer/Kunde/Menge*.
  2. **Pack-Code-Spalte hieß `#2`** (nicht `#.1` wie spezifiziert). Spalten
     werden jetzt positionsbasiert auf interne kanonische Namen umbenannt
     (`Datum`, `Nummer`, `Kundennummer`, …, `PackCode`, …) — egal wie die
     Header-Bezeichnung in der Quelle aussieht.
  3. **Drag&Drop verwarf .csv-Dateien stillschweigend** unter Windows, weil
     der Browser MIME-Type `application/vnd.ms-excel` (statt `text/csv`)
     liefert. `accept` akzeptiert jetzt mehrere MIME-Varianten, und
     `onDropRejected` zeigt einen Toast statt das Drop einfach zu
     ignorieren.
- **`parse_german_date`** akzeptiert jetzt sowohl `DD.MM.YY` als auch
  `DD.MM.YYYY` (Test-Datei mischt beide Formate).

### Hinzugefügt
- **Detailliertes Fehlerprotokoll** im Import-Dialog: pro fehlerhafte
  Zeile wird Zeilennummer und konkreter Grund angezeigt (z.B.
  *"Zeile 47: Datum '05/11/25' nicht erkannt"*). Bis zu 50 Details werden
  vom Backend zurückgereicht, der Rest nur gezählt.
- **`ImportErgebnis.fehler_details: string[]`** im Backend
  (`data/importer.py`) und Frontend (`src/api/client.ts`).

## [1.0.1] - 2026-05-11

### Behoben
- **`dev-setup.ps1` / `dev-start.ps1`** brachen unter PowerShell 5.1 mit
  Parser-Fehler `Die Zeichenfolge hat kein Abschlusszeichen` ab.
  Ursache: Dateien waren UTF-8 *ohne* BOM, PowerShell 5.1 interpretiert
  diese aber als Windows-1252 und zerschießt damit deutsche Umlaute (`ä` →
  `Ã¤`), wodurch die String-Terminierung bricht. Beide Scripts haben jetzt
  ein UTF-8-BOM (`EF BB BF`) am Dateianfang. Siehe README §Troubleshooting.
- **pip-Upgrade in `dev-setup.ps1`** schlug mit
  `ERROR: To modify pip, please run …` fehl. Auf Windows ist `pip.exe`
  während der Ausführung gesperrt und kann sich nicht selbst überschreiben.
  Lösung: pip wird jetzt über `python -m pip install --upgrade pip`
  aktualisiert (läuft `python.exe`, ersetzt `pip.exe`). `dev-setup.sh`
  nutzt der Konsistenz halber dieselbe Form.

## [1.0.0] - 2026-05-11

### Hinzugefügt
- **Backend** (FastAPI + SQLite, Port 8050)
  - CSV-Import mit Semikolon-Trennzeichen, UTF-8-BOM, 7 Metazeilen.
  - Eiermenge-Berechnung nach Pack-Code 110 (×10) / 111 (×6) / `stk` / `kg`.
  - Artikelnormierung (10er Kvp, 6er Kvp, Lose 180, Lose 20, Lose unsortiert, Gewicht).
  - Duplikatschutz via UNIQUE-Constraint, übersprungene Zeilen werden gezählt.
  - Endpunkte: Dashboard, Kunden, Kundendetail, Artikel, Ranking, Jahresvergleich.
  - Excel-Export (openpyxl) mit deutschen Zahlenformaten und blauer Kopfzeile.
  - PDF-Export (WeasyPrint) mit eingebettetem matplotlib-Diagramm.
- **Frontend** (React 18 + TypeScript, Vite, Recharts, TanStack Table, shadcn/ui)
  - Dashboard mit KPI-Kacheln und Top-5-Drill-Down.
  - Import-Seite mit Drag & Drop, Vorschau, Protokoll, Historie.
  - Kunden-/Artikelübersicht mit sortierbaren, filterbaren Tabellen.
  - Kundendetail mit Monatsverlauf (Balken↔Linie), Jahresvergleich (ComposedChart).
  - Ranking mit horizontalem Balken-Chart (Top 10) + vollständiger Tabelle.
  - Jahresvergleich mit Differenz-Spalte (grün/rot) und Summenzeile.
  - Globaler Zeitraumfilter mit Schnellauswahl (Monat, Quartal, Jahr, Vorjahr).
- **Deployment**
  - Interaktives `install.sh` (whiptail-Dialoge, Gauge-Fortschritt, Reparatur-Erkennung).
  - Systemd-Unit für automatischen Start.
  - Systemweiter `eierverkauf`-Befehl (Status, Update, Backup, Restore, Logs, Deinstall).
- **Entwicklung**
  - Dev-Setup-Scripts für Windows (`dev-setup.ps1`, `dev-start.ps1`) und macOS/Linux.
  - Docker Compose für vollständige Integrationstests inkl. PDF-Export.

[Unreleased]: https://example.com/eierverkauf/compare/v1.0.2...HEAD
[1.0.2]: https://example.com/eierverkauf/compare/v1.0.1...v1.0.2
[1.0.1]: https://example.com/eierverkauf/compare/v1.0.0...v1.0.1
[1.0.0]: https://example.com/eierverkauf/releases/tag/v1.0.0
