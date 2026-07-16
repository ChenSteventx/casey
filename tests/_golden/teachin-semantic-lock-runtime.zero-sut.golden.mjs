#!/usr/bin/env node
// 冻结验收：replay 浏览器前门、登录后 live rebind、mutation 前重验与关系双端锁。
// 只调用纯函数；禁止启动浏览器、网络、fake 或 fixture SUT。

import {
  preflightFrozenEntityLocks,
  rebindEntityLocksAfterLogin,
  authorizeLockedAction,
} from '../../lib/entity-semantic-lock-runtime.mjs';

function fail(message) { throw new Error(message); }

const hash = (char) => `sha256:${char.repeat(64)}`;
const makeReceipt = ({ lockId, kind, name, code, platformId }) => ({
  schemaVersion: 1,
  artifactKind: 'entity-identity-receipt',
  lockId,
  kind,
  bindingMode: 'existing',
  name,
  code,
  platformId,
  scopeFingerprint: hash('b'),
  parentReceiptHash: null,
  revisionPolicy: 'any',
  revisionId: null,
  source: 'user-confirmed',
  previousReceiptHash: null,
  status: 'active',
});

// runtime 验收使用调用方提供的 hash/签名验证缝，避免在冻结测试复制 receipt hash 算法。
const sourceReceipt = makeReceipt({ lockId: 'lock-source', kind: 'workflow', name: '源工作流', code: 'wf-source', platformId: '10000000000000000001' });
const targetReceipt = makeReceipt({ lockId: 'lock-target', kind: 'agent', name: '目标智能体', code: 'agent-target', platformId: '10000000000000000002' });
const eventsBytes = Buffer.from(JSON.stringify([{ stepId: 's-rel', intentId: 'i-rel', atom: 'workflow.bindAgent', action: 'click' }]));
const frozen = {
  schemaVersion: 1,
  artifactKind: 'entity-locks-frozen',
  caseId: 'tc-lock-runtime',
  signed: true,
  replayReady: true,
  signerId: 'steven',
  signedAt: '2026-07-16T00:00:00.000Z',
  eventsSha256: hash('e'),
  receipts: [sourceReceipt, targetReceipt],
  bindings: [
    { stepId: 's-rel', intentId: 'i-rel', atom: 'workflow.bindAgent', role: 'source', lockId: 'lock-source' },
    { stepId: 's-rel', intentId: 'i-rel', atom: 'workflow.bindAgent', role: 'target', lockId: 'lock-target' },
  ],
  signature: hash('f'),
};
const validators = {
  hashEvents: (bytes) => bytes === eventsBytes ? hash('e') : hash('x'),
  verifySignature: (artifact) => artifact === frozen,
  verifyReceipt: (receipt) => receipt === sourceReceipt || receipt === targetReceipt,
};

const preflight = preflightFrozenEntityLocks({
  caseId: 'tc-lock-runtime',
  eventsBytes,
  frozen,
  requiredBindings: frozen.bindings.map(({ stepId, intentId, atom, role }) => ({ stepId, intentId, atom, role })),
  validators,
});
if (!preflight.ok || preflight.allowBrowserLaunch !== true) fail(`合法 frozen 未放行浏览器：${JSON.stringify(preflight)}`);

for (const patch of [
  { frozen: { ...frozen, signed: false } },
  { eventsBytes: Buffer.from('tampered') },
  { requiredBindings: [...frozen.bindings.map(({ stepId, intentId, atom, role }) => ({ stepId, intentId, atom, role })), { stepId: 's-rel', intentId: 'i-rel', atom: 'workflow.bindAgent', role: 'other' }] },
]) {
  const denied = preflightFrozenEntityLocks({ caseId: 'tc-lock-runtime', eventsBytes, frozen, requiredBindings: frozen.bindings, validators, ...patch });
  if (denied.ok || denied.allowBrowserLaunch !== false || !denied.reason || !denied.nextAction) fail(`浏览器前门未 fail-closed：${JSON.stringify(denied)}`);
}

const sameCandidates = {
  'lock-source': [{ physicalId: 'row-source', ...sourceReceipt }],
  'lock-target': [{ physicalId: 'row-target', ...targetReceipt }],
};
const rebound = rebindEntityLocksAfterLogin({ frozen, candidatesByLockId: sameCandidates, validators });
if (!rebound.ok || rebound.allowAction !== true || rebound.bindings.length !== 2) fail(`登录后 SAME 未重绑定：${JSON.stringify(rebound)}`);

const changedTarget = {
  ...sameCandidates,
  'lock-target': [{ physicalId: 'row-new-target', ...targetReceipt, platformId: '99999999999999999999' }],
};
let clickCount = 0;
const deniedRelation = authorizeLockedAction({
  frozen,
  step: { stepId: 's-rel', intentId: 'i-rel', atom: 'workflow.bindAgent', mutation: true, relationWrite: true },
  candidatesByLockId: changedTarget,
  validators,
  perform: () => { clickCount += 1; },
});
if (deniedRelation.allowAction || deniedRelation.status === 'SAME' || clickCount !== 0 || !deniedRelation.reason || !deniedRelation.nextAction) {
  fail(`关系 target 变化时必须整体零点击：${JSON.stringify({ deniedRelation, clickCount })}`);
}

const allowedRelation = authorizeLockedAction({
  frozen,
  step: { stepId: 's-rel', intentId: 'i-rel', atom: 'workflow.bindAgent', mutation: true, relationWrite: true },
  candidatesByLockId: sameCandidates,
  validators,
  perform: () => { clickCount += 1; },
});
if (!allowedRelation.allowAction || allowedRelation.status !== 'SAME' || clickCount !== 1) fail('source+target 均 SAME 时应恰执行一次');

// 第二次授权必须使用本次传入的 live candidates，不能复用上一轮 SAME。
const toctou = authorizeLockedAction({
  frozen,
  step: { stepId: 's-rel', intentId: 'i-rel', atom: 'workflow.bindAgent', mutation: true, relationWrite: true },
  candidatesByLockId: changedTarget,
  validators,
  perform: () => { clickCount += 1; },
});
if (toctou.allowAction || clickCount !== 1) fail('mutation 前未重新验证，旧 SAME 被错误复用');

console.log('ok   teachin-semantic-lock-runtime: preflight→live rebind→mutation 重验→关系双端锁（零 SUT）');
