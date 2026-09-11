@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-start.ps1"
timeout /t 3 /nobreak >nul
