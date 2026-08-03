const CASE_IDS = [
  'tc_agent_id_readback_real_uat_v1',
  'tc_chiefcomplaint_smoke',
  'tc_catalog_wf_crud',
  'tc_wf_publish_states',
  'tc_wf_history_version',
];

const CLEANUP_CASE_IDS = [
  'tc_catalog_wf_crud',
  'tc_wf_publish_states',
  'tc_wf_history_version',
];

const REQUIRED_ATTACHMENTS = [
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
];

const CHIEF_ID = 'tc_chiefcomplaint_smoke';
const NON_PASS_STATES = ['SUT_DEFECT', 'HARNESS_ERROR', 'NEEDS_HUMAN'];

export const P9_FINAL_TIER2_CASE_IDS = Object.freeze(CASE_IDS);
export const P9_FINAL_TIER2_CLEANUP_CASE_IDS = Object.freeze(CLEANUP_CASE_IDS);
export const P9_FINAL_TIER2_REQUIRED_ATTACHMENTS = Object.freeze(REQUIRED_ATTACHMENTS);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactMemberSet(items) {
  if (!Array.isArray(items) || items.length !== CASE_IDS.length) return false;
  const ids = items.map((item) => isRecord(item) ? item.caseId : undefined);
  return ids.every((id) => typeof id === 'string')
    && new Set(ids).size === CASE_IDS.length
    && CASE_IDS.every((id) => ids.includes(id));
}

function exactTrueAttachments(caseId, attachments) {
  if (!isRecord(attachments)) return false;
  const expected = REQUIRED_ATTACHMENTS.map((name) => name.replace('<caseId>', caseId));
  const actual = Object.keys(attachments);
  return actual.length === expected.length
    && expected.every((name) => attachments[name] === true)
    && actual.every((name) => expected.includes(name));
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function allPassCounts(counts) {
  return isRecord(counts)
    && positiveInteger(counts.PASS)
    && NON_PASS_STATES.every((state) => counts[state] === 0);
}

function freshAtOrAfter(generatedAt, freshnessFloor) {
  if (typeof generatedAt !== 'string' || typeof freshnessFloor !== 'string') return false;
  const generatedMs = Date.parse(generatedAt);
  const floorMs = Date.parse(freshnessFloor);
  return Number.isFinite(generatedMs) && Number.isFinite(floorMs) && generatedMs >= floorMs;
}

function addProblem(problems, code, details = {}) {
  problems.push({ code, ...details });
}

function lineageMatches(item, batchId, invocationId) {
  return isRecord(item) && item.batchId === batchId && item.invocationId === invocationId;
}

/**
 * Verify that one P9 tier-2 delivery batch is complete and internally consistent.
 * The verifier is deliberately side-effect free and fail-closed: malformed or
 * incomplete evidence is returned as a stable problem code, never as success.
 */
export function verifyP9FinalTier2Batch(input) {
  const problems = [];
  const source = isRecord(input) ? input : {};
  const manifest = isRecord(source.manifest) ? source.manifest : {};
  const receipts = Array.isArray(source.receipts) ? source.receipts : [];
  const reports = Array.isArray(source.reports) ? source.reports : [];
  const batchId = source.expectedBatchId;
  const invocationId = source.expectedInvocationId;

  if (!exactMemberSet(manifest.members)) {
    addProblem(problems, 'MANIFEST_MEMBER_SET_INVALID');
  }
  if (!exactMemberSet(receipts)) {
    addProblem(problems, 'RECEIPT_MEMBER_SET_INVALID');
  }
  if (!exactMemberSet(reports)) {
    addProblem(problems, 'REPORT_MEMBER_SET_INVALID');
  }

  const lineageItems = [manifest, ...receipts, ...reports];
  if (typeof batchId !== 'string' || batchId.length === 0
    || typeof invocationId !== 'string' || invocationId.length === 0
    || lineageItems.some((item) => !lineageMatches(item, batchId, invocationId))) {
    addProblem(problems, 'BATCH_LINEAGE_MISMATCH');
  }

  if (!freshAtOrAfter(source.freshnessFloor, source.freshnessFloor)
    || [...receipts, ...reports].some((item) => !freshAtOrAfter(item?.generatedAt, source.freshnessFloor))) {
    addProblem(problems, 'BATCH_NOT_FRESH');
  }

  const manifestShapeValid = manifest.schemaVersion === 2
    && manifest.artifactKind === 'tier2-suite-manifest'
    && manifest.signed === true;
  if (!manifestShapeValid) {
    addProblem(problems, 'MANIFEST_INVALID');
  }

  for (const receipt of receipts) {
    if (!isRecord(receipt)) {
      addProblem(problems, 'RECEIPT_NOT_FINAL_PASS');
      continue;
    }
    const finalPass = receipt.schemaVersion === 2
      && receipt.artifactKind === 'tier2-run-receipt'
      && receipt.class === 'pipeline_complete_with_verdict'
      && receipt.ran === true
      && receipt.timedOut === false
      && receipt.childExitCode === 0
      && Array.isArray(receipt.classificationProblems)
      && receipt.classificationProblems.length === 0
      && exactTrueAttachments(receipt.caseId, receipt.attachments);
    if (!finalPass) addProblem(problems, 'RECEIPT_NOT_FINAL_PASS', { caseId: receipt.caseId });
    if (!allPassCounts(receipt.verdictStateCounts)) {
      addProblem(problems, 'RECEIPT_NOT_ALL_PASS', { caseId: receipt.caseId });
    }
  }

  for (const report of reports) {
    if (!isRecord(report)) {
      addProblem(problems, 'REPORT_NOT_ALL_PASS');
      continue;
    }
    const steps = Array.isArray(report.steps) ? report.steps : [];
    const reportAllPass = report.schemaVersion === 1
      && report.artifactKind === 'casey-report-json'
      && allPassCounts(report.verdictSummary)
      && steps.length === report.verdictSummary?.PASS
      && steps.every((step) => isRecord(step) && step.verdict === 'PASS');
    if (!reportAllPass) addProblem(problems, 'REPORT_NOT_ALL_PASS', { caseId: report.caseId });
  }

  const cleanupReceipts = receipts.filter((receipt) => CLEANUP_CASE_IDS.includes(receipt?.caseId));
  if (cleanupReceipts.length !== CLEANUP_CASE_IDS.length
    || cleanupReceipts.some((receipt) => receipt.cleanupSatisfied !== true)) {
    addProblem(problems, 'CLEANUP_NOT_SATISFIED');
  }
  const cleanupTokens = cleanupReceipts.map((receipt) => receipt.uniqueNameToken);
  if (cleanupTokens.some((token) => typeof token !== 'string' || token.trim().length === 0)
    || new Set(cleanupTokens).size !== cleanupTokens.length) {
    addProblem(problems, 'UNIQUE_NAME_TOKEN_INVALID');
  }

  const chiefMember = Array.isArray(manifest.members)
    ? manifest.members.find((member) => member?.caseId === CHIEF_ID)
    : undefined;
  const chiefReceipt = receipts.find((receipt) => receipt?.caseId === CHIEF_ID);
  const chiefAuthorityValid = chiefMember?.effect === 'mutation'
    && chiefMember.smokeAuthorized === true
    && chiefMember.perRunApproval === true
    && chiefReceipt?.approval?.smokeAuthorized === true
    && chiefReceipt.approval.perRunApproved === true
    && chiefReceipt.approval.source === 'signed-suite-manifest';
  if (!chiefAuthorityValid) addProblem(problems, 'CHIEF_MUTATION_AUTHORITY_INVALID');

  return {
    ok: problems.length === 0,
    problems,
    batchId,
    invocationId,
    memberCount: exactMemberSet(receipts) ? receipts.length : 0,
    cleanupSatisfiedCount: cleanupReceipts.filter((receipt) => receipt.cleanupSatisfied === true).length,
  };
}
