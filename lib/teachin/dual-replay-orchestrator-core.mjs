// 23 步双回放编排核心：只按 authority 次序推进，不认识 browser、fs、network、LLM，也不裁定。
// 全部业务能力由 canonical 依赖注入；调用方不能提交 PASS/CLEAN/equivalent 或预开 runtime 事实。
// 失败一律闭合返回 {ok:false,developmentOnly,promotionReady,reason}，不回显异常原文或私有 authority。

import { normalizeRefusalReason, safeEmit } from './cycle-evidence-context.mjs';

const INPUT_KEYS = [
  'sourcePlan', 'executionTargetAuthority', 'sourceRuntime', 'projection', 'distilled',
];
const SOURCE_PLAN_KEYS = [
  'pairId', 'testcaseBytes', 'expectedBytes', 'expectedObligations',
  'sutBuildDigest', 'channelProfileDigest', 'identityProfileDigest',
  'replayKernelDigest', 'resetPlanDigest', 'sessionPolicyDigest', 'source',
];
const SOURCE_KEYS = [
  'captureAuthority', 'candidateBytes', 'eventsBytes', 'entityLockBytes', 'runNamespace',
];
const RUNTIME_KEYS = ['sourceRuntimePreparationAuthority'];
const PROJECTION_KEYS = ['mappingCandidate', 'authoredTestCase'];
const DISTILLED_KEYS = ['authoringRunNamespace', 'runNamespace'];

const INPUT_INVALID = 'ORCHESTRATOR_INPUT_INVALID';
const STAGE_FAILED = 'ORCHESTRATOR_STAGE_FAILED';

function frozen(value) {
  return Object.freeze(value);
}

function failure(reason) {
  return frozen({
    ok: false, developmentOnly: true, promotionReady: false, reason,
  });
}

function success(equivalenceReceipt) {
  return frozen({
    ok: true, developmentOnly: true, promotionReady: false, equivalenceReceipt,
  });
}

function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.keys(value).sort().join(' ') === [...expected].sort().join(' ');
}

function namespaceOf(value) {
  return typeof value === 'string' && value ? value : null;
}

function validateInput(input) {
  if (!exactKeys(input, INPUT_KEYS)) return false;
  if (!exactKeys(input.sourcePlan, SOURCE_PLAN_KEYS)) return false;
  if (!exactKeys(input.sourcePlan.source, SOURCE_KEYS)) return false;
  if (!exactKeys(input.sourceRuntime, RUNTIME_KEYS)) return false;
  if (!exactKeys(input.projection, PROJECTION_KEYS)) return false;
  if (!exactKeys(input.distilled, DISTILLED_KEYS)) return false;
  const sourceNamespace = namespaceOf(input.sourcePlan.source.runNamespace);
  const authoringNamespace = namespaceOf(input.distilled.authoringRunNamespace);
  const distilledNamespace = namespaceOf(input.distilled.runNamespace);
  if (!sourceNamespace || !authoringNamespace || !distilledNamespace) return false;
  // 三 runtime 两两不同 namespace，避免拿同一 run 冒充独立证据。
  const namespaces = new Set([sourceNamespace, authoringNamespace, distilledNamespace]);
  if (namespaces.size !== 3) return false;
  return true;
}

async function attempt(call) {
  try {
    const result = await call();
    return result && typeof result === 'object' ? result : null;
  } catch {
    return null;
  }
}

function stageReason(result) {
  return typeof result?.reason === 'string' ? result.reason : STAGE_FAILED;
}

// 取证旁路：编号步的阶段边界照原样通报归因与稳定码，推进次序与返回值一字不动。
function reportStage(stage, reason) {
  safeEmit('orchestrator.stage-boundary', { stage, reason: normalizeRefusalReason(reason) });
}

export function createDualReplayOrchestratorCore(deps = {}) {
  const {
    dualReplayApi, runAuthorityApi, resolvedProjectionApi, atomRegistry, runtimeCycleAdapter,
  } = deps;

  async function disposePrepared(preparationAuthority, reason) {
    if (!preparationAuthority || typeof preparationAuthority !== 'object') return failure(reason);
    const disposed = await attempt(() => runtimeCycleAdapter.disposePreparedSourceReplayRuntime({
      sourceRuntimePreparationAuthority: preparationAuthority,
    }));
    if (disposed?.ok !== true) return failure('SOURCE_PREPARED_RUNTIME_DISPOSE_FAILED');
    return failure(reason);
  }

  async function closeOwner(runtimeOwnerAuthority) {
    return attempt(() => runtimeCycleAdapter.closeReplayRuntimeOwners({ runtimeOwnerAuthority }));
  }

  async function runCycle(input) {
    const preparationAuthority = input?.sourceRuntime?.sourceRuntimePreparationAuthority;
    if (!validateInput(input)) {
      reportStage('source-plan', INPUT_INVALID);
      return disposePrepared(preparationAuthority, INPUT_INVALID);
    }
    const target = input.executionTargetAuthority;
    if (!target || typeof target !== 'object') {
      reportStage('source-plan', INPUT_INVALID);
      return disposePrepared(preparationAuthority, INPUT_INVALID);
    }
    const sourceNamespace = input.sourcePlan.source.runNamespace;

    // 1 source plan
    const plan = await attempt(() => dualReplayApi.createSourceReplayPlanAuthority({
      ...input.sourcePlan,
      executionTargetAuthority: target,
    }));
    if (plan?.ok !== true || !plan.authority) {
      reportStage('source-plan', stageReason(plan));
      return disposePrepared(preparationAuthority, stageReason(plan));
    }

    // 2 claim prepared source runtime
    const claimed = await attempt(() => runtimeCycleAdapter.claimPreparedSourceReplayRuntime({
      sourceRuntimePreparationAuthority: preparationAuthority,
      sourcePlanAuthority: plan.authority,
      runNamespace: sourceNamespace,
      executionTargetAuthority: target,
    }));
    if (claimed?.ok !== true || !claimed.freshRuntimeAuthority
      || !claimed.topologyAuthority || !claimed.runtimeOwnerAuthority) {
      reportStage('source-runtime-claim', stageReason(claimed));
      return disposePrepared(preparationAuthority, stageReason(claimed));
    }
    const sourceOwner = claimed.runtimeOwnerAuthority;

    const sourcePhase = await runSourcePhase({ input, target, plan, claimed, sourceNamespace });
    if (sourcePhase.reason) {
      await closeOwner(sourceOwner);
      return failure(sourcePhase.reason);
    }

    // 10 exact source owners close
    const sourceClosed = await closeOwner(sourceOwner);
    if (sourceClosed?.ok !== true || !sourceClosed.sourceClosureAuthority) {
      reportStage('source-runtime-close', 'SOURCE_RUNTIME_CLOSE_FAILED');
      return failure('SOURCE_RUNTIME_CLOSE_FAILED');
    }

    // 11 独立 authoring runtime：真跑 roundtrip/compile/close 后才铸 distilled candidate
    const sealed = await attempt(() => runtimeCycleAdapter.runAndSealDistilledCandidate({
      atomRoundtripGrant: sourcePhase.atomRoundtripGrant,
      sourceClosureAuthority: sourceClosed.sourceClosureAuthority,
      authoringBaselineGrant: sourcePhase.authoringBaselineGrant,
      runNamespace: input.distilled.authoringRunNamespace,
      executionTargetAuthority: target,
    }));
    if (sealed?.ok !== true || !sealed.distilledCandidateAuthority
      || !sealed.authoringClosureAuthority) {
      reportStage('distilled-seal', stageReason(sealed));
      return failure(stageReason(sealed));
    }

    // 12 pair finalize
    const finalized = await attempt(() => dualReplayApi.finalizeDualReplayPlanAuthority({
      sourcePlanAuthority: plan.authority,
      sourceCompletionAuthority: sourcePhase.completionAuthority,
      distilledCandidateAuthority: sealed.distilledCandidateAuthority,
    }));
    if (finalized?.ok !== true || !finalized.pairAuthority
      || !finalized.pairBoundSourceCompletionAuthority) {
      reportStage('pair-finalize', stageReason(finalized));
      return failure(stageReason(finalized));
    }

    // 13 source semantic receipt
    const sourceReceipt = await attempt(() => dualReplayApi.createSemanticReplayReceipt({
      completionAuthority: finalized.pairBoundSourceCompletionAuthority,
    }));
    if (sourceReceipt?.ok !== true || !sourceReceipt.authority || !sourceReceipt.bytes) {
      reportStage('source-receipt', stageReason(sourceReceipt));
      return failure(stageReason(sourceReceipt));
    }

    // 14 distilled fresh runtime
    const distilledPrepared = await attempt(
      () => runtimeCycleAdapter.prepareDistilledReplayRuntime({
        authoringClosureAuthority: sealed.authoringClosureAuthority,
        pairAuthority: finalized.pairAuthority,
        runNamespace: input.distilled.runNamespace,
        executionTargetAuthority: target,
      }),
    );
    if (distilledPrepared?.ok !== true || !distilledPrepared.freshRuntimeAuthority
      || !distilledPrepared.topologyAuthority || !distilledPrepared.runtimeOwnerAuthority) {
      reportStage('distilled-runtime-prepare', stageReason(distilledPrepared));
      return failure(stageReason(distilledPrepared));
    }

    return runDistilledPhase({
      input, target, finalized, sourceReceipt, distilledPrepared,
    });
  }

  // source 相的统一停步：通报阶段边界归因，再原样返回既有闭合 reason 形状。
  function sourceStop(stage, result) {
    const reason = stageReason(result);
    reportStage(stage, reason);
    return { reason };
  }

  // 步 3–9：source 两相（raw execute → resolved semantic completion）与两枚 one-shot grant。
  async function runSourcePhase({ input, target, plan, claimed, sourceNamespace }) {
    const reset = await attempt(() => runAuthorityApi.createResetAuthority({
      replayPlanAuthority: plan.authority,
      role: 'source',
      runNamespace: sourceNamespace,
      trustedResetIssuer: runtimeCycleAdapter.resetIssuer,
    }));
    if (reset?.ok !== true || !reset.authority) return sourceStop('source-raw-execute', reset);

    const run = await attempt(() => dualReplayApi.authorizeSourceReplay({
      sourcePlanAuthority: plan.authority,
      role: 'source',
      runNamespace: sourceNamespace,
      resetAuthority: reset.authority,
      freshRuntimeAuthority: claimed.freshRuntimeAuthority,
      topologyAuthority: claimed.topologyAuthority,
      runtimeOwnerAuthority: claimed.runtimeOwnerAuthority,
      executionTargetAuthority: target,
    }));
    if (run?.ok !== true || !run.authority) return sourceStop('source-raw-execute', run);

    const executed = await attempt(() => dualReplayApi.executeAuthorizedSourceReplay({
      runAuthority: run.authority,
      trustedRawReplayIssuer: runtimeCycleAdapter.rawReplayIssuer,
    }));
    if (executed?.ok !== true || !executed.rawExecutionAuthority || !executed.cleanProofAuthority) {
      return sourceStop('source-raw-execute', executed);
    }
    if (executed.sourceRuntimeOwnerAuthority !== claimed.runtimeOwnerAuthority) {
      reportStage('source-raw-execute', 'REPLAY_RUNTIME_OWNERSHIP_MISMATCH');
      return { reason: 'REPLAY_RUNTIME_OWNERSHIP_MISMATCH' };
    }

    const resolution = await attempt(() => resolvedProjectionApi.resolveCaptureProjection({
      captureAuthority: input.sourcePlan.source.captureAuthority,
      cleanProofAuthority: executed.cleanProofAuthority,
      mappingCandidate: input.projection.mappingCandidate,
      atomRegistry,
      authoredTestCase: input.projection.authoredTestCase,
    }));
    if (resolution?.ok !== true || !resolution.resolutionAuthority) {
      return sourceStop('source-resolved-completion', resolution);
    }

    const semanticGrant = await attempt(() => resolvedProjectionApi.issueSourceSemanticGrant({
      resolutionAuthority: resolution.resolutionAuthority,
    }));
    if (semanticGrant?.ok !== true || !semanticGrant.grant) {
      return sourceStop('source-resolved-completion', semanticGrant);
    }

    const completed = await attempt(() => dualReplayApi.completeResolvedSourceReplay({
      rawExecutionAuthority: executed.rawExecutionAuthority,
      sourceSemanticGrant: semanticGrant.grant,
      trustedResolvedSourceIssuer: runtimeCycleAdapter.resolvedSourceIssuer,
    }));
    if (completed?.ok !== true || !completed.completionAuthority
      || !completed.authoringBaselineGrant) {
      return sourceStop('source-resolved-completion', completed);
    }

    const atomGrant = await attempt(() => resolvedProjectionApi.issueAtomRoundtripGrant({
      resolutionAuthority: resolution.resolutionAuthority,
    }));
    if (atomGrant?.ok !== true || !atomGrant.grant) {
      return sourceStop('source-resolved-completion', atomGrant);
    }

    return {
      reason: null,
      completionAuthority: completed.completionAuthority,
      authoringBaselineGrant: completed.authoringBaselineGrant,
      atomRoundtripGrant: atomGrant.grant,
    };
  }

  // 步 15–23：distilled 证据回放与确定性比较；一旦 runtime 归属转移，必定 finally 关闭 exact owner。
  async function runDistilledPhase({
    input, target, finalized, sourceReceipt, distilledPrepared,
  }) {
    let reason = null;
    let equivalenceReceipt = null;
    // 阶段游标：distilled 相各步以抛出汇流到同一 catch，游标让通报仍能落到具体阶段。
    let stage = 'distilled-completion';
    try {
      const reset = await attempt(() => runAuthorityApi.createResetAuthority({
        replayPlanAuthority: finalized.pairAuthority,
        role: 'distilled',
        runNamespace: input.distilled.runNamespace,
        trustedResetIssuer: runtimeCycleAdapter.resetIssuer,
      }));
      if (reset?.ok !== true || !reset.authority) throw new Error(stageReason(reset));

      const predecessor = await attempt(() => dualReplayApi.issuePredecessorGrant({
        receiptAuthority: sourceReceipt.authority,
      }));
      if (predecessor?.ok !== true || !predecessor.grant) throw new Error(stageReason(predecessor));

      const run = await attempt(() => dualReplayApi.authorizeDistilledReplay({
        pairAuthority: finalized.pairAuthority,
        role: 'distilled',
        runNamespace: input.distilled.runNamespace,
        sourceReceiptBytes: sourceReceipt.bytes,
        sourceReceiptAuthority: sourceReceipt.authority,
        predecessorGrant: predecessor.grant,
        resetAuthority: reset.authority,
        freshRuntimeAuthority: distilledPrepared.freshRuntimeAuthority,
        topologyAuthority: distilledPrepared.topologyAuthority,
        runtimeOwnerAuthority: distilledPrepared.runtimeOwnerAuthority,
        executionTargetAuthority: target,
      }));
      if (run?.ok !== true || !run.authority) throw new Error(stageReason(run));

      const completed = await attempt(() => dualReplayApi.completeAuthorizedReplay({
        runAuthority: run.authority,
        trustedReplayIssuer: runtimeCycleAdapter.atomReplayIssuer,
      }));
      if (completed?.ok !== true || !completed.completionAuthority) {
        throw new Error(stageReason(completed));
      }
      if (completed.distilledRuntimeOwnerAuthority !== distilledPrepared.runtimeOwnerAuthority) {
        throw new Error('REPLAY_RUNTIME_OWNERSHIP_MISMATCH');
      }

      stage = 'distilled-receipt';
      const receipt = await attempt(() => dualReplayApi.createSemanticReplayReceipt({
        completionAuthority: completed.completionAuthority,
      }));
      if (receipt?.ok !== true || !receipt.authority) throw new Error(stageReason(receipt));

      stage = 'pair-compare';
      const sourceComparison = await attempt(() => dualReplayApi.issueComparisonGrant({
        receiptAuthority: sourceReceipt.authority,
      }));
      if (sourceComparison?.ok !== true || !sourceComparison.grant) {
        throw new Error(stageReason(sourceComparison));
      }
      const distilledComparison = await attempt(() => dualReplayApi.issueComparisonGrant({
        receiptAuthority: receipt.authority,
      }));
      if (distilledComparison?.ok !== true || !distilledComparison.grant) {
        throw new Error(stageReason(distilledComparison));
      }

      // comparator 收 exact 7 键：两枚 receipt 的字节与 capability 必须与 comparison grant 同源，
      // 都取自 createSemanticReplayReceipt 已返回的产物，编排层不自造、不改写字节。
      const compared = await attempt(() => dualReplayApi.compareSemanticReplayReceipts({
        pairAuthority: finalized.pairAuthority,
        sourceReceiptBytes: sourceReceipt.bytes,
        sourceReceiptAuthority: sourceReceipt.authority,
        sourceComparisonGrant: sourceComparison.grant,
        distilledReceiptBytes: receipt.bytes,
        distilledReceiptAuthority: receipt.authority,
        distilledComparisonGrant: distilledComparison.grant,
      }));
      if (compared?.ok !== true || !compared.equivalenceReceipt) {
        throw new Error(stageReason(compared));
      }
      equivalenceReceipt = compared.equivalenceReceipt;
    } catch (error) {
      reason = typeof error?.message === 'string' && error.message ? error.message : STAGE_FAILED;
      reportStage(stage, reason);
    }

    // 23 exact distilled owner close：技术等价成立也必须先观察到关闭才发布结果。
    const closed = await closeOwner(distilledPrepared.runtimeOwnerAuthority);
    if (reason) return failure(reason);
    if (closed?.ok !== true) {
      reportStage('pair-compare', 'DISTILLED_RUNTIME_CLOSE_FAILED');
      return failure('DISTILLED_RUNTIME_CLOSE_FAILED');
    }
    return success(equivalenceReceipt);
  }

  return frozen({ runCycle });
}
