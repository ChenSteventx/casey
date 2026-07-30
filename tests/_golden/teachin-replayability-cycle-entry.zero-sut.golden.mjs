#!/usr/bin/env node
// Same-process record→prepare→cycle application-service ratchet; object doubles only.

import { existsSync, readFileSync } from 'node:fs';

const TAG = 'teachin-replayability-cycle-entry';
const failures = [];
let passed = 0;
const tok = (label) => Object.freeze(Object.assign(Object.create(null), { label }));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

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

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
}

function expectReason(value, reason, label) {
  assert(exactKeys(value, ['ok', 'reason'])
    && value.ok === false && value.reason === reason,
  `${label}: ${JSON.stringify(value)}`);
}

let api;
let productionSource = '';
try {
  const url = new URL('../../lib/teachin/replayability-cycle-entry.mjs', import.meta.url);
  if (existsSync(url)) productionSource = readFileSync(url, 'utf8');
  api = await import(url);
} catch (error) {
  failures.push(`production entry unavailable: ${String(
    error?.code || error?.message || error,
  ).slice(-500)}`);
}
const ready = typeof api?.createReplayabilityCycleEntry === 'function'
  && typeof api?.runRecordedTeachinReplayabilityCycle === 'function'
  && Object.keys(api).sort().join(',') === [
    'createReplayabilityCycleEntry', 'runRecordedTeachinReplayabilityCycle',
  ].join(',');
if (api && !ready) failures.push('production entry export/API shape invalid');

function cycleInput(authorities = {}) {
  return {
    sourcePlan: {
      pairId: 'pair_entry',
      testcaseBytes: Buffer.from('{"caseId":"tc_entry"}'),
      expectedBytes: Buffer.from('{}'),
      expectedObligations: { intents: ['intent_1'] },
      sutBuildDigest: `sha256:${'1'.repeat(64)}`,
      channelProfileDigest: `sha256:${'2'.repeat(64)}`,
      identityProfileDigest: `sha256:${'3'.repeat(64)}`,
      replayKernelDigest: `sha256:${'4'.repeat(64)}`,
      resetPlanDigest: `sha256:${'5'.repeat(64)}`,
      sessionPolicyDigest: `sha256:${'6'.repeat(64)}`,
      source: {
        candidateBytes: Buffer.from('{}'),
        eventsBytes: Buffer.from('[]'),
        entityLockBytes: Buffer.from('[]'),
        runNamespace: 'run_source_entry',
      },
    },
    executionTargetAuthority: authorities.target,
    projection: {
      mappingCandidate: [{
        intentId: 'intent_1', atom: 'nav.workflowManagement',
        params: {}, evidenceEventSeqs: [1],
      }],
      authoredTestCase: {
        caseId: 'tc_entry',
        steps: [{ intentId: 'intent_1', intent: '进入工作流管理' }],
      },
    },
    distilled: {
      authoringRunNamespace: 'run_authoring_entry',
      runNamespace: 'run_distilled_entry',
    },
  };
}

function recording(label) {
  let connected = true;
  let contextClosed = false;
  let browserCloseCalls = 0;
  let contextCloseCalls = 0;
  const listeners = new Map();
  const emit = (event) => {
    for (const handler of listeners.get(event) || []) handler();
  };
  const live = (methods) => {
    const value = Object.create(null);
    for (const [name, method] of Object.entries(methods)) {
      Object.defineProperty(value, name, { value: method });
    }
    return Object.freeze(value);
  };
  const on = (event, handler) => {
    const entries = listeners.get(event) || [];
    entries.push(handler);
    listeners.set(event, entries);
  };
  const browser = live({
    on,
    isConnected: () => connected,
    close: async () => {
      browserCloseCalls += 1; connected = false; emit('disconnected');
    },
  });
  const context = live({
    on,
    browser: () => browser,
    close: async () => {
      contextCloseCalls += 1; contextClosed = true; emit('close');
    },
  });
  return {
    browser,
    context,
    get closed() { return contextClosed && connected === false; },
    get closeCounts() { return [contextCloseCalls, browserCloseCalls]; },
  };
}

function makeHarness(options = {}) {
  const order = [];
  const calls = { admit: 0, prepare: 0, cycle: 0, raw: 0 };
  const captureAuthority = tok('capture');
  const preparationAuthority = tok('preparation');
  const target = tok('target');
  const genuineRecordings = new WeakSet();
  const usedRecordings = new WeakSet();
  const markGenuine = (owner) => {
    genuineRecordings.add(owner.browser);
    genuineRecordings.add(owner.context);
    return owner;
  };
  const runtimeCycleAdapter = {
    async prepareSourceReplayRuntime(input) {
      order.push('prepare'); calls.prepare += 1;
      assert(exactKeys(input, [
        'executionTargetAuthority', 'recordingBrowser',
        'recordingContext', 'runNamespace',
      ]), `prepare input 不闭合：${Object.keys(input || {})}`);
      assert(input.executionTargetAuthority === target
        && input.runNamespace === 'run_source_entry',
      'prepare namespace/target 换绑');
      if (!genuineRecordings.has(input.recordingBrowser)
        || !genuineRecordings.has(input.recordingContext)
        || input.recordingContext.browser() !== input.recordingBrowser
        || usedRecordings.has(input.recordingBrowser)
        || usedRecordings.has(input.recordingContext)) {
        return { ok: false, reason: 'REPLAY_RUNTIME_OWNERSHIP_MISMATCH' };
      }
      if (options.prepareThrowBefore) throw new Error('PRIVATE_PREPARE_THROW');
      if (options.prepareFail) return { ok: false, reason: 'SOURCE_RUNTIME_PREPARATION_FAILED' };
      usedRecordings.add(input.recordingBrowser);
      usedRecordings.add(input.recordingContext);
      await input.recordingContext.close();
      await input.recordingBrowser.close();
      if (options.prepareThrowAfter) throw new Error('PRIVATE_PREPARE_THROW');
      return {
        ok: true,
        sourceRuntimePreparationAuthority: preparationAuthority,
      };
    },
  };
  const deps = {
    admitRawReplayCapture(input) {
      order.push('admit'); calls.admit += 1;
      assert(exactKeys(input, ['captureBytes', 'caseId'])
        && input.caseId === 'tc_entry' && Buffer.isBuffer(input.captureBytes),
      'admission input 换绑');
      if (options.admitThrow) throw new Error('PRIVATE_ADMISSION_THROW');
      if (options.admitFail) return { ok: false, reason: 'RAW_CAPTURE_INVALID' };
      return { ok: true, captureAuthority, captureSha256: `sha256:${'7'.repeat(64)}`,
        eventCount: 1 };
    },
    runtimeCycleAdapter,
    async runTeachinReplayabilityCycle(input) {
      order.push('cycle'); calls.cycle += 1;
      assert(input.sourcePlan.source.captureAuthority === captureAuthority,
        'façade 必须收到 genuine admitted capture cap');
      assert(input.sourceRuntime.sourceRuntimePreparationAuthority
        === preparationAuthority,
      'façade 必须收到 genuine prepared runtime cap');
      assert(exactKeys(input.distilled, ['authoringRunNamespace', 'runNamespace']),
        'no-entity 首发不得接 caller entity authority/hint');
      assert(!Object.hasOwn(input, 'recordingBrowser')
        && !Object.hasOwn(input, 'recordingContext'),
      'recording handles 不得进入 core');
      calls.raw += 1;
      return {
        ok: true, developmentOnly: true, promotionReady: false,
        equivalenceReceipt: tok('equivalence'),
      };
    },
  };
  return {
    order, calls, target, markGenuine,
    entry: api.createReplayabilityCycleEntry(deps),
  };
}

function entryInput(h, owner, overrides = {}) {
  return {
    caseId: 'tc_entry',
    captureBytes: Buffer.from('{"artifactKind":"teach-in-capture"}'),
    recordingBrowser: owner.browser,
    recordingContext: owner.context,
    cycleInput: cycleInput({ target: h.target }),
    ...overrides,
  };
}

if (ready) {
  await check('E1 exact input 同进程 admission→recording close→prepare→core，source raw 总计一次', async () => {
    const h = makeHarness();
    const owner = h.markGenuine(recording('recording-e1'));
    const result = await h.entry.runRecordedCycle(entryInput(h, owner));
    assert(result?.ok === true && result.developmentOnly === true
      && result.promotionReady === false && result.equivalenceReceipt,
    `full-cycle 结果换形：${JSON.stringify(result)}`);
    assert(owner.closed && owner.closeCounts.join(',') === '1,1'
      && h.order.join('>') === 'admit>prepare>cycle',
      `同进程顺序错误：${h.order.join('>')}`);
    assert(h.calls.admit === 1 && h.calls.prepare === 1
      && h.calls.cycle === 1 && h.calls.raw === 1,
    `source raw 必须只由 core 执行一次：${JSON.stringify(h.calls)}`);
  });

  await check('E2 caller 预开 replay handles/提交 cap 在 admission 前 exact-key 拒绝', async () => {
    for (const [field, value] of [
      ['replayBrowser', tok('preopened-browser')],
      ['replayContext', tok('preopened-context')],
      ['replayPage', tok('preopened-page')],
      ['topologyAuthority', tok('caller-topology')],
      ['sourceRuntimePreparationAuthority', tok('caller-prep')],
    ]) {
      const h = makeHarness();
      const owner = h.markGenuine(recording(`recording-e2-${field}`));
      expectReason(await h.entry.runRecordedCycle(
        entryInput(h, owner, { [field]: value }),
      ), 'CYCLE_ENTRY_INPUT_INVALID', field);
      assert(h.calls.admit === 0 && h.calls.prepare === 0
        && h.calls.cycle === 0 && !owner.closed,
      `${field} 必须零 admission/close/core`);
    }
  });

  await check('E3 cycleInput 禁止 caller capture/preparation cap，不能靠 plain JSON 跨进程重建', async () => {
    for (const mutate of [
      (input) => { input.sourcePlan.source.captureAuthority = tok('caller-capture'); },
      (input) => {
        input.sourceRuntime = { sourceRuntimePreparationAuthority: tok('caller-prep') };
      },
      (input) => { input.distilled.entityLockAuthority = tok('caller-entity'); },
      (input) => { input.distilled.noEntity = true; },
    ]) {
      const h = makeHarness();
      const owner = h.markGenuine(recording('recording-e3'));
      const input = entryInput(h, owner);
      mutate(input.cycleInput);
      expectReason(await h.entry.runRecordedCycle(input),
        'CYCLE_ENTRY_INPUT_INVALID', 'caller cap');
      assert(h.calls.admit === 0 && h.calls.prepare === 0 && h.calls.cycle === 0,
        'caller cap 必须在 admission 前拒绝');
    }
  });

  await check('E4 recording clone 与 genuine second-use 均拒且不进入 core', async () => {
    const h = makeHarness();
    const genuine = h.markGenuine(recording('recording-e4'));
    const clone = {
      browser: { ...genuine.browser },
      context: { ...genuine.context },
    };
    expectReason(await h.entry.runRecordedCycle(entryInput(h, clone)),
      'CYCLE_ENTRY_INPUT_INVALID', 'recording clone');
    assert(h.calls.admit === 0 && h.calls.cycle === 0 && !genuine.closed,
      'clone 不得关闭 genuine recording 或进入 core');
    const first = await h.entry.runRecordedCycle(entryInput(h, genuine));
    assert(first?.ok === true && h.calls.raw === 1, 'genuine first use 应闭环');
    expectReason(await h.entry.runRecordedCycle(entryInput(h, genuine)),
      'REPLAY_RUNTIME_OWNERSHIP_MISMATCH', 'recording second use');
    assert(h.calls.cycle === 1 && h.calls.raw === 1
      && genuine.closeCounts.join(',') === '1,1',
    'second use 不得触发第二次 source raw/close');
  });

  await check('E5 admission/prepare 早退或抛错都 exact 清理 recording owner', async () => {
    for (const [scenario, reason] of [
      [{ admitFail: true }, 'RAW_CAPTURE_INVALID'],
      [{ admitThrow: true }, 'CYCLE_ENTRY_FAILED'],
      [{ prepareFail: true }, 'SOURCE_RUNTIME_PREPARATION_FAILED'],
      [{ prepareThrowBefore: true }, 'CYCLE_ENTRY_FAILED'],
      [{ prepareThrowAfter: true }, 'CYCLE_ENTRY_FAILED'],
    ]) {
      const h = makeHarness(scenario);
      const owner = h.markGenuine(recording(`recording-e5-${reason}`));
      expectReason(await h.entry.runRecordedCycle(entryInput(h, owner)), reason, reason);
      assert(owner.closed && owner.closeCounts.join(',') === '1,1'
        && h.calls.cycle === 0 && h.calls.raw === 0,
      `失败 cleanup/zero raw 错：${JSON.stringify({ scenario, calls: h.calls })}`);
    }
  });
}

await check('E6 production entry 静态只装 admission→adapter prepare→orchestrator façade', () => {
  assert(productionSource, '缺 replayability-cycle-entry production module');
  assert(/import\s*\{[^}]*\badmitRawReplayCapture\b[^}]*\}\s*from\s*['"]\.\/raw-capture\.mjs['"]/s
    .test(productionSource)
    && /import\s*\{[^}]*\bcanonicalRuntimeCycleAdapter\b[^}]*\}\s*from\s*['"]\.\/runtime-cycle-adapter\.mjs['"]/s
      .test(productionSource)
    && /import\s*\{[^}]*\brunTeachinReplayabilityCycle\b[^}]*\}\s*from\s*['"]\.\/dual-replay-orchestrator\.mjs['"]/s
      .test(productionSource),
  'entry 缺三个 canonical 静态依赖');
  assert(!/\b(?:admitAndRunRawReplay|runRawReplay|executeAuthorizedSourceReplay)\b/
    .test(productionSource),
  'entry 禁止自行执行 source raw');
  assert(/\bfinally\b/.test(productionSource)
    && /['"]close['"]/.test(productionSource)
    && /['"]disconnected['"]/.test(productionSource),
  'entry 必须以 lifecycle owner state/finally 做失败 cleanup，不能靠重复 close 宽容');
  assert(/\bcanonicalEntry\b[\s\S]*?\brunRecordedCycle\s*\(\s*input\s*\)/.test(
    productionSource,
  ), '公开入口必须只委托 module-scope canonicalEntry');
  assert(productionSource.trimEnd().split(/\r?\n/).length < 600,
    'production entry 必须 <600 行');
});

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
