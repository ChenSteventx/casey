#!/usr/bin/env node
// exact channel profile 与 source-plan identity 的 authoring 边界。纯内存，零 SUT/network/credentials/LLM。

import { readFileSync } from 'node:fs';
import { resolveExecutionTarget } from '../../lib/execution-target/authority.mjs';
import { createCompileRun } from '../../lib/compile-atoms-run.mjs';
import { compileFlow } from '../../lib/compile-atoms-flow.mjs';
import { createCompileRuntimeAdapter } from '../../lib/teachin/compile-runtime-adapter.mjs';
import {
  claimSourceRuntimePreparation,
  createAuthoringRuntimeSeam,
  disposeSourceRuntimePreparation,
  sealPreparedSourceRuntime,
} from '../../lib/teachin/runtime-owner.mjs';
import { consumeAuthoringBaselineGrant } from '../../lib/dual-replay/replay-completion.mjs';
import {
  api, assert, bytes, captureApi, digest, expectOk, freshApi, makeAdapter, owners,
  prepareFresh, projectionApi, rawRunnerApi, resetApi,
} from './support/teachin-replayability-equivalence-harness.mjs';

const TAG = 'teachin-authoring-source-plan-identity';
let passed = 0;
const failures = [];
async function check(name, fn) {
  try { await fn(); passed += 1; console.log(`ok   ${TAG}: ${name}`); }
  catch (error) {
    const detail = String(error?.message || error).slice(-1000);
    failures.push(`${name}: ${detail}`); console.error(`RED  ${TAG}: ${name}: ${detail}`);
  }
}

const atomRegistry = JSON.parse(readFileSync(
  new URL('../../lib/atoms-registry.snapshot.json', import.meta.url), 'utf8',
));

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
      required: false, status: 'NOT_REQUIRED_READ_ONLY', policySha256: digest(`${tag}:cleanup`),
    },
  };
}

function authoredCase(tag) {
  return {
    schemaVersion: 1, caseId: `tc_${tag}`, title: '只读工作流导航',
    preconditions: ['已登录'],
    steps: [{ intentId: 'intent_1', intent: '进入工作流管理' }], uniquePrefix: 'atl_',
  };
}

function makeEnvironment(tag) {
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
      seq: 1, action: 'click', path: '/home', selector: '#workflow-management', text: '工作流管理',
    }],
  });
  const admitted = expectOk(captureApi.admitRawReplayCapture({
    caseId: `tc_${tag}`, captureBytes: rawBytes,
  }), 'raw capture');
  return { tag, execution, rawBytes, admitted };
}

function sourceInput(env, profileBytes) {
  const input = {
    pairId: `pair_${env.tag}`,
    testcaseBytes: bytes(authoredCase(env.tag)),
    expectedBytes: bytes({ caseId: `tc_${env.tag}`, intents: [{ intentId: 'intent_1', expected: [] }] }),
    expectedObligations: obligations(env.tag),
    sutBuildDigest: digest(`${env.tag}:build`),
    channelProfileDigest: profileBytes ? digest(profileBytes) : digest(`${env.tag}:channel`),
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
  if (profileBytes) input.channelProfileBytes = profileBytes;
  return input;
}

function stats() {
  return {
    rawReplay: 0, atomRoundtrip: 0, compiledReplay: 0, axes: 0, verdict: 0, reset: 0,
    authoringOpen: 0, authoringReset: 0, createCompileRun: 0, compileFlow: 0,
    distilledOpen: 0, entityVerify: 0, sourceOpen: 0,
  };
}

async function buildSource(env, { profileBytes = null, afterPlan = null } = {}) {
  const calls = stats();
  const adapter = makeAdapter(env.tag, calls);
  const recording = owners(`recording-${env.tag}-${Math.random()}`);
  const prepared = await prepareFresh(adapter, recording, {
    runNamespace: `run_source_${env.tag}`,
    executionTargetAuthority: env.execution.authority,
  });
  const sourcePlan = expectOk(api.createSourceReplayPlanAuthority(
    sourceInput(env, profileBytes),
  ), 'profiled source plan');
  if (typeof afterPlan === 'function') afterPlan();
  const sourceFresh = expectOk(await adapter.claimPreparedSourceReplayRuntime({
    sourceRuntimePreparationAuthority: prepared.sourceRuntimePreparationAuthority,
    sourcePlanAuthority: sourcePlan.authority,
    runNamespace: `run_source_${env.tag}`,
    executionTargetAuthority: env.execution.authority,
  }), 'source runtime claim');
  const reset = expectOk(resetApi.createResetAuthority({
    replayPlanAuthority: sourcePlan.authority, role: 'source',
    runNamespace: `run_source_${env.tag}`, trustedResetIssuer: adapter.resetIssuer,
  }), 'source reset');
  const run = expectOk(api.authorizeSourceReplay({
    sourcePlanAuthority: sourcePlan.authority, role: 'source',
    runNamespace: `run_source_${env.tag}`, resetAuthority: reset.authority,
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
    atomRegistry, authoredTestCase: authoredCase(env.tag),
  }), 'source projection');
  const semantic = expectOk(projectionApi.issueSourceSemanticGrant({
    resolutionAuthority: resolved.resolutionAuthority,
  }), 'source semantic grant');
  const completed = expectOk(await api.completeResolvedSourceReplay({
    rawExecutionAuthority: executed.rawExecutionAuthority,
    sourceSemanticGrant: semantic.grant,
    trustedResolvedSourceIssuer: adapter.resolvedSourceIssuer,
  }), 'source semantic completion');
  const closed = expectOk(await adapter.closeReplayRuntimeOwners({
    runtimeOwnerAuthority: executed.sourceRuntimeOwnerAuthority,
  }), 'source close');
  return { adapter, calls, sourcePlan, completed, closed };
}

function browserPage(replay, origin) {
  let currentUrl = `${origin}/home`;
  Object.assign(replay.page, {
    async goto(url) { currentUrl = url; },
    url() { return currentUrl; },
    async evaluate() { return 0; },
    waitForResponse() { return Promise.resolve(null); },
    locator() {
      return { first() { return { async waitFor() {} }; } };
    },
    async close() {},
  });
  return replay.page;
}

function authoringHarness({ env, physicalOpen }) {
  const seam = createAuthoringRuntimeSeam({
    consumeAuthoringBaselineGrant,
    async openAuthoring() {
      physicalOpen.count += 1;
      const replay = owners(`authoring-${env.tag}-${physicalOpen.count}`);
      const origin = new URL(`https://${env.tag}.synthetic.invalid/home`).origin;
      browserPage(replay, origin);
      physicalOpen.last = replay;
      return {
        ok: true,
        runtime: {
          browser: replay.browser, context: replay.context, page: replay.page,
          topology: Object.freeze(Object.create(null)),
          forensics: { records: () => [] }, state: { currentStepId: null },
        },
      };
    },
    async closeRuntimeOwners({ browser, context }) {
      await context.close(); await browser.close(); return { ok: true };
    },
    async verifyAuthoringReset() { return { ok: true }; },
  });
  return seam;
}

async function compileCandidate({ env, source, physicalOpen, seen }) {
  const seam = authoringHarness({ env, physicalOpen });
  const adapter = createCompileRuntimeAdapter({
    ...seam,
    async runAtomRoundtrip({ compileAdapter }) {
      const candidateTestCase = authoredCase(env.tag);
      const candidateMapping = [{
        intentId: 'intent_1', atom: 'nav.workflowManagement', params: {}, evidenceEventSeqs: [1],
      }];
      const flow = {
        id: `tc_${env.tag}`, name: 'profile route', category: 'normal',
        steps: [{ atom: 'nav.workflowManagement', params: {}, sourceIntentId: 'intent_1' }],
      };
      const lineagePlan = [{ mappingKey: 'mapping_1', sourceIntentId: 'intent_1' }];
      const compiled = await compileAdapter({ candidateTestCase, candidateMapping, flow, lineagePlan });
      if (compiled?.ok !== true) return compiled;
      return {
        ok: true, candidateTestCase, candidateMapping,
        eventsCandidate: compiled.compiledEvents, compileLineage: compiled.compileLineage,
        manifest: {},
      };
    },
    createCompileRun(input) {
      seen.input = input;
      return createCompileRun(input);
    },
    async compileFlow(run, flow, options) {
      const lineage = await compileFlow(run, flow, options);
      seen.firstEvent = run.events[0] || null;
      return lineage;
    },
  });
  return adapter.compileAuthoringCandidate({
    atomRoundtripGrant: Object.freeze(Object.create(null)),
    authoringBaselineGrant: source.completed.authoringBaselineGrant,
    sourceClosureAuthority: source.closed.sourceClosureAuthority,
    runNamespace: `run_authoring_${env.tag}`,
    executionTargetAuthority: env.execution.authority,
  });
}

await check('H1 identity listApi 声明与 malformed profile 均在物理 authoring open 前拒绝', async () => {
  for (const [label, profileBytes, exactReason] of [
    ['agents', bytes({ routes: { workflowList: '/tenant/workflows' }, agents: { listApi: { pathname: '/agents' } } }), 'AUTHORING_IDENTITY_CHANNEL_UNSUPPORTED'],
    ['workflows', bytes({ routes: { workflowList: '/tenant/workflows' }, workflows: { listApi: { pathname: '/workflows' } } }), 'AUTHORING_IDENTITY_CHANNEL_UNSUPPORTED'],
    ['malformed', Buffer.from('{"routes":'), null],
  ]) {
    const env = makeEnvironment(`unsupported_${label}`);
    const source = await buildSource(env, { profileBytes });
    const physicalOpen = { count: 0, last: null };
    const result = await compileCandidate({ env, source, physicalOpen, seen: {} });
    assert(result?.ok === false, `${label}: unsupported/malformed profile 竟发布：${JSON.stringify(result)}`);
    if (exactReason) assert(result.reason === exactReason, `${label}: reason=${result.reason}`);
    assert(physicalOpen.count === 0, `${label}: 拒绝前已物理 open ${physicalOpen.count} 次`);
  }
});

await check('H2 genuine source→baseline→closure→authoring→真实 compile 固定 exact bytes 与 tenant route', async () => {
  const env = makeEnvironment('exact_profile_chain');
  const original = bytes({ routes: { workflowList: '/tenant/workflows' } });
  const mutable = Buffer.from(original);
  const source = await buildSource(env, {
    profileBytes: mutable,
    afterPlan() { mutable.fill(0); },
  });
  const physicalOpen = { count: 0, last: null };
  const seen = {};
  const result = await compileCandidate({ env, source, physicalOpen, seen });
  assert(result?.ok === true, `exact profile compile 未成功：${JSON.stringify(result)}`);
  assert(physicalOpen.count === 1, `authoring open=${physicalOpen.count}`);
  assert(seen.input?.profile?.routes?.workflowList === '/tenant/workflows',
    'createCompileRun 未消费 source authority 私有 exact profile copy');
  assert(seen.input?.listRoute === '/tenant/workflows', 'createCompileRun listRoute 未绑定 exact profile');
  assert(seen.firstEvent?.url === '{{baseUrl}}/tenant/workflows',
    `真实 compileFlow 首事件错路由：${JSON.stringify(seen.firstEvent)}`);
});

await check('M1 preparation ns/target/adapter-owner 拒绝均不消费，随后 dispose 只关一次', async () => {
  const env = makeEnvironment('preparation_reject_dispose');
  const plan = expectOk(api.createSourceReplayPlanAuthority(sourceInput(env)), 'legacy source plan');
  const foreignTarget = makeEnvironment('foreign_target').execution.authority;
  const variants = [
    { label: 'namespace', runNamespace: 'run_wrong', target: env.execution.authority },
    { label: 'target', runNamespace: `run_source_${env.tag}`, target: foreignTarget },
    { label: 'adapter-owner', runNamespace: `run_source_${env.tag}`, target: env.execution.authority, foreignAdapter: true },
  ];
  for (const variant of variants) {
    const replay = owners(`dispose-${variant.label}`);
    const adapterIdentity = Object.freeze(Object.create(null));
    const sealed = sealPreparedSourceRuntime({
      freshRuntimeAuthority: Object.freeze(Object.create(null)),
      topologyAuthority: Object.freeze(Object.create(null)),
      runtime: { browser: replay.browser, context: replay.context, page: replay.page },
      runNamespace: `run_source_${env.tag}`,
      executionTargetAuthority: env.execution.authority,
      adapterIdentity,
    });
    const claimed = claimSourceRuntimePreparation({
      sourceRuntimePreparationAuthority: sealed.sourceRuntimePreparationAuthority,
      sourcePlanAuthority: plan.authority,
      runNamespace: variant.runNamespace,
      executionTargetAuthority: variant.target,
      adapterIdentity: variant.foreignAdapter ? Object.freeze(Object.create(null)) : adapterIdentity,
    });
    assert(claimed === null, `${variant.label}: mismatch 竟 claim 成功`);
    const disposed = await disposeSourceRuntimePreparation({
      sourceRuntimePreparationAuthority: sealed.sourceRuntimePreparationAuthority,
      adapterIdentity,
      async closeRuntimeOwners({ browser, context }) {
        await context.close(); await browser.close(); return { ok: true };
      },
    });
    assert(disposed === true, `${variant.label}: reject 后 genuine owner 不可 dispose`);
    assert(replay.closeCalls === 1, `${variant.label}: close 次数=${replay.closeCalls}`);
    const twice = await disposeSourceRuntimePreparation({
      sourceRuntimePreparationAuthority: sealed.sourceRuntimePreparationAuthority,
      adapterIdentity,
      async closeRuntimeOwners() { throw new Error('SECOND_CLOSE_MUST_NOT_RUN'); },
    });
    assert(twice === null, `${variant.label}: preparation 可二次 dispose`);
  }
});

await check('M2 same-label distinct genuine source plan 的 baseline/closure 不可换绑且零 open', async () => {
  const env = makeEnvironment('same_label_distinct_plan');
  const sourceA = await buildSource(env);
  const sourceB = await buildSource(env);
  assert(sourceA.sourcePlan.authority !== sourceB.sourcePlan.authority, '探针未造出 distinct genuine plan');
  const physicalOpen = { count: 0, last: null };
  const seam = authoringHarness({ env, physicalOpen });
  const swapped = await seam.openFreshAuthoringRuntime({
    authoringBaselineGrant: sourceA.completed.authoringBaselineGrant,
    sourceClosureAuthority: sourceB.closed.sourceClosureAuthority,
    candidateCaseId: `tc_${env.tag}`,
    runNamespace: `run_authoring_${env.tag}`,
    executionTargetAuthority: env.execution.authority,
  });
  if (swapped?.ok === true) {
    await seam.closeAuthoringRuntime({ authoringRuntimeAuthority: swapped.authoringRuntimeAuthority });
  }
  assert(swapped?.ok === false && swapped.reason === 'AUTHORING_BASELINE_MISMATCH',
    `distinct plan 换绑未拒绝：${JSON.stringify(swapped)}`);
  assert(physicalOpen.count === 0, `distinct plan 换绑已物理 open ${physicalOpen.count} 次`);
});

console.log(`${TAG}: ${passed} 过 / ${failures.length} 败`);
if (failures.length) process.exit(1);
