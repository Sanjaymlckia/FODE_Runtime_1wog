param(
  [Parameter(Mandatory=$true)]
  [string]$Release,

  [Parameter(Mandatory=$true)]
  [int]$DeployVersion,

  [Parameter(Mandatory=$true)]
  [string]$Message,

  [Parameter(Mandatory=$true)]
  [string[]]$Files
)

$ErrorActionPreference = "Stop"

$Repo = "E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog"
$ExpectedVersion = "r$DeployVersion"

Write-Host "FODE runtime/identity close gate" -ForegroundColor Cyan
Write-Host "Repo: $Repo"
Write-Host "Release: $Release"
Write-Host "Expected VERSION: $ExpectedVersion"
Write-Host "Expected DEPLOY_VERSION_NUMBER: $DeployVersion"
Write-Host ""

Set-Location $Repo

if (-not (Test-Path ".git")) {
  throw "Not a git repository: $Repo"
}

if (-not (Test-Path "Config.js")) {
  throw "Config.js not found. Cannot verify release identity."
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
}

Write-Host ""
Write-Host "Checking Config.js release identity..." -ForegroundColor Yellow

$config = Get-Content "Config.js" -Raw

$versionPattern = 'VERSION\s*:\s*["'']' + [regex]::Escape($ExpectedVersion) + '["'']'
$deployPattern  = 'DEPLOY_VERSION_NUMBER\s*:\s*' + [regex]::Escape([string]$DeployVersion)

if ($config -notmatch $versionPattern) {
  throw "Config.js VERSION does not match expected $ExpectedVersion"
}

if ($config -notmatch $deployPattern) {
  throw "Config.js DEPLOY_VERSION_NUMBER does not match expected $DeployVersion"
}

Write-Host "Config.js identity check PASS." -ForegroundColor Green

Write-Host ""
Write-Host "Running git diff --check..." -ForegroundColor Yellow
git diff --check

if ($Files -contains "Admin.js") {
  Write-Host ""
  Write-Host "Running node --check Admin.js..." -ForegroundColor Yellow
  node --check Admin.js
}

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
Write-Host "Runtime close complete." -ForegroundColor Green
Write-Host "Reminder: this script commits exact files only. It does not push, clasp push, create a version, or repin."
