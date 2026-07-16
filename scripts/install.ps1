#requires -Version 5.1
[CmdletBinding()]
param(
  [switch]$VerifyOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))

function Get-NativeCommandPath {
  param([Parameter(Mandatory = $true)][string]$Name)
  $command = Get-Command $Name -ErrorAction Stop
  return $command.Source
}

function Invoke-Native {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [Parameter(Mandatory = $true)][string]$FailureCode
  )
  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw $FailureCode
  }
}

try {
  if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
    throw 'INSTALL_WINDOWS_REQUIRED'
  }
  if (-not [Environment]::Is64BitOperatingSystem) {
    throw 'INSTALL_64BIT_REQUIRED'
  }

  $Node = Get-NativeCommandPath 'node.exe'
  $versionText = (& $Node '--version' 2>$null | Out-String).Trim()
  if ($LASTEXITCODE -ne 0 -or -not $versionText.StartsWith('v')) {
    throw 'INSTALL_NODE_VERSION_INVALID'
  }
  try {
    $nodeVersion = New-Object Version ($versionText.Substring(1))
  } catch {
    throw 'INSTALL_NODE_VERSION_INVALID'
  }
  if ($nodeVersion -lt (New-Object Version '22.12.0')) {
    throw 'INSTALL_NODE_VERSION_UNSUPPORTED'
  }

  Push-Location -LiteralPath $Root
  try {
    if (-not $VerifyOnly) {
      $null = Get-NativeCommandPath 'git.exe'
      $Npm = Get-NativeCommandPath 'npm.cmd'
      $Npx = Get-NativeCommandPath 'npx.cmd'
      Invoke-Native $Npm @('install') 'INSTALL_NPM_FAILED'
      Invoke-Native $Npx @('playwright', 'install', 'chromium') 'INSTALL_CHROMIUM_FAILED'
      Invoke-Native $Npm @('run', 'verify:install') 'INSTALL_VERIFY_FAILED'
    } else {
      Invoke-Native $Node @((Join-Path $Root 'scripts\verify-install.mjs')) 'INSTALL_VERIFY_FAILED'
    }
  } finally {
    Pop-Location
  }
} catch {
  $code = [string]$_.Exception.Message
  if ($code -notmatch '^INSTALL_[A-Z0-9_]+$') {
    $code = 'INSTALL_FAILED'
  }
  [Console]::Error.WriteLine($code)
  exit 1
}

exit 0
