#!/usr/bin/env node
// teach-in authoring runtime/profile production seam acceptance.
// In-memory only: zero browser/SUT/network/credentials/LLM.

import atomRegistry from '../../lib/atoms-registry.snapshot.json' with { type: 'json' };
import { createCompileRun } from '../../lib/compile-atoms.mjs';
import { resolveExecutionTarget } from '../../lib/execution-target/authority.mjs';
import { projectExecutionTargetRuntime } from '../../lib/execution-target/runtime.mjs';
import { createCompileRuntimeAdapter } from '../../lib/teachin/compile-runtime-adapter.mjs';
import { generateKnownReadOnlyCycleInput } from '../../lib/teachin/cycle-plan-generator.mjs';

const TAG = 'teachin-authoring-runtime-profile';
let passed = 0;
const failures = [];
const assert = (condition, message) => { if (!condition) throw new Error(message); };
async function check(name, fn) {
  try { await fn(); passed += 1; console.log(`ok   ${TAG}: ${name}`); }
  catch (error) {
    const detail = String(error?.message || error).slice(-800);
    failures.push(`${name}: ${detail}`); console.error(`RED  ${TAG}: ${name}: ${detail}`);
  }
}

function target() {
  const resolved = resolveExecutionTarget({
    runtime: { platform: 'linux', isWSL: false },
    logicalTarget: { startUrl: 'https://shape.invalid/start' },
    transport: { mode: 'direct' },
    requiresOriginContinuity: true,
  });
  assert(resolved.ok === true, 'synthetic target authority 未铸成');
  return resolved.authority;
}

await check('A1 genuine authority 恢复 runtime/base URL，不产生 undefined 第二事实源', () => {
  const authority = target();
  const expected = projectExecutionTargetRuntime(authority);
  const run = createCompileRun({
    page: {}, forensics: { records: () => [] }, state: { currentStepId: null },
    executionTargetAuthority: authority,
  });
  assert(run.executionTargetAuthority === authority, 'authority 被换绑');
  assert(run.executionTargetRuntime?.browserVisibleBaseUrl === expected.browserVisibleBaseUrl,
    '未从 genuine authority 投影 runtime');
  assert(run.sut === expected.browserVisibleBaseUrl && run.ctx.baseUrl === expected.browserVisibleBaseUrl,
    'sut/baseUrl 未绑定 authority runtime');
  assert(!JSON.stringify({ sut: run.sut, ctx: run.ctx }).includes('undefined'),
    'authority 路径泄出 undefined 状态');
});

await check('A2 trusted exact profile route 贯穿 authoring adapter 到 compile run', async () => {
  const authority = target();
  const profile = {
    routes: {
      workflowList: '/tenant/workflows',
      agentList: '/tenant/agents',
    },
  };
  const tokens = Object.freeze({
    atom: Object.freeze({}), baseline: Object.freeze({}), source: Object.freeze({}),
    runtime: Object.freeze({}), closure: Object.freeze({}),
  });
  let compileInput = null;
  const run = { events: [] };
  const adapter = createCompileRuntimeAdapter({
    async runAtomRoundtrip({ compileAdapter }) {
      const compiled = await compileAdapter({
        candidateTestCase: { caseId: 'tc_profile', preconditions: ['已登录'], steps: [{ intentId: 'i1', intent: '进入工作流管理' }] },
        candidateMapping: [{ intentId: 'i1', atom: 'nav.workflowManagement', params: {} }],
        flow: { id: 'tc_profile', name: 'profile', category: 'normal', steps: [{ atom: 'nav.workflowManagement', params: {}, sourceIntentId: 'i1' }] },
        lineagePlan: [{ mappingKey: 'm1', sourceIntentId: 'i1' }],
      });
      if (compiled?.ok !== true) return { ok: false, reason: 'COMPILE_REJECTED' };
      return { ok: true, candidateTestCase: {}, candidateMapping: [], eventsCandidate: compiled.compiledEvents, compileLineage: compiled.compileLineage, manifest: {} };
    },
    async openFreshAuthoringRuntime() {
      return { ok: true, authoringRuntimeAuthority: tokens.runtime, page: {}, forensics: {}, state: {}, channelProfileBytes: Buffer.from(JSON.stringify(profile)) };
    },
    async executeAuthoringPreconditions() { return { ok: true }; },
    async verifyAuthoringReset() { return { ok: true }; },
    createCompileRun(input) { compileInput = input; return run; },
    async compileFlow(actual) {
      actual.events.push({ stepId: 'atstep_0', intentId: 'intent_0', atom: 'nav.workflowManagement', action: 'nav', url: '{{baseUrl}}/tenant/workflows' });
      return [{ mappingKey: 'm1', sourceIntentId: 'i1', stepIds: ['atstep_0'] }];
    },
    async closeAuthoringRuntime() { return { ok: true, authoringClosureAuthority: tokens.closure }; },
  });
  const result = await adapter.compileAuthoringCandidate({
    atomRoundtripGrant: tokens.atom, authoringBaselineGrant: tokens.baseline,
    sourceClosureAuthority: tokens.source, runNamespace: 'run_authoring_profile',
    executionTargetAuthority: authority,
  });
  assert(result.ok === true, `authoring adapter 未成功：${JSON.stringify(result)}`);
  assert(compileInput?.profile?.routes?.workflowList === profile.routes.workflowList,
    'exact profile 未传入 createCompileRun');
  assert(compileInput?.listRoute === profile.routes.workflowList
    && compileInput?.agentListRoute === profile.routes.agentList,
  'profile routes 未逐项投影');
});

function captureBytes(caseId = 'tc_profile_input') {
  return Buffer.from(JSON.stringify({
    schemaVersion: 1, artifactKind: 'teach-in-capture', caseId,
    createdAt: '2026-08-03T00:00:00.000Z', startPath: '/home',
    source: { kind: 'manual', signed: false, replayReady: false, distillRequired: true },
    events: [{ seq: 1, action: 'click', path: '/home', selector: '#workflow-management', text: '工作流管理' }],
  }));
}

await check('A3 same-capture cycle input 保留 exact channel profile bytes', () => {
  const caseId = 'tc_profile_input';
  const profileBytes = Buffer.from('{"routes":{"workflowList":"/tenant/workflows"}}');
  const result = generateKnownReadOnlyCycleInput({
    atomRegistry, captureBytes: captureBytes(caseId), caseId, channelProfileBytes: profileBytes,
    entityLockBytes: Buffer.from('[]'), executionTargetAuthority: target(),
    expectedBytes: Buffer.from(JSON.stringify({ caseId, intents: [{ intentId: 'intent_1', expected: [] }], globalAssertions: [] })),
    replayKernelBytes: Buffer.from('{}'), sutBuildDigest: `sha256:${'a'.repeat(64)}`,
    testcaseBytes: Buffer.from(JSON.stringify({ schemaVersion: 1, caseId, preconditions: ['已登录'], steps: [{ intentId: 'intent_1', intent: '进入工作流管理' }] })),
  });
  assert(result.ok === true, `cycle input 未生成：${JSON.stringify(result)}`);
  assert(Buffer.isBuffer(result.cycleInput.sourcePlan.channelProfileBytes),
    'sourcePlan 未携 exact profile bytes');
  assert(result.cycleInput.sourcePlan.channelProfileBytes.equals(profileBytes),
    'sourcePlan profile bytes 与冻结摘要的输入不一致');
});

console.log(`${TAG}: ${passed} 过 / ${failures.length} 败`);
if (failures.length) process.exit(1);
