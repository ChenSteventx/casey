#!/usr/bin/env node
// 冻结（S3）：plan/design 与 ADR-0006 对账的新行为标记。实现前必须红（这些标记尚未写入文档）。
// 检 3 个对账必引入的稳定标记：
//   1. design §2.1 新增 kind noErrorToast（DOM 错误弹窗缺席）；
//   2. design 或 CONTEXT 记下「断言续跑」执行模型（continue-on-failure 这条新约束）；
//   3. bootstrap plan 记下 P3 recorder 降级为「陌生站点孵化」支线（移出 MVP 关键路径）。
// 不查措辞优劣（那归 route:human 评审），只查标记在不在 —— 给对账一个红转绿信号。改本文件 = Test Ratchet 判红。
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const fail = (m) => { console.error(`RED  p2-reconcile: ${m}`); process.exit(1); };
const read = (rel) => { const p = join(ROOT, rel); return existsSync(p) ? readFileSync(p, 'utf8') : ''; };

const design = read('docs/design/txt2testreport-design.md');
const context = read('CONTEXT.md');
const bootstrap = read('docs/plans/bootstrap/plan.md');

const checks = [
  { ok: /noErrorToast/.test(design), miss: 'design §2.1 未见新增 kind noErrorToast' },
  { ok: /断言续跑/.test(design + context), miss: 'design/CONTEXT 未记「断言续跑」执行模型' },
  { ok: /陌生站点孵化/.test(bootstrap), miss: 'bootstrap plan 未记 P3 recorder 降级为陌生站点孵化支线' }
];
const missing = checks.filter((c) => !c.ok).map((c) => c.miss);
if (missing.length) fail(missing.join('；'));
console.log(`ok   p2-reconcile: ${checks.length}/${checks.length} 对账标记到位`);
process.exit(0);
