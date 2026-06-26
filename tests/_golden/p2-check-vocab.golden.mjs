#!/usr/bin/env node
// 冻结黄金标准（S1）：断言词汇表 + op 约束的越界硬闸。契约钉死 bin/check.mjs 的纯校验模式：
//   node bin/check.mjs --kind <k> --op <op> [--value <v>] --validate-only
//   exit 0 = (kind,op) 合法且在词表内；exit≠0 = 非法 kind / 越界 op（LLM 不准发明自由断言）。
// --validate-only 只查词表合法性、不碰 page（hermetic）。新增 kind：noErrorToast（DOM 错误弹窗缺席）、
//   countChange 支持 op=equals（绝对归 0）。urlPathname 的 op=equals 须人工批准、自动道里非法。
// 实现前必须红（bin/check.mjs 不存在 → 子进程退非 0、合法 case 拿不到 exit 0）。改本文件 = Test Ratchet 判红。
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CHECK = join(ROOT, 'bin', 'check.mjs');
const fail = (m) => { console.error(`RED  p2-check-vocab: ${m}`); process.exit(1); };

// wantOk=true → 期望该 (kind,op) 合法（exit 0）；false → 期望被拒（exit≠0）。
const cases = [
  { args: ['--kind', 'urlPathname', '--op', 'startsWith', '--value', '/x'], wantOk: true },
  { args: ['--kind', 'urlPathname', '--op', 'matches', '--value', '^/x'], wantOk: true },
  { args: ['--kind', 'urlPathname', '--op', 'equals', '--value', '/x'], wantOk: false, why: 'equals 仅人工批准、自动道非法' },
  { args: ['--kind', 'textVisible', '--op', 'appears', '--value', '操作成功'], wantOk: true },
  { args: ['--kind', 'textVisible', '--op', 'equals', '--value', '操作成功'], wantOk: false, why: 'textVisible 取消 equals' },
  { args: ['--kind', 'noErrorToast', '--op', 'absent'], wantOk: true, why: '新增 kind：DOM 错误弹窗缺席' },
  { args: ['--kind', 'noErrorToast', '--op', 'startsWith', '--value', 'x'], wantOk: false, why: 'noErrorToast 无 startsWith op' },
  { args: ['--kind', 'countChange', '--op', 'equals', '--value', '0'], wantOk: true, why: '新增：countChange 绝对归 0' },
  { args: ['--kind', 'countChange', '--op', 'up'], wantOk: true },
  { args: ['--kind', 'noErrorEnvelope', '--op', 'envelopeOk'], wantOk: true },
  { args: ['--kind', 'bogusKind', '--op', 'appears', '--value', 'x'], wantOk: false, why: '词表外 kind' }
];

const runOk = (args) => {
  try { execFileSync(process.execPath, [CHECK, ...args, '--validate-only'], { stdio: 'pipe' }); return true; }
  catch { return false; }
};
let n = 0;
for (const c of cases) {
  const got = runOk(c.args);
  if (got !== c.wantOk) fail(`(${c.args.join(' ')}): 期望 ${c.wantOk ? '合法' : '被拒'}${c.why ? `（${c.why}）` : ''}，实际 ${got ? '合法' : '被拒'}`);
  n++;
}
console.log(`ok   p2-check-vocab: ${n}/${cases.length} 词表/op 越界 case 全中`);
process.exit(0);
