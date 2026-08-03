// 业务对象身份锁换签计划：旧 PRD 精确 checksum 门、内容寻址归档与 append-only 撤销 journal。
// 纯函数、零 I/O；生产 sign 负责物理 no-follow 读取与 PRD-last 发布。

import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { types as utilTypes } from 'node:util';
import { validateFrozenEntityLockArtifact } from './entity-semantic-lock-preflight.mjs';

const HASH = /^[0-9a-f]{64}$/;
const SAFE_ID = /^[A-Za-z0-9._@-]+$/;
const MAX_JOURNAL_BYTES = 1024 * 1024;
const MAX_JOURNAL_ROWS = 1000;
const REVOCATION_KEYS = Object.freeze([
  'artifactKind', 'caseId', 'revokedEntityLocksSha256', 'schemaVersion',
  'signedAgainstBuild', 'signedAt', 'signerId', 'successorEntityLocksSha256',
]);
const sha = (value) => createHash('sha256').update(value).digest('hex');
const denied = (reason) => Object.freeze({ ok: false, reason });

function plainRecord(value) {
  if (value == null || typeof value !== 'object' || Array.isArray(value) || utilTypes.isProxy(value)) return null;
  let descriptors;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch { return null; }
  const out = Object.create(null);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== 'string') return null;
    const descriptor = descriptors[key];
    if (!Object.hasOwn(descriptor, 'value') || descriptor.get || descriptor.set) return null;
    out[key] = descriptor.value;
  }
  return out;
}

function parseLockSet(text, caseId) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { return null; }
  const artifact = validateFrozenEntityLockArtifact(parsed);
  return artifact?.caseId === caseId ? artifact : null;
}

export function parseEntityLockRevocationJournal(text) {
  if (typeof text !== 'string') return denied('ENTITY_LOCK_REVOCATION_JOURNAL_NOT_TEXT');
  if (Buffer.byteLength(text) > MAX_JOURNAL_BYTES) return denied('ENTITY_LOCK_REVOCATION_JOURNAL_TOO_LARGE');
  if (text === '') return Object.freeze({ ok: true, rows: Object.freeze([]) });
  if (!text.endsWith('\n')) return denied('ENTITY_LOCK_REVOCATION_JOURNAL_UNTERMINATED');
  const lines = text.slice(0, -1).split('\n');
  if (lines.length > MAX_JOURNAL_ROWS) return denied('ENTITY_LOCK_REVOCATION_JOURNAL_TOO_MANY_ROWS');
  const rows = [];
  const generations = new Map();
  for (const line of lines) {
    if (!line) return denied('ENTITY_LOCK_REVOCATION_JOURNAL_EMPTY_ROW');
    let parsed;
    try { parsed = JSON.parse(line); } catch { return denied('ENTITY_LOCK_REVOCATION_JOURNAL_JSON_INVALID'); }
    const row = plainRecord(parsed);
    if (!row || JSON.stringify(Object.keys(row).sort()) !== JSON.stringify(REVOCATION_KEYS)) {
      return denied('ENTITY_LOCK_REVOCATION_JOURNAL_ROW_SHAPE_INVALID');
    }
    if (row.schemaVersion !== 1 || row.artifactKind !== 'entity-lock-revocation'
      || typeof row.caseId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(row.caseId)
      || typeof row.signedAt !== 'string' || !row.signedAt
      || typeof row.signedAgainstBuild !== 'string' || !SAFE_ID.test(row.signedAgainstBuild)
      || typeof row.signerId !== 'string' || !SAFE_ID.test(row.signerId)
      || typeof row.revokedEntityLocksSha256 !== 'string' || !HASH.test(row.revokedEntityLocksSha256)
      || typeof row.successorEntityLocksSha256 !== 'string' || !HASH.test(row.successorEntityLocksSha256)
      || row.revokedEntityLocksSha256 === row.successorEntityLocksSha256) {
      return denied('ENTITY_LOCK_REVOCATION_JOURNAL_ROW_INVALID');
    }
    const key = `${row.caseId}\u0000${row.revokedEntityLocksSha256}`;
    const prior = generations.get(key);
    if (prior && prior !== row.successorEntityLocksSha256) {
      return denied('ENTITY_LOCK_REVOCATION_JOURNAL_FORK');
    }
    if (prior) return denied('ENTITY_LOCK_REVOCATION_JOURNAL_DUPLICATE_GENERATION');
    generations.set(key, row.successorEntityLocksSha256);
    rows.push(Object.freeze({ ...row }));
  }
  return Object.freeze({ ok: true, rows: Object.freeze(rows) });
}

export function buildVerifiedEntityLockResignPlans({
  caseId, oldLocksText, newLocksText, verifiedOldHash, archiveDir,
  signedAt, signedAgainstBuild, signerId, revocationsText = '',
} = {}) {
  if (typeof caseId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(caseId)
    || typeof oldLocksText !== 'string' || typeof newLocksText !== 'string'
    || typeof verifiedOldHash !== 'string' || !HASH.test(verifiedOldHash)
    || typeof archiveDir !== 'string' || !archiveDir
    || typeof signedAt !== 'string' || !signedAt
    || typeof signedAgainstBuild !== 'string' || !SAFE_ID.test(signedAgainstBuild)
    || typeof signerId !== 'string' || !SAFE_ID.test(signerId)) {
    return denied('ENTITY_LOCK_RESIGN_INPUT_INVALID');
  }
  if (!parseLockSet(oldLocksText, caseId)) return denied('ENTITY_LOCK_RESIGN_OLD_LOCK_INVALID');
  if (!parseLockSet(newLocksText, caseId)) return denied('ENTITY_LOCK_RESIGN_NEW_LOCK_INVALID');
  const oldHash = sha(oldLocksText);
  const newHash = sha(newLocksText);
  if (oldHash === newHash) return denied('ENTITY_LOCK_RESIGN_NO_CHANGE');
  if (verifiedOldHash !== oldHash) return denied('ENTITY_LOCK_RESIGN_VERIFIED_OLD_HASH_MISMATCH');
  const parsedJournal = parseEntityLockRevocationJournal(revocationsText);
  if (!parsedJournal.ok) return parsedJournal;
  const record = Object.freeze({
    schemaVersion: 1,
    artifactKind: 'entity-lock-revocation',
    caseId,
    revokedEntityLocksSha256: oldHash,
    successorEntityLocksSha256: newHash,
    signedAt,
    signedAgainstBuild,
    signerId,
  });
  const prior = parsedJournal.rows.find((row) => row.caseId === caseId && row.revokedEntityLocksSha256 === oldHash);
  if (prior) {
    if (REVOCATION_KEYS.some((key) => prior[key] !== record[key])) return denied('ENTITY_LOCK_REVOCATION_JOURNAL_FORK');
    return denied('ENTITY_LOCK_REVOCATION_JOURNAL_DUPLICATE_GENERATION');
  }
  return Object.freeze({
    ok: true,
    reason: null,
    oldHash,
    newHash,
    archivePlan: Object.freeze({
      path: join(archiveDir, `entity-locks.frozen.${caseId}.${oldHash}.json`),
      text: oldLocksText,
    }),
    revocationPlan: Object.freeze({
      path: join(archiveDir, 'entity-locks.revocations.jsonl'),
      text: `${revocationsText}${JSON.stringify(record)}\n`,
      record,
    }),
  });
}

export function prepareEntityLockResign({
  caseId, oldLocksText, newLocksText, prd, entityLocksKey, archiveDir,
  signedAt, signedAgainstBuild, signerId, revocationsText = '',
} = {}) {
  if (!plainRecord(prd) || typeof entityLocksKey !== 'string' || !entityLocksKey) {
    return denied('ENTITY_LOCK_RESIGN_INPUT_INVALID');
  }
  const registered = prd.testChecksums?.[entityLocksKey];
  if (typeof registered !== 'string' || !HASH.test(registered) || registered !== sha(oldLocksText || '')) {
    return denied('ENTITY_LOCK_RESIGN_OLD_PRD_CHECKSUM_INVALID');
  }
  return buildVerifiedEntityLockResignPlans({
    caseId, oldLocksText, newLocksText, verifiedOldHash: registered, archiveDir,
    signedAt, signedAgainstBuild, signerId, revocationsText,
  });
}
