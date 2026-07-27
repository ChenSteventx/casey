#!/usr/bin/env node
// zero-shot observe 的主 frame 验收：纯内存 page driver double，零 browser/server/SUT。
// adapter double 的 GREEN 只证明内核控制流，不冒充真实 Playwright 或真实页面 UAT。
import { observePage } from '../../lib/zero-shot/page-observer.mjs';
import {
  disposeAffordanceAuthority,
  revalidateAffordance,
} from '../../lib/zero-shot/affordance-authority.mjs';
import {
  createPageDriverDouble,
} from './fixtures/zero-shot-observe-admit-step/adapter-double.mjs';

const failures = [];
let passed = 0;

async function check(checkId, name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${checkId} ${name}`);
  } catch (error) {
    failures.push(`${checkId} ${name}: ${String(error?.message || error).slice(-700)}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function syntheticAffordance(overrides = {}) {
  return {
    handleId: 'detail-button',
    role: 'button',
    accessibleName: '查看详情',
    label: null,
    text: '查看详情',
    visible: true,
    enabled: true,
    actionSpace: ['click'],
    ...overrides,
  };
}

function semantics(observation) {
  return observation.affordances.map((item) => ({
    semantic: item.semantic,
    visible: item.visible,
    enabled: item.enabled,
    actionSpace: item.actionSpace,
    pageCount: item.pageCount,
  }));
}

function observationJson(result) {
  assert(result && result.ok === true, `observePage 应 ok:true，实际 ${JSON.stringify(result)}`);
  assert(result.observation && result.authority, 'observePage 成功须同时返回 observation 与 authority');
  return JSON.stringify(result.observation);
}

// sourceObligationId:zs-observe-a1 unitCheckId:page-observer-main-frame-a1
await check('page-observer-main-frame-a1', '主 frame 观察稳定排序、稳定 digest 且 URL 只留脱敏 pathname', async () => {
  const { driver, control } = createPageDriverDouble({
    url: 'https://sut.invalid/ai/token/list?session=synthetic-query-secret#fragment',
    title: '智能体管理',
    affordances: [
      syntheticAffordance({ handleId: 'z-button', accessibleName: '查看详情', text: '查看详情' }),
      syntheticAffordance({ handleId: 'a-link', role: 'link', accessibleName: '帮助', text: '帮助' }),
    ],
  });
  const first = await observePage({ driver, intentId: 'intent_1', maxCandidates: 8 });
  const second = await observePage({ driver, intentId: 'intent_1', maxCandidates: 8 });
  observationJson(first);
  const json = observationJson(second);

  assert(first.observation.frameScope === 'main', 'frameScope 须固定 main');
  assert(first.observation.urlPathname === '/ai/<redacted:cred-route>/list',
    `URL 须脱敏为 pathname，实际 ${first.observation.urlPathname}`);
  assert(!json.includes('sut.invalid') && !json.includes('synthetic-query-secret') && !json.includes('#fragment'),
    'public observation 不得含 host/query/hash');
  assert(/^sha256:[a-f0-9]{64}$/.test(first.observation.catalogDigest), 'catalogDigest 须为 sha256');
  assert(first.observation.catalogDigest === second.observation.catalogDigest, '相同事实的 catalogDigest 须稳定');
  assert(JSON.stringify(semantics(first.observation)) === JSON.stringify(semantics(second.observation)),
    '相同事实的候选排序须稳定');
  assert(first.observation.affordances.every((item) => /^af_[a-z0-9_]+$/.test(item.affordanceId)),
    '物理候选只能使用 af_* affordanceId');
  assert(first.observation.affordances.every((item) => item.semantic
    && ['role', 'label', 'text'].includes(item.semantic.kind)
    && item.semantic.exact === true
    && typeof item.semantic.name === 'string'
    && !Object.hasOwn(item, 'role')
    && !Object.hasOwn(item, 'accessibleName')
    && !Object.hasOwn(item, 'label')
    && !Object.hasOwn(item, 'text')),
  'public affordance 须收敛为 resolver 共用的 exact semantic 最小投影');
  assert(control.calls.settle === 2 && control.calls.snapshot === 2,
    `每次观察应各 settle/snapshot 一次，实际 ${JSON.stringify(control.calls)}`);
});

// sourceObligationId:zs-observe-a2 unitCheckId:page-observer-main-frame-a2
await check('page-observer-main-frame-a2', 'public JSON 严格剥离 raw/html/link/value/platformId 与机器裁定字段', async () => {
  const secretFacts = {
    rawHtml: '<button data-private="synthetic-raw-secret">查看详情</button>',
    href: 'https://sut.invalid/detail?access=synthetic-href-secret',
    src: 'https://sut.invalid/icon?access=synthetic-src-secret',
    value: 'synthetic-input-secret',
    inputValue: 'synthetic-input-value-secret',
    platformId: 'synthetic-platform-id',
  };
  const original = {
    url: 'https://sut.invalid/detail?query=synthetic-url-secret',
    title: '详情',
    affordances: [syntheticAffordance(secretFacts)],
  };
  const before = structuredClone(original);
  const { driver } = createPageDriverDouble(original);
  const result = await observePage({ driver, intentId: 'intent_1', maxCandidates: 8 });
  const json = observationJson(result);

  for (const marker of [
    'synthetic-raw-secret', 'synthetic-href-secret', 'synthetic-src-secret',
    'synthetic-input-secret', 'synthetic-input-value-secret', 'synthetic-platform-id',
  ]) {
    assert(!json.includes(marker), `public observation 泄漏惰性事实 ${marker}`);
  }
  for (const forbiddenKey of ['rawHtml', 'href', 'src', 'value', 'inputValue', 'platformId', 'verdict', 'passes']) {
    assert(!Object.hasOwn(result.observation, forbiddenKey) && !json.includes(`"${forbiddenKey}"`),
      `public observation 不得含字段 ${forbiddenKey}`);
  }
  assert(result.observation.signed === false && result.observation.replayReady === false,
    '页面观察件恒未签且不可回放');
  assert(JSON.stringify(original) === JSON.stringify(before), 'observePage 不得变异输入事实');
});

// sourceObligationId:zs-observe-a3 unitCheckId:page-observer-main-frame-a3
await check('page-observer-main-frame-a3', 'unsettled、truncated 与 unsupported scope 只产不可动作证据', async () => {
  for (const scenario of [
    {
      label: 'unsettled',
      options: { settled: false, affordances: [syntheticAffordance()] },
      maxCandidates: 8,
      reason: 'OBSERVATION_UNSETTLED',
    },
    {
      label: 'truncated',
      options: {
        affordances: [
          syntheticAffordance({ handleId: 'a', accessibleName: '甲', text: '甲' }),
          syntheticAffordance({ handleId: 'b', accessibleName: '乙', text: '乙' }),
          syntheticAffordance({ handleId: 'c', accessibleName: '丙', text: '丙' }),
        ],
      },
      maxCandidates: 2,
      reason: 'CATALOG_TRUNCATED',
    },
    {
      label: 'iframe',
      options: {
        unsupportedScopes: { iframe: true },
        affordances: [syntheticAffordance()],
      },
      maxCandidates: 8,
      reason: 'UNSUPPORTED_SCOPE',
    },
    {
      label: 'container-only',
      options: {
        unsupportedScopes: { containerOnly: true },
        affordances: [syntheticAffordance()],
      },
      maxCandidates: 8,
      reason: 'UNSUPPORTED_SCOPE',
    },
  ]) {
    const { driver, control } = createPageDriverDouble(scenario.options);
    const result = await observePage({ driver, intentId: 'intent_1', maxCandidates: scenario.maxCandidates });
    observationJson(result);
    const firstId = result.observation.affordances[0]?.affordanceId;
    const admission = await revalidateAffordance({
      authority: result.authority,
      affordanceId: firstId,
    });
    assert(admission.ok === false && admission.reason === scenario.reason,
      `${scenario.label} 须拒 ${scenario.reason}，实际 ${JSON.stringify(admission)}`);
    assert(control.calls.perform === 0, `${scenario.label} 观察/重验不得执行 action`);
    if (scenario.label === 'truncated') {
      assert(result.observation.truncated === true && result.observation.affordances.length === 2,
        '超上限须明确 truncated:true 且 public catalog 有界');
    }
  }
});

// sourceObligationId:zs-observe-a4 unitCheckId:page-observer-main-frame-a4
await check('page-observer-main-frame-a4', 'hidden/disabled 同语义项进入全页歧义计数而不是洗成唯一', async () => {
  for (const duplicate of [
    syntheticAffordance({ handleId: 'hidden-copy', visible: false }),
    syntheticAffordance({ handleId: 'disabled-copy', enabled: false }),
  ]) {
    const { driver } = createPageDriverDouble({
      affordances: [
        syntheticAffordance({ handleId: 'visible-copy', pageCount: 2 }),
        { ...duplicate, pageCount: 2 },
      ],
    });
    const result = await observePage({ driver, intentId: 'intent_1', maxCandidates: 8 });
    observationJson(result);
    const candidates = result.observation.affordances.filter((item) => item.semantic?.name === '查看详情');
    assert(candidates.length === 2, 'hidden/disabled duplicate 必须保留为歧义事实');
    assert(candidates.every((item) => item.pageCount === 2 && item.actionable === false),
      `重复语义项不得 actionable，实际 ${JSON.stringify(candidates)}`);
    const admission = await revalidateAffordance({
      authority: result.authority,
      affordanceId: candidates.find((item) => item.visible && item.enabled)?.affordanceId,
    });
    assert(admission.ok === false && admission.reason === 'AFFORDANCE_AMBIGUOUS',
      `重复候选重验须歧义拒绝，实际 ${JSON.stringify(admission)}`);
  }
});

// sourceObligationId:zs-observe-a5 unitCheckId:page-observer-main-frame-a5
await check('page-observer-main-frame-a5', 'authority 防 JSON clone、旧 observation、DOM replacement 与 dispose', async () => {
  const { driver, control } = createPageDriverDouble({
    affordances: [syntheticAffordance({ pageCount: 1 })],
  });
  const first = await observePage({ driver, intentId: 'intent_1', maxCandidates: 8 });
  observationJson(first);
  const firstId = first.observation.affordances[0].affordanceId;
  const current = await revalidateAffordance({ authority: first.authority, affordanceId: firstId });
  assert(current.ok === true, `当前 authority 的唯一物理句柄应可重验，实际 ${JSON.stringify(current)}`);
  assert(control.calls.revalidate === 1, '成功重验须委派 driver.revalidate 恰一次');

  const cloned = structuredClone(first.authority);
  const forged = await revalidateAffordance({ authority: cloned, affordanceId: firstId });
  assert(forged.ok === false && forged.reason === 'AUTHORITY_INVALID',
    `JSON clone 不得授权，实际 ${JSON.stringify(forged)}`);

  const second = await observePage({ driver, intentId: 'intent_1', maxCandidates: 8 });
  observationJson(second);
  const stale = await revalidateAffordance({ authority: first.authority, affordanceId: firstId });
  assert(stale.ok === false && stale.reason === 'STALE_OBSERVATION',
    `新 observation 后旧 authority 必须失效，实际 ${JSON.stringify(stale)}`);

  const secondId = second.observation.affordances[0].affordanceId;
  assert(control.replace('detail-button') === true, '测试替身须成功替换目标 handle');
  const replaced = await revalidateAffordance({ authority: second.authority, affordanceId: secondId });
  assert(replaced.ok === false && replaced.reason === 'AFFORDANCE_DRIFTED',
    `DOM replacement 须拒 AFFORDANCE_DRIFTED，实际 ${JSON.stringify(replaced)}`);

  const third = await observePage({ driver, intentId: 'intent_1', maxCandidates: 8 });
  observationJson(third);
  const thirdId = third.observation.affordances[0].affordanceId;
  await disposeAffordanceAuthority(third.authority);
  const disposed = await revalidateAffordance({ authority: third.authority, affordanceId: thirdId });
  assert(disposed.ok === false && disposed.reason === 'AUTHORITY_DISPOSED',
    `dispose 后不得授权，实际 ${JSON.stringify(disposed)}`);
  assert(control.calls.perform === 0, '观察/重验全程 action adapter 必须零调用');
});

// sourceObligationId:zs-observe-a6 unitCheckId:page-observer-main-frame-a6
await check('page-observer-main-frame-a6', 'driver 异常收敛为结构化 reason 且不泄漏原错误', async () => {
  const driver = {
    async settle() { return { settled: true, waitedMs: 0 }; },
    async snapshotMainFrame() { throw new Error('synthetic-private-driver-message'); },
  };
  const result = await observePage({ driver, intentId: 'intent_1', maxCandidates: 8 });
  assert(result && result.ok === false && result.reason === 'PAGE_SNAPSHOT_FAILED',
    `snapshot 异常须结构化收敛，实际 ${JSON.stringify(result)}`);
  assert(!JSON.stringify(result).includes('synthetic-private-driver-message'),
    '结构化失败不得回显 adapter 原错误');
});

// sourceObligationId:zs-observe-a7 unitCheckId:page-observer-main-frame-a7
await check('page-observer-main-frame-a7', 'settle 抛错时结构化 fail-closed 且 action adapter 零调用', async () => {
  const { driver, control } = createPageDriverDouble({
    affordances: [syntheticAffordance()],
  });
  driver.settle = async () => {
    control.calls.settle += 1;
    throw new Error('synthetic-private-settle-message');
  };
  const result = await observePage({ driver, intentId: 'intent_1', maxCandidates: 8 });
  assert(result && result.ok === false && result.reason === 'PAGE_SETTLE_FAILED',
    `settle 异常须结构化拒绝，实际 ${JSON.stringify(result)}`);
  assert(!JSON.stringify(result).includes('synthetic-private-settle-message'),
    'settle 失败不得回显 adapter 原错误');
  assert(control.calls.snapshot === 0 && control.calls.revalidate === 0 && control.calls.perform === 0,
    `settle 失败后不得继续观察/重验/执行，实际 ${JSON.stringify(control.calls)}`);
});

// sourceObligationId:zs-observe-a8 unitCheckId:page-observer-main-frame-a8
await check('page-observer-main-frame-a8', 'revalidate 抛错时结构化 fail-closed 且 action adapter 零调用', async () => {
  const { driver, control } = createPageDriverDouble({
    affordances: [syntheticAffordance({ pageCount: 1 })],
    revalidateError: new Error('synthetic-private-revalidate-message'),
  });
  const observed = await observePage({ driver, intentId: 'intent_1', maxCandidates: 8 });
  observationJson(observed);
  const result = await revalidateAffordance({
    authority: observed.authority,
    affordanceId: observed.observation.affordances[0].affordanceId,
  });
  assert(result && result.ok === false && result.reason === 'AFFORDANCE_REVALIDATION_FAILED',
    `revalidate 异常须结构化拒绝，实际 ${JSON.stringify(result)}`);
  assert(!JSON.stringify(result).includes('synthetic-private-revalidate-message'),
    'revalidate 失败不得回显 adapter 原错误');
  assert(control.calls.revalidate === 1 && control.calls.perform === 0,
    `revalidate 异常只准重验一次且不得执行，实际 ${JSON.stringify(control.calls)}`);
});

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.error(`\npage-observer-main-frame: ${passed} passed, ${failures.length} failed`);
  process.exit(1);
}

console.log(`\npage-observer-main-frame: ${passed}/8 passed`);
