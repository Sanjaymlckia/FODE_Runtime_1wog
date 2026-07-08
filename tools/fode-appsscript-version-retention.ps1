param(
  [ValidateSet("Plan", "Audit", "DeleteCandidates")]
  [string]$Mode = "Audit",
  [string]$ContextPath = "runtime-context.json",
  [int]$KeepMostRecent = 20,
  [int[]]$ManualProtectedVersions = @(346),
  [string]$OutputRoot = ".release-proof\version-retention"
)

$ErrorActionPreference = "Stop"

function Ensure-Directory {
  param([string]$Path)
  if (!(Test-Path -LiteralPath $Path -PathType Container)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

function Parse-VersionLines {
  param([string[]]$Lines)
  $items = @()
  foreach ($line in @($Lines)) {
    if ($line -match '^\s*(\d+)\s+-\s*(.*)$') {
      $items += [pscustomobject]@{
        version = [int]$Matches[1]
        description = [string]$Matches[2]
      }
    }
  }
  return @($items | Sort-Object version -Descending)
}

function Parse-DeploymentLines {
  param([string[]]$Lines)
  $items = @()
  foreach ($line in @($Lines)) {
    if ($line -match '^\-\s+(\S+)\s+@(\S+)(?:\s+-\s*(.*))?$') {
      $items += [pscustomobject]@{
        deploymentId = [string]$Matches[1]
        version = [string]$Matches[2]
        numericVersion = if ($Matches[2] -match '^\d+$') { [int]$Matches[2] } else { $null }
        description = [string]$Matches[3]
        raw = [string]$line
      }
    }
  }
  return @($items)
}

function Add-Protected {
  param(
    [hashtable]$Map,
    [int]$Version,
    [string]$Reason
  )
  if ($Version -le 0) { return }
  $key = [string]$Version
  if (!$Map.ContainsKey($key)) { $Map[$key] = New-Object System.Collections.Generic.List[string] }
  $Map[$key].Add($Reason) | Out-Null
}

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
Set-Location -LiteralPath $repoRoot

if (!(Test-Path -LiteralPath $ContextPath -PathType Leaf)) { throw "runtime context not found: $ContextPath" }
$context = Get-Content -LiteralPath $ContextPath -Raw | ConvertFrom-Json
$project = $context.projects.FODE

$versions = Parse-VersionLines -Lines @(& clasp.cmd versions)
if ($LASTEXITCODE -ne 0) { throw "clasp versions failed" }
$deployments = Parse-DeploymentLines -Lines @(& clasp.cmd deployments)
if ($LASTEXITCODE -ne 0) { throw "clasp deployments failed" }

$protected = @{}
Add-Protected -Map $protected -Version ([int]$project.deployments.adminStaging.expectedAppsScriptVersion) -Reason "current Admin staging expected Apps Script version"
Add-Protected -Map $protected -Version ([int]$project.deployments.studentStaging.expectedAppsScriptVersion) -Reason "current Student staging expected Apps Script version"
foreach ($version in @($ManualProtectedVersions)) {
  Add-Protected -Map $protected -Version ([int]$version) -Reason "manual protected version"
}
foreach ($deployment in @($deployments)) {
  if ($null -ne $deployment.numericVersion) {
    Add-Protected -Map $protected -Version ([int]$deployment.numericVersion) -Reason "active deployment: $($deployment.deploymentId)"
  }
}
$recent = @($versions | Select-Object -First $KeepMostRecent)
foreach ($version in @($recent)) {
  Add-Protected -Map $protected -Version ([int]$version.version) -Reason "most recent retention window ($KeepMostRecent)"
}

$candidateItems = @()
foreach ($version in @($versions)) {
  $key = [string]$version.version
  $reasons = if ($protected.ContainsKey($key)) { @($protected[$key]) } else { @() }
  $candidate = $reasons.Count -eq 0
  $candidateItems += [pscustomobject]@{
    version = [int]$version.version
    description = [string]$version.description
    protected = -not $candidate
    protectedReasons = $reasons
    deleteCandidate = $candidate
  }
}

$deleteCandidates = @($candidateItems | Where-Object { $_.deleteCandidate -eq $true })
$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH-mm-ssZ")
$outputDir = Join-Path $repoRoot $OutputRoot
Ensure-Directory -Path $outputDir
$jsonPath = Join-Path $outputDir "$timestamp-version-retention-$($Mode.ToLowerInvariant()).json"
$mdPath = Join-Path $outputDir "$timestamp-version-retention-$($Mode.ToLowerInvariant()).md"

$manifest = [pscustomobject]@{
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  mode = $Mode
  readOnly = $true
  project = "FODE"
  scriptId = [string]$project.appsScript.scriptId
  keepMostRecent = $KeepMostRecent
  protectedVersions = $candidateItems | Where-Object { $_.protected -eq $true }
  deleteCandidates = $deleteCandidates
  activeDeployments = $deployments
  noDeletionPerformed = $true
}
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $jsonPath -Encoding UTF8

$lines = @()
$lines += "# FODE Apps Script Version Retention $Mode"
$lines += ""
$lines += "- Generated: $($manifest.generatedAt)"
$lines += "- Read-only: true"
$lines += "- Script ID: $($manifest.scriptId)"
$lines += "- Keep most recent: $KeepMostRecent"
$lines += "- Protected versions: $(@($manifest.protectedVersions).Count)"
$lines += "- Delete candidates: $(@($manifest.deleteCandidates).Count)"
$lines += "- No deletion performed: true"
$lines += ""
$lines += "## Protected Versions"
foreach ($item in @($manifest.protectedVersions | Sort-Object version -Descending)) {
  $lines += "- @$($item.version): $($item.description) [$($item.protectedReasons -join '; ')]"
}
$lines += ""
$lines += "## Delete Candidates"
if (@($manifest.deleteCandidates).Count -eq 0) {
  $lines += "- None"
} else {
  foreach ($item in @($manifest.deleteCandidates | Sort-Object version -Descending)) {
    $lines += "- @$($item.version): $($item.description)"
  }
}
$lines += ""
$lines += "## Safety"
$lines += "This tool never deletes versions. Use the manifest for operator review only."
$lines | Set-Content -LiteralPath $mdPath -Encoding UTF8

Write-Host "FODE Apps Script Version Retention"
Write-Host "Mode: $Mode"
Write-Host "Read-only: true"
Write-Host "Protected versions: $(@($manifest.protectedVersions).Count)"
Write-Host "Delete candidates: $(@($manifest.deleteCandidates).Count)"
Write-Host "JSON: $jsonPath"
Write-Host "Markdown: $mdPath"
Write-Host "No Apps Script version deletion performed."
