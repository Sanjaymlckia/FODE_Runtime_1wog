@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found on PATH.
  exit /b 1
)
echo Capturing Fresh FODE Snapshot from authorised Admin staging read-only EduOps RPCs.
echo This command is explicit and separate from normal Preview Lab startup.
echo It must not be used against Student, Production or OPS.
node server\capture-fresh-snapshot.js %*
endlocal
