// distilled candidate 的内部 seal 与 immutable pair finalization ratchet。
// sealer 不从 public façade 导出：只有 runtime-cycle adapter 在真跑完 atom roundtrip、
// 验证 lineage/topology parity 与 canonical entity 授权后才能调用。
// 纯核心：零 browser、零 fs、零 network、零 LLM。

import {
  denied, digestOf, exactKeys, frozen, isDigest, readSourcePlan,
} from './source-plan-authority.mjs';
import {
  consumeSourceCompletionRecord,
  readSourceCompletionRecord,
  sealPairBoundSourceCompletion,
} from './replay-completion.mjs';
import { consumeVerifiedEntityLockVerification } from './entity-lock-handle.mjs';

const CANDIDATE_STATE = new WeakMap();
const PAIR_STATE = new WeakMap();

const CANDIDATE_KEYS = ['caseId', 'candidateBytes', 'eventsBytes'];

// exact 输入、exact 输出：不接 caller 自由 bytes，也不回显任何候选内容。
// verifier 私有 handle 必须在同一 authoring closure、同一 case/events/digest 上一次性复核成功，
// 只有 composer 在真跑完 roundtrip 与 entity 授权后才拿得到这枚 handle。
export function sealDistilledCandidateAuthority({
  roundtripCandidate, authoringClosureAuthority, verifiedEntityLockHandle,
  verifiedEntityLockSetSha256, executionTargetAuthority,
}) {
  const candidate = roundtripCandidate;
  if (!exactKeys(candidate, CANDIDATE_KEYS)) return denied('DISTILLED_CANDIDATE_SEAL_INVALID');
  if (typeof candidate.caseId !== 'string' || !candidate.caseId) {
    return denied('DISTILLED_CANDIDATE_SEAL_INVALID');
  }
  if (!Buffer.isBuffer(candidate.candidateBytes) || !Buffer.isBuffer(candidate.eventsBytes)) {
    return denied('DISTILLED_CANDIDATE_SEAL_INVALID');
  }
  if (!isDigest(verifiedEntityLockSetSha256)) {
    return denied('DISTILLED_CANDIDATE_SEAL_INVALID');
  }
  if (!authoringClosureAuthority || typeof authoringClosureAuthority !== 'object') {
    return denied('DISTILLED_CANDIDATE_SEAL_INVALID');
  }
  if (!executionTargetAuthority || typeof executionTargetAuthority !== 'object') {
    return denied('DISTILLED_CANDIDATE_SEAL_INVALID');
  }
  const verification = consumeVerifiedEntityLockVerification({
    handle: verifiedEntityLockHandle,
    verificationScopeAuthority: authoringClosureAuthority,
    caseId: candidate.caseId,
    eventsBytes: candidate.eventsBytes,
    setSha256: verifiedEntityLockSetSha256,
  });
  if (verification?.ok !== true) return denied('ENTITY_LOCK_AUTHORITY_INVALID');
  const distilledCandidateAuthority = frozen(Object.create(null));
  CANDIDATE_STATE.set(distilledCandidateAuthority, {
    caseId: candidate.caseId,
    bytes: frozen({
      candidateBytes: Buffer.from(candidate.candidateBytes),
      eventsBytes: Buffer.from(candidate.eventsBytes),
    }),
    digests: frozen({
      candidateSha256: digestOf(candidate.candidateBytes),
      eventsSha256: digestOf(candidate.eventsBytes),
      entityLockSetSha256: verifiedEntityLockSetSha256,
    }),
    authoringClosureAuthority,
    entityLockHandle: verification.runtimeEntityLockHandle,
    executionTargetAuthority,
    consumed: false,
  });
  return frozen({ ok: true, distilledCandidateAuthority });
}

export function finalizeDualReplayPlanAuthority({
  sourcePlanAuthority, sourceCompletionAuthority, distilledCandidateAuthority,
}) {
  const plan = readSourcePlan(sourcePlanAuthority);
  if (!plan || plan.finalized) return denied('SOURCE_REPLAY_PLAN_AUTHORITY_INVALID');
  const completion = readSourceCompletionRecord(sourceCompletionAuthority);
  if (!completion || completion.record.planRecord !== plan) {
    return denied('RUN_COMPLETION_AUTHORITY_INVALID');
  }
  const candidate = distilledCandidateAuthority && typeof distilledCandidateAuthority === 'object'
    ? CANDIDATE_STATE.get(distilledCandidateAuthority) : null;
  if (!candidate || candidate.consumed) return denied('DISTILLED_CANDIDATE_AUTHORITY_INVALID');
  if (candidate.caseId !== plan.caseId
    || candidate.executionTargetAuthority !== plan.executionTargetAuthority
    || candidate.digests.entityLockSetSha256 !== plan.digests.entityLockSetSha256) {
    return denied('PAIR_FINALIZATION_BINDING_MISMATCH');
  }

  candidate.consumed = true;
  consumeSourceCompletionRecord(sourceCompletionAuthority);
  plan.finalized = true;
  const pairAuthority = frozen(Object.create(null));
  const pair = {
    kind: 'pair',
    pairId: plan.pairId,
    caseId: plan.caseId,
    captureSha256: plan.captureSha256,
    runNamespace: plan.runNamespace,
    digests: plan.digests,
    sourceDigests: plan.digests,
    distilledDigests: candidate.digests,
    bytes: plan.bytes,
    distilledBytes: candidate.bytes,
    expectedObligations: plan.expectedObligations,
    executionTargetAuthority: plan.executionTargetAuthority,
    executionTargetAttestationSha256: plan.executionTargetAttestationSha256,
    baselineProjectionSha256: plan.baselineProjectionSha256,
    sourceRunRecord: plan.sourceRunRecord,
    entityLockHandle: candidate.entityLockHandle,
    usedResetInstances: plan.usedResetInstances,
    roles: { distilled: false },
  };
  PAIR_STATE.set(pairAuthority, pair);
  const pairBoundSourceCompletionAuthority = sealPairBoundSourceCompletion({
    pairBound: true,
    pairRecord: pair,
    pairId: pair.pairId,
    role: 'source',
    runOrdinal: 1,
    runNamespace: completion.record.runNamespace,
    predecessorReceiptSha256: null,
    binding: completion.binding,
    freshness: completion.freshness,
    projection: completion.projection,
  });
  return frozen({
    ok: true,
    pairAuthority,
    pairBoundSourceCompletionAuthority,
    receipt: frozen({
      schemaVersion: 1,
      artifactKind: 'dual-replay-pair',
      pairId: pair.pairId,
      sourceCandidateSha256: plan.digests.candidateSha256,
      distilledCandidateSha256: candidate.digests.candidateSha256,
      distilledEventsSha256: candidate.digests.eventsSha256,
    }),
  });
}

export function readPairRecord(authority) {
  if (!authority || typeof authority !== 'object') return null;
  return PAIR_STATE.get(authority) || null;
}
