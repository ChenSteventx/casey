#!/usr/bin/env node
// genuine pair-bound receipts 的 expected 纵向义务与 comparator fail-closed。
// 零 SUT/browser/network/LLM。

import { createHash } from 'node:crypto';
import {
  buildHappy,
} from './support/teachin-replayability-equivalence-harness.mjs';

const TAG = 'teachin-replayability-equivalence-integrity-semantics';
const failures = [];
let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

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

let api;
try {
  api = await import('../../lib/dual-replay/index.mjs');
} catch (error) {
  failures.push(`production API unavailable: ${String(error?.code || error?.message || error).slice(-500)}`);
}

const digest = (value) => `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;

function expectReason(result, reason, label) {
  assert(Object.keys(result || {}).sort().join(',')
    === 'equivalent,ok,promotionEligible,reason'
    && result?.ok === false && result.equivalent === false
    && result.promotionEligible === false && result.reason === reason,
    `${label} 应 ${reason}：${JSON.stringify(result)}`);
}

function expectEquivalent(result, label) {
  assert(Object.keys(result || {}).sort().join(',')
    === 'equivalenceReceipt,equivalent,ok,promotionEligible'
    && result?.ok === true && result.equivalent === true
    && result.promotionEligible === true && result.equivalenceReceipt,
  `${label} 应返回闭合等价结果：${JSON.stringify(result)}`);
}

function obligations(tag) {
  const predicate = digest(`${tag}:predicate`);
  const route = digest(`${tag}:route`);
  const identity = digest(`${tag}:identity`);
  return {
    intents: ['intent_1'],
    terminalHardPredicates: [{ intentId: 'intent_1', predicateSha256: predicate }],
    topology: [{
      intentId: 'intent_1',
      ordinal: 0,
      kind: 'newpage',
      routeProjectionSha256: route,
    }],
    entities: [{
      intentId: 'intent_1',
      role: 'subject',
      kind: 'agent',
      identitySha256: identity,
    }],
    effects: [{
      intentId: 'intent_1',
      effectClass: 'read',
      evidenceRefs: [
        `predicate:${predicate}`,
        `topology:${route}`,
        `entity:${identity}`,
      ],
      projectionSha256: digest(`${tag}:effect`),
    }],
    cleanup: {
      required: false,
      status: 'NOT_REQUIRED_READ_ONLY',
      policySha256: digest(`${tag}:cleanup`),
    },
  };
}

function evidence(tag, {
  verdict = 'PASS',
  reason = null,
  predicateOk = verdict === 'PASS',
  diagnostics = {},
} = {}) {
  const expected = obligations(tag);
  return {
    intents: [{ intentId: 'intent_1', verdict, reason }],
    terminalHardPredicates: [{
      ...expected.terminalHardPredicates[0],
      ok: predicateOk,
    }],
    topology: [{ ...expected.topology[0], ...diagnostics }],
    entities: [{ ...expected.entities[0] }],
    effects: [{
      ...expected.effects[0],
      evidenceRefs: [...expected.effects[0].evidenceRefs],
    }],
    cleanup: { ...expected.cleanup },
  };
}

function comparisonInput(built, overrides = {}) {
  return {
    pairAuthority: built.finalized.pairAuthority,
    sourceReceiptBytes: built.sourceReceipt.bytes,
    sourceReceiptAuthority: built.sourceReceipt.authority,
    sourceComparisonGrant: built.sourceComparison.grant,
    distilledReceiptBytes: built.distilledReceipt.bytes,
    distilledReceiptAuthority: built.distilledReceipt.authority,
    distilledComparisonGrant: built.distilledComparison.grant,
    ...overrides,
  };
}

async function closeDistilled(built) {
  const closed = await built.adapter.closeReplayRuntimeOwners({
    runtimeOwnerAuthority: built.distilledCompleted.distilledRuntimeOwnerAuthority,
  });
  assert(closed?.ok === true, `distilled owner close 应成功：${JSON.stringify(closed)}`);
}

async function compare(built, overrides = {}) {
  let result;
  try {
    result = api.compareSemanticReplayReceipts(comparisonInput(built, overrides));
  } finally {
    await closeDistilled(built);
  }
  return result;
}

if (api) {
  await check('M1 dynamic locator/page/request/time/event-count 差异被投影掉，六维仍等价', async () => {
    const tag = 'm1';
    const marker = 'DYNAMIC_MARKER_MUST_NOT_ENTER_RECEIPT';
    const built = await buildHappy(tag, {
      expectedObligations: obligations(tag),
      sourceEvidence: evidence(tag, {
        diagnostics: {
          pageId: `${marker}_source_page`,
          openerPageId: `${marker}_source_opener`,
          locator: `${marker}_source_locator`,
          requestId: `${marker}_source_request`,
          timestamp: 11,
          eventCount: 17,
        },
      }),
      distilledEvidence: evidence(tag, {
        diagnostics: {
          pageId: `${marker}_distilled_page`,
          openerPageId: `${marker}_distilled_opener`,
          locator: `${marker}_distilled_locator`,
          requestId: `${marker}_distilled_request`,
          timestamp: 99,
          eventCount: 2,
        },
      }),
    });
    const result = await compare(built);
    expectEquivalent(result, 'dynamic differences');
    assert(!built.sourceReceipt.bytes.toString('utf8').includes(marker)
      && !built.distilledReceipt.bytes.toString('utf8').includes(marker),
    'dynamic marker 不得进入 receipt');
  });

  await check('M2 distilled route/entity/effect/cleanup 错或缺均偏离 signed expected', async () => {
    const cases = [
      ['route', 'TOPOLOGY_MISMATCH', (value) => {
        value.topology[0].routeProjectionSha256 = digest('wrong-route');
      }],
      ['entity', 'ENTITY_MISMATCH', (value) => {
        value.entities[0].identitySha256 = digest('wrong-identity');
      }],
      ['effect', 'EFFECT_MISMATCH', (value) => {
        value.effects[0].projectionSha256 = digest('wrong-effect');
      }],
      ['cleanup', 'CLEANUP_MISMATCH', (value) => {
        value.cleanup.policySha256 = digest('wrong-cleanup');
      }],
      ['route-missing', 'TOPOLOGY_EVIDENCE_MISSING', (value) => {
        value.topology = [];
      }],
      ['entity-missing', 'ENTITY_EVIDENCE_MISSING', (value) => {
        value.entities = [];
      }],
      ['effect-missing', 'EFFECT_EVIDENCE_MISSING', (value) => {
        value.effects = [];
      }],
      ['cleanup-missing', 'CLEANUP_EVIDENCE_MISSING', (value) => {
        delete value.cleanup;
      }],
    ];
    for (const [suffix, reason, mutate] of cases) {
      const tag = `m2_${suffix}`;
      const wrong = evidence(tag);
      mutate(wrong);
      const built = await buildHappy(tag, {
        expectedObligations: obligations(tag),
        sourceEvidence: evidence(tag),
        distilledEvidence: wrong,
        returnDistilledCompletionResult: true,
      });
      expectReason(built.distilledCompletionResult, reason, suffix);
      assert(!built.distilledCompletionResult.completionAuthority,
        `${suffix} 错误不得铸 distilled completion`);
    }
  });

  await check('M3 source/distilled 即使同样走错也不能用 equality 洗白 expected', async () => {
    for (const [suffix, reason, mutate] of [
      ['route', 'TOPOLOGY_MISMATCH', (value) => {
        value.topology[0].routeProjectionSha256 = digest('same-wrong-route');
      }],
      ['entity', 'ENTITY_MISMATCH', (value) => {
        value.entities[0].identitySha256 = digest('same-wrong-identity');
      }],
      ['effect', 'EFFECT_MISMATCH', (value) => {
        value.effects[0].projectionSha256 = digest('same-wrong-effect');
      }],
    ]) {
      const tag = `m3_${suffix}`;
      const sameWrong = evidence(tag);
      mutate(sameWrong);
      const built = await buildHappy(tag, {
        expectedObligations: obligations(tag),
        sourceEvidence: sameWrong,
        distilledEvidence: sameWrong,
        returnSourceCompletionResult: true,
      });
      expectReason(built.sourceCompletionResult, reason, `same wrong ${suffix}`);
    }
  });

  await check('M4 PASS/PASS + predicate false/false 在 source 即拒绝', async () => {
    const tag = 'm4';
    const falsePass = evidence(tag, { verdict: 'PASS', predicateOk: false });
    const built = await buildHappy(tag, {
      expectedObligations: obligations(tag),
      sourceEvidence: falsePass,
      distilledEvidence: falsePass,
      returnSourceCompletionResult: true,
    });
    expectReason(built.sourceCompletionResult,
      'TERMINAL_PREDICATE_NOT_SATISFIED', 'PASS + false');
  });

  await check('M5 三种 non-PASS 即使两边完全相同也不可 promotion', async () => {
    for (const [verdict, reason] of [
      ['SUT_DEFECT', null],
      ['HARNESS_ERROR', null],
      ['NEEDS_HUMAN', 'INDETERMINATE'],
    ]) {
      const tag = `m5_${verdict}`;
      const nonPass = evidence(tag, { verdict, reason, predicateOk: false });
      const built = await buildHappy(tag, {
        expectedObligations: obligations(tag),
        sourceEvidence: nonPass,
        distilledEvidence: nonPass,
        sourceVerdict: { verdict, reason },
        distilledVerdict: { verdict, reason },
      });
      expectReason(await compare(built), 'NON_PROMOTABLE_VERDICT', verdict);
    }
  });

  await check('M6 per-intent verdict/reason 或 predicate ok 两边不同固定首错', async () => {
    const verdictTag = 'm6_verdict';
    const verdictBuilt = await buildHappy(verdictTag, {
      expectedObligations: obligations(verdictTag),
      sourceEvidence: evidence(verdictTag),
      distilledEvidence: evidence(verdictTag, {
        verdict: 'NEEDS_HUMAN',
        reason: 'INDETERMINATE',
        predicateOk: false,
      }),
      distilledVerdict: { verdict: 'NEEDS_HUMAN', reason: 'INDETERMINATE' },
    });
    expectReason(await compare(verdictBuilt), 'INTENT_VERDICT_MISMATCH', 'verdict mismatch');

    const predicateTag = 'm6_predicate';
    const sourceNonPass = evidence(predicateTag, {
      verdict: 'NEEDS_HUMAN',
      reason: 'INDETERMINATE',
      predicateOk: true,
    });
    const distilledNonPass = evidence(predicateTag, {
      verdict: 'NEEDS_HUMAN',
      reason: 'INDETERMINATE',
      predicateOk: false,
    });
    const predicateBuilt = await buildHappy(predicateTag, {
      expectedObligations: obligations(predicateTag),
      sourceEvidence: sourceNonPass,
      distilledEvidence: distilledNonPass,
      sourceVerdict: { verdict: 'NEEDS_HUMAN', reason: 'INDETERMINATE' },
      distilledVerdict: { verdict: 'NEEDS_HUMAN', reason: 'INDETERMINATE' },
    });
    expectReason(await compare(predicateBuilt),
      'TERMINAL_PREDICATE_MISMATCH', 'predicate mismatch');
  });

  await check('M7 genuine cross-pair receipts/grants 拒且不消费 comparison grants', async () => {
    const left = await buildHappy('m7_left');
    const right = await buildHappy('m7_right');
    try {
      expectReason(api.compareSemanticReplayReceipts(comparisonInput(left, {
        distilledReceiptBytes: right.distilledReceipt.bytes,
        distilledReceiptAuthority: right.distilledReceipt.authority,
        distilledComparisonGrant: right.distilledComparison.grant,
      })), 'ROLE_PAIR_INVALID', 'pair A source + pair B distilled');

      for (const [label, built] of [['left', left], ['right', right]]) {
        const result = api.compareSemanticReplayReceipts(comparisonInput(built));
        expectEquivalent(result, `${label} failed cross-pair probe 后 genuine compare`);
      }
    } finally {
      await Promise.all([closeDistilled(left), closeDistilled(right)]);
    }
  });
}

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  for (const failure of failures) console.error(`  FAIL ${failure}`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
