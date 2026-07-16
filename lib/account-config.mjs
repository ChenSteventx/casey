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

function windowsUserSid() {
  const result = spawnSync('whoami.exe', ['/user', '/fo', 'csv', '/nh'], {
    encoding: 'utf8', windowsHide: true, timeout: 5000,
  });
  if (result.status !== 0) throw fail('ACCOUNT_PERMISSION_FAILED');
  const match = String(result.stdout || '').match(/S-\d-(?:\d+-)+\d+/);
  if (!match) throw fail('ACCOUNT_PERMISSION_FAILED');
  return match[0];
}

function hardenWindowsAcl(target, { directory }) {
  if (process.platform !== 'win32') return;
  const sid = windowsUserSid();
  const inherit = directory ? '(OI)(CI)F' : 'F';
  const result = spawnSync('icacls.exe', [
    target,
    '/inheritance:r',
    '/grant:r', `*${sid}:${inherit}`, `*S-1-5-18:${inherit}`, `*S-1-5-32-544:${inherit}`,
    '/remove:g', '*S-1-1-0', '*S-1-5-11', '*S-1-5-32-545',
  ], { encoding: 'utf8', windowsHide: true, timeout: 10000 });
  if (result.status !== 0) throw fail('ACCOUNT_PERMISSION_FAILED');
}

const ACL_PROBE = [
  '$p=$env:CASEY_ACL_PROBE_PATH',
  '$a=Get-Acl -LiteralPath $p',
  'if(-not $a.AreAccessRulesProtected){exit 1}',
  "$bad=@('S-1-1-0','S-1-5-11','S-1-5-32-545')",
  '$me=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value',
  '$mine=$false',
  'foreach($r in $a.Access){try{$s=$r.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value}catch{$s=""};if($r.AccessControlType -eq [Security.AccessControl.AccessControlType]::Allow){if($bad -contains $s){exit 1};if($s -eq $me){$mine=$true}}}',
  'if(-not $mine){exit 1}',
  'exit 0',
].join(';');

function windowsAclSafe(target) {
  if (process.platform !== 'win32') return true;
  if (!fs.existsSync(target)) return false;
  const result = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', ACL_PROBE], {
    encoding: 'utf8', windowsHide: true, timeout: 10000,
    env: { ...process.env, CASEY_ACL_PROBE_PATH: target },
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
