# Add an optional Unicode-safe login startup shortcut, without elevation.
$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$startup = [Environment]::GetFolderPath('Startup')
$link = Join-Path $startup 'ChaoxingFastWatch.lnk'
$target = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
$script = Join-Path $dir 'run-start.ps1'
$ws = New-Object -ComObject WScript.Shell
$shortcut = $ws.CreateShortcut($link)
$shortcut.TargetPath = $target
$shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $script + '"'
$shortcut.WorkingDirectory = $dir
$shortcut.Description = 'Chaoxing Fast background monitor (optional)'
$shortcut.Save()
Write-Host "Login startup shortcut installed: $link"
