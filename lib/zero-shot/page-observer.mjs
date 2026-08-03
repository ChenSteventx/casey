// Main-frame-only observation pipeline. It emits a bounded, inert PageObservation
// and delegates all physical capability binding to affordance-catalog.

import { maskCredentialRoute, stripUrlQuery } from '../cred-gate.mjs';
import {
  bindObservationAuthority,
  createAffordanceCatalog,
} from './affordance-catalog.mjs';
import {
  sanitizePublicPathname,
  sanitizePublicTitle,
} from './public-observation-redaction.mjs';

let observationSequence = 0;

function denied(reason) {
  return Object.freeze({ ok: false, reason });
}

function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) deepFreeze(value[key], seen);
  return Object.freeze(value);
}

function pathnameOf(rawUrl) {
  const stripped = stripUrlQuery(typeof rawUrl === 'string' ? rawUrl : '/');
  let pathname = '/';
  try {
    pathname = new URL(stripped, 'https://casey.invalid').pathname || '/';
  } catch {
    pathname = stripped.startsWith('/') ? stripped : '/';
  }
  return sanitizePublicPathname(maskCredentialRoute(stripUrlQuery(pathname)));
}

function scopesOf(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return deepFreeze({
    iframe: source.iframe === true,
    shadow: source.shadow === true,
    containerOnly: source.containerOnly === true,
  });
}

function blockReason({ settled, truncated, unsupportedScopes }) {
  if (!settled) return 'OBSERVATION_UNSETTLED';
  if (truncated) return 'CATALOG_TRUNCATED';
  if (Object.values(unsupportedScopes).some(Boolean)) return 'UNSUPPORTED_SCOPE';
  return null;
}

function validDriver(driver) {
  return driver && typeof driver === 'object'
    && typeof driver.settle === 'function'
    && typeof driver.snapshotMainFrame === 'function';
}

export async function observePage({ driver, intentId, maxCandidates = 20 } = {}) {
  if (!validDriver(driver)
    || typeof intentId !== 'string' || !intentId.trim()
    || !Number.isInteger(maxCandidates) || maxCandidates < 1 || maxCandidates > 500) {
    return denied('INVALID_OBSERVER_INPUT');
  }

  let settleFact;
  try {
    settleFact = await driver.settle();
  } catch {
    return denied('PAGE_SETTLE_FAILED');
  }
  if (!settleFact || typeof settleFact !== 'object'
    || typeof settleFact.settled !== 'boolean') {
    return denied('PAGE_SETTLE_FAILED');
  }

  let snapshot;
  try {
    snapshot = await driver.snapshotMainFrame({ maxCandidates });
  } catch {
    return denied('PAGE_SNAPSHOT_FAILED');
  }
  if (!snapshot || typeof snapshot !== 'object'
    || typeof snapshot.revision !== 'string' || !snapshot.revision
    || !Array.isArray(snapshot.affordances)) {
    return denied('PAGE_SNAPSHOT_FAILED');
  }

  const catalog = createAffordanceCatalog({ snapshot, maxCandidates });
  if (!catalog.ok) return denied(catalog.reason);
  const unsupportedScopes = scopesOf(snapshot.unsupportedScopes);
  const observation = deepFreeze({
    schemaVersion: 1,
    artifactKind: 'page-observation',
    observationId: `obs_${++observationSequence}`,
    intentId: intentId.trim(),
    frameScope: 'main',
    urlPathname: pathnameOf(snapshot.url),
    title: sanitizePublicTitle(snapshot.title),
    settled: settleFact.settled === true,
    catalogDigest: catalog.catalogDigest,
    affordances: catalog.affordances,
    unsupportedScopes,
    truncated: catalog.truncated,
    redactionSuppressed: catalog.redactionSuppressed,
    signed: false,
    replayReady: false,
  });
  const authorityResult = bindObservationAuthority({
    driver,
    observation,
    revision: snapshot.revision,
    records: catalog.records,
    blockReason: blockReason({
      settled: observation.settled,
      truncated: observation.truncated,
      unsupportedScopes,
    }),
  });
  if (!authorityResult.ok) return denied(authorityResult.reason);
  return Object.freeze({
    ok: true,
    reason: null,
    observation,
    authority: authorityResult.authority,
  });
}
