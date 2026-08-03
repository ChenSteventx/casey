import { validateZeroShotStepContractAuthority } from './step-contract.mjs';
import { inspectObservationAuthority } from './affordance-catalog.mjs';
import { inspectActionReceiptAuthority } from './action-admission.mjs';
import { anyUnsupportedScope } from './unsupported-scopes.mjs';

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

// 读目录的判据：结论完全取决于 affordance 目录，目录不完整就一律证不出来。
// 存在性与缺席性都吃这一刀——存在性靠 pageCount 判唯一，而 driver 层枚举上限会在
// 目录计数之前就丢候选，使同名第二实例消失、pageCount 低估成 1。
const CATALOG_PROGRESS_KINDS = new Set(['roleVisible', 'roleHidden']);
// 缺席类判据额外要求目录非空：动作后整页无候选（跳登录页/渲染失败）时，
// 「没看见」与「不存在」分不开。
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
  if (anyUnsupportedScope(observation?.unsupportedScopes)) return 'PROGRESS_UNSUPPORTED_SCOPE';
  // 被脱敏抑制的候选不进目录也不计入 truncated：它可能正是缺席断言要找的那个可见元素，
  // 而目录里已经没有任何痕迹可供反证，故只要抑制过就一律证不出缺席。
  if (!Number.isInteger(observation?.redactionSuppressed)
    || observation.redactionSuppressed > 0) {
    return 'PROGRESS_REDACTION_SUPPRESSED';
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
  // 前后两份都要完整。after 不完整会把「被截断/藏在未观测作用域/被脱敏抑制」读成「不存在」；
  // before 不完整则让判据在动作前假性不成立，因果闸放行一次动作根本没造成的「进展」。
  // 上游 observationBlocker 只封了 before 的截断与未支持作用域，不查脱敏抑制，故 before 侧可达。
  if (expected.some((item) => CATALOG_PROGRESS_KINDS.has(item.kind))) {
    const blockedBefore = completenessBlocker(beforeObservation);
    if (blockedBefore) return pending(blockedBefore);
    const blockedAfter = completenessBlocker(afterObservation);
    if (blockedAfter) return pending(blockedAfter);
  }
  if (expected.some((item) => ABSENCE_PROGRESS_KINDS.has(item.kind))
    && !(Array.isArray(afterObservation.affordances) && afterObservation.affordances.length > 0)) {
    return pending('PROGRESS_CATALOG_EMPTY');
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
