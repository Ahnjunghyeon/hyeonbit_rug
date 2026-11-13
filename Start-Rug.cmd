@echo off
cd /d "%~dp0"
node cleanup-obsolete.cjs
if not exist "node_modules\electron\dist\electron.exe" (
  call npm ci
  if errorlevel 1 exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Create-Shortcut.ps1"
if errorlevel 1 exit /b 1
call npm start
