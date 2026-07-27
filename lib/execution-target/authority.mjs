// Process-local capability for execution-target projections.
// Public authority and receipt contain no target or transport endpoint values.

import { evaluateExecutionTargetPolicy } from './policy.mjs';

const AUTHORITY_STATE = new WeakMap();

function reject(reason) {
  return Object.freeze({ ok: false, reason });
}

export function resolveExecutionTarget(request) {
  const policy = evaluateExecutionTargetPolicy(request);
  if (!policy.ok) return reject(policy.reason);

  const receipt = Object.freeze({
    schemaVersion: 1,
    runtimeClass: policy.runtimeClass,
    transportMode: policy.transportMode,
    originContinuity: policy.originContinuity,
    fragmentPolicy: policy.fragmentPolicy,
  });
  const authority = Object.freeze(Object.create(null));
  AUTHORITY_STATE.set(authority, Object.freeze({ policy, receipt }));
  return Object.freeze({ ok: true, authority, receipt });
}

// Internal runtime seam. Clone/spread/JSON round-trips are absent from the WeakMap.
export function readExecutionTargetAuthority(authority) {
  if (!authority || typeof authority !== 'object') return null;
  return AUTHORITY_STATE.get(authority) || null;
}
