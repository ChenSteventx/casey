#!/usr/bin/env node
// Complete S5 23-step authority orchestration; memory doubles only, zero SUT/browser/network/LLM.

const TAG = 'teachin-replayability-orchestrator';
const failures = [];
let passed = 0;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const same = (actual, expected, message) => assert(actual === expected, message);
const tok = (label) => Object.freeze(Object.assign(Object.create(null), { label }));

async function check(name, fn) {
  try { await fn(); passed += 1; console.log(`ok   ${TAG}: ${name}`); }
  catch (error) {
    const detail = String(error?.message || error).slice(-900);
    failures.push(`${name}: ${detail}`);
    console.error(`RED  ${TAG}: ${name}: ${detail}`);
  }
}

let coreApi;
try { coreApi = await import('../../lib/teachin/dual-replay-orchestrator-core.mjs'); }
catch (error) {
  failures.push(`production core unavailable: ${String(
    error?.code || error?.message || error,
  ).slice(-500)}`);
}

function expectFailure(result, reason, label) {
  assert(Object.keys(result || {}).sort().join(',')
    === 'developmentOnly,ok,promotionReady,reason'
    && result?.ok === false && result.developmentOnly === true
    && result.promotionReady === false && (!reason || result.reason === reason)
    && !Object.hasOwn(result, 'equivalenceReceipt'),
  `${label}: ${JSON.stringify(result)}`);
}

function cycleInput(h) {
  return {
    sourcePlan: {
      pairId: 'pair_orchestrator',
      testcaseBytes: Buffer.from('{"caseId":"tc_orchestrator"}'),
      expectedBytes: Buffer.from('{"caseId":"tc_orchestrator","intents":[]}'),
      expectedObligations: { intents: ['intent_1'] },
      sutBuildDigest: `sha256:${'a'.repeat(64)}`,
      channelProfileDigest: `sha256:${'b'.repeat(64)}`,
      identityProfileDigest: `sha256:${'c'.repeat(64)}`,
      replayKernelDigest: `sha256:${'d'.repeat(64)}`,
      resetPlanDigest: `sha256:${'e'.repeat(64)}`,
      sessionPolicyDigest: `sha256:${'f'.repeat(64)}`,
      source: {
        captureAuthority: h.t.capture,
        candidateBytes: Buffer.from('{}'),
        eventsBytes: Buffer.from('[]'),
        entityLockBytes: Buffer.from('[]'),
        runNamespace: 'run_source_orchestrator',
      },
    },
    executionTargetAuthority: h.t.target,
    sourceRuntime: { sourceRuntimePreparationAuthority: h.t.preparation },
    projection: {
      mappingCandidate: [{
        intentId: 'intent_1', atom: 'nav.workflowManagement',
        params: {}, evidenceEventSeqs: [1],
      }],
      authoredTestCase: { caseId: 'tc_orchestrator', steps: [{ intentId: 'intent_1' }] },
    },
    distilled: {
      authoringRunNamespace: 'run_authoring_orchestrator',
      runNamespace: 'run_distilled_orchestrator',
    },
  };
}

const SUCCESS_ORDER = [
  'source.plan', 'source.claim', 'source.reset', 'source.authorize', 'source.execute',
  'projection.resolve', 'source.semanticGrant', 'source.completeResolved',
  'atom.roundtripGrant', 'source.close', 'authoring.runSeal', 'pair.finalize',
  'source.receipt', 'distilled.prepare', 'distilled.reset', 'source.predecessor',
  'distilled.authorize', 'distilled.complete', 'distilled.receipt',
  'source.comparison', 'distilled.comparison', 'compare', 'distilled.close',
];

function makeHarness(options = {}) {
  const { failAt, throwAt, malformedAt, ownerMismatchAt,
    disposeFails = false, authoringCloseFails = false } = options;
  const order = [];
  const calls = Object.fromEntries([
    'dispose', 'sourceClose', 'distilledClose', 'rawIssuer', 'resolvedIssuer',
    'atomIssuer', 'authoringOpen', 'authoringReset', 'authoringCompile',
    'authoringClose', 'distilledPrepare', 'distilledPartialClose',
  ].map((key) => [key, 0]));
  const names = [
    'preparation', 'target', 'capture', 'sourcePlan', 'sourceFresh',
    'sourceTopology', 'sourceOwner', 'sourceReset', 'sourceRun', 'rawExecution',
    'cleanProof', 'rawObservation', 'resolution', 'resolvedProjection',
    'sourceSemanticGrant', 'atomRoundtripGrant', 'sourceCompletion',
    'authoringBaselineGrant', 'sourceClosure', 'candidate', 'authoringClosure',
    'pair', 'pairSourceCompletion', 'sourceReceiptAuthority', 'distilledFresh',
    'distilledTopology', 'distilledOwner', 'distilledReset', 'predecessorGrant',
    'distilledRun', 'distilledCompletion', 'distilledReceiptAuthority',
    'sourceComparisonGrant', 'distilledComparisonGrant',
  ];
  const t = Object.fromEntries(names.map((name) => [name, tok(name)]));
  const sourceReceiptBytes = Buffer.from('{"role":"source"}');
  const distilledReceiptBytes = Buffer.from('{"role":"distilled"}');
  const equivalenceReceipt = Object.freeze({
    schemaVersion: 1, artifactKind: 'dual-replay-equivalence-receipt',
    pairId: 'pair_orchestrator', scope: 'read-only-v1',
    sourceReceiptSha256: `sha256:${'1'.repeat(64)}`,
    distilledReceiptSha256: `sha256:${'2'.repeat(64)}`,
    comparedDimensions: ['intent-verdict', 'terminal-hard-predicate', 'topology',
      'entity', 'effect', 'cleanup'],
  });
  const atomRegistry = Object.freeze({
    'nav.workflowManagement': Object.freeze({ effect: 'read' }),
  });

  function stage(name, build) {
    order.push(name);
    if (throwAt === name) throw new Error('SECRET_EXCEPTION_MUST_NOT_LEAK');
    if (failAt === name) return { ok: false, reason: 'ORCHESTRATOR_TEST_STAGE_FAILED' };
    if (malformedAt === name) return { ok: true };
    return build();
  }

  const runtimeCycleAdapter = {
    resetIssuer: tok('canonical-reset-issuer'),
    rawReplayIssuer: {
      kind: 'raw',
      async executeAndVerify({ runExecutionAuthority }) {
        calls.rawIssuer += 1; assert(runExecutionAuthority, 'raw execution cap missing');
        return {
          ok: true, runExecutionAuthority, runtimeOwnerAuthority: t.sourceOwner,
          rawObservationAuthority: t.rawObservation,
          artifacts: { candidateBytes: Buffer.from('{}'), eventsBytes: Buffer.from('[]'),
            entityLockBytes: Buffer.from('[]') },
          rawReplay: { status: 'CLEAN', cleanProofAuthority: t.cleanProof },
        };
      },
    },
    resolvedSourceIssuer: {
      kind: 'resolved-source',
      async projectAndVerify(x) {
        calls.resolvedIssuer += 1;
        same(x.rawObservationAuthority, t.rawObservation, 'raw observation swap');
        same(x.resolvedProjectionAuthority, t.resolvedProjection, 'projection swap');
        return {
          ok: true, ...x, axesBytes: Buffer.from('{}'), verdictBytes: Buffer.from('{}'),
          evidence: Object.freeze({ intents: [] }),
        };
      },
    },
    atomReplayIssuer: {
      kind: 'atom',
      async executeAndVerify({ runExecutionAuthority }) {
        calls.atomIssuer += 1; assert(runExecutionAuthority, 'atom execution cap missing');
        return {
          ok: true, runExecutionAuthority, runtimeOwnerAuthority: t.distilledOwner,
          artifacts: { candidateBytes: Buffer.from('{}'), eventsBytes: Buffer.from('[]'),
            entityLockBytes: Buffer.from('[]') },
          axesBytes: Buffer.from('{}'), verdictBytes: Buffer.from('{}'),
          evidence: Object.freeze({ intents: [] }),
        };
      },
    },
    prepareSourceReplayRuntime() { throw new Error('CORE_MUST_NOT_PREPARE_SOURCE'); },
    claimPreparedSourceReplayRuntime(x) {
      return stage('source.claim', () => {
        same(x.sourceRuntimePreparationAuthority, t.preparation, 'prep swap');
        same(x.sourcePlanAuthority, t.sourcePlan, 'plan swap');
        same(x.runNamespace, 'run_source_orchestrator', 'source ns swap');
        same(x.executionTargetAuthority, t.target, 'target swap');
        return { ok: true, freshRuntimeAuthority: t.sourceFresh,
          topologyAuthority: t.sourceTopology, runtimeOwnerAuthority: t.sourceOwner };
      });
    },
    disposePreparedSourceReplayRuntime({ sourceRuntimePreparationAuthority }) {
      order.push('source.dispose'); calls.dispose += 1;
      same(sourceRuntimePreparationAuthority, t.preparation, 'dispose foreign prep');
      return disposeFails ? { ok: false, reason: 'PRIVATE_DISPOSE_REASON' } : { ok: true };
    },
    closeReplayRuntimeOwners({ runtimeOwnerAuthority }) {
      if (runtimeOwnerAuthority === t.sourceOwner) {
        calls.sourceClose += 1;
        return stage('source.close', () => ({
          ok: true, sourceClosureAuthority: t.sourceClosure,
        }));
      }
      if (runtimeOwnerAuthority === t.distilledOwner) {
        calls.distilledClose += 1;
        return stage('distilled.close', () => ({ ok: true }));
      }
      throw new Error('CORE_CLOSED_FOREIGN_OWNER');
    },
    async runAndSealDistilledCandidate(x) {
      order.push('authoring.runSeal'); calls.authoringOpen += 1;
      try {
        same(x.atomRoundtripGrant, t.atomRoundtripGrant, 'atom grant swap');
        same(x.authoringBaselineGrant, t.authoringBaselineGrant, 'baseline swap');
        same(x.sourceClosureAuthority, t.sourceClosure, 'source closure swap');
        same(x.runNamespace, 'run_authoring_orchestrator', 'authoring ns swap');
        assert(!Object.hasOwn(x, 'entityLockAuthority'),
          'no-entity 首发不得由 caller 注入 entity authority');
        same(x.executionTargetAuthority, t.target, 'authoring target swap');
        assert(!Object.hasOwn(x, 'compileAdapter')
          && !Object.hasOwn(x, 'resolutionAuthority'), 'free compile/resolution');
        if (throwAt === 'authoring.runSeal') throw new Error('SECRET_EXCEPTION_MUST_NOT_LEAK');
        if (failAt === 'authoring.runSeal') {
          return { ok: false, reason: 'ORCHESTRATOR_TEST_STAGE_FAILED' };
        }
        calls.authoringReset += 1; calls.authoringCompile += 1;
        if (malformedAt === 'authoring.runSeal') return { ok: true };
        if (authoringCloseFails) {
          return { ok: false, reason: 'AUTHORING_RUNTIME_CLOSE_FAILED' };
        }
        return { ok: true, distilledCandidateAuthority: t.candidate,
          authoringClosureAuthority: t.authoringClosure };
      } finally { calls.authoringClose += 1; }
    },
    prepareDistilledReplayRuntime(x) {
      order.push('distilled.prepare'); calls.distilledPrepare += 1;
      same(x.authoringClosureAuthority, t.authoringClosure, 'authoring closure swap');
      assert(!Object.hasOwn(x, 'sourceClosureAuthority'), 'source closure reached distilled');
      same(x.pairAuthority, t.pair, 'pair swap');
      same(x.runNamespace, 'run_distilled_orchestrator', 'distilled ns swap');
      same(x.executionTargetAuthority, t.target, 'distilled target swap');
      if (['distilled.prepare'].includes(throwAt)) {
        calls.distilledPartialClose += 1; throw new Error('SECRET_EXCEPTION_MUST_NOT_LEAK');
      }
      if (failAt === 'distilled.prepare') {
        calls.distilledPartialClose += 1;
        return { ok: false, reason: 'ORCHESTRATOR_TEST_STAGE_FAILED' };
      }
      if (malformedAt === 'distilled.prepare') {
        calls.distilledPartialClose += 1; return { ok: true };
      }
      return { ok: true, freshRuntimeAuthority: t.distilledFresh,
        topologyAuthority: t.distilledTopology, runtimeOwnerAuthority: t.distilledOwner };
    },
  };

  const dualReplayApi = {
    createSourceReplayPlanAuthority(x) {
      return stage('source.plan', () => {
        same(x.executionTargetAuthority, t.target, 'plan target swap');
        same(x.source.captureAuthority, t.capture, 'capture swap');
        return { ok: true, authority: t.sourcePlan, receipt: {} };
      });
    },
    authorizeSourceReplay(x) {
      return stage('source.authorize', () => {
        same(x.sourcePlanAuthority, t.sourcePlan, 'source plan swap');
        same(x.resetAuthority, t.sourceReset, 'source reset swap');
        same(x.freshRuntimeAuthority, t.sourceFresh, 'source fresh swap');
        same(x.topologyAuthority, t.sourceTopology, 'source topology swap');
        same(x.runtimeOwnerAuthority, t.sourceOwner, 'source owner swap');
        same(x.executionTargetAuthority, t.target, 'source target swap');
        return { ok: true, authority: t.sourceRun };
      });
    },
    async executeAuthorizedSourceReplay(x) {
      return stage('source.execute', async () => {
        same(x.runAuthority, t.sourceRun, 'source run swap');
        same(x.trustedRawReplayIssuer, runtimeCycleAdapter.rawReplayIssuer, 'raw issuer swap');
        await x.trustedRawReplayIssuer.executeAndVerify({ runExecutionAuthority: tok('src-exec') });
        return { ok: true, rawExecutionAuthority: t.rawExecution,
          cleanProofAuthority: t.cleanProof,
          sourceRuntimeOwnerAuthority: ownerMismatchAt === 'source'
            ? tok('foreign-source-owner') : t.sourceOwner };
      });
    },
    async completeResolvedSourceReplay(x) {
      return stage('source.completeResolved', async () => {
        same(x.rawExecutionAuthority, t.rawExecution, 'raw execution swap');
        same(x.sourceSemanticGrant, t.sourceSemanticGrant, 'semantic grant swap');
        same(x.trustedResolvedSourceIssuer, runtimeCycleAdapter.resolvedSourceIssuer,
          'resolved issuer swap');
        await x.trustedResolvedSourceIssuer.projectAndVerify({
          rawObservationAuthority: t.rawObservation,
          resolvedProjectionAuthority: t.resolvedProjection,
        });
        return { ok: true, completionAuthority: t.sourceCompletion,
          authoringBaselineGrant: t.authoringBaselineGrant };
      });
    },
    finalizeDualReplayPlanAuthority(x) {
      return stage('pair.finalize', () => {
        same(x.sourcePlanAuthority, t.sourcePlan, 'final plan swap');
        same(x.sourceCompletionAuthority, t.sourceCompletion, 'final source swap');
        same(x.distilledCandidateAuthority, t.candidate, 'candidate swap');
        assert(!Object.hasOwn(x, 'candidateBytes'), 'free candidate bytes');
        return { ok: true, pairAuthority: t.pair,
          pairBoundSourceCompletionAuthority: t.pairSourceCompletion, receipt: {} };
      });
    },
    createSemanticReplayReceipt({ completionAuthority }) {
      const source = completionAuthority === t.pairSourceCompletion;
      return stage(source ? 'source.receipt' : 'distilled.receipt', () => {
        assert(source || completionAuthority === t.distilledCompletion, 'receipt swap');
        return source
          ? { ok: true, bytes: sourceReceiptBytes, receipt: { role: 'source' },
            authority: t.sourceReceiptAuthority }
          : { ok: true, bytes: distilledReceiptBytes, receipt: { role: 'distilled' },
            authority: t.distilledReceiptAuthority };
      });
    },
    issuePredecessorGrant({ receiptAuthority }) {
      return stage('source.predecessor', () => {
        same(receiptAuthority, t.sourceReceiptAuthority, 'predecessor swap');
        return { ok: true, grant: t.predecessorGrant };
      });
    },
    authorizeDistilledReplay(x) {
      return stage('distilled.authorize', () => {
        same(x.pairAuthority, t.pair, 'distilled pair swap');
        same(x.sourceReceiptBytes, sourceReceiptBytes, 'source receipt bytes swap');
        same(x.sourceReceiptAuthority, t.sourceReceiptAuthority, 'source receipt cap swap');
        same(x.predecessorGrant, t.predecessorGrant, 'predecessor swap');
        same(x.resetAuthority, t.distilledReset, 'distilled reset swap');
        same(x.freshRuntimeAuthority, t.distilledFresh, 'distilled fresh swap');
        same(x.topologyAuthority, t.distilledTopology, 'distilled topology swap');
        same(x.runtimeOwnerAuthority, t.distilledOwner, 'distilled owner swap');
        return { ok: true, authority: t.distilledRun };
      });
    },
    async completeAuthorizedReplay(x) {
      return stage('distilled.complete', async () => {
        same(x.runAuthority, t.distilledRun, 'distilled run swap');
        same(x.trustedReplayIssuer, runtimeCycleAdapter.atomReplayIssuer, 'atom issuer swap');
        await x.trustedReplayIssuer.executeAndVerify({ runExecutionAuthority: tok('dst-exec') });
        return { ok: true, completionAuthority: t.distilledCompletion,
          distilledRuntimeOwnerAuthority: ownerMismatchAt === 'distilled'
            ? tok('foreign-distilled-owner') : t.distilledOwner };
      });
    },
    issueComparisonGrant({ receiptAuthority }) {
      const source = receiptAuthority === t.sourceReceiptAuthority;
      return stage(source ? 'source.comparison' : 'distilled.comparison', () => {
        assert(source || receiptAuthority === t.distilledReceiptAuthority, 'comparison swap');
        return { ok: true, grant: source
          ? t.sourceComparisonGrant : t.distilledComparisonGrant };
      });
    },
    compareSemanticReplayReceipts(x) {
      return stage('compare', () => {
        // comparator exact 7 键合同（lib/dual-replay/comparator.mjs INPUT_KEYS）：
        // 生产调用少键/多键在真 comparator 处必拒，mock 必须同样闭合，否则测不出。
        assert(Object.keys(x).sort().join(',') === [
          'distilledComparisonGrant', 'distilledReceiptAuthority', 'distilledReceiptBytes',
          'pairAuthority', 'sourceComparisonGrant', 'sourceReceiptAuthority',
          'sourceReceiptBytes',
        ].join(','), `compare 输入面不闭合：${Object.keys(x).sort()}`);
        same(x.pairAuthority, t.pair, 'compare pair swap');
        // 四项绑定一致：bytes 与 authority 各自对准本 role 的 canonical 单例，
        // 身份相等同时钉死「同源」与「source/distilled 不串」。
        same(x.sourceReceiptBytes, sourceReceiptBytes, 'compare source bytes swap');
        same(x.sourceReceiptAuthority, t.sourceReceiptAuthority, 'compare source cap swap');
        same(x.distilledReceiptBytes, distilledReceiptBytes, 'compare distilled bytes swap');
        same(x.distilledReceiptAuthority, t.distilledReceiptAuthority,
          'compare distilled cap swap');
        same(x.sourceComparisonGrant, t.sourceComparisonGrant, 'source comparison swap');
        same(x.distilledComparisonGrant, t.distilledComparisonGrant,
          'distilled comparison swap');
        return { ok: true, equivalent: true, promotionEligible: true,
          reason: null, equivalenceReceipt };
      });
    },
  };

  const runAuthorityApi = {
    createResetAuthority(x) {
      return stage(`${x.role}.reset`, () => {
        same(x.trustedResetIssuer, runtimeCycleAdapter.resetIssuer, 'reset issuer swap');
        same(x.replayPlanAuthority, x.role === 'source' ? t.sourcePlan : t.pair,
          'reset plan swap');
        same(x.runNamespace, x.role === 'source'
          ? 'run_source_orchestrator' : 'run_distilled_orchestrator', 'reset ns swap');
        return { ok: true, authority: x.role === 'source'
          ? t.sourceReset : t.distilledReset };
      });
    },
  };
  const resolvedProjectionApi = {
    resolveCaptureProjection(x) {
      return stage('projection.resolve', () => {
        same(x.captureAuthority, t.capture, 'projection capture swap');
        same(x.cleanProofAuthority, t.cleanProof, 'CLEAN swap');
        same(x.atomRegistry, atomRegistry, 'registry swap');
        return { ok: true, resolutionAuthority: t.resolution };
      });
    },
    issueSourceSemanticGrant({ resolutionAuthority }) {
      return stage('source.semanticGrant', () => {
        same(resolutionAuthority, t.resolution, 'semantic resolution swap');
        return { ok: true, grant: t.sourceSemanticGrant };
      });
    },
    issueAtomRoundtripGrant({ resolutionAuthority }) {
      return stage('atom.roundtripGrant', () => {
        same(resolutionAuthority, t.resolution, 'atom resolution swap');
        return { ok: true, grant: t.atomRoundtripGrant };
      });
    },
  };
  return {
    deps: { dualReplayApi, runAuthorityApi, resolvedProjectionApi,
      atomRegistry, runtimeCycleAdapter },
    calls, equivalenceReceipt, order, t,
  };
}

async function run(h, value = cycleInput(h)) {
  return coreApi.createDualReplayOrchestratorCore(h.deps).runCycle(value);
}

if (coreApi?.createDualReplayOrchestratorCore) {
  await check('O1 exact 23 steps: prepared claim, two-phase source, two grants, three runtimes', async () => {
    const h = makeHarness();
    const result = await run(h);
    same(JSON.stringify(h.order), JSON.stringify(SUCCESS_ORDER),
      `order ${JSON.stringify(h.order)}`);
    assert(['rawIssuer', 'resolvedIssuer', 'atomIssuer', 'sourceClose', 'authoringOpen',
      'authoringReset', 'authoringCompile', 'authoringClose', 'distilledPrepare',
      'distilledClose'].every((key) => h.calls[key] === 1),
    `calls ${JSON.stringify(h.calls)}`);
    assert(Object.keys(result).sort().join(',')
      === 'developmentOnly,equivalenceReceipt,ok,promotionReady'
      && result.ok === true && result.developmentOnly === true
      && result.promotionReady === false && result.equivalenceReceipt === h.equivalenceReceipt
      && !Object.hasOwn(result, 'PASS') && !Object.hasOwn(result, 'promotionEligible'),
    `public success ${JSON.stringify(result)}`);
  });

  await check('O2 preclaim failure disposes genuine preparation once; dispose failure overrides', async () => {
    for (const scenario of [
      { failAt: 'source.plan' }, { throwAt: 'source.plan' },
      { failAt: 'source.claim' }, { malformedAt: 'source.claim' },
    ]) {
      const h = makeHarness(scenario); expectFailure(await run(h), null, JSON.stringify(scenario));
      assert(h.calls.dispose === 1 && h.order.at(-1) === 'source.dispose'
        && h.calls.sourceClose === 0 && h.calls.authoringOpen === 0,
      `preclaim ${JSON.stringify({ scenario, order: h.order })}`);
    }
    const h = makeHarness({ failAt: 'source.plan', disposeFails: true });
    expectFailure(await run(h), 'SOURCE_PREPARED_RUNTIME_DISPOSE_FAILED', 'dispose override');
    same(h.calls.dispose, 1, 'dispose retry');
  });

  await check('O3 caller PASS/CLEAN/issuer/provider/prebuilt fresh rejected before business authority', async () => {
    const attacks = [
      (x) => ({ ...x, PASS: true }), (x) => ({ ...x, CLEAN: true }),
      (x) => ({ ...x, equivalent: true }), (x) => ({ ...x, axes: {} }),
      (x) => ({ ...x, issuer: {} }), (x) => ({ ...x, provider: {} }),
      (x) => ({ ...x, sourcePlan: { ...x.sourcePlan, clean: true } }),
      (x) => ({ ...x, sourcePlan: {
        ...x.sourcePlan, source: { ...x.sourcePlan.source, receipt: {} },
      } }),
      (x) => ({ ...x, sourceRuntime: { ...x.sourceRuntime, freshRuntimeAuthority: tok('x') } }),
      (x) => ({ ...x, projection: { ...x.projection, compileAdapter: {} } }),
      (x) => ({ ...x, distilled: { ...x.distilled, freshRuntimeAuthority: tok('x') } }),
      (x) => ({ ...x, distilled: { ...x.distilled, sourceClosureAuthority: tok('x') } }),
      (x) => ({ ...x, distilled: { ...x.distilled, entityLockAuthority: tok('x') } }),
      (x) => ({ ...x, distilled: { ...x.distilled, noEntity: true } }),
      (x) => ({ ...x, distilled: {
        ...x.distilled, authoringRunNamespace: x.sourcePlan.source.runNamespace,
      } }),
      (x) => ({ ...x, distilled: {
        ...x.distilled, runNamespace: x.sourcePlan.source.runNamespace,
      } }),
      (x) => ({ ...x, distilled: {
        ...x.distilled, authoringRunNamespace: x.distilled.runNamespace,
      } }),
    ];
    for (const attack of attacks) {
      const h = makeHarness();
      expectFailure(await run(h, attack(cycleInput(h))),
        'ORCHESTRATOR_INPUT_INVALID', 'caller fact');
      same(h.order.join(','), 'source.dispose', `illegal order ${h.order}`);
    }
  });

  await check('O4 postclaim step3-9 failure closes exact source owner once', async () => {
    for (const failAt of ['source.reset', 'source.authorize', 'source.execute',
      'projection.resolve', 'source.semanticGrant', 'source.completeResolved',
      'atom.roundtripGrant']) {
      const h = makeHarness({ failAt }); expectFailure(await run(h), null, failAt);
      assert(h.order.at(-1) === 'source.close' && h.calls.dispose === 0
        && h.calls.sourceClose === 1 && h.calls.authoringOpen === 0,
      `${failAt}: ${JSON.stringify(h.order)}`);
    }
    const h = makeHarness({ ownerMismatchAt: 'source' });
    expectFailure(await run(h), null, 'source owner swap');
    assert(h.order.at(-1) === 'source.close' && h.calls.sourceClose === 1,
      'prepared source owner not closed');
  });

  await check('O5 source-close/authoring failures block pair and distilled', async () => {
    const closed = makeHarness({ failAt: 'source.close' });
    expectFailure(await run(closed), 'SOURCE_RUNTIME_CLOSE_FAILED', 'source close');
    assert(closed.order.at(-1) === 'source.close' && closed.calls.authoringOpen === 0,
      `source close fallthrough ${closed.order}`);
    for (const scenario of [{ failAt: 'authoring.runSeal' },
      { throwAt: 'authoring.runSeal' }, { malformedAt: 'authoring.runSeal' },
      { authoringCloseFails: true }]) {
      const h = makeHarness(scenario); const result = await run(h);
      expectFailure(result, scenario.authoringCloseFails
        ? 'AUTHORING_RUNTIME_CLOSE_FAILED' : null, 'authoring');
      assert(h.order.at(-1) === 'authoring.runSeal' && h.calls.sourceClose === 1
        && h.calls.authoringOpen === 1 && h.calls.authoringClose === 1
        && h.calls.distilledPrepare === 0, `authoring ${JSON.stringify(h.order)}`);
      assert(!JSON.stringify(result).includes('SECRET_EXCEPTION'), 'secret leaked');
    }
    for (const failAt of ['pair.finalize', 'source.receipt']) {
      const h = makeHarness({ failAt }); const result = await run(h);
      expectFailure(result, null, failAt);
      assert(h.order.at(-1) === failAt && h.calls.sourceClose === 1
        && h.calls.dispose === 0 && h.calls.authoringOpen === 1
        && h.calls.authoringClose === 1 && h.calls.distilledPrepare === 0
        && !result.equivalenceReceipt,
      `${failAt} 必须首错阻断 distilled：${JSON.stringify(h.order)}`);
    }
  });

  await check('O6 after distilled prepare, step15-22 failures always finally-close exact owner', async () => {
    for (const scenario of [
      { failAt: 'distilled.reset' }, { failAt: 'source.predecessor' },
      { failAt: 'distilled.authorize' }, { failAt: 'distilled.complete' },
      { malformedAt: 'distilled.complete' }, { failAt: 'distilled.receipt' },
      { failAt: 'source.comparison' }, { failAt: 'distilled.comparison' },
      { failAt: 'compare' }, { throwAt: 'compare' }, { ownerMismatchAt: 'distilled' },
    ]) {
      const h = makeHarness(scenario); const result = await run(h);
      expectFailure(result, null, JSON.stringify(scenario));
      assert(h.order.at(-1) === 'distilled.close' && h.calls.distilledPrepare === 1
        && h.calls.distilledClose === 1, `distilled ${JSON.stringify(h.order)}`);
      assert(!JSON.stringify(result).includes('SECRET_EXCEPTION'), 'secret leaked');
    }
    for (const scenario of [{ failAt: 'distilled.prepare' },
      { throwAt: 'distilled.prepare' }, { malformedAt: 'distilled.prepare' }]) {
      const h = makeHarness(scenario); expectFailure(await run(h), null, 'prepare');
      assert(h.order.at(-1) === 'distilled.prepare'
        && h.calls.distilledPartialClose === 1 && h.calls.distilledClose === 0,
      'core fabricated close before ownership transfer');
    }
  });

  await check('O7 close succeeds before result; close failure suppresses equivalence receipt', async () => {
    const h = makeHarness({ failAt: 'distilled.close' }); const result = await run(h);
    expectFailure(result, 'DISTILLED_RUNTIME_CLOSE_FAILED', 'distilled close');
    same(h.order.slice(-2).join(','), 'compare,distilled.close', 'publish-before-close');
    same(h.calls.distilledClose, 1, 'close retry');
  });
}

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
