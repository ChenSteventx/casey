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

// 状态化塑形替身：searchPresent 控制搜索框在场性；目标文本可见性 = targetFromStart（列表已
// 新鲜）或 state.searchIssued（搜索图标点击后新查询返回——忠实于「查询驱动渲染」的真实机制）。
// 在场即于列表记录容器内（evaluate→true，忠实于真实 .agent-card 形态）。
function makePage({ searchPresent, targetFromStart, looseFromStart = false }, targetText, state) {
  return {
    getByRole: (role, opts) => {
      if (role === 'textbox' && opts?.name === SEARCH_BOX_NAME && searchPresent) {
        return { count: async () => 1, first: () => zeroLocator(), fill: async () => {}, press: async () => {} };
      }
      return zeroLocator();
    },
    // 裸 getByText 面：looseFromStart 复现瞬态回显（创建成功 toast——文本在页上但不在记录容器内）。
    getByText: (text, opts) => {
      if (text === targetText && opts?.exact === true && (targetFromStart || looseFromStart || state.searchIssued)) {
        return { count: async () => 1, evaluate: async () => true, first: () => zeroLocator() };
      }
      return zeroLocator();
    },
    getByLabel: () => zeroLocator(),
    // 容器限定探针面（B4 七跑修正）：容器内 getByText 只在目标真在记录容器里时命中——
    // 瞬态回显（toast 等）不在容器内，忠实于「已见目标=列表已新鲜」的判定标准。
    locator: (css) => {
      if (typeof css === 'string' && css.includes('.agent-card')) {
        return {
          getByText: (text, opts) => {
            if (text === targetText && opts?.exact === true && (targetFromStart || state.searchIssued)) {
              return { count: async () => 1, evaluate: async () => true, first: () => zeroLocator() };
            }
            return zeroLocator();
          },
        };
      }
      return zeroLocator();
    },
    evaluate: async () => undefined,
    waitForTimeout: async () => {},
    waitForURL: async () => {},
    url: () => 'https://sut.invalid/heren/aimanagement/process/detail',
    mouse: { click: async () => {} },
  };
}

function makeRun(page, state = {}) {
  const emitted = [];
  return {
    emitted,
    state,
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
      // 查询驱动渲染的忠实复现：搜索图标点击一经记录，新查询返回、目标可见。
      if (spec.action === 'click' && spec.fallbackCss === '.hr-input__suffix .search-icon') this.state.searchIssued = true;
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

await check('S1 搜索先行形状钉：目标不在旧 DOM 时恰发 fill(搜索) → click(放大镜) → click(目标名) 三事件', async () => {
  const state = { searchIssued: false };
  const run = makeRun(makePage({ searchPresent: true, targetFromStart: false }, 'atl_u1', state), state);
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

await check('S2 双缺席封顶钉：零 fill、仍发 absent 路径名字点击、失败路径总额 <20s、零阻断', async () => {
  const state = { searchIssued: false };
  const run = makeRun(makePage({ searchPresent: false, targetFromStart: false }, 'atl_u1', state), state);
  const t0 = Date.now();
  let threw = null;
  try {
    await compileWorkflowOpen(run, { openName: 'atl_{{uniqueName}}' });
  } catch (error) {
    threw = error;
  }
  const elapsed = Date.now() - t0;
  assert(threw === null, `不得抛：${threw?.constructor?.name}: ${String(threw?.message).slice(0, 160)}`);
  assert(elapsed < 20000, `条件预算封顶：双缺席失败路径总额恒 ~15s、绝不叠加（<20s）：${elapsed}ms`);
  assert(!run.emitted.some((e) => e.action === 'fill'), `搜索框缺席不得发 fill：${run.emitted.map((e) => e.action).join(',')}`);
  const clicks = run.emitted.filter((e) => e.action === 'click');
  assert(clicks.length === 1 && clicks[0].semantic?.kind === 'text',
    `仍应恰发 1 个名字点击 emit（absent 路径不改判）：${JSON.stringify(clicks.map((c) => c.semantic))}`);
  assert(run.blockers.length === 0, `跳过不阻断（身份门语义不动）：${JSON.stringify(run.blockers)}`);
});

await check('S4 列表已新鲜直点钉：目标本就在 DOM 时零搜索事件、恰发 1 个名字点击', async () => {
  const state = { searchIssued: false };
  const run = makeRun(makePage({ searchPresent: true, targetFromStart: true }, 'atl_u1', state), state);
  let threw = null;
  try {
    await compileWorkflowOpen(run, { openName: 'atl_{{uniqueName}}' });
  } catch (error) {
    threw = error;
  }
  assert(threw === null, `不得抛：${threw?.constructor?.name}: ${String(threw?.message).slice(0, 160)}`);
  assert(!run.emitted.some((e) => e.action === 'fill'), `已新鲜列表不得发搜索 fill：${run.emitted.map((e) => e.action).join(',')}`);
  assert(run.emitted.length === 1 && run.emitted[0].action === 'click' && run.emitted[0].semantic?.kind === 'text',
    `应恰发 1 个名字点击：${run.emitted.map((e) => e.action).join(',')}`);
  assert(run.blockers.length === 0, `零阻断：${JSON.stringify(run.blockers)}`);
});

await check('S5 toast 假阳判别钉：裸文本命中但容器零命中时必须仍走搜索（不可信不跳过）', async () => {
  const state = { searchIssued: false };
  const run = makeRun(makePage({ searchPresent: true, targetFromStart: false, looseFromStart: true }, 'atl_u1', state), state);
  let threw = null;
  try {
    await compileWorkflowOpen(run, { openName: 'atl_{{uniqueName}}' });
  } catch (error) {
    threw = error;
  }
  assert(threw === null, `不得抛：${threw?.constructor?.name}: ${String(threw?.message).slice(0, 160)}`);
  assert(run.emitted.some((e) => e.action === 'fill'),
    `裸命中（toast 假阳）绝不得跳过搜索：${run.emitted.map((e) => e.action).join(',')}`);
  assert(run.emitted.length === 3,
    `应恰发 3 事件（fill/图标/名字）：${run.emitted.length}（${run.emitted.map((e) => e.action).join(',')}）`);
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
