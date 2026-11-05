"""Tests für ``eierverkauf diagnose`` (eierverkauf-helper.sh).

Der Befehl sammelt bei einem App-Hänger — vor dem Neustart — die Belege,
die unterscheiden, ob der Server, der Browser oder das Netz hängt. Alle
Systembefehle werden durch protokollierende Bash-Funktionen ersetzt.
"""
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
HELPER = REPO / "eierverkauf-helper.sh"


def _diagnose(tmp_path: Path, curl_rc: int = 0) -> subprocess.CompletedProcess:
    app = tmp_path / "opt" / "eierverkauf"
    (app / "data").mkdir(parents=True)
    (app / "logs").mkdir()
    (app / "data" / "eierverkauf.db-wal").write_bytes(b"x" * 2048)
    skript = f"""
set -euo pipefail
source "{HELPER}"
APP_DIR="{app}"
DB_FILE="$APP_DIR/data/eierverkauf.db"
PROTOKOLL="{tmp_path}/aufrufe.log"
: > "$PROTOKOLL"
curl() {{ echo "curl $*" >> "$PROTOKOLL"; echo '{{"status":"ok"}}'; return {curl_rc}; }}
systemctl() {{
    echo "systemctl $*" >> "$PROTOKOLL"
    case "$1" in show) echo 4711 ;; is-active) echo active ;; esac
}}
journalctl() {{ echo "journalctl $*" >> "$PROTOKOLL"; echo "Thread 0x01 (most recent call first)"; }}
ss() {{ echo "ESTAB 0 0 127.0.0.1:8050 1.2.3.4:5555"; }}
ps() {{ printf 'PID\\n4711\\n4711\\n'; }}
sleep() {{ :; }}
do_diagnose
"""
    return subprocess.run(["bash", "-c", skript], capture_output=True, text=True, timeout=30)


def _bericht(tmp_path: Path) -> str:
    dateien = list((tmp_path / "opt" / "eierverkauf" / "logs").glob("diagnose-*.txt"))
    assert len(dateien) == 1
    return dateien[0].read_text()


def test_diagnose_schreibt_bericht_und_nennt_den_pfad(tmp_path):
    ergebnis = _diagnose(tmp_path)

    assert ergebnis.returncode == 0, ergebnis.stderr
    assert "diagnose-" in ergebnis.stdout
    bericht = _bericht(tmp_path)
    assert "api/health" in bericht
    assert "api/imports" in bericht
    assert "WAL" in bericht
    assert "Thread 0x01" in bericht


def test_diagnose_loest_thread_dump_per_sigusr1_aus(tmp_path):
    _diagnose(tmp_path)

    aufrufe = (tmp_path / "aufrufe.log").read_text()
    assert "systemctl kill -s USR1 eierverkauf" in aufrufe


def test_diagnose_laeuft_weiter_wenn_server_nicht_antwortet(tmp_path):
    ergebnis = _diagnose(tmp_path, curl_rc=28)

    assert ergebnis.returncode == 0, ergebnis.stderr
    bericht = _bericht(tmp_path)
    assert "KEINE ANTWORT" in bericht
    assert "Thread 0x01" in bericht
