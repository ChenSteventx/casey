#!/usr/bin/env node
// wf-create-entry-anchor-wait：workflow.create 入口点击前必须有有界就绪锚。
// 根因：真机列表页 load 后按钮还有约 3.5s 渲染尾巴，编译 nav 后锚定窗约 4s，压线必抖
// （2026-08-06 晨 B4 实测 atstep_1 absent count=0，08-04 傍晚同链路通过——竞态非偶发）。
// 修法：入口点击 emit 前对同一语义锚轮询 count()（预算 15s），可定位即点；预算耗尽不改判、
// 照旧走既有 absent fail-closed 路径（零行为差）。零 SUT、零网络、零浏览器。

const TAG = 'wf-create-entry-anchor-wait';
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

// 迟挂载塑形替身：忠实复现「SPA 渲染尾巴」——入口按钮在 mountAfterMs 后才可定位；
// 其余定位一律零命中（同空页替身自洽）。等待与否、何时点击是被测代码自己的决定。
// mountAfterMs === Infinity 复现「按钮永不挂载」（S2 预算耗尽面）。
function makeLateMountPage(stats, mountAfterMs) {
  const t0 = Date.now();
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
  const entryMounted = () => Date.now() - t0 >= mountAfterMs;
  return {
    entryMounted,
    getByRole: (role, opts) => {
      if (role === 'button' && opts?.name === '新增工作流' && opts?.exact === true) {
        return {
          count: async () => { stats.entryCountSamples += 1; return entryMounted() ? 1 : 0; },
          first: () => zero(),
        };
      }
      return zero();
    },
    getByText: () => zero(),
    getByLabel: () => zero(),
    locator: () => zero(),
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
    identityLedger: null,
    profile: {},
    listRoute: '/heren/aimanagement/process/list',
    stepN: 0,
    intentN: 0,
    newIntent() { this.intentN += 1; return `atintent_${this.intentN}`; },
    async emit(spec, customAct) {
      const stepId = `atstep_${this.stepN++}`;
      const ev = { stepId, ...spec };
      // 记录入口点击 emit 发出那一刻按钮是否已挂载（红绿判别核心：现行代码不等待、此刻必为假）。
      if (spec.action === 'click' && spec.semantic?.role === 'button' && spec.semantic?.name === '新增工作流') {
        ev.entryMountedAtEmit = this.page.entryMounted();
      }
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

const CREATE_PARAMS = {
  name: 'atl_{{uniqueName}}',
  desc: 'Casey 编译期冒烟固定描述（非易变，可冻字面量）',
  category: '测试分类',
};

await check('S1 迟挂载行为钉：入口点击 emit 必须发生在按钮可定位之后（真轮询过）', async () => {
  const stats = { entryCountSamples: 0 };
  const run = makeRun(makeLateMountPage(stats, 1200));
  let threw = null;
  try {
    await compileWorkflowCreate(run, CREATE_PARAMS);
  } catch (error) {
    threw = error;
  }
  assert(threw === null, `不得抛：${threw?.constructor?.name}: ${String(threw?.message).slice(0, 160)}`);
  const entryClick = run.emitted.find((e) => e.action === 'click' && e.semantic?.name === '新增工作流');
  assert(entryClick, '必须发出入口点击 emit');
  assert(entryClick.entryMountedAtEmit === true,
    `入口点击 emit 时按钮必须已可定位（迟挂载 1.2s 内须等待）：entryMountedAtEmit=${entryClick.entryMountedAtEmit}`);
  assert(stats.entryCountSamples >= 2,
    `就绪锚须真轮询按钮 count（≥2 次采样）：${stats.entryCountSamples}`);
  assert(run.emitted.length === 6,
    `事件序列须与既有空页序一致（6 事件）：${run.emitted.length}（${run.emitted.map((e) => e.action).join(',')}）`);
});

await check('S2 预算耗尽零行为差钉：按钮永不挂载时事件序列与现行 absent 路径一致且有界', async () => {
  const stats = { entryCountSamples: 0 };
  const run = makeRun(makeLateMountPage(stats, Infinity));
  const t0 = Date.now();
  let threw = null;
  try {
    await compileWorkflowCreate(run, CREATE_PARAMS);
  } catch (error) {
    threw = error;
  }
  const elapsed = Date.now() - t0;
  assert(threw === null, `不得抛：${threw?.constructor?.name}: ${String(threw?.message).slice(0, 160)}`);
  assert(elapsed < 20000, `等待预算必须有界（<20s，不挂死）：${elapsed}ms`);
  const actions = run.emitted.map((e) => e.action);
  assert(run.emitted.length === 6 && actions.join(',') === 'nav,click,fill,click,click,click',
    `预算耗尽后事件序列必须与现行路径逐位一致：${actions.join(',')}`);
  const entryClick = run.emitted.find((e) => e.action === 'click' && e.semantic?.name === '新增工作流');
  assert(entryClick && entryClick.entryMountedAtEmit === false,
    '永不挂载时照旧发 emit（由身份门记 absent，不改判、不跳步）');
});

await check('S3 结构钉：入口点击 emit 之前有有界就绪锚（注释 + 15s 预算 + count 轮询）', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../../lib/compile-atoms-workflow-crud.mjs', import.meta.url), 'utf8');
  const fnStart = src.indexOf('export async function compileWorkflowCreate');
  assert(fnStart >= 0, '未找到 compileWorkflowCreate');
  const clickEmitAt = src.indexOf("semantic: { kind: 'role', role: 'button', name: '新增工作流', exact: true }", fnStart);
  assert(clickEmitAt >= 0, '未找到入口点击 emit');
  const between = src.slice(fnStart, clickEmitAt);
  assert(between.includes('入口就绪锚'), '入口点击 emit 前须有「入口就绪锚」实现（含同名注释）');
  assert(between.includes('15000'), '就绪锚预算须为 15s（15000）');
  assert(/count\(\)/.test(between), '就绪锚须以 count() 轮询同一语义锚');
});

const total = passed + failures.length;
if (failures.length) {
  console.error(`\nnot ok ${TAG}: ${passed}/${total} 通过，${failures.length} 条红`);
  process.exit(1);
}
console.log(`ok   ${TAG}: ${passed}/${total} 全过`);
