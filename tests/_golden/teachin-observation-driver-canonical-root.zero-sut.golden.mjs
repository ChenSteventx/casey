#!/usr/bin/env node
// coverage-freeze successor：在固定 PROJECT_ROOT/cases transaction root 上复冻完整 signed driver provenance。
// receipt 必须先于 append；全部负向路径零 accepted ledger residue。只用本地文件/纯函数，禁止 SUT/browser/network。

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
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isProxy } from 'node:util/types';
import * as packageApi from '../../lib/entity-semantic-lock-package.mjs';
import * as identityApi from '../../lib/teachin-identity-observations.mjs';
import * as rootApi from '../../lib/teachin-observation-authority-root.mjs';
import * as registryApi from '../../lib/teachin-observation-driver-registry.mjs';
import { CASES_DIR, PROJECT_ROOT } from '../../lib/paths.mjs';
import { buildTeachInCapture } from '../../lib/record-capture.mjs';

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

const CASE_ID = 'tc_observation_driver_provenance';
const OTHER_CASE_ID = 'tc_observation_driver_clone';
const CASE_DIR = join(CASES_DIR, CASE_ID);
const SCOPE = `sha256:${'a'.repeat(64)}`;
const EVIDENCE = `sha256:${'c'.repeat(64)}`;
const FIXTURE_DIR = fileURLToPath(new URL('./fixtures/teachin-observation-driver-canonical-root/', import.meta.url));
const SIGNED_PATH = join(FIXTURE_DIR, 'identity-readback-receipt.signed.json');
const PUBLIC_KEY_PATH = join(FIXTURE_DIR, 'trusted-driver-public-key.pem');
const SUPERSESSION_PATH = join(FIXTURE_DIR, 'supersession.json');
const SIGNED = JSON.parse(readFileSync(SIGNED_PATH, 'utf8'));
const TRUSTED_PUBLIC_KEY = readFileSync(PUBLIC_KEY_PATH, 'utf8');
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
  observations = [observation()],
  events = [{ action: 'click', path: '/ai-manager/process/list', text: '审批工作流' }],
} = {}) {
  const sidecar = identityApi.buildIdentityObservationSidecar({ caseId: CASE_ID, observations });
  const observationRaw = identityApi.serializeIdentityObservationSidecar(sidecar);
  const capture = identityApi.bindCaptureIdentityObservations({
    capture: buildTeachInCapture({
      caseId: CASE_ID,
      startUrl: '/ai-manager/process/list',
      createdAt: '2026-07-17T00:00:00.000Z',
      events,
    }),
    observationRaw,
  });
  const captureRaw = `${JSON.stringify(capture, null, 2)}\n`;
  const manifest = packageApi.buildTeachInPackageManifest({
    caseId: CASE_ID,
    captureBytes: captureRaw,
    sidecarBytes: observationRaw,
    observationCount: sidecar.observations.length,
    observationSchemaVersion: sidecar.schemaVersion,
  });
  return {
    caseId: CASE_ID,
    captureRaw,
    observationRaw,
    manifestRaw: packageApi.serializeTeachInPackageManifest(manifest),
  };
}
function preparePackage(options = {}) {
  rmSync(CASE_DIR, { recursive: true, force: true });
  try {
    const built = bundle(options);
    const packageDir = join(CASE_DIR, 'record-capture');
    mkdirSync(packageDir, { recursive: true });
    const capturePath = join(packageDir, 'teach-in-capture.json');
    writeFileSync(capturePath, built.captureRaw);
    writeFileSync(join(packageDir, 'identity-observations.json'), built.observationRaw);
    writeFileSync(join(packageDir, 'teach-in-package.json'), built.manifestRaw);
    copyFileSync(SIGNED_PATH, join(packageDir, 'identity-readback-receipt.json'));
    return { ...built, packageDir, capturePath, cleanup: () => rmSync(CASE_DIR, { recursive: true, force: true }) };
  } catch (error) {
    rmSync(CASE_DIR, { recursive: true, force: true });
    throw error;
  }
}
function installEnvelope(p, envelope) {
  writeFileSync(join(p.packageDir, 'identity-readback-receipt.json'), `${JSON.stringify(envelope, null, 2)}\n`);
}
function appendPackage(p, extras = {}) {
  return rootApi.appendAcceptedObservationPackage({ caseId: p.caseId, capturePath: p.capturePath, ...extras });
}
function assertNoTransactionResidue(p, label) {
  const ledgerPath = join(p.packageDir, 'intake-ledger.jsonl');
  if (existsSync(ledgerPath)) {
    const raw = readFileSync(ledgerPath, 'utf8');
    if (raw.includes('"intakeStatus":"accepted"')) throw new Error(`${label} 遗留 accepted ledger`);
    throw new Error(`${label} 遗留 ledger 文件`);
  }
  const residue = readdirSync(p.packageDir).filter((name) => name === 'intake-ledger.jsonl.lock'
    || /^intake-ledger\.jsonl\..+\.tmp$/.test(name));
  if (residue.length) throw new Error(`${label} 遗留 transaction residue`);
}
function assertAppendDeniedNoResidue(p, label, extras = {}) {
  assertDenied(appendPackage(p, extras), label);
  assertNoTransactionResidue(p, label);
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

await check('A1 plain source=platform-runtime 在 append 前拒绝且零 accepted residue', () => {
  const p = preparePackage();
  try {
    if (CASES_DIR !== join(PROJECT_ROOT, 'cases') || p.capturePath !== join(PROJECT_ROOT, 'cases', CASE_ID, 'record-capture', 'teach-in-capture.json')) {
      throw new Error('测试未使用固定 PROJECT_ROOT/cases canonical root');
    }
    installEnvelope(p, plainReceipt());
    assertAppendDeniedNoResidue(p, 'plain canonical receipt');
  } finally { p.cleanup(); }
});

await check('A2 fixed registry 唯一扩根；调用者 key/registry 与自签名在 commit 前拒绝', () => {
  if (registryApi.trustedDriverPublicKeyFor(SIGNED.keyId) !== TRUSTED_PUBLIC_KEY) throw new Error('固定 registry 公钥漂移');
  if (registryApi.trustedDriverPublicKeyFor('attacker-generated-key') != null) throw new Error('未知 keyId 被 registry 接受');
  const attacker = generateKeyPairSync('ed25519');
  const p = preparePackage();
  try {
    const attackerPayload = { ...canonicalPayload(SIGNED), keyId: 'attacker-generated-key' };
    installEnvelope(p, {
      ...attackerPayload,
      signature: sign(null, canonicalPayloadBytes(attackerPayload), attacker.privateKey).toString('base64'),
    });
    assertAppendDeniedNoResidue(p, '攻击者自签 keyId');

    copyFileSync(SIGNED_PATH, join(p.packageDir, 'identity-readback-receipt.json'));
    assertAppendDeniedNoResidue(p, '调用者 publicKey', {
      publicKey: attacker.publicKey.export({ type: 'spki', format: 'pem' }),
    });
    assertAppendDeniedNoResidue(p, '调用者 registry', {
      trustedDriverRegistry: { attacker: attacker.publicKey.export({ type: 'spki', format: 'pem' }) },
    });

    const trustedIdPayload = { ...attackerPayload, keyId: SIGNED.keyId };
    installEnvelope(p, {
      ...trustedIdPayload,
      signature: sign(null, canonicalPayloadBytes(trustedIdPayload), attacker.privateKey).toString('base64'),
    });
    assertAppendDeniedNoResidue(p, '可信 keyId + 攻击者签名');
  } finally { p.cleanup(); }
});

await check('B1 signed Ed25519 正向铸造 opaque pair，identity 最终 trusted', () => {
  const base = bundle();
  const expectedHashes = {
    captureSha256: hash(base.captureRaw),
    sidecarSha256: hash(base.observationRaw),
    manifestSha256: hash(base.manifestRaw),
  };
  for (const [key, value] of Object.entries(expectedHashes)) if (SIGNED[key] !== value) throw new Error(`${key} fixture 绑定漂移`);
  if (!verify(null, canonicalPayloadBytes(SIGNED), createPublicKey(TRUSTED_PUBLIC_KEY), Buffer.from(SIGNED.signature, 'base64'))) {
    throw new Error('冻结 signed fixture 数学验签失败');
  }
  const p = preparePackage();
  try {
    const authority = acceptedFor(p);
    opaque(authority, 'accepted authority');
    const ledgerRaw = readFileSync(join(p.packageDir, 'intake-ledger.jsonl'), 'utf8');
    const rows = ledgerRaw.trimEnd().split('\n').map((line) => JSON.parse(line));
    if (rows.length !== 1 || rows[0].transactionState !== 'committed' || ledgerRaw.includes('transactionToken')) {
      throw new Error('ledger 不是唯一 committed transaction 或泄漏 token');
    }
    const readback = readDriverReceipt(p, authority);
    if (!readback?.ok || !readback.receipt) throw new Error(`SIGNED_DRIVER_RECEIPT_NOT_MINTED:${readback?.reason || 'UNKNOWN'}`);
    opaque(readback.receipt, 'driver receipt');
    const pair = rootApi.verifyObservationTransactionPair({
      acceptedIntakeAuthority: authority,
      platformReadbackReceipt: readback.receipt,
    });
    if (!pair?.ok || JSON.stringify(pair).includes('transactionToken')) throw new Error('opaque transaction pair 未联合或泄漏 token');
    const trusted = identityReview(p, authority, readback.receipt);
    if (!trusted?.ok || trusted.trusted !== true || trusted.replayReady !== false
      || !/driver|ed25519|signed/i.test(String(trusted.trustProvenance || readback.provenance || ''))) {
      throw new Error(JSON.stringify(trusted));
    }
  } finally { p.cleanup(); }
});

await check('B2 payload/signature/keyId/缺签任一篡改均在 append 前拒且零 residue', () => {
  const mutations = [
    ['schemaVersion', 2],
    ['artifactKind', 'other-receipt'],
    ['source', 'caller-runtime'],
    ['keyId', 'unknown-driver-key'],
    ['algorithm', 'RSA'],
    ['sessionNonce', 'driver-session-20260717-mutated'],
    ['caseId', OTHER_CASE_ID],
    ['captureSha256', `sha256:${'1'.repeat(64)}`],
    ['sidecarSha256', `sha256:${'2'.repeat(64)}`],
    ['manifestSha256', `sha256:${'3'.repeat(64)}`],
    ['eventSeq', 2],
    ['kind', 'agent'],
    ['name', '另一个工作流'],
    ['code', 'wf-002'],
    ['platformId', '90071992547409939999'],
    ['scopeFingerprint', `sha256:${'4'.repeat(64)}`],
    ['evidenceSha256', `sha256:${'5'.repeat(64)}`],
    ['signature', `${SIGNED.signature.slice(0, -2)}AA`],
  ];
  const p = preparePackage();
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

await check('B3 signed receipt 跨 package/case 复制拒绝且零 accepted residue', () => {
  let p = preparePackage({
    events: [{ action: 'click', path: '/ai-manager/process/list', text: '审批工作流（另一次录制）' }],
  });
  try { assertAppendDeniedNoResidue(p, '另一 package'); }
  finally { p.cleanup(); }

  p = preparePackage();
  try {
    const result = rootApi.appendAcceptedObservationPackage({ caseId: OTHER_CASE_ID, capturePath: p.capturePath });
    assertDenied(result, '另一 case');
    assertNoTransactionResidue(p, '另一 case');
  } finally { p.cleanup(); }
});

function countedProxy(target) {
  let calls = 0;
  const count = (fn) => (...args) => { calls += 1; return fn(...args); };
  const value = new Proxy(target, {
    get: count(Reflect.get),
    has: count(Reflect.has),
    ownKeys: count(Reflect.ownKeys),
    getOwnPropertyDescriptor: count(Reflect.getOwnPropertyDescriptor),
    getPrototypeOf: count(Reflect.getPrototypeOf),
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

await check('C1 append/reader/pair/identity/registry 的 Proxy/accessor 零执行拒绝', () => {
  let p = preparePackage();
  try {
    const topProxy = countedProxy({ caseId: p.caseId, capturePath: p.capturePath });
    rejectWithoutExecution('append 顶层 Proxy', topProxy, (value) => rootApi.appendAcceptedObservationPackage(value));
    assertNoTransactionResidue(p, 'append 顶层 Proxy');
    const topAccessor = accessorObject('caseId');
    rejectWithoutExecution('append 顶层 accessor', topAccessor, (value) => rootApi.appendAcceptedObservationPackage(value));
    assertNoTransactionResidue(p, 'append 顶层 accessor');
    const callerKeyProxy = countedProxy({});
    rejectWithoutExecution('append 调用者 publicKey Proxy', callerKeyProxy, (value) => appendPackage(p, { publicKey: value }));
    assertNoTransactionResidue(p, 'append 调用者 publicKey Proxy');
    const callerKeyAccessor = accessorObject();
    rejectWithoutExecution('append 调用者 publicKey accessor', callerKeyAccessor, (value) => appendPackage(p, { publicKey: value }));
    assertNoTransactionResidue(p, 'append 调用者 publicKey accessor');
  } finally { p.cleanup(); }

  p = preparePackage();
  try {
    const authority = acceptedFor(p);
    const readback = readDriverReceipt(p, authority);
    if (!readback?.ok || !readback.receipt) throw new Error('signed receipt 前提失败');
    const authorityProxy = countedProxy({});
    rejectWithoutExecution('reader authority Proxy', authorityProxy, (value) => readDriverReceipt(p, value));
    const authorityAccessor = accessorObject();
    rejectWithoutExecution('reader authority accessor', authorityAccessor, (value) => readDriverReceipt(p, value));
    const receiptProxy = countedProxy({});
    rejectWithoutExecution('pair/identity receipt Proxy', receiptProxy, (value) => {
      const pair = rootApi.verifyObservationTransactionPair({ acceptedIntakeAuthority: authority, platformReadbackReceipt: value });
      const identity = identityReview(p, authority, value);
      return pair?.ok || identity?.trusted ? { ok: true } : pair;
    });
    const receiptAccessor = accessorObject();
    rejectWithoutExecution('pair/identity receipt accessor', receiptAccessor, (value) => identityReview(p, authority, value));
    const registryProxy = countedProxy({});
    rejectWithoutExecution('registry keyId Proxy', registryProxy, (value) => registryApi.trustedDriverPublicKeyFor(value));
    const registryAccessor = accessorObject();
    rejectWithoutExecution('registry keyId accessor', registryAccessor, (value) => registryApi.trustedDriverPublicKeyFor(value));
  } finally { p.cleanup(); }
});

await check('D1 旧 frozen checksum 原样，machine-readable supersession receipt 闭合', () => {
  for (const prdPath of [
    'loop/prd-teachin-observation-driver-provenance.json',
    'loop/prd-teachin-observation-transaction-root.json',
  ]) {
    const prd = JSON.parse(readFileSync(prdPath, 'utf8'));
    for (const [path, expected] of Object.entries(prd.testChecksums || {})) {
      if (sha256(readFileSync(path)) !== expected) throw new Error(`旧 frozen checksum 变化：${path}`);
    }
  }
  if (sha256(readFileSync(SIGNED_PATH)) !== sha256(readFileSync(
    'tests/_golden/fixtures/teachin-observation-driver-provenance/identity-readback-receipt.signed.json',
  ))) throw new Error('successor signed fixture 与旧公开签名材料不一致');
  if (sha256(readFileSync(PUBLIC_KEY_PATH)) !== sha256(readFileSync(
    'tests/_golden/fixtures/teachin-observation-driver-provenance/trusted-driver-public-key.pem',
  ))) throw new Error('successor public key 与旧公开材料不一致');
  const receipt = JSON.parse(readFileSync(SUPERSESSION_PATH, 'utf8'));
  const expectedKeys = [
    'schemaVersion', 'artifactKind', 'supersededTask', 'supersededPrd', 'supersededGolden',
    'supersededReason', 'successorTask', 'successorPrd', 'successorGolden', 'composesWith',
    'oldFrozenAssetsImmutable',
  ];
  if (Object.keys(receipt).sort().join(',') !== expectedKeys.sort().join(',')
    || receipt.schemaVersion !== 1
    || receipt.artifactKind !== 'acceptance-gate-supersession-receipt'
    || receipt.supersededTask !== 'teachin-observation-driver-provenance'
    || receipt.successorTask !== 'teachin-observation-driver-canonical-root'
    || receipt.composesWith !== 'teachin-observation-transaction-root'
    || receipt.oldFrozenAssetsImmutable !== true) throw new Error('supersession receipt 不闭合或语义漂移');
});

rmSync(CASE_DIR, { recursive: true, force: true });
if (failures.length) {
  for (const failure of failures) console.error(`FAIL  teachin-observation-driver-canonical-root: ${failure}`);
  console.error(`FAIL  teachin-observation-driver-canonical-root: ${passed} 过 / ${failures.length} 失败`);
  process.exit(1);
}
console.log(`ok   teachin-observation-driver-canonical-root: ${passed}/${passed} 全过（coverage-freeze，零 SUT）`);
