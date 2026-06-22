param(
  [Parameter(Mandatory=$true)]
  [string]$Release,

  [Parameter(Mandatory=$true)]
  [string]$Message,

  [Parameter(Mandatory=$true)]
  [string[]]$Files,

  [switch]$AllowRuntimeFiles
)

$ErrorActionPreference = "Stop"

$Repo = "E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog"
$RuntimeFiles = @(
  "Admin.js",
  "AdminUI_OpsApplicantQueue.html",
  "AdminUI_OpsCommunications.html",
  "AdminUI_OpsLifecycle.html",
  "AdminUI_SharedRowFacts.html",
  "AdminUI.html",
  "appsscript.json",
  "Code.js",
  "Config.js",
  "Routes.js",
  "Utils.js",
  "whoami_admin.html"
)

Write-Host "FODE Track L documentation close gate" -ForegroundColor Cyan
Write-Host "Repo: $Repo"
Write-Host "Release: $Release"
Write-Host "Runtime release: NO"
Write-Host ""

Set-Location $Repo

if (-not (Test-Path ".git")) {
  throw "Not a git repository: $Repo"
}

Write-Host "Current git status:" -ForegroundColor Yellow
git status -sb
Write-Host ""

Write-Host "Requested files to stage:" -ForegroundColor Yellow
$Files | ForEach-Object { Write-Host " - $_" }

foreach ($file in $Files) {
  if (-not (Test-Path $file)) {
    throw "Missing required file: $file"
  }
  $normalized = $file.Replace("/", "\")
  $leaf = Split-Path -Leaf $normalized
  if (!$AllowRuntimeFiles -and $RuntimeFiles -contains $leaf) {
    throw "Runtime file rejected by Track L docs close gate: $file"
  }
  if (!$AllowRuntimeFiles -and [System.IO.Path]::GetExtension($normalized) -ne ".md") {
    throw "Non-document file rejected by Track L docs close gate: $file"
  }
}

Write-Host ""
Write-Host "Running git diff --check..." -ForegroundColor Yellow
git diff --check

Write-Host ""
Write-Host "Tracked modified files:" -ForegroundColor Yellow
git diff --name-only

Write-Host ""
Write-Host "Untracked files:" -ForegroundColor Yellow
git ls-files --others --exclude-standard

$preStaged = @(git diff --cached --name-only)
if ($preStaged.Count -gt 0) {
  throw "Pre-existing staged files detected. Clear the index before using this close gate: $($preStaged -join ', ')"
}

Write-Host ""
$confirm = Read-Host "Stage ONLY the listed files and commit? Type YES to continue"
if ($confirm -ne "YES") {
  Write-Host "Cancelled. No files staged or committed." -ForegroundColor Red
  exit 1
}

git add -- $Files

Write-Host ""
Write-Host "Staged files:" -ForegroundColor Yellow
$staged = @(git diff --cached --name-only)
$staged | ForEach-Object { Write-Host $_ }
$expectedStaged = @($Files | ForEach-Object { $_.Replace("\", "/") } | Sort-Object -Unique)
$actualStaged = @($staged | ForEach-Object { $_.Replace("\", "/") } | Sort-Object -Unique)
if (Compare-Object -ReferenceObject $expectedStaged -DifferenceObject $actualStaged) {
  throw "Staged files do not exactly match the requested file list."
}

git diff --cached --check
if ($LASTEXITCODE -ne 0) {
  throw "git diff --cached --check failed"
}

Write-Host ""
Write-Host "Staged diff stat:" -ForegroundColor Yellow
git diff --cached --stat

Write-Host ""
$confirm2 = Read-Host "Commit with message: '$Message'? Type YES to commit"
if ($confirm2 -ne "YES") {
  Write-Host "Cancelled after staging. Review with git status." -ForegroundColor Red
  exit 1
}

git commit -m "$Message"

Write-Host ""
Write-Host "Final status:" -ForegroundColor Yellow
git status -sb

Write-Host ""
Write-Host "Latest commit:" -ForegroundColor Yellow
git log -1 --oneline

Write-Host ""
Write-Host "Track L documentation close complete." -ForegroundColor Green
Write-Host "No Config identity check, runtime release, Apps Script action, or push was performed."
