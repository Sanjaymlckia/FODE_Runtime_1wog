[CmdletBinding()]
param(
  [ValidateSet('continue', 'doctor', 'close')]
  [string]$Command = 'continue',
  [ValidateSet('code-only', 'staging-release', 'ledger', 'production', 'database-migration')]
  [string]$Profile = 'code-only',
  [switch]$Repair,
  [switch]$VerboseOutput,
  [string]$OwnerLease = '',
  [switch]$AcceptBaselineAdvance,
  [switch]$ClearPendingAcceptance
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$ContextPath = Join-Path $RepoRoot 'runtime-context.json'
$SessionTool = Join-Path $RepoRoot 'tools\governance\Fode-GovernedSession.ps1'
$LeasePath = Join-Path $RepoRoot '.codex\state\fode-governance\entrypoint-lease.txt'

function Fail-Fode {
  param([string]$Message)
  Write-Output "FODE $Command BLOCKED: $Message"
  exit 1
}

function Read-Context {
  if (!(Test-Path -LiteralPath $ContextPath -PathType Leaf)) { Fail-Fode "runtime-context.json not found" }
  try { return Get-Content -LiteralPath $ContextPath -Raw | ConvertFrom-Json }
  catch { Fail-Fode "runtime-context.json is invalid: $($_.Exception.Message)" }
}

function Assert-ApprovedStorage {
  param([object]$Project)
  $expectedRepo = [System.IO.Path]::GetFullPath([string]$Project.repository.path).TrimEnd('\')
  $actualRepo = [System.IO.Path]::GetFullPath($RepoRoot).TrimEnd('\')
  if ($actualRepo -ne $expectedRepo -or [System.IO.Path]::GetPathRoot($actualRepo) -ne 'C:\') { Fail-Fode "authoritative repository must be $expectedRepo" }
  $external = @([string]$Project.playwright.projectPath, [string]$Project.playwright.reportsPath, [string]$Project.playwright.evidenceRoot, [string]$Project.evidence.rootPath)
  foreach ($path in $external) {
    if ([string]::IsNullOrWhiteSpace($path)) { Fail-Fode 'external storage path is missing from runtime-context.json' }
    if ($path -match '^(?i)F:\\') { Fail-Fode "obsolete F: path is active: $path" }
    if ($path -notmatch '^(?i)D:\\') { Fail-Fode "external storage must be on D:: $path" }
    $full = [System.IO.Path]::GetFullPath($path).TrimEnd('\')
    if ($full.Equals($actualRepo, [System.StringComparison]::OrdinalIgnoreCase) -or $full.StartsWith($actualRepo + '\', [System.StringComparison]::OrdinalIgnoreCase)) { Fail-Fode "external path is inside the repository: $path" }
  }
  foreach ($forbidden in @('D:\FODE_Runtime_1wog', 'D:\Repos\FODE_Runtime_1wog')) {
    if (Test-Path -LiteralPath $forbidden) { Fail-Fode "active repository path is forbidden on D:: $forbidden" }
  }
  if (!(Test-Path -LiteralPath 'D:\' -PathType Container)) { Fail-Fode 'approved D: external SSD is unavailable' }
}

function Get-ToolPath {
  param([string[]]$Names)
  foreach ($name in $Names) {
    $command = Get-Command $name -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command) { return [string]$command.Source }
  }
  return ''
}

function Get-CapabilityResults {
  param([object]$Project)
  $results = [ordered]@{}
  $results.git = [bool](Get-ToolPath @('git.exe', 'git'))
  $results.node = [bool](Get-ToolPath @('node.exe', 'node'))
  $results.npm = [bool](Get-ToolPath @('npm.cmd', 'npm'))
  $results.powershell = [bool](Get-ToolPath @('pwsh.exe', 'pwsh', 'powershell.exe'))
  $results.gh = [bool](Get-ToolPath @('gh.exe', 'gh'))
  $results.ssh = [bool](Get-ToolPath @('ssh.exe', 'ssh'))
  $results.python = [bool](Get-ToolPath @('python.exe', 'python'))
  $results.py = [bool](Get-ToolPath @('py.exe', 'py'))
  $results.php = [bool](Get-ToolPath @('php.exe', 'php'))
  $results['mariadb-client'] = [bool](Get-ToolPath @('mariadb.exe', 'mysql.exe', 'mariadb', 'mysql'))
  $results['mariadb-loopback-server'] = [bool](Get-ToolPath @('mariadbd.exe', 'mysqld.exe', 'mariadbd', 'mysqld'))
  $results.clasp = Test-Path -LiteralPath 'D:\FODE_Tooling\Playwright\node_modules\.bin\clasp.cmd' -PathType Leaf
  $results['D-evidence'] = Test-Path -LiteralPath ([string]$Project.playwright.reportsPath) -PathType Container
  $results['D-restore'] = Test-Path -LiteralPath ([string]$Project.evidence.rootPath) -PathType Container
  $results['live-whoami'] = $false
  if ($Profile -eq 'staging-release') {
    $verifyRuntime = Join-Path $RepoRoot 'tools\verify-runtime.ps1'
    if (Test-Path -LiteralPath $verifyRuntime -PathType Leaf) {
      Push-Location $RepoRoot
      try {
        & $verifyRuntime -ContextPath 'runtime-context.json' *> $null
        $results['live-whoami'] = ($LASTEXITCODE -eq 0)
      } catch {
        $results['live-whoami'] = $false
      } finally {
        Pop-Location
      }
    }
  }
  if ($results.php) {
    try {
      $modules = @(php --modules 2>$null)
      $results['php-pdo'] = $modules -contains 'PDO'
      $results['php-pdo_mysql'] = ($modules -contains 'pdo_mysql') -or ($modules -contains 'mysqli')
    } catch {
      $results['php-pdo'] = $false
      $results['php-pdo_mysql'] = $false
    }
  } else {
    $results['php-pdo'] = $false
    $results['php-pdo_mysql'] = $false
  }
  return $results
}

function Get-ProfilePolicy {
  param([string]$Name, [object]$Project)
  $profile = $Project.capabilityProfiles.$Name
  if ($null -eq $profile) { Fail-Fode "capability profile is not defined: $Name" }
  return $profile
}

function Write-ContextSummary {
  param([object]$Project, [object]$Policy)
  $head = (& git -C $RepoRoot rev-parse HEAD).Trim()
  $origin = (& git -C $RepoRoot rev-parse origin/main).Trim()
  $aheadBehind = (& git -C $RepoRoot rev-list --left-right --count HEAD...origin/main).Trim().Replace("`t", '/')
  Write-Output "Repository: $RepoRoot"
  Write-Output "Baseline: HEAD=$head origin/main=$origin ahead/behind=$aheadBehind"
  Write-Output "External: D: approved; F: rejected; evidence=$($Project.playwright.reportsPath)"
  Write-Output "Profile: $Profile; DR required=$($Policy.drRequired); checkpoint=$($Policy.checkpointBoundary)"
}

function Invoke-SessionOrient {
  $sessionArgs = @('-Action', 'Orient', '-TaskLabel', "FODE $Profile")
  if ($OwnerLease) { $sessionArgs += @('-OwnerLease', $OwnerLease) }
  $output = @(& $SessionTool @sessionArgs 2>&1)
  $json = $output -join "`n"
  try { return $json | ConvertFrom-Json } catch { return $null }
}

$context = Read-Context
if ([string]$context.activeProject -ne 'FODE') { Fail-Fode 'activeProject must be FODE' }
$project = $context.projects.FODE
Assert-ApprovedStorage -Project $project
$policy = Get-ProfilePolicy -Name $Profile -Project $project

if ($Command -eq 'doctor') {
  if ($Repair) {
    foreach ($path in @([string]$project.playwright.projectPath, [string]$project.playwright.reportsPath, [string]$project.evidence.rootPath)) {
      if (!(Test-Path -LiteralPath $path -PathType Container)) { New-Item -ItemType Directory -Path $path -Force | Out-Null }
    }
  }
  $capabilities = Get-CapabilityResults -Project $project
  Write-ContextSummary -Project $project -Policy $policy
  Write-Output 'Capabilities:'
  foreach ($key in $capabilities.Keys) { Write-Output "- $($key): $($capabilities[$key])" }
  $required = @($policy.required)
  $missing = @($required | Where-Object { !$capabilities[$_] })
  if ($missing.Count -gt 0) {
    Write-Output "Doctor: required capability missing: $($missing -join ', ')"
    exit 1
  }
  Write-Output 'Doctor: PASS'
  exit 0
}

if ($Command -eq 'continue') {
  $session = Invoke-SessionOrient
  Write-ContextSummary -Project $project -Policy $policy
  if ($session) {
    if ($session.ownerLease) {
      $leaseDirectory = Split-Path -Parent $LeasePath
      if (!(Test-Path -LiteralPath $leaseDirectory -PathType Container)) { New-Item -ItemType Directory -Path $leaseDirectory -Force | Out-Null }
      Set-Content -LiteralPath $LeasePath -Value ([string]$session.ownerLease) -Encoding UTF8
    }
    Write-Output "Session: $($session.governedState)"
    if ($session.governedState -notin @('GOVERNED_SESSION_READY', 'GOVERNED_SESSION_RECOVERED')) { exit 1 }
  } else {
    Write-Output 'Session: orientation did not return structured state'
    exit 1
  }
  if ($policy.checkpointBoundary -ne 'none') { Write-Output 'Owner checkpoint: required at the single declared authority boundary' }
  else { Write-Output 'Current work: routine continuation permitted' }
  exit 0
}

if ($Command -eq 'close') {
  $diffCheck = & git -C $RepoRoot diff --check 2>&1
  if ($LASTEXITCODE -ne 0) { Fail-Fode 'git diff --check failed' }
  $status = @(& git -C $RepoRoot status --short)
  Write-ContextSummary -Project $project -Policy $policy
  if ($status.Count -gt 0) {
    Write-Output "Uncommitted work: $($status -join '; ')"
    Write-Output 'Close: BLOCKED until the current mission authorizes and records disposition of these files'
    exit 1
  }
  $closeArgs = @('-Action', 'Close')
  $closeLease = $OwnerLease
  if (!$closeLease -and (Test-Path -LiteralPath $LeasePath -PathType Leaf)) { $closeLease = (Get-Content -LiteralPath $LeasePath -Raw).Trim() }
  if ($closeLease) { $closeArgs += @('-OwnerLease', $closeLease) }
  if ($ClearPendingAcceptance) { $closeArgs += '-ClearPendingAcceptance' }
  if ($AcceptBaselineAdvance) { $closeArgs += '-AcceptBaselineAdvance' }
  $closeOutput = @(& $SessionTool @closeArgs 2>&1)
  $closeText = $closeOutput -join "`n"
  Write-Output $closeText
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  if (Test-Path -LiteralPath $LeasePath -PathType Leaf) { Remove-Item -LiteralPath $LeasePath -Force }
  Write-Output 'Close: PASS'
  exit 0
}

Fail-Fode "unsupported command: $Command"
