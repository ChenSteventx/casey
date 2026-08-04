#!/usr/bin/env node
// P9 v3 窄验收：旧 fixed runtime-ID 件不再是删除连续性正路；只认当轮 list scan。
// 不走 Windows inode/旧 PRD 物理 reader，避免把平台加固旁支绑进 P9 功能验收。

import {
  authorCreatedWorkflowOwnershipDraft,
  freezeCreatedWorkflowOwnershipAuthority,
  readCreatedWorkflowOwnershipAuthority,
  createCreatedWorkflowReplayContinuityController,
} from '../../lib/entity-created-workflow-continuity-v3.mjs';

// ── p9-replay-authority-split amendment ──────────────────────────
// 回放控制器新增必填的回放授权票据（批级一次性）。本枚断言语义一字未改，
// 只补上「造控制器」现在必须持有的票据——**只加严**，不放宽任何原有判据。
import {
  authorCreatedWorkflowReplayGrantDraft,
  freezeCreatedWorkflowReplayGrant,
  readCreatedWorkflowReplayGrant,
} from '../../lib/entity-created-workflow-replay-grant.mjs';

function replayGrantHandleFor(caseId, authorityBytes, audience = 'test') {
  const asBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  const cases = [{ caseId, authorityBytes }];
  const drafted = authorCreatedWorkflowReplayGrantDraft({
    batchId: `amend-${caseId}`, audience,
    notAfter: '2099-01-01T00:00:00.000Z', grantNonce: 'a'.repeat(32), cases,
  });
  if (!drafted.ok) throw new Error(`amendment 票据草案失败：${drafted.reason}`);
  const frozenGrant = freezeCreatedWorkflowReplayGrant({
    draft: drafted.draft, signerId: 'human', signedAt: '2026-08-04T00:00:00.000Z',
  });
  if (!frozenGrant.ok) throw new Error(`amendment 票据冻结失败：${frozenGrant.reason}`);
  const read = readCreatedWorkflowReplayGrant({ grantBytes: asBytes(frozenGrant.grant), cases });
  if (!read.ok) throw new Error(`amendment 票据读回失败：${read.reason}`);
  return read.handle;
}


const failures = [];
let passed = 0;
const check = (condition, message) => { if (!condition) throw new Error(message); };
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
}
const json = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);

function fixture() {
  const caseId = 'tc_p9_legacy_successor';
  const create = { intentId: 'intent_create', stepId: 'create_terminal', atom: 'workflow.create', candidateId: 'wf', role: 'subject' };
  const deletion = { intentId: 'intent_delete', stepId: 'delete_terminal', atom: 'workflow.deleteByName', candidateId: 'wf', role: 'subject' };
  const eventsBytes = json({ caseId, events: [{ ...create, action: 'click' }, { ...deletion, action: 'click' }] });
  const flowBytes = json({ id: caseId, steps: [
    { ...create, sourceIntentId: create.intentId, params: { name: 'atl_{{uniqueName}}' }, entityBindings: [{ candidateId: 'wf', role: 'subject' }] },
    { ...deletion, sourceIntentId: deletion.intentId, params: { name: 'atl_{{uniqueName}}' }, entityBindings: [{ candidateId: 'wf', role: 'subject' }] },
  ] });
  const testcaseBytes = json({ caseId });
  const profile = { workflows: {
    listApi: { pathname: '/api/workflows', method: 'GET', recordsPath: 'data.records', totalPath: 'data.total', queryParam: 'name', fields: { id: 'id', code: 'code', name: 'name' } },
    mutationAdapter: { method: 'POST', path: '/api/workflows/delete', idLocation: 'body.id' },
  } };
  const profileBytes = json(profile);
  const authored = authorCreatedWorkflowOwnershipDraft({ caseId, eventsBytes, flowBytes, testcaseBytes, profileBytes, ownershipEdges: [{ create, delete: deletion, listApiScope: '/api/workflows', nameTemplate: 'atl_{{uniqueName}}', consume: 'once', mutationAdapter: profile.workflows.mutationAdapter }] });
  const frozen = freezeCreatedWorkflowOwnershipAuthority({ draft: authored.draft, signerId: 'human', signedAt: '2026-08-03T00:00:00.000Z', audience: 'test' });
  return { caseId, create, deletion, eventsBytes, flowBytes, testcaseBytes, profile, profileBytes, authority: frozen.authority };
}

await test('S1 v2/fixed platformId JSON 不能被 v3 reader 铸权', () => {
  const f = fixture();
  const old = json({ schemaVersion: 2, artifactKind: 'entity-locks-frozen', caseId: f.caseId, identityObservations: [{ platformId: 'stale-id' }] });
  const read = readCreatedWorkflowOwnershipAuthority({ caseId: f.caseId, authorityBytes: old, eventsBytes: f.eventsBytes, flowBytes: f.flowBytes, testcaseBytes: f.testcaseBytes, profileBytes: f.profileBytes });
  check(read.ok === false && read.reason === 'CREATED_WORKFLOW_AUTHORITY_INVALID', JSON.stringify(read));
});

await test('S2 v3 结构 authority 自身不携 runtime platformId', () => {
  const f = fixture();
  check(!JSON.stringify(f.authority).includes('platformId'), 'v3 authority 偷带 runtime platformId');
});

await test('S3 没有当轮完整 list scan 时 deletion ref 不存在', async () => {
  const f = fixture();
  const read = readCreatedWorkflowOwnershipAuthority({ caseId: f.caseId, authorityBytes: json(f.authority), eventsBytes: f.eventsBytes, flowBytes: f.flowBytes, testcaseBytes: f.testcaseBytes, profileBytes: f.profileBytes });
  const opened = createCreatedWorkflowReplayContinuityController({ caseId: f.caseId, runId: 'run-current', batchToken: 'batch-current', uniqueNameToken: 'batch-current-case-1', authority: read.handle, grant: replayGrantHandleFor(f.caseId, json(f.authority)), profile: f.profile });
  let sends = 0;
  const attempted = await opened.controller.runGuardedDeletion({ stepId: f.deletion.stepId, request: { method: 'POST', url: '/api/workflows/delete', body: { id: 'stale-id' } }, send: () => { sends += 1; } });
  check(!attempted.ok && sends === 0, '无当轮读回仍放行删除');
});

await test('S4 当轮 scan ID 与出站 ID 不同则零发送，相同才放行', async () => {
  const f = fixture();
  const read = readCreatedWorkflowOwnershipAuthority({ caseId: f.caseId, authorityBytes: json(f.authority), eventsBytes: f.eventsBytes, flowBytes: f.flowBytes, testcaseBytes: f.testcaseBytes, profileBytes: f.profileBytes });
  const opened = createCreatedWorkflowReplayContinuityController({ caseId: f.caseId, runId: 'run-current', batchToken: 'batch-current', uniqueNameToken: 'batch-current-case-1', authority: read.handle, grant: replayGrantHandleFor(f.caseId, json(f.authority)), profile: f.profile });
  const captured = opened.controller.captureCreatedScan({ complete: true, correlatable: true, total: 1, hasNext: false, cursor: null, records: [{ id: 'runtime-current', code: 'WF-1', name: opened.controller.entityName }] });
  check(captured.ok, captured.reason);
  let sends = 0;
  const wrong = await opened.controller.runGuardedDeletion({ stepId: f.deletion.stepId, request: { method: 'POST', url: '/api/workflows/delete', body: { id: 'stale-id' } }, send: () => { sends += 1; } });
  check(!wrong.ok && sends === 0, '旧 fixed ID 被放行');
  const right = await opened.controller.runGuardedDeletion({ stepId: f.deletion.stepId, request: { method: 'POST', url: '/api/workflows/delete', body: { id: 'runtime-current' } }, send: () => { sends += 1; } });
  check(right.ok && sends === 1, right.reason || '当轮 ID 未放行');
});

console.log(`p9-v3-legacy-supersession: ${passed}/${passed + failures.length}`);
if (failures.length) process.exitCode = 1;
