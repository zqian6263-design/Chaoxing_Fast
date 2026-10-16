$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $dir
$portable = Join-Path $dir '.runtime\node'
if (Test-Path (Join-Path $portable 'node.exe')) { $env:PATH = "$portable;$env:PATH" }
$node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $node) { throw 'Node.js not installed. First run install-windows.bat.' }
& node doctor.mjs
if ($LASTEXITCODE -ne 0) { throw 'Environment not ready; run install-windows.bat.' }
& node start.mjs @args
exit $LASTEXITCODE
