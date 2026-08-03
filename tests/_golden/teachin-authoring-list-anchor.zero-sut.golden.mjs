#!/usr/bin/env node
// authoring nav 后置锚与发布门。纯内存，零 browser/SUT/network/credentials/LLM。

import { compileNavWorkflowManagement } from '../../lib/compile-atoms-workflow-nav.mjs';
import { createCompileRuntimeAdapter } from '../../lib/teachin/compile-runtime-adapter.mjs';

const TAG = 'teachin-authoring-list-anchor';
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

function navRun({ anchor = true } = {}) {
  return {
    listRoute: '/tenant/workflows', blockers: [], notes: [],
    newIntent: () => 'intent_0',
    emit: async () => ({ resolution: 'unique', candidateCount: 1, acted: true }),
    page: {
      locator: () => ({
        first: () => ({
          waitFor: async () => { if (!anchor) throw new Error('ANCHOR_MISSING_PRIVATE'); },
        }),
      }),
    },
  };
}

await check('B1 列表后置锚缺席/异常必须写 blocker，成功锚零 blocker', async () => {
  const missing = navRun({ anchor: false });
  await compileNavWorkflowManagement(missing);
  assert(missing.blockers.length === 1, '列表锚缺席未形成唯一 blocker');
  assert(!JSON.stringify(missing).includes('ANCHOR_MISSING_PRIVATE'), 'blocker 泄漏私有异常');
  const present = navRun({ anchor: true });
  await compileNavWorkflowManagement(present);
  assert(present.blockers.length === 0, '列表锚成功却误报 blocker');
});

function token() { return Object.freeze(Object.create(null)); }
const TOKENS = Object.freeze({
  atom: token(), baseline: token(), source: token(), target: token(), runtime: token(), closure: token(),
});

function authoringAdapter({ addBlocker = false, acted = true } = {}) {
  const run = { events: [], verification: [], blockers: [] };
  return createCompileRuntimeAdapter({
    async runAtomRoundtrip({ compileAdapter }) {
      try {
        const compiled = await compileAdapter({
          candidateTestCase: { caseId: 'tc_anchor', steps: [{ intentId: 'i1', intent: '进入工作流管理' }] },
          candidateMapping: [{ intentId: 'i1', atom: 'nav.workflowManagement', params: {} }],
          flow: { id: 'tc_anchor', name: 'anchor', category: 'normal', steps: [{ atom: 'nav.workflowManagement', params: {}, sourceIntentId: 'i1' }] },
          lineagePlan: [{ mappingKey: 'm1', sourceIntentId: 'i1' }],
        });
        if (compiled?.ok !== true) return { ok: false, reason: 'COMPILE_REJECTED' };
        return { ok: true, candidateTestCase: {}, candidateMapping: [], eventsCandidate: compiled.compiledEvents, compileLineage: compiled.compileLineage, manifest: {} };
      } catch {
        return { ok: false, reason: 'COMPILE_REJECTED' };
      }
    },
    async openFreshAuthoringRuntime() {
      return { ok: true, authoringRuntimeAuthority: TOKENS.runtime, page: {}, forensics: {}, state: {} };
    },
    async executeAuthoringPreconditions() { return { ok: true }; },
    async verifyAuthoringReset() { return { ok: true }; },
    createCompileRun() { return run; },
    async compileFlow(actual) {
      actual.events.push({ stepId: 'atstep_0', intentId: 'intent_0', atom: 'nav.workflowManagement', action: 'nav', url: '{{baseUrl}}/tenant/workflows' });
      actual.verification.push({ resolution: 'unique', candidateCount: 1, acted });
      if (addBlocker) actual.blockers.push('ANCHOR_MISSING_FIXED');
      return [{ mappingKey: 'm1', sourceIntentId: 'i1', stepIds: ['atstep_0'] }];
    },
    async closeAuthoringRuntime() { return { ok: true, authoringClosureAuthority: TOKENS.closure }; },
  });
}

async function compile(options) {
  return authoringAdapter(options).compileAuthoringCandidate({
    atomRoundtripGrant: TOKENS.atom,
    authoringBaselineGrant: TOKENS.baseline,
    sourceClosureAuthority: TOKENS.source,
    runNamespace: 'run_authoring_anchor',
    executionTargetAuthority: TOKENS.target,
  });
}

await check('B2 blocker 或非 acted verification 均禁止发布 authoring candidate', async () => {
  for (const [label, options] of [
    ['blocker', { addBlocker: true }],
    ['not-acted', { acted: false }],
  ]) {
    const result = await compile(options);
    assert(result?.ok === false && result.reason === 'AUTHORING_COMPILE_FAILED',
      `${label} 未固定拒绝发布：${JSON.stringify(result)}`);
    assert(!result.candidate && !result.authoringClosureAuthority,
      `${label} 失败仍发布 candidate/closure`);
  }
});

console.log(`${TAG}: ${passed} 过 / ${failures.length} 败`);
if (failures.length) process.exit(1);
