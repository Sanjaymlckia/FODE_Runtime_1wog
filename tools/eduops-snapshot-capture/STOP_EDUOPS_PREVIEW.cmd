@echo off
setlocal
cd /d "%~dp0"
set EDUOPS_PREVIEW_PORT=4173
set "EDUOPS_PREVIEW_ROOT=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$pidFile=Join-Path $env:EDUOPS_PREVIEW_ROOT '.eduops-preview.pid';" ^
  "$stopped=@();" ^
  "if(Test-Path -LiteralPath $pidFile){" ^
    "$previewPid=[int](Get-Content -LiteralPath $pidFile -Raw);" ^
    "if(Get-Process -Id $previewPid -ErrorAction SilentlyContinue){Stop-Process -Id $previewPid -Force;$stopped+=$previewPid;}" ^
    "Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue;" ^
  "}" ^
  "Start-Sleep -Milliseconds 250;" ^
  "$listener=Get-NetTCPConnection -LocalPort ([int]$env:EDUOPS_PREVIEW_PORT) -State Listen -ErrorAction SilentlyContinue;" ^
  "if($listener){" ^
    "$process=Get-CimInstance Win32_Process -Filter ('ProcessId='+$listener.OwningProcess);" ^
    "$expected=[IO.Path]::GetFullPath((Join-Path $env:EDUOPS_PREVIEW_ROOT 'server\server.js'));" ^
    "if($process.Name -eq 'node.exe' -and $process.CommandLine -like '*server\server.js*'){Stop-Process -Id $listener.OwningProcess -Force;$stopped+=$listener.OwningProcess;}else{throw ('Port '+$env:EDUOPS_PREVIEW_PORT+' remains occupied by unrelated process '+$listener.OwningProcess+'.');}" ^
  "}" ^
  "$deadline=(Get-Date).AddSeconds(5);" ^
  "do{$remaining=Get-NetTCPConnection -LocalPort ([int]$env:EDUOPS_PREVIEW_PORT) -State Listen -ErrorAction SilentlyContinue;if(-not $remaining){break};Start-Sleep -Milliseconds 100;}while((Get-Date)-lt $deadline);" ^
  "if($remaining){throw ('Port '+$env:EDUOPS_PREVIEW_PORT+' did not close.');}" ^
  "if($stopped.Count){Write-Host ('Stopped EduOps Preview Lab process '+(($stopped|Select-Object -Unique)-join ', ')+'.')}else{Write-Host 'No running EduOps Preview Lab process was found.'}"
if errorlevel 1 exit /b 1
endlocal
