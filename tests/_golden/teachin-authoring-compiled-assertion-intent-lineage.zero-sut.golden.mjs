#!/usr/bin/env node
// lineagePlan 把 event 从 compiler-local intent_N 重绑到 authored sourceIntentId 后，
// 同一 compile run 的 lastIntentId 与随后 assert.* 折叠也必须沿用该 authored identity。
// 纯内存 compile run；零 SUT/browser/network/credentials/LLM。

import { compileFlow } from '../../lib/compile-atoms-flow.mjs';

const TAG = 'teachin-authoring-compiled-assertion-intent-lineage';
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
    events: [], assertionAtoms: [], entityBindingProvenance: [], blockers: [], notes: [],
    pendingIdentityObservation: null,
    listRoute: '/synthetic-workflows', agentListRoute: null,
    intentN: 0, stepN: 0, lastIntentId: null,
    newIntent() { return `intent_${this.intentN++}`; },
    async emit(event) {
      this.lastIntentId = event.intentId;
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

await check('A1 event 重绑后 lastIntentId 与随后 assert.* 必须保持 authored identity', async () => {
  const authoredIntentId = 'authored_workflow_nav';
  const run = makeRun();

  await compileFlow(run, { steps: [{
    atom: 'nav.workflowManagement', params: {}, sourceIntentId: authoredIntentId,
  }] }, { lineagePlan: [{ mappingKey: 'map_nav', sourceIntentId: authoredIntentId }] });

  assert(run.events.length === 1 && run.events[0].intentId === authoredIntentId,
    `前置 event 尚未重绑 authored identity：${JSON.stringify(run.events)}`);

  await compileFlow(run, { steps: [{
    atom: 'assert.textVisible', params: { text: '工作流管理' },
  }] });

  assert(run.lastIntentId === authoredIntentId
    && run.assertionAtoms.length === 1
    && run.assertionAtoms[0].intentId === authoredIntentId,
  `event 已重绑但 assertion fold 仍泄漏 compiler-local identity：${JSON.stringify({
    eventIntentId: run.events[0].intentId,
    lastIntentId: run.lastIntentId,
    assertionAtoms: run.assertionAtoms,
  })}`);
});

console.log(`${TAG}: ${passed} 过 / ${failures.length} 败`);
if (failures.length) process.exit(1);
