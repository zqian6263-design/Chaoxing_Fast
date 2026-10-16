param(
  [string]$EntryPoint = 'start.mjs',
  [int]$Port = 7788
)
$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $dir
$stopFile = Join-Path $dir '.watchdog-stop'
$exitFile = Join-Path $dir '.watchdog-last-exit'
$logFile = Join-Path $dir 'watchdog.log'
$entryPath = Join-Path $dir $EntryPoint
$childPath = Join-Path $dir 'src\chaoxing_watch.mjs'
$worker = Join-Path $dir 'watchdog-worker.mjs'

function Log([string]$msg) {
  Add-Content -LiteralPath $logFile -Value ("$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg") -Encoding UTF8
}
function Get-ProjectProcesses {
  @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -and ($_.CommandLine.Contains($entryPath) -or $_.CommandLine.Contains($childPath))
  })
}
function Stop-ProjectProcesses {
  foreach ($proc in @(Get-ProjectProcesses)) {
    Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
  }
}
$mutex = New-Object System.Threading.Mutex($false, 'Local\ChaoxingFastWatchdog')
$locked = $false
try { $locked = $mutex.WaitOne(0) } catch { }
if (-not $locked) { $mutex.Dispose(); exit 0 }
try {
  Log 'Watchdog started'
  $tracked = $null
  $failures = 0
  $lastHealthy = Get-Date
  while (-not (Test-Path -LiteralPath $stopFile)) {
    if ($tracked -and $tracked.HasExited) {
      $exitCode = $null
      try { $exitCode = [int](Get-Content -LiteralPath $exitFile -Raw -ErrorAction Stop) } catch { }
      $tracked.Dispose()
      $tracked = $null
      if ($null -ne $exitCode -and ($exitCode -eq 0 -or $exitCode -eq 2)) {
        Log "Worker reached terminal state $exitCode; no automatic restart"
        break
      }
      $failures++
      Log "Worker exited with code $exitCode (failure $failures/3)"
      if ($failures -ge 3) { Log 'Repeated failures. Manual diagnosis required.'; break }
      Start-Sleep -Seconds 15
    }

    $procs = @(Get-ProjectProcesses)
    if ($procs.Count -eq 0) {
      if ($tracked -and -not $tracked.HasExited) { Start-Sleep -Seconds 3; continue }
      $node = Get-Command node.exe -ErrorAction SilentlyContinue | Select-Object -First 1
      if (-not $node) { Log 'Node not available; stopping watchdog'; break }
      if (Test-Path -LiteralPath $exitFile) { Remove-Item -LiteralPath $exitFile -Force }
      Log "Launching project worker: $entryPath"
      $launchArgs = '"' + $worker + '" "' + $EntryPoint + '"'
      $tracked = Start-Process -FilePath $node.Source -ArgumentList $launchArgs -WorkingDirectory $dir -WindowStyle Hidden -PassThru
      $lastHealthy = Get-Date
      Start-Sleep -Seconds 8
      continue
    }

    $healthy = $false
    try {
      $r = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/status" -TimeoutSec 5
      $healthy = $null -ne $r.phase -and $null -ne $r.startedAt
    } catch { }
    if ($healthy) { $lastHealthy = Get-Date }
    elseif (((Get-Date) - $lastHealthy).TotalSeconds -gt 180) {
      Log 'Dashboard unresponsive for >180 sec; stopping this project worker'
      Stop-ProjectProcesses
      $lastHealthy = Get-Date
    }
    Start-Sleep -Seconds 10
  }
  Log 'Watchdog stopped'
} catch {
  Log ('Fatal watchdog error: ' + $_.Exception.Message)
  throw
} finally {
  if ($locked) { $mutex.ReleaseMutex() | Out-Null }
  $mutex.Dispose()
}
