#!/usr/bin/env node
// Page topology 模块、formal schema 与三管线接线静态门；零 SUT/browser/network。

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const TAG = 'page-topology-auth-continuity-boundaries';
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
    failures.push(`${name}: ${String(error?.message || error).slice(-1000)}`);
    console.error(`RED  ${TAG}: ${name}: ${String(error?.message || error).slice(-1000)}`);
  }
}

function source(rel) {
  return readFileSync(resolve(ROOT, rel), 'utf8');
}

function lineCount(text) {
  const count = text.split(/\r?\n/).length;
  return /\r?\n$/.test(text) ? count - 1 : count;
}

function imports(text) {
  return [
    ...text.matchAll(/\b(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g),
    ...text.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
  ].map((match) => match[1]);
}

const MODULES = [
  'lib/page-topology/session-seed.mjs',
  'lib/page-topology/controller.mjs',
  'lib/page-topology/topology-events.mjs',
  'lib/page-topology/record-bridge.mjs',
  'lib/page-topology/replay-bridge.mjs',
];

check('B1 现役 schema 已声明 newpage+url，且不持久化 pageId/opener', () => {
  const schema = JSON.parse(source('tests/_golden/schemas/events.schema.json'));
  const event = schema.definitions.event;
  const actions = event.properties.action.enum;
  assert(actions.includes('newpage'), 'events schema action enum 缺 newpage');
  const branch = event.allOf.find((item) => item.if?.properties?.action?.enum?.includes('newpage'));
  assert(branch?.then?.required?.includes('url'), 'events schema newpage 分支须 url');
  assert(!('pageId' in event.properties) && !('openerPageId' in event.properties),
    'formal event 不得持久化 runtime pageId/opener');
});

check('B2 五个新增模块完整且逐文件不超过 600 行', () => {
  const missing = MODULES.filter((rel) => !existsSync(resolve(ROOT, rel)));
  assert(missing.length === 0, `模块缺失：${missing.join(', ')}`);
  const oversized = MODULES
    .map((rel) => ({ rel, lines: lineCount(source(rel)) }))
    .filter((item) => item.lines > 600);
  assert(oversized.length === 0,
    `新增模块超过 600 行：${oversized.map((item) => `${item.rel}=${item.lines}`).join(', ')}`);
});

check('B3 topology core 零 Playwright/IO/网络/凭据/verdict 依赖', () => {
  const forbidden = [
    'playwright',
    'node:fs',
    'node:http',
    'node:https',
    'node:net',
    'node:tls',
    'node:child_process',
    'login-bootstrap',
    'loadCred',
    'site.json',
    '.auth',
    'verdict',
    'bin/replay',
    'bin/record',
  ];
  const violations = [];
  for (const rel of MODULES) {
    assert(existsSync(resolve(ROOT, rel)), `模块缺失：${rel}`);
    for (const specifier of imports(source(rel))) {
      if (forbidden.some((fragment) => specifier.includes(fragment))) {
        violations.push(`${rel} -> ${specifier}`);
      }
    }
  }
  assert(violations.length === 0, `topology 越层依赖：${violations.join(', ')}`);
});

check('B4 record 使用 context 级 binding/init/page listener，不再只挂初始 page', () => {
  const text = source('bin/record.mjs');
  assert(imports(text).some((specifier) => specifier.includes('page-topology/record-bridge')),
    'bin/record.mjs 未接 record-bridge');
  assert(/context\.exposeBinding\s*\(/.test(text), 'record 缺 context.exposeBinding');
  assert(/context\.addInitScript\s*\(/.test(text), 'record 缺 context.addInitScript');
  assert(/context\.on\s*\(\s*['"]page['"]/.test(text), 'record 缺 context page listener');
  assert(!text.includes('page.exposeBinding') && !text.includes('page.addInitScript'),
    'record 仍只对固定 page 安装 binding/init');
});

check('B5 capture/distill 保留结构 newpage，source/distilled 共用 topology-events', () => {
  const capture = source('lib/record-capture.mjs');
  const distill = source('lib/record-distill.mjs');
  assert(imports(capture).some((specifier) => specifier.includes('page-topology/topology-events')),
    'record-capture 未接 topology-events');
  assert(imports(distill).some((specifier) => specifier.includes('page-topology/topology-events')),
    'record-distill 未接 topology-events');
  assert(/ALLOWED_ACTIONS[\s\S]{0,260}newpage/.test(capture), 'capture 允许动作未含 newpage');
  assert(distill.includes('topologyRole') && distill.includes('newpage'),
    'distill 未把 newpage 保留为结构 projection');
});

check('B6 replay/replay-actions 接共享 bridge，newpage 在 locator 前显式委派', () => {
  const replay = source('bin/replay.mjs');
  const actions = source('lib/replay-actions.mjs');
  assert(imports(replay).some((specifier) => specifier.includes('page-topology')),
    'bin/replay.mjs 未接 page topology');
  assert(imports(actions).some((specifier) => specifier.includes('page-topology/replay-bridge')),
    'replay-actions 未接 replay-bridge');
  const newpageAt = actions.search(/ev\.action\s*===\s*['"]newpage['"]/);
  const candidateAt = actions.indexOf('resolveCandidate(page, ev)');
  assert(newpageAt >= 0 && candidateAt >= 0 && newpageAt < candidateAt,
    'newpage 必须在普通 locator 解析前委派');
});

check('B7 replay 不再把 pageerror/CDP/session seed 只挂固定初始 page', () => {
  const replay = source('bin/replay.mjs');
  const forensics = source('lib/replay-forensics.mjs');
  assert(forensics.includes('export') && forensics.includes('attachPageForensics'),
    'replay-forensics 未导出 attachPageForensics');
  assert(replay.includes('attachPageForensics') && replay.includes('attachForensics'),
    'bin/replay 未把 per-page forensics adapter 注入 controller');
  assert(!replay.includes("page.on('pageerror'") && !replay.includes('context.newCDPSession(page)'),
    'replay 仍有固定初始 page 的 forensics 接线');
  assert(!replay.includes('await page.addInitScript(({ origin, entries })'),
    'replay session seed 仍只对单个 page 注入');
});

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
