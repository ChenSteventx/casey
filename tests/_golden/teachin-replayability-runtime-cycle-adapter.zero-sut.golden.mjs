#!/usr/bin/env node
// Three-runtime lifecycle ratchet:
// source evidence close -> independent guided compile close -> distilled evidence open.
// Pure object/runtime doubles; zero SUT/browser/network/LLM.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  api,
  assert,
  buildHappy,
  expectOk,
  expectReason,
  loadFailure,
  ready,
} from './support/teachin-replayability-equivalence-harness.mjs';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const TAG = 'teachin-replayability-runtime-cycle-adapter';
const FROZEN_VERDICT_SHA =
  'ff0923132193209dc55262a010bc4bdaadfec379445a82a150912f94dcb5cb53';
const failures = [];
let passed = 0;

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${TAG}: ${name}`);
  } catch (error) {
    const detail = String(error?.message || error).slice(-900);
    failures.push(`${name}: ${detail}`);
    console.error(`RED  ${TAG}: ${name}: ${detail}`);
  }
}

function source(relativePath) {
  const path = resolve(ROOT, relativePath);
  assert(existsSync(path), `缺 production file ${relativePath}`);
  return readFileSync(path, 'utf8');
}

function exactKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
}

async function closeSource(built) {
  return expectOk(await built.adapter.closeReplayRuntimeOwners({
    runtimeOwnerAuthority: built.sourceExecution.sourceRuntimeOwnerAuthority,
  }), 'source exact close');
}

async function runAuthoring(
  built, sourceClosed, entityLockAuthority,
) {
  return expectOk(await built.adapter.runAndSealDistilledCandidate({
    atomRoundtripGrant: built.resolution.atomRoundtrip.grant,
    sourceClosureAuthority: sourceClosed.sourceClosureAuthority,
    authoringBaselineGrant: built.sourceCompleted.authoringBaselineGrant,
    runNamespace: `run_authoring_${built.input.pairId}`,
    ...(entityLockAuthority === undefined ? {} : { entityLockAuthority }),
    executionTargetAuthority: built.execution.authority,
  }), 'guided compile authoring');
}

function finalizePair(built, sealed) {
  return expectOk(api.finalizeDualReplayPlanAuthority({
    sourcePlanAuthority: built.sourcePlan.authority,
    sourceCompletionAuthority: built.sourceCompleted.completionAuthority,
    distilledCandidateAuthority: sealed.distilledCandidateAuthority,
  }), 'pair finalization');
}

if (!ready) failures.push(`production API unavailable: ${loadFailure || 'FROZEN_API_MISSING'}`);

if (ready) {
  await check('Y1 source owner 必须先 close，随后 authoring fresh/reset/compile/close 恰一次', async () => {
    const built = await buildHappy('runtime_y1', { stopAfterSource: true });
    assert(built.sourceOwners.closeCalls === 0
      && built.stats.authoringOpen === 0
      && built.stats.atomRoundtrip === 0,
    'source semantic completion 后不得预开/预编译 authoring');
    const before = {
      raw: built.stats.rawReplay,
      axes: built.stats.axes,
      verdict: built.stats.verdict,
    };
    const sourceClosed = await closeSource(built);
    assert(exactKeys(sourceClosed, ['ok', 'sourceClosureAuthority'])
      && built.sourceOwners.closeCalls === 1,
    `source close 必须 exact 返回 closure：${JSON.stringify(sourceClosed)}`);

    const sealed = await runAuthoring(built, sourceClosed);
    assert(exactKeys(sealed, [
      'ok', 'distilledCandidateAuthority', 'authoringClosureAuthority',
    ]) && sealed.distilledCandidateAuthority && sealed.authoringClosureAuthority,
    `authoring success shape 不闭合：${JSON.stringify(sealed)}`);
    assert(built.stats.authoringOpen === 1
      && built.stats.authoringReset === 1
      && built.stats.createCompileRun === 1
      && built.stats.compileFlow === 1
      && built.stats.atomRoundtrip === 1
      && built.stats.authoringOwners?.closeCalls === 1,
    `authoring 必须 fresh/reset/createRun/compile/close 各一次：${JSON.stringify(built.stats)}`);
    assert(built.sourceOwners.closeCalls === 1,
      'authoring 不得重开或二次关闭 source owner');
    assert(built.stats.rawReplay === before.raw
      && built.stats.axes === before.axes
      && built.stats.verdict === before.verdict
      && built.stats.compiledReplay === 0,
    'guided compile 是物理作者执行，但不得重跑 source/产 axes/verdict/receipt');
  });

  await check('Y2 atom/baseline/source closure 三 authority 齐备前 authoring 调用数恒零', async () => {
    const attacks = [
      ['atomRoundtripGrant', 'ATOM_ROUNDTRIP_GRANT_INVALID'],
      ['authoringBaselineGrant', 'AUTHORING_BASELINE_GRANT_INVALID'],
      ['sourceClosureAuthority', 'REPLAY_RUNTIME_OWNERSHIP_MISMATCH'],
    ];
    for (const [field, reason] of attacks) {
      const built = await buildHappy(`runtime_y2_${field}`, { stopAfterSource: true });
      const sourceClosed = await closeSource(built);
      const valid = {
        atomRoundtripGrant: built.resolution.atomRoundtrip.grant,
        sourceClosureAuthority: sourceClosed.sourceClosureAuthority,
        authoringBaselineGrant: built.sourceCompleted.authoringBaselineGrant,
        runNamespace: `run_authoring_runtime_y2_${field}`,
        executionTargetAuthority: built.execution.authority,
      };
      expectReason(await built.adapter.runAndSealDistilledCandidate({
        ...valid,
        [field]: { ...valid[field] },
      }), reason, `clone ${field}`);
      assert(built.stats.authoringOpen === 0
        && built.stats.createCompileRun === 0
        && built.stats.compileFlow === 0,
      `${field} 无权不得 open/reset/compile`);
    }
  });

  await check('Y2b entity lock 只在 roundtrip+authoring close 后用 canonical events 验真', async () => {
    const built = await buildHappy('runtime_y2_entity', {
      stopAfterSource: true, entityMode: 'runtime-required',
    });
    const sourceClosed = await closeSource(built);
    const result = await built.adapter.runAndSealDistilledCandidate({
      atomRoundtripGrant: built.resolution.atomRoundtrip.grant,
      sourceClosureAuthority: sourceClosed.sourceClosureAuthority,
      authoringBaselineGrant: built.sourceCompleted.authoringBaselineGrant,
      runNamespace: 'run_authoring_runtime_y2_entity',
      entityLockAuthority: { ...built.entityLockAuthority },
      executionTargetAuthority: built.execution.authority,
    });
    expectReason(result, 'ENTITY_LOCK_AUTHORITY_INVALID', 'entity lock clone');
    assert(built.stats.authoringOpen === 1
      && built.stats.authoringOwners.closeCalls === 1
      && built.stats.entityVerify === 1
      && !result.distilledCandidateAuthority,
    'entity verifier 必须在 authoring exact close 后拒绝且不得铸 candidate');
  });

  await check('Y2c entity verifier 未授 runtime 权限时 fail-closed 且不铸 candidate', async () => {
    const built = await buildHappy('runtime_y2_entity_unauthorized', {
      stopAfterSource: true,
      entityMode: 'runtime-required',
      entityRuntimeAuthorized: false,
    });
    const sourceClosed = await closeSource(built);
    const result = await built.adapter.runAndSealDistilledCandidate({
      atomRoundtripGrant: built.resolution.atomRoundtrip.grant,
      sourceClosureAuthority: sourceClosed.sourceClosureAuthority,
      authoringBaselineGrant: built.sourceCompleted.authoringBaselineGrant,
      runNamespace: 'run_authoring_runtime_y2_entity_unauthorized',
      entityLockAuthority: built.entityLockAuthority,
      executionTargetAuthority: built.execution.authority,
    });
    expectReason(result, 'ENTITY_LOCK_RUNTIME_UNAUTHORIZED', 'entity runtime permission');
    assert(built.stats.authoringOpen === 1
      && built.stats.authoringOwners.closeCalls === 1
      && built.stats.entityVerify === 1
      && !result.distilledCandidateAuthority,
    'runtimeUnauthorized 必须在 exact authoring close 后拒绝且不得铸 candidate');
  });

  await check('Y2d verified entity set digest 与 source plan 不同不得 finalize pair', async () => {
    const built = await buildHappy('runtime_y2_entity_digest', {
      stopAfterSource: true,
      entitySetSha256: `sha256:${'9'.repeat(64)}`,
    });
    const sealed = await runAuthoring(built, await closeSource(built));
    expectReason(api.finalizeDualReplayPlanAuthority({
      sourcePlanAuthority: built.sourcePlan.authority,
      sourceCompletionAuthority: built.sourceCompleted.completionAuthority,
      distilledCandidateAuthority: sealed.distilledCandidateAuthority,
    }), 'PAIR_FINALIZATION_BINDING_MISMATCH', 'entity set digest mismatch');
    assert(built.stats.authoringOwners.closeCalls === 1
      && built.stats.distilledOpen === 0,
    'entity digest mismatch 只能在 authoring exact close 后阻断 pair/distilled');
  });

  await check('Y3 distilled 只认 authoring closure；source closure/clone 不得 open', async () => {
    const built = await buildHappy('runtime_y3', { stopAfterSource: true });
    const sourceClosed = await closeSource(built);
    const retainedSourceClosure = sourceClosed.sourceClosureAuthority;
    const sealed = await runAuthoring(built, sourceClosed);
    const finalized = finalizePair(built, sealed);
    const base = {
      pairAuthority: finalized.pairAuthority,
      runNamespace: 'run_distilled_runtime_y3',
      executionTargetAuthority: built.execution.authority,
    };
    for (const authoringClosureAuthority of [
      retainedSourceClosure,
      { ...sealed.authoringClosureAuthority },
      Object.freeze(Object.create(null)),
    ]) {
      expectReason(await built.adapter.prepareDistilledReplayRuntime({
        ...base,
        authoringClosureAuthority,
      }), 'REPLAY_RUNTIME_OWNERSHIP_MISMATCH', 'non-genuine authoring closure');
      assert(built.stats.distilledOpen === 0,
        '无权 closure 不得 launch distilled runtime');
    }
    const prepared = expectOk(await built.adapter.prepareDistilledReplayRuntime({
      ...base,
      authoringClosureAuthority: sealed.authoringClosureAuthority,
    }), 'genuine authoring closure prepares distilled');
    assert(exactKeys(prepared, [
      'ok', 'freshRuntimeAuthority', 'topologyAuthority', 'runtimeOwnerAuthority',
    ]) && built.stats.distilledOpen === 1,
    `distilled prepare 必须 exact trio：${JSON.stringify(prepared)}`);
    assert(built.sourceOwners !== built.stats.authoringOwners
      && built.stats.authoringOwners !== built.stats.distilledOwners
      && built.sourceOwners !== built.stats.distilledOwners,
    'source/authoring/distilled Browser/Context owner 必须三者不同');
    expectOk(await built.adapter.closeReplayRuntimeOwners({
      runtimeOwnerAuthority: prepared.runtimeOwnerAuthority,
    }), 'unused distilled runtime cleanup');
    assert(built.stats.distilledOwners.closeCalls === 1,
      'distilled exact owner 必须可关闭恰一次');
  });

  await check('Y4 full evidence path 只有 source raw + distilled formal 两次 evidence replay', async () => {
    const built = await buildHappy('runtime_y4');
    assert(built.stats.sourceOpen === 1
      && built.stats.rawReplay === 1
      && built.stats.compiledReplay === 1
      && built.stats.atomRoundtrip === 1,
    `两 evidence replay + 一 authoring chain 次数错：${JSON.stringify(built.stats)}`);
    assert(built.stats.axes === 2 && built.stats.verdict === 2,
      '只有 source/distilled evidence replay 各产一次 axes/verdict');
    assert(built.sourceOwners.closeCalls === 1
      && built.stats.authoringOwners.closeCalls === 1
      && built.stats.distilledOwners.closeCalls === 0,
    'source/authoring 已严格关闭，distilled 交 comparator 后由 caller finally 关闭');
    expectOk(await built.adapter.closeReplayRuntimeOwners({
      runtimeOwnerAuthority: built.distilledCompleted.distilledRuntimeOwnerAuthority,
    }), 'full path distilled close');
    assert(built.stats.distilledOwners.closeCalls === 1,
      'distilled evidence owner 最终关闭恰一次');
  });
}

await check('Y5 composer 薄装配专用 seams，接口钉三 runtime ratchet', () => {
  const composer = source('lib/teachin/runtime-cycle-adapter.mjs');
  for (const dependency of [
    'raw-event-observation',
    'raw-axes-adapter',
    'compile-runtime-adapter',
    'runtime-owner',
    'runtime-bootstrap',
    'prepared-run',
    'verdict-cli-adapter',
  ]) {
    assert(composer.includes(dependency), `composer 缺 ${dependency}`);
  }
  const observations = source('lib/teachin/raw-event-observation.mjs');
  const axes = source('lib/teachin/raw-axes-adapter.mjs');
  const compile = source('lib/teachin/compile-runtime-adapter.mjs');
  const prepared = source('lib/replay/prepared-run.mjs');
  assert(/\bcaptureIntentObservationBaseline\s*\(/.test(observations)
    && /\bcaptureIntentObservationTerminal\s*\(/.test(observations),
  'raw observer 必须实际调用 formal/raw 共用 observation primitives');
  assert(/\bprojectReplayAxes\s*\(/.test(axes)
    && /\bcanonicalVerdictCliAdapter\.runFrozenVerdict\s*\(/.test(axes),
  'raw axes seam 必须实际调用 current axes + frozen verdict');
  assert(/\bcreateCompileRun\s*\(/.test(compile)
    && /\bcompileFlow\s*\(/.test(compile)
    && /\bopenFreshAuthoringRuntime\s*\(/.test(compile),
  'guided compile seam 必须 fresh 后实际调用 current compiler');
  assert(/\brunReplayEvents\s*\(/.test(prepared)
    && /\bprojectReplayAxes\s*\(/.test(prepared),
  'prepared formal replay 必须实际调用 current event runner + axes');
  const sealSignature = composer.match(
    /(?:function\s+runAndSealDistilledCandidate|runAndSealDistilledCandidate\s*=\s*(?:async\s*)?)\s*\(\s*\{([^}]*)\}/s,
  )?.[1] || '';
  for (const field of [
    'atomRoundtripGrant', 'sourceClosureAuthority', 'authoringBaselineGrant',
    'runNamespace', 'entityLockAuthority', 'executionTargetAuthority',
  ]) {
    assert(new RegExp(`\\b${field}\\b`).test(sealSignature),
      `runAndSeal signature 缺 ${field}`);
  }
  assert(!/\b(?:resolutionAuthority|compileAdapter)\b/.test(sealSignature),
    'caller 禁止直传 resolution/compile adapter');
  assert(/import\s*\{[^}]*\bcanonicalEntityLockVerifier\b[^}]*\}\s*from\s*['"]\.\/entity-lock-verifier\.mjs['"]/s
    .test(composer)
    && /\bcanonicalEntityLockVerifier\.verify\s*\(/.test(composer)
    && /\bverificationScopeAuthority\s*:\s*authoringClosureAuthority\b/.test(composer)
    && /\bmode\b[\s\S]*?not-required/.test(composer)
    && /\bruntime-required\b[\s\S]*?\bruntimeAuthorized\b/.test(composer),
  'composer 必须放行 not-required，runtime-required 仍要求 runtimeAuthorized:true');
  const entityVerifier = source('lib/teachin/entity-lock-verifier.mjs');
  assert(/from\s+['"]\.\.\/entity-semantic-lock-v2\.mjs['"]/.test(entityVerifier)
    && /from\s+['"]\.\.\/entity-semantic-lock-publications\.mjs['"]/.test(entityVerifier)
    && /\bverifyEntityLockSet\s*\(/.test(entityVerifier),
  'entity verifier 必须复用现役 handle gate 与 publication digest root');
  assert(/import\s*\{[^}]*\bsealDistilledCandidateAuthority\b[^}]*\}\s*from\s*['"]\.\.\/dual-replay\/pair-authority\.mjs['"]/s
    .test(composer)
    && /\bsealDistilledCandidateAuthority\s*\(/.test(composer),
  'composer 必须由 pair-authority canonical sealer 铸 candidate');
  const candidateSeal = composer.match(
    /\bsealDistilledCandidateAuthority\s*\(\s*\{([^}]*)\}\s*\)/s,
  )?.[1] || '';
  for (const field of [
    'roundtripCandidate', 'authoringClosureAuthority',
    'verifiedEntityLockHandle', 'verifiedEntityLockSetSha256',
    'executionTargetAuthority',
  ]) {
    assert(new RegExp(`\\b${field}\\b`).test(candidateSeal),
      `candidate sealer call 缺 ${field}`);
  }
  assert(/\bverifiedEntityLockHandle\s*:\s*\w+\.handle\b/.test(candidateSeal)
    && /\bverifiedEntityLockSetSha256\s*:\s*\w+\.setSha256\b/.test(candidateSeal)
    && !/\bentityLockAuthority\b/.test(candidateSeal),
  'candidate 只能绑定 verifier 返回的 handle/digest，禁止绑定 raw entity authority');
  const pairAuthority = source('lib/dual-replay/pair-authority.mjs');
  const pairSeal = pairAuthority.match(
    /export\s+function\s+sealDistilledCandidateAuthority\s*\(\s*\{([^}]*)\}/s,
  )?.[1] || '';
  assert(pairSeal.split(',').map((part) => part.trim()).filter(Boolean).sort().join(',')
    === [
      'authoringClosureAuthority', 'executionTargetAuthority',
      'roundtripCandidate', 'verifiedEntityLockHandle',
      'verifiedEntityLockSetSha256',
    ].sort().join(','),
  `pair sealer signature 不闭合：${pairSeal}`);
  assert(!/\bsealDistilledCandidateAuthority\b/.test(
    source('lib/dual-replay/index.mjs'),
  ), 'internal candidate sealer 禁止从 public dual-replay façade 导出');
  const sourcePrepare = composer.match(
    /(?:function\s+prepareSourceReplayRuntime|prepareSourceReplayRuntime\s*=\s*(?:async\s*)?)\s*\(\s*\{([^}]*)\}/s,
  )?.[1] || '';
  assert(sourcePrepare.split(',').map((part) => part.trim()).filter(Boolean).sort().join(',')
    === [
      'executionTargetAuthority', 'recordingBrowser',
      'recordingContext', 'runNamespace',
    ].sort().join(','),
  `source prepare 必须 exact 四字段：${sourcePrepare}`);
  assert(/import\s*\{[^}]*\bcanonicalRuntimeBootstrap\b[^}]*\}\s*from\s*['"]\.\/runtime-bootstrap\.mjs['"]/s
    .test(composer)
    && /\bcanonicalRuntimeBootstrap\.openRuntime\s*\(\s*\{\s*role\s*:\s*['"]source['"]\s*,\s*executionTargetAuthority\s*,?\s*\}\s*\)/s
      .test(composer),
  'source prepare 必须在 recording close 后调用 canonical bootstrap exact source input');
  assert(!/\b(?:replayBrowser|replayContext|replayPage|topologyAuthority)\b/
    .test(sourcePrepare),
  'source prepare 禁止 caller 预开 replay handles/topology');
  const prepareSignature = composer.match(
    /(?:function\s+prepareDistilledReplayRuntime|prepareDistilledReplayRuntime\s*=\s*(?:async\s*)?)\s*\(\s*\{([^}]*)\}/s,
  )?.[1] || '';
  assert(/\bauthoringClosureAuthority\b/.test(prepareSignature)
    && !/\bsourceClosureAuthority\b/.test(prepareSignature),
  'distilled prepare 只可消费 authoring closure');
  assert(composer.split(/\r?\n/).length < 300,
    'runtime-cycle composer 应保持小于 300 行');
});

await check('Y6 frozen verdict 仍只经 execFile(shell:false) adapter，composer 无 judge 副本', () => {
  const composer = source('lib/teachin/runtime-cycle-adapter.mjs');
  const axes = source('lib/teachin/raw-axes-adapter.mjs');
  const adapter = source('lib/teachin/verdict-cli-adapter.mjs');
  const judge = readFileSync(resolve(ROOT, 'bin/verdict.mjs'));
  const oldPrd = JSON.parse(source('loop/prd-gen-prompts.json'));
  assert(createHash('sha256').update(judge).digest('hex') === FROZEN_VERDICT_SHA
    && oldPrd?.testChecksums?.['bin/verdict.mjs'] === FROZEN_VERDICT_SHA,
  'frozen verdict bytes/旧 PRD 锚漂移');
  assert(/from\s+['"]node:child_process['"]/.test(adapter)
    && /\bexecFile(?:Sync)?\s*\(/.test(adapter)
    && /\bshell\s*:\s*false\b/.test(adapter)
    && !/\bspawn(?:Sync)?\s*\(/.test(adapter),
  'verdict bridge 必须 execFile 参数数组 + shell:false，不得 spawn/shell');
  assert(!/(?:node:child_process|bin\/verdict\.mjs|execFile|spawn)/.test(
    `${composer}\n${axes}`,
  ), 'composer/raw axes 不得直连 child process 或 judge path');
  assert(!/\b(?:evaluateAssertions|decide|deriveActionPerformed|forensicsBacksSutError)\s*[=(]/
    .test(`${composer}\n${axes}`),
  'runtime seams 不得复制现役 assertion/verdict judge');
});

await check('Y7 runtime seam 文件逐个严格小于 600 行', () => {
  const files = [
    'lib/replay/intent-observation.mjs',
    'lib/teachin/raw-event-observation.mjs',
    'lib/teachin/raw-axes-adapter.mjs',
    'lib/teachin/compile-runtime-adapter.mjs',
    'lib/teachin/runtime-owner.mjs',
    'lib/replay/prepared-run.mjs',
    'lib/teachin/verdict-cli-adapter.mjs',
    'lib/teachin/runtime-cycle-adapter.mjs',
    'lib/teachin/entity-lock-verifier.mjs',
    'lib/dual-replay/pair-authority.mjs',
  ];
  const violations = [];
  for (const file of files) {
    const count = source(file).split(/\r?\n/).length;
    if (count >= 600) violations.push(`${file}:${count}`);
  }
  assert(violations.length === 0,
    `缺拆分或出现 >=600 行文件：${violations.join(', ')}`);
});

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
