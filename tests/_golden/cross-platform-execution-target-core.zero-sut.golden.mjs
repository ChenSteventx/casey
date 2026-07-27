#!/usr/bin/env node
// logical target / transport 纯策略门：零 SUT、零 browser、零 network。

const TAG = 'cross-platform-execution-target-core';
const failures = [];
let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`ok   ${TAG}: ${name}`);
  } catch (error) {
    failures.push(`${name}: ${String(error?.message || error).slice(-600)}`);
    console.error(`RED  ${TAG}: ${name}: ${String(error?.message || error).slice(-600)}`);
  }
}

async function loadApi() {
  try {
    const mod = await import('../../lib/execution-target/authority.mjs');
    assert(typeof mod.resolveExecutionTarget === 'function', '未导出 resolveExecutionTarget');
    return mod;
  } catch (error) {
    console.error(`RED  ${TAG}: 导入验收 API 失败（实现前预期红）：${String(error?.message || error).slice(-300)}`);
    process.exit(1);
  }
}

const { resolveExecutionTarget } = await loadApi();
const START = 'https://logical-sentinel.invalid:9443/ai/agents?tenant=SENSITIVE_QUERY#tab=SENSITIVE_FRAGMENT';
const ENDPOINT = 'http://127.0.0.1:15519';
const SECRET_PARTS = [
  'logical-sentinel',
  '9443',
  '/ai/agents',
  'SENSITIVE_QUERY',
  'SENSITIVE_FRAGMENT',
  '127.0.0.1',
  '15519',
  '://',
];

function request({
  platform = 'linux',
  isWSL = false,
  mode = 'direct',
  endpoint,
  requiresOriginContinuity = true,
  startUrl = START,
} = {}) {
  return {
    runtime: { platform, isWSL },
    logicalTarget: { startUrl },
    transport: { mode, ...(endpoint === undefined ? {} : { endpoint }) },
    requiresOriginContinuity,
  };
}

function assertPublicSafe(value, label) {
  const text = JSON.stringify(value);
  for (const part of SECRET_PARTS) {
    assert(!text.includes(part), `${label} 泄漏输入片段 ${part}`);
  }
}

function mustResolve(overrides = {}) {
  const result = resolveExecutionTarget(request(overrides));
  assert(result?.ok === true, `应解析成功：${JSON.stringify(result)}`);
  assert(result.authority && result.receipt, '成功须返回 authority + receipt');
  assert(Object.isFrozen(result.authority), 'authority 须冻结');
  assert(Object.isFrozen(result.receipt), 'receipt 须冻结');
  assertPublicSafe(result, '成功公开结果');
  return result;
}

function mustReject(reason, overrides = {}) {
  const result = resolveExecutionTarget(request(overrides));
  assert(result?.ok === false, `应拒绝：${JSON.stringify(result)}`);
  assert(result.reason === reason, `拒因应为 ${reason}，实际 ${JSON.stringify(result.reason)}`);
  assert(result.authority == null, '拒绝时不得产 authority');
  assertPublicSafe(result, '失败公开结果');
}

check('C1 Windows/Linux/macOS direct 均保留规范 origin continuity', () => {
  for (const [platform, runtimeClass] of [
    ['win32', 'windows'],
    ['linux', 'linux'],
    ['darwin', 'macos'],
  ]) {
    const { receipt } = mustResolve({ platform });
    assert(receipt.schemaVersion === 1, `${platform} receipt schemaVersion 不符`);
    assert(receipt.runtimeClass === runtimeClass, `${platform} runtimeClass 不符`);
    assert(receipt.transportMode === 'direct', `${platform} 应 direct`);
    assert(receipt.originContinuity === 'preserved', `${platform} origin continuity 应保留`);
  }
});

check('C2 WSL direct 合法；isWSL 只在 linux 上成立', () => {
  const { receipt } = mustResolve({ platform: 'linux', isWSL: true });
  assert(receipt.runtimeClass === 'wsl', 'WSL runtimeClass 不符');
  assert(receipt.originContinuity === 'preserved', 'WSL direct 应保留 origin');
  mustReject('RUNTIME_UNSUPPORTED', { platform: 'win32', isWSL: true });
  mustReject('RUNTIME_UNSUPPORTED', { platform: 'freebsd' });
});

check('C3 Windows + legacy loopback 启动前策略拒绝', () => {
  mustReject('TARGET_TRANSPORT_MODE_MISMATCH', {
    platform: 'win32',
    mode: 'legacy-loopback',
    endpoint: ENDPOINT,
    requiresOriginContinuity: false,
  });
});

check('C4 WSL legacy loopback 在 origin continuity required 时 fail-closed', () => {
  mustReject('ORIGIN_CONTINUITY_UNAVAILABLE', {
    isWSL: true,
    mode: 'legacy-loopback',
    endpoint: ENDPOINT,
    requiresOriginContinuity: true,
  });
});

check('C5 WSL legacy loopback 仅在明确不要求 continuity 时标 degraded', () => {
  const { receipt } = mustResolve({
    isWSL: true,
    mode: 'legacy-loopback',
    endpoint: ENDPOINT,
    requiresOriginContinuity: false,
  });
  assert(receipt.transportMode === 'legacy-loopback', 'transportMode 不符');
  assert(receipt.originContinuity === 'degraded', 'legacy loopback 必须显式 degraded');
});

check('C6 origin-preserving proxy 预留方式保持 preserved 且 endpoint 必填', () => {
  const { receipt } = mustResolve({
    isWSL: true,
    mode: 'origin-preserving-proxy',
    endpoint: ENDPOINT,
  });
  assert(receipt.originContinuity === 'preserved', 'origin-preserving proxy 应标 preserved');
  mustReject('TRANSPORT_ENDPOINT_REQUIRED', {
    isWSL: true,
    mode: 'origin-preserving-proxy',
  });
  mustReject('TRANSPORT_ENDPOINT_REQUIRED', {
    isWSL: true,
    mode: 'legacy-loopback',
    requiresOriginContinuity: false,
  });
});

check('C7 URL/transport 输入闭集，错误不回显原值', () => {
  mustReject('LOGICAL_TARGET_INVALID', { startUrl: 'not-a-url-SENSITIVE_QUERY' });
  mustReject('TRANSPORT_MODE_INVALID', { mode: 'magic-tunnel-SENSITIVE_QUERY' });
  mustReject('LOGICAL_TARGET_INVALID', { startUrl: 'file:///SENSITIVE_QUERY' });
});

check('C8 receipt 固定声明 fragment 策略且无额外敏感字段', () => {
  const { receipt } = mustResolve();
  assert(receipt.fragmentPolicy === 'preserve-for-browser-exclude-from-network-identity',
    `fragmentPolicy 不符：${receipt.fragmentPolicy}`);
  const keys = Object.keys(receipt).sort();
  assert(JSON.stringify(keys) === JSON.stringify([
    'fragmentPolicy',
    'originContinuity',
    'runtimeClass',
    'schemaVersion',
    'transportMode',
  ]), `receipt 键集不闭合：${JSON.stringify(keys)}`);
});

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
