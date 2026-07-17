#!/usr/bin/env node
// 冻结验收：plain source 字符串不是 driver trust root；只认代码内固定 Ed25519 registry 验过的
// detached signature，再与 accepted package authority 联合授权。只使用纯函数、冻结公开 fixture 与本地临时目录；
// 私钥仅在攻击用例的进程内瞬时生成且不输出，禁止 SUT/browser/network。

import {
  createHash,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify,
} from 'node:crypto';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isProxy } from 'node:util/types';
import * as packageApi from '../../lib/entity-semantic-lock-package.mjs';
import * as identityApi from '../../lib/teachin-identity-observations.mjs';
import * as rootApi from '../../lib/teachin-observation-authority-root.mjs';
import { buildTeachInCapture } from '../../lib/record-capture.mjs';

let registryApi = null;
try { registryApi = await import('../../lib/teachin-observation-driver-registry.mjs'); } catch { /* red-before-implementation */ }

let passed = 0;
const failures = [];
async function check(name, fn) {
  try { await fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
}
function assertDenied(result, label) {
  if (result?.ok === true || result?.trusted === true || result?.receipt || result?.driverReceipt) {
    throw new Error(`${label} 被错误授权`);
  }
}
function opaque(value, label) {
  if (!value || typeof value !== 'object' || Object.keys(value).length !== 0 || JSON.stringify(value) !== '{}') {
    throw new Error(`${label} 不是 opaque handle`);
  }
}

const CASE_ID = 'tc_observation_driver_provenance';
const OTHER_CASE_ID = 'tc_observation_driver_clone';
const SCOPE = `sha256:${'a'.repeat(64)}`;
const EVIDENCE = `sha256:${'c'.repeat(64)}`;
const FIXTURE_DIR = fileURLToPath(new URL('./fixtures/teachin-observation-driver-provenance/', import.meta.url));
const SIGNED_PATH = join(FIXTURE_DIR, 'identity-readback-receipt.signed.json');
const PUBLIC_KEY_PATH = join(FIXTURE_DIR, 'trusted-driver-public-key.pem');
const SIGNED = JSON.parse(readFileSync(SIGNED_PATH, 'utf8'));
const TRUSTED_PUBLIC_KEY = readFileSync(PUBLIC_KEY_PATH, 'utf8');
const PAYLOAD_KEYS = [
  'schemaVersion', 'artifactKind', 'source', 'keyId', 'algorithm', 'sessionNonce', 'caseId',
  'captureSha256', 'sidecarSha256', 'manifestSha256', 'eventSeq', 'kind', 'name', 'code',
  'platformId', 'scopeFingerprint', 'evidenceSha256',
];

function canonicalPayload(envelope) {
  return Object.fromEntries(PAYLOAD_KEYS.map((key) => [key, envelope[key]]));
}
function canonicalPayloadBytes(envelope) {
  return Buffer.from(JSON.stringify(canonicalPayload(envelope)), 'utf8');
}
function hash(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
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
  const manifestRaw = packageApi.serializeTeachInPackageManifest(manifest);
  return { caseId, sidecar, observationRaw, capture, captureRaw, manifestRaw };
}
function preparePackage(options = {}) {
  const built = bundle(options);
  const root = mkdtempSync(join(tmpdir(), 'casey-driver-provenance-'));
  const packageDir = join(root, built.caseId, 'record-capture');
  mkdirSync(packageDir, { recursive: true });
  const capturePath = join(packageDir, 'teach-in-capture.json');
  writeFileSync(capturePath, built.captureRaw);
  writeFileSync(join(packageDir, 'identity-observations.json'), built.observationRaw);
  writeFileSync(join(packageDir, 'teach-in-package.json'), built.manifestRaw);
  return { root, packageDir, capturePath, ...built, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}
function acceptedFor(p) {
  const accepted = rootApi.appendAcceptedObservationPackage({ caseId: p.caseId, capturePath: p.capturePath });
  if (!accepted?.ok || !accepted.authority) throw new Error(`accepted authority 前提失败：${accepted?.reason || 'UNKNOWN'}`);
  return accepted.authority;
}
function installEnvelope(p, envelope) {
  writeFileSync(join(p.packageDir, 'identity-readback-receipt.json'), `${JSON.stringify(envelope, null, 2)}\n`);
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
    pathFacts: {
      capture: { regularFile: true, symbolicLink: false, parentSymbolicLink: false, identityBefore: 'cap-1', identityAfter: 'cap-1' },
      observations: { regularFile: true, symbolicLink: false, parentSymbolicLink: false, identityBefore: 'obs-1', identityAfter: 'obs-1' },
    },
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

await check('A1 plain canonical receipt 即使 source=platform-runtime 也不得 mint/trusted', () => {
  const p = preparePackage();
  try {
    const authority = acceptedFor(p);
    installEnvelope(p, plainReceipt());
    const result = readDriverReceipt(p, authority);
    if (result?.receipt) {
      const trusted = identityReview(p, authority, result.receipt);
      if (trusted?.trusted === true) throw new Error('PLAIN_SOURCE_STRING_BECAME_TRUST_ROOT');
    }
    assertDenied(result, 'plain canonical receipt');
  } finally { p.cleanup(); }
});

await check('A2 registry 只认代码内固定 keyId；调用者 publicKey/自签名不能扩根', () => {
  if (!registryApi || typeof registryApi.trustedDriverPublicKeyFor !== 'function') {
    throw new Error('TRUSTED_DRIVER_REGISTRY_MISSING');
  }
  const registryKey = registryApi.trustedDriverPublicKeyFor(SIGNED.keyId);
  if (registryKey !== TRUSTED_PUBLIC_KEY) throw new Error('固定 registry 公钥与冻结公钥材料不一致');
  if (registryApi.trustedDriverPublicKeyFor('attacker-generated-key') != null) throw new Error('未知 keyId 被 registry 接受');

  const p = preparePackage();
  try {
    const authority = acceptedFor(p);
    const attacker = generateKeyPairSync('ed25519');
    const attackerPayload = { ...canonicalPayload(SIGNED), keyId: 'attacker-generated-key' };
    const attackerEnvelope = {
      ...attackerPayload,
      signature: sign(null, canonicalPayloadBytes(attackerPayload), attacker.privateKey).toString('base64'),
    };
    installEnvelope(p, attackerEnvelope);
    assertDenied(readDriverReceipt(p, authority), '攻击者自签 keyId');
    assertDenied(readDriverReceipt(p, authority, {
      publicKey: attacker.publicKey.export({ type: 'spki', format: 'pem' }),
    }), '调用者自带 publicKey');
    assertDenied(readDriverReceipt(p, authority, {
      trustedDriverRegistry: { [attackerPayload.keyId]: attacker.publicKey.export({ type: 'spki', format: 'pem' }) },
    }), '调用者自带 registry');

    const trustedIdWrongSignature = {
      ...attackerPayload,
      keyId: SIGNED.keyId,
    };
    installEnvelope(p, {
      ...trustedIdWrongSignature,
      signature: sign(null, canonicalPayloadBytes(trustedIdWrongSignature), attacker.privateKey).toString('base64'),
    });
    assertDenied(readDriverReceipt(p, authority), '可信 keyId + 攻击者签名');
  } finally { p.cleanup(); }
});

await check('B1 frozen signed fixture 数学验签成立，fixed registry receipt + accepted authority 才 trusted', () => {
  const base = bundle();
  const packageHashes = {
    captureSha256: hash(base.captureRaw),
    sidecarSha256: hash(base.observationRaw),
    manifestSha256: hash(base.manifestRaw),
  };
  for (const [key, value] of Object.entries(packageHashes)) if (SIGNED[key] !== value) throw new Error(`${key} fixture 绑定漂移`);
  const signature = Buffer.from(SIGNED.signature, 'base64');
  if (!verify(null, canonicalPayloadBytes(SIGNED), createPublicKey(TRUSTED_PUBLIC_KEY), signature)) {
    throw new Error('冻结 signed fixture 数学验签失败');
  }

  const p = preparePackage();
  try {
    const authority = acceptedFor(p);
    copyFileSync(SIGNED_PATH, join(p.packageDir, 'identity-readback-receipt.json'));
    const result = readDriverReceipt(p, authority);
    if (!result?.ok || !result.receipt) throw new Error(`SIGNED_DRIVER_RECEIPT_NOT_MINTED:${result?.reason || 'UNKNOWN'}`);
    opaque(result.receipt, 'driver receipt');
    const trusted = identityReview(p, authority, result.receipt);
    if (!trusted?.ok || trusted.trusted !== true || trusted.replayReady !== false) throw new Error(JSON.stringify(trusted));
    if (!/driver|ed25519|signed/i.test(String(trusted.trustProvenance || result.provenance || ''))) {
      throw new Error('trusted 结果未声明 signed driver provenance');
    }
  } finally { p.cleanup(); }
});

await check('B2 任一签名载荷字段/signature/keyId/缺签改动均拒绝', () => {
  const mutations = [
    ['caseId', 'other-case'],
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
    ['sessionNonce', 'driver-session-20260717-mutated'],
    ['keyId', 'unknown-driver-key'],
    ['signature', `${SIGNED.signature.slice(0, -2)}AA`],
  ];
  const p = preparePackage();
  try {
    const authority = acceptedFor(p);
    for (const [field, value] of mutations) {
      installEnvelope(p, { ...SIGNED, [field]: value });
      assertDenied(readDriverReceipt(p, authority), `${field} 篡改`);
    }
    const missing = { ...SIGNED };
    delete missing.signature;
    installEnvelope(p, missing);
    assertDenied(readDriverReceipt(p, authority), '缺 signature');
  } finally { p.cleanup(); }
});

await check('B3 signed receipt 复制到另一 package/case 均拒绝', () => {
  const changedPackage = preparePackage({
    events: [{ action: 'click', path: '/ai-manager/process/list', text: '审批工作流（另一次录制）' }],
  });
  try {
    const authority = acceptedFor(changedPackage);
    copyFileSync(SIGNED_PATH, join(changedPackage.packageDir, 'identity-readback-receipt.json'));
    assertDenied(readDriverReceipt(changedPackage, authority), '另一 package');
  } finally { changedPackage.cleanup(); }

  const otherCase = preparePackage({
    caseId: OTHER_CASE_ID,
    observations: [observation()],
  });
  try {
    const authority = acceptedFor(otherCase);
    copyFileSync(SIGNED_PATH, join(otherCase.packageDir, 'identity-readback-receipt.json'));
    assertDenied(readDriverReceipt(otherCase, authority), '另一 case');
  } finally { otherCase.cleanup(); }
});

function countedProxy(target) {
  let calls = 0;
  const count = (fn) => (...args) => { calls += 1; return fn(...args); };
  const proxy = new Proxy(target, {
    get: count(Reflect.get),
    has: count(Reflect.has),
    ownKeys: count(Reflect.ownKeys),
    getOwnPropertyDescriptor: count(Reflect.getOwnPropertyDescriptor),
    getPrototypeOf: count(Reflect.getPrototypeOf),
  });
  if (!isProxy(proxy)) throw new Error('测试前提：Node 未识别 Proxy');
  return { value: proxy, calls: () => calls };
}
function accessorObject() {
  let calls = 0;
  const value = {};
  Object.defineProperty(value, 'brand', { enumerable: true, get() { calls += 1; return 'forged'; } });
  return { value, calls: () => calls };
}
function rejectWithoutExecution(label, wrapped, fn) {
  let result;
  try { result = fn(wrapped.value); } catch { result = null; }
  assertDenied(result, label);
  if (wrapped.calls() !== 0) throw new Error(`${label} 执行 ${wrapped.calls()} 次 trap/getter`);
}

await check('C1 driver reader/identity consumer 的 Proxy/accessor 零执行拒绝', () => {
  const p = preparePackage();
  try {
    const authority = acceptedFor(p);
    copyFileSync(SIGNED_PATH, join(p.packageDir, 'identity-readback-receipt.json'));
    const top = countedProxy({ caseId: p.caseId, capturePath: p.capturePath, acceptedIntakeAuthority: authority });
    rejectWithoutExecution('reader 顶层 Proxy', top, (value) => rootApi.readPlatformIdentityReadbackReceipt(value));
    const nestedProxy = countedProxy({});
    rejectWithoutExecution('reader 嵌套 authority Proxy', nestedProxy, (value) => readDriverReceipt(p, value));
    const nestedAccessor = accessorObject();
    rejectWithoutExecution('reader 嵌套 authority accessor', nestedAccessor, (value) => readDriverReceipt(p, value));
    const callerKeyProxy = countedProxy({});
    rejectWithoutExecution('reader 调用者 publicKey Proxy', callerKeyProxy, (value) => readDriverReceipt(p, authority, { publicKey: value }));
    const callerKeyAccessor = accessorObject();
    rejectWithoutExecution('reader 调用者 publicKey accessor', callerKeyAccessor, (value) => readDriverReceipt(p, authority, { publicKey: value }));
    const receiptProxy = countedProxy({});
    rejectWithoutExecution('identity 嵌套 receipt Proxy', receiptProxy, (value) => identityReview(p, authority, value));
    const receiptAccessor = accessorObject();
    rejectWithoutExecution('identity 嵌套 receipt accessor', receiptAccessor, (value) => identityReview(p, authority, value));
    if (registryApi?.trustedDriverPublicKeyFor) {
      const registryKeyProxy = countedProxy({});
      rejectWithoutExecution('registry keyId Proxy', registryKeyProxy, (value) => registryApi.trustedDriverPublicKeyFor(value));
      const registryKeyAccessor = accessorObject();
      rejectWithoutExecution('registry keyId accessor', registryKeyAccessor, (value) => registryApi.trustedDriverPublicKeyFor(value));
    }
  } finally { p.cleanup(); }
});

await check('D1 旧 authority-root frozen 资产 checksum 原样', () => {
  const prd = JSON.parse(readFileSync('loop/prd-teachin-observation-authority-root.json', 'utf8'));
  for (const [path, expected] of Object.entries(prd.testChecksums || {})) {
    const actual = createHash('sha256').update(readFileSync(path)).digest('hex');
    if (actual !== expected) throw new Error(`旧 frozen checksum 变化：${path}`);
  }
});

if (failures.length) {
  for (const failure of failures) console.error(`RED  teachin-observation-driver-provenance: ${failure}`);
  console.error(`RED  teachin-observation-driver-provenance: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   teachin-observation-driver-provenance: ${passed}/${passed} 全过（零 SUT）`);
