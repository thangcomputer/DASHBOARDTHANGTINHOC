$ErrorActionPreference = "Stop"

$target = "tests\load-test\k6-bin\k6-v0.50.0-windows-amd64"
New-Item -ItemType Directory -Force -Path $target | Out-Null

$url = "https://github.com/grafana/k6/releases/download/v0.50.0/k6-v0.50.0-windows-amd64.zip"
$zip = Join-Path $env:TEMP "k6-v0.50.0-windows-amd64.zip"

Write-Host ("Downloading: " + $url)
Invoke-WebRequest -Uri $url -OutFile $zip

$tmp = Join-Path $env:TEMP ("k6_extract_" + ([guid]::NewGuid().ToString()))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

Expand-Archive -Path $zip -DestinationPath $tmp -Force

$exe = Get-ChildItem -Path $tmp -Recurse -Filter k6.exe | Select-Object -First 1
if (-not $exe) { throw "k6.exe not found after extract" }

Copy-Item $exe.FullName (Join-Path $target "k6.exe") -Force
Write-Host ("k6 installed at: " + (Join-Path $target "k6.exe"))

