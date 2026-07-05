param(
  [string]$AdminExpectedRuntime = "r316",
  [int]$AdminExpectedDeploy = 316,
  [string]$StudentExpectedRuntime = "r217",
  [int]$StudentExpectedDeploy = 217,
  [string]$AdminUrl = "https://script.google.com/macros/s/AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ/exec?view=whoami",
  [string]$StudentUrl = "https://script.google.com/macros/s/AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv/exec?view=whoami"
)

$ErrorActionPreference = "Stop"

$ExpectedScriptId = "1wogECIIksKIhrho6OeKXdt3f7nmrMjSSeFfXwlypa3o-Do3MECvKOI90"
$Failures = New-Object System.Collections.Generic.List[string]

Write-Host "Expected Admin whoami: $AdminExpectedRuntime / $AdminExpectedDeploy"
Write-Host "Expected Student whoami: $StudentExpectedRuntime / $StudentExpectedDeploy"
Write-Host "Override these parameters explicitly during identity-bump releases."
Write-Host ""

function Add-Fail {
  param([string]$Message)
  $script:Failures.Add($Message) | Out-Null
  Write-Host "FAIL: $Message" -ForegroundColor Red
}

function Add-Pass {
  param([string]$Message)
  Write-Host "PASS: $Message" -ForegroundColor Green
}

function Convert-HexEscapes {
  param([string]$Text)
  return [regex]::Replace($Text, "\\x([0-9A-Fa-f]{2})", {
    param($m)
    [char]([Convert]::ToInt32($m.Groups[1].Value, 16))
  })
}

function Get-WhoamiJson {
  param([string]$Name, [string]$Url)

  Write-Host "CHECK: $Name $Url"
  $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -MaximumRedirection 5
  if ($response.StatusCode -ne 200) {
    throw "$Name whoami returned HTTP $($response.StatusCode)"
  }

  $decoded = [System.Net.WebUtility]::HtmlDecode((Convert-HexEscapes $response.Content))
  $preMatch = [regex]::Match($decoded, '<pre>(\{[\s\S]*?\})')
  $jsonText = if ($preMatch.Success) { $preMatch.Groups[1].Value } else { $decoded }
  $jsonText = $jsonText.Replace('\\n', "`n").Replace('\/', '/').Replace('\"', '"')
  $jsonMatch = [regex]::Match($jsonText, '\{\s*"ok"\s*:\s*true[\s\S]*?"mismatches"\s*:\s*\[[\s\S]*?\]\s*\}')
  if (!$jsonMatch.Success) {
    throw "$Name whoami JSON block not found. Use authenticated browser proof if the Google wrapper hides inner content."
  }
  return $jsonMatch.Value | ConvertFrom-Json
}

function Test-Whoami {
  param(
    [string]$Name,
    [string]$Url,
    [string]$ExpectedRuntime,
    [int]$ExpectedDeploy
  )

  try {
    $data = Get-WhoamiJson -Name $Name -Url $Url
    $localFailures = New-Object System.Collections.Generic.List[string]
    if ($data.ok -ne $true) { $localFailures.Add("ok is not true") | Out-Null }
    if ($data.version -ne $ExpectedRuntime) { $localFailures.Add("version expected $ExpectedRuntime got $($data.version)") | Out-Null }
    if ([int]$data.deployVersion -ne $ExpectedDeploy) { $localFailures.Add("deployVersion expected $ExpectedDeploy got $($data.deployVersion)") | Out-Null }
    if ($data.scriptId -ne $ExpectedScriptId) { $localFailures.Add("scriptId mismatch: $($data.scriptId)") | Out-Null }
    if ($data.mismatch -ne $false) { $localFailures.Add("mismatch is not false") | Out-Null }
    if ([string]$data.canonicalAdminUrl -notmatch "/macros/s/") { $localFailures.Add("canonicalAdminUrl is not /macros/s/: $($data.canonicalAdminUrl)") | Out-Null }
    if ([string]$data.canonicalStudentUrl -notmatch "/macros/s/") { $localFailures.Add("canonicalStudentUrl is not /macros/s/: $($data.canonicalStudentUrl)") | Out-Null }

    if ($localFailures.Count -gt 0) {
      foreach ($failure in $localFailures) { Add-Fail "$Name $failure" }
    } else {
      Add-Pass "$Name whoami $ExpectedRuntime / $ExpectedDeploy"
    }
  } catch {
    Add-Fail "$Name whoami failed: $($_.Exception.Message)"
  }
}

Test-Whoami -Name "Admin" -Url $AdminUrl -ExpectedRuntime $AdminExpectedRuntime -ExpectedDeploy $AdminExpectedDeploy
Test-Whoami -Name "Student" -Url $StudentUrl -ExpectedRuntime $StudentExpectedRuntime -ExpectedDeploy $StudentExpectedDeploy

Write-Host ""
Write-Host "Failures: $($Failures.Count)"
if ($Failures.Count -gt 0) {
  Write-Host "RUNTIME VERIFY FAIL" -ForegroundColor Red
  exit 1
}

Write-Host "RUNTIME VERIFY PASS" -ForegroundColor Green
exit 0
