#!/usr/bin/env node
// zero-SUT：identity sidecar 单一闭合合同 + signed receipt 全观察覆盖。禁止 SUT/browser/server/network/fake。
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as packageApi from '../../lib/entity-semantic-lock-package.mjs';
import * as identityApi from '../../lib/teachin-identity-observations.mjs';
import { buildTeachInCapture } from '../../lib/record-capture.mjs';
import { CASES_DIR } from '../../lib/paths.mjs';
import { acquireCanonicalCaseLease } from './support/canonical-case-lease.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const INTAKE = join(ROOT, 'bin/intake.mjs');
const DISTILL = join(ROOT, 'bin/distill.mjs');
const AUTHORITY_SOURCE = readFileSync(join(ROOT, 'lib/teachin-observation-authority-root.mjs'), 'utf8');
const PROBE = join(ROOT, 'tests/_golden/fixtures/observation-contract-closure/trusted-multi-consumer-probe.mjs');
const SCOPE = `sha256:${'a'.repeat(64)}`;
const EVIDENCE_A = `sha256:${'b'.repeat(64)}`;
const EVIDENCE_B = `sha256:${'c'.repeat(64)}`;
const V1_PAYLOAD_KEYS = [
  'schemaVersion', 'artifactKind', 'source', 'keyId', 'algorithm', 'sessionNonce', 'caseId',
  'captureSha256', 'sidecarSha256', 'manifestSha256', 'eventSeq', 'kind', 'name', 'code',
  'platformId', 'scopeFingerprint', 'evidenceSha256',
];
const V2_PAYLOAD_KEYS = [
  'schemaVersion', 'artifactKind', 'source', 'keyId', 'algorithm', 'sessionNonce', 'caseId',
  'captureSha256', 'sidecarSha256', 'manifestSha256', 'observations',
];
const RECEIPT_OBSERVATION_KEYS = [
  'kind', 'name', 'code', 'platformId', 'scopeFingerprint', 'parent', 'evidenceKind', 'eventSeq', 'evidenceSha256',
];
let passed = 0;
const failures = [];
function check(name, fn) {
  try { fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
}
function hash(value) { return `sha256:${createHash('sha256').update(value).digest('hex')}`; }
function pick(value, keys) { return Object.fromEntries(keys.map((key) => [key, value[key]])); }
function observation(overrides = {}) {
  return {
    kind: 'workflow', name: '审批工作流', code: 'wf-001', platformId: '90071992547409931234',
    scopeFingerprint: SCOPE, parent: null, evidenceKind: 'detail-dual-anchor-readback', eventSeq: 1,
    evidenceSha256: EVIDENCE_A, ...overrides,
  };
}

mkdirSync(CASES_DIR, { recursive: true });
const keyPair = generateKeyPairSync('ed25519');
const keyId = 'casey-observation-contract-test-key';
const supportRoot = mkdtempSync(join(tmpdir(), 'casey-observation-contract-loader-'));
const publicationPath = join(supportRoot, 'publication.mjs');
const loaderPath = join(supportRoot, 'loader.mjs');
const productionRegistryUrl = pathToFileURL(join(ROOT, 'lib/teachin-observation-driver-registry.mjs')).href;
writeFileSync(publicationPath, [
  `const KEY_ID = ${JSON.stringify(keyId)};`,
  `const PUBLIC_KEY = ${JSON.stringify(keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString())};`,
  'export function trustedDriverPublicKeyFor(value) { return value === KEY_ID ? PUBLIC_KEY : null; }',
  "export function driverRegistryReadiness() { return Object.freeze({ ready: true, reason: null, route: 'test-only', publication: 'ephemeral-loader' }); }",
].join('\n') + '\n');
writeFileSync(loaderPath, [
  `const productionRegistry = ${JSON.stringify(productionRegistryUrl)};`,
  `const testPublication = ${JSON.stringify(pathToFileURL(publicationPath).href)};`,
  'export async function resolve(specifier, context, nextResolve) {',
  '  const resolved = await nextResolve(specifier, context);',
  '  if (resolved.url === productionRegistry) return { url: testPublication, shortCircuit: true };',
  '  return resolved;',
  '}',
].join('\n') + '\n');

function run(script, args) {
  return spawnSync(process.execPath, ['--experimental-loader', loaderPath, script, ...args], {
    cwd: ROOT, encoding: 'utf8', timeout: 30000, env: { ...process.env },
  });
}
function expectExit(result, expected, label) {
  if (result.error) throw result.error;
  if (result.status !== expected) throw new Error(`${label} exit=${result.status}; stderr=${result.stderr}`);
}
function buildBundle({ caseId, observations, events, mutateSidecar = null }) {
  const validSidecar = identityApi.buildIdentityObservationSidecar({ caseId, observations });
  const validRaw = identityApi.serializeIdentityObservationSidecar(validSidecar);
  const bound = identityApi.bindCaptureIdentityObservations({
    capture: buildTeachInCapture({ caseId, startUrl: '/ai-manager/process/list', createdAt: '2026-07-17T00:00:00.000Z', events }),
    observationRaw: validRaw,
  });
  const sidecarDoc = JSON.parse(validRaw);
  if (mutateSidecar) mutateSidecar(sidecarDoc);
  const sidecarRaw = `${JSON.stringify(sidecarDoc, null, 2)}\n`;
  const capture = JSON.parse(JSON.stringify(bound));
  capture.identityObservations.sha256 = hash(sidecarRaw);
  capture.identityObservations.count = sidecarDoc.observations.length;
  const captureRaw = `${JSON.stringify(capture, null, 2)}\n`;
  const manifest = packageApi.buildTeachInPackageManifest({
    caseId, captureBytes: captureRaw, sidecarBytes: sidecarRaw,
    observationCount: sidecarDoc.observations.length, observationSchemaVersion: sidecarDoc.schemaVersion,
  });
  const manifestRaw = packageApi.serializeTeachInPackageManifest(manifest);
  const review = packageApi.verifyTeachInPackage({ caseId, captureBytes: captureRaw, sidecarBytes: sidecarRaw, manifestBytes: manifestRaw });
  if (!review.ok) throw new Error(`lenient package fixture 前提失败: ${review.reason}`);
  return { captureRaw, sidecarRaw, manifestRaw, review, sidecarDoc };
}
function signedReceipt(bundle, { schemaVersion = 1, receiptObservations = null, sessionNonce = 'contract-session-1' } = {}) {
  const common = {
    schemaVersion,
    artifactKind: 'platform-identity-readback-receipt',
    source: 'platform-runtime',
    keyId,
    algorithm: 'Ed25519',
    sessionNonce,
    caseId: bundle.sidecarDoc.caseId,
    captureSha256: bundle.review.captureSha256,
    sidecarSha256: bundle.review.sidecarSha256,
    manifestSha256: bundle.review.manifestSha256,
  };
  let envelope;
  let payload;
  if (schemaVersion === 1) {
    const only = bundle.sidecarDoc.observations[0];
    envelope = { ...common, ...pick(only, ['eventSeq', 'kind', 'name', 'code', 'platformId', 'scopeFingerprint', 'evidenceSha256']) };
    payload = pick(envelope, V1_PAYLOAD_KEYS);
  } else {
    envelope = {
      ...common,
      observations: (receiptObservations || bundle.sidecarDoc.observations).map((entry) => pick(entry, RECEIPT_OBSERVATION_KEYS)),
    };
    payload = pick(envelope, V2_PAYLOAD_KEYS);
  }
  return { ...envelope, signature: sign(null, Buffer.from(JSON.stringify(payload)), keyPair.privateKey).toString('base64') };
}
function withPackage({ caseId, observations, events, mutateSidecar = null, receiptOptions = {} }, fn) {
  const lease = acquireCanonicalCaseLease({ caseId });
  try {
    const bundle = buildBundle({ caseId, observations, events, mutateSidecar });
    mkdirSync(lease.packageDir, { recursive: true });
    const capturePath = join(lease.packageDir, 'teach-in-capture.json');
    writeFileSync(capturePath, bundle.captureRaw);
    writeFileSync(join(lease.packageDir, 'identity-observations.json'), bundle.sidecarRaw);
    writeFileSync(join(lease.packageDir, 'teach-in-package.json'), bundle.manifestRaw);
    writeFileSync(join(lease.packageDir, 'identity-readback-receipt.json'), `${JSON.stringify(signedReceipt(bundle, receiptOptions), null, 2)}\n`);
    fn({ ...bundle, lease, capturePath, ledgerPath: join(lease.packageDir, 'intake-ledger.jsonl') });
  } finally {
    const cleaned = lease.cleanup();
    if (!cleaned.ok) throw new Error(`lease cleanup refused: ${cleaned.reason}`);
  }
}
function assertIntakeDeniedNoLedger(bundle, label) {
  const result = run(INTAKE, [bundle.sidecarDoc.caseId, '--capture', bundle.capturePath]);
  if (result.status === 0) throw new Error(`${label} 被 intake accepted`);
  if (existsSync(bundle.ledgerPath)) throw new Error(`${label} 留下 accepted ledger`);
}

try {
  check('authority root 的 append 与 rehydrate 共用 readPackage 单一闭合 validator', () => {
    if (!AUTHORITY_SOURCE.includes('reviewClosedIdentityObservationPackage')
      || !/function readPackage[\s\S]*reviewClosedIdentityObservationPackage/.test(AUTHORITY_SOURCE)
      || !/appendAcceptedObservationPackage[\s\S]*readPackage/.test(AUTHORITY_SOURCE)
      || !/rehydrateAcceptedObservationTransaction[\s\S]*readPackage/.test(AUTHORITY_SOURCE)) {
      throw new Error('canonical append/rehydrate 尚未共享闭合 identity package validator');
    }
  });

  check('unknown sidecar field 在 commit 前拒绝且零 accepted ledger', () => {
    withPackage({
      caseId: 'tc_obs_contract_unknown', observations: [observation()],
      events: [{ action: 'click', path: '/ai-manager/process/list', text: '审批工作流' }],
      mutateSidecar: (doc) => { doc.observations[0].unknownField = 'must-reject'; },
    }, (bundle) => assertIntakeDeniedNoLedger(bundle, 'unknown sidecar field'));
  });

  check('sensitive sidecar content 在 commit 前拒绝且零 accepted ledger', () => {
    withPackage({
      caseId: 'tc_obs_contract_sensitive', observations: [observation()],
      events: [{ action: 'click', path: '/ai-manager/process/list', text: '审批工作流' }],
      mutateSidecar: (doc) => { doc.observations[0].name = 'password=must-not-enter-ledger'; },
    }, (bundle) => assertIntakeDeniedNoLedger(bundle, 'sensitive sidecar content'));
  });

  check('accepted package 不得含 identity consumer 会拒的 evidence/action 组合', () => {
    withPackage({
      caseId: 'tc_obs_contract_action', observations: [observation()],
      events: [{ action: 'fill', path: '/ai-manager/process/list', text: '审批工作流' }],
    }, (bundle) => assertIntakeDeniedNoLedger(bundle, 'evidence/action mismatch'));
  });

  const multiObservations = [
    observation(),
    observation({ kind: 'agent', name: '审核智能体', code: 'agent-002', platformId: '90071992547409939999', eventSeq: 2, evidenceSha256: EVIDENCE_B }),
  ];
  const multiEvents = [
    { action: 'click', path: '/ai-manager/process/list', text: '审批工作流' },
    { action: 'click', path: '/ai-manager/agent/list', text: '审核智能体' },
  ];
  check('partial signed receipt 不覆盖全部 observations 时拒绝且零 ledger', () => {
    withPackage({
      caseId: 'tc_obs_contract_partial', observations: multiObservations, events: multiEvents,
      receiptOptions: { schemaVersion: 2, receiptObservations: multiObservations.slice(0, 1), sessionNonce: 'contract-session-partial' },
    }, (bundle) => assertIntakeDeniedNoLedger(bundle, 'partial receipt'));
  });

  check('完整双观察 receipt 可 intake→distill→trusted consumer', () => {
    const outRoot = mkdtempSync(join(tmpdir(), 'casey-observation-contract-out-'));
    try {
      withPackage({
        caseId: 'tc_obs_contract_multi', observations: multiObservations, events: multiEvents,
        receiptOptions: { schemaVersion: 2, sessionNonce: 'contract-session-complete' },
      }, (bundle) => {
        expectExit(run(INTAKE, [bundle.sidecarDoc.caseId, '--capture', bundle.capturePath]), 0, 'multi intake');
        expectExit(run(DISTILL, [bundle.sidecarDoc.caseId, '--capture', bundle.capturePath, '--out-dir', outRoot]), 0, 'multi distill');
        const probe = run(PROBE, [bundle.sidecarDoc.caseId, bundle.capturePath, '2']);
        expectExit(probe, 0, 'trusted multi consumer');
        if (!probe.stdout.includes('2/2')) throw new Error('trusted multi consumer 未逐项覆盖两观察');
      });
    } finally { rmSync(outRoot, { recursive: true, force: true }); }
  });
} finally {
  rmSync(supportRoot, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`\nobservation identity contract closure: ${passed} passed, ${failures.length} failed`);
  process.exit(1);
}
console.log(`\nobservation identity contract closure: ${passed}/6 passed`);

