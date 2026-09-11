$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$startup = [Environment]::GetFolderPath('Startup')
$bat = Join-Path $startup 'ChaoxingFastWatch.bat'
$lines = @(
  '@echo off',
  ('cd /d "' + $dir + '"'),
  ('powershell -NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $dir 'run-start.ps1') + '"')
)
Set-Content -LiteralPath $bat -Value $lines -Encoding ascii
Write-Host ('已设置开机自启（登录后自动运行）：' + $bat)