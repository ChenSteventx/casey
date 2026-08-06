#!/usr/bin/env node
// post-nav-anchor-wait：workflow.open 文本锚与 deleteByName 搜索框锚在 nav 后必须有有界就绪等待。
// 根因：列表页 SPA 渲染尾巴（真机定量 load 后约 +3.5s 控件才可定位）vs 编译 nav 后锚定窗约 4s——
// 同类竞态第三处（前两处：create 入口锚、登录导航预算）。B4 五跑 atstep_9 workflow.open absent、
// 四跑 deleteByName 搜索框 count=0 误落 CASE_DEFECT 候选，均为实证。
// 修法：各加 250ms 步长、15s 预算轮询；耗尽不改判照走既有 fail-closed 路径。零 SUT、零网络、零浏览器。

const TAG = 'post-nav-anchor-wait';
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

const { compileWorkflowOpen } = await import('../../lib/compile-atoms-workflow-nav.mjs');
const { compileWorkflowDelete } = await import('../../lib/compile-atoms-workflow-crud.mjs');
const { SEARCH_BOX_NAME } = await import('../../lib/compile-atoms-support.mjs');

function zeroLocator() {
  const zero = () => ({
    count: async () => 0,
    first: () => zero(),
    last: () => zero(),
    waitFor: async () => { throw new Error('not mounted'); },
    evaluate: async () => undefined,
    evaluateAll: async () => [],
    elementHandles: async () => [],
    click: async () => {},
    fill: async () => {},
    press: async () => {},
    textContent: async () => null,
    locator: () => zero(),
    getByText: () => zero(),
    filter: () => zero(),
  });
  return zero();
}

// S1/S3 塑形替身：目标文本 mountAfterMs 后可定位（真实前置形态=卡片渲染尾巴）；命中元素在
// 列表记录容器内（evaluate closest → true，忠实于真实 .agent-card 卡片）。其余定位零命中。
function makeOpenPage(stats, targetText, mountAfterMs) {
  const t0 = Date.now();
  const mounted = () => Date.now() - t0 >= mountAfterMs;
  return {
    mounted,
    getByText: (text, opts) => {
      if (text === targetText && opts?.exact === true) {
        return {
          count: async () => { stats.textSamples += 1; return mounted() ? 1 : 0; },
          evaluate: async () => true,
          first: () => zeroLocator(),
        };
      }
      return zeroLocator();
    },
    getByRole: () => zeroLocator(),
    getByLabel: () => zeroLocator(),
    locator: () => zeroLocator(),
    evaluate: async () => undefined,
    waitForTimeout: async () => {},
    waitForURL: async () => {},
    url: () => 'https://sut.invalid/heren/aimanagement/process/detail',
    mouse: { click: async () => {} },
  };
}

// S2/S4 塑形替身：搜索框 mountAfterMs 后可定位；其余零命中（计数对账门在零命中页会如实不恒等，
// 那是既有 fail-closed 行为、不属本金牌断言面）。
function makeDeletePage(stats, mountAfterMs) {
  const t0 = Date.now();
  const mounted = () => Date.now() - t0 >= mountAfterMs;
  return {
    mounted,
    getByRole: (role, opts) => {
      if (role === 'textbox' && opts?.name === SEARCH_BOX_NAME) {
        return {
          count: async () => { stats.searchSamples += 1; return mounted() ? 1 : 0; },
          first: () => zeroLocator(),
          fill: async () => {},
          press: async () => {},
        };
      }
      return zeroLocator();
    },
    getByText: () => zeroLocator(),
    getByLabel: () => zeroLocator(),
    locator: () => zeroLocator(),
    evaluate: async () => undefined,
    waitForTimeout: async () => {},
    url: () => 'https://sut.invalid/heren/aimanagement/process/list',
    mouse: { click: async () => {} },
  };
}

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
    caseDefectCandidates: [],
    countAudit: null,
    identityLedger: null,
    identityObservations: [],
    targetContinuityRefs: [],
    profile: {},
    listRoute: '/heren/aimanagement/process/list',
    stepN: 0,
    intentN: 0,
    newIntent() { this.intentN += 1; return `atintent_${this.intentN}`; },
    mark() { return { events: this.events.length, stepN: this.stepN, intentN: this.intentN }; },
    rollback(m) { this.events.length = m.events; this.emitted.length = m.events; this.stepN = m.stepN; this.intentN = m.intentN; },
    async emit(spec, customAct) {
      const stepId = `atstep_${this.stepN++}`;
      const ev = { stepId, ...spec };
      if (spec.atom === 'workflow.open' && spec.action === 'click') ev.targetMountedAtEmit = this.page.mounted();
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

await check('S1 open 迟挂载行为钉：点击 emit 必须发生在目标文本可定位之后（真轮询过、容器闸照走）', async () => {
  const stats = { textSamples: 0 };
  const run = makeRun(makeOpenPage(stats, 'atl_u1', 1200));
  let threw = null;
  try {
    await compileWorkflowOpen(run, { openName: 'atl_{{uniqueName}}' });
  } catch (error) {
    threw = error;
  }
  assert(threw === null, `不得抛：${threw?.constructor?.name}: ${String(threw?.message).slice(0, 160)}`);
  const click = run.emitted.find((e) => e.atom === 'workflow.open' && e.action === 'click');
  assert(click, '必须发出 open 点击 emit');
  assert(click.targetMountedAtEmit === true,
    `open 点击 emit 时目标文本必须已可定位（迟挂载 1.2s 内须等待）：${click.targetMountedAtEmit}`);
  assert(stats.textSamples >= 2, `就绪锚须真轮询目标文本 count（≥2 次采样）：${stats.textSamples}`);
  assert(run.blockers.length === 0, `容器归属闸命中容器内元素不得压阻断：${JSON.stringify(run.blockers)}`);
});

await check('S2 delete 搜索框迟挂载行为钉：不误落 CASE_DEFECT、fill/press 照发', async () => {
  const stats = { searchSamples: 0 };
  const run = makeRun(makeDeletePage(stats, 1200));
  let threw = null;
  try {
    await compileWorkflowDelete(run, { name: 'atl_{{uniqueName}}' });
  } catch (error) {
    threw = error;
  }
  assert(threw === null, `不得抛：${threw?.constructor?.name}: ${String(threw?.message).slice(0, 160)}`);
  assert(run.caseDefectCandidates.length === 0,
    `搜索框迟挂载不得误判入口缺席（CASE_DEFECT 候选应为空）：${JSON.stringify(run.caseDefectCandidates)}`);
  assert(stats.searchSamples >= 2, `就绪锚须真轮询搜索框 count（≥2 次采样）：${stats.searchSamples}`);
  const actions = run.emitted.map((e) => e.action);
  assert(actions.includes('fill') && actions.includes('press'),
    `过就绪锚后 fill/press 应照发：${actions.join(',')}`);
});

await check('S3 open 预算耗尽零行为差钉：目标永不挂载照发 absent 路径 emit、总耗时有界', async () => {
  const stats = { textSamples: 0 };
  const run = makeRun(makeOpenPage(stats, 'atl_u1', Infinity));
  const t0 = Date.now();
  let threw = null;
  try {
    await compileWorkflowOpen(run, { openName: 'atl_{{uniqueName}}' });
  } catch (error) {
    threw = error;
  }
  const elapsed = Date.now() - t0;
  assert(threw === null, `不得抛：${threw?.constructor?.name}: ${String(threw?.message).slice(0, 160)}`);
  assert(elapsed < 20000, `等待预算必须有界（<20s）：${elapsed}ms`);
  const click = run.emitted.find((e) => e.atom === 'workflow.open' && e.action === 'click');
  assert(click && click.targetMountedAtEmit === false,
    '永不挂载时照发 emit（由身份门记 absent，不改判、不跳步）');
});

await check('S4 delete 预算耗尽零行为差钉：搜索框永不挂载照落 CASE_DEFECT 候选、事件只有 nav', async () => {
  const stats = { searchSamples: 0 };
  const run = makeRun(makeDeletePage(stats, Infinity));
  const t0 = Date.now();
  let threw = null;
  try {
    await compileWorkflowDelete(run, { name: 'atl_{{uniqueName}}' });
  } catch (error) {
    threw = error;
  }
  const elapsed = Date.now() - t0;
  assert(threw === null, `不得抛：${threw?.constructor?.name}: ${String(threw?.message).slice(0, 160)}`);
  assert(elapsed < 20000, `等待预算必须有界（<20s）：${elapsed}ms`);
  assert(run.caseDefectCandidates.length === 1
    && run.caseDefectCandidates[0].atom === 'workflow.deleteByName',
    `真缺席仍须如实落 CASE_DEFECT 候选（零行为差）：${JSON.stringify(run.caseDefectCandidates)}`);
  assert(run.emitted.length === 0,
    `rollback 后不留任何事件（既有行为）：${run.emitted.map((e) => e.action).join(',')}`);
});

await check('S5 结构钉：两处就绪锚在各自判定点之前 + nav 模块导入 sleep', async () => {
  const { readFileSync } = await import('node:fs');
  const navSrc = readFileSync(new URL('../../lib/compile-atoms-workflow-nav.mjs', import.meta.url), 'utf8');
  const crudSrc = readFileSync(new URL('../../lib/compile-atoms-workflow-crud.mjs', import.meta.url), 'utf8');
  const navFn = navSrc.slice(navSrc.indexOf('export async function compileWorkflowOpen'));
  const navBeforeProbe = navFn.slice(0, navFn.indexOf('容器归属闸'));
  assert(navBeforeProbe.includes('就绪锚') && navBeforeProbe.includes('15000') && /count\(\)/.test(navBeforeProbe),
    'compileWorkflowOpen 容器归属闸前须有就绪锚（注释 + 15000 + count() 轮询）');
  const navImport = navSrc.split('\n').find((l) => l.startsWith('import') && l.includes("from './compile-atoms-support.mjs'"));
  assert(navImport && /[{,]\s*sleep\s*[,}]/.test(navImport), `nav 模块 import 行须含 sleep：${navImport}`);
  const delFn = crudSrc.slice(crudSrc.indexOf('export async function compileWorkflowDelete'));
  const delBeforeCheck = delFn.slice(0, delFn.indexOf('const n = await search.count()'));
  assert(delBeforeCheck.includes('就绪锚') && delBeforeCheck.includes('15000'),
    'compileWorkflowDelete 搜索框判定前须有就绪锚（注释 + 15000）');
});

const total = passed + failures.length;
if (failures.length) {
  console.error(`\nnot ok ${TAG}: ${passed}/${total} 通过，${failures.length} 条红`);
  process.exit(1);
}
console.log(`ok   ${TAG}: ${passed}/${total} 全过`);
