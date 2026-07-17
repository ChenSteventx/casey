#!/usr/bin/env node
// 冻结验收：身份 artifact 的内容自哈希绝不等于执行权限；权限只来自 PRD checksum 铸造的分域 opaque handle。
// 仅调用纯函数并静态读取源码；禁止启动子进程、浏览器、网络、fake 或 fixture SUT。

import { readFileSync } from 'node:fs';
import * as admission from '../../lib/entity-semantic-lock-preflight.mjs';

const PRD_ID = 'teachin-semantic-lock-admission-authority';
const FIXTURE_ROOT = 'tests/_golden/fixtures/teachin-semantic-lock-admission-authority';
const EXECUTE_KEY = `${FIXTURE_ROOT}/execute-authority.json`;
const VERIFY_KEY = `${FIXTURE_ROOT}/entity-locks.frozen.json`;
const fixtureUrl = (name) => new URL(`./fixtures/teachin-semantic-lock-admission-authority/${name}`, import.meta.url);
const readBytes = (name) => readFileSync(fixtureUrl(name));
const readJson = (name) => JSON.parse(readBytes(name));
const clone = (value) => JSON.parse(JSON.stringify(value));

const flowBytes = readBytes('flow.json');
const testcaseBytes = readBytes('testcase.json');
const eventsBytes = readBytes('events.document.json');
const eventsDocument = JSON.parse(eventsBytes);
const executeArtifact = readJson('execute-authority.json');
const frozenArtifact = readJson('entity-locks.frozen.json');
const executeBindings = clone(executeArtifact.bindings);
const frozenBindings = clone(frozenArtifact.bindings);

const failures = [];
function test(name, fn) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (error) {
    const message = String(error?.message || error).replace(/\s+/g, ' ').slice(0, 500);
    failures.push(`${name}: ${message}`);
    console.error(`not ok ${name}: ${message}`);
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function assertDenied(result, message) {
  assert(result && result.ok === false && result.allowBrowserLaunch === false, message);
  assert(typeof result.reason === 'string' && result.reason.length > 0, `${message}（缺 reason）`);
  assert(typeof result.nextAction === 'string' && result.nextAction.length > 0, `${message}（缺 nextAction）`);
}
function selfSign(artifact, overrides = {}) {
  assert(typeof admission.calculateIdentityAdmissionSignature === 'function', '公开摘要函数缺失，无法固定旧旁路攻击向量');
  const value = { ...clone(artifact), ...overrides, signed: true };
  delete value.signature;
  value.signature = admission.calculateIdentityAdmissionSignature(value);
  return value;
}
function executeCheck(authorityFields = {}, requiredBindings = executeBindings) {
  return admission.checkCompileIdentityAdmission({
    mode: 'execute',
    caseId: 'tc-admission-authority',
    containsEntityMutation: true,
    flowBytes,
    testcaseBytes,
    requiredBindings,
    ...authorityFields,
  });
}
function verifyCheck(authorityFields = {}, requiredBindings = frozenBindings) {
  return admission.checkCompileIdentityAdmission({
    mode: 'verify',
    caseId: 'tc-admission-authority',
    containsEntityMutation: true,
    eventsBytes,
    requiredBindings,
    ...authorityFields,
  });
}

test('P0-A execute 调用者自哈希不能铸造 authority', () => {
  const attacker = selfSign(executeArtifact, {
    signerId: 'caller-controlled',
    signedAt: '2099-01-01T00:00:00.000Z',
  });
  assertDenied(executeCheck({ signedAuthority: attacker }), '普通 execute JSON 自签后仍被授权');
});

test('P0-A verify/replay 调用者自哈希不能铸造 frozen authority', () => {
  const attacker = selfSign(frozenArtifact, {
    signerId: 'caller-controlled',
    signedAt: '2099-01-01T00:00:00.000Z',
  });
  assertDenied(verifyCheck({ frozenLocks: attacker }), '普通 frozen JSON 自签后仍被授权');
});

let executeAuthority = null;
let frozenLockAuthority = null;
test('P0-A 固定 PRD/checksum 读取器铸造两个 opaque domain handle', () => {
  assert(typeof admission.readIdentityAdmissionAuthorityFromPrd === 'function', '缺 readIdentityAdmissionAuthorityFromPrd');
  const executeRead = admission.readIdentityAdmissionAuthorityFromPrd({
    prdId: PRD_ID,
    artifactKey: EXECUTE_KEY,
    domain: 'execute',
  });
  const verifyRead = admission.readIdentityAdmissionAuthorityFromPrd({
    prdId: PRD_ID,
    artifactKey: VERIFY_KEY,
    domain: 'verify',
  });
  assert(executeRead?.ok === true && executeRead.authority, 'execute checksum authority 未铸造');
  assert(verifyRead?.ok === true && verifyRead.authority, 'verify checksum authority 未铸造');
  for (const [domain, handle] of [['execute', executeRead.authority], ['verify', verifyRead.authority]]) {
    assert(Object.isFrozen(handle), `${domain} handle 须冻结`);
    assert(Object.keys(handle).length === 0, `${domain} handle 不得暴露可枚举权限数据`);
  }
  executeAuthority = executeRead.authority;
  frozenLockAuthority = verifyRead.authority;
});

test('P0-A plain JSON、复制 handle 与跨域 handle 全部拒绝', () => {
  assert(executeAuthority && frozenLockAuthority, '缺上一验收点铸造的 domain handles');
  assertDenied(executeCheck({ executeAuthority: clone(executeArtifact) }), 'plain execute JSON 被当成 opaque handle');
  assertDenied(verifyCheck({ frozenLockAuthority: clone(frozenArtifact) }), 'plain frozen JSON 被当成 opaque handle');
  assertDenied(executeCheck({ executeAuthority: { ...executeAuthority } }), '复制 execute handle 仍有权');
  assertDenied(verifyCheck({ frozenLockAuthority: { ...frozenLockAuthority } }), '复制 verify handle 仍有权');
  assertDenied(executeCheck({ executeAuthority: frozenLockAuthority }), 'verify handle 越权到 execute');
  assertDenied(verifyCheck({ frozenLockAuthority: executeAuthority }), 'execute handle 越权到 verify');
});

test('P0-A 固定 checksum domain handle 正向通过', () => {
  assert(executeAuthority && frozenLockAuthority, '缺固定 PRD/checksum handles');
  const executeResult = executeCheck({ executeAuthority });
  const verifyResult = verifyCheck({ frozenLockAuthority });
  assert(executeResult?.ok === true && executeResult.allowBrowserLaunch === true, 'execute opaque authority 未通过');
  assert(verifyResult?.ok === true && verifyResult.allowBrowserLaunch === true, 'verify opaque authority 未通过');
});

test('P0-B events binding 投影保留七字段', () => {
  const projected = admission.requiredEventEntityBindings(eventsDocument);
  assert(JSON.stringify(projected) === JSON.stringify(frozenBindings), 'requiredEventEntityBindings 丢失 candidateId/lockId/receiptHash');
});

for (const field of ['candidateId', 'lockId', 'receiptHash']) {
  test(`P0-B 改 frozen binding.${field} 必须拒绝`, () => {
    const changed = clone(frozenBindings);
    changed[0][field] = field === 'receiptHash'
      ? `sha256:${'e'.repeat(64)}`
      : `${changed[0][field]}-changed`;
    const attacker = selfSign(frozenArtifact, {
      signerId: 'caller-controlled',
      signedAt: '2099-01-01T00:00:00.000Z',
    });
    assertDenied(verifyCheck({ frozenLocks: attacker }, changed), `只比 role 导致 ${field} 篡改仍通过`);
    if (frozenLockAuthority) assertDenied(verifyCheck({ frozenLockAuthority }, changed), `opaque authority 未绑定 ${field}`);
  });
}

test('P0-B artifact binding 必须与 required binding 集合严格相等', () => {
  const extraArtifact = clone(frozenArtifact);
  extraArtifact.bindings.push({
    ...clone(extraArtifact.bindings[0]),
    stepId: 'atstep_extra',
    intentId: 'intent_extra',
  });
  const attacker = selfSign(extraArtifact, {
    signerId: 'caller-controlled',
    signedAt: '2099-01-01T00:00:00.000Z',
  });
  assertDenied(verifyCheck({ frozenLocks: attacker }), 'artifact 多余 binding 被 subset 覆盖放行');
});

test('HIGH 已 checksum artifact 仍执行闭合 schema 与重复 binding 拒绝', () => {
  assert(typeof admission.readIdentityAdmissionAuthorityFromPrd === 'function', '缺固定 PRD/checksum 读取器');
  const vectors = [
    ['execute-authority.unknown.json', 'execute'],
    ['entity-locks.duplicate.json', 'verify'],
    ['entity-locks.unknown-binding.json', 'verify'],
  ];
  for (const [name, domain] of vectors) {
    const result = admission.readIdentityAdmissionAuthorityFromPrd({
      prdId: PRD_ID,
      artifactKey: `${FIXTURE_ROOT}/${name}`,
      domain,
    });
    assertDenied(result, `已 checksum 的坏 schema ${name} 被授权`);
    assert(!result.authority, `坏 schema ${name} 返回了 authority`);
  }
});

test('HIGH 顶层 Proxy/accessor 在任何 trap/getter 前拒绝', () => {
  let proxyTrapCount = 0;
  const hostileProxy = new Proxy({}, {
    get() { proxyTrapCount += 1; throw new Error('TOP_PROXY_GET_RAN'); },
    ownKeys() { proxyTrapCount += 1; throw new Error('TOP_PROXY_OWN_KEYS_RAN'); },
    getOwnPropertyDescriptor() { proxyTrapCount += 1; throw new Error('TOP_PROXY_DESCRIPTOR_RAN'); },
  });
  const proxyResult = admission.checkCompileIdentityAdmission(hostileProxy);
  assertDenied(proxyResult, '顶层 Proxy 未 fail-closed');
  assert(proxyTrapCount === 0, `顶层 Proxy trap 被执行 ${proxyTrapCount} 次`);

  let getterCount = 0;
  const accessorOptions = {};
  Object.defineProperty(accessorOptions, 'mode', {
    enumerable: true,
    get() { getterCount += 1; throw new Error('TOP_GETTER_RAN'); },
  });
  const accessorResult = admission.checkCompileIdentityAdmission(accessorOptions);
  assertDenied(accessorResult, '顶层 accessor 未 fail-closed');
  assert(getterCount === 0, `顶层 getter 被执行 ${getterCount} 次`);
});

test('HIGH 嵌套 Proxy 在任何 trap 前拒绝', () => {
  let trapCount = 0;
  const hostileArtifact = new Proxy({}, {
    get() { trapCount += 1; throw new Error('NESTED_PROXY_GET_RAN'); },
    ownKeys() { trapCount += 1; throw new Error('NESTED_PROXY_OWN_KEYS_RAN'); },
    getOwnPropertyDescriptor() { trapCount += 1; throw new Error('NESTED_PROXY_DESCRIPTOR_RAN'); },
  });
  const result = executeCheck({ signedAuthority: hostileArtifact });
  assertDenied(result, '嵌套 Proxy 未 fail-closed');
  assert(trapCount === 0, `嵌套 Proxy trap 被执行 ${trapCount} 次`);
});

test('HIGH PRD reader options Proxy 在任何 trap 前拒绝', () => {
  assert(typeof admission.readIdentityAdmissionAuthorityFromPrd === 'function', '缺固定 PRD/checksum 读取器');
  let trapCount = 0;
  const hostileOptions = new Proxy({}, {
    get() { trapCount += 1; throw new Error('READER_PROXY_GET_RAN'); },
    ownKeys() { trapCount += 1; throw new Error('READER_PROXY_OWN_KEYS_RAN'); },
    getOwnPropertyDescriptor() { trapCount += 1; throw new Error('READER_PROXY_DESCRIPTOR_RAN'); },
  });
  const result = admission.readIdentityAdmissionAuthorityFromPrd(hostileOptions);
  assertDenied(result, 'reader options Proxy 未 fail-closed');
  assert(trapCount === 0, `reader options Proxy trap 被执行 ${trapCount} 次`);
});

test('P0-A PRD reader 不接受调用者注入路径、摘要、字节或读取器', () => {
  assert(typeof admission.readIdentityAdmissionAuthorityFromPrd === 'function', '缺固定 PRD/checksum 读取器');
  const base = { prdId: PRD_ID, artifactKey: EXECUTE_KEY, domain: 'execute' };
  const injections = {
    prdPath: '/tmp/caller-prd.json',
    expectedSha256: `sha256:${'f'.repeat(64)}`,
    artifactBytes: Buffer.from('{}'),
    readFile: () => Buffer.from('{}'),
  };
  for (const [field, value] of Object.entries(injections)) {
    const result = admission.readIdentityAdmissionAuthorityFromPrd({ ...base, [field]: value });
    assertDenied(result, `reader 接受调用者注入 ${field}`);
  }
});

test('HIGH admission options 闭合 schema，未知键不能借只读 policy 放行', () => {
  const result = admission.checkCompileIdentityAdmission({
    mode: 'execute',
    caseId: 'tc-admission-authority',
    containsEntityMutation: false,
    requiredBindings: [],
    unexpectedOption: true,
  });
  assertDenied(result, '未知 options 键被 read-only policy 放行');
});

test('P0-A compile/replay 只接分域 opaque authority，且准入仍早于副作用', () => {
  const compileSource = readFileSync(new URL('../../bin/compile.mjs', import.meta.url), 'utf8');
  const replaySource = readFileSync(new URL('../../bin/replay.mjs', import.meta.url), 'utf8');
  for (const [file, source] of [['compile.mjs', compileSource], ['replay.mjs', replaySource]]) {
    assert(source.includes('readIdentityAdmissionAuthorityFromPrd'), `${file} 未使用固定 PRD/checksum authority reader`);
    const calls = [...source.matchAll(/checkCompileIdentityAdmission\(\{([\s\S]*?)\n\s*\}\);/g)].map((match) => match[1]);
    assert(calls.length > 0, `${file} 缺 identity admission 调用`);
    for (const call of calls) {
      assert(!/\bsignedAuthority\b|\bfrozenLocks\b/.test(call), `${file} 仍把普通 JSON 变量传入准入门`);
    }
  }

  const executeStart = compileSource.indexOf('async function executeMode');
  const verifyStart = compileSource.indexOf('function verifyMode');
  assert(executeStart >= 0 && verifyStart > executeStart, 'compile execute/verify 函数边界缺失');
  const executeSource = compileSource.slice(executeStart, verifyStart);
  const verifySource = compileSource.slice(verifyStart);
  assert(executeSource.includes('executeAuthority'), 'compile execute 未传 executeAuthority');
  assert(verifySource.includes('frozenLockAuthority'), 'compile verify 未传 frozenLockAuthority');
  assert(replaySource.includes('frozenLockAuthority'), 'replay 未传 frozenLockAuthority');
  assert(executeSource.indexOf('checkCompileIdentityAdmission(') < executeSource.indexOf('chromium.launch'), 'execute admission 晚于浏览器启动');
  assert(verifySource.indexOf('checkCompileIdentityAdmission(') < verifySource.indexOf("join(PROJECT_ROOT, 'bin', 'replay.mjs')"), 'verify admission 晚于 replay spawn');
  assert(replaySource.indexOf('checkCompileIdentityAdmission(') < replaySource.indexOf('chromium.launch'), 'replay admission 晚于浏览器启动');
});

if (failures.length) {
  console.error(`FAIL teachin-semantic-lock-admission-authority: ${failures.length} 项未满足（预实现 RED）`);
  process.exitCode = 1;
} else {
  console.log('ok   teachin-semantic-lock-admission-authority: capability provenance + exact bindings + hostile-input closure（零 SUT）');
}
