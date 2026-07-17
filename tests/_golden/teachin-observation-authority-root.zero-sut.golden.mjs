#!/usr/bin/env node
// 冻结验收：accepted authority 只由 canonical package/ledger 真实追加事务铸造；trusted identity 还须
// opaque platform-runtime readback receipt。覆盖控制字符百分号绕过与 package/intake/ledger/receipt
// 的 Proxy/accessor 零执行拒绝。只使用纯函数、冻结 fixture 和本地临时目录；禁止 SUT/browser/network。

import { createHash } from 'node:crypto';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isProxy } from 'node:util/types';
import * as packageApi from '../../lib/entity-semantic-lock-package.mjs';
import * as intakeApi from '../../lib/record-distill.mjs';
import * as ledgerApi from '../../lib/record-intake.mjs';
import * as identityApi from '../../lib/teachin-identity-observations.mjs';
import { buildTeachInCapture } from '../../lib/record-capture.mjs';

let rootApi = null;
try { rootApi = await import('../../lib/teachin-observation-authority-root.mjs'); } catch { /* red-before-implementation */ }

let passed = 0;
const failures = [];
async function check(name, fn) {
  try { await fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
}
function expectThrow(fn, pattern) {
  let caught = null;
  try { fn(); } catch (error) { caught = error; }
  if (!caught) throw new Error('预期拒绝但实际放行');
  if (pattern && !pattern.test(String(caught.message))) throw new Error(`错误类别不符：${caught.message}`);
}
function assertDenied(result, label) {
  if (result?.ok === true || result?.trusted === true || result?.authority || result?.receipt) {
    throw new Error(`${label} 被错误授权`);
  }
}
function requireRootApis() {
  if (!rootApi
    || typeof rootApi.appendAcceptedObservationPackage !== 'function'
    || typeof rootApi.readPlatformIdentityReadbackReceipt !== 'function') {
    throw new Error('OBSERVATION_AUTHORITY_ROOT_API_MISSING');
  }
  return rootApi;
}

const CASE_ID = 'tc_observation_authority_root';
const SCOPE = `sha256:${'a'.repeat(64)}`;
const EVIDENCE = `sha256:${'c'.repeat(64)}`;
const RECEIPT_FIXTURE = fileURLToPath(new URL(
  './fixtures/teachin-observation-authority-root/identity-readback-receipt.json',
  import.meta.url,
));
const GOOD_PATHS = {
  capture: { regularFile: true, symbolicLink: false, parentSymbolicLink: false, identityBefore: 'cap-1', identityAfter: 'cap-1' },
  observations: { regularFile: true, symbolicLink: false, parentSymbolicLink: false, identityBefore: 'obs-1', identityAfter: 'obs-1' },
};

function observation(overrides = {}, { withEvidence = false } = {}) {
  const value = {
    kind: 'workflow',
    name: '审批工作流',
    code: 'wf-001',
    platformId: '90071992547409931234',
    scopeFingerprint: SCOPE,
    parent: null,
    evidenceKind: 'detail-dual-anchor-readback',
    eventSeq: 1,
    ...overrides,
  };
  if (withEvidence && !Object.hasOwn(value, 'evidenceSha256')) value.evidenceSha256 = EVIDENCE;
  return value;
}
function bundle({ observations = [observation()], events = null } = {}) {
  const sidecar = identityApi.buildIdentityObservationSidecar({ caseId: CASE_ID, observations });
  const observationRaw = identityApi.serializeIdentityObservationSidecar(sidecar);
  const captureV1 = buildTeachInCapture({
    caseId: CASE_ID,
    startUrl: '/ai-manager/process/list',
    createdAt: '2026-07-17T00:00:00.000Z',
    events: events || [{ action: 'click', path: '/ai-manager/process/list', text: '审批工作流' }],
  });
  const capture = identityApi.bindCaptureIdentityObservations({ capture: captureV1, observationRaw });
  const captureRaw = `${JSON.stringify(capture, null, 2)}\n`;
  const manifest = packageApi.buildTeachInPackageManifest({
    caseId: CASE_ID,
    captureBytes: captureRaw,
    sidecarBytes: observationRaw,
    observationCount: sidecar.observations.length,
    observationSchemaVersion: sidecar.schemaVersion,
  });
  const manifestRaw = packageApi.serializeTeachInPackageManifest(manifest);
  return { sidecar, observationRaw, capture, captureRaw, manifestRaw };
}
function preparePackage(options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'casey-authority-root-'));
  const packageDir = join(root, CASE_ID, 'record-capture');
  mkdirSync(packageDir, { recursive: true });
  const built = bundle(options);
  const capturePath = join(packageDir, 'teach-in-capture.json');
  writeFileSync(capturePath, built.captureRaw);
  writeFileSync(join(packageDir, 'identity-observations.json'), built.observationRaw);
  writeFileSync(join(packageDir, 'teach-in-package.json'), built.manifestRaw);
  copyFileSync(RECEIPT_FIXTURE, join(packageDir, 'identity-readback-receipt.json'));
  return { root, packageDir, capturePath, ...built, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}
function currentPlainIssuer(b) {
  const packageReview = packageApi.verifyTeachInPackage({
    caseId: CASE_ID,
    captureBytes: b.captureRaw,
    sidecarBytes: b.observationRaw,
    manifestBytes: b.manifestRaw,
  });
  if (!packageReview.ok) throw new Error(`测试前提：package 复核失败 ${packageReview.reason}`);
  const ledgerEntries = [{
    schemaVersion: 1,
    event: 'intake',
    intakeStatus: 'accepted',
    caseId: CASE_ID,
    captureSha256: packageReview.captureSha256,
    sidecarSha256: packageReview.sidecarSha256,
    manifestSha256: packageReview.manifestSha256,
    observationCount: packageReview.observationCount,
    observationSchemaVersion: packageReview.observationSchemaVersion,
  }];
  return intakeApi.verifyIntakenPackage({
    caseId: CASE_ID,
    ledgerEntries,
    packageAuthority: packageReview.authority,
    currentCaptureSha256: packageReview.captureSha256,
    currentSidecarSha256: packageReview.sidecarSha256,
    currentManifestSha256: packageReview.manifestSha256,
    observationCount: packageReview.observationCount,
    observationSchemaVersion: packageReview.observationSchemaVersion,
  });
}
function opaque(value, label) {
  if (!value || typeof value !== 'object' || Object.keys(value).length !== 0 || JSON.stringify(value) !== '{}') {
    throw new Error(`${label} 不是无可复制字段的 opaque handle`);
  }
}

await check('A1 公开纯函数不得从 plain ledgerEntries + bytes 自铸 accepted authority', () => {
  const b = bundle();
  const result = currentPlainIssuer(b);
  const issues = [];
  if (result?.authority) issues.push('PUBLIC_PLAIN_ACCEPTED_AUTHORITY_ISSUER_OPEN');
  if (result?.authority) {
    const trusted = identityApi.verifyAcceptedIdentityObservationBundle({
      caseId: CASE_ID,
      captureRaw: b.captureRaw,
      observationRaw: b.observationRaw,
      pathFacts: GOOD_PATHS,
      acceptedIntakeAuthority: result.authority,
    });
    if (trusted?.trusted === true) issues.push('CALLER_PATHFACTS_COMPLETED_FALSE_TRUST_CHAIN');
  }
  if (issues.length) throw new Error(issues.join(','));
});

await check('A2 正向 authority 只能来自固定路径真实 append transaction', () => {
  const root = requireRootApis();
  const p = preparePackage({ observations: [observation({}, { withEvidence: true })] });
  try {
    assertDenied(
      root.appendAcceptedObservationPackage({ caseId: 'other-case', capturePath: p.capturePath }),
      'caseId 换绑追加事务',
    );
    assertDenied(
      root.appendAcceptedObservationPackage({ caseId: CASE_ID, capturePath: join(p.packageDir, 'identity-observations.json') }),
      '非固定 capturePath 追加事务',
    );
    const result = root.appendAcceptedObservationPackage({ caseId: CASE_ID, capturePath: p.capturePath });
    if (!result?.ok || !result.authority) throw new Error(`REAL_APPEND_AUTHORITY_NOT_MINTED:${result?.reason || 'UNKNOWN'}`);
    opaque(result.authority, 'accepted authority');
    const ledger = readFileSync(join(p.packageDir, 'intake-ledger.jsonl'), 'utf8').trim().split('\n');
    if (ledger.length !== 1 || JSON.parse(ledger[0]).intakeStatus !== 'accepted') throw new Error('真实追加事务未写唯一 accepted 行');

    const denied = root.appendAcceptedObservationPackage({
      caseId: CASE_ID,
      capturePath: p.capturePath,
      ledgerEntries: [{ intakeStatus: 'accepted' }],
      captureBytes: p.captureRaw,
      pathFacts: GOOD_PATHS,
    });
    assertDenied(denied, '调用方 plain issuer 参数');
    const afterDenied = readFileSync(join(p.packageDir, 'intake-ledger.jsonl'), 'utf8').trim().split('\n');
    if (afterDenied.length !== 1) throw new Error('拒绝 plain issuer 参数后仍发生 ledger append');
  } finally { p.cleanup(); }
});

await check('B1 accepted authority 单独或 plain receipt 均不得 trusted；opaque receipt 正向才可 trusted', () => {
  const root = requireRootApis();
  const p = preparePackage({ observations: [observation({}, { withEvidence: true })] });
  try {
    const accepted = root.appendAcceptedObservationPackage({ caseId: CASE_ID, capturePath: p.capturePath });
    if (!accepted?.ok || !accepted.authority) throw new Error('accepted authority 前提失败');
    const common = {
      caseId: CASE_ID,
      captureRaw: p.captureRaw,
      observationRaw: p.observationRaw,
      pathFacts: GOOD_PATHS,
      acceptedIntakeAuthority: accepted.authority,
    };
    const missing = identityApi.verifyAcceptedIdentityObservationBundle(common);
    if (missing?.trusted === true || !/READBACK|RECEIPT|HUMAN|PENDING/.test(String(missing?.reason || missing?.identityStatus || ''))) {
      throw new Error(`缺 receipt 未诚实降权：${JSON.stringify(missing)}`);
    }
    const plain = identityApi.verifyAcceptedIdentityObservationBundle({
      ...common,
      platformReadbackReceipt: JSON.parse(readFileSync(RECEIPT_FIXTURE, 'utf8')),
    });
    assertDenied(plain, 'plain readback receipt');

    const readback = root.readPlatformIdentityReadbackReceipt({
      caseId: CASE_ID,
      capturePath: p.capturePath,
      acceptedIntakeAuthority: accepted.authority,
    });
    if (!readback?.ok || !readback.receipt) throw new Error(`OPAQUE_READBACK_NOT_MINTED:${readback?.reason || 'UNKNOWN'}`);
    opaque(readback.receipt, 'platform readback receipt');
    const trusted = identityApi.verifyAcceptedIdentityObservationBundle({ ...common, platformReadbackReceipt: readback.receipt });
    if (!trusted?.ok || trusted.trusted !== true || trusted.replayReady !== false) throw new Error(JSON.stringify(trusted));
  } finally { p.cleanup(); }
});

await check('B2 receipt 精确绑定 eventSeq/kind/name/code/platformId/scope/evidenceSha256', () => {
  const root = requireRootApis();
  const variants = [
    ['eventSeq', { eventSeq: 2 }, [
      { action: 'click', path: '/ai-manager/process/list', text: '其它对象' },
      { action: 'click', path: '/ai-manager/process/list', text: '审批工作流' },
    ]],
    ['kind', { kind: 'agent' }],
    ['name', { name: '另一个工作流' }],
    ['code', { code: 'wf-002' }],
    ['platformId', { platformId: '90071992547409939999' }],
    ['scopeFingerprint', { scopeFingerprint: `sha256:${'d'.repeat(64)}` }],
    ['evidenceSha256', { evidenceSha256: `sha256:${'e'.repeat(64)}` }],
  ];
  for (const [field, patch, events] of variants) {
    const p = preparePackage({ observations: [observation(patch, { withEvidence: true })], events });
    try {
      const accepted = root.appendAcceptedObservationPackage({ caseId: CASE_ID, capturePath: p.capturePath });
      if (!accepted?.ok || !accepted.authority) throw new Error(`${field}: accepted authority 前提失败`);
      const readback = root.readPlatformIdentityReadbackReceipt({
        caseId: CASE_ID,
        capturePath: p.capturePath,
        acceptedIntakeAuthority: accepted.authority,
      });
      assertDenied(readback, `${field} 换绑 receipt`);
    } finally { p.cleanup(); }
  }
});

await check('B3 同名 click 不能给无关 sidecar trusted', () => {
  const root = requireRootApis();
  const p = preparePackage({
    observations: [observation({ kind: 'agent', code: 'agent-001' }, { withEvidence: true })],
    events: [{ action: 'click', path: '/ai-manager/process/list', text: '审批工作流' }],
  });
  try {
    const accepted = root.appendAcceptedObservationPackage({ caseId: CASE_ID, capturePath: p.capturePath });
    if (!accepted?.ok || !accepted.authority) throw new Error('accepted authority 前提失败');
    const readback = root.readPlatformIdentityReadbackReceipt({
      caseId: CASE_ID,
      capturePath: p.capturePath,
      acceptedIntakeAuthority: accepted.authority,
    });
    assertDenied(readback, '同名 click 的无关 agent sidecar');
  } finally { p.cleanup(); }
});

await check('C1 每轮/最终百分号解码后 C0/C1/DEL 与关键词插入均拒绝', () => {
  const values = [
    'to%00ken', 'to%2500ken',
    'line%0afeed', 'field%09name', 'del%7fmark', 'c1%C2%80mark',
    'line%250afeed', 'c1%25C2%2580mark',
  ];
  const leaked = [];
  for (const name of values) {
    try { identityApi.buildIdentityObservationSidecar({ caseId: CASE_ID, observations: [observation({ name })] }); leaked.push(name); }
    catch (error) { if (!/SENSITIVE_CONTENT|ENCODING_INVALID/.test(String(error.message))) throw error; }
  }
  if (leaked.length) throw new Error(`CONTROL_AFTER_DECODE_ACCEPTED:${leaked.join(',')}`);
});

await check('C2 UTF-8 截断/overlong/非法续字节拒绝，裸百分号基线保留', () => {
  for (const name of ['cut%C2', 'cut%E5%AF', 'overlong%C0%AF', 'continuation%E5%20%A0']) {
    expectThrow(
      () => identityApi.buildIdentityObservationSidecar({ caseId: CASE_ID, observations: [observation({ name })] }),
      /ENCODING_INVALID|SENSITIVE_CONTENT/,
    );
  }
  const clean = identityApi.buildIdentityObservationSidecar({
    caseId: CASE_ID,
    observations: [observation({ name: '中文流程完成率 100%' })],
  });
  if (clean.observations[0].name !== '中文流程完成率 100%') throw new Error('裸百分号基线被改写');
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
  return { proxy, calls: () => calls };
}
function accessorObject(entries, accessorKey, value) {
  let calls = 0;
  const object = { ...entries };
  Object.defineProperty(object, accessorKey, { enumerable: true, get() { calls += 1; return value; } });
  return { object, calls: () => calls };
}
function accessorArray(value) {
  let calls = 0;
  const array = [];
  Object.defineProperty(array, '0', { enumerable: true, configurable: true, get() { calls += 1; return value; } });
  Object.defineProperty(array, 'length', { value: 1, writable: true });
  return { object: array, calls: () => calls };
}
function mustRejectWithoutExecution(label, wrapped, invoke) {
  let result;
  let threw = false;
  try { result = invoke(wrapped.proxy || wrapped.object); } catch { threw = true; }
  if (!threw) assertDenied(result, label);
  if (wrapped.calls() !== 0) throw new Error(`${label} 执行了 ${wrapped.calls()} 次 trap/getter`);
}

await check('D1 package/intake/ledger/receipt 顶层与嵌套 Proxy 零 trap 拒绝', () => {
  const base = bundle();
  const packageReview = packageApi.verifyTeachInPackage({
    caseId: CASE_ID, captureBytes: base.captureRaw, sidecarBytes: base.observationRaw, manifestBytes: base.manifestRaw,
  });
  const topPackage = countedProxy({ caseId: CASE_ID, captureBytes: base.captureRaw, sidecarBytes: base.observationRaw, observationCount: 1, observationSchemaVersion: 1 });
  mustRejectWithoutExecution('package 顶层 Proxy', topPackage, (value) => packageApi.buildTeachInPackageManifest(value));
  const manifest = JSON.parse(base.manifestRaw);
  const nestedManifest = countedProxy(manifest.capture);
  mustRejectWithoutExecution('package 嵌套 Proxy', nestedManifest, (value) => packageApi.serializeTeachInPackageManifest({ ...manifest, capture: value }));

  const topIntake = countedProxy({ caseId: CASE_ID });
  mustRejectWithoutExecution('intake 顶层 Proxy', topIntake, (value) => intakeApi.verifyIntakenPackage(value));
  const nestedEntries = countedProxy([]);
  mustRejectWithoutExecution('intake 嵌套 ledgerEntries Proxy', nestedEntries, (value) => intakeApi.verifyIntakenPackage({
    caseId: CASE_ID,
    ledgerEntries: value,
    packageAuthority: packageReview.authority,
    currentCaptureSha256: packageReview.captureSha256,
    currentSidecarSha256: packageReview.sidecarSha256,
    currentManifestSha256: packageReview.manifestSha256,
    observationCount: 1,
    observationSchemaVersion: 1,
  }));

  const topLedger = countedProxy({ caseId: CASE_ID, status: 'rejected' });
  mustRejectWithoutExecution('ledger 顶层 Proxy', topLedger, (value) => ledgerApi.buildIntakeRecord(value));
  const nestedRecord = countedProxy({ schemaVersion: 1, event: 'intake', intakeStatus: 'rejected', caseId: CASE_ID });
  const ledgerRoot = mkdtempSync(join(tmpdir(), 'casey-ledger-proxy-'));
  try {
    mustRejectWithoutExecution('ledger 嵌套 record Proxy', nestedRecord, (value) => ledgerApi.appendIntakeLedger({ ledgerPath: join(ledgerRoot, 'ledger.jsonl'), record: value }));
  } finally { rmSync(ledgerRoot, { recursive: true, force: true }); }

  const root = requireRootApis();
  const topReceipt = countedProxy({ caseId: CASE_ID, capturePath: '/not-read' });
  mustRejectWithoutExecution('receipt 顶层 Proxy', topReceipt, (value) => root.readPlatformIdentityReadbackReceipt(value));
  const nestedAuthority = countedProxy({});
  mustRejectWithoutExecution('receipt 嵌套 authority Proxy', nestedAuthority, (value) => root.readPlatformIdentityReadbackReceipt({
    caseId: CASE_ID, capturePath: '/not-read', acceptedIntakeAuthority: value,
  }));
});

await check('D2 package/intake/ledger/receipt 顶层与嵌套 accessor 零 getter 拒绝', () => {
  const base = bundle();
  const topPackage = accessorObject({ captureBytes: base.captureRaw, sidecarBytes: base.observationRaw, observationCount: 1, observationSchemaVersion: 1 }, 'caseId', CASE_ID);
  mustRejectWithoutExecution('package 顶层 accessor', topPackage, (value) => packageApi.buildTeachInPackageManifest(value));
  const manifest = JSON.parse(base.manifestRaw);
  const nestedCapture = accessorObject({ filename: 'teach-in-capture.json' }, 'sha256', manifest.capture.sha256);
  mustRejectWithoutExecution('package 嵌套 accessor', nestedCapture, (value) => packageApi.serializeTeachInPackageManifest({ ...manifest, capture: value }));

  const topIntake = accessorObject({}, 'caseId', CASE_ID);
  mustRejectWithoutExecution('intake 顶层 accessor', topIntake, (value) => intakeApi.verifyIntakenPackage(value));
  const nestedEntries = accessorArray({ intakeStatus: 'accepted', caseId: CASE_ID });
  mustRejectWithoutExecution('intake 嵌套 ledgerEntries accessor', nestedEntries, (value) => intakeApi.verifyIntakenPackage({
    caseId: CASE_ID,
    ledgerEntries: value,
    packageAuthority: {},
  }));
  const topLedger = accessorObject({ status: 'rejected' }, 'caseId', CASE_ID);
  mustRejectWithoutExecution('ledger 顶层 accessor', topLedger, (value) => ledgerApi.buildIntakeRecord(value));
  const nestedRecord = accessorObject({ schemaVersion: 1, event: 'intake', intakeStatus: 'rejected' }, 'caseId', CASE_ID);
  const ledgerRoot = mkdtempSync(join(tmpdir(), 'casey-ledger-accessor-'));
  try {
    mustRejectWithoutExecution('ledger 嵌套 record accessor', nestedRecord, (value) => ledgerApi.appendIntakeLedger({ ledgerPath: join(ledgerRoot, 'ledger.jsonl'), record: value }));
  } finally { rmSync(ledgerRoot, { recursive: true, force: true }); }

  const root = requireRootApis();
  const topReceipt = accessorObject({ capturePath: '/not-read' }, 'caseId', CASE_ID);
  mustRejectWithoutExecution('receipt 顶层 accessor', topReceipt, (value) => root.readPlatformIdentityReadbackReceipt(value));
  const nestedAuthority = accessorObject({}, 'brand', 'forged');
  mustRejectWithoutExecution('receipt 嵌套 authority accessor', nestedAuthority, (value) => root.readPlatformIdentityReadbackReceipt({
    caseId: CASE_ID,
    capturePath: '/not-read',
    acceptedIntakeAuthority: value,
  }));
});

await check('E1 被替代的相关 frozen tests 与 PRD checksum 全部原样', () => {
  const prdPaths = [
    'loop/prd-teachin-observation-sidecar.json',
    'loop/prd-teachin-observation-sidecar-hardening.json',
    'loop/prd-teachin-observation-authority-hardening.json',
    'loop/prd-record-intake.json',
    'loop/prd-record-distill.json',
  ];
  for (const prdPath of prdPaths) {
    const prd = JSON.parse(readFileSync(prdPath, 'utf8'));
    for (const [testPath, expected] of Object.entries(prd.testChecksums || {})) {
      const actual = createHash('sha256').update(readFileSync(testPath)).digest('hex');
      if (actual !== expected) throw new Error(`原 frozen checksum 变化：${testPath}`);
    }
  }
});

if (failures.length) {
  for (const failure of failures) console.error(`RED  teachin-observation-authority-root: ${failure}`);
  console.error(`RED  teachin-observation-authority-root: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   teachin-observation-authority-root: ${passed}/${passed} 全过（零 SUT）`);
