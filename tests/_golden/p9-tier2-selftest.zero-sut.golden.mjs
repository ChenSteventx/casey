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
//   · TIER2_MACHINE_GREEN_TAIL exit 0 尾行常量（「机器面绿≠完成」）
//   · judgeTier2RunEvidence(projection) 单 run 产物投影 → 逐项判定
//   · judgeTier2ScanTimeline({ stages, hits }) 扫描时序 + 命中 → 是否允许证据落盘
//   · runTier2(env) 纯层聚合 → { exitCode, readiness, caseResults, coverage, tailLine, ... }
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

import { readFileSync, existsSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
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
  proj,
} = {}) {
  return {
    caseId,
    effect,
    smokeAuthorized,
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

// 默认全绿环境：一条只读例（取证面）+ 一条流式例（流式面），覆盖矩阵非空。
function tier2Env(overrides = {}) {
  return {
    now: NOW,
    freshnessWindowMs: DAY_MS,
    probes: readyProbes(),
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
  for (const name of ['judgeTier2RunEvidence', 'judgeTier2ScanTimeline', 'runTier2']) {
    assert(typeof api[name] === 'function', `缺 frozen API ${name}`);
  }
  for (const name of ['TIER2_READINESS_IDS', 'TIER2_EVIDENCE_IDS', 'TIER2_RECEIPT_CLASSES', 'TIER2_SCAN_STAGES']) {
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

  const SMOKE = [
    ['SUT_DEFECT 到达口①（动作做成 + 硬断言失败 + 本步归因 5xx）', frozen('sut_defect'), 'SUT_DEFECT', null],
    ['SUT_DEFECT 到达口②（动作未做成 + 本步归因信封失败）', arrivalTwo, 'SUT_DEFECT', null],
    ['错步归因：背景 401 归别步 → 不翻本步', frozen('background_401_not_attributed'), 'PASS', null],
    ['错步归因：5xx 归别步 → 不冒充缺陷', misattributed, 'NEEDS_HUMAN', 'SUT_DEFECT_OR_STALE'],
    ['catch-all：无漂移信号无取证 → fail-safe', frozen('indeterminate'), 'NEEDS_HUMAN', 'INDETERMINATE'],
    ['多匹配 → 不记缺陷', frozen('ambiguous_action'), 'NEEDS_HUMAN', 'AMBIGUOUS_ACTION'],
    ['正向漂移确证 → 可自愈', frozen('harness_error'), 'HARNESS_ERROR', null],
    ['全过 → PASS', frozen('pass'), 'PASS', null],
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
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`\n${TAG}: ${passed} passed, ${failures.length} failed`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`\n${TAG}: ${passed} passed, 0 failed`);
