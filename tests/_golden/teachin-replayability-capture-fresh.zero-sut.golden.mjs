#!/usr/bin/env node
// teachin-replayability-closure S1：exact capture bytes + 全包预检 + fresh lifecycle authority。
// 纯内存对象 double，零 browser/SUT/network。实现模块缺失时真实 RED；模块落地后本文件完整约束行为。

import { createHash } from 'node:crypto';

const TAG = 'teachin-replayability-capture-fresh';
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

let captureApi;
let freshApi;
let runnerApi;
try {
  [captureApi, freshApi, runnerApi] = await Promise.all([
    import('../../lib/teachin/raw-capture.mjs'),
    import('../../lib/teachin/fresh-runtime.mjs'),
    import('../../lib/teachin/raw-replay-runner.mjs'),
  ]);
} catch {
  console.error(`RED  ${TAG}: frozen API import failed（实现模块尚未落地）`);
  process.exit(1);
}

const {
  admitRawReplayCapture,
  inspectAdmittedRawReplayCapture,
} = captureApi;
const {
  authorizeFreshReplayRuntime,
  consumeFreshReplayRuntimeAuthority,
  createFreshReplayWitness,
} = freshApi;
const {
  admitAndRunRawReplay,
} = runnerApi;

assert(typeof admitRawReplayCapture === 'function',
  'raw-capture 必须导出 admitRawReplayCapture');
assert(typeof inspectAdmittedRawReplayCapture === 'function',
  'raw-capture 必须导出 inspectAdmittedRawReplayCapture');
assert(typeof createFreshReplayWitness === 'function',
  'fresh-runtime 必须导出 createFreshReplayWitness');
assert(typeof authorizeFreshReplayRuntime === 'function',
  'fresh-runtime 必须导出 authorizeFreshReplayRuntime');
assert(typeof consumeFreshReplayRuntimeAuthority === 'function',
  'fresh-runtime 必须导出 consumeFreshReplayRuntimeAuthority');
assert(typeof admitAndRunRawReplay === 'function',
  'raw-replay-runner 必须导出 admitAndRunRawReplay');

function captureBytes(events, overrides = {}) {
  const doc = {
    schemaVersion: 1,
    artifactKind: 'teach-in-capture',
    caseId: 'tc_raw_capture',
    createdAt: '2026-07-27T00:00:00.000Z',
    startPath: '/home?tab=mine',
    source: {
      kind: 'manual',
      signed: false,
      replayReady: false,
      distillRequired: true,
    },
    events,
    ...overrides,
  };
  return Buffer.from(JSON.stringify(doc, null, 2) + '\n', 'utf8');
}

function click(seq, selector = '#open') {
  return { seq, action: 'click', path: '/home?tab=mine', selector };
}

function expectDenied(result, reason, label) {
  assert(result?.ok === false && result.reason === reason,
    `${label} 应拒 ${reason}：${JSON.stringify(result)}`);
  assert(!result.captureAuthority, `${label} 不得铸 capture authority`);
}

function orchestrationBoundary(captureBytesValue) {
  const calls = {
    freshFactory: 0,
    readPath: 0,
    resolve: 0,
    perform: 0,
  };
  return {
    calls,
    options: {
      caseId: 'tc_raw_capture',
      captureBytes: captureBytesValue,
      topologyAuthority: Object.freeze(Object.create(null)),
      executionTargetAuthority: Object.freeze(Object.create(null)),
      freshRuntimeFactory() {
        calls.freshFactory += 1;
        throw new Error('ADMISSION_MUST_PRECEDE_FRESH_RUNTIME');
      },
      actionDriver: {
        async readActivePath() {
          calls.readPath += 1;
          throw new Error('ADMISSION_MUST_PRECEDE_PATH_READ');
        },
        async resolve() {
          calls.resolve += 1;
          throw new Error('ADMISSION_MUST_PRECEDE_RESOLVE');
        },
        async perform() {
          calls.perform += 1;
          throw new Error('ADMISSION_MUST_PRECEDE_PERFORM');
        },
      },
    },
  };
}

function assertZeroBoundaryEffects(boundary, label) {
  assert(Object.values(boundary.calls).every((count) => count === 0),
    `${label} 必须 freshFactory/readPath/resolve/perform 全零：${JSON.stringify(boundary.calls)}`);
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

function runtimeHarness() {
  let recordingConnected = true;
  const recordingBrowser = emitterDouble({
    isConnected: () => recordingConnected,
  });
  const recordingContext = emitterDouble({
    browser: () => recordingBrowser,
  });
  const created = createFreshReplayWitness({
    recordingBrowser,
    recordingContext,
  });
  assert(created?.ok === true && created.witness,
    `witness 应创建成功：${JSON.stringify(created)}`);

  let replayConnected = true;
  const replayBrowser = emitterDouble({
    isConnected: () => replayConnected,
  });
  const replayContext = emitterDouble({
    browser: () => replayBrowser,
  });
  const replayPage = emitterDouble({
    context: () => replayContext,
    isClosed: () => false,
  });
  const topologyAuthority = Object.freeze(Object.create(null));
  return {
    created,
    recordingBrowser,
    recordingContext,
    replayBrowser,
    replayContext,
    replayPage,
    topologyAuthority,
    closeRecordingContext() {
      recordingContext.emit('close');
    },
    disconnectRecordingBrowser() {
      recordingConnected = false;
      recordingBrowser.emit('disconnected');
    },
    disconnectReplayBrowser() {
      replayConnected = false;
    },
  };
}

function authorize(h, overrides = {}) {
  return authorizeFreshReplayRuntime({
    witness: h.created.witness,
    replayBrowser: h.replayBrowser,
    replayContext: h.replayContext,
    replayPage: h.replayPage,
    topologyAuthority: h.topologyAuthority,
    ...overrides,
  });
}

await check('A1 exact final bytes hash，不按 parse 后重序列化字节算 hash', () => {
  const bytes = captureBytes([click(1)]);
  const expected = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  const admitted = admitRawReplayCapture({
    caseId: 'tc_raw_capture',
    captureBytes: bytes,
  });
  assert(admitted?.ok === true && admitted.captureAuthority,
    `合法 capture 应准入：${JSON.stringify(admitted)}`);
  assert(admitted.captureSha256 === expected,
    `exact bytes hash 不符：${admitted.captureSha256} !== ${expected}`);
  assert(admitted.eventCount === 1, 'eventCount 应为 1');
  assert(Object.isFrozen(admitted.captureAuthority)
    && JSON.stringify(admitted.captureAuthority) === '{}',
  'capture authority 必须 opaque/frozen');

  const firstInspect = inspectAdmittedRawReplayCapture({
    captureAuthority: admitted.captureAuthority,
  });
  const secondInspect = inspectAdmittedRawReplayCapture({
    captureAuthority: admitted.captureAuthority,
  });
  for (const [label, inspected] of [
    ['first', firstInspect],
    ['second', secondInspect],
  ]) {
    assert(inspected?.ok === true
      && Buffer.isBuffer(inspected.captureBytes)
      && inspected.captureSha256 === expected,
    `${label} inspect 应返回 exact bytes/capture/hash：${JSON.stringify(inspected)}`);
    assert(inspected.capture?.events?.[0]?.selector === '#open',
      `${label} inspect 缺 admitted capture 深拷贝`);
  }
  assert(firstInspect.captureBytes !== secondInspect.captureBytes
    && firstInspect.capture !== secondInspect.capture
    && firstInspect.capture.source !== secondInspect.capture.source
    && firstInspect.capture.events !== secondInspect.capture.events
    && firstInspect.capture.events[0] !== secondInspect.capture.events[0],
  '合法 capture authority 必须可多次 inspect，且每次返回 bytes/document 深拷贝');
  assert(firstInspect.captureBytes.equals(bytes)
    && secondInspect.captureBytes.equals(bytes),
  '多次 inspect 都必须忠实返回 admitted exact bytes');

  for (const authority of [
    structuredClone(admitted.captureAuthority),
    Object.freeze({}),
  ]) {
    const denied = inspectAdmittedRawReplayCapture({ captureAuthority: authority });
    assert(denied?.ok === false
      && denied.reason === 'RAW_CAPTURE_AUTHORITY_INVALID',
    `clone/forge capture authority 应拒：${JSON.stringify(denied)}`);
  }

  const whitespaceVariant = Buffer.concat([bytes.subarray(0, bytes.length - 1), Buffer.from(' \n')]);
  const variant = admitRawReplayCapture({
    caseId: 'tc_raw_capture',
    captureBytes: whitespaceVariant,
  });
  assert(variant?.ok === true, '只改 JSON 尾部空白仍是合法 capture');
  assert(variant.captureSha256 !== admitted.captureSha256,
    '字节变化必须改变 capture hash，不能按 parsed doc 哈希');
});

await check('A2 caseId 不全等先于 event 执行拒绝', () => {
  const denied = admitRawReplayCapture({
    caseId: 'tc_other',
    captureBytes: captureBytes([click(1)]),
  });
  expectDenied(denied, 'CAPTURE_CASE_MISMATCH', 'caseId mismatch');
});

await check('A3 seq 非正安全整数具名拒绝', () => {
  for (const seq of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '1']) {
    const denied = admitRawReplayCapture({
      caseId: 'tc_raw_capture',
      captureBytes: captureBytes([click(seq)]),
    });
    expectDenied(denied, 'CAPTURE_SEQ_INVALID', `seq=${String(seq)}`);
  }
});

await check('A4 seq duplicate 优先于 gap，且不铸 authority', () => {
  const denied = admitRawReplayCapture({
    caseId: 'tc_raw_capture',
    captureBytes: captureBytes([click(1), click(1, '#second')]),
  });
  expectDenied(denied, 'CAPTURE_SEQ_DUPLICATE', 'duplicate seq');
});

await check('A5 seq gap 与乱序统一具名拒绝', () => {
  for (const events of [
    [click(1), click(3, '#third')],
    [click(2), click(1, '#first')],
  ]) {
    const denied = admitRawReplayCapture({
      caseId: 'tc_raw_capture',
      captureBytes: captureBytes(events),
    });
    expectDenied(denied, 'CAPTURE_SEQ_GAP', 'seq gap/order');
  }
});

await check('A6 尾部 sensitive/masked 由 admission→orchestration 边界整包拒且副作用全零', async () => {
  for (const forbiddenEvidence of [
    {
      seq: 2,
      action: 'fill',
      path: '/home?tab=mine',
      selector: '#credential',
      value: '<redacted>',
      valueMasked: true,
    },
    {
      seq: 2,
      action: 'click',
      path: '/home?tab=mine',
      selector: '#masked-click',
      valueMasked: true,
    },
    {
      seq: 2,
      action: 'press',
      path: '/home?tab=mine',
      selector: '#masked-press',
      key: 'Enter',
      value: '<redacted>',
    },
    {
      seq: 2,
      action: 'click',
      path: '/home?tab=mine',
      selector: '#sensitive-metadata',
      fieldLabel: '动态验证码',
    },
    {
      seq: 2,
      action: 'newpage',
      path: '/popup',
      valueMasked: true,
    },
  ]) {
    const boundary = orchestrationBoundary(captureBytes([click(1), forbiddenEvidence]));
    const admitted = await admitAndRunRawReplay(boundary.options);
    expectDenied(
      admitted,
      'MASKED_FILL_UNREPLAYABLE',
      `sensitive/masked ${forbiddenEvidence.action}`,
    );
    assertZeroBoundaryEffects(boundary, `sensitive/masked ${forbiddenEvidence.action}`);
  }
});

await check('A7 尾部 selectorless coordinate action 整包拒且编排副作用全零', async () => {
  for (const action of ['click', 'dblclick']) {
    const boundary = orchestrationBoundary(captureBytes([
      click(1),
      {
        seq: 2,
        action,
        path: '/home?tab=mine',
        x: 120,
        y: 80,
        ox: 12,
        oy: 8,
      },
    ]));
    const selectorless = await admitAndRunRawReplay(boundary.options);
    expectDenied(
      selectorless,
      'SELECTOR_UNAVAILABLE',
      `selectorless coordinate ${action}`,
    );
    assertZeroBoundaryEffects(boundary, `selectorless coordinate ${action}`);
  }
});

await check('A8 orphan newpage 在 runtime 前拒绝', () => {
  const topology = admitRawReplayCapture({
    caseId: 'tc_raw_capture',
    captureBytes: captureBytes([
      { seq: 1, action: 'newpage', path: '/agents' },
    ]),
  });
  assert(topology?.ok === false
    && topology.reason === 'TOPOLOGY_TRIGGER_MISSING',
  `orphan newpage 应由 topology 预检拒：${JSON.stringify(topology)}`);
});

await check('F1 lifecycle 未真实闭合时不能靠对象或布尔自报铸 fresh authority', () => {
  const h = runtimeHarness();
  const before = authorize(h);
  assert(before?.ok === false && before.reason === 'RECORDING_RUNTIME_NOT_CLOSED',
    `未 close/disconnected 应拒：${JSON.stringify(before)}`);

  h.closeRecordingContext();
  const half = authorize(h);
  assert(half?.ok === false && half.reason === 'RECORDING_RUNTIME_NOT_CLOSED',
    `只 close context 仍应拒：${JSON.stringify(half)}`);

  const forged = authorizeFreshReplayRuntime({
    witness: { fresh: true },
    replayBrowser: h.replayBrowser,
    replayContext: h.replayContext,
    replayPage: h.replayPage,
    topologyAuthority: h.topologyAuthority,
  });
  assert(forged?.ok === false && forged.reason === 'FRESH_RUNTIME_WITNESS_INVALID',
    `布尔自报 witness 应拒：${JSON.stringify(forged)}`);
});

await check('F2 witness clone/spread 即使 lifecycle 已闭合也不能铸权', () => {
  const h = runtimeHarness();
  h.closeRecordingContext();
  h.disconnectRecordingBrowser();
  for (const witness of [
    structuredClone(h.created.witness),
    { ...h.created.witness },
    Object.freeze({}),
  ]) {
    const denied = authorize(h, { witness });
    assert(denied?.ok === false && denied.reason === 'FRESH_RUNTIME_WITNESS_INVALID',
      `伪造 witness 应拒：${JSON.stringify(denied)}`);
  }
});

await check('F3 复用 recording Browser 不能冒充 fresh browser', () => {
  const h = runtimeHarness();
  h.closeRecordingContext();
  h.disconnectRecordingBrowser();
  const reusedContext = emitterDouble({
    browser: () => h.recordingBrowser,
  });
  const reusedPage = emitterDouble({
    context: () => reusedContext,
    isClosed: () => false,
  });
  const denied = authorize(h, {
    replayBrowser: h.recordingBrowser,
    replayContext: reusedContext,
    replayPage: reusedPage,
  });
  assert(denied?.ok === false && denied.reason === 'REPLAY_RUNTIME_NOT_FRESH',
    `复用 recording Browser 应拒：${JSON.stringify(denied)}`);
});

await check('F4 context/browser/page/topology ownership 错配具名拒绝', () => {
  const cases = [
    (h) => ({
      replayContext: emitterDouble({ browser: () => Object.freeze({}) }),
    }),
    (h) => ({
      replayPage: emitterDouble({
        context: () => Object.freeze({}),
        isClosed: () => false,
      }),
    }),
  ];
  for (const mutate of cases) {
    const h = runtimeHarness();
    h.closeRecordingContext();
    h.disconnectRecordingBrowser();
    const denied = authorize(h, mutate(h));
    assert(denied?.ok === false
      && denied.reason === 'REPLAY_RUNTIME_OWNERSHIP_MISMATCH',
    `ownership mismatch 应拒：${JSON.stringify(denied)}`);
  }
});

await check('F5 fresh authority opaque、绑定 topology、clone 拒且只消费一次', () => {
  const h = runtimeHarness();
  h.closeRecordingContext();
  h.disconnectRecordingBrowser();
  const authorized = authorize(h);
  assert(authorized?.ok === true && authorized.freshRuntimeAuthority,
    `合法 fresh runtime 应铸权：${JSON.stringify(authorized)}`);
  const authority = authorized.freshRuntimeAuthority;
  assert(Object.isFrozen(authority) && JSON.stringify(authority) === '{}',
    'fresh authority 必须 opaque/frozen');
  const publicText = JSON.stringify(authorized.receipt || {});
  assert(!/fresh(?:Browser|Context)?["']?\s*:\s*true/i.test(publicText)
    && !publicText.includes('://'),
  `公开 receipt 不得用布尔自报或泄 host：${publicText}`);

  const clone = consumeFreshReplayRuntimeAuthority({
    freshRuntimeAuthority: structuredClone(authority),
    topologyAuthority: h.topologyAuthority,
  });
  assert(clone?.ok === false && clone.reason === 'FRESH_RUNTIME_AUTHORITY_INVALID',
    `clone authority 应拒：${JSON.stringify(clone)}`);

  const wrongTopology = consumeFreshReplayRuntimeAuthority({
    freshRuntimeAuthority: authority,
    topologyAuthority: Object.freeze({}),
  });
  assert(wrongTopology?.ok === false
    && wrongTopology.reason === 'REPLAY_RUNTIME_OWNERSHIP_MISMATCH',
  `错 topology 应拒且不得消费：${JSON.stringify(wrongTopology)}`);

  const first = consumeFreshReplayRuntimeAuthority({
    freshRuntimeAuthority: authority,
    topologyAuthority: h.topologyAuthority,
  });
  assert(first?.ok === true, `原 authority 应消费成功：${JSON.stringify(first)}`);
  const replayed = consumeFreshReplayRuntimeAuthority({
    freshRuntimeAuthority: authority,
    topologyAuthority: h.topologyAuthority,
  });
  assert(replayed?.ok === false
    && replayed.reason === 'FRESH_RUNTIME_AUTHORITY_INVALID',
  `authority 重放应拒：${JSON.stringify(replayed)}`);
});

await check('F6 同一 replay Browser/Context/Page 三层对象不得再次铸 fresh authority', () => {
  const first = runtimeHarness();
  first.closeRecordingContext();
  first.disconnectRecordingBrowser();
  const firstAuthorized = authorize(first);
  assert(firstAuthorized?.ok === true && firstAuthorized.freshRuntimeAuthority,
    `首枚 authority 应铸造成功：${JSON.stringify(firstAuthorized)}`);

  const secondWitness = runtimeHarness();
  secondWitness.closeRecordingContext();
  secondWitness.disconnectRecordingBrowser();
  const reused = authorizeFreshReplayRuntime({
    witness: secondWitness.created.witness,
    replayBrowser: first.replayBrowser,
    replayContext: first.replayContext,
    replayPage: first.replayPage,
    topologyAuthority: first.topologyAuthority,
  });
  assert(reused?.ok === false && reused.reason === 'REPLAY_RUNTIME_REUSED',
    `同一 replay 三层对象二次铸权必须稳定拒绝：${JSON.stringify(reused)}`);
  assert(!reused.freshRuntimeAuthority, 'runtime reused 不得铸第二枚 authority');
});

if (failures.length) {
  console.error(`RED  ${TAG}: ${failures.length}/${passed + failures.length} 检查未过`);
  process.exit(1);
}
console.log(`ok   ${TAG}: ${passed}/${passed} 检查全过`);
