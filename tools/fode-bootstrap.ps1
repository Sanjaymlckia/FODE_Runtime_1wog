param()

$ErrorActionPreference = "Stop"

function Fail-Bootstrap {
  param([string]$Message)
  Write-Host "FAIL: $Message" -ForegroundColor Red
  exit 1
}

function Require-Value {
  param(
    [object]$Value,
    [string]$Name
  )
  if ($null -eq $Value -or [string]::IsNullOrWhiteSpace([string]$Value)) {
    Fail-Bootstrap "Missing required context field: $Name"
  }
}

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$contextPath = Join-Path $repoRoot "runtime-context.json"
if (!(Test-Path -LiteralPath $contextPath -PathType Leaf)) {
  Fail-Bootstrap "runtime-context.json not found at $contextPath"
}

$context = Get-Content -LiteralPath $contextPath -Raw | ConvertFrom-Json
Require-Value $context.activeProject "activeProject"
if ($context.activeProject -ne "FODE") {
  Fail-Bootstrap "Expected activeProject FODE; got $($context.activeProject)"
}

$project = $context.projects.FODE
if ($null -eq $project) {
  Fail-Bootstrap "projects.FODE is missing"
}

Require-Value $project.repository.path "projects.FODE.repository.path"
Require-Value $project.repository.branch "projects.FODE.repository.branch"
Require-Value $project.appsScript.scriptId "projects.FODE.appsScript.scriptId"
Require-Value $project.deployments.adminStaging.deploymentId "projects.FODE.deployments.adminStaging.deploymentId"
Require-Value $project.deployments.studentStaging.deploymentId "projects.FODE.deployments.studentStaging.deploymentId"
Require-Value $project.dataSources.liveSheet.spreadsheetId "projects.FODE.dataSources.liveSheet.spreadsheetId"
Require-Value $project.playwright.projectPath "projects.FODE.playwright.projectPath"
Require-Value $project.playwright.reportsPath "projects.FODE.playwright.reportsPath"

$contextRepoPath = (Resolve-Path -LiteralPath $project.repository.path -ErrorAction Stop).Path
if ($contextRepoPath -ne $repoRoot) {
  Fail-Bootstrap "Context repo path $contextRepoPath does not match current repo $repoRoot"
}

$claspPath = Join-Path $repoRoot ".clasp.json"
if (!(Test-Path -LiteralPath $claspPath -PathType Leaf)) {
  Fail-Bootstrap ".clasp.json not found"
}
$clasp = Get-Content -LiteralPath $claspPath -Raw | ConvertFrom-Json
if ($clasp.scriptId -ne $project.appsScript.scriptId) {
  Fail-Bootstrap ".clasp.json scriptId does not match runtime-context.json"
}

$branch = (& git -C $repoRoot branch --show-current 2>$null)
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($branch)) {
  Fail-Bootstrap "Unable to read Git branch"
}
$status = (& git -C $repoRoot status -sb 2>$null)
if ($LASTEXITCODE -ne 0) {
  Fail-Bootstrap "Unable to read Git status"
}

Write-Host "FODE BOOTSTRAP PASS" -ForegroundColor Green
Write-Host "Project: FODE"
Write-Host "Repo: $repoRoot"
Write-Host "Git branch: $branch"
Write-Host "Git status: $($status -join ' | ')"
Write-Host "Apps Script scriptId: $($project.appsScript.scriptId)"
Write-Host "Admin deployment: $($project.deployments.adminStaging.deploymentId)"
Write-Host "Student deployment: $($project.deployments.studentStaging.deploymentId)"
Write-Host "Sheet ID: $($project.dataSources.liveSheet.spreadsheetId)"
Write-Host "Playwright path: $($project.playwright.projectPath)"
Write-Host "Evidence path: $($project.playwright.reportsPath)"
Write-Host "Safety: no push, no clasp push/version/repin, no Sheet/Drive/email/WhatsApp mutation"
