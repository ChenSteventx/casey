#!/usr/bin/env node
// entity-workflow-source-readback（C2）验收金牌：workflow 观察准入闭集（红先行、zero-SUT）。
// 纯 node：纯内存夹具 + 一个目标纯函数（零浏览器、零网络、零 server、零 fake SUT、零子进程）。
// 断言纪律：退出码 + deepEqual/具名 rejectCode 钉死；禁标记串 grep（判绿只信退出码，MEMORY 铁律）。
//
// ── C2 目标（母规格 docs/plans/entity-identity-lastmile/plan.md §3/§5、本契约 plan 验收点 1/4、GRILL D2/D3/D5）──
// C0 已把 sign/compile 的「哪个原子产身份观察、绑什么 kind」泛化成按对象种类查的闭集注册表
//   ENTITY_OBSERVATION_REGISTRY（lib/entity-observation-registry.mjs），agent.searchOpen→agent/subject 已注册。
// C0 边界明写「不注册 workflow 观察原子（观察通道泛化=C2）」——C2 往注册表加 workflow 条目（数据驱动、C0 已备形状）：
//   workflow.create / workflow.open → boundKind:'workflow'、requiredRoles:['source']（母规格 point 3「join 到 source
//   binding」）、issuer:{compile-envelope, <该原子>}、provenanceByBindingMode 锚收据内核不变量（existing→user-confirmed、
//   created-in-run→platform-readback，GRILL D5「workflow source existing 走 user-approval、created-in-run 必 platform-readback」）。
// codex Q3 铁律（GRILL D3）：闭集——不能改成「任何 kind:'workflow' 的观察行都接受」。伪造一条 kind 对、但
//   角色/来源/关联/provenance 其一不匹配的 workflow 观察行，必须被具名 rejectCode fail-closed 拒。
//
// ── 红先行判据（本金牌钉的红）──
// 目标模块 lib/entity-observation-registry.mjs 已由 C0 落地并存在——但【尚未注册 workflow 观察原子】。故：
//   · r0 结构断言 has('workflow.create')/has('workflow.open') → 现为 false → RED。
//   · 各 poison（期望具名拒绝码）：注册表无 workflow.create → validateObservationAdmission 从 events 推不出观察义务
//     （terminalByKey 空 → 提前返回 ok:true）→ 期望「拒」的断言实得 ok:true → RED。
//   C2 往注册表加 workflow 条目后：义务被推出、合法过、伪造仍被具名拒 → 全绿。
//   （合法 workflow 观察行 v1/v2/v3 现走「无义务 → ok:true」的真空绿，非红驱动；红由 r0 + poison 全体承载。）
//
// ── 对抗自检（本金牌构造上满足；忠实 ref 全绿另由 accept 期注入增广注册表实证、见交接）──
//   · always-true 桩下（validateObservationAdmission 恒回 {ok:true,rejectCode:null}）：全部 expectReject 断言必红。
//   · 每条 poison 只坏一维、余维全合法、锚正确终端 click、基数恰当 → 期望拒绝码在任何合理闭集实现下唯一。
//   · 「仅 kind 对、其余维不对」的伪造行（p4/p5/p6：kind='workflow' 正确，issuer/correlation/provenance 坏）
//     恰是 codex Q3 要挡的攻击面——逐条钉死具名拒绝码。
//
// ⚠ 真字段名待真机采、先采不猜（GRILL D4）：sourcePath='/api/workflows/query' 与 code='WF-*' 为仿造 hermetic
//   占位值，非 Heren 真机真实 recordsPath/接口路径/自动码形态。真字段名 = route:human（agent 侧第一轮猜
//   data.records 曾被真机纠正——workflow 侧务必先采不猜）。本金牌只钉闭集准入结构，不钉真字段字面量。

import { deepStrictEqual } from 'node:assert';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SECTION = process.argv[2] ?? 'all';
const SECTIONS = new Set(['all', 'r0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'v1', 'v2', 'v3', 'g1']);
if (!SECTIONS.has(SECTION)) process.exit(2);
const HERE = dirname(fileURLToPath(import.meta.url));
const MODULE_PATH = resolve(HERE, '..', '..', 'lib', 'entity-observation-registry.mjs');

let mod;
try {
  mod = await import(MODULE_PATH);
} catch (error) {
  console.error(`RED  entity-workflow-source-readback.admission: 目标验证器模块缺席 —— ${String(error?.message || error).slice(0, 240)}`);
  process.exit(1);
}
const { validateObservationAdmission, ENTITY_OBSERVATION_REGISTRY, SUPPORTED_ENTITY_KINDS } = mod;
if (typeof validateObservationAdmission !== 'function') {
  console.error('RED  entity-workflow-source-readback.admission: lib/entity-observation-registry.mjs 未导出 validateObservationAdmission 纯函数');
  process.exit(1);
}

// 闭集具名 rejectCode（沿用 C0 冻结的合法拒绝码全集；实现返回码须落此集）。
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

// ── workflow 夹具（形态锚仿造 workflow-sut fixture；字段名待真机采）───────────────────
const WF_NAME = '互联网问诊-主流程';
const WF_CODE = 'WF-IM-001';                        // 仿造工作流码形态（非真自动码）
const WF_PLATFORM_ID = '1234567890123456789';       // 19 位纯数字 string（opaque，不作数）
const WF_SOURCE_PATH = '/api/workflows/query';        // 仿造 workflows.listApi 路径（非真 recordsPath 面）

// 单 workflow.create intent：fill 工作流名称 + 终端 confirm click（atstep_2 = 读回锚点）。
const EVENTS_CREATE = [
  { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.create', action: 'fill', value: WF_NAME },
  { stepId: 'atstep_2', intentId: 'intent_1', atom: 'workflow.create', action: 'click', text: '确定' },
];
// source binding（母规格 point 3：workflow 创建即绑为 source，读回 join 到 source binding）。
const BINDINGS_CREATE = [{
  stepId: 'atstep_2', intentId: 'intent_1', atom: 'workflow.create',
  sourceIntentId: 'source_wf_1', candidateId: 'candidate-wf-main', role: 'source',
  bindingMode: 'created-in-run',
}];
function wfRow(overrides = {}) {
  return {
    kind: 'workflow', name: WF_NAME, code: WF_CODE, platformId: WF_PLATFORM_ID,
    sourceIntentId: 'source_wf_1', candidateId: 'candidate-wf-main', role: 'source',
    atom: 'workflow.create', evidenceStepId: 'atstep_2', sourcePath: WF_SOURCE_PATH,
    bindingMode: 'created-in-run', provenance: 'platform-readback',
    ...overrides,
  };
}
function wfObservationWith(rows, source = { kind: 'compile-envelope', atom: 'workflow.create' }) {
  return { source, observations: rows };
}
function wfInput(over = {}) {
  return {
    events: EVENTS_CREATE.map((e) => ({ ...e })),
    observation: wfObservationWith([wfRow()]),
    bindings: BINDINGS_CREATE.map((b) => ({ ...b })),
    ...over,
  };
}

// workflow.open 变体（第二个注册原子；镜像 create、atom 换 workflow.open）。
const EVENTS_OPEN = [
  { stepId: 'opstep_1', intentId: 'intent_2', atom: 'workflow.open', action: 'click', text: WF_NAME },
];
const BINDINGS_OPEN = [{
  stepId: 'opstep_1', intentId: 'intent_2', atom: 'workflow.open',
  sourceIntentId: 'source_wf_2', candidateId: 'candidate-wf-open', role: 'source',
  bindingMode: 'created-in-run',
}];
function wfOpenInput(over = {}) {
  return {
    events: EVENTS_OPEN.map((e) => ({ ...e })),
    observation: wfObservationWith([wfRow({
      sourceIntentId: 'source_wf_2', candidateId: 'candidate-wf-open',
      atom: 'workflow.open', evidenceStepId: 'opstep_1',
    })], { kind: 'compile-envelope', atom: 'workflow.open' }),
    bindings: BINDINGS_OPEN.map((b) => ({ ...b })),
    ...over,
  };
}

// agent 回归夹具（保序守卫：C2 加 workflow 条目不得改 agent 行为）。
const AGENT_EVENTS = [
  { stepId: 'agstep_1', intentId: 'intent_a', atom: 'agent.searchOpen', action: 'fill', value: 'atl-agent' },
  { stepId: 'agstep_2', intentId: 'intent_a', atom: 'agent.searchOpen', action: 'press', key: 'Enter' },
  { stepId: 'agstep_3', intentId: 'intent_a', atom: 'agent.searchOpen', action: 'click', text: 'atl-agent' },
];
const AGENT_BINDINGS = [{
  stepId: 'agstep_3', intentId: 'intent_a', atom: 'agent.searchOpen',
  sourceIntentId: 'source_a', candidateId: 'candidate-a', role: 'subject',
  bindingMode: 'existing',
}];
function agentInput() {
  return {
    events: AGENT_EVENTS.map((e) => ({ ...e })),
    observation: {
      source: { kind: 'compile-envelope', atom: 'agent.searchOpen' },
      observations: [{
        kind: 'agent', name: 'atl-agent', code: 'znt_atl_x', platformId: '1111111111111111111',
        sourceIntentId: 'source_a', candidateId: 'candidate-a', role: 'subject',
        atom: 'agent.searchOpen', evidenceStepId: 'agstep_3', sourcePath: '/ai-manager/agent/setup/queryAgentPageList',
        bindingMode: 'existing', provenance: 'user-confirmed',
      }],
    },
    bindings: AGENT_BINDINGS.map((b) => ({ ...b })),
  };
}

// ── r0 结构：注册表已加 workflow.create / workflow.open 条目（形状锚 C0 agent 条目）─────
test('r0', 'r0 ENTITY_OBSERVATION_REGISTRY 加 workflow.create/workflow.open→workflow/[source]、issuer/provenance 锚收据内核', () => {
  assert(ENTITY_OBSERVATION_REGISTRY instanceof Map, 'ENTITY_OBSERVATION_REGISTRY 须为 Map');
  for (const atom of ['workflow.create', 'workflow.open']) {
    const entry = ENTITY_OBSERVATION_REGISTRY.get(atom);
    assert(entry && typeof entry === 'object', `${atom} 必须在观察注册表内（C2 注册 workflow source 读回原子）`);
    assert(entry.boundKind === 'workflow', `${atom} boundKind 须 'workflow'；实得 ${brief(entry.boundKind)}`);
    deepStrictEqual([...entry.requiredRoles], ['source'],
      `${atom} requiredRoles 须恰 [source]（母规格 point 3：workflow 读回 join 到 source binding）；实得 ${brief(entry.requiredRoles)}`);
    assert(entry.issuer && entry.issuer.sourceKind === 'compile-envelope' && entry.issuer.atom === atom,
      `${atom} issuer 须 {compile-envelope, ${atom}}；实得 ${brief(entry.issuer)}`);
    assert(entry.provenanceByBindingMode
      && entry.provenanceByBindingMode.existing === 'user-confirmed'
      && entry.provenanceByBindingMode['created-in-run'] === 'platform-readback',
      `${atom} provenanceByBindingMode 须锚收据内核（existing→user-confirmed、created-in-run→platform-readback，GRILL D5）；实得 ${brief(entry.provenanceByBindingMode)}`);
    assert(Array.isArray(entry.allowedBindingModes)
      && entry.allowedBindingModes.includes('existing') && entry.allowedBindingModes.includes('created-in-run'),
      `${atom} allowedBindingModes 须含 existing 与 created-in-run（GRILL D5：existing 走 user-approval、created-in-run 走读回）；实得 ${brief(entry.allowedBindingModes)}`);
  }
  // workflow 须已在 kind 词表（C0 已入词表，此处复核 C2 未误删）。
  assert(SUPPORTED_ENTITY_KINDS instanceof Set && SUPPORTED_ENTITY_KINDS.has('workflow') && SUPPORTED_ENTITY_KINDS.has('agent'),
    'SUPPORTED_ENTITY_KINDS 须含 workflow 与 agent');
  // agent 条目保序（C2 不得改 agent）。
  const ag = ENTITY_OBSERVATION_REGISTRY.get('agent.searchOpen');
  assert(ag && ag.boundKind === 'agent', 'agent.searchOpen 条目须保序（boundKind=agent）');
});

// ── p1 kind 与 bound kind 不符（词表内但非 workflow.create 所绑：kind:'agent'）→ 拒 ─────
test('p1', "p1 观察行 kind='agent'（词表内、非 workflow.create 所绑）→ OBSERVATION_KIND_NOT_BOUND_TO_ATOM", () => {
  expectReject(wfInput({ observation: wfObservationWith([wfRow({ kind: 'agent' })]) }),
    'OBSERVATION_KIND_NOT_BOUND_TO_ATOM', "p1 kind='agent'");
});

// ── p2 数量恰好但 kind 越界（词表外 kind）→ 拒 ────────────────────────────────────
test('p2', "p2 数量恰好但 kind='chatflow'（不在 SUPPORTED_ENTITY_KINDS 词表）→ OBSERVATION_KIND_UNSUPPORTED", () => {
  expectReject(wfInput({ observation: wfObservationWith([wfRow({ kind: 'chatflow' })]) }),
    'OBSERVATION_KIND_UNSUPPORTED', "p2 kind 词表外");
});

// ── p3 角色数量不匹配（多于 / 少于 requiredRoles=[source]）→ 拒 ───────────────────
test('p3', 'p3a 角色多于（同终端 click 双观察行、均 role=source，基数 2≠requiredRoles 1）→ OBSERVATION_ROLE_COUNT_MISMATCH', () => {
  // 两行逐字合法（kind=workflow、同锚 atstep_2、五元 join 各命中同一 source binding、provenance 合法），
  // 唯一越界 = 同终端 click 观察基数 2≠1（sign.mjs join 基数口径）。
  expectReject(wfInput({ observation: wfObservationWith([wfRow(), wfRow()]) }),
    'OBSERVATION_ROLE_COUNT_MISMATCH', 'p3a 角色多于（基数越界）');
});
test('p3', 'p3b 角色少于（观察行空、但事件含终端 click 需 1 source 观察）→ OBSERVATION_ROLE_COUNT_MISMATCH', () => {
  expectReject(wfInput({ observation: wfObservationWith([]) }),
    'OBSERVATION_ROLE_COUNT_MISMATCH', 'p3b 角色少于');
});

// ── p4 observation 来源(issuer/atom)不在允许集 → 拒（kind='workflow' 正确，仅来源坏）────
test('p4', "p4a source.kind='user-supplied'（非 compile-envelope 签发信封；kind 对来源坏）→ OBSERVATION_ISSUER_NOT_ALLOWED", () => {
  expectReject(wfInput({ observation: wfObservationWith([wfRow()], { kind: 'user-supplied', atom: 'workflow.create' }) }),
    'OBSERVATION_ISSUER_NOT_ALLOWED', 'p4a issuer kind 非法');
});
test('p4', "p4b source.atom='nav.workflowManagement'（issuer 自报别的原子）→ OBSERVATION_ISSUER_NOT_ALLOWED", () => {
  expectReject(wfInput({ observation: wfObservationWith([wfRow()], { kind: 'compile-envelope', atom: 'nav.workflowManagement' }) }),
    'OBSERVATION_ISSUER_NOT_ALLOWED', 'p4b issuer atom 非法');
});

// ── p5 关联 ID 与事件流不对应 → 拒（单行锚正确终端、基数恰当、kind='workflow' 正确，仅五元 join 断）─
test('p5', "p5a sourceIntentId='source_ghost'（intentId 族关联无对应 binding，五元 join 断）→ OBSERVATION_CORRELATION_MISMATCH", () => {
  expectReject(wfInput({ observation: wfObservationWith([wfRow({ sourceIntentId: 'source_ghost' })]) }),
    'OBSERVATION_CORRELATION_MISMATCH', 'p5a sourceIntentId 无 binding');
});
test('p5', "p5b candidateId='candidate-ghost'（候选关联无对应 binding，五元 join 断）→ OBSERVATION_CORRELATION_MISMATCH", () => {
  expectReject(wfInput({ observation: wfObservationWith([wfRow({ candidateId: 'candidate-ghost' })]) }),
    'OBSERVATION_CORRELATION_MISMATCH', 'p5b candidateId 无 binding');
});

// ── p6 provenance 缺失 / 与 bindingMode 不符 → 拒（kind='workflow' 正确，仅 provenance 坏；GRILL D5 不变量）──
test('p6', 'p6a provenance 缺失（bindingMode=created-in-run 但无 provenance）→ OBSERVATION_PROVENANCE_INVALID', () => {
  const row = wfRow();
  delete row.provenance;
  expectReject(wfInput({ observation: wfObservationWith([row]) }),
    'OBSERVATION_PROVENANCE_INVALID', 'p6a provenance 缺失');
});
test('p6', "p6b provenance 与 bindingMode 不符（created-in-run 配 user-confirmed，违 created-in-run→platform-readback）→ OBSERVATION_PROVENANCE_INVALID", () => {
  expectReject(wfInput({ observation: wfObservationWith([wfRow({ bindingMode: 'created-in-run', provenance: 'user-confirmed' })]) }),
    'OBSERVATION_PROVENANCE_INVALID', 'p6b provenance 错配 bindingMode');
});

// ── v1/v2/v3 合法 workflow 观察行 → 过（注册后；现走「无义务→ok」真空绿，非红驱动）──────
test('v1', 'v1 合法 workflow.create 观察行（created-in-run/platform-readback、终端 click 锚定、issuer 合法）→ ok:true', () => {
  expectPass(wfInput(), 'v1 合法 workflow created-in-run');
});
test('v2', "v2 合法 workflow.create 观察行（existing/user-confirmed，GRILL D5「existing 走 user-approval」）→ ok:true", () => {
  expectPass(wfInput({
    observation: wfObservationWith([wfRow({ bindingMode: 'existing', provenance: 'user-confirmed' })]),
    bindings: BINDINGS_CREATE.map((b) => ({ ...b, bindingMode: 'existing' })),
  }), 'v2 合法 workflow existing');
});
test('v3', 'v3 合法 workflow.open 观察行（第二注册原子、created-in-run/platform-readback）→ ok:true', () => {
  expectPass(wfOpenInput(), 'v3 合法 workflow.open');
});

// ── g1 agent 保序（C2 加 workflow 不得改 agent 行为）→ 合法 agent 观察行仍过 ─────────────
test('g1', 'g1 合法 agent.searchOpen 观察行（C0 语义）→ ok:true（agent 保序回归守卫）', () => {
  expectPass(agentInput(), 'g1 agent 保序');
});

if (failures.length) {
  for (const failure of failures) console.error(`RED  entity-workflow-source-readback.admission: ${failure}`);
  console.error(`RED  entity-workflow-source-readback.admission/${SECTION}: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   entity-workflow-source-readback.admission/${SECTION}: ${passed}/${passed} 全过（纯函数 + 纯内存夹具，零 SUT）`);
