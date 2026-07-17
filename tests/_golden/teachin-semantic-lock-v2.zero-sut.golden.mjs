#!/usr/bin/env node
// 语义锁 v2 冻结攻击回归 —— 可达面（V2-A 外部锚 / V2-B schema·策略不降级）。
// 纯 node、zero-SUT：禁止浏览器、网络、fake/fixture SUT。
//
// 权威注入手法（温拷贝）：把真实 lib/ 拷进一次性 os 临时目录，令该副本的
// PROJECT_ROOT 落在临时目录内，再往 release/entity-semantic-lock/ 写入冻结锁字节、
// 并以「与字节分离」的外部摘要登记发布表，从副本 import v2 引擎发起攻击。生产
// publications 表始终为空（fail-closed），此处不触真实仓库、不回填任何发布。
//
// 覆盖面（结构性可达，今日全绿）：
//   V2-A 外部冻结 digest 锚 —— 收据自证 hash 重算后仍被外锚拒（CHECKSUM_MISMATCH）、
//        caseId 错配、events 与锁集密码学绑定错配。
//   V2-B parseReceipt/parseLockSet 严格闭合 —— schema/策略不可降级、收据侧缺 platformId、
//        无静默 trim、证据缺失，各畸形变体各自发布为独立冻结文件+外部摘要。
// runtimeAuthorized 恒 false 是当前冻结意图（运行时出处不可执行）：evaluate/successor
// 的判别面结构性不可达，已迁入 teachin-semantic-lock-runtime-discrimination-successor
// 前瞻红基线，本金牌不覆盖。

import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CONTRACT_ID = 'teachin-semantic-lock-v2';
const CASE_ID = 'tc_semantic_lock_v2';
const LIB_ROOT = fileURLToPath(new URL('../../lib/', import.meta.url));
const LOCK_PATH = new URL('./fixtures/teachin-semantic-lock-v2/entity-locks.frozen.json', import.meta.url);
const EVENTS_PATH = new URL('./fixtures/teachin-semantic-lock-v2/events.document.json', import.meta.url);
const validLockBytes = readFileSync(LOCK_PATH);
const validEventsBytes = readFileSync(EVENTS_PATH);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const canonicalReceipt = (receipt) => ({
  lockId: receipt.lockId, kind: receipt.kind, bindingMode: receipt.bindingMode,
  name: receipt.name, code: receipt.code, platformId: receipt.platformId,
  scopeSha256: receipt.scopeSha256, parentReceiptHash: receipt.parentReceiptHash,
  revisionId: receipt.revisionId, provenance: receipt.provenance,
});
const selfSignReceipt = (receipt) => ({
  ...receipt, receiptHash: sha256(JSON.stringify(canonicalReceipt(receipt))),
});

// ---- 温拷贝临时仓 ----
const ROOT = mkdtempSync(join(tmpdir(), 'casey-lock-v2-'));
cpSync(LIB_ROOT, join(ROOT, 'lib'), { recursive: true });
const locks = {};
function releaseKey(name) { return `release/entity-semantic-lock/v2/${name}`; }
function publish(name, bytes, frozenDigest) {
  const key = releaseKey(name);
  const path = join(ROOT, key);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
  locks[key] = frozenDigest ?? sha256(bytes);
  return key;
}
function cloneValid() { return JSON.parse(validLockBytes.toString('utf8')); }

// 合法锁集（外部摘要=真字节摘要）。
const keyValid = publish('valid.locks.json', validLockBytes);

// V2-A 篡改：改 code 后自行重算内部 receiptHash（自证 hash 内部自洽），但发布表
// 仍钉死原字节的外部摘要 → 读权威即被外锚拒。
const tampered = cloneValid();
tampered.receipts[0].code = 'wf-attacker';
tampered.receipts[0] = selfSignReceipt(tampered.receipts[0]);
tampered.bindings[0].receiptHash = tampered.receipts[0].receiptHash;
tampered.transitions[0].previousReceiptHash = tampered.receipts[0].receiptHash;
const keyTamper = publish('tampered.locks.json', Buffer.from(JSON.stringify(tampered)), sha256(validLockBytes));

// V2-B 畸形变体：各自发布为独立冻结文件+外部摘要（摘要与字节一致，故文件可读，
// 攻击落在 parseReceipt/parseLockSet 的严格闭合上）。
const variantB = [];
function publishVariant(name, mutate) {
  const doc = cloneValid();
  mutate(doc);
  variantB.push({ name, key: publish(`b-${name}.locks.json`, Buffer.from(JSON.stringify(doc))) });
}
publishVariant('extra-top-key', (d) => { d.extra = true; });
publishVariant('missing-platform-id', (d) => { delete d.receipts[0].platformId; });
publishVariant('number-platform-id', (d) => { d.receipts[0].platformId = 9007199254740993; });
publishVariant('policy-revision-downgrade', (d) => { d.identityPolicies[0].revision = 'any'; });
publishVariant('leading-space-name', (d) => { d.receipts[0].name = ' 审批工作流'; });
publishVariant('empty-provenance-ref', (d) => { d.receipts[0].provenance = { kind: 'user-approval', ref: '' }; });

writeFileSync(
  join(ROOT, 'lib', 'entity-semantic-lock-publications.mjs'),
  `export const ENTITY_SEMANTIC_LOCK_PUBLICATIONS = ${JSON.stringify({
    [CONTRACT_ID]: { source: 'release-resource', mode: 'historical', locks },
  })};\n`,
);

let api;
try {
  api = await import(`${pathToFileURL(join(ROOT, 'lib', 'entity-semantic-lock-v2.mjs')).href}?v2`);
} catch (error) {
  console.error(`RED  teachin-semantic-lock-v2: 温拷贝 v2 引擎 import 失败: ${error.message}`);
  rmSync(ROOT, { recursive: true, force: true });
  process.exit(1);
}

const authorityFor = (lockSetKey) => api.readFrozenEntityLockSetAuthority({ contractId: CONTRACT_ID, lockSetKey });
const verify = (authority, overrides = {}) => api.verifyEntityLockSet({
  authority, caseId: CASE_ID, eventsBytes: validEventsBytes, ...overrides,
});

let passed = 0;
const failures = [];
async function check(name, fn) {
  try { await fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
}
function assertReason(result, expected, label) {
  if (result?.ok === true || result?.allowAction === true) throw new Error(`${label}: 未拒 -> ${JSON.stringify(result)}`);
  if (result?.reason !== expected) throw new Error(`${label}: 期望 ${expected}, 实得 ${JSON.stringify(result)}`);
}

await check('V2-A 外部冻结 digest 锚：自证 hash 重算被外锚拒，caseId/events 密码学绑定错配拒', () => {
  const good = authorityFor(keyValid);
  if (!good.ok || !good.authority) throw new Error(`合法锁集未签发 authority: ${JSON.stringify(good)}`);
  const handle = verify(good.authority);
  if (!handle.ok || !handle.handle) throw new Error(`合法锁集未建立 handle: ${JSON.stringify(handle)}`);

  // 篡改自证 hash：内部自洽，外部冻结摘要仍拒。
  assertReason(authorityFor(keyTamper), 'ENTITY_LOCK_AUTHORITY_CHECKSUM_MISMATCH', '篡改锁集被外锚放行');

  // caseId 错配：events 文档 caseId 先行不匹配。
  assertReason(verify(good.authority, { caseId: 'other-case' }), 'ENTITY_LOCK_EVENTS_INVALID', 'caseId 错配被放行');

  // events 与锁集 eventsSha256 绑定：同 caseId 但改一字节即断链。
  const drifted = JSON.parse(validEventsBytes.toString('utf8'));
  drifted.recordedAt = '2026-07-18T00:00:00.000Z';
  assertReason(verify(good.authority, { eventsBytes: Buffer.from(JSON.stringify(drifted)) }), 'ENTITY_LOCK_SET_INVALID', 'events 换字节被放行');

  // 裸数组冒充 events 文档。
  assertReason(verify(good.authority, { eventsBytes: Buffer.from('[]') }), 'ENTITY_LOCK_EVENTS_INVALID', 'events 裸数组被放行');
});

await check('V2-B parseReceipt/parseLockSet 严格闭合：schema/策略不降级、缺 platformId、无静默 trim、证据缺失', () => {
  for (const variant of variantB) {
    const loaded = authorityFor(variant.key);
    if (!loaded.ok || !loaded.authority) throw new Error(`畸形变体 ${variant.name} 冻结文件不可读: ${JSON.stringify(loaded)}`);
    assertReason(verify(loaded.authority), 'ENTITY_LOCK_SET_INVALID', `畸形锁集 ${variant.name} 被放行`);
  }
});

rmSync(ROOT, { recursive: true, force: true });

if (failures.length) {
  for (const failure of failures) console.error(`RED  teachin-semantic-lock-v2: ${failure}`);
  console.error(`RED  teachin-semantic-lock-v2: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   teachin-semantic-lock-v2: ${passed}/${passed} 全过（温拷贝注入，zero-SUT）`);
