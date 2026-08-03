#!/usr/bin/env node
// P9 workflow cleanup：同一平台 ID 在 >=3000ms、>=3 个完整样本中稳定缺席。
// 零 SUT、零浏览器、零网络、零子进程。

import * as continuity from '../../lib/entity-destructive-continuity.mjs';

const failures = [];
let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { const message = String(error?.message || error); failures.push(`${name}: ${message}`); console.error(`FAIL ${name}: ${message}`); }
}
const assert = (condition, message) => { if (!condition) throw new Error(message); };
function evaluator() {
  assert(typeof continuity.evaluateStableTargetAbsence === 'function', '缺生产导出 evaluateStableTargetAbsence');
  return continuity.evaluateStableTargetAbsence;
}
const PID = '9223372036854775807';
const clean = (observedAtMs) => ({
  observedAtMs,
  scanComplete: true,
  correlatable: true,
  presentPlatformIds: ['other-fixture-id'],
});
const input = (samples) => ({ ref: { platformId: PID }, samples, minWindowMs: 3000, minCompleteSamples: 3 });

test('A1 三个完整样本跨足 3000ms 且同 ID 均缺席才 cleanupSatisfied', () => {
  const result = evaluator()(input([clean(1000), clean(2500), clean(4000)]));
  assert(result?.proven === true && result.cleanupSatisfied === true, `稳定缺席正控失败：${JSON.stringify(result)}`);
  assert(result.sampleCount === 3 && result.windowMs === 3000, '稳定窗口计数/时长未机械投影');
});

test('A2 样本不足三个一律不成立', () => {
  const result = evaluator()(input([clean(1000), clean(4000)]));
  assert(result?.proven === false && result.cleanupSatisfied === false, `两样本被洗绿：${JSON.stringify(result)}`);
});

test('A3 三样本但窗口不足 3000ms 一律不成立', () => {
  const result = evaluator()(input([clean(1000), clean(2000), clean(3999)]));
  assert(result?.proven === false && result.cleanupSatisfied === false, `短窗口被洗绿：${JSON.stringify(result)}`);
});

test('A4 时间不单调或重复时间不能冒充稳定窗口', () => {
  for (const samples of [[clean(1000), clean(4000), clean(2500)], [clean(1000), clean(1000), clean(4000)]]) {
    const result = evaluator()(input(samples));
    assert(result?.proven === false && result.cleanupSatisfied === false, `非单调样本被洗绿：${JSON.stringify(result)}`);
  }
});

test('A5 任一样本扫描不完整或不可关联均不成立', () => {
  for (const patch of [{ scanComplete: false }, { correlatable: false }]) {
    const samples = [clean(1000), { ...clean(2500), ...patch }, clean(4000)];
    const result = evaluator()(input(samples));
    assert(result?.proven === false && result.cleanupSatisfied === false, `坏完整性样本被洗绿：${JSON.stringify(result)}`);
  }
});

test('A6 同一 ID 在任一样本重现即不成立', () => {
  const samples = [clean(1000), { ...clean(2500), presentPlatformIds: [PID] }, clean(4000)];
  const result = evaluator()(input(samples));
  assert(result?.proven === false && result.cleanupSatisfied === false, `目标重现被洗绿：${JSON.stringify(result)}`);
});

test('A7 只有 nameCount=0、没有逐样本 platform IDs 时不成立', () => {
  const samples = [1000, 2500, 4000].map((observedAtMs) => ({ observedAtMs, scanComplete: true, correlatable: true, nameCount: 0 }));
  const result = evaluator()(input(samples));
  assert(result?.proven === false && result.cleanupSatisfied === false, `名称归零冒充 ID 缺席：${JSON.stringify(result)}`);
});

test('A8 target platformId 缺失或非字符串时不成立', () => {
  for (const platformId of [undefined, '', Number(PID)]) {
    const result = evaluator()({ ...input([clean(1000), clean(2500), clean(4000)]), ref: { platformId } });
    assert(result?.proven === false && result.cleanupSatisfied === false, `坏 target ID 被洗绿：${JSON.stringify(result)}`);
  }
});

if (failures.length) {
  console.error(`RED  p9-created-workflow-continuity-v3.stable-absence: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   p9-created-workflow-continuity-v3.stable-absence: ${passed}/${passed} 全过`);
