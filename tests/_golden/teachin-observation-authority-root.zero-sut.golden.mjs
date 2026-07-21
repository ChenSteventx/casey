#!/usr/bin/env node
// 冻结验收：accepted authority 只由 canonical package/ledger 真实追加事务铸造；trusted identity 还须
// opaque platform-runtime readback receipt。覆盖控制字符百分号绕过与 package/intake/ledger/receipt 的
// Proxy/accessor 零执行拒绝。只使用纯函数、冻结 fixture 和本地临时目录（+ cases/ 固定根短租）；
// 禁止 SUT/browser/network。
//
// bootstrap/worker 两段式（B3 refit，见 docs/plans/flow-bridge-golden-refit/plan.md B3 节）：
// 本文件（bootstrap 段）顶部零 authority-root import——它只负责：
//   1. 生成临时 Ed25519 密钥对 + 临时 driver-registry 发布模块 + 隔离 loader（共用件 support/
//      ephemeral-driver-publication.mjs）；
//   2. 经 canonical-case-lease 在 cases/ 固定根下租用本次跑所需的每个 case 目录；
//   3. 手造三件套（capture/sidecar/manifest）并按各 check 的语义需要动态签出 receipt（含刻意构造
//      精确字段不符的负例）写入这些目录；
//   4. 以显式 --experimental-loader 拉起 worker 段（新文件 teachin-observation-authority-root.worker.mjs），
//      worker 在 loader 生效的子进程里 import authority-root 并执行全部断言语义；
//   5. 收集 worker 的退出码，finally 里清理全部租约与临时材料，最后统一在文件末尾按汇总结果 exit 一次。
// 之所以要两段：worker 需要在「driver-registry import 已被 loader 重定向」的进程里才能验到真实签名，
// 而 --experimental-loader 只能在进程启动时传入——本文件本体（PRD acceptance 命令 `node <本文件>`）
// 不需要 loader，loader 只出现在它 spawn worker 子进程的命令行里。

import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEphemeralDriverPublication } from './support/ephemeral-driver-publication.mjs';
import { acquireCanonicalCaseLease } from './support/canonical-case-lease.mjs';
import * as packageApi from '../../lib/entity-semantic-lock-package.mjs';
import * as identityApi from '../../lib/teachin-identity-observations.mjs';
import { buildTeachInCapture } from '../../lib/record-capture.mjs';

const WORKER_PATH = fileURLToPath(new URL('./teachin-observation-authority-root.worker.mjs', import.meta.url));
const OLD_RECEIPT_FIXTURE = fileURLToPath(new URL(
  './fixtures/teachin-observation-authority-root/identity-readback-receipt.json',
  import.meta.url,
));

const SCOPE = `sha256:${'a'.repeat(64)}`;
const EVIDENCE = `sha256:${'c'.repeat(64)}`;
// 与 worker.mjs 里 observation() 的默认值同形——B2/B3 需要拿「基线值」去和「本 case 实际патched 值」
// 故意错配，构造出精确字段不符的负例 receipt。
const BASE_OBSERVATION = {
  kind: 'workflow',
  name: '审批工作流',
  code: 'wf-001',
  platformId: '90071992547409931234',
  scopeFingerprint: SCOPE,
  evidenceSha256: EVIDENCE,
  eventSeq: 1,
};

const leases = [];

// 手造一个 case 的完整三件套 + receipt，写进 canonical-case-lease 租到的固定根目录。
// receiptOverrides 缺省时按「本 case 真实 sidecar 观测值」正向签出（应验签通过）；
// 传入部分字段覆盖即可故意错配出「receipt 与 sidecar 不符」的负例；useOldFixtureReceipt 则整份
// receipt 换成旧无签名夹具原字节（F1 负例，验的是 envelope 形状闸而非某个字段）。
function buildScenario({ caseId, observationOverrides = {}, events = null, withEvidence = true, receiptOverrides = null, useOldFixtureReceipt = false }) {
  const lease = acquireCanonicalCaseLease({ caseId });
  leases.push(lease);
  mkdirSync(lease.packageDir, { recursive: true });

  const observation = { ...BASE_OBSERVATION, parent: null, evidenceKind: 'detail-dual-anchor-readback', ...observationOverrides };
  if (!withEvidence) delete observation.evidenceSha256;
  const sidecar = identityApi.buildIdentityObservationSidecar({ caseId, observations: [observation] });
  const observationRaw = identityApi.serializeIdentityObservationSidecar(sidecar);
  const captureV1 = buildTeachInCapture({
    caseId,
    startUrl: '/ai-manager/process/list',
    createdAt: '2026-07-17T00:00:00.000Z',
    events: events || [{ action: 'click', path: '/ai-manager/process/list', text: '审批工作流' }],
  });
  const capture = identityApi.bindCaptureIdentityObservations({ capture: captureV1, observationRaw });
  const captureRaw = `${JSON.stringify(capture, null, 2)}\n`;
  const manifest = packageApi.buildTeachInPackageManifest({
    caseId,
    captureBytes: captureRaw,
    sidecarBytes: observationRaw,
    observationCount: sidecar.observations.length,
    observationSchemaVersion: sidecar.schemaVersion,
  });
  const manifestRaw = packageApi.serializeTeachInPackageManifest(manifest);
  const packageReview = packageApi.verifyTeachInPackage({
    caseId, captureBytes: captureRaw, sidecarBytes: observationRaw, manifestBytes: manifestRaw,
  });
  if (!packageReview.ok) throw new Error(`BOOTSTRAP_PACKAGE_REVIEW_FAILED:${caseId}:${packageReview.reason}`);

  const capturePath = join(lease.packageDir, 'teach-in-capture.json');
  writeFileSync(capturePath, captureRaw);
  writeFileSync(join(lease.packageDir, 'identity-observations.json'), observationRaw);
  writeFileSync(join(lease.packageDir, 'teach-in-package.json'), manifestRaw);

  if (useOldFixtureReceipt) {
    copyFileSync(OLD_RECEIPT_FIXTURE, join(lease.packageDir, 'identity-readback-receipt.json'));
  } else {
    const base = {
      schemaVersion: 1,
      artifactKind: 'platform-identity-readback-receipt',
      source: 'platform-runtime',
      keyId: publication.keyId,
      algorithm: 'Ed25519',
      sessionNonce: `nonce-${randomUUID()}`,
      caseId,
      captureSha256: packageReview.captureSha256,
      sidecarSha256: packageReview.sidecarSha256,
      manifestSha256: packageReview.manifestSha256,
      eventSeq: observation.eventSeq,
      kind: observation.kind,
      name: observation.name,
      code: observation.code,
      platformId: observation.platformId,
      scopeFingerprint: observation.scopeFingerprint,
      evidenceSha256: observation.evidenceSha256,
      ...receiptOverrides,
    };
    const signed = publication.signReceipt(base);
    writeFileSync(join(lease.packageDir, 'identity-readback-receipt.json'), `${JSON.stringify(signed, null, 2)}\n`);
  }
  return { caseId, capturePath };
}

// B2 的 7 个字段变体：observationOverrides 是本 case 真实 sidecar 会带的值，receiptOverrides 故意
// 保留成 BASE_OBSERVATION 的原值——两者在该字段上不相等，验签会精确拒在该字段。
const B2_VARIANTS = [
  ['eventSeq', { eventSeq: 2 }, [
    { action: 'click', path: '/ai-manager/process/list', text: '其它对象' },
    { action: 'click', path: '/ai-manager/process/list', text: '审批工作流' },
  ]],
  ['kind', { kind: 'agent' }, null],
  ['name', { name: '另一个工作流' }, null],
  ['code', { code: 'wf-002' }, null],
  ['platformId', { platformId: '90071992547409939999' }, null],
  ['scopeFingerprint', { scopeFingerprint: `sha256:${'d'.repeat(64)}` }, null],
  ['evidenceSha256', { evidenceSha256: `sha256:${'e'.repeat(64)}` }, null],
];

let publication = null;
let ctxDir = null;
let workerStatus = null;
let prepError = null;

try {
  publication = createEphemeralDriverPublication();
  ctxDir = mkdtempSync(join(tmpdir(), 'casey-authority-root-ctx-'));

  const context = {
    a2: buildScenario({ caseId: 'tc_authority_root_a2' }),
    b1: buildScenario({ caseId: 'tc_authority_root_b1' }),
    b2: B2_VARIANTS.map(([field, patch, events]) => ({
      field,
      ...buildScenario({
        caseId: `tc_authority_root_b2_${field.toLowerCase()}`,
        observationOverrides: patch,
        events,
        receiptOverrides: { [field]: BASE_OBSERVATION[field] },
      }),
    })),
    b3: buildScenario({
      caseId: 'tc_authority_root_b3',
      observationOverrides: { kind: 'agent', code: 'agent-001' },
      // receipt 刻意维持「工作流」身份（旧夹具语义：kind=workflow/code=wf-001），与本 case 真实
      // agent sidecar 不符——迭代顺序里 kind 先于 code 被校验，故拒因精确落在 READBACK_KIND_MISMATCH。
      receiptOverrides: { kind: 'workflow', code: 'wf-001' },
    }),
    negUnsigned: buildScenario({ caseId: 'tc_authority_root_neg_unsigned', useOldFixtureReceipt: true }),
  };

  const contextPath = join(ctxDir, 'context.json');
  writeFileSync(contextPath, JSON.stringify(context));

  const result = spawnSync(
    process.execPath,
    ['--experimental-loader', publication.loaderPath, WORKER_PATH, contextPath],
    { stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  workerStatus = result.status;
} catch (error) {
  prepError = error;
  console.error(`RED  teachin-observation-authority-root(bootstrap): ${error?.message || error}`);
}

const cleanupFailures = [];
for (const lease of leases) {
  let outcome;
  try { outcome = lease.cleanup(); } catch (error) { outcome = { ok: false, reason: error?.message || 'CLEANUP_THREW' }; }
  if (outcome?.ok !== true) cleanupFailures.push(`${lease.caseId}:${outcome?.reason}`);
}
if (publication) {
  let outcome;
  try { outcome = publication.cleanup(); } catch (error) { outcome = { ok: false, reason: error?.message || 'CLEANUP_THREW' }; }
  if (outcome?.ok !== true) cleanupFailures.push(`publication:${outcome?.reason}`);
}
if (ctxDir) {
  try { rmSync(ctxDir, { recursive: true, force: true }); }
  catch (error) { cleanupFailures.push(`ctxDir:${error?.message || 'CLEANUP_THREW'}`); }
}
if (cleanupFailures.length) {
  console.error(`RED  teachin-observation-authority-root(bootstrap): 清理失败 ${cleanupFailures.join(',')}`);
}

const exitCode = prepError || cleanupFailures.length
  ? 1
  : (workerStatus === 0 ? 0 : (typeof workerStatus === 'number' ? workerStatus : 1));
process.exit(exitCode);
