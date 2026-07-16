#requires -Version 5.1
# Zero-SUT regression for invalid proxy state, independent cleanup, and PID reuse safety.
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$Root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$Ops = Join-Path $Root 'scripts\casey.ps1'
$ListenerScript = Join-Path $Root 'scripts\wsl-reverse-listen.mjs'
$AgentScript = Join-Path $Root 'scripts\win-reverse-agent.mjs'
$HostExe = (Get-Process -Id $PID).Path
$Utf8NoBom = New-Object Text.UTF8Encoding($false)
$Known = New-Object Collections.ArrayList
$Temps = New-Object Collections.ArrayList
$oldSite = $env:AT_SITE_JSON
$oldRuntime = $env:CASEY_RUNTIME_DIR

function Invoke-Ops([string]$Action) {
  $start = New-Object Diagnostics.ProcessStartInfo
  $start.FileName = $HostExe
  $start.Arguments = '-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + $Ops + '" ' + $Action
  $start.WorkingDirectory = $Root
  $start.UseShellExecute = $false
  $start.CreateNoWindow = $true
  $start.RedirectStandardOutput = $true
  $start.RedirectStandardError = $true
  $process = [Diagnostics.Process]::Start($start)
  $stdout = $process.StandardOutput.ReadToEnd()
  $stderr = $process.StandardError.ReadToEnd()
  $process.WaitForExit()
  return @{ Code = $process.ExitCode; Output = $stdout + $stderr }
}

function Assert-NoLeak([string]$Text) {
  if ($Text -match 'powershell-state-canary|CASEY_TUNNEL_TOKEN|://') {
    throw 'proxy output leaked protected material'
  }
}

function New-Scenario([string]$Name, [int]$Port) {
  $temp = Join-Path ([IO.Path]::GetTempPath()) ('casey-proxy-state-' + $Name + '-' + [Guid]::NewGuid().ToString('N'))
  $runtime = Join-Path $temp 'runtime'
  $site = Join-Path $temp 'site.json'
  New-Item -ItemType Directory -Path $temp | Out-Null
  $body = '{"target":{"startUrl":"http://powershell-state-canary.invalid/login","devProxyUrl":"http://127.0.0.1:' + $Port + '"}}'
  [IO.File]::WriteAllText($site, $body, $Utf8NoBom)
  [void]$Temps.Add($temp)
  return @{ Temp = $temp; Runtime = $runtime; Site = $site; Port = $Port }
}

function Use-Scenario($Scenario) {
  $env:AT_SITE_JSON = $Scenario.Site
  $env:CASEY_RUNTIME_DIR = $Scenario.Runtime
}

function Read-State($Scenario) {
  $path = Join-Path $Scenario.Runtime 'proxy-state.json'
  if (-not (Test-Path -LiteralPath $path)) { return $null }
  return [IO.File]::ReadAllText($path) | ConvertFrom-Json
}

function Remember-State($State) {
  $listenerCopy = [pscustomobject]@{
    pid = [int]$State.listener.pid
    startedUtcTicks = [Int64]$State.listener.startedUtcTicks
  }
  $agentCopy = [pscustomobject]@{
    pid = [int]$State.agent.pid
    startedUtcTicks = [Int64]$State.agent.startedUtcTicks
  }
  [void]$Known.Add(@{ Entry = $listenerCopy; Script = $ListenerScript })
  [void]$Known.Add(@{ Entry = $agentCopy; Script = $AgentScript })
}

function Stop-KnownProcess($Record) {
  try {
    $entry = $Record.Entry
    $process = Get-Process -Id ([int]$entry.pid) -ErrorAction SilentlyContinue
    if ($null -eq $process) { return }
    if ($process.StartTime.ToUniversalTime().Ticks -ne [Int64]$entry.startedUtcTicks) { return }
    $row = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $entry.pid) -ErrorAction SilentlyContinue
    if ($null -eq $row -or $row.CommandLine -notmatch [regex]::Escape([string]$Record.Script)) { return }
    $process.Refresh()
    if ($process.HasExited) { return }
    if ($process.StartTime.ToUniversalTime().Ticks -ne [Int64]$entry.startedUtcTicks) { return }
    $process.Kill()
    $process.WaitForExit(3000) | Out-Null
  } catch {}
}

function Proxy-PidsForRoot {
  $rows = @(Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object {
    $_.CommandLine -match [regex]::Escape($Root) -and
    $_.CommandLine -match '(wsl-reverse-listen|win-reverse-agent)\.mjs'
  })
  return @($rows | ForEach-Object { [int]$_.ProcessId } | Sort-Object)
}

try {
  $identity = New-Scenario 'identity' 16729
  Use-Scenario $identity
  $startIdentity = Invoke-Ops 'proxy-start'
  Assert-NoLeak $startIdentity.Output
  if ($startIdentity.Code -ne 0) { throw ('identity scenario start failed: ' + $startIdentity.Output) }
  $identityState = Read-State $identity
  if ($null -eq $identityState) { throw 'identity scenario state missing' }
  Remember-State $identityState

  $identityPath = Join-Path $identity.Runtime 'proxy-state.json'
  $identityState.agent.startedUtcTicks = [Int64]$identityState.agent.startedUtcTicks + 1
  [IO.File]::WriteAllText($identityPath, ($identityState | ConvertTo-Json -Compress -Depth 4), $Utf8NoBom)
  $stopIdentity = Invoke-Ops 'proxy-stop'
  Assert-NoLeak $stopIdentity.Output
  if ($stopIdentity.Code -eq 0) { throw 'identity mismatch stop did not fail closed' }
  if ($stopIdentity.Output -match 'LOCAL_PROXY_STOPPED') { throw 'identity mismatch claimed stopped' }
  if (-not (Test-Path -LiteralPath $identityPath)) { throw 'identity mismatch deleted recovery state' }
  if ($null -eq (Get-Process -Id ([int]$identityState.agent.pid) -ErrorAction SilentlyContinue)) {
    throw 'identity mismatch process was killed'
  }
  if ($null -ne (Get-Process -Id ([int]$identityState.listener.pid) -ErrorAction SilentlyContinue)) {
    throw 'independently verifiable sibling was not stopped'
  }

  $malformed = New-Scenario 'malformed' 16739
  Use-Scenario $malformed
  $startMalformed = Invoke-Ops 'proxy-start'
  Assert-NoLeak $startMalformed.Output
  if ($startMalformed.Code -ne 0) { throw ('malformed scenario start failed: ' + $startMalformed.Output) }
  $malformedState = Read-State $malformed
  if ($null -eq $malformedState) { throw 'malformed scenario state missing' }
  Remember-State $malformedState

  $malformedPath = Join-Path $malformed.Runtime 'proxy-state.json'
  $beforePids = @(Proxy-PidsForRoot)
  [IO.File]::WriteAllText($malformedPath, '{', $Utf8NoBom)
  $restartMalformed = Invoke-Ops 'proxy-start'
  Assert-NoLeak $restartMalformed.Output
  if ($restartMalformed.Code -eq 0) { throw 'malformed state start did not fail closed' }
  if ($restartMalformed.Output -match 'LOCAL_PROXY_READY') { throw 'malformed state claimed ready' }
  if (-not (Test-Path -LiteralPath $malformedPath)) { throw 'malformed state was deleted' }
  if ([IO.File]::ReadAllText($malformedPath) -ne '{') { throw 'malformed state was rewritten' }
  $afterPids = @(Proxy-PidsForRoot)
  if (($beforePids -join ',') -ne ($afterPids -join ',')) { throw 'malformed start changed proxy process set' }

  $opsText = [IO.File]::ReadAllText($Ops)
  if ($opsText -notmatch '\$process\.Kill\(\)') { throw 'same Process object kill is missing' }
  if ($opsText -match 'Stop-Process\s+-Id\s+\$process\.Id') { throw 'PID was re-read for termination' }

  Write-Output 'POWERSHELL_PROXY_STATE_SAFETY_ZERO_SUT PASS'
}
finally {
  foreach ($record in $Known) { Stop-KnownProcess $record }
  if ($null -eq $oldSite) { Remove-Item Env:AT_SITE_JSON -ErrorAction SilentlyContinue } else { $env:AT_SITE_JSON = $oldSite }
  if ($null -eq $oldRuntime) { Remove-Item Env:CASEY_RUNTIME_DIR -ErrorAction SilentlyContinue } else { $env:CASEY_RUNTIME_DIR = $oldRuntime }
  foreach ($temp in $Temps) { Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue }
}
