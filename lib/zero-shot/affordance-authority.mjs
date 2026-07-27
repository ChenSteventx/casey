// Opaque, builder-issued authority for one exact PageObservation.
// Public objects carry no driver/handle. Those capabilities live only in WeakMaps.

const authorityStates = new WeakMap();
const latestByDriver = new WeakMap();
const lineageByDriver = new WeakMap();
let lineageSequence = 0;

function denied(reason) {
  return Object.freeze({ ok: false, reason });
}

function isObject(value) {
  return value !== null && typeof value === 'object';
}

function lineageFor(driver) {
  let token = lineageByDriver.get(driver);
  if (!token) {
    token = Object.freeze(Object.create(null));
    lineageByDriver.set(driver, token);
  }
  return token;
}

function releaseRecords(state) {
  for (const record of state.records.values()) {
    if (record?.handle && typeof record.handle.dispose === 'function') {
      Promise.resolve(record.handle.dispose()).catch(() => {});
    }
  }
}

function inspectState({ authority, observation, expectedCatalogDigest, requireLatest = true } = {}) {
  if (!isObject(authority) || !authorityStates.has(authority)) return denied('AUTHORITY_INVALID');
  const state = authorityStates.get(authority);
  if (state.disposed) return denied('AUTHORITY_DISPOSED');
  if (observation !== undefined && observation !== state.observation) {
    return denied('OBSERVATION_AUTHORITY_MISMATCH');
  }
  if (expectedCatalogDigest !== undefined
    && expectedCatalogDigest !== state.catalogDigest) {
    return denied('OBSERVATION_AUTHORITY_MISMATCH');
  }
  if (state.observation?.catalogDigest !== state.catalogDigest) {
    return denied('OBSERVATION_AUTHORITY_MISMATCH');
  }
  if (requireLatest && latestByDriver.get(state.driver) !== authority) {
    return denied('STALE_OBSERVATION');
  }
  return { ok: true, reason: null, state };
}

export function issueAffordanceAuthority({
  driver,
  observation,
  revision,
  records,
  blockReason = null,
} = {}) {
  if (!isObject(driver) || !isObject(observation) || !(records instanceof Map)) {
    return denied('AUTHORITY_BUILD_FAILED');
  }
  const previous = latestByDriver.get(driver);
  if (previous && authorityStates.has(previous)) {
    releaseRecords(authorityStates.get(previous));
  }
  const authority = Object.freeze(Object.create(null));
  const state = {
    driver,
    observation,
    observationId: observation.observationId,
    catalogDigest: observation.catalogDigest,
    revision,
    records: new Map(records),
    blockReason,
    lineageToken: lineageFor(driver),
    sequence: ++lineageSequence,
    disposed: false,
  };
  authorityStates.set(authority, state);
  latestByDriver.set(driver, authority);
  return Object.freeze({ ok: true, reason: null, authority });
}

export function inspectAffordanceAuthority(options = {}) {
  const inspected = inspectState(options);
  if (!inspected.ok) return inspected;
  const { state } = inspected;
  return Object.freeze({
    ok: true,
    reason: null,
    driver: state.driver,
    lineageToken: state.lineageToken,
    observationId: state.observationId,
    catalogDigest: state.catalogDigest,
    revision: state.revision,
  });
}

export async function revalidateAffordance({
  authority,
  observation,
  affordanceId,
  expectedCatalogDigest,
} = {}) {
  const inspected = inspectState({
    authority,
    observation,
    expectedCatalogDigest,
    requireLatest: true,
  });
  if (!inspected.ok) return inspected;
  const { state } = inspected;
  if (state.blockReason) return denied(state.blockReason);
  if (typeof affordanceId !== 'string' || !/^af_[a-z0-9_]+$/.test(affordanceId)) {
    return denied('AFFORDANCE_NOT_FOUND');
  }
  const record = state.records.get(affordanceId);
  if (!record) return denied('AFFORDANCE_NOT_FOUND');
  if (record.pageCount !== 1) return denied('AFFORDANCE_AMBIGUOUS');
  if (record.visible !== true || record.enabled !== true
    || !record.actionSpace.includes('click')) {
    return denied('AFFORDANCE_NOT_ACTIONABLE');
  }

  let current;
  try {
    current = await state.driver.revalidate({
      handle: record.handle,
      semanticSignature: record.semanticSignature,
      revision: state.revision,
    });
  } catch {
    return denied('AFFORDANCE_REVALIDATION_FAILED');
  }
  if (!isObject(current)) return denied('AFFORDANCE_REVALIDATION_FAILED');
  const stillCurrent = inspectState({
    authority,
    observation,
    expectedCatalogDigest,
    requireLatest: true,
  });
  if (!stillCurrent.ok) return stillCurrent;
  if (current.connected !== true || current.sameNode !== true) {
    return denied('AFFORDANCE_DRIFTED');
  }
  if (current.pageCount !== 1) return denied('AFFORDANCE_AMBIGUOUS');
  if (current.visible !== true || current.enabled !== true) {
    return denied('AFFORDANCE_NOT_ACTIONABLE');
  }

  return Object.freeze({
    ok: true,
    reason: null,
    target: Object.freeze({
      driver: state.driver,
      handle: record.handle,
      revision: state.revision,
      semanticSignature: record.semanticSignature,
      lineageToken: state.lineageToken,
      observationId: state.observationId,
      affordanceId,
    }),
  });
}

export async function disposeAffordanceAuthority(authority) {
  if (!isObject(authority) || !authorityStates.has(authority)) return denied('AUTHORITY_INVALID');
  const state = authorityStates.get(authority);
  if (!state.disposed) {
    state.disposed = true;
    releaseRecords(state);
  }
  return Object.freeze({ ok: true, reason: null });
}
