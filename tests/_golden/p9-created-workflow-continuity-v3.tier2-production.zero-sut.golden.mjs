#!/usr/bin/env node
// P9 v3 窄验收：fresh 五成员 batch、三条 per-case token、产物投影、Tier2 cleanup 深消费。
// 零 SUT、零浏览器、零网络。

import { createP9Tier2BatchContext, P9_FINAL_TIER2_CASE_IDS, P9_FINAL_TIER2_CLEANUP_CASE_IDS } from '../../lib/p9-tier2-final-batch.mjs';
import { projectCreatedWorkflowCleanup } from '../../lib/selftest-tier2-projection.mjs';
import { buildTier2CleanupObligations } from '../../lib/selftest-tier2-collect.mjs';
import { judgeTier2CleanupObligations } from '../../lib/selftest-tier2.mjs';
import { validateSuiteManifestDoc } from '../../lib/selftest-tier2-manifest.mjs';

const failures = [];
let passed = 0;
const check = (condition, message) => { if (!condition) throw new Error(message); };
const test = (name, fn) => {
  try { fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
};

const batch = createP9Tier2BatchContext({
  batchId: 'tier2-p9-batch-fixture',
  batchToken: 'p9-batch-fixture',
  memberIds: [...P9_FINAL_TIER2_CASE_IDS].reverse(),
});

test('T1 五成员来序不影响 canonical batch，三条 token/name 逐例不同', () => {
  check(batch.ok, batch.reason);
  check(JSON.stringify(batch.memberIds) === JSON.stringify(P9_FINAL_TIER2_CASE_IDS), '未规范化 canonical 五员');
  const rows = Object.values(batch.cleanup);
  check(rows.length === 3 && new Set(rows.map((row) => row.uniqueNameToken)).size === 3, '三例 token 未唯一');
  rows.forEach((row, index) => {
    check(row.uniqueNameToken === `p9-batch-fixture-case-${index + 1}`, `第 ${index + 1} 例 token lineage 错`);
    check(row.derivedEntityName === `atl_${row.uniqueNameToken}`, '实体名未由 token 派生');
  });
});

test('T2 axes cleanup 与 report stableTargetAbsence 必须双证才投 cleanupSatisfied', () => {
  const axes = { cleanup: { cleanupSatisfied: true, sampleCount: 3, windowMs: 3000, batchToken: 'p9-batch-fixture', uniqueNameToken: 'p9-batch-fixture-case-1', entityName: 'atl_p9-batch-fixture-case-1' } };
  const good = projectCreatedWorkflowCleanup(axes, { cleanupEvidence: [{ op: 'stableTargetAbsence' }] });
  const missingReport = projectCreatedWorkflowCleanup(axes, { cleanupEvidence: [] });
  check(good.cleanupSatisfied === true && good.reportProjected === true, '双证正控未投影');
  check(missingReport.cleanupSatisfied === true && missingReport.reportProjected === false, '报告缺证被投成双证');
});

function completedCases(cleanupSatisfied = true) {
  return P9_FINAL_TIER2_CLEANUP_CASE_IDS.map((caseId) => {
    const row = batch.cleanup[caseId];
    return {
      caseId,
      receipt: {
        class: 'pipeline_complete_with_verdict',
        batchId: row.batchId,
        batchToken: row.batchToken,
        uniqueNameToken: row.uniqueNameToken,
        derivedEntityName: row.derivedEntityName,
        cleanupSatisfied,
      },
      projection: { verdict: { stateCounts: { PASS: 1, SUT_DEFECT: 0, HARNESS_ERROR: 0, NEEDS_HUMAN: 0 } } },
    };
  });
}

test('T3 production collector 生成 cleanupObligations，纯 Tier2 judge 深消费为绿', () => {
  const obligations = buildTier2CleanupObligations({
    batchContext: batch,
    cases: completedCases(true),
    selectedCaseIds: P9_FINAL_TIER2_CASE_IDS,
  });
  const judged = judgeTier2CleanupObligations(obligations);
  check(judged.ok && judged.cleanupSatisfied && judged.satisfiedCount === 3, JSON.stringify(judged));
});

test('T4 任一 cleanup false 或三例未全选，不能冒充正式清理批', () => {
  const bad = completedCases(true); bad[1].receipt.cleanupSatisfied = false;
  const obligations = buildTier2CleanupObligations({ batchContext: batch, cases: bad, selectedCaseIds: P9_FINAL_TIER2_CASE_IDS });
  check(judgeTier2CleanupObligations(obligations).ok === false, 'cleanup false 被洗绿');
  const partial = buildTier2CleanupObligations({ batchContext: batch, cases: completedCases(true), selectedCaseIds: ['tc_catalog_wf_crud'] });
  check(partial === null, '单例诊断被冒充三例正式批');
});

function manifest(includeV3) {
  const hash = 'a'.repeat(64);
  const members = P9_FINAL_TIER2_CASE_IDS.map((caseId) => {
    const artifacts = {
      [`cases/${caseId}/events.json`]: hash,
      [`cases/${caseId}/expected.frozen.json`]: hash,
      [`cases/${caseId}/profile.json`]: hash,
      [`cases/${caseId}/testcase.json`]: hash,
    };
    if (includeV3 && P9_FINAL_TIER2_CLEANUP_CASE_IDS.includes(caseId)) {
      artifacts[`cases/${caseId}/flow.confirmed.json`] = hash;
      artifacts[`cases/${caseId}/compile-provenance.json`] = hash;
      artifacts[`cases/${caseId}/created-workflow-authority.frozen.json`] = hash;
    }
    return {
      caseId,
      effect: P9_FINAL_TIER2_CLEANUP_CASE_IDS.includes(caseId) ? 'mutation' : 'read',
      smokeAuthorized: true,
      ...(P9_FINAL_TIER2_CLEANUP_CASE_IDS.includes(caseId) ? { perRunApproval: true } : {}),
      timeoutMs: 600000,
      cleanupObligation: '在册',
      artifacts,
    };
  });
  return {
    schemaVersion: 2, artifactKind: 'tier2-suite-manifest', signed: true,
    signerId: 'human', signedAt: '2026-08-03T00:00:00.000Z', caseLimit: 5,
    winProbeResultPath: 'runs/_tier2/win.json', outOfBandReceiptPath: 'runs/_tier2/oob.json',
    // p9-replay-authority-split amendment：清单顶层新增批级回放票据落点（只加严，成员面未动）
    replayGrantPath: 'runs/_tier2/replay-grant.json',
    historicalPrecedents: [{ id: 'p', path: 'runs/p.json', sha256: hash, attestedIn: 'docs/p.md' }],
    members,
  };
}

test('T5 人签 Tier2 manifest 不带三例 v3 三件即结构红', () => {
  const old = validateSuiteManifestDoc(manifest(false));
  const current = validateSuiteManifestDoc(manifest(true));
  check(old.ok === false && old.problems.some((problem) => problem.includes('未接 created-workflow v3')), '旧残留型 manifest 未红');
  check(current.ok === true, current.problems.join('；'));
});

console.log(`p9-v3-tier2-production: ${passed}/${passed + failures.length}`);
if (failures.length) process.exitCode = 1;
