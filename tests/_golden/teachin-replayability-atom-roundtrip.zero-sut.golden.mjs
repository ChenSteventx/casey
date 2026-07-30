#!/usr/bin/env node
// teachin-replayability-closure S3b：atom-roundtrip grant → 现役 compile adapter →
// exact lineage → development-only formal candidate。纯内存 doubles，零 browser/SUT/network/LLM。

import { readFileSync } from 'node:fs';
import { resolveExecutionTarget } from '../../lib/execution-target/authority.mjs';
import { validateBridge } from '../../lib/flow-bridge.mjs';

const TAG = 'teachin-replayability-atom-roundtrip';
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
let roundtripApi;
try {
  [captureApi, freshApi, runnerApi, projectionApi, roundtripApi] = await Promise.all([
    import('../../lib/teachin/raw-capture.mjs'),
    import('../../lib/teachin/fresh-runtime.mjs'),
    import('../../lib/teachin/raw-replay-runner.mjs'),
    import('../../lib/teachin/resolved-projection.mjs'),
    import('../../lib/teachin/atom-roundtrip.mjs'),
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
const { resolveCaptureProjection, issueAtomRoundtripGrant } = projectionApi;
const { runAtomRoundtrip } = roundtripApi;

for (const [name, fn] of Object.entries({
  admitRawReplayCapture,
  authorizeFreshReplayRuntime,
  createFreshReplayWitness,
  runRawReplay,
  resolveCaptureProjection,
  issueAtomRoundtripGrant,
  runAtomRoundtrip,
})) {
  assert(typeof fn === 'function', `缺 frozen API ${name}`);
}

const registry = JSON.parse(readFileSync(
  new URL('../../lib/atoms-registry.snapshot.json', import.meta.url),
  'utf8',
));
const execution = resolveExecutionTarget({
  runtime: { platform: 'linux', isWSL: false },
  logicalTarget: { startUrl: 'https://atom-roundtrip.invalid/home' },
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
    caseId: 'tc_atom_roundtrip',
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

function click(seq, selector, text = '流程管理') {
  return {
    seq,
    action: 'click',
    path: '/home',
    selector,
    text,
  };
}

function topologyDouble() {
  const pageAuthority = Object.freeze(Object.create(null));
  return {
    activePageAuthority: () => pageAuthority,
    async consumeNewPageEvent() {
      throw new Error('NO_NEWPAGE_IN_ATOM_ROUNDTRIP_FIXTURE');
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

const authoredTestCase = {
  schemaVersion: 1,
  caseId: 'tc_atom_roundtrip',
  title: '重复导航 lineage',
  preconditions: ['已登录'],
  steps: [
    {
      intentId: 'i1',
      intent: '第一次进入流程管理',
      actionHint: 'click',
      expected: [{
        kind: 'urlPathname',
        op: 'startsWith',
        value: '/ai-manager/process/list',
      }],
    },
    {
      intentId: 'i2',
      intent: '第二次进入流程管理',
      actionHint: 'click',
      expected: [{ kind: 'noPageError', op: 'absent' }],
    },
  ],
  globalAssertions: [{ kind: 'noPageError', op: 'absent' }],
  uniquePrefix: 'atl_',
};
const mappingCandidate = [
  {
    intentId: 'i1',
    atom: 'nav.workflowManagement',
    params: {},
    evidenceEventSeqs: [1],
  },
  {
    intentId: 'i2',
    atom: 'nav.workflowManagement',
    params: {},
    evidenceEventSeqs: [2],
  },
];

async function mintAtomRoundtripGrant({
  events = [click(1, '#workflow-one'), click(2, '#workflow-two')],
  mapping = mappingCandidate,
  testcase = authoredTestCase,
} = {}) {
  const admitted = admitRawReplayCapture({
    caseId: 'tc_atom_roundtrip',
    captureBytes: captureBytes(events),
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
        'perform 必须消费 resolve 铸造的 actionAuthority');
      actionAuthorities.delete(actionAuthority);
      assert(supplied === topologyAuthority,
        'perform 必须收到 canonical topologyAuthority');
      assert(executionTargetAuthority === execution.authority,
        'perform 必须收到 execution target authority');
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

  const projected = resolveCaptureProjection({
    captureAuthority: admitted.captureAuthority,
    cleanProofAuthority: replayed.cleanProofAuthority,
    mappingCandidate: mapping,
    atomRegistry: registry,
    authoredTestCase: testcase,
  });
  assert(projected?.ok === true && projected.resolutionAuthority,
    `resolved projection 必须铸 resolution authority：${JSON.stringify(projected)}`);
  const issued = issueAtomRoundtripGrant({
    resolutionAuthority: projected.resolutionAuthority,
  });
  assert(issued?.ok === true && issued.grant,
    `resolved projection 必须铸 atom-roundtrip grant：${JSON.stringify(issued)}`);
  return issued.grant;
}

function compiledEvents() {
  return [
    {
      stepId: 'atstep_1',
      intentId: 'atintent_1',
      atom: 'nav.workflowManagement',
      action: 'nav',
      url: '{{baseUrl}}/ai-manager/process/list',
    },
    {
      stepId: 'atstep_2',
      intentId: 'atintent_2',
      atom: 'nav.workflowManagement',
      action: 'nav',
      url: '{{baseUrl}}/ai-manager/process/list',
    },
  ];
}

function exactLineage() {
  return [
    { mappingKey: 'm1', sourceIntentId: 'i1', stepIds: ['atstep_1'] },
    { mappingKey: 'm2', sourceIntentId: 'i2', stepIds: ['atstep_2'] },
  ];
}

function deepFrozen(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value)
    && Object.values(value).every((child) => deepFrozen(child, seen));
}

function successAdapter(onCall = () => {}) {
  return async (input) => {
    onCall(input);
    return {
      ok: true,
      compiledEvents: compiledEvents(),
      compileLineage: exactLineage(),
    };
  };
}

function expectReason(result, reason, label) {
  assert(result?.ok === false && result.reason === reason
    && Object.keys(result).sort().join(',') === 'ok,reason',
    `${label} 应拒 ${reason}：${JSON.stringify(result)}`);
}

await check('T1 genuine grant 真调用 compile adapter，重复 atom 仍 exact lineage', async () => {
  const atomRoundtripGrant = await mintAtomRoundtripGrant();
  let compileCalls = 0;
  let observed;
  const result = await runAtomRoundtrip({
    atomRoundtripGrant,
    compileAdapter: successAdapter((input) => {
      compileCalls += 1;
      observed = input;
      assert(deepFrozen(input.candidateTestCase)
        && deepFrozen(input.candidateMapping)
        && deepFrozen(input.lineagePlan),
      'compile adapter 输入 contract/mapping/lineage 必须深冻结');
    }),
  });
  assert(result?.ok === true && compileCalls === 1,
    `compile adapter 必须恰调用一次：${JSON.stringify(result)}`);
  assert(observed?.flow?.steps?.map((step) => step.sourceIntentId).join(',')
      === 'i1,i2'
    && observed.flow.steps.every((step) => step.atom === 'nav.workflowManagement'),
  `adapter 必须收到现役 flow-bridge 形态：${JSON.stringify(observed?.flow)}`);
  assert(JSON.stringify(observed.lineagePlan) === JSON.stringify([
    { mappingKey: 'm1', sourceIntentId: 'i1' },
    { mappingKey: 'm2', sourceIntentId: 'i2' },
  ]), `lineage plan 不符：${JSON.stringify(observed.lineagePlan)}`);
  assert(JSON.stringify(result.compileLineage) === JSON.stringify(exactLineage())
    && JSON.stringify(result.eventsCandidate) === JSON.stringify(compiledEvents()),
  `formal lineage/event 不精确：${JSON.stringify(result)}`);
  assert(JSON.stringify(result.candidateTestCase?.steps?.[0]?.expected)
      === JSON.stringify(authoredTestCase.steps[0].expected)
    && JSON.stringify(result.candidateMapping) === JSON.stringify(
      mappingCandidate.map(({ evidenceEventSeqs: _evidence, ...mapping }) => mapping),
    ),
  'roundtrip 不得改 authored expected 或标准 mapping');
});

await check('T2 lineage 漏项、错 intent、重复 stepId 全部精确拒绝', async () => {
  const invalidLineages = [
    [{ mappingKey: 'm1', sourceIntentId: 'i1', stepIds: ['atstep_1'] }],
    [
      { mappingKey: 'm1', sourceIntentId: 'i2', stepIds: ['atstep_1'] },
      { mappingKey: 'm2', sourceIntentId: 'i1', stepIds: ['atstep_2'] },
    ],
    [
      { mappingKey: 'm1', sourceIntentId: 'i1', stepIds: ['atstep_1'] },
      { mappingKey: 'm2', sourceIntentId: 'i2', stepIds: ['atstep_1'] },
    ],
  ];
  for (const compileLineage of invalidLineages) {
    const atomRoundtripGrant = await mintAtomRoundtripGrant();
    let calls = 0;
    const result = await runAtomRoundtrip({
      atomRoundtripGrant,
      compileAdapter: async () => {
        calls += 1;
        return { ok: true, compiledEvents: compiledEvents(), compileLineage };
      },
    });
    expectReason(result, 'COMPILE_LINEAGE_MISMATCH', '坏 lineage');
    assert(calls === 1, '坏 lineage 不得重试 compiler');
  }
});

await check('T3 mapping/expected 深冻结，compiled identity/effect 注入整份拒绝', async () => {
  const atomRoundtripGrant = await mintAtomRoundtripGrant();
  let frozenInput = false;
  const injectedEvents = compiledEvents();
  injectedEvents[0] = {
    ...injectedEvents[0],
    identity: { platformId: 'forged' },
    effect: 'mutation',
  };
  const result = await runAtomRoundtrip({
    atomRoundtripGrant,
    compileAdapter: async (input) => {
      frozenInput = deepFrozen(input.candidateTestCase)
        && deepFrozen(input.candidateMapping);
      return {
        ok: true,
        compiledEvents: injectedEvents,
        compileLineage: exactLineage(),
      };
    },
  });
  assert(frozenInput, 'adapter 输入不得允许修改 mapping/expected');
  expectReason(result, 'CONTRACT_FIELD_MUTATION', 'identity/effect 注入');
});

await check('T4 compile 返回失败或抛错均首错停止、单次调用且不泄异常', async () => {
  for (const mode of ['returned', 'thrown']) {
    const atomRoundtripGrant = await mintAtomRoundtripGrant();
    let calls = 0;
    const result = await runAtomRoundtrip({
      atomRoundtripGrant,
      compileAdapter: async () => {
        calls += 1;
        if (mode === 'thrown') {
          throw new Error('PRIVATE_COMPILE_DETAIL https://must-not-leak.invalid');
        }
        return {
          ok: false,
          reason: 'PRIVATE_COMPILE_DETAIL',
          diagnostics: 'https://must-not-leak.invalid',
        };
      },
    });
    expectReason(result, 'COMPILE_REJECTED', `compile ${mode}`);
    assert(calls === 1, `compile ${mode} 必须首错停止，不得 retry`);
    assert(!JSON.stringify(result).includes('must-not-leak'),
      `compile ${mode} 失败不得泄异常原文`);
  }
});

await check('T5 atom-roundtrip grant clone/forge/replay 均拒，非法 grant 零 compile', async () => {
  const cloneSource = await mintAtomRoundtripGrant();
  let invalidCalls = 0;
  for (const atomRoundtripGrant of [
    Object.freeze({}),
    { roundtrip: true },
    structuredClone(cloneSource),
  ]) {
    expectReason(await runAtomRoundtrip({
      atomRoundtripGrant,
      compileAdapter: successAdapter(() => { invalidCalls += 1; }),
    }), 'ATOM_ROUNDTRIP_GRANT_INVALID', '伪造 atom-roundtrip grant');
  }
  assert(invalidCalls === 0, '伪造 grant 不得调用 compile adapter');

  const genuine = await mintAtomRoundtripGrant();
  let genuineCalls = 0;
  const first = await runAtomRoundtrip({
    atomRoundtripGrant: genuine,
    compileAdapter: successAdapter(() => { genuineCalls += 1; }),
  });
  assert(first?.ok === true && genuineCalls === 1,
    `genuine grant 应恰消费一次：${JSON.stringify(first)}`);
  expectReason(await runAtomRoundtrip({
    atomRoundtripGrant: genuine,
    compileAdapter: successAdapter(() => { genuineCalls += 1; }),
  }), 'ATOM_ROUNDTRIP_GRANT_INVALID', 'atom-roundtrip grant replay');
  assert(genuineCalls === 1, 'grant replay 不得再次调用 compile adapter');
});

await check('T5b top-level exact input 在消费 genuine grant 前闭合拒绝', async () => {
  const invalidInputs = [
    (grant) => ({ atomRoundtripGrant: grant }),
    (grant) => ({ atomRoundtripGrant: grant, compileAdapter: null }),
    (grant, adapter) => ({
      atomRoundtripGrant: grant, compileAdapter: adapter, resolutionAuthority: {},
    }),
    (grant, adapter) => ({
      atomRoundtripGrant: grant, compileAdapter: adapter, unknown: true,
    }),
  ];
  for (const buildInput of invalidInputs) {
    const grant = await mintAtomRoundtripGrant();
    let calls = 0;
    const adapter = successAdapter(() => { calls += 1; });
    expectReason(await runAtomRoundtrip(buildInput(grant, adapter)),
      'ATOM_ROUNDTRIP_INPUT_INVALID', 'roundtrip top-level input');
    assert(calls === 0, 'top-level 非闭合输入不得调用 compiler');
    const genuine = await runAtomRoundtrip({
      atomRoundtripGrant: grant,
      compileAdapter: adapter,
    });
    assert(genuine?.ok === true && calls === 1,
      'top-level 失败探针不得消费 genuine grant');
  }
});

await check('T6 compile stub 成功只产 development candidate，不冒充 formal PASS', async () => {
  const result = await runAtomRoundtrip({
    atomRoundtripGrant: await mintAtomRoundtripGrant(),
    compileAdapter: successAdapter(),
  });
  const publicText = JSON.stringify(result);
  assert(result?.ok === true
    && result.developmentOnly === true
    && result.promotionReady === false,
  `stub compile 成功仍须显式降权：${publicText}`);
  assert(!/PASS|verdict|signed["']?\s*:\s*true|replayReady["']?\s*:\s*true/.test(publicText),
    `development candidate 不得冒充正式结论/签署资产：${publicText}`);
});

await check('T7 直连 flow-bridge 且只依赖注入 adapter，不复制 bridge/compiler', () => {
  const source = readFileSync(
    new URL('../../lib/teachin/atom-roundtrip.mjs', import.meta.url),
    'utf8',
  );
  assert(source.includes('compileAdapter'),
    'roundtrip 必须保留现役 compiler 的注入接缝');
  assert(!/compile-atoms|COMPILE_ATOM_COMPILERS|compileNav|compileAgent/.test(source),
    'roundtrip 不得内置、导入或复制 atom compiler');
  const bridgeImport = source.match(
    /import\s*\{([^}]*)\}\s*from\s*['"]\.\.\/flow-bridge\.mjs['"]/,
  );
  assert(bridgeImport
    && bridgeImport[1].includes('validateBridge')
    && bridgeImport[1].includes('buildFlow'),
  'roundtrip 必须直接 import 现役 validateBridge/buildFlow');
  assert(!/function\s+(?:validateBridge|buildFlow)\s*\(|(?:const|let|var)\s+(?:validateBridge|buildFlow)\s*=/.test(source),
    'roundtrip 不得本地复制或覆盖 flow-bridge');
});

await check('T8 现役 flow-bridge 真实反例首错拒绝，compile adapter 零调用', async () => {
  const testcase = {
    schemaVersion: 1,
    caseId: 'tc_atom_roundtrip',
    title: '缺登录前置的流程导航反例',
    preconditions: [],
    steps: [{ intentId: 'i1', intent: '进入流程管理' }],
    uniquePrefix: 'atl_',
  };
  const mapping = [{
    intentId: 'i1',
    atom: 'nav.workflowManagement',
    params: {},
    evidenceEventSeqs: [1],
  }];
  const bridgeMapping = mapping.map(
    ({ evidenceEventSeqs: _evidence, ...entry }) => entry,
  );
  const probe = validateBridge(testcase, bridgeMapping, { registry });
  assert(probe?.ok === false
    && probe.problems?.some((item) => item.includes('已登录')),
  `反例必须被现役 bridge/state policy 真实拒绝：${JSON.stringify(probe)}`);

  const atomRoundtripGrant = await mintAtomRoundtripGrant({
    events: [click(1, '#workflow')],
    mapping,
    testcase,
  });
  let compileCalls = 0;
  const result = await runAtomRoundtrip({
    atomRoundtripGrant,
    compileAdapter: successAdapter(() => { compileCalls += 1; }),
  });
  expectReason(result, 'BRIDGE_REJECTED', '现役 flow-bridge 反例');
  assert(compileCalls === 0, 'bridge 首错拒绝后不得调用 compile adapter');
});

if (failures.length) {
  console.error(`RED  ${TAG}: ${failures.length}/${passed + failures.length} 检查未过`);
  process.exit(1);
}
console.log(`ok   ${TAG}: ${passed}/${passed} 检查全过`);
