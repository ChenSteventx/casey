#!/usr/bin/env node
// entity-workflow-source-readback（C2）反向基数金牌：封 codex round-2 High-1「反向基数 fail-open」+ round-3 High
// 「终端锚定 fail-open」。直驱【真实】lib/entity-observation-registry.mjs 的 checkIdentityObservationCardinality
// （bin/compile.mjs:376 成品段基数门的真实消费者）——零浏览器、零网络、零 SUT、零 seam-mock、零源码 grep。
// 断言纪律：退出码 + 具名断言。
//
// ── 背景一（codex round-2 亲验三案 fail-open，round-3 已封）──
//   round-2 基数门只验单向「观察→某 click」（evidenceStepId ∈ click stepId 集、互不重复），丢了反向与 atom 对应，
//   令三案错返 ok:true：①有身份定向 click 却 0 观察；②两身份 click 只一观察；③观察锚到别原子 click。
// ── 背景二（codex round-3 亲验两残留 fail-open，本轮封）──
//   round-3 first-cut 按 intent 折叠（只数「(intentId,atom) 组有几条观察」），从不认定【哪个 click 是终端】：
//   workflow.create 的 新增/分类/确认 三 click，观察锚【任意一个】均 ok:true；两同 intent agent.searchOpen click
//   仅一观察（锚首个非终端）亦 ok:true——无法证明观察锚的是终端确认 click。
// ── 本轮修法（显式终端锚定）──
//   每 (intentId,atom) 组的终端 = 组内 events 顺序【最后一个】click（严等 compile 武装 run.events[len-1] 口径，见
//   lib/compile-atoms.mjs compileWorkflowCreate/compileAgentSearchOpen/compileWorkflowOpen）。观察 evidenceStepId
//   【必须锚终端 click】，锚非终端脚手架步 → 拒 OBSERVATION_EVIDENCE_ANCHORS_NON_TERMINAL_CLICK。
//
// ── 与冻结 wiring 金牌（H1a–H1k）互补 ──
//   wiring 金牌 H1 段覆盖正向（观察→click 存在/重复/缺失）+ agent/workflow 单观察锚终端；本金牌新增反向三案 +
//   越供 + 未登记锚定 + 【终端锚定红先后绿两案】，复证 agent happy path 零回归、workflow 多 click 单终端不误杀。

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

let registry;
try {
  registry = await import(resolve(ROOT, 'lib', 'entity-observation-registry.mjs'));
} catch (error) {
  console.error(`RED  cardinality-reverse: 目标模块缺席 —— ${String(error?.message || error).slice(0, 240)}`);
  process.exit(1);
}
const { checkIdentityObservationCardinality: card } = registry;

const failures = [];
let passed = 0;
const assert = (cond, msg) => { if (cond) { passed += 1; console.log(`ok   ${msg}`); } else { failures.push(msg); console.error(`FAIL ${msg}`); } };
const brief = (v) => { try { return JSON.stringify(v).slice(0, 200); } catch { return String(v); } };

// ════════════════ 反向：codex round-2 亲验三案，须 fail-closed ════════════════
{
  // ① 有身份定向 click（agent.searchOpen，intent i）却 0 观察 → 静默产无观察件的 fail-open，须拒。
  const c1 = card({ events: [{ stepId: 's_click', intentId: 'i', atom: 'agent.searchOpen', action: 'click' }], observations: [] });
  assert(c1.ok === false && c1.reason === 'OBSERVATION_TERMINAL_WITHOUT_MATCHING_OBSERVATION',
    `RC-1 身份定向 click + 0 观察 → fail-closed（不静默产无观察件）；实得 ${brief(c1)}`);

  // ①b 身份定向 click 缺 intentId → 无从收敛终端，fail-closed（codex 复现命令即无 intentId 形态）。
  const c1b = card({ events: [{ stepId: 's_click', atom: 'agent.searchOpen', action: 'click' }], observations: [] });
  assert(c1b.ok === false && c1b.reason === 'OBSERVATION_TERMINAL_INTENT_MISSING',
    `RC-1b 身份定向 click 缺 intentId → fail-closed（无从收敛终端义务）；实得 ${brief(c1b)}`);

  // ② 两身份 click（各自 intent）只一观察 → 漏一条身份读回，须拒（另一 intent 终端 0 观察）。
  const c2 = card({ events: [
    { stepId: 's1', intentId: 'i1', atom: 'agent.searchOpen', action: 'click' },
    { stepId: 's2', intentId: 'i2', atom: 'agent.searchOpen', action: 'click' },
  ], observations: [{ atom: 'agent.searchOpen', evidenceStepId: 's1' }] });
  assert(c2.ok === false && c2.reason === 'OBSERVATION_TERMINAL_WITHOUT_MATCHING_OBSERVATION',
    `RC-2 两身份 intent 只一观察 → fail-closed（漏一读回不产成功产物）；实得 ${brief(c2)}`);

  // ③ agent.searchOpen 观察锚到【别原子】的 click（未登记的 workflow.saveDraft）→ atom 张冠李戴，须拒。
  const c3 = card({ events: [{ stepId: 'x', intentId: 'i', atom: 'workflow.saveDraft', action: 'click' }],
    observations: [{ atom: 'agent.searchOpen', evidenceStepId: 'x' }] });
  assert(c3.ok === false && c3.reason === 'OBSERVATION_EVIDENCE_ATOM_MISMATCH',
    `RC-3 观察锚到别原子 click（saveDraft）→ fail-closed（atom 对应）；实得 ${brief(c3)}`);

  // ③b 观察锚到【已登记但不同】原子的 click（workflow.open）→ 仍 atom 张冠李戴，须拒（登记≠对应）。
  const c3b = card({ events: [{ stepId: 'x', intentId: 'i', atom: 'workflow.open', action: 'click' }],
    observations: [{ atom: 'agent.searchOpen', evidenceStepId: 'x' }] });
  assert(c3b.ok === false && c3b.reason === 'OBSERVATION_EVIDENCE_ATOM_MISMATCH',
    `RC-3b 观察锚到已登记异原子 click（workflow.open）→ fail-closed；实得 ${brief(c3b)}`);
}

// ════════════════ 终端锚定（codex round-3 High 红先后绿两案）════════════════
// 显式终端 = 组内 events 顺序最后一个 click。观察必锚终端；锚非终端脚手架步 → 拒。红先：old intent-折叠 令下列
// 「锚非终端」全返 ok:true（codex 亲验）；本轮修法后 fail-closed（具名 OBSERVATION_EVIDENCE_ANCHORS_NON_TERMINAL_CLICK）。
{
  // 案一：workflow.create 单步多 click（新增/分类/确认同 iCreate，唯确认武装）——同 compileWorkflowCreate 事件形态。
  const wfCreate = [
    { stepId: 'w_nav', intentId: 'ic', atom: 'workflow.create', action: 'nav' },
    { stepId: 'w_new', intentId: 'ic', atom: 'workflow.create', action: 'click' },   // 新增（非终端脚手架步）
    { stepId: 'w_fill', intentId: 'ic', atom: 'workflow.create', action: 'fill' },
    { stepId: 'w_cat', intentId: 'ic', atom: 'workflow.create', action: 'click' },   // 分类（非终端脚手架步）
    { stepId: 'w_confirm', intentId: 'ic', atom: 'workflow.create', action: 'click' }, // 确认（终端）
  ];
  // 锚 新增 → 拒（红先：old 返 ok:true）。
  const tNew = card({ events: wfCreate, observations: [{ atom: 'workflow.create', evidenceStepId: 'w_new' }] });
  assert(tNew.ok === false && tNew.reason === 'OBSERVATION_EVIDENCE_ANCHORS_NON_TERMINAL_CLICK',
    `TA-1a workflow.create 观察锚【新增 click】(非终端) → fail-closed（关死「锚任意 click 均 ok」的 fail-open）；实得 ${brief(tNew)}`);
  // 锚 分类 → 拒。
  const tCat = card({ events: wfCreate, observations: [{ atom: 'workflow.create', evidenceStepId: 'w_cat' }] });
  assert(tCat.ok === false && tCat.reason === 'OBSERVATION_EVIDENCE_ANCHORS_NON_TERMINAL_CLICK',
    `TA-1b workflow.create 观察锚【分类 click】(非终端) → fail-closed；实得 ${brief(tCat)}`);
  // 锚 确认（终端）→ ok（正控：终端锚定绿，不误杀）。
  const tConfirm = card({ events: wfCreate, observations: [{ atom: 'workflow.create', evidenceStepId: 'w_confirm' }] });
  assert(tConfirm.ok === true,
    `TA-1c workflow.create 观察锚【确认 click】(终端) → ok（正控·终端锚定绿，多 click 收敛单终端不误杀）；实得 ${brief(tConfirm)}`);

  // 案二：两同 intent agent.searchOpen click（首个非终端、末个终端）。老 intent 折叠令锚首个也 ok:true（codex 亲验）。
  const twoSameIntent = [
    { stepId: 'sa1', intentId: 'i', atom: 'agent.searchOpen', action: 'click' }, // 首个（非终端）
    { stepId: 'sa2', intentId: 'i', atom: 'agent.searchOpen', action: 'click' }, // 末个（终端）
  ];
  const tFirst = card({ events: twoSameIntent, observations: [{ atom: 'agent.searchOpen', evidenceStepId: 'sa1' }] });
  assert(tFirst.ok === false && tFirst.reason === 'OBSERVATION_EVIDENCE_ANCHORS_NON_TERMINAL_CLICK',
    `TA-2a 两同 intent agent click·观察锚【首个】(非终端) → fail-closed（关死「仅一观察锚非终端亦 ok」的 fail-open）；实得 ${brief(tFirst)}`);
  const tLast = card({ events: twoSameIntent, observations: [{ atom: 'agent.searchOpen', evidenceStepId: 'sa2' }] });
  assert(tLast.ok === true,
    `TA-2b 两同 intent agent click·观察锚【末个】(终端) → ok（正控·终端锚定绿）；实得 ${brief(tLast)}`);
}

// ════════════════ compile.mjs:376 消费面：终端 click + 零观察 → 基数门 fail-closed ════════════════
{
  // 直驱 bin/compile.mjs:376 消费的【真实同一函数】，镜像其调用形态 { events: run.events, observations: run.identityObservations }：
  //   一个 workflow.open 终端 click 已 emit（unique），identityObservations 停在空 → 基数门返 ok:false，compile 据
  //   !card.ok 分支（bin/compile.mjs:377-380）置 exitCode=65。本断言坐实【基数门函数本身】fail-closed（真生产码路径）。
  // ⚠ 进程级 exit 65 端到端真证需浏览器 replay 产（终端 click + 零观察）事件流——本环境禁浏览器/SUT，该端到端 =
  //   route:human（observability 项1 的 workflow-sut loop 浏览器金牌承担）。本金牌只坐实门函数判定，不冒充进程级实测。
  const runEvents = [{ stepId: 'atstep_0', intentId: 'intent_1', atom: 'workflow.open', action: 'click', text: 'wf' }];
  const runIdentityObservations = [];
  const c = card({ events: runEvents, observations: runIdentityObservations });
  assert(c.ok === false && c.reason === 'OBSERVATION_TERMINAL_WITHOUT_MATCHING_OBSERVATION',
    `RC-4 compile:376 消费面·终端 click + 零观察 → 基数门函数 fail-closed（compile 据 !card.ok 置 exit 65；进程级 exit route:human）；实得 ${brief(c)}`);
}

// ════════════════ 越供 / 未登记锚定 / 畸形 ════════════════
{
  // 越供同一终端：两观察锚【同一终端 stepId】→ evidenceStepId 重复，拒（终端锚定下真·越供只能撞重复门）。
  const over = card({ events: [
    { stepId: 's1', intentId: 'ic', atom: 'workflow.create', action: 'click' },
    { stepId: 's2', intentId: 'ic', atom: 'workflow.create', action: 'click' },
  ], observations: [
    { atom: 'workflow.create', evidenceStepId: 's2' },
    { atom: 'workflow.create', evidenceStepId: 's2' },
  ] });
  assert(over.ok === false && over.reason === 'OBSERVATION_EVIDENCE_STEP_DUPLICATE',
    `RC-5 越供·两观察锚同一终端 stepId → fail-closed（evidenceStepId 重复）；实得 ${brief(over)}`);

  // 观察缺自报 atom → 无从校验 atom 对应，拒。
  const noAtom = card({ events: [{ stepId: 's', intentId: 'i', atom: 'agent.searchOpen', action: 'click' }],
    observations: [{ evidenceStepId: 's' }] });
  assert(noAtom.ok === false && noAtom.reason === 'OBSERVATION_ATOM_MISSING',
    `RC-6 观察缺自报 atom → fail-closed；实得 ${brief(noAtom)}`);

  // 同 stepId 两 click（畸形）→ 拒。
  const dupClick = card({ events: [
    { stepId: 's', intentId: 'i', atom: 'agent.searchOpen', action: 'click' },
    { stepId: 's', intentId: 'i', atom: 'agent.searchOpen', action: 'click' },
  ], observations: [{ atom: 'agent.searchOpen', evidenceStepId: 's' }] });
  assert(dupClick.ok === false && dupClick.reason === 'OBSERVATION_CLICK_STEPID_DUPLICATE',
    `RC-7 同 stepId 两 click（畸形）→ fail-closed；实得 ${brief(dupClick)}`);
}

// ════════════════ 正向零回归：agent happy path + workflow 多 click 单终端不误杀 ════════════════
{
  // agent happy path（fill/press/click 同 intent i，唯 click 终端）+ 1 观察 → ok（严等旧 agent 门，byte 面零漂移）。
  const agentEvents = [
    { stepId: 's_fill', intentId: 'i', atom: 'agent.searchOpen', action: 'fill' },
    { stepId: 's_press', intentId: 'i', atom: 'agent.searchOpen', action: 'press' },
    { stepId: 's_click', intentId: 'i', atom: 'agent.searchOpen', action: 'click' },
  ];
  const agentOk = card({ events: agentEvents, observations: [{ atom: 'agent.searchOpen', evidenceStepId: 's_click' }] });
  assert(agentOk.ok === true,
    `RC-8 agent happy path（单 intent 单终端 click 单观察）→ ok（零回归，严等原 agent 门）；实得 ${brief(agentOk)}`);

  // 两独立 agent 步（各 intent）各一观察 → ok（反向基数逐终端满足）。
  const twoAgents = card({ events: [
    { stepId: 'a1_click', intentId: 'ia1', atom: 'agent.searchOpen', action: 'click' },
    { stepId: 'a2_click', intentId: 'ia2', atom: 'agent.searchOpen', action: 'click' },
  ], observations: [
    { atom: 'agent.searchOpen', evidenceStepId: 'a1_click' },
    { atom: 'agent.searchOpen', evidenceStepId: 'a2_click' },
  ] });
  assert(twoAgents.ok === true,
    `RC-9 两独立 agent 步各一观察 → ok（反向基数逐终端满足）；实得 ${brief(twoAgents)}`);

  // workflow.create 单步多 click（新增/描述/确认同 iCreate，唯确认武装）+ 1 观察锚确认 → ok（多 click 收敛单终端，不误杀）。
  const wfCreateEvents = [
    { stepId: 'w_nav', intentId: 'ic', atom: 'workflow.create', action: 'nav' },
    { stepId: 'w_newbtn', intentId: 'ic', atom: 'workflow.create', action: 'click' },
    { stepId: 'w_fill', intentId: 'ic', atom: 'workflow.create', action: 'fill' },
    { stepId: 'w_cat', intentId: 'ic', atom: 'workflow.create', action: 'click' },
    { stepId: 'w_confirm', intentId: 'ic', atom: 'workflow.create', action: 'click' },
  ];
  const wfCreateOk = card({ events: wfCreateEvents, observations: [{ atom: 'workflow.create', evidenceStepId: 'w_confirm' }] });
  assert(wfCreateOk.ok === true,
    `RC-10 workflow.create 单步多 click 单观察锚确认（收敛单终端）→ ok（反向不误杀多 click 流）；实得 ${brief(wfCreateOk)}`);

  // 未登记原子 click（workflow.saveDraft）无身份义务 + 0 观察 → ok（孤儿 policy 不被索要观察，D4 不误拒）。
  const orphanNoObs = card({ events: [{ stepId: 'sd', intentId: 'i', atom: 'workflow.saveDraft', action: 'click' }], observations: [] });
  assert(orphanNoObs.ok === true,
    `RC-11 未登记原子 click（saveDraft）+ 0 观察 → ok（孤儿 policy 无身份义务，不误拒）；实得 ${brief(orphanNoObs)}`);
}

if (failures.length) {
  for (const f of failures) console.error(`RED  cardinality-reverse: ${f}`);
  console.error(`RED  cardinality-reverse: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   entity-workflow-source-readback.cardinality-reverse: ${passed}/${passed} 全过（真实基数门直驱：反向双射 + 显式终端锚定 fail-closed，agent 零回归 + workflow 多 click 不误杀，零 SUT）`);
