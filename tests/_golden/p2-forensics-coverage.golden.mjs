#!/usr/bin/env node
// 冻结黄金标准（track-F 回归锁）：lib/forensics.mjs 的 checkErrorEnvelope fail-safe 覆盖 ——
// 真异构评审(codex gpt-5.5)引出的 B6 信封 fail-closed + A1 凭据红线缺口。自包含：cases 内联、纯函数校验。
//
// 钉死行为（改 forensics.mjs 回退任一即红）：
//   B6 信封 fail-closed：缺 successValue → ok:false；body 缺字段 → ok:false；空白 successField → ok:false；正常配置 → ok:true。
//      （原版 actual===undefined===successValue 会把软失败信封假洗成 ok:true。）
//   A1 凭据红线：successField 命中敏感字段名(token 等) → ok:false 且 actual===undefined（绝不读取/回传凭据值）。
// hermetic：纯函数、零 page、零网络。Windows 动态 import 绝对路径须经 file:// URL。改本文件 = Test Ratchet 判红。
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const fail = (m) => { console.error(`RED  p2-forensics-coverage: ${m}`); process.exit(1); };

let checkErrorEnvelope;
try {
  ({ checkErrorEnvelope } = await import(pathToFileURL(join(ROOT, 'lib', 'forensics.mjs')).href));
} catch (e) {
  fail(`import lib/forensics.mjs 失败：${String(e.message).slice(-200)}`);
}
if (typeof checkErrorEnvelope !== 'function') fail('lib/forensics.mjs 未导出 checkErrorEnvelope 函数');

// ---- B6 信封 fail-closed ----
const b6 = [
  // 缺 successValue + body 缺该字段：原版 actual===undefined===successValue 会假判 ok:true（fail-open）。须 fail-closed。
  { name: 'B6_missing_successValue', body: { msg: 'no status here' }, cfg: { successField: 'status' }, okWant: false,
    why: '缺 successValue → actual===undefined===successValue 假命中口子须封死' },
  // 空白 successField + 缺 successValue：原版把 '   ' 当合法字段、取不到值=undefined===undefined → 假 ok:true。
  { name: 'B6_blank_successField', body: { status: 200 }, cfg: { successField: '   ' }, okWant: false,
    why: '空白 successField → 不得当合法字段、不得假 ok' },
  // 配置齐但 body 缺字段（present 检查）：成功值有定义时也须 fail-closed。
  { name: 'B6_body_missing_field', body: { msg: 'no status here' }, cfg: { successField: 'status', successValue: 200 }, okWant: false,
    why: 'body 缺成功字段 → present 检查 fail-closed' },
  { name: 'B6_normal_ok', body: { status: 200, msg: 'ok' }, cfg: { successField: 'status', successValue: 200 }, okWant: true,
    why: '正常配置 + 命中成功值 → ok:true' },
];

let n = 0;
for (const c of b6) {
  const r = checkErrorEnvelope(c.body, c.cfg);
  if (!r || typeof r.ok !== 'boolean') fail(`case「${c.name}」: 返回缺 ok 布尔`);
  if (r.ok !== c.okWant) fail(`case「${c.name}」(${c.why}): 期望 ok=${c.okWant}，实际 ${r.ok}`);
  n++;
}

// ---- A1 凭据红线：successField 误配成敏感字段名 → 不读/不回传值 ----
const SECRET = 'super-secret-value-DO-NOT-LEAK';
const sensitiveFields = ['token', 'access_token', 'authorization', 'apikey', 'session', 'password'];
for (const field of sensitiveFields) {
  const body = { [field]: SECRET, status: 200 };
  // successValue 是配置的期望值(非凭据)；红线在于绝不读取 body 里该敏感字段的真实值(SECRET)。
  const r = checkErrorEnvelope(body, { successField: field, successValue: 'expected-marker' });
  if (!r || r.ok !== false) fail(`A1 凭据红线 case「${field}」: 敏感字段名须 ok:false，实际 ok=${r && r.ok}`);
  if (r.actual !== undefined) fail(`A1 凭据红线 case「${field}」: actual 须 undefined（不读取凭据），实际 ${JSON.stringify(r.actual)}`);
  if (JSON.stringify(r).includes(SECRET)) fail(`A1 凭据红线 case「${field}」: 返回体泄漏了凭据值`);
  n++;
}

console.log(`ok   p2-forensics-coverage: ${n}/${b6.length + sensitiveFields.length} 信封 fail-closed + 凭据红线 case 全中`);
process.exit(0);
