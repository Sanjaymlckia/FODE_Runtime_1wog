param(
  [string]$ContextPath = "runtime-context.json",
  [string]$Project = "",
  [switch]$SkipGit,
  [switch]$SkipConstantScan
)

$ErrorActionPreference = "Stop"
$Failures = New-Object System.Collections.Generic.List[string]

function Add-Fail {
  param([string]$Message)
  $script:Failures.Add($Message) | Out-Null
  Write-Host "FAIL: $Message" -ForegroundColor Red
}

function Add-Pass {
  param([string]$Message)
  Write-Host "PASS: $Message" -ForegroundColor Green
}

function Require-Value {
  param([object]$Value, [string]$Name)
  if ($null -eq $Value -or [string]::IsNullOrWhiteSpace([string]$Value)) {
    Add-Fail "$Name is required"
    return $false
  }
  Add-Pass "$Name"
  return $true
}

if (!(Test-Path -LiteralPath $ContextPath)) {
  Add-Fail "context file not found: $ContextPath"
} else {
  try {
    $Context = Get-Content -LiteralPath $ContextPath -Raw | ConvertFrom-Json
    Add-Pass "context JSON parses"
  } catch {
    Add-Fail "context JSON parse failed: $($_.Exception.Message)"
  }
}

if ($Failures.Count -eq 0) {
  if (!$Project) { $Project = [string]$Context.activeProject }
  if (!(Require-Value $Project "active project")) {
    $Project = ""
  }

  $ProjectContext = $null
  if ($Project) {
    $ProjectContext = $Context.projects.$Project
    if ($null -eq $ProjectContext) {
      Add-Fail "project not found in context: $Project"
    } else {
      Add-Pass "project context found: $Project"
    }
  }

  if ($null -ne $ProjectContext) {
    Require-Value $ProjectContext.repository.path "repository.path" | Out-Null
    Require-Value $ProjectContext.repository.github "repository.github" | Out-Null
    Require-Value $ProjectContext.repository.branch "repository.branch" | Out-Null
    Require-Value $ProjectContext.appsScript.scriptId "appsScript.scriptId" | Out-Null
    Require-Value $ProjectContext.dataSources.liveSheet.spreadsheetId "dataSources.liveSheet.spreadsheetId" | Out-Null
    Require-Value $ProjectContext.dataSources.liveSheet.primaryTab "dataSources.liveSheet.primaryTab" | Out-Null
    Require-Value $ProjectContext.playwright.projectPath "playwright.projectPath" | Out-Null
    Require-Value $ProjectContext.playwright.reportsPath "playwright.reportsPath" | Out-Null
    Require-Value $ProjectContext.evidence.namingPattern "evidence.namingPattern" | Out-Null

    foreach ($targetName in @("adminStaging", "studentStaging")) {
      $target = $ProjectContext.deployments.$targetName
      if ($null -eq $target) {
        Add-Fail "deployment target missing: $targetName"
        continue
      }
      Require-Value $target.deploymentId "deployments.$targetName.deploymentId" | Out-Null
      Require-Value $target.url "deployments.$targetName.url" | Out-Null
      Require-Value $target.whoamiUrl "deployments.$targetName.whoamiUrl" | Out-Null
      Require-Value $target.expectedRuntime "deployments.$targetName.expectedRuntime" | Out-Null
      if ($null -eq $target.expectedDeploy) { Add-Fail "deployments.$targetName.expectedDeploy is required" } else { Add-Pass "deployments.$targetName.expectedDeploy" }
    }

    if ($ProjectContext.featureFlags.runtimeMutationAllowedByDefault -ne $false) { Add-Fail "runtime mutation default must be false" } else { Add-Pass "runtime mutation default false" }
    if ($ProjectContext.featureFlags.sheetMutationAllowedByDefault -ne $false) { Add-Fail "sheet mutation default must be false" } else { Add-Pass "sheet mutation default false" }
    if ($ProjectContext.featureFlags.driveMutationAllowedByDefault -ne $false) { Add-Fail "drive mutation default must be false" } else { Add-Pass "drive mutation default false" }
    if ($ProjectContext.featureFlags.productionMutationAllowedByDefault -ne $false) { Add-Fail "production mutation default must be false" } else { Add-Pass "production mutation default false" }

    $profiles = @($ProjectContext.acceptanceProfiles.PSObject.Properties.Name)
    foreach ($profile in @("health", "identity", "operations", "communications", "gallery", "lifecycle", "full-release")) {
      if ($profiles -notcontains $profile) { Add-Fail "acceptance profile missing: $profile" } else { Add-Pass "acceptance profile: $profile" }
    }

    if (!$SkipConstantScan) {
      $scanRoots = @("docs\platform", "docs\tooling", "docs\workflows", "projects")
      $scanFiles = New-Object System.Collections.Generic.List[string]
      foreach ($root in $scanRoots) {
        if (Test-Path -LiteralPath $root) {
          Get-ChildItem -LiteralPath $root -Recurse -File | ForEach-Object { $scanFiles.Add($_.FullName) | Out-Null }
        }
      }
      Get-ChildItem -LiteralPath "tools" -Filter "rep-*.ps1" -File | ForEach-Object { $scanFiles.Add($_.FullName) | Out-Null }
      if (Test-Path -LiteralPath "tools\README.md") { $scanFiles.Add((Resolve-Path -LiteralPath "tools\README.md").Path) | Out-Null }

      $constants = New-Object System.Collections.Generic.List[string]
      $constants.Add([string]$ProjectContext.appsScript.scriptId) | Out-Null
      $constants.Add([string]$ProjectContext.dataSources.liveSheet.spreadsheetId) | Out-Null
      foreach ($targetName in @("adminStaging", "studentStaging")) {
        $target = $ProjectContext.deployments.$targetName
        if ($null -ne $target) {
          foreach ($field in @("deploymentId", "url", "whoamiUrl")) {
            $value = [string]$target.$field
            if (![string]::IsNullOrWhiteSpace($value)) { $constants.Add($value) | Out-Null }
          }
        }
      }

      $duplicateHits = New-Object System.Collections.Generic.List[string]
      $scanBase = (Get-Location).Path.TrimEnd("\") + "\"
      foreach ($constant in @($constants | Sort-Object -Unique)) {
        if ([string]::IsNullOrWhiteSpace($constant)) { continue }
        foreach ($file in $scanFiles) {
          $matches = @(Select-String -LiteralPath $file -SimpleMatch -Pattern $constant)
          foreach ($match in $matches) {
            $relative = if ($match.Path.StartsWith($scanBase, [System.StringComparison]::OrdinalIgnoreCase)) {
              $match.Path.Substring($scanBase.Length)
            } else {
              $match.Path
            }
            $duplicateHits.Add("${relative}:$($match.LineNumber)") | Out-Null
          }
        }
      }
      if ($duplicateHits.Count -gt 0) {
        Add-Fail "project constants duplicated outside runtime-context.json: $($duplicateHits -join ', ')"
      } else {
        Add-Pass "REP docs/scripts do not duplicate project constants"
      }
    }

    if (!$SkipGit) {
      try {
        $repoRoot = [System.IO.Path]::GetFullPath(((& git rev-parse --show-toplevel).Trim())).TrimEnd("\")
        $expectedRoot = [System.IO.Path]::GetFullPath([string]$ProjectContext.repository.path).TrimEnd("\")
        if ($repoRoot -ne $expectedRoot) { Add-Fail "repo root mismatch: expected '$expectedRoot' got '$repoRoot'" } else { Add-Pass "repo root matches context" }
      } catch {
        Add-Fail "git repo root check failed: $($_.Exception.Message)"
      }

      try {
        $branch = (& git branch --show-current).Trim()
        if ($branch -ne [string]$ProjectContext.repository.branch) { Add-Fail "branch mismatch: expected '$($ProjectContext.repository.branch)' got '$branch'" } else { Add-Pass "branch matches context" }
      } catch {
        Add-Fail "git branch check failed: $($_.Exception.Message)"
      }
    }
  }
}

Write-Host ""
Write-Host "Failures: $($Failures.Count)"
if ($Failures.Count -gt 0) {
  Write-Host "REP CONTEXT FAIL" -ForegroundColor Red
  exit 1
}

Write-Host "REP CONTEXT PASS" -ForegroundColor Green
exit 0
