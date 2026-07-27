const EXECUTION_REASONS = new Set([
  'BROWSER_LAUNCH_FAILED',
  'NAVIGATION_FAILED',
  'NAVIGATION_ORIGIN_MISMATCH',
  'EXECUTION_TARGET_AUTHORITY_INVALID',
]);

export function classifyReplayFatal(error) {
  if (EXECUTION_REASONS.has(error?.reason)) {
    return Object.freeze({
      executionTarget: true,
      failure: Object.freeze({ reason: error.reason }),
      exitCode: null,
      message: null,
    });
  }
  return Object.freeze({
    executionTarget: false,
    failure: null,
    exitCode: Number.isInteger(error?.exitCode) ? error.exitCode : 1,
    message: 'replay 失败：REPLAY_INTERNAL_ERROR',
  });
}
