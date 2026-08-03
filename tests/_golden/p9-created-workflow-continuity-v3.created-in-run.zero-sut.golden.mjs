#!/usr/bin/env node
// P9 created-in-run workflow continuity v3：结构授权边 + 当轮读回 + 删除前出站 ID guard。
// 零 SUT、零浏览器、零网络、零子进程；只调用计划中的生产纯函数。

const failures = [];
let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${name}`);
  } catch (error) {
    const message = String(error?.message || error);
    failures.push(`${name}: ${message}`);
    console.error(`FAIL ${name}: ${message}`);
  }
}
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const clone = (value) => JSON.parse(JSON.stringify(value));

let api = null;
let loadFailure = null;
try {
  api = await import('../../lib/entity-created-workflow-continuity-v3.mjs');
} catch (error) {
  loadFailure = error;
}
function need(name) {
  const fn = api?.[name];
  assert(typeof fn === 'function',
    `缺生产导出 ${name}${loadFailure ? `（${loadFailure.code || loadFailure.message}）` : ''}`);
  return fn;
}

const PID = '9223372036854775807';
const CASE_ID = 'tc_catalog_wf_crud';
const RUN_ID = 'run-v3-fixture';
const BATCH_TOKEN = 'batch-v3-fixture';
const TOKEN = `${BATCH_TOKEN}-catalog`;
const NAME = `atl_${TOKEN}`;
const H = `sha256:${'a'.repeat(64)}`;
const CREATE = Object.freeze({ intentId: 'intent_create', stepId: 'step_create', atom: 'workflow.create', candidateId: 'candidate-workflow', role: 'subject' });
const DELETE = Object.freeze({ intentId: 'intent_cleanup', stepId: 'step_delete', atom: 'workflow.deleteByName', candidateId: 'candidate-workflow', role: 'subject' });
const EVENTS_BYTES = Buffer.from('{"caseId":"tc_catalog_wf_crud","events":[{"stepId":"step_create","intentId":"intent_create","atom":"workflow.create"},{"stepId":"step_delete","intentId":"intent_cleanup","atom":"workflow.deleteByName"}]}\n');
const FLOW_BYTES = Buffer.from('{"id":"tc_catalog_wf_crud","steps":[{"stepId":"step_create","sourceIntentId":"intent_create","atom":"workflow.create","entityBindings":[{"candidateId":"candidate-workflow","role":"subject"}]},{"stepId":"step_delete","sourceIntentId":"intent_cleanup","atom":"workflow.deleteByName","entityBindings":[{"candidateId":"candidate-workflow","role":"subject"}]}]}\n');
const TESTCASE_BYTES = Buffer.from('{"caseId":"tc_catalog_wf_crud","steps":["create fixture workflow","delete fixture workflow"]}\n');
const PROFILE_BYTES = Buffer.from('{"workflows":{"listApi":{"pathname":"/fixture/workflow/list","method":"POST"}}}\n');
const MUTATION_ADAPTER = Object.freeze({ method: 'POST', path: '/fixture/workflow/delete', idLocation: 'body.id' });

function sourceBytes() {
  return { eventsBytes: EVENTS_BYTES, flowBytes: FLOW_BYTES, testcaseBytes: TESTCASE_BYTES, profileBytes: PROFILE_BYTES };
}
function makeAuthority() {
  const author = need('authorCreatedWorkflowOwnershipDraft');
  const freeze = need('freezeCreatedWorkflowOwnershipAuthority');
  const read = need('readCreatedWorkflowOwnershipAuthority');
  const drafted = author({
    caseId: CASE_ID, ...sourceBytes(),
    ownershipEdges: [{ create: CREATE, delete: DELETE, listApiScope: 'workflow-list', nameTemplate: 'atl_{{uniqueName}}', consume: 'once', mutationAdapter: MUTATION_ADAPTER }],
  });
  assert(drafted?.ok === true && drafted.draft, `v3 author 失败：${JSON.stringify(drafted)}`);
  const frozen = freeze({ draft: drafted.draft, signerId: 'fixture-human', signedAt: '2026-08-03T00:00:00.000Z', audience: 'test' });
  assert(frozen?.ok === true && frozen.authority, `v3 sign 失败：${JSON.stringify(frozen)}`);
  const authorityBytes = Buffer.from(`${JSON.stringify(frozen.authority)}\n`);
  const verified = read({ caseId: CASE_ID, authorityBytes, ...sourceBytes() });
  assert(verified?.ok === true && verified.handle, `v3 reader 失败：${JSON.stringify(verified)}`);
  return { draft: drafted.draft, authority: frozen.authority, authorityBytes, handle: verified.handle };
}
const completeScan = () => ({
  complete: true,
  correlatable: true,
  total: 1,
  records: [{ id: PID, code: 'WF-FIXTURE', name: NAME }],
  hasNext: false,
  cursor: null,
});
function observationInput(patch = {}) {
  return {
    caseId: CASE_ID,
    runId: RUN_ID,
    batchToken: BATCH_TOKEN,
    uniqueNameToken: TOKEN,
    entityName: NAME,
    create: CREATE,
    scan: completeScan(),
    identityProfileDigest: H,
    ...patch,
  };
}

await test('C1 完整 listApi 唯一读回铸当轮字符串 platformId observation', () => {
  const issue = need('issueCreatedWorkflowRuntimeObservation');
  const result = issue(observationInput());
  assert(result?.ok === true && result.observation, `正控铸造失败：${JSON.stringify(result)}`);
  assert(result.observation.platformId === PID && typeof result.observation.platformId === 'string', 'platformId 未按原字符串保真');
  assert(result.observation.caseId === CASE_ID && result.observation.runId === RUN_ID
    && result.observation.batchToken === BATCH_TOKEN && result.observation.uniqueNameToken === TOKEN, 'observation 未绑定 case/run/batch/per-case token');
  assert(result.observation.create?.role === 'subject' && result.observation.create?.stepId === CREATE.stepId, 'observation 未绑定 create/subject 步');
});

await test('C2 同名多条、分页不全、ID 数值化逐项 fail-closed', () => {
  const issue = need('issueCreatedWorkflowRuntimeObservation');
  const attacks = [
    observationInput({ scan: { ...completeScan(), total: 2, hasNext: true } }),
    observationInput({ scan: { ...completeScan(), total: 2, records: [...completeScan().records, { id: 'other-id', code: 'WF-2', name: NAME }] } }),
    observationInput({ scan: { ...completeScan(), records: [{ id: Number(PID), code: 'WF-FIXTURE', name: NAME }] } }),
    observationInput({ scan: { ...completeScan(), correlatable: false } }),
  ];
  for (const attack of attacks) assert(issue(attack)?.ok === false, `坏扫描被铸 observation：${JSON.stringify(attack.scan)}`);
});

await test('C3 v3 结构锁不携 runtime ID，机械连接 create/subject→delete/subject', () => {
  const issue = need('issueCreatedWorkflowRuntimeObservation');
  const resolve = need('resolveCreatedWorkflowDeletionRef');
  const signed = makeAuthority();
  const observation = issue(observationInput()).observation;
  const result = resolve({ authority: signed.handle, observation, deletion: DELETE, caseId: CASE_ID, runId: RUN_ID });
  assert(result?.ok === true && result.ref, `v3 ref 未解析：${JSON.stringify(result)}`);
  assert(result.ref.platformId === PID && result.ref.runId === RUN_ID && result.ref.deleteStepId === DELETE.stepId, 'ref 未绑定当轮 ID/run/delete step');
  assert(result.ref.consume === 'once', 'ref 未冻结单次消费');
  assert(JSON.stringify(result.ref.mutationAdapter) === JSON.stringify(MUTATION_ADAPTER), 'ref 未携已签 mutation adapter');
  assert(!Object.hasOwn(signed.authority, 'platformId') && !JSON.stringify(signed.authority).includes(PID), 'v3 结构锁偷带 runtime ID');
});

await test('C4 跨 run observation、旧 v2 锁、锁内固定 ID 均不得铸 ref', () => {
  const issue = need('issueCreatedWorkflowRuntimeObservation');
  const resolve = need('resolveCreatedWorkflowDeletionRef');
  const read = need('readCreatedWorkflowOwnershipAuthority');
  const signed = makeAuthority();
  const observation = issue(observationInput()).observation;
  const lineageAttacks = [
    { authority: signed.handle, observation: { ...observation, runId: 'other-run' }, deletion: DELETE, caseId: CASE_ID, runId: RUN_ID },
    { authority: signed.handle, observation, deletion: { ...DELETE, stepId: 'other-delete' }, caseId: CASE_ID, runId: RUN_ID },
  ];
  for (const attack of lineageAttacks) assert(resolve(attack)?.ok === false, `坏 lineage 被铸 ref：${JSON.stringify(attack)}`);
  for (const artifact of [{ ...signed.authority, schemaVersion: 2 }, { ...signed.authority, platformId: PID }]) {
    const result = read({ caseId: CASE_ID, authorityBytes: Buffer.from(`${JSON.stringify(artifact)}\n`), ...sourceBytes() });
    assert(result?.ok === false, `旧/固定 ID authority 被 reader 接受：${JSON.stringify(result)}`);
  }
});

await test('C5 URL/body 目标 ID 等于当轮 ref 才在 guard 后放行一次', async () => {
  const issue = need('issueCreatedWorkflowRuntimeObservation');
  const resolve = need('resolveCreatedWorkflowDeletionRef');
  const guard = need('runCreatedWorkflowGuardedMutation');
  const signed = makeAuthority();
  const observation = issue(observationInput()).observation;
  const ref = resolve({ authority: signed.handle, observation, deletion: DELETE, caseId: CASE_ID, runId: RUN_ID }).ref;
  let sends = 0;
  const result = await guard({
    atom: 'workflow.deleteByName',
    ref,
    request: { method: 'POST', url: '/fixture/workflow/delete', body: { id: PID } },
    send: () => { sends += 1; return { ok: true }; },
  });
  assert(result?.ok === true && result.released === true && sends === 1, `合法 mutation 未恰一次放行：${JSON.stringify(result)} sends=${sends}`);
});

await test('C6 adapter/method/path/ID location 漂移、多 ID、错 ID均发送前中止', async () => {
  const issue = need('issueCreatedWorkflowRuntimeObservation');
  const resolve = need('resolveCreatedWorkflowDeletionRef');
  const guard = need('runCreatedWorkflowGuardedMutation');
  const signed = makeAuthority();
  const observation = issue(observationInput()).observation;
  const ref = resolve({ authority: signed.handle, observation, deletion: DELETE, caseId: CASE_ID, runId: RUN_ID }).ref;
  for (const request of [
    { method: 'GET', url: '/fixture/workflow/delete', body: { id: PID } },
    { method: 'POST', url: '/fixture/workflow/delete-other', body: { id: PID } },
    { method: 'POST', url: `/fixture/workflow/delete?id=${encodeURIComponent(PID)}`, body: {} },
    { method: 'POST', url: `/fixture/workflow/delete?id=${encodeURIComponent(PID)}`, body: { id: PID } },
    { method: 'POST', url: '/fixture/workflow/delete', body: { id: PID, platformId: PID } },
    { method: 'POST', url: '/fixture/workflow/delete', body: { id: 'other-id' } },
    { method: 'POST', url: '/fixture/workflow/delete', body: {} },
  ]) {
    let sends = 0;
    const result = await guard({ atom: 'workflow.deleteByName', ref, request, send: () => { sends += 1; } });
    assert(result?.ok === false && result.aborted === true && result.mutated === false && sends === 0,
      `坏 ID mutation 未在发送前中止：${JSON.stringify(result)} sends=${sends}`);
  }
});

await test('C7 数值 ID 即使字符串化后碰巧相等也拒绝，禁止 19 位精度丢失', async () => {
  const issue = need('issueCreatedWorkflowRuntimeObservation');
  const resolve = need('resolveCreatedWorkflowDeletionRef');
  const guard = need('runCreatedWorkflowGuardedMutation');
  const signed = makeAuthority();
  const numeric = Number(PID);
  const observation = issue(observationInput({ scan: { ...completeScan(), records: [{ id: String(numeric), code: 'WF-FIXTURE', name: NAME }] } })).observation;
  const ref = resolve({ authority: signed.handle, observation, deletion: DELETE, caseId: CASE_ID, runId: RUN_ID }).ref;
  let sends = 0;
  const result = await guard({
    atom: 'workflow.deleteByName', ref,
    request: { method: 'POST', url: '/fixture/workflow/delete', body: { id: numeric } },
    send: () => { sends += 1; },
  });
  assert(result?.ok === false && sends === 0, `数值 ID 被放行：${JSON.stringify(result)} sends=${sends}`);
});

await test('C8 同一 ref 只能消费一次，第二次 mutation 零放行', async () => {
  const issue = need('issueCreatedWorkflowRuntimeObservation');
  const resolve = need('resolveCreatedWorkflowDeletionRef');
  const guard = need('runCreatedWorkflowGuardedMutation');
  const signed = makeAuthority();
  const observation = issue(observationInput()).observation;
  const ref = resolve({ authority: signed.handle, observation, deletion: DELETE, caseId: CASE_ID, runId: RUN_ID }).ref;
  let sends = 0;
  const args = { atom: 'workflow.deleteByName', ref, request: { method: 'POST', url: '/fixture/workflow/delete', body: { id: PID } }, send: () => { sends += 1; } };
  const first = await guard(args);
  const second = await guard(args);
  assert(first?.ok === true && second?.ok === false && sends === 1, `ref 非单次消费：first=${JSON.stringify(first)} second=${JSON.stringify(second)} sends=${sends}`);
});

if (failures.length) {
  console.error(`RED  p9-created-workflow-continuity-v3.created-in-run: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   p9-created-workflow-continuity-v3.created-in-run: ${passed}/${passed} 全过`);
