#!/usr/bin/env node
// 冻结黄金标准（S1）：错误信封判定按 channel 参数化 —— Heren 实测信封是 {status:200,msg,data}，成功=status===200，
// 不是 design 旧假设的 code!=0。契约钉死 lib/forensics.mjs 导出纯函数：
//   checkErrorEnvelope(body, { successField, successValue }) -> { field, expected, actual, ok }
// hermetic：纯函数、零 page、零网络。实现前必须红（lib/forensics.mjs 不存在 → import 抛）。改本文件 = Test Ratchet 判红。
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const fail = (m) => { console.error(`RED  p2-forensics: ${m}`); process.exit(1); };

let checkErrorEnvelope;
try {
  // Windows 下动态 import 绝对路径须经 file:// URL，否则 'd:' 协议报错——不修则实现后仍红、永远转不绿。
  ({ checkErrorEnvelope } = await import(pathToFileURL(join(ROOT, 'lib', 'forensics.mjs')).href));
} catch (e) {
  fail(`import lib/forensics.mjs 失败（实现前预期红）：${String(e.message).slice(-200)}`);
}
if (typeof checkErrorEnvelope !== 'function') fail('lib/forensics.mjs 未导出 checkErrorEnvelope 函数');

const cases = [
  { name: 'heren_success', body: { status: 200, msg: '操作成功', data: 'x' }, cfg: { successField: 'status', successValue: 200 }, okWant: true },
  { name: 'heren_fail_500', body: { status: 500, msg: '系统异常' }, cfg: { successField: 'status', successValue: 200 }, okWant: false },
  { name: 'heren_soft_fail', body: { status: 401, msg: '未授权' }, cfg: { successField: 'status', successValue: 200 }, okWant: false },
  { name: 'other_channel_code', body: { code: 0, message: 'ok' }, cfg: { successField: 'code', successValue: 0 }, okWant: true },
  { name: 'other_channel_code_fail', body: { code: 1, message: 'err' }, cfg: { successField: 'code', successValue: 0 }, okWant: false },
  { name: 'missing_field', body: { msg: 'no status here' }, cfg: { successField: 'status', successValue: 200 }, okWant: false }
];
let n = 0;
for (const c of cases) {
  const r = checkErrorEnvelope(c.body, c.cfg);
  if (!r || typeof r.ok !== 'boolean') fail(`case「${c.name}」: 返回缺 ok 布尔`);
  if (r.ok !== c.okWant) fail(`case「${c.name}」: 期望 ok=${c.okWant}，实际 ${r.ok}（成功字段 ${c.cfg.successField}===${c.cfg.successValue}）`);
  n++;
}
console.log(`ok   p2-forensics: ${n}/${cases.length} 信封参数化 case 全中`);
process.exit(0);
