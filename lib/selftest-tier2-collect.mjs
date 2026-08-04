// lib/selftest-tier2-collect.mjs —— casey selftest --tier2 真机冒烟自检【编排壳】
//   （GRILL D3 + plan §1.2；联审 r1 逐条收口后拆模块：manifest/scan/judge-smoke/projection 各自成件）。
// 本层只做「采集 + 编排 + 渲染」，一个判据都不自造：
//   ① 读人签用例集 manifest（零动态发现，闭合校验在 selftest-tier2-manifest.mjs）；
//   ② 严格解析用参（拒付码与脱敏回显在 selftest-tier2-args.mjs）；
//   ③ 采前置门探针（doctor 导出探针 + 两段连通 + 带外回执，消费端严格校验形状）；
//   ④ 跑覆盖矩阵第三面：裁判通道运行时冒烟（selftest-tier2-judge-smoke.mjs），并落持久证据；
//   ⑤ 逐例走生产 run 同链（排他 run 目录 + 核过的执行件精确路径），落 receipt；
//   ⑥ 把结构化结果喂纯层 runTier2，渲染文本过出口密封，退出码由调用方自然返回。
import { mkdirSync, writeFileSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import http from 'node:http';
import https from 'node:https';
import { join, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';
import { PROJECT_ROOT, NODE_EXE } from './paths.mjs';
import { collectDoctorEnv } from './doctor-probes.mjs';
import {
  TIER2_SCAN_STAGES, judgeTier2Readiness, judgeTier2ScanTimeline,
  screenTier2CaseAuthorization, runTier2, parseTier2Args, formatTier2ArgErrors,
} from './selftest-tier2.mjs';
import {
  MANIFEST_REL, readSuiteManifest, verifyMemberExecutionFiles,
  readWinProbeResult, readOutOfBandReceipt,
  ensureWinProbeChallenge, consumeWinProbeChallenge,
} from './selftest-tier2-manifest.mjs';
import { createScanRecorder, scanTextForSensitive, sealTier2Output } from './selftest-tier2-scan.mjs';
import { screenTier2ReplayGrant } from './entity-created-workflow-replay-grant.mjs';
import { collectTier2JudgeSmoke } from './selftest-tier2-judge-smoke.mjs';
import { createExclusiveRunDir, projectRunArtifacts, classifyTier2Receipt } from './selftest-tier2-projection.mjs';
import { createP9Tier2BatchContext } from './p9-tier2-final-batch.mjs';

const CASEY_BIN = join(PROJECT_ROOT, 'bin', 'casey.mjs');
const DEFAULT_FRESHNESS_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEFAULT_CASE_TIMEOUT_MS = 600000;

// 系统性故障具名拒付码白名单（plan §1.3）：replay 前置闸的稳定拒付码
//   （lib/execution-target/cli-boundary.mjs 的 REASONS 全集）+ 凭据/登录两道具名前置闸文案。
// 码名一律避开禁字段关键词表——这批码要写进 receipt，带禁词会被落盘前复扫判命中、该例零证据落盘。
const SYSTEMIC_REFUSAL_MARKERS = Object.freeze([
  Object.freeze({ code: 'RUNTIME_UNSUPPORTED', marker: 'RUNTIME_UNSUPPORTED' }),
  Object.freeze({ code: 'LOGICAL_TARGET_INVALID', marker: 'LOGICAL_TARGET_INVALID' }),
  Object.freeze({ code: 'LOGICAL_TARGET_REQUIRED', marker: 'LOGICAL_TARGET_REQUIRED' }),
  Object.freeze({ code: 'TRANSPORT_MODE_INVALID', marker: 'TRANSPORT_MODE_INVALID' }),
  Object.freeze({ code: 'TRANSPORT_ENDPOINT_REQUIRED', marker: 'TRANSPORT_ENDPOINT_REQUIRED' }),
  Object.freeze({ code: 'TARGET_TRANSPORT_MODE_MISMATCH', marker: 'TARGET_TRANSPORT_MODE_MISMATCH' }),
  Object.freeze({ code: 'ORIGIN_CONTINUITY_UNAVAILABLE', marker: 'ORIGIN_CONTINUITY_UNAVAILABLE' }),
  Object.freeze({ code: 'EXECUTION_TARGET_AUTHORITY_INVALID', marker: 'EXECUTION_TARGET_AUTHORITY_INVALID' }),
  Object.freeze({ code: 'BROWSER_LAUNCH_FAILED', marker: 'BROWSER_LAUNCH_FAILED' }),
  Object.freeze({ code: 'NAVIGATION_FAILED', marker: 'NAVIGATION_FAILED' }),
  Object.freeze({ code: 'NAVIGATION_ORIGIN_MISMATCH', marker: 'NAVIGATION_ORIGIN_MISMATCH' }),
  Object.freeze({ code: 'LOGIN_PREP_FAILED', marker: '登录预备动作前置失败' }),
  Object.freeze({ code: 'AUDIENCE_CONTEXT_GATE', marker: '准入受众与凭据上下文不符' }),
]);

export function classifySystemicRefusal(text) {
  const raw = String(text == null ? '' : text);
  for (const { code, marker } of SYSTEMIC_REFUSAL_MARKERS) {
    if (raw.includes(marker)) return code;
  }
  return null;
}

// WSL 回环 → 隧道段：壳层自采结构化结果（只记状态码与耗时，地址不入结果）。
export function probeLoopbackTunnelSegment(sutBase, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const producedAt = new Date().toISOString();
    let url;
    try { url = new URL(sutBase); } catch { resolve({ present: false, ok: false, producedAt, httpStatus: null }); return; }
    const client = url.protocol === 'https:' ? https : http;
    const t0 = Date.now();
    const req = client.get(url, (res) => {
      res.resume();
      resolve({
        present: true,
        ok: Number.isInteger(res.statusCode) && res.statusCode >= 100 && res.statusCode <= 599,
        httpStatus: res.statusCode,
        probeMs: Date.now() - t0,
        producedAt,
      });
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve({ present: true, ok: false, httpStatus: null, probeMs: Date.now() - t0, producedAt }); });
    req.on('error', () => resolve({ present: true, ok: false, httpStatus: null, probeMs: Date.now() - t0, producedAt }));
  });
}

// 退出码归一图例：从本 CLI 现役 help 的图例行取（单一事实源；图例漂移即证据红）。
function collectExitCodeLegend() {
  const r = spawnSync(NODE_EXE, [CASEY_BIN, '--help'], { cwd: PROJECT_ROOT, encoding: 'utf8', timeout: 30000 });
  const line = String(r.stdout || '').split('\n').find((l) => l.startsWith('退出码：')) || '';
  return [...line.matchAll(/(\d+)/g)].map((m) => Number(m[1]));
}

// 原子写 + 落盘前复扫（命中即零证据落盘；写失败也算未落盘，绝不留半件）。
export function writeEvidenceAtomically(absPath, text, recorder) {
  if (recorder) {
    recorder.scan(text, 'pre_write');
    recorder.complete('pre_write');
  }
  const snapshot = recorder ? recorder.snapshot()
    : { stages: [...TIER2_SCAN_STAGES], hits: scanTextForSensitive(text, 'pre_write') };
  const timeline = judgeTier2ScanTimeline(snapshot);
  if (!timeline.emitEvidence) return { written: false, snapshot };
  const tmp = `${absPath}.tmp-${process.pid}-${randomBytes(3).toString('hex')}`;
  try {
    mkdirSync(dirname(absPath), { recursive: true });
    writeFileSync(tmp, text, 'utf8');
    renameSync(tmp, absPath);
  } catch {
    try { rmSync(tmp, { force: true }); } catch { /* 尽力 */ }
    return { written: false, snapshot };
  }
  // 落盘核验（联审 r2 H5 残口）：不信返回值、回读字节比对——盘满/被挤掉/写了半截都在这里现形。
  try {
    if (readFileSync(absPath, 'utf8') !== text) return { written: false, snapshot };
  } catch { return { written: false, snapshot }; }
  return { written: true, snapshot };
}

function baseReceipt({ caseId, member, authorizedMutation, cls, ran, runDirRel, extra = {}, refusalReason = null }) {
  return {
    schemaVersion: 1,
    artifactKind: 'tier2-run-receipt',
    caseId,
    class: cls,
    ran,
    runDir: runDirRel,
    effect: member.effect,
    loginBootstrap: true,
    // 字段名避开禁字段关键词表（自家账不许被自家扫描判命中）。
    approval: {
      smokeAuthorized: member.smokeAuthorized === true,
      perRunApproved: authorizedMutation === true,
      source: 'signed-suite-manifest',
    },
    ...(refusalReason ? { refusalReason } : {}),
    ...extra,
    generatedAt: new Date().toISOString(),
  };
}

// ── 单例执行（走生产 run 同链，不自建第二条编排）─────────────────
export function runOneCase({ member, sut, exitCodeLegend, authorizedMutation, batchContext = null }) {
  const caseId = member.caseId;
  const recorder = createScanRecorder();
  // spawn 前重核执行件（H3 ⑤）：核过才跑，并把精确路径显式交给生产 run（不靠约定解析兜底）。
  const files = verifyMemberExecutionFiles(member);
  const caseContext = batchContext?.cleanup?.[caseId] || null;
  const v3FilesReady = !caseContext || [
    'created-workflow-authority.frozen.json',
    'flow.confirmed.json',
    'compile-provenance.json',
  ].every((name) => typeof files.paths?.[name] === 'string');
  const dir = files.ok && v3FilesReady ? createExclusiveRunDir(caseId) : null;
  if (!files.ok || !v3FilesReady || !dir) {
    const receipt = baseReceipt({
      caseId, member, authorizedMutation, cls: 'stage_failed', ran: true,
      runDirRel: dir ? dir.runDirRel : null,
      extra: { preflightProblems: !files.ok
        ? files.problems
        : (!v3FilesReady ? ['created-workflow v3 执行件不齐'] : ['排他 run 目录创建失败']) },
    });
    return { receipt, projection: null, receiptWritten: false, scan: { stages: [], hits: [] } };
  }

  const timeoutMs = Number.isInteger(member.timeoutMs) && member.timeoutMs > 0 ? member.timeoutMs : DEFAULT_CASE_TIMEOUT_MS;
  const args = ['run', caseId, '--sut', sut, '--run-dir', dir.runDirAbs, '--login-bootstrap',
    '--events', files.paths['events.json'],
    '--expected', files.paths['expected.frozen.json'],
    '--profile', files.paths['profile.json'],
    '--case-meta', files.paths['testcase.json'],
  ];
  if (files.paths['entity-locks.frozen.json']) args.push('--entity-locks', files.paths['entity-locks.frozen.json']);
  if (caseContext) {
    args.push(
      '--created-workflow-authority', files.paths['created-workflow-authority.frozen.json'],
      '--flow', files.paths['flow.confirmed.json'],
      '--compile-provenance', files.paths['compile-provenance.json'],
      '--batch-token', caseContext.batchToken,
      '--unique-name', caseContext.uniqueNameToken,
    );
  } else if (typeof member.uniqueNameToken === 'string' && member.uniqueNameToken) {
    args.push('--unique-name', member.uniqueNameToken);
  }

  const startedAtMs = Date.now();
  const child = spawnSync(NODE_EXE, [CASEY_BIN, ...args], {
    cwd: PROJECT_ROOT, encoding: 'utf8', timeout: timeoutMs, killSignal: 'SIGKILL',
  });
  const durationMs = Date.now() - startedAtMs;
  // 原始字节先扫（H4）：子进程两路输出；stderr 命中单列具名规则。
  recorder.scan(child.stdout, 'raw_bytes');
  recorder.scan(child.stderr, 'raw_bytes', { rule: 'child-stderr-sensitive' });
  const timedOut = child.error && (child.error.code === 'ETIMEDOUT' || /timed?\s*out/i.test(String(child.error.message || '')));
  const systemicCode = classifySystemicRefusal(String(child.stdout || '') + String(child.stderr || ''));
  const childExitCode = Number.isInteger(child.status) ? child.status : null;

  // 原始产物逐件按字节扫 → 解析 → 白名单投影（阶段记账由 recorder 出，不硬写常量）。
  const projected = projectRunArtifacts({
    caseId, runDirRel: dir.runDirRel, runDirAbs: dir.runDirAbs, exitCodeLegend,
    expectedAbs: files.paths['expected.frozen.json'], recorder, startedAtMs,
  });
  const classified = classifyTier2Receipt({ projected, timedOut, systemicCode, childExitCode, exitCodeLegend });

  const receipt = baseReceipt({
    caseId, member, authorizedMutation, cls: classified.receiptClass, ran: true, runDirRel: dir.runDirRel,
    extra: {
      childExitCode,
      childExitInLegend: Number.isInteger(childExitCode) && exitCodeLegend.includes(childExitCode),
      durationMs,
      timedOut: !!timedOut,
      systemicRefusalCode: systemicCode,
      attachments: projected.attachments,
      staleArtifacts: projected.staleArtifacts,
      verdictStateCounts: projected.stateCounts,
      classificationProblems: classified.problems,
      ...(caseContext ? {
        batchId: caseContext.batchId,
        batchToken: caseContext.batchToken,
        uniqueNameToken: caseContext.uniqueNameToken,
        derivedEntityName: caseContext.derivedEntityName,
        cleanupSatisfied: projected.projection.createdWorkflowCleanup?.cleanupSatisfied === true
          && projected.projection.createdWorkflowCleanup?.reportProjected === true,
      } : {}),
    },
  });
  const written = writeEvidenceAtomically(join(dir.runDirAbs, 'tier2-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`, recorder);
  const projection = projected.projection;
  projection.credentialScan = written.snapshot;
  return { receipt, projection, receiptWritten: written.written, scan: written.snapshot };
}

export function writeRefusalReceipt({ member, refusalReason, authorizedMutation }) {
  const dir = createExclusiveRunDir(member.caseId);
  const receipt = baseReceipt({
    caseId: member.caseId, member, authorizedMutation, cls: 'refused_unauthorized', ran: false,
    runDirRel: dir ? dir.runDirRel : null, refusalReason,
  });
  let written = false;
  if (dir) {
    const recorder = createScanRecorder();
    recorder.complete('raw_bytes');   // 拒跑无子进程、无产物：原始字节面为空即算真跑完
    recorder.complete('projection');  // 该例未进管线，无投影可做
    written = writeEvidenceAtomically(join(dir.runDirAbs, 'tier2-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`, recorder).written;
  }
  return { receipt, receiptWritten: written };
}

// 第三面持久证据（H1：不止判一下，要留在盘上可复核）。
export function persistJudgeSmokeEvidence(judgeSmoke) {
  const dirRel = `runs/_tier2/judge-smoke_${new Date().toISOString().replace(/[-:]/g, '').replace(/\./g, '')}_${randomBytes(3).toString('hex')}`;
  const doc = {
    schemaVersion: 1,
    artifactKind: 'tier2-judge-channel-smoke',
    generatedAt: new Date().toISOString(),
    ran: judgeSmoke.ran,
    fixtureChecksumOk: judgeSmoke.fixtureChecksumOk,
    fixtureDigest: judgeSmoke.fixtureDigest || null,
    statesProduced: judgeSmoke.statesProduced,
    cases: judgeSmoke.cases,
    precedents: judgeSmoke.precedents,
    problems: judgeSmoke.problems,
  };
  const recorder = createScanRecorder();
  recorder.complete('raw_bytes');   // 反例集字节在采集期已按字节读过并核 hash
  recorder.complete('projection');  // 本证据本体即白名单结构
  const written = writeEvidenceAtomically(join(PROJECT_ROOT, dirRel, 'tier2-judge-smoke.json'), `${JSON.stringify(doc, null, 2)}\n`, recorder);
  return { path: written.written ? `${dirRel}/tier2-judge-smoke.json` : null, written: written.written };
}

// ── 两段式入口：prepare（纯解析 + manifest，用法错在采集前判定）→ execute ──
export function prepareTier2(argv) {
  const manifest = readSuiteManifest();
  const parsed = parseTier2Args(argv, {
    memberIds: manifest.memberIds,
    memberEffects: manifest.memberEffects,
    caseLimit: manifest.caseLimit,
  });
  let refusalLines = [];
  if (!parsed.ok) {
    // 回显纪律（M1）：只列通过安全形状校验的 caseId（依给定次序），其余一律只出码与脱敏类别。
    if (parsed.requestedCases.length) refusalLines.push(`--case 依给定次序：${parsed.requestedCases.join(', ')}`);
    refusalLines.push(...formatTier2ArgErrors(parsed.errors));
    refusalLines.push(`用例集来源：${MANIFEST_REL}（人签，零动态发现；${manifest.present ? `可用成员 ${manifest.memberCount}` : '当前不在场'}）`);
    // 用法错这条出口也必须过逐行凭据封印（联审 r2 M1 残口）：
    //   形状安全的 caseId 若恰与真实敏感字面量同值，照样不许回显——封印按来源判，不看形状。
    refusalLines = sealTier2Output(refusalLines.join('\n'), 'tier2-usage-refusal').text.split('\n');
  }
  return { ok: parsed.ok, parsed, manifest, refusalLines };
}

// 回放票据拒跑闸（p9-replay-authority-split，评审 M-new3：采集层强制接线）。
// 执法闸在 bin/replay.mjs 浏览器前门，本闸是它的前置——**两者都做，不是二选一**：
// 只靠 replay 拒，三条变更型会各起一次子进程才被拦，既浪费又让拒跑回执缺位。
// 本函数只出判定与拒跑清单；spawn 与回执落盘由 executeTier2 按它的结果执行。
export function screenTier2CaseReplayGrant({ members, grantRead } = {}) {
  const list = Array.isArray(members) ? members : [];
  const refusals = [];
  for (const member of list) {
    const screen = screenTier2ReplayGrant({ member, grantRead });
    if (!screen.ran) {
      refusals.push({
        caseId: member?.caseId,
        refusalReason: screen.refusalReason,
        receiptRequired: screen.receiptRequired === true,
      });
    }
  }
  return {
    spawnAllowed: refusals.length === 0,
    refusals,
    screenedCount: list.length,
  };
}

export function buildTier2CleanupObligations({ batchContext, cases, selectedCaseIds } = {}) {
  if (!batchContext?.ok || !batchContext.cleanup) return null;
  const selected = Array.isArray(selectedCaseIds) ? selectedCaseIds : [];
  const cleanupIds = Object.keys(batchContext.cleanup);
  if (!cleanupIds.every((caseId) => selected.includes(caseId))) return null;
  const receipts = (Array.isArray(cases) ? cases : [])
    .filter((entry) => batchContext.cleanup[entry.caseId])
    .map((entry) => {
      const counts = entry.projection?.verdict?.stateCounts || {};
      const verdict = (counts.HARNESS_ERROR || 0) > 0
        ? 'HARNESS_ERROR'
        : ((counts.SUT_DEFECT || 0) > 0
          ? 'SUT_DEFECT'
          : ((counts.NEEDS_HUMAN || 0) > 0 ? 'NEEDS_HUMAN' : 'PASS'));
      return {
        caseId: entry.caseId,
        batchId: entry.receipt?.batchId,
        batchToken: entry.receipt?.batchToken,
        uniqueNameToken: entry.receipt?.uniqueNameToken,
        derivedEntityName: entry.receipt?.derivedEntityName,
        receiptClass: entry.receipt?.class,
        verdict,
        cleanupSatisfied: entry.receipt?.cleanupSatisfied === true,
      };
    });
  return {
    batchId: batchContext.batchId,
    batchToken: batchContext.batchToken,
    mutationCaseIds: cleanupIds,
    receipts,
    priorBatchTokens: [],
  };
}

export async function executeTier2({ parsed, manifest }) {
  const now = new Date().toISOString();
  const freshnessWindowMs = Number.isInteger(manifest.json?.connectivityFreshnessWindowMs)
    ? manifest.json.connectivityFreshnessWindowMs : DEFAULT_FRESHNESS_WINDOW_MS;
  const { site, env: doctorEnv } = await collectDoctorEnv();
  // 本次探针尝试的一次性挑战字（联审 r3 M3）：结果件须回填同一 nonce 才算本次尝试的证据。
  const challenge = ensureWinProbeChallenge(manifest);
  const winTarget = readWinProbeResult(manifest, challenge);
  const outOfBand = readOutOfBandReceipt(manifest);
  const probes = {
    node: doctorEnv.node,
    playwright: doctorEnv.playwright,
    chromium: doctorEnv.chromium,
    creds: doctorEnv.creds,
    // 壳层对每例恒透传登录引导（GRILL D4：production 受众锁无登录必被凭据上下文门拒）。
    loginBootstrap: { requestedForEveryCase: true },
    executionTarget: {
      resolved: site.present === true && doctorEnv.executionTarget?.ready === true,
      mode: doctorEnv.executionTarget?.transportMode || null,
    },
    tunnel: { proxyPort: doctorEnv.tunnel.proxyPort, portListening: doctorEnv.tunnel.portListening },
    suiteManifest: {
      present: manifest.present, checksumOk: manifest.checksumOk, signed: manifest.signed,
      memberCount: manifest.memberCount, caseLimit: manifest.caseLimit,
    },
    outOfBandReceipt: outOfBand,
    connectivity: { winTarget, wslTunnel: await probeLoopbackTunnelSegment(parsed.sut) },
  };
  const consumerProblems = [
    ...manifest.problems, ...(winTarget.problems || []), ...(outOfBand.problems || []),
    ...(challenge.problems || []),
    ...(challenge.ok && winTarget.ok !== true
      ? [`本次探针挑战字已发（${challenge.path}）：请在 Windows 侧带 --challenge 重跑连通探针后再跑 tier-2`]
      : []),
  ];

  // 覆盖矩阵第三面（裁判通道运行时冒烟）：零 SUT 接触，先跑先留证；红则纯层按空覆盖判 exit 2。
  // 证据落盘结果回灌进第三面（联审 r2 H1 残口）：写不下去=没证据，第三面必红。
  const collected = collectTier2JudgeSmoke(manifest);
  const judgeEvidence = persistJudgeSmokeEvidence(collected);
  const judgeSmoke = { ...collected, evidencePersisted: judgeEvidence.written === true, evidencePath: judgeEvidence.path };

  const readiness = judgeTier2Readiness({ now, freshnessWindowMs, probes });
  const envBase = { now, freshnessWindowMs, probes, judgeSmoke };
  // fail-closed：前置门任一红 → 一例不跑（子进程从未启动）。
  if (!readiness.ok) return { result: runTier2({ ...envBase, cases: [] }), consumerProblems, judgeEvidence };
  // 前置门过了才作废挑战字：同一份连通结果绝不给第二次 tier-2 run 复用（一次性绑定）。
  consumeWinProbeChallenge(manifest);

  const selected = parsed.requestedCases.length
    ? manifest.members.filter((m) => parsed.requestedCases.includes(m.caseId))
    : manifest.members;
  const exitCodeLegend = collectExitCodeLegend();
  const batchStamp = new Date().toISOString().replace(/[-:.TZ]/g, '').toLowerCase();
  const batchToken = `p9-${batchStamp}-${randomBytes(4).toString('hex')}`;
  const batchBuilt = createP9Tier2BatchContext({
    batchId: `tier2-${batchToken}`,
    batchToken,
    memberIds: manifest.members.map((member) => member.caseId),
  });
  const batchContext = batchBuilt.ok ? batchBuilt : null;
  const cases = [];
  for (const member of selected) {
    const authorizedMutation = parsed.authorizedMutations.includes(member.caseId);
    const entry = {
      caseId: member.caseId,
      effect: member.effect,
      smokeAuthorized: member.smokeAuthorized === true,
      authorizedMutation,
    };
    const screen = screenTier2CaseAuthorization(entry);
    if (!screen.ran) {
      // 拒跑：绝不启动子进程，但 receipt 照落（授权缺失原因在册）。
      const refusal = writeRefusalReceipt({ member, refusalReason: screen.refusalReason, authorizedMutation });
      entry.receipt = refusal.receipt;
      entry.receiptPersisted = refusal.receiptWritten;
      entry.projection = null;
      cases.push(entry);
      continue;
    }
    const outcome = runOneCase({
      member,
      sut: parsed.sut,
      exitCodeLegend,
      authorizedMutation,
      batchContext,
    });
    entry.receipt = outcome.receipt;
    // receipt 落盘核验结果进聚合（联审 r2 H5 残口：此前返回了却没人看）。
    entry.receiptPersisted = outcome.receiptWritten;
    entry.projection = outcome.projection;
    cases.push(entry);
    if (outcome.receipt.class === 'systemic_abort') break; // 系统性故障立即停全集
  }
  const cleanupObligations = buildTier2CleanupObligations({
    batchContext,
    cases,
    selectedCaseIds: selected.map((member) => member.caseId),
  });
  return {
    result: runTier2({
      ...envBase,
      cases,
      ...(cleanupObligations ? { cleanupObligations } : {}),
    }),
    consumerProblems,
    judgeEvidence,
  };
}

// ── 渲染（M2：只出文本、不碰退出码；调用方设 process.exitCode 自然返回，防管道截断）──
export function renderTier2Result({ result, consumerProblems = [], judgeEvidence = null }) {
  const lines = [];
  for (const it of result.readiness) {
    lines.push(`${it.status === 'ok' ? 'ok  ' : 'RED '} [${it.id}] ${it.detail}${it.hint ? '  → ' + it.hint : ''}`);
  }
  for (const it of (result.judgeSmoke ? result.judgeSmoke.items : [])) {
    lines.push(`${it.status === 'ok' ? 'ok  ' : 'RED '} [${it.id}] ${it.detail}`);
  }
  for (const p of consumerProblems) lines.push(`  用例集/证据件：${p}`);
  for (const cr of result.caseResults) {
    const label = cr.ran ? (cr.machineRed ? 'RED ' : 'ok  ') : 'skip';
    const why = cr.ran ? '' : `（${(cr.receipt && cr.receipt.refusalReason) || '拒跑'}）`;
    lines.push(`${label} [${cr.caseId}] 落账 ${cr.receiptClass}${why}`);
  }
  // 证据落盘状态分三态：跑了例且允许落 / 跑了例但扫描命中零落盘 / 一例未跑（无用例证据可落）。
  const evidenceNote = result.caseResults.length === 0
    ? '无用例证据（一例未跑）'
    : (result.evidenceEmitted ? '允许' : '零落盘（fail-closed）');
  lines.push(`覆盖矩阵：取证面 ${result.coverage.forensics ? '非空' : '空'} / 流式面 ${result.coverage.streaming ? '非空' : '空'} / SUT_DEFECT 面 ${result.coverage.sutDefect ? '成立' : '未成立'}；用例证据落盘 ${evidenceNote}`);
  if (judgeEvidence && judgeEvidence.path) lines.push(`裁判通道冒烟证据：${judgeEvidence.path}`);
  for (const r of result.reasons || []) lines.push(`  ${r}`);
  if (result.exitCode === 0 && result.tailLine) lines.push('', result.tailLine);
  const sealed = sealTier2Output(lines.join('\n'));
  return { text: sealed.text, sealed: sealed.ok };
}
