#!/usr/bin/env node
// 冻结验收（hermetic 接线，非 zero-SUT 但不接触 SUT）：凭据上下文门在浏览器启动【前】拦截。
// 起 replay.mjs 子进程喂 production 受众锁 + test 上下文（无 --login-bootstrap），门必在 chromium.launch
// 前 exit 65（CREDENTIAL_AUDIENCE_MISMATCH）且不落 axes——证接线真拦、不启动任何浏览器/假 SUT（SKILL.md:107
// 允许：可证明不启动/不连接/不回放假 SUT）。--sut 喂死地址 127.0.0.1:1，即便误启动也连不上、但门更早拦住。
// 契约 admission-trust-root-separation（ADR-0010，codex High-2 接线可执行证据）。改本文件 = Test Ratchet 判红。

import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const REPLAY = join(ROOT, 'bin', 'replay.mjs');
const W = join(HERE, 'fixtures/admission-audience/wiring');
const OUT = join(ROOT, 'tests', '_golden', 'fixtures', 'admission-audience', 'wiring', '_axes.out.json');

const failures = [];
function test(name, fn) {
  try { fn(); console.log(`ok   ${name}`); }
  catch (e) { failures.push(`${name}: ${String(e?.message || e).slice(0, 300)}`); console.error(`not ok ${name}: ${String(e?.message || e).slice(0, 300)}`); }
}
function assert(c, m) { if (!c) throw new Error(m); }

function runReplay(extraArgs = []) {
  rmSync(OUT, { force: true });
  const r = spawnSync(process.execPath, [
    REPLAY, '--events', join(W, 'events.document.json'), '--sut', 'http://127.0.0.1:1',
    '--expected', join(W, 'expected.frozen.json'), '--profile', join(W, 'profile.json'),
    '--entity-locks', join(W, 'entity-locks.frozen.json'), '--out', OUT, ...extraArgs,
  ], { encoding: 'utf8', timeout: 60000 });
  return r;
}

// W1 核心接线：production 受众锁 + test 上下文（无 login）→ 门在浏览器前 exit 65、不落 axes。
test('W1 production 受众锁 + test 上下文 → 凭据门浏览器前 exit 65、不启动浏览器', () => {
  const r = runReplay();
  assert(r.status === 65, `应 exit 65（门拦），实际 ${r.status}：${(r.stderr || '').slice(-160)}`);
  assert(/CREDENTIAL_AUDIENCE_MISMATCH/.test(r.stderr || ''), `stderr 应含 CREDENTIAL_AUDIENCE_MISMATCH，实际 ${(r.stderr || '').slice(-160)}`);
  assert(/未启动浏览器/.test(r.stderr || ''), 'stderr 应声明未启动浏览器');
  assert(!existsSync(OUT), 'axes 不应落盘（门在采集前拦、无浏览器动作）');
});

rmSync(OUT, { force: true });
if (failures.length > 0) { console.error(`\n${failures.length} 检查失败`); process.exit(1); }
console.log('\n全部检查通过');
