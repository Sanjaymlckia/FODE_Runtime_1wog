param(
  [string]$RepoRoot = "D:\Repos\FODE_Runtime_1wog",
  [string]$ExpectedHead = "",
  [string[]]$AllowedChangedFiles = @(),
  [int]$ExpectedLatestAppsScriptVersion = 0,
  [string]$ExpectedAdminDeploymentId = "",
  [int]$ExpectedAdminDeploymentVersion = 0,
  [string]$ExpectedStudentDeploymentId = "",
  [int]$ExpectedStudentDeploymentVersion = 0
)

$ErrorActionPreference = "Stop"
$Failures = New-Object System.Collections.Generic.List[string]
$RuntimeFiles = @(
  "Admin.js",
  "AdminUI_OpsApplicantQueue.html",
  "AdminUI_OpsCommunications.html",
  "AdminUI_OpsLifecycle.html",
  "AdminUI_SharedRowFacts.html",
  "AdminUI.html",
  "appsscript.json",
  "Code.js",
  "Config.js",
  "Routes.js",
  "Utils.js",
  "whoami_admin.html"
)

function Add-Fail {
  param([string]$Message)
  $script:Failures.Add($Message) | Out-Null
  Write-Host "FAIL: $Message" -ForegroundColor Red
}

function Add-Pass {
  param([string]$Message)
  Write-Host "PASS: $Message" -ForegroundColor Green
}

try {
  $resolvedExpected = [System.IO.Path]::GetFullPath($RepoRoot).TrimEnd("\")
  $resolvedActual = [System.IO.Path]::GetFullPath(((& git rev-parse --show-toplevel).Trim())).TrimEnd("\")
  if ($resolvedActual -ne $resolvedExpected) { Add-Fail "repo root expected '$resolvedExpected' got '$resolvedActual'" }
  else { Add-Pass "authoritative repo root" }
} catch {
  Add-Fail "unable to resolve repo root: $($_.Exception.Message)"
}

$branch = (& git branch --show-current).Trim()
if ($branch -ne "main") { Add-Fail "branch expected main got $branch" } else { Add-Pass "branch main" }

$head = (& git rev-parse --short HEAD).Trim()
if ($ExpectedHead -and !$head.StartsWith($ExpectedHead, [System.StringComparison]::OrdinalIgnoreCase)) {
  Add-Fail "HEAD expected $ExpectedHead got $head"
} else {
  Add-Pass "HEAD $head"
}

$statusPaths = @(& git status --porcelain=v1 | ForEach-Object { $_.Substring(3).Replace("\", "/") })
$allowed = @($AllowedChangedFiles |
  ForEach-Object { $_ -split "," } |
  ForEach-Object { $_.Trim().Replace("\", "/") } |
  Where-Object { $_ })
$unexpected = @($statusPaths | Where-Object { $allowed -notcontains $_ })
if ($unexpected.Count -gt 0) {
  Add-Fail "unexpected changed files: $($unexpected -join ', ')"
} elseif ($statusPaths.Count -eq 0) {
  Add-Pass "working tree clean"
} else {
  Add-Pass "working tree changes limited to allowed files"
}

$claspIgnorePath = Join-Path $resolvedExpected ".claspignore"
if (!(Test-Path -LiteralPath $claspIgnorePath)) {
  Add-Fail ".claspignore missing"
} else {
  $allowlist = @(Get-Content -LiteralPath $claspIgnorePath |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ -match '^![^*]' } |
    ForEach-Object { $_.Substring(1) } |
    Sort-Object)
  if (Compare-Object -ReferenceObject @($RuntimeFiles | Sort-Object) -DifferenceObject $allowlist) {
    Add-Fail ".claspignore runtime allowlist does not match the expected 12 files"
  } else {
    Add-Pass ".claspignore allowlist is exactly 12 runtime files"
  }
}

if ($ExpectedLatestAppsScriptVersion -gt 0) {
  $versions = @(& clasp.cmd versions)
  $latest = $versions | Where-Object { $_ -match '^\d+\s+-\s+' } | ForEach-Object {
    if ($_ -match '^(\d+)\s+-\s+') { [int]$Matches[1] }
  } | Sort-Object -Descending | Select-Object -First 1
  if ($latest -ne $ExpectedLatestAppsScriptVersion) {
    Add-Fail "latest Apps Script version expected $ExpectedLatestAppsScriptVersion got $latest"
  } else {
    Add-Pass "latest Apps Script version $latest"
  }
}

if ($ExpectedAdminDeploymentId -or $ExpectedStudentDeploymentId) {
  $deployments = @(& clasp.cmd deployments)
  foreach ($target in @(
    @{ Name = "Admin"; Id = $ExpectedAdminDeploymentId; Version = $ExpectedAdminDeploymentVersion },
    @{ Name = "Student"; Id = $ExpectedStudentDeploymentId; Version = $ExpectedStudentDeploymentVersion }
  )) {
    if (!$target.Id) { continue }
    $line = $deployments | Where-Object { $_ -match [regex]::Escape($target.Id) } | Select-Object -First 1
    if (!$line) {
      Add-Fail "$($target.Name) deployment ID not found"
    } elseif ($target.Version -gt 0 -and $line -notmatch "@$($target.Version)\b") {
      Add-Fail "$($target.Name) deployment expected @$($target.Version): $line"
    } else {
      Add-Pass "$($target.Name) deployment metadata: $line"
    }
  }
}

Write-Host ""
Write-Host "Failures: $($Failures.Count)"
if ($Failures.Count -gt 0) {
  Write-Host "RELEASE PREFLIGHT FAIL" -ForegroundColor Red
  exit 1
}

Write-Host "RELEASE PREFLIGHT PASS" -ForegroundColor Green
exit 0
