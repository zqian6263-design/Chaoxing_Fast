# Windows x64/arm64 no-admin bootstrapper. Download only from nodejs.org and verify SHA256.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $root
$runtime = Join-Path $root '.runtime'
$portable = Join-Path $runtime 'node'
$nodeExe = Join-Path $portable 'node.exe'
function NodeMajor([string]$exe) {
  if (-not (Test-Path -LiteralPath $exe)) { return 0 }
  try { return [int]((& $exe -p "process.versions.node.split('.')[0]").Trim()) } catch { return 0 }
}
$system = Get-Command node.exe -ErrorAction SilentlyContinue | Select-Object -First 1
$hasSystem = $system -and (NodeMajor $system.Source) -ge 20
if (-not $hasSystem -and (NodeMajor $nodeExe) -lt 20) {
  $arch = [Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString().ToLowerInvariant()
  if ($arch -notin @('x64','arm64')) { throw "Unsupported Windows architecture: $arch" }
  New-Item -ItemType Directory -Force -Path $runtime | Out-Null
  $tmp = Join-Path $runtime 'download'
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  Write-Host 'Selecting official Node.js LTS release...'
  $releases = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json' -TimeoutSec 45
  $release = $releases | Where-Object { $_.lts -and $_.files -contains "win-$arch-zip" -and ([int](($_.version -replace '^v','').Split('.')[0])) -ge 20 } | Select-Object -First 1
  if (-not $release) { throw 'Could not resolve compatible official Node.js LTS version.' }
  $ver = $release.version
  $name = "node-$ver-win-$arch.zip"
  $base = "https://nodejs.org/dist/$ver"
  $archive = Join-Path $tmp $name
  Write-Host "Downloading $name from $base"
  Invoke-WebRequest -Uri "$base/$name" -OutFile $archive -TimeoutSec 180
  $checksums = (Invoke-WebRequest -Uri "$base/SHASUMS256.txt" -TimeoutSec 45).Content
  $entry = ($checksums -split "`n" | Where-Object { $_ -match ("^[a-fA-F0-9]{64}\s+" + [Regex]::Escape($name) + "\s*$") } | Select-Object -First 1)
  if (-not $entry) { throw 'Missing official SHA256 for downloaded archive.' }
  $expected = ($entry.Trim() -split '\s+')[0].ToUpperInvariant()
  $actual = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToUpperInvariant()
  if ($actual -ne $expected) { throw 'Node archive SHA256 mismatch; refusing installation.' }
  $extract = Join-Path $tmp 'expanded'
  Expand-Archive -LiteralPath $archive -DestinationPath $extract -Force
  if (Test-Path $portable) { Remove-Item $portable -Recurse -Force }
  Move-Item -LiteralPath (Join-Path $extract ("node-$ver-win-$arch")) -Destination $portable
  Remove-Item -LiteralPath $tmp -Recurse -Force
}
if ((NodeMajor $nodeExe) -ge 20) {
  $env:PATH = "$portable;$env:PATH"
  Write-Host 'Using isolated portable Node.js runtime.'
} elseif ($hasSystem) {
  Write-Host "Using system Node.js: $($system.Source)"
} else { throw 'Node.js 20+ is unavailable.' }
& node (Join-Path $root 'setup.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Project setup failed. See errors above.' }
& node (Join-Path $root 'doctor.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Health check failed.' }
Write-Host 'Installation successful. Launch using launch-windows.bat.'
