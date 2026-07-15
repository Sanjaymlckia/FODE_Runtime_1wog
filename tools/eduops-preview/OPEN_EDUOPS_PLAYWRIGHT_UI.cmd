@echo off
setlocal
cd /d "%~dp0"
echo This helper opens a headed Chromium review session against the local Preview Lab.
echo Start START_EDUOPS_PREVIEW.cmd first if the preview is not already running.
set FODE_PLAYWRIGHT_MODULE=%FODE_PLAYWRIGHT_MODULE%
if "%FODE_PLAYWRIGHT_MODULE%"=="" set FODE_PLAYWRIGHT_MODULE=F:\Playwright\fode-secure-link-diagnostic\node_modules\playwright
node tests\open-headed-review.js
endlocal
