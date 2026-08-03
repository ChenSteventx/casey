#!/usr/bin/env node
// zero-shot-typed-progress-predicate：typed progress predicate 闭集扩到 roleVisible/roleHidden，
// 并堵住缺席类断言在目录截断/未支持作用域下的 fail-open。
// adapter double 只证明内核控制流；零 SUT、零 server、零浏览器、零网络。

import { readFileSync } from 'node:fs';

const TAG = 'zero-shot-typed-progress-predicate';
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
const { observePage } = await loadApi('../../lib/zero-shot/page-observer.mjs', ['observePage']);
const { resolveDeterministicAction } = await loadApi(
  '../../lib/zero-shot/deterministic-resolver.mjs',
  ['resolveDeterministicAction'],
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
const { buildIntentPlan } = await loadApi('../../lib/intent-plan.mjs', ['buildIntentPlan']);

const CASE_ID = 'tc_zero_shot_typed_progress';
const INTENT_ID = 'intent_1';
// 只读窄白名单要求 role=link 且名称含只读标记（进入）；这是切片 1「点击工作流管理」的导航入口。
const NAV_NAME = '进入工作流管理';
const PAGE_HEADING = '工作流管理';
const DETAIL_DIALOG = '工作流详情';
const REGISTRY = JSON.parse(
  readFileSync(new URL('../../lib/atoms-registry.snapshot.json', import.meta.url), 'utf8'),
);

const testcase = Object.freeze({
  schemaVersion: 1,
  caseId: CASE_ID,
  source: { kind: 'freetext', raw: '点击工作流管理' },
  preconditions: ['已登录'],
  steps: [{
    intentId: INTENT_ID,
    intent: '点击工作流管理',
    actionHint: 'click',
    expected: [{ kind: 'urlPathname', op: 'startsWith', value: '/workflow' }],
  }],
  globalAssertions: [],
  uniquePrefix: 'atl_',
});

function contractResult(expectedProgress) {
  return freezeZeroShotStepContract({
    testcase,
    intentPlan: buildIntentPlan({ testcase, registry: REGISTRY }),
    intentId: INTENT_ID,
    action: 'click',
    target: { kind: 'role', role: 'link', name: NAV_NAME, exact: true },
    effect: 'read',
    expectedProgress,
    userConfirmed: true,
  });
}

function mustContract(expectedProgress) {
  const result = contractResult(expectedProgress);
  assert(result?.ok === true && result.contract,
    `step contract 应冻结成功：${JSON.stringify(result)}`);
  return result.contract;
}

function roleAffordance({
  handleId,
  role,
  name,
  visible = true,
  enabled = true,
  actionSpace = [],
} = {}) {
  return { handleId, role, accessibleName: name, label: null, text: name, visible, enabled, actionSpace };
}

const navLink = (visible = true) => roleAffordance({
  handleId: 'nav-workflow',
  role: 'link',
  name: NAV_NAME,
  visible,
  actionSpace: ['click'],
});
const heading = (overrides = {}) => roleAffordance({
  handleId: 'heading-workflow',
  role: 'heading',
  name: PAGE_HEADING,
  ...overrides,
});
const detailDialog = (overrides = {}) => roleAffordance({
  handleId: 'dialog-detail',
  role: 'dialog',
  name: DETAIL_DIALOG,
  ...overrides,
});

function snapshot({ revision, path, affordances, unsupportedScopes = {}, settled = true }) {
  return {
    revision,
    url: `https://example.invalid${path}?ignored=secret#ignored`,
    title: '工作流',
    settled,
    unsupportedScopes,
    affordances,
  };
}

// 驱动一整条 observe → resolve → admit → execute → observe → verify 链。
async function runScenario({
  expectedProgress,
  beforeAffordances,
  afterAffordances,
  beforePath = '/home',
  afterPath = '/workflow/list',
  afterUnsupportedScopes = {},
  maxCandidates = 20,
} = {}) {
  const page = createPageDriverDouble({
    snapshots: [
      snapshot({ revision: 'rev_1', path: beforePath, affordances: beforeAffordances }),
      snapshot({
        revision: 'rev_2',
        path: afterPath,
        affordances: afterAffordances,
        unsupportedScopes: afterUnsupportedScopes,
      }),
    ],
    revalidate: { connected: true, sameNode: true, pageCount: 1, visible: true, enabled: true },
  });
  const stepContract = mustContract(expectedProgress);
  const before = await observePage({ driver: page.driver, intentId: INTENT_ID, maxCandidates });
  assert(before?.ok === true, `before observe 应成功：${JSON.stringify(before)}`);
  const resolution = resolveDeterministicAction({ stepContract, observation: before.observation });
  assert(resolution?.status === 'resolved',
    `before 应确定性 resolved：${JSON.stringify(resolution)}`);
  const admitted = await admitZeroShotAction({
    stepContract,
    observation: before.observation,
    observationAuthority: before.authority,
    resolution,
  });
  assert(admitted?.ok === true, `admission 应通过：${JSON.stringify(admitted)}`);
  const executed = await executeAdmittedAction({ admission: admitted.admission });
  assert(executed?.ok === true && executed.actionReceipt?.performed === true,
    `action 应恰一次成功：${JSON.stringify(executed)}`);
  const after = await observePage({ driver: page.driver, intentId: INTENT_ID, maxCandidates });
  assert(after?.ok === true, `after observe 应成功：${JSON.stringify(after)}`);
  const progress = verifyStepProgress({
    stepContract,
    beforeObservation: before.observation,
    actionReceipt: executed.actionReceipt,
    afterObservation: after.observation,
    afterObservationAuthority: after.authority,
  });
  return { page, stepContract, before, executed, after, progress };
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

const VISIBLE_HEADING = { kind: 'roleVisible', role: 'heading', name: PAGE_HEADING };
const HIDDEN_DIALOG = { kind: 'roleHidden', role: 'dialog', name: DETAIL_DIALOG };
const URL_WORKFLOW = { kind: 'urlPathname', op: 'startsWith', value: '/workflow' };

// ── 闭集校验（step-contract 面）────────────────────────────────────────────────

await check('P1 roleVisible/roleHidden 合法项可进闭集并冻结', async () => {
  const contract = mustContract([URL_WORKFLOW, VISIBLE_HEADING, HIDDEN_DIALOG]);
  assert(Array.isArray(contract.expectedProgress) && contract.expectedProgress.length === 3,
    `expectedProgress 应原样冻结三项：${JSON.stringify(contract.expectedProgress)}`);
  assert(Object.isFrozen(contract.expectedProgress), 'expectedProgress 必须冻结');
  assert(contract.signed === false && contract.replayReady === false,
    'step contract 必须恒降权');
});

await check('P2 role 类 predicate 的形状违例逐条拒付', async () => {
  const rejected = [
    [{ kind: 'roleFocused', role: 'heading', name: PAGE_HEADING }, '未知 kind'],
    [{ kind: 'roleVisible', role: 'heading' }, '缺 name'],
    [{ kind: 'roleVisible', name: PAGE_HEADING }, '缺 role'],
    [{ kind: 'roleVisible', role: 'heading', name: PAGE_HEADING, op: 'equals' }, '多余键 op'],
    [{ kind: 'roleVisible', role: 'heading', name: PAGE_HEADING, extra: 1 }, '多余键 extra'],
    [{ kind: 'roleVisible', role: 'Heading', name: PAGE_HEADING }, 'role 含大写'],
    [{ kind: 'roleVisible', role: '3heading', name: PAGE_HEADING }, 'role 首字符非字母'],
    [{ kind: 'roleVisible', role: 'head ing', name: PAGE_HEADING }, 'role 含空格'],
    [{ kind: 'roleVisible', role: 'heading', name: '   ' }, 'name 全空白'],
    [{ kind: 'roleVisible', role: 'heading', name: '' }, 'name 空串'],
    [{ kind: 'roleVisible', role: 'heading', name: 123 }, 'name 非字符串'],
    [{ kind: 'roleHidden', role: 'dialog', name: DETAIL_DIALOG, exact: true }, '多余键 exact'],
  ];
  for (const [item, why] of rejected) {
    const result = contractResult([item]);
    assert(result?.ok === false && result.reason === 'EXPECTED_PROGRESS_NOT_ALLOWED',
      `${why} 应拒付：${JSON.stringify(result)}`);
  }
});

await check('P3 urlPathname 现役形状与全部旧拒因一字不变（回归钉）', async () => {
  assert(contractResult([URL_WORKFLOW])?.ok === true, 'urlPathname 正控须继续可冻结');
  assert(contractResult([{ kind: 'urlPathname', op: 'equals', value: '/workflow' }])?.ok === true,
    'equals 正控须继续可冻结');
  const rejected = [
    [{ kind: 'urlPathname', op: 'contains', value: '/workflow' }, '非法 op'],
    [{ kind: 'urlPathname', op: 'startsWith', value: 'workflow' }, '不以 / 开头'],
    [{ kind: 'urlPathname', op: 'startsWith', value: '//workflow' }, '双斜杠'],
    [{ kind: 'urlPathname', op: 'startsWith', value: '/workflow?a=1' }, '含查询串'],
    [{ kind: 'urlPathname', op: 'startsWith', value: '/workflow#x' }, '含锚点'],
    [{ kind: 'urlPathname', op: 'startsWith', value: 'https://a/workflow' }, '含协议'],
    [{ kind: 'urlPathname', op: 'startsWith', value: '/workflow', role: 'link' }, '多余键'],
    [{ kind: 'urlPathname', value: '/workflow' }, '缺 op'],
  ];
  for (const [item, why] of rejected) {
    const result = contractResult([item]);
    assert(result?.ok === false && result.reason === 'EXPECTED_PROGRESS_NOT_ALLOWED',
      `${why} 应继续拒付：${JSON.stringify(result)}`);
  }
  assert(contractResult([])?.reason === 'EXPECTED_PROGRESS_REQUIRED', '空集拒因须不变');
});

// ── 判定与因果（progress-verifier 面）─────────────────────────────────────────

await check('P4 roleVisible 正控：动作前不可见、动作后唯一可见 → progressed', async () => {
  const run = await runScenario({
    expectedProgress: [VISIBLE_HEADING],
    beforeAffordances: [navLink()],
    afterAffordances: [heading()],
  });
  assert(run.progress?.status === 'progressed' && run.progress.reason == null,
    `应判进展：${JSON.stringify(run.progress)}`);
  assert(run.page.control.calls.perform === 1,
    `perform 应恰 1，实际 ${run.page.control.calls.perform}`);
});

await check('P5 同名两命中时 roleVisible 不成立（复用 count===1 纪律）', async () => {
  const run = await runScenario({
    expectedProgress: [VISIBLE_HEADING],
    beforeAffordances: [navLink()],
    afterAffordances: [heading(), heading({ handleId: 'heading-workflow-2' })],
  });
  assert(run.after.observation.affordances.every((item) => item.pageCount === 2),
    `前置须真的两命中：${JSON.stringify(run.after.observation.affordances)}`);
  assert(run.progress?.status === 'pending' && run.progress.reason === 'EXPECTED_PROGRESS_NOT_PROVED',
    `歧义不得判进展：${JSON.stringify(run.progress)}`);
});

await check('P6 动作前已可见 → EXPECTED_PROGRESS_NOT_CAUSED', async () => {
  const run = await runScenario({
    expectedProgress: [VISIBLE_HEADING],
    beforeAffordances: [navLink(), heading()],
    afterAffordances: [heading()],
  });
  assert(run.progress?.status === 'pending' && run.progress.reason === 'EXPECTED_PROGRESS_NOT_CAUSED',
    `动作前已成立不得冒充进展：${JSON.stringify(run.progress)}`);
});

await check('P7 roleHidden 正控：动作前可见、动作后不可见 → progressed', async () => {
  const run = await runScenario({
    expectedProgress: [HIDDEN_DIALOG],
    beforeAffordances: [navLink(), detailDialog()],
    afterAffordances: [heading()],
  });
  assert(run.progress?.status === 'progressed' && run.progress.reason == null,
    `关闭抽屉应判进展：${JSON.stringify(run.progress)}`);
});

await check('P8 roleHidden 反控：动作后仍可见 → EXPECTED_PROGRESS_NOT_PROVED', async () => {
  const run = await runScenario({
    expectedProgress: [URL_WORKFLOW, HIDDEN_DIALOG],
    beforeAffordances: [navLink()],
    afterAffordances: [heading(), detailDialog()],
  });
  assert(run.progress?.status === 'pending' && run.progress.reason === 'EXPECTED_PROGRESS_NOT_PROVED',
    `详情抽屉被打开时不得判进展：${JSON.stringify(run.progress)}`);
});

await check('P9 纯否定 expected 动作前后均成立 → 守卫不得冒充进展', async () => {
  const run = await runScenario({
    expectedProgress: [HIDDEN_DIALOG],
    beforeAffordances: [navLink()],
    afterAffordances: [heading()],
  });
  assert(run.progress?.status === 'pending' && run.progress.reason === 'EXPECTED_PROGRESS_NOT_CAUSED',
    `纯否定守卫不得自称进展：${JSON.stringify(run.progress)}`);
});

await check('P10 挂载但不可见即算 roleHidden 成立（可见性口径，非未挂载口径）', async () => {
  const run = await runScenario({
    expectedProgress: [URL_WORKFLOW, HIDDEN_DIALOG],
    beforeAffordances: [navLink(), detailDialog()],
    afterAffordances: [heading(), detailDialog({ visible: false })],
  });
  assert(run.after.observation.affordances.some(
    (item) => item.semantic?.name === DETAIL_DIALOG && item.visible === false),
  `前置须真的挂载但不可见：${JSON.stringify(run.after.observation.affordances)}`);
  assert(run.progress?.status === 'progressed',
    `挂载但不可见应算缺席成立：${JSON.stringify(run.progress)}`);
});

await check('P11 切片 1 复合语义：进管理页 + 详情抽屉未开 + URL 到位', async () => {
  const run = await runScenario({
    expectedProgress: [URL_WORKFLOW, VISIBLE_HEADING, HIDDEN_DIALOG],
    beforeAffordances: [navLink()],
    afterAffordances: [heading()],
  });
  assert(run.progress?.status === 'progressed' && run.progress.reason == null,
    `切片 1 复合正控应判进展：${JSON.stringify(run.progress)}`);
});

// ── fail-open 堵漏 ───────────────────────────────────────────────────────────

await check('P12 含 roleHidden 且 after 目录截断 → PROGRESS_CATALOG_TRUNCATED', async () => {
  const run = await runScenario({
    expectedProgress: [URL_WORKFLOW, HIDDEN_DIALOG],
    beforeAffordances: [navLink()],
    afterAffordances: [heading(), heading({ handleId: 'h2', name: '甲区' }),
      heading({ handleId: 'h3', name: '乙区' })],
    maxCandidates: 2,
  });
  assert(run.after.observation.truncated === true,
    `前置须真的截断：${JSON.stringify(run.after.observation.truncated)}`);
  assert(run.progress?.status === 'pending' && run.progress.reason === 'PROGRESS_CATALOG_TRUNCATED',
    `目录截断时缺席不可证，必须 fail-closed：${JSON.stringify(run.progress)}`);
});

await check('P13 含 roleHidden 且 after 有未支持作用域 → PROGRESS_UNSUPPORTED_SCOPE', async () => {
  for (const scope of ['iframe', 'shadow', 'containerOnly']) {
    const run = await runScenario({
      expectedProgress: [URL_WORKFLOW, HIDDEN_DIALOG],
      beforeAffordances: [navLink()],
      afterAffordances: [heading()],
      afterUnsupportedScopes: { [scope]: true },
    });
    assert(run.after.observation.unsupportedScopes?.[scope] === true,
      `前置须真的命中 ${scope}：${JSON.stringify(run.after.observation.unsupportedScopes)}`);
    assert(run.progress?.status === 'pending'
      && run.progress.reason === 'PROGRESS_UNSUPPORTED_SCOPE',
    `${scope} 下缺席不可证，必须 fail-closed：${JSON.stringify(run.progress)}`);
  }
});

await check('P14 纯存在性 expected 在 after 截断下不被误拒（防无谓收紧）', async () => {
  const run = await runScenario({
    expectedProgress: [URL_WORKFLOW],
    beforeAffordances: [navLink()],
    afterAffordances: [heading(), heading({ handleId: 'h2', name: '甲区' }),
      heading({ handleId: 'h3', name: '乙区' })],
    maxCandidates: 2,
  });
  assert(run.after.observation.truncated === true, '前置须真的截断');
  assert(run.progress?.status === 'progressed',
    `存在性断言不受完整性前置约束：${JSON.stringify(run.progress)}`);
});

await check('P15 上游封堵回归钉：截断的 before 在 resolver 与 admission 两处均拒且零动作', async () => {
  const page = createPageDriverDouble({
    snapshots: [snapshot({
      revision: 'rev_1',
      path: '/home',
      affordances: [navLink(), heading({ handleId: 'h2', name: '甲区' })],
    })],
    revalidate: { connected: true, sameNode: true, pageCount: 1, visible: true, enabled: true },
  });
  const stepContract = mustContract([URL_WORKFLOW]);
  const before = await observePage({ driver: page.driver, intentId: INTENT_ID, maxCandidates: 1 });
  assert(before?.ok === true && before.observation.truncated === true,
    `前置须真的截断：${JSON.stringify(before?.observation?.truncated)}`);
  const resolution = resolveDeterministicAction({ stepContract, observation: before.observation });
  assert(resolution?.status === 'blocked' && resolution.reason === 'CATALOG_TRUNCATED',
    `resolver 须继续封堵截断 before：${JSON.stringify(resolution)}`);
  const admitted = await admitZeroShotAction({
    stepContract,
    observation: before.observation,
    observationAuthority: before.authority,
    resolution,
  });
  assert(admitted?.ok === false && admitted.reason === 'CATALOG_TRUNCATED',
    `admission 须继续封堵截断 before：${JSON.stringify(admitted)}`);
  assert(page.control.calls.perform === 0,
    `截断 before 一律零动作，实际 ${page.control.calls.perform}`);
});

// ── 降权与授权链 ─────────────────────────────────────────────────────────────

await check('P16 progressReceipt 恒降权、无裁定字样、conditionKinds 反映实际判据种类', async () => {
  const run = await runScenario({
    expectedProgress: [URL_WORKFLOW, VISIBLE_HEADING, HIDDEN_DIALOG],
    beforeAffordances: [navLink()],
    afterAffordances: [heading()],
  });
  const receipt = run.progress.progressReceipt;
  assert(receipt?.signed === false && receipt.replayReady === false,
    `progress 收据必须恒降权：${JSON.stringify(receipt)}`);
  assert(noVerdictClaims(receipt), `收据不得出现裁定字样：${JSON.stringify(receipt)}`);
  assert(Array.isArray(receipt.conditionKinds), 'conditionKinds 必须是数组');
  assert(JSON.stringify(receipt.conditionKinds)
    === JSON.stringify(['roleHidden', 'roleVisible', 'urlPathname']),
  `conditionKinds 须确定性排序去重：${JSON.stringify(receipt.conditionKinds)}`);
  const single = await runScenario({
    expectedProgress: [VISIBLE_HEADING],
    beforeAffordances: [navLink()],
    afterAffordances: [heading()],
  });
  assert(JSON.stringify(single.progress.progressReceipt.conditionKinds) === JSON.stringify(['roleVisible']),
    `单一判据须只落该种类：${JSON.stringify(single.progress.progressReceipt.conditionKinds)}`);
});

await check('P17 现役授权链拒因在新 predicate 下逐条保持不变', async () => {
  const run = await runScenario({
    expectedProgress: [VISIBLE_HEADING],
    beforeAffordances: [navLink()],
    afterAffordances: [heading()],
  });
  for (const forged of [
    structuredClone(run.executed.actionReceipt),
    { ...run.executed.actionReceipt },
    { performed: true },
  ]) {
    const denied = verifyStepProgress({
      stepContract: run.stepContract,
      beforeObservation: run.before.observation,
      actionReceipt: forged,
      afterObservation: run.after.observation,
      afterObservationAuthority: run.after.authority,
    });
    assert(denied.status === 'pending' && denied.reason === 'ACTION_RECEIPT_AUTHORITY_INVALID',
      `伪造 receipt 须拒：${JSON.stringify(denied)}`);
  }
  const tampered = verifyStepProgress({
    stepContract: run.stepContract,
    beforeObservation: run.before.observation,
    actionReceipt: run.executed.actionReceipt,
    afterObservation: { ...run.after.observation },
    afterObservationAuthority: run.after.authority,
  });
  assert(tampered.status === 'pending' && tampered.reason === 'OBSERVATION_AUTHORITY_MISMATCH',
    `after observation 换体须拒：${JSON.stringify(tampered)}`);
});

await check('P18 after 未静默时新 predicate 一律不判进展', async () => {
  const page = createPageDriverDouble({
    snapshots: [
      snapshot({ revision: 'rev_1', path: '/home', affordances: [navLink()] }),
      snapshot({ revision: 'rev_2', path: '/workflow/list', affordances: [heading()], settled: false }),
    ],
    revalidate: { connected: true, sameNode: true, pageCount: 1, visible: true, enabled: true },
  });
  const stepContract = mustContract([VISIBLE_HEADING]);
  const before = await observePage({ driver: page.driver, intentId: INTENT_ID, maxCandidates: 20 });
  const resolution = resolveDeterministicAction({ stepContract, observation: before.observation });
  const admitted = await admitZeroShotAction({
    stepContract,
    observation: before.observation,
    observationAuthority: before.authority,
    resolution,
  });
  const executed = await executeAdmittedAction({ admission: admitted.admission });
  const after = await observePage({ driver: page.driver, intentId: INTENT_ID, maxCandidates: 20 });
  const progress = verifyStepProgress({
    stepContract,
    beforeObservation: before.observation,
    actionReceipt: executed.actionReceipt,
    afterObservation: after.observation,
    afterObservationAuthority: after.authority,
  });
  assert(progress.status === 'pending' && progress.reason === 'OBSERVATION_UNSETTLED',
    `未静默须继续拒：${JSON.stringify(progress)}`);
});

const total = passed + failures.length;
if (failures.length) {
  console.error(`\nnot ok ${TAG}: ${passed}/${total} 通过，${failures.length} 条红`);
  for (const line of failures) console.error(`  - ${line}`);
  process.exit(1);
}
console.log(`ok   ${TAG}: ${passed}/${total} 全过`);
