# Changelog

Alle wesentlichen Änderungen an der **Eierverkauf-Auswertungs-App** werden hier dokumentiert.

Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

## [1.13.0] - 2026-07-13

### Behoben
- **Identische Doppel-Positionen einer Rechnung wurden beim Import verworfen.**
  Enthielt eine Rechnung zwei vollständig identische Positionen (gleicher Tag,
  gleiche Menge, gleiche Beschreibung — z. B. zwei gleiche Lieferungen am
  selben Tag), erkannte der UNIQUE-Schlüssel die zweite Zeile fälschlich als
  Duplikat — die Monatsauswertung fiel entsprechend zu niedrig aus. Der
  Schlüssel enthält jetzt einen Vorkommens-Index (`key_lauf`): das n-te
  identische Vorkommen innerhalb einer Datei wird als eigenständige Position
  gespeichert.
- **Positionen ohne Pack-Code wurden beim Re-Import still verdoppelt.**
  SQLite behandelt NULL-Werte in UNIQUE-Constraints als paarweise verschieden —
  ein erneuter Upload derselben CSV fügte deshalb alle Zeilen ohne Pack-Code
  (lose Eier, kg-Positionen) erneut ein statt sie als Duplikat zu überspringen.
  Die Duplikat-Erkennung läuft jetzt über einen UNIQUE-Index mit
  COALESCE-Normalisierung; Re-Imports sind damit vollständig idempotent.

### Datenmigration
- Beim ersten Start nach dem Update wird `verkaufspositionen` automatisch
  umgebaut (neue Spalte `key_lauf`, Duplikat-Erkennung über den neuen Index
  `ux_vkp_dedup`). Vorher wird ein Datei-Backup
  `eierverkauf.db.pre-v1.13.0.bak` angelegt (inkl. WAL-Checkpoint).
  Bestandszeilen werden je Duplikat-Schlüssel durchnummeriert.

### Hinweise
- Früher verworfene Doppel-Positionen werden nicht automatisch
  wiederhergestellt: Nach dem Update einmalig die betroffenen CSV-Dateien
  erneut hochladen — nur die fehlenden Zeilen werden nachimportiert, alles
  andere wird als Duplikat übersprungen.
- Wichtig für Beleg-Abgleiche: Die App zeigt **Netto**-Werte (Verkäufe
  abzüglich Retouren/Gutschriften im Liefermonat). In Monaten mit Retouren
  liegen Brutto-Verkaufszahlen aus der Warenwirtschaft deutlich über den
  Netto-Werten der App — das ist korrekt und kein Fehler.

## [1.12.2] - 2026-07-13

### Behoben
- **Leere/alte Seite direkt nach jedem Server-Update.** `index.html` wurde
  ohne `Cache-Control` ausgeliefert — Browser zeigten nach einem Update
  minutenlang die alte gecachte Startseite, deren Bundle-Verweise nach dem
  Rebuild ins Leere liefen (Seite baute sich nicht auf und „heilte" sich
  nach ein paar Minuten von selbst). Dieses Muster steckte hinter den
  wiederholten „App hängt nach dem Löschen"-Meldungen: Der Test fand
  jeweils direkt nach einem Update statt; Datenbank und Löschung waren
  nachweislich schnell (Produktions-Messung: 0,1 s bei WAL-Modus aktiv).
  `index.html` wird jetzt mit `Cache-Control: no-cache` ausgeliefert
  (Browser revalidiert per ETag, praktisch kostenlos), die gehashten
  Bundles unter `assets/` mit `max-age=31536000, immutable`.

### Hinweise
- Einmalig nach dem Update auf v1.12.2 ist noch ein Hard-Reload nötig
  (Strg+F5 bzw. Cmd+Shift+R), damit der Browser die letzte alte
  index.html verwirft — danach nie wieder.

## [1.12.1] - 2026-07-13

### Behoben
- **Seiten-Reload auf Unterseiten lieferte 404.** Ein Reload (oder direkter
  Aufruf) von `/import`, `/kunden/…` usw. zeigte `{"detail":"Not Found"}`
  statt der App — die Client-Routen des React-Routers existieren nicht als
  Dateien im Frontend-Build. Unbekannte Pfade liefern jetzt `index.html`
  (SPA-Fallback), das Routing übernimmt der Browser. `api/`- und
  `assets/`-Pfade behalten ihr echtes 404, damit Fehler sichtbar bleiben.

## [1.12.0] - 2026-07-13

### Behoben
- **Timeout-Fehler beim Import-Löschen strukturell beseitigt.** Der
  Lösch-Endpoint wartete synchron auf die komplette Löschung — auf
  langsamem Server-Storage dauert die bei großen Imports über 5 Minuten,
  sodass jedes Frontend-Timeout ablief („AxiosError: Time Out"), obwohl
  die Löschung serverseitig durchlief. Die Löschung startet jetzt als
  **Hintergrund-Aufgabe** und der Endpoint antwortet sofort. Die Historie
  zeigt den laufenden Vorgang mit Spinner an (auch nach Seiten-Reload)
  und aktualisiert sich automatisch, bis der Eintrag verschwunden ist.
- **Auswertungen bleiben während der Löschung bedienbar:** Die Löschung
  drosselt sich selbst — nach jedem Batch (jetzt 5.000 statt 20.000 Zeilen)
  pausiert sie so lange, wie der Batch gedauert hat (gedeckelt auf 2 s).
  Auf langsamem Server-Storage bekommen Lese-Abfragen dadurch echte
  I/O-Fenster statt einer wirkungslosen 50-ms-Pause.
- Löschungen laufen strikt nacheinander (ein Schreiber zur Zeit) — zwei
  parallel angestoßene Löschungen konnten sich zuvor gegenseitig mit
  „database is locked" abbrechen.
- Die Import-Seite meldet „Import gelöscht" nur noch, wenn der Eintrag
  wirklich aus der Historie verschwunden ist. Schlägt die
  Hintergrund-Löschung fehl, erscheint stattdessen ein Fehler-Hinweis
  mit Aufforderung zum erneuten Löschen (vorher: falscher Erfolgs-Toast).
- Ist der WAL-Modus wider Erwarten nicht aktiv (z. B. Datenbank auf einem
  Netz-Dateisystem), erscheint jetzt eine deutliche Warnung im Journal
  statt stillem Rückfall in den blockierenden Journal-Modus. Die
  WAL-Umschaltung wartet zudem mit vollem busy_timeout (10 s statt 5 s
  Connect-Default) auf konkurrierende Verbindungen.

### Geändert
- `DELETE /api/imports/{id}` antwortet mit `{"geloescht_geplant": true}`
  statt der Anzahl gelöschter Einträge; läuft bereits eine Löschung
  desselben Imports, kommt HTTP 409. `GET /api/imports` liefert additiv
  `wird_geloescht` je Eintrag.
- Abschluss und Fehler der Hintergrund-Löschung werden mit Dauer in
  Sekunden geloggt (ungepuffert, sofort in `journalctl` sichtbar).

### Hinweise
- Zur Server-Diagnose (WAL-Status, Storage-Latenz, Lösch-Dauer) siehe den
  neuen Kommando-Block in DEPLOYMENT.md §11.11 — wichtigster Check:
  `sqlite3 eierverkauf.db "PRAGMA journal_mode;"` muss `wal` liefern.

## [1.11.3] - 2026-07-13

### Behoben
- **Minutenlange App-Blockade direkt nach dem Import-Löschen.** Der WAL-Modus
  aus v1.11.2 hat die Dauer-Blockade behoben, aber die Löschung lief weiter
  als eine einzige Riesen-Transaktion: Bei großen Imports wuchs das
  Write-Ahead-Log auf annähernd Datenbank-Größe und der anschließende
  Checkpoint sättigte das Storage minutenlang — alle Auswertungs-Queries
  verhungerten am I/O. Die Löschung läuft jetzt **häppchenweise** (20.000
  Zeilen je Transaktion, Verkaufspositionen und Protokoll zuerst, der
  Import-Eintrag zuletzt) und stutzt das WAL danach sofort zurück. Bricht
  der Vorgang ab, bleibt der Import in der Historie sichtbar und kann
  erneut gelöscht werden.
- **Lösch-Button ohne Rückmeldung.** Während der Löschung zeigt der Button
  jetzt einen Lade-Spinner und ist gesperrt (kein versehentliches
  Doppel-Löschen); das Frontend wartet bis zu 5 Minuten statt nach 60 s
  fälschlich „Löschen fehlgeschlagen" zu melden.

### Geändert
- WAL-Datei wird über `journal_size_limit` auf maximal 64 MB gedeckelt.

## [1.11.2] - 2026-07-13

### Behoben
- **App-Blockade beim Import-Löschen — tatsächliche Ursache behoben.** Die
  Datenbank lief im SQLite-Standard-Journal-Modus, in dem eine
  Schreib-Transaktion (z. B. die Lösch-Cascade) alle Leser blockiert. Da alle
  Requests über den begrenzten Threadpool eines einzelnen uvicorn-Workers
  laufen und das Frontend Requests bis 60 s offen hält, liefen die Slots
  voll und die App nahm nichts mehr an — bis zum Neustart. Die Datenbank
  läuft jetzt im **WAL-Modus** (`journal_mode=WAL`, `busy_timeout=10000`,
  `synchronous=NORMAL`): Leser blockieren nie mehr auf Schreibern, die App
  bleibt auch während langer Lösch-/Schreibvorgänge bedienbar. (Der Index
  aus v1.11.1 bleibt sinnvoll, war aber nicht die Ursache.)
- **CSV-Upload konnte den kompletten Server einfrieren.** Die beiden
  Upload-Endpoints waren `async def`, riefen aber blockierendes
  pandas/SQLite direkt auf dem Event-Loop auf — während eines Imports war
  die App nicht erreichbar. Sie laufen jetzt als synchrone Handler im
  Threadpool.

### Hinweise
- Der WAL-Modus wird beim ersten Start automatisch und dauerhaft aktiviert;
  die neuen Dateien `eierverkauf.db-wal` und `eierverkauf.db-shm` neben der
  Datenbank sind normal. Beim Zurückspielen eines Backups müssen diese
  Dateien entfernt werden — `eierverkauf restore` und der Update-Rollback
  machen das jetzt automatisch (manuelles Vorgehen: DEPLOYMENT.md §7.5).

## [1.11.1] - 2026-07-13

### Behoben
- **Import-Löschung konnte die App blockieren.** Die CASCADE-Löschung der
  Verkaufspositionen eines Imports lief ohne Index auf `import_id` und
  erzwang dadurch einen Full-Table-Scan über den gesamten Bestand — auf
  großen Datenbeständen mit langsamem Storage blockierte das die App
  minutenlang (Browser-Timeout). Neuer Index `idx_import` beschleunigt die
  Löschung auf die Zeilen des betroffenen Imports.

### Datenmigration
- Der Index `idx_import` auf `verkaufspositionen(import_id)` wird beim
  ersten Start nach dem Update automatisch angelegt (idempotent über
  `init_db()`, kein manueller Eingriff nötig).

## [1.11.0] - 2026-07-13

### Geändert
- **Umsatz/Ei zählt nur noch Umsatz aus Positionen mit Eier-Stückzahl.**
  Bisher floss auf allen Seiten der gesamte Zeilen-Umsatz in die Kennzahl —
  inklusive kg-Positionen ohne Eier —, wodurch der Wert bei gemischten
  Kunden, Belegen oder Monaten zu hoch ausfiel. Die APIs liefern dafür das
  neue additive Feld `eier_umsatz` (bzw. `jahr_eier_umsatz`/
  `vorjahr_eier_umsatz` im Jahresvergleich); die Umsatz-Spalten selbst
  zeigen weiterhin den vollen Umsatz. Betrifft Kunden, Belege, Ranking,
  Artikel, Jahresvergleich sowie die Monats-Tabellen der Detailseiten.

## [1.10.0] - 2026-07-13

### Hinzugefügt
- **Zwei Spalten „Umsatz/Ei"** (Cent je Ei, eine pro Vergleichsjahr) in der
  Monatstabelle des Jahresvergleichs, hinter den Delta-Spalten, inklusive
  gewichtetem Durchschnitt in der Summenzeile. Monate ohne Eier-Stückzahl
  zeigen „—".

## [1.9.0] - 2026-07-13

### Hinzugefügt
- **Spalte „Umsatz/Ei"** (Cent je Ei) im Kunden-Ranking und in der
  Artikel-Übersicht, jeweils hinter der Umsatz-Spalte und numerisch
  sortierbar. Zeilen ohne Eier-Stückzahl (z. B. „Gewicht (kg)") zeigen „—".
  Damit ist die Kennzahl auf allen Übersichtstabellen verfügbar.

## [1.8.0] - 2026-07-13

### Hinzugefügt
- **Spalte „Umsatz/Ei"** (Cent je Ei) in der Kundenliste auf der
  Kunden-Seite, hinter der Umsatz-Spalte und numerisch sortierbar.
  Kunden ohne Eier-Stückzahl (z. B. reine kg-Käufe) zeigen „—".

## [1.7.0] - 2026-07-12

### Hinzugefügt
- **Spalte „Umsatz/Ei"** (Cent je Ei) in der Belegliste auf der
  Belege-Seite, hinter der Umsatz-Spalte und numerisch sortierbar.
  Belege ohne Eier-Stückzahl (z. B. reine kg-Belege) zeigen „—".
  Der Positionen-Dialog bleibt unverändert.

## [1.6.1] - 2026-07-12

### Behoben
- **`eierverkauf update` brach bei 55 % ab (npm ci).** Der mit v1.6.0
  eingeführte Vitest-4-Baum zog ein verschachteltes vite 8 samt nativer
  Rust-Binaries (rolldown, lightningcss) nach sich, die Node ≥ 20.19
  verlangen und beim Update erstmals aus der Registry geladen werden
  mussten. Vitest läuft jetzt in Version 3 gegen das vorhandene vite 5 —
  keine nativen Binaries, jedes Node 20 reicht, deutlich kleinerer
  Download. Test-API und alle 11 Tests unverändert.
- **Update-Helper zeigt npm-Fehler jetzt an.** `npm ci`/`npm run build`
  liefen mit `--silent`, wodurch die Fehlerbox nach einem Abbruch leer
  blieb. Beide Schritte loggen jetzt sichtbar nach
  `/tmp/eierverkauf-update.log` und sind mit Timeouts (600 s, pip 300 s)
  gegen Netz-Hänger abgesichert. Neuer Troubleshooting-Abschnitt §11.10
  in `DEPLOYMENT.md`.

## [1.6.0] - 2026-07-12

### Hinzugefügt
- **Einheiten-Zusatz bei Artikelnamen.** Artikel ohne Einheit im Code zeigen
  sie jetzt in Klammern: „10er Kvp (PACK)", „6er Kvp (PACK)", „Lose 180 (stk)",
  „Lose 20 (stk)", „Lose unsortiert (stk)". Gilt für die Artikel-Seite, den
  Titel der Artikel-Detailseite und die Dashboard-Top-5 — reine Anzeige,
  die gespeicherten `artikel_code`-Werte und Routen bleiben unverändert.
- **Neue Spalte „Umsatz/Ei"** (Cent je Ei, eine Nachkommastelle) in den
  Detailwerte-Tabellen der Artikel-Detailseite und der Kunden-Detailseite.
  Ohne Eier-Stückzahl (z. B. reine kg-Monate) wird „—" angezeigt. Beim
  Kunden ist der Wert Gesamtumsatz ÷ Eier-Stückzahl des Monats — Umsatz aus
  kg-Positionen fließt mit ein.
- **Frontend-Unit-Tests** (Vitest) für die neuen Helfer `artikelLabel` und
  `formatCentJeEi` — erster Test-Runner im Frontend (`npm run test`).

## [1.5.0] - 2026-07-11

### Geändert
- **Kvp-Artikel werden nach Abrechnungsart getrennt ausgewiesen.** Positionen
  mit PackCode 110/111 und Einheit **PACK** (Menge zählt Verpackungen)
  behalten die Artikel-Codes „10er Kvp"/„6er Kvp"; pro Stück fakturierte
  Positionen (Einheit stk oder leer — Menge zählt einzelne Eier) erscheinen
  jetzt als eigene Artikel **„10er Kvp (stk)"** und **„6er Kvp (stk)"**.
  Vorher mischte die Artikel-Übersicht beide Einheiten in einer Zeile
  (Beispiel Mai 2026, 10er Kvp: Menge 36.558 aus 8838 PACK + 27.720 stk —
  als Packungszahl gelesen irreführend). Jetzt: „10er Kvp" 8838 PACK →
  88.380 Eier, „10er Kvp (stk)" 27.720 Eier. Die Gesamtsummen ändern sich
  nicht, `eier_stueck` bleibt unberührt.

### Datenmigration
- Beim ersten Start nach dem Update erhalten bestehende stk-/leer-Positionen
  mit PackCode 110/111 automatisch die neuen „(stk)"-Artikel-Codes — nur,
  falls solche Zeilen vorhanden sind (idempotent). Vorher wird ein DB-Backup
  `data/eierverkauf.db.pre-v1.5.0.bak` angelegt.

## [1.4.1] - 2026-07-11

### Behoben
- **Eiermengen-Berechnung ver-10-/ver-6-fachte stk-Positionen mit PackCode
  110/111** (Regression aus v1.4.0). Der Eier-Faktor hing seit dem
  Konfigurations-Refactor nur noch am `artikel_code`; die Einheit wurde
  ignoriert. Bei stk-Positionen zählt die Menge aber bereits einzelne Eier —
  auch wenn der PackCode sie dem Artikel „10er/6er Kvp" zuordnet.
  `berechne_eier()` prüft jetzt wieder die Einheit: Faktor nur bei **PACK**,
  stk/leer → 1:1, kg → keine Stückzahl. (Beispiel Mai 2026: 79 von 395
  Positionen betroffen, Eier-Summe +75 % zu hoch.)
- **Rückwirkende Neuberechnung über die Konfigurationsseite** nutzte dieselbe
  fehlerhafte Logik und verfälschte beim Speichern auch korrekt importierte
  Alt-Daten. Die per-Artikel-UPDATEs sind durch eine einheit-bewusste
  Gesamt-Neuberechnung ersetzt (`EIER_STUECK_CASE_SQL` in
  `data/konfiguration.py`, SQL-Spiegel von `berechne_eier()`).

### Datenmigration
- Beim ersten Start nach dem Update werden alle `eier_stueck`-Werte
  automatisch einheit-bewusst neu berechnet — nur, falls Abweichungen erkannt
  werden (idempotent). Vorher wird ein DB-Backup
  `data/eierverkauf.db.pre-v1.4.1.bak` angelegt.

### Hinzugefügt
- **Erste pytest-Testsuite** (`tests/`): Unit-Tests für
  `berechne_eier`/`normiere_artikel`, Integrationstests für
  Konfig-Neuberechnung, Reparatur-Migration und CSV-Import Ende-zu-Ende.
  `pytest` neu in `requirements.txt`.

### Geändert
- Konfigurationsseite: Beschriftung stellt klar, dass die Faktoren nur für
  Positionen mit Einheit PACK gelten (stk zählt 1:1, kg nie).

## [1.4.0] - 2026-05-26

### Hinzugefügt
- **Konfigurationsseite `/konfiguration`** zur Pflege der Eier-pro-Einheit-Faktoren
  je Artikel-Code (10er Kvp, 6er Kvp, Lose 180/20/unsortiert, Gewicht (kg),
  Sonstige). Der Betriebsleiter kann Faktoren direkt im UI ändern, ohne dass
  ein Code-Release nötig wäre — z. B. für eine neu eingeführte 12er-Verpackung.
- **Neue DB-Tabelle `artikel_eier_konfiguration`** (Schlüssel `artikel_code`,
  `faktor INTEGER` mit NULL für Artikel ohne Stückzahl-Aussage). Wird beim
  Startup idempotent mit den bisherigen hartcodierten Werten geseedet, sodass
  ein Update kein bestehendes Verhalten ändert.
- **REST-Endpoints `GET/PUT /api/konfiguration/artikel-eier`** in
  `api/konfiguration_router.py`.
- **Modul `data/konfiguration.py`** als Lese-/Schreib-Layer mit
  Re-Berechnungs-Transaktion.

### Geändert
- **`berechne_eier()`-Signatur** in `data/importer.py` von
  `(menge, einheit, pack_code)` auf `(menge, artikel_code, konfig)`. Reihenfolge
  in `_row_to_record()`: erst `normiere_artikel()`, dann `berechne_eier()` mit
  dem ermittelten Code und der einmal pro Import geladenen Konfiguration. Rein
  interner Refactor — externe Aufrufer existieren nicht.
- **Navigation:** neuer Menüpunkt „Konfiguration" mit Settings-Icon nach
  „Import" (Desktop-Sidebar + Mobile „Mehr"-Sheet).

### Datenmigration
- Idempotente Tabellen-Anlage in `data/db.py:init_db()` via
  `CREATE TABLE IF NOT EXISTS` + `INSERT OR IGNORE` der Seed-Werte. **Keine
  rückwirkende Re-Berechnung beim Update** — die Seeds entsprechen exakt dem
  alten hartcodierten Verhalten, alle bestehenden `eier_stueck`-Werte bleiben
  unverändert. Eine Re-Berechnung wird erst beim ersten Klick auf „Speichern"
  in der Konfigurationsseite ausgelöst.

### Hinweise zum Update
- `eierverkauf update` reicht — neue Tabelle entsteht automatisch beim Startup.
- **Vorsicht bei Konfig-Änderungen:** Der Server schreibt `eier_stueck` aller
  bestehenden Belege neu. Historische Eier-Zahlen gegen frühere Faktoren
  lassen sich danach nicht mehr rekonstruieren. Auswertungen zeigen ab dem
  Klick auf „Speichern" die neue Sicht — auch für Belege aus älteren Imports.

## [1.3.1] - 2026-05-26

### Behoben
- **Lange Texte (Kundennamen) brechen nicht mehr aus Mobile-Cards aus.**
  In der `DataTable`-Mobile-Card-Ansicht (<768 px) hatte die Secondary-Cell
  `shrink-0` — Text-Inhalte wie lange Kundennamen sprengten dadurch das
  Card-Layout horizontal. Jetzt `min-w-0 break-words`, Labels auf max. 45 %
  Card-Breite limitiert. Betraf primär die Belege-Übersicht.

### Geändert
- **Explizite Mobile-Spalten-Priorisierung** in `Belege.tsx`, `Kunden.tsx`,
  `Ranking.tsx` und `Artikel.tsx` via `column.meta.mobilePriority`. Auf
  Mobile ist jetzt der Kundenname (bzw. Artikel-Code) der Card-Titel
  oben, der wichtigste Geldwert rechts daneben, alle anderen Spalten
  als Label/Wert-Paare im Card-Body. Vorher landete bei der Belege-Seite
  das Rechnungsdatum oben — semantisch deutlich schwächer.

### Hinweise zum Update
- Reiner Frontend-Fix, keine Datenmigration. `eierverkauf update` reicht.

## [1.3.0] - 2026-05-26

### Hinzugefügt
- **Mobile-First-Bedienung** — adaptive 3-Stufen-Navigation:
  Bottom-Tab-Bar mit fünf Einträgen + „Mehr"-Sheet auf Smartphones (<768 px),
  Hamburger-Drawer auf Tablets (768–1023 px), klassische Sidebar auf dem
  Desktop (≥1024 px). Touch-Targets durchgängig ≥44 px, Safe-Area-Insets
  für iOS-Notch und Gesture-Bar.
- **Responsive Tabellen-Komponente** (`DataTable.tsx`) im Dual-Mode:
  oberhalb `md:` wie bisher als Tabelle, darunter als Card-Liste mit
  optional steuerbarer `column.meta.mobilePriority` (primary/secondary/hidden).
  Greift ohne Anpassung auf bestehende Tabellen (Kunden, Artikel, Ranking,
  Belege) durch.
- **Landwirtschafts-Illustrationen** als SVG-Line-Art in
  `frontend/src/components/illustrations/`: Eierkarton, Henne, Scheune,
  Weizenähre, Eierkorb. Verwendet als Wasserzeichen in der Hero-KPI und
  in den neuen Empty-States.
- **`EmptyState`-Komponente** für einheitliche Leerzustände
  (Dashboard ohne Imports, Import-Historie leer).
- **`Sheet`-Komponente** (Drawer/Bottom-Sheet auf Radix-Dialog-Basis) für
  die Mobile-Navigation und künftige modale Flows.
- **Tailwind-Tokens `straw` (#F0E6CC) und `loam` (#8C7A5F)** als ergänzende
  Erd-/Stroh-Töne neben yolk/sage/brick.

### Geändert
- **Logo:** Yolk-Dot-Kreis ersetzt durch eine sauber gezeichnete
  Ei-Silhouette mit Yolk-Glanz (`EggMark` in `Layout.tsx`).
- **Body-Hintergrund** trägt jetzt eine sehr dezente Korn-Textur + warme
  Radial-Gradients (papierige Anmutung statt steriler Flächen).
- **Chart-Farbwerte zentralisiert** in `frontend/src/lib/chart-farben.ts`
  (`CHART_FARBEN`, `TOOLTIP_STYLE`, `AXIS_TICK`, `CHART_GRID`). Recharts
  in Dashboard, Ranking, ArtikelDetail, KundenDetail, Jahresvergleich und
  KPICard nutzen jetzt die Konstanten — keine doppelten Hex-Strings mehr.
- **`PageHeader.tsx`** skaliert die H1 jetzt `text-3xl → 4xl → 5xl → 6xl`
  und stapelt Actions/Zeitraumfilter auf Schmalformat unter dem Titel.
- **`KPICard.tsx`** hat einen neuen `illustration`-Prop (Hero-Variante:
  Illustration als Wasserzeichen rechts oben, 30 % Opazität).
- **Button-Default-Höhe** von `h-9` auf `h-10` angehoben (alle Sizes um
  einen Schritt grösser für Touch-Tauglichkeit), Press-Feedback via
  `active:scale-[0.97]`.
- **`ZeitraumFilter`** auf Mobile kompakter (Datumsbereich-Text ausgeblendet,
  Pill-Höhe 44 px).
- **Import-Seite:** DropZone und Action-Bar stapeln auf Mobile,
  Historie wird als Card-Liste statt Tabelle dargestellt, Empty-State mit
  Henne-Illustration.
- **Detail-Tabellen** (Artikel, Kunden, Jahresvergleich) haben einen
  horizontalen Scroll-Wrapper, der bündig in das Panel-Padding einrastet.

### Behoben
- **Viewport-Meta** enthält jetzt `viewport-fit=cover` — vorher kollidierten
  fixe UI-Elemente mit dem iOS-Notch.
- **`prefers-reduced-motion`** wird respektiert: Animationen und Transitions
  werden auf ~0 ms zurückgefahren, wenn das OS es verlangt.
- **Focus-Ringe** sind jetzt einheitlich Yolk-gelb und überall sichtbar
  (`:focus-visible` in `index.css`).
- **`min-h-dvh`** statt `min-h-screen` — kein Layout-Sprung mehr durch die
  iOS-Adressleiste, die beim Scrollen ein-/ausblendet.

### Hinweise zum Update
- Keine Datenmigration nötig — reine Frontend-Änderungen.
- Server-Update wie gewohnt: `eierverkauf update`. Backend bleibt funktional
  identisch, nur die ausgelieferten Statics werden ersetzt.

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
