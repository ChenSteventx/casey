#!/usr/bin/env node
// compile-intent-lineage-rebind 验收金牌：标准编译路径事件意图号重绑（authored 语义号进正式产物）。
// 纯 node + mock Page 替身驱【真实】lib/compile-atoms.mjs 的 compileFlow + 直驱
// lib/entity-created-workflow-continuity-v3.mjs 纯函数——零浏览器、零网络、零 SUT、零子进程、
// 零仓外文件依赖（流文档一律金牌内自构，不读 gitignored 案例产物——新树必绿可跑）。
//
// ── 钉四件（docs/plans/compile-intent-lineage-rebind/plan.md G1–G3；G4 由既有 teach-in 金牌 +
//    全仓双态扫描背书，不新造重复钉）──
//   G1a 缝钉（实现前必红）：authored 流（步带 sourceIntentId）经真实 compileFlow 产出的事件
//       intentId 全为 authored 号、零 intent_N 残留、逐步归属正确、lastIntentId 同步折叠锚。
//   G1b 闸耦合钉（冻结既有闸语义，绿基线）：同一份确认流字节形，事件意图号 authored → 出处链闸 ok；
//       生产态 intent_N（十三跑形）→ 拒 CREATED_WORKFLOW_PROVENANCE_TERMINAL_EVENT_INVALID；
//       同组双终端 → 同码拒（fail-closed 不放松）。
//   G2  混合态钉（实现前必红；2026-08-07 改版）：同流部分步带、部分不带 sourceIntentId 是本仓
//       既定合法惯例（entity-ui-wiring.bindagent-replay 夹具口径：变异步带号+绑定、nav/assert 不带，
//       assert 折进前一意图锚）——首版「全或无掷错」被该冻结金牌真域证据证伪后 Steven 裁反转。
//       现钉：逐步存在即绑——带号步事件重绑 authored 号、裸步事件保持 intent_N、不掷错、两步全跑。
//   G3  遗留零漂移钉（绿基线）：全不带 sourceIntentId 的流 → 事件 intentId 保持编译器自生
//       intent_N，行为与现行逐字等价。

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

let compileAtoms; let continuity; let createMockPage;
try {
  compileAtoms = await import(resolve(ROOT, 'lib', 'compile-atoms.mjs'));
  continuity = await import(resolve(ROOT, 'lib', 'entity-created-workflow-continuity-v3.mjs'));
  ({ createMockPage } = await import(resolve(HERE, 'fixtures', 'agent-id-readback', 'mock-page.mjs')));
} catch (error) {
  console.error(`RED  compile-intent-lineage-rebind: 目标模块缺席 —— ${String(error?.message || error).slice(0, 240)}`);
  process.exit(1);
}
const { createCompileRun, compileFlow } = compileAtoms;
const { issueCreatedWorkflowCompileProvenance } = continuity;

const failures = [];
let passed = 0;
const assert = (cond, msg) => { if (cond) { passed += 1; console.log(`ok   ${msg}`); } else { failures.push(msg); console.error(`FAIL ${msg}`); } };
const brief = (v) => { try { return JSON.stringify(v).slice(0, 200); } catch { return String(v); } };
const GENERATED_INTENT = /^intent_\d+$/;

// mock 页与 run 桩：逐字镜像 entity-workflow-source-readback.wiring.zero-sut 的姿势
// （profile/identityLedger 置 null 走未声明身份通道，open 步容器内唯一命中即 emit）。
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
const wfOpenStep = (openName, sourceIntentId) => ({
  atom: 'workflow.open', params: { openName },
  ...(sourceIntentId === undefined ? {} : { sourceIntentId }),
  entityBindings: [{ candidateId: `cand-${openName}`, role: 'source' }],
});

// ════════════════ G1a 缝钉：authored 流经真实 compileFlow → 事件意图号重绑（实现前必红）════════════════
{
  const page = wfPage({
    'text:wfone:exact': { count: 1, inContainer: true },
    'text:wftwo:exact': { count: 1, inContainer: true },
  });
  const run = newRun(page);
  await compileFlow(run, {
    id: 'tc_lineage_authored',
    steps: [wfOpenStep('wfone', 'intent_open_one'), wfOpenStep('wftwo', 'intent_open_two')],
  });
  const clicks = run.events.filter((e) => e.atom === 'workflow.open' && e.action === 'click');
  assert(run.blockers.length === 0 && clicks.length === 2,
    `G1a-0 前提：无阻断双步 authored 流两步全跑（沿用 H2d 正控形）；实得 blockers=${brief(run.blockers)} clicks=${clicks.length}`);
  const residue = run.events.filter((e) => GENERATED_INTENT.test(e.intentId));
  assert(residue.length === 0,
    `G1a-1 重绑后零 intent_N 残留（compiler-local 序数不得进入正式产物）；实得残留 ${brief(residue.map((e) => `${e.stepId}:${e.intentId}`))}`);
  assert(clicks.length === 2 && clicks[0].intentId === 'intent_open_one' && clicks[1].intentId === 'intent_open_two',
    `G1a-2 逐步归属：step1 事件挂 intent_open_one、step2 事件挂 intent_open_two（authored 语义号，非序数）；实得 ${brief(clicks.map((e) => e.intentId))}`);
  assert(run.lastIntentId === 'intent_open_two',
    `G1a-3 lastIntentId 同步为末步 authored 号（断言折叠锚不让 intent_N 旁路泄回）；实得 ${brief(run.lastIntentId)}`);
  // G1c 三通道一致性（grok r1 H1：observed/verification 在 emit 时写入编译器自生号，重绑若漏改这两条
  // 旁路，draft 存在性闸按 observed 全集判 authored 草稿为幽灵 intent 必拒 exit 65——event ≡ observed ≡
  // verification 逐 stepId 同号才算 authored 号真正进了全部正式产物）。
  const obsById = new Map(run.observed.map((o) => [o.stepId, o.intentId]));
  const verById = new Map(run.verification.map((v) => [v.stepId, v.intentId]));
  assert(run.events.every((e) => obsById.get(e.stepId) === e.intentId),
    `G1c-1 observed 通道逐 stepId 与 events 同号（authored 号进 observed，draft 存在性闸不拒）；实得 ${brief(run.events.map((e) => `${e.stepId}:${e.intentId}/${obsById.get(e.stepId)}`))}`);
  assert(run.events.every((e) => verById.get(e.stepId) === e.intentId),
    `G1c-2 verification 通道逐 stepId 与 events 同号；实得 ${brief(run.events.map((e) => `${e.stepId}:${e.intentId}/${verById.get(e.stepId)}`))}`);
}

// ════════════════ G1b 闸耦合钉：authored 意图号满足出处链闸、intent_N 必拒（绿基线，冻结闸语义）════════════════
{
  // 流文档自构：字节形镜像 cases/tc_catalog_wf_crud/flow.confirmed.json 的承重面
  // （顶层 caseId + flow.id + steps[].atom/sourceIntentId/params），不读仓外产物。
  const flowDoc = {
    caseId: 'tc_lineage_gate',
    flow: {
      id: 'tc_lineage_gate',
      steps: [
        { atom: 'workflow.create', sourceIntentId: 'intent_create', params: { name: 'atl_{{uniqueName}}' } },
        { atom: 'workflow.deleteByName', sourceIntentId: 'intent_cleanup', params: { name: 'atl_{{uniqueName}}' } },
      ],
    },
  };
  const flowBytes = Buffer.from(JSON.stringify(flowDoc));
  const mkEvents = (createIntent, deleteIntent, extraTerminal = false) => Buffer.from(JSON.stringify({
    caseId: 'tc_lineage_gate',
    events: [
      { stepId: 'atstep_0', intentId: createIntent, atom: 'workflow.create', action: 'nav' },
      { stepId: 'atstep_7', intentId: createIntent, atom: 'workflow.create', action: 'click', compilePhase: 'terminal' },
      ...(extraTerminal ? [{ stepId: 'atstep_8', intentId: createIntent, atom: 'workflow.create', action: 'click', compilePhase: 'terminal' }] : []),
      { stepId: 'atstep_15', intentId: deleteIntent, atom: 'workflow.deleteByName', action: 'click', compilePhase: 'terminal' },
    ],
  }));

  const authored = issueCreatedWorkflowCompileProvenance({
    caseId: 'tc_lineage_gate', eventsBytes: mkEvents('intent_create', 'intent_cleanup'), confirmedFlowBytes: flowBytes,
  });
  assert(authored.ok === true,
    `G1b-1 authored 意图号（与流步 sourceIntentId 同名）→ 出处链闸 ok（create/delete 终端各恰 1）；实得 ${brief(authored)}`);

  const generated = issueCreatedWorkflowCompileProvenance({
    caseId: 'tc_lineage_gate', eventsBytes: mkEvents('intent_1', 'intent_4'), confirmedFlowBytes: flowBytes,
  });
  assert(generated.ok === false && generated.reason === 'CREATED_WORKFLOW_PROVENANCE_TERMINAL_EVENT_INVALID',
    `G1b-2 生产态 intent_N（十三跑形）→ 拒 CREATED_WORKFLOW_PROVENANCE_TERMINAL_EVENT_INVALID（意图号命名空间错配即闸红——重绑正是为此）；实得 ${brief(generated)}`);

  const doubled = issueCreatedWorkflowCompileProvenance({
    caseId: 'tc_lineage_gate', eventsBytes: mkEvents('intent_create', 'intent_cleanup', true), confirmedFlowBytes: flowBytes,
  });
  assert(doubled.ok === false && doubled.reason === 'CREATED_WORKFLOW_PROVENANCE_TERMINAL_EVENT_INVALID',
    `G1b-3 同组双终端 → 同码拒（重绑不放松闸的恰一终端判据，fail-closed 原样）；实得 ${brief(doubled)}`);
}

// ════════════════ G2 混合态钉（改版）：逐步存在即绑——带号步重绑、裸步保持 intent_N、不掷错════════════════
{
  const page = wfPage({
    'text:wfmixa:exact': { count: 1, inContainer: true },
    'text:wfmixb:exact': { count: 1, inContainer: true },
  });
  const run = newRun(page);
  let thrown = null;
  try {
    await compileFlow(run, {
      id: 'tc_lineage_mixed',
      steps: [wfOpenStep('wfmixa', 'intent_open_a'), wfOpenStep('wfmixb')],
    });
  } catch (error) {
    thrown = String(error && error.message || error);
  }
  const clicks = run.events.filter((e) => e.atom === 'workflow.open' && e.action === 'click');
  assert(thrown === null && run.blockers.length === 0 && clicks.length === 2,
    `G2-1 混合流不掷错、两步全跑（变异步带号+nav/assert 裸步是既定合法惯例，bindagent-replay 夹具口径）；实得 thrown=${brief(thrown)} blockers=${brief(run.blockers)} clicks=${clicks.length}`);
  assert(clicks.length === 2 && clicks[0].intentId === 'intent_open_a',
    `G2-2 带号步事件重绑 authored 号；实得 ${brief(clicks[0] && clicks[0].intentId)}`);
  assert(clicks.length === 2 && GENERATED_INTENT.test(clicks[1].intentId),
    `G2-3 裸步事件保持编译器自生 intent_N（逐步语义，不越界改写）；实得 ${brief(clicks[1] && clicks[1].intentId)}`);
  assert(run.lastIntentId === (clicks[1] && clicks[1].intentId),
    `G2-4 裸步后 lastIntentId 为该步自生号（后继 assert 折叠锚跟随本步，与遗留行为一致）；实得 ${brief(run.lastIntentId)}`);
  const mixObsById = new Map(run.observed.map((o) => [o.stepId, o.intentId]));
  const mixVerById = new Map(run.verification.map((v) => [v.stepId, v.intentId]));
  assert(run.events.every((e) => mixObsById.get(e.stepId) === e.intentId && mixVerById.get(e.stepId) === e.intentId),
    `G2-5 混合流三通道逐 stepId 同号（带号步三通道全 authored、裸步三通道全 intent_N——一致性双向成立）；实得 ${brief(run.events.map((e) => `${e.intentId}/${mixObsById.get(e.stepId)}/${mixVerById.get(e.stepId)}`))}`);
}

// ════════════════ G3 遗留零漂移钉：全不带 sourceIntentId → intent_N 原样（绿基线）════════════════
{
  const page = wfPage({
    'text:wflega:exact': { count: 1, inContainer: true },
    'text:wflegb:exact': { count: 1, inContainer: true },
  });
  const run = newRun(page);
  await compileFlow(run, {
    id: 'tc_lineage_legacy',
    steps: [wfOpenStep('wflega'), wfOpenStep('wflegb')],
  });
  const clicks = run.events.filter((e) => e.atom === 'workflow.open' && e.action === 'click');
  assert(run.blockers.length === 0 && clicks.length === 2,
    `G3-1 遗留流（零 sourceIntentId）两步全跑、无阻断；实得 blockers=${brief(run.blockers)} clicks=${clicks.length}`);
  assert(run.events.every((e) => GENERATED_INTENT.test(e.intentId)),
    `G3-2 遗留流事件 intentId 保持编译器自生 intent_N（零漂移，重绑不越界）；实得 ${brief(run.events.map((e) => e.intentId))}`);
}

if (failures.length) {
  for (const f of failures) console.error(`RED  compile-intent-lineage-rebind: ${f}`);
  console.error(`RED  compile-intent-lineage-rebind: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   compile-intent-lineage-rebind: ${passed}/${passed} 全过（真实 compileFlow 缝 + 出处链闸耦合 + 混合态 + 遗留零漂移，零 SUT）`);
