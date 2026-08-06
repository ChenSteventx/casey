#!/usr/bin/env node
// wf-open-search-first：workflow.open 必须搜索先行（填搜索框→点放大镜强制新查询→再锚定点名）。
// 根因：create 后 SPA 停在列表路由、同址 nav 不触发列表重查询，新建卡片不进 DOM——就绪锚轮满
// 15s 也等不来（B4 六跑实证；页签过滤假设已探针否证）。搜索图标点击强制按名新查询（seam-1 已核
// Enter 不过滤；清偿链实战同姿势）。零 SUT、零网络、零浏览器。

const TAG = 'wf-open-search-first';
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
const { SEARCH_BOX_NAME } = await import('../../lib/compile-atoms-support.mjs');

function zeroLocator() {
  const zero = () => ({
    count: async () => 0,
    first: () => zero(),
    waitFor: async () => { throw new Error('not mounted'); },
    evaluate: async () => undefined,
    elementHandles: async () => [],
    click: async () => {},
    fill: async () => {},
    textContent: async () => null,
    locator: () => zero(),
    getByText: () => zero(),
    filter: () => zero(),
  });
  return zero();
}

// 塑形替身：searchPresent 控制搜索框在场性；targetPresent 控制目标文本在场性（在场即于
// 列表记录容器内，忠实于真实 .agent-card 形态）。
function makePage({ searchPresent, targetPresent }, targetText) {
  return {
    getByRole: (role, opts) => {
      if (role === 'textbox' && opts?.name === SEARCH_BOX_NAME && searchPresent) {
        return { count: async () => 1, first: () => zeroLocator(), fill: async () => {}, press: async () => {} };
      }
      return zeroLocator();
    },
    getByText: (text, opts) => {
      if (text === targetText && opts?.exact === true && targetPresent) {
        return { count: async () => 1, evaluate: async () => true, first: () => zeroLocator() };
      }
      return zeroLocator();
    },
    getByLabel: () => zeroLocator(),
    locator: () => zeroLocator(),
    evaluate: async () => undefined,
    waitForTimeout: async () => {},
    waitForURL: async () => {},
    url: () => 'https://sut.invalid/heren/aimanagement/process/detail',
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
    identityLedger: null,
    profile: {},
    listRoute: '/heren/aimanagement/process/list',
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

await check('S1 搜索先行形状钉：恰发 fill(搜索) → click(放大镜) → click(目标名) 三事件', async () => {
  const run = makeRun(makePage({ searchPresent: true, targetPresent: true }, 'atl_u1'));
  let threw = null;
  try {
    await compileWorkflowOpen(run, { openName: 'atl_{{uniqueName}}' });
  } catch (error) {
    threw = error;
  }
  assert(threw === null, `不得抛：${threw?.constructor?.name}: ${String(threw?.message).slice(0, 160)}`);
  assert(run.emitted.length === 3,
    `应恰发 3 事件：${run.emitted.length}（${run.emitted.map((e) => e.action).join(',')}）`);
  assert(run.emitted[0].action === 'fill'
    && run.emitted[0].semantic?.role === 'textbox' && run.emitted[0].semantic?.name === SEARCH_BOX_NAME
    && run.emitted[0].value === 'atl_{{uniqueName}}',
    `首事件应为搜索框 fill（值=openName 模板原样）：${JSON.stringify({ action: run.emitted[0].action, value: run.emitted[0].value })}`);
  assert(run.emitted[1].action === 'click' && run.emitted[1].fallbackCss === '.hr-input__suffix .search-icon',
    `次事件应为放大镜点击（fallbackCss）：${JSON.stringify({ action: run.emitted[1].action, fallbackCss: run.emitted[1].fallbackCss })}`);
  assert(run.emitted[2].action === 'click' && run.emitted[2].semantic?.kind === 'text'
    && run.emitted[2].semantic?.name === 'atl_{{uniqueName}}' && run.emitted[2].semantic?.exact === true,
    `末事件应为目标名 text-exact 点击：${JSON.stringify(run.emitted[2].semantic)}`);
  assert(run.blockers.length === 0, `零阻断：${JSON.stringify(run.blockers)}`);
});

await check('S2 搜索框缺席跳过钉：零 fill、仍发 absent 路径名字点击、有界、零阻断', async () => {
  const run = makeRun(makePage({ searchPresent: false, targetPresent: false }, 'atl_u1'));
  const t0 = Date.now();
  let threw = null;
  try {
    await compileWorkflowOpen(run, { openName: 'atl_{{uniqueName}}' });
  } catch (error) {
    threw = error;
  }
  const elapsed = Date.now() - t0;
  assert(threw === null, `不得抛：${threw?.constructor?.name}: ${String(threw?.message).slice(0, 160)}`);
  assert(elapsed < 40000, `两段预算须有界（搜索框 15s + 目标锚 15s，<40s）：${elapsed}ms`);
  assert(!run.emitted.some((e) => e.action === 'fill'), `搜索框缺席不得发 fill：${run.emitted.map((e) => e.action).join(',')}`);
  const clicks = run.emitted.filter((e) => e.action === 'click');
  assert(clicks.length === 1 && clicks[0].semantic?.kind === 'text',
    `仍应恰发 1 个名字点击 emit（absent 路径不改判）：${JSON.stringify(clicks.map((c) => c.semantic))}`);
  assert(run.blockers.length === 0, `跳过不阻断（身份门语义不动）：${JSON.stringify(run.blockers)}`);
});

await check('S3 结构钉：搜索先行在就绪锚之前 + 放大镜 css + 搜索框轮询', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../../lib/compile-atoms-workflow-nav.mjs', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('export async function compileWorkflowOpen'));
  const searchAt = fn.indexOf('搜索先行');
  const anchorAt = fn.indexOf('就绪锚');
  assert(searchAt >= 0, '须有「搜索先行」实现（含同名注释）');
  assert(anchorAt >= 0 && searchAt < anchorAt, '搜索先行须在就绪锚之前');
  const preface = fn.slice(searchAt, anchorAt);
  assert(preface.includes('.hr-input__suffix .search-icon'), '放大镜点击须用实采 css');
  assert(preface.includes('15000') && /count\(\)/.test(preface), '搜索框须有 15s 有界 count() 轮询');
});

const total = passed + failures.length;
if (failures.length) {
  console.error(`\nnot ok ${TAG}: ${passed}/${total} 通过，${failures.length} 条红`);
  process.exit(1);
}
console.log(`ok   ${TAG}: ${passed}/${total} 全过`);
