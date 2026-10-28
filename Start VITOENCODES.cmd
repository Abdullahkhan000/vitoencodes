@echo off
setlocal
cd /d "%~dp0"
echo Starting VITOENCODES from your normal Windows terminal...
call npm.cmd run start:local
if errorlevel 1 pause
endlocal
