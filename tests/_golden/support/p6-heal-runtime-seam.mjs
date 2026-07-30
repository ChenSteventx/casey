// P6 heal 复核用的极简假运行时接缝模块（zero-SUT 金牌专用，绝不进生产路径）。
//
// 生产契约（plan §3.5 唯一钉死的一条）：环境变量 CASEY_HEAL_RUNTIME_SEAM=<module> 指向本模块，
// 复核编排即用它替代真浏览器运行时来源；未设时走真浏览器链路。**裁定语义不受该变量影响**——
// 复核仍是真 replay → 真 verdict 代码路径（GRILL D6），本模块只提供「运行时从哪来」。
//
// 形状对齐 lib/teachin/runtime-bootstrap.mjs 的 seams 概念：
//   openRuntime({ role, executionTargetAuthority }) → { ok:true, runtime:{ browser, context,
//   page, topology, forensics, originAdmission } }，失败一律闭合 { ok:false, reason }。
// 为兼容消费侧可能采用的三种取用姿势，同时导出 openRuntime / createRuntimeBootstrap / default。
//
// 剧本（金牌自己的事，不是生产契约）：CASEY_HEAL_SEAM_SCENARIO 指向一个 JSON——
//   { "byAccessibleName": { "<可访问名>": { "count": <n> } }, "defaultCount": <n> }
// 定位按可访问名给候选数：count===1 → 唯一可动作（该步走向 PASS）；count===0 → 未命中
// （该步落非绿）。金牌据此注入「目标步修好了 / 某个非目标步回归了」两种局面。
//
// 纪律：零浏览器、零网络、零凭据；不认识也不构造任何真实目标地址。

import { readFileSync } from 'node:fs';

function loadScenario() {
  const p = process.env.CASEY_HEAL_SEAM_SCENARIO;
  if (!p) return { byAccessibleName: {}, defaultCount: 1 };
  try {
    const s = JSON.parse(readFileSync(p, 'utf8'));
    return {
      byAccessibleName: s.byAccessibleName || {},
      defaultCount: typeof s.defaultCount === 'number' ? s.defaultCount : 1,
      pageErrors: Array.isArray(s.pageErrors) ? s.pageErrors : [],
    };
  } catch {
    // 剧本读不出就退到「全部可解析」，让失败暴露在断言上而不是接缝上。
    return { byAccessibleName: {}, defaultCount: 1, pageErrors: [] };
  }
}

const SCENARIO = loadScenario();

function countFor(name) {
  if (name == null) return SCENARIO.defaultCount;
  const hit = SCENARIO.byAccessibleName[String(name)];
  if (hit && typeof hit.count === 'number') return hit.count;
  return SCENARIO.defaultCount;
}

// 极简 locator 句柄：只回答「有几个」「动作成没成」，链式取用一律回自身。
function makeLocator(name) {
  const n = countFor(name);
  const self = {
    async count() { return n; },
    first() { return self; },
    last() { return self; },
    nth() { return self; },
    filter() { return self; },
    locator() { return self; },
    getByRole(_role, opts) { return makeLocator(opts && opts.name); },
    getByLabel(label) { return makeLocator(label); },
    getByText(text) { return makeLocator(text); },
    getByPlaceholder(text) { return makeLocator(text); },
    async waitFor() { if (n < 1) throw new Error('SEAM_LOCATOR_ABSENT'); },
    async click() { if (n !== 1) throw new Error('SEAM_LOCATOR_NOT_UNIQUE'); },
    async dblclick() { if (n !== 1) throw new Error('SEAM_LOCATOR_NOT_UNIQUE'); },
    async fill() { if (n !== 1) throw new Error('SEAM_LOCATOR_NOT_UNIQUE'); },
    async press() { if (n !== 1) throw new Error('SEAM_LOCATOR_NOT_UNIQUE'); },
    async selectOption() { if (n !== 1) throw new Error('SEAM_LOCATOR_NOT_UNIQUE'); },
    async innerText() { return ''; },
    async textContent() { return ''; },
    async inputValue() { return ''; },
    async isVisible() { return n >= 1; },
    async isEnabled() { return n >= 1; },
    async getAttribute() { return null; },
    async boundingBox() { return null; },
    async dragTo() { if (n !== 1) throw new Error('SEAM_LOCATOR_NOT_UNIQUE'); },
  };
  return self;
}

function makePage(context) {
  const listeners = new Map();
  const page = {
    async goto() { return { ok: () => true, status: () => 200 }; },
    url() { return '/heren/aimanagement/process/list'; },
    context() { return context; },
    isClosed() { return false; },
    getByRole(_role, opts) { return makeLocator(opts && opts.name); },
    getByLabel(label) { return makeLocator(label); },
    getByText(text) { return makeLocator(text); },
    getByPlaceholder(text) { return makeLocator(text); },
    getByTestId(id) { return makeLocator(id); },
    locator(sel) { return makeLocator(sel); },
    frames() { return []; },
    async evaluate() { return null; },
    async addInitScript() { },
    async waitForTimeout() { },
    async waitForLoadState() { },
    async screenshot() { return Buffer.alloc(0); },
    async close() { },
    on(event, handler) {
      const list = listeners.get(event) || [];
      list.push(handler);
      listeners.set(event, list);
      return page;
    },
    once(event, handler) { return page.on(event, handler); },
    off() { return page; },
    removeListener() { return page; },
    emit(event) { for (const h of listeners.get(event) || []) h(); },
  };
  return page;
}

function makeContext(browser) {
  const listeners = new Map();
  const pages = [];
  const context = {
    browser() { return browser; },
    pages() { return pages; },
    async newPage() { const p = makePage(context); pages.push(p); return p; },
    async cookies() { return []; },
    async addCookies() { },
    async addInitScript() { },
    async storageState() { return { cookies: [], origins: [] }; },
    async close() { },
    on(event, handler) {
      const list = listeners.get(event) || [];
      list.push(handler);
      listeners.set(event, list);
      return context;
    },
    once(event, handler) { return context.on(event, handler); },
    off() { return context; },
    removeListener() { return context; },
  };
  return context;
}

function makeBrowser() {
  const browser = {
    isConnected() { return true; },
    async newContext() { return makeContext(browser); },
    async close() { },
    on() { return browser; },
    once() { return browser; },
    off() { return browser; },
    removeListener() { return browser; },
  };
  return browser;
}

const INERT_FORENSICS = Object.freeze({
  network: [],
  lifecycle: Object.freeze({ crashed: false, crashedAtStepId: null, pageerror: [] }),
});

/** 复核运行时来源：与 runtime-bootstrap.openRuntime 同形（闭合 ok / reason）。 */
export async function openRuntime(options = {}) {
  if (!options || typeof options !== 'object') {
    return Object.freeze({ ok: false, reason: 'HEAL_SEAM_RUNTIME_OPEN_FAILED' });
  }
  const browser = makeBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();
  return Object.freeze({
    ok: true,
    runtime: Object.freeze({
      browser,
      context,
      page,
      topology: Object.freeze(Object.create(null)),
      forensics: INERT_FORENSICS,
      originAdmission: async () => true,
    }),
  });
}

/** 与 createRuntimeBootstrap(deps) 同名同形，便于消费侧原样替换 canonical bootstrap。 */
export function createRuntimeBootstrap() {
  return Object.freeze({ openRuntime });
}

export const runtimeBootstrap = Object.freeze({ openRuntime });

export default Object.freeze({ openRuntime, createRuntimeBootstrap, runtimeBootstrap });
