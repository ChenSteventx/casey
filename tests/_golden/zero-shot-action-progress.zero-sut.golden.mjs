#!/usr/bin/env node
// zero-shot-observe-admit-step / C：admission、single execute、fresh progress、candidate trace。
// adapter double 只证明内核控制流；零 SUT、零 server、零浏览器、零网络。

import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

const TAG = 'zero-shot-action-progress';
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
    failures.push(`${name}: ${error?.message || error}`);
    console.error(`RED  ${TAG}: ${name}: ${error?.message || error}`);
  }
}

async function loadApi(relativePath, names) {
  try {
    const mod = await import(new URL(relativePath, import.meta.url).href);
    for (const name of names) {
      if (typeof mod[name] !== 'function') throw new Error(`${relativePath} 未导出 ${name}`);
    }
    return mod;
  } catch (error) {
    console.error(`RED  ${TAG}: 导入验收 API 失败（实现前预期红）：${String(error?.message || error).slice(-300)}`);
    process.exit(1);
  }
}

const { createPageDriverDouble } = await loadApi(
  './fixtures/zero-shot-observe-admit-step/adapter-double.mjs',
  ['createPageDriverDouble'],
);
const { freezeZeroShotStepContract } = await loadApi(
  '../../lib/zero-shot/step-contract.mjs',
  ['freezeZeroShotStepContract'],
);
const { observePage } = await loadApi(
  '../../lib/zero-shot/page-observer.mjs',
  ['observePage'],
);
const { resolveDeterministicAction } = await loadApi(
  '../../lib/zero-shot/deterministic-resolver.mjs',
  ['resolveDeterministicAction'],
);
const { createActionProposal } = await loadApi(
  '../../lib/zero-shot/action-proposal.mjs',
  ['createActionProposal'],
);
const { admitZeroShotAction } = await loadApi(
  '../../lib/zero-shot/action-admission.mjs',
  ['admitZeroShotAction'],
);
const { executeAdmittedAction } = await loadApi(
  '../../lib/zero-shot/step-executor.mjs',
  ['executeAdmittedAction'],
);
const { verifyStepProgress } = await loadApi(
  '../../lib/zero-shot/progress-verifier.mjs',
  ['verifyStepProgress'],
);
const { createExplorationTrace } = await loadApi(
  '../../lib/zero-shot/exploration-trace.mjs',
  ['createExplorationTrace'],
);
const { runSingleZeroShotStep } = await loadApi(
  '../../lib/zero-shot/single-step-runner.mjs',
  ['runSingleZeroShotStep'],
);
const { buildIntentPlan } = await loadApi(
  '../../lib/intent-plan.mjs',
  ['buildIntentPlan'],
);

const CASE_ID = 'tc_zero_shot_action';
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

function eligiblePlan() {
  return buildIntentPlan({ testcase, registry: REGISTRY });
}

function mustContract({ expectedValue = '/help', expectedOp = 'startsWith' } = {}) {
  const result = freezeZeroShotStepContract({
    testcase,
    intentPlan: eligiblePlan(),
    intentId: INTENT_ID,
    action: 'click',
    target: { kind: 'role', role: 'link', name: TARGET_NAME, exact: true },
    effect: 'read',
    expectedProgress: [{ kind: 'urlPathname', op: expectedOp, value: expectedValue }],
    userConfirmed: true,
  });
  assert(result?.ok === true && result.contract, `step contract 应冻结成功：${JSON.stringify(result)}`);
  return result.contract;
}

function rawAffordance({
  handleId = 'help-link',
  role = 'link',
  accessibleName = TARGET_NAME,
  label = null,
  text = TARGET_NAME,
} = {}) {
  return { handleId, role, accessibleName, label, text, visible: true, enabled: true, actionSpace: ['click'] };
}

function snapshot({
  revision,
  path,
  settled = true,
  unsupportedScopes = [],
  affordances = [rawAffordance()],
} = {}) {
  return {
    revision,
    url: `https://example.invalid${path}?ignored=secret#ignored`,
    title: '帮助入口',
    settled,
    unsupportedScopes,
    affordances,
  };
}

function makeDouble({
  beforePath = '/home',
  afterPath = '/help/article',
  afterSettled = true,
  revalidate = {},
  performError = null,
  beforeAffordances,
  afterAffordances,
} = {}) {
  return createPageDriverDouble({
    snapshots: [
      snapshot({ revision: 'rev_1', path: beforePath, affordances: beforeAffordances }),
      snapshot({ revision: 'rev_2', path: afterPath, settled: afterSettled, affordances: afterAffordances }),
    ],
    revalidate: {
      connected: true,
      sameNode: true,
      pageCount: 1,
      visible: true,
      enabled: true,
      ...revalidate,
    },
    performError,
  });
}

async function mustObserve(driver) {
  const result = await observePage({ driver, intentId: INTENT_ID, maxCandidates: 20 });
  assert(result?.ok === true && result.observation && result.authority,
    `observe 应成功：${JSON.stringify(result)}`);
  return result;
}

function mustResolution(stepContract, observation) {
  const result = resolveDeterministicAction({ stepContract, observation });
  assert(result?.status === 'resolved', `应确定性 resolved：${JSON.stringify(result)}`);
  return result;
}

async function mustAdmission({ stepContract, observed, resolution, identityAdmission } = {}) {
  const result = await admitZeroShotAction({
    stepContract,
    observation: observed.observation,
    observationAuthority: observed.authority,
    resolution,
    ...(identityAdmission === undefined ? {} : { identityAdmission }),
  });
  assert(result?.ok === true && result.reason == null && result.admission,
    `admission 应通过：${JSON.stringify(result)}`);
  return result.admission;
}

async function closedHappy(options = {}) {
  const page = makeDouble(options);
  const stepContract = mustContract(options);
  const before = await mustObserve(page.driver);
  const resolution = mustResolution(stepContract, before.observation);
  const admission = await mustAdmission({ stepContract, observed: before, resolution });
  const executed = await executeAdmittedAction({ admission });
  assert(executed?.ok === true && executed.actionReceipt?.performed === true,
    `action 应恰一次成功：${JSON.stringify(executed)}`);
  const after = await mustObserve(page.driver);
  const progress = verifyStepProgress({
    stepContract,
    beforeObservation: before.observation,
    actionReceipt: executed.actionReceipt,
    afterObservation: after.observation,
    afterObservationAuthority: after.authority,
  });
  return {
    page,
    stepContract,
    before,
    resolution,
    admission,
    executed,
    after,
    progress,
  };
}

function noVerdictClaims(value) {
  const forbiddenKeys = new Set(['verdict', 'passes', 'expectedVerdict']);
  const seen = new Set();
  function walk(node) {
    if (node === null || typeof node !== 'object') {
      return node !== 'PASS' && node !== 'SUT_DEFECT' && node !== 'HARNESS_ERROR';
    }
    if (seen.has(node)) return true;
    seen.add(node);
    if (Array.isArray(node)) return node.every(walk);
    for (const [key, child] of Object.entries(node)) {
      if (forbiddenKeys.has(key) || !walk(child)) return false;
    }
    return true;
  }
  return walk(value);
}

check('C1 happy：action 恰一次，fresh after pathname 满足冻结 progress 才 progressed', async () => {
  const run = await closedHappy();
  assert(run.progress?.status === 'progressed' && run.progress.reason == null && run.progress.progressReceipt,
    `progress 应 proved：${JSON.stringify(run.progress)}`);
  assert(run.page.control.calls.perform === 1, `perform 应恰 1，实际 ${run.page.control.calls.perform}`);
  assert(run.page.control.calls.revalidate === 1, `revalidate 应恰 1，实际 ${run.page.control.calls.revalidate}`);
  assert(run.page.control.calls.snapshot === 2 && run.page.control.calls.settle === 2,
    `before/after 必须各 fresh observe：${JSON.stringify(run.page.control.calls)}`);
  for (const forgedReceipt of [
    structuredClone(run.executed.actionReceipt),
    { ...run.executed.actionReceipt },
    { performed: true },
  ]) {
    const denied = verifyStepProgress({
      stepContract: run.stepContract,
      beforeObservation: run.before.observation,
      actionReceipt: forgedReceipt,
      afterObservation: run.after.observation,
      afterObservationAuthority: run.after.authority,
    });
    assert(denied.status === 'pending' && denied.reason === 'ACTION_RECEIPT_AUTHORITY_INVALID',
      `伪造 actionReceipt 不得证明进展：${JSON.stringify(denied)}`);
  }
  const tampered = verifyStepProgress({
    stepContract: run.stepContract,
    beforeObservation: run.before.observation,
    actionReceipt: run.executed.actionReceipt,
    afterObservation: { ...run.after.observation, urlPathname: '/help/forged' },
    afterObservationAuthority: run.after.authority,
  });
  assert(tampered.status === 'pending' && tampered.reason === 'OBSERVATION_AUTHORITY_MISMATCH',
    `真 authority 不得给篡改 observation 背书：${JSON.stringify(tampered)}`);
});

check('C2 admission 失败 action 零调用：旧 observation、JSON clone、错误 affordance namespace', async () => {
  const page = makeDouble();
  const stepContract = mustContract();
  const old = await mustObserve(page.driver);
  const current = await mustObserve(page.driver); // 同 driver 新 observation 撤销旧 authority。
  const oldResolution = mustResolution(stepContract, old.observation);
  const stale = await admitZeroShotAction({
    stepContract,
    observation: old.observation,
    observationAuthority: old.authority,
    resolution: oldResolution,
  });
  assert(stale?.ok === false && stale.reason === 'STALE_OBSERVATION', `旧 observation 应拒：${JSON.stringify(stale)}`);

  const clone = structuredClone(old.observation);
  let clonedAuthority;
  try {
    clonedAuthority = structuredClone(old.authority);
  } catch {
    clonedAuthority = {};
  }
  const forged = await admitZeroShotAction({
    stepContract,
    observation: clone,
    observationAuthority: clonedAuthority,
    resolution: oldResolution,
  });
  assert(forged?.ok === false, `JSON clone 不得铸权：${JSON.stringify(forged)}`);

  const currentResolution = mustResolution(stepContract, current.observation);
  for (const forgedContract of [structuredClone(stepContract), { ...stepContract }, JSON.parse(JSON.stringify(stepContract))]) {
    const denied = await admitZeroShotAction({
      stepContract: forgedContract,
      observation: current.observation,
      observationAuthority: current.authority,
      resolution: currentResolution,
    });
    assert(denied?.ok === false && denied.reason === 'CONTRACT_AUTHORITY_INVALID',
      `伪造 contract 不得 admission：${JSON.stringify(denied)}`);
  }
  const crossed = await admitZeroShotAction({
    stepContract,
    observation: current.observation,
    observationAuthority: current.authority,
    resolution: { ...currentResolution, targetAffordanceId: 'entity_candidate_1' },
  });
  assert(crossed?.ok === false, `entity candidateId 不得冒充 affordanceId：${JSON.stringify(crossed)}`);
  assert(page.control.calls.perform === 0, '所有 admission 拒绝路径 action 必须零调用');
});

check('C3 DOM replacement 在 admission 重验关闭 TOCTOU 窗，action 零调用', async () => {
  const page = makeDouble({ revalidate: { sameNode: false } });
  const stepContract = mustContract();
  const before = await mustObserve(page.driver);
  const resolution = mustResolution(stepContract, before.observation);
  const result = await admitZeroShotAction({
    stepContract,
    observation: before.observation,
    observationAuthority: before.authority,
    resolution,
  });
  assert(result?.ok === false && result.reason === 'AFFORDANCE_DRIFTED',
    `DOM replacement 应拒：${JSON.stringify(result)}`);
  assert(page.control.calls.revalidate === 1 && page.control.calls.perform === 0,
    `只准重验一次、不得执行：${JSON.stringify(page.control.calls)}`);
});

check('C3a resolution 是 opaque authority：换指 catalog 内另一合法 af_* 的 clone/spread/手造件全拒', async () => {
  const page = makeDouble({
    beforeAffordances: [
      rawAffordance(),
      rawAffordance({ handleId: 'other-link', accessibleName: '其他入口', text: '其他入口' }),
    ],
  });
  const stepContract = mustContract();
  const before = await mustObserve(page.driver);
  const resolution = mustResolution(stepContract, before.observation);
  const otherId = before.observation.affordances.find((item) => item.affordanceId !== resolution.targetAffordanceId)?.affordanceId;
  assert(/^af_/.test(otherId), '攻击前置须有另一个合法 af_*');
  const clonedResolution = structuredClone(resolution);
  clonedResolution.targetAffordanceId = otherId;
  const forged = [
    clonedResolution,
    { ...resolution, targetAffordanceId: otherId },
    { status: 'resolved', reason: null, action: 'click', targetAffordanceId: otherId },
  ];
  for (const candidate of forged) {
    const denied = await admitZeroShotAction({
      stepContract,
      observation: before.observation,
      observationAuthority: before.authority,
      resolution: candidate,
    });
    assert(denied?.ok === false && denied.reason === 'RESOLUTION_AUTHORITY_INVALID',
      `伪造 resolution 不得 admission：${JSON.stringify(denied)}`);
  }
  const authentic = await mustAdmission({ stepContract, observed: before, resolution });
  assert(authentic && page.control.calls.perform === 0, '真 resolution 只可铸 admission，尚不得执行');
});

check('C4 connected/pageCount/visible/enabled 任一不满足都拒且 action 零调用', async () => {
  const cases = [
    [{ connected: false }, 'AFFORDANCE_DRIFTED'],
    [{ pageCount: 2 }, 'AFFORDANCE_AMBIGUOUS'],
    [{ visible: false }, 'AFFORDANCE_NOT_ACTIONABLE'],
    [{ enabled: false }, 'AFFORDANCE_NOT_ACTIONABLE'],
  ];
  for (const [patch, reason] of cases) {
    const page = makeDouble({ revalidate: patch });
    const stepContract = mustContract();
    const before = await mustObserve(page.driver);
    const resolution = mustResolution(stepContract, before.observation);
    const result = await admitZeroShotAction({
      stepContract,
      observation: before.observation,
      observationAuthority: before.authority,
      resolution,
    });
    assert(result?.ok === false && result.reason === reason, `${reason} 应拒：${JSON.stringify(result)}`);
    assert(page.control.calls.perform === 0, `${reason} 不得执行 action`);
  }
});

check('C5 identity pending 只能加严拒绝，不能因 read/名称唯一放行', async () => {
  const page = makeDouble();
  const stepContract = mustContract();
  const before = await mustObserve(page.driver);
  const resolution = mustResolution(stepContract, before.observation);
  const result = await admitZeroShotAction({
    stepContract,
    observation: before.observation,
    observationAuthority: before.authority,
    resolution,
    identityAdmission: { required: true, status: 'pending' },
  });
  assert(result?.ok === false && result.reason === 'ENTITY_IDENTITY_PENDING',
    `identity pending 应硬停：${JSON.stringify(result)}`);
  assert(page.control.calls.perform === 0, 'identity pending 不得动作');
});

check('C5a zero-hit bounded proposal 的真 authority 可闭环，换指另一合法 af_* 的伪造 proposal 全拒', async () => {
  const page = makeDouble({
    beforeAffordances: [
      rawAffordance({ handleId: 'continue', role: 'button', accessibleName: '继续', text: '继续' }),
      rawAffordance({ handleId: 'cancel', role: 'button', accessibleName: '取消', text: '取消' }),
    ],
  });
  const stepContract = mustContract();
  const before = await mustObserve(page.driver);
  const unresolved = resolveDeterministicAction({ stepContract, observation: before.observation });
  assert(unresolved.status === 'proposal-required', `zero-hit 应开放 bounded proposal：${JSON.stringify(unresolved)}`);
  const [chosen, other] = before.observation.affordances;
  const rawProposal = {
    schemaVersion: 1,
    artifactKind: 'zero-shot-action-proposal',
    observationId: before.observation.observationId,
    intentId: INTENT_ID,
    targetAffordanceId: chosen.affordanceId,
    action: 'click',
  };
  const created = createActionProposal({ stepContract, observation: before.observation, rawProposal });
  assert(created?.ok === true && created.proposal, `合规 proposal 应铸 authority：${JSON.stringify(created)}`);
  const clonedProposal = structuredClone(created.proposal);
  clonedProposal.targetAffordanceId = other.affordanceId;
  for (const forged of [
    clonedProposal,
    { ...created.proposal, targetAffordanceId: other.affordanceId },
    { ...rawProposal, targetAffordanceId: other.affordanceId },
  ]) {
    const denied = await admitZeroShotAction({
      stepContract,
      observation: before.observation,
      observationAuthority: before.authority,
      proposal: forged,
    });
    assert(denied?.ok === false && denied.reason === 'PROPOSAL_AUTHORITY_INVALID',
      `伪造 proposal 不得 admission：${JSON.stringify(denied)}`);
  }
  const admitted = await admitZeroShotAction({
    stepContract,
    observation: before.observation,
    observationAuthority: before.authority,
    proposal: created.proposal,
  });
  assert(admitted?.ok === true && admitted.admission, `真 proposal 应 admission：${JSON.stringify(admitted)}`);
  const executed = await executeAdmittedAction({ admission: admitted.admission });
  const after = await mustObserve(page.driver);
  const progress = verifyStepProgress({
    stepContract,
    beforeObservation: before.observation,
    actionReceipt: executed.actionReceipt,
    afterObservation: after.observation,
    afterObservationAuthority: after.authority,
  });
  assert(progress.status === 'progressed' && page.control.calls.perform === 1,
    `proposal 闭环应恰一次 progressed：${JSON.stringify(progress)}`);
});

check('C6 action adapter 抛错只调用一次，admission 已消费，不换目标、不重试', async () => {
  const page = makeDouble({ performError: new Error('synthetic action failure') });
  const stepContract = mustContract();
  const before = await mustObserve(page.driver);
  const resolution = mustResolution(stepContract, before.observation);
  const admission = await mustAdmission({ stepContract, observed: before, resolution });
  for (const forged of [
    structuredClone(admission),
    { ...admission },
    { action: 'click', targetAffordanceId: resolution.targetAffordanceId },
  ]) {
    const denied = await executeAdmittedAction({ admission: forged });
    assert(denied?.ok === false && denied.reason === 'ADMISSION_AUTHORITY_INVALID',
      `伪造 admission 不得执行：${JSON.stringify(denied)}`);
  }
  assert(page.control.calls.perform === 0, '伪造 admission 全部拒绝后 perform 仍须为 0');
  const first = await executeAdmittedAction({ admission });
  assert(first?.ok === false && first.reason === 'ACTION_EXECUTION_FAILED',
    `动作异常应结构化失败：${JSON.stringify(first)}`);
  const second = await executeAdmittedAction({ admission });
  assert(second?.ok === false && second.reason === 'ADMISSION_ALREADY_CONSUMED',
    `一次性 admission 不得重试：${JSON.stringify(second)}`);
  assert(page.control.calls.perform === 1, `perform 异常也只能 1 次，实际 ${page.control.calls.perform}`);
});

check('C7 action success 但 after unsettled 或 pathname 无进展，intent 仍 pending', async () => {
  const unsettled = await closedHappy({ afterSettled: false });
  assert(unsettled.progress?.status === 'pending' && unsettled.progress.reason === 'OBSERVATION_UNSETTLED',
    `after unsettled 不得 progressed：${JSON.stringify(unsettled.progress)}`);

  const unchanged = await closedHappy({ afterPath: '/home' });
  assert(unchanged.progress?.status === 'pending' && unchanged.progress.reason === 'EXPECTED_PROGRESS_NOT_PROVED',
    `pathname 无进展不得 progressed：${JSON.stringify(unchanged.progress)}`);
  assert(unchanged.page.control.calls.perform === 1, 'action success 事实保留，但不能替代 progress');

  const alreadySatisfied = await closedHappy({ beforePath: '/help', afterPath: '/help/article' });
  assert(alreadySatisfied.progress?.status === 'pending'
    && alreadySatisfied.progress.reason === 'EXPECTED_PROGRESS_NOT_CAUSED',
  `before 已满足 startsWith 时不得把 after 仍满足冒充本动作因果：${JSON.stringify(alreadySatisfied.progress)}`);
});

check('C8 fresh after 必须与 action lineage 同 driver，跨 driver observation 拒', async () => {
  const left = makeDouble();
  const right = makeDouble();
  const stepContract = mustContract();
  const before = await mustObserve(left.driver);
  const resolution = mustResolution(stepContract, before.observation);
  const admission = await mustAdmission({ stepContract, observed: before, resolution });
  const executed = await executeAdmittedAction({ admission });
  const foreignAfter = await mustObserve(right.driver);
  const result = verifyStepProgress({
    stepContract,
    beforeObservation: before.observation,
    actionReceipt: executed.actionReceipt,
    afterObservation: foreignAfter.observation,
    afterObservationAuthority: foreignAfter.authority,
  });
  assert(result?.status === 'pending' && result.reason === 'OBSERVATION_LINEAGE_MISMATCH',
    `跨 driver after 不得证明进展：${JSON.stringify(result)}`);
});

check('C9 exploration trace 稳定、单步、恒未签不可回放且无机器裁定字段', async () => {
  const run = await closedHappy();
  assert(run.progress.status === 'progressed', 'trace happy 前置须 progressed');
  const input = {
    stepContract: run.stepContract,
    beforeObservation: run.before.observation,
    admission: run.admission,
    actionReceipt: run.executed.actionReceipt,
    afterObservation: run.after.observation,
    progressReceipt: run.progress.progressReceipt,
  };
  const first = createExplorationTrace(input);
  const second = createExplorationTrace(input);
  assert(isDeepStrictEqual(first, second), '相同事实 trace 必须确定性稳定');
  assert(first?.artifactKind === 'zero-shot-exploration-trace'
    && first.signed === false && first.replayReady === false, 'trace 不得冒充正式资产');
  assert(Array.isArray(first.steps) && first.steps.length === 1, '本契约 trace 只含一个 candidate step');
  assert(noVerdictClaims(first), `trace 不得出现 PASS/verdict/passes：${JSON.stringify(first).slice(0, 500)}`);
  assert(!JSON.stringify(first).includes('opaque-platform-id')
    && !JSON.stringify(first).includes('entity_candidate'), 'trace 不得混入伪造业务 identity');
});

check('C10 runSingleZeroShotStep 真实跑通 deterministic happy，不得只靠 static 空壳', async () => {
  const page = makeDouble();
  const result = await runSingleZeroShotStep({
    driver: page.driver,
    stepContract: mustContract(),
    maxCandidates: 20,
  });
  assert(result?.ok === true && result.progress?.status === 'progressed',
    `runner deterministic happy 应完成：${JSON.stringify(result)}`);
  assert(result.trace?.artifactKind === 'zero-shot-exploration-trace'
    && result.trace.signed === false && result.trace.replayReady === false, 'runner 须返回降权 trace');
  assert(page.control.calls.perform === 1 && page.control.calls.revalidate === 1
    && page.control.calls.snapshot === 2 && page.control.calls.settle === 2,
  `runner 必须真实走完整固定顺序：${JSON.stringify(page.control.calls)}`);
});

if (failures.length) {
  console.error(`RED  ${TAG}: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   ${TAG}: ${passed}/${passed}（single action + fresh progress + candidate trace）`);
