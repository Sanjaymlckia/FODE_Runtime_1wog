param(
  [ValidateSet("health", "hydration", "operations", "review", "communications", "ledger", "surfaces", "all")]
  [string]$Profile = "health"
)

$ErrorActionPreference = "Continue"
$script:Failed = $false
$script:Skipped = @()
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
Set-Location -LiteralPath $repoRoot

function Fail-Smoke {
  param([string]$Message)
  Write-Host "FAIL: $Message" -ForegroundColor Red
  $script:Failed = $true
}

function Get-NewReports {
  param(
    [string]$ReportRoot,
    [datetime]$StartedAt
  )
  if (!(Test-Path -LiteralPath $ReportRoot -PathType Container)) { return @() }
  return @(Get-ChildItem -LiteralPath $ReportRoot -Directory |
    Where-Object { $_.LastWriteTime -ge $StartedAt.AddSeconds(-2) } |
    Sort-Object LastWriteTime |
    ForEach-Object { Join-Path $_.FullName "RUN_SUMMARY.md" } |
    Where-Object { Test-Path -LiteralPath $_ -PathType Leaf })
}

function Invoke-NodeSmoke {
  param(
    [string]$Name,
    [string[]]$Tests
  )
  Write-Host "RUN: $Name surface smoke"
  foreach ($test in $Tests) {
    if (!(Test-Path -LiteralPath $test -PathType Leaf)) {
      Fail-Smoke "$Name smoke missing permanent test: $test"
      continue
    }
    Write-Host "RUN: node $test"
    & node $test
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
      Fail-Smoke "$Name smoke failed at $test ($exitCode)"
      return
    }
  }
}

function Invoke-SurfaceSmoke {
  param([string]$Name)
  if ($Name -eq "operations") {
    Invoke-NodeSmoke "operations" @("tests\admin-ui-actionability-dashboard-surface.test.js")
  } elseif ($Name -eq "review") {
    Invoke-NodeSmoke "review" @("tests\admin-review-workspace-ux-surface.test.js")
  } elseif ($Name -eq "communications") {
    Invoke-NodeSmoke "communications" @("tests\admin-ui-actionability-dashboard-surface.test.js", "tests\admin-review-workspace-ux-surface.test.js")
  } elseif ($Name -eq "ledger") {
    Invoke-NodeSmoke "ledger" @("tests\admin-population-ledger.test.js", "tests\admin-population-ledger-authority.test.js")
  } elseif ($Name -eq "surfaces") {
    Invoke-SurfaceSmoke "operations"
    Invoke-SurfaceSmoke "review"
    Invoke-SurfaceSmoke "communications"
    Invoke-SurfaceSmoke "ledger"
  }
}

& (Join-Path $PSScriptRoot "fode-bootstrap.ps1")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$context = Get-Content -LiteralPath (Join-Path $repoRoot "runtime-context.json") -Raw | ConvertFrom-Json
$project = $context.projects.FODE
$admin = $project.deployments.adminStaging
$reportRoot = $project.playwright.reportsPath
$playwrightRoot = $project.playwright.projectPath
$proof = Join-Path $PSScriptRoot "fode-staging-health-proof.ps1"

$profiles = if ($Profile -eq "all") { @("health", "hydration", "operations", "review", "communications", "ledger") } else { @($Profile) }
$evidence = @()

foreach ($item in $profiles) {
  if (@("review", "communications", "ledger", "surfaces") -contains $item) {
    Invoke-SurfaceSmoke $item
    continue
  }

  if ($item -eq "operations") {
    Invoke-SurfaceSmoke "operations"
    $operationSpecs = @(
      "specs/fode-operations-workspace-smoke.spec.ts",
      "specs/fode-admin-operations-workspace.spec.ts",
      "specs/fode-ops-worklist.spec.ts"
    ) | ForEach-Object { Join-Path $playwrightRoot $_ }
    $existing = @($operationSpecs | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf })
    if ($existing.Count -eq 0) {
      $message = "operations profile skipped: no permanent Operations Workspace smoke spec found; temporary specs require explicit request"
      Write-Host "SKIP: $message" -ForegroundColor Yellow
      $script:Skipped += $message
      continue
    }
    Write-Host "RUN: operations -> $($existing[0])"
    $startedAt = Get-Date
    Push-Location -LiteralPath $playwrightRoot
    & npx.cmd playwright test $existing[0] --project=chromium
    $exitCode = $LASTEXITCODE
    Pop-Location
    if ($exitCode -ne 0) {
      Fail-Smoke "operations smoke failed ($exitCode)"
    } else {
      $evidence += Get-NewReports -ReportRoot $reportRoot -StartedAt $startedAt
    }
    continue
  }

  $mode = if ($item -eq "hydration") { "hydration60" } else { "health" }
  Write-Host "RUN: $item -> fode-staging-health-proof.ps1 -Mode $mode"
  $startedAt = Get-Date
  & $proof -AdminUrl $admin.url -ExpectedRuntime $admin.expectedRuntime -ExpectedDeploy ([int]$admin.expectedDeploy) -ReportRoot $reportRoot -Mode $mode -Strict
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) {
    Fail-Smoke "$item smoke failed ($exitCode)"
  } else {
    $evidence += Get-NewReports -ReportRoot $reportRoot -StartedAt $startedAt
  }
}

Write-Host ""
Write-Host "FODE SMOKE SUMMARY"
foreach ($path in ($evidence | Select-Object -Unique)) {
  Write-Host "EVIDENCE: $path"
}
foreach ($skip in $script:Skipped) {
  Write-Host "SKIPPED: $skip" -ForegroundColor Yellow
}

if ($script:Failed) {
  Write-Host "FODE SMOKE FAIL" -ForegroundColor Red
  exit 1
}

Write-Host "FODE SMOKE PASS" -ForegroundColor Green
