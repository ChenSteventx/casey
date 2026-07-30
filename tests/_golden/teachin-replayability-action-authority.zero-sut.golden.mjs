#!/usr/bin/env node
// Shared resolve→opaque authority→revalidate→perform gate. Pure-memory Playwright doubles.

import { resolveExecutionTarget } from '../../lib/execution-target/authority.mjs';

const TAG = 'teachin-replayability-action-authority';
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
    const message = String(error?.message || error).slice(-900);
    failures.push(`${name}: ${message}`);
    console.error(`RED  ${TAG}: ${name}: ${message}`);
  }
}

let api;
let formalApi;
let rawDriverApi;
try {
  [api, formalApi, rawDriverApi] = await Promise.all([
    import('../../lib/replay/action-authority.mjs'),
    import('../../lib/replay-actions.mjs'),
    import('../../lib/teachin/raw-playwright-driver.mjs'),
  ]);
} catch (error) {
  failures.push(`production action seam unavailable: ${
    String(error?.code || error?.message || error).slice(-500)}`);
}

const TOPOLOGY = Object.freeze(Object.create(null));
const TARGET = Object.freeze(Object.create(null));
const PAGE = Object.freeze(Object.create(null));
const OTHER_TOPOLOGY = Object.freeze(Object.create(null));
const OTHER_TARGET = Object.freeze(Object.create(null));
const EVENT = Object.freeze({
  action: 'click',
  path: '/agents',
  fallbackCss: '#open',
});
const RAW_EXECUTION = resolveExecutionTarget({
  runtime: { platform: 'linux', isWSL: false },
  logicalTarget: { startUrl: 'https://raw-actions.invalid/agents' },
  transport: { mode: 'direct' },
  requiresOriginContinuity: true,
});
assert(RAW_EXECUTION?.ok === true && RAW_EXECUTION.authority,
  `合成 execution target 失败：${JSON.stringify(RAW_EXECUTION)}`);
const AUTO_RESOLVE = Symbol('AUTO_RESOLVE');

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
}

function makeGate({
  count = 1,
  resolveThrows = false,
  resolveResult = AUTO_RESOLVE,
  revalidation = {
    connected: true,
    sameNode: true,
    candidateCount: 1,
    ownerMatches: true,
  },
  origin = true,
  perform = true,
  performThrows = false,
} = {}) {
  const candidate = Object.freeze(Object.create(null));
  const stats = {
    resolve: 0,
    revalidate: 0,
    origin: 0,
    perform: 0,
    probe: 0,
  };
  const gate = api.createActionAuthorityGate({
    async resolveCandidate({ event }) {
      stats.resolve += 1;
      assert(event.action === EVENT.action && event.fallbackCss === EVENT.fallbackCss,
        'resolve event copy 漂移');
      if (resolveThrows) throw new Error('private resolve detail');
      if (resolveResult !== AUTO_RESOLVE) {
        return typeof resolveResult === 'function'
          ? resolveResult({ candidate, pageAuthority: PAGE })
          : resolveResult;
      }
      return count === 1 ? { count, candidate, pageAuthority: PAGE } : { count };
    },
    async revalidateCandidate({
      candidate: actual,
      pageAuthority,
      topologyAuthority,
      executionTargetAuthority,
    }) {
      stats.revalidate += 1;
      assert(actual === candidate, 'revalidate candidate 换绑');
      assert(pageAuthority === PAGE
        && topologyAuthority === TOPOLOGY
        && executionTargetAuthority === TARGET,
      'revalidate page/topology/target 换绑');
      return revalidation;
    },
    async performCandidate({
      candidate: actual,
      pageAuthority,
      topologyAuthority,
      executionTargetAuthority,
    }) {
      stats.perform += 1;
      assert(actual === candidate, 'perform candidate 换绑');
      assert(pageAuthority === PAGE
        && topologyAuthority === TOPOLOGY
        && executionTargetAuthority === TARGET,
      'perform page/topology/target 换绑');
      if (performThrows) throw new Error('private perform detail');
      return perform;
    },
    async probeDrift() {
      stats.probe += 1;
      return { sameSignatureUniquePresent: false };
    },
    async admitOrigin({
      pageAuthority,
      topologyAuthority,
      executionTargetAuthority,
    }) {
      stats.origin += 1;
      assert(pageAuthority === PAGE
        && topologyAuthority === TOPOLOGY
        && executionTargetAuthority === TARGET,
      'origin page/topology/target 换绑');
      return origin;
    },
  });
  return { gate, candidate, stats };
}

function browserHarness() {
  const stats = { physical: [], origin: 0 };
  const makePage = (name) => {
    const page = {};
    const state = {
      connected: true,
      count: 1,
      handleHook: null,
      ownerPage: null,
      url: 'https://raw-actions.invalid/agents',
    };
    const frame = { page: () => state.ownerPage || page };
    const act = async (kind, value) => {
      stats.physical.push(value === undefined ? kind : `${kind}:${value}`);
    };
    const handle = {
      async evaluate() { return state.connected; },
      async ownerFrame() { return frame; },
      click: () => act('click'),
      dblclick: () => act('dblclick'),
      fill: (value) => act('fill', value),
      press: (key) => act('press', key),
    };
    const locator = {
      first() { return locator; },
      async waitFor() {},
      async count() { return state.count; },
      async elementHandle() {
        const hook = state.handleHook;
        state.handleHook = null;
        if (hook) hook();
        return handle;
      },
      click: handle.click,
      dblclick: handle.dblclick,
      fill: handle.fill,
      press: handle.press,
    };
    Object.assign(page, {
      __name: name,
      locator(selector) {
        assert(selector === EVENT.fallbackCss, `locator selector 漂移：${selector}`);
        return locator;
      },
      mainFrame: () => frame,
      url: () => state.url,
      isClosed: () => false,
    });
    return { handle, locator, page, state };
  };

  const first = makePage('first');
  const second = makePage('second');
  const firstAuthority = Object.freeze(Object.create(null));
  const secondAuthority = Object.freeze(Object.create(null));
  let active = first;
  let activeAuthority = firstAuthority;
  let originOk = true;
  const topology = Object.freeze({
    activePageAuthority: () => activeAuthority,
    async evaluateActive({ pageAuthority, evaluate }) {
      if (pageAuthority !== activeAuthority) return { ok: false, reason: 'PAGE_AUTHORITY_STALE' };
      return { ok: true, value: await evaluate(active.page) };
    },
    async performClick({ pageAuthority, perform }) {
      if (pageAuthority !== activeAuthority) return { ok: false, reason: 'PAGE_AUTHORITY_STALE' };
      return { ok: true, value: await perform(active.page) };
    },
    async consumeNewPageEvent() {
      return { ok: false, reason: 'TOPOLOGY_EVENT_INVALID' };
    },
  });
  const replaceActive = () => {
    active = second;
    activeAuthority = secondAuthority;
  };
  return {
    first,
    page: first.page,
    pageB: second.page,
    replaceActive,
    setOriginOk(value) { originOk = value; },
    stats,
    topology,
    async admitReplayActionOrigin(page) {
      stats.origin += 1;
      return originOk && page === active.page;
    },
  };
}

async function resolveUnique(built = makeGate()) {
  const result = await built.gate.resolve({
    event: EVENT,
    topologyAuthority: TOPOLOGY,
    executionTargetAuthority: TARGET,
  });
  assert(exactKeys(result, ['resolution', 'candidateCount', 'actionAuthority'])
    && result.resolution === 'unique' && result.candidateCount === 1
    && result.actionAuthority && typeof result.actionAuthority === 'object',
  `unique resolve 形状不符：${JSON.stringify(result)}`);
  return { ...built, actionAuthority: result.actionAuthority };
}

function expectAxis(result, resolution, candidateCount, label) {
  assert(result && result.resolution === resolution
    && result.candidateCount === candidateCount
    && !Object.hasOwn(result, 'actionAuthority'),
  `${label} axis 不符：${JSON.stringify(result)}`);
  assert(resolution !== 'unique' || result.identityReadback?.ok === true,
    `${label} unique 缺真实 identityReadback`);
}

if (api && formalApi && rawDriverApi) {
  await check('A1 none/ambiguous 不铸 authority 且真实 perform 为零', async () => {
    const none = makeGate({ count: 0 });
    const noneResult = await none.gate.resolve({
      event: EVENT,
      topologyAuthority: TOPOLOGY,
      executionTargetAuthority: TARGET,
    });
    expectAxis(noneResult, 'none', 0, 'none');
    assert(noneResult.driftProbe?.sameSignatureUniquePresent === false
      && none.stats.probe === 1 && none.stats.perform === 0,
    'none 必须只跑 drift probe');

    const ambiguous = makeGate({ count: 2 });
    const ambiguousResult = await ambiguous.gate.resolve({
      event: EVENT,
      topologyAuthority: TOPOLOGY,
      executionTargetAuthority: TARGET,
    });
    expectAxis(ambiguousResult, 'ambiguous', 2, 'ambiguous');
    assert(ambiguous.stats.probe === 0 && ambiguous.stats.perform === 0,
      'ambiguous 不得 probe/perform');
  });

  await check('A2 unique authority plain/clone/foreign/replay 均不能动作', async () => {
    for (const [label, candidate] of [
      ['plain', Object.freeze(Object.create(null))],
      ['clone', structuredClone((await resolveUnique()).actionAuthority)],
    ]) {
      const built = makeGate();
      const result = await built.gate.perform({
        actionAuthority: candidate,
        topologyAuthority: TOPOLOGY,
        executionTargetAuthority: TARGET,
      });
      expectAxis(result, 'action_failed', 0, label);
      assert(built.stats.perform === 0, `${label} authority 不得动作`);
    }

    const first = await resolveUnique();
    const second = makeGate();
    const foreign = await second.gate.perform({
      actionAuthority: first.actionAuthority,
      topologyAuthority: TOPOLOGY,
      executionTargetAuthority: TARGET,
    });
    expectAxis(foreign, 'action_failed', 0, 'foreign');
    assert(second.stats.perform === 0, 'foreign authority 不得动作');

    const genuine = await resolveUnique();
    const done = await genuine.gate.perform({
      actionAuthority: genuine.actionAuthority,
      topologyAuthority: TOPOLOGY,
      executionTargetAuthority: TARGET,
    });
    expectAxis(done, 'unique', 1, 'genuine');
    const replayed = await genuine.gate.perform({
      actionAuthority: genuine.actionAuthority,
      topologyAuthority: TOPOLOGY,
      executionTargetAuthority: TARGET,
    });
    expectAxis(replayed, 'action_failed', 0, 'replayed');
    assert(genuine.stats.perform === 1, 'genuine authority 只可动作一次');
  });

  await check('A3 topology/target 换绑在 origin/revalidate/perform 前拒且 authority 被消耗', async () => {
    for (const [label, topologyAuthority, executionTargetAuthority] of [
      ['topology', OTHER_TOPOLOGY, TARGET],
      ['target', TOPOLOGY, OTHER_TARGET],
    ]) {
      const built = await resolveUnique();
      const denied = await built.gate.perform({
        actionAuthority: built.actionAuthority,
        topologyAuthority,
        executionTargetAuthority,
      });
      expectAxis(denied, 'action_failed', 0, label);
      assert(built.stats.origin === 0 && built.stats.revalidate === 0
        && built.stats.perform === 0, `${label} 换绑触碰动作窗口`);
      const retry = await built.gate.perform({
        actionAuthority: built.actionAuthority,
        topologyAuthority: TOPOLOGY,
        executionTargetAuthority: TARGET,
      });
      expectAxis(retry, 'action_failed', 0, `${label} retry`);
      assert(built.stats.perform === 0, `${label} 攻击后不得改正参数重试`);
    }
  });

  await check('A4 structured revalidation 非 exact true/1 闭包全部拒绝且零动作', async () => {
    const valid = {
      connected: true, sameNode: true, candidateCount: 1, ownerMatches: true,
    };
    const attacks = [
      ['origin', { origin: false }],
      ...Object.keys(valid).map((missing) => [
        `missing-${missing}`,
        { revalidation: Object.fromEntries(
          Object.entries(valid).filter(([key]) => key !== missing),
        ) },
      ]),
      ['null', { revalidation: null }],
      ['array', { revalidation: [true, true, 1, true] }],
      ['boolean-shortcut', { revalidation: true }],
      ['connected-type', { revalidation: { ...valid, connected: 1 } }],
      ['same-node-type', { revalidation: { ...valid, sameNode: 'true' } }],
      ['count-type', { revalidation: { ...valid, candidateCount: '1' } }],
      ['owner-type', { revalidation: { ...valid, ownerMatches: 1 } }],
      ['detached', { revalidation: { ...valid, connected: false } }],
      ['same-node', { revalidation: { ...valid, sameNode: false } }],
      ['nonunique', { revalidation: { ...valid, candidateCount: 2 } }],
      ['owner-mismatch', { revalidation: { ...valid, ownerMatches: false } }],
      ['unknown-key', { revalidation: { ...valid, extra: true } }],
    ];
    for (const [label, options] of attacks) {
      const built = await resolveUnique(makeGate(options));
      const denied = await built.gate.perform({
        actionAuthority: built.actionAuthority,
        topologyAuthority: TOPOLOGY,
        executionTargetAuthority: TARGET,
      });
      expectAxis(denied, 'action_failed', 1, label);
      assert(built.stats.perform === 0, `${label} 失败仍调用真实动作`);
      const replayed = await built.gate.perform({
        actionAuthority: built.actionAuthority,
        topologyAuthority: TOPOLOGY,
        executionTargetAuthority: TARGET,
      });
      expectAxis(replayed, 'action_failed', 0, `${label} replay`);
      assert(built.stats.perform === 0, `${label} 不得重试动作`);
    }
  });

  await check('A5 genuine perform 成功/失败/throw 都恰尝试一次且失败不谎报 unique', async () => {
    for (const [label, options, expected] of [
      ['success', { perform: true }, 'unique'],
      ['false', { perform: false }, 'action_failed'],
      ['throw', { performThrows: true }, 'action_failed'],
    ]) {
      const built = await resolveUnique(makeGate(options));
      const result = await built.gate.perform({
        actionAuthority: built.actionAuthority,
        topologyAuthority: TOPOLOGY,
        executionTargetAuthority: TARGET,
      });
      expectAxis(result, expected, 1, label);
      assert(built.stats.origin === 1 && built.stats.revalidate === 1
        && built.stats.perform === 1, `${label} 动作窗口调用数不符`);
      assert(!JSON.stringify(result).includes('private'), `${label} 泄漏异常原文`);
    }
  });

  await check('A6 resolver throw/malformed 只出稳定 action_failed 且零动作', async () => {
    const malformed = [
      ['null', null],
      ['array', []],
      ['boolean', true],
      ['empty', {}],
      ['missing-candidate', ({ pageAuthority }) => ({ count: 1, pageAuthority })],
      ['missing-page', ({ candidate }) => ({ count: 1, candidate })],
      ['count-type', ({ candidate, pageAuthority }) =>
        ({ count: '1', candidate, pageAuthority })],
      ['negative-count', { count: -1 }],
      ['none-extra', { count: 0, extra: true }],
      ['unique-extra', ({ candidate, pageAuthority }) =>
        ({ count: 1, candidate, pageAuthority, extra: true })],
    ];
    for (const [label, resolveResult] of malformed) {
      const built = makeGate({ resolveResult });
      const result = await built.gate.resolve({
        event: EVENT,
        topologyAuthority: TOPOLOGY,
        executionTargetAuthority: TARGET,
      });
      expectAxis(result, 'action_failed', 0, `resolver ${label}`);
      assert(built.stats.perform === 0, `resolver ${label} 触发动作`);
    }
    const thrown = makeGate({ resolveThrows: true });
    const result = await thrown.gate.resolve({
      event: EVENT,
      topologyAuthority: TOPOLOGY,
      executionTargetAuthority: TARGET,
    });
    expectAxis(result, 'action_failed', 0, 'resolver throw');
    assert(thrown.stats.perform === 0 && !JSON.stringify(result).includes('private'),
      'resolver throw 泄漏或触发动作');
  });

  await check('A7 同一 one-shot authority 并发 perform 也只有一次物理动作', async () => {
    const built = await resolveUnique();
    const results = await Promise.all([0, 1].map(() => built.gate.perform({
      actionAuthority: built.actionAuthority,
      topologyAuthority: TOPOLOGY,
      executionTargetAuthority: TARGET,
    })));
    assert(results.filter((result) => result.resolution === 'unique').length === 1
      && results.filter((result) => result.resolution === 'action_failed').length === 1,
    `并发 one-shot 结果不符：${JSON.stringify(results)}`);
    assert(built.stats.perform === 1, `并发 authority 物理动作数=${built.stats.perform}`);
  });

  await check('A8 exported formal dispatch 真穿 shared gate；换页/owner/origin 拒绝零动作', async () => {
    assert(typeof formalApi.dispatchReplayAction === 'function',
      '缺 exported dispatchReplayAction');
    const dispatch = (harness) => formalApi.dispatchReplayAction(
      harness.page,
      EVENT,
      {
        pageTopology: harness.topology,
        executionTargetAuthority: RAW_EXECUTION.authority,
        admitReplayActionOrigin: (page) => harness.admitReplayActionOrigin(page),
      },
    );
    const positive = browserHarness();
    const done = await dispatch(positive);
    expectAxis(done, 'unique', 1, 'formal positive');
    assert(positive.stats.physical.join(',') === 'click' && positive.stats.origin === 1,
      `formal positive 未真实动作/验 origin：${JSON.stringify(positive.stats)}`);

    for (const [label, arrange] of [
      ['active-page-replaced', (harness) => {
        harness.first.state.handleHook = harness.replaceActive;
      }],
      ['owner-provider-mismatch', (harness) => {
        harness.first.state.ownerPage = harness.pageB;
      }],
      ['origin-reject', (harness) => harness.setOriginOk(false)],
    ]) {
      const harness = browserHarness();
      arrange(harness);
      const denied = await dispatch(harness);
      assert(denied?.resolution === 'action_failed'
        && (denied.candidateCount === 0 || denied.candidateCount === 1)
        && !Object.hasOwn(denied, 'actionAuthority')
        && harness.stats.physical.length === 0,
        `formal ${label} 仍执行物理动作：${JSON.stringify(harness.stats)}`);
    }
  });

  await check('A9 exported canonical raw driver 真穿 shared gate；换页/owner/origin 拒绝零动作', async () => {
    const driver = rawDriverApi.canonicalRawPlaywrightDriver;
    assert(Object.isFrozen(driver)
      && exactKeys(driver, ['readActivePath', 'resolve', 'perform'])
      && Object.values(driver).every((value) => typeof value === 'function'),
    'canonicalRawPlaywrightDriver 必须 frozen exact 三方法');
    const resolveRaw = async (harness) => {
      const result = await driver.resolve({
        event: EVENT,
        topologyAuthority: harness.topology,
        executionTargetAuthority: RAW_EXECUTION.authority,
      });
      assert(exactKeys(result, ['resolution', 'candidateCount', 'actionAuthority'])
        && result.resolution === 'unique' && result.candidateCount === 1,
      `raw resolve 非 unique authority：${JSON.stringify(result)}`);
      return result.actionAuthority;
    };
    const performRaw = (harness, actionAuthority) => driver.perform({
      actionAuthority,
      topologyAuthority: harness.topology,
      executionTargetAuthority: RAW_EXECUTION.authority,
    });

    const positive = browserHarness();
    const done = await performRaw(positive, await resolveRaw(positive));
    assert(exactKeys(done, ['ok', 'identityReadback'])
      && done.ok === true && done.identityReadback?.ok === true
      && positive.stats.physical.join(',') === 'click',
    `raw positive 未真实成功：${JSON.stringify({ done, stats: positive.stats })}`);

    for (const [label, mutate] of [
      ['active-page-replaced', (harness) => harness.replaceActive()],
      ['owner-provider-mismatch', (harness) => {
        harness.first.state.ownerPage = harness.pageB;
      }],
      ['origin-reject', (harness) => {
        harness.first.state.url = 'https://other.invalid/agents';
      }],
    ]) {
      const harness = browserHarness();
      const actionAuthority = await resolveRaw(harness);
      mutate(harness);
      const denied = await performRaw(harness, actionAuthority);
      assert(denied?.ok === false && denied.reason === 'ACTION_FAILED'
        && harness.stats.physical.length === 0,
      `raw ${label} 未稳定零动作拒绝：${JSON.stringify({ denied, stats: harness.stats })}`);
    }
  });
}

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
