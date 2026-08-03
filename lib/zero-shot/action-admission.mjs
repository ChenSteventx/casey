import { inspectObservationAuthority, resolveCatalogTarget } from './affordance-catalog.mjs';
import { validateZeroShotStepContractAuthority } from './step-contract.mjs';
import { validateDeterministicResolutionAuthority } from './deterministic-resolver.mjs';
import { validateActionProposalAuthority } from './action-proposal.mjs';
import { isReadSafeZeroShotTarget } from './read-safe-target.mjs';
import { anyUnsupportedScope } from './unsupported-scopes.mjs';

const ADMISSION_STATE = new WeakMap();
const ACTION_RECEIPT_STATE = new WeakMap();
const ADMISSION_RESERVATIONS = new WeakMap();

function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function denied(reason) {
  return Object.freeze({ ok: false, reason, admission: null });
}

function observationBlocker(observation) {
  if (!observation || typeof observation !== 'object') return null;
  if (observation.settled !== true) return 'OBSERVATION_UNSETTLED';
  if (observation.truncated === true) return 'CATALOG_TRUNCATED';
  if (anyUnsupportedScope(observation.unsupportedScopes)) return 'UNSUPPORTED_SCOPE';
  return null;
}

function selectedAuthority({ resolution, proposal, stepContract, observation }) {
  if (resolution && proposal) return denied('ACTION_SOURCE_AMBIGUOUS');
  if (resolution) {
    const checked = validateDeterministicResolutionAuthority({
      resolution,
      stepContract,
      observation,
    });
    return checked?.ok === true
      ? { ok: true, source: 'deterministic', artifact: resolution, checked }
      : denied(checked?.reason || 'RESOLUTION_AUTHORITY_INVALID');
  }
  if (proposal) {
    const checked = validateActionProposalAuthority({
      proposal,
      stepContract,
      observation,
    });
    return checked?.ok === true
      ? { ok: true, source: 'proposal', artifact: proposal, checked }
      : denied(checked?.reason || 'PROPOSAL_AUTHORITY_INVALID');
  }
  return denied('ACTION_SOURCE_MISSING');
}

export async function admitZeroShotAction({
  stepContract,
  observation,
  observationAuthority,
  resolution,
  proposal,
  identityAdmission,
} = {}) {
  const contractFacts = validateZeroShotStepContractAuthority(stepContract);
  if (contractFacts?.ok !== true) return denied('CONTRACT_AUTHORITY_INVALID');

  const observationFacts = inspectObservationAuthority({
    observation,
    observationAuthority,
  });
  if (observationFacts?.ok !== true) {
    return denied(observationFacts?.reason === 'AUTHORITY_INVALID'
      ? 'OBSERVATION_AUTHORITY_INVALID'
      : (observationFacts?.reason || 'OBSERVATION_AUTHORITY_INVALID'));
  }

  if (identityAdmission?.required === true) {
    return denied('ENTITY_IDENTITY_PENDING');
  }

  const blocker = observationBlocker(observation);
  if (blocker) return denied(blocker);

  const selected = selectedAuthority({ resolution, proposal, stepContract, observation });
  if (selected.ok !== true) return selected;

  const targetAffordanceId = selected.artifact?.targetAffordanceId;
  if (typeof targetAffordanceId !== 'string' || !/^af_[A-Za-z0-9_-]+$/.test(targetAffordanceId)) {
    return denied(selected.source === 'proposal'
      ? 'PROPOSAL_AUTHORITY_INVALID'
      : 'RESOLUTION_AUTHORITY_INVALID');
  }
  const publicTargets = observation.affordances
    .filter((item) => item?.affordanceId === targetAffordanceId);
  if (publicTargets.length !== 1
    || !isReadSafeZeroShotTarget(publicTargets[0].semantic)) {
    return denied('ACTION_TARGET_NOT_READ_SAFE');
  }
  if (ADMISSION_RESERVATIONS.has(observationAuthority)) {
    return denied('OBSERVATION_ALREADY_ADMITTED');
  }
  ADMISSION_RESERVATIONS.set(observationAuthority, Object.freeze({ targetAffordanceId }));

  const resolved = await resolveCatalogTarget({
    observation,
    observationAuthority,
    targetAffordanceId,
  });
  if (resolved?.ok !== true || !resolved.target) {
    const reason = resolved?.reason === 'AUTHORITY_INVALID'
      ? 'OBSERVATION_AUTHORITY_INVALID'
      : (resolved?.reason || 'OBSERVATION_AUTHORITY_INVALID');
    return denied(reason);
  }

  const { target } = resolved;
  if (!isReadSafeZeroShotTarget(target.semanticSignature)) {
    return denied('ACTION_TARGET_NOT_READ_SAFE');
  }
  const admission = deepFreeze({
    schemaVersion: 1,
    artifactKind: 'zero-shot-action-admission',
    observationId: observation.observationId,
    intentId: contractFacts.intentId,
    targetAffordanceId,
    action: contractFacts.action,
    source: selected.source,
    signed: false,
    replayReady: false,
  });
  ADMISSION_STATE.set(admission, {
    consumed: false,
    stepContract,
    observation,
    observationAuthority,
    driver: target.driver,
    handle: target.handle,
    revision: target.revision,
    semanticSignature: target.semanticSignature,
    lineageToken: target.lineageToken,
  });
  return Object.freeze({ ok: true, reason: null, admission });
}

export function inspectActionAdmissionAuthority(admission) {
  const state = admission && typeof admission === 'object'
    ? ADMISSION_STATE.get(admission)
    : null;
  if (!state) return Object.freeze({ ok: false, reason: 'ADMISSION_AUTHORITY_INVALID' });
  return Object.freeze({
    ok: true,
    reason: null,
    state: Object.freeze({
      stepContract: state.stepContract,
      observation: state.observation,
    }),
  });
}

function consumeActionAdmissionAuthority(admission) {
  const state = admission && typeof admission === 'object'
    ? ADMISSION_STATE.get(admission)
    : null;
  if (!state) return Object.freeze({ ok: false, reason: 'ADMISSION_AUTHORITY_INVALID' });
  if (state.consumed) {
    return Object.freeze({ ok: false, reason: 'ADMISSION_ALREADY_CONSUMED' });
  }
  state.consumed = true;
  return Object.freeze({ ok: true, reason: null, state });
}

export async function executeWithAdmissionAuthority(admission) {
  const consumed = consumeActionAdmissionAuthority(admission);
  if (consumed?.ok !== true) {
    return Object.freeze({ ok: false, reason: consumed?.reason || 'ADMISSION_AUTHORITY_INVALID' });
  }
  const { state } = consumed;
  const currentObservation = inspectObservationAuthority({
    observation: state.observation,
    observationAuthority: state.observationAuthority,
  });
  if (currentObservation?.ok !== true) {
    return Object.freeze({
      ok: false,
      reason: currentObservation?.reason === 'AUTHORITY_INVALID'
        ? 'OBSERVATION_AUTHORITY_INVALID'
        : (currentObservation?.reason || 'OBSERVATION_AUTHORITY_INVALID'),
    });
  }
  const currentTarget = await resolveCatalogTarget({
    observation: state.observation,
    observationAuthority: state.observationAuthority,
    targetAffordanceId: admission.targetAffordanceId,
  });
  if (currentTarget?.ok !== true || !currentTarget.target) {
    return Object.freeze({
      ok: false,
      reason: currentTarget?.reason === 'AUTHORITY_INVALID'
        ? 'OBSERVATION_AUTHORITY_INVALID'
        : (currentTarget?.reason || 'AFFORDANCE_REVALIDATION_FAILED'),
    });
  }
  try {
    const fact = await currentTarget.target.driver.perform({
      handle: currentTarget.target.handle,
      action: admission.action,
    });
    if (fact?.performed !== true) {
      return Object.freeze({ ok: false, reason: 'ACTION_EXECUTION_FAILED' });
    }
  } catch {
    return Object.freeze({ ok: false, reason: 'ACTION_EXECUTION_FAILED' });
  }
  const afterPerformObservation = inspectObservationAuthority({
    observation: state.observation,
    observationAuthority: state.observationAuthority,
  });
  if (afterPerformObservation?.ok !== true) {
    return Object.freeze({
      ok: false,
      reason: afterPerformObservation?.reason === 'AUTHORITY_INVALID'
        ? 'OBSERVATION_AUTHORITY_INVALID'
        : (afterPerformObservation?.reason || 'OBSERVATION_AUTHORITY_INVALID'),
    });
  }

  const actionReceipt = deepFreeze({
    schemaVersion: 1,
    artifactKind: 'zero-shot-action-receipt',
    observationId: admission.observationId,
    intentId: admission.intentId,
    targetAffordanceId: admission.targetAffordanceId,
    action: admission.action,
    performed: true,
    signed: false,
    replayReady: false,
  });
  ACTION_RECEIPT_STATE.set(actionReceipt, Object.freeze({
    admission,
    stepContract: state.stepContract,
    beforeObservation: state.observation,
    lineageToken: state.lineageToken,
  }));
  return Object.freeze({ ok: true, reason: null, actionReceipt });
}

export function inspectActionReceiptAuthority(actionReceipt) {
  const state = actionReceipt && typeof actionReceipt === 'object'
    ? ACTION_RECEIPT_STATE.get(actionReceipt)
    : null;
  if (!state) return Object.freeze({ ok: false, reason: 'ACTION_RECEIPT_AUTHORITY_INVALID' });
  return Object.freeze({ ok: true, reason: null, state });
}
