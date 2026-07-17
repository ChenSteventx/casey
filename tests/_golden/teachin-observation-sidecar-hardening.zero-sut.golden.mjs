#!/usr/bin/env node
// 冻结验收：受信旁车复核不得自证，必须拒 accessor/额外键/编码敏感绕过/虚假 eventSeq。
// 只调纯函数与静态读取；禁止启动网络、SUT、fake、fixture server 或浏览器。

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  bindCaptureIdentityObservations,
  buildIdentityObservationSidecar,
  identityBundleLedgerFields,
  reviewIdentityObservationBundle,
  serializeIdentityObservationSidecar,
  verifyTrustedIdentityObservationBundle,
} from '../../lib/teachin-identity-observations.mjs';
import { buildTeachInCapture } from '../../lib/record-capture.mjs';

let passed = 0;
const failures = [];
async function check(name, fn) {
  try { await fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
}
function expectThrow(fn, pattern) {
  let caught = null;
  try { fn(); } catch (error) { caught = error; }
  if (!caught) throw new Error('预期拒绝但实际放行');
  if (pattern && !pattern.test(String(caught.message))) throw new Error(`错误类别不符：${caught.message}`);
}

const scope = `sha256:${'a'.repeat(64)}`;
const goodPaths = {
  capture: { regularFile: true, symbolicLink: false, parentSymbolicLink: false, identityBefore: 'cap-1', identityAfter: 'cap-1' },
  observations: { regularFile: true, symbolicLink: false, parentSymbolicLink: false, identityBefore: 'obs-1', identityAfter: 'obs-1' },
};
function observation(overrides = {}) {
  return {
    kind: 'workflow', name: '审批工作流', code: 'wf-001', platformId: '90071992547409931234',
    scopeFingerprint: scope, parent: null, evidenceKind: 'detail-dual-anchor-readback', eventSeq: 1,
    ...overrides,
  };
}
function capture(caseId = 'tc_identity_hardening', events = [{ action: 'click', path: '/ai-manager/process/list', text: '审批工作流' }]) {
  return buildTeachInCapture({ caseId, startUrl: '/ai-manager/process/list', createdAt: '2026-07-17T00:00:00.000Z', events });
}
function bundle({ caseId = 'tc_identity_hardening', observations = [observation()], baseCapture = capture(caseId) } = {}) {
  const sidecar = buildIdentityObservationSidecar({ caseId, observations });
  const observationRaw = serializeIdentityObservationSidecar(sidecar);
  const boundCapture = bindCaptureIdentityObservations({ capture: baseCapture, observationRaw });
  const captureRaw = `${JSON.stringify(boundCapture, null, 2)}\n`;
  return { caseId, sidecar, observationRaw, boundCapture, captureRaw };
}
function structuralReview(b) {
  return reviewIdentityObservationBundle({ caseId: b.caseId, captureRaw: b.captureRaw, observationRaw: b.observationRaw, pathFacts: goodPaths });
}
function externalBinding(b, review = structuralReview(b)) {
  return {
    schemaVersion: 1,
    artifactKind: 'accepted-identity-bundle-binding',
    source: 'accepted-intake-ledger',
    intakeStatus: 'accepted',
    caseId: b.caseId,
    captureFile: 'teach-in-capture.json',
    observationFile: 'identity-observations.json',
    captureSha256: review.captureSha256,
    observationSha256: review.observationSha256,
    bundleSha256: review.bundleSha256,
    observationCount: review.observationCount,
  };
}
function trustedReview(b, expectedBinding = externalBinding(b), pathFacts = goodPaths) {
  return verifyTrustedIdentityObservationBundle({
    caseId: b.caseId, captureRaw: b.captureRaw, observationRaw: b.observationRaw, pathFacts, expectedBinding,
  });
}

await check('H1 结构复核不得冒充受信，受信 API 必须外部绑定', () => {
  const b = bundle();
  const structural = structuralReview(b);
  if (!structural.ok || structural.trusted !== false) throw new Error(JSON.stringify(structural));
  const missing = verifyTrustedIdentityObservationBundle({ caseId: b.caseId, captureRaw: b.captureRaw, observationRaw: b.observationRaw, pathFacts: goodPaths });
  if (missing.ok || missing.trusted || missing.reason !== 'EXPECTED_BINDING_REQUIRED') throw new Error(JSON.stringify(missing));
  const selfDerived = verifyTrustedIdentityObservationBundle({
    caseId: b.caseId, captureRaw: b.captureRaw, observationRaw: b.observationRaw, pathFacts: goodPaths,
    expectedBinding: identityBundleLedgerFields(structural),
  });
  if (selfDerived.ok || selfDerived.trusted || selfDerived.reason !== 'EXPECTED_BINDING_INVALID') throw new Error(JSON.stringify(selfDerived));
  const trusted = trustedReview(b);
  if (!trusted.ok || trusted.trusted !== true || trusted.replayReady !== false) throw new Error(JSON.stringify(trusted));
});

await check('H2 两文件协调替换也不得骑旧外部绑定', () => {
  const original = bundle();
  const expectedBinding = externalBinding(original);
  const replaced = bundle({ observations: [observation({ name: '替换后工作流', code: 'wf-002' })] });
  const review = trustedReview(replaced, expectedBinding);
  if (review.ok || review.trusted || !['CAPTURE_SWAPPED', 'OBSERVATION_SWAPPED', 'BUNDLE_SWAPPED'].includes(review.reason)) throw new Error(JSON.stringify(review));
});

await check('H3 accessor/symbol/非枚举额外键全拒绝且 getter 不执行', () => {
  const base = capture();
  let getterCalls = 0;
  const accessorCapture = { ...base };
  delete accessorCapture.events;
  Object.defineProperty(accessorCapture, 'events', {
    enumerable: true,
    get() { getterCalls += 1; return base.events; },
  });
  const observationRaw = serializeIdentityObservationSidecar(buildIdentityObservationSidecar({ caseId: base.caseId, observations: [observation()] }));
  expectThrow(() => bindCaptureIdentityObservations({ capture: accessorCapture, observationRaw }), /UNSAFE_DATA_SHAPE/);
  if (getterCalls !== 0) throw new Error(`getter 被执行 ${getterCalls} 次`);

  const withSymbol = observation();
  withSymbol[Symbol('hidden')] = 'x';
  expectThrow(() => buildIdentityObservationSidecar({ caseId: 'tc_symbol', observations: [withSymbol] }), /UNSAFE_DATA_SHAPE/);

  const withHidden = observation();
  Object.defineProperty(withHidden, 'hidden', { value: 'x', enumerable: false });
  expectThrow(() => buildIdentityObservationSidecar({ caseId: 'tc_hidden', observations: [withHidden] }), /UNSAFE_DATA_SHAPE/);

  let ledgerGetterCalls = 0;
  const reviewWithGetter = {
    ok: true, replayReady: false, identityStatus: 'observed', observationCount: 1,
    observationSha256: `sha256:${'b'.repeat(64)}`, bundleSha256: `sha256:${'c'.repeat(64)}`,
  };
  Object.defineProperty(reviewWithGetter, 'captureSha256', {
    enumerable: true,
    get() { ledgerGetterCalls += 1; return `sha256:${'d'.repeat(64)}`; },
  });
  expectThrow(() => identityBundleLedgerFields(reviewWithGetter), /UNSAFE_DATA_SHAPE/);
  if (ledgerGetterCalls !== 0) throw new Error(`ledger getter 被执行 ${ledgerGetterCalls} 次`);
});

await check('H4 多轮百分号编码的 URL/token 与不收敛值均拒绝', () => {
  for (const patch of [
    { name: 'https%253A%252F%252Freal.example%252Fobject' },
    { code: '%74%6f%6b%65%6e=value' },
  ]) {
    expectThrow(() => buildIdentityObservationSidecar({ caseId: 'tc_encoded', observations: [observation(patch)] }), /SENSITIVE_CONTENT/);
  }
  let deep = '%74%6f%6b%65%6e';
  for (let i = 0; i < 24; i++) deep = deep.replaceAll('%', '%25');
  expectThrow(() => buildIdentityObservationSidecar({ caseId: 'tc_deep', observations: [observation({ name: deep })] }), /SENSITIVE_CONTENT/);
});

await check('H5 受信复核必须对账 capture 唯一 eventSeq', () => {
  const missing = bundle({ observations: [observation({ eventSeq: 2 })] });
  const missingReview = trustedReview(missing);
  if (missingReview.ok || missingReview.reason !== 'EVENT_SEQ_MISMATCH') throw new Error(JSON.stringify(missingReview));

  const duplicateBase = capture();
  duplicateBase.events = [{ ...duplicateBase.events[0], seq: 1 }, { ...duplicateBase.events[0], seq: 1 }];
  const duplicate = bundle({ baseCapture: duplicateBase });
  const duplicateReview = trustedReview(duplicate);
  if (duplicateReview.ok || duplicateReview.reason !== 'CAPTURE_EVENT_SEQ_INVALID') throw new Error(JSON.stringify(duplicateReview));

  const valid = trustedReview(bundle());
  if (!valid.ok || valid.trusted !== true) throw new Error(JSON.stringify(valid));
});

await check('H6 原冻结测试与 checksum 一字节未改', () => {
  const oldTest = 'tests/_golden/teachin-observation-sidecar.zero-sut.golden.mjs';
  const oldPrd = JSON.parse(readFileSync('loop/prd-teachin-observation-sidecar.json', 'utf8'));
  const actual = createHash('sha256').update(readFileSync(oldTest)).digest('hex');
  const frozen = '2f4e51ab6deb54d4586ca42b5f06e541d6684eeed6cfcb8de91ca92ddea25774';
  if (actual !== frozen || oldPrd.testChecksums?.[oldTest] !== frozen) throw new Error(`原冻结面变更：${actual}`);
});

if (failures.length) {
  for (const failure of failures) console.error(`RED  teachin-observation-sidecar-hardening: ${failure}`);
  console.error(`RED  teachin-observation-sidecar-hardening: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   teachin-observation-sidecar-hardening: ${passed}/${passed} 全过（纯函数零 SUT）`);
