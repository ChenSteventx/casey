#!/usr/bin/env node
// execution target runtime 顺序/投影门：注入 adapter double，零 SUT、零 browser、零 network。

const TAG = 'cross-platform-execution-target-runtime';
const failures = [];
let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${TAG}: ${name}`);
  } catch (error) {
    failures.push(`${name}: ${String(error?.message || error).slice(-700)}`);
    console.error(`RED  ${TAG}: ${name}: ${String(error?.message || error).slice(-700)}`);
  }
}

async function loadApi() {
  try {
    const authority = await import('../../lib/execution-target/authority.mjs');
    const runtime = await import('../../lib/execution-target/runtime.mjs');
    const wiring = await import('../../lib/execution-target/wiring.mjs');
    assert(typeof authority.resolveExecutionTarget === 'function', '未导出 resolveExecutionTarget');
    assert(typeof runtime.openExecutionTarget === 'function', '未导出 openExecutionTarget');
    assert(typeof wiring.resolveCliExecutionTarget === 'function', '未导出 resolveCliExecutionTarget');
    return { ...authority, ...runtime, ...wiring };
  } catch (error) {
    console.error(`RED  ${TAG}: 导入验收 API 失败（实现前预期红）：${String(error?.message || error).slice(-300)}`);
    process.exit(1);
  }
}

const { resolveExecutionTarget, openExecutionTarget, resolveCliExecutionTarget } = await loadApi();
const START = 'https://runtime-logical.invalid:9443/p/a%20b?x=1&x=2&secret=QUERY_SENTINEL#route/FRAGMENT_SENTINEL';
const ENDPOINT = 'http://127.0.0.1:15519';
const OTHER = 'https://redirected-elsewhere.invalid:7443/login?leak=REDIRECT_QUERY#REDIRECT_FRAGMENT';
const SECRET_PARTS = [
  'runtime-logical',
  '9443',
  '/p/a%20b',
  'QUERY_SENTINEL',
  'FRAGMENT_SENTINEL',
  '127.0.0.1',
  '15519',
  'redirected-elsewhere',
  '7443',
  'REDIRECT_QUERY',
  'REDIRECT_FRAGMENT',
  '://',
];

function request({
  platform = 'linux',
  isWSL = false,
  mode = 'direct',
  endpoint,
  requiresOriginContinuity = true,
} = {}) {
  return {
    runtime: { platform, isWSL },
    logicalTarget: { startUrl: START },
    transport: { mode, ...(endpoint === undefined ? {} : { endpoint }) },
    requiresOriginContinuity,
  };
}

function adapterDouble({ launchError, gotoError, urlError, closeError, actualUrl } = {}) {
  const calls = { launch: [], goto: [], url: 0, close: 0 };
  return {
    calls,
    adapter: {
      async launch(options = {}) {
        calls.launch.push(options);
        if (launchError) throw new Error(launchError);
        return {
          async goto(url) {
            calls.goto.push(url);
            if (gotoError) throw new Error(gotoError);
          },
          url() {
            calls.url += 1;
            if (urlError) throw new Error(urlError);
            return actualUrl || calls.goto.at(-1);
          },
          async close() {
            calls.close += 1;
            if (closeError) throw new Error(closeError);
          },
        };
      },
    },
  };
}

function assertSafe(value, label) {
  const text = JSON.stringify(value);
  for (const part of SECRET_PARTS) {
    assert(!text.includes(part), `${label} 泄漏输入片段 ${part}`);
  }
}

async function run(overrides = {}, adapterOptions = {}) {
  const probe = adapterDouble(adapterOptions);
  const result = await openExecutionTarget({ request: request(overrides), adapter: probe.adapter });
  assertSafe(result, 'runtime 公开结果');
  return { result, calls: probe.calls };
}

await check('R1 direct 只 launch 一次且 browser goto 完整规范 URL', async () => {
  for (const platform of ['win32', 'linux', 'darwin']) {
    const { result, calls } = await run({ platform });
    assert(result?.ok === true, `${platform} direct 应成功：${JSON.stringify(result)}`);
    assert(calls.launch.length === 1, `${platform} launch 应恰一次`);
    assert(Object.keys(calls.launch[0]).length === 0, `${platform} direct 不得传 proxy：${JSON.stringify(calls.launch[0])}`);
    assert(calls.goto.length === 1 && calls.goto[0] === START,
      `${platform} pathname+query+hash 应原样保留`);
  }
});

await check('R2 origin-preserving proxy 只把 endpoint 交 launch，goto 仍是规范 URL', async () => {
  const { result, calls } = await run({
    isWSL: true,
    mode: 'origin-preserving-proxy',
    endpoint: ENDPOINT,
  });
  assert(result?.ok === true, `proxy 应成功：${JSON.stringify(result)}`);
  assert(calls.launch.length === 1, 'proxy launch 应恰一次');
  assert(calls.launch[0]?.proxyServer === ENDPOINT, 'proxy endpoint 只应作为 proxyServer');
  assert(calls.goto.length === 1 && calls.goto[0] === START, 'proxy goto 必须保持规范 URL');
});

await check('R3 legacy loopback 非 continuity 场景才可重基址，保留 path+query+hash', async () => {
  const { result, calls } = await run({
    isWSL: true,
    mode: 'legacy-loopback',
    endpoint: ENDPOINT,
    requiresOriginContinuity: false,
  });
  assert(result?.ok === true, `legacy 应成功：${JSON.stringify(result)}`);
  assert(calls.launch.length === 1, 'legacy launch 应恰一次');
  assert(Object.keys(calls.launch[0]).length === 0, 'legacy 不是 origin-preserving proxy 配置');
  assert(calls.goto[0] === `${ENDPOINT}/p/a%20b?x=1&x=2&secret=QUERY_SENTINEL#route/FRAGMENT_SENTINEL`,
    `legacy 重基址仍须保留 path+query+hash：${calls.goto[0]}`);
  assert(result.receipt?.originContinuity === 'degraded', 'legacy 公开 receipt 必须标 degraded');
});

await check('R4 Windows loopback 与 WSL continuity 缺口均在 browser launch 前拒绝', async () => {
  for (const [reason, overrides] of [
    ['TARGET_TRANSPORT_MODE_MISMATCH', {
      platform: 'win32',
      mode: 'legacy-loopback',
      endpoint: ENDPOINT,
      requiresOriginContinuity: false,
    }],
    ['ORIGIN_CONTINUITY_UNAVAILABLE', {
      isWSL: true,
      mode: 'legacy-loopback',
      endpoint: ENDPOINT,
      requiresOriginContinuity: true,
    }],
  ]) {
    const { result, calls } = await run(overrides);
    assert(result?.ok === false && result.reason === reason,
      `应拒因 ${reason}：${JSON.stringify(result)}`);
    assert(calls.launch.length === 0 && calls.goto.length === 0, `${reason} 必须 prelaunch`);
  }
});

await check('R5 forged/clone authority 不可绕过 runtime', async () => {
  const resolved = resolveExecutionTarget(request());
  assert(resolved?.ok === true, '前置 resolve 应成功');
  for (const authority of [
    structuredClone(resolved.authority),
    { ...resolved.authority },
    JSON.parse(JSON.stringify(resolved.authority)),
    Object.freeze({}),
  ]) {
    const probe = adapterDouble();
    const result = await openExecutionTarget({ authority, adapter: probe.adapter });
    assert(result?.ok === false && result.reason === 'EXECUTION_TARGET_AUTHORITY_INVALID',
      `伪造 authority 应拒：${JSON.stringify(result)}`);
    assert(probe.calls.launch.length === 0, '伪造 authority 不得 launch');
    assertSafe(result, '伪造拒绝');
  }
});

await check('R6 adapter 原始异常即使带目标值也只返回脱敏稳定原因', async () => {
  {
    const { result, calls } = await run({}, { launchError: `launch leaked ${START} ${ENDPOINT}` });
    assert(result?.ok === false && result.reason === 'BROWSER_LAUNCH_FAILED',
      `launch 异常应归一：${JSON.stringify(result)}`);
    assert(calls.launch.length === 1 && calls.goto.length === 0, 'launch 异常不得 goto');
  }
  {
    const { result, calls } = await run({}, { gotoError: `goto leaked ${START} ${ENDPOINT}` });
    assert(result?.ok === false && result.reason === 'NAVIGATION_FAILED',
      `goto 异常应归一：${JSON.stringify(result)}`);
    assert(calls.launch.length === 1 && calls.goto.length === 1, 'goto 异常调用账不符');
  }
});

await check('R7 goto 后实际 origin 漂移必须拒绝、无 receipt、close 恰一次且零 URL 片段', async () => {
  for (const mode of [
    { mode: 'direct' },
    { isWSL: true, mode: 'origin-preserving-proxy', endpoint: ENDPOINT },
  ]) {
    const { result, calls } = await run(mode, {
      actualUrl: OTHER,
      closeError: `close leaked ${START} ${ENDPOINT} ${OTHER}`,
    });
    assert(result?.ok === false && result.reason === 'NAVIGATION_ORIGIN_MISMATCH',
      `实际跨 origin 应稳定拒绝：${JSON.stringify(result)}`);
    assert(!Object.hasOwn(result, 'receipt'), '跨 origin 失败不得返回成功 receipt');
    assert(calls.launch.length === 1 && calls.goto.length === 1 && calls.url === 1,
      '必须在一次导航后读取一次 browser-visible URL');
    assert(calls.close === 1, '跨 origin 后 page.close 必须 best-effort 恰一次');
    assertSafe(result, '跨 origin 公开结果');
  }
  const sameOrigin = `${new URL(START).origin}/elsewhere?changed=1#changed`;
  const { result, calls } = await run({}, { actualUrl: sameOrigin });
  assert(result?.ok === true, `同 origin 的 path/query/hash 变化应允许：${JSON.stringify(result)}`);
  assert(calls.url === 1 && calls.close === 0, '同 origin 应核对一次且不得 close');
});

await check('R8 native shared loopback 且 canonical 缺失必须 prelaunch 拒绝', async () => {
  for (const platform of ['win32', 'linux', 'darwin']) {
    const probe = adapterDouble();
    const resolved = resolveCliExecutionTarget({
      site: { target: { devProxyUrl: ENDPOINT } },
      cliSut: ENDPOINT,
      runtime: { platform, isWSL: false },
      requiresOriginContinuity: true,
    });
    let result = resolved;
    if (resolved?.ok) {
      result = await openExecutionTarget({ authority: resolved.authority, adapter: probe.adapter });
    }
    assert(result?.ok === false && result.reason === 'LOGICAL_TARGET_REQUIRED',
      `${platform} 缺 canonical target 应拒绝：${JSON.stringify(result)}`);
    assert(probe.calls.launch.length === 0 && probe.calls.goto.length === 0,
      `${platform} 缺 canonical target 必须 launch=0`);
    assertSafe(result, '缺 canonical target 拒绝');
  }
});

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
