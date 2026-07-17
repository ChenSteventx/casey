// Business-object semantic lock v2.
//
// This module is deliberately pure and has no browser/SUT concerns.  A receipt's
// own digest is only a content address; authority comes from the lock-set bytes
// matching a digest supplied by the frozen contract outside those bytes.
import { createHash } from 'node:crypto';
import {
  closeSync, constants as FS_CONSTANTS, fstatSync, lstatSync, openSync,
  readFileSync, realpathSync, statSync,
} from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENTITY_SEMANTIC_LOCK_PUBLICATIONS } from './entity-semantic-lock-publications.mjs';

const SHA256 = /^[0-9a-f]{64}$/;
const SAFE_ID = /^[A-Za-z0-9._-]+$/;
const CONTRACT_ID = /^[a-z0-9][a-z0-9-]*$/;
const SUPPORTED_KINDS = new Set(['workflow', 'agent']);
const INITIAL_BINDING_MODES = new Set(['existing', 'created-in-run']);
const POLICY_PLATFORM = new Set(['required']);
const POLICY_PARENT = new Set(['required', 'optional', 'forbidden']);
const POLICY_REVISION = new Set(['exact']);

const HANDLE_STATE = new WeakMap();
const LOCK_AUTHORITY_STATE = new WeakMap();
const RUNTIME_ADAPTER_STATE = new WeakMap();
const RUNTIME_CAPABILITY_STATE = new WeakMap();
const RUN_CONTEXT_STATE = new WeakMap();
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Production driver implementations must be hand-published here (or replaced
// by a trusted-launcher capability). An empty registry is intentional: until a
// real driver has independent provenance, runtime authority remains closed.
const TRUSTED_RUNTIME_DRIVERS = new Map();
const TRUSTED_RUN_CONTEXT_ISSUERS = new Map();

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

function authorityDenied(reason = 'ENTITY_LOCK_AUTHORITY_INVALID') {
  return Object.freeze({ ok: false, reason, nextAction: NEXT_ACTION.RERECORD });
}

function runtimeDenied(reason = 'ENTITY_RUNTIME_READ_FAILED') {
  return Object.freeze({ ok: false, reason, nextAction: NEXT_ACTION.RETRY });
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

function closedObjectWithOptional(value, requiredKeys, optionalKeys = []) {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const ownKeys = Reflect.ownKeys(descriptors);
    const required = new Set(requiredKeys);
    const allowed = new Set([...requiredKeys, ...optionalKeys]);
    if (ownKeys.some((key) => typeof key !== 'string' || !allowed.has(key))) return null;
    if ([...required].some((key) => !Object.prototype.hasOwnProperty.call(descriptors, key))) return null;
    const out = Object.create(null);
    for (const key of ownKeys) {
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

function safeRepositoryPath(relativePath) {
  if (!isExactString(relativePath) || relativePath.includes('\\') || relativePath.startsWith('/')) return null;
  const absolute = resolve(PROJECT_ROOT, relativePath);
  if (absolute !== PROJECT_ROOT && !absolute.startsWith(`${PROJECT_ROOT}${sep}`)) return null;
  return absolute;
}

function sameFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino
    && left.size === right.size && left.mode === right.mode;
}

function readPublishedFile(relativePath, expectedSha256) {
  const absolute = safeRepositoryPath(relativePath);
  if (!absolute || !exactSha(expectedSha256)) return null;
  let fd;
  try {
    const rootReal = realpathSync(PROJECT_ROOT);
    const parts = relative(PROJECT_ROOT, absolute).split(sep).filter(Boolean);
    let cursor = PROJECT_ROOT;
    for (let index = 0; index < parts.length; index += 1) {
      cursor = resolve(cursor, parts[index]);
      const linkStat = lstatSync(cursor);
      if (linkStat.isSymbolicLink()) return null;
      if (index < parts.length - 1 && !linkStat.isDirectory()) return null;
      if (index === parts.length - 1 && !linkStat.isFile()) return null;
    }

    const beforeReal = realpathSync(absolute);
    if (beforeReal !== rootReal && !beforeReal.startsWith(`${rootReal}${sep}`)) return null;
    const pathStat = statSync(beforeReal);
    const noFollow = typeof FS_CONSTANTS.O_NOFOLLOW === 'number' ? FS_CONSTANTS.O_NOFOLLOW : 0;
    fd = openSync(absolute, FS_CONSTANTS.O_RDONLY | noFollow);
    const openedStat = fstatSync(fd);
    if (!openedStat.isFile() || !sameFile(pathStat, openedStat)) return null;

    const bytes = readFileSync(fd);
    const afterStat = fstatSync(fd);
    if (!sameFile(openedStat, afterStat) || sha256(bytes) !== expectedSha256) return null;
    const afterReal = realpathSync(absolute);
    if (afterReal !== beforeReal) return null;
    return Buffer.from(bytes);
  } catch {
    return null;
  } finally {
    if (fd !== undefined) {
      try { closeSync(fd); } catch { /* fail-closed result already decided */ }
    }
  }
}

function exactReleaseResourcePath(value) {
  const path = exactString(value);
  if (!path || path.includes('\\') || path.startsWith('/')) return null;
  const parts = path.split('/');
  if (parts.some((part) => part.length === 0 || part === '.' || part === '..')) return null;
  return path.startsWith('release/entity-semantic-lock/') ? path : null;
}

function snapshotPublishedLocks(value) {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (keys.length === 0 || keys.some((key) => typeof key !== 'string')) return null;
    const locks = Object.create(null);
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) return null;
      const safeKey = exactReleaseResourcePath(key);
      const digest = exactSha(descriptor.value);
      if (!safeKey || !digest) return null;
      locks[safeKey] = digest;
    }
    return Object.freeze(locks);
  } catch {
    return null;
  }
}

function snapshotPublishedResource(value) {
  const raw = closedObject(value, ['key', 'sha256']);
  if (!raw) return null;
  const key = exactReleaseResourcePath(raw.key);
  const digest = exactSha(raw.sha256);
  return key && digest ? Object.freeze({ key, sha256: digest }) : null;
}

function snapshotEntityLockPublication(value) {
  const raw = closedObjectWithOptional(value, ['source', 'mode', 'locks'], ['actionPolicy', 'manifest']);
  if (!raw
    || !['release-resource', 'signed-manifest'].includes(raw.source)
    || !['runtime', 'historical'].includes(raw.mode)) return null;
  const locks = snapshotPublishedLocks(raw.locks);
  if (!locks) return null;
  const actionPolicy = raw.actionPolicy === undefined ? null : snapshotPublishedResource(raw.actionPolicy);
  const manifest = raw.manifest === undefined ? null : snapshotPublishedResource(raw.manifest);
  if (raw.actionPolicy !== undefined && !actionPolicy) return null;
  if (raw.manifest !== undefined && !manifest) return null;
  return Object.freeze({
    source: raw.source,
    mode: raw.mode,
    locks,
    actionPolicy,
    manifest,
  });
}

function readEntityLockPublicationMaterial(contractId, lockSetKey) {
  const rawPublication = Object.prototype.hasOwnProperty.call(ENTITY_SEMANTIC_LOCK_PUBLICATIONS, contractId)
    ? ENTITY_SEMANTIC_LOCK_PUBLICATIONS[contractId]
    : null;
  const publication = snapshotEntityLockPublication(rawPublication);
  if (!publication || !Object.prototype.hasOwnProperty.call(publication.locks, lockSetKey)) {
    return Object.freeze({ ok: false, reason: 'ENTITY_LOCK_AUTHORITY_NOT_PUBLISHED' });
  }
  if (publication.mode === 'runtime' && !publication.actionPolicy) {
    return Object.freeze({ ok: false, reason: 'ENTITY_ACTION_POLICY_NOT_PUBLISHED' });
  }

  const frozenDigest = publication.locks[lockSetKey];
  const lockSetBytes = readPublishedFile(lockSetKey, frozenDigest);
  if (!lockSetBytes) {
    return Object.freeze({ ok: false, reason: 'ENTITY_LOCK_AUTHORITY_CHECKSUM_MISMATCH' });
  }
  const actionPolicyBytes = publication.actionPolicy
    ? readPublishedFile(publication.actionPolicy.key, publication.actionPolicy.sha256)
    : null;
  if (publication.actionPolicy && !actionPolicyBytes) {
    return Object.freeze({ ok: false, reason: 'ENTITY_ACTION_POLICY_CHECKSUM_MISMATCH' });
  }
  return Object.freeze({
    ok: true,
    publication,
    frozenDigest,
    lockSetBytes: Buffer.from(lockSetBytes),
    actionPolicyBytes: actionPolicyBytes ? Buffer.from(actionPolicyBytes) : null,
  });
}

/**
 * Read a lock set only through the hand-published executable manifest. A
 * workspace PRD is an index for the test ratchet, never an authority root.
 */
export function readFrozenEntityLockSetAuthority(input = {}) {
  try {
    const raw = closedObject(input, ['contractId', 'lockSetKey']);
    if (!raw) return authorityDenied();
    const contractId = exactString(raw.contractId);
    const lockSetKey = exactString(raw.lockSetKey);
    if (!contractId || !CONTRACT_ID.test(contractId) || !lockSetKey) return authorityDenied();
    const material = readEntityLockPublicationMaterial(contractId, lockSetKey);
    if (!material.ok) return authorityDenied(material.reason);

    const authority = Object.freeze({
      artifactKind: 'frozen-entity-lock-set-authority',
      contractId,
      lockSetKey,
    });
    LOCK_AUTHORITY_STATE.set(authority, Object.freeze({
      contractId,
      lockSetKey,
      lockSetBytes: Buffer.from(material.lockSetBytes),
      setSha256: material.frozenDigest,
      publicationMode: material.publication.mode,
      actionPolicyBytes: material.actionPolicyBytes ? Buffer.from(material.actionPolicyBytes) : null,
    }));
    return Object.freeze({ ok: true, authority });
  } catch {
    return authorityDenied();
  }
}

function parseEventEntityBinding(value) {
  const raw = closedObject(value, ['role', 'candidate', 'lockAuthority']);
  if (!raw) return null;
  const authority = closedObject(raw.lockAuthority, ['lockId', 'receiptHash']);
  if (!authority) return null;
  const binding = {
    role: exactString(raw.role),
    candidate: exactString(raw.candidate),
    lockId: exactString(authority.lockId),
    receiptHash: exactSha(authority.receiptHash),
  };
  return Object.values(binding).some((field) => field === null) ? null : Object.freeze(binding);
}

function parseEventsDocument(value, expectedCaseId) {
  const document = projectPlainObject(value, [
    'schemaVersion', 'channel', 'caseId', 'url', 'recordedAt',
    'compiledBy', 'authored', 'events',
  ]);
  if (!document
    || document.schemaVersion !== 2
    || document.channel !== 'web'
    || exactString(document.caseId) !== expectedCaseId
    || !exactString(document.url)
    || !exactString(document.recordedAt)
    || document.authored !== false) return null;
  const rows = closedArray(document.events);
  if (!rows || rows.length === 0) return null;

  const events = [];
  for (const row of rows) {
    const raw = projectPlainObject(row, ['stepId', 'intentId', 'atom', 'action', 'entityBindings']);
    if (!raw) return null;
    const bindingRows = raw.entityBindings === undefined ? [] : closedArray(raw.entityBindings);
    if (!bindingRows) return null;
    const entityBindings = bindingRows.map(parseEventEntityBinding);
    if (entityBindings.some((binding) => !binding)) return null;
    const seenBindings = new Set();
    for (const binding of entityBindings) {
      const key = JSON.stringify([binding.role, binding.candidate, binding.lockId, binding.receiptHash]);
      if (seenBindings.has(key)) return null;
      seenBindings.add(key);
    }
    const event = {
      stepId: exactString(raw.stepId),
      intentId: exactString(raw.intentId),
      atom: exactString(raw.atom),
      action: exactString(raw.action),
      entityBindings: Object.freeze(entityBindings),
    };
    if (!event.stepId || !event.intentId || !event.atom || !event.action) return null;
    events.push(Object.freeze(event));
  }
  return Object.freeze(events);
}

function actionPolicyKey(value) {
  return JSON.stringify([value.atom, value.action]);
}

function parseActionPolicyRole(value) {
  const raw = closedObject(value, ['role', 'kind']);
  if (!raw) return null;
  const role = exactString(raw.role);
  const kind = exactString(raw.kind);
  return role && SAFE_ID.test(role) && SUPPORTED_KINDS.has(kind)
    ? Object.freeze({ role, kind })
    : null;
}

function parseActionIdentityPolicy(value) {
  const raw = closedObject(value, ['atom', 'action', 'mutation', 'relationWrite', 'roles']);
  if (!raw || typeof raw.mutation !== 'boolean' || typeof raw.relationWrite !== 'boolean') return null;
  const atom = exactString(raw.atom);
  const action = exactString(raw.action);
  const roleRows = closedArray(raw.roles);
  if (!atom || !action || !roleRows || roleRows.length === 0) return null;
  const roles = roleRows.map(parseActionPolicyRole);
  if (roles.some((role) => !role)) return null;
  const roleNames = new Set(roles.map((role) => role.role));
  if (roleNames.size !== roles.length) return null;
  if (raw.relationWrite && (!raw.mutation || !roleNames.has('source') || !roleNames.has('target'))) return null;
  return Object.freeze({
    atom, action, mutation: raw.mutation, relationWrite: raw.relationWrite,
    roles: Object.freeze(roles),
  });
}

function parseActionPolicyDocument(value) {
  const raw = closedObject(value, ['schemaVersion', 'artifactKind', 'policies']);
  if (!raw || raw.schemaVersion !== 1 || raw.artifactKind !== 'entity-action-identity-policy') return null;
  const rows = closedArray(raw.policies);
  if (!rows || rows.length === 0) return null;
  const policies = rows.map(parseActionIdentityPolicy);
  if (policies.some((policy) => !policy)) return null;
  const byAction = new Map();
  for (const policy of policies) {
    const key = actionPolicyKey(policy);
    if (byAction.has(key)) return null;
    byAction.set(key, policy);
  }
  return byAction;
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
  const raw = closedObject(value, ['stepId', 'intentId', 'atom', 'role', 'candidate', 'lockId', 'receiptHash']);
  if (!raw) return null;
  const binding = {
    stepId: exactString(raw.stepId),
    intentId: exactString(raw.intentId),
    atom: exactString(raw.atom),
    role: exactString(raw.role),
    candidate: exactString(raw.candidate),
    lockId: exactString(raw.lockId),
    receiptHash: exactSha(raw.receiptHash),
  };
  return Object.values(binding).some((field) => field === null) ? null : Object.freeze(binding);
}

function parseTransition(value) {
  const raw = closedObject(value, [
    'transitionId', 'stepId', 'intentId', 'atom', 'role', 'candidate', 'lockId',
    'previousReceiptHash', 'expectedName', 'expectedCode', 'approvalRef',
  ]);
  if (!raw) return null;
  const transition = {
    transitionId: exactString(raw.transitionId),
    stepId: exactString(raw.stepId),
    intentId: exactString(raw.intentId),
    atom: exactString(raw.atom),
    role: exactString(raw.role),
    candidate: exactString(raw.candidate),
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
  return JSON.stringify([value.stepId, value.intentId, value.atom, value.role, value.candidate, value.lockId]);
}

function bindingAuthorityKey(value) {
  return JSON.stringify([
    value.stepId, value.intentId, value.atom, value.role,
    value.candidate, value.lockId, value.receiptHash,
  ]);
}

function parseLockSet(value, expectedCaseId, expectedEventsSha256, events) {
  const raw = closedObject(value, [
    'schemaVersion', 'artifactKind', 'caseId', 'eventsSha256',
    'identityPolicies', 'receipts', 'bindings', 'transitions',
  ]);
  if (!raw || raw.schemaVersion !== 3 || raw.artifactKind !== 'entity-lock-set'
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
  const eventBindingAuthorities = new Set();
  for (const event of events) {
    for (const eventBinding of event.entityBindings) {
      const key = bindingAuthorityKey({ ...event, ...eventBinding });
      if (eventBindingAuthorities.has(key)) return null;
      eventBindingAuthorities.add(key);
    }
  }
  const bindings = bindingRows.map(parseBinding);
  if (bindings.some((item) => !item)) return null;
  const bindingByKey = new Map();
  for (const binding of bindings) {
    const receipt = receiptByLock.get(binding.lockId);
    const key = bindingKey(binding);
    if (!receipt || receipt.receiptHash !== binding.receiptHash
      || !eventKeys.has(tupleKey(binding))
      || !eventBindingAuthorities.has(bindingAuthorityKey(binding))
      || bindingByKey.has(key)) return null;
    bindingByKey.set(key, binding);
  }
  if (eventBindingAuthorities.size !== bindings.length) return null;

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

function verifyRequiredActionRoles(events, lockSet, actionPolicyByAction) {
  if (!(actionPolicyByAction instanceof Map)) return false;
  for (const event of events) {
    const policy = actionPolicyByAction.get(actionPolicyKey(event));
    if (!policy) return false;
    if (event.entityBindings.length !== policy.roles.length) return false;
    const actualByRole = new Map();
    for (const eventBinding of event.entityBindings) {
      if (actualByRole.has(eventBinding.role)) return false;
      actualByRole.set(eventBinding.role, eventBinding);
    }
    for (const required of policy.roles) {
      const actual = actualByRole.get(required.role);
      if (!actual) return false;
      const frozenBinding = lockSet.bindingByKey.get(bindingKey({ ...event, ...actual }));
      const receipt = frozenBinding && lockSet.receiptByLock.get(frozenBinding.lockId);
      if (!frozenBinding || !receipt || receipt.kind !== required.kind) return false;
    }
  }
  return true;
}

/** Validate an authority-loaded lock set against one real events document. */
export function verifyEntityLockSet(input = {}) {
  try {
    const raw = closedObject(input, ['authority', 'caseId', 'eventsBytes']);
    if (!raw) return verifyDenied('ENTITY_LOCK_AUTHORITY_INVALID');
    const authorityState = LOCK_AUTHORITY_STATE.get(raw.authority);
    const expectedCaseId = exactString(raw.caseId);
    if (!authorityState || !expectedCaseId) return verifyDenied('ENTITY_LOCK_AUTHORITY_INVALID');
    const parsedLock = parseJsonBytesOnce(authorityState.lockSetBytes);
    const parsedEvents = parseJsonBytesOnce(raw.eventsBytes);
    if (!parsedLock || !parsedEvents) return verifyDenied('ENTITY_LOCK_SET_INVALID');
    const eventsSha256 = sha256(parsedEvents.bytes);
    const events = parseEventsDocument(parsedEvents.value, expectedCaseId);
    if (!events) return verifyDenied('ENTITY_LOCK_EVENTS_INVALID');
    const parsed = parseLockSet(parsedLock.value, expectedCaseId, eventsSha256, events);
    if (!parsed) return verifyDenied('ENTITY_LOCK_SET_INVALID');
    if (authorityState.actionPolicyBytes) {
      const parsedActionPolicy = parseJsonBytesOnce(authorityState.actionPolicyBytes);
      const actionPolicyByAction = parsedActionPolicy && parseActionPolicyDocument(parsedActionPolicy.value);
      if (!actionPolicyByAction || !verifyRequiredActionRoles(events, parsed, actionPolicyByAction)) {
        return verifyDenied('ENTITY_ACTION_REQUIRED_ROLES_INVALID');
      }
    }
    const runtimeAuthorized = authorityState.publicationMode === 'runtime'
      && Boolean(authorityState.actionPolicyBytes);

    const handle = Object.freeze({ artifactKind: 'verified-entity-lock-set-v3' });
    HANDLE_STATE.set(handle, {
      ...parsed,
      setSha256: authorityState.setSha256,
      authority: raw.authority,
      runtimeAuthorized,
      activeHeads: new Map([...parsed.receiptByLock].map(([lockId, receipt]) => [lockId, receipt.receiptHash])),
      runProofs: new Map(),
      runtimeAnchors: new Map(),
    });
    return Object.freeze({ ok: true, handle, runtimeAuthorized });
  } catch {
    return verifyDenied('ENTITY_LOCK_SET_INVALID');
  }
}

function parseActionBinding(value) {
  const raw = closedObject(value, ['stepId', 'intentId', 'atom', 'role', 'candidate', 'lockId']);
  if (!raw) return null;
  const binding = {
    stepId: exactString(raw.stepId),
    intentId: exactString(raw.intentId),
    atom: exactString(raw.atom),
    role: exactString(raw.role),
    candidate: exactString(raw.candidate),
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

function parseRunContext(value) {
  return value && typeof value === 'object' ? RUN_CONTEXT_STATE.get(value) ?? null : null;
}

function snapshotRuntimeCandidate(value) {
  const raw = closedObject(value, [
    'physicalId', 'kind', 'name', 'code', 'platformId', 'scopeSha256',
    'parentReceiptHash', 'revisionId',
  ]);
  return raw ? Object.freeze({ ...raw }) : null;
}

function snapshotTrustedRuntimeDriver(adapterId, value) {
  const id = exactString(adapterId);
  const raw = closedObject(value, ['read']);
  return id && SAFE_ID.test(id) && raw && typeof raw.read === 'function'
    ? Object.freeze({ adapterId: id, read: raw.read })
    : null;
}

function snapshotTrustedRunContextIssuer(issuerId, value) {
  const id = exactString(issuerId);
  const raw = closedObject(value, ['issue']);
  return id && SAFE_ID.test(id) && raw && typeof raw.issue === 'function'
    ? Object.freeze({ issuerId: id, issue: raw.issue })
    : null;
}

function hasConcreteTrustedRuntimeDriver() {
  for (const [adapterId, value] of TRUSTED_RUNTIME_DRIVERS) {
    if (snapshotTrustedRuntimeDriver(adapterId, value)) return true;
  }
  return false;
}

function hasConcreteTrustedRunContextIssuer() {
  for (const [issuerId, value] of TRUSTED_RUN_CONTEXT_ISSUERS) {
    if (snapshotTrustedRunContextIssuer(issuerId, value)) return true;
  }
  return false;
}

function readRuntimePublicationReadinessFacts() {
  let runtimePublicationReady = false;
  let actionPolicyReady = false;
  try {
    const descriptors = Object.getOwnPropertyDescriptors(ENTITY_SEMANTIC_LOCK_PUBLICATIONS);
    for (const [contractId, descriptor] of Object.entries(descriptors)) {
      if (!CONTRACT_ID.test(contractId)
        || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) continue;
      const publication = snapshotEntityLockPublication(descriptor.value);
      if (!publication || publication.mode !== 'runtime') continue;

      let locksReadable = true;
      for (const [key, digest] of Object.entries(publication.locks)) {
        const bytes = readPublishedFile(key, digest);
        const parsed = bytes && bytes.length > 0 ? parseJsonBytesOnce(bytes) : null;
        if (!parsed || parsed.value === null || typeof parsed.value !== 'object' || Array.isArray(parsed.value)) {
          locksReadable = false;
          break;
        }
      }
      if (!locksReadable) continue;
      runtimePublicationReady = true;

      if (publication.actionPolicy) {
        const bytes = readPublishedFile(publication.actionPolicy.key, publication.actionPolicy.sha256);
        const parsed = bytes && bytes.length > 0 ? parseJsonBytesOnce(bytes) : null;
        if (parsed && parseActionPolicyDocument(parsed.value)) actionPolicyReady = true;
      }
      if (runtimePublicationReady && actionPolicyReady) break;
    }
  } catch {
    return Object.freeze({ runtimePublicationReady: false, actionPolicyReady: false });
  }
  return Object.freeze({ runtimePublicationReady, actionPolicyReady });
}

function unavailableReadiness(reason) {
  return Object.freeze({ available: false, route: 'human', reason });
}

/** Pure four-root readiness decision. It never mints runtime authority. */
export function deriveEntityRuntimeReadiness(input = {}) {
  const raw = closedObject(input, [
    'driverReady', 'runtimePublicationReady', 'actionPolicyReady', 'runContextIssuerReady',
  ]);
  if (!raw || Object.values(raw).some((value) => typeof value !== 'boolean')) {
    return unavailableReadiness('RUNTIME_READINESS_FACTS_INVALID');
  }
  if (!raw.driverReady) return unavailableReadiness('DRIVER_NOT_PUBLISHED');
  if (!raw.runtimePublicationReady) return unavailableReadiness('RUNTIME_PUBLICATION_NOT_PUBLISHED');
  if (!raw.actionPolicyReady) return unavailableReadiness('ENTITY_ACTION_POLICY_NOT_PUBLISHED');
  if (!raw.runContextIssuerReady) return unavailableReadiness('RUN_CONTEXT_ISSUER_NOT_PUBLISHED');
  return Object.freeze({ available: true, route: null, reason: null });
}

/** Report readiness only from concrete module-private production roots. */
export function readEntityRuntimeReadiness() {
  const publication = readRuntimePublicationReadinessFacts();
  return deriveEntityRuntimeReadiness({
    driverReady: hasConcreteTrustedRuntimeDriver(),
    runtimePublicationReady: publication.runtimePublicationReady,
    actionPolicyReady: publication.actionPolicyReady,
    runContextIssuerReady: hasConcreteTrustedRunContextIssuer(),
  });
}

/** Resolve one hand-published runtime driver. Caller-supplied readers are never accepted. */
export function createEntityRuntimeAdapter(input = {}) {
  try {
    const raw = closedObject(input, ['adapterId']);
    const adapterId = raw && exactString(raw.adapterId);
    const driver = adapterId && SAFE_ID.test(adapterId)
      ? snapshotTrustedRuntimeDriver(adapterId, TRUSTED_RUNTIME_DRIVERS.get(adapterId))
      : null;
    if (!raw || !driver) {
      return runtimeDenied('ENTITY_RUNTIME_ADAPTER_INVALID');
    }
    const adapter = Object.freeze({ artifactKind: 'entity-runtime-adapter', adapterId });
    RUNTIME_ADAPTER_STATE.set(adapter, Object.freeze({ adapterId, read: driver.read }));
    return Object.freeze({ ok: true, adapter });
  } catch {
    return runtimeDenied('ENTITY_RUNTIME_ADAPTER_INVALID');
  }
}

function writeIssuedRunContext(issuer, value) {
  const raw = closedObject(value, ['runLabel']);
  const runLabel = raw && exactString(raw.runLabel);
  if (!runLabel) return null;
  const runContext = Object.freeze({ artifactKind: 'entity-run-context' });
  RUN_CONTEXT_STATE.set(runContext, Object.freeze({
    issuerId: issuer.issuerId,
    runLabel,
  }));
  return runContext;
}

/** Invoke one hand-published issuer and seal its result into RUN_CONTEXT_STATE. */
export async function issueEntityRunContext(input = {}) {
  try {
    const raw = closedObject(input, ['issuerId']);
    const issuerId = raw && exactString(raw.issuerId);
    const issuer = issuerId && SAFE_ID.test(issuerId)
      ? snapshotTrustedRunContextIssuer(issuerId, TRUSTED_RUN_CONTEXT_ISSUERS.get(issuerId))
      : null;
    if (!issuer) return runtimeDenied('ENTITY_RUN_CONTEXT_ISSUER_INVALID');
    const issued = await issuer.issue(Object.freeze({ issuerId }));
    const runContext = writeIssuedRunContext(issuer, issued);
    if (!runContext) return runtimeDenied('ENTITY_RUN_CONTEXT_ISSUER_INVALID');
    return Object.freeze({ ok: true, runContext });
  } catch {
    return runtimeDenied('ENTITY_RUN_CONTEXT_ISSUER_FAILED');
  }
}

/**
 * Execute a runtime adapter read and seal its closed snapshot into an opaque
 * capability. No candidate, physical id, completeness flag, or run key is
 * exposed on the returned object.
 */
export async function readEntityRuntimeCapability(input = {}) {
  try {
    const raw = closedObject(input, ['adapter', 'binding', 'runContext']);
    if (!raw) return runtimeDenied('ENTITY_RUNTIME_CAPABILITY_INPUT_INVALID');
    const adapterState = RUNTIME_ADAPTER_STATE.get(raw.adapter);
    const binding = parseActionBinding(raw.binding);
    const runState = parseRunContext(raw.runContext);
    if (!adapterState || !binding || !runState) return runtimeDenied('ENTITY_RUNTIME_CAPABILITY_INPUT_INVALID');

    const readback = await adapterState.read(Object.freeze({ binding, runContext: raw.runContext }));
    const scan = closedObject(readback, ['complete', 'candidates']);
    if (!scan || typeof scan.complete !== 'boolean') return runtimeDenied('ENTITY_RUNTIME_READ_INVALID');
    const rows = closedArray(scan.candidates);
    if (!rows) return runtimeDenied('ENTITY_RUNTIME_READ_INVALID');
    const candidates = rows.map(snapshotRuntimeCandidate);
    if (candidates.some((candidate) => !candidate)) return runtimeDenied('ENTITY_RUNTIME_READ_INVALID');

    const capability = Object.freeze({
      artifactKind: 'entity-runtime-readback-capability',
      candidateCount: candidates.length,
    });
    RUNTIME_CAPABILITY_STATE.set(capability, Object.freeze({
      adapter: raw.adapter,
      adapterId: adapterState.adapterId,
      binding,
      runContext: raw.runContext,
      runLabel: runState.runLabel ?? null,
      complete: scan.complete,
      candidates: Object.freeze(candidates),
      candidateCount: candidates.length,
    }));
    return Object.freeze({ ok: true, capability });
  } catch {
    return runtimeDenied();
  }
}

/** The only v2 API that can return allowAction:true. */
export function evaluateEntityAction(input = {}) {
  try {
    const raw = closedObjectWithOptional(input, ['handle', 'binding', 'runtimeCapability'], ['activeHeadProof']);
    if (!raw) return deny('ENTITY_EVALUATION_INPUT_INVALID');
    const state = HANDLE_STATE.get(raw.handle);
    if (!state) return deny('ENTITY_LOCK_HANDLE_INVALID');
    if (state.runtimeAuthorized !== true) return deny('ENTITY_LOCK_RUNTIME_UNAUTHORIZED');
    const requested = parseActionBinding(raw.binding);
    if (!requested) return deny('ENTITY_BINDING_INVALID');
    const frozenBinding = state.bindingByKey.get(bindingKey(requested));
    if (!frozenBinding) return deny('ENTITY_BINDING_MISMATCH');
    const capabilityState = RUNTIME_CAPABILITY_STATE.get(raw.runtimeCapability);
    if (!capabilityState || bindingKey(capabilityState.binding) !== bindingKey(requested)) {
      return deny('ENTITY_RUNTIME_CAPABILITY_INVALID');
    }
    const initialReceipt = state.receiptByLock.get(requested.lockId);
    const activeHeadHash = state.activeHeads.get(requested.lockId);
    let receipt = initialReceipt;
    if (activeHeadHash !== frozenBinding.receiptHash) {
      const activeHeadProof = raw.activeHeadProof;
      const knownProof = activeHeadProof && typeof activeHeadProof === 'object'
        ? state.runProofs.get(activeHeadProof.receiptHash)
        : null;
      if (!knownProof || knownProof.proof !== activeHeadProof
        || knownProof.adapter !== capabilityState.adapter
        || knownProof.runContext !== capabilityState.runContext
        || activeHeadProof.lockId !== requested.lockId
        || activeHeadProof.previousReceiptHash !== frozenBinding.receiptHash
        || activeHeadProof.receiptHash !== activeHeadHash) {
        return deny('ENTITY_LOCK_HEAD_STALE', 'CHANGED', NEXT_ACTION.CONFIRM);
      }
      receipt = activeHeadProof;
    } else if (Object.prototype.hasOwnProperty.call(raw, 'activeHeadProof')) {
      return deny('ENTITY_ACTIVE_HEAD_PROOF_UNEXPECTED');
    }
    const policy = receipt && state.policyByKind.get(receipt.kind);
    if (!receipt || !policy) return deny('ENTITY_LOCK_INVALID');

    if (!capabilityState.complete) {
      return deny('ENTITY_SCAN_INCOMPLETE', 'UNVERIFIED', NEXT_ACTION.RETRY, { candidateCount: capabilityState.candidateCount });
    }
    if (capabilityState.candidateCount === 0) {
      return deny('ENTITY_NOT_FOUND', 'MISSING', 'RETRY_OR_RESELECT', { candidateCount: 0 });
    }

    const candidates = capabilityState.candidates.map((candidate) => parseCandidate(candidate, policy));
    if (candidates.some((candidate) => !candidate)) {
      return deny('ENTITY_CANDIDATE_INVALID', 'UNVERIFIED', NEXT_ACTION.RETRY, { candidateCount: capabilityState.candidateCount });
    }

    const physical = new Map();
    for (const candidate of candidates) {
      const previous = physical.get(candidate.physicalId);
      if (previous && identityKey(previous) !== identityKey(candidate)) {
        return deny('ENTITY_PHYSICAL_ID_CONFLICT', 'UNVERIFIED', NEXT_ACTION.RETRY, { candidateCount: capabilityState.candidateCount });
      }
      if (!previous) physical.set(candidate.physicalId, candidate);
    }

    // Never collapse adapter matches by a caller-readable physical id. Two
    // records are two matches even when their payloads and physical ids copy.
    if (capabilityState.candidateCount > 1) {
      return deny('ENTITY_RUNTIME_MATCH_AMBIGUOUS', 'AMBIGUOUS', 'CONFIRM_EXACT_CODE_OR_CANCEL', {
        candidateCount: capabilityState.candidateCount,
      });
    }

    const pairMatches = candidates.filter((candidate) => (
      candidate.kind === receipt.kind
      && candidate.scopeSha256 === receipt.scopeSha256
      && candidate.name === receipt.name
      && candidate.code === receipt.code
    ));
    if (pairMatches.length === 0) {
      return deny('ENTITY_IDENTITY_CHANGED', 'CHANGED', NEXT_ACTION.RESELECT, { candidateCount: capabilityState.candidateCount });
    }
    const compared = compareCandidate(receipt, pairMatches[0], policy);
    if (compared.status === 'SAME' && compared.allowAction === true) {
      state.runtimeAnchors.set(requested.lockId, Object.freeze({
        adapter: capabilityState.adapter,
        runContext: capabilityState.runContext,
      }));
    }
    return compared;
  } catch {
    return deny('ENTITY_EVALUATION_FAILED');
  }
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
    runContextKey: value.runContextKey,
  };
}

/** Create a run-scoped successor only from a transition frozen in the set. */
export function createRunSuccessorProof(input = {}) {
  try {
    const raw = closedObject(input, [
      'handle', 'binding', 'transitionId', 'previousHeadHash', 'runtimeCapability',
    ]);
    if (!raw) return successorDenied('ENTITY_SUCCESSOR_INPUT_INVALID');
    const state = HANDLE_STATE.get(raw.handle);
    if (!state) return successorDenied('ENTITY_LOCK_HANDLE_INVALID');
    if (state.runtimeAuthorized !== true) return successorDenied('ENTITY_LOCK_RUNTIME_UNAUTHORIZED');
    const requested = parseActionBinding(raw.binding);
    const transitionName = exactString(raw.transitionId);
    const previousHash = exactSha(raw.previousHeadHash);
    const capabilityState = RUNTIME_CAPABILITY_STATE.get(raw.runtimeCapability);
    if (!requested || !transitionName || !previousHash || !capabilityState
      || bindingKey(capabilityState.binding) !== bindingKey(requested)) {
      return successorDenied('ENTITY_SUCCESSOR_INPUT_INVALID');
    }

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
    const runtimeAnchor = state.runtimeAnchors.get(requested.lockId);
    if (!runtimeAnchor
      || runtimeAnchor.adapter !== capabilityState.adapter
      || runtimeAnchor.runContext !== capabilityState.runContext) {
      return successorDenied('ENTITY_SUCCESSOR_RUNTIME_MISMATCH');
    }
    if (!capabilityState.complete || capabilityState.candidateCount !== 1) {
      return successorDenied('ENTITY_SUCCESSOR_READBACK_UNVERIFIED');
    }
    const readback = parseCandidate(capabilityState.candidates[0], policy);
    if (!readback) return successorDenied('ENTITY_SUCCESSOR_READBACK_UNVERIFIED');
    if (readback.kind !== receipt.kind
      || readback.scopeSha256 !== receipt.scopeSha256
      || readback.parentReceiptHash !== receipt.parentReceiptHash
      || readback.name !== transition.expectedName
      || readback.code !== transition.expectedCode) {
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
      runContextKey: capabilityState.runLabel,
    }));
    const receiptHash = sha256(JSON.stringify(canonical));
    const proof = Object.freeze({
      ok: true,
      ...canonical,
      receiptHash,
    });
    state.activeHeads.set(receipt.lockId, receiptHash);
    state.runProofs.set(receiptHash, Object.freeze({
      proof,
      adapter: capabilityState.adapter,
      runContext: capabilityState.runContext,
    }));
    return proof;
  } catch {
    return successorDenied('ENTITY_SUCCESSOR_FAILED');
  }
}
