#!/usr/bin/env node
// 冻结黄金标准（wf-history-version · hermetic）：飞轮第四条移植——历史版本弹窗（零机制缝）。
// 决策依 docs/plans/wf-history-version/proposed/GRILL.md（D1 clickEditorButton=role 按钮 click /
// D2 closeDrawer=press Escape 锚 body / D4 publish-sut 夹具扩历史版本弹窗）。断言全为已实现 kind
// （textVisible/buttonState/textHidden），零词表/schema/回放器改动——机制缝递减 3→1→0 终点验证。
// 实现前必红：C 编译向两原子「暂无编译知识」抛。I/W 回放向冻结即绿（夹具正确性 + 既有 kind 通路回归）。
// 改本文件 = Test Ratchet 判红。
import { readFileSync, writeFileSync, existsSync, mkdtempSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { startPublishSut } from '../fixtures/publish-sut/server.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const REPLAY = join(ROOT, 'bin', 'replay.mjs');
const CASEY = join(ROOT, 'bin', 'casey.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'casey-hist-'));
const run = (args, opts = {}) => spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 120000, ...opts });

const fails = [];
let pass = 0;
async function checkAsync(name, fn) {
  try { await fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-300)}`); }
}

const PROFILE = join(tmp, 'profile.json');
writeFileSync(PROFILE, JSON.stringify({
  background: [], successField: 'status', successValue: 200,
  routes: { workflowList: '/ai-manager/process/list' },
}));

// 手写 events：nav → 点历史版本(空态) → Esc → 发布 → 点历史版本(版本表) → Esc。
function histEventsDoc() {
  const hist = (stepId, intentId) => ({ stepId, intentId, atom: 'workflow.clickEditorButton', action: 'click', semantic: { kind: 'role', role: 'button', name: '历史版本', exact: true }, text: '历史版本' });
  const esc = (stepId, intentId) => ({ stepId, intentId, atom: 'workflow.closeDrawer', action: 'press', key: 'Escape', fallbackCss: 'body' });
  return {
    schemaVersion: 2, channel: 'web', caseId: 'tc_hist_replay',
    url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-03T00:00:00.000Z', compiledBy: 'golden-fixture', authored: false,
    events: [
      { stepId: 'atstep_0', intentId: 'intent_1', atom: 'nav.detail', action: 'nav', url: '{{baseUrl}}/ai-manager/process/detail' },
      hist('atstep_1', 'intent_2'),
      esc('atstep_2', 'intent_3'),
      { stepId: 'atstep_3', intentId: 'intent_4', atom: 'workflow.publish', action: 'click', semantic: { kind: 'role', role: 'button', name: '发布', exact: true }, text: '发布' },
      hist('atstep_4', 'intent_5'),
      esc('atstep_5', 'intent_6'),
    ],
  };
}
const EVENTS = join(tmp, 'hist-events.json');
writeFileSync(EVENTS, JSON.stringify(histEventsDoc(), null, 2));
const EXP = join(tmp, 'hist-expected.json');
writeFileSync(EXP, JSON.stringify({
  caseId: 'tc_hist_replay', channel: 'web',
  intents: [
    { intentId: 'intent_2', expected: [{ kind: 'textVisible', op: 'appears', value: '暂无数据', soft: false }] },
    // Esc 关闭效果锁（codex hist R1-F1）：closeDrawer 步后「暂无数据」应真离 DOM——键盘 handler 若被破坏则此断言翻红。
    { intentId: 'intent_3', expected: [{ kind: 'textHidden', op: 'absent', value: '暂无数据', soft: false }] },
    { intentId: 'intent_4', expected: [{ kind: 'buttonState', op: 'present', value: '导出', soft: false }] },
    { intentId: 'intent_5', expected: [
      { kind: 'textVisible', op: 'appears', value: '创建时间', soft: false },
      { kind: 'textVisible', op: 'appears', value: '查看', soft: false },
      { kind: 'textHidden', op: 'absent', value: '暂无数据', soft: false },
    ] },
  ],
  globalAssertions: [],
}));

await checkAsync('I1 回放向（夹具+既有通路回归）：空态「暂无数据」真过 → Esc 关 → 发布翻面「导出」present → 版本表「创建时间/查看」真过 + 空态已消失', async () => {
  const srv = await startPublishSut({ scenario: 'happy' });
  try {
    const OUT = join(tmp, 'i1-axes.json');
    const r = run([REPLAY, '--events', EVENTS, '--sut', srv.url, '--expected', EXP, '--profile', PROFILE, '--out', OUT]);
    if (r.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
    const axes = JSON.parse(readFileSync(OUT, 'utf8'));
    const get = (iid) => axes.steps.find((s) => s.intentId === iid);
    // 全 event 动作 unique（clickEditorButton/closeDrawer/publish 均过身份门；Esc 锚 body 恒 1）。
    for (const s of axes.steps) {
      if ((s.action && s.action.resolution) !== 'unique') throw new Error(`步 ${s.stepId}/${s.atom} 应 unique，实际 ${s.action && s.action.resolution}`);
    }
    const empty = get('intent_2').postAssertions.find((a) => a.kind === 'textVisible');
    if (!empty || empty.ok !== true || !(Number(empty.actual) >= 1)) throw new Error(`空态 textVisible(暂无数据) 应 true/≥1，实际 ${empty?.ok}/${empty?.actual}`);
    // Esc 关闭效果（codex hist R1-F1）：closeDrawer 步后「暂无数据」离 DOM → textHidden true/0。
    const closed = get('intent_3').postAssertions.find((a) => a.kind === 'textHidden');
    if (!closed || closed.ok !== true || closed.actual !== 0) throw new Error(`Esc 关闭后 textHidden(暂无数据) 应 true/0（关闭效果，非仅 press unique），实际 ${closed?.ok}/${closed?.actual}`);
    const exp = get('intent_4').postAssertions.find((a) => a.kind === 'buttonState');
    if (!exp || exp.ok !== true) throw new Error(`发布后 buttonState(导出,present) 应 true，实际 ${exp?.ok}/${exp?.actual}`);
    const s5 = get('intent_5').postAssertions;
    for (const val of ['创建时间', '查看']) {
      const a = s5.find((x) => x.kind === 'textVisible' && x.value === val);
      if (!a || a.ok !== true) throw new Error(`版本表 textVisible(${val}) 应 true，实际 ${a?.ok}/${a?.actual}`);
    }
    const th = s5.find((x) => x.kind === 'textHidden');
    if (!th || th.ok !== true || th.actual !== 0) throw new Error(`发布后弹窗 textHidden(暂无数据) 应 true/0（空态被版本表替换），实际 ${th?.ok}/${th?.actual}`);
  } finally { await srv.close(); }
});

await checkAsync('W1 casey run 端到端：三断言 intent 全 PASS + 报告三件', async () => {
  const srv = await startPublishSut({ scenario: 'happy' });
  try {
    const runDir = join(tmp, 'w1-run');
    mkdirSync(runDir, { recursive: true });
    const r = run([CASEY, 'run', 'tc_hist_replay', '--sut', srv.url, '--events', EVENTS, '--expected', EXP, '--profile', PROFILE,
      '--run-dir', runDir, '--generated-at', '2026-07-03T00:00:00.000Z']);
    if (r.status !== 0) throw new Error(`casey run 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
    const verdict = JSON.parse(readFileSync(join(runDir, 'verdict.json'), 'utf8'));
    for (const iid of ['intent_2', 'intent_4', 'intent_5']) {
      const v = (verdict.steps || []).find((s) => s.intentId === iid);
      if (!v || v.verdict !== 'PASS') throw new Error(`${iid} 应 PASS，实际 ${v && v.verdict}（reason=${v && v.reason}）`);
    }
    for (const ext of ['html', 'md', 'json']) {
      if (!existsSync(join(runDir, `tc_hist_replay.report.${ext}`))) throw new Error(`缺 report.${ext}`);
    }
  } finally { await srv.close(); }
});

// ---------- C 编译向：两原子编译知识（唯一实现前红）----------
const TC = join(tmp, 'tc_hist_smoke.testcase.json');
writeFileSync(TC, JSON.stringify({
  schemaVersion: 1, caseId: 'tc_hist_smoke', channel: 'web', uniquePrefix: 'atl_',
  preconditions: ['已登录'], source: 'golden-fixture（移植 regress wf_history_version）',
  intents: [
    { intentId: 'intent_create', text: '新建空工作流' },
    { intentId: 'intent_hist_empty', text: '未发布态点历史版本，断暂无数据' },
    { intentId: 'intent_publish', text: '发布，断导出出现，再点历史版本断版本表' },
  ],
}, null, 2));
const FLOW = join(tmp, 'hist-flow-draft.json');
writeFileSync(FLOW, JSON.stringify({
  id: 'tc_hist_smoke', name: '历史版本（casey 移植）', category: 'normal',
  steps: [
    { atom: 'login', params: {} },
    { atom: 'workflow.create', params: { name: 'atl_hist1' } },
    { atom: 'workflow.clickEditorButton', params: { name: '历史版本' } },
    { atom: 'assert.textVisible', params: { text: '暂无数据' } },
    { atom: 'workflow.closeDrawer', params: {} },
    { atom: 'workflow.publish', params: {} },
    { atom: 'assert.buttonState', params: { name: '导出', state: 'present' } },
    { atom: 'workflow.clickEditorButton', params: { name: '历史版本' } },
    { atom: 'assert.textVisible', params: { text: '创建时间' } },
    { atom: 'assert.textVisible', params: { text: '查看' } },
    { atom: 'workflow.closeDrawer', params: {} },
  ],
}, null, 2));

await checkAsync('C1 闸段 + 执行段：clickEditorButton 产 click event、closeDrawer 产 press Escape event、断言原子折 intent 留痕', async () => {
  const srv = await startPublishSut({ scenario: 'happy' });
  try {
    const dir = join(tmp, 'compile-out');
    mkdirSync(dir, { recursive: true });
    const g = run([CASEY, 'compile', 'tc_hist_smoke', '--testcase', TC, '--flow', FLOW, '--out-dir', dir]);
    if (g.status !== 0) throw new Error(`闸段应 exit 0，实际 ${g.status}：${(g.stderr || '').slice(-200)}`);
    const flowFile = join(dir, 'flow-tc_hist_smoke.json');
    const flow = JSON.parse(readFileSync(flowFile, 'utf8'));
    flow.confirmedBy = 'golden-human'; flow.confirmedAt = '2026-07-03T00:00:00.000Z';
    writeFileSync(flowFile, JSON.stringify(flow, null, 2));
    const e = run([CASEY, 'compile', 'tc_hist_smoke', '--execute', '--testcase', TC, '--sut', srv.url, '--out-dir', dir, '--profile', PROFILE, '--skip-login', '--unique-name', 'hist1']);
    if (e.status !== 0) throw new Error(`执行段应 exit 0，实际 ${e.status}：${(e.stderr || e.stdout || '').slice(-300)}`);
    const events = JSON.parse(readFileSync(join(dir, 'events.json'), 'utf8'));
    const hist = events.events.filter((ev) => ev.atom === 'workflow.clickEditorButton');
    if (hist.length !== 2 || hist.some((ev) => ev.action !== 'click')) throw new Error(`clickEditorButton 应产两个 click event，实际 ${JSON.stringify(hist.map((x) => x.action))}`);
    // event shape 全锁（codex hist R1-F2）：两个 clickEditorButton event 都须 role button«历史版本» exact。
    for (const ev of hist) {
      const s = ev.semantic || {};
      if (s.kind !== 'role' || s.role !== 'button' || s.name !== '历史版本' || s.exact !== true) throw new Error(`clickEditorButton event 应 semantic{role button«历史版本» exact}，实际 ${JSON.stringify(s)}`);
    }
    const close = events.events.filter((ev) => ev.atom === 'workflow.closeDrawer');
    if (close.length !== 2 || close.some((ev) => ev.action !== 'press' || ev.key !== 'Escape')) throw new Error(`closeDrawer 应产两个 press Escape event，实际 ${JSON.stringify(close.map((x) => [x.action, x.key]))}`);
    // closeDrawer 身份门锚全锁（codex hist R1-F2）：两个 event 都须 fallbackCss body（count 恒 1 过身份门）。
    for (const ev of close) {
      if (ev.fallbackCss !== 'body') throw new Error(`closeDrawer event 应 fallbackCss body，实际 ${JSON.stringify(ev.fallbackCss)}`);
    }
    const report = JSON.parse(readFileSync(join(dir, 'compile-report.json'), 'utf8'));
    const aatoms = report.handoff && report.handoff.assertionAtoms || [];
    const atoms = aatoms.map((a) => a.atom);
    const tv = atoms.filter((a) => a === 'assert.textVisible').length;
    const bs = atoms.filter((a) => a === 'assert.buttonState').length;
    if (tv !== 3 || bs !== 1) throw new Error(`assertionAtoms 应含 3 textVisible + 1 buttonState，实际 tv=${tv} bs=${bs}`);
    // 断言 intent 挂靠全锁（codex hist R1-F3，D5）：暂无数据 折第一次历史版本 intent、导出 present 折发布 intent、
    // 创建时间/查看 折第二次历史版本 intent——挂错时机（如导出折到第二次历史版本）此处翻红。
    // 总数钉死（codex hist R2）：恰四条断言原子，杜绝额外 atom 漏进或挂靠错位被计数掩盖。
    if (aatoms.length !== 4) throw new Error(`assertionAtoms 应恰 4 条，实际 ${aatoms.length}`);
    const findAtom = (pred) => aatoms.find(pred);
    const emptyA = findAtom((a) => a.atom === 'assert.textVisible' && a.params?.text === '暂无数据');
    const exportA = findAtom((a) => a.atom === 'assert.buttonState' && a.params?.name === '导出');
    const ctimeA = findAtom((a) => a.atom === 'assert.textVisible' && a.params?.text === '创建时间');
    const viewA = findAtom((a) => a.atom === 'assert.textVisible' && a.params?.text === '查看');
    if (!emptyA || emptyA.intentId !== hist[0].intentId) throw new Error(`暂无数据 断言应折第一次历史版本 intent（${hist[0].intentId}），实际 ${emptyA?.intentId}`);
    const pubEv = events.events.find((ev) => ev.atom === 'workflow.publish');
    if (!exportA || exportA.intentId !== pubEv.intentId) throw new Error(`导出 present 断言应折发布 intent（${pubEv.intentId}），实际 ${exportA?.intentId}`);
    // 创建时间 与 查看 同属第二次历史版本弹窗，两条都须挂对（codex R2：只校创建时间会漏查看挂错缝）。
    for (const [label, a] of [['创建时间', ctimeA], ['查看', viewA]]) {
      if (!a || a.intentId !== hist[1].intentId) throw new Error(`${label} 断言应折第二次历史版本 intent（${hist[1].intentId}），实际 ${a?.intentId}`);
    }
  } finally { await srv.close(); }
});

if (fails.length) {
  for (const f of fails) console.error(`RED  wf-history-version: ${f}`);
  console.error(`RED  wf-history-version: ${pass} 过 / ${fails.length} 红`);
  process.exit(1);
}
console.log(`ok   wf-history-version: ${pass}/${pass} 全过（历史版本弹窗零机制缝：clickEditorButton + closeDrawer 两原子 + 既有 kind 通路 + 端到端 + 编译知识）`);
process.exit(0);
