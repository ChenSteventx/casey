#!/usr/bin/env node
// zero-shot-observe-admit-step / B：step contract、deterministic resolver、bounded proposal。
// 纯 Node、零 SUT、零浏览器、零网络；本文件是冻结验收，实现 agent 不得修改。

import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

const TAG = 'deterministic-resolver-step-contract';
const failures = [];
let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok   ${TAG}: ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error?.message || error}`);
    console.error(`RED  ${TAG}: ${name}: ${error?.message || error}`);
  }
}

async function checkAsync(name, fn) {
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

const { freezeZeroShotStepContract } = await loadApi(
  '../../lib/zero-shot/step-contract.mjs',
  ['freezeZeroShotStepContract'],
);
const { resolveDeterministicAction } = await loadApi(
  '../../lib/zero-shot/deterministic-resolver.mjs',
  ['resolveDeterministicAction'],
);
const { createActionProposal } = await loadApi(
  '../../lib/zero-shot/action-proposal.mjs',
  ['createActionProposal'],
);
const { observePage } = await loadApi(
  '../../lib/zero-shot/page-observer.mjs',
  ['observePage'],
);
const { createPageDriverDouble } = await loadApi(
  './fixtures/zero-shot-observe-admit-step/adapter-double.mjs',
  ['createPageDriverDouble'],
);
const { buildIntentPlan, validateIntentPlanAuthority } = await loadApi(
  '../../lib/intent-plan.mjs',
  ['buildIntentPlan', 'validateIntentPlanAuthority'],
);

const CASE_ID = 'tc_zero_shot_step';
const INTENT_ID = 'intent_1';
const TARGET_NAME = '打开帮助';
const REGISTRY = JSON.parse(readFileSync(new URL('../../lib/atoms-registry.snapshot.json', import.meta.url), 'utf8'));

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

function freeze(overrides = {}) {
  return freezeZeroShotStepContract({
    testcase,
    intentPlan: eligiblePlan(),
    intentId: INTENT_ID,
    action: 'click',
    target: { kind: 'role', role: 'link', name: TARGET_NAME, exact: true },
    effect: 'read',
    expectedProgress: [{ kind: 'urlPathname', op: 'startsWith', value: '/help' }],
    userConfirmed: true,
    ...overrides,
  });
}

function mustFreeze(overrides = {}) {
  const result = freeze(overrides);
  assert(result?.ok === true && result.reason == null && result.contract, `应冻结成功：${JSON.stringify(result)}`);
  return result.contract;
}

function mustRejectFreeze(reason, overrides) {
  const result = freeze(overrides);
  assert(result?.ok === false, `应拒绝冻结：${JSON.stringify(result)}`);
  assert(result.reason === reason, `拒因应为 ${reason}，实际 ${JSON.stringify(result.reason)}`);
  assert(result.contract == null, '拒绝时不得产半份 contract');
}

function affordance({
  affordanceId = 'af_1',
  kind = 'role',
  role = 'link',
  name = TARGET_NAME,
  visible = true,
  enabled = true,
} = {}) {
  return {
    affordanceId,
    semantic: {
      kind,
      ...(kind === 'role' ? { role } : {}),
      name,
      exact: true,
    },
    visible,
    enabled,
    actionSpace: ['click'],
  };
}

function observation({
  observationId = 'obs_1',
  settled = true,
  truncated = false,
  unsupportedScopes = { iframe: false, shadow: false, containerOnly: false },
  affordances = [affordance()],
} = {}) {
  const signatures = affordances.map((item) => JSON.stringify(item.semantic));
  const projected = affordances.map((item, index) => {
    const pageCount = signatures.filter((signature) => signature === signatures[index]).length;
    return {
      ...item,
      pageCount,
      actionable: item.visible === true && item.enabled === true && pageCount === 1,
    };
  });
  return {
    schemaVersion: 1,
    artifactKind: 'page-observation',
    observationId,
    intentId: INTENT_ID,
    frameScope: 'main',
    urlPathname: '/home',
    title: '帮助入口',
    settled,
    catalogDigest: `sha256:${'a'.repeat(64)}`,
    affordances: projected,
    unsupportedScopes,
    truncated,
    signed: false,
    replayReady: false,
  };
}

function resolve(contract, obs = observation()) {
  return resolveDeterministicAction({ stepContract: contract, observation: obs });
}

function proposal(contract, obs, rawProposal) {
  return createActionProposal({ stepContract: contract, observation: obs, rawProposal });
}

async function observeZeroHitProposalSurface() {
  const { driver } = createPageDriverDouble({
    affordances: [
      {
        handleId: 'continue-button',
        role: 'button',
        accessibleName: '继续',
        text: '继续',
        visible: true,
        enabled: true,
        actionSpace: ['click'],
      },
      {
        handleId: 'cancel-button',
        role: 'button',
        accessibleName: '取消',
        text: '取消',
        visible: true,
        enabled: true,
        actionSpace: ['click'],
      },
    ],
  });
  const observed = await observePage({ driver, intentId: INTENT_ID, maxCandidates: 8 });
  assert(observed?.ok === true && observed.observation, `zero-hit observation 应成功：${JSON.stringify(observed)}`);
  return observed.observation;
}

check('B1 真正零 recipe + 人工确认 read click + pathname progress 可冻结为降权 contract', () => {
  const contract = mustFreeze();
  assert(contract.schemaVersion === 1 && contract.artifactKind === 'zero-shot-step-contract', 'contract 主标识不符');
  assert(contract.caseId === CASE_ID && contract.intentId === INTENT_ID, 'caseId/intentId 漂移');
  assert(contract.action === 'click' && contract.effect === 'read', 'MVP action/effect 漂移');
  assert(contract.target?.kind === 'role' && contract.target.role === 'link'
    && contract.target.name === TARGET_NAME && contract.target.exact === true, 'target 未精确冻结');
  assert(contract.signed === false && contract.replayReady === false, 'zero-shot contract 不得冒充已签/可回放');
  assert(contract.expectedProgress?.length === 1, '须冻结至少一条 typed progress');
});

check('B2 caseId/intentId/userConfirmed 缺口 fail-closed', () => {
  const otherTestcase = { ...testcase, caseId: 'tc_other' };
  mustRejectFreeze('CASE_ID_MISMATCH', {
    intentPlan: buildIntentPlan({ testcase: otherTestcase, registry: REGISTRY }),
  });
  mustRejectFreeze('INTENT_NOT_FOUND', { intentId: 'intent_missing' });
  mustRejectFreeze('USER_CONFIRMATION_REQUIRED', { userConfirmed: false });
});

check('B3 intent plan 必须是 builder-issued authority，clone/spread/handcrafted 均拒', () => {
  const plan = eligiblePlan();
  const authority = validateIntentPlanAuthority(plan);
  assert(authority?.ok === true && authority.defaultRecipes === true && authority.modelProposalsEmpty === true,
    `真实默认 builder plan authority 不符：${JSON.stringify(authority)}`);
  for (const forged of [
    structuredClone(plan),
    { ...plan },
    JSON.parse(JSON.stringify(plan)),
  ]) {
    assert(validateIntentPlanAuthority(forged)?.reason === 'INTENT_PLAN_AUTHORITY_INVALID', '伪造 plan 不得通过 authority');
    mustRejectFreeze('INTENT_PLAN_AUTHORITY_INVALID', { intentPlan: forged });
  }
  const tampered = eligiblePlan();
  tampered.caseId = 'tc_tampered';
  assert(validateIntentPlanAuthority(tampered)?.reason === 'INTENT_PLAN_AUTHORITY_INVALID',
    'builder-issued plan 原对象被改写后也必须失权');
  mustRejectFreeze('INTENT_PLAN_AUTHORITY_INVALID', { intentPlan: tampered });
});

check('B3a known/model mapping 都优先，含 ready:false 的 known override 也不能偷退 primitive', () => {
  const knownTestcase = {
    ...testcase,
    source: { kind: 'freetext', raw: '进入工作流管理' },
    steps: [{ intentId: INTENT_ID, intent: '进入工作流管理', actionHint: 'navigate', expected: [] }],
  };
  const known = buildIntentPlan({ testcase: knownTestcase, registry: REGISTRY });
  const model = buildIntentPlan({
    testcase,
    registry: REGISTRY,
    modelProposals: [{ intentId: INTENT_ID, atom: 'nav.workflowManagement', params: {} }],
  });
  const override = buildIntentPlan({
    testcase: knownTestcase,
    registry: REGISTRY,
    modelProposals: [{ intentId: INTENT_ID, atom: 'nav.workflowManagement', params: {} }],
  });
  const cases = [
    { testcase: knownTestcase, plan: known },
    { testcase, plan: model },
    { testcase: knownTestcase, plan: override },
  ];
  for (const item of cases) {
    mustRejectFreeze('KNOWN_ATOM_DOMINATES', { testcase: item.testcase, intentPlan: item.plan });
  }
});

check('B4 只有 MODEL_PROPOSAL_MISSING 可进入，其他 unresolved reason 原样硬阻断', () => {
  const missingParamTestcase = {
    ...testcase,
    source: { kind: 'freetext', raw: '打开指定工作流' },
    steps: [{ intentId: INTENT_ID, intent: '打开指定工作流', actionHint: 'click', expected: [] }],
  };
  mustRejectFreeze('MISSING_REQUIRED_PARAM', {
    testcase: missingParamTestcase,
    intentPlan: buildIntentPlan({ testcase: missingParamTestcase, registry: REGISTRY }),
  });
  const recipe = (ruleId, atom, params = {}) => ({
    ruleId,
    match: { intentEquals: '打开帮助', actionHint: 'click' },
    emit: { atom, params },
  });
  const hostilePlans = [
    ['KNOWN_RECIPE_AMBIGUOUS', buildIntentPlan({
      testcase,
      registry: REGISTRY,
      knownRecipes: [recipe('duplicate-a', 'nav.workflowManagement'), recipe('duplicate-b', 'nav.workflowManagement')],
    })],
    ['ATOM_NOT_COMPILABLE', buildIntentPlan({
      testcase,
      registry: REGISTRY,
      knownRecipes: [recipe('not-compilable', 'agent.selectModel')],
    })],
    ['BRIDGE_REJECTED', buildIntentPlan({
      testcase,
      registry: REGISTRY,
      modelProposals: [{ intentId: INTENT_ID, atom: 'workflow.open', params: { openName: '帮助' } }],
    })],
  ];
  for (const [reason, plan] of hostilePlans) {
    mustRejectFreeze(reason, { intentPlan: plan });
  }
});

check('B4a 默认 known TestCase 即使搭配 custom empty recipes 的真实 eligible plan 也不得绕过', () => {
  const knownTestcase = {
    ...testcase,
    source: { kind: 'freetext', raw: '进入工作流管理' },
    steps: [{ intentId: INTENT_ID, intent: '进入工作流管理', actionHint: 'navigate', expected: [] }],
  };
  const customEligible = buildIntentPlan({ testcase: knownTestcase, registry: REGISTRY, knownRecipes: [] });
  assert(customEligible.unresolved[0]?.reason === 'MODEL_PROPOSAL_MISSING', '攻击前置须真实铸出表面 eligible plan');
  mustRejectFreeze('KNOWN_ATOM_DOMINATES', { testcase: knownTestcase, intentPlan: customEligible });
  const realKnown = buildIntentPlan({ testcase: knownTestcase, registry: REGISTRY });
  mustRejectFreeze('KNOWN_ATOM_DOMINATES', { testcase: knownTestcase, intentPlan: realKnown });
});

check('B5 MVP 只收 click+read、exact role/label/text 和稳定 pathname progress', () => {
  mustRejectFreeze('ACTION_NOT_ALLOWED', { action: 'fill' });
  mustRejectFreeze('EFFECT_NOT_ALLOWED', { effect: 'mutation' });
  mustRejectFreeze('TARGET_NOT_ALLOWED', { target: { kind: 'role', role: 'button', name: TARGET_NAME, exact: false } });
  mustRejectFreeze('TARGET_NOT_ALLOWED', { target: { kind: 'css', selector: '#help', name: TARGET_NAME, exact: true } });
  mustRejectFreeze('EXPECTED_PROGRESS_REQUIRED', { expectedProgress: [] });
  mustRejectFreeze('EXPECTED_PROGRESS_NOT_ALLOWED', {
    expectedProgress: [{ kind: 'textVisible', op: 'appears', value: '帮助' }],
  });
});

check('B6 affordanceId、entity candidateId、platformId 严格分离', () => {
  mustRejectFreeze('TARGET_NOT_ALLOWED', {
    target: {
      kind: 'role', role: 'link', name: TARGET_NAME, exact: true,
      candidateId: 'entity_candidate_1',
    },
  });
  mustRejectFreeze('TARGET_NOT_ALLOWED', {
    target: {
      kind: 'role', role: 'link', name: TARGET_NAME, exact: true,
      platformId: 'opaque-platform-id',
    },
  });
  const contract = mustFreeze();
  assert(!JSON.stringify(contract).includes('platformId') && !JSON.stringify(contract).includes('candidateId'),
    'step contract 不得混入业务 identity 字段');
  const crossedObservation = observation({
    affordances: [affordance({ affordanceId: 'entity_candidate_1' })],
  });
  const crossedResolution = resolve(contract, crossedObservation);
  assert(crossedResolution.status !== 'resolved' && crossedResolution.reason === 'AFFORDANCE_ID_INVALID',
    `业务 candidateId 不得被 resolver 当 affordanceId：${JSON.stringify(crossedResolution)}`);
});

check('B6a step contract 是 WeakMap authority：clone/spread/handcrafted 全部拒绝', () => {
  const contract = mustFreeze();
  const controls = [
    structuredClone(contract),
    { ...contract },
    JSON.parse(JSON.stringify(contract)),
  ];
  for (const forged of controls) {
    const result = resolve(forged);
    assert(result.status === 'blocked' && result.reason === 'CONTRACT_AUTHORITY_INVALID',
      `伪造 contract 必须闭集拒：${JSON.stringify(result)}`);
  }
  assert(resolve(contract).status === 'resolved', '真 contract authority 对照应仍可用');
});

check('B7 exact role/label/text 全页恰一才确定性 resolved', () => {
  const roleContract = mustFreeze();
  const role = resolve(roleContract);
  assert(role.status === 'resolved' && role.targetAffordanceId === 'af_1' && role.action === 'click',
    `role 唯一应 resolved：${JSON.stringify(role)}`);

  for (const [kind, target, candidate] of [
    ['label', { kind: 'label', name: '帮助入口', exact: true }, affordance({ kind: 'label', name: '帮助入口' })],
    ['text', { kind: 'text', name: '帮助入口', exact: true }, affordance({ kind: 'text', name: '帮助入口' })],
  ]) {
    const contract = mustFreeze({ target });
    const result = resolve(contract, observation({ affordances: [candidate] }));
    assert(result.status === 'resolved', `${kind} 唯一应 resolved：${JSON.stringify(result)}`);
  }
});

await checkAsync('B7a 实际 observePage + adapter double 的 role/label/text 三种 resolver 链均可达', async () => {
  const cases = [
    {
      target: { kind: 'role', role: 'link', name: 'Role Help', exact: true },
      facts: { role: 'link', accessibleName: 'Role Help', label: null, text: 'Role Help' },
    },
    {
      target: { kind: 'label', name: 'Label Help', exact: true },
      facts: { role: null, accessibleName: null, label: 'Label Help', text: 'Label Help' },
    },
    {
      target: { kind: 'text', name: 'Text Help', exact: true },
      facts: { role: null, accessibleName: null, label: null, text: 'Text Help' },
    },
  ];
  for (const item of cases) {
    const { driver } = createPageDriverDouble({
      url: 'https://example.invalid/home?ignored=secret',
      affordances: [{
        handleId: `handle-${item.target.kind}`,
        ...item.facts,
        visible: true,
        enabled: true,
        actionSpace: ['click'],
      }],
    });
    const observed = await observePage({ driver, intentId: INTENT_ID, maxCandidates: 8 });
    assert(observed.ok === true, `${item.target.kind} observe 应成功：${JSON.stringify(observed)}`);
    const result = resolve(mustFreeze({ target: item.target }), observed.observation);
    assert(result.status === 'resolved' && /^af_/.test(result.targetAffordanceId),
      `${item.target.kind} observer→resolver 不可达：${JSON.stringify(result)}`);
  }
});

check('B8 substring/case/fuzzy 不匹配，零命中只允许 bounded proposal', () => {
  const contract = mustFreeze();
  for (const name of ['打开帮助中心', '打开帮', '打开帮助!', '打开 帮助']) {
    const result = resolve(contract, observation({ affordances: [affordance({ name })] }));
    assert(result.status === 'proposal-required' && result.reason === 'AFFORDANCE_NOT_FOUND',
      `非 exact 应 proposal-required：${name}/${JSON.stringify(result)}`);
  }
  const englishContract = mustFreeze({
    target: { kind: 'text', name: 'Open Help', exact: true },
  });
  const caseMismatch = resolve(englishContract, observation({
    affordances: [affordance({ kind: 'text', name: 'open help' })],
  }));
  assert(caseMismatch.status === 'proposal-required' && caseMismatch.reason === 'AFFORDANCE_NOT_FOUND',
    `大小写不等不得 fuzzy 命中：${JSON.stringify(caseMismatch)}`);
});

check('B9 visible/hidden/disabled 同语义重复都按 page-wide ambiguous 路由人', () => {
  const contract = mustFreeze();
  for (const duplicate of [
    affordance({ affordanceId: 'af_hidden', visible: false }),
    affordance({ affordanceId: 'af_disabled', enabled: false }),
    affordance({ affordanceId: 'af_visible_2' }),
  ]) {
    const result = resolve(contract, observation({
      affordances: [affordance(), duplicate],
    }));
    assert(result.status === 'route:human' && result.reason === 'AFFORDANCE_AMBIGUOUS',
      `物理重复不得挑可动作项：${JSON.stringify(result)}`);
  }
});

check('B10 unsettled/truncated/unsupported scope 不得 resolved', () => {
  const contract = mustFreeze();
  const cases = [
    [observation({ settled: false }), 'OBSERVATION_UNSETTLED'],
    [observation({ truncated: true }), 'CATALOG_TRUNCATED'],
    [observation({ unsupportedScopes: { iframe: true, shadow: false, containerOnly: false } }), 'UNSUPPORTED_SCOPE'],
  ];
  for (const [obs, reason] of cases) {
    const result = resolve(contract, obs);
    assert(result.status !== 'resolved' && result.reason === reason, `${reason} 应拒：${JSON.stringify(result)}`);
  }
});

await checkAsync('B11 bounded proposal 只允许真正 zero-hit 当前 observation 的一个 af_* 与冻结 action', async () => {
  const contract = mustFreeze();
  const obs = await observeZeroHitProposalSurface();
  const chosenId = obs.affordances.find((item) => item.semantic?.name === '继续')?.affordanceId;
  assert(/^af_/.test(chosenId), 'zero-hit surface 必须提供可绑定的继续候选');
  const deterministic = resolve(contract, obs);
  assert(deterministic.status === 'proposal-required' && deterministic.reason === 'AFFORDANCE_NOT_FOUND',
    `proposal 铸权前必须证明确实 zero-hit：${JSON.stringify(deterministic)}`);
  const raw = {
    schemaVersion: 1,
    artifactKind: 'zero-shot-action-proposal',
    observationId: obs.observationId,
    intentId: INTENT_ID,
    targetAffordanceId: chosenId,
    action: 'click',
  };
  const result = proposal(contract, obs, raw);
  assert(result.ok === true && result.reason == null, `合规 proposal 应通过：${JSON.stringify(result)}`);
  assert(isDeepStrictEqual(result.proposal, raw), '合规 proposal 不得被偷偷扩字段或改写');

  for (const bad of [
    { ...raw, observationId: 'obs_old' },
    { ...raw, intentId: 'intent_2' },
    { ...raw, targetAffordanceId: 'af_missing' },
    { ...raw, targetAffordanceId: 'entity_candidate_1' },
    { ...raw, action: 'fill' },
  ]) {
    const denied = proposal(contract, obs, bad);
    assert(denied.ok === false && denied.proposal == null, `错绑 proposal 不得通过：${JSON.stringify(denied)}`);
  }
});

await checkAsync('B12 selector/code/effect/impact/finish/progress/expected/verdict/身份字段/多动作全部闭集拒绝', async () => {
  const contract = mustFreeze();
  const obs = await observeZeroHitProposalSurface();
  const chosenId = obs.affordances.find((item) => item.semantic?.name === '继续')?.affordanceId;
  assert(/^af_/.test(chosenId), 'zero-hit surface 必须提供可绑定候选');
  const base = {
    schemaVersion: 1,
    artifactKind: 'zero-shot-action-proposal',
    observationId: obs.observationId,
    intentId: INTENT_ID,
    targetAffordanceId: chosenId,
    action: 'click',
  };
  const poison = {
    selector: '#help',
    xpath: '//a',
    nth: 0,
    code: 'click()',
    javascript: 'document.querySelector("#help").click()',
    playwright: 'page.getByText("打开帮助").click()',
    python: 'browser.click("#help")',
    effect: 'read',
    impact: 'read',
    finish: true,
    progress: 'done',
    expected: [],
    verdict: 'PASS',
    candidateId: 'entity_candidate_1',
    platformId: 'opaque-platform-id',
    actions: [{ action: 'click' }, { action: 'click' }],
  };
  for (const [key, value] of Object.entries(poison)) {
    const result = proposal(contract, obs, { ...base, [key]: value });
    assert(result.ok === false && result.reason === 'PROPOSAL_SHAPE_INVALID' && result.proposal == null,
      `proposal 越界键 ${key} 必须闭集拒：${JSON.stringify(result)}`);
  }
});

if (failures.length) {
  console.error(`RED  ${TAG}: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   ${TAG}: ${passed}/${passed}（known dominance + exact resolver + bounded proposal）`);
