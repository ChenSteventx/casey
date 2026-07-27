// Shared, deterministic consumer for capture and formal topology sequences.
// It only transports opaque page authorities and host-free canonical events.

import {
  normalizeTopologyPath,
  normalizeTopologySequence,
} from './topology-events.mjs';

const CONTROLLER_REASONS = new Set([
  'NO_ACTIVE_PAGE',
  'PAGE_AUTHORITY_INVALID',
  'PAGE_AUTHORITY_STALE',
  'PAGE_TOPOLOGY_UNAVAILABLE',
  'TOPOLOGY_EVENT_INVALID',
  'TOPOLOGY_PATH_MISMATCH',
]);

function frozen(value) {
  return Object.freeze(value);
}

function denied(reason) {
  return frozen({
    ok: false,
    reason,
  });
}

function controllerAvailable(controller) {
  try {
    return controller && typeof controller === 'object'
      && typeof controller.activePageAuthority === 'function'
      && typeof controller.consumeNewPageEvent === 'function';
  } catch {
    return false;
  }
}

function readActiveAuthority(controller) {
  try {
    const authority = controller.activePageAuthority();
    return authority && typeof authority === 'object' ? authority : null;
  } catch {
    return null;
  }
}

function canonicalNewPageEvent(event) {
  let value;
  let format;
  try {
    if (!event || typeof event !== 'object' || event.action !== 'newpage') {
      return denied('TOPOLOGY_EVENT_INVALID');
    }
    if (typeof event.path === 'string') {
      value = event.path;
      format = 'capture';
    } else if (typeof event.url === 'string') {
      value = event.url;
      format = 'formal';
    } else {
      return denied('TOPOLOGY_EVENT_INVALID');
    }
  } catch {
    return denied('TOPOLOGY_EVENT_INVALID');
  }
  const normalized = normalizeTopologyPath({ value, format });
  if (!normalized.ok) return normalized;
  return frozen({
    ok: true,
    reason: null,
    event: frozen({
      action: 'newpage',
      path: normalized.path,
    }),
  });
}

export async function consumeNewPageAction(options = {}) {
  let controller;
  let event;
  let pageAuthority;
  try {
    if (!options || typeof options !== 'object') {
      return denied('TOPOLOGY_EVENT_INVALID');
    }
    ({ controller, event, pageAuthority } = options);
  } catch {
    return denied('TOPOLOGY_EVENT_INVALID');
  }
  if (!controllerAvailable(controller)) {
    return denied('PAGE_TOPOLOGY_UNAVAILABLE');
  }
  if (!pageAuthority || typeof pageAuthority !== 'object') {
    return denied('NO_ACTIVE_PAGE');
  }
  const canonical = canonicalNewPageEvent(event);
  if (!canonical.ok) return canonical;

  let consumed;
  try {
    consumed = await controller.consumeNewPageEvent({
      pageAuthority,
      event: canonical.event,
    });
  } catch {
    return denied('TOPOLOGY_CONSUME_FAILED');
  }
  let consumedOk;
  let consumedReason;
  try {
    consumedOk = consumed?.ok === true;
    consumedReason = consumed?.reason;
  } catch {
    return denied('TOPOLOGY_CONSUME_FAILED');
  }
  if (!consumedOk) {
    return denied(
      CONTROLLER_REASONS.has(consumedReason)
        ? consumedReason
        : 'TOPOLOGY_CONSUME_FAILED',
    );
  }

  const activePageAuthority = readActiveAuthority(controller);
  if (!activePageAuthority) return denied('NO_ACTIVE_PAGE');
  return frozen({
    ok: true,
    reason: null,
    activePageAuthority,
  });
}

export async function consumeTopologySequence(options = {}) {
  let controller;
  let events;
  let format;
  let pageAuthority;
  try {
    if (!options || typeof options !== 'object') {
      return denied('TOPOLOGY_SEQUENCE_INVALID');
    }
    ({ controller, events, format, pageAuthority } = options);
  } catch {
    return denied('TOPOLOGY_SEQUENCE_INVALID');
  }
  if (!controllerAvailable(controller)) {
    return denied('PAGE_TOPOLOGY_UNAVAILABLE');
  }
  const normalized = normalizeTopologySequence({ events, format });
  if (!normalized.ok) return normalized;

  let activePageAuthority = pageAuthority === undefined
    ? readActiveAuthority(controller)
    : pageAuthority;
  if (!activePageAuthority || typeof activePageAuthority !== 'object') {
    return denied('NO_ACTIVE_PAGE');
  }

  for (const transition of normalized.sequence) {
    const consumed = await consumeNewPageAction({
      controller,
      pageAuthority: activePageAuthority,
      event: {
        action: 'newpage',
        path: transition.path,
      },
    });
    if (!consumed.ok) return denied(consumed.reason);
    activePageAuthority = consumed.activePageAuthority;
  }

  return frozen({
    ok: true,
    reason: null,
    activePageAuthority,
    transitionCount: normalized.sequence.length,
  });
}
