// 原生 CEF/CDP 传输基座：只连回环代理；唯一目标；固定错误码；地址与 CDP 错误体不外泄。
const fail = (code) => new Error(code);
const positiveMs = (value, fallback) => Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
const isLoopback = (host) => host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
const SENSITIVE_QUERY_KEY = /(?:auth|bearer|cookie|credential|key|pass|secret|session|token)/i;

function parseLoopback(value, schemes, code) {
  let url;
  try { url = new URL(value); } catch { throw fail(code); }
  if (!schemes.includes(url.protocol) || !isLoopback(url.hostname) || url.username || url.password || url.hash) throw fail(code);
  return url;
}

function withTimeout(promise, ms, code) {
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => { timer = setTimeout(() => reject(fail(code)), ms); }),
  ]).finally(() => clearTimeout(timer));
}

function matcher(pattern) {
  if (pattern == null || pattern === '') return () => true;
  try {
    const re = pattern instanceof RegExp ? pattern : new RegExp(pattern);
    return (value) => { re.lastIndex = 0; return re.test(value); };
  } catch { throw fail('CEF_TARGET_FILTER_INVALID'); }
}

export function projectCefUrl(value) {
  try {
    const url = new URL(value);
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) return '<redacted:non-http-url>';
    for (const key of url.searchParams.keys()) if (SENSITIVE_QUERY_KEY.test(key)) return '<redacted:sensitive-url>';
    return `${url.pathname}${url.search}`;
  } catch { return '<redacted:invalid-url>'; }
}

export async function discoverCefTarget(baseUrl, {
  fetchImpl = globalThis.fetch,
  titlePattern,
  pathPattern,
  timeoutMs = 3000,
} = {}) {
  const base = parseLoopback(baseUrl, ['http:', 'https:'], 'CEF_BASE_NOT_LOOPBACK');
  if (typeof fetchImpl !== 'function') throw fail('CEF_FETCH_UNAVAILABLE');
  const titleMatches = matcher(titlePattern);
  const pathMatches = matcher(pathPattern);
  const listUrl = new URL('/json/list', base);
  let response;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  try { response = await withTimeout(fetchImpl(listUrl.href, controller ? { signal: controller.signal } : undefined), positiveMs(timeoutMs, 3000), 'CEF_TARGET_TIMEOUT'); }
  catch (e) {
    if (controller) controller.abort();
    if (e && e.message === 'CEF_TARGET_TIMEOUT') throw e;
    throw fail('CEF_TARGET_DISCOVERY_FAILED');
  }
  if (!response || response.ok !== true || typeof response.json !== 'function') {
    if (controller) controller.abort();
    throw fail('CEF_TARGET_DISCOVERY_FAILED');
  }
  let rows;
  try { rows = await withTimeout(response.json(), positiveMs(timeoutMs, 3000), 'CEF_TARGET_TIMEOUT'); }
  catch (e) { if (e && e.message === 'CEF_TARGET_TIMEOUT') throw e; throw fail('CEF_TARGET_RESPONSE_INVALID'); }
  finally { if (controller) controller.abort(); }
  if (!Array.isArray(rows)) throw fail('CEF_TARGET_RESPONSE_INVALID');
  const candidates = [];
  for (const row of rows) {
    if (!row || row.type !== 'page' || typeof row.id !== 'string' || typeof row.title !== 'string' || typeof row.url !== 'string' || typeof row.webSocketDebuggerUrl !== 'string') continue;
    const path = projectCefUrl(row.url);
    if (path.startsWith('<redacted:') || !titleMatches(row.title) || !pathMatches(path)) continue;
    let remoteWs;
    try { remoteWs = new URL(row.webSocketDebuggerUrl); } catch { continue; }
    // 标准 DevTools target 不需要 query/hash。复制它们会把发现端给出的会话秘密
    // 带进公开 target 对象和日志面；无法证明安全时直接排除该候选。
    if (!['ws:', 'wss:'].includes(remoteWs.protocol) || remoteWs.username || remoteWs.password || remoteWs.search || remoteWs.hash || !remoteWs.pathname.startsWith('/devtools/')) continue;
    const wsProtocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
    const localWs = new URL(`${wsProtocol}//${base.host}`);
    localWs.pathname = remoteWs.pathname;
    candidates.push({ id: row.id, type: 'page', urlPathname: path, webSocketUrl: localWs.href });
  }
  if (candidates.length === 0) throw fail('CEF_TARGET_NONE');
  if (candidates.length !== 1) throw fail('CEF_TARGET_AMBIGUOUS');
  return candidates[0];
}

export class CdpClient {
  constructor(webSocketUrl, {
    WebSocketImpl = globalThis.WebSocket,
    connectTimeoutMs = 5000,
    commandTimeoutMs = 15000,
  } = {}) {
    const parsed = parseLoopback(webSocketUrl, ['ws:', 'wss:'], 'CEF_WS_NOT_LOOPBACK');
    if (parsed.search) throw fail('CEF_WS_NOT_LOOPBACK');
    this.url = parsed.href;
    if (typeof WebSocketImpl !== 'function') throw fail('CDP_WEBSOCKET_UNAVAILABLE');
    this.WebSocketImpl = WebSocketImpl;
    this.connectTimeoutMs = positiveMs(connectTimeoutMs, 5000);
    this.commandTimeoutMs = positiveMs(commandTimeoutMs, 15000);
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
    this.ws = null;
    this.ready = false;
    this.closed = false;
  }

  _listen(target, name, fn) {
    if (typeof target.addEventListener === 'function') {
      target.addEventListener(name, fn);
      return () => target.removeEventListener && target.removeEventListener(name, fn);
    }
    if (typeof target.on === 'function') {
      target.on(name, fn);
      return () => target.off && target.off(name, fn);
    }
    target[`on${name}`] = fn;
    return () => { if (target[`on${name}`] === fn) target[`on${name}`] = null; };
  }

  async connect() {
    if (this.ready) return this;
    if (this.closed) throw fail('CDP_CLOSED');
    let ws;
    try { ws = new this.WebSocketImpl(this.url); } catch { throw fail('CDP_CONNECT_FAILED'); }
    this.ws = ws;
    this._listen(ws, 'message', (e) => this._onMessage(e));
    this._listen(ws, 'close', () => this._shutdown('CDP_CLOSED'));
    this._listen(ws, 'error', () => this._shutdown('CDP_TRANSPORT_ERROR'));
    await withTimeout(new Promise((resolve, reject) => {
      const offOpen = this._listen(ws, 'open', () => { offOpen(); offClose(); resolve(); });
      const offClose = this._listen(ws, 'close', () => { offOpen(); offClose(); reject(fail('CDP_CONNECT_CLOSED')); });
    }), this.connectTimeoutMs, 'CDP_CONNECT_TIMEOUT').catch((e) => {
      try { ws.close(); } catch { /* fixed error below */ }
      throw e;
    });
    if (this.closed) throw fail('CDP_CLOSED');
    this.ready = true;
    return this;
  }

  on(method, fn) {
    if (typeof method !== 'string' || typeof fn !== 'function') throw fail('CDP_SUBSCRIPTION_INVALID');
    const set = this.handlers.get(method) || new Set();
    set.add(fn); this.handlers.set(method, set);
    return () => { set.delete(fn); if (set.size === 0) this.handlers.delete(method); };
  }

  send(method, params = {}, timeoutMs = this.commandTimeoutMs) {
    if (!this.ready || this.closed || !this.ws) return Promise.reject(fail('CDP_CLOSED'));
    if (typeof method !== 'string' || method.length === 0 || params == null || typeof params !== 'object' || Array.isArray(params)) return Promise.reject(fail('CDP_COMMAND_INVALID'));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(fail('CDP_COMMAND_TIMEOUT'));
      }, positiveMs(timeoutMs, this.commandTimeoutMs));
      this.pending.set(id, { resolve, reject, timer });
      try { this.ws.send(JSON.stringify({ id, method, params })); }
      catch { clearTimeout(timer); this.pending.delete(id); reject(fail('CDP_SEND_FAILED')); }
    });
  }

  async evaluate(expression, timeoutMs) {
    const out = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, timeoutMs);
    if (!out || out.exceptionDetails || !out.result || !Object.prototype.hasOwnProperty.call(out.result, 'value')) throw fail('CDP_EVALUATE_FAILED');
    return out.result.value;
  }

  _onMessage(event) {
    const raw = event && typeof event === 'object' && 'data' in event ? event.data : event;
    // Web API WebSocket 给 string；Node ws 风格可能直接给 Buffer/Uint8Array。
    // Blob/异步二进制在最小真实通道未证明前不猜，丢弃即 fail-closed（pending 最终超时）。
    let text;
    if (typeof raw === 'string') text = raw;
    else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(raw)) text = raw.toString('utf8');
    else if (raw instanceof Uint8Array) text = new TextDecoder().decode(raw);
    else return;
    let message;
    try { message = JSON.parse(text); } catch { return; }
    if (Number.isInteger(message.id)) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer); this.pending.delete(message.id);
      if (message.error) pending.reject(fail('CDP_COMMAND_FAILED'));
      else pending.resolve(message.result || {});
      return;
    }
    if (typeof message.method !== 'string') return;
    for (const fn of this.handlers.get(message.method) || []) {
      try { fn(message.params || {}); } catch { /* observers cannot break transport */ }
    }
  }

  _shutdown(code) {
    if (this.closed && this.pending.size === 0) return;
    this.ready = false; this.closed = true;
    for (const { reject, timer } of this.pending.values()) { clearTimeout(timer); reject(fail(code)); }
    this.pending.clear();
  }

  close() {
    if (this.closed) return;
    this._shutdown('CDP_CLOSED');
    try { this.ws && this.ws.close(); } catch { /* already fail-closed */ }
  }
}
