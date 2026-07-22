// mock-page.mjs —— 确定性 Playwright Page 测试替身（agent-id-readback R2-H6 / sol 五面构造 ①②）。
// 用途：零浏览器/零网络/零 SUT 下驱动【真实】lib/compile-atoms.mjs（createCompileRun/compileFlow）与
// lib/replay-actions.mjs（performAction）的未声明身份通道（v1）路径，产出可逐字节冻结的产物。
// 纪律：
//   - 全部行为由调用方传入的 dom 规格表决定，零时钟读数、零随机（可跨运行/跨树逐字节复现）；
//   - 未登记的 evaluate 形态一律抛错（响亮失败，不静默演一个假 DOM）；未登记的定位键按 count 0
//     （缺席语义，与真实页元素不存在同构）；
//   - 只实现被驱动 v1 路径实际触达的 Page/Locator 面——evaluateHandle 等身份双证路径专属能力
//     刻意缺席：v1 路径若碰它即抛错，等价一记「未声明路径闯身份面」的哨兵。
//
// dom 规格表：{ [定位键]: { count, inContainer?, click?, fill?, press?, dblclick? } }
//   定位键：role:<role>:<name> | text:<name>:exact | text:<name>:sub | label:<name> | css:<selector>
//   嵌套定位（locator.getByText / locator.locator）键形如 `<父键>><子键>`。
//   动作值：缺省 'ok'（成功）；'throw' = 动作抛错（演元素唯一但动作失败）。
//   inContainer：容器归属闸探针（locator.evaluate closest）返回值；缺省 true。

function makeLocator(key, dom) {
  const spec = Object.prototype.hasOwnProperty.call(dom, key) ? dom[key] : null;
  const count = spec ? spec.count : 0;
  const act = async (name) => {
    if (!spec || count === 0) throw new Error(`mock-page: ${key} 缺席，动作 ${name} 无处落笔`);
    if ((spec[name] || 'ok') === 'throw') throw new Error(`mock-page: ${key} 动作 ${name} 按规格拒绝`);
  };
  return {
    count: async () => count,
    first() { return makeLocator(key, dom); },
    last() { return makeLocator(key, dom); },
    nth() { return makeLocator(key, dom); },
    async waitFor() { if (count === 0) throw new Error(`mock-page: ${key} 缺席（waitFor 超时同构）`); },
    click: () => act('click'),
    dblclick: () => act('dblclick'),
    press: () => act('press'),
    fill: () => act('fill'),
    async innerText() { return spec && typeof spec.text === 'string' ? spec.text : ''; },
    async evaluate() {
      if (!spec) throw new Error(`mock-page: ${key} 缺席，evaluate 无节点`);
      return spec.inContainer !== undefined ? spec.inContainer : true;
    },
    getByText(name, opts) { return makeLocator(`${key}>text:${name}:${opts && opts.exact ? 'exact' : 'sub'}`, dom); },
    locator(sel) { return makeLocator(`${key}>css:${sel}`, dom); },
  };
}

export function createMockPage({ dom = {}, url = 'http://127.0.0.1:4173/', titles = [], toasts = [], bodyLength = 1000 } = {}) {
  const state = { url };
  return {
    getByRole(role, opts) { return makeLocator(`role:${role}:${opts && opts.name !== undefined ? opts.name : ''}`, dom); },
    getByText(name, opts) { return makeLocator(`text:${name}:${opts && opts.exact ? 'exact' : 'sub'}`, dom); },
    getByLabel(name) { return makeLocator(`label:${name}`, dom); },
    locator(sel) { return makeLocator(`css:${sel}`, dom); },
    url() { return state.url; },
    async goto(target) { state.url = target; },
    async evaluate(fn) {
      const src = String(fn);
      if (src.includes('innerHTML.length')) return bodyLength;           // quietPoint：DOM 稳定拍
      if (src.includes('document.title')) return titles.slice();         // capture：cleanTitles
      if (src.includes('hr-toast')) return toasts.slice();               // capture：toastTexts
      throw new Error('mock-page: 未登记的 evaluate 形态（响亮失败，不演假 DOM）');
    },
    waitForResponse() { return Promise.resolve(null); },
    async waitForLoadState() {},
  };
}
