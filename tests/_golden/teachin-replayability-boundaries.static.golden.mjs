#!/usr/bin/env node
// teachin replayability 结构门：零 browser、零 SUT、零 network。

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const TAG = 'teachin-replayability-boundaries';
const failures = [];
let passed = 0;

function source(rel) {
  const file = resolve(ROOT, rel);
  if (!existsSync(file)) throw new Error(`缺文件 ${rel}`);
  return readFileSync(file, 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${TAG}: ${name}`);
  } catch (error) {
    failures.push(`${name}: ${String(error?.message || error).slice(-700)}`);
    console.error(`RED  ${TAG}: ${name}: ${String(error?.message || error).slice(-700)}`);
  }
}

const PRODUCTION_MODULES = [
  'lib/teachin/fresh-runtime.mjs',
  'lib/teachin/raw-capture.mjs',
  'lib/teachin/raw-action.mjs',
  'lib/teachin/raw-replay-runner.mjs',
  'lib/teachin/raw-playwright-driver.mjs',
  'lib/teachin/raw-event-observation.mjs',
  'lib/teachin/raw-axes-adapter.mjs',
  'lib/teachin/raw-proof.mjs',
  'lib/teachin/raw-proof-output.mjs',
  'lib/teachin/verdict-cli-adapter.mjs',
  'lib/teachin/compile-runtime-adapter.mjs',
  'lib/teachin/runtime-bootstrap.mjs',
  'lib/teachin/entity-lock-verifier.mjs',
  'lib/teachin/replayability-cycle-entry.mjs',
  'lib/teachin/runtime-owner.mjs',
  'lib/teachin/resolved-projection.mjs',
  'lib/teachin/atom-roundtrip.mjs',
  'lib/teachin/replayability-cycle-entry.mjs',
  'lib/teachin/dual-replay-orchestrator-core.mjs',
  'lib/teachin/dual-replay-orchestrator.mjs',
  'lib/teachin/runtime-cycle-adapter.mjs',
  'lib/teachin-distillation/event-projection.mjs',
  'lib/teachin-distillation/atom-resolution.mjs',
  'lib/teachin-distillation/fidelity.mjs',
  'lib/teachin-distillation/flow-candidate.mjs',
  'lib/teachin-distillation/compile-lineage.mjs',
  'lib/teachin-distillation/formal-candidate.mjs',
  'lib/dual-replay/source-plan-authority.mjs',
  'lib/dual-replay/entity-lock-handle.mjs',
  'lib/dual-replay/pair-authority.mjs',
  'lib/dual-replay/run-authority.mjs',
  'lib/dual-replay/replay-completion.mjs',
  'lib/dual-replay/receipt-shape.mjs',
  'lib/dual-replay/semantic-projection.mjs',
  'lib/dual-replay/comparator.mjs',
  'lib/dual-replay/index.mjs',
  'lib/replay/action-authority.mjs',
  'lib/replay/intent-observation.mjs',
  'lib/replay/prepared-run.mjs',
  'lib/replay-actions.mjs',
  'lib/replay-axes.mjs',
  'lib/replay/event-runner.mjs',
  'lib/compile-atoms.mjs',
  'lib/compile-atoms-run.mjs',
  'lib/compile-atoms-flow.mjs',
  'lib/page-topology/semantic-projection.mjs',
];

const PURE_MODULES = PRODUCTION_MODULES.filter((rel) => ![
  'lib/teachin/raw-proof-output.mjs',
  'lib/teachin/verdict-cli-adapter.mjs',
  'lib/teachin/raw-playwright-driver.mjs',
  'lib/teachin/raw-axes-adapter.mjs',
  'lib/teachin/compile-runtime-adapter.mjs',
  'lib/teachin/runtime-bootstrap.mjs',
  'lib/teachin/entity-lock-verifier.mjs',
  'lib/teachin/runtime-owner.mjs',
  'lib/teachin/dual-replay-orchestrator.mjs',
  'lib/teachin/runtime-cycle-adapter.mjs',
  'lib/replay/intent-observation.mjs',
  'lib/replay/prepared-run.mjs',
  'lib/replay-actions.mjs',
  'lib/replay/event-runner.mjs',
  'lib/compile-atoms.mjs',
  'lib/compile-atoms-run.mjs',
  'lib/compile-atoms-flow.mjs',
].includes(rel));

const CLI_MODULES = [
  'bin/teachin-raw-replay.mjs',
  'bin/teachin-cycle.mjs',
  'bin/record.mjs',
  'bin/casey.mjs',
];
const FROZEN_DEPENDENCIES = [
  'bin/verdict.mjs',
  'lib/login-bootstrap.mjs',
  'lib/replay-forensics.mjs',
  'lib/entity-semantic-lock-v2.mjs',
  'lib/entity-semantic-lock-publications.mjs',
  'lib/entity-semantic-lock-preflight.mjs',
  'lib/promptset-authoring.mjs',
  'lib/execution-target/runtime.mjs',
  'lib/execution-target/wiring.mjs',
  'lib/page-topology/replay-session.mjs',
  'lib/replay/origin-admission.mjs',
  'lib/flow-bridge.mjs',
  'lib/atoms-registry.snapshot.json',
];

const GOLDEN_MODULES = readdirSync(resolve(ROOT, 'tests/_golden'))
  .filter((name) => /^teachin-replayability-.*\.golden\.mjs$/.test(name))
  .map((name) => `tests/_golden/${name}`);

function walkMjs(directory, prefix) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walkMjs(resolve(directory, entry.name), `${prefix}/${entry.name}`)
      : entry.isFile() && entry.name.endsWith('.mjs')
        ? [`${prefix}/${entry.name}`] : []);
}

await check('B1 新增生产、CLI 与本契约 golden 在场且逐个严格小于 600 行', () => {
  for (const rel of FROZEN_DEPENDENCIES) source(rel);
  const violations = [];
  for (const rel of [
    ...PRODUCTION_MODULES, ...CLI_MODULES, ...GOLDEN_MODULES,
    'tests/_golden/support/teachin-replayability-equivalence-harness.mjs',
  ]) {
    const text = source(rel);
    const lines = text.split(/\r?\n/).length;
    if (lines >= 600) violations.push(`${rel}:${lines}`);
  }
  assert(violations.length === 0, `超行文件：${violations.join(', ')}`);
});

await check('B2 选定确定性核心不直接导入/执行 browser、fs、network、LLM、verdict 或 report', () => {
  const forbidden = [
    /from\s+['"]node:(?:fs|child_process|http|https|net|tls)['"]/,
    /from\s+['"]@playwright\//,
    /import\s*\(\s*['"]@playwright\//,
    /(?:^|\/)(?:verdict|report)(?:\.mjs)?['"]/m,
    /\b(?:openai|anthropic|grok|deepseek)\b/i,
  ];
  const violations = [];
  for (const rel of PURE_MODULES) {
    const text = source(rel);
    for (const re of forbidden) if (re.test(text)) violations.push(`${rel}:${re}`);
  }
  assert(violations.length === 0, `纯核心越界：${violations.join(', ')}`);
});

await check('B3 raw runner 把 nav 当 checkpoint，禁止导航修正', () => {
  const text = source('lib/teachin/raw-replay-runner.mjs');
  assert(/PATH_CHECKPOINT_(?:MISMATCH|UNAVAILABLE)/.test(text),
    'raw runner 缺 path checkpoint 稳定拒绝');
  assert(!/\.goto\s*\(|\.goBack\s*\(|\.reload\s*\(/.test(text),
    'raw runner 禁止 goto/goBack/reload 修正页面');
  assert(/page-topology|consumeNewPage|newpage/.test(text),
    'raw runner 必须消费现役 page topology/newpage 接缝');
});

await check('B4 CLI 是薄接线且 casey 对 teachin-cycle 做真实 dispatch', () => {
  const rawCli = source('bin/teachin-raw-replay.mjs');
  const cycleCli = source('bin/teachin-cycle.mjs');
  const casey = source('bin/casey.mjs');
  assert(/teachin\/(?:raw-replay-runner|raw-capture|fresh-runtime)/.test(rawCli),
    'raw CLI 未委托 teachin core');
  assert(/import\s*\{[^}]*\bwriteRawReplayProof\b[^}]*\}\s*from\s*['"]\.\.\/lib\/teachin\/raw-proof-output\.mjs['"]/s
    .test(rawCli),
  'raw CLI 必须委托 canonical raw proof output seal');
  assert(!/\b(?:writeFileSync|renameSync)\s*\(/.test(rawCli),
    'raw CLI 禁止自建 direct write/rename 半文件协议');
  assert(/\brecord\.mjs\b/.test(cycleCli)
    && !/\b(?:runTeachinReplayabilityCycle|runRawReplay|admitAndRunRawReplay)\b/.test(cycleCli),
  'teachin-cycle 只能薄别名 dispatch 到同进程录制入口');
  assert(/case\s+['"]teachin-cycle['"]\s*:[\s\S]*?\brunNode\s*\(\s*path\.join\s*\(\s*PROJECT_ROOT\s*,\s*['"]bin['"]\s*,\s*['"]teachin-cycle\.mjs['"]\s*\)\s*,\s*rest\s*\)/.test(casey),
    'casey 必须有 switch case 真实 dispatch，帮助字符串不算接线');
  for (const [rel, text] of [['bin/teachin-raw-replay.mjs', rawCli], ['bin/teachin-cycle.mjs', cycleCli]]) {
    assert(!/\bverdict\b|\bPASS\b/.test(text), `${rel} 不得自行裁定`);
  }
});

await check('B5 现役 capture 继续是未签、不可直接回放的蒸馏语料', () => {
  const text = source('lib/record-capture.mjs');
  assert(/signed:\s*false/.test(text), 'capture signed:false 丢失');
  assert(/replayReady:\s*false/.test(text), 'capture replayReady:false 丢失');
  assert(/distillRequired:\s*true/.test(text), 'capture distillRequired:true 丢失');
  assert(!/signed:\s*true|replayReady:\s*true/.test(text),
    'capture 不得被技术复现提升为正式资产');
});

await check('B6 dual 只封存 fresh；canonical replay 边界才原子消费', () => {
  const orchestrator = source('lib/teachin/dual-replay-orchestrator-core.mjs');
  const runAuthority = source('lib/dual-replay/run-authority.mjs');
  const rawRunner = source('lib/teachin/raw-replay-runner.mjs');
  assert(/freshRuntimeAuthority/.test(orchestrator), 'orchestrator 缺 freshRuntimeAuthority');
  assert(/cleanProofAuthority/.test(orchestrator), 'orchestrator 缺 cleanProofAuthority');
  assert(/pairAuthority/.test(orchestrator), 'orchestrator 缺 pairAuthority');
  for (const [rel, text] of [
    ['dual-replay-orchestrator-core', orchestrator],
    ['run-authority', runAuthority],
  ]) {
    assert(/\btopologyAuthority\b/.test(text), `${rel} 缺 topologyAuthority`);
    assert(!/\bpageTopology\b/.test(text), `${rel} 禁止旧参数 pageTopology`);
  }
  assert(!/\bconsumeFreshReplayRuntimeAuthority\b/.test(runAuthority),
    'run-authority 只能封存 fresh，禁止在 authorize 阶段提前消费');
  assert(/import\s*\{[^}]*\bconsumeFreshReplayRuntimeAuthority\b[^}]*\}\s*from\s*['"]\.\/fresh-runtime\.mjs['"]/s
    .test(rawRunner),
  'raw runner 必须从 canonical fresh-runtime 导入唯一 consumer');
  assert(/consumeFreshReplayRuntimeAuthority\s*\(\s*\{[^}]*freshRuntimeAuthority[^}]*topologyAuthority[^}]*\}\s*\)/s
    .test(rawRunner),
  'raw runner 实际执行必须携 freshRuntimeAuthority + topologyAuthority 原子消费');
  assert(!/\b(?:fresh|clean|equivalent)\s*[:=]\s*true\b/.test(orchestrator),
    'orchestrator 禁止用布尔自报 authority');
});

await check('B7 createResetAuthority 只接受 trusted issuer 验证结果', () => {
  const runAuthority = source('lib/dual-replay/run-authority.mjs');
  const signature = runAuthority.match(
    /(?:function\s+createResetAuthority|createResetAuthority\s*=\s*(?:async\s*)?)\s*\(\s*\{([^}]*)\}\s*\)/s,
  );
  assert(signature, 'run-authority 缺 createResetAuthority destructured 接口');
  for (const field of ['replayPlanAuthority', 'role', 'runNamespace', 'trustedResetIssuer']) {
    assert(new RegExp(`\\b${field}\\b`).test(signature[1]),
      `createResetAuthority 缺参数 ${field}`);
  }
  for (const forbidden of [
    'resetReceiptBytes',
    'resetPlanDigest',
    'baselineProjectionSha256',
  ]) {
    assert(!new RegExp(`\\b${forbidden}\\b`).test(signature[1]),
      `调用方不得向 createResetAuthority 直传 ${forbidden}`);
  }
  assert(/trustedResetIssuer\.verifyReset\s*\(\s*\{\s*replayPlanAuthority\s*,\s*role\s*,\s*runNamespace\s*,?\s*\}\s*\)/s
    .test(runAuthority),
  'createResetAuthority 必须调用 trustedResetIssuer.verifyReset 精确三字段接口');
  const verifiedObject = runAuthority.match(
    /const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?trustedResetIssuer\.verifyReset\s*\(/,
  );
  const verifiedDestructure = runAuthority.match(
    /const\s*\{([^}]*)\}\s*=\s*(?:await\s+)?trustedResetIssuer\.verifyReset\s*\(/s,
  );
  assert(verifiedObject || verifiedDestructure,
    'verifyReset 返回值必须绑定为唯一 reset facts 来源');
  for (const fact of [
    'resetReceiptBytes',
    'resetPlanDigest',
    'baselineProjectionSha256',
  ]) {
    const usesVerifiedObject = verifiedObject
      && new RegExp(`\\b${verifiedObject[1]}\\.${fact}\\b`).test(runAuthority);
    const usesVerifiedDestructure = verifiedDestructure
      && new RegExp(`\\b${fact}\\b`).test(verifiedDestructure[1]);
    assert(usesVerifiedObject || usesVerifiedDestructure,
      `createResetAuthority 必须只使用 verifyReset 返回的 ${fact}`);
  }
  assert(!/\btrusted\s*[:=]\s*true\b/.test(runAuthority),
    'reset issuer 禁止 trusted:true 自报');

  const facade = source('lib/dual-replay/index.mjs');
  assert(!/export\s+(?:async\s+)?(?:function|const|let|var)\s+createResetAuthority\b/.test(facade)
    && !/export\s*\{[^}]*\bcreateResetAuthority\b[^}]*\}/s.test(facade),
  'createResetAuthority 只允许 run-authority 模块面，不得从 index facade 导出');
});

await check('B8 dual-replay 禁止第二 fresh issuer 或 shadow fresh-runtime 模块', () => {
  assert(!existsSync(resolve(ROOT, 'lib/dual-replay/fresh-runtime.mjs')),
    '禁止 lib/dual-replay/fresh-runtime.mjs shadow canonical issuer');
  const violations = [];
  for (const rel of PURE_MODULES.filter((item) => item.startsWith('lib/dual-replay/'))) {
    if (/\bcreateFreshRuntimeAuthority\b/.test(source(rel))) violations.push(rel);
  }
  assert(violations.length === 0,
    `dual-replay 禁止第二 createFreshRuntimeAuthority：${violations.join(', ')}`);
});

await check('B9 raw runner 导出 admission 边界并拆 resolve→perform 两阶段', () => {
  const text = source('lib/teachin/raw-replay-runner.mjs');
  assert(/export\s+(?:async\s+)?function\s+admitAndRunRawReplay\b/.test(text)
    || /export\s+const\s+admitAndRunRawReplay\b/.test(text)
    || /export\s*\{[^}]*\badmitAndRunRawReplay\b[^}]*\}/s.test(text),
  'raw runner 必须导出 admitAndRunRawReplay');
  const resolveCall = text.search(/actionDriver\.resolve\s*\(/);
  const performCall = text.search(/actionDriver\.perform\s*\(/);
  assert(resolveCall >= 0, 'raw runner 缺 actionDriver.resolve');
  assert(performCall > resolveCall, 'actionDriver.perform 必须位于 resolve gate 之后');
  assert(/\bcandidateCount\b/.test(text) && /\bactionAuthority\b/.test(text),
    'resolve→perform 之间必须有 candidateCount + actionAuthority gate');
  assert(!/actionDriver\.perform\s*\(\s*\{\s*event\b/.test(text),
    'perform 禁止直接接 event 绕过 resolver authority');
});

await check('B10 resolved projection 只用 admitted capture bytes 消费 CLEAN proof', () => {
  const text = source('lib/teachin/resolved-projection.mjs');
  assert(/import\s*\{[^}]*\binspectAdmittedRawReplayCapture\b[^}]*\}\s*from\s*['"]\.\/raw-capture\.mjs['"]/s
    .test(text),
  'resolved projection 必须从 raw-capture 导入 canonical inspector');
  assert(/import\s*\{[^}]*\bconsumeCleanRawReplay\b[^}]*\}\s*from\s*['"]\.\/raw-proof\.mjs['"]/s
    .test(text),
  'resolved projection 必须从 raw-proof 导入 CLEAN consumer');
  const signature = text.match(
    /(?:function\s+resolveCaptureProjection|resolveCaptureProjection\s*=\s*(?:async\s*)?)\s*\(\s*\{([^}]*)\}\s*\)/s,
  );
  assert(signature, 'resolved projection 缺 resolveCaptureProjection destructured 接口');
  assert(!/\b(?:captureBytes|currentCaptureBytes)\b/.test(signature[1]),
    'resolved projection 禁止调用方另传未绑定 capture bytes');
  const inspectCall = text.search(/inspectAdmittedRawReplayCapture\s*\(/);
  const consumeCall = text.search(/consumeCleanRawReplay\s*\(/);
  assert(inspectCall >= 0 && consumeCall > inspectCall,
    '必须先 inspect captureAuthority，再消费 cleanProofAuthority');
  const inspectedObject = text.match(
    /const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?inspectAdmittedRawReplayCapture\s*\(/,
  );
  const inspectedDestructure = text.match(
    /const\s*\{([^}]*)\}\s*=\s*(?:await\s+)?inspectAdmittedRawReplayCapture\s*\(/s,
  );
  const usesInspectedBytes = inspectedObject
    && new RegExp(
      `consumeCleanRawReplay\\s*\\(\\s*\\{[^}]*currentCaptureBytes\\s*:\\s*${inspectedObject[1]}\\.captureBytes\\b`,
      's',
    ).test(text);
  const usesDestructuredBytes = inspectedDestructure
    && /\bcaptureBytes\b/.test(inspectedDestructure[1])
    && /consumeCleanRawReplay\s*\(\s*\{[^}]*currentCaptureBytes\s*:\s*captureBytes\b/s.test(text);
  assert(usesInspectedBytes || usesDestructuredBytes,
  'CLEAN consumer 的 currentCaptureBytes 必须来自 admitted inspector');
});

await check('B11 record→entry→core 同进程交权，source raw 只有 core 一次', () => {
  const record = source('bin/record.mjs');
  const entry = source('lib/teachin/replayability-cycle-entry.mjs');
  const adapter = source('lib/teachin/runtime-cycle-adapter.mjs');
  assert(/import\s*\{[^}]*\brunRecordedTeachinReplayabilityCycle\b[^}]*\}\s*from\s*['"]\.\.\/lib\/teachin\/replayability-cycle-entry\.mjs['"]/s
    .test(record) && /\brunRecordedTeachinReplayabilityCycle\s*\(/.test(record),
  'record login-bootstrap 分支必须交同进程 recording handles 给 application service');
  assert(/if\s*\([^)]*(?:\bloginBootstrap\b|['"]login-bootstrap['"])[^)]*\)[\s\S]*?\brunRecordedTeachinReplayabilityCycle\s*\(/.test(record),
    '首发 full-cycle 只允许 login-bootstrap；no-login 仍是 capture-only');
  assert(/\brecordingOwnerTransferred\s*=\s*true\b[\s\S]*?\brunRecordedTeachinReplayabilityCycle\s*\(/.test(record)
    && /\bfinally\b[\s\S]*?if\s*\(\s*!recordingOwnerTransferred\s*\)[\s\S]*?\.close\s*\(/.test(record),
  'record handoff 后 finally 禁止二次 close；handoff 前仍须自行 cleanup');
  for (const forbidden of [/\badmitAndRunRawReplay\b/, /\brunRawReplay\b/]) {
    assert(!forbidden.test(`${record}\n${entry}`), `record/entry 禁止第二 source raw：${forbidden}`);
  }
  const admit = entry.search(/\badmitRawReplayCapture\s*\(/);
  const prepare = entry.search(/\bprepareSourceReplayRuntime\s*\(/);
  const cycle = entry.search(/\brunTeachinReplayabilityCycle\s*\(/);
  assert(admit >= 0 && prepare > admit && cycle > prepare,
    'entry 唯一顺序必须 admission→source prepare→orchestrator façade');
  assert(!/\b(?:replayBrowser|replayContext|replayPage|topologyAuthority|sourceRuntimePreparationAuthority)\b/.test(record),
    'record/caller 禁止预开 replay handles 或重建 opaque preparation cap');
  const witness = adapter.search(/\bcreateFreshReplayWitness\s*\(/);
  const contextClose = adapter.search(/\brecordingContext\.close\s*\(/);
  const browserClose = adapter.search(/\brecordingBrowser\.close\s*\(/);
  const sourceOpen = adapter.search(/\bcanonicalRuntimeBootstrap\.openRuntime\s*\(/);
  const authorize = adapter.search(/\bauthorizeFreshReplayRuntime\s*\(/);
  assert(witness >= 0 && contextClose > witness && browserClose > contextClose
    && sourceOpen > browserClose && authorize > sourceOpen,
  'adapter 必须 witness→close Context→disconnect Browser→source bootstrap→fresh authorize');
  assert(!/\brecordingBrowser\.newContext\s*\(/.test(adapter),
    '禁止在 recording Browser 上 newContext 冒充 fresh runtime');
});

await check('B12 completion 静态验证 genuine CLEAN authority 但不提前消费', () => {
  const proof = source('lib/teachin/raw-proof.mjs');
  const completion = source('lib/dual-replay/replay-completion.mjs');
  assert(/export\s+(?:async\s+)?function\s+inspectCleanRawReplayAuthority\b/.test(proof)
    || /export\s+const\s+inspectCleanRawReplayAuthority\b/.test(proof)
    || /export\s*\{[^}]*\binspectCleanRawReplayAuthority\b[^}]*\}/s.test(proof),
  'raw-proof 必须导出 non-consuming CLEAN authority inspector');
  assert(/import\s*\{[^}]*\binspectCleanRawReplayAuthority\b[^}]*\}\s*from\s*['"]\.\.\/teachin\/raw-proof\.mjs['"]/s
    .test(completion),
  'completion 必须静态导入 canonical CLEAN authority inspector');
  assert(/\binspectCleanRawReplayAuthority\s*\(/.test(completion),
    'completion 必须调用 genuine CLEAN authority inspector');
  assert(!/\bconsumeCleanRawReplay\s*\(/.test(completion),
    'completion 只验真，禁止抢先消费 projection 的 one-shot CLEAN authority');
});

await check('B13 frozen verdict 只经唯一 child-process adapter 接入且旧字节锚不漂', () => {
  const verdictAdapter = source('lib/teachin/verdict-cli-adapter.mjs');
  const runtimeAdapter = source('lib/teachin/runtime-cycle-adapter.mjs');
  const judgeBytes = readFileSync(resolve(ROOT, 'bin/verdict.mjs'));
  const oldPrd = JSON.parse(source('loop/prd-gen-prompts.json'));
  const frozenSha = 'ff0923132193209dc55262a010bc4bdaadfec379445a82a150912f94dcb5cb53';

  assert(createHash('sha256').update(judgeBytes).digest('hex') === frozenSha
    && oldPrd?.testChecksums?.['bin/verdict.mjs'] === frozenSha,
  'frozen bin/verdict.mjs 或旧 PRD checksum 锚已漂移');
  assert(/from\s+['"]node:child_process['"]/.test(verdictAdapter)
    && /\bexecFile(?:Sync)?\s*\(/.test(verdictAdapter),
  'verdict adapter 必须使用 node:child_process execFile 参数数组');
  assert(!/\bexec(?:Sync)?\s*\(/.test(verdictAdapter)
    && /\bshell\s*:\s*false\b/.test(verdictAdapter),
  'verdict adapter 禁止 shell 字符串且必须显式 shell:false');
  assert(/\bprocess\.execPath\b/.test(verdictAdapter)
    && /bin\/verdict\.mjs/.test(verdictAdapter)
    && /['"]--axes['"]/.test(verdictAdapter)
    && /['"]--out['"]/.test(verdictAdapter),
  'verdict adapter 必须固定 process.execPath + judge/--axes/--out argv');
  assert(/\bwindowsHide\s*:\s*true\b/.test(verdictAdapter)
    && /\btimeout\s*:\s*30_?000\b/.test(verdictAdapter)
    && /\bmaxBuffer\s*:\s*1_?048_?576\b/.test(verdictAdapter),
  'verdict adapter 必须固定 windowsHide/timeout/maxBuffer');
  assert(/import\s*\{[^}]*\bcanonicalVerdictCliAdapter\b[^}]*\}\s*from\s*['"]\.\/verdict-cli-adapter\.mjs['"]/s
    .test(runtimeAdapter),
  'runtime-cycle adapter 必须静态导入 canonicalVerdictCliAdapter');
  assert(/\bcanonicalVerdictCliAdapter\b/.test(runtimeAdapter.replace(
    /import\s*\{[^}]*\}\s*from\s*['"][^'"]+['"];?/gs,
    '',
  )), 'runtime-cycle adapter 必须实际绑定 canonical verdict adapter');

  const childProcessUsers = PRODUCTION_MODULES.filter((rel) =>
    /(?:from\s*|import\s*\()\s*['"]node:child_process['"]/.test(source(rel)));
  assert(JSON.stringify(childProcessUsers)
    === JSON.stringify(['lib/teachin/verdict-cli-adapter.mjs']),
  `child_process 只允许唯一 verdict boundary：${childProcessUsers.join(', ')}`);
  const directJudgeUsers = PRODUCTION_MODULES.filter((rel) =>
    /['"][^'"]*bin\/verdict\.mjs['"]/.test(source(rel)));
  assert(JSON.stringify(directJudgeUsers)
    === JSON.stringify(['lib/teachin/verdict-cli-adapter.mjs']),
  `bin/verdict.mjs 只允许唯一 adapter 引用：${directJudgeUsers.join(', ')}`);
});

await check('B14 formal generic action 与 raw Playwright driver 共用 opaque action gate', () => {
  const gate = source('lib/replay/action-authority.mjs');
  const formal = source('lib/replay-actions.mjs');
  const raw = source('lib/teachin/raw-playwright-driver.mjs');
  assert(/\bcreateActionAuthorityGate\b/.test(gate),
    'shared action-authority 缺 createActionAuthorityGate');

  const functionBody = (text, name) => {
    const declaration = new RegExp(
      `(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`,
    ).exec(text);
    if (!declaration) return null;
    const open = text.indexOf('{', text.indexOf(')', declaration.index));
    if (open < 0) return null;
    let depth = 0;
    let quote = null;
    let escaped = false;
    let lineComment = false;
    let blockComment = false;
    for (let index = open; index < text.length; index += 1) {
      const char = text[index];
      const next = text[index + 1];
      if (lineComment) {
        if (char === '\n') lineComment = false;
        continue;
      }
      if (blockComment) {
        if (char === '*' && next === '/') { blockComment = false; index += 1; }
        continue;
      }
      if (quote) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === '/' && next === '/') { lineComment = true; index += 1; continue; }
      if (char === '/' && next === '*') { blockComment = true; index += 1; continue; }
      if (char === "'" || char === '"' || char === '`') { quote = char; continue; }
      if (char === '{') depth += 1;
      if (char === '}' && --depth === 0) return text.slice(open + 1, index);
    }
    return null;
  };
  const reachableGateCalls = (text, root, gateName) => {
    const declarations = new Set([...text.matchAll(
      /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g,
    )].map((match) => match[1]));
    const seen = new Set();
    const methods = new Set();
    const visit = (name) => {
      if (seen.has(name)) return;
      seen.add(name);
      const body = functionBody(text, name);
      if (!body) return;
      for (const method of ['resolve', 'perform']) {
        if (new RegExp(`\\b${gateName}\\s*\\.\\s*${method}\\s*\\(`).test(body)) {
          methods.add(method);
        }
      }
      for (const call of body.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
        if (declarations.has(call[1])) visit(call[1]);
      }
    };
    visit(root);
    return methods;
  };
  const gateBinding = (text, rel, importPath) => {
    assert(new RegExp(
      `import\\s*\\{[^}]*\\bcreateActionAuthorityGate\\b[^}]*\\}\\s*from\\s*['"]${importPath.replaceAll('.', '\\.')}['"]`,
      's',
    ).test(text), `${rel} 缺 shared action gate 静态 import`);
    const match = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*createActionAuthorityGate\s*\(/.exec(text);
    assert(match, `${rel} 缺具名 shared action gate binding`);
    return match[1];
  };

  const formalGate = gateBinding(
    formal, 'lib/replay-actions.mjs', './replay/action-authority.mjs',
  );
  assert(/export\s+async\s+function\s+dispatchReplayAction\s*\(/.test(formal),
    'formal 缺 exported dispatchReplayAction root');
  const formalCalls = reachableGateCalls(formal, 'dispatchReplayAction', formalGate);
  assert(formalCalls.has('resolve') && formalCalls.has('perform'),
    'formal exported dispatch call graph 未实际走 shared resolve+perform');

  const rawGate = gateBinding(
    raw, 'lib/teachin/raw-playwright-driver.mjs', '../replay/action-authority.mjs',
  );
  const canonical = /export\s+const\s+canonicalRawPlaywrightDriver\s*=\s*Object\.freeze\s*\(\s*\{([\s\S]*?)\}\s*\)/.exec(raw);
  assert(canonical, 'raw 缺 frozen exported canonicalRawPlaywrightDriver');
  const targetOf = (key) => {
    const match = new RegExp(`\\b${key}\\s*(?::\\s*([A-Za-z_$][\\w$]*))?(?=\\s*(?:,|$))`)
      .exec(canonical[1]);
    return match?.[1] || (match ? key : null);
  };
  const rawResolve = targetOf('resolve');
  const rawPerform = targetOf('perform');
  assert(targetOf('readActivePath') && rawResolve && rawPerform,
    'raw canonical driver 缺 readActivePath/resolve/perform binding');
  assert(reachableGateCalls(raw, rawResolve, rawGate).has('resolve')
    && reachableGateCalls(raw, rawPerform, rawGate).has('perform'),
  'raw exported canonical call graph 未实际走 shared resolve+perform');

  assert(/\bactionAuthority\b/.test(gate)
    && /\btopologyAuthority\b/.test(gate)
    && /\bexecutionTargetAuthority\b/.test(gate),
  'shared gate 缺 opaque action/topology/target binding');
  assert(/\brevalidateCandidate\b/.test(gate)
    && /\badmitOrigin\b/.test(gate),
  'shared gate 缺 TOCTOU/origin revalidation');
});

await check('B15 distilled candidate internal sealer 只有 runtime-cycle 一个 direct user', () => {
  const symbol = 'sealDistilledCandidateAuthority';
  const directUsers = walkMjs(resolve(ROOT, 'lib'), 'lib').filter((rel) =>
    rel !== 'lib/dual-replay/pair-authority.mjs' && existsSync(resolve(ROOT, rel))
    && new RegExp(`\\b${symbol}\\b`).test(source(rel)));
  assert(JSON.stringify(directUsers) === JSON.stringify(['lib/teachin/runtime-cycle-adapter.mjs']),
  `internal sealer direct users 漂移：${directUsers.join(', ')}`);
  const facade = source('lib/dual-replay/index.mjs');
  const namedExport = new RegExp(`export(?:\\s+(?:async\\s+)?(?:function|const|let|var)\\s+|\\s*\\{[^}]*\\b)${symbol}\\b`, 's');
  assert(!namedExport.test(facade)
    && !/export\s*\*\s*(?:as\s+\w+\s*)?from\s*['"]\.\/pair-authority\.mjs['"]/.test(facade),
  'dual-replay index 禁止导出 internal distilled candidate sealer');
});

await check('B16 entity handle mint/consume 留在 pure dual seam 且 direct users 唯一', () => {
  const modules = walkMjs(resolve(ROOT, 'lib'), 'lib');
  const usersOf = (symbol, definition) => modules.filter((rel) =>
    rel !== definition && new RegExp(`\\b${symbol}\\b`).test(source(rel)));
  assert(JSON.stringify(usersOf(
    'mintVerifiedEntityLockVerification',
    'lib/dual-replay/entity-lock-handle.mjs',
  )) === JSON.stringify(['lib/teachin/entity-lock-verifier.mjs']),
  'verified entity handle mint 只能由 canonical runtime verifier 使用');
  assert(JSON.stringify(usersOf(
    'consumeVerifiedEntityLockVerification',
    'lib/dual-replay/entity-lock-handle.mjs',
  )) === JSON.stringify(['lib/dual-replay/pair-authority.mjs']),
  'verified entity handle consumer 只能由 pure pair-authority 使用');
  assert(!/teachin\/entity-lock-verifier/.test(source('lib/dual-replay/pair-authority.mjs')),
    'pure pair-authority 禁止反向 import fs-heavy runtime verifier');
});

if (failures.length) {
  console.error(`${TAG}: ${passed} 过 / ${failures.length} 败`);
  process.exit(1);
}
console.log(`${TAG}: ${passed} 过 / 0 败`);
