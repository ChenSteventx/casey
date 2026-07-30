#!/usr/bin/env node
// pair/candidate/receipt/role/reset/target authority 对抗门。零 SUT/browser/network/LLM。

import { createHash } from 'node:crypto';
import { resolveExecutionTarget } from '../../lib/execution-target/authority.mjs';
import {
  buildHappy,
  claimFresh,
  owners,
  prepareFresh,
} from './support/teachin-replayability-equivalence-harness.mjs';

const TAG = 'teachin-replayability-equivalence-integrity-authority';
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
let resetApi;
try {
  [api, resetApi] = await Promise.all([
    import('../../lib/dual-replay/index.mjs'),
    import('../../lib/dual-replay/run-authority.mjs'),
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
  assert(result?.ok === false && result.reason === reason,
    `${label} 应 ${reason}：${JSON.stringify(result)}`);
}

async function prepareAuthoring(tag) {
  const built = await buildHappy(tag, { stopAfterSource: true });
  const sourceClosed = expectOk(await built.adapter.closeReplayRuntimeOwners({
    runtimeOwnerAuthority: built.sourceExecution.sourceRuntimeOwnerAuthority,
  }), 'source close before authoring');
  return {
    built,
    input: {
      atomRoundtripGrant: built.resolution.atomRoundtrip.grant,
      sourceClosureAuthority: sourceClosed.sourceClosureAuthority,
      authoringBaselineGrant: built.sourceCompleted.authoringBaselineGrant,
      runNamespace: `run_authoring_${tag}`,
      executionTargetAuthority: built.execution.authority,
    },
  };
}

async function sealCandidate(tag) {
  const prepared = await prepareAuthoring(tag);
  const sealed = expectOk(await prepared.built.adapter.runAndSealDistilledCandidate({
    ...prepared.input,
  }), 'distilled candidate seal');
  return { ...prepared.built, sealed };
}

async function finalizeSource(tag) {
  const built = await sealCandidate(tag);
  const finalized = expectOk(api.finalizeDualReplayPlanAuthority({
    sourcePlanAuthority: built.sourcePlan.authority,
    sourceCompletionAuthority: built.sourceCompleted.completionAuthority,
    distilledCandidateAuthority: built.sealed.distilledCandidateAuthority,
  }), 'pair finalize');
  const sourceReceipt = expectOk(api.createSemanticReplayReceipt({
    completionAuthority: finalized.pairBoundSourceCompletionAuthority,
  }), 'source receipt');
  return { ...built, finalized, sourceReceipt };
}

function resetFacts(tag, role, runNamespace, instance, baselineTag = tag) {
  const resetPlanDigest = digest(`${tag}:reset-plan`);
  const baselineProjectionSha256 = digest(`${baselineTag}:baseline`);
  return {
    resetReceiptBytes: bytes({
      schemaVersion: 1,
      artifactKind: 'dual-replay-reset-receipt',
      pairId: `pair_${tag}`,
      role,
      runNamespace,
      receiptInstanceId: instance,
      resetPlanDigest,
      baselineProjectionSha256,
    }),
    resetPlanDigest,
    baselineProjectionSha256,
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

async function closeDistilled(built, label) {
  expectOk(await built.adapter.closeReplayRuntimeOwners({
    runtimeOwnerAuthority: built.distilledCompleted.distilledRuntimeOwnerAuthority,
  }), label);
}

if (api && resetApi) {
  await check('I1 genuine source plan+completion 后 plain/clone candidate 精确拒且不消费 source', async () => {
    const built = await buildHappy('i1', { stopAfterSource: true });
    const sourceClosed = expectOk(await built.adapter.closeReplayRuntimeOwners({
      runtimeOwnerAuthority: built.sourceExecution.sourceRuntimeOwnerAuthority,
    }), 'i1 source close before authoring');
    const sealed = expectOk(await built.adapter.runAndSealDistilledCandidate({
      atomRoundtripGrant: built.resolution.atomRoundtrip.grant,
      sourceClosureAuthority: sourceClosed.sourceClosureAuthority,
      authoringBaselineGrant: built.sourceCompleted.authoringBaselineGrant,
      runNamespace: 'run_authoring_i1',
      executionTargetAuthority: built.execution.authority,
    }), 'genuine candidate');
    for (const distilledCandidateAuthority of [
      { candidateBytes: bytes({ forged: true }), eventsBytes: bytes([]) },
      { ...sealed.distilledCandidateAuthority },
    ]) {
      expectReason(api.finalizeDualReplayPlanAuthority({
        sourcePlanAuthority: built.sourcePlan.authority,
        sourceCompletionAuthority: built.sourceCompleted.completionAuthority,
        distilledCandidateAuthority,
      }), 'DISTILLED_CANDIDATE_AUTHORITY_INVALID', 'forged candidate');
    }
    expectOk(api.finalizeDualReplayPlanAuthority({
      sourcePlanAuthority: built.sourcePlan.authority,
      sourceCompletionAuthority: built.sourceCompleted.completionAuthority,
      distilledCandidateAuthority: sealed.distilledCandidateAuthority,
    }), 'failed probes 不得消费 genuine source completion');
  });

  await check('I2 source role 即使换 genuine reset/fresh 也不能二次授权', async () => {
    const tag = 'i2';
    const built = await buildHappy(tag, { stopAfterSource: true });
    const secondReset = expectOk(resetApi.createResetAuthority({
      replayPlanAuthority: built.sourcePlan.authority,
      role: 'source',
      runNamespace: `run_source_${tag}`,
      trustedResetIssuer: {
        verifyReset: () => resetFacts(
          tag, 'source', `run_source_${tag}`, `reset_${tag}_source_retry`,
        ),
      },
    }), 'second genuine reset');
    const prepared = await prepareFresh(
      built.adapter,
      owners('retry-recording'),
      {
        runNamespace: `run_source_${tag}`,
        executionTargetAuthority: built.execution.authority,
      },
    );
    const fresh = await claimFresh(built.adapter, prepared, {
      sourcePlanAuthority: built.sourcePlan.authority,
      runNamespace: `run_source_${tag}`,
      executionTargetAuthority: built.execution.authority,
    });
    expectReason(api.authorizeSourceReplay({
      sourcePlanAuthority: built.sourcePlan.authority,
      role: 'source',
      runNamespace: `run_source_${tag}`,
      resetAuthority: secondReset.authority,
      freshRuntimeAuthority: fresh.freshRuntimeAuthority,
      topologyAuthority: fresh.topologyAuthority,
      runtimeOwnerAuthority: fresh.runtimeOwnerAuthority,
      executionTargetAuthority: built.execution.authority,
    }), 'RUN_ROLE_ALREADY_AUTHORIZED', 'second source role');
    expectOk(await built.adapter.closeReplayRuntimeOwners({
      runtimeOwnerAuthority: fresh.runtimeOwnerAuthority,
    }), 'rejected retry owner close');
    expectOk(await built.adapter.closeReplayRuntimeOwners({
      runtimeOwnerAuthority: built.sourceExecution.sourceRuntimeOwnerAuthority,
    }), 'original source owner close');
  });

  await check('I3 comparator 拒 bytes 篡改、receipt cap clone 与 role swap', async () => {
    const byteBuilt = await buildHappy('i3_bytes');
    const tamperedReceipt = {
      ...byteBuilt.sourceReceipt.receipt,
      binding: {
        ...byteBuilt.sourceReceipt.receipt.binding,
        candidateSha256: digest('i3_bytes:tampered-but-schema-valid'),
      },
    };
    expectReason(api.compareSemanticReplayReceipts(comparisonInput(byteBuilt, {
      sourceReceiptBytes: bytes(tamperedReceipt),
    })), 'RECEIPT_HASH_MISMATCH', 'source bytes tamper');
    await closeDistilled(byteBuilt, 'byte case close');

    const capBuilt = await buildHappy('i3_cap');
    expectReason(api.compareSemanticReplayReceipts(comparisonInput(capBuilt, {
      distilledReceiptAuthority: { ...capBuilt.distilledReceipt.authority },
    })), 'RECEIPT_AUTHORITY_INVALID', 'distilled cap clone');
    await closeDistilled(capBuilt, 'cap case close');

    const roleBuilt = await buildHappy('i3_role');
    expectReason(api.compareSemanticReplayReceipts({
      pairAuthority: roleBuilt.finalized.pairAuthority,
      sourceReceiptBytes: roleBuilt.distilledReceipt.bytes,
      sourceReceiptAuthority: roleBuilt.distilledReceipt.authority,
      sourceComparisonGrant: roleBuilt.distilledComparison.grant,
      distilledReceiptBytes: roleBuilt.sourceReceipt.bytes,
      distilledReceiptAuthority: roleBuilt.sourceReceipt.authority,
      distilledComparisonGrant: roleBuilt.sourceComparison.grant,
    }), 'ROLE_PAIR_INVALID', 'receipt roles swapped');
    await closeDistilled(roleBuilt, 'role case close');
  });

  await check('I4 comparison grants one-shot，成功 compare 后不可 replay', async () => {
    const built = await buildHappy('i4');
    const input = comparisonInput(built);
    const first = api.compareSemanticReplayReceipts(input);
    assert(first?.ok === true && first.equivalenceReceipt
      && first.equivalenceReceipt.artifactKind === 'dual-replay-equivalence-receipt',
    `first compare 应成功：${JSON.stringify(first)}`);
    await closeDistilled(built, 'successful compare close');
    expectReason(api.compareSemanticReplayReceipts(input),
      'COMPARISON_AUTHORITY_INVALID', 'comparison grant replay');
  });

  await check('I5 reset plan 相同但 distilled baseline 不同必须在授权前拒', async () => {
    const tag = 'i5';
    const built = await finalizeSource(tag);
    expectReason(resetApi.createResetAuthority({
      replayPlanAuthority: built.finalized.pairAuthority,
      role: 'distilled',
      runNamespace: `run_distilled_${tag}`,
      trustedResetIssuer: {
        verifyReset: () => resetFacts(
          tag,
          'distilled',
          `run_distilled_${tag}`,
          `reset_${tag}_distilled`,
          'different-baseline',
        ),
      },
    }), 'BASELINE_PROJECTION_MISMATCH', 'different baseline reset');
  });

  await check('I6 wrong execution target 与 unrelated owner/closure 均 fail-closed', async () => {
    const built = await finalizeSource('i6');
    expectReason(await built.adapter.closeReplayRuntimeOwners({
      runtimeOwnerAuthority: Object.freeze(Object.create(null)),
    }), 'REPLAY_RUNTIME_OWNERSHIP_MISMATCH', 'unrelated owner authority');
    expectReason(await built.adapter.prepareDistilledReplayRuntime({
      authoringClosureAuthority: Object.freeze(Object.create(null)),
      pairAuthority: built.finalized.pairAuthority,
      runNamespace: 'run_distilled_i6',
      executionTargetAuthority: built.execution.authority,
    }), 'REPLAY_RUNTIME_OWNERSHIP_MISMATCH', 'unrelated closure authority');

    const wrongTarget = expectOk(resolveExecutionTarget({
      runtime: { platform: 'linux', isWSL: false },
      logicalTarget: { startUrl: 'https://wrong-target.synthetic.invalid/home' },
      transport: { mode: 'direct' },
      requiresOriginContinuity: true,
    }), 'wrong target');
    expectReason(await built.adapter.closeReplayRuntimeOwners({
      runtimeOwnerAuthority: built.sourceExecution.sourceRuntimeOwnerAuthority,
    }), 'REPLAY_RUNTIME_OWNERSHIP_MISMATCH', 'source owner replay');
    expectReason(await built.adapter.prepareDistilledReplayRuntime({
      authoringClosureAuthority: built.sealed.authoringClosureAuthority,
      pairAuthority: built.finalized.pairAuthority,
      runNamespace: 'run_distilled_i6',
      executionTargetAuthority: wrongTarget.authority,
    }), 'EXECUTION_TARGET_AUTHORITY_INVALID', 'target swap');
  });

  await check('I7 atom issuer 即使夹带 genuine raw proof 也不得完成', async () => {
    const built = await buildHappy('i7_atom_raw', { stopBeforeDistilledCompletion: true });
    const atomIssuer = {
      kind: 'atom',
      async executeAndVerify(request) {
        const result = await built.adapter.atomReplayIssuer.executeAndVerify(request);
        return {
          ...result,
          rawReplay: {
            status: 'CLEAN',
            cleanProofAuthority: built.sourceExecution.cleanProofAuthority,
          },
        };
      },
    };
    expectReason(await api.completeAuthorizedReplay({
      runAuthority: built.distilledRun.authority,
      trustedReplayIssuer: atomIssuer,
    }), 'RUN_COMPLETION_INVALID', 'atom illicit raw proof');
    expectOk(await built.adapter.closeReplayRuntimeOwners({
      runtimeOwnerAuthority: built.distilledFresh.runtimeOwnerAuthority,
    }), 'malformed atom owner close');
  });

  await check('I8 source preparation cap 只可 claim/dispose 一次且不能跨 adapter', async () => {
    const left = await buildHappy('i8_left', { stopAfterSource: true });
    const right = await buildHappy('i8_right', { stopAfterSource: true });
    const leftPrepared = await prepareFresh(
      left.adapter, owners('i8-l-rec'), {
        runNamespace: 'run_source_i8_left_prepared',
        executionTargetAuthority: left.execution.authority,
      },
    );
    const rightPrepared = await prepareFresh(
      right.adapter, owners('i8-r-rec'), {
        runNamespace: 'run_source_i8_right_prepared',
        executionTargetAuthority: right.execution.authority,
      },
    );
    for (const [label, authority] of [
      ['plain', Object.freeze(Object.create(null))],
      ['clone', { ...leftPrepared.sourceRuntimePreparationAuthority }],
      ['foreign', rightPrepared.sourceRuntimePreparationAuthority],
    ]) {
      expectReason(await left.adapter.disposePreparedSourceReplayRuntime({
        sourceRuntimePreparationAuthority: authority,
      }), 'REPLAY_RUNTIME_OWNERSHIP_MISMATCH', `${label} prep dispose`);
    }
    expectOk(await left.adapter.disposePreparedSourceReplayRuntime({
      sourceRuntimePreparationAuthority: leftPrepared.sourceRuntimePreparationAuthority,
    }), 'genuine prep dispose');
    expectReason(await left.adapter.claimPreparedSourceReplayRuntime({
      sourceRuntimePreparationAuthority: leftPrepared.sourceRuntimePreparationAuthority,
      sourcePlanAuthority: left.sourcePlan.authority,
      runNamespace: 'run_source_i8_left_prepared',
      executionTargetAuthority: left.execution.authority,
    }), 'REPLAY_RUNTIME_OWNERSHIP_MISMATCH', 'disposed prep claim replay');
    expectReason(await left.adapter.disposePreparedSourceReplayRuntime({
      sourceRuntimePreparationAuthority: leftPrepared.sourceRuntimePreparationAuthority,
    }), 'REPLAY_RUNTIME_OWNERSHIP_MISMATCH', 'prep dispose replay');
    expectOk(await right.adapter.disposePreparedSourceReplayRuntime({
      sourceRuntimePreparationAuthority: rightPrepared.sourceRuntimePreparationAuthority,
    }), 'foreign prep owner disposes itself');
    for (const built of [left, right]) {
      expectOk(await built.adapter.closeReplayRuntimeOwners({
        runtimeOwnerAuthority: built.sourceExecution.sourceRuntimeOwnerAuthority,
      }), 'existing source close');
    }
  });

  await check('I9 atom/baseline/source-closure clone 与 genuine cross-pair 均拒', async () => {
    const cloneCases = [
      ['atom', 'atomRoundtripGrant', 'ATOM_ROUNDTRIP_GRANT_INVALID'],
      ['baseline', 'authoringBaselineGrant', 'AUTHORING_BASELINE_GRANT_INVALID'],
      ['closure', 'sourceClosureAuthority', 'REPLAY_RUNTIME_OWNERSHIP_MISMATCH'],
    ];
    for (const [label, field, reason] of cloneCases) {
      const prepared = await prepareAuthoring(`i9_clone_${label}`);
      expectReason(await prepared.built.adapter.runAndSealDistilledCandidate({
        ...prepared.input,
        [field]: { ...prepared.input[field] },
      }), reason, `${label} clone`);
      assert(prepared.built.stats.authoringOpen === 0,
        `${label} clone 不得启动 authoring runtime`);
    }

    const crossCases = [
      ['atom', 'atomRoundtripGrant', 'AUTHORING_BASELINE_MISMATCH'],
      ['baseline', 'authoringBaselineGrant', 'AUTHORING_BASELINE_MISMATCH'],
      ['closure', 'sourceClosureAuthority', 'REPLAY_RUNTIME_OWNERSHIP_MISMATCH'],
    ];
    for (const [label, field, reason] of crossCases) {
      const left = await prepareAuthoring(`i9_cross_${label}_left`);
      const right = await prepareAuthoring(`i9_cross_${label}_right`);
      expectReason(await left.built.adapter.runAndSealDistilledCandidate({
        ...left.input,
        [field]: right.input[field],
      }), reason, `${label} genuine cross-pair`);
      assert(left.built.stats.authoringOpen === 0
        && right.built.stats.authoringOpen === 0,
      `${label} cross-pair 不得启动任一 authoring runtime`);
    }

    const genuine = await sealCandidate('i9_genuine');
    assert(genuine.sealed.distilledCandidateAuthority
      && genuine.sealed.authoringClosureAuthority
      && genuine.stats.authoringOpen === 1
      && genuine.stats.authoringOwners?.closeCalls === 1,
    '独立 fresh genuine pair 必须 open/compile/close 后铸 candidate+closure');
  });

  await check('I10 finalizer 拒 genuine foreign candidate 且不消费双方', async () => {
    const left = await sealCandidate('i10_left');
    const right = await sealCandidate('i10_right');
    expectReason(api.finalizeDualReplayPlanAuthority({
      sourcePlanAuthority: left.sourcePlan.authority,
      sourceCompletionAuthority: left.sourceCompleted.completionAuthority,
      distilledCandidateAuthority: right.sealed.distilledCandidateAuthority,
    }), 'PAIR_FINALIZATION_BINDING_MISMATCH', 'foreign genuine candidate');
    for (const built of [left, right]) {
      expectOk(api.finalizeDualReplayPlanAuthority({
        sourcePlanAuthority: built.sourcePlan.authority,
        sourceCompletionAuthority: built.sourceCompleted.completionAuthority,
        distilledCandidateAuthority: built.sealed.distilledCandidateAuthority,
      }), 'failed cross-pair probe 后 genuine finalize');
    }
  });
}

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  for (const failure of failures) console.error(`  FAIL ${failure}`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
