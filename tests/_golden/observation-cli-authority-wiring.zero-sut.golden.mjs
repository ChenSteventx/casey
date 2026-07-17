#!/usr/bin/env node
// zero-SUT：动态冻结 canonical intake→distill 跨进程 authority rehydrate；禁止 fake/browser/server/network。
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as packageApi from '../../lib/entity-semantic-lock-package.mjs';
import * as identityApi from '../../lib/teachin-identity-observations.mjs';
import { buildTeachInCapture } from '../../lib/record-capture.mjs';
import { acquireCanonicalCaseLease } from './support/canonical-case-lease.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const INTAKE = join(ROOT, 'bin', 'intake.mjs');
const DISTILL = join(ROOT, 'bin', 'distill.mjs');
const INTAKE_SOURCE = readFileSync(INTAKE, 'utf8');
const DISTILL_SOURCE = readFileSync(DISTILL, 'utf8');
const REGISTRY = join(ROOT, 'lib', 'teachin-observation-driver-registry.mjs');
const REGISTRY_SOURCE = readFileSync(REGISTRY, 'utf8');
const SIGNED_RECEIPT = fileURLToPath(new URL('./fixtures/teachin-observation-safe-case-lease-v2/identity-readback-receipt.signed.json', import.meta.url));
const TEST_PUBLICATION_LOADER = fileURLToPath(new URL('./fixtures/observation-runtime-trust-root/test-driver-publication-loader.mjs', import.meta.url));
const IDENTITY_CONSUMER_PROBE = fileURLToPath(new URL('./fixtures/observation-runtime-trust-root/rehydrate-identity-consumer-probe.mjs', import.meta.url));
const CASE_ID = 'tc_observation_driver_provenance';
const SCOPE = `sha256:${'a'.repeat(64)}`;
const EVIDENCE = `sha256:${'c'.repeat(64)}`;
let passed = 0;
const failures = [];

function check(name, fn) {
  try { fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
}
function hash(bytes) { return `sha256:${createHash('sha256').update(bytes).digest('hex')}`; }
function run(script, args, { testPublication = false } = {}) {
  const nodeArgs = testPublication ? ['--experimental-loader', TEST_PUBLICATION_LOADER, script, ...args] : [script, ...args];
  return spawnSync(process.execPath, nodeArgs, { cwd: ROOT, encoding: 'utf8', timeout: 20000, env: { ...process.env } });
}
function bundle() {
  const sidecar = identityApi.buildIdentityObservationSidecar({
    caseId: CASE_ID,
    observations: [{
      kind: 'workflow', name: '审批工作流', code: 'wf-001', platformId: '90071992547409931234',
      scopeFingerprint: SCOPE, parent: null, evidenceKind: 'detail-dual-anchor-readback', eventSeq: 1,
      evidenceSha256: EVIDENCE,
    }],
  });
  const sidecarRaw = identityApi.serializeIdentityObservationSidecar(sidecar);
  const capture = identityApi.bindCaptureIdentityObservations({
    capture: buildTeachInCapture({
      caseId: CASE_ID,
      startUrl: '/ai-manager/process/list',
      createdAt: '2026-07-17T00:00:00.000Z',
      events: [{ action: 'click', path: '/ai-manager/process/list', text: '审批工作流' }],
    }),
    observationRaw: sidecarRaw,
  });
  const captureRaw = `${JSON.stringify(capture, null, 2)}\n`;
  const manifest = packageApi.buildTeachInPackageManifest({
    caseId: CASE_ID,
    captureBytes: captureRaw,
    sidecarBytes: sidecarRaw,
    observationCount: sidecar.observations.length,
    observationSchemaVersion: sidecar.schemaVersion,
  });
  return { captureRaw, sidecarRaw, manifestRaw: packageApi.serializeTeachInPackageManifest(manifest) };
}
function writePackage(packageDir, { signed = true } = {}) {
  const built = bundle();
  mkdirSync(packageDir, { recursive: true });
  const capturePath = join(packageDir, 'teach-in-capture.json');
  writeFileSync(capturePath, built.captureRaw);
  writeFileSync(join(packageDir, 'identity-observations.json'), built.sidecarRaw);
  writeFileSync(join(packageDir, 'teach-in-package.json'), built.manifestRaw);
  if (signed) copyFileSync(SIGNED_RECEIPT, join(packageDir, 'identity-readback-receipt.json'));
  return capturePath;
}
function expectExit(result, expected, label) {
  if (result.error) throw result.error;
  if (result.status !== expected) throw new Error(`${label} exit=${result.status}; stderr=${result.stderr}`);
}
function transactionHash(record) {
  const payload = { ...record };
  delete payload.transactionSha256;
  return hash(JSON.stringify(payload));
}

check('CLI source only uses canonical authority root', () => {
  if (!INTAKE_SOURCE.includes('appendAcceptedObservationPackage') || INTAKE_SOURCE.includes('appendIntakeLedger')) {
    throw new Error('intake 仍可绕过 canonical append transaction');
  }
  if (!DISTILL_SOURCE.includes('rehydrateAcceptedObservationTransaction')
    || DISTILL_SOURCE.includes('verifyIntakenPackage') || DISTILL_SOURCE.includes('ledgerEntries =')) {
    throw new Error('distill 仍信 plain ledger/public package authority');
  }
});

check('production registry is empty and cannot import fixture/workspace/env/caller trust', () => {
  if (!REGISTRY_SOURCE.includes('DRIVER_NOT_PUBLISHED') || !REGISTRY_SOURCE.includes('driverRegistryReadiness')) {
    throw new Error('production registry 未诚实声明未发布');
  }
  if (REGISTRY_SOURCE.includes('casey-driver-ed25519-v1') || REGISTRY_SOURCE.includes('BEGIN PUBLIC KEY')
    || /process\.env|fixtures|workspace|options|publicKeyPem/.test(REGISTRY_SOURCE)) {
    throw new Error('production registry 仍含测试 key 或可变扩根');
  }
});

const lease = acquireCanonicalCaseLease({ caseId: CASE_ID });
const outRoot = mkdtempSync(join(tmpdir(), 'casey-observation-cli-authority-'));
try {
  const capturePath = writePackage(lease.packageDir);
  const ledgerPath = join(lease.packageDir, 'intake-ledger.jsonl');
  const receiptPath = join(lease.packageDir, 'identity-readback-receipt.json');

  check('default production intake fails honest when driver release is unpublished', () => {
    const result = run(INTAKE, [CASE_ID, '--capture', capturePath]);
    if (result.status === 0 || !`${result.stderr}${result.stdout}`.includes('DRIVER_NOT_PUBLISHED') || existsSync(ledgerPath)) {
      throw new Error(`production 未 fail-closed DRIVER_NOT_PUBLISHED: exit=${result.status}`);
    }
  });

  check('canonical signed package intakes and distills across processes', () => {
    expectExit(run(INTAKE, [CASE_ID, '--capture', capturePath], { testPublication: true }), 0, 'intake');
    const entries = readFileSync(ledgerPath, 'utf8').trim().split('\n').map(JSON.parse);
    const latest = entries.at(-1);
    if (latest.transactionState !== 'committed'
      || latest.driverReceiptSha256 !== hash(readFileSync(receiptPath))
      || latest.driverKeyId !== 'casey-driver-ed25519-v1'
      || latest.driverSessionNonce !== 'driver-session-20260717-00000001') {
      throw new Error('committed ledger 未精确绑定 signed driver receipt');
    }
    expectExit(run(DISTILL, [CASE_ID, '--capture', capturePath, '--out-dir', outRoot], { testPublication: true }), 0, 'distill');
    const distillDir = join(outRoot, CASE_ID, 'distill');
    if (!existsSync(join(distillDir, `distill-candidate-testcase-${CASE_ID}.json`))) throw new Error('缺 distill candidate');
    const identityProbe = run(IDENTITY_CONSUMER_PROBE, [CASE_ID, capturePath], { testPublication: true });
    expectExit(identityProbe, 0, 'rehydrated identity consumer probe');
    if (!identityProbe.stdout.includes('trusted identity consumer')
      || !identityProbe.stdout.includes('tampered observation remains rejected')) {
      throw new Error('rehydrated identity consumer/tamper 断言未执行');
    }
  });

  const realLedger = existsSync(ledgerPath) ? readFileSync(ledgerPath) : Buffer.alloc(0);
  check('self-made committed hash cannot replace signed driver binding', () => {
    const forged = JSON.parse(realLedger.toString('utf8').trim().split('\n').at(-1));
    forged.driverReceiptSha256 = `sha256:${'b'.repeat(64)}`;
    forged.transactionSha256 = transactionHash(forged);
    writeFileSync(ledgerPath, `${JSON.stringify(forged)}\n`);
    const result = run(DISTILL, [CASE_ID, '--capture', capturePath, '--out-dir', join(outRoot, 'forged')], { testPublication: true });
    if (result.status === 0) throw new Error('伪 committed ledger 被蒸馏');
    if (existsSync(join(outRoot, 'forged', CASE_ID, 'distill'))) throw new Error('伪 ledger 产生候选');
  });

  check('legacy accepted ledger is rejected', () => {
    const legacy = JSON.parse(realLedger.toString('utf8').trim().split('\n').at(-1));
    delete legacy.driverReceiptSha256;
    delete legacy.driverKeyId;
    delete legacy.driverSessionNonce;
    legacy.transactionSha256 = transactionHash(legacy);
    writeFileSync(ledgerPath, `${JSON.stringify(legacy)}\n`);
    const result = run(DISTILL, [CASE_ID, '--capture', capturePath, '--out-dir', join(outRoot, 'legacy')], { testPublication: true });
    if (result.status === 0) throw new Error('legacy ledger 被蒸馏');
  });

  check('missing driver signature rejects intake with zero accepted residue', () => {
    rmSync(ledgerPath, { force: true });
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
    delete receipt.signature;
    writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
    const result = run(INTAKE, [CASE_ID, '--capture', capturePath], { testPublication: true });
    if (result.status === 0 || existsSync(ledgerPath)) throw new Error('缺签 receipt 被入账或留 accepted ledger');
  });

  check('off-root intake and distill both reject', () => {
    const offRoot = mkdtempSync(join(tmpdir(), 'casey-observation-off-root-'));
    try {
      const offCapture = writePackage(join(offRoot, CASE_ID, 'record-capture'));
      if (run(INTAKE, [CASE_ID, '--capture', offCapture], { testPublication: true }).status === 0) throw new Error('off-root intake 通过');
      if (run(DISTILL, [CASE_ID, '--capture', offCapture, '--out-dir', join(outRoot, 'off')], { testPublication: true }).status === 0) {
        throw new Error('off-root distill 通过');
      }
    } finally { rmSync(offRoot, { recursive: true, force: true }); }
  });
} finally {
  rmSync(outRoot, { recursive: true, force: true });
  const cleaned = lease.cleanup();
  if (!cleaned.ok) failures.push(`lease cleanup: ${cleaned.reason}`);
}

if (failures.length) {
  console.error(`\nobservation CLI authority wiring: ${passed} passed, ${failures.length} failed`);
  process.exit(1);
}
console.log(`\nobservation CLI authority wiring: ${passed}/8 passed`);
