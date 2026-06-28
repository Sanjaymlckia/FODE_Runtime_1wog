param(
  [string]$RepoRoot = "D:\Repos\FODE_Runtime_1wog",
  [string]$BackupRoot = "F:\FODE_DR_Backup",
  [switch]$IncludeClaspDeployments
)

$ErrorActionPreference = "Stop"

$Folders = @(
  "source_repo_snapshots",
  "apps_script_manifests",
  "sheet_exports",
  "drive_inventory_reports",
  "applicant_document_inventory",
  "playwright_acceptance_reports",
  "release_proofs",
  "restore_drills",
  "manifests",
  "logs"
)

function Fail-Dr {
  param([string]$Message)
  Write-Host "FAIL: $Message" -ForegroundColor Red
  exit 1
}

function Read-Text {
  param([string]$Path)
  if (!(Test-Path -LiteralPath $Path -PathType Leaf)) { return "" }
  return Get-Content -LiteralPath $Path -Raw
}

function Match-Value {
  param([string]$Text, [string]$Pattern)
  $m = [regex]::Match($Text, $Pattern)
  if ($m.Success) { return $m.Groups[1].Value }
  return ""
}

function Git-Line {
  param([string[]]$GitArgs)
  Push-Location -LiteralPath $RepoRoot
  try {
    $output = & git @GitArgs 2>$null
    if ($LASTEXITCODE -ne 0) { return "" }
    return ($output -join "`n").Trim()
  } finally {
    Pop-Location
  }
}

$repoResolved = [System.IO.Path]::GetFullPath($RepoRoot).TrimEnd("\")
if (!(Test-Path -LiteralPath $repoResolved -PathType Container)) {
  Fail-Dr "RepoRoot not found: $repoResolved"
}

$backupResolved = [System.IO.Path]::GetFullPath($BackupRoot).TrimEnd("\")
if ($backupResolved.Length -lt 6 -or [System.IO.Path]::GetPathRoot($backupResolved) -eq $backupResolved) {
  Fail-Dr "Unsafe BackupRoot: $backupResolved"
}

foreach ($folder in $Folders) {
  $path = Join-Path $backupResolved $folder
  if (!(Test-Path -LiteralPath $path -PathType Container)) {
    New-Item -ItemType Directory -Path $path | Out-Null
  }
}

$configText = Read-Text (Join-Path $repoResolved "Config.js")
$claspText = Read-Text (Join-Path $repoResolved ".clasp.json")
$claspIgnore = Read-Text (Join-Path $repoResolved ".claspignore")
$scriptId = Match-Value $claspText '"scriptId"\s*:\s*"([^"]+)"'
$version = Match-Value $configText 'VERSION\s*:\s*"([^"]+)"'
$deployVersion = Match-Value $configText 'DEPLOY_VERSION_NUMBER\s*:\s*(\d+)'

$runtimeAllowlist = @()
foreach ($line in ($claspIgnore -split "\r?\n")) {
  $trim = $line.Trim()
  if ($trim.StartsWith("!") -and $trim.Length -gt 1) {
    $runtimeAllowlist += $trim.Substring(1)
  }
}

$deploymentText = ""
if ($IncludeClaspDeployments) {
  Push-Location -LiteralPath $repoResolved
  try {
    $deploymentText = (& clasp.cmd deployments 2>&1) -join "`n"
    if ($LASTEXITCODE -ne 0) { $deploymentText = "clasp deployments failed with exit code $LASTEXITCODE`n$deploymentText" }
  } finally {
    Pop-Location
  }
}

$manifest = [ordered]@{
  generatedAt = (Get-Date).ToString("o")
  classification = "Track L - DR foundation / no runtime release"
  repository = [ordered]@{
    path = $repoResolved
    branch = Git-Line -GitArgs @("branch", "--show-current")
    status = Git-Line -GitArgs @("status", "-sb")
    latestCommit = Git-Line -GitArgs @("log", "-1", "--oneline")
    remote = Git-Line -GitArgs @("remote", "-v")
  }
  appsScript = [ordered]@{
    scriptId = $scriptId
    adminDeploymentId = Match-Value $configText 'DEPLOYMENT_ID_ADMIN\s*:\s*"([^"]+)"'
    studentDeploymentId = Match-Value $configText 'DEPLOYMENT_ID_STUDENT\s*:\s*"([^"]+)"'
    productionDeploymentId = ""
    version = $version
    deployVersionNumber = [int]($deployVersion -as [int])
    runtimeAllowlist = $runtimeAllowlist
    claspJsonPresent = (Test-Path -LiteralPath (Join-Path $repoResolved ".clasp.json") -PathType Leaf)
    claspIgnorePresent = (Test-Path -LiteralPath (Join-Path $repoResolved ".claspignore") -PathType Leaf)
    deployments = $deploymentText
  }
  sheets = [ordered]@{
    dataMode = Match-Value $configText 'DATA_MODE\s*:\s*"([^"]+)"'
    prodSpreadsheetId = Match-Value $configText 'SPREADSHEET_ID_PROD\s*:\s*"([^"]+)"'
    stagingSpreadsheetId = Match-Value $configText 'SPREADSHEET_ID_STAGING\s*:\s*"([^"]+)"'
    dataSheet = Match-Value $configText 'DATA_SHEET\s*:\s*"([^"]+)"'
    workingSheet = Match-Value $configText 'SHEET_TAB_WORKING\s*:\s*"([^"]+)"'
    runtimeLogSheet = Match-Value $configText 'LOG_SHEET\s*:\s*"([^"]+)"'
    portalLogSpreadsheetId = Match-Value $configText 'LOG_SHEET_ID\s*:\s*"([^"]+)"'
    portalLogSheet = Match-Value $configText 'LOG_SHEET_NAME\s*:\s*"([^"]+)"'
    portalSecretsSpreadsheetId = Match-Value $configText 'PORTAL_SECRETS_SHEET_ID\s*:\s*"([^"]+)"'
    portalSecretsTab = Match-Value $configText 'PORTAL_SECRETS_TAB\s*:\s*"([^"]+)"'
    examSitesSheet = Match-Value $configText 'EXAM_SITES_SHEET\s*:\s*"([^"]+)"'
  }
  drive = [ordered]@{
    rootFolderId = Match-Value $configText 'ROOT_FOLDER_ID\s*:\s*"([^"]+)"'
    applicantRootFolderIdPrimary = Match-Value $configText 'APPLICANT_ROOT_FOLDER_ID_PRIMARY\s*:\s*"([^"]+)"'
    applicantRootFolderIdFallback = Match-Value $configText 'APPLICANT_ROOT_FOLDER_ID_FALLBACK\s*:\s*"([^"]*)"'
    yearFolder = Match-Value $configText 'APPLICANT_ROOT_YEAR_FOLDER_NAME\s*:\s*"([^"]+)"'
    previewConvention = "Applicant-folder FODE_PREVIEW PNG files are derived/rebuildable; originals remain source-of-truth."
    documentFields = @(
      @{ label = "Birth Certificate / NID / Passport"; file = "Birth_ID_Passport_File"; status = "Birth_ID_Status"; comment = "Birth_ID_Comment"; required = $true },
      @{ label = "Latest School Reports / Documents"; file = "Latest_School_Report_File"; status = "Report_Status"; comment = "Report_Comment"; required = $true },
      @{ label = "Transfer Certificate (optional)"; file = "Transfer_Certificate_File"; status = "Transfer_Status"; comment = "Transfer_Comment"; required = $false },
      @{ label = "Passport Size Colour Photo"; file = "Passport_Photo_File"; status = "Photo_Status"; comment = "Photo_Comment"; required = $true },
      @{ label = "Admission Fee Payment Receipt"; file = "Fee_Receipt_File"; status = "Receipt_Status"; comment = "Receipt_Comment"; required = $true }
    )
  }
  dependencies = [ordered]@{
    formDesigner = "External intake dependency; backup/export not proven by this manifest."
    googleFormsReplacement = "Flagged as future replacement path; not implemented in this manifest."
    playwrightRoot = "F:\Playwright\fode-secure-link-diagnostic"
    remoteProofFolder = "D:\Repos\_clasp_remote_check_FODE"
  }
  backupRoot = $backupResolved
  folders = $Folders
  boundaries = @(
    "No runtime files changed by this script.",
    "No Apps Script deployment/version/repin.",
    "No Sheet export or edit.",
    "No Drive file copy/edit.",
    "No send.",
    "No production, Student staging, or OPS action."
  )
}

$manifestJsonPath = Join-Path $backupResolved "manifests\fode_runtime_recovery_manifest_v01.json"
$manifestMdPath = Join-Path $backupResolved "manifests\fode_runtime_recovery_manifest_v01.md"
$restorePath = Join-Path $backupResolved "manifests\restore_checklist_v01.md"
$logPath = Join-Path $backupResolved "logs\fode_dr_manifest_last_run.log"
$runtimeAllowlistMd = ($runtimeAllowlist | ForEach-Object { "- ``$_``" }) -join "`n"
$boundariesMd = ($manifest.boundaries | ForEach-Object { "- $_" }) -join "`n"
$repoBranch = [string]$manifest.repository.branch
$repoCommit = [string]$manifest.repository.latestCommit
$repoStatus = [string]$manifest.repository.status
$repoRemote = [string]$manifest.repository.remote
$adminDeploymentId = [string]$manifest.appsScript.adminDeploymentId
$studentDeploymentId = [string]$manifest.appsScript.studentDeploymentId
$dataMode = [string]$manifest.sheets.dataMode
$prodSpreadsheetId = [string]$manifest.sheets.prodSpreadsheetId
$stagingSpreadsheetId = [string]$manifest.sheets.stagingSpreadsheetId
$dataSheet = [string]$manifest.sheets.dataSheet
$runtimeLogSheet = [string]$manifest.sheets.runtimeLogSheet
$portalLogSpreadsheetId = [string]$manifest.sheets.portalLogSpreadsheetId
$portalLogSheet = [string]$manifest.sheets.portalLogSheet
$portalSecretsSpreadsheetId = [string]$manifest.sheets.portalSecretsSpreadsheetId
$portalSecretsTab = [string]$manifest.sheets.portalSecretsTab
$examSitesSheet = [string]$manifest.sheets.examSitesSheet
$rootFolderId = [string]$manifest.drive.rootFolderId
$primaryRootFolderId = [string]$manifest.drive.applicantRootFolderIdPrimary
$yearFolder = [string]$manifest.drive.yearFolder

$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestJsonPath -Encoding UTF8

$md = @"
# FODE Runtime Recovery Manifest v01

Generated: $($manifest.generatedAt)

## Repository

- Path: $repoResolved
- Branch: $repoBranch
- Latest commit: $repoCommit
- Status: $repoStatus
- Remote:

~~~text
$repoRemote
~~~

## Apps Script

- Script ID: $scriptId
- Runtime identity: $version / $deployVersion
- Admin deployment ID: $adminDeploymentId
- Student deployment ID: $studentDeploymentId
- Production deployment ID: not proven

Runtime allowlist:

$runtimeAllowlistMd

## Sheets

- Data mode: $dataMode
- Production spreadsheet: $prodSpreadsheetId
- Staging spreadsheet: $stagingSpreadsheetId
- Data tab: $dataSheet
- Runtime log tab: $runtimeLogSheet
- Portal log spreadsheet/tab: $portalLogSpreadsheetId / $portalLogSheet
- Portal secrets spreadsheet/tab: $portalSecretsSpreadsheetId / $portalSecretsTab
- Exam sites tab: $examSitesSheet

## Drive

- Applicant root folder ID: $rootFolderId
- Primary applicant root: $primaryRootFolderId
- Year folder: $yearFolder
- Preview convention: applicant-folder FODE_PREVIEW PNGs are disposable/rebuildable.

## Dependencies

- FormDesigner: external intake dependency; backup/export not proven.
- Google Forms replacement: future replacement path; not implemented here.
- Playwright: F:\Playwright\fode-secure-link-diagnostic
- Remote proof folder: D:\Repos\_clasp_remote_check_FODE

## Boundaries

$boundariesMd
"@
$md | Set-Content -LiteralPath $manifestMdPath -Encoding UTF8

$restore = @"
# FODE Runtime Restore Checklist v01

1. Clone repo from GitHub.
2. Verify branch, commit, .clasp.json, and .claspignore.
3. Verify Config.js identity and critical IDs.
4. Restore/verify Apps Script project access for script ID $scriptId.
5. Push Apps Script source only after local validation and remote-source gate.
6. Create Apps Script version only after remote Config.js identity proof.
7. Repin deployments only under an approved recovery CIS.
8. Verify Admin and Student whoami.
9. Open Sheet backups and inspect FODE_Data, Webhook_Log, portal logs, and portal secrets.
10. Verify applicant root folder and sampled applicant folder inventories.
11. Confirm document originals exist for sampled applicants.
12. Rerun F: Playwright health/hydration/operator proof.
13. Record the restore drill under restore_drills.

Do not perform destructive restore against live production, Student, Sheets, Drive, or Apps Script without a separate approved recovery CIS.
"@
$restore | Set-Content -LiteralPath $restorePath -Encoding UTF8

@"
Generated: $($manifest.generatedAt)
Manifest JSON: $manifestJsonPath
Manifest MD: $manifestMdPath
Restore checklist: $restorePath
"@ | Set-Content -LiteralPath $logPath -Encoding UTF8

Write-Host "PASS: FODE DR scaffold and manifest created"
Write-Host "BACKUP_ROOT: $backupResolved"
Write-Host "MANIFEST_JSON: $manifestJsonPath"
Write-Host "MANIFEST_MD: $manifestMdPath"
Write-Host "RESTORE_CHECKLIST: $restorePath"
