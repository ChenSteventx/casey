#!/usr/bin/env node
// Windows native Chromium hermetic golden. Every case uses a fresh BrowserContext;
// no production SUT, credentials, external network, LLM, mutation, or git writes.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '@playwright/test';
import { createPageTopologyController } from '../../lib/page-topology/controller.mjs';
import { projectTopologyAuthority } from '../../lib/teachin/runtime-owner.mjs';
import { resolveExecutionTarget } from '../../lib/execution-target/authority.mjs';
import { canonicalRawPlaywrightDriver } from '../../lib/teachin/raw-playwright-driver.mjs';

const { chromium } = pw;
const TAG = 'teachin-raw-locator-uniqueness-browser';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const ORIGIN = 'http://casey-raw-locator.invalid';
const URL = `${ORIGIN}/fixture`;
const SELECTOR = '[data-casey-action="target"]';
const EVENT = Object.freeze({ action: 'click', path: '/fixture', fallbackCss: SELECTOR });
const EXECUTION = resolveExecutionTarget({
  runtime: { platform: 'win32', isWSL: false },
  logicalTarget: { startUrl: URL },
  transport: { mode: 'direct' },
  requiresOriginContinuity: true,
});

if (EXECUTION?.ok !== true || !EXECUTION.authority) {
  throw new Error('fixture execution target authority unavailable');
}

const failures = [];
let passed = 0;
let pageOrdinal = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${TAG}: ${name}`);
  } catch (error) {
    const detail = String(error?.message || error).slice(-700);
    failures.push(`${name}: ${detail}`);
    console.error(`RED  ${TAG}: ${name}: ${detail}`);
  }
}

function documentFor(body, style = '') {
  return `<!doctype html><html><head><style>${style}</style></head><body>
    ${body}
    <script>
      window.__caseyClicks = 0;
      document.addEventListener('click', (event) => {
        if (event.target.matches(${JSON.stringify(SELECTOR)})) window.__caseyClicks += 1;
      });
    </script>
  </body></html>`;
}

async function openFixture(browser, body, style = '') {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route(`${ORIGIN}/**`, (route) => route.fulfill({
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body: documentFor(body, style),
  }));
  await page.goto(URL);
  const started = await createPageTopologyController({
    context,
    initialPage: page,
    attachForensics: async () => {},
    idFactory: () => `pg_raw_unique_${pageOrdinal += 1}`,
  });
  assert(started?.ok === true && started.controller, 'page topology controller unavailable');
  return {
    context,
    page,
    topologyAuthority: projectTopologyAuthority(started.controller),
  };
}

async function resolveAction(harness) {
  return canonicalRawPlaywrightDriver.resolve({
    event: EVENT,
    topologyAuthority: harness.topologyAuthority,
    executionTargetAuthority: EXECUTION.authority,
  });
}

async function performAction(harness, actionAuthority) {
  return canonicalRawPlaywrightDriver.perform({
    actionAuthority,
    topologyAuthority: harness.topologyAuthority,
    executionTargetAuthority: EXECUTION.authority,
  });
}

async function clicks(page) {
  return page.evaluate(() => window.__caseyClicks);
}

const browser = await chromium.launch({ headless: true });
try {
  await check('原始 selector 在两个容器命中两个元素：ambiguous、无 authority、零点击', async () => {
    const harness = await openFixture(browser, `
      <section><button data-casey-action="target">继续</button></section>
      <aside><button data-casey-action="target">继续</button></aside>`);
    try {
      const resolved = await resolveAction(harness);
      assert(resolved?.resolution === 'ambiguous' && resolved.candidateCount === 2,
        `duplicate selector must be ambiguous: ${JSON.stringify(resolved)}`);
      assert(!Object.hasOwn(resolved, 'actionAuthority'), 'ambiguous resolution minted authority');
      const denied = await performAction(harness, resolved.actionAuthority);
      assert(denied?.ok === false && await clicks(harness.page) === 0,
        `ambiguous path performed a click: ${JSON.stringify(denied)}`);
    } finally {
      await harness.context.close();
    }
  });

  await check('resolve 一个、revalidate 两个：旧 authority 失效且零点击', async () => {
    const harness = await openFixture(browser,
      '<button data-casey-action="target">继续</button>');
    try {
      const resolved = await resolveAction(harness);
      assert(resolved?.resolution === 'unique' && resolved.actionAuthority,
        `single candidate did not mint authority: ${JSON.stringify(resolved)}`);
      await harness.page.evaluate(() => {
        const duplicate = document.createElement('button');
        duplicate.dataset.caseyAction = 'target';
        duplicate.textContent = '继续';
        document.body.append(duplicate);
      });
      const denied = await performAction(harness, resolved.actionAuthority);
      assert(denied?.ok === false && denied.reason === 'ACTION_FAILED',
        `1-to-2 drift was not denied: ${JSON.stringify(denied)}`);
      assert(await clicks(harness.page) === 0, '1-to-2 drift clicked a candidate');
    } finally {
      await harness.context.close();
    }
  });

  await check('原节点被 clone 替换：旧 authority 失效且零点击', async () => {
    const harness = await openFixture(browser,
      '<button data-casey-action="target">继续</button>');
    try {
      const resolved = await resolveAction(harness);
      assert(resolved?.resolution === 'unique' && resolved.actionAuthority,
        `single candidate did not mint authority: ${JSON.stringify(resolved)}`);
      await harness.page.evaluate((selector) => {
        const original = document.querySelector(selector);
        original.replaceWith(original.cloneNode(true));
      }, SELECTOR);
      const denied = await performAction(harness, resolved.actionAuthority);
      assert(denied?.ok === false && await clicks(harness.page) === 0,
        `replacement node reused old authority: ${JSON.stringify(denied)}`);
    } finally {
      await harness.context.close();
    }
  });

  for (const [name, body, style] of [
    ['disabled', '<button disabled data-casey-action="target">继续</button>', ''],
    ['被遮挡', `<button data-casey-action="target">继续</button><div class="cover"></div>`,
      '.cover{position:fixed;inset:0;background:rgba(0,0,0,.01)}'],
    ['可见但不可操作', '<button class="inert" data-casey-action="target">继续</button>',
      '.inert{pointer-events:none}'],
  ]) {
    await check(`${name} 元素：动作拒绝且零点击`, async () => {
      const harness = await openFixture(browser, body, style);
      try {
        const resolved = await resolveAction(harness);
        assert(resolved?.resolution === 'unique' && resolved.actionAuthority,
          `${name} unique identity should still resolve`);
        const denied = await performAction(harness, resolved.actionAuthority);
        assert(denied?.ok === false && denied.reason === 'ACTION_FAILED',
          `${name} action did not fail closed: ${JSON.stringify(denied)}`);
        assert(await clicks(harness.page) === 0, `${name} action reached DOM click handler`);
      } finally {
        await harness.context.close();
      }
    });
  }

  await check('单一且可操作元素：真实点击恰一次', async () => {
    const harness = await openFixture(browser,
      '<button data-casey-action="target">继续</button>');
    try {
      const resolved = await resolveAction(harness);
      const done = await performAction(harness, resolved.actionAuthority);
      assert(done?.ok === true && await clicks(harness.page) === 1,
        `positive action did not click exactly once: ${JSON.stringify(done)}`);
    } finally {
      await harness.context.close();
    }
  });

  await check('canonical raw 权威路径无 first/last/nth、坐标、force 与 try-many', async () => {
    const source = readFileSync(resolve(ROOT, 'lib/teachin/raw-playwright-driver.mjs'), 'utf8');
    assert(!/\.\s*(?:first|last|nth)\s*\(/.test(source), 'authoritative raw driver narrows locator');
    assert(!/mouse\s*\.\s*click|force\s*:\s*true/.test(source), 'raw driver bypasses actionability');
    assert(!/for\s*\([^)]*(?:selector|locator)[^)]*\)[\s\S]{0,300}(?:click|dblclick)\s*\(/.test(source),
      'raw driver tries multiple locators until one clicks');
  });
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
