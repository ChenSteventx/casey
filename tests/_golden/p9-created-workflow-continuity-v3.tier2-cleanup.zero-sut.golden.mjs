#!/usr/bin/env node
// P9 Tier2 环境清洁面：业务 verdict 不得洗绿 cleanup，fresh batch token 与三例 lineage 必须闭合。
// 零 SUT、零浏览器、零网络、零子进程。

import { readFileSync } from 'node:fs';
import * as tier2 from '../../lib/selftest-tier2.mjs';

const failures = [];
let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { const message = String(error?.message || error); failures.push(`${name}: ${message}`); console.error(`FAIL ${name}: ${message}`); }
}
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const clone = (value) => JSON.parse(JSON.stringify(value));
function judge() {
  assert(typeof tier2.judgeTier2CleanupObligations === 'function', '缺生产导出 judgeTier2CleanupObligations');
  return tier2.judgeTier2CleanupObligations;
}

const CASE_IDS = ['tc_catalog_wf_crud', 'tc_wf_publish_states', 'tc_wf_history_version'];
const BATCH = 'batch-fixture-v3';
const BATCH_TOKEN = 'batch-token-fixture-v3';
const perCaseToken = (index) => `${BATCH_TOKEN}-case-${index + 1}`;
function base(verdicts = ['PASS', 'PASS', 'PASS']) {
  return {
    batchId: BATCH,
    batchToken: BATCH_TOKEN,
    priorBatchTokens: ['prior-batch-token'],
    mutationCaseIds: CASE_IDS,
    receipts: CASE_IDS.map((caseId, index) => ({
      caseId,
      batchId: BATCH,
      batchToken: BATCH_TOKEN,
      uniqueNameToken: perCaseToken(index),
      derivedEntityName: `atl_${perCaseToken(index)}`,
      receiptClass: 'pipeline_complete_with_verdict',
      verdict: verdicts[index],
      cleanupSatisfied: true,
    })),
  };
}

test('T1 三条 mutation receipt cleanupSatisfied 全真且 batch lineage 闭合才绿', () => {
  const result = judge()(base());
  assert(result?.ok === true && result.cleanupSatisfied === true, `清洁面正控失败：${JSON.stringify(result)}`);
  assert(result.satisfiedCount === 3, '清洁面未逐三例计数');
  const receipts = base().receipts;
  assert(receipts.every((row) => row.batchToken === BATCH_TOKEN)
    && new Set(receipts.map((row) => row.uniqueNameToken)).size === 3, '正控未形成一批三枚 per-case token');
});

test('T2 合法 SUT_DEFECT/NEEDS_HUMAN 不误红，但不能替代 cleanupSatisfied', () => {
  const good = base(['SUT_DEFECT', 'NEEDS_HUMAN', 'PASS']);
  assert(judge()(good)?.ok === true, '业务性非 PASS 在 cleanup 全真时被误杀');
  for (const cleanupValue of [false, undefined]) {
    const bad = clone(good);
    if (cleanupValue === undefined) delete bad.receipts[1].cleanupSatisfied;
    else bad.receipts[1].cleanupSatisfied = cleanupValue;
    const result = judge()(bad);
    assert(result?.ok === false && result.cleanupSatisfied === false, `业务 verdict 洗绿 cleanup：${JSON.stringify(result)}`);
  }
});

test('T3 三例缺一、多一、重复或 caseId 换线均红', () => {
  const attacks = [];
  const missing = base(); missing.receipts.pop(); attacks.push(missing);
  const extra = base(); extra.receipts.push({ ...extra.receipts[0], caseId: 'tc_extra_fixture' }); attacks.push(extra);
  const duplicate = base(); duplicate.receipts[2] = clone(duplicate.receipts[1]); attacks.push(duplicate);
  const swapped = base(); [swapped.receipts[0].derivedEntityName, swapped.receipts[1].derivedEntityName] = [swapped.receipts[1].derivedEntityName, swapped.receipts[0].derivedEntityName]; attacks.push(swapped);
  for (const attack of attacks) assert(judge()(attack)?.ok === false, `坏成员/lineage 被洗绿：${JSON.stringify(attack.receipts)}`);
});

test('T4 每个 fresh batch 使用新 batchToken，三例 per-case uniqueNameToken 两两不同且由它派生', () => {
  const old = base(); old.batchToken = 'prior-batch-token'; old.receipts.forEach((r, index) => { r.batchToken = old.batchToken; r.uniqueNameToken = `${old.batchToken}-case-${index + 1}`; });
  const drift = base(); drift.receipts[1].uniqueNameToken = 'other-token';
  const collision = base(); collision.receipts[2].uniqueNameToken = collision.receipts[1].uniqueNameToken;
  const wrongBatch = base(); wrongBatch.receipts[2].batchId = 'other-batch';
  for (const attack of [old, drift, collision, wrongBatch]) assert(judge()(attack)?.ok === false, `旧/漂移 batch/per-case token 被洗绿：${JSON.stringify(attack)}`);
});

test('T5 三例由 batch token 派生的实体名必须非空且互不冲突', () => {
  const collision = base(); collision.receipts[2].derivedEntityName = collision.receipts[1].derivedEntityName;
  const missing = base(); delete missing.receipts[0].derivedEntityName;
  for (const attack of [collision, missing]) assert(judge()(attack)?.ok === false, `派生名碰撞/缺席被洗绿：${JSON.stringify(attack.receipts)}`);
});

test('T6 runTier2 必须深消费 cleanup judge，不能只产孤立 helper', () => {
  const source = readFileSync(new URL('../../lib/selftest-tier2.mjs', import.meta.url), 'utf8');
  const occurrences = source.match(/judgeTier2CleanupObligations\s*\(/g) || [];
  assert(occurrences.length >= 2, `cleanup judge 未定义并由 runTier2 调用，实得调用形 ${occurrences.length} 处`);
  const runBody = source.slice(source.indexOf('export function runTier2'));
  assert(runBody.includes('cleanupSatisfied') && runBody.includes('judgeTier2CleanupObligations'), 'runTier2 未把 cleanup 结果纳入退出码聚合');
});

if (failures.length) {
  console.error(`RED  p9-created-workflow-continuity-v3.tier2-cleanup: ${passed} 过 / ${failures.length} 红`);
  process.exit(1);
}
console.log(`ok   p9-created-workflow-continuity-v3.tier2-cleanup: ${passed}/${passed} 全过`);
