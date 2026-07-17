#!/usr/bin/env node
// 冻结验收：record→distill→compile→sign 的身份旁车与 hash 链。
// 只调用纯函数；禁止启动浏览器、网络、fake 或 fixture SUT。

import {
  createIdentityObservationSidecar,
  distillIdentityCandidates,
  buildEntityLocksDraft,
  freezeEntityLocks,
  verifyFrozenEntityLocks,
} from '../../lib/entity-semantic-lock-artifacts.mjs';

const eventsBytes = Buffer.from(JSON.stringify([
  { stepId: 'step-1', intentId: 'intent-1', atom: 'workflow.open', action: 'click' },
]));
const captureSha256 = `sha256:${'a'.repeat(64)}`;
const scopeFingerprint = `sha256:${'b'.repeat(64)}`;

function fail(message) { throw new Error(message); }
function mustThrow(fn, pattern) {
  let caught;
  try { fn(); } catch (error) { caught = error; }
  if (!caught) fail('预期拒绝但实际放行');
  if (pattern && !pattern.test(String(caught.message))) fail(`错误类别不符：${caught.message}`);
}

const observations = createIdentityObservationSidecar({
  caseId: 'tc-lock-wiring',
  captureSha256,
  observations: [{
    eventSeq: 1,
    kind: 'workflow',
    name: '审批工作流',
    code: 'wf-001',
    platformId: '90071992547409931234',
    scopeFingerprint,
    authority: 'record-observed',
  }],
});

if (observations.signed !== false || observations.replayReady !== false) fail('record 观察不得签署或可回放');
if (!/^sha256:[a-f0-9]{64}$/.test(observations.sidecarSha256)) fail('观察旁车缺内容 hash');
if (JSON.stringify(observations).match(/https?:|cookie|token|header|query|responseBody|requestPayload/i)) fail('观察旁车越过最小白名单');

const distilled = distillIdentityCandidates({
  caseId: 'tc-lock-wiring',
  captureSha256,
  observations,
  eventEvidence: [{ eventSeq: 1, action: 'click' }, { eventSeq: 2, action: 'fill' }],
});
if (distilled.signed !== false || distilled.replayReady !== false) fail('distill 候选不得签署或可回放');
if (distilled.identityCandidates.length !== 1) fail('已观察 event 应形成一个身份候选');
if (distilled.pending.length !== 1 || distilled.pending[0].eventSeq !== 2) fail('证不出的 event 必须进 pending');

const draft = buildEntityLocksDraft({
  caseId: 'tc-lock-wiring',
  eventsBytes,
  identityCandidates: distilled.identityCandidates,
  pending: distilled.pending,
  bindings: [{ stepId: 'step-1', intentId: 'intent-1', atom: 'workflow.open', role: 'target', candidateId: distilled.identityCandidates[0].candidateId }],
});
if (draft.artifactKind !== 'entity-locks-draft' || draft.signed !== false || draft.replayReady !== false) fail('compile 只能生成未签锁草稿');
if (!/^sha256:[a-f0-9]{64}$/.test(draft.eventsSha256)) fail('draft 未绑定 events 原始字节 hash');
const binding = draft.bindings[0];
if (binding.stepId !== 'step-1' || binding.intentId !== 'intent-1' || binding.atom !== 'workflow.open' || binding.role !== 'target') fail('draft 未完整保留 step/intent/atom/role');

mustThrow(() => freezeEntityLocks({ draft, eventsBytes, signerId: 'steven', signedAt: '2026-07-16T00:00:00.000Z', confirmations: [] }), /pending|confirm|确认|authority|权威/i);

const resolvedDraft = buildEntityLocksDraft({
  caseId: 'tc-lock-wiring',
  eventsBytes,
  identityCandidates: distilled.identityCandidates,
  pending: [],
  bindings: [{ stepId: 'step-1', intentId: 'intent-1', atom: 'workflow.open', role: 'target', candidateId: distilled.identityCandidates[0].candidateId }],
});

const frozen = freezeEntityLocks({
  draft: resolvedDraft,
  eventsBytes,
  signerId: 'steven',
  signedAt: '2026-07-16T00:00:00.000Z',
  confirmations: [{
    candidateId: distilled.identityCandidates[0].candidateId,
    source: 'user-confirmed',
    name: '审批工作流',
    code: 'wf-001',
    platformId: '90071992547409931234',
    scopeFingerprint,
  }],
});
if (frozen.artifactKind !== 'entity-locks-frozen' || frozen.signed !== true || frozen.replayReady !== true) fail('人签未生成 frozen 锁');
if (!verifyFrozenEntityLocks({ frozen, eventsBytes, caseId: 'tc-lock-wiring' }).ok) fail('合法 frozen 自守未过');
if (frozen.bindings[0].intentId !== 'intent-1' || frozen.bindings[0].role !== 'target') fail('frozen 丢失 intent/role 绑定');

const tamperedEvents = Buffer.from(eventsBytes.toString().replace('step-1', 'step-x'));
const tampered = verifyFrozenEntityLocks({ frozen, eventsBytes: tamperedEvents, caseId: 'tc-lock-wiring' });
if (tampered.ok || tampered.allowReplay !== false || !tampered.reason || !tampered.nextAction) fail('events 篡改必须结构化拒绝回放');

console.log('ok   teachin-semantic-lock-artifacts: 未签观察→候选/pending→draft→人签 frozen hash 链（零 SUT）');
