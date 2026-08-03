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

// 缺席类判据：只有在目录完整时才证得出来，故对 after observation 另设完整性前置。
const ABSENCE_PROGRESS_KINDS = new Set(['roleHidden']);

function matchesPath(pathname, expected) {
  if (expected.op === 'equals') return pathname === expected.value;
  if (expected.op === 'startsWith') return pathname.startsWith(expected.value);
  return false;
}

function matchesRole(affordance, expected) {
  const semantic = affordance?.semantic;
  return semantic?.kind === 'role'
    && semantic.role === expected.role
    && semantic.name === expected.name;
}

function matchesPredicate(observation, expected) {
  if (expected.kind === 'urlPathname') return matchesPath(observation.urlPathname, expected);
  const affordances = Array.isArray(observation.affordances) ? observation.affordances : [];
  if (expected.kind === 'roleVisible') {
    // 与点击身份门同一纪律：同名多命中即说不清是哪一个，进展断言不得比动作断言松。
    const matched = affordances.filter((item) => matchesRole(item, expected));
    return matched.length === 1 && matched[0].pageCount === 1 && matched[0].visible === true;
  }
  if (expected.kind === 'roleHidden') {
    // 可见性口径：缺席与「挂载但不可见」同算成立。
    return !affordances.some((item) => matchesRole(item, expected) && item.visible === true);
  }
  return false;
}

function completenessBlocker(observation) {
  if (observation?.truncated === true) return 'PROGRESS_CATALOG_TRUNCATED';
  const scopes = observation?.unsupportedScopes;
  if (scopes?.iframe === true || scopes?.shadow === true || scopes?.containerOnly === true) {
    return 'PROGRESS_UNSUPPORTED_SCOPE';
  }
  return null;
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
  // 目录不完整时缺席证不出来：这一层若不 fail-closed，roleHidden 会把「被截断/藏在未观测作用域」
  // 直接读成「不存在」。before 面无须重复此检查——resolver 与 admission 已在上游封堵。
  if (expected.some((item) => ABSENCE_PROGRESS_KINDS.has(item.kind))) {
    const blocked = completenessBlocker(afterObservation);
    if (blocked) return pending(blocked);
  }
  const beforeMatched = expected.every((item) => matchesPredicate(beforeObservation, item));
  const afterMatched = expected.every((item) => matchesPredicate(afterObservation, item));
  if (beforeMatched) return pending('EXPECTED_PROGRESS_NOT_CAUSED');
  if (!afterMatched) return pending('EXPECTED_PROGRESS_NOT_PROVED');

  const progressReceipt = deepFreeze({
    schemaVersion: 1,
    artifactKind: 'zero-shot-progress-receipt',
    intentId: contractFacts.intentId,
    beforeObservationId: beforeObservation.observationId,
    afterObservationId: afterObservation.observationId,
    conditionKinds: Object.freeze([...new Set(expected.map((item) => item.kind))].sort()),
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
