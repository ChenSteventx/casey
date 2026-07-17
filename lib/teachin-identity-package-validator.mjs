// Identity observation package 的单一闭合数据合同。
// 纯函数、零 I/O：canonical authority root 与 identity consumer 必须共同调用本模块，避免 accepted-but-unconsumable。
import { createHash } from 'node:crypto';
import { credentialGate } from './cred-gate.mjs';
import { hasDuplicateKeys, normConverge, reviewCapture } from './record-intake.mjs';
import { snapshotPlainOwnData } from './safe-own-data.mjs';

const HASH_RE = /^sha256:[a-f0-9]{64}$/;
const CASE_ID_RE = /^[A-Za-z0-9_-]+$/;
const KIND_RE = /^[a-z][a-z0-9.-]{0,63}$/;
const OBSERVATION_FILE = 'identity-observations.json';
const TOP_KEYS = new Set(['schemaVersion', 'artifactKind', 'caseId', 'source', 'observations']);
const SOURCE_KEYS = new Set(['kind', 'signed', 'replayReady', 'distillRequired']);
const OBSERVATION_KEYS = new Set([
  'kind', 'name', 'code', 'platformId', 'scopeFingerprint', 'parent', 'evidenceKind', 'eventSeq', 'evidenceSha256',
]);
const CAPTURE_V2_KEYS = new Set([
  'schemaVersion', 'artifactKind', 'caseId', 'createdAt', 'startPath', 'source', 'events', 'identityObservations',
]);
const REF_KEYS = new Set(['fileName', 'sha256', 'count']);
const EVIDENCE_KINDS = new Set([
  'same-record-dual-anchor-readback',
  'detail-dual-anchor-readback',
  'platform-response-readback',
]);
const EVIDENCE_ACTIONS = new Map([
  ['same-record-dual-anchor-readback', new Set(['click', 'dblclick'])],
  ['detail-dual-anchor-readback', new Set(['click', 'dblclick'])],
  ['platform-response-readback', new Set(['click', 'dblclick', 'nav'])],
]);
const SENSITIVE_CONTENT_RE = /(?:[a-z][a-z0-9+.-]*:\/\/|%3a%2f%2f|(?:^|\s)\/\/[^\s/]|authorization|bearer\s|set-cookie|cookie|token|password|passwd|passcode|secret|credential|api[-_ ]?key|raw\s*body|request\s*body|response\s*body|request\s*header|response\s*header|密码|口令|密钥|验证码|请求头|响应头|原始请求|原始响应)/i;
const UTF8_FATAL_DECODER = new TextDecoder('utf-8', { fatal: true });
const HEX_PAIR_RE = /^[0-9a-f]{2}$/i;

function fail(code) { throw new TypeError(code); }
function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
function requireClosedObject(value, allowedKeys, code = 'UNKNOWN_FIELD') {
  if (!isPlainObject(value)) fail(code);
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== 'string' || !allowedKeys.has(key))) fail(code);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true) fail('UNSAFE_DATA_SHAPE');
  }
}
function safeCaseId(value) {
  if (typeof value !== 'string' || !CASE_ID_RE.test(value)) fail('CASEID_INVALID');
  return value;
}
function decodeUtf8PercentRound(value) {
  let out = '';
  let changed = false;
  for (let index = 0; index < value.length;) {
    if (value[index] !== '%') { out += value[index]; index += 1; continue; }
    const pair = value.slice(index + 1, index + 3);
    if (!HEX_PAIR_RE.test(pair)) {
      if (/^[0-9a-z]{2}$/i.test(pair)) fail('ENCODING_INVALID');
      out += '%'; index += 1; continue;
    }
    const bytes = [];
    while (value[index] === '%' && HEX_PAIR_RE.test(value.slice(index + 1, index + 3))) {
      bytes.push(Number.parseInt(value.slice(index + 1, index + 3), 16));
      index += 3;
    }
    try { out += UTF8_FATAL_DECODER.decode(Uint8Array.from(bytes)); }
    catch { fail('ENCODING_INVALID'); }
    changed = true;
  }
  return { value: out, changed };
}
function normUtf8PercentConverge(value) {
  let current = String(value);
  if (/[\u0000-\u001f\u007f-\u009f]/.test(current)) fail('SENSITIVE_CONTENT');
  for (let round = 0; round < 20; round += 1) {
    const decoded = decodeUtf8PercentRound(current);
    if (/[\u0000-\u001f\u007f-\u009f]/.test(decoded.value)) fail('SENSITIVE_CONTENT');
    if (!decoded.changed || decoded.value === current) return { s: decoded.value, converged: true };
    current = decoded.value;
  }
  return { s: current, converged: false };
}
function safeRequiredString(value, code = 'FIELD_INVALID') {
  if (typeof value !== 'string' || !value || value !== value.trim()) fail(code);
  const normalized = normUtf8PercentConverge(value);
  if (!normalized.converged || value.length > 512
    || SENSITIVE_CONTENT_RE.test(value) || SENSITIVE_CONTENT_RE.test(normalized.s)
    || !credentialGate({ value }).ok || !credentialGate({ value: normalized.s }).ok) fail('SENSITIVE_CONTENT');
  return value;
}
function safeOptionalString(value, code = 'FIELD_INVALID') {
  if (value == null || value === '') return null;
  return safeRequiredString(value, code);
}
function safeHash(value, code = 'HASH_INVALID') {
  if (typeof value !== 'string' || !HASH_RE.test(value)) fail(code);
  return value;
}
function sha256Raw(value) {
  return `sha256:${createHash('sha256').update(String(value), 'utf8').digest('hex')}`;
}
function freezePlainData(value) {
  if (!value || typeof value !== 'object') return value;
  for (const child of Array.isArray(value) ? value : Object.values(value)) freezePlainData(child);
  return Object.freeze(value);
}
function parseJsonObject(raw, code) {
  if (typeof raw !== 'string' || !raw || hasDuplicateKeys(raw)) fail(code);
  let parsed;
  try { parsed = JSON.parse(raw); } catch { fail(`${code}_PARSE_ERROR`); }
  if (!isPlainObject(parsed)) fail(`${code}_SHAPE_INVALID`);
  return parsed;
}
function normalizeObservation(input) {
  requireClosedObject(input, OBSERVATION_KEYS);
  const kind = safeRequiredString(input.kind);
  if (!KIND_RE.test(kind)) fail('KIND_INVALID');
  const evidenceKind = safeRequiredString(input.evidenceKind);
  if (!EVIDENCE_KINDS.has(evidenceKind)) fail('EVIDENCE_KIND_INVALID');
  if (!Number.isSafeInteger(input.eventSeq) || input.eventSeq < 1) fail('EVENT_SEQ_INVALID');
  const normalized = {
    kind,
    name: safeRequiredString(input.name),
    code: safeOptionalString(input.code),
    platformId: safeOptionalString(input.platformId),
    scopeFingerprint: safeHash(input.scopeFingerprint, 'SCOPE_FINGERPRINT_INVALID'),
    parent: input.parent == null ? null : safeHash(input.parent, 'PARENT_INVALID'),
    evidenceKind,
    eventSeq: input.eventSeq,
  };
  if (input.evidenceSha256 !== undefined && input.evidenceSha256 !== null) {
    normalized.evidenceSha256 = safeHash(input.evidenceSha256, 'EVIDENCE_SHA256_INVALID');
  }
  return Object.freeze(normalized);
}

export function validateClosedIdentityObservationSidecarDocument(value, { caseId } = {}) {
  const doc = snapshotPlainOwnData(value);
  requireClosedObject(doc, TOP_KEYS);
  if (doc.schemaVersion !== 1 || doc.artifactKind !== 'teach-in-identity-observations') fail('ARTIFACT_INVALID');
  const actualCaseId = safeCaseId(doc.caseId);
  if (caseId !== undefined && actualCaseId !== safeCaseId(caseId)) fail('CASEID_MISMATCH');
  requireClosedObject(doc.source, SOURCE_KEYS);
  if (doc.source.kind !== 'manual-identity-observation'
    || doc.source.signed !== false || doc.source.replayReady !== false || doc.source.distillRequired !== true) {
    fail('UNSAFE_SOURCE_STATE');
  }
  if (!Array.isArray(doc.observations)) fail('OBSERVATIONS_INVALID');
  const observations = doc.observations.map(normalizeObservation);
  const seen = new Set();
  for (const observation of observations) {
    const key = JSON.stringify(observation);
    if (seen.has(key)) fail('OBSERVATION_DUPLICATE');
    seen.add(key);
  }
  return Object.freeze({
    schemaVersion: 1,
    artifactKind: 'teach-in-identity-observations',
    caseId: actualCaseId,
    source: Object.freeze({ kind: 'manual-identity-observation', signed: false, replayReady: false, distillRequired: true }),
    observations: Object.freeze(observations),
  });
}

export function reviewClosedIdentityObservationPackage(options = {}) {
  try {
    const snapshot = snapshotPlainOwnData(options);
    requireClosedObject(snapshot, new Set(['caseId', 'captureRaw', 'observationRaw']));
    const caseId = safeCaseId(snapshot.caseId);
    const captureRaw = snapshot.captureRaw;
    const observationRaw = snapshot.observationRaw;
    if (typeof captureRaw !== 'string' || typeof observationRaw !== 'string') fail('RAW_INVALID');
    if (!credentialGate({ capture: captureRaw }).ok) fail('CRED_GATE_HIT');
    const capture = parseJsonObject(captureRaw, 'CAPTURE');
    // raw 门封明文；parse 后 canonical 门封 JSON \u 转义；normConverge 再封多层 %HH/反斜杠形态。
    const canonicalCapture = JSON.stringify(capture);
    const decoded = normConverge(canonicalCapture);
    if (!decoded.converged
      || !credentialGate({ capture: canonicalCapture }).ok
      || !credentialGate({ capture: decoded.s }).ok) fail('CRED_GATE_HIT');
    const sidecar = validateClosedIdentityObservationSidecarDocument(
      parseJsonObject(observationRaw, 'SIDECAR'),
      { caseId },
    );
    requireClosedObject(capture, CAPTURE_V2_KEYS);
    if (capture.schemaVersion !== 2 || capture.artifactKind !== 'teach-in-capture' || capture.caseId !== caseId) {
      fail('CAPTURE_INVALID');
    }
    requireClosedObject(capture.identityObservations, REF_KEYS);
    const ref = capture.identityObservations;
    if (ref.fileName !== OBSERVATION_FILE) fail('OBSERVATION_FILE_INVALID');
    safeHash(ref.sha256, 'OBSERVATION_HASH_INVALID');
    if (!Number.isSafeInteger(ref.count) || ref.count < 0) fail('OBSERVATION_COUNT_INVALID');
    const observationSha256 = sha256Raw(observationRaw);
    if (ref.sha256 !== observationSha256 || ref.count !== sidecar.observations.length) fail('OBSERVATION_SWAPPED');

    const base = { ...capture, schemaVersion: 1 };
    delete base.identityObservations;
    const captureReview = reviewCapture(base, { caseId });
    if (!captureReview.ok) fail(`CAPTURE_${captureReview.reason}`);
    const eventsBySeq = new Map();
    for (const event of capture.events) {
      const seq = event?.seq;
      if (!Number.isSafeInteger(seq) || seq < 1 || eventsBySeq.has(seq)) fail('CAPTURE_EVENT_SEQ_INVALID');
      eventsBySeq.set(seq, event);
    }
    const usedEvidence = new Set();
    for (const observation of sidecar.observations) {
      const event = eventsBySeq.get(observation.eventSeq);
      if (!event) fail('EVENT_SEQ_MISMATCH');
      if (usedEvidence.has(observation.eventSeq)) fail('EVENT_SEQ_REUSED');
      usedEvidence.add(observation.eventSeq);
      if (!EVIDENCE_ACTIONS.get(observation.evidenceKind)?.has(event.action)) fail('EVIDENCE_ACTION_MISMATCH');
    }
    const closedCapture = freezePlainData(capture);
    return Object.freeze({
      ok: true,
      reason: null,
      capture: closedCapture,
      sidecar,
      eventCount: captureReview.eventCount,
      captureSha256: sha256Raw(captureRaw),
      observationSha256,
      observationCount: sidecar.observations.length,
      observationSchemaVersion: sidecar.schemaVersion,
    });
  } catch (error) {
    const reason = typeof error?.message === 'string' && /^[A-Z][A-Z0-9_]*$/.test(error.message)
      ? error.message
      : 'CLOSED_IDENTITY_PACKAGE_INVALID';
    return Object.freeze({ ok: false, reason });
  }
}
