param(
  [string]$RepoRoot = "D:\Repos\FODE_Runtime_1wog",
  [string]$ExpectedScriptId = "",
  [string[]]$RequiredCodeMarkers = @(),
  [string[]]$RequiredAdminUiMarkers = @(),
  [string[]]$RequiredAdminMarkers = @(),
  [string[]]$RequiredLifecycleMarkers = @(),
  [switch]$RequireHashMatch
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

function Get-ConfigIdentityFromText {
  param([string]$Text, [string]$Label)
  $versionMatch = [regex]::Match($Text, 'VERSION\s*:\s*"([^"]+)"')
  $deployMatch = [regex]::Match($Text, 'DEPLOY_VERSION_NUMBER\s*:\s*(\d+)')
  if (!$versionMatch.Success) { Fail-And-Exit "VERSION not found in $Label" }
  if (!$deployMatch.Success) { Fail-And-Exit "DEPLOY_VERSION_NUMBER not found in $Label" }
  return [pscustomobject]@{
    Version = $versionMatch.Groups[1].Value
    DeployVersion = [int]$deployMatch.Groups[1].Value
  }
}

function Get-DeployableFilesFromClaspIgnore {
  param([string]$RepoRoot)
  $path = Join-Path $RepoRoot ".claspignore"
  if (!(Test-Path -LiteralPath $path -PathType Leaf)) { Fail-And-Exit ".claspignore missing at $path" }
  $files = @(Get-Content -LiteralPath $path |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ -match '^![^*]' } |
    ForEach-Object { $_.Substring(1).Replace("\", "/") } |
    Where-Object { $_ })
  return @($files | Sort-Object -Unique)
}

function Convert-DeployablePathToAppsScriptName {
  param([string]$PathText)
  $name = [System.IO.Path]::GetFileName($PathText)
  if ($name -eq "appsscript.json") { return "appsscript" }
  return [System.IO.Path]::GetFileNameWithoutExtension($name)
}

function Assert-Markers {
  param([string]$Source, [string[]]$Markers, [string]$Label)
  $normalized = Normalize-MarkerList -Values $Markers
  if (!$normalized -or $normalized.Count -eq 0) { return }
  foreach ($marker in $normalized) {
    if (!$Source.Contains($marker)) { Fail-And-Exit "$Label missing required marker: $marker" }
  }
  Pass-Note "$Label required markers present"
}

function Normalize-MarkerList {
  param([string[]]$Values)
  $out = @()
  foreach ($value in @($Values)) {
    if ($null -eq $value) { continue }
    foreach ($part in ([string]$value -split ",")) {
      $trimmed = $part.Trim()
      if ($trimmed) { $out += $trimmed }
    }
  }
  return @($out)
}

function Get-ClaspToken {
  $path = Join-Path $env:USERPROFILE ".clasprc.json"
  if (!(Test-Path -LiteralPath $path -PathType Leaf)) { Fail-And-Exit ".clasprc.json not found" }
  $raw = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
  $token = $null
  if ($raw.tokens -and $raw.tokens.default) { $token = $raw.tokens.default }
  elseif ($raw.token) { $token = $raw.token }
  if (!$token) { Fail-And-Exit "clasp OAuth token not found in .clasprc.json" }
  $clientId = [string]$token.client_id
  $clientSecret = [string]$token.client_secret
  if (!$clientId -and $raw.oauth2ClientSettings) { $clientId = [string]$raw.oauth2ClientSettings.clientId }
  if (!$clientSecret -and $raw.oauth2ClientSettings) { $clientSecret = [string]$raw.oauth2ClientSettings.clientSecret }
  $body = @{
    client_id = $clientId
    client_secret = $clientSecret
    refresh_token = [string]$token.refresh_token
    grant_type = "refresh_token"
  }
  if (!$body.client_id -or !$body.client_secret -or !$body.refresh_token) {
    Fail-And-Exit "clasp OAuth token is missing required fields"
  }
  return (Invoke-RestMethod -Method Post -Uri "https://oauth2.googleapis.com/token" -Body $body).access_token
}

try {
  $repoRootResolved = Normalize-Path $RepoRoot
  $cwdResolved = Normalize-Path (Get-Location).Path
  if ($cwdResolved -ne $repoRootResolved) {
    Fail-And-Exit "script must be run from repo root '$repoRootResolved'; current location is '$cwdResolved'"
  }

  $contextPath = Join-Path $repoRootResolved "runtime-context.json"
  if (!(Test-Path -LiteralPath $contextPath -PathType Leaf)) { Fail-And-Exit "runtime-context.json missing" }
  $context = Get-Content -LiteralPath $contextPath -Raw | ConvertFrom-Json
  $project = $context.projects.FODE
  if (!$ExpectedScriptId) { $ExpectedScriptId = [string]$project.appsScript.scriptId }

  $claspPath = Join-Path $repoRootResolved ".clasp.json"
  if (!(Test-Path -LiteralPath $claspPath)) { Fail-And-Exit ".clasp.json missing at repo root" }
  $scriptId = [string]((Get-Content -LiteralPath $claspPath -Raw | ConvertFrom-Json).scriptId)
  if ($scriptId -ne $ExpectedScriptId) { Fail-And-Exit "scriptId mismatch: expected $ExpectedScriptId got $scriptId" }
  Pass-Note "scriptId matches expected"

  $localConfigText = Get-Content -LiteralPath (Join-Path $repoRootResolved "Config.js") -Raw
  $localIdentity = Get-ConfigIdentityFromText -Text $localConfigText -Label "local Config.js"
  Write-Host "LOCAL VERSION: $($localIdentity.Version)"
  Write-Host "LOCAL DEPLOY_VERSION_NUMBER: $($localIdentity.DeployVersion)"

  $deployableFiles = @(Get-DeployableFilesFromClaspIgnore -RepoRoot $repoRootResolved)
  if ($deployableFiles.Count -eq 0) { Fail-And-Exit "no deployable files found from .claspignore" }
  $missingLocal = @($deployableFiles | Where-Object { !(Test-Path -LiteralPath (Join-Path $repoRootResolved $_) -PathType Leaf) })
  if ($missingLocal.Count -gt 0) { Fail-And-Exit "deployable files missing locally: $($missingLocal -join ', ')" }
  Pass-Note "deployable files derived from .claspignore: $($deployableFiles.Count)"

  $accessToken = Get-ClaspToken
  $remote = Invoke-RestMethod -Method Get -Uri ("https://script.googleapis.com/v1/projects/" + $scriptId + "/content") -Headers @{
    Authorization = "Bearer $accessToken"
  }
  $remoteByName = @{}
  foreach ($file in @($remote.files)) { $remoteByName[[string]$file.name] = [string]$file.source }

  $expectedNames = @($deployableFiles | ForEach-Object { Convert-DeployablePathToAppsScriptName -PathText $_ } | Sort-Object -Unique)
  $remoteNames = @($remoteByName.Keys | Sort-Object -Unique)
  $missingRemote = @($expectedNames | Where-Object { $remoteNames -notcontains $_ })
  $extraRemote = @($remoteNames | Where-Object { $expectedNames -notcontains $_ })
  if ($missingRemote.Count -gt 0 -or $extraRemote.Count -gt 0) {
    if ($missingRemote.Count -gt 0) { Write-Host "Missing remote files: $($missingRemote -join ', ')" -ForegroundColor Red }
    if ($extraRemote.Count -gt 0) { Write-Host "Extra remote files: $($extraRemote -join ', ')" -ForegroundColor Red }
    Fail-And-Exit "remote file set does not match deployable .claspignore contract"
  }
  Pass-Note "remote source file set matches deployable .claspignore contract: $($expectedNames.Count)"

  if ($RequireHashMatch) {
    foreach ($file in $deployableFiles) {
      $appName = Convert-DeployablePathToAppsScriptName -PathText $file
      $localText = (Get-Content -LiteralPath (Join-Path $repoRootResolved $file) -Raw).Replace("`r`n", "`n")
      $remoteText = ([string]$remoteByName[$appName]).Replace("`r`n", "`n")
      $localHash = [System.BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash([System.Text.Encoding]::UTF8.GetBytes($localText))).Replace("-", "")
      $remoteHash = [System.BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash([System.Text.Encoding]::UTF8.GetBytes($remoteText))).Replace("-", "")
      if ($localHash -ne $remoteHash) { Fail-And-Exit "remote hash mismatch: $file" }
    }
    Pass-Note "remote deployable source hash-matches local source"
  } else {
    Pass-Note "remote hash comparison skipped by default; file-set, identity, and marker proof remain active"
  }

  $remoteIdentity = Get-ConfigIdentityFromText -Text ([string]$remoteByName.Config) -Label "remote Config"
  if ($remoteIdentity.Version -ne $localIdentity.Version) {
    Fail-And-Exit "remote VERSION mismatch: local $($localIdentity.Version) remote $($remoteIdentity.Version)"
  }
  if ($remoteIdentity.DeployVersion -ne $localIdentity.DeployVersion) {
    Fail-And-Exit "remote DEPLOY_VERSION_NUMBER mismatch: local $($localIdentity.DeployVersion) remote $($remoteIdentity.DeployVersion)"
  }
  Pass-Note "remote Config.js identity matches local"

  Assert-Markers -Source ([string]$remoteByName.Code) -Markers $RequiredCodeMarkers -Label "Code"
  Assert-Markers -Source ([string]$remoteByName.AdminUI) -Markers $RequiredAdminUiMarkers -Label "AdminUI"
  Assert-Markers -Source ([string]$remoteByName.Admin) -Markers $RequiredAdminMarkers -Label "Admin"
  Assert-Markers -Source ([string]$remoteByName.Admin_LifecycleAuthority) -Markers $RequiredLifecycleMarkers -Label "Admin_LifecycleAuthority"

  Write-Host "REMOTE SOURCE PROOF: Apps Script API projects.getContent"
  Write-Host "SAFE TO RUN clasp version" -ForegroundColor Green
  exit 0
} catch {
  Fail-And-Exit $_.Exception.Message
}
