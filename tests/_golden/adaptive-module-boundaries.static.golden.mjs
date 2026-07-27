#!/usr/bin/env node
// S1/S2 自适应执行核心的静态边界门：零 browser/server/SUT。
// 计划内核心文件缺失即 RED；逐文件不得超过 600 行；依赖图不得成环或让纯模块反向依赖执行面。
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const failures = [];
let passed = 0;

function check(checkId, name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok   ${checkId} ${name}`);
  } catch (error) {
    failures.push(`${checkId} ${name}: ${String(error?.message || error).slice(-1200)}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const S2_CORE = [
  'lib/zero-shot/step-contract.mjs',
  'lib/zero-shot/playwright-page-driver.mjs',
  'lib/zero-shot/affordance-authority.mjs',
  'lib/zero-shot/affordance-catalog.mjs',
  'lib/zero-shot/page-observer.mjs',
  'lib/zero-shot/deterministic-resolver.mjs',
  'lib/zero-shot/action-proposal.mjs',
  'lib/zero-shot/action-admission.mjs',
  'lib/zero-shot/step-executor.mjs',
  'lib/zero-shot/progress-verifier.mjs',
  'lib/zero-shot/exploration-trace.mjs',
  'lib/zero-shot/single-step-runner.mjs',
];

const S1_REQUIRED = [
  'lib/adaptive-execution/setup-flow.mjs',
  'lib/adaptive-execution/setup-receipt.mjs',
  'lib/adaptive-execution/setup-barrier.mjs',
  'lib/adaptive-execution/setup-main-admission.mjs',
  'lib/adaptive-execution/setup-receipt-shape.mjs',
];

const SHARED_TOUCHED = [
  'lib/intent-plan.mjs',
];

function discoverSetupSupport() {
  const dir = resolve(ROOT, 'lib/adaptive-execution');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.startsWith('setup-') && extname(name) === '.mjs')
    .sort()
    .map((name) => `lib/adaptive-execution/${name}`);
}

function sourceOf(rel) {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

function lineCount(source) {
  if (!source) return 0;
  const count = source.split(/\r?\n/).length;
  return /\r?\n$/.test(source) ? count - 1 : count;
}

function importSpecifiers(source) {
  const out = [];
  const patterns = [
    /\b(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) out.push(match[1]);
  }
  return out;
}

function resolveLocalImport(fromRel, specifier) {
  if (!specifier.startsWith('.')) return null;
  const absolute = resolve(ROOT, dirname(fromRel), specifier);
  return relative(ROOT, absolute).replaceAll('\\', '/');
}

function findCycle(graph) {
  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  const visit = (node) => {
    if (visiting.has(node)) {
      const start = stack.indexOf(node);
      return [...stack.slice(start), node];
    }
    if (visited.has(node)) return null;
    visiting.add(node);
    stack.push(node);
    for (const next of graph.get(node) || []) {
      const cycle = visit(next);
      if (cycle) return cycle;
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
    return null;
  };
  for (const node of graph.keys()) {
    const cycle = visit(node);
    if (cycle) return cycle;
  }
  return null;
}

// sourceObligationId:zs-boundary-d1 unitCheckId:adaptive-module-boundaries-d1
check('adaptive-module-boundaries-d1', '计划内 S2 核心与 S1 receipt/support 文件完整在场', () => {
  const discovered = discoverSetupSupport();
  const missing = [...S2_CORE, ...S1_REQUIRED, ...SHARED_TOUCHED]
    .filter((rel) => !existsSync(resolve(ROOT, rel)));
  assert(missing.length === 0, `计划内核心文件缺失：${missing.join(', ')}`);
  for (const rel of discovered) {
    assert(S1_REQUIRED.includes(rel), `出现未纳入冻结清单的 setup support：${rel}`);
  }
  for (const rel of S1_REQUIRED) {
    assert(discovered.includes(rel), `S1 setup support 未被目录发现：${rel}`);
  }
});

// sourceObligationId:zs-boundary-d2 unitCheckId:adaptive-module-boundaries-d2
check('adaptive-module-boundaries-d2', '全部 S2 核心与 S1 被修改核心逐文件不超过 600 行', () => {
  const files = [...new Set([
    ...S2_CORE,
    ...S1_REQUIRED,
    ...SHARED_TOUCHED,
    ...discoverSetupSupport(),
  ])];
  const missing = files.filter((rel) => !existsSync(resolve(ROOT, rel)));
  assert(missing.length === 0, `无法检查缺失文件：${missing.join(', ')}`);
  const oversized = files
    .map((rel) => ({ rel, lines: lineCount(sourceOf(rel)) }))
    .filter((item) => item.lines > 600);
  assert(oversized.length === 0,
    `核心文件超过 600 行：${oversized.map((item) => `${item.rel}=${item.lines}`).join(', ')}`);
});

// sourceObligationId:zs-boundary-d3 unitCheckId:adaptive-module-boundaries-d3
check('adaptive-module-boundaries-d3', '纯模块不直接依赖 Playwright、IO、网络或正式 replay/verdict 执行面', () => {
  const pureFiles = [
    'lib/zero-shot/step-contract.mjs',
    'lib/zero-shot/deterministic-resolver.mjs',
    'lib/zero-shot/action-proposal.mjs',
    'lib/zero-shot/progress-verifier.mjs',
    'lib/zero-shot/exploration-trace.mjs',
  ];
  const forbiddenFragments = [
    'playwright',
    'node:fs',
    'node:http',
    'node:https',
    'node:net',
    'node:tls',
    'node:dgram',
    '/bin/',
    'bin/replay',
    'replay-actions',
    'compile-atoms',
    'verdict',
    'page-observer',
    'playwright-page-driver',
    'step-executor',
    'single-step-runner',
  ];
  const violations = [];
  for (const rel of pureFiles) {
    assert(existsSync(resolve(ROOT, rel)), `纯模块缺失：${rel}`);
    for (const specifier of importSpecifiers(sourceOf(rel))) {
      if (forbiddenFragments.some((fragment) => specifier.includes(fragment))) {
        violations.push(`${rel} -> ${specifier}`);
      }
    }
  }
  assert(violations.length === 0, `纯模块越层依赖：${violations.join(', ')}`);
});

// sourceObligationId:zs-boundary-d4 unitCheckId:adaptive-module-boundaries-d4
check('adaptive-module-boundaries-d4', '浏览器包只准出现在生产 Playwright driver，S2 不反向导入旧 replay 内核', () => {
  const violations = [];
  for (const rel of S2_CORE) {
    assert(existsSync(resolve(ROOT, rel)), `S2 核心缺失：${rel}`);
    for (const specifier of importSpecifiers(sourceOf(rel))) {
      const importsPlaywrightPackage = !specifier.startsWith('.') && specifier.includes('playwright');
      if (importsPlaywrightPackage && rel !== 'lib/zero-shot/playwright-page-driver.mjs') {
        violations.push(`${rel} -> ${specifier}`);
      }
      if (specifier.includes('bin/replay') || specifier.includes('replay-actions')
        || specifier.includes('compile-atoms') || specifier.includes('bin/verdict')) {
        violations.push(`${rel} -> ${specifier}`);
      }
    }
  }
  assert(violations.length === 0, `S2 浏览器/旧内核依赖越界：${violations.join(', ')}`);
});

// sourceObligationId:zs-boundary-d5 unitCheckId:adaptive-module-boundaries-d5
check('adaptive-module-boundaries-d5', 'S2 模块内部依赖图无环且 observer 不越过 catalog 直连 authority', () => {
  const coreSet = new Set(S2_CORE);
  const graph = new Map();
  const violations = [];
  for (const rel of S2_CORE) {
    assert(existsSync(resolve(ROOT, rel)), `S2 核心缺失：${rel}`);
    const local = importSpecifiers(sourceOf(rel))
      .map((specifier) => resolveLocalImport(rel, specifier))
      .filter((target) => target && coreSet.has(target));
    graph.set(rel, local);
    if (rel === 'lib/zero-shot/page-observer.mjs'
      && local.includes('lib/zero-shot/affordance-authority.mjs')) {
      violations.push('page-observer -> affordance-authority');
    }
  }
  const cycle = findCycle(graph);
  if (cycle) violations.push(`cycle:${cycle.join(' -> ')}`);
  assert(violations.length === 0, `S2 依赖方向违规：${violations.join(', ')}`);
});

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.error(`\nadaptive-module-boundaries: ${passed} passed, ${failures.length} failed`);
  process.exit(1);
}

console.log(`\nadaptive-module-boundaries: ${passed}/5 passed`);
