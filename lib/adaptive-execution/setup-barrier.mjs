// setup → receipt → main admission → main 的固定运行屏障。
//
// 本模块只编排 adapter 与确定性准入函数，不裁定测试结果。前三段任一拒绝或异常，
// executeMain 都不会被调用；所有异常收敛为不含原始错误文本的结构化问题。
import {
  admitSetupPlan,
  admitMainFlowWithSetup,
  createSetupAdmissionSession,
  createSetupExecutionRequest,
  finalizeSetupReceipt,
} from './setup-receipt.mjs';

const SAFE_CODE = /^[A-Z][A-Z0-9_]{0,79}$/;
const FORBIDDEN_RESULT_KEYS = new Set(['verdict', 'passes']);

function problem(code) {
  return { code };
}

function sanitizeProblems(value, fallbackCode) {
  if (!Array.isArray(value)) return [problem(fallbackCode)];
  const codes = [];
  for (const item of value) {
    let code = null;
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      try {
        const descriptor = Object.getOwnPropertyDescriptor(item, 'code');
        if (descriptor && Object.hasOwn(descriptor, 'value')
          && typeof descriptor.value === 'string'
          && SAFE_CODE.test(descriptor.value)) {
          code = descriptor.value;
        }
      } catch {
        code = null;
      }
    }
    if (code && !codes.includes(code)) codes.push(code);
  }
  if (!codes.length) codes.push(fallbackCode);
  return codes.map(problem);
}

function containsForbiddenClaim(value, ancestors = new Set()) {
  if (value === 'PASS') return true;
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return false;
  if (ancestors.has(value)) return true;

  let descriptors;
  try {
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return true;
  }

  const next = new Set(ancestors);
  next.add(value);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== 'string') return true;
    if (FORBIDDEN_RESULT_KEYS.has(key)) return true;
    if (key === 'length' && Array.isArray(value)) continue;
    const descriptor = descriptors[key];
    if (!Object.hasOwn(descriptor, 'value') || descriptor.get || descriptor.set) return true;
    if (containsForbiddenClaim(descriptor.value, next)) return true;
  }
  return false;
}

function result(stage, {
  setupReceipt = null,
  mainResult = null,
  problems = [],
} = {}) {
  return {
    stage,
    setupReceipt,
    mainResult,
    problems,
  };
}

export async function executeWithSetupBarrier({
  setupPlan,
  testcase,
  mainMapping,
  registry,
  executeSetup,
  executeMain,
} = {}) {
  const planAdmission = admitSetupPlan({ setupPlan, testcase, registry });
  if (!planAdmission.ok) {
    return result('setup-failed', {
      problems: sanitizeProblems(planAdmission.problems, 'SETUP_PLAN_ADMISSION_REJECTED'),
    });
  }
  let admissionSession;
  let executionRequest;
  try {
    admissionSession = createSetupAdmissionSession({ caseId: setupPlan.caseId });
    executionRequest = createSetupExecutionRequest({ plan: setupPlan, admissionSession });
  } catch {
    return result('setup-failed', {
      problems: [problem('SETUP_ADMISSION_SESSION_FAILED')],
    });
  }
  let setupOutput;
  try {
    if (typeof executeSetup !== 'function') throw new TypeError('setup adapter missing');
    setupOutput = await executeSetup(setupPlan, executionRequest);
  } catch {
    return result('setup-failed', {
      problems: [problem('SETUP_ADAPTER_FAILED')],
    });
  }
  try {
    if (!setupOutput || typeof setupOutput !== 'object' || Array.isArray(setupOutput)
      || setupOutput.ok === false) {
      return result('setup-failed', {
        problems: sanitizeProblems(setupOutput?.problems, 'SETUP_ADAPTER_REJECTED'),
      });
    }
  } catch {
    return result('setup-failed', {
      problems: [problem('SETUP_ADAPTER_REJECTED')],
    });
  }

  let receiptResult;
  try {
    receiptResult = finalizeSetupReceipt({
      plan: setupPlan,
      execution: setupOutput.execution,
      admissionSession,
    });
  } catch {
    return result('receipt-rejected', {
      problems: [problem('SETUP_RECEIPT_FINALIZE_FAILED')],
    });
  }
  if (!receiptResult || receiptResult.ok !== true || !receiptResult.receipt) {
    return result('receipt-rejected', {
      problems: sanitizeProblems(receiptResult?.problems, 'SETUP_RECEIPT_REJECTED'),
    });
  }

  let admission;
  try {
    admission = admitMainFlowWithSetup({
      testcase,
      mainMapping,
      setupPlan,
      setupReceipt: receiptResult.receipt,
      identityObservationBytes: setupOutput.identityObservationBytes ?? null,
      registry,
      admissionSession,
    });
  } catch {
    return result('main-admission-rejected', {
      setupReceipt: receiptResult.receipt,
      problems: [problem('MAIN_ADMISSION_FAILED')],
    });
  }
  if (!admission || admission.ok !== true || admission.allowMainStart !== true) {
    return result('main-admission-rejected', {
      setupReceipt: receiptResult.receipt,
      problems: sanitizeProblems(admission?.problems, 'MAIN_ADMISSION_REJECTED'),
    });
  }

  let mainOutput;
  try {
    if (typeof executeMain !== 'function') throw new TypeError('main adapter missing');
    mainOutput = await executeMain(admission);
  } catch {
    return result('main-failed', {
      setupReceipt: receiptResult.receipt,
      problems: [problem('MAIN_ADAPTER_FAILED')],
    });
  }
  let mainRejected = false;
  try {
    mainRejected = (mainOutput && typeof mainOutput === 'object' && mainOutput.ok === false)
      || containsForbiddenClaim(mainOutput);
  } catch {
    mainRejected = true;
  }
  if (mainRejected) {
    return result('main-failed', {
      setupReceipt: receiptResult.receipt,
      problems: [problem('MAIN_RESULT_REJECTED')],
    });
  }

  return result('complete', {
    setupReceipt: receiptResult.receipt,
    mainResult: mainOutput ?? null,
  });
}
