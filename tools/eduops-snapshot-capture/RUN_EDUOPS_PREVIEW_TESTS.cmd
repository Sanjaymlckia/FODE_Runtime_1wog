@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found on PATH.
  exit /b 1
)
node tests\preview-contract.test.js
if errorlevel 1 exit /b 1
node tests\preview-lab.browser.test.js
if errorlevel 1 exit /b 1
node capture-evidence.js
if errorlevel 1 exit /b 1
echo EduOps Preview Lab tests and evidence capture completed.
endlocal
