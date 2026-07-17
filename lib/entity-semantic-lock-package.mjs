// Teach-in 三件套的纯函数完整性层。
// capture 与 identity sidecar 先各自形成最终字节，第三份 manifest 再绑定二者；manifest 不自哈希，
// 因而不存在 capture <-> sidecar 的哈希环。I/O、symlink 与打开文件的竞态防护留给 CLI 层。
import { createHash } from 'node:crypto';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';

const CAPTURE_NAME = 'teach-in-capture.json';
const SIDECAR_NAME = 'identity-observations.json';
const MANIFEST_NAME = 'teach-in-package.json';
const HASH_RE = /^sha256:[a-f0-9]{64}$/;
const TOP_KEYS = ['schemaVersion', 'artifactKind', 'caseId', 'capture', 'sidecar'];
const CAPTURE_KEYS = ['filename', 'sha256'];
const SIDECAR_KEYS = ['filename', 'sha256', 'observationCount', 'observationSchemaVersion'];
const VERIFIED_PACKAGE_AUTHORITIES = new WeakMap();

function bytesOf(value, label) {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof Uint8Array) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (typeof value === 'string') return Buffer.from(value, 'utf8');
  throw new TypeError(`${label} 须为最终 bytes/string`);
}

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function exactKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function safeCaseId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value);
}

function parseJsonBytes(bytes) {
  try { return JSON.parse(bytes.toString('utf8')); } catch { return null; }
}

function inspectSidecar(sidecarBytes, caseId) {
  const doc = parseJsonBytes(sidecarBytes);
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { ok: false, reason: 'SIDECAR_PARSE_ERROR' };
  if (doc.artifactKind !== 'identity-observations' || doc.caseId !== caseId) return { ok: false, reason: 'SIDECAR_IDENTITY_MISMATCH' };
  if (!Number.isSafeInteger(doc.schemaVersion) || doc.schemaVersion < 1 || !Array.isArray(doc.observations)) {
    return { ok: false, reason: 'SIDECAR_SCHEMA_INVALID' };
  }
  return { ok: true, observationCount: doc.observations.length, observationSchemaVersion: doc.schemaVersion };
}

function canonicalManifest(value) {
  return {
    schemaVersion: 1,
    artifactKind: 'teach-in-package-manifest',
    caseId: value.caseId,
    capture: { filename: CAPTURE_NAME, sha256: value.capture.sha256 },
    sidecar: {
      filename: SIDECAR_NAME,
      sha256: value.sidecar.sha256,
      observationCount: value.sidecar.observationCount,
      observationSchemaVersion: value.sidecar.observationSchemaVersion,
    },
  };
}

function validateManifestShape(value, caseId) {
  if (!exactKeys(value, TOP_KEYS) || !exactKeys(value.capture, CAPTURE_KEYS) || !exactKeys(value.sidecar, SIDECAR_KEYS)) {
    return { ok: false, reason: 'MANIFEST_UNKNOWN_OR_MISSING_FIELD' };
  }
  if (value.schemaVersion !== 1 || value.artifactKind !== 'teach-in-package-manifest') return { ok: false, reason: 'MANIFEST_SCHEMA_INVALID' };
  if (!safeCaseId(value.caseId) || value.caseId !== caseId) return { ok: false, reason: 'MANIFEST_CASEID_MISMATCH' };
  if (value.capture.filename !== CAPTURE_NAME || value.sidecar.filename !== SIDECAR_NAME
    || isAbsolute(value.capture.filename) || isAbsolute(value.sidecar.filename)
    || basename(value.capture.filename) !== value.capture.filename || basename(value.sidecar.filename) !== value.sidecar.filename) {
    return { ok: false, reason: 'MANIFEST_PATH_INVALID' };
  }
  if (!HASH_RE.test(value.capture.sha256) || !HASH_RE.test(value.sidecar.sha256)) return { ok: false, reason: 'MANIFEST_HASH_INVALID' };
  if (!Number.isSafeInteger(value.sidecar.observationCount) || value.sidecar.observationCount < 0
    || !Number.isSafeInteger(value.sidecar.observationSchemaVersion) || value.sidecar.observationSchemaVersion < 1) {
    return { ok: false, reason: 'MANIFEST_OBSERVATION_METADATA_INVALID' };
  }
  return { ok: true };
}

function denied(reason) {
  return Object.freeze({ ok: false, allowIntake: false, reason, nextAction: 'RERECORD_PACKAGE_AND_REINTAKE' });
}

function mintVerifiedPackageAuthority(facts) {
  const handle = Object.freeze(Object.create(null));
  VERIFIED_PACKAGE_AUTHORITIES.set(handle, Object.freeze({ ...facts }));
  return handle;
}

// 只接受本模块 verifyTeachInPackage 成功铸造的句柄；plain object 即使复制全部 hash 字段也无品牌。
export function verifiedTeachInPackageAuthorityFacts(handle) {
  const facts = handle && typeof handle === 'object' ? VERIFIED_PACKAGE_AUTHORITIES.get(handle) : null;
  return facts ? Object.freeze({ ok: true, facts }) : Object.freeze({ ok: false, reason: 'VERIFIED_PACKAGE_AUTHORITY_INVALID' });
}

export function buildTeachInPackageManifest({
  caseId,
  captureBytes,
  sidecarBytes,
  observationCount,
  observationSchemaVersion,
} = {}) {
  if (!safeCaseId(caseId)) throw new TypeError('caseId 须为安全单段标识');
  const capture = bytesOf(captureBytes, 'captureBytes');
  const sidecar = bytesOf(sidecarBytes, 'sidecarBytes');
  const inspected = inspectSidecar(sidecar, caseId);
  if (!inspected.ok) throw new TypeError(inspected.reason);
  if (observationCount !== inspected.observationCount || observationSchemaVersion !== inspected.observationSchemaVersion) {
    throw new TypeError('OBSERVATION_METADATA_MISMATCH');
  }
  const captureHash = sha256(capture);
  const sidecarHash = sha256(sidecar);
  if (capture.includes(Buffer.from(sidecarHash)) || sidecar.includes(Buffer.from(captureHash))) {
    throw new TypeError('CROSS_ARTIFACT_HASH_REFERENCE');
  }
  return canonicalManifest({
    caseId,
    capture: { sha256: captureHash },
    sidecar: { sha256: sidecarHash, observationCount, observationSchemaVersion },
  });
}

export function serializeTeachInPackageManifest(manifest) {
  const checked = validateManifestShape(manifest, manifest?.caseId);
  if (!checked.ok) throw new TypeError(checked.reason);
  return JSON.stringify(canonicalManifest(manifest), null, 2) + '\n';
}

export function verifyTeachInPackage({ caseId, captureBytes, sidecarBytes, manifestBytes } = {}) {
  if (!safeCaseId(caseId)) return denied('CASEID_INVALID');
  let capture;
  let sidecar;
  let manifestRaw;
  try {
    capture = bytesOf(captureBytes, 'captureBytes');
    sidecar = bytesOf(sidecarBytes, 'sidecarBytes');
    manifestRaw = bytesOf(manifestBytes, 'manifestBytes');
  } catch {
    return denied('PACKAGE_BYTES_INVALID');
  }
  const manifest = parseJsonBytes(manifestRaw);
  const shape = validateManifestShape(manifest, caseId);
  if (!shape.ok) return denied(shape.reason);
  const canonicalBytes = Buffer.from(JSON.stringify(canonicalManifest(manifest), null, 2) + '\n');
  if (!manifestRaw.equals(canonicalBytes)) return denied('MANIFEST_NONCANONICAL_BYTES');

  const captureDoc = parseJsonBytes(capture);
  if (!captureDoc || captureDoc.caseId !== caseId) return denied('CAPTURE_CASEID_MISMATCH');
  const sidecarInfo = inspectSidecar(sidecar, caseId);
  if (!sidecarInfo.ok) return denied(sidecarInfo.reason);
  const captureSha256 = sha256(capture);
  const sidecarSha256 = sha256(sidecar);
  const manifestSha256 = sha256(manifestRaw);
  if (capture.includes(Buffer.from(sidecarSha256)) || sidecar.includes(Buffer.from(captureSha256))) return denied('CROSS_ARTIFACT_HASH_REFERENCE');
  if (manifest.capture.sha256 !== captureSha256) return denied('CAPTURE_BYTES_MISMATCH');
  if (manifest.sidecar.sha256 !== sidecarSha256) return denied('SIDECAR_BYTES_MISMATCH');
  if (manifest.sidecar.observationCount !== sidecarInfo.observationCount
    || manifest.sidecar.observationSchemaVersion !== sidecarInfo.observationSchemaVersion) {
    return denied('OBSERVATION_METADATA_MISMATCH');
  }
  const facts = Object.freeze({
    caseId,
    captureSha256,
    sidecarSha256,
    manifestSha256,
    observationCount: sidecarInfo.observationCount,
    observationSchemaVersion: sidecarInfo.observationSchemaVersion,
  });
  const authority = mintVerifiedPackageAuthority(facts);
  return Object.freeze({
    ok: true,
    allowIntake: true,
    reason: null,
    nextAction: null,
    ...facts,
    authority,
  });
}

export function deriveTeachInPackagePaths({ capturePath } = {}) {
  if (typeof capturePath !== 'string' || !capturePath.trim()) throw new TypeError('capturePath 须为非空 string');
  const absolute = resolve(capturePath);
  const packageDir = dirname(absolute);
  const caseDir = dirname(packageDir);
  if (basename(absolute) !== CAPTURE_NAME || basename(packageDir) !== 'record-capture'
    || !safeCaseId(basename(caseDir))) {
    throw new TypeError('CAPTURE_PATH_NOT_CANONICAL');
  }
  return Object.freeze({
    capturePath: absolute,
    sidecarPath: join(packageDir, SIDECAR_NAME),
    manifestPath: join(packageDir, MANIFEST_NAME),
  });
}
