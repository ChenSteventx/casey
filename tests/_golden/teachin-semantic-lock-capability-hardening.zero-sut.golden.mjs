#!/usr/bin/env node
// 语义锁能力边界金牌 —— 可达面（H4 唯一权威来源 / H1 events 与锁集精确对齐）。
// 纯 node、zero-SUT：禁止 SUT、浏览器、server 与网络。
//
// 权威注入手法（温拷贝）：真实 lib/ 拷进一次性 os 临时目录，令副本 PROJECT_ROOT 落在
// 临时目录内，往 release/entity-semantic-lock/ 写冻结锁字节、以外部摘要登记发布表，从
// 副本 import v2 引擎。生产 publications 表始终为空（fail-closed），此处不触真实仓库。
//
// 覆盖面（结构性可达，今日全绿）：
//   H4 固定 PRD/checksum reader 是唯一锁 authority 来源：authority 句柄身份不可展开副本、
//      未登记 contract/键拒、contractId 路径穿越拒、调用者 prdPath 覆盖拒、reader 与 verify
//      的调用者 bytes+sha 自签入口一律闭合。
//   H1 只认真实 events 文档、event 三元 binding 与锁集精确对齐：events 侧任何篡改按结构
//      或 eventsSha256 密码学绑定拒；锁集侧 binding 三元错位（即便 events 规范）也被
//      binding-authority 交叉核拒。
// 不可达面（H2/H3 —— runtime capability 铸造/successor 语义）随冻结意图「运行时出处不可
// 执行」迁入 teachin-semantic-lock-runtime-discrimination-successor 前瞻红基线，本金牌不覆盖。

import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CONTRACT_ID = 'teachin-semantic-lock-capability-hardening';
const CASE_ID = 'tc_semantic_lock_capability';
const LIB_ROOT = fileURLToPath(new URL('../../lib/', import.meta.url));
const LOCK_PATH = new URL('./fixtures/teachin-semantic-lock-capability-hardening/entity-locks.frozen.json', import.meta.url);
const EVENTS_PATH = new URL('./fixtures/teachin-semantic-lock-capability-hardening/events.document.json', import.meta.url);
const OLD_LOCK_PATH = new URL('./fixtures/teachin-semantic-lock-v2/entity-locks.frozen.json', import.meta.url);
const OLD_EVENTS_PATH = new URL('./fixtures/teachin-semantic-lock-v2/events.document.json', import.meta.url);
const lockBytes = readFileSync(LOCK_PATH);
const eventsBytes = readFileSync(EVENTS_PATH);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

// ---- 温拷贝临时仓 ----
const ROOT = mkdtempSync(join(tmpdir(), 'casey-lock-capability-'));
cpSync(LIB_ROOT, join(ROOT, 'lib'), { recursive: true });
const locks = {};
function publish(name, bytes, frozenDigest) {
  const key = `release/entity-semantic-lock/capability/${name}`;
  const path = join(ROOT, key);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
  locks[key] = frozenDigest ?? sha256(bytes);
  return key;
}

const keyValid = publish('entity-locks.frozen.json', lockBytes);

// 锁集侧 binding 三元错位：把冻结 binding 的 role 改成 events 里不存在的 'target'，
// 但保留 canonical eventsSha256（events 仍规范、sha 仍匹配），令 binding-authority 交叉核
// 成为决定项（证明该核确实运行、非被 sha 门短路）。
const misLock = JSON.parse(lockBytes.toString('utf8'));
misLock.bindings[0].role = 'target';
const keyMisaligned = publish('misaligned.locks.json', Buffer.from(JSON.stringify(misLock)));

writeFileSync(
  join(ROOT, 'lib', 'entity-semantic-lock-publications.mjs'),
  `export const ENTITY_SEMANTIC_LOCK_PUBLICATIONS = ${JSON.stringify({
    [CONTRACT_ID]: { source: 'release-resource', mode: 'historical', locks },
  })};\n`,
);

let api;
try {
  api = await import(`${pathToFileURL(join(ROOT, 'lib', 'entity-semantic-lock-v2.mjs')).href}?capability`);
} catch (error) {
  console.error(`RED  teachin-semantic-lock-capability-hardening: 温拷贝 v2 引擎 import 失败: ${error.message}`);
  rmSync(ROOT, { recursive: true, force: true });
  process.exit(1);
}

const authorityFor = (lockSetKey, overrides = {}) => api.readFrozenEntityLockSetAuthority({
  contractId: CONTRACT_ID, lockSetKey, ...overrides,
});
const verify = (authority, eventsOverride = eventsBytes) => api.verifyEntityLockSet({
  authority, caseId: CASE_ID, eventsBytes: eventsOverride,
});

let passed = 0;
const failures = [];
async function check(name, fn) {
  try { await fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
}
function assertReason(result, expected, label) {
  if (result?.ok === true || result?.allowAction === true || result?.handle) throw new Error(`${label}: 未拒 -> ${JSON.stringify(result)}`);
  if (result?.reason !== expected) throw new Error(`${label}: 期望 ${expected}, 实得 ${JSON.stringify(result)}`);
}
function cloneEvents() { return JSON.parse(eventsBytes.toString('utf8')); }
function bytesOf(value) { return Buffer.from(JSON.stringify(value)); }

await check('H4 固定 PRD/checksum reader 是唯一锁 authority 来源，句柄不可展开、路径穿越/键旁路/bytes 自签一律拒', () => {
  const loaded = authorityFor(keyValid);
  if (!loaded.ok || !loaded.authority) throw new Error(`合法 authority 未签发: ${JSON.stringify(loaded)}`);
  const checked = verify(loaded.authority);
  if (!checked.ok || !checked.handle) throw new Error(`合法 authority 被拒: ${JSON.stringify(checked)}`);

  // authority 是不透明句柄（WeakMap 私钥）：展开副本丢失身份。
  assertReason(api.verifyEntityLockSet({ authority: { ...loaded.authority }, caseId: CASE_ID, eventsBytes }), 'ENTITY_LOCK_AUTHORITY_INVALID', '展开副本冒充 authority');
  // 未登记 contract / 键。
  assertReason(authorityFor(keyValid, { contractId: 'unknown-contract' }), 'ENTITY_LOCK_AUTHORITY_NOT_PUBLISHED', '未登记 contract');
  assertReason(authorityFor('release/entity-semantic-lock/capability/not-published.json'), 'ENTITY_LOCK_AUTHORITY_NOT_PUBLISHED', 'PRD 未登记键');
  // contractId 路径穿越（正则闭合）。
  assertReason(authorityFor(keyValid, { contractId: '../../unknown-contract' }), 'ENTITY_LOCK_AUTHORITY_INVALID', 'contractId 路径穿越');
  // 调用者 prdPath 覆盖固定 reader（closedObject 拒多余键）。
  assertReason(authorityFor(keyValid, { prdPath: 'loop/prd-teachin-semantic-lock-v2.json' }), 'ENTITY_LOCK_AUTHORITY_INVALID', 'prdPath 覆盖固定 reader');
  // reader 接受调用者 bytes+sha 自签。
  assertReason(authorityFor(keyValid, { lockSetBytes: lockBytes, trustedSetSha256: sha256(lockBytes) }), 'ENTITY_LOCK_AUTHORITY_INVALID', 'reader 接受调用者 bytes+sha');

  // 旧 v2 真实冻结字节 + 调用者自算摘要，直投 verify 的旧自签入口。superseding API 必须闭合。
  const oldLock = readFileSync(OLD_LOCK_PATH);
  const oldEvents = readFileSync(OLD_EVENTS_PATH);
  assertReason(api.verifyEntityLockSet({
    lockSetBytes: oldLock, trustedSetSha256: sha256(oldLock), caseId: 'tc_semantic_lock_v2', eventsBytes: oldEvents,
  }), 'ENTITY_LOCK_AUTHORITY_INVALID', '调用者 bytes+sha 同传自签');
});

await check('H1 只认真实 events 文档，event 三元 binding 与锁集精确对齐（结构拒 / eventsSha256 绑定拒 / binding-authority 交叉核拒）', () => {
  const authority = authorityFor(keyValid).authority;

  // events 结构破坏 → 文档解析拒。
  assertReason(verify(authority, bytesOf(cloneEvents().events)), 'ENTITY_LOCK_EVENTS_INVALID', 'events 裸数组');
  { const d = cloneEvents(); delete d.events[0].entityBindings; assertReason(verify(authority, bytesOf(d)), 'ENTITY_LOCK_EVENTS_INVALID', 'events 缺 entityBindings'); }
  { const d = cloneEvents(); d.events[0].entityBindings.push(JSON.parse(JSON.stringify(d.events[0].entityBindings[0]))); assertReason(verify(authority, bytesOf(d)), 'ENTITY_LOCK_EVENTS_INVALID', 'events 重复 binding'); }

  // events 保持结构、改一字节 → eventsSha256 密码学绑定断链。
  { const d = cloneEvents(); d.events[0].entityBindings[0].role = 'target'; assertReason(verify(authority, bytesOf(d)), 'ENTITY_LOCK_SET_INVALID', 'events role 漂移'); }
  { const d = cloneEvents(); d.events[0].entityBindings[0].candidate = 'candidate-other'; assertReason(verify(authority, bytesOf(d)), 'ENTITY_LOCK_SET_INVALID', 'events candidate 漂移'); }
  { const d = cloneEvents(); d.events[0].entityBindings[0].lockAuthority.lockId = 'lock-other'; assertReason(verify(authority, bytesOf(d)), 'ENTITY_LOCK_SET_INVALID', 'events lockId 漂移'); }
  { const d = cloneEvents(); d.events[0].entityBindings[0].lockAuthority.receiptHash = '0'.repeat(64); assertReason(verify(authority, bytesOf(d)), 'ENTITY_LOCK_SET_INVALID', 'events receiptHash 漂移'); }

  // 锁集侧 binding 三元错位（events 规范、sha 匹配）→ binding-authority 交叉核拒。
  const misAuth = authorityFor(keyMisaligned);
  if (!misAuth.ok) throw new Error(`错位锁集冻结文件不可读: ${JSON.stringify(misAuth)}`);
  assertReason(verify(misAuth.authority), 'ENTITY_LOCK_SET_INVALID', '锁集 binding 三元错位被放行');
});

rmSync(ROOT, { recursive: true, force: true });

if (failures.length) {
  for (const failure of failures) console.error(`RED  teachin-semantic-lock-capability-hardening: ${failure}`);
  console.error(`RED  teachin-semantic-lock-capability-hardening: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   teachin-semantic-lock-capability-hardening: ${passed}/${passed} 全过（温拷贝注入，zero-SUT）`);
