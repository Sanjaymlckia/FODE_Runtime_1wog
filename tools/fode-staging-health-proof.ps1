param(
  [Parameter(Mandatory = $true)]
  [string]$AdminUrl,

  [Parameter(Mandatory = $true)]
  [string]$ExpectedRuntime,

  [Parameter(Mandatory = $true)]
  [int]$ExpectedDeploy,

  [string]$ReportRoot = "F:\Playwright\fode-secure-link-diagnostic\reports",

  [ValidateSet("health", "hydration60", "operator", "all")]
  [string]$Mode = "all",

  [ValidateRange(60, 600)]
  [int]$TimeoutSeconds = 180,

  [switch]$Strict
)

$ErrorActionPreference = "Stop"

$PlaywrightRoot = "F:\Playwright\fode-secure-link-diagnostic"
$ModeSpecs = [ordered]@{
  health = "specs/fode-legacy-admin-health.spec.ts"
  hydration60 = "specs/fode-admin-hydration60.spec.ts"
  operator = "specs/fode-admin-communication-smoke.spec.ts"
}

function Fail-Proof {
  param([string]$Message)
  Write-Host "FAIL: $Message" -ForegroundColor Red
  exit 1
}

function Get-NewReportFolders {
  param([datetime]$StartedAt)
  return @(Get-ChildItem -LiteralPath $ReportRoot -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -ge $StartedAt.AddSeconds(-2) } |
    Sort-Object LastWriteTime)
}

if (!(Test-Path -LiteralPath $PlaywrightRoot -PathType Container)) {
  Fail-Proof "F: Playwright folder not found: $PlaywrightRoot"
}
foreach ($required in @("package.json", "playwright.config.ts", "auth\admin-storage-state.json")) {
  $path = Join-Path $PlaywrightRoot $required
  if (!(Test-Path -LiteralPath $path -PathType Leaf)) {
    Fail-Proof "Required Playwright file missing: $path"
  }
}
if (!(Test-Path -LiteralPath $ReportRoot -PathType Container)) {
  New-Item -ItemType Directory -Path $ReportRoot | Out-Null
}

$selectedModes = if ($Mode -eq "all") { @("health", "hydration60", "operator") } else { @($Mode) }
foreach ($selectedMode in $selectedModes) {
  $spec = $ModeSpecs[$selectedMode]
  $specPath = Join-Path $PlaywrightRoot $spec
  if (!(Test-Path -LiteralPath $specPath -PathType Leaf)) {
    Fail-Proof "Required proof spec missing: $specPath"
  }
}

$env:FODE_ADMIN_URL = $AdminUrl
$env:FODE_EXPECTED_RUNTIME = $ExpectedRuntime
$env:FODE_EXPECTED_DEPLOY = [string]$ExpectedDeploy
$env:FODE_ACCEPT_HEAD = "false"
$env:FODE_REPORT_ROOT = $ReportRoot

Write-Host "FODE staging proof"
Write-Host "  URL: $AdminUrl"
Write-Host "  Expected: $ExpectedRuntime / $ExpectedDeploy"
Write-Host "  Mode: $Mode"
Write-Host "  Report root: $ReportRoot"
Write-Host "  Read-only: no deploy, repin, send, Sheet, or Drive mutation"

$startedAt = Get-Date
$originalLocation = Get-Location
try {
  Set-Location -LiteralPath $PlaywrightRoot
  foreach ($selectedMode in $selectedModes) {
    $spec = $ModeSpecs[$selectedMode]
    Write-Host "RUN: $selectedMode -> $spec"
    & npx.cmd playwright test $spec --project=chromium --timeout=("$($TimeoutSeconds * 1000)")
    if ($LASTEXITCODE -ne 0) {
      Fail-Proof "$selectedMode proof failed with exit code $LASTEXITCODE"
    }
  }
} finally {
  Set-Location -LiteralPath $originalLocation
}

$reportFolders = Get-NewReportFolders -StartedAt $startedAt
if ($reportFolders.Count -lt $selectedModes.Count) {
  Fail-Proof "Expected at least $($selectedModes.Count) new report folders; found $($reportFolders.Count)"
}

$summaries = @()
foreach ($folder in $reportFolders) {
  $summaryPath = Join-Path $folder.FullName "RUN_SUMMARY.md"
  if (!(Test-Path -LiteralPath $summaryPath -PathType Leaf)) { continue }
  $summary = Get-Content -LiteralPath $summaryPath -Raw
  $summaries += [pscustomobject]@{
    Path = $summaryPath
    Text = $summary
  }
  if ($summary -match "(?im)^- Status:\s*FAIL\b" -or $summary -match "(?im)^Result:\s*FAIL\b") {
    Fail-Proof "Report content records failure: $summaryPath"
  }
  if ($summary -match "Runtime:\s*loading" -or $summary -match "Runtime loading visible:\s*True") {
    Fail-Proof "Report records persistent runtime loading: $summaryPath"
  }
  if ($summary -match "Invalid or unexpected token") {
    Fail-Proof "Report records blocking client parse error: $summaryPath"
  }
  if ($Strict -and $summary -match "PASS_WITH_WARNINGS") {
    Fail-Proof "Strict mode rejects warnings: $summaryPath"
  }

  foreach ($jsonPath in @(Get-ChildItem -LiteralPath $folder.FullName -Filter "*.json" -File -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty FullName)) {
    $proof = Get-Content -LiteralPath $jsonPath -Raw | ConvertFrom-Json
    if ($null -ne $proof.runtimeVisible -and $proof.runtimeVisible -ne $true) {
      Fail-Proof "JSON proof records expected runtime as not visible: $jsonPath"
    }
    if ($null -ne $proof.buildVisible -and $proof.buildVisible -ne $true) {
      Fail-Proof "JSON proof records expected build as not visible: $jsonPath"
    }
    if ($proof.runtimeLoadingVisible -eq $true) {
      Fail-Proof "JSON proof records persistent runtime loading: $jsonPath"
    }
    if ($null -ne $proof.reviewButtonCount -and [int]$proof.reviewButtonCount -lt 1) {
      Fail-Proof "JSON proof records no Review buttons: $jsonPath"
    }
    if ($proof.invalidUnexpectedToken -eq $true) {
      Fail-Proof "JSON proof records Invalid or unexpected token: $jsonPath"
    }
  }
}
if ($summaries.Count -lt $selectedModes.Count) {
  Fail-Proof "Expected $($selectedModes.Count) RUN_SUMMARY files; found $($summaries.Count)"
}

Write-Host "PASS: FODE staging proof completed" -ForegroundColor Green
foreach ($summary in $summaries) {
  Write-Host "EVIDENCE: $($summary.Path)"
}
