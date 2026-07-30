// 同进程 record → capture admission → source runtime preparation → 编排 façade 的唯一入口。
// 录制 handles 只在本模块内交给 canonical adapter，绝不进入 core；capture 与 preparation 两枚
// capability 只能由本模块在同进程铸造，plain JSON 无法跨进程重建。
// 任何早退都按 lifecycle 状态收尾 recording owner，恰关闭一次，且不重复 close 宽容。

import { admitRawReplayCapture } from './raw-capture.mjs';
import { canonicalRuntimeCycleAdapter } from './runtime-cycle-adapter.mjs';
import { runTeachinReplayabilityCycle } from './dual-replay-orchestrator.mjs';

const ENTRY_KEYS = [
  'caseId', 'captureBytes', 'recordingBrowser', 'recordingContext', 'cycleInput',
];
const CYCLE_KEYS = ['sourcePlan', 'executionTargetAuthority', 'projection', 'distilled'];
const SOURCE_KEYS = ['candidateBytes', 'eventsBytes', 'entityLockBytes', 'runNamespace'];
const DISTILLED_KEYS = ['authoringRunNamespace', 'runNamespace'];
const INPUT_INVALID = 'CYCLE_ENTRY_INPUT_INVALID';
const ENTRY_FAILED = 'CYCLE_ENTRY_FAILED';

function frozen(value) {
  return Object.freeze(value);
}

function denied(reason) {
  return frozen({ ok: false, reason });
}

function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.keys(value).sort().join(' ') === [...expected].sort().join(' ');
}

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function liveRecordingPair(recordingBrowser, recordingContext) {
  for (const [handle, methods] of [
    [recordingBrowser, ['on', 'close', 'isConnected']],
    [recordingContext, ['on', 'close', 'browser']],
  ]) {
    if (!isRecord(handle)) return false;
    if (!methods.every((name) => typeof handle[name] === 'function')) return false;
  }
  try {
    return recordingContext.browser() === recordingBrowser;
  } catch {
    return false;
  }
}

function validCycleInput(cycleInput) {
  if (!exactKeys(cycleInput, CYCLE_KEYS)) return false;
  const sourcePlan = cycleInput.sourcePlan;
  if (!isRecord(sourcePlan) || !exactKeys(sourcePlan.source, SOURCE_KEYS)) return false;
  if (typeof sourcePlan.source.runNamespace !== 'string' || !sourcePlan.source.runNamespace) {
    return false;
  }
  if (!exactKeys(cycleInput.distilled, DISTILLED_KEYS)) return false;
  if (!isRecord(cycleInput.projection)) return false;
  if (!isRecord(cycleInput.executionTargetAuthority)) return false;
  return true;
}

// 唯一顺序的第一步：capture 准入。canonical 缺省实现在此，注入接缝只替换它。
function canonicalAdmission(input) {
  return admitRawReplayCapture(input);
}

export function createReplayabilityCycleEntry(deps = {}) {
  const admit = typeof deps.admitRawReplayCapture === 'function'
    ? deps.admitRawReplayCapture
    : canonicalAdmission;
  const runtimeCycleAdapter = isRecord(deps.runtimeCycleAdapter)
    ? deps.runtimeCycleAdapter
    : canonicalRuntimeCycleAdapter;
  const runCycle = typeof deps.runTeachinReplayabilityCycle === 'function'
    ? deps.runTeachinReplayabilityCycle
    : canonicalCycleFacade;

  async function runRecordedCycle(input = {}) {
    if (!exactKeys(input, ENTRY_KEYS)) return denied(INPUT_INVALID);
    const { caseId, captureBytes, recordingBrowser, recordingContext, cycleInput } = input;
    if (typeof caseId !== 'string' || !caseId) return denied(INPUT_INVALID);
    if (!Buffer.isBuffer(captureBytes) || captureBytes.length === 0) return denied(INPUT_INVALID);
    if (!liveRecordingPair(recordingBrowser, recordingContext)) return denied(INPUT_INVALID);
    if (!validCycleInput(cycleInput)) return denied(INPUT_INVALID);

    // 关闭事实只能来自真实 lifecycle 事件；失败清理据此判定，绝不靠重复 close 宽容。
    let contextClosed = false;
    try {
      recordingContext.on('close', () => { contextClosed = true; });
      // Browser 断连蕴含其 Context 已随之关闭：与 close 事件一样真置位，
      // 否则清理分支会在 browser 先断时误判「还没关」而重复关一次。
      recordingBrowser.on('disconnected', () => { contextClosed = true; });
    } catch {
      return denied(INPUT_INVALID);
    }
    const stillLive = () => {
      try {
        return recordingBrowser.isConnected() === true;
      } catch {
        return false;
      }
    };

    try {
      const admitted = await admit({ caseId, captureBytes });
      if (admitted?.ok !== true) return denied(admitted?.reason || ENTRY_FAILED);

      const prepared = await runtimeCycleAdapter.prepareSourceReplayRuntime({
        executionTargetAuthority: cycleInput.executionTargetAuthority,
        recordingBrowser,
        recordingContext,
        runNamespace: cycleInput.sourcePlan.source.runNamespace,
      });
      if (prepared?.ok !== true) return denied(prepared?.reason || ENTRY_FAILED);

      const result = await runCycle({
        sourcePlan: {
          ...cycleInput.sourcePlan,
          source: {
            ...cycleInput.sourcePlan.source,
            captureAuthority: admitted.captureAuthority,
          },
        },
        executionTargetAuthority: cycleInput.executionTargetAuthority,
        sourceRuntime: {
          sourceRuntimePreparationAuthority: prepared.sourceRuntimePreparationAuthority,
        },
        projection: cycleInput.projection,
        distilled: cycleInput.distilled,
      });
      return result;
    } catch {
      return denied(ENTRY_FAILED);
    } finally {
      if (stillLive()) {
        if (!contextClosed) {
          try {
            await recordingContext.close();
          } catch { /* 清理失败不改变闭合返回 */ }
        }
        try {
          await recordingBrowser.close();
        } catch { /* 清理失败不改变闭合返回 */ }
      }
    }
  }

  return frozen({ runRecordedCycle });
}

// 唯一顺序的最后一步：编排 façade。它只在 admission 与 source runtime preparation 都成功后被调用，
// 所以 canonical 缺省实现放在准入/准备两步之后，与 entry 内部推进次序一致。
function canonicalCycleFacade(input) {
  return runTeachinReplayabilityCycle(input);
}

const canonicalEntry = createReplayabilityCycleEntry({});

export async function runRecordedTeachinReplayabilityCycle(input) {
  return canonicalEntry.runRecordedCycle(input);
}
