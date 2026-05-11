# ===========================================================================
# Eierverkauf — Lokales Setup (Windows / PowerShell)
#
# Einmalig ausführen, um Python-venv und Node-Abhängigkeiten einzurichten.
# Voraussetzungen: Python 3.12+, Node.js 20+ (im PATH)
# ===========================================================================
#Requires -Version 5.1
$ErrorActionPreference = "Stop"

function Write-Info  ($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Ok    ($msg) { Write-Host "[OK]   $msg" -ForegroundColor Green }
function Write-Warn2 ($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err2  ($msg) { Write-Host "[FEHL] $msg" -ForegroundColor Red }

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RepoRoot

# --- Python prüfen ---------------------------------------------------------
Write-Info "Prüfe Python-Version…"
$pyCmd = Get-Command python -ErrorAction SilentlyContinue
if (-not $pyCmd) {
    Write-Err2 "Python nicht gefunden. Installation: https://www.python.org/downloads/ (3.12+)"
    exit 1
}
$pyVer = (& python --version 2>&1) -replace "Python ", ""
$pyMajor = [int]($pyVer.Split(".")[0])
$pyMinor = [int]($pyVer.Split(".")[1])
if ($pyMajor -lt 3 -or ($pyMajor -eq 3 -and $pyMinor -lt 12)) {
    Write-Warn2 "Python-Version $pyVer < 3.12. Manche Features könnten fehlschlagen."
} else {
    Write-Ok "Python $pyVer"
}

# --- Node prüfen -----------------------------------------------------------
Write-Info "Prüfe Node-Version…"
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Err2 "Node.js nicht gefunden. Installation: https://nodejs.org (20 LTS)"
    exit 1
}
$nodeVer = (& node --version) -replace "v", ""
$nodeMajor = [int]($nodeVer.Split(".")[0])
if ($nodeMajor -lt 20) {
    Write-Warn2 "Node $nodeVer < 20. Bitte aktualisieren."
} else {
    Write-Ok "Node $nodeVer"
}

# --- venv anlegen ----------------------------------------------------------
$VenvDir = Join-Path $RepoRoot ".venv"
if (Test-Path $VenvDir) {
    Write-Info "venv existiert bereits — überspringe Erstellung."
} else {
    Write-Info "Erstelle Python-venv unter .venv …"
    & python -m venv $VenvDir
    Write-Ok "venv angelegt"
}

# --- pip + Requirements ----------------------------------------------------
$PipExe = Join-Path $VenvDir "Scripts\pip.exe"
Write-Info "Aktualisiere pip…"
& $PipExe install --upgrade pip --quiet
Write-Info "Installiere Python-Abhängigkeiten…"
& $PipExe install -r (Join-Path $RepoRoot "requirements.txt")
Write-Ok "Python-Abhängigkeiten installiert"

# --- npm install -----------------------------------------------------------
Write-Info "Installiere Node-Abhängigkeiten (kann einige Minuten dauern)…"
Push-Location (Join-Path $RepoRoot "frontend")
try {
    & npm install
    Write-Ok "Node-Abhängigkeiten installiert"
} finally {
    Pop-Location
}

# --- WeasyPrint-Hinweis ----------------------------------------------------
Write-Host ""
Write-Warn2 "PDF-Export benötigt GTK-Runtime unter Windows."
Write-Warn2 "Download: https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer/releases"
Write-Warn2 "Alternativ: PDF-Export ausschließlich via 'docker compose up' nutzen."
Write-Host ""

Write-Ok "Setup abgeschlossen. Nächster Schritt: .\dev-start.ps1"
