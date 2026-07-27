import { validateZeroShotStepContractAuthority } from './step-contract.mjs';
import {
  inspectActionAdmissionAuthority,
  inspectActionReceiptAuthority,
} from './action-admission.mjs';
import { inspectProgressReceiptAuthority } from './progress-verifier.mjs';

function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

export function createExplorationTrace({
  stepContract,
  beforeObservation,
  admission,
  actionReceipt,
  afterObservation,
  progressReceipt,
} = {}) {
  const contractFacts = validateZeroShotStepContractAuthority(stepContract);
  const admissionFacts = inspectActionAdmissionAuthority(admission);
  const actionFacts = inspectActionReceiptAuthority(actionReceipt);
  const progressFacts = inspectProgressReceiptAuthority(progressReceipt);
  if (contractFacts?.ok !== true || admissionFacts?.ok !== true
    || actionFacts?.ok !== true || progressFacts?.ok !== true) return null;
  if (admissionFacts.state.stepContract !== stepContract
    || admissionFacts.state.observation !== beforeObservation
    || actionFacts.state.admission !== admission
    || progressFacts.state.actionReceipt !== actionReceipt
    || progressFacts.state.afterObservation !== afterObservation) return null;

  return deepFreeze({
    schemaVersion: 1,
    artifactKind: 'zero-shot-exploration-trace',
    caseId: contractFacts.caseId,
    intentId: contractFacts.intentId,
    steps: [{
      intentId: contractFacts.intentId,
      action: admission.action,
      source: admission.source,
      targetAffordanceId: admission.targetAffordanceId,
      beforeObservationId: beforeObservation.observationId,
      afterObservationId: afterObservation.observationId,
      progress: 'progressed',
    }],
    signed: false,
    replayReady: false,
  });
}
