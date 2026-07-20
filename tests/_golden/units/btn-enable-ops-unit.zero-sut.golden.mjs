#!/usr/bin/env node
// btn-enable-ops 的纯存活覆盖；C4/C5 浏览器回放与 C5-shape-gate 仍留原金牌隔离。
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateAssertions } from '../../../lib/replay-assert.mjs';
import { synthesizeSkeleton } from '../../../lib/assertion-draft.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..');
const CHECK = join(ROOT, 'bin', 'check.mjs');
const failures = [];
let passed = 0;

function check(unitCheckId, name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok   ${unitCheckId} ${name}`);
  } catch (error) {
    failures.push(`${unitCheckId} ${name}: ${String(error?.message || error).slice(-500)}`);
  }
}

function vocab(kind, op) {
  return spawnSync(process.execPath, [CHECK, '--kind', kind, '--op', op, '--value', 'x', '--validate-only'], {
    encoding: 'utf8',
    timeout: 60000,
  }).status;
}

// sourceObligationId:hg-btn-enable-ops-c1 unitCheckId:btn-enable-ops-unit-c1
// lifecycle-successor: {"sourceObligationId":"hg-btn-enable-ops-c1","unitCheckId":"btn-enable-ops-unit-c1"}
check('btn-enable-ops-unit-c1', 'buttonState 词表四 op 合法且保持封闭', () => {
  for (const op of ['present', 'absent', 'enabled', 'disabled']) {
    const status = vocab('buttonState', op);
    if (status !== 0) throw new Error(`buttonState ${op} 应合法（exit 0），实际 ${status}`);
  }
  if (vocab('buttonState', 'startsWith') === 0) throw new Error('buttonState startsWith 应仍拒（词表封闭）');
});

// sourceObligationId:hg-btn-enable-ops-c2 unitCheckId:btn-enable-ops-unit-c2
// lifecycle-successor: {"sourceObligationId":"hg-btn-enable-ops-c2","unitCheckId":"btn-enable-ops-unit-c2"}
check('btn-enable-ops-unit-c2', 'buttonState enabled/disabled 评估矩阵及异常证据 fail-safe', () => {
  const one = (op, value, collected) => evaluateAssertions([
    { kind: 'buttonState', op, value, soft: false },
  ], collected)[0];
  const allDisabled = { buttonHits: { 导出: 2 }, buttonSeen: 5, buttonDisabledHits: { 导出: 2 } };
  if (one('disabled', '导出', allDisabled).ok !== true) throw new Error('全禁应判 disabled true');
  if (one('enabled', '导出', allDisabled).ok !== false) throw new Error('全禁不得判 enabled');

  const allEnabled = { buttonHits: { 保存: 1 }, buttonSeen: 5, buttonDisabledHits: { 保存: 0 } };
  if (one('enabled', '保存', allEnabled).ok !== true) throw new Error('全可用应判 enabled true');
  if (one('disabled', '保存', allEnabled).ok !== false) throw new Error('全可用不得判 disabled');

  const mixed = { buttonHits: { 发布: 2 }, buttonSeen: 5, buttonDisabledHits: { 发布: 1 } };
  if (one('enabled', '发布', mixed).ok !== false || one('disabled', '发布', mixed).ok !== false) {
    throw new Error('混合态双 op 均不得判真');
  }
  const zero = { buttonHits: { 幽灵: 0 }, buttonSeen: 5, buttonDisabledHits: { 幽灵: 0 } };
  if (one('enabled', '幽灵', zero).ok !== false || one('disabled', '幽灵', zero).ok !== false) {
    throw new Error('零命中双 op 均不得判真');
  }
  const noCapture = { buttonHits: { 导出: 1 }, buttonSeen: 5 };
  const noCaptureResult = one('disabled', '导出', noCapture);
  if (noCaptureResult.ok !== false || noCaptureResult.actual !== null) {
    throw new Error(`缺 buttonDisabledHits 应 false/null，实际 ${JSON.stringify(noCaptureResult)}`);
  }
  const withActual = one('disabled', '导出', allDisabled);
  if (withActual.actual !== 'hits=2,disabled=2') throw new Error(`actual 应为复合标量，实际 ${withActual.actual}`);

  const nanHits = { buttonHits: { 幽灵: Number.NaN }, buttonSeen: 5, buttonDisabledHits: { 幽灵: 0 } };
  if (one('enabled', '幽灵', nanHits).ok !== false) throw new Error('hits=NaN 不得判 enabled');
  const negativeDisabled = { buttonHits: { 导出: 1 }, buttonSeen: 5, buttonDisabledHits: { 导出: -1 } };
  if (one('disabled', '导出', negativeDisabled).ok !== false) throw new Error('disabledHits 负数不得判真');
  const overDisabled = { buttonHits: { 导出: 1 }, buttonSeen: 5, buttonDisabledHits: { 导出: 2 } };
  if (one('disabled', '导出', overDisabled).ok !== false || one('enabled', '导出', overDisabled).ok !== false) {
    throw new Error('disabledHits>hits 异常态双 op 均不得判真');
  }
});

// sourceObligationId:hg-btn-enable-ops-c3 unitCheckId:btn-enable-ops-unit-c3
// lifecycle-successor: {"sourceObligationId":"hg-btn-enable-ops-c3","unitCheckId":"btn-enable-ops-unit-c3"}
check('btn-enable-ops-unit-c3', 'buttonState 三种 state 硬映射且不落 pending', () => {
  const observed = { caseId: 'tc_x', steps: [{ intentId: 'intent_1', urlPathnameAfter: '/a/b' }] };
  const atoms = [
    { intentId: 'intent_1', atom: 'assert.buttonState', params: { name: '导出', state: 'disabled' } },
    { intentId: 'intent_1', atom: 'assert.buttonState', params: { name: '保存', state: 'enabled' } },
    { intentId: 'intent_1', atom: 'assert.buttonState', params: { name: '发布', state: 'present' } },
  ];
  const draft = synthesizeSkeleton(observed, atoms);
  const expected = draft.intents.find((intent) => intent.intentId === 'intent_1')?.expected || [];
  for (const [op, value] of [['disabled', '导出'], ['enabled', '保存'], ['present', '发布']]) {
    if (!expected.some((assertion) => assertion.kind === 'buttonState' && assertion.op === op && assertion.value === value)) {
      throw new Error(`state ${op} 应硬映射，实际 expected=${JSON.stringify(expected)} pending=${JSON.stringify(draft.pending)}`);
    }
  }
  if ((draft.pending || []).some((entry) => entry.atom === 'assert.buttonState')) {
    throw new Error('enabled/disabled 不得再落 pending');
  }
});

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.error(`btn-enable-ops unit: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`btn-enable-ops unit: ${passed}/${passed} passed`);
