@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found on PATH.
  echo Install or enable Node.js before starting the EduOps Preview Lab.
  pause
  exit /b 1
)
set EDUOPS_PREVIEW_PORT=4173
echo Starting EduOps Preview Lab on http://localhost:%EDUOPS_PREVIEW_PORT%/
echo NO LIVE DATA / NO LIVE MUTATIONS / SIMULATED EDUOPS CONTRACTS
start "EduOps Preview Lab Server" /min cmd /c "cd /d "%~dp0" && node server\server.js"
timeout /t 2 /nobreak >nul
start "" "http://localhost:%EDUOPS_PREVIEW_PORT%/"
echo Preview URL: http://localhost:%EDUOPS_PREVIEW_PORT%/
echo Use STOP_EDUOPS_PREVIEW.cmd to stop only this preview server.
endlocal
