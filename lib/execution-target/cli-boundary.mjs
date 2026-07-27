// Stable, redacted CLI failures for execution-target consumers.

const COMMANDS = new Set(['record', 'replay', 'compile']);
const REASONS = new Set([
  'RUNTIME_UNSUPPORTED',
  'LOGICAL_TARGET_INVALID',
  'LOGICAL_TARGET_REQUIRED',
  'TRANSPORT_MODE_INVALID',
  'TRANSPORT_ENDPOINT_REQUIRED',
  'TARGET_TRANSPORT_MODE_MISMATCH',
  'ORIGIN_CONTINUITY_UNAVAILABLE',
  'EXECUTION_TARGET_AUTHORITY_INVALID',
  'BROWSER_LAUNCH_FAILED',
  'NAVIGATION_FAILED',
  'NAVIGATION_ORIGIN_MISMATCH',
]);

function stableReason(failure) {
  for (const candidate of [
    failure?.reason,
    failure?.code,
    typeof failure === 'string' ? failure : null,
  ]) {
    if (REASONS.has(candidate)) return candidate;
  }
  return 'EXECUTION_TARGET_AUTHORITY_INVALID';
}

export function isExecutionTargetCliFailure(failure) {
  return [
    failure?.reason,
    failure?.code,
    typeof failure === 'string' ? failure : null,
  ].some((candidate) => REASONS.has(candidate));
}

export function emitExecutionTargetCliFailure({
  command,
  failure,
  stderr = process.stderr,
} = {}) {
  const safeCommand = COMMANDS.has(command) ? command : 'compile';
  const reason = stableReason(failure);
  stderr.write(`casey ${safeCommand}: ${reason}\n`);
  return reason === 'BROWSER_LAUNCH_FAILED'
    || reason === 'NAVIGATION_FAILED'
    || reason === 'NAVIGATION_ORIGIN_MISMATCH'
    ? 1
    : 65;
}

export function emitCompileCliFailure({
  failure,
  phase = 'main',
  stderr = process.stderr,
} = {}) {
  if (isExecutionTargetCliFailure(failure)) {
    return emitExecutionTargetCliFailure({
      command: 'compile',
      failure,
      stderr,
    });
  }
  stderr.write(phase === 'execute' ? 'compile: 执行失败\n' : 'compile 失败\n');
  return 1;
}
