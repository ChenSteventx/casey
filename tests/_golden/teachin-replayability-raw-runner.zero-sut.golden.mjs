#!/usr/bin/env node
// teachin-replayability-closure S2：raw path checkpoint、identity gate、首错、newpage 与 CLEAN proof。
// 纯内存 driver/topology/runtime doubles，零 browser/SUT/network；不把桩成功冒充正式测试结论。

import { resolveExecutionTarget } from '../../lib/execution-target/authority.mjs';

const TAG = 'teachin-replayability-raw-runner';
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
let proofApi;
try {
  [captureApi, freshApi, runnerApi, proofApi] = await Promise.all([
    import('../../lib/teachin/raw-capture.mjs'),
    import('../../lib/teachin/fresh-runtime.mjs'),
    import('../../lib/teachin/raw-replay-runner.mjs'),
    import('../../lib/teachin/raw-proof.mjs'),
  ]);
} catch {
  console.error(`RED  ${TAG}: frozen API import failed（实现模块尚未落地）`);
  process.exit(1);
}

const { admitRawReplayCapture, inspectAdmittedRawReplayCapture } = captureApi;
const {
  authorizeFreshReplayRuntime,
  createFreshReplayWitness,
} = freshApi;
const {
  admitAndRunRawReplay,
  runRawReplay,
} = runnerApi;
const { consumeCleanRawReplay } = proofApi;

for (const [name, fn] of Object.entries({
  admitRawReplayCapture,
  inspectAdmittedRawReplayCapture,
  authorizeFreshReplayRuntime,
  createFreshReplayWitness,
  admitAndRunRawReplay,
  runRawReplay,
  consumeCleanRawReplay,
})) {
  assert(typeof fn === 'function', `缺 frozen API ${name}`);
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

function captureBytes(events) {
  return Buffer.from(JSON.stringify({
    schemaVersion: 1,
    artifactKind: 'teach-in-capture',
    caseId: 'tc_raw_runner',
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

function click(seq, path = '/home', selector = '#next') {
  return { seq, action: 'click', path, selector };
}

const execution = resolveExecutionTarget({
  runtime: { platform: 'linux', isWSL: false },
  logicalTarget: { startUrl: 'https://raw-runner.invalid/home' },
  transport: { mode: 'direct' },
  requiresOriginContinuity: true,
});
assert(execution?.ok === true && execution.authority,
  `合成 execution authority 应成功：${JSON.stringify(execution)}`);

function topologyDouble({
  consumeResult = { ok: true },
  expectedNewPagePath = '/agents',
} = {}) {
  const initialAuthority = Object.freeze(Object.create(null));
  const popupAuthority = Object.freeze(Object.create(null));
  let activeAuthority = initialAuthority;
  const calls = [];
  return {
    topology: {
      activePageAuthority() {
        return activeAuthority;
      },
      async consumeNewPageEvent({ pageAuthority, event }) {
        calls.push({ pageAuthority, event });
        if (consumeResult.ok !== true) return consumeResult;
        if (pageAuthority !== popupAuthority
          || event?.action !== 'newpage'
          || event?.path !== expectedNewPagePath) {
          return { ok: false, reason: 'TOPOLOGY_PATH_MISMATCH' };
        }
        return { ok: true, pageId: 'opaque_page' };
      },
      promoteToPopup() {
        activeAuthority = popupAuthority;
      },
    },
    initialAuthority,
    popupAuthority,
    calls,
  };
}

function mintFreshRuntime(topologyAuthority) {
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
  assert(witnessed?.ok === true, `witness 创建失败：${JSON.stringify(witnessed)}`);
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
  return authorized.freshRuntimeAuthority;
}

// actionDriver 的冻结窄接口：
// - readActivePath：只回 host-free path+query；
// - resolve：只解析 selector，unique 时铸一次性 actionAuthority，不产生页面副作用；
// - perform：只消费 genuine actionAuthority 执行真实动作；
// - goto：poison method，raw runner 在任何分支调用即金牌红。
function actionDriverDouble({
  paths = [],
  resolutions = [],
  actionResults = [],
  topology,
  promoteOnSelector = null,
} = {}) {
  let pathIndex = 0;
  let resolutionIndex = 0;
  let actionIndex = 0;
  let gotoCalls = 0;
  let resolveCalls = 0;
  let performCalls = 0;
  const seenEvents = [];
  const actionGates = new WeakMap();
  return {
    driver: {
      async readActivePath() {
        return paths[pathIndex++];
      },
      async resolve({ event, topologyAuthority, executionTargetAuthority }) {
        resolveCalls += 1;
        seenEvents.push(event);
        assert(topologyAuthority === topology, 'resolver 必须收到同一 topologyAuthority');
        assert(executionTargetAuthority === execution.authority,
          'resolver 必须收到 opaque execution target authority');
        assert(typeof event.fallbackCss === 'string' && event.fallbackCss,
          `selector 未固定投影到 fallbackCss：${JSON.stringify(event)}`);
        const resolution = resolutions[resolutionIndex++] || {
          resolution: 'unique',
          candidateCount: 1,
        };
        if (resolution.resolution !== 'unique' || resolution.candidateCount !== 1) {
          return resolution;
        }
        const actionAuthority = Object.freeze(Object.create(null));
        actionGates.set(actionAuthority, { event });
        return { ...resolution, actionAuthority };
      },
      async perform({ actionAuthority, topologyAuthority, executionTargetAuthority }) {
        performCalls += 1;
        const gate = actionGates.get(actionAuthority);
        assert(gate, 'perform 必须消费 resolver 铸造的 genuine actionAuthority');
        actionGates.delete(actionAuthority);
        assert(topologyAuthority === topology, 'perform 必须收到同一 topologyAuthority');
        assert(executionTargetAuthority === execution.authority,
          'perform 必须收到 opaque execution target authority');
        if (promoteOnSelector && gate.event.fallbackCss === promoteOnSelector) {
          topology.promoteToPopup();
        }
        return actionResults[actionIndex++] || {
          ok: true,
          identityReadback: { ok: true },
        };
      },
      async goto() {
        gotoCalls += 1;
        throw new Error('RAW_NAV_MUST_NOT_GOTO');
      },
    },
    stats: {
      get pathCalls() { return pathIndex; },
      get resolveCalls() { return resolveCalls; },
      get performCalls() { return performCalls; },
      get gotoCalls() { return gotoCalls; },
      seenEvents,
    },
  };
}

async function execute({
  events,
  paths,
  resolutions,
  actionResults,
  topologyFixture = topologyDouble(),
  promoteOnSelector = null,
} = {}) {
  const bytes = captureBytes(events);
  const action = actionDriverDouble({
    paths,
    resolutions,
    actionResults,
    topology: topologyFixture.topology,
    promoteOnSelector,
  });
  let freshFactoryCalls = 0;
  const result = await admitAndRunRawReplay({
    caseId: 'tc_raw_runner',
    captureBytes: bytes,
    freshRuntimeFactory({ topologyAuthority }) {
      freshFactoryCalls += 1;
      assert(topologyAuthority === topologyFixture.topology,
        'fresh factory 必须收到同一 topologyAuthority');
      return {
        ok: true,
        freshRuntimeAuthority: mintFreshRuntime(topologyAuthority),
      };
    },
    executionTargetAuthority: execution.authority,
    topologyAuthority: topologyFixture.topology,
    actionDriver: action.driver,
  });
  return {
    result,
    bytes,
    action,
    freshFactoryCalls,
    topologyFixture,
  };
}

function directRunFixture({ paths = ['/home'] } = {}) {
  const bytes = captureBytes([click(1)]);
  const admitted = admitRawReplayCapture({
    caseId: 'tc_raw_runner',
    captureBytes: bytes,
  });
  assert(admitted?.ok === true && admitted.captureAuthority,
    `direct fixture capture 应准入：${JSON.stringify(admitted)}`);
  const topologyFixture = topologyDouble();
  const freshRuntimeAuthority = mintFreshRuntime(topologyFixture.topology);
  const action = actionDriverDouble({
    paths,
    topology: topologyFixture.topology,
  });
  return {
    action,
    captureAuthority: admitted.captureAuthority,
    captureBytes: bytes,
    freshRuntimeAuthority,
    run(authority = freshRuntimeAuthority) {
      return runRawReplay({
        captureAuthority: admitted.captureAuthority,
        freshRuntimeAuthority: authority,
        executionTargetAuthority: execution.authority,
        topologyAuthority: topologyFixture.topology,
        actionDriver: action.driver,
      });
    },
  };
}

await check('R0 runner 边界拒 plain/clone/replay fresh authority，genuine 只消费一次', async () => {
  const plain = directRunFixture();
  const plainDenied = await plain.run(Object.freeze({}));
  assert(plainDenied?.ok === false
    && plainDenied.reason === 'FRESH_RUNTIME_AUTHORITY_INVALID',
  `plain fresh authority 应拒：${JSON.stringify(plainDenied)}`);
  assert(plain.action.stats.pathCalls === 0
    && plain.action.stats.resolveCalls === 0
    && plain.action.stats.performCalls === 0,
  'plain authority 必须在 read/resolve/perform 前拒绝');

  const guarded = directRunFixture();
  const cloneDenied = await guarded.run(structuredClone(guarded.freshRuntimeAuthority));
  assert(cloneDenied?.ok === false
    && cloneDenied.reason === 'FRESH_RUNTIME_AUTHORITY_INVALID',
  `clone fresh authority 应拒：${JSON.stringify(cloneDenied)}`);
  assert(guarded.action.stats.pathCalls === 0
    && guarded.action.stats.resolveCalls === 0
    && guarded.action.stats.performCalls === 0,
  'clone 拒绝不得消费 genuine authority 或触发 read/resolve/perform');

  const clean = await guarded.run();
  assert(clean?.ok === true && clean.status === 'CLEAN',
    `genuine authority 应在 runner 边界消费成功：${JSON.stringify(clean)}`);
  const inspectedAfterRun = inspectAdmittedRawReplayCapture(
    { captureAuthority: guarded.captureAuthority },
  );
  assert(inspectedAfterRun?.ok === true
    && inspectedAfterRun.captureBytes.equals(guarded.captureBytes),
  `runRawReplay 不得消费 captureAuthority，多读 inspect 应仍成功：${JSON.stringify(inspectedAfterRun)}`);
  const replayed = await guarded.run();
  assert(replayed?.ok === false
    && replayed.reason === 'FRESH_RUNTIME_AUTHORITY_INVALID',
  `已消费 fresh authority 重放应拒：${JSON.stringify(replayed)}`);
  assert(guarded.action.stats.pathCalls === 1
    && guarded.action.stats.resolveCalls === 1
    && guarded.action.stats.performCalls === 1,
  'fresh authority 重放不得触发第二轮 read/resolve/perform');

  const failed = directRunFixture({ paths: ['/wrong'] });
  const firstFailure = await failed.run();
  assert(firstFailure?.ok === false
    && firstFailure.reason === 'PATH_CHECKPOINT_MISMATCH',
  `genuine authority 的首次失败应保留业务 reason：${JSON.stringify(firstFailure)}`);
  const afterFailure = await failed.run();
  assert(afterFailure?.ok === false
    && afterFailure.reason === 'FRESH_RUNTIME_AUTHORITY_INVALID',
  `fresh authority 必须在 run 入口消费，失败后也不得重试：${JSON.stringify(afterFailure)}`);
  assert(failed.action.stats.pathCalls === 1
    && failed.action.stats.resolveCalls === 0
    && failed.action.stats.performCalls === 0,
  '首次失败后的 authority 重放不得再次 read/resolve/perform');
});

await check('R1 nav 只作 path checkpoint；随后 unique click 全消费且 goto 恒零', async () => {
  const run = await execute({
    events: [
      { seq: 1, action: 'nav', path: '/home' },
      click(2, '/home', '#next'),
    ],
    paths: ['/home', '/home'],
  });
  const { result, action } = run;
  assert(result?.ok === true && result.status === 'CLEAN'
    && result.cleanProofAuthority,
  `合法 raw replay 应 CLEAN：${JSON.stringify(result)}`);
  assert(run.freshFactoryCalls === 1, '合法 admission 后 fresh factory 应恰调用一次');
  assert(action.stats.pathCalls === 2, '每 event 应恰读一次 path');
  assert(action.stats.resolveCalls === 1 && action.stats.performCalls === 1,
    'nav 不解析/动作，click 恰解析并动作一次');
  assert(action.stats.gotoCalls === 0, 'raw nav 任何时候不得 goto');
  assert(action.stats.seenEvents[0]?.fallbackCss === '#next',
    'capture selector 必须投影为 fallbackCss');
  assert(result.proof?.totalEvents === 2
    && result.proof?.consumedEvents === 2
    && result.proof?.steps?.length === 2,
  `CLEAN proof 消费计数不符：${JSON.stringify(result.proof)}`);
  const publicText = JSON.stringify(result.proof);
  assert(!/PASS|verdict|:\/\//i.test(publicText)
    && !/raw-runner\.invalid|selector|fieldLabel|value|text/.test(publicText),
  `proof 泄正式结论/host/自由字段：${publicText}`);
});

await check('R2 path mismatch 首错停止：零 locator/action、零 goto、后续 path 不读', async () => {
  const run = await execute({
    events: [click(1, '/wanted', '#one'), click(2, '/wanted', '#two')],
    paths: ['/actual', '/wanted'],
  });
  assert(run.result?.ok === false
    && run.result.reason === 'PATH_CHECKPOINT_MISMATCH'
    && run.result.status === 'FAILED',
  `path mismatch 应具名失败：${JSON.stringify(run.result)}`);
  assert(run.action.stats.pathCalls === 1, '首错后不得读取后续 path');
  assert(run.action.stats.resolveCalls === 0
    && run.action.stats.performCalls === 0
    && run.action.stats.gotoCalls === 0,
  'path mismatch 不得 resolver/action/goto');
  assert(run.result.proof?.steps?.length === 1
    && !run.result.cleanProofAuthority,
  'FAILED proof 只保留首错且不得铸 CLEAN authority');
});

await check('R3 nav checkpoint mismatch 也不得 goto 修正', async () => {
  const run = await execute({
    events: [
      { seq: 1, action: 'nav', path: '/wanted' },
      click(2, '/wanted', '#later'),
    ],
    paths: ['/actual'],
  });
  assert(run.result?.reason === 'PATH_CHECKPOINT_MISMATCH',
    `nav mismatch 应拒：${JSON.stringify(run.result)}`);
  assert(run.action.stats.gotoCalls === 0
    && run.action.stats.resolveCalls === 0
    && run.action.stats.performCalls === 0
    && run.action.stats.pathCalls === 1,
  'nav mismatch 不得纠偏或继续');
});

await check('R4 selector count gate 只放恰一；none/ambiguous/伪 unique 的 perform 均为零', async () => {
  for (const [resolution, reason, candidateCount] of [
    ['none', 'SELECTOR_NONE', 0],
    ['ambiguous', 'SELECTOR_AMBIGUOUS', 2],
    ['unique', 'SELECTOR_AMBIGUOUS', 2],
  ]) {
    const run = await execute({
      events: [click(1, '/home', `#${resolution}`)],
      paths: ['/home'],
      resolutions: [{ resolution, candidateCount }],
    });
    assert(run.result?.ok === false && run.result.reason === reason,
      `${resolution} 应映射 ${reason}：${JSON.stringify(run.result)}`);
    assert(run.action.stats.resolveCalls === 1
      && run.action.stats.performCalls === 0,
    `${resolution} 只能 resolve，真实 perform spy 必须为零`);
    assert(run.action.stats.gotoCalls === 0, `${resolution} 不得 goto`);
  }
});

await check('R5 action_failed 是首错，第三事件完全不执行', async () => {
  const run = await execute({
    events: [
      click(1, '/home', '#one'),
      click(2, '/home', '#fail'),
      click(3, '/home', '#must-not-run'),
    ],
    paths: ['/home', '/home', '/home'],
    actionResults: [
      { ok: true, identityReadback: { ok: true } },
      { ok: false, reason: 'ACTION_FAILED', identityReadback: { ok: false } },
      { ok: true, identityReadback: { ok: true } },
    ],
  });
  assert(run.result?.ok === false && run.result.reason === 'ACTION_FAILED',
  `action_failed 应具名失败：${JSON.stringify(run.result)}`);
  assert(run.action.stats.pathCalls === 2
    && run.action.stats.resolveCalls === 2
    && run.action.stats.performCalls === 2,
  '首错后第三事件 path/perform 必须零调用');
  assert(run.result.proof?.steps?.length === 2
    && run.result.proof.steps[1].reason === 'ACTION_FAILED',
  'FAILED proof 只应含成功前缀+首错');
});

await check('R6 click→newpage 复用 topology，active authority/path 正确才 CLEAN', async () => {
  const topology = topologyDouble({ expectedNewPagePath: '/agents' });
  const run = await execute({
    events: [
      click(1, '/home', '#open-popup'),
      { seq: 2, action: 'newpage', path: '/agents' },
    ],
    paths: ['/home', '/agents'],
    topologyFixture: topology,
    promoteOnSelector: '#open-popup',
  });
  assert(run.result?.ok === true && run.result.status === 'CLEAN',
    `合法 topology 应 CLEAN：${JSON.stringify(run.result)}`);
  assert(run.action.stats.resolveCalls === 1
    && run.action.stats.performCalls === 1,
  'newpage 是结构消费，不得交普通 resolve/perform');
  assert(topology.calls.length === 1
    && topology.calls[0].pageAuthority === topology.popupAuthority
    && topology.calls[0].event.path === '/agents',
  `newpage 必须用切换后的 active authority 消费：${JSON.stringify(topology.calls)}`);
  assert(run.result.proof?.steps?.map((step) => step.action).join(',')
    === 'click,newpage',
  'proof 必须忠实保留 topology event');
});

await check('R7 newpage topology 首错保留 reason，后续业务事件零执行', async () => {
  const topology = topologyDouble({
    consumeResult: { ok: false, reason: 'TOPOLOGY_PATH_MISMATCH' },
  });
  const run = await execute({
    events: [
      click(1, '/home', '#open-popup'),
      { seq: 2, action: 'newpage', path: '/agents' },
      click(3, '/agents', '#must-not-run'),
    ],
    paths: ['/home', '/agents', '/agents'],
    topologyFixture: topology,
    promoteOnSelector: '#open-popup',
  });
  assert(run.result?.ok === false
    && run.result.reason === 'TOPOLOGY_PATH_MISMATCH',
  `topology reason 应保留：${JSON.stringify(run.result)}`);
  assert(run.action.stats.pathCalls === 2
    && run.action.stats.resolveCalls === 1
    && run.action.stats.performCalls === 1,
  'topology 首错后第三事件必须零 path/perform');
  assert(!run.result.cleanProofAuthority, 'topology 失败不得铸 CLEAN authority');
});

await check('R8 CLEAN authority 绑定 exact capture bytes，clone/重放/换包均拒', async () => {
  const firstRun = await execute({
    events: [click(1)],
    paths: ['/home'],
  });
  assert(firstRun.result?.cleanProofAuthority, '正控须有 CLEAN authority');
  const cloned = consumeCleanRawReplay({
    cleanProofAuthority: structuredClone(firstRun.result.cleanProofAuthority),
    currentCaptureBytes: firstRun.bytes,
  });
  assert(cloned?.ok === false
    && cloned.reason === 'CLEAN_PROOF_AUTHORITY_INVALID',
  `clone proof authority 应拒：${JSON.stringify(cloned)}`);
  const plainProof = consumeCleanRawReplay({
    cleanProofAuthority: firstRun.result.proof,
    currentCaptureBytes: firstRun.bytes,
  });
  assert(plainProof?.ok === false
    && plainProof.reason === 'CLEAN_PROOF_AUTHORITY_INVALID',
  `持久化 proof 对象不得冒充 authority：${JSON.stringify(plainProof)}`);
  const consumed = consumeCleanRawReplay({
    cleanProofAuthority: firstRun.result.cleanProofAuthority,
    currentCaptureBytes: firstRun.bytes,
  });
  assert(consumed?.ok === true
    && consumed.captureSha256 === firstRun.result.proof.captureSha256,
  `exact bytes 应消费成功：${JSON.stringify(consumed)}`);
  const replayed = consumeCleanRawReplay({
    cleanProofAuthority: firstRun.result.cleanProofAuthority,
    currentCaptureBytes: firstRun.bytes,
  });
  assert(replayed?.ok === false
    && replayed.reason === 'CLEAN_PROOF_AUTHORITY_INVALID',
  `authority 重放应拒：${JSON.stringify(replayed)}`);

  const swappedRun = await execute({
    events: [click(1)],
    paths: ['/home'],
  });
  const swappedBytes = Buffer.concat([
    swappedRun.bytes.subarray(0, swappedRun.bytes.length - 1),
    Buffer.from(' \n'),
  ]);
  const swapped = consumeCleanRawReplay({
    cleanProofAuthority: swappedRun.result.cleanProofAuthority,
    currentCaptureBytes: swappedBytes,
  });
  assert(swapped?.ok === false && swapped.reason === 'CAPTURE_HASH_MISMATCH',
    `换一字节必须拒：${JSON.stringify(swapped)}`);
});

if (failures.length) {
  console.error(`RED  ${TAG}: ${failures.length}/${passed + failures.length} 检查未过`);
  process.exit(1);
}
console.log(`ok   ${TAG}: ${passed}/${passed} 检查全过`);
