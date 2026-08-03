#!/usr/bin/env node
// P9 workflow.create role 调和：create/delete 都是 subject；relation 的 source/target 双锁保持。
// 零 SUT、零浏览器、零网络、零子进程；直驱现役 production pure seams。

import {
  admissionPolicyForAtom,
  requiredFlowEntityBindings,
  buildEntityBindingsDraft,
  freezeEntityBindingsDraft,
} from '../../lib/entity-semantic-lock-preflight.mjs';
import {
  ENTITY_OBSERVATION_REGISTRY,
  validateObservationAdmission,
} from '../../lib/entity-observation-registry.mjs';
import { createEntityLockReceipt } from '../../lib/entity-semantic-lock.mjs';

const failures = [];
let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { const message = String(error?.message || error); failures.push(`${name}: ${message}`); console.error(`FAIL ${name}: ${message}`); }
}
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const json = (value) => JSON.stringify(value);

let v3 = null;
let v3LoadFailure = null;
try { v3 = await import('../../lib/entity-created-workflow-continuity-v3.mjs'); }
catch (error) { v3LoadFailure = error; }
function needV3(name) {
  const fn = v3?.[name];
  assert(typeof fn === 'function', `缺 production v3 导出 ${name}${v3LoadFailure ? `（${v3LoadFailure.code || v3LoadFailure.message}）` : ''}`);
  return fn;
}

const CASE_ID = 'tc_role_compile_sign_fixture';
const PID = '9223372036854775807';
const CREATE_STEP = { stepId: 'step_create', intentId: 'intent_create', atom: 'workflow.create', action: 'click' };
const DELETE_STEP = { stepId: 'step_delete', intentId: 'intent_cleanup', atom: 'workflow.deleteByName', action: 'click' };
const EVENTS = { schemaVersion: 2, channel: 'web', caseId: CASE_ID, events: [CREATE_STEP, DELETE_STEP] };
const EVENTS_BYTES = Buffer.from(`${JSON.stringify(EVENTS)}\n`);
const FLOW_BYTES = Buffer.from('{"id":"tc_role_compile_sign_fixture","steps":[{"stepId":"step_create","sourceIntentId":"intent_create","atom":"workflow.create","entityBindings":[{"candidateId":"candidate-workflow","role":"subject"}]},{"stepId":"step_delete","sourceIntentId":"intent_cleanup","atom":"workflow.deleteByName","entityBindings":[{"candidateId":"candidate-workflow","role":"subject"}]}]}\n');
const TESTCASE_BYTES = Buffer.from('{"caseId":"tc_role_compile_sign_fixture","steps":["create fixture workflow","delete fixture workflow"]}\n');
const PROFILE_BYTES = Buffer.from('{"workflows":{"listApi":{"pathname":"/fixture/workflow/list","method":"POST"}}}\n');
const PROVENANCE = [
  { ...CREATE_STEP, action: undefined, sourceIntentId: 'source_create', candidateId: 'candidate-workflow', role: 'subject' },
  { ...DELETE_STEP, action: undefined, sourceIntentId: 'source_cleanup', candidateId: 'candidate-workflow', role: 'subject' },
].map(({ action, ...row }) => row);

test('R1 side-effect policy 的 workflow.create 精确保持 subject', () => {
  const policy = admissionPolicyForAtom('workflow.create');
  assert(json(policy?.identityBindingRoles) === json(['subject'])
    && json(policy?.rule?.requiredRoles) === json(['subject']), `生产策略漂移：${json(policy)}`);
});

test('R2 observation registry 的 workflow.create 调和为 subject，workflow.open 不顺带改', () => {
  const create = ENTITY_OBSERVATION_REGISTRY.get('workflow.create');
  const open = ENTITY_OBSERVATION_REGISTRY.get('workflow.open');
  assert(json(create?.requiredRoles) === json(['subject']), `workflow.create registry 未调和：${json(create)}`);
  assert(json(open?.requiredRoles) === json(['source']), `workflow.open 被越界改动：${json(open)}`);
});

test('R3 create/subject 观察行通过 compile observation admission', () => {
  const binding = { ...CREATE_STEP, action: undefined, sourceIntentId: 'source_create', candidateId: 'candidate-workflow', role: 'subject', bindingMode: 'created-in-run' };
  delete binding.action;
  const observation = {
    source: { kind: 'compile-envelope', atom: 'workflow.create' },
    observations: [{
      kind: 'workflow', name: 'atl_fixture', code: 'WF-FIXTURE', platformId: PID,
      sourceIntentId: 'source_create', candidateId: 'candidate-workflow', role: 'subject', atom: 'workflow.create',
      evidenceStepId: CREATE_STEP.stepId, sourcePath: '/fixture/workflow', bindingMode: 'created-in-run', provenance: 'platform-readback',
    }],
  };
  const result = validateObservationAdmission({ events: [CREATE_STEP], bindings: [binding], observation });
  assert(result?.ok === true, `create/subject observation 未过 compile 准入：${json(result)}`);
});

function v3Inputs() {
  return {
    caseId: CASE_ID,
    eventsBytes: EVENTS_BYTES,
    flowBytes: FLOW_BYTES,
    testcaseBytes: TESTCASE_BYTES,
    profileBytes: PROFILE_BYTES,
    ownershipEdges: [{
      create: { intentId: 'intent_create', stepId: 'step_create', atom: 'workflow.create', candidateId: 'candidate-workflow', role: 'subject' },
      delete: { intentId: 'intent_cleanup', stepId: 'step_delete', atom: 'workflow.deleteByName', candidateId: 'candidate-workflow', role: 'subject' },
      listApiScope: 'workflow-list', nameTemplate: 'atl_{{uniqueName}}', consume: 'once',
      mutationAdapter: { method: 'POST', path: '/fixture/workflow/delete', idLocation: 'body.id' },
    }],
  };
}

test('R4 production v3 author→sign→reader→preflight 正控冻结 ownershipEdges', () => {
  const author = needV3('authorCreatedWorkflowOwnershipDraft');
  const freeze = needV3('freezeCreatedWorkflowOwnershipAuthority');
  const read = needV3('readCreatedWorkflowOwnershipAuthority');
  const preflight = needV3('checkCreatedWorkflowOwnershipPreflight');
  const authored = author(v3Inputs());
  assert(authored?.ok === true && authored.draft?.schemaVersion === 3 && authored.draft.signed === false, `v3 author 失败：${json(authored)}`);
  const frozen = freeze({ draft: authored.draft, signerId: 'fixture-human', signedAt: '2026-08-03T00:00:00.000Z', audience: 'test' });
  assert(frozen?.ok === true && frozen.authority?.schemaVersion === 3 && frozen.authority.signed === true, `v3 sign 失败：${json(frozen)}`);
  assert(frozen.authority.ownershipEdges?.[0]?.create?.role === 'subject'
    && frozen.authority.ownershipEdges?.[0]?.delete?.role === 'subject', 'v3 authority 未冻结 create/subject→delete/subject');
  assert(frozen.authority.ownershipEdges[0].mutationAdapter?.idLocation === 'body.id', 'v3 authority 未冻结 mutation adapter');
  assert(!Object.hasOwn(frozen.authority, 'platformId'), 'v3 结构 authority 偷签 runtime platformId');
  const authorityBytes = Buffer.from(`${JSON.stringify(frozen.authority)}\n`);
  const readback = read({ caseId: CASE_ID, eventsBytes: EVENTS_BYTES, flowBytes: FLOW_BYTES, testcaseBytes: TESTCASE_BYTES, profileBytes: PROFILE_BYTES, authorityBytes });
  assert(readback?.ok === true && readback.handle, `v3 reader 失败：${json(readback)}`);
  const checked = preflight({
    handle: readback.handle, caseId: CASE_ID,
    create: v3Inputs().ownershipEdges[0].create,
    deletion: v3Inputs().ownershipEdges[0].delete,
  });
  assert(checked?.ok === true && checked.allowExecution === true, `v3 preflight 正控失败：${json(checked)}`);
});

test('R5 v1/v2 冒充与 events/flow/TestCase/profile 任一精确字节漂移均拒', () => {
  const author = needV3('authorCreatedWorkflowOwnershipDraft');
  const freeze = needV3('freezeCreatedWorkflowOwnershipAuthority');
  const read = needV3('readCreatedWorkflowOwnershipAuthority');
  const authored = author(v3Inputs());
  const frozen = freeze({ draft: authored.draft, signerId: 'fixture-human', signedAt: '2026-08-03T00:00:00.000Z', audience: 'test' });
  const base = { caseId: CASE_ID, eventsBytes: EVENTS_BYTES, flowBytes: FLOW_BYTES, testcaseBytes: TESTCASE_BYTES, profileBytes: PROFILE_BYTES };
  const authorityBytes = Buffer.from(`${JSON.stringify(frozen.authority)}\n`);
  const drift = [
    { ...base, eventsBytes: Buffer.concat([EVENTS_BYTES, Buffer.from(' ')]), authorityBytes },
    { ...base, flowBytes: Buffer.concat([FLOW_BYTES, Buffer.from(' ')]), authorityBytes },
    { ...base, testcaseBytes: Buffer.concat([TESTCASE_BYTES, Buffer.from(' ')]), authorityBytes },
    { ...base, profileBytes: Buffer.concat([PROFILE_BYTES, Buffer.from(' ')]), authorityBytes },
  ];
  for (const attack of drift) assert(read(attack)?.ok === false, '精确 source bytes 漂移被 v3 reader 接受');
  for (const schemaVersion of [1, 2]) {
    const artifact = { ...frozen.authority, schemaVersion };
    assert(read({ ...base, authorityBytes: Buffer.from(`${JSON.stringify(artifact)}\n`) })?.ok === false, `v${schemaVersion} 冒充 v3 被接受`);
  }
});

test('R6 flow→draft→现役 sign 纯层的 create/delete subject 正控可达', () => {
  const flow = {
    id: CASE_ID,
    steps: [
      { atom: 'workflow.create', sourceIntentId: 'source_create', entityBindings: [{ candidateId: 'candidate-workflow', role: 'subject' }] },
      { atom: 'workflow.deleteByName', sourceIntentId: 'source_cleanup', entityBindings: [{ candidateId: 'candidate-workflow', role: 'subject' }] },
    ],
  };
  const required = requiredFlowEntityBindings(flow);
  assert(Array.isArray(required) && required.length === 2 && required.every((row) => row.role === 'subject'), `flow subject 投影失败：${json(required)}`);
  const built = buildEntityBindingsDraft({ eventsBytes: EVENTS_BYTES, eventsDocument: EVENTS, provenance: PROVENANCE });
  assert(built?.ok === true && built.draft?.bindings?.length === 2, `draft 失败：${json(built)}`);
  const receipt = createEntityLockReceipt({
    lockId: 'lock-workflow-fixture', kind: 'workflow', bindingMode: 'created-in-run', scopeFingerprint: 'sha256:fixture-scope',
    expected: { name: 'atl_fixture', code: 'WF-FIXTURE' }, observed: { name: 'atl_fixture', code: 'WF-FIXTURE', platformId: PID },
    source: 'platform-readback',
  });
  const confirmations = PROVENANCE.map((row) => ({ ...row, receipt }));
  const frozen = freezeEntityBindingsDraft({
    caseId: CASE_ID, eventsBytes: EVENTS_BYTES, eventsDocument: EVENTS, draft: built.draft, confirmations,
    signerId: 'fixture-human', signedAt: '2026-08-03T00:00:00.000Z', audience: 'test',
  });
  assert(frozen?.ok === true && frozen.artifact?.bindings?.length === 2
    && frozen.artifact.bindings.every((row) => row.role === 'subject'), `sign 纯层 subject 正控失败：${json(frozen)}`);
  assert(frozen.artifact.schemaVersion < 3 && !Object.hasOwn(frozen.artifact, 'ownershipEdges'), '旧 v1/v2 锁冒充 v3 ownership 锁');
});

test('R7 create/source、漏 subject、双角色均被现役 flow policy 拒绝', () => {
  for (const entityBindings of [
    [{ candidateId: 'candidate-workflow', role: 'source' }],
    [],
    [{ candidateId: 'candidate-workflow', role: 'subject' }, { candidateId: 'candidate-other', role: 'source' }],
  ]) {
    const result = requiredFlowEntityBindings({ id: 'bad', steps: [{ atom: 'workflow.create', sourceIntentId: 'source_create', entityBindings }] });
    assert(result?.ok === false && result.reason === 'ENTITY_BINDING_REQUIRED_ROLES_INVALID', `坏 create role 被放行：${json(result)}`);
  }
});

test('R8 workflow.bindAgent 的 source+target 双锁正控保持', () => {
  const result = requiredFlowEntityBindings({
    id: 'relation-good',
    steps: [{
      atom: 'workflow.bindAgent', sourceIntentId: 'source_relation',
      entityBindings: [{ candidateId: 'candidate-workflow', role: 'source' }, { candidateId: 'candidate-agent', role: 'target' }],
    }],
  });
  assert(Array.isArray(result) && json(result.map((row) => row.role).sort()) === json(['source', 'target']), `relation 双锁被破坏：${json(result)}`);
});

test('R9 workflow.bindAgent 缺 source 或 target 任一均继续 fail-closed', () => {
  for (const role of ['source', 'target']) {
    const result = requiredFlowEntityBindings({
      id: 'relation-bad',
      steps: [{ atom: 'workflow.bindAgent', sourceIntentId: 'source_relation', entityBindings: [{ candidateId: `candidate-${role}`, role }] }],
    });
    assert(result?.ok === false && result.reason === 'ENTITY_BINDING_REQUIRED_ROLES_INVALID', `relation 单边 ${role} 被放行：${json(result)}`);
  }
});

if (failures.length) {
  console.error(`RED  p9-created-workflow-continuity-v3.role-compile-sign: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   p9-created-workflow-continuity-v3.role-compile-sign: ${passed}/${passed} 全过`);
