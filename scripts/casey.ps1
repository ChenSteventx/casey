#requires -Version 5.1
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet('verify', 'doctor', 'account-ai', 'account-doctor-hi', 'account-status', 'mcp-config', 'proxy-start', 'proxy-status', 'proxy-stop')]
  [string]$Action,

  [ValidateSet('claude', 'codex')]
  [string]$Agent
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$Node = (Get-Command node.exe -ErrorAction Stop).Source
$Cli = Join-Path $Root 'bin\casey.mjs'
$ListenerScript = Join-Path $Root 'scripts\wsl-reverse-listen.mjs'
$AgentScript = Join-Path $Root 'scripts\win-reverse-agent.mjs'
$ConfigScript = Join-Path $Root 'scripts\tunnel-config.mjs'
$Utf8NoBom = New-Object Text.UTF8Encoding($false)

if ([string]::IsNullOrWhiteSpace($env:CASEY_RUNTIME_DIR)) {
  $RuntimeDir = Join-Path $Root '.casey-runtime'
} else {
  $RuntimeDir = [IO.Path]::GetFullPath($env:CASEY_RUNTIME_DIR)
}
$StatePath = Join-Path $RuntimeDir 'proxy-state.json'
$ListenerOutLog = Join-Path $RuntimeDir 'listener.out.log'
$ListenerErrLog = Join-Path $RuntimeDir 'listener.err.log'
$AgentOutLog = Join-Path $RuntimeDir 'agent.out.log'
$AgentErrLog = Join-Path $RuntimeDir 'agent.err.log'

function Invoke-NodeAndExit {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)
  & $Node @Arguments
  exit $LASTEXITCODE
}

function Ensure-RuntimeDirectory {
  if (Test-Path -LiteralPath $RuntimeDir) {
    $item = Get-Item -LiteralPath $RuntimeDir -Force
    if (-not $item.PSIsContainer -or (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {
      throw 'PROXY_RUNTIME_UNSAFE'
    }
    return
  }
  New-Item -ItemType Directory -Path $RuntimeDir -Force | Out-Null
  $item = Get-Item -LiteralPath $RuntimeDir -Force
  if (-not $item.PSIsContainer -or (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0)) {
    throw 'PROXY_RUNTIME_UNSAFE'
  }
}

function Read-ProxyRuntimeConfig {
  $raw = & $Node $ConfigScript '--runtime' 2>$null | Out-String
  if ($LASTEXITCODE -ne 0) {
    throw 'PROXY_CONFIG_INVALID'
  }
  try {
    $config = $raw | ConvertFrom-Json
  } catch {
    throw 'PROXY_CONFIG_INVALID'
  }
  $properties = @($config.PSObject.Properties.Name | Sort-Object)
  if (($properties -join ',') -ne 'clientPort,tunnelPort') {
    throw 'PROXY_CONFIG_INVALID'
  }
  $clientPort = 0
  $tunnelPort = 0
  if (-not [int]::TryParse([string]$config.clientPort, [ref]$clientPort)) {
    throw 'PROXY_CONFIG_INVALID'
  }
  if (-not [int]::TryParse([string]$config.tunnelPort, [ref]$tunnelPort)) {
    throw 'PROXY_CONFIG_INVALID'
  }
  if ($clientPort -lt 1 -or $clientPort -gt 65534 -or $tunnelPort -ne ($clientPort + 1)) {
    throw 'PROXY_CONFIG_INVALID'
  }
  return @{ ClientPort = $clientPort; TunnelPort = $tunnelPort }
}

function New-TunnelToken {
  $bytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($bytes)
  } finally {
    $rng.Dispose()
  }
  return [Convert]::ToBase64String($bytes)
}

function Save-EnvironmentValue {
  param([Parameter(Mandatory = $true)][string]$Name)
  return @{
    Exists = Test-Path -LiteralPath ('Env:' + $Name)
    Value = [Environment]::GetEnvironmentVariable($Name, 'Process')
  }
}

function Restore-EnvironmentValue {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][hashtable]$Saved
  )
  if ($Saved.Exists) {
    [Environment]::SetEnvironmentVariable($Name, [string]$Saved.Value, 'Process')
  } else {
    [Environment]::SetEnvironmentVariable($Name, $null, 'Process')
  }
}

function Start-ProxyProcess {
  param(
    [Parameter(Mandatory = $true)][string]$ScriptPath,
    [Parameter(Mandatory = $true)][string]$OutLog,
    [Parameter(Mandatory = $true)][string]$ErrLog
  )
  if (Test-Path -LiteralPath $OutLog) { Remove-Item -LiteralPath $OutLog -Force }
  if (Test-Path -LiteralPath $ErrLog) { Remove-Item -LiteralPath $ErrLog -Force }
  $quotedScript = '"' + $ScriptPath + '"'
  return Start-Process -FilePath $Node -ArgumentList $quotedScript -WorkingDirectory $Root -WindowStyle Hidden -RedirectStandardOutput $OutLog -RedirectStandardError $ErrLog -PassThru
}

function Get-ProcessCommandLine {
  param([Parameter(Mandatory = $true)][int]$ProcessId)
  $row = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $ProcessId) -ErrorAction Stop
  if ($null -eq $row -or [string]::IsNullOrWhiteSpace([string]$row.CommandLine)) {
    throw 'PROXY_IDENTITY_INVALID'
  }
  return [string]$row.CommandLine
}

function Test-ProcessIdentity {
  param(
    [Parameter(Mandatory = $true)]$Entry,
    [Parameter(Mandatory = $true)][string]$ExpectedScript
  )
  try {
    $pidValue = 0
    $ticksValue = 0L
    if (-not [int]::TryParse([string]$Entry.pid, [ref]$pidValue)) { return $false }
    if (-not [Int64]::TryParse([string]$Entry.startedUtcTicks, [ref]$ticksValue)) { return $false }
    $process = Get-Process -Id $pidValue -ErrorAction Stop
    if ($process.StartTime.ToUniversalTime().Ticks -ne $ticksValue) { return $false }
    $commandLine = Get-ProcessCommandLine $pidValue
    if ($commandLine -notmatch [regex]::Escape($ExpectedScript)) { return $false }
    if ($commandLine -notmatch [regex]::Escape($Node)) { return $false }
    return $true
  } catch {
    return $false
  }
}

function Read-ProxyState {
  if (-not (Test-Path -LiteralPath $StatePath)) { return $null }
  try {
    $item = Get-Item -LiteralPath $StatePath -Force
    if ($item.PSIsContainer -or (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) -or $item.Length -gt 4096) {
      return $null
    }
    $state = [IO.File]::ReadAllText($StatePath) | ConvertFrom-Json
    $top = @($state.PSObject.Properties.Name | Sort-Object)
    if (($top -join ',') -ne 'agent,listener,schemaVersion') { return $null }
    if ([int]$state.schemaVersion -ne 1) { return $null }
    foreach ($entry in @($state.listener, $state.agent)) {
      $entryKeys = @($entry.PSObject.Properties.Name | Sort-Object)
      if (($entryKeys -join ',') -ne 'pid,startedUtcTicks') { return $null }
    }
    return $state
  } catch {
    return $null
  }
}

function Write-ProxyState {
  param(
    [Parameter(Mandatory = $true)]$Listener,
    [Parameter(Mandatory = $true)]$AgentProcess
  )
  $state = [ordered]@{
    schemaVersion = 1
    listener = [ordered]@{
      pid = [int]$Listener.Id
      startedUtcTicks = [Int64]$Listener.StartTime.ToUniversalTime().Ticks
    }
    agent = [ordered]@{
      pid = [int]$AgentProcess.Id
      startedUtcTicks = [Int64]$AgentProcess.StartTime.ToUniversalTime().Ticks
    }
  }
  $body = $state | ConvertTo-Json -Compress -Depth 4
  $tempPath = Join-Path $RuntimeDir ('.proxy-state.' + $PID + '.tmp')
  [IO.File]::WriteAllText($tempPath, $body, $Utf8NoBom)
  if (Test-Path -LiteralPath $StatePath) { Remove-Item -LiteralPath $StatePath -Force }
  Move-Item -LiteralPath $tempPath -Destination $StatePath
}

function Test-ListeningPort {
  param(
    [Parameter(Mandatory = $true)][int]$Port,
    [Parameter(Mandatory = $true)][int]$OwnerPid
  )
  try {
    $rows = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop)
    if ($rows.Count -ne 1) { return $false }
    $row = $rows[0]
    if ([int]$row.OwningProcess -ne $OwnerPid) { return $false }
    return @('127.0.0.1', '::1') -contains [string]$row.LocalAddress
  } catch {
    return $false
  }
}

function Wait-ProxyReady {
  param(
    [Parameter(Mandatory = $true)]$Listener,
    [Parameter(Mandatory = $true)]$AgentProcess,
    [Parameter(Mandatory = $true)][hashtable]$Config
  )
  $deadline = [DateTime]::UtcNow.AddSeconds(10)
  do {
    $Listener.Refresh()
    $AgentProcess.Refresh()
    if ($Listener.HasExited -or $AgentProcess.HasExited) { return $false }
    $clientReady = Test-ListeningPort $Config.ClientPort $Listener.Id
    $tunnelReady = Test-ListeningPort $Config.TunnelPort $Listener.Id
    if ($clientReady -and $tunnelReady) { return $true }
    Start-Sleep -Milliseconds 100
  } while ([DateTime]::UtcNow -lt $deadline)
  return $false
}

function Stop-VerifiedProcess {
  param(
    [Parameter(Mandatory = $true)]$Entry,
    [Parameter(Mandatory = $true)][string]$ExpectedScript
  )
  if (-not (Test-ProcessIdentity $Entry $ExpectedScript)) {
    throw 'PROXY_IDENTITY_INVALID'
  }
  $process = Get-Process -Id ([int]$Entry.pid) -ErrorAction Stop
  Stop-Process -Id $process.Id -Force -ErrorAction Stop
  try { $process.WaitForExit(3000) | Out-Null } catch {}
}

function Stop-StartedProcess {
  param($Process)
  if ($null -eq $Process) { return }
  try {
    $Process.Refresh()
    if (-not $Process.HasExited) {
      Stop-Process -Id $Process.Id -Force -ErrorAction SilentlyContinue
      try { $Process.WaitForExit(3000) | Out-Null } catch {}
    }
  } catch {}
}

function Invoke-ProxyStart {
  $listener = $null
  $agentProcess = $null
  try {
    Ensure-RuntimeDirectory
    if (Test-Path -LiteralPath $StatePath) {
      $existing = Read-ProxyState
      if ($null -ne $existing -and (Test-ProcessIdentity $existing.listener $ListenerScript) -and (Test-ProcessIdentity $existing.agent $AgentScript)) {
        throw 'PROXY_ALREADY_RUNNING'
      }
      Remove-Item -LiteralPath $StatePath -Force -ErrorAction SilentlyContinue
    }
    $config = Read-ProxyRuntimeConfig
    $savedToken = Save-EnvironmentValue 'CASEY_TUNNEL_TOKEN'
    $savedBind = Save-EnvironmentValue 'CASEY_TUNNEL_BIND'
    $savedHost = Save-EnvironmentValue 'CASEY_TUNNEL_HOST'
    try {
      [Environment]::SetEnvironmentVariable('CASEY_TUNNEL_TOKEN', (New-TunnelToken), 'Process')
      [Environment]::SetEnvironmentVariable('CASEY_TUNNEL_BIND', '127.0.0.1', 'Process')
      [Environment]::SetEnvironmentVariable('CASEY_TUNNEL_HOST', '127.0.0.1', 'Process')
      $listener = Start-ProxyProcess $ListenerScript $ListenerOutLog $ListenerErrLog
      Start-Sleep -Milliseconds 150
      $agentProcess = Start-ProxyProcess $AgentScript $AgentOutLog $AgentErrLog
    } finally {
      Restore-EnvironmentValue 'CASEY_TUNNEL_TOKEN' $savedToken
      Restore-EnvironmentValue 'CASEY_TUNNEL_BIND' $savedBind
      Restore-EnvironmentValue 'CASEY_TUNNEL_HOST' $savedHost
    }
    if (-not (Wait-ProxyReady $listener $agentProcess $config)) {
      throw 'PROXY_NOT_READY'
    }
    Write-ProxyState $listener $agentProcess
    Write-Output 'LOCAL_PROXY_READY REAL_SUT_HTTP_NOT_VERIFIED'
    return 0
  } catch {
    Stop-StartedProcess $agentProcess
    Stop-StartedProcess $listener
    if (Test-Path -LiteralPath $StatePath) { Remove-Item -LiteralPath $StatePath -Force -ErrorAction SilentlyContinue }
    $code = [string]$_.Exception.Message
    if ($code -notmatch '^PROXY_[A-Z0-9_]+$') { $code = 'PROXY_START_FAILED' }
    [Console]::Error.WriteLine($code)
    return 1
  }
}

function Invoke-ProxyStatus {
  try {
    Ensure-RuntimeDirectory
    $state = Read-ProxyState
    if ($null -eq $state) { throw 'PROXY_STATE_INVALID' }
    if (-not (Test-ProcessIdentity $state.listener $ListenerScript)) { throw 'PROXY_IDENTITY_INVALID' }
    if (-not (Test-ProcessIdentity $state.agent $AgentScript)) { throw 'PROXY_IDENTITY_INVALID' }
    $config = Read-ProxyRuntimeConfig
    if (-not (Test-ListeningPort $config.ClientPort ([int]$state.listener.pid))) { throw 'PROXY_NOT_READY' }
    if (-not (Test-ListeningPort $config.TunnelPort ([int]$state.listener.pid))) { throw 'PROXY_NOT_READY' }
    Write-Output 'LOCAL_PROXY_READY REAL_SUT_HTTP_NOT_VERIFIED'
    return 0
  } catch {
    [Console]::Error.WriteLine('LOCAL_PROXY_NOT_READY')
    return 1
  }
}

function Invoke-ProxyStop {
  try {
    if (-not (Test-Path -LiteralPath $RuntimeDir)) {
      Write-Output 'LOCAL_PROXY_STOPPED'
      return 0
    }
    Ensure-RuntimeDirectory
    if (-not (Test-Path -LiteralPath $StatePath)) {
      Write-Output 'LOCAL_PROXY_STOPPED'
      return 0
    }
    $state = Read-ProxyState
    if ($null -eq $state) { throw 'PROXY_STATE_INVALID' }
    Stop-VerifiedProcess $state.agent $AgentScript
    Stop-VerifiedProcess $state.listener $ListenerScript
    Remove-Item -LiteralPath $StatePath -Force
    Write-Output 'LOCAL_PROXY_STOPPED'
    return 0
  } catch {
    [Console]::Error.WriteLine('PROXY_STOP_FAILED')
    return 1
  }
}

if ($Action -ne 'mcp-config' -and $PSBoundParameters.ContainsKey('Agent')) {
  [Console]::Error.WriteLine('AGENT_ONLY_FOR_MCP_CONFIG')
  exit 64
}

switch ($Action) {
  'verify' {
    Invoke-NodeAndExit @((Join-Path $Root 'scripts\verify-install.mjs'))
  }
  'doctor' {
    Invoke-NodeAndExit @($Cli, 'doctor', '--real-sut')
  }
  'account-ai' {
    Invoke-NodeAndExit @($Cli, 'account', 'configure', 'ai-middle')
  }
  'account-doctor-hi' {
    Invoke-NodeAndExit @($Cli, 'account', 'configure', 'doctor-hi')
  }
  'account-status' {
    Invoke-NodeAndExit @($Cli, 'account', 'status', '--json')
  }
  'mcp-config' {
    if (-not $PSBoundParameters.ContainsKey('Agent')) {
      [Console]::Error.WriteLine('MCP_AGENT_REQUIRED')
      exit 64
    }
    Invoke-NodeAndExit @($Cli, 'mcp-config', '--agent', $Agent)
  }
  'proxy-start' {
    exit (Invoke-ProxyStart)
  }
  'proxy-status' {
    exit (Invoke-ProxyStatus)
  }
  'proxy-stop' {
    exit (Invoke-ProxyStop)
  }
}
