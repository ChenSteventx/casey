// Replay-history helpers. This module only projects already-collected facts.

const PLACEHOLDER = /^\{\{[A-Za-z0-9_.-]+\}\}$/;
const INTERACTIVE = new Set(['click', 'dblclick', 'fill', 'selectOption', 'dragTo']);
const ACTIONS = new Set(['click', 'dblclick', 'fill', 'selectOption', 'press', 'nav', 'newpage', 'dragTo']);
const LOCATOR_RESULTS = new Set(['unique', 'none', 'ambiguous', 'fallback_first', 'coord_fallback']);

export function replayHistoryLine(ev, {
  navOk,
  navErr,
  axis,
  durationMs,
  caseId,
  isLast,
  settled,
}) {
  if (!ACTIONS.has(ev.action)) return null;
  let locatorResolution = null;
  let result;
  if (ev.action === 'nav') {
    const rawError = navErr && (navErr.name || navErr.reason || navErr.message);
    result = navOk ? 'ok' : (/timeout/i.test(String(rawError || '')) ? 'timeout' : 'actionError');
  } else {
    const resolution = (axis && axis.resolution) || 'none';
    const readbackFailed = !!(axis && axis.identityReadback && axis.identityReadback.ok === false);
    result = resolution === 'unique'
      ? (readbackFailed ? 'actionError' : 'ok')
      : resolution === 'action_failed'
        ? 'actionError'
        : 'locatorError';
    if (INTERACTIVE.has(ev.action)) {
      locatorResolution = resolution === 'action_failed'
        ? 'unique'
        : LOCATOR_RESULTS.has(resolution)
          ? resolution
          : 'none';
    }
  }
  let valueRef = null;
  if (ev.action === 'fill') {
    valueRef = ev.value == null ? null : (PLACEHOLDER.test(ev.value) ? ev.value : '<redacted:fill>');
  } else if (ev.action === 'press') {
    valueRef = ev.key ? '<redacted:key>' : null;
  } else if (ev.action === 'selectOption') {
    valueRef = ev.dropdownUnit && ev.dropdownUnit.optionText ? '<redacted:option>' : null;
  }
  const semantic = ev.semantic || {};
  const role = semantic.role || ev.role || (ev.action === 'selectOption' ? 'combobox' : null);
  const accessibleName = semantic.name
    || ev.accessibleName
    || ev.fieldLabel
    || (ev.dropdownUnit && ev.dropdownUnit.fieldLabel)
    || ev.text
    || null;
  const locator = role || accessibleName
    ? {
      ...(role ? { role } : {}),
      ...(accessibleName ? { accessibleName } : {}),
      semantic: null,
    }
    : null;
  const parameters = locator || valueRef ? { ...(locator ? { locator } : {}), valueRef } : null;
  return {
    timestamp: new Date().toISOString(),
    caseId,
    stepId: ev.stepId,
    intentId: ev.intentId,
    atom: ev.atom ?? null,
    action: ev.action,
    parameters,
    locatorResolution,
    quietPointReached: isLast ? (!!navOk && !!settled) : !!navOk,
    durationMs,
    result,
  };
}

export function replayPathOf(value) {
  try {
    return new URL(value).pathname;
  } catch {
    return value;
  }
}

export async function waitReplyStable(page, selector, {
  stableMs = 2000,
  budgetMs = 10000,
} = {}) {
  const startedAt = Date.now();
  let previous = null;
  let unchangedSince = Date.now();
  while (Date.now() - startedAt < budgetMs) {
    let current = null;
    try {
      const locator = page.locator(selector).last();
      current = (await locator.count()) ? await locator.innerText({ timeout: 500 }) : null;
    } catch {
      current = null;
    }
    if (current !== previous) {
      previous = current;
      unchangedSince = Date.now();
    } else if (current != null && Date.now() - unchangedSince >= stableMs) {
      return current;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return previous;
}

export async function replayRowCount(page, selector = '.hr-table-row') {
  try {
    return await page.locator(selector).count();
  } catch {
    return null;
  }
}
