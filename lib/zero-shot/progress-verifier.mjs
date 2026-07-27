import { validateZeroShotStepContractAuthority } from './step-contract.mjs';
import { inspectObservationAuthority } from './affordance-catalog.mjs';
import { inspectActionReceiptAuthority } from './action-admission.mjs';

const PROGRESS_RECEIPT_STATE = new WeakMap();

function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function pending(reason) {
  return Object.freeze({ status: 'pending', reason, progressReceipt: null });
}

function matchesPath(pathname, expected) {
  if (expected.kind !== 'urlPathname') return false;
  if (expected.op === 'equals') return pathname === expected.value;
  if (expected.op === 'startsWith') return pathname.startsWith(expected.value);
  return false;
}

export function verifyStepProgress({
  stepContract,
  beforeObservation,
  actionReceipt,
  afterObservation,
  afterObservationAuthority,
} = {}) {
  const contractFacts = validateZeroShotStepContractAuthority(stepContract);
  if (contractFacts?.ok !== true) return pending('CONTRACT_AUTHORITY_INVALID');

  const actionFacts = inspectActionReceiptAuthority(actionReceipt);
  if (actionFacts?.ok !== true) return pending('ACTION_RECEIPT_AUTHORITY_INVALID');
  if (actionFacts.state.stepContract !== stepContract
    || actionFacts.state.beforeObservation !== beforeObservation) {
    return pending('ACTION_RECEIPT_AUTHORITY_INVALID');
  }

  const afterFacts = inspectObservationAuthority({
    observation: afterObservation,
    observationAuthority: afterObservationAuthority,
  });
  if (afterFacts?.ok !== true) {
    return pending(afterFacts?.reason === 'AUTHORITY_INVALID'
      ? 'OBSERVATION_AUTHORITY_INVALID'
      : (afterFacts?.reason || 'OBSERVATION_AUTHORITY_MISMATCH'));
  }
  if (afterFacts.lineageToken !== actionFacts.state.lineageToken) {
    return pending('OBSERVATION_LINEAGE_MISMATCH');
  }
  if (afterObservation.settled !== true) return pending('OBSERVATION_UNSETTLED');

  const expected = contractFacts.expectedProgress;
  const beforeMatched = expected.every((item) => matchesPath(beforeObservation.urlPathname, item));
  const afterMatched = expected.every((item) => matchesPath(afterObservation.urlPathname, item));
  if (beforeMatched) return pending('EXPECTED_PROGRESS_NOT_CAUSED');
  if (!afterMatched) return pending('EXPECTED_PROGRESS_NOT_PROVED');

  const progressReceipt = deepFreeze({
    schemaVersion: 1,
    artifactKind: 'zero-shot-progress-receipt',
    intentId: contractFacts.intentId,
    beforeObservationId: beforeObservation.observationId,
    afterObservationId: afterObservation.observationId,
    conditionKind: 'urlPathname',
    status: 'progressed',
    signed: false,
    replayReady: false,
  });
  PROGRESS_RECEIPT_STATE.set(progressReceipt, Object.freeze({
    stepContract,
    beforeObservation,
    actionReceipt,
    afterObservation,
  }));
  return Object.freeze({ status: 'progressed', reason: null, progressReceipt });
}

export function inspectProgressReceiptAuthority(progressReceipt) {
  const state = progressReceipt && typeof progressReceipt === 'object'
    ? PROGRESS_RECEIPT_STATE.get(progressReceipt)
    : null;
  if (!state) return Object.freeze({ ok: false, reason: 'PROGRESS_RECEIPT_AUTHORITY_INVALID' });
  return Object.freeze({ ok: true, reason: null, state });
}
