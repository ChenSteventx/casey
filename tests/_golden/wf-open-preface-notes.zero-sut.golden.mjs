#!/usr/bin/env node
// wf-open-preface-notes：workflow.open 前奏与锚定必须产诊断 notes（进 exit-65 compile-report，
// 供 route:human 取证——B4 八跑 absent 谜面的现场证据位）。纯诊断零行为差。零 SUT、零网络、零浏览器。

const TAG = 'wf-open-preface-notes';
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

function makePage({ searchPresent, targetFromStart, looseFromStart = false }, targetText, state) {
  return {
    getByRole: (role, opts) => {
      if (role === 'textbox' && opts?.name === SEARCH_BOX_NAME && searchPresent) {
        return { count: async () => 1, first: () => zeroLocator(), fill: async () => {}, press: async () => {} };
      }
      return zeroLocator();
    },
    getByText: (text, opts) => {
      if (text === targetText && opts?.exact === true && (targetFromStart || looseFromStart || state.searchIssued)) {
        return { count: async () => 1, evaluate: async () => true, first: () => zeroLocator() };
      }
      return zeroLocator();
    },
    getByLabel: () => zeroLocator(),
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
    evaluate: async () => ({ len: 42, cards: targetFromStart || state.searchIssued ? 1 : 0, inputs: searchPresent ? 1 : 0 }),
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

await check('S1 搜索路径诊断钉：前奏与锚定 notes 齐全、字段如实、事件序不变', async () => {
  const state = { searchIssued: false };
  const run = makeRun(makePage({ searchPresent: true, targetFromStart: false }, 'atl_u1', state), state);
  let threw = null;
  try {
    await compileWorkflowOpen(run, { openName: 'atl_{{uniqueName}}' });
  } catch (error) {
    threw = error;
  }
  assert(threw === null, `不得抛：${threw?.constructor?.name}: ${String(threw?.message).slice(0, 160)}`);
  const preface = run.notes.find((n) => n.includes('workflow.open 前奏诊断'));
  assert(preface, `须有前奏诊断 note：${JSON.stringify(run.notes)}`);
  assert(/container=false loose=false branch=true searched=true 采样=\d+ 耗时=\d+ms 页面态=text42\/卡1\/框1/.test(preface),
    `前奏诊断字段须如实（搜索路径）：${preface}`);
  const anchor = run.notes.find((n) => n.includes('workflow.open 锚定诊断'));
  assert(anchor && /授予=true 命中=true 采样=\d+ 耗时=\d+ms/.test(anchor),
    `锚定诊断字段须如实（授予+命中）：${anchor}`);
  assert(run.emitted.length === 3, `事件序不变（3 事件）：${run.emitted.map((e) => e.action).join(',')}`);
  assert(run.blockers.length === 0, `零阻断：${JSON.stringify(run.blockers)}`);
});

await check('S2 全缺席诊断钉：notes 如实记全缺席、行为零差（1 absent 点击、零阻断、有界）', async () => {
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
  assert(elapsed < 20000, `全缺席封顶不变（<20s）：${elapsed}ms`);
  const preface = run.notes.find((n) => n.includes('workflow.open 前奏诊断'));
  assert(preface && /container=false loose=false branch=false searched=false/.test(preface),
    `前奏诊断须如实记全缺席：${preface}`);
  const anchor = run.notes.find((n) => n.includes('workflow.open 锚定诊断'));
  assert(anchor && /授予=false 命中=false/.test(anchor), `锚定诊断须如实记让行：${anchor}`);
  const clicks = run.emitted.filter((e) => e.action === 'click');
  assert(clicks.length === 1 && !run.emitted.some((e) => e.action === 'fill'),
    `行为零差（1 点击零 fill）：${run.emitted.map((e) => e.action).join(',')}`);
  assert(run.blockers.length === 0, `零阻断：${JSON.stringify(run.blockers)}`);
});

await check('S4 采样异常钉：evaluate 拒/挂起均如实记「采样异常」、不抛、行为零差、竞速有界', async () => {
  // 拒绝面
  const stateA = { searchIssued: false };
  const pageA = makePage({ searchPresent: true, targetFromStart: false }, 'atl_u1', stateA);
  pageA.evaluate = async () => { throw new Error('boom'); };
  const runA = makeRun(pageA, stateA);
  let threwA = null;
  try {
    await compileWorkflowOpen(runA, { openName: 'atl_{{uniqueName}}' });
  } catch (error) {
    threwA = error;
  }
  assert(threwA === null, `拒绝面不得抛：${String(threwA?.message).slice(0, 100)}`);
  const noteA = runA.notes.find((n) => n.includes('workflow.open 前奏诊断'));
  assert(noteA && noteA.includes('页面态=采样异常'), `拒绝面须如实记采样异常：${noteA}`);
  assert(runA.emitted.length === 3 && runA.blockers.length === 0, '拒绝面行为零差（3 事件零阻断）');
  // 挂起面（竞速 3s 让行）
  const stateB = { searchIssued: false };
  const pageB = makePage({ searchPresent: true, targetFromStart: false }, 'atl_u1', stateB);
  pageB.evaluate = () => new Promise(() => {});
  const runB = makeRun(pageB, stateB);
  const t0 = Date.now();
  let threwB = null;
  try {
    await compileWorkflowOpen(runB, { openName: 'atl_{{uniqueName}}' });
  } catch (error) {
    threwB = error;
  }
  const elapsed = Date.now() - t0;
  assert(threwB === null, `挂起面不得抛：${String(threwB?.message).slice(0, 100)}`);
  const noteB = runB.notes.find((n) => n.includes('workflow.open 前奏诊断'));
  assert(noteB && noteB.includes('页面态=采样异常'), `挂起面须如实记采样异常：${noteB}`);
  assert(elapsed < 8000, `竞速须 3s 让行（总耗时 <8s）：${elapsed}ms`);
  assert(runB.emitted.length === 3 && runB.blockers.length === 0, '挂起面行为零差（3 事件零阻断）');
});

await check('S3 结构钉：前奏诊断在就绪锚之前、锚定诊断在锚定循环之后', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../../lib/compile-atoms-workflow-nav.mjs', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('export async function compileWorkflowOpen'));
  const prefaceNoteAt = fn.indexOf('前奏诊断');
  const anchorCommentAt = fn.indexOf('就绪锚');
  const anchorNoteAt = fn.indexOf('锚定诊断');
  assert(prefaceNoteAt >= 0 && anchorCommentAt >= 0 && prefaceNoteAt < anchorCommentAt,
    '前奏诊断须在就绪锚之前');
  assert(anchorNoteAt >= 0 && anchorNoteAt > anchorCommentAt, '锚定诊断须在锚定段之后');
  assert(fn.includes('openPrefaceSamples') && fn.includes('openAnchorSamples'), '采样计数器须在场');
});

const total = passed + failures.length;
if (failures.length) {
  console.error(`\nnot ok ${TAG}: ${passed}/${total} 通过，${failures.length} 条红`);
  process.exit(1);
}
console.log(`ok   ${TAG}: ${passed}/${total} 全过`);
