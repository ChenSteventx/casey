// Business-object semantic lock v2.
//
// This module is deliberately pure and has no browser/SUT concerns.  A receipt's
// own digest is only a content address; authority comes from the lock-set bytes
// matching a digest supplied by the frozen contract outside those bytes.
import { createHash } from 'node:crypto';

const SHA256 = /^[0-9a-f]{64}$/;
const SAFE_RUN_ID = /^[A-Za-z0-9._-]+$/;
const SUPPORTED_KINDS = new Set(['workflow', 'agent']);
const INITIAL_BINDING_MODES = new Set(['existing', 'created-in-run']);
const POLICY_PLATFORM = new Set(['required']);
const POLICY_PARENT = new Set(['required', 'optional', 'forbidden']);
const POLICY_REVISION = new Set(['exact']);

const HANDLE_STATE = new WeakMap();

const NEXT_ACTION = Object.freeze({
  RERECORD: 'RERECORD_AND_RESIGN',
  RETRY: 'RETRY_OR_CANCEL',
  RESELECT: 'RESELECT_AND_RESIGN',
  RESTORE_SCOPE: 'RESTORE_SCOPE_OR_CANCEL',
  CONFIRM: 'CONFIRM_NEW_IDENTITY_AND_RESIGN',
});

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function deny(reason, status = 'UNVERIFIED', nextAction = NEXT_ACTION.RERECORD, extra = null) {
  return Object.freeze({
    status,
    allowAction: false,
    reason,
    nextAction,
    ...(extra || {}),
  });
}

function verifyDenied(reason) {
  return Object.freeze({ ok: false, reason, nextAction: NEXT_ACTION.RERECORD });
}

function successorDenied(reason) {
  return Object.freeze({ ok: false, reason, nextAction: NEXT_ACTION.CONFIRM });
}

function same(candidateCount = 1) {
  return Object.freeze({
    status: 'SAME',
    allowAction: true,
    reason: null,
    nextAction: null,
    candidateCount,
  });
}

function isExactString(value) {
  return typeof value === 'string' && value.length > 0 && value === value.trim();
}

function exactString(value) {
  return isExactString(value) ? value : null;
}

function exactSha(value) {
  return typeof value === 'string' && SHA256.test(value) ? value : null;
}

// Take one descriptor snapshot and never read the source object again.  This
// rejects accessors, symbols, inherited custom data and extra keys, and closes
// the verify-then-reread Getter/Proxy seam from v1.
function closedObject(value, keys) {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const ownKeys = Reflect.ownKeys(descriptors);
    if (ownKeys.some((key) => typeof key !== 'string')) return null;
    if (ownKeys.length !== keys.length) return null;
    const allowed = new Set(keys);
    if (ownKeys.some((key) => !allowed.has(key))) return null;
    const out = Object.create(null);
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null;
      out[key] = descriptor.value;
    }
    return out;
  } catch {
    return null;
  }
}

// Events are an existing, wider compiled schema.  They are parsed from trusted
// bytes as JSON data and may legitimately carry action parameters.  Project the
// identity tuple without pretending those unrelated fields are lock-set schema.
function projectPlainObject(value, keys) {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const ownKeys = Reflect.ownKeys(descriptors);
    if (ownKeys.some((key) => typeof key !== 'string')) return null;
    for (const descriptor of Object.values(descriptors)) {
      if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null;
    }
    const out = Object.create(null);
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null;
      out[key] = descriptor.value;
    }
    return out;
  } catch {
    return null;
  }
}

function closedArray(value) {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const ownKeys = Reflect.ownKeys(descriptors);
    if (ownKeys.some((key) => typeof key !== 'string')) return null;
    const lengthDescriptor = descriptors.length;
    if (!lengthDescriptor || !Object.prototype.hasOwnProperty.call(lengthDescriptor, 'value')) return null;
    const length = lengthDescriptor.value;
    if (!Number.isSafeInteger(length) || length < 0) return null;
    const expectedKeys = new Set(['length', ...Array.from({ length }, (_, index) => String(index))]);
    if (ownKeys.length !== expectedKeys.size || ownKeys.some((key) => !expectedKeys.has(key))) return null;
    const out = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null;
      out.push(descriptor.value);
    }
    return out;
  } catch {
    return null;
  }
}

function toBytes(value) {
  try {
    if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) return null;
    return Buffer.from(value);
  } catch {
    return null;
  }
}

// JSON.parse silently keeps the last duplicate object key. A frozen identity
// artifact must have one unambiguous byte interpretation before it can become
// an authority handle, so reject duplicate keys before parsing either input.
function hasDuplicateJsonKeys(text) {
  const source = String(text);
  const stack = [];
  let expectKey = false;
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (char === '"') {
      let cursor = index + 1;
      let value = '';
      while (cursor < source.length) {
        const next = source[cursor];
        if (next === '\\') {
          const escaped = source[cursor + 1];
          if (escaped === 'u' && /^[0-9a-fA-F]{4}$/.test(source.slice(cursor + 2, cursor + 6))) {
            value += String.fromCharCode(Number.parseInt(source.slice(cursor + 2, cursor + 6), 16));
            cursor += 6;
          } else {
            value += ({ n: '\n', t: '\t', r: '\r', b: '\b', f: '\f' })[escaped] ?? escaped;
            cursor += 2;
          }
        } else if (next === '"') {
          cursor += 1;
          break;
        } else {
          value += next;
          cursor += 1;
        }
      }
      const scope = stack[stack.length - 1];
      if (scope instanceof Set && expectKey) {
        if (scope.has(value)) return true;
        scope.add(value);
      }
      expectKey = false;
      index = cursor;
      continue;
    }
    if (char === '{') { stack.push(new Set()); expectKey = true; }
    else if (char === '[') { stack.push(null); expectKey = false; }
    else if (char === '}' || char === ']') { stack.pop(); expectKey = false; }
    else if (char === ',') { expectKey = stack[stack.length - 1] instanceof Set; }
    else if (char === ':') { expectKey = false; }
    index += 1;
  }
  return false;
}

function parseJsonBytesOnce(value) {
  const bytes = toBytes(value);
  if (!bytes) return null;
  try {
    const text = bytes.toString('utf8');
    if (hasDuplicateJsonKeys(text)) return null;
    return { bytes, value: JSON.parse(text) };
  } catch {
    return null;
  }
}

function parseEvents(value, expectedCaseId) {
  let rows = closedArray(value);
  if (!rows) {
    const document = projectPlainObject(value, ['caseId', 'events']);
    if (!document || exactString(document.caseId) !== expectedCaseId) return null;
    rows = closedArray(document.events);
  }
  if (!rows || rows.length === 0) return null;
  const events = [];
  for (const row of rows) {
    const raw = projectPlainObject(row, ['stepId', 'intentId', 'atom']);
    if (!raw) return null;
    const event = {
      stepId: exactString(raw.stepId),
      intentId: exactString(raw.intentId),
      atom: exactString(raw.atom),
    };
    if (Object.values(event).some((field) => field === null)) return null;
    events.push(Object.freeze(event));
  }
  return Object.freeze(events);
}

function parsePolicy(value) {
  const raw = closedObject(value, ['kind', 'platformId', 'parent', 'revision']);
  if (!raw) return null;
  const policy = {
    kind: exactString(raw.kind),
    platformId: exactString(raw.platformId),
    parent: exactString(raw.parent),
    revision: exactString(raw.revision),
  };
  if (!SUPPORTED_KINDS.has(policy.kind)
    || !POLICY_PLATFORM.has(policy.platformId)
    || !POLICY_PARENT.has(policy.parent)
    || !POLICY_REVISION.has(policy.revision)) return null;
  return Object.freeze(policy);
}

function parseProvenance(value) {
  // Provenance is frozen evidence metadata, not a caller-provided trust label.
  const user = closedObject(value, ['kind', 'ref']);
  if (user && user.kind === 'user-approval' && exactString(user.ref)) {
    return Object.freeze({ kind: 'user-approval', ref: user.ref });
  }
  const observed = closedObject(value, ['kind', 'observationSha256']);
  if (observed && observed.kind === 'platform-readback' && exactSha(observed.observationSha256)) {
    return Object.freeze({ kind: 'platform-readback', observationSha256: observed.observationSha256 });
  }
  return null;
}

function canonicalReceipt(receipt) {
  return {
    lockId: receipt.lockId,
    kind: receipt.kind,
    bindingMode: receipt.bindingMode,
    name: receipt.name,
    code: receipt.code,
    platformId: receipt.platformId,
    scopeSha256: receipt.scopeSha256,
    parentReceiptHash: receipt.parentReceiptHash,
    revisionId: receipt.revisionId,
    provenance: receipt.provenance,
  };
}

function parseReceipt(value, policyByKind) {
  const raw = closedObject(value, [
    'lockId', 'kind', 'bindingMode', 'name', 'code', 'platformId', 'scopeSha256',
    'parentReceiptHash', 'revisionId', 'provenance', 'receiptHash',
  ]);
  if (!raw) return null;
  const receipt = {
    lockId: exactString(raw.lockId),
    kind: exactString(raw.kind),
    bindingMode: exactString(raw.bindingMode),
    name: exactString(raw.name),
    code: exactString(raw.code),
    platformId: exactString(raw.platformId),
    scopeSha256: exactSha(raw.scopeSha256),
    parentReceiptHash: raw.parentReceiptHash === null ? null : exactSha(raw.parentReceiptHash),
    revisionId: raw.revisionId === null ? null : exactString(raw.revisionId),
    provenance: parseProvenance(raw.provenance),
    receiptHash: exactSha(raw.receiptHash),
  };
  if (!receipt.lockId || !SUPPORTED_KINDS.has(receipt.kind)
    || !INITIAL_BINDING_MODES.has(receipt.bindingMode)
    || !receipt.name || !receipt.code || !receipt.platformId || !receipt.scopeSha256
    || raw.parentReceiptHash !== null && !receipt.parentReceiptHash
    || raw.revisionId !== null && !receipt.revisionId
    || !receipt.provenance || !receipt.receiptHash) return null;

  // Provenance is mode-specific: an external identity needs an explicit human
  // approval reference, while an entity created during the run needs a frozen
  // authoritative-readback observation digest.
  if (receipt.bindingMode === 'existing' && receipt.provenance.kind !== 'user-approval') return null;
  if (receipt.bindingMode === 'created-in-run' && receipt.provenance.kind !== 'platform-readback') return null;

  const policy = policyByKind.get(receipt.kind);
  if (!policy) return null;
  if (policy.platformId === 'required' && !receipt.platformId) return null;
  if (policy.parent === 'required' && !receipt.parentReceiptHash) return null;
  if (policy.parent === 'forbidden' && receipt.parentReceiptHash !== null) return null;
  if (policy.revision === 'exact' && !receipt.revisionId) return null;

  const canonical = Object.freeze(canonicalReceipt(receipt));
  if (sha256(JSON.stringify(canonical)) !== receipt.receiptHash) return null;
  return Object.freeze({ ...canonical, receiptHash: receipt.receiptHash });
}

function parseBinding(value) {
  const raw = closedObject(value, ['stepId', 'intentId', 'atom', 'role', 'lockId', 'receiptHash']);
  if (!raw) return null;
  const binding = {
    stepId: exactString(raw.stepId),
    intentId: exactString(raw.intentId),
    atom: exactString(raw.atom),
    role: exactString(raw.role),
    lockId: exactString(raw.lockId),
    receiptHash: exactSha(raw.receiptHash),
  };
  return Object.values(binding).some((field) => field === null) ? null : Object.freeze(binding);
}

function parseTransition(value) {
  const raw = closedObject(value, [
    'transitionId', 'stepId', 'intentId', 'atom', 'role', 'lockId',
    'previousReceiptHash', 'expectedName', 'expectedCode', 'approvalRef',
  ]);
  if (!raw) return null;
  const transition = {
    transitionId: exactString(raw.transitionId),
    stepId: exactString(raw.stepId),
    intentId: exactString(raw.intentId),
    atom: exactString(raw.atom),
    role: exactString(raw.role),
    lockId: exactString(raw.lockId),
    previousReceiptHash: exactSha(raw.previousReceiptHash),
    expectedName: exactString(raw.expectedName),
    expectedCode: exactString(raw.expectedCode),
    approvalRef: exactString(raw.approvalRef),
  };
  return Object.values(transition).some((field) => field === null) ? null : Object.freeze(transition);
}

function tupleKey(value) {
  return JSON.stringify([value.stepId, value.intentId, value.atom]);
}

function bindingKey(value) {
  return JSON.stringify([value.stepId, value.intentId, value.atom, value.role, value.lockId]);
}

function parseLockSet(value, expectedCaseId, expectedEventsSha256, events) {
  const raw = closedObject(value, [
    'schemaVersion', 'artifactKind', 'caseId', 'eventsSha256',
    'identityPolicies', 'receipts', 'bindings', 'transitions',
  ]);
  if (!raw || raw.schemaVersion !== 2 || raw.artifactKind !== 'entity-lock-set'
    || exactString(raw.caseId) !== expectedCaseId || exactSha(raw.eventsSha256) !== expectedEventsSha256) return null;

  const policyRows = closedArray(raw.identityPolicies);
  const receiptRows = closedArray(raw.receipts);
  const bindingRows = closedArray(raw.bindings);
  const transitionRows = closedArray(raw.transitions);
  if (!policyRows || !receiptRows || !bindingRows || !transitionRows
    || policyRows.length === 0 || receiptRows.length === 0 || bindingRows.length === 0) return null;

  const policies = policyRows.map(parsePolicy);
  if (policies.some((item) => !item)) return null;
  const policyByKind = new Map();
  for (const policy of policies) {
    if (policyByKind.has(policy.kind)) return null;
    policyByKind.set(policy.kind, policy);
  }

  const receipts = receiptRows.map((item) => parseReceipt(item, policyByKind));
  if (receipts.some((item) => !item)) return null;
  const receiptByLock = new Map();
  const receiptByHash = new Map();
  for (const receipt of receipts) {
    if (receiptByLock.has(receipt.lockId) || receiptByHash.has(receipt.receiptHash)) return null;
    receiptByLock.set(receipt.lockId, receipt);
    receiptByHash.set(receipt.receiptHash, receipt);
  }
  for (const receipt of receipts) {
    if (receipt.parentReceiptHash !== null
      && (receipt.parentReceiptHash === receipt.receiptHash || !receiptByHash.has(receipt.parentReceiptHash))) return null;
  }

  const eventKeys = new Set(events.map(tupleKey));
  if (eventKeys.size !== events.length) return null;
  const bindings = bindingRows.map(parseBinding);
  if (bindings.some((item) => !item)) return null;
  const bindingByKey = new Map();
  for (const binding of bindings) {
    const receipt = receiptByLock.get(binding.lockId);
    const key = bindingKey(binding);
    if (!receipt || receipt.receiptHash !== binding.receiptHash
      || !eventKeys.has(tupleKey(binding)) || bindingByKey.has(key)) return null;
    bindingByKey.set(key, binding);
  }

  const transitions = transitionRows.map(parseTransition);
  if (transitions.some((item) => !item)) return null;
  const transitionById = new Map();
  const transitionBindings = new Set();
  for (const transition of transitions) {
    const receipt = receiptByLock.get(transition.lockId);
    const binding = bindingByKey.get(bindingKey(transition));
    const transitionBinding = bindingKey(transition);
    if (!receipt || !binding || transition.previousReceiptHash !== receipt.receiptHash
      || binding.receiptHash !== transition.previousReceiptHash
      || transitionById.has(transition.transitionId) || transitionBindings.has(transitionBinding)) return null;
    transitionById.set(transition.transitionId, transition);
    transitionBindings.add(transitionBinding);
  }

  return {
    caseId: expectedCaseId,
    eventsSha256: expectedEventsSha256,
    policyByKind,
    receiptByLock,
    receiptByHash,
    bindingByKey,
    transitionById,
  };
}

/**
 * Validate exact frozen lock-set bytes against an external trust anchor.
 * The returned handle is an opaque, in-process authority; copying its visible
 * fields cannot forge a handle because state is held in HANDLE_STATE.
 */
export function verifyEntityLockSet({ lockSetBytes, trustedSetSha256, caseId, eventsBytes } = {}) {
  try {
    const trustedHash = exactSha(trustedSetSha256);
    const expectedCaseId = exactString(caseId);
    const parsedLock = parseJsonBytesOnce(lockSetBytes);
    const parsedEvents = parseJsonBytesOnce(eventsBytes);
    if (!trustedHash || !expectedCaseId || !parsedLock || !parsedEvents) return verifyDenied('ENTITY_LOCK_SET_INVALID');
    if (sha256(parsedLock.bytes) !== trustedHash) return verifyDenied('ENTITY_LOCK_SET_ANCHOR_MISMATCH');
    const eventsSha256 = sha256(parsedEvents.bytes);
    const events = parseEvents(parsedEvents.value, expectedCaseId);
    if (!events) return verifyDenied('ENTITY_LOCK_EVENTS_INVALID');
    const parsed = parseLockSet(parsedLock.value, expectedCaseId, eventsSha256, events);
    if (!parsed) return verifyDenied('ENTITY_LOCK_SET_INVALID');

    const handle = Object.freeze({ artifactKind: 'verified-entity-lock-set-v2', setSha256: trustedHash });
    HANDLE_STATE.set(handle, {
      ...parsed,
      setSha256: trustedHash,
      activeHeads: new Map([...parsed.receiptByLock].map(([lockId, receipt]) => [lockId, receipt.receiptHash])),
      runProofs: new Map(),
    });
    return Object.freeze({ ok: true, handle });
  } catch {
    return verifyDenied('ENTITY_LOCK_SET_INVALID');
  }
}

function parseActionBinding(value) {
  const raw = closedObject(value, ['stepId', 'intentId', 'atom', 'role', 'lockId']);
  if (!raw) return null;
  const binding = {
    stepId: exactString(raw.stepId),
    intentId: exactString(raw.intentId),
    atom: exactString(raw.atom),
    role: exactString(raw.role),
    lockId: exactString(raw.lockId),
  };
  return Object.values(binding).some((field) => field === null) ? null : Object.freeze(binding);
}

function parseCandidate(value, policy) {
  const raw = closedObject(value, [
    'physicalId', 'kind', 'name', 'code', 'platformId', 'scopeSha256',
    'parentReceiptHash', 'revisionId',
  ]);
  if (!raw) return null;
  const candidate = {
    physicalId: exactString(raw.physicalId),
    kind: exactString(raw.kind),
    name: exactString(raw.name),
    code: exactString(raw.code),
    platformId: raw.platformId === null ? null : exactString(raw.platformId),
    scopeSha256: exactSha(raw.scopeSha256),
    parentReceiptHash: raw.parentReceiptHash === null ? null : exactSha(raw.parentReceiptHash),
    revisionId: raw.revisionId === null ? null : exactString(raw.revisionId),
  };
  if (!candidate.physicalId || !candidate.kind || !candidate.name || !candidate.code || !candidate.scopeSha256
    || raw.platformId !== null && !candidate.platformId
    || raw.parentReceiptHash !== null && !candidate.parentReceiptHash
    || raw.revisionId !== null && !candidate.revisionId) return null;
  if (policy.platformId === 'required' && !candidate.platformId) return null;
  if (policy.parent === 'required' && !candidate.parentReceiptHash) return null;
  if (policy.parent === 'forbidden' && candidate.parentReceiptHash !== null) return null;
  if (policy.revision === 'exact' && !candidate.revisionId) return null;
  return Object.freeze(candidate);
}

function identityKey(candidate) {
  return JSON.stringify({
    kind: candidate.kind,
    name: candidate.name,
    code: candidate.code,
    platformId: candidate.platformId,
    scopeSha256: candidate.scopeSha256,
    parentReceiptHash: candidate.parentReceiptHash,
    revisionId: candidate.revisionId,
  });
}

function compareCandidate(receipt, candidate, policy) {
  if (candidate.kind !== receipt.kind) return deny('OBJECT_KIND_MISMATCH', 'CHANGED', NEXT_ACTION.RESELECT);
  if (candidate.scopeSha256 !== receipt.scopeSha256) return deny('SCOPE_MISMATCH', 'CHANGED', NEXT_ACTION.RESTORE_SCOPE);
  if (candidate.parentReceiptHash !== receipt.parentReceiptHash) return deny('PARENT_IDENTITY_MISMATCH', 'CHANGED', NEXT_ACTION.RESELECT);
  if (candidate.name !== receipt.name) return deny('ENTITY_NAME_MISMATCH', 'CHANGED', NEXT_ACTION.CONFIRM);
  if (candidate.code !== receipt.code) return deny('ENTITY_CODE_MISMATCH', 'CHANGED', NEXT_ACTION.CONFIRM);
  if (policy.platformId === 'required' && candidate.platformId !== receipt.platformId) {
    return deny('PLATFORM_ID_MISMATCH', 'CHANGED', NEXT_ACTION.RESELECT);
  }
  if (policy.revision === 'exact' && candidate.revisionId !== receipt.revisionId) {
    return deny('ENTITY_REVISION_DRIFT', 'CHANGED', NEXT_ACTION.CONFIRM);
  }
  return same(1);
}

/** The only v2 API that can return allowAction:true. */
export function evaluateEntityAction({ handle, binding, scan, runId = null, activeHeadProof = null } = {}) {
  try {
    const state = HANDLE_STATE.get(handle);
    if (!state) return deny('ENTITY_LOCK_HANDLE_INVALID');
    const requested = parseActionBinding(binding);
    if (!requested) return deny('ENTITY_BINDING_INVALID');
    const frozenBinding = state.bindingByKey.get(bindingKey(requested));
    if (!frozenBinding) return deny('ENTITY_BINDING_MISMATCH');
    const initialReceipt = state.receiptByLock.get(requested.lockId);
    const activeHeadHash = state.activeHeads.get(requested.lockId);
    let receipt = initialReceipt;
    if (activeHeadHash !== frozenBinding.receiptHash) {
      const normalizedRunId = exactString(runId);
      const knownProof = activeHeadProof && typeof activeHeadProof === 'object'
        ? state.runProofs.get(activeHeadProof.receiptHash)
        : null;
      if (!normalizedRunId || !knownProof || knownProof !== activeHeadProof
        || activeHeadProof.runId !== normalizedRunId
        || activeHeadProof.lockId !== requested.lockId
        || activeHeadProof.previousReceiptHash !== frozenBinding.receiptHash
        || activeHeadProof.receiptHash !== activeHeadHash) {
        return deny('ENTITY_LOCK_HEAD_STALE', 'CHANGED', NEXT_ACTION.CONFIRM);
      }
      receipt = activeHeadProof;
    } else if (activeHeadProof !== null || runId !== null) {
      return deny('ENTITY_ACTIVE_HEAD_PROOF_UNEXPECTED');
    }
    const policy = receipt && state.policyByKind.get(receipt.kind);
    if (!receipt || !policy) return deny('ENTITY_LOCK_INVALID');

    const rawScan = closedObject(scan, ['complete', 'candidates']);
    if (!rawScan || typeof rawScan.complete !== 'boolean') return deny('ENTITY_SCAN_INVALID');
    const rows = closedArray(rawScan.candidates);
    if (!rows) return deny('ENTITY_SCAN_INVALID');
    if (!rawScan.complete) return deny('ENTITY_SCAN_INCOMPLETE', 'UNVERIFIED', NEXT_ACTION.RETRY);
    if (rows.length === 0) return deny('ENTITY_NOT_FOUND', 'MISSING', 'RETRY_OR_RESELECT', { candidateCount: 0 });

    const candidates = rows.map((candidate) => parseCandidate(candidate, policy));
    if (candidates.some((candidate) => !candidate)) return deny('ENTITY_CANDIDATE_INVALID');

    // Identical duplicate observations of one physical row may collapse.  A
    // duplicate physical id with any identity conflict is untrusted, never
    // first-wins.
    const physical = new Map();
    for (const candidate of candidates) {
      const previous = physical.get(candidate.physicalId);
      if (previous && identityKey(previous) !== identityKey(candidate)) {
        return deny('ENTITY_PHYSICAL_ID_CONFLICT');
      }
      if (!previous) physical.set(candidate.physicalId, candidate);
    }

    const pairMatches = [...physical.values()].filter((candidate) => (
      candidate.kind === receipt.kind
      && candidate.scopeSha256 === receipt.scopeSha256
      && candidate.name === receipt.name
      && candidate.code === receipt.code
    ));
    if (pairMatches.length > 1) {
      return deny('ENTITY_PAIR_AMBIGUOUS', 'AMBIGUOUS', 'CONFIRM_EXACT_CODE_OR_CANCEL', { candidateCount: pairMatches.length });
    }
    if (pairMatches.length === 0) {
      // The scan did observe records, so this is identity drift, not proof that
      // the entity is absent.  MISSING is reserved for complete, explicit zero.
      return deny('ENTITY_IDENTITY_CHANGED', 'CHANGED', NEXT_ACTION.RESELECT, { candidateCount: physical.size });
    }
    return compareCandidate(receipt, pairMatches[0], policy);
  } catch {
    return deny('ENTITY_EVALUATION_FAILED');
  }
}

function parseReadback(value) {
  const raw = closedObject(value, ['name', 'code', 'platformId', 'revisionId']);
  if (!raw) return null;
  const readback = {
    name: exactString(raw.name),
    code: exactString(raw.code),
    platformId: exactString(raw.platformId),
    revisionId: exactString(raw.revisionId),
  };
  return Object.values(readback).some((field) => field === null) ? null : Object.freeze(readback);
}

function canonicalSuccessor(value) {
  return {
    lockId: value.lockId,
    kind: value.kind,
    bindingMode: 'successor',
    name: value.name,
    code: value.code,
    platformId: value.platformId,
    scopeSha256: value.scopeSha256,
    parentReceiptHash: value.parentReceiptHash,
    revisionId: value.revisionId,
    previousReceiptHash: value.previousReceiptHash,
    transitionId: value.transitionId,
    runId: value.runId,
  };
}

/** Create a run-scoped successor only from a transition frozen in the set. */
export function createRunSuccessorProof({
  handle,
  binding,
  transitionId,
  previousHeadHash,
  authoritativeReadback,
  runId,
} = {}) {
  try {
    const state = HANDLE_STATE.get(handle);
    if (!state) return successorDenied('ENTITY_LOCK_HANDLE_INVALID');
    const requested = parseActionBinding(binding);
    const transitionName = exactString(transitionId);
    const previousHash = exactSha(previousHeadHash);
    const readback = parseReadback(authoritativeReadback);
    const normalizedRunId = exactString(runId);
    if (!requested || !transitionName || !previousHash || !readback
      || !normalizedRunId || !SAFE_RUN_ID.test(normalizedRunId)) return successorDenied('ENTITY_SUCCESSOR_INPUT_INVALID');

    const transition = state.transitionById.get(transitionName);
    if (!transition || bindingKey(transition) !== bindingKey(requested)) {
      return successorDenied('ENTITY_TRANSITION_NOT_SIGNED');
    }
    const receipt = state.receiptByLock.get(requested.lockId);
    const policy = receipt && state.policyByKind.get(receipt.kind);
    if (!receipt || !policy || transition.previousReceiptHash !== receipt.receiptHash) {
      return successorDenied('ENTITY_TRANSITION_INVALID');
    }
    if (state.activeHeads.get(requested.lockId) !== previousHash || previousHash !== transition.previousReceiptHash) {
      return successorDenied('ENTITY_LOCK_HEAD_STALE');
    }
    if (readback.name !== transition.expectedName || readback.code !== transition.expectedCode) {
      return successorDenied('ENTITY_SUCCESSOR_IDENTITY_MISMATCH');
    }
    if (policy.platformId === 'required' && readback.platformId !== receipt.platformId) {
      return successorDenied('PLATFORM_ID_MISMATCH');
    }
    if (policy.revision === 'exact' && !readback.revisionId) {
      return successorDenied('REVISION_UNAVAILABLE');
    }
    if (policy.revision === 'exact' && readback.revisionId === receipt.revisionId) {
      return successorDenied('ENTITY_SUCCESSOR_REVISION_NOT_ADVANCED');
    }

    const canonical = Object.freeze(canonicalSuccessor({
      lockId: receipt.lockId,
      kind: receipt.kind,
      name: readback.name,
      code: readback.code,
      platformId: readback.platformId,
      scopeSha256: receipt.scopeSha256,
      parentReceiptHash: receipt.parentReceiptHash,
      revisionId: readback.revisionId,
      previousReceiptHash: previousHash,
      transitionId: transition.transitionId,
      runId: normalizedRunId,
    }));
    const receiptHash = sha256(JSON.stringify(canonical));
    const proof = Object.freeze({
      ok: true,
      ...canonical,
      receiptHash,
    });
    state.activeHeads.set(receipt.lockId, receiptHash);
    state.runProofs.set(receiptHash, proof);
    return proof;
  } catch {
    return successorDenied('ENTITY_SUCCESSOR_FAILED');
  }
}
