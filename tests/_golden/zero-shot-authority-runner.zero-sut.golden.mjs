#!/usr/bin/env node
// S2 补强门：runner 的 bounded proposal 真闭环、全链 authority 内容不可原位改写、
// typed progress 闭集与 observation clone 拒绝。纯 Node，零 browser/server/SUT/network。

import { readFileSync } from 'node:fs';
import { createPageDriverDouble } from './fixtures/zero-shot-observe-admit-step/adapter-double.mjs';
import { buildIntentPlan } from '../../lib/intent-plan.mjs';
import { freezeZeroShotStepContract } from '../../lib/zero-shot/step-contract.mjs';
import { observePage } from '../../lib/zero-shot/page-observer.mjs';
import { resolveDeterministicAction } from '../../lib/zero-shot/deterministic-resolver.mjs';
import { createActionProposal } from '../../lib/zero-shot/action-proposal.mjs';
import { admitZeroShotAction } from '../../lib/zero-shot/action-admission.mjs';
import { executeAdmittedAction } from '../../lib/zero-shot/step-executor.mjs';
import { verifyStepProgress } from '../../lib/zero-shot/progress-verifier.mjs';
import { runSingleZeroShotStep } from '../../lib/zero-shot/single-step-runner.mjs';

const failures = [];
let passed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   zero-shot-authority-runner: ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error?.message || error}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertDeepFrozen(value, path = 'artifact', seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  assert(Object.isFrozen(value), `${path} 必须 frozen，防原对象保权后改内容`);
  for (const key of Reflect.ownKeys(value)) {
    assertDeepFrozen(value[key], `${path}.${String(key)}`, seen);
  }
}

const CASE_ID = 'tc_zero_shot_authority_runner';
const INTENT_ID = 'intent_1';
const TARGET_NAME = '打开帮助';
const REGISTRY = JSON.parse(
  readFileSync(new URL('../../lib/atoms-registry.snapshot.json', import.meta.url), 'utf8'),
);

const testcase = Object.freeze({
  schemaVersion: 1,
  caseId: CASE_ID,
  source: { kind: 'freetext', raw: '打开帮助' },
  preconditions: ['已登录'],
  steps: [{
    intentId: INTENT_ID,
    intent: '打开帮助',
    actionHint: 'click',
    expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/help' }],
  }],
  globalAssertions: [],
  uniquePrefix: 'atl_',
});

function contractResult(expectedProgress = [
  { kind: 'urlPathname', op: 'startsWith', value: '/help' },
]) {
  return freezeZeroShotStepContract({
    testcase,
    intentPlan: buildIntentPlan({ testcase, registry: REGISTRY }),
    intentId: INTENT_ID,
    action: 'click',
    target: { kind: 'role', role: 'link', name: TARGET_NAME, exact: true },
    effect: 'read',
    expectedProgress,
    userConfirmed: true,
  });
}

function mustContract(expectedProgress) {
  const result = contractResult(expectedProgress);
  assert(result?.ok === true && result.contract, `contract 应冻结：${JSON.stringify(result)}`);
  return result.contract;
}

function rawAffordance({
  handleId = 'help-link',
  role = 'link',
  accessibleName = TARGET_NAME,
  text = accessibleName,
} = {}) {
  return {
    handleId,
    role,
    accessibleName,
    label: null,
    text,
    visible: true,
    enabled: true,
    actionSpace: ['click'],
  };
}

function snapshot(revision, path, affordances) {
  return {
    revision,
    url: `https://example.invalid${path}?ignored=secret#ignored`,
    title: '帮助入口',
    settled: true,
    unsupportedScopes: [],
    affordances,
  };
}

function makePage({
  beforePath = '/home',
  afterPath = '/help/article',
  beforeAffordances = [
    rawAffordance(),
    rawAffordance({ handleId: 'other-link', accessibleName: '其他入口' }),
  ],
} = {}) {
  return createPageDriverDouble({
    snapshots: [
      snapshot('rev_1', beforePath, beforeAffordances),
      snapshot('rev_2', afterPath, []),
    ],
  });
}

async function mustObserve(driver) {
  const result = await observePage({ driver, intentId: INTENT_ID, maxCandidates: 20 });
  assert(result?.ok === true && result.observation && result.authority,
    `observe 应成功：${JSON.stringify(result)}`);
  return result;
}

function proposalRaw(observation, targetAffordanceId) {
  return {
    schemaVersion: 1,
    artifactKind: 'zero-shot-action-proposal',
    observationId: observation.observationId,
    intentId: INTENT_ID,
    targetAffordanceId,
    action: 'click',
  };
}

// sourceObligationId:zs-authority-runner-e1 unitCheckId:zero-shot-authority-runner-e1
await check('runner zero-hit 调 propose 恰一次并完成 proposal→progressed 全闭环', async () => {
  const page = makePage({
    beforeAffordances: [
      rawAffordance({ handleId: 'continue', role: 'button', accessibleName: '继续' }),
      rawAffordance({ handleId: 'cancel', role: 'button', accessibleName: '取消' }),
    ],
  });
  const stepContract = mustContract();
  let proposeCalls = 0;
  const result = await runSingleZeroShotStep({
    driver: page.driver,
    stepContract,
    maxCandidates: 20,
    propose({ observation, stepContract: receivedContract }) {
      proposeCalls += 1;
      assert(receivedContract === stepContract, 'runner 必须把原 authority contract 交给 bounded proposer');
      const chosen = observation.affordances.find((item) => item.semantic?.name === '继续');
      assert(chosen, 'proposer 只能从当前 bounded catalog 选候选');
      return proposalRaw(observation, chosen.affordanceId);
    },
  });
  assert(proposeCalls === 1, `zero-hit proposer 应恰调用一次，实际 ${proposeCalls}`);
  assert(result?.ok === true && result.progress?.status === 'progressed',
    `runner proposal path 应 progressed：${JSON.stringify(result)}`);
  assert(result.trace?.artifactKind === 'zero-shot-exploration-trace'
    && result.trace.signed === false && result.trace.replayReady === false,
  'runner proposal path 须产降权 trace');
  assert(page.control.calls.perform === 1 && page.control.calls.revalidate === 1
    && page.control.calls.snapshot === 2 && page.control.calls.settle === 2,
  `runner proposal path 固定顺序不完整：${JSON.stringify(page.control.calls)}`);
});

// sourceObligationId:zs-authority-runner-e2 unitCheckId:zero-shot-authority-runner-e2
await check('contract/resolution/admission/receipt/after observation 全链 deep-frozen', async () => {
  const page = makePage({ afterPath: '/help/article' });
  const stepContract = mustContract([
    { kind: 'urlPathname', op: 'equals', value: '/help/article' },
  ]);
  const before = await mustObserve(page.driver);
  const resolution = resolveDeterministicAction({
    stepContract,
    observation: before.observation,
  });
  assert(resolution?.status === 'resolved', `resolution 应唯一：${JSON.stringify(resolution)}`);

  const clonedObservation = structuredClone(before.observation);
  const cloneDenied = await admitZeroShotAction({
    stepContract,
    observation: clonedObservation,
    observationAuthority: before.authority,
    resolution,
  });
  assert(cloneDenied?.ok === false && cloneDenied.reason === 'OBSERVATION_AUTHORITY_MISMATCH',
    `public observation clone + 真 authority 必须拒：${JSON.stringify(cloneDenied)}`);

  const admitted = await admitZeroShotAction({
    stepContract,
    observation: before.observation,
    observationAuthority: before.authority,
    resolution,
  });
  assert(admitted?.ok === true && admitted.admission, `admission 应通过：${JSON.stringify(admitted)}`);
  const executed = await executeAdmittedAction({ admission: admitted.admission });
  assert(executed?.ok === true && executed.actionReceipt, `execute 应通过：${JSON.stringify(executed)}`);
  const after = await mustObserve(page.driver);
  const progress = verifyStepProgress({
    stepContract,
    beforeObservation: before.observation,
    actionReceipt: executed.actionReceipt,
    afterObservation: after.observation,
    afterObservationAuthority: after.authority,
  });
  assert(progress?.status === 'progressed', `equals progress 应因果成立：${JSON.stringify(progress)}`);

  for (const [name, artifact] of [
    ['stepContract', stepContract],
    ['beforeObservation', before.observation],
    ['resolution', resolution],
    ['admission', admitted.admission],
    ['actionReceipt', executed.actionReceipt],
    ['afterObservation', after.observation],
  ]) {
    assertDeepFrozen(artifact, name);
  }
  assert(Reflect.set(stepContract.target, 'name', '篡改目标') === false, 'contract target 不得原位改写');
  assert(Reflect.set(stepContract.expectedProgress[0], 'value', '/forged') === false,
    'contract progress 不得原位改写');
  const otherId = before.observation.affordances
    .find((item) => item.affordanceId !== resolution.targetAffordanceId)?.affordanceId;
  assert(/^af_/.test(otherId), '攻击前置须有另一个合法 af_*');
  assert(Reflect.set(resolution, 'targetAffordanceId', otherId) === false
    && resolution.targetAffordanceId !== otherId, 'resolution 不得保权改点到另一个合法 af_*');
  assert(Reflect.set(after.observation, 'urlPathname', '/help/forged') === false,
    'after observation 不得原位伪造 progress');
});

// sourceObligationId:zs-authority-runner-e3 unitCheckId:zero-shot-authority-runner-e3
await check('proposal authority deep-frozen，且不能原位改点到另一个合法 af_*', async () => {
  const page = makePage({
    beforeAffordances: [
      rawAffordance({ handleId: 'continue', role: 'button', accessibleName: '继续' }),
      rawAffordance({ handleId: 'cancel', role: 'button', accessibleName: '取消' }),
    ],
  });
  const stepContract = mustContract();
  const before = await mustObserve(page.driver);
  const [chosen, other] = before.observation.affordances;
  const created = createActionProposal({
    stepContract,
    observation: before.observation,
    rawProposal: proposalRaw(before.observation, chosen.affordanceId),
  });
  assert(created?.ok === true && created.proposal, `zero-hit proposal 应铸权：${JSON.stringify(created)}`);
  assertDeepFrozen(created.proposal, 'proposal');
  assert(Reflect.set(created.proposal, 'targetAffordanceId', other.affordanceId) === false
    && created.proposal.targetAffordanceId === chosen.affordanceId,
  'proposal 不得保权改点到另一个合法 af_*');
});

// sourceObligationId:zs-authority-runner-e4 unitCheckId:zero-shot-authority-runner-e4
await check('deterministic 唯一命中时 proposal 不得绕过既定目标', async () => {
  const page = makePage();
  const stepContract = mustContract();
  const before = await mustObserve(page.driver);
  const resolution = resolveDeterministicAction({
    stepContract,
    observation: before.observation,
  });
  assert(resolution?.status === 'resolved', '攻击前置须存在确定性唯一命中');
  const otherId = before.observation.affordances
    .find((item) => item.affordanceId !== resolution.targetAffordanceId)?.affordanceId;
  const denied = createActionProposal({
    stepContract,
    observation: before.observation,
    rawProposal: proposalRaw(before.observation, otherId),
  });
  assert(denied?.ok === false && denied.reason === 'DETERMINISTIC_RESOLUTION_DOMINATES',
    `确定性命中时不得铸模型 proposal：${JSON.stringify(denied)}`);
  assert(page.control.calls.perform === 0, 'deterministic dominance 检查不得执行 action');
});

// sourceObligationId:zs-authority-runner-e5 unitCheckId:zero-shot-authority-runner-e5
await check('typed progress 闭集拒 unknown op、空值、host/query/hash 与 extra key', async () => {
  const invalid = [
    { kind: 'urlPathname', op: 'contains', value: '/help' },
    { kind: 'urlPathname', op: 'startsWith', value: '' },
    { kind: 'urlPathname', op: 'startsWith', value: 'https://example.invalid/help' },
    { kind: 'urlPathname', op: 'startsWith', value: '/help?token=secret' },
    { kind: 'urlPathname', op: 'startsWith', value: '/help#fragment' },
    { kind: 'urlPathname', op: 'equals', value: '/help', source: 'model' },
  ];
  for (const expected of invalid) {
    const denied = contractResult([expected]);
    assert(denied?.ok === false && denied.reason === 'EXPECTED_PROGRESS_NOT_ALLOWED',
      `越界 progress 必须拒：${JSON.stringify({ expected, denied })}`);
  }
});

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.error(`\nzero-shot-authority-runner: ${passed} passed, ${failures.length} failed`);
  process.exit(1);
}

console.log(`\nzero-shot-authority-runner: ${passed}/5 passed`);
