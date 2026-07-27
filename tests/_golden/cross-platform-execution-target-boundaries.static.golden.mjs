#!/usr/bin/env node
// execution target 模块/接线静态边界门：零 SUT、零 browser、零 network。

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const TAG = 'cross-platform-execution-target-boundaries';
const failures = [];
let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok   ${TAG}: ${name}`);
  } catch (error) {
    failures.push(`${name}: ${String(error?.message || error).slice(-900)}`);
    console.error(`RED  ${TAG}: ${name}: ${String(error?.message || error).slice(-900)}`);
  }
}

function source(rel) {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

function lines(text) {
  const count = text.split(/\r?\n/).length;
  return /\r?\n$/.test(text) ? count - 1 : count;
}

function imports(text) {
  return [
    ...text.matchAll(/\b(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g),
    ...text.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
  ].map((match) => match[1]);
}

const MODULES = [
  'lib/execution-target/policy.mjs',
  'lib/execution-target/authority.mjs',
  'lib/execution-target/runtime.mjs',
  'lib/execution-target/wiring.mjs',
  'lib/execution-target/cli-boundary.mjs',
];
const NAVIGATION_CONSUMERS = [
  'bin/record.mjs',
  'bin/replay.mjs',
  'bin/compile.mjs',
  'lib/login-bootstrap.mjs',
  'lib/compile-atoms.mjs',
];
const STRUCTURAL_FILES = [
  ...readdirSync(resolve(ROOT, 'lib/execution-target'))
    .filter((name) => name.endsWith('.mjs'))
    .map((name) => `lib/execution-target/${name}`),
  'bin/record.mjs',
  'bin/replay.mjs',
  'bin/compile.mjs',
  'bin/doctor.mjs',
  'lib/login-bootstrap.mjs',
  'lib/compile-atoms.mjs',
  ...readdirSync(resolve(ROOT, 'tests/_golden'))
    .filter((name) => name.startsWith('cross-platform-execution-target-') && name.endsWith('.mjs'))
    .map((name) => `tests/_golden/${name}`),
];

check('B1 execution-target 模块完整', () => {
  const missing = MODULES.filter((rel) => !existsSync(resolve(ROOT, rel)));
  assert(missing.length === 0, `模块缺失：${missing.join(', ')}`);
});

check('B1b 本契约所有新增/修改文件逐个不超过 600 行', () => {
  const oversized = [...new Set(STRUCTURAL_FILES)]
    .map((rel) => ({ rel, count: lines(source(rel)) }))
    .filter((item) => item.count > 600);
  assert(oversized.length === 0,
    `本契约新增/修改文件超过 600 行：${oversized.map((item) => `${item.rel}=${item.count}`).join(', ')}`);
});

check('B2 policy/authority 为纯层，不自行读取配置、凭据、网络或浏览器', () => {
  const forbidden = [
    'node:fs',
    'node:http',
    'node:https',
    'node:net',
    'node:tls',
    'node:child_process',
    'playwright',
    'site.json',
    '.auth',
    'loadSite',
    'loadCred',
    'bin/replay',
    'bin/compile',
    'bin/record',
  ];
  const violations = [];
  for (const rel of ['lib/execution-target/policy.mjs', 'lib/execution-target/authority.mjs']) {
    assert(existsSync(resolve(ROOT, rel)), `纯模块缺失：${rel}`);
    for (const specifier of imports(source(rel))) {
      if (forbidden.some((fragment) => specifier.includes(fragment))) {
        violations.push(`${rel} -> ${specifier}`);
      }
    }
    for (const fragment of ['site.json', '.auth/', 'process.env.AT_SITE', 'process.env.AT_CREDS']) {
      if (source(rel).includes(fragment)) violations.push(`${rel} contains ${fragment}`);
    }
  }
  assert(violations.length === 0, `纯层越界：${violations.join(', ')}`);
});

check('B3 runtime 只依赖 execution-target 内部模块，不直接依赖 Playwright/IO/旧内核', () => {
  const rel = 'lib/execution-target/runtime.mjs';
  assert(existsSync(resolve(ROOT, rel)), `runtime 缺失：${rel}`);
  const violations = imports(source(rel)).filter((specifier) => [
    'playwright',
    'node:fs',
    'node:http',
    'node:https',
    'node:net',
    'node:child_process',
    'bin/replay',
    'replay-actions',
    'compile-atoms',
  ].some((fragment) => specifier.includes(fragment)));
  assert(violations.length === 0, `runtime 越界依赖：${violations.join(', ')}`);
});

check('B4 record/replay/compile/doctor 全部接入共享 execution-target 权威', () => {
  const missing = [];
  for (const rel of ['bin/record.mjs', 'bin/replay.mjs', 'bin/compile.mjs', 'bin/doctor.mjs']) {
    if (!imports(source(rel)).some((specifier) => specifier.includes('execution-target'))) {
      missing.push(rel);
    }
  }
  assert(missing.length === 0, `尚未接入 execution-target：${missing.join(', ')}`);
});

check('B5 三条执行面不再用 pathname-only 或 sut/baseUrl 字符串重基址', () => {
  const violations = [];
  for (const rel of ['bin/record.mjs', 'bin/replay.mjs', 'bin/compile.mjs']) {
    const text = source(rel);
    const patterns = [
      /\b(?:sut|baseUrl)\s*\+\s*(?:pathOf|entryPath)\s*\(/,
      /\b(?:sut|baseUrl)\s*\+\s*new URL\s*\([^)]*\)\.pathname/,
      /new URL\s*\([^)]*\)\.pathname\s*;\s*[\s\S]{0,180}\b(?:sut|baseUrl)\s*\+/,
    ];
    if (patterns.some((pattern) => pattern.test(text))) violations.push(rel);
  }
  assert(violations.length === 0, `仍存在旧重基址路径：${violations.join(', ')}`);
});

check('B6 所有导航消费者只调用共享 origin guard，不保留 raw goto/旧重基址', () => {
  const runtime = source('lib/execution-target/runtime.mjs');
  assert(/\bexport\s+(?:async\s+)?function\s+navigateExecutionTargetPage\b/.test(runtime),
    'runtime 必须导出 navigateExecutionTargetPage');
  const violations = [];
  for (const rel of NAVIGATION_CONSUMERS) {
    const text = source(rel);
    const hasImport = imports(text).some((specifier) => specifier.includes('execution-target/runtime'));
    const callCount = [...text.matchAll(/\bnavigateExecutionTargetPage\s*\(/g)].length;
    if (!hasImport || callCount === 0) violations.push(`${rel}:missing-shared-guard`);
    if (/\.goto\s*\(/.test(text)) violations.push(`${rel}:raw-goto`);
    if (/\bpathOfPlaceholder\b|\bthis\.sut\s*\+|\b(?:sut|baseUrl)\s*\+\s*(?:pathOf|entryPath)\s*\(/.test(text)) {
      violations.push(`${rel}:old-rebase`);
    }
  }
  assert(violations.length === 0, `导航未收敛：${violations.join(', ')}`);
});

check('B7 login origin guard 必须出现在任何凭据 fill/click 之前', () => {
  const text = source('lib/login-bootstrap.mjs');
  const guardAt = text.indexOf('navigateExecutionTargetPage(');
  const credentialAt = Math.min(
    ...['.fill(', '.click(']
      .map((needle) => text.indexOf(needle))
      .filter((index) => index >= 0),
  );
  assert(guardAt >= 0, 'loginBootstrap 缺共享 origin guard');
  assert(Number.isFinite(credentialAt) && guardAt < credentialAt,
    'login origin guard 必须先于任何 fill/click');
});

check('B8 三个 CLI 共用脱敏失败输出边界，禁止原样 e.message/stderr 穿透', () => {
  const violations = [];
  for (const rel of ['bin/record.mjs', 'bin/replay.mjs', 'bin/compile.mjs']) {
    const text = source(rel);
    const hasImport = imports(text).some((specifier) => specifier.includes('execution-target/cli-boundary'));
    const hasCall = /\bemitExecutionTargetCliFailure\s*\(/.test(text);
    if (!hasImport || !hasCall) violations.push(`${rel}:missing-cli-boundary`);
    if (/console\.error\([^;\n]*(?:e\.message|stderr)/.test(text)) {
      violations.push(`${rel}:raw-error-output`);
    }
  }
  assert(violations.length === 0, `CLI 输出未封口：${violations.join(', ')}`);
});

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
