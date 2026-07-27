// Shared closed-shape and canonical JSON helpers for setup receipt modules.
// Keep this module pure: it must not own admission session state or runtime adapters.

export const HASH_RE = /^sha256:[a-f0-9]{64}$/;
export const ROLES = new Set(['subject', 'source', 'target']);
export const TRUSTED_BOOTSTRAP_STATES = new Set(['已登录']);

export const EXECUTION_KEYS = new Set([
  'schemaVersion', 'artifactKind', 'caseId', 'setupPlanSha256', 'executionChallenge',
  'steps', 'identityObservationRefs',
]);
export const EXECUTION_STEP_KEYS = new Set([
  'intentId', 'status', 'resolution', 'acted', 'verifiedStates',
]);
export const VERIFIED_STATE_KEYS = new Set(['state', 'evidenceStepId', 'proof']);
export const IDENTITY_REF_KEYS = new Set([
  'artifactSha256', 'sourceIntentId', 'candidateId', 'role', 'atom', 'evidenceStepId',
]);
export const RECEIPT_KEYS = new Set([
  'schemaVersion', 'artifactKind', 'caseId', 'setupPlanSha256', 'signed', 'replayReady',
  'executionRequestSha256', 'status', 'orderedIntentIds', 'providedStates', 'steps',
  'identityObservationRefs',
]);
export const PLAN_KEYS = new Set([
  'schemaVersion', 'artifactKind', 'caseId', 'ready', 'orderedIntentIds',
  'flow', 'initialStates', 'stateTrace', 'providedStates', 'problems',
]);
export const OBSERVATION_TOP_KEYS = new Set([
  'schemaVersion', 'artifactKind', 'caseId', 'capturedAgainstBuild',
  'identityProfileDigest', 'eventsSha256', 'source', 'observations',
]);
export const OBSERVATION_SOURCE_KEYS = new Set(['kind', 'atom', 'signed', 'replayReady']);
export const OBSERVATION_ROW_KEYS = new Set([
  'kind', 'name', 'code', 'platformId', 'sourceIntentId', 'candidateId', 'role', 'atom',
  'evidenceStepId', 'sourcePath',
]);

export function isPlainRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function hasClosedDataShape(value, allowed) {
  if (!isPlainRecord(value)) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== 'string' || !allowed.has(key))) return false;
  return keys.every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor
      && Object.hasOwn(descriptor, 'value')
      && descriptor.enumerable === true;
  });
}

export function nonEmpty(value) {
  return typeof value === 'string' && value.trim() !== '';
}

export function uniqueStrings(value) {
  return Array.isArray(value)
    && value.every(nonEmpty)
    && new Set(value).size === value.length;
}

export function issue(code, fields = {}) {
  return { code, ...fields };
}

function canonicalValue(value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('非有限数字不能进入 setup plan digest');
    return value;
  }
  if (typeof value !== 'object') throw new TypeError('setup plan digest 只接受 JSON 数据');
  if (seen.has(value)) throw new TypeError('setup plan digest 不接受循环引用');
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.map((entry) => canonicalValue(entry, seen));
    if (!isPlainRecord(value)) throw new TypeError('setup plan digest 只接受普通对象');
    const out = {};
    for (const key of Reflect.ownKeys(value).sort()) {
      if (typeof key !== 'string') throw new TypeError('setup plan digest 不接受 symbol 键');
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true) {
        throw new TypeError('setup plan digest 不接受 accessor/隐藏字段');
      }
      if (descriptor.value === undefined) throw new TypeError('setup plan digest 不接受 undefined');
      out[key] = canonicalValue(descriptor.value, seen);
    }
    return out;
  } finally {
    seen.delete(value);
  }
}

export function canonicalBytes(value) {
  return Buffer.from(JSON.stringify(canonicalValue(value)), 'utf8');
}

export function canonicalEqual(left, right) {
  try { return canonicalBytes(left).equals(canonicalBytes(right)); }
  catch { return false; }
}
