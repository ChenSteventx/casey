// assert-visibility-semantics 固定语料 —— 确定性 Page 测试替身（零浏览器、零 SUT、零网络）。
//
// 用途：在零 SUT 下驱动【真实】lib/replay/event-runner.mjs → lib/replay-axes.mjs → bin/verdict.mjs，
// 复现真机已观测事实：浮层视觉关闭但节点不卸载——「创建时间」DOM 命中 1、可见命中 0（GRILL D5）。
//
// 两种关闭情景（既有真卸载情景保留，只新增「只隐藏、不清空」）：
//   · CLOSE_UNMOUNT —— 现役假环境 tests/fixtures/publish-sut/server.mjs:93 的行为：
//     closeDlg() 把 innerHTML 清空，节点真离 DOM（DOM 0、可见 0）；
//   · CLOSE_HIDE —— 真机行为：只隐藏、不清空。机制同 hidden 属性 → display:none：
//     节点留在 DOM，getClientRects() 归零，getComputedStyle().visibility 仍是 visible
//     （故可见谓词只看 visibility 不看 rects 会漏判——这是真机红签名的成因）。
//
// 纪律：
//   · 页面事实全由节点表决定，零时钟读数、零随机，可跨运行逐字节复现；
//   · page.evaluate 与 locator.evaluateAll 把调用方传入的函数放在最小 document 垫片上【真跑】，
//     绝不按函数源码猜答案——任何走标准 DOM 谓词的实现都能被如实作答，替身不锁死实现的 API 选型；
//   · 采集不可用情景对全部查询面一致抛错（不是静默回空），供 fail-open 缝取证。

export const CLOSE_UNMOUNT = 'unmountOnClose';
export const CLOSE_HIDE = 'hideOnClose';

const TOAST_QUERY_RE = /hr-toast|hr-message|role\s*=\s*["']?(?:status|alert)/;

function matchesOneSelector(node, selector) {
  const one = selector.trim();
  if (one.startsWith('.')) return node.classes.includes(one.slice(1));
  const attribute = /^\[([A-Za-z-]+)\s*=\s*"([^"]*)"\]$/.exec(one);
  if (attribute) return attribute[1] === 'role' && node.role === attribute[2];
  return false;
}

const matchesSelector = (node, selector) =>
  String(selector).split(',').some((one) => matchesOneSelector(node, one));

// 元素替身：只暴露可见性谓词与按钮态谓词实际会读的面；display:none 表达成零 client rects。
function toElement(node) {
  return {
    textContent: node.text,
    classList: { contains: (name) => node.classes.includes(name) },
    getAttribute: (name) => (name === 'role' ? node.role : null),
    getClientRects: () => (node.visible ? [{ width: 8, height: 8 }] : []),
    checkVisibility: () => node.visible,
    disabled: false,
    style: { visibility: 'visible', display: node.visible ? 'block' : 'none' },
  };
}

export function createVisibilityPage({
  nodes = [],
  closeMode = CLOSE_HIDE,
  url = 'https://assert-visibility.invalid:9443/ai-manager/process/detail',
  failTextQuery = false,
  failToastQuery = false,
} = {}) {
  const state = {
    url,
    nodes: nodes.map((node) => ({
      text: String(node.text),
      classes: Array.isArray(node.classes) ? [...node.classes] : [],
      role: node.role == null ? null : String(node.role),
      dialog: node.dialog === true,
      present: node.present !== false,
      visible: node.visible !== false,
    })),
  };
  const present = () => state.nodes.filter((node) => node.present);

  const document = {
    body: {
      get innerHTML() { return present().map((node) => `<div>${node.text}</div>`).join(''); },
      get innerText() { return present().filter((node) => node.visible).map((node) => node.text).join('\n'); },
    },
    querySelectorAll: (selector) => present().filter((node) => matchesSelector(node, selector)).map(toElement),
    querySelector: (selector) => {
      const hit = present().find((node) => matchesSelector(node, selector));
      return hit ? toElement(hit) : null;
    },
  };

  // 页面内脚本上下文垫片：只在调用方函数执行期间挂载，执行完原样还原（不污染宿主全局）。
  async function withDomGlobals(run) {
    const hadDocument = 'document' in globalThis;
    const hadComputedStyle = 'getComputedStyle' in globalThis;
    const previousDocument = globalThis.document;
    const previousComputedStyle = globalThis.getComputedStyle;
    globalThis.document = document;
    globalThis.getComputedStyle = (element) =>
      (element && element.style) || { visibility: 'visible', display: 'block' };
    try {
      return await run();
    } finally {
      if (hadDocument) globalThis.document = previousDocument; else delete globalThis.document;
      if (hadComputedStyle) globalThis.getComputedStyle = previousComputedStyle;
      else delete globalThis.getComputedStyle;
    }
  }

  const isVisibleElement = (element) => element.getClientRects().length > 0;

  function makeLocator(read) {
    const locator = {
      async count() { return read().length; },
      first() { return makeLocator(() => read().slice(0, 1)); },
      last() { return makeLocator(() => read().slice(-1)); },
      nth(index) { return makeLocator(() => read().slice(index, index + 1)); },
      filter(options) {
        if (options && options.visible === true) return makeLocator(() => read().filter(isVisibleElement));
        if (options && options.visible === false) {
          return makeLocator(() => read().filter((element) => !isVisibleElement(element)));
        }
        return makeLocator(read);
      },
      locator(selector) {
        const engine = String(selector).trim();
        if (engine === 'visible=true' || engine === ':visible') {
          return makeLocator(() => read().filter(isVisibleElement));
        }
        return makeLocator(() => []);
      },
      async innerText() { const hits = read(); return hits.length ? hits[0].textContent : ''; },
      async evaluateAll(fn, argument) { const hits = read(); return withDomGlobals(() => fn(hits, argument)); },
      async waitFor() { if (!read().length) throw new Error('测试替身：定位缺席（waitFor 超时同构）'); },
      async click() {},
      async press() {},
      async fill() {},
    };
    return locator;
  }

  const throwingLocator = (message) => makeLocator(() => { throw new Error(message); });

  return {
    url() { return state.url; },
    async goto(target) { state.url = target; },
    async close() {},
    async waitForLoadState() {},
    waitForResponse() { return Promise.resolve(null); },
    getByText(value, options) {
      if (failTextQuery) return throwingLocator('测试替身：文本查询按情景不可用');
      const exact = !!(options && options.exact);
      return makeLocator(() => present()
        .filter((node) => (exact ? node.text === value : node.text.includes(value)))
        .map(toElement));
    },
    getByRole(role, options) {
      const name = options && options.name !== undefined ? String(options.name) : null;
      return makeLocator(() => present()
        .filter((node) => node.role === role && (name === null || node.text.trim() === name))
        .map(toElement));
    },
    getByLabel(value) {
      return makeLocator(() => present().filter((node) => node.text === value).map(toElement));
    },
    locator(selector) {
      if (failToastQuery && TOAST_QUERY_RE.test(String(selector))) {
        return throwingLocator('测试替身：提示节点查询按情景不可用');
      }
      return makeLocator(() => present().filter((node) => matchesSelector(node, selector)).map(toElement));
    },
    async evaluate(fn, argument) {
      if (typeof fn !== 'function') throw new TypeError('测试替身：evaluate 只接受函数');
      if (failToastQuery && TOAST_QUERY_RE.test(String(fn))) {
        throw new Error('测试替身：提示节点查询按情景不可用');
      }
      return withDomGlobals(() => fn(argument));
    },
    // 关闭浮层：真卸载 = 节点离 DOM；只隐藏 = 节点留在 DOM、client rects 归零。
    closeDialog() {
      for (const node of state.nodes) {
        if (!node.dialog) continue;
        if (closeMode === CLOSE_UNMOUNT) node.present = false;
        else node.visible = false;
      }
    },
    // 只读现场快照，供金牌把「DOM 命中 / 可见命中」当前提事实先自证，再谈断言口径。
    probe(value) {
      const hit = present().filter((node) => node.text.includes(value));
      return { dom: hit.length, visible: hit.filter((node) => node.visible).length };
    },
  };
}
