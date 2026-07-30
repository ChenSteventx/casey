#!/usr/bin/env node
// 双回放 production wiring / authority-only API 静态门。零 SUT/browser/network/LLM。

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const TAG = 'teachin-replayability-equivalence-production-boundary';
const failures = [];
let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function source(rel) {
  const file = resolve(ROOT, rel);
  if (!existsSync(file)) throw new Error(`缺文件 ${rel}`);
  return readFileSync(file, 'utf8');
}

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${TAG}: ${name}`);
  } catch (error) {
    failures.push(`${name}: ${String(error?.message || error).slice(-900)}`);
    console.error(`RED  ${TAG}: ${name}: ${String(error?.message || error).slice(-900)}`);
  }
}

const DUAL_MODULES = [
  'lib/dual-replay/source-plan-authority.mjs',
  'lib/dual-replay/pair-authority.mjs',
  'lib/dual-replay/run-authority.mjs',
  'lib/dual-replay/replay-completion.mjs',
  'lib/dual-replay/receipt-shape.mjs',
  'lib/dual-replay/semantic-projection.mjs',
  'lib/dual-replay/comparator.mjs',
  'lib/dual-replay/index.mjs',
];
const RUNTIME_MODULES = [
  'lib/replay-actions.mjs',
  'lib/replay/event-runner.mjs',
  'lib/replay/intent-observation.mjs',
  'lib/replay/prepared-run.mjs',
  'lib/teachin/raw-event-observation.mjs',
  'lib/teachin/raw-axes-adapter.mjs',
  'lib/teachin/compile-runtime-adapter.mjs',
  'lib/teachin/runtime-owner.mjs',
  'lib/teachin/verdict-cli-adapter.mjs',
  'lib/teachin/runtime-cycle-adapter.mjs',
  'lib/teachin/dual-replay-orchestrator-core.mjs',
  'lib/teachin/dual-replay-orchestrator.mjs',
];
const SUPPORT_MODULES = [
  'tests/_golden/support/teachin-replayability-equivalence-harness.mjs',
];

function destructuredSignature(text, name) {
  return text.match(new RegExp(
    `(?:function\\s+${name}|${name}\\s*=\\s*(?:async\\s*)?)\\s*\\(\\s*\\{([^}]*)\\}\\s*\\)`,
    's',
  ))?.[1] || null;
}

await check('P1 production 双回放模块齐全且每文件严格小于 600 行', () => {
  const violations = [];
  for (const rel of [...DUAL_MODULES, ...RUNTIME_MODULES, ...SUPPORT_MODULES]) {
    const text = source(rel);
    const count = text.split(/\r?\n/).length;
    if (count >= 600) violations.push(`${rel}:${count}`);
  }
  assert(violations.length === 0, `缺拆分或超预算：${violations.join(', ')}`);
});

await check('P2 production facade 只静态绑定 canonical adapter，不开放 issuer/provider', () => {
  const facade = source('lib/teachin/dual-replay-orchestrator.mjs');
  const core = source('lib/teachin/dual-replay-orchestrator-core.mjs');
  assert(/import\s*\{[^}]*\bcanonicalRuntimeCycleAdapter\b[^}]*\}\s*from\s*['"]\.\/runtime-cycle-adapter\.mjs['"]/s
    .test(facade), 'orchestrator 必须静态导入 canonicalRuntimeCycleAdapter');
  assert(/\bcanonicalRuntimeCycleAdapter\b/.test(facade.replace(
    /import\s*\{[^}]*\}\s*from\s*['"][^'"]+['"];?/gs, '',
  )), 'orchestrator 必须实际把 canonical adapter 接到 core');
  const joined = `${facade}\n${core}`;
  for (const forbidden of [
    /\bcreateRuntimeCycleAdapter\b/,
    /\b(?:issuer|provider|adapterFactory)\s*[:=]/i,
    /\bimport\s*\(/,
    /\bprocess\.env\b|\bglobalThis\b/,
    /(?:test|fixture)-support|mintForTest/i,
    /\b(?:fresh|clean|reset|equivalent)\s*[:=]\s*true\b/,
  ]) {
    assert(!forbidden.test(joined), `production orchestrator 越界：${forbidden}`);
  }
});

await check('P3 composer 薄装配，现役 observation/axes/verdict/compile 各在专用 seam', () => {
  const composer = source('lib/teachin/runtime-cycle-adapter.mjs');
  for (const dependency of [
    'raw-event-observation', 'raw-axes-adapter', 'compile-runtime-adapter',
    'runtime-owner', 'prepared-run', 'verdict-cli-adapter',
  ]) {
    assert(composer.includes(dependency), `composer 缺 canonical seam ${dependency}`);
  }
  for (const symbol of [
    'createRuntimeCycleAdapter', 'canonicalRuntimeCycleAdapter',
    'runAndSealDistilledCandidate', 'prepareSourceReplayRuntime',
    'claimPreparedSourceReplayRuntime', 'disposePreparedSourceReplayRuntime',
    'openFreshAuthoringRuntime', 'prepareDistilledReplayRuntime',
    'closeReplayRuntimeOwners',
  ]) {
    assert(new RegExp(`\\b${symbol}\\b`).test(composer), `composer 缺 ${symbol}`);
  }
  const observations = source('lib/teachin/raw-event-observation.mjs');
  assert(observations.includes('intent-observation')
    && /\bcaptureIntentObservationBaseline\s*\(/.test(observations)
    && /\bcaptureIntentObservationTerminal\s*\(/.test(observations),
  'raw observer 必须实际调用 formal/raw 共用 observation primitives');

  const axes = source('lib/teachin/raw-axes-adapter.mjs');
  assert(axes.includes('replay-axes') && axes.includes('verdict-cli-adapter')
    && /\bprojectReplayAxes\s*\(/.test(axes)
    && /\bcanonicalVerdictCliAdapter\.runFrozenVerdict\s*\(/.test(axes),
  'raw axes seam 必须接现役 projector + 唯一 frozen verdict adapter');

  const compile = source('lib/teachin/compile-runtime-adapter.mjs');
  assert(compile.includes('compile-atoms')
    && /\bcreateCompileRun\s*\(/.test(compile)
    && /\bcompileFlow\s*\(/.test(compile)
    && /\bopenFreshAuthoringRuntime\s*\(/.test(compile),
  'compile runtime 必须独立 fresh 后真调用 createCompileRun + compileFlow');

  const prepared = source('lib/replay/prepared-run.mjs');
  assert(prepared.includes('event-runner') && prepared.includes('replay-axes')
    && /\brunReplayEvents\s*\(/.test(prepared)
    && /\bprojectReplayAxes\s*\(/.test(prepared),
  'prepared formal replay 必须复用现役 event runner + axes');
  assert(!/(?:child_process|bin\/verdict\.mjs)/.test(`${composer}\n${axes}`)
    && !/\bmintForTest\b|testOnly|developmentAuthority/i.test(composer),
  'runtime seams 禁止直连 judge path 或 test-only mint');
});

await check('P4 owner/fresh 三 capability exact-bind，completion 只转移不重铸', () => {
  const run = source('lib/dual-replay/run-authority.mjs');
  const completion = source('lib/dual-replay/replay-completion.mjs');
  const adapter = source('lib/teachin/runtime-cycle-adapter.mjs');
  const prepareSource = destructuredSignature(adapter, 'prepareSourceReplayRuntime');
  assert(prepareSource?.split(',').map((part) => part.trim()).filter(Boolean).sort().join(',')
    === [
      'executionTargetAuthority', 'recordingBrowser',
      'recordingContext', 'runNamespace',
    ].sort().join(','),
  'prepareSourceReplayRuntime 必须 exact recording handles + namespace + target');
  assert(!/\bsourcePlanAuthority\b/.test(prepareSource),
    'prepareSourceReplayRuntime 禁止反向依赖尚未 claim 的 source plan');
  assert(!/\b(?:replayBrowser|replayContext|replayPage|topologyAuthority)\b/.test(prepareSource),
    'prepareSourceReplayRuntime 禁止 caller 预开 source runtime');
  const claimSource = destructuredSignature(adapter, 'claimPreparedSourceReplayRuntime');
  assert(claimSource, 'adapter 缺 claimPreparedSourceReplayRuntime destructured 接口');
  for (const field of [
    'sourceRuntimePreparationAuthority',
    'sourcePlanAuthority',
    'runNamespace',
    'executionTargetAuthority',
  ]) {
    assert(new RegExp(`\\b${field}\\b`).test(claimSource), `source claim 缺 ${field}`);
  }
  assert(/\bfreshRuntimeAuthority\b/.test(adapter)
    && /\btopologyAuthority\b/.test(adapter)
    && /\bruntimeOwnerAuthority\b/.test(adapter),
  'source claim 必须转移 fresh/topology/owner trio');
  for (const name of ['authorizeSourceReplay', 'authorizeDistilledReplay']) {
    const signature = destructuredSignature(run, name);
    assert(signature, `run-authority 缺 ${name} destructured 接口`);
    for (const field of [
      'freshRuntimeAuthority',
      'topologyAuthority',
      'runtimeOwnerAuthority',
      'executionTargetAuthority',
    ]) {
      assert(new RegExp(`\\b${field}\\b`).test(signature),
        `${name} 缺 exact ${field}`);
    }
  }
  assert(/executeAndVerify\s*\(\s*\{\s*runExecutionAuthority\s*\}\s*\)/s.test(completion),
    'completion 必须只把 opaque runExecutionAuthority 给 issuer');
  assert(/\bruntimeOwnerAuthority\b/.test(completion)
    && /\bsourceRuntimeOwnerAuthority\b/.test(completion)
    && /\bdistilledRuntimeOwnerAuthority\b/.test(completion),
  'completion 缺 issuer owner identity 校验或 role-specific transfer');
  assert(!/\bruntimeOwnerAuthority\s*:\s*Object\.(?:freeze|create)\b/.test(completion),
    'completion 禁止自铸 runtime owner capability');
  assert(/inspectCleanRawReplayAuthority/.test(completion)
    && /inspectRawEventObservationAuthority/.test(completion)
    && !/consumeCleanRawReplay\s*\(/.test(completion),
  'raw execution 必须 non-consuming inspect CLEAN + event observations');
});

await check('P5 public staged API 禁止 caller 填 artifacts/evidence/reset/fresh facts', () => {
  const pair = source('lib/dual-replay/pair-authority.mjs');
  const receipt = source('lib/dual-replay/receipt-shape.mjs');
  const run = source('lib/dual-replay/run-authority.mjs');
  const finalize = destructuredSignature(pair, 'finalizeDualReplayPlanAuthority');
  assert(finalize, '缺 finalizeDualReplayPlanAuthority destructured 接口');
  for (const required of [
    'sourcePlanAuthority',
    'sourceCompletionAuthority',
    'distilledCandidateAuthority',
  ]) {
    assert(new RegExp(`\\b${required}\\b`).test(finalize), `finalize 缺 ${required}`);
  }
  for (const forbidden of ['candidateBytes', 'eventsBytes', 'entityLockBytes', 'distilled']) {
    assert(!new RegExp(`\\b${forbidden}\\b`).test(finalize),
      `finalize 禁止 caller 直传 ${forbidden}`);
  }
  const createReceipt = destructuredSignature(receipt, 'createSemanticReplayReceipt');
  assert(createReceipt && /^\s*completionAuthority\s*,?\s*$/.test(createReceipt),
    'receipt create 只能接受 completionAuthority');
  assert(!/\bconsumeFreshReplayRuntimeAuthority\s*\(/.test(run),
    'run-authority authorize 禁止提前消费 fresh');

  const facade = source('lib/dual-replay/index.mjs');
  assert(!/\bcreateResetAuthority\b/.test(facade)
    && !/\bcreateFreshReplayWitness\b|\bauthorizeFreshReplayRuntime\b/.test(facade),
  'dual facade 禁止导出 reset/fresh issuer');
});

await check('P6 两相 source 与独立 authoring runtime 接口不能被 caller 拼接', () => {
  const completion = source('lib/dual-replay/replay-completion.mjs');
  const adapter = source('lib/teachin/runtime-cycle-adapter.mjs');
  const raw = destructuredSignature(completion, 'executeAuthorizedSourceReplay');
  assert(raw && /\brunAuthority\b/.test(raw) && /\btrustedRawReplayIssuer\b/.test(raw),
    '缺 executeAuthorizedSourceReplay exact 接口');
  assert(!/\b(?:axesBytes|verdictBytes|evidence)\b/.test(raw),
    'raw execute 禁止 caller semantic fields');
  const resolved = destructuredSignature(completion, 'completeResolvedSourceReplay');
  for (const field of [
    'rawExecutionAuthority', 'sourceSemanticGrant', 'trustedResolvedSourceIssuer',
  ]) {
    assert(resolved && new RegExp(`\\b${field}\\b`).test(resolved),
      `resolved completion 缺 ${field}`);
  }
  const seal = destructuredSignature(adapter, 'runAndSealDistilledCandidate');
  for (const field of [
    'atomRoundtripGrant', 'sourceClosureAuthority', 'authoringBaselineGrant',
    'runNamespace', 'entityLockAuthority', 'executionTargetAuthority',
  ]) {
    assert(seal && new RegExp(`\\b${field}\\b`).test(seal),
      `runAndSealDistilledCandidate 缺 ${field}`);
  }
  assert(!/\b(?:resolutionAuthority|compileAdapter)\b/.test(seal),
    'runAndSeal 禁止 caller 直传 resolution 或 compile adapter');
  const prepareDistilled = destructuredSignature(adapter, 'prepareDistilledReplayRuntime');
  assert(prepareDistilled && /\bauthoringClosureAuthority\b/.test(prepareDistilled)
    && !/\bsourceClosureAuthority\b/.test(prepareDistilled),
  'distilled prepare 必须只消费 authoring closure，保持三 runtime 串行');
});

await check('P7 core modules 无 browser/fs/network/LLM，failure 不泄异常或目标', () => {
  const forbidden = [
    /from\s+['"]node:(?:fs|child_process|http|https|net|tls)['"]/,
    /from\s+['"]@playwright\//,
    /\b(?:openai|anthropic|grok|deepseek)\b/i,
    /\bconsole\.(?:log|error)\s*\(/,
    /\bprocess\.env\b|https?:\/\/|\.(?:cookies|storageState)\s*\(/,
  ];
  const violations = [];
  for (const rel of DUAL_MODULES) {
    const text = source(rel);
    for (const pattern of forbidden) {
      if (pattern.test(text)) violations.push(`${rel}:${pattern}`);
    }
  }
  assert(violations.length === 0, `dual pure core 越界：${violations.join(', ')}`);
});

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  for (const failure of failures) console.error(`  FAIL ${failure}`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
