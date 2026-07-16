#!/usr/bin/env node
// Windows 系统 helper 路径信任边界纯函数金牌：零 SUT、零进程启动、零真实凭据。
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveWindowsSystemTool } from '../../lib/account-config.mjs';

const ROOT = 'C:\\Windows';
const SYSTEM32 = path.win32.join(ROOT, 'System32');
const WHOAMI = path.win32.join(SYSTEM32, 'whoami.exe');

function modelFs({ system32Reparse = false, helperEscape = false, helperReparse = false } = {}) {
  const key = (value) => path.win32.normalize(String(value)).toLowerCase();
  return {
    realpath(value) {
      const normalized = key(value);
      if (normalized === key(ROOT)) return ROOT;
      if (normalized === key(SYSTEM32)) return system32Reparse ? 'D:\\escape\\System32' : SYSTEM32;
      if (normalized === key(WHOAMI)) return helperEscape ? 'D:\\escape\\whoami.exe' : WHOAMI;
      throw new Error('ENOENT');
    },
    lstat(value) {
      const normalized = key(value);
      if (normalized === key(ROOT)) {
        return { isDirectory: () => true, isFile: () => false, isSymbolicLink: () => false };
      }
      if (normalized === key(SYSTEM32)) {
        return { isDirectory: () => true, isFile: () => false, isSymbolicLink: () => system32Reparse };
      }
      if (normalized === key(WHOAMI)) {
        return { isDirectory: () => false, isFile: () => true, isSymbolicLink: () => helperReparse };
      }
      throw new Error('ENOENT');
    },
  };
}

function resolve(env, fsModel = modelFs()) {
  return resolveWindowsSystemTool('whoami.exe', {
    platform: 'win32',
    env,
    realpath: fsModel.realpath,
    lstat: fsModel.lstat,
  });
}

assert.equal(resolve({ SystemRoot: ROOT, WINDIR: ROOT }), WHOAMI);
assert.equal(resolve({ SystemRoot: 'C:\\Windows', WINDIR: 'c:\\WINDOWS' }), WHOAMI,
  '同一目录仅大小写不同应兼容');

for (const env of [
  { SystemRoot: 'relative-root', WINDIR: 'relative-root' },
  { SystemRoot: 'C:Windows', WINDIR: 'C:Windows' },
  { SystemRoot: '\\Windows', WINDIR: '\\Windows' },
  { SystemRoot: '\\\\server\\share\\Windows', WINDIR: '\\\\server\\share\\Windows' },
  { SystemRoot: 'C:\\Windows', WINDIR: 'D:\\Windows' },
]) {
  assert.throws(() => resolve(env), /ACCOUNT_PERMISSION_FAILED/);
}

assert.throws(() => resolve({ SystemRoot: ROOT, WINDIR: ROOT }, modelFs({ system32Reparse: true })),
  /ACCOUNT_PERMISSION_FAILED/, 'System32 重解析/逃逸必须拒绝');
assert.throws(() => resolve({ SystemRoot: ROOT, WINDIR: ROOT }, modelFs({ helperEscape: true })),
  /ACCOUNT_PERMISSION_FAILED/, 'helper canonical 路径逃出 System32 必须拒绝');
assert.throws(() => resolve({ SystemRoot: ROOT, WINDIR: ROOT }, modelFs({ helperReparse: true })),
  /ACCOUNT_PERMISSION_FAILED/, 'helper 自身是重解析点必须拒绝');
assert.throws(() => resolveWindowsSystemTool('cmd.exe', {
  platform: 'win32', env: { SystemRoot: ROOT, WINDIR: ROOT },
  realpath: modelFs().realpath, lstat: modelFs().lstat,
}), /ACCOUNT_PERMISSION_FAILED/, 'helper 名称须闭合白名单');

console.log('WINDOWS_SYSTEM_HELPER_TRUST_ZERO_SUT PASS');
