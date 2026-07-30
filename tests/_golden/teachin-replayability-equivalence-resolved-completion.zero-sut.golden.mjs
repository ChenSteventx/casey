#!/usr/bin/env node
// source 第二相：resolved seq→intent 后才允许 axes/verdict/evidence。零 SUT/browser/network/LLM。

import {
  api,
  assert,
  buildHappy,
  expectOk,
  expectReason,
  loadFailure,
  projectionApi,
  ready,
} from './support/teachin-replayability-equivalence-harness.mjs';

const TAG = 'teachin-replayability-equivalence-resolved-completion';
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

async function closeSource(built, label) {
  expectOk(await built.adapter.closeReplayRuntimeOwners({
    runtimeOwnerAuthority: built.sourceExecution.sourceRuntimeOwnerAuthority,
  }), label);
}

function spyingIssuer(built, mutate = (value) => value) {
  const calls = [];
  return {
    calls,
    issuer: {
      kind: 'resolved-source',
      async projectAndVerify(input) {
        calls.push(input);
        const result = await built.adapter.resolvedSourceIssuer.projectAndVerify(input);
        return mutate(result);
      },
    },
  };
}

function completeInput(built, issuer, overrides = {}) {
  return {
    rawExecutionAuthority: built.sourceExecution.rawExecutionAuthority,
    sourceSemanticGrant: built.resolution.sourceSemantic.grant,
    trustedResolvedSourceIssuer: issuer,
    ...overrides,
  };
}

if (!ready) failures.push(`production API unavailable: ${loadFailure || 'FROZEN_API_MISSING'}`);

if (ready) {
  await check('R1 genuine resolved grant 后才铸 source completion，且绝不重跑 raw', async () => {
    const built = await buildHappy('r1', { stopBeforeSourceSemanticCompletion: true });
    const trusted = spyingIssuer(built);
    const completed = expectOk(await api.completeResolvedSourceReplay(
      completeInput(built, trusted.issuer),
    ), 'resolved source completion');
    assert(trusted.calls.length === 1
      && Object.keys(trusted.calls[0]).sort().join(',')
        === 'rawObservationAuthority,resolvedProjectionAuthority',
    `issuer 必须只见两个 opaque authority：${JSON.stringify(trusted.calls)}`);
    assert(Object.keys(completed).sort().join(',')
      === 'authoringBaselineGrant,completionAuthority,ok',
    `success 输出必须闭合：${JSON.stringify(completed)}`);
    assert(!completed.sourceRuntimeOwnerAuthority && !completed.evidence
      && built.stats.rawReplay === 1 && built.stats.axes === 1 && built.stats.verdict === 1,
    'semantic phase 不得重铸 owner、泄 evidence 或重跑 raw');
    await closeSource(built, 'r1 source close');
  });

  await check('R2 raw/grant plain 或 clone 精确拒，失败探针不消费 genuine authorities', async () => {
    const built = await buildHappy('r2', { stopBeforeSourceSemanticCompletion: true });
    const trusted = spyingIssuer(built);
    for (const rawExecutionAuthority of [
      Object.freeze(Object.create(null)),
      { ...built.sourceExecution.rawExecutionAuthority },
    ]) {
      expectReason(await api.completeResolvedSourceReplay(completeInput(
        built, trusted.issuer, { rawExecutionAuthority },
      )), 'RAW_EXECUTION_AUTHORITY_INVALID', 'raw execution clone/plain');
    }
    for (const sourceSemanticGrant of [
      Object.freeze(Object.create(null)),
      { ...built.resolution.sourceSemantic.grant },
    ]) {
      expectReason(await api.completeResolvedSourceReplay(completeInput(
        built, trusted.issuer, { sourceSemanticGrant },
      )), 'SOURCE_SEMANTIC_GRANT_INVALID', 'source semantic grant clone/plain');
    }
    assert(trusted.calls.length === 0, '无权输入不得调用 semantic issuer');
    expectOk(await api.completeResolvedSourceReplay(
      completeInput(built, trusted.issuer),
    ), 'failed probes 后 genuine completion');
    assert(trusted.calls.length === 1, 'genuine issuer 只能调用一次');
    await closeSource(built, 'r2 source close');
  });

  await check('R3 issuer 缺失/throw/malformed 与 caller 自由 evidence 全部 fail-closed', async () => {
    const cases = [
      ['missing', null, 'REPLAY_ISSUER_INVALID'],
      ['throw', {
        kind: 'resolved-source',
        async projectAndVerify() { throw new Error('POISON_SEMANTIC_ERROR'); },
      }, 'SOURCE_SEMANTIC_COMPLETION_INVALID'],
      ['malformed', {
        kind: 'resolved-source',
        async projectAndVerify() { return { ok: true }; },
      }, 'SOURCE_SEMANTIC_COMPLETION_INVALID'],
    ];
    for (const [suffix, issuer, reason] of cases) {
      const built = await buildHappy(`r3_${suffix}`, {
        stopBeforeSourceSemanticCompletion: true,
      });
      const result = await api.completeResolvedSourceReplay(completeInput(built, issuer));
      expectReason(result, reason, suffix);
      assert(!JSON.stringify(result).includes('POISON'),
        'semantic failure 不得回显异常原文');
      await closeSource(built, `${suffix} source close`);
    }

    const free = await buildHappy('r3_free', { stopBeforeSourceSemanticCompletion: true });
    const trusted = spyingIssuer(free);
    expectReason(await api.completeResolvedSourceReplay(completeInput(free, trusted.issuer, {
      evidence: { verdict: 'PASS' },
      axesBytes: Buffer.from('{}'),
    })), 'SOURCE_SEMANTIC_COMPLETION_INVALID', 'caller free semantic fields');
    assert(trusted.calls.length === 0, '自由 semantic input 必须在 issuer 前拒绝');
    await closeSource(free, 'free semantic source close');
  });

  await check('R4 issuer 换绑 raw observation/resolved projection 或加 unknown 均拒', async () => {
    const mutations = [
      ['observation', (result) => ({
        ...result,
        rawObservationAuthority: { ...result.rawObservationAuthority },
      }), 'SOURCE_SEMANTIC_BINDING_MISMATCH'],
      ['projection', (result) => ({
        ...result,
        resolvedProjectionAuthority: { ...result.resolvedProjectionAuthority },
      }), 'SOURCE_SEMANTIC_BINDING_MISMATCH'],
      ['unknown', (result) => ({ ...result, unexpected: 'POISON_UNKNOWN' }),
        'SOURCE_SEMANTIC_COMPLETION_INVALID'],
    ];
    for (const [suffix, mutate, reason] of mutations) {
      const built = await buildHappy(`r4_${suffix}`, {
        stopBeforeSourceSemanticCompletion: true,
      });
      const trusted = spyingIssuer(built, mutate);
      const result = await api.completeResolvedSourceReplay(
        completeInput(built, trusted.issuer),
      );
      expectReason(result, reason, suffix);
      assert(!result.completionAuthority && !result.authoringBaselineGrant,
        '换绑或 unknown 不得铸 completion/baseline grant');
      await closeSource(built, `${suffix} source close`);
    }
  });

  await check('R5 resolution 的 source/atom grants 各只可 issue 一次且互不抢占', async () => {
    const built = await buildHappy('r5', { stopBeforeSourceSemanticCompletion: true });
    expectReason(projectionApi.issueSourceSemanticGrant({
      resolutionAuthority: built.resolution.resolved.resolutionAuthority,
    }), 'SOURCE_SEMANTIC_GRANT_INVALID', 'second source semantic grant');
    expectOk(projectionApi.issueAtomRoundtripGrant({
      resolutionAuthority: built.resolution.resolved.resolutionAuthority,
    }), 'first atom roundtrip grant');
    expectReason(projectionApi.issueAtomRoundtripGrant({
      resolutionAuthority: built.resolution.resolved.resolutionAuthority,
    }), 'ATOM_ROUNDTRIP_GRANT_INVALID', 'second atom roundtrip grant');
    const trusted = spyingIssuer(built);
    expectOk(await api.completeResolvedSourceReplay(
      completeInput(built, trusted.issuer),
    ), 'source grant issue ratchet 不影响已铸 genuine grant');
    await closeSource(built, 'r5 source close');
  });

  await check('R6 genuine raw/grant cross-pair 拒且不消费双方 authority', async () => {
    const left = await buildHappy('r6_left', {
      stopBeforeSourceSemanticCompletion: true,
    });
    const right = await buildHappy('r6_right', {
      stopBeforeSourceSemanticCompletion: true,
    });
    const crossIssuer = spyingIssuer(left);
    expectReason(await api.completeResolvedSourceReplay({
      rawExecutionAuthority: left.sourceExecution.rawExecutionAuthority,
      sourceSemanticGrant: right.resolution.sourceSemantic.grant,
      trustedResolvedSourceIssuer: crossIssuer.issuer,
    }), 'SOURCE_SEMANTIC_BINDING_MISMATCH', 'genuine cross-pair raw/grant');
    assert(crossIssuer.calls.length === 0,
      'cross-pair binding 必须在 semantic issuer 前拒绝');

    for (const built of [left, right]) {
      const trusted = spyingIssuer(built);
      expectOk(await api.completeResolvedSourceReplay(
        completeInput(built, trusted.issuer),
      ), 'failed cross-pair probe 后 genuine completion');
      assert(trusted.calls.length === 1,
        '每个 genuine pair 的 semantic issuer 必须恰调用一次');
      await closeSource(built, 'genuine source close');
    }
  });
}

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  for (const failure of failures) console.error(`  FAIL ${failure}`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
