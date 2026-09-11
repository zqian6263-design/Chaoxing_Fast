$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $dir

$entryPoint = 'start.mjs'
$port = 7788
$stopFile = Join-Path $dir '.watchdog-stop'
$watchdog = Join-Path $dir 'watchdog.ps1'

if (Test-Path -LiteralPath $stopFile) { Remove-Item -LiteralPath $stopFile -Force }

$nodeCmd = Get-Command node.exe -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $nodeCmd) {
  Write-Host '未找到 Node.js 18+，请先安装 Node.js。'
  exit 1
}

$running = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object {
  $_.CommandLine -and $_.CommandLine -like "*$watchdog*"
})
if ($running.Count -eq 0) {
  $psArgs = '-NoProfile -ExecutionPolicy Bypass -File "' + $watchdog + '" -EntryPoint "' + $entryPoint + '" -Port ' + $port
  Start-Process -FilePath 'powershell.exe' -ArgumentList $psArgs -WorkingDirectory $dir -WindowStyle Hidden
  Start-Sleep -Seconds 3
}

Start-Process ("http://127.0.0.1:" + $port) | Out-Null
Write-Host ('刷课看门狗已启动，进度页: http://127.0.0.1:' + $port)