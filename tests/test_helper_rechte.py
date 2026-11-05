"""Tests für die Rechtetrennung im Verwaltungs-Skript (eierverkauf-helper.sh).

root führt das Helper-Skript, venv/bin/pip und npm aus. Diese Dateien dürfen
deshalb nicht dem Dienstkonto gehören, unter dem die Web-App läuft — sonst
kann ein kompromittierter App-Prozess Code als root ausführen.

Die Tests sourcen das Skript in bash, biegen alle Systempfade auf tmp_path
um und ersetzen chown/chmod/systemctl durch protokollierende Funktionen.
"""
import subprocess
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parent.parent
HELPER = REPO / "eierverkauf-helper.sh"
INSTALLER = REPO / "install.sh"


@pytest.fixture(autouse=True)
def _systemordner(tmp_path):
    (tmp_path / "bin").mkdir()
    (tmp_path / "etc").mkdir()


def _bash(tmp_path: Path, befehle: str) -> subprocess.CompletedProcess:
    app = tmp_path / "opt" / "eierverkauf"
    for unterordner in ("data", "uploads", "logs", "backups", "venv/bin"):
        (app / unterordner).mkdir(parents=True, exist_ok=True)
    (tmp_path / "bin").mkdir(exist_ok=True)
    (tmp_path / "etc").mkdir(exist_ok=True)
    skript = f"""
set -euo pipefail
source "{HELPER}"
APP_DIR="{app}"
BACKUP_DIR="$APP_DIR/backups"
HELPER_ZIEL="{tmp_path}/bin/eierverkauf"
UNIT_DATEI="{tmp_path}/etc/eierverkauf.service"
UMGEBUNG_DATEI="{tmp_path}/etc/default-eierverkauf"
PROTOKOLL="{tmp_path}/aufrufe.log"
: > "$PROTOKOLL"
chown() {{ echo "chown $*" >> "$PROTOKOLL"; }}
chmod() {{ echo "chmod $*" >> "$PROTOKOLL"; }}
systemctl() {{ echo "systemctl $*" >> "$PROTOKOLL"; }}
{befehle}
"""
    return subprocess.run(["bash", "-c", skript], capture_output=True, text=True, timeout=30)


def _aufrufe(tmp_path: Path) -> list[str]:
    return (tmp_path / "aufrufe.log").read_text().splitlines()


def test_sourcen_fuehrt_keine_aktion_aus(tmp_path):
    ergebnis = _bash(tmp_path, "echo geladen")

    assert ergebnis.returncode == 0, ergebnis.stderr
    assert ergebnis.stdout.strip() == "geladen"


def test_rechte_setzen_gibt_code_baum_an_root(tmp_path):
    ergebnis = _bash(tmp_path, 'touch "$APP_DIR/eierverkauf-helper.sh"; mkdir "$APP_DIR/.git"; rechte_setzen')

    assert ergebnis.returncode == 0, ergebnis.stderr
    app = tmp_path / "opt" / "eierverkauf"
    aufrufe = _aufrufe(tmp_path)
    assert f"chown root:root {app}" in aufrufe
    for eintrag in ("eierverkauf-helper.sh", ".git", "venv"):
        assert f"chown -R root:root {app}/{eintrag}" in aufrufe
        assert f"chmod -R go-w {app}/{eintrag}" in aufrufe


def test_rechte_setzen_fasst_datenbank_ordner_nicht_mit_root_an(tmp_path):
    # Die laufende App schreibt in data/ — ein kurzzeitiger root-Besitz der
    # DB würde Schreibzugriffe während des Updates scheitern lassen.
    _bash(tmp_path, "rechte_setzen")

    app = tmp_path / "opt" / "eierverkauf"
    for ordner in ("data", "uploads", "logs"):
        assert not any(a.startswith("chown -R root:root") and a.endswith(f"{app}/{ordner}")
                       for a in _aufrufe(tmp_path))


def test_rechte_setzen_gibt_dienstkonto_nur_laufzeit_ordner(tmp_path):
    _bash(tmp_path, "rechte_setzen")

    app = tmp_path / "opt" / "eierverkauf"
    dienstkonto = [a for a in _aufrufe(tmp_path) if "eierverkauf:eierverkauf" in a]
    assert dienstkonto == [f"chown -R eierverkauf:eierverkauf {app}/data {app}/uploads {app}/logs"]


def test_rechte_setzen_macht_backups_root_only(tmp_path):
    _bash(tmp_path, "rechte_setzen")

    app = tmp_path / "opt" / "eierverkauf"
    assert f"chmod 0700 {app}/backups" in _aufrufe(tmp_path)


def test_helper_wird_als_kopie_statt_symlink_installiert(tmp_path):
    ziel = tmp_path / "bin" / "eierverkauf"
    ziel.symlink_to(HELPER)

    ergebnis = _bash(tmp_path, f'cp "{HELPER}" "$APP_DIR/eierverkauf-helper.sh"; helper_installieren')

    assert ergebnis.returncode == 0, ergebnis.stderr
    assert not ziel.is_symlink()
    assert ziel.read_text() == HELPER.read_text()
    assert f"chown root:root {ziel}" in _aufrufe(tmp_path)


def test_migration_noetig_erkennt_alten_symlink(tmp_path):
    (tmp_path / "bin" / "eierverkauf").symlink_to(HELPER)

    ergebnis = _bash(tmp_path, "migration_noetig && echo JA || echo NEIN")

    assert ergebnis.stdout.strip() == "JA"


def test_migration_nicht_noetig_bei_kopie(tmp_path):
    (tmp_path / "bin").mkdir(exist_ok=True)
    (tmp_path / "bin" / "eierverkauf").write_text("#!/bin/bash\n")

    ergebnis = _bash(tmp_path, "migration_noetig && echo JA || echo NEIN")

    assert ergebnis.stdout.strip() == "NEIN"


def test_unit_liest_umgebungsdatei_und_bindet_konfigurierbar(tmp_path):
    ergebnis = _bash(tmp_path, "unit_schreiben gehaertet")

    assert ergebnis.returncode == 0, ergebnis.stderr
    unit = (tmp_path / "etc" / "eierverkauf.service").read_text()
    assert "User=eierverkauf" in unit
    assert "Environment=EIERVERKAUF_BIND=0.0.0.0" in unit
    assert f"EnvironmentFile=-{tmp_path}/etc/default-eierverkauf" in unit
    assert "--host ${EIERVERKAUF_BIND}" in unit
    assert "CacheDirectory=eierverkauf" in unit
    assert "NoNewPrivileges=yes" in unit
    assert "ProtectSystem=strict" in unit


def test_unit_ohne_haertung_fuer_lxc_ohne_namespaces(tmp_path):
    _bash(tmp_path, "unit_schreiben einfach")

    unit = (tmp_path / "etc" / "eierverkauf.service").read_text()
    assert "ProtectSystem" not in unit
    assert "ReadWritePaths" not in unit
    assert "CacheDirectory=eierverkauf" in unit


def test_umgebungsvorlage_wird_nur_angelegt_wenn_sie_fehlt(tmp_path):
    datei = tmp_path / "etc" / "default-eierverkauf"
    datei.write_text("EIERVERKAUF_ALLOWED_HOSTS=eier.example\n")

    _bash(tmp_path, "umgebung_vorlage_anlegen")

    assert datei.read_text() == "EIERVERKAUF_ALLOWED_HOSTS=eier.example\n"


def test_umgebungsvorlage_enthaelt_kommentierte_variablen(tmp_path):
    _bash(tmp_path, "umgebung_vorlage_anlegen")

    inhalt = (tmp_path / "etc" / "default-eierverkauf").read_text()
    assert "#EIERVERKAUF_ALLOWED_HOSTS=" in inhalt
    assert "#EIERVERKAUF_BIND=127.0.0.1" in inhalt


def test_installer_verlinkt_helper_nicht_und_gibt_baum_nicht_ans_dienstkonto():
    installer = INSTALLER.read_text()

    assert "ln -sf" not in installer
    assert 'chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"\n' not in installer
    assert "rechte_setzen" in installer
    assert "helper_installieren" in installer


@pytest.mark.parametrize("zeile", [
    "chown -R eierverkauf:eierverkauf .git",
    "chown -R eierverkauf:eierverkauf /opt/eierverkauf/venv",
])
def test_doku_gibt_root_ausgefuehrte_dateien_nicht_ans_dienstkonto(zeile):
    doku = (REPO / "DEPLOYMENT.md").read_text()

    assert zeile not in doku
