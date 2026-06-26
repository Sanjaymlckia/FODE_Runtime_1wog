param(
  [string]$RepoRoot = "E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog",
  [string]$BackupRoot = "F:\FODE_DR_Backup",
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

$repoResolved = [System.IO.Path]::GetFullPath($RepoRoot).TrimEnd("\")
if (!(Test-Path -LiteralPath $repoResolved -PathType Container)) {
  Fail-Dr "RepoRoot not found: $repoResolved"
}
$backupResolved = [System.IO.Path]::GetFullPath($BackupRoot).TrimEnd("\")
Ensure-Dir $backupResolved
Ensure-Dir (Join-Path $backupResolved "logs")

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logPath = Join-Path $backupResolved "logs\fode_dr_backup_$timestamp.log"

function Write-Log {
  param([string]$Message)
  $Message | Tee-Object -FilePath $logPath -Append
}

Write-Log "FODE DR backup tool"
Write-Log "Mode: $Mode"
Write-Log "Execute: $Execute"
Write-Log "RepoRoot: $repoResolved"
Write-Log "BackupRoot: $backupResolved"

if ($Mode -eq "Plan") {
  Write-Log "Available modes:"
  Write-Log "- RepoSnapshot: create timestamped ZIP of repo source when -Execute is supplied."
  Write-Log "- AppsScriptManifest: write deployment/source metadata manifest when -Execute is supplied."
  Write-Log "- SheetExportPlan: print required Sheet exports; does not export."
  Write-Log "- DriveInventoryPlan: print required Drive inventory fields; does not read/copy Drive."
  Write-Log "- ApplicantDocumentInventoryPlan: print applicant document inventory schema; does not read/copy Drive."
  Write-Log "- ArchivePlaywrightReports: copy one explicit report folder when -Execute and -PlaywrightReportPath are supplied."
  exit 0
}

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

if ($Mode -eq "SheetExportPlan") {
  Write-Log "Sheet export plan only. No Sheets API calls are made."
  Write-Log "- Export production/staging main spreadsheet tabs to XLSX/CSV."
  Write-Log "- Export portal log spreadsheet."
  Write-Log "- Export portal secrets spreadsheet to protected/encrypted storage only."
  Write-Log "- Keep daily 30 days, weekly 12 weeks, monthly 24 months."
  exit 0
}

if ($Mode -eq "DriveInventoryPlan") {
  Write-Log "Drive inventory plan only. No Drive API calls are made."
  Write-Log "- Inventory applicant root/year folders."
  Write-Log "- Record applicant folder ID, name, webViewLink, file count, source original count, FODE_PREVIEW count, missing preview count."
  Write-Log "- Do not copy files in this mode."
  exit 0
}

if ($Mode -eq "ApplicantDocumentInventoryPlan") {
  Write-Log "Applicant document inventory plan only. No Drive or Sheet calls are made."
  Write-Log "- Schema: ApplicantID, Folder_Url, sourceField, itemIndex, fileName, mimeType, sizeBytes, modifiedTime, previewExists, statusField, commentField."
  Write-Log "- Use configured DOC_FIELDS only."
  Write-Log "- Validate file belongs to applicant folder before reporting."
  exit 0
}

if ($Mode -eq "ArchivePlaywrightReports") {
  if (!$PlaywrightReportPath) { Fail-Dr "PlaywrightReportPath is required for ArchivePlaywrightReports" }
  $source = [System.IO.Path]::GetFullPath($PlaywrightReportPath).TrimEnd("\")
  if (!(Test-Path -LiteralPath $source -PathType Container)) { Fail-Dr "Report folder not found: $source" }
  if (!$source.StartsWith("F:\Playwright\fode-secure-link-diagnostic\reports", [System.StringComparison]::OrdinalIgnoreCase)) {
    Fail-Dr "Report path must be under F:\Playwright\fode-secure-link-diagnostic\reports"
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
