// zero-shot 单步契约：只把真正零 recipe、人工确认过的 read/click 意图
// 冻结为降权且不可直接回放的闭集 artifact。
import { createHash } from 'node:crypto';
import { validateIntentPlanAuthority } from '../intent-plan.mjs';

const CONTRACT_AUTHORITIES = new WeakMap();

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
  if (typeof value === 'number' && Number.isFinite(value)) return `d${JSON.stringify(value)}`;
  if (Array.isArray(value)) return `a[${value.map(canonicalJson).join(',')}]`;
  if (isRecord(value)) {
    const ownKeys = Reflect.ownKeys(value);
    if (ownKeys.some((key) => typeof key !== 'string')) throw new TypeError('contract 含 symbol key');
    return `o{${ownKeys.sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  throw new TypeError('contract authority 内容须为 JSON 值');
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

function denied(reason) {
  return { ok: false, reason, contract: null };
}

function exactKeys(value, allowed) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...allowed].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function validTarget(target) {
  if (!isRecord(target) || target.exact !== true
    || typeof target.name !== 'string' || !target.name.trim()) return false;
  if (target.kind === 'role') {
    return exactKeys(target, ['kind', 'role', 'name', 'exact'])
      && typeof target.role === 'string'
      && Boolean(target.role.trim());
  }
  if (target.kind === 'label' || target.kind === 'text') {
    return exactKeys(target, ['kind', 'name', 'exact']);
  }
  return false;
}

// affordance catalog 归一后的角色形态；进展断言与目录用同一套字符集，避免两处口径漂移。
const PROGRESS_ROLE = /^[a-z][a-z0-9-]{0,63}$/;

function validPathnameProgressItem(item) {
  return exactKeys(item, ['kind', 'op', 'value'])
    && ['startsWith', 'equals'].includes(item.op)
    && typeof item.value === 'string'
    && item.value.startsWith('/')
    && !item.value.startsWith('//')
    && !item.value.includes('?')
    && !item.value.includes('#')
    && !item.value.includes('://');
}

function validRoleProgressItem(item) {
  return exactKeys(item, ['kind', 'role', 'name'])
    && typeof item.role === 'string'
    && PROGRESS_ROLE.test(item.role)
    && typeof item.name === 'string'
    && Boolean(item.name.trim());
}

function validProgressItem(item) {
  if (!isRecord(item)) return false;
  if (item.kind === 'urlPathname') return validPathnameProgressItem(item);
  if (item.kind === 'roleVisible' || item.kind === 'roleHidden') {
    return validRoleProgressItem(item);
  }
  return false;
}

function intentEntry(plan, intentId) {
  return Array.isArray(plan?.mapping)
    ? plan.mapping.find((entry) => entry?.intentId === intentId)
    : null;
}

function unresolvedEntry(plan, intentId) {
  return Array.isArray(plan?.unresolved)
    ? plan.unresolved.find((entry) => entry?.intentId === intentId)
    : null;
}

function eligibilityReason(plan, defaultPlan, intentId) {
  const defaultUnresolved = unresolvedEntry(defaultPlan, intentId);
  if (defaultUnresolved?.reason === 'KNOWN_ATOM_OVERRIDE') return 'KNOWN_ATOM_DOMINATES';
  if (defaultUnresolved && defaultUnresolved.reason !== 'MODEL_PROPOSAL_MISSING') {
    return typeof defaultUnresolved.reason === 'string' && defaultUnresolved.reason
      ? defaultUnresolved.reason
      : 'INTENT_PLAN_AUTHORITY_INVALID';
  }
  if (intentEntry(defaultPlan, intentId)) return 'KNOWN_ATOM_DOMINATES';

  const unresolved = unresolvedEntry(plan, intentId);
  if (unresolved?.reason === 'KNOWN_ATOM_OVERRIDE') return 'KNOWN_ATOM_DOMINATES';
  if (unresolved && unresolved.reason !== 'MODEL_PROPOSAL_MISSING') {
    return typeof unresolved.reason === 'string' && unresolved.reason
      ? unresolved.reason
      : 'INTENT_PLAN_AUTHORITY_INVALID';
  }
  if (intentEntry(plan, intentId)) return 'KNOWN_ATOM_DOMINATES';
  if (unresolved?.reason !== 'MODEL_PROPOSAL_MISSING') {
    return 'INTENT_PLAN_AUTHORITY_INVALID';
  }
  return null;
}

export function freezeZeroShotStepContract({
  testcase,
  intentPlan,
  intentId,
  action,
  target,
  effect,
  expectedProgress,
  userConfirmed,
} = {}) {
  if (!isRecord(testcase)
    || typeof testcase.caseId !== 'string'
    || !testcase.caseId
    || !Array.isArray(testcase.steps)) {
    return denied('TESTCASE_INVALID');
  }

  const planAuthority = validateIntentPlanAuthority(intentPlan);
  if (planAuthority?.ok !== true) return denied('INTENT_PLAN_AUTHORITY_INVALID');
  if (intentPlan.caseId !== testcase.caseId) return denied('CASE_ID_MISMATCH');
  try {
    if (canonicalJson(planAuthority.testcaseSnapshot) !== canonicalJson(testcase)) {
      return denied('INTENT_PLAN_AUTHORITY_INVALID');
    }
  } catch {
    return denied('INTENT_PLAN_AUTHORITY_INVALID');
  }

  if (typeof intentId !== 'string'
    || !testcase.steps.some((step) => step?.intentId === intentId)) {
    return denied('INTENT_NOT_FOUND');
  }
  const eligibility = eligibilityReason(intentPlan, planAuthority.defaultPlan, intentId);
  if (eligibility) return denied(eligibility);
  if (userConfirmed !== true) return denied('USER_CONFIRMATION_REQUIRED');
  if (action !== 'click') return denied('ACTION_NOT_ALLOWED');
  if (effect !== 'read') return denied('EFFECT_NOT_ALLOWED');
  if (!validTarget(target)) return denied('TARGET_NOT_ALLOWED');
  if (!Array.isArray(expectedProgress) || expectedProgress.length === 0) {
    return denied('EXPECTED_PROGRESS_REQUIRED');
  }
  if (!expectedProgress.every(validProgressItem)) {
    return denied('EXPECTED_PROGRESS_NOT_ALLOWED');
  }

  const contract = deepFreeze({
    schemaVersion: 1,
    artifactKind: 'zero-shot-step-contract',
    caseId: testcase.caseId,
    intentId,
    action: 'click',
    effect: 'read',
    target: structuredClone(target),
    expectedProgress: structuredClone(expectedProgress),
    signed: false,
    replayReady: false,
  });
  CONTRACT_AUTHORITIES.set(contract, Object.freeze({
    digest: digest(contract),
    intentPlan,
  }));
  return { ok: true, reason: null, contract };
}

export function validateZeroShotStepContractAuthority(stepContract) {
  const authority = isRecord(stepContract) ? CONTRACT_AUTHORITIES.get(stepContract) : null;
  if (!authority || validateIntentPlanAuthority(authority.intentPlan)?.ok !== true) {
    return { ok: false, reason: 'CONTRACT_AUTHORITY_INVALID' };
  }
  try {
    if (digest(stepContract) !== authority.digest) {
      return { ok: false, reason: 'CONTRACT_AUTHORITY_INVALID' };
    }
  } catch {
    return { ok: false, reason: 'CONTRACT_AUTHORITY_INVALID' };
  }
  return {
    ok: true,
    reason: null,
    caseId: stepContract.caseId,
    intentId: stepContract.intentId,
    action: stepContract.action,
    effect: stepContract.effect,
    target: stepContract.target,
    expectedProgress: stepContract.expectedProgress,
  };
}
