#!/usr/bin/env node
// zero-SUT：入账竞态换包 fail-safe 原子性金牌。禁止 SUT/browser/server/network/fake，仅 tmpdir + 固定 cases 根租约。
//
// 复现 codex High：命令行层预检读包 A 算五字段事实，权威内核落账前若磁盘被换成包 B，
// 「预检事实」与「落账事实」不一致时机器必须在 committed 之前拒绝、accepted 台账零新增。
// 换包用确定性测试接缝：ESM loader 把权威根重定向到 swap-shim，shim 在 append 入口（命令行层
// 预检之后、内核 readPackage 之前）把磁盘包 A 覆盖为包 B，再委托真 append。
// 修复前：内核落账 B 后命令行层才事后比对 → exit 65 但台账已增 → 本金牌红。
// 修复后：内核在事务内、rename 之前把 expectedFacts（预检事实 A）与落账事实（B）逐一比对，
//         不符即拒、绝不 committed → exit 65 且 accepted 台账零新增 → 绿。
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as packageApi from '../../lib/entity-semantic-lock-package.mjs';
import * as identityApi from '../../lib/teachin-identity-observations.mjs';
import { buildTeachInCapture } from '../../lib/record-capture.mjs';
import { acquireCanonicalCaseLease } from './support/canonical-case-lease.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const INTAKE = join(ROOT, 'bin', 'intake.mjs');
const CASE_ID = 'tc_intake_swap_race';
const SCOPE_A = `sha256:${'a'.repeat(64)}`;
const EVIDENCE_A = `sha256:${'c'.repeat(64)}`;
const SCOPE_B = `sha256:${'d'.repeat(64)}`;
const EVIDENCE_B = `sha256:${'e'.repeat(64)}`;
const PACKAGE_FILES = ['teach-in-capture.json', 'identity-observations.json', 'teach-in-package.json'];
const RECEIPT_FILE = 'identity-readback-receipt.json';
const V1_PAYLOAD_KEYS = [
  'schemaVersion', 'artifactKind', 'source', 'keyId', 'algorithm', 'sessionNonce', 'caseId',
  'captureSha256', 'sidecarSha256', 'manifestSha256', 'eventSeq', 'kind', 'name', 'code',
  'platformId', 'scopeFingerprint', 'evidenceSha256',
];

let passed = 0;
const failures = [];
function check(name, fn) {
  try { fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
}
function hash(bytes) { return `sha256:${createHash('sha256').update(bytes).digest('hex')}`; }
function pick(value, keys) { return Object.fromEntries(keys.map((key) => [key, value[key]])); }

const keyPair = generateKeyPairSync('ed25519');
const KEY_ID = 'casey-swap-race-test-key';

function observation(kind, name, code, platformId, scope, evidence) {
  return {
    kind, name, code, platformId,
    scopeFingerprint: scope, parent: null,
    evidenceKind: 'detail-dual-anchor-readback', eventSeq: 1, evidenceSha256: evidence,
  };
}
function buildBundle({ name, code, platformId, scope, evidence }) {
  const obs = observation('workflow', name, code, platformId, scope, evidence);
  const sidecar = identityApi.buildIdentityObservationSidecar({ caseId: CASE_ID, observations: [obs] });
  const sidecarRaw = identityApi.serializeIdentityObservationSidecar(sidecar);
  const capture = identityApi.bindCaptureIdentityObservations({
    capture: buildTeachInCapture({
      caseId: CASE_ID,
      startUrl: '/ai-manager/process/list',
      createdAt: '2026-07-17T00:00:00.000Z',
      events: [{ action: 'click', path: '/ai-manager/process/list', text: name }],
    }),
    observationRaw: sidecarRaw,
  });
  const captureRaw = `${JSON.stringify(capture, null, 2)}\n`;
  const manifest = packageApi.buildTeachInPackageManifest({
    caseId: CASE_ID, captureBytes: captureRaw, sidecarBytes: sidecarRaw,
    observationCount: 1, observationSchemaVersion: sidecar.schemaVersion,
  });
  const manifestRaw = packageApi.serializeTeachInPackageManifest(manifest);
  const review = packageApi.verifyTeachInPackage({ caseId: CASE_ID, captureBytes: captureRaw, sidecarBytes: sidecarRaw, manifestBytes: manifestRaw });
  if (!review.ok) throw new Error(`bundle 前提失败: ${review.reason}`);
  return { obs, captureRaw, sidecarRaw, manifestRaw, review };
}
function signedReceipt(bundle) {
  const envelope = {
    schemaVersion: 1,
    artifactKind: 'platform-identity-readback-receipt',
    source: 'platform-runtime',
    keyId: KEY_ID,
    algorithm: 'Ed25519',
    sessionNonce: 'swap-race-session-1',
    caseId: CASE_ID,
    captureSha256: bundle.review.captureSha256,
    sidecarSha256: bundle.review.sidecarSha256,
    manifestSha256: bundle.review.manifestSha256,
    ...pick(bundle.obs, ['eventSeq', 'kind', 'name', 'code', 'platformId', 'scopeFingerprint', 'evidenceSha256']),
  };
  const payload = pick(envelope, V1_PAYLOAD_KEYS);
  return { ...envelope, signature: sign(null, Buffer.from(JSON.stringify(payload)), keyPair.privateKey).toString('base64') };
}
function writeArtifacts(dir, bundle) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'teach-in-capture.json'), bundle.captureRaw);
  writeFileSync(join(dir, 'identity-observations.json'), bundle.sidecarRaw);
  writeFileSync(join(dir, 'teach-in-package.json'), bundle.manifestRaw);
}

// ── 生成隔离 ESM loader：production registry → 测试发布（信本进程 key）；
//    带 CASEY_SWAP_SRC 时权威根 → swap-shim（命令行层预检后、内核读前确定性换包）──
const supportRoot = mkdtempSync(join(tmpdir(), 'casey-swap-race-support-'));
const publicationPath = join(supportRoot, 'publication.mjs');
const shimPath = join(supportRoot, 'swap-shim.mjs');
const loaderPath = join(supportRoot, 'loader.mjs');
const productionRegistryUrl = pathToFileURL(join(ROOT, 'lib', 'teachin-observation-driver-registry.mjs')).href;
const authorityRootUrl = pathToFileURL(join(ROOT, 'lib', 'teachin-observation-authority-root.mjs')).href;
const shimUrl = pathToFileURL(shimPath).href;
const publicationUrl = pathToFileURL(publicationPath).href;

writeFileSync(publicationPath, [
  `const KEY_ID = ${JSON.stringify(KEY_ID)};`,
  `const PUBLIC_KEY = ${JSON.stringify(keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString())};`,
  'export function trustedDriverPublicKeyFor(value) { return value === KEY_ID ? PUBLIC_KEY : null; }',
  "export function driverRegistryReadiness() { return Object.freeze({ ready: true, reason: null, route: 'test-only', publication: 'swap-race-loader' }); }",
].join('\n') + '\n');

writeFileSync(shimPath, [
  "import { copyFileSync } from 'node:fs';",
  "import { join } from 'node:path';",
  `import * as real from ${JSON.stringify(authorityRootUrl)};`,
  `export * from ${JSON.stringify(authorityRootUrl)};`,
  'let swapped = false;',
  'export function appendAcceptedObservationPackage(options) {',
  '  const src = process.env.CASEY_SWAP_SRC;',
  '  const dest = process.env.CASEY_SWAP_DEST;',
  '  if (!swapped && src && dest) {',
  "    for (const name of ['teach-in-capture.json', 'identity-observations.json', 'teach-in-package.json', 'identity-readback-receipt.json']) {",
  '      copyFileSync(join(src, name), join(dest, name));',
  '    }',
  '    swapped = true;',
  '  }',
  '  return real.appendAcceptedObservationPackage(options);',
  '}',
].join('\n') + '\n');

writeFileSync(loaderPath, [
  `const productionRegistry = ${JSON.stringify(productionRegistryUrl)};`,
  `const publication = ${JSON.stringify(publicationUrl)};`,
  `const authorityRoot = ${JSON.stringify(authorityRootUrl)};`,
  `const swapShim = ${JSON.stringify(shimUrl)};`,
  'export async function resolve(specifier, context, nextResolve) {',
  '  const resolved = await nextResolve(specifier, context);',
  '  if (resolved.url === productionRegistry) return { url: publication, shortCircuit: true };',
  '  if (process.env.CASEY_SWAP_SRC && resolved.url === authorityRoot && context.parentURL !== swapShim) {',
  '    return { url: swapShim, shortCircuit: true };',
  '  }',
  '  return resolved;',
  '}',
].join('\n') + '\n');

function runIntake(capturePath, swap) {
  const env = { ...process.env };
  delete env.CASEY_SWAP_SRC;
  delete env.CASEY_SWAP_DEST;
  if (swap) { env.CASEY_SWAP_SRC = swap.src; env.CASEY_SWAP_DEST = swap.dest; }
  return spawnSync(process.execPath, ['--experimental-loader', loaderPath, INTAKE, CASE_ID, '--capture', capturePath], {
    cwd: ROOT, encoding: 'utf8', timeout: 30000, env,
  });
}
function acceptedCount(ledgerPath) {
  if (!existsSync(ledgerPath)) return 0;
  return readFileSync(ledgerPath, 'utf8').trim().split('\n').filter((line) => line.trim())
    .map((line) => JSON.parse(line)).filter((entry) => entry?.intakeStatus === 'accepted').length;
}

const packageA = buildBundle({ name: '另一个工作流', code: 'wf-002', platformId: '90071992547409939999', scope: SCOPE_B, evidence: EVIDENCE_B });
const packageB = buildBundle({ name: '审批工作流', code: 'wf-001', platformId: '90071992547409931234', scope: SCOPE_A, evidence: EVIDENCE_A });
const receiptB = signedReceipt(packageB);

check('前提：预检包 A 与落账包 B 三件套事实互不相同（换包场景成立）', () => {
  if (packageA.review.captureSha256 === packageB.review.captureSha256
    || packageA.review.sidecarSha256 === packageB.review.sidecarSha256
    || packageA.review.manifestSha256 === packageB.review.manifestSha256) {
    throw new Error('包 A / 包 B 三件套 hash 未区分，换包不可判别');
  }
});

const swapSrc = mkdtempSync(join(tmpdir(), 'casey-swap-race-srcB-'));
writeArtifacts(swapSrc, packageB);
writeFileSync(join(swapSrc, RECEIPT_FILE), `${JSON.stringify(receiptB, null, 2)}\n`);

const lease = acquireCanonicalCaseLease({ caseId: CASE_ID });
const capturePath = join(lease.packageDir, 'teach-in-capture.json');
const ledgerPath = join(lease.packageDir, 'intake-ledger.jsonl');
try {
  // ── 正向对照：无换包，签名包 B 正常 intake → 落唯一 committed accepted（证发布/加载装置可用）──
  check('对照：无换包时签名包 B 正常 intake → exit 0 且唯一 committed accepted', () => {
    writeArtifacts(lease.packageDir, packageB);
    writeFileSync(join(lease.packageDir, RECEIPT_FILE), `${JSON.stringify(receiptB, null, 2)}\n`);
    const result = runIntake(capturePath, null);
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`对照 intake 未 accept：exit=${result.status}; stderr=${result.stderr}`);
    if (acceptedCount(ledgerPath) !== 1) throw new Error('对照 intake 未落唯一 accepted 行');
    const latest = JSON.parse(readFileSync(ledgerPath, 'utf8').trim().split('\n').at(-1));
    if (latest.transactionState !== 'committed' || latest.captureSha256 !== packageB.review.captureSha256) {
      throw new Error('对照 accepted 行未 committed 或未绑定包 B 事实');
    }
  });

  // ── 承重：换包竞态。命令行层预检包 A（facts_A），append 入口 shim 换成包 B，内核以 B 落账。──
  check('承重：预检 A 落账 B 不一致时 → exit 65 且 accepted 台账零新增（落账前拒）', () => {
    rmSync(ledgerPath, { force: true });
    rmSync(join(lease.packageDir, RECEIPT_FILE), { force: true });
    writeArtifacts(lease.packageDir, packageA); // 命令行层预检将读到包 A
    const result = runIntake(capturePath, { src: swapSrc, dest: lease.packageDir });
    if (result.error) throw result.error;
    // fail-safe：明确非零退出码（用法/数据 65），凭据/绝对路径不回显
    if (result.status === 0) throw new Error(`换包竞态被 intake accept：exit=0; stderr=${result.stderr}`);
    if (/\.auth|BEGIN [A-Z]+ KEY/.test(`${result.stdout}${result.stderr}`)) throw new Error('输出疑似泄露凭据');
    // 换包确已发生：磁盘现为包 B（证接缝真触发，非空跑）
    if (hash(readFileSync(capturePath)) !== packageB.review.captureSha256) {
      throw new Error('swap-shim 未换入包 B，换包接缝未触发');
    }
    // 原子性硬断言：不一致 → committed 台账零新增（修复前此处红，因内核落账 B 后命令行层才事后比对）
    const count = acceptedCount(ledgerPath);
    if (count !== 0) throw new Error(`换包不一致仍落账：accepted 新增 ${count} 行（fail-safe 失败必须干净被违反）`);
  });
} finally {
  const cleaned = lease.cleanup();
  if (!cleaned.ok) failures.push(`lease cleanup: ${cleaned.reason}`);
  rmSync(swapSrc, { recursive: true, force: true });
  rmSync(supportRoot, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`\nteachin intake swap race: ${passed} passed, ${failures.length} failed`);
  process.exit(1);
}
console.log(`\nteachin intake swap race: ${passed}/3 passed`);
