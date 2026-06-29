#!/usr/bin/env node
// 冻结黄金标准（P6 自愈准入门 + 非就地漂移补丁，确定性骨架）：
//   消费已冻接缝 drift-patch.fixture.json + drift-patch.schema.json，喂 lib 纯函数，校 fail-safe 与生命周期不变量。
// 钉死纯函数 API（hermetic、无 ajv，沿项目结构不变量校验习惯）：
//   lib/heal-gate.mjs:   admitForHeal(verdictStep) -> { admit:boolean, reason:string }
//   lib/drift-patch.mjs: buildDriftPatch({verdictStep, driftProbe, locatorBefore, locatorAfter, stableSignature, tsToken}) -> patch
//                        canApply(patch) -> boolean
//                        nextStatus(from, event) -> string（非法迁移抛错）
// 内核不变量：裁判零 LLM（自愈只消费 verdict）/ fail-safe 不 fail-open（只对 HARNESS_ERROR 开闸）/ 非就地（人签后才应用）。
// 实现前必须红（lib 不存在 → import 失败退非 0）。改本文件 = Test Ratchet 判红（护栏 #1）。
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const FIX = join(HERE, 'fixtures', 'seams', 'drift-patch.fixture.json');
const SCHEMA = join(HERE, 'schemas', 'drift-patch.schema.json');
const LIB_GATE = join(ROOT, 'lib', 'heal-gate.mjs');
const LIB_PATCH = join(ROOT, 'lib', 'drift-patch.mjs');

const fail = (msg) => { console.error(`RED  p6-selfheal: ${msg}`); process.exit(1); };
const imp = async (p, label) => {
  try { return await import(`file://${p.replace(/\\/g, '/')}`); }
  catch (e) { fail(`无法 import ${label}（实现前预期红）：${String(e && e.message).slice(-200)}`); }
};

const fixture = JSON.parse(readFileSync(FIX, 'utf8'));
const schema = JSON.parse(readFileSync(SCHEMA, 'utf8'));

const { admitForHeal } = await imp(LIB_GATE, 'lib/heal-gate.mjs');
const { buildDriftPatch, canApply, nextStatus } = await imp(LIB_PATCH, 'lib/drift-patch.mjs');
if (typeof admitForHeal !== 'function') fail('lib/heal-gate.mjs 未导出 admitForHeal 纯函数');
if (typeof buildDriftPatch !== 'function') fail('lib/drift-patch.mjs 未导出 buildDriftPatch 纯函数');
if (typeof canApply !== 'function') fail('lib/drift-patch.mjs 未导出 canApply 纯函数');
if (typeof nextStatus !== 'function') fail('lib/drift-patch.mjs 未导出 nextStatus 纯函数');

let checks = 0;
const ok = () => { checks++; };

// ============ ① 自愈准入门逐态 fail-safe（护栏 #13/#14）============
// 只对 HARNESS_ERROR（过程错误/工装漂移）开闸；其余三态一律拒（缺取证≠工装错）。
const adHarness = admitForHeal({ stepId: 'atstep_3', verdict: 'HARNESS_ERROR', reason: null });
if (adHarness == null || adHarness.admit !== true) fail('admitForHeal: HARNESS_ERROR 步必 admit:true（确证漂移开闸）');
if (typeof adHarness.reason !== 'string' || !adHarness.reason) fail('admitForHeal: admit 结果须带非空 reason 串');
ok();

for (const v of ['PASS', 'SUT_DEFECT', 'NEEDS_HUMAN']) {
  const r = admitForHeal({ stepId: 'atstep_0', verdict: v, reason: v === 'NEEDS_HUMAN' ? 'INDETERMINATE' : null });
  if (r == null || r.admit !== false) fail(`admitForHeal: ${v} 步必 admit:false（fail-safe 不 fail-open，护栏 #13/#14）`);
  if (typeof r.reason !== 'string' || !r.reason) fail(`admitForHeal: ${v} 拒绝须带非空 reason 串`);
}
ok();

// 入参畸形 fail-closed（缺 verdict / 非对象 → 不开闸）
for (const bad of [null, undefined, {}, { verdict: 'harness_error' }, { verdict: 'OTHER' }, 'HARNESS_ERROR']) {
  const r = admitForHeal(bad);
  if (!r || r.admit !== false) fail(`admitForHeal: 畸形入参须 fail-closed admit:false（${JSON.stringify(bad)}）`);
}
ok();

// ============ ② buildDriftPatch 产物过 drift-patch 接缝关键不变量 ============
// 输入全部取自已冻 fixture，钉死「自愈只是 verdict 下游消费者」。
const vr = fixture.triggerEvidence.verdictRef;
const verdictStep = {
  caseId: vr.caseId,
  verdictPath: vr.verdictPath,
  stepId: vr.stepId,
  intentId: fixture.intentId,
  atom: fixture.atom,
  channel: fixture.channel,
  verdict: vr.verdict,          // HARNESS_ERROR
  reason: vr.reason,            // null
};
const patch = buildDriftPatch({
  verdictStep,
  driftProbe: fixture.triggerEvidence.driftProbe,
  locatorBefore: fixture.locatorBefore,
  locatorAfter: fixture.locatorAfter,
  stableSignature: fixture.stableSignature,
  tsToken: fixture.tsToken,
});
if (!patch || typeof patch !== 'object') fail('buildDriftPatch 须返回补丁对象');

// 2a. 结构：所有顶层键必在 schema 允许集内（兑现 additionalProperties:false）+ 必填齐备。
const allowed = new Set(Object.keys(schema.properties));
for (const k of Object.keys(patch)) if (!allowed.has(k)) fail(`buildDriftPatch: 产出越界键「${k}」（drift-patch schema additionalProperties:false）`);
for (const r of schema.required) if (!(r in patch)) fail(`buildDriftPatch: 缺 schema 必填键「${r}」`);
ok();

// 2b. 常量与身份字段对齐接缝
if (patch.schemaVersion !== 1) fail('buildDriftPatch: schemaVersion 须 1');
if (patch.patchKind !== 'relocate') fail('buildDriftPatch: patchKind 须 relocate（MVP 唯一种类：单步语义重锚）');
if (patch.caseId !== vr.caseId) fail('buildDriftPatch: caseId 须 === verdictRef.caseId');
if (!/^atstep_[0-9]+$/.test(patch.stepId) || patch.stepId !== vr.stepId) fail('buildDriftPatch: stepId 须为 atstep_i 且 === verdictRef.stepId');
if (!/^[0-9]+$/.test(String(patch.tsToken))) fail('buildDriftPatch: tsToken 须 epoch 毫秒串（^[0-9]+$）');
ok();

// 2c. 合法漂移不变量：稳定签名 before === after（重锚到同一稳定元素，只换 locator）
const sig = patch.stableSignature || {};
if (!sig.canonical || !sig.before || !sig.after) fail('buildDriftPatch: 缺 stableSignature.canonical/before/after');
if (JSON.stringify(sig.before) !== JSON.stringify(sig.after)) fail('buildDriftPatch: stableSignature.before 须 === after（签名变即非纯定位漂移，不得自愈）');
ok();

// 2d. 触发取证：引 verdict=HARNESS_ERROR + 正向漂移三证齐备（护栏 #13）
const te = patch.triggerEvidence || {};
if (!te.verdictRef || te.verdictRef.verdict !== 'HARNESS_ERROR') fail('buildDriftPatch: triggerEvidence.verdictRef.verdict 须 HARNESS_ERROR（裁判零 LLM、自愈只消费裁定）');
if (te.recordedLocatorMiss !== true) fail('buildDriftPatch: 缺 recordedLocatorMiss===true（录制 locator 未命中正向证据）');
if (!te.driftProbe || te.driftProbe.sameSignatureUniquePresent !== true) fail('buildDriftPatch: 缺 driftProbe.sameSignatureUniquePresent===true（同稳定签名唯一元素仍在）');
if (!(te.driftCount >= 1)) fail('buildDriftPatch: driftCount 须 >=1');
ok();

// 2e. 非就地 proposed 态：humanSignoff:null / status:'proposed' / appliedAt:null（人签前原 spec 一字不动）
if (patch.humanSignoff !== null) fail('buildDriftPatch: proposed 态 humanSignoff 须 null（人签后才填）');
if (patch.status !== 'proposed') fail('buildDriftPatch: 刚产出须 status:proposed');
if (patch.appliedAt !== null) fail('buildDriftPatch: proposed 态 appliedAt 须 null（未应用）');
if ('postApplyRecheck' in patch && patch.postApplyRecheck !== null) fail('buildDriftPatch: proposed 态 postApplyRecheck 须 null');
ok();

// 2f. 重锚不得退化到坐标兜底（locatorAfter.strategy !== coord）
if (patch.locatorAfter && patch.locatorAfter.strategy === 'coord') fail('buildDriftPatch: locatorAfter 退化为 coord（重锚须升语义策略，不得纯坐标）');
ok();

// 2g. 签名等值守门：before !== after 的入参须被拒（抛错），不得产出假补丁
let rejectedUnequalSig = false;
try {
  buildDriftPatch({
    verdictStep,
    driftProbe: fixture.triggerEvidence.driftProbe,
    locatorBefore: fixture.locatorBefore,
    locatorAfter: fixture.locatorAfter,
    stableSignature: { canonical: 'x', before: { role: 'button' }, after: { role: 'link' } },
    tsToken: fixture.tsToken,
  });
} catch { rejectedUnequalSig = true; }
if (!rejectedUnequalSig) fail('buildDriftPatch: before!==after 的签名须被拒（非纯定位漂移不得建补丁）');
ok();

// 2h. 准入门守门：非 HARNESS_ERROR 的 verdictStep 不得建补丁（自愈只对确证漂移开闸）
let rejectedNonHarness = false;
try {
  buildDriftPatch({
    verdictStep: { ...verdictStep, verdict: 'SUT_DEFECT' },
    driftProbe: fixture.triggerEvidence.driftProbe,
    locatorBefore: fixture.locatorBefore,
    locatorAfter: fixture.locatorAfter,
    stableSignature: fixture.stableSignature,
    tsToken: fixture.tsToken,
  });
} catch { rejectedNonHarness = true; }
if (!rejectedNonHarness) fail('buildDriftPatch: 非 HARNESS_ERROR 步须被拒（护栏 #13：缺确证不建补丁）');
ok();

// ============ ③ canApply：人签后才应用（非就地，护栏 #5）============
// proposed（未签）→ false
if (canApply(patch) !== false) fail('canApply: proposed（未签）须 false（人签后才应用）');
ok();

// signed + 人签 decision:apply → true
const signed = { ...patch, status: 'signed', humanSignoff: { signedAt: '2026-06-29T17:00:00+08:00', signerId: 'reviewer-1', decision: 'apply' } };
if (canApply(signed) !== true) fail('canApply: signed + humanSignoff(apply) 须 true（人签 apply 后可应用）');
ok();

// signed 但 decision:reject → false（驳回不应用）
const rejectedPatch = { ...patch, status: 'signed', humanSignoff: { signedAt: '2026-06-29T17:00:00+08:00', signerId: 'reviewer-1', decision: 'reject' } };
if (canApply(rejectedPatch) !== false) fail('canApply: decision:reject 须 false（驳回不应用）');
ok();

// 人签缺 signedAt/signerId → false（人签元数据不全不算签）
for (const ho of [{ signerId: 'r', decision: 'apply' }, { signedAt: '2026-06-29T17:00:00+08:00', decision: 'apply' }, null]) {
  if (canApply({ ...patch, status: 'signed', humanSignoff: ho }) !== false) fail('canApply: 人签元数据(signedAt/signerId)不全须 false');
}
ok();

// 已 applied 不得再应用（status 须为 signed 才可应用）
if (canApply({ ...signed, status: 'applied' }) !== false) fail('canApply: 已 applied 须 false（不重复应用）');
ok();

// ============ ④ 状态机：proposed→signed→applied 合法迁移、非法跳变拒 ============
if (nextStatus('proposed', 'sign') !== 'signed') fail('nextStatus: proposed --sign--> signed');
if (nextStatus('signed', 'apply') !== 'applied') fail('nextStatus: signed --apply--> applied');
if (nextStatus('proposed', 'reject') !== 'rejected') fail('nextStatus: proposed --reject--> rejected');
if (nextStatus('signed', 'reject') !== 'rejected') fail('nextStatus: signed --reject--> rejected');
ok();

for (const [from, event] of [['proposed', 'apply'], ['applied', 'apply'], ['rejected', 'sign'], ['proposed', 'bogus'], ['applied', 'sign']]) {
  let threw = false;
  try { nextStatus(from, event); } catch { threw = true; }
  if (!threw) fail(`nextStatus: 非法迁移 ${from} --${event}--> 须抛错（跳过 signed / 终态不可再迁）`);
}
ok();

console.log(`ok   p6-selfheal: ${checks} 组自愈准入门 + 非就地漂移补丁不变量全过`);
process.exit(0);
