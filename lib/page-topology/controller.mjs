// Deterministic same-context page lifecycle and active-page authority.
// Playwright-like context/page objects and forensics installation are injected.

import {
  installSessionSeedOnPage,
  sessionSeedMatchesPage,
  validateSessionSeedAuthority,
} from './session-seed.mjs';
import { normalizeTopologyPath } from './topology-events.mjs';

const PAGE_AUTHORITIES = new WeakMap();
const HANDOFF_BOUNDARY_AUTHORITIES = new WeakMap();
const CONTROLLER_STATES = new WeakMap();
const PAGE_ID = /^[A-Za-z][A-Za-z0-9_-]{0,127}$/;
const DEFAULT_HANDOFF_READY_TIMEOUT_MS = 1000;
const HANDOFF_READY_POLL_MS = 10;

function frozen(value) {
  return Object.freeze(value);
}

function denied(reason, extra = {}) {
  return frozen({
    ok: false,
    reason,
    ...extra,
  });
}

function verdictDenied(reason, extra = {}) {
  return denied(reason, {
    ...extra,
    verdictHint: 'NEEDS_HUMAN',
  });
}

function isPage(value) {
  return value && typeof value === 'object'
    && typeof value.url === 'function'
    && typeof value.opener === 'function'
    && typeof value.on === 'function'
    && typeof value.isClosed === 'function';
}

function isContext(value) {
  return value && typeof value === 'object'
    && typeof value.on === 'function'
    && typeof value.pages === 'function';
}

function locationOf(page) {
  try {
    const url = new URL(page.url());
    if (!['http:', 'https:'].includes(url.protocol)
      || url.origin === 'null') {
      return null;
    }
    return {
      origin: url.origin,
      path: `${url.pathname || '/'}${url.search}`,
    };
  } catch {
    return null;
  }
}

function originOf(page) {
  return locationOf(page)?.origin || null;
}

function safePathOf(page) {
  return locationOf(page)?.path || null;
}

function isClosed(record) {
  if (!record || record.closed) return true;
  try {
    return record.page.isClosed() === true;
  } catch {
    return true;
  }
}

function inspectedAuthority(state, authority) {
  if (!authority || typeof authority !== 'object'
    || !PAGE_AUTHORITIES.has(authority)) {
    return denied('PAGE_AUTHORITY_INVALID');
  }
  const record = PAGE_AUTHORITIES.get(authority);
  if (record.controllerState !== state) return denied('PAGE_AUTHORITY_INVALID');
  if (record !== state.active || isClosed(record)) {
    return verdictDenied('PAGE_AUTHORITY_STALE');
  }
  return { ok: true, reason: null, record };
}

function captureHandoffBoundary(state, {
  pageAuthority,
  sourcePage,
} = {}) {
  const active = inspectedAuthority(state, pageAuthority);
  if (!active.ok) return active;
  if (!isPage(sourcePage) || sourcePage !== active.record.page) {
    return verdictDenied('PAGE_AUTHORITY_STALE');
  }

  // A later binding arrival closes the preceding generation before its DOM
  // side effect can surface as a context "page" event. This partitions queued
  // record callbacks without exposing a forgeable numeric ordinal.
  const previous = state.openHandoffBoundary;
  if (previous && previous.endOrdinal === null) {
    previous.endOrdinal = state.eventOrdinal;
  }
  const authority = frozen(Object.create(null));
  const boundary = {
    controllerState: state,
    openerRecord: active.record,
    startOrdinal: state.eventOrdinal,
    endOrdinal: null,
    consumed: false,
  };
  HANDOFF_BOUNDARY_AUTHORITIES.set(authority, boundary);
  state.openHandoffBoundary = boundary;
  return frozen({
    ok: true,
    reason: null,
    handoffBoundaryAuthority: authority,
  });
}

function inspectedHandoffBoundary(state, opener, authority) {
  if (!authority || typeof authority !== 'object'
    || !HANDOFF_BOUNDARY_AUTHORITIES.has(authority)) {
    return denied('PAGE_HANDOFF_BOUNDARY_INVALID');
  }
  const boundary = HANDOFF_BOUNDARY_AUTHORITIES.get(authority);
  if (boundary.controllerState !== state
    || boundary.openerRecord !== opener
    || boundary.consumed) {
    return denied('PAGE_HANDOFF_BOUNDARY_INVALID');
  }
  boundary.consumed = true;
  return { ok: true, reason: null, boundary };
}

function nextPageId(state) {
  let value;
  try {
    value = state.idFactory();
  } catch {
    return denied('PAGE_ID_ALLOCATION_FAILED');
  }
  if (typeof value !== 'string' || !PAGE_ID.test(value) || state.ids.has(value)) {
    return denied('PAGE_ID_ALLOCATION_FAILED');
  }
  state.ids.add(value);
  return { ok: true, value };
}

async function installPageCapabilities(state, page) {
  let seedInstalled = null;
  let seedFailure = null;
  if (state.sessionSeedAuthority) {
    const installed = await installSessionSeedOnPage({
      authority: state.sessionSeedAuthority,
      page,
    });
    if (installed?.ok !== true) {
      seedFailure = installed?.reason || 'PAGE_INIT_SCRIPT_FAILED';
    } else {
      // Popup registration commonly occurs while its URL is still
      // about:blank. Successful listener-first installation is durable;
      // origin matching is read dynamically immediately before handoff.
      seedInstalled = true;
    }
  }
  try {
    await state.attachForensics({
      page,
      pageId: state.pageRecords.get(page)?.pageId,
    });
  } catch {
    return denied('PAGE_FORENSICS_ATTACH_FAILED');
  }
  if (seedFailure) return denied(seedFailure);
  return { ok: true, seedInstalled };
}

async function registerPage(state, page, eventOrdinal) {
  if (!isPage(page)) return denied('PAGE_REGISTRATION_FAILED');
  const known = state.pageRecords.get(page);
  if (known) return { ok: true, record: known, duplicate: true };

  const id = nextPageId(state);
  if (!id.ok) return id;

  const record = {
    controllerState: state,
    page,
    pageId: id.value,
    openerPage: null,
    openerRecord: null,
    eventOrdinal,
    closed: false,
    authority: null,
  };
  const authority = frozen(Object.create(null));
  record.authority = authority;
  state.pageRecords.set(page, record);
  PAGE_AUTHORITIES.set(authority, record);

  const installed = await installPageCapabilities(state, page);
  if (!installed.ok) {
    record.closed = true;
    return installed;
  }
  record.seedInstalled = installed.seedInstalled;

  let openerPage;
  try {
    openerPage = await page.opener();
  } catch {
    record.closed = true;
    return denied('PAGE_OPENER_READ_FAILED');
  }
  record.openerPage = openerPage || null;
  record.openerRecord = openerPage
    ? (state.pageRecords.get(openerPage) || null)
    : null;

  page.on('close', () => {
    record.closed = true;
    if (state.active !== record) return;
    const opener = record.openerRecord;
    state.active = opener && !isClosed(opener) ? opener : null;
  });

  if (isClosed(record)) {
    record.closed = true;
    return denied('PAGE_CLOSED');
  }
  state.registrations.push(record);
  return { ok: true, record, duplicate: false };
}

function scheduleRegistration(state, page, eventOrdinal) {
  const scheduled = state.scheduledPages.get(page);
  if (scheduled) return scheduled;

  const registration = registerPage(state, page, eventOrdinal)
    .catch(() => denied('PAGE_REGISTRATION_FAILED'));
  const task = registration.then((result) => {
    state.registrationOutcomes.push({ eventOrdinal, result });
    return result;
  });
  state.scheduledPages.set(page, task);
  state.pending.add(task);
  task.finally(() => state.pending.delete(task));
  return task;
}

async function drainRegistrations(state) {
  while (state.pending.size) {
    await Promise.all([...state.pending]);
  }
}

function sameAuthContinuity(state, opener, candidate, candidateLocation) {
  const openerOrigin = originOf(opener.page);
  if (!openerOrigin || !candidateLocation?.origin
    || candidateLocation.origin !== openerOrigin) {
    return false;
  }
  if (!state.sessionSeedAuthority) return true;
  const openerMatch = sessionSeedMatchesPage({
    authority: state.sessionSeedAuthority,
    page: opener.page,
  });
  const candidateMatch = sessionSeedMatchesPage({
    authority: state.sessionSeedAuthority,
    page: candidate.page,
  });
  return openerMatch?.ok === true && openerMatch.matches === true
    && candidateMatch?.ok === true && candidateMatch.matches === true
    && candidate.seedInstalled === true;
}

async function waitForHandoffLocation(state, candidate) {
  const deadline = Date.now() + state.handoffReadyTimeoutMs;
  while (true) {
    if (isClosed(candidate)) return denied('PAGE_CLOSED');
    const location = locationOf(candidate.page);
    if (location) return { ok: true, reason: null, location };
    if (Date.now() >= deadline) return denied('PAGE_URL_NOT_READY');
    await new Promise((resolve) => setTimeout(resolve, HANDOFF_READY_POLL_MS));
  }
}

function handoffReceipt(candidate, path) {
  return frozen({
    kind: 'newpage',
    candidateCount: 1,
    pageId: candidate.pageId,
    openerPageId: candidate.openerRecord.pageId,
    path,
  });
}

async function performClick(state, {
  pageAuthority,
  perform,
  handoffBoundaryAuthority,
} = {}) {
  const active = inspectedAuthority(state, pageAuthority);
  if (!active.ok) return active;
  if (typeof perform !== 'function') return denied('PAGE_ACTION_INVALID');

  const opener = active.record;
  let frozenBoundary = null;
  if (handoffBoundaryAuthority !== undefined) {
    const inspected = inspectedHandoffBoundary(
      state,
      opener,
      handoffBoundaryAuthority,
    );
    if (!inspected.ok) return inspected;
    frozenBoundary = inspected.boundary;
  }
  const boundary = frozenBoundary?.startOrdinal ?? state.eventOrdinal;
  let performFailed = false;
  try {
    await perform(opener.page);
  } catch {
    performFailed = true;
  }
  await drainRegistrations(state);
  if (frozenBoundary?.endOrdinal === null) {
    frozenBoundary.endOrdinal = state.eventOrdinal;
  }
  if (performFailed) return verdictDenied('PAGE_ACTION_FAILED');
  if (state.active !== opener || isClosed(opener)) {
    return verdictDenied('NO_ACTIVE_PAGE');
  }

  const upperBoundary = frozenBoundary?.endOrdinal ?? state.eventOrdinal;
  const withinBoundary = (eventOrdinal) => (
    eventOrdinal > boundary && eventOrdinal <= upperBoundary
  );
  const outcomes = state.registrationOutcomes
    .filter((outcome) => withinBoundary(outcome.eventOrdinal));
  const registrationFailure = outcomes.find((outcome) => outcome.result?.ok !== true);
  if (registrationFailure) {
    return verdictDenied(
      registrationFailure.result?.reason || 'PAGE_REGISTRATION_FAILED',
    );
  }
  const candidates = state.registrations
    .filter((record) => withinBoundary(record.eventOrdinal));
  if (candidates.length === 0) {
    return frozen({
      ok: true,
      reason: null,
      handoff: frozen({ kind: 'none', candidateCount: 0 }),
      activePageAuthority: opener.authority,
    });
  }
  if (candidates.length > 1) {
    return verdictDenied('PAGE_HANDOFF_AMBIGUOUS', {
      candidateCount: candidates.length,
    });
  }

  const candidate = candidates[0];
  if (isClosed(candidate)) return verdictDenied('PAGE_CLOSED');
  if (!candidate.openerPage || !candidate.openerRecord) {
    return verdictDenied('OPENER_AUTHORITY_MISSING');
  }
  if (candidate.openerRecord !== opener) {
    return verdictDenied('OPENER_AUTHORITY_MISMATCH');
  }
  const ready = await waitForHandoffLocation(state, candidate);
  if (!ready.ok) return verdictDenied(ready.reason);
  if (!sameAuthContinuity(state, opener, candidate, ready.location)) {
    return verdictDenied('AUTH_CONTINUITY_UNAVAILABLE');
  }
  const confirmedLocation = locationOf(candidate.page);
  const confirmedOpenerOrigin = originOf(opener.page);
  if (!confirmedLocation
    || confirmedOpenerOrigin !== ready.location.origin
    || confirmedLocation.origin !== ready.location.origin
    || confirmedLocation.path !== ready.location.path) {
    return verdictDenied('AUTH_CONTINUITY_UNAVAILABLE');
  }

  state.active = candidate;
  const handoff = handoffReceipt(candidate, confirmedLocation.path);
  return frozen({
    ok: true,
    reason: null,
    handoff,
    event: frozen({ action: 'newpage', path: confirmedLocation.path }),
    activePageAuthority: candidate.authority,
  });
}

async function evaluateActive(state, {
  pageAuthority,
  evaluate,
} = {}) {
  const active = inspectedAuthority(state, pageAuthority);
  if (!active.ok) return active;
  if (typeof evaluate !== 'function') return denied('PAGE_EVALUATION_INVALID');
  try {
    const value = await evaluate(active.record.page);
    return frozen({ ok: true, reason: null, value });
  } catch {
    return verdictDenied('PAGE_EVALUATION_FAILED');
  }
}

async function consumeNewPageEvent(state, {
  pageAuthority,
  event,
} = {}) {
  const active = inspectedAuthority(state, pageAuthority);
  if (!active.ok) return active;
  if (!event || event.action !== 'newpage') return denied('TOPOLOGY_EVENT_INVALID');
  const normalized = typeof event.path === 'string'
    ? normalizeTopologyPath({ value: event.path, format: 'capture' })
    : normalizeTopologyPath({ value: event.url, format: 'formal' });
  if (!normalized.ok || normalized.path !== safePathOf(active.record.page)) {
    return verdictDenied('TOPOLOGY_PATH_MISMATCH');
  }
  return frozen({
    ok: true,
    reason: null,
    pageId: active.record.pageId,
  });
}

export async function createPageTopologyController({
  context,
  initialPage,
  sessionSeedAuthority,
  attachForensics,
  idFactory,
  handoffReadyTimeoutMs = DEFAULT_HANDOFF_READY_TIMEOUT_MS,
} = {}) {
  if (!isContext(context) || !isPage(initialPage)
    || typeof attachForensics !== 'function'
    || typeof idFactory !== 'function'
    || !Number.isFinite(handoffReadyTimeoutMs)
    || handoffReadyTimeoutMs < 0
    || handoffReadyTimeoutMs > 10000) {
    return denied('PAGE_TOPOLOGY_INPUT_INVALID');
  }
  let contextPages;
  try {
    contextPages = context.pages();
  } catch {
    return denied('PAGE_TOPOLOGY_INPUT_INVALID');
  }
  if (!Array.isArray(contextPages) || !contextPages.includes(initialPage)) {
    return denied('PAGE_CONTEXT_MISMATCH');
  }
  if (sessionSeedAuthority !== undefined
    && validateSessionSeedAuthority(sessionSeedAuthority)?.ok !== true) {
    return denied('SESSION_SEED_AUTHORITY_INVALID');
  }
  if (sessionSeedAuthority !== undefined
    && sessionSeedMatchesPage({
      authority: sessionSeedAuthority,
      page: initialPage,
    })?.matches !== true) {
    return denied('AUTH_CONTINUITY_UNAVAILABLE');
  }

  const state = {
    context,
    sessionSeedAuthority: sessionSeedAuthority || null,
    attachForensics,
    idFactory,
    ids: new Set(),
    pageRecords: new WeakMap(),
    scheduledPages: new WeakMap(),
    registrations: [],
    registrationOutcomes: [],
    pending: new Set(),
    eventOrdinal: 0,
    active: null,
    openHandoffBoundary: null,
    handoffReadyTimeoutMs,
  };

  // This listener is deliberately installed before the initial page is
  // registered, so no subsequent page can escape seed/forensics setup.
  context.on('page', (page) => {
    const ordinal = ++state.eventOrdinal;
    scheduleRegistration(state, page, ordinal);
  });

  const initial = await scheduleRegistration(state, initialPage, 0);
  await drainRegistrations(state);
  if (initial?.ok !== true || !initial.record) {
    return denied(initial?.reason || 'PAGE_REGISTRATION_FAILED');
  }
  state.active = initial.record;

  const controller = frozen({
    activePageAuthority: () => state.active?.authority || null,
    captureHandoffBoundary: (options) => captureHandoffBoundary(state, options),
    performClick: (options) => performClick(state, options),
    evaluateActive: (options) => evaluateActive(state, options),
    consumeNewPageEvent: (options) => consumeNewPageEvent(state, options),
  });
  CONTROLLER_STATES.set(controller, state);
  return frozen({
    ok: true,
    reason: null,
    controller,
    activePageAuthority: initial.record.authority,
    receipt: frozen({
      schemaVersion: 1,
      contextPolicy: 'same-context-only',
      activePagePolicy: 'single-authority',
    }),
  });
}

export function createActivePageFacade(controller) {
  const state = CONTROLLER_STATES.get(controller);
  if (!state) return denied('PAGE_TOPOLOGY_UNAVAILABLE');
  const facade = new Proxy(Object.create(null), {
    get(_target, property) {
      const active = state.active;
      if (!active || isClosed(active)) {
        const failure = new Error('NO_ACTIVE_PAGE');
        failure.reason = 'NO_ACTIVE_PAGE';
        throw failure;
      }
      const value = active.page[property];
      return typeof value === 'function' ? value.bind(active.page) : value;
    },
    set() {
      return false;
    },
  });
  return frozen({ ok: true, reason: null, page: facade });
}
