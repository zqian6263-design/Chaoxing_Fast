$ErrorActionPreference = 'SilentlyContinue'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $dir

$watchdog = Join-Path $dir 'watchdog.ps1'
$stopFile = Join-Path $dir '.watchdog-stop'
[IO.File]::WriteAllText($stopFile, 'stop', (New-Object System.Text.UTF8Encoding($false)))

$watchdogs = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object {
  $_.CommandLine -and $_.CommandLine -like "*$watchdog*"
})
foreach ($proc in $watchdogs) { Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue }

Start-Sleep -Seconds 1
$procs = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
  $_.CommandLine -and ($_.CommandLine -like '*chaoxing_watch.mjs*' -or $_.CommandLine -like '*start.mjs*')
})
foreach ($proc in $procs) { Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue }

if ($procs.Count -gt 0) { Write-Host '已停止刷课脚本与看门狗。' } else { Write-Host '当前没有在运行的刷课脚本。' }