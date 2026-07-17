#!/usr/bin/env node
// zero-SUT：active-suite v2 的所有执行事实只从 JSON 读取。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const suite = JSON.parse(readFileSync(new URL('./fixtures/observation-runtime-trust-root/active-suite-v2.json', import.meta.url), 'utf8'));
function readJson(relativePath) { return JSON.parse(readFileSync(join(ROOT, relativePath), 'utf8')); }
function runProfile(profile) {
  const args = [];
  if (profile.loader) args.push('--experimental-loader', join(ROOT, profile.loader));
  args.push(join(ROOT, profile.test));
  const result = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', timeout: 30000 });
  if (result.error) throw result.error;
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}
function assertIds(output, prefix, ids, label) {
  if (!Array.isArray(ids) || ids.length === 0) throw new Error(`${label} ids 为空`);
  for (const id of ids) if (!output.includes(`${prefix} ${id} `)) throw new Error(`${label} 缺 ${prefix.trim()} ${id}`);
}

if (suite?.schemaVersion !== 2 || !Array.isArray(suite.activePrds) || suite.activePrds.length === 0
  || !Array.isArray(suite.historicalPrds) || suite.historicalPrds.length === 0) throw new Error('active/historical PRD 列表不闭合');
const activePrds = new Map(suite.activePrds.map((path) => [path, readJson(path)]));
for (const path of suite.historicalPrds) readJson(path);

for (const [name, profile] of Object.entries(suite.executionProfiles || {})) {
  if (!Number.isSafeInteger(profile.expectedPassed) || !Number.isSafeInteger(profile.expectedFailed)
    || profile.expectedPassed < 0 || profile.expectedFailed < 0) throw new Error(`${name} expected counts 非法`);
  const result = runProfile(profile);
  const summary = `${profile.expectedPassed} 过 / ${profile.expectedFailed} 失败`;
  if (result.status !== profile.expectedExit || !result.output.includes(summary)) {
    throw new Error(`${name} 非 JSON 声明的精确结果：exit=${result.status}; summary=${summary}`);
  }
  assertIds(result.output, 'ok  ', profile.retainedAssertions, `${name} retained`);
  assertIds(result.output, 'FAIL', profile.supersededAssertions, `${name} superseded`);
}

const revocation = readJson(suite.revocationReceipt);
const receiptPaths = revocation.revoked.map((entry) => entry.executablePath).sort();
const suitePaths = [...suite.revokedExecutablesNeverRun].sort();
if (JSON.stringify(receiptPaths) !== JSON.stringify(suitePaths)) throw new Error('revoked paths 与 receipt 不精确一致');

const replacementEntries = Object.entries(suite.replacementMap || {});
if (replacementEntries.length === 0) throw new Error('replacementMap 为空');
for (const [assertionId, replacements] of replacementEntries) {
  if (!Array.isArray(replacements) || replacements.length === 0) throw new Error(`${assertionId} replacement 数组为空`);
  for (const replacement of replacements) {
    const prd = activePrds.get(replacement.prd);
    if (!prd) throw new Error(`${assertionId} replacement 未指向 active PRD`);
    const story = prd.stories?.find((item) => item.id === replacement.storyId);
    if (!story || story.passes !== true) throw new Error(`${assertionId} replacement story 不存在或未绿`);
    if (!Array.isArray(story.acceptance) || !story.acceptance.includes(`node ${replacement.testPath}`)) {
      throw new Error(`${assertionId} replacement test 不属于 story acceptance`);
    }
  }
}
console.log('observation active-suite contract v2: 3/3 passed');

