#!/usr/bin/env node
// 登录首跳 origin 门：纯 page double；零凭据读取、零 SUT、零 browser、零 network。

import { resolveExecutionTarget } from '../../lib/execution-target/authority.mjs';
import { loginBootstrap } from '../../lib/login-bootstrap.mjs';

const TAG = 'cross-platform-execution-target-login-origin';
const START = 'https://login-logical.invalid:9443/app?seed=QUERY_SENTINEL#FRAGMENT_SENTINEL';
const OTHER = 'https://redirect-login.invalid:7443/login?redirect=REDIRECT_QUERY#REDIRECT_FRAGMENT';
const calls = { goto: 0, url: 0, close: 0, userFill: 0, passFill: 0, submit: 0 };
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

const first = {
  async waitFor() {},
};
const userBox = {
  first() {
    return first;
  },
  async fill() {
    calls.userFill += 1;
  },
};
const passBox = {
  async fill() {
    calls.passFill += 1;
  },
};
const submit = {
  async click() {
    calls.submit += 1;
  },
};
const page = {
  async goto() {
    calls.goto += 1;
  },
  url() {
    calls.url += 1;
    return OTHER;
  },
  async close() {
    calls.close += 1;
  },
  getByRole(role) {
    if (role === 'textbox') {
      return calls.userFill === 0 ? userBox : passBox;
    }
    return submit;
  },
  async waitForLoadState() {},
};

await check('R9 登录首跳实际跨 origin 时填凭据与提交调用均为 0', async () => {
  const resolved = resolveExecutionTarget({
    runtime: { platform: 'linux', isWSL: false },
    logicalTarget: { startUrl: START },
    transport: { mode: 'direct' },
    requiresOriginContinuity: true,
  });
  assert(resolved?.ok === true, '合成 authority 应成功');

  let result;
  try {
    result = await loginBootstrap(page, {
      site: {
        login: {
          pathMarker: '/login',
          user: { role: 'textbox', name: '账号' },
          pass: { role: 'textbox', name: '密码' },
          submit: { role: 'button', name: '登录' },
        },
      },
      creds: { user: 'CREDENTIAL_USER_SENTINEL', pass: 'CREDENTIAL_PASS_SENTINEL' },
      startUrl: START,
      executionTargetAuthority: resolved.authority,
      timeoutMs: 1,
    });
  } catch (error) {
    result = { ok: false, reason: error?.code || error?.reason || error?.message };
  }

  assert(result?.ok === false && result.reason === 'NAVIGATION_ORIGIN_MISMATCH',
    `登录跨 origin 应返回稳定拒绝：${JSON.stringify(result)}`);
  assert(calls.goto === 1 && calls.url === 1, '登录首跳应导航一次并核对实际 URL 一次');
  assert(calls.close === 1, '登录跨 origin 后应 best-effort close 恰一次');
  assert(calls.userFill === 0 && calls.passFill === 0 && calls.submit === 0,
    `跨 origin 后绝不能触碰凭据或提交：${JSON.stringify(calls)}`);
  const publicText = JSON.stringify(result);
  for (const part of [
    'login-logical',
    'redirect-login',
    'QUERY_SENTINEL',
    'REDIRECT_QUERY',
    'FRAGMENT_SENTINEL',
    'REDIRECT_FRAGMENT',
    'CREDENTIAL_USER_SENTINEL',
    'CREDENTIAL_PASS_SENTINEL',
    '://',
  ]) {
    assert(!publicText.includes(part), `公开拒绝泄漏哨兵 ${part}`);
  }
});

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
