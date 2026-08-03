#!/usr/bin/env node
// p9-tier2-final-batch —— P9 最终五成员同批验收的红先行金牌。
//
// 零 SUT（不访问被测系统）：全部输入均为脱敏合成对象。本金牌冻结的是最终交付门，
// 不放宽现役 tier-2 的「管线完成」定义；它在其后追加更严格的 P9 完成判据：
//   · manifest / receipts / reports 都必须恰好覆盖五个固定成员，且同一 batchId + invocationId；
//   · receipt 必须真跑完、未超时、child exit 0、归类问题为空、10 件附件逐件为 true；
//   · report 必须至少一条 PASS，其他三态为零，逐步全部 PASS；
//   · 三条工作流 mutation 必须 cleanupSatisfied=true，且当批 uniqueNameToken 两两不同；
//   · Chief 是会留下会话记录的 mutation，manifest 必须声明 perRunApproval，receipt 必须逐轮获准；
//   · 旧批、缺员、重员、exit 0 假 PASS、清理不闭合一律 fail-closed（默认拒绝）。
//
// 实现前预期：lib/p9-tier2-final-batch.mjs 不存在，T0-T9 全红，整体 exit 1。

const TAG = 'p9-tier2-final-batch';
const CASE_IDS = Object.freeze([
  'tc_agent_id_readback_real_uat_v1',
  'tc_chiefcomplaint_smoke',
  'tc_catalog_wf_crud',
  'tc_wf_publish_states',
  'tc_wf_history_version',
]);
const WORKFLOW_MUTATION_IDS = Object.freeze([
  'tc_catalog_wf_crud',
  'tc_wf_publish_states',
  'tc_wf_history_version',
]);
const CHIEF_ID = 'tc_chiefcomplaint_smoke';
const REQUIRED_ATTACHMENTS = Object.freeze([
  'axes.json',
  'verdict.json',
  'report-model.json',
  'run-history.jsonl',
  'run-metrics.json',
  'video.webm',
  'video.json',
  '<caseId>.report.html',
  '<caseId>.report.md',
  '<caseId>.report.json',
]);
const BATCH_ID = 'p9-final-batch-synthetic-001';
const INVOCATION_ID = 'invocation-synthetic-001';
const FRESH_AT = '2026-08-03T08:01:00.000Z';
const FRESHNESS_FLOOR = '2026-08-03T08:00:00.000Z';

const failures = [];
let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${TAG}: ${name}`);
  } catch (error) {
    const message = String(error?.message || error).slice(-1000);
    failures.push(`${name}: ${message}`);
    console.error(`RED  ${TAG}: ${name}: ${message}`);
  }
}

let api = null;
let importError = null;
try {
  api = await import('../../lib/p9-tier2-final-batch.mjs');
} catch (error) {
  importError = error;
}

function pure() {
  if (!api) {
    throw new Error(`最终批次 verifier 尚未实现：${String(importError?.message || importError).slice(-240)}`);
  }
  return api;
}

function member(caseId) {
  const effect = caseId === CASE_IDS[0] ? 'read' : 'mutation';
  return {
    caseId,
    effect,
    smokeAuthorized: true,
    ...(effect === 'mutation' ? { perRunApproval: true } : {}),
  };
}

function report(caseId) {
  return {
    schemaVersion: 1,
    artifactKind: 'casey-report-json',
    caseId,
    batchId: BATCH_ID,
    invocationId: INVOCATION_ID,
    generatedAt: FRESH_AT,
    verdictSummary: { PASS: 2, SUT_DEFECT: 0, HARNESS_ERROR: 0, NEEDS_HUMAN: 0 },
    steps: [
      { stepId: 'atstep_0', verdict: 'PASS' },
      { stepId: 'atstep_1', verdict: 'PASS' },
    ],
  };
}

function attachmentMap(caseId) {
  const names = REQUIRED_ATTACHMENTS.map((name) => name.replace('<caseId>', caseId));
  return Object.fromEntries(names.map((name) => [name, true]));
}

function receipt(caseId, index) {
  const workflowMutation = WORKFLOW_MUTATION_IDS.includes(caseId);
  const mutation = caseId !== CASE_IDS[0];
  return {
    schemaVersion: 2,
    artifactKind: 'tier2-run-receipt',
    caseId,
    batchId: BATCH_ID,
    invocationId: INVOCATION_ID,
    generatedAt: FRESH_AT,
    class: 'pipeline_complete_with_verdict',
    ran: true,
    timedOut: false,
    childExitCode: 0,
    classificationProblems: [],
    attachments: attachmentMap(caseId),
    verdictStateCounts: { PASS: 2, SUT_DEFECT: 0, HARNESS_ERROR: 0, NEEDS_HUMAN: 0 },
    approval: {
      smokeAuthorized: true,
      perRunApproved: mutation,
      source: 'signed-suite-manifest',
    },
    ...(workflowMutation ? {
      cleanupSatisfied: true,
      uniqueNameToken: `synthetic-unique-${index}`,
    } : {}),
  };
}

function validInput() {
  return {
    expectedBatchId: BATCH_ID,
    expectedInvocationId: INVOCATION_ID,
    freshnessFloor: FRESHNESS_FLOOR,
    manifest: {
      schemaVersion: 2,
      artifactKind: 'tier2-suite-manifest',
      signed: true,
      batchId: BATCH_ID,
      invocationId: INVOCATION_ID,
      members: CASE_IDS.map(member),
    },
    receipts: CASE_IDS.map(receipt),
    reports: CASE_IDS.map(report),
  };
}

function problemCodes(result) {
  return (Array.isArray(result?.problems) ? result.problems : [])
    .map((problem) => typeof problem === 'string' ? problem : problem?.code)
    .filter(Boolean);
}

function verify(input) {
  const result = pure().verifyP9FinalTier2Batch(input);
  assert(result && typeof result === 'object', 'verifier 须返回结构化对象');
  assert(typeof result.ok === 'boolean', 'verifier 结果须含布尔 ok');
  assert(Array.isArray(result.problems), 'verifier 结果须含 problems 数组');
  return result;
}

function expectRed(input, code) {
  const result = verify(input);
  assert(result.ok === false, `反例不得通过，实得 ${JSON.stringify(result)}`);
  assert(problemCodes(result).includes(code), `反例须含稳定码 ${code}，实得 ${problemCodes(result).join('/')}`);
}

await check('T0 导出面与固定五成员/三清理成员/10 附件清单精确', () => {
  const p = pure();
  assert(typeof p.verifyP9FinalTier2Batch === 'function', '须导出 verifyP9FinalTier2Batch');
  assert(JSON.stringify(p.P9_FINAL_TIER2_CASE_IDS) === JSON.stringify(CASE_IDS),
    `固定五成员须精确为 ${CASE_IDS.join('/')}`);
  assert(JSON.stringify(p.P9_FINAL_TIER2_CLEANUP_CASE_IDS) === JSON.stringify(WORKFLOW_MUTATION_IDS),
    `清理成员须精确为 ${WORKFLOW_MUTATION_IDS.join('/')}`);
  assert(JSON.stringify(p.P9_FINAL_TIER2_REQUIRED_ATTACHMENTS) === JSON.stringify(REQUIRED_ATTACHMENTS),
    '完整附件清单须精确为 7 个通用件 + 3 个按 caseId 命名的报告件');
});

await check('T1 五成员同批、全 PASS、三清理闭合、Chief 逐轮获准才绿', () => {
  const result = verify(validInput());
  assert(result.ok === true, `完整正控须绿，实得 ${JSON.stringify(result)}`);
  assert(result.problems.length === 0, '正控 problems 必须为空');
  assert(result.batchId === BATCH_ID && result.invocationId === INVOCATION_ID,
    '通过结果须回投精确 batchId + invocationId');
  assert(result.memberCount === 5 && result.cleanupSatisfiedCount === 3,
    '通过结果须明确五成员与三条 cleanupSatisfied');
});

await check('T2 manifest 缺一或重复都拒绝', () => {
  const missing = validInput();
  missing.manifest.members.pop();
  expectRed(missing, 'MANIFEST_MEMBER_SET_INVALID');

  const duplicate = validInput();
  duplicate.manifest.members[4] = { ...duplicate.manifest.members[3] };
  expectRed(duplicate, 'MANIFEST_MEMBER_SET_INVALID');
});

await check('T3 receipt/report 缺一、重复或越界成员都拒绝', () => {
  const receiptMissing = validInput();
  receiptMissing.receipts.pop();
  expectRed(receiptMissing, 'RECEIPT_MEMBER_SET_INVALID');

  const receiptDuplicate = validInput();
  receiptDuplicate.receipts[4] = structuredClone(receiptDuplicate.receipts[3]);
  expectRed(receiptDuplicate, 'RECEIPT_MEMBER_SET_INVALID');

  const reportOutOfSet = validInput();
  reportOutOfSet.reports[4].caseId = 'tc_synthetic_out_of_set';
  expectRed(reportOutOfSet, 'REPORT_MEMBER_SET_INVALID');
});

await check('T4 batchId/invocationId 任一不一致都拒绝', () => {
  for (const [field, bad] of [['batchId', 'different-batch'], ['invocationId', 'different-invocation']]) {
    const input = validInput();
    input.receipts[2][field] = bad;
    expectRed(input, 'BATCH_LINEAGE_MISMATCH');
  }
});

await check('T5 旧批产物即使名字相同也拒绝', () => {
  const input = validInput();
  input.receipts.forEach((item) => { item.generatedAt = '2026-08-02T08:01:00.000Z'; });
  input.reports.forEach((item) => { item.generatedAt = '2026-08-02T08:01:00.000Z'; });
  expectRed(input, 'BATCH_NOT_FRESH');
});

await check('T6 receipt 必须为真实 exit 0 完成件且恰好 10 个附件全真', () => {
  const mutations = [
    (r) => { r.class = 'stage_failed'; },
    (r) => { r.ran = false; },
    (r) => { r.timedOut = true; },
    (r) => { r.childExitCode = 1; },
    (r) => { r.classificationProblems = ['synthetic-problem']; },
    (r) => { r.attachments['video.webm'] = false; },
    (r) => { r.attachments['unexpected-extra.bin'] = true; },
  ];
  for (const mutate of mutations) {
    const input = validInput();
    mutate(input.receipts[0]);
    expectRed(input, 'RECEIPT_NOT_FINAL_PASS');
  }
});

await check('T7 exit 0 但 receipt 四态非全 PASS 仍拒绝', () => {
  const input = validInput();
  input.receipts[0].verdictStateCounts.PASS = 1;
  input.receipts[0].verdictStateCounts.NEEDS_HUMAN = 1;
  expectRed(input, 'RECEIPT_NOT_ALL_PASS');
});

await check('T8 report 须 PASS>0、其余三态为零且逐步全 PASS', () => {
  const summaryBad = validInput();
  summaryBad.reports[1].verdictSummary.PASS = 1;
  summaryBad.reports[1].verdictSummary.SUT_DEFECT = 1;
  expectRed(summaryBad, 'REPORT_NOT_ALL_PASS');

  const stepBad = validInput();
  stepBad.reports[1].steps[1].verdict = 'NEEDS_HUMAN';
  expectRed(stepBad, 'REPORT_NOT_ALL_PASS');

  const zeroStep = validInput();
  zeroStep.reports[1].verdictSummary.PASS = 0;
  zeroStep.reports[1].steps = [];
  expectRed(zeroStep, 'REPORT_NOT_ALL_PASS');
});

await check('T9 三条 cleanup 必须显式 true 且 uniqueNameToken 当批两两不同', () => {
  const falseCleanup = validInput();
  falseCleanup.receipts.find((r) => r.caseId === WORKFLOW_MUTATION_IDS[0]).cleanupSatisfied = false;
  expectRed(falseCleanup, 'CLEANUP_NOT_SATISFIED');

  const missingCleanup = validInput();
  delete missingCleanup.receipts.find((r) => r.caseId === WORKFLOW_MUTATION_IDS[1]).cleanupSatisfied;
  expectRed(missingCleanup, 'CLEANUP_NOT_SATISFIED');

  const duplicateToken = validInput();
  const workflowReceipts = duplicateToken.receipts.filter((r) => WORKFLOW_MUTATION_IDS.includes(r.caseId));
  workflowReceipts[1].uniqueNameToken = workflowReceipts[0].uniqueNameToken;
  expectRed(duplicateToken, 'UNIQUE_NAME_TOKEN_INVALID');
});

await check('T10 Chief 必须在 manifest 为 mutation/perRun，且本轮 receipt 已逐次获准', () => {
  const readChief = validInput();
  const readMember = readChief.manifest.members.find((m) => m.caseId === CHIEF_ID);
  readMember.effect = 'read';
  delete readMember.perRunApproval;
  expectRed(readChief, 'CHIEF_MUTATION_AUTHORITY_INVALID');

  const notApproved = validInput();
  notApproved.receipts.find((r) => r.caseId === CHIEF_ID).approval.perRunApproved = false;
  expectRed(notApproved, 'CHIEF_MUTATION_AUTHORITY_INVALID');
});

console.log(`${TAG}: ${passed}/${passed + failures.length}`);
if (failures.length) {
  console.error(`${TAG}: RED (${failures.length} failed)`);
  process.exitCode = 1;
} else {
  console.log(`${TAG}: GREEN`);
}
