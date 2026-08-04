#!/usr/bin/env node
// P9 v3 窄验收：真实五源派生 + replay/run 生产参数 + 未覆盖 mutation 继续走旧锁。
// 只跑纯函数与浏览器前 CLI 门；零浏览器、零网络、零 SUT。

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import {
  issueCreatedWorkflowCompileProvenance,
  prepareCreatedWorkflowOwnershipDraft,
  freezeCreatedWorkflowOwnershipAuthority,
  readCreatedWorkflowOwnershipAuthority,
  createCreatedWorkflowReplayContinuityController,
} from '../../lib/entity-created-workflow-continuity-v3.mjs';
import { parseReplayArgs } from '../../lib/replay/cli-input.mjs';

// ── p9-replay-authority-split amendment ──────────────────────────
// 回放控制器新增必填的回放授权票据（批级一次性）。本枚金牌的断言语义一字未改，
// 只把「造控制器」这一步补上它现在必须持有的票据——属**只加严**，不放宽任何原有判据。
import {
  authorCreatedWorkflowReplayGrantDraft,
  freezeCreatedWorkflowReplayGrant,
  readCreatedWorkflowReplayGrant,
} from '../../lib/entity-created-workflow-replay-grant.mjs';

function replayGrantHandleFor(caseId, authorityBytes, audience = 'test') {
  const bytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
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
  const read = readCreatedWorkflowReplayGrant({ grantBytes: bytes(frozenGrant.grant), cases });
  if (!read.ok) throw new Error(`amendment 票据读回失败：${read.reason}`);
  return read.handle;
}


const ROOT = resolve(import.meta.dirname, '..', '..');
const failures = [];
let passed = 0;
const check = (condition, message) => { if (!condition) throw new Error(message); };
const test = (name, fn) => {
  try { fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
};
const json = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);

function bundle({ mixed = false } = {}) {
  const caseId = mixed ? 'tc_p9_v3_mixed' : 'tc_p9_v3_exact';
  const flowSteps = [
    { atom: 'workflow.create', sourceIntentId: 'intent_create', params: { name: 'atl_{{uniqueName}}' }, entityBindings: [{ candidateId: 'wf', role: 'subject' }] },
    { atom: 'workflow.deleteByName', sourceIntentId: 'intent_delete', params: { name: 'atl_{{uniqueName}}' }, entityBindings: [{ candidateId: 'wf', role: 'subject' }] },
  ];
  const events = [
    { stepId: 'create_fill', intentId: 'intent_create', atom: 'workflow.create', action: 'fill', value: 'atl_{{uniqueName}}' },
    { stepId: 'create_terminal', intentId: 'intent_create', atom: 'workflow.create', action: 'click', text: '确定', compilePhase: 'terminal' },
    { stepId: 'delete_fill', intentId: 'intent_delete', atom: 'workflow.deleteByName', action: 'fill', value: 'atl_{{uniqueName}}' },
    { stepId: 'delete_terminal', intentId: 'intent_delete', atom: 'workflow.deleteByName', action: 'click', text: '确定', value: 'atl_{{uniqueName}}', compilePhase: 'terminal' },
  ];
  if (mixed) {
    flowSteps.push({ atom: 'workflow.bindAgent', sourceIntentId: 'intent_bind', params: {}, entityBindings: [{ candidateId: 'wf', role: 'source' }, { candidateId: 'agent', role: 'target' }] });
    events.push({ stepId: 'bind_terminal', intentId: 'intent_bind', atom: 'workflow.bindAgent', action: 'click', text: '确定' });
  }
  const eventsBytes = json({ schemaVersion: 2, channel: 'web', caseId, events });
  const flowBytes = json({ caseId, confirmedBy: 'human', confirmedAt: '2026-08-03T00:00:00.000Z', flow: { id: caseId, name: 'P9 v3', category: 'normal', steps: flowSteps } });
  const testcaseBytes = json({ schemaVersion: 1, caseId, channel: 'web', uniquePrefix: 'atl_', preconditions: ['已登录'], intents: [] });
  const profile = {
    background: [], successField: 'status', successValue: 200,
    workflows: {
      listApi: { pathname: '/api/workflows', method: 'GET', recordsPath: 'data.records', totalPath: 'data.total', queryParam: 'name', fields: { id: 'id', code: 'code', name: 'name' } },
      mutationAdapter: { method: 'POST', path: '/api/workflows/delete', idLocation: 'body.id' },
    },
  };
  const profileBytes = json(profile);
  const issued = issueCreatedWorkflowCompileProvenance({ caseId, eventsBytes, confirmedFlowBytes: flowBytes });
  check(issued.ok, `provenance: ${issued.reason}`);
  const compileProvenanceBytes = json(issued.provenance);
  const prepared = prepareCreatedWorkflowOwnershipDraft({ caseId, eventsBytes, flowBytes, testcaseBytes, profileBytes, compileProvenanceBytes });
  check(prepared.ok, `prepare: ${prepared.reason}`);
  const frozen = freezeCreatedWorkflowOwnershipAuthority({ draft: prepared.draft, signerId: 'human', signedAt: '2026-08-03T00:00:00.000Z', audience: 'test' });
  check(frozen.ok, `freeze: ${frozen.reason}`);
  return { caseId, eventsBytes, flowBytes, testcaseBytes, profileBytes, profile, compileProvenanceBytes, authorityBytes: json(frozen.authority) };
}

test('A1 compiler provenance 从 wrapper flow 映射到两个 terminal event', () => {
  const b = bundle();
  const provenance = JSON.parse(b.compileProvenanceBytes);
  check(provenance.mappings.length === 2, 'terminal mappings 非 2');
  check(provenance.mappings.some((row) => row.terminalStepId === 'create_terminal'), '缺 create terminal');
  check(provenance.mappings.some((row) => row.terminalStepId === 'delete_terminal'), '缺 delete terminal');
});

test('A2 prepare/freeze/read/controller 精确消费 events/flow/TestCase/profile', () => {
  const b = bundle();
  const read = readCreatedWorkflowOwnershipAuthority({ caseId: b.caseId, authorityBytes: b.authorityBytes, eventsBytes: b.eventsBytes, flowBytes: b.flowBytes, testcaseBytes: b.testcaseBytes, profileBytes: b.profileBytes });
  check(read.ok, read.reason);
  const opened = createCreatedWorkflowReplayContinuityController({ caseId: b.caseId, runId: 'run-1', batchToken: 'batch-1', uniqueNameToken: 'batch-1-case-1', authority: read.handle, grant: replayGrantHandleFor(b.caseId, b.authorityBytes), profile: b.profile });
  check(opened.ok && opened.controller.entityName === 'atl_batch-1-case-1', opened.reason || 'controller 未派生实体名');
});

test('A3 replay 参数面显式接五源、batch token 与 unique name', () => {
  const parsed = parseReplayArgs(['--events', 'e', '--flow', 'f', '--case-meta', 't', '--profile', 'p', '--compile-provenance', 'c', '--created-workflow-authority', 'a', '--batch-token', 'b', '--unique-name', 'u']);
  check(parsed.flow === 'f' && parsed.testcase === 't' && parsed.compileProvenance === 'c', '五源参数未解析');
  check(parsed.createdWorkflowAuthority === 'a' && parsed.batchToken === 'b' && parsed.uniqueName === 'u', 'v3/token 参数未解析');
});

test('A4 compile 与 casey run 生产壳已实际转发 provenance/v3/token', () => {
  const compileSource = readFileSync(join(ROOT, 'bin', 'compile.mjs'), 'utf8');
  const runSource = readFileSync(join(ROOT, 'bin', 'casey.mjs'), 'utf8');
  check(compileSource.includes('issueCreatedWorkflowCompileProvenance') && compileSource.includes('compile-provenance.json'), 'compile 未产 provenance');
  for (const token of ['--created-workflow-authority', '--compile-provenance', '--batch-token']) check(runSource.includes(token), `run 未转发 ${token}`);
});

test('A5 v3 缺 batch/unique 在浏览器前拒绝', () => {
  const result = spawnSync(process.execPath, [join(ROOT, 'bin', 'replay.mjs'),
    '--events', 'e', '--sut', 'http://127.0.0.1:1', '--expected', 'x', '--profile', 'p', '--out', 'o',
    '--created-workflow-authority', 'x',
  ], { encoding: 'utf8' });
  check(result.status === 64, `应 exit 64，实际 ${result.status}`);
  check(`${result.stdout}${result.stderr}`.includes('batch-token'), '拒因未具名 batch-token');
});

test('A6 混入 bindAgent 时 v3 不绕过旧 entity-lock 门', () => {
  const b = bundle({ mixed: true });
  const dir = mkdtempSync(join(tmpdir(), 'casey-p9-v3-'));
  try {
    const files = {};
    const grantDraft = authorCreatedWorkflowReplayGrantDraft({
      batchId: `amend-${b.caseId}`, audience: 'test', notAfter: '2099-01-01T00:00:00.000Z',
      grantNonce: 'a'.repeat(32), cases: [{ caseId: b.caseId, authorityBytes: b.authorityBytes }],
    });
    const grantFrozen = freezeCreatedWorkflowReplayGrant({ draft: grantDraft.draft, signerId: 'human', signedAt: '2026-08-04T00:00:00.000Z' });
    for (const [name, bytes] of Object.entries({ events: b.eventsBytes, flow: b.flowBytes, testcase: b.testcaseBytes, profile: b.profileBytes, provenance: b.compileProvenanceBytes, authority: b.authorityBytes, grant: json(grantFrozen.grant), expected: json({ caseId: b.caseId, channel: 'web', intents: [], globalAssertions: [] }) })) {
      files[name] = join(dir, `${name}.json`); writeFileSync(files[name], bytes);
    }
    const result = spawnSync(process.execPath, [join(ROOT, 'bin', 'replay.mjs'),
      '--events', files.events, '--flow', files.flow, '--case-meta', files.testcase,
      '--profile', files.profile, '--compile-provenance', files.provenance,
      '--created-workflow-authority', files.authority, '--expected', files.expected,
      '--replay-grant', files.grant, '--replay-grant-ledger', join(dir, 'ledger'),
      '--batch-token', 'batch-1', '--unique-name', 'batch-1-case-1',
      '--sut', 'http://127.0.0.1:1', '--out', join(dir, 'axes.json'),
    ], { encoding: 'utf8' });
    const output = `${result.stdout}${result.stderr}`;
    check(result.status === 65, `应浏览器前 exit 65，实际 ${result.status}: ${output.slice(-200)}`);
    check(output.includes('FROZEN_ENTITY_LOCKS_MISSING_OR_INVALID'), 'bindAgent 未继续命中旧锁门');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

console.log(`p9-v3-authority-cli: ${passed}/${passed + failures.length}`);
if (failures.length) process.exitCode = 1;
