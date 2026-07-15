@echo off
setlocal
cd /d "%~dp0"
if not exist ".eduops-preview.pid" (
  echo No EduOps Preview Lab PID file was found.
  exit /b 0
)
set /p EDUOPS_PREVIEW_PID=<".eduops-preview.pid"
if "%EDUOPS_PREVIEW_PID%"=="" (
  del ".eduops-preview.pid" >nul 2>nul
  echo Empty PID file removed.
  exit /b 0
)
taskkill /PID %EDUOPS_PREVIEW_PID% /T /F >nul 2>nul
if errorlevel 1 (
  echo Preview process %EDUOPS_PREVIEW_PID% was not running or could not be stopped.
) else (
  echo Stopped EduOps Preview Lab process %EDUOPS_PREVIEW_PID%.
)
del ".eduops-preview.pid" >nul 2>nul
endlocal
