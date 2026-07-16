#!/usr/bin/env node
// 冻结验收：身份观察旁车必须闭合、未签、不可回放，并与 capture 字节 hash 联合绑定。
// 本测试只调纯函数和静态序列化，禁止启动浏览器、网络、SUT、fake 或 fixture。

import {
  bindCaptureIdentityObservations,
  buildIdentityObservationSidecar,
  identityBundleLedgerFields,
  reviewIdentityObservationBundle,
  serializeIdentityObservationSidecar,
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
const parent = `sha256:${'b'.repeat(64)}`;
const goodPaths = Object.freeze({
  capture: { regularFile: true, symbolicLink: false, parentSymbolicLink: false, identityBefore: 'cap-1', identityAfter: 'cap-1' },
  observations: { regularFile: true, symbolicLink: false, parentSymbolicLink: false, identityBefore: 'obs-1', identityAfter: 'obs-1' },
});
function observation(overrides = {}) {
  return {
    kind: 'workflow', name: '审批工作流', code: 'wf-001', platformId: '90071992547409931234',
    scopeFingerprint: scope, parent, evidenceKind: 'detail-dual-anchor-readback', eventSeq: 2,
    ...overrides,
  };
}
function baseCapture(caseId = 'tc_identity_sidecar') {
  return buildTeachInCapture({
    caseId, startUrl: '/ai-manager/process/list', createdAt: '2026-07-16T00:00:00.000Z',
    events: [{ action: 'click', path: '/ai-manager/process/list', text: '审批工作流' }],
  });
}
function bundle({ caseId = 'tc_identity_sidecar', observations = [observation()] } = {}) {
  const sidecar = buildIdentityObservationSidecar({ caseId, observations });
  const observationRaw = serializeIdentityObservationSidecar(sidecar);
  const capture = bindCaptureIdentityObservations({ capture: baseCapture(caseId), observationRaw });
  const captureRaw = `${JSON.stringify(capture, null, 2)}\n`;
  return { sidecar, observationRaw, capture, captureRaw };
}

await check('O1 旁车闭合且永远未签/不可回放', () => {
  const b = bundle();
  const top = Object.keys(b.sidecar).sort().join(',');
  const source = Object.keys(b.sidecar.source).sort().join(',');
  const fields = Object.keys(b.sidecar.observations[0]).sort().join(',');
  if (top !== 'artifactKind,caseId,observations,schemaVersion,source') throw new Error(`顶层未闭合：${top}`);
  if (source !== 'distillRequired,kind,replayReady,signed') throw new Error(`source 未闭合：${source}`);
  if (fields !== 'code,eventSeq,evidenceKind,kind,name,parent,platformId,scopeFingerprint') throw new Error(`观察未闭合：${fields}`);
  if (b.sidecar.source.signed !== false || b.sidecar.source.replayReady !== false || b.sidecar.source.distillRequired !== true) throw new Error('旁车降权标记不完整');
});

await check('O2 缺 code 保留 null/pending，不根据 name 补猜', () => {
  const b = bundle({ observations: [observation({ code: null })] });
  if (b.sidecar.observations[0].code !== null) throw new Error('code 未保留 null');
  const r = reviewIdentityObservationBundle({ caseId: b.sidecar.caseId, captureRaw: b.captureRaw, observationRaw: b.observationRaw, pathFacts: goodPaths });
  if (!r.ok || r.identityStatus !== 'pending' || r.replayReady !== false) throw new Error(JSON.stringify(r));
});

await check('O3 未知字段与 URL/query/header/cookie/token/raw body 全拒绝', () => {
  for (const key of ['url', 'query', 'header', 'cookie', 'token', 'rawBody']) {
    expectThrow(() => buildIdentityObservationSidecar({ caseId: 'tc_bad_key', observations: [observation({ [key]: 'forbidden' })] }), /UNKNOWN_FIELD/);
  }
  for (const patch of [{ name: 'https://real.example/object' }, { code: 'Bearer token-value' }, { platformId: 'cookie=session' }]) {
    expectThrow(() => buildIdentityObservationSidecar({ caseId: 'tc_bad_value', observations: [observation(patch)] }), /SENSITIVE_CONTENT/);
  }
});

await check('O4 capture v2 只记定名旁车/hash/条数，联合复核真算三 hash', () => {
  const b = bundle();
  const ref = b.capture.identityObservations;
  if (Object.keys(ref).sort().join(',') !== 'count,fileName,sha256' || ref.fileName !== 'identity-observations.json' || ref.count !== 1 || !/^sha256:[a-f0-9]{64}$/.test(ref.sha256)) throw new Error(JSON.stringify(ref));
  const r = reviewIdentityObservationBundle({ caseId: b.sidecar.caseId, captureRaw: b.captureRaw, observationRaw: b.observationRaw, pathFacts: goodPaths });
  if (!r.ok || r.identityStatus !== 'observed' || r.replayReady !== false) throw new Error(JSON.stringify(r));
  for (const key of ['captureSha256', 'observationSha256', 'bundleSha256']) if (!/^sha256:[a-f0-9]{64}$/.test(r[key])) throw new Error(`${key} 未真算`);
});

await check('O5 intake 绑定后 capture/旁车任一换包均 fail-closed', () => {
  const b = bundle();
  const first = reviewIdentityObservationBundle({ caseId: b.sidecar.caseId, captureRaw: b.captureRaw, observationRaw: b.observationRaw, pathFacts: goodPaths });
  const expectedBinding = identityBundleLedgerFields(first);
  const changedCapture = `${JSON.stringify({ ...b.capture, events: [{ ...b.capture.events[0], text: '被换包' }] }, null, 2)}\n`;
  const c = reviewIdentityObservationBundle({ caseId: b.sidecar.caseId, captureRaw: changedCapture, observationRaw: b.observationRaw, pathFacts: goodPaths, expectedBinding });
  if (c.ok || c.reason !== 'CAPTURE_SWAPPED') throw new Error(JSON.stringify(c));

  const changedSidecar = { ...b.sidecar, observations: [{ ...b.sidecar.observations[0], name: '被换包' }] };
  const changedObservationRaw = `${JSON.stringify(changedSidecar, null, 2)}\n`;
  const o = reviewIdentityObservationBundle({ caseId: b.sidecar.caseId, captureRaw: b.captureRaw, observationRaw: changedObservationRaw, pathFacts: goodPaths, expectedBinding });
  if (o.ok || o.reason !== 'OBSERVATION_SWAPPED') throw new Error(JSON.stringify(o));
});

await check('O6 caseId/定名/条数/hash/重复键任一不符均拒绝', () => {
  const b = bundle();
  const variants = [
    { ...b.capture, caseId: 'other-case' },
    { ...b.capture, identityObservations: { ...b.capture.identityObservations, fileName: 'other.json' } },
    { ...b.capture, identityObservations: { ...b.capture.identityObservations, count: 2 } },
    { ...b.capture, identityObservations: { ...b.capture.identityObservations, sha256: `sha256:${'f'.repeat(64)}` } },
  ];
  for (const changed of variants) {
    const r = reviewIdentityObservationBundle({ caseId: b.sidecar.caseId, captureRaw: `${JSON.stringify(changed)}\n`, observationRaw: b.observationRaw, pathFacts: goodPaths });
    if (r.ok) throw new Error(`应拒绝：${JSON.stringify(changed.identityObservations || changed.caseId)}`);
  }
  const duplicate = b.observationRaw.replace('"kind": "workflow"', '"kind": "workflow",\n      "kind": "agent"');
  const dup = reviewIdentityObservationBundle({ caseId: b.sidecar.caseId, captureRaw: b.captureRaw, observationRaw: duplicate, pathFacts: goodPaths });
  if (dup.ok || dup.reason !== 'DUPLICATE_KEY') throw new Error(JSON.stringify(dup));
});

await check('O7 软链/非常规文件/读前后换身份均 fail-closed', () => {
  const b = bundle();
  const badFacts = [
    { ...goodPaths, capture: { ...goodPaths.capture, symbolicLink: true } },
    { ...goodPaths, observations: { ...goodPaths.observations, parentSymbolicLink: true } },
    { ...goodPaths, capture: { ...goodPaths.capture, regularFile: false } },
    { ...goodPaths, observations: { ...goodPaths.observations, identityAfter: 'obs-2' } },
  ];
  for (const pathFacts of badFacts) {
    const r = reviewIdentityObservationBundle({ caseId: b.sidecar.caseId, captureRaw: b.captureRaw, observationRaw: b.observationRaw, pathFacts });
    if (r.ok || !['SYMLINK', 'NOT_REGULAR_FILE', 'READ_IDENTITY_CHANGED'].includes(r.reason)) throw new Error(JSON.stringify(r));
  }
});

await check('O8 台账投影最小且仍 replayReady:false', () => {
  const b = bundle();
  const r = reviewIdentityObservationBundle({ caseId: b.sidecar.caseId, captureRaw: b.captureRaw, observationRaw: b.observationRaw, pathFacts: goodPaths });
  const fields = identityBundleLedgerFields(r);
  if (Object.keys(fields).sort().join(',') !== 'bundleSha256,captureSha256,identityStatus,observationCount,observationSha256,replayReady') throw new Error(JSON.stringify(fields));
  if (fields.replayReady !== false || fields.identityStatus !== 'observed') throw new Error(JSON.stringify(fields));
  expectThrow(() => identityBundleLedgerFields({ ok: false, reason: 'BAD' }), /UNVERIFIED_BUNDLE/);
});

if (failures.length) {
  for (const failure of failures) console.error(`RED  teachin-observation-sidecar: ${failure}`);
  console.error(`RED  teachin-observation-sidecar: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   teachin-observation-sidecar: ${passed}/${passed} 全过（纯函数零 SUT）`);
