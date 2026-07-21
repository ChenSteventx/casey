#!/usr/bin/env node
// worker 段（B3 refit：bootstrap/worker 两段式，见 docs/plans/flow-bridge-golden-refit/plan.md B3 节）。
// 本文件只在 bootstrap 段以显式 --experimental-loader 拉起的子进程里运行；只有在这个子进程中
// import authority-root 才能让其内部对 lib/teachin-observation-driver-registry.mjs 的 import
// 被 loader 短路重定向到测试专属临时发布模块，从而验到真实 Ed25519 签名。
//
// process.argv[2] 是 bootstrap 段写好的 JSON 上下文文件路径：里面只有 caseId/capturePath 等纯字符串
// 描述。三件套文件本体、动态签名 receipt、canonical-case-lease 的整段生命周期均已由 bootstrap 在本进程
// 之外备好/接管；worker 只负责调用 authority-root 的公开 API 并断言其行为，不创建也不清理 cases/ 目录。
//
// refit 前提（本文件相对旧版 mkdtemp + 静态无签名 receipt 夹具的语义变更，逐条标注见各 check 内注释）：
// 产线 `teachin-observation-authority-root.mjs` 的 canonical 固定根收紧后，capturePath 必须是
// `cases/<caseId>/record-capture/teach-in-capture.json`；receipt 必须是带 keyId/algorithm/signature 的
// 完整签名信封（`validateReceiptDocument`，:828 起）。这两点合起来还带出一个非声明式改动：
// `appendAcceptedObservationPackage` 内部（:628）与 `readPlatformIdentityReadbackReceipt`（:929）
// 现在共享同一个 `validateReceiptAgainstPackage`/`validateReceiptDocument`，receipt 与 sidecar 的精确字段
// 绑定不再是 readback 阶段独有的检查——绑定不符会在 accept 阶段就被拒绝。B2/B3 的断言已按实跑证据改写。

import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
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

const CONTEXT_PATH = process.argv[2];
if (!CONTEXT_PATH) {
  console.error('FATAL worker: 缺 context 文件路径参数');
  process.exit(2);
}
const CONTEXT = JSON.parse(readFileSync(CONTEXT_PATH, 'utf8'));

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
function opaque(value, label) {
  if (!value || typeof value !== 'object' || Object.keys(value).length !== 0 || JSON.stringify(value) !== '{}') {
    throw new Error(`${label} 不是无可复制字段的 opaque handle`);
  }
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

// A1/C1/C2 沿用「纯内存 bundle，不落盘、不经 canonical lease」——这部分语义与旧版完全一致，无需 refit。
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

// refit 变更：原 capturePath 由每 check 各自 mkdtemp 出的临时目录承载，
// 现改固定 cases/<caseId>/record-capture/teach-in-capture.json（bootstrap 段经 canonical-case-lease 租用）；
// receipt 由静态无签名夹具复制改为 bootstrap 段按本 case 实际三哈希动态签出的完整信封。
// append 成功/失败判据本身不变——只是「receipt 有效」的定义从占位符复制换成真实验签。
await check('A2 正向 authority 只能来自固定路径真实 append transaction', () => {
  const root = requireRootApis();
  const { caseId, capturePath } = CONTEXT.a2;
  const packageDir = dirname(capturePath);
  assertDenied(
    root.appendAcceptedObservationPackage({ caseId: 'other-case', capturePath }),
    'caseId 换绑追加事务',
  );
  assertDenied(
    root.appendAcceptedObservationPackage({ caseId, capturePath: join(packageDir, 'identity-observations.json') }),
    '非固定 capturePath 追加事务',
  );
  const result = root.appendAcceptedObservationPackage({ caseId, capturePath });
  if (!result?.ok || !result.authority) throw new Error(`REAL_APPEND_AUTHORITY_NOT_MINTED:${result?.reason || 'UNKNOWN'}`);
  opaque(result.authority, 'accepted authority');
  const ledger = readFileSync(join(packageDir, 'intake-ledger.jsonl'), 'utf8').trim().split('\n');
  if (ledger.length !== 1 || JSON.parse(ledger[0]).intakeStatus !== 'accepted') throw new Error('真实追加事务未写唯一 accepted 行');

  const denied = root.appendAcceptedObservationPackage({
    caseId,
    capturePath,
    ledgerEntries: [{ intakeStatus: 'accepted' }],
    captureBytes: 'irrelevant',
    pathFacts: GOOD_PATHS,
  });
  assertDenied(denied, '调用方 plain issuer 参数');
  const afterDenied = readFileSync(join(packageDir, 'intake-ledger.jsonl'), 'utf8').trim().split('\n');
  if (afterDenied.length !== 1) throw new Error('拒绝 plain issuer 参数后仍发生 ledger append');
});

// refit 变更：capturePath 改固定规范路径；receipt 改 bootstrap 段动态签出的完整信封（keyId/algorithm/signature
// 齐全，字段精确绑定本 case 的真实 sidecar 观测值）。accepted authority、opaque receipt、trusted 判据不变。
await check('B1 accepted authority 单独或 plain receipt 均不得 trusted；opaque receipt 正向才可 trusted', () => {
  const root = requireRootApis();
  const { caseId, capturePath } = CONTEXT.b1;
  const captureRaw = readFileSync(capturePath, 'utf8');
  const observationRaw = readFileSync(join(dirname(capturePath), 'identity-observations.json'), 'utf8');
  const accepted = root.appendAcceptedObservationPackage({ caseId, capturePath });
  if (!accepted?.ok || !accepted.authority) throw new Error('accepted authority 前提失败');
  const common = {
    caseId,
    captureRaw,
    observationRaw,
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

  const readback = root.readPlatformIdentityReadbackReceipt({ caseId, capturePath, acceptedIntakeAuthority: accepted.authority });
  if (!readback?.ok || !readback.receipt) throw new Error(`OPAQUE_READBACK_NOT_MINTED:${readback?.reason || 'UNKNOWN'}`);
  opaque(readback.receipt, 'platform readback receipt');
  const trusted = identityApi.verifyAcceptedIdentityObservationBundle({ ...common, platformReadbackReceipt: readback.receipt });
  if (!trusted?.ok || trusted.trusted !== true || trusted.replayReady !== false) throw new Error(JSON.stringify(trusted));
});

// refit 变更（实跑定谳，非声明式）：旧版假设「accept 成功、仅 readback 因精确绑定不符被拒」两级证据窗口。
// 现产线 `appendAcceptedObservationPackage`（:628）与 `readPlatformIdentityReadbackReceipt`（:929）共享
// 同一个 `validateReceiptAgainstPackage`/`validateReceiptDocument`，绑定校验已提到 accept 阶段——receipt
// 字段与 sidecar 不符会让 append 本身直接以精确 `READBACK_<FIELD>_MISMATCH` 拒绝，不再有「先 accept 成功」
// 这一步。断言相应改为：直断 append 拒绝且拒因精确匹配对应字段，不再断言 accept 成功后再走 readback。
await check('B2 receipt 精确绑定 eventSeq/kind/name/code/platformId/scope/evidenceSha256', () => {
  const root = requireRootApis();
  for (const { field, caseId, capturePath } of CONTEXT.b2) {
    const denied = root.appendAcceptedObservationPackage({ caseId, capturePath });
    assertDenied(denied, `${field} 换绑 receipt`);
    if (denied.reason !== `READBACK_${field.toUpperCase()}_MISMATCH`) {
      throw new Error(`${field}: 拒因不精确 ${denied.reason}`);
    }
  }
});

// refit 变更：与 B2 同因——receipt（刻意保持「工作流」身份的历史夹具语义：kind=workflow/code=wf-001 等）
// 与本 case 真实 sidecar（kind=agent/code=agent-001）不符，在 append 阶段即以 READBACK_KIND_MISMATCH 被拒
// （kind 是绑定字段迭代顺序里第一个不符的），不再走到 readback 阶段。
await check('B3 同名 click 不能给无关 sidecar trusted', () => {
  const root = requireRootApis();
  const { caseId, capturePath } = CONTEXT.b3;
  const denied = root.appendAcceptedObservationPackage({ caseId, capturePath });
  assertDenied(denied, '同名 click 的无关 agent sidecar');
  if (denied.reason !== 'READBACK_KIND_MISMATCH') throw new Error(`拒因不精确：${denied.reason}`);
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

// 新增负向 check（B3 refit 任务第 3 点）：旧无签名 receipt 夹具原字节保留作负例——喂给 authority root 必拒，
// 且断精确拒因。拒因以实跑定谳：夹具缺 keyId/algorithm/sessionNonce/哈希三项/signature 等信封必需字段，
// envelope 形状闸先于逐字段绑定/签名验证触发，故拒因是 READBACK_RECEIPT_UNKNOWN_OR_MISSING_FIELD（非
// READBACK_SIGNATURE_INVALID 一类「有信封形状、签名本身不对」的拒因）。
await check('F1 旧无签名 receipt 夹具喂给 authority root 必拒，断精确拒因', () => {
  const root = requireRootApis();
  const { caseId, capturePath } = CONTEXT.negUnsigned;
  const packageDir = dirname(capturePath);
  const denied = root.appendAcceptedObservationPackage({ caseId, capturePath });
  assertDenied(denied, '旧无签名 receipt 夹具');
  if (denied.reason !== 'READBACK_RECEIPT_UNKNOWN_OR_MISSING_FIELD') {
    throw new Error(`拒因不精确：${denied.reason}`);
  }
  if (existsSync(join(packageDir, 'intake-ledger.jsonl'))) {
    throw new Error('拒绝无签名 receipt 后不应有任何 ledger 落盘');
  }
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
console.log(`ok   teachin-observation-authority-root: ${passed}/${passed} 全过（零 SUT，bootstrap/worker 两段式）`);
