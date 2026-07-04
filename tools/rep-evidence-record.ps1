param(
  [string]$ContextPath = "runtime-context.json",
  [string]$Project = "",
  [string]$Profile = "health",
  [ValidateSet("PASS", "FAIL", "BLOCKED", "PLAN")]
  [string]$Status = "PLAN",
  [string]$Commit = "",
  [string]$PlaywrightReportPath = "",
  [string]$Notes = "",
  [switch]$Plan,
  [switch]$Execute
)

$ErrorActionPreference = "Stop"

if ($Plan -and $Execute) { throw "Use either -Plan or -Execute, not both." }
if (!$Plan -and !$Execute) { $Plan = $true }

if (!(Test-Path -LiteralPath $ContextPath)) {
  throw "Context file not found: $ContextPath"
}

$Context = Get-Content -LiteralPath $ContextPath -Raw | ConvertFrom-Json
if (!$Project) { $Project = [string]$Context.activeProject }
$ProjectContext = $Context.projects.$Project
if ($null -eq $ProjectContext) { throw "Project not found in context: $Project" }

if (!$Commit) {
  try { $Commit = (& git rev-parse --short HEAD).Trim() } catch { $Commit = "unknown" }
}

$timestamp = Get-Date -Format "yyyy-MM-ddTHH-mm-ss"
$runtime = [string]$ProjectContext.deployments.adminStaging.expectedRuntime
$pattern = [string]$ProjectContext.evidence.namingPattern
$name = $pattern.Replace("{timestamp}", $timestamp).Replace("{project}", $Project).Replace("{profile}", $Profile).Replace("{runtime}", $runtime).Replace("{status}", $Status)
$root = [string]$ProjectContext.evidence.releaseProofsPath
$jsonPath = Join-Path $root "$name.json"
$mdPath = Join-Path $root "$name.md"

$record = [ordered]@{
  timestamp = $timestamp
  project = $Project
  profile = $Profile
  status = $Status
  commit = $Commit
  adminRuntime = $ProjectContext.deployments.adminStaging.expectedRuntime
  adminDeploy = $ProjectContext.deployments.adminStaging.expectedDeploy
  adminAppsScriptVersion = $ProjectContext.deployments.adminStaging.expectedAppsScriptVersion
  studentRuntime = $ProjectContext.deployments.studentStaging.expectedRuntime
  studentDeploy = $ProjectContext.deployments.studentStaging.expectedDeploy
  studentAppsScriptVersion = $ProjectContext.deployments.studentStaging.expectedAppsScriptVersion
  playwrightReportPath = $PlaywrightReportPath
  notes = $Notes
  noMutationStatement = "No Apps Script push, version, deployment repin, Sheet edit, Drive edit, send, Student, Production, or OPS mutation is performed by this tool."
}

$markdown = @"
# REP Evidence Record

- Timestamp: $timestamp
- Project: $Project
- Profile: $Profile
- Status: $Status
- Commit: $Commit
- Admin runtime/deploy/platform: $($record.adminRuntime) / $($record.adminDeploy) / $($record.adminAppsScriptVersion)
- Student runtime/deploy/platform: $($record.studentRuntime) / $($record.studentDeploy) / $($record.studentAppsScriptVersion)
- Playwright report: $PlaywrightReportPath
- Notes: $Notes

$($record.noMutationStatement)
"@

Write-Host "REP Evidence Record"
Write-Host "Mode: $(if ($Execute) { 'EXECUTE' } else { 'PLAN' })"
Write-Host "JSON: $jsonPath"
Write-Host "Markdown: $mdPath"

if ($Execute) {
  if (!(Test-Path -LiteralPath $root)) {
    New-Item -ItemType Directory -Path $root -Force | Out-Null
  }
  ($record | ConvertTo-Json -Depth 8) | Set-Content -LiteralPath $jsonPath -Encoding UTF8
  $markdown | Set-Content -LiteralPath $mdPath -Encoding UTF8
  Write-Host "REP EVIDENCE WRITTEN" -ForegroundColor Green
} else {
  Write-Host "Plan only. No evidence files written."
}
