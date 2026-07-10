// lib/promptset.mjs —— 数据驱动被测参数 overlay（regress scope A，零 LLM 纯函数、零 I/O 于核心）。
// 把一条冻结 chat flow 复用成 N 条独立用例：每行喂 chat.sendAndWait 的 prompt 槽一段不同的被测参数，
// 聚合成一份报告。术语见 CONTEXT.md（promptset/被测参数/注入向量库/软期望/被测参数 overlay），
// 设计见 docs/design/txt2testreport-design.md §13。忠实对标 regress _promptset.ts，两处按本仓 scope 取值：
// 字段名 text（regress 用 prompt）、source 枚举 user|builtin（regress 用 user|llm——本轮不做 LLM 合成）。
//
// 内核硬约束（一字不让）：
// - 软期望（expect）只合成 soft:true 断言，绝不进多态裁定（护栏 #17：verdict 只 AND 硬断言、忽略 soft）；
// - overlay 定位唯一 {{promptText}} 槽、绝不改冻结 flow（跨行只变 ctx.promptText，spec 不漂移）；
// - 全链 fail-closed：任一不合抛，宁在收集期早失败也不产半成品报告（fail-safe 不 fail-open）；
// - overlay 是新纯函数，不照搬 regress overlayRow（其拒 authored 场景，Casey 编译产物形同 authored）。
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ID_RE = /^[a-z0-9_]+$/;
export const CATEGORIES = ['normal', 'boundary', 'security'];
const SOURCES = ['user', 'builtin'];
export const PROMPT_SLOT_TOKEN = '{{promptText}}';

// 随发注入向量库文件名 → 强制 category + 强制 id 前缀（防撞：与用户 promptset id 及跨库相撞）。
const BUILTIN_LIBS = [
  { file: 'boundary.json', category: 'boundary', prefix: 'bnd_' },
  { file: 'security.json', category: 'security', prefix: 'sec_' },
];

function bad(msg) { throw new Error(`promptset: ${msg}`); }

// 校验并规范化单条 case。forced* 给定（随发库）时忽略条目自带值、由文件名强制；prefix 给定时强制 id 前缀。
function normalizeCase(raw, label, { forcedCategory, forcedSource, requirePrefix } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) bad(`${label} 不是对象`);
  if (typeof raw.id !== 'string' || !ID_RE.test(raw.id)) bad(`${label} id 非法（需匹配 ^[a-z0-9_]+$）：${JSON.stringify(raw.id)}`);
  if (requirePrefix && !raw.id.startsWith(requirePrefix)) bad(`${label} id 须以 ${requirePrefix} 前缀（随发库防撞）：${raw.id}`);
  if (typeof raw.text !== 'string' || raw.text.trim() === '') bad(`${label}（id=${raw.id}）text 须为非空字符串（被测参数）`);

  let source;
  if (forcedSource) source = forcedSource;
  else if (raw.source == null) source = 'user';
  else if (SOURCES.includes(raw.source)) source = raw.source;
  else bad(`${label}（id=${raw.id}）source 非法：${JSON.stringify(raw.source)}（只能 "user" 或 "builtin"）`);

  let category;
  if (forcedCategory) category = forcedCategory;
  else if (raw.category == null) category = 'normal';
  else if (CATEGORIES.includes(raw.category)) category = raw.category;
  else bad(`${label}（id=${raw.id}）category 非法：${JSON.stringify(raw.category)}（只能 normal/boundary/security）`);

  let expect;
  if (raw.expect != null) {
    if (typeof raw.expect !== 'object' || Array.isArray(raw.expect)) bad(`${label}（id=${raw.id}）expect 须是对象`);
    const e = raw.expect;
    for (const k of ['mustInclude', 'mustNotInclude']) {
      if (e[k] !== undefined && (!Array.isArray(e[k]) || e[k].some((x) => typeof x !== 'string'))) bad(`${label}（id=${raw.id}）expect.${k} 须是字符串数组`);
    }
    if (e.note !== undefined && typeof e.note !== 'string') bad(`${label}（id=${raw.id}）expect.note 须是字符串`);
    expect = {};
    if (Array.isArray(e.mustInclude)) expect.mustInclude = [...e.mustInclude];
    if (Array.isArray(e.mustNotInclude)) expect.mustNotInclude = [...e.mustNotInclude];
    if (typeof e.note === 'string') expect.note = e.note;
  }
  return { id: raw.id, text: raw.text, source, category, ...(expect ? { expect } : {}) };
}

// 解析用户 promptset（非空数组，条目自标 source/category，缺省 user/normal）。文件内 id 唯一。
export function parsePromptset(input) {
  if (!Array.isArray(input)) bad('promptset 须是数组');
  if (input.length === 0) bad('promptset 须是非空数组（至少一行被测参数）');
  const seen = new Set();
  return input.map((raw, i) => {
    const c = normalizeCase(raw, `第 ${i} 条`, {});
    if (seen.has(c.id)) bad(`id 重复：${c.id}（id 同时作 caseId slug 与 trace 名，须唯一）`);
    seen.add(c.id);
    return c;
  });
}

// 解析单个随发库文件（允许空——一个 0 条目的库是合法的，regress required:false 语义）。
// category 由文件名强制、source 强制 builtin、id 强制前缀；文件内 id 唯一。
function parseLibArray(arr, file, category, prefix) {
  if (!Array.isArray(arr)) bad(`${file} 须是数组`);
  const seen = new Set();
  return arr.map((raw, i) => {
    const c = normalizeCase(raw, `${file} 第 ${i} 条`, { forcedCategory: category, forcedSource: 'builtin', requirePrefix: prefix });
    if (seen.has(c.id)) bad(`${file} id 重复：${c.id}`);
    seen.add(c.id);
    return c;
  });
}

// 加载随发注入向量库（prompts/_lib/boundary.json + security.json）。缺文件按空处理（required:false）；
// 跨库 id 唯一。任一坏 JSON / 坏形状 / 缺前缀 fail-closed 抛。
export function loadBuiltinLibs(libDir) {
  const out = [];
  const seen = new Set();
  for (const { file, category, prefix } of BUILTIN_LIBS) {
    const p = join(libDir, file);
    if (!existsSync(p)) continue;
    let arr;
    try { arr = JSON.parse(readFileSync(p, 'utf8')); } catch (e) { bad(`${file} 不是合法 JSON：${e.message}`); }
    for (const c of parseLibArray(arr, file, category, prefix)) {
      if (seen.has(c.id)) bad(`随发库跨文件 id 重复：${c.id}`);
      seen.add(c.id);
      out.push(c);
    }
  }
  return out;
}

// 合并用户集 + 随发库（库在后），跨集合 id 全局唯一硬拒（给库条目 bnd_/sec_ 前缀即避与用户 p0x 相撞）。
export function mergeCases(userCases, builtinCases) {
  const merged = [...(userCases || [])];
  const seen = new Set(merged.map((c) => c.id));
  for (const c of builtinCases || []) {
    if (seen.has(c.id)) bad(`跨集合 id 相撞：${c.id}（用户 promptset 与随发库 id 不能重；库条目用 bnd_/sec_ 前缀）`);
    seen.add(c.id);
    merged.push(c);
  }
  return merged;
}

function escapeRegExp(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// 从 expect 合成 soft:true 软期望（绝不进裁定）：mustInclude→replyContains；mustNotInclude→replyMatches 负向环视。
// 挂到冻结 flow 的 prompt 槽所在 intent；caseId/channel 取母体 events（replay --soft-expect 会核对 caseId 同源）。
export function buildSoftExpect(promptCase, intentId, caseId, channel) {
  const e = promptCase.expect || {};
  const expected = [];
  for (const s of e.mustInclude || []) expected.push({ kind: 'replyContains', op: 'contains', value: s, soft: true });
  for (const s of e.mustNotInclude || []) expected.push({ kind: 'replyMatches', op: 'matches', value: `^(?![\\s\\S]*${escapeRegExp(s)})`, soft: true });
  return {
    caseId, channel: channel || 'web',
    intents: expected.length ? [{ intentId, expected }] : [],
    globalAssertions: [],
  };
}

// 定位冻结 flow 里唯一的 {{promptText}} 提示槽 → 逐行展开回放输入。绝不改 events（跨行同一冻结 flow 集）。
// 0 或 >1 个槽 fail-closed——数据驱动无确定锚。cases 应已过 parsePromptset/mergeCases（规范化）。
export function overlayPromptset({ events, cases, slotToken = PROMPT_SLOT_TOKEN }) {
  if (!events || typeof events !== 'object' || !Array.isArray(events.events)) bad('overlay: events 须是含 events[] 的冻结 flow');
  if (!Array.isArray(cases) || cases.length === 0) bad('overlay: cases 须是非空数组（先 parsePromptset/mergeCases）');
  const slots = events.events.filter((ev) => ev && ev.value === slotToken);
  if (slots.length === 0) bad(`overlay: 冻结 flow 无提示槽（无 event.value === ${slotToken}）——数据驱动无锚，fail-closed`);
  if (slots.length > 1) bad(`overlay: 冻结 flow 有 ${slots.length} 个提示槽（须恰 1 个，否则锚歧义），fail-closed`);
  const slotEv = slots[0];
  const slot = { stepId: slotEv.stepId, intentId: slotEv.intentId };
  const caseId = events.caseId;
  const channel = events.channel || 'web';
  const rows = cases.map((c) => ({
    promptId: c.id,
    category: c.category,
    source: c.source,
    promptText: c.text,
    ctx: { promptText: c.text },
    softExpect: buildSoftExpect(c, slot.intentId, caseId, channel),
    promptsetMeta: { promptId: c.id, category: c.category, source: c.source, promptText: c.text, ...(c.expect && c.expect.note ? { note: c.expect.note } : {}) },
  }));
  return { slot, rows };
}
