#!/usr/bin/env node
// zero-SUT acceptance：只执行静态确认安全的存活 unit 后继，绝不触碰浏览器或夹具 SUT。
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const MANIFEST = join(ROOT, 'tests/_golden/fixtures/hermetic-golden-retired/surviving-unit-cases.json');
const failures = [];
let passed = 0;

function check(name, fn) {
  try { fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
}

function insideRoot(path) {
  const rel = relative(ROOT, path);
  return rel !== '..' && !rel.startsWith(`..${sep}`) && !rel.startsWith(sep);
}

function assertStaticZeroSut(path, source) {
  const rel = relative(ROOT, path).replaceAll('\\', '/');
  if (!rel.startsWith('tests/_golden/') || !rel.endsWith('.zero-sut.golden.mjs')) {
    throw new Error(`${rel} 不是规范 zero-SUT 路径`);
  }
  const forbidden = [
    /fixtures\/(?:fake|login|chat|publish)-sut\/server\.mjs/,
    /\b(?:chromium|firefox|webkit)\s*\.\s*(?:launch|connect|connectOverCDP)\s*\(/,
    /\b(?:createServer|listen)\s*\(/,
    /['"]--sut['"]/,
    /\bcasey\s+run\b/,
    /\b(?:bin\/)?replay\.mjs\b/,
  ];
  for (const pattern of forbidden) {
    if (pattern.test(source)) throw new Error(`${rel} 命中禁用行为 ${pattern}`);
  }
}

let cases = [];
check('surviving-unit manifest 存在且含原子义务血缘', () => {
  if (!existsSync(MANIFEST)) throw new Error('surviving-unit-cases.json 尚未实现');
  const parsed = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  if (!Array.isArray(parsed.cases) || parsed.cases.length === 0) throw new Error('cases 必须非空');
  const ids = new Set();
  const targets = new Set();
  for (const entry of parsed.cases) {
    if (!entry || typeof entry.sourceObligationId !== 'string' || !entry.sourceObligationId) throw new Error('sourceObligationId 缺失');
    if (ids.has(entry.sourceObligationId)) throw new Error(`重复 sourceObligationId ${entry.sourceObligationId}`);
    ids.add(entry.sourceObligationId);
    const targetKey = JSON.stringify([entry.unitGoldenPath, entry.unitCheckId]);
    if (targets.has(targetKey)) throw new Error(`重复 unit target ${targetKey}`);
    targets.add(targetKey);
  }
  cases = parsed.cases;
});

check('每个 unit 后继先静态证 zero-SUT，再真实执行为绿', () => {
  if (cases.length === 0) throw new Error('没有可执行的 surviving-unit case，拒绝真空通过');
  const runnable = new Map();
  for (const entry of cases) {
    const path = resolve(ROOT, entry.unitGoldenPath);
    if (!insideRoot(path) || !existsSync(path)) throw new Error(`${entry.unitGoldenPath} 不存在或越界`);
    const source = readFileSync(path, 'utf8');
    assertStaticZeroSut(path, source);
    if (!source.includes(entry.sourceObligationId) || !source.includes(entry.unitCheckId)) {
      throw new Error(`${entry.unitGoldenPath} 未携原子义务血缘/检查标识`);
    }
    const run = runnable.get(path) || { repoPath: entry.unitGoldenPath, checkIds: [] };
    run.checkIds.push(entry.unitCheckId);
    runnable.set(path, run);
  }
  // 一个 unit 文件可承载多个独立 unitCheckId；血缘逐 case 校验，但文件只需执行一次。
  // 重复执行整文件既不增加覆盖，还会把原子数误变成运行时长倍率。
  for (const [path, { repoPath, checkIds }] of runnable) {
    const result = spawnSync(process.execPath, [path], { cwd: ROOT, encoding: 'utf8', timeout: 120000 });
    if (result.error || result.status !== 0) {
      throw new Error(`${repoPath} exit=${result.status} ${result.error?.message || ''}`.trim());
    }
    const outputLines = String(result.stdout || '').split(/\r?\n/);
    for (const checkId of checkIds) {
      const prefix = `ok   ${checkId}`;
      if (!outputLines.some((line) => line === prefix || line.startsWith(`${prefix} `))) {
        throw new Error(`${repoPath} 未执行并报告 unitCheckId ${checkId}`);
      }
    }
  }
});

if (failures.length) {
  console.error(`\nhermetic surviving units: ${passed} passed, ${failures.length} failed`);
  process.exit(1);
}
console.log(`\nhermetic surviving units: ${passed}/2 passed`);
