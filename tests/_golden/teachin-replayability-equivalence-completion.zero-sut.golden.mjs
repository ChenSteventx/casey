#!/usr/bin/env node
// source 第一相：真实 raw issuer 只铸 execution/CLEAN/observations/owner，不预判 intent。

import {
  api,
  assert,
  buildHappy,
  bytes,
  expectOk,
  expectReason,
  loadFailure,
  ready,
} from './support/teachin-replayability-equivalence-harness.mjs';

const TAG = 'teachin-replayability-equivalence-completion';
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

async function beforeRaw(tag) {
  return buildHappy(tag, { stopBeforeSourceExecution: true });
}

function wrapRawIssuer(built, mutate = (value) => value) {
  const calls = [];
  const results = [];
  return {
    calls,
    results,
    issuer: {
      kind: 'raw',
      async executeAndVerify(input) {
        calls.push(input);
        const result = await built.adapter.rawReplayIssuer.executeAndVerify(input);
        results.push(result);
        return mutate(result);
      },
    },
  };
}

function execute(built, issuer) {
  return api.executeAuthorizedSourceReplay({
    runAuthority: built.sourceRun.authority,
    trustedRawReplayIssuer: issuer,
  });
}

async function closeBuilt(built, label) {
  expectOk(await built.adapter.closeReplayRuntimeOwners({
    runtimeOwnerAuthority: built.sourceFresh.runtimeOwnerAuthority,
  }), label);
}

if (!ready) failures.push(`production API unavailable: ${loadFailure || 'FROZEN_API_MISSING'}`);

if (ready) {
  await check('C1 authorize-only/plain CLEAN/free evidence 均不能铸 semantic receipt', async () => {
    const built = await beforeRaw('c1');
    for (const completionAuthority of [
      built.sourceRun.authority,
      { status: 'CLEAN' },
      { evidence: { verdict: 'PASS' }, artifacts: {} },
    ]) {
      expectReason(api.createSemanticReplayReceipt({ completionAuthority }),
        'RUN_COMPLETION_AUTHORITY_INVALID', '未完成 source semantic');
    }
    await closeBuilt(built, 'c1 source close');
  });

  await check('C2 canonical raw issuer 恰一次，只产 raw execution/CLEAN/owner', async () => {
    const built = await beforeRaw('c2');
    const trusted = wrapRawIssuer(built);
    const completed = expectOk(await execute(built, trusted.issuer), 'raw execution');
    assert(trusted.calls.length === 1
      && Object.keys(trusted.calls[0]).join(',') === 'runExecutionAuthority',
    `raw issuer 必须只见 opaque execution authority：${JSON.stringify(trusted.calls)}`);
    assert(Object.keys(completed).sort().join(',')
      === 'cleanProofAuthority,ok,rawExecutionAuthority,sourceRuntimeOwnerAuthority',
    `raw success 输出不闭合：${JSON.stringify(completed)}`);
    assert(completed.sourceRuntimeOwnerAuthority === built.sourceFresh.runtimeOwnerAuthority
      && trusted.results[0]?.rawObservationAuthority
      && JSON.stringify(trusted.results[0].rawObservationAuthority) === '{}',
    'owner 必须原样转移且 observation 必须 genuine opaque authority');
    assert(built.stats.rawReplay === 1 && built.stats.axes === 0 && built.stats.verdict === 0,
      'raw 第一相必须真 replay 一次且不得提前跑 axes/verdict');
    expectReason(api.createSemanticReplayReceipt({
      completionAuthority: completed.rawExecutionAuthority,
    }), 'RUN_COMPLETION_AUTHORITY_INVALID', 'raw execution 不能建 receipt');
    await closeBuilt(built, 'c2 source close');
  });

  await check('C3 issuer missing/throw/malformed/execution 换绑全部 fail-closed', async () => {
    const cases = [
      ['missing', null, 'REPLAY_ISSUER_INVALID'],
      ['throw', {
        kind: 'raw',
        async executeAndVerify() { throw new Error('POISON_RAW_EXECUTION'); },
      }, 'RUN_COMPLETION_INVALID'],
      ['malformed', {
        kind: 'raw',
        async executeAndVerify() { return { ok: true }; },
      }, 'RUN_COMPLETION_INVALID'],
    ];
    for (const [suffix, issuer, reason] of cases) {
      const built = await beforeRaw(`c3_${suffix}`);
      const result = await execute(built, issuer);
      expectReason(result, reason, suffix);
      assert(!JSON.stringify(result).includes('POISON'), '失败不得回显异常原文');
      await closeBuilt(built, `${suffix} source close`);
    }
    const swapped = await beforeRaw('c3_swapped');
    const trusted = wrapRawIssuer(swapped, (result) => ({
      ...result,
      runExecutionAuthority: Object.freeze(Object.create(null)),
    }));
    expectReason(await execute(swapped, trusted.issuer),
      'RUN_COMPLETION_BINDING_MISMATCH', 'execution authority swap');
    await closeBuilt(swapped, 'swapped source close');
  });

  await check('C4 run authority clone/forge/replay 不得二次调用 raw issuer', async () => {
    const clone = await beforeRaw('c4_clone');
    const cloneIssuer = wrapRawIssuer(clone);
    expectReason(await api.executeAuthorizedSourceReplay({
      runAuthority: { ...clone.sourceRun.authority },
      trustedRawReplayIssuer: cloneIssuer.issuer,
    }), 'RUN_COMPLETION_AUTHORITY_INVALID', 'clone run');
    assert(cloneIssuer.calls.length === 0, '无权 run 不得调用 issuer');
    await closeBuilt(clone, 'clone source close');

    const replay = await beforeRaw('c4_replay');
    const replayIssuer = wrapRawIssuer(replay);
    expectOk(await execute(replay, replayIssuer.issuer), 'first raw execution');
    expectReason(await execute(replay, replayIssuer.issuer),
      'RUN_COMPLETION_AUTHORITY_INVALID', 'run replay');
    assert(replayIssuer.calls.length === 1, 'run replay 后 issuer 总调用数仍须为 1');
    await closeBuilt(replay, 'replay source close');
  });

  await check('C5 source artifacts 换绑即拒，且真实 raw 已执行恰一次', async () => {
    const built = await beforeRaw('c5');
    const trusted = wrapRawIssuer(built, (result) => ({
      ...result,
      artifacts: { ...result.artifacts, eventsBytes: bytes({ swapped: true }) },
    }));
    expectReason(await execute(built, trusted.issuer),
      'RUN_COMPLETION_BINDING_MISMATCH', 'events swap');
    assert(built.stats.rawReplay === 1, 'artifact 反例仍须来自一次真实 raw execution');
    await closeBuilt(built, 'c5 source close');
  });

  await check('C6 plain/clone clean proof 必须拒且不铸 raw authority', async () => {
    for (const mode of ['plain', 'clone']) {
      const built = await beforeRaw(`c6_${mode}`);
      const trusted = wrapRawIssuer(built, (result) => ({
        ...result,
        rawReplay: {
          ...result.rawReplay,
          cleanProofAuthority: mode === 'plain'
            ? Object.freeze({ clean: true })
            : { ...result.rawReplay.cleanProofAuthority },
        },
      }));
      const result = await execute(built, trusted.issuer);
      expectReason(result, 'RUN_COMPLETION_INVALID', `${mode} clean proof`);
      assert(!result.rawExecutionAuthority && built.stats.rawReplay === 1,
        'forged proof 必须在一次真实 raw 后拒且不铸 authority');
      await closeBuilt(built, `${mode} proof source close`);
    }
  });

  await check('C7 genuine clean proof 来自另一 capture/run 也必须换绑拒绝', async () => {
    const other = await beforeRaw('c7_other');
    const otherIssuer = wrapRawIssuer(other);
    const otherCompleted = expectOk(await execute(other, otherIssuer.issuer),
      'other raw execution');
    const target = await beforeRaw('c7_target');
    const targetIssuer = wrapRawIssuer(target, (result) => ({
      ...result,
      rawReplay: {
        ...result.rawReplay,
        cleanProofAuthority: otherCompleted.cleanProofAuthority,
      },
    }));
    expectReason(await execute(target, targetIssuer.issuer),
      'RUN_COMPLETION_BINDING_MISMATCH', 'cross-capture clean proof');
    await closeBuilt(other, 'other source close');
    await closeBuilt(target, 'target source close');
  });

  await check('C8 raw result semantic 字段或任一 unknown key 均 malformed', async () => {
    const mutations = [
      ['axes', (result) => ({ ...result, axesBytes: bytes({ illicit: true }) })],
      ['evidence', (result) => ({ ...result, evidence: { verdict: 'PASS' } })],
      ['top', (result) => ({ ...result, unexpected: 'POISON_TOP' })],
      ['artifacts', (result) => ({
        ...result,
        artifacts: { ...result.artifacts, origin: 'POISON_ORIGIN' },
      })],
      ['rawReplay', (result) => ({
        ...result,
        rawReplay: { ...result.rawReplay, session: 'POISON_SESSION' },
      })],
    ];
    for (const [suffix, mutate] of mutations) {
      const built = await beforeRaw(`c8_${suffix}`);
      const trusted = wrapRawIssuer(built, mutate);
      const result = await execute(built, trusted.issuer);
      expectReason(result, 'RUN_COMPLETION_INVALID', `${suffix} extra`);
      assert(!JSON.stringify(result).includes('POISON'),
        'malformed failure 不得回显 unknown value');
      await closeBuilt(built, `${suffix} source close`);
    }
  });

  await check('C9 owner cap missing/clone/foreign 均不能完成或被重铸', async () => {
    const foreign = await beforeRaw('c9_foreign');
    const cases = [
      ['missing', 'RUN_COMPLETION_INVALID', (result) => {
        const copy = { ...result };
        delete copy.runtimeOwnerAuthority;
        return copy;
      }],
      ['clone', 'RUN_COMPLETION_BINDING_MISMATCH', (result) => ({
        ...result,
        runtimeOwnerAuthority: { ...result.runtimeOwnerAuthority },
      })],
      ['foreign', 'RUN_COMPLETION_BINDING_MISMATCH', (result) => ({
        ...result,
        runtimeOwnerAuthority: foreign.sourceFresh.runtimeOwnerAuthority,
      })],
    ];
    for (const [suffix, reason, mutate] of cases) {
      const built = await beforeRaw(`c9_${suffix}`);
      const trusted = wrapRawIssuer(built, mutate);
      const result = await execute(built, trusted.issuer);
      expectReason(result, reason, `${suffix} owner`);
      assert(!result.rawExecutionAuthority && !result.sourceRuntimeOwnerAuthority,
        'owner 换绑失败不得铸 raw authority 或替代 owner');
      await closeBuilt(built, `${suffix} source close`);
    }
    await closeBuilt(foreign, 'unused foreign source close');
  });

  await check('C10 raw observation plain/clone/foreign 均由 canonical inspector 拒绝', async () => {
    const foreign = await beforeRaw('c10_foreign');
    const foreignIssuer = wrapRawIssuer(foreign);
    expectOk(await execute(foreign, foreignIssuer.issuer), 'foreign raw execution');
    const foreignObservation = foreignIssuer.results[0].rawObservationAuthority;
    // inspector 内部 plain/clone reason 在 completion 译为 INVALID；genuine foreign 译为 BINDING。
    const cases = [
      ['plain', 'RUN_COMPLETION_INVALID', () => Object.freeze(Object.create(null))],
      ['clone', 'RUN_COMPLETION_INVALID', (value) => ({ ...value })],
      ['foreign', 'RUN_COMPLETION_BINDING_MISMATCH', () => foreignObservation],
    ];
    for (const [suffix, reason, replacement] of cases) {
      const built = await beforeRaw(`c10_${suffix}`);
      const trusted = wrapRawIssuer(built, (result) => ({
        ...result,
        rawObservationAuthority: replacement(result.rawObservationAuthority),
      }));
      expectReason(await execute(built, trusted.issuer), reason, `${suffix} observation`);
      assert(built.stats.rawReplay === 1, 'observation 反例仍须真跑 raw');
      await closeBuilt(built, `${suffix} observation source close`);
    }
    await closeBuilt(foreign, 'foreign observation source close');
  });
}

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  for (const failure of failures) console.error(`  FAIL ${failure}`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
