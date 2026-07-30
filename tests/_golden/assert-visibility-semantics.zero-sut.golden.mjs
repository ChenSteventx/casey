#!/usr/bin/env node
// assert-visibility-semantics —— 负向文本断言口径纠偏的验收金牌（红先行，零 SUT / 零浏览器 / 零真机）。
//
// 触发事实（GRILL 头注）：真机探针实测 tc_wf_publish_states 末步按 Esc 后「创建时间」
// DOM 命中仍 1、可见命中 0——浮层视觉关闭但节点不卸载，而现役 readTextHits 数 DOM 命中，故判红。
// 动作对、断言口径错（GRILL D0：注册表 lib/atoms-registry.snapshot.json:866 把 assert.textHidden
// 定义为「toBeHidden，含未挂载」，签字时的契约本来就是可见性）。
//
// 本金牌钉 GRILL D5 七组 + D4 冲突裁决规则 + 主会话 §5 的 M4 裁定，共 9 钉：
//   V1 DOM 1 / 可见 1 → textHidden 判假（既有面，回归护栏：修复不得把一切翻真）
//   V2 DOM 1 / 可见 0 → 修前判假、修后判真（真机红签名）
//   V3 DOM 0 / 可见 0 → 判真（既有真卸载情景保留）
//   V4 文本采集抛错 → 未知，绝不回退 0（现役 safeRead(..., 0) 是 fail-open，护栏 #14）
//   V5 隐藏的提示节点不得经 toast 兜底重计成可见（GRILL D3：改滤不砍）
//   V6 孪生缝：readToasts 采集失败时 noErrorToast 不得判过（GRILL D2 第 2 条）
//   V7 assert.textHidden 经草拟器映射为硬断言、不再落待补
//   V8 D4 冲突裁决：同一意图内同值被正负两向同时请求时取可见计数
//   V9 M4 裁定（主会话 plan §5）：冲突局面下该值采集失败 → 省该键，正负两向一律落未知
//
// 回放向各钉都走完整回放路径：真实 runReplayEvents（事件运行器）→ 真实 projectReplayAxes（三轴）
// → 真实 bin/verdict.mjs（裁定）。不直调 readTextHits / readToasts 交差。
// 页面事实由确定性 Page 测试替身给（tests/_golden/fixtures/assert-visibility-semantics/dom-page.mjs），
// 动作本身不是被测面，故 dispatchAction 走注入桩（同 cross-platform-execution-target-hardening 先例）。

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveExecutionTarget } from '../../lib/execution-target/authority.mjs';
import { projectExecutionTargetRuntime } from '../../lib/execution-target/runtime.mjs';
import { runReplayEvents } from '../../lib/replay/event-runner.mjs';
import { projectReplayAxes } from '../../lib/replay-axes.mjs';
import { synthesizeSkeleton, validateDraft } from '../../lib/assertion-draft.mjs';
import {
  CLOSE_HIDE,
  CLOSE_UNMOUNT,
  createVisibilityPage,
} from './fixtures/assert-visibility-semantics/dom-page.mjs';

const TAG = 'assert-visibility-semantics';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const START = 'https://assert-visibility.invalid:9443/ai-manager/process/detail';
const PATH = '/ai-manager/process/detail';
const CASE_ID = 'tc_assert_visibility_semantics';
const INTENT = 'intent_5';
const STEP = 'atstep_1';
const TEXT = '创建时间';

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
    failures.push(`${name}: ${String(error?.message || error).slice(-700)}`);
    console.error(`RED  ${TAG}: ${name}: ${String(error?.message || error).slice(-700)}`);
  }
}

function executionTarget() {
  const resolved = resolveExecutionTarget({
    runtime: { platform: 'linux', isWSL: false },
    logicalTarget: { startUrl: START },
    transport: { mode: 'direct' },
    requiresOriginContinuity: true,
  });
  assert(resolved?.ok === true, '合成 execution target authority 应成功');
  return { authority: resolved.authority, runtime: projectExecutionTargetRuntime(resolved.authority) };
}

// 真实裁定：axes 全文喂 bin/verdict.mjs（零 LLM 裁判，护栏 #15），退出码与产物都不代劳。
function runVerdict(axesText) {
  const dir = mkdtempSync(join(tmpdir(), 'casey-assert-visibility-'));
  try {
    const axesFile = join(dir, 'axes.json');
    const outFile = join(dir, 'verdict.json');
    writeFileSync(axesFile, axesText, 'utf8');
    const run = spawnSync(process.execPath, [join(ROOT, 'bin', 'verdict.mjs'), '--axes', axesFile, '--out', outFile], {
      cwd: ROOT, encoding: 'utf8', timeout: 60000,
    });
    assert(run.status === 0, `verdict 退出码应为 0，实际 ${run.status}`);
    return JSON.parse(readFileSync(outFile, 'utf8'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const EVENT = Object.freeze({
  stepId: STEP,
  intentId: INTENT,
  atom: 'workflow.closeDrawer',
  action: 'press',
  key: 'Escape',
  pre: { path: PATH },
});

// 一次完整回放：事件运行器采证 → 三轴投影 → 裁定。返回按 kind 索引的断言结果与本步裁定。
async function replayIntent({ page, assertions, act = true }) {
  const intentEvents = new Map([[INTENT, [EVENT]]]);
  const reprStepOf = new Map([[INTENT, STEP]]);
  const expectedByIntent = new Map([[INTENT, assertions]]);
  const forensics = {
    records() { return []; },
    inFlightCount() { return 0; },
    async awaitStreamsSettled() {},
    async drain() {},
  };
  const runner = await runReplayEvents({
    page,
    execution: executionTarget(),
    args: {},
    events: [EVENT],
    intentEvents,
    reprStepOf,
    profile: {},
    ctx: { identityTokens: new Map() },
    forensics,
    state: { currentStepId: null },
    guardAborts: [],
    expectedByIntent,
    globalAssertions: [],
    countSelector: '.hr-table-row',
    buttons: null,
    caseId: CASE_ID,
    videoStartedAt: Date.now(),
    log() {},
    dispatchAction: async () => {
      if (act) page.closeDialog();
      return { resolution: 'unique', identityReadback: { ok: true } };
    },
  });
  const axesText = projectReplayAxes({
    caseId: CASE_ID,
    records: [],
    intentOrder: [INTENT],
    intentEvents,
    reprStepOf,
    actionByStep: runner.actionByStep,
    pageErrors: [],
    intentCount: runner.intentCount,
    expectedByIntent,
    globalAssertions: [],
    intentUrl: runner.intentUrl,
    intentToasts: runner.intentToasts,
    intentTextHits: runner.intentTextHits,
    intentButtonHits: runner.intentButtonHits,
    intentButtonSeen: runner.intentButtonSeen,
    intentButtonDisabledHits: runner.intentButtonDisabledHits,
    intentReply: runner.intentReply,
    intentInputReadback: runner.intentInputReadback,
    chatCfg: runner.chatCfg,
    allStepIds: new Set([STEP]),
  });
  const step = JSON.parse(axesText).steps[0];
  const verdict = runVerdict(axesText).steps[0];
  return {
    step,
    verdict,
    of: (kind) => step.postAssertions.find((item) => item.kind === kind),
  };
}

const dialogText = (extra = {}) => ({ text: TEXT, dialog: true, ...extra });
const editorTitle = { text: '工作流编辑器' };
const hidden = (assertions) => assertions;
const textHidden = { kind: 'textHidden', op: 'absent', value: TEXT };
const textVisible = { kind: 'textVisible', op: 'appears', value: TEXT };

// 固定下限与预算：静默点不是本金牌被测面，压到最小让八钉可在秒级复跑。
process.env.REPLAY_SETTLE_FLOOR_MS = '0';
process.env.REPLAY_SETTLE_BUDGET_MS = '1';

await check('V1 DOM 命中 1、可见 1 → textHidden 判假（修复不得把一切翻真）', async () => {
  const page = createVisibilityPage({ nodes: [editorTitle, dialogText()], closeMode: CLOSE_HIDE });
  const run = await replayIntent({ page, assertions: hidden([textHidden]), act: false });
  const probe = page.probe(TEXT);
  assert(probe.dom === 1 && probe.visible === 1, `前提事实应为 DOM 1 / 可见 1，实际 ${JSON.stringify(probe)}`);
  const result = run.of('textHidden');
  assert(result?.ok === false, `在场文本的 textHidden 必判假，实际 ok=${result?.ok}`);
  assert(result?.actual === 1, `actual 应为 1，实际 ${result?.actual}`);
  assert(run.verdict.verdict === 'NEEDS_HUMAN', `硬断言失败应落 NEEDS_HUMAN，实际 ${run.verdict.verdict}`);
});

await check('V2 DOM 命中 1、可见 0 → textHidden 判真（真机红签名）', async () => {
  const page = createVisibilityPage({ nodes: [editorTitle, dialogText()], closeMode: CLOSE_HIDE });
  const run = await replayIntent({ page, assertions: hidden([textHidden]) });
  const probe = page.probe(TEXT);
  assert(probe.dom === 1 && probe.visible === 0, `前提事实应为 DOM 1 / 可见 0，实际 ${JSON.stringify(probe)}`);
  const result = run.of('textHidden');
  assert(result?.ok === true, `只隐藏不卸载时 textHidden 必判真，实际 ok=${result?.ok} actual=${result?.actual}`);
  assert(result?.actual === 0, `actual 应为可见计数 0，实际 ${result?.actual}`);
  assert(run.verdict.verdict === 'PASS', `本步应终判 PASS，实际 ${run.verdict.verdict}/${run.verdict.reason}`);
});

await check('V3 DOM 0、可见 0 → textHidden 判真（既有真卸载情景保留）', async () => {
  const page = createVisibilityPage({ nodes: [editorTitle, dialogText()], closeMode: CLOSE_UNMOUNT });
  const run = await replayIntent({ page, assertions: hidden([textHidden]) });
  const probe = page.probe(TEXT);
  assert(probe.dom === 0 && probe.visible === 0, `前提事实应为 DOM 0 / 可见 0，实际 ${JSON.stringify(probe)}`);
  const result = run.of('textHidden');
  assert(result?.ok === true, `真卸载时 textHidden 必判真，实际 ok=${result?.ok}`);
  assert(result?.actual === 0, `actual 应为 0，实际 ${result?.actual}`);
  assert(run.verdict.verdict === 'PASS', `本步应终判 PASS，实际 ${run.verdict.verdict}/${run.verdict.reason}`);
});

await check('V4 文本采集抛错 → 未知，绝不回退 0（护栏 #14）', async () => {
  const page = createVisibilityPage({
    nodes: [editorTitle, dialogText()], closeMode: CLOSE_HIDE, failTextQuery: true,
  });
  const run = await replayIntent({ page, assertions: hidden([textHidden]) });
  const result = run.of('textHidden');
  assert(result?.ok === false, `采集不可用必证不出，实际 ok=${result?.ok} actual=${result?.actual}`);
  assert(result?.actual === null, `证不出的 actual 不得硬凑计数，实际 ${result?.actual}`);
  assert(run.verdict.verdict === 'NEEDS_HUMAN', `证不出应落 NEEDS_HUMAN，实际 ${run.verdict.verdict}`);
});

await check('V5 隐藏的提示节点不得经 toast 兜底重计成可见（GRILL D3 改滤不砍）', async () => {
  const page = createVisibilityPage({
    nodes: [editorTitle, dialogText({ classes: ['hr-toast'] })], closeMode: CLOSE_HIDE,
  });
  const run = await replayIntent({ page, assertions: hidden([textHidden]) });
  const probe = page.probe(TEXT);
  assert(probe.dom === 1 && probe.visible === 0, `前提事实应为 DOM 1 / 可见 0，实际 ${JSON.stringify(probe)}`);
  assert(Array.isArray(run.step.postAssertions), 'postAssertions 应在场');
  const result = run.of('textHidden');
  assert(result?.ok === true, `隐藏的提示节点不得被 toast 兜底重计成可见，实际 ok=${result?.ok} actual=${result?.actual}`);
  assert(result?.actual === 0, `actual 应为 0，实际 ${result?.actual}`);
});

await check('V6 孪生缝：toast 采集失败时 noErrorToast 不得判过（GRILL D2 第 2 条）', async () => {
  const page = createVisibilityPage({
    nodes: [editorTitle, dialogText()], closeMode: CLOSE_HIDE, failToastQuery: true,
  });
  const run = await replayIntent({ page, assertions: [{ kind: 'noErrorToast', op: 'absent' }] });
  const result = run.of('noErrorToast');
  assert(result?.ok === false, `toast 采集失败必证不出，实际 ok=${result?.ok} actual=${JSON.stringify(result?.actual)}`);
  assert(result?.actual === null, `证不出的 actual 不得硬凑，实际 ${JSON.stringify(result?.actual)}`);
  assert(run.verdict.verdict === 'NEEDS_HUMAN', `证不出应落 NEEDS_HUMAN，实际 ${run.verdict.verdict}`);
});

await check('V7 assert.textHidden 经草拟器映射为硬断言、不再落待补', () => {
  const observed = { caseId: CASE_ID, steps: [{ intentId: INTENT, urlPathnameAfter: PATH }] };
  const draft = synthesizeSkeleton(observed, [{ intentId: INTENT, atom: 'assert.textHidden', params: { text: TEXT } }]);
  assert(draft.pending.length === 0, `assert.textHidden 不得再落待补，实际 pending=${JSON.stringify(draft.pending)}`);
  const intent = draft.intents.find((item) => item.intentId === INTENT);
  const mapped = (intent?.expected || []).find((item) => item.kind === 'textHidden');
  assert(mapped, `草拟结果应含 textHidden，实际 ${JSON.stringify(intent?.expected)}`);
  assert(mapped.op === 'absent', `op 应为 absent（与注册表和词表一致），实际 ${mapped.op}`);
  assert(mapped.value === TEXT, `value 应取原子 text 参数，实际 ${mapped.value}`);
  assert(mapped.soft !== true, 'textHidden 已在已实现集内，不得标 soft（绕硬裁定，p4-drafter D2）');
  const gate = validateDraft(draft);
  assert(gate.ok === true, `草稿应过零 LLM 校验闸，实际 ${JSON.stringify(gate.problems)}`);
});

await check('V8 D4 冲突裁决：同值正负两向同请求时取可见计数', async () => {
  const page = createVisibilityPage({ nodes: [editorTitle, dialogText()], closeMode: CLOSE_HIDE });
  const run = await replayIntent({ page, assertions: [textVisible, textHidden] });
  const positive = run.of('textVisible');
  const negative = run.of('textHidden');
  assert(positive?.actual === negative?.actual,
    `同值只有一个计数，两向 actual 必相等，实际 ${positive?.actual}/${negative?.actual}`);
  assert(negative?.ok === true, `冲突时取可见计数：textHidden 应判真，实际 ok=${negative?.ok} actual=${negative?.actual}`);
  assert(positive?.ok === false, `冲突时取可见计数：textVisible 应判假，实际 ok=${positive?.ok} actual=${positive?.actual}`);
});

await check('V9 M4 裁定：冲突局面下采集失败 → 正负两向一律落未知，绝不各判各的', async () => {
  const page = createVisibilityPage({
    nodes: [editorTitle, dialogText()], closeMode: CLOSE_HIDE, failTextQuery: true,
  });
  const run = await replayIntent({ page, assertions: [textVisible, textHidden] });
  const positive = run.of('textVisible');
  const negative = run.of('textHidden');
  // 反向失效模式：一向把异常回退成 0 判过、另一向判不过——懒实现最可能写出的东西，这里显式点名。
  assert(!(negative?.ok === true && positive?.ok === false),
    `采集失败不得各判各的（一向回退 0 判过、另一向判不过），实际 textVisible ok=${positive?.ok} actual=${positive?.actual} / textHidden ok=${negative?.ok} actual=${negative?.actual}`);
  assert(positive?.ok === false && positive?.actual === null,
    `采集失败时 textVisible 必证不出，实际 ok=${positive?.ok} actual=${positive?.actual}`);
  assert(negative?.ok === false && negative?.actual === null,
    `采集失败时 textHidden 必证不出，实际 ok=${negative?.ok} actual=${negative?.actual}`);
  assert(run.verdict.verdict === 'NEEDS_HUMAN', `证不出应落 NEEDS_HUMAN，实际 ${run.verdict.verdict}`);
});

const total = passed + failures.length;
if (failures.length) {
  console.error(`\n${TAG}: ${passed}/${total} passed, ${failures.length} failed`);
  for (const line of failures) console.error(`  - ${line}`);
  process.exit(1);
}
console.log(`\n${TAG}: ${passed}/${total} passed`);
