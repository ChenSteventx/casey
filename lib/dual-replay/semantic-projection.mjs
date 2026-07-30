// signed expected 的纵向投影：把现役 axes/verdict 产出的 evidence 投影成最小稳定语义，
// 并逐项对签署义务纵向成立。两边同样走错也不能靠 equality 洗白（GRILL D7）。
// 纯核心：零 browser、零 fs、零 network、零 LLM；本模块不裁定，只做确定性投影与首错停止。

import { isDigest, exactKeys, frozen, denied, verdictShapeOk } from './source-plan-authority.mjs';
import { projectTopologyEvidence } from '../page-topology/semantic-projection.mjs';

const REF_PREFIXES = ['predicate', 'topology', 'entity'];

function rowsOf(value) {
  return Array.isArray(value) ? value : null;
}

// effect 证据引用只能命中同 receipt、同 intent 的 predicate/topology/entity 投影。
export function buildEvidenceIndex(projection) {
  const index = new Map();
  const bucket = (intentId) => {
    if (!index.has(intentId)) index.set(intentId, new Set());
    return index.get(intentId);
  };
  for (const row of projection.terminalHardPredicates) {
    bucket(row.intentId).add(`predicate:${row.predicateSha256}`);
  }
  for (const row of projection.topology) {
    bucket(row.intentId).add(`topology:${row.routeProjectionSha256}`);
  }
  for (const row of projection.entities) {
    bucket(row.intentId).add(`entity:${row.identitySha256}`);
  }
  return index;
}

export function checkEvidenceRefs(projection) {
  const index = buildEvidenceIndex(projection);
  for (const effect of projection.effects) {
    const seen = new Set();
    for (const ref of effect.evidenceRefs) {
      if (typeof ref !== 'string') return 'RECEIPT_SCHEMA_INVALID';
      const prefix = ref.slice(0, ref.indexOf(':'));
      if (!REF_PREFIXES.includes(prefix)) return 'RECEIPT_SCHEMA_INVALID';
      if (seen.has(ref)) return 'RECEIPT_SCHEMA_INVALID';
      seen.add(ref);
      const available = index.get(effect.intentId);
      if (!available || !available.has(ref)) return 'EFFECT_EVIDENCE_MISSING';
    }
  }
  return null;
}

function unsupportedScope(evidence) {
  const effects = rowsOf(evidence?.effects) || [];
  for (const row of effects) {
    if (row && typeof row === 'object' && typeof row.effectClass === 'string'
      && row.effectClass !== 'read') return true;
  }
  const cleanup = evidence?.cleanup;
  if (cleanup && typeof cleanup === 'object') {
    if (cleanup.required !== false) return true;
    if (cleanup.status !== 'NOT_REQUIRED_READ_ONLY') return true;
  }
  return false;
}

function projectIntents(evidence, expected) {
  const rows = rowsOf(evidence?.intents);
  if (!rows || rows.length !== expected.intents.length) {
    return { reason: 'INTENT_COVERAGE_MISMATCH' };
  }
  const byIntent = new Map();
  for (const row of rows) {
    if (!row || typeof row !== 'object' || typeof row.intentId !== 'string') {
      return { reason: 'INTENT_COVERAGE_MISMATCH' };
    }
    if (byIntent.has(row.intentId)) return { reason: 'INTENT_COVERAGE_MISMATCH' };
    byIntent.set(row.intentId, row);
  }
  const projected = [];
  for (const intentId of expected.intents) {
    const row = byIntent.get(intentId);
    if (!row) return { reason: 'INTENT_COVERAGE_MISMATCH' };
    const reason = row.reason === undefined ? null : row.reason;
    if (!verdictShapeOk(row.verdict, reason)) return { reason: 'RECEIPT_SCHEMA_INVALID' };
    projected.push({ intentId, verdict: row.verdict, reason });
  }
  return { rows: projected, byIntent };
}

function projectPredicates(evidence, expected, verdictByIntent) {
  const rows = rowsOf(evidence?.terminalHardPredicates);
  if (!rows || rows.length !== expected.terminalHardPredicates.length) {
    return { reason: 'TERMINAL_PREDICATE_COVERAGE_MISMATCH' };
  }
  const seen = new Set();
  const byAnchor = new Map();
  for (const row of rows) {
    if (!row || typeof row !== 'object' || typeof row.intentId !== 'string') {
      return { reason: 'TERMINAL_PREDICATE_COVERAGE_MISMATCH' };
    }
    if (!verdictByIntent.has(row.intentId)) {
      return { reason: 'TERMINAL_PREDICATE_COVERAGE_MISMATCH' };
    }
    const anchor = `${row.intentId}#${row.predicateSha256}`;
    if (seen.has(anchor)) return { reason: 'TERMINAL_PREDICATE_COVERAGE_MISMATCH' };
    seen.add(anchor);
    byAnchor.set(anchor, row);
  }
  const projected = [];
  for (const expectation of expected.terminalHardPredicates) {
    const anchor = `${expectation.intentId}#${expectation.predicateSha256}`;
    const row = byAnchor.get(anchor);
    if (!row) return { reason: 'TERMINAL_PREDICATE_MISMATCH' };
    if (typeof row.ok !== 'boolean') return { reason: 'RECEIPT_SCHEMA_INVALID' };
    if (verdictByIntent.get(expectation.intentId) === 'PASS' && row.ok !== true) {
      return { reason: 'TERMINAL_PREDICATE_NOT_SATISFIED' };
    }
    projected.push({
      intentId: expectation.intentId,
      predicateSha256: expectation.predicateSha256,
      ok: row.ok,
    });
  }
  return { rows: projected };
}

function projectTopology(evidence, expected) {
  const projection = projectTopologyEvidence(rowsOf(evidence?.topology) || []);
  if (projection.ok !== true) return { reason: projection.reason };
  const byAnchor = new Map();
  for (const row of projection.rows) byAnchor.set(`${row.intentId}#${row.ordinal}`, row);
  if (byAnchor.size !== expected.topology.length) {
    return {
      reason: byAnchor.size < expected.topology.length
        ? 'TOPOLOGY_EVIDENCE_MISSING' : 'TOPOLOGY_MISMATCH',
    };
  }
  const projected = [];
  for (const expectation of expected.topology) {
    const row = byAnchor.get(`${expectation.intentId}#${expectation.ordinal}`);
    if (!row) return { reason: 'TOPOLOGY_EVIDENCE_MISSING' };
    if (row.kind !== expectation.kind
      || row.routeProjectionSha256 !== expectation.routeProjectionSha256) {
      return { reason: 'TOPOLOGY_MISMATCH' };
    }
    projected.push({ ...row });
  }
  return { rows: projected };
}

function projectEntities(evidence, expected) {
  const rows = rowsOf(evidence?.entities);
  if (!rows) return { reason: 'ENTITY_EVIDENCE_MISSING' };
  const byAnchor = new Map();
  for (const row of rows) {
    if (!row || typeof row !== 'object' || typeof row.intentId !== 'string'
      || typeof row.role !== 'string') return { reason: 'ENTITY_EVIDENCE_MISSING' };
    const anchor = `${row.intentId}#${row.role}`;
    if (byAnchor.has(anchor)) return { reason: 'ENTITY_MISMATCH' };
    byAnchor.set(anchor, row);
  }
  if (byAnchor.size !== expected.entities.length) {
    return {
      reason: byAnchor.size < expected.entities.length
        ? 'ENTITY_EVIDENCE_MISSING' : 'ENTITY_MISMATCH',
    };
  }
  const projected = [];
  for (const expectation of expected.entities) {
    const row = byAnchor.get(`${expectation.intentId}#${expectation.role}`);
    if (!row) return { reason: 'ENTITY_EVIDENCE_MISSING' };
    if (!isDigest(row.identitySha256)) return { reason: 'RECEIPT_SCHEMA_INVALID' };
    if (row.kind !== expectation.kind
      || row.identitySha256 !== expectation.identitySha256) {
      return { reason: 'ENTITY_MISMATCH' };
    }
    projected.push({
      intentId: expectation.intentId,
      role: expectation.role,
      kind: expectation.kind,
      identitySha256: expectation.identitySha256,
    });
  }
  return { rows: projected };
}

function projectEffects(evidence, expected) {
  const rows = rowsOf(evidence?.effects);
  if (!rows) return { reason: 'EFFECT_EVIDENCE_MISSING' };
  const byIntent = new Map();
  for (const row of rows) {
    if (!row || typeof row !== 'object' || typeof row.intentId !== 'string') {
      return { reason: 'EFFECT_EVIDENCE_MISSING' };
    }
    if (byIntent.has(row.intentId)) return { reason: 'EFFECT_MISMATCH' };
    byIntent.set(row.intentId, row);
  }
  if (byIntent.size !== expected.effects.length) {
    return {
      reason: byIntent.size < expected.effects.length
        ? 'EFFECT_EVIDENCE_MISSING' : 'EFFECT_MISMATCH',
    };
  }
  const projected = [];
  for (const expectation of expected.effects) {
    const row = byIntent.get(expectation.intentId);
    if (!row) return { reason: 'EFFECT_EVIDENCE_MISSING' };
    if (!Array.isArray(row.evidenceRefs) || !isDigest(row.projectionSha256)) {
      return { reason: 'RECEIPT_SCHEMA_INVALID' };
    }
    if (row.effectClass !== expectation.effectClass
      || row.projectionSha256 !== expectation.projectionSha256
      || row.evidenceRefs.length !== expectation.evidenceRefs.length
      || row.evidenceRefs.some((ref, index) => ref !== expectation.evidenceRefs[index])) {
      return { reason: 'EFFECT_MISMATCH' };
    }
    projected.push({
      intentId: expectation.intentId,
      effectClass: expectation.effectClass,
      evidenceRefs: [...expectation.evidenceRefs],
      projectionSha256: expectation.projectionSha256,
    });
  }
  return { rows: projected };
}

function projectCleanup(evidence, expected) {
  const cleanup = evidence?.cleanup;
  if (!cleanup || typeof cleanup !== 'object' || Array.isArray(cleanup)) {
    return { reason: 'CLEANUP_EVIDENCE_MISSING' };
  }
  if (!exactKeys(cleanup, ['required', 'status', 'policySha256'])) {
    return { reason: 'CLEANUP_EVIDENCE_MISSING' };
  }
  if (cleanup.policySha256 !== expected.cleanup.policySha256
    || cleanup.required !== expected.cleanup.required
    || cleanup.status !== expected.cleanup.status) {
    return { reason: 'CLEANUP_MISMATCH' };
  }
  return {
    row: {
      required: expected.cleanup.required,
      status: expected.cleanup.status,
      policySha256: expected.cleanup.policySha256,
    },
  };
}

// 固定首错：unsupported scope → intent → predicate → topology → entity → effect → cleanup。
export function projectSemanticEvidence(evidence, expected) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    return denied('INTENT_COVERAGE_MISMATCH');
  }
  if (unsupportedScope(evidence)) return denied('UNSUPPORTED_EFFECT_CLASS');
  const intents = projectIntents(evidence, expected);
  if (intents.reason) return denied(intents.reason);
  const verdictByIntent = new Map(intents.rows.map((row) => [row.intentId, row.verdict]));
  const predicates = projectPredicates(evidence, expected, verdictByIntent);
  if (predicates.reason) return denied(predicates.reason);
  const topology = projectTopology(evidence, expected);
  if (topology.reason) return denied(topology.reason);
  const entities = projectEntities(evidence, expected);
  if (entities.reason) return denied(entities.reason);
  const effects = projectEffects(evidence, expected);
  if (effects.reason) return denied(effects.reason);
  const cleanup = projectCleanup(evidence, expected);
  if (cleanup.reason) return denied(cleanup.reason);
  const projection = {
    intents: intents.rows,
    terminalHardPredicates: predicates.rows,
    topology: topology.rows,
    entities: entities.rows,
    effects: effects.rows,
    cleanup: cleanup.row,
  };
  const refReason = checkEvidenceRefs(projection);
  if (refReason) return denied(refReason);
  return frozen({ ok: true, projection });
}
