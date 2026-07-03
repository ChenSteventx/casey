#!/usr/bin/env node
// 冻结黄金标准（chiefcomplaint-smoke · hermetic）：飞轮第二条流式 chat 移植。
// 决策依 docs/plans/chiefcomplaint-smoke/proposed/GRILL.md（D1 reply 系三 kind 7→10 / D2 动态流等待 /
// D3 keydown 触发垫 / D5 DOM 气泡采集）。考场 = tests/fixtures/chat-sut（假 SUT：发送钮 keydown 前
// disabled、SSE 分片 + event:finished、气泡渐进渲染）。
// 实现前必红：三 kind 走 default 分支（ok:false/actual:null）、回放无流等待（送后 ~750ms 即采样，
// 尾块 1.1s 才到）、compile 对 chat 原子抛「暂无编译知识」。改本文件 = Test Ratchet 判红。
import { readFileSync, writeFileSync, existsSync, mkdtempSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { evaluateAssertions, IMPLEMENTED_KINDS } from '../../lib/replay-assert.mjs';
import { startChatSut } from '../fixtures/chat-sut/server.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const REPLAY = join(ROOT, 'bin', 'replay.mjs');
const CASEY = join(ROOT, 'bin', 'casey.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'casey-chief-'));
const run = (args, opts = {}) => spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 120000, ...opts });

const fails = [];
let pass = 0;
function check(name, fn) {
  try { fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-300)}`); }
}
async function checkAsync(name, fn) {
  try { await fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-300)}`); }
}

// ---------- U 单元向：三 kind + 谓词普化 ----------
check('U1 IMPLEMENTED_KINDS 7→10（replyContains/replyMatches/textHidden 入列，buttonState/switchState 仍外）', () => {
  for (const k of ['replyContains', 'replyMatches', 'textHidden']) if (!IMPLEMENTED_KINDS.has(k)) throw new Error(`已实现集缺 ${k}`);
  for (const k of ['buttonState', 'switchState']) if (IMPLEMENTED_KINDS.has(k)) throw new Error(`${k} 不应在已实现集（冻结 golden 未实现范例依赖）`);
  if (IMPLEMENTED_KINDS.size !== 10) throw new Error(`已实现集应 10 种，实际 ${IMPLEMENTED_KINDS.size}`);
});

check('U2 replyContains 命中/未命中/证不出三向', () => {
  const hit = evaluateAssertions([{ kind: 'replyContains', op: 'contains', value: '建议' }], { replyText: '您好，建议多休息。' })[0];
  if (hit.ok !== true || !String(hit.actual).includes('建议')) throw new Error(`命中应 true 且 actual 携回复，实际 ${hit.ok}/${hit.actual}`);
  const miss = evaluateAssertions([{ kind: 'replyContains', op: 'contains', value: '不存在词九三七' }], { replyText: '您好。' })[0];
  if (miss.ok !== false) throw new Error(`未命中应 false，实际 ${miss.ok}`);
  const na = evaluateAssertions([{ kind: 'replyContains', op: 'contains', value: '建议' }], {})[0];
  if (na.ok !== false || na.actual !== null) throw new Error(`缺采集应 false/null（证不出），实际 ${na.ok}/${na.actual}`);
});

check('U3 replyMatches 匹配/不匹配/证不出三向', () => {
  const hit = evaluateAssertions([{ kind: 'replyMatches', op: 'matches', value: '休息' }], { replyText: '建议多休息。' })[0];
  if (hit.ok !== true) throw new Error(`匹配应 true，实际 ${hit.ok}`);
  const neg = evaluateAssertions([{ kind: 'replyMatches', op: 'matches', value: '^(?!(.|\\n)*操作失败)' }], { replyText: '建议多休息。' })[0];
  if (neg.ok !== true) throw new Error(`负向环视无命中应 true，实际 ${neg.ok}`);
  const miss = evaluateAssertions([{ kind: 'replyMatches', op: 'matches', value: '^绝不匹配$' }], { replyText: '建议多休息。' })[0];
  if (miss.ok !== false) throw new Error(`不匹配应 false，实际 ${miss.ok}`);
  const na = evaluateAssertions([{ kind: 'replyMatches', op: 'matches', value: '休息' }], {})[0];
  if (na.ok !== false || na.actual !== null) throw new Error(`缺采集应 false/null，实际 ${na.ok}/${na.actual}`);
  // codex R1-F1：缺 value 时 new RegExp(undefined) 是空正则匹配一切——必须证不出，绝不判真。
  const noVal = evaluateAssertions([{ kind: 'replyMatches', op: 'matches' }], { replyText: '建议多休息。' })[0];
  if (noVal.ok !== false) throw new Error(`缺 value 应 false（fail-safe），实际 ${noVal.ok}`);
});

check('U4 textHidden 缺席真过/在场真败/证不出三向', () => {
  const clean = evaluateAssertions([{ kind: 'textHidden', op: 'absent', value: '操作失败' }], { textHits: { '操作失败': 0 } })[0];
  if (clean.ok !== true || clean.actual !== 0) throw new Error(`缺席应 true/0，实际 ${clean.ok}/${clean.actual}`);
  const bad = evaluateAssertions([{ kind: 'textHidden', op: 'absent', value: '操作失败' }], { textHits: { '操作失败': 2 } })[0];
  if (bad.ok !== false || bad.actual !== 2) throw new Error(`在场应 false/2，实际 ${bad.ok}/${bad.actual}`);
  const na = evaluateAssertions([{ kind: 'textHidden', op: 'absent', value: '操作失败' }], {})[0];
  if (na.ok !== false || na.actual !== null) throw new Error(`缺采集应 false/null，实际 ${na.ok}/${na.actual}`);
});

check('U5 streamReplyReceived 谓词普化：profile 模式命中 + legacy 兼容 + 双不中拒', () => {
  const mk = (url) => [{ url, status: 200, streamFinished: true, streamStatus: 200, attributedStepId: 'atstep_0' }];
  const viaProfile = evaluateAssertions([{ kind: 'streamReplyReceived', op: 'finished' }],
    { netRecords: mk('http://x/ai-api/tester/agent/stream'), streamUrlPattern: '/ai-api/tester/agent/stream' })[0];
  if (viaProfile.ok !== true) throw new Error(`profile 模式命中应 true，实际 ${viaProfile.ok}`);
  const legacy = evaluateAssertions([{ kind: 'streamReplyReceived', op: 'finished' }],
    { netRecords: mk('http://x/api/llm/streamReply') })[0];
  if (legacy.ok !== true) throw new Error(`legacy /streamReply/ 兼容应 true，实际 ${legacy.ok}`);
  const neither = evaluateAssertions([{ kind: 'streamReplyReceived', op: 'finished' }],
    { netRecords: mk('http://x/api/other'), streamUrlPattern: '/ai-api/tester/agent/stream' })[0];
  if (neither.ok !== false) throw new Error(`双不中应 false，实际 ${neither.ok}`);
});

// ---------- I 集成向（chat-sut 回放） ----------
const PROFILE = join(tmp, 'profile.json');
writeFileSync(PROFILE, JSON.stringify({
  background: [], successField: 'status', successValue: 200,
  chat: { streamUrlPattern: '/ai-api/tester/agent/stream', replySelector: '.hr-chat__text__assistant' },
}));
function chatEventsDoc() {
  return {
    schemaVersion: 2, channel: 'web', caseId: 'tc_chat_replay',
    url: '{{baseUrl}}/agent/detail', recordedAt: '2026-07-03T00:00:00.000Z', compiledBy: 'golden-fixture', authored: false,
    events: [
      { stepId: 'atstep_0', intentId: 'intent_0', atom: 'nav.agentDetail', action: 'nav', url: '{{baseUrl}}/agent/detail' },
      { stepId: 'atstep_1', intentId: 'intent_1', atom: 'agent.openTestPanel', action: 'click', semantic: { kind: 'role', role: 'button', name: '测试', exact: true } },
      { stepId: 'atstep_2', intentId: 'intent_2', atom: 'chat.sendAndWait', action: 'fill', semantic: { kind: 'role', role: 'textbox', name: '请输入消息', exact: true }, value: '头疼三天，伴轻微恶心' },
      { stepId: 'atstep_3', intentId: 'intent_2', atom: 'chat.sendAndWait', action: 'press', key: 'Space', semantic: { kind: 'role', role: 'textbox', name: '请输入消息', exact: true } },
      { stepId: 'atstep_4', intentId: 'intent_2', atom: 'chat.sendAndWait', action: 'press', key: 'Backspace', semantic: { kind: 'role', role: 'textbox', name: '请输入消息', exact: true } },
      { stepId: 'atstep_5', intentId: 'intent_2', atom: 'chat.sendAndWait', action: 'click', fallbackCss: '.hr-icon.hr-icon-arrow-up' },
      { stepId: 'atstep_6', intentId: 'intent_3', atom: 'chat.closeTestPanel', action: 'click', fallbackCss: '.hr-drawer.hr-drawer--right.hr-drawer--open > .hr-drawer__content-wrapper > .hr-drawer__close-btn > .hr-icon' },
    ],
  };
}
const EVENTS = join(tmp, 'chat-events.json');
writeFileSync(EVENTS, JSON.stringify(chatEventsDoc(), null, 2));
function expectedDoc(intent2) {
  return { caseId: 'tc_chat_replay', channel: 'web', intents: [{ intentId: 'intent_2', expected: intent2 }], globalAssertions: [] };
}
const EXP_HAPPY = join(tmp, 'exp-happy.json');
writeFileSync(EXP_HAPPY, JSON.stringify(expectedDoc([
  { kind: 'streamReplyReceived', op: 'finished', soft: false },
  { kind: 'replyContains', op: 'contains', value: '建议', soft: false },
  { kind: 'textVisible', op: 'appears', value: '建议多休息。', soft: false },
  { kind: 'textHidden', op: 'absent', value: '操作失败', soft: false },
])));

await checkAsync('I1 happy：keydown 垫真 enable + 动态流等待 + reply 采集四断言全过（送步耗时覆盖流窗）', async () => {
  const srv = await startChatSut({ scenario: 'happy' });
  try {
    const OUT = join(tmp, 'i1-axes.json');
    const RH = join(tmp, 'i1-run-history.jsonl');
    const r = run([REPLAY, '--events', EVENTS, '--sut', srv.url, '--expected', EXP_HAPPY, '--profile', PROFILE, '--out', OUT, '--run-history', RH]);
    if (r.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
    const axes = JSON.parse(readFileSync(OUT, 'utf8'));
    const s2 = axes.steps.find((s) => s.intentId === 'intent_2');
    for (const kind of ['streamReplyReceived', 'replyContains', 'textVisible', 'textHidden']) {
      const a = (s2.postAssertions || []).find((x) => x.kind === kind);
      if (!a || a.ok !== true) throw new Error(`${kind} 应 ok:true，实际 ${a?.ok}（actual=${JSON.stringify(a?.actual)}）`);
    }
    const rc = s2.postAssertions.find((x) => x.kind === 'replyContains');
    if (!String(rc.actual).includes('建议多休息')) throw new Error(`replyContains actual 应携全量回复（气泡 2s 稳定后），实际 ${rc.actual}`);
    // 逐 event 动作全成（keydown 垫后发送钮真 enable，click 未超时）
    for (const ea of s2.eventActions) {
      if ((ea.action && ea.action.resolution) !== 'unique') throw new Error(`步 ${ea.stepId} 应 unique，实际 ${ea.action && ea.action.resolution}（disabled 钮点击失败即现形）`);
    }
    // 流等待证据：送步（atstep_5）耗时 ≥1500ms（流尾 1.8s+气泡稳定；无等待时 ~750ms 必红）；非流步不背锅 <5s
    const lines = readFileSync(RH, 'utf8').trim().split('\n').map((s) => JSON.parse(s));
    const send = lines.find((l) => l.stepId === 'atstep_5');
    if (!send || send.durationMs < 1500) throw new Error(`送步 durationMs 应 ≥1500（动态流等待），实际 ${send && send.durationMs}`);
    const open = lines.find((l) => l.stepId === 'atstep_1');
    if (!open || open.durationMs > 5000) throw new Error(`无流步不应长等（<5s），实际 ${open && open.durationMs}`);
  } finally { await srv.close(); }
});

await checkAsync('I2 error：气泡携「操作失败」→ textHidden 真败（actual≥1）、replyContains(建议) 真败', async () => {
  const srv = await startChatSut({ scenario: 'error' });
  try {
    const EXP = join(tmp, 'exp-err.json');
    writeFileSync(EXP, JSON.stringify(expectedDoc([
      { kind: 'textHidden', op: 'absent', value: '操作失败', soft: false },
      { kind: 'replyContains', op: 'contains', value: '建议', soft: false },
    ])));
    const OUT = join(tmp, 'i2-axes.json');
    const r = run([REPLAY, '--events', EVENTS, '--sut', srv.url, '--expected', EXP, '--profile', PROFILE, '--out', OUT]);
    if (r.status !== 0) throw new Error(`replay 应 exit 0（断言败进轴不改码），实际 ${r.status}`);
    const axes = JSON.parse(readFileSync(OUT, 'utf8'));
    const s2 = axes.steps.find((s) => s.intentId === 'intent_2');
    const th = s2.postAssertions.find((x) => x.kind === 'textHidden');
    if (!th || th.ok !== false || !(Number(th.actual) >= 1)) throw new Error(`textHidden 应 false/≥1，实际 ${th?.ok}/${th?.actual}`);
    const rc = s2.postAssertions.find((x) => x.kind === 'replyContains');
    if (!rc || rc.ok !== false || !String(rc.actual).includes('操作失败')) throw new Error(`replyContains 应 false 且 actual 携实采回复，实际 ${rc?.ok}/${rc?.actual}`);
  } finally { await srv.close(); }
});

await checkAsync('I3 stale：旧气泡在场 + 死发送（无流无新气泡）→ reply 断言证不出，绝不吃陈迹（codex R1-F3）', async () => {
  const srv = await startChatSut({ scenario: 'stale' });
  try {
    const EXP = join(tmp, 'exp-stale.json');
    // 旧气泡「历史回复：建议多喝水」含「建议」——若采集吃陈迹，replyContains 会假绿。
    writeFileSync(EXP, JSON.stringify(expectedDoc([
      { kind: 'replyContains', op: 'contains', value: '建议', soft: false },
    ])));
    const OUT = join(tmp, 'i3-axes.json');
    const r = run([REPLAY, '--events', EVENTS, '--sut', srv.url, '--expected', EXP, '--profile', PROFILE, '--out', OUT]);
    if (r.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r.status}`);
    const axes = JSON.parse(readFileSync(OUT, 'utf8'));
    const s2 = axes.steps.find((s) => s.intentId === 'intent_2');
    const rc = s2.postAssertions.find((x) => x.kind === 'replyContains');
    if (!rc || rc.ok !== false || rc.actual !== null) throw new Error(`本次无回复应 false/null（证不出），实际 ${rc?.ok}/${JSON.stringify(rc?.actual)}`);
  } finally { await srv.close(); }
});

await checkAsync('I4 bgstream：背景长流在场，无关步不被拖等（流等待按本步发起归因，codex R1-F2）', async () => {
  const srv = await startChatSut({ scenario: 'bgstream' });
  try {
    const OUT = join(tmp, 'i4-axes.json');
    const RH = join(tmp, 'i4-run-history.jsonl');
    const r = run([REPLAY, '--events', EVENTS, '--sut', srv.url, '--expected', EXP_HAPPY, '--profile', PROFILE, '--out', OUT, '--run-history', RH]);
    if (r.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
    const lines = readFileSync(RH, 'utf8').trim().split('\n').map((s) => JSON.parse(s));
    // R2 收口：除送步外全部步（含 nav、含「测试」点击——它作用域内真开了一条背景长流）都不得被
    // 拖到 30s 上界；流等待 = 本步发起 且 命中 chat 流 URL 域，二者缺一不等。
    for (const l of lines) {
      if (l.stepId === 'atstep_5') continue;
      if (l.durationMs > 8000) throw new Error(`非送步 ${l.stepId} 不应被长流拖等（<8s），实际 ${l.durationMs}`);
    }
    // 本步发起的对话流照常等到：reply 断言仍全过。
    const axes = JSON.parse(readFileSync(OUT, 'utf8'));
    const s2 = axes.steps.find((s) => s.intentId === 'intent_2');
    const rc = s2.postAssertions.find((x) => x.kind === 'replyContains');
    if (!rc || rc.ok !== true) throw new Error(`本步对话流断言应照常过，实际 ${rc?.ok}`);
  } finally { await srv.close(); }
});

// ---------- W 接线向：casey run 端到端 ----------
await checkAsync('W1 casey run 对 chat-sut 端到端：verdict PASS 锚 + 报告三件 + runId=目录名', async () => {
  const srv = await startChatSut({ scenario: 'happy' });
  try {
    const runDir = join(tmp, 'w1-run');
    mkdirSync(runDir, { recursive: true });
    const r = run([CASEY, 'run', 'tc_chat_replay', '--sut', srv.url, '--events', EVENTS, '--expected', EXP_HAPPY, '--profile', PROFILE,
      '--run-dir', runDir, '--generated-at', '2026-07-03T00:00:00.000Z']);
    if (r.status !== 0) throw new Error(`casey run 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
    const verdict = JSON.parse(readFileSync(join(runDir, 'verdict.json'), 'utf8'));
    const v2 = (verdict.steps || []).find((s) => s.intentId === 'intent_2');
    if (!v2 || v2.verdict !== 'PASS') throw new Error(`intent_2 应 PASS，实际 ${v2 && v2.verdict}（reason=${v2 && v2.reason}）`);
    for (const ext of ['html', 'md', 'json']) {
      if (!existsSync(join(runDir, `tc_chat_replay.report.${ext}`))) throw new Error(`缺 report.${ext}`);
    }
    const m = JSON.parse(readFileSync(join(runDir, 'run-metrics.json'), 'utf8'));
    if (m.runId !== basename(runDir)) throw new Error(`runId 应 ${basename(runDir)}，实际 ${m.runId}`);
  } finally { await srv.close(); }
});

// ---------- C 编译向：五原子编译知识（闸段 + 执行段 hermetic） ----------
const TC = join(tmp, 'tc_chat_smoke.testcase.json');
writeFileSync(TC, JSON.stringify({
  schemaVersion: 1, caseId: 'tc_chat_smoke', channel: 'web', uniquePrefix: 'atl_',
  preconditions: ['已登录'], source: 'golden-fixture（移植 regress chiefcomplaint_smoke）',
  intents: [
    { intentId: 'intent_nav', text: '进入智能体管理' },
    { intentId: 'intent_open', text: '搜索并打开互联网问诊-主诉' },
    { intentId: 'intent_panel', text: '打开测试面板' },
    { intentId: 'intent_send', text: '发送主诉并等 LLM 回复，无错误弹窗、回复不含操作失败' },
    { intentId: 'intent_close', text: '关闭测试面板' },
  ],
}, null, 2));
const FLOW = join(tmp, 'chat-flow-draft.json');
writeFileSync(FLOW, JSON.stringify({
  id: 'tc_chat_smoke', name: '主诉发消息冒烟（casey 移植）', category: 'normal',
  steps: [
    { atom: 'login', params: {} },
    { atom: 'nav.agentManagement', params: {} },
    { atom: 'agent.searchOpen', params: { searchKeyword: 'chiefComplaint', openName: '互联网问诊-主诉' } },
    { atom: 'agent.openTestPanel', params: {} },
    { atom: 'chat.sendAndWait', params: { prompt: '头疼三天，伴轻微恶心' } },
    { atom: 'assert.noErrorToast', params: {} },
    { atom: 'assert.bubble', params: { mustNotInclude: ['操作失败'] } },
    { atom: 'chat.closeTestPanel', params: {} },
  ],
}, null, 2));

await checkAsync('C1 闸段 + C2 执行段：五原子编译知识产四件套、chat 步 observed 回填 reply、keydown 垫入 events', async () => {
  const srv = await startChatSut({ scenario: 'happy' });
  try {
    const dir = join(tmp, 'compile-out');
    mkdirSync(dir, { recursive: true });
    const g = run([CASEY, 'compile', 'tc_chat_smoke', '--testcase', TC, '--flow', FLOW, '--out-dir', dir]);
    if (g.status !== 0) throw new Error(`闸段应 exit 0，实际 ${g.status}：${(g.stderr || '').slice(-200)}`);
    const flowFile = join(dir, 'flow-tc_chat_smoke.json');
    const flow = JSON.parse(readFileSync(flowFile, 'utf8'));
    flow.confirmedBy = 'golden-human'; flow.confirmedAt = '2026-07-03T00:00:00.000Z';
    writeFileSync(flowFile, JSON.stringify(flow, null, 2));
    const e = run([CASEY, 'compile', 'tc_chat_smoke', '--execute', '--testcase', TC, '--sut', srv.url, '--out-dir', dir, '--profile', PROFILE, '--skip-login', '--unique-name', 'g1']);
    if (e.status !== 0) throw new Error(`执行段应 exit 0，实际 ${e.status}：${(e.stderr || e.stdout || '').slice(-300)}`);
    const events = JSON.parse(readFileSync(join(dir, 'events.json'), 'utf8'));
    const chatActs = events.events.filter((ev) => ev.atom === 'chat.sendAndWait').map((ev) => ev.action);
    const want = ['fill', 'press', 'press', 'click'];
    if (JSON.stringify(chatActs) !== JSON.stringify(want)) throw new Error(`chat 步应产 keydown 垫序列 ${want}，实际 ${JSON.stringify(chatActs)}`);
    const observed = JSON.parse(readFileSync(join(dir, 'observed-tc_chat_smoke.json'), 'utf8'));
    const sendObs = observed.steps.filter((s) => s.atom === 'chat.sendAndWait').slice(-1)[0];
    if (!sendObs || !String(sendObs.replyText || '').includes('建议多休息')) throw new Error(`observed 送步 replyText 应回填全量回复，实际 ${sendObs && JSON.stringify(sendObs.replyText)}`);
    if ((sendObs.replyStreamUrl || '') !== '/ai-api/tester/agent/stream') throw new Error(`replyStreamUrl 应为流路径段，实际 ${sendObs && sendObs.replyStreamUrl}`);
    const report = JSON.parse(readFileSync(join(dir, 'compile-report.json'), 'utf8'));
    const atoms = (report.handoff && report.handoff.assertionAtoms || []).map((a) => a.atom);
    if (!atoms.includes('assert.noErrorToast') || !atoms.includes('assert.bubble')) throw new Error(`assertionAtoms 应含两断言原子，实际 ${JSON.stringify(atoms)}`);
  } finally { await srv.close(); }
});

if (fails.length) {
  for (const f of fails) console.error(`RED  chiefcomplaint-smoke: ${f}`);
  console.error(`RED  chiefcomplaint-smoke: ${pass} 过 / ${fails.length} 红`);
  process.exit(1);
}
console.log(`ok   chiefcomplaint-smoke: ${pass}/${pass} 全过（三 kind 三向 + 谓词普化 + 动态流等待 + keydown 垫 + reply 双侧采集 + 编排/编译端到端）`);
process.exit(0);
