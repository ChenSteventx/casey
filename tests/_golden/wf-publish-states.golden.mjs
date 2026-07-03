#!/usr/bin/env node
// 冻结黄金标准（wf-publish-states · hermetic）：飞轮第三条移植——发布状态机×按钮态。
// 决策依 docs/plans/wf-publish-states/proposed/GRILL.md（D1 词表收窄 present/absent + enabled/disabled
// 挂账后补 / D2 role 必采 + profile.buttons.extraSelector 可选补采、合计 present>0 absent===0、缺采集证不出 /
// D3 补「发布 absent」负向）。考场 = tests/fixtures/publish-sut（假 SUT：编辑器顶栏按钮翻面 +
// plainText/divButtons/dupButtons 对抗场景）。
// 实现前必红（红先行基线）：词表 present 必拒/enabled 必过（U2）、评估走 default 分支（U3）、草拟 present
// 落 pending（D1）、回放无 buttonHits 采集（I1/I2/I4/I5）、profile.buttons 形状不校验（I6）、casey run
// 断言全败（W1）、compile 对 workflow.publish 抛「暂无编译知识」（C1）。I0 冻结时即绿（回归保护：夹具正确性）。
// codex R1 两 High 采信钉红修绿（2026-07-03）：F1 absent 通道活性反证（buttonSeen>0 才可判「不存在」，
// 盲区页证不出——U3 收紧 + I3 补 absent 向）；F2 补采通道可见性过滤（隐藏模板节点不计数——I7 + 夹具
// divButtons 隐藏模板）。改本文件 = Test Ratchet 判红。
import { readFileSync, writeFileSync, existsSync, mkdtempSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { evaluateAssertions, IMPLEMENTED_KINDS } from '../../lib/replay-assert.mjs';
import { synthesizeSkeleton } from '../../lib/assertion-draft.mjs';
import { startPublishSut } from '../fixtures/publish-sut/server.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const REPLAY = join(ROOT, 'bin', 'replay.mjs');
const CHECK = join(ROOT, 'bin', 'check.mjs');
const CASEY = join(ROOT, 'bin', 'casey.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'casey-pub-'));
const run = (args, opts = {}) => spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 120000, ...opts });

const fails = [];
let pass = 0;
function check(name, fn) {
  try { fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-300)}`); }
}
async function checkAsync(name, fn) {
  try { await fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-300)}`); }
}

// ---------- U 单元向：词表收窄 + kind 实现 ----------
check('U1 IMPLEMENTED_KINDS 10→11（buttonState 入列；switchState 仍外；精确计数本 golden 前沿持有）', () => {
  if (!IMPLEMENTED_KINDS.has('buttonState')) throw new Error('已实现集缺 buttonState');
  if (IMPLEMENTED_KINDS.has('switchState')) throw new Error('switchState 不应在已实现集（冻结 golden 未实现范例依赖）');
  if (IMPLEMENTED_KINDS.size !== 11) throw new Error(`已实现集应 11 种，实际 ${IMPLEMENTED_KINDS.size}`);
});

check('U2 词表收窄（D1）：present/absent 合法、enabled/disabled 拒（词表=可草拟=已实现）、switchState 不动', () => {
  const v = (kind, op) => run([CHECK, '--kind', kind, '--op', op, '--validate-only']).status;
  if (v('buttonState', 'present') !== 0) throw new Error('buttonState present 应合法（exit 0）');
  if (v('buttonState', 'absent') !== 0) throw new Error('buttonState absent 应合法（exit 0）');
  if (v('buttonState', 'enabled') !== 2) throw new Error('buttonState enabled 应被拒（exit 2，挂账 publish_blocked 带实现回归）');
  if (v('buttonState', 'disabled') !== 2) throw new Error('buttonState disabled 应被拒（exit 2）');
  if (v('switchState', 'on') !== 0) throw new Error('switchState on 应仍合法（回归）');
});

check('U3 buttonState 评估三向 + 活性反证 + 遗留 op 证不出（D2 合计语义 + codex R1-F1 收紧）', () => {
  const one = (op, value, ctx) => evaluateAssertions([{ kind: 'buttonState', op, value }], ctx)[0];
  const p1 = one('present', '发布', { buttonHits: { '发布': 1 }, buttonSeen: 2 });
  if (p1.ok !== true || p1.actual !== 1) throw new Error(`present 命中应 true/1，实际 ${p1.ok}/${p1.actual}`);
  const p0 = one('present', '导出', { buttonHits: { '导出': 0 }, buttonSeen: 2 });
  if (p0.ok !== false || p0.actual !== 0) throw new Error(`present 零命中应 false/0，实际 ${p0.ok}/${p0.actual}`);
  const a0 = one('absent', '导出', { buttonHits: { '导出': 0 }, buttonSeen: 2 });
  if (a0.ok !== true || a0.actual !== 0) throw new Error(`absent 零命中且通道活着应 true/0，实际 ${a0.ok}/${a0.actual}`);
  // 通道活性反证（codex R1-F1）：同刻通道一个按钮都看不见（seen=0）——「采不到」绝不判成「不存在」。
  const aBlind = one('absent', '保存', { buttonHits: { '保存': 0 }, buttonSeen: 0 });
  if (aBlind.ok !== false) throw new Error(`absent 零命中但通道全盲应 false（证不出，护栏 #14），实际 ${aBlind.ok}`);
  const aNoSeen = one('absent', '保存', { buttonHits: { '保存': 0 } });
  if (aNoSeen.ok !== false) throw new Error(`absent 缺活性证据（无 buttonSeen）应 false，实际 ${aNoSeen.ok}`);
  const a2 = one('absent', '发布', { buttonHits: { '发布': 2 }, buttonSeen: 2 });
  if (a2.ok !== false || a2.actual !== 2) throw new Error(`absent 有命中应 false/2，实际 ${a2.ok}/${a2.actual}`);
  const na = one('present', '发布', {});
  if (na.ok !== false || na.actual !== null) throw new Error(`缺采集应 false/null（证不出，护栏 #14），实际 ${na.ok}/${na.actual}`);
  const legacy = one('enabled', '保存', { buttonHits: { '保存': 1 }, buttonSeen: 1 });
  if (legacy.ok !== false) throw new Error(`遗留 op enabled 应证不出 false（绝不判真），实际 ${legacy.ok}`);
});

// ---------- D 草拟向：映射条件翻转（present/absent 硬映射，enabled/disabled 落 pending） ----------
check('D1 草拟映射：present 硬映射（已实现不 soft）、enabled 落 pending（route:human 留痕）', () => {
  const draft = synthesizeSkeleton({ caseId: 'tc_pub_smoke' }, [
    { intentId: 'intent_1', atom: 'assert.buttonState', params: { name: '发布', state: 'present' } },
    { intentId: 'intent_1', atom: 'assert.buttonState', params: { name: '保存', state: 'enabled' } },
  ]);
  const i1 = draft.intents.find((it) => it.intentId === 'intent_1');
  const bs = (i1?.expected || []).find((a) => a.kind === 'buttonState');
  if (!bs) throw new Error('assert.buttonState(present) 未合成出 buttonState 断言');
  if (bs.op !== 'present' || bs.value !== '发布') throw new Error(`应 op:present/value:发布，实际 ${bs.op}/${bs.value}`);
  if (bs.soft === true) throw new Error('buttonState 已实现，骨架不应标 soft');
  const pend = draft.pending || [];
  if (!pend.some((p) => p.atom === 'assert.buttonState' && p.intentId === 'intent_1')) {
    throw new Error('enabled（未实现 op）应落 pending[]（挂账后补，不得静默丢、不得硬凑）');
  }
});

// ---------- I 集成向（publish-sut 回放） ----------
const PROFILE = join(tmp, 'profile.json');
writeFileSync(PROFILE, JSON.stringify({
  background: [], successField: 'status', successValue: 200,
  routes: { workflowList: '/ai-manager/process/list' },
}));
const PROFILE_BTN = join(tmp, 'profile-btn.json');
writeFileSync(PROFILE_BTN, JSON.stringify({
  background: [], successField: 'status', successValue: 200,
  routes: { workflowList: '/ai-manager/process/list' },
  buttons: { extraSelector: '.editor-btn' },
}));
function pubEventsDoc() {
  return {
    schemaVersion: 2, channel: 'web', caseId: 'tc_pub_replay',
    url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-03T00:00:00.000Z', compiledBy: 'golden-fixture', authored: false,
    events: [
      { stepId: 'atstep_0', intentId: 'intent_1', atom: 'nav.processDetail', action: 'nav', url: '{{baseUrl}}/ai-manager/process/detail' },
      { stepId: 'atstep_1', intentId: 'intent_2', atom: 'workflow.publish', action: 'click', semantic: { kind: 'role', role: 'button', name: '发布', exact: true }, text: '发布', fallbackCss: '.editor-btn:text-is("发布")' },
    ],
  };
}
const EVENTS = join(tmp, 'pub-events.json');
writeFileSync(EVENTS, JSON.stringify(pubEventsDoc(), null, 2));
function expectedDoc(intent1, intent2) {
  return {
    caseId: 'tc_pub_replay', channel: 'web',
    intents: [
      { intentId: 'intent_1', expected: intent1 },
      { intentId: 'intent_2', expected: intent2 || [] },
    ],
    globalAssertions: [],
  };
}
const bsa = (op, value) => ({ kind: 'buttonState', op, value, soft: false });
// 六断言重表达（源 flow 五条 + GRILL D3 补「发布 absent」）：未发布态三条挂 intent_1（nav 代表步静默点采），
// 已发布态三条挂 intent_2（点「发布」后翻面采）。
const EXP_HAPPY = join(tmp, 'exp-happy.json');
writeFileSync(EXP_HAPPY, JSON.stringify(expectedDoc(
  [bsa('present', '发布'), bsa('present', '保存'), bsa('absent', '导出')],
  [bsa('present', '导出'), bsa('present', '新建版本'), bsa('absent', '发布')],
)));

await checkAsync('I0 夹具冒烟（冻结时即绿）：nav + 点「发布」动作 unique、axes 落盘、翻面后«发布»真移除', async () => {
  const srv = await startPublishSut({ scenario: 'happy' });
  try {
    const OUT = join(tmp, 'i0-axes.json');
    const r = run([REPLAY, '--events', EVENTS, '--sut', srv.url, '--expected', EXP_HAPPY, '--profile', PROFILE, '--out', OUT]);
    if (r.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
    const axes = JSON.parse(readFileSync(OUT, 'utf8'));
    const s2 = axes.steps.find((s) => s.intentId === 'intent_2');
    if ((s2.action && s2.action.resolution) !== 'unique') throw new Error(`点「发布」应 unique，实际 ${s2.action && s2.action.resolution}`);
  } finally { await srv.close(); }
});

await checkAsync('I1 happy：role 通道采集六断言全过（未发布态三 + 翻面后三，D3 负向«发布 absent»真过）', async () => {
  const srv = await startPublishSut({ scenario: 'happy' });
  try {
    const OUT = join(tmp, 'i1-axes.json');
    const r = run([REPLAY, '--events', EVENTS, '--sut', srv.url, '--expected', EXP_HAPPY, '--profile', PROFILE, '--out', OUT]);
    if (r.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
    const axes = JSON.parse(readFileSync(OUT, 'utf8'));
    for (const iid of ['intent_1', 'intent_2']) {
      const st = axes.steps.find((s) => s.intentId === iid);
      for (const a of st.postAssertions || []) {
        if (a.kind !== 'buttonState') continue;
        if (a.ok !== true) throw new Error(`${iid} ${a.op}(${a.value}) 应 ok:true，实际 ${a.ok}（actual=${JSON.stringify(a.actual)}）`);
        if (typeof a.actual !== 'number') throw new Error(`${iid} ${a.op}(${a.value}) actual 应携命中计数，实际 ${JSON.stringify(a.actual)}`);
      }
      const n = (st.postAssertions || []).filter((x) => x.kind === 'buttonState').length;
      if (n !== 3) throw new Error(`${iid} 应带三条 buttonState 断言，实际 ${n}`);
    }
    const pubAbsent = axes.steps.find((s) => s.intentId === 'intent_2').postAssertions.find((x) => x.op === 'absent');
    if (pubAbsent.value !== '发布' || pubAbsent.actual !== 0) throw new Error(`翻面后«发布»应 absent/0，实际 ${pubAbsent.value}/${pubAbsent.actual}`);
  } finally { await srv.close(); }
});

await checkAsync('I2 plainText：非按钮 span«导出»不进 buttonHits——absent 仍 true/0（混文本通道即假红现形）', async () => {
  const srv = await startPublishSut({ scenario: 'plainText' });
  try {
    const OUT = join(tmp, 'i2-axes.json');
    const r = run([REPLAY, '--events', EVENTS, '--sut', srv.url, '--expected', EXP_HAPPY, '--profile', PROFILE, '--out', OUT]);
    if (r.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r.status}`);
    const axes = JSON.parse(readFileSync(OUT, 'utf8'));
    const s1 = axes.steps.find((s) => s.intentId === 'intent_1');
    const exp = s1.postAssertions.find((x) => x.kind === 'buttonState' && x.op === 'absent');
    if (!exp || exp.ok !== true || exp.actual !== 0) throw new Error(`span 同名文本在场时 absent(导出) 应 true/0（按钮语义纯净），实际 ${exp?.ok}/${exp?.actual}`);
  } finally { await srv.close(); }
});

await checkAsync('I3 divButtons 无补采：role 盲区 present 与 absent 双向落红不落绿（codex R1-F1 假绿缝封死）', async () => {
  const srv = await startPublishSut({ scenario: 'divButtons' });
  try {
    const OUT = join(tmp, 'i3-axes.json');
    const EXP = join(tmp, 'exp-div.json');
    // absent(保存)：保存 div 假按钮真实可见——role 盲区计数 0，无活性反证时会假绿（codex R1-F1 场景原样钉死）。
    writeFileSync(EXP, JSON.stringify(expectedDoc([bsa('present', '保存'), bsa('absent', '保存')], [])));
    const r = run([REPLAY, '--events', EVENTS, '--sut', srv.url, '--expected', EXP, '--profile', PROFILE, '--out', OUT]);
    if (r.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r.status}`);
    const axes = JSON.parse(readFileSync(OUT, 'utf8'));
    const s1 = axes.steps.find((s) => s.intentId === 'intent_1');
    const p = (s1.postAssertions || []).find((x) => x.op === 'present');
    if (!p || p.ok !== false) throw new Error(`div 假按钮 role 盲区 present 应 false（看不见→红，绝不假绿），实际 ${p?.ok}`);
    const a = (s1.postAssertions || []).find((x) => x.op === 'absent');
    if (!a || a.ok !== false) throw new Error(`div 假按钮真实在场时 absent 应 false（通道全盲=证不出，绝不判「不存在」），实际 ${a?.ok}`);
  } finally { await srv.close(); }
});

await checkAsync('I4 divButtons + extraSelector（D2 补采）：present 真过、absent 被补采通道反证真败', async () => {
  const srv = await startPublishSut({ scenario: 'divButtons' });
  try {
    const OUT = join(tmp, 'i4-axes.json');
    const EXP = join(tmp, 'exp-div-btn.json');
    // 同值双向：保存 present（应过）+ 保存 absent（补采通道看得见 → 必败）——absent 的 fail-open 缝被补采封住。
    writeFileSync(EXP, JSON.stringify(expectedDoc([bsa('present', '保存'), bsa('absent', '保存')], [])));
    const r = run([REPLAY, '--events', EVENTS, '--sut', srv.url, '--expected', EXP, '--profile', PROFILE_BTN, '--out', OUT]);
    if (r.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
    const axes = JSON.parse(readFileSync(OUT, 'utf8'));
    const s1 = axes.steps.find((s) => s.intentId === 'intent_1');
    const pres = s1.postAssertions.find((x) => x.op === 'present');
    if (!pres || pres.ok !== true || !(Number(pres.actual) >= 1)) throw new Error(`补采后 present(保存) 应 true/≥1，实际 ${pres?.ok}/${pres?.actual}`);
    const abs = s1.postAssertions.find((x) => x.op === 'absent');
    if (!abs || abs.ok !== false || !(Number(abs.actual) >= 1)) throw new Error(`补采后 absent(保存) 应 false/≥1（反证在场），实际 ${abs?.ok}/${abs?.actual}`);
  } finally { await srv.close(); }
});

await checkAsync('I7 divButtons + extraSelector：隐藏模板节点不进补采（可见性过滤，codex R1-F2 假绿缝封死）', async () => {
  const srv = await startPublishSut({ scenario: 'divButtons' });
  try {
    const OUT = join(tmp, 'i7-axes.json');
    const EXP = join(tmp, 'exp-div-hidden.json');
    // 夹具 divButtons 场景带 display:none 的 .editor-btn「导出」模板——DOM 计数会数到、真实用户看不见。
    writeFileSync(EXP, JSON.stringify(expectedDoc([bsa('present', '导出'), bsa('absent', '导出')], [])));
    const r = run([REPLAY, '--events', EVENTS, '--sut', srv.url, '--expected', EXP, '--profile', PROFILE_BTN, '--out', OUT]);
    if (r.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
    const axes = JSON.parse(readFileSync(OUT, 'utf8'));
    const s1 = axes.steps.find((s) => s.intentId === 'intent_1');
    const p = s1.postAssertions.find((x) => x.op === 'present');
    if (!p || p.ok !== false || p.actual !== 0) throw new Error(`隐藏模板 present(导出) 应 false/0（可见性过滤），实际 ${p?.ok}/${p?.actual}`);
    const a = s1.postAssertions.find((x) => x.op === 'absent');
    if (!a || a.ok !== true || a.actual !== 0) throw new Error(`隐藏模板 absent(导出) 应 true/0（补采通道活着 + 可见命中 0），实际 ${a?.ok}/${a?.actual}`);
  } finally { await srv.close(); }
});

await checkAsync('I5 dupButtons：多匹配计数如实（present actual=2）、点击身份门拒点（回归）', async () => {
  const srv = await startPublishSut({ scenario: 'dupButtons' });
  try {
    const OUT = join(tmp, 'i5-axes.json');
    const EXP = join(tmp, 'exp-dup.json');
    writeFileSync(EXP, JSON.stringify(expectedDoc([bsa('present', '发布')], [])));
    const r = run([REPLAY, '--events', EVENTS, '--sut', srv.url, '--expected', EXP, '--profile', PROFILE, '--out', OUT]);
    if (r.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r.status}`);
    const axes = JSON.parse(readFileSync(OUT, 'utf8'));
    const s1 = axes.steps.find((s) => s.intentId === 'intent_1');
    const p = s1.postAssertions.find((x) => x.kind === 'buttonState');
    if (!p || p.ok !== true || p.actual !== 2) throw new Error(`同名双按钮 present 应 true/2（计数如实），实际 ${p?.ok}/${p?.actual}`);
    const s2 = axes.steps.find((s) => s.intentId === 'intent_2');
    if ((s2.action && s2.action.resolution) === 'unique') throw new Error('同名双按钮点击应被身份门拒（非 unique）');
  } finally { await srv.close(); }
});

await checkAsync('I6 profile.buttons 形状校验 fail-closed：extraSelector 空串 → exit 65 不落 axes', async () => {
  const srv = await startPublishSut({ scenario: 'happy' });
  try {
    const BAD = join(tmp, 'profile-bad.json');
    writeFileSync(BAD, JSON.stringify({ background: [], successField: 'status', successValue: 200, buttons: { extraSelector: '' } }));
    const OUT = join(tmp, 'i6-axes.json');
    const r = run([REPLAY, '--events', EVENTS, '--sut', srv.url, '--expected', EXP_HAPPY, '--profile', BAD, '--out', OUT]);
    if (r.status !== 65) throw new Error(`buttons 段形状非法应 exit 65（routes 先例 fail-closed），实际 ${r.status}`);
    if (existsSync(OUT)) throw new Error('形状非法不应落 axes');
  } finally { await srv.close(); }
});

// ---------- W 接线向：casey run 端到端 ----------
await checkAsync('W1 casey run 对 publish-sut 端到端：两 intent PASS + 报告三件', async () => {
  const srv = await startPublishSut({ scenario: 'happy' });
  try {
    const runDir = join(tmp, 'w1-run');
    mkdirSync(runDir, { recursive: true });
    const r = run([CASEY, 'run', 'tc_pub_replay', '--sut', srv.url, '--events', EVENTS, '--expected', EXP_HAPPY, '--profile', PROFILE,
      '--run-dir', runDir, '--generated-at', '2026-07-03T00:00:00.000Z']);
    if (r.status !== 0) throw new Error(`casey run 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
    const verdict = JSON.parse(readFileSync(join(runDir, 'verdict.json'), 'utf8'));
    for (const iid of ['intent_1', 'intent_2']) {
      const v = (verdict.steps || []).find((s) => s.intentId === iid);
      if (!v || v.verdict !== 'PASS') throw new Error(`${iid} 应 PASS，实际 ${v && v.verdict}（reason=${v && v.reason}）`);
    }
    for (const ext of ['html', 'md', 'json']) {
      if (!existsSync(join(runDir, `tc_pub_replay.report.${ext}`))) throw new Error(`缺 report.${ext}`);
    }
  } finally { await srv.close(); }
});

// ---------- C 编译向：workflow.publish 编译知识（闸段 + 执行段 hermetic） ----------
const TC = join(tmp, 'tc_pub_smoke.testcase.json');
writeFileSync(TC, JSON.stringify({
  schemaVersion: 1, caseId: 'tc_pub_smoke', channel: 'web', uniquePrefix: 'atl_',
  preconditions: ['已登录'], source: 'golden-fixture（移植 regress wf_publish_states）',
  intents: [
    { intentId: 'intent_create', text: '新建空工作流，断未发布态按钮组（有发布/有保存/无导出）' },
    { intentId: 'intent_publish', text: '点发布，断已发布态按钮组（有导出/有新建版本/无发布）' },
  ],
}, null, 2));
const FLOW = join(tmp, 'pub-flow-draft.json');
writeFileSync(FLOW, JSON.stringify({
  id: 'tc_pub_smoke', name: '发布状态×按钮（casey 移植）', category: 'normal',
  steps: [
    { atom: 'login', params: {} },
    { atom: 'workflow.create', params: { name: 'atl_pub1' } },
    { atom: 'assert.buttonState', params: { name: '发布', state: 'present' } },
    { atom: 'assert.buttonState', params: { name: '保存', state: 'present' } },
    { atom: 'assert.buttonState', params: { name: '导出', state: 'absent' } },
    { atom: 'workflow.publish', params: {} },
    { atom: 'assert.buttonState', params: { name: '导出', state: 'present' } },
    { atom: 'assert.buttonState', params: { name: '新建版本', state: 'present' } },
    { atom: 'assert.buttonState', params: { name: '发布', state: 'absent' } },
  ],
}, null, 2));

await checkAsync('C1 闸段 + 执行段：workflow.publish 编译知识产 event、六断言原子折 intent 留痕、observed 零新键', async () => {
  const srv = await startPublishSut({ scenario: 'happy' });
  try {
    const dir = join(tmp, 'compile-out');
    mkdirSync(dir, { recursive: true });
    const g = run([CASEY, 'compile', 'tc_pub_smoke', '--testcase', TC, '--flow', FLOW, '--out-dir', dir]);
    if (g.status !== 0) throw new Error(`闸段应 exit 0，实际 ${g.status}：${(g.stderr || '').slice(-200)}`);
    const flowFile = join(dir, 'flow-tc_pub_smoke.json');
    const flow = JSON.parse(readFileSync(flowFile, 'utf8'));
    flow.confirmedBy = 'golden-human'; flow.confirmedAt = '2026-07-03T00:00:00.000Z';
    writeFileSync(flowFile, JSON.stringify(flow, null, 2));
    const e = run([CASEY, 'compile', 'tc_pub_smoke', '--execute', '--testcase', TC, '--sut', srv.url, '--out-dir', dir, '--profile', PROFILE, '--skip-login', '--unique-name', 'pub1']);
    if (e.status !== 0) throw new Error(`执行段应 exit 0，实际 ${e.status}：${(e.stderr || e.stdout || '').slice(-300)}`);
    const events = JSON.parse(readFileSync(join(dir, 'events.json'), 'utf8'));
    const pubEvs = events.events.filter((ev) => ev.atom === 'workflow.publish');
    if (pubEvs.length !== 1 || pubEvs[0].action !== 'click') throw new Error(`workflow.publish 应产单个 click event，实际 ${JSON.stringify(pubEvs.map((x) => x.action))}`);
    const sem = pubEvs[0].semantic || {};
    if (sem.role !== 'button' || sem.name !== '发布' || sem.exact !== true) throw new Error(`publish event 应 role button«发布» exact，实际 ${JSON.stringify(sem)}`);
    const report = JSON.parse(readFileSync(join(dir, 'compile-report.json'), 'utf8'));
    const atoms = (report.handoff && report.handoff.assertionAtoms || []).filter((a) => a.atom === 'assert.buttonState');
    if (atoms.length !== 6) throw new Error(`assertionAtoms 应含六条 assert.buttonState 留痕，实际 ${atoms.length}`);
    const states = atoms.map((a) => a.params && a.params.state);
    if (states.filter((s) => s === 'present').length !== 4 || states.filter((s) => s === 'absent').length !== 2) {
      throw new Error(`留痕 op 分布应 4 present + 2 absent，实际 ${JSON.stringify(states)}`);
    }
    // observed 零新键（GRILL D2 同构口径修正：回放侧单点采集，observed schema additionalProperties:false 不动）。
    const observed = JSON.parse(readFileSync(join(dir, 'observed-tc_pub_smoke.json'), 'utf8'));
    for (const st of observed.steps || []) {
      if ('buttonHits' in st) throw new Error('observed 不应新增 buttonHits 键（schema 冻结面不动）');
    }
  } finally { await srv.close(); }
});

if (fails.length) {
  for (const f of fails) console.error(`RED  wf-publish-states: ${f}`);
  console.error(`RED  wf-publish-states: ${pass} 过 / ${fails.length} 红`);
  process.exit(1);
}
console.log(`ok   wf-publish-states: ${pass}/${pass} 全过（词表收窄 + buttonState 三向 + 双通道采集 + 对抗场景 + 端到端 + 编译知识）`);
process.exit(0);
