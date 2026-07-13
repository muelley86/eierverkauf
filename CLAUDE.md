# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projekt

Web-App zur Auswertung von Eierverkäufen für **Kerba Bio-Ei GbR**. FastAPI-Backend + React/Vite-Frontend, SQLite, läuft im Betrieb ohne Internet. Produktiv-Deployment in LXC unter Debian Trixie nach `/opt/eierverkauf/`. UI ist durchgehend **deutsch** — Symbole, Spaltennamen, Logs und Fehlermeldungen sind deutsch zu halten.

`README.md` ist die **Kurz-Referenz**. Das vollständige Server-Admin-Handbuch (Erstinstallation, Updates, Backup, Restore, Reverse-Proxy, Troubleshooting) liegt in `DEPLOYMENT.md`. Diese Datei beschränkt sich auf Entwickler-Orientierung.

Repository: <https://github.com/muelley86/eierverkauf> (öffentlich). Production-Updates erwartet `eierverkauf update`, das `git pull --ff-only origin main` macht — ein Push auf main wirkt sich also direkt aufs nächste Update aus. Tag-Konvention `v<MAJOR>.<MINOR>.<PATCH>` für reproduzierbare Server-Pinns.

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
- **Schema-Migration ab v1.13.0** (in `_migrate_key_lauf`, gleiches Rebuild-Muster): ersetzt den Inline-UNIQUE durch die Spalte `key_lauf` + UNIQUE-Index `ux_vkp_dedup`; Bestandszeilen werden je Duplikat-Schlüssel per `ROW_NUMBER` durchnummeriert, Backup nach `….pre-v1.13.0.bak` (inkl. `wal_checkpoint(TRUNCATE)` vor der Datei-Kopie — sonst fehlt der Kopie ungecheckpointeter WAL-Inhalt).
- `importer.py` ist die einzige Komplexitäts-Konzentration im Backend — siehe nächster Abschnitt.
- `queries.py` ist reine SQL-Schicht ohne ORM. Zeitraumfilter via `_zeitraum_filter(von, bis, prefix=…)` — `prefix` muss `WHERE` oder `AND` sein je nachdem, ob schon eine WHERE-Klausel existiert.
- **Vorjahres-Vergleichsmuster** (seit v1.1.0): `/api/dashboard` liefert zusätzlich `vorjahres_kpis: DashboardKPIs | null` für denselben Zeitraum exakt 12 Monate zurückversetzt (`_ein_jahr_zurueck`-Helper in `api/auswertung_router.py`). Frontend nutzt das für Delta-Pillen. Das Feld ist **nullable und additiv** — ältere Frontend-Builds brechen nicht, weil sie es einfach ignorieren. Pattern für künftige Vergleichs-Endpoints: nullable Vorjahres-Sektion in die Response, nicht neue Endpoints.
- **Netto-Semantik** (wichtig für Beleg-Abgleiche): Retouren/Gutschriften stehen als **negative Positionen** (`menge`/`eier_stueck`/`gesamt` < 0) in `verkaufspositionen` — alle `SUM`-Aggregate sind daher Netto. Brutto-Reports der Warenwirtschaft liegen in Retouren-Monaten darüber; das ist kein Fehler (DEPLOYMENT.md §11.14). `dashboard_kpis()` weist seit v1.14.0 zusätzlich `brutto_eier`/`retouren_eier`/`brutto_umsatz`/`retouren_umsatz` aus (Invariante: `brutto + retouren = netto`); das Dashboard zeigt daraus eine Unterzeile, nur wenn Retouren ≠ 0.

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
- `normiere_artikel()` mappt auf einen festen Satz: `10er Kvp`, `10er Kvp (stk)`, `6er Kvp`, `6er Kvp (stk)`, `Gewicht (kg)`, `Lose 180`, `Lose 20`, `Lose unsortiert`, `Sonstige`. Kvp-Artikel sind seit v1.5.0 nach Abrechnungsart getrennt: PackCode 110/111 + Einheit PACK → Basis-Code, sonst (stk/leer) → `(stk)`-Suffix. Alle Auswertungen aggregieren auf `artikel_code` — bei Änderungen am Mapping ändern sich Bestandsauswertungen (dann Startup-Migration in `data/db.py` ergänzen, Muster `_migriere_stk_artikel_codes`).
- **Duplikat-Erkennung ab v1.13.0:** UNIQUE-Index `ux_vkp_dedup` über `(rechnungsdatum, rechnungsnummer, kundennummer, menge, einheit, pack_code, beschreibung, key_lauf)` mit **COALESCE-Normalisierung** — ein Inline-Constraint würde Zeilen mit NULL-Feldern (z. B. ohne Pack-Code) nie deduplizieren, weil SQLite NULLs in UNIQUE als paarweise verschieden behandelt. `key_lauf` nummeriert identische Vorkommen innerhalb einer Datei (n-tes identisches Vorkommen = n), damit echte Doppel-Positionen einer Rechnung importierbar bleiben und Re-Imports trotzdem idempotent sind. **Der Zähler-Schlüssel in `import_csv()` muss exakt der COALESCE-Normalisierung des Index entsprechen** (`None` → `''` bzw. `-1` bei `pack_code`). Duplikat-Treffer → `INSERT OR IGNORE` zählt als „übersprungen", kein Fehler.
- Deutsche Zahlenformate: `parse_german_number("1.080,000")` → `1080.0`. Datum: `parse_german_date` akzeptiert `DD.MM.YY` **und** `DD.MM.YYYY`, zweistellige Jahre werden immer als 20YY interpretiert.
- **Kundennummern original belassen** (`15.100.008` ≠ `15100008`) — als Text speichern, keine Punkte entfernen.

### Frontend (`frontend/src/`)

- `context/ZeitraumContext.tsx` ist der **globale Zeitraumfilter** — alle Auswertungs-Seiten lesen daraus und triggern API-Calls bei Änderung. Wenn neue Auswertungs-Seiten dazukommen, müssen sie den Context konsumieren, nicht eigene State-Variablen halten.
- `api/client.ts` ist **strikt typisiert ohne `any`** — alle API-Response-Shapes als Interfaces. Neue Endpoints kommen mit ihren Typen hierher.
- `lib/formatierung.ts` ist die einzige Quelle für deutsche Zahl-, Datums- und Währungsformatierung. Keine inline-`toLocaleString`-Aufrufe in Components. `formatCentJeEi(umsatz, eier)` liefert Umsatz je Ei in Cent („24,8 ct") bzw. „—" ohne Eier-Stückzahl. `formatBruttoRetouren(brutto, retouren, formatter)` baut die Dashboard-Unterzeile „Verkauft … · Retouren …" und liefert `null` ohne Retouren (Karte bleibt dann unverändert).
- `lib/artikel.ts` → `artikelLabel(code)` ist das **Anzeige-Label** für Artikel-Codes (Einheit in Klammern, z. B. „10er Kvp (PACK)", „Lose 180 (stk)"). Überall verwenden, wo Artikelnamen gerendert werden; Routen/API nutzen weiter den rohen `artikel_code`. Das Mapping muss synchron zu `normiere_artikel()` in `data/importer.py` bleiben.
- Frontend-Unit-Tests laufen mit **Vitest** (`npm run test`, Dateien `src/**/*.test.ts`) — pure Helper testen, kein jsdom-Setup vorhanden.
- `components/ui/` enthält shadcn/ui-generierte Komponenten — bei Updates über die shadcn-CLI regenerieren, nicht von Hand patchen.

**Design-System „Warm Editorial" (seit v1.1.0):**

- **Schriften**: `Manrope` (Display + Body) und `JetBrains Mono` (tabular nums, Monospace). Beides offline via `@fontsource` in `main.tsx` geladen — kein CDN-Roundtrip im Browser. Bei Schrift-Änderungen `main.tsx` + `index.css` (`--font-display`, `--font-body`, `--font-mono`) + `tailwind.config.ts` (`fontFamily.display/body/mono`) **synchron** halten.
- **Farbpalette** (Tokens in `tailwind.config.ts` + HSL-Varianten in `index.css`):
  - `yolk #D69826` — Primärakzent, Eier-Diagramme, aktive Pillen
  - `sage #5A7F4F` — Umsatz, positive Deltas
  - `brick #B5532C` — negative Deltas, Fehler
  - `surface #FAF5E6` — Card-Hintergrund
  - `ink #1A1610` — primärer Text
  - `rule #E4D9BB` — Trennlinien
  - Vorjahres-Werte in Charts: `#B5A98C` (warmes Grau)
  Direkte Hex-Werte in Recharts (Bar/Line `fill`/`stroke`) sind OK — Tailwind kann an Recharts-Props nicht durchgereicht werden. Für UI-Elemente: Tailwind-Tokens (`bg-yolk`, `text-sage`) nutzen.
- **Pflicht-Wrapper für neue Seiten** (nicht jedes Mal eigene Header/Cards basteln):
  - `components/PageHeader.tsx` → `<PageHeader eyebrow="…" title="…" subtitle="…" />`. Rendert standardmäßig die `ZeitraumFilter`-Pille rechts; mit `withZeitraumFilter={false}` ausschaltbar (z. B. auf Jahresvergleich/Import-Seiten). Optional `exportHref` für dezenten Download-Icon-Button.
  - `components/PageHeader.tsx`'s `<Panel>` ist der **einzige Card-Wrapper** — `eyebrow`, `title`, `actions`, Children im `<div className="p-6">`. Eigene Cards (`rounded-xl border …`) bedeuten Drift zur einheitlichen Optik.
  - `components/ZeitraumFilter.tsx` → Pill mit Quick-Range-Erkennung (Dieser Monat / Letztes Jahr / Eigener Zeitraum). Wird vom `PageHeader` automatisch eingebunden, nur in Ausnahmefällen einzeln rendern.
  - `components/KPICard.tsx` → Hero-Variante (8/12-Spalten, 88–112 px Wertgröße) + Default-Variante. `wertFarbe="ink|yolk|sage"`, `sparkline: number[]` (optional, sitzt absolute in der rechten unteren Ecke), `delta: { wert, richtung }`, `hinweis?: string` (Unterzeile unter dem Wert; reserviert bei aktiver Sparkline automatisch deren Ecke per Padding — nicht entfernen, sonst überlappt der Text).
- **Charts**: Recharts mit `ResponsiveContainer`. Achsenlinien/Tick-Striche entfernt für ruhigeres Bild (`axisLine={false} tickLine={false}`). Grid via `<CartesianGrid stroke="#E4D9BB" strokeDasharray="3 3" />`. Tooltip-Style einheitlich `background: "#FAF5E6", border: "1px solid #E4D9BB", borderRadius: 8, fontFamily: "JetBrains Mono"`.

**Tabellen-Sortierung — kritische Invariante:**

In `ColumnDef<…>[]` jeder TanStack-Table v8 muss für **Zahlen-Spalten** explizit `sortingFn: "basic"` gesetzt sein. Sonst greift Auto-Detection (`alphanumeric`) und sortiert lexikographisch (`1, 10, 100, 2, 20`). Betrifft bereits `pages/Artikel.tsx`, `pages/Kunden.tsx`, `pages/Ranking.tsx`. Bei neuen Tabellen-Spalten mit numerischen Werten: **immer `sortingFn: "basic"` ergänzen**, sonst kommt der Sortier-Bug zurück.

### Export (`export/`)

- `excel_export.py`: openpyxl. Titelzeile „Kerba Bio-Ei GbR" + Zeitraum, **dunkelblauer Header (`#1E3A8A`)** aus der Pre-v1.1.0-Palette. **Stilistisch inkonsistent** mit dem neuen Warm-Editorial-Frontend (Yolk/Sage/Brick) — bei Gelegenheit auf `#D69826` (Yolk) für den Kopf + `#5A7F4F` (Sage) für Akzente migrieren. Niedrige Priorität, weil Excel-Exporte selten geöffnet werden und der dunkelblaue Kopf gut lesbar ist.
- `pdf_export.py`: WeasyPrint. **Auf Windows lokal oft kaputt** (GTK fehlt) → der Endpoint fängt `OSError` und liefert 500 mit klarem Hinweis. PDF-Tests am besten in Docker. PDF-Styling sollte bei Gelegenheit ebenfalls auf die Warm-Editorial-Palette angeglichen werden.

## Versions- und Release-Hygiene

Die aktuelle Versionsnummer steht in der Datei `VERSION` (hier nicht duplizieren — sie driftet sonst). Bei jedem Release müssen **drei Stellen synchron** angepasst werden — sonst läuft `eierverkauf status` falsch oder die Swagger-UI zeigt eine veraltete Versions-Nummer:

1. `VERSION` (Plaintext-Datei, vom Helper-Script gelesen)
2. `CHANGELOG.md` (Keep-a-Changelog-Format; `[Unreleased]` → neue Version mit Hinzugefügt/Geändert/Behoben/Hinweise-Sektionen)
3. `main.py:version="…"` im FastAPI-Konstruktor

Bei Bugfixes mit Schema-Auswirkung zusätzlich **Migration in `data/db.py` ergänzen** und im CHANGELOG-Eintrag „Datenmigration"-Sektion dokumentieren (Beispiel: v1.0.4-Migration des UNIQUE-Constraints).

Release-Commit-Konvention: Tag `v<MAJOR>.<MINOR>.<PATCH>` setzen, dann `git push origin main && git push origin v<X.Y.Z>`. Server zieht via `eierverkauf update` automatisch nach.

## Deployment

Produktivumgebung wird durch `install.sh` aufgesetzt und durch `eierverkauf-helper.sh` (Symlink `/usr/local/bin/eierverkauf`) gepflegt. **Vollständige Server-Admin-Anleitung in `DEPLOYMENT.md`** — inkl. LXC-Setup, Update-Pipeline, Backup/Restore, Reverse-Proxy, Daten-Migration vom alten Server, Troubleshooting. Update-Pipeline macht automatisches Pre-Update-Backup mit Rollback bei Fehler — die Backup-Logik liegt im Helper-Script, nicht in der App.

**Wichtige Diskrepanz zwischen `install.sh` und `eierverkauf-helper.sh update`:** Der Installer rsync't den Code von einem temporären Quellverzeichnis nach `/opt/eierverkauf` **ohne `.git`**. Der Update-Helper erwartet aber ein Git-Working-Copy mit Remote `origin/main`. Nach jeder Erstinstallation muss daher manuell `git init` + `git remote add origin …` + `git fetch` + `git reset --hard <tag>` in `/opt/eierverkauf` ausgeführt werden — siehe `DEPLOYMENT.md` §4.5. Dieses Manuell-Setup ist die einzige nicht-automatisierte Stelle in der Deploy-Pipeline.
