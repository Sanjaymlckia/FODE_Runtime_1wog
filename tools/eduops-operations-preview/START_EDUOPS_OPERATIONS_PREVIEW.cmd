@echo off
setlocal
cd /d "%~dp0"
if "%EDUOPS_OPERATIONS_PREVIEW_PORT%"=="" set EDUOPS_OPERATIONS_PREVIEW_PORT=4183
echo Starting EduOps Operations Preview Lab at http://127.0.0.1:%EDUOPS_OPERATIONS_PREVIEW_PORT%/
node server\server.js
