// 共享夹具 · p9-replay-authority-split（两枚金牌共用；本身不含断言）
// 造五源精确字节 + 结构授权边 + 回放授权票据，全部走生产起草/冻结面，不手搓件。

import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

export const CASE_A = 'tc_p9_split_a';
export const CASE_B = 'tc_p9_split_b';
export const BATCH_ID = 'tier2-p9-split-fixture';
export const NOT_AFTER = '2099-01-01T00:00:00.000Z';
export const NONCE = 'a'.repeat(32);

export const json = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);

export async function loadApis() {
  let v3 = null;
  let v3LoadError = null;
  try { v3 = await import('../../../lib/entity-created-workflow-continuity-v3.mjs'); }
  catch (error) { v3LoadError = error; }
  let grantApi = null;
  let grantLoadError = null;
  try { grantApi = await import('../../../lib/entity-created-workflow-replay-grant.mjs'); }
  catch (error) { grantLoadError = error; }
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const needV3 = (name) => {
    const fn = v3?.[name];
    assert(typeof fn === 'function', `缺 v3 生产导出 ${name}${v3LoadError ? `（${v3LoadError.code || v3LoadError.message}）` : ''}`);
    return fn;
  };
  const needGrant = (name) => {
    const fn = grantApi?.[name];
    assert(typeof fn === 'function', `缺回放票据生产导出 ${name}（${grantLoadError ? (grantLoadError.code || grantLoadError.message) : '模块在场但未导出'}）`);
    return fn;
  };
  return { v3, grantApi, needV3, needGrant };
}

// 五源精确字节 + 已签结构授权边（形状照 authority-cli 金牌的 bundle，保证 provenance 真闭合）
export function makeBundle(needV3, caseId, { audience = 'test' } = {}) {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
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
  const eventsBytes = json({ schemaVersion: 2, channel: 'web', caseId, events });
  const flowBytes = json({ caseId, confirmedBy: 'human', confirmedAt: '2026-08-04T00:00:00.000Z', flow: { id: caseId, name: 'P9 split', category: 'normal', steps: flowSteps } });
  const testcaseBytes = json({ schemaVersion: 1, caseId, channel: 'web', uniquePrefix: 'atl_', preconditions: ['已登录'], intents: [] });
  const profile = {
    background: [], successField: 'status', successValue: 200,
    workflows: {
      listApi: { pathname: '/api/workflows', method: 'GET', recordsPath: 'data.records', totalPath: 'data.total', queryParam: 'name', fields: { id: 'id', code: 'code', name: 'name' } },
      mutationAdapter: { method: 'POST', path: '/api/workflows/delete', idLocation: 'body.id' },
    },
  };
  const profileBytes = json(profile);
  const issued = needV3('issueCreatedWorkflowCompileProvenance')({ caseId, eventsBytes, confirmedFlowBytes: flowBytes });
  assert(issued.ok, `provenance 未闭合：${issued.reason}`);
  const compileProvenanceBytes = json(issued.provenance);
  const prepared = needV3('prepareCreatedWorkflowOwnershipDraft')({ caseId, eventsBytes, flowBytes, testcaseBytes, profileBytes, compileProvenanceBytes });
  assert(prepared.ok, `结构草案未过：${prepared.reason}`);
  // 夹具受众缺省 test（准入受众 CONTEXT.md:106：测试夹具标 test）——
  // 标 production 会先撞上凭据上下文门，本契约的钉就测不到本契约的缝。R12 需要一份 production 边。
  const frozen = needV3('freezeCreatedWorkflowOwnershipAuthority')({
    draft: prepared.draft, signerId: 'human', signedAt: '2026-08-04T00:00:00.000Z', audience,
  });
  assert(frozen.ok, `结构件冻结失败：${frozen.reason}`);
  return {
    caseId, profile, eventsBytes, flowBytes, testcaseBytes, profileBytes,
    compileProvenanceBytes, authorityBytes: json(frozen.authority),
  };
}

export function makeGrantDraft(needGrant, { cases, batchId = BATCH_ID, notAfter = NOT_AFTER, grantNonce = NONCE, audience = 'test' } = {}) {
  const drafted = needGrant('authorCreatedWorkflowReplayGrantDraft')({
    batchId, audience, notAfter, grantNonce,
    cases: cases.map((b) => ({ caseId: b.caseId, authorityBytes: b.authorityBytes })),
  });
  if (!drafted.ok) throw new Error(`票据草案未过：${drafted.reason}`);
  return drafted.draft;
}

export function makeGrant(needGrant, options) {
  const frozen = needGrant('freezeCreatedWorkflowReplayGrant')({
    draft: makeGrantDraft(needGrant, options), signerId: 'Steven', signedAt: '2026-08-04T00:00:00.000Z',
  });
  if (!frozen.ok) throw new Error(`票据冻结失败：${frozen.reason}`);
  return json(frozen.grant);
}

// 把一次回放所需的件全部落到临时目录
export function layout(dir, b, { grantBytes = null, expected = null } = {}) {
  const files = {
    events: join(dir, `${b.caseId}.events.json`),
    flow: join(dir, `${b.caseId}.flow.confirmed.json`),
    testcase: join(dir, `${b.caseId}.testcase.json`),
    profile: join(dir, `${b.caseId}.profile.json`),
    provenance: join(dir, `${b.caseId}.compile-provenance.json`),
    authority: join(dir, `${b.caseId}.created-workflow-authority.frozen.json`),
    expected: join(dir, `${b.caseId}.expected.frozen.json`),
    grant: join(dir, 'replay-grant.json'),
    out: join(dir, `${b.caseId}.axes.json`),
  };
  writeFileSync(files.events, b.eventsBytes);
  writeFileSync(files.flow, b.flowBytes);
  writeFileSync(files.testcase, b.testcaseBytes);
  writeFileSync(files.profile, b.profileBytes);
  writeFileSync(files.provenance, b.compileProvenanceBytes);
  writeFileSync(files.authority, b.authorityBytes);
  writeFileSync(files.expected, expected || json({ caseId: b.caseId, channel: 'web', intents: [], globalAssertions: [] }));
  if (grantBytes) writeFileSync(files.grant, grantBytes);
  return files;
}

// 回放实参：ledger 旗标恒传（评审 H-new——不传会先撞「缺旗标 exit 64」，钉不到目标拒因）
export function replayArgs(replayBin, files, { grantPath, ledgerRoot, batchToken, uniqueName, out }) {
  return [replayBin,
    '--events', files.events, '--flow', files.flow, '--case-meta', files.testcase,
    '--profile', files.profile, '--compile-provenance', files.provenance,
    '--created-workflow-authority', files.authority, '--expected', files.expected,
    ...(grantPath ? ['--replay-grant', grantPath] : []),
    ...(ledgerRoot ? ['--replay-grant-ledger', ledgerRoot] : []),
    '--batch-token', batchToken, '--unique-name', uniqueName,
    '--sut', 'http://127.0.0.1:1', '--out', out || files.out,
  ];
}
