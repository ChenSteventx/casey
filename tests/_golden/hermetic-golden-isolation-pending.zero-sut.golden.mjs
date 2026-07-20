#!/usr/bin/env node
// 静态隔离闸：证明历史行为金牌已进入人工路由账，然后以 exit 78 保持旧 story 非绿。
// 不 import、spawn 或执行任何旧 golden/SUT/browser。
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const manifestPath = resolve(HERE, 'fixtures', 'hermetic-golden-retired', 'isolated-browser-obligations.json');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

if (!existsSync(manifestPath)) {
  console.error('isolation-pending: 隔离账缺失（fail-closed）');
  process.exit(65);
}

let obligations;
try {
  obligations = JSON.parse(readFileSync(manifestPath, 'utf8')).obligations;
} catch {
  console.error('isolation-pending: 隔离账不可读（fail-closed）');
  process.exit(65);
}

if (!Array.isArray(obligations) || obligations.length === 0) {
  console.error('isolation-pending: 隔离账为空（fail-closed）');
  process.exit(65);
}

const bySource = Map.groupBy(obligations, (row) => row?.sourceGolden);
for (const [sourceGolden, rows] of bySource) {
  if (typeof sourceGolden !== 'string' || !sourceGolden.startsWith('tests/_golden/') || !sourceGolden.endsWith('.golden.mjs')) {
    console.error('isolation-pending: 隔离源路径非法（fail-closed）');
    process.exit(65);
  }
  const sourcePath = resolve(ROOT, sourceGolden);
  if (!existsSync(sourcePath)) {
    console.error('isolation-pending: 隔离源缺失（fail-closed）');
    process.exit(65);
  }
  const digest = sha256(readFileSync(sourcePath));
  if (rows.some((row) => row.agentExecution !== 'forbidden'
    || row.route !== 'human'
    || !['partial', 'none', 'uncertain'].includes(row.coverageRelation)
    || row.originalFileSha256 !== digest)) {
    console.error('isolation-pending: 隔离路由或源摘要漂移（fail-closed）');
    process.exit(65);
  }
}

console.error(`isolation-pending: ${obligations.length} 条义务 / ${bySource.size} 个 live executable 等待 route:human`);
process.exit(78);
