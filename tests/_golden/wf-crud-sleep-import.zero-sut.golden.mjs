#!/usr/bin/env node
// wf-crud-sleep-import：workflow.create 与 workflow.openNode 编译不得抛 ReferenceError: sleep is not defined。
// 根因：6f91125 拆单体 compile-atoms.mjs 时，compile-atoms-workflow-crud.mjs:136（sleep(250)）与
// compile-atoms-workflow-drawer.mjs:53（sleep(100) 点后轮询）的代码块搬走、sleep 导入没跟着搬。
// 同缺陷类第三例（前两例：requestLogPath 01e965f、inspectWorkflowDeleteConfirm agent-delete-confirm-import）。
// hermetic 此前恒绿是因为没有夹具造出命中 sleep 行的形态。零 SUT、零网络、零浏览器；
// 替身只复现被调用的形状与真实前置形态，不另造语义、不倒着裁到预定裁定。

const TAG = 'wf-crud-sleep-import';
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

const { compileWorkflowCreate } = await import('../../lib/compile-atoms-workflow-crud.mjs');
const { compileWorkflowOpenNode } = await import('../../lib/compile-atoms-workflow-drawer.mjs');

// 零命中空页替身：无 DOM，一切定位一律零命中——自洽（空页本就什么都定位不到），不针对某条断言倒裁。
function makeEmptyPage() {
  const zero = () => ({
    count: async () => 0,
    first: () => zero(),
    last: () => zero(),
    waitFor: async () => { throw new Error('empty-page: nothing to wait for'); },
    evaluate: async () => undefined,
    elementHandles: async () => [],
    click: async () => {},
    fill: async () => {},
    textContent: async () => null,
    locator: () => zero(),
    getByText: () => zero(),
    filter: () => zero(),
  });
  return {
    getByRole: () => zero(),
    getByText: () => zero(),
    getByLabel: () => zero(),
    locator: () => zero(),
    evaluate: async () => undefined,
    waitForTimeout: async () => {},
    url: () => 'https://sut.invalid/heren/aimanagement/process/list',
    mouse: { click: async () => {} },
  };
}

// S2 塑形替身：复现「节点在画布上、点后抽屉不开」这一真实可能形态（如抽屉渲染失败）。
// 画布域内该标题恰 1（过预检域锁）、节点 box 可证（真实几何形状）、抽屉域恒空（elementHandles 恒 []）。
// 点后轮询与超时阻断是被测代码自己的决定，替身只提供形态、不指定结论。
function makeCanvasPage(label, stats) {
  const zero = makeEmptyPage().locator();
  const nodeHandle = {
    waitFor: async () => {},
    evaluate: async () => ({ x: 10, y: 10, w: 120, h: 48 }),
  };
  const canvasText = {
    count: async () => 1,
    first: () => nodeHandle,
  };
  const drawerWrapper = {
    filter: () => ({
      elementHandles: async () => { stats.drawerDomainCalls += 1; return []; },
    }),
  };
  return {
    getByRole: () => zero,
    getByText: () => ({ token: 'has-filter-probe' }),
    getByLabel: () => zero,
    locator: (css) => {
      if (css === '.lf-canvas-overlay') return { getByText: (t, o) => (t === label && o?.exact ? canvasText : zero) };
      if (css === '.hr-drawer__content-wrapper:visible') return drawerWrapper;
      return zero;
    },
    evaluate: async () => undefined,
    waitForTimeout: async () => {},
    url: () => 'https://sut.invalid/heren/aimanagement/process/edit',
    mouse: { click: async () => { stats.mouseClicks += 1; } },
  };
}

// run 替身：字段面对齐 lib/compile-atoms-run.mjs 的 createCompileRun；emit 按生产签名
// (spec, customAct) 收参，有 customAct 就真调它（生产 emit 行为，见 compile-atoms-run.mjs:153-161）。
// identityLedger: null 且 profile 无 workflows.listApi → compileWorkflowCreate:226 按既定条件跳读回，零行为差。
function makeRun(page) {
  const emitted = [];
  return {
    emitted,
    page,
    ctx: { uniqueName: 'u1', baseUrl: 'https://sut.invalid' },
    site: undefined,
    events: [],
    notes: [],
    blockers: [],
    verification: [],
    identityLedger: null,
    profile: {},
    listRoute: '/heren/aimanagement/process/list',
    nodeDrawerLabel: null,
    stepN: 0,
    intentN: 0,
    newIntent() { this.intentN += 1; return `atintent_${this.intentN}`; },
    async emit(spec, customAct) {
      const stepId = `atstep_${this.stepN++}`;
      const ev = { stepId, ...spec };
      this.emitted.push(ev);
      let resolution = 'unique';
      let candidateCount = 1;
      let acted = false;
      if (customAct) {
        const outcome = await customAct();
        if (outcome && typeof outcome.resolution === 'string') {
          resolution = outcome.resolution;
          candidateCount = Number.isInteger(outcome.candidateCount) ? outcome.candidateCount : candidateCount;
          acted = resolution === 'unique' && outcome.identityReadback?.ok === true;
        } else {
          acted = true;
        }
      } else {
        acted = true;
      }
      this.events.push(ev);
      this.verification.push({ stepId, atom: spec.atom, action: spec.action, resolution, candidateCount, acted });
      return { stepId, resolution, candidateCount, acted };
    },
  };
}

await check('S1 crud 行为钉：workflow.create 全程不抛，空页上恰发 6 事件、notes 恰两条既有记账', async () => {
  const run = makeRun(makeEmptyPage());
  let threw = null;
  try {
    await compileWorkflowCreate(run, {
      name: 'atl_{{uniqueName}}',
      desc: 'Casey 编译期冒烟固定描述（非易变，可冻字面量）',
      category: '测试分类',
    });
  } catch (error) {
    threw = error;
  }
  assert(threw === null, `不得抛：${threw?.constructor?.name}: ${String(threw?.message).slice(0, 160)}`);
  const actions = run.emitted.map((e) => e.action);
  assert(run.emitted.length === 6, `空页上应恰发 6 事件（nav/click 新增/fill 名称/click 分类壳/click 分类项/click 确定）：${run.emitted.length}（${actions.join(',')}）`);
  assert(run.emitted[0].action === 'nav' && run.emitted[0].url === '{{baseUrl}}/heren/aimanagement/process/list',
    `首事件应为列表路由 nav：${JSON.stringify(run.emitted[0].url)}`);
  assert(run.emitted[1].action === 'click' && run.emitted[1].semantic?.role === 'button'
    && run.emitted[1].semantic?.name === '新增工作流' && run.emitted[1].semantic?.exact === true,
    `第 2 事件应为「新增工作流」role 语义点击：${JSON.stringify(run.emitted[1].semantic)}`);
  // 空页 menuitem/旧 CSS 锚均零命中：绝不发出菜单项点击（下拉分支线性化约定 4 的空页面）。
  assert(!run.emitted.some((e, i) => i >= 2 && e.action === 'click' && e.text === '新增工作流'),
    '空页上不得发出菜单项「新增工作流」点击');
  assert(run.emitted[2].action === 'fill' && run.emitted[2].fieldLabel === '工作流名称'
    && run.emitted[2].uniqueGuard === true && run.emitted[2].value === 'atl_{{uniqueName}}',
    `第 3 事件应为「工作流名称」fill（uniqueGuard）：${JSON.stringify({ fieldLabel: run.emitted[2].fieldLabel, value: run.emitted[2].value })}`);
  assert(run.emitted[3].action === 'click' && run.emitted[3].fieldLabel === '分类',
    `第 4 事件应为分类壳点击：${JSON.stringify(run.emitted[3].fieldLabel)}`);
  assert(run.emitted[4].action === 'click' && run.emitted[4].text === '测试分类',
    `第 5 事件应为分类选项点击：${JSON.stringify(run.emitted[4].text)}`);
  assert(run.emitted[5].action === 'click' && run.emitted[5].text === '确定'
    && run.emitted[5].compilePhase === 'terminal',
    `第 6 事件应为「确定」终局点击：${JSON.stringify({ text: run.emitted[5].text, compilePhase: run.emitted[5].compilePhase })}`);
  assert(run.notes.length === 2
    && run.notes[0] === '描述 textarea 无标签锚定（route:human ④）：本步不落 event'
    && run.notes[1] === '抽屉确认按钮文本实采失败（确定/确认均 0 命中）→ route:human ⑤',
    `notes 应恰为两条既有 route:human 记账：${JSON.stringify(run.notes)}`);
  assert(run.blockers.length === 0, `identityLedger null 时不得压读回阻断：${JSON.stringify(run.blockers)}`);
});

await check('S2 drawer 行为钉：workflow.openNode 点后轮询真踩 sleep(100)，超时后 fail-closed 硬阻断', async () => {
  const stats = { drawerDomainCalls: 0, mouseClicks: 0 };
  const run = makeRun(makeCanvasPage('测试节点', stats));
  let threw = null;
  const t0 = Date.now();
  try {
    await compileWorkflowOpenNode(run, { label: '测试节点' });
  } catch (error) {
    threw = error;
  }
  const elapsed = Date.now() - t0;
  assert(threw === null, `不得抛：${threw?.constructor?.name}: ${String(threw?.message).slice(0, 160)}`);
  assert(stats.mouseClicks === 1, `应恰点一次节点中心：${stats.mouseClicks}`);
  // 轮询真转过：预点基线 1 次 + 轮询 ≥1 次 + 点后核验 1 次 ⇒ ≥3；红基线首拍 sleep 即抛、到不了这里。
  assert(stats.drawerDomainCalls >= 3, `抽屉域应被轮询多次（基线+轮询+后核验）：${stats.drawerDomainCalls}`);
  assert(elapsed >= 5000, `抽屉恒不开时应真等满 5s 轮询窗：${elapsed}ms`);
  assert(run.emitted.length === 1 && run.emitted[0].atom === 'workflow.openNode' && run.emitted[0].action === 'click',
    `应恰发 1 个 openNode 点击事件：${JSON.stringify(run.emitted.map((e) => e.atom))}`);
  assert(run.blockers.length === 1 && run.blockers[0].includes('点后域内含精确标题的可见抽屉 count=0（非恰一）证不出归因'),
    `点后恰一失败应压既有硬阻断（fail-closed）：${JSON.stringify(run.blockers)}`);
  assert(run.nodeDrawerLabel === null, `开败时 run 态标题必须保持失效（G13）：${JSON.stringify(run.nodeDrawerLabel)}`);
});

await check('S3 结构钉：两文件来自 ./compile-atoms-support.mjs 的 import 行均含 sleep', async () => {
  const { readFileSync } = await import('node:fs');
  for (const rel of ['../../lib/compile-atoms-workflow-crud.mjs', '../../lib/compile-atoms-workflow-drawer.mjs']) {
    const src = readFileSync(new URL(rel, import.meta.url), 'utf8');
    const importLine = src.split('\n').find((l) => l.startsWith('import') && l.includes("from './compile-atoms-support.mjs'"));
    assert(importLine, `${rel}：import 清单须有一行来自 './compile-atoms-support.mjs'`);
    assert(/[{,]\s*sleep\s*[,}]/.test(importLine), `${rel}：该行须导入 sleep：${importLine}`);
  }
});

await check('S4 缺陷类普查钉：lib/*.mjs 凡裸调 sleep( 的文件必有 sleep 的导入或本地定义', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  const libDir = new URL('../../lib/', import.meta.url);
  const offenders = [];
  const walk = (dirUrl) => {
    for (const entry of readdirSync(dirUrl, { withFileTypes: true })) {
      const child = new URL(entry.isDirectory() ? `${entry.name}/` : entry.name, dirUrl);
      if (entry.isDirectory()) { walk(child); continue; }
      if (!entry.name.endsWith('.mjs')) continue;
      const src = readFileSync(child, 'utf8');
      // 裸调（排除 .sleep( 与 xxxSleep( 等非同名标识符）；注释行不豁免——宁可误报由人核，不静默漏报。
      if (!/(?<![.\w])sleep\s*\(/.test(src)) continue;
      const defines = /(?:const|let|var|function)\s+sleep\b/.test(src);
      const imports = src.split('\n').some((l) => l.startsWith('import') && /[{,]\s*sleep\s*[,}]/.test(l));
      if (!defines && !imports) offenders.push(child.pathname.split('/lib/').pop());
    }
  };
  walk(libDir);
  assert(offenders.length === 0, `裸调 sleep( 却无导入/定义的文件（拆文件漏导入缺陷类）：${JSON.stringify(offenders)}`);
});

const total = passed + failures.length;
if (failures.length) {
  console.error(`\nnot ok ${TAG}: ${passed}/${total} 通过，${failures.length} 条红`);
  process.exit(1);
}
console.log(`ok   ${TAG}: ${passed}/${total} 全过`);
