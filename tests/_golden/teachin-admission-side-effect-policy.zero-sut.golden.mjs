#!/usr/bin/env node
// 副作用/逐步角色 superseding 金牌：纯函数 + 静态源码；禁止 SUT、浏览器、server、子进程与网络。

import { readFileSync } from 'node:fs';
import * as admission from '../../lib/entity-semantic-lock-preflight.mjs';

const SECTION = process.argv[2] ?? 'all';
const SECTIONS = new Set(['all', 'effects', 'roles', 'provenance', 'hostile']);
if (!SECTIONS.has(SECTION)) process.exit(2);
const policy = JSON.parse(readFileSync(new URL('./fixtures/teachin-admission-side-effect-policy/entity-admission-policy.frozen.json', import.meta.url)));
const registry = JSON.parse(readFileSync(new URL('../../lib/atoms-registry.snapshot.json', import.meta.url)));
const failures = [];
let passed = 0;
function test(section, name, fn) {
  if (SECTION !== 'all' && SECTION !== section) return;
  try { fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
}
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const invalid = (value) => value == null || value?.ok === false || value?.valid === false;
const binding = (role, patch = {}) => ({ candidateId: `candidate-${role}`, role, ...patch });
const frozenBinding = (role, patch = {}) => ({
  stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.create', role,
  candidateId: `candidate-${role}`, lockId: `lock-${role}`,
  receiptHash: `sha256:${'d'.repeat(64)}`, ...patch,
});

test('effects', 'A 五个真实写原子不受 caller flags 影响，flow/events 均不得判只读', () => {
  const writes = policy.atoms.filter((row) => row.effect === 'mutation' && [
    'workflow.addNode', 'workflow.setNodeField', 'workflow.setSwitch',
    'workflow.addNodeInputVar', 'agent.removeToolByName',
  ].includes(row.atom));
  assert(writes.length === 5, '冻结策略未精确列出五写原子');
  for (const { atom } of writes) {
    const attacker = { atom, mutation: false, destructive: false, relationWrite: false, entityBindings: [] };
    assert(admission.flowContainsEntityMutation({ steps: [attacker] }, registry) === true, `${atom} flow 被伪装只读`);
    assert(admission.eventsContainEntityMutation({ events: [attacker] }, registry) === true, `${atom} event 被伪装只读`);
  }
});

test('effects', 'A 显式 read allowlist 与未知默认 mutation 均不由 caller flags/bindings 决定', () => {
  const fakeWriteFlags = {
    atom: 'nav.workflowManagement', mutation: true, destructive: true, relationWrite: true,
    entityBindings: [binding('source')],
  };
  assert(admission.flowContainsEntityMutation({ steps: [fakeWriteFlags] }, registry) === false, 'read allowlist 被 caller flags 改写');
  assert(admission.eventsContainEntityMutation({ events: [fakeWriteFlags] }, registry) === false, 'read event 被 caller flags 改写');
  const unknown = { atom: 'future.unknownAtom', mutation: false, destructive: false, entityBindings: [] };
  assert(admission.flowContainsEntityMutation({ steps: [unknown] }, registry) === true, '未知 flow atom 未默认 mutation');
  assert(admission.eventsContainEntityMutation({ events: [unknown] }, registry) === true, '未知 event atom 未默认 mutation');
});

test('effects', 'A caller 仅传 containsEntityMutation:false 不能取得 browser authority', () => {
  const result = admission.checkCompileIdentityAdmission({
    mode: 'execute', caseId: 'tc-side-effect-policy', containsEntityMutation: false,
  });
  assert(result?.ok === false && result.allowBrowserLaunch === false, `caller boolean 被放行: ${JSON.stringify(result)}`);
});

function flowOf(steps) { return { id: 'flow-policy', steps }; }
function eventDoc(events) { return { schemaVersion: 2, caseId: 'tc-side-effect-policy', events }; }
function assertBothInvalid(label, flowSteps, events) {
  assert(invalid(admission.requiredFlowEntityBindings(flowOf(flowSteps))), `${label} flow 未返回 invalid`);
  assert(invalid(admission.requiredEventEntityBindings(eventDoc(events))), `${label} events 未返回 invalid`);
}

test('roles', 'B 双 mutation 中任一空绑定须逐步拒绝', () => {
  assertBothInvalid('双变更空锁', [
    { atom: 'workflow.create', sourceIntentId: 'source_1', entityBindings: [binding('subject')] },
    { atom: 'workflow.setNodeField', sourceIntentId: 'source_2', entityBindings: [] },
  ], [
    { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.create', entityBindings: [frozenBinding('subject')] },
    { stepId: 'atstep_2', intentId: 'intent_2', atom: 'workflow.setNodeField', entityBindings: [] },
  ]);
});

for (const [label, roles] of [
  ['relation-source-only', ['source']], ['relation-target-only', ['target']],
  ['relation-multi-role', ['source', 'target', 'subject']],
]) {
  test('roles', `B ${label} flow/events 整份拒绝`, () => {
    assertBothInvalid(label,
      [{ atom: 'workflow.bindAgent', sourceIntentId: 'source_rel', entityBindings: roles.map((role) => binding(role)) }],
      [{ stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.bindAgent', entityBindings: roles.map((role) => frozenBinding(role, { atom: 'workflow.bindAgent' })) }]);
  });
}

for (const [label, roles] of [['mutation-empty', []], ['mutation-unknown-role', ['mystery']], ['mutation-multi-role', ['subject', 'target']]]) {
  test('roles', `B ${label} flow/events 整份拒绝`, () => {
    assertBothInvalid(label,
      [{ atom: 'workflow.create', sourceIntentId: 'source_mut', entityBindings: roles.map((role) => binding(role)) }],
      [{ stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.create', entityBindings: roles.map((role) => frozenBinding(role)) }]);
  });
}

test('roles', 'B 合法 relation 保留 source+target，七字段 strict set 不降维', () => {
  const flow = admission.requiredFlowEntityBindings(flowOf([{
    atom: 'workflow.bindAgent', sourceIntentId: 'source_rel', entityBindings: [binding('source'), binding('target')],
  }]));
  const events = admission.requiredEventEntityBindings(eventDoc([{
    stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.bindAgent',
    entityBindings: [frozenBinding('source', { atom: 'workflow.bindAgent' }), frozenBinding('target', { atom: 'workflow.bindAgent' })],
  }]));
  assert(Array.isArray(flow) && flow.length === 2, '合法 relation flow 未保留双端');
  assert(Array.isArray(events) && events.length === 2, '合法 relation events 未保留双端');
  const fields = ['stepId', 'intentId', 'atom', 'role', 'candidateId', 'lockId', 'receiptHash'];
  assert(events.every((row) => fields.every((field) => typeof row[field] === 'string' && row[field])), 'frozen 七字段投影降维');
});

test('roles', 'B subject 是合法 mutation 角色，checker 应到 authority 缺失而非 binding schema 拒绝', () => {
  const execute = admission.checkCompileIdentityAdmission({
    mode: 'execute', caseId: 'tc-side-effect-policy', containsEntityMutation: true,
    flowBytes: Buffer.from('{}'), testcaseBytes: Buffer.from('{}'),
    requiredBindings: [{ sourceIntentId: 'source_1', candidateId: 'candidate-subject', role: 'subject' }],
  });
  assert(execute?.reason === 'PRE_EXECUTION_IDENTITY_AUTHORITY_MISSING_OR_INVALID', `subject 被 binding schema 拒绝: ${JSON.stringify(execute)}`);
});

test('provenance', 'C pure compile projection 逐事件保留 sourceIntentId + candidateId/role，且未签不可 replayReady', () => {
  assert(typeof admission.projectCompileEntityProvenance === 'function', '缺 projectCompileEntityProvenance 纯投影接缝');
  const result = admission.projectCompileEntityProvenance({
    flowStep: { atom: 'workflow.create', params: {}, sourceIntentId: 'natural_intent_1', entityBindings: [binding('subject')] },
    events: [
      { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.create', action: 'click' },
      { stepId: 'atstep_2', intentId: 'intent_1', atom: 'workflow.create', action: 'fill' },
    ],
  });
  assert(result?.ok === true && Array.isArray(result.events) && result.events.length === 2, `投影失败: ${JSON.stringify(result)}`);
  for (const event of result.events) {
    assert(event.sourceIntentId === 'natural_intent_1', 'sourceIntentId 丢失');
    assert(event.entityBindings?.[0]?.candidateId === 'candidate-subject' && event.entityBindings[0].role === 'subject', 'candidate/role 丢失');
    assert(!Object.hasOwn(event.entityBindings[0], 'lockId') && !Object.hasOwn(event.entityBindings[0], 'receiptHash'), 'compile 越权补签锁字段');
    assert(event.replayReady !== true, 'compile 未签 event 被置 replayReady');
  }
});

test('provenance', 'C compile/sign 静态接线保留 provenance，sign 补齐 lockId+receiptHash 后才 replayReady', () => {
  const compile = readFileSync(new URL('../../lib/compile-atoms.mjs', import.meta.url), 'utf8');
  const sign = readFileSync(new URL('../../bin/sign.mjs', import.meta.url), 'utf8');
  assert(compile.includes('projectCompileEntityProvenance'), 'compile 未调用 provenance 纯投影');
  for (const token of ['sourceIntentId', 'entityBindings']) assert(compile.includes(token), `compile 缺 ${token}`);
  for (const token of ['lockId', 'receiptHash', 'replayReady', 'freezeEntityLocks']) assert(sign.includes(token), `sign 未在 frozen 阶段落实 ${token}`);
});

function hostileProxy(counter) {
  return new Proxy({}, {
    get() { counter.count += 1; throw new Error('HOSTILE_GET'); },
    ownKeys() { counter.count += 1; throw new Error('HOSTILE_KEYS'); },
    getOwnPropertyDescriptor() { counter.count += 1; throw new Error('HOSTILE_DESC'); },
  });
}

test('hostile', 'D 顶层与嵌套 Proxy 在 classifier/derivation 前零 trap', () => {
  for (const nested of [false, true]) {
    const counter = { count: 0 };
    const proxy = hostileProxy(counter);
    const flow = nested ? { steps: [proxy] } : proxy;
    const classified = admission.flowContainsEntityMutation(flow, registry);
    const derived = admission.requiredFlowEntityBindings(flow);
    assert(counter.count === 0, `${nested ? '嵌套' : '顶层'} Proxy trap 执行 ${counter.count} 次`);
    assert(classified === true, '敌对 classifier 未 fail-closed mutation');
    assert(invalid(derived), '敌对 derivation 被洗成合法空集');
  }
});

test('hostile', 'D 顶层与嵌套 accessor 在 classifier/derivation 前零 getter', () => {
  for (const nested of [false, true]) {
    let gets = 0;
    const hostile = {};
    Object.defineProperty(hostile, nested ? 'atom' : 'steps', { enumerable: true, get() { gets += 1; throw new Error('HOSTILE_GETTER'); } });
    const flow = nested ? { steps: [hostile] } : hostile;
    let classified; let derived;
    try { classified = admission.flowContainsEntityMutation(flow, registry); } catch { classified = null; }
    try { derived = admission.requiredFlowEntityBindings(flow); } catch { derived = []; }
    assert(gets === 0, `${nested ? '嵌套' : '顶层'} getter 执行 ${gets} 次`);
    assert(classified === true && invalid(derived), 'accessor 未 fail-closed/invalid');
  }
});

test('hostile', 'D entityBindings/binding Proxy 零 trap，invalid 不能变空集', () => {
  for (const atArray of [true, false]) {
    const counter = { count: 0 };
    const proxy = hostileProxy(counter);
    const entityBindings = atArray ? proxy : [proxy];
    const flow = flowOf([{ atom: 'workflow.create', sourceIntentId: 'source_1', entityBindings }]);
    const result = admission.requiredFlowEntityBindings(flow);
    assert(counter.count === 0, `binding ${atArray ? 'array' : 'item'} Proxy trap 执行 ${counter.count} 次`);
    assert(invalid(result), 'binding 敌对输入被洗成合法空集');
  }
});

if (failures.length) {
  for (const failure of failures) console.error(`RED  teachin-admission-side-effect-policy: ${failure}`);
  console.error(`RED  teachin-admission-side-effect-policy/${SECTION}: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   teachin-admission-side-effect-policy/${SECTION}: ${passed}/${passed} 全过（纯函数/静态，零 SUT）`);
