#!/usr/bin/env node
// Independent zero-SUT regression for public PageObservation redaction.
// Pure in-memory driver: no browser, server, network, SUT, credentials, or site config.

import { disposeAffordanceAuthority } from '../../lib/zero-shot/affordance-authority.mjs';
import { observePage } from '../../lib/zero-shot/page-observer.mjs';

const failures = [];
let passed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   public-observation-redaction: ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error?.message || error}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function trackedHandle(id, disposed) {
  return Object.freeze({
    id,
    dispose() {
      disposed.push(id);
    },
  });
}

function affordance(handle, name) {
  return {
    handle,
    role: 'button',
    accessibleName: name,
    label: null,
    text: name,
    visible: true,
    enabled: true,
    actionSpace: ['click'],
  };
}

function driverFor({ url, title, names }) {
  const disposed = [];
  const handles = names.map((name, index) => trackedHandle(`handle_${index + 1}`, disposed));
  const snapshot = {
    revision: 'rev_redaction_1',
    url,
    title,
    settled: true,
    unsupportedScopes: {},
    sourceTruncated: false,
    affordances: names.map((name, index) => affordance(handles[index], name)),
  };
  return {
    disposed,
    handles,
    driver: Object.freeze({
      async settle() {
        return { settled: true };
      },
      async snapshotMainFrame() {
        return snapshot;
      },
      async revalidate() {
        return {
          connected: true,
          sameNode: true,
          pageCount: 1,
          visible: true,
          enabled: true,
        };
      },
      async perform() {
        return { performed: true };
      },
    }),
  };
}

const opaque = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdef';
const sensitiveNames = [
  'alice@example.invalid',
  'Bearer synthetic-access-value',
  'token=synthetic-value',
  'session synthetic-value',
  'password reset value',
  'credential synthetic-value',
  '凭据 synthetic-value',
  opaque,
];

await check('title 清空、pathname 分段占位、敏感 semantic 候选删除并释放 handle', async () => {
  const surface = driverFor({
    url: `https://host.invalid/team/alice%40example.invalid/session/${opaque}/safe?token=query#fragment`,
    title: '账户 alice@example.invalid token=synthetic-title-value',
    names: [...sensitiveNames, '继续'],
  });
  const result = await observePage({
    driver: surface.driver,
    intentId: 'intent_redaction',
    maxCandidates: 20,
  });
  assert(result?.ok === true && result.observation && result.authority,
    `observe 应成功：${JSON.stringify(result)}`);
  const { observation } = result;
  const json = JSON.stringify(observation);

  assert(observation.title === '', `敏感 title 必须清空：${JSON.stringify(observation.title)}`);
  assert(observation.urlPathname
    === '/team/<redacted:sensitive>/<redacted:sensitive>/<redacted:sensitive>/safe',
  `pathname 敏感段须稳定占位：${observation.urlPathname}`);
  assert(observation.affordances.length === 1
    && observation.affordances[0].semantic?.name === '继续',
  `敏感 semantic 候选必须删除：${JSON.stringify(observation.affordances)}`);
  for (const marker of [
    'alice@example.invalid',
    'synthetic-access-value',
    'synthetic-title-value',
    'synthetic-value',
    opaque,
    'host.invalid',
    'token=query',
    '#fragment',
  ]) {
    assert(!json.includes(marker), `public observation 泄漏 marker：${marker}`);
  }
  assert(surface.disposed.length === sensitiveNames.length,
    `删除候选 handle 必须立即释放：${JSON.stringify(surface.disposed)}`);

  await disposeAffordanceAuthority(result.authority);
  assert(surface.disposed.length === sensitiveNames.length + 1,
    '保留候选 handle 应由 authority dispose 释放');
});

await check('安全 title/name/path 保真，percent-encoded 敏感段仍打码', async () => {
  const surface = driverFor({
    url: `https://host.invalid/workflow/%61lice%40example.invalid/%74oken-value/list`,
    title: '工作流管理',
    names: ['打开帮助'],
  });
  const result = await observePage({
    driver: surface.driver,
    intentId: 'intent_safe',
    maxCandidates: 8,
  });
  assert(result?.ok === true, `observe 应成功：${JSON.stringify(result)}`);
  assert(result.observation.title === '工作流管理', '安全 title 不应丢失');
  assert(result.observation.affordances[0]?.semantic?.name === '打开帮助', '安全 semantic name 不应丢失');
  assert(result.observation.urlPathname
    === '/workflow/<redacted:sensitive>/<redacted:sensitive>/list',
  `编码敏感段须稳定打码：${result.observation.urlPathname}`);
  await disposeAffordanceAuthority(result.authority);
});

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.error(`\npublic-observation-redaction: ${passed} passed, ${failures.length} failed`);
  process.exit(1);
}

console.log(`\npublic-observation-redaction: ${passed}/2 passed`);
