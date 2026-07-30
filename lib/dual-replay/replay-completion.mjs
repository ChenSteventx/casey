// staged completion：source 分两相（raw execute seal 与 resolved semantic completion），
// distilled 只走 formal atom 相。issuer 恰调用一次，缺/多字段、throw、malformed、换绑均 fail-closed。
// 纯核心：零 browser、零 fs、零 network、零 LLM；裁判由现役 frozen verdict 出，本模块不判四态。

import {
  denied, digestOf, exactKeys, frozen,
} from './source-plan-authority.mjs';
import { readRunRecord } from './run-authority.mjs';
import { projectSemanticEvidence } from './semantic-projection.mjs';
import { inspectCleanRawReplayAuthority } from '../teachin/raw-proof.mjs';
import { inspectRawEventObservationAuthority } from '../teachin/raw-event-observation.mjs';
import {
  consumeSourceSemanticGrant,
  inspectSourceSemanticGrant,
} from '../teachin/resolved-projection.mjs';
import {
  normalizeErrorName, safeEmit,
} from '../teachin/cycle-evidence-context.mjs';

const EXECUTION_STATE = new WeakMap();
const RAW_EXECUTION_STATE = new WeakMap();
const SOURCE_COMPLETION_STATE = new WeakMap();
const COMPLETION_STATE = new WeakMap();
const BASELINE_GRANT_STATE = new WeakMap();
const RESOLVED_PROJECTION_STATE = new WeakMap();

const RAW_RESULT_KEYS = [
  'ok', 'runExecutionAuthority', 'runtimeOwnerAuthority', 'rawObservationAuthority',
  'artifacts', 'rawReplay',
];
const ATOM_RESULT_KEYS = [
  'ok', 'runExecutionAuthority', 'runtimeOwnerAuthority', 'artifacts',
  'axesBytes', 'verdictBytes', 'evidence',
];
const ARTIFACT_KEYS = ['candidateBytes', 'eventsBytes', 'entityLockBytes'];
const SEMANTIC_RESULT_KEYS = [
  'ok', 'rawObservationAuthority', 'resolvedProjectionAuthority',
  'axesBytes', 'verdictBytes', 'evidence',
];

// 语义纵向失败返回闭合四键，绝不携带 evidence、异常原文或半成品 authority。
function closedFailure(reason) {
  return frozen({
    ok: false, equivalent: false, promotionEligible: false, reason,
  });
}

function usableIssuer(issuer, method) {
  return !!issuer && typeof issuer === 'object' && typeof issuer[method] === 'function';
}

const RAW_STAGE = 'source-raw-execute';
const RESOLVED_STAGE = 'source-resolved-completion';
const DISTILLED_STAGE = 'distilled-completion';

// 取证旁路：同码多分支各自通报归因，判定、键集与返回值一字不动。
function reportRefusal(refusalPoint, stage, reason) {
  safeEmit(refusalPoint, { stage, reason });
}

// 吞异常那一路的真因只经取证通道通报（仅归因与内建异常名，绝不带原文）：
// 通报同步写在原 catch 块内、随后原样 return 原拒付——不套任何包裹函数、不多一次 await，
// 于是异常栈帧数与微任务世代与取证边车落地之前逐轴全等（codex code-r1 M1）。

function artifactDigests(artifacts) {
  if (!exactKeys(artifacts, ARTIFACT_KEYS)) return null;
  for (const key of ARTIFACT_KEYS) if (!Buffer.isBuffer(artifacts[key])) return null;
  return {
    candidateSha256: digestOf(artifacts.candidateBytes),
    eventsSha256: digestOf(artifacts.eventsBytes),
    entityLockSetSha256: digestOf(artifacts.entityLockBytes),
  };
}

function artifactsAgree(digests, expected) {
  return digests.candidateSha256 === expected.candidateSha256
    && digests.eventsSha256 === expected.eventsSha256
    && digests.entityLockSetSha256 === expected.entityLockSetSha256;
}

function bindingOf(record, digests, axesBytes, verdictBytes) {
  const plan = record.planDigests;
  return {
    testcaseSha256: plan.testcaseSha256,
    expectedSha256: plan.expectedSha256,
    expectedObligationsSha256: plan.expectedObligationsSha256,
    candidateSha256: digests.candidateSha256,
    eventsSha256: digests.eventsSha256,
    axesSha256: digestOf(axesBytes),
    verdictSha256: digestOf(verdictBytes),
    entityLockSetSha256: digests.entityLockSetSha256,
    executionTargetAttestationSha256: record.executionTargetAttestationSha256,
    sutBuildDigest: plan.sutBuildDigest,
    channelProfileDigest: plan.channelProfileDigest,
    identityProfileDigest: plan.identityProfileDigest,
    replayKernelDigest: plan.replayKernelDigest,
    resetPlanDigest: plan.resetPlanDigest,
    sessionPolicyDigest: plan.sessionPolicyDigest,
  };
}

export async function executeAuthorizedSourceReplay({
  runAuthority, trustedRawReplayIssuer, ...extraInputs
}) {
  if (Object.keys(extraInputs).length > 0) {
    reportRefusal('source-completion.input-shape', RAW_STAGE, 'RUN_COMPLETION_INVALID');
    return denied('RUN_COMPLETION_INVALID');
  }
  const record = readRunRecord(runAuthority);
  if (!record || record.role !== 'source' || record.executed) {
    return denied('RUN_COMPLETION_AUTHORITY_INVALID');
  }
  if (!usableIssuer(trustedRawReplayIssuer, 'executeAndVerify')) {
    return denied('REPLAY_ISSUER_INVALID');
  }
  // run 是一次性 ratchet：真实执行发生前就落闸，失败不得换 issuer 重跑到 CLEAN。
  record.executed = true;
  const runExecutionAuthority = frozen(Object.create(null));
  EXECUTION_STATE.set(runExecutionAuthority, record);

  let result;
  try {
    result = await trustedRawReplayIssuer.executeAndVerify({ runExecutionAuthority });
  } catch (error) {
    safeEmit('source-completion.issuer-throw', {
      stage: RAW_STAGE,
      reason: 'RUN_COMPLETION_INVALID',
      errorName: normalizeErrorName(error),
    });
    return denied('RUN_COMPLETION_INVALID');
  }
  if (!exactKeys(result, RAW_RESULT_KEYS) || result.ok !== true) {
    reportRefusal('source-completion.result-shape', RAW_STAGE, 'RUN_COMPLETION_INVALID');
    return denied('RUN_COMPLETION_INVALID');
  }
  if (result.runExecutionAuthority !== runExecutionAuthority) {
    reportRefusal('source-completion.result-shape', RAW_STAGE, 'RUN_COMPLETION_BINDING_MISMATCH');
    return denied('RUN_COMPLETION_BINDING_MISMATCH');
  }
  const digests = artifactDigests(result.artifacts);
  if (!digests) {
    reportRefusal('source-completion.artifact', RAW_STAGE, 'RUN_COMPLETION_INVALID');
    return denied('RUN_COMPLETION_INVALID');
  }
  if (!exactKeys(result.rawReplay, ['status', 'cleanProofAuthority'])) {
    reportRefusal('source-completion.raw-status', RAW_STAGE, 'RUN_COMPLETION_INVALID');
    return denied('RUN_COMPLETION_INVALID');
  }
  if (result.rawReplay.status !== 'CLEAN') {
    reportRefusal('source-completion.raw-status', RAW_STAGE, 'RUN_COMPLETION_INVALID');
    return denied('RUN_COMPLETION_INVALID');
  }
  if (!artifactsAgree(digests, record.planDigests)) {
    reportRefusal('source-completion.artifact', RAW_STAGE, 'RUN_COMPLETION_BINDING_MISMATCH');
    return denied('RUN_COMPLETION_BINDING_MISMATCH');
  }
  if (result.runtimeOwnerAuthority !== record.runtimeOwnerAuthority) {
    reportRefusal('source-completion.result-shape', RAW_STAGE, 'RUN_COMPLETION_BINDING_MISMATCH');
    return denied('RUN_COMPLETION_BINDING_MISMATCH');
  }
  // CLEAN 只做非消费式验真；唯一 consumer 仍是 resolved projection。
  const proof = inspectCleanRawReplayAuthority({
    cleanProofAuthority: result.rawReplay.cleanProofAuthority,
  });
  if (proof?.ok !== true) {
    reportRefusal('source-completion.proof', RAW_STAGE, 'RUN_COMPLETION_INVALID');
    return denied('RUN_COMPLETION_INVALID');
  }
  if (proof.captureSha256 !== record.captureSha256) {
    reportRefusal('source-completion.proof', RAW_STAGE, 'RUN_COMPLETION_BINDING_MISMATCH');
    return denied('RUN_COMPLETION_BINDING_MISMATCH');
  }
  const observation = inspectRawEventObservationAuthority({
    rawObservationAuthority: result.rawObservationAuthority,
  });
  if (observation?.ok !== true) {
    reportRefusal('source-completion.observation', RAW_STAGE, 'RUN_COMPLETION_INVALID');
    return denied('RUN_COMPLETION_INVALID');
  }
  if (observation.captureSha256 !== record.captureSha256
    || observation.runExecutionAuthority !== runExecutionAuthority) {
    reportRefusal('source-completion.observation', RAW_STAGE, 'RUN_COMPLETION_BINDING_MISMATCH');
    return denied('RUN_COMPLETION_BINDING_MISMATCH');
  }

  const rawExecutionAuthority = frozen(Object.create(null));
  RAW_EXECUTION_STATE.set(rawExecutionAuthority, {
    record,
    digests,
    rawObservationAuthority: result.rawObservationAuthority,
    captureSha256: record.captureSha256,
    consumed: false,
  });
  return frozen({
    ok: true,
    rawExecutionAuthority,
    cleanProofAuthority: result.rawReplay.cleanProofAuthority,
    sourceRuntimeOwnerAuthority: record.runtimeOwnerAuthority,
  });
}

export async function completeResolvedSourceReplay({
  rawExecutionAuthority, sourceSemanticGrant, trustedResolvedSourceIssuer, ...extraInputs
}) {
  if (Object.keys(extraInputs).length > 0) {
    reportRefusal('resolved-completion.input-shape', RESOLVED_STAGE,
      'SOURCE_SEMANTIC_COMPLETION_INVALID');
    return denied('SOURCE_SEMANTIC_COMPLETION_INVALID');
  }
  const raw = rawExecutionAuthority && typeof rawExecutionAuthority === 'object'
    ? RAW_EXECUTION_STATE.get(rawExecutionAuthority) : null;
  if (!raw || raw.consumed) return denied('RAW_EXECUTION_AUTHORITY_INVALID');
  // grant 先非消费式验真并核 binding：cross-pair 探针不得吃掉任一方 genuine grant。
  const inspected = inspectSourceSemanticGrant(sourceSemanticGrant);
  if (!inspected) return denied('SOURCE_SEMANTIC_GRANT_INVALID');
  if (!usableIssuer(trustedResolvedSourceIssuer, 'projectAndVerify')) {
    return denied('REPLAY_ISSUER_INVALID');
  }
  if (inspected.captureSha256 !== raw.captureSha256
    || (inspected.caseId !== null && raw.record.caseId !== null
      && inspected.caseId !== raw.record.caseId)) {
    return denied('SOURCE_SEMANTIC_BINDING_MISMATCH');
  }
  const resolution = consumeSourceSemanticGrant(sourceSemanticGrant);
  if (!resolution) return denied('SOURCE_SEMANTIC_GRANT_INVALID');
  raw.consumed = true;

  const resolvedProjectionAuthority = frozen(Object.create(null));
  RESOLVED_PROJECTION_STATE.set(resolvedProjectionAuthority, {
    consumed: false,
    projection: frozen({
      caseId: resolution.caseId,
      captureSha256: resolution.captureSha256,
      expectedSha256: raw.record.planDigests.expectedSha256,
      resolved: resolution.resolved,
      pending: resolution.pending,
      structural: resolution.structural,
    }),
  });

  let result;
  try {
    result = await trustedResolvedSourceIssuer.projectAndVerify({
      rawObservationAuthority: raw.rawObservationAuthority,
      resolvedProjectionAuthority,
    });
  } catch (error) {
    safeEmit('resolved-completion.issuer-throw', {
      stage: RESOLVED_STAGE,
      reason: 'SOURCE_SEMANTIC_COMPLETION_INVALID',
      errorName: normalizeErrorName(error),
    });
    return denied('SOURCE_SEMANTIC_COMPLETION_INVALID');
  }
  if (!exactKeys(result, SEMANTIC_RESULT_KEYS) || result.ok !== true) {
    reportRefusal('resolved-completion.result-shape', RESOLVED_STAGE,
      'SOURCE_SEMANTIC_COMPLETION_INVALID');
    return denied('SOURCE_SEMANTIC_COMPLETION_INVALID');
  }
  if (result.rawObservationAuthority !== raw.rawObservationAuthority
    || result.resolvedProjectionAuthority !== resolvedProjectionAuthority) {
    reportRefusal('resolved-completion.result-shape', RESOLVED_STAGE,
      'SOURCE_SEMANTIC_BINDING_MISMATCH');
    return denied('SOURCE_SEMANTIC_BINDING_MISMATCH');
  }
  if (!Buffer.isBuffer(result.axesBytes) || !Buffer.isBuffer(result.verdictBytes)) {
    reportRefusal('resolved-completion.result-shape', RESOLVED_STAGE,
      'SOURCE_SEMANTIC_COMPLETION_INVALID');
    return denied('SOURCE_SEMANTIC_COMPLETION_INVALID');
  }
  const projected = projectSemanticEvidence(result.evidence, raw.record.expectedObligations);
  if (projected.ok !== true) return closedFailure(projected.reason);

  const completionAuthority = frozen(Object.create(null));
  SOURCE_COMPLETION_STATE.set(completionAuthority, {
    record: raw.record,
    binding: bindingOf(raw.record, raw.digests, result.axesBytes, result.verdictBytes),
    freshness: raw.record.freshness,
    projection: projected.projection,
    consumed: false,
  });
  const authoringBaselineGrant = frozen(Object.create(null));
  BASELINE_GRANT_STATE.set(authoringBaselineGrant, {
    consumed: false,
    pairId: raw.record.pairId,
    caseId: raw.record.caseId,
    baselineProjectionSha256: raw.record.freshness.baselineProjectionSha256,
    resetPlanDigest: raw.record.planDigests.resetPlanDigest,
    executionTargetAuthority: raw.record.executionTargetAuthority,
  });
  return frozen({ ok: true, completionAuthority, authoringBaselineGrant });
}

export async function completeAuthorizedReplay({
  runAuthority, trustedReplayIssuer, ...extraInputs
}) {
  if (Object.keys(extraInputs).length > 0) {
    reportRefusal('distilled-completion.input-shape', DISTILLED_STAGE, 'RUN_COMPLETION_INVALID');
    return denied('RUN_COMPLETION_INVALID');
  }
  const record = readRunRecord(runAuthority);
  if (!record || record.role !== 'distilled' || record.executed) {
    return denied('RUN_COMPLETION_AUTHORITY_INVALID');
  }
  if (!usableIssuer(trustedReplayIssuer, 'executeAndVerify')) {
    return denied('REPLAY_ISSUER_INVALID');
  }
  record.executed = true;
  const runExecutionAuthority = frozen(Object.create(null));
  EXECUTION_STATE.set(runExecutionAuthority, record);

  let result;
  try {
    result = await trustedReplayIssuer.executeAndVerify({ runExecutionAuthority });
  } catch (error) {
    safeEmit('distilled-completion.issuer-throw', {
      stage: DISTILLED_STAGE,
      reason: 'RUN_COMPLETION_INVALID',
      errorName: normalizeErrorName(error),
    });
    return denied('RUN_COMPLETION_INVALID');
  }
  if (!exactKeys(result, ATOM_RESULT_KEYS) || result.ok !== true) {
    reportRefusal('distilled-completion.result-shape', DISTILLED_STAGE, 'RUN_COMPLETION_INVALID');
    return denied('RUN_COMPLETION_INVALID');
  }
  if (result.runExecutionAuthority !== runExecutionAuthority) {
    reportRefusal('distilled-completion.result-shape', DISTILLED_STAGE,
      'RUN_COMPLETION_BINDING_MISMATCH');
    return denied('RUN_COMPLETION_BINDING_MISMATCH');
  }
  const digests = artifactDigests(result.artifacts);
  if (!digests) {
    reportRefusal('distilled-completion.artifact', DISTILLED_STAGE, 'RUN_COMPLETION_INVALID');
    return denied('RUN_COMPLETION_INVALID');
  }
  if (!Buffer.isBuffer(result.axesBytes) || !Buffer.isBuffer(result.verdictBytes)) {
    reportRefusal('distilled-completion.artifact', DISTILLED_STAGE, 'RUN_COMPLETION_INVALID');
    return denied('RUN_COMPLETION_INVALID');
  }
  if (!artifactsAgree(digests, record.roleDigests)) {
    reportRefusal('distilled-completion.artifact', DISTILLED_STAGE,
      'RUN_COMPLETION_BINDING_MISMATCH');
    return denied('RUN_COMPLETION_BINDING_MISMATCH');
  }
  if (result.runtimeOwnerAuthority !== record.runtimeOwnerAuthority) {
    reportRefusal('distilled-completion.result-shape', DISTILLED_STAGE,
      'RUN_COMPLETION_BINDING_MISMATCH');
    return denied('RUN_COMPLETION_BINDING_MISMATCH');
  }
  const projected = projectSemanticEvidence(result.evidence, record.expectedObligations);
  if (projected.ok !== true) return closedFailure(projected.reason);

  const completionAuthority = frozen(Object.create(null));
  COMPLETION_STATE.set(completionAuthority, {
    pairBound: true,
    pairRecord: record.pairRecord,
    pairId: record.pairId,
    role: 'distilled',
    runOrdinal: 2,
    runNamespace: record.runNamespace,
    predecessorReceiptSha256: record.sourceReceiptSha256,
    binding: bindingOf(record, digests, result.axesBytes, result.verdictBytes),
    freshness: record.freshness,
    projection: projected.projection,
  });
  return frozen({
    ok: true,
    completionAuthority,
    distilledRuntimeOwnerAuthority: record.runtimeOwnerAuthority,
  });
}

// 非消费式验真：只暴露 binding 元数据与 pending/resolved 计数，供 axes 适配器在双消费之前核绑定。
// 探针、错绑与 cross-pair 因此烧不掉 genuine one-shot projection。
export function inspectResolvedProjectionAuthority(options = {}) {
  const authority = options?.resolvedProjectionAuthority;
  const entry = authority && typeof authority === 'object'
    ? RESOLVED_PROJECTION_STATE.get(authority) : null;
  if (!entry || entry.consumed) return denied('RESOLVED_PROJECTION_AUTHORITY_INVALID');
  const projection = entry.projection;
  return frozen({
    ok: true,
    caseId: projection.caseId,
    captureSha256: projection.captureSha256,
    expectedSha256: projection.expectedSha256,
    pendingCount: Array.isArray(projection.pending) ? projection.pending.length : -1,
    resolvedCount: Array.isArray(projection.resolved) ? projection.resolved.length : -1,
  });
}

// canonical raw axes consumer 的唯一入口：一次性读取 authority 绑定的 resolved projection。
export function consumeResolvedProjectionAuthority(options = {}) {
  const authority = options?.resolvedProjectionAuthority;
  const entry = authority && typeof authority === 'object'
    ? RESOLVED_PROJECTION_STATE.get(authority) : null;
  if (!entry || entry.consumed) return denied('RESOLVED_PROJECTION_AUTHORITY_INVALID');
  entry.consumed = true;
  return frozen({ ok: true, projection: entry.projection });
}

// canonical issuer 的唯一执行面：只有拿到 opaque runExecutionAuthority 才能取用
// 本次 run 已绑定的 runtime capability 与 exact artifacts；调用方无从自造。
// 一次性开箱：同一 runExecutionAuthority 只允许开一次 runtime 三件套与 artifacts。
// authority 万一外泄，第二次开箱固定返回 null，拿不到 fresh/topology/owner capability。
const OPENED_EXECUTIONS = new WeakSet();

export function openRunExecution(runExecutionAuthority) {
  const record = runExecutionAuthority && typeof runExecutionAuthority === 'object'
    ? EXECUTION_STATE.get(runExecutionAuthority) : null;
  if (!record) return null;
  if (OPENED_EXECUTIONS.has(runExecutionAuthority)) return null;
  OPENED_EXECUTIONS.add(runExecutionAuthority);
  return frozen({
    role: record.role,
    runNamespace: record.runNamespace,
    caseId: record.caseId,
    captureAuthority: record.captureAuthority,
    expectedBytes: Buffer.from(record.expectedBytes),
    artifacts: frozen({
      candidateBytes: Buffer.from(record.artifactBytes.candidateBytes),
      eventsBytes: Buffer.from(record.artifactBytes.eventsBytes),
      entityLockBytes: Buffer.from(record.artifactBytes.entityLockBytes),
    }),
    freshRuntimeAuthority: record.freshRuntimeAuthority,
    topologyAuthority: record.topologyAuthority,
    runtimeOwnerAuthority: record.runtimeOwnerAuthority,
    executionTargetAuthority: record.executionTargetAuthority,
    entityLockHandle: record.entityLockHandle || null,
  });
}

export function readSourceCompletionRecord(authority) {
  if (!authority || typeof authority !== 'object') return null;
  const record = SOURCE_COMPLETION_STATE.get(authority);
  return record && !record.consumed ? record : null;
}

export function consumeSourceCompletionRecord(authority) {
  const record = readSourceCompletionRecord(authority);
  if (!record) return null;
  record.consumed = true;
  return record;
}

// pair finalization 之后才允许把 source completion 变成可投影 receipt 的 pair-bound capability。
export function sealPairBoundSourceCompletion(record) {
  const authority = frozen(Object.create(null));
  COMPLETION_STATE.set(authority, record);
  return authority;
}

export function readCompletionRecord(authority) {
  if (!authority || typeof authority !== 'object') return null;
  const record = COMPLETION_STATE.get(authority);
  return record && record.consumed !== true ? record : null;
}

export function consumeCompletionRecord(authority) {
  const record = readCompletionRecord(authority);
  if (!record) return null;
  record.consumed = true;
  return record;
}

export function inspectAuthoringBaselineGrant(grant) {
  const entry = grant && typeof grant === 'object' ? BASELINE_GRANT_STATE.get(grant) : null;
  return entry && !entry.consumed ? entry : null;
}

export function consumeAuthoringBaselineGrant(grant) {
  const entry = inspectAuthoringBaselineGrant(grant);
  if (!entry) return null;
  entry.consumed = true;
  return entry;
}
