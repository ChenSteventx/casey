#!/usr/bin/env node
// teachin-replayability-closure S3：逐 event resolved atom projection、coverage 三分与 flow-bridge 接缝。
// 纯内存 runtime/driver doubles，零 browser/SUT/network；实现前允许因 frozen API 缺失真实 RED，
// 但本文件主体必须在模块落地后逐条验证语义，绝不以 existsSync 代替行为验收。

import { readFileSync } from 'node:fs';
import { resolveExecutionTarget } from '../../lib/execution-target/authority.mjs';
import { validateBridge } from '../../lib/flow-bridge.mjs';

const TAG = 'teachin-replayability-resolved-projection';
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
let projectionApi;
try {
  [captureApi, freshApi, runnerApi, projectionApi] = await Promise.all([
    import('../../lib/teachin/raw-capture.mjs'),
    import('../../lib/teachin/fresh-runtime.mjs'),
    import('../../lib/teachin/raw-replay-runner.mjs'),
    import('../../lib/teachin/resolved-projection.mjs'),
  ]);
} catch {
  console.error(`RED  ${TAG}: frozen API import failed（实现模块尚未落地）`);
  process.exit(1);
}

const { admitRawReplayCapture } = captureApi;
const {
  authorizeFreshReplayRuntime,
  createFreshReplayWitness,
} = freshApi;
const { runRawReplay } = runnerApi;
const { resolveCaptureProjection: resolveCaptureProjectionApi } = projectionApi;
let projectionCalls = 0;
function resolveCaptureProjection(options) {
  projectionCalls += 1;
  return resolveCaptureProjectionApi(options);
}

for (const [name, fn] of Object.entries({
  admitRawReplayCapture,
  authorizeFreshReplayRuntime,
  createFreshReplayWitness,
  runRawReplay,
  resolveCaptureProjection: resolveCaptureProjectionApi,
})) {
  assert(typeof fn === 'function', `缺 frozen API ${name}`);
}

const registry = JSON.parse(readFileSync(
  new URL('../../lib/atoms-registry.snapshot.json', import.meta.url),
  'utf8',
));
const execution = resolveExecutionTarget({
  runtime: { platform: 'linux', isWSL: false },
  logicalTarget: { startUrl: 'https://resolved-projection.invalid/home' },
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
    caseId: 'tc_resolved_projection',
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

function click(seq, options = {}) {
  return {
    seq,
    action: 'click',
    path: options.path || '/home',
    selector: options.selector || `#event-${seq}`,
    ...(options.text === undefined ? {} : { text: options.text }),
    ...(options.x === undefined ? {} : { x: options.x }),
    ...(options.y === undefined ? {} : { y: options.y }),
    ...(options.valueMasked === undefined ? {} : {
      value: '<redacted>',
      valueMasked: options.valueMasked,
    }),
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

async function cleanAuthorities(events) {
  const bytes = captureBytes(events);
  const admitted = admitRawReplayCapture({
    caseId: 'tc_resolved_projection',
    captureBytes: bytes,
  });
  assert(admitted?.ok === true && admitted.captureAuthority,
    `capture 准入失败：${JSON.stringify(admitted)}`);

  const topology = topologyDouble();
  const actionAuthorities = new WeakMap();
  let pathIndex = 0;
  const driver = {
    async readActivePath() {
      return events[pathIndex++]?.path;
    },
    async resolve({ event, topologyAuthority, executionTargetAuthority }) {
      assert(topologyAuthority === topology,
        'resolve 必须收到 canonical topologyAuthority');
      assert(executionTargetAuthority === execution.authority,
        'resolve 必须收到 execution target authority');
      const actionAuthority = Object.freeze(Object.create(null));
      actionAuthorities.set(actionAuthority, event);
      return {
        resolution: 'unique',
        candidateCount: 1,
        actionAuthority,
      };
    },
    async perform({
      actionAuthority,
      topologyAuthority,
      executionTargetAuthority,
    }) {
      const event = actionAuthorities.get(actionAuthority);
      assert(event, 'perform 必须消费 resolve 铸造的 opaque actionAuthority');
      actionAuthorities.delete(actionAuthority);
      assert(topologyAuthority === topology,
        'perform 必须收到 canonical topologyAuthority');
      assert(executionTargetAuthority === execution.authority,
        'perform 必须收到 execution target authority');
      if (event.fallbackCss === '#popup') topology.promote();
      return {
        ok: true,
        identityReadback: { ok: true },
      };
    },
    async goto() {
      throw new Error('RAW_NAV_MUST_NOT_GOTO');
    },
  };
  const replayed = await runRawReplay({
    captureAuthority: admitted.captureAuthority,
    freshRuntimeAuthority: mintFreshRuntime(topology),
    executionTargetAuthority: execution.authority,
    topologyAuthority: topology,
    actionDriver: driver,
  });
  assert(replayed?.ok === true
    && replayed.status === 'CLEAN'
    && replayed.cleanProofAuthority,
  `raw 正控必须 CLEAN：${JSON.stringify(replayed)}`);
  return {
    captureAuthority: admitted.captureAuthority,
    cleanProofAuthority: replayed.cleanProofAuthority,
  };
}

async function resolve(
  events,
  mappingCandidate,
  authoredTestCase,
  atomRegistry = registry,
) {
  const authorities = await cleanAuthorities(events);
  const result = resolveCaptureProjection({
    ...authorities,
    mappingCandidate,
    atomRegistry,
    ...(authoredTestCase === undefined ? {} : { authoredTestCase }),
  });
  if (result?.ok === true && authoredTestCase && result.candidateMapping.length > 0) {
    const bridge = validateBridge(
      result.candidateTestCase,
      result.candidateMapping,
      { registry: atomRegistry },
    );
    assert(bridge?.ok === true,
      `正控 candidate 必须真过现役 flow-bridge：${JSON.stringify(bridge)}`);
  }
  return result;
}

function seqs(value) {
  return [...(Array.isArray(value) ? value : [])].sort((a, b) => a - b);
}

function expectReason(result, reason) {
  assert(result?.ok === false && result.reason === reason,
    `应拒 ${reason}，实际 ${JSON.stringify(result)}`);
}

function authoredCase(intentIds, title = '只读流程导航') {
  return {
    schemaVersion: 1,
    caseId: 'tc_resolved_projection',
    title,
    preconditions: ['已登录'],
    steps: intentIds.map((intentId) => ({
      intentId,
      intent: `${title}-${intentId}`,
    })),
    uniquePrefix: 'atl_',
  };
}

const readMapping = {
  intentId: 'i1',
  atom: 'nav.workflowManagement',
  params: {},
  evidenceEventSeqs: [1],
};

await check('P1 单 event known atom：compound key、evidence 与标准 mapping 精确投影', async () => {
  const result = await resolve([
    click(1, { text: '流程管理' }),
  ], [readMapping], authoredCase(['i1']));
  assert(result?.ok === true, `known atom 应 resolved：${JSON.stringify(result)}`);
  assert(result.projection?.length === 1
    && result.projection[0].compoundKey === '1:click'
    && result.projection[0].intentId === 'i1'
    && result.projection[0].eventSeq === 1,
  `逐 event compound key 不符：${JSON.stringify(result.projection)}`);
  assert(result.resolved?.length === 1
    && JSON.stringify(result.resolved[0].evidenceEventSeqs) === '[1]'
    && JSON.stringify(result.resolved[0].evidenceCompoundKeys) === '["1:click"]',
  `resolved evidence 不符：${JSON.stringify(result.resolved)}`);
  assert(result.candidateMapping?.length === 1
    && Object.keys(result.candidateMapping[0]).sort().join(',')
      === 'atom,intentId,params',
  `flow-bridge mapping 必须剥 lineage 字段：${JSON.stringify(result.candidateMapping)}`);
  const step = result.candidateTestCase?.steps?.find((item) => item.intentId === 'i1');
  assert(step && !Object.hasOwn(step, 'route') && !Object.hasOwn(step, 'reason'),
    `mapped step 必须删除 route/reason：${JSON.stringify(step)}`);
  assert(JSON.stringify(seqs(result.coverage?.mappedEventSeqs)) === '[1]'
    && result.coverage?.pendingEventSeqs?.length === 0
    && result.coverage?.structuralEventSeqs?.length === 0,
  `coverage 不符：${JSON.stringify(result.coverage)}`);
});

await check('P2 compound atom：evidenceEventSeqs 多 event 有序、唯一且每 event 恰覆盖一次', async () => {
  const compoundRegistry = structuredClone(registry);
  compoundRegistry.atoms['nav.workflowManagement'].teachinRecipes = [{
    ruleId: 'fixture-read-compound-workflow-nav',
    match: { actions: ['fill', 'click'] },
    emit: { atom: 'nav.workflowManagement', params: {} },
  }];
  const result = await resolve([
    {
      seq: 1,
      action: 'fill',
      path: '/home',
      selector: '#workflow-filter',
      fieldLabel: '流程筛选',
      value: '已发布',
    },
    click(2, { text: '流程管理' }),
  ], [{
    intentId: 'i1',
    atom: 'nav.workflowManagement',
    params: {},
    evidenceEventSeqs: [1, 2],
  }], authoredCase(['i1'], '复合只读流程导航'), compoundRegistry);
  assert(result?.ok === true, `compound mapping 应成功：${JSON.stringify(result)}`);
  assert(JSON.stringify(result.resolved?.[0]?.evidenceEventSeqs) === '[1,2]',
    `compound evidence 顺序不符：${JSON.stringify(result.resolved)}`);
  assert(JSON.stringify(seqs(result.coverage?.mappedEventSeqs)) === '[1,2]'
    && new Set(result.coverage.mappedEventSeqs).size === 2,
  `compound coverage 应恰覆盖两 event：${JSON.stringify(result.coverage)}`);
});

await check('P3 mapped/pending/structural 三分完整且两两不交', async () => {
  const result = await resolve([
    click(1, { text: '流程管理' }),
    click(2, { text: '未登记动作' }),
  ], [readMapping], authoredCase(['i1', 'i2']));
  assert(result?.ok === true, `部分 resolved 应产候选：${JSON.stringify(result)}`);
  const mapped = new Set(result.coverage?.mappedEventSeqs);
  const pending = new Set(result.coverage?.pendingEventSeqs);
  const structural = new Set(result.coverage?.structuralEventSeqs);
  assert([...mapped].every((seq) => !pending.has(seq) && !structural.has(seq))
    && [...pending].every((seq) => !structural.has(seq)),
  `三分 coverage 有交集：${JSON.stringify(result.coverage)}`);
  assert(JSON.stringify([...mapped, ...pending, ...structural].sort()) === '[1,2]',
    `三分 coverage 未覆盖全集：${JSON.stringify(result.coverage)}`);
  const p = result.pending?.find((item) => item.eventSeq === 2);
  assert(p?.compoundKey === '2:click' && p.reason === 'KNOWN_RECIPE_MISSING',
    `unknown event 应精确 pending：${JSON.stringify(result.pending)}`);
  const step = result.candidateTestCase?.steps?.find((item) => item.intentId === 'i2');
  assert(step?.route === 'human' && typeof step.reason === 'string' && step.reason,
    `pending step 必须 route:human 留痕：${JSON.stringify(step)}`);
});

await check('P4 unsupported-but-admitted 保持 pending；selectorless coordinate/masked fill 在 capture 边界拒绝', async () => {
  const unsupported = await resolve([{
    seq: 1,
    action: 'press',
    path: '/home',
    selector: '#search',
    key: 'Escape',
  }], [], authoredCase(['i1'], '不支持动作留人'));
  assert(unsupported?.ok === true
    && unsupported.resolved?.length === 0
    && unsupported.candidateMapping?.length === 0,
  `unsupported admitted event 不得 resolved：${JSON.stringify(unsupported)}`);
  assert(unsupported.pending?.length === 1
    && unsupported.pending[0].eventSeq === 1
    && unsupported.pending[0].compoundKey === '1:press'
    && unsupported.pending[0].reason === 'UNSUPPORTED_ACTION',
  `unsupported admitted event 应具名 pending：${JSON.stringify(unsupported.pending)}`);

  const callsBeforeAdmissionRejects = projectionCalls;
  const selectorless = admitRawReplayCapture({
    caseId: 'tc_resolved_projection',
    captureBytes: captureBytes([{
      seq: 1,
      action: 'click',
      path: '/home',
      x: 80,
      y: 40,
    }]),
  });
  expectReason(selectorless, 'SELECTOR_UNAVAILABLE');
  const maskedFill = admitRawReplayCapture({
    caseId: 'tc_resolved_projection',
    captureBytes: captureBytes([{
      seq: 1,
      action: 'fill',
      path: '/home',
      selector: '#password',
      fieldLabel: '密码',
      value: '<redacted>',
      valueMasked: true,
    }]),
  });
  expectReason(maskedFill, 'MASKED_FILL_UNREPLAYABLE');
  assert(projectionCalls === callsBeforeAdmissionRejects,
    'capture admission 拒绝后不得调用 projection 洗白为 pending');
});

await check('P5 click→newpage 同 intent 仍保留两个 compound key，newpage 不建 step/pending', async () => {
  const result = await resolve([
    click(1, { selector: '#popup', text: '流程管理' }),
    { seq: 2, action: 'newpage', path: '/process/list?view=all' },
  ], [readMapping], authoredCase(['i1'], '流程管理 popup'));
  assert(result?.ok === true, `topology projection 应成功：${JSON.stringify(result)}`);
  const clickProjection = result.projection?.find((item) => item.eventSeq === 1);
  const newPageProjection = result.projection?.find((item) => item.eventSeq === 2);
  assert(clickProjection?.compoundKey === '1:click'
    && newPageProjection?.compoundKey === '2:newpage'
    && clickProjection.intentId === newPageProjection.intentId,
  `共享 intent 的逐 event key 不符：${JSON.stringify(result.projection)}`);
  assert(newPageProjection.role === 'structural'
    && newPageProjection.triggerCompoundKey === '1:click',
  `newpage trigger lineage 不符：${JSON.stringify(newPageProjection)}`);
  assert(JSON.stringify(result.coverage?.mappedEventSeqs) === '[1]'
    && JSON.stringify(result.coverage?.structuralEventSeqs) === '[2]'
    && result.coverage?.pendingEventSeqs?.length === 0,
  `newpage 不得被 intent 映射洗掉：${JSON.stringify(result.coverage)}`);
  assert(result.candidateTestCase?.steps?.length === 1
    && result.pending?.length === 0,
  'newpage 不得建独立业务 step 或 pending');
});

await check('P6 mapping 形态、越界、重复 evidence 与重复消费均具名拒绝', async () => {
  const cases = [
    [[{ ...readMapping, evidenceEventSeqs: '1' }], 'MAPPING_INVALID'],
    [[{ ...readMapping, evidenceEventSeqs: [2] }], 'MAPPING_EVENT_OUT_OF_RANGE'],
    [[{ ...readMapping, evidenceEventSeqs: [1, 1] }], 'MAPPING_EVENT_DUPLICATE'],
    [[readMapping, {
      intentId: 'i1',
      atom: 'nav.workflowManagement',
      params: {},
      evidenceEventSeqs: [1],
    }], 'CAPTURE_EVENT_MULTI_COVERED'],
  ];
  for (const [mapping, reason] of cases) {
    expectReason(await resolve([
      click(1, { text: '流程管理' }),
    ], mapping), reason);
  }
});

await check('P7 action/atom/identity/effect 不兼容全部拒绝，mapping 无权改权威事实', async () => {
  const fillEvent = {
    seq: 1,
    action: 'fill',
    path: '/home',
    selector: '#field',
    fieldLabel: '名称',
    value: '示例',
  };
  expectReason(await resolve([fillEvent], [readMapping]), 'MAPPING_ACTION_MISMATCH');
  expectReason(await resolve([
    click(1, { text: '未知原子' }),
  ], [{
    ...readMapping,
    atom: 'nonsense.atom',
  }]), 'MAPPING_ATOM_UNKNOWN');
  expectReason(await resolve([
    click(1, { text: '流程管理' }),
  ], [{
    ...readMapping,
    identity: { requiredRoles: ['subject'] },
  }]), 'MAPPING_IDENTITY_MISMATCH');
  expectReason(await resolve([
    click(1, { text: '流程管理' }),
  ], [{
    ...readMapping,
    effect: 'mutation',
  }]), 'MAPPING_EFFECT_MISMATCH');
});

await check('P8 known mapped + unsupported admitted pending 共存时 coverage 交集恒空', async () => {
  const result = await resolve([
    click(1, { text: '流程管理' }),
    {
      seq: 2,
      action: 'press',
      path: '/home',
      selector: '#search',
      key: 'Escape',
    },
  ], [readMapping], authoredCase(['i1', 'i2']));
  assert(result?.ok === true
    && result.pending?.[0]?.reason === 'UNSUPPORTED_ACTION',
  `unsupported admitted event 必须保持 pending：${JSON.stringify(result)}`);
  assert(JSON.stringify(result.coverage?.mappedEventSeqs) === '[1]'
    && JSON.stringify(result.coverage?.pendingEventSeqs) === '[2]'
    && result.coverage?.structuralEventSeqs?.length === 0,
  `mapped∩pending 必须为空：${JSON.stringify(result.coverage)}`);
});

await check('P9 candidate mapping 真接现役 flow-bridge，不携 distill 私有字段', async () => {
  const bridgeMapping = {
    intentId: 'i1',
    atom: 'nav.workflowManagement',
    params: {},
    evidenceEventSeqs: [1],
  };
  const authoredTestCase = {
    schemaVersion: 1,
    caseId: 'tc_resolved_projection',
    title: '进入流程管理',
    preconditions: ['已登录'],
    steps: [{
      intentId: 'i1',
      intent: '进入流程管理',
      actionHint: 'click',
      expected: [{
        kind: 'urlPathname',
        op: 'startsWith',
        value: '/ai-manager/process/list',
      }],
    }],
    globalAssertions: [{ kind: 'noPageError', op: 'absent' }],
    uniquePrefix: 'atl_',
  };
  const result = await resolve([
    click(1, { text: '流程管理' }),
  ], [bridgeMapping], authoredTestCase);
  assert(result?.ok === true, `正控应 resolved：${JSON.stringify(result)}`);
  const candidateStep = result.candidateTestCase?.steps?.find(
    (item) => item.intentId === 'i1',
  );
  assert(JSON.stringify(result.candidateTestCase?.preconditions)
      === JSON.stringify(authoredTestCase.preconditions)
    && JSON.stringify(candidateStep?.expected)
      === JSON.stringify(authoredTestCase.steps[0].expected)
    && JSON.stringify(result.candidateTestCase?.globalAssertions)
      === JSON.stringify(authoredTestCase.globalAssertions)
    && result.candidateTestCase?.uniquePrefix === authoredTestCase.uniquePrefix,
  `projection 必须原样复制 authored bridge contract：${JSON.stringify(result.candidateTestCase)}`);
  const bridge = validateBridge(
    result.candidateTestCase,
    result.candidateMapping,
    { registry },
  );
  assert(bridge?.ok === true,
    `resolved candidate 必须真过现役 flow-bridge：${JSON.stringify(bridge)}`);
  assert(!JSON.stringify(result.candidateMapping).includes('evidenceEventSeqs')
    && !JSON.stringify(result.candidateMapping).includes('compoundKey')
    && !JSON.stringify(result.candidateMapping).includes('"effect"')
    && !JSON.stringify(result.candidateMapping).includes('"identity"'),
  `flow-bridge mapping 泄 distill/authority 私有字段：${JSON.stringify(result.candidateMapping)}`);
});

if (failures.length) {
  console.error(`RED  ${TAG}: ${failures.length}/${passed + failures.length} 检查未过`);
  process.exit(1);
}
console.log(`ok   ${TAG}: ${passed}/${passed} 检查全过`);
