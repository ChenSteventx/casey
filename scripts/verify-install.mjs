#!/usr/bin/env node
// Public-install verification. This script is deliberately SUT-free: it does
// not start a fixture, open a target, probe a target, or read credential values.
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const checks = [];
const add = (id, ok, detail) => checks.push({ id, ok: !!ok, detail });

function versionAtLeast(actual, minimum) {
  const a = String(actual).replace(/^v/, '').split('.').map(Number);
  const b = String(minimum).replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const av = Number.isFinite(a[i]) ? a[i] : 0;
    const bv = Number.isFinite(b[i]) ? b[i] : 0;
    if (av !== bv) return av > bv;
  }
  return true;
}

function runNode(args) {
  return spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 15_000,
    windowsHide: true,
  });
}

function hasCjkFont() {
  if (process.platform === 'win32') {
    const fonts = join(process.env.WINDIR || process.env.SystemRoot || 'C:\\Windows', 'Fonts');
    return ['msyh.ttc', 'msyh.ttf', 'simsun.ttc', 'simsun.ttf'].some((f) => existsSync(join(fonts, f)));
  }
  if (process.platform === 'darwin') {
    if (['/System/Library/Fonts/PingFang.ttc', '/System/Library/Fonts/STHeiti Light.ttc']
      .some((p) => existsSync(p))) return true;
  }
  const r = spawnSync('fc-list', [':lang=zh'], { encoding: 'utf8', timeout: 5_000, windowsHide: true });
  return r.status === 0 && String(r.stdout || '').trim().length > 0;
}

async function main() {
  let pkg;
  try { pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')); }
  catch { pkg = null; }

  add('node', versionAtLeast(process.version, '22.12.0'), `${process.version}；最低 22.12.0`);
  add('package', pkg?.name === 'casey' && pkg?.devDependencies?.['@playwright/test'] === '1.60.0',
    'package.json 与 Playwright 1.60.0 精确版本');

  let playwright = null;
  try { playwright = await import('@playwright/test'); } catch { /* recorded below */ }
  add('playwright', !!playwright, '@playwright/test 可加载');

  let chromiumReady = false;
  try {
    const executable = playwright?.chromium?.executablePath?.();
    chromiumReady = !!executable && existsSync(executable);
  } catch { chromiumReady = false; }
  add('chromium', chromiumReady, 'Chromium 二进制在位');

  add('faces', [
    'bin/casey.mjs',
    'mcp/casey-server.mjs',
    '.claude/skills/casey/SKILL.md',
  ].every((p) => existsSync(join(ROOT, p))), 'CLI / MCP / skill 三面文件在位');

  const cli = join(ROOT, 'bin', 'casey.mjs');
  const help = runNode([cli, 'help']);
  add('cli', help.status === 0,
    `CLI help 可执行（exit=${help.status ?? 'null'}）`);

  const claude = runNode([cli, 'mcp-config', '--agent', 'claude']);
  const codex = runNode([cli, 'mcp-config', '--agent', 'codex']);
  add('mcp-config', claude.status === 0 && codex.status === 0,
    `Claude Code / Codex 挂载配置可生成（exit=${claude.status ?? 'null'}/${codex.status ?? 'null'}）`);

  add('cjk-font', hasCjkFont(), '中文字体可用于截图与录屏');

  console.log('Casey 安装检验（只验本机安装；不连接任何 SUT）');
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.id}  ${c.detail}`);
  const failed = checks.filter((c) => !c.ok);
  console.log(`SUMMARY ${checks.length - failed.length}/${checks.length} PASS`);
  console.log('REAL_SUT NOT_VERIFIED：安装通过不等于真机可用；仍须凭据、回环代理与真实 HTTP 连通证据。');
  process.exit(failed.length ? 1 : 0);
}

main().catch(() => {
  console.error('verify-install: 意外失败（细节已抑制，避免泄漏本机路径）');
  process.exit(1);
});
