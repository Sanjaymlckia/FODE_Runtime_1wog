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

function Add-Fail {
  param([string]$Message)
  $script:Failures.Add($Message) | Out-Null
  Write-Host "FAIL: $Message" -ForegroundColor Red
}

function Add-Pass {
  param([string]$Message)
  Write-Host "PASS: $Message" -ForegroundColor Green
}

function Get-DeployableFilesFromClaspIgnore {
  param([string]$RepoRoot)
  $path = Join-Path $RepoRoot ".claspignore"
  if (!(Test-Path -LiteralPath $path -PathType Leaf)) { throw ".claspignore missing" }
  $files = @(Get-Content -LiteralPath $path |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ -match '^![^*]' } |
    ForEach-Object { $_.Substring(1).Replace("\", "/") } |
    Where-Object { $_ })
  return @($files | Sort-Object -Unique)
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
  $allowlist = @(Get-DeployableFilesFromClaspIgnore -RepoRoot $resolvedExpected)
  $missingLocal = @($allowlist | Where-Object { !(Test-Path -LiteralPath (Join-Path $resolvedExpected $_) -PathType Leaf) })
  if ($allowlist.Count -eq 0) {
    Add-Fail ".claspignore does not expose any deployable runtime files"
  } elseif ($missingLocal.Count -gt 0) {
    Add-Fail ".claspignore exposes missing local files: $($missingLocal -join ', ')"
  } else {
    Add-Pass ".claspignore deployable runtime files discovered: $($allowlist.Count)"
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
