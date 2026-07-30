#!/usr/bin/env node
// M4 诱饵对照探针（四代口径矩阵）。零执行：只做静态文本分析，不 import 被测源。
//
// 四代 C7 口径逐代在案（每代按它当时真实的断言集判，不拿今天的哨兵替旧钉背书）：
//   r1（code-r1 换签）：不剥离，只核 包裹/首实参/调用在实参内；
//   r2（code-r2 换签）：字符级剥离（按前一个有效「字符」判正则）+「真调用恰一处」哨兵；
//   r3（code-r3 换签）：整词回溯剥离（按前一个「token」判正则）+ 同一枚哨兵；
//   r4（现役，code-r4 止损）：原始字节计数纪律 + 歧义毒化 fail-closed + 唯一调用落在包裹内。
//
// 已复现的逐代假绿（都是把真调用挪出包裹、再往包裹里塞一枚认不出的伪调用）：
//   A 注释诱饵      → r1 绿
//   B 字符串诱饵    → r1 绿
//   C 别名 + return 正则（codex code-r3 原样反例）→ r2 绿
//   E debugger 后正则（codex code-r4 ②）          → r3 绿
// D 是 r4 的 fail-closed 面，不声称更早的代曾假绿：别名 + 对象字面量除号（codex code-r4 ①）——
//   r3 会把那一行的 / 误判成正则、从 / 一路剥到行尾，连真调用字节一起吞掉，本探针直接量这件事。
//   毒化钉的实测要改真 record.mjs 才量得到，在 negctl-m4-poison-ambiguous-slash.log。

import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = resolve(fileURLToPath(new URL('../../../..', import.meta.url)));
const golden = readFileSync(
  resolve(ROOT, 'tests/_golden/teachin-replayability-cycle-plan.static.golden.mjs'), 'utf8',
);

// 现役 r4 的三件（剥离器/定位器/计数器）直接从金牌里取，避免探针与钉各写一套而对不上。
const sliceAt = golden.indexOf('// 可证正则：这些关键字后面跟的 /');
const sliceEnd = golden.indexOf('\nasync function check(');
if (sliceAt < 0 || sliceEnd <= sliceAt) {
  console.error('PROBE_RED: 取不到现役金牌的剥离器/定位器/计数器（切片锚点漂了）');
  process.exit(2);
}
const helperFile = join(tmpdir(), `casey-m4-helpers-${process.pid}.mjs`);
writeFileSync(helperFile,
  `${golden.slice(sliceAt, sliceEnd)}\nexport { stripLexical, lexicalSpan, countRaw };\n`, 'utf8');
let stripLexical;
let lexicalSpan;
let countRaw;
try {
  ({ stripLexical, lexicalSpan, countRaw } = await import(pathToFileURL(helperFile).href));
} finally {
  rmSync(helperFile, { force: true });
}

const CALL = 'runRecordedTeachinReplayabilityCycle';
const WRAP = 'runWithCycleEvidence';

// ── 旧代剥离器复刻（留证用；现役实现已换代，拿现役是复现不出这些假绿的）──
// 共用一台 token 扫描器，只换 / 的判别口径：r2 看前一 token 的尾字符，r3 看前一 token 整词。
function makeStripper(classify) {
  return (source) => {
    const chars = source.split('');
    const blankAt = (index) => {
      if (index >= 0 && index < chars.length && chars[index] !== '\n') chars[index] = ' ';
    };
    let previous = null;
    let i = 0;
    while (i < source.length) {
      const ch = source[i];
      if (ch === '/' && source[i + 1] === '/') {
        while (i < source.length && source[i] !== '\n') { blankAt(i); i += 1; }
        continue;
      }
      if (ch === '/' && source[i + 1] === '*') {
        blankAt(i); blankAt(i + 1); i += 2;
        while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) { blankAt(i); i += 1; }
        blankAt(i); blankAt(i + 1); i += 2;
        continue;
      }
      if (ch === '\'' || ch === '"') {
        blankAt(i); i += 1;
        while (i < source.length && source[i] !== ch && source[i] !== '\n') {
          if (source[i] === '\\') { blankAt(i); i += 1; }
          blankAt(i); i += 1;
        }
        blankAt(i); i += 1;
        previous = { type: 'literal' };
        continue;
      }
      if (ch === '/' && classify(previous)) {
        blankAt(i); i += 1;
        while (i < source.length && source[i] !== '\n') {
          if (source[i] === '/') { blankAt(i); i += 1; break; }
          blankAt(i); i += 1;
        }
        previous = { type: 'literal' };
        continue;
      }
      if (/[A-Za-z0-9_$]/.test(ch)) {
        let end = i;
        while (end < source.length && /[A-Za-z0-9_$]/.test(source[end])) end += 1;
        previous = { type: 'word', text: source.slice(i, end) };
        i = end;
        continue;
      }
      if (!/\s/.test(ch)) previous = { type: 'punct', text: ch };
      i += 1;
    }
    return chars.join('');
  };
}

const R2_LEAD = '(,=:[!&|?{};+-*%~^<>';
const r2Strip = makeStripper((previous) => {
  if (!previous) return true;
  const text = previous.text || 'x';
  return R2_LEAD.includes(text[text.length - 1]);
});
const R3_WORDS = new Set([
  'return', 'typeof', 'case', 'in', 'of', 'instanceof', 'new', 'delete',
  'void', 'do', 'else', 'yield', 'await', 'throw',
]);
const r3Strip = makeStripper((previous) => {
  if (!previous) return true;
  if (previous.type === 'word') return R3_WORDS.has(previous.text);
  if (previous.type === 'literal') return false;
  return previous.text !== ')' && previous.text !== ']';
});

// 旧代 C7 断言集：包裹 + 首实参 + 调用在实参内（+ r2/r3 起才有的「真调用恰一处」哨兵）。
function legacyVerdict(text, strip, { sentinel }) {
  const code = strip(text);
  const wrap = lexicalSpan(code, `${WRAP}(`);
  if (!wrap) return { passes: false, why: 'no-wrap' };
  const args = code.slice(wrap.argsAt, wrap.end);
  const minted = code.match(/const\s+([A-Za-z0-9_$]+)\s*=\s*createCycleEvidenceCollector\(\)/);
  const firstArg = args.split(',')[0].trim();
  const inner = args.indexOf(`${CALL}(`);
  const calls = [];
  for (let at = code.indexOf(`${CALL}(`); at >= 0; at = code.indexOf(`${CALL}(`, at + 1)) calls.push(at);
  let passes = !!minted && firstArg === minted[1] && inner >= 0;
  if (passes && sentinel) passes = calls.length === 1 && calls[0] === wrap.argsAt + inner;
  return { passes, why: `inner=${inner} realCalls=${calls.length}` };
}

// 现役 r4：先数原始字节，再毒化式剥离，最后核唯一调用落在包裹内。
function currentVerdict(text) {
  for (const [name, bare, called] of [[CALL, 2, 1], [WRAP, 2, 1]]) {
    const bareCount = countRaw(text, name);
    const callCount = countRaw(text, `${name}(`);
    if (bareCount !== bare) return { passes: false, why: `计数纪律：${name} 裸名 ${bareCount} 处（须 ${bare}）` };
    if (callCount !== called) return { passes: false, why: `计数纪律：${name}( 调用形 ${callCount} 处（须 ${called}）` };
  }
  const stripped = stripLexical(text);
  if (stripped.poisoned) return { passes: false, why: `歧义毒化：${stripped.reason}` };
  const wrap = lexicalSpan(stripped.text, `${WRAP}(`);
  if (!wrap) return { passes: false, why: 'no-wrap' };
  const callAt = text.indexOf(`${CALL}(`);
  if (!(callAt > wrap.argsAt && callAt < wrap.end)) {
    return { passes: false, why: '唯一调用不在包裹实参内' };
  }
  return { passes: true, why: 'ok' };
}

const CALL_BLOCK = `        ${CALL}({
          caseId,
        })`;
const ALIAS_BLOCK = `        runCycleAlias({
          caseId,
        })`;
// 每枚诱饵都自带 import 具名一处，好让计数纪律按真 CLI 的口径（import 一处 + 调用一处）来数。
const PREAMBLE = `import { ${CALL} } from '../lib/teachin/replayability-cycle-entry.mjs';
      const evidenceCollector = createCycleEvidenceCollector();
`;

const DECOYS = [
  ['A 注释诱饵', `${PREAMBLE}      const started = (
${CALL_BLOCK}
      );
      const cycle = await ${WRAP}(evidenceCollector, /* ${CALL}({}) */ () => started);
`, 'r1'],
  ['B 字符串诱饵', `${PREAMBLE}      const started = (
${CALL_BLOCK}
      );
      const cycle = await ${WRAP}(evidenceCollector, () => (started || '${CALL}()'));
`, 'r1'],
  ['C 别名 + return 正则（codex code-r3 原样反例）', `${PREAMBLE}      const runCycleAlias = ${CALL};
      const started = (
${ALIAS_BLOCK}
      );
      const cycle = await ${WRAP}(evidenceCollector, () => { return /${CALL}()/, started; });
`, 'r2'],
  ['E debugger 后正则（codex code-r4 ②）', `${PREAMBLE}      const runCycleAlias = ${CALL};
      const started = (
${ALIAS_BLOCK}
      );
      const cycle = await ${WRAP}(evidenceCollector, () => { if (!started) debugger
      /${CALL}()/.test('x'); return started; });
`, 'r3'],
  ['D 别名 + 对象字面量除号（codex code-r4 ①）', `${PREAMBLE}      const runCycleAlias = ${CALL};
      const ratio = {} / 2; const started = runCycleAlias({ caseId });
      const cycle = await ${WRAP}(evidenceCollector, () => (started || ratio));
`, null],
];

const rows = DECOYS.map(([label, text, foolsGeneration]) => {
  const aliasAt = text.indexOf('runCycleAlias({');
  return {
    label,
    foolsGeneration,
    r1_noStrip: legacyVerdict(text, (value) => value, { sentinel: false }),
    r2_charStrip: legacyVerdict(text, r2Strip, { sentinel: true }),
    r3_tokenStrip: legacyVerdict(text, r3Strip, { sentinel: true }),
    r4_current: currentVerdict(text),
    // ① 的直接量：r3 判成正则后从 / 剥到行尾，连真调用字节一起吞掉。
    r3OverStripsRealCall: aliasAt >= 0
      ? r3Strip(text).slice(aliasAt, aliasAt + 'runCycleAlias('.length) !== 'runCycleAlias('
      : null,
  };
});

console.log(JSON.stringify(rows, null, 2));

const byGeneration = { r1: 'r1_noStrip', r2: 'r2_charStrip', r3: 'r3_tokenStrip' };
const allCaught = rows.every((row) => row.r4_current.passes === false);
const escalationsHold = rows.every((row) => !row.foolsGeneration
  || row[byGeneration[row.foolsGeneration]].passes === true);
if (!allCaught) {
  console.error('PROBE_RED: 现役 r4 口径仍被某枚诱饵骗绿');
  process.exit(1);
}
if (!escalationsHold) {
  console.error('PROBE_RED: 已记账的逐代假绿复现不出来了——对照失效，账要重记');
  process.exit(1);
}
console.log('PROBE_GREEN: 五枚诱饵在现役 r4 口径下全红；A/B 在 r1、C 在 r2、E 在 r3 的假绿逐条复现');
