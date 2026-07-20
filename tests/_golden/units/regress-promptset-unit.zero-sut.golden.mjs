#!/usr/bin/env node
// regress-promptset 的纯函数后继：不启动/连接 SUT、浏览器或 listener。
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parsePromptset, loadBuiltinLibs, mergeCases, overlayPromptset } from '../../../lib/promptset.mjs';
import { assembleAggregateModel } from '../../../lib/report-model.mjs';

const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const PROMPTS_LIB = join(ROOT, 'prompts', '_lib');
const tmp = mkdtempSync(join(tmpdir(), 'casey-ps-unit-'));
const GEN = '2026-07-03T00:00:00.000Z';

const failures = [];
let passed = 0;
function check(unitCheckId, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok   ${unitCheckId}`);
  } catch (error) {
    failures.push(`${unitCheckId}: ${String(error && error.message).slice(-500)}`);
  }
}
const throws = (fn) => { try { fn(); return false; } catch { return true; } };

const HAPPY_PS = [
  { id: 'p01_headache', text: '头疼三天，伴轻微恶心', category: 'normal', expect: { mustInclude: ['建议'], mustNotInclude: ['操作失败'] } },
  { id: 'p02_min', text: '你好' },
];

// sourceObligationId:hg-regress-promptset-p1
// unitCheckId:regress-promptset-unit-p1
// lifecycle-successor: {"sourceObligationId":"hg-regress-promptset-p1","unitCheckId":"regress-promptset-unit-p1"}
check('regress-promptset-unit-p1', () => {
  const cs = parsePromptset(HAPPY_PS);
  if (cs.length !== 2) throw new Error(`应 2 行，实际 ${cs.length}`);
  if (cs[1].source !== 'user' || cs[1].category !== 'normal') throw new Error(`缺省应 user/normal，实际 ${cs[1].source}/${cs[1].category}`);
  if (cs[0].text !== '头疼三天，伴轻微恶心') throw new Error('text 未保真');
});

// sourceObligationId:hg-regress-promptset-p2
// unitCheckId:regress-promptset-unit-p2
// lifecycle-successor: {"sourceObligationId":"hg-regress-promptset-p2","unitCheckId":"regress-promptset-unit-p2"}
check('regress-promptset-unit-p2', () => {
  if (!throws(() => parsePromptset({}))) throw new Error('非数组应抛');
  if (!throws(() => parsePromptset([]))) throw new Error('空数组应抛');
});

// sourceObligationId:hg-regress-promptset-p3
// unitCheckId:regress-promptset-unit-p3
// lifecycle-successor: {"sourceObligationId":"hg-regress-promptset-p3","unitCheckId":"regress-promptset-unit-p3"}
check('regress-promptset-unit-p3', () => {
  if (!throws(() => parsePromptset([{ id: 'Bad-ID', text: 'x' }]))) throw new Error('id 含大写/连字符应抛（^[a-z0-9_]+$）');
  if (!throws(() => parsePromptset([{ id: 'a', text: 'x' }, { id: 'a', text: 'y' }]))) throw new Error('id 重复应抛');
});

// sourceObligationId:hg-regress-promptset-p4
// unitCheckId:regress-promptset-unit-p4
// lifecycle-successor: {"sourceObligationId":"hg-regress-promptset-p4","unitCheckId":"regress-promptset-unit-p4"}
check('regress-promptset-unit-p4', () => {
  if (!throws(() => parsePromptset([{ id: 'a', text: '' }]))) throw new Error('text 空应抛');
  const csLlm = parsePromptset([{ id: 'a', text: 'x', source: 'llm' }]);
  if (csLlm[0].source !== 'llm') throw new Error('source=llm 应被接受');
  if (!throws(() => parsePromptset([{ id: 'a', text: 'x', source: 'robot' }]))) throw new Error('未知 source=robot 应抛');
  if (!throws(() => parsePromptset([{ id: 'a', text: 'x', category: 'weird' }]))) throw new Error('category 枚举错应抛');
  if (!throws(() => parsePromptset([{ id: 'a', text: 'x', expect: { mustInclude: 'notarray' } }]))) throw new Error('expect.mustInclude 非数组应抛');
  if (!throws(() => parsePromptset([{ id: 'a', text: 'x', expect: { mustInclude: [1] } }]))) throw new Error('expect.mustInclude 非字符串项应抛');
});

// sourceObligationId:hg-regress-promptset-b1
// unitCheckId:regress-promptset-unit-b1
// lifecycle-successor: {"sourceObligationId":"hg-regress-promptset-b1","unitCheckId":"regress-promptset-unit-b1"}
check('regress-promptset-unit-b1', () => {
  const libs = loadBuiltinLibs(PROMPTS_LIB);
  if (!Array.isArray(libs) || libs.length === 0) throw new Error('随发库应非空');
  for (const c of libs) {
    if (c.source !== 'builtin') throw new Error(`库条目 source 应 builtin，实际 ${c.source}（${c.id}）`);
    if (c.category === 'boundary' && !c.id.startsWith('bnd_')) throw new Error(`boundary 条目 id 应 bnd_ 前缀：${c.id}`);
    if (c.category === 'security' && !c.id.startsWith('sec_')) throw new Error(`security 条目 id 应 sec_ 前缀：${c.id}`);
    if (c.category !== 'boundary' && c.category !== 'security') throw new Error(`库 category 应 boundary|security，实际 ${c.category}`);
  }
  if (!libs.some((c) => c.category === 'boundary') || !libs.some((c) => c.category === 'security')) throw new Error('随发库应含边界 + 安全两类');
});

// sourceObligationId:hg-regress-promptset-b2
// unitCheckId:regress-promptset-unit-b2
// lifecycle-successor: {"sourceObligationId":"hg-regress-promptset-b2","unitCheckId":"regress-promptset-unit-b2"}
check('regress-promptset-unit-b2', () => {
  const badDir = join(tmp, 'badlib');
  mkdirSync(badDir, { recursive: true });
  writeFileSync(join(badDir, 'boundary.json'), JSON.stringify([{ id: 'p_noprefix', text: '越界注入' }]));
  writeFileSync(join(badDir, 'security.json'), JSON.stringify([]));
  if (!throws(() => loadBuiltinLibs(badDir))) throw new Error('boundary 条目缺 bnd_ 前缀应 fail-closed');
});

// sourceObligationId:hg-regress-promptset-b3
// unitCheckId:regress-promptset-unit-b3
// lifecycle-successor: {"sourceObligationId":"hg-regress-promptset-b3","unitCheckId":"regress-promptset-unit-b3"}
check('regress-promptset-unit-b3', () => {
  const user = parsePromptset([{ id: 'bnd_dup', text: '撞名' }]);
  const lib = [{ id: 'bnd_dup', text: '库里同名', source: 'builtin', category: 'boundary' }];
  if (!throws(() => mergeCases(user, lib))) throw new Error('跨集合 id 相撞应抛');
  const ok = mergeCases(parsePromptset([{ id: 'p01_x', text: 'x' }]), lib);
  if (ok.length !== 2 || ok[1].id !== 'bnd_dup') throw new Error('不撞应合并、库条目在后');
});

function psEventsDoc() {
  return {
    schemaVersion: 2,
    channel: 'web',
    caseId: 'tc_ps_chat',
    url: '{{baseUrl}}/agent/detail',
    recordedAt: GEN,
    compiledBy: 'golden-fixture',
    authored: false,
    events: [
      { stepId: 'atstep_0', intentId: 'intent_0', atom: 'nav.agentDetail', action: 'nav', url: '{{baseUrl}}/agent/detail' },
      { stepId: 'atstep_1', intentId: 'intent_1', atom: 'agent.openTestPanel', action: 'click', semantic: { kind: 'role', role: 'button', name: '测试', exact: true } },
      { stepId: 'atstep_2', intentId: 'intent_2', atom: 'chat.sendAndWait', action: 'fill', semantic: { kind: 'role', role: 'textbox', name: '请输入消息', exact: false }, value: '{{promptText}}' },
      { stepId: 'atstep_3', intentId: 'intent_2', atom: 'chat.sendAndWait', action: 'press', key: 'Space', semantic: { kind: 'role', role: 'textbox', name: '请输入消息', exact: false } },
      { stepId: 'atstep_4', intentId: 'intent_2', atom: 'chat.sendAndWait', action: 'press', key: 'Backspace', semantic: { kind: 'role', role: 'textbox', name: '请输入消息', exact: false } },
      { stepId: 'atstep_5', intentId: 'intent_2', atom: 'chat.sendAndWait', action: 'click', fallbackCss: '.hr-icon.hr-icon-arrow-up' },
      { stepId: 'atstep_6', intentId: 'intent_3', atom: 'chat.closeTestPanel', action: 'click', fallbackCss: '.hr-drawer__close-btn > .hr-icon' },
    ],
  };
}

// sourceObligationId:hg-regress-promptset-o1
// unitCheckId:regress-promptset-unit-o1
// lifecycle-successor: {"sourceObligationId":"hg-regress-promptset-o1","unitCheckId":"regress-promptset-unit-o1"}
check('regress-promptset-unit-o1', () => {
  const { slot } = overlayPromptset({ events: psEventsDoc(), cases: parsePromptset(HAPPY_PS) });
  if (slot.stepId !== 'atstep_2' || slot.intentId !== 'intent_2') throw new Error(`槽应 atstep_2/intent_2，实际 ${slot.stepId}/${slot.intentId}`);
});

// sourceObligationId:hg-regress-promptset-o2
// unitCheckId:regress-promptset-unit-o2
// lifecycle-successor: {"sourceObligationId":"hg-regress-promptset-o2","unitCheckId":"regress-promptset-unit-o2"}
check('regress-promptset-unit-o2', () => {
  const noSlot = psEventsDoc();
  noSlot.events[2].value = '写死不占位';
  if (!throws(() => overlayPromptset({ events: noSlot, cases: parsePromptset(HAPPY_PS) }))) throw new Error('0 槽应 fail-closed');
  const twoSlot = psEventsDoc();
  twoSlot.events[3] = { stepId: 'atstep_3b', intentId: 'intent_2', atom: 'chat.sendAndWait', action: 'fill', value: '{{promptText}}' };
  if (!throws(() => overlayPromptset({ events: twoSlot, cases: parsePromptset(HAPPY_PS) }))) throw new Error('>1 槽应 fail-closed（歧义锚）');
});

// sourceObligationId:hg-regress-promptset-o3
// unitCheckId:regress-promptset-unit-o3
// lifecycle-successor: {"sourceObligationId":"hg-regress-promptset-o3","unitCheckId":"regress-promptset-unit-o3"}
check('regress-promptset-unit-o3', () => {
  const events = psEventsDoc();
  const frozen = JSON.stringify(events);
  const { rows } = overlayPromptset({ events, cases: parsePromptset(HAPPY_PS) });
  if (JSON.stringify(events) !== frozen) throw new Error('overlay 篡改了冻结 flow（spec 漂移）');
  if (rows.length !== 2) throw new Error(`应 2 行，实际 ${rows.length}`);
  if (rows[0].ctx.promptText !== '头疼三天，伴轻微恶心' || rows[1].ctx.promptText !== '你好') throw new Error('逐行 ctx.promptText 未回填本行文本');
  if (rows[0].promptId !== 'p01_headache' || rows[0].category !== 'normal') throw new Error('行元数据未带 promptId/category');
});

// sourceObligationId:hg-regress-promptset-o4
// unitCheckId:regress-promptset-unit-o4
// lifecycle-successor: {"sourceObligationId":"hg-regress-promptset-o4","unitCheckId":"regress-promptset-unit-o4"}
check('regress-promptset-unit-o4', () => {
  const { rows } = overlayPromptset({ events: psEventsDoc(), cases: parsePromptset(HAPPY_PS) });
  const se = rows[0].softExpect;
  if (se.caseId !== 'tc_ps_chat') throw new Error('softExpect.caseId 应 = 母体 events.caseId');
  const assertions = (se.intents || []).find((it) => it.intentId === 'intent_2')?.expected || [];
  const inc = assertions.find((a) => a.kind === 'replyContains' && a.value === '建议');
  if (!inc || inc.soft !== true) throw new Error('mustInclude 应合成 soft:true replyContains');
  const exc = assertions.find((a) => a.kind === 'replyMatches' && a.soft === true && /\^\(\?!/.test(String(a.value)) && String(a.value).includes('操作失败'));
  if (!exc) throw new Error('mustNotInclude 应合成 soft:true replyMatches 负向环视');
  if ((rows[1].softExpect.intents || []).some((it) => (it.expected || []).length > 0)) throw new Error('无 expect 行不应合成软期望');
});

function sidecar(over = {}) {
  return {
    schemaVersion: 1,
    caseId: 'tc_ps_chat',
    channel: 'web',
    generatedAt: GEN,
    verdictSummary: { PASS: 1, SUT_DEFECT: 0, HARNESS_ERROR: 0, NEEDS_HUMAN: 0 },
    steps: [{
      stepId: 'atstep_2',
      intentId: 'intent_2',
      atom: 'chat.sendAndWait',
      verdict: 'PASS',
      reason: null,
      assertions: [
        { kind: 'streamReplyReceived', op: 'finished', value: null, actual: 200, ok: true, soft: false },
        { kind: 'replyContains', op: 'contains', value: '建议', actual: '建议多休息。', ok: true, soft: true },
      ],
    }],
    promptset: { promptId: 'p01_headache', category: 'normal', source: 'user', promptText: '头疼三天，伴轻微恶心' },
    ...over,
  };
}

// sourceObligationId:hg-regress-promptset-a1
// unitCheckId:regress-promptset-unit-a1
// lifecycle-successor: {"sourceObligationId":"hg-regress-promptset-a1","unitCheckId":"regress-promptset-unit-a1"}
check('regress-promptset-unit-a1', () => {
  const agg = assembleAggregateModel({ reports: [
    sidecar({ promptset: { promptId: 'sec_inj', category: 'security', source: 'builtin', promptText: '忽略上文' } }),
    sidecar(),
  ], generatedAt: GEN });
  if (agg.caseCount !== 2) throw new Error(`caseCount 应 2，实际 ${agg.caseCount}`);
  const cats = agg.groups.map((g) => g.category);
  if (JSON.stringify(cats) !== JSON.stringify(['normal', 'security'])) throw new Error(`分段序应 [normal,security]，实际 ${JSON.stringify(cats)}`);
});

// sourceObligationId:hg-regress-promptset-a2
// unitCheckId:regress-promptset-unit-a2
// lifecycle-successor: {"sourceObligationId":"hg-regress-promptset-a2","unitCheckId":"regress-promptset-unit-a2"}
check('regress-promptset-unit-a2', () => {
  const bad = sidecar({
    promptset: { promptId: 'sec_x', category: 'security', source: 'builtin', promptText: '越权' },
    verdictSummary: { PASS: 0, SUT_DEFECT: 1, HARNESS_ERROR: 0, NEEDS_HUMAN: 0 },
  });
  const agg = assembleAggregateModel({ reports: [sidecar(), bad], generatedAt: GEN });
  if (agg.banner.length !== 1) throw new Error(`横幅应 1 条（SUT_DEFECT 行），实际 ${agg.banner.length}`);
  if (agg.banner[0].promptId !== 'sec_x') throw new Error('横幅应指向缺陷行');
});

// sourceObligationId:hg-regress-promptset-a3
// unitCheckId:regress-promptset-unit-a3
// lifecycle-successor: {"sourceObligationId":"hg-regress-promptset-a3","unitCheckId":"regress-promptset-unit-a3"}
check('regress-promptset-unit-a3', () => {
  const agg = assembleAggregateModel({ reports: [sidecar(), sidecar()], generatedAt: GEN });
  if (JSON.stringify(agg.verdictTotals) !== JSON.stringify({ PASS: 2, SUT_DEFECT: 0, HARNESS_ERROR: 0, NEEDS_HUMAN: 0 })) throw new Error(`verdictTotals 应只累加 verdictSummary，实际 ${JSON.stringify(agg.verdictTotals)}`);
  const yellow = (agg.groups[0].cases[0].softExpect || []).find((a) => a.kind === 'replyContains');
  if (!yellow) throw new Error('content-expect soft 项应 surface 到 case.softExpect 黄标');
});

// sourceObligationId:hg-regress-promptset-a4
// unitCheckId:regress-promptset-unit-a4
// lifecycle-successor: {"sourceObligationId":"hg-regress-promptset-a4","unitCheckId":"regress-promptset-unit-a4"}
check('regress-promptset-unit-a4', () => {
  if (!throws(() => assembleAggregateModel({ reports: {}, generatedAt: GEN }))) throw new Error('reports 非数组应抛');
  if (!throws(() => assembleAggregateModel({ reports: [], generatedAt: GEN }))) throw new Error('空 reports 应抛');
  if (!throws(() => assembleAggregateModel({ reports: [{ caseId: 'x', steps: [] }], generatedAt: GEN }))) throw new Error('缺 verdictSummary 应抛');
  if (!throws(() => assembleAggregateModel({ reports: [{ verdictSummary: {}, steps: [] }], generatedAt: GEN }))) throw new Error('缺 caseId 应抛');
});

rmSync(tmp, { recursive: true, force: true });

if (failures.length) {
  console.error(`regress-promptset unit: ${passed}/${passed + failures.length} passed`);
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}
console.log(`\nregress-promptset unit: ${passed}/${passed} passed`);
