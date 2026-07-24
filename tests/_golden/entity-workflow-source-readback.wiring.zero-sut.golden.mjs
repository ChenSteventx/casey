#!/usr/bin/env node
// entity-workflow-source-readback（C2）round-2 接线金牌：可执行驱动【真实】生产码路径（codex R1 收口）。
// 纯 node + mock Page 替身驱真实 lib/compile-atoms.mjs 的 compileFlow + 直驱 lib/entity-observation-registry.mjs
// 纯函数——零浏览器、零网络、零 SUT、零子进程。断言纪律：退出码 + 具名断言；【绝不静态 grep 源码】
//（取代 arming.static 的 grep-only 弱证，codex Medium：「没有执行 helper」）。
//
// ── 钉三件（codex C2 round-1 FAIL 逐条收口）──
//   H1（compile 下游 kind 泛化，codex High-1）：checkIdentityObservationCardinality / deriveObservationIssuerAtom
//       由【观察行自身】驱动，非硬编码 agent.searchOpen——agent 逐字等价（issuer=agent.searchOpen）、workflow 单观察
//       可达（不再 0≠1 误杀）、多身份原子单信封 fail-closed。此二纯函数正是 bin/compile.mjs 成品段的真实消费者
//       （见 bin/compile.mjs import + 基数门/issuer 调用点）——本金牌直驱之，非源码串。
//   H2（open 读回失败 fail-CLOSED，codex High-2）：compileFlow 于任一步硬阻断后【立即中止整个 flow】，后续破坏动作
//       （workflow.save/bindAgent…）绝不执行——用 mock 页驱真实 compileFlow 证：step1 硬阻断（点开落在记录容器外/
//       读回不齐同源）后 step2 零 event（对照：无阻断的双步 flow 两步全跑，证中止是【条件性】的、不误杀成功路径）。
//   arming（Medium）：workflow.open 武装/容器归属闸行为经真实 compileFlow 执行触达（非源码串 grep）。
//
// ── route:human 边界（不在本金牌闭合，诚实标注，codex Critical）──
//   角色契约调和不可满足：观察注册表要 workflow.create/open→[source]，生产准入策略（ADR-0004 人签冻结件
//   tests/_golden/fixtures/teachin-admission-side-effect-policy/entity-admission-policy.frozen.json）要 [subject]。
//   同一 binding role 无法同时过两门 → workflow happy path 不存在。调和方向（按 plan 应改冻结策略到 source）触
//   ADR-0004 已签冻结面 → route:human（Steven 再签），本轮绝不擅改。本金牌只 hermetic 证【当前 fail-CLOSED】：
//   role=source 被生产准入门拒（不启浏览器）、role=subject 被观察准入门拒（不签观察）——两错向皆 fail-closed 不 fail-open。
//   【本节是 route:human 触发线】：若冻结策略被再签调和到 source，本节断言须随之复核更新。

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

let registry; let preflight; let compileAtoms; let createMockPage;
try {
  registry = await import(resolve(ROOT, 'lib', 'entity-observation-registry.mjs'));
  preflight = await import(resolve(ROOT, 'lib', 'entity-semantic-lock-preflight.mjs'));
  compileAtoms = await import(resolve(ROOT, 'lib', 'compile-atoms.mjs'));
  ({ createMockPage } = await import(resolve(HERE, 'fixtures', 'agent-id-readback', 'mock-page.mjs')));
} catch (error) {
  console.error(`RED  entity-workflow-source-readback.wiring: 目标模块缺席 —— ${String(error?.message || error).slice(0, 240)}`);
  process.exit(1);
}
const { checkIdentityObservationCardinality, deriveObservationIssuerAtom, validateObservationAdmission } = registry;
const { requiredFlowEntityBindings } = preflight;
const { createCompileRun, compileFlow } = compileAtoms;

const failures = [];
let passed = 0;
const assert = (cond, msg) => { if (cond) { passed += 1; console.log(`ok   ${msg}`); } else { failures.push(msg); console.error(`FAIL ${msg}`); } };
const brief = (v) => { try { return JSON.stringify(v).slice(0, 200); } catch { return String(v); } };

// mock 页 = 冻结 createMockPage + 补 waitForURL（workflow.open 唯一命中后导航详情用；容器外 fail-closed 路径不触达）。
function wfPage(dom) {
  const base = createMockPage({ dom, url: 'http://127.0.0.1:4173/', titles: ['工作流管理'] });
  return { ...base, waitForURL: async () => {} };
}
function newRun(page) {
  return createCompileRun({
    page, forensics: { records: () => [] }, state: { currentStepId: null },
    sut: 'http://127.0.0.1:4173', uniqueName: 'atl_fixed', site: null,
    agentListRoute: null, profile: null, identityLedger: null,
  });
}
const wfOpenStep = (openName) => ({
  atom: 'workflow.open', params: { openName },
  sourceIntentId: `intent_${openName}`, entityBindings: [{ candidateId: `cand-${openName}`, role: 'source' }],
});

// ════════════════ H1：compile 下游泛化纯函数（观察行驱动，非硬编码 agent.searchOpen）════════════════
{
  // 基数门 checkIdentityObservationCardinality —— agent 单观察（evidenceStepId 锚终端 click）逐字等价路径。
  const agentEvents = [
    { stepId: 's_fill', intentId: 'i', atom: 'agent.searchOpen', action: 'fill' },
    { stepId: 's_click', intentId: 'i', atom: 'agent.searchOpen', action: 'click' },
  ];
  const agentObs = [{ atom: 'agent.searchOpen', evidenceStepId: 's_click' }];
  assert(checkIdentityObservationCardinality({ events: agentEvents, observations: agentObs }).ok === true,
    'H1a 基数门·agent 单观察锚终端 click → ok（旧 agent.searchOpen-click 计数口径逐字等价，不回归）');

  // workflow-only 流：0 个 agent.searchOpen click、workflow.create 有【多个】非终端 click，观察锚【确认 click】。
  // 旧硬编码「数 agent.searchOpen click」得 0≠1 误 exit 65；泛化后按 evidenceStepId 锚定 → ok（codex High-1 核心）。
  const wfEvents = [
    { stepId: 'w_nav', intentId: 'ic', atom: 'workflow.create', action: 'nav' },
    { stepId: 'w_newbtn', intentId: 'ic', atom: 'workflow.create', action: 'click' },
    { stepId: 'w_fill', intentId: 'ic', atom: 'workflow.create', action: 'fill' },
    { stepId: 'w_confirm', intentId: 'ic', atom: 'workflow.create', action: 'click' },
  ];
  const wfObs = [{ atom: 'workflow.create', evidenceStepId: 'w_confirm' }];
  assert(checkIdentityObservationCardinality({ events: wfEvents, observations: wfObs }).ok === true,
    'H1b 基数门·workflow-only 单观察锚确认 click（0 个 agent.searchOpen click）→ ok（旧硬编码 0≠1 误杀，泛化后可达）');

  // fail-closed：evidenceStepId 不是终端 click / 重复 / 缺失。
  assert(checkIdentityObservationCardinality({ events: wfEvents, observations: [{ atom: 'workflow.create', evidenceStepId: 'w_fill_ghost' }] }).ok === false,
    'H1c 基数门·观察 evidenceStepId 非任何终端 click stepId → fail-closed（错位不产成功产物）');
  assert(checkIdentityObservationCardinality({ events: wfEvents, observations: [{ atom: 'workflow.create', evidenceStepId: 'w_confirm' }, { atom: 'workflow.create', evidenceStepId: 'w_confirm' }] }).ok === false,
    'H1d 基数门·两观察锚同一 click（evidenceStepId 重复）→ fail-closed');
  assert(checkIdentityObservationCardinality({ events: wfEvents, observations: [{ atom: 'workflow.create' }] }).ok === false,
    'H1e 基数门·观察缺 evidenceStepId → fail-closed');
  assert(checkIdentityObservationCardinality({ events: 'x', observations: [] }).ok === false,
    'H1f 基数门·events 非数组 → fail-closed（整体输入 fail-closed，不静默归一）');

  // issuer 泛化 deriveObservationIssuerAtom —— agent 逐字等价 + workflow 单原子可达 + 多原子 fail-closed。
  const agIssuer = deriveObservationIssuerAtom([{ atom: 'agent.searchOpen', evidenceStepId: 's_click' }]);
  assert(agIssuer.ok === true && agIssuer.atom === 'agent.searchOpen' && agIssuer.sourceKind === 'compile-envelope',
    `H1g issuer·agent 观察 → {atom:agent.searchOpen, sourceKind:compile-envelope}（逐字等价旧硬编码 source 面，byte-identity）；实得 ${brief(agIssuer)}`);
  const wfcIssuer = deriveObservationIssuerAtom([{ atom: 'workflow.create', evidenceStepId: 'w_confirm' }]);
  assert(wfcIssuer.ok === true && wfcIssuer.atom === 'workflow.create' && wfcIssuer.sourceKind === 'compile-envelope',
    `H1h issuer·workflow.create 观察 → {atom:workflow.create}（不再硬编码 agent.searchOpen，sign 才可对账）；实得 ${brief(wfcIssuer)}`);
  const multiIssuer = deriveObservationIssuerAtom([{ atom: 'workflow.create', evidenceStepId: 'w1' }, { atom: 'workflow.open', evidenceStepId: 'w2' }]);
  assert(multiIssuer.ok === false && multiIssuer.reason === 'OBSERVATION_ISSUER_MULTIPLE_ATOMS',
    `H1i issuer·多身份原子（create+open 同流）→ fail-closed（单信封无法表征，C2 route:human）；实得 ${brief(multiIssuer)}`);
  const unregIssuer = deriveObservationIssuerAtom([{ atom: 'ghost.atom', evidenceStepId: 'w1' }]);
  assert(unregIssuer.ok === false && unregIssuer.reason === 'OBSERVATION_ISSUER_ATOM_UNREGISTERED',
    `H1j issuer·未登记原子 → fail-closed；实得 ${brief(unregIssuer)}`);
  assert(deriveObservationIssuerAtom([]).ok === false,
    'H1k issuer·空观察集 → fail-closed');
}

// ════════════════ H2：compileFlow 硬阻断后 fail-CLOSED 中止（真实 compileFlow）════════════════
{
  // 负控（codex High-2 构造同源）：step1 = workflow.open「wrongwf」点开落在记录容器外（同名非行控件碰撞）→ 硬阻断
  //   fail-closed（compileWorkflowOpen 容器归属闸），step2 = workflow.open「goodwf」本会唯一命中并 emit。
  //   中止后 step2 绝不执行 → 全流零 workflow.open event（step1 容器外不 emit、step2 被中止）。
  const negPage = wfPage({
    'text:wrongwf:exact': { count: 1, inContainer: false }, // 容器外命中 → 硬阻断
    'text:goodwf:exact': { count: 1, inContainer: true },   // 本可 emit（用以证「若跑则会留 event」）
  });
  const negRun = newRun(negPage);
  await compileFlow(negRun, { id: 'tc_wf_abort', steps: [wfOpenStep('wrongwf'), wfOpenStep('goodwf')] });
  const negOpenEvents = negRun.events.filter((e) => e.atom === 'workflow.open');
  assert(negRun.blockers.length >= 1, `H2a step1 容器外命中 → 硬阻断入 blockers；实得 ${brief(negRun.blockers)}`);
  assert(negOpenEvents.length === 0,
    `H2b 硬阻断后 fail-CLOSED 中止：step2（goodwf）绝不执行 → 零 workflow.open event（破坏动作不落未证对象）；实得 events=${brief(negRun.events.map((e) => `${e.atom}/${e.action}`))}`);
  assert(negRun.notes.some((n) => n.includes('fail-closed 中止')),
    'H2c 中止留痕（notes 记「fail-closed 中止：后续步骤不再执行」）');

  // 正控：无阻断的双步 flow 两步全跑（证中止是【条件性】的、不误杀成功路径——break 只随 blocker 增长触发）。
  const posPage = wfPage({
    'text:wfone:exact': { count: 1, inContainer: true },
    'text:wftwo:exact': { count: 1, inContainer: true },
  });
  const posRun = newRun(posPage);
  await compileFlow(posRun, { id: 'tc_wf_ok', steps: [wfOpenStep('wfone'), wfOpenStep('wftwo')] });
  const posOpenEvents = posRun.events.filter((e) => e.atom === 'workflow.open' && e.action === 'click');
  assert(posRun.blockers.length === 0 && posOpenEvents.length === 2,
    `H2d 正控·无阻断双步 flow 两步全跑（blockers 空、两 workflow.open click）→ 中止不误杀成功路径；实得 blockers=${brief(posRun.blockers)} clicks=${posOpenEvents.length}`);
}

// ════════════════ Critical：角色契约不可满足 = 当前 fail-CLOSED（route:human 触发线）════════════════
{
  // 同一 workflow.create binding role 无法同时过生产准入门 + 观察准入门（codex Critical）。本节钉【当前 fail-CLOSED】：
  //   两错向皆拒、无 fail-open。调和方向（改冻结策略到 source）触 ADR-0004 人签面 = route:human，再签后本节须复核。
  const srcFlow = { id: 'f', steps: [{ atom: 'workflow.create', sourceIntentId: 's', entityBindings: [{ candidateId: 'wf', role: 'source' }] }] };
  const srcPre = requiredFlowEntityBindings(srcFlow);
  assert(srcPre && srcPre.ok === false && srcPre.reason === 'ENTITY_BINDING_REQUIRED_ROLES_INVALID',
    `C-fc1 role=source（观察门要的角色）→ 生产准入门拒 ENTITY_BINDING_REQUIRED_ROLES_INVALID（不启浏览器，fail-closed）；实得 ${brief(srcPre)}`);

  const subFlow = { id: 'f', steps: [{ atom: 'workflow.create', sourceIntentId: 's', entityBindings: [{ candidateId: 'wf', role: 'subject' }] }] };
  const subPre = requiredFlowEntityBindings(subFlow);
  assert(Array.isArray(subPre) && subPre.length === 1 && subPre[0].role === 'subject',
    `C-fc2 role=subject（生产策略要的角色）→ 生产准入门过（旁证冲突真实存在）；实得 ${brief(subPre)}`);

  const evs = [{ stepId: 'w', intentId: 'i', atom: 'workflow.create', action: 'click' }];
  const subBind = [{ stepId: 'w', intentId: 'i', atom: 'workflow.create', sourceIntentId: 's', candidateId: 'wf', role: 'subject', bindingMode: 'created-in-run' }];
  const subObs = { source: { kind: 'compile-envelope', atom: 'workflow.create' }, observations: [{ kind: 'workflow', name: 'wf', code: 'W', platformId: '1234567890123456789', sourceIntentId: 's', candidateId: 'wf', role: 'subject', atom: 'workflow.create', evidenceStepId: 'w', sourcePath: '/wf', bindingMode: 'created-in-run', provenance: 'platform-readback' }] };
  const subAdm = validateObservationAdmission({ events: evs, bindings: subBind, observation: subObs });
  assert(subAdm && subAdm.ok === false && subAdm.rejectCode === 'OBSERVATION_ROLE_COUNT_MISMATCH',
    `C-fc3 role=subject 的观察行 → 观察准入门拒 OBSERVATION_ROLE_COUNT_MISMATCH（不签观察，fail-closed）；实得 ${brief(subAdm)}`);
  // 合起来：source 过观察门却被生产门拒、subject 过生产门却被观察门拒 → 无 role 同过两门 → happy path 不存在（route:human）。
}

if (failures.length) {
  for (const f of failures) console.error(`RED  entity-workflow-source-readback.wiring: ${f}`);
  console.error(`RED  entity-workflow-source-readback.wiring: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   entity-workflow-source-readback.wiring: ${passed}/${passed} 全过（真实 compileFlow + 泛化纯函数直驱，H1/H2/arming + Critical fail-closed 触发线，零 SUT）`);
