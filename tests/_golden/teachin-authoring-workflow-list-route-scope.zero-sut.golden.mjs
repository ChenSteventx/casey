#!/usr/bin/env node
// workflow 列表页 pathname 与 scoped 记录容器的联合后置锚。纯内存，零 browser/SUT/network/credentials/LLM。

import { compileNavWorkflowManagement } from '../../lib/compile-atoms-workflow-nav.mjs';

const TAG = 'teachin-authoring-workflow-list-route-scope';
const SCOPED_AGENT_CARD = '.card-list > article.agent-card';
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

function navRun({ currentUrl, urlThrows = false, scopedCardVisible = true } = {}) {
  const evidence = { urlCalls: 0, locatorCalls: 0, successfulWaits: 0, selectors: [] };
  const run = {
    listRoute: '/tenant/workflows',
    blockers: [],
    notes: [],
    newIntent: () => 'intent_0',
    emit: async () => ({ resolution: 'unique', candidateCount: 1, acted: true }),
    page: {
      url() {
        evidence.urlCalls += 1;
        if (urlThrows) throw new Error('PRIVATE_PAGE_URL_SAMPLE_ERROR');
        return currentUrl;
      },
      locator(selector) {
        evidence.locatorCalls += 1;
        evidence.selectors.push(selector);
        const members = String(selector).split(',').map((part) => part.trim());
        return {
          first: () => ({
            async waitFor() {
              if (!scopedCardVisible || !members.includes(SCOPED_AGENT_CARD)) {
                throw new Error('PRIVATE_SCOPED_ANCHOR_ABSENT');
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

await check('R1 正确 pathname + scoped agent-card 可见须联合通过', async () => {
  const { run, evidence } = navRun({
    currentUrl: 'https://synthetic.invalid/tenant/workflows?view=all#records',
  });
  await compileWithoutThrow(run, '正确列表页联合采样');
  assert(evidence.urlCalls === 1, `page.url 采样次数=${evidence.urlCalls}`);
  assert(evidence.successfulWaits === 1,
    `scoped agent-card 未被实际命中：${JSON.stringify(evidence.selectors)}`);
  assert(run.blockers.length === 0, `正确列表页误报 blocker：${JSON.stringify(run.blockers)}`);
});

await check('R2 同源错误 pathname 即使 scoped agent-card 可见也须 blocker', async () => {
  const { run, evidence } = navRun({
    currentUrl: 'https://synthetic.invalid/tenant/agents',
  });
  await compileWithoutThrow(run, '错误列表 pathname 采样');
  assert(run.blockers.length === 1, `错误 pathname blocker 数=${run.blockers.length}`);
  assert(evidence.urlCalls === 1, `错误 pathname 未被采样，page.url 次数=${evidence.urlCalls}`);
  assert(run.notes.length === 1 && run.notes[0] === run.blockers[0], '错误 pathname blocker 未同步进入 notes');
  assert(!JSON.stringify(run).includes('synthetic.invalid'), 'blocker 泄漏目标 origin');
});

await check('R3 page.url 采样异常须 blocker 而非抛穿', async () => {
  const { run, evidence } = navRun({ urlThrows: true });
  await compileWithoutThrow(run, 'page.url 采样异常');
  assert(evidence.urlCalls === 1, `page.url 异常通道采样次数=${evidence.urlCalls}`);
  assert(run.blockers.length === 1, `page.url 异常 blocker 数=${run.blockers.length}`);
  assert(run.notes.length === 1 && run.notes[0] === run.blockers[0], 'page.url 异常 blocker 未同步进入 notes');
  assert(!JSON.stringify(run).includes('PRIVATE_PAGE_URL_SAMPLE_ERROR'), 'blocker 泄漏私有 page.url 异常');
});

console.log(`${TAG}: ${passed} 过 / ${failures.length} 败`);
if (failures.length) process.exit(1);
