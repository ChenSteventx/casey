#!/usr/bin/env node
// 冻结黄金标准（track-F 回归锁）：lib/compile-gate.mjs 的 validateDraft 破坏性硬闸 fail-safe 覆盖 ——
// 真异构评审(codex gpt-5.5)引出的 B4/B5/C3 缺口。自包含：cases 内联、合成迷你 registry、纯 JS 结构校验。
//
// 钉死行为（改 compile-gate.mjs 回退任一即红）：
//   B4 无 states 旁路：registry 无 states 但有 entityNameParam 原子 + 裸名 → ok:false（破坏性硬闸独立于状态机仍拦）；带正确前缀 → ok:true。
//   B5 空/缺实体名：entityNameParam 值为空串 / 缺失 → ok:false（无从证明带前缀，fail-closed）。
//   C3 前缀硬闸边界：prefix='' → ok:false（防 startsWith('') 恒真清零）；prefix 缺失(undefined) → ok:false。
// hermetic：纯函数 + 合成 registry。Windows 动态 import 绝对路径须经 file:// URL。改本文件 = Test Ratchet 判红。
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const fail = (m) => { console.error(`RED  p2-compile-coverage: ${m}`); process.exit(1); };

let validateDraft;
try {
  ({ validateDraft } = await import(pathToFileURL(join(ROOT, 'lib', 'compile-gate.mjs')).href));
} catch (e) {
  fail(`import lib/compile-gate.mjs 失败：${String(e.message).slice(-200)}`);
}
if (typeof validateDraft !== 'function') fail('lib/compile-gate.mjs 未导出 validateDraft 函数');

// 无 states 的注册表：只有一个带 entityNameParam 的破坏性原子；name 必填，专测 B4 旁路。
const regNoStatesRequired = { atoms: { del: { params: { name: { type: 'string', required: true } }, entityNameParam: 'name', destructive: true } } };
// name 非必填：放过闸一，专测破坏性硬闸自身的空/缺实体名 fail-closed（B5）。
const regNoStatesOptional = { atoms: { del: { params: { name: { type: 'string', required: false } }, entityNameParam: 'name', destructive: true } } };

const draft = (params) => ({ id: 'd1', name: '删除用例', category: 'security', steps: [{ atom: 'del', params }] });

const cases = [
  { name: 'B4_no_states_bare_name_blocked', registry: regNoStatesRequired, prefix: 'atl_', okWant: true,
    draft: draft({ name: 'atl_目录X' }), why: '无 states + 带前缀实体名 → 破坏性硬闸放行' },
  { name: 'B4_no_states_bare_name_rejected', registry: regNoStatesRequired, prefix: 'atl_', okWant: false,
    draft: draft({ name: '目录X' }), why: '无 states 注册表里裸名仍被破坏性硬闸拦（不被旁路）' },
  { name: 'B5_empty_entity_name', registry: regNoStatesOptional, prefix: 'atl_', okWant: false,
    draft: draft({ name: '' }), why: '实体名空串 → 无从证明带前缀 → fail-closed' },
  { name: 'B5_missing_entity_name', registry: regNoStatesOptional, prefix: 'atl_', okWant: false,
    draft: draft({}), why: '缺实体名(非必填放过闸一) → 破坏性硬闸自身 fail-closed' },
  { name: 'C3_empty_prefix', registry: regNoStatesRequired, prefix: '', okWant: false,
    draft: draft({ name: 'atl_目录X' }), why: '空前缀会让 startsWith 恒真清零硬闸 → 拒绝' },
  { name: 'C3_undefined_prefix', registry: regNoStatesRequired, prefix: undefined, okWant: false,
    draft: draft({ name: 'atl_目录X' }), why: 'prefix 缺失(undefined) → 非字符串 → 拒绝' },
];

let n = 0;
for (const c of cases) {
  const r = validateDraft(c.draft, { prefix: c.prefix, registry: c.registry });
  if (!r || typeof r.ok !== 'boolean' || !Array.isArray(r.problems)) fail(`case「${c.name}」: 返回须为 {ok:boolean, problems:string[]}`);
  if (r.ok !== c.okWant) fail(`case「${c.name}」(${c.why}): 期望 ok=${c.okWant}，实际 ${r.ok}；problems=${JSON.stringify(r.problems).slice(0, 240)}`);
  if (!c.okWant && r.problems.length === 0) fail(`case「${c.name}」: 期望被拒却无 problems 说明（fail-closed 须给出原因）`);
  n++;
}
console.log(`ok   p2-compile-coverage: ${n}/${cases.length} 破坏性硬闸覆盖 case 全中`);
process.exit(0);
