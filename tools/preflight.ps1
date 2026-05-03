param()

$ErrorActionPreference = "Stop"

$ExpectedRoot = "E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Runtime_1wog"
$Failures = New-Object System.Collections.Generic.List[string]
$Warnings = New-Object System.Collections.Generic.List[string]

function Add-Fail {
  param([string]$Message)
  $script:Failures.Add($Message) | Out-Null
  Write-Host "FAIL: $Message" -ForegroundColor Red
}

function Add-Warn {
  param([string]$Message)
  $script:Warnings.Add($Message) | Out-Null
  Write-Host "WARN: $Message" -ForegroundColor Yellow
}

function Add-Pass {
  param([string]$Message)
  Write-Host "PASS: $Message" -ForegroundColor Green
}

function Invoke-Checked {
  param(
    [string]$Label,
    [string]$FilePath,
    [string[]]$Arguments
  )
  Write-Host "RUN: $Label"
  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    Add-Fail "$Label failed with exit code $LASTEXITCODE"
  } else {
    Add-Pass "$Label"
  }
}

try {
  $RepoRoot = (& git rev-parse --show-toplevel).Trim() -replace "/", "\"
  if ($RepoRoot -ne $ExpectedRoot) {
    Add-Fail "repo root mismatch: expected '$ExpectedRoot', got '$RepoRoot'"
  } else {
    Add-Pass "repo root is authoritative"
  }
} catch {
  Add-Fail "unable to resolve git repo root: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "Git status:"
$Status = @(& git status --porcelain=v1)
& git status -sb

foreach ($line in $Status) {
  $path = $line.Substring(3)
  if ($path -eq "appsscript.json" -or $path -eq ".clasp.json") {
    if ($line.Substring(0, 2).Trim()) {
      Add-Fail "restricted file has git status '$($line.Substring(0,2))': $path"
    }
  }
  if ($path -match '^FODE_.*AUDIT.*\.md$' -and $line.StartsWith("??")) {
    Add-Warn "untracked audit doc present: $path"
  }
}

try {
  $Config = Get-Content -LiteralPath "Config.js" -Raw
  $VersionMatch = [regex]::Match($Config, 'VERSION\s*:\s*"([^"]+)"')
  $DeployMatch = [regex]::Match($Config, 'DEPLOY_VERSION_NUMBER\s*:\s*(\d+)')
  if (!$VersionMatch.Success) { Add-Fail "CONFIG.VERSION not found" }
  if (!$DeployMatch.Success) { Add-Fail "CONFIG.DEPLOY_VERSION_NUMBER not found" }
  if ($VersionMatch.Success -and $DeployMatch.Success) {
    $Version = $VersionMatch.Groups[1].Value
    $DeployVersion = [int]$DeployMatch.Groups[1].Value
    if ($Version -ne ("r" + $DeployVersion)) {
      Add-Fail "version contract mismatch: VERSION=$Version DEPLOY_VERSION_NUMBER=$DeployVersion"
    } else {
      Add-Pass "version contract: $Version / $DeployVersion"
    }
  }

  $FlagChecks = @(
    @{ Name = "DAILY_SEND_CAP"; Pattern = 'DAILY_SEND_CAP\s*:\s*500\b' },
    @{ Name = "ENABLE_AUTOMATED_STAGE_RUNNER"; Pattern = 'ENABLE_AUTOMATED_STAGE_RUNNER\s*:\s*false\b' },
    @{ Name = "ENABLE_FODE_CRM_PIPELINE"; Pattern = 'ENABLE_FODE_CRM_PIPELINE\s*:\s*false\b' },
    @{ Name = "CRM_PUSH_DRY_RUN"; Pattern = 'CRM_PUSH_DRY_RUN\s*:\s*true\b' }
  )
  foreach ($check in $FlagChecks) {
    if ($Config -match $check.Pattern) {
      Add-Pass "critical flag $($check.Name)"
    } else {
      Add-Fail "critical flag mismatch: $($check.Name)"
    }
  }
} catch {
  Add-Fail "Config.js contract check failed: $($_.Exception.Message)"
}

Write-Host ""
Invoke-Checked "node --check Code.js" "node" @("--check", "Code.js")
Invoke-Checked "node --check Admin.js" "node" @("--check", "Admin.js")
Invoke-Checked "node --check Utils.js" "node" @("--check", "Utils.js")
Invoke-Checked "node --check Config.js" "node" @("--check", "Config.js")

Write-Host ""
Invoke-Checked "git diff --check" "git" @("diff", "--check")

Write-Host ""
Write-Host "Canonical URL hygiene:"
$CanonicalFiles = @("CURRENT_TASK.md", "KNOWN_GOOD_STATE.md", "LIVE_URLS.md", "Config.js")
foreach ($file in $CanonicalFiles) {
  if (!(Test-Path -LiteralPath $file)) {
    Add-Warn "canonical scan skipped missing file: $file"
    continue
  }
  $text = Get-Content -LiteralPath $file -Raw
  if ($text -match "/a/macros/") {
    Add-Fail "deprecated /a/macros/ URL found in $file"
  } else {
    Add-Pass "canonical URL scan: $file"
  }
}

Write-Host ""
Write-Host "Identity-source scan:"
$Remaining = @(& rg -n "getActiveUserEmail_\(\)" Admin.js Code.js)
if ($Remaining.Count -gt 0) {
  Write-Host "Remaining getActiveUserEmail_ call sites:"
  $Remaining | ForEach-Object { Write-Host "  $_" }
} else {
  Add-Pass "no remaining getActiveUserEmail_ call sites"
}

$TargetChecks = @(
  @{ File = "Admin.js"; Function = "admin_getApplicantDetail"; Required = "getCallerEmail_()" },
  @{ File = "Admin.js"; Function = "admin_resetPortalLink"; Required = "getCallerEmail_()" },
  @{ File = "Admin.js"; Function = "admin_updateDocStatuses_impl_"; Required = "getCallerEmail_()" },
  @{ File = "Admin.js"; Function = "admin_setOverallStatus"; Required = "getCallerEmail_()" },
  @{ File = "Admin.js"; Function = "admin_setPortalAccess"; Required = "getCallerEmail_()" },
  @{ File = "Admin.js"; Function = "admin_sendDocsFollowupEmails"; Required = "getCallerEmail_()" },
  @{ File = "Admin.js"; Function = "admin_updateParentEmailCorrected"; Required = "getCallerEmail_()" },
  @{ File = "Admin.js"; Function = "admin_backfillPortalTokens"; Required = "getCallerEmail_()" },
  @{ File = "Admin.js"; Function = "admin_exportPortalLinksCsv"; Required = "getCallerEmail_()" },
  @{ File = "Admin.js"; Function = "admin_runBounceScan"; Required = "getCallerEmail_()" },
  @{ File = "Admin.js"; Function = "admin_previewStageBatch"; Required = "getCallerEmail_()" },
  @{ File = "Admin.js"; Function = "admin_sendStageBatch"; Required = "getCallerEmail_()" },
  @{ File = "Admin.js"; Function = "admin_previewApplicantMessage"; Required = "getCallerEmail_()" },
  @{ File = "Admin.js"; Function = "admin_sendApplicantMessage"; Required = "getCallerEmail_()" },
  @{ File = "Code.js"; Function = "admin_getApplicantCommDerived_json"; Required = "getCallerEmail_()" }
)

foreach ($target in $TargetChecks) {
  $content = Get-Content -LiteralPath $target.File -Raw
  $pattern = "function\s+$([regex]::Escape($target.Function))\s*\("
  $match = [regex]::Match($content, $pattern)
  if (!$match.Success) {
    Add-Fail "identity target missing: $($target.File) $($target.Function)"
    continue
  }
  $next = [regex]::Match($content.Substring($match.Index + 1), "\nfunction\s+[A-Za-z0-9_]+\s*\(")
  $end = if ($next.Success) { $match.Index + 1 + $next.Index } else { $content.Length }
  $body = $content.Substring($match.Index, $end - $match.Index)
  if ($body -notmatch [regex]::Escape($target.Required)) {
    Add-Fail "identity target reverted or missing getCallerEmail_: $($target.File) $($target.Function)"
  } elseif ($body -match "getActiveUserEmail_\(\)" -and $target.Function -ne "admin_getApplicantCommDerived_json") {
    Add-Fail "identity target still calls getActiveUserEmail_: $($target.File) $($target.Function)"
  } else {
    Add-Pass "identity target normalized: $($target.Function)"
  }
}

Write-Host ""
Write-Host "Summary:"
Write-Host "Warnings: $($Warnings.Count)"
Write-Host "Failures: $($Failures.Count)"

if ($Failures.Count -gt 0) {
  Write-Host "PREFLIGHT FAIL" -ForegroundColor Red
  exit 1
}

Write-Host "PREFLIGHT PASS" -ForegroundColor Green
exit 0
