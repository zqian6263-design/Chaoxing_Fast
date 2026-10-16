# Build a distributable ONLINE Windows installer ZIP without secrets or caches.
param([string]$Version = 'dev')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'dist'
New-Item -ItemType Directory -Force -Path $dist | Out-Null
$out = Join-Path $dist "Chaoxing-Fast-Windows-$Version.zip"
$names = @(
  '.gitignore','README.md','AGENTS.md','LICENSE','DESIGN.md','PRODUCT.md',
  'package.json','package-lock.json','start.mjs','doctor.mjs','setup.mjs','setup.ps1','setup.sh',
  'start-windows.bat','stop-windows.bat','start.sh',
  'run-start.ps1','run-stop.ps1','watchdog.ps1','watchdog-worker.mjs',
  'install-autostart.ps1','uninstall-autostart.ps1',
  'install-windows.ps1','install-windows.bat',
  'launch-windows.ps1','launch-windows.bat',
  'src','assets','docs','test'
)
$items = @($names | ForEach-Object { Join-Path $root $_ } | Where-Object { Test-Path -LiteralPath $_ })
if (Test-Path -LiteralPath $out) { Remove-Item -LiteralPath $out -Force }
Compress-Archive -LiteralPath $items -DestinationPath $out -CompressionLevel Optimal
Write-Host "Release ZIP: $out"
Write-Host ('SHA256: ' + (Get-FileHash -LiteralPath $out -Algorithm SHA256).Hash)
