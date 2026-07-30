// resolved existing-atom projection 的薄协调 façade：先经 canonical capture inspector 取得
// authority 绑定的 exact bytes 与深拷贝文档，再用这份 bytes 恰一次消费 clean proof，
// 然后委托 lib/teachin-distillation 的纯核心模块做投影、解析、保真与候选生成。
// 纯核心：零 browser、零 fs、零 network、零 LLM；裁判路径零 LLM（护栏 #15）。

import { inspectAdmittedRawReplayCapture } from './raw-capture.mjs';
import { consumeCleanRawReplay } from './raw-proof.mjs';
import { projectCaptureEvents } from '../teachin-distillation/event-projection.mjs';
import { resolveCaptureAtoms } from '../teachin-distillation/atom-resolution.mjs';
import {
  contractDigest,
  validateResolvedProjection,
} from '../teachin-distillation/fidelity.mjs';
import { projectFlowBridgeCandidate } from '../teachin-distillation/flow-candidate.mjs';

const RESOLUTION_STATE = new WeakMap();
const SOURCE_GRANT_STATE = new WeakMap();
const ATOM_GRANT_STATE = new WeakMap();

function frozen(value) {
  return Object.freeze(value);
}

function denied(reason) {
  return frozen({ ok: false, reason });
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

// 只抽 mapping 行的归组标签，形状违例留给 fidelity 具名拒绝。
function intentGroupingOf(mappingCandidate) {
  const grouping = new Map();
  if (!Array.isArray(mappingCandidate)) return grouping;
  for (const row of mappingCandidate) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    if (typeof row.intentId !== 'string' || !row.intentId) continue;
    if (!Array.isArray(row.evidenceEventSeqs)) continue;
    for (const seq of row.evidenceEventSeqs) {
      if (Number.isSafeInteger(seq) && seq > 0) grouping.set(seq, row.intentId);
    }
  }
  return grouping;
}

function authoredIntentIdsOf(authoredTestCase) {
  const ids = new Set();
  if (!authoredTestCase || typeof authoredTestCase !== 'object') return ids;
  if (!Array.isArray(authoredTestCase.steps)) return ids;
  for (const step of authoredTestCase.steps) {
    if (!step || typeof step !== 'object' || Array.isArray(step)) continue;
    if (typeof step.intentId === 'string' && step.intentId) ids.add(step.intentId);
  }
  return ids;
}

export function resolveCaptureProjection({
  captureAuthority,
  cleanProofAuthority,
  mappingCandidate,
  atomRegistry,
  authoredTestCase,
  ...extraInputs
}) {
  // 未登记的输入键一律拒绝：不允许调用方另塞 capture bytes、identity 或 effect 旁路字段。
  if (Object.keys(extraInputs).length > 0) return denied('MAPPING_INVALID');

  // 顺序不可换：capture capability 先验真，否则伪造 capture 会白白吃掉 genuine clean proof。
  const inspected = inspectAdmittedRawReplayCapture({ captureAuthority });
  if (!inspected.ok) return denied('RAW_CAPTURE_AUTHORITY_INVALID');

  const consumed = consumeCleanRawReplay({
    cleanProofAuthority,
    currentCaptureBytes: inspected.captureBytes,
  });
  if (!consumed.ok) return denied(consumed.reason);

  if (!Array.isArray(mappingCandidate)) return denied('MAPPING_INVALID');

  // mapping 行给出业务归组名，authored testcase 给出唯一合法归组集合；两者都不改权威事实。
  const intentIdBySeq = intentGroupingOf(mappingCandidate);
  const authoredIntentIds = authoredIntentIdsOf(authoredTestCase);

  const projected = projectCaptureEvents({
    capture: inspected.capture,
    intentIdBySeq,
  });
  if (!projected.ok) return denied(projected.reason);

  // 本路投影本就是绑定投影（intentId 来自 mapping 行而非合成序数），必须显式声明绑定集，
  // 否则多击配方会把分属两个 authored 步的相邻事件合并（GRILL D6 守卫在此路形同虚设）。
  // 绑定集只取本次投影确实在场的业务事件：mapping 行自报的越界/结构 seq 仍归 fidelity
  // 具名拒绝（MAPPING_EVENT_OUT_OF_RANGE 等），不许被守卫入参校验抢先吞成 UNSAFE_DATA_SHAPE。
  const boundIntents = new Set(projected.projection
    .filter((event) => event.role === 'business' && intentIdBySeq.has(event.eventSeq))
    .map((event) => event.eventSeq));
  const resolution = resolveCaptureAtoms({
    projection: projected.projection,
    registry: atomRegistry,
    boundIntents,
  });
  if (!resolution.ok) return denied(resolution.reason);

  const fidelity = validateResolvedProjection({
    projection: projected.projection,
    resolved: resolution.resolved,
    pending: resolution.pending,
    structural: resolution.structural,
    mappingCandidate,
    registry: atomRegistry,
    recipes: resolution.recipes,
    authoredIntentIds,
  });
  if (!fidelity.ok) return denied(fidelity.reason);

  const candidate = projectFlowBridgeCandidate({
    caseId: inspected.capture.caseId,
    resolved: resolution.resolved,
    pending: resolution.pending,
    authoredTestCase,
  });
  if (!candidate.ok) return denied(candidate.reason);

  const resolutionAuthority = frozen(Object.create(null));
  RESOLUTION_STATE.set(resolutionAuthority, {
    caseId: inspected.capture.caseId,
    captureSha256: consumed.captureSha256,
    projection: projected.projection,
    resolved: resolution.resolved,
    pending: resolution.pending,
    structural: resolution.structural,
    coverage: fidelity.coverage,
    candidateTestCase: deepFreeze(structuredClone(candidate.candidateTestCase)),
    candidateMapping: deepFreeze(structuredClone(candidate.candidateMapping)),
    lineagePlan: deepFreeze(structuredClone(candidate.lineagePlan)),
    registry: atomRegistry,
    digests: frozen({
      authoredContract: contractDigest(authoredTestCase),
      identityProjection: contractDigest(null),
      effectPolicy: contractDigest('frozen-side-effect-policy'),
    }),
    sourceIssued: false,
    atomIssued: false,
  });

  return frozen({
    ok: true,
    resolutionAuthority,
    candidateTestCase: candidate.candidateTestCase,
    candidateMapping: candidate.candidateMapping,
    resolved: resolution.resolved,
    pending: resolution.pending,
    projection: projected.projection,
    coverage: fidelity.coverage,
  });
}

function readResolution(options, expectedKey) {
  let resolutionAuthority;
  try {
    if (!options || typeof options !== 'object') return null;
    if (Object.keys(options).join(',') !== expectedKey) return null;
    ({ resolutionAuthority } = options);
  } catch {
    return null;
  }
  return resolutionAuthority && typeof resolutionAuthority === 'object'
    ? RESOLUTION_STATE.get(resolutionAuthority) || null
    : null;
}

// 两枚 one-shot grant 绑定同一份 resolution，但互不替代：
// source grant 只喂 axes/frozen verdict，atom grant 只喂现役 flow-bridge/compile。
export function issueSourceSemanticGrant(options = {}) {
  const record = readResolution(options, 'resolutionAuthority');
  if (!record) return denied('RESOLUTION_AUTHORITY_INVALID');
  if (record.sourceIssued) return denied('SOURCE_SEMANTIC_GRANT_INVALID');
  record.sourceIssued = true;
  const grant = frozen(Object.create(null));
  SOURCE_GRANT_STATE.set(grant, { record, consumed: false });
  return frozen({ ok: true, grant });
}

export function issueAtomRoundtripGrant(options = {}) {
  const record = readResolution(options, 'resolutionAuthority');
  if (!record) return denied('RESOLUTION_AUTHORITY_INVALID');
  if (record.atomIssued) return denied('ATOM_ROUNDTRIP_GRANT_INVALID');
  record.atomIssued = true;
  const grant = frozen(Object.create(null));
  ATOM_GRANT_STATE.set(grant, { record, consumed: false });
  return frozen({ ok: true, grant });
}

function consumeGrant(state, grant) {
  const entry = grant && typeof grant === 'object' ? state.get(grant) : null;
  if (!entry || entry.consumed) return null;
  entry.consumed = true;
  return entry.record;
}

// 非消费式验真：source semantic completion 先核 binding 再消费，cross-pair 探针
// 不得吃掉任一方 genuine grant。只暴露 caseId 与 capture 绑定，不泄 projection 内容。
export function inspectSourceSemanticGrant(sourceSemanticGrant) {
  const entry = sourceSemanticGrant && typeof sourceSemanticGrant === 'object'
    ? SOURCE_GRANT_STATE.get(sourceSemanticGrant) : null;
  if (!entry || entry.consumed) return null;
  return frozen({
    caseId: entry.record.caseId,
    captureSha256: entry.record.captureSha256,
  });
}

// 只供同进程 canonical 消费者：atom roundtrip 与 source semantic completion。
export function consumeAtomRoundtripGrant(atomRoundtripGrant) {
  return consumeGrant(ATOM_GRANT_STATE, atomRoundtripGrant);
}

export function consumeSourceSemanticGrant(sourceSemanticGrant) {
  return consumeGrant(SOURCE_GRANT_STATE, sourceSemanticGrant);
}
