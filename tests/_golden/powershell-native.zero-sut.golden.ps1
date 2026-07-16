#requires -Version 5.1
# Real Windows PowerShell/Pwsh shell acceptance. It starts loopback processes but sends no HTTP request.
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$Root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$Ops = Join-Path $Root 'scripts\casey.ps1'
$Install = Join-Path $Root 'scripts\install.ps1'
$Node = (Get-Command node.exe -ErrorAction Stop).Source
$HostExe = (Get-Process -Id $PID).Path
$Passed = 0

function Pass([string]$Name) {
  $script:Passed++
  Write-Output ("PASS " + $Name)
}

function Invoke-ChildPowerShell([string]$Script, [string[]]$Arguments) {
  $all = @('-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', $Script) + $Arguments
  $output = & $HostExe @all 2>&1 | Out-String
  return @{ Code = $LASTEXITCODE; Output = $output }
}

$temp = Join-Path ([IO.Path]::GetTempPath()) ('casey-powershell-' + [Guid]::NewGuid().ToString('N'))
$runtime = Join-Path $temp 'runtime'
$site = Join-Path $temp 'site.json'
New-Item -ItemType Directory -Path $temp | Out-Null
$siteBody = '{"target":{"startUrl":"http://powershell-target-canary.invalid/login","devProxyUrl":"http://127.0.0.1:16519"}}'
[IO.File]::WriteAllText($site, $siteBody, (New-Object Text.UTF8Encoding($false)))
$oldSite = $env:AT_SITE_JSON
$oldRuntime = $env:CASEY_RUNTIME_DIR
$env:AT_SITE_JSON = $site
$env:CASEY_RUNTIME_DIR = $runtime

try {
  foreach ($file in @($Install, $Ops, $PSCommandPath)) {
    $tokens = $null
    $errors = $null
    [Management.Automation.Language.Parser]::ParseFile($file, [ref]$tokens, [ref]$errors) | Out-Null
    if ($errors.Count -ne 0) { throw ("PowerShell parse failed: " + $file) }
  }
  Pass 'PowerShell 5.1 parser'

  $verify = Invoke-ChildPowerShell $Install @('-VerifyOnly')
  if ($verify.Code -ne 0 -or $verify.Output -notmatch 'REAL_SUT NOT_VERIFIED') { throw ('install -VerifyOnly failed: ' + $verify.Output) }
  Pass 'install remains REAL_SUT NOT_VERIFIED'

  $static = & $Node (Join-Path $Root 'tests\_golden\powershell-native.static.golden.mjs') 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) { throw ('Windows Node static acceptance failed: ' + $static) }
  Pass 'Windows Node zero-SUT acceptance'

  $aclRoot = Join-Path $temp 'acl-case'
  $authDir = Join-Path $aclRoot '.auth'
  New-Item -ItemType Directory -Path $aclRoot | Out-Null
  $env:CASEY_TEST_AUTH_DIR = $authDir
  $env:AT_CREDS_USER = 'powershell-account-user-canary'
  $env:AT_CREDS_PASS = 'powershell-account-pass-canary'
  $aclOutput = & $Node (Join-Path $Root 'tests\_golden\powershell-account-acl-helper.mjs') 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0 -or $aclOutput -match 'powershell-account') { throw ('ACL account write failed or leaked: ' + $aclOutput) }
  $broad = @('S-1-1-0', 'S-1-5-11', 'S-1-5-32-545')
  foreach ($securedPath in @($authDir, (Join-Path $authDir 'credentials.json'))) {
    $acl = Get-Acl -LiteralPath $securedPath
    if (-not $acl.AreAccessRulesProtected) { throw 'account ACL still inherits' }
    foreach ($rule in $acl.Access) {
      try { $sid = $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value } catch { $sid = '' }
      if ($rule.AccessControlType -eq [Security.AccessControl.AccessControlType]::Allow -and $broad -contains $sid) {
        throw ('broad account ACL remains: ' + $sid)
      }
    }
  }
  $junctionRoot = Join-Path $temp 'junction-case'
  $junctionTarget = Join-Path $temp 'junction-target'
  New-Item -ItemType Directory -Path $junctionRoot | Out-Null
  New-Item -ItemType Directory -Path $junctionTarget | Out-Null
  New-Item -ItemType Junction -Path (Join-Path $junctionRoot '.auth') -Target $junctionTarget | Out-Null
  $env:CASEY_TEST_AUTH_DIR = Join-Path $junctionRoot '.auth'
  $junctionOutput = & $Node (Join-Path $Root 'tests\_golden\powershell-account-acl-helper.mjs') 2>&1 | Out-String
  if ($LASTEXITCODE -eq 0 -or $junctionOutput -match 'powershell-account') { throw 'junction account path was accepted or leaked' }
  Remove-Item Env:CASEY_TEST_AUTH_DIR -ErrorAction SilentlyContinue
  Remove-Item Env:AT_CREDS_USER -ErrorAction SilentlyContinue
  Remove-Item Env:AT_CREDS_PASS -ErrorAction SilentlyContinue
  Pass 'Windows account ACL and junction rejection'

  foreach ($item in @(
    @{ Args = @('verify'); Marker = 'REAL_SUT NOT_VERIFIED' },
    @{ Args = @('account-status'); Marker = 'automaticLogin' },
    @{ Args = @('mcp-config', '-Agent', 'codex'); Marker = '[mcp_servers.casey]' },
    @{ Args = @('mcp-config', '-Agent', 'claude'); Marker = 'mcpServers' }
  )) {
    $r = Invoke-ChildPowerShell $Ops $item.Args
    if ($r.Code -ne 0 -or $r.Output -notmatch [regex]::Escape($item.Marker)) { throw ('operation failed: ' + ($item.Args -join ' ') + "`n" + $r.Output) }
    if ($r.Output -match 'powershell-target-canary') { throw 'operation output leaked target canary' }
  }
  Pass 'PowerShell verify/account/MCP operations'

  $doctor = Invoke-ChildPowerShell $Ops @('doctor')
  if ($doctor.Code -eq 0 -or $doctor.Output -notmatch 'REAL_SUT_HTTP_NOT_VERIFIED') { throw ('real-SUT doctor should fail without account: ' + $doctor.Output) }
  Pass 'real-SUT doctor fails closed'

  $start = Invoke-ChildPowerShell $Ops @('proxy-start')
  if ($start.Code -ne 0) { throw ('proxy-start failed: ' + $start.Output) }
  if ($start.Output -match 'powershell-target-canary|://') { throw 'proxy-start leaked target' }
  $statePath = Join-Path $runtime 'proxy-state.json'
  if (-not (Test-Path -LiteralPath $statePath)) { throw 'proxy state missing' }
  $stateRaw = [IO.File]::ReadAllText($statePath)
  if ($stateRaw -match 'powershell-target-canary|://|token') { throw 'state contains target or token' }
  $state = $stateRaw | ConvertFrom-Json
  foreach ($entry in @($state.listener, $state.agent)) {
    $process = Get-Process -Id ([int]$entry.pid) -ErrorAction Stop
    $ticks = $process.StartTime.ToUniversalTime().Ticks
    if ($ticks -ne [Int64]$entry.startedUtcTicks) { throw 'process identity mismatch' }
    $cmd = (Get-CimInstance Win32_Process -Filter ("ProcessId=" + $entry.pid)).CommandLine
    if ($cmd -match 'powershell-target-canary|://') { throw 'target entered process argv' }
  }
  $listeners = @(Get-NetTCPConnection -State Listen -LocalPort 16519,16520 -ErrorAction Stop)
  if ($listeners.Count -ne 2 -or @($listeners | Where-Object { $_.LocalAddress -notin @('127.0.0.1', '::1') }).Count -ne 0) {
    throw 'proxy ports are not loopback-only'
  }
  foreach ($log in @(Get-ChildItem -LiteralPath $runtime -Filter '*.log' -ErrorAction SilentlyContinue)) {
    if ([IO.File]::ReadAllText($log.FullName) -match 'powershell-target-canary|://') { throw 'proxy log leaked target' }
  }
  Pass 'PowerShell proxy processes and loopback binding'

  $again = Invoke-ChildPowerShell $Ops @('proxy-start')
  if ($again.Code -eq 0) { throw 'duplicate proxy-start did not fail closed' }
  $status = Invoke-ChildPowerShell $Ops @('proxy-status')
  if ($status.Code -ne 0 -or $status.Output -notmatch 'LOCAL_PROXY_READY') { throw ('proxy-status failed: ' + $status.Output) }
  Pass 'duplicate start and identity-bound status'

  $stop = Invoke-ChildPowerShell $Ops @('proxy-stop')
  if ($stop.Code -ne 0) { throw ('proxy-stop failed: ' + $stop.Output) }
  Start-Sleep -Milliseconds 300
  if (Test-Path -LiteralPath $statePath) { throw 'proxy-stop left state' }
  if (@(Get-NetTCPConnection -State Listen -LocalPort 16519,16520 -ErrorAction SilentlyContinue).Count -ne 0) { throw 'proxy-stop left listeners' }
  Pass 'PowerShell proxy cleanup'
}
finally {
  try { Invoke-ChildPowerShell $Ops @('proxy-stop') | Out-Null } catch {}
  Remove-Item Env:CASEY_TEST_AUTH_DIR -ErrorAction SilentlyContinue
  Remove-Item Env:AT_CREDS_USER -ErrorAction SilentlyContinue
  Remove-Item Env:AT_CREDS_PASS -ErrorAction SilentlyContinue
  if ($null -eq $oldSite) { Remove-Item Env:AT_SITE_JSON -ErrorAction SilentlyContinue } else { $env:AT_SITE_JSON = $oldSite }
  if ($null -eq $oldRuntime) { Remove-Item Env:CASEY_RUNTIME_DIR -ErrorAction SilentlyContinue } else { $env:CASEY_RUNTIME_DIR = $oldRuntime }
  Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Output ("SUMMARY " + $Passed + "/9 PASS")
