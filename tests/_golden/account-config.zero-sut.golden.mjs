#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, lstatSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  accountPaths,
  inspectAccountStatus,
  renderAccountStatus,
  writeAiMiddleAccount,
  writeDesktopAccount,
} from '../../lib/account-config.mjs';
import { loadCreds } from '../../lib/login-bootstrap.mjs';
import { checkDesktopAccount } from '../../lib/doctor.mjs';

let checks = 0;
const check = (name, fn) => {
  fn();
  checks += 1;
  console.log(`PASS ${name}`);
};

const root = mkdtempSync(join(tmpdir(), 'casey-account-'));
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const authDir = join(root, '.auth');
const userCanary = 'account_canary_user';
const passCanary = 'account_canary_pass_987654';
const refCanary = 'doctor-hi-local';

writeAiMiddleAccount({ authDir, user: userCanary, pass: passCanary });
writeDesktopAccount({ authDir, accountRef: refCanary, ready: true });
const paths = accountPaths(authDir);

check('AI 中台账户沿既有登录预备动作读取', () => {
  assert.deepEqual(loadCreds({ credsFile: paths.aiMiddle, env: {} }), { user: userCanary, pass: passCanary });
});

check('账户文件只落项目 .auth 且形状闭合', () => {
  assert.equal(paths.aiMiddle, join(authDir, 'credentials.json'));
  assert.equal(paths.desktop, join(authDir, 'desktop-account.json'));
  assert.deepEqual(JSON.parse(readFileSync(paths.aiMiddle, 'utf8')), { user: userCanary, pass: passCanary });
  assert.deepEqual(JSON.parse(readFileSync(paths.desktop, 'utf8')), {
    schemaVersion: 1,
    accountRef: refCanary,
    ready: true,
    automaticLogin: 'not-verified',
  });
});

check('POSIX 文件权限尽力收紧', () => {
  if (process.platform === 'win32') return;
  assert.equal(lstatSync(authDir).mode & 0o077, 0);
  assert.equal(lstatSync(paths.aiMiddle).mode & 0o077, 0);
  assert.equal(lstatSync(paths.desktop).mode & 0o077, 0);
});

const status = inspectAccountStatus({ authDir, env: {} });
check('状态只含形状与能力，不回显账户值', () => {
  assert.equal(status.aiMiddle.configured, true);
  assert.equal(status.aiMiddle.shapeOk, true);
  assert.equal(status.aiMiddle.loginBootstrap, 'wired');
  assert.equal(status.desktop.configured, true);
  assert.equal(status.desktop.shapeOk, true);
  assert.equal(status.desktop.ready, true);
  assert.equal(status.desktop.automaticLogin, 'not-verified');
  assert.equal(status.desktop.requiresHumanSession, true);
  const rendered = `${JSON.stringify(status)}\n${renderAccountStatus(status)}`;
  for (const forbidden of [userCanary, passCanary, refCanary, authDir]) assert.equal(rendered.includes(forbidden), false);
});

check('doctor 即使看到 ready 也只路由人，不宣称自动登录', () => {
  const item = checkDesktopAccount({ present: true, shapeOk: true, ready: true });
  assert.equal(item.status, 'route-human');
  assert.match(item.detail, /自动登录未验证/);
});

check('环境账户只检查成对形状且不落盘', () => {
  const envStatus = inspectAccountStatus({
    authDir: join(root, 'env-only', '.auth'),
    env: { AT_CREDS_USER: userCanary, AT_CREDS_PASS: passCanary },
  });
  assert.equal(envStatus.aiMiddle.configured, true);
  assert.equal(envStatus.aiMiddle.shapeOk, true);
  assert.equal(JSON.stringify(envStatus).includes(userCanary), false);
  const partial = inspectAccountStatus({ authDir: join(root, 'partial', '.auth'), env: { AT_CREDS_USER: userCanary } });
  assert.equal(partial.aiMiddle.configured, true);
  assert.equal(partial.aiMiddle.shapeOk, false);
});

check('CLI 状态输出不泄漏环境账户值', () => {
  const run = spawnSync(process.execPath, ['bin/casey.mjs', 'account', 'status', '--json'], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, AT_CREDS_USER: userCanary, AT_CREDS_PASS: passCanary },
  });
  assert.equal(run.status, 0);
  const output = `${run.stdout}\n${run.stderr}`;
  assert.equal(output.includes(userCanary), false);
  assert.equal(output.includes(passCanary), false);
  assert.equal(output.includes(projectRoot), false);
});

check('CLI 畸形 stdin 失败时不回显账户片段', () => {
  const run = spawnSync(process.execPath, ['bin/casey.mjs', 'account', 'configure', 'ai-middle', '--from-stdin'], {
    cwd: projectRoot,
    encoding: 'utf8',
    input: `{"user":"${userCanary}","pass":"${passCanary}"`,
    env: { ...process.env, AT_CREDS_USER: '', AT_CREDS_PASS: '' },
  });
  assert.equal(run.status, 1);
  const output = `${run.stdout}\n${run.stderr}`;
  assert.equal(output.includes(userCanary), false);
  assert.equal(output.includes(passCanary), false);
  assert.equal(output.includes(projectRoot), false);
  assert.match(output, /ACCOUNT_INPUT_INVALID/);
});

check('.auth 整目录保持 gitignored', () => {
  assert.match(readFileSync(join(projectRoot, '.gitignore'), 'utf8'), /^\.auth\/$/m);
});

check('未知字段、危险引用和 .auth 外路径 fail-closed', () => {
  assert.throws(() => writeAiMiddleAccount({ authDir, user: 'u', pass: 'p', extra: 'x' }), /ACCOUNT_INPUT_INVALID/);
  assert.throws(() => writeDesktopAccount({ authDir, accountRef: '../outside', ready: true }), /ACCOUNT_INPUT_INVALID/);
  assert.throws(() => accountPaths(join(root, 'auth')), /ACCOUNT_DIR_INVALID/);
});

check('符号链接账户目录被拒绝', () => {
  if (process.platform === 'win32') return;
  const linkRoot = mkdtempSync(join(tmpdir(), 'casey-account-link-'));
  symlinkSync(authDir, join(linkRoot, '.auth'));
  assert.throws(() => writeAiMiddleAccount({ authDir: join(linkRoot, '.auth'), user: 'u', pass: 'p' }), /ACCOUNT_PATH_UNSAFE/);
});

console.log(`ACCOUNT_CONFIG_ZERO_SUT PASS ${checks}/${checks}`);
