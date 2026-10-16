# Remove only this project's known startup entries.
$startup = [Environment]::GetFolderPath('Startup')
foreach ($name in @('ChaoxingFastWatch.lnk', 'ChaoxingFastWatch.bat')) {
  $path = Join-Path $startup $name
  if (Test-Path -LiteralPath $path) {
    Remove-Item -LiteralPath $path -Force
    Write-Host "Removed: $path"
  }
}
