#!/usr/bin/env node
// wf-open-observation-yield 验收金牌（红先行、zero-SUT）：open 读回观察让位（Steven 甲案 2026-08-07）。
// 纯 node + mock Page 驱【真实】lib/compile-atoms.mjs 的 compileFlow——零浏览器、零网络、零 SUT。
// run.identityObservations 预置行模拟「create 已归档 subject 观察」的流中态（诚实构造流态，非另造判定）。
//
// ── 根因（B4 十二跑真机实证，详见 docs/plans/wf-open-observation-yield/plan.md）──
//   create(subject)+open(source) 同 flow 双观察 → C3 连续性守卫「同名观察多条不取 first」+
//   wiring H1i「多身份原子同流 issuer fail-closed」双面钉死，结构性 fail-closed。
//   甲案：同 flow 已有同 platformId subject 观察时 open 跳过归档 source 行；双证照跑。
//
// ── 钉四件 ──
//   S1 让位钉：预置同 platformId → 归档面仍恰一行（create 的）、让位 notes 在场、click 照发、
//      双证照跑（journal 扫描先于卡内点击）。
//   S2 独跑零回归钉：零预置 → open source 观察照旧归档全档（readback 契约 S1e 同款）。
//   S3 判据精确钉：预置异 platformId → 不让位、两行并存（让位判据=同 platformId，非「有观察就让」）。
//   S4 双证不缩水钉：让位场景 + 平台零行 → 仍 fail-closed 不点、归档面不被污染。
//
// ── 红先行判据 ──
//   现实现 open 无条件归档：S1 归档两行 + 让位 notes 缺席 → RED；S2/S3/S4 绿。

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

let compileAtoms; let createMockPage;
try {
  compileAtoms = await import(resolve(ROOT, 'lib', 'compile-atoms.mjs'));
  ({ createMockPage } = await import(resolve(HERE, 'fixtures', 'agent-id-readback', 'mock-page.mjs')));
} catch (error) {
  console.error(`RED  wf-open-observation-yield: 目标模块缺席 —— ${String(error?.message || error).slice(0, 240)}`);
  process.exit(1);
}
const { createCompileRun, compileFlow } = compileAtoms;

const failures = [];
let passed = 0;
const assert = (cond, msg) => { if (cond) { passed += 1; console.log(`ok   ${msg}`); } else { failures.push(msg); console.error(`FAIL ${msg}`); } };
const brief = (v) => { try { return JSON.stringify(v).slice(0, 200); } catch { return String(v); } };

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
const poisonLedger = () => {
  const boom = (m) => () => { throw new Error(`identityLedger.${m} 被触碰`); };
  return { arm: boom('arm'), settle: boom('settle'), seal: boom('seal'), consume: boom('consume'), onRequestWillBeSent: boom('onRequestWillBeSent'), onBodyTerminal: boom('onBodyTerminal') };
};
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
        return { ok: true, status: 200, body: listBody(scanRows) };
      }
      return base.evaluate(fn);
    },
    async evaluateHandle(fn, arg) {
      if (arg && typeof arg === 'object' && arg.containerSel && arg.nameSel && 'wanted' in arg) {
        const hits = cards.filter((c) => c.name === arg.wanted).map((c) => makeCardHandle(c));
        return {
          getProperties: async () => new Map(hits.map((h, i) => [String(i), { asElement: () => h, dispose: async () => {} }])),
          dispose: async () => {},
        };
      }
      throw new Error('mock-page: 未登记的 evaluateHandle 形态');
    },
  };
}
// create 侧已归档 subject 观察行（诚实全档形状，platformId 可指定）
const seedObs = (platformId) => ({
  kind: 'workflow', name: 'wfok', code: 'WF-OK', platformId,
  sourceIntentId: 'intent_create', candidateId: 'cand-create', role: 'subject',
  atom: 'workflow.create', evidenceStepId: 'w_confirm', sourcePath: '/ai-manager/process/queryProcess',
});
function newRun(page, { seed = null } = {}) {
  const run = createCompileRun({
    page, forensics: { records: () => [] }, state: { currentStepId: null },
    sut: 'http://127.0.0.1:4173', uniqueName: 'atl_fixed', site: null, agentListRoute: null,
    profile: PROFILE, identityLedger: poisonLedger(),
  });
  if (seed) run.identityObservations.push(seed);
  return run;
}
const openStep = (openName) => ({
  atom: 'workflow.open', params: { openName },
  sourceIntentId: `intent_${openName}`, entityBindings: [{ candidateId: `cand-${openName}`, role: 'source' }],
});
const HAPPY = {
  dom: { 'text:wfok:exact': { count: 1, inContainer: true } },
  scanRows: [{ id: '9001', code: 'WF-OK', name: 'wfok' }],
  cards: [{ name: 'wfok' }],
};

// ════════ S1 让位钉 ════════
{
  journal.length = 0;
  const run = newRun(wfPage(HAPPY), { seed: seedObs('9001') });
  let crash = null;
  try { await compileFlow(run, { id: 'tc_s1', steps: [openStep('wfok')] }); } catch (e) { crash = e; }
  assert(crash === null, `S1a 不抛；实得 ${crash ? String(crash && crash.message).slice(0, 120) : 'null'}`);
  assert(run.blockers.length === 0, `S1b 零 blockers；实得 ${brief(run.blockers)}`);
  const clicks = run.events.filter((e) => e.atom === 'workflow.open' && e.action === 'click');
  assert(clicks.length === 1, `S1c click 照发（让位只让归档、不让点击）；实得 ${clicks.length}`);
  const scanAt = journal.indexOf('scan:wfok');
  const clickAt = journal.indexOf('card-click');
  assert(scanAt >= 0 && clickAt >= 0 && scanAt < clickAt,
    `S1d 双证照跑（扫描先于卡内点击）；实得 journal=${brief(journal)}`);
  assert(Array.isArray(run.identityObservations) && run.identityObservations.length === 1
    && run.identityObservations[0].atom === 'workflow.create' && run.identityObservations[0].role === 'subject',
    `S1e 归档面仍恰一行（create subject）——open source 行已让位；实得 ${brief(run.identityObservations)}`);
  assert(run.pendingIdentityObservation == null, 'S1f pending 清空');
  assert(run.notes.some((n) => n.includes('观察让位')),
    `S1g 让位 notes 在场（可审计）；实得 ${brief(run.notes.filter((n) => n.includes('workflow.open')))}`);
  assert(run.identityGateOutcome && run.identityGateOutcome.resolution === 'unique',
    `S1h 双证裁定仍 unique（验证价值保留）；实得 ${brief(run.identityGateOutcome)}`);
}

// ════════ S2 独跑零回归钉 ════════
{
  journal.length = 0;
  const run = newRun(wfPage(HAPPY));
  try { await compileFlow(run, { id: 'tc_s2', steps: [openStep('wfok')] }); } catch { /* 崩溃由断言兜出 */ }
  const clicks = run.events.filter((e) => e.atom === 'workflow.open' && e.action === 'click');
  const a = run.identityObservations;
  assert(Array.isArray(a) && a.length === 1
    && a[0].atom === 'workflow.open' && a[0].name === 'wfok' && a[0].code === 'WF-OK' && a[0].platformId === '9001'
    && clicks.length === 1 && a[0].evidenceStepId === clicks[0].stepId
    && a[0].sourceIntentId === 'intent_wfok' && a[0].candidateId === 'cand-wfok' && a[0].role === 'source'
    && a[0].sourcePath === '/ai-manager/process/queryProcess',
    `S2a 独跑照旧归档全档（source 观察，readback 契约 S1e 同款）；实得 ${brief(a)}`);
}

// ════════ S3 判据精确钉：异 platformId 不让位 ════════
{
  journal.length = 0;
  const run = newRun(wfPage(HAPPY), { seed: seedObs('8888') });
  try { await compileFlow(run, { id: 'tc_s3', steps: [openStep('wfok')] }); } catch { /* 崩溃由断言兜出 */ }
  const a = run.identityObservations;
  assert(Array.isArray(a) && a.length === 2
    && a.some((o) => o.atom === 'workflow.create' && o.platformId === '8888')
    && a.some((o) => o.atom === 'workflow.open' && o.platformId === '9001'),
    `S3a 异 platformId 不让位（判据=同 platformId，非有观察就让）；实得 ${brief(a)}`);
}

// ════════ S4 双证不缩水钉：让位场景平台零行仍 fail-closed ════════
{
  journal.length = 0;
  const run = newRun(wfPage({ ...HAPPY, scanRows: [] }), { seed: seedObs('9001') });
  try { await compileFlow(run, { id: 'tc_s4', steps: [openStep('wfok')] }); } catch { /* 崩溃由断言兜出 */ }
  assert(run.blockers.length >= 1 && run.events.filter((e) => e.action === 'click').length === 0,
    `S4a 让位场景平台零行 → 仍硬阻断不点（双证不缩水）；实得 blockers=${brief(run.blockers)}`);
  assert(run.identityObservations.length === 1 && run.identityObservations[0].atom === 'workflow.create',
    `S4b 归档面不被污染（仍只有预置行）；实得 ${brief(run.identityObservations)}`);
}

if (failures.length) {
  for (const f of failures) console.error(`RED  wf-open-observation-yield: ${f}`);
  console.error(`RED  wf-open-observation-yield: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   wf-open-observation-yield: ${passed}/${passed} 全过（观察让位 + 独跑零回归 + 判据精确 + 双证不缩水，零 SUT）`);
