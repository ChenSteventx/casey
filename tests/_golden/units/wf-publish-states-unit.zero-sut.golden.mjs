#!/usr/bin/env node
// wf-publish-states 的纯后继：只承接当前词表、判据、草拟映射与编译注册事实。
// 原 U1 的 known-size=11 已被 inputReadback 入列作废；原 C1 的事件形状/执行接线/observed 余量仍隔离。
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { synthesizeSkeleton } from '../../../lib/assertion-draft.mjs';
import { isCompilableAtom } from '../../../lib/compile-atoms.mjs';
import { evaluateAssertions, IMPLEMENTED_KINDS } from '../../../lib/replay-assert.mjs';

// sourceObligationId:hg-wf-publish-states-u1-buttonstate-membership-unit unitCheckId:wf-publish-states-unit-u1-buttonstate-membership
// lifecycle-successor: {"sourceObligationId":"hg-wf-publish-states-u1-buttonstate-membership-unit","unitCheckId":"wf-publish-states-unit-u1-buttonstate-membership","coverageRelation":"full"}
// sourceObligationId:hg-wf-publish-states-u1-switchstate-not-implemented-unit unitCheckId:wf-publish-states-unit-u1-switchstate-not-implemented
// lifecycle-successor: {"sourceObligationId":"hg-wf-publish-states-u1-switchstate-not-implemented-unit","unitCheckId":"wf-publish-states-unit-u1-switchstate-not-implemented","coverageRelation":"full"}
// sourceObligationId:hg-wf-publish-states-u2 unitCheckId:wf-publish-states-unit-u2
// lifecycle-successor: {"sourceObligationId":"hg-wf-publish-states-u2","unitCheckId":"wf-publish-states-unit-u2","coverageRelation":"full"}
// sourceObligationId:hg-wf-publish-states-u3 unitCheckId:wf-publish-states-unit-u3
// lifecycle-successor: {"sourceObligationId":"hg-wf-publish-states-u3","unitCheckId":"wf-publish-states-unit-u3","coverageRelation":"full"}
// sourceObligationId:hg-wf-publish-states-d1 unitCheckId:wf-publish-states-unit-d1
// lifecycle-successor: {"sourceObligationId":"hg-wf-publish-states-d1","unitCheckId":"wf-publish-states-unit-d1","coverageRelation":"full"}
// sourceObligationId:hg-wf-publish-states-c1-atom-compile-knowledge-membership-unit unitCheckId:wf-publish-states-unit-c1-atom-compile-knowledge-membership
// lifecycle-successor: {"sourceObligationId":"hg-wf-publish-states-c1-atom-compile-knowledge-membership-unit","unitCheckId":"wf-publish-states-unit-c1-atom-compile-knowledge-membership","coverageRelation":"full"}

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..', '..');
const CHECK = join(ROOT, 'bin', 'check.mjs');
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

function validateKindOp(kind, op) {
  return spawnSync(process.execPath, [CHECK, '--kind', kind, '--op', op, '--validate-only'], {
    encoding: 'utf8',
    timeout: 30_000,
  }).status;
}

check('wf-publish-states-unit-u1-buttonstate-membership', () => {
  if (!IMPLEMENTED_KINDS.has('buttonState')) throw new Error('已实现集缺 buttonState');
});

check('wf-publish-states-unit-u1-switchstate-not-implemented', () => {
  if (IMPLEMENTED_KINDS.has('switchState')) throw new Error('switchState 不应在已实现集');
});

check('wf-publish-states-unit-u2', () => {
  for (const op of ['present', 'absent', 'enabled', 'disabled']) {
    if (validateKindOp('buttonState', op) !== 0) throw new Error(`buttonState ${op} 应合法`);
  }
  if (validateKindOp('switchState', 'on') !== 0) throw new Error('switchState on 应仍合法');
});

check('wf-publish-states-unit-u3', () => {
  const one = (op, value, ctx) => evaluateAssertions([{ kind: 'buttonState', op, value }], ctx)[0];
  const p1 = one('present', '发布', { buttonHits: { 发布: 1 }, buttonSeen: 2 });
  if (p1.ok !== true || p1.actual !== 1) throw new Error(`present 命中应 true/1，实际 ${p1.ok}/${p1.actual}`);
  const p0 = one('present', '导出', { buttonHits: { 导出: 0 }, buttonSeen: 2 });
  if (p0.ok !== false || p0.actual !== 0) throw new Error(`present 零命中应 false/0，实际 ${p0.ok}/${p0.actual}`);
  const a0 = one('absent', '导出', { buttonHits: { 导出: 0 }, buttonSeen: 2 });
  if (a0.ok !== true || a0.actual !== 0) throw new Error(`absent 零命中且通道活着应 true/0，实际 ${a0.ok}/${a0.actual}`);
  const aBlind = one('absent', '保存', { buttonHits: { 保存: 0 }, buttonSeen: 0 });
  if (aBlind.ok !== false) throw new Error(`absent 通道全盲应 false，实际 ${aBlind.ok}`);
  const aNoSeen = one('absent', '保存', { buttonHits: { 保存: 0 } });
  if (aNoSeen.ok !== false) throw new Error(`absent 缺活性证据应 false，实际 ${aNoSeen.ok}`);
  const a2 = one('absent', '发布', { buttonHits: { 发布: 2 }, buttonSeen: 2 });
  if (a2.ok !== false || a2.actual !== 2) throw new Error(`absent 有命中应 false/2，实际 ${a2.ok}/${a2.actual}`);
  const unavailable = one('present', '发布', {});
  if (unavailable.ok !== false || unavailable.actual !== null) throw new Error(`缺采集应 false/null，实际 ${unavailable.ok}/${unavailable.actual}`);
  const noDisabledEvidence = one('enabled', '保存', { buttonHits: { 保存: 1 }, buttonSeen: 1 });
  if (noDisabledEvidence.ok !== false || noDisabledEvidence.actual !== null) {
    throw new Error(`enabled 缺禁用态采集应 false/null，实际 ${noDisabledEvidence.ok}/${noDisabledEvidence.actual}`);
  }
  const enabled = one('enabled', '保存', { buttonHits: { 保存: 1 }, buttonSeen: 1, buttonDisabledHits: { 保存: 0 } });
  if (enabled.ok !== true) throw new Error(`enabled 带完整采集应 true，实际 ${enabled.ok}`);
});

check('wf-publish-states-unit-d1', () => {
  const draft = synthesizeSkeleton({ caseId: 'tc_pub_smoke' }, [
    { intentId: 'intent_1', atom: 'assert.buttonState', params: { name: '发布', state: 'present' } },
    { intentId: 'intent_1', atom: 'assert.buttonState', params: { name: '保存', state: 'enabled' } },
    { intentId: 'intent_1', atom: 'assert.buttonState', params: { name: '幽灵', state: 'blinking' } },
  ]);
  const expected = draft.intents.find((intent) => intent.intentId === 'intent_1')?.expected || [];
  for (const [op, value] of [['present', '发布'], ['enabled', '保存']]) {
    const assertion = expected.find((item) => item.kind === 'buttonState' && item.op === op);
    if (!assertion || assertion.value !== value || assertion.soft === true) {
      throw new Error(`state ${op} 应硬映射，实际 ${JSON.stringify(expected)}`);
    }
  }
  if (!(draft.pending || []).some((item) => item.atom === 'assert.buttonState' && item.intentId === 'intent_1')) {
    throw new Error('枚举外 blinking 应落 pending 留痕');
  }
});

check('wf-publish-states-unit-c1-atom-compile-knowledge-membership', () => {
  if (!isCompilableAtom('workflow.publish')) throw new Error('workflow.publish 应在当前编译分派注册中');
  if (isCompilableAtom('workflow.publish.typo')) throw new Error('不存在的 workflow.publish.typo 不应可编译');
});

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.error(`wf-publish-states unit: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`wf-publish-states unit: ${passed}/${passed} passed`);
