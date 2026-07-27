#!/usr/bin/env node
// Playwright 的 context "page" 事件通常早于 popup 首次导航：注册时 about:blank，
// 随后才到目标 URL。本门冻结 listener-first 安装与延迟同源 handoff 的兼容。

import { createPageTopologyController } from '../../lib/page-topology/controller.mjs';
import { createRecordBridgeSession } from '../../lib/page-topology/record-bridge.mjs';
import { createSessionSeedAuthority } from '../../lib/page-topology/session-seed.mjs';

const TAG = 'page-topology-auth-continuity-delayed-popup';
const ORIGIN = 'https://delayed-popup.invalid';
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

function pageDouble({ url, opener = null } = {}) {
  let currentUrl = url;
  let closed = false;
  const listeners = new Map();
  const initPayloads = [];
  const storage = new Map();
  const calls = { init: 0, close: 0, loadWait: 0 };

  function emit(event) {
    for (const handler of listeners.get(event) || []) handler();
  }

  function applyInit() {
    let origin = null;
    try { origin = new URL(currentUrl).origin; } catch { origin = null; }
    for (const payload of initPayloads) {
      if (origin !== payload?.origin) continue;
      for (const [key, value] of payload.entries || []) storage.set(key, value);
    }
  }

  const page = {
    calls,
    storage,
    url() { return currentUrl; },
    async opener() { return opener; },
    on(event, handler) {
      const entries = listeners.get(event) || [];
      entries.push(handler);
      listeners.set(event, entries);
    },
    isClosed() { return closed; },
    async close() {
      if (closed) return;
      closed = true;
      calls.close += 1;
      emit('close');
    },
    async addInitScript(_script, payload) {
      calls.init += 1;
      initPayloads.push(payload);
      applyInit();
    },
    async waitForLoadState() {
      calls.loadWait += 1;
      if (currentUrl !== 'about:blank') return;
      await new Promise((resolve) => {
        const entries = listeners.get('load') || [];
        entries.push(resolve);
        listeners.set('load', entries);
      });
    },
    navigate(nextUrl) {
      currentUrl = nextUrl;
      applyInit();
      emit('load');
    },
  };
  return page;
}

function contextDouble(initialPage) {
  const listeners = new Map();
  const pages = [initialPage];
  return {
    pages() { return [...pages]; },
    on(event, handler) {
      const entries = listeners.get(event) || [];
      entries.push(handler);
      listeners.set(event, entries);
    },
    emitPage(page, { navigateTo, delayMs = 5 } = {}) {
      pages.push(page);
      for (const handler of listeners.get('page') || []) handler(page);
      if (navigateTo) setTimeout(() => page.navigate(navigateTo), delayMs);
    },
  };
}

async function recordHarness({ settleAfterClick = async () => {} } = {}) {
  const initial = pageDouble({ url: `${ORIGIN}/home` });
  const context = contextDouble(initial);
  const events = [];
  const created = createRecordBridgeSession({
    context,
    emitEvent: (event) => events.push(event),
    settleAfterClick,
  });
  assert(created?.ok === true, `record bridge 创建失败：${JSON.stringify(created)}`);
  context.on('page', (page) => created.bridge.observePage(page));
  const activated = await created.bridge.activate({ initialPage: initial });
  assert(activated?.ok === true, `record bridge 激活失败：${JSON.stringify(activated)}`);
  return { initial, context, events, ...created };
}

await check('D1 about:blank 注册后延迟同源导航仍完成 handoff 与 session seed', async () => {
  const initial = pageDouble({ url: `${ORIGIN}/home` });
  const context = contextDouble(initial);
  const seed = createSessionSeedAuthority({
    origin: ORIGIN,
    entries: [['session-key', 'session-value']],
  });
  assert(seed?.ok === true, '合成 session seed authority 应成功');
  const forensicPages = [];
  let id = 0;
  const started = await createPageTopologyController({
    context,
    initialPage: initial,
    sessionSeedAuthority: seed.authority,
    attachForensics: async ({ pageId }) => forensicPages.push(pageId),
    idFactory: () => `pg_${++id}`,
  });
  assert(started?.ok === true, `controller 启动失败：${JSON.stringify(started)}`);

  const popup = pageDouble({ url: 'about:blank', opener: initial });
  const result = await started.controller.performClick({
    pageAuthority: started.activePageAuthority,
    perform: async () => {
      context.emitPage(popup, {
        navigateTo: `${ORIGIN}/agents?view=all`,
      });
    },
  });
  assert(result?.ok === true && result.handoff?.kind === 'newpage',
    `延迟 popup 应 handoff：${JSON.stringify(result)}`);
  assert(result.handoff.path === '/agents?view=all', 'handoff 应使用导航完成后的安全 path');
  assert(started.controller.activePageAuthority() === result.activePageAuthority,
    '延迟 popup 应成为唯一 active page');
  assert(popup.calls.init === 1,
    `init 必须 listener-first 且恰一次：${JSON.stringify(popup.calls)}`);
  assert(popup.storage.get('session-key') === 'session-value',
    '同源导航首次脚本执行应获得 session seed');
  assert(forensicPages.join(',') === 'pg_1,pg_2', 'popup 激活前须恰挂一次取证');
  const publicText = JSON.stringify(result);
  for (const forbidden of ['delayed-popup.invalid', 'session-key', 'session-value', '://']) {
    assert(!publicText.includes(forbidden), `公开 handoff 泄漏 ${forbidden}`);
  }
});

await check('D2 binding 到达后、queued performClick 前 popup 不得漏 newpage', async () => {
  const h = await recordHarness();
  const popup = pageDouble({ url: `${ORIGIN}/agents`, opener: h.initial });

  const handled = h.bridge.handleBinding(
    { page: h.initial },
    { action: 'click', path: '/home', selector: '#open-agents' },
  );
  // handleBinding 返回后 queued processEvent 尚未开始；page listener 先到是
  // Playwright 协议可达时序，boundary 必须已在 binding arrival 冻结。
  h.context.emitPage(popup);
  const result = await handled;
  const drained = await h.bridge.drain();

  assert(result?.ok === true && drained?.ok === true,
    `arrival race 应成功收口：${JSON.stringify({ result, drained })}`);
  assert(h.events.map((event) => event.action).join(',') === 'click,newpage',
    `不得静默漏 newpage：${JSON.stringify(h.events)}`);
  assert(h.events[1].path === '/agents', 'newpage 只应保留安全 path');
  assert(popup.calls.close === 0, '成功 handoff 不得关闭 popup');
});

await check('D3 后一 click arrival 封口前一 generation，popup 只归后一 click', async () => {
  let releaseFirst;
  let enteredFirst;
  const firstEntered = new Promise((resolve) => { enteredFirst = resolve; });
  const firstRelease = new Promise((resolve) => { releaseFirst = resolve; });
  const h = await recordHarness({
    settleAfterClick: async ({ event }) => {
      if (event.selector !== '#first') return;
      enteredFirst();
      await firstRelease;
    },
  });
  const first = h.bridge.handleBinding(
    { page: h.initial },
    { action: 'click', path: '/home', selector: '#first' },
  );
  await firstEntered;
  const second = h.bridge.handleBinding(
    { page: h.initial },
    { action: 'click', path: '/home', selector: '#second' },
  );
  const popup = pageDouble({ url: `${ORIGIN}/second`, opener: h.initial });
  h.context.emitPage(popup);
  releaseFirst();

  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert(firstResult?.ok === true && secondResult?.ok === true,
    `两 generation 应确定性收口：${JSON.stringify({ firstResult, secondResult })}`);
  assert(h.events.map((event) => event.action).join(',') === 'click,click,newpage',
    `popup 必须只归后一 click：${JSON.stringify(h.events)}`);
  assert(h.events[2].path === '/second', '后一 generation handoff path 不符');
});

await check('D4 binding-arrival token 路径仍对 >1 popup fail-closed 并收容', async () => {
  const h = await recordHarness();
  const one = pageDouble({ url: `${ORIGIN}/one`, opener: h.initial });
  const two = pageDouble({ url: `${ORIGIN}/two`, opener: h.initial });
  const handled = h.bridge.handleBinding(
    { page: h.initial },
    { action: 'click', path: '/home', selector: '#ambiguous' },
  );
  h.context.emitPage(one);
  h.context.emitPage(two);
  const result = await handled;

  assert(result?.ok === false && result.reason === 'PAGE_HANDOFF_AMBIGUOUS',
    `>1 popup 必须拒绝：${JSON.stringify(result)}`);
  assert(h.bridge.failure() === 'PAGE_HANDOFF_AMBIGUOUS',
    'ambiguous 必须固化 bridge failure');
  assert(one.calls.close === 1 && two.calls.close === 1,
    '>1 popup 必须全部 best-effort 收容');
  assert(h.events.map((event) => event.action).join(',') === 'click',
    'ambiguous 不得写 newpage');
});

await check('D5 binding-arrival token 路径仍对 cross-origin fail-closed 并收容', async () => {
  const h = await recordHarness();
  const popup = pageDouble({
    url: 'https://cross-origin.invalid/agents',
    opener: h.initial,
  });
  const handled = h.bridge.handleBinding(
    { page: h.initial },
    { action: 'click', path: '/home', selector: '#cross-origin' },
  );
  h.context.emitPage(popup);
  const result = await handled;

  assert(result?.ok === false && result.reason === 'AUTH_CONTINUITY_UNAVAILABLE',
    `cross-origin 必须拒绝：${JSON.stringify(result)}`);
  assert(h.bridge.failure() === 'AUTH_CONTINUITY_UNAVAILABLE',
    'cross-origin 必须固化 bridge failure');
  assert(popup.calls.close === 1, 'cross-origin popup 必须 best-effort 收容');
  assert(h.events.map((event) => event.action).join(',') === 'click',
    'cross-origin 不得写 newpage');
});

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
