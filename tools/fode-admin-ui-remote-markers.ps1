param(
  [switch]$Help,
  [string]$RepoRoot = "D:\Repos\FODE_Runtime_1wog",
  [string]$ExpectedScriptId = "",
  [string]$RemoteCheckRoot = "",
  [string[]]$Markers = @(),
  [string[]]$AbsentMarkers = @()
)

$ErrorActionPreference = "Stop"

function Show-Help {
  Write-Host "FODE Admin UI remote marker proof"
  Write-Host ""
  Write-Host "Usage:"
  Write-Host "  powershell -ExecutionPolicy Bypass -File tools\fode-admin-ui-remote-markers.ps1 -Markers openModalLoading_,docRecommendation -AbsentMarkers not_in_loaded_review_queue"
  Write-Host ""
  Write-Host "Purpose:"
  Write-Host "  Pulls Apps Script source into a controlled external readback folder and verifies AdminUI.html markers."
  Write-Host "  This is read-only proof. It does not push, version, deploy, repin, or mutate runtime data."
}

if ($Help) {
  Show-Help
  exit 0
}

$repo = (Resolve-Path -LiteralPath $RepoRoot).Path
$contextPath = Join-Path $repo "runtime-context.json"
if (!(Test-Path -LiteralPath $contextPath -PathType Leaf)) { throw "runtime-context.json missing: $contextPath" }
$context = Get-Content -LiteralPath $contextPath -Raw | ConvertFrom-Json
$project = $context.projects.FODE
if (!$ExpectedScriptId) { $ExpectedScriptId = [string]$project.appsScript.scriptId }
if (!$ExpectedScriptId) { throw "Expected Apps Script scriptId is required." }

if (!$RemoteCheckRoot) {
  $RemoteCheckRoot = "D:\Repos\_clasp_remote_check_FODE_admin_ui_" + (Get-Date -Format "yyyyMMddHHmmss")
}

$resolvedRemote = [System.IO.Path]::GetFullPath($RemoteCheckRoot).TrimEnd("\")
$resolvedRepo = [System.IO.Path]::GetFullPath($repo).TrimEnd("\")
if ($resolvedRemote.StartsWith($resolvedRepo, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Remote proof folder must be outside repo root: $resolvedRemote"
}
if ((Split-Path -Leaf $resolvedRemote) -notlike "_clasp_remote_check_FODE*") {
  throw "Remote proof folder leaf must start with _clasp_remote_check_FODE: $resolvedRemote"
}

New-Item -ItemType Directory -Path $resolvedRemote -Force | Out-Null
Set-Content -LiteralPath (Join-Path $resolvedRemote ".clasp.json") -Value (@{
  scriptId = $ExpectedScriptId
  rootDir = "."
} | ConvertTo-Json -Compress) -Encoding UTF8

Push-Location $resolvedRemote
try {
  & clasp.cmd pull
  if ($LASTEXITCODE -ne 0) { throw "clasp pull failed with exit code $LASTEXITCODE" }
} finally {
  Pop-Location
}

$adminUiPath = Join-Path $resolvedRemote "AdminUI.html"
if (!(Test-Path -LiteralPath $adminUiPath -PathType Leaf)) { throw "Remote AdminUI.html missing from readback." }
$adminUi = Get-Content -LiteralPath $adminUiPath -Raw

$missing = @()
foreach ($marker in $Markers) {
  if (!$adminUi.Contains($marker)) { $missing += $marker }
}

$presentForbidden = @()
foreach ($marker in $AbsentMarkers) {
  if ($adminUi.Contains($marker)) { $presentForbidden += $marker }
}

Write-Host "REMOTE PROOF PATH: $resolvedRemote"
foreach ($marker in $Markers) {
  Write-Host ("MARKER " + $marker + ": " + [string]($missing -notcontains $marker))
}
foreach ($marker in $AbsentMarkers) {
  Write-Host ("ABSENT " + $marker + ": " + [string]($presentForbidden -notcontains $marker))
}

if ($missing.Count -gt 0 -or $presentForbidden.Count -gt 0) {
  if ($missing.Count -gt 0) { Write-Host "MISSING: $($missing -join ', ')" -ForegroundColor Red }
  if ($presentForbidden.Count -gt 0) { Write-Host "FORBIDDEN PRESENT: $($presentForbidden -join ', ')" -ForegroundColor Red }
  Write-Host "REMOTE MARKER PROOF FAIL" -ForegroundColor Red
  exit 1
}

Write-Host "REMOTE MARKER PROOF PASS" -ForegroundColor Green
exit 0
