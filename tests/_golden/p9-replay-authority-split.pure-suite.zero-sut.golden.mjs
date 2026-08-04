#!/usr/bin/env node
// P9 回放授权票据 · 纯层与采集面（草案，未冻结）
// 零 SUT、零浏览器、零网络、零子进程；只调生产纯函数。
// 拆二理由见 plan §5：命令行边界与批会话协议在 cli-session 那枚。

import { readFileSync } from 'node:fs';
import {
  CASE_A, CASE_B, BATCH_ID, NONCE,
  json, loadApis, makeBundle, makeGrant,
} from './support/p9-replay-grant-fixtures.mjs';

const failures = [];
let passed = 0;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${String(error?.message || error)}`); console.error(`FAIL ${name}: ${String(error?.message || error)}`); }
}

const { needV3, needGrant } = await loadApis();
const bundle = (caseId, options) => makeBundle(needV3, caseId, options);
const grantOf = (options) => makeGrant(needGrant, options);
const NOW = '2026-08-04T01:00:00.000Z';
const BATCH_TOKEN = 'p9-batch-alpha';

// ══ R3a　回放票据喂结构面 reader（回归守钉）════════════════════
await test('R3a 回放票据喂结构面 reader → 拒（既有形状守卫的回归钉，非新增拦截力）', async () => {
  const b = bundle(CASE_A);
  const got = needV3('readCreatedWorkflowOwnershipAuthority')({
    caseId: b.caseId, authorityBytes: grantOf({ cases: [b] }),
    eventsBytes: b.eventsBytes, flowBytes: b.flowBytes,
    testcaseBytes: b.testcaseBytes, profileBytes: b.profileBytes,
  });
  assert(got.ok === false, '回放票据被结构面 reader 收下');
  assert(got.reason === 'CREATED_WORKFLOW_AUTHORITY_INVALID', `拒因非预期：${got.reason}`);
});

// ══ R4　跨案冒用：摘要链不合 ═══════════════════════════════════
await test('R4 A 案票据配 B 案结构件 → 摘要链不合而拒；同案配对正控须过', async () => {
  const a = bundle(CASE_A);
  const b = bundle(CASE_B);
  const read = needGrant('readCreatedWorkflowReplayGrant');
  const grantBytes = grantOf({ cases: [a] });
  const paired = read({
    batchId: BATCH_ID, grantBytes,
    cases: [{ caseId: a.caseId, authorityBytes: b.authorityBytes }], now: NOW,
  });
  assert(paired.ok === false, 'A 案票据配 B 案结构件被收下');
  assert(paired.reason === 'REPLAY_GRANT_AUTHORITY_CHAIN_MISMATCH', `拒因非预期：${paired.reason}`);
  const matched = read({
    batchId: BATCH_ID, grantBytes,
    cases: [{ caseId: a.caseId, authorityBytes: a.authorityBytes }], now: NOW,
  });
  assert(matched.ok === true, `同案配对正控未过：${matched.reason}`);
});

// ══ R5　批会话判定（纯 judge，吃读快照）════════════════════════
// 评审 M-new1 裁定：台账形状唯一——每 nonce 一目录 + wx 标记文件；judge 只吃读快照，
// 不碰文件系统、不注入写者。真原子性由 'wx' 在命令行面保证（cli-session 的 R10/R18）。
await test('R5 批会话纯判定：首成员放行 / 同批次成员放行 / 同成员重跑拒 / 异 token 拒', async () => {
  const judge = needGrant('judgeReplayGrantBatchSession');
  const base = { grantNonce: NONCE, batchToken: BATCH_TOKEN, grantCaseIds: [CASE_A, CASE_B] };
  // ① 会话未开：首成员放行
  const first = judge({ ...base, caseId: CASE_A, sessionSnapshot: null, consumedCaseIds: [] });
  assert(first.ok === true && first.allowLaunch === true, `首成员未放行：${first.reason}`);
  // ② 会话已开、同 token、成员未消费：放行（C-new 的正控——否则整批跑不完）
  const second = judge({
    ...base, caseId: CASE_B,
    sessionSnapshot: { batchToken: BATCH_TOKEN, occupiedAt: NOW }, consumedCaseIds: [CASE_A],
  });
  assert(second.ok === true && second.allowLaunch === true, `同批第二成员被误拒：${second.reason}`);
  // ③ 同成员重跑：拒
  const repeat = judge({
    ...base, caseId: CASE_A,
    sessionSnapshot: { batchToken: BATCH_TOKEN, occupiedAt: NOW }, consumedCaseIds: [CASE_A],
  });
  assert(repeat.allowLaunch === false, '同成员重跑被放行');
  assert(repeat.reason === 'REPLAY_GRANT_MEMBER_ALREADY_CONSUMED', `拒因非预期：${repeat.reason}`);
  // ④ 异 batchToken：重放，拒
  const replayed = judge({
    ...base, caseId: CASE_B,
    sessionSnapshot: { batchToken: 'p9-batch-beta', occupiedAt: NOW }, consumedCaseIds: [],
  });
  assert(replayed.allowLaunch === false, '异 batchToken 被放行');
  assert(replayed.reason === 'REPLAY_GRANT_BATCH_SESSION_MISMATCH', `拒因非预期：${replayed.reason}`);
  // ⑤ 成员不在票据授权集内：拒
  const stranger = judge({
    ...base, caseId: 'tc_not_in_grant',
    sessionSnapshot: { batchToken: BATCH_TOKEN, occupiedAt: NOW }, consumedCaseIds: [],
  });
  assert(stranger.allowLaunch === false, '未授权成员被放行');
  assert(stranger.reason === 'REPLAY_GRANT_CASE_NOT_AUTHORIZED', `拒因非预期：${stranger.reason}`);
});

// ══ R6　纯层强制：不给票据造不出回放控制器 ══════════════════════
await test('R6 controller 缺 grant handle → allowLaunch:false（授权闸下沉纯层）', async () => {
  const b = bundle(CASE_A);
  const got = needV3('readCreatedWorkflowOwnershipAuthority')({
    caseId: b.caseId, authorityBytes: b.authorityBytes,
    eventsBytes: b.eventsBytes, flowBytes: b.flowBytes,
    testcaseBytes: b.testcaseBytes, profileBytes: b.profileBytes,
  });
  assert(got.ok, `结构件读回失败：${got.reason}`);
  const opened = needV3('createCreatedWorkflowReplayContinuityController')({
    caseId: b.caseId, runId: 'run-1', batchToken: 'batch-1',
    uniqueNameToken: 'batch-1-case-1', authority: got.handle, profile: b.profile,
  });
  assert(opened.ok === false && opened.allowLaunch === false,
    '纯层未强制回放票据：无票也能造出控制器（CLI 单点拦即可被旁路调用方绕开）');
  assert(opened.reason === 'CREATED_WORKFLOW_REPLAY_GRANT_MISSING', `拒因非预期：${opened.reason}`);
});

// ══ R7　清单顶层 replayGrantPath ══════════════════════════════
await test('R7 清单未声明 replayGrantPath 或路径越界 → 结构红；正控须过', async () => {
  const { validateSuiteManifestDoc } = await import('../../lib/selftest-tier2-manifest.mjs');
  const hash = 'a'.repeat(64);
  const cleanupIds = ['tc_catalog_wf_crud', 'tc_wf_publish_states', 'tc_wf_history_version'];
  const allIds = ['tc_agent_id_readback_real_uat_v1', 'tc_chiefcomplaint_smoke', ...cleanupIds];
  const build = () => ({
    schemaVersion: 2, artifactKind: 'tier2-suite-manifest', signed: true,
    signerId: 'Steven', signedAt: '2026-08-04T00:00:00.000Z', caseLimit: 5,
    winProbeResultPath: 'runs/_tier2/win.json',
    outOfBandReceiptPath: 'runs/_tier2/oob.json',
    replayGrantPath: 'runs/_tier2/replay-grant.json',
    historicalPrecedents: [{ id: 'p', path: 'runs/p.json', sha256: hash, attestedIn: 'docs/p.md' }],
    members: allIds.map((caseId) => {
      const artifacts = {
        [`cases/${caseId}/events.json`]: hash,
        [`cases/${caseId}/expected.frozen.json`]: hash,
        [`cases/${caseId}/profile.json`]: hash,
        [`cases/${caseId}/testcase.json`]: hash,
      };
      if (cleanupIds.includes(caseId)) {
        artifacts[`cases/${caseId}/flow.confirmed.json`] = hash;
        artifacts[`cases/${caseId}/compile-provenance.json`] = hash;
        artifacts[`cases/${caseId}/created-workflow-authority.frozen.json`] = hash;
      }
      return {
        caseId,
        effect: cleanupIds.includes(caseId) ? 'mutation' : 'read',
        smokeAuthorized: true,
        ...(cleanupIds.includes(caseId) ? { perRunApproval: true } : {}),
        timeoutMs: 600000, cleanupObligation: '在册', artifacts,
      };
    }),
  });
  assert(validateSuiteManifestDoc(build()).ok === true,
    `带 replayGrantPath 的正控未过：${validateSuiteManifestDoc(build()).problems.join('；')}`);
  const absent = build(); delete absent.replayGrantPath;
  assert(validateSuiteManifestDoc(absent).ok === false, '清单缺 replayGrantPath 未红');
  const escaped = build(); escaped.replayGrantPath = 'runs/../../etc/x.json';
  assert(validateSuiteManifestDoc(escaped).ok === false, 'replayGrantPath 含上跳段未红');
  const outside = build(); outside.replayGrantPath = 'cases/replay-grant.json';
  assert(validateSuiteManifestDoc(outside).ok === false, 'replayGrantPath 越出 runs/ 未红');
  // 成员面零翻的守钉：v3 三件仍是三件，没被顺手改成四件
  const slipped = build();
  delete slipped.members[2].artifacts['cases/tc_catalog_wf_crud/flow.confirmed.json'];
  assert(validateSuiteManifestDoc(slipped).ok === false, 'v3 三件成组约束被削弱');
});

// ══ R11　采集面 fail-closed：无有效票据 → 拒跑 + 回执 ═══════════
await test('R11 Tier2 无有效票据 → 三例拒跑、要求落拒跑回执；有效票据不得误拦', async () => {
  const screen = needGrant('screenTier2ReplayGrant');
  const cleanupIds = ['tc_catalog_wf_crud', 'tc_wf_publish_states', 'tc_wf_history_version'];
  for (const caseId of cleanupIds) {
    const refused = screen({
      member: { caseId, effect: 'mutation', smokeAuthorized: true },
      grantRead: { ok: false, reason: 'REPLAY_GRANT_ARTIFACT_KIND_INVALID' },
    });
    assert(refused.ran === false, `${caseId} 在票据无效时仍被放跑`);
    assert(refused.refusalReason === 'replay_grant_absent_or_invalid',
      `${caseId} 拒跑原因未具名：${refused.refusalReason}`);
    assert(refused.receiptRequired === true, `${caseId} 拒跑未要求落回执`);
  }
  const allowed = screen({
    member: { caseId: 'tc_catalog_wf_crud', effect: 'mutation', smokeAuthorized: true },
    grantRead: { ok: true, caseIds: cleanupIds },
  });
  assert(allowed.ran === true, `有效票据被采集闸误拦：${allowed.refusalReason}`);
});

// ══ R11b　采集层必须真的接线（评审 M-new3）═════════════════════
// 只钉纯函数会留「R11 绿、采集照跑」的缝：采集编排层必须实际调用该筛并落拒跑回执。
await test('R11b 采集编排层已接线：无票时不 spawn 子进程且落拒跑回执', async () => {
  const collect = await import('../../lib/selftest-tier2-collect.mjs');
  const gate = collect.screenTier2CaseReplayGrant ?? collect.buildTier2ReplayGrantScreen;
  assert(typeof gate === 'function',
    '采集层未导出回放票据拒跑筛：R11 的纯函数绿不代表采集真接线（评审 M-new3）');
  const outcome = gate({
    members: [{ caseId: 'tc_catalog_wf_crud', effect: 'mutation', smokeAuthorized: true }],
    grantRead: { ok: false, reason: 'REPLAY_GRANT_EXPIRED' },
  });
  assert(Array.isArray(outcome?.refusals) && outcome.refusals.length === 1,
    '采集层未产出拒跑清单');
  assert(outcome.refusals[0].receiptRequired === true, '采集层拒跑未要求落回执');
  assert(outcome.spawnAllowed === false, '采集层在无有效票据时仍允许 spawn 子进程');
});

// ══ R12　票据受众必须逐字等于结构件受众 ════════════════════════
await test('R12 票据 audience 与结构件 audience 不等 → 具名拒（两向都拒）', async () => {
  const read = needGrant('readCreatedWorkflowReplayGrant');
  const structuralTest = bundle(CASE_A, { audience: 'test' });
  const structuralProd = bundle(CASE_B, { audience: 'production' });
  const mismatch1 = read({
    batchId: BATCH_ID, grantBytes: grantOf({ cases: [structuralTest], audience: 'production' }),
    cases: [{ caseId: structuralTest.caseId, authorityBytes: structuralTest.authorityBytes }], now: NOW,
  });
  assert(mismatch1.ok === false, '生产票配测试边被收下');
  assert(mismatch1.reason === 'REPLAY_GRANT_AUDIENCE_MISMATCH', `拒因非预期：${mismatch1.reason}`);
  const mismatch2 = read({
    batchId: BATCH_ID, grantBytes: grantOf({ cases: [structuralProd], audience: 'test' }),
    cases: [{ caseId: structuralProd.caseId, authorityBytes: structuralProd.authorityBytes }], now: NOW,
  });
  assert(mismatch2.ok === false, '测试票配生产边被收下');
  assert(mismatch2.reason === 'REPLAY_GRANT_AUDIENCE_MISMATCH', `反向拒因非预期：${mismatch2.reason}`);
});


// ══ R11c　真调用点：executeTier2 成员循环必须调闸（实现审 H1）════════
// R11b 只钉住「模块导出了闸函数」——死导出照样绿。实现审逮到的正是这个假绿：
// 成员循环当时无条件 runOneCase，零读票据、零拒跑回执。本钉钉到**调用点**：
// 无有效票据时，变更型成员一个子进程都不许起，且拒跑回执必须落。
await test('R11c executeTier2 在无有效票据时对变更型成员零 spawn 且落拒跑回执', async () => {
  const collect = await import('../../lib/selftest-tier2-collect.mjs');
  const readBatch = collect.readBatchReplayGrant;
  assert(typeof readBatch === 'function', '采集层未导出整批票据读回（成员循环无从取票）');

  // 清单未声明 replayGrantPath → 整批票据读回必须为拒（不是「没配置就放行」）
  const noPath = readBatch({ json: {}, members: [] }, { cleanup: { tc_catalog_wf_crud: {} } });
  assert(noPath.grantRead.ok === false, '清单未声明票据路径却放行（fail-open）');
  assert(noPath.grantRead.reason === 'REPLAY_GRANT_PATH_NOT_DECLARED',
    `拒因非预期：${noPath.grantRead.reason}`);
  assert(Array.isArray(noPath.problems) && noPath.problems.length > 0, '未把票据缺席记进消费端问题');

  // 无 v3 成员的批次不受本闸影响（豁免面 plan §4.1，避免钉成「全都拒」）
  const noCleanup = readBatch({ json: {} }, { cleanup: {} });
  assert(noCleanup.grantRead.ok === true, '无变更型成员的批次被票据闸误拦');

  // 拒跑判定必须落到「零 spawn + 要回执」
  const refused = collect.screenTier2CaseReplayGrant({
    members: [{ caseId: 'tc_catalog_wf_crud', effect: 'mutation', smokeAuthorized: true }],
    grantRead: noPath.grantRead,
  });
  assert(refused.spawnAllowed === false, '无票仍允许 spawn');
  assert(refused.refusals[0]?.receiptRequired === true, '无票拒跑未要求落回执');

  // 源形态钉：成员循环里必须真的调用它，且拒跑分支在 runOneCase 之前
  const src = readFileSync(new URL('../../lib/selftest-tier2-collect.mjs', import.meta.url), 'utf8');
  const callIdx = src.indexOf('screenTier2CaseReplayGrant({');
  const runIdx = src.indexOf('runOneCase({\n      member,');
  assert(callIdx > 0, '成员循环未调用回放票据闸（死导出）');
  assert(runIdx > 0 && callIdx < runIdx, '票据闸不在 runOneCase 之前，拒跑挡不住 spawn');
});

// ══ R11d　casey run 面双旗标必填并透传（实现审 H2）════════════════
await test('R11d casey run 在 v3 链上缺票据旗标 → exit 64 具名；透传形状完整', async () => {
  const { spawnSync } = await import('node:child_process');
  const { join, resolve } = await import('node:path');
  const root = resolve(import.meta.dirname, '..', '..');
  const r = spawnSync(process.execPath, [join(root, 'bin', 'casey.mjs'), 'run', 'tc_catalog_wf_crud',
    '--sut', 'http://127.0.0.1:1', '--created-workflow-authority', join(root, 'nonexistent-authority.json'),
    '--batch-token', 'b1', '--unique-name', 'b1-case-1'], { encoding: 'utf8' });
  const output = `${r.stdout}${r.stderr}`;
  assert(r.status === 64, `应用参错误 exit 64，实际 ${r.status}`);
  assert(output.includes('--replay-grant'), `缺件清单未具名 --replay-grant（尾段：${output.slice(-240)}）`);
  // 透传形状：两个旗标都要真的接到 replay 命令行上，否则子进程照样无票
  const runSrc = readFileSync(new URL('../../bin/casey.mjs', import.meta.url), 'utf8');
  assert(runSrc.includes("'--replay-grant', opts['replay-grant']"), 'casey run 未透传 --replay-grant');
  assert(runSrc.includes("'--replay-grant-ledger', opts['replay-grant-ledger']"), 'casey run 未透传 --replay-grant-ledger');
});

console.log(`p9-replay-authority-split-pure-suite: ${passed}/${passed + failures.length}`);
if (failures.length) process.exitCode = 1;
