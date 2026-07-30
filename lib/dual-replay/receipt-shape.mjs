// semantic replay receipt 的闭合 schema、canonical 顺序与只读 capability。
// receipt 只含 canonical digest 与稳定语义投影：无 URL、locator、动态 ID、时间戳与 session 值。
// 纯核心：零 browser、零 fs、零 network、零 LLM。

import {
  denied, digestOf, exactKeys, frozen, isDigest, verdictShapeOk,
} from './source-plan-authority.mjs';
import { checkEvidenceRefs } from './semantic-projection.mjs';
import { readCompletionRecord, consumeCompletionRecord } from './replay-completion.mjs';

const RECEIPT_STATE = new WeakMap();
const PREDECESSOR_GRANT_STATE = new WeakMap();
const COMPARISON_GRANT_STATE = new WeakMap();

const RECEIPT_KEYS = [
  'schemaVersion', 'artifactKind', 'scope', 'pairId', 'role', 'runOrdinal',
  'runNamespace', 'predecessorReceiptSha256', 'binding', 'freshness', 'intents',
  'terminalHardPredicates', 'topology', 'entities', 'effects', 'cleanup',
];
const BINDING_KEYS = [
  'testcaseSha256', 'expectedSha256', 'expectedObligationsSha256', 'candidateSha256',
  'eventsSha256', 'axesSha256', 'verdictSha256', 'entityLockSetSha256',
  'executionTargetAttestationSha256', 'sutBuildDigest', 'channelProfileDigest',
  'identityProfileDigest', 'replayKernelDigest', 'resetPlanDigest', 'sessionPolicyDigest',
];
const FRESHNESS_KEYS = [
  'resetReceiptSha256', 'baselineProjectionSha256', 'lifecycleAttestationSha256',
];

function schemaShapeOk(receipt) {
  if (!exactKeys(receipt, RECEIPT_KEYS)) return false;
  if (receipt.schemaVersion !== 1) return false;
  if (receipt.artifactKind !== 'semantic-replay-receipt') return false;
  if (receipt.scope !== 'read-only-v1') return false;
  if (typeof receipt.pairId !== 'string' || !receipt.pairId) return false;
  if (typeof receipt.runNamespace !== 'string' || !receipt.runNamespace) return false;
  if (receipt.role === 'source') {
    if (receipt.runOrdinal !== 1 || receipt.predecessorReceiptSha256 !== null) return false;
  } else if (receipt.role === 'distilled') {
    if (receipt.runOrdinal !== 2 || !isDigest(receipt.predecessorReceiptSha256)) return false;
  } else {
    return false;
  }
  if (!exactKeys(receipt.binding, BINDING_KEYS)) return false;
  for (const key of BINDING_KEYS) if (!isDigest(receipt.binding[key])) return false;
  if (!exactKeys(receipt.freshness, FRESHNESS_KEYS)) return false;
  for (const key of FRESHNESS_KEYS) if (!isDigest(receipt.freshness[key])) return false;
  if (!Array.isArray(receipt.intents) || receipt.intents.length === 0) return false;
  for (const row of receipt.intents) {
    if (!exactKeys(row, ['intentId', 'verdict', 'reason'])) return false;
    if (typeof row.intentId !== 'string' || !row.intentId) return false;
  }
  if (!Array.isArray(receipt.terminalHardPredicates)) return false;
  for (const row of receipt.terminalHardPredicates) {
    if (!exactKeys(row, ['intentId', 'predicateSha256', 'ok'])) return false;
    if (typeof row.intentId !== 'string' || !isDigest(row.predicateSha256)) return false;
    if (typeof row.ok !== 'boolean') return false;
  }
  if (!Array.isArray(receipt.topology)) return false;
  for (const row of receipt.topology) {
    if (!exactKeys(row, ['intentId', 'ordinal', 'kind', 'routeProjectionSha256'])) return false;
    if (typeof row.intentId !== 'string' || !Number.isSafeInteger(row.ordinal)) return false;
    if (typeof row.kind !== 'string' || !isDigest(row.routeProjectionSha256)) return false;
  }
  if (!Array.isArray(receipt.entities)) return false;
  for (const row of receipt.entities) {
    if (!exactKeys(row, ['intentId', 'role', 'kind', 'identitySha256'])) return false;
    if (typeof row.intentId !== 'string' || typeof row.role !== 'string') return false;
    if (typeof row.kind !== 'string' || !isDigest(row.identitySha256)) return false;
  }
  if (!Array.isArray(receipt.effects)) return false;
  for (const row of receipt.effects) {
    if (!exactKeys(row, ['intentId', 'effectClass', 'evidenceRefs', 'projectionSha256'])) {
      return false;
    }
    if (typeof row.intentId !== 'string' || typeof row.effectClass !== 'string') return false;
    if (!Array.isArray(row.evidenceRefs) || !isDigest(row.projectionSha256)) return false;
  }
  if (!exactKeys(receipt.cleanup, ['required', 'status', 'policySha256'])) return false;
  if (typeof receipt.cleanup.required !== 'boolean') return false;
  if (typeof receipt.cleanup.status !== 'string') return false;
  if (!isDigest(receipt.cleanup.policySha256)) return false;
  return true;
}

function scopeSupported(receipt) {
  for (const row of receipt.effects) if (row.effectClass !== 'read') return false;
  if (receipt.cleanup.required !== false) return false;
  return receipt.cleanup.status === 'NOT_REQUIRED_READ_ONLY';
}

// 固定首错：schema → scope → intent 覆盖 → predicate 覆盖/满足 → 结构去重 → effect 证据引用。
export function validateSemanticReplayReceipt(receipt) {
  if (!schemaShapeOk(receipt)) return denied('RECEIPT_SCHEMA_INVALID');
  for (const row of receipt.intents) {
    if (!verdictShapeOk(row.verdict, row.reason)) return denied('RECEIPT_SCHEMA_INVALID');
  }
  if (!scopeSupported(receipt)) return denied('UNSUPPORTED_EFFECT_CLASS');
  const verdictByIntent = new Map();
  for (const row of receipt.intents) {
    if (verdictByIntent.has(row.intentId)) return denied('INTENT_COVERAGE_MISMATCH');
    verdictByIntent.set(row.intentId, row.verdict);
  }
  const predicateAnchors = new Set();
  for (const row of receipt.terminalHardPredicates) {
    const anchor = `${row.intentId}#${row.predicateSha256}`;
    if (!verdictByIntent.has(row.intentId) || predicateAnchors.has(anchor)) {
      return denied('TERMINAL_PREDICATE_COVERAGE_MISMATCH');
    }
    predicateAnchors.add(anchor);
  }
  const anchors = new Set();
  for (const row of receipt.topology) {
    const anchor = `topology:${row.intentId}#${row.ordinal}`;
    if (anchors.has(anchor)) return denied('RECEIPT_SCHEMA_INVALID');
    anchors.add(anchor);
  }
  for (const row of receipt.entities) {
    const anchor = `entity:${row.intentId}#${row.role}`;
    if (anchors.has(anchor)) return denied('RECEIPT_SCHEMA_INVALID');
    anchors.add(anchor);
  }
  for (const row of receipt.effects) {
    const anchor = `effect:${row.intentId}`;
    if (anchors.has(anchor)) return denied('RECEIPT_SCHEMA_INVALID');
    anchors.add(anchor);
  }
  for (const row of receipt.terminalHardPredicates) {
    if (verdictByIntent.get(row.intentId) === 'PASS' && row.ok !== true) {
      return denied('TERMINAL_PREDICATE_NOT_SATISFIED');
    }
  }
  const refReason = checkEvidenceRefs(receipt);
  if (refReason) return denied(refReason);
  return frozen({ ok: true });
}

function projectReceipt(record) {
  return {
    schemaVersion: 1,
    artifactKind: 'semantic-replay-receipt',
    scope: 'read-only-v1',
    pairId: record.pairId,
    role: record.role,
    runOrdinal: record.runOrdinal,
    runNamespace: record.runNamespace,
    predecessorReceiptSha256: record.predecessorReceiptSha256,
    binding: { ...record.binding },
    freshness: { ...record.freshness },
    intents: record.projection.intents.map((row) => ({ ...row })),
    terminalHardPredicates: record.projection.terminalHardPredicates.map((row) => ({ ...row })),
    topology: record.projection.topology.map((row) => ({ ...row })),
    entities: record.projection.entities.map((row) => ({ ...row })),
    effects: record.projection.effects.map((row) => ({
      ...row,
      evidenceRefs: [...row.evidenceRefs],
    })),
    cleanup: { ...record.projection.cleanup },
  };
}

export function createSemanticReplayReceipt({ completionAuthority }) {
  const record = readCompletionRecord(completionAuthority);
  if (!record || record.pairBound !== true) return denied('RUN_COMPLETION_AUTHORITY_INVALID');
  const receipt = projectReceipt(record);
  const validated = validateSemanticReplayReceipt(receipt);
  if (validated.ok !== true) return denied(validated.reason);
  const bytes = Buffer.from(JSON.stringify(receipt), 'utf8');
  consumeCompletionRecord(completionAuthority);
  const authority = frozen(Object.create(null));
  RECEIPT_STATE.set(authority, {
    pairRecord: record.pairRecord,
    role: record.role,
    receiptSha256: digestOf(bytes),
    bytes: Buffer.from(bytes),
    receipt,
    freshness: { ...record.freshness },
    binding: { ...record.binding },
    predecessorIssued: false,
    comparisonIssued: false,
  });
  return frozen({
    ok: true,
    bytes,
    receipt: Object.freeze(receipt),
    authority,
  });
}

export function readReceiptAuthority(authority) {
  if (!authority || typeof authority !== 'object') return null;
  return RECEIPT_STATE.get(authority) || null;
}

export function issuePredecessorGrant({ receiptAuthority }) {
  const record = readReceiptAuthority(receiptAuthority);
  if (!record || record.predecessorIssued) return denied('RECEIPT_AUTHORITY_INVALID');
  record.predecessorIssued = true;
  const grant = frozen(Object.create(null));
  PREDECESSOR_GRANT_STATE.set(grant, { record, consumed: false });
  return frozen({ ok: true, grant });
}

export function issueComparisonGrant({ receiptAuthority }) {
  const record = readReceiptAuthority(receiptAuthority);
  if (!record || record.comparisonIssued) return denied('RECEIPT_AUTHORITY_INVALID');
  record.comparisonIssued = true;
  const grant = frozen(Object.create(null));
  COMPARISON_GRANT_STATE.set(grant, { record, consumed: false });
  return frozen({ ok: true, grant });
}

function inspectGrant(state, grant) {
  const entry = grant && typeof grant === 'object' ? state.get(grant) : null;
  return entry && !entry.consumed ? entry : null;
}

export function inspectPredecessorGrant(grant) {
  return inspectGrant(PREDECESSOR_GRANT_STATE, grant);
}

export function inspectComparisonGrant(grant) {
  return inspectGrant(COMPARISON_GRANT_STATE, grant);
}

export function consumeGrantEntry(entry) {
  if (!entry || entry.consumed) return null;
  entry.consumed = true;
  return entry.record;
}
