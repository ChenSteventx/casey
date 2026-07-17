// 业务对象语义锁纯函数内核。
// 只判断“当前观察是否仍是签署时的同一业务对象”；不定位 DOM、不点击、不参与 verdict。
import { createHash } from 'node:crypto';

const BINDING_MODES = new Set(['existing', 'created-in-run', 'successor']);
const SOURCES = new Set(['user-confirmed', 'platform-readback']);
const REVISION_POLICIES = new Set(['any', 'exact']);
const HASH_PREFIX = 'sha256:';

function requiredString(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} 须为非空 string`);
  return value.trim();
}

function optionalString(value, label) {
  if (value == null) return null;
  return requiredString(value, label);
}

function safeFingerprint(value) {
  const normalized = requiredString(value, 'scopeFingerprint');
  if (!normalized.startsWith(HASH_PREFIX) || normalized.length <= HASH_PREFIX.length
    || normalized.includes('://') || normalized.includes('/') || normalized.includes('\\')) {
    throw new TypeError('scopeFingerprint 须为不含 URL/路径的 sha256 指纹');
  }
  return normalized;
}

function canonicalReceipt(receipt) {
  return {
    schemaVersion: 1,
    artifactKind: 'entity-identity-receipt',
    lockId: receipt.lockId,
    kind: receipt.kind,
    bindingMode: receipt.bindingMode,
    name: receipt.name,
    code: receipt.code,
    platformId: receipt.platformId ?? null,
    scopeFingerprint: receipt.scopeFingerprint,
    parentReceiptHash: receipt.parentReceiptHash ?? null,
    revisionPolicy: receipt.revisionPolicy,
    revisionId: receipt.revisionId ?? null,
    source: receipt.source,
    previousReceiptHash: receipt.previousReceiptHash ?? null,
    status: receipt.status,
  };
}

function hashReceipt(receipt) {
  return `${HASH_PREFIX}${createHash('sha256').update(JSON.stringify(canonicalReceipt(receipt))).digest('hex')}`;
}

function frozenReceipt(fields) {
  const canonical = canonicalReceipt(fields);
  return Object.freeze({ ...canonical, receiptHash: hashReceipt(canonical) });
}

export function createEntityLockReceipt({
  lockId,
  kind,
  bindingMode,
  scopeFingerprint,
  expected,
  observed,
  source,
  parentReceiptHash = null,
  revisionPolicy = 'any',
  previousReceiptHash = null,
} = {}) {
  const mode = requiredString(bindingMode, 'bindingMode');
  if (!BINDING_MODES.has(mode)) throw new TypeError(`bindingMode 不支持：${mode}`);
  const normalizedSource = requiredString(source, 'source/来源');
  if (!SOURCES.has(normalizedSource)) throw new TypeError(`source/来源 不支持：${normalizedSource}`);
  if (mode === 'existing' && normalizedSource !== 'user-confirmed') {
    throw new TypeError('existing 外部对象来源必须为 user-confirmed');
  }
  if (mode !== 'existing' && normalizedSource !== 'platform-readback') {
    throw new TypeError(`${mode} 对象来源必须为 platform-readback`);
  }

  const name = requiredString(expected?.name, 'name/名称');
  const code = requiredString(expected?.code, 'code/编号');
  const observedName = requiredString(observed?.name, 'observed.name');
  const observedCode = requiredString(observed?.code, 'observed.code/编号');
  if (name !== observedName || code !== observedCode) throw new TypeError('名称或编号权威读回与期望不一致');

  const policy = requiredString(revisionPolicy, 'revisionPolicy');
  if (!REVISION_POLICIES.has(policy)) throw new TypeError(`revisionPolicy 不支持：${policy}`);
  const revisionId = optionalString(observed?.revisionId, 'revisionId');
  if (policy === 'exact' && !revisionId) throw new TypeError('revisionPolicy=exact 必须提供平台权威 revisionId');

  return frozenReceipt({
    schemaVersion: 1,
    artifactKind: 'entity-identity-receipt',
    lockId: requiredString(lockId, 'lockId'),
    kind: requiredString(kind, 'kind'),
    bindingMode: mode,
    name,
    code,
    platformId: optionalString(observed?.platformId, 'platformId'),
    scopeFingerprint: safeFingerprint(scopeFingerprint),
    parentReceiptHash: optionalString(parentReceiptHash, 'parentReceiptHash'),
    revisionPolicy: policy,
    revisionId,
    source: normalizedSource,
    previousReceiptHash: optionalString(previousReceiptHash, 'previousReceiptHash'),
    status: 'active',
  });
}

export function verifyEntityLockReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return false;
  try {
    if (receipt.schemaVersion !== 1 || receipt.artifactKind !== 'entity-identity-receipt' || receipt.status !== 'active') return false;
    requiredString(receipt.lockId, 'lockId');
    requiredString(receipt.kind, 'kind');
    if (!BINDING_MODES.has(requiredString(receipt.bindingMode, 'bindingMode'))) return false;
    requiredString(receipt.name, 'name');
    requiredString(receipt.code, 'code');
    optionalString(receipt.platformId, 'platformId');
    safeFingerprint(receipt.scopeFingerprint);
    optionalString(receipt.parentReceiptHash, 'parentReceiptHash');
    if (!REVISION_POLICIES.has(requiredString(receipt.revisionPolicy, 'revisionPolicy'))) return false;
    const revisionId = optionalString(receipt.revisionId, 'revisionId');
    if (receipt.revisionPolicy === 'exact' && !revisionId) return false;
    if (!SOURCES.has(requiredString(receipt.source, 'source'))) return false;
    if (receipt.bindingMode === 'existing' && receipt.source !== 'user-confirmed') return false;
    if (receipt.bindingMode !== 'existing' && receipt.source !== 'platform-readback') return false;
    optionalString(receipt.previousReceiptHash, 'previousReceiptHash');
    return typeof receipt.receiptHash === 'string' && receipt.receiptHash === hashReceipt(receipt);
  } catch {
    return false;
  }
}

const OUTCOMES = Object.freeze({
  SAME: { allowAction: true, reason: null, nextAction: null },
  MISSING: { allowAction: false, reason: 'ENTITY_NOT_FOUND', nextAction: 'RETRY_OR_RESELECT' },
  AMBIGUOUS: { allowAction: false, reason: 'ENTITY_PAIR_AMBIGUOUS', nextAction: 'CONFIRM_EXACT_CODE_OR_CANCEL' },
  UNVERIFIED: { allowAction: false, reason: 'ENTITY_IDENTITY_UNVERIFIED', nextAction: 'PROVIDE_IDENTITY_OR_RERECORD' },
});

function result(status, reason = undefined, nextAction = undefined, candidateCount = undefined) {
  const base = OUTCOMES[status] || OUTCOMES.UNVERIFIED;
  const out = {
    status,
    allowAction: base.allowAction,
    reason: reason === undefined ? base.reason : reason,
    nextAction: nextAction === undefined ? base.nextAction : nextAction,
  };
  if (candidateCount !== undefined) out.candidateCount = candidateCount;
  return Object.freeze(out);
}

function currentIdentity(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const required = ['kind', 'name', 'code', 'scopeFingerprint'];
  if (required.some((key) => typeof value[key] !== 'string' || !value[key].trim())) return null;
  return {
    kind: value.kind.trim(),
    name: value.name.trim(),
    code: value.code.trim(),
    platformId: value.platformId == null ? null : (typeof value.platformId === 'string' && value.platformId.trim() ? value.platformId.trim() : undefined),
    scopeFingerprint: value.scopeFingerprint.trim(),
    parentReceiptHash: value.parentReceiptHash == null ? null : (typeof value.parentReceiptHash === 'string' && value.parentReceiptHash.trim() ? value.parentReceiptHash.trim() : undefined),
    revisionId: value.revisionId == null ? null : (typeof value.revisionId === 'string' && value.revisionId.trim() ? value.revisionId.trim() : undefined),
  };
}

export function compareEntityLock(recorded, current) {
  if (!verifyEntityLockReceipt(recorded)) return result('UNVERIFIED', 'ENTITY_LOCK_INVALID', 'RERECORD_AND_RESIGN');
  if (current == null) return result('MISSING');
  const observed = currentIdentity(current);
  if (!observed || observed.platformId === undefined || observed.parentReceiptHash === undefined || observed.revisionId === undefined) {
    return result('UNVERIFIED');
  }
  if (observed.kind !== recorded.kind) return result('CHANGED', 'OBJECT_KIND_MISMATCH', 'RESELECT_AND_RESIGN');
  if (observed.scopeFingerprint !== recorded.scopeFingerprint) return result('CHANGED', 'SCOPE_MISMATCH', 'RESTORE_SCOPE_OR_CANCEL');
  if (observed.parentReceiptHash !== recorded.parentReceiptHash) return result('CHANGED', 'PARENT_IDENTITY_MISMATCH', 'RESELECT_AND_RESIGN');
  if (observed.name !== recorded.name) return result('CHANGED', 'ENTITY_NAME_MISMATCH', 'CONFIRM_NEW_IDENTITY_AND_RESIGN');
  if (observed.code !== recorded.code) return result('CHANGED', 'ENTITY_CODE_MISMATCH', 'CONFIRM_NEW_IDENTITY_AND_RESIGN');
  if (recorded.platformId != null) {
    if (observed.platformId == null) return result('UNVERIFIED', 'PLATFORM_ID_UNAVAILABLE', 'RERECORD_OR_CANCEL');
    if (observed.platformId !== recorded.platformId) return result('CHANGED', 'PLATFORM_ID_MISMATCH', 'RESELECT_AND_RESIGN');
  }
  if (recorded.revisionPolicy === 'exact') {
    if (observed.revisionId == null) return result('UNVERIFIED', 'REVISION_UNAVAILABLE', 'RERECORD_OR_CANCEL');
    if (observed.revisionId !== recorded.revisionId) return result('CHANGED', 'ENTITY_REVISION_DRIFT', 'CONFIRM_NEW_REVISION_AND_RESIGN');
  }
  return result('SAME');
}

export function resolveEntityLockCandidate(candidates, recorded) {
  if (!verifyEntityLockReceipt(recorded)) return result('UNVERIFIED', 'ENTITY_LOCK_INVALID', 'RERECORD_AND_RESIGN', 0);
  if (!Array.isArray(candidates)) return result('UNVERIFIED', 'CANDIDATE_SET_INVALID', 'RETRY_OR_CANCEL', 0);
  const physical = new Map();
  for (const candidate of candidates) {
    const observed = currentIdentity(candidate);
    const physicalId = typeof candidate?.physicalId === 'string' && candidate.physicalId.trim() ? candidate.physicalId.trim() : null;
    if (!observed || !physicalId) continue;
    if (observed.kind === recorded.kind && observed.scopeFingerprint === recorded.scopeFingerprint
      && observed.name === recorded.name && observed.code === recorded.code && !physical.has(physicalId)) {
      physical.set(physicalId, observed);
    }
  }
  if (physical.size === 0) return result('MISSING', undefined, undefined, 0);
  if (physical.size > 1) return result('AMBIGUOUS', undefined, undefined, physical.size);
  const compared = compareEntityLock(recorded, physical.values().next().value);
  return Object.freeze({ ...compared, candidateCount: 1 });
}

export function createEntityLockSuccessor({ previous, transition, observed, evidenceSource } = {}) {
  if (!verifyEntityLockReceipt(previous)) throw new TypeError('previous 身份收据无效');
  if (!transition || transition.declared !== true) throw new TypeError('identity transition/身份迁移必须在签署 flow 中显式声明');
  const nextName = requiredString(transition.expected?.name, 'transition.expected.name');
  const nextCode = requiredString(transition.expected?.code, 'transition.expected.code');
  const nextPlatformId = optionalString(observed?.platformId, 'observed.platformId');
  if (previous.platformId != null && nextPlatformId !== previous.platformId) {
    throw new TypeError('identity transition 的 platformId 与原对象不一致');
  }
  return createEntityLockReceipt({
    lockId: previous.lockId,
    kind: previous.kind,
    bindingMode: 'successor',
    scopeFingerprint: previous.scopeFingerprint,
    expected: { name: nextName, code: nextCode },
    observed: {
      name: observed?.name,
      code: observed?.code,
      platformId: nextPlatformId,
      revisionId: observed?.revisionId ?? (previous.revisionPolicy === 'exact' ? previous.revisionId : null),
    },
    source: evidenceSource,
    parentReceiptHash: previous.parentReceiptHash,
    revisionPolicy: previous.revisionPolicy,
    previousReceiptHash: previous.receiptHash,
  });
}

