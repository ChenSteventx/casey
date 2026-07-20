#!/usr/bin/env node
// 冻结验收（hermetic 接线，非 zero-SUT 但不接触 SUT）：凭据上下文门在浏览器启动【前】拦截（replay+compile 双接线）。
// W1 起 replay.mjs 喂 production 受众锁 + test 上下文 → chromium.launch 前 exit 65（CREDENTIAL_AUDIENCE_MISMATCH）、
// 不落 axes。W2 起 compile.mjs --execute 非 --skip-login + 无凭据 → 凭据探测在浏览器前 fail-closed exit 65（codex
// High-2 修复的可执行回归证据：凭据在浏览器前加载、缺则浏览器前拦，非启动后才发现）。两者均在浏览器启动前 exit、
// 证不启动任何浏览器/假 SUT（SKILL.md:107 允许：可证明不启动/不连接/不回放假 SUT）；--sut 喂死地址 127.0.0.1:1。
// 契约 admission-trust-root-separation（ADR-0010）。改本文件 = Test Ratchet 判红。

import { spawnSync } from 'node:child_process';
import { existsSync, rmSync, mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const REPLAY = join(ROOT, 'bin', 'replay.mjs');
const COMPILE = join(ROOT, 'bin', 'compile.mjs');
const W = join(HERE, 'fixtures/admission-audience/wiring');
const OUT = join(ROOT, 'tests', '_golden', 'fixtures', 'admission-audience', 'wiring', '_axes.out.json');

const failures = [];
function test(name, fn) {
  try { fn(); console.log(`ok   ${name}`); }
  catch (e) { failures.push(`${name}: ${String(e?.message || e).slice(0, 300)}`); console.error(`not ok ${name}: ${String(e?.message || e).slice(0, 300)}`); }
}
function assert(c, m) { if (!c) throw new Error(m); }

// CASEY_LAUNCH_SENTINEL：compile/replay 在 chromium.launch 前若 env 设则写此文件——门在浏览器前 fail-closed 则它不存在，
// 令「未启动浏览器」可机械证（codex round-4：产物缺席不足证，浏览器可先启动再退门仍无最终产物）。
function runReplay(lockName = 'entity-locks.frozen.json') {
  rmSync(OUT, { force: true });
  const sentinel = join(mkdtempSync(join(tmpdir(), 'casey-sentinel-')), 'launched');
  const r = spawnSync(process.execPath, [
    REPLAY, '--events', join(W, 'events.document.json'), '--sut', 'http://127.0.0.1:1',
    '--expected', join(W, 'expected.frozen.json'), '--profile', join(W, 'profile.json'),
    '--entity-locks', join(W, lockName), '--out', OUT,
  ], { encoding: 'utf8', timeout: 60000, env: { ...process.env, CASEY_LAUNCH_SENTINEL: sentinel } });
  const launched = existsSync(sentinel);
  rmSync(dirname(sentinel), { recursive: true, force: true });
  return { r, launched };
}

// W1 核心接线：production 受众锁 + test 上下文（无 login）→ 门在浏览器前 exit 65、不落 axes、启动哨兵未写。
test('W1 production 受众锁 + test 上下文 → 凭据门浏览器前 exit 65、启动哨兵未写', () => {
  const { r, launched } = runReplay();
  assert(r.status === 65, `应 exit 65（门拦），实际 ${r.status}：${(r.stderr || '').slice(-160)}`);
  assert(/CREDENTIAL_AUDIENCE_MISMATCH/.test(r.stderr || ''), `stderr 应含 CREDENTIAL_AUDIENCE_MISMATCH，实际 ${(r.stderr || '').slice(-160)}`);
  assert(!launched, '启动哨兵不应写（chromium.launch 未到达=浏览器未启动，机械证）');
  assert(!existsSync(OUT), 'axes 不应落盘（门在采集前拦）');
});

// W1b 正控（证哨兵非空）：test 受众锁 + test 上下文（无 login）→ 受众匹配、过一切浏览器前门 → 到达 launch 点 →
// 哨兵写 + exit 66 短路（不真启浏览器）。证明 W1/W2/W3 的「哨兵未写」不是因哨兵永不 fire、而确是门在 launch 前拦。
test('W1b 正控：test 受众锁 + test 上下文 → 过门到 launch 点 → 哨兵写 + exit 66（哨兵机制非空）', () => {
  const { r, launched } = runReplay('entity-locks.test.frozen.json');
  assert(r.status === 66, `受众匹配应过门到 launch 哨兵 exit 66，实际 ${r.status}：${(r.stderr || '').slice(-160)}`);
  assert(launched, '过门到 launch 点后启动哨兵必写（证哨兵机制会 fire、非空断言）');
});

// W2 compile 接线（codex High-2 修复的可执行回归证据）：compile --execute 非 --skip-login 且无凭据 →
// 凭据探测在 chromium.launch 前 fail-closed exit 65（证「凭据在浏览器前加载、缺则浏览器前拦」，非启动后才发现）。
// 用纯只读 flow（无 mutation→无需 execute-authority），仍走到凭据探测；无 .auth 环境下 loadCreds 抛→门前 exit 65。
test('W2 compile --execute 非 skip-login 且无凭据 → 凭据探测浏览器前 exit 65', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'casey-compile-wiring-'));
  const CASE = 'tc_compile_wiring';
  const testcase = join(tmp, 'testcase.json');
  const flow = join(tmp, 'flow.json');
  const profile = join(tmp, 'profile.json');
  const outDir = join(tmp, 'out');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(testcase, JSON.stringify({ schemaVersion: 1, caseId: CASE, channel: 'web', uniquePrefix: 'atl_', preconditions: ['已登录'], intents: [{ intentId: 'intent_nav', text: '进入工作流管理列表' }] }));
  // 纯只读 flow：nav.workflowManagement + assert（无 mutation → flowContainsEntityMutation=false → 无需授权、走到凭据探测）
  writeFileSync(flow, JSON.stringify({ id: CASE, name: '只读接线', category: 'normal', steps: [{ atom: 'nav.workflowManagement', params: {} }, { atom: 'assert.onPage', params: { urlIncludes: '/process/list' } }] }));
  writeFileSync(profile, JSON.stringify({ background: [], successField: 'status', successValue: 200 }));
  // 相1 闸段（落编译 flow，不启动浏览器）
  const gate = spawnSync(process.execPath, [COMPILE, CASE, '--testcase', testcase, '--flow', flow, '--out-dir', outDir], { encoding: 'utf8', timeout: 60000, env: { ...process.env, AT_CREDS_FILE: join(tmp, 'nonexistent.auth') } });
  if (gate.status !== 0) { rmSync(tmp, { recursive: true, force: true }); throw new Error(`相1 闸段应 exit 0，实际 ${gate.status}：${(gate.stderr || '').slice(-160)}`); }
  // 人 confirm 编译 flow（G3 人签门，--execute 前置；此处 golden 代盖，与 wf-open-smoke 同律）
  const compiledFlow = join(outDir, `flow-${CASE}.json`);
  const fd = JSON.parse(readFileSync(compiledFlow, 'utf8'));
  fd.confirmedBy = 'golden-human'; fd.confirmedAt = '2026-07-20T00:00:00.000Z';
  writeFileSync(compiledFlow, JSON.stringify(fd, null, 2));
  // 执行段：非 --skip-login + 指向不存在的凭据文件 → 凭据探测抛 → 浏览器前 exit 65
  const sentinel = join(tmp, 'launched.sentinel');
  const exec = spawnSync(process.execPath, [COMPILE, CASE, '--execute', '--testcase', testcase, '--sut', 'http://127.0.0.1:1', '--out-dir', outDir, '--profile', profile, '--unique-name', 'w2'], { encoding: 'utf8', timeout: 60000, env: { ...process.env, AT_CREDS_FILE: join(tmp, 'nonexistent.auth'), CASEY_LAUNCH_SENTINEL: sentinel } });
  const stderr = exec.stderr || '';
  const launched = existsSync(sentinel);
  rmSync(tmp, { recursive: true, force: true });
  assert(exec.status === 65, `非 skip-login 无凭据应 exit 65（凭据探测门前拦），实际 ${exec.status}：${stderr.slice(-200)}`);
  assert(!launched, '启动哨兵不应写（chromium.launch 未到达=浏览器未启动，机械证）');
});

// W3 compile 受众门（codex round-3：真正证 compile 的 checkCredentialAudienceGate 分支）：production execute-authority
// + test 上下文（--skip-login）→ 受众门在浏览器前 exit 65 CREDENTIAL_AUDIENCE_MISMATCH，且零执行产物（events.json/
// observed 不存在=浏览器未跑）。删掉 compile 受众门则本例转红。受众门置于 admission 前、故授权只需 schema 合法。
test('W3 compile --execute production 授权 + test 上下文 → 受众门 exit 65 CREDENTIAL_AUDIENCE_MISMATCH、零执行产物', () => {
  const CD = join(HERE, 'fixtures/admission-audience/compile');
  const tmp = mkdtempSync(join(tmpdir(), 'casey-compile-aud-'));
  const CASE = 'tc_compile_audience';
  const gate = spawnSync(process.execPath, [COMPILE, CASE, '--testcase', join(CD, 'testcase.json'), '--flow', join(CD, 'flow.json'), '--out-dir', tmp], { encoding: 'utf8', timeout: 60000 });
  if (gate.status !== 0) { rmSync(tmp, { recursive: true, force: true }); throw new Error(`相1 闸段应 exit 0，实际 ${gate.status}：${(gate.stderr || '').slice(-160)}`); }
  const compiledFlow = join(tmp, `flow-${CASE}.json`);
  const fd = JSON.parse(readFileSync(compiledFlow, 'utf8'));
  fd.confirmedBy = 'golden-human'; fd.confirmedAt = '2026-07-20T00:00:00.000Z';
  writeFileSync(compiledFlow, JSON.stringify(fd, null, 2));
  const sentinel = join(tmp, 'launched.sentinel');
  const exec = spawnSync(process.execPath, [COMPILE, CASE, '--execute', '--testcase', join(CD, 'testcase.json'), '--sut', 'http://127.0.0.1:1', '--out-dir', tmp, '--profile', join(CD, 'profile.json'), '--entity-authority', join(CD, 'execute-authority.json'), '--skip-login', '--unique-name', 'w3'], { encoding: 'utf8', timeout: 60000, env: { ...process.env, CASEY_LAUNCH_SENTINEL: sentinel } });
  const stderr = exec.stderr || '';
  const launched = existsSync(sentinel);
  rmSync(tmp, { recursive: true, force: true });
  assert(exec.status === 65, `production 授权 + test 上下文应 exit 65，实际 ${exec.status}：${stderr.slice(-200)}`);
  assert(/CREDENTIAL_AUDIENCE_MISMATCH/.test(stderr), `stderr 应含 CREDENTIAL_AUDIENCE_MISMATCH，实际 ${stderr.slice(-200)}`);
  assert(!launched, '启动哨兵不应写（chromium.launch 未到达=浏览器未启动，机械证受众门在浏览器前拦）');
});

// W3b compile 正控（证 compile 哨兵非空，codex round-5：W1b 只证 replay 哨兵、compile 哨兵是另一份独立代码）：
// 纯 read 原子只读 flow（nav.workflowManagement+assert.textVisible→无 mutation→deterministic-read-only-policy 过 admission）
// + --skip-login（test 上下文、无受众门因无 --entity-authority）→ 过一切 compile 浏览器前门 → 到 compile launch 点 →
// 哨兵写 + exit 66。证 W2/W3 的「哨兵缺席」确因 compile 门在 launch 前拦、非 compile 哨兵永不 fire。
test('W3b compile 正控：纯只读 flow + --skip-login → 过 compile 前置门到 launch 点 → 哨兵写 + exit 66', () => {
  const CD = join(HERE, 'fixtures/admission-audience/compile');
  const tmp = mkdtempSync(join(tmpdir(), 'casey-compile-ro-'));
  const CASE = 'tc_compile_ro';
  const gate = spawnSync(process.execPath, [COMPILE, CASE, '--testcase', join(CD, 'ro-testcase.json'), '--flow', join(CD, 'ro-flow.json'), '--out-dir', tmp], { encoding: 'utf8', timeout: 60000 });
  if (gate.status !== 0) { rmSync(tmp, { recursive: true, force: true }); throw new Error(`相1 闸段应 exit 0，实际 ${gate.status}：${(gate.stderr || '').slice(-160)}`); }
  const compiledFlow = join(tmp, `flow-${CASE}.json`);
  const fd = JSON.parse(readFileSync(compiledFlow, 'utf8'));
  fd.confirmedBy = 'golden-human'; fd.confirmedAt = '2026-07-20T00:00:00.000Z';
  writeFileSync(compiledFlow, JSON.stringify(fd, null, 2));
  const sentinel = join(tmp, 'launched.sentinel');
  const exec = spawnSync(process.execPath, [COMPILE, CASE, '--execute', '--testcase', join(CD, 'ro-testcase.json'), '--sut', 'http://127.0.0.1:1', '--out-dir', tmp, '--profile', join(CD, 'profile.json'), '--skip-login', '--unique-name', 'w3b'], { encoding: 'utf8', timeout: 60000, env: { ...process.env, CASEY_LAUNCH_SENTINEL: sentinel } });
  const launched = existsSync(sentinel);
  rmSync(tmp, { recursive: true, force: true });
  assert(exec.status === 66, `只读 flow 过 compile 前置门应到 launch 哨兵 exit 66，实际 ${exec.status}：${(exec.stderr || '').slice(-200)}`);
  assert(launched, '过 compile 前置门到 launch 点后 compile 哨兵必写（证 compile 哨兵机制会 fire、非空断言）');
});

rmSync(OUT, { force: true });
if (failures.length > 0) { console.error(`\n${failures.length} 检查失败`); process.exit(1); }
console.log('\n全部检查通过');
