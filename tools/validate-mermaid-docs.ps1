[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$docsRoot = Join-Path $repoRoot 'docs'

function Write-Summary {
    param(
        [int]$FilesFound,
        [int]$Rendered,
        [int]$Passed,
        [int]$Failed,
        [string]$EvidencePath
    )

    Write-Host ''
    Write-Host 'MERMAID VALIDATION SUMMARY'
    Write-Host ''
    Write-Host ('Files found: {0}' -f $FilesFound)
    Write-Host ('Rendered:    {0}' -f $Rendered)
    Write-Host ('Passed:      {0}' -f $Passed)
    Write-Host ('Failed:      {0}' -f $Failed)
    if ($EvidencePath) {
        Write-Host ('Evidence:    {0}' -f $EvidencePath)
    }
}

if (-not (Test-Path -LiteralPath $docsRoot)) {
    Write-Error "Docs root not found: $docsRoot"
}

$mermaidFiles = Get-ChildItem -Path $docsRoot -Recurse -File -Filter '*.mmd' |
    Sort-Object FullName

$filesFound = @($mermaidFiles).Count
$mmdc = Get-Command mmdc -ErrorAction SilentlyContinue

if (-not $mmdc) {
    Write-Host 'SKIP'
    Write-Host 'Mermaid CLI not installed.'
    Write-Host 'Documentation architecture accepted by inspection only.'
    Write-Host ''
    Write-Host 'Installation guidance:'
    Write-Host '  npm install -g @mermaid-js/mermaid-cli'
    Write-Summary -FilesFound $filesFound -Rendered 0 -Passed 0 -Failed 0 -EvidencePath ''
    exit 0
}

$timestamp = Get-Date -Format 'yyyyMMddHHmmss'
$evidenceRoot = Join-Path $repoRoot ".release-proof\\mermaid\\$timestamp"
New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null

$rendered = 0
$passed = 0
$failed = 0
$failures = New-Object System.Collections.Generic.List[string]

foreach ($file in $mermaidFiles) {
    $rendered += 1
    $relative = $file.FullName.Substring($docsRoot.Length).TrimStart('\')
    $relativeDir = Split-Path -Parent $relative
    $outDir = if ([string]::IsNullOrWhiteSpace($relativeDir)) {
        $evidenceRoot
    } else {
        Join-Path $evidenceRoot $relativeDir
    }
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null

    $outFile = Join-Path $outDir ($file.BaseName + '.svg')
    $output = & $mmdc.Source -i $file.FullName -o $outFile 2>&1
    if ($LASTEXITCODE -eq 0) {
        $passed += 1
        Write-Host ("PASS {0}" -f $relative)
    } else {
        $failed += 1
        $failures.Add(("FAIL {0}`n{1}" -f $relative, ($output -join [Environment]::NewLine)))
        Write-Host ("FAIL {0}" -f $relative) -ForegroundColor Red
    }
}

Write-Summary -FilesFound $filesFound -Rendered $rendered -Passed $passed -Failed $failed -EvidencePath $evidenceRoot

if ($failed -gt 0) {
    Write-Host ''
    Write-Host 'Render errors:' -ForegroundColor Red
    foreach ($failure in $failures) {
        Write-Host $failure
        Write-Host ''
    }
    exit 1
}

exit 0
