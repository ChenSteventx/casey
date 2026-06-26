#!/usr/bin/env node
// 冻结黄金标准（S2）：意图到 atomId 编译门 —— Casey 复制并参数化 regress _flow-authoring 的双闸。
// 契约钉死 lib/compile-gate.mjs 导出：
//   validateDraft(draft, { prefix, registry }) -> { ok: boolean, problems: string[] }
//   闸一(结构)：atomId 在册 / 必填参数齐 / 类型对 / 无未声明参数；
//   闸二(状态机)：requires⊆当前集 / 互斥组 / 实体名带【注入 prefix】前缀(参数化，非写死 ctxtest_)。
// hermetic：纯函数 + 合成 registry。实现前必须红（lib/compile-gate.mjs 不存在 → import 抛）。改本文件 = Test Ratchet 判红。
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const FIX = join(HERE, 'fixtures', 'p2', 'compile-cases.json');
const fail = (m) => { console.error(`RED  p2-compile-gate: ${m}`); process.exit(1); };

let validateDraft;
try {
  // Windows 下动态 import 绝对路径须经 file:// URL，否则 'd:' 协议报错——不修则实现后仍红、永远转不绿。
  ({ validateDraft } = await import(pathToFileURL(join(ROOT, 'lib', 'compile-gate.mjs')).href));
} catch (e) {
  fail(`import lib/compile-gate.mjs 失败（实现前预期红）：${String(e.message).slice(-200)}`);
}
if (typeof validateDraft !== 'function') fail('lib/compile-gate.mjs 未导出 validateDraft 函数');

const { registry, cases } = JSON.parse(readFileSync(FIX, 'utf8'));
let n = 0;
for (const c of cases) {
  const r = validateDraft(c.draft, { prefix: c.prefix, registry });
  if (!r || typeof r.ok !== 'boolean' || !Array.isArray(r.problems)) fail(`case「${c.name}」: 返回须为 {ok:boolean, problems:string[]}`);
  if (r.ok !== c.okWant) fail(`case「${c.name}」(${c.why}): 期望 ok=${c.okWant}，实际 ${r.ok}；problems=${JSON.stringify(r.problems).slice(0, 240)}`);
  if (!c.okWant && r.problems.length === 0) fail(`case「${c.name}」: 期望被拒却无 problems 说明（fail-closed 须给出原因）`);
  n++;
}
console.log(`ok   p2-compile-gate: ${n}/${cases.length} 双闸 case 全中`);
process.exit(0);
