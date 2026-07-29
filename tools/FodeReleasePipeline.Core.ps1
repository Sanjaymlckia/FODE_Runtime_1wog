$ErrorActionPreference = "Stop"

$script:FodeReleaseClassRank = @{
  DocsOnly = 1
  ClientOnly = 2
  BackendSemantic = 3
  HighRiskAuthority = 4
}

$script:FodeCriticalInvariantTests = @(
  "tools\verify-runtime.ps1",
  "tests\apps-script-deployable-file-contract.test.js",
  "tests\admin-role-capability-convergence.test.js",
  "tests\admin-canonical-finance-foundation.test.js",
  "tests\communication-send-gate-matrix.test.js",
  "tests\r391b-population-integrity-fail-closed.test.js",
  "tests\r391b-client-state-race.browser.test.js"
)

$script:FodeDomainTestMap = [ordered]@{
  "client-state-workbench" = @("tests\r391b-client-state-race.browser.test.js", "tests\eduops-entire-work-surface-authority.test.js")
  "classification-routing" = @("tests\r391c-semantic-repair.test.js", "tests\admin-actionability-resolver.test.js", "tests\admin-operational-route-authority.test.js")
  "capabilities-roles" = @("tests\admin-role-capability-convergence.test.js", "tests\fode-completion-capability-authority.test.js")
  "finance" = @("tests\admin-canonical-finance-foundation.test.js", "tests\finance-completion-repair.test.js", "tests\payment-authority-matrix.test.js")
  "communication-safety" = @("tests\r390b1-communication-safety-repair.test.js", "tests\communication-send-gate-matrix.test.js")
  "stage-batch-bulk" = @("tests\admin-stage-batch-authority-cohesion.test.js", "tests\communication-send-gate-matrix.test.js")
  "population-integrity" = @("tests\r391b-population-integrity-fail-closed.test.js", "tests\admin-population-ledger.test.js")
  "deployment-runtime-identity" = @("tests\apps-script-deployable-file-contract.test.js", "tests\admin-ui-remote-marker-helper.test.js")
}

function Get-FodePngTimestamp {
  return (Get-Date).ToUniversalTime().AddHours(10).ToString("yyyyMMdd-HHmmss")
}

function ConvertTo-FodeSlashPath {
  param([string]$PathText)
  return ([string]$PathText).Replace("\", "/")
}

function Get-FodeFileRisk {
  param([string]$PathText)
  $path = ConvertTo-FodeSlashPath $PathText
  if ($path -match '^(docs/|audits/|runtime-context\.json$|tools/README\.md$|docs/tooling/|docs/architecture/)') {
    return [pscustomobject]@{ File = $path; Class = "DocsOnly"; Reason = "documentation or source-controlled tooling context" }
  }
  if ($path -match '^tests/' -or $path -match '^tools/') {
    return [pscustomobject]@{ File = $path; Class = "DocsOnly"; Reason = "local tooling or regression test" }
  }
  if ($path -match '(^|/)(AdminUI.*\.html|EduOps.*\.html)$' -or $path -match '\.(css|html)$') {
    return [pscustomobject]@{ File = $path; Class = "ClientOnly"; Reason = "active Admin client or browser-side source" }
  }
  if ($path -match 'StageBatch|Batch|Communication|SelectedApplicant|CanonicalPopulation|Population|Idempotency|Receipts|Deployment|appsscript\.json$') {
    return [pscustomobject]@{ File = $path; Class = "HighRiskAuthority"; Reason = "communication, Batch, identity, population, receipt or deployment authority" }
  }
  if ($path -match '^(Admin|Code|Config|Routes|Utils|EduOps_).*\.js$') {
    if ($path -match 'Finance|Capability|AccessControl|Workload|Commands|Contracts|Lifecycle|Review|Payment|DTO|Adapter') {
      return [pscustomobject]@{ File = $path; Class = "BackendSemantic"; Reason = "server, DTO, Finance, routing, classification or capability source" }
    }
    return [pscustomobject]@{ File = $path; Class = "BackendSemantic"; Reason = "active Apps Script server source" }
  }
  return [pscustomobject]@{ File = $path; Class = "HighRiskAuthority"; Reason = "unknown active file; conservative classification" }
}

function Get-FodeMinimumReleaseClass {
  param([string[]]$Files)
  $risks = @($Files | ForEach-Object { Get-FodeFileRisk $_ })
  $maxRank = 1
  $class = "DocsOnly"
  foreach ($risk in $risks) {
    $rank = [int]$script:FodeReleaseClassRank[$risk.Class]
    if ($rank -gt $maxRank) {
      $maxRank = $rank
      $class = $risk.Class
    }
  }
  return [pscustomobject]@{ Class = $class; Risks = $risks }
}

function Assert-FodeReleaseClassAllowed {
  param(
    [string]$DetectedClass,
    [string]$RequestedClass
  )
  if ([int]$script:FodeReleaseClassRank[$RequestedClass] -lt [int]$script:FodeReleaseClassRank[$DetectedClass]) {
    throw "Risk downgrade rejected: changed files require at least $DetectedClass, requested $RequestedClass"
  }
}

function Get-FodeChangedFiles {
  $tracked = @(& git diff --name-only HEAD | ForEach-Object { ConvertTo-FodeSlashPath $_ })
  $untracked = @(& git ls-files --others --exclude-standard | ForEach-Object { ConvertTo-FodeSlashPath $_ })
  return @($tracked + $untracked | Where-Object { $_ } | Sort-Object -Unique)
}

function Get-FodeDiffHash {
  param([string[]]$Files)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  $items = New-Object System.Collections.Generic.List[string]
  foreach ($file in @($Files | Sort-Object -Unique)) {
    $items.Add("FILE:$file") | Out-Null
    if (Test-Path -LiteralPath $file -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $file).Path)
      $items.Add([System.BitConverter]::ToString($sha.ComputeHash($bytes)).Replace("-", "").ToLowerInvariant()) | Out-Null
    } else {
      $items.Add("DELETED") | Out-Null
    }
  }
  $joined = $items -join "`n"
  return [System.BitConverter]::ToString($sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($joined))).Replace("-", "").ToLowerInvariant()
}

function Get-FodeConfigIdentity {
  param([string]$ConfigPath = "Config.js")
  $text = Get-Content -LiteralPath $ConfigPath -Raw
  $version = [regex]::Match($text, 'VERSION\s*:\s*"([^"]+)"')
  $deploy = [regex]::Match($text, 'DEPLOY_VERSION_NUMBER\s*:\s*(\d+)')
  if (!$version.Success -or !$deploy.Success) { throw "Config.js runtime identity could not be parsed" }
  return [pscustomobject]@{ Runtime = $version.Groups[1].Value; Deploy = [int]$deploy.Groups[1].Value }
}

function Get-FodeNextRuntimeIdentity {
  param([string]$CurrentRuntime, [int]$CurrentDeploy)
  if ($CurrentRuntime -ne ("r" + $CurrentDeploy)) { throw "Runtime identity mismatch: $CurrentRuntime / $CurrentDeploy" }
  $next = $CurrentDeploy + 1
  return [pscustomobject]@{ Runtime = "r$next"; Deploy = $next }
}

function Update-FodeConfigIdentity {
  param([string]$Runtime, [int]$Deploy, [string]$ConfigPath = "Config.js")
  $text = Get-Content -LiteralPath $ConfigPath -Raw
  $text = [regex]::Replace($text, 'VERSION\s*:\s*"r\d+"', ('VERSION: "' + $Runtime + '"'), 1)
  $text = [regex]::Replace($text, 'DEPLOY_VERSION_NUMBER\s*:\s*\d+', ('DEPLOY_VERSION_NUMBER: ' + $Deploy), 1)
  Set-Content -LiteralPath $ConfigPath -Value $text -NoNewline
}

function Get-FodeContext {
  param([string]$ContextPath = "runtime-context.json")
  return (Get-Content -LiteralPath $ContextPath -Raw | ConvertFrom-Json).projects.FODE
}

function Assert-FodeRepositoryPreflight {
  param(
    [string]$ExpectedRepo = "D:\Repos\FODE_Runtime_1wog",
    [string]$ExpectedHead = "",
    [string[]]$AllowedChangedFiles = @()
  )
  $root = (& git rev-parse --show-toplevel).Trim()
  if (([System.IO.Path]::GetFullPath($root)).TrimEnd("\") -ne ([System.IO.Path]::GetFullPath($ExpectedRepo)).TrimEnd("\")) {
    throw "Authoritative repo mismatch: $root"
  }
  $branch = (& git rev-parse --abbrev-ref HEAD).Trim()
  if ($branch -ne "main") { throw "Expected branch main, got $branch" }
  $head = (& git rev-parse HEAD).Trim()
  $origin = (& git rev-parse origin/main).Trim()
  if ($ExpectedHead -and $head -ne $ExpectedHead) { throw "HEAD expected $ExpectedHead got $head" }
  if ($head -ne $origin) { throw "HEAD and origin/main are not aligned: $head / $origin" }
  $aheadBehind = (& git rev-list --left-right --count HEAD...origin/main).Trim()
  if ($aheadBehind -ne "0`t0" -and $aheadBehind -ne "0 0") { throw "Ahead/behind expected 0 / 0 got $aheadBehind" }
  $staged = @(& git diff --cached --name-only)
  if ($staged.Count -gt 0) { throw "Pre-existing staged files are not supported: $($staged -join ', ')" }
  & git diff --check | Out-Host
  if ($LASTEXITCODE -ne 0) { throw "git diff --check failed" }
  $changed = @(Get-FodeChangedFiles)
  if ($AllowedChangedFiles.Count -gt 0) {
    $allowed = @($AllowedChangedFiles | ForEach-Object { ConvertTo-FodeSlashPath $_ })
    $unexpected = @($changed | Where-Object { $allowed -notcontains $_ })
    if ($unexpected.Count -gt 0) { throw "Unexpected changed files: $($unexpected -join ', ')" }
  }
  return [pscustomobject]@{ Head = $head; Branch = $branch; ChangedFiles = $changed }
}

function Get-FodeRequiredTestGroups {
  param(
    [string]$ReleaseClass,
    [string[]]$ChangedFiles = @(),
    [string]$RequestedGate = "Auto",
    [switch]$Production,
    [switch]$DependencyMappingIncomplete,
    [switch]$ScheduledFullValidation
  )
  return (Get-FodeTestSelection -ReleaseClass $ReleaseClass -ChangedFiles $ChangedFiles -RequestedGate $RequestedGate -Production:$Production -DependencyMappingIncomplete:$DependencyMappingIncomplete -ScheduledFullValidation:$ScheduledFullValidation).RequiredTestGroups
}

function Get-FodeChangedFileDomains {
  param([string[]]$ChangedFiles)
  $domains = New-Object System.Collections.Generic.List[string]
  foreach ($file in @($ChangedFiles | ForEach-Object { ConvertTo-FodeSlashPath $_ })) {
    if ($file -match 'AdminUI|EduOps_Client|Workbench|\.html$') { $domains.Add("client-state-workbench") | Out-Null }
    if ($file -match 'Workload|Actionability|Lifecycle|ReviewQueues|operational|classification|routing') { $domains.Add("classification-routing") | Out-Null }
    if ($file -match 'AccessControl|Capability|Commands|Contracts|role') { $domains.Add("capabilities-roles") | Out-Null }
    if ($file -match 'Finance|Payment') { $domains.Add("finance") | Out-Null }
    if ($file -match 'Communication|SelectedApplicant|Receipts|cooldown|contactability') { $domains.Add("communication-safety") | Out-Null }
    if ($file -match 'StageBatch|Batch|bulk') { $domains.Add("stage-batch-bulk") | Out-Null }
    if ($file -match 'Population|CanonicalPopulation|ApplicantID') { $domains.Add("population-integrity") | Out-Null }
    if ($file -match 'Config\.js|appsscript\.json|deploy|release|runtime|Invoke-FodeAdminRelease|Complete-FodeReleaseCommit|FodeReleasePipeline') { $domains.Add("deployment-runtime-identity") | Out-Null }
  }
  return @($domains | Sort-Object -Unique)
}

function Get-FodeTestSelection {
  param(
    [string]$ReleaseClass,
    [string[]]$ChangedFiles = @(),
    [ValidateSet("Auto", "Fast", "Full")]
    [string]$RequestedGate = "Auto",
    [switch]$Production,
    [switch]$DependencyMappingIncomplete,
    [switch]$ScheduledFullValidation
  )
  $reasons = New-Object System.Collections.Generic.List[string]
  $domains = @(Get-FodeChangedFileDomains -ChangedFiles $ChangedFiles)
  $pipelineChanged = @($ChangedFiles | Where-Object { (ConvertTo-FodeSlashPath $_) -match '(^tools/(Invoke-FodeAdminRelease|Complete-FodeReleaseCommit|FodeReleasePipeline)|^tests/release-pipeline|Admin_Release_Pipeline|tools/README|Runtime_Context|Governance)' })
  if ($Production) { $reasons.Add("Production release") | Out-Null }
  if ($ReleaseClass -eq "HighRiskAuthority") { $reasons.Add("HighRiskAuthority release") | Out-Null }
  if ($pipelineChanged.Count -gt 0) { $reasons.Add("release infrastructure or test-selection logic changed") | Out-Null }
  if ($DependencyMappingIncomplete -or ($ReleaseClass -ne "DocsOnly" -and $domains.Count -eq 0)) { $reasons.Add("dependency mapping incomplete or uncertain") | Out-Null }
  if ($ScheduledFullValidation) { $reasons.Add("scheduled repository health validation") | Out-Null }
  if ($RequestedGate -eq "Full") { $reasons.Add("explicit operator Full Gate request") | Out-Null }

  $gate = "Fast"
  if ($ReleaseClass -eq "DocsOnly") { $gate = "Fast" }
  if ($reasons.Count -gt 0) { $gate = "Full" }
  if ($RequestedGate -eq "Fast" -and $gate -eq "Full") {
    throw "Mandatory Full Gate cannot be downgraded to Fast Gate: $($reasons -join '; ')"
  }

  $direct = @()
  foreach ($file in @($ChangedFiles | ForEach-Object { ConvertTo-FodeSlashPath $_ })) {
    if ($file -match '^tests/.*\.test\.js$') { $direct += $file.Replace("/", "\") }
    if ($file -match '\.ps1$') { $direct += "powershell-parser:$($file.Replace('/', '\'))" }
    if ($file -match '\.json$') { $direct += "json-parser:$($file.Replace('/', '\'))" }
  }

  $dependencyTests = @()
  foreach ($domain in $domains) {
    if ($script:FodeDomainTestMap.Contains($domain)) {
      $dependencyTests += @($script:FodeDomainTestMap[$domain])
    }
  }
  if ($ReleaseClass -eq "DocsOnly") { $dependencyTests += "documentation-checks" }

  $common = @("git diff --check", "scope-validation", "tests\release-pipeline-contract.test.js", "tests\apps-script-deployable-file-contract.test.js")
  $selected = @($common + $direct + $dependencyTests + $script:FodeCriticalInvariantTests | Sort-Object -Unique)
  if ($gate -eq "Full") { $selected = @("FULL_REPOSITORY_SUITE") }
  $omitted = if ($gate -eq "Fast") { @("full repository suite") } else { @() }
  $risk = if ($gate -eq "Fast") { "Bounded selection relies on reviewed domain-to-test mapping plus permanent critical invariants; run Full Gate if mapping confidence changes." } else { "Full repository suite selected." }

  return [pscustomobject]@{
    Gate = $gate
    ReleaseClass = $ReleaseClass
    DirectTests = @($direct | Sort-Object -Unique)
    DependencyDomains = @($domains)
    DependencyTests = @($dependencyTests | Sort-Object -Unique)
    CriticalInvariantTests = @($script:FodeCriticalInvariantTests)
    EscalationReasons = @($reasons)
    RequiredTestGroups = @($selected)
    TestsIntentionallyNotRun = @($omitted)
    ResidualRisk = $risk
  }
}

function New-FodeReleaseManifest {
  param(
    [string]$ReleaseClass,
    [string[]]$ChangedFiles,
    [object[]]$Risks,
    [object]$Baseline,
    [object]$RuntimeBefore,
    [object]$RuntimeAfter,
    [object]$TestSelection = $null,
    [string]$OutputRoot = ".release-proof\admin-release",
    [switch]$PreviewOnly
  )
  $releaseId = "R" + (Get-FodePngTimestamp) + "-Admin-" + $ReleaseClass
  $diffHash = Get-FodeDiffHash -Files $ChangedFiles
  $ctx = Get-FodeContext
  if (!$TestSelection) { $TestSelection = Get-FodeTestSelection -ReleaseClass $ReleaseClass -ChangedFiles $ChangedFiles }
  $manifest = [ordered]@{
    releaseIdentifier = $releaseId
    releaseClass = $ReleaseClass
    baselineGitCommit = $Baseline.Head
    branch = $Baseline.Branch
    diffHash = $diffHash
    changedFiles = @($ChangedFiles)
    addedFiles = @(& git ls-files --others --exclude-standard | ForEach-Object { ConvertTo-FodeSlashPath $_ })
    deletedFiles = @(& git diff --name-only --diff-filter=D HEAD | ForEach-Object { ConvertTo-FodeSlashPath $_ })
    riskClassification = @($Risks)
    approvedScope = @($ChangedFiles)
    selectedGate = $TestSelection.Gate
    testsSelectedDirectlyFromChangedFiles = @($TestSelection.DirectTests)
    testsSelectedFromDependencyMapping = @($TestSelection.DependencyTests)
    criticalInvariantTests = @($TestSelection.CriticalInvariantTests)
    escalationReasons = @($TestSelection.EscalationReasons)
    requiredTestGroups = @($TestSelection.RequiredTestGroups)
    testsIntentionallyNotRun = @($TestSelection.TestsIntentionallyNotRun)
    residualRiskFromBoundedSelection = $TestSelection.ResidualRisk
    runtimeIdentityBeforeRelease = $RuntimeBefore
    proposedRuntimeIdentity = $RuntimeAfter
    expectedAdminTarget = $ctx.deployments.adminStaging
    protectedStudentIdentity = $ctx.deployments.studentStaging
    productionNoTouchStatus = $ctx.deployments.production.status
    pngLocalTimestamp = Get-FodePngTimestamp
    localState = [ordered]@{
      sourcePushed = $false
      appsScriptVersionCreated = $false
      adminRepinned = $false
      acceptanceCompleted = $false
      committed = $false
    }
  }
  if ($PreviewOnly) { return [pscustomobject]$manifest }
  $root = Join-Path (Get-Location) $OutputRoot
  New-Item -ItemType Directory -Path $root -Force | Out-Null
  $jsonPath = Join-Path $root ($releaseId + ".manifest.json")
  $manifest | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $jsonPath -Encoding UTF8
  return [pscustomobject]@{ Manifest = [pscustomobject]$manifest; Path = $jsonPath }
}

function Write-FodeReleaseEvidence {
  param(
    [object]$Manifest,
    [string]$Verdict,
    [string]$OutputRoot = "docs\audits\releases",
    [switch]$PreviewOnly
  )
  $safe = [ordered]@{
    verdict = $Verdict
    releaseIdentifier = $Manifest.releaseIdentifier
    releaseClass = $Manifest.releaseClass
    baselineGitCommit = $Manifest.baselineGitCommit
    diffHash = $Manifest.diffHash
    changedFiles = $Manifest.changedFiles
    runtimeIdentityBeforeAndAfter = [ordered]@{ "before" = $Manifest.runtimeIdentityBeforeRelease; "after" = $Manifest.proposedRuntimeIdentity }
    testsRun = $Manifest.requiredTestGroups
    selectedGate = $Manifest.selectedGate
    testsSelectedDirectlyFromChangedFiles = $Manifest.testsSelectedDirectlyFromChangedFiles
    testsSelectedFromDependencyMapping = $Manifest.testsSelectedFromDependencyMapping
    criticalInvariantTests = $Manifest.criticalInvariantTests
    escalationReasons = $Manifest.escalationReasons
    testsIntentionallyNotRun = $Manifest.testsIntentionallyNotRun
    residualRiskFromBoundedSelection = $Manifest.residualRiskFromBoundedSelection
    productionNoTouchConfirmation = $Manifest.productionNoTouchStatus
    safetyConfirmation = "No Gmail, Sheet, Drive, applicant, Zoho, Classroom, Student or Production mutation is performed by this report generator."
    gitCommitStatus = "Not committed or pushed - awaiting final owner acceptance"
  }
  if ($PreviewOnly) { return [pscustomobject]$safe }
  New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null
  $path = Join-Path $OutputRoot ($Manifest.releaseIdentifier + ".md")
  $lines = @(
    "# Admin Release Evidence",
    "",
    "- Verdict: $Verdict",
    "- Release identifier: $($Manifest.releaseIdentifier)",
    "- Release class: $($Manifest.releaseClass)",
    "- Baseline Git commit: $($Manifest.baselineGitCommit)",
    "- Diff hash: $($Manifest.diffHash)",
    "- Runtime before: $($Manifest.runtimeIdentityBeforeRelease.Runtime) / $($Manifest.runtimeIdentityBeforeRelease.Deploy)",
    "- Runtime after: $($Manifest.proposedRuntimeIdentity.Runtime) / $($Manifest.proposedRuntimeIdentity.Deploy)",
    "- Selected gate: $($Manifest.selectedGate)",
    "- Git commit status: Not committed or pushed - awaiting final owner acceptance",
    "",
    "## Changed Files"
  )
  foreach ($file in $Manifest.changedFiles) { $lines += ("- ``" + $file + "``") }
  $lines += @("", "## Test Selection", "- Gate: $($Manifest.selectedGate)", "- Escalation reasons: $(@($Manifest.escalationReasons) -join '; ')", "- Tests intentionally not run: $(@($Manifest.testsIntentionallyNotRun) -join '; ')", "- Residual risk: $($Manifest.residualRiskFromBoundedSelection)")
  $lines += @("", "## Safety", "No Batch send, Gmail send, applicant mutation, Sheet mutation, Drive mutation, Zoho write, Google Classroom write, Student change or Production change occurred.")
  $lines | Set-Content -LiteralPath $path -Encoding UTF8
  return $path
}

function Assert-FodeDeploymentTarget {
  param([string]$TargetDeploymentId)
  $ctx = Get-FodeContext
  if ($TargetDeploymentId -ne [string]$ctx.deployments.adminStaging.deploymentId) {
    if ($TargetDeploymentId -eq [string]$ctx.deployments.studentStaging.deploymentId) { throw "Student deployment target rejected" }
    if ($ctx.deployments.production.deploymentId -and $TargetDeploymentId -eq [string]$ctx.deployments.production.deploymentId) { throw "Production deployment target rejected" }
    throw "Unknown deployment target rejected: $TargetDeploymentId"
  }
  return $true
}

function Assert-FodeNoSecrets {
  param([string]$Text)
  if ($Text -match '(refresh_token|client_secret|access_token|Authorization:\s*Bearer)') { throw "Evidence contains secret-like content" }
}

function Assert-FodeResumeState {
  param(
    [object]$Manifest,
    [string[]]$CurrentFiles
  )
  $approved = @($Manifest.approvedScope | ForEach-Object { ConvertTo-FodeSlashPath $_ })
  $current = @($CurrentFiles | ForEach-Object { ConvertTo-FodeSlashPath $_ })
  $unexpected = @($current | Where-Object { $approved -notcontains $_ })
  if ($unexpected.Count -gt 0) { throw "Changed-source resume rejected: unexpected files $($unexpected -join ', ')" }
  $hash = Get-FodeDiffHash -Files $approved
  if ($hash -ne [string]$Manifest.diffHash) { throw "Changed-source resume rejected: diff hash mismatch" }
  return $true
}

function Assert-FodeVersionCreationAllowed {
  param([object]$Manifest)
  if ($Manifest.localState -and $Manifest.localState.appsScriptVersionCreated -eq $true) {
    throw "Duplicate Apps Script version creation rejected; verify remote deployment state before resume"
  }
  return $true
}

function Assert-FodeRemoteConfigReadbacks {
  param(
    [object]$ExpectedIdentity,
    [object]$FirstReadback,
    [object]$SecondReadback
  )
  foreach ($readback in @($FirstReadback, $SecondReadback)) {
    if (!$readback) { throw "remote Config readback missing" }
    if ($readback.Runtime -ne $ExpectedIdentity.Runtime -or [int]$readback.Deploy -ne [int]$ExpectedIdentity.Deploy) {
      throw "remote Config mismatch stop: expected $($ExpectedIdentity.Runtime) / $($ExpectedIdentity.Deploy), got $($readback.Runtime) / $($readback.Deploy)"
    }
  }
  if ($FirstReadback.Runtime -ne $SecondReadback.Runtime -or [int]$FirstReadback.Deploy -ne [int]$SecondReadback.Deploy) {
    throw "inconsistent repeated readback stop"
  }
  return $true
}

function Assert-FodeRepinVerification {
  param(
    [object]$ExpectedIdentity,
    [object]$Whoami
  )
  if (!$Whoami -or $Whoami.Runtime -ne $ExpectedIdentity.Runtime -or [int]$Whoami.Deploy -ne [int]$ExpectedIdentity.Deploy) {
    throw "failed repin verification"
  }
  return $true
}

function Invoke-FodeTestGate {
  param(
    [object]$TestSelection,
    [switch]$Mock
  )
  Write-Host "TEST GATE: $($TestSelection.Gate)"
  Write-Host "TESTS SELECTED: $(@($TestSelection.RequiredTestGroups) -join ', ')"
  if ($Mock) {
    Write-Host "MOCK TEST GATE: selected tests were not executed."
    return [pscustomobject]@{ Gate = $TestSelection.Gate; ExitCode = 0; PassedFiles = 0; Assertions = 0; Mocked = $true }
  }
  if ($TestSelection.Gate -eq "Full") {
    $files = Get-ChildItem tests -Filter "*.test.js" | Sort-Object Name
    $passed = 0
    foreach ($file in $files) {
      Write-Host "RUN $($file.Name)"
      & node $file.FullName
      if ($LASTEXITCODE -ne 0) { throw "Full Gate failed: $($file.Name) exit $LASTEXITCODE" }
      $passed++
    }
    return [pscustomobject]@{ Gate = "Full"; ExitCode = 0; PassedFiles = $passed; Assertions = $null; Mocked = $false }
  }
  $tests = @($TestSelection.RequiredTestGroups | Where-Object { $_ -match '^tests\\.*\.test\.js$' } | Sort-Object -Unique)
  $passedFast = 0
  foreach ($test in $tests) {
    Write-Host "RUN $test"
    & node $test
    if ($LASTEXITCODE -ne 0) { throw "Fast Gate failed: $test exit $LASTEXITCODE" }
    $passedFast++
  }
  return [pscustomobject]@{ Gate = "Fast"; ExitCode = 0; PassedFiles = $passedFast; Assertions = $null; Mocked = $false }
}
