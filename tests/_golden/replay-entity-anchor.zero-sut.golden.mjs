#!/usr/bin/env node
// 纯函数/静态门：禁止浏览器、网络、SUT、fixture。
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { projectReplayAssertion, validateReplayEntityAnchors } from '../../lib/replay-entity-anchor.mjs';

const root = resolve(import.meta.dirname, '../..');
let passed = 0;
function check(ok, label) {
  if (!ok) throw new Error(label);
  passed += 1;
}

const cleanupEvents = (target = 'atl_{{uniqueName}}') => [
  { stepId: 's0', intentId: 'cleanup', atom: 'workflow.deleteByName', action: 'nav' },
  { stepId: 's1', intentId: 'cleanup', atom: 'workflow.deleteByName', action: 'fill', value: target },
  { stepId: 's2', intentId: 'cleanup', atom: 'workflow.deleteByName', action: 'press', key: 'Enter' },
  { stepId: 's3', intentId: 'cleanup', atom: 'workflow.deleteByName', action: 'click', text: '删除', value: target },
  { stepId: 's4', intentId: 'cleanup', atom: 'workflow.deleteByName', action: 'click', text: '确定', value: target },
  { stepId: 's5', intentId: 'cleanup', atom: 'workflow.deleteByName', action: 'fill', value: target },
  { stepId: 's6', intentId: 'cleanup', atom: 'workflow.deleteByName', action: 'press', key: 'Enter' },
];
const expected = (extra = []) => ({
  intents: [{ intentId: 'cleanup', expected: [
    { kind: 'countChange', op: 'equals', value: 0, signedAt: 'x', signedAgainstBuild: 'x', signerId: 'x' },
    ...extra,
  ] }],
  globalAssertions: [],
});
const templatedProfile = { countSelector: '.hr-card.hr-card--bordered:has-text("atl_{{uniqueName}}")' };
const ctx = { uniqueName: 'r2' };

const profileBefore = JSON.stringify(templatedProfile);
const expectedDoc = expected([{ kind: 'textVisible', op: 'appears', value: 'atl_{{uniqueName}}', signedAt: 'x', signedAgainstBuild: 'x', signerId: 'x' }]);
const expectedBefore = JSON.stringify(expectedDoc);
const good = validateReplayEntityAnchors({ events: cleanupEvents(), expectedDoc, profile: templatedProfile, ctx });
check(good.ok, '模板 selector 与模板 expected 应通过');
check(good.countSelector.includes('atl_r2') && !good.countSelector.includes('{{uniqueName}}'), '本轮 selector 应投影到 r2');
check(JSON.stringify(templatedProfile) === profileBefore && JSON.stringify(expectedDoc) === expectedBefore, '冻结 profile/expected 不得被改写');

const stale = validateReplayEntityAnchors({
  events: cleanupEvents(), expectedDoc: expected(),
  profile: { countSelector: '.hr-card.hr-card--bordered:has-text("atl_r1")' }, ctx,
});
check(!stale.ok && stale.problems.some((p) => p.reason === 'cleanup_count_selector_target_mismatch'), 'r1 selector 配 r2 运行必须拒绝');

const missing = validateReplayEntityAnchors({ events: cleanupEvents(), expectedDoc: expected(), profile: {}, ctx });
check(!missing.ok && missing.problems.some((p) => p.reason === 'cleanup_count_selector_missing'), 'cleanup 硬归零不得退默认全表 selector');

const unresolved = validateReplayEntityAnchors({
  events: cleanupEvents(), expectedDoc: expected(),
  profile: { countSelector: '.hr-card:has-text("atl_{{otherName}}")' }, ctx,
});
check(!unresolved.ok && unresolved.problems.some((p) => p.reason === 'cleanup_count_selector_unresolved'), '未知实体模板必须拒绝');

const oneSearch = cleanupEvents().filter((ev) => ev.stepId !== 's5');
const notRepeated = validateReplayEntityAnchors({ events: oneSearch, expectedDoc: expected(), profile: templatedProfile, ctx });
check(!notRepeated.ok && notRepeated.problems.some((p) => p.reason === 'cleanup_search_target_not_repeated'), '缺删除后同目标重搜必须拒绝');

const bothSearchesBeforeDelete = [
  ...cleanupEvents().slice(0, 3),
  { stepId: 's2b', intentId: 'cleanup', atom: 'workflow.deleteByName', action: 'fill', value: 'atl_{{uniqueName}}' },
  ...cleanupEvents().slice(3, 5),
];
const notOrdered = validateReplayEntityAnchors({
  events: bothSearchesBeforeDelete, expectedDoc: expected(), profile: templatedProfile, ctx,
});
check(!notOrdered.ok && notOrdered.problems.some((p) => p.reason === 'cleanup_search_target_not_ordered'), '两次重搜都在删除前不得冒充删除后复核');

const bothSearchesAfterDelete = [
  cleanupEvents()[0],
  ...cleanupEvents().slice(3, 6),
  { stepId: 's5b', intentId: 'cleanup', atom: 'workflow.deleteByName', action: 'fill', value: 'atl_{{uniqueName}}' },
];
const noPreDeleteSearch = validateReplayEntityAnchors({
  events: bothSearchesAfterDelete, expectedDoc: expected(), profile: templatedProfile, ctx,
});
check(!noPreDeleteSearch.ok && noPreDeleteSearch.problems.some((p) => p.reason === 'cleanup_search_target_not_ordered'), '两次重搜都在删除后不得冒充删除前实体锚');

const splitClick = cleanupEvents().map((ev) => ev.stepId === 's4' ? { ...ev, value: 'atl_other' } : ev);
const split = validateReplayEntityAnchors({ events: splitClick, expectedDoc: expected(), profile: templatedProfile, ctx });
check(!split.ok && split.problems.some((p) => p.reason === 'cleanup_delete_target_not_unique'), '删除与确认目标分裂必须拒绝');

const staleExpected = validateReplayEntityAnchors({
  events: cleanupEvents(),
  expectedDoc: expected([{ kind: 'textVisible', op: 'appears', value: 'atl_r1', signedAt: 'x', signedAgainstBuild: 'x', signerId: 'x' }]),
  profile: templatedProfile,
  ctx,
});
check(!staleExpected.ok && staleExpected.problems.some((p) => p.reason === 'cleanup_expected_anchor_target_mismatch'), 'cleanup expected 的陈旧实体锚必须拒绝');

const projectedAssertion = projectReplayAssertion({ kind: 'textVisible', value: '实体 atl_{{uniqueName}} 已删除' }, ctx);
check(projectedAssertion.value === '实体 atl_r2 已删除', '断言模板应只在本轮派生副本中实例化');

const unrelated = validateReplayEntityAnchors({
  events: cleanupEvents(),
  expectedDoc: { intents: [{ intentId: 'cleanup', expected: [{ kind: 'textVisible', op: 'appears', value: '删除成功' }] }] },
  profile: {},
  ctx,
});
check(unrelated.ok, '没有硬归零断言时不得强迫目标计数 selector');

const replaySource = readFileSync(resolve(root, 'bin/replay.mjs'), 'utf8');
const gateAt = replaySource.indexOf('validateReplayEntityAnchors({ events, expectedDoc, profile, ctx })');
const browserAt = replaySource.indexOf('await chromium.launch');
check(gateAt > 0 && browserAt > gateAt, '实体锚闸必须位于浏览器启动前');

console.log(`replay entity anchor zero-SUT: PASS ${passed}/14`);
