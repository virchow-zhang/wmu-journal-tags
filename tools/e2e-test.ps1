<#
.SYNOPSIS
  End-to-end test for the WMU journal tags plugin against a real Zotero 10
  instance (isolated profile).

.DESCRIPTION
  Creates journal items through Zotero's local connector endpoint
  (/connector/saveItems, the endpoint used by the browser extension - no API
  key needed), waits for the plugin's notifier to auto-tag them, then reads
  the items back via the local read API and asserts the expected tags.

  The isolated data directory is wiped before each run, so test items never
  accumulate.

.PARAMETER ZoteroPath
  Path to zotero.exe. Default: C:\Program Files\Zotero\zotero.exe

.PARAMETER ProfilePath
  Isolated Zotero profile. Default: ..\.zotero-e2e\profile
  (the plugin xpi must be sideloaded at <profile>\extensions\wmu-journal-tags@wmu.local.xpi)

.PARAMETER DataPath
  Isolated Zotero data directory. Default: ..\.zotero-e2e\data

.PARAMETER XpiPath
  Optional. If given (or if .scaffold\build\wmu-journal-tags.xpi exists), the
  xpi is re-sideloaded into the profile before Zotero starts.
#>
param(
  [string]$ZoteroPath = "C:\Program Files\Zotero\zotero.exe",
  [string]$ProfilePath = (Join-Path (Split-Path $PSScriptRoot -Parent) "..\.zotero-e2e\profile"),
  [string]$DataPath = (Join-Path (Split-Path $PSScriptRoot -Parent) "..\.zotero-e2e\data"),
  [string]$XpiPath = (Join-Path (Split-Path $PSScriptRoot -Parent) ".scaffold\build\wmu-journal-tags.xpi")
)

$ErrorActionPreference = "Stop"
$ProfilePath = (Resolve-Path $ProfilePath).Path
$DataPath = [System.IO.Path]::GetFullPath($DataPath)

$server = "http://localhost:23119"
$base = "$server/api/users/0"

function Read-ApiJson([string]$url) {
  $text = curl.exe -s --max-time 30 $url
  if ([string]::IsNullOrWhiteSpace($text)) { return $null }
  return $text | ConvertFrom-Json
}

function Save-ConnectorItem([string]$title, [string]$journal, [string]$issn) {
  $guid = [guid]::NewGuid().ToString("N").Substring(0, 8)
  $item = [ordered]@{
    id        = "0"
    itemType  = "journalArticle"
    title     = $title
    creators  = @()
  }
  if ($journal) { $item["publicationTitle"] = $journal }
  if ($issn) { $item["ISSN"] = $issn }
  $payload = [ordered]@{
    sessionID  = "e2e-$guid"
    uri        = "https://example.com/e2e/$guid"
    items      = @($item)
    singleFile = $false
  } | ConvertTo-Json -Depth 6 -Compress
  $tmp = Join-Path $env:TEMP "wmu-e2e-$guid.json"
  Set-Content -Path $tmp -Value $payload -Encoding Ascii
  $hdr = Join-Path $env:TEMP "wmu-e2e-$guid.hdr"
  $code = curl.exe -s -o NUL -D $hdr -w "%{http_code}" --max-time 30 `
    -X POST "$server/connector/saveItems" `
    -H "Content-Type: application/json" `
    -H "X-Zotero-Connector-API-Version: 3" `
    -d "@$tmp"
  Remove-Item $tmp, $hdr -Force -ErrorAction SilentlyContinue
  if ($code -ne "201") { throw "connector save failed: HTTP $code" }
}

function Get-ItemInfo([string]$title) {
  # Note: returns an object instead of a bare array - PowerShell unrolls empty
  # arrays to $null, which would be indistinguishable from "not found".
  $items = Read-ApiJson "$base/items?limit=100&sort=dateAdded&direction=desc"
  $match = @()
  if ($items) { $match = @($items | Where-Object { $_.data.title -eq $title }) }
  if ($match.Count -eq 0) {
    return [pscustomobject]@{ Found = $false; Tags = @() }
  }
  return [pscustomobject]@{
    Found = $true
    Tags  = @($match[0].data.tags | ForEach-Object { $_.tag })
  }
}

# ---------------------------------------------------------------- start Zotero
Write-Host "stopping Zotero, resetting isolated data dir..." -ForegroundColor Cyan
Get-Process zotero -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
if (Test-Path $DataPath) { Remove-Item $DataPath -Recurse -Force }
New-Item -ItemType Directory -Force -Path $DataPath | Out-Null

$extDir = Join-Path $ProfilePath "extensions"
New-Item -ItemType Directory -Force -Path $extDir | Out-Null
if ($XpiPath -and (Test-Path $XpiPath)) {
  Copy-Item $XpiPath (Join-Path $extDir "wmu-journal-tags@wmu.local.xpi") -Force
  Write-Host "plugin xpi sideloaded from $XpiPath"
}

Write-Host "starting Zotero (isolated profile)..." -ForegroundColor Cyan
Start-Process -FilePath $ZoteroPath -ArgumentList @(
  "--purgecaches", "no-remote",
  "-profile", "`"$ProfilePath`"",
  "--dataDir", "`"$DataPath`""
) | Out-Null

$ready = $false
for ($i = 0; $i -lt 90; $i++) {
  Start-Sleep -Seconds 2
  $probe = Read-ApiJson "$base/items?limit=1"
  if ($null -ne $probe) { $ready = $true; break }
}
if (-not $ready) { throw "Zotero local API did not become available" }
Write-Host "Zotero is up" -ForegroundColor Cyan

# ------------------------------------------------------------------- scenarios
$scenarios = @(
  @{ name = "T1 by ISSN";        title = "e2e-t1";   journal = "Cell";                  issn = "0092-8674"; expect = @("WMU:T1") },
  @{ name = "T2A by ISSN";       title = "e2e-t2a";  journal = "Nature Medicine";       issn = "1078-8956"; expect = @("WMU:T2(A)") },
  @{ name = "review by ISSN";    title = "e2e-rev";  journal = "Nature Reviews Cancer"; issn = "1474-175X"; expect = @("WMU:T2(B)", "WMU:综述") },
  @{ name = "Q1 by title only";  title = "e2e-q1";   journal = "Space Weather";         issn = "";          expect = @("WMU:Q1") },
  @{ name = "unmatched journal"; title = "e2e-none"; journal = "Journal of Nothing";    issn = "1234-5679"; expect = @() }
)

$results = @()
foreach ($s in $scenarios) {
  $guid = [guid]::NewGuid().ToString("N").Substring(0, 6)
  $title = "$($s.title)-$guid"
  try {
    Save-ConnectorItem $title $s.journal $s.issn
    $info = [pscustomobject]@{ Found = $false; Tags = @() }
    # poll: wait for the item to appear, then for the notifier tags (2s debounce)
    for ($attempt = 0; $attempt -lt 12; $attempt++) {
      Start-Sleep -Seconds 3
      $info = Get-ItemInfo $title
      if (-not $info.Found) { continue }
      $allPresent = $true
      foreach ($expected in $s.expect) { if ($info.Tags -notcontains $expected) { $allPresent = $false } }
      if ($allPresent) { break }
    }
    if (-not $info.Found) {
      $results += [pscustomobject]@{ Scenario = $s.name; OK = $false; Tags = "ITEM NOT FOUND" }
      continue
    }
    $tags = $info.Tags
    $ok = $true
    foreach ($expected in $s.expect) { if ($tags -notcontains $expected) { $ok = $false } }
    if ($s.expect.Count -eq 0 -and $tags.Count -ne 0) { $ok = $false }
    $results += [pscustomobject]@{ Scenario = $s.name; OK = $ok; Tags = ($tags -join ", ") }
  } catch {
    $results += [pscustomobject]@{ Scenario = $s.name; OK = $false; Tags = "ERROR: $($_.Exception.Message)" }
  }
}

Write-Host ""
$results | Format-Table -AutoSize
$failed = @($results | Where-Object { -not $_.OK }).Count
Write-Host "stopping Zotero..."
Get-Process zotero -ErrorAction SilentlyContinue | Stop-Process -Force

if ($failed -gt 0) {
  Write-Host "$failed scenario(s) FAILED" -ForegroundColor Red
  exit 1
} else {
  Write-Host "all $($results.Count) scenarios PASSED" -ForegroundColor Green
}
