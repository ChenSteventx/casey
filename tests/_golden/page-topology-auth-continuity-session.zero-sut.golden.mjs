#!/usr/bin/env node
// Session seed + per-page forensics：纯 context/page double，零 browser/SUT/network。

import {
  createContextDouble,
  createPageDouble,
} from './fixtures/page-topology-auth-continuity/context-double.mjs';

const TAG = 'page-topology-auth-continuity-session';
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

let createSessionSeedAuthority;
let createPageTopologyController;
try {
  ({ createSessionSeedAuthority } = await import('../../lib/page-topology/session-seed.mjs'));
  ({ createPageTopologyController } = await import('../../lib/page-topology/controller.mjs'));
  assert(typeof createSessionSeedAuthority === 'function', '未导出 createSessionSeedAuthority');
  assert(typeof createPageTopologyController === 'function', '未导出 createPageTopologyController');
} catch (error) {
  console.error(`RED  ${TAG}: 导入验收 API 失败（实现前预期红）：${String(error?.message || error).slice(-300)}`);
  process.exit(1);
}

const ORIGIN = 'https://seed-origin.invalid';
const CROSS = 'https://cross-origin.invalid';
const KEY_A = 'SESSION_KEY_SENTINEL';
const VAL_A = 'SESSION_VALUE_SENTINEL';
const KEY_PROTO = '__proto__';
const VAL_PROTO = 'PROTO_VALUE_SENTINEL';
const SECRETS = [ORIGIN, 'seed-origin', 'cross-origin', KEY_A, VAL_A, KEY_PROTO, VAL_PROTO, '://'];

function assertPublicSafe(value, label) {
  const text = JSON.stringify(value);
  for (const secret of SECRETS) assert(!text.includes(secret), `${label} 泄漏 ${secret}`);
}

function makeSeed() {
  const result = createSessionSeedAuthority({
    origin: ORIGIN,
    entries: [[KEY_A, VAL_A], [KEY_PROTO, VAL_PROTO]],
  });
  assert(result?.ok === true && result.authority && result.receipt,
    `seed 应铸造成功：${JSON.stringify(result)}`);
  return result;
}

async function harness() {
  const seed = makeSeed();
  const initial = createPageDouble({ name: 'initial', url: `${ORIGIN}/home` });
  const context = createContextDouble({ initialPages: [initial] });
  const forensics = [];
  let seq = 0;
  const started = await createPageTopologyController({
    context,
    initialPage: initial,
    sessionSeedAuthority: seed.authority,
    idFactory: () => `opaque_${++seq}`,
    attachForensics: async ({ pageId }) => forensics.push(pageId),
  });
  assert(started?.ok === true, `controller 应成功：${JSON.stringify(started)}`);
  return { seed, initial, context, forensics, ...started };
}

await check('S1 seed 公开 receipt 闭合、冻结、零 origin/key/value', () => {
  const seed = makeSeed();
  assert(Object.isFrozen(seed.authority) && Object.isFrozen(seed.receipt), 'seed authority/receipt 须冻结');
  assert(JSON.stringify(Object.keys(seed.receipt).sort()) === JSON.stringify([
    'originPolicy',
    'schemaVersion',
    'valuePersistence',
  ]), `seed receipt 键集不闭合：${JSON.stringify(Object.keys(seed.receipt))}`);
  assert(seed.receipt.originPolicy === 'same-origin-only'
    && seed.receipt.valuePersistence === 'memory-only', 'seed policy receipt 不符');
  assertPublicSafe(seed, 'seed 公开结果');
});

await check('S2 初始页与后续同源 popup 均在激活前获全 entries + 一次取证', async () => {
  const h = await harness();
  assert(h.initial.storage.get(KEY_A) === VAL_A && h.initial.storage.get(KEY_PROTO) === VAL_PROTO,
    '初始页未获完整 session seed entries');
  assert(h.initial.calls.initScripts.length === 1, '初始页 init script 应恰一次');
  assert(h.forensics.join(',') === 'opaque_1', '初始页取证不符');

  const popup = createPageDouble({ name: 'popup', url: `${ORIGIN}/agents`, opener: h.initial });
  const result = await h.controller.performClick({
    pageAuthority: h.activePageAuthority,
    perform: async () => h.context.emitPage(popup),
  });
  assert(result?.ok === true && result.handoff?.kind === 'newpage', '同源 popup 应 handoff');
  assert(popup.storage.get(KEY_A) === VAL_A && popup.storage.get(KEY_PROTO) === VAL_PROTO,
    '同源 popup 未获完整 seed');
  assert(popup.calls.initScripts.length === 1, 'popup init script 应恰一次');
  assert(h.forensics.join(',') === 'opaque_1,opaque_2', 'popup 应在激活前取证');
  assertPublicSafe(result, '同源 handoff');

  await h.context.emitPage(popup);
  assert(popup.calls.initScripts.length === 1, '重复 page 事件不得重复注入');
  assert(h.forensics.join(',') === 'opaque_1,opaque_2', '重复 page 事件不得重复取证');
});

await check('S3 cross-origin 新页不获 seed、不切 active，并具名 fail-closed', async () => {
  const h = await harness();
  const cross = createPageDouble({ name: 'cross', url: `${CROSS}/login`, opener: h.initial });
  const result = await h.controller.performClick({
    pageAuthority: h.activePageAuthority,
    perform: async () => h.context.emitPage(cross),
  });
  assert(result?.ok === false && result.reason === 'AUTH_CONTINUITY_UNAVAILABLE',
    `cross-origin 应拒：${JSON.stringify(result)}`);
  assert(result.verdictHint === 'NEEDS_HUMAN', 'cross-origin 应路由 NEEDS_HUMAN');
  assert(cross.storage.size === 0, 'cross-origin 不得种任何 session key/value');
  assert(cross.calls.initScripts.length === 1, 'cross-origin 仍须安装带 origin guard 的 init script');
  assert(h.forensics.join(',') === 'opaque_1,opaque_2', 'cross-origin 页仍须取证');
  assert(h.controller.activePageAuthority() === h.activePageAuthority, 'cross-origin 不得切 active');
  assertPublicSafe(result, 'cross-origin result');
});

await check('S4 ambiguous 新页逐页 seed/取证但不激活任一', async () => {
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
  assert(result?.reason === 'PAGE_HANDOFF_AMBIGUOUS', '多页应 ambiguous');
  assert(p1.storage.get(KEY_A) === VAL_A && p2.storage.get(KEY_A) === VAL_A, '同源候选页均须预装 seed');
  assert(h.forensics.join(',') === 'opaque_1,opaque_2,opaque_3', '多页候选均须取证');
  assert(h.controller.activePageAuthority() === h.activePageAuthority, 'ambiguous 不得激活任一');
  assertPublicSafe(result, 'ambiguous result');
});

await check('S5 clone/forge seed authority pre-registration 拒绝，零注入零取证', async () => {
  const seed = makeSeed();
  for (const authority of [
    structuredClone(seed.authority),
    { ...seed.authority },
    Object.freeze({}),
  ]) {
    const initial = createPageDouble({ name: 'initial', url: `${ORIGIN}/home` });
    const context = createContextDouble({ initialPages: [initial] });
    let forensicCalls = 0;
    const result = await createPageTopologyController({
      context,
      initialPage: initial,
      sessionSeedAuthority: authority,
      idFactory: () => 'opaque_x',
      attachForensics: async () => {
        forensicCalls += 1;
      },
    });
    assert(result?.ok === false && result.reason === 'SESSION_SEED_AUTHORITY_INVALID',
      `伪造 seed 应拒：${JSON.stringify(result)}`);
    assert(initial.calls.initScripts.length === 0 && forensicCalls === 0,
      '伪造 seed 应在 page 注册副作用前拒绝');
    assertPublicSafe(result, '伪造 seed result');
  }
});

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
