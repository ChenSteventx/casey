// Replay's only deterministic navigation seam. It delegates origin verification
// to the shared execution-target guard and exposes only stable failure reasons.

import {
  executionTargetUrl,
  navigateExecutionTargetPage,
  verifyExecutionTargetPageOrigin,
} from '../execution-target/runtime.mjs';

const REASONS = new Set([
  'EXECUTION_TARGET_AUTHORITY_INVALID',
  'NAVIGATION_FAILED',
  'NAVIGATION_ORIGIN_MISMATCH',
]);

export class ReplayNavigationAbort extends Error {
  constructor(reason) {
    const safeReason = REASONS.has(reason)
      ? reason
      : 'EXECUTION_TARGET_AUTHORITY_INVALID';
    super(safeReason);
    this.name = 'ReplayNavigationAbort';
    this.reason = safeReason;
  }
}

export function projectReplayNavigationUrl(execution, target) {
  return executionTargetUrl(execution?.runtime, target);
}

export async function navigateReplayPage({
  page,
  execution,
  target,
  gotoOptions = { waitUntil: 'load' },
}) {
  const targetUrl = projectReplayNavigationUrl(execution, target);
  if (!targetUrl) {
    return Object.freeze({
      ok: false,
      reason: 'EXECUTION_TARGET_AUTHORITY_INVALID',
    });
  }
  return navigateExecutionTargetPage({
    page,
    authority: execution.authority,
    targetUrl,
    gotoOptions,
  });
}

export async function requireReplayNavigation(options) {
  const result = await navigateReplayPage(options);
  if (!result.ok) throw new ReplayNavigationAbort(result.reason);
  return result;
}

export async function requireReplayPageOrigin({ page, execution } = {}) {
  const result = await verifyExecutionTargetPageOrigin({
    page,
    authority: execution?.authority,
  });
  if (!result.ok) throw new ReplayNavigationAbort(result.reason);
  return result;
}

export function requireLoginBootstrapResult(result) {
  if (result?.ok === false) throw new ReplayNavigationAbort(result.reason);
  return result;
}
