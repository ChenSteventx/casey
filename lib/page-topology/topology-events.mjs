// Pure, host-free topology event normalization shared by capture and formal
// replay. This module deliberately has no browser, I/O, verdict, or credential
// dependencies.

const FORMATS = new Set(['capture', 'formal']);
const HANDOFF_TRIGGERS = new Set(['click', 'dblclick']);
const BASE_URL_TOKEN = '{{baseUrl}}';
const EMBEDDED_SCHEME = /:\/\/|%3a%2f%2f/i;
const CONTROL_CHAR = /[\u0000-\u001f\u007f]/;

function frozen(value) {
  return Object.freeze(value);
}

function denied(reason) {
  return frozen({
    ok: false,
    reason,
  });
}

function succeeded(sequence) {
  return frozen({
    ok: true,
    reason: null,
    sequence: frozen(sequence),
  });
}

function eventAction(event) {
  try {
    return event && typeof event === 'object' && typeof event.action === 'string'
      ? event.action
      : null;
  } catch {
    return null;
  }
}

function topologyValue(event, format) {
  try {
    if (!event || typeof event !== 'object') return null;
    return format === 'capture' ? event.path : event.url;
  } catch {
    return null;
  }
}

function canonicalPath(value, format) {
  if (typeof value !== 'string' || !value) return null;
  let candidate = value;
  if (format === 'formal' && candidate.startsWith(BASE_URL_TOKEN)) {
    candidate = candidate.slice(BASE_URL_TOKEN.length);
  }
  if (!candidate.startsWith('/') || candidate.startsWith('//')
    || candidate.includes('#') || candidate.includes('\\')
    || CONTROL_CHAR.test(candidate) || EMBEDDED_SCHEME.test(candidate)) {
    return null;
  }
  try {
    const parsed = new URL(candidate, 'https://topology.invalid');
    if (parsed.origin !== 'https://topology.invalid' || parsed.hash) return null;
    return `${parsed.pathname || '/'}${parsed.search}`;
  } catch {
    return null;
  }
}

export function isTopologyAction(action) {
  return action === 'newpage';
}

export function normalizeTopologyPath(options = {}) {
  let value;
  let format;
  try {
    if (!options || typeof options !== 'object') {
      return denied('TOPOLOGY_SEQUENCE_INVALID');
    }
    ({ value, format } = options);
  } catch {
    return denied('TOPOLOGY_SEQUENCE_INVALID');
  }
  if (!FORMATS.has(format)) return denied('TOPOLOGY_FORMAT_INVALID');
  const path = canonicalPath(value, format);
  return path
    ? frozen({ ok: true, reason: null, path })
    : denied('TOPOLOGY_PATH_INVALID');
}

export function normalizeTopologySequence(options = {}) {
  let events;
  let format;
  try {
    if (!options || typeof options !== 'object') {
      return denied('TOPOLOGY_SEQUENCE_INVALID');
    }
    ({ events, format } = options);
  } catch {
    return denied('TOPOLOGY_SEQUENCE_INVALID');
  }
  if (!FORMATS.has(format)) return denied('TOPOLOGY_FORMAT_INVALID');
  if (!Array.isArray(events)) return denied('TOPOLOGY_SEQUENCE_INVALID');

  try {
    const sequence = [];
    for (let index = 0; index < events.length; index += 1) {
      if (!isTopologyAction(eventAction(events[index]))) continue;

      const previousAction = eventAction(events[index - 1]);
      if (isTopologyAction(previousAction)) {
        return denied('PAGE_HANDOFF_AMBIGUOUS');
      }
      if (!HANDOFF_TRIGGERS.has(previousAction)) {
        return denied('TOPOLOGY_TRIGGER_MISSING');
      }

      const normalized = normalizeTopologyPath({
        value: topologyValue(events[index], format),
        format,
      });
      if (!normalized.ok) return normalized;

      const afterActionIndex = index - 1;
      if (sequence.some((transition) => (
        transition.afterActionIndex === afterActionIndex
      ))) {
        return denied('PAGE_HANDOFF_AMBIGUOUS');
      }
      sequence.push(frozen({
        path: normalized.path,
        afterActionIndex,
      }));
    }
    return succeeded(sequence);
  } catch {
    return denied('TOPOLOGY_SEQUENCE_INVALID');
  }
}

export function assertTopologyParity(options = {}) {
  let sourceEvents;
  let distilledEvents;
  try {
    if (!options || typeof options !== 'object') {
      return denied('TOPOLOGY_SEQUENCE_INVALID');
    }
    ({ sourceEvents, distilledEvents } = options);
  } catch {
    return denied('TOPOLOGY_SEQUENCE_INVALID');
  }
  const source = normalizeTopologySequence({
    events: sourceEvents,
    format: 'capture',
  });
  if (!source.ok) return source;

  const distilled = normalizeTopologySequence({
    events: distilledEvents,
    format: 'formal',
  });
  if (!distilled.ok) return distilled;

  if (distilled.sequence.length < source.sequence.length) {
    return denied('TOPOLOGY_EVENT_DROPPED');
  }
  if (distilled.sequence.length > source.sequence.length) {
    return denied('TOPOLOGY_EVENT_ADDED');
  }
  for (let index = 0; index < source.sequence.length; index += 1) {
    const expected = source.sequence[index];
    const actual = distilled.sequence[index];
    if (actual.path !== expected.path
      || actual.afterActionIndex !== expected.afterActionIndex) {
      return denied('TOPOLOGY_PARITY_MISMATCH');
    }
  }
  return succeeded(source.sequence);
}
