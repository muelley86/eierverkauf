# Changelog

Alle wesentlichen Änderungen an der **Eierverkauf-Auswertungs-App** werden hier dokumentiert.

Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

## [1.2.2] - 2026-05-26

### Behoben
- **Shell-Skripte (`eierverkauf-helper.sh`, `install.sh`, `dev-setup.sh`,
  `dev-start.sh`) sind jetzt im Git-Index mit Exec-Bit (`100755`) markiert.**
  Vorher: alle als `100644` committed (Windows-Filemode), wodurch jeder
  `git pull` / `git reset --hard` das `+x`-Bit auf dem Linux-Server entfernte
  und `eierverkauf <command>` mit „Permission denied" abbrach. Die
  Erstinstallation via `install.sh` blieb wegen explizitem `chmod +x` im
  Installer funktionsfähig — der Bug zeigte sich erst beim **zweiten** Update.

### Hinweise zum Update
- **Einmaliger Server-Hotfix nötig**, falls der `eierverkauf`-Befehl bereits
  mit „Permission denied" abbricht — vor dem Update von Hand:
  `chmod 0755 /opt/eierverkauf/eierverkauf-helper.sh`. Anschließend
  `eierverkauf update` aufrufen → ab v1.2.2 sind die Modes dauerhaft korrekt.

## [1.2.1] - 2026-05-26

### Behoben
- **`eierverkauf update` hängt nicht mehr bei 15 %**, wenn git auf eine
  Authentifizierung wartet. `git fetch` bricht jetzt nach 60 s, `git pull`
  nach 120 s mit klarer Fehlermeldung ab. Hintergrund: nach einer kurzen
  Privat-Phase des Repos konnten gecachte oder fehlende Credentials einen
  lautlosen Auth-Prompt auslösen — die whiptail-Pipeline hat keinen TTY,
  also wartete git unendlich.
- **Fehlerdialog im Update zeigt jetzt die letzten 15 Log-Zeilen**, nicht
  nur den Pfad zur Log-Datei. Damit ist der eigentliche Fehler auch ohne
  zusätzliche Shell-Sitzung sichtbar.

### Geändert
- Update-Subshell exportiert `GIT_TERMINAL_PROMPT=0`, `GIT_ASKPASS=/bin/true`
  und `SSH_ASKPASS=/bin/true` — git fragt nie wieder interaktiv nach
  Credentials, sondern failt sauber.

### Hinweise zum Update
- **Erst-Mitigation auf dem Server nötig**, falls das Update bereits
  hängt: gecachte git-Credentials entfernen (`rm -f /root/.git-credentials`)
  und Credential-Helper deaktivieren (`git -C /opt/eierverkauf config
  --unset-all credential.helper`). Dann läuft `eierverkauf update` durch
  und holt v1.2.1, das künftige Hänger verhindert. Details in
  `DEPLOYMENT.md` §11.1.

## [1.2.0] - 2026-05-26

### Hinzugefügt
- **Neuer Menüpunkt „Belege"** zwischen Ranking und Jahresvergleich. Die
  Seite listet alle Rechnungen im gewählten Zeitraum mit aggregierten
  Eiermengen, Umsatz und Anzahl Positionen — eine Zeile je Beleg. Default-
  Sortierung absteigend nach Eieranzahl, freie Textsuche über Beleg-Nr.
  und Kundenname, Pagination wie auf den übrigen Übersichtsseiten.
- **Detail-Dialog je Beleg.** Klick auf eine Zeile öffnet ein Modal mit
  allen Einzelpositionen (Artikel, Beschreibung, Menge + Einheit, Eier,
  Stückpreis, Gesamt). Pack-Code wird beim PACK-Einheiten-Label aufgelöst
  („PACK (10er)" / „PACK (6er)").
- **Excel- und PDF-Export für Belege.** Download-Icon im PageHeader liefert
  dieselbe Tabelle als `.xlsx` (openpyxl, deutsche Zahlenformate) bzw.
  `.pdf` (WeasyPrint, A4 quer).
- **Backend-Endpoints** `GET /api/belege` (Aggregat je Rechnung) und
  `GET /api/belege/{rechnungsnummer}/positionen?datum=YYYY-MM-DD`
  (Einzelpositionen).
- **shadcn-Dialog-Komponente** (`components/ui/dialog.tsx`) — Standard-
  Wrapper um `@radix-ui/react-dialog` mit Warm-Editorial-Tokens (Surface,
  Rule, Manrope). Wiederverwendbar für künftige Modal-Use-Cases.

### Hinweise zum Update
- **Kein Schema-Change.** `verkaufspositionen` enthält bereits alle
  benötigten Felder; die `eierverkauf update`-Routine genügt.
- **API additiv** — bestehende Frontend-Builds sind nicht betroffen, die
  neuen Endpoints liegen unter `/api/belege*` ohne Konflikt zu bestehenden
  Routen.

## [1.1.0] - 2026-05-12

### Hinzugefügt
- **Komplettes UI-Redesign „Warm Editorial".** Neue Sidebar mit Kerba-Logo,
  großzügige Editorial-Typographie (Manrope-Display in 88–112 px für KPIs),
  warme Erdfarben-Palette (Yolk, Sage, Brick, Surface, Rule). Konsistente
  `PageHeader`- und `Panel`-Komponenten über alle Seiten hinweg.
- **Dashboard mit Hero-KPI.** Die Kennzahl „Eier · Stück" füllt eine 8/12-Hero-Karte,
  rechts daneben Umsatz + Kunden + Positionen kompakt. Jede Hauptkarte zeigt
  eine dezente Sparkline aus dem Monatsverlauf in der rechten unteren Ecke.
- **Vorjahresvergleich auf dem Dashboard.** Backend liefert in `/api/dashboard`
  neu `vorjahres_kpis` (Eier/Umsatz/Kunden/Positionen für denselben Zeitraum
  ein Jahr zurück), das Frontend zeigt für jede KPI eine Delta-Pille
  („+12,5 % vs. Vorjahr") in Sage oder Brick.
- **Aktivitäts-Panel** auf dem Dashboard mit den letzten Imports und Klick
  auf das Import-Detail.
- **Globale Zeitraum-Pille** (`ZeitraumFilter`-Komponente) im Header jeder
  Auswertungsseite — erkennt automatisch Quick-Range-Labels wie „Dieser Monat",
  „Letztes Jahr" oder „Eigener Zeitraum" zusätzlich zum Datumsbereich.
- **Dezenter Excel-Export-Knopf** (Download-Icon) im PageHeader für Seiten,
  die einen Direktexport haben.

### Geändert
- **Jahresvergleich-Diagramm:** Zwei nebeneinanderstehende Balken pro Monat
  (Vorjahr grau, aktuelles Jahr in Yolk) statt Bar + Linie. Achsenlinien und
  Tick-Striche entfernt für ruhigeres Bild.
- **Jahresvergleich-Tabelle:** Reduziert auf die wesentlichen Spalten
  `Monat · Vorjahr · Aktuelles Jahr · Δ Stück · Δ %`. Die Umsatz-Spalten
  sind raus — Umsatz-Detail ist auf der Detail-Ansicht des jeweiligen
  Kunden/Artikels besser aufgehoben.
- **Schriftarten umgestellt** von Geist + Instrument Serif auf
  **Manrope** (Display + Body) und **JetBrains Mono** (Mono). Beides offline
  via `@fontsource`, kein CDN-Roundtrip im Browser.
- **Navigation aufgeräumt:** Nummerierung („01 Übersicht / 02 Kunden …")
  entfernt, klare deutsche Labels, Sage-Indikator markiert die aktive Seite.

### Behoben
- **Numerische Spaltensortierung in Tabellen.** In den Übersichten Artikel,
  Kunden und Ranking sortierten Klicks auf die Spaltenköpfe `Menge`, `Eier`,
  `Umsatz` und `Positionen` lexikographisch statt numerisch (Reihenfolge
  `1, 10, 100, 2, 20` statt `1, 2, 10, 20, 100`). Ursache: TanStack Table
  v8 wählte für die Zahlenspalten beim Auto-Detect den
  `alphanumeric`-Sortierer. Fix: explizit `sortingFn: "basic"` an den
  betroffenen Spaltendefinitionen — JS-Number-Vergleich, kein
  String-Cast-Pfad mehr.

### Hinweise zum Update
- **Kein Schema-Change.** Datenbank bleibt unverändert; die normale
  `eierverkauf update`-Routine genügt (mit dem üblichen automatischen
  Pre-Update-Backup).
- **`vorjahres_kpis` ist im API-Schema additiv** (nullable). Bestehende
  Frontend-Builds gegen `/api/dashboard` brechen nicht; ältere Frontends
  ignorieren das neue Feld einfach.
- **Erstes Laden nach Update** dauert pro Browser einmalig etwas länger,
  weil die neuen Manrope-Woff2-Dateien aus dem `dist/`-Asset-Ordner
  ausgeliefert werden (~14 kB je Schnitt). Danach Browser-Cache.

## [1.0.5] - 2026-05-12

### Behoben
- **Zusammenfassungs-Zeilen am Ende der CSV wurden als Fehler gezählt.**
  Jede Exportdatei aus dem Warenwirtschaftssystem endet mit 3–10 Zeilen
  „Gesamtsumme / Saldo / Statistik" ohne Rechnungsdatum. Diese landeten
  bisher als `zeilen_fehlerhaft` im Importprotokoll mit dem Grund
  *„Datum '' nicht erkannt"* — irreführend, weil sie eine erwartete
  Strukturkomponente sind und keine echten Fehler. Der Parser schneidet
  jetzt den DataFrame nach der **letzten Zeile mit parseesbarem Datum**
  ab; alle weiteren Zeilen werden stillschweigend ignoriert. Auf stdout
  erscheint einmalig ein `[parse_csv]`-Log mit der Anzahl ignorierter
  Zeilen für Diagnose-Zwecke.

  Datumsfehler **innerhalb** der Daten-Sektion (z.B. Tippfehler in einer
  mittleren Datenzeile) werden weiterhin korrekt als Fehler protokolliert.

## [1.0.4] - 2026-05-12

### Behoben
- **Wiederkehrende Bestellungen wurden fälschlich als Duplikat verworfen.**
  Der UNIQUE-Constraint auf `verkaufspositionen` enthielt das Rechnungsdatum
  nicht — er lautete bisher
  `UNIQUE(rechnungsnummer, kundennummer, menge, einheit, pack_code, beschreibung)`.
  Bestellt derselbe Kunde an verschiedenen Tagen dieselbe Position
  (identische Menge, Einheit, Pack-Code, Beschreibung) und teilt sich
  ggf. Rechnungsnummern oder hat keine, kollidieren echte Datensätze. Der
  Constraint umfasst nun zusätzlich `rechnungsdatum`:
  `UNIQUE(rechnungsdatum, rechnungsnummer, kundennummer, menge, einheit, pack_code, beschreibung)`.
- **Duplikat-Grund-Anzeige zeigt jetzt das Rechnungsdatum** — die Diagnose
  ist damit auf einen Blick möglich, ohne in die Rohdaten zu schauen.

### Datenmigration
Beim ersten Start nach dem Update führt das Backend automatisch eine
Schema-Migration durch:
1. Die Datei `data/eierverkauf.db` wird nach
   `data/eierverkauf.db.pre-v1.0.4.bak` kopiert (Fallback bei Bedarf).
2. Die Tabelle `verkaufspositionen` wird neu aufgebaut, alle bestehenden
   Zeilen werden 1:1 übernommen, die Indizes neu angelegt.
3. Im Log erscheint ein einmaliger `[migration]`-Eintrag mit der Anzahl
   migrierter Zeilen.

**Wichtig:** Zeilen, die *vor* v1.0.4 fälschlicherweise als Duplikat
verworfen wurden, sind nicht in der Datenbank — sie stehen nur als
Rohdaten in `import_zeilen_protokoll`. Um sie nachzuziehen, betroffene
Importe in der Historie löschen (Mülleimer-Icon) und die CSV erneut
hochladen.

## [1.0.3] - 2026-05-12

### Behoben
- **Umsatz wurde als `0,00 €` angezeigt**, obwohl die CSV Umsatzwerte
  enthielt. Ursache: Der v1.0.2-Parser benannte die ersten 15 Spalten *blind
  positionsbasiert* in kanonische Namen um. Wenn die reale Exportdatei eine
  andere Spaltenreihenfolge oder weniger Spalten hatte, landete die Quelle
  `Gesamt` auf einer falschen Position (oder wurde gar nicht eingelesen) →
  `gesamt = NULL` in der DB → `SUM(gesamt) = 0`. Spalten werden jetzt
  **anhand des Header-Textes** zugeordnet (Substring-Match auf
  `gesamt/datum/menge/…`). Der bisherige Positions-Fallback bleibt nur noch
  für die literalen `#`/`#.1`/`#2`-Spalten (Kundennummer/PackCode) bestehen.
- **Spurious „Übersprungen"-Zähler** verschwinden mit dem Mapping-Fix: Wenn
  `Nummer` (Rechnungsnummer) zuvor auf eine falsche Quelle gemappt war,
  feuerte der UNIQUE-Constraint
  `(rechnungsnummer, kundennummer, menge, einheit, pack_code, beschreibung)`
  fälschlicherweise.

### Hinzugefügt
- **Eigene Detail-Seite `/import/:id`**: Klick auf eine Zeile in der
  Importhistorie (Spalte „Datei") öffnet eine vollständige Diagnose-Ansicht:
  - Übersichts-Card mit Datei, Zeitraum und Zählern.
  - Tab „Fehlerhaft" — pro fehlerhafter Zeile: CSV-Zeilennummer, Grund
    *(z.B. „Datum '05/11/25' nicht erkannt")* und Rohdaten der Zeile.
  - Tab „Übersprungen (Duplikate)" — analog, mit Ausweis der
    UNIQUE-Schlüsselwerte (Rechnungsnummer, Kundennummer, Menge, …).
- **Neue Tabelle `import_zeilen_protokoll`** persistiert alle
  fehlerhaften und übersprungenen Zeilen samt Rohdaten. Idempotent
  angelegt via `CREATE TABLE IF NOT EXISTS`. CASCADE-Delete beim Löschen
  eines Imports.
- **Header-Warnungen** im Importprotokoll: Werden wichtige Spalten
  (`Gesamt`, `Nummer`, `PackCode`) im CSV-Header nicht erkannt, erscheint
  vor dem Fehlerprotokoll eine prominente Amber-Box mit dem konkreten
  Hinweis und den tatsächlich erkannten Header-Namen.
- **Neuer Endpunkt** `GET /api/imports/{id}` liefert
  `{ ..., fehler: [...], duplikat: [...] }`.
- **`ImportErgebnis.header_warnungen: string[]`** im Backend
  (`data/importer.py`) und Frontend (`src/api/client.ts`).

### Geändert
- `parse_csv()` liefert nun zusätzlich die Liste der Header-Warnungen
  zurück (Tuple `(DataFrame, list[str])`). Interne Aufrufer wurden
  angepasst.

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

[Unreleased]: https://example.com/eierverkauf/compare/v1.2.0...HEAD
[1.2.0]: https://example.com/eierverkauf/compare/v1.1.0...v1.2.0
[1.1.0]: https://example.com/eierverkauf/compare/v1.0.5...v1.1.0
[1.0.5]: https://example.com/eierverkauf/compare/v1.0.4...v1.0.5
[1.0.4]: https://example.com/eierverkauf/compare/v1.0.3...v1.0.4
[1.0.3]: https://example.com/eierverkauf/compare/v1.0.2...v1.0.3
[1.0.2]: https://example.com/eierverkauf/compare/v1.0.1...v1.0.2
[1.0.1]: https://example.com/eierverkauf/compare/v1.0.0...v1.0.1
[1.0.0]: https://example.com/eierverkauf/releases/tag/v1.0.0
