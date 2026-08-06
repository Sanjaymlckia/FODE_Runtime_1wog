[CmdletBinding()]
param(
  [ValidateSet('Assess','Orient','Status','Checkpoint','RecordDecision','TransferOwnership','RecoverLostLease','Recover','Transition','Pause','Resume','Close')]
  [string]$Action = 'Orient',
  [string]$TaskId = '',
  [string]$TaskLabel = '',
  [string]$Decision = '',
  [string]$OwnerDecision = '',
  [string]$Scope = '',
  [string]$RelatedTask = '',
  [string]$EvidenceSource = '',
  [string]$PendingDecision = '',
  [string]$PendingAcceptance = '',
  [string]$NextSafeAction = '',
  [string]$SessionId = '',
  [string]$OwnerLease = '',
  [string]$ApprovedPaths = '',
  [string]$TargetPhase = '',
  [switch]$TestsPassed,
  [switch]$GitPreflightPassed,
  [switch]$DeploymentPreflightPassed,
  [switch]$NoProhibitedExternalAction,
  [switch]$ReleaseAuthorized,
  [switch]$CommunicationAuthorized,
  [switch]$AcceptancePassed,
  [string]$FailureClass = '',
  [string]$SourceWork = '',
  [string]$Tests = '',
  [string]$GitOperations = '',
  [string]$AppsScriptPush = '',
  [string]$VersionCreation = '',
  [string]$DeploymentRepin = '',
  [string]$BrowserAcceptance = '',
  [string]$ExternalMutations = '',
  [switch]$ClearPendingAcceptance,
  [switch]$AcceptBaselineAdvance,
  [switch]$Supersede,
  [string]$StateRoot = ''
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$policyPath = Join-Path $repoRoot 'governance\owner-policy.json'
if ([string]::IsNullOrWhiteSpace($StateRoot)) { $StateRoot = Join-Path $repoRoot '.codex\state\fode-governance' }
$statePath = Join-Path $StateRoot 'current.json'
$eventsPath = Join-Path $StateRoot 'events.json'
$transactionPath = Join-Path $StateRoot 'transaction.json'
$newSessionId = [guid]::NewGuid().ToString('N')
. (Join-Path $PSScriptRoot 'Fode-GovernedSession.Core.ps1')

function Redact([string]$Value) {
  if ($null -eq $Value) { return '' }
  $clean = $Value -replace '(?i)(token|secret|password|credential|authorization)\s*[:=]\s*\S+', '$1=[REDACTED]'
  $clean -replace '(?i)FODE-\d{2}-\d{6}', '[REDACTED-APPLICANT]'
}

function Fail([string]$Message, [string]$State = 'GOVERNED_SESSION_STOP') {
  $result = [ordered]@{ governedState = $State; ok = $false; repository = $repoRoot; message = (Redact $Message) }
  $result | ConvertTo-Json -Depth 8
  exit 2
}

function Read-JsonFile([string]$Path) {
  if (!(Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
  try { return (Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json) } catch { Fail "Malformed governance state requires recovery: $Path" 'RECOVERY_REQUIRED' }
}

function Write-Atomic([string]$Path, [object]$Value) {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Path) | Out-Null
  $tmp = "$Path.$([guid]::NewGuid().ToString('N')).tmp"
  try {
    $Value | ConvertTo-Json -Depth 16 | Set-Content -LiteralPath $tmp -Encoding UTF8
    Move-Item -LiteralPath $tmp -Destination $Path -Force
  } finally { if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force } }
}

function Git([string]$Command, [switch]$AllowMany) {
  $args = @('-C', $repoRoot) + ($Command -split ' ')
  $out = @(& git.exe @args 2>$null)
  if ($LASTEXITCODE -ne 0) { Fail "Unable to inspect Git: $Command" }
  if ($AllowMany) { return $out }
  return (($out -join "`n").Trim())
}

function Snapshot {
  $testSnapshot = [Environment]::GetEnvironmentVariable('FODE_GOVERNANCE_TEST_SNAPSHOT')
  $testStatePrefix = Join-Path $repoRoot '.codex\state\fode-governance-test-'
  if ($testSnapshot -and $StateRoot.StartsWith($testStatePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    try { $fixture = $testSnapshot | ConvertFrom-Json } catch { Fail 'Malformed governance test snapshot' }
    return [ordered]@{
      repoRoot = $repoRoot; branch = [string]$fixture.branch; head = [string]$fixture.head; originMain = [string]$fixture.originMain
      clean = [bool]$fixture.clean; statusLines = @($fixture.statusLines); observedAt = (Get-Date).ToUniversalTime().ToString('o')
    }
  }
  $statusLines = @(Git 'status --porcelain=v1' -AllowMany)
  $branch = Git 'branch --show-current'
  $head = Git 'rev-parse HEAD'
  $origin = Git 'rev-parse origin/main'
  [ordered]@{
    repoRoot = $repoRoot
    branch = $branch
    head = $head
    originMain = $origin
    clean = ($statusLines.Count -eq 0)
    statusLines = @($statusLines)
    observedAt = (Get-Date).ToUniversalTime().ToString('o')
  }
}

function PolicyHash {
  if (!(Test-Path -LiteralPath $policyPath -PathType Leaf)) { Fail 'Owner policy is missing' }
  $getFileHash = Get-Command -Name Get-FileHash -ErrorAction SilentlyContinue
  if ($getFileHash) { return (Get-FileHash -LiteralPath $policyPath -Algorithm SHA256).Hash }
  try {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash([System.IO.File]::ReadAllBytes($policyPath))).Replace('-', '')) } finally { $sha.Dispose() }
  } catch { Fail 'Owner policy hash could not be calculated' 'RECOVERY_REQUIRED' }
}

function Hash-Text([string]$Value) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    return ([BitConverter]::ToString($sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($Value))).Replace('-', '')).ToLowerInvariant()
  } finally { $sha.Dispose() }
}

function Test-GovernanceSnapshotMode {
  $snapshot = [Environment]::GetEnvironmentVariable('FODE_GOVERNANCE_TEST_SNAPSHOT')
  $prefix = Join-Path $repoRoot '.codex\state\fode-governance-test-'
  return [bool]($snapshot -and $StateRoot.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase))
}

function Get-CommitScopePaths([string]$Baseline, [string]$Head) {
  if ((Test-GovernanceSnapshotMode) -or [string]::IsNullOrWhiteSpace($Baseline) -or $Baseline -eq $Head) { return @() }
  return @(Git "diff --name-only $Baseline..$Head" -AllowMany | ForEach-Object { $_.Trim().Replace('\', '/') } | Where-Object { $_ })
}

function New-OwnerLease {
  if (Test-GovernanceSnapshotMode) {
    $testLease = [Environment]::GetEnvironmentVariable('FODE_GOVERNANCE_TEST_LEASE')
    if ($testLease) { return $testLease }
  }
  return [guid]::NewGuid().ToString('N')
}

function Get-OwnerLeaseStoreRoot {
  if (Test-GovernanceSnapshotMode) {
    $testRoot = [Environment]::GetEnvironmentVariable('FODE_GOVERNANCE_TEST_LEASE_ROOT')
    if ([string]::IsNullOrWhiteSpace($testRoot)) { Fail 'Governance test lease root is required' 'RECOVERY_REQUIRED' }
    return $testRoot
  }
  $root = [Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)
  if ([string]::IsNullOrWhiteSpace($root)) { Fail 'Windows local application data is unavailable for protected lease storage' 'RECOVERY_REQUIRED' }
  return (Join-Path $root 'FODE\governance-leases')
}

function Get-OwnerLeaseStorePath([string]$SessionId) {
  if ([string]::IsNullOrWhiteSpace($SessionId) -or $SessionId -notmatch '^[a-f0-9]{32}$') { Fail 'Governed session identifier is invalid for protected lease storage' 'RECOVERY_REQUIRED' }
  return (Join-Path (Get-OwnerLeaseStoreRoot) ("$SessionId.lease"))
}

function Set-UserOnlyLeaseAcl([string]$Path) {
  if (Test-GovernanceSnapshotMode) { return }
  try {
    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
    if ($null -eq $identity) { throw 'Current Windows user SID is unavailable' }
    $acl = New-Object System.Security.AccessControl.FileSecurity
    $acl.SetAccessRuleProtection($true, $false)
    $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($identity, 'FullControl', 'Allow')
    $acl.AddAccessRule($rule)
    [System.IO.File]::SetAccessControl($Path, $acl)
  } catch { Fail 'Protected local lease access control could not be applied' 'RECOVERY_REQUIRED' }
}

function Save-ProtectedOwnerLease([string]$SessionId, [string]$Lease) {
  if ([string]::IsNullOrWhiteSpace($Lease)) { Fail 'A replacement ownership lease could not be created' 'RECOVERY_REQUIRED' }
  if ([Environment]::GetEnvironmentVariable('FODE_GOVERNANCE_TEST_DPAPI_FAIL') -eq '1') { Fail 'Protected local lease storage failed' 'RECOVERY_REQUIRED' }
  $path = Get-OwnerLeaseStorePath $SessionId
  try {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $path) | Out-Null
    if (Test-GovernanceSnapshotMode) {
      [System.IO.File]::WriteAllBytes($path, [System.Text.Encoding]::UTF8.GetBytes($Lease))
    } else {
      Add-Type -AssemblyName System.Security
      $plain = [System.Text.Encoding]::UTF8.GetBytes($Lease)
      try { $protected = [System.Security.Cryptography.ProtectedData]::Protect($plain, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser) } finally { [Array]::Clear($plain, 0, $plain.Length) }
      [System.IO.File]::WriteAllBytes($path, $protected)
    }
    Set-UserOnlyLeaseAcl $path
  } catch { Fail 'Protected local lease storage failed' 'RECOVERY_REQUIRED' }
}

function Get-ProtectedOwnerLease([string]$SessionId) {
  $path = Get-OwnerLeaseStorePath $SessionId
  if (!(Test-Path -LiteralPath $path -PathType Leaf)) { Fail 'No protected local ownership lease is available for this session' 'CONCURRENT_SESSION_DETECTED' }
  try {
    $stored = [System.IO.File]::ReadAllBytes($path)
    if (Test-GovernanceSnapshotMode) { return [System.Text.Encoding]::UTF8.GetString($stored) }
    Add-Type -AssemblyName System.Security
    $plain = [System.Security.Cryptography.ProtectedData]::Unprotect($stored, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    try { return [System.Text.Encoding]::UTF8.GetString($plain) } finally { [Array]::Clear($plain, 0, $plain.Length) }
  } catch { Fail 'Protected local ownership lease could not be read' 'CONCURRENT_SESSION_DETECTED' }
}

function Add-Or-Set([object]$Object, [string]$Name, [object]$Value) {
  $Object | Add-Member -NotePropertyName $Name -NotePropertyValue $Value -Force
}

function Require-OwnerLease([object]$State) {
  $leaseHashProperty = $State.PSObject.Properties['ownershipLeaseHash']
  $generationProperty = $State.PSObject.Properties['ownershipGeneration']
  $bindingProperty = $State.PSObject.Properties['ownershipBinding']
  if ($null -eq $leaseHashProperty -or [string]::IsNullOrWhiteSpace([string]$leaseHashProperty.Value) -or [string]$leaseHashProperty.Value -notmatch '^[a-f0-9]{64}$') { Fail 'Governed ownership lease data is missing or invalid' 'CONCURRENT_SESSION_DETECTED' }
  if ($null -eq $generationProperty -or [int]$generationProperty.Value -lt 1 -or $null -eq $bindingProperty -or [string]$bindingProperty.Value -ne 'generated-lease') { Fail 'Governed ownership binding is incomplete or invalid' 'CONCURRENT_SESSION_DETECTED' }
  $effectiveLease = if ([string]::IsNullOrWhiteSpace($OwnerLease)) { Get-ProtectedOwnerLease ([string]$State.sessionId) } else { $OwnerLease }
  if ((Hash-Text $effectiveLease) -ne [string]$leaseHashProperty.Value) { Fail 'The supplied ownership lease is no longer valid' 'CONCURRENT_SESSION_DETECTED' }
}

function Confirm-LostLeaseRecovery {
  if (Test-GovernanceSnapshotMode) { return ([Environment]::GetEnvironmentVariable('FODE_GOVERNANCE_TEST_CONFIRM_LOST_LEASE') -eq 'RECOVER LOST OWNER LEASE') }
  if ([Console]::IsInputRedirected) { Fail 'Lost-lease recovery requires an interactive Windows owner confirmation' 'OWNER_DECISION_REQUIRED' }
  $confirmation = Read-Host 'Windows owner: type RECOVER LOST OWNER LEASE to confirm local governed-session lease recovery'
  return ($confirmation -ceq 'RECOVER LOST OWNER LEASE')
}

function Get-LostLeaseRecoveryScope([string]$Baseline, [string]$Head) {
  if (Test-GovernanceSnapshotMode) {
    $scope = [Environment]::GetEnvironmentVariable('FODE_GOVERNANCE_TEST_RECOVERY_SCOPE')
    if ([string]::IsNullOrWhiteSpace($scope)) { return @() }
    return @($scope -split ';' | ForEach-Object { $_.Trim().Replace('\\','/') } | Where-Object { $_ } | Sort-Object -Unique)
  }
  return @(Get-CommitScopePaths $Baseline $Head | Sort-Object -Unique)
}

function Clone-State([object]$State) {
  return ($State | ConvertTo-Json -Depth 32 | ConvertFrom-Json)
}

function Existing-Events {
  $existing = Read-JsonFile $eventsPath
  if ($null -eq $existing) { return @() }
  return @($existing)
}

function Get-StateSummary([object]$State) {
  if ($null -eq $State) { return $null }
  return [ordered]@{
    status = [string]$State.status; phase = [string]$State.phase; governedState = [string]$State.governedState
    baselineHead = [string]$State.baselineHead; branch = [string]$State.branch
    ownershipGeneration = if ($State.PSObject.Properties['ownershipGeneration']) { [int]$State.ownershipGeneration } else { 0 }
    approvedScopeHash = if ($State.PSObject.Properties['approvedScopeHash']) { [string]$State.approvedScopeHash } else { '' }
  }
}

function Get-EventHash([object]$Event) {
  $copy = [ordered]@{}
  foreach ($property in $Event.PSObject.Properties) { if ($property.Name -ne 'eventHash') { $copy[$property.Name] = $property.Value } }
  return (Hash-Text ($copy | ConvertTo-Json -Depth 32 -Compress))
}

function Assert-EventHistory([object]$State, [object[]]$Events) {
  if ($null -eq $State) { return }
  if ($State.PSObject.Properties['lastEventId']) {
    if (@($Events).Count -eq 0) { Fail 'Governance state has no matching event history' 'RECOVERY_REQUIRED' }
    $last = @($Events)[@($Events).Count - 1]
    if ([string]$last.eventId -ne [string]$State.lastEventId -or [string]$last.eventHash -ne [string]$State.lastEventHash -or [string]$last.eventHash -notmatch '^[a-f0-9]{64}$') { Fail 'Governance state and event history are contradictory' 'RECOVERY_REQUIRED' }
  }
}

function Invoke-TestFailurePoint([string]$Point) {
  if (!(Test-GovernanceSnapshotMode)) { return }
  if ([Environment]::GetEnvironmentVariable('FODE_GOVERNANCE_TEST_FAILURE_POINT') -eq $Point) { throw "Injected governance write failure at $Point" }
}

function Restore-GovernanceStore([object]$State, [object]$Events) {
  if ($null -eq $Events) { if (Test-Path -LiteralPath $eventsPath) { Remove-Item -LiteralPath $eventsPath -Force } } else { Write-Atomic $eventsPath $Events }
  if ($null -eq $State) { if (Test-Path -LiteralPath $statePath) { Remove-Item -LiteralPath $statePath -Force } } else { Write-Atomic $statePath $State }
}

function Commit-GovernanceStore([object]$PreviousState, [object]$PreviousEvents, [object]$NextState, [object[]]$NextEvents, [string]$Operation) {
  $journal = [ordered]@{
    schemaVersion = 1; transactionId = [guid]::NewGuid().ToString('N'); operation = $Operation; createdAt = (Get-Date).ToUniversalTime().ToString('o')
    sessionId = [string]$NextState.sessionId; previousState = $PreviousState; previousEvents = $PreviousEvents; nextState = $NextState; nextEvents = $NextEvents
  }
  Write-Atomic $transactionPath $journal
  try {
    Write-Atomic $eventsPath $NextEvents
    Invoke-TestFailurePoint 'after-events'
    Write-Atomic $statePath $NextState
    Invoke-TestFailurePoint 'after-state'
    $verifiedState = Read-JsonFile $statePath
    $verifiedEvents = @(Existing-Events)
    Assert-EventHistory $verifiedState $verifiedEvents
    Remove-Item -LiteralPath $transactionPath -Force
  } catch {
    try {
      Restore-GovernanceStore $PreviousState $PreviousEvents
      if (Test-Path -LiteralPath $transactionPath) { Remove-Item -LiteralPath $transactionPath -Force }
      $restoredState = Read-JsonFile $statePath
      $restoredEvents = @(Existing-Events)
      if (($null -eq $PreviousState) -ne ($null -eq $restoredState) -or @($restoredEvents).Count -ne @($PreviousEvents).Count) { throw 'Rollback verification failed' }
    } catch { Fail 'Governance checkpoint failed and recovery is required' 'RECOVERY_REQUIRED' }
    Fail 'Governance checkpoint failed; prior state was restored' 'GOVERNED_SESSION_STOP'
  }
}

function Save-Event([object]$State, [string]$Kind, [string]$Reason = '') {
  $priorState = Read-JsonFile $statePath
  $priorEvents = if (Test-Path -LiteralPath $eventsPath -PathType Leaf) { @(Existing-Events) } else { $null }
  $priorEventList = @($priorEvents | Where-Object { $null -ne $_ })
  Assert-EventHistory $priorState $priorEventList
  $previousEventHash = ''
  if ($priorEventList.Count -gt 0) {
    $lastPriorEvent = $priorEventList[$priorEventList.Count - 1]
    if ($lastPriorEvent.PSObject.Properties['eventHash']) { $previousEventHash = [string]$lastPriorEvent.eventHash }
  }
  $event = [ordered]@{
    eventId = [guid]::NewGuid().ToString('N'); sequence = $priorEventList.Count + 1; kind = $Kind; at = (Get-Date).ToUniversalTime().ToString('o')
    sessionId = [string]$State.sessionId; ownershipGeneration = if ($State.PSObject.Properties['ownershipGeneration']) { [int]$State.ownershipGeneration } else { 0 }
    previousBaseline = if ($priorState) { [string]$priorState.baselineHead } else { '' }; newBaseline = [string]$State.baselineHead
    approvedPaths = @($State.approvedPaths); approvedScopeHash = if ($State.PSObject.Properties['approvedScopeHash']) { [string]$State.approvedScopeHash } else { '' }
    commitIdentity = [string]$State.observed.head; reason = (Redact $Reason); priorState = (Get-StateSummary $priorState); resultingState = (Get-StateSummary $State); previousEventHash = $previousEventHash
  }
  $event.eventHash = Get-EventHash ([pscustomobject]$event)
  $events = $priorEventList + [pscustomobject]$event
  Add-Or-Set $State 'eventHistoryVersion' 2
  Add-Or-Set $State 'lastEventId' $event.eventId
  Add-Or-Set $State 'lastEventHash' $event.eventHash
  Commit-GovernanceStore $priorState $priorEvents $State $events $Kind
}

$observed = Snapshot
$policyHash = PolicyHash
$stateExists = Test-Path -LiteralPath $statePath -PathType Leaf
$eventsExist = Test-Path -LiteralPath $eventsPath -PathType Leaf
$pendingTransaction = Read-JsonFile $transactionPath
if ($pendingTransaction) {
  if ($Action -ne 'Recover') { Fail 'An interrupted governance checkpoint requires explicit recovery' 'RECOVERY_REQUIRED' }
  $recoveryState = $pendingTransaction.previousState
  if ($null -eq $recoveryState) { Fail 'The interrupted initial checkpoint cannot be recovered without an owner decision and clean state review' 'RECOVERY_REQUIRED' }
  if ([string]::IsNullOrWhiteSpace($SessionId) -or $SessionId -ne [string]$recoveryState.sessionId) { Fail 'Recovery requires the exact interrupted session ID' 'OWNER_DECISION_REQUIRED' }
  if ($OwnerDecision -ne 'RECOVER_GOVERNANCE_STATE') { Fail 'Recovery requires OwnerDecision RECOVER_GOVERNANCE_STATE' 'OWNER_DECISION_REQUIRED' }
  Require-OwnerLease $recoveryState
  try {
    Restore-GovernanceStore $pendingTransaction.previousState $pendingTransaction.previousEvents
    Remove-Item -LiteralPath $transactionPath -Force
    $recovered = Read-JsonFile $statePath
    Add-Or-Set $recovered 'recoveryOutcome' ([ordered]@{ at=(Get-Date).ToUniversalTime().ToString('o'); transactionId=[string]$pendingTransaction.transactionId; operation=[string]$pendingTransaction.operation; outcome='restored-prior-state'; ownerDecision='RECOVER_GOVERNANCE_STATE' })
    $recovered.governedState = 'GOVERNED_SESSION_RECOVERED'
    $recovered.lastCheckpointAt = (Get-Date).ToUniversalTime().ToString('o')
    $recovered.observed = $observed
    Save-Event $recovered 'recovery-restored' 'Explicit owner-authorized recovery restored the prior serialized state.'
    Output-State $recovered 'Interrupted governance checkpoint recovered to its prior serialized state.'
    exit 0
  } catch { Fail 'Governance recovery could not restore the prior serialized state' 'RECOVERY_REQUIRED' }
}
if ($stateExists -ne $eventsExist) { Fail 'Governance current state and event history are inconsistent; explicit recovery is required' 'RECOVERY_REQUIRED' }
$previous = Read-JsonFile $statePath
$existingEvents = if ($eventsExist) { @(Existing-Events) } else { @() }
Assert-EventHistory $previous $existingEvents
if ($previous -and $previous.policyHash -and $previous.policyHash -ne $policyHash) { Fail 'Owner policy changed since the recorded checkpoint' 'OWNER_DECISION_REQUIRED' }

function Output-State([object]$State, [string]$Message = '') {
  $result = [ordered]@{
    governedState = $State.governedState
    ok = ($State.governedState -in @('GOVERNED_SESSION_READY','GOVERNED_SESSION_RECOVERED','WORKING','VALIDATED','RELEASE_READY','RELEASED','VERIFIED','PAUSED'))
    repository = $repoRoot
    session = $State
    observed = $observed
    message = (Redact $Message)
  }
  $result | ConvertTo-Json -Depth 16
  if (!$result.ok -and $Action -in @('Orient','Checkpoint','RecordDecision','Transition','Pause','Resume','Close')) { exit 2 }
}

if ($Action -eq 'Assess') {
  $mode = Get-FodeWorkMode $Scope
  [ordered]@{ ok=$true; repository=$repoRoot; mode=$mode.mode; track=$mode.track; sessionRequired=$mode.sessionRequired; ownerCheckpoint=$mode.ownerCheckpoint; reason=$mode.reason; message='Mode was selected from the declared scope; it performs no state or external action.' } | ConvertTo-Json -Depth 4
  exit 0
}

if ($Action -eq 'Status') {
  if (!$previous) { Fail 'No governed checkpoint exists' 'READ_ONLY_RECONCILIATION' }
  if ($previous.branch -ne $observed.branch -or $previous.baselineHead -ne $observed.head) { $previous.governedState = 'BASELINE_DRIFT' }
  Output-State $previous 'Status is evidence-based; no state ownership was taken.'
  exit 0
}

if ($Action -eq 'Orient') {
  $state = $null
  $message = 'Fresh governed orientation completed.'
  if ($previous -and $previous.status -eq 'open') {
    Require-OwnerLease $previous
    if ($Supersede.IsPresent -eq $false) {
      $previous.lastCheckpointAt = (Get-Date).ToUniversalTime().ToString('o')
      $previous.observed = $observed
      $scopeCheck = Test-FodeApprovedScope $observed.statusLines @($previous.approvedPaths)
      $previous.governedState = $(if($observed.clean -or $scopeCheck.allowed){ if($previous.phase -and $previous.phase -ne 'OPEN'){$previous.phase}else{'GOVERNED_SESSION_RECOVERED'} }else{'READ_ONLY_RECONCILIATION'})
      Save-Event $previous 'oriented'
      Output-State $previous 'Existing governed session oriented under the active ownership lease.'
      exit 0
    }
    if ([string]::IsNullOrWhiteSpace($SessionId) -or $SessionId -ne [string]$previous.sessionId) { Fail 'Supersede requires the exact active session ID' 'OWNER_DECISION_REQUIRED' }
    if ($OwnerDecision -ne 'SUPERSEDE_GOVERNED_SESSION') { Fail 'Supersede requires OwnerDecision SUPERSEDE_GOVERNED_SESSION' 'OWNER_DECISION_REQUIRED' }
    $previous.status = 'interrupted'
    $previous.governedState = 'GOVERNED_SESSION_STOP'
    $previous.closedAt = $null
    Save-Event $previous 'superseded' 'Explicit owner-authorized supersession of the active governed session.'
    $message = 'Prior open session was explicitly superseded by the valid owner lease.'
  }
  $newLease = New-OwnerLease
  $state = [ordered]@{
    sessionId = $newSessionId; openedAt = (Get-Date).ToUniversalTime().ToString('o'); lastCheckpointAt = (Get-Date).ToUniversalTime().ToString('o'); closedAt = $null; status = 'open'
    baselineHead = $observed.head; branch = $observed.branch; taskId = (Redact $TaskId); taskLabel = (Redact $TaskLabel); governedState = $(if($observed.clean){ if($previous){'GOVERNED_SESSION_RECOVERED'}else{'GOVERNED_SESSION_READY'} } else {'READ_ONLY_RECONCILIATION'})
    phase = $(if($observed.clean){'OPEN'}else{'READ_ONLY_RECONCILIATION'}); approvedPaths = @(ConvertTo-FodeGovernancePaths $ApprovedPaths); releaseAuthorized = $ReleaseAuthorized.IsPresent; communicationAuthorized = $CommunicationAuthorized.IsPresent; actionReports = @()
    pendingDecision = (Redact $PendingDecision); pendingAcceptance = (Redact $PendingAcceptance); nextSafeAction = (Redact $(if($NextSafeAction){$NextSafeAction}else{'Review governed state before editing.'})); continuingProhibitions = @((Read-JsonFile $policyPath).controls); policyHash = $policyHash; observed = $observed
    ownershipGeneration = 1; ownershipBinding = 'generated-lease'; ownershipLeaseHash = (Hash-Text $newLease); ownershipTransfers = @()
  }
  Save-ProtectedOwnerLease $state.sessionId $newLease
  Save-Event $state 'opened'
  Output-State $state $message
  exit 0
}

if (!$previous -or $previous.status -ne 'open') { Fail 'No open governed session exists' 'GOVERNED_SESSION_STOP' }
if (!$previous.PSObject.Properties['phase']) { Add-Or-Set $previous 'phase' $(if($observed.clean){'OPEN'}else{'READ_ONLY_RECONCILIATION'}) }
if (!$previous.PSObject.Properties['approvedPaths']) { Add-Or-Set $previous 'approvedPaths' @() }
if (!$previous.PSObject.Properties['releaseAuthorized']) { Add-Or-Set $previous 'releaseAuthorized' $false }
if (!$previous.PSObject.Properties['communicationAuthorized']) { Add-Or-Set $previous 'communicationAuthorized' $false }
if (!$previous.PSObject.Properties['actionReports']) { Add-Or-Set $previous 'actionReports' @() }
if ($previous.baselineHead -ne $observed.head -or $previous.branch -ne $observed.branch) {
  $authorizedCloseAdvance = $Action -eq 'Close' -and $AcceptBaselineAdvance.IsPresent -and $observed.clean -and $observed.head -eq $observed.originMain -and $observed.branch -eq 'main'
  $authorizedReleaseAdvance = $Action -eq 'Transition' -and $TargetPhase -eq 'RELEASED' -and $ReleaseAuthorized.IsPresent -and $observed.clean -and $observed.head -eq $observed.originMain -and $observed.branch -eq 'main'
  $candidateApproved = if ($ApprovedPaths) { @(ConvertTo-FodeGovernancePaths $ApprovedPaths) } else { @($previous.approvedPaths) }
  $committedScope = @(Get-CommitScopePaths $previous.baselineHead $observed.head)
  $unapprovedCommitted = @($committedScope | Where-Object { $_ -notin $candidateApproved })
  $dirtyScope = Test-FodeApprovedScope $observed.statusLines $candidateApproved
  $authorizedGovernanceAdvance = $Action -eq 'Checkpoint' -and $AcceptBaselineAdvance.IsPresent -and $dirtyScope.allowed -and $observed.head -eq $observed.originMain -and $observed.branch -eq 'main' -and $unapprovedCommitted.Count -eq 0
  $preReleaseDrift = $Action -eq 'Transition' -and $TargetPhase -in @('WORKING','VALIDATED','RELEASE_READY') -and $unapprovedCommitted.Count -eq 0
  $lostLeaseRecoveryCandidate = $Action -eq 'RecoverLostLease'
  if (!$authorizedCloseAdvance -and !$authorizedReleaseAdvance -and !$authorizedGovernanceAdvance -and !$preReleaseDrift -and !$lostLeaseRecoveryCandidate) { Fail 'Recorded session baseline conflicts with observed Git evidence or committed scope is unauthorized' 'BASELINE_DRIFT' }
  if ($authorizedCloseAdvance -or $authorizedReleaseAdvance -or $authorizedGovernanceAdvance) {
    Add-Or-Set $previous 'baselineAdvancedFrom' $previous.baselineHead
    Add-Or-Set $previous 'baselineAdvanceReason' $(if ($authorizedGovernanceAdvance) { 'Owner-authorized governance baseline reconciliation with approved scope and HEAD aligned to origin/main' } else { 'Owner-authorized release closure with HEAD aligned to origin/main' })
    $previous.baselineHead = $observed.head
    $previous.branch = $observed.branch
  }
}

if ($Action -eq 'TransferOwnership') {
  Require-OwnerLease $previous
  if ([string]::IsNullOrWhiteSpace($SessionId) -or $SessionId -ne [string]$previous.sessionId) { Fail 'TransferOwnership requires the exact open session ID' 'OWNER_DECISION_REQUIRED' }
  if ([string]::IsNullOrWhiteSpace($OwnerDecision) -or $OwnerDecision -ne 'TRANSFER_SESSION_OWNERSHIP') { Fail 'TransferOwnership requires OwnerDecision TRANSFER_SESSION_OWNERSHIP' 'OWNER_DECISION_REQUIRED' }
  $oldGeneration = if ($previous.PSObject.Properties['ownershipGeneration']) { [int]$previous.ownershipGeneration } else { 0 }
  $oldLeaseHash = if ($previous.PSObject.Properties['ownershipLeaseHash']) { [string]$previous.ownershipLeaseHash } else { '' }
  $newGeneration = $oldGeneration + 1
  $newLease = New-OwnerLease
  $now = (Get-Date).ToUniversalTime().ToString('o')
  $audit = [ordered]@{
    decision = 'TRANSFER_SESSION_OWNERSHIP'
    scope = 'in-place governed session ownership transfer'
    sessionId = [string]$previous.sessionId
    timestamp = $now
    formerOwnershipGeneration = $oldGeneration
    formerLeaseHash = $oldLeaseHash
    newOwnershipGeneration = $newGeneration
    newLeaseHash = (Hash-Text $newLease)
    binding = 'generated-lease'
    evidenceSource = 'Explicit owner decision'
  }
  $next = Clone-State $previous
  Add-Or-Set $next 'ownershipGeneration' $newGeneration
  Add-Or-Set $next 'ownershipBinding' 'generated-lease'
  Add-Or-Set $next 'ownershipLeaseHash' (Hash-Text $newLease)
  $history = @()
  if ($next.PSObject.Properties['ownershipTransfers']) { $history = @($next.ownershipTransfers) }
  $history += [pscustomobject]$audit
  Add-Or-Set $next 'ownershipTransfers' $history
  Add-Or-Set $next 'lastDecision' ([pscustomobject]@{
    decision = 'TRANSFER_SESSION_OWNERSHIP'
    scope = 'in-place governed session ownership transfer'
    relatedTask = [string]$previous.taskLabel
    timestamp = $now
    evidenceSource = 'Explicit owner decision'
    continuingRestrictions = @($previous.continuingProhibitions)
  })
  $next.lastCheckpointAt = $now
  $next.observed = $observed
  Save-ProtectedOwnerLease $next.sessionId $newLease
  Save-Event $next 'ownership-transferred' 'Explicit owner-authorized in-place ownership transfer.'
  Output-State $next 'Owner-approved in-place session ownership transfer completed.'
  exit 0
}

if ($Action -eq 'RecoverLostLease') {
  if ([string]::IsNullOrWhiteSpace($SessionId) -or $SessionId -ne [string]$previous.sessionId) { Fail 'Lost-lease recovery requires the exact open session ID' 'OWNER_DECISION_REQUIRED' }
  if ($OwnerDecision -ne 'RECOVER_LOST_OWNER_LEASE') { Fail 'Lost-lease recovery requires OwnerDecision RECOVER_LOST_OWNER_LEASE' 'OWNER_DECISION_REQUIRED' }
  if (!$observed.clean -or $observed.branch -ne 'main' -or $observed.head -ne $observed.originMain) { Fail 'Lost-lease recovery requires a clean main branch aligned with origin/main' 'BASELINE_DRIFT' }
  $recoveryScope = @(Get-LostLeaseRecoveryScope $previous.baselineHead $observed.head)
  $expectedRecoveryScope = @('tools/governance/Fode-GovernedSession.ps1','tests/governance/fode-governed-session.test.js')
  if ($recoveryScope.Count -ne $expectedRecoveryScope.Count -or @($recoveryScope | Where-Object { $_ -notin $expectedRecoveryScope }).Count -ne 0) { Fail 'Lost-lease recovery requires only the exact governance recovery commit since the recorded baseline' 'BASELINE_DRIFT' }
  if (!(Confirm-LostLeaseRecovery)) { Fail 'Lost-lease recovery requires an interactive Windows owner confirmation' 'OWNER_DECISION_REQUIRED' }
  $formerGeneration = [int]$previous.ownershipGeneration
  if ($formerGeneration -lt 1) { Fail 'Lost-lease recovery requires a valid recorded ownership generation' 'RECOVERY_REQUIRED' }
  $replacementLease = New-OwnerLease
  $next = Clone-State $previous
  Add-Or-Set $next 'ownershipGeneration' ($formerGeneration + 1)
  Add-Or-Set $next 'ownershipBinding' 'generated-lease'
  Add-Or-Set $next 'ownershipLeaseHash' (Hash-Text $replacementLease)
  Add-Or-Set $next 'baselineAdvancedFrom' $previous.baselineHead
  Add-Or-Set $next 'baselineAdvanceReason' 'Owner-authorized lost-lease recovery accepted the exact governance recovery commit on clean main.'
  $next.baselineHead = $observed.head
  $next.branch = $observed.branch
  $now = (Get-Date).ToUniversalTime().ToString('o')
  $audit = [pscustomobject]@{ decision='RECOVER_LOST_OWNER_LEASE'; sessionId=[string]$previous.sessionId; timestamp=$now; formerOwnershipGeneration=$formerGeneration; newOwnershipGeneration=($formerGeneration + 1); baselineAdvancedFrom=[string]$previous.baselineHead; baselineAdvancedTo=[string]$observed.head; recoveryScope=$recoveryScope; evidenceSource='Interactive Windows owner confirmation' }
  $recoveries = if ($next.PSObject.Properties['lostLeaseRecoveries']) { @($next.lostLeaseRecoveries) } else { @() }
  Add-Or-Set $next 'lostLeaseRecoveries' ($recoveries + $audit)
  $next.lastCheckpointAt = $now
  $next.observed = $observed
  Save-ProtectedOwnerLease $next.sessionId $replacementLease
  Save-Event $next 'lost-lease-recovered' 'Owner-authorized lost-lease recovery created a protected local replacement lease.'
  Output-State $next 'Lost ownership lease recovered in place.'
  exit 0
}

if ($Action -in @('Checkpoint','RecordDecision','TransferOwnership','Transition','Pause','Resume','Close')) { Require-OwnerLease $previous }

if ($Action -eq 'RecordDecision') {
  if ([string]::IsNullOrWhiteSpace($Decision) -or [string]::IsNullOrWhiteSpace($Scope) -or [string]::IsNullOrWhiteSpace($RelatedTask)) { Fail 'RecordDecision requires Decision, Scope and RelatedTask' 'OWNER_DECISION_REQUIRED' }
  $previous.pendingDecision = $null
  $decisionRecord = [ordered]@{ decision = (Redact $Decision); scope = (Redact $Scope); relatedTask = (Redact $RelatedTask); timestamp = (Get-Date).ToUniversalTime().ToString('o'); evidenceSource = (Redact $EvidenceSource); continuingRestrictions = @($previous.continuingProhibitions) }
  $previous | Add-Member -NotePropertyName lastDecision -NotePropertyValue $decisionRecord -Force
  $previous.lastCheckpointAt = (Get-Date).ToUniversalTime().ToString('o')
  Save-Event $previous 'decision-recorded'; Output-State $previous 'Owner decision recorded.'; exit 0
}

$previous.lastCheckpointAt = (Get-Date).ToUniversalTime().ToString('o')
$previous.observed = $observed
if ($TaskId) { $previous.taskId = Redact $TaskId }
if ($TaskLabel) { $previous.taskLabel = Redact $TaskLabel }
if ($PendingDecision) { $previous.pendingDecision = Redact $PendingDecision }
if ($PendingAcceptance) { $previous.pendingAcceptance = Redact $PendingAcceptance }
if ($NextSafeAction) { $previous.nextSafeAction = Redact $NextSafeAction }
if ($ApprovedPaths) { Add-Or-Set $previous 'approvedPaths' @(ConvertTo-FodeGovernancePaths $ApprovedPaths) }
$reportValues = [ordered]@{ sourceWork=$SourceWork; tests=$Tests; gitOperations=$GitOperations; appsScriptPush=$AppsScriptPush; versionCreation=$VersionCreation; deploymentRepin=$DeploymentRepin; browserAcceptance=$BrowserAcceptance; externalMutations=$ExternalMutations }
if (@($reportValues.Values | Where-Object { $_ }).Count -gt 0) {
  $reports = @($previous.actionReports)
  $reports += [pscustomobject]([ordered]@{ at=(Get-Date).ToUniversalTime().ToString('o') } + $reportValues)
  Add-Or-Set $previous 'actionReports' $reports
}

if ($Action -eq 'Checkpoint') {
  $scopeCheck = Test-FodeApprovedScope $observed.statusLines @($previous.approvedPaths)
  if (!$scopeCheck.allowed) { $previous.phase = 'READ_ONLY_RECONCILIATION'; $previous.governedState = 'READ_ONLY_RECONCILIATION'; Add-Or-Set $previous 'unapprovedPaths' @($scopeCheck.unapprovedPaths) }
  elseif (!$observed.clean -and $previous.phase -eq 'OPEN') { $previous.phase = 'WORKING'; $previous.governedState = 'WORKING' }
  elseif ($previous.phase -and $previous.phase -ne 'OPEN') { $previous.governedState = $previous.phase }
  else { $previous.governedState = 'GOVERNED_SESSION_READY' }
  Save-Event $previous 'checkpointed'; Output-State $previous 'Checkpoint persisted.'; exit 0
}
if ($Action -eq 'Transition') {
  $validPhases = @('WORKING','VALIDATED','RELEASE_READY','RELEASED','VERIFIED')
  if ($TargetPhase -notin $validPhases) { Fail 'Transition requires a supported TargetPhase' 'OWNER_DECISION_REQUIRED' }
  if ($ApprovedPaths) { Add-Or-Set $previous 'approvedPaths' @(ConvertTo-FodeGovernancePaths $ApprovedPaths) }
  $scopeCheck = Test-FodeApprovedScope $observed.statusLines @($previous.approvedPaths)
  $transition = Test-FodeLifecycleTransition ([string]$previous.phase) $TargetPhase $scopeCheck.allowed $TestsPassed.IsPresent $GitPreflightPassed.IsPresent $DeploymentPreflightPassed.IsPresent $NoProhibitedExternalAction.IsPresent ($ReleaseAuthorized.IsPresent -or $previous.releaseAuthorized)
  if (!$transition.allowed) { Fail $transition.reason 'READ_ONLY_RECONCILIATION' }
  if ($TargetPhase -eq 'RELEASE_READY') {
    $committedScope = @(Get-CommitScopePaths $previous.baselineHead $observed.head)
    $scopeHashInput = @(@($previous.approvedPaths) + $committedScope | Sort-Object -Unique) -join "`n"
    Add-Or-Set $previous 'approvedScopeHash' (Hash-Text $scopeHashInput)
  }
  $previous.phase = $TargetPhase; $previous.governedState = $TargetPhase
  if ($ReleaseAuthorized) { $previous.releaseAuthorized = $true }
  if ($CommunicationAuthorized) { $previous.communicationAuthorized = $true }
  if ($TargetPhase -eq 'VERIFIED' -and !$AcceptancePassed) { Fail 'VERIFIED requires passing acceptance evidence' 'EXTERNAL_STATE_UNVERIFIED' }
  if ($CommunicationAuthorized -and (!$previous.lastDecision -or $previous.lastDecision.decision -ne 'OWNER_AUTHORIZED_COMMUNICATION')) { Fail 'Communication authorization requires a separate explicit owner decision' 'OWNER_DECISION_REQUIRED' }
  if ($FailureClass) { Add-Or-Set $previous 'rollbackDisposition' (Get-FodeRollbackDisposition $FailureClass) }
  Save-Event $previous 'transitioned'; Output-State $previous "Lifecycle transitioned to $TargetPhase."; exit 0
}
if ($Action -eq 'Pause') {
  if ($previous.phase -in @('RELEASED','VERIFIED','READ_ONLY_RECONCILIATION')) { Fail 'This lifecycle phase cannot be paused' 'OWNER_DECISION_REQUIRED' }
  Add-Or-Set $previous 'pausedFrom' $previous.phase; $previous.phase = 'PAUSED'; $previous.governedState = 'PAUSED'
  Save-Event $previous 'paused'; Output-State $previous 'Governed session paused with scope preserved.'; exit 0
}
if ($Action -eq 'Resume') {
  if ($previous.phase -ne 'PAUSED' -or !$previous.pausedFrom) { Fail 'Only a paused governed session can resume' 'OWNER_DECISION_REQUIRED' }
  $scopeCheck = Test-FodeApprovedScope $observed.statusLines @($previous.approvedPaths)
  if (!$scopeCheck.allowed) { Fail 'Paused session contains an unrelated or unauthorized changed path' 'READ_ONLY_RECONCILIATION' }
  $previous.phase = $previous.pausedFrom; $previous.governedState = $previous.phase; $previous.pausedFrom = $null
  Save-Event $previous 'resumed'; Output-State $previous 'Governed session resumed with approved scope preserved.'; exit 0
}
if ($Action -eq 'Close') {
  if ($ClearPendingAcceptance) {
    $previous.pendingDecision = $null
    $previous.pendingAcceptance = $null
  }
  $previous.closedAt = (Get-Date).ToUniversalTime().ToString('o'); $previous.status = 'closed'
  if (!$observed.clean) { $previous.governedState = 'READ_ONLY_RECONCILIATION'; $previous.nextSafeAction = 'Review existing modifications; closure did not certify them.' }
  elseif ($previous.pendingDecision -or $previous.pendingAcceptance) { $previous.governedState = 'OWNER_DECISION_REQUIRED' }
  elseif ($previous.phase -in @('OPEN','VERIFIED') -or $Decision -eq 'STOPPED_CLEANLY_BEFORE_WORK' -or ($previous.phase -eq 'RELEASED' -and $AcceptancePassed)) { $previous.phase = 'CLOSED'; $previous.governedState = 'GOVERNED_SESSION_READY' }
  else { $previous.governedState = 'OWNER_DECISION_REQUIRED' }
  Save-Event $previous 'closed'; Output-State $previous 'Governed closure receipt persisted.'; exit 0
}

Fail "Unsupported action: $Action"
