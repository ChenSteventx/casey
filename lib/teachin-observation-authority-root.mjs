// 身份观察 authority 的唯一 I/O 铸造根。
// accepted authority 只在固定三件套完成真实 append transaction 后铸造；plain ledger/bytes 不在此面。
// readback receipt 只在代码内固定 Ed25519 driver key 验签与 exact binding 后铸造；
// 私钥保护、真实 driver 唯一写者与 session nonce 持久防重放仍须 route:human。
import { createHash, createPublicKey, randomUUID, verify } from 'node:crypto';
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { isProxy } from 'node:util/types';
import { credentialGate } from './cred-gate.mjs';
import {
  deriveTeachInPackagePaths,
  verifyTeachInPackage,
} from './entity-semantic-lock-package.mjs';
import {
  buildIntakeRecord,
  hasDuplicateKeys,
  intakeLedgerPath,
  normConverge,
  reviewCapture,
} from './record-intake.mjs';
import { verifyIntakenPackage } from './record-distill.mjs';
import { snapshotClosedOptions } from './safe-own-data.mjs';
import { driverRegistryReadiness, trustedDriverPublicKeyFor } from './teachin-observation-driver-registry.mjs';
import { PROJECT_ROOT } from './paths.mjs';

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
const FIXED_CASES_ROOT = join(PROJECT_ROOT, 'cases');
const MAX_LEDGER_LINE_BYTES = 16384;
const MAX_LEDGER_ENTRIES = 1024;
const MAX_LEDGER_BYTES = MAX_LEDGER_LINE_BYTES * MAX_LEDGER_ENTRIES;

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

function stableReadFile(pathname, label, { maxBytes = null } = {}) {
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
    if (maxBytes !== null && before.size > BigInt(maxBytes)) throw new TypeError(`${label}_TOO_LARGE`);
    if (before.size > BigInt(Number.MAX_SAFE_INTEGER)) throw new TypeError(`${label}_TOO_LARGE`);
    const bytes = Buffer.alloc(Number(before.size));
    let offset = 0;
    while (offset < bytes.length) {
      const count = readSync(fd, bytes, offset, bytes.length - offset, offset);
      if (!Number.isSafeInteger(count) || count < 1) throw new TypeError(`${label}_IDENTITY_CHANGED`);
      offset += count;
    }
    if (readSync(fd, Buffer.alloc(1), 0, 1, offset) !== 0) throw new TypeError(`${label}_IDENTITY_CHANGED`);
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
  const expected = join(FIXED_CASES_ROOT, caseId, 'record-capture', 'teach-in-capture.json');
  if (absolute !== expected
    || basename(absolute) !== 'teach-in-capture.json'
    || basename(packageDir) !== 'record-capture'
    || basename(caseDir) !== caseId) throw new TypeError('CAPTURE_PATH_NOT_CANONICAL');
  const identities = [];
  for (const [pathName, code] of [
    [FIXED_CASES_ROOT, 'CASES_ROOT'],
    [caseDir, 'CASE_DIR'],
    [packageDir, 'PACKAGE_DIR'],
  ]) {
    let stat;
    let real;
    try {
      stat = lstatSync(pathName, { bigint: true });
      real = resolve(realpathSync(pathName));
    } catch { throw new TypeError(`${code}_UNREADABLE`); }
    if (stat.isSymbolicLink()) throw new TypeError(`${code}_SYMLINK`);
    if (!stat.isDirectory()) throw new TypeError(`${code}_NOT_DIRECTORY`);
    if (real !== resolve(pathName)) throw new TypeError(`${code}_REALPATH_ESCAPE`);
    identities.push(Object.freeze({ path: pathName, identity: statIdentity(stat) }));
  }
  return Object.freeze({ capturePath: absolute, containers: Object.freeze(identities) });
}

function assertContainersStillCurrent(canonical) {
  for (const expected of canonical.containers) {
    let stat;
    try { stat = lstatSync(expected.path, { bigint: true }); }
    catch { throw new TypeError('CONTAINER_IDENTITY_CHANGED'); }
    if (!stat.isDirectory() || stat.isSymbolicLink() || statIdentity(stat) !== expected.identity
      || resolve(realpathSync(expected.path)) !== resolve(expected.path)) {
      throw new TypeError('CONTAINER_IDENTITY_CHANGED');
    }
  }
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
    if (Buffer.byteLength(line, 'utf8') > MAX_LEDGER_LINE_BYTES) throw new TypeError('LEDGER_LINE_TOO_LARGE');
    if (hasDuplicateKeys(line)) throw new TypeError('LEDGER_DUPLICATE_KEY');
    let entry;
    try { entry = JSON.parse(line); } catch { throw new TypeError('LEDGER_PARSE_ERROR'); }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new TypeError('LEDGER_SHAPE_INVALID');
    entries.push(entry);
    if (entries.length > MAX_LEDGER_ENTRIES) throw new TypeError('LEDGER_TOO_MANY_ENTRIES');
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
    'driverReceiptSha256', 'driverKeyId', 'driverSessionNonce',
    'transactionId', 'transactionState', 'ledgerGeneration', 'transactionSha256',
  ];
  return keys.every((key) => record?.[key] === expected?.[key]);
}

function validateReceiptAgainstPackage(packageSnapshot, canonicalCapturePath, caseId) {
  const receiptPath = join(dirname(canonicalCapturePath), RECEIPT_NAME);
  const receiptSnapshot = stableReadFile(receiptPath, 'READBACK_RECEIPT');
  const receiptDoc = validateReceiptDocument(
    parseJsonObject(receiptSnapshot.bytes, 'READBACK_RECEIPT'),
    caseId,
    packageSnapshot.packageReview,
  );
  const sidecar = parseJsonObject(packageSnapshot.sidecar.bytes, 'SIDECAR');
  const observations = Array.isArray(sidecar.observations) ? sidecar.observations : [];
  const matches = observations.filter((entry) => entry?.eventSeq === receiptDoc.eventSeq);
  if (matches.length !== 1) throw new TypeError('READBACK_EVENTSEQ_MISMATCH');
  const observation = matches[0];
  for (const key of ['kind', 'name', 'code', 'platformId', 'scopeFingerprint', 'evidenceSha256']) {
    if (observation[key] !== receiptDoc[key]) throw new TypeError(`READBACK_${key.toUpperCase()}_MISMATCH`);
  }
  const capture = parseJsonObject(packageSnapshot.capture.bytes, 'CAPTURE');
  const events = Array.isArray(capture.events) ? capture.events : [];
  if (events.filter((event) => event?.seq === receiptDoc.eventSeq).length !== 1) {
    throw new TypeError('READBACK_EVENTSEQ_MISMATCH');
  }
  return Object.freeze({ snapshot: receiptSnapshot, doc: receiptDoc });
}

function readExistingLedger(ledgerPath) {
  if (!existsSync(ledgerPath)) return Object.freeze({ bytes: Buffer.alloc(0), entries: Object.freeze([]), snapshot: null });
  let before;
  try { before = lstatSync(ledgerPath, { bigint: true }); }
  catch { throw new TypeError('LEDGER_UNREADABLE'); }
  if (before.isSymbolicLink()) throw new TypeError('LEDGER_SYMLINK');
  if (!before.isFile()) throw new TypeError('LEDGER_NOT_REGULAR_FILE');
  if (before.nlink !== 1n) throw new TypeError('LEDGER_HARDLINK');
  const snapshot = stableReadFile(ledgerPath, 'LEDGER', { maxBytes: MAX_LEDGER_BYTES });
  const after = lstatSync(ledgerPath, { bigint: true });
  if (after.nlink !== 1n || statIdentity(after) !== statIdentity(before)) throw new TypeError('LEDGER_IDENTITY_CHANGED');
  return Object.freeze({ bytes: snapshot.bytes, entries: Object.freeze(parseLedger(snapshot.bytes)), snapshot });
}

function writeFully(fd, bytes) {
  let offset = 0;
  while (offset < bytes.length) {
    const count = writeSync(fd, bytes, offset, bytes.length - offset);
    if (!Number.isSafeInteger(count) || count < 1) throw new TypeError('LEDGER_WRITE_INCOMPLETE');
    offset += count;
  }
}

// temp file 的最终 commit 闸。公开仅为零 SUT 故障注入门禁复用；不铸造 authority、不 rename。
// 对 options 只读 descriptor，拒 Proxy/accessor/未知字段；completeBytes 上限与 ledger 上限一致。
export function verifyLedgerTempCommitBytes(options = {}) {
  if ((typeof options === 'object' || typeof options === 'function') && options !== null && isProxy(options)) {
    throw new TypeError('LEDGER_TEMP_VERIFY_UNSAFE');
  }
  if (!options || typeof options !== 'object' || Array.isArray(options)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(options))) throw new TypeError('LEDGER_TEMP_VERIFY_UNSAFE');
  const keys = ['tempPath', 'expectedIdentity', 'completeBytes', 'completeSha256'];
  const actualKeys = Reflect.ownKeys(options);
  if (actualKeys.length !== keys.length || actualKeys.some((key) => typeof key !== 'string' || !keys.includes(key))) {
    throw new TypeError('LEDGER_TEMP_VERIFY_UNSAFE');
  }
  const values = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(options, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || descriptor.enumerable !== true) {
      throw new TypeError('LEDGER_TEMP_VERIFY_UNSAFE');
    }
    values[key] = descriptor.value;
  }
  const { tempPath, expectedIdentity, completeBytes, completeSha256 } = values;
  if (typeof tempPath !== 'string' || !tempPath || typeof expectedIdentity !== 'string'
    || !Buffer.isBuffer(completeBytes) || completeBytes.byteLength > MAX_LEDGER_BYTES
    || typeof completeSha256 !== 'string' || !HASH_RE.test(completeSha256)
    || sha256(completeBytes) !== completeSha256) throw new TypeError('LEDGER_TEMP_EXPECTATION_INVALID');
  const pathStat = lstatSync(tempPath, { bigint: true });
  if (!pathStat.isFile() || pathStat.isSymbolicLink() || pathStat.nlink !== 1n
    || statIdentity(pathStat) !== expectedIdentity) throw new TypeError('LEDGER_TEMP_IDENTITY_CHANGED');
  const finalTemp = stableReadFile(tempPath, 'LEDGER_TEMP_FINAL', { maxBytes: MAX_LEDGER_BYTES });
  const after = lstatSync(tempPath, { bigint: true });
  if (!after.isFile() || after.isSymbolicLink() || after.nlink !== 1n
    || statIdentity(after) !== expectedIdentity || finalTemp.identity !== expectedIdentity) {
    throw new TypeError('LEDGER_TEMP_IDENTITY_CHANGED');
  }
  if (finalTemp.bytes.byteLength !== completeBytes.byteLength
    || finalTemp.sha256 !== completeSha256 || !finalTemp.bytes.equals(completeBytes)) {
    throw new TypeError('LEDGER_TEMP_CONTENT_CHANGED');
  }
  return Object.freeze({ ok: true, identity: finalTemp.identity, sha256: finalTemp.sha256 });
}

function commitAcceptedTransaction({ canonical, caseId, initial, receipt, captureReview }) {
  const ledgerPath = intakeLedgerPath({ capturePath: canonical.capturePath });
  const lockPath = `${ledgerPath}.lock`;
  const tempPath = `${ledgerPath}.${process.pid}.${randomUUID()}.tmp`;
  let lockFd;
  let lockIdentity;
  let tempFd;
  let tempIdentity;
  let committed = false;
  try {
    lockFd = openSync(
      lockPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW || 0),
      0o600,
    );
    const lockStat = fstatSync(lockFd, { bigint: true });
    if (!lockStat.isFile() || lockStat.nlink !== 1n) throw new TypeError('LEDGER_LOCK_INVALID');
    lockIdentity = statIdentity(lockStat);
    writeFully(lockFd, Buffer.from(`${process.pid}\n`, 'utf8'));
    fsyncSync(lockFd);

    const existing = readExistingLedger(ledgerPath);
    if (existing.entries.length >= MAX_LEDGER_ENTRIES) throw new TypeError('LEDGER_TOO_MANY_ENTRIES');
    const generations = existing.entries
      .filter((entry) => entry?.intakeStatus === 'accepted' && entry?.caseId === caseId)
      .map((entry) => entry?.ledgerGeneration);
    if (generations.some((value) => !Number.isSafeInteger(value) || value < 1)
      || new Set(generations).size !== generations.length) throw new TypeError('LEDGER_GENERATION_INVALID');
    const ledgerGeneration = generations.length ? Math.max(...generations) + 1 : 1;
    const base = buildIntakeRecord({
      caseId,
      status: 'accepted',
      eventCount: captureReview.eventCount,
      captureName: 'teach-in-capture.json',
      captureSha256: initial.packageReview.captureSha256,
      sidecarSha256: initial.packageReview.sidecarSha256,
      manifestSha256: initial.packageReview.manifestSha256,
      observationCount: initial.packageReview.observationCount,
      observationSchemaVersion: initial.packageReview.observationSchemaVersion,
    });
    const transactionPayload = {
      ...base,
      driverReceiptSha256: receipt.snapshot.sha256,
      driverKeyId: receipt.doc.keyId,
      driverSessionNonce: receipt.doc.sessionNonce,
      transactionId: `tx_${randomUUID()}`,
      transactionState: 'committed',
      ledgerGeneration,
    };
    const record = {
      ...transactionPayload,
      transactionSha256: sha256(JSON.stringify(transactionPayload)),
    };
    const line = `${JSON.stringify(record)}\n`;
    const lineBytes = Buffer.from(line, 'utf8');
    if (lineBytes.byteLength > MAX_LEDGER_LINE_BYTES) throw new TypeError('LEDGER_LINE_TOO_LARGE');
    if (!credentialGate({ 'intake-ledger.jsonl': line }).ok) throw new TypeError('CRED_GATE_HIT');
    const completeBytes = Buffer.concat([existing.bytes, lineBytes]);

    tempFd = openSync(
      tempPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW || 0),
      0o600,
    );
    const openedTempStat = fstatSync(tempFd, { bigint: true });
    if (!openedTempStat.isFile() || openedTempStat.nlink !== 1n) throw new TypeError('LEDGER_TEMP_INVALID');
    tempIdentity = statIdentity(openedTempStat);
    writeFully(tempFd, completeBytes);
    fsyncSync(tempFd);
    const tempStat = fstatSync(tempFd, { bigint: true });
    if (!tempStat.isFile() || tempStat.nlink !== 1n) throw new TypeError('LEDGER_TEMP_INVALID');

    // 所有可判定校验均在 rename commit 前完成；父目录并发 rename race 单列 route:human。
    assertContainersStillCurrent(canonical);
    const current = readPackage(canonical.capturePath, caseId);
    if (!samePackageFacts(initial, current)) throw new TypeError('PACKAGE_IDENTITY_CHANGED');
    const currentReceipt = validateReceiptAgainstPackage(current, canonical.capturePath, caseId);
    if (currentReceipt.snapshot.identity !== receipt.snapshot.identity
      || currentReceipt.snapshot.sha256 !== receipt.snapshot.sha256) throw new TypeError('READBACK_RECEIPT_IDENTITY_CHANGED');
    if (existing.snapshot) {
      const latestExisting = readExistingLedger(ledgerPath);
      if (!latestExisting.snapshot
        || latestExisting.snapshot.identity !== existing.snapshot.identity
        || latestExisting.snapshot.sha256 !== existing.snapshot.sha256) throw new TypeError('LEDGER_IDENTITY_CHANGED');
    } else if (existsSync(ledgerPath)) {
      throw new TypeError('LEDGER_IDENTITY_CHANGED');
    }
    const entries = [...existing.entries, record];
    const verified = verifyIntakenPackage({
      caseId,
      ledgerEntries: entries,
      packageAuthority: current.packageReview.authority,
      currentCaptureSha256: current.packageReview.captureSha256,
      currentSidecarSha256: current.packageReview.sidecarSha256,
      currentManifestSha256: current.packageReview.manifestSha256,
      observationCount: current.packageReview.observationCount,
      observationSchemaVersion: current.packageReview.observationSchemaVersion,
    });
    if (!verified.ok || !recordMatches(entries.at(-1), record)) {
      throw new TypeError(verified.reason || 'LATEST_ACCEPTED_MISMATCH');
    }

    closeSync(tempFd);
    tempFd = undefined;
    const completeSha256 = sha256(completeBytes);
    const finalTemp = verifyLedgerTempCommitBytes({
      tempPath,
      expectedIdentity: tempIdentity,
      completeBytes,
      completeSha256,
    });
    renameSync(tempPath, ledgerPath);
    committed = true;
    return Object.freeze({
      current,
      receipt: currentReceipt,
      record: Object.freeze(record),
      ledgerIdentity: finalTemp.identity,
      ledgerSha256: finalTemp.sha256,
    });
  } finally {
    if (tempFd !== undefined) {
      try { closeSync(tempFd); } catch { /* fixed category returned by caller */ }
    }
    if (!committed && tempIdentity) {
      try {
        const currentTemp = lstatSync(tempPath, { bigint: true });
        if (!currentTemp.isSymbolicLink() && currentTemp.isFile()
          && statIdentity(currentTemp) === tempIdentity) unlinkSync(tempPath);
      } catch { /* replaced temp is never removed */ }
    }
    if (lockFd !== undefined) {
      try { closeSync(lockFd); } catch { /* lock cleanup below */ }
    }
    if (lockIdentity) {
      try {
        const currentLock = lstatSync(lockPath, { bigint: true });
        if (!currentLock.isSymbolicLink() && currentLock.isFile()
          && statIdentity(currentLock) === lockIdentity) unlinkSync(lockPath);
      } catch { /* replaced/stale lock fails future O_EXCL safely; never remove another owner's lock */ }
    }
  }
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
  const {
    caseId, captureSha256, sidecarSha256, manifestSha256, observationCount, observationSchemaVersion,
    ledgerGeneration, transactionId,
  } = internal;
  return Object.freeze({
    ok: true,
    facts: Object.freeze({
      caseId, captureSha256, sidecarSha256, manifestSha256, observationCount, observationSchemaVersion,
      ledgerGeneration, transactionId,
    }),
  });
}

export function platformIdentityReadbackReceiptFacts(handle) {
  if ((typeof handle === 'object' || typeof handle === 'function') && handle !== null && isProxy(handle)) {
    return Object.freeze({ ok: false, reason: 'READBACK_RECEIPT_INVALID' });
  }
  const internal = handle && typeof handle === 'object' ? READBACK_RECEIPTS.get(handle) : null;
  if (!internal) return Object.freeze({ ok: false, reason: 'READBACK_RECEIPT_INVALID' });
  const {
    caseId, eventSeq, kind, name, code, platformId, scopeFingerprint, evidenceSha256,
    captureSha256, sidecarSha256, manifestSha256, keyId, sessionNonce, receiptSha256,
    provenance, ledgerGeneration, transactionId,
  } = internal;
  return Object.freeze({
    ok: true,
    facts: Object.freeze({
      caseId, eventSeq, kind, name, code, platformId, scopeFingerprint, evidenceSha256,
      captureSha256, sidecarSha256, manifestSha256, keyId, sessionNonce, receiptSha256,
      provenance, ledgerGeneration, transactionId,
    }),
  });
}

export function verifyObservationTransactionPair(options = {}) {
  try {
    const { acceptedIntakeAuthority, platformReadbackReceipt } = snapshotClosedOptions(
      options,
      new Set(['acceptedIntakeAuthority', 'platformReadbackReceipt']),
      { opaqueKeys: new Set(['acceptedIntakeAuthority', 'platformReadbackReceipt']) },
    );
    const authority = acceptedIntakeAuthority && typeof acceptedIntakeAuthority === 'object'
      ? ACCEPTED_AUTHORITIES.get(acceptedIntakeAuthority)
      : null;
    const receipt = platformReadbackReceipt && typeof platformReadbackReceipt === 'object'
      ? READBACK_RECEIPTS.get(platformReadbackReceipt)
      : null;
    if (!authority) throw new TypeError('ACCEPTED_INTAKE_AUTHORITY_INVALID');
    if (!receipt) throw new TypeError('READBACK_RECEIPT_INVALID');
    if (authority.transactionToken !== receipt.transactionToken
      || authority.transactionId !== receipt.transactionId
      || authority.ledgerGeneration !== receipt.ledgerGeneration
      || authority.caseId !== receipt.caseId
      || authority.captureSha256 !== receipt.captureSha256
      || authority.sidecarSha256 !== receipt.sidecarSha256
      || authority.manifestSha256 !== receipt.manifestSha256) {
      throw new TypeError('OBSERVATION_TRANSACTION_PAIR_MISMATCH');
    }
    const current = verifyAuthorityStillCurrent(authority);
    const currentReceipt = validateReceiptAgainstPackage(current, authority.capturePath, authority.caseId);
    if (currentReceipt.snapshot.identity !== authority.receiptIdentity
      || currentReceipt.snapshot.sha256 !== authority.receiptSha256
      || currentReceipt.snapshot.sha256 !== receipt.receiptSha256) {
      throw new TypeError('OBSERVATION_TRANSACTION_PAIR_STALE');
    }
    return Object.freeze({
      ok: true,
      reason: null,
      facts: Object.freeze({
        caseId: authority.caseId,
        captureSha256: authority.captureSha256,
        sidecarSha256: authority.sidecarSha256,
        manifestSha256: authority.manifestSha256,
        observationCount: authority.observationCount,
        observationSchemaVersion: authority.observationSchemaVersion,
        ledgerGeneration: authority.ledgerGeneration,
        transactionId: authority.transactionId,
        eventSeq: receipt.eventSeq,
        kind: receipt.kind,
        name: receipt.name,
        code: receipt.code,
        platformId: receipt.platformId,
        scopeFingerprint: receipt.scopeFingerprint,
        evidenceSha256: receipt.evidenceSha256,
        keyId: receipt.keyId,
        sessionNonce: receipt.sessionNonce,
        receiptSha256: receipt.receiptSha256,
        provenance: receipt.provenance,
      }),
    });
  } catch (error) {
    return deny(safeCode(error, 'OBSERVATION_TRANSACTION_PAIR_INVALID'));
  }
}

export function appendAcceptedObservationPackage(options = {}) {
  try {
    const { caseId, capturePath } = snapshotClosedOptions(options, new Set(['caseId', 'capturePath']));
    const safeCaseId = requireCaseId(caseId);
    const canonical = assertCanonicalContainers(requireSafeString(capturePath, 'CAPTURE_PATH_INVALID'), safeCaseId);
    const initial = readPackage(canonical.capturePath, safeCaseId);
    const captureReview = reviewCaptureV2(initial, safeCaseId);
    const receipt = validateReceiptAgainstPackage(initial, canonical.capturePath, safeCaseId);
    const committed = commitAcceptedTransaction({ canonical, caseId: safeCaseId, initial, receipt, captureReview });
    const transactionToken = Object.freeze(Object.create(null));
    const authority = mintAcceptedAuthority({
      source: 'canonical-append-transaction',
      caseId: safeCaseId,
      capturePath: canonical.capturePath,
      containerIdentities: canonical.containers,
      captureIdentity: committed.current.capture.identity,
      sidecarIdentity: committed.current.sidecar.identity,
      manifestIdentity: committed.current.manifest.identity,
      receiptIdentity: committed.receipt.snapshot.identity,
      receiptSha256: committed.receipt.snapshot.sha256,
      ledgerIdentity: committed.ledgerIdentity,
      ledgerSha256: committed.ledgerSha256,
      captureSha256: committed.current.packageReview.captureSha256,
      sidecarSha256: committed.current.packageReview.sidecarSha256,
      manifestSha256: committed.current.packageReview.manifestSha256,
      observationCount: committed.current.packageReview.observationCount,
      observationSchemaVersion: committed.current.packageReview.observationSchemaVersion,
      ledgerGeneration: committed.record.ledgerGeneration,
      transactionId: committed.record.transactionId,
      transactionToken,
    });
    return Object.freeze({ ok: true, reason: null, authority, provenance: 'canonical-append-transaction' });
  } catch (error) {
    return deny(safeCode(error));
  }
}

function verifyAuthorityStillCurrent(authority) {
  const canonical = assertCanonicalContainers(authority.capturePath, authority.caseId);
  if (canonical.containers.length !== authority.containerIdentities.length
    || canonical.containers.some((entry, index) => entry.path !== authority.containerIdentities[index].path
      || entry.identity !== authority.containerIdentities[index].identity)) {
    throw new TypeError('CONTAINER_IDENTITY_CHANGED');
  }
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
  const ledgerState = readExistingLedger(ledgerPath);
  const ledger = ledgerState.snapshot;
  if (!ledger) throw new TypeError('LATEST_ACCEPTED_CHANGED');
  if (ledger.identity !== authority.ledgerIdentity || ledger.sha256 !== authority.ledgerSha256) {
    throw new TypeError('LATEST_ACCEPTED_CHANGED');
  }
  const entries = ledgerState.entries;
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

// Cross-process consumer：以固定 canonical root + release-published signed driver receipt 为持久根，
// ledger 只提供有界顺序/commit 记录。验证闭合后在本进程重新铸造同 token 的 opaque pair。
export function rehydrateAcceptedObservationTransaction(options = {}) {
  try {
    const { caseId, capturePath } = snapshotClosedOptions(options, new Set(['caseId', 'capturePath']));
    const safeCaseId = requireCaseId(caseId);
    const canonical = assertCanonicalContainers(requireSafeString(capturePath, 'CAPTURE_PATH_INVALID'), safeCaseId);
    const current = readPackage(canonical.capturePath, safeCaseId);
    reviewCaptureV2(current, safeCaseId);
    const validatedReceipt = validateReceiptAgainstPackage(current, canonical.capturePath, safeCaseId);
    const ledgerPath = intakeLedgerPath({ capturePath: canonical.capturePath });
    const ledgerState = readExistingLedger(ledgerPath);
    if (!ledgerState.snapshot) throw new TypeError('NOT_INTAKEN');
    const verified = verifyIntakenPackage({
      caseId: safeCaseId,
      ledgerEntries: ledgerState.entries,
      packageAuthority: current.packageReview.authority,
      currentCaptureSha256: current.packageReview.captureSha256,
      currentSidecarSha256: current.packageReview.sidecarSha256,
      currentManifestSha256: current.packageReview.manifestSha256,
      observationCount: current.packageReview.observationCount,
      observationSchemaVersion: current.packageReview.observationSchemaVersion,
    });
    if (!verified.ok) throw new TypeError(verified.reason || 'LATEST_ACCEPTED_MISMATCH');
    const accepts = ledgerState.entries.filter((entry) => entry?.intakeStatus === 'accepted' && entry?.caseId === safeCaseId);
    const latest = accepts.at(-1);
    if (!latest
      || latest.driverReceiptSha256 !== validatedReceipt.snapshot.sha256
      || latest.driverKeyId !== validatedReceipt.doc.keyId
      || latest.driverSessionNonce !== validatedReceipt.doc.sessionNonce) {
      throw new TypeError('DRIVER_RECEIPT_LEDGER_BINDING_MISMATCH');
    }
    assertContainersStillCurrent(canonical);
    const transactionToken = Object.freeze(Object.create(null));
    const authority = mintAcceptedAuthority({
      source: 'canonical-release-rehydrate',
      caseId: safeCaseId,
      capturePath: canonical.capturePath,
      containerIdentities: canonical.containers,
      captureIdentity: current.capture.identity,
      sidecarIdentity: current.sidecar.identity,
      manifestIdentity: current.manifest.identity,
      receiptIdentity: validatedReceipt.snapshot.identity,
      receiptSha256: validatedReceipt.snapshot.sha256,
      ledgerIdentity: ledgerState.snapshot.identity,
      ledgerSha256: ledgerState.snapshot.sha256,
      captureSha256: current.packageReview.captureSha256,
      sidecarSha256: current.packageReview.sidecarSha256,
      manifestSha256: current.packageReview.manifestSha256,
      observationCount: current.packageReview.observationCount,
      observationSchemaVersion: current.packageReview.observationSchemaVersion,
      ledgerGeneration: latest.ledgerGeneration,
      transactionId: latest.transactionId,
      transactionToken,
    });
    const doc = validatedReceipt.doc;
    const receipt = mintReadbackReceipt({
      caseId: safeCaseId,
      eventSeq: doc.eventSeq,
      kind: doc.kind,
      name: doc.name,
      code: doc.code,
      platformId: doc.platformId,
      scopeFingerprint: doc.scopeFingerprint,
      evidenceSha256: doc.evidenceSha256,
      captureSha256: doc.captureSha256,
      sidecarSha256: doc.sidecarSha256,
      manifestSha256: doc.manifestSha256,
      keyId: doc.keyId,
      sessionNonce: doc.sessionNonce,
      receiptSha256: validatedReceipt.snapshot.sha256,
      // Driver signature 已在本进程按 release publication 重新验真；canonical provenance 不因 rehydrate 改义。
      // 跨进程来源由 authority source / 返回 provenance 单独表达。
      provenance: 'signed-driver-ed25519',
      ledgerGeneration: latest.ledgerGeneration,
      transactionId: latest.transactionId,
      transactionToken,
    });
    const pair = verifyObservationTransactionPair({
      acceptedIntakeAuthority: authority,
      platformReadbackReceipt: receipt,
    });
    if (!pair.ok) throw new TypeError(pair.reason || 'OBSERVATION_TRANSACTION_PAIR_INVALID');
    return Object.freeze({
      ok: true,
      reason: null,
      authority,
      receipt,
      provenance: 'canonical-release-rehydrate',
    });
  } catch (error) {
    return deny(safeCode(error, 'OBSERVATION_REHYDRATE_ERROR'));
  }
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
  const readiness = driverRegistryReadiness();
  if (!readiness?.ready) throw new TypeError(readiness?.reason === 'DRIVER_NOT_PUBLISHED' ? 'DRIVER_NOT_PUBLISHED' : 'DRIVER_REGISTRY_NOT_READY');
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
    const canonical = assertCanonicalContainers(requireSafeString(capturePath, 'CAPTURE_PATH_INVALID'), safeCaseId);
    if (authority.caseId !== safeCaseId || authority.capturePath !== canonical.capturePath) {
      throw new TypeError('ACCEPTED_AUTHORITY_BINDING_MISMATCH');
    }
    const current = verifyAuthorityStillCurrent(authority);
    const validatedReceipt = validateReceiptAgainstPackage(current, canonical.capturePath, safeCaseId);
    const receiptSnapshot = validatedReceipt.snapshot;
    const receiptDoc = validatedReceipt.doc;
    if (receiptSnapshot.identity !== authority.receiptIdentity
      || receiptSnapshot.sha256 !== authority.receiptSha256) throw new TypeError('READBACK_RECEIPT_IDENTITY_CHANGED');
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
      ledgerGeneration: authority.ledgerGeneration,
      transactionId: authority.transactionId,
      transactionToken: authority.transactionToken,
    }));
    return Object.freeze({ ok: true, reason: null, receipt, provenance: 'signed-driver-ed25519' });
  } catch (error) {
    return deny(safeCode(error, 'READBACK_RECEIPT_ERROR'));
  }
}
