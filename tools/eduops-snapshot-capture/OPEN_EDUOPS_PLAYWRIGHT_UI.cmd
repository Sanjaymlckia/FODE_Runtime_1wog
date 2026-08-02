@echo off
setlocal
cd /d "%~dp0"
echo This helper opens a headed Chromium review session against the local Preview Lab.
echo Start START_EDUOPS_PREVIEW.cmd first if the preview is not already running.
set FODE_PLAYWRIGHT_ROOT=%FODE_PLAYWRIGHT_ROOT%
if "%FODE_PLAYWRIGHT_ROOT%"=="" set FODE_PLAYWRIGHT_ROOT=D:\FODE_Tooling\Playwright
set PLAYWRIGHT_BROWSERS_PATH=%PLAYWRIGHT_BROWSERS_PATH%
if "%PLAYWRIGHT_BROWSERS_PATH%"=="" set PLAYWRIGHT_BROWSERS_PATH=%FODE_PLAYWRIGHT_ROOT%\browsers
node tests\open-headed-review.js
endlocal
