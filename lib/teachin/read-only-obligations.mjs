// 首发 read-only teach-in 的共享语义投影：
// signed expected → obligations，以及 canonical axes/verdict → 同锚 evidence。
// 两侧共用同一 digest 规则；不读取页面、不裁定、不补猜 entity/topology。

import { createHash } from 'node:crypto';

const CLEANUP_STATUS = 'NOT_REQUIRED_READ_ONLY';

function frozen(value) {
  return Object.freeze(value);
}

function digestOf(value) {
  return `sha256:${createHash('sha256')
    .update(typeof value === 'string' ? value : JSON.stringify(value), 'utf8')
    .digest('hex')}`;
}

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function intentMap(expectedDocument) {
  if (!isRecord(expectedDocument) || !Array.isArray(expectedDocument.intents)) return null;
  const map = new Map();
  for (const intent of expectedDocument.intents) {
    if (!isRecord(intent) || typeof intent.intentId !== 'string' || !intent.intentId
      || !Array.isArray(intent.expected) || map.has(intent.intentId)) return null;
    map.set(intent.intentId, intent.expected);
  }
  return map;
}

function assertionRows(expectedDocument, intentId, expectedByIntent) {
  const local = expectedByIntent.get(intentId);
  const global = Array.isArray(expectedDocument.globalAssertions)
    ? expectedDocument.globalAssertions
    : [];
  const all = [...local, ...global];
  const hard = [];
  for (const [sourceOrdinal, assertion] of all.entries()) {
    if (!isRecord(assertion)) return null;
    if (assertion.soft === true) continue;
    hard.push({
      sourceOrdinal,
      predicateSha256: digestOf({
        schemaVersion: 1,
        intentId,
        sourceOrdinal,
        assertion,
      }),
    });
  }
  return { all, hard };
}

function effectFor(intentId, predicates) {
  const evidenceRefs = predicates.map(
    (row) => `predicate:${row.predicateSha256}`,
  );
  return {
    intentId,
    effectClass: 'read',
    evidenceRefs,
    projectionSha256: digestOf({
      schemaVersion: 1,
      intentId,
      effectClass: 'read',
      evidenceRefs,
    }),
  };
}

function cleanup() {
  return {
    required: false,
    status: CLEANUP_STATUS,
    policySha256: digestOf({
      schemaVersion: 1,
      policy: 'read-only-no-cleanup',
    }),
  };
}

export function projectReadOnlyObligations({
  expectedDocument,
  intentOrder,
} = {}) {
  const expectedByIntent = intentMap(expectedDocument);
  if (!expectedByIntent || !Array.isArray(intentOrder) || intentOrder.length === 0) return null;
  if (new Set(intentOrder).size !== intentOrder.length) return null;
  const terminalHardPredicates = [];
  const effects = [];
  for (const intentId of intentOrder) {
    if (!expectedByIntent.has(intentId)) return null;
    const projected = assertionRows(expectedDocument, intentId, expectedByIntent);
    if (!projected) return null;
    const predicates = projected.hard.map((row) => ({
      intentId,
      predicateSha256: row.predicateSha256,
    }));
    terminalHardPredicates.push(...predicates);
    effects.push(effectFor(intentId, predicates));
  }
  return frozen({
    intents: frozen([...intentOrder]),
    terminalHardPredicates: frozen(terminalHardPredicates),
    topology: frozen([]),
    entities: frozen([]),
    effects: frozen(effects),
    cleanup: frozen(cleanup()),
  });
}

function parseBytes(bytes) {
  if (!Buffer.isBuffer(bytes)) return null;
  try {
    const value = JSON.parse(bytes.toString('utf8'));
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

export function projectReadOnlySemanticEvidence({
  expectedDocument,
  intentOrder,
  axesBytes,
  verdictBytes,
  eventSeqsByIntent,
} = {}) {
  const expectedByIntent = intentMap(expectedDocument);
  const obligations = projectReadOnlyObligations({ expectedDocument, intentOrder });
  const axes = parseBytes(axesBytes);
  const verdict = parseBytes(verdictBytes);
  if (!expectedByIntent || !obligations || !Array.isArray(axes?.steps)
    || !Array.isArray(verdict?.steps)) return null;
  const axesByIntent = new Map(axes.steps.map((step) => [step?.intentId, step]));
  const verdictByIntent = new Map(verdict.steps.map((step) => [
    step?.intentId || step?.stepId,
    step,
  ]));
  const intents = [];
  const terminalHardPredicates = [];
  for (const intentId of intentOrder) {
    const axis = axesByIntent.get(intentId);
    const judged = verdictByIntent.get(intentId);
    const assertions = assertionRows(expectedDocument, intentId, expectedByIntent);
    if (!axis || !judged || !assertions || !Array.isArray(axis.postAssertions)) return null;
    const reason = judged.reason === undefined ? null : judged.reason;
    if (typeof judged.verdict !== 'string'
      || (reason !== null && typeof reason !== 'string')) return null;
    intents.push({
      intentId,
      eventSeqs: eventSeqsByIntent instanceof Map
        ? [...(eventSeqsByIntent.get(intentId) || [])]
        : [],
      verdict: judged.verdict,
      reason,
    });
    for (const row of assertions.hard) {
      const actual = axis.postAssertions[row.sourceOrdinal];
      if (!isRecord(actual) || typeof actual.ok !== 'boolean') return null;
      terminalHardPredicates.push({
        intentId,
        predicateSha256: row.predicateSha256,
        ok: actual.ok,
      });
    }
  }
  return frozen({
    intents: frozen(intents),
    terminalHardPredicates: frozen(terminalHardPredicates),
    topology: frozen([]),
    entities: frozen([]),
    effects: obligations.effects,
    cleanup: obligations.cleanup,
  });
}
