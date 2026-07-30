// P6 heal 验收金牌共享夹具工厂（零 SUT、零浏览器、零网络）。
//
// 纪律：不倒着裁到预定裁定。四件套里只有 events / 三轴 / run-history 是本模块合成的，
// verdict.json 一律由真 `bin/verdict.mjs`（零 LLM 裁判）在合成三轴上跑出来——夹具只负责
// 摆出「能让现役判定树自然落到该裁定」的证据，绝不手写 verdict 字节。三轴本身也由现役
// 生产投影 `lib/replay-axes.mjs::projectReplayAxes` 产出，run-history 由现役生产投影
// `lib/replay/history.mjs::replayHistoryLine` 产出——形状与真产物同源，不另造副本。
//
// 形状对照的真产物（读过、逐字段对齐）：
//   runs/tc_wf_publish_states/run_uat_publish_20260722_092351/{axes.json,verdict.json,run-history.jsonl}
//   cases/tc_wf_publish_states/{events.json,entity-locks.frozen.json,expected.frozen.json}
//
// 词表事实（lib/drift-probe.mjs 单一事实源）：探针词表当前只含 `workflow.deleteByName`；
// 其规范签名 = `role=<role>|name=<name>|withinRow=<targetName>`。词表外原子一律不产正向漂移证据。

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectReplayAxes } from '../../../lib/replay-axes.mjs';
import { replayHistoryLine } from '../../../lib/replay/history.mjs';
import { canonicalSignature } from '../../../lib/drift-probe.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const CASEY_CLI = join(ROOT, 'bin', 'casey.mjs');
export const VERDICT_CLI = join(ROOT, 'bin', 'verdict.mjs');
export const NODE_EXE = process.execPath;

// 词表内原子（唯一）与其目标行名——与 drift-patch.fixture 的 canonical 同族。
export const VOCAB_ATOM = 'workflow.deleteByName';
export const OUT_OF_VOCAB_ATOM = 'workflow.publish';
export const TARGET_NAME = 'atl_wf_p6heal';
export const DELETE_LABEL = '删除';
export const BASE_TS = Date.parse('2026-07-28T00:00:00.000Z');

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
export const sha256File = (p) => sha256(readFileSync(p));

// ── 单步声明 ────────────────────────────────────────────────────────────────
// kind: 'pass' | 'harness-error' | 'sut-defect' | 'needs-human'
// fallbackCss:true → events 定位额外携 run-history 未投影的字段（D12 收窄面的负控件）
function eventOf(step) {
  const atom = step.atom || VOCAB_ATOM;
  const targetName = step.targetName || TARGET_NAME;
  const ev = {
    stepId: step.stepId,
    intentId: step.intentId,
    atom,
    action: 'click',
    semantic: { kind: 'role', role: 'button', name: step.label || DELETE_LABEL, exact: true },
    targetName,
    value: targetName,
  };
  if (step.fallbackCss) {
    // 现役 run-history 投影只吐 role/accessibleName，fallbackCss 落不进投影面——
    // 「仅 fallbackCss 不同」的混件内容互证分辨不了，故 D12 把这类定位划进拒付面。
    ev.fallbackCss = `.hr-table-row:has-text("${targetName}") .hr-action-delete`;
  }
  return ev;
}

// 动作轴：只摆证据，不下裁定（裁定由 bin/verdict.mjs 出）。
function actionOf(step) {
  if (step.kind === 'harness-error') {
    const atom = step.atom || VOCAB_ATOM;
    const targetName = step.targetName || TARGET_NAME;
    const canonical = canonicalSignature(atom, targetName); // 词表外原子 → null
    // claimPositiveProbe：伪造件面——三轴自报正向漂移，但原子不在探针词表内。
    // 现役 verdict.driftHolds 只看 sameSignatureUniquePresent，照样判 HARNESS_ERROR；
    // 准入门必须自己查词表 fail-closed（S1 拒因 DRIFT_VOCABULARY_UNSUPPORTED），
    // 否则「词表外原子」这条安全策略在 CLI 面上根本不生效。
    if (step.claimPositiveProbe) {
      return {
        resolution: 'none',
        candidateCount: 0,
        driftProbe: {
          sameSignatureUniquePresent: true,
          candidateCount: 1,
          matchedSignature: `role=button|name=${step.label || DELETE_LABEL}|withinRow=${targetName}`,
        },
      };
    }
    // blankMatchedSignature：正向布尔在、规范签名缺——verdict 仍判 HARNESS_ERROR，
    // 但 S1 要求 matchedSignature 非空 → HEAL_NO_POSITIVE_DRIFT_EVIDENCE。
    if (step.blankMatchedSignature) {
      return {
        resolution: 'none',
        candidateCount: 0,
        driftProbe: { sameSignatureUniquePresent: true, candidateCount: 1, matchedSignature: null },
      };
    }
    return {
      resolution: 'none',
      candidateCount: 0,
      driftProbe: canonical
        ? { sameSignatureUniquePresent: true, candidateCount: 1, matchedSignature: canonical }
        // 词表外原子：探针给不出正向证据（findEquivalentAffordance 的零命中形状）。
        : { sameSignatureUniquePresent: false, candidateCount: 0, matchedSignature: null },
    };
  }
  return { resolution: 'unique', candidateCount: 1, identityReadback: { ok: true } };
}

// 归因到本步的网络记录：只有 sut-defect 步带坏信封 + 5xx（取证背书 → SUT_DEFECT）。
function recordsOf(step) {
  if (step.kind !== 'sut-defect') return [];
  return [{
    url: '/heren/aimanagement/process/delete',
    status: 500,
    ts: 165007.5,
    initiator: 'script',
    attributedStepId: step.stepId,
    firingStepId: step.stepId,
    errorEnvelope: { ok: false },
  }];
}

// 期望断言：needs-human 步挂一条证不出的硬断言（无采集 → ok:false、无取证背书 → INDETERMINATE 侧）。
function expectedOf(step) {
  if (step.kind !== 'needs-human') return [];
  return [{ kind: 'textVisible', op: 'present', value: '删除成功' }];
}

const GLOBAL_ASSERTIONS = [
  { kind: 'noPageError', op: 'absent' },
  { kind: 'noErrorEnvelope', op: 'envelopeOk' },
];

/**
 * 用现役生产投影合成三轴文本 + events 对象 + run-history 文本。
 * steps: [{ stepId, intentId, kind, atom?, targetName?, label?, fallbackCss? }]
 */
export function buildArtifacts({ caseId, steps }) {
  const events = steps.map(eventOf);
  const intentOrder = steps.map((s) => s.intentId);
  const intentEvents = new Map();
  const reprStepOf = new Map();
  const actionByStep = new Map();
  const expectedByIntent = new Map();
  const intentUrl = new Map();
  const emptyMap = () => new Map(steps.map((s) => [s.intentId, undefined]));
  let records = [];

  steps.forEach((step, i) => {
    intentEvents.set(step.intentId, [events[i]]);
    reprStepOf.set(step.intentId, step.stepId);
    actionByStep.set(step.stepId, actionOf(step));
    expectedByIntent.set(step.intentId, expectedOf(step));
    intentUrl.set(step.intentId, '/heren/aimanagement/process/list');
    records = records.concat(recordsOf(step));
  });

  const axesText = projectReplayAxes({
    caseId,
    records,
    intentOrder,
    intentEvents,
    reprStepOf,
    actionByStep,
    pageErrors: [],
    intentCount: new Map(steps.map((s) => [s.intentId, {}])),
    expectedByIntent,
    globalAssertions: GLOBAL_ASSERTIONS,
    intentUrl,
    intentToasts: emptyMap(),
    intentTextHits: emptyMap(),
    intentButtonHits: emptyMap(),
    intentButtonSeen: emptyMap(),
    intentButtonDisabledHits: emptyMap(),
    intentReply: emptyMap(),
    intentInputReadback: emptyMap(),
    chatCfg: null,
    allStepIds: new Set(steps.map((s) => s.stepId)),
  });

  const historyText = steps.map((step, i) => {
    const line = replayHistoryLine(events[i], {
      navOk: true,
      navErr: null,
      axis: actionByStep.get(step.stepId),
      durationMs: 700 + i,
      caseId,
      isLast: i === steps.length - 1,
      settled: true,
    });
    // 时钟去随机化：金牌只认字节与退出码，时间戳必须确定。
    line.timestamp = new Date(BASE_TS + i * 1000).toISOString();
    return JSON.stringify(line);
  }).join('\n') + '\n';

  const eventsDoc = {
    schemaVersion: 1,
    channel: 'web',
    caseId,
    url: '{{baseUrl}}/heren/aimanagement/process/list',
    recordedAt: '2026-07-28T00:00:00+08:00',
    compiledBy: 'p6-heal-fixture',
    authored: true,
    events,
  };

  return {
    events: eventsDoc,
    eventsText: JSON.stringify(eventsDoc, null, 2) + '\n',
    axesText,
    axes: JSON.parse(axesText),
    historyText,
  };
}

/** 真裁判出 verdict：绝不手写裁定字节（护栏 #15，裁判零 LLM 且零改）。 */
export function runRealVerdict(axesPath, verdictPath) {
  const r = spawnSync(NODE_EXE, [VERDICT_CLI, '--axes', axesPath, '--out', verdictPath], {
    cwd: ROOT, encoding: 'utf8',
  });
  if ((r.status ?? 1) !== 0) {
    throw new Error(`夹具自检失败：真 verdict 未能在合成三轴上出裁定（exit=${r.status}）${r.stderr}`);
  }
  return JSON.parse(readFileSync(verdictPath, 'utf8'));
}

/**
 * 落盘四件套到 <dir>：events.json / axes.json / run-history.jsonl / verdict.json。
 * 返回各件绝对路径 + 真裁判产出的 verdict 对象。
 */
export function writeQuad(dir, { caseId, steps }) {
  mkdirSync(dir, { recursive: true });
  const built = buildArtifacts({ caseId, steps });
  const paths = {
    dir,
    events: join(dir, 'events.json'),
    axes: join(dir, 'axes.json'),
    history: join(dir, 'run-history.jsonl'),
    verdictPath: join(dir, 'verdict.json'),
  };
  writeFileSync(paths.events, built.eventsText, 'utf8');
  writeFileSync(paths.axes, built.axesText, 'utf8');
  writeFileSync(paths.history, built.historyText, 'utf8');
  const verdict = runRealVerdict(paths.axes, paths.verdictPath);
  return { ...paths, verdict, built };
}

// ── 场景（步集）────────────────────────────────────────────────────────────
const S = (stepId, intentId, kind, extra = {}) => ({ stepId, intentId, kind, ...extra });

export const SCENARIOS = {
  // 确证 HARNESS_ERROR：首步绿 + 一步 resolution none + 正向探针三元组 + 纯语义定位。
  confirmedHarnessError: [
    S('atstep_0', 'intent_0', 'pass', { label: DELETE_LABEL }),
    S('atstep_1', 'intent_1', 'harness-error'),
  ],
  // 复核链专用（A3c）：目标步与非目标步的可访问名刻意不同，
  // 好让假运行时剧本能只掐掉「非目标步」，制造非目标步回归。
  reverifyChain: [
    S('atstep_0', 'intent_0', 'pass', { label: '确定' }),
    S('atstep_1', 'intent_1', 'harness-error'),
  ],
  // 全绿干净案（A8）。
  allGreen: [
    S('atstep_0', 'intent_0', 'pass'),
    S('atstep_1', 'intent_1', 'pass'),
  ],
  // 逐步全拒案（A1）：SUT_DEFECT 与 NEEDS_HUMAN 各一，零 HARNESS_ERROR。
  defectAndHuman: [
    S('atstep_0', 'intent_0', 'sut-defect'),
    S('atstep_1', 'intent_1', 'needs-human'),
  ],
  // 定位含未投影字段 fallbackCss 的确证 HE 步（A6 负控一）。
  fallbackCssLocated: [
    S('atstep_0', 'intent_0', 'pass'),
    S('atstep_1', 'intent_1', 'harness-error', { fallbackCss: true }),
  ],
  // 词表外原子的自然 miss 步：探针零命中，裁定自然落 NEEDS_HUMAN 侧（连 HARNESS_ERROR 都不是）。
  outOfVocabulary: [
    S('atstep_0', 'intent_0', 'pass'),
    S('atstep_1', 'intent_1', 'harness-error', { atom: OUT_OF_VOCAB_ATOM, label: '发布' }),
  ],
  // 词表外原子 + 自报正向探针（A6 负控三）：verdict 判 HARNESS_ERROR，准入门须以词表拒。
  outOfVocabularyClaimed: [
    S('atstep_0', 'intent_0', 'pass'),
    S('atstep_1', 'intent_1', 'harness-error', { atom: OUT_OF_VOCAB_ATOM, label: '发布', claimPositiveProbe: true }),
  ],
  // 证据残缺（A6）：正向布尔在但规范签名空——S1 要求 matchedSignature 非空。
  blankSignature: [
    S('atstep_0', 'intent_0', 'pass'),
    S('atstep_1', 'intent_1', 'harness-error', { blankMatchedSignature: true }),
  ],
  // A/B 混件对（A6 负控二）：两侧都是纯语义定位，但步集不同 → 血缘互证必失配。
  pairA: [
    S('atstep_0', 'intent_0', 'pass'),
    S('atstep_1', 'intent_1', 'harness-error'),
  ],
  pairB: [
    S('atstep_0', 'intent_0', 'pass'),
    S('atstep_1', 'intent_1', 'harness-error'),
    S('atstep_2', 'intent_2', 'harness-error', { targetName: 'atl_wf_p6heal_b' }),
  ],
  // 三个不同步骤各一轮空转（A5 熔断可达路径，D8 case 级计量）。
  threeHarnessErrorSteps: [
    S('atstep_0', 'intent_0', 'pass'),
    S('atstep_1', 'intent_1', 'harness-error'),
    S('atstep_2', 'intent_2', 'harness-error', { targetName: 'atl_wf_p6heal_2' }),
    S('atstep_3', 'intent_3', 'harness-error', { targetName: 'atl_wf_p6heal_3' }),
  ],
};

// ── 冻结绑定件（受晋升影响的「重签件」面）──────────────────────────────────
// 形状照抄 cases/tc_wf_publish_states/entity-locks.frozen.json：eventsSha256 把冻结锁钉在
// 某一份 events 字节上——events 一旦被重锚改写，该锁即失效，必须人重签（新 eventsSha256）。
export function entityLocksFrozen({ caseId, steps, eventsSha256, signedAt = '2026-07-28T00:00:00.000Z' }) {
  return {
    schemaVersion: 1,
    artifactKind: 'entity-locks-frozen',
    caseId,
    signed: true,
    replayReady: true,
    signerId: 'Steven',
    signedAt,
    audience: 'production',
    eventsSha256: `sha256:${eventsSha256}`,
    bindings: steps.map((s) => ({
      stepId: s.stepId,
      intentId: s.intentId,
      atom: s.atom || VOCAB_ATOM,
      role: 'subject',
      candidateId: 'candidate-p6heal-s1',
      lockId: 'lock-p6heal-main',
      receiptHash: `sha256:${sha256(Buffer.from(`${caseId}:${s.stepId}`))}`,
    })),
    signature: `sha256:${sha256(Buffer.from(`${caseId}:${eventsSha256}`))}`,
  };
}

export function expectedFrozen({ caseId, steps }) {
  return {
    caseId,
    intents: steps.map((s) => ({
      intentId: s.intentId,
      expected: s.kind === 'needs-human'
        ? [{ kind: 'textVisible', op: 'present', value: '删除成功', signedAt: '2026-07-28T00:00:00.000Z', signedAgainstBuild: '1.1.2', signerId: 'Steven' }]
        : [],
    })),
    globalAssertions: GLOBAL_ASSERTIONS.map((a) => ({ ...a, signedAt: '2026-07-28T00:00:00.000Z', signedAgainstBuild: '1.1.2', signerId: 'Steven' })),
  };
}

// D3 v3 schema 的复位证明件：{caseId, resetPlanDigest, sutBuildDigest, signerId, signedAt, statement}。
export function resetProof({ caseId, signerId = 'Steven' }) {
  return {
    caseId,
    resetPlanDigest: `sha256:${sha256(Buffer.from(`${caseId}:reset-plan`))}`,
    sutBuildDigest: `sha256:${sha256(Buffer.from(`${caseId}:sut-build`))}`,
    signerId,
    signedAt: '2026-07-28T00:00:00.000Z',
    statement: '本用例已证明可复位/幂等，整案重放安全。',
  };
}

// ── 目录字节快照（「无任何文件被替换」类断言的取证基座）────────────────────
export function snapshotTree(root) {
  const out = new Map();
  const walk = (dir) => {
    let entries = [];
    // 缺失目录静默跳过：快照面允许「此刻还没有这个目录」。
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else out.set(p, sha256File(p));
    }
  };
  walk(root);
  return out;
}

/** 两份快照的差异：新增/删除/字节变更三类具名列出。 */
export function diffSnapshots(before, after) {
  const added = [...after.keys()].filter((k) => !before.has(k));
  const removed = [...before.keys()].filter((k) => !after.has(k));
  const changed = [...after.keys()].filter((k) => before.has(k) && before.get(k) !== after.get(k));
  return { added, removed, changed };
}

// ── spawn 真 CLI ───────────────────────────────────────────────────────────
/**
 * 跑 `node bin/casey.mjs heal ...`。只认退出码与产物字节；stdout 末行按 plan §3.5 是单行 JSON。
 * env 注入：AT_CASES_DIR（case 产物根，现役 lib/paths.mjs 既有隔离面）、
 *           LOOP_KIT_ROOT（loop 机制根，隔离 breaker 状态与 inbox，现役 loop-kit/lib/root.mjs 既有面）。
 */
export function runHeal(args, { casesDir, loopKitRoot, seam, seamScenario, cwd = ROOT } = {}) {
  const env = { ...process.env };
  if (casesDir) env.AT_CASES_DIR = casesDir;
  if (loopKitRoot) env.LOOP_KIT_ROOT = loopKitRoot;
  if (seam) env.CASEY_HEAL_RUNTIME_SEAM = seam;
  if (seamScenario) env.CASEY_HEAL_SEAM_SCENARIO = seamScenario;
  const r = spawnSync(NODE_EXE, [CASEY_CLI, 'heal', ...args], { cwd, encoding: 'utf8', env });
  return {
    code: r.status ?? 1,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    all: (r.stdout || '') + (r.stderr || ''),
  };
}

/** stdout 末行结构化 JSON（plan §3.5）。解析不出返回 null——由调用方判红。 */
export function lastJson(res) {
  const lines = String(res.stdout || '').split('\n').map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const v = JSON.parse(lines[i]);
      if (v && typeof v === 'object' && !Array.isArray(v)) return v;
    } catch { /* 非 JSON 行继续上溯 */ }
    break; // 只认「末行」，不在更早的行里捡漏
  }
  return null;
}

/** 结构化输出里是否具名提到某拒因/字面量（只在末行 JSON 内查，不在自由散文里捞）。 */
export function jsonMentions(res, literal) {
  const j = lastJson(res);
  return j != null && JSON.stringify(j).includes(literal);
}

// ── 迷你金牌骨架 ───────────────────────────────────────────────────────────
export function makeRunner(label, cleanup) {
  const failures = [];
  let passed = 0;
  // 异步友好：调用方一律 `await test(...)`，同步用例照跑不误。
  const test = async (name, fn) => {
    try { await fn(); passed += 1; console.log(`ok   ${name}`); }
    catch (e) { failures.push(`${name}: ${String(e?.message || e)}`); console.error(`FAIL ${name}: ${String(e?.message || e)}`); }
  };
  // 清理必须在 process.exit 之前跑：exit 立即终止，finally 不会执行。
  const finish = () => {
    try { if (typeof cleanup === 'function') cleanup(); } catch { /* 清理失败不改判定 */ }
    if (failures.length) {
      console.error(`RED  ${label}: ${failures.length} 项未过（实现前预期红）`);
      process.exit(1);
    }
    console.log(`ok   ${label}: ${passed} 项全过`);
    process.exit(0);
  };
  return { test, finish, assert: (c, m) => { if (!c) throw new Error(m); } };
}

/** 各金牌自建的一次性临时目录（跑完清理，绝不落进仓内既有产物目录）。 */
export function scratchDir(tag) {
  const rand = createHash('sha256').update(`${tag}:${process.pid}:${Date.now()}:${Math.random()}`)
    .digest('hex').slice(0, 8);
  const dir = join(ROOT, 'tests', '_golden', `.p6heal-scratch-${rand}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** 隔离用的 loop 根：带根标记 loop/config.json + 空 inbox，绝不碰仓内真 breaker 状态。 */
export function makeLoopRoot(scratch) {
  const root = join(scratch, 'loop-root');
  mkdirSync(join(root, 'loop'), { recursive: true });
  const cfg = JSON.parse(readFileSync(join(ROOT, 'loop', 'config.json'), 'utf8'));
  writeFileSync(join(root, 'loop', 'config.json'), JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  writeFileSync(join(root, 'loop', 'inbox.md'), '# inbox（金牌隔离副本）\n', 'utf8');
  return { root, inbox: join(root, 'loop', 'inbox.md'), state: join(root, 'loop', '.breaker-state.json') };
}
