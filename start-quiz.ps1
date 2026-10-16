# Standalone localhost study tutor. Does NOT restart video playback.
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $root
$node = Join-Path $root '.runtime\node\node.exe'
if (-not(Test-Path $node)) { $node=(Get-Command node.exe -ErrorAction Stop).Source }
Write-Host 'Quiz tutor (local only). Open http://127.0.0.1:7789'
& $node (Join-Path $root 'src\quiz\server.mjs')
exit $LASTEXITCODE
