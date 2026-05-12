# Deployment-Handbuch — Eierverkauf-Auswertungs-App

Diese Anleitung beschreibt **alle Schritte**, die auf einem produktiven Server (LXC-Container,
VM oder Bare-Metal mit Debian 13 „Trixie") nötig sind, um die App einzurichten und auf einem
sauberen Stand zu halten.

Zielgruppe: Administrator·in, der/die den Container betreibt. Vorausgesetzt werden Grundkenntnisse
in Linux-Shell und systemd. **Kein Vorwissen zu Python, Node.js oder FastAPI nötig.**

---

## Inhaltsverzeichnis

1. [Voraussetzungen](#1-voraussetzungen)
2. [Erstinstallation](#2-erstinstallation)
3. [Updates](#3-updates)
4. [Backup & Restore](#4-backup--restore)
5. [Daten-Migration vom alten Server](#5-daten-migration-vom-alten-server)
6. [Optionaler Reverse-Proxy mit TLS](#6-optionaler-reverse-proxy-mit-tls)
7. [Wartungs-Befehle (`eierverkauf`)](#7-wartungs-befehle-eierverkauf)
8. [Troubleshooting](#8-troubleshooting)
9. [Deinstallation](#9-deinstallation)

---

## 1. Voraussetzungen

### System

| Punkt | Anforderung |
|---|---|
| Betriebssystem | Debian 13 „Trixie" (Ubuntu 22.04+ funktioniert ebenfalls, aber nur Debian wird getestet) |
| Architektur | `amd64` oder `arm64` |
| Freier Speicher | mind. **2 GB** auf `/` (Node-Modules, npm-Build, venv, WeasyPrint-Libs zusammen ~1,5 GB) |
| RAM | mind. **512 MB** für den Service; während `npm run build` kurzzeitig bis ~1 GB |
| Port | **8050** intern frei (kann via Reverse-Proxy auf 80/443 gemappt werden, siehe §6) |
| Internetzugang | Während Erstinstallation und Updates zwingend: `deb.debian.org`, `deb.nodesource.com`, `registry.npmjs.org`, `github.com`. **Im laufenden Betrieb nicht nötig** — die App ist offline-fähig. |
| Rechte | Root oder sudo |

### Bei LXC unter Proxmox

- **Unprivilegierter Container reicht** — die App braucht keine Kernel-Capabilities.
- Empfohlene Ressourcen: 2 vCPU, 1 GB RAM, 8 GB Disk.
- Static IP empfohlen — die URL ändert sich sonst bei jedem DHCP-Lease-Wechsel.

### Quelle

GitHub-Repository: <https://github.com/muelley86/eierverkauf>

> **Hinweis:** Repo ist privat. Auf dem Server entweder einen Personal Access Token (PAT)
> mit `repo`-Scope hinterlegen, einen Deploy-Key einrichten, **oder** das Repo öffentlich
> schalten. Die einfachste Variante für ein internes Setup: ein read-only Deploy-Key.
> Details: <https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys>

---

## 2. Erstinstallation

### Schritt 2.1 — LXC/Server bereitstellen

LXC anlegen (Beispiel Proxmox-Shell, dein Hypervisor-Workflow kann abweichen):

```bash
pct create <CT-ID> local:vztmpl/debian-13-standard_*.tar.zst \
  --hostname eierverkauf --cores 2 --memory 1024 --rootfs local-lvm:8 \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp --unprivileged 1 --features nesting=1
pct start <CT-ID>
pct enter <CT-ID>
```

Ab hier alle Schritte **als root im Container**.

### Schritt 2.2 — Git installieren

```bash
apt-get update
apt-get install -y git
```

### Schritt 2.3 — Repo nach `/tmp/` clonen

⚠️ **Nicht direkt nach `/opt/eierverkauf` clonen** — der Installer rsync't selbst dorthin
und würde sich sonst mit dem Clone überlagern.

```bash
git clone https://github.com/muelley86/eierverkauf.git /tmp/eierverkauf-source
cd /tmp/eierverkauf-source
git checkout v1.1.0    # auf den Release-Tag pinnen — reproduzierbare Installation
```

> **Warum ein Tag?** Wenn du `git checkout v1.1.0` weglässt, installierst du den aktuellen
> Stand von `main` — der kann zwischen zwei Server-Setups divergieren. Mit Tag sind alle
> Installationen identisch nachvollziehbar.

### Schritt 2.4 — Installer ausführen

```bash
bash install.sh
```

Der Installer öffnet eine `whiptail`-Maske. Die Frage „Installation starten?" mit **Ja**
bestätigen. Anschließend läuft eine Gauge-Anzeige durch folgende Phasen:

1. apt-Pakete aktualisieren
2. Systempakete installieren (Python, Git, Whiptail, SQLite, WeasyPrint-Bibliotheken: Pango, Cairo, Harfbuzz, …)
3. Node.js 20 LTS einrichten (NodeSource-Repository)
4. Systembenutzer `eierverkauf` anlegen (`/usr/sbin/nologin`)
5. Verzeichnis `/opt/eierverkauf/{data,uploads,backups,logs}` anlegen
6. Code aus `/tmp/eierverkauf-source/` per `rsync` nach `/opt/eierverkauf/` kopieren (ohne `.git`)
7. Python-venv + `requirements.txt` installieren
8. `npm install` im `frontend/`
9. `npm run build` → erzeugt `frontend/dist/`
10. systemd-Unit `/etc/systemd/system/eierverkauf.service` schreiben (User `eierverkauf`, Port 8050)
11. Helper-Skript `eierverkauf-helper.sh` → Symlink `/usr/local/bin/eierverkauf`
12. Berechtigungen auf `eierverkauf:eierverkauf` setzen
13. Service starten

Am Ende erscheint eine Erfolgs-Meldung mit der URL `http://<lxc-ip>:8050`. **Diese URL kurz
im Browser aufrufen** — die leere „Übersicht"-Seite sollte laden.

### Schritt 2.5 — Git-Working-Copy für spätere Updates einrichten

Der `install.sh` hat den `.git`-Ordner bewusst nicht mitkopiert (siehe `--exclude '.git'` im
rsync-Aufruf). Damit `eierverkauf update` später per `git pull` funktioniert, muss
`/opt/eierverkauf` jetzt einmalig zum Git-Working-Copy gemacht werden:

```bash
cd /opt/eierverkauf
git init -q
git remote add origin https://github.com/muelley86/eierverkauf.git
git fetch origin
git reset --hard v1.1.0
chown -R eierverkauf:eierverkauf .git
```

Erklärung:
- `git init -q` legt ein leeres `.git/`-Verzeichnis an, ohne die Working-Copy-Dateien
  zu verändern.
- `git remote add origin …` verknüpft mit GitHub.
- `git fetch origin` lädt alle Refs (Branches + Tags), keine Working-Copy-Änderung.
- `git reset --hard v1.1.0` setzt den `HEAD`-Pointer auf den Release-Commit — da die Dateien
  schon dieser Version entsprechen (Schritt 2.3+2.4), passiert hier **keine Datei-Änderung**,
  nur der Pointer wird gesetzt.
- `chown` korrigiert die Eigentümer von `.git/` (der `git init`-Aufruf lief als root).

### Schritt 2.6 — Quellverzeichnis aufräumen

```bash
rm -rf /tmp/eierverkauf-source
```

### Schritt 2.7 — Smoke-Test

```bash
eierverkauf status
```

Erwartete Ausgabe: Dienst `active (running)`, Version `1.1.0`, URL `http://<ip>:8050`.

Browser-Test:
1. `http://<lxc-ip>:8050/` → Übersicht lädt (zunächst leer, weil keine CSV importiert).
2. Linke Sidebar → **Import** → eine CSV aus dem Warenwirtschaftsexport hochladen.
3. Zurück auf **Übersicht** → KPIs sind gefüllt, Sparklines erscheinen, Verlaufs-Chart läuft.

→ Installation ist abgeschlossen.

---

## 3. Updates

### Voraussetzung

Schritt 2.5 muss einmalig ausgeführt worden sein (Git-Working-Copy mit Remote `origin/main`).
Prüfung:

```bash
cd /opt/eierverkauf && git remote -v
```

Erwartete Ausgabe:
```
origin  https://github.com/muelley86/eierverkauf.git (fetch)
origin  https://github.com/muelley86/eierverkauf.git (push)
```

Wenn leer → Schritt 2.5 nachholen.

### Routinemäßiges Update

```bash
eierverkauf update
```

Was passiert in dieser Reihenfolge (jeweils mit `whiptail`-Gauge):

1. **Pre-Update-Backup** der aktuellen DB → `/opt/eierverkauf/backups/eierverkauf-YYYYMMDD-HHMMSS.db`
2. `git fetch origin`
3. `git pull --ff-only origin main` — schlägt fehl, wenn lokal divergiert (selten, dann manuell auflösen)
4. `pip install -r requirements.txt` im venv (idempotent — installiert nur neue/aktualisierte Pakete)
5. `npm ci` im `frontend/` — installiert Node-Module **strikt nach `package-lock.json`** (reproduzierbar)
6. `npm run build` → neuer `frontend/dist/`
7. `systemctl restart eierverkauf`

Bei Erfolg: Gauge geht auf 100 %, der Helper zeigt die neue Version + den Changelog-Abschnitt
für diese Version an.

### Bei Fehler

Wenn ein Schritt scheitert (Git-Konflikt, npm-Fehler, Build-Bug):

1. Helper stoppt den Service.
2. Spielt das Pre-Update-Backup zurück nach `/opt/eierverkauf/data/eierverkauf.db`.
3. Startet den Service neu — du landest auf dem **vorherigen** Stand.
4. Zeigt eine Fehlermeldung mit Exit-Code und Pfad zum Log (`/tmp/eierverkauf-update.log`).

Dann manuell:

```bash
cat /tmp/eierverkauf-update.log
# Ursache identifizieren — meist git-Konflikt oder npm-Netzwerkfehler
```

### Auf einen bestimmten Tag updaten (statt main HEAD)

```bash
cd /opt/eierverkauf
git fetch origin --tags
git checkout v1.2.0      # gewünschter Tag
./venv/bin/pip install -r requirements.txt
(cd frontend && npm ci && npm run build)
systemctl restart eierverkauf
```

Wenn du dauerhaft auf Tags statt `main` arbeiten willst, kannst du das Helper-Script anpassen
oder eine Cron-Wrapper schreiben.

### Cron-Update (optional)

Das Helper-Script ist Cron-tauglich (kein interaktiver Input):

```bash
echo '0 4 * * 0 /usr/local/bin/eierverkauf update >> /var/log/eierverkauf-cron.log 2>&1' \
  | crontab -
```

Effekt: Sonntags um 04:00 Uhr automatisches Update + Rollback bei Fehler.

> **Vorsicht bei Cron-Update + Tag-Strategie:** Wenn du gerne kontrolliert auf Tags updaten
> willst, ist Cron der falsche Weg — er pullt `main` ungefragt. In dem Fall: Cron weglassen
> und manuell aktualisieren.

---

## 4. Backup & Restore

### Manuelles Backup

```bash
eierverkauf backup
```

Legt eine zeitgestempelte Kopie der DB unter `/opt/eierverkauf/backups/eierverkauf-YYYYMMDD-HHMMSS.db` an.
Der Dienst läuft während des Backups weiter — SQLite-WAL macht das atomar.

### Backup auf einen anderen Host kopieren

```bash
# Vom LXC pulln auf Backup-Host (Beispiel):
scp eierverkauf-server:/opt/eierverkauf/backups/eierverkauf-*.db /pfad/zum/backupziel/

# Oder per rsync regelmäßig:
rsync -av eierverkauf-server:/opt/eierverkauf/backups/ /pfad/zum/backupziel/
```

Die `data/`-Verzeichnis selbst (Live-DB + WAL-Files) **nicht** kopieren während der Dienst läuft.

### Restore

```bash
eierverkauf restore
```

Öffnet eine Auswahl der vorhandenen Backups im `backups/`-Ordner und stellt das gewählte zurück.
**Stoppt den Service vorher, startet ihn danach automatisch neu.**

Manuell:

```bash
systemctl stop eierverkauf
cp /pfad/zum/backup.db /opt/eierverkauf/data/eierverkauf.db
chown eierverkauf:eierverkauf /opt/eierverkauf/data/eierverkauf.db
systemctl start eierverkauf
```

### Backup-Retention

`backups/` wird nicht automatisch aufgeräumt. Wenn das relevant wird:

```bash
# Z. B. nur die letzten 30 Backups behalten
find /opt/eierverkauf/backups -name "eierverkauf-*.db" -type f \
  | sort -r | tail -n +31 | xargs -r rm
```

In Cron packen, falls dauerhaft gewünscht.

---

## 5. Daten-Migration vom alten Server

Wenn du von einer früheren Installation (v1.0.x) die Produktiv-DB auf den neuen LXC bringen
willst:

### Schritt 5.1 — Backup auf altem Server erzeugen

```bash
ssh root@<alter-server>
eierverkauf backup
ls -lh /opt/eierverkauf/backups/ | tail -3
```

Den neuesten Backup-Dateinamen merken.

### Schritt 5.2 — Backup auf neuen Server übertragen

```bash
scp root@<alter-server>:/opt/eierverkauf/backups/eierverkauf-XXXXXXXX-XXXXXX.db \
    root@<neuer-server>:/tmp/db.bak
```

### Schritt 5.3 — Restore auf neuem Server

```bash
ssh root@<neuer-server>
systemctl stop eierverkauf
cp /tmp/db.bak /opt/eierverkauf/data/eierverkauf.db
chown eierverkauf:eierverkauf /opt/eierverkauf/data/eierverkauf.db
systemctl start eierverkauf
```

### Schritt 5.4 — Schema-Migration prüfen

Beim ersten Start nach dem Restore prüft das Backend automatisch das Schema. Falls die DB
**vor v1.0.4** erstellt wurde (UNIQUE-Constraint ohne `rechnungsdatum`), läuft eine
automatische Migration:

```bash
journalctl -u eierverkauf -n 50 --no-pager | grep -E "\[migration\]|\[startup\]"
```

Erwartete Logzeile bei aktiver Migration:
```
[migration] verkaufspositionen: 8423 Zeilen migriert
```

Eine Sicherheitskopie der DB landet automatisch unter `data/eierverkauf.db.pre-v1.0.4.bak`.

Wenn die DB schon v1.0.4+ war: kein `[migration]`-Eintrag, alles läuft normal weiter.

### Schritt 5.5 — Validierung

Browser öffnen, `/dashboard`, prüfen:
- KPIs „Eier", „Umsatz", „Kunden", „Positionen" haben Werte
- Verlaufs-Chart zeigt Daten
- `/ranking` zeigt die Top-10-Kunden
- `/import` listet alle bisherigen Importe

---

## 6. Optionaler Reverse-Proxy mit TLS

Per Default lauscht der Service auf `:8050` ohne Verschlüsselung. Für internen LAN-Zugriff
ist das oft ausreichend. Für externen Zugriff oder TLS:

### Option A — Nginx

```bash
apt-get install -y nginx
```

`/etc/nginx/sites-available/eierverkauf.conf`:

```nginx
server {
    listen 80;
    server_name eier.example.com;

    client_max_body_size 50M;   # CSV-Uploads können groß sein

    location / {
        proxy_pass http://127.0.0.1:8050;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;          # PDF-Export kann dauern
    }
}
```

```bash
ln -s /etc/nginx/sites-available/eierverkauf.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

TLS-Zertifikat via Certbot:
```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d eier.example.com
```

### Option B — Caddy (einfacher, TLS automatisch)

```bash
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  > /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy
```

`/etc/caddy/Caddyfile`:
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

Caddy holt automatisch ein Let's-Encrypt-Zertifikat (Voraussetzung: Port 80/443 erreichbar,
DNS auf den Server zeigt).

---

## 7. Wartungs-Befehle (`eierverkauf`)

Der Symlink `/usr/local/bin/eierverkauf` ruft `eierverkauf-helper.sh` auf. Befehle:

| Befehl | Wirkung |
|---|---|
| `eierverkauf` | öffnet das interaktive Menü (whiptail) |
| `eierverkauf status` | Service-Status + Version + URL |
| `eierverkauf update` | Update durchführen (siehe §3) |
| `eierverkauf restart` | Service neu starten |
| `eierverkauf stop` | Service stoppen |
| `eierverkauf start` | Service starten |
| `eierverkauf logs` | Live-Logs (`journalctl -u eierverkauf -f`) — Strg+C zum Beenden |
| `eierverkauf backup` | DB-Backup erzeugen |
| `eierverkauf restore` | Backup zurückspielen (Auswahl) |
| `eierverkauf uninstall` | Komplette Deinstallation (siehe §9) |

Alle Befehle sind auch außerhalb von whiptail (z. B. via SSH ohne TTY) bedienbar — die
Maske fällt dann auf einfaches Text-IO zurück.

---

## 8. Troubleshooting

### „Dienst startet nicht"

```bash
systemctl status eierverkauf --no-pager -l
journalctl -u eierverkauf -n 100 --no-pager
```

Häufigste Ursachen:
- **Port 8050 belegt** — `ss -tlnp | grep 8050` zeigt den blockierenden Prozess.
- **Berechtigung auf `data/`** — `chown -R eierverkauf:eierverkauf /opt/eierverkauf` fix.
- **Datenbank korrupt** — Restore aus letztem Backup (§4).
- **`venv` defekt** nach manuellen Eingriffen — neu aufsetzen:
  ```bash
  rm -rf /opt/eierverkauf/venv
  python3 -m venv /opt/eierverkauf/venv
  /opt/eierverkauf/venv/bin/pip install -r /opt/eierverkauf/requirements.txt
  chown -R eierverkauf:eierverkauf /opt/eierverkauf/venv
  systemctl restart eierverkauf
  ```

### „CSV-Import scheitert stillschweigend"

Ab v1.0.3 hat jeder Import ein **persistentes Protokoll**. Nach dem Upload erscheint
ein Toast — der Link führt auf `/import/<id>` mit:
- Zeilen-Statistik (importiert / übersprungen / fehlerhaft)
- Liste der fehlerhaften Zeilen mit CSV-Zeilennummer, Grund, Rohdaten
- Header-Warnungen (falls Spalten nicht zuverlässig erkannt wurden)

Das Protokoll bleibt auch nach Browser-Refresh erhalten.

Wenn `header_warnungen[]` Einträge wie „Spalte … nicht eindeutig zuordnenbar" zeigt: die
CSV-Header weichen vom erwarteten Muster ab. Lösung: CSV manuell prüfen, Header-Zeile
mit den kanonischen Namen versehen (siehe `HEADER_PATTERNS` in `data/importer.py`).

### „PDF-Export liefert 500"

Auf Debian-Servern selten — die WeasyPrint-System-Libs (Pango, Cairo, Harfbuzz) sind in
`install.sh` enthalten. Wenn doch:

```bash
apt-get install -y libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b \
                   libfontconfig1 libcairo2 libgdk-pixbuf-2.0-0
systemctl restart eierverkauf
```

### Logs sammeln

```bash
# Service-Logs (systemd-Journal)
journalctl -u eierverkauf --since "1 hour ago" --no-pager > /tmp/journal.log

# Install/Update-Logs
cat /var/log/eierverkauf-install.log    # falls vorhanden
cat /tmp/eierverkauf-update.log         # nach Update-Versuch

# Helper-Log
cat /var/log/eierverkauf-helper.log     # falls Helper das schreibt
```

### „Frontend zeigt veraltete Version"

Browser-Cache: hartes Reload (Strg+Umschalt+R / Cmd+Umschalt+R). Wenn das nicht hilft:

```bash
ls -la /opt/eierverkauf/frontend/dist/  # Zeitstempel muss nach Update aktuell sein
```

Wenn `dist/` älter als der letzte Update ist: `npm run build` ist gescheitert. Manuell:

```bash
cd /opt/eierverkauf/frontend
sudo -u eierverkauf npm ci
sudo -u eierverkauf npm run build
systemctl restart eierverkauf
```

### Disk voll

```bash
du -sh /opt/eierverkauf/*
```

Üblicher Übeltäter: `/opt/eierverkauf/frontend/node_modules` (~400 MB) plus `backups/` über
Monate. node_modules ist nötig zum Bauen — nicht löschen. backups manuell aufräumen (§4).

---

## 9. Deinstallation

```bash
eierverkauf uninstall
```

Fragt nach, ob die Daten (`data/`, `uploads/`, `backups/`) erhalten bleiben sollen. Bei „nein"
wird `/opt/eierverkauf` komplett entfernt, der systemd-Service und der `/usr/local/bin/eierverkauf`-Symlink ebenfalls.

Bei „ja" bleibt `/opt/eierverkauf/data/` und `/opt/eierverkauf/backups/` für einen späteren
Restore liegen.

Manuell:

```bash
systemctl stop eierverkauf
systemctl disable eierverkauf
rm /etc/systemd/system/eierverkauf.service
rm /usr/local/bin/eierverkauf
systemctl daemon-reload
userdel eierverkauf 2>/dev/null
rm -rf /opt/eierverkauf       # achtung: enthält Daten + Backups!
```

---

## Anhang: Versions-Konvention

- **Tags**: `v<MAJOR>.<MINOR>.<PATCH>` (z. B. `v1.1.0`) — werden auf GitHub gepusht und sind die
  empfohlene Update-Referenz für Produktivserver.
- **VERSION-Datei**: enthält die Versionsnummer in Klartext, wird vom Helper-Script gelesen.
- **CHANGELOG.md**: Keep-a-Changelog-Format. Jeder Release-Tag hat einen Abschnitt mit
  „Hinzugefügt / Geändert / Behoben / Hinweise zum Update".
- **`main.py`** trägt die FastAPI-`version="X.Y.Z"` — wird beim Release manuell mitgezogen.

Bei jedem Release sind diese drei Stellen synchron zu halten: `VERSION`, `CHANGELOG.md`,
`main.py:version`.

---

**Letzte Aktualisierung dieser Anleitung:** v1.1.0 (12. Mai 2026)
