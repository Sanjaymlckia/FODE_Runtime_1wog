@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found on PATH.
  echo Install or enable Node.js before starting the EduOps Preview Lab.
  pause
  exit /b 1
)
set EDUOPS_PREVIEW_PORT=4173
set "EDUOPS_PREVIEW_ROOT=%~dp0"
set "EDUOPS_PREVIEW_NODE=%~dp0server\server.js"
set "EDUOPS_PREVIEW_STDERR=%~dp0preview-server.stderr.log"
echo Starting EduOps Preview Lab with bounded readiness verification...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$port=[int]$env:EDUOPS_PREVIEW_PORT;" ^
  "$url='http://localhost:'+$port+'/';" ^
  "$healthUrl='http://127.0.0.1:'+$port+'/health';" ^
  "$listener=Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue;" ^
  "if($listener){throw ('Port '+$port+' is already in use by process '+$listener.OwningProcess+'. Run STOP_EDUOPS_PREVIEW.cmd and retry.');}" ^
  "Remove-Item -LiteralPath (Join-Path $env:EDUOPS_PREVIEW_ROOT '.eduops-preview.pid') -Force -ErrorAction SilentlyContinue;" ^
  "$previewPid=[int](& node $env:EDUOPS_PREVIEW_NODE --daemon);" ^
  "if(-not $previewPid){throw 'Preview server did not return a child process ID.';}" ^
  "$deadline=(Get-Date).AddSeconds(15);" ^
  "$health=$null;" ^
  "$lastError='';" ^
  "while((Get-Date)-lt $deadline){" ^
    "if(-not (Get-Process -Id $previewPid -ErrorAction SilentlyContinue)){$detail=(Get-Content -LiteralPath $env:EDUOPS_PREVIEW_STDERR -Raw -ErrorAction SilentlyContinue);throw ('Preview server exited before readiness. '+$detail);}" ^
    "try{$health=Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2;if($health.ok -and $health.serverReady -and $health.applicationAssetsReady -and $health.sharedClientReady -and $health.previewTransportReady){break;}$lastError='Health response was not ready.';}catch{$lastError=$_.Exception.Message;}" ^
    "Start-Sleep -Milliseconds 150;" ^
  "}" ^
  "if(-not $health -or -not $health.ok){Stop-Process -Id $previewPid -Force -ErrorAction SilentlyContinue;throw ('Preview Lab did not become ready within 15 seconds. Last readiness error: '+$lastError);}" ^
  "if([int]$health.pid -ne $previewPid){Stop-Process -Id $previewPid -Force -ErrorAction SilentlyContinue;throw ('Health endpoint process mismatch. Expected '+$previewPid+' but received '+$health.pid+'.');}" ^
  "Write-Host ('SERVER READY: '+$health.serverBuildTimestamp);" ^
  "Write-Host ('SERVER PID: '+$health.pid);" ^
  "Write-Host ('CLIENT HASH: '+$health.runtimeClientInputHash);" ^
  "Write-Host ('SERVED BUNDLE HASH: '+$health.servedClientBundleHash);" ^
  "Write-Host ('Preview URL: '+$url);" ^
  "Write-Host 'NO LIVE DATA / NO LIVE MUTATIONS / SIMULATED EDUOPS CONTRACTS';" ^
  "if($env:EDUOPS_PREVIEW_NO_BROWSER -ne '1'){Start-Process $url;}"
if errorlevel 1 (
  echo EduOps Preview Lab failed to start.
  exit /b 1
)
echo Use STOP_EDUOPS_PREVIEW.cmd to stop only this preview server.
endlocal
