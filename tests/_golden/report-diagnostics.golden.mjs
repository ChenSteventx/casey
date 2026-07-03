#!/usr/bin/env node
// 冻结黄金标准（report-diagnostics · hermetic）：P7 报告消费侧「回放诊断」栏目（路 B + 逐步嵌入）。
// 决策依 docs/plans/report-diagnostics/proposed/GRILL.md（D1 Steven 拍板：renderReport 可选诊断第二参 +
// bin/report.mjs 旁件旗标 + casey run 接线；run-metrics 全局指标行、run-history 按 intentId 嵌步卡；
// D2 replyText 挂账核销 + 回归锁）。红线：仅诊断呈现、绝不进 verdict、绝不写 passes。
// 实现前必红：U2/U3/U4 双参不渲染栏目、W1 壳旗标无效果且坏旁件不拒、E1 casey run 报告无栏目。
// U1（单参零行为差）/ U5（replyText 已在渲染 = 核销依据）冻结时即绿（回归保护）。改本文件 = Test Ratchet 判红。
import { readFileSync, writeFileSync, existsSync, mkdtempSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { renderReport } from '../../lib/report.mjs';
import { startPublishSut } from '../fixtures/publish-sut/server.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const REPORT = join(ROOT, 'bin', 'report.mjs');
const CASEY = join(ROOT, 'bin', 'casey.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'casey-diag-'));
const run = (args, opts = {}) => spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 120000, ...opts });

const fails = [];
let pass = 0;
function check(name, fn) {
  try { fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-300)}`); }
}
async function checkAsync(name, fn) {
  try { await fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-300)}`); }
}

// ---- 夹具（合已冻 run-history.schema 形状；值走 golden 可辨字面量）----
function mkModel() {
  return {
    schemaVersion: 1, caseId: 'tc_diag', channel: 'web', generatedAt: '2026-07-03T00:00:00.000Z',
    verdictSummary: { PASS: 2, SUT_DEFECT: 0, HARNESS_ERROR: 0, NEEDS_HUMAN: 0 },
    steps: [
      { stepId: 'atstep_0', intentId: 'intent_1', atom: 'nav.editor', verdict: 'PASS', reason: null, postAssertions: [], observed: { urlPathnameAfter: '/x', replyText: '建议多休息。' } },
      { stepId: 'atstep_1', intentId: 'intent_2', atom: 'do.click', verdict: 'PASS', reason: null, postAssertions: [] },
    ],
  };
}
const HL = (over) => ({
  timestamp: '2026-07-03T00:00:00.000Z', caseId: 'tc_diag', stepId: 'atstep_0', intentId: 'intent_1',
  atom: 'nav.editor', action: 'nav', parameters: null, locatorResolution: null,
  quietPointReached: true, durationMs: 257, result: 'ok', ...over,
});
const HISTORY = [
  HL({ result: 'quietPointMiss', quietPointReached: false }),
  HL({ stepId: 'atstep_1', intentId: 'intent_2', atom: 'do.click', action: 'click', locatorResolution: 'unique', durationMs: 4321 }),
];
const GHOST = HL({ stepId: 'atstep_9', intentId: 'intent_ghost', action: 'click', locatorResolution: 'none', result: 'locatorError' });
const METRICS = { schemaVersion: 1, caseId: 'tc_diag', runId: 'run_golden_diag_1', totalSteps: 2, passedActions: 2, locatorHitRate: 1, quietPointWaitMs: 2823, totalDurationMs: 5641 };
const sectionOf = (html, stepId) => {
  const at = html.indexOf(`data-step-id="${stepId}"`);
  if (at < 0) throw new Error(`HTML 缺步卡 ${stepId}`);
  return html.slice(at, html.indexOf('</section>', at));
};

// ---- U 单元向：渲染器纯函数两形态 ----
check('U1 单参零行为差（codex R1-F1 收紧）：无诊断入参不渲染栏目、不注入诊断 CSS', () => {
  const out = renderReport(mkModel());
  if (out.html.includes('回放诊断')) throw new Error('单参调用不应出现诊断栏目');
  if (out.markdown.includes('回放诊断')) throw new Error('MD 单参不应出现诊断栏目');
  if (out.html.includes('diag-note')) throw new Error('单参不应注入诊断 CSS（输出字节级零差异）');
});

check('U2 双参渲染：指标行字面量 + 「仅诊断」标注在 HTML/MD、双形态零绝对 URL', () => {
  const out = renderReport(mkModel(), { metrics: METRICS, history: HISTORY });
  for (const t of ['回放诊断', 'run_golden_diag_1', '仅诊断']) {
    if (!out.html.includes(t)) throw new Error(`HTML 缺 ${t}`);
    if (!out.markdown.includes(t)) throw new Error(`MD 缺 ${t}`);
  }
  if (/https?:\/\//.test(out.html)) throw new Error('HTML 诊断栏目不得引入绝对 URL（自包含硬约束）');
  if (/https?:\/\//.test(out.markdown)) throw new Error('MD 诊断内容不得引入绝对 URL（codex R1-F4：MD 同受约束）');
});

check('U6 旁件值 :// 零容忍（codex R1-F2）：绝对 URL 形态经脱敏占位、自包含不 fail-open', () => {
  const badMetrics = { ...METRICS, runId: 'https://example.invalid/leak' };
  const badHist = [HL({ atom: 'https://example.invalid/x' })];
  const out = renderReport(mkModel(), { metrics: badMetrics, history: badHist });
  for (const [name, text] of [['HTML', out.html], ['MD', out.markdown]]) {
    if (/https?:\/\//.test(text)) throw new Error(`${name} 出现绝对 URL（旁件值走私，自包含护栏 fail-open）`);
    if (!text.includes('redacted')) throw new Error(`${name} 应含脱敏占位（宁失细节不漏形态，login-traffic-drop 先例）`);
  }
});

check('U3 逐步嵌入（D1）：history 行按 intentId 落所属步卡、他步卡不串', () => {
  const out = renderReport(mkModel(), { metrics: METRICS, history: HISTORY });
  const s0 = sectionOf(out.html, 'atstep_0');
  if (!s0.includes('quietPointMiss')) throw new Error('intent_1 步卡应含本 intent history 行（result=quietPointMiss）');
  const s1 = sectionOf(out.html, 'atstep_1');
  if (s1.includes('quietPointMiss')) throw new Error('intent_2 步卡不应串入 intent_1 的行');
  if (!s1.includes('4321') && !s1.includes('4.32')) throw new Error('intent_2 步卡应含本 intent 行耗时（4321ms 或格式化形态）');
});

check('U4 未归属行落全局小节、不静默丢', () => {
  const out = renderReport(mkModel(), { metrics: METRICS, history: [...HISTORY, GHOST] });
  if (!out.html.includes('未归属')) throw new Error('无匹配 intent 的行应落「未归属」小节');
  if (!out.html.includes('locatorError')) throw new Error('未归属行内容（locatorError）不得静默丢');
});

check('U5 replyText 回归锁（D2 核销依据，冻结即绿）：observed.replyText 在 HTML/MD 真渲染', () => {
  const out = renderReport(mkModel());
  if (!out.html.includes('pre class="reply"') || !out.html.includes('建议多休息')) throw new Error('HTML 应经 pre.reply 渲染 replyText');
  if (!out.markdown.includes('LLM 回复：建议多休息')) throw new Error('MD 应渲染 LLM 回复行');
});

// ---- W 壳旗标向 ----
const MODEL_F = join(tmp, 'model.json');
writeFileSync(MODEL_F, JSON.stringify(mkModel()));
const HIST_F = join(tmp, 'run-history.jsonl');
writeFileSync(HIST_F, [...HISTORY, GHOST].map((l) => JSON.stringify(l)).join('\n') + '\n');
const METRICS_F = join(tmp, 'run-metrics.json');
writeFileSync(METRICS_F, JSON.stringify(METRICS));

check('W1a 带旁件旗标：产物含诊断栏目', () => {
  const dir = join(tmp, 'w1a');
  const r = run([REPORT, '--model', MODEL_F, '--out', dir, '--run-history', HIST_F, '--run-metrics', METRICS_F]);
  if (r.status !== 0) throw new Error(`应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
  const html = readFileSync(join(dir, 'tc_diag.report.html'), 'utf8');
  if (!html.includes('回放诊断') || !html.includes('run_golden_diag_1')) throw new Error('落盘 HTML 应含诊断栏目与 runId');
});

check('W1b 坏旁件 fail-closed：metrics 坏 JSON → 非零退出、零落盘（宁缺不糊）', () => {
  const BAD = join(tmp, 'bad-metrics.json');
  writeFileSync(BAD, '{bad json');
  const dir = join(tmp, 'w1b');
  const r = run([REPORT, '--model', MODEL_F, '--out', dir, '--run-history', HIST_F, '--run-metrics', BAD]);
  if (r.status === 0) throw new Error('坏 metrics 应非零退出（fail-closed）');
  if (existsSync(join(dir, 'tc_diag.report.html'))) throw new Error('坏旁件不应落盘报告');
});

check('W1c 不带旗标零行为差：产物无诊断栏目', () => {
  const dir = join(tmp, 'w1c');
  const r = run([REPORT, '--model', MODEL_F, '--out', dir]);
  if (r.status !== 0) throw new Error(`应 exit 0，实际 ${r.status}`);
  const html = readFileSync(join(dir, 'tc_diag.report.html'), 'utf8');
  if (html.includes('回放诊断')) throw new Error('不带旗标不应出现诊断栏目');
});

check('W1d 坏行定义收紧（codex R1-F3）：合法 JSON 非对象行 / 缺 stepId·intentId 行 = 坏行 → 非零退出', () => {
  const cases = [['null-line', 'null'], ['num-line', '123'], ['no-ids', '{"intentId":"intent_1"}']];
  for (const [tag, line] of cases) {
    const H = join(tmp, `bad-hist-${tag}.jsonl`);
    writeFileSync(H, line + '\n');
    const dir = join(tmp, `w1d-${tag}`);
    const r = run([REPORT, '--model', MODEL_F, '--out', dir, '--run-history', H]);
    if (r.status === 0) throw new Error(`坏行（${line}）应非零退出（fail-closed，M1 坏行不静默丢）`);
    if (existsSync(join(dir, 'tc_diag.report.html'))) throw new Error(`坏行（${line}）不应落盘报告`);
  }
});

check('W1e 坏 metrics 语义收紧（codex R2）：合法 JSON 非对象（null/123/[]）→ 非零退出零落盘', () => {
  const cases = [['null-m', 'null'], ['num-m', '123'], ['arr-m', '[]']];
  for (const [tag, body] of cases) {
    const M = join(tmp, `bad-metrics-${tag}.json`);
    writeFileSync(M, body + '\n');
    const dir = join(tmp, `w1e-${tag}`);
    const r = run([REPORT, '--model', MODEL_F, '--out', dir, '--run-metrics', M]);
    if (r.status === 0) throw new Error(`坏 metrics（${body}）应非零退出（fail-closed，不得静默降级）`);
    if (existsSync(join(dir, 'tc_diag.report.html'))) throw new Error(`坏 metrics（${body}）不应落盘报告`);
  }
});

// ---- E 接线向：casey run 端到端（publish-sut 只读复用）----
await checkAsync('E1 casey run 端到端：report.html 含诊断栏目 + 步卡含本 intent 行 + runId=目录名', async () => {
  const srv = await startPublishSut({ scenario: 'happy' });
  try {
    const EVENTS = join(tmp, 'e1-events.json');
    writeFileSync(EVENTS, JSON.stringify({
      schemaVersion: 2, channel: 'web', caseId: 'tc_diag_run',
      url: '{{baseUrl}}/ai-manager/process/detail', recordedAt: '2026-07-03T00:00:00.000Z', compiledBy: 'golden-fixture', authored: false,
      events: [{ stepId: 'atstep_0', intentId: 'intent_1', atom: 'nav.editor', action: 'nav', url: '{{baseUrl}}/ai-manager/process/detail' }],
    }));
    const EXP = join(tmp, 'e1-expected.json');
    writeFileSync(EXP, JSON.stringify({
      caseId: 'tc_diag_run', channel: 'web',
      intents: [{ intentId: 'intent_1', expected: [{ kind: 'textVisible', op: 'appears', value: '工作流编辑器', soft: false }] }],
      globalAssertions: [],
    }));
    const PROFILE = join(tmp, 'e1-profile.json');
    writeFileSync(PROFILE, JSON.stringify({ background: [], successField: 'status', successValue: 200 }));
    const runDir = join(tmp, 'e1-run');
    mkdirSync(runDir, { recursive: true });
    const r = run([CASEY, 'run', 'tc_diag_run', '--sut', srv.url, '--events', EVENTS, '--expected', EXP, '--profile', PROFILE,
      '--run-dir', runDir, '--generated-at', '2026-07-03T00:00:00.000Z']);
    if (r.status !== 0) throw new Error(`casey run 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
    const html = readFileSync(join(runDir, 'tc_diag_run.report.html'), 'utf8');
    if (!html.includes('回放诊断')) throw new Error('端到端报告应含诊断栏目');
    if (!html.includes(basename(runDir))) throw new Error('指标行应携 runId=目录名');
    const s0 = sectionOf(html, 'atstep_0');
    // codex R1-F4：原子名自带 nav 子串会假阳性——改钉嵌入块标题（只可能来自诊断嵌入）。
    if (!s0.includes('本步 event 逐行')) throw new Error('步卡应嵌本 intent 的 history 行（诊断嵌入块）');
  } finally { await srv.close(); }
});

if (fails.length) {
  for (const f of fails) console.error(`RED  report-diagnostics: ${f}`);
  console.error(`RED  report-diagnostics: ${pass} 过 / ${fails.length} 红`);
  process.exit(1);
}
console.log(`ok   report-diagnostics: ${pass}/${pass} 全过（单参零行为差 + 指标行 + 逐步嵌入 + 未归属 + replyText 回归锁 + 壳旗标 + 端到端）`);
process.exit(0);
