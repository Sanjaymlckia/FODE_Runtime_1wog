param(
  [Parameter(Mandatory=$true)]
  [string]$Message
)

$ErrorActionPreference = "Stop"

Write-Host "== FODE Admin quick release =="

git status --short

Write-Host "== Preflight =="
.\tools\fode-preflight.ps1

Write-Host "== Surface smoke =="
.\tools\fode-smoke.ps1 -Profile surfaces

Write-Host "== Commit =="
git add AdminUI.html tests\admin-review-workspace-ux-surface.test.js tests\admin-ui-actionability-dashboard-surface.test.js
git commit -m $Message

Write-Host "== Push =="
git push origin main

Write-Host ""
Write-Host "SOURCE PUSHED. Now give Codex this exact instruction:"
Write-Host ""
Write-Host "Deploy Admin staging only from latest pushed commit. Create one Apps Script version. Repin Admin staging only. Do not touch Student, Production, OPS, Sheet, Drive, email, or WhatsApp. Return version, whoami proof, and surface smoke summary."
