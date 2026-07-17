#!/usr/bin/env node
// 运行权威金牌 —— 可达面（roles 冻结动作角色策略拒绝 / publication 发布 trust root 闭合）。
// 纯 node、zero-SUT：禁止 SUT、浏览器、server 与网络。
//
// 权威注入手法（温拷贝）：真实 lib/ 拷进一次性 os 临时目录，令副本 PROJECT_ROOT 落在临时
// 目录内，往 release/entity-semantic-lock/ 写冻结锁字节 + 动作策略，以外部摘要登记发布表，
// 从副本 import v2 引擎。生产 publications 表始终为空（fail-closed），此处不触真实仓库。
//
// 覆盖面（结构性可达，今日全绿）：
//   roles       带 actionPolicy 发布后，四类不完整/未知角色事件由 verifyRequiredActionRoles
//               真跑到 ENTITY_ACTION_REQUIRED_ROLES_INVALID；配无策略正控证明策略是承重拒绝项。
//   publication 发布 trust root 只认手签 publications 模块：同仓自写 PRD 不成 trust root
//               （NOT_PUBLISHED）；release 路径上的 symlink（末段/父段）被 readPublishedFile 的
//               lstat 逐段守卫拒（CHECKSUM_MISMATCH）；配真实文件正控证明守卫是承重拒绝项。
// 不可达面（调用者 read factory 铸 SAME、普通 runKey 铸 capability、异 run 对象洗同一运行）
// 随冻结意图「运行时出处不可执行」迁入 teachin-semantic-lock-runtime-discrimination-successor
// 前瞻红基线，本金牌不覆盖；原 `runtime` 段已移除。

import { createHash } from 'node:crypto';
import {
  cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SECTION = process.argv[2] ?? 'all';
const VALID_SECTIONS = new Set(['all', 'roles', 'publication']);
if (!VALID_SECTIONS.has(SECTION)) {
  console.error(`用法: node ${process.argv[1]} [roles|publication]`);
  console.error('原 `runtime` 段（运行时判别/铸造）已迁入 teachin-semantic-lock-runtime-discrimination-successor 前瞻红基线。');
  process.exit(2);
}

const LIB_ROOT = fileURLToPath(new URL('../../lib/', import.meta.url));
const FIXTURE_ROOT = new URL('./fixtures/teachin-semantic-lock-runtime-authority/', import.meta.url);
const CAP_LOCK_PATH = new URL('./fixtures/teachin-semantic-lock-capability-hardening/entity-locks.frozen.json', import.meta.url);
const capLockBytes = readFileSync(CAP_LOCK_PATH);
const policyBytes = readFileSync(new URL('entity-action-policy.frozen.json', FIXTURE_ROOT));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

const ROLE_CASES = [
  ['relation-source-only', 'tc_lock_relation_source_only'],
  ['relation-target-only', 'tc_lock_relation_target_only'],
  ['mutation-empty', 'tc_lock_mutation_empty'],
  ['unknown-role', 'tc_lock_unknown_role'],
];

// ---- 温拷贝临时仓 ----
const ROOT = mkdtempSync(join(tmpdir(), 'casey-lock-runtime-'));
const EXTERNAL = mkdtempSync(join(tmpdir(), 'casey-lock-runtime-ext-'));
cpSync(LIB_ROOT, join(ROOT, 'lib'), { recursive: true });

function writeInRoot(key, bytes) {
  const path = join(ROOT, key);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
  return sha256(bytes);
}

// roles：四个角色 fixture 锁 + 共享动作策略；正控用无策略 contract。
const rolesLocks = {};
for (const [fixture] of ROLE_CASES) {
  const key = `release/entity-semantic-lock/roles/${fixture}.locks.json`;
  rolesLocks[key] = writeInRoot(key, readFileSync(new URL(`${fixture}.locks.json`, FIXTURE_ROOT)));
}
const policyKey = 'release/entity-semantic-lock/roles/action-policy.json';
const policySha = writeInRoot(policyKey, policyBytes);
const roleKeyOf = (fixture) => `release/entity-semantic-lock/roles/${fixture}.locks.json`;
const noPolicyKey = 'release/entity-semantic-lock/roles-nopolicy/relation-source-only.locks.json';
writeInRoot(noPolicyKey, readFileSync(new URL('relation-source-only.locks.json', FIXTURE_ROOT)));

// publication：symlink 正控（真实文件）+ 末段 symlink + 父段 symlink。
const positiveKey = 'release/entity-semantic-lock/publication/positive/entity-locks.frozen.json';
writeInRoot(positiveKey, capLockBytes);

const symFileKey = 'release/entity-semantic-lock/publication/symfile/entity-locks.frozen.json';
const symFileTarget = join(EXTERNAL, 'symfile-target.json');
writeFileSync(symFileTarget, capLockBytes);
mkdirSync(dirname(join(ROOT, symFileKey)), { recursive: true });
symlinkSync(symFileTarget, join(ROOT, symFileKey), process.platform === 'win32' ? 'file' : undefined);

const symDirKey = 'release/entity-semantic-lock/publication/symdir/entity-locks.frozen.json';
const symDirTarget = join(EXTERNAL, 'symdir-target');
mkdirSync(symDirTarget, { recursive: true });
writeFileSync(join(symDirTarget, 'entity-locks.frozen.json'), capLockBytes);
mkdirSync(join(ROOT, 'release/entity-semantic-lock/publication'), { recursive: true });
symlinkSync(symDirTarget, join(ROOT, 'release/entity-semantic-lock/publication/symdir'), process.platform === 'win32' ? 'junction' : 'dir');

// 自封：攻击者只写得进 PRD + 锁，写不进手签 publications 模块。
writeInRoot('release/entity-semantic-lock/attacker/entity-locks.frozen.json', capLockBytes);
mkdirSync(join(ROOT, 'loop'), { recursive: true });
writeFileSync(join(ROOT, 'loop', 'prd-attacker-published.json'), JSON.stringify({
  schemaVersion: 1,
  testChecksums: { 'release/entity-semantic-lock/attacker/entity-locks.frozen.json': sha256(capLockBytes) },
}));

const publications = {
  'teachin-semantic-lock-runtime-authority': {
    source: 'release-resource', mode: 'historical', locks: rolesLocks,
    actionPolicy: { key: policyKey, sha256: policySha },
  },
  'runtime-authority-roles-nopolicy': {
    source: 'release-resource', mode: 'historical', locks: { [noPolicyKey]: rolesLocks[roleKeyOf('relation-source-only')] },
  },
  'runtime-authority-symlink-positive': {
    source: 'release-resource', mode: 'historical', locks: { [positiveKey]: sha256(capLockBytes) },
  },
  'runtime-authority-symlink-file': {
    source: 'release-resource', mode: 'historical', locks: { [symFileKey]: sha256(capLockBytes) },
  },
  'runtime-authority-symlink-dir': {
    source: 'release-resource', mode: 'historical', locks: { [symDirKey]: sha256(capLockBytes) },
  },
};
writeFileSync(
  join(ROOT, 'lib', 'entity-semantic-lock-publications.mjs'),
  `export const ENTITY_SEMANTIC_LOCK_PUBLICATIONS = ${JSON.stringify(publications)};\n`,
);

let api;
try {
  api = await import(`${pathToFileURL(join(ROOT, 'lib', 'entity-semantic-lock-v2.mjs')).href}?runtime-authority`);
} catch (error) {
  console.error(`RED  teachin-semantic-lock-runtime-authority: 温拷贝 v2 引擎 import 失败: ${error.message}`);
  rmSync(ROOT, { recursive: true, force: true });
  rmSync(EXTERNAL, { recursive: true, force: true });
  process.exit(1);
}

let passed = 0;
const failures = [];
async function check(section, name, fn) {
  if (SECTION !== 'all' && SECTION !== section) return;
  try { await fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
}
function assertReason(result, expected, label) {
  if (result?.ok === true || result?.allowAction === true || result?.handle) throw new Error(`${label}: 未拒 -> ${JSON.stringify(result)}`);
  if (result?.reason !== expected) throw new Error(`${label}: 期望 ${expected}, 实得 ${JSON.stringify(result)}`);
}

await check('roles', '正控 无策略发布时不完整角色锁集本身可 verify（证明 actionPolicy 是承重拒绝项）', () => {
  const loaded = api.readFrozenEntityLockSetAuthority({ contractId: 'runtime-authority-roles-nopolicy', lockSetKey: noPolicyKey });
  if (!loaded.ok || !loaded.authority) throw new Error(`无策略正控 authority 不可读: ${JSON.stringify(loaded)}`);
  const checked = api.verifyEntityLockSet({
    authority: loaded.authority, caseId: 'tc_lock_relation_source_only',
    eventsBytes: readFileSync(new URL('relation-source-only.events.json', FIXTURE_ROOT)),
  });
  if (!checked.ok || !checked.handle) throw new Error(`无策略角色锁集应可 verify: ${JSON.stringify(checked)}`);
});

for (const [fixture, caseId] of ROLE_CASES) {
  await check('roles', `HIGH 冻结动作角色策略拒绝 ${fixture}（真跑 verifyRequiredActionRoles）`, () => {
    const loaded = api.readFrozenEntityLockSetAuthority({
      contractId: 'teachin-semantic-lock-runtime-authority', lockSetKey: roleKeyOf(fixture),
    });
    if (!loaded.ok || !loaded.authority) throw new Error(`角色 fixture 未由发布表签发 authority: ${JSON.stringify(loaded)}`);
    const result = api.verifyEntityLockSet({
      authority: loaded.authority, caseId,
      eventsBytes: readFileSync(new URL(`${fixture}.events.json`, FIXTURE_ROOT)),
    });
    assertReason(result, 'ENTITY_ACTION_REQUIRED_ROLES_INVALID', `${fixture} 不完整/未知角色被接纳`);
  });
}

await check('publication', 'HIGH 同一可写仓内自写 PRD+lock 不能自封发布权威（手签 publications 模块是唯一 trust root）', () => {
  const result = api.readFrozenEntityLockSetAuthority({
    contractId: 'attacker-published', lockSetKey: 'release/entity-semantic-lock/attacker/entity-locks.frozen.json',
  });
  assertReason(result, 'ENTITY_LOCK_AUTHORITY_NOT_PUBLISHED', '同仓自写 PRD+lock 被当 trust root');
});

await check('publication', '正控 真实 release 文件（非 symlink）可签发 authority（证明 symlink 守卫是承重拒绝项）', () => {
  const result = api.readFrozenEntityLockSetAuthority({
    contractId: 'runtime-authority-symlink-positive', lockSetKey: positiveKey,
  });
  if (!result.ok || !result.authority) throw new Error(`真实 release 文件应可签发: ${JSON.stringify(result)}`);
});

await check('publication', 'HIGH release 末段 symlink 逃逸被 lstat 逐段守卫拒（摘要即便匹配也拒）', () => {
  const result = api.readFrozenEntityLockSetAuthority({
    contractId: 'runtime-authority-symlink-file', lockSetKey: symFileKey,
  });
  assertReason(result, 'ENTITY_LOCK_AUTHORITY_CHECKSUM_MISMATCH', 'release 末段 symlink 被当 trust root');
});

await check('publication', 'HIGH release 父段 symlink 逃逸被 lstat 逐段守卫拒（摘要即便匹配也拒）', () => {
  const result = api.readFrozenEntityLockSetAuthority({
    contractId: 'runtime-authority-symlink-dir', lockSetKey: symDirKey,
  });
  assertReason(result, 'ENTITY_LOCK_AUTHORITY_CHECKSUM_MISMATCH', 'release 父段 symlink 被当 trust root');
});

rmSync(ROOT, { recursive: true, force: true });
rmSync(EXTERNAL, { recursive: true, force: true });

if (failures.length) {
  for (const failure of failures) console.error(`RED  teachin-semantic-lock-runtime-authority: ${failure}`);
  console.error(`RED  teachin-semantic-lock-runtime-authority/${SECTION}: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   teachin-semantic-lock-runtime-authority/${SECTION}: ${passed}/${passed} 全过（温拷贝注入，zero-SUT）`);
