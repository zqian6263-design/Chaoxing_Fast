$ErrorActionPreference = 'SilentlyContinue'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $dir
$node = (Get-Command node).Source
if (-not $node) { Write-Host '未找到 node，请先安装 Node.js 18+'; exit 1 }
$running = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*chaoxing_watch.mjs*' -or $_.CommandLine -like '*start.mjs*' }
if (-not $running) {
  Start-Process -FilePath $node -ArgumentList 'start.mjs','--headless' -WorkingDirectory $dir -WindowStyle Hidden
  Start-Sleep -Seconds 5
}
Start-Process 'http://127.0.0.1:7788'
Write-Host '刷课脚本已启动，进度页: http://127.0.0.1:7788'