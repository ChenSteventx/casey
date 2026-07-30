#!/usr/bin/env node
// semantic receipt 闭合 schema、四态与 evidence 内部引用。零 SUT/browser/network/LLM。

import { createHash } from 'node:crypto';

const TAG = 'teachin-replayability-equivalence-evidence';
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

function expectOk(result, label) {
  assert(result?.ok === true, `${label} 应成功：${JSON.stringify(result)}`);
  return result;
}

function expectReason(result, reason, label) {
  assert(result?.ok === false && result.reason === reason,
    `${label} 应 ${reason}：${JSON.stringify(result)}`);
  assert(JSON.stringify(Object.keys(result).sort()) === JSON.stringify(['ok', 'reason']),
    `${label} 失败必须 exact-key：${JSON.stringify(result)}`);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function receipt(tag = 'base', verdict = 'PASS', reason = null) {
  const predicate = digest(`${tag}:predicate`);
  const route = digest(`${tag}:route`);
  const identity = digest(`${tag}:identity`);
  return {
    schemaVersion: 1,
    artifactKind: 'semantic-replay-receipt',
    scope: 'read-only-v1',
    pairId: `pair_${tag}`,
    role: 'source',
    runOrdinal: 1,
    runNamespace: `run_source_${tag}`,
    predecessorReceiptSha256: null,
    binding: {
      testcaseSha256: digest(`${tag}:testcase`),
      expectedSha256: digest(`${tag}:expected`),
      expectedObligationsSha256: digest(`${tag}:obligations`),
      candidateSha256: digest(`${tag}:candidate`),
      eventsSha256: digest(`${tag}:events`),
      axesSha256: digest(`${tag}:axes`),
      verdictSha256: digest(`${tag}:verdict`),
      entityLockSetSha256: digest(`${tag}:locks`),
      executionTargetAttestationSha256: digest(`${tag}:target`),
      sutBuildDigest: digest(`${tag}:build`),
      channelProfileDigest: digest(`${tag}:channel`),
      identityProfileDigest: digest(`${tag}:identity-profile`),
      replayKernelDigest: digest(`${tag}:kernel`),
      resetPlanDigest: digest(`${tag}:reset-plan`),
      sessionPolicyDigest: digest(`${tag}:session-policy`),
    },
    freshness: {
      resetReceiptSha256: digest(`${tag}:reset-receipt`),
      baselineProjectionSha256: digest(`${tag}:baseline`),
      lifecycleAttestationSha256: digest(`${tag}:lifecycle`),
    },
    intents: [{ intentId: 'intent_1', verdict, reason }],
    terminalHardPredicates: [{
      intentId: 'intent_1',
      predicateSha256: predicate,
      ok: verdict === 'PASS',
    }],
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

if (api && typeof api.validateSemanticReplayReceipt === 'function') {
  await check('E1 合法 PASS receipt direct schema 可重复验证且不改变对象', () => {
    const input = receipt('e1');
    const before = JSON.stringify(input);
    expectOk(api.validateSemanticReplayReceipt(input), 'first validate');
    expectOk(api.validateSemanticReplayReceipt(input), 'second validate');
    assert(JSON.stringify(input) === before, 'schema validator 不得修改 caller receipt');
  });

  await check('E2 每一层 nested unknown key 与动态/敏感字段都精确拒绝', () => {
    const cases = [
      ['top', (value) => { value.generatedAt = 'POISON_DYNAMIC'; }],
      ['binding', (value) => { value.binding.origin = 'POISON_ORIGIN'; }],
      ['freshness', (value) => { value.freshness.sessionId = 'POISON_SESSION'; }],
      ['intent', (value) => { value.intents[0].actual = 'POISON_ACTUAL'; }],
      ['predicate', (value) => { value.terminalHardPredicates[0].locator = '#secret'; }],
      ['topology', (value) => { value.topology[0].pageId = 'POISON_PAGE'; }],
      ['entity', (value) => { value.entities[0].displayName = 'POISON_NAME'; }],
      ['effect', (value) => { value.effects[0].rawResponse = 'POISON_BODY'; }],
      ['cleanup', (value) => { value.cleanup.url = 'POISON_URL'; }],
    ];
    for (const [label, mutate] of cases) {
      const forged = clone(receipt(`e2_${label}`));
      mutate(forged);
      const result = api.validateSemanticReplayReceipt(forged);
      expectReason(result, 'RECEIPT_SCHEMA_INVALID', label);
      const serialized = JSON.stringify(result);
      assert(!serialized.includes('POISON') && !serialized.includes('#secret'),
        `${label} 失败输出不得回显原值`);
    }
  });

  await check('E3 PASS 与 hard predicate false 即使内部一致也不得 promotion', () => {
    const forged = receipt('e3');
    forged.terminalHardPredicates[0].ok = false;
    expectReason(api.validateSemanticReplayReceipt(forged),
      'TERMINAL_PREDICATE_NOT_SATISFIED', 'PASS + false predicate');
  });

  await check('E4 四态 schema 合法，但未知 verdict/reason 组合 fail-closed', () => {
    for (const [verdict, reason] of [
      ['PASS', null],
      ['SUT_DEFECT', null],
      ['HARNESS_ERROR', null],
      ['NEEDS_HUMAN', 'SUT_DEFECT_OR_STALE'],
      ['NEEDS_HUMAN', 'CASE_DEFECT'],
      ['NEEDS_HUMAN', 'AMBIGUOUS_ACTION'],
      ['NEEDS_HUMAN', 'AFFORDANCE_ABSENT'],
      ['NEEDS_HUMAN', 'INDETERMINATE'],
    ]) {
      expectOk(api.validateSemanticReplayReceipt(receipt(`e4_${verdict}`, verdict, reason)),
        `${verdict} schema`);
    }
    for (const [verdict, reason] of [
      ['UNKNOWN', null],
      ['PASS', 'INDETERMINATE'],
      ['SUT_DEFECT', 'SHOULD_BE_NULL'],
      ['HARNESS_ERROR', 'SHOULD_BE_NULL'],
      ['NEEDS_HUMAN', null],
      ['NEEDS_HUMAN', 'UNKNOWN_REASON'],
    ]) {
      expectReason(api.validateSemanticReplayReceipt(receipt(
        `e4_bad_${verdict}_${String(reason)}`, verdict, reason,
      )), 'RECEIPT_SCHEMA_INVALID', `${verdict}/${reason}`);
    }
  });

  await check('E5 duplicate intent/predicate/topology/entity/effect 全部拒覆盖洗白', () => {
    for (const field of [
      'intents',
      'terminalHardPredicates',
      'topology',
      'entities',
      'effects',
    ]) {
      const forged = receipt(`e5_${field}`);
      forged[field].push(clone(forged[field][0]));
      expectReason(api.validateSemanticReplayReceipt(forged),
        field === 'intents'
          ? 'INTENT_COVERAGE_MISMATCH'
          : field === 'terminalHardPredicates'
            ? 'TERMINAL_PREDICATE_COVERAGE_MISMATCH'
            : 'RECEIPT_SCHEMA_INVALID',
      `duplicate ${field}`);
    }
  });

  await check('E6 effect ref 必须在同 receipt 同 intent 真实存在且不可重复', () => {
    const dangling = receipt('e6_dangling');
    dangling.effects[0].evidenceRefs = [`predicate:${digest('missing')}`];
    expectReason(api.validateSemanticReplayReceipt(dangling),
      'EFFECT_EVIDENCE_MISSING', 'dangling effect ref');

    const duplicate = receipt('e6_duplicate');
    duplicate.effects[0].evidenceRefs.push(duplicate.effects[0].evidenceRefs[0]);
    expectReason(api.validateSemanticReplayReceipt(duplicate),
      'RECEIPT_SCHEMA_INVALID', 'duplicate effect ref');

    const crossIntent = receipt('e6_cross');
    crossIntent.effects[0].evidenceRefs = [
      `predicate:${crossIntent.terminalHardPredicates[0].predicateSha256}`,
    ];
    crossIntent.terminalHardPredicates[0].intentId = 'intent_other';
    expectReason(api.validateSemanticReplayReceipt(crossIntent),
      'TERMINAL_PREDICATE_COVERAGE_MISMATCH', 'cross-intent ref');
  });

  await check('E7 mutation/relation 与 cleanup required 不能混入 read-only-v1', () => {
    for (const effectClass of ['mutation', 'relation', 'destructive']) {
      const forged = receipt(`e7_${effectClass}`);
      forged.effects[0].effectClass = effectClass;
      expectReason(api.validateSemanticReplayReceipt(forged),
        'UNSUPPORTED_EFFECT_CLASS', effectClass);
    }
    const cleanup = receipt('e7_cleanup');
    cleanup.cleanup = {
      required: true,
      status: 'DONE',
      policySha256: digest('e7_cleanup:policy'),
    };
    expectReason(api.validateSemanticReplayReceipt(cleanup),
      'UNSUPPORTED_EFFECT_CLASS', 'cleanup required');
  });
}

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  for (const failure of failures) console.error(`  FAIL ${failure}`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
