#!/usr/bin/env node
// P9 v3 窄验收：同轮 ID → 精确 delete → 三样本稳定缺席 → axes/verdict/report 深消费。
// 零浏览器、零网络、零 SUT；调用的是生产 controller/projector/verdict/report-model。

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import {
  authorCreatedWorkflowOwnershipDraft,
  freezeCreatedWorkflowOwnershipAuthority,
  readCreatedWorkflowOwnershipAuthority,
  createCreatedWorkflowReplayContinuityController,
} from '../../lib/entity-created-workflow-continuity-v3.mjs';
import { projectReplayAxes } from '../../lib/replay-axes.mjs';
import { assembleReportModel } from '../../lib/report-model.mjs';

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


const ROOT = resolve(import.meta.dirname, '..', '..');
const failures = [];
let passed = 0;
const check = (condition, message) => { if (!condition) throw new Error(message); };
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
}
const json = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);

function makeController() {
  const caseId = 'tc_p9_replay_evidence';
  const create = { intentId: 'intent_create', stepId: 'create_terminal', atom: 'workflow.create', candidateId: 'wf', role: 'subject' };
  const deletion = { intentId: 'intent_delete', stepId: 'delete_terminal', atom: 'workflow.deleteByName', candidateId: 'wf', role: 'subject' };
  const eventsBytes = json({ caseId, events: [
    { ...create, action: 'click', compilePhase: 'terminal' },
    { ...deletion, action: 'click', value: 'atl_{{uniqueName}}', compilePhase: 'terminal' },
  ] });
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
  check(authored.ok, authored.reason);
  const frozen = freezeCreatedWorkflowOwnershipAuthority({ draft: authored.draft, signerId: 'human', signedAt: '2026-08-03T00:00:00.000Z', audience: 'test' });
  const read = readCreatedWorkflowOwnershipAuthority({ caseId, authorityBytes: json(frozen.authority), eventsBytes, flowBytes, testcaseBytes, profileBytes });
  check(read.ok, read.reason);
  const opened = createCreatedWorkflowReplayContinuityController({ caseId, runId: 'run-1', batchToken: 'batch-1', uniqueNameToken: 'batch-1-case-1', authority: read.handle, grant: replayGrantHandleFor(caseId, json(frozen.authority)), profile });
  check(opened.ok, opened.reason);
  return { caseId, controller: opened.controller };
}

function scan(records) {
  return { complete: true, correlatable: true, total: records.length, hasNext: false, cursor: null, records };
}

function project(caseId, cleanup) {
  const event = { stepId: 'delete_terminal', intentId: 'intent_delete', atom: 'workflow.deleteByName', action: 'click' };
  return projectReplayAxes({
    caseId,
    records: [],
    intentOrder: ['intent_delete'],
    intentEvents: new Map([['intent_delete', [event]]]),
    reprStepOf: new Map([['intent_delete', 'delete_terminal']]),
    actionByStep: new Map([['delete_terminal', { resolution: 'unique', identityReadback: { ok: true } }]]),
    pageErrors: [],
    intentCount: new Map([['intent_delete', { before: 1, after: 0 }]]),
    expectedByIntent: new Map([['intent_delete', []]]),
    globalAssertions: [],
    intentUrl: new Map([['intent_delete', '/workflows']]),
    intentToasts: new Map(), intentTextHits: new Map(), intentButtonHits: new Map(),
    intentButtonSeen: new Map(), intentButtonDisabledHits: new Map(), intentReply: new Map(),
    intentInputReadback: new Map(), chatCfg: null, allStepIds: new Set(['delete_terminal']),
    cleanupEvidence: cleanup,
  });
}

function verdictOf(axesText) {
  const dir = mkdtempSync(join(tmpdir(), 'casey-p9-verdict-'));
  try {
    const axes = join(dir, 'axes.json'); const verdict = join(dir, 'verdict.json');
    writeFileSync(axes, axesText);
    const result = spawnSync(process.execPath, [join(ROOT, 'bin', 'verdict.mjs'), '--axes', axes, '--out', verdict], { encoding: 'utf8' });
    check(result.status === 0, `verdict exit ${result.status}`);
    return JSON.parse(readFileSync(verdict, 'utf8'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

await test('E1 当轮完整 list scan 铸字符串 ID，精确 method/path/body.id 只放行一次', async () => {
  const { controller } = makeController();
  const captured = controller.captureCreatedScan(scan([{ id: '9223372036854775807', code: 'WF-1', name: controller.entityName }]));
  check(captured.ok && captured.platformId === '9223372036854775807', captured.reason || 'ID 未读回');
  let sends = 0;
  const released = await controller.runGuardedDeletion({ stepId: 'delete_terminal', request: { method: 'POST', url: '/api/workflows/delete', body: { id: '9223372036854775807' } }, send: () => { sends += 1; } });
  check(released.ok && sends === 1, released.reason || 'delete 未精确放行');
  const again = await controller.runGuardedDeletion({ stepId: 'delete_terminal', request: { method: 'POST', url: '/api/workflows/delete', body: { id: '9223372036854775807' } }, send: () => { sends += 1; } });
  check(!again.ok && sends === 1, '同一 ref 被重复消费');
});

await test('E2 三个完整样本跨 3000ms 后 cleanupSatisfied=true', async () => {
  const { controller } = makeController();
  controller.captureCreatedScan(scan([{ id: 'id-1', code: 'WF-1', name: controller.entityName }]));
  await controller.runGuardedDeletion({ stepId: 'delete_terminal', request: { method: 'POST', url: '/api/workflows/delete', body: { id: 'id-1' } }, send: () => null });
  controller.recordAbsenceScan(scan([]), 1000);
  controller.recordAbsenceScan(scan([]), 2500);
  controller.recordAbsenceScan(scan([]), 4000);
  const cleanup = controller.cleanupEvidence();
  check(cleanup.cleanupSatisfied === true && cleanup.sampleCount === 3 && cleanup.windowMs === 3000, JSON.stringify(cleanup));
});

await test('E3 cleanup 作为硬断言进入 axes，确定性 verdict 才能 PASS', async () => {
  const { caseId, controller } = makeController();
  controller.captureCreatedScan(scan([{ id: 'id-1', code: 'WF-1', name: controller.entityName }]));
  await controller.runGuardedDeletion({ stepId: 'delete_terminal', request: { method: 'POST', url: '/api/workflows/delete', body: { id: 'id-1' } }, send: () => null });
  [1000, 2500, 4000].forEach((at) => controller.recordAbsenceScan(scan([]), at));
  const axesText = project(caseId, controller.cleanupEvidence());
  const axes = JSON.parse(axesText);
  const assertion = axes.steps[0].postAssertions.find((row) => row.kind === 'destructiveContinuity');
  check(assertion?.ok === true && assertion.soft === false, 'axes 未投硬清理断言');
  const verdict = verdictOf(axesText);
  check(verdict.steps[0].verdict === 'PASS', JSON.stringify(verdict));
  const model = assembleReportModel({ caseId, channel: 'web', verdict, axes, meta: { generatedAt: '2026-08-03T00:00:00.000Z' } });
  check(model.cleanupEvidence.some((row) => row.op === 'stableTargetAbsence'), 'report-model 未消费稳定缺席证据');
});

await test('E4 样本不足时 cleanup 硬断言为 false，verdict 不得 PASS', async () => {
  const { caseId, controller } = makeController();
  controller.captureCreatedScan(scan([{ id: 'id-1', code: 'WF-1', name: controller.entityName }]));
  await controller.runGuardedDeletion({ stepId: 'delete_terminal', request: { method: 'POST', url: '/api/workflows/delete', body: { id: 'id-1' } }, send: () => null });
  controller.recordAbsenceScan(scan([]), 1000);
  controller.recordAbsenceScan(scan([]), 2000);
  const verdict = verdictOf(project(caseId, controller.cleanupEvidence()));
  check(verdict.steps[0].verdict === 'NEEDS_HUMAN', `不足样本被洗绿：${JSON.stringify(verdict)}`);
});

console.log(`p9-v3-replay-evidence: ${passed}/${passed + failures.length}`);
if (failures.length) process.exitCode = 1;
