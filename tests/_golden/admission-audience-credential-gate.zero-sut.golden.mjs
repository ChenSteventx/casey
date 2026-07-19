#!/usr/bin/env node
// 冻结验收（zero-SUT）：准入受众（admission audience）+ 凭据上下文门（credential-context gate）。
// 只调纯函数并静态读源；禁止启动子进程、浏览器、网络、fake 或 fixture SUT（SKILL.md:107）。
// 契约 admission-trust-root-separation（ADR-0010）。红先行：实现前 C1（门未导出）与 C5（无 audience 件现役被接受）必红。
//   audience = 准入件的必填签名字段 test|production；凭据上下文门 = 铸权后启动浏览器前判「受众须匹配凭据上下文」的纯函数门。

import * as admission from '../../lib/entity-semantic-lock-preflight.mjs';

const NEG_KEY = 'tests/_golden/fixtures/admission-audience/no-audience.frozen.json';
const CONTRACT_PRD = 'admission-trust-root-separation';

const failures = [];
function test(name, fn) {
  try { fn(); console.log(`ok   ${name}`); }
  catch (error) {
    const message = String(error?.message || error).replace(/\s+/g, ' ').slice(0, 400);
    failures.push(`${name}: ${message}`);
    console.error(`not ok ${name}: ${message}`);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function assertDenied(r, msg) {
  assert(r && r.ok === false, msg);
  assert(typeof r.reason === 'string' && r.reason.length > 0, `${msg}（缺 reason）`);
}
function assertAllowed(r, msg) { assert(r && r.ok === true, `${msg}（实得 ${r && r.reason}）`); }

// ── C1 凭据上下文门导出 ──（实现前红：函数不存在）
test('C1 checkCredentialAudienceGate 已导出为函数', () => {
  assert(typeof admission.checkCredentialAudienceGate === 'function', '凭据上下文门未导出——本契约核心新行为缺失');
});

// ── C2 严格匹配四态 ──
test('C2 严格匹配：test↔test allow、production↔production allow、交叉一律 deny', () => {
  const gate = admission.checkCredentialAudienceGate;
  assertAllowed(gate({ audience: 'test', credentialContext: 'test' }), 'test 受众 + test 上下文应放行');
  assertAllowed(gate({ audience: 'production', credentialContext: 'production' }), 'production 受众 + production 上下文应放行');
  assertDenied(gate({ audience: 'test', credentialContext: 'production' }), 'test 受众 + production 上下文应拒');
  assertDenied(gate({ audience: 'production', credentialContext: 'test' }), 'production 受众 + test 上下文应拒');
});

// ── C3 畸形入参 fail-closed ──
test('C3 畸形入参 fail-closed：缺字段/非枚举值/多余键一律拒，绝不抛穿或放行', () => {
  const gate = admission.checkCredentialAudienceGate;
  assertDenied(gate({ audience: 'test' }), '缺 credentialContext 应拒');
  assertDenied(gate({ credentialContext: 'test' }), '缺 audience 应拒');
  assertDenied(gate({ audience: 'staging', credentialContext: 'test' }), '非枚举 audience 应拒');
  assertDenied(gate({ audience: 'test', credentialContext: 'prod' }), '非枚举 credentialContext 应拒');
  assertDenied(gate({ audience: 'test', credentialContext: 'test', extra: 1 }), '多余键应拒（闭合入参）');
});

// ── C4 反向验收（核心安全属性）──
test('C4 反向验收：测试受众件在生产凭据上下文被机制阻断', () => {
  const r = admission.checkCredentialAudienceGate({ audience: 'test', credentialContext: 'production' });
  assertDenied(r, '测试锁改真 SUT 必须 fail-closed');
});

// ── C5 schema 必填 audience（经生产读路）──（实现前红：现役无 audience 件被接受铸权）
test('C5 无 audience 的冻结件经生产读路被拒（audience 必填）', () => {
  const r = admission.readIdentityAdmissionAuthorityFromPrd({ prdId: CONTRACT_PRD, artifactKey: NEG_KEY, domain: 'verify' });
  assertDenied(r, '缺 audience 字段的冻结件必须被拒（现役接受=红，实现后必填校验拒=绿）');
});

if (failures.length > 0) { console.error(`\n${failures.length} 检查失败`); process.exit(1); }
console.log('\n全部检查通过');
