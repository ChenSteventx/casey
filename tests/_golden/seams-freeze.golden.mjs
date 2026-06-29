#!/usr/bin/env node
// 冻结黄金标准（排期 v2 第1层接缝冻结）：校验五条接缝 schema + 合成 fixture 的解析与关键不变量。
// 钉死 events / observed-reality / report-model / drift-patch / expected-frozen + prd.schema v2 六组接缝。
// 纯结构 + 不变量校验（无 ajv，与项目 hermetic 习惯一致）。改本文件 = Test Ratchet 判红。
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const S = (p) => join(ROOT, 'tests', '_golden', 'schemas', p);
const F = (p) => join(ROOT, 'tests', '_golden', 'fixtures', 'seams', p);

const fail = (m) => { console.error(`RED  seams-freeze: ${m}`); process.exit(1); };
const load = (p, label) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch (e) { fail(`${label} 读/解析失败（${p}）：${e.message}`); } };

const KINDS = new Set(['urlPathname', 'textVisible', 'countChange', 'inputReadback', 'dropdownReadback', 'requiredFilled', 'streamReplyReceived', 'replyContains', 'replyMatches', 'noPageError', 'noErrorEnvelope', 'noErrorToast']);
const TERMINAL = new Set(['PASS', 'SUT_DEFECT', 'HARNESS_ERROR']);
const NH_REASONS = new Set(['SUT_DEFECT_OR_STALE', 'CASE_DEFECT', 'AMBIGUOUS_ACTION', 'AFFORDANCE_ABSENT', 'INDETERMINATE']);
const FORBIDDEN = ['body', 'headers', 'header', 'cookie', 'cookies', 'setcookie', 'set-cookie', 'token', 'authorization', 'password', 'secret', 'credential', 'apikey'];

// 深扫对象/数组，命中任一禁字段名(大小写无关、去横杠下划线)即返回路径。
function findForbiddenKey(node, path = '') {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) { const r = findForbiddenKey(node[i], `${path}[${i}]`); if (r) return r; }
    return null;
  }
  if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) {
      const norm = k.toLowerCase().replace(/[_-]/g, '');
      if (FORBIDDEN.includes(norm)) return `${path}.${k}`;
      const r = findForbiddenKey(node[k], `${path}.${k}`); if (r) return r;
    }
  }
  return null;
}

let checks = 0;
const ok = () => { checks++; };

// 所有六组 schema 都要解析为带 $schema 的合法 JSON Schema。
for (const s of ['events', 'observed-reality', 'report-model', 'drift-patch', 'expected-frozen']) {
  const j = load(S(`${s}.schema.json`), `schema ${s}`);
  if (!j || typeof j !== 'object' || !j.$schema) fail(`schema ${s}: 非合法 JSON Schema（缺 $schema）`); ok();
}
const prdSchema = load(join(ROOT, 'loop', 'prd.schema.json'), 'loop/prd.schema.json');
if (!prdSchema.$schema) fail('prd.schema.json 缺 $schema'); ok();

// --- events：禁纯坐标步 ---
const ev = load(F('events.fixture.json'), 'events fixture');
if (ev.schemaVersion !== 2 || ev.channel !== 'web') fail('events fixture: schemaVersion 须 2、channel 须 web');
if (!Array.isArray(ev.events) || ev.events.length === 0) fail('events fixture: events 须非空数组');
for (const [i, e] of ev.events.entries()) {
  if (!e.stepId || !e.intentId || !e.action) fail(`events[${i}]: 缺 stepId/intentId/action`);
  if (['click', 'dblclick', 'fill', 'selectOption'].includes(e.action)) {
    const hasStable = e.semantic || (e.role && e.accessibleName !== undefined) || e.text || e.fieldLabel || e.dropdownUnit;
    if (!hasStable) fail(`events[${i}] (${e.action}): 纯坐标步——缺稳定定位字段（semantic/role+accessibleName/text/fieldLabel/dropdownUnit）`);
  }
}
ok();

// --- observed-reality：凭据红线（禁 body/headers/cookie/token...）+ requestLog 同形 ---
const obs = load(F('observed-reality.fixture.json'), 'observed fixture');
const forbidden = findForbiddenKey(obs);
if (forbidden) fail(`observed fixture: 命中凭据/PII 禁字段 ${forbidden}（护栏 #7：取证只读标量、不留 body/headers/凭据）`);
// 找任意 requestLog 条目，校 url/status/initiator 形状（与 verdict network 同形）
const reqEntries = [];
(function collect(n) { if (Array.isArray(n)) n.forEach(collect); else if (n && typeof n === 'object') { if (Array.isArray(n.requestLog)) reqEntries.push(...n.requestLog); Object.values(n).forEach(collect); } })(obs);
if (reqEntries.length === 0) fail('observed fixture: 至少应含一条 requestLog 以钉形状');
for (const r of reqEntries) { if (typeof r.url !== 'string' || typeof r.status !== 'number' || typeof r.initiator !== 'string') fail('observed requestLog 条目须 {url:string,status:number,initiator:string,...}（与 verdict network 同形）'); }
ok();

// --- report-model：缺陷单仅 SUT_DEFECT ---
const rm = load(F('report-model.fixture.json'), 'report-model fixture');
const rmSteps = rm.steps || (rm.case && rm.case.steps) || [];
if (!Array.isArray(rmSteps) || rmSteps.length === 0) fail('report-model fixture: 须含 steps[]');
for (const st of rmSteps) {
  if (st.verdict && !TERMINAL.has(st.verdict) && st.verdict !== 'NEEDS_HUMAN') fail(`report-model: 未知 verdict ${st.verdict}`);
  const dt = st.defectTicket;
  if (dt != null && st.verdict !== 'SUT_DEFECT') fail(`report-model: defectTicket 只应出现在 SUT_DEFECT 步（实为 ${st.verdict}）`);
}
ok();

// --- drift-patch：签名等值不变量 + 正向漂移证据 + 人签后才应用 ---
const dp = load(F('drift-patch.fixture.json'), 'drift-patch fixture');
const sig = dp.stableSignature || {};
if (!sig.canonical || !sig.before || !sig.after) fail('drift-patch: 缺 stableSignature.canonical/before/after（稳定签名）');
if (JSON.stringify(sig.before) !== JSON.stringify(sig.after)) fail('drift-patch: stableSignature.before 须 === after（纯定位漂移不变量，签名变即非工装漂移）');
const te = dp.triggerEvidence || {};
if (!te.verdictRef || te.verdictRef.verdict !== 'HARNESS_ERROR') fail('drift-patch: triggerEvidence.verdictRef.verdict 须 HARNESS_ERROR（自愈准入门只对确证漂移开闸，护栏 #13）');
if (te.recordedLocatorMiss !== true || !te.driftProbe || te.driftProbe.sameSignatureUniquePresent !== true) fail('drift-patch: 须正向漂移证据（recordedLocatorMiss + driftProbe.sameSignatureUniquePresent）');
if (!('humanSignoff' in dp) || !('status' in dp)) fail('drift-patch: 缺 humanSignoff/status 生命周期（非就地：人签后才应用）');
if (dp.status === 'applied' && (!dp.humanSignoff || !dp.humanSignoff.signedAt)) fail('drift-patch: 已 applied 必须有人签 humanSignoff.signedAt');
ok();

// --- expected-frozen（旁车）：人签 + 词表 + expectedVerdict fail-safe ---
const exp = load(F('expected-frozen.fixture.json'), 'expected-frozen fixture');
if (!exp.caseId || !Array.isArray(exp.intents) || exp.intents.length === 0) fail('expected-frozen: 须 caseId + 非空 intents[]');
const allAssertions = [];
for (const it of exp.intents) {
  if (!it.intentId || !Array.isArray(it.expected) || it.expected.length === 0) fail(`expected-frozen intent ${it.intentId}: 须 intentId + 非空 expected[]`);
  allAssertions.push(...it.expected);
  const ev2 = it.expectedVerdict;
  if (ev2) {
    if (TERMINAL.has(ev2.verdict)) { if (ev2.reason != null) fail(`expectedVerdict ${it.intentId}: 终判 ${ev2.verdict} 的 reason 必 null`); }
    else if (ev2.verdict === 'NEEDS_HUMAN') { if (!NH_REASONS.has(ev2.reason)) fail(`expectedVerdict ${it.intentId}: NEEDS_HUMAN 必带 reason 子类`); }
    else fail(`expectedVerdict ${it.intentId}: 未知 verdict ${ev2.verdict}`);
  }
}
if (Array.isArray(exp.globalAssertions)) allAssertions.push(...exp.globalAssertions);
for (const a of allAssertions) {
  if (!KINDS.has(a.kind)) fail(`expected-frozen: 词表外 kind ${a.kind}`);
  if (!a.signedAt || !a.signedAgainstBuild || !a.signerId) fail(`expected-frozen: 断言(${a.kind})缺人签元数据 signedAt/signedAgainstBuild/signerId`);
}
ok();

// --- prd.schema v2 向后兼容 + prd-v2 fixture 形状 ---
const sv = prdSchema.properties && prdSchema.properties.schemaVersion;
const vals = sv && (sv.enum || (sv.const != null ? [sv.const] : []));
if (!vals || !vals.includes(1) || !vals.includes(2)) fail('prd.schema.json: schemaVersion 须 enum 含 1 与 2（v2 向后兼容 v1）');
for (const r of ['schemaVersion', 'task', 'stories']) if (!(prdSchema.required || []).includes(r)) fail(`prd.schema.json: v1 必填字段 ${r} 不得丢（向后兼容）`);
const prdv2 = load(F('prd-v2.fixture.json'), 'prd-v2 fixture');
if (prdv2.schemaVersion !== 2 || !prdv2.caseId || !prdv2.expectedFrozenPath) fail('prd-v2 fixture: 须 schemaVersion=2 + caseId + expectedFrozenPath（旁车指针）');
if (/\"intents\"\s*:/.test(JSON.stringify(prdv2)) && prdv2.intents) fail('prd-v2 fixture: typed expected[] 应在旁车、不内嵌 prd（护栏 #5 物理隔离）');
// 现有 v1 prd 仍合法（形状不变）
const v1 = load(join(ROOT, 'loop', 'prd-p2-intent-compile.json'), 'prd-p2-intent-compile.json');
if (v1.schemaVersion !== 1 || typeof v1.task !== 'string' || !Array.isArray(v1.stories)) fail('向后兼容: 现有 v1 prd 形状被破坏');
ok();

console.log(`ok   seams-freeze: ${checks} 组接缝 schema+fixture 解析与不变量全过`);
process.exit(0);
