#!/usr/bin/env node
// 冻结黄金标准（排期 v3 轨 P·借鉴接缝 v2 增冻）：校验四条接缝 schema + 合成 fixture 的解析与关键不变量。
// 钉死 run-history / action-vocabulary / failure-ledger-entry / channel-driver 四组接缝。
// 动作真值源读已冻 events.schema 的 action 枚举（决策 2.1），四接缝的 action ⊆ 它。
// 纯结构 + 不变量校验（无 ajv，与项目 hermetic 习惯一致）。改本文件 = Test Ratchet 判红。
// codex 异构评审 R1 续钉：hard invariant 须在 schema 层钉住（非仅抽查 fixture）——
//   补 schema-encoding 元检查：coordinateFallback.allowed const:false / channel web coordinateSpace if-then null（ADR-0003）、
//   run-history valueRef pattern（护栏 #7 value 侧）、failure-ledger failedAssertion⟺assertionKind allOf（护栏 #17）；及 valueRef 值内容校验。
//   跨字段相等（fingerprintInputs 与顶层）与跨文件互链（driverId）draft-07 表达不了，仍由本 golden 校验（已在四接缝块）。
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const S = (p) => join(ROOT, 'tests', '_golden', 'schemas', p);
const F = (p) => join(ROOT, 'tests', '_golden', 'fixtures', 'seams-v2', p);

const fail = (m) => { console.error(`RED  seams-freeze-v2: ${m}`); process.exit(1); };
const load = (p, label) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) { fail(`${label} 读/解析失败（${p}）：${e.message}`); } };

// 凭据/PII 禁字段（复用 seams-freeze.golden.mjs 的 findForbiddenKey 口径，护栏 #7）
const FORBIDDEN = ['body', 'headers', 'header', 'cookie', 'cookies', 'setcookie', 'set-cookie', 'token', 'authorization', 'password', 'secret', 'credential', 'apikey'];
function findForbiddenKey(node, path = '') {
  if (Array.isArray(node)) { for (let i = 0; i < node.length; i++) { const r = findForbiddenKey(node[i], `${path}[${i}]`); if (r) return r; } return null; }
  if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) {
      const norm = k.toLowerCase().replace(/[_-]/g, '');
      if (FORBIDDEN.includes(norm)) return `${path}.${k}`;
      const r = findForbiddenKey(node[k], `${path}.${k}`); if (r) return r;
    }
  }
  return null;
}

const TERMINAL = new Set(['PASS', 'SUT_DEFECT', 'HARNESS_ERROR']);
const NH_REASONS = new Set(['SUT_DEFECT_OR_STALE', 'CASE_DEFECT', 'AMBIGUOUS_ACTION', 'AFFORDANCE_ABSENT', 'INDETERMINATE']);

let checks = 0;
const ok = () => { checks++; };

// --- 动作真值源：读已冻 events.schema 的 action 枚举（决策 2.1，非硬编码）---
const eventsSchema = load(S('events.schema.json'), 'events.schema（真值源）');
const ACTION_ENUM = eventsSchema?.definitions?.event?.properties?.action?.enum;
if (!Array.isArray(ACTION_ENUM) || ACTION_ENUM.length !== 7) fail('events.schema: action 枚举缺失或非 7 项（真值源被破坏）');
const ACTIONS = new Set(ACTION_ENUM);
ok();

// --- 四条 schema 都要解析为带 $schema 的合法 JSON Schema ---
for (const s of ['run-history', 'action-vocabulary', 'failure-ledger-entry', 'channel-driver']) {
  const j = load(S(`${s}.schema.json`), `schema ${s}`);
  if (!j || typeof j !== 'object' || !j.$schema) fail(`schema ${s}: 非合法 JSON Schema（缺 $schema）`);
}
ok();

// --- seam1 run-history：无 method/cacheStatus、action⊆枚举、intentId 非空、反例 passedActions<totalSteps ---
{
  const fx = load(F('run-history.fixture.json'), 'run-history fixture');
  if (!Array.isArray(fx.runHistoryLines) || fx.runHistoryLines.length === 0) fail('run-history: runHistoryLines 须非空数组');
  for (const [i, ln] of fx.runHistoryLines.entries()) {
    if ('method' in ln) fail(`run-history line[${i}]: 残留弃用字段 method（应为 action，决策 1.2）`);
    if ('cacheStatus' in ln) fail(`run-history line[${i}]: 残留已删字段 cacheStatus（决策 1.1）`);
    if (!ACTIONS.has(ln.action)) fail(`run-history line[${i}]: action ${ln.action} 不在 events.schema 7 枚举`);
    if (typeof ln.intentId !== 'string' || ln.intentId.length < 1) fail(`run-history line[${i}]: intentId 须非空 string（决策 1.3 minLength:1）`);
    for (const r of ['timestamp', 'caseId', 'stepId', 'quietPointReached', 'durationMs', 'result']) if (!(r in ln)) fail(`run-history line[${i}]: 缺必填 ${r}`);
  }
  const m = fx.runMetrics;
  if (!m) fail('run-history: 缺 runMetrics 聚合');
  if ('cacheHitRate' in m) fail('run-metrics: 残留已删字段 cacheHitRate（决策 1.1）');
  if (!(m.passedActions < m.totalSteps)) fail('run-metrics: 反例应示范 passedActions < totalSteps（result 非四态、跑到底≠PASS）');
  const fk = findForbiddenKey(fx); if (fk) fail(`run-history fixture: 命中凭据/PII 禁字段 ${fk}（护栏 #7）`);
}
ok();

// --- seam2 action-vocabulary：action⊆枚举、覆盖全7、web坐标兜底false、failClosed红线、无golden不入表 ---
{
  const fx = load(F('action-vocabulary.fixture.json'), 'action-vocabulary fixture');
  if (!fx.source || String(fx.source.enumPath).indexOf('events.json') < 0) fail('action-vocab: source.enumPath 须指向 events.json 枚举（决策 2.1）');
  if (!Array.isArray(fx.entries) || fx.entries.length === 0) fail('action-vocab: entries 须非空');
  const seen = new Set();
  for (const [i, e] of fx.entries.entries()) {
    if (!ACTIONS.has(e.action)) fail(`action-vocab entry[${i}]: action ${e.action} 不在 events.schema 枚举（决策 2.1/Q3）`);
    seen.add(e.action);
    if (!e.coordinateFallback || e.coordinateFallback.allowed !== false) fail(`action-vocab entry[${i}] (${e.action}): web 坐标兜底 allowed 须 false（禁纯坐标步）`);
    if (!e.failClosed || e.failClosed.neverSubstitute !== true || e.failClosed.neverSelfHeal !== true) fail(`action-vocab entry[${i}]: failClosed 红线 neverSubstitute/neverSelfHeal 须 true（护栏 #13/#14）`);
    if (!Array.isArray(e.golden) || e.golden.length < 1) fail(`action-vocab entry[${i}]: 无 golden 不得入表（动作侧棘轮）`);
  }
  if (seen.size !== ACTIONS.size) fail(`action-vocab: fixture 应覆盖全 ${ACTIONS.size} 动作，实覆盖 ${seen.size}`);
  const fk = findForbiddenKey(fx); if (fk) fail(`action-vocab fixture: 命中凭据/PII 禁字段 ${fk}（护栏 #7）`);
}
ok();

// --- seam3 failure-ledger：三条 fail-safe、fingerprintInputs 与顶层一致、failedAssertion⟺assertionKind ---
{
  const fx = load(F('failure-ledger.fixture.json'), 'failure-ledger fixture');
  if (!Array.isArray(fx.entries) || fx.entries.length === 0) fail('failure-ledger: entries 须非空');
  for (const [i, e] of fx.entries.entries()) {
    if (TERMINAL.has(e.verdict) && e.verdict !== 'PASS') { if (e.reason !== null) fail(`fle[${i}]: 终判 ${e.verdict} 的 reason 须 null（fail-safe）`); }
    if (e.verdict === 'NEEDS_HUMAN' && !NH_REASONS.has(e.reason)) fail(`fle[${i}]: NEEDS_HUMAN 须带 reason 子类（catch-all 落 INDETERMINATE）`);
    if (e.humanResolution && e.humanResolution.decision === 'drift-healed' && e.verdict !== 'HARNESS_ERROR') fail(`fle[${i}]: drift-healed 仅 HARNESS_ERROR 合法（护栏 #13/#15）`);
    if (!e.fingerprintInputs) fail(`fle[${i}]: 缺 fingerprintInputs`);
    for (const k of ['channel', 'verdict', 'reason', 'atom']) if (e.fingerprintInputs[k] !== e[k]) fail(`fle[${i}]: fingerprintInputs.${k} 与顶层不一致（防指纹与记录漂移）`);
    const hasFA = e.failedAssertion != null;
    const hasKind = e.fingerprintInputs.assertionKind != null;
    if (hasFA !== hasKind) fail(`fle[${i}]: failedAssertion 非空 ⟺ assertionKind 非空（断言失败才有断言快照）`);
    if (!/^sha256:[0-9a-f]{64}$/.test(e.fingerprint)) fail(`fle[${i}]: fingerprint 格式须 ^sha256:[0-9a-f]{64}$`);
  }
  const fk = findForbiddenKey(fx); if (fk) fail(`failure-ledger fixture: 命中凭据/PII 禁字段 ${fk}（护栏 #7）`);
}
ok();

// --- seam4 channel-driver：actionSpace⊆枚举、web⟹coordinateSpace null、driverId 与 action-vocab 互链、profileRef 指针 ---
{
  const fx = load(F('channel-driver.fixture.json'), 'channel-driver fixture');
  const av = load(F('action-vocabulary.fixture.json'), 'action-vocabulary fixture（互链）');
  const avDrivers = new Set((av.entries || []).map((e) => e.driver && e.driver.channelDriver));
  if (!fx.actionSource || String(fx.actionSource.enumPath).indexOf('events.json') < 0) fail('channel-driver: actionSource.enumPath 须指向 events.json（决策 2.1）');
  if (!Array.isArray(fx.drivers) || fx.drivers.length === 0) fail('channel-driver: drivers 须非空');
  for (const [i, d] of fx.drivers.entries()) {
    if (d.channel === 'web' && d.coordinateSpace !== null) fail(`channel-driver driver[${i}]: web 的 coordinateSpace 须 null（禁纯坐标步，决策 Q3）`);
    if (!(d.profileRef === null || typeof d.profileRef === 'string')) fail(`channel-driver driver[${i}]: profileRef 须字符串指针或 null（不内嵌 profile，决策 Q2）`);
    if (!Array.isArray(d.actionSpace) || d.actionSpace.length === 0) fail(`channel-driver driver[${i}]: actionSpace 须非空`);
    for (const [j, a] of d.actionSpace.entries()) {
      if (!ACTIONS.has(a.action)) fail(`channel-driver driver[${i}].actionSpace[${j}]: action ${a.action} 不在 events.schema 枚举（决策 2.1/Q3）`);
      if (typeof a.call !== 'string' || !a.call.length) fail(`channel-driver driver[${i}].actionSpace[${j}]: call 须非空 string`);
    }
    if (!avDrivers.has(d.driverId)) fail(`channel-driver driver[${i}]: driverId ${d.driverId} 未在 action-vocabulary driver.channelDriver 出现（互链漂移，决策 Q2）`);
  }
  const fk = findForbiddenKey(fx); if (fk) fail(`channel-driver fixture: 命中凭据/PII 禁字段 ${fk}（护栏 #7）`);
}
ok();

// --- schema 层硬不变量机制化自守（codex 评审 R1：hard invariant 须在 schema 钉住、非仅 golden 抽查 fixture；真实 producer 只跑 schema 也被拦）---
{
  const av = load(S('action-vocabulary.schema.json'), 'action-vocabulary schema');
  const cf = av && av.definitions && av.definitions.actionEntry && av.definitions.actionEntry.properties && av.definitions.actionEntry.properties.coordinateFallback && av.definitions.actionEntry.properties.coordinateFallback.properties;
  if (!cf || cf.allowed.const !== false) fail('action-vocabulary.schema: coordinateFallback.allowed 须 const:false（禁纯坐标步 ADR-0003 机制化、非 type:boolean）');
  if (cf.onlyVia.const !== null) fail('action-vocabulary.schema: coordinateFallback.onlyVia 须 const:null');

  const cd = load(S('channel-driver.schema.json'), 'channel-driver schema');
  const drvAllOf = cd && cd.definitions && cd.definitions.driver && cd.definitions.driver.allOf;
  const webNull = Array.isArray(drvAllOf) && drvAllOf.some((r) => r && r.if && r.if.properties && r.if.properties.channel && r.if.properties.channel.const === 'web' && r.then && r.then.properties && r.then.properties.coordinateSpace && r.then.properties.coordinateSpace.const === null);
  if (!webNull) fail('channel-driver.schema: driver.allOf 须含 if channel=web then coordinateSpace const:null（ADR-0003 机制化）');

  const rh = load(S('run-history.schema.json'), 'run-history schema');
  const vr = rh && rh.definitions && rh.definitions.runHistoryLine && rh.definitions.runHistoryLine.properties && rh.definitions.runHistoryLine.properties.parameters && rh.definitions.runHistoryLine.properties.parameters.properties && rh.definitions.runHistoryLine.properties.parameters.properties.valueRef;
  if (!vr || typeof vr.pattern !== 'string' || !vr.pattern.length) fail('run-history.schema: parameters.valueRef 须带 pattern 钉死脱敏引用形态（护栏 #7 value 侧红线）');

  const fle = load(S('failure-ledger-entry.schema.json'), 'failure-ledger schema');
  const faKind = Array.isArray(fle && fle.allOf) && fle.allOf.some((r) => r && r.if && r.if.properties && r.if.properties.failedAssertion && r.if.properties.failedAssertion.type === 'object' && r.then && r.then.properties && r.then.properties.fingerprintInputs && r.then.properties.fingerprintInputs.properties && r.then.properties.fingerprintInputs.properties.assertionKind && r.then.properties.fingerprintInputs.properties.assertionKind.type === 'string');
  if (!faKind) fail('failure-ledger.schema: allOf 须含 failedAssertion=object ⟹ fingerprintInputs.assertionKind:string（护栏 #17 断言侧机制化）');
}
ok();

// --- run-history fixture valueRef 值须匹 schema pattern（value 侧红线，此前 golden 只扫 key 名不扫值内容）---
{
  const rh = load(S('run-history.schema.json'), 'run-history schema');
  const vrPat = new RegExp(rh.definitions.runHistoryLine.properties.parameters.properties.valueRef.pattern);
  const fx = load(F('run-history.fixture.json'), 'run-history fixture');
  for (const [i, ln] of fx.runHistoryLines.entries()) {
    const vr = ln.parameters && ln.parameters.valueRef;
    if (vr != null && !vrPat.test(vr)) fail(`run-history line[${i}]: valueRef「${vr}」不匹脱敏引用 pattern（护栏 #7，恐落 fill/press 字面量）`);
  }
}
ok();

console.log(`ok   seams-freeze-v2: ${checks} 组接缝 schema+fixture 解析与不变量全过`);
process.exit(0);
