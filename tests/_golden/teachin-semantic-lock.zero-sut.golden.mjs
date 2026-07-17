#!/usr/bin/env node
// 冻结验收：手录业务对象身份快照必须在回放前确定性比较；只有 SAME 可继续。
// 本测试只跑纯函数与静态检查，禁止启动浏览器、网络、fake 或 fixture SUT。

import {
  createEntityLockReceipt,
  createEntityLockSuccessor,
  compareEntityLock,
  resolveEntityLockCandidate,
  verifyEntityLockReceipt,
} from '../../lib/entity-semantic-lock.mjs';

let passed = 0;
const failures = [];
async function check(name, fn) {
  try { await fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
}
function mustThrow(fn, pattern) {
  let caught = null;
  try { fn(); } catch (error) { caught = error; }
  if (!caught) throw new Error('预期拒绝但实际放行');
  if (pattern && !pattern.test(String(caught.message))) throw new Error(`错误类别不符：${caught.message}`);
}
function receipt(overrides = {}) {
  return createEntityLockReceipt({
    lockId: 'lock-workflow-main', kind: 'workflow', bindingMode: 'existing',
    scopeFingerprint: 'sha256:scope-a',
    expected: { name: '审批工作流', code: 'wf-001' },
    observed: { name: '审批工作流', code: 'wf-001', platformId: '90071992547409931234', revisionId: 'rev-7' },
    source: 'user-confirmed', revisionPolicy: 'exact', ...overrides,
  });
}

await check('A1 合法身份收据使用精确字符串并可验 hash', () => {
  const r = receipt();
  if (!verifyEntityLockReceipt(r) || r.platformId !== '90071992547409931234') throw new Error('合法收据未成立或长 ID 丢精度');
});

await check('A2 缺编号、原始 scope/URL、错误来源均拒绝', () => {
  mustThrow(() => receipt({ expected: { name: '审批工作流', code: '' } }), /code|编号/i);
  mustThrow(() => receipt({ scopeFingerprint: 'https://real-target.example/tenant' }), /scope|fingerprint|URL/i);
  mustThrow(() => receipt({ source: 'model-inferred' }), /source|来源|user-confirmed/i);
});

await check('A3 只有全部身份字段一致才 SAME', () => {
  const r = receipt();
  const result = compareEntityLock(r, {
    kind: 'workflow', name: r.name, code: r.code, platformId: r.platformId,
    scopeFingerprint: r.scopeFingerprint, parentReceiptHash: null, revisionId: r.revisionId,
  });
  if (result.status !== 'SAME' || result.allowAction !== true) throw new Error(JSON.stringify(result));
});

await check('A4 名称/编号/ID/scope/revision 任一变化都 CHANGED 且零动作', () => {
  const r = receipt();
  const base = { kind: r.kind, name: r.name, code: r.code, platformId: r.platformId, scopeFingerprint: r.scopeFingerprint, parentReceiptHash: null, revisionId: r.revisionId };
  for (const patch of [
    { name: '新名称' }, { code: 'wf-002' }, { platformId: 'other-id' },
    { scopeFingerprint: 'sha256:scope-b' }, { revisionId: 'rev-8' },
  ]) {
    const result = compareEntityLock(r, { ...base, ...patch });
    if (result.status !== 'CHANGED' || result.allowAction !== false || !result.reason || !result.nextAction) throw new Error(JSON.stringify({ patch, result }));
  }
});

await check('A5 0/N 候选与未证身份分别 MISSING/AMBIGUOUS/UNVERIFIED', () => {
  const r = receipt({ revisionPolicy: 'any' });
  const none = resolveEntityLockCandidate([], r);
  const many = resolveEntityLockCandidate([
    { physicalId: 'row-1', kind: r.kind, name: r.name, code: r.code, platformId: r.platformId, scopeFingerprint: r.scopeFingerprint },
    { physicalId: 'row-2', kind: r.kind, name: r.name, code: r.code, platformId: r.platformId, scopeFingerprint: r.scopeFingerprint },
  ], r);
  const unverified = compareEntityLock(r, { kind: r.kind, name: r.name, code: '', scopeFingerprint: r.scopeFingerprint });
  if (none.status !== 'MISSING' || many.status !== 'AMBIGUOUS' || unverified.status !== 'UNVERIFIED') throw new Error(JSON.stringify({ none, many, unverified }));
  if (none.allowAction || many.allowAction || unverified.allowAction) throw new Error('非 SAME 状态不得动作');
});

await check('A6 同双锚但删除重建导致 platformId 改变仍拒绝', () => {
  const r = receipt({ revisionPolicy: 'any' });
  const result = resolveEntityLockCandidate([
    { physicalId: 'row-new', kind: r.kind, name: r.name, code: r.code, platformId: 'new-generation-id', scopeFingerprint: r.scopeFingerprint },
  ], r);
  if (result.status !== 'CHANGED' || result.reason !== 'PLATFORM_ID_MISMATCH' || result.allowAction) throw new Error(JSON.stringify(result));
});

await check('A7 显式身份迁移生成 successor 并链接旧 hash', () => {
  const old = receipt({ revisionPolicy: 'any' });
  const next = createEntityLockSuccessor({
    previous: old,
    transition: { declared: true, expected: { name: '审批工作流V2', code: 'wf-002' } },
    observed: { name: '审批工作流V2', code: 'wf-002', platformId: old.platformId },
    evidenceSource: 'platform-readback',
  });
  if (!verifyEntityLockReceipt(next) || next.previousReceiptHash !== old.receiptHash || next.name !== '审批工作流V2') throw new Error('successor 链不完整');
  mustThrow(() => createEntityLockSuccessor({ previous: old, transition: { declared: false }, observed: {} }), /transition|迁移|声明/i);
});

if (failures.length) {
  for (const failure of failures) console.error(`RED  teachin-semantic-lock: ${failure}`);
  console.error(`RED  teachin-semantic-lock: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   teachin-semantic-lock: ${passed}/${passed} 全过（纯函数零 SUT）`);
