// lib/intent-plan.mjs —— TestCase intent 的确定性 known-atom 规划层。
//
// recipe 只做逐字 intent + actionHint 命中；模型只能填补零 recipe 命中的 intent。
// 最终 mapping 仍交给现役 flow-bridge / compile-gate 验证，本层不复制状态机或身份闸。
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildFlow, validateBridge } from './flow-bridge.mjs';
import { isCompilableAtom } from './compile-atoms.mjs';
import * as compileGate from './compile-gate.mjs';

const DEFAULT_RECIPES = JSON.parse(
  readFileSync(new URL('./intent-recipes.snapshot.json', import.meta.url), 'utf8'),
);
const PLAN_AUTHORITIES = new WeakMap();

function isRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function canonicalJson(value) {
  if (value === undefined) return 'u';
  if (value === null) return 'n';
  if (typeof value === 'boolean') return value ? 'b1' : 'b0';
  if (typeof value === 'string') return `s${JSON.stringify(value)}`;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('authority 内容含非有限数字');
    return `d${JSON.stringify(value)}`;
  }
  if (Array.isArray(value)) return `a[${value.map(canonicalJson).join(',')}]`;
  if (isRecord(value)) {
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key !== 'string')) {
      throw new TypeError('authority 内容不得含 symbol key');
    }
    const entries = ownKeys
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
    return `o{${entries.join(',')}}`;
  }
  throw new TypeError('authority 内容须为 JSON 值');
}

function digest(value) {
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function copyParams(value) {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new TypeError('params 须为普通对象');
  return structuredClone(value);
}

function copyBindings(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new TypeError('entityBindings 须为数组');
  return value.map((binding) => {
    const keys = isRecord(binding) ? Object.keys(binding) : [];
    if (!isRecord(binding)
      || keys.some((key) => key !== 'candidateId' && key !== 'role')
      || typeof binding.candidateId !== 'string'
      || !binding.candidateId.trim()
      || !['subject', 'source', 'target'].includes(binding.role)) {
      throw new TypeError('entityBindings[] 只允许非空 candidateId 与合法 role');
    }
    // candidateId 是 Casey 内部 join id；平台 ID 属于 semantic lock 读回，不进入 mapping locator。
    return {
      candidateId: binding.candidateId,
      role: binding.role,
    };
  });
}

function mappingEntry(intentId, source) {
  const entry = {
    intentId,
    atom: source.atom,
    params: copyParams(source.params),
  };
  const bindings = copyBindings(source.entityBindings);
  if (bindings !== undefined) entry.entityBindings = bindings;
  return entry;
}

function matchesRecipe(step, recipe) {
  const match = recipe?.match;
  return isRecord(match)
    && typeof match.intentEquals === 'string'
    && step.intent === match.intentEquals
    && step.actionHint === match.actionHint;
}

function validateRecipes(recipes) {
  recipes.forEach((recipe, index) => {
    if (!isRecord(recipe)
      || typeof recipe.ruleId !== 'string'
      || !recipe.ruleId
      || !isRecord(recipe.match)
      || typeof recipe.match.intentEquals !== 'string'
      || typeof recipe.match.actionHint !== 'string'
      || !isRecord(recipe.emit)
      || typeof recipe.emit.atom !== 'string'
      || !recipe.emit.atom) {
      throw new TypeError(`knownRecipes[${index}] 不是合法 exact recipe`);
    }
    if (Object.hasOwn(recipe.emit, 'params')) copyParams(recipe.emit.params);
    if (Object.hasOwn(recipe.emit, 'paramsFrom')) {
      if (!isRecord(recipe.emit.paramsFrom)
        || Object.values(recipe.emit.paramsFrom).some((field) => typeof field !== 'string' || !field)) {
        throw new TypeError(`knownRecipes[${index}].emit.paramsFrom 须为字段名映射`);
      }
    }
    if (Object.hasOwn(recipe.emit, 'entityBindings')) copyBindings(recipe.emit.entityBindings);
  });
}

function validateModelProposals(modelProposals, intentIds) {
  modelProposals.forEach((proposal, index) => {
    if (!isRecord(proposal)
      || typeof proposal.intentId !== 'string'
      || !proposal.intentId
      || typeof proposal.atom !== 'string'
      || !proposal.atom) {
      throw new TypeError(`modelProposals[${index}] 须为合法 mapping proposal`);
    }
    if (!intentIds.has(proposal.intentId)) {
      throw new TypeError(`modelProposals[${index}].intentId 不在 TestCase.steps 中`);
    }
    if (Object.hasOwn(proposal, 'params')) copyParams(proposal.params);
    if (Object.hasOwn(proposal, 'entityBindings')) copyBindings(proposal.entityBindings);
  });
}

function materializeRecipe(step, recipe) {
  const emit = recipe?.emit;
  if (!isRecord(emit) || typeof emit.atom !== 'string' || !emit.atom) return null;

  const params = copyParams(emit.params);
  if (isRecord(emit.paramsFrom)) {
    for (const [paramName, sourceField] of Object.entries(emit.paramsFrom)) {
      if (typeof sourceField !== 'string' || !Object.hasOwn(step, sourceField)) continue;
      const value = step[sourceField];
      if (value !== undefined && value !== null) params[paramName] = structuredClone(value);
    }
  }

  const materialized = { atom: emit.atom, params };
  const bindings = copyBindings(emit.entityBindings);
  if (bindings !== undefined) materialized.entityBindings = bindings;
  return materialized;
}

function atomProblem(entry, registry) {
  const definition = registry?.atoms?.[entry.atom];
  if (!definition || !isCompilableAtom(entry.atom)) return 'ATOM_NOT_COMPILABLE';
  const params = entry.params ?? {};
  if (Object.hasOwn(params, 'platformId')) return 'BRIDGE_REJECTED';
  for (const [name, descriptor] of Object.entries(definition.params ?? {})) {
    if (!descriptor?.required) continue;
    if (!Object.hasOwn(params, name) || params[name] === undefined || params[name] === null) {
      return 'MISSING_REQUIRED_PARAM';
    }
    if (descriptor.type === 'string' && (typeof params[name] !== 'string' || !params[name].trim())) {
      return 'MISSING_REQUIRED_PARAM';
    }
  }
  return null;
}

function humanDecision(intentId) {
  return { intentId, resolution: 'human' };
}

function decisionFromMapping(resolution, entry, ruleId) {
  const decision = {
    intentId: entry.intentId,
    resolution,
    ...(ruleId ? { ruleId } : {}),
    atom: entry.atom,
    params: structuredClone(entry.params),
  };
  if (Object.hasOwn(entry, 'entityBindings')) {
    decision.entityBindings = structuredClone(entry.entityBindings);
  }
  return decision;
}

function emptyTrace(problem) {
  return {
    steps: [],
    finalStates: [],
    problems: problem ? [problem] : [],
  };
}

function stateTraceFor(testcase, mapping, registry) {
  if (typeof compileGate.traceStateMachine !== 'function') {
    return emptyTrace('compile-gate.traceStateMachine 尚未接入');
  }
  if (!mapping.length) return emptyTrace();
  return compileGate.traceStateMachine(
    buildFlow(testcase, mapping),
    registry,
    Array.isArray(testcase.preconditions) ? testcase.preconditions : [],
  );
}

function rejectedIntentIds(problems, mapping, testcase) {
  const indexedIds = [];
  for (const problem of problems) {
    const indexed = /\b(?:step|mapping)\[(\d+)\]/.exec(String(problem));
    const index = indexed ? Number(indexed[1]) : -1;
    const intentId = index >= 0 ? mapping[index]?.intentId : null;
    if (intentId && !indexedIds.includes(intentId)) indexedIds.push(intentId);
  }
  return indexedIds.length ? indexedIds : [testcase.steps[0]?.intentId ?? ''];
}

function buildIntentPlanCore({
  testcase,
  knownRecipes = DEFAULT_RECIPES,
  modelProposals = [],
  registry,
} = {}) {
  if (!isRecord(testcase) || typeof testcase.caseId !== 'string' || !testcase.caseId || !Array.isArray(testcase.steps)) {
    throw new TypeError('TestCase 非法：caseId 须为非空字符串且 steps 须为数组');
  }
  const recipes = Array.isArray(knownRecipes)
    ? knownRecipes
    : (Array.isArray(knownRecipes?.recipes) ? knownRecipes.recipes : null);
  if (!recipes) throw new TypeError('knownRecipes 须为 recipe 数组或带 recipes 数组的对象');
  if (!Array.isArray(modelProposals)) throw new TypeError('modelProposals 须为数组');
  validateRecipes(recipes);

  const intentIds = new Set();
  testcase.steps.forEach((step, index) => {
    if (!isRecord(step) || typeof step.intentId !== 'string' || !step.intentId) {
      throw new TypeError(`TestCase.steps[${index}].intentId 须为非空字符串`);
    }
    if (intentIds.has(step.intentId)) {
      throw new TypeError(`TestCase.steps[${index}].intentId 重复`);
    }
    intentIds.add(step.intentId);
  });
  validateModelProposals(modelProposals, intentIds);

  const decisions = [];
  const mapping = [];
  const unresolved = [];

  for (const step of testcase.steps) {
    const intentId = typeof step?.intentId === 'string' ? step.intentId : '';
    const hits = recipes.filter((recipe) => matchesRecipe(step ?? {}, recipe));
    const proposals = modelProposals.filter((proposal) => proposal?.intentId === intentId);

    if (hits.length > 1) {
      decisions.push(humanDecision(intentId));
      unresolved.push({
        intentId,
        reason: 'KNOWN_RECIPE_AMBIGUOUS',
        ruleIds: hits.map((recipe) => recipe?.ruleId).filter((ruleId) => typeof ruleId === 'string'),
      });
      continue;
    }

    if (hits.length === 1) {
      const recipe = hits[0];
      const emitted = materializeRecipe(step, recipe);
      const entry = emitted && mappingEntry(intentId, emitted);
      const reason = entry ? atomProblem(entry, registry) : 'ATOM_NOT_COMPILABLE';
      if (reason) {
        decisions.push(humanDecision(intentId));
        unresolved.push({ intentId, reason });
        continue;
      }

      mapping.push(entry);
      decisions.push(decisionFromMapping('known', entry, recipe.ruleId));
      if (proposals.length) unresolved.push({ intentId, reason: 'KNOWN_ATOM_OVERRIDE' });
      continue;
    }

    if (proposals.length === 0) {
      decisions.push(humanDecision(intentId));
      unresolved.push({ intentId, reason: 'MODEL_PROPOSAL_MISSING' });
      continue;
    }
    if (proposals.length > 1) {
      decisions.push(humanDecision(intentId));
      unresolved.push({ intentId, reason: 'BRIDGE_REJECTED' });
      continue;
    }

    const entry = mappingEntry(intentId, proposals[0]);
    const reason = atomProblem(entry, registry);
    if (reason) {
      decisions.push(humanDecision(intentId));
      unresolved.push({ intentId, reason });
      continue;
    }
    mapping.push(entry);
    decisions.push(decisionFromMapping('model', entry));
  }

  if (unresolved.length === 0) {
    const bridge = validateBridge(testcase, mapping, { registry });
    if (!bridge.ok) {
      for (const intentId of rejectedIntentIds(bridge.problems, mapping, testcase)) {
        unresolved.push({ intentId, reason: 'BRIDGE_REJECTED' });
      }
    }
  }

  const stateTrace = stateTraceFor(testcase, mapping, registry);
  if (stateTrace.problems.length && unresolved.length === 0) {
    const intentId = testcase.steps[0]?.intentId ?? '';
    unresolved.push({ intentId, reason: 'BRIDGE_REJECTED' });
  }

  return {
    schemaVersion: 1,
    caseId: testcase.caseId,
    decisions,
    mapping,
    unresolved,
    stateTrace,
    ready: unresolved.length === 0,
  };
}

export function buildIntentPlan({
  testcase,
  knownRecipes = DEFAULT_RECIPES,
  modelProposals = [],
  registry,
} = {}) {
  const plan = buildIntentPlanCore({
    testcase,
    knownRecipes,
    modelProposals,
    registry,
  });
  const defaultPlan = knownRecipes === DEFAULT_RECIPES && modelProposals.length === 0
    ? structuredClone(plan)
    : buildIntentPlanCore({
      testcase,
      knownRecipes: DEFAULT_RECIPES,
      modelProposals: [],
      registry,
    });
  const testcaseSnapshot = deepFreeze(structuredClone(testcase));
  PLAN_AUTHORITIES.set(plan, Object.freeze({
    digest: digest(plan),
    testcaseDigest: digest(testcaseSnapshot),
    testcaseSnapshot,
    defaultPlan: deepFreeze(defaultPlan),
    defaultRecipes: knownRecipes === DEFAULT_RECIPES,
    modelProposalsEmpty: modelProposals.length === 0,
  }));
  return plan;
}

export function validateIntentPlanAuthority(plan) {
  const authority = isRecord(plan) ? PLAN_AUTHORITIES.get(plan) : null;
  if (!authority) {
    return { ok: false, reason: 'INTENT_PLAN_AUTHORITY_INVALID' };
  }
  try {
    if (digest(plan) !== authority.digest) {
      return { ok: false, reason: 'INTENT_PLAN_AUTHORITY_INVALID' };
    }
  } catch {
    return { ok: false, reason: 'INTENT_PLAN_AUTHORITY_INVALID' };
  }
  return {
    ok: true,
    reason: null,
    defaultRecipes: authority.defaultRecipes,
    modelProposalsEmpty: authority.modelProposalsEmpty,
    testcaseDigest: authority.testcaseDigest,
    testcaseSnapshot: authority.testcaseSnapshot,
    defaultPlan: authority.defaultPlan,
  };
}

export function mappingFromIntentPlan(plan) {
  if (validateIntentPlanAuthority(plan)?.ok !== true
    || plan.ready !== true || !Array.isArray(plan.mapping)) {
    throw new TypeError('intent plan 未 ready，不得投影 mapping');
  }
  return structuredClone(plan.mapping);
}
