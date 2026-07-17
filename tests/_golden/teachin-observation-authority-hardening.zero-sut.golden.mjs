#!/usr/bin/env node
// 冻结验收：身份观察受信只认 opaque accepted-ledger authority，并拒一证多对象、无关证据、
// UTF-8 百分号敏感绕过与全部 Proxy。只调纯函数/读冻结文件；禁止 SUT、fake、fixture、浏览器、网络。

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isProxy } from 'node:util/types';
import * as identityApi from '../../lib/teachin-identity-observations.mjs';
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
function assertRejected(result, label) {
  if (!result || result.ok === true || result.trusted === true) throw new Error(`${label} 被错误授权：${JSON.stringify(result)}`);
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
function baseCapture(caseId, events = [{ action: 'click', path: '/ai-manager/process/list', text: '审批工作流' }]) {
  return buildTeachInCapture({
    caseId, startUrl: '/ai-manager/process/list', createdAt: '2026-07-17T00:00:00.000Z', events,
  });
}
function bundle({ caseId = 'tc_observation_authority', observations = [observation()], events } = {}) {
  const sidecar = identityApi.buildIdentityObservationSidecar({ caseId, observations });
  const observationRaw = identityApi.serializeIdentityObservationSidecar(sidecar);
  const capture = identityApi.bindCaptureIdentityObservations({ capture: baseCapture(caseId, events), observationRaw });
  const captureRaw = `${JSON.stringify(capture, null, 2)}\n`;
  return { caseId, sidecar, observationRaw, capture, captureRaw };
}
function structuralReview(b) {
  return identityApi.reviewIdentityObservationBundle({
    caseId: b.caseId, captureRaw: b.captureRaw, observationRaw: b.observationRaw, pathFacts: goodPaths,
  });
}
function forgedExpectedBinding(b) {
  const review = structuralReview(b);
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
function legacyTrustedReview(b) {
  return identityApi.verifyTrustedIdentityObservationBundle({
    caseId: b.caseId,
    captureRaw: b.captureRaw,
    observationRaw: b.observationRaw,
    pathFacts: goodPaths,
    expectedBinding: forgedExpectedBinding(b),
  });
}

let packageApi = null;
let intakeApi = null;
try {
  [packageApi, intakeApi] = await Promise.all([
    import('../../lib/entity-semantic-lock-package.mjs'),
    import('../../lib/record-distill.mjs'),
  ]);
} catch {
  // 实现前允许模块尚未汇入；对应验收项保持真实 RED，不以测试桩伪造 authority。
}

function requireAuthorityApis() {
  const acceptedReview = identityApi.verifyAcceptedIdentityObservationBundle;
  if (!packageApi || !intakeApi || typeof acceptedReview !== 'function'
    || typeof packageApi.buildTeachInPackageManifest !== 'function'
    || typeof packageApi.verifyTeachInPackage !== 'function'
    || typeof intakeApi.verifyIntakenPackage !== 'function') {
    throw new Error('OPAQUE_ACCEPTED_LEDGER_AUTHORITY_API_MISSING');
  }
  return acceptedReview;
}
function mintAcceptedAuthority(b) {
  requireAuthorityApis();
  const manifest = packageApi.buildTeachInPackageManifest({
    caseId: b.caseId,
    captureBytes: b.captureRaw,
    sidecarBytes: b.observationRaw,
    observationCount: b.sidecar.observations.length,
    observationSchemaVersion: b.sidecar.schemaVersion,
  });
  const manifestBytes = packageApi.serializeTeachInPackageManifest(manifest);
  const packageReview = packageApi.verifyTeachInPackage({
    caseId: b.caseId,
    captureBytes: b.captureRaw,
    sidecarBytes: b.observationRaw,
    manifestBytes,
  });
  if (!packageReview.ok) throw new Error(`PACKAGE_AUTHORITY_NOT_MINTED:${packageReview.reason}`);
  const ledgerEntries = [{
    schemaVersion: 1,
    event: 'intake',
    intakeStatus: 'accepted',
    caseId: b.caseId,
    captureSha256: packageReview.captureSha256,
    sidecarSha256: packageReview.sidecarSha256,
    manifestSha256: packageReview.manifestSha256,
    observationCount: packageReview.observationCount,
    observationSchemaVersion: packageReview.observationSchemaVersion,
  }];
  const accepted = intakeApi.verifyIntakenPackage({
    caseId: b.caseId,
    ledgerEntries,
    packageAuthority: packageReview.authority,
    currentCaptureSha256: packageReview.captureSha256,
    currentSidecarSha256: packageReview.sidecarSha256,
    currentManifestSha256: packageReview.manifestSha256,
    observationCount: packageReview.observationCount,
    observationSchemaVersion: packageReview.observationSchemaVersion,
  });
  if (!accepted.ok || !accepted.authority) throw new Error(`ACCEPTED_AUTHORITY_NOT_MINTED:${accepted.reason}`);
  if (Object.keys(accepted.authority).length !== 0 || JSON.stringify(accepted.authority) !== '{}') {
    throw new Error('accepted-ledger authority 泄露了可复制字段');
  }
  return accepted.authority;
}
function acceptedReview(b, authority = mintAcceptedAuthority(b)) {
  const verify = requireAuthorityApis();
  return verify({
    caseId: b.caseId,
    captureRaw: b.captureRaw,
    observationRaw: b.observationRaw,
    pathFacts: goodPaths,
    acceptedIntakeAuthority: authority,
  });
}

await check('A1 plain expectedBinding 永远不能 trusted', () => {
  const b = bundle();
  const review = legacyTrustedReview(b);
  assertRejected(review, '普通 expectedBinding');
});

await check('A2 新入口只认 package→latest accepted ledger 铸造的不透明 authority', () => {
  const b = bundle();
  const verify = requireAuthorityApis();
  for (const forged of [forgedExpectedBinding(b), {}, Object.freeze(Object.create(null))]) {
    assertRejected(verify({
      caseId: b.caseId,
      captureRaw: b.captureRaw,
      observationRaw: b.observationRaw,
      pathFacts: goodPaths,
      acceptedIntakeAuthority: forged,
    }), '伪造 authority');
  }
  const trusted = acceptedReview(b);
  if (!trusted.ok || trusted.trusted !== true || trusted.replayReady !== false) throw new Error(JSON.stringify(trusted));
});

await check('A3 一个 eventSeq 不得为两个不同对象重复背书', () => {
  const b = bundle({
    observations: [
      observation(),
      observation({ kind: 'agent', name: '质检助手', code: 'agent-002', platformId: '90071992547409939999' }),
    ],
  });
  assertRejected(legacyTrustedReview(b), '旧 API 一证多对象');
  assertRejected(acceptedReview(b), '新 API 一证多对象');
});

await check('A4 fill/press 等无关 action 不得被 evidenceKind 自声明成对象读回', () => {
  for (const [action, patch] of [
    ['fill', { fieldLabel: '流程名称', value: '审批工作流' }],
    ['press', { key: 'Escape' }],
  ]) {
    const b = bundle({ events: [{ action, path: '/ai-manager/process/list', ...patch }] });
    assertRejected(legacyTrustedReview(b), `旧 API 无关 ${action}`);
    assertRejected(acceptedReview(b), `新 API 无关 ${action}`);
  }
});

function encodeRounds(value, rounds) {
  let out = value;
  for (let index = 0; index < rounds; index++) out = encodeURIComponent(out);
  return out;
}
await check('A5 UTF-8 百分号编码的中文密码/token/secret/URL 单轮多轮均拒', () => {
  const badValues = [
    encodeRounds('密码=六位数字', 1),
    encodeRounds('动态口令=六位数字', 2),
    encodeRounds('token=value', 3),
    encodeRounds('secret=value', 2),
    encodeRounds('https://例子.invalid/密码', 2),
  ];
  for (const name of badValues) {
    expectThrow(
      () => identityApi.buildIdentityObservationSidecar({ caseId: 'tc_utf8_sensitive', observations: [observation({ name })] }),
      /SENSITIVE_CONTENT|ENCODING_INVALID/,
    );
  }
});

await check('A6 非法/截断/overlong/不收敛编码拒绝，普通中文百分号不误伤', () => {
  const malformed = ['%E5%AF', '%C0%AF', '%E5%ZZ%A0'];
  let deep = encodeURIComponent('密码');
  for (let index = 0; index < 24; index++) deep = encodeURIComponent(deep);
  malformed.push(deep);
  for (const name of malformed) {
    expectThrow(
      () => identityApi.buildIdentityObservationSidecar({ caseId: 'tc_utf8_invalid', observations: [observation({ name })] }),
      /SENSITIVE_CONTENT|ENCODING_INVALID/,
    );
  }
  const clean = identityApi.buildIdentityObservationSidecar({
    caseId: 'tc_utf8_clean', observations: [observation({ name: '中文流程完成率 100%' })],
  });
  if (clean.observations[0].name !== '中文流程完成率 100%') throw new Error('合法百分号基线被改写');
});

function countedProxy(target) {
  let trapCalls = 0;
  const count = (fn) => (...args) => { trapCalls += 1; return fn(...args); };
  const proxy = new Proxy(target, {
    getPrototypeOf: count(Reflect.getPrototypeOf),
    ownKeys: count(Reflect.ownKeys),
    getOwnPropertyDescriptor: count(Reflect.getOwnPropertyDescriptor),
    get: count(Reflect.get),
  });
  if (!isProxy(proxy)) throw new Error('测试前提错误：Node 未识别 Proxy');
  return { proxy, calls: () => trapCalls };
}
await check('A7 顶层/嵌套 Proxy 先由 util.types.isProxy 拒绝且零 trap', () => {
  const outer = countedProxy({ caseId: 'tc_proxy_outer', observations: [observation()] });
  expectThrow(() => identityApi.buildIdentityObservationSidecar(outer.proxy), /UNSAFE_DATA_SHAPE/);
  if (outer.calls() !== 0) throw new Error(`顶层 Proxy trap 被执行 ${outer.calls()} 次`);

  const nested = countedProxy(observation());
  expectThrow(
    () => identityApi.buildIdentityObservationSidecar({ caseId: 'tc_proxy_nested', observations: [nested.proxy] }),
    /UNSAFE_DATA_SHAPE/,
  );
  if (nested.calls() !== 0) throw new Error(`嵌套 Proxy trap 被执行 ${nested.calls()} 次`);
});

await check('A8 两份旧冻结测试 checksum 保持原值', () => {
  const frozen = [
    ['loop/prd-teachin-observation-sidecar.json', 'tests/_golden/teachin-observation-sidecar.zero-sut.golden.mjs'],
    ['loop/prd-teachin-observation-sidecar-hardening.json', 'tests/_golden/teachin-observation-sidecar-hardening.zero-sut.golden.mjs'],
  ];
  for (const [prdPath, testPath] of frozen) {
    const prd = JSON.parse(readFileSync(prdPath, 'utf8'));
    const actual = createHash('sha256').update(readFileSync(testPath)).digest('hex');
    if (prd.testChecksums?.[testPath] !== actual) throw new Error(`原冻结面变更：${testPath}`);
  }
});

if (failures.length) {
  for (const failure of failures) console.error(`RED  teachin-observation-authority-hardening: ${failure}`);
  console.error(`RED  teachin-observation-authority-hardening: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   teachin-observation-authority-hardening: ${passed}/${passed} 全过（纯函数零 SUT）`);
