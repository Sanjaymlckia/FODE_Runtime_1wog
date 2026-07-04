param()

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
Set-Location -LiteralPath $repoRoot

& (Join-Path $PSScriptRoot "fode-bootstrap.ps1")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$context = Get-Content -LiteralPath (Join-Path $repoRoot "runtime-context.json") -Raw | ConvertFrom-Json
$project = $context.projects.FODE
$commit = (& git rev-parse --short HEAD)
$branch = (& git branch --show-current)

Write-Host ""
Write-Host "FODE ADMIN STAGING RELEASE PLAN ONLY" -ForegroundColor Cyan
Write-Host "Source: $commit on $branch"
Write-Host "Admin staging deployment: $($project.deployments.adminStaging.deploymentId)"
Write-Host "Admin expected runtime: $($project.deployments.adminStaging.expectedRuntime) / $($project.deployments.adminStaging.expectedDeploy)"
Write-Host "Student staging protected: $($project.deployments.studentStaging.deploymentId) @ expected $($project.deployments.studentStaging.expectedAppsScriptVersion)"
Write-Host "Production protected: $($project.deployments.production.status)"
Write-Host "OPS protected: $($project.deployments.ops.status)"
Write-Host ""
Write-Host "Authorized release steps would be:"
Write-Host "1. Run tools\fode-preflight.ps1"
Write-Host "2. Verify Config.js release identity before any Apps Script version"
Write-Host "3. Run clasp push only after explicit release approval"
Write-Host "4. Verify remote source identity"
Write-Host "5. Create one Apps Script version only after source identity passes"
Write-Host "6. Repin Admin staging deployment only"
Write-Host "7. Run Admin whoami and Student whoami"
Write-Host "8. Run tools\fode-smoke.ps1 -Profile health and any CIS-required profiles"
Write-Host "9. Record evidence paths and rollback guidance"
Write-Host ""
Write-Host "WARNING: This script is plan-only. It does not push, version, repin, mutate data, or touch Student/Production/OPS." -ForegroundColor Yellow
