// 身份观察旁车纯函数内核。
// 只产未签/不可回放候选与 intake 联合复核证据；不读 DOM、不点击、不进 replay/verdict。
import { createHash } from 'node:crypto';
import { credentialGate } from './cred-gate.mjs';
import { reviewCapture } from './record-intake.mjs';

const HASH_RE = /^sha256:[a-f0-9]{64}$/;
const CASE_ID_RE = /^[A-Za-z0-9_-]+$/;
const KIND_RE = /^[a-z][a-z0-9.-]{0,63}$/;
const OBSERVATION_FILE = 'identity-observations.json';

const TOP_KEYS = new Set(['schemaVersion', 'artifactKind', 'caseId', 'source', 'observations']);
const SOURCE_KEYS = new Set(['kind', 'signed', 'replayReady', 'distillRequired']);
const OBSERVATION_KEYS = new Set(['kind', 'name', 'code', 'platformId', 'scopeFingerprint', 'parent', 'evidenceKind', 'eventSeq']);
const CAPTURE_V2_KEYS = new Set(['schemaVersion', 'artifactKind', 'caseId', 'createdAt', 'startPath', 'source', 'events', 'identityObservations']);
const REF_KEYS = new Set(['fileName', 'sha256', 'count']);
const PATH_FACT_KEYS = new Set(['regularFile', 'symbolicLink', 'parentSymbolicLink', 'identityBefore', 'identityAfter']);
const EXPECTED_BINDING_KEYS = new Set(['captureSha256', 'observationSha256', 'bundleSha256', 'identityStatus', 'observationCount', 'replayReady']);

const EVIDENCE_KINDS = new Set([
  'same-record-dual-anchor-readback',
  'detail-dual-anchor-readback',
  'platform-response-readback',
]);

const SENSITIVE_CONTENT_RE = /(?:[a-z][a-z0-9+.-]*:\/\/|%3a%2f%2f|(?:^|\s)\/\/[^\s/]|authorization|bearer\s|set-cookie|cookie|token|password|passwd|passcode|secret|credential|api[-_ ]?key|raw\s*body|request\s*body|response\s*body|request\s*header|response\s*header|密码|口令|密钥|验证码|请求头|响应头|原始请求|原始响应)/i;

function fail(code) {
  throw new TypeError(code);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function requireClosedObject(value, allowedKeys, code = 'UNKNOWN_FIELD') {
  if (!isPlainObject(value)) fail(code);
  for (const key of Object.keys(value)) if (!allowedKeys.has(key)) fail(code);
}

function safeCaseId(value) {
  if (typeof value !== 'string' || !CASE_ID_RE.test(value)) fail('CASEID_INVALID');
  return value;
}

function safeRequiredString(value, code = 'FIELD_INVALID') {
  if (typeof value !== 'string' || !value || value !== value.trim() || /[\u0000-\u001f\u007f]/.test(value)) fail(code);
  if (value.length > 512 || SENSITIVE_CONTENT_RE.test(value) || !credentialGate({ value }).ok) fail('SENSITIVE_CONTENT');
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

function stableBundleHash({ caseId, captureSha256, observationSha256 }) {
  return sha256Raw(JSON.stringify({ caseId, captureSha256, observationSha256 }));
}

function normalizeObservation(input) {
  requireClosedObject(input, OBSERVATION_KEYS);
  const kind = safeRequiredString(input.kind);
  if (!KIND_RE.test(kind)) fail('KIND_INVALID');
  const evidenceKind = safeRequiredString(input.evidenceKind);
  if (!EVIDENCE_KINDS.has(evidenceKind)) fail('EVIDENCE_KIND_INVALID');
  if (!Number.isSafeInteger(input.eventSeq) || input.eventSeq < 1) fail('EVENT_SEQ_INVALID');
  return Object.freeze({
    kind,
    name: safeRequiredString(input.name),
    code: safeOptionalString(input.code),
    platformId: safeOptionalString(input.platformId),
    scopeFingerprint: safeHash(input.scopeFingerprint, 'SCOPE_FINGERPRINT_INVALID'),
    parent: input.parent == null ? null : safeHash(input.parent, 'PARENT_INVALID'),
    evidenceKind,
    eventSeq: input.eventSeq,
  });
}

function validateSidecarDocument(doc, { caseId } = {}) {
  requireClosedObject(doc, TOP_KEYS);
  if (doc.schemaVersion !== 1 || doc.artifactKind !== 'teach-in-identity-observations') fail('ARTIFACT_INVALID');
  const actualCaseId = safeCaseId(doc.caseId);
  if (caseId !== undefined && actualCaseId !== safeCaseId(caseId)) fail('CASEID_MISMATCH');
  requireClosedObject(doc.source, SOURCE_KEYS);
  if (doc.source.kind !== 'manual-identity-observation'
    || doc.source.signed !== false
    || doc.source.replayReady !== false
    || doc.source.distillRequired !== true) fail('UNSAFE_SOURCE_STATE');
  if (!Array.isArray(doc.observations)) fail('OBSERVATIONS_INVALID');
  const observations = doc.observations.map(normalizeObservation);
  return Object.freeze({
    schemaVersion: 1,
    artifactKind: 'teach-in-identity-observations',
    caseId: actualCaseId,
    source: Object.freeze({ kind: 'manual-identity-observation', signed: false, replayReady: false, distillRequired: true }),
    observations: Object.freeze(observations),
  });
}

// JSON.parse 会静默覆盖重复键；联合复核先用极小 tokenizer 拒绝，再 parse。
function hasDuplicateJsonKeys(text) {
  const s = String(text);
  const stack = [];
  let expectKey = false;
  let i = 0;
  while (i < s.length) {
    const char = s[i];
    if (char === '"') {
      let j = i + 1;
      let value = '';
      while (j < s.length) {
        const current = s[j];
        if (current === '\\') {
          const escaped = s[j + 1];
          if (escaped === 'u') {
            const hex = s.slice(j + 2, j + 6);
            if (!/^[0-9a-f]{4}$/i.test(hex)) return true;
            value += String.fromCharCode(Number.parseInt(hex, 16));
            j += 6;
          } else {
            value += ({ n: '\n', t: '\t', r: '\r', b: '\b', f: '\f' })[escaped] ?? escaped;
            j += 2;
          }
        } else if (current === '"') {
          j += 1;
          break;
        } else {
          value += current;
          j += 1;
        }
      }
      const currentScope = stack[stack.length - 1];
      if (currentScope instanceof Set && expectKey) {
        if (currentScope.has(value)) return true;
        currentScope.add(value);
      }
      expectKey = false;
      i = j;
      continue;
    }
    if (char === '{') { stack.push(new Set()); expectKey = true; }
    else if (char === '[') { stack.push(null); expectKey = false; }
    else if (char === '}' || char === ']') { stack.pop(); expectKey = false; }
    else if (char === ',') { expectKey = stack[stack.length - 1] instanceof Set; }
    else if (char === ':') { expectKey = false; }
    i += 1;
  }
  return false;
}

function parseJsonObject(raw, duplicateCode) {
  if (typeof raw !== 'string' || !raw) fail('RAW_INVALID');
  if (hasDuplicateJsonKeys(raw)) fail(duplicateCode);
  let parsed;
  try { parsed = JSON.parse(raw); } catch { fail('PARSE_ERROR'); }
  if (!isPlainObject(parsed)) fail('ARTIFACT_INVALID');
  return parsed;
}

function validatePathEntry(value) {
  requireClosedObject(value, PATH_FACT_KEYS, 'PATH_FACTS_INVALID');
  if (value.symbolicLink === true || value.parentSymbolicLink === true) return 'SYMLINK';
  if (value.symbolicLink !== false || value.parentSymbolicLink !== false) return 'PATH_FACTS_INVALID';
  if (value.regularFile !== true) return 'NOT_REGULAR_FILE';
  if (typeof value.identityBefore !== 'string' || !value.identityBefore
    || typeof value.identityAfter !== 'string' || !value.identityAfter) return 'PATH_FACTS_INVALID';
  if (value.identityBefore !== value.identityAfter) return 'READ_IDENTITY_CHANGED';
  return null;
}

function reviewPathFacts(pathFacts) {
  if (!isPlainObject(pathFacts) || Object.keys(pathFacts).sort().join(',') !== 'capture,observations') return 'PATH_FACTS_INVALID';
  return validatePathEntry(pathFacts.capture) || validatePathEntry(pathFacts.observations);
}

function reject(reason) {
  return Object.freeze({ ok: false, identityStatus: 'unverified', replayReady: false, reason });
}

function validateCaptureV2(doc, caseId) {
  requireClosedObject(doc, CAPTURE_V2_KEYS);
  if (doc.schemaVersion !== 2 || doc.artifactKind !== 'teach-in-capture') fail('CAPTURE_INVALID');
  if (doc.caseId !== caseId) fail('CASEID_MISMATCH');
  requireClosedObject(doc.identityObservations, REF_KEYS);
  const ref = doc.identityObservations;
  if (ref.fileName !== OBSERVATION_FILE) fail('OBSERVATION_FILE_INVALID');
  safeHash(ref.sha256, 'OBSERVATION_HASH_INVALID');
  if (!Number.isSafeInteger(ref.count) || ref.count < 0) fail('OBSERVATION_COUNT_INVALID');

  const base = { ...doc, schemaVersion: 1 };
  delete base.identityObservations;
  const captureReview = reviewCapture(base, { caseId });
  if (!captureReview.ok) fail(`CAPTURE_${captureReview.reason}`);
  return ref;
}

function validateExpectedBinding(value) {
  if (value == null) return null;
  requireClosedObject(value, EXPECTED_BINDING_KEYS, 'EXPECTED_BINDING_INVALID');
  safeHash(value.captureSha256, 'EXPECTED_BINDING_INVALID');
  safeHash(value.observationSha256, 'EXPECTED_BINDING_INVALID');
  safeHash(value.bundleSha256, 'EXPECTED_BINDING_INVALID');
  if (!['pending', 'observed'].includes(value.identityStatus)
    || !Number.isSafeInteger(value.observationCount) || value.observationCount < 0
    || value.replayReady !== false) fail('EXPECTED_BINDING_INVALID');
  return value;
}

export function buildIdentityObservationSidecar({ caseId, observations } = {}) {
  const doc = {
    schemaVersion: 1,
    artifactKind: 'teach-in-identity-observations',
    caseId: safeCaseId(caseId),
    source: { kind: 'manual-identity-observation', signed: false, replayReady: false, distillRequired: true },
    observations: Array.isArray(observations) ? observations : fail('OBSERVATIONS_INVALID'),
  };
  return validateSidecarDocument(doc, { caseId });
}

export function serializeIdentityObservationSidecar(sidecar) {
  const verified = validateSidecarDocument(sidecar, { caseId: sidecar?.caseId });
  return `${JSON.stringify(verified, null, 2)}\n`;
}

export function bindCaptureIdentityObservations({ capture, observationRaw } = {}) {
  if (!isPlainObject(capture) || Object.hasOwn(capture, 'identityObservations')) fail('CAPTURE_ALREADY_BOUND');
  const sidecar = validateSidecarDocument(parseJsonObject(observationRaw, 'DUPLICATE_KEY'), { caseId: capture.caseId });
  const captureReview = reviewCapture(capture, { caseId: capture.caseId });
  if (!captureReview.ok) fail(`CAPTURE_${captureReview.reason}`);
  return Object.freeze({
    ...capture,
    schemaVersion: 2,
    identityObservations: Object.freeze({
      fileName: OBSERVATION_FILE,
      sha256: sha256Raw(observationRaw),
      count: sidecar.observations.length,
    }),
  });
}

export function reviewIdentityObservationBundle({
  caseId,
  captureRaw,
  observationRaw,
  pathFacts,
  expectedBinding = null,
} = {}) {
  const pathReason = reviewPathFacts(pathFacts);
  if (pathReason) return reject(pathReason);
  let expected;
  let capture;
  let sidecar;
  let ref;
  try {
    const expectedCaseId = safeCaseId(caseId);
    expected = validateExpectedBinding(expectedBinding);
    capture = parseJsonObject(captureRaw, 'DUPLICATE_KEY');
    sidecar = validateSidecarDocument(parseJsonObject(observationRaw, 'DUPLICATE_KEY'), { caseId: expectedCaseId });
    ref = validateCaptureV2(capture, expectedCaseId);
  } catch (error) {
    return reject(String(error?.message || 'UNVERIFIED_BUNDLE'));
  }

  const observationSha256 = sha256Raw(observationRaw);
  if (ref.sha256 !== observationSha256 || ref.count !== sidecar.observations.length) return reject('OBSERVATION_SWAPPED');
  const captureSha256 = sha256Raw(captureRaw);
  const bundleSha256 = stableBundleHash({ caseId, captureSha256, observationSha256 });
  if (expected) {
    if (captureSha256 !== expected.captureSha256) return reject('CAPTURE_SWAPPED');
    if (observationSha256 !== expected.observationSha256) return reject('OBSERVATION_SWAPPED');
    if (bundleSha256 !== expected.bundleSha256) return reject('BUNDLE_SWAPPED');
  }

  const identityStatus = sidecar.observations.some((entry) => entry.code === null) ? 'pending' : 'observed';
  return Object.freeze({
    ok: true,
    reason: null,
    identityStatus,
    replayReady: false,
    observationCount: sidecar.observations.length,
    captureSha256,
    observationSha256,
    bundleSha256,
  });
}

export function identityBundleLedgerFields(review) {
  if (!isPlainObject(review) || review.ok !== true || review.replayReady !== false
    || !['pending', 'observed'].includes(review.identityStatus)
    || !Number.isSafeInteger(review.observationCount) || review.observationCount < 0
    || !HASH_RE.test(review.captureSha256 || '')
    || !HASH_RE.test(review.observationSha256 || '')
    || !HASH_RE.test(review.bundleSha256 || '')) fail('UNVERIFIED_BUNDLE');
  return Object.freeze({
    captureSha256: review.captureSha256,
    observationSha256: review.observationSha256,
    bundleSha256: review.bundleSha256,
    identityStatus: review.identityStatus,
    observationCount: review.observationCount,
    replayReady: false,
  });
}
