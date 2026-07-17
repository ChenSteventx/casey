#!/usr/bin/env node
// 语义锁能力边界 superseding 金牌：只读冻结文件 + 内存适配器；禁止 SUT、浏览器、server 与网络。

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const CONTRACT_ID = 'teachin-semantic-lock-capability-hardening';
const LOCK_KEY = 'tests/_golden/fixtures/teachin-semantic-lock-capability-hardening/entity-locks.frozen.json';
const LOCK_PATH = new URL('./fixtures/teachin-semantic-lock-capability-hardening/entity-locks.frozen.json', import.meta.url);
const EVENTS_PATH = new URL('./fixtures/teachin-semantic-lock-capability-hardening/events.document.json', import.meta.url);
const OLD_LOCK_PATH = new URL('./fixtures/teachin-semantic-lock-v2/entity-locks.frozen.json', import.meta.url);
const OLD_EVENTS_PATH = new URL('./fixtures/teachin-semantic-lock-v2/events.json', import.meta.url);
const lockSetBytes = readFileSync(LOCK_PATH);
const eventsBytes = readFileSync(EVENTS_PATH);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

let api;
try { api = await import('../../lib/entity-semantic-lock-v2.mjs'); } catch { api = {}; }

let passed = 0;
const failures = [];
async function check(name, fn) {
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
  if (result?.ok === true || result?.allowAction === true || result?.status === 'SAME' || result?.status === 'MISSING') {
    throw new Error(`${label}: ${JSON.stringify(result)}`);
  }
  if (typeof result?.reason !== 'string' || !result.reason) throw new Error(`${label} 未返回闭合 reason: ${JSON.stringify(result)}`);
}

function goodBinding() {
  return {
    stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.rename',
    role: 'subject', candidate: 'candidate-workflow-main', lockId: 'lock-workflow-main',
  };
}

function oldCandidate(patch = {}) {
  return {
    physicalId: 'row-1', kind: 'workflow', name: '审批工作流', code: 'wf-001',
    platformId: '90071992547409931234',
    scopeSha256: '1111111111111111111111111111111111111111111111111111111111111111',
    parentReceiptHash: null, revisionId: 'rev-7', ...patch,
  };
}

function newCandidate(patch = {}) {
  return oldCandidate({ name: '审批工作流V2', code: 'wf-002', revisionId: 'rev-8', ...patch });
}

function cloneDocument() {
  return JSON.parse(eventsBytes.toString('utf8'));
}

function bytesOf(value) {
  return Buffer.from(JSON.stringify(value));
}

function authorityResult(overrides = {}) {
  if (typeof api.readFrozenEntityLockSetAuthority !== 'function') {
    return { ok: false, reason: 'LOCK_AUTHORITY_READER_MISSING' };
  }
  return api.readFrozenEntityLockSetAuthority({ contractId: CONTRACT_ID, lockSetKey: LOCK_KEY, ...overrides });
}

function validHandle(events = eventsBytes) {
  const loaded = authorityResult();
  if (!loaded?.ok || !loaded.authority) throw new Error(`固定 PRD/checksum reader 未签发 authority: ${JSON.stringify(loaded)}`);
  if (typeof api.verifyEntityLockSet !== 'function') throw new Error('verifyEntityLockSet 缺失');
  const checked = api.verifyEntityLockSet({ authority: loaded.authority, caseId: 'tc_semantic_lock_capability', eventsBytes: events });
  if (!checked?.ok || !checked.handle) throw new Error(`合法 capability fixture 未建立 handle: ${JSON.stringify(checked)}`);
  return { handle: checked.handle, authority: loaded.authority };
}

function adapterResult({ adapterId, read }) {
  if (typeof api.createEntityRuntimeAdapter !== 'function') return { ok: false, reason: 'RUNTIME_ADAPTER_FACTORY_MISSING' };
  return api.createEntityRuntimeAdapter({ adapterId, read });
}

async function runtimeCapability({ adapter, runContext, binding = goodBinding() }) {
  if (typeof api.readEntityRuntimeCapability !== 'function') return { ok: false, reason: 'RUNTIME_CAPABILITY_READER_MISSING' };
  return api.readEntityRuntimeCapability({ adapter, binding, runContext });
}

function evaluate({ handle, binding = goodBinding(), runtimeCapability: capability, ...extra }) {
  if (typeof api.evaluateEntityAction !== 'function') return { status: 'UNVERIFIED', allowAction: false, reason: 'EVALUATOR_MISSING' };
  return api.evaluateEntityAction({ handle, binding, runtimeCapability: capability, ...extra });
}

await check('H4 固定 PRD/checksum reader 是唯一锁 authority 来源，旧 bytes+sha 自签与能力副本均拒绝', () => {
  const loaded = authorityResult();
  if (!loaded?.ok || !loaded.authority) throw new Error(`合法 authority 未签发: ${JSON.stringify(loaded)}`);
  const checked = api.verifyEntityLockSet?.({ authority: loaded.authority, caseId: 'tc_semantic_lock_capability', eventsBytes });
  if (!checked?.ok || !checked.handle) throw new Error(`合法 authority 被拒: ${JSON.stringify(checked)}`);

  const copied = { ...loaded.authority };
  assertDenied(api.verifyEntityLockSet?.({ authority: copied, caseId: 'tc_semantic_lock_capability', eventsBytes }) ?? { reason: 'VERIFY_MISSING' }, '展开副本冒充 authority 被放行');
  assertDenied(authorityResult({ contractId: 'unknown-contract' }), '未知 contract 被放行');
  assertDenied(authorityResult({ contractId: '../../unknown-contract' }), 'contractId 路径穿越被放行');
  assertDenied(authorityResult({ lockSetKey: 'tests/_golden/fixtures/teachin-semantic-lock-v2/entity-locks.frozen.json' }), 'PRD 未登记键被放行');
  assertDenied(authorityResult({ prdPath: 'loop/prd-teachin-semantic-lock-v2.json' }), '调用者 prdPath 覆盖固定 reader 被放行');
  assertDenied(authorityResult({ lockSetBytes, trustedSetSha256: sha256(lockSetBytes) }), 'reader 接受调用者 bytes+sha 被放行');

  // 旧 v2 的真实冻结字节可由调用者同时计算摘要；旧实现会在这里自签成功，superseding API 必须关闭该入口。
  const oldLock = readFileSync(OLD_LOCK_PATH);
  const oldEvents = readFileSync(OLD_EVENTS_PATH);
  const selfSigned = api.verifyEntityLockSet?.({
    lockSetBytes: oldLock,
    trustedSetSha256: sha256(oldLock),
    caseId: 'tc_semantic_lock_v2',
    eventsBytes: oldEvents,
  }) ?? { reason: 'VERIFY_MISSING' };
  assertDenied(selfSigned, '调用者 bytes+sha 同传自签被放行');
});

await check('H1 只认真实 events 文档，event 三元 binding 必须与锁集精确对齐', () => {
  validHandle();
  const variants = [];

  variants.push(JSON.parse(eventsBytes.toString('utf8')).events); // 裸数组
  const missing = cloneDocument(); delete missing.events[0].entityBindings; variants.push(missing);
  const role = cloneDocument(); role.events[0].entityBindings[0].role = 'target'; variants.push(role);
  const candidate = cloneDocument(); candidate.events[0].entityBindings[0].candidate = 'candidate-other'; variants.push(candidate);
  const lock = cloneDocument(); lock.events[0].entityBindings[0].lockAuthority.lockId = 'lock-other'; variants.push(lock);
  const receipt = cloneDocument(); receipt.events[0].entityBindings[0].lockAuthority.receiptHash = '0'.repeat(64); variants.push(receipt);
  const duplicate = cloneDocument(); duplicate.events[0].entityBindings.push(structuredClone(duplicate.events[0].entityBindings[0])); variants.push(duplicate);

  const authority = authorityResult().authority;
  for (const [index, variant] of variants.entries()) {
    const result = api.verifyEntityLockSet?.({ authority, caseId: 'tc_semantic_lock_capability', eventsBytes: bytesOf(variant) }) ?? { reason: 'VERIFY_MISSING' };
    assertDenied(result, `events 错配变体 ${index} 被放行`);
  }
});

await check('H2 SAME/MISSING 只来自 runtime adapter 不透明能力，重复实际匹配不折叠且保留真实计数', async () => {
  const { handle } = validHandle();
  const runContext = Object.freeze({ runKey: 'run-capability-001' });

  const direct = evaluate({ handle, scan: { complete: true, candidates: [oldCandidate()] } });
  assertDenied(direct, 'raw scan 直接授权');
  const forged = evaluate({ handle, runtimeCapability: { complete: true, physicalId: 'row-1', candidates: [oldCandidate()] } });
  assertDenied(forged, '普通对象冒充 runtime capability');

  const sameAdapterResult = adapterResult({ adapterId: 'golden-same', read: async () => ({ complete: true, candidates: [oldCandidate()] }) });
  if (!sameAdapterResult?.ok || !sameAdapterResult.adapter) throw new Error(`合法 same adapter 未建立: ${JSON.stringify(sameAdapterResult)}`);
  const sameRead = await runtimeCapability({ adapter: sameAdapterResult.adapter, runContext });
  if (!sameRead?.ok || !sameRead.capability) throw new Error(`合法 same runtime capability 未建立: ${JSON.stringify(sameRead)}`);
  const same = evaluate({ handle, runtimeCapability: sameRead.capability });
  if (same.status !== 'SAME' || same.allowAction !== true || same.candidateCount !== 1) throw new Error(`唯一读回未 SAME/计数失真: ${JSON.stringify(same)}`);

  const copiedCapability = { ...sameRead.capability };
  assertDenied(evaluate({ handle, runtimeCapability: copiedCapability }), 'runtime capability 展开副本被放行');

  const missingAdapterResult = adapterResult({ adapterId: 'golden-missing', read: async () => ({ complete: true, candidates: [] }) });
  const missingRead = await runtimeCapability({ adapter: missingAdapterResult.adapter, runContext });
  const missing = evaluate({ handle, runtimeCapability: missingRead.capability });
  if (missing.status !== 'MISSING' || missing.allowAction || missing.candidateCount !== 0) throw new Error(`完整零读回未 MISSING/计数失真: ${JSON.stringify(missing)}`);

  const duplicateAdapterResult = adapterResult({
    adapterId: 'golden-duplicate',
    read: async () => ({ complete: true, candidates: [oldCandidate(), oldCandidate()] }),
  });
  const duplicateRead = await runtimeCapability({ adapter: duplicateAdapterResult.adapter, runContext });
  const duplicate = evaluate({ handle, runtimeCapability: duplicateRead.capability });
  if (duplicate.allowAction || duplicate.status === 'SAME' || duplicate.candidateCount !== 2) {
    throw new Error(`两个实际匹配被折叠/计数失真: ${JSON.stringify(duplicate)}`);
  }

  const incompleteAdapterResult = adapterResult({ adapterId: 'golden-incomplete', read: async () => ({ complete: false, candidates: [] }) });
  const incompleteRead = await runtimeCapability({ adapter: incompleteAdapterResult.adapter, runContext });
  const incomplete = evaluate({ handle, runtimeCapability: incompleteRead.capability });
  if (incomplete.allowAction || incomplete.status === 'SAME' || incomplete.status === 'MISSING') throw new Error(`不完整读回被授权: ${JSON.stringify(incomplete)}`);

  const throwingAdapterResult = adapterResult({ adapterId: 'golden-throw', read: async () => { throw new Error('SECRET_ADAPTER_TEXT'); } });
  const throwingRead = await runtimeCapability({ adapter: throwingAdapterResult.adapter, runContext });
  if (throwingRead?.ok || JSON.stringify(throwingRead).includes('SECRET_ADAPTER_TEXT')) throw new Error(`adapter 异常被放行或泄漏: ${JSON.stringify(throwingRead)}`);
});

await check('H3 successor 只吃同一 runtime capability 的读回 proof/run context，普通字段与异源能力不推进 head', async () => {
  const { handle } = validHandle();
  const runContext = Object.freeze({ runKey: 'run-successor-001' });
  let readIndex = 0;
  const primaryAdapterResult = adapterResult({
    adapterId: 'golden-successor-primary',
    read: async () => ({ complete: true, candidates: [readIndex++ === 0 ? oldCandidate() : newCandidate()] }),
  });
  if (!primaryAdapterResult?.ok || !primaryAdapterResult.adapter) throw new Error(`primary adapter 未建立: ${JSON.stringify(primaryAdapterResult)}`);

  const beforeRead = await runtimeCapability({ adapter: primaryAdapterResult.adapter, runContext });
  const before = evaluate({ handle, runtimeCapability: beforeRead.capability });
  if (before.status !== 'SAME' || !before.allowAction) throw new Error(`successor 前原 head 未绑定同一 runtime: ${JSON.stringify(before)}`);
  const afterRead = await runtimeCapability({ adapter: primaryAdapterResult.adapter, runContext });
  if (!afterRead?.ok || !afterRead.capability) throw new Error(`变更后 runtime readback 未建立: ${JSON.stringify(afterRead)}`);

  const base = {
    handle, binding: goodBinding(), transitionId: 'rename-main',
    previousHeadHash: '0d7294372a5048fa77e194c44fdd145da79dd7f40175964aeeb64550f9177f8b',
  };
  const ordinary = api.createRunSuccessorProof?.({
    ...base,
    authoritativeReadback: { name: '审批工作流V2', code: 'wf-002', platformId: '90071992547409931234', revisionId: 'rev-8' },
    runId: 'run-successor-001',
  }) ?? { reason: 'SUCCESSOR_API_MISSING' };
  assertDenied(ordinary, '普通 authoritativeReadback/runId 被放行');
  const stillCurrent = evaluate({ handle, runtimeCapability: beforeRead.capability });
  if (stillCurrent.status !== 'SAME' || !stillCurrent.allowAction) throw new Error(`失败 successor 推进了 head: ${JSON.stringify(stillCurrent)}`);

  const otherRunRead = await runtimeCapability({ adapter: primaryAdapterResult.adapter, runContext: Object.freeze({ runKey: 'run-successor-other' }) });
  assertDenied(api.createRunSuccessorProof?.({ ...base, runtimeCapability: otherRunRead.capability }) ?? { reason: 'SUCCESSOR_API_MISSING' }, '其它 run capability 被放行');

  const otherAdapterResult = adapterResult({ adapterId: 'golden-successor-other', read: async () => ({ complete: true, candidates: [newCandidate()] }) });
  const otherAdapterRead = await runtimeCapability({ adapter: otherAdapterResult.adapter, runContext });
  assertDenied(api.createRunSuccessorProof?.({ ...base, runtimeCapability: otherAdapterRead.capability }) ?? { reason: 'SUCCESSOR_API_MISSING' }, '其它 adapter capability 被放行');

  const next = api.createRunSuccessorProof?.({ ...base, runtimeCapability: afterRead.capability }) ?? { reason: 'SUCCESSOR_API_MISSING' };
  if (!next?.ok || !next.receiptHash || next.previousReceiptHash !== base.previousHeadHash) throw new Error(`同源 successor 未成立: ${JSON.stringify(next)}`);
  const stale = evaluate({ handle, runtimeCapability: beforeRead.capability });
  if (stale.allowAction || stale.status === 'SAME') throw new Error(`successor 后旧 head 仍可授权: ${JSON.stringify(stale)}`);
  const current = evaluate({ handle, runtimeCapability: afterRead.capability, activeHeadProof: next });
  if (!current.allowAction || current.status !== 'SAME') throw new Error(`同 run 新 head proof 不能继续: ${JSON.stringify(current)}`);
});

if (failures.length) {
  for (const failure of failures) console.error(`RED  teachin-semantic-lock-capability-hardening: ${failure}`);
  console.error(`RED  teachin-semantic-lock-capability-hardening: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}

console.log(`ok   teachin-semantic-lock-capability-hardening: ${passed}/${passed} 全过（纯函数/静态，零 SUT）`);
