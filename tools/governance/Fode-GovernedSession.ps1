[CmdletBinding()]
param(
  [ValidateSet('Orient','Status','Checkpoint','RecordDecision','Close')]
  [string]$Action = 'Orient',
  [string]$TaskId = '',
  [string]$TaskLabel = '',
  [string]$Decision = '',
  [string]$Scope = '',
  [string]$RelatedTask = '',
  [string]$EvidenceSource = '',
  [string]$PendingDecision = '',
  [string]$PendingAcceptance = '',
  [string]$NextSafeAction = '',
  [switch]$Supersede,
  [string]$StateRoot = ''
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$policyPath = Join-Path $repoRoot 'governance\owner-policy.json'
if ([string]::IsNullOrWhiteSpace($StateRoot)) { $StateRoot = Join-Path $repoRoot '.codex\state\fode-governance' }
$statePath = Join-Path $StateRoot 'current.json'
$eventsPath = Join-Path $StateRoot 'events.json'
$sessionId = [guid]::NewGuid().ToString('N')

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
  try { return (Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json) } catch { Fail "Malformed state: $Path" }
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
  return (Get-FileHash -LiteralPath $policyPath -Algorithm SHA256).Hash
}

function Save-Event([object]$State, [string]$Kind) {
  $existingEvents = Read-JsonFile $eventsPath
  $events = @()
  if ($existingEvents) { $events = @($existingEvents) }
  $events += [ordered]@{ kind = $Kind; at = (Get-Date).ToUniversalTime().ToString('o'); sessionId = $State.sessionId; governedState = $State.governedState }
  Write-Atomic $eventsPath $events
  Write-Atomic $statePath $State
}

$observed = Snapshot
$policyHash = PolicyHash
$previous = Read-JsonFile $statePath
if ($previous -and $previous.policyHash -and $previous.policyHash -ne $policyHash) { Fail 'Owner policy changed since the recorded checkpoint' 'OWNER_DECISION_REQUIRED' }

function Output-State([object]$State, [string]$Message = '') {
  $result = [ordered]@{
    governedState = $State.governedState
    ok = ($State.governedState -in @('GOVERNED_SESSION_READY','GOVERNED_SESSION_RECOVERED'))
    repository = $repoRoot
    session = $State
    observed = $observed
    message = (Redact $Message)
  }
  $result | ConvertTo-Json -Depth 16
  if (!$result.ok -and $Action -in @('Orient','Checkpoint','RecordDecision','Close')) { exit 2 }
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
    $age = ((Get-Date).ToUniversalTime() - (Get-Item -LiteralPath $statePath).LastWriteTimeUtc).TotalMinutes
    if (($age -lt 30) -and ($Supersede.IsPresent -eq $false)) { Fail 'An active governed session owns this worktree' 'CONCURRENT_SESSION_DETECTED' }
    $previous.status = 'interrupted'
    $previous.governedState = 'GOVERNED_SESSION_STOP'
    $previous.closedAt = $null
    Save-Event $previous 'interrupted'
    $message = 'Prior open session was classified as interrupted; state was reconstructed from current evidence.'
  }
  $state = [ordered]@{
    sessionId = $sessionId; openedAt = (Get-Date).ToUniversalTime().ToString('o'); lastCheckpointAt = (Get-Date).ToUniversalTime().ToString('o'); closedAt = $null; status = 'open'
    baselineHead = $observed.head; branch = $observed.branch; taskId = (Redact $TaskId); taskLabel = (Redact $TaskLabel); governedState = $(if($observed.clean){ if($previous){'GOVERNED_SESSION_RECOVERED'}else{'GOVERNED_SESSION_READY'} } else {'READ_ONLY_RECONCILIATION'})
    pendingDecision = (Redact $PendingDecision); pendingAcceptance = (Redact $PendingAcceptance); nextSafeAction = (Redact $(if($NextSafeAction){$NextSafeAction}else{'Review governed state before editing.'})); continuingProhibitions = @((Read-JsonFile $policyPath).controls); policyHash = $policyHash; observed = $observed
  }
  Save-Event $state 'opened'
  Output-State $state $message
  exit 0
}

if (!$previous -or $previous.status -ne 'open') { Fail 'No open governed session exists' 'GOVERNED_SESSION_STOP' }
if ($previous.baselineHead -ne $observed.head -or $previous.branch -ne $observed.branch) { Fail 'Recorded session baseline conflicts with observed Git evidence' 'BASELINE_DRIFT' }

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
if ($Action -eq 'Checkpoint') { $previous.governedState = $(if($observed.clean){'GOVERNED_SESSION_READY'}else{'READ_ONLY_RECONCILIATION'}); Save-Event $previous 'checkpointed'; Output-State $previous 'Checkpoint persisted.'; exit 0 }
if ($Action -eq 'Close') {
  $previous.closedAt = (Get-Date).ToUniversalTime().ToString('o'); $previous.status = 'closed'
  if (!$observed.clean) { $previous.governedState = 'READ_ONLY_RECONCILIATION'; $previous.nextSafeAction = 'Review existing modifications; closure did not certify them.' }
  elseif ($previous.pendingDecision -or $previous.pendingAcceptance) { $previous.governedState = 'OWNER_DECISION_REQUIRED' }
  else { $previous.governedState = 'GOVERNED_SESSION_READY' }
  Save-Event $previous 'closed'; Output-State $previous 'Governed closure receipt persisted.'; exit 0
}

Fail "Unsupported action: $Action"
