# Changelog

Alle wesentlichen Änderungen an der **Eierverkauf-Auswertungs-App** werden hier dokumentiert.

Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

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

[Unreleased]: https://example.com/eierverkauf/compare/v1.0.1...HEAD
[1.0.1]: https://example.com/eierverkauf/compare/v1.0.0...v1.0.1
[1.0.0]: https://example.com/eierverkauf/releases/tag/v1.0.0
