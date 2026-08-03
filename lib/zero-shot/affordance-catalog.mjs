// Deterministic projection from lazy driver facts to the bounded public catalog.
// Raw DOM facts and physical handles never enter PageObservation JSON.

import { createHash } from 'node:crypto';
import {
  inspectAffordanceAuthority,
  issueAffordanceAuthority,
  revalidateAffordance,
} from './affordance-authority.mjs';
import {
  isSensitivePublicText,
  normalizePublicText,
  sanitizePublicSemanticName,
} from './public-observation-redaction.mjs';

const observationArtifacts = new WeakMap();
const MAX_TEXT = 256;

function denied(reason) {
  return Object.freeze({ ok: false, reason });
}

function releaseHandle(handle) {
  if (handle && typeof handle.dispose === 'function') {
    Promise.resolve(handle.dispose()).catch(() => {});
  }
}

function releaseRecords(records) {
  if (!(records instanceof Map)) return;
  const released = new Set();
  for (const record of records.values()) {
    const handle = record?.handle;
    if (handle && !released.has(handle)) {
      released.add(handle);
      releaseHandle(handle);
    }
  }
}

function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) deepFreeze(value[key], seen);
  return Object.freeze(value);
}

function cleanText(value) {
  return normalizePublicText(value, MAX_TEXT);
}

function cleanRole(value) {
  const role = cleanText(value)?.toLowerCase();
  return role && /^[a-z][a-z0-9-]{0,63}$/.test(role) ? role : null;
}

// 三个名称来源任一命中敏感规则时整条候选被抑制。它与「无可用名称」必须分开计数：
// 无名候选永远匹配不上 role+name 判据，被抑制的候选却可能正是缺席断言要找的那一个。
function isRedactionSuppressed(raw) {
  return [raw?.accessibleName, raw?.label, raw?.text].some(isSensitivePublicText);
}

function semanticOf(raw) {
  if (isRedactionSuppressed(raw)) {
    return null;
  }
  const accessibleName = sanitizePublicSemanticName(raw?.accessibleName);
  const role = cleanRole(raw?.role);
  if (role && accessibleName) {
    return deepFreeze({ kind: 'role', role, name: accessibleName, exact: true });
  }
  const label = sanitizePublicSemanticName(raw?.label);
  if (label) return deepFreeze({ kind: 'label', name: label, exact: true });
  const text = sanitizePublicSemanticName(raw?.text);
  if (text) return deepFreeze({ kind: 'text', name: text, exact: true });
  return null;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function semanticKey(semantic) {
  return canonical(semantic);
}

function actionSpaceOf(raw) {
  const source = Array.isArray(raw?.actionSpace) ? raw.actionSpace : [];
  return Object.freeze(source.includes('click') ? ['click'] : []);
}

function digestCatalog({ truncated, totalCandidates, redactionSuppressed, affordances }) {
  const body = canonical({ truncated, totalCandidates, redactionSuppressed, affordances });
  return `sha256:${createHash('sha256').update(body, 'utf8').digest('hex')}`;
}

export function createAffordanceCatalog({ snapshot, maxCandidates } = {}) {
  if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.affordances)
    || !Number.isInteger(maxCandidates) || maxCandidates < 1) {
    return denied('AFFORDANCE_CATALOG_FAILED');
  }

  const projected = [];
  const discardedHandles = new Set();
  let redactionSuppressed = 0;
  for (let index = 0; index < snapshot.affordances.length; index += 1) {
    const raw = snapshot.affordances[index];
    if (!raw || typeof raw !== 'object' || !Object.hasOwn(raw, 'handle')) continue;
    const semantic = semanticOf(raw);
    if (!semantic) {
      if (isRedactionSuppressed(raw)) redactionSuppressed += 1;
      discardedHandles.add(raw.handle);
      continue;
    }
    const actionSpace = actionSpaceOf(raw);
    projected.push({
      originalIndex: index,
      handle: raw.handle,
      semantic,
      semanticKey: semanticKey(semantic),
      visible: raw.visible === true,
      enabled: raw.enabled === true,
      actionSpace,
    });
  }

  const counts = new Map();
  for (const item of projected) {
    counts.set(item.semanticKey, (counts.get(item.semanticKey) || 0) + 1);
  }
  projected.sort((left, right) => left.semanticKey.localeCompare(right.semanticKey)
    || Number(right.visible) - Number(left.visible)
    || Number(right.enabled) - Number(left.enabled)
    || left.originalIndex - right.originalIndex);

  const sourceTruncated = snapshot.truncated === true || snapshot.sourceTruncated === true;
  const truncated = sourceTruncated || projected.length > maxCandidates;
  const bounded = projected.slice(0, maxCandidates);
  for (const item of projected.slice(maxCandidates)) discardedHandles.add(item.handle);
  const retainedHandles = new Set(bounded.map((item) => item.handle));
  for (const handle of discardedHandles) {
    if (!retainedHandles.has(handle)) releaseHandle(handle);
  }
  const affordances = [];
  const records = new Map();
  for (let index = 0; index < bounded.length; index += 1) {
    const item = bounded[index];
    const affordanceId = `af_${String(index + 1).padStart(4, '0')}`;
    const pageCount = counts.get(item.semanticKey) || 0;
    const actionable = item.visible && item.enabled && pageCount === 1
      && item.actionSpace.includes('click');
    const publicItem = deepFreeze({
      affordanceId,
      semantic: item.semantic,
      visible: item.visible,
      enabled: item.enabled,
      actionSpace: item.actionSpace,
      pageCount,
      actionable,
    });
    affordances.push(publicItem);
    records.set(affordanceId, Object.freeze({
      handle: item.handle,
      semanticSignature: item.semantic,
      visible: item.visible,
      enabled: item.enabled,
      actionSpace: item.actionSpace,
      pageCount,
    }));
  }
  const frozenAffordances = Object.freeze(affordances);
  const catalogDigest = digestCatalog({
    truncated,
    totalCandidates: projected.length,
    redactionSuppressed,
    affordances: frozenAffordances,
  });
  return Object.freeze({
    ok: true,
    reason: null,
    affordances: frozenAffordances,
    catalogDigest,
    truncated,
    redactionSuppressed,
    totalCandidates: projected.length,
    records,
  });
}

export function bindObservationAuthority({
  driver,
  observation,
  revision,
  records,
  blockReason,
} = {}) {
  if (!observation || typeof observation !== 'object'
    || !Object.isFrozen(observation)
    || typeof observation.observationId !== 'string'
    || typeof observation.catalogDigest !== 'string') {
    releaseRecords(records);
    return denied('OBSERVATION_INVALID');
  }
  let issued;
  try {
    issued = issueAffordanceAuthority({
      driver,
      observation,
      revision,
      records,
      blockReason,
    });
  } catch {
    releaseRecords(records);
    return denied('AUTHORITY_BUILD_FAILED');
  }
  if (issued?.ok !== true) {
    releaseRecords(records);
    return denied(issued?.reason || 'AUTHORITY_BUILD_FAILED');
  }
  observationArtifacts.set(observation, Object.freeze({
    observationId: observation.observationId,
    catalogDigest: observation.catalogDigest,
  }));
  return issued;
}

export function validateObservationArtifact(observation) {
  if (!observation || typeof observation !== 'object' || !observationArtifacts.has(observation)) {
    return denied('OBSERVATION_INVALID');
  }
  const bound = observationArtifacts.get(observation);
  if (observation.observationId !== bound.observationId
    || observation.catalogDigest !== bound.catalogDigest) {
    return denied('OBSERVATION_INVALID');
  }
  return Object.freeze({
    ok: true,
    reason: null,
    observationId: bound.observationId,
    catalogDigest: bound.catalogDigest,
  });
}

export function inspectObservationAuthority({
  observation,
  observationAuthority,
  expectedCatalogDigest,
} = {}) {
  return inspectAffordanceAuthority({
    authority: observationAuthority,
    observation,
    expectedCatalogDigest,
    requireLatest: true,
  });
}

export async function resolveCatalogTarget({
  observation,
  observationAuthority,
  targetAffordanceId,
} = {}) {
  return revalidateAffordance({
    authority: observationAuthority,
    observation,
    affordanceId: targetAffordanceId,
    expectedCatalogDigest: observation?.catalogDigest,
  });
}
