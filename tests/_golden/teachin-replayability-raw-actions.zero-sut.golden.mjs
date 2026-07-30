#!/usr/bin/env node
// teachin-replayability-closure S1/S2 补强：raw action 闭合投影、动作顺序与 fresh 公开 receipt。
// 纯内存 runtime/action doubles，零 browser/SUT/network/LLM。

import { resolveExecutionTarget } from '../../lib/execution-target/authority.mjs';

const TAG = 'teachin-replayability-raw-actions';
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

let actionApi;
let captureApi;
let freshApi;
let runnerApi;
try {
  [actionApi, captureApi, freshApi, runnerApi] = await Promise.all([
    import('../../lib/teachin/raw-action.mjs'),
    import('../../lib/teachin/raw-capture.mjs'),
    import('../../lib/teachin/fresh-runtime.mjs'),
    import('../../lib/teachin/raw-replay-runner.mjs'),
  ]);
} catch {
  console.error(`RED  ${TAG}: frozen API import failed（实现模块尚未落地）`);
  process.exit(1);
}

const { projectRawReplayAction } = actionApi;
const { admitRawReplayCapture } = captureApi;
const {
  authorizeFreshReplayRuntime,
  createFreshReplayWitness,
} = freshApi;
const { runRawReplay } = runnerApi;

for (const [name, fn] of Object.entries({
  projectRawReplayAction,
  admitRawReplayCapture,
  authorizeFreshReplayRuntime,
  createFreshReplayWitness,
  runRawReplay,
})) {
  assert(typeof fn === 'function', `缺 frozen API ${name}`);
}

function exactKeys(value, expected, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value),
    `${label} 必须是对象`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  assert(JSON.stringify(actual) === JSON.stringify(wanted),
    `${label} keys 不闭合：${JSON.stringify(actual)} !== ${JSON.stringify(wanted)}`);
}

function assertRequest(result, expected, label) {
  assert(result?.ok === true && result.kind === 'action',
    `${label} 应投影 action：${JSON.stringify(result)}`);
  exactKeys(result, ['ok', 'kind', 'actionRequest'], `${label} result`);
  exactKeys(result.actionRequest, Object.keys(expected), `${label} actionRequest`);
  assert(Object.isFrozen(result.actionRequest),
    `${label} actionRequest 必须 frozen`);
  for (const [key, value] of Object.entries(expected)) {
    assert(result.actionRequest[key] === value,
      `${label}.${key} 投影不符：${JSON.stringify(result.actionRequest)}`);
  }
  const serialized = JSON.stringify(result.actionRequest);
  assert(!/"(?:text|x|y|ox|oy|selector|tagName|fieldLabel)"\s*:/.test(serialized),
    `${label} actionRequest 泄录制证据字段：${serialized}`);
}

function assertInvalid(event, label) {
  const denied = projectRawReplayAction(event);
  assert(denied?.ok === false && denied.reason === 'RAW_ACTION_INVALID',
    `${label} 应 fail-closed：${JSON.stringify(denied)}`);
  exactKeys(denied, ['ok', 'reason'], `${label} denied`);
  assert(!Object.hasOwn(denied, 'actionRequest'),
    `${label} 拒绝不得携 actionRequest`);
}

function emitterDouble(extra = {}) {
  const listeners = new Map();
  return {
    ...extra,
    on(event, handler) {
      const entries = listeners.get(event) || [];
      entries.push(handler);
      listeners.set(event, entries);
    },
    emit(event) {
      for (const handler of listeners.get(event) || []) handler();
    },
  };
}

function mintFresh(topologyAuthority) {
  let recordingConnected = true;
  const recordingBrowser = emitterDouble({
    isConnected: () => recordingConnected,
  });
  const recordingContext = emitterDouble({
    browser: () => recordingBrowser,
  });
  const witnessed = createFreshReplayWitness({
    recordingBrowser,
    recordingContext,
  });
  assert(witnessed?.ok === true && witnessed.witness,
    `fresh witness 创建失败：${JSON.stringify(witnessed)}`);
  recordingContext.emit('close');
  recordingConnected = false;
  recordingBrowser.emit('disconnected');

  const replayBrowser = emitterDouble({ isConnected: () => true });
  const replayContext = emitterDouble({ browser: () => replayBrowser });
  const replayPage = emitterDouble({
    context: () => replayContext,
    isClosed: () => false,
  });
  const authorized = authorizeFreshReplayRuntime({
    witness: witnessed.witness,
    replayBrowser,
    replayContext,
    replayPage,
    topologyAuthority,
  });
  assert(authorized?.ok === true && authorized.freshRuntimeAuthority,
    `fresh runtime 授权失败：${JSON.stringify(authorized)}`);
  return authorized;
}

function captureBytes(events) {
  return Buffer.from(JSON.stringify({
    schemaVersion: 1,
    artifactKind: 'teach-in-capture',
    caseId: 'tc_raw_actions',
    createdAt: '2026-07-27T00:00:00.000Z',
    startPath: '/home',
    source: {
      kind: 'manual',
      signed: false,
      replayReady: false,
      distillRequired: true,
    },
    events,
  }, null, 2) + '\n');
}

const execution = resolveExecutionTarget({
  runtime: { platform: 'linux', isWSL: false },
  logicalTarget: { startUrl: 'https://raw-actions.invalid/home' },
  transport: { mode: 'direct' },
  requiresOriginContinuity: true,
});
assert(execution?.ok === true && execution.authority,
  `合成 execution authority 应成功：${JSON.stringify(execution)}`);

await check('P1 click/dblclick/fill/press 精确投影，已登记证据字段不进入 actionRequest', () => {
  const common = {
    path: '/home',
    text: '只属录制证据',
    tagName: 'BUTTON',
    fieldLabel: '公开字段',
    x: 101,
    y: 202,
    ox: 3,
    oy: 4,
  };
  const cases = [
    [
      { seq: 1, action: 'click', selector: '#click', ...common },
      { action: 'click', fallbackCss: '#click' },
    ],
    [
      { seq: 2, action: 'dblclick', selector: '#double', ...common },
      { action: 'dblclick', fallbackCss: '#double' },
    ],
    [
      { seq: 3, action: 'fill', selector: '#query', value: 'value-alpha', ...common },
      { action: 'fill', fallbackCss: '#query', value: 'value-alpha' },
    ],
    [
      { seq: 4, action: 'press', selector: '#query', key: 'ArrowDown', ...common },
      { action: 'press', fallbackCss: '#query', key: 'ArrowDown' },
    ],
  ];
  for (const [event, expected] of cases) {
    const frozenInput = Object.freeze(event);
    assertRequest(
      projectRawReplayAction(frozenInput),
      expected,
      event.action,
    );
  }
});

await check('P2 nav/newpage 是闭合 control，不得伪装业务 actionRequest', () => {
  for (const controlAction of ['nav', 'newpage']) {
    const projected = projectRawReplayAction(Object.freeze({
      seq: 1,
      action: controlAction,
      path: '/home',
    }));
    assert(projected?.ok === true
      && projected.kind === 'control'
      && projected.controlAction === controlAction,
    `${controlAction} 应投影 control：${JSON.stringify(projected)}`);
    exactKeys(projected, ['ok', 'kind', 'controlAction'], `${controlAction} control`);
    assert(!Object.hasOwn(projected, 'actionRequest'),
      `${controlAction} 不得携 actionRequest`);
  }
});

await check('P3 缺必填、未知动作与未知字段统一 fail-closed', () => {
  const invalid = [
    [{ seq: 1, path: '/home', selector: '#x' }, '缺 action'],
    [{ seq: 1, action: 'click', path: '/home' }, 'click 缺 selector'],
    [{ seq: 1, action: 'dblclick', path: '/home', selector: '' }, '空 selector'],
    [{ seq: 1, action: 'fill', path: '/home', selector: '#x' }, 'fill 缺 value'],
    [{ seq: 1, action: 'fill', path: '/home', selector: '#x', value: 7 }, 'value 非 string'],
    [{ seq: 1, action: 'press', path: '/home', selector: '#x' }, 'press 缺 key'],
    [{ seq: 1, action: 'press', path: '/home', selector: '#x', key: 13 }, 'key 非 string'],
    [{ seq: 1, action: 'hover', path: '/home', selector: '#x' }, '未知 action'],
    [{
      seq: 1,
      action: 'click',
      path: '/home',
      selector: '#x',
      unregisteredEvidence: 'must-reject',
    }, '未知字段'],
  ];
  for (const [event, label] of invalid) assertInvalid(event, label);
});

await check('P4 runner 对四业务动作严格 resolve→perform，fill value 与 press key 不交换', async () => {
  const events = [
    { seq: 1, action: 'click', path: '/home', selector: '#click' },
    { seq: 2, action: 'dblclick', path: '/home', selector: '#double' },
    {
      seq: 3,
      action: 'fill',
      path: '/home',
      selector: '#query',
      value: 'value-alpha',
    },
    {
      seq: 4,
      action: 'press',
      path: '/home',
      selector: '#query',
      key: 'ArrowDown',
    },
  ];
  const bytes = captureBytes(events);
  const admitted = admitRawReplayCapture({
    caseId: 'tc_raw_actions',
    captureBytes: bytes,
  });
  assert(admitted?.ok === true && admitted.captureAuthority,
    `合法 capture 应准入：${JSON.stringify(admitted)}`);

  const topologyAuthority = Object.freeze({
    activePageAuthority() {
      return Object.freeze(Object.create(null));
    },
  });
  const fresh = mintFresh(topologyAuthority);
  const calls = [];
  const actionGates = new WeakMap();
  const requests = [];
  const actionDriver = {
    async readActivePath() {
      return '/home';
    },
    async resolve({ event, topologyAuthority: actualTopology, executionTargetAuthority }) {
      assert(actualTopology === topologyAuthority, 'resolve topology authority 被替换');
      assert(executionTargetAuthority === execution.authority,
        'resolve execution target authority 被替换');
      requests.push(event);
      calls.push(`resolve:${event.action}`);
      const actionAuthority = Object.freeze(Object.create(null));
      actionGates.set(actionAuthority, event);
      return {
        resolution: 'unique',
        candidateCount: 1,
        actionAuthority,
      };
    },
    async perform({ actionAuthority, topologyAuthority: actualTopology, executionTargetAuthority }) {
      assert(actualTopology === topologyAuthority, 'perform topology authority 被替换');
      assert(executionTargetAuthority === execution.authority,
        'perform execution target authority 被替换');
      const request = actionGates.get(actionAuthority);
      assert(request, 'perform 必须消费对应 resolve 铸造的 authority');
      actionGates.delete(actionAuthority);
      calls.push(`perform:${request.action}`);
      return { ok: true, identityReadback: { ok: true } };
    },
  };
  const result = await runRawReplay({
    captureAuthority: admitted.captureAuthority,
    freshRuntimeAuthority: fresh.freshRuntimeAuthority,
    topologyAuthority,
    executionTargetAuthority: execution.authority,
    actionDriver,
  });
  assert(result?.ok === true && result.status === 'CLEAN',
    `四动作 raw replay 应 CLEAN：${JSON.stringify(result)}`);
  assert(calls.join(',') === [
    'resolve:click',
    'perform:click',
    'resolve:dblclick',
    'perform:dblclick',
    'resolve:fill',
    'perform:fill',
    'resolve:press',
    'perform:press',
  ].join(','), `resolve→perform 顺序错误：${calls.join(',')}`);
  const expectedRequests = [
    { action: 'click', fallbackCss: '#click' },
    { action: 'dblclick', fallbackCss: '#double' },
    { action: 'fill', fallbackCss: '#query', value: 'value-alpha' },
    { action: 'press', fallbackCss: '#query', key: 'ArrowDown' },
  ];
  assert(requests.length === expectedRequests.length,
    `runner 动作参数数量漂移：${requests.length}`);
  for (let index = 0; index < expectedRequests.length; index += 1) {
    const actual = requests[index];
    const expected = expectedRequests[index];
    exactKeys(actual, Object.keys(expected), `runner request ${index + 1}`);
    for (const [key, value] of Object.entries(expected)) {
      assert(actual[key] === value,
        `runner request ${index + 1}.${key} 漂移/交换：${JSON.stringify(actual)}`);
    }
  }
});

await check('F1 fresh 公开 receipt 是冻结 exact-key 常量，不携动态 freshness 事实', () => {
  const topologyAuthority = Object.freeze(Object.create(null));
  const authorized = mintFresh(topologyAuthority);
  const expected = {
    schemaVersion: 1,
    lifecycle: 'recording-closed/replay-new',
    valuePersistence: 'memory-only',
  };
  exactKeys(authorized.receipt, Object.keys(expected), 'fresh receipt');
  assert(Object.isFrozen(authorized.receipt),
    'fresh receipt 必须 frozen');
  for (const [key, value] of Object.entries(expected)) {
    assert(authorized.receipt[key] === value,
      `fresh receipt.${key} 漂移：${JSON.stringify(authorized.receipt)}`);
  }
  const entries = Object.entries(authorized.receipt);
  assert(entries.every(([, value]) => typeof value !== 'boolean'),
    'fresh receipt 不得用 boolean freshness 自报');
  assert(entries.every(([key]) => !/^(?:timestamp|time|session|origin|id|fresh)/i.test(key)),
    `fresh receipt 禁止 timestamp/session/origin/id/freshness 字段：${JSON.stringify(entries)}`);
});

if (failures.length) {
  console.error(`\n${TAG}: ${passed} passed, ${failures.length} failed`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`\n${TAG}: ${passed} passed, 0 failed`);
