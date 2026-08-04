#!/usr/bin/env node
// agent-delete-confirm-import：agent.delete 编译走到「确定」步时不得抛 ReferenceError。
// 根因：lib/compile-atoms-agent.mjs:194 调用 inspectWorkflowDeleteConfirm，但该文件对
// ./workflow-delete-domain.mjs 零导入（6f91125 拆单体 compile-atoms.mjs 时代码块搬走、导入没跟着搬）。
// 命中该分支必抛，hermetic 金牌此前恒绿是因为没有夹具造出「走到确认步」的形态。
// 零 SUT、零网络、零浏览器；替身只复现被调用的形状，不另造语义、不倒着裁到预定裁定。

const TAG = 'agent-delete-confirm-import';
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

const { compileAgentToolRecipe } = await import('../../lib/compile-atoms-agent.mjs');
const { createAgentToolCompileState } = await import('../../lib/agent-tool-compile.mjs');

// 零命中空页替身：无 DOM，一切定位一律零命中——自洽（空页本就什么都定位不到），不针对某条断言倒裁。
// 生产对零命中的处置由被测代码自己决定，本金牌只观察决定，不预设。
function makeEmptyPage() {
  const zero = () => ({
    count: async () => 0,
    first: () => zero(),
    last: () => zero(),
    inputValue: async () => null,
    innerText: async () => null,
    elementHandles: async () => [],
    evaluateAll: async () => undefined,
    evaluate: async () => undefined,
    click: async () => {},
    fill: async () => {},
    waitFor: async () => {},
  });
  return {
    getByRole: () => zero(),
    getByText: () => zero(),
    getByLabel: () => zero(),
    locator: () => zero(),
    // 无 DOM 替身求不出页面闭包的值：如实返 undefined，绝不喂一个「刚好让某步通过」的数。
    evaluate: async () => undefined,
    waitForTimeout: async () => {},
    waitForLoadState: async () => {},
    url: () => 'https://sut.invalid/agent/list',
  };
}

// 身份观察替身：C3 目标连续性 ref 铸造（armDestructiveTargetContinuity）索要的完整必填面。
// 缺任一必填字段会在破坏 recipe 之前硬阻断，编译根本走不到确认步——这里给全，才能真正触到 :194。
function makeAgentObservation(targetName) {
  return {
    kind: 'agent',
    platformId: 'agent-platform-id-1',
    name: targetName,
    code: 'AGT-0001',
    role: 'target',
    atom: 'agent.searchOpen',
    evidenceStepId: 'atstep_0',
    sourceIntentId: 'atintent_0',
    candidateId: 'cand-1',
  };
}

// run 替身：字段面对齐 lib/compile-atoms-run.mjs 的 createCompileRun；emit 按生产签名
// (spec, customAct) 收参，有 customAct 就真调它（生产 emit 行为，见 compile-atoms-run.mjs:153-161），
// 故 agent.delete 的「删除」点击真穿 performAgentToolAction → performWorkflowDeleteTrigger 这条已冻接缝。
function makeRun({ uniqueName = 'u1', targetName = 'atl_agent_u1' } = {}) {
  const emitted = [];
  return {
    emitted,
    page: makeEmptyPage(),
    ctx: { uniqueName, baseUrl: 'https://sut.invalid' },
    events: [],
    notes: [],
    blockers: [],
    verification: [],
    identityObservations: [makeAgentObservation(targetName)],
    targetContinuityRefs: [],
    identityProfileDigest: 'hermetic-identity-profile-digest',
    identityLedger: null,
    profile: { agents: { listApi: { pathname: '/ai-api/agent/list' } } },
    listRoute: '/ai-manager/process/list',
    agentListRoute: '/agent/list',
    agentToolState: createAgentToolCompileState(),
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

async function runRecipe(atom, params, options = {}) {
  const run = makeRun(options);
  let threw = null;
  let results = null;
  try {
    results = await compileAgentToolRecipe(run, atom, params);
  } catch (error) {
    threw = error;
  }
  return { run, threw, results };
}

await check('S1 agent.delete 走到「确定」步：不抛，且 inspect 返回被 fail-closed 分支消费', async () => {
  const { run, threw, results } = await runRecipe('agent.delete', { name: 'atl_agent_{{uniqueName}}' });
  assert(threw === null,
    `不得抛：${threw?.constructor?.name}: ${String(threw?.message).slice(0, 160)}`);
  // 确认步之前的 4 个事件如实发出（nav/fill/press/click 删除），列表路由覆写生效。
  assert(Array.isArray(results) && results.length === 4,
    `确认步前应恰发 4 个事件（nav/fill/press/click 删除）：${results && results.length}`);
  assert(run.emitted.length === 4, `emit 次数应为 4：${run.emitted.length}`);
  assert(run.emitted[0].action === 'nav' && run.emitted[0].url === '{{baseUrl}}/agent/list',
    `首事件应为列表路由覆写后的 nav：${JSON.stringify(run.emitted[0].url)}`);
  assert(run.emitted[3].action === 'click' && run.emitted[3].text === '删除',
    `第 4 事件应为「删除」点击：${JSON.stringify(run.emitted[3].text)}`);
  // 「删除」点击真穿了删除域锁：空页上拿不到目标记录，动作轴非 unique（真链路结果，非夹具指定）。
  assert(results[3].resolution !== 'unique',
    `空页上删除域锁不应判 unique：${results[3].resolution}`);
  // fail-closed 消费：未经因果核实的「确定」文案绝不落点击。
  assert(!run.emitted.some((ev) => ev.text === '确定'),
    '确认弹层非唯一时绝不得发出「确定」点击事件（fail-closed）');
  assert(run.blockers.length === 1 && run.blockers[0].includes('agent.delete 因果确认弹层内确认按钮非唯一/缺席'),
    `应压且只压一条确认弹层硬阻断：${JSON.stringify(run.blockers)}`);
  assert(run.notes[run.notes.length - 1] === run.blockers[0],
    'notes 末条须与硬阻断同文（既有记账形状）');
});

await check('S2 不命中该分支的形态：agent.openToolPicker 走同一函数零阻断（回归钉）', async () => {
  const { run, threw, results } = await runRecipe('agent.openToolPicker', {});
  assert(threw === null,
    `不得抛：${threw?.constructor?.name}: ${String(threw?.message).slice(0, 160)}`);
  assert(Array.isArray(results) && results.length === 1, `应恰发 1 个事件：${results && results.length}`);
  assert(run.emitted[0].atom === 'agent.openToolPicker' && run.emitted[0].text === '添加',
    `事件形状应为「添加」点击：${JSON.stringify(run.emitted[0])}`);
  assert(run.blockers.length === 0, `不命中 agent.delete 支路不得压阻断：${JSON.stringify(run.blockers)}`);
});

await check('S3 结构钉：compile-atoms-agent 从 workflow-delete-domain 导入 inspectWorkflowDeleteConfirm', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../../lib/compile-atoms-agent.mjs', import.meta.url), 'utf8');
  const importLine = src.split('\n').find((l) => l.startsWith('import') && l.includes("from './workflow-delete-domain.mjs'"));
  assert(importLine, "import 清单须有一行来自 './workflow-delete-domain.mjs'");
  assert(importLine.includes('inspectWorkflowDeleteConfirm'),
    `该行须导入 inspectWorkflowDeleteConfirm：${importLine}`);
});

await check('S4 消费形状钉（静态）：unique 分支把 inspected.confirmName 回写进配方 text', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../../lib/compile-atoms-agent.mjs', import.meta.url), 'utf8');
  const start = src.indexOf('const inspected = await inspectWorkflowDeleteConfirm(run.page);');
  assert(start >= 0, '未找到 agent.delete 确认步的 inspect 调用');
  const body = src.slice(start, start + 600);
  assert(body.includes("inspected.resolution !== 'unique'") && body.includes('!inspected.confirmName'),
    '确认步须同时校 resolution 与 confirmName（fail-closed 双判据）');
  assert(/recipe\s*=\s*\{\s*\.\.\.recipe,\s*text:\s*inspected\.confirmName\s*\}/.test(body),
    'unique 分支须把 inspected.confirmName 回写进配方 text（拒用全页最后一个按钮）');
});

const total = passed + failures.length;
if (failures.length) {
  console.error(`\nnot ok ${TAG}: ${passed}/${total} 通过，${failures.length} 条红`);
  process.exit(1);
}
console.log(`ok   ${TAG}: ${passed}/${total} 全过`);
