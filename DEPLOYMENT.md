# Deployment-Handbuch — Eierverkauf-Auswertungs-App

Diese Anleitung führt dich **vom leeren Server bis zur laufenden App** und alle Wartungsaufgaben.
Sie ist für Admin·innen ohne Python-/Node-Vorkenntnisse geschrieben — wenn du auf einem
Debian-/Ubuntu-Server eine Shell öffnen und Befehle einfügen kannst, reicht das.

> **Repository:** <https://github.com/muelley86/eierverkauf>
> **Aktuelle Version:** `v1.1.0`
> **Zielplattform:** Debian 13 „Trixie" (Ubuntu 22.04+ funktioniert auch, wird aber nicht aktiv getestet)

---

## Inhaltsverzeichnis

1. [Quickstart (Kurzform)](#1-quickstart-kurzform)
2. [Was du vorher wissen solltest](#2-was-du-vorher-wissen-solltest)
3. [Voraussetzungen](#3-voraussetzungen)
4. [Erstinstallation — Schritt für Schritt](#4-erstinstallation--schritt-für-schritt)
5. [Browser-Test & erste CSV](#5-browser-test--erste-csv)
6. [Updates](#6-updates)
7. [Backup & Restore](#7-backup--restore)
8. [Daten-Migration vom alten Server](#8-daten-migration-vom-alten-server)
9. [Optional: Reverse-Proxy mit HTTPS](#9-optional-reverse-proxy-mit-https)
10. [Wartungs-Befehle (`eierverkauf …`)](#10-wartungs-befehle-eierverkauf-)
11. [Troubleshooting](#11-troubleshooting)
12. [Deinstallation](#12-deinstallation)
13. [Anhang: Versions-Konvention und Datei-Layout](#13-anhang-versions-konvention-und-datei-layout)

---

## 1. Quickstart (Kurzform)

Wenn du Linux-fluent bist und nur die Befehle willst:

```bash
# Auf dem frischen Debian-13-LXC, als root:
apt-get update && apt-get install -y git

git clone https://github.com/muelley86/eierverkauf.git /tmp/eierverkauf-source
cd /tmp/eierverkauf-source
git checkout v1.1.0
bash install.sh

# Nach erfolgreichem Installer: /opt/eierverkauf zum Git-Working-Copy machen
cd /opt/eierverkauf
git init -q
git remote add origin https://github.com/muelley86/eierverkauf.git
git fetch origin
git reset --hard v1.1.0
chown -R eierverkauf:eierverkauf .git

# Aufräumen + Smoke-Test
rm -rf /tmp/eierverkauf-source
eierverkauf status
```

Dauer: ca. **8–15 Minuten** (je nach LXC-Internet-Speed).

Wenn du Schritt-für-Schritt-Erklärung willst → [§4](#4-erstinstallation--schritt-für-schritt).

---

## 2. Was du vorher wissen solltest

Falls dir einer dieser Begriffe nichts sagt, lies kurz quer — du brauchst sie nicht im Detail
zu beherrschen, aber das Gesamtbild hilft beim Verstehen der Befehle.

**LXC** — ein „Linux-Container", quasi ein leichtgewichtiger virtueller Server, der unter
Proxmox, Incus/LXD oder direkt auf einem Linux-Host läuft. Die App ist dafür gedacht, in einem
unprivilegierten LXC zu laufen. Du kannst sie alternativ auch auf einer normalen VM oder direkt
auf Hardware betreiben — die Anleitung ist identisch.

**Debian Trixie** — Debian Version 13, das stabile Release ab Mitte 2025. Liefert Python 3.12
und alle nötigen System-Bibliotheken (für PDF-Export). Ubuntu 22.04+ funktioniert ebenfalls.

**FastAPI / uvicorn** — Das Backend der App ist in Python geschrieben. uvicorn ist der
Webserver, der das Backend ausliefert. Du musst Python nicht können — der Installer macht alles.

**npm / Node.js** — Das Frontend ist ein React-Projekt, das mit Node.js zu statischen HTML-/JS-/CSS-Dateien
gebaut wird. Auch hier: Installer macht alles automatisch.

**systemd-Unit** — Die App läuft als Systemdienst (`eierverkauf.service`). Damit startet sie
nach Server-Reboot automatisch und schreibt Logs nach `journalctl`.

**Helper-Skript `eierverkauf`** — Ein Befehl in deiner Shell (`/usr/local/bin/eierverkauf`), der
alle Wartungsaufgaben (Updates, Backups, Restart, Logs anschauen) abdeckt. Du lernst ihn unter
[§10](#10-wartungs-befehle-eierverkauf-) kennen.

---

## 3. Voraussetzungen

### Hardware / System

| Punkt | Anforderung |
|---|---|
| Betriebssystem | Debian 13 „Trixie" empfohlen. Debian 12 / Ubuntu 22.04+ funktioniert ebenfalls. |
| Architektur | `amd64` oder `arm64` |
| RAM | **mind. 512 MB** zur Laufzeit, kurzzeitig bis zu 1 GB während Frontend-Build |
| Festplatte | **mind. 2 GB** frei (Node-Modules, venv, PDF-Libs zusammen ~1,5 GB) |
| Netzwerk | **Static IP** empfohlen — bei DHCP-Lease-Wechsel ändert sich sonst die URL |
| Ports | **`8050`** intern frei (Reverse-Proxy auf 80/443 optional — siehe §9) |

### Internetzugang während der Installation

Der Installer lädt Software aus diesen Quellen:

| Domain | Wofür |
|---|---|
| `deb.debian.org` | apt-Pakete (Python, Git, WeasyPrint-Libs) |
| `deb.nodesource.com` | Node.js 20 LTS |
| `registry.npmjs.org` | Frontend-Abhängigkeiten |
| `github.com` | Quellcode der App (clone) |

Im **laufenden Betrieb** braucht die App **kein Internet**. Sie ist offline-fähig — alle Schriften,
Charts und Daten liegen lokal. Nur Updates brauchen wieder Internet.

### Rechte

Alle Befehle in dieser Anleitung erwartest du **als root** im Container. Wenn du als normaler
User unterwegs bist, jedem Befehl `sudo ` voranstellen oder einmal `sudo -i` ausführen.

### Bei Proxmox: Container anlegen

Falls du den LXC erst noch erstellen musst, hier ein Proxmox-Beispiel via Shell:

```bash
# Auf dem Proxmox-Host (NICHT im Container):
pveam update
pveam available | grep debian-13           # zeigt das verfügbare Template
pveam download local debian-13-standard_13.0-1_amd64.tar.zst    # (Versionsnummer ggf. anpassen)

pct create 200 local:vztmpl/debian-13-standard_13.0-1_amd64.tar.zst \
  --hostname eierverkauf \
  --cores 2 \
  --memory 1024 \
  --rootfs local-lvm:8 \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp \
  --unprivileged 1 \
  --features nesting=1 \
  --password
# Setze ein root-Passwort, wenn gefragt
pct start 200
pct enter 200
```

Du bist jetzt als root im neuen Container. Mit `ip a` siehst du die DHCP-IP (empfohlen: später
auf static umstellen).

Andere Hypervisoren / Cloud-VMs / Bare-Metal: Beliebige Debian-13-Installation reicht. SSH rein,
weiter mit §4.

---

## 4. Erstinstallation — Schritt für Schritt

Die folgenden 6 Schritte führst du **als root im LXC** aus. Geschätzte Gesamt-Dauer: **8–15 Minuten**.

### Schritt 4.1 — Voraussetzungen prüfen (30 Sek.)

```bash
cat /etc/os-release | grep VERSION_CODENAME
```

Erwartete Ausgabe:
```
VERSION_CODENAME=trixie
```
(oder `bookworm` für Debian 12, `noble`/`jammy` für Ubuntu — auch ok.)

```bash
df -h /
```

Erwartete Ausgabe (4. Spalte): mind. **2 GB** frei.

### Schritt 4.2 — Git installieren (30 Sek. – 2 Min.)

```bash
apt-get update
apt-get install -y git
```

Erwartete Ausgabe am Ende: `git is the newest version` oder `git version 2.x.x` bei
anschließendem `git --version`.

### Schritt 4.3 — Quellcode klonen (30 Sek.)

```bash
git clone https://github.com/muelley86/eierverkauf.git /tmp/eierverkauf-source
cd /tmp/eierverkauf-source
git checkout v1.1.0
```

Erwartete Ausgabe:
```
Cloning into '/tmp/eierverkauf-source'...
…
Note: switching to 'v1.1.0'.
HEAD is now at 30655c2 feat: UI-Redesign 'Warm Editorial' …
```

> **Wichtig:** Wir clonen nach `/tmp/`, **nicht** direkt nach `/opt/eierverkauf`. Der Installer
> rsync't gleich selbst nach `/opt/eierverkauf` und würde sich mit einem dortigen Clone überlagern.

### Schritt 4.4 — Installer starten (5–10 Min.)

```bash
bash install.sh
```

Der Installer zeigt eine Begrüßungs-Maske (`whiptail`). Mit **Enter** durch „Willkommen!" und
mit **Tab** + **Enter** auf „Ja" bei „Installation starten?".

Danach läuft eine Fortschritts-Anzeige (Gauge 0 → 100 %) durch diese Phasen — beobachte einfach:

| % | Phase |
|---|---|
| 5 | apt-Pakete aktualisieren |
| 15 | Systempakete: Python 3, Git, Whiptail, SQLite, WeasyPrint-Libs (Pango, Cairo, Harfbuzz) |
| 25 | Node.js 20 LTS aus NodeSource-Repository |
| 35 | Systembenutzer `eierverkauf` anlegen (nologin-Shell) |
| 40 | Verzeichnisse `/opt/eierverkauf/{data,uploads,backups,logs}` |
| 45 | Code per rsync von `/tmp/eierverkauf-source` nach `/opt/eierverkauf` (ohne `.git`) |
| 55 | Python-virtualenv + `requirements.txt` |
| 70 | `npm install` im Frontend (lädt ~400 MB Node-Module — **dauert am längsten**) |
| 85 | `npm run build` → erzeugt `frontend/dist/` |
| 90 | systemd-Unit `eierverkauf.service` |
| 93 | Symlink `/usr/local/bin/eierverkauf` |
| 96 | Berechtigungen auf `eierverkauf:eierverkauf` |
| 98 | Dienst aktivieren (`systemctl enable` + `restart`) |
| 100 | Erfolgs-Meldung mit URL |

Am Ende erscheint:
```
Installation erfolgreich
Eierverkauf-App ist eingerichtet.

Version:  1.1.0
Dienst:   active
URL:      http://192.168.X.Y:8050
Befehl:   eierverkauf
```

**Schreib dir die URL auf** — sie ist die IP des LXC + Port `8050`.

Bei der Frage „Helper-Menü jetzt starten?" → wähle **Nein**, wir machen erst noch Schritt 4.5.

> **Wenn etwas schiefläuft:** Der Installer schreibt ein Detail-Log nach
> `/tmp/eierverkauf-install-progress.log` und `/var/log/eierverkauf-install.log`. Hier
> reinschauen, häufig ist es ein npm-Netzwerk-Timeout oder eine fehlende apt-Quelle.
> Lösung: `bash install.sh` einfach nochmal — der Installer ist idempotent und reparierfähig.

### Schritt 4.5 — Git-Working-Copy einrichten (30 Sek.)

⚠️ **Ohne diesen Schritt funktioniert `eierverkauf update` später nicht.**

```bash
cd /opt/eierverkauf
git init -q
git remote add origin https://github.com/muelley86/eierverkauf.git
git fetch origin
git reset --hard v1.1.0
chown -R eierverkauf:eierverkauf .git
```

Erwartete Ausgaben:
```
git init -q                  → keine Ausgabe (still)
git remote add …             → keine Ausgabe
git fetch origin             → "remote: Enumerating objects…" + Downloadzahlen
git reset --hard v1.1.0      → "HEAD is now at 30655c2 feat: UI-Redesign …"
chown -R …                   → keine Ausgabe
```

> **Was passiert hier?** `install.sh` hat den `.git`-Ordner bewusst nicht mitkopiert. Wir
> initialisieren ihn jetzt neu, verbinden ihn mit GitHub und setzen den HEAD-Pointer auf
> den Release-Tag — die Working-Copy-Dateien selbst werden nicht angefasst, weil sie
> bereits dem Code von `v1.1.0` entsprechen.

### Schritt 4.6 — Aufräumen + Smoke-Test (10 Sek.)

```bash
rm -rf /tmp/eierverkauf-source
eierverkauf status
```

Erwartete Ausgabe von `eierverkauf status`:
```
=== Status ===
Dienst:        active
Version:       1.1.0
DB-Größe:      0K
Datensätze:    0
Letzter Import: Noch kein Import
URL:           http://192.168.X.Y:8050
```

Wenn `Dienst: active` und `Version: 1.1.0` stehen → **Installation erfolgreich abgeschlossen.**

---

## 5. Browser-Test & erste CSV

### 5.1 — Im Browser öffnen

Auf einem Rechner im selben Netzwerk wie der LXC: <http://192.168.X.Y:8050> (deine IP aus
Schritt 4.4 einsetzen).

Was du erwarten solltest:

| Bereich | Inhalt direkt nach Installation |
|---|---|
| Links (Sidebar) | „Kerba BIO-EI GBR"-Logo + Nav: Übersicht / Kunden / Artikel / Ranking / Jahresvergleich / Import |
| Oben | Großer Editorial-Titel **„Übersicht"** + Untertitel „KPIs, Topkunden und Verlauf auf einen Blick." |
| Mitte | KPI-Karten zeigen **0** (Eier · Stück), **0,00 €** (Umsatz), **0** (Kunden), **0** (Positionen) |
| Verlauf-Chart | Leer — Achsen sichtbar, aber keine Linien |
| Aktivität (rechts unten) | „Noch keine Imports." |

Wenn das so aussieht: **Backend + Frontend laufen einwandfrei.**

### 5.2 — Erste CSV importieren

1. In der Sidebar links: **Import** anklicken.
2. **CSV-Datei auswählen** → dein Warenwirtschafts-Export.
3. **Hochladen** → Toast erscheint („CSV erfolgreich importiert: X Zeilen").
4. Klick auf den Toast oder direkt **Import** → Eintrag in der Tabelle → Details prüfen:
   - `Zeilen importiert` sollte ≈ Anzahl Datenzeilen im CSV sein
   - `Zeilen übersprungen` = Duplikate (beim ersten Import normalerweise 0)
   - `Zeilen fehlerhaft` = 0, sonst Klick auf Eintrag → Details ansehen

5. Zurück auf **Übersicht** → KPIs sind jetzt gefüllt, Sparklines erscheinen, Verlaufs-Chart
   zeigt Monatsverlauf.

→ Die App ist produktiv einsatzbereit.

---

## 6. Updates

### 6.1 — Voraussetzungen prüfen

Schritt 4.5 (Git-Working-Copy einrichten) muss einmalig erledigt sein. Prüfung:

```bash
cd /opt/eierverkauf && git remote -v
```

Erwartete Ausgabe:
```
origin  https://github.com/muelley86/eierverkauf.git (fetch)
origin  https://github.com/muelley86/eierverkauf.git (push)
```

Wenn leer: Schritt 4.5 nachholen.

### 6.2 — Routinemäßiges Update

Ein einziger Befehl:

```bash
eierverkauf update
```

Was passiert (Gauge zeigt jeden Schritt):

1. **Pre-Update-Backup** der DB nach `/opt/eierverkauf/backups/eierverkauf-YYYYMMDD-HHMMSS.db`
2. `git fetch origin`
3. `git pull --ff-only origin main`
4. `pip install -r requirements.txt` im venv
5. `npm ci` im `frontend/` (strikt nach `package-lock.json` — reproduzierbar)
6. `npm run build`
7. `systemctl restart eierverkauf`

Bei Erfolg: Gauge auf 100 %, anschließend eine Box mit der neuen Versionsnummer und dem
relevanten CHANGELOG-Abschnitt.

Dauer: typisch **3–8 Minuten**, je nachdem wie viele Pakete sich geändert haben.

### 6.3 — Bei Fehler: automatischer Rollback

Wenn ein Schritt scheitert (Git-Konflikt, npm-Timeout, Build-Fehler):

1. Helper stoppt den Service.
2. Spielt das Pre-Update-Backup zurück.
3. Startet den Service neu — **du landest auf dem vorherigen Stand, ohne Datenverlust.**
4. Zeigt Fehlermeldung + Pfad zum Detail-Log.

Du kannst dann nachsehen:
```bash
cat /tmp/eierverkauf-update.log
```

und die Ursache identifizieren. Meist:
- **Git-Konflikt** (`Aborting`): jemand hat lokal Dateien in `/opt/eierverkauf` editiert →
  manuell auflösen mit `git status` / `git checkout`.
- **npm-Netzwerkfehler**: einfach `eierverkauf update` nochmal aufrufen.
- **Build-Fehler in der App**: Bug in der neuen Version melden, vorerst auf alter Version
  bleiben (Rollback hat das schon erledigt).

### 6.4 — Auf einen bestimmten Tag updaten (statt main HEAD)

Wenn du nicht den aktuellen `main`-Stand, sondern einen spezifischen Release-Tag haben willst:

```bash
cd /opt/eierverkauf
git fetch origin --tags
git checkout v1.2.0          # gewünschter Tag — Liste auf GitHub unter "Tags"
./venv/bin/pip install -r requirements.txt
(cd frontend && npm ci && npm run build)
systemctl restart eierverkauf
```

Verifikation:
```bash
eierverkauf status      # zeigt neue Version
```

### 6.5 — Automatische wöchentliche Updates per Cron (optional)

Wenn du immer den `main`-HEAD willst und das nicht händisch tun willst:

```bash
crontab -e -u root
```

Eintrag hinzufügen:
```
0 4 * * 0 /usr/local/bin/eierverkauf update >> /var/log/eierverkauf-cron.log 2>&1
```

→ Sonntags um 04:00 Uhr läuft automatisch ein Update mit Rollback bei Fehler.

> **Vorsicht:** Mit Cron-Auto-Update gehst du ungefragt auf den neuesten `main`-Stand. Wenn du
> kontrolliert auf Tags updaten willst, lass den Cron-Job weg und mache §6.4 manuell.

---

## 7. Backup & Restore

### 7.1 — Backup-Strategie verstehen

Was wird gesichert: die SQLite-Datenbank `/opt/eierverkauf/data/eierverkauf.db`. Sie enthält
**alle** Daten — Importe, Verkaufspositionen, Kundennummern. Verloren ≙ alle Daten weg.

Was **nicht** gesichert wird: hochgeladene CSV-Dateien (`uploads/`) — die kommen aus dem
Warenwirtschaftssystem und können dort erneut exportiert werden, falls nötig.

Wo Backups liegen: `/opt/eierverkauf/backups/eierverkauf-YYYYMMDD-HHMMSS.db`.

### 7.2 — Manuelles Backup

```bash
eierverkauf backup
```

Ergebnis:
```
Backup angelegt: /opt/eierverkauf/backups/eierverkauf-20260512-143022.db
Größe: 1,4M
```

Der Dienst läuft während des Backups weiter — SQLite-WAL macht das atomar.

### 7.3 — Automatisches Backup vor jedem Update

Macht `eierverkauf update` von selbst (siehe §6.2 Schritt 1). Du musst dafür nichts tun.

### 7.4 — Backup auf einen anderen Host kopieren

Beispiel-Cron auf einem **anderen** Server (Backup-Host), der per SSH den LXC erreicht:

```bash
# Beispiel: täglich 02:30 alle Backups vom LXC ziehen
30 2 * * * rsync -av --delete \
  eierverkauf-lxc:/opt/eierverkauf/backups/ \
  /pfad/auf/backup-host/eierverkauf-backups/
```

Niemals die **Live-DB** (`data/eierverkauf.db`) während des Betriebs kopieren — kann
inkonsistent werden. Immer den Helper-Backup-Ordner benutzen.

### 7.5 — Restore (Backup zurückspielen)

```bash
eierverkauf restore
```

Öffnet eine Auswahl der vorhandenen Backups. Du wählst eines aus, der Helper:
- Stoppt den Service
- Kopiert das Backup nach `data/eierverkauf.db`
- Setzt die Rechte (`eierverkauf:eierverkauf`)
- Startet den Service neu

Wenn du das manuell machen willst:
```bash
systemctl stop eierverkauf
cp /pfad/zum/backup.db /opt/eierverkauf/data/eierverkauf.db
chown eierverkauf:eierverkauf /opt/eierverkauf/data/eierverkauf.db
systemctl start eierverkauf
```

### 7.6 — Backup-Retention (Alte Backups aufräumen)

Der `backups/`-Ordner wird **nicht** automatisch aufgeräumt — über Monate sammelt sich da
einiges an. Manuelles Aufräumen, z. B. „nur die letzten 30 behalten":

```bash
find /opt/eierverkauf/backups -name "eierverkauf-*.db" -type f \
  | sort -r | tail -n +31 | xargs -r rm
```

Als Cron-Job einmal pro Woche:
```bash
0 3 * * 1 find /opt/eierverkauf/backups -name "eierverkauf-*.db" -type f | sort -r | tail -n +31 | xargs -r rm
```

---

## 8. Daten-Migration vom alten Server

Falls du von einer früheren Installation (v1.0.x) die Produktiv-DB mitnehmen willst:

### Schritt 8.1 — Backup auf altem Server

```bash
ssh root@<alter-server>
eierverkauf backup
ls -lh /opt/eierverkauf/backups/ | tail -3
```

Den neuesten Backup-Dateinamen merken (z. B. `eierverkauf-20260511-220015.db`).

### Schritt 8.2 — Backup auf neuen Server übertragen

```bash
# Von deinem Arbeitsplatz aus:
scp root@<alter-server>:/opt/eierverkauf/backups/eierverkauf-20260511-220015.db \
    root@<neuer-server>:/tmp/db.bak
```

Oder direkt zwischen den Servern (alter Server muss SSH-Schlüssel auf neuen haben):
```bash
ssh root@<alter-server> \
  "scp /opt/eierverkauf/backups/eierverkauf-20260511-220015.db root@<neuer-server>:/tmp/db.bak"
```

### Schritt 8.3 — Restore auf neuem Server

```bash
ssh root@<neuer-server>
systemctl stop eierverkauf
cp /tmp/db.bak /opt/eierverkauf/data/eierverkauf.db
chown eierverkauf:eierverkauf /opt/eierverkauf/data/eierverkauf.db
systemctl start eierverkauf
```

### Schritt 8.4 — Automatische Schema-Migration

Wenn die alte DB **vor v1.0.4** erstellt wurde (UNIQUE-Constraint ohne `rechnungsdatum`), läuft
beim ersten Start eine automatische Migration:

1. Sicherheitskopie der DB → `data/eierverkauf.db.pre-v1.0.4.bak`
2. `verkaufspositionen` wird mit neuem Constraint neu aufgebaut, alle Zeilen 1:1 übernommen
3. Indizes neu angelegt

Verifikation:
```bash
journalctl -u eierverkauf -n 100 --no-pager | grep -E "\[migration\]|\[startup\]"
```

Bei aktiver Migration erscheint:
```
[migration] verkaufspositionen: 8423 Zeilen migriert
```

Wenn die DB schon v1.0.4+ war: kein `[migration]`-Eintrag, alles läuft normal weiter.

### Schritt 8.5 — Validierung im Browser

`http://<neuer-server-ip>:8050` öffnen, prüfen:
- KPIs „Eier", „Umsatz", „Kunden", „Positionen" haben Werte
- Verlaufs-Chart zeigt Daten
- `/ranking` zeigt die Top-10-Kunden
- `/import` listet alle bisherigen Importe

Wenn alles aussieht wie auf dem alten Server: Migration ist erfolgreich.

---

## 9. Optional: Reverse-Proxy mit HTTPS

Per Default lauscht die App auf `:8050` **ohne** Verschlüsselung. Für rein internen LAN-Zugriff
reicht das oft. Wenn du HTTPS oder einen DNS-Namen statt IP willst, brauchst du einen
Reverse-Proxy.

### Option A — Caddy (am einfachsten, automatisches Let's Encrypt)

```bash
# Caddy-Repo einbinden
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  > /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy
```

`/etc/caddy/Caddyfile` editieren:
```
eier.example.com {
    reverse_proxy 127.0.0.1:8050
    request_body {
        max_size 50MB
    }
}
```

```bash
systemctl reload caddy
```

Voraussetzungen für TLS:
- Port **80** und **443** vom Internet erreichbar (Firewall offen)
- DNS A-/AAAA-Record `eier.example.com` zeigt auf deine Server-IP
- Caddy holt automatisch ein gültiges Zertifikat von Let's Encrypt

### Option B — Nginx (mehr Kontrolle, manuelles certbot)

```bash
apt-get install -y nginx
```

`/etc/nginx/sites-available/eierverkauf.conf`:
```nginx
server {
    listen 80;
    server_name eier.example.com;

    client_max_body_size 50M;     # CSV-Uploads können groß sein

    location / {
        proxy_pass http://127.0.0.1:8050;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;            # PDF-Export kann dauern
    }
}
```

```bash
ln -s /etc/nginx/sites-available/eierverkauf.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# TLS via certbot
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d eier.example.com
```

---

## 10. Wartungs-Befehle (`eierverkauf …`)

Der Symlink `/usr/local/bin/eierverkauf` ruft `eierverkauf-helper.sh` auf. Alle Befehle:

| Befehl | Wirkung |
|---|---|
| `eierverkauf` | Öffnet ein interaktives Menü (whiptail) mit allen Aktionen |
| `eierverkauf status` | Service-Status + Version + DB-Größe + Datensatz-Anzahl + URL |
| `eierverkauf update` | Update durchführen (siehe §6) |
| `eierverkauf restart` | Service neu starten |
| `eierverkauf stop` | Service stoppen |
| `eierverkauf start` | Service starten |
| `eierverkauf logs` | Live-Logs (Strg+C zum Beenden) |
| `eierverkauf backup` | DB-Backup erzeugen (siehe §7) |
| `eierverkauf restore` | Backup zurückspielen — Liste der vorhandenen Backups erscheint (siehe §7) |
| `eierverkauf uninstall` | Komplette Deinstallation (siehe §12) |

Alle Befehle laufen auch ohne Terminal-UI (z. B. via SSH ohne TTY oder Cron) — die whiptail-Maske
fällt dann auf einfaches Text-IO zurück.

---

## 11. Troubleshooting

### 11.1 — Authentifizierung beim Clone schlägt fehl

```
remote: Invalid username or token. Password authentication is not supported …
fatal: Authentication failed for 'https://github.com/muelley86/eierverkauf.git/'
```

**Ursache:** Das Repo ist privat. GitHub erlaubt seit 2021 keine Passwort-Authentifizierung
mehr für Git-Operationen.

**Lösungen:**

1. **Einfachster Weg — Repo öffentlich machen.** Code enthält keine Credentials oder
   Geschäftsgeheimnisse. Browser: <https://github.com/muelley86/eierverkauf/settings> →
   Danger Zone → „Change visibility" → Public.

2. **Deploy-Key (SSH, read-only).** Beste Lösung wenn privat bleiben muss:
   ```bash
   ssh-keygen -t ed25519 -f /root/.ssh/eierverkauf_deploy -N "" -C "eierverkauf-lxc"
   cat /root/.ssh/eierverkauf_deploy.pub
   ```
   Den ausgegebenen Key auf <https://github.com/muelley86/eierverkauf/settings/keys> als
   Deploy Key einfügen (Read-only). Dann SSH-Config:
   ```bash
   cat >> /root/.ssh/config <<'EOF'
   Host github.com
     HostName github.com
     User git
     IdentityFile /root/.ssh/eierverkauf_deploy
     IdentitiesOnly yes
   EOF
   chmod 600 /root/.ssh/config
   ssh -T -o StrictHostKeyChecking=accept-new git@github.com
   ```
   Statt der `https://`-URL überall `git@github.com:muelley86/eierverkauf.git` nutzen.

3. **Personal Access Token (PAT).** GitHub-Account → Settings → Developer settings →
   Personal access tokens → Fine-grained → Generate. Scope „Contents: Read-only" auf dem
   Repo. Token kopieren, dann clonen mit:
   ```bash
   git clone https://muelley86:<TOKEN>@github.com/muelley86/eierverkauf.git /tmp/eierverkauf-source
   ```
   ⚠️ Der Token landet sichtbar in `/opt/eierverkauf/.git/config` — weniger sauber.

### 11.2 — „remote origin already exists"

```
error: remote origin already exists.
```

**Ursache:** Du führst einen `git remote add origin …` aus, aber `origin` ist schon gesetzt
(z. B. weil du den Schritt schon einmal gemacht hast oder das Verzeichnis bereits ein Clone ist).

**Lösung:** Mit `git remote -v` prüfen, ob die URL stimmt. Falls ja → ignorieren, du bist fertig.
Falls die URL falsch ist:
```bash
git remote set-url origin https://github.com/muelley86/eierverkauf.git
```

### 11.3 — Dienst startet nicht

```bash
systemctl status eierverkauf --no-pager -l
journalctl -u eierverkauf -n 100 --no-pager
```

Häufige Ursachen:

| Symptom im Log | Lösung |
|---|---|
| `Address already in use` | Port 8050 belegt. `ss -tlnp \| grep 8050` zeigt blockierenden Prozess. |
| `Permission denied … data/eierverkauf.db` | `chown -R eierverkauf:eierverkauf /opt/eierverkauf` |
| `database disk image is malformed` | DB korrupt → Restore aus letztem Backup (§7.5) |
| `ModuleNotFoundError: No module named '…'` | venv defekt → siehe 11.4 |
| `OSError: cannot load library 'libpango…'` | WeasyPrint-Libs fehlen → `apt-get install -y libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b libfontconfig1 libcairo2 libgdk-pixbuf-2.0-0` |

### 11.4 — Python-venv defekt

Selten — meist nach manuellen Eingriffen in `/opt/eierverkauf/venv/`. Neu aufsetzen:

```bash
systemctl stop eierverkauf
rm -rf /opt/eierverkauf/venv
python3 -m venv /opt/eierverkauf/venv
/opt/eierverkauf/venv/bin/pip install --upgrade pip
/opt/eierverkauf/venv/bin/pip install -r /opt/eierverkauf/requirements.txt
chown -R eierverkauf:eierverkauf /opt/eierverkauf/venv
systemctl start eierverkauf
```

### 11.5 — Frontend zeigt veraltete Version

1. Browser-Cache hartes Reload: **Strg+Umschalt+R** (Windows/Linux) oder **Cmd+Umschalt+R** (Mac).
2. Wenn das nichts hilft, im LXC prüfen:
   ```bash
   ls -la /opt/eierverkauf/frontend/dist/ | head -5
   ```
   Zeitstempel muss nach dem letzten Update aktuell sein. Wenn alt → Build ist gescheitert:
   ```bash
   cd /opt/eierverkauf/frontend
   sudo -u eierverkauf npm ci
   sudo -u eierverkauf npm run build
   systemctl restart eierverkauf
   ```

### 11.6 — CSV-Import scheitert mit fehlerhaften Zeilen

Ab v1.0.3 hat jeder Import ein **persistentes Protokoll**. Nach dem Upload Klick auf den
Toast oder Sidebar → Import → der zuletzt importierte Eintrag → Details:

- Liste der fehlerhaften Zeilen mit CSV-Zeilennummer, Grund, Rohdaten
- Header-Warnungen (falls Spalten nicht zuverlässig erkannt wurden)

Wenn `header_warnungen[]` Einträge wie „Spalte … nicht eindeutig zuordnenbar" zeigt: die
CSV-Header weichen vom erwarteten Muster ab. Lösung: CSV manuell prüfen, Header-Zeile mit
den kanonischen Namen versehen (siehe `HEADER_PATTERNS` in `data/importer.py`).

### 11.7 — PDF-Export liefert 500

Auf Debian-LXCs selten — die WeasyPrint-System-Libs sind in `install.sh` enthalten. Wenn doch:

```bash
apt-get install -y libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b \
                   libfontconfig1 libcairo2 libgdk-pixbuf-2.0-0
systemctl restart eierverkauf
```

### 11.8 — Disk voll

```bash
du -sh /opt/eierverkauf/*
```

Üblicher Übeltäter: `frontend/node_modules` (~400 MB, nötig fürs Bauen — **nicht löschen**)
und `backups/` über Monate gesammelt. Letzteres aufräumen wie in §7.6.

### 11.9 — Logs sammeln (für Support-Anfragen)

```bash
# Service-Logs der letzten Stunde
journalctl -u eierverkauf --since "1 hour ago" --no-pager > /tmp/journal.log

# Install-Log (falls relevant)
cat /var/log/eierverkauf-install.log

# Update-Log (falls Update fehlschlug)
cat /tmp/eierverkauf-update.log

# Helper-Log
cat /var/log/eierverkauf-helper.log 2>/dev/null || echo "Helper-Log nicht vorhanden"
```

Diese vier Dateien zusammen reichen für die meisten Diagnosen.

### 11.10 — Update bricht bei 55 % ab (Node.js-Abhängigkeiten)

55 % ist der `npm ci`-Schritt. Bis v1.6.0 lief npm dort mit `--silent`, deshalb konnte die
Fehlerbox nach dem Abbruch leer bleiben — seit v1.6.1 landet der echte npm-Fehler im
Update-Log:

```bash
tail -30 /tmp/eierverkauf-update.log
```

Häufige Ursachen:

1. **Node-Version zu alt für neue Abhängigkeiten** (Log: `EBADENGINE` / „Unsupported engine").
   Prüfen mit `node -v`. Bei Alt-Installationen mit Node < 20.19 auf das aktuelle
   Node 20 LTS heben:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
   apt-get install -y nodejs
   ```
2. **Registry nicht erreichbar** (Log: `ECONNRESET`, `ETIMEDOUT`, `EAI_AGAIN`). Updates
   brauchen Internet inkl. `registry.npmjs.org` (siehe §2) — Verbindung prüfen und das
   Update einfach erneut ausführen.
3. **Disk voll** (Log: `ENOSPC`) → siehe §11.8.

Das Update ist gefahrlos wiederholbar: `npm ci` baut node_modules ohnehin jedes Mal neu
auf, und die Datenbank wurde beim Abbruch automatisch aus dem Pre-Update-Backup
wiederhergestellt. Nach behobener Ursache also einfach nochmal `eierverkauf update`.

---

## 12. Deinstallation

Komfortabel über den Helper:

```bash
eierverkauf uninstall
```

Fragt nach, ob die Daten (`data/`, `uploads/`, `backups/`) erhalten bleiben sollen. Bei „nein"
wird `/opt/eierverkauf` komplett entfernt, der systemd-Service und der
`/usr/local/bin/eierverkauf`-Symlink ebenfalls.

Bei „ja" bleibt `/opt/eierverkauf/data/` und `/opt/eierverkauf/backups/` für einen späteren
Restore liegen.

Manuell (falls der Helper nicht funktioniert):

```bash
systemctl stop eierverkauf
systemctl disable eierverkauf
rm /etc/systemd/system/eierverkauf.service
rm /usr/local/bin/eierverkauf
systemctl daemon-reload
userdel eierverkauf 2>/dev/null
rm -rf /opt/eierverkauf       # Achtung: enthält Daten + Backups!
```

---

## 13. Anhang: Versions-Konvention und Datei-Layout

### Versions-Konvention

- **Tags** auf GitHub: `v<MAJOR>.<MINOR>.<PATCH>` (z. B. `v1.1.0`) — **empfohlene Update-Referenz**
  für Produktivserver. Liste unter <https://github.com/muelley86/eierverkauf/tags>.
- **`VERSION`-Datei** im Repo: enthält die Versionsnummer in Klartext, wird vom Helper gelesen
  und in `eierverkauf status` angezeigt.
- **`CHANGELOG.md`**: Keep-a-Changelog-Format. Jeder Release-Tag hat einen Abschnitt mit
  „Hinzugefügt / Geändert / Behoben / Hinweise zum Update".
- **`main.py`** trägt die FastAPI-`version="X.Y.Z"` — wird beim Release manuell mitgezogen.

Bei jedem Release sind diese drei Stellen synchron zu halten: `VERSION`, `CHANGELOG.md`,
`main.py:version`.

### Datei-Layout auf dem Server

```
/opt/eierverkauf/
├── main.py                     # FastAPI-App-Einstieg
├── VERSION                     # "1.1.0\n"
├── CHANGELOG.md
├── DEPLOYMENT.md               # diese Anleitung
├── README.md
├── requirements.txt
├── eierverkauf-helper.sh       # Symlink-Ziel /usr/local/bin/eierverkauf
├── install.sh                  # Erstinstallation
├── api/                        # FastAPI-Router (Auswertung, Import, Export)
├── data/
│   ├── db.py                   # Schema-Definition + Migration
│   ├── importer.py             # CSV-Parser
│   ├── queries.py              # SQL-Auswertungs-Queries
│   └── eierverkauf.db          # ←  Produktiv-DB (gitignored)
├── export/                     # Excel + PDF Generierung
├── frontend/
│   ├── src/                    # React-Quellcode
│   ├── dist/                   # gebautes Frontend (gitignored, kommt aus npm run build)
│   ├── package.json
│   └── …
├── uploads/                    # hochgeladene CSV-Dateien (gitignored)
├── backups/                    # eierverkauf-YYYYMMDD-HHMMSS.db (gitignored)
├── logs/                       # gitignored
└── venv/                       # Python-virtualenv (gitignored)
```

### Wichtige System-Pfade

| Pfad | Inhalt |
|---|---|
| `/usr/local/bin/eierverkauf` | Symlink zum Helper-Skript |
| `/etc/systemd/system/eierverkauf.service` | systemd-Unit |
| `/var/log/eierverkauf-install.log` | Installer-Log |
| `/tmp/eierverkauf-update.log` | Letztes Update-Log |
| `/var/log/eierverkauf-helper.log` | Helper-Log (falls aktiviert) |

### Service-Konto

Die App läuft als Linux-User `eierverkauf` (UID & GID werden automatisch vergeben). Login ist
deaktiviert (`/usr/sbin/nologin`). Home-Verzeichnis: `/opt/eierverkauf`.

---

**Letzte Aktualisierung:** v1.1.0 — 12. Mai 2026
