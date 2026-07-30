// 双回放 zero-SUT 共享 harness：只含合成对象/字节与依赖注入，不自行跑验收。
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolveExecutionTarget } from '../../../lib/execution-target/authority.mjs';
export const digest = (value) => `sha256:${createHash('sha256')
  .update(String(value)).digest('hex')}`;
export const bytes = (value) => Buffer.from(JSON.stringify(value));

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}
export function expectOk(result, label) {
  assert(result?.ok === true, `${label} 应成功：${JSON.stringify(result)}`);
  return result;
}
export function expectReason(result, reason, label) {
  assert(result?.ok === false && result.reason === reason,
    `${label} 应 ${reason}：${JSON.stringify(result)}`);
}
export let api;
export let resetApi;
export let freshApi;
export let captureApi;
export let rawRunnerApi;
export let projectionApi;
export let roundtripApi;
export let cycleApi;
export let loadFailure = null;
try {
  [api, resetApi, freshApi, captureApi, rawRunnerApi, projectionApi, roundtripApi, cycleApi] =
    await Promise.all([
      import('../../../lib/dual-replay/index.mjs'),
      import('../../../lib/dual-replay/run-authority.mjs'),
      import('../../../lib/teachin/fresh-runtime.mjs'),
      import('../../../lib/teachin/raw-capture.mjs'),
      import('../../../lib/teachin/raw-replay-runner.mjs'),
      import('../../../lib/teachin/resolved-projection.mjs'),
      import('../../../lib/teachin/atom-roundtrip.mjs'),
      import('../../../lib/teachin/runtime-cycle-adapter.mjs'),
    ]);
} catch (error) {
  loadFailure = String(error?.code || error?.message || error).slice(-500);
}

const REQUIRED = [
  'createSourceReplayPlanAuthority', 'authorizeSourceReplay',
  'executeAuthorizedSourceReplay', 'completeResolvedSourceReplay',
  'completeAuthorizedReplay', 'finalizeDualReplayPlanAuthority',
  'createSemanticReplayReceipt', 'issuePredecessorGrant',
  'issueComparisonGrant', 'authorizeDistilledReplay',
  'compareSemanticReplayReceipts',
];
export const ready = Boolean(api && resetApi && freshApi && captureApi && rawRunnerApi
  && projectionApi && roundtripApi && cycleApi
  && REQUIRED.every((name) => typeof api[name] === 'function')
  && typeof projectionApi.issueSourceSemanticGrant === 'function'
  && typeof projectionApi.issueAtomRoundtripGrant === 'function');
function emitter(extra = {}) {
  const listeners = new Map();
  return {
    ...extra,
    on(event, handler) {
      const entries = listeners.get(event) || [];
      entries.push(handler);
      listeners.set(event, entries);
    },
    emit(event) {
      for (const handler of listeners.get(event) || []) handler();
    },
  };
}

export function owners(label) {
  let connected = true;
  let contextClosed = false;
  let browserClosed = false;
  const browser = emitter({
    label,
    isConnected: () => connected,
    async close() {
      connected = false;
      browserClosed = true;
      browser.emit('disconnected');
    },
  });
  const context = emitter({
    browser: () => browser,
    async close() {
      contextClosed = true;
      context.emit('close');
    },
  });
  const page = emitter({ context: () => context, isClosed: () => false });
  return {
    browser,
    context,
    page,
    get closeCalls() { return contextClosed && browserClosed ? 1 : 0; },
    close() {
      contextClosed = true;
      context.emit('close');
      connected = false;
      browserClosed = true;
      browser.emit('disconnected');
    },
  };
}

export async function prepareFresh(adapter, recording, binding) {
  const prepared = expectOk(await adapter.prepareSourceReplayRuntime({
    runNamespace: binding.runNamespace,
    executionTargetAuthority: binding.executionTargetAuthority,
    recordingBrowser: recording.browser,
    recordingContext: recording.context,
  }), 'source runtime preparation');
  assert(recording.closeCalls === 1,
    'source prepare 必须先关闭 recording Context/Browser');
  assert(JSON.stringify(Object.keys(prepared).sort())
    === JSON.stringify(['ok', 'sourceRuntimePreparationAuthority']),
  `prepare 只能暴露 one-shot cap：${JSON.stringify(prepared)}`);
  return prepared;
}

export async function claimFresh(adapter, prepared, binding) {
  const claimed = expectOk(await adapter.claimPreparedSourceReplayRuntime({
    sourceRuntimePreparationAuthority: prepared.sourceRuntimePreparationAuthority,
    sourcePlanAuthority: binding.sourcePlanAuthority,
    runNamespace: binding.runNamespace,
    executionTargetAuthority: binding.executionTargetAuthority,
  }), 'source fresh/topology/owner claim');
  assert(JSON.stringify(Object.keys(claimed).sort()) === JSON.stringify([
    'freshRuntimeAuthority', 'ok', 'runtimeOwnerAuthority', 'topologyAuthority',
  ]), `claim 必须 exact 转移 trio：${JSON.stringify(claimed)}`);
  return claimed;
}

function target(tag) {
  return expectOk(resolveExecutionTarget({
    runtime: { platform: 'linux', isWSL: false },
    logicalTarget: { startUrl: `https://${tag}.synthetic.invalid/home` },
    transport: { mode: 'direct' },
    requiresOriginContinuity: true,
  }), 'execution target');
}

function authoredCase(tag) {
  return {
    schemaVersion: 1,
    caseId: `tc_${tag}`,
    title: '只读工作流导航',
    preconditions: ['已登录'],
    steps: [{ intentId: 'intent_1', intent: '进入工作流管理' }],
    uniquePrefix: 'atl_',
  };
}

function obligations(tag) {
  const predicate = digest(`${tag}:predicate`);
  return {
    intents: ['intent_1'],
    terminalHardPredicates: [{ intentId: 'intent_1', predicateSha256: predicate }],
    topology: [],
    entities: [],
    effects: [{
      intentId: 'intent_1',
      effectClass: 'read',
      evidenceRefs: [`predicate:${predicate}`],
      projectionSha256: digest(`${tag}:effect`),
    }],
    cleanup: {
      required: false,
      status: 'NOT_REQUIRED_READ_ONLY',
      policySha256: digest(`${tag}:cleanup`),
    },
  };
}

function evidence(tag) {
  const expected = obligations(tag);
  return {
    intents: [{ intentId: 'intent_1', verdict: 'PASS', reason: null }],
    terminalHardPredicates: [{ ...expected.terminalHardPredicates[0], ok: true }],
    topology: [],
    entities: [],
    effects: expected.effects.map((row) => ({
      ...row,
      evidenceRefs: [...row.evidenceRefs],
    })),
    cleanup: { ...expected.cleanup },
  };
}

function captureBytes(tag) {
  return bytes({
    schemaVersion: 1,
    artifactKind: 'teach-in-capture',
    caseId: `tc_${tag}`,
    createdAt: '2026-07-27T00:00:00.000Z',
    startPath: '/home',
    source: {
      kind: 'manual',
      signed: false,
      replayReady: false,
      distillRequired: true,
    },
    events: [{
      seq: 1,
      action: 'click',
      path: '/home',
      selector: '#workflow-management',
      text: '工作流管理',
    }],
  });
}

function sourceInput(tag, execution, admitted, rawBytes, expected) {
  return {
    pairId: `pair_${tag}`,
    testcaseBytes: bytes(authoredCase(tag)),
    expectedBytes: bytes({ caseId: `tc_${tag}`, intents: [{ intentId: 'intent_1', expected: [] }] }),
    expectedObligations: expected,
    sutBuildDigest: digest(`${tag}:build`),
    channelProfileDigest: digest(`${tag}:channel`),
    identityProfileDigest: digest(`${tag}:identity`),
    replayKernelDigest: digest(`${tag}:kernel`),
    resetPlanDigest: digest(`${tag}:reset-plan`),
    sessionPolicyDigest: digest(`${tag}:session-policy`),
    executionTargetAuthority: execution.authority,
    source: {
      captureAuthority: admitted.captureAuthority,
      candidateBytes: bytes({ tag, role: 'source', candidate: 'raw' }),
      eventsBytes: rawBytes,
      entityLockBytes: Buffer.from('[]', 'utf8'),
      runNamespace: `run_source_${tag}`,
    },
  };
}

function resetFacts(tag, role, runNamespace) {
  const resetPlanDigest = digest(`${tag}:reset-plan`);
  const baselineProjectionSha256 = digest(`${tag}:baseline`);
  return {
    resetReceiptBytes: bytes({
      schemaVersion: 1,
      artifactKind: 'dual-replay-reset-receipt',
      pairId: `pair_${tag}`,
      role,
      runNamespace,
      receiptInstanceId: `reset_${tag}_${role}`,
      resetPlanDigest,
      baselineProjectionSha256,
    }),
    resetPlanDigest,
    baselineProjectionSha256,
  };
}

const atomRegistry = JSON.parse(readFileSync(
  new URL('../../../lib/atoms-registry.snapshot.json', import.meta.url),
  'utf8',
));

export function makeAdapter(tag, stats, options = {}) {
  let closeStep = 0;
  let lifecycleStep = 0;
  return cycleApi.createRuntimeCycleAdapter({
    runtimeBootstrap: {
      async openRuntime(input) {
        const openStep = ++lifecycleStep;
        assert(closeStep > 0 && closeStep < openStep,
          'source open 必须晚于 recording close/disconnected');
        assert(JSON.stringify(Object.keys(input).sort()) === JSON.stringify([
          'executionTargetAuthority', 'role',
        ])
          && input.role === 'source',
        'source bootstrap 必须 exact {role,executionTargetAuthority}');
        const replay = owners(`source-${tag}-${stats.sourceOpen + 1}`);
        stats.sourceOpen += 1; stats.sourceOwners = replay;
        return {
          ok: true,
          runtime: {
            browser: replay.browser, context: replay.context, page: replay.page,
            topology: Object.freeze(Object.create(null)),
            forensics: Object.freeze(Object.create(null)), originAdmission: async () => true,
          },
        };
      },
    },
    async runRawReplay(input) {
      stats.rawReplay += 1;
      const actions = new WeakMap();
      return rawRunnerApi.runRawReplay({
        ...input,
        actionDriver: {
          async readActivePath() { return '/home'; },
          async resolve({ event }) {
            const actionAuthority = Object.freeze(Object.create(null));
            actions.set(actionAuthority, event);
            return { resolution: 'unique', candidateCount: 1, actionAuthority };
          },
          async perform({ actionAuthority }) {
            assert(actions.has(actionAuthority), 'perform 必须收到 resolve authority');
            actions.delete(actionAuthority);
            return { ok: true, identityReadback: { ok: true } };
          },
          async goto() { throw new Error('RAW_NAV_MUST_NOT_GOTO'); },
        },
      });
    },
    async runAtomRoundtrip(input) {
      stats.atomRoundtrip += 1;
      return roundtripApi.runAtomRoundtrip(input);
    },
    verifyRuntimeEntityLock({ authority, caseId, eventsBytes, verificationScopeAuthority }) {
      stats.entityVerify += 1;
      if ((options.entityMode === 'runtime-required' && authority !== options.entityLockAuthority)
        || (options.entityMode !== 'runtime-required' && authority !== undefined)) {
        return { ok: false, reason: 'ENTITY_LOCK_AUTHORITY_INVALID' };
      }
      assert(caseId === `tc_${tag}` && Buffer.isBuffer(eventsBytes) && verificationScopeAuthority,
        'entity lock verifier 必须收到 roundtrip canonical case/events bytes');
      return {
        ok: true, handle: options.entityLockHandle,
        mode: options.entityMode || 'not-required',
        runtimeAuthorized: options.entityMode === 'runtime-required' && options.entityRuntimeAuthorized !== false,
        setSha256: options.entitySetSha256
          || digest(Buffer.from('[]', 'utf8')),
      };
    },
    async runCompiledReplay(input) {
      stats.compiledReplay += 1;
      const consumed = freshApi.consumeFreshReplayRuntimeAuthority({
        freshRuntimeAuthority: input.freshRuntimeAuthority,
        topologyAuthority: input.topologyAuthority,
      });
      if (consumed?.ok !== true) return consumed;
      return { ok: true, observations: [{ intentId: 'intent_1', reached: true }] };
    },
    projectAxes({ role }) {
      stats.axes += 1;
      return { role, evidence: options[`${role}Evidence`] || evidence(tag) };
    },
    runVerdict({ role }) {
      stats.verdict += 1;
      const decision = options[`${role}Verdict`] || { verdict: 'PASS', reason: null };
      return { steps: [{ intentId: 'intent_1', ...decision }] };
    },
    verifyReset({ role, runNamespace }) {
      stats.reset += 1;
      if (role === 'distilled') stats.distilledNamespace = runNamespace;
      return resetFacts(tag, role, runNamespace);
    },
    verifyAuthoringReset({ runNamespace }) {
      stats.authoringReset += 1;
      stats.authoringNamespace = runNamespace;
      return resetFacts(tag, 'authoring', runNamespace);
    },
    createCompileRun(input) {
      stats.createCompileRun += 1;
      return { ...input, compileRun: true };
    },
    async compileFlow(run) {
      stats.compileFlow += 1;
      assert(run?.compileRun === true, 'compileFlow 必须收到 createCompileRun 结果');
      return { ok: true, events: [{ intentId: 'intent_1', action: 'click' }] };
    },
    async closeRuntimeOwners({ browser, context }) {
      await context.close();
      await browser.close();
      closeStep = ++lifecycleStep;
      return { ok: true };
    },
    async openFreshAuthoringRuntime() {
      stats.authoringOpen += 1;
      const replay = owners(`authoring-${tag}`);
      stats.authoringOwners = replay;
      return {
        ok: true,
        replayBrowser: replay.browser,
        replayContext: replay.context,
        replayPage: replay.page,
        topologyAuthority: Object.freeze(Object.create(null)),
      };
    },
    async openFreshReplayRuntime() {
      stats.distilledOpen += 1;
      const replay = owners(`distilled-${tag}`);
      stats.distilledOwners = replay;
      return {
        ok: true,
        replayBrowser: replay.browser,
        replayContext: replay.context,
        replayPage: replay.page,
        topologyAuthority: Object.freeze(Object.create(null)),
      };
    },
  });
}

function resolveSource(tag, admitted, sourceExecution) {
  const resolved = expectOk(projectionApi.resolveCaptureProjection({
    captureAuthority: admitted.captureAuthority,
    cleanProofAuthority: sourceExecution.cleanProofAuthority,
    mappingCandidate: [{
      intentId: 'intent_1',
      atom: 'nav.workflowManagement',
      params: {},
      evidenceEventSeqs: [1],
    }],
    atomRegistry,
    authoredTestCase: authoredCase(tag),
  }), 'resolved source projection');
  const sourceSemantic = expectOk(projectionApi.issueSourceSemanticGrant({
    resolutionAuthority: resolved.resolutionAuthority,
  }), 'source semantic grant');
  return { resolved, sourceSemantic };
}

export async function buildHappy(tag, options = {}) {
  const stats = {
    rawReplay: 0, atomRoundtrip: 0, compiledReplay: 0, axes: 0, verdict: 0, reset: 0,
    authoringOpen: 0, authoringReset: 0, createCompileRun: 0, compileFlow: 0,
    distilledOpen: 0, entityVerify: 0, sourceOpen: 0,
  };
  const entityLockAuthority = Object.freeze(Object.create(null));
  const entityLockHandle = Object.freeze(Object.create(null));
  const adapter = makeAdapter(tag, stats, {
    ...options, entityLockAuthority, entityLockHandle,
  });
  const execution = target(tag);
  const rawBytes = captureBytes(tag);
  const admitted = expectOk(captureApi.admitRawReplayCapture({
    caseId: `tc_${tag}`,
    captureBytes: rawBytes,
  }), 'raw capture');
  const input = sourceInput(tag, execution, admitted, rawBytes,
    options.expectedObligations || obligations(tag));
  const manual = owners('manual-recording');
  const sourcePrepared = await prepareFresh(adapter, manual, {
    runNamespace: `run_source_${tag}`,
    executionTargetAuthority: execution.authority,
  });
  const sourceOwners = stats.sourceOwners;
  const sourcePlan = expectOk(api.createSourceReplayPlanAuthority(input), 'source plan');
  const sourceFresh = await claimFresh(adapter, sourcePrepared, {
    sourcePlanAuthority: sourcePlan.authority,
    runNamespace: `run_source_${tag}`,
    executionTargetAuthority: execution.authority,
  });
  const sourceReset = expectOk(resetApi.createResetAuthority({
    replayPlanAuthority: sourcePlan.authority,
    role: 'source',
    runNamespace: `run_source_${tag}`,
    trustedResetIssuer: adapter.resetIssuer,
  }), 'source reset');
  const sourceRun = expectOk(api.authorizeSourceReplay({
    sourcePlanAuthority: sourcePlan.authority,
    role: 'source',
    runNamespace: `run_source_${tag}`,
    resetAuthority: sourceReset.authority,
    freshRuntimeAuthority: sourceFresh.freshRuntimeAuthority,
    topologyAuthority: sourceFresh.topologyAuthority,
    runtimeOwnerAuthority: sourceFresh.runtimeOwnerAuthority,
    executionTargetAuthority: execution.authority,
  }), 'source run');
  if (options.stopBeforeSourceExecution === true) {
    return {
      stats, adapter, execution, input, sourcePlan, sourceRun,
      sourceOwners, sourceFresh,
    };
  }
  const sourceExecution = expectOk(await api.executeAuthorizedSourceReplay({
    runAuthority: sourceRun.authority,
    trustedRawReplayIssuer: adapter.rawReplayIssuer,
  }), 'source raw execution');
  assert(sourceExecution.sourceRuntimeOwnerAuthority === sourceFresh.runtimeOwnerAuthority,
    'source raw execution 必须原样转移 owner');
  const resolution = resolveSource(tag, admitted, sourceExecution);
  if (options.stopBeforeSourceSemanticCompletion === true) {
    return {
      stats, adapter, execution, input, sourcePlan, sourceExecution,
      sourceOwners, sourceFresh, resolution,
    };
  }
  const sourceCompletionResult = await api.completeResolvedSourceReplay({
    rawExecutionAuthority: sourceExecution.rawExecutionAuthority,
    sourceSemanticGrant: resolution.sourceSemantic.grant,
    trustedResolvedSourceIssuer: adapter.resolvedSourceIssuer,
  });
  if (options.returnSourceCompletionResult === true) {
    await adapter.closeReplayRuntimeOwners({
      runtimeOwnerAuthority: sourceExecution.sourceRuntimeOwnerAuthority,
    });
    return {
      stats, adapter, execution, input, sourcePlan, sourceExecution,
      sourceCompletionResult, sourceOwners,
    };
  }
  const sourceCompleted = expectOk(sourceCompletionResult, 'resolved source completion');
  resolution.atomRoundtrip = expectOk(projectionApi.issueAtomRoundtripGrant({
    resolutionAuthority: resolution.resolved.resolutionAuthority,
  }), 'atom roundtrip grant');
  assert(sourceCompleted.authoringBaselineGrant,
    'resolved source completion 必须返回 opaque authoring baseline grant');
  if (options.stopAfterSource === true) {
    return {
      stats, adapter, execution, input, sourcePlan, sourceExecution,
      sourceCompleted, sourceOwners, sourceFresh, resolution, entityLockAuthority,
    };
  }
  const sourceClosed = expectOk(await adapter.closeReplayRuntimeOwners({
    runtimeOwnerAuthority: sourceExecution.sourceRuntimeOwnerAuthority,
  }), 'source owner close before authoring');
  const distilledCandidate = expectOk(await adapter.runAndSealDistilledCandidate({
    atomRoundtripGrant: resolution.atomRoundtrip.grant,
    sourceClosureAuthority: sourceClosed.sourceClosureAuthority,
    authoringBaselineGrant: sourceCompleted.authoringBaselineGrant,
    runNamespace: `run_authoring_${tag}`,
    ...(options.entityMode === 'runtime-required' ? { entityLockAuthority } : {}),
    executionTargetAuthority: execution.authority,
  }), 'distilled candidate authority');
  assert(distilledCandidate.authoringClosureAuthority,
    'guided compile authoring runtime 必须返回 closure authority');
  const finalized = expectOk(api.finalizeDualReplayPlanAuthority({
    sourcePlanAuthority: sourcePlan.authority,
    sourceCompletionAuthority: sourceCompleted.completionAuthority,
    distilledCandidateAuthority: distilledCandidate.distilledCandidateAuthority,
  }), 'pair finalization');
  const sourceReceipt = expectOk(api.createSemanticReplayReceipt({
    completionAuthority: finalized.pairBoundSourceCompletionAuthority,
  }), 'source semantic receipt');
  const distilledFresh = expectOk(await adapter.prepareDistilledReplayRuntime({
    authoringClosureAuthority: distilledCandidate.authoringClosureAuthority,
    pairAuthority: finalized.pairAuthority,
    runNamespace: `run_distilled_${tag}`,
    executionTargetAuthority: execution.authority,
  }), 'distilled fresh prepare');
  const distilledReset = expectOk(resetApi.createResetAuthority({
    replayPlanAuthority: finalized.pairAuthority,
    role: 'distilled',
    runNamespace: `run_distilled_${tag}`,
    trustedResetIssuer: adapter.resetIssuer,
  }), 'distilled reset');
  const predecessor = expectOk(api.issuePredecessorGrant({
    receiptAuthority: sourceReceipt.authority,
  }), 'source predecessor grant');
  const distilledRun = expectOk(api.authorizeDistilledReplay({
    pairAuthority: finalized.pairAuthority,
    role: 'distilled',
    runNamespace: `run_distilled_${tag}`,
    sourceReceiptBytes: sourceReceipt.bytes,
    sourceReceiptAuthority: sourceReceipt.authority,
    predecessorGrant: predecessor.grant,
    resetAuthority: distilledReset.authority,
    freshRuntimeAuthority: distilledFresh.freshRuntimeAuthority,
    topologyAuthority: distilledFresh.topologyAuthority,
    runtimeOwnerAuthority: distilledFresh.runtimeOwnerAuthority,
    executionTargetAuthority: execution.authority,
  }), 'distilled run');
  if (options.stopBeforeDistilledCompletion === true) {
    return {
      stats, adapter, execution, input, sourcePlan, sourceExecution, sourceCompleted,
      sourceReceipt, finalized, distilledFresh, distilledRun,
    };
  }
  const distilledCompletionResult = await api.completeAuthorizedReplay({
    runAuthority: distilledRun.authority,
    trustedReplayIssuer: adapter.atomReplayIssuer,
  });
  if (options.returnDistilledCompletionResult === true) {
    await adapter.closeReplayRuntimeOwners({
      runtimeOwnerAuthority: distilledCompletionResult?.distilledRuntimeOwnerAuthority
        || distilledFresh.runtimeOwnerAuthority,
    });
    return {
      stats, adapter, execution, input, sourcePlan, sourceExecution, sourceCompleted,
      sourceOwners, sourceReceipt, finalized, distilledFresh, distilledCompletionResult,
    };
  }
  const distilledCompleted = expectOk(distilledCompletionResult, 'distilled completion');
  assert(distilledCompleted.distilledRuntimeOwnerAuthority
    === distilledFresh.runtimeOwnerAuthority,
  'distilled completion 必须原样转移 run-bound owner authority');
  const distilledReceipt = expectOk(api.createSemanticReplayReceipt({
    completionAuthority: distilledCompleted.completionAuthority,
  }), 'distilled semantic receipt');
  const sourceComparison = expectOk(api.issueComparisonGrant({
    receiptAuthority: sourceReceipt.authority,
  }), 'source comparison grant');
  const distilledComparison = expectOk(api.issueComparisonGrant({
    receiptAuthority: distilledReceipt.authority,
  }), 'distilled comparison grant');
  return {
    stats, adapter, execution, input, sourcePlan, sourceExecution, sourceCompleted,
    sourceOwners, sourceReceipt, finalized, distilledCompleted, distilledReceipt,
    sourceComparison, distilledComparison, entityLockAuthority,
  };
}
