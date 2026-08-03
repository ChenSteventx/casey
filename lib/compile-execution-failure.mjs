// compile --execute 的异常密封边界。
// 原始 Error/message/params/身份观察只留在进程内；跨模块错误对象、CLI 与失败 report
// 只投影稳定分类、结构序号、注册表内 atom 和计数。
import { admissionFacetsForAtom } from './entity-semantic-lock-preflight.mjs';

export const COMPILE_ATOM_EXECUTION_FAILURE_CODE = 'COMPILE_ATOM_EXECUTION_FAILED';
export const LOGIN_BOOTSTRAP_FAILURE_CODE = 'LOGIN_BOOTSTRAP_FAILED_BEFORE_FLOW';

const PERSISTENT_ACTION_STATUSES = new Set(['NOT_ATTEMPTED', 'INDETERMINATE', 'CONFIRMED']);
// 这里只登记生产执行过程中可写入 run 的阶段；`recorded-action-*`、`click-event-not-recorded`
// 等 fallback 推断阶段只由本模块内部生成，故意不允许 caller 伪造成强证据。
const PERSISTENT_ACTION_STAGES = new Map([
  ['input-preparation', 'NOT_ATTEMPTED'],
  ['before-click-call', 'NOT_ATTEMPTED'],
  ['physical-click-invoked', 'INDETERMINATE'],
  ['physical-click-succeeded', 'CONFIRMED'],
  ['physical-action-succeeded', 'CONFIRMED'],
  ['click-event-recorded', 'CONFIRMED'],
  ['click-event-recorded-indeterminate', 'INDETERMINATE'],
  ['click-not-attempted', 'NOT_ATTEMPTED'],
  ['waiting-for-reply', 'CONFIRMED'],
]);

function isKnownAtom(knownAtoms, atom) {
  return knownAtoms instanceof Set && typeof atom === 'string' && knownAtoms.has(atom);
}

function safeOrdinal(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export function createCompileAtomExecutionFailure({ stepOrdinal, atom, knownAtoms } = {}) {
  return Object.freeze({
    code: COMPILE_ATOM_EXECUTION_FAILURE_CODE,
    stepOrdinal: safeOrdinal(stepOrdinal),
    atom: isKnownAtom(knownAtoms, atom) ? atom : null,
  });
}

export function createLoginBootstrapFailure() {
  return Object.freeze({ code: LOGIN_BOOTSTRAP_FAILURE_CODE });
}

export function isLoginBootstrapFailure(failure) {
  return Boolean(failure && typeof failure === 'object'
    && failure.code === LOGIN_BOOTSTRAP_FAILURE_CODE);
}

export function inspectCompileAtomExecutionFailure({ failure, knownAtoms } = {}) {
  if (!failure || typeof failure !== 'object'
    || failure.code !== COMPILE_ATOM_EXECUTION_FAILURE_CODE) return null;
  const stepOrdinal = safeOrdinal(failure.stepOrdinal);
  if (stepOrdinal === null || !isKnownAtom(knownAtoms, failure.atom)) return null;
  return Object.freeze({
    code: COMPILE_ATOM_EXECUTION_FAILURE_CODE,
    stepOrdinal,
    atom: failure.atom,
  });
}

function countRows(value) {
  return Array.isArray(value) ? value.length : 0;
}

function hasPersistentEffect(atom) {
  const facets = admissionFacetsForAtom(atom);
  return Boolean(facets && (facets.entityChange !== 'none' || facets.nonEntityEffect !== 'none'));
}

function safePersistentActionEvidence(value) {
  if (!value || typeof value !== 'object' || !hasPersistentEffect(value.atom)
    || !PERSISTENT_ACTION_STATUSES.has(value.status)
    || PERSISTENT_ACTION_STAGES.get(value.stage) !== value.status) return null;
  return Object.freeze({ atom: value.atom, status: value.status, stage: value.stage });
}

export function recordPersistentActionEvidence(run, { atom, status, stage } = {}) {
  if (!run || typeof run !== 'object') return false;
  const evidence = safePersistentActionEvidence({ atom, status, stage });
  if (!evidence) return false;
  run.persistentActionEvidence = evidence;
  return true;
}

function attemptedProjection(status) {
  if (status === 'CONFIRMED') return true;
  if (status === 'NOT_ATTEMPTED') return false;
  return null;
}

function inferPersistentActionEvidence({ failureDetail, failure, run }) {
  if (isLoginBootstrapFailure(failure)) {
    return { status: 'NOT_ATTEMPTED', stage: 'login-bootstrap' };
  }

  const traced = safePersistentActionEvidence(run?.persistentActionEvidence);
  const events = Array.isArray(run?.events) ? run.events : [];
  const verification = Array.isArray(run?.verification) ? run.verification : [];
  const persistentEvents = events.filter((event) => hasPersistentEffect(event?.atom)
    && (event.atom !== 'chat.sendAndWait' || event.action === 'click'));
  let recorded = null;
  for (const event of persistentEvents) {
    const fact = verification.find((row) => row?.stepId === event?.stepId);
    if (fact?.acted === true) {
      recorded = { status: 'CONFIRMED', stage: 'recorded-action-succeeded' };
      break;
    }
  }
  if (!recorded && persistentEvents.length) {
    recorded = { status: 'INDETERMINATE', stage: 'recorded-action-unresolved' };
  }

  // 整轮事实合并取最强保守等级：此前已确认/不确定的持久动作，不能被当前 atom 刚进入
  // input-preparation 的 NOT_ATTEMPTED 覆盖成 false。
  if (recorded?.status === 'CONFIRMED') return recorded;
  if (traced?.status === 'CONFIRMED') return { status: traced.status, stage: traced.stage };
  if (recorded?.status === 'INDETERMINATE') return recorded;
  if (traced) return { status: traced.status, stage: traced.stage };

  if (failureDetail && hasPersistentEffect(failureDetail.atom)) {
    if (failureDetail.atom === 'chat.sendAndWait') {
      return { status: 'INDETERMINATE', stage: 'click-event-not-recorded' };
    }
    return { status: 'INDETERMINATE', stage: 'persistent-step-failed-without-action-evidence' };
  }
  return { status: 'NOT_ATTEMPTED', stage: 'no-persistent-action-evidence' };
}

export function projectCompileExecutionFailureReport({
  caseId,
  failure,
  run,
  knownAtoms,
} = {}) {
  const detail = inspectCompileAtomExecutionFailure({ failure, knownAtoms });
  const loginBootstrapFailed = isLoginBootstrapFailure(failure);
  const persistentAction = inferPersistentActionEvidence({ failureDetail: detail, failure, run });
  return {
    caseId,
    status: 'failed',
    phase: 'execute',
    stage: loginBootstrapFailed ? 'login-bootstrap' : detail ? 'compile-flow' : 'execute',
    failedStepOrdinal: detail?.stepOrdinal ?? null,
    failedAtom: detail?.atom ?? null,
    persistentActionAttempted: attemptedProjection(persistentAction.status),
    persistentActionStatus: persistentAction.status,
    persistentActionStage: persistentAction.stage,
    eventsEmitted: countRows(run?.events),
    identityObservationsCaptured: countRows(run?.identityObservations),
    blockerCount: countRows(run?.blockers),
  };
}
