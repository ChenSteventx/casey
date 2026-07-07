// report-exit64.golden.mjs —— report 用法错历史码收敛（2→64）红金牌。实现前红：两处 exit 2。
// C1 bin/report.mjs 缺 --model → exit 64 + stderr 用法行；C2 casey report 空参 → 64（分发面继承核验）。
// 背景：exit 2 与熔断器越阈语义撞车、全仓九 CLI 用法错均 64 唯 report 例外（cli-mcp-face learn:27/:33 挂账兑现）。
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const fails = [];
let pass = 0;
function check(name, fn) { try { fn(); pass++; } catch (e) { fails.push(`${name}: ${e.message}`); } }
const run = (args) => spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 30000 });

check('C1 bin/report.mjs 缺 --model → exit 64 + 用法行', () => {
  const r = run([join(ROOT, 'bin', 'report.mjs')]);
  if (r.status !== 64) throw new Error(`用法错应 exit 64（全仓约定，2 与熔断器撞车），实际 ${r.status}`);
  if (!/用法/.test(r.stderr || '')) throw new Error(`stderr 应含用法行，实际 ${(r.stderr || '').slice(0, 120)}`);
});

check('C2 casey report 空参 → exit 64（分发面继承）', () => {
  const r = run([join(ROOT, 'bin', 'casey.mjs'), 'report']);
  if (r.status !== 64) throw new Error(`casey report 空参应 exit 64（runNode 直通继承子码），实际 ${r.status}`);
});

console.log(`report-exit64 golden: ${pass} 过 / ${fails.length} 败`);
if (fails.length) { for (const f of fails) console.error('  FAIL ' + f); process.exit(1); }
