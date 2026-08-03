#!/usr/bin/env node
// zero-shot-unsupported-scope-fanout：未支持作用域键清单的单一事实源元钉。
//
// 钉的不是某个具体的键，而是「键清单与全部消费点的同步关系」：任何人往
// UNSUPPORTED_SCOPE_KEYS 加键、却漏接任一消费点，本金牌当场红。
// 另有结构钉（消费点必须 import 共享模块、不得自己写键字面量）与未知键对照钉
// （判据必须取现役三处的并集严格度，不得只认已知键——那是放松）。
//
// adapter double 只证明内核控制流；零 SUT、零 server、零浏览器、零网络。

import { readFileSync } from 'node:fs';

const TAG = 'zero-shot-unsupported-scope-fanout';
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
    console.error(`RED  ${TAG}: 导入验收 API 失败：${String(error?.message || error).slice(-300)}`);
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
const { revalidateAffordance } = await loadApi(
  '../../lib/zero-shot/affordance-authority.mjs',
  ['revalidateAffordance'],
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
const { buildIntentPlan } = await loadApi('../../lib/intent-plan.mjs', ['buildIntentPlan']);

// 共享模块是本契约的落地目标；实现前它不存在，此处软失败让全部钉逐条报红而不是整体崩。
let scopeModule = null;
let scopeModuleError = null;
try {
  scopeModule = await import(
    new URL('../../lib/zero-shot/unsupported-scopes.mjs', import.meta.url).href
  );
} catch (error) {
  scopeModuleError = String(error?.message || error).slice(-300);
}

function sharedModule() {
  assert(scopeModule, `lib/zero-shot/unsupported-scopes.mjs 未落地：${scopeModuleError}`);
  return scopeModule;
}

function scopeKeys() {
  const { UNSUPPORTED_SCOPE_KEYS } = sharedModule();
  assert(Array.isArray(UNSUPPORTED_SCOPE_KEYS) && UNSUPPORTED_SCOPE_KEYS.length > 0,
    `UNSUPPORTED_SCOPE_KEYS 须为非空数组：${JSON.stringify(UNSUPPORTED_SCOPE_KEYS)}`);
  return UNSUPPORTED_SCOPE_KEYS;
}

// 历史三键：棘轮基线，只许加不许减。
const LEGACY_SCOPE_KEYS = ['iframe', 'shadow', 'containerOnly'];

const CONSUMER_FILES = [
  '../../lib/zero-shot/page-observer.mjs',
  '../../lib/zero-shot/deterministic-resolver.mjs',
  '../../lib/zero-shot/action-admission.mjs',
  '../../lib/zero-shot/progress-verifier.mjs',
];

const CASE_ID = 'tc_zero_shot_unsupported_scope_fanout';
const INTENT_ID = 'intent_1';
// 只读窄白名单要求 role=link 且名称含只读标记（进入）。
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

function mustContract(expectedProgress) {
  const result = freezeZeroShotStepContract({
    testcase,
    intentPlan: buildIntentPlan({ testcase, registry: REGISTRY }),
    intentId: INTENT_ID,
    action: 'click',
    target: { kind: 'role', role: 'link', name: NAV_NAME, exact: true },
    effect: 'read',
    expectedProgress,
    userConfirmed: true,
  });
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

const navLink = () => roleAffordance({
  handleId: 'nav-workflow',
  role: 'link',
  name: NAV_NAME,
  actionSpace: ['click'],
});
const heading = () => roleAffordance({
  handleId: 'heading-workflow',
  role: 'heading',
  name: PAGE_HEADING,
});

function snapshot({ revision, path, affordances, unsupportedScopes = {} }) {
  return {
    revision,
    url: `https://example.invalid${path}`,
    title: '工作流',
    settled: true,
    unsupportedScopes,
    affordances,
  };
}

const URL_WORKFLOW = { kind: 'urlPathname', op: 'startsWith', value: '/workflow' };
const HIDDEN_DIALOG = { kind: 'roleHidden', role: 'dialog', name: DETAIL_DIALOG };

// 动作前观察件带指定 scope 键：观察/解析/准入/提案四个消费点都在这一份上判。
async function observeWithScope(scopeKey) {
  const page = createPageDriverDouble({
    snapshots: [snapshot({
      revision: 'rev_1',
      path: '/home',
      affordances: [navLink()],
      unsupportedScopes: { [scopeKey]: true },
    })],
    revalidate: { connected: true, sameNode: true, pageCount: 1, visible: true, enabled: true },
  });
  const stepContract = mustContract([URL_WORKFLOW]);
  const observed = await observePage({ driver: page.driver, intentId: INTENT_ID, maxCandidates: 20 });
  assert(observed?.ok === true, `observe 应成功：${JSON.stringify(observed)}`);
  return { page, stepContract, observed };
}

// 动作后观察件带指定 scope 键：progress 面是唯一在 after 上把关的消费点。
async function runChainWithAfterScope(scopeKey) {
  const page = createPageDriverDouble({
    snapshots: [
      snapshot({ revision: 'rev_1', path: '/home', affordances: [navLink()] }),
      snapshot({
        revision: 'rev_2',
        path: '/workflow/list',
        affordances: [heading()],
        unsupportedScopes: { [scopeKey]: true },
      }),
    ],
    revalidate: { connected: true, sameNode: true, pageCount: 1, visible: true, enabled: true },
  });
  const stepContract = mustContract([URL_WORKFLOW, HIDDEN_DIALOG]);
  const before = await observePage({ driver: page.driver, intentId: INTENT_ID, maxCandidates: 20 });
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
  const after = await observePage({ driver: page.driver, intentId: INTENT_ID, maxCandidates: 20 });
  assert(after?.ok === true, `after observe 应成功：${JSON.stringify(after)}`);
  const progress = verifyStepProgress({
    stepContract,
    beforeObservation: before.observation,
    actionReceipt: executed.actionReceipt,
    afterObservation: after.observation,
    afterObservationAuthority: after.authority,
  });
  return { page, before, executed, after, progress };
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

// ── 共享模块的形状（单一事实源）────────────────────────────────────────────────

await check('N1 共享纯叶模块导出键清单、归一化与判据三件', async () => {
  const mod = sharedModule();
  const keys = mod.UNSUPPORTED_SCOPE_KEYS;
  assert(Array.isArray(keys), `UNSUPPORTED_SCOPE_KEYS 须为数组：${JSON.stringify(keys)}`);
  assert(keys.length > 0, '键清单不得为空');
  assert(Object.isFrozen(keys), '键清单须冻结，防运行期被改');
  assert(keys.every((key) => typeof key === 'string' && key.length > 0),
    `键清单须全为非空字符串：${JSON.stringify(keys)}`);
  assert(new Set(keys).size === keys.length, `键清单不得重复：${JSON.stringify(keys)}`);
  assert(typeof mod.normalizeUnsupportedScopes === 'function', '须导出 normalizeUnsupportedScopes');
  assert(typeof mod.anyUnsupportedScope === 'function', '须导出 anyUnsupportedScope');
});

await check('N2 键清单是历史三键的超集（棘轮：只许加不许减）', async () => {
  const keys = scopeKeys();
  const missing = LEGACY_SCOPE_KEYS.filter((key) => !keys.includes(key));
  assert(missing.length === 0, `历史键不得从清单里消失：${missing.join(', ')}`);
});

await check('N3 归一化输出键集与键清单逐字相等', async () => {
  const { normalizeUnsupportedScopes } = sharedModule();
  const keys = scopeKeys();
  const inputs = [
    {},
    { [keys[0]]: true },
    { probeScope: true },
    [],
    ['probeScope'],
    null,
    undefined,
    'probeScope',
    42,
  ];
  for (const input of inputs) {
    const normalized = normalizeUnsupportedScopes(input);
    assert(normalized && typeof normalized === 'object' && !Array.isArray(normalized),
      `归一化须产出记录：${JSON.stringify(input)} -> ${JSON.stringify(normalized)}`);
    assert(Object.isFrozen(normalized), `归一化产物须冻结：${JSON.stringify(input)}`);
    const got = Object.keys(normalized).sort();
    const want = [...keys].sort();
    assert(JSON.stringify(got) === JSON.stringify(want),
      `归一化键集须与 UNSUPPORTED_SCOPE_KEYS 逐字相等：${JSON.stringify(got)} vs ${JSON.stringify(want)}`);
    assert(Object.values(normalized).every((flag) => typeof flag === 'boolean'),
      `归一化取值须全为布尔：${JSON.stringify(normalized)}`);
  }
  const echoed = normalizeUnsupportedScopes({ [keys[0]]: true });
  assert(echoed[keys[0]] === true, `已知键置真须透过归一化：${JSON.stringify(echoed)}`);
});

// ── 逐键扇出：键清单里的每一个键都必须被每一个消费点拦住 ──────────────────────

await check('N4 每个键置真后都真的出现在 observation 上（防夹具静默吞键）', async () => {
  for (const key of scopeKeys()) {
    const { observed } = await observeWithScope(key);
    assert(observed.observation.unsupportedScopes?.[key] === true,
      `${key} 须真的透到 observation：${JSON.stringify(observed.observation.unsupportedScopes)}`);
  }
});

await check('N5 每个键都让 revalidateAffordance 拒 UNSUPPORTED_SCOPE', async () => {
  for (const key of scopeKeys()) {
    const { observed } = await observeWithScope(key);
    const affordanceId = observed.observation.affordances[0]?.affordanceId;
    const result = await revalidateAffordance({ authority: observed.authority, affordanceId });
    assert(result?.ok === false && result.reason === 'UNSUPPORTED_SCOPE',
      `${key} 下重验须拒 UNSUPPORTED_SCOPE：${JSON.stringify(result)}`);
  }
});

await check('N6 每个键都让 resolveDeterministicAction 出 route:human / UNSUPPORTED_SCOPE', async () => {
  for (const key of scopeKeys()) {
    const { stepContract, observed } = await observeWithScope(key);
    const resolution = resolveDeterministicAction({
      stepContract,
      observation: observed.observation,
    });
    assert(resolution?.status === 'route:human' && resolution.reason === 'UNSUPPORTED_SCOPE',
      `${key} 下解析须路由人：${JSON.stringify(resolution)}`);
  }
});

await check('N7 每个键都让 admitZeroShotAction 拒且拒因恰为 UNSUPPORTED_SCOPE', async () => {
  // 拒因字面量是承重的：加键后若准入自身的闸失效，拒付会被上游 selectedAuthority 兜住，
  // 拒因漂成 RESOLUTION_AUTHORITY_INVALID——仍拒但路由人时看错原因，纵深防线静默失效。
  for (const key of scopeKeys()) {
    const { stepContract, observed } = await observeWithScope(key);
    const resolution = resolveDeterministicAction({
      stepContract,
      observation: observed.observation,
    });
    const admitted = await admitZeroShotAction({
      stepContract,
      observation: observed.observation,
      observationAuthority: observed.authority,
      resolution,
    });
    assert(admitted?.ok === false && admitted.reason === 'UNSUPPORTED_SCOPE',
      `${key} 下准入须拒且拒因恰为 UNSUPPORTED_SCOPE：${JSON.stringify(admitted)}`);
  }
});

await check('N8 每个键都让 createActionProposal 拒 UNSUPPORTED_SCOPE（提案支路不得绕开）', async () => {
  for (const key of scopeKeys()) {
    const { stepContract, observed } = await observeWithScope(key);
    const proposal = createActionProposal({
      stepContract,
      observation: observed.observation,
      rawProposal: {
        schemaVersion: 1,
        artifactKind: 'zero-shot-action-proposal',
        observationId: observed.observation.observationId,
        intentId: INTENT_ID,
        targetAffordanceId: observed.observation.affordances[0]?.affordanceId,
        action: 'click',
      },
    });
    assert(proposal?.ok === false && proposal.reason === 'UNSUPPORTED_SCOPE',
      `${key} 下提案须拒 UNSUPPORTED_SCOPE：${JSON.stringify(proposal)}`);
  }
});

await check('N9 每个键在 after 面都让 verifyStepProgress 拒 PROGRESS_UNSUPPORTED_SCOPE', async () => {
  // after observation 从不经过解析与准入，progress 面是唯一把关点：漏一个键就是真 fail-open
  // ——一次动作根本没造成的进展会被判成 progressed，且零告警。
  for (const key of scopeKeys()) {
    const run = await runChainWithAfterScope(key);
    assert(run.after.observation.unsupportedScopes?.[key] === true,
      `${key} 须真的透到 after observation：${JSON.stringify(run.after.observation.unsupportedScopes)}`);
    assert(run.progress?.status === 'pending'
      && run.progress.reason === 'PROGRESS_UNSUPPORTED_SCOPE',
    `${key} 下缺席判据不可证，须 fail-closed：${JSON.stringify(run.progress)}`);
  }
});

// ── 结构钉与并集严格度 ────────────────────────────────────────────────────────

await check('N10 四个消费点均已 import 共享模块且不含任何 scope 键字面量', async () => {
  const keys = scopeKeys();
  for (const relativePath of CONSUMER_FILES) {
    const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
    assert(/from\s+'\.\/unsupported-scopes\.mjs'/.test(source),
      `${relativePath} 须 import 共享模块 unsupported-scopes.mjs`);
    const leaked = keys.filter((key) => source.includes(key));
    assert(leaked.length === 0,
      `${relativePath} 不得自己写 scope 键字面量（判据须唯一）：${leaked.join(', ')}`);
  }
});

await check('N11 未知键与数组形态的判据严格度不低于现役（并集，不得只认已知键）', async () => {
  // 承重且注入路径写死：只测 anyUnsupportedScope 对 raw 值的语义，禁止经 normalize / observePage
  // 注入——正确实现会把未知键剥掉，经链注入测的是 observation 形状而非判据语义，会错红。
  const { anyUnsupportedScope } = sharedModule();
  assert(anyUnsupportedScope({ probeScope: true }) === true,
    '未知键置真的记录须判真（现役解析面即如此，收敛不得放松）');
  assert(anyUnsupportedScope(['x']) === true,
    '非空数组须判真（保现役解析面行为）');
  for (const key of scopeKeys()) {
    assert(anyUnsupportedScope({ [key]: true }) === true, `${key} 置真须判真`);
  }
  const falsy = [{}, [], null, undefined, 'probeScope', 42, true, false];
  for (const value of falsy) {
    assert(anyUnsupportedScope(value) === false,
      `无未支持作用域的输入须判假：${JSON.stringify(value)}`);
  }
  const allFalse = Object.fromEntries(scopeKeys().map((key) => [key, false]));
  assert(anyUnsupportedScope(allFalse) === false,
    `全假记录须判假：${JSON.stringify(allFalse)}`);
});

await check('N12 本金牌涉及的全部产物恒降权、无裁定字样', async () => {
  const keys = scopeKeys();
  const { observed } = await observeWithScope(keys[0]);
  assert(observed.observation.signed === false && observed.observation.replayReady === false,
    `observation 须恒降权：${JSON.stringify(observed.observation.signed)}`);
  assert(noVerdictClaims(observed.observation), 'observation 不得出现裁定字样');
  const run = await runChainWithAfterScope(keys[0]);
  assert(run.executed.actionReceipt.signed === false
    && run.executed.actionReceipt.replayReady === false,
  `actionReceipt 须恒降权：${JSON.stringify(run.executed.actionReceipt)}`);
  assert(noVerdictClaims(run.executed.actionReceipt), 'actionReceipt 不得出现裁定字样');
  assert(run.progress.progressReceipt === null,
    `拒付时不得吐进展收据：${JSON.stringify(run.progress)}`);
  assert(noVerdictClaims(run.progress), 'progress 结果不得出现裁定字样');
});

const total = passed + failures.length;
if (failures.length) {
  console.error(`\nnot ok ${TAG}: ${passed}/${total} 通过，${failures.length} 条红`);
  for (const line of failures) console.error(`  - ${line}`);
  process.exit(1);
}
console.log(`ok   ${TAG}: ${passed}/${total} 全过`);
