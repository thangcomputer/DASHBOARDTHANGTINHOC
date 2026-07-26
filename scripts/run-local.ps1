# Chạy backend + frontend trên máy local (Windows PowerShell)
# Usage: .\scripts\run-local.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent

function Require-Command($name) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        Write-Host ""
        Write-Host "Chua tim thay '$name' trong PATH." -ForegroundColor Red
        Write-Host "Cai Node.js LTS: https://nodejs.org/ (hoac: winget install OpenJS.NodeJS.LTS)" -ForegroundColor Yellow
        Write-Host "Mo lai terminal/Cursor sau khi cai xong." -ForegroundColor Yellow
        exit 1
    }
}

Require-Command node
Require-Command npm

Set-Location $Root

function Stop-PortListener($port) {
    $lines = netstat -ano | Select-String ":$port\s+.*LISTENING"
    foreach ($line in $lines) {
        $parts = ($line -replace '\s+', ' ').ToString().Trim().Split(' ')
        $procId = $parts[-1]
        if ($procId -match '^\d+$' -and [int]$procId -gt 0) {
            Write-Host "Giai phong port $port (PID $procId)..." -ForegroundColor DarkYellow
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        }
    }
}

Stop-PortListener 5000
Stop-PortListener 5173
Start-Sleep -Seconds 1

if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "Da tao .env tu .env.example — hay sua MONGODB_URI neu can." -ForegroundColor Yellow
    } else {
        Write-Host "Thieu file .env — tao tu .env.example hoac dat MONGODB_URI thu cong." -ForegroundColor Red
        exit 1
    }
}

Write-Host "npm install (root)..." -ForegroundColor Cyan
npm install --legacy-peer-deps

Write-Host "npm install (client)..." -ForegroundColor Cyan
Set-Location "$Root\client"
npm install --legacy-peer-deps

Set-Location $Root

Write-Host ""
Write-Host "Khoi dong backend (port 5000) va frontend (port 5173)..." -ForegroundColor Green
Write-Host "Dung Ctrl+C de tat ca." -ForegroundColor DarkGray
Write-Host ""

$backend = Start-Process powershell -PassThru -WorkingDirectory $Root -ArgumentList @(
    "-NoExit", "-Command", "npm run dev"
)

Write-Host "Cho backend khoi dong (port 5000)..." -ForegroundColor Cyan
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:5000/api/settings/web" -UseBasicParsing -TimeoutSec 2
        if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { $ready = $true; break }
    } catch { Start-Sleep -Seconds 1 }
}
if (-not $ready) {
    Write-Host "Backend chua san sang — kiem tra cua so PowerShell backend (MongoDB, JWT_SECRET trong .env)." -ForegroundColor Red
} else {
    Write-Host "Backend OK." -ForegroundColor Green
}

$frontend = Start-Process powershell -PassThru -WorkingDirectory "$Root\client" -ArgumentList @(
    "-NoExit", "-Command", "npm run dev"
)

Write-Host "Backend PID:  $($backend.Id)" -ForegroundColor DarkGray
Write-Host "Frontend PID: $($frontend.Id)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Mo trinh duyet: http://localhost:5173" -ForegroundColor Green
Write-Host "API:            http://localhost:5000/api" -ForegroundColor Green
