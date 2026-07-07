param(
  [Parameter(ValueFromRemainingArguments=$true)]
  [string[]]$RawArgs
)

$ErrorActionPreference = "Stop"

$Help = $false
$RepoRoot = "D:\Repos\FODE_Runtime_1wog"
$ExpectedScriptId = ""
$RemoteCheckRoot = ""
$Markers = @()
$AbsentMarkers = @()

for ($i = 0; $i -lt @($RawArgs).Count; $i++) {
  $arg = [string]$RawArgs[$i]
  switch ($arg) {
    "-Help" { $Help = $true }
    "-RepoRoot" { $i++; $RepoRoot = [string]$RawArgs[$i] }
    "-ExpectedScriptId" { $i++; $ExpectedScriptId = [string]$RawArgs[$i] }
    "-RemoteCheckRoot" { $i++; $RemoteCheckRoot = [string]$RawArgs[$i] }
    "-Markers" {
      while ($i + 1 -lt @($RawArgs).Count -and -not ([string]$RawArgs[$i + 1]).StartsWith("-")) {
        $i++
        $Markers += [string]$RawArgs[$i]
      }
    }
    "-AbsentMarkers" {
      while ($i + 1 -lt @($RawArgs).Count -and -not ([string]$RawArgs[$i + 1]).StartsWith("-")) {
        $i++
        $AbsentMarkers += [string]$RawArgs[$i]
      }
    }
    default { throw "Unknown argument: $arg" }
  }
}

function Show-Help {
  Write-Host "FODE Admin UI remote marker proof"
  Write-Host ""
  Write-Host "Usage:"
  Write-Host "  powershell -ExecutionPolicy Bypass -File tools\fode-admin-ui-remote-markers.ps1 -Markers `"Batch Communication`" `"Recipient count`" -AbsentMarkers `"Batch Communication Handoff`""
  Write-Host ""
  Write-Host "Purpose:"
  Write-Host "  Pulls Apps Script source into .release-proof and verifies AdminUI.html markers."
  Write-Host "  This is read-only proof. It does not push, version, deploy, repin, or mutate runtime data."
}

function Normalize-MarkerList {
  param([string[]]$Values)
  $out = @()
  foreach ($value in @($Values)) {
    if ($null -eq $value) { continue }
    foreach ($part in ([string]$value -split ",")) {
      $trimmed = $part.Trim()
      if ($trimmed) { $out += $trimmed }
    }
  }
  return @($out)
}

if ($Help) {
  Show-Help
  exit 0
}

$repo = (Resolve-Path -LiteralPath $RepoRoot).Path
$Markers = Normalize-MarkerList -Values $Markers
$AbsentMarkers = Normalize-MarkerList -Values $AbsentMarkers
if ($Markers.Count -eq 0 -and $AbsentMarkers.Count -eq 0) {
  throw "At least one -Markers or -AbsentMarkers value is required."
}
$contextPath = Join-Path $repo "runtime-context.json"
if (!(Test-Path -LiteralPath $contextPath -PathType Leaf)) { throw "runtime-context.json missing: $contextPath" }
$context = Get-Content -LiteralPath $contextPath -Raw | ConvertFrom-Json
$project = $context.projects.FODE
if (!$ExpectedScriptId) { $ExpectedScriptId = [string]$project.appsScript.scriptId }
if (!$ExpectedScriptId) { throw "Expected Apps Script scriptId is required." }

if (!$RemoteCheckRoot) {
  $RemoteCheckRoot = Join-Path (Join-Path $repo ".release-proof") ("admin-ui-" + (Get-Date -Format "yyyyMMddHHmmss"))
}

$resolvedRemote = [System.IO.Path]::GetFullPath($RemoteCheckRoot).TrimEnd("\")
$resolvedRepo = [System.IO.Path]::GetFullPath($repo).TrimEnd("\")
$proofRoot = [System.IO.Path]::GetFullPath((Join-Path $repo ".release-proof")).TrimEnd("\")
if (!$resolvedRemote.StartsWith($proofRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Remote proof folder must be under .release-proof: $resolvedRemote"
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

$markerResults = @()
foreach ($marker in @($Markers)) {
  $ok = $adminUi.Contains($marker)
  $markerResults += [pscustomobject]@{ Type = "PRESENT"; Marker = $marker; Pass = $ok }
}

$absentResults = @()
foreach ($marker in @($AbsentMarkers)) {
  $ok = !$adminUi.Contains($marker)
  $absentResults += [pscustomobject]@{ Type = "ABSENT"; Marker = $marker; Pass = $ok }
}

Write-Host "REMOTE PROOF PATH: $resolvedRemote"
Write-Host "REMOTE MARKER TABLE"
foreach ($row in @($markerResults + $absentResults)) {
  Write-Host ("{0,-8} {1,-5} {2}" -f $row.Type, $(if ($row.Pass) { "PASS" } else { "FAIL" }), $row.Marker)
}

$failed = @($markerResults + $absentResults | Where-Object { !$_.Pass })
if ($failed.Count -gt 0) {
  Write-Host "FAILED MARKERS: $(@($failed | ForEach-Object { $_.Marker }) -join ', ')" -ForegroundColor Red
  Write-Host "REMOTE MARKER PROOF FAIL" -ForegroundColor Red
  exit 1
}

Write-Host "REMOTE MARKER PROOF PASS" -ForegroundColor Green
exit 0
