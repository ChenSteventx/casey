#!/usr/bin/env node
// A3 全仓 prd 冻结件漂移扫（护栏 #1 的跨 prd 收口面；stale-green 普查机制化）。
// 只读、零 LLM：逐 loop/prd-*.json 校验 testChecksums 每个冻结件的现字节 sha256。
// 任何缺文件 / 哈希不符 / prd 解析失败都红——含他家契约的漂移：收口时发现即如实报，
// 绝不静默吃（该谁修谁修，本扫描只作证）。
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const dir = join(ROOT, 'loop');
let prds = 0;
let files = 0;
const drifts = [];
for (const name of readdirSync(dir).sort()) {
  if (!/^prd-.*\.json$/.test(name)) continue;
  let doc;
  try {
    doc = JSON.parse(readFileSync(join(dir, name), 'utf8'));
  } catch {
    drifts.push(`${name}: JSON 解析失败`);
    continue;
  }
  prds += 1;
  for (const [rel, expected] of Object.entries(doc.testChecksums || {})) {
    files += 1;
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) {
      drifts.push(`${name}: 缺文件 ${rel}`);
      continue;
    }
    const actual = createHash('sha256').update(readFileSync(abs)).digest('hex');
    if (actual !== expected) drifts.push(`${name}: 漂移 ${rel}`);
  }
}
console.log(`prd-drift-scan: 扫描 ${prds} 个 prd、${files} 个冻结件`);
if (drifts.length) {
  console.error(`prd-drift-scan: 偏离 ${drifts.length} 条：`);
  for (const d of drifts) console.error(` - ${d}`);
  process.exit(1);
}
console.log('prd-drift-scan: 零漂移');
