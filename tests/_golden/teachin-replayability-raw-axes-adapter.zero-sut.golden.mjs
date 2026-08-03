#!/usr/bin/env node
// Resolved raw observations -> current replay axes -> frozen verdict adapter.
// Pure authorities/maps/bytes; zero SUT/browser/network/LLM.

import { readFileSync } from 'node:fs';
import { projectReplayAxes as canonicalProjectReplayAxes } from '../../lib/replay-axes.mjs';
import { canonicalVerdictCliAdapter } from '../../lib/teachin/verdict-cli-adapter.mjs';

const TAG = 'teachin-replayability-raw-axes-adapter';
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

let api;
try {
  api = await import('../../lib/teachin/raw-axes-adapter.mjs');
} catch (error) {
  failures.push(`production API unavailable: ${String(
    error?.code || error?.message || error,
  ).slice(-500)}`);
}

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
}

function expectReason(result, reason, label) {
  assert(exactKeys(result, ['ok', 'reason'])
    && result.ok === false && result.reason === reason,
  `${label} 应 exact ${reason}：${JSON.stringify(result)}`);
}

const token = () => Object.freeze(Object.create(null));
const CAPTURE_SHA = 'a'.repeat(64);
const EXPECTED_SHA = 'b'.repeat(64);

function rawProjection({
  captureSha256 = CAPTURE_SHA,
  expectedSha256 = EXPECTED_SHA,
  withStructural = false,
} = {}) {
  const common = {
    caseId: 'tc_raw_axes',
    captureSha256,
    expectedSha256,
  };
  const events = [
    {
      seq: 1,
      eventKey: '1:click',
      stepId: 'rawstep_1',
      action: 'click',
      actionAxis: {
        resolution: 'unique',
        candidateCount: 1,
        identityReadback: { ok: true },
      },
      before: {
        count: 10,
        replyBaseline: { n: 0, text: null },
      },
      after: {
        path: '/first',
        count: 11,
        toasts: ['first-toast'],
        textHits: { '最终页面': 0 },
        buttonHits: { 保存: 1 },
        buttonSeen: 1,
        buttonDisabledHits: { 保存: 0 },
        inputReadback: { ok: true, valueSha256: 'input-1' },
        reply: undefined,
      },
      forensics: [{
        type: 'response',
        attributedStepId: 'rawstep_1',
        status: 200,
      }],
    },
    {
      seq: 2,
      eventKey: withStructural ? '2:newpage' : '2:click',
      stepId: 'rawstep_2',
      action: withStructural ? 'newpage' : 'click',
      actionAxis: {
        resolution: 'unique',
        candidateCount: 1,
        identityReadback: { ok: true },
      },
      before: {
        count: 11,
        replyBaseline: { n: 0, text: null },
      },
      after: {
        path: '/terminal',
        count: 12,
        toasts: ['terminal-toast'],
        textHits: { '最终页面': 1 },
        buttonHits: { 保存: 1 },
        buttonSeen: 2,
        buttonDisabledHits: { 保存: 0 },
        inputReadback: { ok: true, valueSha256: 'input-2' },
        reply: 'terminal reply',
      },
      forensics: [{
        type: 'response',
        attributedStepId: 'rawstep_2',
        status: 200,
      }],
    },
  ];
  return {
    ...common,
    runExecutionAuthority: token(),
    executionTargetAuthority: token(),
    topologyAuthority: token(),
    expected: {
      intents: [{
        intentId: 'authored_i1',
        expected: [
          { kind: 'textVisible', op: 'appears', value: '最终页面', soft: false },
          { kind: 'buttonState', op: 'enabled', value: '保存', soft: false },
        ],
      }],
      globalAssertions: [{ kind: 'noPageError', op: 'absent', soft: false }],
    },
    events,
    pageErrors: [],
    records: events.flatMap((event) => event.forensics),
    chatCfg: { replySelector: '.assistant' },
  };
}

function resolvedProjection({
  captureSha256 = CAPTURE_SHA,
  expectedSha256 = EXPECTED_SHA,
  pending = [],
  withStructural = false,
} = {}) {
  const evidenceEventSeqs = withStructural ? [1] : [1, 2];
  return {
    caseId: 'tc_raw_axes',
    captureSha256,
    expectedSha256,
    resolved: [{
      mappingKey: 'm1',
      intentId: 'authored_i1',
      atom: 'nav.workflowManagement',
      params: {},
      evidenceEventSeqs,
    }],
    pending,
    structural: withStructural ? [{
      eventSeq: 2,
      compoundKey: '2:newpage',
      triggerEventSeq: 1,
      triggerCompoundKey: '1:click',
      pathHint: '/terminal',
    }] : [],
    coverage: {
      mappedEventSeqs: evidenceEventSeqs,
      pendingEventSeqs: pending.flatMap((row) => row.evidenceEventSeqs || []),
      structuralEventSeqs: withStructural ? [2] : [],
    },
    candidateTestCase: {
      caseId: 'tc_raw_axes',
      steps: [{
        intentId: 'authored_i1',
        expected: [
          { kind: 'textVisible', op: 'appears', value: '最终页面', soft: false },
          { kind: 'buttonState', op: 'enabled', value: '保存', soft: false },
        ],
      }],
      globalAssertions: [{ kind: 'noPageError', op: 'absent', soft: false }],
    },
  };
}

function makeHarness({
  raw = rawProjection(),
  resolved = resolvedProjection(),
  projectFailure = null,
  verdictFailure = null,
  projector = null,
  verdictAdapter = null,
} = {}) {
  const rawObservationAuthority = token();
  const resolvedProjectionAuthority = token();
  let rawConsumed = false;
  let resolvedConsumed = false;
  const calls = {
    raw: 0,
    resolved: 0,
    axes: 0,
    verdict: 0,
    axesInput: null,
    verdictInput: null,
  };
  const axesText = `${JSON.stringify({
    caseId: 'tc_raw_axes',
    steps: [{
      stepId: 'rawstep_2',
      intentId: 'authored_i1',
      atom: 'nav.workflowManagement',
      action: { resolution: 'unique' },
      postAssertions: [{ kind: 'textVisible', ok: true, soft: false }],
      forensics: { network: [], lifecycle: { crashed: false, pageerror: [] } },
    }],
  })}\n`;
  const verdictBytes = Buffer.from(`${JSON.stringify({
    caseId: 'tc_raw_axes',
    steps: [{
      stepId: 'rawstep_2',
      intentId: 'authored_i1',
      atom: 'nav.workflowManagement',
      verdict: 'PASS',
      reason: null,
    }],
  })}\n`);
  const dependencies = {
    consumeRawObservationAuthority({ rawObservationAuthority: supplied }) {
      calls.raw += 1;
      if (supplied !== rawObservationAuthority || rawConsumed) {
        return { ok: false, reason: 'RAW_OBSERVATION_AUTHORITY_INVALID' };
      }
      rawConsumed = true;
      return { ok: true, projection: structuredClone(raw) };
    },
    consumeResolvedProjectionAuthority({
      resolvedProjectionAuthority: supplied,
    }) {
      calls.resolved += 1;
      if (supplied !== resolvedProjectionAuthority || resolvedConsumed) {
        return { ok: false, reason: 'RESOLVED_PROJECTION_AUTHORITY_INVALID' };
      }
      resolvedConsumed = true;
      return { ok: true, projection: structuredClone(resolved) };
    },
    projectReplayAxes(input) {
      calls.axes += 1;
      calls.axesInput = input;
      if (projectFailure === 'throw') {
        throw new Error('PRIVATE_AXES_MARKER https://must-not-leak.invalid');
      }
      if (projectFailure === 'malformed') return undefined;
      if (typeof projector === 'function') return projector(input);
      return axesText;
    },
    verdictAdapter: verdictAdapter || {
      async runFrozenVerdict(input) {
        calls.verdict += 1;
        calls.verdictInput = input;
        if (verdictFailure === 'throw') {
          throw new Error('PRIVATE_VERDICT_MARKER');
        }
        if (verdictFailure === 'returned') {
          return { ok: false, reason: 'PRIVATE_JUDGE_REASON' };
        }
        return { ok: true, verdictBytes: Buffer.from(verdictBytes) };
      },
    },
  };
  const adapter = api.createRawAxesAdapter(dependencies);
  return {
    adapter,
    axesText,
    calls,
    rawObservationAuthority,
    resolvedProjectionAuthority,
    verdictBytes,
  };
}

function runInput(built, overrides = {}) {
  return {
    rawObservationAuthority: built.rawObservationAuthority,
    resolvedProjectionAuthority: built.resolvedProjectionAuthority,
    ...overrides,
  };
}

if (api && typeof api.createRawAxesAdapter === 'function') {
  await check('A1 resolved 后才按 event seq 聚合现役 projector 输入并跑 frozen verdict', async () => {
    const built = makeHarness();
    const result = await built.adapter.projectAndVerify(runInput(built));
    assert(exactKeys(result, [
      'ok', 'rawObservationAuthority', 'resolvedProjectionAuthority',
      'axesBytes', 'verdictBytes', 'evidence',
    ]) && result.ok === true,
    `success shape 不闭合：${JSON.stringify(result)}`);
    assert(result.rawObservationAuthority === built.rawObservationAuthority
      && result.resolvedProjectionAuthority === built.resolvedProjectionAuthority,
    'issuer 必须 exact 回同两 authority');
    assert(built.calls.raw === 1 && built.calls.resolved === 1
      && built.calls.axes === 1 && built.calls.verdict === 1,
    `consumer/projector/verdict 均须恰一次：${JSON.stringify(built.calls)}`);

    const input = built.calls.axesInput;
    assert(input.caseId === 'tc_raw_axes'
      && input.intentOrder.join(',') === 'authored_i1',
    'case/intent order 必须来自 authority-bound projection');
    assert(input.intentEvents.get('authored_i1')
      .map((row) => row.stepId).join(',') === 'rawstep_1,rawstep_2'
      && input.reprStepOf.get('authored_i1') === 'rawstep_2',
    '多 event intent 必须按 seq 保留且 terminal 为最后 event');
    assert(input.actionByStep.get('rawstep_1').resolution === 'unique'
      && input.actionByStep.get('rawstep_2').resolution === 'unique',
    '每 event action axis 必须保留');
    assert(input.intentCount.get('authored_i1').before === 10
      && input.intentCount.get('authored_i1').after === 12
      && input.intentUrl.get('authored_i1') === '/terminal'
      && input.intentToasts.get('authored_i1')[0] === 'terminal-toast'
      && input.intentTextHits.get('authored_i1')['最终页面'] === 1
      && input.intentReply.get('authored_i1') === 'terminal reply',
    'before 必须取首 event，terminal evidence 必须取末 event');
    assert(Buffer.isBuffer(result.axesBytes)
      && result.axesBytes.equals(Buffer.from(built.axesText))
      && built.calls.verdictInput.axesBytes.equals(result.axesBytes)
      && result.verdictBytes.equals(built.verdictBytes),
    'axes 只 UTF-8 bytes 化并原样交 frozen verdict adapter');
  });

  await check('A2 structural newpage 依 trigger intent 保真，不能按 intent Set 洗掉', async () => {
    const built = makeHarness({
      raw: rawProjection({ withStructural: true }),
      resolved: resolvedProjection({ withStructural: true }),
    });
    const result = await built.adapter.projectAndVerify(runInput(built));
    assert(result?.ok === true, `structural 正控应成功：${JSON.stringify(result)}`);
    const events = built.calls.axesInput.intentEvents.get('authored_i1');
    assert(events.map((row) => `${row.stepId}:${row.action}`).join(',')
      === 'rawstep_1:click,rawstep_2:newpage',
    `newpage 必须挂到 trigger intent：${JSON.stringify(events)}`);
    assert(events.every((row) => row.atom === 'nav.workflowManagement'),
      `structural child 必须继承触发 mapping atom：${JSON.stringify(events)}`);
    assert(built.calls.axesInput.actionByStep.has('rawstep_2'),
      'structural step action/topology evidence 不得丢失');
  });

  await check('A3 capture/expected binding mismatch 与 pending 均在 projector 前 fail-closed', async () => {
    const cases = [
      makeHarness({
        resolved: resolvedProjection({ captureSha256: 'c'.repeat(64) }),
      }),
      makeHarness({
        resolved: resolvedProjection({ expectedSha256: 'd'.repeat(64) }),
      }),
      makeHarness({
        resolved: resolvedProjection({
          pending: [{ reason: 'KNOWN_RECIPE_MISSING', evidenceEventSeqs: [2] }],
        }),
      }),
    ];
    for (const built of cases) {
      expectReason(await built.adapter.projectAndVerify(runInput(built)),
        'RAW_AXES_BINDING_MISMATCH', 'binding/pending');
      assert(built.calls.axes === 0 && built.calls.verdict === 0,
        'binding/pending 不得进入 axes/verdict');
    }
  });

  await check('A4 caller axes/verdict/evidence/mapping truth 在 authority consume 前拒绝', async () => {
    for (const poison of [
      { axesBytes: Buffer.from('{}') },
      { verdictBytes: Buffer.from('{}') },
      { evidence: { verdict: 'PASS' } },
      { mapping: [] },
    ]) {
      const built = makeHarness();
      expectReason(await built.adapter.projectAndVerify(runInput(built, poison)),
        'RAW_AXES_PROJECTION_INVALID', 'caller semantic truth');
      assert(built.calls.raw === 0 && built.calls.resolved === 0
        && built.calls.axes === 0 && built.calls.verdict === 0,
      '非法 public input 必须在所有 consumer 前拒绝');
    }
  });

  await check('A5 authority plain/clone/replay 不可二次投影', async () => {
    const forged = makeHarness();
    expectReason(await forged.adapter.projectAndVerify({
      rawObservationAuthority: structuredClone(forged.rawObservationAuthority),
      resolvedProjectionAuthority: forged.resolvedProjectionAuthority,
    }), 'RAW_OBSERVATION_AUTHORITY_INVALID', 'clone raw authority');
    assert(forged.calls.axes === 0 && forged.calls.verdict === 0,
      '无权 raw 不得投影/裁定');

    const replay = makeHarness();
    assert((await replay.adapter.projectAndVerify(runInput(replay)))?.ok === true,
      '首次 genuine projection 应成功');
    expectReason(await replay.adapter.projectAndVerify(runInput(replay)),
      'RAW_OBSERVATION_AUTHORITY_INVALID', 'authority replay');
    assert(replay.calls.axes === 1 && replay.calls.verdict === 1,
      'authority replay 不得二次 projector/verdict');
  });

  await check('A6 projector/verdict throw/malformed 首错停止且不泄私密原文', async () => {
    for (const mode of ['throw', 'malformed']) {
      const built = makeHarness({ projectFailure: mode });
      const result = await built.adapter.projectAndVerify(runInput(built));
      expectReason(result, 'RAW_AXES_PROJECTION_FAILED', `project ${mode}`);
      assert(built.calls.axes === 1 && built.calls.verdict === 0,
        `project ${mode} 后不得调用 verdict`);
      assert(!JSON.stringify(result).includes('must-not-leak'),
        'project failure 不得泄异常');
    }
    for (const mode of ['throw', 'returned']) {
      const built = makeHarness({ verdictFailure: mode });
      const result = await built.adapter.projectAndVerify(runInput(built));
      expectReason(result, 'VERDICT_EXECUTION_FAILED', `verdict ${mode}`);
      assert(built.calls.axes === 1 && built.calls.verdict === 1,
        `verdict ${mode} 不得 retry`);
      assert(!JSON.stringify(result).includes('PRIVATE'),
        'verdict failure 不得泄异常/private reason');
    }
  });

  await check('A7 canonical module 真调用现役 projector + frozen adapter，无本地 judge', () => {
    const source = readFileSync(
      new URL('../../lib/teachin/raw-axes-adapter.mjs', import.meta.url),
      'utf8',
    );
    assert(/from\s+['"][^'"]*replay-axes\.mjs['"]/.test(source)
      && /\bprojectReplayAxes\s*\(/.test(source),
    'raw axes adapter 必须静态导入并实际调用 projectReplayAxes');
    assert(/from\s+['"]\.\/verdict-cli-adapter\.mjs['"]/.test(source)
      && /\bcanonicalVerdictCliAdapter\.runFrozenVerdict\s*\(/.test(source),
    'raw axes adapter 必须实际调用 canonical frozen verdict adapter');
    assert(!/\b(?:evaluateAssertions|decide|deriveActionPerformed|forensicsBacksSutError)\s*[=(]/
      .test(source),
    'raw axes adapter 禁止复制 assertion/verdict judge');
    assert(!/(?:node:child_process|bin\/verdict\.mjs|execFile|spawn)\b/.test(source),
      'child process/judge path 只能存在 verdict-cli-adapter');
  });

  await check('A8 非空 firingStepId 经 adapter 真穿 canonical projector 并归因', async () => {
    const raw = rawProjection();
    raw.records = [{
      type: 'response',
      url: '/synthetic',
      status: 200,
      ts: 1,
      initiator: 'fetch',
      firingStepId: 'rawstep_1',
      attributedStepId: 'rawstep_1',
      errorEnvelope: null,
      streamFinished: true,
      streamStatus: 'complete',
    }];
    const built = makeHarness({ raw, projector: canonicalProjectReplayAxes });
    const result = await built.adapter.projectAndVerify(runInput(built));
    assert(built.calls.axesInput?.allStepIds instanceof Set,
      'adapter 给 canonical projector 的 allStepIds 必须是 Set');
    assert(result?.ok === true,
      `canonical projector 接缝应成功：${JSON.stringify(result)}`);
    assert(built.calls.axes === 1 && built.calls.verdict === 1,
      `projector/verdict 均须恰一次：${JSON.stringify(built.calls)}`);
    const axes = JSON.parse(result.axesBytes.toString('utf8'));
    const network = axes.steps?.[0]?.forensics?.network;
    assert(Array.isArray(network) && network.length === 1
      && network[0].attributedStepId === 'rawstep_2'
      && network[0].url === '/synthetic',
    `网络记录必须归因到代表步：${JSON.stringify(network)}`);
  });

  await check('A9 resolved atom 真穿 canonical axes 与 frozen verdict identity', async () => {
    let canonicalVerdictCalls = 0;
    const built = makeHarness({
      projector: canonicalProjectReplayAxes,
      verdictAdapter: {
        async runFrozenVerdict(input) {
          canonicalVerdictCalls += 1;
          return canonicalVerdictCliAdapter.runFrozenVerdict(input);
        },
      },
    });
    const result = await built.adapter.projectAndVerify(runInput(built));
    assert(result?.ok === true,
      `canonical verdict 接缝应成功：${JSON.stringify(result)}`);
    assert(built.calls.axes === 1 && built.calls.verdict === 0
      && canonicalVerdictCalls === 1,
    'canonical projector/verdict 须各恰一次，fake verdict 不得调用');
    const axes = JSON.parse(result.axesBytes.toString('utf8'));
    const verdict = JSON.parse(result.verdictBytes.toString('utf8'));
    assert(built.calls.axesInput.intentEvents.get('authored_i1')
      .every((row) => row.atom === 'nav.workflowManagement')
      && axes.steps?.[0]?.atom === 'nav.workflowManagement'
      && verdict.steps?.[0]?.atom === 'nav.workflowManagement',
    `axes/verdict atom 必须同源于 resolved mapping：${JSON.stringify({
      axesAtom: axes.steps?.[0]?.atom,
      verdictAtom: verdict.steps?.[0]?.atom,
    })}`);
    assert(verdict.steps?.[0]?.verdict === 'PASS',
      `canonical verdict 应按完整硬断言判 PASS：${JSON.stringify(verdict.steps?.[0])}`);

    for (const [label, atom, remove] of [
      ['empty', '', false],
      ['null', null, false],
      ['number', 7, false],
      ['missing', undefined, true],
    ]) {
      const malformedResolved = resolvedProjection();
      if (remove) delete malformedResolved.resolved[0].atom;
      else malformedResolved.resolved[0].atom = atom;
      let malformedVerdictCalls = 0;
      const malformed = makeHarness({
        resolved: malformedResolved,
        projector: canonicalProjectReplayAxes,
        verdictAdapter: {
          async runFrozenVerdict(input) {
            malformedVerdictCalls += 1;
            return canonicalVerdictCliAdapter.runFrozenVerdict(input);
          },
        },
      });
      expectReason(await malformed.adapter.projectAndVerify(runInput(malformed)),
        'RAW_AXES_BINDING_MISMATCH', `${label} mapping atom`);
      assert(malformed.calls.axes === 0 && malformedVerdictCalls === 0,
        `${label} mapping atom 必须在 projector/verdict 前拒绝`);
    }
  });
}

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
