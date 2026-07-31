param(
  [ValidateSet("DocsOnly", "ClientOnly", "BackendSemantic", "HighRiskAuthority")]
  [string]$ReleaseClass = "DocsOnly",
  [string]$ExpectedHead = "",
  [string[]]$AllowedChangedFiles = @(),
  [string]$ExpectedAdminRuntime = "",
  [int]$ExpectedAdminDeploy = 0,
  [string]$ExpectedStudentRuntime = "",
  [int]$ExpectedStudentDeploy = 0,
  [ValidateSet("Auto", "Fast", "Full")]
  [string]$Gate = "Auto",
  [switch]$Production,
  [switch]$DependencyMappingIncomplete,
  [switch]$ScheduledFullValidation,
  [switch]$DryRun,
  [switch]$CommittedSourceRelease,
  [string]$AcceptedBaselineCommit = "",
  [switch]$MockRemote,
  [string]$EvidenceRoot = "docs\audits\releases",
  [string]$ManifestRoot = ".release-proof\admin-release"
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "FodeReleasePipeline.Core.ps1")

function Invoke-FodeCheckedCommand {
  param([string]$Name, [scriptblock]$Command)
  Write-Host "RUN: $Name"
  & $Command
  $code = if ($null -eq $LASTEXITCODE) { 0 } else { $LASTEXITCODE }
  if ($code -ne 0) { throw "$Name failed with exit code $code" }
  Write-Host "PASS: $Name" -ForegroundColor Green
}

function Get-FodeCommittedSourceInventory {
  param(
    [string]$ExpectedHead,
    [string]$AcceptedBaselineCommit
  )
  if (!$ExpectedHead -or !$AcceptedBaselineCommit) {
    throw "Committed-source mode requires ExpectedHead and AcceptedBaselineCommit"
  }
  $head = (& git rev-parse HEAD).Trim()
  if ($head -ne $ExpectedHead) { throw "Committed-source expected HEAD mismatch: $head" }
  if ((& git status --porcelain).Count -gt 0) { throw "Committed-source release requires a clean working tree and index" }
  $baseline = (& git rev-parse --verify "$AcceptedBaselineCommit^{commit}").Trim()
  if ($LASTEXITCODE -ne 0 -or !$baseline) { throw "Invalid accepted baseline commit: $AcceptedBaselineCommit" }
  & git merge-base --is-ancestor $baseline $head
  if ($LASTEXITCODE -ne 0) { throw "Accepted baseline is not an ancestor of expected HEAD" }
  $inventory = @( & git diff --name-only --diff-filter=ACMR "$baseline..$head" | ForEach-Object { $_.Trim() } | Where-Object { $_ } | Sort-Object -Unique )
  $blocked = @($inventory | Where-Object {
    $_ -match '(^|/)(\.env$|.*secret.*|.*password.*|.*\.zip$|.*\.sql\.gz$|build/|logs?/|backups?/|tests?/fixtures?/)' -or
    ($_ -match '\.sql$' -and $_ -notmatch '^services/communication-ledger/migrations/')
  })
  if ($blocked.Count -gt 0) { throw "Committed-source inventory contains protected/generated files: $($blocked -join ', ')" }
  if ($inventory.Count -eq 0) { throw "Committed-source release has an empty eligible release inventory" }
  return [pscustomobject]@{ Head = $head; Branch = (& git branch --show-current).Trim(); ChangedFiles = $inventory; AcceptedBaselineCommit = $baseline }
}

try {
  $project = Get-FodeContext
  $allowed = @($AllowedChangedFiles | ForEach-Object { $_ -split "," } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
  $baseline = Assert-FodeRepositoryPreflight -ExpectedRepo ([string]$project.repository.path) -ExpectedHead $ExpectedHead -AllowedChangedFiles $allowed
  $changed = @($baseline.ChangedFiles)
  if ($CommittedSourceRelease) {
    if ((& git branch --show-current).Trim() -ne "main") { throw "Committed-source release requires branch main" }
    if ((& git rev-parse origin/main).Trim() -ne $ExpectedHead) { throw "Committed-source HEAD is not equal to origin/main" }
    $counts = (& git rev-list --left-right --count HEAD...origin/main).Trim()
    if ($counts -notin @("0`t0", "0 0")) { throw "Committed-source release requires 0/0 ahead/behind" }
    $baseline = Get-FodeCommittedSourceInventory -ExpectedHead $ExpectedHead -AcceptedBaselineCommit $AcceptedBaselineCommit
    $changed = @($baseline.ChangedFiles)
    Write-Host "Committed-source inventory baseline: $($baseline.AcceptedBaselineCommit)"
    Write-Host "Committed-source inventory files: $($changed.Count)"
  }
  if ($changed.Count -eq 0) { throw "No release changes detected" }

  $classification = Get-FodeMinimumReleaseClass -Files $changed
  Write-Host "Detected minimum release class: $($classification.Class)" -ForegroundColor Cyan
  Assert-FodeReleaseClassAllowed -DetectedClass $classification.Class -RequestedClass $ReleaseClass

  $configIdentity = Get-FodeConfigIdentity
  if ($ExpectedAdminRuntime -and $ExpectedAdminRuntime -ne $configIdentity.Runtime) {
    throw "Expected Admin runtime $ExpectedAdminRuntime does not match local Config.js $($configIdentity.Runtime)"
  }
  if ($ExpectedAdminDeploy -gt 0 -and $ExpectedAdminDeploy -ne $configIdentity.Deploy) {
    throw "Expected Admin deploy $ExpectedAdminDeploy does not match local Config.js $($configIdentity.Deploy)"
  }
  if ($ExpectedStudentRuntime -and $ExpectedStudentRuntime -ne [string]$project.deployments.studentStaging.expectedRuntime) {
    throw "Expected Student runtime $ExpectedStudentRuntime does not match context $($project.deployments.studentStaging.expectedRuntime)"
  }
  if ($ExpectedStudentDeploy -gt 0 -and $ExpectedStudentDeploy -ne [int]$project.deployments.studentStaging.expectedDeploy) {
    throw "Expected Student deploy $ExpectedStudentDeploy does not match context $($project.deployments.studentStaging.expectedDeploy)"
  }

  $runtimeAfter = $configIdentity
  if ($ReleaseClass -ne "DocsOnly") {
    $runtimeAfter = Get-FodeNextRuntimeIdentity -CurrentRuntime $configIdentity.Runtime -CurrentDeploy $configIdentity.Deploy
  }

  if ($DryRun) {
    $testSelection = Get-FodeTestSelection -ReleaseClass $ReleaseClass -ChangedFiles $changed -RequestedGate $Gate -Production:$Production -DependencyMappingIncomplete:$DependencyMappingIncomplete -ScheduledFullValidation:$ScheduledFullValidation
    $manifest = New-FodeReleaseManifest -ReleaseClass $ReleaseClass -ChangedFiles $changed -Risks $classification.Risks -Baseline $baseline -RuntimeBefore $configIdentity -RuntimeAfter $runtimeAfter -TestSelection $testSelection -OutputRoot $ManifestRoot -PreviewOnly
    Assert-FodeDeploymentTarget -TargetDeploymentId ([string]$project.deployments.adminStaging.deploymentId) | Out-Null
    Write-Host "Admin target: $($project.deployments.adminStaging.deploymentId)"
    Write-Host "Student protected: $($project.deployments.studentStaging.deploymentId) @ $($project.deployments.studentStaging.expectedAppsScriptVersion)"
    Write-Host "Production: $($project.deployments.production.status)"
    Write-Host "Selected gate: $($testSelection.Gate)"
    Write-Host "Selected tests: $(@($testSelection.RequiredTestGroups) -join ', ')"
    Write-Host "Tests intentionally not run: $(@($testSelection.TestsIntentionallyNotRun) -join ', ')"
    Write-Host "Escalation reasons: $(@($testSelection.EscalationReasons) -join ', ')"
    Write-Host "Manifest: (dry-run preview only)"
    $preview = Write-FodeReleaseEvidence -Manifest $manifest -Verdict "DRY RUN - NO MUTATION" -OutputRoot $EvidenceRoot -PreviewOnly
    $text = ($preview | ConvertTo-Json -Depth 8)
    Assert-FodeNoSecrets -Text $text
    Write-Host "DRY RUN PASS" -ForegroundColor Green
    Write-Host "No Config.js edit, clasp push, Apps Script version, deployment repin, git stage, commit, push, or live-data mutation occurred."
    exit 0
  }

  if ($ReleaseClass -ne "DocsOnly") {
    Write-Host "Proposed runtime identity: $($runtimeAfter.Runtime) / $($runtimeAfter.Deploy)" -ForegroundColor Yellow
    Update-FodeConfigIdentity -Runtime $runtimeAfter.Runtime -Deploy $runtimeAfter.Deploy
    Invoke-FodeCheckedCommand "node --check Config.js" { & node --check Config.js }
    if ($CommittedSourceRelease) {
      $changed = @($changed + "Config.js" | Sort-Object -Unique)
    } else {
      $changed = @(Get-FodeChangedFiles)
    }
    $classification.Risks = @($classification.Risks + [pscustomobject]@{ File = "Config.js"; Class = $ReleaseClass; Reason = "runtime identity bump bound to $ReleaseClass release manifest" } | Sort-Object File -Unique)
  }

  $testSelection = Get-FodeTestSelection -ReleaseClass $ReleaseClass -ChangedFiles $changed -RequestedGate $Gate -Production:$Production -DependencyMappingIncomplete:$DependencyMappingIncomplete -ScheduledFullValidation:$ScheduledFullValidation
  $manifestResult = New-FodeReleaseManifest -ReleaseClass $ReleaseClass -ChangedFiles $changed -Risks $classification.Risks -Baseline $baseline -RuntimeBefore $configIdentity -RuntimeAfter $runtimeAfter -TestSelection $testSelection -OutputRoot $ManifestRoot
  $manifest = $manifestResult.Manifest
  $manifestPath = $manifestResult.Path

  Assert-FodeDeploymentTarget -TargetDeploymentId ([string]$project.deployments.adminStaging.deploymentId) | Out-Null
  Write-Host "Admin target: $($project.deployments.adminStaging.deploymentId)"
  Write-Host "Student protected: $($project.deployments.studentStaging.deploymentId) @ $($project.deployments.studentStaging.expectedAppsScriptVersion)"
  Write-Host "Production: $($project.deployments.production.status)"
  Write-Host "Selected gate: $($testSelection.Gate)"
  Write-Host "Selected tests: $(@($testSelection.RequiredTestGroups) -join ', ')"
  Write-Host "Tests intentionally not run: $(@($testSelection.TestsIntentionallyNotRun) -join ', ')"
  Write-Host "Escalation reasons: $(@($testSelection.EscalationReasons) -join ', ')"
  Write-Host "Manifest: $manifestPath"

  Invoke-FodeCheckedCommand "git diff --check" { & git diff --check }
  Invoke-FodeCheckedCommand "node tests\apps-script-deployable-file-contract.test.js" { & node tests\apps-script-deployable-file-contract.test.js }
  Invoke-FodeTestGate -TestSelection $testSelection -Mock:([bool]$MockRemote) | Out-Host

  if ($ReleaseClass -eq "DocsOnly") {
    $evidencePath = Write-FodeReleaseEvidence -Manifest $manifest -Verdict "PASS - DOCS ONLY, NO RUNTIME RELEASE" -OutputRoot $EvidenceRoot
    Write-Host "PASS - READY FOR OWNER ACCEPTANCE" -ForegroundColor Green
    Write-Host "Evidence: $evidencePath"
    Write-Host "Not committed or pushed - awaiting final owner acceptance"
    exit 0
  }

  if ($MockRemote) {
    Write-Host "MOCK REMOTE: clasp push, repeated remote Config readback, Apps Script version and Admin repin were simulated."
  } else {
    Invoke-FodeCheckedCommand "clasp push" { & clasp.cmd push }
    Invoke-FodeCheckedCommand "remote Config readback 1" { & (Join-Path $PSScriptRoot "verify-remote-config-before-version.ps1") }
    Invoke-FodeCheckedCommand "remote Config readback 2" { & (Join-Path $PSScriptRoot "verify-remote-config-before-version.ps1") }
    Assert-FodeVersionCreationAllowed -Manifest $manifest | Out-Null
    $versionOutput = & clasp.cmd version "FODE Admin release $($manifest.releaseIdentifier)"
    $versionOutput | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE -ne 0) { throw "clasp version failed with exit code $LASTEXITCODE" }
    $match = [regex]::Match(($versionOutput -join "`n"), 'Created version\s+(\d+)')
    if (!$match.Success) { throw "Could not parse Apps Script version" }
    $appsScriptVersion = [int]$match.Groups[1].Value
    Invoke-FodeCheckedCommand "Admin staging repin" {
      & clasp.cmd deploy --deploymentId ([string]$project.deployments.adminStaging.deploymentId) --versionNumber $appsScriptVersion --description "FODE Admin release $($manifest.releaseIdentifier)"
    }
    Invoke-FodeCheckedCommand "runtime verifier" {
      & (Join-Path $PSScriptRoot "verify-runtime.ps1") -AdminExpectedRuntime $runtimeAfter.Runtime -AdminExpectedDeploy $runtimeAfter.Deploy -StudentExpectedRuntime ([string]$project.deployments.studentStaging.expectedRuntime) -StudentExpectedDeploy ([int]$project.deployments.studentStaging.expectedDeploy)
    }
  }

  $evidence = Write-FodeReleaseEvidence -Manifest $manifest -Verdict "PASS - ADMIN STAGING VERIFIED" -OutputRoot $EvidenceRoot
  Write-Host "PASS - READY FOR OWNER ACCEPTANCE" -ForegroundColor Green
  Write-Host "Evidence: $evidence"
  Write-Host "Not committed or pushed - awaiting final owner acceptance"
  exit 0
} catch {
  Write-Host "FAIL: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "FAILED STATE: not committed; inspect whether local identity changed before retry."
  exit 1
}
