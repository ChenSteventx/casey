#!/usr/bin/env node
// p9-tier2-selftest —— P9 tier-2 真机冒烟自检（`casey selftest --tier2`）的红先行金牌。
// 判据：docs/plans/p9-tier2-live-smoke/GRILL.md（D1-D6）+ plan.md v4 §2 的 T1-T8。
//
// 零 SUT：纯层直调（合成投影/receipt/前置门夹具，全部脱敏、零凭据、零真实地址）
//   + 壳层 spawn 稳定面（只走用法错 64 路、`--help`、`selftest --tier1` 横切锚点）。
//   真机 live 跑本身不进本金牌（GRILL D3/ADR-0009：那是人签面，plan §3 的 A4）。
//   本金牌绝不向 record/run 喂任何目标地址；spawn 用的回环基址只走 fail-fast 用法错路径。
//
// 本金牌冻结的纯层 API（`lib/selftest-tier2.mjs`，实现前不存在）：
//   · TIER2_READINESS_IDS      前置门逐项 id（doctor 就绪级四项 + GRILL D4 v2 显式清单 + manifest/带外回执/两段连通）
//   · TIER2_EVIDENCE_IDS       单 run 证据判定逐项 id
//   · TIER2_RECEIPT_CLASSES    run receipt 稳定失败子类枚举（plan §1.3）
//   · TIER2_SCAN_STAGES        凭据扫描时序阶段（GRILL D2 v3：原始字节 → 投影 → 落盘前）
//   · TIER2_JUDGE_SMOKE_IDS    覆盖矩阵第三面（裁判通道运行时冒烟）逐项 id ★r1 修订
//   · TIER2_MACHINE_GREEN_TAIL exit 0 尾行常量（「机器面绿≠完成」）
//   · judgeTier2RunEvidence(projection) 单 run 产物投影 → 逐项判定
//   · judgeTier2ScanTimeline({ stages, hits }) 扫描时序 + 命中 → 是否允许证据落盘
//   · judgeTier2JudgeChannelSmoke(smoke) 裁判通道冒烟结构化产出 → 第三面判定 ★r1 修订
//   · runTier2(env) 纯层聚合 → { exitCode, readiness, caseResults, coverage, judgeSmoke, tailLine, ... }
//
// ★ codex 联审 r1 修订（REVIEW_CHANGES_REQUIRED，5 High + 3 Medium；原件存
//   `p9-tier2-selftest.zero-sut.golden.mjs.pre-review-amendment.archive.gz`，sha256
//   57cc8bca60c8af880e988228ae011275e70c0461d3c45790ea6ab875ab44a2f1）。增钉与改动只有三处形态：
//   ① 全绿夹具 `tier2Env()` 补 `judgeSmoke`（第三面进覆盖矩阵后，全绿路径必须带这一面的真实证据）；
//   ② T0 冻结面补第三面的常量与判定函数；
//   ③ 追加 T2b-H2（HARNESS_ERROR 必判机器红）、T2d（第三面缺席/反例不符/先例未绑定 → exit 2）、
//      T8b（生产反例集与本金牌 SMOKE 表同构）、T9（壳层级负控：manifest 准入闭合 / 原始字节扫描 /
//      run 目录排他与一致性 / 用法错零回显 / 绿尾行经管道不截断 / 连通结果消费端严格校验）。
//   既有 77 钉的断言语义一字未改。
//   env/projection 形状见下方 readyProbes()/projection()/caseEntry() 三个夹具构造器——
//   它们就是本金牌对纯层入参契约的规格（doctor 金牌同款：注入「已解析的探针结果」，不倒着裁）。
//
// 与既有「导入失败即整体红」模式的一处偏离（如实标注）：raw-actions 金牌在 import 失败时
//   立刻 process.exit(1)，那样 T6/T8 这两条「修前应绿」的横切/裁判钉将永远跑不到、
//   红绿分布无法如实记账。本金牌改为延迟消费：import 失败 → 记一条硬红（T0）且所有纯层钉
//   逐条红，壳层与裁判钉照跑；整体仍 exit 1（「整体红」语义一字不让）。
//
// 修前预期：T6 绿（tier1 现绿）、T8 绿（bin/verdict.mjs 现役）；T0-T5、T7 全红
//   （`--tier2` 现为 bin/casey.mjs:313 桩 exit 3 + 纯层模块缺失 + 签署版 manifest 未落）。

import { readFileSync, existsSync, writeFileSync, mkdtempSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const TAG = 'p9-tier2-selftest';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CASEY = join(ROOT, 'bin', 'casey.mjs');
const VERDICT = join(ROOT, 'bin', 'verdict.mjs');
const VERDICT_FIX = join(HERE, 'fixtures', 'p2', 'verdict-cases.json');
// 签署版 suite manifest（未签前只有 cases/tier2-suite.manifest.draft.json；.draft 不被接受）。
const MANIFEST = join(ROOT, 'cases', 'tier2-suite.manifest.json');

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
    failures.push(`${name}: ${String(error?.message || error).slice(-900)}`);
    console.error(`RED  ${TAG}: ${name}: ${String(error?.message || error).slice(-900)}`);
  }
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

// —— 纯层延迟导入（缺席 → T0 硬红，纯层钉逐条红，整体仍 exit 1）——
let tier2Api = null;
let tier2ImportError = null;
try {
  tier2Api = await import('../../lib/selftest-tier2.mjs');
} catch (error) {
  tier2ImportError = error;
}
function pure() {
  if (!tier2Api) {
    throw new Error(`纯层 lib/selftest-tier2.mjs 导入失败（实现模块尚未落地）：${String(tier2ImportError?.message || tier2ImportError).slice(-200)}`);
  }
  return tier2Api;
}

// —— 冻结 id 清单（实现须为超集，且逐项在判定输出里可见）——
// doctor 就绪级四项照抄 doctor 金牌 READINESS_IDS（复用采集结构，不另起别名）。
const REQUIRED_READINESS_IDS = Object.freeze([
  'node', 'playwright-present', 'playwright-import', 'chromium',
  // GRILL D4 v2 显式前置清单：凭据形状、登录引导（逐例强制 --login-bootstrap）、执行目标、隧道监听、
  // 带外账户回执标志、两段真实连通证据（两项独立判定）。
  'creds-shape', 'login-bootstrap', 'execution-target', 'tunnel-listening',
  'out-of-band-receipt', 'connectivity-win-target', 'connectivity-wsl-tunnel',
  // plan §1.1：manifest 在场且 checksum 合法。
  'suite-manifest',
]);
const REQUIRED_EVIDENCE_IDS = Object.freeze([
  'verdict-quadstate-wellformed',
  'catch-all-intact',
  'network-forensics-attribution',
  'lifecycle-forensics',
  'credential-scan-clean',
  'streaming-hard-assertion-judged',
  'exit-code-legend',
]);
const REQUIRED_RECEIPT_CLASSES = Object.freeze([
  'pipeline_complete_with_verdict', 'stage_failed', 'timeout', 'partial_artifacts', 'systemic_abort',
]);
const REQUIRED_SCAN_STAGES = Object.freeze(['raw_bytes', 'projection', 'pre_write']);
const FOUR_STATES = Object.freeze(['PASS', 'SUT_DEFECT', 'HARNESS_ERROR', 'NEEDS_HUMAN']);

const READ_CASE = 'tc_agent_id_readback_real_uat_v1';
const STREAM_CASE = 'tc_chiefcomplaint_smoke';
const NOW = '2026-07-29T12:00:00.000Z';
const FRESH_AT = '2026-07-29T11:30:00.000Z';
const STALE_AT = '2026-07-20T00:00:00.000Z';
const DAY_MS = 24 * 60 * 60 * 1000;

// —— 夹具构造器 = 纯层入参契约规格（全部合成、脱敏、零凭据零真实地址）——

// 前置门探针结果（已解析的布尔/端口/时点，非原始字节；doctor 金牌同款注入姿势）。
function readyProbes() {
  return {
    node: { nodeVersion: '22.12.0', requiredRange: '>=22.12' },
    playwright: { present: true, importable: true },
    chromium: { execResolved: true, execExists: true },
    creds: { present: true, shapeOk: true },
    loginBootstrap: { requestedForEveryCase: true },
    executionTarget: { resolved: true, mode: 'wsl-loopback' },
    tunnel: { proxyPort: 15519, portListening: true },
    suiteManifest: {
      present: true, checksumOk: true, signed: true, memberCount: 2, caseLimit: 4,
    },
    outOfBandReceipt: { present: true, acknowledged: true, confirmedAt: FRESH_AT },
    connectivity: {
      // ① Windows→真实目标段：win-probe-target 结构化结果文件（纯层只判形状与新鲜度，不判地址）。
      winTarget: { present: true, ok: true, producedAt: FRESH_AT },
      // ② WSL 回环→隧道段：壳层自采。
      wslTunnel: { present: true, ok: true, producedAt: FRESH_AT },
    },
  };
}

// 单 run 产物投影（只读字段白名单，plan §5 R3：绝不把凭据面字节带进证据）。
function projection({ caseId = READ_CASE, streaming = false } = {}) {
  const stepId = 'atstep_0';
  const intentId = 'intent_0';
  return {
    caseId,
    runDir: `runs/${caseId}/run_tier2_20260729T120000Z`,
    verdict: {
      schemaOk: true,
      stateCounts: { PASS: 1, SUT_DEFECT: 0, HARNESS_ERROR: 0, NEEDS_HUMAN: 0 },
      // 裁定步身份（★r3 H5a）：步数 > 0、四态计数总和 == 步数、stepIds 与三轴步双射
      stepCount: 1,
      stepIds: [stepId],
      unknownStates: [],
      catchAllReachable: true,
    },
    axes: {
      schemaOk: true,
      steps: [{
        stepId,
        intentId,
        kind: 'click',
        hardAssertionKinds: streaming ? ['noErrorEnvelope', 'streamReplyReceived'] : ['noErrorEnvelope'],
        judgedAssertionKinds: streaming ? ['noErrorEnvelope', 'streamReplyReceived'] : ['noErrorEnvelope'],
      }],
      forensics: {
        // 按发起方归因结构（非时间窗）：每条网络取证须带 initiator + attributedStepId。
        network: {
          present: true,
          attributedByInitiator: true,
          entries: [{ initiator: stepId, attributedStepId: stepId, statusClass: '2xx' }],
        },
        lifecycle: { present: true, pageerrorCount: 0, crashed: false },
      },
    },
    reportModel: {
      schemaOk: true,
      exitCodeLegend: [0, 1, 2, 3, 64],
      badgeStates: [...FOUR_STATES],
    },
    // 凭据兜底扫描：三阶段全过、零命中（时序另由 judgeTier2ScanTimeline 单独钉）。
    credentialScan: { stages: [...REQUIRED_SCAN_STAGES], hits: [] },
    streamingAssertions: streaming
      ? {
        expected: [{ intentId, stepId, kind: 'streamReplyReceived', soft: false }],
        judged: [{ intentId, stepId, kind: 'streamReplyReceived', ok: true }],
      }
      : { expected: [], judged: [] },
  };
}

function caseEntry({
  caseId = READ_CASE,
  effect = 'read',
  receiptClass = 'pipeline_complete_with_verdict',
  streaming = false,
  authorizedMutation = false,
  smokeAuthorized = true,
  receiptPersisted = true,   // ★r2 H5 残口：receipt 真落盘核过才算数
  proj,
} = {}) {
  return {
    caseId,
    effect,
    smokeAuthorized,
    receiptPersisted,
    // 变更型条目的「本次调用逐次授权」（--authorize-mutation <caseId>）。
    authorizedMutation,
    receipt: {
      caseId,
      class: receiptClass,
      runDir: `runs/${caseId}/run_tier2_20260729T120000Z`,
      loginBootstrap: true,
    },
    projection: proj || projection({ caseId, streaming }),
  };
}

// 覆盖矩阵第三面（SUT_DEFECT 面）的结构化冒烟证据（★r1 H1）：壳层真调现役 verdict.mjs 的产出投影
//   + 历史真机先例 hash 绑定核验结果。纯层只判这份结构，不自己跑二进制（零 spawn 不变）。
function judgeSmokeEvidence(overrides = {}) {
  const cases = [
    { id: 'sut_defect_arrival_1', expectVerdict: 'SUT_DEFECT', expectReason: null, actualVerdict: 'SUT_DEFECT', actualReason: null, ok: true },
    { id: 'sut_defect_arrival_2', expectVerdict: 'SUT_DEFECT', expectReason: null, actualVerdict: 'SUT_DEFECT', actualReason: null, ok: true },
    { id: 'background_401_not_attributed', expectVerdict: 'PASS', expectReason: null, actualVerdict: 'PASS', actualReason: null, ok: true },
    { id: 'misattributed_5xx', expectVerdict: 'NEEDS_HUMAN', expectReason: 'SUT_DEFECT_OR_STALE', actualVerdict: 'NEEDS_HUMAN', actualReason: 'SUT_DEFECT_OR_STALE', ok: true },
    { id: 'catch_all_indeterminate', expectVerdict: 'NEEDS_HUMAN', expectReason: 'INDETERMINATE', actualVerdict: 'NEEDS_HUMAN', actualReason: 'INDETERMINATE', ok: true },
    { id: 'ambiguous_action', expectVerdict: 'NEEDS_HUMAN', expectReason: 'AMBIGUOUS_ACTION', actualVerdict: 'NEEDS_HUMAN', actualReason: 'AMBIGUOUS_ACTION', ok: true },
    { id: 'harness_error_drift', expectVerdict: 'HARNESS_ERROR', expectReason: null, actualVerdict: 'HARNESS_ERROR', actualReason: null, ok: true },
    { id: 'pass', expectVerdict: 'PASS', expectReason: null, actualVerdict: 'PASS', actualReason: null, ok: true },
  ];
  return {
    ran: true,
    fixtureChecksumOk: true,
    // 证据真落盘（★r2 H1 残口：写失败=没证据，第三面必红）
    evidencePersisted: true,
    cases,
    statesProduced: [...FOUR_STATES],
    precedents: [
      { id: 'attestation-run1-503', hashBound: true, artifactPresent: true, hashMatch: true },
      { id: 'attestation-run1-axes', hashBound: true, artifactPresent: false, hashMatch: null },
    ],
    ...overrides,
  };
}

// 默认全绿环境：一条只读例（取证面）+ 一条流式例（流式面）+ 裁判通道冒烟（SUT_DEFECT 面），三面非空。
function tier2Env(overrides = {}) {
  return {
    now: NOW,
    freshnessWindowMs: DAY_MS,
    probes: readyProbes(),
    judgeSmoke: judgeSmokeEvidence(),
    cases: [
      caseEntry({ caseId: READ_CASE }),
      caseEntry({ caseId: STREAM_CASE, streaming: true }),
    ],
    ...overrides,
  };
}

function idsOf(items) {
  return (Array.isArray(items) ? items : []).map((it) => it && it.id);
}
function itemById(items, id) {
  return (Array.isArray(items) ? items : []).find((it) => it && it.id === id);
}
function isRed(item) {
  return !!item && item.status !== 'ok' && item.status !== 'route-human';
}

// ══════════════════════════════════════════════════════════════════════
// T0 纯层 API 在场（冻结面；缺席即整体红）
// ══════════════════════════════════════════════════════════════════════

await check('T0 纯层 API 在场且形态正确', () => {
  const api = pure();
  for (const name of ['judgeTier2RunEvidence', 'judgeTier2ScanTimeline', 'runTier2', 'judgeTier2JudgeChannelSmoke']) {
    assert(typeof api[name] === 'function', `缺 frozen API ${name}`);
  }
  for (const name of ['TIER2_READINESS_IDS', 'TIER2_EVIDENCE_IDS', 'TIER2_RECEIPT_CLASSES', 'TIER2_SCAN_STAGES', 'TIER2_JUDGE_SMOKE_IDS']) {
    assert(Array.isArray(api[name]) && api[name].length > 0, `缺 frozen 常量 ${name}（须非空数组）`);
    assert(Object.isFrozen(api[name]), `${name} 须冻结（Object.freeze）`);
    assert(new Set(api[name]).size === api[name].length, `${name} 不得有重复项`);
  }
  assert(typeof api.TIER2_MACHINE_GREEN_TAIL === 'string' && api.TIER2_MACHINE_GREEN_TAIL.length > 0,
    '缺 frozen 常量 TIER2_MACHINE_GREEN_TAIL');
  for (const id of REQUIRED_READINESS_IDS) {
    assert(api.TIER2_READINESS_IDS.includes(id), `TIER2_READINESS_IDS 缺前置门项「${id}」`);
  }
  for (const id of REQUIRED_EVIDENCE_IDS) {
    assert(api.TIER2_EVIDENCE_IDS.includes(id), `TIER2_EVIDENCE_IDS 缺证据项「${id}」`);
  }
  for (const cls of REQUIRED_RECEIPT_CLASSES) {
    assert(api.TIER2_RECEIPT_CLASSES.includes(cls), `TIER2_RECEIPT_CLASSES 缺子类「${cls}」`);
  }
  assert(api.TIER2_SCAN_STAGES.join(',') === REQUIRED_SCAN_STAGES.join(','),
    `TIER2_SCAN_STAGES 须严格有序 ${REQUIRED_SCAN_STAGES.join(' → ')}，实得 ${api.TIER2_SCAN_STAGES.join(' → ')}`);
});

// ══════════════════════════════════════════════════════════════════════
// T1 前置门 fail-closed（合成坏前置 → exit 2 且 run 子进程从未启动）
// ══════════════════════════════════════════════════════════════════════

await check('T1 全备前置 → 不因前置门退 2（基线绿）', () => {
  const { runTier2 } = pure();
  const r = runTier2(tier2Env());
  assert(r && typeof r.exitCode === 'number', `runTier2 须出 { exitCode }：${JSON.stringify(r)}`);
  assert(r.exitCode === 0, `全备环境应 exit 0，实得 ${r.exitCode}：${JSON.stringify(r.readiness)}`);
  assert(idsOf(r.readiness).length === pure().TIER2_READINESS_IDS.length,
    `readiness 须逐项出全（${pure().TIER2_READINESS_IDS.length} 项），实得 ${idsOf(r.readiness).length}`);
  for (const id of REQUIRED_READINESS_IDS) {
    assert(itemById(r.readiness, id), `readiness 输出缺项「${id}」`);
  }
});

// GRILL D4 v2 显式六项 + manifest：逐条击穿都必须 exit 2 且零 run。
const BAD_PRECONDITIONS = [
  ['凭据形状缺', (p) => { p.creds = { present: true, shapeOk: false }; }, 'creds-shape'],
  ['登录引导未逐例强制', (p) => { p.loginBootstrap = { requestedForEveryCase: false }; }, 'login-bootstrap'],
  ['执行目标未解析', (p) => { p.executionTarget = { resolved: false }; }, 'execution-target'],
  ['隧道未监听', (p) => { p.tunnel = { proxyPort: 15519, portListening: false }; }, 'tunnel-listening'],
  ['带外账户回执标志缺', (p) => { p.outOfBandReceipt = { present: false, acknowledged: false }; }, 'out-of-band-receipt'],
  ['连通证据①缺（Windows→真实目标段）', (p) => { p.connectivity.winTarget = { present: false }; }, 'connectivity-win-target'],
  ['连通证据①失败', (p) => { p.connectivity.winTarget = { present: true, ok: false, producedAt: FRESH_AT }; }, 'connectivity-win-target'],
  ['连通证据①过期', (p) => { p.connectivity.winTarget = { present: true, ok: true, producedAt: STALE_AT }; }, 'connectivity-win-target'],
  ['连通证据②缺（WSL 回环→隧道段）', (p) => { p.connectivity.wslTunnel = { present: false }; }, 'connectivity-wsl-tunnel'],
  ['连通证据②过期', (p) => { p.connectivity.wslTunnel = { present: true, ok: true, producedAt: STALE_AT }; }, 'connectivity-wsl-tunnel'],
  ['manifest 缺席', (p) => { p.suiteManifest = { present: false }; }, 'suite-manifest'],
];

for (const [label, mutate, expectId] of BAD_PRECONDITIONS) {
  await check(`T1 前置门 fail-closed：${label} → exit 2 且零 run`, () => {
    const { runTier2 } = pure();
    const probes = readyProbes();
    mutate(probes);
    const r = runTier2(tier2Env({ probes }));
    assert(r.exitCode === 2, `${label} 应 exit 2（前置门失败），实得 ${r.exitCode}`);
    const item = itemById(r.readiness, expectId);
    assert(isRed(item), `${label} 应把 readiness「${expectId}」判红，实得 ${JSON.stringify(item)}`);
    // 不依赖环境恰好无隧道：断言纯层根本没排任何 run（run 子进程从未启动的机器可读形态）。
    assert(Array.isArray(r.caseResults) && r.caseResults.length === 0,
      `${label} 前置门未过时不得有任何 run 结果，实得 ${JSON.stringify(r.caseResults)}`);
  });
}

await check('T1 覆盖矩阵空（空用例 suite）→ exit 2 不空转成全绿', () => {
  const { runTier2 } = pure();
  const r = runTier2(tier2Env({ cases: [] }));
  assert(r.exitCode === 2, `空 suite 应 exit 2（覆盖矩阵空 fail-closed），实得 ${r.exitCode}`);
  assert(Array.isArray(r.caseResults) && r.caseResults.length === 0, '空 suite 不得凭空造 run 结果');
});

// ══════════════════════════════════════════════════════════════════════
// T2 证据判定各项红绿翻转
// ══════════════════════════════════════════════════════════════════════

await check('T2 全备投影 → 逐项绿', () => {
  const { judgeTier2RunEvidence, TIER2_EVIDENCE_IDS } = pure();
  const r = judgeTier2RunEvidence(projection({ streaming: true }));
  assert(r && r.ok === true, `全备投影应整体绿：${JSON.stringify(r)}`);
  assert(idsOf(r.items).length === TIER2_EVIDENCE_IDS.length,
    `证据判定须逐项出全（${TIER2_EVIDENCE_IDS.length} 项），实得 ${idsOf(r.items).length}`);
  for (const id of REQUIRED_EVIDENCE_IDS) {
    const item = itemById(r.items, id);
    assert(item && !isRed(item), `全备投影下「${id}」不应红：${JSON.stringify(item)}`);
  }
});

const EVIDENCE_HOLES = [
  ['四态账畸形（verdict schema 不合法）', (p) => { p.verdict.schemaOk = false; }, 'verdict-quadstate-wellformed'],
  ['四态账畸形（缺态计数键）', (p) => { delete p.verdict.stateCounts.HARNESS_ERROR; }, 'verdict-quadstate-wellformed'],
  // ★r3 H5a：零步裁定此前被当「合法非全过」，配齐附件 + exit 1 就冒充管线完成 → 假绿
  ['零步裁定（没跑却冒充合法非全过）', (p) => {
    p.verdict.stepCount = 0; p.verdict.stepIds = [];
    p.verdict.stateCounts = { PASS: 0, SUT_DEFECT: 0, HARNESS_ERROR: 0, NEEDS_HUMAN: 0 };
  }, 'verdict-quadstate-wellformed'],
  ['四态计数总和与裁定步数不等', (p) => { p.verdict.stepCount = 2; }, 'verdict-quadstate-wellformed'],
  ['裁定步不在三轴步内', (p) => { p.verdict.stepIds = ['atstep_99']; }, 'verdict-quadstate-wellformed'],
  ['三轴步未被裁定（漏裁）', (p) => {
    p.axes.steps.push({ stepId: 'atstep_1', intentId: 'intent_0', kind: 'click', hardAssertionKinds: [], judgedAssertionKinds: [] });
  }, 'verdict-quadstate-wellformed'],
  ['裁定 stepId 重复', (p) => {
    p.verdict.stepCount = 2; p.verdict.stepIds = ['atstep_0', 'atstep_0'];
    p.verdict.stateCounts = { PASS: 2, SUT_DEFECT: 0, HARNESS_ERROR: 0, NEEDS_HUMAN: 0 };
  }, 'verdict-quadstate-wellformed'],
  ['网络取证结构缺席', (p) => { p.axes.forensics.network = { present: false, entries: [] }; }, 'network-forensics-attribution'],
  ['网络取证未按发起方归因', (p) => {
    p.axes.forensics.network.attributedByInitiator = false;
    p.axes.forensics.network.entries = [{ statusClass: '2xx' }];
  }, 'network-forensics-attribution'],
  ['生命周期取证缺席', (p) => { p.axes.forensics.lifecycle = { present: false }; }, 'lifecycle-forensics'],
  ['凭据兜底扫描命中', (p) => { p.credentialScan = { stages: [...REQUIRED_SCAN_STAGES], hits: [{ stage: 'pre_write', rule: 'nested-sensitive-value' }] }; }, 'credential-scan-clean'],
  ['凭据兜底扫描未跑满三阶段', (p) => { p.credentialScan = { stages: ['projection', 'pre_write'], hits: [] }; }, 'credential-scan-clean'],
  ['退出码归一图例非法', (p) => { p.reportModel.exitCodeLegend = [0, 1, 7]; }, 'exit-code-legend'],
];

for (const [label, mutate, expectId] of EVIDENCE_HOLES) {
  await check(`T2 证据击穿：${label} → 「${expectId}」判红`, () => {
    const { judgeTier2RunEvidence, runTier2 } = pure();
    const proj = projection({ streaming: true });
    mutate(proj);
    const r = judgeTier2RunEvidence(proj);
    assert(r.ok === false, `${label} 应整体红：${JSON.stringify(r)}`);
    assert(isRed(itemById(r.items, expectId)),
      `${label} 应把「${expectId}」判红：${JSON.stringify(r.items)}`);
    // 证据红须传导到聚合退出码 1（D4：证据判定红 = 1，非 2）。
    const holed = projection({ caseId: READ_CASE });
    mutate(holed);
    const agg = runTier2(tier2Env({
      cases: [
        caseEntry({ caseId: READ_CASE, proj: holed }),
        caseEntry({ caseId: STREAM_CASE, streaming: true }),
      ],
    }));
    assert(agg.exitCode === 1, `${label} 聚合应 exit 1，实得 ${agg.exitCode}`);
  });
}

await check('T2 流式断言未裁 → 「streaming-hard-assertion-judged」判红', () => {
  const { judgeTier2RunEvidence } = pure();
  const proj = projection({ streaming: true });
  proj.streamingAssertions.judged = [];
  const r = judgeTier2RunEvidence(proj);
  assert(r.ok === false, `流式硬断言未裁应整体红：${JSON.stringify(r)}`);
  assert(isRed(itemById(r.items, 'streaming-hard-assertion-judged')),
    `未裁流式断言须判红：${JSON.stringify(r.items)}`);
});

// ══════════════════════════════════════════════════════════════════════
// T2b run receipt 归类钉（plan §1.3 / §5 R2 三分）
// ══════════════════════════════════════════════════════════════════════

await check('T2b pipeline_complete_with_verdict（合法 SUT_DEFECT）不判机器红', () => {
  const { runTier2 } = pure();
  const proj = projection({ caseId: READ_CASE });
  proj.verdict.stateCounts = { PASS: 0, SUT_DEFECT: 1, HARNESS_ERROR: 0, NEEDS_HUMAN: 0 };
  const r = runTier2(tier2Env({
    cases: [
      caseEntry({ caseId: READ_CASE, proj }),
      caseEntry({ caseId: STREAM_CASE, streaming: true }),
    ],
  }));
  assert(r.exitCode === 0,
    `业务性非 PASS（SUT_DEFECT）属 route:human 语义面，机器面应 exit 0，实得 ${r.exitCode}`);
  const entry = (r.caseResults || []).find((c) => c && c.caseId === READ_CASE);
  assert(entry && entry.machineRed === false,
    `SUT_DEFECT 不得记机器红：${JSON.stringify(entry)}`);
});

await check('T2b pipeline_complete_with_verdict（合法 NEEDS_HUMAN）不判机器红', () => {
  const { runTier2 } = pure();
  const proj = projection({ caseId: READ_CASE });
  proj.verdict.stateCounts = { PASS: 0, SUT_DEFECT: 0, HARNESS_ERROR: 0, NEEDS_HUMAN: 1 };
  const r = runTier2(tier2Env({
    cases: [
      caseEntry({ caseId: READ_CASE, proj }),
      caseEntry({ caseId: STREAM_CASE, streaming: true }),
    ],
  }));
  assert(r.exitCode === 0, `NEEDS_HUMAN 机器面应 exit 0，实得 ${r.exitCode}`);
});

// ★r1 H2 负控：HARNESS_ERROR 是确证工装错（护栏 #13 自愈入口），不是可容忍的业务性非 PASS。
// 修前实测 HARNESS_ERROR=1 / machineRed=false / exit 0 带绿尾行 = 假绿。
await check('T2b-H2 pipeline_complete_with_verdict 含 HARNESS_ERROR → 必判机器红 exit 1 且无绿尾行', () => {
  const { runTier2 } = pure();
  const proj = projection({ caseId: READ_CASE });
  proj.verdict.stateCounts = { PASS: 0, SUT_DEFECT: 0, HARNESS_ERROR: 1, NEEDS_HUMAN: 0 };
  const r = runTier2(tier2Env({
    cases: [
      caseEntry({ caseId: READ_CASE, proj }),
      caseEntry({ caseId: STREAM_CASE, streaming: true }),
    ],
  }));
  assert(r.exitCode === 1, `HARNESS_ERROR 属工装红，应 exit 1，实得 ${r.exitCode}`);
  const entry = (r.caseResults || []).find((c) => c && c.caseId === READ_CASE);
  assert(entry && entry.machineRed === true, `HARNESS_ERROR 须记机器红：${JSON.stringify(entry)}`);
  assert(!r.tailLine, `工装红路径不得带绿尾行：${JSON.stringify(r.tailLine)}`);
  // receipt 仍可如实记「管线跑完且有裁定」——归类不撒谎，红是聚合层的判断。
  assert(entry.receiptClass === 'pipeline_complete_with_verdict',
    `receipt 归类应保持管线完成（红由聚合层判）：${entry.receiptClass}`);
});

// ★r2 H5 残口：receipt 写失败（盘满/权限/扫描命中）时，这一例根本没有机器可读账 —— 绝不许算绿。
await check('T2b-H5 receipt 未落盘 → 该例必判机器红 exit 1', () => {
  const { runTier2 } = pure();
  const r = runTier2(tier2Env({
    cases: [
      caseEntry({ caseId: READ_CASE, receiptPersisted: false }),
      caseEntry({ caseId: STREAM_CASE, streaming: true }),
    ],
  }));
  assert(r.exitCode === 1, `receipt 未落盘应 exit 1，实得 ${r.exitCode}`);
  const entry = (r.caseResults || []).find((c) => c && c.caseId === READ_CASE);
  assert(entry && entry.machineRed === true, `未落盘须记机器红：${JSON.stringify(entry)}`);
  assert(entry.receiptPersisted === false, 'caseResults 须如实标 receipt 落盘状态');
  assert(!r.tailLine, '未落盘路径不得带绿尾行');
});

for (const cls of ['stage_failed', 'timeout', 'partial_artifacts']) {
  await check(`T2b 单例工装红 receipt「${cls}」→ exit 1 且余例照跑`, () => {
    const { runTier2 } = pure();
    const r = runTier2(tier2Env({
      cases: [
        caseEntry({ caseId: READ_CASE, receiptClass: cls }),
        caseEntry({ caseId: STREAM_CASE, streaming: true }),
      ],
    }));
    assert(r.exitCode === 1, `receipt「${cls}」应 exit 1，实得 ${r.exitCode}`);
    assert(r.aborted !== true, `单例工装红不得停全集：${JSON.stringify(r)}`);
    assert((r.caseResults || []).length === 2,
      `单例工装红后余例仍须跑（应 2 条结果），实得 ${(r.caseResults || []).length}`);
    const entry = (r.caseResults || []).find((c) => c && c.caseId === READ_CASE);
    assert(entry && entry.machineRed === true, `「${cls}」须记机器红：${JSON.stringify(entry)}`);
  });
}

await check('T2b systemic_abort（凭据/登录/隧道类）→ 立即停全集，余例不跑', () => {
  const { runTier2 } = pure();
  const r = runTier2(tier2Env({
    cases: [
      caseEntry({ caseId: READ_CASE, receiptClass: 'systemic_abort' }),
      caseEntry({ caseId: STREAM_CASE, streaming: true }),
    ],
  }));
  assert(r.aborted === true, `系统性故障须标停全集：${JSON.stringify(r)}`);
  assert(r.stoppedAtCaseId === READ_CASE, `停全集须记停点 caseId，实得 ${r.stoppedAtCaseId}`);
  assert((r.caseResults || []).length === 1,
    `停全集后绝不轰余例（应只 1 条结果），实得 ${(r.caseResults || []).length}`);
  // plan/GRILL 未明写 systemic_abort 的总退出码；按 D4「2=前置门失败」类别口径钉 2（正签前请确认）。
  assert(r.exitCode === 2, `系统性故障应 exit 2（前置面断链），实得 ${r.exitCode}`);
});

// ══════════════════════════════════════════════════════════════════════
// T2c 流式覆盖非空钉（codex r1 H1：条件式检查不得空转成全绿）
// ══════════════════════════════════════════════════════════════════════

await check('T2c 流式合格件缺席 → exit 2（不得空转成绿）', () => {
  const { runTier2 } = pure();
  const r = runTier2(tier2Env({ cases: [caseEntry({ caseId: READ_CASE })] }));
  assert(r.exitCode === 2, `无流式合格件应 exit 2（覆盖矩阵空），实得 ${r.exitCode}`);
  assert(r.coverage && r.coverage.streaming === false,
    `覆盖矩阵须显式记流式面为空：${JSON.stringify(r.coverage)}`);
});

await check('T2c soft 流式断言不算合格件 → 仍 exit 2', () => {
  const { runTier2 } = pure();
  const proj = projection({ caseId: STREAM_CASE, streaming: true });
  proj.streamingAssertions.expected[0].soft = true;
  const r = runTier2(tier2Env({
    cases: [caseEntry({ caseId: READ_CASE }), caseEntry({ caseId: STREAM_CASE, proj })],
  }));
  assert(r.exitCode === 2, `soft 流式断言不构成合格件，应 exit 2，实得 ${r.exitCode}`);
});

await check('T2c 合格件在场 → 必真裁（judged 按 intentId/stepId/kind 唯一 join、ok 布尔）', () => {
  const { runTier2 } = pure();
  const r = runTier2(tier2Env());
  assert(r.exitCode === 0, `合格流式件在场且已裁应 exit 0，实得 ${r.exitCode}`);
  assert(r.coverage && r.coverage.streaming === true, `覆盖矩阵须记流式面非空：${JSON.stringify(r.coverage)}`);

  // join 不唯一（同 intentId/stepId/kind 两条 judged）→ 不得当作已裁。
  const dup = projection({ caseId: STREAM_CASE, streaming: true });
  dup.streamingAssertions.judged.push({ ...dup.streamingAssertions.judged[0] });
  const rDup = runTier2(tier2Env({
    cases: [caseEntry({ caseId: READ_CASE }), caseEntry({ caseId: STREAM_CASE, proj: dup })],
  }));
  assert(rDup.exitCode !== 0, `judged join 不唯一时不得绿，实得 ${rDup.exitCode}`);

  // ok 非布尔（truthy 字符串）→ 不得当作已裁（防非布尔静默降级，同 verdict soft 教训）。
  const truthy = projection({ caseId: STREAM_CASE, streaming: true });
  truthy.streamingAssertions.judged[0].ok = 'true';
  const rTruthy = runTier2(tier2Env({
    cases: [caseEntry({ caseId: READ_CASE }), caseEntry({ caseId: STREAM_CASE, proj: truthy })],
  }));
  assert(rTruthy.exitCode !== 0, `judged.ok 非布尔时不得绿，实得 ${rTruthy.exitCode}`);
});

// ══════════════════════════════════════════════════════════════════════
// T2d 覆盖矩阵第三面（SUT_DEFECT 面）★r1 H1：现役 tier-2 命令必须真行使裁判通道冒烟，
//     否则第三面未运行也能 exit 0（GRILL D1「覆盖矩阵必须非空」被旁路）。
// ══════════════════════════════════════════════════════════════════════

await check('T2d 第三面全备 → 覆盖矩阵记 sutDefect 成立且逐项绿', () => {
  const { judgeTier2JudgeChannelSmoke, TIER2_JUDGE_SMOKE_IDS, runTier2 } = pure();
  const j = judgeTier2JudgeChannelSmoke(judgeSmokeEvidence());
  assert(j.ok === true, `全备冒烟证据应整体绿：${JSON.stringify(j.redIds)}`);
  assert(idsOf(j.items).length === TIER2_JUDGE_SMOKE_IDS.length,
    `第三面须逐项出全（${TIER2_JUDGE_SMOKE_IDS.length} 项），实得 ${idsOf(j.items).length}`);
  const r = runTier2(tier2Env());
  assert(r.coverage && r.coverage.sutDefect === true, `覆盖矩阵须记第三面成立：${JSON.stringify(r.coverage)}`);
  assert(r.judgeSmoke && Array.isArray(r.judgeSmoke.items), '聚合结果须带第三面逐项判定（可复核）');
  assert(r.exitCode === 0, `三面非空且全绿应 exit 0，实得 ${r.exitCode}`);
});

const JUDGE_SMOKE_HOLES = [
  ['冒烟整体缺席（第三面从未运行）', undefined, 'judge-counterexamples-exact'],
  ['冒烟未真跑（零反例条目）', { ran: false, cases: [] }, 'judge-counterexamples-exact'],
  ['反例集夹具已漂移', { fixtureChecksumOk: false }, 'judge-fixture-frozen'],
  ['某反例产出与冻结期望不符', {
    cases: judgeSmokeEvidence().cases.map((c) => (c.id === 'misattributed_5xx'
      ? { ...c, actualVerdict: 'SUT_DEFECT', actualReason: null, ok: false } : c)),
  }, 'judge-counterexamples-exact'],
  ['四态未覆盖全（缺 HARNESS_ERROR）', { statesProduced: ['PASS', 'SUT_DEFECT', 'NEEDS_HUMAN'] }, 'judge-four-states-exact'],
  ['冒出第五态标签', { statesProduced: [...FOUR_STATES, 'FLAKY'] }, 'judge-four-states-exact'],
  ['历史先例未记（零条目）', { precedents: [] }, 'judge-precedents-hash-bound'],
  ['历史先例未按 hash 绑定', { precedents: [{ id: 'attestation-run1-503', hashBound: false, artifactPresent: true, hashMatch: true }] }, 'judge-precedents-hash-bound'],
  ['历史先例产物在场但 hash 失配', { precedents: [{ id: 'attestation-run1-503', hashBound: true, artifactPresent: true, hashMatch: false }] }, 'judge-precedents-hash-bound'],
  // ★r2 H1 残口：冒烟跑了但证据没落到盘上（盘满/权限/扫描命中）——没证据就不算成立。
  ['冒烟证据未落盘', { evidencePersisted: false }, 'judge-evidence-persisted'],
];

for (const [label, override, expectId] of JUDGE_SMOKE_HOLES) {
  await check(`T2d 第三面击穿：${label} → exit 2 且 sutDefect 面不成立`, () => {
    const { runTier2, judgeTier2JudgeChannelSmoke } = pure();
    const smoke = override === undefined ? undefined : judgeSmokeEvidence(override);
    const j = judgeTier2JudgeChannelSmoke(smoke);
    assert(j.ok === false, `${label} 应判第三面红：${JSON.stringify(j)}`);
    assert(isRed(itemById(j.items, expectId)), `${label} 应把「${expectId}」判红：${JSON.stringify(j.items)}`);
    const r = runTier2(tier2Env({ judgeSmoke: smoke }));
    assert(r.exitCode === 2, `${label} 聚合应 exit 2（覆盖矩阵空 fail-closed），实得 ${r.exitCode}`);
    assert(r.coverage && r.coverage.sutDefect === false, `${label} 覆盖矩阵须记第三面不成立：${JSON.stringify(r.coverage)}`);
    assert(!r.tailLine, `${label} 不得带绿尾行`);
  });
}

// ══════════════════════════════════════════════════════════════════════
// T3 fail-safe 不变量（catch-all 被旁路必红）
// ══════════════════════════════════════════════════════════════════════

const CATCH_ALL_HOLES = [
  ['出现第五态标签', (p) => { p.verdict.unknownStates = ['FLAKY']; }],
  ['catch-all 不可达', (p) => { p.verdict.catchAllReachable = false; }],
  ['态计数混入未知终态键', (p) => { p.verdict.stateCounts = { ...p.verdict.stateCounts, RETRY: 1 }; }],
];

for (const [label, mutate] of CATCH_ALL_HOLES) {
  await check(`T3 fail-safe 不变量：${label} → 必红`, () => {
    const { judgeTier2RunEvidence, runTier2 } = pure();
    const proj = projection({ streaming: true });
    mutate(proj);
    const r = judgeTier2RunEvidence(proj);
    assert(r.ok === false, `${label} 应整体红：${JSON.stringify(r)}`);
    assert(isRed(itemById(r.items, 'catch-all-intact')),
      `${label} 须把「catch-all-intact」判红：${JSON.stringify(r.items)}`);
    const holed = projection({ caseId: READ_CASE });
    mutate(holed);
    const agg = runTier2(tier2Env({
      cases: [
        caseEntry({ caseId: READ_CASE, proj: holed }),
        caseEntry({ caseId: STREAM_CASE, streaming: true }),
      ],
    }));
    assert(agg.exitCode === 1, `${label} 聚合应 exit 1，实得 ${agg.exitCode}`);
  });
}

// ══════════════════════════════════════════════════════════════════════
// T4 壳层用法面（tier-2 专用严格解析器；全部走 fail-fast 64 路，零真机链）
// ══════════════════════════════════════════════════════════════════════

const LOOPBACK = 'http://127.0.0.1:1/'; // 回环且必然拒连——用法错须在任何连接前判定
function caseyRun(args, extraEnv = {}) {
  return spawnSync(process.execPath, [CASEY, ...args], {
    cwd: ROOT, encoding: 'utf8', timeout: 60000,
    env: { ...process.env, ...extraEnv },
  });
}

const USAGE_CASES = [
  ['缺 --sut', ['selftest', '--tier2']],
  ['--sut 缺值', ['selftest', '--tier2', '--sut']],
  ['非回环 --sut', ['selftest', '--tier2', '--sut', 'https://tier2-usage.invalid/']],
  ['--case 缺值', ['selftest', '--tier2', '--sut', LOOPBACK, '--case']],
  ['重复同一 --case', ['selftest', '--tier2', '--sut', LOOPBACK, '--case', READ_CASE, '--case', READ_CASE]],
  ['危险 caseId（路径穿越）', ['selftest', '--tier2', '--sut', LOOPBACK, '--case', '../etc']],
  ['危险 caseId（含分隔符）', ['selftest', '--tier2', '--sut', LOOPBACK, '--case', 'a/b']],
  ['未知参数', ['selftest', '--tier2', '--sut', LOOPBACK, '--nope', 'x']],
  ['--tier1 --tier2 并出', ['selftest', '--tier1', '--tier2', '--sut', LOOPBACK]],
];

for (const [label, args] of USAGE_CASES) {
  await check(`T4 用法面：${label} → exit 64`, () => {
    const r = caseyRun(args);
    assert(r.status === 64, `${label} 应 exit 64（用参错误），实得 ${r.status}；输出尾：${((r.stdout || '') + (r.stderr || '')).slice(-300)}`);
  });
}

await check('T4 用法面：重复 --case 收数组且钉顺序（拒付回执按给定次序列出）', () => {
  const r = caseyRun(['selftest', '--tier2', '--sut', LOOPBACK, '--case', 'zzz_not_member_b', '--case', 'zzz_not_member_a']);
  assert(r.status === 64, `非成员多 --case 应 exit 64，实得 ${r.status}`);
  const text = (r.stdout || '') + (r.stderr || '');
  const ib = text.indexOf('zzz_not_member_b');
  const ia = text.indexOf('zzz_not_member_a');
  assert(ib >= 0 && ia >= 0, `拒付回执须列出两个 --case（证明收数组而非后值覆盖前值）：${text.slice(-300)}`);
  assert(ib < ia, `--case 须按给定顺序钉住（b 先于 a），实得 b@${ib} a@${ia}`);
});

await check('T4 用法面：--help 含 tier2 可用描述（不再是 P9 桩标记）', () => {
  const r = caseyRun(['--help']);
  assert(r.status === 0, `--help 应 exit 0，实得 ${r.status}`);
  const text = r.stdout || '';
  assert(text.includes('selftest --tier2'), '--help 须含 selftest --tier2');
  assert(text.includes('--authorize-mutation'), '--help 须说明变更型条目的逐次授权旗标 --authorize-mutation');
  const line = text.split('\n').find((l) => l.includes('selftest --tier2')) || '';
  assert(!line.includes('[P9]'), `tier2 落地后 --help 不应再标未实现：${line.trim()}`);
});

// ══════════════════════════════════════════════════════════════════════
// T4b 凭据扫描时序钉（原始字节先扫 → 投影 → 落盘前再扫；命中即零证据落盘）
// ══════════════════════════════════════════════════════════════════════

await check('T4b 三阶段有序全跑 + 零命中 → 允许证据落盘', () => {
  const { judgeTier2ScanTimeline } = pure();
  const r = judgeTier2ScanTimeline({ stages: [...REQUIRED_SCAN_STAGES], hits: [] });
  assert(r && r.ok === true && r.emitEvidence === true,
    `有序三阶段零命中应放行落盘：${JSON.stringify(r)}`);
});

const SCAN_HOLES = [
  ['先投影后扫（时序颠倒）', { stages: ['projection', 'raw_bytes', 'pre_write'], hits: [] }],
  ['缺原始字节阶段', { stages: ['projection', 'pre_write'], hits: [] }],
  ['缺落盘前复扫', { stages: ['raw_bytes', 'projection'], hits: [] }],
  ['白名单外嵌套敏感值命中', { stages: [...REQUIRED_SCAN_STAGES], hits: [{ stage: 'raw_bytes', rule: 'nested-sensitive-value' }] }],
  ['畸形 JSON 命中', { stages: [...REQUIRED_SCAN_STAGES], hits: [{ stage: 'raw_bytes', rule: 'malformed-json' }] }],
  ['目标地址形态命中', { stages: [...REQUIRED_SCAN_STAGES], hits: [{ stage: 'pre_write', rule: 'target-address-shape' }] }],
  ['子进程 stderr 命中', { stages: [...REQUIRED_SCAN_STAGES], hits: [{ stage: 'raw_bytes', rule: 'child-stderr-sensitive' }] }],
];

for (const [label, input] of SCAN_HOLES) {
  await check(`T4b 扫描击穿：${label} → 零证据落盘`, () => {
    const { judgeTier2ScanTimeline } = pure();
    const r = judgeTier2ScanTimeline(input);
    assert(r.ok === false, `${label} 应判红：${JSON.stringify(r)}`);
    assert(r.emitEvidence === false, `${label} 必须零证据落盘（fail-closed）：${JSON.stringify(r)}`);
  });
}

await check('T4b 扫描命中传导：聚合层不落证据且不绿', () => {
  const { runTier2 } = pure();
  const proj = projection({ caseId: READ_CASE });
  proj.credentialScan = { stages: [...REQUIRED_SCAN_STAGES], hits: [{ stage: 'pre_write', rule: 'target-address-shape' }] };
  const r = runTier2(tier2Env({
    cases: [
      caseEntry({ caseId: READ_CASE, proj }),
      caseEntry({ caseId: STREAM_CASE, streaming: true }),
    ],
  }));
  assert(r.exitCode === 1, `扫描命中应 exit 1，实得 ${r.exitCode}`);
  assert(r.evidenceEmitted === false, `扫描命中时聚合层须标零证据落盘：${JSON.stringify(r)}`);
});

// ══════════════════════════════════════════════════════════════════════
// T5 「机器面绿≠完成」尾行（纯层常量 + 壳层透传双钉）
// ══════════════════════════════════════════════════════════════════════

await check('T5 纯层：exit 0 路径必带尾行常量', () => {
  const { runTier2, TIER2_MACHINE_GREEN_TAIL } = pure();
  assert(TIER2_MACHINE_GREEN_TAIL.includes('机器面绿'), `尾行常量须点明「机器面绿≠完成」：${TIER2_MACHINE_GREEN_TAIL}`);
  assert(TIER2_MACHINE_GREEN_TAIL.includes('ADR-0009'), `尾行常量须引 ADR-0009：${TIER2_MACHINE_GREEN_TAIL}`);
  assert(/人签|真机 UAT/.test(TIER2_MACHINE_GREEN_TAIL), `尾行常量须点明人签真机 UAT：${TIER2_MACHINE_GREEN_TAIL}`);
  const r = runTier2(tier2Env());
  assert(r.exitCode === 0, `尾行钉的前提是全绿，实得 exit ${r.exitCode}`);
  assert(r.tailLine === TIER2_MACHINE_GREEN_TAIL,
    `exit 0 结果须原样带常量尾行：${JSON.stringify(r.tailLine)}`);
  // 非 0 路径不得挂绿尾行（防误读成完成）。
  const red = runTier2(tier2Env({
    cases: [caseEntry({ caseId: READ_CASE, receiptClass: 'stage_failed' }), caseEntry({ caseId: STREAM_CASE, streaming: true })],
  }));
  assert(!red.tailLine, `非 0 路径不得带绿尾行：${JSON.stringify(red.tailLine)}`);
});

await check('T5 壳层透传：bin/casey.mjs 复用纯层常量、不另抄字面量', () => {
  const src = readFileSync(CASEY, 'utf8');
  assert(/selftest-tier2\.mjs/.test(src), 'bin/casey.mjs 须从 lib/selftest-tier2.mjs 取纯层');
  assert(src.includes('TIER2_MACHINE_GREEN_TAIL'), 'bin/casey.mjs 须引用尾行常量（单一事实源）');
  assert(!src.includes('机器面绿≠完成'), 'bin/casey.mjs 不得硬抄尾行文案字面量（会与纯层漂移）');
  assert(!/notImplemented\('selftest --tier2'/.test(src), 'bin/casey.mjs 仍留 --tier2 桩');
});

// ══════════════════════════════════════════════════════════════════════
// T6 tier1 无回归（横切锚点；修前修后都应绿）
// ══════════════════════════════════════════════════════════════════════

await check('T6 tier1 无回归：selftest --tier1 仍 exit 0', () => {
  const r = caseyRun(['selftest', '--tier1']);
  assert(r.status === 0, `selftest --tier1 应 exit 0，实得 ${r.status}；输出尾：${((r.stdout || '') + (r.stderr || '')).slice(-300)}`);
});

// ══════════════════════════════════════════════════════════════════════
// T7 manifest 强制钉（零动态发现；成员/上限/授权全按人签 manifest）
// ══════════════════════════════════════════════════════════════════════

await check('T7 签署版 manifest 在场且结构合法（.draft 不算数）', () => {
  assert(existsSync(MANIFEST),
    `缺签署版 cases/tier2-suite.manifest.json（草案 cases/tier2-suite.manifest.draft.json 未签不算数）`);
  const text = readFileSync(MANIFEST, 'utf8');
  const m = JSON.parse(text);
  assert(m.signed === true && typeof m.signerId === 'string' && typeof m.signedAt === 'string',
    `manifest 须人签（signed/signerId/signedAt）：${JSON.stringify({ signed: m.signed, signerId: m.signerId })}`);
  assert(Number.isInteger(m.caseLimit) && m.caseLimit > 0, `manifest 须声明 case 数上限：${m.caseLimit}`);
  assert(typeof m.winProbeResultPath === 'string' && m.winProbeResultPath.length > 0,
    'manifest 须记 win-probe 结果文件路径');
  assert(typeof m.outOfBandReceiptPath === 'string' && m.outOfBandReceiptPath.length > 0,
    'manifest 须记带外账户回执文件路径');
  assert(Array.isArray(m.members) && m.members.length > 0, 'manifest 须有非空 members');
  assert(m.members.length <= m.caseLimit, `members 数不得超 caseLimit（${m.members.length} > ${m.caseLimit}）`);
  for (const member of m.members) {
    assert(typeof member.caseId === 'string' && /^[A-Za-z0-9_]+$/.test(member.caseId),
      `成员 caseId 须安全单段：${member.caseId}`);
    assert(['read', 'mutation'].includes(member.effect), `成员 effect 须 ∈ {read,mutation}：${member.effect}`);
    assert(Number.isInteger(member.timeoutMs) && member.timeoutMs > 0, `成员须声明超时：${member.caseId}`);
    assert(typeof member.cleanupObligation === 'string' && member.cleanupObligation.length > 0,
      `成员须声明清理义务：${member.caseId}`);
    assert(member.smokeAuthorized === true, `manifest 成员须带 smoke 授权标志：${member.caseId}`);
    assert(member.artifacts && typeof member.artifacts === 'object',
      `成员须逐件记 artifact hash：${member.caseId}`);
    for (const [rel, digest] of Object.entries(member.artifacts)) {
      assert(/^[0-9a-f]{64}$/.test(digest), `artifact hash 须为 sha256 十六进制：${rel}`);
      const abs = join(ROOT, rel);
      assert(existsSync(abs), `manifest 引的 artifact 不在场：${rel}`);
      assert(sha256(readFileSync(abs)) === digest, `artifact hash 失配（件已漂移）：${rel}`);
    }
    if (member.effect === 'mutation') {
      assert(member.perRunApproval === true,
        `变更型成员须标逐次授权义务（perRunApproval）：${member.caseId}`);
    }
  }
  // 凭据纪律：manifest 本体零凭据、零真实目标地址（只允许回环/相对路径）。
  const lowered = text.toLowerCase();
  for (const kw of ['password', 'authorization', 'bearer ', 'x-api-key', 'apikey', 'set-cookie', 'secret']) {
    assert(!lowered.includes(kw), `manifest 不得含禁字段关键词「${kw}」`);
  }
  for (const url of text.match(/https?:\/\/[^"\s]+/g) || []) {
    assert(/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url), `manifest 不得含真实目标地址：${url}`);
  }
});

await check('T7 历史真机先例按产物 hash 绑定（GRILL D1 v3）', () => {
  assert(existsSync(MANIFEST), '缺签署版 cases/tier2-suite.manifest.json');
  const m = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  assert(Array.isArray(m.historicalPrecedents) && m.historicalPrecedents.length > 0,
    'manifest 须记历史真机先例（SUT_DEFECT 通道健在的证据引用）');
  for (const p of m.historicalPrecedents) {
    assert(typeof p.path === 'string' && /^[0-9a-f]{64}$/.test(p.sha256 || ''),
      `先例须 path + sha256 绑定：${JSON.stringify(p)}`);
    // runs/ 在 .gitignore:33 内——先例产物不进版本库，异机克隆必然缺件。
    // 故硬钉「已入册文书里有同 hash 的签认记录」（该文书在版本库内），
    // 产物在场时再核实 hash；在场而失配 = 真漂移，必红。
    assert(typeof p.attestedIn === 'string' && existsSync(join(ROOT, p.attestedIn)),
      `先例须指向在册签认文书（版本库内）：${JSON.stringify(p.attestedIn)}`);
    const attest = readFileSync(join(ROOT, p.attestedIn), 'utf8');
    assert(attest.includes(p.sha256.slice(0, 8)),
      `签认文书 ${p.attestedIn} 未记该先例 hash 前缀 ${p.sha256.slice(0, 8)}`);
    const abs = join(ROOT, p.path);
    if (existsSync(abs)) {
      assert(sha256(readFileSync(abs)) === p.sha256, `先例产物 hash 失配（件已漂移）：${p.path}`);
    }
  }
});

await check('T7 非 manifest 成员 --case → exit 64', () => {
  const r = caseyRun(['selftest', '--tier2', '--sut', LOOPBACK, '--case', 'zzz_not_a_member']);
  assert(r.status === 64, `非成员 caseId 应 exit 64（用法错先于前置门判定），实得 ${r.status}`);
});

await check('T7 --case 数量超 manifest 上限 → exit 64', () => {
  const limit = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')).caseLimit : 4;
  const args = ['selftest', '--tier2', '--sut', LOOPBACK];
  for (let i = 0; i <= limit; i++) args.push('--case', `zzz_over_limit_${i}`);
  const r = caseyRun(args);
  assert(r.status === 64, `--case 超上限（${limit}）应 exit 64，实得 ${r.status}`);
});

await check('T7 manifest checksum 失配 → exit 2（纯层前置门）', () => {
  const { runTier2 } = pure();
  const probes = readyProbes();
  probes.suiteManifest = { present: true, checksumOk: false, signed: true, memberCount: 2, caseLimit: 4 };
  const r = runTier2(tier2Env({ probes }));
  assert(r.exitCode === 2, `manifest checksum 失配应 exit 2，实得 ${r.exitCode}`);
  assert(isRed(itemById(r.readiness, 'suite-manifest')), 'checksum 失配须把 suite-manifest 判红');
  assert((r.caseResults || []).length === 0, 'checksum 失配时不得跑任何用例');
});

await check('T7 manifest 未人签 → exit 2', () => {
  const { runTier2 } = pure();
  const probes = readyProbes();
  probes.suiteManifest = { present: true, checksumOk: true, signed: false, memberCount: 2, caseLimit: 4 };
  const r = runTier2(tier2Env({ probes }));
  assert(r.exitCode === 2, `未人签 manifest 应 exit 2，实得 ${r.exitCode}`);
});

await check('T7 变更型条目无 smoke 授权标志 → exit 2 且该例拒跑', () => {
  const { runTier2 } = pure();
  const r = runTier2(tier2Env({
    cases: [
      caseEntry({ caseId: 'tc_catalog_wf_crud', effect: 'mutation', smokeAuthorized: false, authorizedMutation: true }),
      caseEntry({ caseId: STREAM_CASE, streaming: true }),
    ],
  }));
  assert(r.exitCode === 2, `未授权变更型条目应 exit 2，实得 ${r.exitCode}`);
  const entry = (r.caseResults || []).find((c) => c && c.caseId === 'tc_catalog_wf_crud');
  assert(!entry || entry.ran === false, `未授权变更型条目须拒跑：${JSON.stringify(entry)}`);
});

await check('T7 变更型条目缺本次 --authorize-mutation → 拒跑 exit 2 且 receipt 记录', () => {
  const { runTier2 } = pure();
  const r = runTier2(tier2Env({
    cases: [
      caseEntry({ caseId: 'tc_catalog_wf_crud', effect: 'mutation', smokeAuthorized: true, authorizedMutation: false }),
      caseEntry({ caseId: STREAM_CASE, streaming: true }),
    ],
  }));
  assert(r.exitCode === 2, `缺逐次授权应 exit 2，实得 ${r.exitCode}`);
  const entry = (r.caseResults || []).find((c) => c && c.caseId === 'tc_catalog_wf_crud');
  assert(entry && entry.ran === false, `缺逐次授权须拒跑：${JSON.stringify(entry)}`);
  assert(entry && entry.receipt && /authoriz/i.test(String(entry.receipt.refusalReason || '')),
    `拒跑须落 receipt 记录授权缺失原因：${JSON.stringify(entry && entry.receipt)}`);
  // 逐次授权到位 → 放行（证明不是常闭死口子）。
  const ok = runTier2(tier2Env({
    cases: [
      caseEntry({ caseId: 'tc_catalog_wf_crud', effect: 'mutation', smokeAuthorized: true, authorizedMutation: true }),
      caseEntry({ caseId: STREAM_CASE, streaming: true }),
    ],
  }));
  assert(ok.exitCode === 0, `smoke 授权 + 本次逐次授权齐备时应放行，实得 ${ok.exitCode}`);
});

// ══════════════════════════════════════════════════════════════════════
// T8 裁判通道运行时冒烟钉（真调现役 bin/verdict.mjs 二进制）
// ══════════════════════════════════════════════════════════════════════
// 三轴反例集不另造：全部从已冻 fixtures/p2/verdict-cases.json 的形状派生
//   （引已冻接缝，不倒着裁）。派生规则逐条写在 why 里。

const tmpDir = mkdtempSync(join(tmpdir(), 'casey-p9-tier2-'));
try {
  await check('T8 三轴反例集源自已冻 verdict-cases.json（未漂移）', () => {
    const digest = sha256(readFileSync(VERDICT_FIX));
    assert(digest === 'a9adb77af80cc943a3340ed87800d0746ae749326a72e69f295f7ca7b0c673f2',
      `verdict-cases.json 已漂移（prd-p2-intent-compile 冻结值失配）：${digest}`);
  });

  const fixture = JSON.parse(readFileSync(VERDICT_FIX, 'utf8'));
  const frozen = (name) => {
    const found = fixture.cases.find((c) => c.name === name);
    assert(found, `verdict-cases.json 缺已冻案「${name}」`);
    return structuredClone(found.input);
  };

  // 到达口②：由 sut_defect 派生——动作未做成（resolution=none + 回读 false + 无同签名元素）
  //   且本步归因错误信封失败（HTTP 200 但 body 状态非 200），走 decide() 的 ap===false 分支。
  const arrivalTwo = frozen('sut_defect');
  arrivalTwo.steps[0].action = { kind: 'click', resolution: 'none', identityReadback: { ok: false }, driftProbe: { sameSignatureUniquePresent: false } };
  arrivalTwo.steps[0].forensics.network[0].status = 200;
  arrivalTwo.steps[0].forensics.network[0].errorEnvelope = { field: 'status', expected: 200, actual: 500, ok: false };

  // 错步归因：由 sut_defect 派生——5xx 归因到别的步 → 不得背书本步，落 SUT_DEFECT_OR_STALE。
  const misattributed = frozen('sut_defect');
  misattributed.steps[0].forensics.network[0].attributedStepId = 'atstep_99';

  // 第五列 id ★r1 H1：与生产采集能力 `TIER2_JUDGE_COUNTEREXAMPLES` 的 id 一一对应，由 T8b 交叉钉住，
  //   防生产侧反例集悄悄放水（本表是独立规格，绝不改成「用实现验实现」）。
  const SMOKE = [
    ['SUT_DEFECT 到达口①（动作做成 + 硬断言失败 + 本步归因 5xx）', frozen('sut_defect'), 'SUT_DEFECT', null, 'sut_defect_arrival_1'],
    ['SUT_DEFECT 到达口②（动作未做成 + 本步归因信封失败）', arrivalTwo, 'SUT_DEFECT', null, 'sut_defect_arrival_2'],
    ['错步归因：背景 401 归别步 → 不翻本步', frozen('background_401_not_attributed'), 'PASS', null, 'background_401_not_attributed'],
    ['错步归因：5xx 归别步 → 不冒充缺陷', misattributed, 'NEEDS_HUMAN', 'SUT_DEFECT_OR_STALE', 'misattributed_5xx'],
    ['catch-all：无漂移信号无取证 → fail-safe', frozen('indeterminate'), 'NEEDS_HUMAN', 'INDETERMINATE', 'catch_all_indeterminate'],
    ['多匹配 → 不记缺陷', frozen('ambiguous_action'), 'NEEDS_HUMAN', 'AMBIGUOUS_ACTION', 'ambiguous_action'],
    ['正向漂移确证 → 可自愈', frozen('harness_error'), 'HARNESS_ERROR', null, 'harness_error_drift'],
    ['全过 → PASS', frozen('pass'), 'PASS', null, 'pass'],
  ];

  const produced = new Set();
  for (const [label, input, expectVerdict, expectReason] of SMOKE) {
    await check(`T8 裁判冒烟：${label}`, () => {
      const inFile = join(tmpDir, `${sha256(label).slice(0, 12)}.in.json`);
      const outFile = join(tmpDir, `${sha256(label).slice(0, 12)}.out.json`);
      writeFileSync(inFile, JSON.stringify(input));
      execFileSync(process.execPath, [VERDICT, '--axes', inFile, '--out', outFile], { stdio: 'pipe' });
      const out = JSON.parse(readFileSync(outFile, 'utf8'));
      const step = out.steps && out.steps[0];
      assert(step, `verdict 产物缺 steps[0]：${JSON.stringify(out)}`);
      assert(FOUR_STATES.includes(step.verdict), `产出第五态标签「${step.verdict}」（catch-all 被旁路）`);
      assert(step.verdict === expectVerdict, `期望 verdict=${expectVerdict}，实得 ${step.verdict}（reason=${step.reason}）`);
      if (expectReason) assert(step.reason === expectReason, `期望 reason=${expectReason}，实得 ${step.reason}`);
      produced.add(step.verdict);
    });
  }

  await check('T8 裁判冒烟：四态精确全覆盖（无第五态）', () => {
    for (const state of FOUR_STATES) {
      assert(produced.has(state), `裁判冒烟未产出「${state}」，实产 ${[...produced].join('/')}`);
    }
    assert(produced.size === FOUR_STATES.length, `产出态数超四态：${[...produced].join('/')}`);
  });

  // ★r1 H1：生产采集能力的反例集必须与本表同构——id 集合、期望四态、期望理由逐项等值。
  await check('T8b 生产反例集与本金牌 SMOKE 表同构（防生产侧放水）', async () => {
    let mod = null;
    try { mod = await import('../../lib/selftest-tier2-judge-smoke.mjs'); }
    catch (e) { throw new Error(`生产采集能力 lib/selftest-tier2-judge-smoke.mjs 缺席：${String(e?.message || e).slice(-160)}`); }
    const prod = mod.TIER2_JUDGE_COUNTEREXAMPLES;
    assert(Array.isArray(prod) && Object.isFrozen(prod), 'TIER2_JUDGE_COUNTEREXAMPLES 须为冻结数组');
    assert(typeof mod.collectTier2JudgeSmoke === 'function', '缺生产采集入口 collectTier2JudgeSmoke');
    const norm = (rows) => rows.map((r) => `${r.id}|${r.expectVerdict}|${r.expectReason || ''}`).sort().join('\n');
    const mine = norm(SMOKE.map(([, , expectVerdict, expectReason, id]) => ({ id, expectVerdict, expectReason })));
    const theirs = norm(prod.map((r) => ({ id: r.id, expectVerdict: r.expectVerdict, expectReason: r.expectReason })));
    assert(mine === theirs, `反例集不同构：\n本金牌\n${mine}\n生产\n${theirs}`);
    // 四态在生产反例集里也必须齐（否则冒烟跑完也覆盖不到四态）。
    for (const state of FOUR_STATES) {
      assert(prod.some((r) => r.expectVerdict === state), `生产反例集未覆盖「${state}」`);
    }
  });

  // ★r2 H1 残口：期望理由为 null 的案，实际冒出任意理由都必须判不符（原来只在期望为真值时才比）。
  await check('T8c 冻结期望比较精确到理由（空期望理由 ≠ 任意理由）', async () => {
    const { matchesFrozenExpectation } = await import('../../lib/selftest-tier2-judge-smoke.mjs');
    assert(typeof matchesFrozenExpectation === 'function', '缺可独立驱动的比较器 matchesFrozenExpectation');
    const nullReasonSpec = { id: 'x', expectVerdict: 'SUT_DEFECT', expectReason: null };
    assert(matchesFrozenExpectation(nullReasonSpec, 'SUT_DEFECT', null) === true, '四态与空理由都对应判过');
    assert(matchesFrozenExpectation(nullReasonSpec, 'SUT_DEFECT', '') === true, '空串理由等同无理由');
    assert(matchesFrozenExpectation(nullReasonSpec, 'SUT_DEFECT', 'ANY_REASON') === false,
      '期望无理由却冒出理由 → 必判不符（本条就是 r2 逮住的后门）');
    assert(matchesFrozenExpectation(nullReasonSpec, 'PASS', null) === false, '四态不符必判不符');
    const reasonSpec = { id: 'y', expectVerdict: 'NEEDS_HUMAN', expectReason: 'INDETERMINATE' };
    assert(matchesFrozenExpectation(reasonSpec, 'NEEDS_HUMAN', 'INDETERMINATE') === true, '理由对应判过');
    assert(matchesFrozenExpectation(reasonSpec, 'NEEDS_HUMAN', 'AMBIGUOUS_ACTION') === false, '理由不符必判不符');
    assert(matchesFrozenExpectation(reasonSpec, 'NEEDS_HUMAN', null) === false, '期望有理由却没理由 → 必判不符');
    assert(matchesFrozenExpectation({ id: 'z', expectVerdict: 'FLAKY', expectReason: null }, 'FLAKY', null) === false,
      '四态外标签一律不认');
    // 生产表里期望空理由的案确实存在（否则本钉空转）
    const { TIER2_JUDGE_COUNTEREXAMPLES } = await import('../../lib/selftest-tier2-judge-smoke.mjs');
    assert(TIER2_JUDGE_COUNTEREXAMPLES.some((r) => r.expectReason == null), '生产反例集须含空期望理由的案');
  });
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}

// ══════════════════════════════════════════════════════════════════════
// T9 壳层级负控（★r1 H3/H4/H5/M1/M2/M3）——全部 hermetic：合成夹具 + 只读核验，
//     零 SUT 接触、零真实地址（win-probe 只验消费端与源形态，绝不真跑它的网络请求）。
// ══════════════════════════════════════════════════════════════════════

const shellTmp = mkdtempSync(join(tmpdir(), 'casey-p9-tier2-shell-'));
try {
  // ── H3 manifest 准入闭合：结构校验器逐条击穿 ──
  await check('T9a-H3 manifest 结构校验器：真件过，逐条坏件拒', async () => {
    let mod = null;
    try { mod = await import('../../lib/selftest-tier2-manifest.mjs'); }
    catch (e) { throw new Error(`manifest 准入模块缺席：${String(e?.message || e).slice(-160)}`); }
    const { validateSuiteManifestDoc } = mod;
    assert(typeof validateSuiteManifestDoc === 'function', '缺 validateSuiteManifestDoc');
    assert(existsSync(MANIFEST), '缺签署版 manifest（本钉以真件为基线）');
    const real = JSON.parse(readFileSync(MANIFEST, 'utf8'));
    const baseline = validateSuiteManifestDoc(real);
    assert(baseline.ok === true, `真件应过结构校验：${JSON.stringify(baseline.problems)}`);

    const holes = [
      ['draft 标记在场（提签遗漏不许当已签）', (m) => { m.draft = true; }],
      ['未人签', (m) => { m.signed = false; }],
      ['签认人缺', (m) => { m.signerId = null; }],
      ['成员重复', (m) => { m.members = [m.members[0], structuredClone(m.members[0])]; }],
      ['成员数超上限', (m) => { m.caseLimit = 1; m.members = [m.members[0], { ...structuredClone(m.members[0]), caseId: 'tc_second_member' }]; }],
      ['缺必备执行件（events）', (m) => { delete m.members[0].artifacts[`cases/${m.members[0].caseId}/events.json`]; }],
      ['artifact 路径越界（上跳段）', (m) => { m.members[0].artifacts['../../etc/passwd'] = 'a'.repeat(64); }],
      ['artifact 路径跨用例目录', (m) => { m.members[0].artifacts['cases/tc_other/events.json'] = 'b'.repeat(64); }],
      ['artifact 集含约定外文件', (m) => { m.members[0].artifacts[`cases/${m.members[0].caseId}/notes.txt`] = 'c'.repeat(64); }],
      ['artifact hash 非 sha256', (m) => { m.members[0].artifacts[`cases/${m.members[0].caseId}/events.json`] = 'not-a-hash'; }],
      ['成员缺超时声明', (m) => { delete m.members[0].timeoutMs; }],
      ['成员缺清理义务', (m) => { delete m.members[0].cleanupObligation; }],
      ['成员缺 smoke 授权标志', (m) => { m.members[0].smokeAuthorized = false; }],
      ['成员 caseId 不安全', (m) => { m.members[0].caseId = '../etc'; }],
      ['连通结果路径越界', (m) => { m.winProbeResultPath = '/etc/passwd'; }],
      ['带外回执路径含上跳段', (m) => { m.outOfBandReceiptPath = 'runs/../../etc/x.json'; }],
      ['成员集为空', (m) => { m.members = []; }],
      ['先例缺 hash', (m) => { m.historicalPrecedents = [{ id: 'x', path: 'runs/a.json', attestedIn: 'docs/x.md' }]; }],
    ];
    for (const [label, mutate] of holes) {
      const doc = structuredClone(real);
      mutate(doc);
      const r = validateSuiteManifestDoc(doc);
      assert(r.ok === false, `坏件应被拒：${label}`);
    }
    // 变更型成员必须带逐次授权义务标志
    const mutationDoc = structuredClone(real);
    mutationDoc.members[0].effect = 'mutation';
    delete mutationDoc.members[0].perRunApproval;
    assert(validateSuiteManifestDoc(mutationDoc).ok === false, '变更型成员缺逐次授权义务标志应被拒');
  });

  await check('T9a-H3 manifest 采集：hash 与解析同一份字节 + 未在册即不放行', async () => {
    const { readSuiteManifest } = await import('../../lib/selftest-tier2-manifest.mjs');
    const src = readFileSync(join(ROOT, 'lib', 'selftest-tier2-manifest.mjs'), 'utf8');
    // 单次读字节：只许出现一次 manifest 读取，且 hash 与 JSON.parse 都吃这份 buffer。
    assert(/const digest = sha256\(bytes\)/.test(src) && /JSON\.parse\(bytes\.toString\('utf8'\)\)/.test(src),
      'manifest 的 hash 与解析须吃同一份字节（防 hash 一份、解析另一份的 TOCTOU 缝）');
    const got = readSuiteManifest();
    assert(got.present === true, '真件应在场');
    assert(typeof got.digest === 'string' && /^[0-9a-f]{64}$/.test(got.digest), 'manifest 采集须回字节 digest');
    // 未冻入契约 testChecksums 或字节失配 → checksumOk 必 false（fail-closed），且不出可用成员。
    if (!got.checksumOk) {
      assert(got.memberCount === 0 && got.memberIds.length === 0,
        `checksum 未过时不得给出可用成员：${JSON.stringify(got.memberIds)}`);
    }
  });

  // ── H4 原始字节先扫：白名单外嵌套敏感值在【解析前】就被抓 ──
  await check('T9b-H4 原始产物字节扫描：嵌套敏感值命中 raw_bytes 且零证据落盘', async () => {
    let scan = null;
    try { scan = await import('../../lib/selftest-tier2-scan.mjs'); }
    catch (e) { throw new Error(`扫描模块缺席：${String(e?.message || e).slice(-160)}`); }
    const { scanRawArtifactFile, createScanRecorder } = scan;
    const dirtyDir = join(shellTmp, 'dirty');
    mkdirSync(dirtyDir, { recursive: true });
    // 嵌套三层的禁字段（白名单投影必然把它丢掉——只扫投影就永远看不见）
    const dirty = join(dirtyDir, 'axes.json');
    writeFileSync(dirty, JSON.stringify({ steps: [{ stepId: 'atstep_0', deep: { nested: { authorization: 'x-y-z' } } }] }), 'utf8');
    const hit = scanRawArtifactFile(dirty);
    assert(hit.hits.length > 0 && hit.hits.every((h) => h.stage === 'raw_bytes'),
      `嵌套敏感值须在 raw_bytes 阶段命中：${JSON.stringify(hit.hits)}`);

    // 畸形 JSON 单列具名规则
    const broken = join(dirtyDir, 'verdict.json');
    writeFileSync(broken, '{ not json', 'utf8');
    assert(scanRawArtifactFile(broken).hits.some((h) => h.rule === 'malformed-json'), '畸形 JSON 须具名命中');

    // 非回环地址形态命中
    const addressed = join(dirtyDir, 'report-model.json');
    writeFileSync(addressed, JSON.stringify({ schemaVersion: 1, url: 'https://real-target.invalid/x' }), 'utf8');
    assert(scanRawArtifactFile(addressed).hits.some((h) => h.rule === 'target-address-shape'), '非回环地址形态须命中');

    // 阶段记账只在真跑完才记（不许硬写三阶段常量冒充跑满）
    const rec = createScanRecorder();
    assert(rec.snapshot().stages.length === 0, '记账器初始不得预置任何阶段');
    rec.complete('raw_bytes');
    assert(rec.snapshot().stages.join(',') === 'raw_bytes', '只记真跑完的阶段');
    const { judgeTier2ScanTimeline } = pure();
    assert(judgeTier2ScanTimeline(rec.snapshot()).emitEvidence === false, '阶段没跑满不得放行落盘');
    rec.add([{ stage: 'raw_bytes', rule: 'nested-sensitive-value' }]);
    rec.complete('projection'); rec.complete('pre_write');
    assert(judgeTier2ScanTimeline(rec.snapshot()).emitEvidence === false, '有命中即零证据落盘（fail-closed）');
  });

  await check('T9b-H4 扫描判据复用共享凭据门（禁词表 + 凭据文件敏感字面量）', async () => {
    const src = readFileSync(join(ROOT, 'lib', 'selftest-tier2-scan.mjs'), 'utf8');
    assert(/from '\.\/cred-gate\.mjs'/.test(src), '扫描须从共享凭据门取判据，不许自造第二套');
    assert(/FORBIDDEN_KEYWORDS/.test(src) && /collectSecretLiterals/.test(src),
      '须同时用禁字段关键词表与凭据文件真实敏感字面量');
    const { scanTextForSensitive } = await import('../../lib/selftest-tier2-scan.mjs');
    assert(scanTextForSensitive('{"a":"set-cookie"}', 'raw_bytes').length > 0, '禁字段关键词须命中');
    assert(scanTextForSensitive('{"a":"http://127.0.0.1:15519/x"}', 'raw_bytes').length === 0,
      '回环地址非真实目标地址（GRILL D6），地址形态规则不得误报');
  });

  // ★r2 H4 残口：carve-out 只能按【来源】精确剔除已验证的 site.target.devProxyUrl 单值，
  //   不能按「长得像回环 URL」过滤——那会把恰为回环形态的真凭据值一起放走。
  await check('T9b-H4 回环 carve-out 按来源精确、不按形状放行', async () => {
    const scan = await import('../../lib/selftest-tier2-scan.mjs');
    const src = readFileSync(join(ROOT, 'lib', 'selftest-tier2-scan.mjs'), 'utf8');
    assert(/devProxyUrl/.test(src), 'carve-out 须按来源取站点配置的 devProxyUrl 值');
    assert(!/filter\(\(s\) => !isLoopbackBaseUrl\(s\)\)/.test(src), '不得再按「长得像回环 URL」整片过滤（r2 驳回的收法）');
    assert(/carve\.has\(s\)/.test(src), 'carve-out 须字符串全等剔除，不得按形状过滤');
    // 形态收紧：带路径/query/fragment/凭据的回环 URL 一律不在剔除面内（即便回环也照扫）
    const { bareLoopbackOrigin, carveOutLiterals } = scan;
    assert(typeof bareLoopbackOrigin === 'function' && typeof carveOutLiterals === 'function', '缺可独立驱动的 carve-out 判据');
    assert(bareLoopbackOrigin('http://127.0.0.1:15519') === 'http://127.0.0.1:15519', '裸回环源可剔');
    assert(bareLoopbackOrigin('http://127.0.0.1:15519/') === 'http://127.0.0.1:15519/', '根路径仍算裸源');
    for (const shaped of [
      'http://127.0.0.1:15519/path', 'http://127.0.0.1:15519/?q=1', 'http://127.0.0.1:15519/#f',
      'http://user:pass@127.0.0.1:15519', 'https://example.invalid', 'http://10.0.0.5:8080', 'not-a-url',
    ]) {
      assert(bareLoopbackOrigin(shaped) === null, `带路径/查询/片段/凭据/非回环的形态不得进剔除面：${shaped}`);
    }
    // 剔除面必须来自 site.json 的 target.devProxyUrl，且只是那个值
    const carve = carveOutLiterals();
    assert(carve instanceof Set, 'carve-out 面须是精确值集合');
    for (const v of carve) assert(bareLoopbackOrigin(v) === v, `剔除面成员须是裸回环源：${v}`);
  });

  // ── H5 run 目录排他 + 产物时刻/一致性 ──
  await check('T9c-H5 run 目录排他：连开两次不碰撞、必为新建空目录', async () => {
    let proj = null;
    try { proj = await import('../../lib/selftest-tier2-projection.mjs'); }
    catch (e) { throw new Error(`投影模块缺席：${String(e?.message || e).slice(-160)}`); }
    const { createExclusiveRunDir } = proj;
    const a = createExclusiveRunDir('zz_golden_probe_case');
    const b = createExclusiveRunDir('zz_golden_probe_case');
    try {
      assert(a && b && a.runDirRel !== b.runDirRel, `同例连开两次必须给不同目录：${JSON.stringify([a && a.runDirRel, b && b.runDirRel])}`);
      assert(/run_tier2_\d{8}T\d{6,}Z?_[0-9a-f]{6}$/.test(a.runId) || /_[0-9a-f]{6}$/.test(a.runId),
        `run 目录名须带不可碰撞后缀：${a.runId}`);
      for (const d of [a, b]) {
        assert(existsSync(join(ROOT, d.runDirRel)), '目录须真建出');
        assert(readdirSync(join(ROOT, d.runDirRel)).length === 0, '新建 run 目录必须为空（绝不复用旧产物）');
      }
    } finally {
      rmSync(join(ROOT, 'runs', 'zz_golden_probe_case'), { recursive: true, force: true });
    }
  });

  await check('T9c-H5 receipt 归类：旧产物/退出码矛盾/附件不全 → 绝不算管线完成', async () => {
    const { classifyTier2Receipt } = await import('../../lib/selftest-tier2-projection.mjs');
    const legend = [0, 1, 2, 3, 64];
    const attachments = {
      'axes.json': true, 'verdict.json': true, 'report-model.json': true,
      'run-history.jsonl': true, 'run-metrics.json': true,
      // ★r2 新 M：录屏两件是真机正式交付必备（real-uat-runbook.md:92 第 3/4 条）
      'video.webm': true, 'video.json': true,
      'x.report.html': true, 'x.report.md': true, 'x.report.json': true,
    };
    const healthy = {
      attachments, attachmentsComplete: true, staleArtifacts: [], someArtifacts: true,
      verdictWellFormed: true, allPass: true, stateCounts: { PASS: 1, SUT_DEFECT: 0, HARNESS_ERROR: 0, NEEDS_HUMAN: 0 },
    };
    assert(classifyTier2Receipt({ projected: healthy, timedOut: false, systemicCode: null, childExitCode: 0, exitCodeLegend: legend })
      .receiptClass === 'pipeline_complete_with_verdict', '健康件应算管线完成');

    // ★r3 H5a：零步裁定的负控走真投影层——{steps:[]} 必须判不合法，绝不许配 exit 1 冒充管线完成。
    const zeroStepDir = join(shellTmp, 'zero-step-run');
    mkdirSync(zeroStepDir, { recursive: true });
    const now = Date.now();
    writeFileSync(join(zeroStepDir, 'verdict.json'), JSON.stringify({ steps: [] }), 'utf8');
    writeFileSync(join(zeroStepDir, 'axes.json'), JSON.stringify({ caseId: 'x', steps: [{ stepId: 'atstep_0', intentId: 'i', postAssertions: [] }] }), 'utf8');
    writeFileSync(join(zeroStepDir, 'report-model.json'), JSON.stringify({ schemaVersion: 1, verdictSummary: { PASS: 0, SUT_DEFECT: 0, HARNESS_ERROR: 0, NEEDS_HUMAN: 0 } }), 'utf8');
    for (const name of ['run-history.jsonl', 'run-metrics.json', 'video.webm', 'video.json', 'x.report.html', 'x.report.md', 'x.report.json']) {
      writeFileSync(join(zeroStepDir, name), '{}', 'utf8');
    }
    const { projectRunArtifacts: projectReal, createScanRecorder: mkRec } = {
      projectRunArtifacts: (await import('../../lib/selftest-tier2-projection.mjs')).projectRunArtifacts,
      createScanRecorder: (await import('../../lib/selftest-tier2-scan.mjs')).createScanRecorder,
    };
    const zeroProjected = projectReal({
      caseId: 'x', runDirRel: 'runs/x/zero', runDirAbs: zeroStepDir, exitCodeLegend: legend,
      expectedAbs: null, recorder: mkRec(), startedAtMs: now - 60000,
    });
    assert(zeroProjected.projection.verdict.stepCount === 0, '零步产物须如实投影 stepCount 0');
    assert(zeroProjected.verdictWellFormed === false, '零步裁定不得判「合法」');
    const zeroCls = classifyTier2Receipt({ projected: zeroProjected, timedOut: false, systemicCode: null, childExitCode: 1, exitCodeLegend: legend });
    assert(zeroCls.receiptClass !== 'pipeline_complete_with_verdict',
      `零步裁定配 exit 1 绝不许算管线完成，实得 ${zeroCls.receiptClass}`);
    assert(zeroCls.problems.some((p) => p.includes('零步')), `须留「零步」具名问题：${JSON.stringify(zeroCls.problems)}`);
    // exit 1 ⇔ 合法非全 PASS 也是管线完成态（业务性非 PASS 属人签语义面）
    assert(classifyTier2Receipt({ projected: { ...healthy, allPass: false }, timedOut: false, systemicCode: null, childExitCode: 1, exitCodeLegend: legend })
      .receiptClass === 'pipeline_complete_with_verdict', 'exit 1 + 合法非全 PASS 应算管线完成');
    const holes = [
      ['产物早于本次启动（复用旧件）', { ...healthy, staleArtifacts: ['axes', 'verdict'] }, 0],
      ['exit 0 但裁定非全 PASS', { ...healthy, allPass: false }, 0],
      ['exit 1 但裁定全 PASS', { ...healthy, allPass: true }, 1],
      ['附件集不全', { ...healthy, attachments: { ...attachments, 'run-metrics.json': false }, attachmentsComplete: false }, 0],
      // ★r2 新 M：缺录屏（video.webm/video.json）不得算管线完成
      ['缺录屏 video.webm', { ...healthy, attachments: { ...attachments, 'video.webm': false }, attachmentsComplete: false }, 0],
      ['缺录屏元数据 video.json', { ...healthy, attachments: { ...attachments, 'video.json': false }, attachmentsComplete: false }, 0],
      ['裁定产物不合法', { ...healthy, verdictWellFormed: false }, 0],
      ['退出码不在归一图例内', { ...healthy }, 65],
      // ★r2 H5 残口：只封 0/1 不够——2/3/64 配齐全产物此前照样被当管线完成
      ['退出码 2（熔断/互锁）配齐全产物', { ...healthy, allPass: false }, 2],
      ['退出码 3（未实现）配齐全产物', { ...healthy, allPass: false }, 3],
      ['退出码 64（用参错）配齐全产物', { ...healthy, allPass: false }, 64],
      ['退出码缺失（子进程被杀）', { ...healthy, allPass: false }, null],
    ];
    for (const [label, projected, childExitCode] of holes) {
      const r = classifyTier2Receipt({ projected, timedOut: false, systemicCode: null, childExitCode, exitCodeLegend: legend });
      assert(r.receiptClass !== 'pipeline_complete_with_verdict', `${label} 不得算管线完成，实得 ${r.receiptClass}`);
      assert(r.problems.length > 0, `${label} 须留具名问题`);
    }
    assert(classifyTier2Receipt({ projected: healthy, timedOut: true, systemicCode: null, childExitCode: null, exitCodeLegend: legend })
      .receiptClass === 'timeout', '超时须归 timeout');
    assert(classifyTier2Receipt({ projected: healthy, timedOut: false, systemicCode: 'LOGIN_PREP_FAILED', childExitCode: 1, exitCodeLegend: legend })
      .receiptClass === 'systemic_abort', '系统性拒付码须归 systemic_abort');
  });

  // ── M1 用法错零回显原始值 ──
  await check('T9d-M1 用法错回执：危险值与未知旗标一律不回显原值，只出稳定码', () => {
    const danger = caseyRun(['selftest', '--tier2', '--sut', LOOPBACK, '--case', '../etc/passwd']);
    const dangerText = (danger.stdout || '') + (danger.stderr || '');
    assert(danger.status === 64, `危险 caseId 应 exit 64，实得 ${danger.status}`);
    assert(!dangerText.includes('../etc/passwd'), `危险原值不得回显：${dangerText.slice(-200)}`);
    assert(dangerText.includes('TIER2_ARG_CASE_ID_UNSAFE'), `须出稳定拒付码：${dangerText.slice(-200)}`);

    const unknown = caseyRun(['selftest', '--tier2', '--sut', LOOPBACK, '--zzz-secret-flag']);
    const unknownText = (unknown.stdout || '') + (unknown.stderr || '');
    assert(unknown.status === 64, `未知旗标应 exit 64，实得 ${unknown.status}`);
    assert(!unknownText.includes('zzz-secret-flag'), `未知旗标原值不得回显：${unknownText.slice(-200)}`);
    assert(unknownText.includes('TIER2_ARG_UNKNOWN_FLAG'), '须出未知参数稳定码');

    // 非回环 --sut：地址原值绝不进输出（这条最要命——真实地址会顺着日志外泄）
    const addr = caseyRun(['selftest', '--tier2', '--sut', 'https://tier2-usage.invalid/secret-path']);
    const addrText = (addr.stdout || '') + (addr.stderr || '');
    assert(addr.status === 64, `非回环 --sut 应 exit 64，实得 ${addr.status}`);
    assert(!addrText.includes('tier2-usage.invalid'), `--sut 原值不得回显：${addrText.slice(-200)}`);
    assert(addrText.includes('TIER2_ARG_SUT_NOT_LOOPBACK'), '须出非回环稳定码');
  });

  // ── M2 绿尾行经管道不截断（真调壳层渲染器 + 合成全绿结果）──
  await check('T9e-M2 绿路径经管道捕获：尾行完整抵达且退出码 0', () => {
    const script = `
import { runTier2 } from '${join(ROOT, 'lib', 'selftest-tier2.mjs').replace(/\\/g, '/')}';
import { renderTier2Result } from '${join(ROOT, 'lib', 'selftest-tier2-collect.mjs').replace(/\\/g, '/')}';
const env = JSON.parse(process.argv[2]);
const result = runTier2(env);
if (result.exitCode !== 0) { process.stderr.write('env 非全绿：' + result.exitCode + '\\n'); process.exitCode = 9; }
const rendered = renderTier2Result({ result, consumerProblems: new Array(2000).fill('填充行（把 stdout 塞满，逼出截断）') });
import('node:fs').then(({ writeSync }) => {
  writeSync(1, rendered.text + '\\n');
  process.exitCode = result.exitCode;
});
`;
    const scriptFile = join(shellTmp, 'green-pipe.mjs');
    writeFileSync(scriptFile, script, 'utf8');
    const r = spawnSync(process.execPath, [scriptFile, JSON.stringify(tier2Env())], {
      cwd: ROOT, encoding: 'utf8', timeout: 60000, maxBuffer: 64 * 1024 * 1024,
    });
    assert(r.status === 0, `绿路径应 exit 0，实得 ${r.status}；stderr 尾：${(r.stderr || '').slice(-300)}`);
    const { TIER2_MACHINE_GREEN_TAIL } = pure();
    const out = r.stdout || '';
    assert(out.includes(TIER2_MACHINE_GREEN_TAIL), '尾行常量须完整抵达管道下游（不得被截断）');
    const nonEmpty = out.split('\n').filter((l) => l.trim().length);
    assert(nonEmpty[nonEmpty.length - 1] === TIER2_MACHINE_GREEN_TAIL,
      `尾行须是最后一行非空输出，实得：${JSON.stringify(nonEmpty[nonEmpty.length - 1] || '').slice(-160)}`);
  });

  // ── M3 连通结果：消费端严格校验 + 写失败非零退出 ──
  await check('T9f-M3 连通结果消费端：schema/artifactKind/segment/状态逐项严格', async () => {
    const { readWinProbeResult } = await import('../../lib/selftest-tier2-manifest.mjs');
    const rel = 'runs/_tier2_golden_probe/win-probe.result.json';
    const abs = join(ROOT, rel);
    mkdirSync(join(abs, '..'), { recursive: true });
    const manifestOf = () => ({ json: { winProbeResultPath: rel, outOfBandReceiptPath: 'runs/_tier2_golden_probe/receipt.json' } });
    // producedAt 取「此刻」：消费端另钉自陈时点须与落盘时刻自洽（见 T9f-M3 旧件作废钉）。
    const good = {
      schemaVersion: 1, artifactKind: 'tier2-connectivity-probe', segment: 'windows-to-target',
      ok: true, httpStatus: 200, probeMs: 12, producedAt: new Date().toISOString(),
    };
    try {
      writeFileSync(abs, JSON.stringify(good), 'utf8');
      assert(readWinProbeResult(manifestOf()).ok === true, '合格件应过');
      const bads = [
        ['schemaVersion 不符', { ...good, schemaVersion: 2 }],
        ['artifactKind 不符', { ...good, artifactKind: 'something-else' }],
        ['segment 不符（不是真实目标段）', { ...good, segment: 'wsl-to-tunnel' }],
        ['自陈不成功', { ...good, ok: false }],
        ['HTTP 状态非法', { ...good, httpStatus: 0 }],
        ['缺生成时点', { ...good, producedAt: undefined }],
      ];
      for (const [label, doc] of bads) {
        writeFileSync(abs, JSON.stringify(doc), 'utf8');
        const got = readWinProbeResult(manifestOf());
        assert(got.ok === false && got.problems.length > 0, `坏件应被拒：${label}`);
      }
      // 路径越界：manifest 指到 runs/ 外一律拒
      assert(readWinProbeResult({ json: { winProbeResultPath: '/etc/passwd' } }).ok === false, '越界路径应被拒');
    } finally {
      rmSync(join(ROOT, 'runs', '_tier2_golden_probe'), { recursive: true, force: true });
    }
  });

  // ★r2 M1 残口：用法错这条出口也必须过逐行凭据封印（形状安全但恰为真实敏感值的 caseId 不许回显）。
  await check('T9d-M1 用法错出口经逐行凭据封印', () => {
    const collectSrc = readFileSync(join(ROOT, 'lib', 'selftest-tier2-collect.mjs'), 'utf8');
    assert(/sealTier2Output\(refusalLines\.join/.test(collectSrc), '拒付回执须整体过 sealTier2Output 再出口');
    const caseySrc = readFileSync(CASEY, 'utf8');
    assert(/prepared\.refusalLines/.test(caseySrc), '壳层只转发已封印的回执行');
    // 封印后仍须保留稳定拒付码（封印不能把诊断一起烧光）
    const r = caseyRun(['selftest', '--tier2', '--sut', LOOPBACK, '--case', 'a/b']);
    const text = (r.stdout || '') + (r.stderr || '');
    assert(r.status === 64, `应 exit 64，实得 ${r.status}`);
    assert(text.includes('TIER2_ARG_CASE_ID_UNSAFE'), '封印后仍须出稳定拒付码');
    assert(!text.includes('a/b'), '原值不得回显');
  });

  // ★r2 M3 残口：新探针写失败时旧成功件必须作废；消费端另按「自陈时点 ↔ 落盘时刻」自洽绑定本次尝试。
  await check('T9f-M3 旧成功件作废 + 自陈时点与落盘时刻自洽', async () => {
    const src = readFileSync(join(ROOT, 'scripts', 'win-probe-target.mjs'), 'utf8');
    assert(/rmSync\(outPath, \{ force: true \}\)/.test(src),
      '写失败时须同时作废既有结果件（否则旧成功件仍在新鲜度窗内被消费）');
    const { readWinProbeResult } = await import('../../lib/selftest-tier2-manifest.mjs');
    const rel = 'runs/_tier2_golden_probe2/win-probe.result.json';
    const abs = join(ROOT, rel);
    mkdirSync(join(abs, '..'), { recursive: true });
    const manifestOf = () => ({ json: { winProbeResultPath: rel, outOfBandReceiptPath: 'runs/_tier2_golden_probe2/receipt.json' } });
    try {
      // 自陈「刚刚产出」且确实刚落盘 → 过
      writeFileSync(abs, JSON.stringify({
        schemaVersion: 1, artifactKind: 'tier2-connectivity-probe', segment: 'windows-to-target',
        ok: true, httpStatus: 200, probeMs: 9, producedAt: new Date().toISOString(),
      }), 'utf8');
      assert(readWinProbeResult(manifestOf()).ok === true, '刚落盘的合格件应过');
      // 自陈很久以前产出、却是刚落盘的件（旧件被复制回来冒充）→ 拒
      writeFileSync(abs, JSON.stringify({
        schemaVersion: 1, artifactKind: 'tier2-connectivity-probe', segment: 'windows-to-target',
        ok: true, httpStatus: 200, probeMs: 9, producedAt: '2026-07-01T00:00:00.000Z',
      }), 'utf8');
      const got = readWinProbeResult(manifestOf());
      assert(got.ok === false && got.problems.some((p) => p.includes('不自洽')),
        `自陈时点与落盘时刻不自洽须被拒：${JSON.stringify(got.problems)}`);
    } finally {
      rmSync(join(ROOT, 'runs', '_tier2_golden_probe2'), { recursive: true, force: true });
    }
  });

  // ★r3 M3：删旧件是尽力而为，「这份结果属不属于本次尝试」只能靠一次性挑战字绑定。
  await check('T9f-M3 本次探针尝试绑定：挑战字 nonce 不符即拒（删不掉旧件也拦得住）', async () => {
    const mod = await import('../../lib/selftest-tier2-manifest.mjs');
    const { ensureWinProbeChallenge, consumeWinProbeChallenge, readWinProbeResult } = mod;
    assert(typeof ensureWinProbeChallenge === 'function' && typeof consumeWinProbeChallenge === 'function',
      '缺挑战字发放/作废入口');
    const base = 'runs/_tier2_golden_probe3';
    const rel = `${base}/win-probe.result.json`;
    const abs = join(ROOT, rel);
    mkdirSync(join(abs, '..'), { recursive: true });
    const manifest = { json: { winProbeResultPath: rel, outOfBandReceiptPath: `${base}/receipt.json` } };
    const writeResult = (nonce) => writeFileSync(abs, JSON.stringify({
      schemaVersion: 1, artifactKind: 'tier2-connectivity-probe', segment: 'windows-to-target',
      ok: true, httpStatus: 200, probeMs: 7, challengeNonce: nonce, producedAt: new Date().toISOString(),
    }), 'utf8');
    try {
      const ch = ensureWinProbeChallenge(manifest);
      assert(ch.ok === true && /^[0-9a-f]{32}$/.test(ch.nonce), `挑战字须发出一次性 nonce：${JSON.stringify(ch)}`);
      // 旧件（无 nonce）→ 拒
      writeResult(undefined);
      let got = readWinProbeResult(manifest, ch);
      assert(got.ok === false && got.problems.some((p) => p.includes('未回填')), `无 nonce 的旧件须拒：${JSON.stringify(got.problems)}`);
      // 上一次尝试的 nonce → 拒
      writeResult('0'.repeat(32));
      got = readWinProbeResult(manifest, ch);
      assert(got.ok === false && got.problems.some((p) => p.includes('不符')), `nonce 不符须拒：${JSON.stringify(got.problems)}`);
      // 本次 nonce → 过
      writeResult(ch.nonce);
      got = readWinProbeResult(manifest, ch);
      assert(got.ok === true, `本次 nonce 的结果应过：${JSON.stringify(got.problems)}`);
      // 用过即作废：同一份结果不得被第二次 run 复用（新 run 拿到新 nonce）
      assert(consumeWinProbeChallenge(manifest) === true, '挑战字须可标作废');
      const next = ensureWinProbeChallenge(manifest);
      assert(next.ok === true && next.nonce !== ch.nonce, '作废后须轮换出新 nonce');
      assert(readWinProbeResult(manifest, next).ok === false, '旧结果件在新 nonce 下必须失效');
    } finally {
      rmSync(join(ROOT, base), { recursive: true, force: true });
    }
  });

  await check('T9f-M3 win-probe 结果文件：原子写 + 写失败必非零退出（源形态钉）', () => {
    // 本钉不真跑该脚本的网络请求（它读 site.json 打真实目标，零 SUT 金牌绝不碰）——
    // 只钉「原子写 + 写失败非零」的源形态；真跑负控在实现侧以回环夹具站点单独实测（见交接账）。
    const src = readFileSync(join(ROOT, 'scripts', 'win-probe-target.mjs'), 'utf8');
    assert(/renameSync\(/.test(src), '结果文件须原子写（临时件 + rename）');
    assert(/function finish\(/.test(src) && /finish\(true, wrote\)/.test(src),
      '连通成功但结果文件未落成时不得沿用连通退出码（须经 finish 判 wrote）');
    assert(!/res\.on\('end', \(\) => process\.exit\(0\)\)/.test(src), '不得无条件 exit 0（旧成功件会被继续当证据）');
    assert(/artifactKind: 'tier2-connectivity-probe'/.test(src) && /segment: 'windows-to-target'/.test(src),
      '结果文件须自带 artifactKind 与 segment（消费端据此严格校验）');
    // ★r3 M3：探针须支持 --challenge 并把 nonce 回填进结果（删旧件失败时的权威作废手段）
    assert(/--challenge/.test(src) && /challengeNonce/.test(src),
      '探针须支持 --challenge 并回填 challengeNonce');
    assert(/挑战字绑定作废/.test(src), '删除旧件失败时须如实说明改由挑战字绑定作废（不许假称已作废）');
  });
} finally {
  rmSync(shellTmp, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`\n${TAG}: ${passed} passed, ${failures.length} failed`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`\n${TAG}: ${passed} passed, 0 failed`);
