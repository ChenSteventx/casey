#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..', '..');
const rel = (name) => `docs/plans/sut-503-diagnosis/${name}`;
const checks = [];

function check(label, ok) {
  checks.push({ label, ok: Boolean(ok) });
}

function read(name) {
  const path = resolve(root, rel(name));
  check(`${name} 存在`, existsSync(path));
  if (!existsSync(path)) return '';
  const text = readFileSync(path, 'utf8');
  check(`${name} 非空`, text.trim().length > 0);
  return text;
}

function hasAll(label, text, needles) {
  for (const needle of needles) check(`${label} 含 ${needle}`, text.includes(needle));
}

const plan = read('plan.md');
const baseline = read('evidence/historical-baseline.md');
const live = read('evidence/live-differential.md');
const report = read('defect-report.md');
const adversarial = read('adversarial-analysis.md');

hasAll('plan', plan, ['## 验收标准', '最小技术闭环']);
hasAll('historical baseline', baseline, [
  '/ai-manager/agentPlus/queryPlus',
  '/ai-manager/agent/setup/getAgentDetail',
  'SUT_DEFECT',
  'INCONSISTENT',
]);
hasAll('live differential', live, [
  '前置',
  '变量',
  '/ai-manager/agentPlus/queryPlus',
  '/ai-manager/agent/setup/getAgentDetail',
  '503',
  '清理',
]);
hasAll('defect report', report, [
  '期望',
  '实际',
  '复现',
  '证据',
  'run-2',
  'PASS',
]);
hasAll('adversarial analysis', adversarial, [
  '替代',
  '证伪',
  '未决',
  '归因',
]);

for (const name of [
  'plan.md',
  'evidence/historical-baseline.md',
  'evidence/live-differential.md',
  'defect-report.md',
  'adversarial-analysis.md',
]) {
  if (!existsSync(resolve(root, rel(name)))) continue;
  const lint = spawnSync(
    process.execPath,
    ['bin/casey.mjs', 'lint', '--file', rel(name)],
    { cwd: root, encoding: 'utf8' },
  );
  check(`${name} 统一语言检查`, lint.status === 0);
}

const failed = checks.filter((row) => !row.ok);
for (const row of checks) {
  console.log(`${row.ok ? '✓' : '✗'} ${row.label}`);
}
console.log(`sut-503-diagnosis package: ${checks.length - failed.length}/${checks.length}`);
process.exit(failed.length === 0 ? 0 : 1);
