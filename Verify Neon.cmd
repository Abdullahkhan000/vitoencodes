@echo off
setlocal
cd /d "%~dp0"
echo VITOENCODES - verify the existing Neon setup
node --experimental-strip-types scripts\test-neon.mjs
if errorlevel 1 echo Verification stopped. Read the failing step above.
pause
endlocal
