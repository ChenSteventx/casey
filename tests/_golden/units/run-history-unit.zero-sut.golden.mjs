#!/usr/bin/env node
// run-history U1 的纯后继：静态扫描 verdict.mjs 依赖闭包；不启动/连接 SUT、浏览器或 listener。
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// sourceObligationId:hg-run-history-u1 unitCheckId:run-history-unit-u1
// lifecycle-successor: {"sourceObligationId":"hg-run-history-u1","unitCheckId":"run-history-unit-u1"}

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..');
const failures = [];
let passed = 0;

function check(unitCheckId, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok   ${unitCheckId}`);
  } catch (error) {
    failures.push(`${unitCheckId}: ${String(error?.message || error).slice(-500)}`);
  }
}

check('run-history-unit-u1', () => {
  const seen = new Set();
  const queue = [join(ROOT, 'bin', 'verdict.mjs')];
  const bad = /run-history|run-metrics|runHistory|runMetrics/;
  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    if (bad.test(source)) throw new Error(`${file} 引用了回放历史接缝`);
    for (const match of source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
      queue.push(resolve(dirname(file), match[1]));
    }
  }
  if (seen.size === 0) throw new Error('闭包扫描空');
});

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.error(`run-history unit: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`run-history unit: ${passed}/${passed} passed`);
