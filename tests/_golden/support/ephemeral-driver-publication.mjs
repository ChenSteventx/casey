// 共用 support 件：临时 Ed25519 密钥 + 临时 driver-registry 发布模块 + 隔离 loader。
// 三块金牌（observation-identity-contract-closure / record-distill / teachin-observation-authority-root）
// 都要「动态签一份 platform-identity-readback-receipt，且能过生产 validateReceiptDocument 验签」这同一件事，
// 抽出来避免每个金牌各自重写一遍密码学与 loader 重定向。
//
// 做法照抄 observation-identity-contract-closure.zero-sut.golden.mjs :51-:106 与
// tests/_golden/fixtures/observation-runtime-trust-root/test-driver-publication-loader.mjs 的现役先例：
// 生产 lib/teachin-observation-driver-registry.mjs 永远诚实返回「未发布」（DRIVER_NOT_PUBLISHED /
// trustedDriverPublicKeyFor 恒 null）；测试要验签必须用 --experimental-loader 把该模块的 import
// 短路重定向到测试自己临时生成的发布模块，绝不回流真实私钥或改生产代码。
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { PROJECT_ROOT } from '../../../lib/paths.mjs';

// 与 lib/teachin-observation-authority-root.mjs 的 SIGNED_V1_PAYLOAD_KEYS 严格同形同序：
// 顺序决定 JSON.stringify 的字节序，字节序不同签名就核不过。
export const V1_PAYLOAD_KEYS = Object.freeze([
  'schemaVersion', 'artifactKind', 'source', 'keyId', 'algorithm', 'sessionNonce', 'caseId',
  'captureSha256', 'sidecarSha256', 'manifestSha256', 'eventSeq', 'kind', 'name', 'code',
  'platformId', 'scopeFingerprint', 'evidenceSha256',
]);

// 与 lib/teachin-observation-authority-root.mjs 的 SIGNED_V2_PAYLOAD_KEYS 严格同形同序。
export const V2_PAYLOAD_KEYS = Object.freeze([
  'schemaVersion', 'artifactKind', 'source', 'keyId', 'algorithm', 'sessionNonce', 'caseId',
  'captureSha256', 'sidecarSha256', 'manifestSha256', 'observations',
]);

// 与 lib/teachin-observation-authority-root.mjs 的 RECEIPT_OBSERVATION_KEYS 严格同形同序，
// 供调用方在拼 receiptObservations 时 pick 同一批字段。
export const RECEIPT_OBSERVATION_KEYS = Object.freeze([
  'kind', 'name', 'code', 'platformId', 'scopeFingerprint', 'parent', 'evidenceKind', 'eventSeq', 'evidenceSha256',
]);

const PRODUCTION_REGISTRY_URL = pathToFileURL(join(PROJECT_ROOT, 'lib/teachin-observation-driver-registry.mjs')).href;

function pick(value, keys) {
  return Object.fromEntries(keys.map((key) => [key, value[key]]));
}

function payloadFor(envelope) {
  return envelope.schemaVersion === 2 ? pick(envelope, V2_PAYLOAD_KEYS) : pick(envelope, V1_PAYLOAD_KEYS);
}

// 生成临时 Ed25519 密钥对 + 临时发布模块 + 指向它的隔离 loader；三金牌共用的最小 API。
// tmpDir 可选：不传则自建独立临时目录；传入时在其下再开一个专属子目录，cleanup 只清自己这份，
// 不动调用方对 tmpDir 本身的所有权。
export function createEphemeralDriverPublication({ tmpDir } = {}) {
  const ownRoot = tmpDir
    ? mkdtempSync(join(tmpDir, 'ephemeral-driver-'))
    : mkdtempSync(join(tmpdir(), 'casey-ephemeral-driver-'));
  const keyId = `casey-ephemeral-driver-${randomUUID()}`;
  const keyPair = generateKeyPairSync('ed25519');
  const publicKeyPem = keyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const publicationPath = join(ownRoot, 'publication.mjs');
  const loaderPath = join(ownRoot, 'loader.mjs');

  writeFileSync(publicationPath, [
    '// 测试专属临时发布模块：仅本进程内存生成的密钥对导出物，绝非真实发行签名资源。',
    `const KEY_ID = ${JSON.stringify(keyId)};`,
    `const PUBLIC_KEY = ${JSON.stringify(publicKeyPem)};`,
    'export function trustedDriverPublicKeyFor(value) { return value === KEY_ID ? PUBLIC_KEY : null; }',
    "export function driverRegistryReadiness() { return Object.freeze({ ready: true, reason: null, route: 'test-only', publication: 'ephemeral-support' }); }",
    '',
  ].join('\n'));

  writeFileSync(loaderPath, [
    '// 测试专属隔离 loader：把生产 driver-registry 的 import 短路重定向到上面的临时发布模块。',
    `const productionRegistry = ${JSON.stringify(PRODUCTION_REGISTRY_URL)};`,
    `const testPublication = ${JSON.stringify(pathToFileURL(publicationPath).href)};`,
    'export async function resolve(specifier, context, nextResolve) {',
    '  const resolved = await nextResolve(specifier, context);',
    '  if (resolved.url === productionRegistry) return { url: testPublication, shortCircuit: true };',
    '  return resolved;',
    '}',
    '',
  ].join('\n'));

  // 对齐 lib/teachin-observation-authority-root.mjs 的 canonicalSignedPayload：
  // 按 schemaVersion 选中对应 key 列表、按该顺序取值再 JSON.stringify，与生产验签同一份规范化字节序。
  function signReceipt(receiptDocSansSignature) {
    const payload = payloadFor(receiptDocSansSignature);
    const signature = sign(null, Buffer.from(JSON.stringify(payload), 'utf8'), keyPair.privateKey).toString('base64');
    return { ...receiptDocSansSignature, signature };
  }

  function cleanup() {
    rmSync(ownRoot, { recursive: true, force: true });
    return { ok: true };
  }

  return { keyId, loaderPath, publicationPath, signReceipt, cleanup };
}
