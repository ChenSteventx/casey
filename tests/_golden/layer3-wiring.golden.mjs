#!/usr/bin/env node
// 冻结黄金标准（第 3 层集成 wiring 骨架 · hermetic）：假 SUT（被测系统）→ casey run 编排
// 相3回放 → 相4裁定 → 报表模型装配 → 相6报告，端到端对合成 fixture 跑通、零外部依赖（除真 chromium）。
// 断言：编排绿(退出码归一 0)、verdict 四态、report-model 过契约、defectTicket 仅 SUT_DEFECT(正反两向)、report 三文件产出、凭据红线。
// 实现前必须红：lib/report-model.mjs / casey run 编排未建 → casey run 桩 exit 3 → 本测试退非 0。改本文件 = Test Ratchet 判红。
import { readFileSync, writeFileSync, existsSync, mkdtempSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { startFakeSut, FAKE_SITE_DENYLIST } from '../fixtures/fake-sut/server.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CASEY = join(ROOT, 'bin', 'casey.mjs');
const EVENTS_REF = join(ROOT, 'tests', '_golden', 'fixtures', 'seams', 'events.fixture.json');
const CASE_ID = 'tc_workflow_create_smoke';
const GEN_AT = '2026-07-01T00:00:00.000Z';
const tmp = mkdtempSync(join(tmpdir(), 'casey-l3wiring-'));

const FORBIDDEN = ['body', 'headers', 'header', 'cookie', 'cookies', 'setcookie', 'set-cookie', 'token', 'authorization', 'password', 'secret', 'credential', 'apikey'];
function findForbiddenKey(node, path = '') {
  if (Array.isArray(node)) { for (let i = 0; i < node.length; i++) { const r = findForbiddenKey(node[i], `${path}[${i}]`); if (r) return r; } return null; }
  if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) {
      const norm = k.toLowerCase().replace(/[_-]/g, '');
      if (FORBIDDEN.includes(norm)) return `${path}.${k}`;
      const r = findForbiddenKey(node[k], `${path}.${k}`); if (r) return r;
    }
  }
  return null;
}

// expected（期望断言）→ expected-frozen 形态：按 intentId 聚合（同 p5 golden）。
function toExpectedContract(c) {
  const byIntent = new Map();
  for (const a of c.expected || []) { const { intentId, ...assertion } = a; if (!byIntent.has(intentId)) byIntent.set(intentId, []); byIntent.get(intentId).push(assertion); }
  return { caseId: CASE_ID, channel: 'web', intents: [...byIntent.entries()].map(([intentId, expected]) => ({ intentId, expected })), globalAssertions: c.globalAssertions || [] };
}

const CASES = [
  {
    name: 'happy', scenario: 'happy', anchor: { intentId: 'intent_2', wantVerdict: 'PASS' },
    expected: [{ intentId: 'intent_2', kind: 'noErrorEnvelope', op: 'envelopeOk', value: 'status==200', soft: false }],
    globalAssertions: [{ kind: 'noPageError', op: 'absent', soft: false }],
  },
  {
    name: 'inject500', scenario: 'inject500', anchor: { intentId: 'intent_2', wantVerdict: 'SUT_DEFECT' },
    expected: [{ intentId: 'intent_2', kind: 'noErrorEnvelope', op: 'envelopeOk', value: 'status==200', soft: false }],
    globalAssertions: [{ kind: 'noPageError', op: 'absent', soft: false }],
  },
];

const TERMINAL = new Set(['PASS', 'SUT_DEFECT', 'HARNESS_ERROR']);
const VERDICTS = new Set(['PASS', 'SUT_DEFECT', 'HARNESS_ERROR', 'NEEDS_HUMAN']);
const NH_REASONS = new Set(['SUT_DEFECT_OR_STALE', 'CASE_DEFECT', 'AMBIGUOUS_ACTION', 'AFFORDANCE_ABSENT', 'INDETERMINATE']);

// report-model 结构不变量（手工校验，无 ajv，与项目 hermetic 习惯一致）。
function assertModelConforms(m, name) {
  for (const k of ['schemaVersion', 'caseId', 'channel', 'generatedAt', 'verdictSummary', 'steps']) if (!(k in m)) throw new Error(`report-model 缺必填 ${k}`);
  if (m.schemaVersion !== 1) throw new Error('report-model schemaVersion 须 1');
  const s = m.verdictSummary;
  for (const k of ['PASS', 'SUT_DEFECT', 'HARNESS_ERROR', 'NEEDS_HUMAN']) if (typeof s[k] !== 'number') throw new Error(`verdictSummary 缺 ${k}`);
  if (!Array.isArray(m.steps) || m.steps.length === 0) throw new Error('report-model steps 须非空');
  const sum = s.PASS + s.SUT_DEFECT + s.HARNESS_ERROR + s.NEEDS_HUMAN;
  if (sum !== m.steps.length) throw new Error(`verdictSummary 计数(${sum}) ≠ steps 数(${m.steps.length})`);
  for (const st of m.steps) {
    for (const k of ['stepId', 'intentId', 'atom', 'verdict', 'reason', 'postAssertions']) if (!(k in st)) throw new Error(`step 缺必填 ${k}`);
    if (!VERDICTS.has(st.verdict)) throw new Error(`未知 verdict ${st.verdict}`);
    if (TERMINAL.has(st.verdict) && st.reason != null) throw new Error(`终判 ${st.verdict} 的 reason 须 null`);
    if (st.verdict === 'NEEDS_HUMAN' && !NH_REASONS.has(st.reason)) throw new Error('NEEDS_HUMAN 须带 reason 子类');
    // defectTicket 仅 SUT_DEFECT（正反两向）
    if (st.verdict === 'SUT_DEFECT') {
      if (st.defectTicket == null) throw new Error(`SUT_DEFECT 步 ${st.stepId} 缺 defectTicket`);
      if (!(st.defectTicket.failedAssertions || []).length) throw new Error('defectTicket.failedAssertions 须 ≥1');
      if (!(st.defectTicket.backingForensics || []).length) throw new Error('defectTicket.backingForensics 须 ≥1（SUT_DEFECT 须取证背书）');
    } else if (st.defectTicket != null) {
      throw new Error(`非 SUT_DEFECT 步 ${st.stepId}(${st.verdict}) 不应有 defectTicket`);
    }
  }
}

const fails = [];
let pass = 0;

for (const c of CASES) {
  let sut;
  try {
    sut = await startFakeSut({ scenario: c.scenario });
    const evFile = join(tmp, `${c.name}.events.json`);
    const expFile = join(tmp, `${c.name}.expected.json`);
    const profFile = join(tmp, `${c.name}.profile.json`);
    const runDir = join(tmp, `${c.name}.run`);
    mkdirSync(runDir, { recursive: true });
    writeFileSync(evFile, readFileSync(EVENTS_REF, 'utf8'));
    writeFileSync(expFile, JSON.stringify(toExpectedContract(c)));
    writeFileSync(profFile, JSON.stringify({ background: FAKE_SITE_DENYLIST, successField: 'status', successValue: 200 }));

    // 端到端编排（实现前 casey run 桩 exit 3 → execFileSync 抛 → 红）
    execFileSync(process.execPath, [CASEY, 'run', CASE_ID,
      '--sut', sut.url, '--events', evFile, '--expected', expFile, '--profile', profFile,
      '--run-dir', runDir, '--generated-at', GEN_AT], { stdio: 'pipe' });

    // verdict 四态：锚点
    const verdict = JSON.parse(readFileSync(join(runDir, 'verdict.json'), 'utf8'));
    const anchorV = (verdict.steps || []).find((s) => s.intentId === c.anchor.intentId);
    if (!anchorV) throw new Error(`verdict 缺锚点 intent=${c.anchor.intentId}`);
    if (anchorV.verdict !== c.anchor.wantVerdict) throw new Error(`锚点期望 verdict=${c.anchor.wantVerdict}，实际 ${anchorV.verdict}`);

    // report-model 过契约
    const model = JSON.parse(readFileSync(join(runDir, 'report-model.json'), 'utf8'));
    assertModelConforms(model, c.name);
    if (model.verdictSummary[c.anchor.wantVerdict] < 1) throw new Error(`verdictSummary.${c.anchor.wantVerdict} 应 ≥1`);
    const anchorStep = model.steps.find((s) => s.intentId === c.anchor.intentId);
    if (!anchorStep || anchorStep.verdict !== c.anchor.wantVerdict) throw new Error('report-model 锚点步 verdict 与 verdict.json 不一致');

    if (c.name === 'happy') {
      if (model.verdictSummary.SUT_DEFECT !== 0) throw new Error('happy 不应有 SUT_DEFECT');
      if (model.steps.some((s) => s.defectTicket != null)) throw new Error('happy 全绿不应有任何 defectTicket');
    }
    if (c.name === 'inject500') {
      const dt = anchorStep.defectTicket;
      if (!dt) throw new Error('inject500 锚点步应带 defectTicket');
      const has500 = (dt.backingForensics || []).some((f) => f.status === 500 && f.attributedStepId === anchorStep.stepId);
      if (!has500) throw new Error('inject500 defectTicket.backingForensics 应含归因本步的 500');
    }

    // report 三文件产出
    for (const ext of ['html', 'md', 'json']) {
      const f = join(runDir, `${CASE_ID}.report.${ext}`);
      if (!existsSync(f)) throw new Error(`report 缺文件 ${CASE_ID}.report.${ext}`);
    }

    // 凭据红线：report-model + report.json 深扫无禁字段
    const fk1 = findForbiddenKey(model);
    if (fk1) throw new Error(`report-model 命中凭据禁字段 ${fk1}（护栏 #7）`);
    const rj = JSON.parse(readFileSync(join(runDir, `${CASE_ID}.report.json`), 'utf8'));
    const fk2 = findForbiddenKey(rj);
    if (fk2) throw new Error(`report.json 命中凭据禁字段 ${fk2}（护栏 #7）`);

    pass++;
  } catch (e) {
    fails.push(`case「${c.name}」: ${String(e.stderr || e.message).slice(-400)}`);
  } finally {
    if (sut) await sut.close();
  }
}

if (fails.length) {
  for (const f of fails) console.error(`RED  layer3-wiring: ${f}`);
  process.exit(1);
}
console.log(`ok   layer3-wiring: ${pass}/${CASES.length} 端到端场景全过（replay→verdict→装配→report 编排绿 + report-model 过契约 + defectTicket 仅 SUT_DEFECT）`);
process.exit(0);
