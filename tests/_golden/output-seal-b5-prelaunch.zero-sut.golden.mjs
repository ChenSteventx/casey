#!/usr/bin/env node
// output-seal B5 原因级回归：合法只读信封须越过 admission，在浏览器启动前因登录预备失败而拒。
// 只连死地址且 CASEY_LAUNCH_SENTINEL 在 launch 点短路；绝不启动 SUT/浏览器。
// 改本文件 = Test Ratchet 判红。
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { signExpected } from './_sign-helper.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const REPLAY = join(ROOT, 'bin', 'replay.mjs');
const OUTPUT_SEAL = join(HERE, 'output-seal.golden.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'casey-b5-prelaunch-'));
const writeJson = (name, value) => { const path = join(tmp, name); writeFileSync(path, JSON.stringify(value)); return path; };
const url = '{{baseUrl}}/ai-manager/process/list';
const events = writeJson('events.json', {
  schemaVersion: 2, channel: 'web', caseId: 'tc_b5_prelaunch', url,
  recordedAt: '2026-07-20T00:00:00.000Z', compiledBy: 'golden', authored: false,
  events: [{ stepId: 'atstep_0', intentId: 'intent_0', atom: 'nav.workflowManagement', action: 'nav', url }],
});
const expected = writeJson('expected.json', signExpected({
  caseId: 'tc_b5_prelaunch', channel: 'web',
  intents: [{ intentId: 'intent_0', expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/ai-manager/process/list', soft: false }] }],
  globalAssertions: [],
}));
const profile = writeJson('profile.json', { background: [], successField: 'status', successValue: 200 });
const site = writeJson('site.json', {});
const sentinel = join(tmp, 'launch.sentinel');
const seed = 'SEEDVAL_B5_PRELAUNCH_x9';
const env = {
  ...process.env,
  AT_SITE_JSON: site,
  AT_CREDS_FILE: join(tmp, seed, 'credentials.json'),
  CASEY_LAUNCH_SENTINEL: sentinel,
};
delete env.AT_CREDS_USER;
delete env.AT_CREDS_PASS;

const result = spawnSync(process.execPath, [
  REPLAY, '--events', events, '--sut', 'http://127.0.0.1:1', '--expected', expected,
  '--profile', profile, '--out', join(tmp, 'axes.json'), '--login-bootstrap',
], { encoding: 'utf8', timeout: 60000, env });
const output = `${result.stdout || ''}${result.stderr || ''}`;
const failures = [];
if (result.status !== 65) failures.push(`应 exit 65，实际 ${result.status}`);
if (!output.includes('登录预备动作前置失败')) failures.push(`失败原因未到登录预备动作前置闸：${output.slice(-200)}`);
if (output.includes('REPLAY_READ_EVENT_TARGET_INVALID') || output.includes('FROZEN_ENTITY_LOCKS_MISSING_OR_INVALID')) failures.push('被 admission 抢跑，B5 仍是假阳性');
if (output.includes(seed)) failures.push('stderr/stdout 回显 AT_CREDS_FILE 种子');
if (existsSync(sentinel)) failures.push('CASEY_LAUNCH_SENTINEL 已写：控制流越过浏览器前门');

// 原 output-seal B5 也必须迁到这份合法信封；否则主金牌仍可能由 mutation admission 抢跑而假绿。
const source = readFileSync(OUTPUT_SEAL, 'utf8');
const b5Start = source.indexOf('// ---------- B5');
const b5End = source.indexOf('// ---------- B6', b5Start + 1);
if (b5Start < 0 || b5End < 0 || b5End <= b5Start) failures.push('output-seal B5/B6 分段 marker 缺失或次序非法');
const b5 = b5Start >= 0 && b5End > b5Start ? source.slice(b5Start, b5End) : '';
for (const token of ['nav.workflowManagement', '{{baseUrl}}/ai-manager/process/list', 'CASEY_LAUNCH_SENTINEL']) {
  if (!b5.includes(token)) failures.push(`output-seal B5 尚未冻结合法前置闸要素：${token}`);
}
if (b5.includes("atom: 'workflow.create'")) failures.push('output-seal B5 仍使用 mutation atom workflow.create');

if (failures.length) {
  for (const message of failures) console.error(`RED  output-seal-b5-prelaunch: ${message}`);
  process.exit(1);
}
console.log('ok   output-seal-b5-prelaunch: 合法只读信封命中登录前置闸，零回显且未到 launch');
