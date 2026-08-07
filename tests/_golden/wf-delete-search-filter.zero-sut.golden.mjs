#!/usr/bin/env node
// wf-delete-search-filter 验收金牌（红先行、zero-SUT）：workflow.deleteByName 搜索隔离 Enter→放大镜 + 过滤后有界就绪锚。
// 纯 node + mock Page 替身驱【真实】lib/compile-atoms.mjs 的 compileFlow——零浏览器、零网络、零 SUT。
//
// ── 根因（B4 十一跑真机实证，详见 docs/plans/wf-delete-search-filter/plan.md）──
//   删除原子搜索隔离走 fill+Enter（seam-1 真机已证当前被测方 Enter 不过滤、放大镜才过滤；
//   旧版知识残留）——未过滤列表缺目标卡，计数对账门如实 unknown 截断（门无缺陷）。
//   删后重搜同 seam 第二处。修法：两处 Enter→放大镜 + 过滤后 15s 有界就绪锚（预算耗尽不改判）。
//
// ── 钉四件 ──
//   S1 姿势钉（行为+结构双面）：搜索隔离 emits = fill + press Enter（惰性保留——冻结金牌
//      post-nav-anchor-wait S2 包含式钉 fill/press，三 PRD 冻结面，实现让路零字面变更）+
//      放大镜 click（真过滤，必在 press 之后）；函数体恰一处 key:'Enter'（删后重搜第二处
//      退役）且恰两处 search-icon。
//   S2 图标缺席零行为差钉：放大镜 click absent → 不授锚预算（快速通过）→ 审计照跑 fail-closed。
//   S3 目标缺席 fail-closed 钉：放大镜 acted + 目标恒缺席 → 锚满预算（≥14s）→ 计数门 unknown
//      截断、零破坏 click、compileFlow 中止。
//   S4 锚提前放行钉：目标一开始就在容器内 → 锚首采即放行（<5s）→ 链路推进到审计（仍
//      fail-closed 于 unknown——mock 无 elementHandles 域，正好钉「锚不改判」）。
//
// ── 红先行判据 ──
//   现实现走 fill+Enter：S1 行为面（放大镜 click emit 缺席）红、S1 结构面（key:'Enter' 在场）红、
//   S2/S3/S4 各自的放大镜 click emit 断言红；S3 的 ≥14s 锚时长断言红（现实现无锚、快速通过）。

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

let compileAtoms; let createMockPage;
try {
  compileAtoms = await import(resolve(ROOT, 'lib', 'compile-atoms.mjs'));
  ({ createMockPage } = await import(resolve(HERE, 'fixtures', 'agent-id-readback', 'mock-page.mjs')));
} catch (error) {
  console.error(`RED  wf-delete-search-filter: 目标模块缺席 —— ${String(error?.message || error).slice(0, 240)}`);
  process.exit(1);
}
const { createCompileRun, compileFlow } = compileAtoms;

const failures = [];
let passed = 0;
const assert = (cond, msg) => { if (cond) { passed += 1; console.log(`ok   ${msg}`); } else { failures.push(msg); console.error(`FAIL ${msg}`); } };
const brief = (v) => { try { return JSON.stringify(v).slice(0, 200); } catch { return String(v); } };

const SEARCH_KEY = 'role:textbox:输入工作流名称或编码进行搜索';
const ICON_CSS = '.hr-input__suffix .search-icon';
const CONTAINER_UNION = '.hr-table-row, .hr-card.hr-card--bordered, .agent-card';

// mock 页：冻结 createMockPage 包装（locator 补 elementHandles=[] 供 recordDomains 确定性回空——
// 审计走 unknown 阻断，正合本金牌只钉搜索姿势/锚/fail-closed、不入更深删除机械的范围）。
function delPage(dom) {
  const base = createMockPage({ dom, url: 'http://127.0.0.1:4173/', titles: ['工作流管理'] });
  return {
    ...base,
    locator(sel) {
      const l = base.locator(sel);
      return { ...l, elementHandles: async () => [] };
    },
    async waitForURL() {},
    async waitForTimeout() {},
  };
}
function newRun(page) {
  return createCompileRun({
    page, forensics: { records: () => [] }, state: { currentStepId: null },
    sut: 'http://127.0.0.1:4173', uniqueName: 'atl_fixed', site: null,
    agentListRoute: null, profile: null, identityLedger: null,
  });
}
const delStep = (name) => ({
  atom: 'workflow.deleteByName', params: { name },
  sourceIntentId: 'intent_del', entityBindings: [{ candidateId: 'cand-del', role: 'subject' }],
});
const emitsOf = (run) => run.events.map((e) => `${e.action}${e.fallbackCss ? ':' + e.fallbackCss : ''}${e.key ? ':' + e.key : ''}`);

// ════════ S1 姿势钉（行为+结构双面）════════
{
  const page = delPage({
    [SEARCH_KEY]: { count: 1 },
    [`css:${ICON_CSS}`]: { count: 1 },
  });
  const run = newRun(page);
  let crash = null;
  try { await compileFlow(run, { id: 'tc_s1', steps: [delStep('wfdel')] }); } catch (e) { crash = e; }
  assert(crash === null, `S1a 编译不抛（fail-closed 走 blockers）；实得 ${crash ? String(crash && crash.message).slice(0, 120) : 'null'}`);
  const emits = emitsOf(run);
  assert(emits.some((s) => s === `click:${ICON_CSS}`),
    `S1b 搜索隔离含放大镜 click（纯 fallbackCss，真过滤）；实得 emits=${brief(emits)}`);
  const pressAt = emits.findIndex((s) => s.endsWith(':Enter'));
  const iconAt = emits.findIndex((s) => s === `click:${ICON_CSS}`);
  assert(pressAt >= 0 && iconAt > pressAt,
    `S1c press Enter 惰性保留（冻结面让路）且放大镜 click 必在其后（真过滤序钉）；实得 emits=${brief(emits)}`);
  const body = (() => {
    const src = readFileSync(resolve(ROOT, 'lib', 'compile-atoms-workflow-crud.mjs'), 'utf8');
    const start = src.indexOf('export async function compileWorkflowDelete(');
    const next = src.indexOf('\nexport async function', start + 1);
    return start < 0 ? '' : src.slice(start, next < 0 ? src.length : next);
  })();
  assert(body !== '' && (body.split("key: 'Enter'").length - 1) === 1,
    `S1d 结构面：函数体恰一处 key:Enter（搜索隔离惰性保留、删后重搜第二处退役）；实得 ${body === '' ? '函数缺席' : body.split("key: 'Enter'").length - 1}`);
  assert((body.split(ICON_CSS).length - 1) === 2,
    `S1e 结构面：恰两处放大镜 fallbackCss（搜索隔离 + 删后重搜）；实得 ${body.split(ICON_CSS).length - 1}`);
}

// ════════ S2 图标缺席零行为差钉 ════════
{
  const page = delPage({
    [SEARCH_KEY]: { count: 1 },
    // 放大镜缺席（count 0）
  });
  const run = newRun(page);
  const t0 = Date.now();
  try { await compileFlow(run, { id: 'tc_s2', steps: [delStep('wfdel')] }); } catch { /* 崩溃由断言兜出 */ }
  const elapsed = Date.now() - t0;
  const emits = emitsOf(run);
  assert(emits.some((s) => s === `click:${ICON_CSS}`),
    `S2a 放大镜 click emit 在场（resolution 走 absent 通道）；实得 emits=${brief(emits)}`);
  assert(elapsed < 5000,
    `S2b 未真过滤不授锚预算（快速通过，<5s）；实得 ${elapsed}ms`);
  assert(run.blockers.some((b) => b.includes('计数口径不恒等')),
    `S2c 审计照跑 fail-closed（计数门 unknown 截断语义保持）；实得 ${brief(run.blockers)}`);
  assert(!run.events.some((e) => e.text === '删除'), 'S2d 零破坏 click');
}

// ════════ S3 目标缺席 fail-closed 钉（锚满预算 ≥14s）════════
{
  const page = delPage({
    [SEARCH_KEY]: { count: 1 },
    [`css:${ICON_CSS}`]: { count: 1 },
    // 目标文本恒缺席（容器联合选择器嵌套键未登记 → count 0）
  });
  const run = newRun(page);
  const t0 = Date.now();
  try { await compileFlow(run, { id: 'tc_s3', steps: [delStep('wfdel'), delStep('wfnext')] }); } catch { /* 崩溃由断言兜出 */ }
  const elapsed = Date.now() - t0;
  assert(elapsed >= 14000,
    `S3a 真过滤后目标缺席 → 锚满预算（≥14s 有界轮询）；实得 ${elapsed}ms`);
  assert(run.blockers.some((b) => b.includes('计数口径不恒等')),
    `S3b 计数门 unknown 截断保持；实得 ${brief(run.blockers)}`);
  assert(!run.events.some((e) => e.text === '删除'), 'S3c 零破坏 click');
  assert(run.notes.some((n) => n.includes('fail-closed 中止')),
    'S3d compileFlow 硬阻断后中止（第二步不执行）');
}

// ════════ S4 锚提前放行钉（目标在场 → 首采放行 <5s，锚不改判）════════
{
  const page = delPage({
    [SEARCH_KEY]: { count: 1 },
    [`css:${ICON_CSS}`]: { count: 1 },
    [`css:${CONTAINER_UNION}>text:wfdel:exact`]: { count: 1 },
  });
  const run = newRun(page);
  const t0 = Date.now();
  try { await compileFlow(run, { id: 'tc_s4', steps: [delStep('wfdel')] }); } catch { /* 崩溃由断言兜出 */ }
  const elapsed = Date.now() - t0;
  assert(emitsOf(run).some((s) => s === `click:${ICON_CSS}`),
    `S4a 放大镜 click emit 在场；实得 ${brief(emitsOf(run))}`);
  assert(elapsed < 5000,
    `S4b 目标在容器内 → 锚首采即放行（<5s，不烧满预算）；实得 ${elapsed}ms`);
  assert(run.blockers.some((b) => b.includes('计数口径不恒等')),
    `S4c 锚不改判——审计仍按实采裁定（mock 无记录域 → unknown 截断保持）；实得 ${brief(run.blockers)}`);
}

if (failures.length) {
  for (const f of failures) console.error(`RED  wf-delete-search-filter: ${f}`);
  console.error(`RED  wf-delete-search-filter: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   wf-delete-search-filter: ${passed}/${passed} 全过（Enter→放大镜 + 有界就绪锚 + fail-closed 保持，零 SUT）`);
