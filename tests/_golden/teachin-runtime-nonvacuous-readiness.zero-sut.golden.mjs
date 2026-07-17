#!/usr/bin/env node
// 运行期非真空就绪门禁：只读模块、发布清单与冻结语料；禁止 SUT、浏览器、server 与网络。

import { readFileSync } from 'node:fs';
import * as api from '../../lib/entity-semantic-lock-v2.mjs';
import { ENTITY_SEMANTIC_LOCK_PUBLICATIONS } from '../../lib/entity-semantic-lock-publications.mjs';

const SECTION = process.argv[2] ?? 'all';
const VALID_SECTIONS = new Set(['all', 'readiness', 'legacy-policy', 'publication']);
if (!VALID_SECTIONS.has(SECTION)) {
  console.error(`用法: node ${process.argv[1]} [readiness|legacy-policy|publication]`);
  process.exit(2);
}

const LEGACY_CONTRACT = 'teachin-semantic-lock-capability-hardening';
const LEGACY_LOCK_KEY = 'tests/_golden/fixtures/teachin-semantic-lock-capability-hardening/entity-locks.frozen.json';
const LEGACY_EVENTS = new URL('./fixtures/teachin-semantic-lock-capability-hardening/events.document.json', import.meta.url);
const BINDING = Object.freeze({
  stepId: 'atstep_1',
  intentId: 'intent_1',
  atom: 'workflow.rename',
  role: 'subject',
  candidate: 'candidate-workflow-main',
  lockId: 'lock-workflow-main',
});
const PREVIOUS_HEAD = '0d7294372a5048fa77e194c44fdd145da79dd7f40175964aeeb64550f9177f8b';

let passed = 0;
const failures = [];
async function check(section, name, fn) {
  if (SECTION !== 'all' && SECTION !== section) return;
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertDenied(result, reason, label) {
  assert(result && typeof result === 'object', `${label}: 缺拒绝结果`);
  assert(result.ok !== true && result.allowAction !== true && result.status !== 'SAME', `${label}: ${JSON.stringify(result)}`);
  assert(result.reason === reason, `${label}: reason=${JSON.stringify(result.reason)}`);
}

function ownData(value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label}: 不是对象`);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const [key, descriptor] of Object.entries(descriptors)) {
    assert(Object.prototype.hasOwnProperty.call(descriptor, 'value'), `${label}.${key}: 禁止 accessor`);
  }
  return Object.fromEntries(Object.entries(descriptors).map(([key, descriptor]) => [key, descriptor.value]));
}

function loadLegacy() {
  const authority = api.readFrozenEntityLockSetAuthority({
    contractId: LEGACY_CONTRACT,
    lockSetKey: LEGACY_LOCK_KEY,
  });
  if (authority?.ok === true && authority.authority) {
    const verified = api.verifyEntityLockSet({
      authority: authority.authority,
      caseId: 'tc_semantic_lock_capability',
      eventsBytes: readFileSync(LEGACY_EVENTS),
    });
    return { published: true, authority, verified };
  }
  return { published: false, authority, verified: null };
}

await check('readiness', 'P0 当前运行期就绪状态明确 route:human，不冒充正向完成', () => {
  assert(typeof api.readEntityRuntimeReadiness === 'function', '缺公开 readEntityRuntimeReadiness');
  const readiness = api.readEntityRuntimeReadiness();
  const row = ownData(readiness, 'readiness');
  assert(Object.isFrozen(readiness), 'readiness 必须冻结');
  assert(row.available === false, `available 不是 false: ${JSON.stringify(row.available)}`);
  assert(row.route === 'human', `route 不是 human: ${JSON.stringify(row.route)}`);
  assert(row.reason === 'DRIVER_NOT_PUBLISHED', `reason 不是 DRIVER_NOT_PUBLISHED: ${JSON.stringify(row.reason)}`);
});

await check('readiness', 'HIGH 调用者 read 与普通运行对象只能保持 fail-closed', async () => {
  const adapter = api.createEntityRuntimeAdapter({
    adapterId: 'caller-controlled-read',
    read: async () => ({ complete: true, candidates: [] }),
  });
  assert(adapter?.ok !== true && !adapter?.adapter, `调用者 read 被注册: ${JSON.stringify(adapter)}`);
  const capability = await api.readEntityRuntimeCapability({
    adapter: Object.freeze({ artifactKind: 'forged-adapter' }),
    binding: BINDING,
    runContext: Object.freeze({ runKey: 'plain-run' }),
  });
  assert(capability?.ok !== true && !capability?.capability, `普通运行对象被铸权: ${JSON.stringify(capability)}`);
});

await check('legacy-policy', 'P0 无 policy 的旧条目只能未发布或显式 historical', () => {
  const publication = Object.prototype.hasOwnProperty.call(ENTITY_SEMANTIC_LOCK_PUBLICATIONS, LEGACY_CONTRACT)
    ? ownData(ENTITY_SEMANTIC_LOCK_PUBLICATIONS[LEGACY_CONTRACT], `publication.${LEGACY_CONTRACT}`)
    : null;
  if (publication !== null) {
    assert(publication.mode === 'historical', `旧条目 mode=${JSON.stringify(publication.mode)}`);
    assert(publication.actionPolicy === undefined, '本检查前提要求旧条目无 policy');
  }
});

await check('legacy-policy', 'P0 历史 handle 必须显式 runtimeAuthorized:false', () => {
  const legacy = loadLegacy();
  if (legacy.published) {
    assert(legacy.verified?.ok === true && legacy.verified.handle, `历史结构验证失败: ${JSON.stringify(legacy.verified)}`);
    assert(legacy.verified.runtimeAuthorized === false, `历史 handle 未降权: ${JSON.stringify(legacy.verified)}`);
  } else {
    assertDenied(legacy.authority, 'ENTITY_LOCK_AUTHORITY_NOT_PUBLISHED', '旧条目未发布');
  }
});

await check('legacy-policy', 'P0 历史 handle 的 evaluate 与 successor 永远先拒运行授权', () => {
  const legacy = loadLegacy();
  if (legacy.published) {
    assert(legacy.verified?.ok === true && legacy.verified.handle, `历史结构验证失败: ${JSON.stringify(legacy.verified)}`);
    const evaluated = api.evaluateEntityAction({
      handle: legacy.verified.handle,
      binding: BINDING,
      runtimeCapability: Object.freeze({ artifactKind: 'forged-runtime-capability' }),
    });
    assertDenied(evaluated, 'ENTITY_LOCK_RUNTIME_UNAUTHORIZED', '历史 handle evaluate');
    const successor = api.createRunSuccessorProof({
      handle: legacy.verified.handle,
      binding: BINDING,
      transitionId: 'rename-main',
      previousHeadHash: PREVIOUS_HEAD,
      runtimeCapability: Object.freeze({ artifactKind: 'forged-runtime-capability' }),
    });
    assertDenied(successor, 'ENTITY_LOCK_RUNTIME_UNAUTHORIZED', '历史 handle successor');
  } else {
    assertDenied(legacy.authority, 'ENTITY_LOCK_AUTHORITY_NOT_PUBLISHED', '旧条目未发布');
  }
});

const FORBIDDEN_PATH_PARTS = [
  'tests/', '_golden', 'fixture', 'negative', 'source-only', 'target-only',
  'mutation-empty', 'unknown-role', 'docs/', 'loop/', 'cases/', 'runs/', 'fake-sut/',
];

function publicationPaths(publication, label) {
  const row = ownData(publication, label);
  const paths = [];
  if (row.locks !== undefined) {
    const locks = ownData(row.locks, `${label}.locks`);
    paths.push(...Object.keys(locks));
  }
  if (row.actionPolicy !== undefined) {
    const policy = ownData(row.actionPolicy, `${label}.actionPolicy`);
    assert(typeof policy.key === 'string', `${label}.actionPolicy.key 缺失`);
    paths.push(policy.key);
  }
  if (row.manifest !== undefined) {
    const manifest = ownData(row.manifest, `${label}.manifest`);
    assert(typeof manifest.key === 'string', `${label}.manifest.key 缺失`);
    paths.push(manifest.key);
  }
  return { row, paths };
}

await check('publication', 'P0 生产发布清单禁止测试、负向与普通工作区路径', () => {
  for (const [contractId, publication] of Object.entries(ENTITY_SEMANTIC_LOCK_PUBLICATIONS)) {
    const { row, paths } = publicationPaths(publication, `publication.${contractId}`);
    assert(row.source === 'release-resource' || row.source === 'signed-manifest', `${contractId}: source 未声明独立发布来源`);
    assert(row.mode === 'runtime' || row.mode === 'historical', `${contractId}: mode 非法`);
    if (row.mode === 'runtime') assert(row.actionPolicy !== undefined, `${contractId}: runtime 发布缺动作 policy`);
    for (const path of paths) {
      assert(typeof path === 'string' && path.length > 0, `${contractId}: 发布路径为空`);
      assert(!path.startsWith('/') && !path.includes('\\') && !path.split('/').includes('..'), `${contractId}: 非安全相对路径 ${path}`);
      const lower = path.toLowerCase();
      assert(!FORBIDDEN_PATH_PARTS.some((part) => lower.includes(part)), `${contractId}: 禁止的工作区路径 ${path}`);
      assert(lower.startsWith('release/entity-semantic-lock/'), `${contractId}: 不是独立 release resource ${path}`);
    }
  }
});

await check('publication', 'HIGH 调用者普通工作区文件不能补进空发布清单', () => {
  const result = api.readFrozenEntityLockSetAuthority({
    contractId: 'caller-workspace-publication',
    lockSetKey: 'workspace/entity-locks.json',
  });
  assertDenied(result, 'ENTITY_LOCK_AUTHORITY_NOT_PUBLISHED', '调用者工作区 publication');
});

if (failures.length) {
  for (const failure of failures) console.error(`RED  teachin-runtime-nonvacuous-readiness: ${failure}`);
  console.error(`RED  teachin-runtime-nonvacuous-readiness/${SECTION}: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}

console.log(`ok   teachin-runtime-nonvacuous-readiness/${SECTION}: ${passed}/${passed} 全过（纯函数/静态，零 SUT；只声明 fail-closed）`);
