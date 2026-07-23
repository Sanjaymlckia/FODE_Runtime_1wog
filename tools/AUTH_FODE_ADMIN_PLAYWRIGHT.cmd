@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found on PATH.
  exit /b 1
)
if "%FODE_PLAYWRIGHT_AUTH_PROFILE_DIR%"=="" (
  set "FODE_PLAYWRIGHT_AUTH_PROFILE_DIR=%LOCALAPPDATA%\FODE_Playwright\admin-staging-profile"
)
echo Opening dedicated Admin staging Playwright profile:
echo   %FODE_PLAYWRIGHT_AUTH_PROFILE_DIR%
echo Sign in with Google in the opened Chrome window if prompted.
node auth-fode-admin-playwright.js %*
if errorlevel 1 exit /b %errorlevel%
endlocal
