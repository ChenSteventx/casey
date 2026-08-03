#!/usr/bin/env node
// agent-network-code-identity：网络编号 + DOM 名称闭集模式金牌（zero-SUT，纯函数/测试替身）。
// 红先行病灶：共享剖面模块缺席；现役双证门和句柄门强制 DOM code，无法表达真实卡片「副标题是描述」。

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const MODE = 'network-code-dom-name-v1';
let passed = 0;
const failures = [];

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   agent-network-code-identity: ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error?.message || error}`);
  }
}
function must(value, message) { if (!value) throw new Error(message); }
function equal(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
function digest(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')}`;
}

let profileApi = null;
try { profileApi = await import('../../lib/agent-identity-profile.mjs'); } catch { profileApi = null; }
const gateApi = await import('../../lib/agent-identity-gate.mjs');
const cardApi = await import('../../lib/agent-search-gate.mjs');

const listApi = Object.freeze({
  pathname: '/api/agents/query', method: 'GET', queryParam: 'nameLike',
  recordsPath: 'data.records', totalPath: 'data.total', hasNextPath: null,
  fields: { id: 'agentId', code: 'agentCode', name: 'agentName' },
});
const legacy = () => ({
  itemContainer: '.agent-card',
  cardFields: { name: '.agent-card__name', code: '.agent-card__code' },
  listApi: { ...listApi, fields: { ...listApi.fields } },
});
const networkCode = () => ({
  identityMode: MODE,
  itemContainer: '.agent-card',
  cardFields: { name: '.agent-card__name' },
  listApi: { ...listApi, fields: { ...listApi.fields } },
});

await check('A1 legacy 剖面通道与旧 identityProfileDigest 字节不变', () => {
  must(profileApi, '共享剖面模块缺席（红先行）');
  const out = profileApi.parseAgentIdentityProfile(legacy());
  must(out.ok, `legacy 应成功：${out.reason}`);
  equal(out.mode, 'dom-name-code-v1', 'legacy 规范模式');
  equal(JSON.stringify(out.channel), JSON.stringify(listApi), 'legacy 通道投影');
  equal(out.digest, digest(listApi), 'legacy 指纹必须逐字等于旧 listApi 算法');
});

await check('A1 新模式闭集校验：禁 cardFields.code、拒未知模式与缺字段', () => {
  must(profileApi, '共享剖面模块缺席（红先行）');
  must(profileApi.parseAgentIdentityProfile(networkCode()).ok, '合法新模式应过');
  const withCode = networkCode(); withCode.cardFields.code = '.agent-card__subtitle';
  must(!profileApi.parseAgentIdentityProfile(withCode).ok, '新模式携 code 必拒，描述不得冒充编号');
  const unknown = networkCode(); unknown.identityMode = 'future-open-mode';
  must(!profileApi.parseAgentIdentityProfile(unknown).ok, '未知模式必须 fail-closed');
  const missingName = networkCode(); delete missingName.cardFields.name;
  must(!profileApi.parseAgentIdentityProfile(missingName).ok, '缺名称选择器必须拒');
});

await check('A2 新模式指纹覆盖模式、通道、容器、名称选择器', () => {
  must(profileApi, '共享剖面模块缺席（红先行）');
  const base = profileApi.parseAgentIdentityProfile(networkCode());
  must(base.ok, '新模式基线应过');
  for (const mutate of [
    (p) => { p.listApi.pathname = '/api/agents/other'; },
    (p) => { p.itemContainer = '.other-card'; },
    (p) => { p.cardFields.name = '.other-name'; },
  ]) {
    const changed = networkCode(); mutate(changed);
    const out = profileApi.parseAgentIdentityProfile(changed);
    must(out.ok && out.digest !== base.digest, '指纹覆盖面变异必须改 digest');
  }
  must(base.digest !== digest(listApi), '新模式 digest 必须区别于 legacy listApi-only digest');
});

const row = { id: '1234567890123456789', code: 'AG-001', name: '互联网问诊-主诉' };
const signed = { openName: row.name, signedName: row.name, signedCode: row.code, signedPlatformId: row.id };
const resolveNew = (overrides = {}) => gateApi.resolveDualIdentity({
  mode: MODE,
  dom: { status: 'unique', name: row.name },
  envelope: { status: 'ok', rows: [{ ...row }], total: 1 },
  expected: { ...signed },
  ...overrides,
});

await check('A3 新模式 DOM 精确名 + 网络唯一行 + 已签三元组全等才 unique', () => {
  const out = resolveNew();
  equal(out.resolution, 'unique', `新模式合法路径应放行（reason=${out.reason}）`);
  equal(JSON.stringify(out.matched), JSON.stringify({ name: row.name, code: row.code, platformId: row.id }), 'matched 三元组');
});

await check('A3 新模式歧义与签署错配逐项拒绝', () => {
  equal(resolveNew({ dom: { status: 'ambiguous' } }).resolution, 'ambiguous', 'DOM 多卡');
  equal(resolveNew({ envelope: { status: 'ok', rows: [{ ...row }, { ...row, id: '2' }], total: 2 } }).resolution, 'ambiguous', '网络同名多行');
  equal(resolveNew({ expected: { ...signed, signedCode: 'AG-WRONG' } }).resolution, 'action_failed', '签署编号错配');
  equal(resolveNew({ expected: { ...signed, signedPlatformId: '2' } }).resolution, 'action_failed', '签署平台标识错配');
  equal(resolveNew({ dom: { status: 'unique', name: '另一智能体' } }).resolution, 'action_failed', 'DOM 名称错配');
  equal(gateApi.resolveDualIdentity({ mode: 'unknown', dom: { status: 'unique', name: row.name }, envelope: { status: 'ok', rows: [row] }, expected: signed }).resolution, 'action_failed', '未知模式');
});

function makeCard({ connected = true, visible = true, name = row.name, code = row.code } = {}) {
  let clicks = 0;
  const el = {
    isConnected: connected,
    getClientRects: () => (visible ? [{}] : []),
    querySelector: (selector) => {
      if (selector === '.agent-card__name') return { textContent: name };
      if (selector === '.agent-card__code') return { textContent: code };
      return null;
    },
  };
  return {
    evaluate: async (fn, arg) => fn(el, arg),
    $: async (selector) => (selector === '.agent-card__name' ? { click: async () => { clicks += 1; }, dispose: async () => {} } : null),
    dispose: async () => {},
    clicks: () => clicks,
  };
}

await check('A4 新模式同句柄重验 connected/visible/name，合法才点击', async () => {
  for (const [label, options] of [['detached', { connected: false }], ['hidden', { visible: false }], ['renamed', { name: '另一智能体' }]]) {
    const card = makeCard(options);
    const ok = await cardApi.clickAgentCardWithin(card, { mode: MODE, cardFields: { name: '.agent-card__name' }, name: row.name, code: row.code });
    must(ok === false && card.clicks() === 0, `${label} 必须零点击`);
  }
  const card = makeCard();
  const ok = await cardApi.clickAgentCardWithin(card, { mode: MODE, cardFields: { name: '.agent-card__name' }, name: row.name, code: row.code });
  must(ok === true && card.clicks() === 1, '合法同句柄应恰点击一次');
});

await check('A4 legacy 仍强制同卡名称+编号', async () => {
  const good = makeCard();
  must(await cardApi.clickAgentCardWithin(good, { cardFields: legacy().cardFields, name: row.name, code: row.code }), 'legacy 合法应点击');
  const wrong = makeCard({ code: 'AG-WRONG' });
  must(!(await cardApi.clickAgentCardWithin(wrong, { cardFields: legacy().cardFields, name: row.name, code: row.code })) && wrong.clicks() === 0, 'legacy 编号错配仍零点击');
});

await check('A5 compile/replay 共同消费共享剖面解析与指纹，旧内联摘要消失', () => {
  const compile = readFileSync(resolve(ROOT, 'bin/compile.mjs'), 'utf8');
  const replay = readFileSync(resolve(ROOT, 'bin/replay.mjs'), 'utf8');
  for (const [name, source] of [['compile', compile], ['replay', replay]]) {
    must(source.includes("from '../lib/agent-identity-profile.mjs'"), `${name} 未 import 共享剖面模块`);
    must(source.includes('parseAgentIdentityProfile('), `${name} 未调用共享解析`);
  }
  must(!compile.includes('canonicalSortKeys(identityChannelCfg)'), 'compile 仍保留旧内联 digest');
  must(!replay.includes('sortKeys(identityChannelCfg)'), 'replay 仍保留旧内联 digest');
});

console.log(`agent-network-code-identity: ${passed} passed, ${failures.length} failed`);
for (const failure of failures) console.error(`FAIL ${failure}`);
process.exit(failures.length ? 1 : 0);
