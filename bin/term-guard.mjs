#!/usr/bin/env node
// term-guard —— 统一语言强制兜底·钩子甲（零 LLM，确定性）。机制依据：docs/plans/term-guard/plan.md。
// 承接 loop-kit/bin/term-lint.mjs（不改它，只 import parseRegistry 读 CONTEXT.md 四列制），补其漏检：
//   R3 比喻声明块格式 / R6 中英混合·多形态加粗 + 弃用别名 / 引用豁免。R5 裸英文不硬拦（语义模糊），
//   只把「像新造术语」的裸英文（内嵌大写 CamelCase 等）外抛给乙判是否该登记；小写常用词不外抛免淹没乙。
// codex 异构评审（2026-07-01，gpt-5.5 判 FAIL）后加固：
//   R6 认 __粗__ 与 **粗**、多行、无长度上限；R3 任一标记触发、字段非空、本体不限行首；
//   弃用别名只豁免反引号代码体（自然语言引号内视作使用），ASCII 别名按词元大小写不敏感。
//
// 用法：node bin/term-guard.mjs --text <file> [--emit-candidates <out>]
// 退出码：0 干净；1 有违例；64 用法错误。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRegistry } from '../loop-kit/bin/term-lint.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const METAPHOR_SIGNALS = ['相当于', '如同', '好比', '仿佛', '打个比方', '就像', '犹如', '类似于', '譬如'];
const TOKEN_RE = /[A-Za-z0-9]+(?:[-'.:][A-Za-z0-9]+)*/g;
// 加粗跨度：** 或 __ 成对（backref \1），内容可跨行、无长度上限。修 codex FAIL：原仅单行 **..** ≤80。
const BOLD_RE = /(\*\*|__)([\s\S]+?)\1/g;
const CJK = /[一-鿿]/;

// 反引号代码体遮罩（等长占位）——弃用别名只认这一层豁免。
function maskCode(text) {
  return text.replace(/`[^`\n]*`/g, (m) => '#'.repeat(m.length));
}
function maskBoldSpans(text) {
  return text.replace(BOLD_RE, (m) => '#'.repeat(m.length));
}

// ── R3：比喻声明块（空行分段；段内出现任一字段标记（本体/喻体/关联是/联系是）即触发；合规要求四字段各「独占一行 + 非空内容」，
//    且任一字段标记不得与其他内容/字段同行）──
// codex 三轮加固：一轮 four-on-one-line；二轮 line-leading；三轮 重复字段（本体：A 喻体：BAD\n喻体：B…）——
// 只查「曾行首出现」会被绕过，故此处额外拒绝任何「非行首」的字段标记（= 与他物或别的字段同行）。
export function checkMetaphorBlocks(rawText) {
  const FIELDS = ['本体', '喻体', '关联是', '联系是'];
  const MARKER_RE = /(本体|喻体|关联是|联系是)\s*[:：]/g;
  const violations = [];
  // R3 不做任何豁免（codex round5：maskCode 会让 `本体：`A 这类反引号包住的声明块整个逃检=fail-open）。
  // 代价：讨论格式（`本体：`）会被误报——但那是 fail-safe 假阳（标记非行首=stray），可接受；绝不放行真声明块。
  for (const para of rawText.split(/\n[ \t]*\n/)) {
    if (!/(本体|喻体|关联是|联系是)\s*[:：]/.test(para)) continue; // 任一字段标记即触发（codex round7：只写关联是/联系是的残块也判红，fail-open→fail-safe）
    const lead = { '本体': [], '喻体': [], '关联是': [], '联系是': [] }; // 每字段的行首出现（值=该次是否非空）
    let stray = false;
    for (const line of para.split('\n')) {
      let m; MARKER_RE.lastIndex = 0;
      while ((m = MARKER_RE.exec(line))) {
        if (!/^\s*$/.test(line.slice(0, m.index))) { stray = true; continue; } // 非行首标记 = 与他物/别字段同行
        lead[m[1]].push(line.slice(m.index + m[0].length).trim().length > 0);
      }
    }
    const problems = [];
    for (const k of FIELDS) {
      const occ = lead[k];
      if (occ.length === 0) problems.push('缺「' + k + '：」');
      else if (occ.length > 1) problems.push('「' + k + '：」重复出现 ' + occ.length + ' 次（须唯一）');
      else if (!occ[0]) problems.push('「' + k + '：」内容空');
    }
    if (stray) problems.push('有字段标记未独占行首（与其他内容或字段同行）');
    if (problems.length) {
      violations.push('R3 比喻声明块不合规：' + problems.join('、') + '——四字段须各唯一起一行、内容非空、不与他物同行（plan.md R3）。');
    }
  }
  return violations;
}

// 别名命中：ASCII 大小写不敏感 + 词界（前后非字母数字；支持含空格/下划线/斜杠/@ 等多形态，codex round8 修 old-alias 漏检）；
// CJK 子串。词界防子串误报（gate 不命中 aggregate）。
function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
export function aliasHit(text, alias) {
  if (/^[\x00-\x7f]+$/.test(alias)) {
    return new RegExp('(?<![A-Za-z0-9])' + escapeRegex(alias) + '(?![A-Za-z0-9])', 'i').test(text);
  }
  return text.includes(alias);
}

// ── R6：弃用别名（明文使用；只豁免反引号）──
export function scanDeniedAliases(codeMaskedText, deny) {
  const violations = [];
  const seen = new Set();
  for (const { alias, canonical } of deny) {
    if (!alias || seen.has(alias)) continue;
    if (aliasHit(codeMaskedText, alias)) {
      seen.add(alias);
      violations.push('R6 弃用别名「' + alias + '」——应改用「' + canonical + '」（CONTEXT.md 别名列黑名单）');
    }
  }
  return violations;
}

function extractEnglishTokens(content) {
  // 含单字母（codex round6：**X** 单字母加粗英文原被 length>=2 滤掉、加粗跨度当「无英文」漏检 = fail-open）。纯数字仍排除。
  return [...content.matchAll(TOKEN_RE)].map((m) => m[0]).filter((t) => /[A-Za-z]/.test(t));
}

// ── R6：加粗跨度含未登记英文（含中英混合、多行、__ 形态）──
export function scanBoldSpans(quotedMaskedText, allow) {
  const violations = [];
  for (const m of quotedMaskedText.matchAll(BOLD_RE)) {
    const content = m[2];
    if (allow.has(content.trim().toLowerCase().replace(/\s+/g, ' '))) continue; // 整跨度即已登记词/短语
    const tokens = extractEnglishTokens(content);
    if (tokens.length === 0) continue; // 纯中文加粗：term-lint 已管（WARN），非本条硬拦范围
    if (allow.has(tokens.join(' ').toLowerCase())) continue; // 词元拼回命中已登记多词短语
    if (tokens.every((t) => allow.has(t.toLowerCase()))) continue; // 逐词均已登记
    const unregistered = tokens.filter((t) => !allow.has(t.toLowerCase()));
    violations.push('R6 加粗未登记英文「' + content.replace(/\n/g, ' ') + '」——内含未登记词 ' +
      unregistered.map((u) => '「' + u + '」').join('、') + '，需登记 CONTEXT.md 或改用已登记术语');
  }
  return violations;
}

function matchTrailingChineseParen(after) {
  const m = /^\s{0,3}([(（])/.exec(after);
  if (!m) return null;
  const open = m[1], close = open === '(' ? ')' : '）';
  const start = m[0].length;
  const idx = after.indexOf(close, start);
  if (idx === -1) return null;
  const content = after.slice(start, idx);
  if (!CJK.test(content)) return null;
  return { content };
}

// ── R5 不硬拦（语义模糊，交乙）：带中文括号描述者判 R4 机翻；裸 CamelCase（内嵌大写）判「是否该登记的新术语」；
//    裸小写常用词（gate/golden）不外抛，免淹没乙。──
export function collectTermCandidates(proseText, allow) {
  const candidates = [];
  for (const m of proseText.matchAll(TOKEN_RE)) {
    const token = m[0];
    if (!/[A-Za-z]/.test(token) || token.length < 2) continue;
    if (allow.has(token.toLowerCase())) continue;
    const paren = matchTrailingChineseParen(proseText.slice(m.index + token.length));
    if (paren) { candidates.push({ type: 'translation', term: token, gloss: paren.content.trim() }); continue; }
    if (/[a-z][A-Z]/.test(token)) candidates.push({ type: 'newterm', term: token }); // 内嵌大写 = 像新造复合术语
  }
  return candidates;
}

function detectMetaphorCandidates(codedText) {
  const candidates = [];
  for (const word of METAPHOR_SIGNALS) {
    let from = 0, idx;
    while ((idx = codedText.indexOf(word, from)) !== -1) {
      const start = Math.max(0, idx - 6), end = Math.min(codedText.length, idx + word.length + 24);
      candidates.push({ type: 'metaphor', signal: word, span: codedText.slice(start, end).trim() });
      from = idx + word.length;
    }
  }
  return candidates;
}

// 反引号内的弃用别名：甲不硬拦（视作提及），但外抛乙判「提及 vs 伪装使用」——把确定性死角交语义层（codex round5 #2）。
function collectAliasRefsInCode(rawText, deny) {
  const out = [];
  const seen = new Set();
  for (const span of rawText.match(/`[^`\n]*`/g) || []) {
    for (const { alias } of deny) {
      if (!alias || seen.has(alias)) continue;
      if (aliasHit(span, alias)) { seen.add(alias); out.push({ type: 'alias-ref', alias, span }); }
    }
  }
  return out;
}

export function evaluate(rawText, registry) {
  const { allow, deny } = registry;
  const violations = [];
  violations.push(...checkMetaphorBlocks(rawText)); // R3：无豁免
  const coded = maskCode(rawText); // 唯一豁免层 = 反引号代码体；自然语言引号不豁免（codex round5 #1/#3）
  violations.push(...scanDeniedAliases(coded, deny));
  violations.push(...scanBoldSpans(coded, allow));
  const candidates = [
    ...detectMetaphorCandidates(coded),
    ...collectTermCandidates(maskBoldSpans(coded), allow),
    ...collectAliasRefsInCode(rawText, deny),
  ];
  return { violations, candidates };
}

// ── CLI ──
function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--text') opts.text = argv[++i];
    else if (a === '--emit-candidates') opts.emitCandidates = argv[++i];
    else if (a === '--help' || a === '-h') opts.help = true;
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.text) {
    console.error('用法: term-guard.mjs --text <file> [--emit-candidates <out>]');
    process.exit(opts.help ? 0 : 64);
  }
  let raw;
  try { raw = readFileSync(opts.text, 'utf8').replace(/\r\n/g, '\n'); }
  catch (e) { console.error('term-guard: 读不到 --text「' + opts.text + '」—— ' + e.message); process.exit(64); }

  const registry = parseRegistry();
  if (registry.registryErrors.length) {
    console.error('term-guard: CONTEXT.md 四列制不完整，不能作白名单（fail-closed）：');
    for (const e of registry.registryErrors) console.error('  CONTEXT.md:' + e.line + '  ' + e.msg);
    process.exit(1);
  }
  const { violations, candidates } = evaluate(raw, registry);
  if (opts.emitCandidates) {
    mkdirSync(dirname(resolve(ROOT, opts.emitCandidates)), { recursive: true });
    writeFileSync(opts.emitCandidates, JSON.stringify(candidates, null, 2));
  }
  if (violations.length) {
    console.error('term-guard: ' + violations.length + ' 处统一语言违例：');
    for (const v of violations) console.error('  - ' + v);
    process.exit(1);
  }
  console.log('term-guard: 通过（R3/R6 校验干净）。');
  process.exit(0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
