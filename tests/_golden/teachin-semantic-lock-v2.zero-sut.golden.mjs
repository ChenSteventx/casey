#!/usr/bin/env node
// 语义锁 v2 冻结攻击回归：只读 fixture + 纯函数；禁止浏览器、网络、fake/fixture SUT。

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const LOCK_PATH = new URL('./fixtures/teachin-semantic-lock-v2/entity-locks.frozen.json', import.meta.url);
const EVENTS_PATH = new URL('./fixtures/teachin-semantic-lock-v2/events.json', import.meta.url);
const TRUSTED_SET_SHA256 = '91141315ce4451615f9a07a89be34191a62f0ea25d43ca9514e564a436cc0aeb';
const lockSetBytes = readFileSync(LOCK_PATH);
const eventsBytes = readFileSync(EVENTS_PATH);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonicalReceipt = (receipt) => ({
  lockId: receipt.lockId, kind: receipt.kind, bindingMode: receipt.bindingMode,
  name: receipt.name, code: receipt.code, platformId: receipt.platformId,
  scopeSha256: receipt.scopeSha256, parentReceiptHash: receipt.parentReceiptHash,
  revisionId: receipt.revisionId, provenance: receipt.provenance,
});
const rehashReceipt = (receipt) => ({
  ...receipt,
  receiptHash: sha256(JSON.stringify(canonicalReceipt(receipt))),
});
const trustBytes = (doc) => {
  const bytes = Buffer.from(JSON.stringify(doc));
  return { lockSetBytes: bytes, trustedSetSha256: sha256(bytes) };
};

let api;
try { api = await import('../../lib/entity-semantic-lock-v2.mjs'); } catch { api = {}; }
const verify = (overrides = {}) => api.verifyEntityLockSet?.({
  lockSetBytes, trustedSetSha256: TRUSTED_SET_SHA256,
  caseId: 'tc_semantic_lock_v2', eventsBytes, ...overrides,
}) ?? { ok: false, reason: 'V2_MODULE_MISSING' };

let passed = 0;
const failures = [];
async function check(name, fn) {
  try { await fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
}
function assertDenied(result, label) {
  if (result?.ok === true || result?.allowAction === true || !result?.reason) throw new Error(`${label}: ${JSON.stringify(result)}`);
}
function validHandle() {
  const checked = verify();
  if (!checked.ok || !checked.handle) throw new Error(`合法锁集未建立 handle: ${JSON.stringify(checked)}`);
  return checked.handle;
}
function goodBinding() {
  return { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.rename', role: 'subject', lockId: 'lock-workflow-main' };
}
function goodCandidate(patch = {}) {
  return {
    physicalId: 'row-1', kind: 'workflow', name: '审批工作流', code: 'wf-001',
    platformId: '90071992547409931234',
    scopeSha256: '1111111111111111111111111111111111111111111111111111111111111111',
    parentReceiptHash: null, revisionId: 'rev-7', ...patch,
  };
}

await check('V2-A 外部冻结锚阻断自证 hash、换包、case/events 错配', () => {
  const good = verify();
  if (!good.ok || !good.handle) throw new Error(`合法 fixture 被拒：${JSON.stringify(good)}`);

  const tampered = JSON.parse(lockSetBytes);
  tampered.receipts[0].code = 'wf-attacker';
  tampered.receipts[0] = rehashReceipt(tampered.receipts[0]);
  tampered.bindings[0].receiptHash = tampered.receipts[0].receiptHash;
  tampered.transitions[0].previousReceiptHash = tampered.receipts[0].receiptHash;
  assertDenied(verify({ lockSetBytes: Buffer.from(JSON.stringify(tampered)) }), '锁集自证篡改被放行');
  assertDenied(verify({ caseId: 'other-case' }), 'caseId 错配被放行');
  assertDenied(verify({ eventsBytes: Buffer.from('[]') }), 'events 错配被放行');
});

await check('V2-B schema/策略不可降级，输入严格闭合且不静默 trim', () => {
  validHandle();
  const original = JSON.parse(lockSetBytes);
  const cases = [];
  const extra = structuredClone(original); extra.extra = true; cases.push(extra);
  const noId = structuredClone(original); delete noId.receipts[0].platformId; noId.receipts[0] = rehashReceipt(noId.receipts[0]); cases.push(noId);
  const numberId = structuredClone(original); numberId.receipts[0].platformId = 9007199254740993; numberId.receipts[0] = rehashReceipt(numberId.receipts[0]); cases.push(numberId);
  const downgrade = structuredClone(original); downgrade.identityPolicies[0].revision = 'any'; cases.push(downgrade);
  const spaced = structuredClone(original); spaced.receipts[0].name = ' 审批工作流'; spaced.receipts[0] = rehashReceipt(spaced.receipts[0]); cases.push(spaced);
  const noProof = structuredClone(original); noProof.receipts[0].provenance = { kind: 'user-approval', ref: '' }; noProof.receipts[0] = rehashReceipt(noProof.receipts[0]); cases.push(noProof);
  for (const [index, doc] of cases.entries()) {
    const trusted = trustBytes(doc);
    assertDenied(verify(trusted), `非法锁集 ${index} 被放行`);
  }
});

await check('V2-C 唯一动作门严格处理冲突、畸形、零扫描和 accessor', () => {
  const handle = validHandle();
  const evaluate = (scan, binding = goodBinding()) => api.evaluateEntityAction?.({ handle, binding, scan }) ?? { status: 'UNVERIFIED', allowAction: false, reason: 'V2_API_MISSING' };
  const same = evaluate({ complete: true, candidates: [goodCandidate()] });
  if (same.status !== 'SAME' || same.allowAction !== true) throw new Error(`合法唯一候选未 SAME: ${JSON.stringify(same)}`);

  const checks = [
    evaluate({ complete: false, candidates: [] }),
    evaluate({ complete: true, candidates: [goodCandidate(), goodCandidate({ platformId: 'conflict-id' })] }),
    evaluate({ complete: true, candidates: [goodCandidate(), goodCandidate({ physicalId: 'row-2' })] }),
    evaluate({ complete: true, candidates: [{ physicalId: 'broken' }] }),
    evaluate({ complete: true, candidates: [goodCandidate({ name: ' 审批工作流' })] }),
    evaluate({ complete: true, candidates: [goodCandidate()] }, { ...goodBinding(), atom: 'workflow.delete' }),
  ];
  const accessor = goodCandidate();
  Object.defineProperty(accessor, 'name', { enumerable: true, get() { throw new Error('SECRET_GETTER_TEXT'); } });
  checks.push(evaluate({ complete: true, candidates: [accessor] }));
  for (const result of checks) {
    if (result.allowAction || result.status === 'SAME' || JSON.stringify(result).includes('SECRET_GETTER_TEXT')) throw new Error(`fail-open/泄漏: ${JSON.stringify(result)}`);
  }
  const missing = evaluate({ complete: true, candidates: [] });
  if (missing.status !== 'MISSING' || missing.allowAction) throw new Error(`可信零扫描未 MISSING: ${JSON.stringify(missing)}`);
});

await check('V2-D successor 只认冻结 transition/当前 head/同平台 ID/exact 新 revision，并使旧 head 失效', () => {
  const handle = validHandle();
  const create = (patch = {}) => api.createRunSuccessorProof?.({
    handle, binding: goodBinding(), transitionId: 'rename-main',
    previousHeadHash: JSON.parse(lockSetBytes).receipts[0].receiptHash,
    authoritativeReadback: { name: '审批工作流V2', code: 'wf-002', platformId: '90071992547409931234', revisionId: 'rev-8' },
    runId: 'run-v2-001', ...patch,
  }) ?? { ok: false, reason: 'V2_API_MISSING' };
  assertDenied(create({ transitionId: 'unknown-transition' }), '未知 transition 被放行');
  assertDenied(create({ previousHeadHash: '0'.repeat(64) }), '非当前 head 被放行');
  assertDenied(create({ authoritativeReadback: { name: '审批工作流V2', code: 'wf-002', platformId: 'new-generation', revisionId: 'rev-8' } }), '平台 ID 换代被放行');
  assertDenied(create({ authoritativeReadback: { name: '审批工作流V2', code: 'wf-002', platformId: '90071992547409931234', revisionId: null } }), '缺新 revision 被放行');
  const next = create();
  if (!next.ok || next.previousReceiptHash === next.receiptHash || next.runId !== 'run-v2-001') throw new Error(`合法 successor 未成立: ${JSON.stringify(next)}`);
  const stale = api.evaluateEntityAction?.({ handle, binding: goodBinding(), scan: { complete: true, candidates: [goodCandidate()] } });
  if (!stale || stale.allowAction || stale.status === 'SAME') throw new Error(`旧 head 仍可动作: ${JSON.stringify(stale)}`);
});

if (failures.length) {
  for (const failure of failures) console.error(`RED  teachin-semantic-lock-v2: ${failure}`);
  console.error(`RED  teachin-semantic-lock-v2: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   teachin-semantic-lock-v2: ${passed}/${passed} 全过（纯函数零 SUT）`);
