import { validateZeroShotStepContractAuthority } from './step-contract.mjs';
import { observePage } from './page-observer.mjs';
import { resolveDeterministicAction } from './deterministic-resolver.mjs';
import { createActionProposal } from './action-proposal.mjs';
import { admitZeroShotAction } from './action-admission.mjs';
import { executeAdmittedAction } from './step-executor.mjs';
import { verifyStepProgress } from './progress-verifier.mjs';
import { createExplorationTrace } from './exploration-trace.mjs';

function failed(reason, extra = {}) {
  return Object.freeze({ ok: false, reason, ...extra });
}

export async function runSingleZeroShotStep({
  driver,
  stepContract,
  maxCandidates = 20,
  propose,
  identityAdmission,
} = {}) {
  const contractFacts = validateZeroShotStepContractAuthority(stepContract);
  if (contractFacts?.ok !== true) return failed('CONTRACT_AUTHORITY_INVALID');

  const before = await observePage({
    driver,
    intentId: contractFacts.intentId,
    maxCandidates,
  });
  if (before?.ok !== true) return failed(before?.reason || 'PAGE_OBSERVATION_FAILED');

  const resolution = resolveDeterministicAction({
    stepContract,
    observation: before.observation,
  });
  let actionSource = {};
  if (resolution?.status === 'resolved') {
    actionSource = { resolution };
  } else if (resolution?.status === 'proposal-required') {
    if (typeof propose !== 'function') return failed('ACTION_PROPOSAL_REQUIRED');
    let rawProposal;
    try {
      rawProposal = await propose({
        observation: before.observation,
        stepContract,
      });
    } catch {
      return failed('ACTION_PROPOSAL_FAILED');
    }
    const created = createActionProposal({
      stepContract,
      observation: before.observation,
      rawProposal,
    });
    if (created?.ok !== true) return failed(created?.reason || 'ACTION_PROPOSAL_REJECTED');
    actionSource = { proposal: created.proposal };
  } else {
    return failed(resolution?.reason || 'DETERMINISTIC_RESOLUTION_REJECTED');
  }

  const admitted = await admitZeroShotAction({
    stepContract,
    observation: before.observation,
    observationAuthority: before.authority,
    ...actionSource,
    ...(identityAdmission === undefined ? {} : { identityAdmission }),
  });
  if (admitted?.ok !== true) return failed(admitted?.reason || 'ACTION_ADMISSION_REJECTED');

  const executed = await executeAdmittedAction({ admission: admitted.admission });
  if (executed?.ok !== true) return failed(executed?.reason || 'ACTION_EXECUTION_FAILED');

  const after = await observePage({
    driver,
    intentId: contractFacts.intentId,
    maxCandidates,
  });
  if (after?.ok !== true) {
    return failed(after?.reason || 'POST_ACTION_OBSERVATION_FAILED', {
      actionReceipt: executed.actionReceipt,
    });
  }

  const progress = verifyStepProgress({
    stepContract,
    beforeObservation: before.observation,
    actionReceipt: executed.actionReceipt,
    afterObservation: after.observation,
    afterObservationAuthority: after.authority,
  });
  if (progress?.status !== 'progressed') {
    return failed(progress?.reason || 'EXPECTED_PROGRESS_NOT_PROVED', { progress });
  }

  const trace = createExplorationTrace({
    stepContract,
    beforeObservation: before.observation,
    admission: admitted.admission,
    actionReceipt: executed.actionReceipt,
    afterObservation: after.observation,
    progressReceipt: progress.progressReceipt,
  });
  if (!trace) return failed('EXPLORATION_TRACE_NOT_CREATED', { progress });

  return Object.freeze({
    ok: true,
    reason: null,
    progress,
    trace,
  });
}
