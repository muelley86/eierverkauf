# ===========================================================================
# Eierverkauf — Lokaler Dev-Start (Windows / PowerShell)
#
# Öffnet zwei PowerShell-Fenster:
#   • Backend  → uvicorn main:app --reload --port 8050
#   • Frontend → npm run dev (Vite auf Port 5173, mit Proxy an Backend)
#
# Anschließend öffnet sich der Browser unter http://localhost:5173
# ===========================================================================
#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvPython = Join-Path $RepoRoot ".venv\Scripts\python.exe"
$FrontendDir = Join-Path $RepoRoot "frontend"

if (-not (Test-Path $VenvPython)) {
    Write-Host "[FEHL] venv nicht gefunden. Erst .\dev-setup.ps1 ausführen." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
    Write-Host "[FEHL] node_modules nicht gefunden. Erst .\dev-setup.ps1 ausführen." -ForegroundColor Red
    exit 1
}

Write-Host "[INFO] Starte Backend (Port 8050)…" -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$RepoRoot'; & '$VenvPython' -m uvicorn main:app --reload --port 8050"
)

Write-Host "[INFO] Starte Frontend (Port 5173)…" -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$FrontendDir'; npm run dev"
)

Start-Sleep -Seconds 3
Write-Host "[OK] Backend und Frontend werden gestartet." -ForegroundColor Green
Write-Host "      Backend:  http://localhost:8050/api/health"
Write-Host "      Frontend: http://localhost:5173"

Start-Process "http://localhost:5173"
