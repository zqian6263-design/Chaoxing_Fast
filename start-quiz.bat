@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-quiz.ps1"
if errorlevel 1 (echo Study assistant exited with error.)
pause
