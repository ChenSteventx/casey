#!/usr/bin/env node
// 冻结黄金标准（kinds-harden · hermetic）：textVisible / noErrorToast 提硬（IMPLEMENTED_KINDS 5→7）。
// 决策依 docs/plans/kinds-harden/proposed/GRILL.md（G1 词表判人签 / G3 代表步静默点采集同构 compile）。
// 实现前必红：两 kind 走 default 分支（ok:false / actual:null）、replay 无采集上下文。改本文件 = Test Ratchet 判红。
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { evaluateAssertions, IMPLEMENTED_KINDS } from '../../lib/replay-assert.mjs';
import { startLoginSut } from '../fixtures/login-sut/server.mjs';
import { signExpected } from './_sign-helper.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const REPLAY = join(ROOT, 'bin', 'replay.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'casey-kh-'));

const fails = [];
let pass = 0;
function check(name, fn) {
  try { fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-300)}`); }
}
async function checkAsync(name, fn) {
  try { await fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-300)}`); }
}

// ---------- U 单元向：evaluateAssertions 两 kind 正反 + 证不出 ----------
check('U1 IMPLEMENTED_KINDS 含本轮两 kind（switchState 仍不在；精确计数移交最新前沿 golden 持有）', () => {
  // 重钉（chiefcomplaint-smoke D7 涟漪，2026-07-03）：原 size===7 是「未实现范例会过期」的同型钉点——
  // 已实现集随飞轮只增不减，精确计数由最新一轮契约的 golden 钉（现 wf-publish-states.golden ===11），
  // 本 golden 只守本轮资产：两 kind 在列 + switchState（未实现范例依赖，wf-publish-states 涟漪把
  // buttonState 换下——它已实现）不在列。
  for (const k of ['textVisible', 'noErrorToast']) if (!IMPLEMENTED_KINDS.has(k)) throw new Error(`已实现集缺 ${k}`);
  if (IMPLEMENTED_KINDS.has('switchState')) throw new Error('switchState 不应在已实现集（冻结 golden 未实现范例依赖）');
  if (IMPLEMENTED_KINDS.size < 7) throw new Error(`已实现集不应缩水（≥7），实际 ${IMPLEMENTED_KINDS.size}`);
});

check('U2 textVisible 命中/未命中/证不出三向', () => {
  const hit = evaluateAssertions([{ kind: 'textVisible', op: 'appears', value: '保存成功' }], { textHits: { '保存成功': 2 } })[0];
  if (hit.ok !== true || hit.actual !== 2) throw new Error(`命中应 true/2，实际 ${hit.ok}/${hit.actual}`);
  const miss = evaluateAssertions([{ kind: 'textVisible', op: 'appears', value: '保存成功' }], { textHits: { '保存成功': 0 } })[0];
  if (miss.ok !== false || miss.actual !== 0) throw new Error(`未命中应 false/0，实际 ${miss.ok}/${miss.actual}`);
  const na = evaluateAssertions([{ kind: 'textVisible', op: 'appears', value: '保存成功' }], {})[0];
  if (na.ok !== false || na.actual !== null) throw new Error(`缺采集应 false/null（证不出），实际 ${na.ok}/${na.actual}`);
});

check('U3 noErrorToast 词表判三向 + 证不出', () => {
  const clean = evaluateAssertions([{ kind: 'noErrorToast', op: 'absent' }], { toastTexts: ['保存成功'] })[0];
  if (clean.ok !== true) throw new Error(`非错误弹窗应 true，实际 ${clean.ok}`);
  if (String(clean.actual) !== '保存成功') throw new Error(`actual 应携实采 toast 文本，实际 ${JSON.stringify(clean.actual)}`);
  const bad = evaluateAssertions([{ kind: 'noErrorToast', op: 'absent' }], { toastTexts: ['操作失败：无权限'] })[0];
  if (bad.ok !== false) throw new Error(`错误词表命中应 false，实际 ${bad.ok}`);
  if (!String(bad.actual).includes('操作失败')) throw new Error('actual 应携命中文本供人核');
  const none = evaluateAssertions([{ kind: 'noErrorToast', op: 'absent' }], { toastTexts: [] })[0];
  if (none.ok !== true) throw new Error(`零弹窗应 true，实际 ${none.ok}`);
  const na = evaluateAssertions([{ kind: 'noErrorToast', op: 'absent' }], {})[0];
  if (na.ok !== false || na.actual !== null) throw new Error(`缺采集应 false/null（证不出），实际 ${na.ok}/${na.actual}`);
});

// ---------- I 集成向：replay 代表步现场采集（login-sut 假 SUT） ----------
const PROFILE = join(tmp, 'profile.json');
writeFileSync(PROFILE, JSON.stringify({ background: [], successField: 'status', successValue: 200 }));
function eventsDoc() {
  return {
    schemaVersion: 2, channel: 'web', caseId: 'tc_kh',
    url: '{{baseUrl}}/plain', recordedAt: '2026-07-02T00:00:00.000Z', compiledBy: 'golden-fixture', authored: false,
    events: [
      { stepId: 'atstep_0', intentId: 'intent_0', atom: 'nav.plain', action: 'nav', url: '{{baseUrl}}/plain' },
      { stepId: 'atstep_1', intentId: 'intent_1', atom: 'click.btn', action: 'click', semantic: { kind: 'role', role: 'button', name: '直达', exact: true } },
    ],
  };
}
const EVENTS = join(tmp, 'events.json');
writeFileSync(EVENTS, JSON.stringify(eventsDoc(), null, 2));
function expectedDoc(assertions0) {
  return { caseId: 'tc_kh', channel: 'web', intents: [{ intentId: 'intent_0', expected: assertions0 }], globalAssertions: [] };
}

await checkAsync('I1 集成：textVisible 页面命中真过 + noErrorToast 无弹窗真过', async () => {
  const srv = await startLoginSut({});
  try {
    const EXP = join(tmp, 'exp-hit.json');
    writeFileSync(EXP, JSON.stringify(signExpected(expectedDoc([
      { kind: 'textVisible', op: 'appears', value: '纯页' },
      { kind: 'noErrorToast', op: 'absent' },
    ]))));
    const OUT = join(tmp, 'axes-i1.json');
    const r = spawnSync(process.execPath, [REPLAY, '--events', EVENTS, '--sut', srv.url, '--expected', EXP, '--profile', PROFILE, '--out', OUT], { encoding: 'utf8', timeout: 120000 });
    if (r.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
    const axes = JSON.parse(readFileSync(OUT, 'utf8'));
    const s0 = axes.steps.find((s) => s.intentId === 'intent_0');
    const tv = (s0.postAssertions || []).find((a) => a.kind === 'textVisible');
    if (!tv || tv.ok !== true || !(Number(tv.actual) >= 1)) throw new Error(`textVisible 页面命中应 true/≥1，实际 ${tv?.ok}/${tv?.actual}`);
    const nt = (s0.postAssertions || []).find((a) => a.kind === 'noErrorToast');
    if (!nt || nt.ok !== true) throw new Error(`无弹窗页 noErrorToast 应 true，实际 ${nt?.ok}`);
  } finally { await srv.close(); }
});

await checkAsync('I2 集成：textVisible 未命中真败（不假绿）', async () => {
  const srv = await startLoginSut({});
  try {
    const EXP = join(tmp, 'exp-miss.json');
    writeFileSync(EXP, JSON.stringify(signExpected(expectedDoc([{ kind: 'textVisible', op: 'appears', value: '不存在的文字九三七' }]))));
    const OUT = join(tmp, 'axes-i2.json');
    const r = spawnSync(process.execPath, [REPLAY, '--events', EVENTS, '--sut', srv.url, '--expected', EXP, '--profile', PROFILE, '--out', OUT], { encoding: 'utf8', timeout: 120000 });
    if (r.status !== 0) throw new Error(`replay 应 exit 0（断言败进轴不改码），实际 ${r.status}`);
    const axes = JSON.parse(readFileSync(OUT, 'utf8'));
    const s0 = axes.steps.find((s) => s.intentId === 'intent_0');
    const tv = (s0.postAssertions || []).find((a) => a.kind === 'textVisible');
    if (!tv || tv.ok !== false || tv.actual !== 0) throw new Error(`未命中应 false/0，实际 ${tv?.ok}/${tv?.actual}`);
  } finally { await srv.close(); }
});

if (fails.length) {
  for (const f of fails) console.error(`RED  kinds-harden: ${f}`);
  console.error(`RED  kinds-harden: ${pass} 过 / ${fails.length} 红`);
  process.exit(1);
}
console.log(`ok   kinds-harden: ${pass}/${pass} 全过（已实现集 7+单元三向×2+集成命中/未命中/无弹窗）`);
process.exit(0);
