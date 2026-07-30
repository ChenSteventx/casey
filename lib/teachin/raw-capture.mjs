// 示教 capture 的 exact bytes 准入与全包预检。纯核心：零 browser、零 network、零 LLM。
// 准入成功只发 opaque 多读 capability（captureAuthority）；hash 口径冻结为「调用方传入的最终字节」，
// 绝不按 JSON.parse 后重序列化的字节算。任何预检失败都发生在 runtime 之前：不启动 fresh runtime、
// 不读页面、不执行任何先前事件（护栏 #14 fail-safe）。

import { createHash } from 'node:crypto';
import {
  ALLOWED_ACTIONS,
  ALLOWED_EVENT_KEYS,
  isSensitiveField,
} from '../record-capture.mjs';
import {
  normalizeTopologyPath,
  normalizeTopologySequence,
} from '../page-topology/topology-events.mjs';

const CAPTURE_AUTHORITY_STATE = new WeakMap();

const DOCUMENT_KEYS = [
  'artifactKind',
  'caseId',
  'createdAt',
  'events',
  'schemaVersion',
  'source',
  'startPath',
];
const SOURCE_KEYS = ['distillRequired', 'kind', 'replayReady', 'signed'];
const SELECTOR_ACTIONS = new Set(['click', 'dblclick', 'fill', 'press']);
const MASKED_VALUE = '<redacted>';

function frozen(value) {
  return Object.freeze(value);
}

function denied(reason, failedSeq) {
  return frozen(failedSeq === undefined
    ? { ok: false, reason }
    : { ok: false, reason, failedSeq });
}

function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.keys(value).sort().join(' ') === expected.join(' ');
}

function copyBytes(captureBytes) {
  if (Buffer.isBuffer(captureBytes)) return Buffer.from(captureBytes);
  if (captureBytes instanceof Uint8Array) return Buffer.from(captureBytes);
  return null;
}

// 优先级 2：JSON、artifactKind、schema、source 降权标志与闭合形状。
function readDocument(bytes) {
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch {
    return null;
  }
  if (!exactKeys(parsed, DOCUMENT_KEYS)) return null;
  if (parsed.schemaVersion !== 1) return null;
  if (parsed.artifactKind !== 'teach-in-capture') return null;
  if (typeof parsed.caseId !== 'string' || !parsed.caseId) return null;
  if (typeof parsed.createdAt !== 'string' || !parsed.createdAt) return null;
  if (typeof parsed.startPath !== 'string') return null;
  if (!exactKeys(parsed.source, SOURCE_KEYS)) return null;
  const source = parsed.source;
  if (typeof source.kind !== 'string' || !source.kind) return null;
  // 示教 capture 恒为未签、不可直接回放、必须蒸馏的语料。
  if (source.signed !== false || source.replayReady !== false
    || source.distillRequired !== true) return null;
  if (!Array.isArray(parsed.events)) return null;
  for (const event of parsed.events) {
    if (!event || typeof event !== 'object' || Array.isArray(event)) return null;
    for (const key of Object.keys(event)) {
      if (!ALLOWED_EVENT_KEYS.has(key)) return null;
    }
    if (typeof event.action !== 'string' || !ALLOWED_ACTIONS.has(event.action)) return null;
  }
  return parsed;
}

function checkSeq(events) {
  for (const event of events) {
    if (!Number.isSafeInteger(event.seq) || event.seq <= 0) {
      return denied('CAPTURE_SEQ_INVALID');
    }
  }
  const seen = new Set();
  for (const event of events) {
    if (seen.has(event.seq)) return denied('CAPTURE_SEQ_DUPLICATE', event.seq);
    seen.add(event.seq);
  }
  for (let index = 0; index < events.length; index += 1) {
    if (events[index].seq !== index + 1) {
      return denied('CAPTURE_SEQ_GAP', events[index].seq);
    }
  }
  return null;
}

function checkPaths(capture) {
  const start = normalizeTopologyPath({ value: capture.startPath, format: 'capture' });
  if (!start.ok) return denied('CAPTURE_PATH_INVALID');
  for (const event of capture.events) {
    const path = normalizeTopologyPath({ value: event.path, format: 'capture' });
    if (!path.ok) return denied('CAPTURE_PATH_INVALID', event.seq);
  }
  return null;
}

// 优先级 9：证据级整包拒绝——不只看 fill。任意动作携遮蔽标记、规范遮蔽值或敏感字段元数据即拒。
function checkSensitiveEvidence(events) {
  for (const event of events) {
    if (event.valueMasked === true || event.value === MASKED_VALUE
      || isSensitiveField(event)) {
      return denied('MASKED_FILL_UNREPLAYABLE', event.seq);
    }
  }
  return null;
}

function checkReplayableFields(events) {
  for (const event of events) {
    // 空串是合法回放目标值（fill('') 即清空）；缺键与非 string 仍是值不可用。
    if (event.action === 'fill' && typeof event.value !== 'string') {
      return denied('FILL_VALUE_UNAVAILABLE', event.seq);
    }
  }
  for (const event of events) {
    // 坐标只是录制证据，永远不能补足缺席 selector。
    if (SELECTOR_ACTIONS.has(event.action)
      && (typeof event.selector !== 'string' || !event.selector)) {
      return denied('SELECTOR_UNAVAILABLE', event.seq);
    }
  }
  return null;
}

export function admitRawReplayCapture(options = {}) {
  let caseId;
  let captureBytes;
  try {
    if (!options || typeof options !== 'object') {
      return denied('RAW_CAPTURE_INPUT_INVALID');
    }
    ({ caseId, captureBytes } = options);
  } catch {
    return denied('RAW_CAPTURE_INPUT_INVALID');
  }
  if (typeof caseId !== 'string' || !caseId) {
    return denied('RAW_CAPTURE_INPUT_INVALID');
  }
  const bytes = copyBytes(captureBytes);
  if (!bytes || bytes.length === 0) return denied('RAW_CAPTURE_INPUT_INVALID');

  const captureSha256 = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  const capture = readDocument(bytes);
  if (!capture) return denied('RAW_CAPTURE_INVALID');
  if (capture.caseId !== caseId) return denied('CAPTURE_CASE_MISMATCH');
  if (capture.events.length === 0) return denied('CAPTURE_EVENTS_EMPTY');

  const seqDenial = checkSeq(capture.events);
  if (seqDenial) return seqDenial;
  const pathDenial = checkPaths(capture);
  if (pathDenial) return pathDenial;
  const sensitiveDenial = checkSensitiveEvidence(capture.events);
  if (sensitiveDenial) return sensitiveDenial;
  const fieldDenial = checkReplayableFields(capture.events);
  if (fieldDenial) return fieldDenial;
  const topology = normalizeTopologySequence({
    events: capture.events,
    format: 'capture',
  });
  if (!topology.ok) return denied(topology.reason);

  const captureAuthority = frozen(Object.create(null));
  CAPTURE_AUTHORITY_STATE.set(captureAuthority, frozen({
    bytes,
    capture,
    captureSha256,
    caseId,
  }));
  return frozen({
    ok: true,
    captureAuthority,
    captureSha256,
    eventCount: capture.events.length,
  });
}

// 多读只读 capability：每次返回相互独立的 bytes 与深拷贝 capture 文档；
// clone、spread、序列化或手造对象一律拒（WeakMap 不认）。
export function inspectAdmittedRawReplayCapture(options = {}) {
  let captureAuthority;
  try {
    if (!options || typeof options !== 'object') {
      return denied('RAW_CAPTURE_AUTHORITY_INVALID');
    }
    ({ captureAuthority } = options);
  } catch {
    return denied('RAW_CAPTURE_AUTHORITY_INVALID');
  }
  const record = captureAuthority && typeof captureAuthority === 'object'
    ? CAPTURE_AUTHORITY_STATE.get(captureAuthority)
    : null;
  if (!record) return denied('RAW_CAPTURE_AUTHORITY_INVALID');
  return frozen({
    ok: true,
    captureBytes: Buffer.from(record.bytes),
    capture: structuredClone(record.capture),
    captureSha256: record.captureSha256,
  });
}
