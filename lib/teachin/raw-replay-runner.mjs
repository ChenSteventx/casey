// admission → runtime 的唯一编排边界，以及 raw source 复现主循环与首错停止。
// 纯核心：零 browser、零 fs、零 network、零 LLM。所有真实页面能力由注入的 actionDriver 与现役
// page topology 接缝提供；nav 只是 path checkpoint，任何分支都不得导航修正（零 goto）。

import {
  admitRawReplayCapture,
  inspectAdmittedRawReplayCapture,
} from './raw-capture.mjs';
import { consumeFreshReplayRuntimeAuthority } from './fresh-runtime.mjs';
import { projectRawReplayAction } from './raw-action.mjs';
import { sealCleanRawReplay } from './raw-proof.mjs';
import { consumeNewPageAction } from '../page-topology/replay-bridge.mjs';
import {
  normalizeActionName, normalizeRefusalReason, normalizeResolutionName, safeEmit,
} from './cycle-evidence-context.mjs';

const PROOF_KIND = 'teach-in-raw-replay-proof';

// 下游接缝（capture/fresh/topology/observation/driver）回来的 reason 只允许落在本枚举内。
// 枚举外的自由串（注入接缝自造码、异常文本、地址、半成品事实）一律折叠成固定内部码：
// 失败面因此保持稳定可判读，也不会把私有事实经 reason 通道漏进证明与日志。
const STABLE_REASONS = new Set([
  'RAW_CAPTURE_AUTHORITY_INVALID',
  'RAW_CAPTURE_INPUT_INVALID',
  'RAW_CAPTURE_INVALID',
  'CAPTURE_CASE_MISMATCH',
  'CAPTURE_EVENTS_EMPTY',
  'CAPTURE_HASH_MISMATCH',
  'CAPTURE_PATH_INVALID',
  'CAPTURE_SEQ_DUPLICATE',
  'CAPTURE_SEQ_GAP',
  'CAPTURE_SEQ_INVALID',
  'CLEAN_PROOF_AUTHORITY_INVALID',
  'FRESH_RUNTIME_AUTHORITY_INVALID',
  'FRESH_RUNTIME_WITNESS_INVALID',
  'RECORDING_RUNTIME_NOT_CLOSED',
  'REPLAY_RUNTIME_NOT_FRESH',
  'REPLAY_RUNTIME_NOT_LIVE',
  'REPLAY_RUNTIME_OWNERSHIP_MISMATCH',
  'REPLAY_RUNTIME_REUSED',
  'PATH_CHECKPOINT_MISMATCH',
  'PATH_CHECKPOINT_UNAVAILABLE',
  'TOPOLOGY_PATH_MISMATCH',
  'TOPOLOGY_CONSUME_FAILED',
  'NO_ACTIVE_PAGE',
  'RAW_ACTION_INVALID',
  'RAW_NAV_MUST_NOT_GOTO',
  'FILL_VALUE_UNAVAILABLE',
  'MASKED_FILL_UNREPLAYABLE',
  'SELECTOR_NONE',
  'SELECTOR_AMBIGUOUS',
  'SELECTOR_UNAVAILABLE',
  'ACTION_FAILED',
  'RAW_OBSERVATION_INPUT_INVALID',
  'RAW_OBSERVATION_AUTHORITY_INVALID',
  'RAW_OBSERVATION_SEQUENCE_INVALID',
  'RAW_OBSERVATION_INCOMPLETE',
  'RAW_OBSERVATION_COLLECTION_FAILED',
  'RAW_REPLAY_INTERNAL_ERROR',
]);

function stableReason(value) {
  return typeof value === 'string' && STABLE_REASONS.has(value)
    ? value
    : 'RAW_REPLAY_INTERNAL_ERROR';
}

function frozen(value) {
  return Object.freeze(value);
}

function denied(reason) {
  return frozen({ ok: false, reason });
}

function buildProof({ caseId, captureSha256, status, totalEvents, steps }) {
  return frozen({
    schemaVersion: 1,
    artifactKind: PROOF_KIND,
    caseId,
    captureSha256,
    developmentOnly: true,
    promotionReady: false,
    source: frozen({ kind: 'fresh-browser-reproduction' }),
    status,
    totalEvents,
    consumedEvents: steps.filter((step) => step.outcome === 'REPRODUCED').length,
    steps: frozen(steps.map((step) => frozen(step))),
  });
}

function failedRun(reason, proofInput) {
  return frozen({
    ok: false,
    status: 'FAILED',
    reason,
    proof: buildProof({ ...proofInput, status: 'FAILED' }),
  });
}

function driverAvailable(actionDriver) {
  return !!actionDriver && typeof actionDriver === 'object'
    && typeof actionDriver.readActivePath === 'function'
    && typeof actionDriver.resolve === 'function'
    && typeof actionDriver.perform === 'function';
}

// 逐 event observation 的动作轴：只记录本层可观测的解析/执行事实，不猜 intent、不产裁定。
function actionAxis(resolution, candidateCount, identityOk) {
  return frozen({
    resolution,
    candidateCount,
    identityReadback: frozen({ ok: identityOk === true }),
  });
}

// 取证旁路：逐事件动作轴与两处 observer 拒付照原样通报。
// 这两处现无 catch，本通报也不加 catch、不改控制流、不动返回值。
const RAW_STAGE = 'source-raw-execute';

function reportObserverRefusal(refusalPoint, seq, reason) {
  safeEmit(refusalPoint, { stage: RAW_STAGE, seq, reason: normalizeRefusalReason(reason) });
}

function reportEventAxis(event, axis, reason) {
  const row = {
    stage: RAW_STAGE,
    seq: event.seq,
    action: normalizeActionName(event.action),
    resolution: normalizeResolutionName(axis?.resolution),
    candidateCount: Number.isSafeInteger(axis?.candidateCount) ? axis.candidateCount : 0,
    performOk: reason === null,
  };
  safeEmit('raw-runner.event', reason === null
    ? row
    : { ...row, reason: normalizeRefusalReason(reason) });
}

function observerAvailable(eventObserver) {
  return !!eventObserver && typeof eventObserver === 'object'
    && typeof eventObserver.begin === 'function'
    && typeof eventObserver.finish === 'function';
}

// 解析轴 → 稳定 reason 的固定映射；unique 且恰一候选并携 genuine authority 才允许进入 perform。
function classifyResolution(resolved) {
  if (!resolved || typeof resolved !== 'object') {
    return { reason: 'RAW_REPLAY_INTERNAL_ERROR' };
  }
  const { resolution, candidateCount, actionAuthority } = resolved;
  if (resolution === 'unique' && candidateCount === 1) {
    if (!actionAuthority || typeof actionAuthority !== 'object') {
      return { reason: 'RAW_REPLAY_INTERNAL_ERROR' };
    }
    return { actionAuthority };
  }
  if (candidateCount === 0 || resolution === 'none') {
    return { reason: 'SELECTOR_NONE' };
  }
  if (Number.isSafeInteger(candidateCount) && candidateCount > 1) {
    return { reason: 'SELECTOR_AMBIGUOUS' };
  }
  if (resolution === 'ambiguous') return { reason: 'SELECTOR_AMBIGUOUS' };
  return { reason: 'RAW_REPLAY_INTERNAL_ERROR' };
}

async function readCheckpoint({ actionDriver, topologyAuthority, executionTargetAuthority, event }) {
  let current;
  try {
    current = await actionDriver.readActivePath({
      topologyAuthority,
      executionTargetAuthority,
    });
  } catch {
    return 'PATH_CHECKPOINT_UNAVAILABLE';
  }
  if (typeof current !== 'string' || !current) return 'PATH_CHECKPOINT_UNAVAILABLE';
  return current === event.path ? null : 'PATH_CHECKPOINT_MISMATCH';
}

async function consumeTopologyEvent({ topologyAuthority, event }) {
  let pageAuthority;
  try {
    pageAuthority = topologyAuthority?.activePageAuthority?.();
  } catch {
    return 'NO_ACTIVE_PAGE';
  }
  let consumed;
  try {
    consumed = await consumeNewPageAction({
      controller: topologyAuthority,
      pageAuthority,
      event: { action: 'newpage', path: event.path },
    });
  } catch {
    return 'TOPOLOGY_CONSUME_FAILED';
  }
  return consumed?.ok === true ? null : stableReason(consumed?.reason || 'TOPOLOGY_CONSUME_FAILED');
}

// driver 收到的定位载荷必须一字不差是 projectRawReplayAction 的 exact actionRequest：
// 可枚举键、JSON 投影与泄漏扫描都只看得到 action/fallbackCss/value/key。
// capture seq 只是 same-run attribution（driver 与逐 event observation 共用同一 synthetic step），
// 它不是定位事实，因此以不可枚举属性搭载，绝不混进动作载荷。
function attributedRequest(actionRequest, seq) {
  const request = { ...actionRequest };
  Object.defineProperty(request, 'seq', {
    value: seq,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return frozen(request);
}

const RESOLUTION_LABEL = frozen({
  SELECTOR_NONE: 'none',
  SELECTOR_AMBIGUOUS: 'ambiguous',
  RAW_REPLAY_INTERNAL_ERROR: 'internal_error',
});

async function performBusinessEvent({
  actionDriver,
  actionRequest,
  seq,
  topologyAuthority,
  executionTargetAuthority,
}) {
  let resolved;
  try {
    resolved = await actionDriver.resolve({
      event: attributedRequest(actionRequest, seq),
      topologyAuthority,
      executionTargetAuthority,
    });
  } catch {
    return { reason: 'RAW_REPLAY_INTERNAL_ERROR', axis: actionAxis('internal_error', 0, false) };
  }
  const classified = classifyResolution(resolved);
  if (classified.reason) {
    const count = Number.isSafeInteger(resolved?.candidateCount) ? resolved.candidateCount : 0;
    return {
      reason: classified.reason,
      axis: actionAxis(RESOLUTION_LABEL[classified.reason] || 'internal_error', count, false),
    };
  }
  let performed;
  try {
    performed = await actionDriver.perform({
      actionAuthority: classified.actionAuthority,
      topologyAuthority,
      executionTargetAuthority,
    });
  } catch {
    return { reason: 'ACTION_FAILED', axis: actionAxis('action_failed', 1, false) };
  }
  if (performed?.ok !== true || performed?.identityReadback?.ok !== true) {
    return { reason: 'ACTION_FAILED', axis: actionAxis('action_failed', 1, false) };
  }
  return { reason: null, axis: actionAxis('unique', 1, true) };
}

export async function runRawReplay(options = {}) {
  let captureAuthority;
  let freshRuntimeAuthority;
  let topologyAuthority;
  let executionTargetAuthority;
  let actionDriver;
  let eventObserver;
  try {
    if (!options || typeof options !== 'object') {
      return denied('RAW_CAPTURE_AUTHORITY_INVALID');
    }
    ({
      captureAuthority,
      freshRuntimeAuthority,
      topologyAuthority,
      executionTargetAuthority,
      actionDriver,
      eventObserver,
    } = options);
  } catch {
    return denied('RAW_CAPTURE_AUTHORITY_INVALID');
  }
  // 1. capture 只 inspect、不消费；伪造/clone 在读页面之前拒。
  const inspected = inspectAdmittedRawReplayCapture({ captureAuthority });
  if (inspected.ok !== true) return denied(stableReason(inspected.reason));
  // 2. fresh authority 在读取任何页面状态之前原子消费：后续失败也不得退还或重试。
  const fresh = consumeFreshReplayRuntimeAuthority({
    freshRuntimeAuthority,
    topologyAuthority,
  });
  if (fresh.ok !== true) return denied(stableReason(fresh.reason));
  if (!driverAvailable(actionDriver)) return denied('RAW_REPLAY_INTERNAL_ERROR');
  // observer 可缺席（独立 raw 诊断入口）；一旦给出就必须是完整的 begin/finish 闭包。
  const observer = eventObserver === undefined || eventObserver === null
    ? null
    : (observerAvailable(eventObserver) ? eventObserver : undefined);
  if (observer === undefined) return denied('RAW_REPLAY_INTERNAL_ERROR');

  const capture = inspected.capture;
  const proofInput = {
    caseId: capture.caseId,
    captureSha256: inspected.captureSha256,
    totalEvents: capture.events.length,
  };
  const steps = [];
  for (const event of capture.events) {
    // 固定顺序：begin(seq) → path/resolve/perform 或 topology → finish(seq,actionAxis)。
    // 首错 event 仍 finish 以保留失败动作轴，但下一 seq 不得 begin。
    if (observer) {
      const begun = await observer.begin({ seq: event.seq, topologyAuthority });
      if (begun?.ok !== true) {
        const reason = stableReason(begun?.reason);
        reportObserverRefusal('observer.begin', event.seq, reason);
        steps.push({ seq: event.seq, action: event.action, outcome: 'FAILED', reason });
        return failedRun(reason, { ...proofInput, steps });
      }
    }
    let reason = null;
    let axis = actionAxis('unique', 1, true);
    const checkpoint = await readCheckpoint({
      actionDriver,
      topologyAuthority,
      executionTargetAuthority,
      event,
    });
    if (checkpoint) {
      reason = stableReason(checkpoint);
      axis = actionAxis('checkpoint_failed', 0, false);
    } else {
      const projected = projectRawReplayAction(event);
      if (projected.ok !== true) {
        reason = 'RAW_ACTION_INVALID';
        axis = actionAxis('action_invalid', 0, false);
      } else if (projected.kind === 'control' && projected.controlAction === 'newpage') {
        const topologyReason = await consumeTopologyEvent({ topologyAuthority, event });
        if (topologyReason) {
          reason = stableReason(topologyReason);
          axis = actionAxis('topology_failed', 0, false);
        }
      } else if (projected.kind === 'action') {
        const performed = await performBusinessEvent({
          actionDriver,
          actionRequest: projected.actionRequest,
          seq: event.seq,
          topologyAuthority,
          executionTargetAuthority,
        });
        reason = performed.reason === null ? null : stableReason(performed.reason);
        axis = performed.axis;
      }
      // nav 是纯 checkpoint：path 相等即记复现，绝不导航修正。
    }
    if (observer) {
      const finished = await observer.finish({
        seq: event.seq,
        actionAxis: axis,
        topologyAuthority,
      });
      if (finished?.ok !== true) {
        const finishReason = stableReason(finished?.reason);
        reportObserverRefusal('observer.finish', event.seq, finishReason);
        if (!reason) reason = finishReason;
      }
    }
    reportEventAxis(event, axis, reason);
    if (reason) {
      steps.push({ seq: event.seq, action: event.action, outcome: 'FAILED', reason });
      return failedRun(reason, { ...proofInput, steps });
    }
    steps.push({ seq: event.seq, action: event.action, outcome: 'REPRODUCED' });
  }

  const proof = buildProof({ ...proofInput, status: 'CLEAN', steps });
  const sealed = sealCleanRawReplay({ captureSha256: inspected.captureSha256 });
  if (sealed.ok !== true) return failedRun('RAW_REPLAY_INTERNAL_ERROR', { ...proofInput, steps });
  return frozen({
    ok: true,
    status: 'CLEAN',
    proof,
    cleanProofAuthority: sealed.cleanProofAuthority,
  });
}

// 唯一 admission → runtime 编排边界：全包准入失败时 fresh factory 与全部 driver 调用数恒为零。
export async function admitAndRunRawReplay(options = {}) {
  let caseId;
  let captureBytes;
  let freshRuntimeFactory;
  let topologyAuthority;
  let executionTargetAuthority;
  let actionDriver;
  let eventObserver;
  try {
    if (!options || typeof options !== 'object') {
      return denied('RAW_CAPTURE_INPUT_INVALID');
    }
    ({
      caseId,
      captureBytes,
      freshRuntimeFactory,
      topologyAuthority,
      executionTargetAuthority,
      actionDriver,
      eventObserver,
    } = options);
  } catch {
    return denied('RAW_CAPTURE_INPUT_INVALID');
  }
  const admitted = admitRawReplayCapture({ caseId, captureBytes });
  if (admitted.ok !== true) return admitted;
  if (typeof freshRuntimeFactory !== 'function') {
    return denied('FRESH_RUNTIME_AUTHORITY_INVALID');
  }
  let created;
  try {
    created = await freshRuntimeFactory({ topologyAuthority });
  } catch {
    return denied('FRESH_RUNTIME_AUTHORITY_INVALID');
  }
  if (created?.ok !== true || !created.freshRuntimeAuthority) {
    return denied(stableReason(created?.reason || 'FRESH_RUNTIME_AUTHORITY_INVALID'));
  }
  return runRawReplay({
    captureAuthority: admitted.captureAuthority,
    freshRuntimeAuthority: created.freshRuntimeAuthority,
    topologyAuthority,
    executionTargetAuthority,
    actionDriver,
    ...(eventObserver === undefined ? {} : { eventObserver }),
  });
}
