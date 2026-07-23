@echo off
setlocal
cd /d "%~dp0..\.."
if "%FODE_PLAYWRIGHT_PROFILE%"=="" set FODE_PLAYWRIGHT_PROFILE=C:\Users\sanja\AppData\Local\FODE_Playwright\admin-staging-profile
if "%EDUOPS_OPERATIONS_EXPECTED_RUNTIME%"=="" set EDUOPS_OPERATIONS_EXPECTED_RUNTIME=r365
if "%EDUOPS_OPERATIONS_EXPECTED_DEPLOY%"=="" set EDUOPS_OPERATIONS_EXPECTED_DEPLOY=365
node tools\eduops-operations-preview\server\capture-fresh-eduops-operations-snapshot.js %*
