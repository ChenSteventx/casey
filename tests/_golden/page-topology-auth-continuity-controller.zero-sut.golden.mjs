#!/usr/bin/env node
// Page topology controller：纯 context/page double，零 browser/SUT/network。

import {
  createContextDouble,
  createPageDouble,
} from './fixtures/page-topology-auth-continuity/context-double.mjs';

const TAG = 'page-topology-auth-continuity-controller';
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
    failures.push(`${name}: ${String(error?.message || error).slice(-800)}`);
    console.error(`RED  ${TAG}: ${name}: ${String(error?.message || error).slice(-800)}`);
  }
}

let createPageTopologyController;
try {
  ({ createPageTopologyController } = await import('../../lib/page-topology/controller.mjs'));
  assert(typeof createPageTopologyController === 'function', '未导出 createPageTopologyController');
} catch (error) {
  console.error(`RED  ${TAG}: 导入验收 API 失败（实现前预期红）：${String(error?.message || error).slice(-300)}`);
  process.exit(1);
}

const ORIGIN = 'https://topology-synthetic.invalid';
const IDS = ['pg_alpha', 'pg_beta', 'pg_gamma', 'pg_delta', 'pg_epsilon', 'pg_zeta'];

async function harness() {
  const initial = createPageDouble({
    name: 'initial-private-name',
    url: `${ORIGIN}/home`,
    absentTokens: ['popup-only'],
  });
  const context = createContextDouble({ initialPages: [initial] });
  const forensicPages = [];
  let idIndex = 0;
  const started = await createPageTopologyController({
    context,
    initialPage: initial,
    idFactory: () => IDS[idIndex++],
    attachForensics: async ({ pageId }) => {
      forensicPages.push(pageId);
    },
  });
  assert(started?.ok === true && started.controller && started.activePageAuthority,
    `controller 应启动成功：${JSON.stringify(started)}`);
  return { initial, context, forensicPages, ...started };
}

function assertPublicSafe(value, label) {
  const text = JSON.stringify(value);
  for (const forbidden of ['topology-synthetic.invalid', 'initial-private-name', 'popup-private-name', '://']) {
    assert(!text.includes(forbidden), `${label} 泄漏 ${forbidden}`);
  }
}

await check('C1 context listener 先装、初始页获 opaque active authority 与一次取证', async () => {
  const h = await harness();
  assert(h.context.calls.contextOn[0] === 'page', '第一个 context listener 必须是 page');
  assert(h.forensicPages.length === 1 && h.forensicPages[0] === 'pg_alpha', '初始页应恰挂一次取证');
  assert(Object.isFrozen(h.activePageAuthority), 'active page authority 须冻结');
  assert(h.controller.activePageAuthority() === h.activePageAuthority, 'controller active authority 不一致');
  assertPublicSafe({ receipt: h.receipt, authority: h.activePageAuthority }, '启动公开结果');
});

await check('C2 click 产生 0 个新页时保持 active，perform 恰一次', async () => {
  const h = await harness();
  let calls = 0;
  const result = await h.controller.performClick({
    pageAuthority: h.activePageAuthority,
    perform: async (page) => {
      calls += 1;
      assert(page === h.initial, 'perform 必须拿 authority 对应真实页');
    },
  });
  assert(result?.ok === true, `0-page click 应成功：${JSON.stringify(result)}`);
  assert(result.handoff?.kind === 'none' && result.handoff.candidateCount === 0, '0-page handoff 形状不符');
  assert(calls === 1, `perform 应恰一次，实际 ${calls}`);
  assert(h.controller.activePageAuthority() === h.activePageAuthority, '0-page 不得切 active');
  assertPublicSafe(result, '0-page result');
});

await check('C3 click 恰生一个同源 popup 后切 active；close 自动回 opener', async () => {
  const h = await harness();
  const popup = createPageDouble({
    name: 'popup-private-name',
    url: `${ORIGIN}/agents?view=all`,
    opener: h.initial,
  });
  const result = await h.controller.performClick({
    pageAuthority: h.activePageAuthority,
    perform: async () => h.context.emitPage(popup),
  });
  assert(result?.ok === true && result.handoff?.kind === 'newpage',
    `1-page click 应成功 handoff：${JSON.stringify(result)}`);
  assert(result.handoff.candidateCount === 1, '1-page candidateCount 不符');
  assert(result.handoff.pageId === 'pg_beta' && result.handoff.openerPageId === 'pg_alpha',
    `opaque page/opener 不符：${JSON.stringify(result.handoff)}`);
  assert(result.handoff.path === '/agents?view=all', 'handoff 只公开 path+query');
  const popupAuthority = result.activePageAuthority;
  assert(h.controller.activePageAuthority() === popupAuthority, 'popup 应成为 active');
  assert(h.forensicPages.join(',') === 'pg_alpha,pg_beta', 'popup 应在激活前挂取证');
  await popup.close();
  assert(h.controller.activePageAuthority() === h.activePageAuthority, 'popup close 应回原 opener');
  const stale = await h.controller.evaluateActive({
    pageAuthority: popupAuthority,
    evaluate: async () => true,
  });
  assert(stale?.ok === false && stale.reason === 'PAGE_AUTHORITY_STALE', '已关 popup authority 必须失效');
  assertPublicSafe(result, '1-page result');
});

await check('C4 click 产生多个 page 时拒绝任挑，active 保持 opener', async () => {
  const h = await harness();
  const p1 = createPageDouble({ name: 'p1', url: `${ORIGIN}/one`, opener: h.initial });
  const p2 = createPageDouble({ name: 'p2', url: `${ORIGIN}/two`, opener: h.initial });
  const result = await h.controller.performClick({
    pageAuthority: h.activePageAuthority,
    perform: async () => {
      await h.context.emitPage(p1);
      await h.context.emitPage(p2);
    },
  });
  assert(result?.ok === false && result.reason === 'PAGE_HANDOFF_AMBIGUOUS',
    `>1 page 应拒：${JSON.stringify(result)}`);
  assert(result.candidateCount === 2 && result.verdictHint === 'NEEDS_HUMAN', 'ambiguous 证据不符');
  assert(h.controller.activePageAuthority() === h.activePageAuthority, 'ambiguous 不得切 active');
  assert(h.forensicPages.join(',') === 'pg_alpha,pg_beta,pg_gamma', 'ambiguous 页仍须逐页挂取证');
  assertPublicSafe(result, '>1-page result');
});

await check('C5 clone/forge/旧 opener authority 都在 DOM 动作前拒绝', async () => {
  const h = await harness();
  for (const pageAuthority of [
    structuredClone(h.activePageAuthority),
    { ...h.activePageAuthority },
    JSON.parse(JSON.stringify(h.activePageAuthority)),
    Object.freeze({}),
  ]) {
    let performed = 0;
    const result = await h.controller.performClick({
      pageAuthority,
      perform: async () => {
        performed += 1;
      },
    });
    assert(result?.ok === false && result.reason === 'PAGE_AUTHORITY_INVALID',
      `伪造 authority 应拒：${JSON.stringify(result)}`);
    assert(performed === 0, '伪造 authority 不得触发 perform');
  }

  const popup = createPageDouble({ name: 'popup-private-name', url: `${ORIGIN}/popup`, opener: h.initial });
  const handoff = await h.controller.performClick({
    pageAuthority: h.activePageAuthority,
    perform: async () => h.context.emitPage(popup),
  });
  let oldPageAssertionCalls = 0;
  const stale = await h.controller.evaluateActive({
    pageAuthority: h.activePageAuthority,
    evaluate: async () => {
      oldPageAssertionCalls += 1;
      return true;
    },
  });
  assert(stale?.ok === false && stale.reason === 'PAGE_AUTHORITY_STALE'
    && stale.verdictHint === 'NEEDS_HUMAN', '非活动 opener 必须 stale');
  assert(oldPageAssertionCalls === 0 && h.initial.calls.assertions.length === 0,
    '旧 opener 的缺席断言 callback 必须零调用');
  const current = await h.controller.evaluateActive({
    pageAuthority: handoff.activePageAuthority,
    evaluate: (page) => page.assertAbsent('popup-only'),
  });
  assert(current?.ok === true && current.value === false,
    `断言必须落 popup，不能用 opener 缺席结果假绿：${JSON.stringify(current)}`);
  assert(popup.calls.assertions.length === 1, 'popup assertion 应恰执行一次');
});

await check('C6 opener 未登记或 opener 已关闭时 fail-closed', async () => {
  const h = await harness();
  const foreign = createPageDouble({ name: 'foreign', url: `${ORIGIN}/foreign` });
  const popup = createPageDouble({ name: 'popup-private-name', url: `${ORIGIN}/popup`, opener: foreign });
  const result = await h.controller.performClick({
    pageAuthority: h.activePageAuthority,
    perform: async () => h.context.emitPage(popup),
  });
  assert(result?.ok === false && result.reason === 'OPENER_AUTHORITY_MISSING',
    `未知 opener 应拒：${JSON.stringify(result)}`);
  assert(h.controller.activePageAuthority() === h.activePageAuthority, '未知 opener 不得切 active');
});

await check('C7 handoff boundary authority 不可伪造、不可重放且 clone 在动作前拒绝', async () => {
  const h = await harness();
  const captured = h.controller.captureHandoffBoundary({
    pageAuthority: h.activePageAuthority,
    sourcePage: h.initial,
  });
  assert(captured?.ok === true && captured.handoffBoundaryAuthority,
    `boundary authority 应成功：${JSON.stringify(captured)}`);
  assert(Object.isFrozen(captured.handoffBoundaryAuthority),
    'boundary authority 必须冻结');
  assert(JSON.stringify(captured.handoffBoundaryAuthority) === '{}',
    'boundary authority 不得暴露 ordinal/generation');

  let performed = 0;
  const cloned = await h.controller.performClick({
    pageAuthority: h.activePageAuthority,
    handoffBoundaryAuthority: structuredClone(captured.handoffBoundaryAuthority),
    perform: async () => {
      performed += 1;
    },
  });
  assert(cloned?.ok === false && cloned.reason === 'PAGE_HANDOFF_BOUNDARY_INVALID',
    `clone boundary 应拒：${JSON.stringify(cloned)}`);
  assert(performed === 0, 'clone boundary 不得触发 perform');

  const accepted = await h.controller.performClick({
    pageAuthority: h.activePageAuthority,
    handoffBoundaryAuthority: captured.handoffBoundaryAuthority,
    perform: async () => {
      performed += 1;
    },
  });
  assert(accepted?.ok === true && accepted.handoff?.kind === 'none',
    `原 authority 应一次成功：${JSON.stringify(accepted)}`);
  const replayed = await h.controller.performClick({
    pageAuthority: h.activePageAuthority,
    handoffBoundaryAuthority: captured.handoffBoundaryAuthority,
    perform: async () => {
      performed += 1;
    },
  });
  assert(replayed?.ok === false
    && replayed.reason === 'PAGE_HANDOFF_BOUNDARY_INVALID',
  `已消费 boundary 必须拒绝重放：${JSON.stringify(replayed)}`);
  assert(performed === 1, `boundary 应只放行一次 perform，实际 ${performed}`);
  assertPublicSafe({ captured, cloned, accepted, replayed }, 'boundary authority result');
});

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
