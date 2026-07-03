#!/usr/bin/env node
// 冻结黄金标准（run-history · hermetic）：casey run 接回放历史/回放指标真产出。
// 真值源 = 已冻 tests/_golden/schemas/run-history.schema.json（prd-seams-freeze-v2 checksum 在锁）——
// required/枚举/pattern/allOf 逐项从 schema 文件读取比对，不抄副本（决策依 docs/plans/run-history/proposed/GRILL.md）。
// 红先行：bin/replay.mjs 尚无 --run-history/--run-metrics/--run-id 旗标 → I1/I3 无产物必红。
// 红线：仅诊断证据，绝不进 verdict.mjs（U1 依赖闭包扫描）；值侧打码字面量零落盘（护栏 #7）；
//       缺省行为一字不变（I2 不带旗标零产物）。改本文件 = Test Ratchet 判红。
import { readFileSync, writeFileSync, existsSync, mkdtempSync, mkdirSync } from 'node:fs';
import { spawnSync, execFileSync } from 'node:child_process';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { startLoginSut } from '../fixtures/login-sut/server.mjs';
import { startFakeSut, FAKE_SITE_DENYLIST } from '../fixtures/fake-sut/server.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const REPLAY = join(ROOT, 'bin', 'replay.mjs');
const CASEY = join(ROOT, 'bin', 'casey.mjs');
const SCHEMA = JSON.parse(readFileSync(join(HERE, 'schemas', 'run-history.schema.json'), 'utf8'));
const LINE_DEF = SCHEMA.definitions.runHistoryLine;
const MET_DEF = SCHEMA.definitions.runMetrics;
const tmp = mkdtempSync(join(tmpdir(), 'casey-rh-'));

const fails = [];
let pass = 0;
function check(name, fn) {
  try { fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-300)}`); }
}
async function checkAsync(name, fn) {
  try { await fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-300)}`); }
}

// ---------- 冻结 schema 逐项复核（真值只读 schema 文件） ----------
function conformLine(l, i) {
  for (const k of LINE_DEF.required) if (!(k in l)) throw new Error(`行${i} 缺必填 ${k}`);
  const props = LINE_DEF.properties;
  for (const k of Object.keys(l)) if (!(k in props)) throw new Error(`行${i} 超集字段 ${k}（additionalProperties:false）`);
  if (!new RegExp(props.stepId.pattern).test(l.stepId)) throw new Error(`行${i} stepId 形状违例 ${l.stepId}`);
  if (typeof l.caseId !== 'string' || !l.caseId) throw new Error(`行${i} caseId 须非空字符串`);
  if (typeof l.intentId !== 'string' || !l.intentId) throw new Error(`行${i} intentId 须非空字符串`);
  if ('atom' in l && l.atom !== null && typeof l.atom !== 'string') throw new Error(`行${i} atom 须 string|null`);
  if (!props.action.enum.includes(l.action)) throw new Error(`行${i} action 越枚举 ${l.action}`);
  if (!props.locatorResolution.enum.includes(l.locatorResolution ?? null)) throw new Error(`行${i} locatorResolution 越枚举 ${l.locatorResolution}`);
  if (!props.result.enum.includes(l.result)) throw new Error(`行${i} result 越枚举 ${l.result}`);
  if (typeof l.quietPointReached !== 'boolean') throw new Error(`行${i} quietPointReached 须 boolean`);
  if (!Number.isInteger(l.durationMs) || l.durationMs < 0) throw new Error(`行${i} durationMs 须非负整数`);
  if (Number.isNaN(Date.parse(l.timestamp))) throw new Error(`行${i} timestamp 非法 ${l.timestamp}`);
  if (l.parameters != null) {
    for (const k of Object.keys(l.parameters)) if (!(k in props.parameters.properties)) throw new Error(`行${i} parameters 超集字段 ${k}`);
    const vr = l.parameters.valueRef;
    if (vr != null && !new RegExp(props.parameters.properties.valueRef.pattern).test(vr)) throw new Error(`行${i} valueRef 违 pattern（疑似字面量落盘）：${vr}`);
    const loc = l.parameters.locator;
    if (loc != null) for (const k of Object.keys(loc)) if (!(k in props.parameters.properties.locator.properties)) throw new Error(`行${i} locator 超集字段 ${k}`);
  }
  // allOf 类别绑定（codex R11-F3）：nav/newpage/press 恒 null；交互动作恒 string。
  if (['nav', 'newpage', 'press'].includes(l.action) && l.locatorResolution !== null) throw new Error(`行${i} ${l.action} 的 locatorResolution 应 null`);
  if (['click', 'dblclick', 'fill', 'selectOption'].includes(l.action) && typeof l.locatorResolution !== 'string') throw new Error(`行${i} ${l.action} 的 locatorResolution 应非 null`);
}

function conformMetrics(m) {
  for (const k of MET_DEF.required) if (!(k in m)) throw new Error(`metrics 缺必填 ${k}`);
  for (const k of Object.keys(m)) if (!(k in MET_DEF.properties)) throw new Error(`metrics 超集字段 ${k}（additionalProperties:false）`);
  if (m.schemaVersion !== 1) throw new Error(`schemaVersion 须 1，实际 ${m.schemaVersion}`);
  if (typeof m.caseId !== 'string' || !m.caseId) throw new Error('metrics caseId 须非空字符串');
  if (!(m.runId === null || typeof m.runId === 'string')) throw new Error('runId 须 string|null');
  for (const k of ['totalSteps', 'passedActions', 'quietPointWaitMs', 'totalDurationMs']) {
    if (!Number.isInteger(m[k]) || m[k] < 0) throw new Error(`metrics ${k} 须非负整数`);
  }
  if (!(m.locatorHitRate === null || (typeof m.locatorHitRate === 'number' && m.locatorHitRate >= 0 && m.locatorHitRate <= 1))) throw new Error('locatorHitRate 须 null 或 0..1');
}

// ---------- U 静态红线 ----------
check('U1 红线：verdict.mjs 依赖闭包零回放历史/回放指标引用（绝不进裁判进程）', () => {
  const seen = new Set();
  const queue = [join(ROOT, 'bin', 'verdict.mjs')];
  const bad = /run-history|run-metrics|runHistory|runMetrics/;
  while (queue.length) {
    const f = queue.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    const src = readFileSync(f, 'utf8');
    if (bad.test(src)) throw new Error(`${f} 引用了回放历史接缝`);
    for (const m of src.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) queue.push(resolve(dirname(f), m[1]));
  }
  if (!seen.size) throw new Error('闭包扫描空');
});

// ---------- I 集成向（login-sut 假 SUT） ----------
const PROFILE = join(tmp, 'profile.json');
writeFileSync(PROFILE, JSON.stringify({ background: [], successField: 'status', successValue: 200 }));
function rhEventsDoc() {
  return {
    schemaVersion: 2, channel: 'web', caseId: 'tc_rh',
    url: '{{baseUrl}}/app', recordedAt: '2026-07-03T00:00:00.000Z', compiledBy: 'golden-fixture', authored: false,
    events: [
      { stepId: 'atstep_0', intentId: 'intent_0', atom: 'nav.app', action: 'nav', url: '{{baseUrl}}/app' },
      { stepId: 'atstep_1', intentId: 'intent_1', atom: 'login.fillUser', action: 'fill', semantic: { kind: 'role', role: 'textbox', name: '请输入账号', exact: true }, value: 'atl_{{uniqueName}}' },
      { stepId: 'atstep_2', intentId: 'intent_1', atom: 'login.fillUser', action: 'fill', semantic: { kind: 'role', role: 'textbox', name: '请输入账号', exact: true }, value: '{{uniqueName}}' },
      { stepId: 'atstep_3', intentId: 'intent_1', atom: 'login.submit', action: 'click', semantic: { kind: 'role', role: 'button', name: '登 录', exact: true } },
      { stepId: 'atstep_4', intentId: 'intent_2', atom: 'ghost.click', action: 'click', semantic: { kind: 'role', role: 'button', name: '不存在按钮九三七', exact: true } },
    ],
  };
}
const EVENTS = join(tmp, 'rh-events.json');
writeFileSync(EVENTS, JSON.stringify(rhEventsDoc(), null, 2));
const EXPECTED = join(tmp, 'rh-expected.json');
writeFileSync(EXPECTED, JSON.stringify({ caseId: 'tc_rh', channel: 'web', intents: [], globalAssertions: [] }));

await checkAsync('I1 三旗标真产出：逐行过冻结 schema + 值侧打码 + 失配诚实 + 聚合一致（未传 --run-id → null）', async () => {
  const srv = await startLoginSut({});
  try {
    const OUT = join(tmp, 'i1-axes.json');
    const RH = join(tmp, 'i1-run-history.jsonl');
    const RM = join(tmp, 'i1-run-metrics.json');
    const r = spawnSync(process.execPath, [REPLAY, '--events', EVENTS, '--sut', srv.url, '--expected', EXPECTED, '--profile', PROFILE, '--out', OUT,
      '--run-history', RH, '--run-metrics', RM], { encoding: 'utf8', timeout: 120000 });
    if (r.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
    if (!existsSync(RH)) throw new Error('未产 run-history.jsonl');
    if (!existsSync(RM)) throw new Error('未产 run-metrics.json');
    const text = readFileSync(RH, 'utf8');
    if (text.includes('atl_')) throw new Error('字面量外泄：回放历史含实例化 fill 值（护栏 #7）');
    const lines = text.trim().split('\n').map((s) => JSON.parse(s));
    if (lines.length !== 5) throw new Error(`应逐 event 5 行，实际 ${lines.length}`);
    lines.forEach((l, i) => conformLine(l, i));
    const want = [
      { stepId: 'atstep_0', action: 'nav', lr: null, result: 'ok', vr: null },
      { stepId: 'atstep_1', action: 'fill', lr: 'unique', result: 'ok', vr: '<redacted:fill>' },
      { stepId: 'atstep_2', action: 'fill', lr: 'unique', result: 'ok', vr: '{{uniqueName}}' },
      { stepId: 'atstep_3', action: 'click', lr: 'unique', result: 'ok', vr: null },
      { stepId: 'atstep_4', action: 'click', lr: 'none', result: 'locatorError', vr: null },
    ];
    want.forEach((w, i) => {
      const l = lines[i];
      if (l.stepId !== w.stepId || l.action !== w.action) throw new Error(`行${i} 应 ${w.stepId}/${w.action}，实际 ${l.stepId}/${l.action}`);
      if (l.caseId !== 'tc_rh') throw new Error(`行${i} caseId 应 tc_rh`);
      if (l.locatorResolution !== w.lr) throw new Error(`行${i} locatorResolution 应 ${w.lr}，实际 ${l.locatorResolution}`);
      if (l.result !== w.result) throw new Error(`行${i} result 应 ${w.result}，实际 ${l.result}`);
      const vr = l.parameters ? l.parameters.valueRef : null;
      if ((vr ?? null) !== w.vr) throw new Error(`行${i} valueRef 应 ${w.vr}，实际 ${vr}`);
      if (l.quietPointReached !== true) throw new Error(`行${i} 稳定程序走完应 true（G3 口径）`);
    });
    const m = JSON.parse(readFileSync(RM, 'utf8'));
    conformMetrics(m);
    if (m.caseId !== 'tc_rh') throw new Error('metrics caseId 应 tc_rh');
    if (m.runId !== null) throw new Error(`未传 --run-id 应 null，实际 ${m.runId}`);
    if (m.totalSteps !== 5) throw new Error(`totalSteps 应 5，实际 ${m.totalSteps}`);
    const okCnt = lines.filter((l) => l.result === 'ok').length;
    if (okCnt !== 4 || m.passedActions !== okCnt) throw new Error(`passedActions 应 4 且与逐行复算一致，实际 ${m.passedActions}/${okCnt}`);
    const denom = lines.filter((l) => l.locatorResolution !== null).length;
    const hit = lines.filter((l) => l.locatorResolution === 'unique').length;
    if (denom !== 4 || Math.abs(m.locatorHitRate - hit / denom) > 1e-9) throw new Error(`locatorHitRate 应 ${hit}/${denom}，实际 ${m.locatorHitRate}`);
    if (m.totalDurationMs < Math.max(...lines.map((l) => l.durationMs))) throw new Error('totalDurationMs 应 ≥ 最大单步耗时');
  } finally { await srv.close(); }
});

await checkAsync('I2 缺省不变：不带旗标 → 零诊断产物、exit 0（零行为差）', async () => {
  const srv = await startLoginSut({});
  try {
    const OUT = join(tmp, 'i2-axes.json');
    const r = spawnSync(process.execPath, [REPLAY, '--events', EVENTS, '--sut', srv.url, '--expected', EXPECTED, '--profile', PROFILE, '--out', OUT], { encoding: 'utf8', timeout: 120000 });
    if (r.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r.status}`);
    if (!existsSync(OUT)) throw new Error('axes.json 应照常产出');
    for (const f of ['i2-run-history.jsonl', 'i2-run-metrics.json', 'run-history.jsonl', 'run-metrics.json']) {
      if (existsSync(join(tmp, f))) throw new Error(`缺省不应产 ${f}`);
    }
  } finally { await srv.close(); }
});

await checkAsync('I4 零事件：run-history 空文件（非空行）+ metrics totalSteps 0 + locatorHitRate null（分母 0 诚实，codex R1-F3）', async () => {
  const srv = await startLoginSut({});
  try {
    const EV0 = join(tmp, 'i4-events.json');
    writeFileSync(EV0, JSON.stringify({ schemaVersion: 2, channel: 'web', caseId: 'tc_rh0', url: '{{baseUrl}}/plain', recordedAt: '2026-07-03T00:00:00.000Z', compiledBy: 'golden-fixture', authored: false, events: [] }));
    const EXP0 = join(tmp, 'i4-expected.json');
    writeFileSync(EXP0, JSON.stringify({ caseId: 'tc_rh0', channel: 'web', intents: [], globalAssertions: [] }));
    const OUT = join(tmp, 'i4-axes.json');
    const RH = join(tmp, 'i4-run-history.jsonl');
    const RM = join(tmp, 'i4-run-metrics.json');
    const r = spawnSync(process.execPath, [REPLAY, '--events', EV0, '--sut', srv.url, '--expected', EXP0, '--profile', PROFILE, '--out', OUT,
      '--run-history', RH, '--run-metrics', RM], { encoding: 'utf8', timeout: 120000 });
    if (r.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
    if (!existsSync(RH)) throw new Error('零事件仍应产 run-history.jsonl（空文件）');
    const text = readFileSync(RH, 'utf8');
    if (text !== '') throw new Error(`零事件应空文件（JSONL 无空行），实际 ${JSON.stringify(text)}`);
    const m = JSON.parse(readFileSync(RM, 'utf8'));
    conformMetrics(m);
    if (m.totalSteps !== 0 || m.passedActions !== 0) throw new Error(`零事件 totalSteps/passedActions 应 0/0，实际 ${m.totalSteps}/${m.passedActions}`);
    if (m.locatorHitRate !== null) throw new Error(`零定位步 locatorHitRate 应 null（勿塞 0/1），实际 ${m.locatorHitRate}`);
    if (m.runId !== null) throw new Error('未传 --run-id 应 null');
  } finally { await srv.close(); }
});

// ---------- I3 编排接线（fake-sut，复刻 layer3-wiring 法） ----------
await checkAsync('I3 casey run 接线：runDir 落两件、runId=目录名、逐行/聚合过冻结 schema', async () => {
  const EVENTS_REF = join(HERE, 'fixtures', 'seams', 'events.fixture.json');
  const eventsDoc = JSON.parse(readFileSync(EVENTS_REF, 'utf8'));
  const CASE_ID = eventsDoc.caseId;
  let sut;
  try {
    sut = await startFakeSut({ scenario: 'happy' });
    const evFile = join(tmp, 'e2e.events.json');
    const expFile = join(tmp, 'e2e.expected.json');
    const profFile = join(tmp, 'e2e.profile.json');
    const runDir = join(tmp, 'e2e-run');
    mkdirSync(runDir, { recursive: true });
    writeFileSync(evFile, JSON.stringify(eventsDoc));
    writeFileSync(expFile, JSON.stringify({
      caseId: CASE_ID, channel: 'web',
      intents: [{ intentId: 'intent_2', expected: [{ kind: 'noErrorEnvelope', op: 'envelopeOk', value: 'status==200', soft: false }] }],
      globalAssertions: [{ kind: 'noPageError', op: 'absent', soft: false }],
    }));
    writeFileSync(profFile, JSON.stringify({ background: FAKE_SITE_DENYLIST, successField: 'status', successValue: 200 }));
    execFileSync(process.execPath, [CASEY, 'run', CASE_ID,
      '--sut', sut.url, '--events', evFile, '--expected', expFile, '--profile', profFile,
      '--run-dir', runDir, '--generated-at', '2026-07-03T00:00:00.000Z'], { stdio: 'pipe' });
    const RH = join(runDir, 'run-history.jsonl');
    const RM = join(runDir, 'run-metrics.json');
    if (!existsSync(RH)) throw new Error('runDir 未落 run-history.jsonl（编排未接线）');
    if (!existsSync(RM)) throw new Error('runDir 未落 run-metrics.json（编排未接线）');
    const lines = readFileSync(RH, 'utf8').trim().split('\n').map((s) => JSON.parse(s));
    if (lines.length !== eventsDoc.events.length) throw new Error(`应逐 event ${eventsDoc.events.length} 行，实际 ${lines.length}`);
    lines.forEach((l, i) => conformLine(l, i));
    const m = JSON.parse(readFileSync(RM, 'utf8'));
    conformMetrics(m);
    if (m.caseId !== CASE_ID) throw new Error(`metrics caseId 应 ${CASE_ID}`);
    if (m.runId !== basename(runDir)) throw new Error(`runId 应 ${basename(runDir)}（编排器传目录名，G6），实际 ${m.runId}`);
    if (m.totalSteps !== lines.length) throw new Error('totalSteps 应与行数一致');
  } finally {
    if (sut) await sut.close();
  }
});

if (fails.length) {
  for (const f of fails) console.error(`RED  run-history: ${f}`);
  console.error(`RED  run-history: ${pass} 过 / ${fails.length} 红`);
  process.exit(1);
}
console.log(`ok   run-history: ${pass}/${pass} 全过（裁判闭包红线 + 三旗标真产出 + 缺省不变 + 零事件空文件 + 编排接线）`);
process.exit(0);
