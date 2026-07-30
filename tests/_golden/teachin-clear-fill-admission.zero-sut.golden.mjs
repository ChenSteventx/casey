#!/usr/bin/env node
// teachin-clear-fill-admission：清空输入框的 fill 事件（目标值=空串）在录制投影、
// raw capture 准入、runner 与 canonical driver 全链的语义钉。纯内存、零 browser/SUT/network/LLM。
// 语义：真清空（原始值恰为空串）是合法回放目标值（fill('') 即清空）；缺 value 键/非 string
// 仍 fail-closed 拒；纯空白等「洗成空串」形态在投影层丢键、由准入拒付（codex r1 High 收紧，
// 防把原拒付形态洗成静默清空）；敏感遮值闸序先于值可用闸。
// 夹具形状取自真语料 seq 11 邻接结构（脱敏重表达）。
//
// 换签（teachin-raw-actionability-closure，GRILL v3 D2）：G6 的拓扑替身保真化——
// performClick 复现 lib/page-topology/controller.mjs 真实语义（丢弃回调返回值、成功体无 value 键、
// 吞回调抛错）。fill 走 evaluateActive 路，故本件判据与结论一字不变；新增 G6 夹具保真负控。
// 原件存档 teachin-clear-fill-admission.zero-sut.golden.mjs.pre-actionability-amendment.archive.gz。

const TAG = 'teachin-clear-fill-admission';
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

let recordApi;
let captureApi;
let actionApi;
let freshApi;
let runnerApi;
let driverApi;
let targetApi;
try {
  [recordApi, captureApi, actionApi, freshApi, runnerApi, driverApi, targetApi] = await Promise.all([
    import('../../lib/record-capture.mjs'),
    import('../../lib/teachin/raw-capture.mjs'),
    import('../../lib/teachin/raw-action.mjs'),
    import('../../lib/teachin/fresh-runtime.mjs'),
    import('../../lib/teachin/raw-replay-runner.mjs'),
    import('../../lib/teachin/raw-playwright-driver.mjs'),
    import('../../lib/execution-target/authority.mjs'),
  ]);
} catch {
  console.error(`RED  ${TAG}: frozen API import failed（实现模块尚未落地）`);
  process.exit(1);
}

const { sanitizeRecordEvent, buildTeachInCapture } = recordApi;
const { admitRawReplayCapture, inspectAdmittedRawReplayCapture } = captureApi;
const { projectRawReplayAction } = actionApi;
const { createFreshReplayWitness, authorizeFreshReplayRuntime } = freshApi;
const { runRawReplay } = runnerApi;
const { canonicalRawPlaywrightDriver } = driverApi;
const { resolveExecutionTarget } = targetApi;

for (const [name, fn] of Object.entries({
  sanitizeRecordEvent,
  buildTeachInCapture,
  admitRawReplayCapture,
  inspectAdmittedRawReplayCapture,
  projectRawReplayAction,
  createFreshReplayWitness,
  authorizeFreshReplayRuntime,
  runRawReplay,
  resolveExecutionTarget,
})) {
  assert(typeof fn === 'function', `缺 frozen API ${name}`);
}
assert(canonicalRawPlaywrightDriver && typeof canonicalRawPlaywrightDriver === 'object',
  '缺 frozen API canonicalRawPlaywrightDriver');

const CASE_ID = 'tc_clear_fill_case';

// 真语料 seq 11 邻接结构脱敏重表达：textarea 清空步的浏览器侧原始形状。
function rawClearFillEvent() {
  return {
    action: 'fill',
    path: '/home',
    selector: '#note-field',
    tagName: 'textarea',
    fieldLabel: '备注',
    type: 'textarea',
    value: '',
  };
}

function captureDoc(events) {
  return {
    schemaVersion: 1,
    artifactKind: 'teach-in-capture',
    caseId: CASE_ID,
    createdAt: '2026-07-29T09:00:00.000Z',
    startPath: '/home',
    source: {
      kind: 'manual',
      signed: false,
      replayReady: false,
      distillRequired: true,
    },
    events,
  };
}

function toBytes(doc) {
  return Buffer.from(JSON.stringify(doc, null, 2) + '\n', 'utf8');
}

function clickEvent(seq) {
  return { seq, action: 'click', path: '/home', selector: '#open-form', tagName: 'button' };
}

function filledEvent(seq, value) {
  const event = {
    seq,
    action: 'fill',
    path: '/home',
    selector: '#note-field',
    tagName: 'textarea',
    fieldLabel: '备注',
  };
  if (value !== undefined) event.value = value;
  return event;
}

await check('G1 投影：fill 原始空串必须保 value 键', () => {
  const out = sanitizeRecordEvent(rawClearFillEvent(), 0);
  assert('value' in out, `清空 fill 的 value 键被投影丢弃：${JSON.stringify(out)}`);
  assert(out.value === '', `清空 fill 的 value 应为空串：${JSON.stringify(out)}`);
  assert(out.action === 'fill' && out.seq === 1, `投影基本形状漂移：${JSON.stringify(out)}`);
});

await check('G1 投影：纯空白值仍丢键（洗空不得冒充清空，D4 收紧钉）', () => {
  const out = sanitizeRecordEvent({ ...rawClearFillEvent(), value: '   ' }, 0);
  assert(!('value' in out),
    `纯空白 fill 值不得保键放行：${JSON.stringify(out)}`);
});

await check('G1 投影：非 fill 动作空串 value 仍丢键', () => {
  const out = sanitizeRecordEvent({
    action: 'click', path: '/home', selector: '#open-form', tagName: 'button', value: '',
  }, 0);
  assert(!('value' in out), `click 的空串 value 不应保键：${JSON.stringify(out)}`);
});

await check('G1 投影：非 string fill value 丢键、不得 String() 强转洗白（codex code-r1 M1）', () => {
  for (const bad of [7, false, { evil: 1 }, ['a']]) {
    const out = sanitizeRecordEvent({ ...rawClearFillEvent(), value: bad }, 0);
    assert(!('value' in out),
      `非 string fill value 必须丢键（类型=${typeof bad}）：${JSON.stringify(out)}`);
  }
});

await check('G1 投影：敏感字段遮值分支不受影响', () => {
  const out = sanitizeRecordEvent({
    ...rawClearFillEvent(), fieldLabel: '新密码', value: '',
  }, 0);
  assert(out.value === '<redacted>' && out.valueMasked === true,
    `敏感字段空值仍须遮值：${JSON.stringify(out)}`);
});

await check('G1 端到端：buildTeachInCapture 保清空事件', () => {
  const doc = buildTeachInCapture({
    caseId: CASE_ID,
    startUrl: '/home',
    events: [
      { action: 'click', path: '/home', selector: '#open-form', tagName: 'button' },
      rawClearFillEvent(),
    ],
    createdAt: '2026-07-29T09:00:00.000Z',
  });
  const fill = doc.events[1];
  assert(fill && fill.action === 'fill' && 'value' in fill && fill.value === '',
    `capture 包应保清空事件的空串 value：${JSON.stringify(doc.events)}`);
});

await check('G2 准入：空串 fill 放行且字节往返不丢', () => {
  const bytes = toBytes(captureDoc([clickEvent(1), filledEvent(2, '')]));
  const admitted = admitRawReplayCapture({ caseId: CASE_ID, captureBytes: bytes });
  assert(admitted.ok === true,
    `空串 fill 应准入：${JSON.stringify(admitted)}`);
  assert(admitted.eventCount === 2, `eventCount 漂移：${JSON.stringify(admitted)}`);
  const inspected = inspectAdmittedRawReplayCapture({
    captureAuthority: admitted.captureAuthority,
  });
  assert(inspected.ok === true && inspected.capture.events[1].value === '',
    `准入后空串 value 必须原样可读：${JSON.stringify(inspected.capture?.events)}`);
});

await check('G2 准入：缺 value 键仍拒（真值丢失）', () => {
  const bytes = toBytes(captureDoc([clickEvent(1), filledEvent(2, undefined)]));
  const admitted = admitRawReplayCapture({ caseId: CASE_ID, captureBytes: bytes });
  assert(admitted.ok === false && admitted.reason === 'FILL_VALUE_UNAVAILABLE'
    && admitted.failedSeq === 2,
    `缺 value 键必须拒付 FILL_VALUE_UNAVAILABLE：${JSON.stringify(admitted)}`);
});

await check('G2 准入：value 非 string 仍拒', () => {
  const bytes = toBytes(captureDoc([clickEvent(1), filledEvent(2, 7)]));
  const admitted = admitRawReplayCapture({ caseId: CASE_ID, captureBytes: bytes });
  assert(admitted.ok === false && admitted.reason === 'FILL_VALUE_UNAVAILABLE'
    && admitted.failedSeq === 2,
    `非 string value 必须拒付 FILL_VALUE_UNAVAILABLE：${JSON.stringify(admitted)}`);
});

await check('G2 端到端：投影后的纯空白 fill 仍被准入拒付（fail-closed 钉）', () => {
  const doc = buildTeachInCapture({
    caseId: CASE_ID,
    startUrl: '/home',
    events: [
      { action: 'click', path: '/home', selector: '#open-form', tagName: 'button' },
      { ...rawClearFillEvent(), value: '   ' },
    ],
    createdAt: '2026-07-29T09:00:00.000Z',
  });
  const admitted = admitRawReplayCapture({
    caseId: CASE_ID,
    captureBytes: Buffer.from(JSON.stringify(doc, null, 2) + '\n', 'utf8'),
  });
  assert(admitted.ok === false && admitted.reason === 'FILL_VALUE_UNAVAILABLE',
    `纯空白经投影丢键后必须被准入拒付：${JSON.stringify(admitted)}`);
});

await check('G2 端到端：--from-events 形态的非 string fill value 全链拒付（codex code-r1 M1）', () => {
  for (const bad of [7, false, { evil: 1 }, ['a']]) {
    const doc = buildTeachInCapture({
      caseId: CASE_ID,
      startUrl: '/home',
      events: [
        { action: 'click', path: '/home', selector: '#open-form', tagName: 'button' },
        { ...rawClearFillEvent(), value: bad },
      ],
      createdAt: '2026-07-29T09:00:00.000Z',
    });
    const admitted = admitRawReplayCapture({
      caseId: CASE_ID,
      captureBytes: Buffer.from(JSON.stringify(doc, null, 2) + '\n', 'utf8'),
    });
    assert(admitted.ok === false && admitted.reason === 'FILL_VALUE_UNAVAILABLE',
      `非 string fill value（类型=${typeof bad}）不得被强转洗过准入：${JSON.stringify(admitted)}`);
  }
});

await check('G3 传导：空串 fill 投影动作请求不丢键', () => {
  const result = projectRawReplayAction(filledEvent(2, ''));
  assert(result.ok === true && result.kind === 'action',
    `空串 fill 应投影为动作请求：${JSON.stringify(result)}`);
  const request = result.actionRequest;
  assert(request.action === 'fill' && request.fallbackCss === '#note-field'
    && Object.prototype.hasOwnProperty.call(request, 'value') && request.value === '',
    `动作请求应带空串 value：${JSON.stringify(request)}`);
});

await check('G4 闸序：遮值闸先于值可用闸', () => {
  const masked = { ...filledEvent(2, undefined), valueMasked: true };
  const bytes = toBytes(captureDoc([clickEvent(1), masked]));
  const admitted = admitRawReplayCapture({ caseId: CASE_ID, captureBytes: bytes });
  assert(admitted.ok === false && admitted.reason === 'MASKED_FILL_UNREPLAYABLE',
    `遮蔽标记必须先于值可用判定：${JSON.stringify(admitted)}`);
  const redacted = toBytes(captureDoc([clickEvent(1), filledEvent(2, '<redacted>')]));
  const admittedRedacted = admitRawReplayCapture({ caseId: CASE_ID, captureBytes: redacted });
  assert(admittedRedacted.ok === false
    && admittedRedacted.reason === 'MASKED_FILL_UNREPLAYABLE',
    `规范遮蔽值必须整包拒：${JSON.stringify(admittedRedacted)}`);
});

// —— G5 装具：fresh runtime 与动作驱动替身（复刻 raw-actions P4 模式）——

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
  const witnessed = createFreshReplayWitness({ recordingBrowser, recordingContext });
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

await check('G5 runner 穿透：admit→runRawReplay 全链空串不丢', async () => {
  const bytes = toBytes(captureDoc([clickEvent(1), filledEvent(2, '')]));
  const admitted = admitRawReplayCapture({ caseId: CASE_ID, captureBytes: bytes });
  assert(admitted?.ok === true && admitted.captureAuthority,
    `空串 capture 应准入：${JSON.stringify(admitted)}`);

  const execution = resolveExecutionTarget({
    runtime: { platform: 'linux', isWSL: false },
    logicalTarget: { startUrl: 'https://clear-fill.invalid/home' },
    transport: { mode: 'direct' },
    requiresOriginContinuity: true,
  });
  assert(execution?.ok === true && execution.authority,
    `合成 execution authority 应成功：${JSON.stringify(execution)}`);

  const topologyAuthority = Object.freeze({
    activePageAuthority() {
      return Object.freeze(Object.create(null));
    },
  });
  const fresh = mintFresh(topologyAuthority);
  const requests = [];
  const actionGates = new WeakMap();
  const actionDriver = {
    async readActivePath() {
      return '/home';
    },
    async resolve({ event }) {
      requests.push(event);
      const actionAuthority = Object.freeze(Object.create(null));
      actionGates.set(actionAuthority, event);
      return { resolution: 'unique', candidateCount: 1, actionAuthority };
    },
    async perform({ actionAuthority }) {
      const request = actionGates.get(actionAuthority);
      assert(request, 'perform 必须消费对应 resolve 铸造的 authority');
      actionGates.delete(actionAuthority);
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
    `空串 fill raw replay 应 CLEAN：${JSON.stringify(result)}`);
  assert(requests.length === 2, `runner 请求数漂移：${JSON.stringify(requests)}`);
  const fill = requests[1];
  const keys = Object.keys(fill).sort().join(',');
  assert(keys === 'action,fallbackCss,value',
    `fill 请求 keys 不闭合：${keys}`);
  assert(fill.action === 'fill' && fill.fallbackCss === '#note-field'
    && Object.prototype.hasOwnProperty.call(fill, 'value') && fill.value === '',
    `runner 传导的 fill 请求必须精确含空串 value：${JSON.stringify(fill)}`);
});

// —— G6 装具：canonical driver 的页面/定位替身（裁剪 action-authority browserHarness）——

await check('G6 物理句柄：canonical driver 对 handle.fill 实参严格全等空串', async () => {
  const DRIVER_EVENT = Object.freeze({
    action: 'fill',
    path: '/home',
    fallbackCss: '#note-field',
    value: '',
  });
  const execution = resolveExecutionTarget({
    runtime: { platform: 'linux', isWSL: false },
    logicalTarget: { startUrl: 'https://clear-fill.invalid/home' },
    transport: { mode: 'direct' },
    requiresOriginContinuity: true,
  });
  assert(execution?.ok === true && execution.authority,
    `合成 execution authority 应成功：${JSON.stringify(execution)}`);

  const physical = [];
  const page = {};
  const state = { connected: true, count: 1, ownerPage: null };
  const frame = { page: () => state.ownerPage || page };
  const handle = {
    async evaluate() { return state.connected; },
    async ownerFrame() { return frame; },
    click: async () => { physical.push({ kind: 'click' }); },
    dblclick: async () => { physical.push({ kind: 'dblclick' }); },
    fill: async (value) => { physical.push({ kind: 'fill', value }); },
    press: async (key) => { physical.push({ kind: 'press', key }); },
  };
  const locator = {
    first() { return locator; },
    async waitFor() {},
    async count() { return state.count; },
    async elementHandle() { return handle; },
    click: handle.click,
    dblclick: handle.dblclick,
    fill: handle.fill,
    press: handle.press,
  };
  Object.assign(page, {
    locator(selector) {
      assert(selector === DRIVER_EVENT.fallbackCss, `locator selector 漂移：${selector}`);
      return locator;
    },
    mainFrame: () => frame,
    url: () => 'https://clear-fill.invalid/home',
    isClosed: () => false,
  });
  const pageAuthority = Object.freeze(Object.create(null));
  // 拓扑替身保真化（换签面，GRILL v3 D2）：复现冻结接缝 lib/page-topology/controller.mjs——
  // performClick 丢弃回调返回值、成功体无 value 键、吞回调抛错；只有 evaluateActive 回传 value。
  // 本件的 fill 路本就走 evaluateActive，故行为不变；改的是夹具保真度，不是判据。
  const STALE = Object.freeze({
    ok: false, reason: 'PAGE_AUTHORITY_STALE', verdictHint: 'NEEDS_HUMAN',
  });
  const topology = Object.freeze({
    activePageAuthority: () => pageAuthority,
    async evaluateActive({ pageAuthority: actual, evaluate }) {
      if (actual !== pageAuthority) return STALE;
      try {
        return Object.freeze({ ok: true, reason: null, value: await evaluate(page) });
      } catch {
        return Object.freeze({
          ok: false, reason: 'PAGE_EVALUATION_FAILED', verdictHint: 'NEEDS_HUMAN',
        });
      }
    },
    async performClick({ pageAuthority: actual, perform }) {
      if (actual !== pageAuthority) return STALE;
      let performFailed = false;
      try {
        await perform(page);
      } catch {
        performFailed = true;
      }
      if (performFailed) {
        return Object.freeze({
          ok: false, reason: 'PAGE_ACTION_FAILED', verdictHint: 'NEEDS_HUMAN',
        });
      }
      return Object.freeze({
        ok: true,
        reason: null,
        handoff: Object.freeze({ kind: 'none', candidateCount: 0 }),
        activePageAuthority: pageAuthority,
      });
    },
    async consumeNewPageEvent() {
      return Object.freeze({ ok: false, reason: 'TOPOLOGY_EVENT_INVALID' });
    },
  });

  const resolved = await canonicalRawPlaywrightDriver.resolve({
    event: DRIVER_EVENT,
    topologyAuthority: topology,
    executionTargetAuthority: execution.authority,
  });
  assert(resolved && resolved.resolution === 'unique' && resolved.candidateCount === 1
    && resolved.actionAuthority,
    `driver resolve 应 unique：${JSON.stringify(resolved)}`);
  const done = await canonicalRawPlaywrightDriver.perform({
    actionAuthority: resolved.actionAuthority,
    topologyAuthority: topology,
    executionTargetAuthority: execution.authority,
  });
  assert(done?.ok === true,
    `driver perform 应成功：${JSON.stringify(done)}`);
  const fills = physical.filter((entry) => entry.kind === 'fill');
  assert(fills.length === 1 && fills[0].value === '' && typeof fills[0].value === 'string',
    `handle.fill 必须恰好收到一次严格空串：${JSON.stringify(physical)}`);

  // —— G6 夹具保真负控（换签面，GRILL v3 D2/D0b）——
  // 替身回填真控制器从不返回的 value 键即红：那正是把 raw 点击路正控养成假绿的机制。
  const keys = (value) => Object.keys(value).sort().join(',');
  const sentinel = 'CALLBACK_RETURN_SENTINEL';
  const clicked = await topology.performClick({
    pageAuthority,
    perform: async () => sentinel,
  });
  assert(keys(clicked) === 'activePageAuthority,handoff,ok,reason',
    `performClick 成功体键集须与冻结接缝全等：${keys(clicked)}`);
  assert(!('value' in clicked) && !Object.values(clicked).includes(sentinel),
    `替身不得回传回调值（真控制器丢弃它）：${JSON.stringify(clicked)}`);
  let escaped = null;
  let swallowed = null;
  try {
    swallowed = await topology.performClick({
      pageAuthority,
      perform: async () => { throw new Error('PRIVATE_ACTION_DETAIL'); },
    });
  } catch (error) {
    escaped = error;
  }
  assert(escaped === null, 'performClick 须吞回调抛错、不外抛');
  assert(swallowed?.ok === false && swallowed.reason === 'PAGE_ACTION_FAILED'
    && !JSON.stringify(swallowed).includes('PRIVATE'),
  `吞抛错后的闭合拒付形状不符：${JSON.stringify(swallowed)}`);
  const evaluated = await topology.evaluateActive({ pageAuthority, evaluate: async () => true });
  assert(keys(evaluated) === 'ok,reason,value' && evaluated.value === true,
    `只有 evaluateActive 回传 value（fill 路正因此不受 seam 缺陷影响）：${JSON.stringify(evaluated)}`);
});

if (failures.length) {
  console.error(`\n${TAG}: ${passed} passed, ${failures.length} failed`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`\n${TAG}: ${passed} passed, 0 failed`);
