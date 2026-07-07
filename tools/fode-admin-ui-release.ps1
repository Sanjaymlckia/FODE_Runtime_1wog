param(
  [Parameter(ValueFromRemainingArguments=$true)]
  [string[]]$RawArgs
)

$ErrorActionPreference = "Stop"
$script:VersionNumber = ""

$Help = $false
$CommitMessage = ""
$Files = @("AdminUI.html", "tests/admin-review-workspace-ux-surface.test.js", "tests/admin-ui-actionability-dashboard-surface.test.js")
$Markers = @()
$AbsentMarkers = @()
$VersionDescription = "Admin UI-only release"
$SkipCommit = $false
$DryRun = $false

for ($i = 0; $i -lt @($RawArgs).Count; $i++) {
  $arg = [string]$RawArgs[$i]
  switch ($arg) {
    "-Help" { $Help = $true }
    "-CommitMessage" { $i++; $CommitMessage = [string]$RawArgs[$i] }
    "-Files" {
      $Files = @()
      while ($i + 1 -lt @($RawArgs).Count -and -not ([string]$RawArgs[$i + 1]).StartsWith("-")) {
        $i++
        $Files += [string]$RawArgs[$i]
      }
    }
    "-Markers" {
      while ($i + 1 -lt @($RawArgs).Count -and -not ([string]$RawArgs[$i + 1]).StartsWith("-")) {
        $i++
        $Markers += [string]$RawArgs[$i]
      }
    }
    "-AbsentMarkers" {
      while ($i + 1 -lt @($RawArgs).Count -and -not ([string]$RawArgs[$i + 1]).StartsWith("-")) {
        $i++
        $AbsentMarkers += [string]$RawArgs[$i]
      }
    }
    "-VersionDescription" { $i++; $VersionDescription = [string]$RawArgs[$i] }
    "-SkipCommit" { $SkipCommit = $true }
    "-DryRun" { $DryRun = $true }
    default { throw "Unknown argument: $arg" }
  }
}

function Show-Help {
  Write-Host "FODE Admin UI-only release helper"
  Write-Host ""
  Write-Host "Usage:"
  Write-Host "  powershell -ExecutionPolicy Bypass -File tools\fode-admin-ui-release.ps1 -CommitMessage `"fix: visible admin ui change`" -VersionDescription `"Admin UI release`" -Markers `"Batch Communication`" `"Recipient count`" -AbsentMarkers `"Batch Communication Handoff`""
  Write-Host "  powershell -ExecutionPolicy Bypass -File tools\fode-admin-ui-release.ps1 -DryRun -SkipCommit -VersionDescription `"preflight dry run`" -Markers `"Batch Communication`" -AbsentMarkers `"Batch Communication Handoff`""
  Write-Host ""
  Write-Host "What it runs:"
  Write-Host "  validation, optional commit, git push, clasp push, Apps Script readback marker proof, one clasp version, Admin-only repin, whoami verifier, operator/surfaces smoke."
  Write-Host ""
  Write-Host "Safety:"
  Write-Host "  UI-only release does not require Config.js identity bump."
  Write-Host "  Remote proof markers are explicit per release; there are no feature-specific default markers."
  Write-Host "  Does not touch Student, Production, OPS, Sheets, Drive, Gmail/email, WhatsApp, or applicant data."
  Write-Host "  Fails before version creation if remote marker proof fails."
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

function Invoke-Step {
  param([string]$Name, [scriptblock]$Block)
  Write-Host "RUN: $Name"
  try {
    & $Block
  } catch {
    $code = if ($null -eq $LASTEXITCODE) { 0 } else { $LASTEXITCODE }
    if ($code -ne 0) { throw }
    Write-Warning $_
  }
  $code = if ($null -eq $LASTEXITCODE) { 0 } else { $LASTEXITCODE }
  if ($code -ne 0) { throw "$Name failed with exit code $code" }
  Write-Host "PASS: $Name" -ForegroundColor Green
}

function PassFail {
  param([bool]$Ok)
  if ($Ok) { return "PASS" }
  return "FAIL"
}

function Get-GitRemoteUrl {
  $remote = (& git remote get-url origin 2>$null)
  if ($LASTEXITCODE -ne 0 -or !$remote) { return "" }
  return [string]$remote
}

function Test-ClaspReachable {
  $output = & clasp.cmd status --json 2>$null
  if ($LASTEXITCODE -ne 0) { return "FAIL" }
  if (!$output) { return "unknown" }
  return "reachable"
}

function Write-ReleasePreflight {
  param(
    [string]$RepoRoot,
    [object]$Project,
    [bool]$DryRunValue
  )
  $expectedRepo = [System.IO.Path]::GetFullPath($Project.repository.path).TrimEnd("\")
  $actualRepo = [System.IO.Path]::GetFullPath($RepoRoot).TrimEnd("\")
  $repoOk = $expectedRepo -eq $actualRepo
  $branch = (& git branch --show-current 2>$null).Trim()
  $remoteUrl = Get-GitRemoteUrl
  $claspPath = Join-Path $RepoRoot ".clasp.json"
  $claspOk = $false
  if (Test-Path -LiteralPath $claspPath -PathType Leaf) {
    try {
      $scriptId = [string]((Get-Content -LiteralPath $claspPath -Raw | ConvertFrom-Json).scriptId)
      $claspOk = $scriptId -eq [string]$Project.appsScript.scriptId
    } catch {
      $claspOk = $false
    }
  }
  $requiredFiles = @(
    "tools\fode-admin-ui-release.ps1",
    "tools\fode-admin-ui-remote-markers.ps1",
    "tools\fode-preflight.ps1",
    "tools\fode-smoke.ps1",
    "tools\verify-runtime.ps1",
    "AdminUI.html"
  )
  $missingRequired = @($requiredFiles | Where-Object { !(Test-Path -LiteralPath (Join-Path $RepoRoot $_) -PathType Leaf) })
  $status = @(& git status --porcelain=v1)
  $treeState = if ($status.Count -eq 0) { "CLEAN" } else { "CHANGES" }
  $appsScriptState = if ($claspOk) { Test-ClaspReachable } else { "FAIL" }
  $remoteState = if ($remoteUrl) { $remoteUrl } else { "FAIL" }

  Write-Host "FODE Admin UI Release"
  Write-Host "====================="
  Write-Host ("Repository ........ " + (PassFail ($repoOk -and $missingRequired.Count -eq 0)))
  Write-Host ("Working tree ...... " + $treeState)
  Write-Host ("Current branch .... " + ($(if ($branch) { $branch } else { "FAIL" })))
  Write-Host ("Git remote ........ " + $remoteState)
  Write-Host ("clasp config ...... " + (PassFail $claspOk))
  Write-Host ("Apps Script ....... " + $appsScriptState)
  Write-Host "Target deployment . Admin Staging"
  Write-Host ("Dry run ........... " + ([string]$DryRunValue).ToLowerInvariant())
  Write-Host ""

  if (!$repoOk) { throw "Repository path mismatch: expected $expectedRepo got $actualRepo" }
  if (!$branch) { throw "Current branch could not be resolved." }
  if (!$remoteUrl) { throw "Git origin remote could not be resolved." }
  if (!$claspOk) { throw "clasp config missing or scriptId mismatch." }
  if ($appsScriptState -eq "FAIL") { throw "Apps Script status check failed." }
  if ($missingRequired.Count -gt 0) { throw "Required script files missing: $($missingRequired -join ', ')" }
}

if ($Help) {
  Show-Help
  exit 0
}

$Markers = Normalize-MarkerList -Values $Markers
$AbsentMarkers = Normalize-MarkerList -Values $AbsentMarkers
if ($Markers.Count -eq 0 -and $AbsentMarkers.Count -eq 0) {
  throw "At least one explicit -Markers or -AbsentMarkers value is required for Admin UI release proof."
}

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
Set-Location -LiteralPath $repoRoot
$context = Get-Content -LiteralPath (Join-Path $repoRoot "runtime-context.json") -Raw | ConvertFrom-Json
$project = $context.projects.FODE
$admin = $project.deployments.adminStaging
$student = $project.deployments.studentStaging
$adminDeployId = [string]$admin.deploymentId

Write-ReleasePreflight -RepoRoot $repoRoot -Project $project -DryRunValue ([bool]$DryRun)
Write-Host "No Student/Production/OPS/Sheet/Drive/Gmail/WhatsApp/applicant mutation."
Write-Host "Admin expected whoami: $($admin.expectedRuntime) / $($admin.expectedDeploy)"
Write-Host "Student expected whoami: $($student.expectedRuntime) / $($student.expectedDeploy)"

Invoke-Step "node --check Admin.js" { & node --check Admin.js }
Invoke-Step "node tests\admin-operator-scenario-contract.test.js" { & node tests\admin-operator-scenario-contract.test.js }
Invoke-Step "node tests\admin-ui-actionability-dashboard-surface.test.js" { & node tests\admin-ui-actionability-dashboard-surface.test.js }
Invoke-Step "node tests\admin-review-workspace-ux-surface.test.js" { & node tests\admin-review-workspace-ux-surface.test.js }
Invoke-Step "tools\fode-preflight.ps1" { & (Join-Path $PSScriptRoot "fode-preflight.ps1") }
Invoke-Step "tools\fode-smoke.ps1 -Profile operator" { & (Join-Path $PSScriptRoot "fode-smoke.ps1") -Profile operator }
Invoke-Step "tools\fode-smoke.ps1 -Profile surfaces" { & (Join-Path $PSScriptRoot "fode-smoke.ps1") -Profile surfaces }
Invoke-Step "git diff --check" { & git -c core.autocrlf=false diff --check }

Write-Host "Proof-readiness markers: $($Markers -join ', ')"
Write-Host "Proof-readiness absent markers: $($AbsentMarkers -join ', ')"

if ($DryRun) {
  Write-Host ""
  Write-Host "DRY RUN PASS" -ForegroundColor Green
  Write-Host "No git push, clasp push, Apps Script version, deployment repin, or data mutation performed."
  exit 0
}

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
