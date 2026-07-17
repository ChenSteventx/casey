// 身份观察 authority 的唯一 I/O 铸造根。
// accepted authority 只在固定三件套完成真实 append transaction 后铸造；plain ledger/bytes 不在此面。
// readback receipt 只在代码内固定 Ed25519 driver key 验签与 exact binding 后铸造；
// 私钥保护、真实 driver 唯一写者与 session nonce 持久防重放仍须 route:human。
import { createHash, createPublicKey, verify } from 'node:crypto';
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { isProxy } from 'node:util/types';
import { credentialGate } from './cred-gate.mjs';
import {
  deriveTeachInPackagePaths,
  verifyTeachInPackage,
} from './entity-semantic-lock-package.mjs';
import {
  appendIntakeLedger,
  buildIntakeRecord,
  hasDuplicateKeys,
  intakeLedgerPath,
  normConverge,
  reviewCapture,
} from './record-intake.mjs';
import { verifyIntakenPackage } from './record-distill.mjs';
import { snapshotClosedOptions } from './safe-own-data.mjs';
import { trustedDriverPublicKeyFor } from './teachin-observation-driver-registry.mjs';

const ACCEPTED_AUTHORITIES = new WeakMap();
const READBACK_RECEIPTS = new WeakMap();
const RECEIPT_NAME = 'identity-readback-receipt.json';
const HASH_RE = /^sha256:[a-f0-9]{64}$/;
const CASE_ID_RE = /^[A-Za-z0-9_-]+$/;
const CONTROL_RE = /[\u0000-\u001f\u007f-\u009f]/;
const SIGNED_PAYLOAD_KEYS = Object.freeze([
  'schemaVersion', 'artifactKind', 'source', 'keyId', 'algorithm', 'sessionNonce', 'caseId',
  'captureSha256', 'sidecarSha256', 'manifestSha256', 'eventSeq', 'kind', 'name', 'code',
  'platformId', 'scopeFingerprint', 'evidenceSha256',
]);
const SIGNED_ENVELOPE_KEYS = new Set([...SIGNED_PAYLOAD_KEYS, 'signature']);

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function deny(reason) {
  return Object.freeze({ ok: false, reason, trusted: false, replayReady: false });
}

function safeCode(error, fallback = 'AUTHORITY_ROOT_ERROR') {
  const message = typeof error?.message === 'string' ? error.message : '';
  return /^[A-Z][A-Z0-9_]*$/.test(message) ? message : fallback;
}

function requireCaseId(value) {
  if (typeof value !== 'string' || !CASE_ID_RE.test(value)) throw new TypeError('CASEID_INVALID');
  return value;
}

function requireSafeString(value, code) {
  if (typeof value !== 'string' || !value || value !== value.trim() || CONTROL_RE.test(value)) throw new TypeError(code);
  return value;
}

function requireHash(value, code) {
  if (typeof value !== 'string' || !HASH_RE.test(value)) throw new TypeError(code);
  return value;
}

function statIdentity(stat) {
  return `${stat.dev}:${stat.ino}`;
}

function sameOpenSnapshot(before, after) {
  return before.dev === after.dev
    && before.ino === after.ino
    && before.size === after.size
    && before.mtimeNs === after.mtimeNs
    && before.ctimeNs === after.ctimeNs;
}

function stableReadFile(pathname, label) {
  let pathStat;
  try { pathStat = lstatSync(pathname, { bigint: true }); }
  catch { throw new TypeError(`${label}_UNREADABLE`); }
  if (pathStat.isSymbolicLink()) throw new TypeError(`${label}_SYMLINK`);
  if (!pathStat.isFile()) throw new TypeError(`${label}_NOT_REGULAR_FILE`);
  let fd;
  try {
    fd = openSync(pathname, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    const before = fstatSync(fd, { bigint: true });
    if (!before.isFile() || statIdentity(before) !== statIdentity(pathStat)) throw new TypeError(`${label}_IDENTITY_CHANGED`);
    const bytes = readFileSync(fd);
    const after = fstatSync(fd, { bigint: true });
    if (!sameOpenSnapshot(before, after)) throw new TypeError(`${label}_IDENTITY_CHANGED`);
    return Object.freeze({ bytes, sha256: sha256(bytes), identity: statIdentity(after) });
  } catch (error) {
    if (error instanceof TypeError) throw error;
    throw new TypeError(`${label}_UNREADABLE`);
  } finally {
    if (fd !== undefined) {
      try { closeSync(fd); } catch { /* fixed category returned by caller */ }
    }
  }
}

function assertCanonicalContainers(capturePath, caseId) {
  const absolute = resolve(capturePath);
  const packageDir = dirname(absolute);
  const caseDir = dirname(packageDir);
  if (basename(absolute) !== 'teach-in-capture.json'
    || basename(packageDir) !== 'record-capture'
    || basename(caseDir) !== caseId) throw new TypeError('CAPTURE_PATH_NOT_CANONICAL');
  for (const [pathName, code] of [[packageDir, 'PACKAGE_DIR'], [caseDir, 'CASE_DIR']]) {
    let stat;
    try { stat = lstatSync(pathName); } catch { throw new TypeError(`${code}_UNREADABLE`); }
    if (stat.isSymbolicLink()) throw new TypeError(`${code}_SYMLINK`);
    if (!stat.isDirectory()) throw new TypeError(`${code}_NOT_DIRECTORY`);
  }
  return absolute;
}

function parseJsonObject(bytes, code) {
  const raw = bytes.toString('utf8');
  if (hasDuplicateKeys(raw)) throw new TypeError(`${code}_DUPLICATE_KEY`);
  let doc;
  try { doc = JSON.parse(raw); } catch { throw new TypeError(`${code}_PARSE_ERROR`); }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new TypeError(`${code}_SHAPE_INVALID`);
  return doc;
}

function parseLedger(bytes) {
  const entries = [];
  for (const line of bytes.toString('utf8').split('\n')) {
    if (!line.trim()) continue;
    if (hasDuplicateKeys(line)) throw new TypeError('LEDGER_DUPLICATE_KEY');
    let entry;
    try { entry = JSON.parse(line); } catch { throw new TypeError('LEDGER_PARSE_ERROR'); }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new TypeError('LEDGER_SHAPE_INVALID');
    entries.push(entry);
  }
  return entries;
}

function readPackage(capturePath, caseId) {
  const paths = deriveTeachInPackagePaths({ capturePath });
  const capture = stableReadFile(paths.capturePath, 'CAPTURE');
  const sidecar = stableReadFile(paths.sidecarPath, 'SIDECAR');
  const manifest = stableReadFile(paths.manifestPath, 'MANIFEST');
  const packageReview = verifyTeachInPackage({
    caseId,
    captureBytes: capture.bytes,
    sidecarBytes: sidecar.bytes,
    manifestBytes: manifest.bytes,
  });
  if (!packageReview.ok) throw new TypeError(packageReview.reason || 'PACKAGE_INVALID');
  return Object.freeze({ paths, capture, sidecar, manifest, packageReview });
}

function reviewCaptureV2(packageSnapshot, caseId) {
  const raw = packageSnapshot.capture.bytes.toString('utf8');
  if (!credentialGate({ capture: raw }).ok) throw new TypeError('CRED_GATE_HIT');
  const doc = parseJsonObject(packageSnapshot.capture.bytes, 'CAPTURE');
  const canonical = JSON.stringify(doc);
  const decoded = normConverge(canonical);
  if (!decoded.converged || !credentialGate({ capture: canonical }).ok || !credentialGate({ capture: decoded.s }).ok) {
    throw new TypeError('CRED_GATE_HIT');
  }
  if (doc.schemaVersion !== 2 || !doc.identityObservations) throw new TypeError('CAPTURE_V2_REQUIRED');
  const base = { ...doc, schemaVersion: 1 };
  delete base.identityObservations;
  const review = reviewCapture(base, { caseId });
  if (!review.ok) throw new TypeError(review.reason || 'CAPTURE_REVIEW_REJECTED');
  return Object.freeze({ doc, eventCount: review.eventCount });
}

function samePackageFacts(first, second) {
  return first.capture.identity === second.capture.identity
    && first.sidecar.identity === second.sidecar.identity
    && first.manifest.identity === second.manifest.identity
    && first.packageReview.captureSha256 === second.packageReview.captureSha256
    && first.packageReview.sidecarSha256 === second.packageReview.sidecarSha256
    && first.packageReview.manifestSha256 === second.packageReview.manifestSha256
    && first.packageReview.observationCount === second.packageReview.observationCount
    && first.packageReview.observationSchemaVersion === second.packageReview.observationSchemaVersion;
}

function recordMatches(record, expected) {
  const keys = [
    'schemaVersion', 'event', 'intakeStatus', 'caseId', 'intakedAt', 'eventCount', 'reason', 'captureName',
    'captureSha256', 'sidecarSha256', 'manifestSha256', 'observationCount', 'observationSchemaVersion',
  ];
  return keys.every((key) => record?.[key] === expected?.[key]);
}

function mintAcceptedAuthority(facts) {
  const handle = Object.freeze(Object.create(null));
  ACCEPTED_AUTHORITIES.set(handle, Object.freeze({ ...facts }));
  return handle;
}

function mintReadbackReceipt(facts) {
  const handle = Object.freeze(Object.create(null));
  READBACK_RECEIPTS.set(handle, Object.freeze({ ...facts }));
  return handle;
}

export function acceptedObservationAuthorityFacts(handle) {
  if ((typeof handle === 'object' || typeof handle === 'function') && handle !== null && isProxy(handle)) {
    return Object.freeze({ ok: false, reason: 'ACCEPTED_INTAKE_AUTHORITY_INVALID' });
  }
  const internal = handle && typeof handle === 'object' ? ACCEPTED_AUTHORITIES.get(handle) : null;
  if (!internal) return Object.freeze({ ok: false, reason: 'ACCEPTED_INTAKE_AUTHORITY_INVALID' });
  const { caseId, captureSha256, sidecarSha256, manifestSha256, observationCount, observationSchemaVersion } = internal;
  return Object.freeze({
    ok: true,
    facts: Object.freeze({ caseId, captureSha256, sidecarSha256, manifestSha256, observationCount, observationSchemaVersion }),
  });
}

export function platformIdentityReadbackReceiptFacts(handle) {
  if ((typeof handle === 'object' || typeof handle === 'function') && handle !== null && isProxy(handle)) {
    return Object.freeze({ ok: false, reason: 'READBACK_RECEIPT_INVALID' });
  }
  const facts = handle && typeof handle === 'object' ? READBACK_RECEIPTS.get(handle) : null;
  return facts
    ? Object.freeze({ ok: true, facts })
    : Object.freeze({ ok: false, reason: 'READBACK_RECEIPT_INVALID' });
}

export function appendAcceptedObservationPackage(options = {}) {
  try {
    const { caseId, capturePath } = snapshotClosedOptions(options, new Set(['caseId', 'capturePath']));
    const safeCaseId = requireCaseId(caseId);
    const canonicalCapturePath = assertCanonicalContainers(requireSafeString(capturePath, 'CAPTURE_PATH_INVALID'), safeCaseId);
    const initial = readPackage(canonicalCapturePath, safeCaseId);
    const captureReview = reviewCaptureV2(initial, safeCaseId);
    const ledgerPath = intakeLedgerPath({ capturePath: canonicalCapturePath });
    if (existsSync(ledgerPath)) {
      const ledgerStat = lstatSync(ledgerPath);
      if (ledgerStat.isSymbolicLink()) throw new TypeError('LEDGER_SYMLINK');
      if (!ledgerStat.isFile()) throw new TypeError('LEDGER_NOT_REGULAR_FILE');
    }
    const record = buildIntakeRecord({
      caseId: safeCaseId,
      status: 'accepted',
      eventCount: captureReview.eventCount,
      captureName: 'teach-in-capture.json',
      captureSha256: initial.packageReview.captureSha256,
      sidecarSha256: initial.packageReview.sidecarSha256,
      manifestSha256: initial.packageReview.manifestSha256,
      observationCount: initial.packageReview.observationCount,
      observationSchemaVersion: initial.packageReview.observationSchemaVersion,
    });
    appendIntakeLedger({ ledgerPath, record });

    const current = readPackage(canonicalCapturePath, safeCaseId);
    if (!samePackageFacts(initial, current)) throw new TypeError('PACKAGE_IDENTITY_CHANGED');
    const ledger = stableReadFile(ledgerPath, 'LEDGER');
    const ledgerEntries = parseLedger(ledger.bytes);
    const accepts = ledgerEntries.filter((entry) => entry.intakeStatus === 'accepted' && entry.caseId === safeCaseId);
    if (!recordMatches(accepts.at(-1), record)) throw new TypeError('LATEST_ACCEPTED_MISMATCH');
    const verified = verifyIntakenPackage({
      caseId: safeCaseId,
      ledgerEntries,
      packageAuthority: current.packageReview.authority,
      currentCaptureSha256: current.packageReview.captureSha256,
      currentSidecarSha256: current.packageReview.sidecarSha256,
      currentManifestSha256: current.packageReview.manifestSha256,
      observationCount: current.packageReview.observationCount,
      observationSchemaVersion: current.packageReview.observationSchemaVersion,
    });
    if (!verified.ok) throw new TypeError(verified.reason || 'LATEST_ACCEPTED_MISMATCH');
    const authority = mintAcceptedAuthority({
      source: 'canonical-append-transaction',
      caseId: safeCaseId,
      capturePath: canonicalCapturePath,
      captureIdentity: current.capture.identity,
      sidecarIdentity: current.sidecar.identity,
      manifestIdentity: current.manifest.identity,
      ledgerIdentity: ledger.identity,
      ledgerSha256: ledger.sha256,
      captureSha256: current.packageReview.captureSha256,
      sidecarSha256: current.packageReview.sidecarSha256,
      manifestSha256: current.packageReview.manifestSha256,
      observationCount: current.packageReview.observationCount,
      observationSchemaVersion: current.packageReview.observationSchemaVersion,
    });
    return Object.freeze({ ok: true, reason: null, authority, provenance: 'canonical-append-transaction' });
  } catch (error) {
    return deny(safeCode(error));
  }
}

function verifyAuthorityStillCurrent(authority) {
  const current = readPackage(authority.capturePath, authority.caseId);
  if (current.capture.identity !== authority.captureIdentity
    || current.sidecar.identity !== authority.sidecarIdentity
    || current.manifest.identity !== authority.manifestIdentity
    || current.packageReview.captureSha256 !== authority.captureSha256
    || current.packageReview.sidecarSha256 !== authority.sidecarSha256
    || current.packageReview.manifestSha256 !== authority.manifestSha256
    || current.packageReview.observationCount !== authority.observationCount
    || current.packageReview.observationSchemaVersion !== authority.observationSchemaVersion) {
    throw new TypeError('ACCEPTED_AUTHORITY_STALE');
  }
  const ledgerPath = intakeLedgerPath({ capturePath: authority.capturePath });
  const ledger = stableReadFile(ledgerPath, 'LEDGER');
  if (ledger.identity !== authority.ledgerIdentity || ledger.sha256 !== authority.ledgerSha256) {
    throw new TypeError('LATEST_ACCEPTED_CHANGED');
  }
  const entries = parseLedger(ledger.bytes);
  const verified = verifyIntakenPackage({
    caseId: authority.caseId,
    ledgerEntries: entries,
    packageAuthority: current.packageReview.authority,
    currentCaptureSha256: current.packageReview.captureSha256,
    currentSidecarSha256: current.packageReview.sidecarSha256,
    currentManifestSha256: current.packageReview.manifestSha256,
    observationCount: current.packageReview.observationCount,
    observationSchemaVersion: current.packageReview.observationSchemaVersion,
  });
  if (!verified.ok) throw new TypeError(verified.reason || 'LATEST_ACCEPTED_MISMATCH');
  return current;
}

function canonicalSignedPayload(doc) {
  return Object.fromEntries(SIGNED_PAYLOAD_KEYS.map((key) => [key, doc[key]]));
}

function decodeDetachedSignature(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
    throw new TypeError('READBACK_SIGNATURE_INVALID');
  }
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length !== 64 || bytes.toString('base64') !== value) throw new TypeError('READBACK_SIGNATURE_INVALID');
  return bytes;
}

function validateReceiptDocument(doc, caseId, packageReview) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new TypeError('READBACK_RECEIPT_SHAPE_INVALID');
  const keys = Object.keys(doc);
  if (keys.length !== SIGNED_ENVELOPE_KEYS.size || keys.some((key) => !SIGNED_ENVELOPE_KEYS.has(key))) {
    throw new TypeError('READBACK_RECEIPT_UNKNOWN_OR_MISSING_FIELD');
  }
  if (doc.schemaVersion !== 1
    || doc.artifactKind !== 'platform-identity-readback-receipt'
    || doc.source !== 'platform-runtime'
    || doc.algorithm !== 'Ed25519'
    || doc.caseId !== caseId
    || !Number.isSafeInteger(doc.eventSeq) || doc.eventSeq < 1) throw new TypeError('READBACK_RECEIPT_SCHEMA_INVALID');
  const publicKeyPem = trustedDriverPublicKeyFor(doc.keyId);
  if (!publicKeyPem) throw new TypeError('READBACK_DRIVER_KEY_UNTRUSTED');
  requireSafeString(doc.sessionNonce, 'READBACK_SESSION_NONCE_INVALID');
  if (doc.sessionNonce.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(doc.sessionNonce)) {
    throw new TypeError('READBACK_SESSION_NONCE_INVALID');
  }
  requireHash(doc.captureSha256, 'READBACK_CAPTURE_HASH_INVALID');
  requireHash(doc.sidecarSha256, 'READBACK_SIDECAR_HASH_INVALID');
  requireHash(doc.manifestSha256, 'READBACK_MANIFEST_HASH_INVALID');
  if (doc.captureSha256 !== packageReview.captureSha256
    || doc.sidecarSha256 !== packageReview.sidecarSha256
    || doc.manifestSha256 !== packageReview.manifestSha256) {
    throw new TypeError('READBACK_PACKAGE_BINDING_MISMATCH');
  }
  for (const [key, value] of [['kind', doc.kind], ['name', doc.name], ['code', doc.code], ['platformId', doc.platformId]]) {
    requireSafeString(value, `READBACK_${key.toUpperCase()}_INVALID`);
  }
  requireHash(doc.scopeFingerprint, 'READBACK_SCOPE_INVALID');
  requireHash(doc.evidenceSha256, 'READBACK_EVIDENCE_INVALID');
  const signature = decodeDetachedSignature(doc.signature);
  let verified = false;
  try {
    verified = verify(
      null,
      Buffer.from(JSON.stringify(canonicalSignedPayload(doc)), 'utf8'),
      createPublicKey(publicKeyPem),
      signature,
    );
  } catch {
    verified = false;
  }
  if (!verified) throw new TypeError('READBACK_SIGNATURE_INVALID');
  return doc;
}

export function readPlatformIdentityReadbackReceipt(options = {}) {
  try {
    const { caseId, capturePath, acceptedIntakeAuthority } = snapshotClosedOptions(
      options,
      new Set(['caseId', 'capturePath', 'acceptedIntakeAuthority']),
      { opaqueKeys: new Set(['acceptedIntakeAuthority']) },
    );
    const safeCaseId = requireCaseId(caseId);
    const authority = acceptedIntakeAuthority && typeof acceptedIntakeAuthority === 'object'
      ? ACCEPTED_AUTHORITIES.get(acceptedIntakeAuthority)
      : null;
    if (!authority) throw new TypeError('ACCEPTED_INTAKE_AUTHORITY_INVALID');
    const canonicalCapturePath = assertCanonicalContainers(requireSafeString(capturePath, 'CAPTURE_PATH_INVALID'), safeCaseId);
    if (authority.caseId !== safeCaseId || authority.capturePath !== canonicalCapturePath) {
      throw new TypeError('ACCEPTED_AUTHORITY_BINDING_MISMATCH');
    }
    const current = verifyAuthorityStillCurrent(authority);
    const receiptPath = join(dirname(canonicalCapturePath), RECEIPT_NAME);
    const receiptSnapshot = stableReadFile(receiptPath, 'READBACK_RECEIPT');
    const receiptDoc = validateReceiptDocument(
      parseJsonObject(receiptSnapshot.bytes, 'READBACK_RECEIPT'),
      safeCaseId,
      current.packageReview,
    );
    const sidecar = parseJsonObject(current.sidecar.bytes, 'SIDECAR');
    const observations = Array.isArray(sidecar.observations) ? sidecar.observations : [];
    const matches = observations.filter((entry) => entry?.eventSeq === receiptDoc.eventSeq);
    if (matches.length !== 1) throw new TypeError('READBACK_EVENTSEQ_MISMATCH');
    const observation = matches[0];
    for (const key of ['kind', 'name', 'code', 'platformId', 'scopeFingerprint', 'evidenceSha256']) {
      if (observation[key] !== receiptDoc[key]) throw new TypeError(`READBACK_${key.toUpperCase()}_MISMATCH`);
    }
    const events = Array.isArray(parseJsonObject(current.capture.bytes, 'CAPTURE').events)
      ? parseJsonObject(current.capture.bytes, 'CAPTURE').events
      : [];
    if (events.filter((event) => event?.seq === receiptDoc.eventSeq).length !== 1) {
      throw new TypeError('READBACK_EVENTSEQ_MISMATCH');
    }
    const receipt = mintReadbackReceipt(Object.freeze({
      caseId: safeCaseId,
      eventSeq: receiptDoc.eventSeq,
      kind: receiptDoc.kind,
      name: receiptDoc.name,
      code: receiptDoc.code,
      platformId: receiptDoc.platformId,
      scopeFingerprint: receiptDoc.scopeFingerprint,
      evidenceSha256: receiptDoc.evidenceSha256,
      captureSha256: receiptDoc.captureSha256,
      sidecarSha256: receiptDoc.sidecarSha256,
      manifestSha256: receiptDoc.manifestSha256,
      keyId: receiptDoc.keyId,
      sessionNonce: receiptDoc.sessionNonce,
      receiptSha256: receiptSnapshot.sha256,
      provenance: 'signed-driver-ed25519',
    }));
    return Object.freeze({ ok: true, reason: null, receipt, provenance: 'signed-driver-ed25519' });
  } catch (error) {
    return deny(safeCode(error, 'READBACK_RECEIPT_ERROR'));
  }
}
