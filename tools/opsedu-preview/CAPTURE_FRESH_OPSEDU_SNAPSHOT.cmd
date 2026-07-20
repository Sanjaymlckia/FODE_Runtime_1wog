@echo off
setlocal
cd /d "%~dp0..\.."
if "%FODE_PLAYWRIGHT_PROFILE%"=="" set FODE_PLAYWRIGHT_PROFILE=C:\Users\sanja\AppData\Local\FODE_Playwright\admin-staging-profile
if "%OPSEDU_EXPECTED_RUNTIME%"=="" set OPSEDU_EXPECTED_RUNTIME=r365
if "%OPSEDU_EXPECTED_DEPLOY%"=="" set OPSEDU_EXPECTED_DEPLOY=365
node tools\opsedu-preview\server\capture-fresh-opsedu-snapshot.js %*
