#!/usr/bin/env node
// P0 successor：只用 identity-bound canonical case lease 创建/清理 case，复冻 transaction 10 组 + driver 7 组。
// 绝不 import/执行两份旧 unsafe golden；只用本地文件与纯函数，禁止 SUT/browser/server/network。

import {
  createHash,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
} from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmdirSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isProxy } from 'node:util/types';
import * as packageApi from '../../lib/entity-semantic-lock-package.mjs';
import * as intakeApi from '../../lib/record-distill.mjs';
import * as identityApi from '../../lib/teachin-identity-observations.mjs';
import * as rootApi from '../../lib/teachin-observation-authority-root.mjs';
import * as safeApi from '../../lib/safe-own-data.mjs';
import * as registryApi from '../../lib/teachin-observation-driver-registry.mjs';
import { CASES_DIR, PROJECT_ROOT } from '../../lib/paths.mjs';
import { buildTeachInCapture } from '../../lib/record-capture.mjs';
import {
  acquireCanonicalCaseLease,
  CASE_LEASE_MARKER,
} from './support/canonical-case-lease.mjs';
import { retryOnTransientFsRace } from './support/retry-transient-fs.mjs';

let passed = 0;
const failures = [];
async function check(name, fn) {
  try { await fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
}
function assertDenied(result, label) {
  if (result?.ok === true || result?.trusted === true || result?.authority || result?.receipt || result?.driverReceipt) {
    throw new Error(`${label} 被错误授权`);
  }
}
function expectThrow(fn, label) {
  let caught = null;
  try { fn(); } catch (error) { caught = error; }
  if (!caught) throw new Error(`${label} 未拒绝`);
}
function opaque(value, label) {
  if (!value || typeof value !== 'object' || Object.keys(value).length !== 0 || JSON.stringify(value) !== '{}') {
    throw new Error(`${label} 不是 opaque handle`);
  }
}
function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
function hash(bytes) {
  return `sha256:${sha256(bytes)}`;
}
function identity(stat) {
  return `${stat.dev}:${stat.ino}`;
}

const CASE_ID = 'tc_observation_driver_provenance';
const OTHER_CASE_ID = 'tc_observation_driver_clone';
const LEASE_PROBE_ID = 'tc_casey_safe_lease_probe';
const SCOPE = `sha256:${'a'.repeat(64)}`;
const EVIDENCE = `sha256:${'c'.repeat(64)}`;
const FIXTURE_DIR = fileURLToPath(new URL('./fixtures/teachin-observation-safe-case-lease-v2/', import.meta.url));
const SIGNED_PATH = join(FIXTURE_DIR, 'identity-readback-receipt.signed.json');
const PUBLIC_KEY_PATH = join(FIXTURE_DIR, 'trusted-driver-public-key.pem');
const SUPERSESSION_PATH = join(FIXTURE_DIR, 'supersession.json');
const SIGNED = JSON.parse(readFileSync(SIGNED_PATH, 'utf8'));
const TRUSTED_PUBLIC_KEY = readFileSync(PUBLIC_KEY_PATH, 'utf8');
const LIMITS = JSON.parse(readFileSync(
  new URL('./fixtures/teachin-observation-transaction-root/limits.json', import.meta.url),
  'utf8',
));
const PAYLOAD_KEYS = [
  'schemaVersion', 'artifactKind', 'source', 'keyId', 'algorithm', 'sessionNonce', 'caseId',
  'captureSha256', 'sidecarSha256', 'manifestSha256', 'eventSeq', 'kind', 'name', 'code',
  'platformId', 'scopeFingerprint', 'evidenceSha256',
];
const GOOD_PATHS = {
  capture: { regularFile: true, symbolicLink: false, parentSymbolicLink: false, identityBefore: 'cap-1', identityAfter: 'cap-1' },
  observations: { regularFile: true, symbolicLink: false, parentSymbolicLink: false, identityBefore: 'obs-1', identityAfter: 'obs-1' },
};

function canonicalPayload(envelope) {
  return Object.fromEntries(PAYLOAD_KEYS.map((key) => [key, envelope[key]]));
}
function canonicalPayloadBytes(envelope) {
  return Buffer.from(JSON.stringify(canonicalPayload(envelope)), 'utf8');
}
function observation(overrides = {}) {
  return {
    kind: 'workflow',
    name: '审批工作流',
    code: 'wf-001',
    platformId: '90071992547409931234',
    scopeFingerprint: SCOPE,
    parent: null,
    evidenceKind: 'detail-dual-anchor-readback',
    eventSeq: 1,
    evidenceSha256: EVIDENCE,
    ...overrides,
  };
}
function bundle({
  caseId = CASE_ID,
  observations = [observation()],
  events = [{ action: 'click', path: '/ai-manager/process/list', text: '审批工作流' }],
} = {}) {
  const sidecar = identityApi.buildIdentityObservationSidecar({ caseId, observations });
  const observationRaw = identityApi.serializeIdentityObservationSidecar(sidecar);
  const capture = identityApi.bindCaptureIdentityObservations({
    capture: buildTeachInCapture({
      caseId,
      startUrl: '/ai-manager/process/list',
      createdAt: '2026-07-17T00:00:00.000Z',
      events,
    }),
    observationRaw,
  });
  const captureRaw = `${JSON.stringify(capture, null, 2)}\n`;
  const manifest = packageApi.buildTeachInPackageManifest({
    caseId,
    captureBytes: captureRaw,
    sidecarBytes: observationRaw,
    observationCount: sidecar.observations.length,
    observationSchemaVersion: sidecar.schemaVersion,
  });
  return {
    caseId,
    captureRaw,
    observationRaw,
    manifestRaw: packageApi.serializeTeachInPackageManifest(manifest),
  };
}
function writePackage(packageDir, options = {}, { signed = true } = {}) {
  const built = bundle(options);
  mkdirSync(packageDir, { recursive: true });
  const capturePath = join(packageDir, 'teach-in-capture.json');
  writeFileSync(capturePath, built.captureRaw);
  writeFileSync(join(packageDir, 'identity-observations.json'), built.observationRaw);
  writeFileSync(join(packageDir, 'teach-in-package.json'), built.manifestRaw);
  if (signed) copyFileSync(SIGNED_PATH, join(packageDir, 'identity-readback-receipt.json'));
  return { ...built, packageDir, capturePath };
}
function safeCleanup(lease, label) {
  const result = lease?.cleanup();
  if (!result?.ok) throw new Error(`${label} lease cleanup 拒绝：${result?.reason || 'UNKNOWN'}`);
}
function prepareCanonical(options = {}) {
  const lease = acquireCanonicalCaseLease({ caseId: CASE_ID });
  try {
    const p = writePackage(lease.packageDir, options);
    return { ...p, lease, caseDir: lease.caseDir, cleanup: () => safeCleanup(lease, CASE_ID) };
  } catch (error) {
    safeCleanup(lease, `${CASE_ID} prepare failure`);
    throw error;
  }
}
function prepareOffRoot(options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'casey-safe-case-lease-v2-'));
  try {
    const p = writePackage(join(root, CASE_ID, 'record-capture'), options);
    return { ...p, root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}
function installEnvelope(p, envelope) {
  writeFileSync(join(p.packageDir, 'identity-readback-receipt.json'), `${JSON.stringify(envelope, null, 2)}\n`);
}
function appendPackage(p, extras = {}) {
  return rootApi.appendAcceptedObservationPackage({ caseId: p.caseId, capturePath: p.capturePath, ...extras });
}
function acceptedFor(p) {
  const result = appendPackage(p);
  if (!result?.ok || !result.authority) throw new Error(`accepted authority 前提失败：${result?.reason || 'UNKNOWN'}`);
  return result.authority;
}
function readDriverReceipt(p, authority, extras = {}) {
  return rootApi.readPlatformIdentityReadbackReceipt({
    caseId: p.caseId,
    capturePath: p.capturePath,
    acceptedIntakeAuthority: authority,
    ...extras,
  });
}
function identityReview(p, authority, receipt) {
  return identityApi.verifyAcceptedIdentityObservationBundle({
    caseId: p.caseId,
    captureRaw: p.captureRaw,
    observationRaw: p.observationRaw,
    pathFacts: GOOD_PATHS,
    acceptedIntakeAuthority: authority,
    platformReadbackReceipt: receipt,
  });
}
function assertNoAcceptedResidue(p, label, { allowLedger = false, allowLock = false } = {}) {
  const ledgerPath = join(p.packageDir, 'intake-ledger.jsonl');
  if (existsSync(ledgerPath)) {
    const raw = readFileSync(ledgerPath, 'utf8');
    if (raw.includes('"intakeStatus":"accepted"')) throw new Error(`${label} 遗留 accepted ledger`);
    if (!allowLedger) throw new Error(`${label} 遗留 ledger 文件`);
  }
  const residue = readdirSync(p.packageDir).filter((name) => (!allowLock && name === 'intake-ledger.jsonl.lock')
    || /^intake-ledger\.jsonl\..+\.tmp$/.test(name));
  if (residue.length) throw new Error(`${label} 遗留 transaction residue`);
}
function assertAppendDeniedNoResidue(p, label, extras = {}) {
  assertDenied(appendPackage(p, extras), label);
  assertNoAcceptedResidue(p, label);
}
function packageReview(p) {
  const result = packageApi.verifyTeachInPackage({
    caseId: p.caseId,
    captureBytes: p.captureRaw,
    sidecarBytes: p.observationRaw,
    manifestBytes: p.manifestRaw,
  });
  if (!result.ok) throw new Error(`package 前提失败：${result.reason}`);
  return result;
}
function plainReceipt() {
  return {
    schemaVersion: 1,
    artifactKind: 'platform-identity-readback-receipt',
    source: 'platform-runtime',
    caseId: SIGNED.caseId,
    eventSeq: SIGNED.eventSeq,
    kind: SIGNED.kind,
    name: SIGNED.name,
    code: SIGNED.code,
    platformId: SIGNED.platformId,
    scopeFingerprint: SIGNED.scopeFingerprint,
    evidenceSha256: SIGNED.evidenceSha256,
  };
}

// ---------- transaction-root successor：10 组 ----------

await check('T1 off-root 同形 package 拒绝且零 accepted residue', () => {
  const p = prepareOffRoot();
  try { assertAppendDeniedNoResidue(p, 'off-root package'); }
  finally { p.cleanup(); }
});

await check('T2 safe lease 预存/marker/目录替换拒删；ancestor symlink 拒绝', () => {
  let lease = acquireCanonicalCaseLease({ caseId: LEASE_PROBE_ID });
  try {
    const markerBefore = readFileSync(lease.markerPath, 'utf8');
    expectThrow(() => acquireCanonicalCaseLease({ caseId: LEASE_PROBE_ID }), '预存 case 二次 acquire');
    if (readFileSync(lease.markerPath, 'utf8') !== markerBefore) throw new Error('预存 case 被二次 acquire 改写');
  } finally { safeCleanup(lease, 'preexisting probe'); }

  lease = acquireCanonicalCaseLease({ caseId: LEASE_PROBE_ID });
  const markerBackup = join(lease.caseDir, '.lease-marker-owned-backup');
  let forgedIdentity = null;
  try {
    retryOnTransientFsRace(() => renameSync(lease.markerPath, markerBackup));
    writeFileSync(lease.markerPath, '{"forged":true}\n');
    forgedIdentity = identity(lstatSync(lease.markerPath, { bigint: true }));
    if (lease.cleanup().ok) throw new Error('marker replacement 被 cleanup 错删');
    if (!existsSync(lease.caseDir) || !existsSync(lease.markerPath)) throw new Error('marker replacement 未 fail-safe 留存');
  } finally {
    if (existsSync(lease.markerPath)
      && identity(lstatSync(lease.markerPath, { bigint: true })) === forgedIdentity) unlinkSync(lease.markerPath);
    if (existsSync(markerBackup) && !existsSync(lease.markerPath)) retryOnTransientFsRace(() => renameSync(markerBackup, lease.markerPath));
    safeCleanup(lease, 'marker replacement probe');
  }

  lease = acquireCanonicalCaseLease({ caseId: LEASE_PROBE_ID });
  const backupDir = `${lease.caseDir}.owned-backup-${process.pid}`;
  const ownedIdentity = identity(lstatSync(lease.caseDir, { bigint: true }));
  let replacementIdentity = null;
  try {
    if (existsSync(backupDir)) throw new Error('probe backup path 预存，拒绝触碰');
    retryOnTransientFsRace(() => renameSync(lease.caseDir, backupDir));
    retryOnTransientFsRace(() => mkdirSync(lease.caseDir));
    replacementIdentity = identity(lstatSync(lease.caseDir, { bigint: true }));
    if (lease.cleanup().ok) throw new Error('directory replacement 被 cleanup 错删');
    if (!existsSync(lease.caseDir)) throw new Error('directory replacement 未 fail-safe 留存');
  } finally {
    if (existsSync(lease.caseDir)
      && identity(lstatSync(lease.caseDir, { bigint: true })) === replacementIdentity) retryOnTransientFsRace(() => rmdirSync(lease.caseDir));
    if (existsSync(backupDir) && !existsSync(lease.caseDir)
      && identity(lstatSync(backupDir, { bigint: true })) === ownedIdentity) retryOnTransientFsRace(() => renameSync(backupDir, lease.caseDir));
    safeCleanup(lease, 'directory replacement probe');
  }

  const external = prepareOffRoot();
  lease = acquireCanonicalCaseLease({ caseId: CASE_ID });
  try {
    symlinkSync(external.packageDir, lease.packageDir, 'dir');
    const capturePath = join(lease.packageDir, 'teach-in-capture.json');
    assertDenied(rootApi.appendAcceptedObservationPackage({ caseId: CASE_ID, capturePath }), 'packageDir symlink');
    if (existsSync(join(external.packageDir, 'intake-ledger.jsonl'))) throw new Error('packageDir symlink 改写外部 ledger');
  } finally {
    safeCleanup(lease, 'packageDir symlink probe');
    external.cleanup();
  }
});

await check('T3 ledger symlink/hardlink 拒绝且外部目标字节不变', () => {
  let p = prepareCanonical();
  try {
    const ledgerPath = join(p.packageDir, 'intake-ledger.jsonl');
    const target = join(p.caseDir, 'symlink-ledger-target');
    const before = 'external-symlink-sentinel\n';
    writeFileSync(target, before);
    symlinkSync(target, ledgerPath, 'file');
    assertDenied(appendPackage(p), 'ledger symlink');
    if (readFileSync(target, 'utf8') !== before) throw new Error('ledger symlink 外部目标被改写');
  } finally { p.cleanup(); }

  p = prepareCanonical();
  try {
    const ledgerPath = join(p.packageDir, 'intake-ledger.jsonl');
    const target = join(p.caseDir, 'hardlink-ledger-target');
    const before = 'external-hardlink-sentinel\n';
    writeFileSync(target, before);
    linkSync(target, ledgerPath);
    assertDenied(appendPackage(p), 'ledger hardlink');
    if (readFileSync(target, 'utf8') !== before) throw new Error('ledger hardlink 外部目标被改写');
  } finally { p.cleanup(); }
});

await check('T4 malformed receipt 在 commit 前拒绝且零 accepted residue', () => {
  const p = prepareCanonical();
  try {
    writeFileSync(join(p.packageDir, 'identity-readback-receipt.json'), '{not-json}\n');
    assertAppendDeniedNoResidue(p, 'malformed receipt');
  } finally { p.cleanup(); }
});

await check('T5 malformed ledger 在 commit 前拒绝且字节不变', () => {
  const p = prepareCanonical();
  try {
    const ledgerPath = join(p.packageDir, 'intake-ledger.jsonl');
    const before = '{not-json}\n';
    writeFileSync(ledgerPath, before);
    assertDenied(appendPackage(p), 'malformed ledger');
    if (readFileSync(ledgerPath, 'utf8') !== before) throw new Error('malformed ledger 拒绝后字节改变');
    assertNoAcceptedResidue(p, 'malformed ledger', { allowLedger: true });
  } finally { p.cleanup(); }
});

await check('T6 lock 占用零写；正向只产唯一 bounded committed transaction', () => {
  let p = prepareCanonical();
  try {
    const ledgerPath = join(p.packageDir, 'intake-ledger.jsonl');
    const lockPath = `${ledgerPath}.lock`;
    writeFileSync(lockPath, 'other-owner\n');
    assertDenied(appendPackage(p), 'occupied lock');
    if (existsSync(ledgerPath) || readFileSync(lockPath, 'utf8') !== 'other-owner\n') throw new Error('锁占用仍写 ledger 或删除他人锁');
  } finally { p.cleanup(); }

  p = prepareCanonical();
  try {
    const result = appendPackage(p);
    if (!result?.ok || !result.authority) throw new Error(`正向 append 失败：${result?.reason || 'UNKNOWN'}`);
    const raw = readFileSync(join(p.packageDir, 'intake-ledger.jsonl'), 'utf8');
    const lines = raw.trimEnd().split('\n');
    if (lines.length !== 1 || Buffer.byteLength(lines[0], 'utf8') > LIMITS.maxLedgerLineBytes) throw new Error('ledger 行数/字节上限不符');
    const row = JSON.parse(lines[0]);
    const payload = { ...row };
    delete payload.transactionSha256;
    if (row.transactionState !== 'committed' || row.ledgerGeneration !== 1
      || hash(JSON.stringify(payload)) !== row.transactionSha256) throw new Error('committed transaction 不闭合');
  } finally { p.cleanup(); }
});

await check('T7 consumer 只认 committed transaction，pending/legacy 拒绝', () => {
  const p = prepareCanonical();
  try {
    const review = packageReview(p);
    const base = {
      schemaVersion: 1,
      event: 'intake',
      intakeStatus: 'accepted',
      caseId: p.caseId,
      captureSha256: review.captureSha256,
      sidecarSha256: review.sidecarSha256,
      manifestSha256: review.manifestSha256,
      observationCount: review.observationCount,
      observationSchemaVersion: review.observationSchemaVersion,
    };
    const verifyRows = (ledgerEntries) => intakeApi.verifyIntakenPackage({
      caseId: p.caseId,
      ledgerEntries,
      packageAuthority: review.authority,
      currentCaptureSha256: review.captureSha256,
      currentSidecarSha256: review.sidecarSha256,
      currentManifestSha256: review.manifestSha256,
      observationCount: review.observationCount,
      observationSchemaVersion: review.observationSchemaVersion,
    });
    if (verifyRows([{ ...base, transactionState: 'pending', transactionId: 'pending', ledgerGeneration: 1 }]).ok) {
      throw new Error('consumer 接受 pending');
    }
    if (verifyRows([base]).ok) throw new Error('consumer 接受 legacy accepted');
  } finally { p.cleanup(); }
});

await check('T8 A receipt + B authority 同 bytes/identity 仍因私有 transaction token 拒绝', () => {
  let p = prepareCanonical();
  let receiptA;
  try {
    const authorityA = acceptedFor(p);
    const readbackA = readDriverReceipt(p, authorityA);
    if (!readbackA?.ok || !readbackA.receipt) throw new Error('A receipt 前提失败');
    receiptA = readbackA.receipt;
  } finally { p.cleanup(); }

  p = prepareCanonical();
  try {
    const authorityB = acceptedFor(p);
    assertDenied(rootApi.verifyObservationTransactionPair({
      acceptedIntakeAuthority: authorityB,
      platformReadbackReceipt: receiptA,
    }), 'A receipt + B authority');
    if (identityReview(p, authorityB, receiptA)?.trusted === true) throw new Error('identity consumer 错误拼接跨事务 facts');
  } finally { p.cleanup(); }
});

await check('T9 safe-own-data 执行 MAX_ITEMS/MAX_DEPTH/MAX_KEYS/MAX_BYTES 与全局展开预算', () => {
  const actual = safeApi.SAFE_OWN_DATA_LIMITS;
  if (!actual || actual.MAX_ITEMS !== LIMITS.maxItems || actual.MAX_DEPTH !== LIMITS.maxDepth
    || actual.MAX_KEYS !== LIMITS.maxKeys || actual.MAX_BYTES !== LIMITS.maxBytes) throw new Error('SAFE_OWN_DATA_LIMITS 漂移');
  expectThrow(() => safeApi.snapshotPlainOwnData(Array.from({ length: LIMITS.maxItems + 1 }, () => 0)), 'MAX_ITEMS');
  expectThrow(() => safeApi.snapshotPlainOwnData(Object.fromEntries(Array.from({ length: LIMITS.maxKeys + 1 }, (_, i) => [`k${i}`, i]))), 'MAX_KEYS');
  expectThrow(() => safeApi.snapshotPlainOwnData(Buffer.alloc(LIMITS.maxBytes + 1)), 'MAX_BYTES');
  let deep = null;
  for (let i = 0; i < LIMITS.maxDepth + 1; i += 1) deep = { next: deep };
  expectThrow(() => safeApi.snapshotPlainOwnData(deep), 'MAX_DEPTH');
  const shared = { values: Array.from({ length: 256 }, () => 0) };
  expectThrow(() => safeApi.snapshotPlainOwnData([shared, shared, shared, shared, shared]), '共享 DAG 全局 items 预算');
});

await check('T10 巨稀疏数组快速拒；identity 复用共享 bounded snapshot', () => {
  const safeSource = readFileSync(new URL('../../lib/safe-own-data.mjs', import.meta.url), 'utf8');
  const identitySource = readFileSync(new URL('../../lib/teachin-identity-observations.mjs', import.meta.url), 'utf8');
  if (/Array\.from\s*\(\s*\{\s*length\s*\}/.test(safeSource)
    || /function\s+snapshotPlainOwnData\s*\(/.test(identitySource)
    || !/from ['"]\.\/safe-own-data\.mjs['"]/.test(identitySource)) throw new Error('snapshot source 未共享或按 length 分配');
  const sparse = [];
  sparse.length = 0xffff_ffff;
  expectThrow(() => safeApi.snapshotPlainOwnData(sparse), '巨大稀疏数组');
  const observations = Array.from({ length: LIMITS.maxItems + 1 }, (_, index) => observation({ eventSeq: index + 1 }));
  expectThrow(() => identityApi.buildIdentityObservationSidecar({ caseId: CASE_ID, observations }), 'identity MAX_ITEMS');
});

// ---------- driver canonical-root successor：7 组 ----------

await check('D1 plain source=platform-runtime 在 append 前拒绝且零 residue', () => {
  const p = prepareCanonical();
  try {
    installEnvelope(p, plainReceipt());
    assertAppendDeniedNoResidue(p, 'plain receipt');
  } finally { p.cleanup(); }
});

await check('D2 fixed registry 唯一扩根；调用者 key/registry/自签拒绝', () => {
  if (registryApi.trustedDriverPublicKeyFor(SIGNED.keyId) !== TRUSTED_PUBLIC_KEY
    || registryApi.trustedDriverPublicKeyFor('attacker-key') != null) throw new Error('fixed registry 漂移');
  const attacker = generateKeyPairSync('ed25519');
  const p = prepareCanonical();
  try {
    const payload = { ...canonicalPayload(SIGNED), keyId: 'attacker-key' };
    installEnvelope(p, { ...payload, signature: sign(null, canonicalPayloadBytes(payload), attacker.privateKey).toString('base64') });
    assertAppendDeniedNoResidue(p, '攻击者自签');
    copyFileSync(SIGNED_PATH, join(p.packageDir, 'identity-readback-receipt.json'));
    assertAppendDeniedNoResidue(p, '调用者 publicKey', { publicKey: attacker.publicKey.export({ type: 'spki', format: 'pem' }) });
    assertAppendDeniedNoResidue(p, '调用者 registry', { trustedDriverRegistry: { attacker: 'pem' } });
    const trustedIdPayload = { ...payload, keyId: SIGNED.keyId };
    installEnvelope(p, {
      ...trustedIdPayload,
      signature: sign(null, canonicalPayloadBytes(trustedIdPayload), attacker.privateKey).toString('base64'),
    });
    assertAppendDeniedNoResidue(p, '可信 keyId + 攻击者签名');
  } finally { p.cleanup(); }
});

await check('D3 signed Ed25519 正向 opaque pair + identity trusted', () => {
  const base = bundle();
  for (const [key, value] of Object.entries({
    captureSha256: hash(base.captureRaw),
    sidecarSha256: hash(base.observationRaw),
    manifestSha256: hash(base.manifestRaw),
  })) if (SIGNED[key] !== value) throw new Error(`${key} fixture 漂移`);
  if (!verify(null, canonicalPayloadBytes(SIGNED), createPublicKey(TRUSTED_PUBLIC_KEY), Buffer.from(SIGNED.signature, 'base64'))) {
    throw new Error('冻结 signed fixture 数学验签失败');
  }
  const p = prepareCanonical();
  try {
    const authority = acceptedFor(p);
    opaque(authority, 'accepted authority');
    const readback = readDriverReceipt(p, authority);
    if (!readback?.ok || !readback.receipt) throw new Error(`driver receipt 失败：${readback?.reason || 'UNKNOWN'}`);
    opaque(readback.receipt, 'driver receipt');
    const pair = rootApi.verifyObservationTransactionPair({
      acceptedIntakeAuthority: authority,
      platformReadbackReceipt: readback.receipt,
    });
    if (!pair?.ok || JSON.stringify(pair).includes('transactionToken')) throw new Error('joint pair 失败或泄漏 token');
    const trusted = identityReview(p, authority, readback.receipt);
    if (!trusted?.ok || trusted.trusted !== true || trusted.replayReady !== false) throw new Error(JSON.stringify(trusted));
  } finally { p.cleanup(); }
});

await check('D4 全 payload/signature/keyId/缺签篡改在 commit 前拒', () => {
  const mutations = [
    ['schemaVersion', 2], ['artifactKind', 'other'], ['source', 'caller'], ['keyId', 'unknown'],
    ['algorithm', 'RSA'], ['sessionNonce', 'mutated'], ['caseId', OTHER_CASE_ID],
    ['captureSha256', `sha256:${'1'.repeat(64)}`], ['sidecarSha256', `sha256:${'2'.repeat(64)}`],
    ['manifestSha256', `sha256:${'3'.repeat(64)}`], ['eventSeq', 2], ['kind', 'agent'],
    ['name', '另一个工作流'], ['code', 'wf-002'], ['platformId', '90071992547409939999'],
    ['scopeFingerprint', `sha256:${'4'.repeat(64)}`], ['evidenceSha256', `sha256:${'5'.repeat(64)}`],
    ['signature', `${SIGNED.signature.slice(0, -2)}AA`],
  ];
  const p = prepareCanonical();
  try {
    for (const [field, value] of mutations) {
      installEnvelope(p, { ...SIGNED, [field]: value });
      assertAppendDeniedNoResidue(p, `${field} 篡改`);
    }
    const missing = { ...SIGNED };
    delete missing.signature;
    installEnvelope(p, missing);
    assertAppendDeniedNoResidue(p, '缺 signature');
  } finally { p.cleanup(); }
});

await check('D5 signed receipt 跨 package/case 拒绝且零 accepted residue', () => {
  let p = prepareCanonical({ events: [{ action: 'click', path: '/ai-manager/process/list', text: '另一次录制' }] });
  try { assertAppendDeniedNoResidue(p, '跨 package'); }
  finally { p.cleanup(); }
  p = prepareCanonical();
  try {
    assertDenied(rootApi.appendAcceptedObservationPackage({ caseId: OTHER_CASE_ID, capturePath: p.capturePath }), '跨 case');
    assertNoAcceptedResidue(p, '跨 case');
  } finally { p.cleanup(); }
});

function countedProxy(target) {
  let calls = 0;
  const count = (fn) => (...args) => { calls += 1; return fn(...args); };
  const value = new Proxy(target, {
    get: count(Reflect.get), has: count(Reflect.has), ownKeys: count(Reflect.ownKeys),
    getOwnPropertyDescriptor: count(Reflect.getOwnPropertyDescriptor), getPrototypeOf: count(Reflect.getPrototypeOf),
  });
  if (!isProxy(value)) throw new Error('测试前提：Node 未识别 Proxy');
  return { value, calls: () => calls };
}
function accessorObject(key = 'brand') {
  let calls = 0;
  const value = {};
  Object.defineProperty(value, key, { enumerable: true, get() { calls += 1; return 'forged'; } });
  return { value, calls: () => calls };
}
function rejectWithoutExecution(label, wrapped, fn) {
  let result;
  try { result = fn(wrapped.value); } catch { result = null; }
  assertDenied(result, label);
  if (wrapped.calls() !== 0) throw new Error(`${label} 执行 ${wrapped.calls()} 次 trap/getter`);
}

await check('D6 append/reader/pair/identity/registry Proxy/accessor 零执行', () => {
  let p = prepareCanonical();
  try {
    const topProxy = countedProxy({ caseId: p.caseId, capturePath: p.capturePath });
    rejectWithoutExecution('append top Proxy', topProxy, (value) => rootApi.appendAcceptedObservationPackage(value));
    const topAccessor = accessorObject('caseId');
    rejectWithoutExecution('append top accessor', topAccessor, (value) => rootApi.appendAcceptedObservationPackage(value));
    const keyProxy = countedProxy({});
    rejectWithoutExecution('caller key Proxy', keyProxy, (value) => appendPackage(p, { publicKey: value }));
    const keyAccessor = accessorObject();
    rejectWithoutExecution('caller key accessor', keyAccessor, (value) => appendPackage(p, { publicKey: value }));
    assertNoAcceptedResidue(p, 'append Proxy/accessor');
  } finally { p.cleanup(); }
  p = prepareCanonical();
  try {
    const authority = acceptedFor(p);
    const readback = readDriverReceipt(p, authority);
    if (!readback?.ok || !readback.receipt) throw new Error('receipt 前提失败');
    const authorityProxy = countedProxy({});
    rejectWithoutExecution('reader authority Proxy', authorityProxy, (value) => readDriverReceipt(p, value));
    const authorityAccessor = accessorObject();
    rejectWithoutExecution('reader authority accessor', authorityAccessor, (value) => readDriverReceipt(p, value));
    const receiptProxy = countedProxy({});
    rejectWithoutExecution('identity receipt Proxy', receiptProxy, (value) => identityReview(p, authority, value));
    const receiptAccessor = accessorObject();
    rejectWithoutExecution('pair receipt accessor', receiptAccessor, (value) => rootApi.verifyObservationTransactionPair({
      acceptedIntakeAuthority: authority,
      platformReadbackReceipt: value,
    }));
    const registryProxy = countedProxy({});
    rejectWithoutExecution('registry Proxy', registryProxy, (value) => registryApi.trustedDriverPublicKeyFor(value));
    const registryAccessor = accessorObject();
    rejectWithoutExecution('registry accessor', registryAccessor, (value) => registryApi.trustedDriverPublicKeyFor(value));
  } finally { p.cleanup(); }
});

await check('D7 旧 unsafe frozen 只校 checksum；v2 supersession/support 非空', () => {
  for (const prdPath of [
    'loop/prd-teachin-observation-transaction-root.json',
    'loop/prd-teachin-observation-driver-canonical-root.json',
  ]) {
    const prd = JSON.parse(readFileSync(prdPath, 'utf8'));
    for (const [path, expected] of Object.entries(prd.testChecksums || {})) {
      if (sha256(readFileSync(path)) !== expected) throw new Error(`旧 frozen checksum 变化：${path}`);
    }
  }
  const receipt = JSON.parse(readFileSync(SUPERSESSION_PATH, 'utf8'));
  if (receipt?.successorTask !== 'teachin-observation-safe-case-lease-v2'
    || receipt?.safeLeaseSupport !== 'tests/_golden/support/canonical-case-lease.mjs'
    || receipt?.oldFrozenAssetsImmutable !== true
    || receipt?.oldUnsafeGoldensExecutable !== false
    || !Array.isArray(receipt.unsafeGoldens) || receipt.unsafeGoldens.length !== 2) {
    throw new Error('v2 supersession receipt 不闭合');
  }
  const ownSource = readFileSync(new URL('./teachin-observation-safe-case-lease-v2.zero-sut.golden.mjs', import.meta.url), 'utf8');
  const supportSource = readFileSync(new URL('./support/canonical-case-lease.mjs', import.meta.url), 'utf8');
  if (/from ['"].*teachin-observation-(?:transaction-root|driver-canonical-root).*golden/.test(ownSource)
    || /rmSync\s*\(\s*(?:CASE_DIR|join\(CASES_DIR)/.test(ownSource)
    || !/O_EXCL/.test(supportSource) || !/markerIdentity/.test(supportSource) || !/dirIdentity/.test(supportSource)) {
    throw new Error('v2 仍调用 unsafe golden 或 lease support 缺 ownership 绑定');
  }
  if (CASES_DIR !== join(PROJECT_ROOT, 'cases') || CASE_LEASE_MARKER !== '.casey-golden-case-lease.json') {
    throw new Error('v2 canonical root/marker 漂移');
  }
});

if (failures.length) {
  for (const failure of failures) console.error(`FAIL  teachin-observation-safe-case-lease-v2: ${failure}`);
  console.error(`FAIL  teachin-observation-safe-case-lease-v2: ${passed} 过 / ${failures.length} 失败`);
  process.exit(1);
}
console.log(`ok   teachin-observation-safe-case-lease-v2: ${passed}/${passed} 全过（10 transaction + 7 driver，零 SUT）`);
