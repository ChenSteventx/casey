// setup receipt + main-flow admission.
//
// This module only turns deterministic setup execution facts into an unsigned
// candidate receipt. It does not sign, replay, or produce a test verdict.
import { createHash, randomUUID } from 'node:crypto';
import {
  checkDestructivePrefix,
  traceStateMachine,
  validateStructural,
} from '../compile-gate.mjs';
import { isCompilableAtom } from '../compile-atoms.mjs';
import { requiredFlowEntityBindings } from '../entity-semantic-lock-preflight.mjs';
import { ENTITY_OBSERVATION_REGISTRY } from '../entity-observation-registry.mjs';
import { mainFacts, resolveIdentityRefs } from './setup-main-admission.mjs';
import {
  EXECUTION_KEYS,
  EXECUTION_STEP_KEYS,
  HASH_RE,
  IDENTITY_REF_KEYS,
  PLAN_KEYS,
  RECEIPT_KEYS,
  ROLES,
  TRUSTED_BOOTSTRAP_STATES,
  VERIFIED_STATE_KEYS,
  canonicalBytes,
  canonicalEqual,
  hasClosedDataShape,
  isPlainRecord,
  issue,
  nonEmpty,
  uniqueStrings,
} from './setup-receipt-shape.mjs';

const ADMISSION_SESSIONS = new WeakMap();

export function createSetupAdmissionSession({ caseId } = {}) {
  if (!nonEmpty(caseId)) throw new TypeError('setup admission session 缺 caseId');
  const session = Object.freeze(Object.create(null));
  ADMISSION_SESSIONS.set(session, {
    caseId,
    phase: 'open',
    setupPlanSha256: null,
    executionChallenge: null,
    executionRequestSha256: null,
    receiptSha256: null,
  });
  return session;
}

function sessionState(session, caseId, phase) {
  const state = session && (typeof session === 'object' || typeof session === 'function')
    ? ADMISSION_SESSIONS.get(session)
    : null;
  if (!state || state.caseId !== caseId || state.phase !== phase) return null;
  return state;
}

export function createSetupExecutionRequest({ plan, admissionSession } = {}) {
  const planSha256 = hashSetupPlan(plan);
  const admissionState = sessionState(admissionSession, plan?.caseId, 'open');
  if (!admissionState) throw new TypeError('setup execution request 缺有效 admission session');
  admissionState.setupPlanSha256 = planSha256;
  admissionState.executionChallenge = `setup-exec:${randomUUID()}`;
  const request = Object.freeze({
    schemaVersion: 1,
    artifactKind: 'setup-execution-request',
    caseId: plan.caseId,
    setupPlanSha256: planSha256,
    executionChallenge: admissionState.executionChallenge,
  });
  admissionState.executionRequestSha256 =
    `sha256:${createHash('sha256').update(canonicalBytes(request)).digest('hex')}`;
  admissionState.phase = 'issued';
  return request;
}

export function hashSetupPlan(plan) {
  return `sha256:${createHash('sha256').update(canonicalBytes(plan)).digest('hex')}`;
}

function inspectReadyPlan(plan) {
  const problems = [];
  if (!hasClosedDataShape(plan, PLAN_KEYS)
    || plan.schemaVersion !== 1
    || plan.artifactKind !== 'setup-flow-plan'
    || !nonEmpty(plan.caseId)
    || plan.ready !== true
    || !Array.isArray(plan.problems)
    || plan.problems.length !== 0) {
    return { ok: false, problems: [issue('SETUP_PLAN_NOT_READY')] };
  }
  if (!Array.isArray(plan.orderedIntentIds)
    || !Array.isArray(plan.flow?.steps)
    || !Array.isArray(plan.stateTrace?.steps)
    || !uniqueStrings(plan.initialStates)
    || !uniqueStrings(plan.stateTrace?.finalStates)
    || !uniqueStrings(plan.providedStates)
    || plan.orderedIntentIds.length === 0
    || plan.flow.steps.length !== plan.orderedIntentIds.length
    || plan.stateTrace.steps.length !== plan.orderedIntentIds.length) {
    return { ok: false, problems: [issue('SETUP_PLAN_SHAPE_INVALID')] };
  }
  if (new Set(plan.orderedIntentIds).size !== plan.orderedIntentIds.length
    || plan.orderedIntentIds.some((intentId) => !nonEmpty(intentId))) {
    return { ok: false, problems: [issue('SETUP_PLAN_INTENT_ORDER_INVALID')] };
  }

  const expectedByIntent = new Map();
  const statesProvidedByAnyStep = new Set();
  for (let index = 0; index < plan.orderedIntentIds.length; index += 1) {
    const intentId = plan.orderedIntentIds[index];
    const flowStep = plan.flow.steps[index];
    const traceStep = plan.stateTrace.steps[index];
    if (!isPlainRecord(flowStep)
      || flowStep.sourceIntentId !== intentId
      || !nonEmpty(flowStep.atom)
      || !isPlainRecord(traceStep)
      || traceStep.index !== index
      || traceStep.atom !== flowStep.atom
      || !Array.isArray(traceStep.requires)
      || !Array.isArray(traceStep.provides)
      || !Array.isArray(traceStep.removes)
      || !Array.isArray(traceStep.missing)
      || traceStep.provides.some((state) => !nonEmpty(state))
      || new Set(traceStep.provides).size !== traceStep.provides.length) {
      problems.push(issue('SETUP_PLAN_STEP_TRACE_MISMATCH', { intentId }));
      continue;
    }
    const expectedStates = [...traceStep.provides];
    if (expectedStates.length === 0) {
      problems.push(issue('SETUP_PLAN_STEP_UNVERIFIABLE', { intentId }));
      continue;
    }
    expectedByIntent.set(intentId, {
      intentId,
      atom: flowStep.atom,
      params: isPlainRecord(flowStep.params) ? flowStep.params : {},
      entityBindings: Array.isArray(flowStep.entityBindings) ? flowStep.entityBindings : [],
      expectedStates,
    });
    for (const state of expectedStates) statesProvidedByAnyStep.add(state);
  }
  if (Array.isArray(plan.stateTrace.problems) && plan.stateTrace.problems.length > 0) {
    problems.push(issue('SETUP_PLAN_STATE_TRACE_INVALID'));
  }
  const initial = new Set(plan.initialStates);
  const providedStates = plan.stateTrace.finalStates
    .filter((state) => !initial.has(state) && statesProvidedByAnyStep.has(state))
    .sort();
  if (!canonicalEqual(plan.providedStates, providedStates)) {
    problems.push(issue('SETUP_PLAN_PROVIDED_STATES_INVALID'));
  }
  return {
    ok: problems.length === 0,
    problems,
    expectedByIntent,
    providedStates,
  };
}

function validatePlanAgainstRegistry(plan, testcase, registry) {
  const problems = [];
  if (!isPlainRecord(registry) || !isPlainRecord(registry.atoms)) {
    return [issue('SETUP_REGISTRY_INVALID')];
  }
  const expectedInitialStates = [...new Set(
    (Array.isArray(testcase?.preconditions) ? testcase.preconditions : [])
      .filter((state) => nonEmpty(state) && TRUSTED_BOOTSTRAP_STATES.has(state)),
  )].sort();
  if (!canonicalEqual(plan.initialStates, expectedInitialStates)) {
    problems.push(issue('SETUP_PLAN_INITIAL_STATES_MISMATCH'));
  }
  const businessPreconditions = [...new Set(
    (Array.isArray(testcase?.preconditions) ? testcase.preconditions : [])
      .filter((state) => nonEmpty(state) && !TRUSTED_BOOTSTRAP_STATES.has(state)),
  )].sort();
  for (const state of businessPreconditions) {
    if (!plan.providedStates.includes(state)) {
      problems.push(issue('SETUP_PRECONDITION_UNVERIFIED', { state }));
    }
  }
  for (const step of plan.flow.steps) {
    if (step.atom === 'login') problems.push(issue('SETUP_LOGIN_FORBIDDEN'));
    else if (!registry.atoms[step.atom]) problems.push(issue('SETUP_ATOM_UNKNOWN'));
    else if (!isCompilableAtom(step.atom)) problems.push(issue('SETUP_ATOM_NOT_COMPILABLE'));
    else if (!Array.isArray(registry.atoms[step.atom].provides)
      || registry.atoms[step.atom].provides.length === 0) {
      problems.push(issue('SETUP_ATOM_NO_VERIFIABLE_STATE'));
    }
  }
  for (const message of validateStructural(plan.flow, registry)) {
    problems.push(issue('SETUP_FLOW_STRUCTURAL_INVALID', { message }));
  }
  for (const message of checkDestructivePrefix(plan.flow, registry, testcase?.uniquePrefix)) {
    problems.push(issue('SETUP_DESTRUCTIVE_PREFIX_INVALID', { message }));
  }
  if (!Array.isArray(requiredFlowEntityBindings(plan.flow))) {
    problems.push(issue('SETUP_ENTITY_BINDINGS_INVALID'));
  }
  try {
    const recomputedTrace = traceStateMachine(plan.flow, registry, expectedInitialStates);
    if (!canonicalEqual(plan.stateTrace, recomputedTrace)) {
      problems.push(issue('SETUP_PLAN_STATE_TRACE_MISMATCH'));
    }
  } catch {
    problems.push(issue('SETUP_PLAN_STATE_TRACE_INVALID'));
  }
  return problems;
}

export function admitSetupPlan({ setupPlan, testcase, registry } = {}) {
  try {
    const facts = inspectReadyPlan(setupPlan);
    if (!facts.ok) return { ok: false, problems: facts.problems };
    if (!isPlainRecord(testcase) || testcase.caseId !== setupPlan.caseId) {
      return { ok: false, problems: [issue('SETUP_MAIN_CASE_MISMATCH')] };
    }
    const problems = validatePlanAgainstRegistry(setupPlan, testcase, registry);
    return { ok: problems.length === 0, problems };
  } catch {
    return { ok: false, problems: [issue('SETUP_PLAN_ADMISSION_INTERNAL_ERROR')] };
  }
}

function inspectVerifiedStates(value, expectedStates, proof, intentId) {
  const problems = [];
  if (!Array.isArray(value) || value.length !== expectedStates.length) {
    return { ok: false, problems: [issue('SETUP_VERIFIED_STATES_COVERAGE_INVALID', { intentId })] };
  }
  const byState = new Map();
  for (const entry of value) {
    if (!hasClosedDataShape(entry, VERIFIED_STATE_KEYS)
      || !nonEmpty(entry.state)
      || !nonEmpty(entry.evidenceStepId)
      || entry.proof !== proof
      || byState.has(entry.state)) {
      problems.push(issue('SETUP_VERIFIED_STATE_INVALID', { intentId }));
      continue;
    }
    byState.set(entry.state, entry);
  }
  if (byState.size !== expectedStates.length
    || expectedStates.some((state) => !byState.has(state))
    || [...byState.keys()].some((state) => !expectedStates.includes(state))) {
    problems.push(issue('SETUP_VERIFIED_STATES_COVERAGE_INVALID', { intentId }));
  }
  return {
    ok: problems.length === 0,
    problems,
    // Receipt order follows the registry-provided state order, not evidence input order.
    states: expectedStates.map((state) => ({ ...byState.get(state) })),
  };
}

function inspectIdentityRefs(refs, planFacts, receiptSteps) {
  const problems = [];
  if (!Array.isArray(refs)) return { ok: false, problems: [issue('SETUP_IDENTITY_REFS_INVALID')] };
  const copied = [];
  const seen = new Set();
  const receiptStepByIntent = new Map(receiptSteps.map((step) => [step.intentId, step]));
  for (const ref of refs) {
    if (!hasClosedDataShape(ref, IDENTITY_REF_KEYS)
      || !HASH_RE.test(ref.artifactSha256 || '')
      || !['sourceIntentId', 'candidateId', 'atom', 'evidenceStepId'].every((key) => nonEmpty(ref[key]))
      || !ROLES.has(ref.role)) {
      problems.push(issue('SETUP_IDENTITY_REF_INVALID'));
      continue;
    }
    const key = JSON.stringify(IDENTITY_REF_KEYS.size
      ? [...IDENTITY_REF_KEYS].map((field) => ref[field])
      : []);
    if (seen.has(key)) {
      problems.push(issue('SETUP_IDENTITY_REF_DUPLICATE'));
      continue;
    }
    seen.add(key);
    const planStep = planFacts.expectedByIntent.get(ref.sourceIntentId);
    const observationPolicy = planStep ? ENTITY_OBSERVATION_REGISTRY.get(planStep.atom) : null;
    const receiptStep = receiptStepByIntent.get(ref.sourceIntentId);
    const bindingMatches = planStep?.entityBindings.filter(
      (binding) => isPlainRecord(binding)
        && binding.candidateId === ref.candidateId
        && binding.role === ref.role,
    ) ?? [];
    if (!planStep
      || !observationPolicy
      || planStep.atom !== ref.atom
      || bindingMatches.length !== 1
      || !receiptStep?.verifiedStates.some((state) => state.evidenceStepId === ref.evidenceStepId)) {
      problems.push(issue('SETUP_IDENTITY_REF_ASSOCIATION_INVALID', { sourceIntentId: ref.sourceIntentId }));
      continue;
    }
    copied.push({ ...ref });
  }
  for (const planStep of planFacts.expectedByIntent.values()) {
    const policy = ENTITY_OBSERVATION_REGISTRY.get(planStep.atom);
    if (!policy) continue;
    const expectedBindings = planStep.entityBindings
      .filter((binding) => isPlainRecord(binding) && policy.requiredRoles.includes(binding.role));
    const actualRoles = planStep.entityBindings.map((binding) => binding?.role).sort();
    const requiredRoles = [...policy.requiredRoles].sort();
    if (expectedBindings.length !== requiredRoles.length
      || actualRoles.length !== requiredRoles.length
      || actualRoles.some((role, index) => role !== requiredRoles[index])) {
      problems.push(issue('SETUP_IDENTITY_BINDING_POLICY_INVALID', { sourceIntentId: planStep.intentId }));
      continue;
    }
    for (const binding of expectedBindings) {
      const matches = copied.filter((ref) => ref.sourceIntentId === planStep.intentId
        && ref.atom === planStep.atom
        && ref.candidateId === binding.candidateId
        && ref.role === binding.role);
      if (matches.length !== 1) {
        problems.push(issue('SETUP_IDENTITY_REF_REQUIRED', { sourceIntentId: planStep.intentId }));
      }
    }
  }
  return { ok: problems.length === 0, problems, refs: copied };
}

export function finalizeSetupReceipt({ plan, execution, admissionSession } = {}) {
  const problems = [];
  try {
    const planFacts = inspectReadyPlan(plan);
    if (!planFacts.ok) return { ok: false, receipt: null, problems: planFacts.problems };
    const admissionState = sessionState(admissionSession, plan.caseId, 'issued');
    if (!admissionState) {
      return { ok: false, receipt: null, problems: [issue('SETUP_ADMISSION_SESSION_INVALID')] };
    }
    // 首次 finalize 尝试即烧毁 issued 状态；坏 evidence 不得在同一 challenge 上试探后重交。
    admissionState.phase = 'finalizing';
    if (!hasClosedDataShape(execution, EXECUTION_KEYS)
      || execution.schemaVersion !== 1
      || execution.artifactKind !== 'setup-execution-evidence'
      || execution.caseId !== plan.caseId
      || execution.setupPlanSha256 !== hashSetupPlan(plan)
      || admissionState.setupPlanSha256 !== execution.setupPlanSha256
      || !nonEmpty(execution.executionChallenge)
      || admissionState.executionChallenge !== execution.executionChallenge
      || !Array.isArray(execution.steps)
      || execution.steps.length !== plan.orderedIntentIds.length) {
      return { ok: false, receipt: null, problems: [issue('SETUP_EXECUTION_SHAPE_PLAN_OR_CHALLENGE_MISMATCH')] };
    }

    const receiptSteps = [];
    const seenIntentIds = new Set();
    for (let index = 0; index < plan.orderedIntentIds.length; index += 1) {
      const expectedIntentId = plan.orderedIntentIds[index];
      const step = execution.steps[index];
      if (!hasClosedDataShape(step, EXECUTION_STEP_KEYS)
        || step.intentId !== expectedIntentId
        || seenIntentIds.has(step.intentId)) {
        problems.push(issue('SETUP_EXECUTION_STEP_ORDER_INVALID', { intentId: expectedIntentId }));
        continue;
      }
      seenIntentIds.add(step.intentId);
      const expected = planFacts.expectedByIntent.get(expectedIntentId);
      if (step.resolution !== 'unique') {
        problems.push(issue('SETUP_EXECUTION_NOT_UNIQUE', { intentId: expectedIntentId }));
        continue;
      }
      let requiredProof;
      if (step.status === 'executed' && step.acted === true) requiredProof = 'post-readback';
      else if (step.status === 'already-satisfied' && step.acted === false) requiredProof = 'probe-readback';
      else {
        problems.push(issue('SETUP_EXECUTION_STATUS_INVALID', { intentId: expectedIntentId }));
        continue;
      }
      const verified = inspectVerifiedStates(
        step.verifiedStates,
        expected.expectedStates,
        requiredProof,
        expectedIntentId,
      );
      if (!verified.ok) {
        problems.push(...verified.problems);
        continue;
      }
      receiptSteps.push({
        intentId: step.intentId,
        status: step.status,
        resolution: step.resolution,
        acted: step.acted,
        verifiedStates: verified.states,
      });
    }
    if (problems.length > 0 || receiptSteps.length !== plan.orderedIntentIds.length) {
      return { ok: false, receipt: null, problems };
    }

    const refs = inspectIdentityRefs(execution.identityObservationRefs, planFacts, receiptSteps);
    if (!refs.ok) return { ok: false, receipt: null, problems: refs.problems };

    const receipt = {
      schemaVersion: 1,
      artifactKind: 'setup-receipt',
      caseId: plan.caseId,
      setupPlanSha256: hashSetupPlan(plan),
      executionRequestSha256: admissionState.executionRequestSha256,
      signed: false,
      replayReady: false,
      status: 'verified',
      orderedIntentIds: [...plan.orderedIntentIds],
      providedStates: [...planFacts.providedStates],
      steps: receiptSteps,
      identityObservationRefs: refs.refs,
    };
    admissionState.phase = 'finalized';
    admissionState.receiptSha256 = `sha256:${createHash('sha256').update(canonicalBytes(receipt)).digest('hex')}`;
    return {
      ok: true,
      receipt,
      problems: [],
    };
  } catch {
    return { ok: false, receipt: null, problems: [issue('SETUP_RECEIPT_INTERNAL_ERROR')] };
  }
}

export function admitMainFlowWithSetup({
  testcase,
  mainMapping,
  setupPlan,
  setupReceipt,
  identityObservationBytes,
  registry,
  admissionSession,
} = {}) {
  const baseline = mainFacts(testcase, mainMapping, registry, []);
  const denied = (problems, facts = baseline) => ({
    ok: false,
    allowMainStart: false,
    initialStates: facts.initialStates,
    mainFlow: facts.mainFlow,
    stateTrace: facts.stateTrace,
    resolvedIdentities: [],
    problems,
  });
  try {
    const planFacts = inspectReadyPlan(setupPlan);
    if (!planFacts.ok) return denied(planFacts.problems);
    if (!isPlainRecord(testcase) || testcase.caseId !== setupPlan.caseId) {
      return denied([issue('SETUP_MAIN_CASE_MISMATCH')]);
    }
    const planRegistryProblems = validatePlanAgainstRegistry(setupPlan, testcase, registry);
    if (planRegistryProblems.length > 0) return denied(planRegistryProblems);
    if (!hasClosedDataShape(setupReceipt, RECEIPT_KEYS)) {
      return denied([issue('SETUP_RECEIPT_REQUIRED_OR_SHAPE_INVALID')]);
    }
    const admissionState = sessionState(admissionSession, setupPlan.caseId, 'finalized');
    const receiptSha256 = `sha256:${createHash('sha256').update(canonicalBytes(setupReceipt)).digest('hex')}`;
    if (!admissionState || admissionState.receiptSha256 !== receiptSha256) {
      return denied([issue('SETUP_ADMISSION_SESSION_INVALID')]);
    }
    // 一次性消费在其余准入前完成：成功或失败都不能用同一 run/session 重试或跨调用重放。
    admissionState.phase = 'consumed';
    if (setupReceipt.signed !== false
      || setupReceipt.replayReady !== false
      || setupReceipt.status !== 'verified'
      || setupReceipt.setupPlanSha256 !== hashSetupPlan(setupPlan)
      || setupReceipt.executionRequestSha256 !== admissionState.executionRequestSha256
      || !canonicalEqual(setupReceipt.orderedIntentIds, setupPlan.orderedIntentIds)
      || !canonicalEqual(setupReceipt.providedStates, planFacts.providedStates)) {
      return denied([issue('SETUP_RECEIPT_TAMPERED')]);
    }

    const identities = resolveIdentityRefs({
      refs: setupReceipt.identityObservationRefs,
      bytes: identityObservationBytes,
      caseId: testcase.caseId,
      planFacts,
    });
    if (!identities.ok) return denied(identities.problems);

    const facts = mainFacts(testcase, mainMapping, registry, setupReceipt.providedStates);
    if (facts.problems.length > 0) return denied(facts.problems, facts);
    return {
      ok: true,
      allowMainStart: true,
      initialStates: facts.initialStates,
      mainFlow: facts.mainFlow,
      stateTrace: facts.stateTrace,
      resolvedIdentities: identities.identities,
      problems: [],
    };
  } catch {
    return denied([issue('SETUP_MAIN_ADMISSION_INTERNAL_ERROR')]);
  }
}
