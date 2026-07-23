#!/usr/bin/env node
// entity-identity-spine（C0）验收金牌：闭集准入注册表（红先行、zero-SUT）。
// 纯 node：纯内存夹具 + 一个目标纯函数（零浏览器、零网络、零 server、零 fake SUT、零子进程）。
// 断言纪律：退出码 + deepEqual/具名 rejectCode 钉死；禁标记串 grep（判绿只信退出码，MEMORY 铁律）。
//
// ── C0 目标（母规格 docs/plans/entity-identity-lastmile/plan.md §3/§5、spine plan §验收点、GRILL D2）──
// 今天 bin/sign.mjs 把「哪个原子产身份观察、观察行必须是什么 kind」写死成 agent：
//   :247 IDENTITY_OBSERVATION_ATOM='agent.searchOpen'（常量硬钉）
//   :275-276 row.kind==='agent' && row.atom==='agent.searchOpen'（硬校验，不匹配 die(65)）
// C0 把这条独木桥泛化成一张按对象种类查的【闭集注册表】：
//   action policy 声明的原子 → required role → bound kind/provenance → 允许的 observation issuer/atom。
// 签署时校验观察行的【角色、数量、来源、关联 ID 恰好匹配】，不匹配 fail-closed 拒。
// codex Q3 铁律：不能改成「任何同 kind 的观察行都接受」——否则伪造一条 kind:'workflow' 的观察行可混入。
// C0 边界：只注册 agent（agent.searchOpen→agent/subject），【不注册 workflow】（C2）、不碰 v2、agent 行为逐字不变。
//
// ── 目标验证器 API（本金牌冻结，loop 阶段实现须迎合；今日尚不存在=红先行的红）──
// 新模块 lib/entity-observation-registry.mjs 导出：
//   const ENTITY_OBSERVATION_REGISTRY : Map<policyAtom, {
//       boundKind: string,                 // 该原子绑定的实体 kind（agent.searchOpen→'agent'）
//       requiredRoles: string[],           // 恰好角色集（agent.searchOpen 默认 mutation/[subject]）
//       issuer: { sourceKind, atom },      // 允许的 observation 签发信封（compile-envelope / agent.searchOpen）
//       allowedBindingModes: string[],     // 允许的 bindingMode（existing / created-in-run）
//       provenanceByBindingMode: { [mode]: provenance },  // 每 mode 强制的 provenance（见下）
//   }>
//   const SUPPORTED_ENTITY_KINDS : Set<string>   // 实体 kind 词表（agent 已注册观察原子；workflow 仅入词表未开观察通道=C2）
//   function validateObservationAdmission({ events, observation, bindings, registry?, supportedKinds? })
//       → { ok: boolean, rejectCode: string|null }
//
// provenance 维度锚定既有收据内核 lib/entity-semantic-lock.mjs:5-6,74-79,127-128（不是新造字段）：
//   bindingMode ∈ {existing, created-in-run}；provenance(=收据 source) ∈ {user-confirmed, platform-readback}；
//   不变量：existing → user-confirmed（母规格「user-approval」即此）；created-in-run → platform-readback。
//   C0 把这条内核不变量上提到【准入时】强制。
//
// ── 8 条准入反例（逐条独立断言；每条 surgical 只坏一维、余维全合法，故期望具名 rejectCode 唯一）──
//   c1 观察行 kind 与该原子 bound kind 不符（kind:'workflow'，词表内但非 agent.searchOpen 所绑）→ OBSERVATION_KIND_NOT_BOUND_TO_ATOM
//   c2 角色数量不匹配（2a 多于：同终端 click 双观察行=基数越界；2b 少于：观察行空但事件有终端 click 需 1 subject）→ OBSERVATION_ROLE_COUNT_MISMATCH
//   c3 observation 来源(issuer/atom)不在允许集（3a source.kind 非 compile-envelope；3b source.atom 非 agent.searchOpen）→ OBSERVATION_ISSUER_NOT_ALLOWED
//   c4 关联 ID 与事件流不对应（4a sourceIntentId 无对应 binding；4b candidateId 无对应 binding；均单行锚终端、五元 join 断）→ OBSERVATION_CORRELATION_MISMATCH
//   c5 provenance 缺失或与 bindingMode 不符（5a 缺 provenance；5b existing 却配 platform-readback）→ OBSERVATION_PROVENANCE_INVALID
//   c6 数量恰好但 kind 越界（kind:'chatflow' 不在 SUPPORTED_ENTITY_KINDS 词表）→ OBSERVATION_KIND_UNSUPPORTED
//   c7 合法 agent 观察行（今天 sign.mjs 能过的那种，含 existing/user-confirmed provenance）→ ok:true（回归保护——agent 保序）
//   c8 无编译器的孤儿策略原子 agent.removeToolByName（事件有、观察注册表无）→ 不索要 observation → ok:true（D4 不误拒）
//
// 拒绝码归类（本金牌授权、loop 实现须循，令每条 poison 只坏一维、拒绝码与实现精度顺序无关）：
//   · 基数维（每终端 click 观察行数 ≠ requiredRoles 数，含重复锚同一终端 click；同 sign.mjs:278/285「join 基数」口径）→ OBSERVATION_ROLE_COUNT_MISMATCH
//   · 关联维（五元 join stepId/sourceIntentId/candidateId/role/atom 与 binding/事件流不对应，单行且基数正确）→ OBSERVATION_CORRELATION_MISMATCH
//   各 poison 保「余维全合法、锚正确终端 click、基数恰当」，故拒绝码在任何合理实现下唯一。
//
// 红先行判据：泛化落地前 lib/entity-observation-registry.mjs 尚不存在，import 即失败（ERR_MODULE_NOT_FOUND）=RED；
// 实现后 8 条全绿。夹具形态锚真机（docs/plans/real-uat-attestation/evidence/uat-run.md）：kind=agent、
// 19 位纯数字 platformId string、code=znt_atl_*、sourcePath=/ai-manager/agent/setup/queryAgentPageList。

import { deepStrictEqual } from 'node:assert';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SECTION = process.argv[2] ?? 'all';
const SECTIONS = new Set(['all', 'r0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8']);
if (!SECTIONS.has(SECTION)) process.exit(2);
const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE_PATH = resolve(HERE, '..', '..', 'lib', 'entity-observation-registry.mjs');

// ── 红先行：目标模块尚不存在则 import 抛错，打印 RED 行并 exit 1（红的机制=API 未实现）──
let mod;
try {
  mod = await import(MODULE_PATH);
} catch (error) {
  console.error(`RED  entity-identity-spine.admission-registry: 目标验证器模块缺席（红先行，loop 阶段实现）—— ${String(error?.message || error).slice(0, 240)}`);
  process.exit(1);
}
const { validateObservationAdmission, ENTITY_OBSERVATION_REGISTRY, SUPPORTED_ENTITY_KINDS } = mod;
if (typeof validateObservationAdmission !== 'function') {
  console.error('RED  entity-identity-spine.admission-registry: lib/entity-observation-registry.mjs 未导出 validateObservationAdmission 纯函数');
  process.exit(1);
}

// 闭集具名 rejectCode（本金牌冻结的合法拒绝码全集；实现返回码须落此集）。
const REJECT_CODES = new Set([
  'OBSERVATION_KIND_NOT_BOUND_TO_ATOM',
  'OBSERVATION_KIND_UNSUPPORTED',
  'OBSERVATION_ROLE_COUNT_MISMATCH',
  'OBSERVATION_ISSUER_NOT_ALLOWED',
  'OBSERVATION_CORRELATION_MISMATCH',
  'OBSERVATION_PROVENANCE_INVALID',
]);

const failures = [];
let passed = 0;
function test(section, name, fn) {
  if (SECTION !== 'all' && SECTION !== section) return;
  try { fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${String(error?.message || error)}`); console.error(`FAIL ${name}: ${String(error?.message || error)}`); }
}
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const brief = (value) => { try { return JSON.stringify(value).slice(0, 160); } catch { return String(value); } };

function expectReject(input, code, label) {
  const r = validateObservationAdmission(input);
  assert(r && typeof r === 'object', `${label}: 返回须为对象；实得 ${brief(r)}`);
  assert(r.ok === false, `${label}: 期望拒签（ok:false）；实得 ok=${r?.ok} rejectCode=${r?.rejectCode}`);
  assert(REJECT_CODES.has(r.rejectCode), `${label}: rejectCode 须为闭集具名码之一；实得 ${brief(r.rejectCode)}`);
  assert(r.rejectCode === code, `${label}: 期望 rejectCode=${code}；实得 ${r.rejectCode}`);
}
function expectPass(input, label) {
  const r = validateObservationAdmission(input);
  assert(r && typeof r === 'object', `${label}: 返回须为对象；实得 ${brief(r)}`);
  assert(r.ok === true, `${label}: 期望过签（ok:true）；实得 ok=${r?.ok} rejectCode=${r?.rejectCode}`);
  assert(r.rejectCode == null, `${label}: 过签时 rejectCode 须为 null；实得 ${brief(r.rejectCode)}`);
}

// ── 夹具（形态锚真机 uat-run.md）──────────────────────────────────────────────────
const AGENT_NAME = 'atl-agent-readback';
const AGENT_CODE = 'znt_atl_readback';              // 真机自动生成码形态 znt_atl_*
const AGENT_PLATFORM_ID = '1234567890123456789';   // 19 位纯数字 string（opaque，不作数）
const SOURCE_PATH = '/ai-manager/agent/setup/queryAgentPageList';

// 单 agent.searchOpen intent 的 fill/press/click；终端 click = atstep_3。
const EVENTS = [
  { stepId: 'atstep_1', intentId: 'intent_1', atom: 'agent.searchOpen', action: 'fill', value: AGENT_NAME },
  { stepId: 'atstep_2', intentId: 'intent_1', atom: 'agent.searchOpen', action: 'press', key: 'Enter' },
  { stepId: 'atstep_3', intentId: 'intent_1', atom: 'agent.searchOpen', action: 'click', text: AGENT_NAME },
];
const BINDINGS = ['atstep_1', 'atstep_2', 'atstep_3'].map((stepId) => ({
  stepId, intentId: 'intent_1', atom: 'agent.searchOpen',
  sourceIntentId: 'source_1', candidateId: 'candidate-agent-main', role: 'subject',
}));

function validRow(overrides = {}) {
  return {
    kind: 'agent', name: AGENT_NAME, code: AGENT_CODE, platformId: AGENT_PLATFORM_ID,
    sourceIntentId: 'source_1', candidateId: 'candidate-agent-main', role: 'subject',
    atom: 'agent.searchOpen', evidenceStepId: 'atstep_3', sourcePath: SOURCE_PATH,
    bindingMode: 'existing', provenance: 'user-confirmed',
    ...overrides,
  };
}
function observationWith(rows) {
  return { source: { kind: 'compile-envelope', atom: 'agent.searchOpen' }, observations: rows };
}
// 全合法输入（=c7）：各 poison case 从此克隆并只改一维。
function validInput(over = {}) {
  return {
    events: EVENTS.map((e) => ({ ...e })),
    observation: observationWith([validRow()]),
    bindings: BINDINGS.map((b) => ({ ...b })),
    ...over,
  };
}

// ── r0 结构：注册表是闭集（agent 注册、workflow 观察原子未注册）───────────────────
test('r0', 'r0 ENTITY_OBSERVATION_REGISTRY 是闭集 Map：agent.searchOpen→agent/subject 注册；workflow 观察原子未注册（C0 边界）', () => {
  assert(ENTITY_OBSERVATION_REGISTRY instanceof Map, 'ENTITY_OBSERVATION_REGISTRY 须为 Map（同 SIDE_EFFECT_POLICY 形态）');
  const entry = ENTITY_OBSERVATION_REGISTRY.get('agent.searchOpen');
  assert(entry && typeof entry === 'object', 'agent.searchOpen 必须在观察注册表内');
  assert(entry.boundKind === 'agent', `agent.searchOpen bound kind 须 'agent'；实得 ${brief(entry.boundKind)}`);
  deepStrictEqual([...entry.requiredRoles], ['subject'], 'agent.searchOpen requiredRoles 须恰 [subject]（默认 mutation/subject，同 sign.mjs 今日语义）');
  assert(entry.issuer && entry.issuer.sourceKind === 'compile-envelope' && entry.issuer.atom === 'agent.searchOpen',
    `agent.searchOpen issuer 须 {compile-envelope, agent.searchOpen}；实得 ${brief(entry.issuer)}`);
  assert(entry.provenanceByBindingMode && entry.provenanceByBindingMode.existing === 'user-confirmed'
    && entry.provenanceByBindingMode['created-in-run'] === 'platform-readback',
    `provenanceByBindingMode 须锚收据内核（existing→user-confirmed、created-in-run→platform-readback）；实得 ${brief(entry.provenanceByBindingMode)}`);
  // C0 不得注册 workflow 观察原子（观察通道泛化=C2）。
  assert(!ENTITY_OBSERVATION_REGISTRY.has('workflow.bindAgent') && !ENTITY_OBSERVATION_REGISTRY.has('workflow.create'),
    'C0 不得在观察注册表注册 workflow 原子（workflow 读回=C2）');
  // kind 词表须含 agent 与 workflow，供区分 c1（词表内但非绑定 kind）与 c6（词表外 kind）。
  assert(SUPPORTED_ENTITY_KINDS instanceof Set && SUPPORTED_ENTITY_KINDS.has('agent') && SUPPORTED_ENTITY_KINDS.has('workflow'),
    'SUPPORTED_ENTITY_KINDS 须为含 agent 与 workflow 的 Set（workflow 入词表但观察通道未开）');
  assert(!SUPPORTED_ENTITY_KINDS.has('chatflow'), 'SUPPORTED_ENTITY_KINDS 不得含未定义 kind（c6 需其为词表外）');
});

// ── c1 kind 与 bound kind 不符（词表内但非绑定 kind：kind:'workflow'）→ 拒 ─────────
// codex Q3 铁律具体化：伪造一条 kind:'workflow' 观察行不得混入 agent.searchOpen。
test('c1', "c1 观察行 kind='workflow'（词表内、非 agent.searchOpen 所绑）→ OBSERVATION_KIND_NOT_BOUND_TO_ATOM", () => {
  const input = validInput({ observation: observationWith([validRow({ kind: 'workflow' })]) });
  expectReject(input, 'OBSERVATION_KIND_NOT_BOUND_TO_ATOM', "c1 kind='workflow'");
});

// ── c2 角色数量不匹配（多于 / 少于 requiredRoles）→ 拒 ───────────────────────────
test('c2', 'c2a 角色多于（同终端 click 双观察行、均 role=subject，基数 2≠requiredRoles 1）→ OBSERVATION_ROLE_COUNT_MISMATCH', () => {
  // 两行逐字合法（kind=agent、同锚终端 click atstep_3、五元 join 各命中同一 subject binding、provenance 合法），
  // 唯一越界=同终端 click 的观察基数 2≠1（sign.mjs:278 同一终端 click 重复即拒的「join 基数」口径）。
  const input = validInput({ observation: observationWith([validRow(), validRow()]) });
  expectReject(input, 'OBSERVATION_ROLE_COUNT_MISMATCH', 'c2a 角色多于（基数越界）');
});
test('c2', 'c2b 角色少于（观察行空、但事件含终端 click 需 1 subject 观察）→ OBSERVATION_ROLE_COUNT_MISMATCH', () => {
  const input = validInput({ observation: observationWith([]) });
  expectReject(input, 'OBSERVATION_ROLE_COUNT_MISMATCH', 'c2b 角色少于');
});

// ── c3 observation 来源(issuer/atom)不在允许集 → 拒 ───────────────────────────────
test('c3', "c3a source.kind='user-supplied'（非 compile-envelope 签发信封）→ OBSERVATION_ISSUER_NOT_ALLOWED", () => {
  const input = validInput({ observation: { source: { kind: 'user-supplied', atom: 'agent.searchOpen' }, observations: [validRow()] } });
  expectReject(input, 'OBSERVATION_ISSUER_NOT_ALLOWED', 'c3a issuer kind 非法');
});
test('c3', "c3b source.atom='nav.agentManagement'（issuer 自报别的原子）→ OBSERVATION_ISSUER_NOT_ALLOWED", () => {
  const input = validInput({ observation: { source: { kind: 'compile-envelope', atom: 'nav.agentManagement' }, observations: [validRow()] } });
  expectReject(input, 'OBSERVATION_ISSUER_NOT_ALLOWED', 'c3b issuer atom 非法');
});

// ── c4 关联 ID（stepId/intentId 与事件流）不对应 → 拒（单行锚正确终端、基数恰当，只五元 join 断）─────
test('c4', "c4a sourceIntentId='source_ghost'（intentId 族关联无对应 binding，五元 join 断）→ OBSERVATION_CORRELATION_MISMATCH", () => {
  const input = validInput({ observation: observationWith([validRow({ sourceIntentId: 'source_ghost' })]) });
  expectReject(input, 'OBSERVATION_CORRELATION_MISMATCH', 'c4a sourceIntentId 无 binding');
});
test('c4', "c4b candidateId='candidate-ghost'（候选关联无对应 binding，五元 join 断）→ OBSERVATION_CORRELATION_MISMATCH", () => {
  const input = validInput({ observation: observationWith([validRow({ candidateId: 'candidate-ghost' })]) });
  expectReject(input, 'OBSERVATION_CORRELATION_MISMATCH', 'c4b candidateId 无 binding');
});

// ── c5 provenance 缺失 / 与 bindingMode 不符 → 拒（锚收据内核不变量）───────────────
test('c5', 'c5a provenance 缺失（bindingMode=existing 但无 provenance）→ OBSERVATION_PROVENANCE_INVALID', () => {
  const row = validRow();
  delete row.provenance;
  const input = validInput({ observation: observationWith([row]) });
  expectReject(input, 'OBSERVATION_PROVENANCE_INVALID', 'c5a provenance 缺失');
});
test('c5', "c5b provenance 与 bindingMode 不符（existing 配 platform-readback，违 existing→user-confirmed）→ OBSERVATION_PROVENANCE_INVALID", () => {
  const input = validInput({ observation: observationWith([validRow({ bindingMode: 'existing', provenance: 'platform-readback' })]) });
  expectReject(input, 'OBSERVATION_PROVENANCE_INVALID', 'c5b provenance 错配 bindingMode');
});

// ── c6 数量恰好但 kind 越界（词表外 kind）→ 拒 ────────────────────────────────────
test('c6', "c6 数量恰好但 kind='chatflow'（不在 SUPPORTED_ENTITY_KINDS 词表）→ OBSERVATION_KIND_UNSUPPORTED", () => {
  const input = validInput({ observation: observationWith([validRow({ kind: 'chatflow' })]) });
  expectReject(input, 'OBSERVATION_KIND_UNSUPPORTED', 'c6 kind 词表外');
});

// ── c7 合法 agent 观察行 → 仍过（回归保护，agent 保序）────────────────────────────
test('c7', 'c7 合法 agent 观察行（existing/user-confirmed、终端 click 锚定、issuer 合法）→ ok:true（回归保护）', () => {
  expectPass(validInput(), 'c7 合法 agent');
});

// ── c8 孤儿策略原子 agent.removeToolByName（无编译器、无观察通道）→ 不索要 observation → 不误拒 ──
test('c8', 'c8 事件仅含孤儿原子 agent.removeToolByName（观察注册表无此原子）+ observation=null → ok:true（D4 不误拒）', () => {
  const orphanEvents = [
    { stepId: 'rmstep_1', intentId: 'intent_rm', atom: 'agent.removeToolByName', action: 'click', text: 'some-tool' },
  ];
  const orphanBindings = [
    { stepId: 'rmstep_1', intentId: 'intent_rm', atom: 'agent.removeToolByName', sourceIntentId: 'source_rm', candidateId: 'candidate-rm', role: 'subject' },
  ];
  expectPass({ events: orphanEvents, observation: null, bindings: orphanBindings }, 'c8 孤儿原子不索要观察');
});

// ── 收口 ──────────────────────────────────────────────────────────────────────────
if (failures.length) {
  for (const failure of failures) console.error(`RED  entity-identity-spine.admission-registry: ${failure}`);
  console.error(`RED  entity-identity-spine.admission-registry/${SECTION}: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   entity-identity-spine.admission-registry/${SECTION}: ${passed}/${passed} 全过（纯函数 + 纯内存夹具，零 SUT）`);
