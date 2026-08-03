#!/usr/bin/env node
// canonical Array compile 产物使用 compiler-local intentId；发布 formal candidate 前必须按
// exact stepId lineage 重绑回 authored sourceIntentId。缺失/重复/跨线/未覆盖一律 fail-closed。
// 纯内存 compile seams；零 SUT/browser/network/credentials/LLM。

import { createCompileRuntimeAdapter } from '../../lib/teachin/compile-runtime-adapter.mjs';

const TAG = 'teachin-authoring-compiled-intent-lineage';
const failures = [];
let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${TAG}: ${name}`);
  } catch (error) {
    const detail = String(error?.message || error).slice(-900);
    failures.push(`${name}: ${detail}`);
    console.error(`RED  ${TAG}: ${name}: ${detail}`);
  }
}

const token = () => Object.freeze(Object.create(null));

async function compile({ tag, lineagePlan, compileLineage, compilerEvents }) {
  const owner = token();
  const closure = token();
  const adapter = createCompileRuntimeAdapter({
    async runAtomRoundtrip({ compileAdapter }) {
      const compiled = await compileAdapter({
        candidateTestCase: {
          schemaVersion: 1, caseId: `tc_${tag}`,
          steps: lineagePlan.map((row) => ({
            intentId: row.sourceIntentId, intent: `authored ${row.sourceIntentId}`,
          })),
        },
        flow: {
          id: `flow_${tag}`, name: tag, category: 'test',
          steps: lineagePlan.map((row) => ({
            atom: 'nav.workflowManagement', params: {}, sourceIntentId: row.sourceIntentId,
          })),
        },
        lineagePlan,
      });
      return {
        ok: true,
        candidateTestCase: { caseId: `tc_${tag}` }, candidateMapping: [],
        eventsCandidate: compiled.compiledEvents,
        compileLineage: compiled.compileLineage,
        manifest: {},
      };
    },
    async openFreshAuthoringRuntime() {
      return {
        ok: true, authoringRuntimeAuthority: owner,
        page: token(), forensics: token(), state: {},
      };
    },
    async executeAuthoringPreconditions() { return { ok: true }; },
    async verifyAuthoringReset() { return { ok: true }; },
    createCompileRun() {
      return { events: [], verification: [], blockers: [], notes: [] };
    },
    async compileFlow(run) {
      run.events.push(...compilerEvents.map((event) => ({ ...event })));
      return compileLineage.map((row) => ({
        mappingKey: row.mappingKey,
        sourceIntentId: row.sourceIntentId,
        stepIds: [...row.stepIds],
      }));
    },
    async closeAuthoringRuntime({ authoringRuntimeAuthority }) {
      assert(authoringRuntimeAuthority === owner, '必须关闭 exact authoring owner');
      return { ok: true, authoringClosureAuthority: closure };
    },
  });
  return adapter.compileAuthoringCandidate({
    atomRoundtripGrant: token(), authoringBaselineGrant: token(),
    sourceClosureAuthority: token(), runNamespace: `run_${tag}`,
    executionTargetAuthority: token(),
  });
}

function plan(mappingKey, sourceIntentId) {
  return { mappingKey, sourceIntentId };
}

function lineage(mappingKey, sourceIntentId, stepIds) {
  return { mappingKey, sourceIntentId, stepIds };
}

function event(stepId, intentId, atom = 'nav.workflowManagement') {
  return { stepId, intentId, atom, action: 'nav', url: '{{baseUrl}}/synthetic-path' };
}

await check('L1 authored intentId 与 compiler-local intent_0 不同时，formal event 必须重绑 authored identity', async () => {
  const result = await compile({
    tag: 'lineage_l1',
    lineagePlan: [plan('map_nav', 'authored_workflow_nav')],
    compileLineage: [lineage('map_nav', 'authored_workflow_nav', ['atstep_0'])],
    compilerEvents: [event('atstep_0', 'intent_0')],
  });
  assert(result?.ok === true, `合法 lineage 编译应成功：${JSON.stringify(result)}`);
  const events = result.candidate.eventsCandidate;
  assert(events?.length === 1 && events[0].intentId === 'authored_workflow_nav',
    `compiler-local intent 未重绑 sourceIntentId：${JSON.stringify(events)}`);
});

await check('L2 multi-step/multi-event 必须逐 stepId 精确投影各自 sourceIntentId', async () => {
  const result = await compile({
    tag: 'lineage_l2',
    lineagePlan: [plan('map_a', 'authored_a'), plan('map_b', 'authored_b')],
    compileLineage: [
      lineage('map_a', 'authored_a', ['atstep_0', 'atstep_1']),
      lineage('map_b', 'authored_b', ['atstep_2']),
    ],
    compilerEvents: [
      event('atstep_0', 'intent_0'), event('atstep_1', 'intent_0', 'workflow.open'),
      event('atstep_2', 'intent_1'),
    ],
  });
  assert(result?.ok === true, `合法 multi lineage 编译应成功：${JSON.stringify(result)}`);
  const projected = result.candidate.eventsCandidate.map((row) => [row.stepId, row.intentId]);
  assert(JSON.stringify(projected) === JSON.stringify([
    ['atstep_0', 'authored_a'], ['atstep_1', 'authored_a'], ['atstep_2', 'authored_b'],
  ]), `multi-event source identity 投影失准：${JSON.stringify(projected)}`);
});

await check('L3 lineage 缺 step/重复/跨线/未覆盖必须在 candidate 发布前统一拒绝', async () => {
  const lineagePlan = [plan('map_a', 'authored_a'), plan('map_b', 'authored_b')];
  const compilerEvents = [event('atstep_0', 'intent_0'), event('atstep_1', 'intent_1')];
  const attacks = [
    ['missing-step', [
      lineage('map_a', 'authored_a', ['ghost']),
      lineage('map_b', 'authored_b', ['atstep_1']),
    ]],
    ['duplicate-step', [
      lineage('map_a', 'authored_a', ['atstep_0']),
      lineage('map_b', 'authored_b', ['atstep_0']),
    ]],
    ['cross-lineage', [
      lineage('map_a', 'authored_a', ['atstep_1']),
      lineage('map_b', 'authored_b', ['atstep_0']),
    ]],
    ['uncovered-event', [
      lineage('map_a', 'authored_a', ['atstep_0']),
      lineage('map_b', 'authored_b', ['ghost_b']),
    ]],
  ];
  for (const [label, compileLineage] of attacks) {
    const result = await compile({
      tag: `lineage_l3_${label.replace('-', '_')}`,
      lineagePlan, compileLineage, compilerEvents,
    });
    assert(result?.ok === false && result.reason === 'AUTHORING_COMPILE_FAILED'
      && !result.candidate && !result.authoringClosureAuthority,
    `${label} 竟发布 candidate/closure：${JSON.stringify(result)}`);
  }
});

console.log(`${TAG}: ${passed} 过 / ${failures.length} 败`);
if (failures.length) process.exit(1);
