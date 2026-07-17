// 身份观察旁车纯函数内核。
// 只产未签/不可回放候选与 intake 联合复核证据；不读 DOM、不点击、不进 replay/verdict。
import { createHash } from 'node:crypto';
import { isProxy } from 'node:util/types';
import { credentialGate } from './cred-gate.mjs';
import { reviewCapture } from './record-intake.mjs';
import {
  acceptedObservationAuthorityFacts,
  platformIdentityReadbackReceiptFacts,
} from './teachin-observation-authority-root.mjs';

const HASH_RE = /^sha256:[a-f0-9]{64}$/;
const CASE_ID_RE = /^[A-Za-z0-9_-]+$/;
const KIND_RE = /^[a-z][a-z0-9.-]{0,63}$/;
const OBSERVATION_FILE = 'identity-observations.json';

const TOP_KEYS = new Set(['schemaVersion', 'artifactKind', 'caseId', 'source', 'observations']);
const SOURCE_KEYS = new Set(['kind', 'signed', 'replayReady', 'distillRequired']);
const OBSERVATION_KEYS = new Set([
  'kind', 'name', 'code', 'platformId', 'scopeFingerprint', 'parent', 'evidenceKind', 'eventSeq', 'evidenceSha256',
]);
const CAPTURE_V2_KEYS = new Set(['schemaVersion', 'artifactKind', 'caseId', 'createdAt', 'startPath', 'source', 'events', 'identityObservations']);
const REF_KEYS = new Set(['fileName', 'sha256', 'count']);
const PATH_FACT_KEYS = new Set(['regularFile', 'symbolicLink', 'parentSymbolicLink', 'identityBefore', 'identityAfter']);
const EXPECTED_BINDING_KEYS = new Set(['captureSha256', 'observationSha256', 'bundleSha256', 'identityStatus', 'observationCount', 'replayReady']);
const TRUSTED_BINDING_KEYS = new Set([
  'schemaVersion', 'artifactKind', 'source', 'intakeStatus', 'caseId', 'captureFile', 'observationFile',
  'captureSha256', 'observationSha256', 'bundleSha256', 'observationCount',
]);
const STRUCTURAL_REVIEW_KEYS = new Set([
  'ok', 'reason', 'trusted', 'identityStatus', 'replayReady', 'observationCount',
  'captureSha256', 'observationSha256', 'bundleSha256',
]);

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

function fail(code) {
  throw new TypeError(code);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

// 公开 API 入口只允许纯自有数据：通过 descriptor 取值一次，绝不执行 getter。
// Proxy 若在反射 trap 中抛错，统一收口为 UNSAFE_DATA_SHAPE，不传播其 message。
function snapshotPlainOwnData(value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('UNSAFE_DATA_SHAPE');
    return value;
  }
  if ((typeof value === 'object' || typeof value === 'function') && isProxy(value)) fail('UNSAFE_DATA_SHAPE');
  if (typeof value !== 'object') fail('UNSAFE_DATA_SHAPE');
  if (seen.has(value)) fail('UNSAFE_DATA_SHAPE');
  seen.add(value);
  try {
    const proto = Object.getPrototypeOf(value);
    const keys = Reflect.ownKeys(value);
    if (Array.isArray(value)) {
      if (proto !== Array.prototype) fail('UNSAFE_DATA_SHAPE');
      const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
      if (!lengthDescriptor || !Object.hasOwn(lengthDescriptor, 'value') || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) {
        fail('UNSAFE_DATA_SHAPE');
      }
      const length = lengthDescriptor.value;
      const allowed = new Set(['length', ...Array.from({ length }, (_unused, index) => String(index))]);
      if (keys.some((key) => typeof key !== 'string' || !allowed.has(key)) || keys.length !== length + 1) fail('UNSAFE_DATA_SHAPE');
      const out = [];
      for (let index = 0; index < length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true) fail('UNSAFE_DATA_SHAPE');
        out.push(snapshotPlainOwnData(descriptor.value, seen));
      }
      return out;
    }
    if (proto !== Object.prototype && proto !== null) fail('UNSAFE_DATA_SHAPE');
    const out = {};
    for (const key of keys) {
      if (typeof key !== 'string') fail('UNSAFE_DATA_SHAPE');
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true) fail('UNSAFE_DATA_SHAPE');
      out[key] = snapshotPlainOwnData(descriptor.value, seen);
    }
    return out;
  } catch (error) {
    if (error instanceof TypeError && error.message === 'UNSAFE_DATA_SHAPE') throw error;
    fail('UNSAFE_DATA_SHAPE');
  } finally {
    seen.delete(value);
  }
}

function snapshotOptions(value, allowedKeys) {
  const snapshot = snapshotPlainOwnData(value == null ? {} : value);
  requireClosedObject(snapshot, allowedKeys, 'UNKNOWN_FIELD');
  return snapshot;
}

// accepted intake authority 是模块私有 WeakMap 铸造的对象身份，不能被普通快照复制。这里仍按
// plain-own-data 纪律读取 options，但对唯一 opaqueKey 只保留 descriptor.value 的对象身份；在任何
// 反射前先拒 Proxy，随后交 acceptedIntakeAuthorityFacts 验品牌。
function snapshotOptionsWithOpaque(value, allowedKeys, opaqueKeys) {
  const input = value == null ? {} : value;
  if ((typeof input === 'object' || typeof input === 'function') && isProxy(input)) fail('UNSAFE_DATA_SHAPE');
  if (!isPlainObject(input)) fail('UNSAFE_DATA_SHAPE');
  let keys;
  try { keys = Reflect.ownKeys(input); } catch { fail('UNSAFE_DATA_SHAPE'); }
  const out = {};
  for (const key of keys) {
    if (typeof key !== 'string' || !allowedKeys.has(key)) fail('UNKNOWN_FIELD');
    let descriptor;
    try { descriptor = Object.getOwnPropertyDescriptor(input, key); } catch { fail('UNSAFE_DATA_SHAPE'); }
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true) fail('UNSAFE_DATA_SHAPE');
    if (opaqueKeys.has(key)) {
      const handle = descriptor.value;
      if (handle !== null && (typeof handle === 'object' || typeof handle === 'function') && isProxy(handle)) fail('UNSAFE_DATA_SHAPE');
      out[key] = handle;
    } else {
      out[key] = snapshotPlainOwnData(descriptor.value);
    }
  }
  return out;
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
  if (typeof value !== 'string' || !value || value !== value.trim() || /[\u0000-\u001f\u007f-\u009f]/.test(value)) fail(code);
  const normalized = normUtf8PercentConverge(value);
  if (!normalized.converged) fail('SENSITIVE_CONTENT');
  if (value.length > 512
    || SENSITIVE_CONTENT_RE.test(value)
    || SENSITIVE_CONTENT_RE.test(normalized.s)
    || !credentialGate({ value }).ok
    || !credentialGate({ value: normalized.s }).ok) fail('SENSITIVE_CONTENT');
  return value;
}

const UTF8_FATAL_DECODER = new TextDecoder('utf-8', { fatal: true });
const HEX_PAIR_RE = /^[0-9a-f]{2}$/i;

// 每轮只解一层 %HH。连续 %HH 先收成 bytes，再用 fatal UTF-8 解码，避免旧 String.fromCharCode
// 把中文密码解成 mojibake 后漏过中文敏感词。自然语言裸百分号保留；形似编码却含非法 pair 的值拒绝。
function decodeUtf8PercentRound(value) {
  let out = '';
  let changed = false;
  for (let index = 0; index < value.length;) {
    if (value[index] !== '%') {
      out += value[index];
      index += 1;
      continue;
    }
    const pair = value.slice(index + 1, index + 3);
    if (!HEX_PAIR_RE.test(pair)) {
      if (/^[0-9a-z]{2}$/i.test(pair)) fail('ENCODING_INVALID');
      out += '%';
      index += 1;
      continue;
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
  for (let round = 0; round < 20; round++) {
    const decoded = decodeUtf8PercentRound(current);
    if (/[\u0000-\u001f\u007f-\u009f]/.test(decoded.value)) fail('SENSITIVE_CONTENT');
    if (!decoded.changed || decoded.value === current) return { s: decoded.value, converged: true };
    current = decoded.value;
  }
  return { s: current, converged: false };
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
  return Object.freeze({ ok: false, trusted: false, identityStatus: 'unverified', replayReady: false, reason });
}

function safeErrorCode(error, fallback = 'UNVERIFIED_BUNDLE') {
  const message = typeof error?.message === 'string' ? error.message : '';
  return /^[A-Z][A-Z0-9_]*$/.test(message) ? message : fallback;
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

function validateTrustedExpectedBinding(value, caseId) {
  requireClosedObject(value, TRUSTED_BINDING_KEYS, 'EXPECTED_BINDING_INVALID');
  if (value.schemaVersion !== 1
    || value.artifactKind !== 'accepted-identity-bundle-binding'
    || value.source !== 'accepted-intake-ledger'
    || value.intakeStatus !== 'accepted'
    || value.caseId !== caseId
    || value.captureFile !== 'teach-in-capture.json'
    || value.observationFile !== OBSERVATION_FILE) fail('EXPECTED_BINDING_INVALID');
  safeHash(value.captureSha256, 'EXPECTED_BINDING_INVALID');
  safeHash(value.observationSha256, 'EXPECTED_BINDING_INVALID');
  safeHash(value.bundleSha256, 'EXPECTED_BINDING_INVALID');
  if (!Number.isSafeInteger(value.observationCount) || value.observationCount < 0) fail('EXPECTED_BINDING_INVALID');
  return value;
}

function validateEventSeqReferences(capture, sidecar) {
  const eventsBySeq = new Map();
  for (const event of capture.events) {
    const seq = event?.seq;
    if (!Number.isSafeInteger(seq) || seq < 1 || eventsBySeq.has(seq)) return 'CAPTURE_EVENT_SEQ_INVALID';
    eventsBySeq.set(seq, event);
  }
  const usedEvidence = new Set();
  for (const observation of sidecar.observations) {
    const event = eventsBySeq.get(observation.eventSeq);
    if (!event) return 'EVENT_SEQ_MISMATCH';
    if (usedEvidence.has(observation.eventSeq)) return 'EVENT_SEQ_REUSED';
    usedEvidence.add(observation.eventSeq);
    if (!EVIDENCE_ACTIONS.get(observation.evidenceKind)?.has(event.action)) return 'EVIDENCE_ACTION_MISMATCH';
  }
  return null;
}

export function buildIdentityObservationSidecar(options = {}) {
  const { caseId, observations } = snapshotOptions(options, new Set(['caseId', 'observations']));
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
  const snapshot = snapshotPlainOwnData(sidecar);
  const verified = validateSidecarDocument(snapshot, { caseId: snapshot?.caseId });
  return `${JSON.stringify(verified, null, 2)}\n`;
}

export function bindCaptureIdentityObservations(options = {}) {
  const { capture, observationRaw } = snapshotOptions(options, new Set(['capture', 'observationRaw']));
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

export function reviewIdentityObservationBundle(options = {}) {
  let input;
  try {
    input = snapshotOptions(options, new Set(['caseId', 'captureRaw', 'observationRaw', 'pathFacts', 'expectedBinding']));
  } catch (error) {
    return reject(safeErrorCode(error));
  }
  const { caseId, captureRaw, observationRaw, pathFacts, expectedBinding = null } = input;
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
    return reject(safeErrorCode(error));
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

  const identityStatus = sidecar.observations.length === 0
    || sidecar.observations.some((entry) => entry.code === null)
    ? 'pending'
    : 'observed';
  return Object.freeze({
    ok: true,
    reason: null,
    trusted: false,
    identityStatus,
    replayReady: false,
    observationCount: sidecar.observations.length,
    captureSha256,
    observationSha256,
    bundleSha256,
  });
}

export function identityBundleLedgerFields(review) {
  const snapshot = snapshotPlainOwnData(review);
  requireClosedObject(snapshot, STRUCTURAL_REVIEW_KEYS, 'UNKNOWN_FIELD');
  if (snapshot.ok !== true || snapshot.replayReady !== false
    || !['pending', 'observed'].includes(snapshot.identityStatus)
    || !Number.isSafeInteger(snapshot.observationCount) || snapshot.observationCount < 0
    || !HASH_RE.test(snapshot.captureSha256 || '')
    || !HASH_RE.test(snapshot.observationSha256 || '')
    || !HASH_RE.test(snapshot.bundleSha256 || '')) fail('UNVERIFIED_BUNDLE');
  return Object.freeze({
    captureSha256: snapshot.captureSha256,
    observationSha256: snapshot.observationSha256,
    bundleSha256: snapshot.bundleSha256,
    identityStatus: snapshot.identityStatus,
    observationCount: snapshot.observationCount,
    replayReady: false,
  });
}

export function verifyTrustedIdentityObservationBundle(options = {}) {
  let input;
  try {
    input = snapshotOptions(options, new Set(['caseId', 'captureRaw', 'observationRaw', 'pathFacts', 'expectedBinding']));
  } catch (error) {
    return reject(safeErrorCode(error));
  }
  if (input.expectedBinding == null) return reject('EXPECTED_BINDING_REQUIRED');

  let expected;
  try {
    const caseId = safeCaseId(input.caseId);
    expected = validateTrustedExpectedBinding(input.expectedBinding, caseId);
  } catch (error) {
    return reject(safeErrorCode(error, 'EXPECTED_BINDING_INVALID'));
  }

  const structural = reviewIdentityObservationBundle({
    caseId: input.caseId,
    captureRaw: input.captureRaw,
    observationRaw: input.observationRaw,
    pathFacts: input.pathFacts,
  });
  if (!structural.ok) return structural;
  if (structural.captureSha256 !== expected.captureSha256) return reject('CAPTURE_SWAPPED');
  if (structural.observationSha256 !== expected.observationSha256) return reject('OBSERVATION_SWAPPED');
  if (structural.bundleSha256 !== expected.bundleSha256) return reject('BUNDLE_SWAPPED');
  if (structural.observationCount !== expected.observationCount) return reject('OBSERVATION_SWAPPED');

  let capture;
  let sidecar;
  try {
    capture = parseJsonObject(input.captureRaw, 'DUPLICATE_KEY');
    sidecar = validateSidecarDocument(parseJsonObject(input.observationRaw, 'DUPLICATE_KEY'), { caseId: input.caseId });
    validateCaptureV2(capture, input.caseId);
  } catch (error) {
    return reject(safeErrorCode(error));
  }
  const eventReason = validateEventSeqReferences(capture, sidecar);
  if (eventReason) return reject(eventReason);
  // superseded compatibility face：plain expectedBinding 只能证明字段相等，不能证明来自 accepted ledger。
  // 保留完整复核与换包类别码，但永不据此授予 trusted。
  return reject('EXPECTED_BINDING_NOT_AUTHORITY');
}

export function verifyAcceptedIdentityObservationBundle(options = {}) {
  let input;
  try {
    input = snapshotOptionsWithOpaque(
      options,
      new Set([
        'caseId', 'captureRaw', 'observationRaw', 'pathFacts', 'acceptedIntakeAuthority', 'platformReadbackReceipt',
      ]),
      new Set(['acceptedIntakeAuthority', 'platformReadbackReceipt']),
    );
  } catch (error) {
    return reject(safeErrorCode(error));
  }
  if (input.acceptedIntakeAuthority == null) return reject('ACCEPTED_INTAKE_AUTHORITY_REQUIRED');
  if (input.platformReadbackReceipt == null) return reject('READBACK_RECEIPT_REQUIRED');

  const accepted = acceptedObservationAuthorityFacts(input.acceptedIntakeAuthority);
  if (!accepted.ok) return reject(accepted.reason || 'ACCEPTED_INTAKE_AUTHORITY_INVALID');
  const readback = platformIdentityReadbackReceiptFacts(input.platformReadbackReceipt);
  if (!readback.ok) return reject(readback.reason || 'READBACK_RECEIPT_INVALID');
  const authority = accepted.facts;
  const receipt = readback.facts;
  const structural = reviewIdentityObservationBundle({
    caseId: input.caseId,
    captureRaw: input.captureRaw,
    observationRaw: input.observationRaw,
    pathFacts: input.pathFacts,
  });
  if (!structural.ok) return structural;
  if (authority.caseId !== input.caseId) return reject('AUTHORITY_CASEID_MISMATCH');
  if (authority.captureSha256 !== structural.captureSha256) return reject('CAPTURE_SWAPPED');
  if (authority.sidecarSha256 !== structural.observationSha256) return reject('OBSERVATION_SWAPPED');
  if (authority.observationCount !== structural.observationCount) return reject('OBSERVATION_SWAPPED');
  if (authority.observationSchemaVersion !== 1) return reject('OBSERVATION_SCHEMA_MISMATCH');

  let capture;
  let sidecar;
  try {
    capture = parseJsonObject(input.captureRaw, 'DUPLICATE_KEY');
    sidecar = validateSidecarDocument(parseJsonObject(input.observationRaw, 'DUPLICATE_KEY'), { caseId: input.caseId });
    validateCaptureV2(capture, input.caseId);
  } catch (error) {
    return reject(safeErrorCode(error));
  }
  const eventReason = validateEventSeqReferences(capture, sidecar);
  if (eventReason) return reject(eventReason);
  if (sidecar.observations.length !== 1) return reject('READBACK_RECEIPT_COVERAGE_MISMATCH');
  const observation = sidecar.observations[0];
  if (!observation.evidenceSha256) return reject('READBACK_EVIDENCE_REQUIRED');
  const exact = {
    caseId: input.caseId,
    eventSeq: observation.eventSeq,
    kind: observation.kind,
    name: observation.name,
    code: observation.code,
    platformId: observation.platformId,
    scopeFingerprint: observation.scopeFingerprint,
    evidenceSha256: observation.evidenceSha256,
  };
  for (const [key, value] of Object.entries(exact)) {
    if (receipt[key] !== value) return reject(`READBACK_${key.replace(/[A-Z]/g, (m) => `_${m}`).toUpperCase()}_MISMATCH`);
  }
  return Object.freeze({
    ...structural,
    trusted: true,
    // 本轮只冻结 canonical receipt I/O；真实 platform driver provenance 仍须额外 authority 门。
    trustProvenance: receipt.provenance || 'canonical-receipt-io-only',
  });
}
