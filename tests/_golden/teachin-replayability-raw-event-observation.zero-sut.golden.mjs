#!/usr/bin/env node
// Source same-run event observation authority. Pure memory doubles:
// zero SUT/browser/network/LLM and no caller-supplied observation facts.

import { resolveExecutionTarget } from '../../lib/execution-target/authority.mjs';

const TAG = 'teachin-replayability-raw-event-observation';
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

let observationApi;
let captureApi;
let freshApi;
let runnerApi;
try {
  [observationApi, captureApi, freshApi, runnerApi] = await Promise.all([
    import('../../lib/teachin/raw-event-observation.mjs'),
    import('../../lib/teachin/raw-capture.mjs'),
    import('../../lib/teachin/fresh-runtime.mjs'),
    import('../../lib/teachin/raw-replay-runner.mjs'),
  ]);
} catch (error) {
  failures.push(`production API unavailable: ${String(
    error?.code || error?.message || error,
  ).slice(-500)}`);
}

const REQUIRED = [
  'createRawEventObservationSession',
  'beginRawEvent',
  'finishRawEvent',
  'sealRawEventObservations',
  'inspectRawEventObservationAuthority',
];

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
}

function expectReason(result, reason, label) {
  assert(exactKeys(result, ['ok', 'reason'])
    && result.ok === false && result.reason === reason,
  `${label} 应 exact ${reason}：${JSON.stringify(result)}`);
}

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

const target = resolveExecutionTarget({
  runtime: { platform: 'linux', isWSL: false },
  logicalTarget: { startUrl: 'https://raw-observation.synthetic.invalid/home' },
  transport: { mode: 'direct' },
  requiresOriginContinuity: true,
});
assert(target?.ok === true && target.authority,
  'zero-SUT synthetic execution target 应成功');

function captureBytes(caseId = 'tc_raw_observation') {
  return Buffer.from(`${JSON.stringify({
    schemaVersion: 1,
    artifactKind: 'teach-in-capture',
    caseId,
    createdAt: '2026-07-27T00:00:00.000Z',
    startPath: '/home',
    source: {
      kind: 'manual',
      signed: false,
      replayReady: false,
      distillRequired: true,
    },
    events: [
      { seq: 1, action: 'click', path: '/home', selector: '#one' },
      { seq: 2, action: 'click', path: '/home', selector: '#two' },
    ],
  }, null, 2)}\n`);
}

function expectedBytes(marker = 'ORIGINAL_EXPECTED_MARKER') {
  return Buffer.from(`${JSON.stringify({
    caseId: 'tc_raw_observation',
    channel: 'web',
    intents: [{
      intentId: 'authored_i1',
      expected: [{
        kind: 'textVisible',
        op: 'appears',
        value: marker,
        soft: false,
        signedAt: '2026-07-27T00:00:00.000Z',
        signedAgainstBuild: 'synthetic-build',
        signerId: 'qa.synthetic',
      }],
    }],
    globalAssertions: [{
      kind: 'noPageError',
      op: 'absent',
      soft: false,
      signedAt: '2026-07-27T00:00:00.000Z',
      signedAgainstBuild: 'synthetic-build',
      signerId: 'qa.synthetic',
    }],
  })}\n`);
}

function topologyDouble() {
  const pageAuthority = Object.freeze(Object.create(null));
  return {
    activePageAuthority: () => pageAuthority,
    async consumeNewPageEvent() {
      throw new Error('NO_NEWPAGE_IN_RAW_OBSERVATION_FIXTURE');
    },
  };
}

function mintFresh(topologyAuthority) {
  let recordingConnected = true;
  const recordingBrowser = emitter({ isConnected: () => recordingConnected });
  const recordingContext = emitter({ browser: () => recordingBrowser });
  const witnessed = freshApi.createFreshReplayWitness({
    recordingBrowser,
    recordingContext,
  });
  assert(witnessed?.ok === true && witnessed.witness,
    `fresh witness 失败：${JSON.stringify(witnessed)}`);
  recordingContext.emit('close');
  recordingConnected = false;
  recordingBrowser.emit('disconnected');

  const replayBrowser = emitter({ isConnected: () => true });
  const replayContext = emitter({ browser: () => replayBrowser });
  const replayPage = emitter({
    context: () => replayContext,
    isClosed: () => false,
  });
  const fresh = freshApi.authorizeFreshReplayRuntime({
    witness: witnessed.witness,
    replayBrowser,
    replayContext,
    replayPage,
    topologyAuthority,
  });
  assert(fresh?.ok === true && fresh.freshRuntimeAuthority,
    `fresh authority 失败：${JSON.stringify(fresh)}`);
  return fresh.freshRuntimeAuthority;
}

function admitCapture() {
  const bytes = captureBytes();
  const admitted = captureApi.admitRawReplayCapture({
    caseId: 'tc_raw_observation',
    captureBytes: bytes,
  });
  assert(admitted?.ok === true && admitted.captureAuthority,
    `capture admission 失败：${JSON.stringify(admitted)}`);
  return {
    captureAuthority: admitted.captureAuthority,
    topologyAuthority: topologyDouble(),
  };
}

async function runAdmitted(fixture, {
  eventObserver,
  order = [],
  failSeq = null,
} = {}) {
  const actionAuthorities = new WeakMap();
  const replayed = await runnerApi.runRawReplay({
    captureAuthority: fixture.captureAuthority,
    freshRuntimeAuthority: mintFresh(fixture.topologyAuthority),
    executionTargetAuthority: target.authority,
    topologyAuthority: fixture.topologyAuthority,
    ...(eventObserver ? { eventObserver } : {}),
    actionDriver: {
      async readActivePath() { return '/home'; },
      async resolve({ event }) {
        const authority = Object.freeze(Object.create(null));
        actionAuthorities.set(authority, event.seq);
        return {
          resolution: 'unique',
          candidateCount: 1,
          actionAuthority: authority,
        };
      },
      async perform({ actionAuthority }) {
        assert(actionAuthorities.has(actionAuthority),
          'perform 必须消费 resolve authority');
        const seq = actionAuthorities.get(actionAuthority);
        actionAuthorities.delete(actionAuthority);
        order.push(`action:${seq}`);
        if (seq === failSeq) {
          return {
            ok: false,
            reason: 'ACTION_FAILED',
            identityReadback: { ok: false },
          };
        }
        return { ok: true, identityReadback: { ok: true } };
      },
      async goto() { throw new Error('RAW_NAV_MUST_NOT_GOTO'); },
    },
  });
  return replayed;
}

async function admittedFixture() {
  const fixture = admitCapture();
  const replayed = await runAdmitted(fixture);
  assert(replayed?.ok === true
    && replayed.status === 'CLEAN'
    && replayed.cleanProofAuthority,
  `raw fixture 必须 CLEAN：${JSON.stringify(replayed)}`);
  return {
    captureAuthority: fixture.captureAuthority,
    cleanProofAuthority: replayed.cleanProofAuthority,
    topologyAuthority: fixture.topologyAuthority,
  };
}

function collectorDouble({
  throwPhase = null,
  malformedPhase = null,
  order = [],
} = {}) {
  const calls = [];
  const collector = {
    async captureBaseline(input) {
      calls.push({ phase: 'before', input });
      order.push(`begin:${input.seq}`);
      if (throwPhase === 'before') throw new Error('PRIVATE_OBSERVATION_MARKER');
      if (malformedPhase === 'before') return undefined;
      return {
        count: 2,
        replyBaseline: { n: 0, text: null },
      };
    },
    async captureTerminal(input) {
      calls.push({ phase: 'after', input });
      order.push(`finish:${input.seq}`);
      if (throwPhase === 'after') throw new Error('PRIVATE_OBSERVATION_MARKER');
      if (malformedPhase === 'after') return undefined;
      return {
        path: `/after-${input.seq}`,
        count: 2 + input.seq,
        toasts: [],
        textHits: Object.fromEntries(
          input.assertionUniverse
            .filter((row) => typeof row.value === 'string')
            .map((row) => [row.value, 1]),
        ),
        buttonHits: {},
        buttonSeen: 0,
        buttonDisabledHits: {},
        inputReadback: null,
        reply: undefined,
      };
    },
  };
  return { collector, calls };
}

async function openSession({
  fixture,
  collector = collectorDouble(),
  expected = expectedBytes(),
  state = { currentStepId: null },
} = {}) {
  const runExecutionAuthority = Object.freeze(Object.create(null));
  const forensics = Object.freeze({
    records: () => [],
    inFlightCount: () => 0,
  });
  const pageErrors = [];
  const opened = observationApi.createRawEventObservationSession({
    captureAuthority: fixture.captureAuthority,
    runExecutionAuthority,
    expectedBytes: expected,
    executionTargetAuthority: target.authority,
    collector: collector.collector,
    state,
    forensics,
    pageErrors,
  });
  assert(opened?.ok === true && opened.sessionAuthority,
    `observation session 创建失败：${JSON.stringify(opened)}`);
  return {
    ...opened,
    collector,
    expected,
    forensics,
    pageErrors,
    runExecutionAuthority,
    state,
  };
}

if (observationApi && captureApi && freshApi && runnerApi
  && REQUIRED.every((name) => typeof observationApi[name] === 'function')) {
  await check('E1 exact API 禁止 caller observations/mapping/axes facts', async () => {
    const fixture = await admittedFixture();
    const built = collectorDouble();
    for (const poison of [
      { observations: [] },
      { mapping: [] },
      { axesBytes: Buffer.from('{}') },
      { verdict: 'PASS' },
    ]) {
      const result = observationApi.createRawEventObservationSession({
        captureAuthority: fixture.captureAuthority,
        runExecutionAuthority: Object.freeze(Object.create(null)),
        expectedBytes: expectedBytes(),
        executionTargetAuthority: target.authority,
        collector: built.collector,
        state: { currentStepId: null },
        forensics: { records: () => [] },
        pageErrors: [],
        ...poison,
      });
      expectReason(result, 'RAW_OBSERVATION_INPUT_INVALID', 'caller truth');
    }
    assert(built.calls.length === 0, '非法 create 输入不得调用 collector');
  });

  await check('E2 observer 在同一次 raw run 内 begin→action→finish，CLEAN 后才 seal', async () => {
    const fixture = admitCapture();
    const order = [];
    const collector = collectorDouble({ order });
    const session = await openSession({ fixture, collector });
    const eventObserver = {
      begin: ({ seq, topologyAuthority }) =>
        observationApi.beginRawEvent({
          sessionAuthority: session.sessionAuthority,
          seq,
          topologyAuthority,
        }),
      finish: ({ seq, actionAxis, topologyAuthority }) =>
        observationApi.finishRawEvent({
          sessionAuthority: session.sessionAuthority,
          seq,
          actionAxis,
          topologyAuthority,
        }),
    };
    const replayed = await runAdmitted(fixture, { eventObserver, order });
    assert(replayed?.ok === true
      && replayed.status === 'CLEAN'
      && replayed.cleanProofAuthority,
    `same-run raw 必须 CLEAN：${JSON.stringify(replayed)}`);
    assert(order.join(',')
      === 'begin:1,action:1,finish:1,begin:2,action:2,finish:2',
    `same-run 顺序错：${order.join(',')}`);
    assert(session.collector.calls.every((row) =>
      row.input.stepId === `rawstep_${row.input.seq}`
      && row.input.state === session.state
      && row.input.forensics === session.forensics
      && row.input.pageErrors === session.pageErrors),
    'collector 必须保持 synthetic step 与 exact session dependencies');
    assert(session.state.currentStepId === null,
      'terminal observation 完成后才清 attribution');
    const sealed = observationApi.sealRawEventObservations({
      sessionAuthority: session.sessionAuthority,
      cleanProofAuthority: replayed.cleanProofAuthority,
    });
    assert(sealed?.ok === true && sealed.rawObservationAuthority,
      `同次 CLEAN 后应 seal：${JSON.stringify(sealed)}`);
  });

  await check('E2b 首错 event 仍 finish 失败轴，后续 seq 不得 begin/action/finish', async () => {
    const fixture = admitCapture();
    const order = [];
    const collector = collectorDouble({ order });
    const session = await openSession({ fixture, collector });
    const eventObserver = {
      begin: (input) => observationApi.beginRawEvent({
        sessionAuthority: session.sessionAuthority,
        ...input,
      }),
      finish: (input) => observationApi.finishRawEvent({
        sessionAuthority: session.sessionAuthority,
        ...input,
      }),
    };
    const replayed = await runAdmitted(fixture, {
      eventObserver,
      order,
      failSeq: 1,
    });
    assert(replayed?.ok === false && replayed.reason === 'ACTION_FAILED',
      `首错应保留 ACTION_FAILED：${JSON.stringify(replayed)}`);
    assert(order.join(',') === 'begin:1,action:1,finish:1',
      `首错后 seq2 必须零调用：${order.join(',')}`);
    assert(collector.calls[1]?.input?.actionAxis?.resolution === 'action_failed',
      `finish 必须见实际失败轴：${JSON.stringify(collector.calls[1])}`);
    assert(!replayed.cleanProofAuthority,
      '失败 run 不得产可 seal 的 CLEAN proof');
  });

  await check('E3 expected 在 session 创建时冻结；mapping 前每 event 采全 assertion universe', async () => {
    const fixture = await admittedFixture();
    const expected = expectedBytes();
    const session = await openSession({ fixture, expected });
    expected.fill(0x78);
    for (const seq of [1, 2]) {
      await observationApi.beginRawEvent({
        sessionAuthority: session.sessionAuthority,
        seq,
        topologyAuthority: fixture.topologyAuthority,
      });
      await observationApi.finishRawEvent({
        sessionAuthority: session.sessionAuthority,
        seq,
        actionAxis: { resolution: 'unique', candidateCount: 1 },
        topologyAuthority: fixture.topologyAuthority,
      });
    }
    for (const call of session.collector.calls) {
      const universe = JSON.stringify(call.input.assertionUniverse);
      assert(universe.includes('ORIGINAL_EXPECTED_MARKER')
        && universe.includes('noPageError')
        && !('intentId' in call.input),
      `collector 必须见冻结 assertion universe 且不得见 mapping：${universe}`);
    }
  });

  await check('E4 顺序/clone/foreign topology 首错；collector 不越过失败边界', async () => {
    const fixture = await admittedFixture();
    const skipped = await openSession({ fixture });
    expectReason(await observationApi.beginRawEvent({
      sessionAuthority: skipped.sessionAuthority,
      seq: 2,
      topologyAuthority: fixture.topologyAuthority,
    }), 'RAW_OBSERVATION_SEQUENCE_INVALID', '跳 seq');
    assert(skipped.collector.calls.length === 0, '跳 seq 不得调用 collector');

    const clone = await openSession({ fixture });
    expectReason(await observationApi.beginRawEvent({
      sessionAuthority: structuredClone(clone.sessionAuthority),
      seq: 1,
      topologyAuthority: fixture.topologyAuthority,
    }), 'RAW_OBSERVATION_AUTHORITY_INVALID', 'clone session');
    assert(clone.collector.calls.length === 0, 'clone session 不得调用 collector');

    const topology = await openSession({ fixture });
    expectReason(await observationApi.beginRawEvent({
      sessionAuthority: topology.sessionAuthority,
      seq: 1,
      topologyAuthority: Object.freeze(Object.create(null)),
    }), 'RAW_OBSERVATION_AUTHORITY_INVALID', 'foreign topology');
    assert(topology.collector.calls.length === 0, 'foreign topology 不得调用 collector');
  });

  await check('E5 collector throw/malformed 稳定降权，不泄私密原文且不能 seal', async () => {
    for (const mode of ['throw', 'malformed']) {
      const fixture = await admittedFixture();
      const built = collectorDouble({
        throwPhase: mode === 'throw' ? 'after' : null,
        malformedPhase: mode === 'malformed' ? 'after' : null,
      });
      const session = await openSession({ fixture, collector: built });
      await observationApi.beginRawEvent({
        sessionAuthority: session.sessionAuthority,
        seq: 1,
        topologyAuthority: fixture.topologyAuthority,
      });
      const result = await observationApi.finishRawEvent({
        sessionAuthority: session.sessionAuthority,
        seq: 1,
        actionAxis: { resolution: 'unique', candidateCount: 1 },
        topologyAuthority: fixture.topologyAuthority,
      });
      expectReason(result, 'RAW_OBSERVATION_COLLECTION_FAILED', mode);
      assert(!JSON.stringify(result).includes('PRIVATE_OBSERVATION_MARKER'),
        `${mode} 不得泄 collector 异常`);
      expectReason(observationApi.sealRawEventObservations({
        sessionAuthority: session.sessionAuthority,
        cleanProofAuthority: fixture.cleanProofAuthority,
      }), 'RAW_OBSERVATION_INCOMPLETE', `${mode} 后 seal`);
    }
  });

  await check('E6 只在全 event + genuine CLEAN 后 seal；inspect 多读最小元数据', async () => {
    const fixture = await admittedFixture();
    const session = await openSession({ fixture });
    await observationApi.beginRawEvent({
      sessionAuthority: session.sessionAuthority,
      seq: 1,
      topologyAuthority: fixture.topologyAuthority,
    });
    await observationApi.finishRawEvent({
      sessionAuthority: session.sessionAuthority,
      seq: 1,
      actionAxis: { resolution: 'unique', candidateCount: 1 },
      topologyAuthority: fixture.topologyAuthority,
    });
    expectReason(observationApi.sealRawEventObservations({
      sessionAuthority: session.sessionAuthority,
      cleanProofAuthority: fixture.cleanProofAuthority,
    }), 'RAW_OBSERVATION_INCOMPLETE', '漏 event');
    await observationApi.beginRawEvent({
      sessionAuthority: session.sessionAuthority,
      seq: 2,
      topologyAuthority: fixture.topologyAuthority,
    });
    await observationApi.finishRawEvent({
      sessionAuthority: session.sessionAuthority,
      seq: 2,
      actionAxis: { resolution: 'unique', candidateCount: 1 },
      topologyAuthority: fixture.topologyAuthority,
    });
    const sealed = observationApi.sealRawEventObservations({
      sessionAuthority: session.sessionAuthority,
      cleanProofAuthority: fixture.cleanProofAuthority,
    });
    assert(exactKeys(sealed, ['ok', 'rawObservationAuthority'])
      && sealed.ok === true && sealed.rawObservationAuthority,
    `seal 非 exact success：${JSON.stringify(sealed)}`);
    for (let index = 0; index < 2; index += 1) {
      const inspected = observationApi.inspectRawEventObservationAuthority({
        rawObservationAuthority: sealed.rawObservationAuthority,
      });
      assert(exactKeys(inspected, [
        'ok', 'captureSha256', 'caseId', 'expectedSha256', 'eventSeqs', 'observationCount',
        'runExecutionAuthority',
      ]) && inspected.ok === true
        && inspected.runExecutionAuthority === session.runExecutionAuthority
        && inspected.eventSeqs.join(',') === '1,2'
        && inspected.observationCount === 2
        && inspected.caseId === 'tc_raw_observation'
        && /^sha256:[0-9a-f]{64}$/.test(inspected.expectedSha256),
      `inspect 元数据/多读漂移：${JSON.stringify(inspected)}`);
      // R10：绑定预检需要 caseId 与 expectedSha256 摘要（错绑不烧 genuine authority）；
      // expectedSha256 是纯摘要不携 expected 内容，为键名禁令唯一例外。
      assert(!/observations|expected|axis|target/i.test(
        Object.keys(inspected).filter((key) => key !== 'expectedSha256').join(','),
      ), 'public inspect 不得开放 observation/expected/action facts');
    }
    expectReason(observationApi.inspectRawEventObservationAuthority({
      rawObservationAuthority: structuredClone(sealed.rawObservationAuthority),
    }), 'RAW_OBSERVATION_AUTHORITY_INVALID', 'clone raw observation');
  });
}

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
