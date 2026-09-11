$startup = [Environment]::GetFolderPath('Startup')
$bat = Join-Path $startup 'ChaoxingFastWatch.bat'
if (Test-Path $bat) { Remove-Item -LiteralPath $bat -Force; Write-Host '已取消开机自启。' } else { Write-Host '未设置开机自启。' }