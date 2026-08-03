// compile --execute 的异常密封边界。
// 原始 Error/message/params/身份观察只留在进程内；跨模块错误对象、CLI 与失败 report
// 只投影稳定分类、结构序号、注册表内 atom 和计数。

export const COMPILE_ATOM_EXECUTION_FAILURE_CODE = 'COMPILE_ATOM_EXECUTION_FAILED';
export const LOGIN_BOOTSTRAP_FAILURE_CODE = 'LOGIN_BOOTSTRAP_FAILED_BEFORE_FLOW';

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

export function projectCompileExecutionFailureReport({
  caseId,
  failure,
  run,
  knownAtoms,
  destructiveAtoms,
} = {}) {
  const detail = inspectCompileAtomExecutionFailure({ failure, knownAtoms });
  const loginBootstrapFailed = isLoginBootstrapFailure(failure);
  const priorPersistentEvent = Array.isArray(run?.events)
    && run.events.some((event) => isKnownAtom(destructiveAtoms, event?.atom));
  const failingPersistentAtom = detail && isKnownAtom(destructiveAtoms, detail.atom);
  return {
    caseId,
    status: 'failed',
    phase: 'execute',
    stage: loginBootstrapFailed ? 'login-bootstrap' : detail ? 'compile-flow' : 'execute',
    failedStepOrdinal: detail?.stepOrdinal ?? null,
    failedAtom: detail?.atom ?? null,
    persistentActionAttempted: loginBootstrapFailed
      ? false
      : Boolean(priorPersistentEvent || failingPersistentAtom),
    eventsEmitted: countRows(run?.events),
    identityObservationsCaptured: countRows(run?.identityObservations),
    blockerCount: countRows(run?.blockers),
  };
}
