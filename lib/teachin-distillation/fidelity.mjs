// 三分 coverage 与 mapping 保真校验：mapping 只能忠实复述已解析的事实，
// 不得改 expected、identity 或 effect。纯核心：零 browser、零 fs、零 network、零 LLM。
// 首错固定返回稳定 reason，不回显事件原值、URL、参数或身份内容。

import { createHash } from 'node:crypto';
import { atomAcceptsActionSequence } from './atom-resolution.mjs';

const MAPPING_ROW_KEYS = ['atom', 'evidenceEventSeqs', 'intentId', 'params'];

function frozen(value) {
  return Object.freeze(value);
}

function denied(reason) {
  return frozen({ ok: false, reason });
}

function isPlainRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// 稳定摘要：只对结构化快照算，绝不含 runtime 对象或凭据。
export function contractDigest(value) {
  const text = value === undefined ? 'absent' : JSON.stringify(value);
  return `sha256:${createHash('sha256').update(text ?? 'absent').digest('hex')}`;
}

function checkRowShape(row) {
  if (!isPlainRecord(row)) return 'MAPPING_INVALID';
  if (Object.hasOwn(row, 'identity')) return 'MAPPING_IDENTITY_MISMATCH';
  if (Object.hasOwn(row, 'entityBindings')) return 'MAPPING_IDENTITY_MISMATCH';
  if (Object.hasOwn(row, 'effect')) return 'MAPPING_EFFECT_MISMATCH';
  const keys = Object.keys(row).sort();
  if (keys.join(',') !== MAPPING_ROW_KEYS.join(',')) return 'MAPPING_INVALID';
  if (typeof row.intentId !== 'string' || !row.intentId) return 'MAPPING_INVALID';
  if (typeof row.atom !== 'string' || !row.atom) return 'MAPPING_INVALID';
  if (!isPlainRecord(row.params)) return 'MAPPING_INVALID';
  if (!Array.isArray(row.evidenceEventSeqs) || row.evidenceEventSeqs.length === 0) {
    return 'MAPPING_INVALID';
  }
  for (const seq of row.evidenceEventSeqs) {
    if (!Number.isSafeInteger(seq) || seq <= 0) return 'MAPPING_INVALID';
  }
  return null;
}

function checkRowEvidence(row, bySeq, recipes) {
  for (const seq of row.evidenceEventSeqs) {
    if (!bySeq.has(seq)) return 'MAPPING_EVENT_OUT_OF_RANGE';
  }
  const seen = new Set();
  for (const seq of row.evidenceEventSeqs) {
    if (seen.has(seq)) return 'MAPPING_EVENT_DUPLICATE';
    seen.add(seq);
  }
  for (let index = 1; index < row.evidenceEventSeqs.length; index += 1) {
    if (row.evidenceEventSeqs[index] <= row.evidenceEventSeqs[index - 1]) {
      return 'MAPPING_INVALID';
    }
  }
  const events = row.evidenceEventSeqs.map((seq) => bySeq.get(seq));
  // 结构事件永远不得被 mapping evidence 吞并：它只随 trigger 归属物化。
  if (events.some((event) => event.role !== 'business')) return 'TOPOLOGY_COVERAGE_MISMATCH';
  if (!atomAcceptsActionSequence(recipes, row.atom, events.map((event) => event.action))) {
    return 'MAPPING_ACTION_MISMATCH';
  }
  return null;
}

export function validateResolvedProjection(options = {}) {
  let projection;
  let resolved;
  let pending;
  let structural;
  let mappingCandidate;
  let registry;
  let recipes;
  let authoredIntentIds;
  try {
    if (!options || typeof options !== 'object') return denied('MAPPING_INVALID');
    ({
      projection,
      resolved,
      pending,
      structural,
      mappingCandidate,
      registry,
      recipes,
      authoredIntentIds,
    } = options);
  } catch {
    return denied('MAPPING_INVALID');
  }
  if (!Array.isArray(mappingCandidate)) return denied('MAPPING_INVALID');
  if (!isPlainRecord(registry) || !isPlainRecord(registry.atoms)) {
    return denied('MAPPING_ATOM_UNKNOWN');
  }

  const bySeq = new Map(projection.map((event) => [event.eventSeq, event]));
  // intentId 是行驱动的业务归组标签：authored testcase 在场时只认 authored intentId，
  // 缺席才由投影的合成序数兜底；两种情形都不要求 mapping 行去凑合成序数。
  const authoredIds = authoredIntentIds instanceof Set && authoredIntentIds.size > 0
    ? authoredIntentIds
    : null;

  for (const row of mappingCandidate) {
    const shapeReason = checkRowShape(row);
    if (shapeReason) return denied(shapeReason);
    if (authoredIds && !authoredIds.has(row.intentId)) return denied('MAPPING_INVALID');
    for (const seq of row.evidenceEventSeqs) {
      if (!bySeq.has(seq)) return denied('MAPPING_EVENT_OUT_OF_RANGE');
    }
    const seen = new Set();
    for (const seq of row.evidenceEventSeqs) {
      if (seen.has(seq)) return denied('MAPPING_EVENT_DUPLICATE');
      seen.add(seq);
    }
    if (!Object.hasOwn(registry.atoms, row.atom)) return denied('MAPPING_ATOM_UNKNOWN');
    const evidenceReason = checkRowEvidence(row, bySeq, recipes);
    if (evidenceReason) return denied(evidenceReason);
  }

  // 跨行双消费：同一 compound key 不得被两个 mapping 行同时消费。
  const claimed = new Map();
  for (const row of mappingCandidate) {
    for (const seq of row.evidenceEventSeqs) {
      if (claimed.has(seq)) return denied('CAPTURE_EVENT_MULTI_COVERED');
      claimed.set(seq, row);
    }
  }

  const pendingSeqs = new Set(pending.map((item) => item.eventSeq));
  for (const seq of claimed.keys()) {
    if (pendingSeqs.has(seq)) return denied('MAPPED_PENDING_OVERLAP');
  }

  // resolved 单元与 mapping 行必须一一对应：同一 atom、同一 evidence 集合。
  const rowsByKey = new Map(mappingCandidate.map(
    (row) => [row.evidenceEventSeqs.join(','), row],
  ));
  for (const unit of resolved) {
    const row = rowsByKey.get(unit.evidenceEventSeqs.join(','));
    if (!row) return denied('CAPTURE_EVENT_UNCOVERED');
    if (row.atom !== unit.atom) return denied('MAPPING_ACTION_MISMATCH');
    if (row.intentId !== unit.intentId) return denied('MAPPING_INVALID');
  }
  const resolvedKeys = new Set(resolved.map((unit) => unit.evidenceEventSeqs.join(',')));
  for (const row of mappingCandidate) {
    if (!resolvedKeys.has(row.evidenceEventSeqs.join(','))) {
      return denied('CAPTURE_EVENT_UNCOVERED');
    }
  }

  const mappedEventSeqs = [...claimed.keys()].sort((a, b) => a - b);
  const pendingEventSeqs = [...pendingSeqs].sort((a, b) => a - b);
  const structuralEventSeqs = structural
    .map((event) => event.eventSeq)
    .sort((a, b) => a - b);

  const buckets = [mappedEventSeqs, pendingEventSeqs, structuralEventSeqs];
  const union = new Set();
  for (const bucket of buckets) {
    for (const seq of bucket) {
      if (union.has(seq)) return denied('TOPOLOGY_COVERAGE_MISMATCH');
      union.add(seq);
    }
  }
  if (union.size !== projection.length) return denied('TOPOLOGY_COVERAGE_MISMATCH');

  // structural 事件必须绑定精确 trigger；trigger 不在三分账内即不闭合。
  for (const event of structural) {
    if (event.action !== 'newpage') continue;
    if (typeof event.triggerCompoundKey !== 'string' || !event.triggerCompoundKey) {
      return denied('TOPOLOGY_COVERAGE_MISMATCH');
    }
    const trigger = projection.find(
      (item) => item.compoundKey === event.triggerCompoundKey,
    );
    if (!trigger || trigger.role !== 'business') {
      return denied('TOPOLOGY_COVERAGE_MISMATCH');
    }
  }

  return frozen({
    ok: true,
    reason: null,
    coverage: frozen({
      mappedEventSeqs: frozen(mappedEventSeqs),
      pendingEventSeqs: frozen(pendingEventSeqs),
      structuralEventSeqs: frozen(structuralEventSeqs),
    }),
  });
}
