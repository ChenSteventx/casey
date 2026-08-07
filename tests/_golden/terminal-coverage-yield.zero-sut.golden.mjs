#!/usr/bin/env node
// terminal-coverage-yield 验收金牌（红先行、zero-SUT）：基数门学让位（Steven 终裁收窄版 A +
// platformId 硬桥接 2026-08-07）。直驱真实 checkIdentityObservationCardinality（Y1–Y7）+
// 镜像 wf-open-observation-yield harness 驱真实 open 让位编译路径（Y8）+ schema 改版结构钉（Y9）。
//
// 豁免四条件（全与才豁免，缺一照拒）：①终端 click 观察计数恰 0（「多」形态由 evidenceStepId
// 去重钉关死）②该原子登记义务恰 ['source']（subject 所有权义务绝不豁免）③click 携非空
// yieldedToPlatformId（取证记录非豁免宣告——伪造字段无匹配行照拒）④观察集内恰一条
// kind===boundKind && role==='subject' && platformId===字段值（零条/多条均拒）。
// 加法门控：无新字段的一切既有输入行为与改前同码（Y2/Y7 遗留等价钉）。

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

let registry; let compileAtoms; let createMockPage;
try {
  registry = await import(resolve(ROOT, 'lib', 'entity-observation-registry.mjs'));
  compileAtoms = await import(resolve(ROOT, 'lib', 'compile-atoms.mjs'));
  ({ createMockPage } = await import(resolve(HERE, 'fixtures', 'agent-id-readback', 'mock-page.mjs')));
} catch (error) {
  console.error(`RED  terminal-coverage-yield: 目标模块缺席 —— ${String(error?.message || error).slice(0, 240)}`);
  process.exit(1);
}
const { checkIdentityObservationCardinality } = registry;
const { createCompileRun, compileFlow } = compileAtoms;

const failures = [];
let passed = 0;
const assert = (cond, msg) => { if (cond) { passed += 1; console.log(`ok   ${msg}`); } else { failures.push(msg); console.error(`FAIL ${msg}`); } };
const brief = (v) => { try { return JSON.stringify(v).slice(0, 200); } catch { return String(v); } };

// ── Y1–Y7：直驱真实基数门 ─────────────────────────────────────────────────────
const createClick = (stepId, intentId) => ({ stepId, intentId, atom: 'workflow.create', action: 'click' });
const openClick = (stepId, intentId, extra = {}) => ({ stepId, intentId, atom: 'workflow.open', action: 'click', ...extra });
const createObs = (evidenceStepId, platformId) => ({ atom: 'workflow.create', evidenceStepId, kind: 'workflow', role: 'subject', platformId });

{
  // Y1 豁免正例（实现前必红）：open 终端 0 观察 + 携字段 + 恰一条同 kind/subject/platformId create 行 → ok。
  const r1 = checkIdentityObservationCardinality({
    events: [createClick('c1', 'ic'), openClick('o1', 'io', { yieldedToPlatformId: 'P9' })],
    observations: [createObs('c1', 'P9')],
  });
  assert(r1.ok === true,
    `Y1 让位豁免正例（open 零观察 + yieldedToPlatformId 恰一匹配 create subject 行）→ ok；实得 ${brief(r1)}`);

  // Y2 字段缺席照拒（遗留等价，绿基线）：同形去字段 → 原码拒。
  const r2 = checkIdentityObservationCardinality({
    events: [createClick('c1', 'ic'), openClick('o1', 'io')],
    observations: [createObs('c1', 'P9')],
  });
  assert(r2.ok === false && r2.reason === 'OBSERVATION_TERMINAL_WITHOUT_MATCHING_OBSERVATION',
    `Y2 无字段遗留形照拒（加法门控——十四跑形态行为不变）；实得 ${brief(r2)}`);

  // Y3 伪造字段无匹配行 → 拒（字段是取证记录非豁免宣告）。
  const r3 = checkIdentityObservationCardinality({
    events: [createClick('c1', 'ic'), openClick('o1', 'io', { yieldedToPlatformId: 'P8' })],
    observations: [createObs('c1', 'P9')],
  });
  assert(r3.ok === false && r3.reason === 'OBSERVATION_TERMINAL_WITHOUT_MATCHING_OBSERVATION',
    `Y3 字段值无匹配 subject 行 → 照拒（伪造字段不豁免）；实得 ${brief(r3)}`);

  // Y4 同 platformId 匹配行多条 → 拒（恰一才豁免，同口径 C3 不取 first）。
  const r4 = checkIdentityObservationCardinality({
    events: [createClick('c1', 'ic1'), createClick('c2', 'ic2'), openClick('o1', 'io', { yieldedToPlatformId: 'P9' })],
    observations: [createObs('c1', 'P9'), createObs('c2', 'P9')],
  });
  assert(r4.ok === false && r4.reason === 'OBSERVATION_TERMINAL_WITHOUT_MATCHING_OBSERVATION',
    `Y4 匹配行两条 → 拒（恰一才豁免，多条 fail-closed）；实得 ${brief(r4)}`);

  // Y5 subject 义务终端伪造字段 → 拒（所有权义务绝不豁免）。
  const r5 = checkIdentityObservationCardinality({
    events: [createClick('c1', 'ic', /* 伪造 */), openClick('o1', 'io', { yieldedToPlatformId: 'P9' })],
    observations: [{ ...createObs('o1', 'P9'), atom: 'workflow.open', role: 'source' }],
  });
  // 构造：create 终端 c1 零观察且携伪造字段；open 侧照常一行。create 义务 ['subject'] 不可让 → 拒。
  const r5b = checkIdentityObservationCardinality({
    events: [{ ...createClick('c1', 'ic'), yieldedToPlatformId: 'P9' }, openClick('o1', 'io')],
    observations: [{ atom: 'workflow.open', evidenceStepId: 'o1', kind: 'workflow', role: 'source', platformId: 'P9' }],
  });
  assert(r5b.ok === false && r5b.reason === 'OBSERVATION_TERMINAL_WITHOUT_MATCHING_OBSERVATION',
    `Y5 subject 义务终端携伪造字段 → 照拒（义务恰 ['source'] 才可让）；实得 ${brief(r5b)}`);
  void r5;

  // Y6 「多」形态：同终端两行观察 → evidenceStepId 去重钉照拒（豁免只对「少=0」开，多面不松）。
  const r6 = checkIdentityObservationCardinality({
    events: [createClick('c1', 'ic'), openClick('o1', 'io', { yieldedToPlatformId: 'P9' })],
    observations: [createObs('c1', 'P9'), { atom: 'workflow.open', evidenceStepId: 'o1', kind: 'workflow', role: 'source', platformId: 'P9' }, { atom: 'workflow.open', evidenceStepId: 'o1', kind: 'workflow', role: 'source', platformId: 'P9' }],
  });
  assert(r6.ok === false && r6.reason === 'OBSERVATION_EVIDENCE_STEP_DUPLICATE',
    `Y6 同终端两行 → 去重钉照拒（多面零松动）；实得 ${brief(r6)}`);

  // Y7 agent 逐字等价（无字段全遗留形）→ ok 行为与改前同码。
  const r7 = checkIdentityObservationCardinality({
    events: [
      { stepId: 's_fill', intentId: 'i', atom: 'agent.searchOpen', action: 'fill' },
      { stepId: 's_click', intentId: 'i', atom: 'agent.searchOpen', action: 'click' },
    ],
    observations: [{ atom: 'agent.searchOpen', evidenceStepId: 's_click' }],
  });
  assert(r7.ok === true,
    `Y7 agent 遗留形逐字等价 → ok（zero 回归）；实得 ${brief(r7)}`);
}

// ── Y8：真实 open 让位编译路径盖字段（镜像 wf-open-observation-yield harness）──────
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
function makeCardHandle({ name }) {
  const el = {
    isConnected: true,
    getClientRects: () => [{}],
    querySelector: (sel) => (sel === '.agent-card__title' ? { textContent: name } : null),
  };
  return {
    evaluate: async (fn, arg) => fn(el, arg),
    $: async (sel) => (sel === '.agent-card__title' ? { click: async () => {}, dispose: async () => {} } : null),
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
      if (arg && typeof arg === 'object' && arg.adapter && 'query' in arg) return { ok: true, status: 200, body: listBody(scanRows) };
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
{
  const seed = {
    kind: 'workflow', name: 'wfok', code: 'WF-OK', platformId: '9001',
    sourceIntentId: 'intent_create', candidateId: 'cand-create', role: 'subject',
    atom: 'workflow.create', evidenceStepId: 'w_confirm', sourcePath: '/ai-manager/process/queryProcess',
  };
  const page = wfPage({
    dom: { 'text:wfok:exact': { count: 1, inContainer: true } },
    scanRows: [{ id: '9001', code: 'WF-OK', name: 'wfok' }],
    cards: [{ name: 'wfok' }],
  });
  const run = createCompileRun({
    page, forensics: { records: () => [] }, state: { currentStepId: null },
    sut: 'http://127.0.0.1:4173', uniqueName: 'atl_fixed', site: null, agentListRoute: null,
    profile: PROFILE, identityLedger: poisonLedger(),
  });
  run.identityObservations.push(seed);
  await compileFlow(run, {
    id: 'tc_yield_stamp',
    steps: [{ atom: 'workflow.open', params: { openName: 'wfok' }, sourceIntentId: 'intent_open', entityBindings: [{ candidateId: 'cand-open', role: 'source' }] }],
  });
  const openClicks = run.events.filter((e) => e.atom === 'workflow.open' && e.action === 'click');
  assert(run.blockers.length === 0 && openClicks.length === 1,
    `Y8a 让位场景照常单击零阻断（既有让位行为不变）；实得 blockers=${brief(run.blockers)} clicks=${openClicks.length}`);
  assert(openClicks.length === 1 && openClicks[0].yieldedToPlatformId === '9001',
    `Y8b 终端 click 事件盖 yieldedToPlatformId=让位对象 platformId（真实编译缝）；实得 ${brief(openClicks[0] && openClicks[0].yieldedToPlatformId)}`);
  assert(run.identityObservations.length === 1,
    `Y8c 归档面仍恰一行（create 的）——盖字段不改让位本体；实得 ${run.identityObservations.length}`);
  // 端到端喂门：本 flow 只驱 open 步，种子 create 行锚的确认 click 以合成事件补位
  // （与种子同为诚实流中态构造——完整产物里它由 create 步真实产出）。
  const gateAfter = checkIdentityObservationCardinality({
    events: [{ stepId: 'w_confirm', intentId: 'intent_create', atom: 'workflow.create', action: 'click' }, ...run.events],
    observations: run.identityObservations.map((o) => ({ atom: o.atom, evidenceStepId: o.evidenceStepId, kind: o.kind, role: o.role, platformId: o.platformId })),
  });
  assert(gateAfter.ok === true,
    `Y8d 编译产物（盖字段 open 事件 + create 行 + 其锚定 click）直接过基数门 → ok（端到端闭环）；实得 ${brief(gateAfter)}`);
}

// ── Y9：schema 改版结构钉（M1 同车）─────────────────────────────────────────
{
  let schema = null;
  try { schema = JSON.parse(readFileSync(resolve(ROOT, 'tests', '_golden', 'schemas', 'events.schema.json'), 'utf8')); } catch { schema = null; }
  const eventProps = schema && schema.definitions && schema.definitions.event && schema.definitions.event.properties;
  const pat = eventProps && eventProps.intentId && eventProps.intentId.pattern;
  assert(pat === '^intent_[A-Za-z0-9_]+$',
    `Y9a intentId pattern 放宽为 ^intent_[A-Za-z0-9_]+$（M1 同车改版）；实得 ${brief(pat)}`);
  assert(pat && new RegExp(pat).test('intent_create') && new RegExp(pat).test('intent_0'),
    'Y9b authored 号与遗留序数号均过新 pattern');
  const yprop = eventProps && eventProps.yieldedToPlatformId;
  assert(yprop && yprop.type === 'string' && (yprop.minLength === 1 || yprop.pattern),
    `Y9c 事件对象新增可选属性 yieldedToPlatformId（非空 string）；实得 ${brief(yprop)}`);
}

if (failures.length) {
  for (const f of failures) console.error(`RED  terminal-coverage-yield: ${f}`);
  console.error(`RED  terminal-coverage-yield: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   terminal-coverage-yield: ${passed}/${passed} 全过（基数门让位豁免 + 编译缝盖字段 + schema 改版，零 SUT）`);
