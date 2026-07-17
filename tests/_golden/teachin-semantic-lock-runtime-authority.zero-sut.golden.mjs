#!/usr/bin/env node
// 运行权威 superseding 金牌：只读冻结文件与临时文件；禁止 SUT、浏览器、server 与网络。

import { createHash } from 'node:crypto';
import {
  cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SECTION = process.argv[2] ?? 'all';
const VALID_SECTIONS = new Set(['all', 'runtime', 'roles', 'publication']);
if (!VALID_SECTIONS.has(SECTION)) {
  console.error(`用法: node ${process.argv[1]} [runtime|roles|publication]`);
  process.exit(2);
}

const CONTRACT_ID = 'teachin-semantic-lock-capability-hardening';
const LOCK_KEY = 'tests/_golden/fixtures/teachin-semantic-lock-capability-hardening/entity-locks.frozen.json';
const LOCK_PATH = new URL('./fixtures/teachin-semantic-lock-capability-hardening/entity-locks.frozen.json', import.meta.url);
const EVENTS_PATH = new URL('./fixtures/teachin-semantic-lock-capability-hardening/events.document.json', import.meta.url);
const FIXTURE_ROOT = new URL('./fixtures/teachin-semantic-lock-runtime-authority/', import.meta.url);
const MODULE_PATH = new URL('../../lib/entity-semantic-lock-v2.mjs', import.meta.url);
const LIB_ROOT = fileURLToPath(new URL('../../lib/', import.meta.url));
const lockSetBytes = readFileSync(LOCK_PATH);
const eventsBytes = readFileSync(EVENTS_PATH);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

let api;
try { api = await import(MODULE_PATH); } catch { api = {}; }

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

function assertDenied(result, label) {
  if (result?.ok === true || result?.allowAction === true || result?.status === 'SAME') {
    throw new Error(`${label}: ${JSON.stringify(result)}`);
  }
}

function binding() {
  return {
    stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.rename',
    role: 'subject', candidate: 'candidate-workflow-main', lockId: 'lock-workflow-main',
  };
}

function oldCandidate() {
  return {
    physicalId: 'row-1', kind: 'workflow', name: '审批工作流', code: 'wf-001',
    platformId: '90071992547409931234',
    scopeSha256: '1111111111111111111111111111111111111111111111111111111111111111',
    parentReceiptHash: null, revisionId: 'rev-7',
  };
}

function newCandidate() {
  return { ...oldCandidate(), name: '审批工作流V2', code: 'wf-002', revisionId: 'rev-8' };
}

function validHandle() {
  const loaded = api.readFrozenEntityLockSetAuthority?.({ contractId: CONTRACT_ID, lockSetKey: LOCK_KEY });
  if (!loaded?.ok || !loaded.authority) throw new Error(`旧冻结正向 authority 不可读: ${JSON.stringify(loaded)}`);
  const checked = api.verifyEntityLockSet?.({
    authority: loaded.authority, caseId: 'tc_semantic_lock_capability', eventsBytes,
  });
  if (!checked?.ok || !checked.handle) throw new Error(`旧冻结正向 handle 不成立: ${JSON.stringify(checked)}`);
  return checked.handle;
}

function callerAdapter(read) {
  return api.createEntityRuntimeAdapter?.({ adapterId: 'caller-controlled-read', read });
}

await check('runtime', 'P0 调用者 read factory 不能铸造 SAME/allowAction', async () => {
  const handle = validHandle();
  const made = callerAdapter(async () => ({ complete: true, candidates: [oldCandidate()] }));
  if (!made?.ok || !made.adapter) return;
  const read = await api.readEntityRuntimeCapability?.({
    adapter: made.adapter, binding: binding(), runContext: Object.freeze({ runKey: 'attacker-run' }),
  });
  if (!read?.ok || !read.capability) return;
  const result = api.evaluateEntityAction?.({ handle, binding: binding(), runtimeCapability: read.capability });
  assertDenied(result, '调用者 reader 被包装为运行权威');
});

await check('runtime', 'HIGH 普通 runKey 对象不能铸 runtime capability', async () => {
  const made = callerAdapter(async () => ({ complete: true, candidates: [oldCandidate()] }));
  if (!made?.ok || !made.adapter) return;
  const read = await api.readEntityRuntimeCapability?.({
    adapter: made.adapter, binding: binding(), runContext: Object.freeze({ runKey: 'plain-run-key' }),
  });
  if (read?.ok || read?.capability) throw new Error(`普通对象被铸 runtime capability: ${JSON.stringify(read)}`);
});

await check('runtime', 'HIGH 不同 run context 即使同 runKey 也不能建立 successor', async () => {
  const handle = validHandle();
  let reads = 0;
  const made = callerAdapter(async () => ({
    complete: true, candidates: [reads++ === 0 ? oldCandidate() : newCandidate()],
  }));
  if (!made?.ok || !made.adapter) return;
  const contextA = Object.freeze({ runKey: 'same-diagnostic-key' });
  const contextB = Object.freeze({ runKey: 'same-diagnostic-key' });
  if (contextA === contextB) throw new Error('测试前提错误：context 对象未分离');
  const before = await api.readEntityRuntimeCapability?.({ adapter: made.adapter, binding: binding(), runContext: contextA });
  const anchored = api.evaluateEntityAction?.({ handle, binding: binding(), runtimeCapability: before?.capability });
  if (anchored?.status !== 'SAME' || anchored?.allowAction !== true) return;
  const after = await api.readEntityRuntimeCapability?.({ adapter: made.adapter, binding: binding(), runContext: contextB });
  const successor = api.createRunSuccessorProof?.({
    handle, binding: binding(), transitionId: 'rename-main',
    previousHeadHash: '0d7294372a5048fa77e194c44fdd145da79dd7f40175964aeeb64550f9177f8b',
    runtimeCapability: after?.capability,
  });
  if (successor?.ok || successor?.receiptHash) {
    throw new Error(`不同 run 对象被同字符串洗成同一运行: ${JSON.stringify(successor)}`);
  }
});

const ROLE_CASES = [
  ['relation-source-only', 'tc_lock_relation_source_only'],
  ['relation-target-only', 'tc_lock_relation_target_only'],
  ['mutation-empty', 'tc_lock_mutation_empty'],
  ['unknown-role', 'tc_lock_unknown_role'],
];

for (const [fixture, caseId] of ROLE_CASES) {
  await check('roles', `HIGH 冻结动作角色策略拒绝 ${fixture}`, () => {
    const lockKey = `tests/_golden/fixtures/teachin-semantic-lock-runtime-authority/${fixture}.locks.json`;
    const loaded = api.readFrozenEntityLockSetAuthority?.({
      contractId: 'teachin-semantic-lock-runtime-authority', lockSetKey: lockKey,
    });
    if (!loaded?.ok || !loaded.authority) throw new Error(`负 fixture 未由 PRD 发布: ${JSON.stringify(loaded)}`);
    const checked = api.verifyEntityLockSet?.({
      authority: loaded.authority,
      caseId,
      eventsBytes: readFileSync(new URL(`${fixture}.events.json`, FIXTURE_ROOT)),
    });
    if (checked?.ok || checked?.handle) throw new Error(`不完整/未知角色被 verifier 接纳: ${JSON.stringify(checked)}`);
  });
}

function writeAttackerPublication(root, lockKey) {
  const lockPath = join(root, lockKey);
  mkdirSync(dirname(lockPath), { recursive: true });
  writeFileSync(lockPath, lockSetBytes);
  const prd = { schemaVersion: 1, testChecksums: { [lockKey]: sha256(lockSetBytes) } };
  mkdirSync(join(root, 'loop'), { recursive: true });
  writeFileSync(join(root, 'loop', 'prd-attacker-published.json'), JSON.stringify(prd));
}

async function loadTempModule(root, tag) {
  cpSync(LIB_ROOT, join(root, 'lib'), { recursive: true });
  return import(`${pathToFileURL(join(root, 'lib', 'entity-semantic-lock-v2.mjs')).href}?${tag}`);
}

await check('publication', 'HIGH 同一可写仓内 PRD+lock 不能自封发布权威', async () => {
  const root = mkdtempSync(join(tmpdir(), 'casey-lock-self-sign-'));
  try {
    const lockKey = 'locks/entity-locks.frozen.json';
    writeAttackerPublication(root, lockKey);
    const isolated = await loadTempModule(root, 'self-sign');
    const result = isolated.readFrozenEntityLockSetAuthority?.({
      contractId: 'attacker-published', lockSetKey: lockKey,
    });
    if (result?.ok || result?.authority) throw new Error(`同仓自写 PRD+lock 被当 trust root: ${JSON.stringify(result)}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

await check('publication', 'HIGH symlink/realpath 逃逸不能作为发布 trust root', async () => {
  const root = mkdtempSync(join(tmpdir(), 'casey-lock-symlink-root-'));
  const external = mkdtempSync(join(tmpdir(), 'casey-lock-symlink-outside-'));
  try {
    const lockKey = 'locks/entity-locks.frozen.json';
    writeAttackerPublication(external, lockKey);
    await loadTempModule(root, 'symlink-escape');
    rmSync(join(root, 'loop'), { recursive: true, force: true });
    rmSync(join(root, 'locks'), { recursive: true, force: true });
    symlinkSync(join(external, 'loop'), join(root, 'loop'), process.platform === 'win32' ? 'junction' : 'dir');
    symlinkSync(join(external, 'locks'), join(root, 'locks'), process.platform === 'win32' ? 'junction' : 'dir');
    const isolated = await import(`${pathToFileURL(join(root, 'lib', 'entity-semantic-lock-v2.mjs')).href}?symlink-live`);
    const result = isolated.readFrozenEntityLockSetAuthority?.({
      contractId: 'attacker-published', lockSetKey: lockKey,
    });
    if (result?.ok || result?.authority) throw new Error(`symlink 外部 PRD+lock 被当 trust root: ${JSON.stringify(result)}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(external, { recursive: true, force: true });
  }
});

if (failures.length) {
  for (const failure of failures) console.error(`RED  teachin-semantic-lock-runtime-authority: ${failure}`);
  console.error(`RED  teachin-semantic-lock-runtime-authority/${SECTION}: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}

console.log(`ok   teachin-semantic-lock-runtime-authority/${SECTION}: ${passed}/${passed} 全过（纯函数/静态，零 SUT）`);
