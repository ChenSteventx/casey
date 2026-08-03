#!/usr/bin/env node
// production compileFlow 必须在仍持有 exact flow step/sourceIntentId 的事实点，把
// compiler-local intent_N 重绑为 authored identity；下游只按 stepId lineage 对账。
// 纯内存 compile run；零 SUT/browser/network/credentials/LLM。

import { compileFlow } from '../../lib/compile-atoms-flow.mjs';
import { validateCompileLineage } from '../../lib/teachin-distillation/compile-lineage.mjs';

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

function makeRun() {
  return {
    events: [], entityBindingProvenance: [], blockers: [], notes: [],
    pendingIdentityObservation: null,
    listRoute: '/synthetic-workflows', agentListRoute: null,
    intentN: 0, stepN: 0,
    newIntent() { return `intent_${this.intentN++}`; },
    async emit(event) {
      const emitted = { ...event, stepId: `atstep_${this.stepN++}` };
      this.events.push(emitted);
      return { resolution: 'unique', candidateCount: 1, acted: true };
    },
    page: {
      url: () => 'http://casey.invalid/synthetic-workflows',
      locator: () => ({ first: () => ({ waitFor: async () => {} }) }),
      getByRole: () => ({ waitFor: async () => {} }),
    },
  };
}

function plan(mappingKey, sourceIntentId) {
  return { mappingKey, sourceIntentId };
}

async function compile(steps, lineagePlan) {
  const run = makeRun();
  const compileLineage = await compileFlow(run, { steps }, { lineagePlan });
  return { run, compileLineage };
}

await check('L1 compiler-local intent_0 必须在产生点重绑 authored sourceIntentId', async () => {
  const lineagePlan = [plan('map_nav', 'authored_workflow_nav')];
  const { run, compileLineage } = await compile([{
    atom: 'nav.workflowManagement', params: {}, sourceIntentId: 'authored_workflow_nav',
  }], lineagePlan);
  assert(run.events.length === 1
    && run.events[0].intentId === 'authored_workflow_nav',
  `compiler-local intent 未重绑：${JSON.stringify(run.events)}`);
  assert(validateCompileLineage({
    lineagePlan, compileLineage, compiledEvents: run.events,
  }).ok === true, 'genuine production lineage 应闭合');
});

await check('L2 multi-step/multi-event 必须逐物理 stepId 保持各自 authored identity', async () => {
  const lineagePlan = [plan('map_a', 'authored_a'), plan('map_b', 'authored_b')];
  const { run, compileLineage } = await compile([
    { atom: 'nav.agentManagement', params: {}, sourceIntentId: 'authored_a' },
    { atom: 'nav.workflowManagement', params: {}, sourceIntentId: 'authored_b' },
  ], lineagePlan);
  const projected = run.events.map((row) => [row.stepId, row.intentId]);
  assert(JSON.stringify(projected) === JSON.stringify([
    ['atstep_0', 'authored_a'], ['atstep_1', 'authored_a'],
    ['atstep_2', 'authored_b'],
  ]), `multi-event source identity 投影失准：${JSON.stringify(projected)}`);
  assert(JSON.stringify(compileLineage.map((row) => row.stepIds))
    === JSON.stringify([['atstep_0', 'atstep_1'], ['atstep_2']]),
  `lineage 未记录 exact event slice：${JSON.stringify(compileLineage)}`);
  assert(validateCompileLineage({
    lineagePlan, compileLineage, compiledEvents: run.events,
  }).ok === true, 'multi-event production lineage 应闭合');
});

await check('L3 missing/duplicate/cross/uncovered lineage 与 local intent 回注必须统一拒绝', async () => {
  const lineagePlan = [plan('map_a', 'authored_a'), plan('map_b', 'authored_b')];
  const { run, compileLineage } = await compile([
    { atom: 'nav.agentManagement', params: {}, sourceIntentId: 'authored_a' },
    { atom: 'nav.workflowManagement', params: {}, sourceIntentId: 'authored_b' },
  ], lineagePlan);
  const attacks = [
    [
      [
        { ...compileLineage[0], stepIds: ['ghost'] },
        compileLineage[1],
      ], run.events,
    ],
    [
      [
        { ...compileLineage[0], stepIds: ['atstep_0'] },
        { ...compileLineage[1], stepIds: ['atstep_0'] },
      ], run.events,
    ],
    [
      [
        { ...compileLineage[0], stepIds: ['atstep_2'] },
        { ...compileLineage[1], stepIds: ['atstep_0', 'atstep_1'] },
      ], run.events,
    ],
    [
      [
        { ...compileLineage[0], stepIds: ['atstep_0'] },
        compileLineage[1],
      ], run.events,
    ],
    [
      compileLineage,
      run.events.map((event, index) => index === 0
        ? { ...event, intentId: 'intent_0' }
        : event),
    ],
  ];
  for (const [tamperedLineage, tamperedEvents] of attacks) {
    const result = validateCompileLineage({
      lineagePlan, compileLineage: tamperedLineage, compiledEvents: tamperedEvents,
    });
    assert(result.ok === false && result.reason === 'COMPILE_LINEAGE_MISMATCH',
      `lineage 攻击竟通过：${JSON.stringify({ tamperedLineage, tamperedEvents })}`);
  }
});

console.log(`${TAG}: ${passed} 过 / ${failures.length} 败`);
if (failures.length) process.exit(1);
