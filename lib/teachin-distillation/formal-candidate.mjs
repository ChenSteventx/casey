// distilled formal candidate 物化：structural 事件按 lineage 精确重插、topology parity 复核、
// 降权 manifest。纯核心：零 browser、零 fs、零 network、零 LLM。
// 产物永远是 developmentOnly 候选，不冒充正式结论，也不置签署/可回放标志。

import { assertTopologyParity } from '../page-topology/topology-events.mjs';

// 编译产物一律不得携带这些越权字段：身份、副作用与签署面只属于现役冻结策略与人签。
const FORBIDDEN_EVENT_KEYS = new Set([
  'identity',
  'effect',
  'entityBindings',
  'signed',
  'replayReady',
  'verdict',
]);

function frozen(value) {
  return Object.freeze(value);
}

function denied(reason) {
  return frozen({ ok: false, reason });
}

function isPlainRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function materializeDistilledFormalCandidate(options = {}) {
  let caseId;
  let captureSha256;
  let projection;
  let resolved;
  let structural;
  let compiledEvents;
  let compileLineage;
  let coverage;
  try {
    if (!options || typeof options !== 'object') return denied('FORMAL_CANDIDATE_NOT_READY');
    ({
      caseId,
      captureSha256,
      projection,
      resolved,
      structural,
      compiledEvents,
      compileLineage,
      coverage,
    } = options);
  } catch {
    return denied('FORMAL_CANDIDATE_NOT_READY');
  }
  if (!Array.isArray(compiledEvents) || compiledEvents.length === 0) {
    return denied('FORMAL_CANDIDATE_NOT_READY');
  }
  if (!Array.isArray(compileLineage) || !Array.isArray(resolved)) {
    return denied('FORMAL_CANDIDATE_NOT_READY');
  }
  if (!Array.isArray(structural) || !Array.isArray(projection)) {
    return denied('FORMAL_CANDIDATE_NOT_READY');
  }

  for (const event of compiledEvents) {
    if (!isPlainRecord(event)) return denied('FORMAL_CANDIDATE_NOT_READY');
    for (const key of Object.keys(event)) {
      if (FORBIDDEN_EVENT_KEYS.has(key)) return denied('CONTRACT_FIELD_MUTATION');
    }
  }

  const events = compiledEvents.map((event) => structuredClone(event));
  const lineageByKey = new Map(compileLineage.map((row) => [row.mappingKey, row]));
  const unitByCompoundKey = new Map();
  for (const unit of resolved) {
    for (const key of unit.evidenceCompoundKeys) unitByCompoundKey.set(key, unit);
  }

  const newPages = structural.filter((event) => event.action === 'newpage');
  for (const event of newPages) {
    const unit = unitByCompoundKey.get(event.triggerCompoundKey);
    // trigger 仍 pending 时结构事件不得单独物化。
    if (!unit) return denied('FORMAL_CANDIDATE_NOT_READY');
    const lineage = lineageByKey.get(unit.mappingKey);
    if (!lineage) return denied('FORMAL_CANDIDATE_NOT_READY');
    const lastStepId = lineage.stepIds[lineage.stepIds.length - 1];
    const anchorIndex = events.findIndex((item) => item.stepId === lastStepId);
    if (anchorIndex < 0) return denied('FORMAL_CANDIDATE_NOT_READY');
    const stepId = `${lastStepId}_newpage`;
    if (events.some((item) => item.stepId === stepId)) {
      return denied('FORMAL_CANDIDATE_NOT_READY');
    }
    events.splice(anchorIndex + 1, 0, {
      stepId,
      action: 'newpage',
      url: `{{baseUrl}}${event.pathHint}`,
    });
  }

  if (newPages.length > 0) {
    const parity = assertTopologyParity({
      sourceEvents: projection.map((item) => ({
        action: item.action,
        path: item.pathHint,
      })),
      distilledEvents: events,
    });
    if (!parity.ok) return denied('FORMAL_TOPOLOGY_PARITY_FAILED');
  }

  const manifest = frozen({
    schemaVersion: 1,
    caseId,
    captureSha256,
    developmentOnly: true,
    promotionReady: false,
    resolvedCount: resolved.length,
    structuralCount: newPages.length,
    mappedEventSeqs: frozen([...(coverage?.mappedEventSeqs || [])]),
    pendingEventSeqs: frozen([...(coverage?.pendingEventSeqs || [])]),
    structuralEventSeqs: frozen([...(coverage?.structuralEventSeqs || [])]),
  });

  return frozen({
    ok: true,
    eventsCandidate: events,
    manifest,
  });
}
