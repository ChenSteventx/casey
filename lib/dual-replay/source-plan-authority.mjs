// source replay plan authority：只冻结 source 执行前已知的真值。
// 入口立即复制 bytes、规范化 obligations 并计算 digest；调用方后改对象无效。
// 纯核心：零 browser、零 fs、零 network、零 LLM（护栏 #15）。

import { createHash } from 'node:crypto';
import { inspectAdmittedRawReplayCapture } from '../teachin/raw-capture.mjs';
import { readExecutionTargetAuthority } from '../execution-target/authority.mjs';

const PLAN_STATE = new WeakMap();

const PLAN_KEYS = [
  'pairId', 'testcaseBytes', 'expectedBytes', 'expectedObligations',
  'sutBuildDigest', 'channelProfileDigest', 'identityProfileDigest',
  'replayKernelDigest', 'resetPlanDigest', 'sessionPolicyDigest',
  'executionTargetAuthority', 'source',
];
const PROFILE_PLAN_KEYS = [...PLAN_KEYS, 'channelProfileBytes'];
const SOURCE_KEYS = [
  'captureAuthority', 'candidateBytes', 'eventsBytes', 'entityLockBytes', 'runNamespace',
];
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const VERDICTS = ['PASS', 'SUT_DEFECT', 'HARNESS_ERROR', 'NEEDS_HUMAN'];
const NEEDS_HUMAN_REASONS = [
  'SUT_DEFECT_OR_STALE', 'CASE_DEFECT', 'AMBIGUOUS_ACTION',
  'AFFORDANCE_ABSENT', 'INDETERMINATE',
];

export function frozen(value) {
  return Object.freeze(value);
}

export function denied(reason) {
  return frozen({ ok: false, reason });
}

export function digestOf(value) {
  const input = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8');
  return `sha256:${createHash('sha256').update(input).digest('hex')}`;
}

export function isDigest(value) {
  return typeof value === 'string' && DIGEST_PATTERN.test(value);
}

export function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.keys(value).sort().join(' ') === [...expected].sort().join(' ');
}

export function copyBytes(value) {
  return Buffer.isBuffer(value) ? Buffer.from(value) : null;
}

export function verdictShapeOk(verdict, reason) {
  if (!VERDICTS.includes(verdict)) return false;
  if (verdict === 'NEEDS_HUMAN') return NEEDS_HUMAN_REASONS.includes(reason);
  return reason === null;
}

// obligations 是签署 expected 的纵向义务快照，必须闭合到已冻结形状。
function normalizeObligations(value) {
  if (!exactKeys(value, [
    'intents', 'terminalHardPredicates', 'topology', 'entities', 'effects', 'cleanup',
  ])) return null;
  const intents = value.intents;
  if (!Array.isArray(intents) || intents.length === 0) return null;
  const seen = new Set();
  for (const intentId of intents) {
    if (typeof intentId !== 'string' || !intentId || seen.has(intentId)) return null;
    seen.add(intentId);
  }
  const predicates = [];
  if (!Array.isArray(value.terminalHardPredicates)) return null;
  for (const row of value.terminalHardPredicates) {
    if (!exactKeys(row, ['intentId', 'predicateSha256'])) return null;
    if (!seen.has(row.intentId) || !isDigest(row.predicateSha256)) return null;
    predicates.push({ intentId: row.intentId, predicateSha256: row.predicateSha256 });
  }
  const topology = [];
  if (!Array.isArray(value.topology)) return null;
  for (const row of value.topology) {
    if (!exactKeys(row, ['intentId', 'ordinal', 'kind', 'routeProjectionSha256'])) return null;
    if (!seen.has(row.intentId) || !Number.isSafeInteger(row.ordinal) || row.ordinal < 0) {
      return null;
    }
    if (typeof row.kind !== 'string' || !row.kind) return null;
    if (!isDigest(row.routeProjectionSha256)) return null;
    topology.push({
      intentId: row.intentId,
      ordinal: row.ordinal,
      kind: row.kind,
      routeProjectionSha256: row.routeProjectionSha256,
    });
  }
  const entities = [];
  if (!Array.isArray(value.entities)) return null;
  for (const row of value.entities) {
    if (!exactKeys(row, ['intentId', 'role', 'kind', 'identitySha256'])) return null;
    if (!seen.has(row.intentId) || typeof row.role !== 'string' || !row.role) return null;
    if (typeof row.kind !== 'string' || !row.kind) return null;
    if (!isDigest(row.identitySha256)) return null;
    entities.push({
      intentId: row.intentId,
      role: row.role,
      kind: row.kind,
      identitySha256: row.identitySha256,
    });
  }
  const effects = [];
  if (!Array.isArray(value.effects)) return null;
  for (const row of value.effects) {
    if (!exactKeys(row, ['intentId', 'effectClass', 'evidenceRefs', 'projectionSha256'])) {
      return null;
    }
    if (!seen.has(row.intentId) || typeof row.effectClass !== 'string') return null;
    if (!Array.isArray(row.evidenceRefs) || !isDigest(row.projectionSha256)) return null;
    const refs = [];
    for (const ref of row.evidenceRefs) {
      if (typeof ref !== 'string' || !ref || refs.includes(ref)) return null;
      refs.push(ref);
    }
    effects.push({
      intentId: row.intentId,
      effectClass: row.effectClass,
      evidenceRefs: refs,
      projectionSha256: row.projectionSha256,
    });
  }
  const cleanup = value.cleanup;
  if (!exactKeys(cleanup, ['required', 'status', 'policySha256'])) return null;
  if (typeof cleanup.required !== 'boolean' || typeof cleanup.status !== 'string') return null;
  if (!isDigest(cleanup.policySha256)) return null;
  return {
    intents: [...intents],
    terminalHardPredicates: predicates,
    topology,
    entities,
    effects,
    cleanup: {
      required: cleanup.required,
      status: cleanup.status,
      policySha256: cleanup.policySha256,
    },
  };
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

// execution target attestation 只用现役 authority 的公开 receipt 投影，不含 URL/transport 端点。
export function executionTargetAttestation(executionTargetAuthority) {
  const record = readExecutionTargetAuthority(executionTargetAuthority);
  if (!record || !record.receipt) return null;
  const receipt = record.receipt;
  return digestOf(JSON.stringify({
    schemaVersion: receipt.schemaVersion,
    runtimeClass: receipt.runtimeClass,
    transportMode: receipt.transportMode,
    originContinuity: receipt.originContinuity,
    fragmentPolicy: receipt.fragmentPolicy,
  }));
}

export function createSourceReplayPlanAuthority(input) {
  if (!exactKeys(input, PLAN_KEYS) && !exactKeys(input, PROFILE_PLAN_KEYS)) {
    return denied('SOURCE_REPLAY_PLAN_AUTHORITY_INVALID');
  }
  const source = input.source;
  if (!exactKeys(source, SOURCE_KEYS)) return denied('SOURCE_REPLAY_PLAN_AUTHORITY_INVALID');
  if (typeof input.pairId !== 'string' || !input.pairId) {
    return denied('SOURCE_REPLAY_PLAN_AUTHORITY_INVALID');
  }
  if (typeof source.runNamespace !== 'string' || !source.runNamespace) {
    return denied('SOURCE_REPLAY_PLAN_AUTHORITY_INVALID');
  }
  for (const name of [
    'sutBuildDigest', 'channelProfileDigest', 'identityProfileDigest',
    'replayKernelDigest', 'resetPlanDigest', 'sessionPolicyDigest',
  ]) {
    if (!isDigest(input[name])) return denied('SOURCE_REPLAY_PLAN_AUTHORITY_INVALID');
  }
  const testcaseBytes = copyBytes(input.testcaseBytes);
  const expectedBytes = copyBytes(input.expectedBytes);
  const candidateBytes = copyBytes(source.candidateBytes);
  const eventsBytes = copyBytes(source.eventsBytes);
  const entityLockBytes = copyBytes(source.entityLockBytes);
  if (!testcaseBytes || !expectedBytes || !candidateBytes || !eventsBytes || !entityLockBytes) {
    return denied('SOURCE_REPLAY_PLAN_AUTHORITY_INVALID');
  }
  // same-capture 路径只认与冻结摘要逐字节一致的 exact profile。legacy 没有 bytes
  // 时保留原行为；一旦声明 bytes，空值/摘要不符都在 source 动作前拒绝。
  const channelProfileBytes = Object.hasOwn(input, 'channelProfileBytes')
    ? copyBytes(input.channelProfileBytes)
    : null;
  if (Object.hasOwn(input, 'channelProfileBytes')
    && (!channelProfileBytes || channelProfileBytes.length === 0
      || digestOf(channelProfileBytes) !== input.channelProfileDigest)) {
    return denied('SOURCE_REPLAY_PLAN_AUTHORITY_INVALID');
  }
  const obligations = normalizeObligations(input.expectedObligations);
  if (!obligations) return denied('SOURCE_REPLAY_PLAN_AUTHORITY_INVALID');

  const attestation = executionTargetAttestation(input.executionTargetAuthority);
  if (!attestation) return denied('EXECUTION_TARGET_AUTHORITY_INVALID');

  const inspected = inspectAdmittedRawReplayCapture({
    captureAuthority: source.captureAuthority,
  });
  if (inspected?.ok !== true) return denied('SOURCE_REPLAY_PLAN_AUTHORITY_INVALID');
  const eventsSha256 = digestOf(eventsBytes);
  // capture authority 必须与 source events bytes 是同一份 exact final 证据。
  if (inspected.captureSha256 !== eventsSha256) {
    return denied('SOURCE_REPLAY_PLAN_AUTHORITY_INVALID');
  }

  const receipt = frozen({
    schemaVersion: 1,
    artifactKind: 'dual-replay-source-plan',
    pairId: input.pairId,
    sourceCandidateSha256: digestOf(candidateBytes),
    sourceEventsSha256: eventsSha256,
    sourceEntityLockSetSha256: digestOf(entityLockBytes),
  });

  const authority = frozen(Object.create(null));
  PLAN_STATE.set(authority, {
    kind: 'source-plan',
    pairId: input.pairId,
    caseId: inspected.capture?.caseId ?? null,
    captureSha256: inspected.captureSha256,
    captureAuthority: source.captureAuthority,
    runNamespace: source.runNamespace,
    executionTargetAuthority: input.executionTargetAuthority,
    executionTargetAttestationSha256: attestation,
    expectedObligations: deepFreeze(obligations),
    // 内部 seam：canonical issuer 在真实执行时才按 capability 取用，公开 API 不返回 bytes。
    bytes: frozen({
      testcaseBytes,
      expectedBytes,
      candidateBytes,
      eventsBytes,
      entityLockBytes,
      channelProfileBytes,
    }),
    digests: frozen({
      testcaseSha256: digestOf(testcaseBytes),
      expectedSha256: digestOf(expectedBytes),
      expectedObligationsSha256: digestOf(JSON.stringify(obligations)),
      candidateSha256: receipt.sourceCandidateSha256,
      eventsSha256,
      entityLockSetSha256: receipt.sourceEntityLockSetSha256,
      sutBuildDigest: input.sutBuildDigest,
      channelProfileDigest: input.channelProfileDigest,
      identityProfileDigest: input.identityProfileDigest,
      replayKernelDigest: input.replayKernelDigest,
      resetPlanDigest: input.resetPlanDigest,
      sessionPolicyDigest: input.sessionPolicyDigest,
    }),
    expectedBytesSha256: digestOf(expectedBytes),
    roles: { source: false },
    // reset instance 的一次性账本按 pair 归属：同一 pair 的 source/distilled 不得复用同一实例。
    usedResetInstances: new Set(),
    baselineProjectionSha256: null,
    finalized: false,
  });
  return frozen({ ok: true, authority, receipt });
}

// 内部 seam：clone、spread 与 JSON round-trip 都不在 WeakMap 中。
export function readSourcePlan(authority) {
  if (!authority || typeof authority !== 'object') return null;
  return PLAN_STATE.get(authority) || null;
}
