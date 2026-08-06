#!/usr/bin/env node
// wf-open-readback-requery 验收金牌（红先行、zero-SUT）：workflow.open 读回上移到点击前 + 丙路线扫描取证。
// 纯 node + mock Page 替身驱【真实】lib/compile-atoms.mjs 的 compileFlow——零浏览器、零网络、零 SUT、零子进程。
// 断言纪律：退出码 + 具名断言；mock 复用冻结 createMockPage 包装扩展（不改夹具本体）。
//
// ── 根因（B4 十跑真机实证，详见 docs/plans/wf-open-readback-requery/plan.md）──
//   现役 compileWorkflowOpen 序：click → waitForURL 详情页 → 才武装 source 读回。详情页语境
//   既无列表卡片 DOM 也无带回声列表查询 → 信封必空（envelope-empty），门结构性不可满足。
//   十跑是该门真机首次执行；grill 定案丙路线：镜像 workflow.create 真机已通的
//   fetchCreatedWorkflowListScan 页面语境扫描，喂冻结纯函数 resolveDualIdentity 出双证裁定，
//   过门才点（句柄内点击），零账本依赖、零新回放事件形状。
//
// ── 钉四件 ──
//   S1 时序钉：声明分支「扫描→双证→过门→click」序（journal 证扫描先于卡内点击）；观察行
//      {matched, evidenceStepId=click 步, kind:'workflow', sourcePath} 全档；账本零触碰（毒账本哨兵）。
//   S2 fail-closed 钉：平台零行（DOM 仍见旧卡）→ 硬阻断入 blockers + 零 click event + compileFlow 中止。
//   S3 裁定同门钉：同名双行 → ambiguous、DOM 卡缺席 → action_failed（dom-anchor-mismatch 族）——
//      裁定必须走 resolveDualIdentity 判定表，扫描捷径（如 matches!==1 一律 action_failed）过不了。
//   S4 零漂移钉：未声明身份通道路径 events 序列与现役基线逐位同（恰一 click、零 blockers、零观察、零扫描）。
//
// ── 红先行判据 ──
//   现实现读回在 click 后且走账本信封：S1 毒账本哨兵炸（或观察缺席）→ RED；S2 现实现先点后拦
//   → click event 在场 → RED；S3 现实现同景观走账本 → RED；S4 现役即此行为 → GREEN。

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

let compileAtoms; let createMockPage;
try {
  compileAtoms = await import(resolve(ROOT, 'lib', 'compile-atoms.mjs'));
  ({ createMockPage } = await import(resolve(HERE, 'fixtures', 'agent-id-readback', 'mock-page.mjs')));
} catch (error) {
  console.error(`RED  wf-open-readback-requery: 目标模块缺席 —— ${String(error?.message || error).slice(0, 240)}`);
  process.exit(1);
}
const { createCompileRun, compileFlow } = compileAtoms;

const failures = [];
let passed = 0;
const assert = (cond, msg) => { if (cond) { passed += 1; console.log(`ok   ${msg}`); } else { failures.push(msg); console.error(`FAIL ${msg}`); } };
const brief = (v) => { try { return JSON.stringify(v).slice(0, 200); } catch { return String(v); } };

// ── 剖面（镜像 cases/tc_catalog_wf_crud/profile.json 的 workflows 通道声明）──
const PROFILE = {
  workflows: {
    identityMode: 'network-code-dom-name-v1',
    listApi: {
      pathname: '/ai-manager/process/queryProcess', method: 'GET', queryParam: 'processNameLike',
      recordsPath: 'data.list', totalPath: 'data.pageInfo.totalItems', pageSize: 50, pageIndex: 1,
      fields: { id: 'masProcessId', code: 'masProcessCode', name: 'masProcessName' },
    },
    itemContainer: '.agent-card',
    cardFields: { name: '.agent-card__title' },
  },
};
const listBody = (rows) => ({
  data: {
    list: rows.map((r) => ({ masProcessId: r.id, masProcessCode: r.code, masProcessName: r.name })),
    pageInfo: { totalItems: rows.length },
  },
});

// ── 毒账本哨兵：丙路线（扫描）不得触碰身份账本任一方法；触碰即炸 = 信封路线残留 ──
const poisonLedger = () => {
  const boom = (m) => () => { throw new Error(`identityLedger.${m} 被触碰（丙路线须零账本依赖）`); };
  return { arm: boom('arm'), settle: boom('settle'), seal: boom('seal'), consume: boom('consume'), onRequestWillBeSent: boom('onRequestWillBeSent'), onBodyTerminal: boom('onBodyTerminal') };
};

// ── mock 页：冻结 createMockPage 包装扩展（scan 的 evaluate 拦截 + 卡片双锚 evaluateHandle + 时序日志）──
const journal = [];
function makeCardHandle({ name }) {
  const el = {
    isConnected: true,
    getClientRects: () => [{}],
    querySelector: (sel) => (sel === '.agent-card__title' ? { textContent: name } : null),
  };
  return {
    evaluate: async (fn, arg) => fn(el, arg),
    $: async (sel) => (sel === '.agent-card__title'
      ? { click: async () => { journal.push('card-click'); }, dispose: async () => {} }
      : null),
    dispose: async () => {},
  };
}
function wfPage({ dom = {}, scanRows = [], cards = [] } = {}) {
  const base = createMockPage({ dom, url: 'http://127.0.0.1:4173/', titles: ['工作流管理'] });
  return {
    ...base,
    async waitForURL() {},
    async waitForTimeout() {},
    async evaluate(fn, arg) {
      if (arg && typeof arg === 'object' && arg.adapter && 'query' in arg) {
        journal.push(`scan:${arg.query}`);
        if (scanRows === 'fetch-fail') throw new Error('scan fetch 按规格拒绝');
        return { ok: true, status: 200, body: listBody(scanRows) };
      }
      return base.evaluate(fn); // 未登记形态照旧响亮失败（前奏采样走降级路径）
    },
    async evaluateHandle(fn, arg) {
      if (arg && typeof arg === 'object' && arg.containerSel && arg.nameSel && 'wanted' in arg) {
        const hits = cards.filter((c) => c.name === arg.wanted).map((c) => makeCardHandle(c));
        return {
          getProperties: async () => new Map(hits.map((h, i) => [String(i), { asElement: () => h, dispose: async () => {} }])),
          dispose: async () => {},
        };
      }
      throw new Error('mock-page: 未登记的 evaluateHandle 形态（响亮失败）');
    },
  };
}
function newRun(page, { declared = true } = {}) {
  return createCompileRun({
    page, forensics: { records: () => [] }, state: { currentStepId: null },
    sut: 'http://127.0.0.1:4173', uniqueName: 'atl_fixed', site: null, agentListRoute: null,
    profile: declared ? PROFILE : null,
    identityLedger: declared ? poisonLedger() : null,
  });
}
const openStep = (openName) => ({
  atom: 'workflow.open', params: { openName },
  sourceIntentId: `intent_${openName}`, entityBindings: [{ candidateId: `cand-${openName}`, role: 'source' }],
});

// ════════ S1 时序钉：声明分支扫描→双证→过门→click，观察行全档，账本零触碰 ════════
{
  journal.length = 0;
  const page = wfPage({
    dom: { 'text:wfok:exact': { count: 1, inContainer: true } },
    scanRows: [{ id: '9001', code: 'WF-OK', name: 'wfok' }],
    cards: [{ name: 'wfok' }],
  });
  const run = newRun(page);
  let crash = null;
  try { await compileFlow(run, { id: 'tc_s1', steps: [openStep('wfok')] }); } catch (e) { crash = e; }
  assert(crash === null, `S1a 声明分支全程不抛（毒账本哨兵未被触碰=零账本依赖）；实得 ${crash ? String(crash.message).slice(0, 120) : 'null'}`);
  assert(run.blockers.length === 0, `S1b 合法路径零 blockers；实得 ${brief(run.blockers)}`);
  const clicks = run.events.filter((e) => e.atom === 'workflow.open' && e.action === 'click');
  assert(clicks.length === 1, `S1c 恰一 workflow.open click event；实得 ${clicks.length}`);
  const scanAt = journal.indexOf('scan:wfok');
  const clickAt = journal.indexOf('card-click');
  assert(scanAt >= 0 && clickAt >= 0 && scanAt < clickAt,
    `S1d 扫描先于卡内点击（读回+双证在 click 前）；实得 journal=${brief(journal)}`);
  // 归档面断言（flow 层把 pending 转正进 run.identityObservations 并清空 pending——create 侧同款契约）：
  // 连 provenance join（sourceIntentId/candidateId/role）一起钉，证观察真到 sign 可对账的消费面。
  const archived = run.identityObservations;
  assert(Array.isArray(archived) && archived.length === 1
    && archived[0].kind === 'workflow'
    && archived[0].name === 'wfok' && archived[0].code === 'WF-OK' && archived[0].platformId === '9001'
    && clicks.length === 1 && archived[0].evidenceStepId === clicks[0].stepId
    && archived[0].sourceIntentId === 'intent_wfok' && archived[0].candidateId === 'cand-wfok'
    && archived[0].role === 'source'
    && archived[0].sourcePath === '/ai-manager/process/queryProcess'
    && run.pendingIdentityObservation == null,
    `S1e 观察行归档全档（三元组 + evidenceStepId=click 步 + provenance join + sourcePath，pending 已清）；实得 ${brief(archived)}`);
  assert(run.identityGateOutcome && run.identityGateOutcome.resolution === 'unique',
    `S1f identityGateOutcome=unique；实得 ${brief(run.identityGateOutcome)}`);
}

// ════════ S2 fail-closed 钉：平台零行（DOM 仍见旧卡）→ 硬阻断 + 零 click + 中止 ════════
{
  journal.length = 0;
  const page = wfPage({
    dom: {
      'text:wfgone:exact': { count: 1, inContainer: true },
      'text:wfnext:exact': { count: 1, inContainer: true },
    },
    scanRows: [], // 平台完整信封零行：列表 API 说没有这个工作流
    cards: [{ name: 'wfgone' }, { name: 'wfnext' }],
  });
  const run = newRun(page);
  let crash = null;
  try { await compileFlow(run, { id: 'tc_s2', steps: [openStep('wfgone'), openStep('wfnext')] }); } catch (e) { crash = e; }
  assert(crash === null, `S2a fail-closed 走 blockers 不抛；实得 ${crash ? String(crash.message).slice(0, 120) : 'null'}`);
  assert(run.blockers.length >= 1 && run.blockers.some((b) => b.includes('workflow.open')),
    `S2b 平台零行 → 硬阻断入 blockers；实得 ${brief(run.blockers)}`);
  const clicks = run.events.filter((e) => e.atom === 'workflow.open' && e.action === 'click');
  assert(clicks.length === 0, `S2c 读回不齐绝不点（零 workflow.open click event，含第二步被中止）；实得 ${clicks.length}`);
  assert(run.pendingIdentityObservation == null, `S2d 不产观察行；实得 ${brief(run.pendingIdentityObservation)}`);
  assert(Array.isArray(run.identityObservations) && run.identityObservations.length === 0,
    `S2e 归档面零观察行；实得 ${brief(run.identityObservations)}`);
}

// ════════ S3 裁定同门钉：裁定必须走 resolveDualIdentity 判定表，扫描捷径过不了 ════════
{
  // S3a 同名双行 → ambiguous（envelope-same-name-multi）：扫描捷径若把 matches>1 归 action_failed 即红。
  journal.length = 0;
  const pageDup = wfPage({
    dom: { 'text:wfdup:exact': { count: 1, inContainer: true } },
    scanRows: [{ id: '9101', code: 'WF-A', name: 'wfdup' }, { id: '9102', code: 'WF-B', name: 'wfdup' }],
    cards: [{ name: 'wfdup' }],
  });
  const runDup = newRun(pageDup);
  try { await compileFlow(runDup, { id: 'tc_s3a', steps: [openStep('wfdup')] }); } catch { /* 崩溃由断言兜出 */ }
  assert(runDup.identityGateOutcome && runDup.identityGateOutcome.resolution === 'ambiguous',
    `S3a 平台同名双行 → 裁定 ambiguous（判定表语义，非扫描捷径）；实得 ${brief(runDup.identityGateOutcome)}`);
  assert(runDup.events.filter((e) => e.atom === 'workflow.open' && e.action === 'click').length === 0,
    'S3a2 ambiguous 不点（零 click event）');

  // S3b 平台唯一行但 DOM 卡缺席 → action_failed（DOM 锚不齐，双证缺一不可；DOM 唯一不豁免的对偶）。
  journal.length = 0;
  const pageNoCard = wfPage({
    dom: { 'text:wfdom:exact': { count: 1, inContainer: true } },
    scanRows: [{ id: '9201', code: 'WF-C', name: 'wfdom' }],
    cards: [], // 物理卡片双锚零命中
  });
  const runNoCard = newRun(pageNoCard);
  try { await compileFlow(runNoCard, { id: 'tc_s3b', steps: [openStep('wfdom')] }); } catch { /* 崩溃由断言兜出 */ }
  assert(runNoCard.identityGateOutcome && runNoCard.identityGateOutcome.resolution === 'action_failed',
    `S3b 平台唯一行 + DOM 卡缺席 → action_failed（网络唯一不豁免 DOM 锚）；实得 ${brief(runNoCard.identityGateOutcome)}`);
  assert(runNoCard.events.filter((e) => e.atom === 'workflow.open' && e.action === 'click').length === 0,
    'S3b2 action_failed 不点（零 click event）');
}

// ════════ S4 零漂移钉：未声明身份通道路径与现役基线逐位同 ════════
{
  journal.length = 0;
  const page = wfPage({ dom: { 'text:wfold:exact': { count: 1, inContainer: true } } });
  const run = newRun(page, { declared: false });
  let crash = null;
  try { await compileFlow(run, { id: 'tc_s4', steps: [openStep('wfold')] }); } catch (e) { crash = e; }
  assert(crash === null, `S4a 未声明路径不抛；实得 ${crash ? String(crash.message).slice(0, 120) : 'null'}`);
  assert(run.blockers.length === 0, `S4b 零 blockers；实得 ${brief(run.blockers)}`);
  const evs = run.events.map((e) => `${e.atom}/${e.action}`);
  assert(evs.length === 1 && evs[0] === 'workflow.open/click',
    `S4c events 序列逐位同基线（恰一 workflow.open/click）；实得 ${brief(evs)}`);
  assert(run.pendingIdentityObservation == null, 'S4d 未声明路径零观察行');
  assert(journal.length === 0, `S4e 未声明路径零扫描零卡内点击（journal 空）；实得 ${brief(journal)}`);
}

if (failures.length) {
  for (const f of failures) console.error(`RED  wf-open-readback-requery: ${f}`);
  console.error(`RED  wf-open-readback-requery: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   wf-open-readback-requery: ${passed}/${passed} 全过（读回上移点击前 + 丙路线扫描 + 双证同门 + 未声明零漂移，零 SUT）`);
