param(
  [string]$Php = 'C:\Development\Runtimes\PHP\8.1.34\php.exe'
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
Set-Location -LiteralPath $repoRoot
$passed = 0
$failed = 0

function Invoke-GateStep {
  param([string]$Name, [scriptblock]$Action)
  try {
    & $Action
    if ($LASTEXITCODE -ne 0) { throw "exit code $LASTEXITCODE" }
    $script:passed++
    Write-Host "PASS: $Name" -ForegroundColor Green
  } catch {
    $script:failed++
    Write-Host "FAIL: $Name - $($_.Exception.Message)" -ForegroundColor Red
  }
}

if (-not (Test-Path -LiteralPath $Php)) { throw "PHP runner not found: $Php" }
Invoke-GateStep 'PHP version' { & $Php -v }

$phpFiles = @(Get-ChildItem -LiteralPath 'services\communication-ledger' -Recurse -File -Filter '*.php' | Sort-Object FullName)
foreach ($file in $phpFiles) {
  $path = $file.FullName
  Invoke-GateStep "PHP lint $($file.FullName)" { & $Php -l $path }
}
Invoke-GateStep 'PHP communication-ledger regression suite' { & $Php 'services\communication-ledger\tests\run.php' }

foreach ($file in @('CommunicationLedgerContract.js', 'CommunicationLedgerClient.js', 'tests\r390c-communication-ledger-client.test.js')) {
  Invoke-GateStep "Node syntax $file" { & node --check $file }
}
foreach ($test in @(
  'tests\r390c-communication-ledger-client.test.js',
  'tests\apps-script-deployable-file-contract.test.js',
  'tests\r390b1-communication-safety-repair.test.js',
  'tests\release-pipeline-contract.test.js',
  'tests\repository-hygiene-tooling.test.js'
)) {
  Invoke-GateStep "Node test $test" { & node $test }
}

$allowed = @(
  '.gitignore',
  '.claspignore',
  'CommunicationLedgerClient.js',
  'CommunicationLedgerContract.js',
  'services/communication-ledger/config/config.example.php',
  'services/communication-ledger/docs/CONTRACT.md',
  'services/communication-ledger/src/Config/Config.php',
  'services/communication-ledger/src/Http/App.php',
  'tests/apps-script-deployable-file-contract.test.js',
  'tests/r390c-communication-ledger-client.test.js',
  'tools/r390c-fast-gate.ps1'
)
$changed = @((git diff --name-only HEAD) + (git ls-files --others --exclude-standard)) | ForEach-Object { $_.Replace('\', '/') } | Sort-Object -Unique
$unexpected = @($changed | Where-Object { $_ -notin $allowed })
if ($unexpected.Count) { Write-Host ('UNEXPECTED_SCOPE: ' + ($unexpected -join ', ')); $failed++ } else { $passed++; Write-Host 'PASS: repository scope' -ForegroundColor Green }

$cachedForbidden = @(git ls-files | Where-Object { $_ -cmatch '(^|/)(config/config\.php|\.env|logs/|backups/|build/|restore-work/)|\.sql\.gz$|\.zip$|php-8\.1\.34' })
if ($cachedForbidden.Count) { Write-Host ('FORBIDDEN_TRACKED_ARTIFACTS: ' + ($cachedForbidden -join ', ')); $failed++ } else { $passed++; Write-Host 'PASS: protected/generated artifact exclusion' -ForegroundColor Green }
Invoke-GateStep 'git diff --check' { & git diff --check }

Write-Host "FAST_GATE_TOTALS passed=$passed failed=$failed phpFiles=$($phpFiles.Count)"
if ($failed -gt 0) { exit 1 }
