#!/usr/bin/env node
// 本地账户配置面：账户值只从隐藏 TTY、stdin 或 env 进入内存；绝不接受 argv 值、绝不回显。
import { AUTH_DIR } from '../lib/paths.mjs';
import {
  inspectAccountStatus,
  renderAccountStatus,
  writeAiMiddleAccount,
  writeDesktopAccount,
} from '../lib/account-config.mjs';

const fail = (code) => new Error(code);

function usage(message) {
  if (message) console.error(`account: ${message}`);
  console.error('用法: casey account configure <ai-middle|doctor-hi> [--from-stdin|--from-env]');
  console.error('      casey account status [--json]');
  process.exit(64);
}

function parse(argv) {
  const pos = [];
  const flags = new Set();
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      if (!['--from-stdin', '--from-env', '--json'].includes(arg)) usage('存在不支持的选项（账户值不得放命令行）');
      flags.add(arg.slice(2));
    } else pos.push(arg);
  }
  return { pos, flags };
}

async function readStdinJson() {
  if (process.stdin.isTTY) throw fail('ACCOUNT_STDIN_REQUIRED');
  let text = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) {
    text += chunk;
    if (text.length > 32768) throw fail('ACCOUNT_INPUT_INVALID');
  }
  try { return JSON.parse(text); } catch { throw fail('ACCOUNT_INPUT_INVALID'); }
}

function readHiddenLine(prompt, max = 8192) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') return Promise.reject(fail('ACCOUNT_INTERACTIVE_UNAVAILABLE'));
  process.stderr.write(prompt);
  return new Promise((resolve, reject) => {
    let value = '';
    const previousRaw = process.stdin.isRaw;
    const cleanup = () => {
      process.stdin.off('data', onData);
      try { process.stdin.setRawMode(Boolean(previousRaw)); } catch { /* 固定错误码 */ }
      process.stdin.pause();
    };
    const finish = () => { cleanup(); process.stderr.write('\n'); resolve(value); };
    const abort = () => { cleanup(); process.stderr.write('\n'); reject(fail('ACCOUNT_INPUT_ABORTED')); };
    const onData = (chunk) => {
      for (const ch of String(chunk)) {
        if (ch === '\u0003') { abort(); return; }
        if (ch === '\r' || ch === '\n') { finish(); return; }
        if (ch === '\u007f' || ch === '\b') { value = value.slice(0, -1); continue; }
        if (ch >= ' ' && ch !== '\u007f') {
          value += ch;
          if (value.length > max) { abort(); return; }
        }
      }
    };
    process.stdin.setEncoding('utf8');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

async function interactiveInput(target) {
  if (target === 'ai-middle') {
    const user = await readHiddenLine('AI 中台账户（隐藏输入）：', 1024);
    const pass = await readHiddenLine('AI 中台口令（隐藏输入）：', 8192);
    return { user, pass };
  }
  const accountRef = await readHiddenLine('医生站 / Hi 小助本地账户引用（隐藏输入）：', 64);
  const readyText = await readHiddenLine('是否已人工确认账户与安全会话就绪？输入 yes 或 no（隐藏输入）：', 3);
  if (!['yes', 'no'].includes(readyText)) throw fail('ACCOUNT_INPUT_INVALID');
  return { accountRef, ready: readyText === 'yes' };
}

function envInput(target) {
  if (target === 'ai-middle') return { user: process.env.AT_CREDS_USER, pass: process.env.AT_CREDS_PASS };
  const value = process.env.CASEY_DESKTOP_ACCOUNT_READY;
  if (!['true', 'false', '1', '0'].includes(String(value))) throw fail('ACCOUNT_INPUT_INVALID');
  return {
    accountRef: process.env.CASEY_DESKTOP_ACCOUNT_REF,
    ready: value === 'true' || value === '1',
  };
}

function fixedCode(error) {
  const message = String(error?.message || 'ACCOUNT_FAILED');
  return /^[A-Z0-9_]+$/.test(message) ? message : 'ACCOUNT_FAILED';
}

async function main() {
  const { pos, flags } = parse(process.argv.slice(2));
  const command = pos[0];
  if (command === 'status') {
    if (pos.length !== 1 || flags.has('from-stdin') || flags.has('from-env')) usage('status 只接受可选 --json');
    const status = inspectAccountStatus({ authDir: AUTH_DIR, env: process.env });
    console.log(flags.has('json') ? JSON.stringify(status, null, 2) : renderAccountStatus(status));
    return;
  }
  if (command !== 'configure') usage('缺少 configure 或 status 子命令');
  const target = pos[1];
  if (!['ai-middle', 'doctor-hi'].includes(target) || pos.length !== 2 || flags.has('json')) usage('configure 目标须为 ai-middle 或 doctor-hi');
  if (flags.has('from-stdin') && flags.has('from-env')) usage('--from-stdin 与 --from-env 互斥');
  const input = flags.has('from-stdin')
    ? await readStdinJson()
    : flags.has('from-env')
      ? envInput(target)
      : await interactiveInput(target);
  if (target === 'ai-middle') writeAiMiddleAccount({ authDir: AUTH_DIR, user: input?.user, pass: input?.pass });
  else writeDesktopAccount({ authDir: AUTH_DIR, accountRef: input?.accountRef, ready: input?.ready });
  console.log(target === 'ai-middle'
    ? 'account: AI 中台账户已安全写入本地 .auth，并接入登录预备动作。'
    : 'account: 医生站 / Hi 小助账户引用与就绪声明已安全写入本地 .auth；自动登录仍未验证。');
}

main().catch((error) => {
  console.error(`account: 操作失败（${fixedCode(error)}；账户值与本机路径不回显）`);
  process.exit(1);
});
