#!/usr/bin/env node
// 真机观察到的 workflow 列表记录容器后置锚。纯内存，零 browser/SUT/network/credentials/LLM。

import { compileNavWorkflowManagement } from '../../lib/compile-atoms-workflow-nav.mjs';

const TAG = 'teachin-authoring-workflow-list-container';
let passed = 0;
const failures = [];
const assert = (condition, message) => { if (!condition) throw new Error(message); };

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${TAG}: ${name}`);
  } catch (error) {
    const detail = String(error?.message || error).slice(-800);
    failures.push(`${name}: ${detail}`);
    console.error(`RED  ${TAG}: ${name}: ${detail}`);
  }
}

function navRun({ visibleSelector = null, locatorThrows = false } = {}) {
  const evidence = { locatorCalls: 0, successfulWaits: 0, selectors: [] };
  const run = {
    listRoute: '/tenant/workflows',
    blockers: [],
    notes: [],
    newIntent: () => 'intent_0',
    emit: async () => ({ resolution: 'unique', candidateCount: 1, acted: true }),
    page: {
      locator(selector) {
        evidence.locatorCalls += 1;
        evidence.selectors.push(selector);
        if (locatorThrows) throw new Error('PRIVATE_LOCATOR_SAMPLE_ERROR');
        const members = String(selector).split(',').map((part) => part.trim());
        return {
          first: () => ({
            async waitFor() {
              if (!visibleSelector || !members.includes(visibleSelector)) {
                throw new Error('PRIVATE_ANCHOR_ABSENT');
              }
              evidence.successfulWaits += 1;
            },
          }),
        };
      },
    },
  };
  return { run, evidence };
}

async function compileWithoutThrow(run, label) {
  try {
    await compileNavWorkflowManagement(run);
  } catch {
    throw new Error(`${label} 抛穿，未转为 fail-closed blocker`);
  }
}

await check('A1 真机 .agent-card 可见须被实际命中且零 blocker', async () => {
  const { run, evidence } = navRun({ visibleSelector: '.agent-card' });
  await compileWithoutThrow(run, '.agent-card 采样');
  assert(evidence.successfulWaits === 1,
    `.agent-card 未被后置锚 selector 实际命中：${JSON.stringify(evidence.selectors)}`);
  assert(run.blockers.length === 0, `.agent-card 可见却误报 blocker：${JSON.stringify(run.blockers)}`);
});

await check('A2 legacy .hr-table-row 与 .hr-card.hr-card--bordered 仍兼容', async () => {
  for (const visibleSelector of ['.hr-table-row', '.hr-card.hr-card--bordered']) {
    const { run, evidence } = navRun({ visibleSelector });
    await compileWithoutThrow(run, `${visibleSelector} 采样`);
    assert(evidence.successfulWaits === 1,
      `${visibleSelector} 未被后置锚 selector 实际命中：${JSON.stringify(evidence.selectors)}`);
    assert(run.blockers.length === 0,
      `${visibleSelector} 可见却误报 blocker：${JSON.stringify(run.blockers)}`);
  }
});

await check('A3 所有列表记录容器缺席须形成唯一 blocker 且不泄漏采样异常', async () => {
  const { run } = navRun();
  await compileWithoutThrow(run, '缺席锚等待');
  assert(run.blockers.length === 1, `完全缺席 blocker 数=${run.blockers.length}`);
  assert(run.notes.length === 1 && run.notes[0] === run.blockers[0], '缺席 blocker 未同步进入 notes');
  assert(!JSON.stringify(run).includes('PRIVATE_ANCHOR_ABSENT'), '缺席 blocker 泄漏私有采样异常');
});

await check('A4 locator 采样异常须形成唯一 blocker 而非抛穿', async () => {
  const { run, evidence } = navRun({ locatorThrows: true });
  await compileWithoutThrow(run, 'locator 采样异常');
  assert(evidence.locatorCalls === 1, `locator 采样次数=${evidence.locatorCalls}`);
  assert(run.blockers.length === 1, `采样异常 blocker 数=${run.blockers.length}`);
  assert(run.notes.length === 1 && run.notes[0] === run.blockers[0], '采样异常 blocker 未同步进入 notes');
  assert(!JSON.stringify(run).includes('PRIVATE_LOCATOR_SAMPLE_ERROR'), 'blocker 泄漏私有 locator 异常');
});

console.log(`${TAG}: ${passed} 过 / ${failures.length} 败`);
if (failures.length) process.exit(1);
