// Adapter-only execution-target runtime. Browser and IO implementations stay outside.

import {
  readExecutionTargetAuthority,
  resolveExecutionTarget,
} from './authority.mjs';

function reject(reason) {
  return Object.freeze({ ok: false, reason });
}

function resolveState({ request, authority }) {
  if (authority !== undefined) {
    const state = readExecutionTargetAuthority(authority);
    return state ? { ok: true, state, authority } : reject('EXECUTION_TARGET_AUTHORITY_INVALID');
  }
  const resolved = resolveExecutionTarget(request);
  if (!resolved.ok) return resolved;
  return {
    ok: true,
    state: readExecutionTargetAuthority(resolved.authority),
    authority: resolved.authority,
  };
}

async function closeRejectedPage(page) {
  try {
    await page?.close?.();
  } catch {
    // Rejection remains authoritative even when best-effort cleanup fails.
  }
}

function navigationOrigin(policy, targetUrl) {
  try {
    const target = new URL(targetUrl);
    const expected = new URL(policy.browserVisibleStartUrl);
    if (!['http:', 'https:'].includes(target.protocol)) return null;
    return target.origin === expected.origin ? expected.origin : null;
  } catch {
    return null;
  }
}

export async function verifyExecutionTargetPageOrigin({
  page,
  authority,
  closeOnReject = true,
} = {}) {
  const state = readExecutionTargetAuthority(authority);
  if (!state) return reject('EXECUTION_TARGET_AUTHORITY_INVALID');
  let actualOrigin;
  let expectedOrigin;
  try {
    actualOrigin = new URL(await page.url()).origin;
    expectedOrigin = new URL(state.policy.browserVisibleStartUrl).origin;
  } catch {
    actualOrigin = null;
    expectedOrigin = null;
  }
  if (!actualOrigin || actualOrigin !== expectedOrigin) {
    if (closeOnReject) await closeRejectedPage(page);
    return reject('NAVIGATION_ORIGIN_MISMATCH');
  }
  return Object.freeze({ ok: true });
}

export async function navigateExecutionTargetPage({
  page,
  authority,
  targetUrl,
  gotoOptions,
} = {}) {
  const state = readExecutionTargetAuthority(authority);
  if (!state) return reject('EXECUTION_TARGET_AUTHORITY_INVALID');
  const expectedOrigin = navigationOrigin(state.policy, targetUrl);
  if (!expectedOrigin || !page || typeof page.goto !== 'function') {
    await closeRejectedPage(page);
    return reject('NAVIGATION_ORIGIN_MISMATCH');
  }
  try {
    await page.goto(targetUrl, gotoOptions);
  } catch {
    await closeRejectedPage(page);
    return reject('NAVIGATION_FAILED');
  }
  return verifyExecutionTargetPageOrigin({ page, authority });
}

export async function openExecutionTarget({ request, authority, adapter } = {}) {
  const resolved = resolveState({ request, authority });
  if (!resolved.ok) return resolved;

  const { policy, receipt } = resolved.state;
  const launchOptions = policy.proxyServer
    ? { proxyServer: policy.proxyServer }
    : {};
  let page;
  try {
    page = await adapter.launch(launchOptions);
  } catch {
    return reject('BROWSER_LAUNCH_FAILED');
  }
  const navigation = await navigateExecutionTargetPage({
    page,
    authority: resolved.authority,
    targetUrl: policy.browserVisibleStartUrl,
  });
  if (!navigation.ok) return navigation;
  return Object.freeze({ ok: true, receipt });
}

// Existing record/replay/compile entry points use this only in memory. It is never
// written, logged, included in receipts, or returned by openExecutionTarget.
export function projectExecutionTargetRuntime(authority) {
  const state = readExecutionTargetAuthority(authority);
  if (!state) return null;
  const runtime = Object.create(null);
  for (const key of [
    'browserVisibleStartUrl',
    'browserVisibleBaseUrl',
    'networkOrigin',
    'logicalOrigin',
    'proxyServer',
  ]) {
    Object.defineProperty(runtime, key, {
      value: state.policy[key],
      enumerable: false,
      writable: false,
      configurable: false,
    });
  }
  return Object.freeze(runtime);
}

export function executionTargetUrl(policy, target) {
  if (!policy || typeof target !== 'string' || !target) return null;
  let projected;
  if (target.startsWith('{{baseUrl}}')) {
    projected = target.slice('{{baseUrl}}'.length) || '/';
  } else {
    try {
      const absolute = new URL(target);
      if (![policy.logicalOrigin, new URL(policy.browserVisibleStartUrl).origin]
        .includes(absolute.origin)) return null;
      projected = `${absolute.pathname}${absolute.search}${absolute.hash}`;
    } catch {
      if (!target.startsWith('/')) return null;
      projected = target;
    }
  }
  return `${policy.browserVisibleBaseUrl}${projected}`;
}
