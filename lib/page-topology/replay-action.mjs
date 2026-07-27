// Formal replay adapter for structural newpage actions. It deliberately does
// not accept a Page: a stale fixed page therefore cannot be touched.

function frozen(value) {
  return Object.freeze(value);
}

const FAILURE_REASONS = new Set([
  'AUTH_CONTINUITY_UNAVAILABLE',
  'NO_ACTIVE_PAGE',
  'OPENER_AUTHORITY_MISMATCH',
  'OPENER_AUTHORITY_MISSING',
  'PAGE_AUTHORITY_INVALID',
  'PAGE_AUTHORITY_STALE',
  'PAGE_ACTION_FAILED',
  'PAGE_ACTION_INVALID',
  'PAGE_CLOSED',
  'PAGE_EVALUATION_FAILED',
  'PAGE_EVALUATION_INVALID',
  'PAGE_HANDOFF_AMBIGUOUS',
  'PAGE_PATH_UNAVAILABLE',
  'PAGE_TOPOLOGY_UNAVAILABLE',
  'TOPOLOGY_CONSUME_FAILED',
  'TOPOLOGY_EVENT_INVALID',
  'TOPOLOGY_PATH_MISMATCH',
]);

function stableReason(reason) {
  return FAILURE_REASONS.has(reason) ? reason : 'TOPOLOGY_CONSUME_FAILED';
}

function failed(reason, { unavailable = false } = {}) {
  const safeReason = stableReason(reason);
  return frozen({
    ok: false,
    reason: safeReason,
    ...(unavailable ? { rejectReason: safeReason } : {}),
    resolution: 'action_failed',
    candidateCount: 0,
    identityReadback: frozen({ ok: false }),
  });
}

function available(topology) {
  return topology && typeof topology === 'object'
    && typeof topology.activePageAuthority === 'function'
    && typeof topology.consumeNewPageEvent === 'function';
}

export async function dispatchNewPageReplayAction({
  topology,
  event,
  consumeNewPageAction,
} = {}) {
  if (!available(topology)) {
    return failed('PAGE_TOPOLOGY_UNAVAILABLE', { unavailable: true });
  }
  if (typeof consumeNewPageAction !== 'function') {
    return failed('PAGE_TOPOLOGY_UNAVAILABLE', { unavailable: true });
  }

  let pageAuthority;
  try {
    pageAuthority = topology.activePageAuthority();
  } catch {
    return failed('NO_ACTIVE_PAGE');
  }
  if (!pageAuthority || typeof pageAuthority !== 'object') {
    return failed('NO_ACTIVE_PAGE');
  }

  let consumed;
  try {
    // The shared bridge validates/canonicalizes the formal path. This narrow
    // proxy then preserves the compiler-authored event object at the controller
    // boundary, where formal/capture normalization is also enforced.
    consumed = await consumeNewPageAction({
      controller: {
        activePageAuthority: () => topology.activePageAuthority(),
        consumeNewPageEvent: ({ pageAuthority: consumedAuthority }) =>
          topology.consumeNewPageEvent({
            pageAuthority: consumedAuthority,
            event,
          }),
      },
      pageAuthority,
      event,
    });
  } catch {
    return failed('TOPOLOGY_CONSUME_FAILED');
  }
  if (consumed?.ok !== true) {
    return failed(consumed?.reason);
  }
  if (consumed.resolution !== undefined && consumed.resolution !== 'unique') {
    return failed('TOPOLOGY_CONSUME_FAILED');
  }
  return frozen({
    ok: true,
    reason: null,
    resolution: 'unique',
    candidateCount: 1,
    identityReadback: frozen({ ok: true }),
  });
}

export async function dispatchActivePageReplayAction({
  topology,
  event,
  perform,
} = {}) {
  if (!available(topology)
    || typeof topology.evaluateActive !== 'function'
    || typeof topology.performClick !== 'function') {
    return failed('PAGE_TOPOLOGY_UNAVAILABLE', { unavailable: true });
  }
  if (typeof perform !== 'function') return failed('TOPOLOGY_CONSUME_FAILED');
  let pageAuthority;
  try {
    pageAuthority = topology.activePageAuthority();
  } catch {
    return failed('NO_ACTIVE_PAGE');
  }
  if (!pageAuthority || typeof pageAuthority !== 'object') {
    return failed('NO_ACTIVE_PAGE');
  }

  let actionResult;
  const invoke = async (activePage) => {
    actionResult = await perform(activePage);
    return actionResult;
  };
  let topologyResult;
  try {
    topologyResult = event?.action === 'click' || event?.action === 'dblclick'
      ? await topology.performClick({ pageAuthority, perform: invoke })
      : await topology.evaluateActive({ pageAuthority, evaluate: invoke });
  } catch {
    return failed('TOPOLOGY_CONSUME_FAILED');
  }
  if (topologyResult?.ok !== true) return failed(topologyResult?.reason);
  if (!actionResult || typeof actionResult !== 'object') {
    return failed('TOPOLOGY_CONSUME_FAILED');
  }
  return actionResult;
}
