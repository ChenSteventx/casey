#!/usr/bin/env node
// teachin-nav-expansion-recipe：真机侧栏默认折叠导致的「展开组（智能应用）→ 点条目
// （工作流管理）」两击导航，必须被确定性配方解析为单个 nav.workflowManagement 单元。
// 纯内存、零 browser/SUT/network/LLM。
// 夹具取 2026-07-29 采形状包（tc_wf_list_smoke 134930）的两事件形状脱敏重表达：
// 只重表达 selector/text/动作序列的形状，不搬真机坐标（x/y/ox/oy）与真机路径真值。
//
// 规格来源：docs/plans/teachin-nav-expansion-recipe/GRILL.md v2（codex 计划审 r1
// 双 High 推翻初版松匹配方案，改取槽位约束）：
//   D1/D3 配方带 slots（槽 0 菜单组白名单=智能应用、槽 1 条目白名单=流程管理/工作流管理），
//         matchesAt 对带槽配方逐位校验语义文本，无槽配方零变化；
//   D6    resolveCaptureAtoms 可选 boundIntents（Set<eventSeq>）跨 authored intent 防合并；
//   D7    nav 家族配方唯一登记家=BUILTIN_RECIPES，注册表重复登记由歧义信号大声暴露；
//   D4    行为钉 N1-N8（本文件逐条实现）。
// plan §1/§2 v3 增补（codex delta 复审）：boundIntents 入参与成员校验（N8 新两限）、
// 带槽配方的 authored intent 绑定只认末槽（N9 负钉）、绑定投影路
// resolveCaptureProjection 同样须传绑定集（N10 接线钉）。
// 红绿分布预期：N1/N5/N7/N8/N9/N10 修前红；N2/N3/N4/N6 修前绿且修后必须仍绿
// （后四条钉的是新配方不得破坏的既有语义与假绿封锁）。

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import atomRegistry from '../../lib/atoms-registry.snapshot.json' with { type: 'json' };
import { projectCaptureEvents } from '../../lib/teachin-distillation/event-projection.mjs';
import {
  atomAcceptsActionSequence,
  collectRecipes,
  resolveCaptureAtoms,
} from '../../lib/teachin-distillation/atom-resolution.mjs';
import { generateKnownReadOnlyCycleInput } from '../../lib/teachin/cycle-plan-generator.mjs';
import { admitRawReplayCapture } from '../../lib/teachin/raw-capture.mjs';
import {
  authorizeFreshReplayRuntime,
  createFreshReplayWitness,
} from '../../lib/teachin/fresh-runtime.mjs';
import { runRawReplay } from '../../lib/teachin/raw-replay-runner.mjs';
import { resolveCaptureProjection } from '../../lib/teachin/resolved-projection.mjs';
import { resolveExecutionTarget } from '../../lib/execution-target/authority.mjs';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const TAG = 'teachin-nav-expansion-recipe';
const failures = [];
let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${TAG}: ${name}`);
  } catch (error) {
    const detail = String(error?.message || error).slice(-900);
    failures.push(`${name}: ${detail}`);
    console.error(`RED  ${TAG}: ${name}: ${detail}`);
  }
}

const CASE_ID = 'tc_wf_list_smoke';
const LIST_PATH = '/app/member/list';
const SINGLE_RULE_ID = 'known-nav-workflow-management';
// 组头（可展开的一级菜单项）与二级条目的选择器形状：真机菜单框架的层级类名，无坐标、无身份。
const GROUP_SELECTOR = 'div.hr-default-menu__inner > ul.hr-menu'
  + ' > li.hr-submenu:nth-of-type(4) > div.hr-menu__item';
const ITEM_SELECTOR = 'ul.hr-menu > li.hr-submenu:nth-of-type(4)'
  + ' > ul.hr-menu__sub > li.hr-menu__item:nth-of-type(3)';

function captureDoc(events) {
  return {
    schemaVersion: 1,
    artifactKind: 'teach-in-capture',
    caseId: CASE_ID,
    createdAt: '2026-07-29T09:00:00.000Z',
    startPath: LIST_PATH,
    source: {
      kind: 'manual',
      signed: false,
      replayReady: false,
      distillRequired: true,
    },
    events,
  };
}

function toBytes(doc) {
  return Buffer.from(JSON.stringify(doc, null, 2) + '\n', 'utf8');
}

// 首击：展开「智能应用」组。text 传 null 即模拟无语义文本的组头（fail-closed 钉用）。
function groupExpandClick(seq, text = '智能应用') {
  const event = {
    seq, action: 'click', path: LIST_PATH, selector: GROUP_SELECTOR, tagName: 'div',
  };
  if (text !== null) event.text = text;
  return event;
}

// 次击：点二级条目「工作流管理」。
function itemClick(seq) {
  return {
    seq,
    action: 'click',
    path: LIST_PATH,
    selector: ITEM_SELECTOR,
    text: '工作流管理',
    tagName: 'li',
  };
}

// 与 nav 配方白名单都无关的业务点击（槽 0 白名单外）。
function unrelatedClick(seq, text = '任意按钮') {
  const event = {
    seq, action: 'click', path: LIST_PATH, selector: '#unrelated-button', tagName: 'button',
  };
  if (text !== null) event.text = text;
  return event;
}

function projectionOf(events, intentIdBySeq) {
  const request = { capture: captureDoc(events) };
  if (intentIdBySeq !== undefined) request.intentIdBySeq = intentIdBySeq;
  const projection = projectCaptureEvents(request);
  assert(projection?.ok === true,
    `投影应成功（装具前提，非被测语义）：${JSON.stringify(projection)}`);
  return projection.projection;
}

function resolveRaw(events, options = {}) {
  const { registry = atomRegistry, intentIdBySeq, boundIntents } = options;
  const request = { projection: projectionOf(events, intentIdBySeq), registry };
  // 「不传 boundIntents」限必须是键真缺席，不能塞 undefined。
  if (boundIntents !== undefined) request.boundIntents = boundIntents;
  return resolveCaptureAtoms(request);
}

function resolveShape(events, options = {}) {
  const resolution = resolveRaw(events, options);
  assert(resolution?.ok === true,
    `解析应成功（装具前提，非被测语义）：${JSON.stringify(resolution)}`);
  return resolution;
}

function digest(resolution) {
  return JSON.stringify({
    resolved: resolution.resolved.map((unit) => ({
      atom: unit.atom,
      ruleId: unit.ruleId,
      intentId: unit.intentId,
      evidenceEventSeqs: [...unit.evidenceEventSeqs],
    })),
    pending: resolution.pending.map((row) => ({
      eventSeq: row.eventSeq, intentId: row.intentId, reason: row.reason,
    })),
    structuralCount: resolution.structural.length,
  });
}

// 手造 registry：把同形 teachinRecipes 注入某个已登记 atom，用来钉配方碰撞治理（GRILL D7）。
// 只改内存副本，绝不动仓内 snapshot 生成物。
function registryWithRecipe(atom, recipe) {
  const registry = structuredClone(atomRegistry);
  registry.atoms[atom] = { ...registry.atoms[atom], teachinRecipes: [recipe] };
  return registry;
}

function groupedRegistryRecipe({ ruleId, atom, slots }) {
  return {
    ruleId,
    match: {
      actions: ['click', 'click'],
      requiresSemanticEvidence: true,
      slots,
    },
    emit: { atom, params: {} },
  };
}

const execution = resolveExecutionTarget({
  runtime: { platform: 'linux', isWSL: false },
  logicalTarget: { startUrl: 'https://nav-expansion.invalid/app/member/list' },
  transport: { mode: 'direct' },
  requiresOriginContinuity: true,
});
assert(execution?.ok === true && execution.authority,
  `合成 execution authority 应成功（装具前提）：${JSON.stringify(execution)}`);

function emitterDouble(extra = {}) {
  const listeners = new Map();
  return {
    ...extra,
    on(event, handler) {
      listeners.set(event, [...(listeners.get(event) || []), handler]);
    },
    emit(event) {
      for (const handler of listeners.get(event) || []) handler();
    },
  };
}

// N10 装具：照抄 teachin-replayability-resolved-projection 的能力铸造链
// （准入 capture → 录制 runtime 见证并关闭 → 第二 runtime 授权 → 真跑 runRawReplay 取 CLEAN 证明），
// 绝不手造假句柄绕过 capability。
async function cleanAuthorities(events) {
  const admitted = admitRawReplayCapture({
    caseId: CASE_ID,
    captureBytes: toBytes(captureDoc(events)),
  });
  assert(admitted?.ok === true && admitted.captureAuthority,
    `capture 准入失败（装具前提）：${JSON.stringify(admitted)}`);

  const topologyAuthority = Object.freeze({
    activePageAuthority: () => Object.freeze(Object.create(null)),
    async consumeNewPageEvent() {
      return { ok: false, reason: 'TOPOLOGY_EVENT_INVALID' };
    },
  });

  let recordingConnected = true;
  const recordingBrowser = emitterDouble({ isConnected: () => recordingConnected });
  const recordingContext = emitterDouble({ browser: () => recordingBrowser });
  const witnessed = createFreshReplayWitness({ recordingBrowser, recordingContext });
  assert(witnessed?.ok === true && witnessed.witness,
    `fresh witness 创建失败（装具前提）：${JSON.stringify(witnessed)}`);
  recordingContext.emit('close');
  recordingConnected = false;
  recordingBrowser.emit('disconnected');

  const replayBrowser = emitterDouble({ isConnected: () => true });
  const replayContext = emitterDouble({ browser: () => replayBrowser });
  const replayPage = emitterDouble({
    context: () => replayContext,
    isClosed: () => false,
  });
  const authorized = authorizeFreshReplayRuntime({
    witness: witnessed.witness,
    replayBrowser,
    replayContext,
    replayPage,
    topologyAuthority,
  });
  assert(authorized?.ok === true && authorized.freshRuntimeAuthority,
    `fresh runtime 授权失败（装具前提）：${JSON.stringify(authorized)}`);

  const actionGates = new WeakMap();
  const replayed = await runRawReplay({
    captureAuthority: admitted.captureAuthority,
    freshRuntimeAuthority: authorized.freshRuntimeAuthority,
    topologyAuthority,
    executionTargetAuthority: execution.authority,
    actionDriver: {
      async readActivePath() {
        return LIST_PATH;
      },
      async resolve({ event }) {
        const actionAuthority = Object.freeze(Object.create(null));
        actionGates.set(actionAuthority, event);
        return { resolution: 'unique', candidateCount: 1, actionAuthority };
      },
      async perform({ actionAuthority }) {
        assert(actionGates.get(actionAuthority),
          'perform 必须消费对应 resolve 铸造的 authority');
        actionGates.delete(actionAuthority);
        return { ok: true, identityReadback: { ok: true } };
      },
      async goto() {
        throw new Error('RAW_NAV_MUST_NOT_GOTO');
      },
    },
  });
  assert(replayed?.ok === true && replayed.status === 'CLEAN' && replayed.cleanProofAuthority,
    `raw 正控必须 CLEAN（装具前提）：${JSON.stringify(replayed)}`);
  return {
    captureAuthority: admitted.captureAuthority,
    cleanProofAuthority: replayed.cleanProofAuthority,
  };
}

await check('N1 正钉：真机形状两击（组展开+条目）解析为单个 nav.workflowManagement', () => {
  const resolution = resolveShape([groupExpandClick(1), itemClick(2)]);
  assert(resolution.pending.length === 0,
    `两击导航不得留 pending（现状 seq1 KNOWN_RECIPE_MISSING）：${digest(resolution)}`);
  assert(resolution.structural.length === 0,
    `同页两击不应产生 structural 事件：${digest(resolution)}`);
  assert(resolution.resolved.length === 1,
    `两击必须收敛为恰一个解析单元：${digest(resolution)}`);
  const unit = resolution.resolved[0];
  assert(unit.atom === 'nav.workflowManagement',
    `解析单元 atom 应为 nav.workflowManagement：${digest(resolution)}`);
  assert(unit.evidenceEventSeqs.join(',') === '1,2',
    `evidenceEventSeqs 必须精确覆盖两击 [1,2]：${digest(resolution)}`);
  assert(unit.resolution === 'known',
    `两击导航必须走确定性 known 路径：${digest(resolution)}`);
  // GRILL D3：intentId 取跨度首事件（authored 侧维持单步不变）。
  assert(unit.intentId === 'i1',
    `intentId 应取跨度首事件（合成序数 i1）：${digest(resolution)}`);
  assert(JSON.stringify(unit.params) === '{}',
    `导航原子零参数：${digest(resolution)}`);
  // 下游 mapping 行的动作序列契约必须认这条两击证据，否则解析单元下游不可用。
  assert(atomAcceptsActionSequence(
    collectRecipes(atomRegistry), 'nav.workflowManagement', ['click', 'click'],
  ), 'nav.workflowManagement 必须接受 [click, click] 动作序列');
});

await check('N2 回归钉：单击直达（组已展开）仍由原单击配方吃、ruleId 不变', () => {
  const resolution = resolveShape([itemClick(1)]);
  assert(resolution.pending.length === 0,
    `单击直达不得回归出 pending：${digest(resolution)}`);
  assert(resolution.resolved.length === 1,
    `单击直达必须恰一解析单元：${digest(resolution)}`);
  const unit = resolution.resolved[0];
  assert(unit.atom === 'nav.workflowManagement' && unit.ruleId === SINGLE_RULE_ID,
    `单击直达必须仍命中原配方 ${SINGLE_RULE_ID}：${digest(resolution)}`);
  assert(unit.evidenceEventSeqs.join(',') === '1',
    `单击直达证据仅一事件：${digest(resolution)}`);
});

await check('N3 不吸收钉（v2 翻转）：槽 0 白名单外的首击不得被两击配方吞掉', () => {
  // GRILL D1 v2：初版松匹配的「等价兜底」论证被 codex r1 H1 实锤不成立——闭环 expected
  // 空断言 + 双回放不比动作序列，被吸收的无关首击两侧都成功即产技术等价假绿。
  // 槽位约束把这条假绿路封死：首击文本不在槽 0 白名单（智能应用）即整条不匹配。
  // 本钉修前修后都必须绿：它钉的是新配方不得引入的吸收语义，不是待实现的新行为。
  const resolution = resolveShape([unrelatedClick(1), itemClick(2)]);
  assert(resolution.resolved.length === 1 && resolution.pending.length === 1,
    `无关首击必须落 pending、不得与条目击合并：${digest(resolution)}`);
  const stuck = resolution.pending[0];
  assert(stuck.eventSeq === 1 && stuck.reason === 'KNOWN_RECIPE_MISSING',
    `pending 应为 seq1 / KNOWN_RECIPE_MISSING：${digest(resolution)}`);
  const unit = resolution.resolved[0];
  assert(unit.atom === 'nav.workflowManagement'
    && unit.ruleId === SINGLE_RULE_ID
    && unit.evidenceEventSeqs.join(',') === '2',
  `条目击应由单击配方独立解析、证据仅 [2]：${digest(resolution)}`);
});

await check('N4 fail-closed 钉：首击无语义文本 → 首击 pending、次击照常 resolved', () => {
  // 不变量：修前修后都必须绿。无语义文本的首击不得被两击配方吞掉
  // （requiresSemanticEvidence 逐位生效、带槽后槽 0 更无从命中），诚实转人工优于静默吞事件。
  const resolution = resolveShape([groupExpandClick(1, null), itemClick(2)]);
  assert(resolution.pending.length === 1,
    `无语义文本首击必须留 pending：${digest(resolution)}`);
  const stuck = resolution.pending[0];
  assert(stuck.eventSeq === 1 && stuck.reason === 'KNOWN_RECIPE_MISSING',
    `pending 应为 seq1 / KNOWN_RECIPE_MISSING：${digest(resolution)}`);
  assert(resolution.resolved.length === 1,
    `次击仍应独立解析：${digest(resolution)}`);
  const unit = resolution.resolved[0];
  assert(unit.atom === 'nav.workflowManagement'
    && unit.ruleId === SINGLE_RULE_ID
    && unit.evidenceEventSeqs.join(',') === '2',
  `次击应由单击配方吃、证据仅 [2]：${digest(resolution)}`);

  // 限二（grok code-r1 F3）：畸形投影行（缺 evidence / evidence 非对象）不得让解析抛异常，
  // 必须按「无语义证据」诚实落 pending。手造投影行直喂，绕开 projectCaptureEvents。
  for (const broken of [undefined, null, 'evidence', 42, []]) {
    const row = {
      compoundKey: '1:click',
      intentId: 'i1',
      eventSeq: 1,
      action: 'click',
      pathHint: LIST_PATH,
      role: 'business',
      semanticText: '工作流管理',
    };
    if (broken !== undefined) row.evidence = broken;
    let malformed;
    try {
      malformed = resolveCaptureAtoms({ projection: [row], registry: atomRegistry });
    } catch (error) {
      throw new Error(`畸形投影行不得抛异常（evidence=${JSON.stringify(broken) ?? 'undefined'}）：${error?.message}`);
    }
    assert(malformed?.ok === true && malformed.resolved.length === 0
      && malformed.pending.length === 1
      && malformed.pending[0].eventSeq === 1
      && malformed.pending[0].reason === 'KNOWN_RECIPE_MISSING',
    `畸形投影行必须落 pending（evidence=${JSON.stringify(broken) ?? 'undefined'}）：${JSON.stringify(malformed)}`);
  }
});

function generateCycleInput({ testcaseBytes, expectedBytes }) {
  return generateKnownReadOnlyCycleInput({
    atomRegistry,
    captureBytes: toBytes(captureDoc([groupExpandClick(1), itemClick(2)])),
    caseId: CASE_ID,
    channelProfileBytes: Buffer.from('{"profile":"zero-sut"}', 'utf8'),
    entityLockBytes: Buffer.from('[]', 'utf8'),
    executionTargetAuthority: execution.authority,
    expectedBytes,
    replayKernelBytes: Buffer.from('{"kernel":"probe"}', 'utf8'),
    sutBuildDigest: `sha256:${'a'.repeat(64)}`,
    testcaseBytes,
  });
}

await check('N5 端到端：真机形状 capture 过 generateKnownReadOnlyCycleInput 出单行 mappingCandidate', () => {
  // 开发期候选的 authored / expected 形（钦定形状见 review-hardening 金牌 H1）：仓内真文件字节。
  const testcaseBytes = readFileSync(resolve(ROOT, 'cases/tc_wf_list_smoke/cycle-testcase.json'));
  const expectedBytes = readFileSync(resolve(ROOT, 'cases/tc_wf_list_smoke/cycle-expected.json'));

  const generated = generateCycleInput({ testcaseBytes, expectedBytes });
  assert(generated?.ok === true,
    `两击真机形状必须能出 cycle input（现状 CYCLE_PLAN_MAPPING_REQUIRED）：${JSON.stringify(generated)}`);
  const mappingCandidate = generated.cycleInput?.projection?.mappingCandidate;
  assert(Array.isArray(mappingCandidate) && mappingCandidate.length === 1,
    `mappingCandidate 必须恰一行：${JSON.stringify(mappingCandidate)}`);
  const row = mappingCandidate[0];
  assert(row.intentId === 'intent_nav_wf',
    `mappingCandidate 行必须绑 authored intent intent_nav_wf：${JSON.stringify(row)}`);
  assert(row.atom === 'nav.workflowManagement',
    `mappingCandidate 行 atom 应为 nav.workflowManagement：${JSON.stringify(row)}`);
  assert(row.evidenceEventSeqs.join(',') === '1,2',
    `mappingCandidate 行证据应覆盖两击 [1,2]：${JSON.stringify(row)}`);
  assert(JSON.stringify(row.params) === '{}',
    `mappingCandidate 行零参数：${JSON.stringify(row)}`);
});

await check('N6 反向吞并封死钉：条目文本首击不得把后继事件卷进跨度', () => {
  // codex r1 H2：松匹配下「流程管理文本击 + 后继事件」因跨度任一命中被整体吸收，
  // 破坏 teachin-replayability-resolved-projection 冻结金牌的「首击 resolved、次击 pending」
  // 既有语义。槽位约束下条目文本只在槽 1 有效、槽 0 命不中，跨度整条不匹配。
  // 本钉修前修后都必须绿（既有冻结接缝，复现不另造）。
  const itemTextClick = (seq) => ({
    seq,
    action: 'click',
    path: LIST_PATH,
    selector: '#process-entry',
    text: '流程管理',
    tagName: 'li',
  });

  // 限一：次击是未登记动作（press）——复现 resolved-projection P8 冻结夹具形状。
  const unsupported = resolveShape([
    itemTextClick(1),
    { seq: 2, action: 'press', path: LIST_PATH, selector: '#search', key: 'Escape' },
  ]);
  assert(unsupported.resolved.length === 1
    && unsupported.resolved[0].ruleId === SINGLE_RULE_ID
    && unsupported.resolved[0].evidenceEventSeqs.join(',') === '1',
  `首击必须由单击配方独立 resolved、证据仅 [1]：${digest(unsupported)}`);
  assert(unsupported.pending.length === 1
    && unsupported.pending[0].eventSeq === 2
    && unsupported.pending[0].reason === 'UNSUPPORTED_ACTION',
  `未登记动作次击必须保持 pending / UNSUPPORTED_ACTION：${digest(unsupported)}`);

  // 限二：次击是已登记动作但无关元素——松匹配真会吞的形态（动作序列对得上）。
  const unrelatedNext = resolveShape([itemTextClick(1), unrelatedClick(2)]);
  assert(unrelatedNext.resolved.length === 1
    && unrelatedNext.resolved[0].ruleId === SINGLE_RULE_ID
    && unrelatedNext.resolved[0].evidenceEventSeqs.join(',') === '1',
  `首击必须由单击配方独立 resolved、不得把无关次击卷进跨度：${digest(unrelatedNext)}`);
  assert(unrelatedNext.pending.length === 1
    && unrelatedNext.pending[0].eventSeq === 2
    && unrelatedNext.pending[0].reason === 'KNOWN_RECIPE_MISSING',
  `无关次击必须保持 pending / KNOWN_RECIPE_MISSING：${digest(unrelatedNext)}`);
});

await check('N7 配方碰撞钉：注册表重复登记必须大声歧义、非法槽形状整条弃用', () => {
  // GRILL D7：nav 家族配方唯一登记家=BUILTIN_RECIPES，注册表不得重复登记同 atom 导航配方；
  // 违者由 KNOWN_RECIPE_AMBIGUOUS 大声暴露，绝不静默择优。
  const events = [groupExpandClick(1), itemClick(2)];
  const groupedSlots = [{ textAnyOf: ['智能应用'] }, { textAnyOf: ['流程管理', '工作流管理'] }];

  // 限一：注册表精确重复登记 builtin 双击配方。
  const duplicate = resolveShape(events, {
    registry: registryWithRecipe('nav.workflowManagement', groupedRegistryRecipe({
      ruleId: 'registry-duplicate-grouped',
      atom: 'nav.workflowManagement',
      slots: groupedSlots,
    })),
  });
  assert(duplicate.pending.length === 1
    && duplicate.pending[0].eventSeq === 1
    && duplicate.pending[0].reason === 'KNOWN_RECIPE_AMBIGUOUS',
  `精确重复登记必须判 KNOWN_RECIPE_AMBIGUOUS、不得静默择优：${digest(duplicate)}`);
  assert(!duplicate.resolved.some((unit) => unit.evidenceEventSeqs.includes(1)),
    `歧义事件不得同时进 resolved：${digest(duplicate)}`);

  // 限二：等长异 atom 槽重叠（另一 nav 原子声明同长且槽面重叠的配方）。
  const overlapping = resolveShape(events, {
    registry: registryWithRecipe('nav.agentManagement', groupedRegistryRecipe({
      ruleId: 'registry-overlapping-grouped',
      atom: 'nav.agentManagement',
      slots: [{ textAnyOf: ['智能应用'] }, { textAnyOf: ['工作流管理'] }],
    })),
  });
  assert(overlapping.pending.length === 1
    && overlapping.pending[0].eventSeq === 1
    && overlapping.pending[0].reason === 'KNOWN_RECIPE_AMBIGUOUS',
  `等长异 atom 槽重叠必须判 KNOWN_RECIPE_AMBIGUOUS：${digest(overlapping)}`);
  assert(!overlapping.resolved.some((unit) => unit.atom === 'nav.agentManagement'),
    `歧义时不得择一 atom 出单元：${digest(overlapping)}`);

  // 限三：槽形状非法（槽数 ≠ actions 数）→ normalizeRegistryRecipe 整条弃用（fail-closed），
  // 绝不退化成「忽略 slots 的松匹配配方」偷偷参与匹配。
  const malformed = collectRecipes(registryWithRecipe('nav.workflowManagement',
    groupedRegistryRecipe({
      ruleId: 'registry-malformed-slots',
      atom: 'nav.workflowManagement',
      slots: [{ textAnyOf: ['智能应用'] }],
    })));
  assert(!malformed.some((recipe) => recipe.ruleId === 'registry-malformed-slots'),
    `槽数与 actions 数不等的注册表配方必须整条弃用：${JSON.stringify(
      malformed.map((recipe) => recipe.ruleId))}`);

  // —— 限四/限五（codex code-r1 F1，ruleId 影子劫持）——
  // ruleId 是配方身份，下游 semanticIntentMatches 按 ruleId 反查配方取语义标签。
  // 注册表若用 builtin 的 ruleId 登记一条只吃「任意按钮」的单击影子配方，影子命中、
  // 标签却查到真配方，authored intent 写「进入工作流管理」就能在空断言下产语义错绑假绿。
  const shadowRegistry = registryWithRecipe('nav.workflowManagement', {
    ruleId: 'known-nav-workflow-management-grouped',
    match: {
      actions: ['click'],
      requiresSemanticEvidence: true,
      textAnyOf: ['任意按钮'],
    },
    emit: { atom: 'nav.workflowManagement', params: {} },
  });

  // 限四：重名影子配方整条不得参与匹配——「任意按钮」单击仍诚实 pending。
  const shadowed = resolveShape([unrelatedClick(1)], { registry: shadowRegistry });
  assert(shadowed.resolved.length === 0 && shadowed.pending.length === 1
    && shadowed.pending[0].eventSeq === 1
    && shadowed.pending[0].reason === 'KNOWN_RECIPE_MISSING',
  `复用 builtin ruleId 的影子配方不得参与匹配：${digest(shadowed)}`);
  const collected = collectRecipes(shadowRegistry)
    .filter((recipe) => recipe.ruleId === 'known-nav-workflow-management-grouped');
  assert(collected.length === 1 && collected[0].actions.join(',') === 'click,click',
    `重名 ruleId 只许留 builtin 权威条：${JSON.stringify(
      collected.map((recipe) => recipe.actions))}`);

  // 限五：codex 反例端到端——影子配方在场时，「任意按钮」capture 配「进入工作流管理」
  // authored intent 必须拒付，绝不许出 cycle input。
  const forged = generateKnownReadOnlyCycleInput({
    atomRegistry: shadowRegistry,
    captureBytes: toBytes(captureDoc([unrelatedClick(1)])),
    caseId: CASE_ID,
    channelProfileBytes: Buffer.from('{"profile":"zero-sut"}', 'utf8'),
    entityLockBytes: Buffer.from('[]', 'utf8'),
    executionTargetAuthority: execution.authority,
    expectedBytes: Buffer.from(JSON.stringify({
      caseId: CASE_ID,
      intents: [{ intentId: 'intent_nav_wf', expected: [] }],
      globalAssertions: [],
    }), 'utf8'),
    replayKernelBytes: Buffer.from('{"kernel":"probe"}', 'utf8'),
    sutBuildDigest: `sha256:${'a'.repeat(64)}`,
    testcaseBytes: Buffer.from(JSON.stringify({
      schemaVersion: 1,
      caseId: CASE_ID,
      steps: [{ intentId: 'intent_nav_wf', intent: '进入工作流管理' }],
    }), 'utf8'),
  });
  assert(forged?.ok !== true,
    `影子配方语义错绑必须整条拒付、不得出 cycle input：${JSON.stringify(forged)}`);
});

await check('N8 防合并钉：boundIntents 声明的跨 authored intent 两击不得合并', () => {
  // GRILL D6（codex r1 M4）：resolveCaptureAtoms 可选 boundIntents（Set<eventSeq>），
  // 调用方声明哪些事件的 intentId 是 authored 绑定而非合成序数。多击跨度内含任一已绑定事件
  // 且跨度 intentId 不一致 → 该配方按不匹配处理（fail-closed 落 pending）。
  const events = [groupExpandClick(1), itemClick(2)];
  const splitIntents = new Map([[1, 'intent_open_group'], [2, 'intent_nav_wf']]);
  const sameIntent = new Map([[1, 'intent_nav_wf'], [2, 'intent_nav_wf']]);

  // 限一：两击分属两个 authored intent 且被声明绑定 → 不合并、各自落位。
  const guarded = resolveShape(events, {
    intentIdBySeq: splitIntents,
    boundIntents: new Set([1, 2]),
  });
  assert(guarded.resolved.length === 1 && guarded.pending.length === 1,
    `跨 authored intent 的两击不得合并：${digest(guarded)}`);
  assert(guarded.pending[0].eventSeq === 1
    && guarded.pending[0].reason === 'KNOWN_RECIPE_MISSING',
  `被守卫拦下的首击应 fail-closed 落 pending：${digest(guarded)}`);
  assert(guarded.resolved[0].evidenceEventSeqs.join(',') === '2'
    && guarded.resolved[0].intentId === 'intent_nav_wf'
    && guarded.resolved[0].ruleId === SINGLE_RULE_ID,
  `次击应按自己的 authored intent 独立解析：${digest(guarded)}`);

  // 限二：同样的分裂 intentId，但不传 boundIntents → 默认语义零变化（照常合并）。
  // 守卫是显式声明才生效的，首轮合成标签 i1/i2 不受影响。
  const unguarded = resolveShape(events, { intentIdBySeq: splitIntents });
  assert(unguarded.pending.length === 0 && unguarded.resolved.length === 1
    && unguarded.resolved[0].evidenceEventSeqs.join(',') === '1,2'
    && unguarded.resolved[0].intentId === 'intent_open_group',
  `不传 boundIntents 时必须与 N1 合并语义全等：${digest(unguarded)}`);

  // 限三：绑定集在场但跨度 intentId 一致 → 照常合并。这是 cycle-plan-generator 第二遍
  // 重绑投影的真实路径（两击同绑 intent_nav_wf），守卫不得误伤，否则 N5 端到端必红。
  const consistent = resolveShape(events, {
    intentIdBySeq: sameIntent,
    boundIntents: new Set([1, 2]),
  });
  assert(consistent.pending.length === 0 && consistent.resolved.length === 1
    && consistent.resolved[0].evidenceEventSeqs.join(',') === '1,2'
    && consistent.resolved[0].intentId === 'intent_nav_wf',
  `同 authored intent 的两击必须照常合并（守卫不得误伤）：${digest(consistent)}`);

  // 限四（v3，codex delta 裁定②）：boundIntents 非 Set 一律 fail-closed 拒付，
  // 不许类型错配（数组/普通对象/字符串）静默滑过成「守卫没生效」。
  for (const bad of [[1, 2], { 1: true }, 'set', 12, new Map([[1, 'a']])]) {
    const denied = resolveRaw(events, { intentIdBySeq: splitIntents, boundIntents: bad });
    assert(denied?.ok === false && denied.reason === 'UNSAFE_DATA_SHAPE',
      `非 Set 的 boundIntents 必须拒 UNSAFE_DATA_SHAPE（类型=${typeof bad}）：${JSON.stringify(denied)}`);
  }

  // 限五（v3）：Set 成员须正安全整数——脏成员同拒，防「看似是 Set 就放行」。
  for (const dirty of [0, -1, 'x', 1.5, null, Number.NaN]) {
    const denied = resolveRaw(events, {
      intentIdBySeq: splitIntents,
      boundIntents: new Set([1, dirty]),
    });
    assert(denied?.ok === false && denied.reason === 'UNSAFE_DATA_SHAPE',
      `boundIntents 含脏成员必须拒 UNSAFE_DATA_SHAPE（成员=${String(dirty)}）：${JSON.stringify(denied)}`);
  }

  // 限六（v4，codex r3 delta 末条 Medium）：正安全整数但不在本次投影业务事件 eventSeq 集内的
  // 幽灵成员同拒。放行幽灵成员＝调用方以为声明了绑定、守卫却全程空转（静默失守）。
  for (const ghost of [new Set([999]), new Set([1, 999])]) {
    const denied = resolveRaw(events, { intentIdBySeq: splitIntents, boundIntents: ghost });
    assert(denied?.ok === false && denied.reason === 'UNSAFE_DATA_SHAPE',
      `boundIntents 含投影外幽灵 seq 必须拒 UNSAFE_DATA_SHAPE（集=${JSON.stringify([...ghost])}）：${JSON.stringify(denied)}`);
  }

  // —— 限七/限八/限九（codex code-r1 F2，Set 方法覆写绕守卫）——
  // 守卫读成员若走实例方法，覆写 has 即可让「含已绑定事件」判定恒假、两击被重新合并。
  // 合法但被做过手脚的容器：守卫必须仍生效（成员只经原生 Set 方法读取）；
  // 缺 [[SetData]] 内部槽的伪装容器（Proxy）：整体拒付。
  // 合法 Set（含子类）必须**放行**且守卫真生效：只断言「要么拒付要么生效」会让
  // 「一律拒绝所有子类」的实现也蒙混过关，等于没冻住策略（code-r1 delta 收紧）。
  function expectGuardStillHolds(boundIntents, label) {
    const guarded = resolveRaw(events, { intentIdBySeq: splitIntents, boundIntents });
    assert(guarded?.ok === true,
      `${label}：合法 Set 必须放行、不得整体拒付：${JSON.stringify(guarded)}`);
    assert(guarded.resolved.length === 1 && guarded.pending.length === 1
      && guarded.pending[0].eventSeq === 1
      && guarded.pending[0].reason === 'KNOWN_RECIPE_MISSING'
      && guarded.resolved[0].evidenceEventSeqs.join(',') === '2'
      && guarded.resolved[0].intentId === 'intent_nav_wf',
    `${label}：守卫必须仍生效（不得被覆写绕过重新合并）：${digest(guarded)}`);
  }

  // 限七：合法 Set 实例被覆写 has。
  const overridden = new Set([1, 2]);
  overridden.has = () => false;
  expectGuardStillHolds(overridden, '覆写实例 has 的 Set');

  // 限八：Set 子类重写 has（原型链层面的覆写）。
  class ForgedSet extends Set {
    has() { return false; }
  }
  expectGuardStillHolds(new ForgedSet([1, 2]), 'Set 子类重写 has');

  // 限九：Proxy 伪装 Set——缺内部槽，必须整体拒付。
  const proxied = new Proxy(new Set([1, 2]), {
    get(target, key, receiver) {
      if (key === 'has') return () => false;
      const value = Reflect.get(target, key, receiver);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const proxyDenied = resolveRaw(events, { intentIdBySeq: splitIntents, boundIntents: proxied });
  assert(proxyDenied?.ok === false && proxyDenied.reason === 'UNSAFE_DATA_SHAPE',
    `Proxy 伪装的 Set 必须整体拒付 UNSAFE_DATA_SHAPE：${JSON.stringify(proxyDenied)}`);
});

await check('N9 末槽负钉：只提组名的 authored intent 不得绑上本 atom', () => {
  // plan §1 v3（codex delta 裁定）：带槽配方的 authored intent 绑定只认末槽（目的地条目名）。
  // 并集口径会让只写「智能应用」的 authored intent 错绑 nav.workflowManagement——本负钉封死。
  const expectedBytes = Buffer.from(JSON.stringify({
    caseId: CASE_ID,
    intents: [{ intentId: 'intent_nav_wf', expected: [] }],
    globalAssertions: [],
  }), 'utf8');
  const testcaseWithIntent = (intent) => Buffer.from(JSON.stringify({
    schemaVersion: 1,
    caseId: CASE_ID,
    steps: [{ intentId: 'intent_nav_wf', intent }],
  }), 'utf8');

  // 负限：intent 文本只含槽 0 组名，不含末槽条目名。
  const groupOnly = generateCycleInput({
    testcaseBytes: testcaseWithIntent('进入智能应用'),
    expectedBytes,
  });
  assert(groupOnly?.ok === false && groupOnly.reason === 'CYCLE_PLAN_INTENT_BINDING_REQUIRED',
    `只提组名的 authored intent 必须拒绑（CYCLE_PLAN_INTENT_BINDING_REQUIRED）：${JSON.stringify(groupOnly)}`);

  // 正限：intent 文本含末槽条目名，照常绑上。
  const itemNamed = generateCycleInput({
    testcaseBytes: testcaseWithIntent('进入工作流管理'),
    expectedBytes,
  });
  assert(itemNamed?.ok === true
    && itemNamed.cycleInput?.projection?.mappingCandidate?.length === 1
    && itemNamed.cycleInput.projection.mappingCandidate[0].intentId === 'intent_nav_wf',
  `含末槽条目名的 authored intent 必须照常绑上：${JSON.stringify(itemNamed)}`);
});

await check('N10 绑定投影接线钉：resolveCaptureProjection 路同样受防合并守卫', async () => {
  // plan §1 v3 第 3 条（codex delta 补钉 M4 的漏调用面）：resolved-projection 是绑定投影路，
  // 其 resolveCaptureAtoms 调用不传 boundIntents，守卫形同虚设。
  const events = [groupExpandClick(1), itemClick(2)];
  const authoredCase = (intentIds) => ({
    schemaVersion: 1,
    caseId: CASE_ID,
    title: '只读导航',
    preconditions: ['已登录'],
    steps: intentIds.map((intentId) => ({ intentId, intent: `进入工作流管理-${intentId}` })),
    uniquePrefix: 'atl_',
  });

  // 限一（正控）：两击同绑一个 authored intent → 该路必须合并成单个双击单元。
  const merged = resolveCaptureProjection({
    ...(await cleanAuthorities(events)),
    mappingCandidate: [{
      intentId: 'intent_nav_wf',
      atom: 'nav.workflowManagement',
      params: {},
      evidenceEventSeqs: [1, 2],
    }],
    atomRegistry,
    authoredTestCase: authoredCase(['intent_nav_wf']),
  });
  assert(merged?.ok === true,
    `同 intent 两击必须能在绑定投影路合并：${JSON.stringify(merged)}`);
  assert(merged.resolved.length === 1
    && merged.resolved[0].evidenceEventSeqs.join(',') === '1,2'
    && merged.resolved[0].intentId === 'intent_nav_wf'
    && merged.pending.length === 0,
  `绑定投影路的合并单元形状不符：${JSON.stringify(merged.resolved)}`);

  // 限二（守卫接线）：条目击已绑 authored intent、组展开击未绑（跨度 intentId 不一致）
  // → 该路不得把两击合并；组展开击诚实落 pending，条目击按自己的 intent 独立成单元。
  // 注：组展开击没有对应 atom，只能作为未映射 pending 存在——这正是「不合并」的可观测形态；
  // 若守卫没接线，合并单元会与只声明 [2] 的 mapping 行对不上而整条拒付。
  const split = resolveCaptureProjection({
    ...(await cleanAuthorities(events)),
    mappingCandidate: [{
      intentId: 'intent_nav_wf',
      atom: 'nav.workflowManagement',
      params: {},
      evidenceEventSeqs: [2],
    }],
    atomRegistry,
    authoredTestCase: authoredCase(['intent_open_group', 'intent_nav_wf']),
  });
  assert(split?.ok === true,
    `跨 intent 两击在绑定投影路应诚实分开、不得整条拒付：${JSON.stringify(split)}`);
  assert(split.resolved.length === 1
    && split.resolved[0].evidenceEventSeqs.join(',') === '2'
    && split.resolved[0].intentId === 'intent_nav_wf',
  `条目击应独立成单元、证据仅 [2]：${JSON.stringify(split.resolved)}`);
  assert(split.pending.length === 1 && split.pending[0].eventSeq === 1,
    `未绑定的组展开击应落 pending：${JSON.stringify(split.pending)}`);
});

if (failures.length) {
  console.error(`\n${TAG}: ${passed} passed, ${failures.length} failed`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`\n${TAG}: ${passed} passed, 0 failed`);
