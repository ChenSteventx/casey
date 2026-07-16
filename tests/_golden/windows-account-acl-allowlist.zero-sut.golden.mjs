#!/usr/bin/env node
// Windows 账户 ACL allow 白名单金牌：只写 OS 临时目录、只用合成 canary，不连接任何 SUT。
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { inspectAccountAcl, writeAiMiddleAccount } from '../../lib/account-config.mjs';

if (process.platform !== 'win32') {
  console.log('WINDOWS_ACCOUNT_ACL_ALLOWLIST_ZERO_SUT SKIP non-win32');
  process.exit(0);
}

const systemRoot = process.env.SystemRoot;
const icacls = path.join(systemRoot, 'System32', 'icacls.exe');
const whoami = path.join(systemRoot, 'System32', 'whoami.exe');
const powershell = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
const sidRun = spawnSync(whoami, ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true });
const currentSid = String(sidRun.stdout || '').match(/S-\d-(?:\d+-)+\d+/)?.[0];
assert.equal(sidRun.status, 0);
assert.ok(currentSid);

function runIcacls(args) {
  const run = spawnSync(icacls, args, { encoding: 'utf8', windowsHide: true });
  assert.equal(run.status, 0, 'icacls setup failed');
}

function aclSids(target) {
  const script = [
    '$a=Get-Acl -LiteralPath $env:CASEY_ACL_TEST_PATH',
    'foreach($r in $a.Access){try{$r.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value}catch{}}',
  ].join(';');
  const run = spawnSync(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8', windowsHide: true,
    env: { ...process.env, CASEY_ACL_TEST_PATH: target },
  });
  assert.equal(run.status, 0, 'ACL SID projection failed');
  return new Set(String(run.stdout || '').split(/\r?\n/).map((value) => value.trim()).filter(Boolean));
}

function freshAccount() {
  const root = mkdtempSync(path.join(tmpdir(), 'casey-acl-allowlist-'));
  const authDir = path.join(root, '.auth');
  writeAiMiddleAccount({ authDir, user: 'acl-user-canary', pass: 'acl-pass-canary' });
  return { root, authDir, file: path.join(authDir, 'credentials.json') };
}

function restoreCurrentUserFullControl(target, kind) {
  const script = [
    '$p=$env:CASEY_ACL_CLEANUP_PATH',
    '$isDir=$env:CASEY_ACL_CLEANUP_KIND -eq "directory"',
    '$acl=if($isDir){[IO.Directory]::GetAccessControl($p)}else{[IO.File]::GetAccessControl($p)}',
    '$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User',
    '$inherit=if($isDir){[Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [Security.AccessControl.InheritanceFlags]::ObjectInherit}else{[Security.AccessControl.InheritanceFlags]::None}',
    '$rule=[Security.AccessControl.FileSystemAccessRule]::new($sid,[Security.AccessControl.FileSystemRights]::FullControl,$inherit,[Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow)',
    '$acl.SetAccessRule($rule)',
    'if($isDir){[IO.Directory]::SetAccessControl($p,$acl)}else{[IO.File]::SetAccessControl($p,$acl)}',
  ].join(';');
  const run = spawnSync(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8', windowsHide: true,
    env: {
      ...process.env,
      CASEY_ACL_CLEANUP_PATH: target,
      CASEY_ACL_CLEANUP_KIND: kind,
    },
  });
  assert.equal(run.status, 0, `ACL cleanup restore failed for ${kind}`);
}

let checks = 0;
function check(name, fn) {
  const state = freshAccount();
  try {
    fn(state);
    checks++;
    console.log(`PASS ${name}`);
  } finally {
    // “当前用户非 FullControl”反向样例会刻意移除删除权；先恢复测试临时树权限再清理。
    restoreCurrentUserFullControl(state.file, 'file');
    restoreCurrentUserFullControl(state.authDir, 'directory');
    rmSync(state.root, { recursive: true, force: true });
  }
}

check('Guests Allow 令 ACL fail-closed', ({ authDir }) => {
  runIcacls([authDir, '/grant', '*S-1-5-32-546:(OI)(CI)RX']);
  assert.equal(inspectAccountAcl({ authDir }).safe, false);
});

check('任意非白名单主体 Allow 令 ACL fail-closed', ({ authDir, file }) => {
  runIcacls([file, '/grant', '*S-1-5-19:R']);
  assert.equal(inspectAccountAcl({ authDir }).safe, false);
});

check('当前用户非 FullControl 令 ACL fail-closed', ({ authDir, file }) => {
  runIcacls([file, '/grant:r', `*${currentSid}:R`]);
  assert.equal(inspectAccountAcl({ authDir }).safe, false);
});

check('再次写入会清除既有非白名单 Allow', ({ authDir, file }) => {
  runIcacls([authDir, '/grant', '*S-1-5-32-546:(OI)(CI)RX']);
  runIcacls([file, '/grant', '*S-1-5-19:R']);
  writeAiMiddleAccount({ authDir, user: 'acl-user-canary-2', pass: 'acl-pass-canary-2' });
  assert.equal(inspectAccountAcl({ authDir }).safe, true);
  for (const target of [authDir, file]) {
    const sids = aclSids(target);
    assert.deepEqual([...sids].filter((sid) => ![currentSid, 'S-1-5-18', 'S-1-5-32-544'].includes(sid)), []);
  }
});

console.log(`WINDOWS_ACCOUNT_ACL_ALLOWLIST_ZERO_SUT PASS ${checks}/4`);
