param(
  [string]$ContextPath = "runtime-context.json",
  [string]$Project = "",
  [string]$Profile = "health"
)

$ErrorActionPreference = "Stop"

if (!(Test-Path -LiteralPath $ContextPath)) {
  throw "Context file not found: $ContextPath"
}

$Context = Get-Content -LiteralPath $ContextPath -Raw | ConvertFrom-Json
if (!$Project) { $Project = [string]$Context.activeProject }
$ProjectContext = $Context.projects.$Project
if ($null -eq $ProjectContext) { throw "Project not found in context: $Project" }

$ProfileContext = $ProjectContext.acceptanceProfiles.$Profile
if ($null -eq $ProfileContext) { throw "Acceptance profile not found for ${Project}: $Profile" }

$timestamp = Get-Date -Format "yyyy-MM-ddTHH-mm-ss"
$runtime = [string]$ProjectContext.deployments.adminStaging.expectedRuntime
$pattern = [string]$ProjectContext.evidence.namingPattern
$evidenceName = $pattern.Replace("{timestamp}", $timestamp).Replace("{project}", $Project).Replace("{profile}", $Profile).Replace("{runtime}", $runtime).Replace("{status}", "PLAN")

Write-Host "REP Acceptance Plan"
Write-Host "Project: $Project"
Write-Host "Profile: $Profile"
Write-Host "Description: $($ProfileContext.description)"
Write-Host "Repository: $($ProjectContext.repository.path)"
Write-Host "Admin whoami: $($ProjectContext.deployments.adminStaging.whoamiUrl)"
Write-Host "Student whoami: $($ProjectContext.deployments.studentStaging.whoamiUrl)"
Write-Host "Expected Admin: $($ProjectContext.deployments.adminStaging.expectedRuntime) / $($ProjectContext.deployments.adminStaging.expectedDeploy)"
Write-Host "Expected Student: $($ProjectContext.deployments.studentStaging.expectedRuntime) / $($ProjectContext.deployments.studentStaging.expectedDeploy)"
Write-Host "Playwright path: $($ProjectContext.playwright.projectPath)"
Write-Host "Reports path: $($ProjectContext.playwright.reportsPath)"
Write-Host "Evidence name: $evidenceName"
Write-Host ""
Write-Host "Checks:"
foreach ($check in @($ProfileContext.checks)) {
  Write-Host "- $check"
}
Write-Host ""
Write-Host "Plan only. No Playwright, clasp, deployment, Sheet, Drive, send, Student, Production, or OPS mutation was performed."
