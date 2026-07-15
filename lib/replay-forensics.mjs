// watchNetworkForensics —— CDP 真发起方归因取证（取证轴）。新建（autotester 无网络取证可借）。
// 护栏 #15：按发起方/本步归因，绝非时间窗；证不出一律归 null（fail-safe，背景轮询 401 永不翻本步 verdict）。
// 每条记录 { url, status, ts, initiator, attributedStepId, errorEnvelope, streamFinished?, streamStatus? }。
// 错误信封复用已冻 lib/forensics.checkErrorEnvelope（成功字段经通道剖面 --profile 传，site.json 凭据不进）。
import { checkErrorEnvelope } from './forensics.mjs';

// 任何 CDP 调用都套有界超时——getResponseBody 对流式/已逐出响应可能永不 resolve，会拖死 drain()。
const withTimeout = (pr, ms) => Promise.race([Promise.resolve(pr).catch(() => null), new Promise((r) => setTimeout(() => r(null), ms))]);

export function watchNetworkForensics(cdp, { denylist = [], successField, successValue, currentStep } = {}) {
  const byReq = new Map();
  const records = [];
  const pending = [];
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

  cdp.on('Network.loadingFailed', (e) => { inFlightApi.delete(e.requestId); });

  cdp.on('Network.loadingFinished', (e) => {
    const rec = byReq.get(e.requestId);
    if (!rec) return;
    inFlightApi.delete(e.requestId);
    // 只对前台 API（XHR/Fetch、非背景）取 body 算信封；SSE/导航/背景轮询一律跳过（避免 getResponseBody 挂死 + 无谓开销）。
    if (!(rec.type === 'XHR' || rec.type === 'Fetch') || isBg(rec.url)) return;
    const p = withTimeout(cdp.send('Network.getResponseBody', { requestId: e.requestId }), 1500)
      .then((r) => {
        if (!r) return;
        let text = r.body;
        if (r.base64Encoded) { try { text = Buffer.from(r.body, 'base64').toString('utf8'); } catch { text = ''; } }
        // 错误信封：仅当 body 是含成功字段的 JSON 才算；无字段 → null（无信封、不背书）。
        try {
          const obj = JSON.parse(text);
          if (obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, successField)) {
            rec.errorEnvelope = checkErrorEnvelope(obj, { successField, successValue });
          }
        } catch { /* 非 JSON */ }
      })
      .catch(() => { /* 取不到 body：信封留 null（证不出，不背书）*/ });
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
