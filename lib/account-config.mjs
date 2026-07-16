// Casey 本地账户配置：唯一写面在 .auth/；状态投影只含形状和能力，不含任何账户值或路径。
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { AUTH_DIR } from './paths.mjs';

const fail = (code) => new Error(code);
const AI_FILE = 'credentials.json';
const DESKTOP_FILE = 'desktop-account.json';
const REF_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;

const plainObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, allowed) => plainObject(value)
  && Object.keys(value).every((key) => allowed.has(key))
  && [...allowed].every((key) => Object.prototype.hasOwnProperty.call(value, key));
const nonempty = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max;

function assertAuthDir(authDir) {
  const resolved = path.resolve(String(authDir || ''));
  if (path.basename(resolved) !== '.auth') throw fail('ACCOUNT_DIR_INVALID');
  if (fs.existsSync(resolved)) {
    let stat;
    try { stat = fs.lstatSync(resolved); } catch { throw fail('ACCOUNT_PATH_UNSAFE'); }
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw fail('ACCOUNT_PATH_UNSAFE');
  }
  return resolved;
}

const WINDOWS_SYSTEM_TOOLS = Object.freeze({
  'whoami.exe': ['System32', 'whoami.exe'],
  'icacls.exe': ['System32', 'icacls.exe'],
  'powershell.exe': ['System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'],
});

const windowsPathKey = (value) => path.win32.normalize(String(value)).toLowerCase();
const isLocalDriveAbsolute = (value) => typeof value === 'string'
  && /^[A-Za-z]:[\\/]/.test(value)
  && path.win32.isAbsolute(value);

export function resolveWindowsSystemTool(name, {
  platform = process.platform,
  env = process.env,
  realpath = fs.realpathSync.native,
  lstat = fs.lstatSync,
} = {}) {
  try {
    if (platform !== 'win32' || !Object.prototype.hasOwnProperty.call(WINDOWS_SYSTEM_TOOLS, name)) {
      throw fail('ACCOUNT_PERMISSION_FAILED');
    }
    const rawRoots = [env?.SystemRoot, env?.WINDIR]
      .filter((value) => typeof value === 'string' && value.length > 0);
    if (rawRoots.length === 0 || rawRoots.some((value) => !isLocalDriveAbsolute(value))) {
      throw fail('ACCOUNT_PERMISSION_FAILED');
    }
    const roots = rawRoots.map((value) => realpath(value));
    if (roots.some((value) => !isLocalDriveAbsolute(value))) throw fail('ACCOUNT_PERMISSION_FAILED');
    if (roots.some((value) => windowsPathKey(value) !== windowsPathKey(roots[0]))) {
      throw fail('ACCOUNT_PERMISSION_FAILED');
    }
    const root = roots[0];
    const rootStat = lstat(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw fail('ACCOUNT_PERMISSION_FAILED');

    const system32Lexical = path.win32.join(root, 'System32');
    const system32Stat = lstat(system32Lexical);
    if (!system32Stat.isDirectory() || system32Stat.isSymbolicLink()) throw fail('ACCOUNT_PERMISSION_FAILED');
    const system32 = realpath(system32Lexical);
    if (windowsPathKey(system32) !== windowsPathKey(system32Lexical)) throw fail('ACCOUNT_PERMISSION_FAILED');

    const executableLexical = path.win32.join(root, ...WINDOWS_SYSTEM_TOOLS[name]);
    const executableStat = lstat(executableLexical);
    if (!executableStat.isFile() || executableStat.isSymbolicLink()) throw fail('ACCOUNT_PERMISSION_FAILED');
    const executable = realpath(executableLexical);
    const relative = path.win32.relative(system32, executable);
    if (!relative || relative.startsWith('..') || path.win32.isAbsolute(relative)
      || windowsPathKey(executable) !== windowsPathKey(executableLexical)) {
      throw fail('ACCOUNT_PERMISSION_FAILED');
    }
    return executable;
  } catch (error) {
    if (error?.message === 'ACCOUNT_PERMISSION_FAILED') throw error;
    throw fail('ACCOUNT_PERMISSION_FAILED');
  }
}

const windowsSystemTool = (name) => resolveWindowsSystemTool(name);

const ACL_HARDEN = [
  '$p=$env:CASEY_ACL_TARGET_PATH',
  '$d=$env:CASEY_ACL_TARGET_KIND -eq "directory"',
  '$me=[Security.Principal.WindowsIdentity]::GetCurrent().User',
  '$acl=if($d){[Security.AccessControl.DirectorySecurity]::new()}else{[Security.AccessControl.FileSecurity]::new()}',
  '$acl.SetOwner($me)',
  '$acl.SetAccessRuleProtection($true,$false)',
  '$inherit=[Security.AccessControl.InheritanceFlags]::None',
  'if($d){$inherit=[Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [Security.AccessControl.InheritanceFlags]::ObjectInherit}',
  "$ids=@($me,[Security.Principal.SecurityIdentifier]::new('S-1-5-18'),[Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))",
  'foreach($id in $ids){$rule=[Security.AccessControl.FileSystemAccessRule]::new($id,[Security.AccessControl.FileSystemRights]::FullControl,$inherit,[Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow);$null=$acl.AddAccessRule($rule)}',
  'if($d){[IO.Directory]::SetAccessControl($p,$acl)}else{[IO.File]::SetAccessControl($p,$acl)}',
  'exit 0',
].join(';');

function hardenWindowsAcl(target, { directory }) {
  if (process.platform !== 'win32') return;
  const result = spawnSync(windowsSystemTool('powershell.exe'), ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', ACL_HARDEN], {
    encoding: 'utf8', windowsHide: true, timeout: 10000,
    env: {
      ...process.env,
      CASEY_ACL_TARGET_PATH: target,
      CASEY_ACL_TARGET_KIND: directory ? 'directory' : 'file',
    },
  });
  if (result.status !== 0) throw fail('ACCOUNT_PERMISSION_FAILED');
}

const ACL_PROBE = [
  '$p=$env:CASEY_ACL_PROBE_PATH',
  '$d=$env:CASEY_ACL_PROBE_KIND -eq "directory"',
  '$a=if($d){[IO.Directory]::GetAccessControl($p)}else{[IO.File]::GetAccessControl($p)}',
  'if(-not $a.AreAccessRulesProtected){exit 1}',
  '$me=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value',
  "$allowed=@($me,'S-1-5-18','S-1-5-32-544')",
  '$mineFull=$false',
  '$rules=$a.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])',
  'foreach($r in $rules){if($r.AccessControlType -eq [Security.AccessControl.AccessControlType]::Allow){$s=$r.IdentityReference.Value;if($allowed -notcontains $s){exit 1};if($s -eq $me){$full=[Security.AccessControl.FileSystemRights]::FullControl;if(($r.FileSystemRights -band $full) -eq $full){$mineFull=$true}}}}',
  'if(-not $mineFull){exit 1}',
  'exit 0',
].join(';');

function windowsAclSafe(target) {
  if (process.platform !== 'win32') return true;
  if (!fs.existsSync(target)) return false;
  let stat;
  try { stat = fs.lstatSync(target); } catch { return false; }
  if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile())) return false;
  const result = spawnSync(windowsSystemTool('powershell.exe'), ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', ACL_PROBE], {
    encoding: 'utf8', windowsHide: true, timeout: 10000,
    env: {
      ...process.env,
      CASEY_ACL_PROBE_PATH: target,
      CASEY_ACL_PROBE_KIND: stat.isDirectory() ? 'directory' : 'file',
    },
  });
  return result.status === 0;
}

export function accountPaths(authDir = AUTH_DIR) {
  const dir = assertAuthDir(authDir);
  return Object.freeze({
    authDir: dir,
    aiMiddle: path.join(dir, AI_FILE),
    desktop: path.join(dir, DESKTOP_FILE),
  });
}

function ensureAuthDir(authDir) {
  const dir = assertAuthDir(authDir);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(dir);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw fail('ACCOUNT_PATH_UNSAFE');
  if (process.platform !== 'win32') {
    try { fs.chmodSync(dir, 0o700); } catch { throw fail('ACCOUNT_PERMISSION_FAILED'); }
  } else hardenWindowsAcl(dir, { directory: true });
  return dir;
}

function atomicWriteAccount(file, body) {
  const dir = ensureAuthDir(path.dirname(file));
  if (path.dirname(file) !== dir || ![AI_FILE, DESKTOP_FILE].includes(path.basename(file))) throw fail('ACCOUNT_PATH_UNSAFE');
  if (fs.existsSync(file)) {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile()) throw fail('ACCOUNT_PATH_UNSAFE');
  }
  const temp = path.join(dir, `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(temp, body, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    if (process.platform !== 'win32') fs.chmodSync(temp, 0o600);
    fs.renameSync(temp, file);
    if (process.platform !== 'win32') fs.chmodSync(file, 0o600);
    else hardenWindowsAcl(file, { directory: false });
  } catch {
    try { if (fs.existsSync(temp)) fs.unlinkSync(temp); } catch { /* 固定错误码 */ }
    throw fail('ACCOUNT_WRITE_FAILED');
  }
}

export function writeAiMiddleAccount(input) {
  const allowed = new Set(['authDir', 'user', 'pass']);
  if (!exactKeys(input, allowed) || !nonempty(input.user, 1024) || !nonempty(input.pass, 8192)) throw fail('ACCOUNT_INPUT_INVALID');
  const file = accountPaths(input.authDir).aiMiddle;
  atomicWriteAccount(file, JSON.stringify({ user: input.user, pass: input.pass }, null, 2) + '\n');
  return { configured: true, shapeOk: true, loginBootstrap: 'wired' };
}

export function writeDesktopAccount(input) {
  const allowed = new Set(['authDir', 'accountRef', 'ready']);
  if (!exactKeys(input, allowed) || !REF_RE.test(String(input.accountRef || '')) || typeof input.ready !== 'boolean') throw fail('ACCOUNT_INPUT_INVALID');
  const file = accountPaths(input.authDir).desktop;
  atomicWriteAccount(file, JSON.stringify({
    schemaVersion: 1,
    accountRef: input.accountRef,
    ready: input.ready,
    automaticLogin: 'not-verified',
  }, null, 2) + '\n');
  return {
    configured: true,
    shapeOk: true,
    ready: input.ready,
    automaticLogin: 'not-verified',
    requiresHumanSession: true,
  };
}

function safeJsonShape(file, validate) {
  if (!fs.existsSync(file)) return { present: false, shapeOk: false, doc: null };
  try {
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile() || stat.size > 32768) return { present: true, shapeOk: false, doc: null };
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { present: true, shapeOk: validate(doc), doc };
  } catch { return { present: true, shapeOk: false, doc: null }; }
}

const validAiDoc = (doc) => exactKeys(doc, new Set(['user', 'pass']))
  && nonempty(doc.user, 1024) && nonempty(doc.pass, 8192);
const validDesktopDoc = (doc) => exactKeys(doc, new Set(['schemaVersion', 'accountRef', 'ready', 'automaticLogin']))
  && doc.schemaVersion === 1 && REF_RE.test(String(doc.accountRef || ''))
  && typeof doc.ready === 'boolean' && doc.automaticLogin === 'not-verified';

export function loadAiMiddleAccount({ credsFile = accountPaths().aiMiddle, env = process.env } = {}) {
  const hasUser = typeof env?.AT_CREDS_USER === 'string';
  const hasPass = typeof env?.AT_CREDS_PASS === 'string';
  if (hasUser || hasPass) {
    if (!hasUser || !hasPass || !nonempty(env.AT_CREDS_USER, 1024) || !nonempty(env.AT_CREDS_PASS, 8192)) throw fail('ACCOUNT_ENV_PAIR_INVALID');
    return { user: env.AT_CREDS_USER, pass: env.AT_CREDS_PASS };
  }
  const probe = safeJsonShape(path.resolve(String(credsFile)), validAiDoc);
  if (!probe.present) throw fail('ACCOUNT_NOT_CONFIGURED');
  if (!probe.shapeOk) throw fail('ACCOUNT_SHAPE_INVALID');
  return { user: probe.doc.user, pass: probe.doc.pass };
}

export function inspectAccountStatus({ authDir = AUTH_DIR, env = process.env } = {}) {
  const paths = accountPaths(authDir);
  const hasUser = typeof env?.AT_CREDS_USER === 'string';
  const hasPass = typeof env?.AT_CREDS_PASS === 'string';
  let ai;
  if (hasUser || hasPass) {
    ai = {
      configured: true,
      shapeOk: hasUser && hasPass && nonempty(env.AT_CREDS_USER, 1024) && nonempty(env.AT_CREDS_PASS, 8192),
      source: 'environment',
      loginBootstrap: 'wired',
    };
  } else {
    const file = typeof env?.AT_CREDS_FILE === 'string' && env.AT_CREDS_FILE
      ? path.resolve(env.AT_CREDS_FILE)
      : paths.aiMiddle;
    const probe = safeJsonShape(file, validAiDoc);
    ai = { configured: probe.present, shapeOk: probe.shapeOk, source: probe.present ? 'local-file' : 'none', loginBootstrap: 'wired' };
  }
  const desktopProbe = safeJsonShape(paths.desktop, validDesktopDoc);
  const desktopReady = desktopProbe.shapeOk && desktopProbe.doc.ready === true;
  return {
    schemaVersion: 1,
    aiMiddle: ai,
    desktop: {
      configured: desktopProbe.present,
      shapeOk: desktopProbe.shapeOk,
      ready: desktopReady,
      automaticLogin: 'not-verified',
      requiresHumanSession: true,
    },
  };
}

export function inspectAccountAcl({ authDir = AUTH_DIR } = {}) {
  if (process.platform !== 'win32') return { applicable: false, safe: true };
  let paths;
  try { paths = accountPaths(authDir); } catch { return { applicable: true, safe: false }; }
  return {
    applicable: true,
    safe: windowsAclSafe(paths.authDir) && windowsAclSafe(paths.aiMiddle),
  };
}

export function renderAccountStatus(status) {
  const ai = status?.aiMiddle || {};
  const desktop = status?.desktop || {};
  const aiState = !ai.configured ? '未配置' : ai.shapeOk ? '形状有效，已接登录预备动作' : '已配置但形状无效';
  const desktopState = !desktop.configured ? '未配置' : !desktop.shapeOk ? '已配置但形状无效' : desktop.ready ? '人工就绪声明在位' : '尚未声明就绪';
  return [
    `AI 中台账户：${aiState}`,
    `医生站 / Hi 小助账户：${desktopState}；自动登录未验证，必须人工安全会话`,
  ].join('\n');
}
