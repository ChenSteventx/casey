#!/usr/bin/env node
// reset adapter 内外 receipt 交叉校验与失败 hygiene。零 SUT/browser/network/LLM。

import { createHash } from 'node:crypto';
import { resolveExecutionTarget } from '../../lib/execution-target/authority.mjs';

const TAG = 'teachin-replayability-equivalence-reset';
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
    const message = String(error?.message || error).slice(-800);
    failures.push(`${name}: ${message}`);
    console.error(`RED  ${TAG}: ${name}: ${message}`);
  }
}

let api;
let resetApi;
let captureApi;
try {
  [api, resetApi, captureApi] = await Promise.all([
    import('../../lib/dual-replay/index.mjs'),
    import('../../lib/dual-replay/run-authority.mjs'),
    import('../../lib/teachin/raw-capture.mjs'),
  ]);
} catch (error) {
  failures.push(`production API unavailable: ${String(error?.code || error?.message || error).slice(-500)}`);
}

const digest = (value) => `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;
const bytes = (value) => Buffer.from(JSON.stringify(value));

function expectOk(result, label) {
  assert(result?.ok === true, `${label} 应成功：${JSON.stringify(result)}`);
  return result;
}

function expectReason(result, reason, label) {
  assert(result?.ok === false && result.reason === reason && !result.authority,
    `${label} 应 ${reason} 且不铸权：${JSON.stringify(result)}`);
  assert(JSON.stringify(Object.keys(result).sort()) === JSON.stringify(['ok', 'reason']),
    `${label} 失败输出必须 exact-key：${JSON.stringify(result)}`);
}

function createPlan(tag) {
  const execution = expectOk(resolveExecutionTarget({
    runtime: { platform: 'linux', isWSL: false },
    logicalTarget: { startUrl: `https://${tag}.synthetic.invalid/home` },
    transport: { mode: 'direct' },
    requiresOriginContinuity: true,
  }), 'execution target');
  const captureBytes = bytes({
    schemaVersion: 1,
    artifactKind: 'teach-in-capture',
    caseId: `tc_${tag}`,
    createdAt: '2026-07-27T00:00:00.000Z',
    startPath: '/home',
    source: {
      kind: 'manual',
      signed: false,
      replayReady: false,
      distillRequired: true,
    },
    events: [{ seq: 1, action: 'nav', path: '/home' }],
  });
  const admitted = expectOk(captureApi.admitRawReplayCapture({
    caseId: `tc_${tag}`,
    captureBytes,
  }), 'capture');
  const predicate = digest(`${tag}:predicate`);
  return expectOk(api.createSourceReplayPlanAuthority({
    pairId: `pair_${tag}`,
    testcaseBytes: bytes({ caseId: `tc_${tag}`, intents: ['intent_1'] }),
    expectedBytes: bytes({ expected: ['predicate'] }),
    expectedObligations: {
      intents: ['intent_1'],
      terminalHardPredicates: [{ intentId: 'intent_1', predicateSha256: predicate }],
      topology: [],
      entities: [],
      effects: [{
        intentId: 'intent_1',
        effectClass: 'read',
        evidenceRefs: [`predicate:${predicate}`],
        projectionSha256: digest(`${tag}:effect`),
      }],
      cleanup: {
        required: false,
        status: 'NOT_REQUIRED_READ_ONLY',
        policySha256: digest(`${tag}:cleanup`),
      },
    },
    sutBuildDigest: digest(`${tag}:build`),
    channelProfileDigest: digest(`${tag}:channel`),
    identityProfileDigest: digest(`${tag}:identity`),
    replayKernelDigest: digest(`${tag}:kernel`),
    resetPlanDigest: digest(`${tag}:reset-plan`),
    sessionPolicyDigest: digest(`${tag}:session-policy`),
    executionTargetAuthority: execution.authority,
    source: {
      captureAuthority: admitted.captureAuthority,
      candidateBytes: bytes({ tag, candidate: 'source' }),
      eventsBytes: captureBytes,
      entityLockBytes: bytes({ tag, locks: [] }),
      runNamespace: `run_source_${tag}`,
    },
  }), 'source plan');
}

function facts(tag, overrides = {}) {
  const resetPlanDigest = digest(`${tag}:reset-plan`);
  const baselineProjectionSha256 = digest(`${tag}:baseline`);
  const receipt = {
    schemaVersion: 1,
    artifactKind: 'dual-replay-reset-receipt',
    pairId: `pair_${tag}`,
    role: 'source',
    runNamespace: `run_source_${tag}`,
    receiptInstanceId: `reset_${tag}_source`,
    resetPlanDigest,
    baselineProjectionSha256,
    ...(overrides.receipt || {}),
  };
  return {
    resetReceiptBytes: bytes(receipt),
    resetPlanDigest,
    baselineProjectionSha256,
    ...overrides.outer,
  };
}

function createReset(tag, plan, trustedResetIssuer) {
  return resetApi.createResetAuthority({
    replayPlanAuthority: plan.authority,
    role: 'source',
    runNamespace: `run_source_${tag}`,
    trustedResetIssuer,
  });
}

if (api && resetApi && captureApi
  && typeof api.createSourceReplayPlanAuthority === 'function'
  && typeof resetApi.createResetAuthority === 'function') {
  await check('R1 verifyReset 恰调用一次并收到 exact plan/role/namespace', () => {
    const tag = 'r1';
    const plan = createPlan(tag);
    const calls = [];
    const accepted = expectOk(createReset(tag, plan, {
      verifyReset(request) {
        calls.push(request);
        return facts(tag);
      },
    }), 'trusted reset');
    assert(calls.length === 1
      && calls[0].replayPlanAuthority === plan.authority
      && calls[0].role === 'source'
      && calls[0].runNamespace === `run_source_${tag}`,
    `verifyReset 请求不闭合：${JSON.stringify(calls)}`);
    assert(Object.isFrozen(accepted.authority)
      && JSON.stringify(accepted.authority) === '{}',
    'reset authority 必须 opaque/frozen');
  });

  await check('R2 caller 直传 facts、trusted:true、无方法对象都不能铸权', () => {
    const tag = 'r2';
    const plan = createPlan(tag);
    for (const input of [
      { ...facts(tag) },
      { trustedResetIssuer: { trusted: true } },
      { trustedResetIssuer: Object.freeze({}) },
    ]) {
      const result = resetApi.createResetAuthority({
        replayPlanAuthority: plan.authority,
        role: 'source',
        runNamespace: `run_source_${tag}`,
        ...input,
      });
      expectReason(result, 'RESET_AUTHORITY_INVALID', 'untrusted reset input');
    }
  });

  await check('R3 throw/denied/malformed 全部 sanitise 为 RESET_AUTHORITY_INVALID', () => {
    for (const [suffix, verifyReset] of [
      ['throw', () => { throw new Error('POISON_RESET_SECRET'); }],
      ['denied', () => ({ ok: false, reason: 'RAW_RESET_REASON' })],
      ['malformed', () => ({ resetReceiptBytes: bytes({}) })],
      ['extra', () => ({ ...facts('r3_extra'), unexpectedRawTarget: 'LEAK_MARKER' })],
    ]) {
      const tag = `r3_${suffix}`;
      const plan = createPlan(tag);
      const result = createReset(tag, plan, { verifyReset });
      expectReason(result, 'RESET_AUTHORITY_INVALID', suffix);
      const serialized = JSON.stringify(result);
      for (const marker of ['POISON_RESET_SECRET', 'RAW_RESET_REASON', 'LEAK_MARKER']) {
        assert(!serialized.includes(marker), `失败输出泄漏 ${marker}`);
      }
    }
  });

  await check('R4 receipt 内外 pair/role/namespace/plan/baseline 任一冲突都拒', () => {
    const cases = [
      ['pair', { receipt: { pairId: 'pair_other' } }],
      ['role', { receipt: { role: 'distilled' } }],
      ['namespace', { receipt: { runNamespace: 'run_distilled_wrong' } }],
      ['plan-inner', { receipt: { resetPlanDigest: digest('wrong-plan') } }],
      ['baseline-inner', {
        receipt: { baselineProjectionSha256: digest('wrong-baseline') },
      }],
      ['plan-outer', { outer: { resetPlanDigest: digest('wrong-plan') } }],
      ['baseline-outer', {
        outer: { baselineProjectionSha256: digest('wrong-baseline') },
      }],
    ];
    for (const [suffix, overrides] of cases) {
      const tag = `r4_${suffix}`;
      const plan = createPlan(tag);
      expectReason(createReset(tag, plan, {
        verifyReset: () => facts(tag, overrides),
      }), 'RESET_AUTHORITY_INVALID', suffix);
    }
  });

  await check('R5 同一 reset receipt instance 即使再次由 adapter 返回也不可复用', () => {
    const tag = 'r5';
    const plan = createPlan(tag);
    expectOk(createReset(tag, plan, { verifyReset: () => facts(tag) }), 'first reset');
    expectReason(createReset(tag, plan, { verifyReset: () => facts(tag) }),
      'RESET_RECEIPT_REUSED', 'same reset instance');
  });
}

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  for (const failure of failures) console.error(`  FAIL ${failure}`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
