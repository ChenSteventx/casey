#!/usr/bin/env node
// term-judge —— 统一语言强制兜底·钩子乙（LLM 评分员外层，只对钩子甲的候选跑）。
// 机制依据：docs/plans/term-guard/plan.md。异构冗余：评分员非 Claude 家族，复用 review 道 DeepSeek/codex 路径。
//
// 职责边界：判 R1（比喻是否必要）/R2（术语是否被裸用比喻）/R4（是否机翻术语）+ 反引号内别名/裸英文的「提及 vs 使用」——
// 都需要语义判断，交给外层 LLM；R3/R6 是确定性查表由 bin/term-guard.mjs 零 LLM 硬拦；R5 已撤硬拦（甲只把裸 CamelCase
// 候选化、不硬拦），均不重复进这里。
// fail-safe 不 fail-open（护栏 #14）：判违例可信才拦；证不出（不确定/评分员不可达）一律路由人写
// loop/inbox.md，绝不当作放行的理由，也绝不自己编一个"可信"结论替人下判断。
// 乙绝不进 bin/verdict.mjs（裁判零 LLM，护栏 #15）——本文件不写 passes/verdict，只吐 exit code + inbox 记录。
//
// 用法：
//   node bin/term-judge.mjs --candidates <file> --stub <violate|uncertain|unreachable> [--inbox <file>]
//   node bin/term-judge.mjs --candidates <file> [--inbox <file>]   （不给 --stub 时走真评分员接入点；未接线前恒 unreachable）
// 退出码：0 干净/已路由人；1 违例（拦）；64 用法错误；70 内部错误。
// 候选文件为空数组 → 不调评分员、不写 inbox、直接放行（省 LLM 调用，也没什么可判的）。

import { readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_INBOX = join(ROOT, 'loop', 'inbox.md');
const STUB_VALUES = ['violate', 'uncertain', 'unreachable'];

function describeCandidate(c) {
  if (c && typeof c === 'object') {
    const bits = [];
    if (c.type) bits.push(`type=${c.type}`);
    if (c.span) bits.push(`span="${c.span}"`);
    if (c.term) bits.push(`term="${c.term}"`);
    if (c.gloss) bits.push(`gloss="${c.gloss}"`);
    if (bits.length) return bits.join(' ');
  }
  return JSON.stringify(c);
}

// ── 打桩：hermetic golden 用它验外层确定性行为，不掺真 LLM 的不确定性 ──────
export function stubJudge(candidates, stub) {
  const summary = candidates.map(describeCandidate).join('；');
  if (stub === 'violate') {
    return { status: 'violate', reason: `打桩=violate（候选 ${candidates.length} 条可信违反 R1/R2/R4 之一）：${summary}` };
  }
  if (stub === 'uncertain') {
    return { status: 'uncertain', reason: `打桩=uncertain（评分员对候选 ${candidates.length} 条把握不足，路由人裁）：${summary}` };
  }
  if (stub === 'unreachable') {
    return { status: 'unreachable', reason: `打桩=unreachable（评分员不可达/报错，fail-safe 兜底路由人）：${summary}` };
  }
  throw new Error(`未知 --stub 值「${stub}」，须为 ${STUB_VALUES.join('|')} 之一`);
}

// ── 真评分员接入点（route:human，密钥未接线）───────────────────────────
// TODO：密钥就绪后接非 Claude 家族评分员（异构冗余，复用 review 道 DeepSeek/codex 路径），
// 判 R1（比喻是否必要）/R2（术语是否被裸用比喻）/R4（是否机翻术语）。
// 在那之前，调用此函数一律安全返回 unreachable——不得假装已实现、不得 fail-open 放行不确定结论。
export async function callRealJudge(candidates) {
  return {
    status: 'unreachable',
    reason: `真 LLM 评分员尚未接线（等待密钥/路径配置，候选 ${candidates.length} 条）—— fail-safe 兜底路由人，不 fail-open。`,
  };
}

function routeToHuman(verdict, inboxPath) {
  const target = inboxPath || DEFAULT_INBOX;
  mkdirSync(dirname(target), { recursive: true });
  const ts = new Date().toISOString();
  appendFileSync(target, `- [term-judge] ${ts} status=${verdict.status} —— ${verdict.reason}\n`);
  return target;
}

// ── CLI ──────────────────────────────────────────────────────────
function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--candidates') opts.candidates = argv[++i];
    else if (a === '--stub') opts.stub = argv[++i];
    else if (a === '--inbox') opts.inbox = argv[++i];
    else if (a === '--help' || a === '-h') opts.help = true;
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.candidates) {
    console.error('用法: term-judge.mjs --candidates <file> [--stub violate|uncertain|unreachable] [--inbox <file>]');
    process.exit(opts.help ? 0 : 64);
  }
  if (opts.stub && !STUB_VALUES.includes(opts.stub)) {
    console.error(`term-judge: --stub 须为 ${STUB_VALUES.join('|')} 之一，收到「${opts.stub}」`);
    process.exit(64);
  }

  let candidates;
  try {
    candidates = JSON.parse(readFileSync(opts.candidates, 'utf8'));
  } catch (e) {
    console.error(`term-judge: 读不到/解析不了 --candidates 指定的文件「${opts.candidates}」—— ${e.message}`);
    process.exit(64);
  }
  if (!Array.isArray(candidates)) {
    console.error('term-judge: --candidates 文件须是 JSON 数组');
    process.exit(64);
  }

  // 空候选：甲没探出任何需要语义判断的信号——不调评分员、不写 inbox、直接放行。
  if (candidates.length === 0) {
    console.log('term-judge: 候选为空，不调用评分员，直接放行。');
    process.exit(0);
  }

  const verdict = opts.stub ? stubJudge(candidates, opts.stub) : await callRealJudge(candidates);

  if (verdict.status === 'violate') {
    console.error(`term-judge: 判违例（拦）—— ${verdict.reason}`);
    process.exit(1);
  }
  // uncertain / unreachable（含真评分员未来任何其它非 violate 状态）：fail-safe 兜底一律路由人，不 fail-open。
  const target = routeToHuman(verdict, opts.inbox);
  console.log(`term-judge: ${verdict.status} —— 路由人（写 ${target}），不拦不放。`);
  process.exit(0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(`term-judge: 内部错误—— ${e.message}`); process.exit(70); });
}
