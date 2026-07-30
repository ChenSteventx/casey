#!/usr/bin/env node
// M1 时序等价探针（合成三形态对照）。零 SUT、零 fs、零 network。
//
// 对照物（逐一复刻 replay-completion 的吞异常位形状）：
//   BASE    —— 取证边车落地之前的原形态：try { await call() } catch { return denied }
//   WRAPPED —— 被 codex code-r1 M1 判不等价的形态：多套一层 async reportedCall
//   FIXED   —— 本轮修法：catch (error) 内同步 safeEmit 后原样 return denied
//
// 两轴测量（仿 codex 实测口径）：
//   ① 微任务时序：调用方在 call 内 queueMicrotask 一枚标记，与 await 之后的第一条
//      语句（production 的 exactKeys/reportRefusal 位）比先后——settled→queued 还是 queued→settled；
//   ② 同步异常栈：call 同步抛时 catch 到的 error.stack 帧数与是否多出包裹帧。
//
// 判据：FIXED 与 BASE 两轴全等 = 修复合格；WRAPPED 与 BASE 不等 = 复现 codex 原判。

const DENIED = 'DENIED';
const RESULT = { ok: true };

// 取证旁路替身：同步、零返回值、吞异常——与生产 safeEmit 契约同形。
const emitted = [];
function safeEmitDouble(point, payload) {
  try {
    emitted.push({ point, errorName: payload?.errorName });
  } catch { /* 取证故障绝不回流生产路径 */ }
}

// WRAPPED 形态复刻：被判不等价的 async 包裹。
async function reportedCall(call, point) {
  try {
    return await call();
  } catch (error) {
    safeEmitDouble(point, { errorName: error?.name });
    throw error;
  }
}

async function baseSite(call, order) {
  let result;
  try {
    result = await call();
  } catch {
    return DENIED;
  }
  order.push('settled');
  return result;
}

async function wrappedSite(call, order) {
  let result;
  try {
    result = await reportedCall(call, 'source-completion.issuer-throw');
  } catch {
    return DENIED;
  }
  order.push('settled');
  return result;
}

async function fixedSite(call, order) {
  let result;
  try {
    result = await call();
  } catch (error) {
    safeEmitDouble('source-completion.issuer-throw', { errorName: error?.name });
    return DENIED;
  }
  order.push('settled');
  return result;
}

const SITES = [['BASE', baseSite], ['WRAPPED', wrappedSite], ['FIXED', fixedSite]];

// 微任务世代计数器：自排队的 queueMicrotask 每轮 +1，于是任何回调都能读出
// 「自本轮起第几代微任务」——比单纯比一对标记的先后更钝感、更可复核。
function microtaskTicker() {
  let generation = 0;
  let stopped = false;
  const pump = () => {
    if (stopped) return;
    generation += 1;
    queueMicrotask(pump);
  };
  queueMicrotask(pump);
  return {
    read: () => generation,
    stop: () => { stopped = true; },
  };
}

// ① 微任务时序：量「await 之后的第一条语句（production 的 exactKeys/reportRefusal 位）
// 落在第几代微任务」。同步返回与 async 返回两种 issuer 形态都量：issuer 合同不强制 async，
// 同步返回那一路对多套一层 await 最敏感（codex 实测的 settled/queued 顺序翻转即出在这里）。
async function measureOrder(site, { asyncIssuer }) {
  const ticker = microtaskTicker();
  const marks = [];
  const order = { push: (mark) => marks.push(`${mark}@gen${ticker.read()}`) };
  const call = asyncIssuer ? async () => RESULT : () => RESULT;
  await site(call, order);
  ticker.stop();
  return marks.join(',') || 'none';
}

// ② 同步异常栈：call 同步抛，量 catch 到的栈帧数与包裹帧是否在场。
async function measureStack(site) {
  let captured = null;
  const call = () => {
    const error = new TypeError('probe');
    captured = error;
    throw error;
  };
  const returned = await site(call, []);
  const frames = String(captured?.stack || '').split('\n').slice(1)
    .map((row) => row.trim()).filter(Boolean);
  return {
    returned,
    frameCount: frames.length,
    hasWrapperFrame: frames.some((row) => row.includes('reportedCall')),
    topFrames: frames.slice(0, 3),
  };
}

const measured = {};
for (const [label, site] of SITES) {
  emitted.length = 0;
  const syncIssuerOrder = await measureOrder(site, { asyncIssuer: false });
  emitted.length = 0;
  const asyncIssuerOrder = await measureOrder(site, { asyncIssuer: true });
  emitted.length = 0;
  const stack = await measureStack(site);
  measured[label] = {
    microtaskOrder: `sync:${syncIssuerOrder} | async:${asyncIssuerOrder}`,
    ...stack,
    emitted: emitted.slice(),
  };
}

const base = measured.BASE;
const wrapped = measured.WRAPPED;
const fixed = measured.FIXED;

function axesEqual(a, b) {
  return a.microtaskOrder === b.microtaskOrder
    && a.frameCount === b.frameCount
    && a.hasWrapperFrame === b.hasWrapperFrame
    && a.returned === b.returned;
}

const fixedEqualsBase = axesEqual(fixed, base);
const wrappedDiffersFromBase = !axesEqual(wrapped, base);
// 修后必须仍真通报：等价不许靠「不发射」换来。
const fixedStillReports = fixed.emitted.length === 1
  && fixed.emitted[0].point === 'source-completion.issuer-throw'
  && fixed.emitted[0].errorName === 'TypeError';

console.log(JSON.stringify({
  measured,
  verdict: { fixedEqualsBase, wrappedDiffersFromBase, fixedStillReports },
}, null, 2));

if (!fixedEqualsBase) {
  console.error('PROBE_RED: FIXED 与 BASE 两轴不等价');
  process.exit(1);
}
if (!wrappedDiffersFromBase) {
  console.error('PROBE_RED: WRAPPED 未复现出与 BASE 的差异（对照失效，判据不成立）');
  process.exit(1);
}
if (!fixedStillReports) {
  console.error('PROBE_RED: FIXED 形态没有真通报，等价不算数');
  process.exit(1);
}
console.log('PROBE_GREEN: FIXED≡BASE（微任务时序与异常栈两轴全等）且仍真通报；WRAPPED≠BASE 复现原判');
