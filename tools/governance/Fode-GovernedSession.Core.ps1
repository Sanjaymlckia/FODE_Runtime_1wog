function ConvertTo-FodeGovernancePaths([string]$Value) {
  if ([string]::IsNullOrWhiteSpace($Value)) { return @() }
  return @($Value -split '[;,]' | ForEach-Object { $_.Trim().Replace('\', '/') } | Where-Object { $_ } | Sort-Object -Unique)
}

function Get-FodeChangedPaths([object[]]$StatusLines) {
  $paths = @()
  foreach ($lineValue in @($StatusLines)) {
    $line = [string]$lineValue
    if ($line.Length -lt 4) { continue }
    $path = $line.Substring(3).Trim()
    if ($path -match ' -> ') { $path = ($path -split ' -> ')[-1] }
    if ($path.StartsWith('"') -and $path.EndsWith('"')) { $path = $path.Substring(1, $path.Length - 2) }
    if ($path) { $paths += $path.Replace('\', '/') }
  }
  return @($paths | Sort-Object -Unique)
}

function Test-FodeApprovedScope([object[]]$StatusLines, [string[]]$ApprovedPaths) {
  $changed = @(Get-FodeChangedPaths $StatusLines)
  $approved = @($ApprovedPaths | ForEach-Object { ([string]$_).Trim().Replace('\', '/') } | Where-Object { $_ } | Sort-Object -Unique)
  $unapproved = @($changed | Where-Object { $_ -notin $approved })
  return [pscustomobject]@{
    allowed = ($unapproved.Count -eq 0)
    changedPaths = $changed
    approvedPaths = $approved
    unapprovedPaths = $unapproved
  }
}

function Test-FodeLifecycleTransition(
  [string]$CurrentPhase,
  [string]$TargetPhase,
  [bool]$ScopeAllowed,
  [bool]$TestsPassed,
  [bool]$GitPreflightPassed,
  [bool]$DeploymentPreflightPassed,
  [bool]$NoProhibitedExternalAction,
  [bool]$ReleaseAuthorized
) {
  $edges = @{
    OPEN = @('WORKING')
    WORKING = @('VALIDATED')
    VALIDATED = @('RELEASE_READY')
    RELEASE_READY = @('RELEASED')
    RELEASED = @('VERIFIED')
    READ_ONLY_RECONCILIATION = @('WORKING','RELEASE_READY')
  }
  if (!$edges.ContainsKey($CurrentPhase) -or $TargetPhase -notin $edges[$CurrentPhase]) {
    return [pscustomobject]@{ allowed = $false; reason = "Unsupported lifecycle transition $CurrentPhase -> $TargetPhase" }
  }
  if (!$ScopeAllowed) { return [pscustomobject]@{ allowed = $false; reason = 'Changed-file scope contains an unrelated or unauthorized path' } }
  if ($TargetPhase -in @('VALIDATED','RELEASE_READY') -and !$TestsPassed) { return [pscustomobject]@{ allowed = $false; reason = 'Required tests have not passed' } }
  if ($TargetPhase -eq 'RELEASE_READY' -and (!$GitPreflightPassed -or !$DeploymentPreflightPassed)) { return [pscustomobject]@{ allowed = $false; reason = 'Git or deployment preflight has not passed' } }
  if ($TargetPhase -in @('VALIDATED','RELEASE_READY','RELEASED','VERIFIED') -and !$NoProhibitedExternalAction) { return [pscustomobject]@{ allowed = $false; reason = 'Absence of prohibited external actions is not proven' } }
  if ($TargetPhase -in @('RELEASE_READY','RELEASED') -and !$ReleaseAuthorized) { return [pscustomobject]@{ allowed = $false; reason = 'Source release is not owner-authorized' } }
  return [pscustomobject]@{ allowed = $true; reason = '' }
}

function Get-FodeRollbackDisposition([string]$FailureClass) {
  $material = @('AUTHENTICATION','AUTHORITY','SOURCE_INTEGRITY','DEPLOYMENT_MISMATCH','RUNTIME','SECURITY','APPLICANT_IDENTITY','APPLICANT_ACTIONABILITY','EXTERNAL_DATA_RISK','DESKTOP_SURFACE')
  if ($FailureClass -in $material) { return 'STOP_AND_ROLLBACK_DECISION_REQUIRED' }
  if ($FailureClass -eq 'MOBILE_LAYOUT') { return 'STOP_FORWARD_FIX_NO_ROLLBACK' }
  if ($FailureClass -eq 'GOVERNANCE_TOOL') { return 'PRESERVE_RUNTIME_NO_ROLLBACK' }
  return 'STOP_AND_CLASSIFY'
}

function Get-FodeWorkMode([string]$Scope) {
  $value = ([string]$Scope).ToLowerInvariant()
  if ($value -match '(send|gmail|php|mariadb|mysql|database|ledger|applicant[ -]?data|student|production|drive|sheet|classroom|zoho|credential|secret|token|authori[sz]ation|security|schema|payment|books)') {
    return [pscustomobject]@{ mode='HIGH'; track='H'; sessionRequired=$true; ownerCheckpoint='Before any external or authority-affecting action'; reason='The scope can affect authority, data, communications, an external system, Student, or Production.' }
  }
  if ($value -match '(adminui|eduops|\.html|\.css|client|browser|preview|staging|deploy|repin|clasp|runtime)') {
    return [pscustomobject]@{ mode='MEDIUM'; track='L'; sessionRequired=$false; ownerCheckpoint='Before commit/push or an Admin staging release'; reason='The scope changes an operator-facing UI or Admin staging surface.' }
  }
  return [pscustomobject]@{ mode='LOW'; track='L'; sessionRequired=$false; ownerCheckpoint='None for local work; normal scoped diff and test checks apply'; reason='The scope is local code, tests, documentation, or governance tooling only.' }
}
