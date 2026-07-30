// reset authority、role 一次性授权与 predecessor continuity。
// reset 事实只认 trustedResetIssuer 返回的闭合 receipt；caller 直传 facts 一律无权。
// authorize 只把 fresh/topology/owner 封入私有 run record，不消费 fresh（唯一消费点在 canonical issuer）。
// 纯核心：零 browser、零 fs、零 network、零 LLM。

import {
  denied, digestOf, exactKeys, frozen, isDigest, readSourcePlan,
} from './source-plan-authority.mjs';
import { readPairRecord } from './pair-authority.mjs';
import {
  consumeGrantEntry, inspectPredecessorGrant, readReceiptAuthority,
} from './receipt-shape.mjs';

const RESET_STATE = new WeakMap();
const RUN_STATE = new WeakMap();

const RESET_KEYS = ['replayPlanAuthority', 'role', 'runNamespace', 'trustedResetIssuer'];
const RESET_FACT_KEYS = ['resetReceiptBytes', 'resetPlanDigest', 'baselineProjectionSha256'];
const RESET_RECEIPT_KEYS = [
  'schemaVersion', 'artifactKind', 'pairId', 'role', 'runNamespace',
  'receiptInstanceId', 'resetPlanDigest', 'baselineProjectionSha256',
];
const ROLES = ['source', 'distilled'];

function planRecordOf(replayPlanAuthority) {
  return readSourcePlan(replayPlanAuthority) || readPairRecord(replayPlanAuthority);
}

function parseResetReceipt(bytes) {
  if (!Buffer.isBuffer(bytes)) return null;
  let document;
  try {
    document = JSON.parse(bytes.toString('utf8'));
  } catch {
    return null;
  }
  if (!exactKeys(document, RESET_RECEIPT_KEYS)) return null;
  if (document.schemaVersion !== 1) return null;
  if (document.artifactKind !== 'dual-replay-reset-receipt') return null;
  if (typeof document.pairId !== 'string' || typeof document.role !== 'string') return null;
  if (typeof document.runNamespace !== 'string') return null;
  if (typeof document.receiptInstanceId !== 'string' || !document.receiptInstanceId) return null;
  if (!isDigest(document.resetPlanDigest)) return null;
  if (!isDigest(document.baselineProjectionSha256)) return null;
  return document;
}

// reset 事实的唯一来源：issuer 返回的闭合对象。抛错、非闭合形态一律等同无权，
// 调用方直传的 receipt/digest/baseline 永远不参与。
function verifiedResetFacts(trustedResetIssuer, replayPlanAuthority, role, runNamespace) {
  try {
    const facts = trustedResetIssuer.verifyReset({ replayPlanAuthority, role, runNamespace });
    return exactKeys(facts, RESET_FACT_KEYS) ? facts : null;
  } catch {
    return null;
  }
}

// canonical reset issuer 的最小事实面：只投影「本 pair 的身份、要复现的 reset 计划摘要与
// 目标 capability」，不外露 bytes、baseline、capture 或已用 instance 账本。
// 它不是 reset 事实本身——baseline 仍必须来自 issuer 对活 runtime 的观察。
export function projectResetPlanFacts(replayPlanAuthority) {
  const plan = planRecordOf(replayPlanAuthority);
  if (!plan) return null;
  return frozen({
    ok: true,
    pairId: plan.pairId,
    resetPlanDigest: plan.digests.resetPlanDigest,
    executionTargetAuthority: plan.executionTargetAuthority,
  });
}

export function createResetAuthority({
  replayPlanAuthority, role, runNamespace, trustedResetIssuer, ...extraInputs
}) {
  if (Object.keys(extraInputs).length > 0) return denied('RESET_AUTHORITY_INVALID');
  const plan = planRecordOf(replayPlanAuthority);
  if (!plan) return denied('RESET_AUTHORITY_INVALID');
  if (!ROLES.includes(role)) return denied('RESET_AUTHORITY_INVALID');
  if (typeof runNamespace !== 'string' || !runNamespace) return denied('RESET_AUTHORITY_INVALID');
  if (!trustedResetIssuer || typeof trustedResetIssuer !== 'object'
    || typeof trustedResetIssuer.verifyReset !== 'function') {
    return denied('RESET_AUTHORITY_INVALID');
  }
  const facts = verifiedResetFacts(
    trustedResetIssuer, replayPlanAuthority, role, runNamespace,
  );
  if (!facts) return denied('RESET_AUTHORITY_INVALID');
  const receipt = parseResetReceipt(facts.resetReceiptBytes);
  if (!receipt) return denied('RESET_AUTHORITY_INVALID');
  if (receipt.pairId !== plan.pairId || receipt.role !== role) {
    return denied('RESET_AUTHORITY_INVALID');
  }
  if (receipt.runNamespace !== runNamespace) return denied('RESET_AUTHORITY_INVALID');
  if (receipt.resetPlanDigest !== facts.resetPlanDigest) {
    return denied('RESET_AUTHORITY_INVALID');
  }
  if (receipt.baselineProjectionSha256 !== facts.baselineProjectionSha256) {
    return denied('RESET_AUTHORITY_INVALID');
  }
  if (receipt.resetPlanDigest !== plan.digests.resetPlanDigest) {
    return denied('RESET_AUTHORITY_INVALID');
  }
  if (plan.usedResetInstances.has(receipt.receiptInstanceId)) {
    return denied('RESET_RECEIPT_REUSED');
  }
  // baseline 由 source 首次 live reset 确定；distilled 必须复现同一 baseline。
  if (plan.baselineProjectionSha256 !== null
    && plan.baselineProjectionSha256 !== receipt.baselineProjectionSha256) {
    return denied('BASELINE_PROJECTION_MISMATCH');
  }
  plan.usedResetInstances.add(receipt.receiptInstanceId);
  if (plan.baselineProjectionSha256 === null) {
    plan.baselineProjectionSha256 = receipt.baselineProjectionSha256;
  }
  const authority = frozen(Object.create(null));
  RESET_STATE.set(authority, {
    plan,
    role,
    runNamespace,
    instanceId: receipt.receiptInstanceId,
    receiptSha256: digestOf(facts.resetReceiptBytes),
    baselineProjectionSha256: receipt.baselineProjectionSha256,
    consumed: false,
  });
  return frozen({ ok: true, authority });
}

function usableCapability(value) {
  return !!value && typeof value === 'object';
}

function resetRecordOf(resetAuthority, plan, role, runNamespace) {
  const record = usableCapability(resetAuthority) ? RESET_STATE.get(resetAuthority) : null;
  if (!record || record.consumed) return null;
  if (record.plan !== plan || record.role !== role) return null;
  return record.runNamespace === runNamespace ? record : null;
}

function lifecycleAttestation(plan, role, runNamespace, resetRecord) {
  return digestOf([
    'dual-replay-lifecycle', plan.pairId, role, runNamespace, resetRecord.instanceId,
  ].join('|'));
}

export function authorizeSourceReplay({
  sourcePlanAuthority, role, runNamespace, resetAuthority, freshRuntimeAuthority,
  topologyAuthority, runtimeOwnerAuthority, executionTargetAuthority, ...extraInputs
}) {
  if (Object.keys(extraInputs).length > 0) {
    return denied('SOURCE_REPLAY_PLAN_AUTHORITY_INVALID');
  }
  const plan = readSourcePlan(sourcePlanAuthority);
  if (!plan) return denied('SOURCE_REPLAY_PLAN_AUTHORITY_INVALID');
  if (role !== 'source') return denied('ROLE_PAIR_INVALID');
  if (runNamespace !== plan.runNamespace) return denied('RUN_NAMESPACE_COLLISION');
  if (plan.roles.source) return denied('RUN_ROLE_ALREADY_AUTHORIZED');
  if (executionTargetAuthority !== plan.executionTargetAuthority) {
    return denied('EXECUTION_TARGET_AUTHORITY_INVALID');
  }
  const reset = resetRecordOf(resetAuthority, plan, 'source', runNamespace);
  if (!reset) return denied('RESET_AUTHORITY_INVALID');
  if (!usableCapability(freshRuntimeAuthority) || !usableCapability(topologyAuthority)) {
    return denied('FRESH_RUNTIME_AUTHORITY_INVALID');
  }
  if (!usableCapability(runtimeOwnerAuthority)) {
    return denied('REPLAY_RUNTIME_OWNERSHIP_MISMATCH');
  }
  reset.consumed = true;
  plan.roles.source = true;
  const authority = frozen(Object.create(null));
  const record = {
    role: 'source',
    runNamespace,
    pairId: plan.pairId,
    caseId: plan.caseId,
    captureSha256: plan.captureSha256,
    planRecord: plan,
    pairRecord: plan,
    planDigests: plan.digests,
    roleDigests: plan.digests,
    captureAuthority: plan.captureAuthority,
    expectedBytes: plan.bytes.expectedBytes,
    artifactBytes: frozen({
      candidateBytes: plan.bytes.candidateBytes,
      eventsBytes: plan.bytes.eventsBytes,
      entityLockBytes: plan.bytes.entityLockBytes,
    }),
    expectedObligations: plan.expectedObligations,
    executionTargetAuthority: plan.executionTargetAuthority,
    executionTargetAttestationSha256: plan.executionTargetAttestationSha256,
    freshRuntimeAuthority,
    topologyAuthority,
    runtimeOwnerAuthority,
    freshness: frozen({
      resetReceiptSha256: reset.receiptSha256,
      baselineProjectionSha256: reset.baselineProjectionSha256,
      lifecycleAttestationSha256: lifecycleAttestation(plan, 'source', runNamespace, reset),
    }),
    sourceReceiptSha256: null,
    resetInstanceId: reset.instanceId,
    executed: false,
  };
  RUN_STATE.set(authority, record);
  plan.sourceRunRecord = record;
  return frozen({ ok: true, authority });
}

export function authorizeDistilledReplay({
  pairAuthority, role, runNamespace, sourceReceiptBytes, sourceReceiptAuthority,
  predecessorGrant, resetAuthority, freshRuntimeAuthority, topologyAuthority,
  runtimeOwnerAuthority, executionTargetAuthority, ...extraInputs
}) {
  if (Object.keys(extraInputs).length > 0) {
    return denied('SOURCE_REPLAY_PLAN_AUTHORITY_INVALID');
  }
  const pair = readPairRecord(pairAuthority);
  if (!pair) return denied('SOURCE_REPLAY_PLAN_AUTHORITY_INVALID');
  if (role !== 'distilled') return denied('ROLE_PAIR_INVALID');
  if (typeof runNamespace !== 'string' || !runNamespace
    || runNamespace === pair.runNamespace) {
    return denied('RUN_NAMESPACE_COLLISION');
  }
  if (pair.roles.distilled) return denied('RUN_ROLE_ALREADY_AUTHORIZED');
  const receipt = readReceiptAuthority(sourceReceiptAuthority);
  if (!receipt || receipt.role !== 'source' || receipt.pairRecord !== pair) {
    return denied('RECEIPT_AUTHORITY_INVALID');
  }
  if (!Buffer.isBuffer(sourceReceiptBytes)
    || digestOf(sourceReceiptBytes) !== receipt.receiptSha256) {
    return denied('RECEIPT_HASH_MISMATCH');
  }
  const grantEntry = inspectPredecessorGrant(predecessorGrant);
  if (!grantEntry || grantEntry.record !== receipt) {
    return denied('RECEIPT_AUTHORITY_INVALID');
  }
  if (executionTargetAuthority !== pair.executionTargetAuthority) {
    return denied('EXECUTION_TARGET_AUTHORITY_INVALID');
  }
  const reset = resetRecordOf(resetAuthority, pair, 'distilled', runNamespace);
  if (!reset) return denied('RESET_AUTHORITY_INVALID');
  const sourceRun = pair.sourceRunRecord;
  if (!sourceRun || reset.instanceId === sourceRun.resetInstanceId) {
    return denied('RESET_RECEIPT_REUSED');
  }
  if (!usableCapability(freshRuntimeAuthority) || !usableCapability(topologyAuthority)) {
    return denied('FRESH_RUNTIME_AUTHORITY_INVALID');
  }
  if (!usableCapability(runtimeOwnerAuthority)) {
    return denied('REPLAY_RUNTIME_OWNERSHIP_MISMATCH');
  }
  // 两次 evidence replay 必须是彼此独立的 fresh runtime，不许换名复用同一套 capability。
  if (freshRuntimeAuthority === sourceRun.freshRuntimeAuthority
    || topologyAuthority === sourceRun.topologyAuthority
    || runtimeOwnerAuthority === sourceRun.runtimeOwnerAuthority) {
    return denied('REPLAY_RUNTIME_REUSED');
  }
  consumeGrantEntry(grantEntry);
  reset.consumed = true;
  pair.roles.distilled = true;
  const authority = frozen(Object.create(null));
  RUN_STATE.set(authority, {
    role: 'distilled',
    runNamespace,
    pairId: pair.pairId,
    caseId: pair.caseId,
    captureSha256: pair.captureSha256,
    planRecord: pair,
    pairRecord: pair,
    planDigests: pair.digests,
    roleDigests: pair.distilledDigests,
    captureAuthority: null,
    expectedBytes: pair.bytes.expectedBytes,
    artifactBytes: frozen({
      candidateBytes: pair.distilledBytes.candidateBytes,
      eventsBytes: pair.distilledBytes.eventsBytes,
      entityLockBytes: pair.bytes.entityLockBytes,
    }),
    expectedObligations: pair.expectedObligations,
    executionTargetAuthority: pair.executionTargetAuthority,
    executionTargetAttestationSha256: pair.executionTargetAttestationSha256,
    entityLockHandle: pair.entityLockHandle,
    freshRuntimeAuthority,
    topologyAuthority,
    runtimeOwnerAuthority,
    freshness: frozen({
      resetReceiptSha256: reset.receiptSha256,
      baselineProjectionSha256: reset.baselineProjectionSha256,
      lifecycleAttestationSha256: lifecycleAttestation(pair, 'distilled', runNamespace, reset),
    }),
    sourceReceiptSha256: receipt.receiptSha256,
    resetInstanceId: reset.instanceId,
    executed: false,
  });
  return frozen({ ok: true, authority });
}

export function readRunRecord(authority) {
  if (!authority || typeof authority !== 'object') return null;
  return RUN_STATE.get(authority) || null;
}
