param(
  [string]$RepoRoot = "E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Runtime_1wog",
  [string]$ExpectedScriptId = "1wogECIIksKIhrho6OeKXdt3f7nmrMjSSeFfXwlypa3o-Do3MECvKOI90",
  [string]$RemoteCheckRoot = "E:\Gdrive\01 SANJAY\Codex_Sync\_clasp_remote_check_FODE"
)

$ErrorActionPreference = "Stop"

function Fail-And-Exit {
  param([string]$Message, [int]$Code = 1)
  Write-Host "FAIL: $Message" -ForegroundColor Red
  exit $Code
}

function Pass-Note {
  param([string]$Message)
  Write-Host "PASS: $Message" -ForegroundColor Green
}

function Normalize-Path {
  param([string]$PathText)
  return ([System.IO.Path]::GetFullPath($PathText)).TrimEnd('\')
}

function Get-ConfigIdentity {
  param([string]$ConfigPath)
  if (!(Test-Path -LiteralPath $ConfigPath)) {
    Fail-And-Exit "Config.js missing at $ConfigPath"
  }
  $raw = Get-Content -LiteralPath $ConfigPath -Raw
  $versionMatch = [regex]::Match($raw, 'VERSION\s*:\s*"([^"]+)"')
  $deployMatch = [regex]::Match($raw, 'DEPLOY_VERSION_NUMBER\s*:\s*(\d+)')
  if (!$versionMatch.Success) { Fail-And-Exit "VERSION not found in $ConfigPath" }
  if (!$deployMatch.Success) { Fail-And-Exit "DEPLOY_VERSION_NUMBER not found in $ConfigPath" }
  return [pscustomobject]@{
    Version = $versionMatch.Groups[1].Value
    DeployVersion = [int]$deployMatch.Groups[1].Value
  }
}

try {
  $repoRootResolved = Normalize-Path $RepoRoot
  $cwdResolved = Normalize-Path (Get-Location).Path
  if ($cwdResolved -ne $repoRootResolved) {
    Fail-And-Exit "script must be run from repo root '$repoRootResolved'; current location is '$cwdResolved'"
  }

  $claspPath = Join-Path $repoRootResolved ".clasp.json"
  if (!(Test-Path -LiteralPath $claspPath)) {
    Fail-And-Exit ".clasp.json missing at repo root"
  }
  $claspJson = Get-Content -LiteralPath $claspPath -Raw | ConvertFrom-Json
  $scriptId = [string]$claspJson.scriptId
  if ($scriptId -ne $ExpectedScriptId) {
    Fail-And-Exit "scriptId mismatch: expected $ExpectedScriptId got $scriptId"
  }
  Pass-Note "scriptId matches expected"

  $localConfigPath = Join-Path $repoRootResolved "Config.js"
  $localIdentity = Get-ConfigIdentity -ConfigPath $localConfigPath
  Write-Host "LOCAL VERSION: $($localIdentity.Version)"
  Write-Host "LOCAL DEPLOY_VERSION_NUMBER: $($localIdentity.DeployVersion)"

  $remoteCheckResolved = Normalize-Path $RemoteCheckRoot
  if ($remoteCheckResolved.StartsWith($repoRootResolved, [System.StringComparison]::OrdinalIgnoreCase)) {
    Fail-And-Exit "remote check folder must be outside repo root: $remoteCheckResolved"
  }
  Pass-Note "remote check folder is outside repo root"

  if (Test-Path -LiteralPath $remoteCheckResolved) {
    Remove-Item -LiteralPath $remoteCheckResolved -Recurse -Force
  }
  New-Item -ItemType Directory -Path $remoteCheckResolved | Out-Null
  Pass-Note "remote check folder prepared"

  $tempClaspPath = Join-Path $remoteCheckResolved ".clasp.json"
  $tempClasp = @{
    scriptId = $ExpectedScriptId
    rootDir = "."
  } | ConvertTo-Json -Compress
  Set-Content -LiteralPath $tempClaspPath -Value $tempClasp -Encoding UTF8

  Push-Location $remoteCheckResolved
  try {
    & clasp.cmd pull
    if ($LASTEXITCODE -ne 0) {
      Fail-And-Exit "clasp pull failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
  Pass-Note "clasp pull succeeded"

  $remoteConfigPath = Join-Path $remoteCheckResolved "Config.js"
  $remoteIdentity = Get-ConfigIdentity -ConfigPath $remoteConfigPath
  Write-Host "REMOTE VERSION: $($remoteIdentity.Version)"
  Write-Host "REMOTE DEPLOY_VERSION_NUMBER: $($remoteIdentity.DeployVersion)"

  if ($remoteIdentity.Version -ne $localIdentity.Version) {
    Fail-And-Exit "remote VERSION mismatch: local $($localIdentity.Version) remote $($remoteIdentity.Version)"
  }
  if ($remoteIdentity.DeployVersion -ne $localIdentity.DeployVersion) {
    Fail-And-Exit "remote DEPLOY_VERSION_NUMBER mismatch: local $($localIdentity.DeployVersion) remote $($remoteIdentity.DeployVersion)"
  }

  Pass-Note "remote Config.js matches local Config.js"
  Write-Host "SAFE TO RUN clasp version" -ForegroundColor Green
  exit 0
} catch {
  Fail-And-Exit $_.Exception.Message
}
