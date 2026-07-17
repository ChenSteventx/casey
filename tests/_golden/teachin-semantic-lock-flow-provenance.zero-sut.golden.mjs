#!/usr/bin/env node
// 冻结验收：flow-bridge 保留手录/自然语言来源 intent 与显式对象角色。
// 只调用纯函数；禁止启动浏览器、网络、fake 或 fixture SUT。

import { buildFlow } from '../../lib/flow-bridge.mjs';

function fail(message) { throw new Error(message); }
const testcase = { caseId: 'tc-flow-provenance', title: '来源保真', steps: [{ intentId: 'source-intent-1' }] };
const mapping = [{
  intentId: 'source-intent-1',
  atom: 'agent.openToolPicker',
  params: { toolName: '天气' },
  entityBindings: [
    { candidateId: 'candidate-agent-1', role: 'source' },
    { candidateId: 'candidate-tool-9', role: 'target' },
  ],
}];
const flow = buildFlow(testcase, mapping);
const step = flow.steps[0];
if (step.sourceIntentId !== 'source-intent-1') fail('flow step 丢失或重写 mapping.intentId 来源');
if (!Array.isArray(step.entityBindings) || step.entityBindings.length !== 2) fail('flow step 丢失对象 bindings');
if (step.entityBindings[0].candidateId !== 'candidate-agent-1' || step.entityBindings[0].role !== 'source') fail('source 身份/角色未原样保留');
if (step.entityBindings[1].candidateId !== 'candidate-tool-9' || step.entityBindings[1].role !== 'target') fail('target 身份/角色未原样保留');
if (step.entityBindings === mapping[0].entityBindings) fail('flow 不得复用调用者可变 bindings 引用');

mapping[0].entityBindings[0].role = 'target';
if (step.entityBindings[0].role !== 'source') fail('flow 的 source/target 角色可被外部 mutation 偷换');

console.log('ok   teachin-semantic-lock-flow-provenance: source intent 与 source/target role 保真（零 SUT）');
