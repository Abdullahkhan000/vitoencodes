@echo off
setlocal
cd /d "%~dp0"
echo VITOENCODES - repair dependencies and finish Neon setup
node scripts\finish-neon-setup.mjs
if errorlevel 1 echo Setup stopped. Read the error above. Do not share credentials.
pause
endlocal
