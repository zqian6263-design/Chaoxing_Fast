$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$startup = [Environment]::GetFolderPath('Startup')
$bat = Join-Path $startup 'ChaoxingFastWatch.bat'
$lines = @(
  '@echo off',
  ('cd /d "' + $dir + '"'),
  ('powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + (Join-Path $dir 'run-start.ps1') + '"')
)
Set-Content -LiteralPath $bat -Value $lines -Encoding ascii
Write-Host ('已设置登录自启 + 看门狗（无需管理员）：' + $bat)