@echo off
setlocal
cd /d "%~dp0"
if "%OPSEDU_PREVIEW_PORT%"=="" set OPSEDU_PREVIEW_PORT=4183
echo Starting OpsEdu Preview Lab at http://127.0.0.1:%OPSEDU_PREVIEW_PORT%/
node server\server.js
