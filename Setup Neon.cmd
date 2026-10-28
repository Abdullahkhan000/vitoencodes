@echo off
setlocal
cd /d "%~dp0"
echo VITOENCODES - finish Neon Postgres setup
if not exist data mkdir data
if exist .env.local copy /Y .env.local data\before-neon.env.local.backup >nul
if exist .env copy /Y .env data\before-neon.env.backup >nul
call npm.cmd i -g neon@latest
if errorlevel 1 goto use_npx
set "NEON_RUNNER=neon.cmd"
goto init
:use_npx
set "NEON_RUNNER=npx.cmd --yes neon@latest"
:init
call %NEON_RUNNER% init -y --org-id org-still-firefly-07850187 --project-id dawn-glitter-86894411 --branch production --services postgres --no-agent-setup
if not errorlevel 1 goto deploy
echo Complete the Neon sign-in in your browser, then return here.
call %NEON_RUNNER% login
if errorlevel 1 goto failed
call %NEON_RUNNER% init -y --org-id org-still-firefly-07850187 --project-id dawn-glitter-86894411 --branch production --services postgres --no-agent-setup
if errorlevel 1 goto failed
:deploy
call %NEON_RUNNER% deploy
if errorlevel 1 goto failed
node scripts\finish-neon-setup.mjs
if errorlevel 1 goto failed
goto done
:failed
echo Setup stopped. Read the error above; do not share env files or credentials.
:done
pause
endlocal

