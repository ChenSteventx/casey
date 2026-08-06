#!/usr/bin/env node
// semantic-name-instantiate：semantic.name 携 {{占位符}} 时，定位那一刻必须按 ctx 回填。
// 根因（B4 九跑诊断实证）：workflow.open 的 emit 传 semantic.name = 'atl_{{uniqueName}}'（落盘必须
// 保留模板供回放按各自 ctx 回填），而 compile 与 replay 两侧定位都拿字面串去 getByText → 恒 0 命中
// → absent；同轮前奏诊断证明容器内真名 5ms 即命中、页面 5 卡 16 框完全正常。
// 修法：两侧定位入口各过一次纯投影 instantiateEventSemantic（只在真含占位时产浅拷贝，落盘字节
// 与上游对象永不被改；无占位/缺 ctx/非法形状恒等）。零 SUT、零网络、零浏览器。

const TAG = 'semantic-name-instantiate';
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
    failures.push(`${name}: ${error?.message || error}`);
    console.error(`RED  ${TAG}: ${name}: ${error?.message || error}`);
  }
}

const { instantiateEventSemantic } = await import('../../lib/instantiate.mjs');
const { performAction } = await import('../../lib/replay-actions.mjs');

// 记录型替身页：把每次定位请求的实参原样记下，locator 恒零命中（自洽：本金牌只观察「用什么串找」，
// 不预设找不找得到；零命中让下游走既有 fail-closed，不倒裁）。
function makeRecorderPage(calls) {
  const zero = () => ({
    count: async () => 0,
    first: () => zero(),
    waitFor: async () => { throw new Error('not mounted'); },
    evaluate: async () => undefined,
    elementHandles: async () => [],
    click: async () => {},
    fill: async () => {},
    locator: () => zero(),
    getByText: () => zero(),
    filter: () => zero(),
  });
  return {
    getByRole: (role, opts) => { calls.push({ kind: 'role', role, name: opts?.name, exact: opts?.exact }); return zero(); },
    getByLabel: (name) => { calls.push({ kind: 'label', name }); return zero(); },
    getByText: (name, opts) => { calls.push({ kind: 'text', name, exact: opts?.exact }); return zero(); },
    locator: () => zero(),
    evaluate: async () => undefined,
    waitForTimeout: async () => {},
    url: () => 'https://sut.invalid/heren/aimanagement/process/list',
    mouse: { click: async () => {} },
  };
}

const CTX = { uniqueName: 'run42', baseUrl: 'https://sut.invalid' };

await check('S1 投影钉：含占位的 semantic.name 按 ctx 回填、原对象与落盘字节不被改', async () => {
  const ev = Object.freeze({
    stepId: 'atstep_9', atom: 'workflow.open', action: 'click',
    semantic: Object.freeze({ kind: 'text', name: 'atl_{{uniqueName}}', exact: true }),
  });
  const view = instantiateEventSemantic(ev, CTX);
  assert(view !== ev, '含占位时须产定位视图（浅拷贝）');
  assert(view.semantic.name === 'atl_run42', `视图须用实例化名：${view.semantic.name}`);
  assert(ev.semantic.name === 'atl_{{uniqueName}}', '原事件（落盘字节）绝不被改');
  assert(view.stepId === ev.stepId && view.atom === ev.atom && view.action === ev.action
    && view.semantic.kind === 'text' && view.semantic.exact === true, '其余字段逐位保留');
});

await check('S2 恒等钉：无占位 / 缺 ctx / 非法形状一律原样返回（既有事件零漂移）', async () => {
  const plain = { atom: 'workflow.create', action: 'click', semantic: { kind: 'role', role: 'button', name: '新增工作流', exact: true } };
  assert(instantiateEventSemantic(plain, CTX) === plain, '无占位须返回同一对象引用');
  const templated = { atom: 'workflow.open', action: 'click', semantic: { kind: 'text', name: 'atl_{{uniqueName}}', exact: true } };
  assert(instantiateEventSemantic(templated, undefined) === templated, '缺 ctx 须原样（占位保留、不抛）');
  assert(instantiateEventSemantic(templated, {}) === templated, '空 ctx 无对应键须原样');
  const noSemantic = { atom: 'workflow.save', action: 'click', text: '保存' };
  assert(instantiateEventSemantic(noSemantic, CTX) === noSemantic, '无 semantic 须原样');
  assert(instantiateEventSemantic(null, CTX) === null, 'null 须原样返回不抛');
  assert(instantiateEventSemantic(undefined, CTX) === undefined, 'undefined 须原样返回不抛');
});

await check('S3 replay 侧行为钉：performAction 通用路径用实例化名定位', async () => {
  const calls = [];
  const page = makeRecorderPage(calls);
  const outcome = await performAction(page, {
    atom: 'workflow.open', action: 'click',
    semantic: { kind: 'text', name: 'atl_{{uniqueName}}', exact: true },
  }, CTX);
  const textCalls = calls.filter((c) => c.kind === 'text');
  assert(textCalls.length >= 1, `replay 须走 text 定位：${JSON.stringify(calls)}`);
  assert(textCalls[0].name === 'atl_run42',
    `replay 侧须用实例化名（与 compile 侧对称）：${JSON.stringify(textCalls[0])}`);
  // 零命中下的既有 fail-closed 行为不变（不倒裁：只断言没被判成可动作）
  assert(outcome && outcome.resolution !== 'unique', `零命中不得判 unique：${JSON.stringify(outcome)}`);
});

await check('S4 结构对称钉：两侧定位入口均先过投影，且既有调用点字面保持', async () => {
  const { readFileSync } = await import('node:fs');
  const compileSrc = readFileSync(new URL('../../lib/compile-atoms-run.mjs', import.meta.url), 'utf8');
  const replaySrc = readFileSync(new URL('../../lib/replay-actions.mjs', import.meta.url), 'utf8');
  const compileFn = compileSrc.slice(compileSrc.indexOf('async resolveTarget(ev)'));
  const cProj = compileFn.indexOf('instantiateEventSemantic(ev, this.ctx)');
  const cUse = compileFn.indexOf('locatorFor(this.page, ev)');
  assert(cProj >= 0 && cUse >= 0 && cProj < cUse, 'compile 侧投影须在 locatorFor 之前');
  const rProj = replaySrc.indexOf('ev = instantiateEventSemantic(ev, ctx)');
  const rUse = replaySrc.indexOf('const cand = await resolveCandidate(page, ev)');
  assert(rProj >= 0 && rUse >= 0 && rProj < rUse, 'replay 侧投影须在 resolveCandidate 之前');
  // 覆盖面自钉（评审 r1 pi Medium 采纳）：专用身份门里凡消费 semantic.name 者（doOpenNode /
  // doDragTo / doSetNodeField placeholder / doSelectNodeDropdown 等）也必须在投影之后分发，
  // 否则「定位前必须回填」不变式名不副实（未来配方给节点标题传模板即复现 B4 同类恒 0 命中）。
  for (const branch of [
    "if (ev.action === 'selectOption') return await doSelect(page, ev, ctx);",
    "if (ev.action === 'dragTo') return await doDragTo(page, ev);",
    "if (ev.action === 'click' && ev.atom === 'workflow.openNode') return await doOpenNode(page, ev);",
    "if (ev.action === 'click' && ev.atom === 'workflow.selectNodeDropdown') return await doSelectNodeDropdown(page, ev);",
    "if (ev.action === 'fill' && ev.atom === 'workflow.setNodeField') {",
  ]) {
    const at = replaySrc.indexOf(branch);
    assert(at >= 0, `专用门分支未找到（源码已变，钉需重校）：${branch.slice(0, 48)}`);
    assert(rProj < at, `投影须在专用门之前：${branch.slice(0, 48)}`);
  }
  // 既有冻结金牌以字面匹配判接线顺序（page-topology B6、regress-agent-tool-actions B2）——
  // 本契约不得改这两处调用点与签名字面，否则那些冻结钉误红（本轮全仓扫描实证）。
  assert(replaySrc.includes('const cand = await resolveCandidate(page, ev);'), 'resolveCandidate 调用点字面须保持');
  assert(replaySrc.includes('async function resolveCandidate(page, ev) {'), 'resolveCandidate 签名字面须保持');
  assert(replaySrc.includes('function semanticLocator(page, ev) {'), 'semanticLocator 签名字面须保持');
});

const total = passed + failures.length;
if (failures.length) {
  console.error(`\nnot ok ${TAG}: ${passed}/${total} 通过，${failures.length} 条红`);
  process.exit(1);
}
console.log(`ok   ${TAG}: ${passed}/${total} 全过`);
