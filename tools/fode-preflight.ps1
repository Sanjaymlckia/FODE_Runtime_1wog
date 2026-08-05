param(
  [switch]$FastR411
)

$ErrorActionPreference = "Continue"
$script:Failed = $false
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path

function Invoke-FodeStep {
  param(
    [string]$Name,
    [scriptblock]$Command
  )
  Write-Host "RUN: $Name"
  try {
    & $Command
    $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { $LASTEXITCODE }
    if ($exitCode -ne 0) {
      Write-Host "FAIL: $Name ($exitCode)" -ForegroundColor Red
      $script:Failed = $true
    } else {
      Write-Host "PASS: $Name" -ForegroundColor Green
    }
  } catch {
    Write-Host "FAIL: $Name - $($_.Exception.Message)" -ForegroundColor Red
    $script:Failed = $true
  }
}

Set-Location -LiteralPath $repoRoot
if ($FastR411) {
  Write-Host "FODE FAST RELEASE PREFLIGHT (R411)"
  Invoke-FodeStep "node --check Admin.js" { & node --check Admin.js }
  Invoke-FodeStep "node tests\\r411-admin-route-binding.test.js" { & node tests\r411-admin-route-binding.test.js }
  Invoke-FodeStep "node tests\\admin-review-workspace-v2-surface.test.js" { & node tests\admin-review-workspace-v2-surface.test.js }
  Invoke-FodeStep "node tests\\r410-actionability-gallery.test.js" { & node tests\r410-actionability-gallery.test.js }
  Invoke-FodeStep "Preview contract" { Push-Location tools\eduops-snapshot-capture; try { & npm.cmd run test:contract } finally { Pop-Location } }
  Invoke-FodeStep "R410 responsive Preview browser" { Push-Location tools\eduops-snapshot-capture; try { & node tests\r410-actionability-gallery.browser.test.js } finally { Pop-Location } }
  Invoke-FodeStep "git diff --check" { & git diff --check }
  if ($script:Failed) { Write-Host "FODE FAST RELEASE PREFLIGHT FAIL" -ForegroundColor Red; exit 1 }
  Write-Host "R411C_FAST_PREFLIGHT_PASS" -ForegroundColor Green
  exit 0
}
Write-Host "Permanent Admin surface tests:"
Write-Host "  Operations Workbench: tests\admin-ui-actionability-dashboard-surface.test.js"
Write-Host "  Operator Acceptance: tests\admin-operator-scenario-contract.test.js"
Write-Host "  Review Workspace: tests\admin-review-workspace-ux-surface.test.js"
Write-Host "  Communications Activity: tests\admin-ui-actionability-dashboard-surface.test.js"
Write-Host "  Population Ledger: tests\admin-population-ledger.test.js; tests\admin-population-ledger-authority.test.js"
Invoke-FodeStep "bootstrap" { & (Join-Path $PSScriptRoot "fode-bootstrap.ps1") }
Invoke-FodeStep "git status -sb" { & git status -sb }
Invoke-FodeStep "node --check Admin.js" { & node --check Admin.js }
Invoke-FodeStep "node tests\admin-ui-actionability-dashboard-surface.test.js" { & node tests\admin-ui-actionability-dashboard-surface.test.js }
Invoke-FodeStep "node tests\admin-operator-scenario-contract.test.js" { & node tests\admin-operator-scenario-contract.test.js }
Invoke-FodeStep "node tests\admin-review-workspace-ux-surface.test.js" { & node tests\admin-review-workspace-ux-surface.test.js }
Invoke-FodeStep "node tests\admin-population-ledger.test.js" { & node tests\admin-population-ledger.test.js }
Invoke-FodeStep "node tests\admin-population-ledger-authority.test.js" { & node tests\admin-population-ledger-authority.test.js }
Invoke-FodeStep "tools\rep-validate-context.ps1" { & (Join-Path $PSScriptRoot "rep-validate-context.ps1") }
Invoke-FodeStep "git diff --check" { & git diff --check }

$staged = & git diff --cached --name-only
if ($LASTEXITCODE -eq 0 -and $staged) {
  Invoke-FodeStep "git diff --cached --check" { & git diff --cached --check }
} else {
  Write-Host "SKIP: git diff --cached --check (no staged files)"
}

if ($script:Failed) {
  Write-Host "FODE PREFLIGHT FAIL" -ForegroundColor Red
  exit 1
}

Write-Host "FODE PREFLIGHT PASS" -ForegroundColor Green
