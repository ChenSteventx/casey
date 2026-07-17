// compile/replay 身份准入前检（纯函数）。
// execute 使用绑定 flow + TestCase 的预执行身份授权；verify/replay 使用绑定最终 events 的 frozen locks。
// 两个权限域不得互相代替；本模块不定位 DOM、不启动浏览器、不参与 verdict。
import { createHash } from 'node:crypto';

const HASH_RE = /^sha256:[a-f0-9]{64}$/;
const ROLES = new Set(['source', 'target']);

const denied = (reason, nextAction) => Object.freeze({
  ok: false,
  allowBrowserLaunch: false,
  reason,
  nextAction,
});

const allowed = (authorityKind) => Object.freeze({
  ok: true,
  allowBrowserLaunch: true,
  reason: null,
  nextAction: null,
  authorityKind,
});

const isRecord = (value) => value != null && typeof value === 'object' && !Array.isArray(value);
const nonEmpty = (value) => typeof value === 'string' && Boolean(value.trim());

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
}

export function calculateIdentityAdmissionSignature(artifact) {
  if (!isRecord(artifact)) throw new TypeError('identity admission artifact 须为对象');
  const unsigned = {};
  for (const key of Object.keys(artifact)) if (key !== 'signature') unsigned[key] = artifact[key];
  return `sha256:${createHash('sha256').update(JSON.stringify(canonicalValue(unsigned))).digest('hex')}`;
}

export function hashIdentityAdmissionBytes(bytes) {
  if (!(Buffer.isBuffer(bytes) || bytes instanceof Uint8Array)) throw new TypeError('identity admission digest 须使用原始字节');
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function bindingKey(binding, fields) {
  if (!isRecord(binding)) return null;
  const values = [];
  for (const field of fields) {
    const value = binding[field];
    if (!nonEmpty(value)) return null;
    values.push(value);
  }
  if (!ROLES.has(binding.role)) return null;
  return JSON.stringify(values);
}

function coversBindings(actual, required, fields) {
  if (!Array.isArray(actual) || !Array.isArray(required)) return false;
  const actualKeys = actual.map((binding) => bindingKey(binding, fields));
  const requiredKeys = required.map((binding) => bindingKey(binding, fields));
  if (actualKeys.includes(null) || requiredKeys.includes(null)) return false;
  if (new Set(actualKeys).size !== actualKeys.length || new Set(requiredKeys).size !== requiredKeys.length) return false;
  const available = new Set(actualKeys);
  return requiredKeys.every((key) => available.has(key));
}

function signedEnvelopeOk(artifact) {
  if (!isRecord(artifact)
    || artifact.schemaVersion !== 1
    || artifact.signed !== true
    || !nonEmpty(artifact.signerId)
    || !nonEmpty(artifact.signedAt)
    || !HASH_RE.test(artifact.signature || '')) return false;
  return artifact.signature === calculateIdentityAdmissionSignature(artifact);
}

function verifyExecuteAuthority({ caseId, signedAuthority, flowBytes, testcaseBytes, requiredBindings }) {
  if (!signedEnvelopeOk(signedAuthority)
    || signedAuthority.artifactKind !== 'entity-pre-execution-authority'
    || signedAuthority.authorizedFor !== 'compile-execute') {
    return denied('PRE_EXECUTION_IDENTITY_AUTHORITY_MISSING_OR_INVALID', 'CREATE_AND_SIGN_PRE_EXECUTION_IDENTITY_AUTHORITY');
  }
  if (signedAuthority.caseId !== caseId) {
    return denied('PRE_EXECUTION_IDENTITY_AUTHORITY_CASE_MISMATCH', 'RESIGN_AUTHORITY_FOR_THIS_CASE');
  }
  if (!(Buffer.isBuffer(flowBytes) || flowBytes instanceof Uint8Array)
    || !(Buffer.isBuffer(testcaseBytes) || testcaseBytes instanceof Uint8Array)) {
    return denied('PRE_EXECUTION_IDENTITY_AUTHORITY_CONTEXT_MISSING', 'PROVIDE_FLOW_AND_TESTCASE_BYTES');
  }
  if (signedAuthority.flowSha256 !== hashIdentityAdmissionBytes(flowBytes)
    || signedAuthority.testcaseSha256 !== hashIdentityAdmissionBytes(testcaseBytes)) {
    return denied('PRE_EXECUTION_IDENTITY_AUTHORITY_HASH_MISMATCH', 'REVIEW_AND_RESIGN_CURRENT_FLOW');
  }
  if (!requiredBindings.length) {
    return denied('PRE_EXECUTION_IDENTITY_BINDINGS_MISSING', 'DISTILL_AND_CONFIRM_ENTITY_BINDINGS');
  }
  if (!coversBindings(signedAuthority.bindings, requiredBindings, ['sourceIntentId', 'candidateId', 'role'])) {
    return denied('PRE_EXECUTION_IDENTITY_AUTHORITY_BINDINGS_INCOMPLETE', 'CONFIRM_ALL_ENTITY_BINDINGS_AND_RESIGN');
  }
  return allowed('pre-execution-authority');
}

function verifyFrozenLocks({ caseId, containsEntityMutation, frozenLocks, eventsBytes, requiredBindings }) {
  if (!signedEnvelopeOk(frozenLocks)
    || frozenLocks.artifactKind !== 'entity-locks-frozen'
    || frozenLocks.replayReady !== true) {
    return denied('FROZEN_ENTITY_LOCKS_MISSING_OR_INVALID', 'SIGN_ENTITY_LOCKS_FOR_FINAL_EVENTS');
  }
  if (frozenLocks.caseId !== caseId) {
    return denied('FROZEN_ENTITY_LOCKS_CASE_MISMATCH', 'SIGN_LOCKS_FOR_THIS_CASE');
  }
  if (!(Buffer.isBuffer(eventsBytes) || eventsBytes instanceof Uint8Array)) {
    return denied('FROZEN_ENTITY_LOCKS_EVENTS_MISSING', 'PROVIDE_FINAL_EVENTS_BYTES');
  }
  if (frozenLocks.eventsSha256 !== hashIdentityAdmissionBytes(eventsBytes)) {
    return denied('FROZEN_ENTITY_LOCKS_EVENTS_HASH_MISMATCH', 'REDRAFT_AND_RESIGN_LOCKS_FOR_CURRENT_EVENTS');
  }
  if (containsEntityMutation === true && !requiredBindings.length) {
    return denied('FROZEN_ENTITY_EVENT_BINDINGS_MISSING', 'RECOMPILE_EVENTS_WITH_ENTITY_BINDINGS');
  }
  if (!coversBindings(frozenLocks.bindings, requiredBindings, ['stepId', 'intentId', 'atom', 'role'])) {
    return denied('FROZEN_ENTITY_LOCKS_BINDINGS_INCOMPLETE', 'LOCK_ALL_EVENT_ENTITY_BINDINGS_AND_RESIGN');
  }
  return allowed('frozen-entity-locks');
}

export function flowContainsEntityMutation(flow, registry) {
  // 坏 flow/registry 无法证明只读：返回 true 强制走授权门，不 fail-open。
  if (!isRecord(flow) || !Array.isArray(flow.steps) || !isRecord(registry) || !isRecord(registry.atoms)) return true;
  return flow.steps.some((step) => {
    if (!isRecord(step) || !nonEmpty(step.atom)) return true;
    const definition = registry.atoms[step.atom];
    if (!isRecord(definition)) return true;
    return definition.destructive === true
      || step.mutation === true
      || step.relationWrite === true
      || (Array.isArray(step.entityBindings) && step.entityBindings.length > 0);
  });
}

export function eventsContainEntityMutation(eventsDocument, registry) {
  const events = isRecord(eventsDocument) && Array.isArray(eventsDocument.events) ? eventsDocument.events : null;
  if (!events || !isRecord(registry) || !isRecord(registry.atoms)) return true;
  return events.some((event) => {
    if (!isRecord(event) || !nonEmpty(event.atom)) return true;
    const definition = registry.atoms[event.atom];
    if (!isRecord(definition)) return true;
    return definition.destructive === true
      || event.mutation === true
      || event.relationWrite === true
      || (Array.isArray(event.entityBindings) && event.entityBindings.length > 0);
  });
}

export function requiredFlowEntityBindings(flow) {
  if (!isRecord(flow) || !Array.isArray(flow.steps)) return [];
  const out = [];
  for (const step of flow.steps) {
    if (!isRecord(step) || !Array.isArray(step.entityBindings)) continue;
    for (const binding of step.entityBindings) {
      out.push({ sourceIntentId: step.sourceIntentId, candidateId: binding?.candidateId, role: binding?.role });
    }
  }
  return out;
}

export function requiredEventEntityBindings(eventsDocument) {
  const events = isRecord(eventsDocument) && Array.isArray(eventsDocument.events) ? eventsDocument.events : [];
  const out = [];
  for (const event of events) {
    if (!isRecord(event) || !Array.isArray(event.entityBindings)) continue;
    for (const binding of event.entityBindings) {
      out.push({ stepId: event.stepId, intentId: event.intentId, atom: event.atom, role: binding?.role });
    }
  }
  return out;
}

export function checkCompileIdentityAdmission({
  mode,
  caseId,
  containsEntityMutation,
  signedAuthority,
  frozenLocks,
  flowBytes,
  testcaseBytes,
  eventsBytes,
  requiredBindings = [],
} = {}) {
  if (!nonEmpty(caseId)) return denied('IDENTITY_ADMISSION_CASE_INVALID', 'PROVIDE_SAFE_CASE_ID');
  if (mode === 'execute') {
    if (containsEntityMutation !== true) return allowed('deterministic-read-only-policy');
    return verifyExecuteAuthority({ caseId, signedAuthority, flowBytes, testcaseBytes, requiredBindings });
  }
  if (mode === 'verify') return verifyFrozenLocks({ caseId, containsEntityMutation, frozenLocks, eventsBytes, requiredBindings });
  return denied('IDENTITY_ADMISSION_MODE_INVALID', 'USE_EXECUTE_OR_VERIFY_MODE');
}
