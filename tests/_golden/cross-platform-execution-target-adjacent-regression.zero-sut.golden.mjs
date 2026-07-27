#!/usr/bin/env node
// 现役相邻行为保绿：显式合成 site 注入 + login page double；零真配置、零 SUT、零 browser、零 network。

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkSiteJson, checkTunnel } from '../../lib/doctor.mjs';
import { loadSiteConfig, loginBootstrap } from '../../lib/login-bootstrap.mjs';
import { resolveExecutionTarget } from '../../lib/execution-target/authority.mjs';

const TAG = 'cross-platform-execution-target-adjacent-regression';
const tmp = mkdtempSync(join(tmpdir(), 'casey-execution-target-regression-'));
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
    failures.push(`${name}: ${String(error?.message || error).slice(-600)}`);
    console.error(`RED  ${TAG}: ${name}: ${String(error?.message || error).slice(-600)}`);
  }
}

const START = 'https://synthetic-target.invalid:9443/ai/agents?tenant=QUERY_SENTINEL#tab=FRAGMENT_SENTINEL';

try {
  await check('G1 显式合成 site 配置完整保留 path+query+hash', () => {
    const sitePath = join(tmp, 'site.synthetic.json');
    writeFileSync(sitePath, JSON.stringify({ target: { startUrl: START } }), 'utf8');
    const site = loadSiteConfig(sitePath, { strict: true });
    assert(site.target?.startUrl === START, 'loadSiteConfig 不得截断逻辑目标 URL');
  });

  await check('G2 login bootstrap page double 收到完整 startUrl', async () => {
    const calls = [];
    const resolved = resolveExecutionTarget({
      runtime: { platform: 'linux', isWSL: false },
      logicalTarget: { startUrl: START },
      transport: { mode: 'direct' },
      requiresOriginContinuity: true,
    });
    assert(resolved?.ok === true, '合成 execution authority 应成功');
    const page = {
      async goto(url, options) {
        calls.push({ url, options });
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
      creds: { user: 'unused-synthetic-user', pass: 'unused-synthetic-pass' },
      startUrl: START,
      executionTargetAuthority: resolved.authority,
      timeoutMs: 1,
    });
    assert(result?.loggedIn === true && result.viaForm === false, '无表单 page double 应按现役语义直通');
    assert(calls.length === 1 && calls[0].url === START, 'login bootstrap 应把完整 URL 交给 page.goto');
  });

  await check('G3 strict 坏配置不回显文件内容中的目标值', () => {
    const sitePath = join(tmp, 'site.bad.json');
    writeFileSync(sitePath, `{"target":{"startUrl":"${START}"}`, 'utf8');
    let message = '';
    try {
      loadSiteConfig(sitePath, { strict: true });
    } catch (error) {
      message = String(error?.message || error);
    }
    assert(message.length > 0, 'strict 坏配置须拒绝');
    for (const fragment of ['synthetic-target', 'QUERY_SENTINEL', 'FRAGMENT_SENTINEL', '://']) {
      assert(!message.includes(fragment), `坏配置错误回显目标片段 ${fragment}`);
    }
  });

  await check('G4 doctor 纯层只消费形态/端口事实，不接收或输出目标值', () => {
    const site = checkSiteJson({ present: true, shapeOk: true });
    const tunnel = checkTunnel({ proxyPort: 15519, portListening: false, probeMs: 3 });
    const text = JSON.stringify({ site, tunnel });
    assert(!text.includes('synthetic-target') && !text.includes('://'), 'doctor 纯层不得出现目标地址');
    assert(site.status === 'ok' && tunnel.status === 'route-human', '现役分类语义漂移');
  });
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
