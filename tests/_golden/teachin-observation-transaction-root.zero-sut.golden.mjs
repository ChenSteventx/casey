#!/usr/bin/env node
// 冻结验收：固定 PROJECT_ROOT/cases 根、有界原子 committed ledger、accepted+receipt 同事务能力，
// 以及 safe-own-data 四维上限。只使用本地文件/纯函数/冻结公开 fixture；禁止 SUT/browser/network。

import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as packageApi from '../../lib/entity-semantic-lock-package.mjs';
import * as intakeApi from '../../lib/record-distill.mjs';
import * as identityApi from '../../lib/teachin-identity-observations.mjs';
import * as rootApi from '../../lib/teachin-observation-authority-root.mjs';
import * as safeApi from '../../lib/safe-own-data.mjs';
import { buildTeachInCapture } from '../../lib/record-capture.mjs';
import { CASES_DIR, PROJECT_ROOT } from '../../lib/paths.mjs';

let passed = 0;
const failures = [];
async function check(name, fn) {
  try { await fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
}
function assertDenied(result, label) {
  if (result?.ok === true || result?.trusted === true || result?.authority || result?.receipt) {
    throw new Error(`${label} 被错误授权`);
  }
}
function expectThrow(fn, label) {
  let error = null;
  try { fn(); } catch (caught) { error = caught; }
  if (!error) throw new Error(`${label} 未拒绝`);
}
function hash(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

const CASE_ID = 'tc_observation_driver_provenance';
const SCOPE = `sha256:${'a'.repeat(64)}`;
const EVIDENCE = `sha256:${'c'.repeat(64)}`;
const CANONICAL_CASE_DIR = join(CASES_DIR, CASE_ID);
const LIMITS_PATH = fileURLToPath(new URL(
  './fixtures/teachin-observation-transaction-root/limits.json',
  import.meta.url,
));
const SIGNED_RECEIPT_PATH = fileURLToPath(new URL(
  './fixtures/teachin-observation-driver-provenance/identity-readback-receipt.signed.json',
  import.meta.url,
));
const LIMITS = JSON.parse(readFileSync(LIMITS_PATH, 'utf8'));
const AUTHORITY_SOURCE = readFileSync(new URL('../../lib/teachin-observation-authority-root.mjs', import.meta.url), 'utf8');
const SAFE_SOURCE = readFileSync(new URL('../../lib/safe-own-data.mjs', import.meta.url), 'utf8');
const IDENTITY_SOURCE = readFileSync(new URL('../../lib/teachin-identity-observations.mjs', import.meta.url), 'utf8');
const GOOD_PATHS = {
  capture: { regularFile: true, symbolicLink: false, parentSymbolicLink: false, identityBefore: 'cap-1', identityAfter: 'cap-1' },
  observations: { regularFile: true, symbolicLink: false, parentSymbolicLink: false, identityBefore: 'obs-1', identityAfter: 'obs-1' },
};

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
function buildBundle({ caseId = CASE_ID, marker = '审批工作流' } = {}) {
  const sidecar = identityApi.buildIdentityObservationSidecar({ caseId, observations: [observation()] });
  const observationRaw = identityApi.serializeIdentityObservationSidecar(sidecar);
  const capture = identityApi.bindCaptureIdentityObservations({
    capture: buildTeachInCapture({
      caseId,
      startUrl: '/ai-manager/process/list',
      createdAt: '2026-07-17T00:00:00.000Z',
      events: [{ action: 'click', path: '/ai-manager/process/list', text: marker }],
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
  const manifestRaw = packageApi.serializeTeachInPackageManifest(manifest);
  return { caseId, captureRaw, observationRaw, manifestRaw };
}
function writePackage(packageDir, options = {}) {
  const built = buildBundle(options);
  mkdirSync(packageDir, { recursive: true });
  const capturePath = join(packageDir, 'teach-in-capture.json');
  writeFileSync(capturePath, built.captureRaw);
  writeFileSync(join(packageDir, 'identity-observations.json'), built.observationRaw);
  writeFileSync(join(packageDir, 'teach-in-package.json'), built.manifestRaw);
  copyFileSync(SIGNED_RECEIPT_PATH, join(packageDir, 'identity-readback-receipt.json'));
  return { packageDir, capturePath, ...built };
}
function prepareCanonical(options = {}) {
  rmSync(CANONICAL_CASE_DIR, { recursive: true, force: true });
  const p = writePackage(join(CANONICAL_CASE_DIR, 'record-capture'), options);
  return { ...p, caseDir: CANONICAL_CASE_DIR, cleanup: () => rmSync(CANONICAL_CASE_DIR, { recursive: true, force: true }) };
}
function prepareOffRoot(options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'casey-observation-transaction-'));
  const p = writePackage(join(root, CASE_ID, 'record-capture'), options);
  return { ...p, root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}
function append(p) {
  return rootApi.appendAcceptedObservationPackage({ caseId: p.caseId, capturePath: p.capturePath });
}
function accepted(p) {
  const result = append(p);
  if (!result?.ok || !result.authority) throw new Error(`accepted 前提失败：${result?.reason || 'UNKNOWN'}`);
  return result.authority;
}
function plainReceipt(caseId = CASE_ID) {
  return {
    schemaVersion: 1,
    artifactKind: 'platform-identity-readback-receipt',
    source: 'platform-runtime',
    caseId,
    eventSeq: 1,
    kind: 'workflow',
    name: '审批工作流',
    code: 'wf-001',
    platformId: '90071992547409931234',
    scopeFingerprint: SCOPE,
    evidenceSha256: EVIDENCE,
  };
}
function mintCompatibleReceipt(p, authority) {
  // 新 driver-provenance 实现应走冻结 signed fixture；基线实现只认旧 plain receipt。
  copyFileSync(SIGNED_RECEIPT_PATH, join(p.packageDir, 'identity-readback-receipt.json'));
  let result = rootApi.readPlatformIdentityReadbackReceipt({
    caseId: p.caseId,
    capturePath: p.capturePath,
    acceptedIntakeAuthority: authority,
  });
  if (!result?.ok) {
    writeFileSync(join(p.packageDir, 'identity-readback-receipt.json'), `${JSON.stringify(plainReceipt(p.caseId), null, 2)}\n`);
    result = rootApi.readPlatformIdentityReadbackReceipt({
      caseId: p.caseId,
      capturePath: p.capturePath,
      acceptedIntakeAuthority: authority,
    });
  }
  if (!result?.ok || !result.receipt) throw new Error(`receipt 前提失败：${result?.reason || 'UNKNOWN'}`);
  return result.receipt;
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

await check('A1 同形 /tmp package 不得扩张固定 PROJECT_ROOT/cases 信任根', () => {
  if (CASES_DIR !== join(PROJECT_ROOT, 'cases')) throw new Error('CASES_DIR_NOT_FIXED_PROJECT_ROOT');
  const p = prepareOffRoot();
  try {
    assertDenied(append(p), 'off-root package');
    if (existsSync(join(p.packageDir, 'intake-ledger.jsonl'))) throw new Error('off-root 拒绝后遗留 ledger');
  } finally { p.cleanup(); }
});

await check('A2 case/package 任一祖先 symlink 逃逸均拒且外部目录不留 ledger', () => {
  rmSync(CANONICAL_CASE_DIR, { recursive: true, force: true });
  const external = prepareOffRoot();
  try {
    mkdirSync(dirname(CANONICAL_CASE_DIR), { recursive: true });
    symlinkSync(join(external.root, CASE_ID), CANONICAL_CASE_DIR, 'dir');
    assertDenied(rootApi.appendAcceptedObservationPackage({ caseId: CASE_ID, capturePath: join(CANONICAL_CASE_DIR, 'record-capture', 'teach-in-capture.json') }), 'caseDir symlink');
    if (existsSync(join(external.packageDir, 'intake-ledger.jsonl'))) throw new Error('caseDir symlink 拒绝后改写外部目录');
    rmSync(CANONICAL_CASE_DIR, { recursive: true, force: true });

    mkdirSync(CANONICAL_CASE_DIR, { recursive: true });
    symlinkSync(external.packageDir, join(CANONICAL_CASE_DIR, 'record-capture'), 'dir');
    assertDenied(rootApi.appendAcceptedObservationPackage({ caseId: CASE_ID, capturePath: join(CANONICAL_CASE_DIR, 'record-capture', 'teach-in-capture.json') }), 'packageDir symlink');
    if (existsSync(join(external.packageDir, 'intake-ledger.jsonl'))) throw new Error('packageDir symlink 拒绝后改写外部目录');
  } finally {
    rmSync(CANONICAL_CASE_DIR, { recursive: true, force: true });
    external.cleanup();
  }
});

await check('B1 ledger symlink/hardlink 拒绝且外部目标字节不变', () => {
  let p = prepareCanonical();
  try {
    const ledgerPath = join(p.packageDir, 'intake-ledger.jsonl');
    const target = join(p.caseDir, 'symlink-ledger-target');
    const before = 'external-symlink-sentinel\n';
    writeFileSync(target, before);
    symlinkSync(target, ledgerPath, 'file');
    assertDenied(append(p), 'ledger symlink');
    if (readFileSync(target, 'utf8') !== before) throw new Error('ledger symlink 外部目标被改写');
  } finally { p.cleanup(); }

  p = prepareCanonical();
  try {
    const ledgerPath = join(p.packageDir, 'intake-ledger.jsonl');
    const target = join(p.caseDir, 'hardlink-ledger-target');
    const before = 'external-hardlink-sentinel\n';
    writeFileSync(target, before);
    linkSync(target, ledgerPath);
    assertDenied(append(p), 'ledger hardlink');
    if (readFileSync(target, 'utf8') !== before) throw new Error('ledger hardlink 外部目标被改写');
  } finally { p.cleanup(); }
});

await check('B2 receipt 校验拒绝发生在 commit 前，malformed receipt 零 accepted 残留', () => {
  const p = prepareCanonical();
  try {
    const ledgerPath = join(p.packageDir, 'intake-ledger.jsonl');
    writeFileSync(join(p.packageDir, 'identity-readback-receipt.json'), '{not-json}\n');
    assertDenied(append(p), 'malformed receipt');
    if (existsSync(ledgerPath)) throw new Error('receipt 拒绝后遗留 accepted ledger');
  } finally { p.cleanup(); }
});

await check('B3 package/ledger 校验拒绝发生在 commit 前，malformed ledger 零 accepted 残留', () => {
  const p = prepareCanonical();
  try {
    const ledgerPath = join(p.packageDir, 'intake-ledger.jsonl');
    const before = '{not-json}\n';
    writeFileSync(ledgerPath, before);
    assertDenied(append(p), 'malformed ledger');
    const after = readFileSync(ledgerPath, 'utf8');
    if (after !== before || after.includes('"intakeStatus":"accepted"')) throw new Error('拒绝路径残留 accepted 字节');
  } finally { p.cleanup(); }
});

await check('B4 lock 占用时零写；正向只产一条有界 committed transaction', () => {
  let p = prepareCanonical();
  try {
    const ledgerPath = join(p.packageDir, 'intake-ledger.jsonl');
    writeFileSync(`${ledgerPath}.lock`, 'owned\n');
    assertDenied(append(p), 'occupied transaction lock');
    if (existsSync(ledgerPath)) throw new Error('锁占用时仍创建 ledger');
  } finally { p.cleanup(); }

  p = prepareCanonical();
  try {
    const result = append(p);
    if (!result?.ok || !result.authority) throw new Error(`committed 正向失败：${result?.reason || 'UNKNOWN'}`);
    const raw = readFileSync(join(p.packageDir, 'intake-ledger.jsonl'), 'utf8');
    const lines = raw.trimEnd().split('\n');
    if (lines.length !== 1 || Buffer.byteLength(lines[0], 'utf8') > LIMITS.maxLedgerLineBytes) throw new Error('ledger 行数或字节上限不符');
    const row = JSON.parse(lines[0]);
    if (row.transactionState !== 'committed'
      || typeof row.transactionId !== 'string' || !row.transactionId
      || !Number.isSafeInteger(row.ledgerGeneration) || row.ledgerGeneration < 1
      || !/^sha256:[a-f0-9]{64}$/.test(row.transactionSha256 || '')) throw new Error('committed transaction 字段不完整');
    const payload = { ...row };
    delete payload.transactionSha256;
    if (hash(JSON.stringify(payload)) !== row.transactionSha256) throw new Error('transactionSha256 未绑定 committed 单行');
    if (!AUTHORITY_SOURCE.includes('fsyncSync') || !/O_EXCL/.test(AUTHORITY_SOURCE)
      || /appendIntakeLedger\s*\(\s*\{/.test(AUTHORITY_SOURCE)) throw new Error('事务根未冻结排他锁/fsync/非 legacy append 路径');
  } finally { p.cleanup(); }
});

await check('B5 consumer 只认 committed transaction，pending/缺事务字段均拒', () => {
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
    const verify = (ledgerEntries) => intakeApi.verifyIntakenPackage({
      caseId: p.caseId,
      ledgerEntries,
      packageAuthority: review.authority,
      currentCaptureSha256: review.captureSha256,
      currentSidecarSha256: review.sidecarSha256,
      currentManifestSha256: review.manifestSha256,
      observationCount: review.observationCount,
      observationSchemaVersion: review.observationSchemaVersion,
    });
    if (verify([{ ...base, transactionState: 'pending', transactionId: 'pending', ledgerGeneration: 1 }]).ok) {
      throw new Error('consumer 接受 pending transaction');
    }
    if (verify([base]).ok) throw new Error('consumer 接受缺事务字段的 legacy accepted 行');
  } finally { p.cleanup(); }
});

await check('C1 A receipt + B authority 即使 case/identity 字段相同也拒', () => {
  const a = prepareCanonical({ marker: '审批工作流' });
  let receiptA;
  try {
    const authorityA = accepted(a);
    receiptA = mintCompatibleReceipt(a, authorityA);
    if (typeof rootApi.verifyObservationTransactionPair !== 'function') throw new Error('JOINT_TRANSACTION_PAIR_API_MISSING');
    const same = rootApi.verifyObservationTransactionPair({
      acceptedIntakeAuthority: authorityA,
      platformReadbackReceipt: receiptA,
    });
    if (!same?.ok || JSON.stringify(same).includes('transactionToken')) throw new Error('同事务联合验证失败或泄漏私有 token');
  } finally { a.cleanup(); }

  // B 是在同一 canonical path 重建的另一事务；三件套与 identity 字段可完全相同，私有 token 仍必须不同。
  const b = prepareCanonical({ marker: '审批工作流' });
  try {
    const authorityB = accepted(b);
    assertDenied(rootApi.verifyObservationTransactionPair({
      acceptedIntakeAuthority: authorityB,
      platformReadbackReceipt: receiptA,
    }), 'A receipt + B authority');
    const mixed = identityReview(b, authorityB, receiptA);
    if (mixed?.trusted === true) throw new Error('identity consumer 拼接两份 plain facts 后错误 trusted');
  } finally { b.cleanup(); }
});

await check('D1 safe-own-data 明确执行 MAX_ITEMS/MAX_DEPTH/MAX_KEYS/MAX_BYTES', () => {
  const actual = safeApi.SAFE_OWN_DATA_LIMITS;
  if (!actual || actual.MAX_ITEMS !== LIMITS.maxItems || actual.MAX_DEPTH !== LIMITS.maxDepth
    || actual.MAX_KEYS !== LIMITS.maxKeys || actual.MAX_BYTES !== LIMITS.maxBytes) {
    throw new Error('SAFE_OWN_DATA_LIMITS_MISSING_OR_DRIFTED');
  }
  expectThrow(() => safeApi.snapshotPlainOwnData(Array.from({ length: LIMITS.maxItems + 1 }, () => 0)), 'MAX_ITEMS');
  expectThrow(() => safeApi.snapshotPlainOwnData(Object.fromEntries(Array.from({ length: LIMITS.maxKeys + 1 }, (_, i) => [`k${i}`, i]))), 'MAX_KEYS');
  expectThrow(() => safeApi.snapshotPlainOwnData(Buffer.alloc(LIMITS.maxBytes + 1)), 'MAX_BYTES');
  let deep = null;
  for (let i = 0; i < LIMITS.maxDepth + 1; i += 1) deep = { next: deep };
  expectThrow(() => safeApi.snapshotPlainOwnData(deep), 'MAX_DEPTH');
});

await check('D2 巨稀疏数组不得按 length 构造全集；identity 复用同一有界 snapshot', () => {
  if (/Array\.from\s*\(\s*\{\s*length\s*\}/.test(SAFE_SOURCE)
    || /Array\.from\s*\(\s*\{\s*length\s*\}/.test(IDENTITY_SOURCE)) {
    throw new Error('SOURCE_ENUMERATES_DECLARED_ARRAY_LENGTH');
  }
  if (/function\s+snapshotPlainOwnData\s*\(/.test(IDENTITY_SOURCE)
    || !/from ['"]\.\/safe-own-data\.mjs['"]/.test(IDENTITY_SOURCE)) {
    throw new Error('IDENTITY_DUPLICATES_SAFE_SNAPSHOT');
  }
  const sparse = [];
  sparse.length = 0xffff_ffff;
  expectThrow(() => safeApi.snapshotPlainOwnData(sparse), '巨大稀疏数组');
  const observations = Array.from({ length: LIMITS.maxItems + 1 }, (_, index) => observation({ eventSeq: index + 1 }));
  expectThrow(() => identityApi.buildIdentityObservationSidecar({ caseId: CASE_ID, observations }), 'identity MAX_ITEMS');
});

rmSync(CANONICAL_CASE_DIR, { recursive: true, force: true });
console.log(`\n${passed}/${passed + failures.length} checks passed`);
if (failures.length) {
  console.error(failures.map((item) => `- ${item}`).join('\n'));
  process.exit(1);
}
