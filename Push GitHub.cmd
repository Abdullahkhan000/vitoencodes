@echo off
setlocal
cd /d "%~dp0"
echo VITOENCODES - connect and push GitHub repository
node scripts\setup-github.mjs
if errorlevel 1 echo GitHub setup stopped. Read the message above.
pause
endlocal
