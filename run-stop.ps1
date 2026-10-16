$ErrorActionPreference = 'SilentlyContinue'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$stopFile = Join-Path $dir '.watchdog-stop'
[IO.File]::WriteAllText($stopFile, 'stop', (New-Object System.Text.UTF8Encoding($false)))
$watchdog = Join-Path $dir 'watchdog.ps1'
$entry = Join-Path $dir 'start.mjs'
$child = Join-Path $dir 'src\chaoxing_watch.mjs'
$watchdogs = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object {
  $_.CommandLine -and $_.CommandLine.Contains($watchdog)
})
foreach ($proc in $watchdogs) { Stop-Process -Id $proc.ProcessId -Force }
$procs = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
  $_.CommandLine -and ($_.CommandLine.Contains($entry) -or $_.CommandLine.Contains($child))
})
foreach ($proc in $procs) { Stop-Process -Id $proc.ProcessId -Force }
Write-Host ('Stopped ' + $procs.Count + ' matching project processes.')
