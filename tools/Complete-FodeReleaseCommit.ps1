param(
  [Parameter(Mandatory=$true)]
  [string]$CommitMessage,
  [string]$ManifestPath = "",
  [switch]$DryRun,
  [switch]$MockGitPush
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "FodeReleasePipeline.Core.ps1")

try {
  if (!$ManifestPath) {
    $latest = Get-ChildItem -LiteralPath ".release-proof\admin-release" -Filter "*.manifest.json" -ErrorAction Stop | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (!$latest) { throw "No release manifest found" }
    $ManifestPath = $latest.FullName
  }
  if (!(Test-Path -LiteralPath $ManifestPath -PathType Leaf)) { throw "Release manifest not found: $ManifestPath" }
  $manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
  $currentFiles = @(Get-FodeChangedFiles)
  $approved = @($manifest.approvedScope | ForEach-Object { ConvertTo-FodeSlashPath $_ })
  $unexpected = @($currentFiles | Where-Object { $approved -notcontains $_ })
  if ($unexpected.Count -gt 0) { throw "Post-acceptance drift rejected: $($unexpected -join ', ')" }
  $currentHash = Get-FodeDiffHash -Files $approved
  if ($currentHash -ne [string]$manifest.diffHash) { throw "Manifest diff hash mismatch: expected $($manifest.diffHash) got $currentHash" }
  $identity = Get-FodeConfigIdentity
  if ($identity.Runtime -ne [string]$manifest.proposedRuntimeIdentity.Runtime -or $identity.Deploy -ne [int]$manifest.proposedRuntimeIdentity.Deploy) {
    throw "Runtime identity mismatch: manifest $($manifest.proposedRuntimeIdentity.Runtime) / $($manifest.proposedRuntimeIdentity.Deploy), local $($identity.Runtime) / $($identity.Deploy)"
  }
  if ($DryRun) {
    Write-Host "DRY RUN PASS: closure would stage manifest-approved files only."
    Write-Host ($approved -join "`n")
    exit 0
  }
  $preStaged = @(& git diff --cached --name-only)
  if ($preStaged.Count -gt 0) { throw "Pre-existing staged files rejected: $($preStaged -join ', ')" }
  & git add -- $approved
  if ($LASTEXITCODE -ne 0) { throw "git add failed" }
  $staged = @(& git diff --cached --name-only | ForEach-Object { ConvertTo-FodeSlashPath $_ })
  $diff = Compare-Object -ReferenceObject (@($approved | Sort-Object)) -DifferenceObject (@($staged | Sort-Object))
  if ($diff) { throw "Staged files do not match manifest-approved files" }
  Write-Host "Staged files:"
  $staged | ForEach-Object { Write-Host " - $_" }
  & git diff --cached --stat
  & git diff --cached --check
  if ($LASTEXITCODE -ne 0) { throw "git diff --cached --check failed" }
  & git commit -m $CommitMessage
  if ($LASTEXITCODE -ne 0) { throw "git commit failed" }
  if ($MockGitPush) {
    Write-Host "MOCK GIT PUSH: skipped by request"
  } else {
    & git push origin main
    if ($LASTEXITCODE -ne 0) { throw "git push failed" }
  }
  $head = (& git rev-parse HEAD).Trim()
  $origin = (& git rev-parse origin/main).Trim()
  if (!$MockGitPush -and $head -ne $origin) { throw "HEAD != origin/main after push" }
  $aheadBehind = (& git rev-list --left-right --count HEAD...origin/main).Trim()
  if (!$MockGitPush -and $aheadBehind -ne "0`t0" -and $aheadBehind -ne "0 0") { throw "ahead/behind not 0 / 0: $aheadBehind" }
  $status = @(& git status --short)
  if ($status.Count -gt 0) { throw "working tree not clean after closure" }
  Write-Host "RELEASE COMMIT COMPLETE" -ForegroundColor Green
  Write-Host "Commit: $head"
  exit 0
} catch {
  Write-Host "FAIL: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
