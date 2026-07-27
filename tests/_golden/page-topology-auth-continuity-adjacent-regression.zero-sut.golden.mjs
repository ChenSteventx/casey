#!/usr/bin/env node
// 现役邻接行为保绿：login page double、capture 脱敏与既有 same-origin guard；零真实配置/SUT/browser/network。

import { readFileSync } from 'node:fs';
import { buildTeachInCapture, projectUrlSafe } from '../../lib/record-capture.mjs';
import { loginBootstrap } from '../../lib/login-bootstrap.mjs';

const TAG = 'page-topology-auth-continuity-adjacent-regression';
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

const START = 'https://adjacent-synthetic.invalid/app?view=all#tab';

await check('G1 login bootstrap page double 收到完整 start URL 且无表单直通', async () => {
  const calls = [];
  const page = {
    async goto(url) {
      calls.push(url);
    },
    url() {
      return START;
    },
    getByRole() {
      return {
        first() {
          return {
            async waitFor() {
              throw new Error('synthetic form absent');
            },
          };
        },
      };
    },
  };
  const result = await loginBootstrap(page, {
    site: { login: { pathMarker: '/login', user: { role: 'textbox', name: '账号' } } },
    creds: { user: 'unused', pass: 'unused' },
    startUrl: START,
    timeoutMs: 1,
  });
  assert(result?.loggedIn === true && result.viaForm === false, '无表单应按现役语义直通');
  assert(calls.length === 1 && calls[0] === START, 'login bootstrap 须保留完整 URL');
});

await check('G2 record capture 遮蔽密码字段值，host/fragment 不落包', () => {
  const secret = 'PASSWORD_VALUE_SENTINEL';
  const capture = buildTeachInCapture({
    caseId: 'tc_adjacent_topology',
    startUrl: START,
    createdAt: '2026-07-27T00:00:00.000Z',
    events: [{
      action: 'fill',
      path: START,
      fieldLabel: '登录密码',
      selector: 'input[type=password]',
      value: secret,
    }],
  });
  const text = JSON.stringify(capture);
  assert(!text.includes(secret) && !text.includes('adjacent-synthetic.invalid') && !text.includes('://'),
    'capture 泄漏 secret/host');
  assert(capture.events[0].value === '<redacted>' && capture.events[0].valueMasked === true,
    '密码字段须遮值');
  assert(capture.startPath === '/app?view=all' && capture.events[0].path === '/app?view=all',
    'capture 应保留安全 path+query、剥 fragment');
});

await check('G3 projectUrlSafe 对非 http/host 走私 fail-closed', () => {
  assert(projectUrlSafe('file:///private') === '<redacted:non-http-url>', 'file URL 应脱敏');
  assert(projectUrlSafe('//internal.invalid/private') === '<redacted:non-http-url>', '协议相对 host 应脱敏');
  assert(projectUrlSafe('/x?redirect=https://internal.invalid') === '<redacted:non-http-url>',
    'query 内嵌 scheme 应脱敏');
});

await check('G4 现役 session carry 已钉 entries 数组和 same-origin guard', () => {
  const replaySource = readFileSync(new URL('../../bin/replay.mjs', import.meta.url), 'utf8');
  const sessionSource = readFileSync(
    new URL('../../lib/page-topology/replay-session.mjs', import.meta.url),
    'utf8',
  );
  assert(sessionSource.includes('for (const [key, value] of entries) sessionStorage.setItem(key, value)'),
    '现役 session carry 应逐 entries 注入');
  assert(sessionSource.includes('if (location.origin !== origin) return;'),
    '现役 session carry 应有 same-origin guard');
  assert(replaySource.includes('installReplaySessionSeedBeforeNavigation(page, carrySnapshot)')
    && replaySource.includes('openReplayTopology({'),
  'bin/replay 应真实调用 session carry helper 与 topology 接线');
  assert(!replaySource.includes('console.log(carrySnapshot)')
    && !replaySource.includes('JSON.stringify(carrySnapshot)')
    && !sessionSource.includes('console.log('),
  '现役 carrySnapshot 不得显式日志/序列化');
});

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
