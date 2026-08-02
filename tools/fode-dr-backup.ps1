param(
  [string]$RepoRoot = "C:\Repos\FODE_Runtime_1wog",
  [string]$BackupRoot = "D:\FODE_DR_Backup\R401_745b698_20260801",
  [ValidateSet("Plan", "RepoSnapshot", "AppsScriptManifest", "SheetExportPlan", "DriveInventoryPlan", "ApplicantDocumentInventoryPlan", "ArchivePlaywrightReports")]
  [string]$Mode = "Plan",
  [switch]$Execute,
  [string]$PlaywrightReportPath = ""
)

$ErrorActionPreference = "Stop"

function Fail-Dr {
  param([string]$Message)
  Write-Host "FAIL: $Message" -ForegroundColor Red
  exit 1
}

function Ensure-Dir {
  param([string]$Path)
  if (!(Test-Path -LiteralPath $Path -PathType Container)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

function Git-Text {
  param([string[]]$Args)
  Push-Location -LiteralPath $RepoRoot
  try {
    $out = & git @Args 2>$null
    if ($LASTEXITCODE -ne 0) { return "" }
    return ($out -join "`n").Trim()
  } finally {
    Pop-Location
  }
}

function Resolve-ApprovedBackupRoot {
  param([string]$Path, [string]$AuthoritativeRepo)
  if ([string]::IsNullOrWhiteSpace($Path)) { Fail-Dr "BackupRoot is empty or ambiguous." }
  try { $resolved = [System.IO.Path]::GetFullPath($Path).TrimEnd("\") } catch { Fail-Dr "BackupRoot cannot be resolved: $Path" }
  if ($resolved -match '^(?i)F:\\') { Fail-Dr "The obsolete F: backup target is rejected: $resolved" }
  $repoPrefix = $AuthoritativeRepo.TrimEnd("\") + "\"
  if ($resolved.Equals($AuthoritativeRepo, [System.StringComparison]::OrdinalIgnoreCase) -or $resolved.StartsWith($repoPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    Fail-Dr "BackupRoot must not be inside the authoritative repository: $resolved"
  }
  if ([System.IO.Path]::GetPathRoot($resolved) -ne "D:\") { Fail-Dr "BackupRoot must be on the approved D: volume: $resolved" }
  if (!(Test-Path -LiteralPath "D:\" -PathType Container)) { Fail-Dr "Approved D: backup volume is unavailable." }
  $approved = "D:\FODE_DR_Backup\R401_745b698_20260801"
  if (!$resolved.Equals($approved, [System.StringComparison]::OrdinalIgnoreCase) -and !$resolved.StartsWith($approved + "\", [System.StringComparison]::OrdinalIgnoreCase)) {
    Fail-Dr "BackupRoot is outside the approved R401 backup target: $resolved"
  }
  return $resolved
}

$repoResolved = [System.IO.Path]::GetFullPath($RepoRoot).TrimEnd("\")
if (!(Test-Path -LiteralPath $repoResolved -PathType Container)) {
  Fail-Dr "RepoRoot not found: $repoResolved"
}
$backupResolved = Resolve-ApprovedBackupRoot -Path $BackupRoot -AuthoritativeRepo $repoResolved
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logPath = Join-Path $backupResolved "logs\fode_dr_backup_$timestamp.log"

if ($Mode -match "Plan$") {
  Write-Host "FODE DR backup tool"
  Write-Host "Mode: $Mode"
  Write-Host "Execute: $Execute"
  Write-Host "RepoRoot: $repoResolved"
  Write-Host "BackupRoot: $backupResolved"
  if ($Mode -eq "Plan") {
    Write-Host "Available modes:"
    Write-Host "- RepoSnapshot: create timestamped ZIP of repo source when -Execute is supplied."
    Write-Host "- AppsScriptManifest: write deployment/source metadata manifest when -Execute is supplied."
    Write-Host "- SheetExportPlan: print required Sheet exports; does not export."
    Write-Host "- DriveInventoryPlan: print required Drive inventory fields; does not read/copy Drive."
    Write-Host "- ApplicantDocumentInventoryPlan: print applicant document inventory schema; does not read/copy Drive."
    Write-Host "- ArchivePlaywrightReports: copy one explicit report folder when -Execute and -PlaywrightReportPath are supplied."
  } elseif ($Mode -eq "SheetExportPlan") {
    Write-Host "Sheet export plan only. No Sheets API calls are made."
    Write-Host "- Export production/staging main spreadsheet tabs to XLSX/CSV."
    Write-Host "- Export portal log spreadsheet."
    Write-Host "- Export portal secrets spreadsheet to protected/encrypted storage only."
    Write-Host "- Keep daily 30 days, weekly 12 weeks, monthly 24 months."
  } elseif ($Mode -eq "DriveInventoryPlan") {
    Write-Host "Drive inventory plan only. No Drive API calls are made."
    Write-Host "- Inventory applicant root/year folders."
    Write-Host "- Record applicant folder ID, name, webViewLink, file count, source original count, FODE_PREVIEW count, missing preview count."
    Write-Host "- Do not copy files in this mode."
  } elseif ($Mode -eq "ApplicantDocumentInventoryPlan") {
    Write-Host "Applicant document inventory plan only. No Drive or Sheet calls are made."
    Write-Host "- Schema: ApplicantID, Folder_Url, sourceField, itemIndex, fileName, mimeType, sizeBytes, modifiedTime, previewExists, statusField, commentField."
    Write-Host "- Use configured DOC_FIELDS only."
    Write-Host "- Validate file belongs to applicant folder before reporting."
  }
  exit 0
}

Ensure-Dir $backupResolved
Ensure-Dir (Join-Path $backupResolved "logs")

function Write-Log {
  param([string]$Message)
  $Message | Tee-Object -FilePath $logPath -Append
}

Write-Log "FODE DR backup tool"
Write-Log "Mode: $Mode"
Write-Log "Execute: $Execute"
Write-Log "RepoRoot: $repoResolved"
Write-Log "BackupRoot: $backupResolved"

if (!$Execute -and $Mode -notmatch "Plan$") {
  Write-Log "DRY RUN ONLY. Add -Execute to perform local file operations for supported modes."
}

if ($Mode -eq "RepoSnapshot") {
  $targetDir = Join-Path $backupResolved "source_repo_snapshots"
  Ensure-Dir $targetDir
  $commit = Git-Text @("rev-parse", "--short", "HEAD")
  $zip = Join-Path $targetDir ("fode_runtime_repo_{0}_{1}.zip" -f $timestamp, $commit)
  Write-Log "Repo snapshot target: $zip"
  if ($Execute) {
    Compress-Archive -Path (Join-Path $repoResolved "*") -DestinationPath $zip -Force
    Write-Log "PASS: repo snapshot created"
  }
  exit 0
}

if ($Mode -eq "AppsScriptManifest") {
  $targetDir = Join-Path $backupResolved "apps_script_manifests"
  Ensure-Dir $targetDir
  $manifest = [ordered]@{
    generatedAt = (Get-Date).ToString("o")
    commit = Git-Text @("log", "-1", "--oneline")
    status = Git-Text @("status", "-sb")
    scriptId = ""
    configIdentity = ""
    note = "Local metadata manifest only. Does not run clasp push/version/deploy."
  }
  $claspPath = Join-Path $repoResolved ".clasp.json"
  if (Test-Path -LiteralPath $claspPath -PathType Leaf) {
    $manifest.scriptId = [string]((Get-Content -LiteralPath $claspPath -Raw | ConvertFrom-Json).scriptId)
  }
  $config = Get-Content -LiteralPath (Join-Path $repoResolved "Config.js") -Raw
  $version = [regex]::Match($config, 'VERSION\s*:\s*"([^"]+)"').Groups[1].Value
  $deploy = [regex]::Match($config, 'DEPLOY_VERSION_NUMBER\s*:\s*(\d+)').Groups[1].Value
  $manifest.configIdentity = "$version / $deploy"
  $target = Join-Path $targetDir ("apps_script_manifest_{0}.json" -f $timestamp)
  Write-Log "Apps Script manifest target: $target"
  if ($Execute) {
    $manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $target -Encoding UTF8
    Write-Log "PASS: Apps Script manifest written"
  }
  exit 0
}

if ($Mode -eq "ArchivePlaywrightReports") {
  if (!$PlaywrightReportPath) { Fail-Dr "PlaywrightReportPath is required for ArchivePlaywrightReports" }
  $source = [System.IO.Path]::GetFullPath($PlaywrightReportPath).TrimEnd("\")
  if (!(Test-Path -LiteralPath $source -PathType Container)) { Fail-Dr "Report folder not found: $source" }
  if (!$source.StartsWith("D:\FODE_Test_Evidence", [System.StringComparison]::OrdinalIgnoreCase)) {
    Fail-Dr "Report path must be under D:\FODE_Test_Evidence"
  }
  $targetDir = Join-Path $backupResolved "playwright_acceptance_reports"
  Ensure-Dir $targetDir
  $target = Join-Path $targetDir (Split-Path -Leaf $source)
  Write-Log "Archive source: $source"
  Write-Log "Archive target: $target"
  if ($Execute) {
    Copy-Item -LiteralPath $source -Destination $target -Recurse -Force
    Write-Log "PASS: Playwright report archived"
  }
  exit 0
}
