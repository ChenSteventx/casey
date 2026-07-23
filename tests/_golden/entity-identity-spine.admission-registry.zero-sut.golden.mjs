#!/usr/bin/env node
// entity-identity-spine（C0）验收金牌：闭集准入注册表（红先行、zero-SUT）。
// 两节：① r0/c1-c11 纯内存夹具 + 目标纯函数 validateObservationAdmission（零浏览器/网络/server/fake-SUT/子进程）；
//       ② e1-e5 端到端接线（codex R1 Critical + R2 Critical 修复的机器证据）——spawn 真 bin/sign.mjs 子进程，证
//          【生产 sign 路径实际调该验证器】：合法 agent 观察实过、fail-open 观察实拒 die(65)。仍零浏览器/网络/server/
//          fake-SUT；子进程仅为跨进程真实执行 sign CLI（本地文件夹具）。若验证器未接线（注释掉 sign 里的调用），
//          e2/e3/e4/e5 会转绿（fail-open 过签）→ 本节转红=咬合证据。
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
// ── codex R2 加固（闭集更深缺陷收口；c9/c10/c11 各注入夹具、e5 端到端；断言只增不减）──────────────────
//   c9  额外非终端行（合法 atstep_3 终端观察 + 锚 fill 步 atstep_1 的额外身份行，两行各逐行合法）
//        → OBSERVATION_ROW_NOT_ANCHORED（Critical：逐行 correlation 过 + 终端角色多重集只数 atstep_3 行 → 额外行 fail-open 混入冻结件）
//   c10 A(agent.searchOpen) issuer 信封夹带增广注册表第二观察原子 B 行（跨原子混装）
//        → OBSERVATION_ISSUER_ATOM_MISMATCH（High：issuer 旧 some 命中 A 即过、单信封承载了非自身 issuer 原子的行）
//   c11 行 bindingMode=created-in-run 但注入注册表 allowedBindingModes 不含它（provenanceByBindingMode 仍登记该 mode，两字段不一致）
//        → OBSERVATION_BINDING_MODE_NOT_ALLOWED（Medium：不靠 provenance 表恰好缺项间接拒，显式读 allowedBindingModes）
//
// ── codex R3 加固（双射全键重构 + 零义务闸 + C2 信封扩展；c12-c16 各注入夹具、e6 端到端；断言只增不减 21→27）──
//   c12 跨 intent 同 stepId 碰撞、只给 A 行 → B 终端义务未满足 → OBSERVATION_ROLE_COUNT_MISMATCH
//        （Critical①：旧键去 intentId 时一行会同时满足 A、B 两终端 → 误接受；全键经 binding.intentId 对齐后封死）
//   c13 跨 intent 同 stepId 碰撞、A/B 各一合法行各锚各自终端 → ok:true
//        （Critical①：旧键去 intentId 时每终端把两行都计数 2≠1 → 误拒；全键计数后过）
//   c14 零义务携带观察（events 无登记终端 click + observation 带行）→ OBSERVATION_UNEXPECTED_WITHOUT_OBLIGATION
//        （Critical②：旧实现 terminals 空即 return OK 跳过逐行+双射，令无义务事件流任意观察行冻结进签署件）
//   c15 多原子可扩展：增广注册表 agent+workflow 两观察原子 + 各自独立信封（信封列表）各锚各自终端 → ok:true
//        （High：C2 仅靠加注册表数据 + 追加独立信封即工作；单信封=单元素列表、agent 单原子路径字节等价）
//   c16 多原子可扩展：agent issuer 信封夹带 workflow 行（跨原子混装）→ OBSERVATION_ISSUER_ATOM_MISMATCH（单信封单原子）
//
// ── codex R4 加固（可证双向函数双射 + 整体输入 fail-closed + 规范信封 + 拒重复终端；c17-c26 + e7；断言只增不减 27→38）──
//   c17 双向函数[Critical]：两终端同 stepId 异 intentId、两 binding 仅 intentId 异、单观察行 → 一行同时锚 A/B 两终端
//        → OBSERVATION_ROW_ANCHORS_MULTIPLE_TERMINALS（旧实现 rowAnchorsTerminal 只查「存在」匹配 binding=非函数，误 OK）
//   c18 整体输入 fail-closed[High]：零义务 events=[] + 邪恶 source 空信封 {kind:'evil',atom:'evil'} → OBSERVATION_ISSUER_NOT_ALLOWED
//        （旧实现零义务只查 allRows.length，邪恶空信封 allRows=0 即早退 OK、跳过 issuer/结构校验）
//   c19 整体输入 fail-closed[High]：零义务 events=[] + 合法 issuer 空信封（无对应终端）→ OBSERVATION_UNEXPECTED_WITHOUT_OBLIGATION
//        （零义务时任何信封在场即拒，非仅有行；须义务一一对应）
//   c20 整体输入 fail-closed[High]：非数组 observations（observations:'not-array'）→ OBSERVATION_ENVELOPE_MALFORMED
//   c21 整体输入 fail-closed[High]：真值但非对象/数组的 observation（字符串）→ OBSERVATION_ENVELOPE_MALFORMED
//   c22 整体输入 fail-closed[High]：信封列表含畸形元素（[null]）→ OBSERVATION_ENVELOPE_MALFORMED
//   c23 规范信封[High]：两信封同 source.atom=agent.searchOpen（把角色拆到多个同原子信封蒙混）→ OBSERVATION_DUPLICATE_ATOM_ENVELOPE
//   c24 规范信封[High]：增广注册表 agent+workflow、events 仅 agent 终端、却带 workflow 孤儿信封（原子无对应终端）
//        → OBSERVATION_UNEXPECTED_WITHOUT_OBLIGATION
//   c25 拒重复终端[High]：两完全相同 click 三元组 {intentId,stepId,atom} + 两合法行 → OBSERVATION_DUPLICATE_TERMINAL
//        （旧实现 seenTerminal 折叠成一义务、令一行满足多事件；不去重）
//   c26 规范信封[High]：增广双原子、双终端、agent 信封满足 agent、workflow 信封空（合法 issuer 空信封）
//        → OBSERVATION_ROLE_COUNT_MISMATCH（终端义务须与信封行一一对应，空信封令 workflow 终端 0 行）
//   e7  端到端[Critical]：双 intent 同 stepId + 两 binding 仅 intentId 异 + 单观察行 → 真 sign 实拒 exit 65
//        （行锚多终端非函数反例经生产 sign 路径复现；退 >1 拒则一行误满足两终端 fail-open 过签）
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
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildEntityBindingsDraft, hashIdentityAdmissionBytes } from '../../lib/entity-semantic-lock-preflight.mjs';
import { createEntityLockReceipt } from '../../lib/entity-semantic-lock.mjs';

const SECTION = process.argv[2] ?? 'all';
const SECTIONS = new Set(['all', 'r0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11', 'c12', 'c13', 'c14', 'c15', 'c16',
  'c17', 'c18', 'c19', 'c20', 'c21', 'c22', 'c23', 'c24', 'c25', 'c26', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7']);
if (!SECTIONS.has(SECTION)) process.exit(2);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
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
  // codex R2 加固新增（闭集更深缺陷收口）：
  'OBSERVATION_ROW_NOT_ANCHORED',       // 全局双射：额外非终端行未被任何终端 click 消费（Critical）
  'OBSERVATION_ISSUER_ATOM_MISMATCH',   // 单信封单原子：信封夹带非自身 issuer 原子的行（High）
  'OBSERVATION_BINDING_MODE_NOT_ALLOWED', // 显式允许集：bindingMode 越 allowedBindingModes（Medium）
  // codex R3 加固新增（双射全键重构 + 零义务闸）：
  'OBSERVATION_UNEXPECTED_WITHOUT_OBLIGATION', // 零义务闸/孤儿信封：无对应终端义务却携观察信封/行（Critical）
  // codex R4 加固新增（可证双向函数双射 + 整体输入 fail-closed + 规范信封 + 拒重复终端）：
  'OBSERVATION_ROW_ANCHORS_MULTIPLE_TERMINALS', // 双向函数：一行同时锚 >1 终端（两 binding 仅 intentId 异）（Critical）
  'OBSERVATION_ENVELOPE_MALFORMED',             // 整体输入 fail-closed：畸形信封/非数组 observations/非对象 observation（High）
  'OBSERVATION_DUPLICATE_ATOM_ENVELOPE',        // 规范信封：同原子二次信封（把多角色拆到多同原子信封蒙混）（High）
  'OBSERVATION_DUPLICATE_TERMINAL',             // 拒重复终端：完全相同 click 三元组重复（不去重）（High）
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

// ── c9 全局双射（codex R2-Critical 反例逐字复现）：合法终端观察 + 一条锚 fill 步的额外身份行 → 拒 ──────
// 两行各自逐行合法（kind=agent、五元 join 各命中同一 subject binding、issuer/provenance 合法）；额外行唯一越界=
// 锚非终端步 atstep_1（fill）。旧实现逐行 correlation 只证「行能 join 到任一 binding」、终端角色多重集又只统计锚到
// atstep_3 的行 → 额外身份行两关都过、fail-open 混进冻结件。全局双射闸：每行必锚某终端 click 的 {stepId, atom}。
test('c9', 'c9 额外非终端行（合法 atstep_3 终端观察 + 锚 fill 步 atstep_1 的额外身份行）→ OBSERVATION_ROW_NOT_ANCHORED', () => {
  const input = validInput({ observation: observationWith([validRow(), validRow({ evidenceStepId: 'atstep_1' })]) });
  expectReject(input, 'OBSERVATION_ROW_NOT_ANCHORED', 'c9 额外非终端行');
});

// ── c10 单信封单原子（codex R2-High）：A issuer 信封夹带增广注册表第二观察原子 B 行（跨原子混装）→ 拒 ────
// 增广注册表注册第二观察原子 B；A(agent.searchOpen) issuer 信封同载 A 行 + B 行。旧 issuer 用 some——命中 A 即过，
// B 行再逐行合法 → 跨原子混装混入。单信封单原子闸凭 row.atom!==issuerAtom(A) 拒 B 行；C2 多原子须各自独立信封。
test('c10', 'c10 A issuer 信封夹带第二观察原子 B 行（增广注册表跨原子混装）→ OBSERVATION_ISSUER_ATOM_MISMATCH', () => {
  const B_ATOM = 'agent.searchOpen2';
  const augmented = new Map(ENTITY_OBSERVATION_REGISTRY);
  augmented.set(B_ATOM, {
    boundKind: 'agent', requiredRoles: ['subject'],
    issuer: { sourceKind: 'compile-envelope', atom: B_ATOM },
    allowedBindingModes: ['existing', 'created-in-run'],
    provenanceByBindingMode: { existing: 'user-confirmed', 'created-in-run': 'platform-readback' },
  });
  const input = {
    events: EVENTS.map((e) => ({ ...e })),
    observation: {
      source: { kind: 'compile-envelope', atom: 'agent.searchOpen' },
      observations: [validRow(), validRow({ atom: B_ATOM })],
    },
    bindings: BINDINGS.map((b) => ({ ...b })),
    registry: augmented,
  };
  expectReject(input, 'OBSERVATION_ISSUER_ATOM_MISMATCH', 'c10 跨原子混装');
});

// ── c11 显式允许集（codex R2-Medium）：bindingMode 越注入注册表 allowedBindingModes（provenance 表仍登记）→ 拒 ─
// 注入 allowedBindingModes=['existing']（不含 created-in-run）但 provenanceByBindingMode 仍登记 created-in-run 的
// 不一致注册表；行 bindingMode=created-in-run 且 provenance=platform-readback（与 provenance 表相符）。旧实现只因
// provenanceByBindingMode 恰好含该 mode 就放行——本行会 fail-open 过。显式读 allowedBindingModes 后 fail-closed 拒。
test('c11', 'c11 bindingMode=created-in-run 但注入注册表 allowedBindingModes 不含它（provenance 表仍登记）→ OBSERVATION_BINDING_MODE_NOT_ALLOWED', () => {
  const restricted = new Map([
    ['agent.searchOpen', {
      boundKind: 'agent', requiredRoles: ['subject'],
      issuer: { sourceKind: 'compile-envelope', atom: 'agent.searchOpen' },
      allowedBindingModes: ['existing'],
      provenanceByBindingMode: { existing: 'user-confirmed', 'created-in-run': 'platform-readback' },
    }],
  ]);
  const input = {
    events: EVENTS.map((e) => ({ ...e })),
    observation: observationWith([validRow({ bindingMode: 'created-in-run', provenance: 'platform-readback' })]),
    bindings: BINDINGS.map((b) => ({ ...b })),
    registry: restricted,
  };
  expectReject(input, 'OBSERVATION_BINDING_MODE_NOT_ALLOWED', 'c11 bindingMode 越允许集');
});

// ── codex R3 加固（双射全键重构 + 零义务闸 + C2 信封扩展；c12-c16 各注入夹具、e6 端到端；断言只增不减）──
// R3 前两轮双射修复不完整：终端锚/角色计数只用 {stepId,atom} 丢 intentId，跨 intent 复用同 stepId 时双射失真；
// 零登记终端却携观察行时提前 return OK 跳过全部校验。本节逐字复现两 Critical 反例 + C2 多原子可扩展正/反例。

// ── c12/c13 跨 intent 同 stepId 碰撞（codex R3-Critical① 双射全键）───────────────────────────────
// 两 intent（intent_A / intent_B）复用同一 stepId 'shared_click' 各 click agent.searchOpen；各自 binding 用不同
// sourceIntentId/candidateId 区分。全键双射经 binding.intentId 对齐：一行只满足它 binding 所属 intent 的终端。
const COLLIDE_EVENTS = [
  { stepId: 'shared_click', intentId: 'intent_A', atom: 'agent.searchOpen', action: 'click', text: 'A' },
  { stepId: 'shared_click', intentId: 'intent_B', atom: 'agent.searchOpen', action: 'click', text: 'B' },
];
const COLLIDE_BINDINGS = [
  { stepId: 'shared_click', intentId: 'intent_A', atom: 'agent.searchOpen', sourceIntentId: 'source_A', candidateId: 'candidate-A', role: 'subject' },
  { stepId: 'shared_click', intentId: 'intent_B', atom: 'agent.searchOpen', sourceIntentId: 'source_B', candidateId: 'candidate-B', role: 'subject' },
];
const collideRow = (over) => validRow({ evidenceStepId: 'shared_click', ...over });
const rowForA = collideRow({ sourceIntentId: 'source_A', candidateId: 'candidate-A' });
const rowForB = collideRow({ sourceIntentId: 'source_B', candidateId: 'candidate-B' });

// c12 误接受封死：只给 A 行 → B 终端义务未满足 → 拒（旧键去 intentId 时一行会同时满足 A、B 两终端 → 误接受）。
test('c12', 'c12 跨 intent 同 stepId：只给 A 行、B 终端义务未满足 → OBSERVATION_ROLE_COUNT_MISMATCH（去 intentId 则一行误满足两终端）', () => {
  const input = {
    events: COLLIDE_EVENTS.map((e) => ({ ...e })),
    observation: observationWith([rowForA]),
    bindings: COLLIDE_BINDINGS.map((b) => ({ ...b })),
  };
  expectReject(input, 'OBSERVATION_ROLE_COUNT_MISMATCH', 'c12 一行不满足另一 intent 终端');
});

// c13 误拒封死：A、B 各一行（各锚各自 intent 的终端）→ 过（旧键去 intentId 时每终端把两行都数进 → 基数 2≠1 误拒）。
test('c13', 'c13 跨 intent 同 stepId：A、B 各一合法行、各锚各自 intent 终端 → ok:true（去 intentId 则每终端重复计数 2≠1 误拒）', () => {
  const input = {
    events: COLLIDE_EVENTS.map((e) => ({ ...e })),
    observation: observationWith([rowForA, rowForB]),
    bindings: COLLIDE_BINDINGS.map((b) => ({ ...b })),
  };
  expectPass(input, 'c13 两合法行不被误拒');
});

// ── c14 零义务携带观察（codex R3-Critical②）：events 无登记终端 click + observation 带行 → 拒 ─────────────
// 事件仅含未登记原子 nav.agentManagement 的 click（不产观察义务）；observation 却带 1 合法形态行。旧实现
// terminals 空即 return OK、跳过逐行+双射，令无义务事件流的任意观察行冻结进签署件——本闸 fail-closed 拒。
test('c14', 'c14 零义务携带观察（events 无登记终端 click + observation 带 1 行）→ OBSERVATION_UNEXPECTED_WITHOUT_OBLIGATION', () => {
  const noTerminalEvents = [
    { stepId: 'nz_1', intentId: 'intent_nz', atom: 'nav.agentManagement', action: 'click', text: 'agent 管理' },
  ];
  const input = {
    events: noTerminalEvents,
    observation: observationWith([validRow()]),
    bindings: BINDINGS.map((b) => ({ ...b })),
  };
  expectReject(input, 'OBSERVATION_UNEXPECTED_WITHOUT_OBLIGATION', 'c14 零义务携带观察');
});

// ── c15/c16 多原子可扩展（codex R3-High C2）：增广注册表登记 agent + workflow 两观察原子 + 各自独立信封 ────
// 验证器接受「单原子信封列表」；C2 加 workflow 仅需在注册表加数据 + 追加一个 workflow 独立信封。
const W_ATOM = 'workflow.bindAgent';
function augmentedTwoAtomRegistry() {
  const augmented = new Map(ENTITY_OBSERVATION_REGISTRY);
  augmented.set(W_ATOM, {
    boundKind: 'workflow', requiredRoles: ['subject'],
    issuer: { sourceKind: 'compile-envelope', atom: W_ATOM },
    allowedBindingModes: ['existing', 'created-in-run'],
    provenanceByBindingMode: { existing: 'user-confirmed', 'created-in-run': 'platform-readback' },
  });
  return augmented;
}
const TWO_ATOM_EVENTS = [
  ...EVENTS.map((e) => ({ ...e })),
  { stepId: 'wfstep_1', intentId: 'intent_2', atom: W_ATOM, action: 'fill', value: 'wf' },
  { stepId: 'wfstep_3', intentId: 'intent_2', atom: W_ATOM, action: 'click', text: 'wf' },
];
const TWO_ATOM_BINDINGS = [
  ...BINDINGS.map((b) => ({ ...b })),
  { stepId: 'wfstep_3', intentId: 'intent_2', atom: W_ATOM, sourceIntentId: 'source_2', candidateId: 'candidate-wf', role: 'subject' },
];
const wfRow = () => ({
  kind: 'workflow', name: 'wf-main', code: 'znt_atl_wf', platformId: '9876543210987654321',
  sourceIntentId: 'source_2', candidateId: 'candidate-wf', role: 'subject',
  atom: W_ATOM, evidenceStepId: 'wfstep_3', sourcePath: '/ai-manager/process/setup/queryProcessPageList',
  bindingMode: 'existing', provenance: 'user-confirmed',
});
const agentEnvelope = (rows) => ({ source: { kind: 'compile-envelope', atom: 'agent.searchOpen' }, observations: rows });
const wfEnvelope = (rows) => ({ source: { kind: 'compile-envelope', atom: W_ATOM }, observations: rows });

// c15 合法双原子：agent 独立信封 + workflow 独立信封（信封列表）→ 过（C2 仅靠加数据+加信封即工作）。
test('c15', 'c15 多原子可扩展：增广注册表 agent+workflow、两独立信封列表各锚各自终端 → ok:true（C2 仅加数据+加信封）', () => {
  const input = {
    events: TWO_ATOM_EVENTS.map((e) => ({ ...e })),
    observation: [agentEnvelope([validRow()]), wfEnvelope([wfRow()])],
    bindings: TWO_ATOM_BINDINGS.map((b) => ({ ...b })),
    registry: augmentedTwoAtomRegistry(),
  };
  expectPass(input, 'c15 合法双原子独立信封');
});

// c16 A 信封夹 B 行：agent issuer 信封同载 agent 行 + workflow 行（跨原子混装）→ 拒（单信封单原子）。
test('c16', 'c16 多原子可扩展：agent 信封夹带 workflow 行（跨原子混装）→ OBSERVATION_ISSUER_ATOM_MISMATCH', () => {
  const input = {
    events: TWO_ATOM_EVENTS.map((e) => ({ ...e })),
    observation: [agentEnvelope([validRow(), wfRow()])],
    bindings: TWO_ATOM_BINDINGS.map((b) => ({ ...b })),
    registry: augmentedTwoAtomRegistry(),
  };
  expectReject(input, 'OBSERVATION_ISSUER_ATOM_MISMATCH', 'c16 agent 信封夹 workflow 行');
});

// ── codex R4 加固（可证双向函数双射 + 整体输入 fail-closed + 规范信封 + 拒重复终端；c17-c26 各注入夹具）──
// R4 进入最大对抗视角：双射须是双向函数（每行恰 1 终端、每终端恰 requiredRoles 行），整体 observation 输入进入配对
// 前须过结构+issuer fail-closed 闸，信封须规范形式（每原子恰一信封、无孤儿信封），重复终端三元组不去重而拒。

// ── c17 双向函数（codex R4-Critical①）：两 binding 仅 intentId 异、一行同锚两终端 → 拒 ──────────────
// 两终端同 stepId 'dup_click' 异 intentId（intent_X/intent_Y）各 click agent.searchOpen；两 binding 除 intentId 全同
// （{stepId,atom,sourceIntentId,candidateId,role} 同）。单观察行的 {sourceIntentId,candidateId,role} 同时命中两 binding
// → 一行同时锚 X、Y 两终端。旧 rowAnchorsTerminal 只查「存在」匹配 binding：step5 过、step6 两终端各得 [subject] → 误 OK。
// 修后：每行恰锚 1 终端，>1 拒 OBSERVATION_ROW_ANCHORS_MULTIPLE_TERMINALS（双射是双向函数、非关系）。
const DUP_BINDING_EVENTS = [
  { stepId: 'dup_click', intentId: 'intent_X', atom: 'agent.searchOpen', action: 'click', text: 'X' },
  { stepId: 'dup_click', intentId: 'intent_Y', atom: 'agent.searchOpen', action: 'click', text: 'Y' },
];
// 两 binding 除 intentId 外全同（sourceIntentId/candidateId/role 一致）——这正是行锚多终端的攻击面。
const DUP_BINDINGS = ['intent_X', 'intent_Y'].map((intentId) => ({
  stepId: 'dup_click', intentId, atom: 'agent.searchOpen',
  sourceIntentId: 'source_shared', candidateId: 'candidate-shared', role: 'subject',
}));
test('c17', 'c17 双向函数：两 binding 仅 intentId 异、单行同锚 X/Y 两终端 → OBSERVATION_ROW_ANCHORS_MULTIPLE_TERMINALS（旧只查存在=非函数误 OK）', () => {
  const input = {
    events: DUP_BINDING_EVENTS.map((e) => ({ ...e })),
    observation: observationWith([validRow({ evidenceStepId: 'dup_click', sourceIntentId: 'source_shared', candidateId: 'candidate-shared' })]),
    bindings: DUP_BINDINGS.map((b) => ({ ...b })),
  };
  expectReject(input, 'OBSERVATION_ROW_ANCHORS_MULTIPLE_TERMINALS', 'c17 一行锚多终端');
});

// ── c18-c22 整体输入 fail-closed（codex R4-High②）：不论义务多少先过结构+issuer 闸 ──────────────────
// c18 零义务 + 邪恶 source 空信封 → issuer 闸拒（旧实现零义务只查 allRows.length，邪恶空信封 allRows=0 即早退 OK）。
test('c18', "c18 整体 fail-closed：零义务 events=[] + 邪恶 source 空信封 {kind:'evil',atom:'evil'} → OBSERVATION_ISSUER_NOT_ALLOWED（旧实现邪恶空信封早退过关）", () => {
  const input = { events: [], observation: { source: { kind: 'evil', atom: 'evil' }, observations: [] }, bindings: [] };
  expectReject(input, 'OBSERVATION_ISSUER_NOT_ALLOWED', 'c18 零义务邪恶空信封');
});
// c19 零义务 + 合法 issuer 空信封（无对应终端）→ 孤儿信封拒（零义务时任何信封在场即拒，非仅有行）。
test('c19', 'c19 整体 fail-closed：零义务 events=[] + 合法 issuer 空信封（无对应终端）→ OBSERVATION_UNEXPECTED_WITHOUT_OBLIGATION（零义务时任何信封在场即拒）', () => {
  const input = { events: [], observation: { source: { kind: 'compile-envelope', atom: 'agent.searchOpen' }, observations: [] }, bindings: [] };
  expectReject(input, 'OBSERVATION_UNEXPECTED_WITHOUT_OBLIGATION', 'c19 零义务合法空信封');
});
// c20 非数组 observations → 结构闸拒。
test('c20', "c20 整体 fail-closed：非数组 observations（observations:'not-array'）→ OBSERVATION_ENVELOPE_MALFORMED", () => {
  const input = validInput({ observation: { source: { kind: 'compile-envelope', atom: 'agent.searchOpen' }, observations: 'not-array' } });
  expectReject(input, 'OBSERVATION_ENVELOPE_MALFORMED', 'c20 非数组 observations');
});
// c21 真值但非对象/数组的 observation（字符串）→ 结构闸拒（旧实现静默吞成空信封）。
test('c21', 'c21 整体 fail-closed：真值但非对象/数组 observation（字符串）→ OBSERVATION_ENVELOPE_MALFORMED（旧实现静默吞成空信封）', () => {
  const input = validInput({ observation: 'evil-string' });
  expectReject(input, 'OBSERVATION_ENVELOPE_MALFORMED', 'c21 非对象 observation');
});
// c22 信封列表含畸形元素（[null]）→ 结构闸拒。
test('c22', 'c22 整体 fail-closed：信封列表含畸形元素（[null]）→ OBSERVATION_ENVELOPE_MALFORMED', () => {
  const input = validInput({ observation: [null] });
  expectReject(input, 'OBSERVATION_ENVELOPE_MALFORMED', 'c22 信封列表畸形元素');
});

// ── c23-c24, c26 规范信封（codex R4-High③）：每原子恰一信封、每信封原子须有对应终端义务 ──────────────
// c23 两信封同 source.atom（把角色拆到多个同原子信封经全局并集蒙混）→ 重复原子信封拒。
test('c23', 'c23 规范信封：两信封同 source.atom=agent.searchOpen（角色拆多同原子信封蒙混）→ OBSERVATION_DUPLICATE_ATOM_ENVELOPE', () => {
  const input = {
    events: EVENTS.map((e) => ({ ...e })),
    observation: [observationWith([validRow()]), observationWith([validRow()])],
    bindings: BINDINGS.map((b) => ({ ...b })),
  };
  expectReject(input, 'OBSERVATION_DUPLICATE_ATOM_ENVELOPE', 'c23 重复原子信封');
});
// c24 增广双原子注册表、events 仅 agent 终端、却带 workflow 孤儿信封（原子无对应终端）→ 孤儿信封拒。
test('c24', 'c24 规范信封：增广 agent+workflow、events 仅 agent 终端、带 workflow 孤儿信封（原子无对应终端）→ OBSERVATION_UNEXPECTED_WITHOUT_OBLIGATION', () => {
  const input = {
    events: EVENTS.map((e) => ({ ...e })),                 // 仅 agent.searchOpen 终端；无 workflow 终端
    observation: [agentEnvelope([validRow()]), wfEnvelope([wfRow()])],
    bindings: TWO_ATOM_BINDINGS.map((b) => ({ ...b })),
    registry: augmentedTwoAtomRegistry(),
  };
  expectReject(input, 'OBSERVATION_UNEXPECTED_WITHOUT_OBLIGATION', 'c24 workflow 孤儿信封');
});

// ── c25 拒重复终端（codex R4-High④）：两完全相同 click 三元组 → 拒（不去重）──────────────────────────
// 两事件 {intentId,stepId,atom} 完全相同（同 intent_1/atstep_3/agent.searchOpen）；旧 seenTerminal 折叠成一义务、
// 令一行满足多事件。修后重复三元组即拒 OBSERVATION_DUPLICATE_TERMINAL（agent 正常事件 stepId 唯一，拒重复安全）。
test('c25', 'c25 拒重复终端：两完全相同 click 三元组 {intent_1,atstep_3,agent.searchOpen} + 两合法行 → OBSERVATION_DUPLICATE_TERMINAL（不去重）', () => {
  const dupTerminalEvents = [
    { stepId: 'atstep_3', intentId: 'intent_1', atom: 'agent.searchOpen', action: 'click', text: AGENT_NAME },
    { stepId: 'atstep_3', intentId: 'intent_1', atom: 'agent.searchOpen', action: 'click', text: AGENT_NAME },
  ];
  const input = {
    events: dupTerminalEvents,
    observation: observationWith([validRow(), validRow()]),
    bindings: BINDINGS.map((b) => ({ ...b })),
  };
  expectReject(input, 'OBSERVATION_DUPLICATE_TERMINAL', 'c25 重复终端三元组');
});

// ── c26 规范信封：合法 issuer 空信封须与义务一一对应（codex R4-High③）──────────────────────────────
// 增广双原子、双终端（agent + workflow）；agent 信封满足 agent 终端，workflow 信封空（合法 issuer、observations:[]）。
// workflow 终端义务无行覆盖 → 双射反向计数 0≠requiredRoles(1) → OBSERVATION_ROLE_COUNT_MISMATCH（空信封不豁免义务）。
test('c26', 'c26 规范信封：双终端、agent 信封满足、workflow 合法 issuer 空信封 → OBSERVATION_ROLE_COUNT_MISMATCH（空信封不豁免终端义务）', () => {
  const input = {
    events: TWO_ATOM_EVENTS.map((e) => ({ ...e })),
    observation: [agentEnvelope([validRow()]), wfEnvelope([])],
    bindings: TWO_ATOM_BINDINGS.map((b) => ({ ...b })),
    registry: augmentedTwoAtomRegistry(),
  };
  expectReject(input, 'OBSERVATION_ROLE_COUNT_MISMATCH', 'c26 workflow 空信封欠义务');
});

// ── 端到端接线断言（e1-e7）：spawn 真 bin/sign.mjs 证生产路径实调验证器 ─────────────────────
// 上面 16 条只验孤立纯函数；codex R1 逮住「验证器未接线=假绿」——生产 sign 路径若不调它、金牌绿也无意义。
// 这几条构造真 v2 签署夹具（本地文件、零 SUT）喂真 sign CLI：合法 agent 实过、fail-open 实拒。
const SIGN = resolve(ROOT, 'bin', 'sign.mjs');
const E2E_SCRATCH = resolve(ROOT, '.golden-scratch-entity-identity-spine-e2e');
const E2E_SIGNED_AT = '2026-07-23T08:00:00.000Z';
const E2E_BUILD = 'eis-e2e-build';
const jt = (v) => JSON.stringify(v, null, 2) + '\n';
// identityProfileDigest 规范化（同 sign-observation 金牌口径：递归按键排序 sha256）。
const E2E_LIST_API = {
  pathname: '/api/agents/query', method: 'GET',
  recordsPath: 'data.records', totalPath: 'data.total', hasNextPath: null,
  fields: { id: 'agentId', code: 'agentCode', name: 'agentName' },
};
const e2eCanonical = (v) => (Array.isArray(v) ? v.map(e2eCanonical)
  : (v !== null && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, e2eCanonical(v[k])])) : v));
const E2E_PROFILE_DIGEST = 'sha256:' + createHash('sha256').update(JSON.stringify(e2eCanonical(E2E_LIST_API))).digest('hex');

// 观察行（真机形态；不带 bindingMode/provenance——那是绑定属性、sign 侧按五元组从确认收据富化）。
function e2eRow(over = {}) {
  return {
    kind: 'agent', name: AGENT_NAME, code: AGENT_CODE, platformId: AGENT_PLATFORM_ID,
    sourceIntentId: 'source_1', candidateId: 'candidate-agent-main', role: 'subject',
    atom: 'agent.searchOpen', evidenceStepId: 'atstep_3', sourcePath: SOURCE_PATH, ...over,
  };
}
// eventsSpec 可选覆盖事件流 + provenance 步集（默认 fill/press/click atstep_1..3 三步、终端 click=atstep_3）。
// e6 零义务用之构造「仅 fill/press、无终端 click」的事件流（buildEntityBindingsDraft 要求 provenance 与事件三元组集恰一致）。
const DEFAULT_E2E_EVENTS = [
  { stepId: 'atstep_1', intentId: 'intent_1', atom: 'agent.searchOpen', action: 'fill', value: AGENT_NAME },
  { stepId: 'atstep_2', intentId: 'intent_1', atom: 'agent.searchOpen', action: 'press', key: 'Enter' },
  { stepId: 'atstep_3', intentId: 'intent_1', atom: 'agent.searchOpen', action: 'click', text: AGENT_NAME },
];
const DEFAULT_E2E_STEPS = ['atstep_1', 'atstep_2', 'atstep_3'];
function prepareE2ECase(caseId, { observations, sourceOverride = null, receiptOverride = {}, eventsSpec = null } = {}) {
  const dir = resolve(E2E_SCRATCH, caseId);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const eventsDoc = {
    schemaVersion: 2, channel: 'web', caseId, url: '{{baseUrl}}/agent/list',
    recordedAt: E2E_SIGNED_AT, compiledBy: 'eis-e2e', authored: false,
    events: (eventsSpec?.events || DEFAULT_E2E_EVENTS).map((e) => ({ ...e })),
  };
  const eventsText = jt(eventsDoc);
  const eventsSha256 = hashIdentityAdmissionBytes(Buffer.from(eventsText));
  // provenanceRows：显式给整行（e7 双 intent 同 stepId 需按行指定 intentId）；否则按 provenanceSteps 生成单 intent 行。
  const provenance = eventsSpec?.provenanceRows
    ? eventsSpec.provenanceRows.map((r) => ({ ...r }))
    : (eventsSpec?.provenanceSteps || DEFAULT_E2E_STEPS).map((stepId) => ({
      stepId, intentId: 'intent_1', atom: 'agent.searchOpen',
      sourceIntentId: 'source_1', candidateId: 'candidate-agent-main', role: 'subject',
    }));
  const draftResult = buildEntityBindingsDraft({ eventsBytes: Buffer.from(eventsText), eventsDocument: eventsDoc, provenance });
  assert(draftResult.ok === true, `e2e 夹具自身红：buildEntityBindingsDraft ${draftResult.reason}`);
  const receipt = createEntityLockReceipt({
    lockId: 'lock-agent-main', kind: 'agent', bindingMode: 'existing', scopeFingerprint: 'sha256:scope-agent',
    expected: { name: AGENT_NAME, code: AGENT_CODE },
    observed: { name: AGENT_NAME, code: AGENT_CODE, platformId: AGENT_PLATFORM_ID },
    source: 'user-confirmed', ...receiptOverride,
  });
  const observation = {
    schemaVersion: 1, artifactKind: 'compile-identity-observation', caseId,
    capturedAgainstBuild: E2E_BUILD, identityProfileDigest: E2E_PROFILE_DIGEST, eventsSha256,
    source: sourceOverride || { kind: 'compile-envelope', atom: 'agent.searchOpen', signed: false, replayReady: false },
    observations,
  };
  const observationText = jt(observation);
  const draft = {
    ...draftResult.draft, schemaVersion: 2, identityProfileDigest: E2E_PROFILE_DIGEST,
    identityObservationsSha256: hashIdentityAdmissionBytes(Buffer.from(observationText)),
  };
  const p = (n) => resolve(dir, n);
  writeFileSync(p('expected.draft.json'), jt({ caseId, intents: [{ intentId: 'intent_1', expected: [{ kind: 'textVisible', op: 'appears', value: 'ready' }] }], pending: [] }));
  writeFileSync(p('events.json'), eventsText);
  writeFileSync(p('entity-bindings.draft.json'), jt(draft));
  writeFileSync(p('entity-confirmations.json'), jt({ caseId, confirmations: provenance.map((r) => ({ ...r, receipt })) }));
  writeFileSync(p('identity-observations.compile.json'), observationText);
  const prdPath = resolve(ROOT, 'loop', `prd-${caseId}.json`);
  rmSync(prdPath, { force: true });
  writeFileSync(prdPath, jt({ schemaVersion: 1, caseId, task: 'eis e2e wiring golden（金牌自清理）', testChecksums: {}, stories: [] }), { flag: 'wx' });
  return {
    caseId, dir, prdPath, draft: p('expected.draft.json'), events: p('events.json'),
    bindings: p('entity-bindings.draft.json'), confirmations: p('entity-confirmations.json'),
    observations: p('identity-observations.compile.json'), frozen: p('expected.frozen.json'), locks: p('entity-locks.frozen.json'),
  };
}
function runE2ESign(fx) {
  return spawnSync(process.execPath, [SIGN, fx.caseId,
    '--draft', fx.draft, '--prd', fx.prdPath, '--frozen-out', fx.frozen,
    '--signer', 'golden-human', '--against-build', E2E_BUILD, '--signed-at', E2E_SIGNED_AT,
    '--events', fx.events, '--entity-bindings-draft', fx.bindings, '--entity-confirmations', fx.confirmations,
    '--entity-locks-out', fx.locks, '--audience', 'test', '--entity-observations', fx.observations],
  { cwd: ROOT, encoding: 'utf8', timeout: 300000 });
}
function cleanupE2E(caseId) {
  rmSync(resolve(E2E_SCRATCH, caseId), { recursive: true, force: true });
  rmSync(resolve(ROOT, 'loop', `prd-${caseId}.json`), { force: true });
}

test('e1', 'e1 端到端：合法 agent v2 观察 → 真 sign 实过 exit 0 且产 v2 冻结锁（接线后合法 agent 逐语义等价）', () => {
  const caseId = 'tc_eis_e2e_happy';
  try {
    cleanupE2E(caseId);
    const fx = prepareE2ECase(caseId, { observations: [e2eRow()] });
    const r = runE2ESign(fx);
    assert(r.status === 0, `合法 agent v2 应 sign exit 0；实得 ${r.status}；stderr=${String(r.stderr || '').trim().slice(0, 200)}`);
    const frozen = JSON.parse(readFileSync(fx.locks, 'utf8'));
    assert(frozen.schemaVersion === 2 && Array.isArray(frozen.identityObservations) && frozen.identityObservations.length === 1,
      `合法 agent 应产 v2 冻结锁含 1 观察行；实得 ${brief(frozen.identityObservations)}`);
  } finally { cleanupE2E(caseId); }
});

test('e2', 'e2 端到端 fail-open：同终端 click 双观察行（角色基数越界）→ 真 sign 实拒 exit 65（验证器专属：注释验证器则转绿→本节红）', () => {
  const caseId = 'tc_eis_e2e_rolecount';
  try {
    cleanupE2E(caseId);
    const fx = prepareE2ECase(caseId, { observations: [e2eRow(), e2eRow()] });
    const r = runE2ESign(fx);
    assert(r.status === 65, `双观察行应 sign exit 65；实得 ${r.status}（验证器未接线时 fail-open 过签）；stderr=${String(r.stderr || '').trim().slice(0, 200)}`);
    assert(!existsSync(fx.locks), 'fail-open 拒签后不得留 entity-locks 冻结件');
  } finally { cleanupE2E(caseId); }
});

test('e3', 'e3 端到端 fail-open：观察件 source.atom 跨原子（nav.agentManagement，非治域 issuer）→ 真 sign 实拒 exit 65（验证器专属）', () => {
  const caseId = 'tc_eis_e2e_issuer';
  try {
    cleanupE2E(caseId);
    const fx = prepareE2ECase(caseId, {
      observations: [e2eRow()],
      sourceOverride: { kind: 'compile-envelope', atom: 'nav.agentManagement', signed: false, replayReady: false },
    });
    const r = runE2ESign(fx);
    assert(r.status === 65, `跨原子 issuer 应 sign exit 65；实得 ${r.status}；stderr=${String(r.stderr || '').trim().slice(0, 200)}`);
    assert(!existsSync(fx.locks), 'fail-open 拒签后不得留 entity-locks 冻结件');
  } finally { cleanupE2E(caseId); }
});

test('e4', 'e4 端到端 fail-open：收据 bindingMode=successor（收据自洽但越注册表 agent.searchOpen 允许集）→ 真 sign 实拒 exit 65（验证器专属：freeze 收下 successor，唯验证器凭 provenanceByBindingMode 拒）', () => {
  const caseId = 'tc_eis_e2e_successor';
  try {
    cleanupE2E(caseId);
    const fx = prepareE2ECase(caseId, {
      observations: [e2eRow()],
      receiptOverride: { bindingMode: 'successor', source: 'platform-readback' },
    });
    const r = runE2ESign(fx);
    assert(r.status === 65, `successor bindingMode 应 sign exit 65；实得 ${r.status}；stderr=${String(r.stderr || '').trim().slice(0, 200)}`);
    assert(!existsSync(fx.locks), 'fail-open 拒签后不得留 entity-locks 冻结件');
  } finally { cleanupE2E(caseId); }
});

test('e5', 'e5 端到端 fail-open：合法终端观察 + 一条锚 fill 步(atstep_1)的额外身份行 → 真 sign 实拒 exit 65（codex R2-Critical 全局双射反例端到端复现：额外非终端行不得混进冻结件）', () => {
  const caseId = 'tc_eis_e2e_extrarow';
  try {
    cleanupE2E(caseId);
    const fx = prepareE2ECase(caseId, { observations: [e2eRow(), e2eRow({ evidenceStepId: 'atstep_1' })] });
    const r = runE2ESign(fx);
    assert(r.status === 65, `额外非终端行应 sign exit 65；实得 ${r.status}（验证器未接全局双射时 fail-open 过签）；stderr=${String(r.stderr || '').trim().slice(0, 200)}`);
    assert(!existsSync(fx.locks), 'fail-open 拒签后不得留 entity-locks 冻结件');
  } finally { cleanupE2E(caseId); }
});

test('e6', 'e6 端到端零义务：events 仅 fill/press 无终端 click + v2 观察带行 → 真 sign 实拒 exit 65（sign 终端锚存在性守卫 fail-closed，零义务不得夹带观察冻结；验证器 OBSERVATION_UNEXPECTED_WITHOUT_OBLIGATION 为直接调用者的纵深防御）', () => {
  const caseId = 'tc_eis_e2e_noobligation';
  try {
    cleanupE2E(caseId);
    const fx = prepareE2ECase(caseId, {
      observations: [e2eRow()],
      eventsSpec: {
        events: [
          { stepId: 'atstep_1', intentId: 'intent_1', atom: 'agent.searchOpen', action: 'fill', value: AGENT_NAME },
          { stepId: 'atstep_2', intentId: 'intent_1', atom: 'agent.searchOpen', action: 'press', key: 'Enter' },
        ],
        provenanceSteps: ['atstep_1', 'atstep_2'],
      },
    });
    const r = runE2ESign(fx);
    assert(r.status === 65, `零义务携观察应 sign exit 65；实得 ${r.status}；stderr=${String(r.stderr || '').trim().slice(0, 200)}`);
    assert(!existsSync(fx.locks), 'fail-closed 拒签后不得留 entity-locks 冻结件');
  } finally { cleanupE2E(caseId); }
});

test('e7', 'e7 端到端双向函数：双 intent 同 stepId + 两 binding 仅 intentId 异 + 单观察行 → 真 sign 实拒 exit 65（codex R4-Critical① 行锚多终端非函数反例经生产 sign 复现；退 >1 拒则一行误满足两终端 fail-open 过签）', () => {
  const caseId = 'tc_eis_e2e_multiterminal';
  try {
    cleanupE2E(caseId);
    const fx = prepareE2ECase(caseId, {
      observations: [e2eRow({ evidenceStepId: 'shared_click' })], // 单行、默认 source_1/candidate-agent-main
      eventsSpec: {
        events: [
          { stepId: 'shared_click', intentId: 'intent_A', atom: 'agent.searchOpen', action: 'click', text: AGENT_NAME },
          { stepId: 'shared_click', intentId: 'intent_B', atom: 'agent.searchOpen', action: 'click', text: AGENT_NAME },
        ],
        // 两 binding 除 intentId 外全同 → 单观察行同时命中两 binding → 同时锚 A/B 两终端（非函数）。
        provenanceRows: ['intent_A', 'intent_B'].map((intentId) => ({
          stepId: 'shared_click', intentId, atom: 'agent.searchOpen',
          sourceIntentId: 'source_1', candidateId: 'candidate-agent-main', role: 'subject',
        })),
      },
    });
    const r = runE2ESign(fx);
    assert(r.status === 65, `行锚多终端应 sign exit 65；实得 ${r.status}（验证器退 >1 拒时一行误满足两终端 fail-open 过签）；stderr=${String(r.stderr || '').trim().slice(0, 200)}`);
    assert(!existsSync(fx.locks), 'fail-closed 拒签后不得留 entity-locks 冻结件');
  } finally { cleanupE2E(caseId); }
});

if (existsSync(E2E_SCRATCH)) { try { rmSync(E2E_SCRATCH, { recursive: true, force: true }); } catch { /* 尽力 */ } }

// ── 收口 ──────────────────────────────────────────────────────────────────────────
if (failures.length) {
  for (const failure of failures) console.error(`RED  entity-identity-spine.admission-registry: ${failure}`);
  console.error(`RED  entity-identity-spine.admission-registry/${SECTION}: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   entity-identity-spine.admission-registry/${SECTION}: ${passed}/${passed} 全过（纯函数 + 纯内存夹具，零 SUT）`);
