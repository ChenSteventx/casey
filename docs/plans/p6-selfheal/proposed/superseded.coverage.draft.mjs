#!/usr/bin/env node
// 草稿 / coverage-add / 未冻 / 未进任何 prd 的 testChecksums —— 接入轻车道 accept 才算数。
//
// 缺口补覆盖：P6 状态机的 superseded（被取代）态此前无 golden。tests/_golden/p6-selfheal.golden.mjs
//   测了 proposed→signed→applied、各 reject 边、以及若干非法跳变，但漏了 supersede→superseded 这条边
//   与 superseded 终态的出边封锁。本草稿是给【已存在且已绿】的 lib/drift-patch.mjs:nextStatus 补回归覆盖，
//   属 coverage-add（对现有实现跑应为绿），不是 red ATDD —— 故不应先红；若它红了，说明实现或本草稿写错。
//
// 被测契约（直接复用现有导出，无需改 lib）：
//   nextStatus(from, event) -> string；非法迁移（终态再迁 / 未知事件）抛错。
//   状态机：proposed --supersede--> superseded、signed --supersede--> superseded；superseded 为终态、无出边。
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..', '..');
const LIB_PATCH = join(ROOT, 'lib', 'drift-patch.mjs');

const fail = (msg) => { console.error(`FAIL p6-superseded-cov: ${msg}`); process.exit(1); };
let checks = 0;
const ok = () => { checks++; };

let nextStatus;
try {
  ({ nextStatus } = await import(`file://${LIB_PATCH.replace(/\\/g, '/')}`));
} catch (e) {
  fail(`无法 import lib/drift-patch.mjs（coverage-add 不应红）：${String(e && e.message).slice(-200)}`);
}
if (typeof nextStatus !== 'function') fail('lib/drift-patch.mjs 未导出 nextStatus 纯函数');

// ============ ① supersede→superseded 合法迁移（proposed/signed 两条入边）============
if (nextStatus('proposed', 'supersede') !== 'superseded') fail('nextStatus: proposed --supersede--> superseded');
if (nextStatus('signed', 'supersede') !== 'superseded') fail('nextStatus: signed --supersede--> superseded');
ok();

// ============ ② superseded 为终态：任何出边均须抛错 ============
for (const event of ['sign', 'apply', 'reject', 'supersede', 'bogus']) {
  let threw = false;
  try { nextStatus('superseded', event); } catch { threw = true; }
  if (!threw) fail(`nextStatus: superseded 为终态，--${event}--> 须抛错（无出边）`);
}
ok();

// ============ ③ 终态不可被取代：取代只发生在 proposed/signed ============
// applied/rejected/superseded 均为终态，--supersede--> 须抛错（不得从终态重新被取代）。
for (const from of ['applied', 'rejected', 'superseded']) {
  let threw = false;
  try { nextStatus(from, 'supersede'); } catch { threw = true; }
  if (!threw) fail(`nextStatus: 终态 ${from} 不可被取代，--supersede--> 须抛错`);
}
ok();

console.log(`ok   p6-superseded-cov: ${checks} 组 superseded 状态迁移覆盖全过（草稿/未冻/未进 testChecksums）`);
process.exit(0);
