// 独立 guided-compile authoring runtime：第三条物理动作链，但不产 axes、不裁定、不铸 replay receipt。
// 顺序不可拆穿：canonical roundtrip 先消费 atom grant 并过 flow-bridge，只有它回调 lazy compileAdapter
// 时才打开独立 authoring runtime（fresh → 前置 workflow → 同 reset baseline → 现役 compile → exact close）。
// 任一子步失败都关闭 exact authoring owner，且绝不发布 candidate 或 closure。

import { runAtomRoundtrip } from './atom-roundtrip.mjs';
import { createCompileRun, compileFlow } from '../compile-atoms.mjs';
import { parseAuthoringChannelProfileBytes } from './channel-profile.mjs';

const INPUT_KEYS = [
  'atomRoundtripGrant',
  'authoringBaselineGrant',
  'sourceClosureAuthority',
  'runNamespace',
  'executionTargetAuthority',
];

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

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

// canonical 接缝：真实调用现役 roundtrip 与现役编译器，不复制任何编译知识。
function canonicalRoundtrip(input) {
  return runAtomRoundtrip(input);
}

function canonicalCompileRun(input) {
  return createCompileRun(input);
}

function canonicalCompileFlow(run, flow, options) {
  return compileFlow(run, flow, options);
}

// lineage 只按 grant-bound plan 逐行核对，不按最终 atom 名猜。
function lineageAgrees(lineage, lineagePlan) {
  if (!Array.isArray(lineage) || !Array.isArray(lineagePlan)) return false;
  if (lineage.length !== lineagePlan.length) return false;
  for (let index = 0; index < lineage.length; index += 1) {
    const row = lineage[index];
    const planned = lineagePlan[index];
    if (!isRecord(row) || !isRecord(planned)) return false;
    if (row.mappingKey !== planned.mappingKey) return false;
    if (row.sourceIntentId !== planned.sourceIntentId) return false;
    if (!Array.isArray(row.stepIds) || row.stepIds.length === 0) return false;
    if (!row.stepIds.every((stepId) => typeof stepId === 'string' && stepId)) return false;
  }
  return true;
}

// 现役 compileFlow 把编译产物推进 run.events 并返回 exact lineage 行；注入的现役编译接缝也可以
// 改为在返回值里自报 {ok:true,events}。两种形态都只认编译器自己报的事实：事件归属只取编译器给出的
// intent 归属，绝不按 atom 名、顺序或 mapping 猜；回链不唯一即 fail-closed。
function collectCompiled(run, firstEvent, result, lineagePlan) {
  if (Array.isArray(result)) {
    if (firstEvent === null) return null;
    return { compiledEvents: run.events.slice(firstEvent), compileLineage: result };
  }
  if (!isRecord(result) || result.ok !== true || !Array.isArray(result.events)) return null;
  const stepIdsByKey = new Map(lineagePlan.map((row) => [row.mappingKey, []]));
  const compiledEvents = [];
  const seenStepIds = new Set();
  for (const [index, event] of result.events.entries()) {
    if (!isRecord(event)) return null;
    const attribution = typeof event.sourceIntentId === 'string' && event.sourceIntentId
      ? event.sourceIntentId
      : event.intentId;
    if (typeof attribution !== 'string' || !attribution) return null;
    const rows = lineagePlan.filter((row) => row.sourceIntentId === attribution);
    if (rows.length !== 1) return null;
    // 编译器没给 stepId 时才合成；前缀与编译器真实 stepId 命名空间（atstep_/rawstep_）分开，
    // 避免合成名意外撞上另一条真实事件的 stepId 而被 seenStepIds 误判成重复。
    const stepId = typeof event.stepId === 'string' && event.stepId
      ? event.stepId
      : `synthcompiled_${index + 1}`;
    if (seenStepIds.has(stepId)) return null;
    seenStepIds.add(stepId);
    stepIdsByKey.get(rows[0].mappingKey).push(stepId);
    compiledEvents.push({ ...event, stepId });
  }
  const compileLineage = [];
  for (const row of lineagePlan) {
    const stepIds = stepIdsByKey.get(row.mappingKey);
    if (!stepIds || stepIds.length === 0) return null;
    compileLineage.push({
      mappingKey: row.mappingKey, sourceIntentId: row.sourceIntentId, stepIds,
    });
  }
  return { compiledEvents, compileLineage };
}

class AuthoringStageError extends Error {
  constructor(reason) {
    super('AUTHORING_STAGE_FAILED');
    this.authoringReason = reason;
  }
}

export function createCompileRuntimeAdapter(deps = {}) {
  const roundtrip = typeof deps.runAtomRoundtrip === 'function'
    ? deps.runAtomRoundtrip
    : canonicalRoundtrip;
  const openFreshAuthoringRuntime = deps.openFreshAuthoringRuntime;
  const executeAuthoringPreconditions = deps.executeAuthoringPreconditions;
  const verifyAuthoringReset = deps.verifyAuthoringReset;
  const compileRun = typeof deps.createCompileRun === 'function'
    ? deps.createCompileRun
    : canonicalCompileRun;
  const compileSteps = typeof deps.compileFlow === 'function'
    ? deps.compileFlow
    : canonicalCompileFlow;
  const closeAuthoringRuntime = deps.closeAuthoringRuntime;

  async function compileAuthoringCandidate(options = {}) {
    if (!exactKeys(options, INPUT_KEYS)) return denied('AUTHORING_COMPILE_FAILED');
    if (typeof options.runNamespace !== 'string' || !options.runNamespace) {
      return denied('AUTHORING_COMPILE_FAILED');
    }
    for (const key of INPUT_KEYS) {
      if (key === 'runNamespace') continue;
      if (!isRecord(options[key])) return denied('AUTHORING_COMPILE_FAILED');
    }
    for (const seam of [
      openFreshAuthoringRuntime, executeAuthoringPreconditions,
      verifyAuthoringReset, closeAuthoringRuntime,
    ]) {
      if (typeof seam !== 'function') return denied('AUTHORING_COMPILE_FAILED');
    }

    let internalFailure = null;
    let authoringClosureAuthority = null;

    const compileAdapter = async ({ candidateTestCase, flow, lineagePlan }) => {
      const frozenTestCase = deepFreeze(structuredClone(candidateTestCase));
      const frozenFlow = deepFreeze(structuredClone(flow));
      const frozenPlan = deepFreeze(structuredClone(lineagePlan));

      // 验真 target 与 source closure/baseline grant 之前不得有任何物理 open。
      let opened;
      try {
        opened = await openFreshAuthoringRuntime({
          sourceClosureAuthority: options.sourceClosureAuthority,
          authoringBaselineGrant: options.authoringBaselineGrant,
          // atom grant 带来的 candidate 身份必须先与 baseline 绑定核对，跨 pair 在物理 open 前即拒。
          candidateCaseId: typeof frozenTestCase?.caseId === 'string'
            ? frozenTestCase.caseId
            : null,
          runNamespace: options.runNamespace,
          executionTargetAuthority: options.executionTargetAuthority,
        });
      } catch {
        opened = null;
      }
      if (opened?.ok !== true || !isRecord(opened.authoringRuntimeAuthority)) {
        internalFailure = typeof opened?.reason === 'string'
          ? opened.reason
          : 'AUTHORING_RUNTIME_OPEN_FAILED';
        throw new AuthoringStageError(internalFailure);
      }
      const authoringRuntimeAuthority = opened.authoringRuntimeAuthority;

      let stageFailure = null;
      let compiledEvents = null;
      let compileLineage = null;
      try {
        const channelProfile = parseAuthoringChannelProfileBytes(opened.channelProfileBytes);
        if (!channelProfile.ok) throw new AuthoringStageError('AUTHORING_COMPILE_FAILED');
        // production runtime owner 会在物理 open 前拒绝尚未接通的身份观察通道；这里再守一次
        // 注入 seam，防测试/替代 owner 把声明 identity listApi 的 profile 静默降级为 DOM-only。
        if (channelProfile.identityChannelDeclared) {
          throw new AuthoringStageError('AUTHORING_IDENTITY_CHANNEL_UNSUPPORTED');
        }
        const preconditions = await executeAuthoringPreconditions({
          authoringRuntimeAuthority,
          candidateTestCase: frozenTestCase,
          executionTargetAuthority: options.executionTargetAuthority,
        });
        if (preconditions?.ok !== true) throw new AuthoringStageError('AUTHORING_BASELINE_MISMATCH');
        const reset = await verifyAuthoringReset({
          authoringRuntimeAuthority,
          authoringBaselineGrant: options.authoringBaselineGrant,
          runNamespace: options.runNamespace,
          executionTargetAuthority: options.executionTargetAuthority,
        });
        if (reset?.ok !== true) throw new AuthoringStageError('AUTHORING_BASELINE_MISMATCH');

        const compileRunInput = {
          page: opened.page,
          forensics: opened.forensics,
          state: opened.state,
          executionTargetAuthority: options.executionTargetAuthority,
        };
        // legacy owner 不携 bytes 时保持 createCompileRun 输入逐字段不变。
        if (channelProfile.present) {
          compileRunInput.profile = channelProfile.profile;
          compileRunInput.listRoute = channelProfile.listRoute;
          compileRunInput.agentListRoute = channelProfile.agentListRoute;
        }
        const run = compileRun(compileRunInput);
        if (!isRecord(run)) throw new AuthoringStageError('AUTHORING_COMPILE_FAILED');
        const firstEvent = Array.isArray(run.events) ? run.events.length : null;
        const firstVerification = Array.isArray(run.verification) ? run.verification.length : null;
        const lineage = await compileSteps(run, frozenFlow, { lineagePlan: frozenPlan });
        if (Array.isArray(lineage) && !lineageAgrees(lineage, frozenPlan)) {
          throw new AuthoringStageError('AUTHORING_COMPILE_FAILED');
        }
        // canonical compile 的 blocker / 动作身份面属于发布前硬门。注入的旧纯 seam 没有
        // verification 时保持兼容；生产 run 在场时每个物理事件都必须 unique 且真实 acted。
        if (Array.isArray(run.blockers) && run.blockers.length > 0) {
          throw new AuthoringStageError('AUTHORING_COMPILE_FAILED');
        }
        if (firstVerification !== null) {
          const verification = run.verification.slice(firstVerification);
          if (verification.some((row) => !isRecord(row)
            || row.resolution !== 'unique'
            || row.candidateCount !== 1
            || row.acted !== true)) {
            throw new AuthoringStageError('AUTHORING_COMPILE_FAILED');
          }
        }
        const collected = collectCompiled(run, firstEvent, lineage, frozenPlan);
        if (!collected) throw new AuthoringStageError('AUTHORING_COMPILE_FAILED');
        compiledEvents = collected.compiledEvents;
        compileLineage = collected.compileLineage;
      } catch (error) {
        stageFailure = error?.authoringReason || 'AUTHORING_COMPILE_FAILED';
      }

      // 无论成败都关闭 exact authoring owner，恰一次。
      let closureFailed = false;
      let closure = null;
      try {
        const closed = await closeAuthoringRuntime({ authoringRuntimeAuthority });
        if (closed?.ok !== true || !isRecord(closed.authoringClosureAuthority)) {
          closureFailed = true;
        } else {
          closure = closed.authoringClosureAuthority;
        }
      } catch {
        closureFailed = true;
      }

      if (stageFailure) {
        internalFailure = stageFailure;
        throw new AuthoringStageError(stageFailure);
      }
      if (closureFailed) {
        internalFailure = 'AUTHORING_RUNTIME_CLOSE_FAILED';
        throw new AuthoringStageError(internalFailure);
      }
      authoringClosureAuthority = closure;
      return { ok: true, compiledEvents, compileLineage };
    };

    let candidate;
    try {
      candidate = await roundtrip({
        atomRoundtripGrant: options.atomRoundtripGrant,
        compileAdapter,
      });
    } catch {
      candidate = null;
    }
    if (internalFailure) return denied(internalFailure);
    if (candidate?.ok !== true) {
      return denied(typeof candidate?.reason === 'string'
        ? candidate.reason
        : 'AUTHORING_COMPILE_FAILED');
    }
    if (!authoringClosureAuthority) return denied('AUTHORING_RUNTIME_CLOSE_FAILED');

    return frozen({
      ok: true,
      candidate: deepFreeze(candidate),
      authoringClosureAuthority,
    });
  }

  return frozen({ compileAuthoringCandidate });
}
