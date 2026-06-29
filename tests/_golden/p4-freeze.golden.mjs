#!/usr/bin/env node
// 冻结黄金标准（P4）：断言冻结编译 + 人签门确定性骨架。消费已冻接缝 expected.frozen（旁车 fixture）+ bin/check.mjs 词表。
// 钉死两个纯函数模块：
//   lib/expected-compile.mjs : compileExpectedToChecks(expectedFrozen) -> string[]
//     把 intents[].expected[] 与 globalAssertions[] 每条编译成可运行 check 命令字符串（design §5/§8，gate 主循环原样）：
//       node bin/check.mjs --case <caseId> --intent <intentId> --kind <k> --op <op> --value <v>
//     globalAssertions 无 --intent 维度；soft 断言也编译但带 --soft 标记（仍进报告不进裁定，由已冻 verdict.mjs 处理）。
//   lib/sign-gate.mjs : isSigned(frozenAssertion) -> boolean + assertSignedContract(expectedFrozen) -> {ok, problems}
//     每条冻结断言须 signedAt(ISO)/signedAgainstBuild/signerId 齐全且非空，否则未签、裁定流程拒「算数」（design §4.3 人签是分水岭）。
// 验：① 编译条数/形状正确、kind 在已冻 schema 词表内、带 op 的命令 spawn check --validate-only 抽验合法；
//     ② 完整签名 → isSigned 全 true / assertSignedContract ok:true；删一条 signedAt → ok:false（未签拒算数）；
//     ③ soft 断言被编译且标记。
// hermetic：纯函数 + 已冻 fixture/schema + check --validate-only（零 page）。实现前必须红（两个 lib 不存在 → import 抛）。
// 改本文件 = Test Ratchet 判红。Windows 下动态 import 绝对路径须经 file:// URL，否则 'd:' 协议报错。
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CHECK = join(ROOT, 'bin', 'check.mjs');
const FIX = join(HERE, 'fixtures', 'seams', 'expected-frozen.fixture.json');
const SCHEMA = join(HERE, 'schemas', 'expected-frozen.schema.json');
const fail = (m) => { console.error(`RED  p4-freeze: ${m}`); process.exit(1); };

let compileExpectedToChecks, isSigned, assertSignedContract;
try {
  ({ compileExpectedToChecks } = await import(pathToFileURL(join(ROOT, 'lib', 'expected-compile.mjs')).href));
} catch (e) { fail(`import lib/expected-compile.mjs 失败（实现前预期红）：${String(e.message).slice(-200)}`); }
try {
  ({ isSigned, assertSignedContract } = await import(pathToFileURL(join(ROOT, 'lib', 'sign-gate.mjs')).href));
} catch (e) { fail(`import lib/sign-gate.mjs 失败（实现前预期红）：${String(e.message).slice(-200)}`); }
if (typeof compileExpectedToChecks !== 'function') fail('lib/expected-compile.mjs 未导出 compileExpectedToChecks 函数');
if (typeof isSigned !== 'function') fail('lib/sign-gate.mjs 未导出 isSigned 函数');
if (typeof assertSignedContract !== 'function') fail('lib/sign-gate.mjs 未导出 assertSignedContract 函数');

const frozen = JSON.parse(readFileSync(FIX, 'utf8'));
const schema = JSON.parse(readFileSync(SCHEMA, 'utf8'));
const KINDS = new Set(schema.definitions.assertionKind.enum); // kind 词表权威绑已冻 schema

// ───────────── ① 编译形状/条数 ─────────────
const cmds = compileExpectedToChecks(frozen);
if (!Array.isArray(cmds) || cmds.some((c) => typeof c !== 'string')) fail('compileExpectedToChecks 须返回 string[]');
const expectN = frozen.intents.reduce((a, it) => a + it.expected.length, 0) + (frozen.globalAssertions?.length || 0);
if (cmds.length !== expectN) fail(`命令条数：期望 ${expectN}，实际 ${cmds.length}`);

for (const c of cmds) {
  if (!/^node bin\/check\.mjs /.test(c)) fail(`命令前缀不符 §5 形状：${c}`);
  if (!new RegExp(`--case ${frozen.caseId}(?:\\s|$)`).test(c)) fail(`命令缺 --case ${frozen.caseId}：${c}`);
  const km = c.match(/--kind (\S+)/);
  if (!km) fail(`命令缺 --kind：${c}`);
  if (!KINDS.has(km[1])) fail(`命令 kind「${km[1]}」不在已冻 schema 词表内：${c}`);
  // 带 --op 的命令 spawn check --validate-only 抽验合法（kind/op 在 bin/check.mjs 词表内、exit 0）
  const om = c.match(/--op (\S+)/);
  if (om) {
    try { execFileSync(process.execPath, [CHECK, '--kind', km[1], '--op', om[1], '--validate-only'], { stdio: 'pipe' }); }
    catch { fail(`check --validate-only 拒了编译产物 (kind=${km[1]}, op=${om[1]})：${c}`); }
  }
}

// 逐 intent 卷回 intentId；global 无 --intent
for (const it of frozen.intents) {
  const got = cmds.filter((c) => new RegExp(`--intent ${it.intentId}(?:\\s|$)`).test(c)).length;
  if (got !== it.expected.length) fail(`intent ${it.intentId}：期望 ${it.expected.length} 条带 --intent，实际 ${got}`);
}
const globalCmds = cmds.filter((c) => !/--intent /.test(c));
if (globalCmds.length !== (frozen.globalAssertions?.length || 0)) fail(`global（无 --intent）：期望 ${frozen.globalAssertions?.length || 0}，实际 ${globalCmds.length}`);

// ───────────── ③ soft 断言被编译且标记 ─────────────
const softFrozen = {
  caseId: 'tc_soft',
  intents: [{
    intentId: 'i0',
    expected: [{ kind: 'textVisible', op: 'appears', value: 'x', soft: true, signedAt: '2026-01-01T00:00:00Z', signedAgainstBuild: 'b1', signerId: 's1' }],
  }],
};
const softCmds = compileExpectedToChecks(softFrozen);
if (softCmds.length !== 1) fail(`soft 合成用例：期望 1 条命令，实际 ${softCmds.length}`);
if (!/--soft(?:\s|$)/.test(softCmds[0])) fail(`soft 断言未被标记（命令缺 --soft）：${softCmds[0]}`);
if (cmds.some((c) => /--soft(?:\s|$)/.test(c))) fail('fixture 全为硬断言，编译产物不应出现 --soft 标记');

// ───────────── ② 人签门确定性字段校验 ─────────────
const allAssertions = [...frozen.intents.flatMap((it) => it.expected), ...(frozen.globalAssertions || [])];
for (const a of allAssertions) if (isSigned(a) !== true) fail(`完整签名断言被判未签：${JSON.stringify(a).slice(0, 120)}`);
const r1 = assertSignedContract(frozen);
if (!r1 || typeof r1.ok !== 'boolean' || !Array.isArray(r1.problems)) fail('assertSignedContract 须返回 {ok:boolean, problems:string[]}');
if (r1.ok !== true) fail(`完整签名 expected.frozen 期望 ok:true，实际 ${JSON.stringify(r1).slice(0, 200)}`);

const broken = JSON.parse(JSON.stringify(frozen));
delete broken.intents[0].expected[0].signedAt;
if (isSigned(broken.intents[0].expected[0]) !== false) fail('缺 signedAt 的断言 isSigned 应为 false');
const r2 = assertSignedContract(broken);
if (!r2 || r2.ok !== false) fail('删 signedAt 后期望 assertSignedContract ok:false（未签拒算数）');
if (!Array.isArray(r2.problems) || r2.problems.length === 0) fail('未签须给出 problems 落点（fail-closed 须说明原因）');

console.log(`ok   p4-freeze: 编译 ${cmds.length} 条 check 命令（global ${globalCmds.length} 条无 intent）+ soft 标记 + 人签门字段校验全中`);
process.exit(0);
