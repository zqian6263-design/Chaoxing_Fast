# Fail closed: Windows deploy must not pretend partial installation succeeded.
$ErrorActionPreference = 'Stop'
$major = 0
try { $major = [int]((node --version) -replace '^v(\d+)\..*$', '$1') }
catch { Write-Error 'Node.js 20+ is required.'; exit 1 }
if ($major -lt 20) { Write-Error "Node.js 20+ required; detected $major"; exit 1 }
npm ci --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { Write-Error 'npm ci failed'; exit 1 }
npx playwright install chromium
if ($LASTEXITCODE -ne 0) { Write-Error 'Chromium installation failed'; exit 1 }
node doctor.mjs
if ($LASTEXITCODE -ne 0) { Write-Error 'Environment health check failed'; exit 1 }
Write-Host 'Installation verified.'
