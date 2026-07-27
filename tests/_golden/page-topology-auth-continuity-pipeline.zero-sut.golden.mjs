#!/usr/bin/env node
// record → source topology → distill projection → formal topology parity；纯函数，零 I/O/SUT/browser/network。

import { buildTeachInCapture } from '../../lib/record-capture.mjs';
import { projectCapture } from '../../lib/record-distill.mjs';

const TAG = 'page-topology-auth-continuity-pipeline';
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
    failures.push(`${name}: ${String(error?.message || error).slice(-900)}`);
    console.error(`RED  ${TAG}: ${name}: ${String(error?.message || error).slice(-900)}`);
  }
}

let topologyApi = null;
let replayApi = null;
try {
  topologyApi = await import('../../lib/page-topology/topology-events.mjs');
} catch (error) {
  failures.push(`导入 topology-events 失败（实现前预期红）：${String(error?.message || error).slice(-300)}`);
}
try {
  replayApi = await import('../../lib/page-topology/replay-bridge.mjs');
} catch (error) {
  failures.push(`导入 replay-bridge 失败（实现前预期红）：${String(error?.message || error).slice(-300)}`);
}

const SOURCE_EVENTS = [
  { action: 'click', path: '/home', selector: 'a.agents', text: '智能体管理' },
  { action: 'newpage', path: '/agents?view=all' },
  { action: 'click', path: '/agents?view=all', selector: 'button.refresh', text: '刷新' },
];

const FORMAL_EVENTS = [
  {
    stepId: 'atstep_0',
    intentId: 'intent_1',
    atom: 'agent.searchOpen',
    action: 'click',
    semantic: { kind: 'text', name: '智能体管理', exact: true },
  },
  {
    stepId: 'atstep_1',
    intentId: 'intent_1',
    atom: 'agent.searchOpen',
    action: 'newpage',
    url: '{{baseUrl}}/agents?view=all',
  },
  {
    stepId: 'atstep_2',
    intentId: 'intent_2',
    atom: 'agent.searchOpen',
    action: 'click',
    semantic: { kind: 'text', name: '刷新', exact: true },
  },
];

await check('P1 manual capture 忠实保留 newpage，不降成 click', () => {
  const capture = buildTeachInCapture({
    caseId: 'tc_topology_pipeline',
    startUrl: 'https://record-source.invalid/home',
    createdAt: '2026-07-27T00:00:00.000Z',
    events: SOURCE_EVENTS,
  });
  assert(capture.events.length === 3, 'capture event 数漂移');
  assert(capture.events[1].action === 'newpage', `newpage 被改写为 ${capture.events[1].action}`);
  assert(capture.events[1].path === '/agents?view=all', 'newpage path+query 未保留');
  const text = JSON.stringify(capture);
  assert(!text.includes('record-source.invalid') && !text.includes('://'), 'capture 不得落 host/origin');
});

await check('P2 distill 把 newpage 归前一业务 intent，projection 保留但不建独立 step/pending', () => {
  const capture = buildTeachInCapture({
    caseId: 'tc_topology_pipeline',
    startUrl: '/home',
    createdAt: '2026-07-27T00:00:00.000Z',
    events: SOURCE_EVENTS,
  });
  const result = projectCapture(capture);
  assert(result.candidateTestCase.steps.length === 2,
    `newpage 不应变独立用户 step，实际 ${result.candidateTestCase.steps.length}`);
  assert(result.pending.length === 2, `newpage 不应变独立 pending，实际 ${result.pending.length}`);
  assert(result.projection.length === 3, 'projection 必须保留全部三事件');
  const [click, newpage, popupClick] = result.projection;
  assert(click.intentId === newpage.intentId, 'newpage 必须归触发 click 的 intent');
  assert(newpage.action === 'newpage' && newpage.topologyRole === 'handoff', 'newpage projection 标识不符');
  assert(popupClick.intentId !== newpage.intentId, 'popup 后业务动作须是下一 intent');
});

await check('P3 capture/formal topology normalization 等价且只保留安全 path', () => {
  assert(topologyApi, 'topology-events 模块缺失');
  const source = topologyApi.normalizeTopologySequence({ events: SOURCE_EVENTS, format: 'capture' });
  const formal = topologyApi.normalizeTopologySequence({ events: FORMAL_EVENTS, format: 'formal' });
  assert(source?.ok === true && formal?.ok === true, 'source/formal normalization 应成功');
  assert(JSON.stringify(source.sequence) === JSON.stringify(formal.sequence),
    `source/formal topology 应等价：${JSON.stringify({ source, formal })}`);
  assert(source.sequence.length === 1, '应恰一条 newpage transition');
  assert(source.sequence[0].path === '/agents?view=all'
    && source.sequence[0].afterActionIndex === 0, 'transition path/order 不符');
  assert(!JSON.stringify(source).includes('://'), 'normalized topology 不得含 origin');
});

await check('P4 source/distilled topology parity 丢失、错序、错 path 都 fail-closed', () => {
  assert(topologyApi, 'topology-events 模块缺失');
  const good = topologyApi.assertTopologyParity({
    sourceEvents: SOURCE_EVENTS,
    distilledEvents: FORMAL_EVENTS,
  });
  assert(good?.ok === true, `等价 topology 应通过：${JSON.stringify(good)}`);
  const dropped = topologyApi.assertTopologyParity({
    sourceEvents: SOURCE_EVENTS,
    distilledEvents: FORMAL_EVENTS.filter((event) => event.action !== 'newpage'),
  });
  assert(dropped?.ok === false && dropped.reason === 'TOPOLOGY_EVENT_DROPPED',
    `丢 newpage 应拒：${JSON.stringify(dropped)}`);
  const wrongPath = FORMAL_EVENTS.map((event) => (
    event.action === 'newpage' ? { ...event, url: '{{baseUrl}}/wrong' } : event
  ));
  const mismatch = topologyApi.assertTopologyParity({
    sourceEvents: SOURCE_EVENTS,
    distilledEvents: wrongPath,
  });
  assert(mismatch?.ok === false && mismatch.reason === 'TOPOLOGY_PARITY_MISMATCH',
    `错 path 应拒：${JSON.stringify(mismatch)}`);
});

await check('P5 orphan/重复 newpage 与 host-bearing capture path 具名拒绝', () => {
  assert(topologyApi, 'topology-events 模块缺失');
  for (const [reason, events] of [
    ['TOPOLOGY_TRIGGER_MISSING', [{ action: 'newpage', path: '/orphan' }]],
    ['PAGE_HANDOFF_AMBIGUOUS', [
      { action: 'click', path: '/home' },
      { action: 'newpage', path: '/one' },
      { action: 'newpage', path: '/two' },
    ]],
    ['TOPOLOGY_PATH_INVALID', [
      { action: 'click', path: '/home' },
      { action: 'newpage', path: 'https://host-must-not-persist.invalid/private' },
    ]],
  ]) {
    const result = topologyApi.normalizeTopologySequence({ events, format: 'capture' });
    assert(result?.ok === false && result.reason === reason,
      `应拒因 ${reason}：${JSON.stringify(result)}`);
    assert(!JSON.stringify(result).includes('host-must-not-persist'), '错误不得回显 host');
  }
});

await check('P6 source capture 与 distilled formal sequence 均由同一 replay bridge 消费', async () => {
  assert(replayApi, 'replay-bridge 模块缺失');
  function controllerDouble() {
    const calls = [];
    let authority = Object.freeze({});
    return {
      calls,
      controller: {
        activePageAuthority() {
          return authority;
        },
        async consumeNewPageEvent(input) {
          calls.push(input);
          authority = Object.freeze({});
          return { ok: true, activePageAuthority: authority };
        },
      },
    };
  }
  const source = controllerDouble();
  const distilled = controllerDouble();
  const sourceResult = await replayApi.consumeTopologySequence({
    controller: source.controller,
    events: SOURCE_EVENTS,
    format: 'capture',
  });
  const distilledResult = await replayApi.consumeTopologySequence({
    controller: distilled.controller,
    events: FORMAL_EVENTS,
    format: 'formal',
  });
  assert(sourceResult?.ok === true && distilledResult?.ok === true, '两种 sequence 都应消费成功');
  assert(source.calls.length === 1 && distilled.calls.length === 1, '两种 sequence 均应恰消费一条 newpage');
  for (const call of [...source.calls, ...distilled.calls]) {
    assert(call.event?.action === 'newpage' && call.event.path === '/agents?view=all',
      `bridge 应交 canonical topology event：${JSON.stringify(call.event)}`);
  }
});

if (failures.length) {
  for (const failure of failures.filter((item) => item.startsWith('导入 '))) console.error(`RED  ${TAG}: ${failure}`);
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
