#!/usr/bin/env node
// 冻结黄金标准（P7 报告渲染器）：喂已冻 report-model fixture → 调 lib/report.mjs 纯函数 → 校关键结构不变量。
// report-model.json 是唯一 golden 对象；HTML/录屏/时间戳不做字节比对，HTML 只校结构不变量。
// 契约钉死 lib/report.mjs 的纯函数 API：renderReport(model) -> { html, markdown, json }
//   - html: 自包含主页字符串（只内联 CSS、无外链）
//   - markdown: 文本旁车（非空）
//   - json: 机读旁车（非空、可 JSON.parse）
// 不变量：每步多态裁定徽章正确 / 缺陷单仅 SUT_DEFECT / 期望对实际字面量可见 / soft 黄标置顶 / MD+json 旁车非空 / HTML 自包含无外链。
// 实现前必须红（lib/report.mjs 不存在 → 本测试退非 0）。改本文件 = Test Ratchet 判红。
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const FIX = join(HERE, 'fixtures', 'seams', 'report-model.fixture.json');
const LIB = join(ROOT, 'lib', 'report.mjs');

const fail = (msg) => { console.error(`RED  p7-report: ${msg}`); process.exit(1); };

// 裁定四态中文态名（与 CONTEXT.md 多态裁定一致）——golden 独立持有，防渲染器悄改文案。
const VERDICT_ZH = { PASS: '通过', SUT_DEFECT: '被测缺陷', HARNESS_ERROR: '过程错误', NEEDS_HUMAN: '待人裁决' };

const model = JSON.parse(readFileSync(FIX, 'utf8'));

let renderReport;
try {
  ({ renderReport } = await import(`file://${LIB.replace(/\\/g, '/')}`));
} catch (e) {
  fail(`无法 import lib/report.mjs（实现前预期红）：${String(e && e.message).slice(-200)}`);
}
if (typeof renderReport !== 'function') fail('lib/report.mjs 未导出 renderReport 纯函数');

let out;
try { out = renderReport(model); } catch (e) { fail(`renderReport 抛错：${String(e && e.message).slice(-200)}`); }
if (!out || typeof out !== 'object') fail('renderReport 须返回 { html, markdown, json } 对象');
const { html, markdown, json } = out;

let checks = 0;
const ok = () => { checks++; };

// --- 旁车非空 + json 可解析 ---
if (typeof html !== 'string' || html.trim().length === 0) fail('html 须为非空字符串');
if (typeof markdown !== 'string' || markdown.trim().length === 0) fail('markdown 旁车须为非空字符串');
if (typeof json !== 'string' || json.trim().length === 0) fail('json 旁车须为非空字符串');
let jobj;
try { jobj = JSON.parse(json); } catch { fail('json 旁车不可被 JSON.parse 解析'); }
if (!jobj || jobj.caseId !== model.caseId) fail('json 旁车须含与 model 同源的 caseId');
ok();

// --- HTML 自包含、无外链（不做字节比对，只校不变量）---
if (/https?:\/\//i.test(html)) fail('HTML 含外部 URL（http/https）——破坏自包含');
if (/<script[^>]*\ssrc\s*=/i.test(html)) fail('HTML 含外部 <script src=>——破坏自包含');
if (/<link[^>]*\shref\s*=/i.test(html)) fail('HTML 含外部 <link href=>（须只内联 CSS）');
if (!/<style[\s>]/i.test(html)) fail('HTML 须内联 <style>（自包含 CSS）');
ok();

// --- 头部：caseId 可见 ---
if (!html.includes(model.caseId)) fail('HTML 头部缺 caseId');
ok();

// 取某步在 HTML 中的片段：约定渲染器给每步包一层 data-step-id="<stepId>" 的容器。
function stepSection(src, stepId) {
  const marker = `data-step-id="${stepId}"`;
  const i = src.indexOf(marker);
  if (i < 0) return null;
  // 到下一步 marker 或结尾为止
  const rest = src.slice(i + marker.length);
  const next = rest.indexOf('data-step-id="');
  return next < 0 ? rest : rest.slice(0, next);
}

// --- 逐步：多态裁定徽章正确 + 缺陷单仅 SUT_DEFECT + 期望对实际字面量 + soft 置顶 ---
let defectSectionCount = 0;
for (const step of model.steps) {
  const sec = stepSection(html, step.stepId);
  if (!sec) fail(`HTML 缺步 ${step.stepId} 的 data-step-id 容器`);

  // 1) 多态裁定徽章：该步态名必须在其片段内出现
  const zh = VERDICT_ZH[step.verdict];
  if (!sec.includes(zh)) fail(`步 ${step.stepId}: 缺裁定徽章文案「${zh}」（${step.verdict}）`);
  if (step.verdict === 'NEEDS_HUMAN' && step.reason && !sec.includes(step.reason)) {
    fail(`步 ${step.stepId}: NEEDS_HUMAN 缺 reason 子类「${step.reason}」`);
  }

  // 2) 缺陷单仅 SUT_DEFECT：约定缺陷单容器带 data-defect-ticket="<stepId>"
  const hasDefectMarker = sec.includes(`data-defect-ticket="${step.stepId}"`);
  if (step.defectTicket != null) {
    if (step.verdict !== 'SUT_DEFECT') fail(`fixture 异常：步 ${step.stepId} 非 SUT_DEFECT 却带 defectTicket`);
    if (!hasDefectMarker) fail(`步 ${step.stepId}（SUT_DEFECT）: 缺缺陷单区块 data-defect-ticket`);
    defectSectionCount++;
    // 缺陷单须含背书取证 url/status 字面量
    for (const bf of step.defectTicket.backingForensics) {
      if (!sec.includes(bf.url)) fail(`步 ${step.stepId} 缺陷单: 缺背书取证 url「${bf.url}」`);
      if (bf.status != null && !sec.includes(String(bf.status))) fail(`步 ${step.stepId} 缺陷单: 缺背书 status「${bf.status}」`);
    }
  } else if (hasDefectMarker) {
    fail(`步 ${step.stepId}（${step.verdict}）: 非 SUT_DEFECT 却渲染了缺陷单（护栏：缺陷单仅 SUT_DEFECT）`);
  }

  // 3) 期望对实际字面量可见
  for (const a of step.postAssertions || []) {
    if (a.value != null && !sec.includes(String(a.value))) fail(`步 ${step.stepId}: 期望 value「${a.value}」(${a.kind}) 不可见`);
    if (a.actual != null && !sec.includes(String(a.actual))) fail(`步 ${step.stepId}: 实际 actual「${a.actual}」(${a.kind}) 不可见`);
    if (!sec.includes(a.kind)) fail(`步 ${step.stepId}: 断言 kind「${a.kind}」不可见`);
  }

  // 4) soft 黄标置顶：若该步同时有 soft 与 hard，soft 标记须排在 hard 之前
  const softs = (step.postAssertions || []).filter((a) => a.soft === true);
  const hards = (step.postAssertions || []).filter((a) => a.soft !== true);
  if (softs.length) {
    if (!/不进裁定树/.test(sec)) fail(`步 ${step.stepId}: soft 断言须标注「不进裁定树」黄标`);
    if (hards.length) {
      const iSoft = sec.indexOf('assert-soft');
      const iHard = sec.indexOf('assert-hard');
      if (iSoft < 0 || iHard < 0) fail(`步 ${step.stepId}: soft/hard 断言须带 assert-soft / assert-hard 标识以校置顶`);
      if (iSoft > iHard) fail(`步 ${step.stepId}: soft 断言未置顶（assert-soft 应排在 assert-hard 之前）`);
    }
  }
}
ok();

// 缺陷单总数 = fixture 里 defectTicket 非 null 的步数
const expectDefects = model.steps.filter((s) => s.defectTicket != null).length;
if (defectSectionCount !== expectDefects) fail(`缺陷单区块数 ${defectSectionCount} != 期望 ${expectDefects}（仅 SUT_DEFECT 步）`);
ok();

// --- 裁定概览四态计数可见（直读 model.verdictSummary，不二次推断）---
for (const [k, v] of Object.entries(model.verdictSummary)) {
  if (!html.includes(String(v))) fail(`HTML 裁定概览缺 ${VERDICT_ZH[k]} 计数 ${v}`);
}
ok();

// --- 置顶横幅：有 SUT_DEFECT/NEEDS_HUMAN 步则须有置顶横幅 ---
const needsBanner = model.steps.some((s) => s.verdict === 'SUT_DEFECT' || s.verdict === 'NEEDS_HUMAN');
if (needsBanner && !/banner/i.test(html)) fail('有被测缺陷/待人裁决步，HTML 须有置顶横幅（class 含 banner）');
ok();

// --- Markdown 旁车：含 caseId + 每步态名 + 期望对实际字面量 ---
if (!markdown.includes(model.caseId)) fail('Markdown 缺 caseId');
for (const step of model.steps) {
  if (!markdown.includes(VERDICT_ZH[step.verdict])) fail(`Markdown 缺步 ${step.stepId} 态名「${VERDICT_ZH[step.verdict]}」`);
  for (const a of step.postAssertions || []) {
    if (a.actual != null && !markdown.includes(String(a.actual))) fail(`Markdown 缺步 ${step.stepId} 实际值「${a.actual}」`);
  }
}
ok();

console.log(`ok   p7-report: ${checks} 组报告结构不变量全过（${model.steps.length} 步、${expectDefects} 缺陷单）`);
process.exit(0);
