param(
  [switch]$Help,
  [string]$CommitMessage = "",
  [string[]]$Files = @("AdminUI.html", "tests/admin-review-workspace-ux-surface.test.js", "tests/admin-ui-actionability-dashboard-surface.test.js"),
  [string[]]$Markers = @("openModalLoading_", "setReviewHeaderLoading_", "clearReviewHeaderFacts_", "resetReviewModalScroll_", "reviewOwnerDisplayLabel_", "reviewLoadingBanner", "reviewHeaderGrid loading", "docStatus", "docComment", "docRecommendation"),
  [string[]]$AbsentMarkers = @("not_in_loaded_review_queue"),
  [string]$VersionDescription = "Admin UI-only release",
  [switch]$SkipCommit
)

$ErrorActionPreference = "Stop"
$script:VersionNumber = ""

function Show-Help {
  Write-Host "FODE Admin UI-only release helper"
  Write-Host ""
  Write-Host "Usage:"
  Write-Host "  powershell -ExecutionPolicy Bypass -File tools\fode-admin-ui-release.ps1 -CommitMessage `"fix: stabilise review modal identity and document controls`" -VersionDescription `"Admin UI modal stabilisation`""
  Write-Host ""
  Write-Host "What it runs:"
  Write-Host "  validation, optional commit, git push, clasp push, Apps Script readback marker proof, one clasp version, Admin-only repin, whoami verifier, operator/surfaces smoke."
  Write-Host ""
  Write-Host "Safety:"
  Write-Host "  UI-only release does not require Config.js identity bump."
  Write-Host "  Does not touch Student, Production, OPS, Sheets, Drive, Gmail/email, WhatsApp, or applicant data."
  Write-Host "  Fails before version creation if remote marker proof fails."
}

function Invoke-Step {
  param([string]$Name, [scriptblock]$Block)
  Write-Host "RUN: $Name"
  & $Block
  $code = if ($null -eq $LASTEXITCODE) { 0 } else { $LASTEXITCODE }
  if ($code -ne 0) { throw "$Name failed with exit code $code" }
  Write-Host "PASS: $Name" -ForegroundColor Green
}

if ($Help) {
  Show-Help
  exit 0
}

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
Set-Location -LiteralPath $repoRoot
$context = Get-Content -LiteralPath (Join-Path $repoRoot "runtime-context.json") -Raw | ConvertFrom-Json
$project = $context.projects.FODE
$admin = $project.deployments.adminStaging
$student = $project.deployments.studentStaging
$adminDeployId = [string]$admin.deploymentId

Write-Host "FODE Admin UI-only release"
Write-Host "Repo: $repoRoot"
Write-Host "Admin deployment: $adminDeployId"
Write-Host "Student protected: $($student.deploymentId)"
Write-Host "No Student/Production/OPS/Sheet/Drive/Gmail/WhatsApp/applicant mutation."

Invoke-Step "node --check Admin.js" { & node --check Admin.js }
Invoke-Step "node tests\admin-operator-scenario-contract.test.js" { & node tests\admin-operator-scenario-contract.test.js }
Invoke-Step "node tests\admin-ui-actionability-dashboard-surface.test.js" { & node tests\admin-ui-actionability-dashboard-surface.test.js }
Invoke-Step "node tests\admin-review-workspace-ux-surface.test.js" { & node tests\admin-review-workspace-ux-surface.test.js }
Invoke-Step "tools\fode-preflight.ps1" { & (Join-Path $PSScriptRoot "fode-preflight.ps1") }
Invoke-Step "tools\fode-smoke.ps1 -Profile operator" { & (Join-Path $PSScriptRoot "fode-smoke.ps1") -Profile operator }
Invoke-Step "tools\fode-smoke.ps1 -Profile surfaces" { & (Join-Path $PSScriptRoot "fode-smoke.ps1") -Profile surfaces }
Invoke-Step "git diff --check" { & git diff --check }

if (!$SkipCommit) {
  if (!$CommitMessage) { throw "CommitMessage is required unless -SkipCommit is used." }
  Invoke-Step "git add UI release files" { & git add @Files }
  Invoke-Step "git diff --cached --check" { & git diff --cached --check }
  $staged = @(& git diff --cached --name-only)
  if ($staged.Count -eq 0) {
    Write-Host "No staged changes; skipping commit."
  } else {
    Invoke-Step "git commit" { & git commit -m $CommitMessage }
  }
}

Invoke-Step "git push origin main" { & git push origin main }
Invoke-Step "clasp push" { & clasp.cmd push }
Invoke-Step "remote marker proof" {
  & (Join-Path $PSScriptRoot "fode-admin-ui-remote-markers.ps1") -Markers $Markers -AbsentMarkers $AbsentMarkers
}

Invoke-Step "clasp version" {
  $output = & clasp.cmd version $VersionDescription
  $output | ForEach-Object { Write-Host $_ }
  $text = ($output -join "`n")
  $match = [regex]::Match($text, 'Created version\s+(\d+)')
  if (!$match.Success) { throw "Could not parse Apps Script version from clasp output." }
  $script:VersionNumber = $match.Groups[1].Value
}

Invoke-Step "Admin staging repin" {
  & clasp.cmd deploy --deploymentId $adminDeployId --versionNumber ([int]$script:VersionNumber) --description $VersionDescription
}

Invoke-Step "runtime verifier" {
  & (Join-Path $PSScriptRoot "verify-runtime.ps1") `
    -AdminExpectedRuntime ([string]$admin.expectedRuntime) `
    -AdminExpectedDeploy ([int]$admin.expectedDeploy) `
    -StudentExpectedRuntime ([string]$student.expectedRuntime) `
    -StudentExpectedDeploy ([int]$student.expectedDeploy)
}
Invoke-Step "operator smoke" { & (Join-Path $PSScriptRoot "fode-smoke.ps1") -Profile operator }
Invoke-Step "surfaces smoke" { & (Join-Path $PSScriptRoot "fode-smoke.ps1") -Profile surfaces }

$head = (& git rev-parse --short HEAD).Trim()
$deployments = @(& clasp.cmd deployments)
$adminLine = $deployments | Where-Object { $_ -match [regex]::Escape($adminDeployId) } | Select-Object -First 1

Write-Host ""
Write-Host "ADMIN UI RELEASE SUMMARY" -ForegroundColor Green
Write-Host "Commit: $head"
Write-Host "Apps Script version: $script:VersionNumber"
Write-Host "Admin deployment pin: $adminLine"
Write-Host "Admin whoami expected: $($admin.expectedRuntime) / $($admin.expectedDeploy)"
Write-Host "Student whoami expected: $($student.expectedRuntime) / $($student.expectedDeploy)"
Write-Host "Scope: Admin staging only; no Student/Production/OPS/Sheet/Drive/Gmail/WhatsApp/applicant mutation."
exit 0
