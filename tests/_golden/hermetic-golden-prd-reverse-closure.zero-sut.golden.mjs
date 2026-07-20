#!/usr/bin/env node
// 全 PRD acceptance 反向闭包：纯静态读取，不运行任何 acceptance/golden/SUT/浏览器。
// 改本文件 = Test Ratchet 判红。
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const LOOP = join(ROOT, 'loop');
const ISOLATION = join(HERE, 'fixtures', 'hermetic-golden-retired', 'isolated-browser-obligations.json');
const SURVIVING = join(HERE, 'fixtures', 'hermetic-golden-retired', 'surviving-unit-cases.json');
const TOMBSTONE_MARKER = 'HERMETIC_GOLDEN_RETIRED_TO_REAL_UAT_TOMBSTONE';
const failures = [];
const fail = (message) => failures.push(message);

function readJson(path, label) {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch (error) { fail(`${label} 不可读/不是合法 JSON：${String(error?.message || error).slice(0, 180)}`); return null; }
}

const prdNames = readdirSync(LOOP).filter((name) => /^prd(?:-.*)?\.json$/.test(name)).sort();
if (prdNames.length === 0) fail('loop/ 下没有可扫描的 PRD');
const refs = [];
for (const name of prdNames) {
  const prd = readJson(join(LOOP, name), name);
  if (!prd) continue;
  for (const story of prd.stories || []) {
    if (!Array.isArray(story.acceptance)) { fail(`${name}#${story.id || '<missing-id>'} acceptance 须为数组`); continue; }
    for (const command of story.acceptance) {
      if (typeof command !== 'string') { fail(`${name}#${story.id || '<missing-id>'} acceptance 只允许字符串命令`); continue; }
      refs.push({ prd: name, storyId: story.id, passes: story.passes, command });
    }
  }
}

let isolated = [];
if (!existsSync(ISOLATION)) {
  fail(`缺 isolation manifest：${relative(ROOT, ISOLATION)}（retain-isolated live executable 尚未形成反向闭包）`);
} else {
  const doc = readJson(ISOLATION, 'isolated-browser-obligations.json');
  isolated = Array.isArray(doc) ? doc : (doc?.obligations || doc?.items || []);
  if (!Array.isArray(isolated) || isolated.length === 0) fail('isolation manifest 须含非空 obligations/items 数组');
}

for (const item of isolated) {
  const executable = item?.executablePath || item?.sourceGolden;
  if (typeof executable !== 'string' || !executable.startsWith('tests/_golden/') || !executable.endsWith('.golden.mjs')) {
    fail(`isolation ${item?.obligationId || '<missing-id>'} 缺规范 live executable 路径`);
    continue;
  }
  if (!['partial', 'none', 'uncertain'].includes(item.coverageRelation)) fail(`${item.obligationId}: isolation coverageRelation 非 partial|none|uncertain`);
  if (item.agentExecution !== 'forbidden' || item.route !== 'human') fail(`${item.obligationId}: isolation 须 agentExecution=forbidden 且 route=human`);
  for (const ref of refs.filter((r) => r.command.includes(executable))) {
    fail(`隔离 live executable 仍被 acceptance 引用：${ref.prd}#${ref.storyId} -> ${executable}`);
  }
}

// 墓碑路径不得留在 true story。marker 从可执行体独立发现，不依赖收据自产集合。
for (const name of readdirSync(HERE).filter((n) => n.endsWith('.golden.mjs')).sort()) {
  const path = join(HERE, name);
  const source = readFileSync(path, 'utf8');
  if (!source.includes(TOMBSTONE_MARKER) || !/^\s*process\.exit\(78\);?\s*$/m.test(source)) continue;
  const repoPath = `tests/_golden/${name}`;
  for (const ref of refs.filter((r) => r.passes === true && r.command.includes(repoPath))) {
    fail(`true story 仍引用墓碑：${ref.prd}#${ref.storyId} -> ${repoPath}`);
  }
}

// 全量存活 unit 由独立冻结账提供。默认要求规范直跑命令；若走聚合测试，账内必须显式给
// prdAcceptanceCommand/aggregationCommand，禁止扫描器自行猜映射。
let surviving = [];
if (!existsSync(SURVIVING)) {
  fail(`缺 surviving unit 闭集：${relative(ROOT, SURVIVING)}`);
} else {
  const doc = readJson(SURVIVING, 'surviving-unit-cases.json');
  surviving = Array.isArray(doc) ? doc : (doc?.cases || doc?.items || doc?.survivors || []);
  if (!Array.isArray(surviving) || surviving.length === 0) fail('surviving-unit-cases 须含非空 cases/items/survivors 数组');
}
const seenUnitTargets = new Set();
for (const item of surviving) {
  const path = item?.unitGoldenPath;
  const checkId = item?.unitCheckId;
  if (typeof path !== 'string' || !path.startsWith('tests/_golden/') || !path.endsWith('.zero-sut.golden.mjs')) {
    fail(`surviving unit ${item?.sourceObligationId || '<missing-id>'} 缺规范 unitGoldenPath`);
    continue;
  }
  if (typeof checkId !== 'string' || !checkId) { fail(`${path}: unitCheckId 缺失`); continue; }
  const target = JSON.stringify([path, checkId]);
  if (seenUnitTargets.has(target)) fail(`surviving unit 复合 target 重复：${target}`);
  seenUnitTargets.add(target);
  const command = item.prdAcceptanceCommand || item.aggregationCommand || `node ${path}`;
  if (typeof command !== 'string' || !command.trim()) { fail(`${path}: 聚合/直跑 acceptance 映射为空`); continue; }
  if (!refs.some((r) => r.passes === true && r.command === command)) fail(`存活 unit 未由 true story 精确承载：${path} -> ${command}`);
}

// 两个历史混引实证保留为正控，防空/漏账让全量循环 vacuous 通过。
for (const command of [
  'node tests/_golden/p5-replay-coverage.golden.mjs',
  'node tests/_golden/layer3-wiring-coverage.golden.mjs',
]) {
  if (!refs.some((r) => r.passes === true && r.command === command)) fail(`存活检查未保持 true story：${command}`);
}

if (failures.length) {
  for (const message of failures) console.error(`RED  prd-reverse-closure: ${message}`);
  process.exit(1);
}
console.log(`ok   prd-reverse-closure: ${prdNames.length} PRD / ${refs.length} acceptance 已闭合`);
