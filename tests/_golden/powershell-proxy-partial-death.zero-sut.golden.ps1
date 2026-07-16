#requires -Version 5.1
# Zero-SUT lifecycle regression: kill one proxy sibling and require safe cleanup of the other.
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$Root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$Ops = Join-Path $Root 'scripts\casey.ps1'
$HostExe = (Get-Process -Id $PID).Path
$temp = Join-Path ([IO.Path]::GetTempPath()) ('casey-proxy-partial-' + [Guid]::NewGuid().ToString('N'))
$runtime = Join-Path $temp 'runtime'
$site = Join-Path $temp 'site.json'
$knownPids = New-Object Collections.Generic.List[int]

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

function Read-State {
  $path = Join-Path $runtime 'proxy-state.json'
  if (-not (Test-Path -LiteralPath $path)) { return $null }
  return [IO.File]::ReadAllText($path) | ConvertFrom-Json
}

function Remember-State($state) {
  foreach ($entry in @($state.listener, $state.agent)) {
    $pidValue = [int]$entry.pid
    if (-not $knownPids.Contains($pidValue)) { $knownPids.Add($pidValue) }
  }
}

function Assert-NoLeak([string]$text) {
  if ($text -match 'powershell-partial-canary|CASEY_TUNNEL_TOKEN|://') { throw 'proxy output leaked protected material' }
}

New-Item -ItemType Directory -Path $temp | Out-Null
[IO.File]::WriteAllText($site, '{"target":{"startUrl":"http://powershell-partial-canary.invalid/login","devProxyUrl":"http://127.0.0.1:16529"}}', (New-Object Text.UTF8Encoding($false)))
$oldSite = $env:AT_SITE_JSON
$oldRuntime = $env:CASEY_RUNTIME_DIR
$env:AT_SITE_JSON = $site
$env:CASEY_RUNTIME_DIR = $runtime

try {
  $first = Invoke-Ops 'proxy-start'
  Assert-NoLeak $first.Output
  if ($first.Code -ne 0) { throw ('first start failed: ' + $first.Output) }
  $state = Read-State
  if ($null -eq $state) { throw 'first state missing' }
  Remember-State $state
  Stop-Process -Id ([int]$state.agent.pid) -Force
  Start-Sleep -Milliseconds 300

  $restart = Invoke-Ops 'proxy-start'
  Assert-NoLeak $restart.Output
  if ($restart.Code -eq 0) { throw 'restart with surviving listener must fail closed' }
  if ($null -eq (Read-State)) { throw 'partial restart deleted recovery state' }

  $stopAfterAgentDeath = Invoke-Ops 'proxy-stop'
  Assert-NoLeak $stopAfterAgentDeath.Output
  if ($stopAfterAgentDeath.Code -ne 0) { throw ('stop after agent death failed: ' + $stopAfterAgentDeath.Output) }
  if ($null -ne (Read-State)) { throw 'state remains after agent-death cleanup' }
  if (Get-Process -Id ([int]$state.listener.pid) -ErrorAction SilentlyContinue) { throw 'listener survived cleanup' }

  $second = Invoke-Ops 'proxy-start'
  Assert-NoLeak $second.Output
  if ($second.Code -ne 0) { throw ('second start failed: ' + $second.Output) }
  $state2 = Read-State
  if ($null -eq $state2) { throw 'second state missing' }
  Remember-State $state2
  Stop-Process -Id ([int]$state2.listener.pid) -Force
  Start-Sleep -Milliseconds 300

  $stopAfterListenerDeath = Invoke-Ops 'proxy-stop'
  Assert-NoLeak $stopAfterListenerDeath.Output
  if ($stopAfterListenerDeath.Code -ne 0) { throw ('stop after listener death failed: ' + $stopAfterListenerDeath.Output) }
  if ($null -ne (Read-State)) { throw 'state remains after listener-death cleanup' }
  if (Get-Process -Id ([int]$state2.agent.pid) -ErrorAction SilentlyContinue) { throw 'agent survived cleanup' }
  if (Get-NetTCPConnection -State Listen -LocalPort 16529,16530 -ErrorAction SilentlyContinue) { throw 'partial-death cleanup left listeners' }

  Write-Output 'POWERSHELL_PROXY_PARTIAL_DEATH_ZERO_SUT PASS'
}
finally {
  foreach ($pidValue in $knownPids) {
    try {
      $row = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $pidValue) -ErrorAction SilentlyContinue
      if ($null -ne $row -and $row.CommandLine -match 'casey-public-powershell.*(wsl-reverse-listen|win-reverse-agent)') {
        Stop-Process -Id $pidValue -Force -ErrorAction SilentlyContinue
      }
    } catch {}
  }
  if ($null -eq $oldSite) { Remove-Item Env:AT_SITE_JSON -ErrorAction SilentlyContinue } else { $env:AT_SITE_JSON = $oldSite }
  if ($null -eq $oldRuntime) { Remove-Item Env:CASEY_RUNTIME_DIR -ErrorAction SilentlyContinue } else { $env:CASEY_RUNTIME_DIR = $oldRuntime }
  Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue
}
