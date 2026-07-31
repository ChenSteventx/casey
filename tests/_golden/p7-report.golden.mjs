#!/usr/bin/env node
// 冻结黄金标准（P7 报告渲染器）：喂已冻 report-model fixture → 调 lib/report.mjs 纯函数 → 校关键结构不变量。
// report-model.json 是唯一 golden 对象；HTML/录屏/时间戳不做字节比对，HTML 只校结构不变量。
// 契约钉死 lib/report.mjs 的纯函数 API：renderReport(model) -> { html, markdown, json }
//   - html: 自包含主页字符串（只内联 CSS、无外链）
//   - markdown: 文本旁车（非空）
//   - json: 机读旁车（非空、可 JSON.parse）
// 不变量：每步多态裁定徽章正确（态名 + 徽章 CSS 类 + 色值三者按态钉死、四态互不串位）/ 缺陷单仅 SUT_DEFECT /
//         期望对实际字面量可见 / soft 黄标置顶 / MD+json 旁车非空 / HTML 自包含无外链。
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
// 裁定四态徽章 CSS 类（颜色语义的载体）——同样 golden 独立持有。
// 只钉态名不钉类，渲染器把 VERDICT_CLS.NEEDS_HUMAN 从 human 改成 pass（「待人裁决」涂成通过绿）门禁照样全绿；
// 颜色是给人看的第一信号，这条判别力必须在。
const VERDICT_CLS = { PASS: 'pass', SUT_DEFECT: 'defect', HARNESS_ERROR: 'harness', NEEDS_HUMAN: 'human' };
// 四态徽章的色值字面量（背景/前景）——挡「类没串位、但色值抄成别态的」（.badge.human 涂成通过绿那种）。
const VERDICT_COLOR = {
  PASS: { background: '#d4edda', color: '#155724' },
  SUT_DEFECT: { background: '#f8d7da', color: '#721c24' },
  HARNESS_ERROR: { background: '#e2e3ff', color: '#2f2b8c' },
  NEEDS_HUMAN: { background: '#fff3cd', color: '#856404' },
};
// 四个态类字面量的集合：用来做「交集恰为该态」判定——不禁止无关的附加类（compact 之类），只禁止串位。
const VERDICT_CLS_SET = new Set(Object.values(VERDICT_CLS));

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

// 徽章判别力专用的【收紧】作用域：从 data-step-id 标记切到本步自己的 </section>。
// 为什么不复用 stepSection：它切到「下一个 data-step-id」，最后一步会一路吃到文档尾，
// 「本步徽章恰有一个」在那种松边界上判不准（会把尾部内容算进来）。步区块内不套 section，这个界是准的。
function stepScope(src, stepId) {
  const marker = `data-step-id="${stepId}"`;
  const i = src.indexOf(marker);
  if (i < 0) return null;
  const rest = src.slice(i + marker.length);
  const end = rest.indexOf('</section>');
  return end < 0 ? rest : rest.slice(0, end);
}

// 取作用域内所有「类列表含 badge」的元素：标签名无关，逐个开标签扫（不整块跳过，避免漏掉嵌在带类容器里的徽章）。
// 返回 { tokens: 完整类符号数组, text: 元素内文本 }，好把「态名」和「颜色类」钉在【同一个元素】上。
function badgeElements(scope) {
  const out = [];
  const re = /<([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g;
  let m;
  while ((m = re.exec(scope)) !== null) {
    const cm = /\bclass="([^"]*)"/.exec(m[2]);
    if (!cm) continue;
    const tokens = cm[1].trim().split(/\s+/).filter(Boolean);
    if (!tokens.includes('badge')) continue;
    const after = scope.slice(re.lastIndex);
    const close = after.indexOf(`</${m[1]}>`);
    out.push({ tokens, text: (close < 0 ? after : after.slice(0, close)).trim() });
  }
  return out;
}

// 内联 CSS 里 .badge.<cls> 这条规则的 background / color（忽略声明顺序、空白与无关声明；同名后写覆盖先写）。
function badgeColorOf(cssRules, cls) {
  const hit = cssRules.filter((r) => r.sel.split(',').some((s) => s.trim() === `.badge.${cls}`));
  if (!hit.length) return null;
  const pick = (prop) => {
    let val = null;
    for (const d of hit.map((r) => r.decl).join(';').split(';')) {
      const i = d.indexOf(':');
      if (i > 0 && d.slice(0, i).trim() === prop) val = d.slice(i + 1).trim();
    }
    return val;
  };
  return { background: pick('background'), color: pick('color') };
}

// --- 逐步：多态裁定徽章正确 + 缺陷单仅 SUT_DEFECT + 期望对实际字面量 + soft 置顶 ---
let defectSectionCount = 0;
const observedCls = new Map(); // verdict -> 观测到的徽章态类，用来校四态两两不串位
for (const step of model.steps) {
  const sec = stepSection(html, step.stepId);
  if (!sec) fail(`HTML 缺步 ${step.stepId} 的 data-step-id 容器`);

  // 1) 多态裁定徽章：该步态名必须在其片段内出现
  const zh = VERDICT_ZH[step.verdict];
  if (!sec.includes(zh)) fail(`步 ${step.stepId}: 缺裁定徽章文案「${zh}」（${step.verdict}）`);
  if (step.verdict === 'NEEDS_HUMAN' && step.reason && !sec.includes(step.reason)) {
    fail(`步 ${step.stepId}: NEEDS_HUMAN 缺 reason 子类「${step.reason}」`);
  }

  // 1b) 徽章颜色语义：该步徽章元素的类【恰是】该态那个，且不得是别态的。
  //     只断言「badge 在场」是假钉——class="badge pass" 里也含 badge。
  const scope = stepScope(html, step.stepId);
  if (!scope) fail(`HTML 缺步 ${step.stepId} 的 data-step-id 容器（收紧作用域）`);
  const badges = badgeElements(scope);
  if (badges.length !== 1) {
    fail(`步 ${step.stepId}: 本步区块内裁定徽章元素应恰有 1 个，实得 ${badges.length}（多个/零个都判不出该步是哪一态）`);
  }
  const bTokens = badges[0].tokens;
  const wantCls = VERDICT_CLS[step.verdict];
  const hitCls = bTokens.filter((t) => VERDICT_CLS_SET.has(t));
  if (hitCls.length !== 1 || hitCls[0] !== wantCls) {
    fail(`步 ${step.stepId}（${step.verdict}）: 徽章类「${bTokens.join(' ')}」的裁定态类应恰是「${wantCls}」`
      + `，实得「${hitCls.join(' ') || '（无）'}」——四态徽章串位/缺位，颜色语义不可信`);
  }
  // 态名与颜色类须挂在【同一个元素】上：否则「态名在别处对、徽章涂成别态色」两条断言会各自过关。
  if (!badges[0].text.includes(zh)) {
    fail(`步 ${step.stepId}（${step.verdict}）: 徽章元素（类「${bTokens.join(' ')}」）内文本「${badges[0].text}」`
      + `不含态名「${zh}」——态名与颜色类未绑在同一元素`);
  }
  observedCls.set(step.verdict, hitCls[0]); // 记实测值，循环后校四态覆盖 + 两两不串位

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

// --- 四态徽章颜色语义：覆盖齐 + 两两不串位 + 色值按态钉死 ---
// 光有「每步类对」还不够：夹具要是退化成只剩两态，上面那圈判别力就被悄悄抽空了（本契约的前身就栽在这）。
const ALL_VERDICTS = Object.keys(VERDICT_CLS);
for (const v of ALL_VERDICTS) {
  if (!observedCls.has(v)) fail(`夹具未覆盖裁定态 ${v}（${VERDICT_ZH[v]}）——四态徽章判别力被抽空，本金牌名不副实`);
}
// 四态类两两不同：任意两态共用一个类 = 两态在报告上同色，人分不出。
const clsSeen = new Map();
for (const v of ALL_VERDICTS) {
  const c = observedCls.get(v);
  if (clsSeen.has(c)) fail(`裁定态 ${v} 与 ${clsSeen.get(c)} 共用徽章类「${c}」——两态同色、人分不出`);
  clsSeen.set(c, v);
}
ok();

// 色值：类没串位，色值仍可能抄成别态的（.badge.human 涂成通过绿）。内联 CSS 是自包含报告里唯一的样式源。
const styleM = /<style[^>]*>([\s\S]*?)<\/style>/i.exec(html);
if (!styleM) fail('HTML 缺内联 <style>，取不到徽章色值');
const cssRules = [...styleM[1].matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((r) => ({ sel: r[1], decl: r[2] }));
const colorSeen = new Map();
for (const v of ALL_VERDICTS) {
  const cls = observedCls.get(v);
  const got = badgeColorOf(cssRules, cls);
  if (!got) fail(`内联 CSS 缺 .badge.${cls} 规则（${v}/${VERDICT_ZH[v]} 徽章无颜色语义）`);
  const want = VERDICT_COLOR[v];
  if (got.background !== want.background || got.color !== want.color) {
    fail(`.badge.${cls}（${v}/${VERDICT_ZH[v]}）色值 background:${got.background} color:${got.color}`
      + ` != 已冻 background:${want.background} color:${want.color}——徽章颜色语义被改，须走换签`);
  }
  const key = `${got.background}|${got.color}`;
  if (colorSeen.has(key)) fail(`裁定态 ${v} 与 ${colorSeen.get(key)} 徽章配色相同（${key}）——两态同色、人分不出`);
  colorSeen.set(key, v);
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

console.log(`ok   p7-report: ${checks} 组报告结构不变量全过（${model.steps.length} 步、${expectDefects} 缺陷单、`
  + `${observedCls.size} 态徽章 ${[...observedCls.values()].join('/')} 色值按态钉死）`);
process.exit(0);
