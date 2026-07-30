#!/usr/bin/env node
// Real execution-target authorities + in-memory runtime doubles; zero browser/SUT/network/IO.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveExecutionTarget } from '../../lib/execution-target/authority.mjs';
import { projectExecutionTargetRuntime as projectCanonicalRuntime } from '../../lib/execution-target/runtime.mjs';
import { playwrightLaunchOptions as projectCanonicalLaunchOptions } from '../../lib/execution-target/wiring.mjs';
import { createReplayOriginAdmission as createCanonicalOriginAdmission } from '../../lib/replay/origin-admission.mjs';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const TAG = 'teachin-replayability-runtime-bootstrap';
const WIN_START = 'https://bootstrap-windows.invalid/workflow?view=mine';
const WSL_START = 'https://bootstrap-wsl-logical.invalid/agents?view=all';
const LOOPBACK = 'http://127.0.0.1:15519';
const PRIVATE_PARTS = [
  'bootstrap-windows.invalid', 'bootstrap-wsl-logical.invalid', '127.0.0.1',
  '15519', 'CREDENTIAL_USER_SENTINEL', 'CREDENTIAL_PASS_SENTINEL',
  'SESSION_KEY_SENTINEL', 'SESSION_VALUE_SENTINEL', '://',
];
const failures = [];
let passed = 0;

function assert(condition, message) { if (!condition) throw new Error(message); }

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${TAG}: ${name}`);
  } catch (error) {
    const detail = String(error?.message || error).slice(-900);
    failures.push(`${name}: ${detail}`);
    console.error(`RED  ${TAG}: ${name}: ${detail}`);
  }
}

let api;
try {
  api = await import('../../lib/teachin/runtime-bootstrap.mjs');
} catch (error) {
  failures.push(`production API unavailable: ${String(error?.code || error?.message || error).slice(-500)}`);
}
const ready = typeof api?.createRuntimeBootstrap === 'function'
  && typeof api?.canonicalRuntimeBootstrap?.openRuntime === 'function';
if (api && !ready) failures.push('production API missing factory/canonical openRuntime');

const token = () => Object.freeze(Object.create(null));
const SITE = Object.freeze({
  target: Object.freeze({ startUrl: 'https://site-decoy.invalid/ignored', devProxyUrl: LOOPBACK }),
});
const CREDS = Object.freeze({ user: 'CREDENTIAL_USER_SENTINEL', pass: 'CREDENTIAL_PASS_SENTINEL' });

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
}

function jsonSame(left, right) { return JSON.stringify(left) === JSON.stringify(right); }

function assertPublicSafe(value, label) {
  const text = JSON.stringify(value);
  for (const part of PRIVATE_PARTS) {
    assert(!text.includes(part), `${label} 泄漏 ${part}`);
  }
}

function liveHandle(methods = {}) {
  const handle = Object.create(null);
  for (const [name, fn] of Object.entries(methods)) {
    Object.defineProperty(handle, name, {
      value: fn, enumerable: false, writable: false, configurable: false,
    });
  }
  return Object.freeze(handle);
}

function mintTarget({
  platform, isWSL, startUrl, mode, endpoint, requiresOriginContinuity,
}) {
  const resolved = resolveExecutionTarget({
    runtime: { platform, isWSL },
    logicalTarget: { startUrl },
    transport: {
      mode,
      ...(endpoint === undefined ? {} : { endpoint }),
    },
    requiresOriginContinuity,
  });
  assert(resolved?.ok === true && resolved.authority,
    `合成 execution-target authority 失败：${JSON.stringify(resolved)}`);
  const runtime = projectCanonicalRuntime(resolved.authority);
  assert(runtime, '真实 authority 应可投影 runtime');
  return { authority: resolved.authority, runtime };
}

const WINDOWS = mintTarget({
  platform: 'win32', isWSL: false, startUrl: WIN_START,
  mode: 'direct', requiresOriginContinuity: true,
});
const WSL = mintTarget({
  platform: 'linux', isWSL: true, startUrl: WSL_START,
  mode: 'legacy-loopback', endpoint: LOOPBACK, requiresOriginContinuity: false,
});

function validInput(role, authority, overrides = {}) {
  return { role, executionTargetAuthority: authority, ...overrides };
}

function makeHarness({
  target, role, failAt = null,
  contextCloseThrows = false, browserCloseThrows = false,
} = {}) {
  const order = [];
  const calls = {
    project: 0,
    launchOptions: 0,
    launch: 0,
    newContext: 0,
    newPage: 0,
    site: 0,
    creds: 0,
    login: 0,
    capture: 0,
    install: 0,
    forensics: 0,
    topology: 0,
    origin: 0,
    contextClose: 0,
    browserClose: 0,
    installedPages: [],
    forensicPages: [],
    originPages: [],
  };
  const visibleStart = target.runtime.browserVisibleStartUrl;
  const visibleOrigin = new URL(visibleStart).origin;
  const seedSnapshot = Object.freeze({
    origin: visibleOrigin,
    entries: Object.freeze([Object.freeze([
      'SESSION_KEY_SENTINEL',
      'SESSION_VALUE_SENTINEL',
    ])]),
  });
  const page = liveHandle({
    url: () => visibleStart,
    addInitScript: async () => {},
    on: () => {},
    close: async () => {},
  });
  const popup = liveHandle({
    url: () => `${visibleOrigin}/popup`,
    addInitScript: async () => {},
    on: () => {},
    close: async () => {},
  });
  let projectedRuntime;

  const context = liveHandle({
    newPage: async () => {
      order.push('new-page');
      calls.newPage += 1;
      if (failAt === 'new-page') throw new Error(`PRIVATE_NEW_PAGE ${visibleStart}`);
      return page;
    },
    close: async () => {
      order.push('close-context');
      calls.contextClose += 1;
      if (contextCloseThrows) throw new Error(`PRIVATE_CONTEXT_CLOSE ${visibleStart}`);
    },
  });
  const browser = liveHandle({
    newContext: async () => {
      order.push('new-context');
      calls.newContext += 1;
      if (failAt === 'new-context') throw new Error(`PRIVATE_CONTEXT ${visibleStart}`);
      return context;
    },
    close: async () => {
      order.push('close-browser');
      calls.browserClose += 1;
      if (browserCloseThrows) throw new Error(`PRIVATE_BROWSER_CLOSE ${visibleStart}`);
    },
  });

  const installSeed = async (targetPage, snapshot) => {
    if (targetPage === page) order.push('install-seed');
    calls.install += 1;
    calls.installedPages.push(targetPage);
    assert(jsonSame(snapshot, seedSnapshot), 'session seed snapshot 换绑');
    if (failAt === 'install') {
      return { ok: false, reason: 'PRIVATE_SESSION_INSTALL' };
    }
    return { ok: true };
  };
  const attachPageForensics = async ({ page: targetPage }) => {
    calls.forensicPages.push(targetPage);
  };
  const forensics = token();
  let topology;

  const bootstrap = api.createRuntimeBootstrap({
    projectExecutionTargetRuntime(authority) {
      order.push('project-runtime');
      calls.project += 1;
      if (failAt === 'project-runtime') return null;
      projectedRuntime = projectCanonicalRuntime(authority);
      return projectedRuntime;
    },

    playwrightLaunchOptions(runtime, baseOptions) {
      order.push('launch-options');
      calls.launchOptions += 1;
      assert(runtime === projectedRuntime,
        'playwrightLaunchOptions 必须收到同次 execution-target runtime');
      if (failAt === 'launch-options') throw new Error(`PRIVATE_OPTIONS ${visibleStart}`);
      return projectCanonicalLaunchOptions(runtime, baseOptions);
    },

    async launchBrowser(options) {
      order.push('launch');
      calls.launch += 1;
      if (failAt === 'launch') throw new Error(`PRIVATE_LAUNCH ${visibleStart}`);
      assert(!Object.values(options || {}).includes(SITE.target.devProxyUrl)
        || target === WSL,
      'Windows direct launch options 不得混入 site loopback');
      return browser;
    },

    loadSiteConfig() {
      order.push('load-site');
      calls.site += 1;
      if (failAt === 'site') throw new Error(`PRIVATE_SITE ${visibleStart}`);
      return SITE;
    },

    loadCreds() {
      order.push('load-creds');
      calls.creds += 1;
      if (failAt === 'creds') throw new Error(`PRIVATE_CREDS ${visibleStart}`);
      return CREDS;
    },

    async loginBootstrap(targetPage, options) {
      order.push('login');
      calls.login += 1;
      assert(targetPage === page
        && options?.executionTargetAuthority === target.authority
        && options?.startUrl === projectedRuntime.browserVisibleStartUrl,
      'login 必须复用 exact page/authority/projected start');
      assert(options.site === SITE && options.creds === CREDS,
        'login site/creds 换绑');
      if (failAt === 'login') return { ok: false, reason: 'PRIVATE_LOGIN' };
      return { loggedIn: true, viaForm: false };
    },

    async captureReplaySessionSeed(targetPage) {
      order.push('capture-seed');
      calls.capture += 1;
      assert(targetPage === page, 'seed 必须从登录完成的 exact page 捕获');
      if (failAt === 'capture') {
        return { ok: false, reason: 'PRIVATE_SESSION_CAPTURE' };
      }
      return { ok: true, snapshot: seedSnapshot };
    },

    installReplaySessionSeedBeforeNavigation: installSeed,

    createPageForensicsHub({ context: targetContext }) {
      order.push('forensics');
      calls.forensics += 1;
      assert(targetContext === context, 'forensics context 换绑');
      if (failAt === 'forensics') throw new Error(`PRIVATE_FORENSICS ${visibleStart}`);
      return { forensics, attachPageForensics };
    },

    async openReplayTopology({
      context: targetContext,
      initialPage,
      seedSnapshot: topologySeed,
      attachForensics,
    }) {
      order.push('topology');
      calls.topology += 1;
      assert(targetContext === context && initialPage === page
        && jsonSame(topologySeed, seedSnapshot)
        && attachForensics === attachPageForensics,
      'topology 必须复用 exact context/page/seed/forensics');
      if (failAt === 'topology') {
        return { ok: false, reason: 'PRIVATE_TOPOLOGY' };
      }
      await attachForensics({ page });
      topology = liveHandle({
        observeNewPage: async (nextPage) => {
          const installed = await installSeed(nextPage, seedSnapshot);
          if (installed?.ok !== true) return installed;
          await attachForensics({ page: nextPage });
          return { ok: true, page: nextPage };
        },
      });
      return { ok: true, controller: topology, activePage: page };
    },

    createReplayOriginAdmission(authority) {
      order.push('origin-admission');
      calls.origin += 1;
      assert(authority === target.authority, 'origin admission authority 换绑');
      if (failAt === 'origin-admission') {
        throw new Error(`PRIVATE_ORIGIN ${visibleStart}`);
      }
      const admission = createCanonicalOriginAdmission(authority);
      return async (targetPage) => {
        calls.originPages.push(targetPage);
        return admission(targetPage);
      };
    },
  });
  assert(typeof bootstrap?.openRuntime === 'function',
    'createRuntimeBootstrap 必须返回 openRuntime');
  return {
    bootstrap,
    order,
    calls,
    browser,
    context,
    page,
    popup,
    getProjectedRuntime: () => projectedRuntime,
  };
}

function expectFailure(result, label) {
  assert(exactKeys(result, ['ok', 'reason'])
    && result.ok === false
    && result.reason === 'AUTHORING_RUNTIME_OPEN_FAILED',
  `${label} 应闭合拒绝 AUTHORING_RUNTIME_OPEN_FAILED：${JSON.stringify(result)}`);
  assert(!result.runtime && !result.owner && !result.runtimeOwnerAuthority,
    `${label} 失败不得返回 runtime/owner`);
  assertPublicSafe(result, `${label} failure`);
}

if (ready) {
  await check('B1 source Windows direct 忽略 site loopback，按固定顺序产内部 live runtime', async () => {
    const built = makeHarness({ target: WINDOWS, role: 'source' });
    const result = await built.bootstrap.openRuntime(
      validInput('source', WINDOWS.authority),
    );
    assert(built.order.join('>') === [
      'project-runtime',
      'launch-options',
      'launch',
      'new-context',
      'new-page',
      'load-site',
      'load-creds',
      'login',
      'capture-seed',
      'install-seed',
      'forensics',
      'topology',
      'origin-admission',
    ].join('>'), `bootstrap 顺序不符：${built.order.join('>')}`);
    const projected = built.getProjectedRuntime();
    assert(projected.browserVisibleStartUrl === WIN_START
      && projected.logicalOrigin === new URL(WIN_START).origin
      && !projected.browserVisibleStartUrl.includes('127.0.0.1'),
    'Windows direct 必须保留 synthetic logical origin');
    assert(exactKeys(result, ['ok', 'runtime']) && result.ok === true
      && exactKeys(result.runtime, [
        'browser', 'context', 'page', 'topology', 'forensics', 'originAdmission',
      ])
      && Object.isFrozen(result.runtime),
    `success runtime 形状不闭合：${JSON.stringify(result)}`);
    assert(result.runtime.browser === built.browser
      && result.runtime.context === built.context
      && result.runtime.page === built.page,
    'bootstrap live owner handles 换绑');
    assert(built.calls.contextClose === 0 && built.calls.browserClose === 0,
      'success 不得提前关闭 runtime');
    assertPublicSafe(result, 'Windows runtime');

    const observed = await result.runtime.topology.observeNewPage(built.popup);
    assert(observed?.ok === true
      && built.calls.installedPages.length === 2
      && built.calls.installedPages[0] === built.page
      && built.calls.installedPages[1] === built.popup
      && built.calls.forensicPages.length === 2
      && built.calls.forensicPages[0] === built.page
      && built.calls.forensicPages[1] === built.popup,
    '新页必须复用同次 seed/topology/per-page forensics');
    assert(await result.runtime.originAdmission(built.popup) === true
      && built.calls.originPages[0] === built.popup,
    '新页必须复用同一 execution-target origin admission');
    assert(built.calls.launch === 1 && built.calls.login === 1,
      '新页不得另 launch/login');
  });

  await check('B2 只有真实 WSL legacy-loopback authority 可把 loopback 投给 browser/login', async () => {
    const deniedWindows = resolveExecutionTarget({
      runtime: { platform: 'win32', isWSL: false },
      logicalTarget: { startUrl: WIN_START },
      transport: { mode: 'legacy-loopback', endpoint: LOOPBACK },
      requiresOriginContinuity: false,
    });
    assert(deniedWindows?.ok === false
      && deniedWindows.reason === 'TARGET_TRANSPORT_MODE_MISMATCH',
    `Windows legacy-loopback 必须在铸权前拒绝：${JSON.stringify(deniedWindows)}`);

    const built = makeHarness({ target: WSL, role: 'distilled' });
    const result = await built.bootstrap.openRuntime(
      validInput('distilled', WSL.authority),
    );
    assert(result?.ok === true, `WSL bootstrap 应成功：${JSON.stringify(result)}`);
    const projected = built.getProjectedRuntime();
    assert(projected.logicalOrigin === new URL(WSL_START).origin
      && projected.browserVisibleStartUrl
        === `${LOOPBACK}/agents?view=all`,
    'WSL legacy-loopback 应仅重基 browser-visible target');
    assert(built.calls.project === 1 && built.calls.launchOptions === 1
      && built.calls.login === 1,
    'WSL 必须走同一 canonical projection/launch/login 链');
    assert(await result.runtime.originAdmission(built.popup) === true,
      'WSL popup 应按已批准 loopback visible origin 准入');
    assertPublicSafe(result, 'WSL runtime');
  });

  await check('B3 openRuntime exact 两字段；URL/base/transport/非法 role 在 project 前拒', async () => {
    const invalidInputs = [
      validInput('observer', WINDOWS.authority),
      validInput('authoring', WINDOWS.authority, { startUrl: WIN_START }),
      validInput('authoring', WINDOWS.authority, { baseUrl: WIN_START }),
      validInput('authoring', WINDOWS.authority, {
        transport: { mode: 'legacy-loopback', endpoint: LOOPBACK },
      }),
      validInput('authoring', WINDOWS.authority, { sessionPolicy: token() }),
    ];
    for (const input of invalidInputs) {
      const built = makeHarness({ target: WINDOWS, role: 'authoring' });
      expectFailure(await built.bootstrap.openRuntime(input), '非法 bootstrap input');
      assert(built.order.length === 0,
        `非法 input 不得 project/launch：${built.order.join('>')}`);
    }

    const clone = makeHarness({ target: WINDOWS, role: 'authoring' });
    expectFailure(await clone.bootstrap.openRuntime(
      validInput('authoring', { ...WINDOWS.authority }),
    ), 'clone execution target');
    assert(clone.order.join('>') === 'project-runtime'
      && clone.calls.launch === 0,
    'clone authority 必须在 launch 前由真实 projection 拒绝');
  });

  await check('B4 任一 bootstrap 子步失败均逆序关闭 partial Context/Browser 且不返 owner', async () => {
    const cases = [
      ['project-runtime', 0, 0],
      ['launch-options', 0, 0],
      ['launch', 0, 0],
      ['new-context', 0, 1],
      ['new-page', 1, 1],
      ['site', 1, 1],
      ['creds', 1, 1],
      ['login', 1, 1],
      ['capture', 1, 1],
      ['install', 1, 1],
      ['forensics', 1, 1],
      ['topology', 1, 1],
      ['origin-admission', 1, 1],
    ];
    for (const [failAt, expectedContextClose, expectedBrowserClose] of cases) {
      const built = makeHarness({
        target: WINDOWS,
        role: 'authoring',
        failAt,
        contextCloseThrows: failAt === 'login',
        browserCloseThrows: failAt === 'login',
      });
      const result = await built.bootstrap.openRuntime(
        validInput('authoring', WINDOWS.authority),
      );
      expectFailure(result, failAt);
      assert(built.calls.contextClose === expectedContextClose
        && built.calls.browserClose === expectedBrowserClose,
      `${failAt} cleanup 次数错误：${JSON.stringify(built.calls)}`);
      if (expectedContextClose && expectedBrowserClose) {
        assert(built.order.indexOf('close-context')
          < built.order.indexOf('close-browser'),
        `${failAt} 必须 Context→Browser cleanup：${built.order.join('>')}`);
      }
    }
  });

  await check('B5 canonical source 静态咬合现役 seams，runtime-cycle 真调用 openRuntime', () => {
    const ownPath = resolve(ROOT, 'lib/teachin/runtime-bootstrap.mjs');
    const composerPath = resolve(ROOT, 'lib/teachin/runtime-cycle-adapter.mjs');
    assert(existsSync(ownPath) && existsSync(composerPath),
      '缺 runtime-bootstrap/runtime-cycle production module');
    const own = readFileSync(ownPath, 'utf8');
    const composer = readFileSync(composerPath, 'utf8');
    const requiredImports = [
      ['../execution-target/runtime.mjs', ['projectExecutionTargetRuntime']],
      ['../execution-target/wiring.mjs', ['playwrightLaunchOptions']],
      ['../login-bootstrap.mjs', ['loadSiteConfig', 'loadCreds', 'loginBootstrap']],
      ['../replay-forensics.mjs', ['createPageForensicsHub']],
      ['../page-topology/replay-session.mjs', [
        'captureReplaySessionSeed',
        'installReplaySessionSeedBeforeNavigation',
        'openReplayTopology',
      ]],
      ['../replay/origin-admission.mjs', ['createReplayOriginAdmission']],
    ];
    for (const [path, names] of requiredImports) {
      const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const imported = own.match(
        new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${escaped}['"]`, 's'),
      )?.[1] || '';
      for (const name of names) {
        assert(imported.includes(name), `runtime-bootstrap 缺静态 import ${name}`);
      }
    }
    const withoutImports = own.replace(
      /import[\s\S]*?from\s*['"][^'"]+['"];?/g,
      '',
    );
    for (const name of [
      'projectExecutionTargetRuntime',
      'playwrightLaunchOptions',
      'loadSiteConfig',
      'loadCreds',
      'loginBootstrap',
      'captureReplaySessionSeed',
      'installReplaySessionSeedBeforeNavigation',
      'createPageForensicsHub',
      'openReplayTopology',
      'createReplayOriginAdmission',
    ]) {
      assert(new RegExp(`\\b${name}\\s*\\(`).test(withoutImports),
        `runtime-bootstrap 未实际调用 ${name}`);
    }
    assert(/from\s+['"]@playwright\/test['"]/.test(own)
      && /\bchromium\.launch\s*\(/.test(own),
    'canonical bootstrap 必须静态接现役 Playwright launch');
    assert(/\bcanonicalRuntimeBootstrap\s*=\s*createRuntimeBootstrap\s*\(/s.test(own),
    'canonicalRuntimeBootstrap 必须由同一 factory 实际构造');
    const composerImport = composer.match(
      /import\s*\{([^}]*)\}\s*from\s*['"]\.\/runtime-bootstrap\.mjs['"]/s,
    )?.[1] || '';
    assert(composerImport.includes('canonicalRuntimeBootstrap')
      && /\bcanonicalRuntimeBootstrap\.openRuntime\s*\(/.test(composer),
    'runtime-cycle 必须静态导入 canonical bootstrap 并实际 openRuntime');
    for (const forbidden of [
      '127.0.0.1',
      'localhost',
      'devProxyUrl',
      'transportEndpoint',
      'node:fs',
      'node:http',
      'node:https',
    ]) {
      assert(!own.includes(forbidden),
        `runtime-bootstrap 禁止自造 target/config/network 命中 ${forbidden}`);
    }
    for (const relativePath of [
      'lib/teachin/dual-replay-orchestrator-core.mjs',
      'lib/teachin/dual-replay-orchestrator.mjs',
    ]) {
      const path = resolve(ROOT, relativePath);
      if (!existsSync(path)) continue;
      const facade = readFileSync(path, 'utf8');
      assert(!facade.includes('runtime-bootstrap')
        && !/\.openRuntime\s*\(/.test(facade),
      `${relativePath} 不得越过 runtime-cycle 转交内部 live runtime`);
    }
    assert(own.trimEnd().split(/\r?\n/).length < 600,
      'runtime-bootstrap production 必须 <600 行');
  });
}

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  for (const failure of failures) console.error(`  FAIL ${failure}`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
