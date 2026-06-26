param(
  [string]$BackupRoot = "F:\FODE_DR_Backup",
  [string]$ManifestPath = "",
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path,
  [string]$RuntimeVersion = "",
  [string]$DeployVersion = "",
  [string]$AppsScriptVersion = "",
  [string]$AdminDeploymentId = "",
  [string]$StudentDeploymentId = "",
  [string]$ProductionDeploymentId = "",
  [string]$ReleaseClassification = "UNKNOWN",
  [string]$AcceptanceStatus = "UNKNOWN",
  [string]$RemoteSourceProofPath = "",
  [string]$HealthProofPath = "",
  [string]$HydrationProofPath = "",
  [string]$CommunicationSmokeProofPath = "",
  [string]$GalleryStatusTemplateProofPath = "",
  [string]$OperatorAcceptanceEvidence = "",
  [string]$Notes = "",
  [switch]$Plan,
  [switch]$Execute
)

$ErrorActionPreference = "Stop"

function Fail-ReleaseRecord {
  param([string]$Message)
  Write-Error $Message
  exit 1
}

function Unknown-IfBlank {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) { return "[UNKNOWN]" }
  return $Value
}

function Git-Text {
  param([string[]]$GitArgs)
  Push-Location -LiteralPath $RepoRoot
  try {
    $output = & git @GitArgs 2>$null
    if ($LASTEXITCODE -ne 0) { return "" }
    return ($output -join "`n").Trim()
  } finally {
    Pop-Location
  }
}

if ($Plan -and $Execute) {
  Fail-ReleaseRecord "Use either -Plan or -Execute, not both."
}

if (!$Plan -and !$Execute) {
  $Plan = $true
}

if ([string]::IsNullOrWhiteSpace($ManifestPath)) {
  $ManifestPath = Join-Path $BackupRoot "manifests\fode_runtime_recovery_manifest_v01.json"
}

$manifest = $null
if (Test-Path -LiteralPath $ManifestPath -PathType Leaf) {
  $manifest = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json
}

if ($manifest) {
  if ([string]::IsNullOrWhiteSpace($RuntimeVersion)) { $RuntimeVersion = [string]$manifest.appsScript.version }
  if ([string]::IsNullOrWhiteSpace($DeployVersion)) { $DeployVersion = [string]$manifest.appsScript.deployVersionNumber }
  if ([string]::IsNullOrWhiteSpace($AppsScriptVersion)) { $AppsScriptVersion = [string]$manifest.appsScript.deployVersionNumber }
  if ([string]::IsNullOrWhiteSpace($AdminDeploymentId)) { $AdminDeploymentId = [string]$manifest.appsScript.adminDeploymentId }
  if ([string]::IsNullOrWhiteSpace($StudentDeploymentId)) { $StudentDeploymentId = [string]$manifest.appsScript.studentDeploymentId }
  if ([string]::IsNullOrWhiteSpace($ProductionDeploymentId)) { $ProductionDeploymentId = [string]$manifest.appsScript.productionDeploymentId }
}

$gitBranch = Git-Text @("branch", "--show-current")
$gitCommit = Git-Text @("rev-parse", "HEAD")
$gitRemote = Git-Text @("remote", "-v")

if ([string]::IsNullOrWhiteSpace($RuntimeVersion)) { $RuntimeVersion = "[UNKNOWN]" }
if ([string]::IsNullOrWhiteSpace($DeployVersion)) { $DeployVersion = "[UNKNOWN]" }
if ([string]::IsNullOrWhiteSpace($AppsScriptVersion)) { $AppsScriptVersion = "[UNKNOWN]" }

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$runtimeSlug = ($RuntimeVersion -replace "[^A-Za-z0-9_-]", "")
if ([string]::IsNullOrWhiteSpace($runtimeSlug)) { $runtimeSlug = "unknown" }

$proofRoot = Join-Path $BackupRoot "release_proofs"
$jsonPath = Join-Path $proofRoot ("release_{0}_{1}.json" -f $runtimeSlug, $timestamp)
$mdPath = Join-Path $proofRoot ("release_{0}_{1}.md" -f $runtimeSlug, $timestamp)

$record = [ordered]@{
  generatedAt = (Get-Date).ToString("o")
  runtime = [ordered]@{
    version = Unknown-IfBlank $RuntimeVersion
    deployVersion = Unknown-IfBlank $DeployVersion
    appsScriptVersion = Unknown-IfBlank $AppsScriptVersion
  }
  deployments = [ordered]@{
    admin = Unknown-IfBlank $AdminDeploymentId
    student = Unknown-IfBlank $StudentDeploymentId
    production = Unknown-IfBlank $ProductionDeploymentId
  }
  repository = [ordered]@{
    branch = Unknown-IfBlank $gitBranch
    commitSha = Unknown-IfBlank $gitCommit
    remote = Unknown-IfBlank $gitRemote
  }
  release = [ordered]@{
    dateTime = (Get-Date).ToString("o")
    classification = Unknown-IfBlank $ReleaseClassification
    acceptanceStatus = Unknown-IfBlank $AcceptanceStatus
  }
  proofPaths = [ordered]@{
    remoteSource = Unknown-IfBlank $RemoteSourceProofPath
    health = Unknown-IfBlank $HealthProofPath
    hydration = Unknown-IfBlank $HydrationProofPath
    communicationSmoke = Unknown-IfBlank $CommunicationSmokeProofPath
    galleryStatusTemplate = Unknown-IfBlank $GalleryStatusTemplateProofPath
    operatorManualAcceptance = Unknown-IfBlank $OperatorAcceptanceEvidence
  }
  notes = Unknown-IfBlank $Notes
  boundaries = @(
    "Evidence recording only",
    "No Apps Script API calls",
    "No deployment/version/repin",
    "No Sheet export/edit",
    "No Drive data copy/edit",
    "No send"
  )
}

$md = @"
# FODE Release Record $RuntimeVersion / $DeployVersion

Generated: $($record.generatedAt)

## Runtime

- Runtime version: $($record.runtime.version)
- Deploy version: $($record.runtime.deployVersion)
- Apps Script platform version: $($record.runtime.appsScriptVersion)

## Deployments

- Admin deployment ID: $($record.deployments.admin)
- Student deployment ID: $($record.deployments.student)
- Production deployment ID: $($record.deployments.production)

## Repository

- Branch: $($record.repository.branch)
- Commit SHA: $($record.repository.commitSha)

Remote:

~~~text
$($record.repository.remote)
~~~

## Release

- Classification: $($record.release.classification)
- Acceptance status: $($record.release.acceptanceStatus)
- Release date/time: $($record.release.dateTime)

## Proof Paths

- Remote source proof: $($record.proofPaths.remoteSource)
- Health proof: $($record.proofPaths.health)
- Hydration proof: $($record.proofPaths.hydration)
- Communication smoke proof: $($record.proofPaths.communicationSmoke)
- Gallery/status/template proof: $($record.proofPaths.galleryStatusTemplate)
- Operator/manual acceptance evidence: $($record.proofPaths.operatorManualAcceptance)

## Notes

$($record.notes)

## Boundaries

- Evidence recording only.
- No Apps Script API calls.
- No deployment/version/repin.
- No Sheet export/edit.
- No Drive data copy/edit.
- No send.
"@

Write-Host "FODE release record tool"
Write-Host "Mode: $(if ($Execute) { 'Execute' } else { 'Plan' })"
Write-Host "Manifest: $ManifestPath"
Write-Host "Output JSON: $jsonPath"
Write-Host "Output Markdown: $mdPath"
Write-Host "Runtime: $RuntimeVersion / $DeployVersion"
Write-Host "Apps Script version: $AppsScriptVersion"
Write-Host "Git commit: $(Unknown-IfBlank $gitCommit)"

if ($Plan) {
  Write-Host "PLAN ONLY: no files created."
  exit 0
}

if (!(Test-Path -LiteralPath $proofRoot -PathType Container)) {
  New-Item -ItemType Directory -Force -Path $proofRoot | Out-Null
}

$record | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $jsonPath -Encoding UTF8
$md | Set-Content -LiteralPath $mdPath -Encoding UTF8

Write-Host "PASS: release record created"
