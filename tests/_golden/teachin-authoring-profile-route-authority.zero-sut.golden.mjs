#!/usr/bin/env node
// same-capture custom channel profile route 必须由 exact source-plan → authoring closure
// 的私有 authority 链背书；caller 自报 route/clone/foreign closure 均不得取得 no-entity 豁免。
// 纯内存 authority/runtime doubles；零 SUT/browser/network/credentials/LLM。

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolveExecutionTarget } from '../../lib/execution-target/authority.mjs';
import { createCompileRuntimeAdapter } from '../../lib/teachin/compile-runtime-adapter.mjs';
import {
  createAuthoringRuntimeSeam,
} from '../../lib/teachin/runtime-owner.mjs';
import {
  consumeAuthoringBaselineGrant,
} from '../../lib/dual-replay/replay-completion.mjs';
import {
  canonicalEntityLockVerifier,
} from '../../lib/teachin/entity-lock-verifier.mjs';
import {
  sealDistilledCandidateAuthority,
} from '../../lib/dual-replay/pair-authority.mjs';
import {
  api, assert, bytes, captureApi, digest, expectOk, makeAdapter, owners,
  prepareFresh, projectionApi, resetApi, roundtripApi,
} from './support/teachin-replayability-equivalence-harness.mjs';

const TAG = 'teachin-authoring-profile-route-authority';
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

function expectDenied(result, label) {
  assert(result?.ok === false, `${label} 竟获 route authority：${JSON.stringify(result)}`);
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
    channelProfileDigest: digest(profileBytes),
    channelProfileBytes: profileBytes,
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

function stats() {
  return {
    rawReplay: 0, atomRoundtrip: 0, compiledReplay: 0, axes: 0, verdict: 0,
    reset: 0, authoringOpen: 0, authoringReset: 0, createCompileRun: 0,
    compileFlow: 0, distilledOpen: 0, entityVerify: 0, sourceOpen: 0,
  };
}

async function buildSource(tag, route) {
  const env = environment(tag);
  const profileBytes = bytes({ routes: { workflowList: route } });
  const adapter = makeAdapter(tag, stats());
  const prepared = await prepareFresh(adapter, owners(`recording-${tag}`), {
    runNamespace: `run_source_${tag}`,
    executionTargetAuthority: env.execution.authority,
  });
  const sourcePlan = expectOk(api.createSourceReplayPlanAuthority(
    sourceInput(env, profileBytes),
  ), 'profiled source plan');
  const sourceFresh = expectOk(await adapter.claimPreparedSourceReplayRuntime({
    sourceRuntimePreparationAuthority: prepared.sourceRuntimePreparationAuthority,
    sourcePlanAuthority: sourcePlan.authority,
    runNamespace: `run_source_${tag}`,
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
  return { env, sourcePlan, completed, closed, atomRoundtrip };
}

function makeAuthoringCompiler(tag, route) {
  const physical = { open: 0, close: 0 };
  const seam = createAuthoringRuntimeSeam({
    consumeAuthoringBaselineGrant,
    async openAuthoring() {
      physical.open += 1;
      const runtime = owners(`authoring-${tag}-${physical.open}`);
      return {
        ok: true,
        runtime: {
          browser: runtime.browser, context: runtime.context, page: runtime.page,
          topology: Object.freeze(Object.create(null)), forensics: {}, state: {},
        },
      };
    },
    async closeRuntimeOwners({ browser, context }) {
      await context.close(); await browser.close(); physical.close += 1;
      return { ok: true };
    },
    async verifyAuthoringReset() { return { ok: true }; },
  });
  const compiler = createCompileRuntimeAdapter({
    ...seam,
    runAtomRoundtrip: roundtripApi.runAtomRoundtrip,
    createCompileRun(input) {
      assert(input?.profile?.routes?.workflowList === route,
        'authoring compiler 未收到 exact source-plan profile route');
      assert(input.listRoute === route,
        'authoring compiler 未收到 exact trusted listRoute projection');
      return { ...input, events: [], compileRun: true };
    },
    async compileFlow(run) {
      assert(run?.compileRun === true, 'compileFlow 未收到 trusted compile run');
      return {
        ok: true,
        events: [{
          intentId: 'intent_1', atom: 'nav.workflowManagement', action: 'nav',
          url: `{{baseUrl}}${route}`,
        }],
      };
    },
  });
  return { compiler, physical };
}

async function buildAuthoring(tag, route) {
  const source = await buildSource(tag, route);
  const { compiler, physical } = makeAuthoringCompiler(tag, route);
  const compiled = expectOk(await compiler.compileAuthoringCandidate({
    atomRoundtripGrant: source.atomRoundtrip.grant,
    authoringBaselineGrant: source.completed.authoringBaselineGrant,
    sourceClosureAuthority: source.closed.sourceClosureAuthority,
    runNamespace: `run_authoring_${tag}`,
    executionTargetAuthority: source.env.execution.authority,
  }), 'profile-bound authoring compile');
  assert(physical.open === 1 && physical.close === 1,
    `authoring runtime 生命周期错：open=${physical.open}, close=${physical.close}`);
  const caseId = compiled.candidate.candidateTestCase.caseId;
  const candidateBytes = Buffer.from(JSON.stringify(compiled.candidate.candidateTestCase));
  const eventsBytes = Buffer.from(JSON.stringify(compiled.candidate.eventsDocumentCandidate));
  return {
    ...source, compiled, caseId, candidateBytes, eventsBytes,
    authoringClosureAuthority: compiled.authoringClosureAuthority,
  };
}

await check('P1 exact profile→baseline→compile→genuine closure 使 custom route 走 not-required 并可 seal', async () => {
  const route = '/tenant/p1/workflows';
  const built = await buildAuthoring('profile_route_p1', route);
  const verified = canonicalEntityLockVerifier.verify({
    verificationScopeAuthority: built.authoringClosureAuthority,
    caseId: built.caseId,
    eventsBytes: built.eventsBytes,
  });
  assert(verified?.ok === true
    && verified.mode === 'not-required'
    && verified.runtimeAuthorized === false
    && verified.setSha256 === EMPTY_SET_SHA256,
  `genuine profile route 未获 no-entity authority：${JSON.stringify(verified)}`);
  const sealed = sealDistilledCandidateAuthority({
    roundtripCandidate: {
      caseId: built.caseId,
      candidateBytes: built.candidateBytes,
      eventsBytes: built.eventsBytes,
    },
    authoringClosureAuthority: built.authoringClosureAuthority,
    verifiedEntityLockHandle: verified.handle,
    verifiedEntityLockSetSha256: verified.setSha256,
    executionTargetAuthority: built.env.execution.authority,
  });
  expectOk(sealed, 'profile-route distilled candidate seal');
});

await check('P2 self-report/clone/foreign/mismatch 不豁免且拒绝不消费 genuine closure', async () => {
  const route = '/tenant/p2/workflows';
  const built = await buildAuthoring('profile_route_p2', route);
  const foreign = await buildAuthoring('profile_route_foreign', '/tenant/foreign/workflows');
  const verify = (verificationScopeAuthority, eventsBytes = built.eventsBytes) =>
    canonicalEntityLockVerifier.verify({
      verificationScopeAuthority, caseId: built.caseId, eventsBytes,
    });

  expectDenied(verify(Object.freeze({ channelProfileRoute: route })),
    'caller self-reported same route');
  expectDenied(verify({ ...built.authoringClosureAuthority }), 'closure clone');
  expectDenied(verify(foreign.authoringClosureAuthority), 'foreign genuine closure');

  const mismatchDocument = JSON.parse(built.eventsBytes.toString('utf8'));
  mismatchDocument.url = '{{baseUrl}}/tenant/mismatch/workflows';
  mismatchDocument.events[0].url = mismatchDocument.url;
  expectDenied(verify(built.authoringClosureAuthority, bytes(mismatchDocument)),
    'genuine closure route mismatch');

  const genuine = verify(built.authoringClosureAuthority);
  assert(genuine?.ok === true
    && genuine.mode === 'not-required'
    && genuine.runtimeAuthorized === false,
  `拒绝路径错误消费 genuine closure：${JSON.stringify(genuine)}`);
});

console.log(`${TAG}: ${passed} 过 / ${failures.length} 败`);
if (failures.length) process.exit(1);
