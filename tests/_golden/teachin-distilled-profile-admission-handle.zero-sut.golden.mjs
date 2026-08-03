#!/usr/bin/env node
// profile-bound custom read route 在 authoring verify+seal 后，必须把 exact opaque admission
// handle 经 candidate -> finalized pair -> distilled run 带到 canonical prepared preflight。
// 纯内存 authority/runtime doubles；零 SUT/browser/network/credentials/LLM。

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolveExecutionTarget } from '../../lib/execution-target/authority.mjs';
import { createCompileRuntimeAdapter } from '../../lib/teachin/compile-runtime-adapter.mjs';
import { createAuthoringRuntimeSeam } from '../../lib/teachin/runtime-owner.mjs';
import {
  consumeAuthoringBaselineGrant, openRunExecution,
} from '../../lib/dual-replay/replay-completion.mjs';
import { canonicalEntityLockVerifier } from '../../lib/teachin/entity-lock-verifier.mjs';
import { sealDistilledCandidateAuthority } from '../../lib/dual-replay/pair-authority.mjs';
import {
  inspectClaimedReplayRuntime, runCanonicalPreflight, stageClaimedReplayExecution,
} from '../../lib/teachin/prepared-runtime-seam.mjs';
import {
  api, assert, bytes, captureApi, digest, expectOk, makeAdapter, owners,
  prepareFresh, projectionApi, resetApi, roundtripApi,
} from './support/teachin-replayability-equivalence-harness.mjs';

const TAG = 'teachin-distilled-profile-admission-handle';
const EMPTY_SET_SHA256 = `sha256:${createHash('sha256').update('[]').digest('hex')}`;
const failures = [];
let passed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${TAG}: ${name}`);
  } catch (error) {
    const detail = String(error?.message || error).slice(-1000);
    failures.push(`${name}: ${detail}`);
    console.error(`RED  ${TAG}: ${name}: ${detail}`);
  }
}

function obligations(tag) {
  const predicate = digest(`${tag}:predicate`);
  return {
    intents: ['intent_1'],
    terminalHardPredicates: [{ intentId: 'intent_1', predicateSha256: predicate }],
    topology: [], entities: [],
    effects: [{
      intentId: 'intent_1', effectClass: 'read',
      evidenceRefs: [`predicate:${predicate}`], projectionSha256: digest(`${tag}:effect`),
    }],
    cleanup: {
      required: false, status: 'NOT_REQUIRED_READ_ONLY',
      policySha256: digest(`${tag}:cleanup`),
    },
  };
}

function semanticEvidence(tag) {
  const expected = obligations(tag);
  return {
    intents: [{ intentId: 'intent_1', verdict: 'PASS', reason: null }],
    terminalHardPredicates: [{ ...expected.terminalHardPredicates[0], ok: true }],
    topology: [], entities: [],
    effects: expected.effects.map((row) => ({ ...row, evidenceRefs: [...row.evidenceRefs] })),
    cleanup: { ...expected.cleanup },
  };
}

function authoredCase(tag) {
  return {
    schemaVersion: 1, caseId: `tc_${tag}`, title: '自定义路由只读导航',
    preconditions: ['已登录'],
    steps: [{ intentId: 'intent_1', intent: '进入工作流管理' }],
    uniquePrefix: 'atl_',
  };
}

function environment(tag) {
  const execution = expectOk(resolveExecutionTarget({
    runtime: { platform: 'linux', isWSL: false },
    logicalTarget: { startUrl: `https://${tag}.synthetic.invalid/home` },
    transport: { mode: 'direct' }, requiresOriginContinuity: true,
  }), 'execution target');
  const rawBytes = bytes({
    schemaVersion: 1, artifactKind: 'teach-in-capture', caseId: `tc_${tag}`,
    createdAt: '2026-08-03T00:00:00.000Z', startPath: '/home',
    source: { kind: 'manual', signed: false, replayReady: false, distillRequired: true },
    events: [{
      seq: 1, action: 'click', path: '/home', selector: '#workflow-management',
      text: '工作流管理',
    }],
  });
  const admitted = expectOk(captureApi.admitRawReplayCapture({
    caseId: `tc_${tag}`, captureBytes: rawBytes,
  }), 'raw capture');
  return { tag, execution, rawBytes, admitted };
}

function sourceInput(env, profileBytes) {
  return {
    pairId: `pair_${env.tag}`,
    testcaseBytes: bytes(authoredCase(env.tag)),
    expectedBytes: bytes({
      caseId: `tc_${env.tag}`, intents: [{ intentId: 'intent_1', expected: [] }],
    }),
    expectedObligations: obligations(env.tag),
    sutBuildDigest: digest(`${env.tag}:build`),
    channelProfileDigest: digest(profileBytes), channelProfileBytes: profileBytes,
    identityProfileDigest: digest(`${env.tag}:identity`),
    replayKernelDigest: digest(`${env.tag}:kernel`),
    resetPlanDigest: digest(`${env.tag}:reset-plan`),
    sessionPolicyDigest: digest(`${env.tag}:session-policy`),
    executionTargetAuthority: env.execution.authority,
    source: {
      captureAuthority: env.admitted.captureAuthority,
      candidateBytes: bytes({ tag: env.tag, role: 'source', candidate: 'raw' }),
      eventsBytes: env.rawBytes, entityLockBytes: Buffer.from('[]'),
      runNamespace: `run_source_${env.tag}`,
    },
  };
}

const atomRegistry = JSON.parse(readFileSync(
  new URL('../../lib/atoms-registry.snapshot.json', import.meta.url), 'utf8',
));

function freshStats() {
  return {
    rawReplay: 0, atomRoundtrip: 0, compiledReplay: 0, axes: 0, verdict: 0,
    reset: 0, authoringOpen: 0, authoringReset: 0, createCompileRun: 0,
    compileFlow: 0, distilledOpen: 0, entityVerify: 0, sourceOpen: 0,
  };
}

async function buildSource(tag, route) {
  const env = environment(tag);
  const profileBytes = bytes({ routes: { workflowList: route } });
  const adapter = makeAdapter(tag, freshStats());
  const prepared = await prepareFresh(adapter, owners(`recording-${tag}`), {
    runNamespace: `run_source_${tag}`, executionTargetAuthority: env.execution.authority,
  });
  const sourcePlan = expectOk(api.createSourceReplayPlanAuthority(
    sourceInput(env, profileBytes),
  ), 'profiled source plan');
  const sourceFresh = expectOk(await adapter.claimPreparedSourceReplayRuntime({
    sourceRuntimePreparationAuthority: prepared.sourceRuntimePreparationAuthority,
    sourcePlanAuthority: sourcePlan.authority, runNamespace: `run_source_${tag}`,
    executionTargetAuthority: env.execution.authority,
  }), 'source runtime claim');
  const reset = expectOk(resetApi.createResetAuthority({
    replayPlanAuthority: sourcePlan.authority, role: 'source',
    runNamespace: `run_source_${tag}`, trustedResetIssuer: adapter.resetIssuer,
  }), 'source reset');
  const run = expectOk(api.authorizeSourceReplay({
    sourcePlanAuthority: sourcePlan.authority, role: 'source',
    runNamespace: `run_source_${tag}`, resetAuthority: reset.authority,
    freshRuntimeAuthority: sourceFresh.freshRuntimeAuthority,
    topologyAuthority: sourceFresh.topologyAuthority,
    runtimeOwnerAuthority: sourceFresh.runtimeOwnerAuthority,
    executionTargetAuthority: env.execution.authority,
  }), 'source run');
  const executed = expectOk(await api.executeAuthorizedSourceReplay({
    runAuthority: run.authority, trustedRawReplayIssuer: adapter.rawReplayIssuer,
  }), 'source raw execution');
  const resolved = expectOk(projectionApi.resolveCaptureProjection({
    captureAuthority: env.admitted.captureAuthority,
    cleanProofAuthority: executed.cleanProofAuthority,
    mappingCandidate: [{
      intentId: 'intent_1', atom: 'nav.workflowManagement', params: {}, evidenceEventSeqs: [1],
    }],
    atomRegistry, authoredTestCase: authoredCase(tag),
  }), 'source projection');
  const sourceSemantic = expectOk(projectionApi.issueSourceSemanticGrant({
    resolutionAuthority: resolved.resolutionAuthority,
  }), 'source semantic grant');
  const atomRoundtrip = expectOk(projectionApi.issueAtomRoundtripGrant({
    resolutionAuthority: resolved.resolutionAuthority,
  }), 'atom roundtrip grant');
  const completed = expectOk(await api.completeResolvedSourceReplay({
    rawExecutionAuthority: executed.rawExecutionAuthority,
    sourceSemanticGrant: sourceSemantic.grant,
    trustedResolvedSourceIssuer: adapter.resolvedSourceIssuer,
  }), 'source semantic completion');
  const closed = expectOk(await adapter.closeReplayRuntimeOwners({
    runtimeOwnerAuthority: executed.sourceRuntimeOwnerAuthority,
  }), 'source close');
  return { env, adapter, sourcePlan, completed, closed, atomRoundtrip };
}

function makeAuthoringCompiler(tag, route) {
  const seam = createAuthoringRuntimeSeam({
    consumeAuthoringBaselineGrant,
    async openAuthoring() {
      const runtime = owners(`authoring-${tag}`);
      return { ok: true, runtime: {
        browser: runtime.browser, context: runtime.context, page: runtime.page,
        topology: Object.freeze(Object.create(null)), forensics: {}, state: {},
      } };
    },
    async closeRuntimeOwners({ browser, context }) {
      await context.close(); await browser.close(); return { ok: true };
    },
    async verifyAuthoringReset() { return { ok: true }; },
  });
  return createCompileRuntimeAdapter({
    ...seam, runAtomRoundtrip: roundtripApi.runAtomRoundtrip,
    createCompileRun(input) {
      assert(input?.profile?.routes?.workflowList === route && input.listRoute === route,
        'authoring compiler 未收到 exact source-plan profile route');
      return { ...input, compileRun: true };
    },
    async compileFlow(run) {
      assert(run?.compileRun === true, 'compileFlow 未收到 trusted compile run');
      return { ok: true, events: [{
        intentId: 'intent_1', atom: 'nav.workflowManagement', action: 'nav',
        url: `{{baseUrl}}${route}`,
      }] };
    },
  });
}

async function buildAuthoring(tag, route) {
  const source = await buildSource(tag, route);
  const compiler = makeAuthoringCompiler(tag, route);
  const compiled = expectOk(await compiler.compileAuthoringCandidate({
    atomRoundtripGrant: source.atomRoundtrip.grant,
    authoringBaselineGrant: source.completed.authoringBaselineGrant,
    sourceClosureAuthority: source.closed.sourceClosureAuthority,
    runNamespace: `run_authoring_${tag}`,
    executionTargetAuthority: source.env.execution.authority,
  }), 'profile-bound authoring compile');
  const caseId = compiled.candidate.candidateTestCase.caseId;
  return {
    ...source, compiled, caseId,
    candidateBytes: Buffer.from(JSON.stringify(compiled.candidate.candidateTestCase)),
    eventsBytes: Buffer.from(JSON.stringify(compiled.candidate.eventsDocumentCandidate)),
    authoringClosureAuthority: compiled.authoringClosureAuthority,
  };
}

function seal(built, verified, overrides = {}) {
  return sealDistilledCandidateAuthority({
    roundtripCandidate: {
      caseId: built.caseId, candidateBytes: built.candidateBytes,
      eventsBytes: built.eventsBytes, ...overrides,
    },
    authoringClosureAuthority: built.authoringClosureAuthority,
    verifiedEntityLockHandle: verified.handle,
    verifiedEntityLockSetSha256: verified.setSha256,
    executionTargetAuthority: built.env.execution.authority,
  });
}

await check('H1 exact profile admission handle 必须贯穿 finalized pair 到 distilled canonical preflight', async () => {
  const tag = 'profile_handle_h1';
  const built = await buildAuthoring(tag, '/tenant/h1/workflows');
  const verified = expectOk(canonicalEntityLockVerifier.verify({
    verificationScopeAuthority: built.authoringClosureAuthority,
    caseId: built.caseId, eventsBytes: built.eventsBytes,
  }), 'custom route authoring admission');
  assert(verified.mode === 'not-required' && verified.setSha256 === EMPTY_SET_SHA256,
    `custom route 应是 profile-bound no-entity：${JSON.stringify(verified)}`);
  const sealed = expectOk(seal(built, verified), 'distilled candidate seal');
  const finalized = expectOk(api.finalizeDualReplayPlanAuthority({
    sourcePlanAuthority: built.sourcePlan.authority,
    sourceCompletionAuthority: built.completed.completionAuthority,
    distilledCandidateAuthority: sealed.distilledCandidateAuthority,
  }), 'pair finalization');
  const sourceReceipt = expectOk(api.createSemanticReplayReceipt({
    completionAuthority: finalized.pairBoundSourceCompletionAuthority,
  }), 'source receipt');
  const distilledFresh = expectOk(await built.adapter.prepareDistilledReplayRuntime({
    authoringClosureAuthority: built.authoringClosureAuthority,
    pairAuthority: finalized.pairAuthority, runNamespace: `run_distilled_${tag}`,
    executionTargetAuthority: built.env.execution.authority,
  }), 'distilled runtime prepare');
  const distilledReset = expectOk(resetApi.createResetAuthority({
    replayPlanAuthority: finalized.pairAuthority, role: 'distilled',
    runNamespace: `run_distilled_${tag}`, trustedResetIssuer: built.adapter.resetIssuer,
  }), 'distilled reset');
  const predecessor = expectOk(api.issuePredecessorGrant({
    receiptAuthority: sourceReceipt.authority,
  }), 'predecessor grant');
  const distilledRun = expectOk(api.authorizeDistilledReplay({
    pairAuthority: finalized.pairAuthority, role: 'distilled',
    runNamespace: `run_distilled_${tag}`, sourceReceiptBytes: sourceReceipt.bytes,
    sourceReceiptAuthority: sourceReceipt.authority, predecessorGrant: predecessor.grant,
    resetAuthority: distilledReset.authority,
    freshRuntimeAuthority: distilledFresh.freshRuntimeAuthority,
    topologyAuthority: distilledFresh.topologyAuthority,
    runtimeOwnerAuthority: distilledFresh.runtimeOwnerAuthority,
    executionTargetAuthority: built.env.execution.authority,
  }), 'distilled authorize');

  let preflight = null;
  const completion = await api.completeAuthorizedReplay({
    runAuthority: distilledRun.authority,
    trustedReplayIssuer: Object.freeze({
      async executeAndVerify({ runExecutionAuthority }) {
        const execution = openRunExecution(runExecutionAuthority);
        assert(execution, 'distilled execution 必须可开箱一次');
        assert(stageClaimedReplayExecution({ runExecutionAuthority, execution }) === true,
          'distilled execution 必须可 stage 一次');
        const claimed = inspectClaimedReplayRuntime({
          runExecutionAuthority,
          freshRuntimeAuthority: execution.freshRuntimeAuthority,
          topologyAuthority: execution.topologyAuthority,
          runtimeOwnerAuthority: execution.runtimeOwnerAuthority,
          executionTargetAuthority: execution.executionTargetAuthority,
        });
        if (claimed?.ok !== true) { preflight = claimed; return claimed; }
        preflight = await runCanonicalPreflight({
          runExecutionAuthority, runtimeOwnerAuthority: execution.runtimeOwnerAuthority,
          page: claimed.page, execution: claimed.execution,
          eventRunnerInput: claimed.eventRunnerInput,
          axesProjectionInput: claimed.axesProjectionInput,
        });
        if (preflight?.ok !== true) return preflight;
        return {
          ok: true, runExecutionAuthority,
          runtimeOwnerAuthority: execution.runtimeOwnerAuthority,
          artifacts: execution.artifacts,
          axesBytes: bytes({ caseId: built.caseId, steps: [{ intentId: 'intent_1' }] }),
          verdictBytes: bytes({ steps: [{ intentId: 'intent_1', verdict: 'PASS', reason: null }] }),
          evidence: semanticEvidence(tag),
        };
      },
    }),
  });
  assert(preflight?.ok === true,
    `exact profile admission handle 未到 preflight：${JSON.stringify(preflight)}`);
  expectOk(completion, 'distilled completion after profile preflight');
  expectOk(await built.adapter.closeReplayRuntimeOwners({
    runtimeOwnerAuthority: completion.distilledRuntimeOwnerAuthority,
  }), 'distilled runtime close');
});

await check('H2 exact events 换绑或 clone handle 必须拒，且不得消费 genuine seal path', async () => {
  const built = await buildAuthoring('profile_handle_h2', '/tenant/h2/workflows');
  const verified = expectOk(canonicalEntityLockVerifier.verify({
    verificationScopeAuthority: built.authoringClosureAuthority,
    caseId: built.caseId, eventsBytes: built.eventsBytes,
  }), 'custom route authoring admission');
  const swappedDocument = JSON.parse(built.eventsBytes.toString('utf8'));
  swappedDocument.url = '{{baseUrl}}/tenant/swap/workflows';
  swappedDocument.events[0].url = swappedDocument.url;
  const swapped = seal(built, verified, { eventsBytes: bytes(swappedDocument) });
  assert(swapped?.ok === false && swapped.reason === 'ENTITY_LOCK_AUTHORITY_INVALID',
    `events swap 竟消费 genuine handle：${JSON.stringify(swapped)}`);
  const cloned = sealDistilledCandidateAuthority({
    roundtripCandidate: {
      caseId: built.caseId, candidateBytes: built.candidateBytes, eventsBytes: built.eventsBytes,
    },
    authoringClosureAuthority: built.authoringClosureAuthority,
    verifiedEntityLockHandle: { ...verified.handle },
    verifiedEntityLockSetSha256: verified.setSha256,
    executionTargetAuthority: built.env.execution.authority,
  });
  assert(cloned?.ok === false && cloned.reason === 'ENTITY_LOCK_AUTHORITY_INVALID',
    `clone handle 竟可 seal：${JSON.stringify(cloned)}`);
  expectOk(seal(built, verified), 'rejected probes must not consume genuine handle');
});

console.log(`${TAG}: ${passed} 过 / ${failures.length} 败`);
if (failures.length) process.exit(1);
