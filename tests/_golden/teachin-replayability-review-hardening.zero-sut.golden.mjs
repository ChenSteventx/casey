#!/usr/bin/env node
// Review closure for plan generation, explicit recording finish, canonical runtime
// evidence wiring, and raw CLI lifecycle. Pure bytes/static inspection; zero SUT/browser/network.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import atomRegistry from '../../lib/atoms-registry.snapshot.json' with { type: 'json' };
import {
  generateKnownReadOnlyCycleInput,
  generateKnownReadOnlyCyclePlan,
} from '../../lib/teachin/cycle-plan-generator.mjs';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const TAG = 'teachin-replayability-review-hardening';
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

function source(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

function captureBytes({
  caseId = 'tc_review_plan',
  events = [{
    seq: 1,
    action: 'click',
    path: '/home',
    selector: '#workflow-management',
    text: '工作流管理',
  }],
} = {}) {
  return Buffer.from(JSON.stringify({
    artifactKind: 'teach-in-capture',
    caseId,
    createdAt: '2026-07-28T00:00:00.000Z',
    events,
    schemaVersion: 1,
    source: {
      distillRequired: true,
      kind: 'manual',
      replayReady: false,
      signed: false,
    },
    startPath: '/home',
  }), 'utf8');
}

function planInput(overrides = {}) {
  const caseId = overrides.caseId || 'tc_review_plan';
  return {
    atomRegistry,
    authoredTestCase: {
      schemaVersion: 1,
      caseId,
      steps: [{ intentId: 'intent_1', intent: '进入工作流管理' }],
    },
    captureBytes: captureBytes({ caseId }),
    caseId,
    channelProfileBytes: Buffer.from('{"profile":"zero-sut"}', 'utf8'),
    expectedDocument: {
      caseId,
      intents: [{ intentId: 'intent_1', expected: [] }],
      globalAssertions: [],
    },
    paths: {
      capture: 'artifacts/capture.json',
      entityLock: 'artifacts/entity-lock.json',
      expected: 'artifacts/expected.json',
      testcase: 'artifacts/testcase.json',
    },
    replayKernelBytes: Buffer.from('{"kernel":"probe"}', 'utf8'),
    sutBuildDigest: `sha256:${'a'.repeat(64)}`,
    ...overrides,
  };
}

function sameCaptureCycleInput(overrides = {}) {
  const plan = planInput(overrides);
  return {
    atomRegistry: plan.atomRegistry,
    captureBytes: plan.captureBytes,
    caseId: plan.caseId,
    channelProfileBytes: plan.channelProfileBytes,
    entityLockBytes: Buffer.from('[]', 'utf8'),
    executionTargetAuthority: { opaque: 'test-only-authority-seam' },
    expectedBytes: Buffer.from(JSON.stringify(plan.expectedDocument), 'utf8'),
    replayKernelBytes: plan.replayKernelBytes,
    sutBuildDigest: plan.sutBuildDigest,
    testcaseBytes: Buffer.from(JSON.stringify(plan.authoredTestCase), 'utf8'),
  };
}

function expectReason(result, reason, label) {
  assert(result?.ok === false && result.reason === reason,
    `${label} 应 ${reason}：${JSON.stringify(result)}`);
}

await check('H1 known read-only 计划 exact bytes 决定命名且重复生成确定一致', () => {
  const input = planInput();
  const first = generateKnownReadOnlyCyclePlan(input);
  const second = generateKnownReadOnlyCyclePlan(planInput());
  assert(first?.ok === true && second?.ok === true, 'known recipe 正控应成功');
  assert(JSON.stringify(first.plan) === JSON.stringify(second.plan), '同输入计划必须确定一致');
  const token = createHash('sha256').update(input.captureBytes).digest('hex').slice(0, 12);
  assert(first.plan.sourcePlan.pairId === `pair_${token}`
    && first.plan.sourcePlan.source.runNamespace === `run_source_${token}`,
  'pair/run namespace 必须绑定 exact capture bytes');
  assert(first.plan.projection.mappingCandidate.length === 1
    && first.plan.projection.mappingCandidate[0].atom === 'nav.workflowManagement'
    && first.plan.projection.mappingCandidate[0].intentId === 'intent_1',
  'known recipe 必须绑定 authored intent 与现役 atom');
  assert(first.plan.sourcePlan.expectedObligations.effects[0].effectClass === 'read'
    && first.plan.sourcePlan.expectedObligations.cleanup.required === false,
  '首发计划只可生成 read-only obligations');
});

await check('H2 generator 只认 exact 输入且 capture 必须由最终 bytes 准入', () => {
  expectReason(generateKnownReadOnlyCyclePlan({
    ...planInput(),
    capture: JSON.parse(captureBytes().toString('utf8')),
  }), 'CYCLE_PLAN_INVALID', 'caller capture object truth');
  const malformed = planInput({ captureBytes: Buffer.from('[', 'utf8') });
  expectReason(generateKnownReadOnlyCyclePlan(malformed),
    'RAW_CAPTURE_INVALID', 'malformed capture bytes');
  expectReason(generateKnownReadOnlyCyclePlan(planInput({
    paths: {
      capture: '../escape.json',
      entityLock: 'artifacts/entity-lock.json',
      expected: 'artifacts/expected.json',
      testcase: 'artifacts/testcase.json',
    },
  })), 'CYCLE_PLAN_INVALID', 'path escape');
});

await check('H2b 同次 cycle input 的 events 与 identity 只绑定本次 exact capture', () => {
  const stale = captureBytes();
  const current = Buffer.from(stale.toString('utf8').replace(
    '2026-07-28T00:00:00.000Z',
    '2026-07-28T00:00:01.000Z',
  ), 'utf8');
  const input = sameCaptureCycleInput({ captureBytes: current });
  const generated = generateKnownReadOnlyCycleInput(input);
  assert(generated?.ok === true, `同次 exact capture 正控应成功：${generated?.reason}`);
  const source = generated.cycleInput.sourcePlan.source;
  const token = createHash('sha256').update(current).digest('hex').slice(0, 12);
  assert(source.eventsBytes.equals(current) && !source.eventsBytes.equals(stale),
    'cycle source events 必须是 current capture，不得复用旧计划 capture');
  assert(generated.cycleInput.sourcePlan.pairId === `pair_${token}`
    && source.runNamespace === `run_source_${token}`
    && generated.cycleInput.distilled.authoringRunNamespace === `run_authoring_${token}`
    && generated.cycleInput.distilled.runNamespace === `run_distilled_${token}`,
  'pair 与三 runtime namespace 必须只由 current capture bytes 决定');
  expectReason(generateKnownReadOnlyCycleInput({
    ...input,
    entityLockBytes: Buffer.from('[{}]', 'utf8'),
  }), 'CYCLE_PLAN_RUNTIME_ENTITY_REVIEW_REQUIRED', 'runtime entity lock');
});

await check('H3 模糊 intent、expected 错绑、pending 与 popup 均明确转人工', () => {
  expectReason(generateKnownReadOnlyCyclePlan(planInput({
    authoredTestCase: {
      schemaVersion: 1,
      caseId: 'tc_review_plan',
      steps: [{ intentId: 'intent_1', intent: '进入管理页面' }],
    },
  })), 'CYCLE_PLAN_INTENT_BINDING_REQUIRED', 'vague authored intent');
  expectReason(generateKnownReadOnlyCyclePlan(planInput({
    expectedDocument: {
      caseId: 'tc_review_plan',
      intents: [{ intentId: 'wrong_intent', expected: [] }],
    },
  })), 'CYCLE_PLAN_EXPECTED_INVALID', 'expected intent mismatch');
  expectReason(generateKnownReadOnlyCyclePlan(planInput({
    captureBytes: captureBytes({
      events: [{
        seq: 1, action: 'click', path: '/home',
        selector: '#unknown', text: '未知入口',
      }],
    }),
  })), 'CYCLE_PLAN_MAPPING_REQUIRED', 'unknown recipe');
  expectReason(generateKnownReadOnlyCyclePlan(planInput({
    captureBytes: captureBytes({
      events: [
        {
          seq: 1, action: 'click', path: '/home',
          selector: '#workflow-management', text: '工作流管理',
        },
        { seq: 2, action: 'newpage', path: '/popup' },
      ],
    }),
  })), 'CYCLE_PLAN_TOPOLOGY_REVIEW_REQUIRED', 'popup topology');
});

await check('H4 future mutation recipe 不能被 read-only obligations 洗白', () => {
  const registry = structuredClone(atomRegistry);
  registry.atoms['workflow.create'].teachinRecipes = [{
    ruleId: 'review-mutation-probe',
    match: {
      actions: ['click'],
      requiresSemanticEvidence: true,
      textAnyOf: ['新建工作流'],
    },
    emit: { atom: 'workflow.create', params: {} },
  }];
  expectReason(generateKnownReadOnlyCyclePlan(planInput({
    atomRegistry: registry,
    authoredTestCase: {
      schemaVersion: 1,
      caseId: 'tc_review_plan',
      steps: [{ intentId: 'intent_1', intent: '新建工作流' }],
    },
    captureBytes: captureBytes({
      events: [{
        seq: 1, action: 'click', path: '/home',
        selector: '#create-workflow', text: '新建工作流',
      }],
    }),
  })), 'CYCLE_PLAN_EFFECT_REVIEW_REQUIRED', 'mutation recipe');
});

await check('H5 录制显式完成、预装 lifecycle witness 与所有早退 cleanup 静态咬合', () => {
  const record = source('bin/record.mjs');
  for (const marker of [
    '完成录制',
    '__caseyFinishRecording',
    'recordingFinished',
    'createFreshReplayWitness',
  ]) assert(record.includes(marker), `record 缺 ${marker}`);
  const witness = record.indexOf('createFreshReplayWitness({');
  const wait = record.indexOf('recordingFinished.then(done)');
  const handoff = record.indexOf('runRecordedTeachinReplayabilityCycle({');
  assert(witness >= 0 && wait > witness && handoff > wait,
    'witness 必须在人工等待前预装，结束后才可交 full-cycle');
  assert(/setTimeout\(done,\s*maxMs\)/.test(record)
    && !/setTimeout\(resolveDone,\s*maxMs\)/.test(record),
  'timeout 也必须走同一幂等 done 收口');
  assert(/let recordingOwnerTransferred = false;\s*try \{\s*const context = await browser\.newContext\(\)/s
    .test(record)
    && /finally \{\s*if \(!recordingOwnerTransferred\)[\s\S]*?browser\.close/s.test(record),
  'Context/bridge/page 任一早退都必须落入 Browser cleanup');
});

await check('H6 raw CLI 真实 anchor close→第二 runtime→fresh→canonical raw 且 finally 清理', () => {
  const raw = source('bin/teachin-raw-replay.mjs');
  const anchor = raw.indexOf('anchor = await openRuntime(');
  const witness = raw.indexOf('createFreshReplayWitness({');
  const closed = raw.indexOf('await closeRuntime(anchor)');
  const replay = raw.indexOf('replay = await openRuntime(');
  const fresh = raw.indexOf('authorizeFreshReplayRuntime({');
  const run = raw.indexOf('admitAndRunRawReplay({');
  assert(anchor >= 0 && witness > anchor && closed > witness && replay > closed
    && fresh > replay && run > fresh,
  'raw CLI 生命周期顺序必须 anchor→witness→close→second→fresh→raw');
  assert(raw.includes('actionDriver: canonicalRawPlaywrightDriver')
    && /finally \{\s*await closeRuntime\(replay\);\s*await closeRuntime\(anchor\);/s.test(raw),
  'raw CLI 必须走 canonical driver 且 finally 关闭两段 runtime');
  assert(!/Object\.create\(null\)|fake|stub/i.test(raw),
    'raw CLI 不得手造 fake runtime/authority');
});

await check('H7 活动页、共享取证、正式 expected 与 authoring baseline 都接入生产路径', () => {
  const bootstrap = source('lib/teachin/runtime-bootstrap.mjs');
  const prepared = source('lib/teachin/prepared-runtime-seam.mjs');
  const owner = source('lib/teachin/runtime-owner.mjs');
  assert(/page:\s*opened\.activePage/.test(bootstrap)
    && /pageErrors,\s*options:\s*\{ currentStep: \(\) => state\.currentStepId \}/s.test(bootstrap),
  'runtime bootstrap 必须用动态 active page 与同一 attribution state/pageErrors');
  assert(/expectedByIntent = new Map/.test(prepared)
    && /globalAssertions = \(expectedDocument\.globalAssertions/.test(prepared)
    && /pageTopology:\s*claimed\.topologyAuthority/.test(prepared),
  'formal runner 必须带 signed expected 与 topology');
  assert(/expectedBaselineProjectionSha256/.test(owner)
    && /facts\.baselineProjectionSha256 !== baseline\.baselineProjectionSha256/.test(owner),
  'authoring reset 必须与 source baseline digest 做 exact 比对');
});

await check('H8 本轮新增/重构文件解耦且尺寸闭合', () => {
  const limits = new Map([
    ['bin/record.mjs', 600],
    ['bin/teachin-plan.mjs', 600],
    ['bin/teachin-raw-replay.mjs', 600],
    ['lib/teachin/cycle-plan-generator.mjs', 600],
    ['lib/teachin/cycle-input-loader.mjs', 600],
    ['lib/teachin/distilled-runtime-preparation.mjs', 600],
    ['lib/teachin/read-only-obligations.mjs', 600],
    ['lib/teachin/runtime-cycle-adapter.mjs', 300],
  ]);
  for (const [file, limit] of limits) {
    const count = source(file).split(/\r?\n/).length;
    assert(count < limit, `${file} ${count} 行，须 < ${limit}`);
  }
});

console.log(`${TAG}: ${passed} 过 / ${failures.length} 败`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
