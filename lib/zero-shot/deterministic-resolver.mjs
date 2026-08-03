// 只做全页 exact semantic 唯一定位；不猜、不模糊匹配、不执行。
import { createHash } from 'node:crypto';
import { validateZeroShotStepContractAuthority } from './step-contract.mjs';
import { anyUnsupportedScope } from './unsupported-scopes.mjs';

const RESOLUTION_AUTHORITIES = new WeakMap();
const AFFORDANCE_ID = /^af_[a-z0-9_]+$/;

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
    if (ownKeys.some((key) => typeof key !== 'string')) throw new TypeError('resolution 含 symbol key');
    return `o{${ownKeys.sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  throw new TypeError('resolution authority 内容须为 JSON 值');
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

function exactMatch(target, affordance) {
  const semantic = affordance?.semantic;
  if (!isRecord(semantic)
    || semantic.kind !== target.kind
    || semantic.name !== target.name
    || semantic.exact !== true) return false;
  return target.kind !== 'role' || semantic.role === target.role;
}

function issue(payload, stepContract, observation) {
  const resolution = deepFreeze(payload);
  RESOLUTION_AUTHORITIES.set(resolution, Object.freeze({
    digest: digest(resolution),
    stepContract,
    observation,
    observationDigest: digest(observation),
  }));
  return resolution;
}

function blocked(reason) {
  return deepFreeze({ status: 'blocked', reason });
}

export function resolveDeterministicAction({ stepContract, observation } = {}) {
  const contractAuthority = validateZeroShotStepContractAuthority(stepContract);
  if (contractAuthority?.ok !== true) return blocked('CONTRACT_AUTHORITY_INVALID');
  if (!isRecord(observation)
    || observation.artifactKind !== 'page-observation'
    || observation.intentId !== stepContract.intentId
    || !Array.isArray(observation.affordances)) {
    return blocked('OBSERVATION_INVALID');
  }
  try {
    digest(observation);
  } catch {
    return blocked('OBSERVATION_INVALID');
  }
  const affordanceIds = observation.affordances.map((item) => item?.affordanceId ?? '');
  if (affordanceIds.some((affordanceId) => !AFFORDANCE_ID.test(affordanceId))
    || new Set(affordanceIds).size !== affordanceIds.length) {
    return issue({ status: 'blocked', reason: 'AFFORDANCE_ID_INVALID' }, stepContract, observation);
  }
  if (observation.settled !== true) {
    return issue({ status: 'blocked', reason: 'OBSERVATION_UNSETTLED' }, stepContract, observation);
  }
  if (observation.truncated === true) {
    return issue({ status: 'blocked', reason: 'CATALOG_TRUNCATED' }, stepContract, observation);
  }
  if (anyUnsupportedScope(observation.unsupportedScopes)) {
    return issue({ status: 'route:human', reason: 'UNSUPPORTED_SCOPE' }, stepContract, observation);
  }

  const matches = observation.affordances.filter((item) => exactMatch(stepContract.target, item));
  if (matches.length === 0) {
    return issue({
      status: 'proposal-required',
      reason: 'AFFORDANCE_NOT_FOUND',
    }, stepContract, observation);
  }
  if (matches.length !== 1 || matches[0].pageCount !== 1) {
    return issue({
      status: 'route:human',
      reason: 'AFFORDANCE_AMBIGUOUS',
    }, stepContract, observation);
  }

  const target = matches[0];
  if (target.visible !== true
    || target.enabled !== true
    || target.actionable !== true
    || !Array.isArray(target.actionSpace)
    || !target.actionSpace.includes(stepContract.action)) {
    return issue({
      status: 'route:human',
      reason: 'AFFORDANCE_NOT_ACTIONABLE',
    }, stepContract, observation);
  }
  return issue({
    status: 'resolved',
    reason: null,
    targetAffordanceId: target.affordanceId,
    action: stepContract.action,
  }, stepContract, observation);
}

export function validateDeterministicResolutionAuthority({
  resolution,
  stepContract,
  observation,
} = {}) {
  const authority = isRecord(resolution) ? RESOLUTION_AUTHORITIES.get(resolution) : null;
  if (!authority
    || authority.stepContract !== stepContract
    || authority.observation !== observation
    || validateZeroShotStepContractAuthority(stepContract)?.ok !== true) {
    return { ok: false, reason: 'RESOLUTION_AUTHORITY_INVALID' };
  }
  try {
    if (digest(resolution) !== authority.digest
      || digest(observation) !== authority.observationDigest) {
      return { ok: false, reason: 'RESOLUTION_AUTHORITY_INVALID' };
    }
  } catch {
    return { ok: false, reason: 'RESOLUTION_AUTHORITY_INVALID' };
  }
  return {
    ok: true,
    reason: null,
    status: resolution.status,
    targetAffordanceId: resolution.targetAffordanceId,
    action: resolution.action,
  };
}
