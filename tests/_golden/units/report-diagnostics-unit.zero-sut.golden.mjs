#!/usr/bin/env node
// report-diagnostics 的真实 zero-SUT 后继：只测纯渲染器与 report CLI 文件编排；不启动/连接 SUT、浏览器或 listener。
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { renderReport } from '../../../lib/report.mjs';

// lifecycle-successor: {"sourceObligationId":"hg-report-diagnostics-u1","unitCheckId":"U1"}
// sourceObligationId:hg-report-diagnostics-u1
// lifecycle-successor: {"sourceObligationId":"hg-report-diagnostics-u2","unitCheckId":"U2"}
// sourceObligationId:hg-report-diagnostics-u2
// lifecycle-successor: {"sourceObligationId":"hg-report-diagnostics-u6","unitCheckId":"U6"}
// sourceObligationId:hg-report-diagnostics-u6
// lifecycle-successor: {"sourceObligationId":"hg-report-diagnostics-u3","unitCheckId":"U3"}
// sourceObligationId:hg-report-diagnostics-u3
// lifecycle-successor: {"sourceObligationId":"hg-report-diagnostics-u4","unitCheckId":"U4"}
// sourceObligationId:hg-report-diagnostics-u4
// lifecycle-successor: {"sourceObligationId":"hg-report-diagnostics-u5","unitCheckId":"U5"}
// sourceObligationId:hg-report-diagnostics-u5
// lifecycle-successor: {"sourceObligationId":"hg-report-diagnostics-w1a","unitCheckId":"W1a"}
// sourceObligationId:hg-report-diagnostics-w1a
// lifecycle-successor: {"sourceObligationId":"hg-report-diagnostics-w1b","unitCheckId":"W1b"}
// sourceObligationId:hg-report-diagnostics-w1b
// lifecycle-successor: {"sourceObligationId":"hg-report-diagnostics-w1c","unitCheckId":"W1c"}
// sourceObligationId:hg-report-diagnostics-w1c
// lifecycle-successor: {"sourceObligationId":"hg-report-diagnostics-w1d","unitCheckId":"W1d"}
// sourceObligationId:hg-report-diagnostics-w1d
// lifecycle-successor: {"sourceObligationId":"hg-report-diagnostics-w1e","unitCheckId":"W1e"}
// sourceObligationId:hg-report-diagnostics-w1e

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..');
const REPORT = join(ROOT, 'bin', 'report.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'casey-report-diagnostics-unit-'));
const run = (args) => spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 120000 });

const fails = [];
let pass = 0;
function check(id, fn) {
  try { fn(); pass += 1; console.log(`ok   ${id}`); }
  catch (error) { fails.push(`${id}: ${error.message}`); }
}

function mkModel() {
  return {
    schemaVersion: 1,
    caseId: 'tc_diag_unit',
    channel: 'web',
    generatedAt: '2026-07-03T00:00:00.000Z',
    verdictSummary: { PASS: 2, SUT_DEFECT: 0, HARNESS_ERROR: 0, NEEDS_HUMAN: 0 },
    steps: [
      { stepId: 'atstep_0', intentId: 'intent_1', atom: 'nav.editor', verdict: 'PASS', reason: null, postAssertions: [], observed: { urlPathnameAfter: '/x', replyText: '建议多休息。' } },
      { stepId: 'atstep_1', intentId: 'intent_2', atom: 'do.click', verdict: 'PASS', reason: null, postAssertions: [] },
    ],
  };
}

const historyLine = (overrides) => ({
  timestamp: '2026-07-03T00:00:00.000Z',
  caseId: 'tc_diag_unit',
  stepId: 'atstep_0',
  intentId: 'intent_1',
  atom: 'nav.editor',
  action: 'nav',
  parameters: null,
  locatorResolution: null,
  quietPointReached: true,
  durationMs: 257,
  result: 'ok',
  ...overrides,
});
const HISTORY = [
  historyLine({ result: 'quietPointMiss', quietPointReached: false }),
  historyLine({ stepId: 'atstep_1', intentId: 'intent_2', atom: 'do.click', action: 'click', locatorResolution: 'unique', durationMs: 4321 }),
];
const GHOST = historyLine({ stepId: 'atstep_9', intentId: 'intent_ghost', action: 'click', locatorResolution: 'none', result: 'locatorError' });
const METRICS = {
  schemaVersion: 1,
  caseId: 'tc_diag_unit',
  runId: 'run_golden_diag_1',
  totalSteps: 2,
  passedActions: 2,
  locatorHitRate: 1,
  quietPointWaitMs: 2823,
  totalDurationMs: 5641,
};
function sectionOf(html, stepId) {
  const at = html.indexOf(`data-step-id="${stepId}"`);
  if (at < 0) throw new Error(`HTML 缺步卡 ${stepId}`);
  return html.slice(at, html.indexOf('</section>', at));
}

check('U1', () => {
  const out = renderReport(mkModel());
  if (out.html.includes('回放诊断') || out.markdown.includes('回放诊断')) throw new Error('单参调用不应出现诊断栏目');
  if (out.html.includes('diag-note')) throw new Error('单参调用不应注入诊断 CSS');
});

check('U2', () => {
  const out = renderReport(mkModel(), { metrics: METRICS, history: HISTORY });
  for (const text of ['回放诊断', 'run_golden_diag_1', '仅诊断']) {
    if (!out.html.includes(text) || !out.markdown.includes(text)) throw new Error(`双形态缺 ${text}`);
  }
  if (/https?:\/\//.test(out.html) || /https?:\/\//.test(out.markdown)) throw new Error('诊断栏目不得引入绝对 URL');
});

check('U6', () => {
  const out = renderReport(mkModel(), {
    metrics: { ...METRICS, runId: 'https://example.invalid/leak' },
    history: [historyLine({ atom: 'https://example.invalid/x' })],
  });
  for (const [kind, text] of [['HTML', out.html], ['MD', out.markdown]]) {
    if (/https?:\/\//.test(text)) throw new Error(`${kind} 出现绝对 URL`);
    if (!text.includes('redacted')) throw new Error(`${kind} 缺脱敏占位`);
  }
});

check('U3', () => {
  const out = renderReport(mkModel(), { metrics: METRICS, history: HISTORY });
  const first = sectionOf(out.html, 'atstep_0');
  const second = sectionOf(out.html, 'atstep_1');
  if (!first.includes('quietPointMiss')) throw new Error('intent_1 步卡缺本 intent history');
  if (second.includes('quietPointMiss')) throw new Error('intent_2 步卡串入 intent_1 history');
  if (!second.includes('4321') && !second.includes('4.32')) throw new Error('intent_2 步卡缺耗时');
});

check('U4', () => {
  const out = renderReport(mkModel(), { metrics: METRICS, history: [...HISTORY, GHOST] });
  if (!out.html.includes('未归属') || !out.html.includes('locatorError')) throw new Error('未归属行被静默丢弃');
});

check('U5', () => {
  const out = renderReport(mkModel());
  if (!out.html.includes('pre class="reply"') || !out.html.includes('建议多休息')) throw new Error('HTML 缺 replyText');
  if (!out.markdown.includes('LLM 回复：建议多休息')) throw new Error('MD 缺 replyText');
});

const MODEL_FILE = join(tmp, 'model.json');
const HISTORY_FILE = join(tmp, 'run-history.jsonl');
const METRICS_FILE = join(tmp, 'run-metrics.json');
writeFileSync(MODEL_FILE, JSON.stringify(mkModel()));
writeFileSync(HISTORY_FILE, [...HISTORY, GHOST].map((line) => JSON.stringify(line)).join('\n') + '\n');
writeFileSync(METRICS_FILE, JSON.stringify(METRICS));

check('W1a', () => {
  const outDir = join(tmp, 'w1a');
  const result = run([REPORT, '--model', MODEL_FILE, '--out', outDir, '--run-history', HISTORY_FILE, '--run-metrics', METRICS_FILE]);
  if (result.status !== 0) throw new Error(`report exit=${result.status}`);
  const html = readFileSync(join(outDir, 'tc_diag_unit.report.html'), 'utf8');
  if (!html.includes('回放诊断') || !html.includes('run_golden_diag_1')) throw new Error('落盘 HTML 缺诊断栏目或 runId');
});

check('W1b', () => {
  const badMetrics = join(tmp, 'bad-metrics.json');
  const outDir = join(tmp, 'w1b');
  writeFileSync(badMetrics, '{bad json');
  const result = run([REPORT, '--model', MODEL_FILE, '--out', outDir, '--run-history', HISTORY_FILE, '--run-metrics', badMetrics]);
  if (result.status === 0) throw new Error('坏 metrics 应非零退出');
  if (existsSync(join(outDir, 'tc_diag_unit.report.html'))) throw new Error('坏 metrics 不应落盘报告');
});

check('W1c', () => {
  const outDir = join(tmp, 'w1c');
  const result = run([REPORT, '--model', MODEL_FILE, '--out', outDir]);
  if (result.status !== 0) throw new Error(`report exit=${result.status}`);
  const html = readFileSync(join(outDir, 'tc_diag_unit.report.html'), 'utf8');
  if (html.includes('回放诊断')) throw new Error('不带旁件旗标不应出现诊断栏目');
});

check('W1d', () => {
  for (const [tag, line] of [['null-line', 'null'], ['num-line', '123'], ['no-ids', '{"intentId":"intent_1"}']]) {
    const badHistory = join(tmp, `bad-history-${tag}.jsonl`);
    const outDir = join(tmp, `w1d-${tag}`);
    writeFileSync(badHistory, line + '\n');
    const result = run([REPORT, '--model', MODEL_FILE, '--out', outDir, '--run-history', badHistory]);
    if (result.status === 0) throw new Error(`坏 history ${tag} 应非零退出`);
    if (existsSync(join(outDir, 'tc_diag_unit.report.html'))) throw new Error(`坏 history ${tag} 不应落盘`);
  }
});

check('W1e', () => {
  for (const [tag, body] of [['null-m', 'null'], ['num-m', '123'], ['arr-m', '[]']]) {
    const badMetrics = join(tmp, `bad-metrics-${tag}.json`);
    const outDir = join(tmp, `w1e-${tag}`);
    writeFileSync(badMetrics, body + '\n');
    const result = run([REPORT, '--model', MODEL_FILE, '--out', outDir, '--run-metrics', badMetrics]);
    if (result.status === 0) throw new Error(`坏 metrics ${tag} 应非零退出`);
    if (existsSync(join(outDir, 'tc_diag_unit.report.html'))) throw new Error(`坏 metrics ${tag} 不应落盘`);
  }
});

if (fails.length > 0) {
  for (const failure of fails) console.error(`FAIL ${failure}`);
  console.error(`report-diagnostics unit: ${pass} 过 / ${fails.length} 败`);
  process.exit(1);
}
console.log(`report-diagnostics unit: ${pass}/${pass} passed`);
