param(
  [string]$RepoRoot = "E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog",
  [string]$ExpectedScriptId = "1wogECIIksKIhrho6OeKXdt3f7nmrMjSSeFfXwlypa3o-Do3MECvKOI90",
  [string]$RemoteCheckRoot = "E:\Gdrive\01_SANJAY\Codex_Sync\_clasp_remote_check_FODE",
  [string[]]$RequiredCodeMarkers = @(),
  [string[]]$RequiredAdminUiMarkers = @(),
  [switch]$AllowExternalRemoteCheck
)

$ErrorActionPreference = "Stop"

$RuntimeFiles = @(
  "Admin.js",
  "AdminUI_OpsApplicantQueue.html",
  "AdminUI_OpsCommunications.html",
  "AdminUI_OpsLifecycle.html",
  "AdminUI_SharedRowFacts.html",
  "AdminUI.html",
  "appsscript.json",
  "Code.js",
  "Config.js",
  "Routes.js",
  "Utils.js",
  "whoami_admin.html"
)

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
  if (!(Test-Path -LiteralPath $ConfigPath)) { Fail-And-Exit "Config.js missing at $ConfigPath" }
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

function Assert-Markers {
  param([string]$Path, [string[]]$Markers, [string]$Label)
  if (!$Markers -or $Markers.Count -eq 0) { return }
  $text = Get-Content -LiteralPath $Path -Raw
  foreach ($marker in $Markers) {
    if (!$text.Contains($marker)) { Fail-And-Exit "$Label missing required marker: $marker" }
  }
  Pass-Note "$Label required markers present"
}

try {
  if (!$AllowExternalRemoteCheck) {
    Fail-And-Exit "external remote proof requires explicit -AllowExternalRemoteCheck approval"
  }

  $repoRootResolved = Normalize-Path $RepoRoot
  $cwdResolved = Normalize-Path (Get-Location).Path
  if ($cwdResolved -ne $repoRootResolved) {
    Fail-And-Exit "script must be run from repo root '$repoRootResolved'; current location is '$cwdResolved'"
  }

  $claspPath = Join-Path $repoRootResolved ".clasp.json"
  if (!(Test-Path -LiteralPath $claspPath)) { Fail-And-Exit ".clasp.json missing at repo root" }
  $scriptId = [string]((Get-Content -LiteralPath $claspPath -Raw | ConvertFrom-Json).scriptId)
  if ($scriptId -ne $ExpectedScriptId) { Fail-And-Exit "scriptId mismatch: expected $ExpectedScriptId got $scriptId" }
  Pass-Note "scriptId matches expected"

  $localIdentity = Get-ConfigIdentity -ConfigPath (Join-Path $repoRootResolved "Config.js")
  Write-Host "LOCAL VERSION: $($localIdentity.Version)"
  Write-Host "LOCAL DEPLOY_VERSION_NUMBER: $($localIdentity.DeployVersion)"

  $remoteCheckResolved = Normalize-Path $RemoteCheckRoot
  if ($remoteCheckResolved.StartsWith($repoRootResolved, [System.StringComparison]::OrdinalIgnoreCase)) {
    Fail-And-Exit "remote check folder must be outside repo root: $remoteCheckResolved"
  }
  if ($remoteCheckResolved.Length -lt 20 -or [System.IO.Path]::GetPathRoot($remoteCheckResolved) -eq $remoteCheckResolved) {
    Fail-And-Exit "unsafe remote check folder: $remoteCheckResolved"
  }
  $remoteCheckLeaf = Split-Path -Leaf $remoteCheckResolved
  if ($remoteCheckLeaf -notlike "_clasp_remote_check_FODE*") {
    Fail-And-Exit "remote check folder name must start with _clasp_remote_check_FODE: $remoteCheckResolved"
  }

  if (Test-Path -LiteralPath $remoteCheckResolved) {
    Remove-Item -LiteralPath $remoteCheckResolved -Recurse -Force
  }
  New-Item -ItemType Directory -Path $remoteCheckResolved | Out-Null
  Pass-Note "remote check folder prepared: $remoteCheckResolved"

  Set-Content -LiteralPath (Join-Path $remoteCheckResolved ".clasp.json") -Value (@{
    scriptId = $ExpectedScriptId
    rootDir = "."
  } | ConvertTo-Json -Compress) -Encoding UTF8

  Push-Location $remoteCheckResolved
  try {
    & clasp.cmd pull
    if ($LASTEXITCODE -ne 0) { Fail-And-Exit "clasp pull failed with exit code $LASTEXITCODE" }
  } finally {
    Pop-Location
  }
  Pass-Note "clasp pull succeeded"

  $remoteFiles = @(Get-ChildItem -LiteralPath $remoteCheckResolved -File |
    Where-Object { $_.Name -ne ".clasp.json" } |
    Select-Object -ExpandProperty Name |
    Sort-Object)
  $expectedFiles = @($RuntimeFiles | Sort-Object)
  if (Compare-Object -ReferenceObject $expectedFiles -DifferenceObject $remoteFiles) {
    Fail-And-Exit "remote runtime file set does not match the 12-file allowlist"
  }
  Pass-Note "remote source contains exactly 12 allowlisted runtime files"

  foreach ($file in $RuntimeFiles) {
    $localPath = Join-Path $repoRootResolved $file
    $remotePath = Join-Path $remoteCheckResolved $file
    if (!(Test-Path -LiteralPath $localPath) -or !(Test-Path -LiteralPath $remotePath)) {
      Fail-And-Exit "missing local or remote runtime file: $file"
    }
    $localHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $localPath).Hash
    $remoteHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $remotePath).Hash
    if ($localHash -ne $remoteHash) { Fail-And-Exit "remote hash mismatch: $file" }
  }
  Pass-Note "all 12 remote runtime files hash-match local source"

  $remoteIdentity = Get-ConfigIdentity -ConfigPath (Join-Path $remoteCheckResolved "Config.js")
  if ($remoteIdentity.Version -ne $localIdentity.Version) {
    Fail-And-Exit "remote VERSION mismatch: local $($localIdentity.Version) remote $($remoteIdentity.Version)"
  }
  if ($remoteIdentity.DeployVersion -ne $localIdentity.DeployVersion) {
    Fail-And-Exit "remote DEPLOY_VERSION_NUMBER mismatch: local $($localIdentity.DeployVersion) remote $($remoteIdentity.DeployVersion)"
  }
  Pass-Note "remote Config.js identity matches local"

  Assert-Markers -Path (Join-Path $remoteCheckResolved "Code.js") -Markers $RequiredCodeMarkers -Label "Code.js"
  Assert-Markers -Path (Join-Path $remoteCheckResolved "AdminUI.html") -Markers $RequiredAdminUiMarkers -Label "AdminUI.html"

  Write-Host "REMOTE PROOF PATH: $remoteCheckResolved"
  Write-Host "SAFE TO RUN clasp version" -ForegroundColor Green
  exit 0
} catch {
  Fail-And-Exit $_.Exception.Message
}
