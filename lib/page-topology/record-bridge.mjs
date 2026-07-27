// Context-scoped manual-recording adapter. Browser primitives are injected;
// this module owns only event ordering, active-page authority and fail-closed
// popup handoff.

import { createPageTopologyController } from './controller.mjs';
import { createSessionSeedAuthority } from './session-seed.mjs';
import {
  isTopologyAction,
  normalizeTopologyPath,
  normalizeTopologySequence,
} from './topology-events.mjs';

const RECORD_ACTIONS = new Set(['click', 'dblclick', 'fill', 'press', 'nav']);
const HANDOFF_ACTIONS = new Set(['click', 'dblclick']);
const FAILURE_REASONS = new Set([
  'AUTH_CONTINUITY_UNAVAILABLE',
  'NO_ACTIVE_PAGE',
  'OPENER_AUTHORITY_MISMATCH',
  'OPENER_AUTHORITY_MISSING',
  'PAGE_ACTION_FAILED',
  'PAGE_AUTHORITY_INVALID',
  'PAGE_AUTHORITY_STALE',
  'PAGE_CLOSED',
  'PAGE_EVALUATION_FAILED',
  'PAGE_FORENSICS_ATTACH_FAILED',
  'PAGE_HANDOFF_AMBIGUOUS',
  'PAGE_HANDOFF_BOUNDARY_INVALID',
  'PAGE_ID_ALLOCATION_FAILED',
  'PAGE_INIT_SCRIPT_FAILED',
  'PAGE_OPENER_READ_FAILED',
  'PAGE_PATH_UNAVAILABLE',
  'PAGE_REGISTRATION_FAILED',
  'PAGE_URL_NOT_READY',
  'RECORD_EVENT_INVALID',
  'SESSION_SEED_CAPTURE_FAILED',
  'TOPOLOGY_PATH_INVALID',
]);

function frozen(value) {
  return Object.freeze(value);
}

function denied(reason) {
  return frozen({
    ok: false,
    reason: FAILURE_REASONS.has(reason) ? reason : 'RECORD_BRIDGE_FAILED',
  });
}

function isContext(value) {
  try {
    return value && typeof value === 'object'
      && typeof value.pages === 'function';
  } catch {
    return false;
  }
}

function pageClosed(page) {
  try {
    return page?.isClosed?.() === true;
  } catch {
    return true;
  }
}

function contextPages(context) {
  try {
    const pages = context.pages();
    return Array.isArray(pages) ? pages : [];
  } catch {
    return [];
  }
}

async function closePages(pages) {
  for (const page of pages) {
    if (!page || pageClosed(page) || typeof page.close !== 'function') continue;
    try {
      await page.close();
    } catch {
      // The recording is already failed; close is best-effort containment.
    }
  }
}

function defaultSettleAfterClick() {
  return new Promise((resolve) => setTimeout(resolve, 150));
}

function sourcePageOf(source) {
  try {
    return source && typeof source === 'object' ? source.page : null;
  } catch {
    return null;
  }
}

function canonicalRecordEvent(event) {
  try {
    if (!event || typeof event !== 'object'
      || typeof event.action !== 'string'
      || !RECORD_ACTIONS.has(event.action)
      || isTopologyAction(event.action)) {
      return denied('RECORD_EVENT_INVALID');
    }
    const normalized = normalizeTopologyPath({
      value: event.path,
      format: 'capture',
    });
    if (!normalized.ok) return denied(normalized.reason);
    return frozen({
      ok: true,
      reason: null,
      event: frozen({
        ...event,
        path: normalized.path,
      }),
    });
  } catch {
    return denied('RECORD_EVENT_INVALID');
  }
}

function stableReason(result) {
  try {
    return FAILURE_REASONS.has(result?.reason)
      ? result.reason
      : 'RECORD_BRIDGE_FAILED';
  } catch {
    return 'RECORD_BRIDGE_FAILED';
  }
}

export async function capturePageSessionSeed({ page } = {}) {
  if (!page || typeof page.evaluate !== 'function') {
    return denied('SESSION_SEED_CAPTURE_FAILED');
  }
  let captured;
  try {
    captured = await page.evaluate(() => ({
      origin: location.origin,
      entries: Object.entries(sessionStorage),
    }));
  } catch {
    return denied('SESSION_SEED_CAPTURE_FAILED');
  }
  const created = createSessionSeedAuthority(captured);
  if (created?.ok !== true) return denied('SESSION_SEED_CAPTURE_FAILED');
  return frozen({
    ok: true,
    reason: null,
    authority: created.authority,
    receipt: created.receipt,
  });
}

export function createRecordBridgeSession({
  context,
  emitEvent,
  settleAfterClick = defaultSettleAfterClick,
  attachForensics = async () => {},
  idFactory,
  handoffReadyTimeoutMs,
} = {}) {
  if (!isContext(context) || typeof emitEvent !== 'function'
    || typeof settleAfterClick !== 'function'
    || typeof attachForensics !== 'function'
    || (idFactory !== undefined && typeof idFactory !== 'function')
    || (handoffReadyTimeoutMs !== undefined
      && (!Number.isFinite(handoffReadyTimeoutMs)
        || handoffReadyTimeoutMs < 0
        || handoffReadyTimeoutMs > 10000))) {
    return denied('RECORD_BRIDGE_FAILED');
  }

  let controller = null;
  let active = false;
  let firstFailure = null;
  let tail = Promise.resolve();
  let pageOrdinal = 0;
  let nextPageId = 0;
  const observedPages = new Map();

  function observePage(page) {
    if (!page || typeof page !== 'object' || observedPages.has(page)) return;
    observedPages.set(page, ++pageOrdinal);
  }

  function fail(reason) {
    if (!firstFailure) firstFailure = stableReason({ reason });
    active = false;
    return denied(firstFailure);
  }

  function appendEvent(event) {
    try {
      emitEvent(event);
      return true;
    } catch {
      fail('RECORD_BRIDGE_FAILED');
      return false;
    }
  }

  async function sourceIsActive(sourcePage, pageAuthority) {
    const checked = await controller.evaluateActive({
      pageAuthority,
      evaluate: (page) => page === sourcePage,
    });
    return checked?.ok === true && checked.value === true;
  }

  async function containNewPages({ beforePages, sourcePage }) {
    const before = new Set(beforePages);
    const candidates = contextPages(context).filter((page) => (
      page !== sourcePage
      && !before.has(page)
    ));
    await closePages(candidates);
  }

  function captureHandoffArrival(source, canonical) {
    if (canonical?.ok !== true
      || !HANDOFF_ACTIONS.has(canonical.event.action)) {
      return null;
    }
    const sourcePage = sourcePageOf(source);
    const beforePages = contextPages(context);
    if (!active || firstFailure || !controller || !sourcePage) {
      return {
        ok: false,
        reason: firstFailure || 'PAGE_AUTHORITY_STALE',
        sourcePage,
        beforePages,
      };
    }
    const pageAuthority = controller.activePageAuthority();
    const captured = controller.captureHandoffBoundary({
      pageAuthority,
      sourcePage,
    });
    if (captured?.ok !== true) {
      return {
        ok: false,
        reason: stableReason(captured),
        sourcePage,
        beforePages,
      };
    }
    return {
      ok: true,
      reason: null,
      sourcePage,
      beforePages,
      pageAuthority,
      handoffBoundaryAuthority: captured.handoffBoundaryAuthority,
    };
  }

  async function processEvent(source, canonical, handoffArrival) {
    if (!active || firstFailure || !controller) {
      return denied(firstFailure || 'RECORD_BRIDGE_FAILED');
    }
    const sourcePage = handoffArrival?.sourcePage || sourcePageOf(source);
    if (!sourcePage || !canonical.ok) return fail(canonical.reason);

    const event = canonical.event;
    const pageAuthority = handoffArrival?.pageAuthority
      || controller.activePageAuthority();
    if (HANDOFF_ACTIONS.has(event.action) && handoffArrival?.ok !== true) {
      return fail(handoffArrival?.reason || 'PAGE_HANDOFF_BOUNDARY_INVALID');
    }
    if (!pageAuthority || (!HANDOFF_ACTIONS.has(event.action)
      && !(await sourceIsActive(sourcePage, pageAuthority)))) {
      return fail('PAGE_AUTHORITY_STALE');
    }

    if (!HANDOFF_ACTIONS.has(event.action)) {
      if (!appendEvent(event)) return denied(firstFailure);
      return frozen({ ok: true, reason: null });
    }

    const { beforePages, handoffBoundaryAuthority } = handoffArrival;
    if (!appendEvent(event)) {
      try {
        await settleAfterClick({ sourcePage, event });
      } catch {
        // The bridge is already failed; containment still runs.
      }
      await containNewPages({ beforePages, sourcePage });
      return denied(firstFailure);
    }
    const clicked = await controller.performClick({
      pageAuthority,
      handoffBoundaryAuthority,
      perform: () => settleAfterClick({ sourcePage, event }),
    });
    if (clicked?.ok !== true) {
      await containNewPages({
        beforePages,
        sourcePage,
      });
      return fail(stableReason(clicked));
    }
    if (clicked.handoff?.kind !== 'newpage') {
      return frozen({ ok: true, reason: null });
    }

    const topology = normalizeTopologySequence({
      format: 'capture',
      events: [event, clicked.event],
    });
    if (!topology.ok) {
      await containNewPages({
        beforePages,
        sourcePage,
      });
      return fail(topology.reason);
    }
    if (!appendEvent(clicked.event)) {
      await containNewPages({ beforePages, sourcePage });
      return denied(firstFailure);
    }
    return frozen({
      ok: true,
      reason: null,
      activePageAuthority: clicked.activePageAuthority,
    });
  }

  function handleBinding(source, event) {
    const canonical = canonicalRecordEvent(event);
    const handoffArrival = captureHandoffArrival(source, canonical);
    const current = tail
      .then(() => processEvent(source, canonical, handoffArrival))
      .catch(() => fail('RECORD_BRIDGE_FAILED'));
    tail = current;
    return current;
  }

  async function activate({
    initialPage,
    sessionSeedAuthority,
  } = {}) {
    if (controller || active || firstFailure) return fail('RECORD_BRIDGE_FAILED');
    observePage(initialPage);
    const openExtras = contextPages(context).filter((page) => (
      page !== initialPage && !pageClosed(page)
    ));
    if (openExtras.length) {
      await closePages(openExtras);
      return fail('PAGE_HANDOFF_AMBIGUOUS');
    }
    const created = await createPageTopologyController({
      context,
      initialPage,
      sessionSeedAuthority,
      attachForensics,
      idFactory: idFactory || (() => `record_page_${++nextPageId}`),
      ...(handoffReadyTimeoutMs === undefined
        ? {}
        : { handoffReadyTimeoutMs }),
    });
    if (created?.ok !== true) return fail(stableReason(created));
    controller = created.controller;
    active = true;
    return frozen({
      ok: true,
      reason: null,
      controller,
      activePageAuthority: created.activePageAuthority,
      receipt: created.receipt,
    });
  }

  async function drain() {
    try {
      await tail;
    } catch {
      fail('RECORD_BRIDGE_FAILED');
    }
    return firstFailure
      ? denied(firstFailure)
      : frozen({ ok: true, reason: null });
  }

  const bridge = frozen({
    activate,
    observePage,
    handleBinding,
    drain,
    failure: () => firstFailure,
  });
  return frozen({
    ok: true,
    reason: null,
    bridge,
    receipt: frozen({
      schemaVersion: 1,
      bindingScope: 'browser-context',
      pagePolicy: 'single-active-authority',
    }),
  });
}
