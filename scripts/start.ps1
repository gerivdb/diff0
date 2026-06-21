# diff0-fork Startup Script
# IntentHash: 0xDIFF0_FORK_STARTUP_20260604
#
# Usage: .\scripts\start.ps1
#
# Prerequisites:
#   1. ngrok running: ngrok http 3000
#   2. Webhook URL set in GitHub App settings
#   3. GATEWAY-MANAGER running on port 9000
#   4. Private key in keys/diff0-fork-private-key.pem

$ErrorActionPreference = "Stop"

Write-Host "=== diff0-fork v2.0.0 ===" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
$privateKey = "D:\DO\WEB\TOOLS\L4-TOOLS\diff0-fork\keys\diff0-fork-private-key.pem"
if (-not (Test-Path $privateKey)) {
    Write-Host "[FAIL] Private key not found: $privateKey" -ForegroundColor Red
    Write-Host "Generate at: https://github.com/settings/apps/diff0-fork" -ForegroundColor Yellow
    exit 1
}

# Check GATEWAY-MANAGER
try {
    $gw = Invoke-WebRequest -Uri "http://localhost:9000/health" -TimeoutSec 5 -UseBasicParsing
    Write-Host "[OK]   GATEWAY-MANAGER (port 9000)" -ForegroundColor Green
} catch {
    Write-Host "[WARN] GATEWAY-MANAGER not responding on port 9000" -ForegroundColor Yellow
}

# Check ngrok
try {
    $ngrok = Invoke-WebRequest -Uri "http://localhost:4040/api/tunnels" -TimeoutSec 5 -UseBasicParsing
    $tunnels = $ngrok.Content | ConvertFrom-Json
    $httpsUrl = ($tunnels.tunnels | Where-Object { $_.proto -eq "https" }).public_url
    if ($httpsUrl) {
        Write-Host "[OK]   ngrok tunnel: $httpsUrl" -ForegroundColor Green
    }
} catch {
    Write-Host "[WARN] ngrok not running on port 4040" -ForegroundColor Yellow
    Write-Host "Start with: ngrok http 3000" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Starting diff0-fork server..." -ForegroundColor Cyan

Set-Location "D:\DO\WEB\TOOLS\L4-TOOLS\diff0-fork"
node packages/backend/src/server.js
