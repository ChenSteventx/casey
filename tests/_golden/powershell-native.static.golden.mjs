#!/usr/bin/env node
// PowerShell 原生操作面零 SUT 验收：只查脚本、纯函数、CLI/MCP stdio 与消毒错误。
// 不启动、连接或回放任何 SUT；代理生命周期由同目录 .ps1 在真实 Windows PowerShell 验。
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
let passed = 0;
async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
    passed++;
  } catch (error) {
    console.error(`FAIL ${name}: ${error.message}`);
    process.exitCode = 1;
  }
}

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

await check('PowerShell 5.1 安装与操作脚本在位且不用危险求值', () => {
  for (const rel of ['scripts/install.ps1', 'scripts/casey.ps1']) assert.equal(existsSync(join(ROOT, rel)), true, `${rel} 缺失`);
  const install = read('scripts/install.ps1');
  const ops = read('scripts/casey.ps1');
  assert.match(install, /#requires\s+-Version\s+5\.1/i);
  assert.match(install, /npm\.cmd/i);
  assert.match(install, /npx\.cmd/i);
  assert.doesNotMatch(install + ops, /Invoke-Expression|\biex\b/i);
  for (const action of ['verify', 'doctor', 'account-ai', 'account-doctor-hi', 'account-status', 'mcp-config', 'proxy-start', 'proxy-status', 'proxy-stop']) {
    assert.match(ops, new RegExp(action.replace('-', '\\-'), 'i'), `缺动作 ${action}`);
  }
});

await check('安全站点解析只收 HTTP(S) 真目标与 HTTP 回环代理', async () => {
  const { readTunnelConfig } = await import('../../scripts/tunnel-config.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'casey-ps-config-'));
  try {
    const valid = join(dir, 'valid.json');
    writeFileSync(valid, JSON.stringify({
      target: {
        startUrl: 'https://powershell-target-canary.invalid/login',
        devProxyUrl: 'http://127.0.0.1:16519',
      },
    }));
    const cfg = readTunnelConfig({ sitePath: valid, env: {} });
    assert.equal(cfg.target.protocol, 'https:');
    assert.equal(cfg.clientPort, 16519);
    assert.equal(cfg.tunnelPort, 16520);

    const invalids = [
      ['bad-json.json', '{"target":{"startUrl":"https://bad-config-canary.invalid/"'],
      ['bad-scheme.json', JSON.stringify({ target: { startUrl: 'file:///secret-canary', devProxyUrl: 'http://127.0.0.1:16519' } })],
      ['bad-proxy.json', JSON.stringify({ target: { startUrl: 'https://target-canary.invalid/', devProxyUrl: 'http://10.0.0.8:16519' } })],
      ['embedded-account.json', JSON.stringify({ target: { startUrl: 'https://user:pass@target-canary.invalid/', devProxyUrl: 'http://127.0.0.1:16519' } })],
    ];
    for (const [name, body] of invalids) {
      const file = join(dir, name);
      writeFileSync(file, body);
      assert.throws(() => readTunnelConfig({ sitePath: file, env: {} }), (error) => {
        const message = String(error?.message || '');
        assert.match(message, /^TUNNEL_[A-Z0-9_]+$/);
        assert.doesNotMatch(message, /canary|:\/\/|casey-ps-config/i);
        return true;
      });
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

await check('转发数据面有 TLS、首包暂停、及时补池和补给握手', () => {
  const agent = read('scripts/win-reverse-agent.mjs');
  const listener = read('scripts/wsl-reverse-listen.mjs');
  assert.match(agent, /from 'node:tls'/);
  assert.match(agent, /tls\.connect\s*\(/);
  assert.doesNotMatch(agent, /rejectUnauthorized\s*:\s*false/);
  assert.match(agent, /tunnel\.pause\s*\(\)/);
  assert.match(agent, /waitingSupplies/);
  assert.match(agent, /CASEY_TUNNEL_TOKEN/);
  assert.match(listener, /CASEY_TUNNEL_TOKEN/);
  assert.match(listener, /timingSafeEqual/);
});

await check('doctor 真实环境模式缺任一前置即红，齐备也不冒充 HTTP 证据', async () => {
  const { runDoctor } = await import('../../lib/doctor.mjs');
  const base = {
    node: { nodeVersion: 'v22.12.0', requiredRange: '>=22.12' },
    playwright: { present: true, importable: true },
    chromium: { execResolved: true, execExists: true },
    fonts: { platform: 'win32', isWSL: false, cjkProbeNonEmpty: true },
    siteJson: { present: false, shapeOk: false },
    creds: { present: false, shapeOk: false },
    desktopAccount: { present: false, shapeOk: false, ready: false },
    accountAcl: { applicable: true, safe: false },
    tunnel: { proxyPort: null, portListening: false, probeMs: 0 },
  };
  assert.equal(runDoctor(base, { realSut: true }).exitCode, 1);
  const ready = structuredClone(base);
  ready.siteJson = { present: true, shapeOk: true };
  ready.creds = { present: true, shapeOk: true };
  ready.accountAcl = { applicable: true, safe: true };
  ready.tunnel = { proxyPort: 16519, portListening: true, probeMs: 1 };
  const result = runDoctor(ready, { realSut: true });
  assert.equal(result.exitCode, 0);
  assert.match(result.summary, /REAL_SUT_HTTP_NOT_VERIFIED/);
});

await check('MCP 配置绑定当前 Node 并正确转义 PowerShell 单引号', async () => {
  const { powershellQuote, tomlEscape } = await import('../../bin/mcp-config.mjs');
  assert.equal(powershellQuote("C:\\Casey's Work\\node.exe"), "'C:\\Casey''s Work\\node.exe'");
  assert.equal(tomlEscape('C:\\Casey\\node.exe'), 'C:\\\\Casey\\\\node.exe');
  const cli = join(ROOT, 'bin', 'casey.mjs');
  for (const agent of ['claude', 'codex']) {
    const run = spawnSync(process.execPath, [cli, 'mcp-config', '--agent', agent], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, new RegExp(process.execPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.doesNotMatch(run.stdout, /Windows 原生侧挂载必败/);
  }
});

await check('Windows 持久化路径使用正斜杠且目录保护使用平台分隔符', () => {
  const sign = read('bin/sign.mjs');
  assert.match(sign, /p\s*\+\s*path\.sep/);
  assert.match(sign, /split\(path\.sep\)\.join\('\/'\)/);
});

await check('账户 ACL 只收紧当前用户自有对象，不尝试提权接管 owner', () => {
  const account = read('lib/account-config.mjs');
  assert.match(account, /GetOwner\(\[Security\.Principal\.SecurityIdentifier\]\)/);
  assert.match(account, /owner\.Value\s+-ne\s+\$me\.Value/);
  assert.doesNotMatch(account, /\.SetOwner\s*\(/);
});

await check('四 OS 的三类 agent 提示词强制最小权限预检', () => {
  for (const osName of ['windows', 'wsl', 'linux', 'macos']) {
    for (const promptName of ['PROMPT-CODEX.txt', 'PROMPT-CLAUDE-CODE.txt', 'PROMPT-GENERIC-AGENT.txt']) {
      const prompt = read(`onboarding/${osName}/${promptName}`);
      assert.match(prompt, /onboarding\/PERMISSIONS\.md/, `${osName}/${promptName} 未读取权限说明`);
      assert.match(prompt, /可用权限\s*\/\s*缺失权限\s*\/\s*仅本任务所需权限/, `${osName}/${promptName} 未要求权限预检`);
      assert.match(prompt, /只申请当前步骤缺失的能力/, `${osName}/${promptName} 未限制权限申请范围`);
    }
  }
  for (const promptName of ['PROMPT-CODEX.txt', 'PROMPT-CLAUDE-CODE.txt', 'PROMPT-GENERIC-AGENT.txt']) {
    const prompt = read(`onboarding/windows/${promptName}`);
    assert.match(prompt, /不得.*Docker Desktop/, `${promptName} 未禁止 Windows 原生 Docker`);
    assert.match(prompt, /不得要求管理员/, `${promptName} 未限制日常提权`);
  }
});

await check('MCP server 可完成 initialize 与 tools/list，且零 SUT', () => {
  const server = join(ROOT, 'mcp', 'casey-server.mjs');
  const serverSource = read('mcp/casey-server.mjs');
  assert.match(serverSource, /isError:\s*exitCode\s*!==\s*0\b/);
  assert.doesNotMatch(serverSource, /exitCode\s*!==\s*3/);
  const input = [
    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }),
    JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    '',
  ].join('\n');
  const run = spawnSync(process.execPath, [server], { cwd: ROOT, input, encoding: 'utf8', timeout: 10_000 });
  assert.equal(run.status, 0, run.stderr);
  const rows = run.stdout.trim().split(/\r?\n/).map((line) => JSON.parse(line));
  assert.equal(rows[0].id, 1);
  assert.equal(rows[0].result.serverInfo.name, 'casey');
  assert.equal(rows[1].id, 2);
  assert.ok(rows[1].result.tools.length > 0);
});

console.log(`SUMMARY ${passed}/9 PASS`);
if (process.exitCode) process.exit(process.exitCode);
