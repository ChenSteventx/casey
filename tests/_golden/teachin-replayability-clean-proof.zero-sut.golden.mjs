#!/usr/bin/env node
// teachin-replayability-closure：CLEAN proof 只读 inspect 与一次性 consume 分权。
// 纯内存 action/runtime doubles，零 browser/SUT/network/LLM。

import { resolveExecutionTarget } from '../../lib/execution-target/authority.mjs';

const TAG = 'teachin-replayability-clean-proof';
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

let freshApi;
let runnerApi;
let proofApi;
try {
  [freshApi, runnerApi, proofApi] = await Promise.all([
    import('../../lib/teachin/fresh-runtime.mjs'),
    import('../../lib/teachin/raw-replay-runner.mjs'),
    import('../../lib/teachin/raw-proof.mjs'),
  ]);
} catch {
  console.error(`RED  ${TAG}: frozen API import failed（实现模块尚未落地）`);
  process.exit(1);
}

const {
  authorizeFreshReplayRuntime,
  createFreshReplayWitness,
} = freshApi;
const { admitAndRunRawReplay } = runnerApi;
const {
  consumeCleanRawReplay,
  inspectCleanRawReplayAuthority,
} = proofApi;

for (const [name, fn] of Object.entries({
  authorizeFreshReplayRuntime,
  createFreshReplayWitness,
  admitAndRunRawReplay,
  consumeCleanRawReplay,
  inspectCleanRawReplayAuthority,
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

function expectInvalid(result, label) {
  assert(result?.ok === false
    && result.reason === 'CLEAN_PROOF_AUTHORITY_INVALID',
  `${label} 应 CLEAN_PROOF_AUTHORITY_INVALID：${JSON.stringify(result)}`);
  exactKeys(result, ['ok', 'reason'], `${label} failure`);
  assert(!JSON.stringify(result).includes('POISON_INSPECT_ERROR'),
    `${label} 失败输出不得泄异常原文`);
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
  return authorized.freshRuntimeAuthority;
}

function captureBytes(tag) {
  return Buffer.from(JSON.stringify({
    schemaVersion: 1,
    artifactKind: 'teach-in-capture',
    caseId: `tc_clean_proof_${tag}`,
    createdAt: '2026-07-27T00:00:00.000Z',
    startPath: '/home',
    source: {
      kind: 'manual',
      signed: false,
      replayReady: false,
      distillRequired: true,
    },
    events: [{
      seq: 1,
      action: 'click',
      path: '/home',
      selector: '#inspect',
    }],
  }, null, 2) + '\n');
}

const execution = resolveExecutionTarget({
  runtime: { platform: 'linux', isWSL: false },
  logicalTarget: { startUrl: 'https://clean-proof.invalid/home' },
  transport: { mode: 'direct' },
  requiresOriginContinuity: true,
});
assert(execution?.ok === true && execution.authority,
  `合成 execution authority 应成功：${JSON.stringify(execution)}`);

async function mintClean(tag) {
  const bytes = captureBytes(tag);
  const activePageAuthority = Object.freeze(Object.create(null));
  const topologyAuthority = Object.freeze({
    activePageAuthority() {
      return activePageAuthority;
    },
  });
  const actionAuthorities = new WeakSet();
  const actionDriver = {
    async readActivePath() {
      return '/home';
    },
    async resolve({ event }) {
      assert(event?.action === 'click' && event.fallbackCss === '#inspect',
        `raw action 投影漂移：${JSON.stringify(event)}`);
      const actionAuthority = Object.freeze(Object.create(null));
      actionAuthorities.add(actionAuthority);
      return {
        resolution: 'unique',
        candidateCount: 1,
        actionAuthority,
      };
    },
    async perform({ actionAuthority }) {
      assert(actionAuthorities.has(actionAuthority),
        'perform 必须消费同一 resolve authority');
      actionAuthorities.delete(actionAuthority);
      return { ok: true, identityReadback: { ok: true } };
    },
  };
  const result = await admitAndRunRawReplay({
    caseId: `tc_clean_proof_${tag}`,
    captureBytes: bytes,
    freshRuntimeFactory({ topologyAuthority: actualTopology }) {
      assert(actualTopology === topologyAuthority,
        'fresh factory topology authority 被替换');
      return {
        ok: true,
        freshRuntimeAuthority: mintFresh(topologyAuthority),
      };
    },
    topologyAuthority,
    executionTargetAuthority: execution.authority,
    actionDriver,
  });
  assert(result?.ok === true
    && result.status === 'CLEAN'
    && result.cleanProofAuthority,
  `raw runner 应真铸 CLEAN authority：${JSON.stringify(result)}`);
  return {
    authority: result.cleanProofAuthority,
    bytes,
    captureSha256: result.proof.captureSha256,
    proof: result.proof,
  };
}

await check('I1 genuine authority 可重复 inspect，成功形状精确且 inspect 不消费', async () => {
  const clean = await mintClean('i1');
  for (let index = 0; index < 2; index += 1) {
    const inspected = inspectCleanRawReplayAuthority({
      cleanProofAuthority: clean.authority,
    });
    exactKeys(inspected, ['ok', 'captureSha256'], `inspect ${index + 1}`);
    assert(inspected.ok === true
      && inspected.captureSha256 === clean.captureSha256,
    `inspect ${index + 1} 必须只回 exact hash：${JSON.stringify(inspected)}`);
  }
  const consumed = consumeCleanRawReplay({
    cleanProofAuthority: clean.authority,
    currentCaptureBytes: clean.bytes,
  });
  exactKeys(consumed, ['ok', 'captureSha256'], 'consume success');
  assert(consumed.ok === true
    && consumed.captureSha256 === clean.captureSha256,
  `inspect 后 exact consume 应成功：${JSON.stringify(consumed)}`);
  expectInvalid(consumeCleanRawReplay({
    cleanProofAuthority: clean.authority,
    currentCaptureBytes: clean.bytes,
  }), 'consume replay');
});

await check('I2 plain/clone/公开 proof/未知 authority 均拒，且不伤 genuine consume', async () => {
  const clean = await mintClean('i2');
  for (const [label, authority] of [
    ['plain', Object.freeze({})],
    ['clone', structuredClone(clean.authority)],
    ['public proof', clean.proof],
    ['unknown', Object.freeze(Object.create(null))],
  ]) {
    expectInvalid(inspectCleanRawReplayAuthority({
      cleanProofAuthority: authority,
    }), label);
  }
  const genuine = inspectCleanRawReplayAuthority({
    cleanProofAuthority: clean.authority,
  });
  assert(genuine?.ok === true
    && genuine.captureSha256 === clean.captureSha256,
  `无效 inspect 不得污染 genuine authority：${JSON.stringify(genuine)}`);
  const consumed = consumeCleanRawReplay({
    cleanProofAuthority: clean.authority,
    currentCaptureBytes: clean.bytes,
  });
  assert(consumed?.ok === true,
    `无效 inspect 后 genuine consume 仍须成功：${JSON.stringify(consumed)}`);
});

await check('I3 已 consume authority 不可再 inspect；畸形 options 失败闭合不泄原异常', async () => {
  const clean = await mintClean('i3');
  const consumed = consumeCleanRawReplay({
    cleanProofAuthority: clean.authority,
    currentCaptureBytes: clean.bytes,
  });
  assert(consumed?.ok === true, `正控 consume 失败：${JSON.stringify(consumed)}`);
  expectInvalid(inspectCleanRawReplayAuthority({
    cleanProofAuthority: clean.authority,
  }), 'inspect after consume');

  const poisonedOptions = new Proxy({}, {
    get() {
      throw new Error('POISON_INSPECT_ERROR');
    },
  });
  let poisonedResult;
  try {
    poisonedResult = inspectCleanRawReplayAuthority(poisonedOptions);
  } catch (error) {
    throw new Error(`inspect 不得外抛原异常：${String(error?.message || error)}`);
  }
  expectInvalid(poisonedResult, 'poisoned options');
});

if (failures.length) {
  console.error(`\n${TAG}: ${passed} passed, ${failures.length} failed`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`\n${TAG}: ${passed} passed, 0 failed`);
