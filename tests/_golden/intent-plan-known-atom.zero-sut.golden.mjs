#!/usr/bin/env node
// intent-plan-known-atom-foundation：确定性 recipe 优先、模型只补未知 intent、现有 bridge/identity 闸复用。
// 本文件是冻结验收，不得由实现 agent 修改。
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const fail = (message) => {
  console.error(`RED  intent-plan-known-atom: ${message}`);
  process.exit(1);
};

let buildIntentPlan;
let mappingFromIntentPlan;
let validateBridge;
let createEntityLockReceipt;
let compareEntityLock;
try {
  ({ buildIntentPlan, mappingFromIntentPlan } = await import(pathToFileURL(join(ROOT, 'lib', 'intent-plan.mjs')).href));
  ({ validateBridge } = await import(pathToFileURL(join(ROOT, 'lib', 'flow-bridge.mjs')).href));
  ({ createEntityLockReceipt, compareEntityLock } = await import(pathToFileURL(join(ROOT, 'lib', 'entity-semantic-lock.mjs')).href));
} catch (error) {
  fail(`导入验收 API 失败（实现前预期红）：${String(error.message).slice(-240)}`);
}

const registry = JSON.parse(readFileSync(join(ROOT, 'lib', 'atoms-registry.snapshot.json'), 'utf8'));
const schema = JSON.parse(readFileSync(join(HERE, 'schemas', 'intent-plan.schema.json'), 'utf8'));
const failures = [];
let passes = 0;

function check(name, fn) {
  try {
    fn();
    passes++;
  } catch (error) {
    failures.push(`${name}: ${String(error?.message || error).slice(-500)}`);
  }
}

function testcase({
  caseId = 'tc_intent_plan',
  intent = '进入工作流管理',
  actionHint = 'navigate',
  inputValue,
  preconditions = ['已登录'],
} = {}) {
  return {
    schemaVersion: 1,
    caseId,
    title: 'intent plan 验收',
    source: { kind: 'freetext', raw: intent },
    preconditions,
    steps: [{
      intentId: 'intent_1',
      intent,
      actionHint,
      ...(inputValue === undefined ? {} : { inputValue }),
      expected: [],
    }],
    globalAssertions: [],
    uniquePrefix: 'atl_',
  };
}

const recipes = (...items) => ({ schemaVersion: 1, recipes: items });
const navRecipe = {
  ruleId: 'known-nav-workflow',
  match: { intentEquals: '进入工作流管理', actionHint: 'navigate' },
  emit: { atom: 'nav.workflowManagement', params: {} },
};

function build({ tc = testcase(), knownRecipes = recipes(navRecipe), modelProposals = [] } = {}) {
  return buildIntentPlan({ testcase: tc, knownRecipes, modelProposals, registry });
}

check('C0 冻结 schema 钉住 intent plan 的可审计主字段', () => {
  const required = new Set(schema.required || []);
  for (const key of ['schemaVersion', 'caseId', 'decisions', 'mapping', 'unresolved', 'stateTrace', 'ready']) {
    if (!required.has(key)) throw new Error(`schema.required 缺 ${key}`);
  }
  const reasons = new Set(schema.$defs?.unresolved?.properties?.reason?.enum || []);
  for (const reason of ['KNOWN_ATOM_OVERRIDE', 'KNOWN_RECIPE_AMBIGUOUS', 'MISSING_REQUIRED_PARAM', 'ATOM_NOT_COMPILABLE']) {
    if (!reasons.has(reason)) throw new Error(`schema 缺 unresolved reason ${reason}`);
  }
});

check('C1 导出面', () => {
  if (typeof buildIntentPlan !== 'function') throw new Error('未导出 buildIntentPlan');
  if (typeof mappingFromIntentPlan !== 'function') throw new Error('未导出 mappingFromIntentPlan');
});

check('C2 唯一 exact recipe 命中 known，产现役 mapping 并可过真实 bridge', () => {
  const tc = testcase();
  const plan = build({ tc });
  if (plan.schemaVersion !== 1 || plan.caseId !== tc.caseId || plan.ready !== true) {
    throw new Error(`known happy 应 ready:true，实际 ${JSON.stringify(plan).slice(0, 360)}`);
  }
  if (plan.decisions.length !== 1 || plan.decisions[0].resolution !== 'known' || plan.decisions[0].ruleId !== navRecipe.ruleId) {
    throw new Error(`known decision 不符：${JSON.stringify(plan.decisions)}`);
  }
  const mapping = mappingFromIntentPlan(plan);
  const want = [{ intentId: 'intent_1', atom: 'nav.workflowManagement', params: {} }];
  if (JSON.stringify(mapping) !== JSON.stringify(want)) throw new Error(`mapping 不符：${JSON.stringify(mapping)}`);
  const bridge = validateBridge(tc, mapping, { registry });
  if (!bridge.ok) throw new Error(`真实 validateBridge 应过：${JSON.stringify(bridge.problems)}`);
  if (!plan.stateTrace || !Array.isArray(plan.stateTrace.steps) || plan.stateTrace.steps.length !== 1) {
    throw new Error('plan 必须带逐步 stateTrace');
  }
});

check('C3 模型不能覆盖已命中 known intent', () => {
  const plan = build({
    modelProposals: [{
      intentId: 'intent_1',
      atom: 'workflow.open',
      params: { openName: '另一个对象' },
      entityBindings: [{ candidateId: 'candidate-other', role: 'subject' }],
    }],
  });
  if (plan.ready !== false) throw new Error('known override 必须 ready:false');
  if (!plan.unresolved.some((x) => x.intentId === 'intent_1' && x.reason === 'KNOWN_ATOM_OVERRIDE')) {
    throw new Error(`缺 KNOWN_ATOM_OVERRIDE：${JSON.stringify(plan.unresolved)}`);
  }
  if (plan.mapping[0]?.atom !== 'nav.workflowManagement') throw new Error('known mapping 不得被模型替换');
  let rejected = false;
  try { mappingFromIntentPlan(plan); } catch { rejected = true; }
  if (!rejected) throw new Error('not-ready plan 不得投影 mapping');
});

check('C4 多 deterministic recipe 命中必须拒绝歧义', () => {
  const plan = build({
    knownRecipes: recipes(
      navRecipe,
      { ...navRecipe, ruleId: 'known-nav-workflow-duplicate' },
    ),
  });
  if (plan.ready !== false || plan.mapping.length !== 0) throw new Error('歧义 recipe 不得产 mapping');
  const unresolved = plan.unresolved.find((x) => x.intentId === 'intent_1');
  if (unresolved?.reason !== 'KNOWN_RECIPE_AMBIGUOUS' || unresolved.ruleIds?.length !== 2) {
    throw new Error(`歧义留痕不完整：${JSON.stringify(unresolved)}`);
  }
});

check('C5 册内但无编译知识的 atom 不能成为 known mapping', () => {
  const plan = build({
    knownRecipes: recipes({
      ruleId: 'known-but-not-compilable',
      match: { intentEquals: '进入工作流管理', actionHint: 'navigate' },
      emit: { atom: 'agent.selectModel', params: {} },
    }),
  });
  if (plan.ready !== false || plan.mapping.length !== 0) throw new Error('不可编译 atom 不得进入 mapping');
  if (plan.unresolved[0]?.reason !== 'ATOM_NOT_COMPILABLE') throw new Error(`拒因不符：${JSON.stringify(plan.unresolved)}`);
});

check('C6 只有零 recipe 命中的 intent 才接受 model proposal', () => {
  const tc = testcase({ intent: '进入一个尚无 recipe 的区域' });
  const proposal = { intentId: 'intent_1', atom: 'nav.workflowManagement', params: {} };
  const plan = build({ tc, modelProposals: [proposal] });
  if (!plan.ready || plan.decisions[0]?.resolution !== 'model') {
    throw new Error(`未知 intent 的合规模型补缝应 ready:true：${JSON.stringify(plan).slice(0, 400)}`);
  }
  if (JSON.stringify(mappingFromIntentPlan(plan)) !== JSON.stringify([proposal])) throw new Error('模型 mapping 投影漂移');
});

check('C7 required param 取不出时 fail-closed，不产半份 mapping', () => {
  const tc = testcase({ intent: '打开指定工作流', actionHint: 'click', preconditions: ['在工作流管理页'] });
  const plan = build({
    tc,
    knownRecipes: recipes({
      ruleId: 'known-open-workflow',
      match: { intentEquals: '打开指定工作流', actionHint: 'click' },
      emit: { atom: 'workflow.open', paramsFrom: { openName: 'inputValue' } },
    }),
  });
  if (plan.ready !== false || plan.mapping.length !== 0) throw new Error('缺 required param 不得产半 mapping');
  if (plan.unresolved[0]?.reason !== 'MISSING_REQUIRED_PARAM') throw new Error(`拒因不符：${JSON.stringify(plan.unresolved)}`);
});

check('C8 name/code 参数和 candidateId 双定位 binding 原样保留', () => {
  const tc = testcase({
    intent: '按名称与编号打开智能体',
    actionHint: 'click',
    inputValue: '问诊助手',
    preconditions: ['在智能体管理页'],
  });
  const binding = { candidateId: 'candidate-agent-main', role: 'subject' };
  const plan = build({
    tc,
    knownRecipes: recipes({
      ruleId: 'known-agent-search-open',
      match: { intentEquals: '按名称与编号打开智能体', actionHint: 'click' },
      emit: {
        atom: 'agent.searchOpen',
        params: { code: 'agent-code-7' },
        paramsFrom: { searchKeyword: 'inputValue', openName: 'inputValue' },
        entityBindings: [binding],
      },
    }),
  });
  if (!plan.ready) throw new Error(`双定位 happy 应 ready：${JSON.stringify(plan.unresolved)}`);
  const [mapped] = mappingFromIntentPlan(plan);
  if (mapped.params.searchKeyword !== '问诊助手' || mapped.params.openName !== '问诊助手' || mapped.params.code !== 'agent-code-7') {
    throw new Error(`name/code 参数丢失：${JSON.stringify(mapped.params)}`);
  }
  if (JSON.stringify(mapped.entityBindings) !== JSON.stringify([binding])) throw new Error('candidateId binding 漂移');
});

check('C9 同名同编号但 platformId 错，现有 semantic lock 仍拒；名称不得回退放行', () => {
  const recorded = createEntityLockReceipt({
    lockId: 'lock-agent-main',
    kind: 'agent',
    bindingMode: 'existing',
    scopeFingerprint: `sha256:${'1'.repeat(64)}`,
    expected: { name: '问诊助手', code: 'agent-code-7' },
    observed: { name: '问诊助手', code: 'agent-code-7', platformId: 'platform-7', revisionId: 'rev-1' },
    source: 'user-confirmed',
    revisionPolicy: 'exact',
  });
  const compared = compareEntityLock(recorded, {
    kind: 'agent',
    name: '问诊助手',
    code: 'agent-code-7',
    platformId: 'platform-WRONG',
    scopeFingerprint: `sha256:${'1'.repeat(64)}`,
    parentReceiptHash: null,
    revisionId: 'rev-1',
  });
  if (compared.allowAction !== false || compared.reason !== 'PLATFORM_ID_MISMATCH') {
    throw new Error(`platformId 错应拒：${JSON.stringify(compared)}`);
  }
});

if (failures.length) {
  for (const failure of failures) console.error(`RED  intent-plan-known-atom: ${failure}`);
  console.error(`RED  intent-plan-known-atom: ${passes} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   intent-plan-known-atom: ${passes}/${passes}（known dominance + model boundary + 双定位 + bridge/identity）`);
process.exit(0);
