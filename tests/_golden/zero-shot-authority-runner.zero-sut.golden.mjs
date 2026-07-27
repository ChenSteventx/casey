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
const TOTAL = 11;

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

const READ_UNSAFE_NAMES = Object.freeze([
  '退出', '注销', '删除', '移除', '发布', '保存', '提交', '确认', '撤销',
  '清空', '停用', '启用', '创建', '新建', '添加', '绑定', '解绑',
  'logout', 'delete', 'remove', 'revoke', 'publish', 'save', 'submit',
  'confirm', 'clear', 'disable', 'enable', 'create', 'add', 'bind', 'unbind',
  'sign out', '登出', '销户', '永久抹除', 'archive', 'approve',
]);

const READ_SAFE_NAMES = Object.freeze([
  '继续', '打开详情', '查看帮助', '进入详情', '返回', '更多',
  'continue', 'open details', 'view help', 'enter', 'back', 'more',
]);

const UNKNOWN_LINK_NAME = '账户中心';

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
  afterPerform,
} = {}) {
  return createPageDriverDouble({
    snapshots: [
      snapshot('rev_1', beforePath, beforeAffordances),
      snapshot('rev_2', afterPath, []),
    ],
    ...(afterPerform ? { afterPerform } : {}),
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
      rawAffordance({ handleId: 'continue', role: 'link', accessibleName: '继续' }),
      rawAffordance({ handleId: 'cancel', role: 'link', accessibleName: '取消' }),
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
  assert(page.control.calls.perform === 1 && page.control.calls.revalidate === 2
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
      rawAffordance({ handleId: 'continue', role: 'link', accessibleName: '继续' }),
      rawAffordance({ handleId: 'more', role: 'link', accessibleName: '查看更多' }),
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

// sourceObligationId:zs-authority-runner-e6 unitCheckId:zero-shot-authority-runner-e6
await check('admission 后动作前预取 fresh observation 必须使旧 admission 失效', async () => {
  const page = makePage();
  const stepContract = mustContract();
  const before = await mustObserve(page.driver);
  const resolution = resolveDeterministicAction({ stepContract, observation: before.observation });
  const admitted = await admitZeroShotAction({
    stepContract,
    observation: before.observation,
    observationAuthority: before.authority,
    resolution,
  });
  assert(admitted?.ok === true, `攻击前置 admission 应成功：${JSON.stringify(admitted)}`);
  page.control.setUrl('https://example.invalid/help/article?ignored=secret#ignored');
  const capturedBeforeAction = await mustObserve(page.driver);
  assert(capturedBeforeAction.observation.urlPathname === '/help/article', '须先取得看似满足 progress 的 observation');
  const executed = await executeAdmittedAction({ admission: admitted.admission });
  assert(executed?.ok === false && executed.reason === 'STALE_OBSERVATION',
    `动作前已有更新 observation 时旧 admission 必须失效：${JSON.stringify(executed)}`);
  assert(page.control.calls.perform === 0, '旧 admission 失效后 action adapter 必须零调用');
});

// sourceObligationId:zs-authority-runner-e7 unitCheckId:zero-shot-authority-runner-e7
await check('admission 后 DOM 语义漂移必须在 execute 前二次重验拦住', async () => {
  const page = makePage();
  const stepContract = mustContract();
  const before = await mustObserve(page.driver);
  const resolution = resolveDeterministicAction({ stepContract, observation: before.observation });
  const admitted = await admitZeroShotAction({
    stepContract,
    observation: before.observation,
    observationAuthority: before.authority,
    resolution,
  });
  page.control.setRevalidation({ sameNode: false });
  const executed = await executeAdmittedAction({ admission: admitted.admission });
  assert(executed?.ok === false && executed.reason === 'AFFORDANCE_DRIFTED',
    `admission 后同节点语义/物理身份漂移必须拒：${JSON.stringify(executed)}`);
  assert(page.control.calls.revalidate === 2 && page.control.calls.perform === 0,
    `execute 前必须二次重验且不得动作：${JSON.stringify(page.control.calls)}`);
});

// sourceObligationId:zs-authority-runner-e8 unitCheckId:zero-shot-authority-runner-e8
await check('同一 observationAuthority 并发双铸 admission 最多成功一个', async () => {
  const page = makePage();
  const stepContract = mustContract();
  const before = await mustObserve(page.driver);
  const resolution = resolveDeterministicAction({ stepContract, observation: before.observation });
  const request = {
    stepContract,
    observation: before.observation,
    observationAuthority: before.authority,
    resolution,
  };
  const pair = await Promise.all([
    admitZeroShotAction(request),
    admitZeroShotAction(request),
  ]);
  const allowed = pair.filter((item) => item?.ok === true);
  const denied = pair.filter((item) => item?.ok === false);
  assert(allowed.length === 1 && denied.length === 1
    && denied[0].reason === 'OBSERVATION_ALREADY_ADMITTED',
  `并发 admission 必须单飞：${JSON.stringify(pair)}`);
  const executed = await executeAdmittedAction({ admission: allowed[0].admission });
  assert(executed?.ok === true && page.control.calls.perform === 1,
    `单飞 admission 最终只准执行一次：${JSON.stringify(executed)}`);
});

// sourceObligationId:zs-authority-runner-e9 unitCheckId:zero-shot-authority-runner-e9
await check('perform pending 期间产生 observation 时不得铸 action receipt 或证明 progress', async () => {
  let releasePerform;
  let markPerformEntered;
  const entered = new Promise((resolve) => { markPerformEntered = resolve; });
  const release = new Promise((resolve) => { releasePerform = resolve; });
  const page = makePage({
    afterPerform: async () => {
      markPerformEntered();
      await release;
    },
  });
  const stepContract = mustContract();
  const before = await mustObserve(page.driver);
  const resolution = resolveDeterministicAction({ stepContract, observation: before.observation });
  const admitted = await admitZeroShotAction({
    stepContract,
    observation: before.observation,
    observationAuthority: before.authority,
    resolution,
  });
  const execution = executeAdmittedAction({ admission: admitted.admission });
  await entered;
  page.control.setUrl('https://example.invalid/help/article?ignored=secret#ignored');
  const capturedWhilePending = await mustObserve(page.driver);
  releasePerform();
  const executed = await execution;
  assert(executed?.ok === false && executed.reason === 'STALE_OBSERVATION'
    && !executed.actionReceipt, `perform 并发观察后不得铸 receipt：${JSON.stringify(executed)}`);
  const progress = verifyStepProgress({
    stepContract,
    beforeObservation: before.observation,
    actionReceipt: executed.actionReceipt,
    afterObservation: capturedWhilePending.observation,
    afterObservationAuthority: capturedWhilePending.authority,
  });
  assert(progress?.status === 'pending' && progress.reason === 'ACTION_RECEIPT_AUTHORITY_INVALID',
    `动作完成前证据不得证明 progress：${JSON.stringify(progress)}`);
  assert(page.control.calls.perform === 1, '动作事实可能已发生，但不得自动重试或签 receipt');
});

// sourceObligationId:zs-authority-runner-e10 unitCheckId:zero-shot-authority-runner-e10
await check('zero-hit proposal 不得把 destructive/unrelated button 冒充 read 候选', async () => {
  const page = makePage({
    beforeAffordances: [
      rawAffordance({
        handleId: 'destructive-button',
        role: 'button',
        accessibleName: '永久删除',
      }),
      rawAffordance({
        handleId: 'logout-link',
        role: 'link',
        accessibleName: '退出登录',
      }),
    ],
  });
  const stepContract = mustContract();
  const before = await mustObserve(page.driver);
  for (const target of before.observation.affordances) {
    const denied = createActionProposal({
      stepContract,
      observation: before.observation,
      rawProposal: proposalRaw(before.observation, target.affordanceId),
    });
    assert(denied?.ok === false && denied.reason === 'PROPOSAL_TARGET_NOT_READ_SAFE',
      `模型不得把风险候选继承成 read：${JSON.stringify({ target, denied })}`);
  }
  for (const name of READ_UNSAFE_NAMES) {
    const riskPage = makePage({
      beforeAffordances: [
        rawAffordance({ handleId: `risk-${name}`, role: 'link', accessibleName: name }),
      ],
    });
    const riskBefore = await mustObserve(riskPage.driver);
    const denied = createActionProposal({
      stepContract,
      observation: riskBefore.observation,
      rawProposal: proposalRaw(
        riskBefore.observation,
        riskBefore.observation.affordances[0].affordanceId,
      ),
    });
    assert(denied?.ok === false && denied.reason === 'PROPOSAL_TARGET_NOT_READ_SAFE',
      `风险名称 ${name} 必须确定性拒绝：${JSON.stringify(denied)}`);
    assert(riskPage.control.calls.perform === 0, `风险名称 ${name} 不得执行`);
  }
  const unknownPage = makePage({
    beforeAffordances: [
      rawAffordance({ handleId: 'unknown-link', role: 'link', accessibleName: UNKNOWN_LINK_NAME }),
    ],
  });
  const unknownBefore = await mustObserve(unknownPage.driver);
  const unknownDenied = createActionProposal({
    stepContract,
    observation: unknownBefore.observation,
    rawProposal: proposalRaw(
      unknownBefore.observation,
      unknownBefore.observation.affordances[0].affordanceId,
    ),
  });
  assert(unknownDenied?.ok === false && unknownDenied.reason === 'PROPOSAL_TARGET_NOT_READ_SAFE',
    `未知 link 不得因未命中 denylist 自动获权：${JSON.stringify(unknownDenied)}`);
  for (const name of READ_SAFE_NAMES) {
    const safePage = makePage({
      beforeAffordances: [
        rawAffordance({ handleId: `safe-${name}`, role: 'link', accessibleName: name }),
      ],
    });
    const safeBefore = await mustObserve(safePage.driver);
    const created = createActionProposal({
      stepContract,
      observation: safeBefore.observation,
      rawProposal: proposalRaw(
        safeBefore.observation,
        safeBefore.observation.affordances[0].affordanceId,
      ),
    });
    assert(created?.ok === true, `窄 allowlist 的安全链接应可铸 proposal：${name}`);
  }
  assert(page.control.calls.revalidate === 0 && page.control.calls.perform === 0,
    'unsafe proposal 必须在 admission/execute 前拒绝');
});

// sourceObligationId:zs-authority-runner-e11 unitCheckId:zero-shot-authority-runner-e11
await check('deterministic exact 也不得把非 link 或风险名称 + 自报 read 直接执行', async () => {
  const risks = [
    { handleId: 'destructive-button', role: 'button', accessibleName: '永久删除' },
    ...['退出登录', 'sign out', '登出', '销户', '永久抹除', 'archive', 'approve', UNKNOWN_LINK_NAME]
      .map((accessibleName, index) => ({
        handleId: `unsafe-link-${index}`,
        role: 'link',
        accessibleName,
      })),
  ];
  for (const risk of risks) {
    const contract = freezeZeroShotStepContract({
      testcase,
      intentPlan: buildIntentPlan({ testcase, registry: REGISTRY }),
      intentId: INTENT_ID,
      action: 'click',
      target: {
        kind: 'role',
        role: risk.role,
        name: risk.accessibleName,
        exact: true,
      },
      effect: 'read',
      expectedProgress: [{ kind: 'urlPathname', op: 'startsWith', value: '/help' }],
      userConfirmed: true,
    });
    assert(contract?.ok === true,
      `攻击前置须能重现自报 read contract：${JSON.stringify(contract)}`);
    const page = makePage({ beforeAffordances: [rawAffordance(risk)] });
    const before = await mustObserve(page.driver);
    const resolution = resolveDeterministicAction({
      stepContract: contract.contract,
      observation: before.observation,
    });
    assert(resolution?.status === 'resolved', '攻击前置须 deterministic exact 命中');
    const denied = await admitZeroShotAction({
      stepContract: contract.contract,
      observation: before.observation,
      observationAuthority: before.authority,
      resolution,
    });
    assert(denied?.ok === false && denied.reason === 'ACTION_TARGET_NOT_READ_SAFE',
      `自报 read 不能给风险目标扩权：${JSON.stringify({ risk, denied })}`);
    assert(page.control.calls.perform === 0, 'deterministic 风险目标不得执行');
  }
});

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.error(`\nzero-shot-authority-runner: ${passed} passed, ${failures.length} failed`);
  process.exit(1);
}

console.log(`\nzero-shot-authority-runner: ${passed}/${TOTAL} passed`);
