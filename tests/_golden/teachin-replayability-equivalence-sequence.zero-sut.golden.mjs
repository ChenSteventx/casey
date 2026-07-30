#!/usr/bin/env node
// staged 两相 source → resolved semantic → atom → distilled → compare 顺序门。

import {
  api,
  assert,
  buildHappy,
  expectOk,
  expectReason,
  loadFailure,
  ready,
} from './support/teachin-replayability-equivalence-harness.mjs';

const TAG = 'teachin-replayability-equivalence-sequence';
const failures = [];
let passed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${TAG}: ${name}`);
  } catch (error) {
    const message = String(error?.message || error).slice(-900);
    failures.push(`${name}: ${message}`);
    console.error(`RED  ${TAG}: ${name}: ${message}`);
  }
}

if (!ready) failures.push(`production API unavailable: ${loadFailure || 'FROZEN_API_MISSING'}`);

if (ready) {
  await check('S1 source raw + distilled formal 两 evidence replay，另有 authoring 物理链', async () => {
    const built = await buildHappy('s1');
    assert(built.stats.rawReplay === 1
      && built.stats.atomRoundtrip === 1
      && built.stats.compiledReplay === 1
      && built.stats.axes === 2
      && built.stats.verdict === 2
      && built.stats.authoringOpen === 1
      && built.stats.authoringReset === 1
      && built.stats.createCompileRun === 1
      && built.stats.compileFlow === 1
      && built.stats.distilledOpen === 1,
    `调用次数不闭合：${JSON.stringify(built.stats)}`);
    assert(built.sourceOwners.closeCalls === 1,
      'distilled fresh 前 exact source runtime 必须关闭恰一次');
    assert(built.stats.authoringOwners?.closeCalls === 1,
      'authoring compile runtime 必须在 distilled launch 前关闭恰一次');
    assert(built.stats.authoringNamespace !== built.stats.distilledNamespace,
      'authoring 与 formal distilled namespace 必须独立');
    const compared = api.compareSemanticReplayReceipts({
      pairAuthority: built.finalized.pairAuthority,
      sourceReceiptBytes: built.sourceReceipt.bytes,
      sourceReceiptAuthority: built.sourceReceipt.authority,
      sourceComparisonGrant: built.sourceComparison.grant,
      distilledReceiptBytes: built.distilledReceipt.bytes,
      distilledReceiptAuthority: built.distilledReceipt.authority,
      distilledComparisonGrant: built.distilledComparison.grant,
    });
    assert(compared?.ok === true && compared.equivalent === true
      && compared.promotionEligible === true,
    `合法 staged pair 应等价：${JSON.stringify(compared)}`);
    expectOk(await built.adapter.closeReplayRuntimeOwners({
      runtimeOwnerAuthority: built.distilledCompleted.distilledRuntimeOwnerAuthority,
    }), 'distilled owner close after compare');
    assert(built.stats.distilledOwners?.closeCalls === 1,
      'deterministic compare 后 distilled runtime 必须关闭恰一次');
  });

  await check('S2 invalid source plan 首错优先且不读取 downstream candidate', () => {
    let candidateReads = 0;
    const poisonCandidate = Object.create(null);
    Object.defineProperty(poisonCandidate, 'candidateBytes', {
      enumerable: true,
      get() { candidateReads += 1; throw new Error('POISON_CANDIDATE_READ'); },
    });
    expectReason(api.finalizeDualReplayPlanAuthority({
      sourcePlanAuthority: Object.freeze(Object.create(null)),
      sourceCompletionAuthority: Object.freeze(Object.create(null)),
      distilledCandidateAuthority: poisonCandidate,
    }), 'SOURCE_REPLAY_PLAN_AUTHORITY_INVALID', 'source plan first error');
    assert(candidateReads === 0, '首错失败不得读取 downstream candidate');
  });

  await check('S3 receipt multi-read，但 predecessor/comparison grants 各自 one-shot', async () => {
    const built = await buildHappy('s3');
    assert(api.validateSemanticReplayReceipt(built.sourceReceipt.receipt)?.ok === true,
      'direct receipt schema 第一次读取应成功');
    assert(api.validateSemanticReplayReceipt(built.sourceReceipt.receipt)?.ok === true,
      'receipt 读取不是授权消费，可重复');
    expectReason(api.issuePredecessorGrant({
      receiptAuthority: built.sourceReceipt.authority,
    }), 'RECEIPT_AUTHORITY_INVALID', '第二份 predecessor grant');
    expectReason(api.issueComparisonGrant({
      receiptAuthority: built.sourceReceipt.authority,
    }), 'RECEIPT_AUTHORITY_INVALID', '第二份 comparison grant');
    expectOk(await built.adapter.closeReplayRuntimeOwners({
      runtimeOwnerAuthority: built.distilledCompleted.distilledRuntimeOwnerAuthority,
    }), 's3 distilled close');
  });
}

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  for (const failure of failures) console.error(`  FAIL ${failure}`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
