// 固定首错的确定性 comparator：纯比较，零 LLM、零 IO。
// 成功只表示本 pair 的稳定语义相同，不是 Casey 正式报告结论（GRILL D7）。

import { digestOf, exactKeys, frozen } from './source-plan-authority.mjs';
import { readPairRecord } from './pair-authority.mjs';
import {
  consumeGrantEntry, inspectComparisonGrant, readReceiptAuthority,
  validateSemanticReplayReceipt,
} from './receipt-shape.mjs';

const INPUT_KEYS = [
  'pairAuthority', 'sourceReceiptBytes', 'sourceReceiptAuthority', 'sourceComparisonGrant',
  'distilledReceiptBytes', 'distilledReceiptAuthority', 'distilledComparisonGrant',
];
const COMMON_BINDING_KEYS = [
  'testcaseSha256', 'expectedSha256', 'expectedObligationsSha256', 'sutBuildDigest',
  'channelProfileDigest', 'identityProfileDigest', 'replayKernelDigest',
  'resetPlanDigest', 'sessionPolicyDigest',
];
const COMPARED_DIMENSIONS = frozen([
  'intent-verdict', 'terminal-hard-predicate', 'topology', 'entity', 'effect', 'cleanup',
]);

function failed(reason) {
  return frozen({
    ok: false, equivalent: false, promotionEligible: false, reason,
  });
}

function parseReceipt(bytes) {
  if (!Buffer.isBuffer(bytes)) return null;
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    return null;
  }
}

function sameRows(left, right, keys) {
  if (left.length !== right.length) return false;
  return left.every((row, index) => keys.every((key) => {
    const leftValue = row[key];
    const rightValue = right[index][key];
    if (Array.isArray(leftValue) || Array.isArray(rightValue)) {
      return Array.isArray(leftValue) && Array.isArray(rightValue)
        && leftValue.length === rightValue.length
        && leftValue.every((item, at) => item === rightValue[at]);
    }
    return leftValue === rightValue;
  }));
}

function compareSemantics(source, distilled) {
  if (!sameRows(source.intents, distilled.intents, ['intentId'])) {
    return 'INTENT_COVERAGE_MISMATCH';
  }
  if (!sameRows(source.intents, distilled.intents, ['verdict', 'reason'])) {
    return 'INTENT_VERDICT_MISMATCH';
  }
  if (!sameRows(source.terminalHardPredicates, distilled.terminalHardPredicates,
    ['intentId', 'predicateSha256'])) {
    return 'TERMINAL_PREDICATE_COVERAGE_MISMATCH';
  }
  if (!sameRows(source.terminalHardPredicates, distilled.terminalHardPredicates, ['ok'])) {
    return 'TERMINAL_PREDICATE_MISMATCH';
  }
  for (const row of source.terminalHardPredicates) {
    const verdict = source.intents.find((intent) => intent.intentId === row.intentId)?.verdict;
    if (verdict === 'PASS' && row.ok !== true) return 'TERMINAL_PREDICATE_NOT_SATISFIED';
  }
  if (source.topology.length !== distilled.topology.length) {
    return distilled.topology.length < source.topology.length
      ? 'TOPOLOGY_EVIDENCE_MISSING' : 'TOPOLOGY_MISMATCH';
  }
  if (!sameRows(source.topology, distilled.topology,
    ['intentId', 'ordinal', 'kind', 'routeProjectionSha256'])) {
    return 'TOPOLOGY_MISMATCH';
  }
  if (source.entities.length !== distilled.entities.length) {
    return distilled.entities.length < source.entities.length
      ? 'ENTITY_EVIDENCE_MISSING' : 'ENTITY_MISMATCH';
  }
  if (!sameRows(source.entities, distilled.entities,
    ['intentId', 'role', 'kind', 'identitySha256'])) {
    return 'ENTITY_MISMATCH';
  }
  if (source.effects.length !== distilled.effects.length) {
    return distilled.effects.length < source.effects.length
      ? 'EFFECT_EVIDENCE_MISSING' : 'EFFECT_MISMATCH';
  }
  if (!sameRows(source.effects, distilled.effects,
    ['intentId', 'effectClass', 'evidenceRefs', 'projectionSha256'])) {
    return 'EFFECT_MISMATCH';
  }
  if (source.cleanup.policySha256 !== distilled.cleanup.policySha256
    || source.cleanup.required !== distilled.cleanup.required
    || source.cleanup.status !== distilled.cleanup.status) {
    return 'CLEANUP_MISMATCH';
  }
  // 四态中只有 PASS 可 promotion：两边完全相同的非 PASS 同样不得晋升。
  for (const row of source.intents) {
    if (row.verdict !== 'PASS') return 'NON_PROMOTABLE_VERDICT';
  }
  return null;
}

export function compareSemanticReplayReceipts(options) {
  if (!exactKeys(options, INPUT_KEYS)) return failed('COMPARISON_AUTHORITY_INVALID');
  const pair = readPairRecord(options.pairAuthority);
  const sourceGrant = inspectComparisonGrant(options.sourceComparisonGrant);
  const distilledGrant = inspectComparisonGrant(options.distilledComparisonGrant);
  if (!pair || !sourceGrant || !distilledGrant || sourceGrant === distilledGrant) {
    return failed('COMPARISON_AUTHORITY_INVALID');
  }
  const source = parseReceipt(options.sourceReceiptBytes);
  const distilled = parseReceipt(options.distilledReceiptBytes);
  if (!source || !distilled) return failed('RECEIPT_SCHEMA_INVALID');
  for (const receipt of [source, distilled]) {
    const validated = validateSemanticReplayReceipt(receipt);
    if (validated.ok !== true) return failed(validated.reason);
  }
  const sourceRecord = readReceiptAuthority(options.sourceReceiptAuthority);
  const distilledRecord = readReceiptAuthority(options.distilledReceiptAuthority);
  if (!sourceRecord || !distilledRecord || sourceRecord === distilledRecord) {
    return failed('RECEIPT_AUTHORITY_INVALID');
  }
  if (digestOf(options.sourceReceiptBytes) !== sourceRecord.receiptSha256
    || digestOf(options.distilledReceiptBytes) !== distilledRecord.receiptSha256) {
    return failed('RECEIPT_HASH_MISMATCH');
  }
  if (source.role !== 'source' || distilled.role !== 'distilled'
    || sourceRecord.role !== 'source' || distilledRecord.role !== 'distilled'
    || sourceRecord.pairRecord !== pair || distilledRecord.pairRecord !== pair
    || sourceGrant.record !== sourceRecord || distilledGrant.record !== distilledRecord
    || source.pairId !== pair.pairId || distilled.pairId !== pair.pairId) {
    return failed('ROLE_PAIR_INVALID');
  }
  // 到此为止都是 authority/pair 归属探针；确认同一 pair 后才消费两枚 one-shot grant。
  consumeGrantEntry(sourceGrant);
  consumeGrantEntry(distilledGrant);

  const roleBindings = [
    [source.binding, pair.sourceDigests],
    [distilled.binding, pair.distilledDigests],
  ];
  for (const [binding, digests] of roleBindings) {
    if (binding.candidateSha256 !== digests.candidateSha256
      || binding.eventsSha256 !== digests.eventsSha256
      || binding.entityLockSetSha256 !== digests.entityLockSetSha256) {
      return failed('ROLE_ARTIFACT_BINDING_MISMATCH');
    }
  }
  for (const key of COMMON_BINDING_KEYS) {
    if (source.binding[key] !== distilled.binding[key]
      || source.binding[key] !== pair.digests[key]) {
      return failed('COMMON_BINDING_MISMATCH');
    }
  }
  if (source.runNamespace === distilled.runNamespace) {
    return failed('RUN_NAMESPACE_COLLISION');
  }
  if (distilled.predecessorReceiptSha256 !== sourceRecord.receiptSha256) {
    return failed('PREDECESSOR_RECEIPT_MISMATCH');
  }
  if (source.freshness.resetReceiptSha256 === distilled.freshness.resetReceiptSha256) {
    return failed('RESET_RECEIPT_REUSED');
  }
  if (source.freshness.baselineProjectionSha256
    !== distilled.freshness.baselineProjectionSha256) {
    return failed('BASELINE_PROJECTION_MISMATCH');
  }
  if (source.binding.executionTargetAttestationSha256
    !== distilled.binding.executionTargetAttestationSha256
    || source.binding.executionTargetAttestationSha256
      !== pair.executionTargetAttestationSha256) {
    return failed('EXECUTION_TARGET_AUTHORITY_INVALID');
  }
  if (source.freshness.lifecycleAttestationSha256
    === distilled.freshness.lifecycleAttestationSha256) {
    return failed('REPLAY_RUNTIME_REUSED');
  }
  const semanticReason = compareSemantics(source, distilled);
  if (semanticReason) return failed(semanticReason);
  return frozen({
    ok: true,
    equivalent: true,
    promotionEligible: true,
    equivalenceReceipt: frozen({
      schemaVersion: 1,
      artifactKind: 'dual-replay-equivalence-receipt',
      pairId: pair.pairId,
      scope: 'read-only-v1',
      sourceReceiptSha256: sourceRecord.receiptSha256,
      distilledReceiptSha256: distilledRecord.receiptSha256,
      comparedDimensions: COMPARED_DIMENSIONS,
    }),
  });
}
