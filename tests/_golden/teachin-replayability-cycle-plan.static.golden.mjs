#!/usr/bin/env node
// record 同次 capture 闭环静态门：默认从刚落盘的 exact bytes 生成 cycle input；
// 旧 --cycle-plan 仅作模板并重绑本次 capture 身份。零 SUT/browser/network/LLM。
//
// 威胁模型（codex code-r6 收窄，同 M3 的收窄逻辑）：本门是**协作文件的回归闸**——
// 防重构走形、防实现者为迎合钉而造 rig 回归。它**不防**拥有本仓写权的对抗性混淆：
// 那样的对抗者可以直接改本金牌本身，任何静态门在该威胁下都自反、证不出东西。
// 评审逐轮打进来的反例（注释/字符串/正则诱饵、词法歧义、求值期启动、转义标识符影子）
// 是把这道门磨利的砂轮，不是这道门的验收标准——门的验收标准只有一条：
// 真件的自然写法原样过，任何走形当场红。

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const TAG = 'teachin-replayability-cycle-plan';
const failures = [];
let passed = 0;

function source(rel) {
  const file = resolve(ROOT, rel);
  if (!existsSync(file)) throw new Error(`缺文件 ${rel}`);
  return readFileSync(file, 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// C7 的判据口径（codex code-r4 止损定案）：退出与 JavaScript 词法歧义的军备竞赛。
// 前三代教训逐条在案：r1 裸字面量钉→被注释/字符串诱饵骗绿（code-r2）；
// r2 字符级剥离→被 `return /…/` 骗绿（code-r3，忠实别名反例实测 C7 绿）；
// r3 整词回溯→仍被两条合法语法骗：对象字面量 `{} / name()` 的 / 是除号却按语句位判正则、
// 把包裹外的真调用一并剥掉；`debugger` 换行后的 / 是正则却按标识符判除号、诱饵留存（code-r4）。
// 根因：`/` 在 `}` 与 `)` 之后到底是除号还是正则，本质要完整语法分析才判得了。
//
// 定案改为两条不靠词法的纪律，外加一条 fail-closed：
//   ① 原始字节计数：本 CLI 里这两个名字各只许出现「import 具名一处 + 调用一处」；
//      多一处——不管藏在注释、字符串、正则还是别名赋值里——一律红。别名/间接调用天然多一处。
//   ② 唯一那处调用形必须落在取证包裹的实参词法内（定位与括号配平仍用剥离文本）。
//   ③ 剥离器遇到任何证不出是除号、也证不出是正则的 `/` → 整扫描毒化 → C7 红。
// 守的是我们自己可控的 bin/record.mjs：正常代码不会拿这两个名字写注释或别名；
// 真写了就红，改注释即可——冗余成本远低于继续猜词法。

// 可证正则：这些关键字后面跟的 / 只可能是正则起头（表达式位）。
const REGEX_LEAD_WORDS = new Set([
  'return', 'typeof', 'case', 'in', 'of', 'instanceof', 'new', 'delete',
  'void', 'do', 'else', 'yield', 'await', 'throw',
]);
// 可证除号：这些词收尾的是一个值，后面跟的 / 只可能是除法。
const VALUE_END_WORDS = new Set(['this', 'super', 'true', 'false', 'null', 'undefined']);
// 其余保留字（debugger/break/function/const…）后面跟 / 要么是语法错、要么语境不可判：一律毒化。
const RESERVED_WORDS = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default',
  'delete', 'do', 'else', 'enum', 'export', 'extends', 'finally', 'for', 'function',
  'if', 'implements', 'import', 'in', 'instanceof', 'interface', 'let', 'new',
  'package', 'private', 'protected', 'public', 'return', 'static', 'super', 'switch',
  'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield', 'await',
  'async', 'get', 'set', 'of',
]);
// 可证正则：运算符与开括号之后只可能起正则。
const REGEX_LEAD_PUNCT = new Set([
  '(', '[', '{', ',', ';', '=', '!', '&', '|', '?', ':', '+', '-', '*', '%', '^', '~', '<', '>', '/',
]);

// 三态判别：'regex' / 'division' / 'ambiguous'。拿不准一律 ambiguous——由调用方毒化整扫描。
function classifySlash(previous) {
  if (!previous) return 'regex';
  if (previous.type === 'literal') return 'division';
  if (previous.type === 'word') {
    if (REGEX_LEAD_WORDS.has(previous.text)) return 'regex';
    if (VALUE_END_WORDS.has(previous.text)) return 'division';
    // 保留字（如 debugger）语境不可判；普通标识符与数字收尾的是值，判除号。
    return RESERVED_WORDS.has(previous.text) ? 'ambiguous' : 'division';
  }
  if (previous.type === 'close') {
    if (previous.text === ']') return 'division';
    // ) 之后是除号还是正则，取决于这对括号是 if/while/for 的头还是调用/分组——保守毒化。
    return 'ambiguous';
  }
  // } 之后（块结束 vs 对象字面量结束）语境不可判——codex code-r4 反例就出在这里。
  if (previous.text === '}') return 'ambiguous';
  return REGEX_LEAD_PUNCT.has(previous.text) ? 'regex' : 'ambiguous';
}

// 词法剥离（纯静态文本，零执行）：注释、单双引号串、模板串（含 ${} 嵌套）与正则字面量
// 逐字符剥成同长空格，换行原样保留——剥离结果与原文逐字符同偏移，下标可直接切原文。
// 只服务两件事：定位取证包裹的 span、括号配平。判不出的 / 不再猜，直接毒化。
function stripLexical(source) {
  const chars = source.split('');
  const blankAt = (index) => {
    if (index >= 0 && index < chars.length && chars[index] !== '\n') chars[index] = ' ';
  };
  const lineOf = (index) => source.slice(0, index).split('\n').length;
  const templateBraces = [];
  let mode = 'code';
  let braceDepth = 0;
  let previous = null;
  let i = 0;
  // shebang 整行不是 JavaScript 表达式，先剥掉，免得 #! 后的 / 进判别器。
  if (source.startsWith('#!')) {
    while (i < source.length && source[i] !== '\n') { blankAt(i); i += 1; }
  }
  while (i < source.length) {
    const ch = source[i];
    if (mode === 'template') {
      if (ch === '\\') { blankAt(i); blankAt(i + 1); i += 2; continue; }
      if (ch === '`') { blankAt(i); i += 1; mode = 'code'; previous = { type: 'literal' }; continue; }
      if (ch === '$' && source[i + 1] === '{') {
        blankAt(i); blankAt(i + 1); i += 2;
        templateBraces.push(braceDepth);
        braceDepth += 1;
        mode = 'code';
        previous = null;
        continue;
      }
      blankAt(i); i += 1; continue;
    }
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
    if (ch === '`') { blankAt(i); i += 1; mode = 'template'; continue; }
    if (ch === '/') {
      const verdict = classifySlash(previous);
      if (verdict === 'ambiguous') {
        // fail-closed：证不出就不猜，整扫描作废（判据宁可红，也不许靠猜判绿）。
        return {
          text: chars.join(''),
          poisoned: true,
          reason: `第 ${lineOf(i)} 行的 / 既证不出是除号也证不出是正则`,
        };
      }
      if (verdict === 'division') {
        previous = { type: 'punct', text: '/' };
        i += 1;
        continue;
      }
      blankAt(i); i += 1;
      let inClass = false;
      while (i < source.length && source[i] !== '\n') {
        const cur = source[i];
        if (cur === '\\') { blankAt(i); blankAt(i + 1); i += 2; continue; }
        if (cur === '[') inClass = true;
        else if (cur === ']') inClass = false;
        else if (cur === '/' && !inClass) { blankAt(i); i += 1; break; }
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
    if (ch === '(') { previous = { type: 'punct', text: '(' }; i += 1; continue; }
    if (ch === ')') { previous = { type: 'close', text: ')' }; i += 1; continue; }
    if (ch === ']') { previous = { type: 'close', text: ']' }; i += 1; continue; }
    if (ch === '{') {
      braceDepth += 1;
      previous = { type: 'punct', text: '{' };
      i += 1;
      continue;
    }
    if (ch === '}') {
      braceDepth -= 1;
      if (templateBraces.length > 0 && braceDepth === templateBraces[templateBraces.length - 1]) {
        templateBraces.pop();
        blankAt(i); i += 1; mode = 'template';
        continue;
      }
      previous = { type: 'punct', text: '}' };
      i += 1;
      continue;
    }
    if (!/\s/.test(ch)) previous = { type: 'punct', text: ch };
    i += 1;
  }
  return { text: chars.join(''), poisoned: false, reason: null };
}

// 原始字节计数：不剥离、不判词法，就数这串字节在全文出现几次。
function countRaw(text, needle) {
  return text.split(needle).length - 1;
}
// 词法包裹定位（纯静态文本，零执行）：找到 needle 的实参表，按括号配平数出它的词法范围。
// 换签理由（codex code-r1 M4）：原钉写死 'await runRecorded…' 裸字面量，逼实现多铸一枚
// Promise 去迎合字面量（rig）。改钉结构——闭环调用必须落在 runWithCycleEvidence 的实参词法内。
// 只吃已剥离文本（codex code-r2 M4）：括号计数必须在真代码上跑，注释与串里的括号不算数。
function lexicalSpan(text, needle) {
  const at = text.indexOf(needle);
  if (at < 0) return null;
  const open = at + needle.length - 1;
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return { start: at, argsAt: open + 1, end: i };
    }
  }
  return null;
}

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${TAG}: ${name}`);
  } catch (error) {
    failures.push(`${name}: ${String(error?.message || error).slice(-700)}`);
    console.error(`RED  ${TAG}: ${name}: ${String(error?.message || error).slice(-700)}`);
  }
}

const record = source('bin/record.mjs');
const loader = source('lib/teachin/cycle-input-loader.mjs');
const entry = source('lib/teachin/replayability-cycle-entry.mjs');
// legacy builder 函数体切片：从声明起、到下一个顶层 function 止。
const buildAt = loader.indexOf('function buildLegacyCycleInput');
const buildEnd = loader.indexOf('\nfunction ', buildAt + 1);
const build = buildAt >= 0
  ? loader.slice(buildAt, buildEnd > buildAt ? buildEnd : undefined) : '';

await check('C1 默认闭环绑定同次落盘 capture，且只在 login-bootstrap 后交权', () => {
  assert(/--cycle-plan <f>/.test(record), 'usage 必须声明 --cycle-plan <f>');
  for (const flag of [
    '--testcase <f>', '--expected <f>', '--entity-lock <f>',
    '--profile <f>', '--sut-build-digest <sha256:...>',
  ]) assert(record.includes(flag), `usage 缺同次闭环输入 ${flag}`);
  const captureWrite = record.indexOf('const captureFile = writePackage(');
  const captureRead = record.indexOf('readFileSync(captureFile)', captureWrite);
  const assembled = record.indexOf('buildRecordedCycleInput({', captureRead);
  const transfer = record.indexOf('recordingOwnerTransferred = true', assembled);
  const cycle = record.indexOf('runRecordedTeachinReplayabilityCycle({', transfer);
  assert(captureWrite >= 0 && captureRead > captureWrite && assembled > captureRead
    && transfer > assembled && cycle > transfer,
  '必须先落盘→只读同份 exact capture→生成 input→交权→cycle');
  assert(/captureBytes:\s*exactCaptureBytes/.test(
    record.slice(assembled, transfer),
  ), 'cycle input 必须使用刚落盘后读取的 exact capture bytes');
  assert(/captureFile\s*&&\s*args\['login-bootstrap'\]\s*&&\s*cycleMode\.requested/
    .test(record), '闭环必须三条件与门：capture 已落盘 + login-bootstrap + 完整 cycle mode');
});

await check('C2 坏计划/坏路径折叠为固定 reason，不泄异常原文', () => {
  assert(buildAt >= 0, '缺 buildLegacyCycleInput');
  assert(/catch\s*\{/.test(build), 'buildCycleInput 的 catch 必须不绑定异常（防原文外带）');
  assert(/denied\('CYCLE_PLAN_INVALID'\)/.test(build),
    '读取/解析/取键异常必须折叠为固定 CYCLE_PLAN_INVALID');
  const planBytesAt = loader.indexOf('function planBytes');
  const planBytesEnd = loader.indexOf('\nfunction ', planBytesAt + 1);
  const planBytesBody = planBytesAt >= 0
    ? loader.slice(planBytesAt, planBytesEnd > planBytesAt ? planBytesEnd : undefined) : '';
  assert(planBytesAt >= 0 && /CYCLE_PLAN_INVALID/.test(planBytesBody),
    'planBytes 读盘/形状失败必须折叠为 CYCLE_PLAN_INVALID');
});

await check('C3 旧计划只作模板，身份与 events 重绑当前 capture 且不自铸 authority', () => {
  // cycle-entry 合同键（源码常量为准）：装配面必须逐键在场，防单边漂移。
  for (const [constant, keys] of [
    ['CYCLE_KEYS', ['sourcePlan', 'executionTargetAuthority', 'projection', 'distilled']],
    ['SOURCE_KEYS', ['candidateBytes', 'eventsBytes', 'entityLockBytes', 'runNamespace']],
    ['DISTILLED_KEYS', ['authoringRunNamespace', 'runNamespace']],
  ]) {
    assert(new RegExp(`${constant} = \\[[^\\]]*\\]`).test(entry.replace(/\n/g, ' ')),
      `cycle-entry 缺合同常量 ${constant}`);
    for (const key of keys) {
      // 兼容 shorthand 属性（如 executionTargetAuthority, 直挂）与显式 key: value 两种写法。
      assert(new RegExp(`\\b${key}\\s*[:,}]`).test(build), `装配缺合同键 ${key}`);
    }
  }
  for (const digest of [
    'sutBuildDigest', 'channelProfileDigest', 'identityProfileDigest',
    'replayKernelDigest', 'resetPlanDigest', 'sessionPolicyDigest',
  ]) {
    assert(new RegExp(`${digest}: sourcePlan\\.${digest}`).test(build),
      `sourcePlan 六 digest 必须原样透传：缺 ${digest}`);
  }
  for (const bytes of ['testcase', 'expected', 'candidate', 'events', 'entityLock']) {
    if (bytes === 'events') {
      assert(/eventsBytes:\s*Buffer\.from\(currentCaptureBytes\)/.test(build)
        && !/planBytes\(source\.events\)/.test(build),
      'eventsBytes 必须重绑本次 capture，禁止继续读取旧计划 capture');
    } else {
      assert(new RegExp(`planBytes\\((?:sourcePlan|source)\\.${bytes}\\)`).test(build),
        `模板字节字段必须由 loader 经 planBytes 读盘：缺 ${bytes}`);
    }
  }
  assert(/const token = captureToken\(currentCaptureBytes\)/.test(build)
    && /pairId:\s*`pair_\$\{token\}`/.test(build)
    && /runNamespace:\s*`run_source_\$\{token\}`/.test(build)
    && /authoringRunNamespace:\s*`run_authoring_\$\{token\}`/.test(build)
    && /runNamespace:\s*`run_distilled_\$\{token\}`/.test(build),
  'pair 与三 runtime namespace 必须全部重绑本次 capture token');
  assert(!/captureAuthority/.test(build),
    'captureAuthority 只能由 cycle-entry 同进程铸造注入，CLI 装配禁止自铸');
});

await check('C4 闭环回显只含固定 reason，路径与真实值不回显', () => {
  assert(/reason=\$\{cycle\?\.reason \|\| 'CYCLE_ENTRY_FAILED'\}；真实值不回显/.test(record),
    'emitCycleOutcome 失败面必须只回显闭合 reason');
  assert(!/\$\{args\['cycle-plan'\]\}/.test(record) && !/\$\{planFile\}/.test(record)
    && !/\$\{captureFile\}/.test(record),
  '计划路径/产物路径禁止进任何输出');
});

await check('C5 --cycle-plan 是须带值旗标，裸旗标必须立即拒绝', () => {
  // 所有路径/摘要旗标都不得让裸旗标拖到人工录制整场结束后才失败。
  const flags = record.match(/for \(const k of \[([^\]]*)\]\)/);
  for (const name of [
    'cycle-plan', 'testcase', 'expected', 'entity-lock', 'profile', 'sut-build-digest',
  ]) {
    assert(flags && flags[1].includes(`'${name}'`),
      `须带值旗标名单必须含 ${name}：${flags && flags[1]}`);
  }
  assert(/inspectRecordedCycleArgs\(args\)/.test(record)
    && /CYCLE_INPUT_MODE_CONFLICT|CYCLE_INPUT_INCOMPLETE/.test(loader),
  '旧计划与同次生成须互斥，且 auto 输入必须 all-or-none');
});

await check('C6 闭环走唯一入口且录制归属交接先于闭环、finally 按交接与否收尾', () => {
  assert(/import \{ runRecordedTeachinReplayabilityCycle \} from '\.\.\/lib\/teachin\/replayability-cycle-entry\.mjs'/
    .test(record), '闭环必须静态 import 唯一 cycle-entry');
  for (const forbidden of [
    'dual-replay-orchestrator', 'runtime-cycle-adapter', 'lib/dual-replay/',
  ]) {
    assert(!record.includes(forbidden), `record CLI 不得绕过 cycle-entry 直连 ${forbidden}`);
  }
  const transferAt = record.indexOf('recordingOwnerTransferred = true');
  const cycleAt = record.indexOf('runRecordedTeachinReplayabilityCycle(', transferAt);
  assert(transferAt > 0 && cycleAt > transferAt,
    '归属交接必须发生在闭环调用之前（交接后本文件禁止二次 close）');
  assert(/if \(!recordingOwnerTransferred\) \{\s*await browser\.close\(\)\.catch\(/
    .test(record), 'finally 只在未交接时收尾 recording browser');
});

await check('C7 两名字各只许 import 一处 + 调用一处，且第二实参恰为「零参箭头体内唯一调用」刚性模板', () => {
  // ① 原始字节计数纪律（不剥离、不判词法，纯数字节）：
  //    本 CLI 里这两个名字各只许出现两处——import 具名一处、调用一处；带 ( 的调用形恰一处。
  //    任何多出来的一处（注释、字符串、正则、别名赋值、第二次调用）都判红。
  //    别名/间接调用天然要先写一次裸名字才拿得到函数，因此也逃不掉这条。
  for (const [name, bareExpected, callExpected] of [
    ['runRecordedTeachinReplayabilityCycle', 2, 1],
    ['runWithCycleEvidence', 2, 1],
  ]) {
    const bare = countRaw(record, name);
    const called = countRaw(record, `${name}(`);
    assert(bare === bareExpected,
      `「${name}」在 bin/record.mjs 的原始字节里须恰 ${bareExpected} 处（import 一处 + 调用一处），实得 ${bare} 处——多出来的那处不管在注释、字符串、正则还是别名赋值里，都算多一条通路`);
    assert(called === callExpected,
      `「${name}(」的调用形须恰 ${callExpected} 处，实得 ${called} 处`);
  }

  // ② 词法剥离只用来定位包裹 span 与括号配平；判不出的 / 一律毒化整扫描（fail-closed）。
  const stripped = stripLexical(record);
  assert(stripped.poisoned === false,
    `词法歧义毒化，判据作废（宁可红也不猜）：${stripped.reason}`);
  const code = stripped.text;
  assert(code.length === record.length, '剥离结果必须与原文等长（下标须逐字符对齐）');

  // ③ 那唯一一处调用形必须落在取证包裹的实参词法范围内。
  //    调用位置取自原始字节（① 已证它全文唯一，不存在歧义），span 取自剥离文本。
  const wrap = lexicalSpan(code, 'runWithCycleEvidence(');
  assert(wrap, 'record CLI 必须以 runWithCycleEvidence(…) 词法包裹单次闭环');
  const callAt = record.indexOf('runRecordedTeachinReplayabilityCycle(');
  assert(callAt > wrap.argsAt && callAt < wrap.end,
    '唯一那处闭环调用必须落在 runWithCycleEvidence 的实参词法范围内（不得在包裹之外另起一跳）');

  // 反 rig：包裹与闭环调用之间不许再多一次 await——多一次 await 就多一枚 Promise 与一代微任务，
  // 那正是 code-r1 M4 里为迎合裸字面量钉造出来的形态。
  assert(!/\bawait\b/.test(code.slice(wrap.argsAt, callAt)),
    '取证词法包裹到闭环调用之间不得多铸 await 跳（为迎合字面量钉而多套 Promise 属 rig）');

  // ④ 刚性模板（codex code-r5）：「落在 span 内」不等于「落在回调体内」——
  //    实参位的 IIFE 形态 `runWithCycleEvidence(c, ((x) => () => x)(闭环调用({…})))`
  //    语法合法、计数全过、调用也在 span 内，但求值发生在进入 als.run 之前，
  //    收集器一条都收不到（运行时侧证见 fix-probes/m4-evaluation-timing.probe.mjs）。
  //    故把第二实参整体形状钉死成本件现状的精确形态：
  //      runWithCycleEvidence( <本次铸出的收集器> , ( ) => ( <唯一调用形>( …配平… ) ) )
  //    span 内除此之外一个非空白字符都不许有。这一钉同时封死：实参位 IIFE 求值、
  //    逗号表达式、第三实参、默认参数位，以及任何在 span 内却不在回调体内的形态。
  const minted = code.match(/const\s+([A-Za-z0-9_$]+)\s*=\s*createCycleEvidenceCollector\(\)/);
  assert(minted, 'record CLI 必须先铸一枚本次 cycle 专属的收集器');
  const collector = minted[1];
  const head = code.slice(wrap.argsAt, callAt);
  const headTemplate = new RegExp(`^\\s*${collector}\\s*,\\s*\\(\\s*\\)\\s*=>\\s*\\(\\s*$`);
  assert(headTemplate.test(head),
    `第二实参必须恰为零参箭头、且箭头体内第一个 token 就是那枚唯一闭环调用（不许实参位求值、不许 IIFE、不许逗号表达式）：实得「${head.trim().slice(0, 120)}」`);
  // 调用实参表的配平闭括号，之后到包裹收口之间只许是空白与那枚回调体的闭括号。
  let depth = 0;
  let callEnd = -1;
  for (let i = callAt + 'runRecordedTeachinReplayabilityCycle'.length; i < wrap.end; i += 1) {
    const ch = code[i];
    if (ch === '(') depth += 1;
    else if (ch === ')') {
      depth -= 1;
      if (depth === 0) { callEnd = i; break; }
    }
  }
  assert(callEnd > 0, '闭环调用的实参表必须在包裹内配平');
  const tail = code.slice(callEnd + 1, wrap.end);
  assert(/^\s*\)\s*$/.test(tail),
    `闭环调用配平之后到包裹收口之间不许再有任何东西（防第三实参、逗号表达式、尾随求值）：实得「${tail.trim().slice(0, 120)}」`);

  const sealAt = code.indexOf('sealCycleEvidence(');
  assert(sealAt > wrap.end, '封存必须在词法包裹收口之后（聚合前封存，迟到通报只计数）');

  // ⑤ 禁 Unicode 转义序列（codex code-r6）：JS 允许标识符写成 \u 转义，解析回同一个绑定名，
  //    但原始字节里不含完整名——影子声明因此整条躲过①的计数纪律。实测反例：
  //    `const runWithCycleEvidence = (collector, body) => body();`
  //    让 C7 整条判绿（裸名仍数得 2 处、模板也匹配），而闭环根本没进 als.run（eventCount=0）。
  //    这是「同一标识符两套字节」的唯一通路：同字节影子声明会被①逮成第 3 处；
  //    异码点同形字是**另一个**标识符，绑不上 import；模块严格模式无 with；eval 进不了模块作用域。
  //    本 CLI 现状零转义序列（中文注释与串全是 UTF-8 直写，不需要转义），故直接禁掉。
  assert(!/\\u/.test(record),
    'bin/record.mjs 的原始字节里不得出现 \\u 转义序列——转义能把同一个标识符写成两套字节，'
    + '让影子声明躲过计数纪律（真要用转义时请人工复核后同步改本钉，别绕）');

  // ⑥ 只许「裸具名导入」（codex code-r6 立、code-r7 收紧）：
  //    命名空间对象一旦在手，拼名取函数（ns['runWith' + 'CycleEvidence']）绕开①的计数纪律；
  //    更便宜的一条是普通别名改写——`import { safeEmit as runWithCycleEvidence }` 不用任何转义，
  //    原始字节计数照样是 2、模板照样匹配，却把包裹换成了同模块另一个导出，
  //    实测回调一次都没被调用（bodyCalls=0 / eventCount=0，运行时侧证见
  //    fix-probes/m4-evaluation-timing.probe.mjs 的 aliasedSubstituteForm）。
  //    故收紧成两条：全文任何 import 都不许出现「as <目标名>」；
  //    目标名必须是对应模块 import 花括号里的一条**独立 specifier 裸形**（逗号分隔、左右无 as）。
  assert(!/\bimport\s+\*\s+as\b/.test(record),
    'record CLI 不得用命名空间导入（import * as）——拼名取函数会绕开原始字节计数纪律');
  for (const [moduleSpecifier, name] of [
    ['../lib/teachin/replayability-cycle-entry.mjs', 'runRecordedTeachinReplayabilityCycle'],
    ['../lib/teachin/cycle-evidence-context.mjs', 'runWithCycleEvidence'],
  ]) {
    assert(!new RegExp(`\\bas\\s+${name}\\b`).test(record),
      `全文任何 import 都不许把别的导出别名成「${name}」——别名改写不用转义就能把包裹换成另一个函数`);
    const escaped = moduleSpecifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const statement = record.match(
      new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*'${escaped}'`, 's'),
    );
    assert(statement, `「${name}」必须从 ${moduleSpecifier} 具名导入（花括号形）`);
    const specifiers = statement[1].split(',').map((row) => row.trim()).filter(Boolean);
    assert(specifiers.includes(name),
      `「${name}」必须是该 import 花括号里的一条独立 specifier 裸形（逗号分隔、不许 as 改写），实得 ${JSON.stringify(specifiers)}`);
  }
});

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
