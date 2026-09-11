param(
  [string]$EntryPoint = 'start.mjs',
  [int]$Port = 7788
)

$ErrorActionPreference = 'SilentlyContinue'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $dir

$stopFile = Join-Path $dir '.watchdog-stop'
$logFile = Join-Path $dir 'watchdog.log'
$outLog = Join-Path $dir 'watch_run.log'
$errLog = Join-Path $dir 'watch_run_err.log'

function Write-WatchdogLog([string]$Message) {
  $line = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
  Add-Content -LiteralPath $logFile -Value $line -Encoding UTF8
}

function Resolve-NodePath {
  $cmd = Get-Command node.exe -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($cmd -and $cmd.Source) { return $cmd.Source }

  $candidates = @(
    (Join-Path $env:ProgramFiles 'nodejs\node.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'nodejs\node.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\nodejs\node.exe')
  )
  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) { return $candidate }
  }
  return $null
}

function Get-WatchProcesses {
  return @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -and (
      $_.CommandLine -like "*$EntryPoint*" -or
      ($EntryPoint -ne 'chaoxing_watch.mjs' -and $_.CommandLine -like '*chaoxing_watch.mjs*')
    )
  })
}

function Stop-WatchProcesses {
  $procs = @(Get-WatchProcesses)
  foreach ($proc in $procs) {
    Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
  }
}

function Start-WatchProcess([string]$NodePath) {
  $arguments = @($EntryPoint)
  if ([IO.Path]::GetFileName($EntryPoint) -eq 'chaoxing_watch.mjs') {
    $arguments += @('--headless', '--dashboard')
  } else {
    $arguments += '--headless'
  }

  Write-WatchdogLog ('启动: ' + $NodePath + ' ' + ($arguments -join ' '))
  Start-Process -FilePath $NodePath -ArgumentList $arguments -WorkingDirectory $dir -WindowStyle Hidden -RedirectStandardOutput $outLog -RedirectStandardError $errLog | Out-Null
}

$mutex = New-Object System.Threading.Mutex($false, 'Local\ChaoxingFastWatchdog')
$hasMutex = $false
try { $hasMutex = $mutex.WaitOne(0) } catch { $hasMutex = $false }
if (-not $hasMutex) { exit 0 }

try {
  Write-WatchdogLog '看门狗已启动，将自动保持进度网页在线'
  $lastStart = [DateTime]::MinValue
  $lastHealthy = Get-Date

  while (-not (Test-Path -LiteralPath $stopFile)) {
    $nodePath = Resolve-NodePath
    if (-not $nodePath) {
      Write-WatchdogLog '未找到 Node.js，30 秒后重试'
      Start-Sleep -Seconds 30
      continue
    }

    $procs = @(Get-WatchProcesses)
    if ($procs.Count -eq 0) {
      if (((Get-Date) - $lastStart).TotalSeconds -lt 15) {
        Start-Sleep -Seconds 5
        continue
      }
      Start-WatchProcess $nodePath
      $lastStart = Get-Date
      $lastHealthy = Get-Date
      Start-Sleep -Seconds 8
      continue
    }

    $healthy = $false
    try {
      $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/api/status" -UseBasicParsing -TimeoutSec 5
      $healthy = $response.StatusCode -eq 200
    } catch { $healthy = $false }

    if ($healthy) {
      $lastHealthy = Get-Date
    } elseif (((Get-Date) - $lastHealthy).TotalSeconds -gt 180) {
      Write-WatchdogLog '进度网页超过 180 秒无响应，重启刷课进程'
      Stop-WatchProcesses
      Start-Sleep -Seconds 3
    }

    Start-Sleep -Seconds 10
  }

  Write-WatchdogLog '收到停止标记，看门狗退出'
} finally {
  if ($hasMutex) { $mutex.ReleaseMutex() | Out-Null }
  $mutex.Dispose()
}