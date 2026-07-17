#!/usr/bin/env node
// zero-SUT coverage-freeze：从 active-suite v2 自身派生 replacement 完整集合，不另写业务 id 真值。
import { readFileSync } from 'node:fs';

const suite = JSON.parse(readFileSync(new URL('./fixtures/observation-runtime-trust-root/active-suite-v2.json', import.meta.url), 'utf8'));
const profiles = Object.values(suite.executionProfiles || {});
if (profiles.length === 0) throw new Error('executionProfiles 为空');
const superseded = new Set();
for (const profile of profiles) {
  const retained = profile.retainedAssertions;
  const replaced = profile.supersededAssertions;
  if (!Array.isArray(retained) || !Array.isArray(replaced)
    || profile.expectedPassed !== retained.length || profile.expectedFailed !== replaced.length) {
    throw new Error('expected counts 与 assertion arrays 不精确一致');
  }
  if (new Set(retained).size !== retained.length || new Set(replaced).size !== replaced.length
    || retained.some((id) => replaced.includes(id))) throw new Error('profile assertion ids 重复或交叉');
  for (const id of replaced) superseded.add(id);
}
const replacementIds = Object.keys(suite.replacementMap || {});
if (JSON.stringify([...superseded].sort()) !== JSON.stringify(replacementIds.sort())) {
  throw new Error('replacement map 未精确覆盖全部 superseded assertions');
}
for (const replacements of Object.values(suite.replacementMap)) {
  for (const entry of replacements) {
    const keys = Object.keys(entry).sort();
    if (keys.join(',') !== 'prd,storyId,testPath') throw new Error('replacement entry 非闭合三元组');
  }
}
if (new Set(suite.activePrds).size !== suite.activePrds.length
  || new Set(suite.historicalPrds).size !== suite.historicalPrds.length
  || suite.activePrds.some((path) => suite.historicalPrds.includes(path))) {
  throw new Error('active/historical PRD 列表重复或交叉');
}
console.log('observation active-suite v2 map closure: 3/3 passed');
