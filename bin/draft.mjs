#!/usr/bin/env node
// bin/draft.mjs —— 相2 断言草拟薄 CLI（零 LLM）。决策 docs/plans/draft-cli/proposed/GRILL.md G1–G4。
//
//   node bin/draft.mjs <caseId> --observed <f> --compile-report <f> --out-dir <d> [--testcase <f>] [--patch <f>]
//     骨架 = lib/assertion-draft.mjs 的 synthesizeSkeleton；给 --testcase 时改走 authored→compiler 单调合并；
//     assertionAtoms 唯一源 = compile-report.handoff.assertionAtoms；
//     --patch = LLM 补缝文件（[{intentId,kind,op,value,soft?}]，CLI 外产出——本 CLI 是 L0 复核器不产内容）；
//     合并后整份过 validateDraft 闸，违规 exit 65 且不落草稿（半份草稿比没有更危险，fail-closed）。
//     产物 expected.draft-<caseId>.json（未签草稿，含 pending 留痕）；人签冻结不在本 CLI（route:human，design §11 项 1）。
// 退出码：0 成功；64 缺参；65 输入坏/闸拒。所有落盘过 lib/cred-gate.mjs（护栏 #7）。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  mergeAssertionPatches,
  mergeAssertionSources,
  synthesizeSkeleton,
  validateDraft,
} from '../lib/assertion-draft.mjs';
import { credentialGate } from '../lib/cred-gate.mjs';
import { parseTestCase } from '../lib/parse-testcase.mjs';

function parseArgs(argv) {
  const o = { pos: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) o[k] = argv[++i];
      else o[k] = true;
    } else o.pos.push(a);
  }
  return o;
}

// 读失败消毒（output-seal B2）：V8 JSON.parse 报错自带内容片段——observed/compile-report/patch 无输入
// 预扫（patch 是 LLM/人编），原样上抛漏文件内容进 stderr；只报「不是合法 JSON/不可读」，内容不回显。
function readJson(f, label) {
  try { return JSON.parse(readFileSync(f, 'utf8')); }
  catch { console.error(`draft: 读/解析 ${label} 失败（${f}；不是合法 JSON 或不可读，内容不回显）`); process.exit(65); }
}

const args = parseArgs(process.argv.slice(2));
const caseId = args.pos[0];
if (!caseId || !args.observed || !args['compile-report'] || !args['out-dir']) {
  console.error('用法: casey draft <caseId> --observed <f> --compile-report <f> --out-dir <d> [--testcase <f>] [--patch <f>]');
  process.exit(64);
}
// R1-F2：caseId 进产物文件名——限路径安全字符，拒 / .. 等穿越形态（fail-closed）。
if (!/^[A-Za-z0-9_-]+$/.test(caseId)) { console.error('draft: caseId 含非法字符（仅限字母数字_-；原值不回显——CLI 参数在凭据门扫描面外）'); process.exit(65); }
// R1-F3：裸 --patch（无文件值）不得静默忽略——给了旗标就必须给文件。
if (args.patch !== undefined && typeof args.patch !== 'string') { console.error('draft: --patch 须带文件路径'); process.exit(65); }
if (args.testcase !== undefined && typeof args.testcase !== 'string') { console.error('draft: --testcase 须带文件路径'); process.exit(65); }

const observed = readJson(args.observed, '观测现状');
const report = readJson(args['compile-report'], '编译期核验记录');
const testcaseInput = typeof args.testcase === 'string' ? readJson(args.testcase, 'TestCase') : null;
const testcaseGate = testcaseInput ? parseTestCase(testcaseInput, { caseId }) : null;
if (testcaseGate && !testcaseGate.ok) {
  console.error(`draft: TestCase 归一闸拒（${testcaseGate.problems.length} 问题，fail-closed 不落草稿；输入值不回显）`);
  process.exit(65);
}
const testcase = testcaseGate?.testcase || null;
// G3 一致性闸：命令行 caseId 与 observed/compile-report 三方一致（同 compile 先例）；
// R1-F1：compile-report 缺 caseId = 证不出一致，同拒（fail-closed）。
if (observed.caseId !== caseId) { console.error(`draft: caseId 不一致（命令行 ${caseId}；observed 侧值不符，原值不回显——output-seal A6），拒草拟`); process.exit(65); }
if (report.caseId !== caseId) { console.error(`draft: caseId 不一致或缺席（命令行 ${caseId}；compile-report 侧值不符或缺，原值不回显——output-seal A7），拒草拟`); process.exit(65); }
if (testcase && testcase.caseId !== caseId) { console.error(`draft: caseId 不一致或缺席（命令行 ${caseId}；testcase 侧值不符或缺，原值不回显），拒草拟`); process.exit(65); }

const atoms = report?.handoff?.assertionAtoms;
if (!Array.isArray(atoms)) { console.error('draft: compile-report 缺 handoff.assertionAtoms（P4 交接面既定位），拒草拟'); process.exit(65); }

const draft = testcase
  ? mergeAssertionSources({ testcase, observed, assertionAtoms: atoms })
  : synthesizeSkeleton(observed, atoms);

// G2 补缝合并：LLM 补缝草稿（CLI 外产出）逐条并入对应 intent；随后整份过闸。
if (typeof args.patch === 'string') {
  const patches = readJson(args.patch, 'LLM 补缝草稿');
  if (!Array.isArray(patches)) { console.error('draft: --patch 须为断言数组'); process.exit(65); }
  try { mergeAssertionPatches(draft, patches); }
  catch (error) {
    console.error(`draft: ${error instanceof Error ? error.message : '补缝合并失败'}`);
    process.exit(65);
  }
}

const gate = validateDraft(draft);
if (!gate.ok) {
  console.error(`draft: 校验闸拒（${gate.problems.length} 违规，fail-closed 不落草稿）：`);
  for (const p of gate.problems) console.error(`  - ${p}`);
  process.exit(65);
}

// intentId 存在性闸（drafter-patch-intent-guard；置于词表硬闸之后=闸序不动 output-seal F4 冻结面）：
// 草稿 intent 只许挂在 observed 真实 intent 上——此前未知 intentId 会静默新建孤儿 intent，断言冻进
// expected 但回放期永不匹配（real-uat R2 实证：补缝 intent_open/intent_1 错位，裁定退化只剩全局取证）。
// 基准取 observed 全集而非 skeleton 的 intents（后者只含已有断言的 intent，会误杀合法新建）；
// 违例值不回显（output-seal 遮值纪律：patch 是 LLM/人编文件，内容可携任意种子），报序号定位。
{
  const knownIntents = new Set((observed.steps || []).map((s) => s && s.intentId).filter(Boolean));
  const ghosts = draft.intents.map((it, i) => (knownIntents.has(it.intentId) ? null : i)).filter((i) => i !== null);
  if (ghosts.length) {
    console.error(`draft: 存在性闸拒（fail-closed 不落草稿）：草稿 intents[${ghosts.join('],intents[')}] 的 intentId 不存在于 observed intents（值不回显——错位补缝会静默成孤儿断言、回放永不匹配）`);
    process.exit(65);
  }
}

const outFile = join(resolve(String(args['out-dir'])), `expected.draft-${caseId}.json`);
const text = JSON.stringify(draft, null, 2) + '\n';
const cg = credentialGate({ [outFile]: text });
if (!cg.ok) { console.error(`draft: 凭据兜底门拦截（护栏 #7）：${cg.hit}；拒绝落盘`); process.exit(1); }
writeFileSync(outFile, text, 'utf8');

const nIntent = draft.intents.reduce((n, it) => n + it.expected.length, 0);
const nSoft = [...draft.intents.flatMap((it) => it.expected), ...draft.globalAssertions].filter((a) => a.soft === true).length;
console.log(`draft: 草稿落盘 ${outFile}`);
console.log(`  intent 断言 ${nIntent} 条 + 全局取证 ${draft.globalAssertions.length} 条（soft ${nSoft} 条待补实现重签提硬）`);
if (draft.pending.length) {
  console.log(`  pending ${draft.pending.length} 条（映射不出，route:human）：`);
  for (const p of draft.pending) console.log(`    - ${p.intentId ?? '(无)'} ${p.atom}：${p.reason}`);
}
console.log('  下一步：LLM 补缝复核（如未给 --patch）→ 人签冻结 expected.frozen.json（route:human）');
process.exit(0);
