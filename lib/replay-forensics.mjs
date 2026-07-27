// watchNetworkForensics —— CDP 真发起方归因取证（取证轴）。新建（autotester 无网络取证可借）。
// 护栏 #15：按发起方/本步归因，绝非时间窗；证不出一律归 null（fail-safe，背景轮询 401 永不翻本步 verdict）。
// 每条记录 { url, status, ts, initiator, attributedStepId, errorEnvelope, streamFinished?, streamStatus? }。
// 错误信封复用已冻 lib/forensics.checkErrorEnvelope（成功字段经通道剖面 --profile 传，site.json 凭据不进）。
import { checkErrorEnvelope } from './forensics.mjs';

// 任何 CDP 调用都套有界超时——getResponseBody 对流式/已逐出响应可能永不 resolve，会拖死 drain()。
const withTimeout = (pr, ms) => Promise.race([Promise.resolve(pr).catch(() => null), new Promise((r) => setTimeout(() => r(null), ms))]);

// ── 身份通道纯函数面（agent-id-readback；导出供零 SUT 金牌钉验，watchNetworkForensics 内联消费）──
const IDENTITY_BODY_MAX = 256 * 1024;
const walkIdentityPath = (obj, dotted) => String(dotted).split('.').reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), obj);

// 请求准入判据（codex R1-H2）：同源（sutOrigin 精确等）+ method + 规范化 pathname 精确等 + 按剖面
// queryParam 提取查询回声。任一不符回 null（不入身份通道）；url 不可解析同 null（fail-safe）。
export function matchIdentityRequest(url, method, { channel, sutOrigin } = {}) {
  if (!channel || typeof channel !== 'object') return null;
  let parsed = null;
  try { parsed = new URL(url); } catch { return null; }
  if (typeof sutOrigin !== 'string' || sutOrigin === '' || parsed.origin !== sutOrigin) return null;
  if (method !== channel.method) return null;
  if (parsed.pathname !== channel.pathname) return null;
  return {
    urlPathname: parsed.pathname,
    urlOrigin: parsed.origin,
    queryEcho: typeof channel.queryParam === 'string' && channel.queryParam !== ''
      ? parsed.searchParams.get(channel.queryParam)
      : null,
  };
}

// 响应投影判据（codex R1-H4）：HTTP 只认明确成功态（2xx）；剖面 successField 在响应体内在场时
// 必须严格等于 successValue，否则 failed——HTTP 200 的 API 失败信封绝不得当成功身份页消费。
export function projectIdentityEnvelope(text, status, { channel, successField, successValue } = {}) {
  if (!Number.isInteger(status) || status < 200 || status >= 300) return { kind: 'failed' };
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > IDENTITY_BODY_MAX) return { kind: 'invalid' };
  let obj = null;
  try { obj = JSON.parse(text); } catch { return { kind: 'invalid' }; }
  if (successField != null && obj && typeof obj === 'object' && !Array.isArray(obj)
    && Object.prototype.hasOwnProperty.call(obj, successField) && obj[successField] !== successValue) {
    return { kind: 'failed' };
  }
  const rawRows = walkIdentityPath(obj, channel.recordsPath);
  const total = walkIdentityPath(obj, channel.totalPath);
  if (!Array.isArray(rawRows)) return { kind: 'invalid' };
  const f = channel.fields;
  const rows = rawRows.map((row) => (row && typeof row === 'object' && !Array.isArray(row)
    ? { id: row[f.id], code: row[f.code], name: row[f.name] }
    : { id: null, code: null, name: null }));
  const out = { kind: 'parsed', rows, total };
  if (channel.hasNextPath != null) out.hasNext = walkIdentityPath(obj, channel.hasNextPath);
  return out;
}

export function watchNetworkForensics(cdp, {
  denylist = [],
  successField,
  successValue,
  currentStep,
  identityChannel,
  identitySequence,
} = {}) {
  const byReq = new Map();
  const records = [];
  const pending = [];
  // 身份通道（agent-id-readback；剖面声明制）：未声明=一切照旧零行为差。声明时只对
  // 同源+method+规范化 pathname+查询参数命中的请求投影有界三元组喂外部账本回调；完整响应体
  // 仅瞬时解析、不进 records（数据最小化，sol P1-6）。不静态引入身份模块（毒探针面）。
  const idSeqByRequestId = new Map();
  let idSeqCounter = 0;
  const nextIdentitySequence = typeof identitySequence === 'function'
    ? identitySequence
    : () => {
      idSeqCounter += 1;
      return idSeqCounter;
    };
  const projectIdentityOutcome = (text, status) => projectIdentityEnvelope(text, status, {
    channel: identityChannel, successField, successValue,
  });
  let streamOpen = 0;        // 在途 SSE 流计数（finished 前）
  const settleWaiters = [];  // 等所有流 finished 的 resolver
  const inFlightApi = new Set(); // 在途前台 API 请求（requestWillBeSent 到 loadingFinished/Failed 之间），drain 据此等齐
  const isBg = (url) => denylist.some((d) => url.includes(d));

  cdp.on('Network.requestWillBeSent', (e) => {
    const url = e.request.url;
    const firing = currentStep ? currentStep() : null;
    const initiator = (e.initiator && e.initiator.type) || null;
    const type = e.type || null;
    // 正向归因：仅 script/XHR/Fetch/EventSource 这类用户动作触发的 API 才系到本步；
    // 背景 denylist、文档导航、非脚本发起、无活动步 → 一律 null（默认 null 是 fail-safe 物理落点，绝不默认成最近步）。
    if (type === 'EventSource') streamOpen++;
    if ((type === 'XHR' || type === 'Fetch') && !isBg(url)) inFlightApi.add(e.requestId);
    const isApi = type === 'XHR' || type === 'Fetch' || type === 'EventSource' || (initiator === 'script' && type !== 'Document');
    const attributedStepId = isBg(url) || !firing || !isApi ? null : firing;
    const rec = { requestId: e.requestId, url, method: e.request.method, status: null, ts: e.timestamp, initiator, type, firingStepId: firing, attributedStepId, errorEnvelope: null, streamFinished: undefined, streamStatus: undefined };
    byReq.set(e.requestId, rec);
    records.push(rec);
    if (identityChannel) {
      const matched = matchIdentityRequest(url, rec.method, { channel: identityChannel, sutOrigin: identityChannel.sutOrigin });
      if (matched) {
        const requestSeq = nextIdentitySequence();
        idSeqByRequestId.set(e.requestId, requestSeq);
        identityChannel.onRequest({ requestSeq, method: rec.method, ...matched });
      }
    }
  });

  cdp.on('Network.responseReceived', (e) => {
    const rec = byReq.get(e.requestId);
    if (rec) rec.status = e.response.status;
  });

  // SSE finished 静默点：流末 finished 消息（可靠，不依赖 getResponseBody 对流式的缓冲）。
  cdp.on('Network.eventSourceMessageReceived', (e) => {
    const rec = byReq.get(e.requestId);
    if (rec && e.eventName === 'finished') {
      rec.streamFinished = true;
      try { rec.streamStatus = JSON.parse(e.data).status; } catch { rec.streamStatus = null; }
      streamOpen = Math.max(0, streamOpen - 1);
      if (streamOpen === 0) settleWaiters.splice(0).forEach((r) => r());
    }
  });

  cdp.on('Network.loadingFailed', (e) => {
    inFlightApi.delete(e.requestId);
    if (identityChannel && idSeqByRequestId.has(e.requestId)) {
      identityChannel.onTerminal({ requestSeq: idSeqByRequestId.get(e.requestId), outcome: { kind: 'failed' } });
    }
  });

  cdp.on('Network.loadingFinished', (e) => {
    const rec = byReq.get(e.requestId);
    if (!rec) return;
    inFlightApi.delete(e.requestId);
    // 只对前台 API（XHR/Fetch、非背景）取 body 算信封；SSE/导航/背景轮询一律跳过（避免 getResponseBody 挂死 + 无谓开销）。
    if (!(rec.type === 'XHR' || rec.type === 'Fetch') || isBg(rec.url)) return;
    const idSeqNo = identityChannel ? idSeqByRequestId.get(e.requestId) : undefined;
    const p = withTimeout(cdp.send('Network.getResponseBody', { requestId: e.requestId }), 1500)
      .then((r) => {
        if (!r) {
          if (idSeqNo !== undefined) identityChannel.onTerminal({ requestSeq: idSeqNo, outcome: { kind: 'timeout' } });
          return;
        }
        let text = r.body;
        if (r.base64Encoded) { try { text = Buffer.from(r.body, 'base64').toString('utf8'); } catch { text = ''; } }
        // 错误信封：仅当 body 是含成功字段的 JSON 才算；无字段 → null（无信封、不背书）。
        try {
          const obj = JSON.parse(text);
          if (obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, successField)) {
            rec.errorEnvelope = checkErrorEnvelope(obj, { successField, successValue });
          }
        } catch { /* 非 JSON */ }
        if (idSeqNo !== undefined) identityChannel.onTerminal({ requestSeq: idSeqNo, outcome: projectIdentityOutcome(text, rec.status) });
      })
      .catch(() => {
        if (idSeqNo !== undefined) identityChannel.onTerminal({ requestSeq: idSeqNo, outcome: { kind: 'failed' } });
      });
    pending.push(p);
  });

  return {
    records: () => records,
    // 在途前台 API 计数（replay-settle-mount 判据 A 加性暴露）：denylist 背景轮询本就不进 inFlightApi，
    // 绝不把本步拖死；纯观察者，既有键零动。
    inFlightCount: () => inFlightApi.size,
    // 等在途 SSE 流走到 finished（静默点 = 流 finished，非 networkidle）。先给 120ms 让流出现（EventSource 在 click handler 异步段才建）。
    awaitStreamsSettled: (ms) => new Promise((resolve) => {
      setTimeout(() => {
        if (streamOpen === 0) return resolve();
        const t = setTimeout(resolve, ms);
        settleWaiters.push(() => { clearTimeout(t); resolve(); });
      }, 120);
    }),
    drain: async () => {
      // 先等在途前台 API 落到 loadingFinished/Failed（有界）——避免 loadingFinished 晚于 drain、
      // body 读取 promise 还没 push 进 pending 就被略过、errorEnvelope 漏算（finding 8）。
      const start = Date.now();
      while (inFlightApi.size > 0 && Date.now() - start < 2500) { await new Promise((r) => setTimeout(r, 30)); }
      await withTimeout(Promise.allSettled(pending), 4000);
    },
  };
}

export async function attachPageForensics({
  context,
  page,
  options,
  pageErrors,
} = {}) {
  if (!context || typeof context.newCDPSession !== 'function'
    || !page || typeof page.on !== 'function') {
    return Object.freeze({ ok: false, reason: 'PAGE_FORENSICS_ATTACH_FAILED' });
  }
  let cdp;
  try {
    cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
  } catch {
    return Object.freeze({ ok: false, reason: 'PAGE_FORENSICS_ATTACH_FAILED' });
  }
  page.on('pageerror', (error) => {
    if (!Array.isArray(pageErrors)) return;
    pageErrors.push({
      attributedStepId: options?.currentStep?.() ?? null,
      message: String(error?.message || error).slice(0, 200),
    });
  });
  return Object.freeze({
    ok: true,
    reason: null,
    watcher: watchNetworkForensics(cdp, options),
  });
}

export function createPageForensicsHub({
  context,
  options = {},
  pageErrors,
} = {}) {
  const watchers = [];
  const attached = new WeakSet();
  let identitySequence = 0;
  const sharedOptions = {
    ...options,
    identitySequence: () => {
      identitySequence += 1;
      return identitySequence;
    },
  };
  const attachForensics = async ({ page } = {}) => {
    if (!page || typeof page !== 'object' || attached.has(page)) return;
    const attachedPage = await attachPageForensics({
      context,
      page,
      options: sharedOptions,
      pageErrors,
    });
    if (!attachedPage.ok) {
      const failure = new Error('PAGE_FORENSICS_ATTACH_FAILED');
      failure.reason = 'PAGE_FORENSICS_ATTACH_FAILED';
      throw failure;
    }
    attached.add(page);
    watchers.push(attachedPage.watcher);
  };
  return Object.freeze({
    attachPageForensics: attachForensics,
    forensics: Object.freeze({
      records: () => watchers.flatMap((watcher) => watcher.records()),
      inFlightCount: () => watchers.reduce(
        (total, watcher) => total + watcher.inFlightCount(),
        0,
      ),
      awaitStreamsSettled: async (ms) => {
        await Promise.all(watchers.map(
          (watcher) => watcher.awaitStreamsSettled(ms),
        ));
      },
      drain: async () => {
        await Promise.all(watchers.map((watcher) => watcher.drain()));
      },
    }),
  });
}
