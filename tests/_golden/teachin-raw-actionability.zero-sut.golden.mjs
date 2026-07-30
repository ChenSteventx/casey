#!/usr/bin/env node
// teachin-raw-actionability —— 点击可操作性闭包（GRILL v3「瘦身直修」）的红先行金牌。
// 判据唯一来源：docs/plans/teachin-raw-actionability-closure/GRILL.md（v3 D0-D5）与 plan.md（v3 §1-§2）。
//
// 零 SUT：纯内存 context/page 替身 + 真 page topology 控制器 + 真 canonical raw 驱动；
//   零 browser、零 network、零 LLM、零真实凭据、零真实地址、零 .auth 读取、零落盘、零 git 写。
//   （本金牌不碰 cycle-evidence 落盘层——那条路经 credentialGate 会读 .auth/site.json；
//    边车印证只用纯上下文层 runWithCycleEvidence/sealCycleEvidence。）
//
// 本金牌补的是全仓结构性缺口（GRILL D0b）：此前没有任何一枚金牌把
//   lib/page-topology/controller.mjs（真接缝）与 lib/teachin/raw-playwright-driver.mjs
//   （canonical raw 驱动）接起来跑，两枚冻结金牌的拓扑替身还返回了真控制器从不返回的
//   value 键——于是 raw 点击路的「正控」一直是假绿。
//
// 已实证根因（GRILL D0，探针留证 docs/plans/teachin-raw-actionability-closure/fix-probes/
//   probe-performclick-value.mjs）：真控制器 performClick 丢弃回调返回值、成功返回体无 value 键；
//   raw 驱动 :119 却以 `performed?.ok === true && performed.value === true` 判成败
//   → click/dblclick 在 raw 回放恒判失败，而物理点击已落地。fill/press 走 evaluateActive
//   （返回体有 value）故不受影响。
//
// 修前红绿预期（如实标注，红先行）：
//   · 红：G1a/G1b（真接合成功路）、G1d（seam 回退负控：真接缝路与 value 替身路结果必须全等）、
//     G1f（runner 两击全消费）、G1g（边车零拒付印证）；
//   · 绿：G1c（零 goto/零 force/active 不切）、G1e（动作抛错仍 fail-closed）、
//     G2a-G2d（真接缝返回形制事实 + 替身保真对账）、G3a/G3b/G3c（fill/press 与未知动作路）。
//   G1a 红的成因必须是 :119 的 value 判据——G2a 同时把「真控制器成功体无 value 键」钉成事实，
//   两钉合起来即「驱动的成功判定不得依赖 value 键」的双向证明。
//
// 生产件一字不动（本金牌只读生产件；修复由 plan v3 §1.1 单点落地）。

import { readFileSync } from 'node:fs';
import { deepStrictEqual } from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContextDouble } from './fixtures/page-topology-auth-continuity/context-double.mjs';

const TAG = 'teachin-raw-actionability';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

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

function sameShape(actual, expected, message) {
  try {
    deepStrictEqual(actual, expected);
  } catch {
    throw new Error(`${message}：实得 ${JSON.stringify(actual)} vs 期望 ${JSON.stringify(expected)}`);
  }
}

function exactKeys(value, keys) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
}

// —— 生产面导入（全部为现役件；缺席即整体红，各钉逐条红）——

let controllerApi = null;
let driverApi = null;
let ownerApi = null;
let targetApi = null;
let captureApi = null;
let freshApi = null;
let runnerApi = null;
let evidenceApi = null;
let importError = null;
try {
  [controllerApi, driverApi, ownerApi, targetApi,
    captureApi, freshApi, runnerApi, evidenceApi] = await Promise.all([
    import('../../lib/page-topology/controller.mjs'),
    import('../../lib/teachin/raw-playwright-driver.mjs'),
    import('../../lib/teachin/runtime-owner.mjs'),
    import('../../lib/execution-target/authority.mjs'),
    import('../../lib/teachin/raw-capture.mjs'),
    import('../../lib/teachin/fresh-runtime.mjs'),
    import('../../lib/teachin/raw-replay-runner.mjs'),
    import('../../lib/teachin/cycle-evidence-context.mjs'),
  ]);
} catch (error) {
  importError = error;
}

if (importError) {
  console.error(`RED  ${TAG}: 生产面导入失败：${String(importError?.message || importError).slice(-400)}`);
  process.exit(1);
}

const { createPageTopologyController } = controllerApi;
const { canonicalRawPlaywrightDriver } = driverApi;
const { projectTopologyAuthority } = ownerApi;
const { resolveExecutionTarget } = targetApi;
const { admitRawReplayCapture } = captureApi;
const { createFreshReplayWitness, authorizeFreshReplayRuntime } = freshApi;
const { runRawReplay } = runnerApi;
const {
  createCycleEvidenceCollector, runWithCycleEvidence, sealCycleEvidence,
} = evidenceApi;

for (const [name, fn] of Object.entries({
  createPageTopologyController,
  projectTopologyAuthority,
  resolveExecutionTarget,
  admitRawReplayCapture,
  createFreshReplayWitness,
  authorizeFreshReplayRuntime,
  runRawReplay,
  createCycleEvidenceCollector,
  runWithCycleEvidence,
  sealCycleEvidence,
})) {
  assert(typeof fn === 'function', `缺 frozen API ${name}`);
}
assert(canonicalRawPlaywrightDriver && typeof canonicalRawPlaywrightDriver === 'object',
  '缺 frozen API canonicalRawPlaywrightDriver');

// ══════════════════════════════════════════════════════════════════════
// 合成装具：地址、执行目标、page/context 替身、真控制器、两枚拓扑替身
// ══════════════════════════════════════════════════════════════════════

const ORIGIN = 'https://raw-actionability.invalid';
const HOME_URL = `${ORIGIN}/home`;
const CASE_ID = 'tc_raw_actionability';
const SELECTOR = '#go-next';

const EXECUTION = resolveExecutionTarget({
  runtime: { platform: 'linux', isWSL: false },
  logicalTarget: { startUrl: HOME_URL },
  transport: { mode: 'direct' },
  requiresOriginContinuity: true,
});
assert(EXECUTION?.ok === true && EXECUTION.authority,
  `合成 execution target authority 失败：${JSON.stringify(EXECUTION)}`);

// Playwright 风格 page 替身：满足真控制器的 isPage 闸（url/opener/on/isClosed），
// 另补 raw 驱动实际用到的 locator/mainFrame，并记全部物理动作实参（force 走私即可见）。
function createRawPageDouble({ name = 'page', url = HOME_URL, actions = {} } = {}) {
  const listeners = new Map();
  const physical = [];
  const stats = { locatorSelectors: [], countCalls: 0, gotoCalls: 0, forceCalls: 0 };
  let closed = false;
  const page = {};
  const node = { isConnected: true };
  const frame = { page: () => page };

  const record = (kind, options, extra = {}) => {
    if (options && options.force === true) stats.forceCalls += 1;
    physical.push({ kind, ...extra });
    const behavior = actions[kind];
    if (behavior === 'throw') {
      // 合成敌意异常：原文携假 selector 与假地址，任何外泄都会被公开面钉逮到。
      const error = new Error(`SYNTHETIC_FAILURE ${SELECTOR} ${ORIGIN}/fake-detail`);
      error.name = 'TimeoutError';
      throw error;
    }
    return undefined;
  };

  const handle = {
    async evaluate(fn, arg) {
      // 复刻 Playwright 的 handle→node 解包：句柄实参在浏览器侧变成 DOM 节点。
      const other = arg && typeof arg === 'object' && typeof arg.__nodeNow === 'function'
        ? arg.__nodeNow()
        : arg;
      return fn(node, other);
    },
    async ownerFrame() { return frame; },
    async click(options) { return record('click', options); },
    async dblclick(options) { return record('dblclick', options); },
    async fill(value, options) { return record('fill', options, { value }); },
    async press(key, options) { return record('press', options, { key }); },
  };
  Object.defineProperty(handle, '__nodeNow', {
    value: () => node, enumerable: false, writable: false, configurable: false,
  });

  const locator = {
    first() { return locator; },
    async waitFor() {},
    async count() { stats.countCalls += 1; return 1; },
    async elementHandle() { return handle; },
    async click(options) { return record('click', options); },
    async dblclick(options) { return record('dblclick', options); },
    async fill(value, options) { return record('fill', options, { value }); },
    async press(key, options) { return record('press', options, { key }); },
  };

  Object.assign(page, {
    name: String(name),
    physical,
    stats,
    locator(selector) {
      stats.locatorSelectors.push(selector);
      return locator;
    },
    mainFrame: () => frame,
    url() { return url; },
    async opener() { return null; },
    on(event, handler) {
      const list = listeners.get(event) || [];
      list.push(handler);
      listeners.set(event, list);
    },
    isClosed() { return closed; },
    async close() {
      if (closed) return;
      closed = true;
      for (const handler of listeners.get('close') || []) await handler();
    },
    async addInitScript() {},
    // 毒方法：raw 面任何分支都不得导航修正（护栏面，越界即可见）。
    async goto() { stats.gotoCalls += 1; throw new Error('RAW_NAV_MUST_NOT_GOTO'); },
  });
  return page;
}

let idOrdinal = 0;
// 真控制器（不是替身）：raw CLI 的接缝就是它，经 projectTopologyAuthority 原样转交。
async function realTopology({ actions = {} } = {}) {
  const page = createRawPageDouble({ name: `real-${idOrdinal}`, actions });
  const context = createContextDouble({ initialPages: [page] });
  const forensics = [];
  const started = await createPageTopologyController({
    context,
    initialPage: page,
    idFactory: () => `pg_raw_${idOrdinal += 1}`,
    attachForensics: async ({ pageId }) => { forensics.push(pageId); },
  });
  assert(started?.ok === true && started.controller && started.activePageAuthority,
    `真控制器应启动成功：${JSON.stringify(started)}`);
  return {
    page,
    context,
    forensics,
    controller: started.controller,
    activePageAuthority: started.activePageAuthority,
    // CLI 同款投影（bin/teachin-raw-replay.mjs:103）：只转交能力，不加任何键。
    topologyAuthority: projectTopologyAuthority(started.controller),
  };
}

// 保真替身（G2 对账基准）：逐条复刻真控制器的可观测语义——
// performClick 吞回调抛错、成功体无 value 键、键集与真控制器全等。
function fidelityTopologyDouble(page) {
  const authority = Object.freeze(Object.create(null));
  const deny = (reason) => Object.freeze({ ok: false, reason, verdictHint: 'NEEDS_HUMAN' });
  return Object.freeze({
    activePageAuthority: () => authority,
    async evaluateActive({ pageAuthority, evaluate } = {}) {
      if (pageAuthority !== authority) return deny('PAGE_AUTHORITY_STALE');
      if (typeof evaluate !== 'function') return Object.freeze({ ok: false, reason: 'PAGE_EVALUATION_INVALID' });
      try {
        return Object.freeze({ ok: true, reason: null, value: await evaluate(page) });
      } catch {
        return deny('PAGE_EVALUATION_FAILED');
      }
    },
    async performClick({ pageAuthority, perform } = {}) {
      if (pageAuthority !== authority) return deny('PAGE_AUTHORITY_STALE');
      if (typeof perform !== 'function') return Object.freeze({ ok: false, reason: 'PAGE_ACTION_INVALID' });
      let failed = false;
      try {
        // 回调返回值一律丢弃——这正是真控制器的行为，替身不得偷偷回传。
        await perform(page);
      } catch {
        failed = true;
      }
      if (failed) return deny('PAGE_ACTION_FAILED');
      return Object.freeze({
        ok: true,
        reason: null,
        handoff: Object.freeze({ kind: 'none', candidateCount: 0 }),
        activePageAuthority: authority,
      });
    },
    async consumeNewPageEvent() { return deny('TOPOLOGY_EVENT_INVALID'); },
  });
}

// 回退替身（只作 G1d 负控用，全金牌别处一律不用）：把真控制器从不返回的 value 键回填。
// 它存在的唯一意义是证明「驱动的成功判定不得对 value 键敏感」。
function legacyValueTopologyDouble(page) {
  const authority = Object.freeze(Object.create(null));
  return Object.freeze({
    activePageAuthority: () => authority,
    async evaluateActive({ pageAuthority, evaluate } = {}) {
      if (pageAuthority !== authority) return { ok: false, reason: 'PAGE_AUTHORITY_STALE' };
      try {
        return { ok: true, value: await evaluate(page) };
      } catch {
        return { ok: false, reason: 'PAGE_EVALUATION_FAILED' };
      }
    },
    async performClick({ pageAuthority, perform } = {}) {
      if (pageAuthority !== authority) return { ok: false, reason: 'PAGE_AUTHORITY_STALE' };
      try {
        return { ok: true, value: await perform(page) };
      } catch {
        return { ok: false, reason: 'PAGE_ACTION_FAILED' };
      }
    },
    async consumeNewPageEvent() { return { ok: false, reason: 'TOPOLOGY_EVENT_INVALID' }; },
  });
}

function driverEvent(action, extra = {}) {
  return Object.freeze({ action, path: '/home', fallbackCss: SELECTOR, ...extra });
}

// 真驱动的完整一步：resolve（铸一次性 authority）→ perform（消费）。
async function driveOnce(topologyAuthority, event) {
  const resolved = await canonicalRawPlaywrightDriver.resolve({
    event,
    topologyAuthority,
    executionTargetAuthority: EXECUTION.authority,
  });
  if (!resolved || resolved.resolution !== 'unique' || !resolved.actionAuthority) {
    return { resolved, performed: null };
  }
  const performed = await canonicalRawPlaywrightDriver.perform({
    actionAuthority: resolved.actionAuthority,
    topologyAuthority,
    executionTargetAuthority: EXECUTION.authority,
  });
  return { resolved, performed };
}

// ══════════════════════════════════════════════════════════════════════
// G1 seam 修复钉：真控制器 × canonical raw 驱动 真接合
// ══════════════════════════════════════════════════════════════════════

for (const action of ['click', 'dblclick']) {
  await check(`G1a 真接合正控：${action} 经真控制器成功且物理动作恰一次`, async () => {
    const topology = await realTopology();
    const { resolved, performed } = await driveOnce(topology.topologyAuthority, driverEvent(action));
    assert(resolved?.resolution === 'unique' && resolved.candidateCount === 1,
      `resolve 应 unique：${JSON.stringify(resolved)}`);
    assert(performed?.ok === true,
      `真控制器接真驱动的 ${action} 必须判成功（修前红：驱动 :119 以 performed.value 判据、`
      + `而真控制器成功体无 value 键）：${JSON.stringify(performed)}`);
    assert(performed?.identityReadback?.ok === true,
      `成功必须带真实 identityReadback：${JSON.stringify(performed)}`);
    assert(exactKeys(performed, ['ok', 'identityReadback']),
      `驱动成功返回键集不得漂移（消费者面不变）：${JSON.stringify(performed)}`);
    sameShape(topology.page.physical, [{ kind: action }],
      `${action} 物理动作必须恰一次且无多余动作`);
  });
}

await check('G1b 真接合成功路不切 active、零 goto、零 force、零地址外泄', async () => {
  const topology = await realTopology();
  const { performed } = await driveOnce(topology.topologyAuthority, driverEvent('click'));
  assert(topology.controller.activePageAuthority() === topology.activePageAuthority,
    '零新页的 click 不得切换 active page authority');
  assert(topology.page.stats.gotoCalls === 0, 'raw 面任何分支不得 goto');
  assert(topology.page.stats.forceCalls === 0, 'GRILL D5 红线：禁 force');
  assert(topology.page.stats.locatorSelectors.every((value) => value === SELECTOR),
    `locator selector 漂移：${JSON.stringify(topology.page.stats.locatorSelectors)}`);
  const text = JSON.stringify({ performed, forensics: topology.forensics });
  assert(!text.includes('raw-actionability.invalid') && !text.includes('://'),
    `公开面泄漏地址：${text}`);
});

await check('G1c 动作抛错仍 fail-closed：控制器吞成 ok:false，驱动判失败且不谎报 unique', async () => {
  const topology = await realTopology({ actions: { click: 'throw' } });
  const { performed } = await driveOnce(topology.topologyAuthority, driverEvent('click'));
  assert(performed?.ok === false && performed.reason === 'ACTION_FAILED',
    `动作抛错必须稳定失败：${JSON.stringify(performed)}`);
  assert(exactKeys(performed, ['ok', 'reason']),
    `失败返回键集不得漂移：${JSON.stringify(performed)}`);
  sameShape(topology.page.physical, [{ kind: 'click' }], '抛错路也只应尝试一次物理动作');
  const text = JSON.stringify(performed);
  assert(!text.includes('SYNTHETIC_FAILURE') && !text.includes('TimeoutError')
    && !text.includes(SELECTOR) && !text.includes('://'),
  `异常原文/selector/地址不得随失败轴外泄：${text}`);
});

await check('G1d seam 回退负控：驱动成败判定不得对 value 键敏感（真接缝路 = value 替身路）', async () => {
  const real = await realTopology();
  const realRun = await driveOnce(real.topologyAuthority, driverEvent('click'));
  const legacyPage = createRawPageDouble({ name: 'legacy-value' });
  const legacyRun = await driveOnce(legacyValueTopologyDouble(legacyPage), driverEvent('click'));
  sameShape(real.page.physical, [{ kind: 'click' }], '真接缝路物理动作应恰一次');
  sameShape(legacyPage.physical, [{ kind: 'click' }], 'value 替身路物理动作应恰一次');
  sameShape(realRun.performed, legacyRun.performed,
    '同一物理结果在「真控制器返回体」与「回填 value 键的替身返回体」下必须得出同一判定'
    + '（修前：真接缝路 ok:false、替身路 ok:true —— 这正是 GRILL D0b 的假绿源；'
    + '实现若回退成 value 判据，本钉当场再红）');
  assert(realRun.performed?.ok === true,
    `两路必须同为成功（物理动作确实落地）：${JSON.stringify(realRun.performed)}`);
});

await check('G1e runner 端到端：真控制器投影 + 真驱动，两击 capture 全消费出 CLEAN', async () => {
  const topology = await realTopology();
  const bytes = Buffer.from(`${JSON.stringify({
    schemaVersion: 1,
    artifactKind: 'teach-in-capture',
    caseId: CASE_ID,
    createdAt: '2026-07-30T00:00:00.000Z',
    startPath: '/home',
    source: { kind: 'manual', signed: false, replayReady: false, distillRequired: true },
    events: [
      { seq: 1, action: 'click', path: '/home', selector: SELECTOR, tagName: 'button' },
      { seq: 2, action: 'click', path: '/home', selector: SELECTOR, tagName: 'button' },
    ],
  }, null, 2)}\n`, 'utf8');
  const admitted = admitRawReplayCapture({ caseId: CASE_ID, captureBytes: bytes });
  assert(admitted?.ok === true && admitted.captureAuthority,
    `两击 capture 应准入：${JSON.stringify(admitted)}`);
  const result = await runRawReplay({
    captureAuthority: admitted.captureAuthority,
    freshRuntimeAuthority: mintFresh(topology.topologyAuthority),
    topologyAuthority: topology.topologyAuthority,
    executionTargetAuthority: EXECUTION.authority,
    actionDriver: canonicalRawPlaywrightDriver,
  });
  assert(result?.ok === true && result.status === 'CLEAN',
    `真机症状复刻面：两击 raw 闭环必须全消费（修前 seq 1 即 ACTION_FAILED）：${JSON.stringify(result)}`);
  assert(result.proof?.totalEvents === 2 && result.proof.consumedEvents === 2
    && result.proof.steps.every((step) => step.outcome === 'REPRODUCED'),
  `proof 消费计数不符：${JSON.stringify(result.proof)}`);
  sameShape(topology.page.physical, [{ kind: 'click' }, { kind: 'click' }],
    '两击应各恰一次物理动作，且不得重放第三次');
});

await check('G1f 边车印证（GRILL D4）：修后闭环零 raw-runner.event 拒付事件、边车形状零扩字段', async () => {
  const topology = await realTopology();
  const bytes = Buffer.from(`${JSON.stringify({
    schemaVersion: 1,
    artifactKind: 'teach-in-capture',
    caseId: CASE_ID,
    createdAt: '2026-07-30T00:00:00.000Z',
    startPath: '/home',
    source: { kind: 'manual', signed: false, replayReady: false, distillRequired: true },
    events: [
      { seq: 1, action: 'click', path: '/home', selector: SELECTOR, tagName: 'button' },
      { seq: 2, action: 'click', path: '/home', selector: SELECTOR, tagName: 'button' },
    ],
  }, null, 2)}\n`, 'utf8');
  const admitted = admitRawReplayCapture({ caseId: CASE_ID, captureBytes: bytes });
  assert(admitted?.ok === true, `capture 应准入：${JSON.stringify(admitted)}`);
  const collector = createCycleEvidenceCollector();
  const result = await runWithCycleEvidence(collector, () => runRawReplay({
    captureAuthority: admitted.captureAuthority,
    freshRuntimeAuthority: mintFresh(topology.topologyAuthority),
    topologyAuthority: topology.topologyAuthority,
    executionTargetAuthority: EXECUTION.authority,
    actionDriver: canonicalRawPlaywrightDriver,
  }));
  const snapshot = sealCycleEvidence(collector);
  assert(snapshot.poisoned === false, `边车不得毒化：${JSON.stringify(snapshot)}`);
  const rows = snapshot.events.filter((row) => row.refusalPoint === 'raw-runner.event');
  assert(rows.length === 2, `两击应各恰一条逐事件通报：${JSON.stringify(snapshot.events)}`);
  for (const row of rows) {
    assert(row.performOk === true && !('reason' in row),
      `修后闭环不得再有拒付事件（07-30 真机边车即 performOk:false）：${JSON.stringify(row)}`);
    assert(row.candidateCount === 1 && row.resolution === 'unique' && row.action === 'click',
      `逐事件动作轴失准：${JSON.stringify(row)}`);
    assert(exactKeys(row, ['refusalPoint', 'stage', 'seq', 'action', 'resolution',
      'candidateCount', 'performOk']),
    `边车 v1 形状不得被本契约扩字段（GRILL D4/D5）：${JSON.stringify(row)}`);
  }
  assert(result?.ok === true && result.status === 'CLEAN',
    `边车在场不得改变闭环结论：${JSON.stringify(result)}`);
});

// fresh runtime 授权：录制段真关闭 → 回放段对象归属，逐段用现役生产件铸权。
function mintFresh(topologyAuthority) {
  const emitter = (extra = {}) => {
    const listeners = new Map();
    return {
      ...extra,
      on(event, handler) {
        const list = listeners.get(event) || [];
        list.push(handler);
        listeners.set(event, list);
      },
      emit(event) {
        for (const handler of listeners.get(event) || []) handler();
      },
    };
  };
  let recordingConnected = true;
  const recordingBrowser = emitter({ isConnected: () => recordingConnected });
  const recordingContext = emitter({ browser: () => recordingBrowser });
  const witnessed = createFreshReplayWitness({ recordingBrowser, recordingContext });
  assert(witnessed?.ok === true && witnessed.witness,
    `fresh witness 创建失败：${JSON.stringify(witnessed)}`);
  recordingContext.emit('close');
  recordingConnected = false;
  recordingBrowser.emit('disconnected');
  const replayBrowser = emitter({ isConnected: () => true });
  const replayContext = emitter({ browser: () => replayBrowser });
  const replayPage = emitter({ context: () => replayContext, isClosed: () => false });
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

// ══════════════════════════════════════════════════════════════════════
// G2 保真对账钉：真控制器返回形制（事实冻结）与金牌替身逐键相等
// ══════════════════════════════════════════════════════════════════════

const PERFORM_CLICK_SUCCESS_KEYS = ['ok', 'reason', 'handoff', 'activePageAuthority'];
const EVALUATE_SUCCESS_KEYS = ['ok', 'reason', 'value'];

await check('G2a 真接缝事实：performClick 成功体键集恰四键且无 value 键、回调返回值被丢弃', async () => {
  const topology = await realTopology();
  let callbackReturned = 'CALLBACK_SENTINEL';
  const result = await topology.controller.performClick({
    pageAuthority: topology.activePageAuthority,
    perform: async () => callbackReturned,
  });
  assert(result?.ok === true, `零新页 click 应成功：${JSON.stringify(result)}`);
  assert(exactKeys(result, PERFORM_CLICK_SUCCESS_KEYS),
    `真控制器 performClick 成功体键集变了（接缝契约）：${Object.keys(result).join(',')}`);
  assert(!('value' in result),
    'performClick 从不回传回调值——任何以 value 判成败的消费者都对不上这条接缝');
  assert(!Object.values(result).includes(callbackReturned),
    `回调返回值不得经任何键回传：${JSON.stringify(result)}`);
  assert(result.reason === null && result.handoff?.kind === 'none'
    && result.handoff.candidateCount === 0,
  `零新页 handoff 形状不符：${JSON.stringify(result)}`);
});

await check('G2b 真接缝事实：performClick 吞回调抛错成闭合拒付、不外抛', async () => {
  const topology = await realTopology();
  let thrown = null;
  let result = null;
  try {
    result = await topology.controller.performClick({
      pageAuthority: topology.activePageAuthority,
      perform: async () => { throw new Error(`SYNTHETIC_FAILURE ${ORIGIN}/x`); },
    });
  } catch (error) {
    thrown = error;
  }
  assert(thrown === null, `performClick 不得把回调异常外抛：${String(thrown?.message || '')}`);
  assert(result?.ok === false && result.reason === 'PAGE_ACTION_FAILED'
    && result.verdictHint === 'NEEDS_HUMAN',
  `吞异常后的闭合拒付形状不符：${JSON.stringify(result)}`);
  assert(!JSON.stringify(result).includes('SYNTHETIC_FAILURE'), '拒付体不得回显异常原文');
});

await check('G2c 真接缝事实：evaluateActive 回传 value 且同样吞抛错（fill/press 路的分野）', async () => {
  const topology = await realTopology();
  const ok = await topology.controller.evaluateActive({
    pageAuthority: topology.activePageAuthority,
    evaluate: async () => true,
  });
  assert(exactKeys(ok, EVALUATE_SUCCESS_KEYS) && ok.ok === true && ok.value === true,
    `evaluateActive 成功体形状不符：${JSON.stringify(ok)}`);
  const failed = await topology.controller.evaluateActive({
    pageAuthority: topology.activePageAuthority,
    evaluate: async () => { throw new Error('SYNTHETIC_EVAL'); },
  });
  assert(failed?.ok === false && failed.reason === 'PAGE_EVALUATION_FAILED',
    `evaluateActive 吞抛错形状不符：${JSON.stringify(failed)}`);
});

await check('G2d 替身保真对账：本金牌保真替身与真控制器逐键相等（多 value 键即红）', async () => {
  const topology = await realTopology();
  const double = fidelityTopologyDouble(topology.page);
  const doubleAuthority = double.activePageAuthority();

  const realOk = await topology.controller.performClick({
    pageAuthority: topology.activePageAuthority,
    perform: async () => 'IGNORED',
  });
  const doubleOk = await double.performClick({
    pageAuthority: doubleAuthority,
    perform: async () => 'IGNORED',
  });
  sameShape(Object.keys(doubleOk).sort(), Object.keys(realOk).sort(),
    '保真替身 performClick 成功体键集必须与真控制器全等（多一枚 value 键即假绿源）');
  assert(!('value' in doubleOk), '保真替身不得回填 value 键');
  assert(doubleOk.ok === realOk.ok && doubleOk.reason === realOk.reason
    && doubleOk.handoff.kind === realOk.handoff.kind
    && doubleOk.handoff.candidateCount === realOk.handoff.candidateCount,
  `保真替身成功体取值与真控制器不一致：${JSON.stringify({ doubleOk, realOk })}`);

  const realFail = await topology.controller.performClick({
    pageAuthority: topology.activePageAuthority,
    perform: async () => { throw new Error('SYNTHETIC'); },
  });
  const doubleFail = await double.performClick({
    pageAuthority: doubleAuthority,
    perform: async () => { throw new Error('SYNTHETIC'); },
  });
  sameShape(doubleFail, realFail, '保真替身吞抛错后的拒付体必须与真控制器全等');

  // 负控：回填 value 键的替身必须与真控制器键集不等——这枚钉证明本对账有判别力。
  const legacy = legacyValueTopologyDouble(topology.page);
  const legacyOk = await legacy.performClick({
    pageAuthority: legacy.activePageAuthority(),
    perform: async () => true,
  });
  assert('value' in legacyOk && !exactKeys(legacyOk, PERFORM_CLICK_SUCCESS_KEYS),
    `回退替身必须被对账判为不保真（否则本钉零判别力）：${JSON.stringify(legacyOk)}`);
});

await check('G2e 换签面静态钉：两枚冻结金牌的拓扑替身不得再回填 value 键', () => {
  const targets = [
    'tests/_golden/teachin-replayability-action-authority.zero-sut.golden.mjs',
    'tests/_golden/teachin-clear-fill-admission.zero-sut.golden.mjs',
  ];
  for (const rel of targets) {
    const source = readFileSync(resolve(ROOT, rel), 'utf8');
    const blocks = source.split(/async performClick\s*\(/).slice(1);
    assert(blocks.length > 0, `${rel} 应仍含 performClick 拓扑替身（换签面）`);
    for (const block of blocks) {
      const body = block.slice(0, Math.max(block.indexOf('\n    },'), 0) || block.length);
      assert(!/value:\s*await\s+perform/.test(body),
        `${rel} 的 performClick 替身仍回填 value 键（GRILL D0b 的假绿源，须换签保真化）`);
    }
    assert(/PAGE_ACTION_FAILED/.test(source),
      `${rel} 的保真替身须复现真控制器的吞抛错拒付码 PAGE_ACTION_FAILED`);
  }
});

// ══════════════════════════════════════════════════════════════════════
// G3 fill/press 回归：evaluateActive 路行为不变（修前应绿）
// ══════════════════════════════════════════════════════════════════════

for (const [action, extra, expected] of [
  ['fill', { value: 'SYNTHETIC_INPUT' }, { kind: 'fill', value: 'SYNTHETIC_INPUT' }],
  ['fill', { value: '' }, { kind: 'fill', value: '' }],
  ['press', { key: 'Enter' }, { kind: 'press', key: 'Enter' }],
]) {
  await check(`G3a ${action} 经真控制器 evaluateActive 路成功且实参严格全等（${JSON.stringify(extra)}）`, async () => {
    const topology = await realTopology();
    const { performed } = await driveOnce(topology.topologyAuthority, driverEvent(action, extra));
    assert(performed?.ok === true && performed.identityReadback?.ok === true,
      `${action} 应成功（evaluateActive 路本契约零改动）：${JSON.stringify(performed)}`);
    sameShape(topology.page.physical, [expected], `${action} 物理实参必须严格全等且恰一次`);
    assert(topology.page.stats.forceCalls === 0 && topology.page.stats.gotoCalls === 0,
      `${action} 不得 force/goto`);
  });
}

await check('G3b fill 动作抛错仍 fail-closed（evaluateActive 吞抛错 → 驱动判失败）', async () => {
  const topology = await realTopology({ actions: { fill: 'throw' } });
  const { performed } = await driveOnce(topology.topologyAuthority,
    driverEvent('fill', { value: 'SYNTHETIC_INPUT' }));
  assert(performed?.ok === false && performed.reason === 'ACTION_FAILED',
    `fill 抛错必须稳定失败：${JSON.stringify(performed)}`);
  assert(!JSON.stringify(performed).includes('SYNTHETIC'), '失败轴不得回显异常原文');
});

await check('G3c 未知动作 fail-closed：闭包值非真即失败，且零物理动作', async () => {
  const topology = await realTopology();
  const { performed } = await driveOnce(topology.topologyAuthority, driverEvent('hover'));
  assert(performed?.ok === false && performed.reason === 'ACTION_FAILED',
    `未登记动作必须失败（act else 路返回 false，修后闭包值判据同样 fail-closed）：`
    + `${JSON.stringify(performed)}`);
  sameShape(topology.page.physical, [], '未知动作不得产生任何物理动作');
});

if (failures.length) {
  console.error(`\n${TAG}: ${passed} passed, ${failures.length} failed`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`\n${TAG}: ${passed} passed, 0 failed`);
