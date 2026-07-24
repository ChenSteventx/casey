#!/usr/bin/env node
// P3 C5 组合树调和：纯数据夹具 + 纯结构准入，零 SUT、零浏览器。

import { requiredFlowEntityBindings } from '../../lib/entity-semantic-lock-preflight.mjs';
import { admitCompileDestructiveContinuity } from '../../lib/entity-destructive-continuity.mjs';
import { buildDeleteByNameOnlyFlow } from './support/p3-compile-c5-flow.mjs';

const failures = [];
let passes = 0;

function check(name, fn) {
  try {
    fn();
    passes += 1;
  } catch (error) {
    failures.push(`${name}: ${String(error && (error.message || error)).slice(-800)}`);
  }
}

const flow = buildDeleteByNameOnlyFlow({ caseId: 'tc_compile_smoke' });

check('C1 C5 flow 只携 deleteByName', () => {
  if (!Array.isArray(flow.steps)) throw new Error('steps 必须为数组');
  const atoms = flow.steps.map((step) => step?.atom);
  if (atoms.length !== 1 || atoms[0] !== 'workflow.deleteByName') {
    throw new Error(`原子闭集须恰为 [workflow.deleteByName]，实际 ${JSON.stringify(atoms)}`);
  }
});

check('C2 删除目标与绑定闭合', () => {
  const step = flow.steps[0];
  if (step.params?.name !== 'atl_{{uniqueName}}') throw new Error('删除目标名必须保留唯一名前缀模板');
  if (step.sourceIntentId !== 'intent_cleanup') throw new Error('sourceIntentId 必须回链 cleanup 意图');
  if (!Array.isArray(step.entityBindings) || step.entityBindings.length !== 1) {
    throw new Error('删除步必须恰一实体绑定');
  }
  const binding = step.entityBindings[0];
  if (binding.candidateId !== 'candidate-wf-main' || binding.role !== 'subject') {
    throw new Error('删除步必须保留 candidate-wf-main/subject 绑定');
  }
  const projected = requiredFlowEntityBindings(flow);
  if (!Array.isArray(projected) || projected.length !== 1) {
    throw new Error(`闭合绑定投影须恰一条，实际 ${Array.isArray(projected) ? projected.length : String(projected?.reason)}`);
  }
  const projectedKeys = Object.keys(projected[0]).sort().join(',');
  if (projectedKeys !== 'candidateId,role,sourceIntentId') {
    throw new Error(`闭合绑定投影键集异常：${projectedKeys}`);
  }
  if (projected[0].sourceIntentId !== 'intent_cleanup'
    || projected[0].candidateId !== 'candidate-wf-main'
    || projected[0].role !== 'subject') {
    throw new Error('闭合绑定必须逐字回链 cleanup/candidate-wf-main/subject');
  }
});

check('C3 无 workflow 身份通道仍 fail-closed', () => {
  const result = admitCompileDestructiveContinuity({ flowSteps: flow.steps, certifiableKinds: [] });
  if (result.ok !== false || result.reason !== 'COMPILE_DESTRUCTIVE_NO_IDENTITY_CHANNEL') {
    throw new Error(`无通道必须具名拒绝，实际 ${JSON.stringify(result)}`);
  }
});

check('C4 声明 workflow 身份通道只通过结构准入', () => {
  const result = admitCompileDestructiveContinuity({ flowSteps: flow.steps, certifiableKinds: ['workflow'] });
  if (result.ok !== true) throw new Error(`良构 workflow 通道应通过结构准入，实际 ${JSON.stringify(result)}`);
});

if (failures.length) {
  for (const failure of failures) console.error(`RED  p3-compile-c5-fixture-isolation: ${failure}`);
  process.exit(1);
}

console.log(`ok   p3-compile-c5-fixture-isolation: ${passes}/4`);
