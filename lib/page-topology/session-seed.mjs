// In-process authority for tab-scoped sessionStorage continuity.
// Public artifacts never contain the captured origin, keys, values, or counts.

const SEED_STATES = new WeakMap();

const RECEIPT = Object.freeze({
  schemaVersion: 1,
  originPolicy: 'same-origin-only',
  valuePersistence: 'memory-only',
});

function denied(reason) {
  return Object.freeze({
    ok: false,
    reason,
    authority: null,
    receipt: null,
  });
}

function normalizedOrigin(value) {
  if (typeof value !== 'string' || !value) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)
      || url.username || url.password
      || url.pathname !== '/'
      || url.search || url.hash) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function copiedEntries(entries) {
  if (!Array.isArray(entries)) return null;
  const copy = [];
  for (const pair of entries) {
    if (!Array.isArray(pair) || pair.length !== 2
      || typeof pair[0] !== 'string'
      || typeof pair[1] !== 'string') {
      return null;
    }
    copy.push(Object.freeze([pair[0], pair[1]]));
  }
  return Object.freeze(copy);
}

function seedState(authority) {
  if (!authority || typeof authority !== 'object') return null;
  return SEED_STATES.get(authority) || null;
}

function pageOrigin(page) {
  if (!page || typeof page.url !== 'function') return null;
  try {
    const origin = new URL(page.url()).origin;
    return origin === 'null' ? null : origin;
  } catch {
    return null;
  }
}

function installEntries({ origin, entries }) {
  if (location.origin !== origin) return;
  for (const [key, value] of entries) sessionStorage.setItem(key, value);
}

export function createSessionSeedAuthority({ origin, entries } = {}) {
  const capturedOrigin = normalizedOrigin(origin);
  if (!capturedOrigin) return denied('SESSION_SEED_ORIGIN_INVALID');
  const capturedEntries = copiedEntries(entries);
  if (!capturedEntries) return denied('SESSION_SEED_ENTRIES_INVALID');

  const authority = Object.freeze(Object.create(null));
  SEED_STATES.set(authority, Object.freeze({
    origin: capturedOrigin,
    entries: capturedEntries,
  }));
  return Object.freeze({
    ok: true,
    reason: null,
    authority,
    receipt: RECEIPT,
  });
}

// Internal adapter surface used by the topology controller. It returns only
// classification facts; captured values stay inside this module and the
// privileged page init-script call.
export function validateSessionSeedAuthority(authority) {
  return seedState(authority)
    ? Object.freeze({ ok: true, reason: null })
    : Object.freeze({ ok: false, reason: 'SESSION_SEED_AUTHORITY_INVALID' });
}

export function sessionSeedMatchesPage({ authority, page } = {}) {
  const state = seedState(authority);
  if (!state) {
    return Object.freeze({
      ok: false,
      reason: 'SESSION_SEED_AUTHORITY_INVALID',
      matches: false,
    });
  }
  return Object.freeze({
    ok: true,
    reason: null,
    matches: pageOrigin(page) === state.origin,
  });
}

export async function installSessionSeedOnPage({ authority, page } = {}) {
  const state = seedState(authority);
  if (!state) {
    return Object.freeze({
      ok: false,
      reason: 'SESSION_SEED_AUTHORITY_INVALID',
      originMatched: false,
    });
  }
  if (!page || typeof page.addInitScript !== 'function') {
    return Object.freeze({
      ok: false,
      reason: 'PAGE_INIT_SCRIPT_UNAVAILABLE',
      originMatched: false,
    });
  }
  try {
    await page.addInitScript(installEntries, {
      origin: state.origin,
      entries: state.entries.map(([key, value]) => [key, value]),
    });
  } catch {
    return Object.freeze({
      ok: false,
      reason: 'PAGE_INIT_SCRIPT_FAILED',
      originMatched: false,
    });
  }
  return Object.freeze({
    ok: true,
    reason: null,
    originMatched: pageOrigin(page) === state.origin,
  });
}
