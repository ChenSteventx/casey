#!/usr/bin/env node
// 纯函数验收：不启动浏览器、端口或任何 SUT。
import assert from 'node:assert/strict';
import { validateWorkflowDeleteBindings } from '../../lib/workflow-delete-spec.mjs';

const base = [
  { stepId: 's0', intentId: 'i0', atom: 'workflow.create', action: 'click', text: '确认' },
  { stepId: 's1', intentId: 'i1', atom: 'workflow.deleteByName', action: 'fill', value: 'atl_{{uniqueName}}' },
  { stepId: 's2', intentId: 'i1', atom: 'workflow.deleteByName', action: 'click', text: '删除', value: 'atl_{{uniqueName}}' },
  { stepId: 's3', intentId: 'i1', atom: 'workflow.deleteByName', action: 'click', semantic: { name: '确定' }, value: 'atl_{{uniqueName}}' },
];

assert.deepEqual(validateWorkflowDeleteBindings(base), { ok: true, problems: [] });

const stale = base.map((ev) => ev.stepId === 's2' || ev.stepId === 's3' ? { ...ev, value: undefined } : ev);
assert.deepEqual(validateWorkflowDeleteBindings(stale), {
  ok: false,
  problems: [
    { stepId: 's2', reason: 'missing_target_binding' },
    { stepId: 's3', reason: 'missing_target_binding' },
  ],
});

assert.equal(validateWorkflowDeleteBindings([{ atom: 'workflow.create', action: 'click', text: '确认' }]).ok, true);
console.log('workflow-delete-spec-preflight static golden: PASS（零 SUT 连接）');
