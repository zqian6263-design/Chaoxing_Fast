@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0launch-windows.ps1" %*
if errorlevel 1 (echo Application exited with error.)
pause
