#!/usr/bin/env node
// teachin-replayability-closure S3 authority/coverage 分门：
// canonical inspector + exact-byte clean proof consumption + stable coverage reasons。
// 纯内存 doubles，零 browser/SUT/network/LLM。

import { readFileSync } from 'node:fs';
import { resolveExecutionTarget } from '../../lib/execution-target/authority.mjs';
import { validateBridge } from '../../lib/flow-bridge.mjs';

const TAG = 'teachin-replayability-resolved-authority-coverage';
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
    const detail = String(error?.message || error).slice(-900);
    failures.push(`${name}: ${detail}`);
    console.error(`RED  ${TAG}: ${name}: ${detail}`);
  }
}

let captureApi;
let freshApi;
let runnerApi;
let proofApi;
let projectionApi;
try {
  [captureApi, freshApi, runnerApi, proofApi, projectionApi] = await Promise.all([
    import('../../lib/teachin/raw-capture.mjs'),
    import('../../lib/teachin/fresh-runtime.mjs'),
    import('../../lib/teachin/raw-replay-runner.mjs'),
    import('../../lib/teachin/raw-proof.mjs'),
    import('../../lib/teachin/resolved-projection.mjs'),
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
  createFreshReplayWitness,
} = freshApi;
const { runRawReplay } = runnerApi;
const { consumeCleanRawReplay } = proofApi;
const {
  issueAtomRoundtripGrant,
  issueSourceSemanticGrant,
  resolveCaptureProjection,
} = projectionApi;

for (const [name, fn] of Object.entries({
  admitRawReplayCapture,
  inspectAdmittedRawReplayCapture,
  authorizeFreshReplayRuntime,
  createFreshReplayWitness,
  runRawReplay,
  consumeCleanRawReplay,
  issueAtomRoundtripGrant,
  issueSourceSemanticGrant,
  resolveCaptureProjection,
})) {
  assert(typeof fn === 'function', `缺 frozen API ${name}`);
}

const registry = JSON.parse(readFileSync(
  new URL('../../lib/atoms-registry.snapshot.json', import.meta.url),
  'utf8',
));
const execution = resolveExecutionTarget({
  runtime: { platform: 'linux', isWSL: false },
  logicalTarget: { startUrl: 'https://resolved-authority.invalid/home' },
  transport: { mode: 'direct' },
  requiresOriginContinuity: true,
});
assert(execution?.ok === true && execution.authority,
  '合成 execution target authority 应成功');

function emitter(extra = {}) {
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
    caseId: 'tc_resolved_authority',
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

function click(seq, text, selector = `#event-${seq}`) {
  return {
    seq,
    action: 'click',
    path: '/home',
    selector,
    text,
  };
}

function topologyDouble() {
  const initialAuthority = Object.freeze(Object.create(null));
  const popupAuthority = Object.freeze(Object.create(null));
  let activeAuthority = initialAuthority;
  return {
    activePageAuthority: () => activeAuthority,
    promote() {
      activeAuthority = popupAuthority;
    },
    async consumeNewPageEvent({ pageAuthority, event }) {
      if (pageAuthority !== popupAuthority
        || event?.action !== 'newpage'
        || typeof event.path !== 'string') {
        return { ok: false, reason: 'TOPOLOGY_PATH_MISMATCH' };
      }
      return { ok: true, pageId: 'opaque' };
    },
  };
}

function mintFreshRuntime(topologyAuthority) {
  let recordingConnected = true;
  const recordingBrowser = emitter({ isConnected: () => recordingConnected });
  const recordingContext = emitter({ browser: () => recordingBrowser });
  const witnessed = createFreshReplayWitness({
    recordingBrowser,
    recordingContext,
  });
  assert(witnessed?.ok === true && witnessed.witness,
    `fresh witness 创建失败：${JSON.stringify(witnessed)}`);
  recordingContext.emit('close');
  recordingConnected = false;
  recordingBrowser.emit('disconnected');

  const replayBrowser = emitter({ isConnected: () => true });
  const replayContext = emitter({ browser: () => replayBrowser });
  const replayPage = emitter({
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
    `fresh runtime authority 创建失败：${JSON.stringify(authorized)}`);
  return authorized.freshRuntimeAuthority;
}

async function mintClean(events) {
  const bytes = captureBytes(events);
  const admitted = admitRawReplayCapture({
    caseId: 'tc_resolved_authority',
    captureBytes: bytes,
  });
  assert(admitted?.ok === true && admitted.captureAuthority,
    `capture 准入失败：${JSON.stringify(admitted)}`);

  const topologyAuthority = topologyDouble();
  const actionAuthorities = new WeakMap();
  let pathIndex = 0;
  const actionDriver = {
    async readActivePath() {
      return events[pathIndex++]?.path;
    },
    async resolve({ event, topologyAuthority: supplied, executionTargetAuthority }) {
      assert(supplied === topologyAuthority,
        'resolve 必须收到 canonical topologyAuthority');
      assert(executionTargetAuthority === execution.authority,
        'resolve 必须收到 execution target authority');
      const actionAuthority = Object.freeze(Object.create(null));
      actionAuthorities.set(actionAuthority, event);
      return { resolution: 'unique', candidateCount: 1, actionAuthority };
    },
    async perform({
      actionAuthority,
      topologyAuthority: supplied,
      executionTargetAuthority,
    }) {
      assert(actionAuthorities.has(actionAuthority),
        'perform 必须消费 resolve 铸造的 opaque actionAuthority');
      const event = actionAuthorities.get(actionAuthority);
      actionAuthorities.delete(actionAuthority);
      assert(supplied === topologyAuthority,
        'perform 必须收到 canonical topologyAuthority');
      assert(executionTargetAuthority === execution.authority,
        'perform 必须收到 execution target authority');
      if (event?.fallbackCss === '#popup') topologyAuthority.promote();
      return { ok: true, identityReadback: { ok: true } };
    },
    async goto() {
      throw new Error('RAW_NAV_MUST_NOT_GOTO');
    },
  };
  const replayed = await runRawReplay({
    captureAuthority: admitted.captureAuthority,
    freshRuntimeAuthority: mintFreshRuntime(topologyAuthority),
    executionTargetAuthority: execution.authority,
    topologyAuthority,
    actionDriver,
  });
  assert(replayed?.ok === true
    && replayed.status === 'CLEAN'
    && replayed.cleanProofAuthority,
  `raw 正控必须 CLEAN：${JSON.stringify(replayed)}`);
  return {
    bytes,
    captureAuthority: admitted.captureAuthority,
    cleanProofAuthority: replayed.cleanProofAuthority,
  };
}

const readMapping = {
  intentId: 'i1',
  atom: 'nav.workflowManagement',
  params: {},
  evidenceEventSeqs: [1],
};
const authoredTestCase = {
  schemaVersion: 1,
  caseId: 'tc_resolved_authority',
  title: '进入流程管理',
  preconditions: ['已登录'],
  steps: [{ intentId: 'i1', intent: '进入流程管理' }],
  uniquePrefix: 'atl_',
};

function project(authorities, mappingCandidate = [readMapping]) {
  return resolveCaptureProjection({
    captureAuthority: authorities.captureAuthority,
    cleanProofAuthority: authorities.cleanProofAuthority,
    mappingCandidate,
    atomRegistry: registry,
    authoredTestCase,
  });
}

function expectReason(result, reason, label) {
  assert(result?.ok === false && result.reason === reason,
    `${label} 应拒 ${reason}：${JSON.stringify(result)}`);
  assert(!result.resolutionAuthority && !result.candidateMapping,
    `${label} 拒绝不得产 authority/半份 candidate`);
}

await check('A1 clean proof clone/forge 无权，且不得消耗 genuine proof', async () => {
  const clean = await mintClean([click(1, '流程管理')]);
  for (const cleanProofAuthority of [
    Object.freeze({}),
    { clean: true },
    structuredClone(clean.cleanProofAuthority),
  ]) {
    expectReason(project({
      ...clean,
      cleanProofAuthority,
    }), 'CLEAN_PROOF_AUTHORITY_INVALID', '伪造 clean proof');
  }
  const genuine = project(clean);
  assert(genuine?.ok === true && genuine.resolutionAuthority,
    `非法 proof 尝试后 genuine proof 仍应可消费：${JSON.stringify(genuine)}`);
});

await check('A1b capture authority plain/clone 固定拒且不得消耗 genuine proof', async () => {
  const clean = await mintClean([click(1, '流程管理')]);
  for (const captureAuthority of [
    Object.freeze({}),
    { admitted: true },
    structuredClone(clean.captureAuthority),
  ]) {
    expectReason(project({
      ...clean,
      captureAuthority,
    }), 'RAW_CAPTURE_AUTHORITY_INVALID', '伪造 capture authority');
  }
  const genuine = project(clean);
  assert(genuine?.ok === true && genuine.resolutionAuthority,
    `非法 capture 尝试后 genuine proof 仍应可消费：${JSON.stringify(genuine)}`);
});

await check('A2 capture/proof 换包按 inspector exact bytes 精确拒绝', async () => {
  const source = await mintClean([click(1, '流程管理', '#source')]);
  const swapped = await mintClean([click(1, '流程管理', '#swapped')]);
  expectReason(project({
    captureAuthority: swapped.captureAuthority,
    cleanProofAuthority: source.cleanProofAuthority,
  }), 'CAPTURE_HASH_MISMATCH', 'capture/proof 换包');
});

await check('A3 projection 成功已消费 clean proof，二次直接消费无权', async () => {
  const clean = await mintClean([click(1, '流程管理')]);
  const projected = project(clean);
  assert(projected?.ok === true && projected.resolutionAuthority,
    `projection 正控应成功：${JSON.stringify(projected)}`);
  expectReason(consumeCleanRawReplay({
    cleanProofAuthority: clean.cleanProofAuthority,
    currentCaptureBytes: clean.bytes,
  }), 'CLEAN_PROOF_AUTHORITY_INVALID', 'clean proof 二次消费');
});

await check('A4 projection 后 capture capability 仍可多读且快照相互独立', async () => {
  const clean = await mintClean([click(1, '流程管理')]);
  const before = inspectAdmittedRawReplayCapture({
    captureAuthority: clean.captureAuthority,
  });
  assert(before?.ok === true && Buffer.isBuffer(before.captureBytes),
    `projection 前 inspector 应成功：${JSON.stringify(before)}`);
  before.capture.events[0].text = 'tampered';
  before.captureBytes[0] ^= 0xff;

  const projected = project(clean);
  assert(projected?.ok === true && projected.resolutionAuthority,
    `projection 正控应成功：${JSON.stringify(projected)}`);
  const after = inspectAdmittedRawReplayCapture({
    captureAuthority: clean.captureAuthority,
  });
  assert(after?.ok === true
    && after.capture.events[0].text === '流程管理'
    && Buffer.compare(after.captureBytes, clean.bytes) === 0,
  `capture inspector 必须多读深拷贝：${JSON.stringify(after)}`);
  assert(validateBridge(
    projected.candidateTestCase,
    projected.candidateMapping,
    { registry },
  )?.ok === true, 'authority 正控 candidate 必须真过现役 flow-bridge');
});

await check('A5 resolved projection 静态直连 canonical inspector 与 clean proof consumer', () => {
  const source = readFileSync(
    new URL('../../lib/teachin/resolved-projection.mjs', import.meta.url),
    'utf8',
  );
  assert(/inspectAdmittedRawReplayCapture/.test(source)
    && /from\s+['"]\.\/raw-capture\.mjs['"]/.test(source),
  'resolved projection 必须直接 import canonical capture inspector');
  assert(/consumeCleanRawReplay/.test(source)
    && /from\s+['"]\.\/raw-proof\.mjs['"]/.test(source),
  'resolved projection 必须直接 import canonical clean proof consumer');
});

await check('A6 resolution plain/clone/unknown 不消耗两枚独立 issue slot', async () => {
  const clean = await mintClean([click(1, '流程管理')]);
  const projected = project(clean);
  assert(projected?.ok === true && projected.resolutionAuthority,
    `resolution 正控应成功：${JSON.stringify(projected)}`);
  for (const issue of [issueSourceSemanticGrant, issueAtomRoundtripGrant]) {
    for (const input of [
      { resolutionAuthority: Object.freeze(Object.create(null)) },
      { resolutionAuthority: { ...projected.resolutionAuthority } },
      { resolutionAuthority: projected.resolutionAuthority, extra: true },
    ]) {
      expectReason(issue(input), 'RESOLUTION_AUTHORITY_INVALID',
        'resolution plain/clone/unknown');
    }
  }
  const source = issueSourceSemanticGrant({
    resolutionAuthority: projected.resolutionAuthority,
  });
  const atom = issueAtomRoundtripGrant({
    resolutionAuthority: projected.resolutionAuthority,
  });
  assert(source?.ok === true && source.grant
    && atom?.ok === true && atom.grant && source.grant !== atom.grant,
  '两枚 genuine grant 必须分别铸造且 opaque identity 不同');
  expectReason(issueSourceSemanticGrant({
    resolutionAuthority: projected.resolutionAuthority,
  }), 'SOURCE_SEMANTIC_GRANT_INVALID', 'source issue replay');
  expectReason(issueAtomRoundtripGrant({
    resolutionAuthority: projected.resolutionAuthority,
  }), 'ATOM_ROUNDTRIP_GRANT_INVALID', 'atom issue replay');
});

await check('C1 unknown pending 与强行 mapping 重叠时精确拒绝', async () => {
  const clean = await mintClean([click(1, '未登记动作')]);
  expectReason(project(clean), 'MAPPED_PENDING_OVERLAP', 'mapped/pending overlap');
});

await check('C2 known recipe event 未映射时精确拒绝 uncovered', async () => {
  const clean = await mintClean([click(1, '流程管理')]);
  expectReason(project(clean, []), 'CAPTURE_EVENT_UNCOVERED', 'known event uncovered');
});

await check('C3 两 mapping 跨行消费同 event 精确拒绝 multi-covered', async () => {
  const clean = await mintClean([click(1, '流程管理')]);
  expectReason(project(clean, [
    readMapping,
    { ...readMapping },
  ]), 'CAPTURE_EVENT_MULTI_COVERED', 'cross-mapping multi-covered');
});

await check('C4 mapping 吞 structural event 精确拒绝 topology coverage mismatch', async () => {
  const clean = await mintClean([
    click(1, '流程管理', '#popup'),
    { seq: 2, action: 'newpage', path: '/process/list?popup=1' },
  ]);
  expectReason(project(clean, [{
    ...readMapping,
    evidenceEventSeqs: [1, 2],
  }]), 'TOPOLOGY_COVERAGE_MISMATCH', 'structural event 被 mapping 吞并');
});

if (failures.length) {
  console.error(`RED  ${TAG}: ${failures.length}/${passed + failures.length} 检查未过`);
  process.exit(1);
}
console.log(`ok   ${TAG}: ${passed}/${passed} 检查全过`);
