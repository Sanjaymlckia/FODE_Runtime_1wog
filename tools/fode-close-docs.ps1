param(
  [Parameter(Mandatory=$true)]
  [string]$Release,

  [Parameter(Mandatory=$true)]
  [string]$Message,

  [Parameter(Mandatory=$true)]
  [string[]]$Files
)

$ErrorActionPreference = "Stop"

$Repo = "E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog"

Write-Host "FODE docs close gate" -ForegroundColor Cyan
Write-Host "Repo: $Repo"
Write-Host "Release: $Release"
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
}

Write-Host ""
Write-Host "Running git diff --check..." -ForegroundColor Yellow
git diff --check

Write-Host ""
Write-Host "Tracked modified files:" -ForegroundColor Yellow
git diff --name-only

Write-Host ""
$confirm = Read-Host "Stage ONLY the listed files and commit? Type YES to continue"
if ($confirm -ne "YES") {
  Write-Host "Cancelled. No files staged or committed." -ForegroundColor Red
  exit 1
}

git add -- $Files

Write-Host ""
Write-Host "Staged files:" -ForegroundColor Yellow
git diff --cached --name-only

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