#!/usr/bin/env node
// staged dual-replay core：source plan exact bytes/capture/target authority。
// 纯字节与 capability；零 SUT/browser/network/LLM。

import { createHash } from 'node:crypto';
import { resolveExecutionTarget } from '../../lib/execution-target/authority.mjs';

const TAG = 'teachin-replayability-equivalence-core';
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
let captureApi;
try {
  [api, captureApi] = await Promise.all([
    import('../../lib/dual-replay/index.mjs'),
    import('../../lib/teachin/raw-capture.mjs'),
  ]);
} catch (error) {
  failures.push(`production API unavailable: ${String(error?.code || error?.message || error).slice(-500)}`);
}

const REQUIRED = [
  'createSourceReplayPlanAuthority',
  'authorizeSourceReplay',
  'completeAuthorizedReplay',
  'finalizeDualReplayPlanAuthority',
  'createSemanticReplayReceipt',
  'validateSemanticReplayReceipt',
  'issuePredecessorGrant',
  'issueComparisonGrant',
  'authorizeDistilledReplay',
  'compareSemanticReplayReceipts',
];
const digest = (value) => `sha256:${createHash('sha256')
  .update(Buffer.isBuffer(value) ? value : String(value)).digest('hex')}`;
const bytes = (value) => Buffer.from(JSON.stringify(value));

function expectOk(result, label) {
  assert(result?.ok === true, `${label} 应成功：${JSON.stringify(result)}`);
  return result;
}

function expectReason(result, reason, label) {
  assert(result?.ok === false && result.reason === reason,
    `${label} 应 ${reason}：${JSON.stringify(result)}`);
}

function target(tag) {
  return expectOk(resolveExecutionTarget({
    runtime: { platform: 'linux', isWSL: false },
    logicalTarget: { startUrl: `https://${tag}.synthetic.invalid/home` },
    transport: { mode: 'direct' },
    requiresOriginContinuity: true,
  }), `${tag} target`);
}

function capture(tag) {
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
  }), `${tag} capture`);
  return { captureBytes, authority: admitted.captureAuthority };
}

function planInput(tag, execution = target(tag), captured = capture(tag)) {
  const predicate = digest(`${tag}:predicate`);
  return {
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
      captureAuthority: captured.authority,
      candidateBytes: bytes({ tag, candidate: 'source' }),
      eventsBytes: captured.captureBytes,
      entityLockBytes: bytes({ tag, locks: [] }),
      runNamespace: `run_source_${tag}`,
    },
  };
}

if (api && captureApi && REQUIRED.every((name) => typeof api[name] === 'function')) {
  await check('C1 façade 只暴露 staged API，receipt 不接受旧自由 role/artifacts/evidence', () => {
    for (const name of REQUIRED) {
      assert(typeof api[name] === 'function', `缺 staged export ${name}`);
    }
    expectReason(api.createSemanticReplayReceipt({
      role: 'source',
      artifacts: { verdictBytes: bytes({ verdict: 'PASS' }) },
      evidence: { intents: [{ intentId: 'intent_1', verdict: 'PASS' }] },
    }), 'RUN_COMPLETION_AUTHORITY_INVALID', '旧 receipt 入口');
  });

  await check('C2 source plan receipt 只含固定 digest，不含 target/bytes/session', () => {
    const input = planInput('c2');
    const result = expectOk(api.createSourceReplayPlanAuthority(input), 'source plan');
    const expectedKeys = [
      'artifactKind',
      'pairId',
      'schemaVersion',
      'sourceCandidateSha256',
      'sourceEntityLockSetSha256',
      'sourceEventsSha256',
    ];
    assert(JSON.stringify(Object.keys(result.receipt).sort()) === JSON.stringify(expectedKeys),
      `source receipt keys 不闭合：${JSON.stringify(result.receipt)}`);
    const serialized = JSON.stringify(result.receipt);
    for (const marker of ['synthetic.invalid', 'run_source_', 'candidate', 'session']) {
      assert(!serialized.includes(marker), `source receipt 泄漏 ${marker}`);
    }
  });

  await check('C3 source plan 入口立即复制 exact bytes，后改 Buffer/obligation 无效', () => {
    const input = planInput('c3');
    const originalCandidateHash = digest(input.source.candidateBytes);
    const originalEventsHash = digest(input.source.eventsBytes);
    const result = expectOk(api.createSourceReplayPlanAuthority(input), 'source plan');
    input.source.candidateBytes.fill(0);
    input.source.eventsBytes.fill(1);
    input.expectedObligations.intents.push('intent_injected_after_plan');
    assert(result.receipt.sourceCandidateSha256 === originalCandidateHash
      && result.receipt.sourceEventsSha256 === originalEventsHash,
    'caller mutation 不得改变 frozen source hashes');
    assert(!JSON.stringify(result.receipt).includes('intent_injected_after_plan'),
      'caller 后改 obligation 不得进入 plan');
  });

  await check('C4 execution target 与 capture authority clone/plain 均在 source plan 拒绝', () => {
    const execution = target('c4');
    const targetCloneInput = planInput('c4_target');
    targetCloneInput.executionTargetAuthority = { ...execution.authority };
    const captureCloneInput = planInput('c4_capture');
    captureCloneInput.source.captureAuthority = {
      ...captureCloneInput.source.captureAuthority,
    };
    const captureFactsInput = planInput('c4_facts');
    captureFactsInput.source.captureAuthority = { admitted: true };
    const cases = [
      ['target clone', targetCloneInput, 'EXECUTION_TARGET_AUTHORITY_INVALID'],
      ['capture clone', captureCloneInput, 'SOURCE_REPLAY_PLAN_AUTHORITY_INVALID'],
      ['capture facts', captureFactsInput, 'SOURCE_REPLAY_PLAN_AUTHORITY_INVALID'],
    ];
    for (const [label, input, reason] of cases) {
      expectReason(api.createSourceReplayPlanAuthority(input), reason, label);
    }
  });

  await check('C5 clone/forge source plan 无法 authorize，且下游 authority 不被检查', () => {
    const plan = expectOk(api.createSourceReplayPlanAuthority(planInput('c5')), 'source plan');
    for (const sourcePlanAuthority of [
      { ...plan.authority },
      { pairId: 'pair_c5', trusted: true },
    ]) {
      expectReason(api.authorizeSourceReplay({
        sourcePlanAuthority,
        role: 'source',
        runNamespace: 'run_source_c5',
        resetAuthority: Object.freeze(Object.create(null)),
        freshRuntimeAuthority: Object.freeze(Object.create(null)),
        topologyAuthority: Object.freeze(Object.create(null)),
        runtimeOwnerAuthority: Object.freeze(Object.create(null)),
        executionTargetAuthority: Object.freeze(Object.create(null)),
      }), 'SOURCE_REPLAY_PLAN_AUTHORITY_INVALID', 'forged source plan');
    }
  });

  await check('C6 completion 首错优先且不得读取 downstream candidate', () => {
    const plan = expectOk(api.createSourceReplayPlanAuthority(planInput('c6')), 'source plan');
    let candidateReads = 0;
    const poisonCandidate = Object.create(null);
    Object.defineProperty(poisonCandidate, 'candidateBytes', {
      enumerable: true,
      get() { candidateReads += 1; throw new Error('POISON_CANDIDATE_READ'); },
    });
    const result = api.finalizeDualReplayPlanAuthority({
      sourcePlanAuthority: plan.authority,
      sourceCompletionAuthority: Object.freeze(Object.create(null)),
      distilledCandidateAuthority: poisonCandidate,
    });
    expectReason(result, 'RUN_COMPLETION_AUTHORITY_INVALID', 'completion first error');
    assert(!result.pairAuthority && candidateReads === 0,
      '首错拒绝不得读取 downstream candidate 或产半份 pair');
  });
}

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  for (const failure of failures) console.error(`  FAIL ${failure}`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
