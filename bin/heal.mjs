#!/usr/bin/env node
/**
 * bin/heal.mjs —— 相5 自愈 CLI（零 LLM、非就地、有界）。
 *
 * 命令形（plan §3.5 已冻硬接缝，四模式通用 --out-dir/--ts）：
 *   casey heal <caseId> --verdict <f> --axes <f> --events <f> [--run-history <f>]
 *                       [--step <id>] --out-dir <d> [--ts <token>]        提案（S1-S3）
 *   casey heal <caseId> --apply    --patch <f>     --out-dir <d> [--ts <t>]   候选式应用（S4）
 *   casey heal <caseId> --promote  --candidate <f> --out-dir <d> [--ts <t>]   日志式事务晋升（S5）
 *   casey heal <caseId> --reverify --receipt <f>   --out-dir <d> [--ts <t>]   真链路复核（S6）
 *
 * 退出码（GRILL D7 冻结唯一枚举 + D13 增补，单一来源）：
 *   0  命令成功，stdout 末行 outcome ∈ {proposal-written, applied-candidate, promoted,
 *      reverified, reverify-routed-human, reverify-failed-rolled-back}（无 no-op 值）
 *   1  未预期内部错误（D13 增补；与全仓图例「1 = 失败/红」一致，catch-all 不漏未定义码）
 *   2  熔断跳闸（S7）——同一 caseId 连续 3 个**完整** heal 周期无终局 receipt；跳闸后本 case
 *      一切 heal 子命令一律 2，直至人工删除轮账 cases/<caseId>/.heal-breaker.json 复位。
 *      熔断轮账破损、轮账不变量被破坏、轮账锁拿不到、记账路径任何异常**一律**落 2
 *      （fail-closed：证不出「还没到 3 轮」就不许继续自愈；绝不漏进 catch-all 的 1）。
 *   4  准入全拒——「无一步可自愈」的唯一编码（含干净全 PASS 案 NO_HARNESS_ERROR_STEPS、
 *      逐步具名拒因清单、HEAL_REANCHOR_NOOP、HEAL_FLAKY_ESCALATED）
 *   6  晋升阻断（重签缺失 / 候选 sha256 失配 / 未封 journal 残留）
 *   64 用法错误   65 输入畸形（含晋升面「基线绑定不可证」，与复核端同拒因同码位，D14 ②补）
 *   3  整相尚未完成（casey 图例既有含义；零参调用 = 问「相5 现状」，S7 熔断未接线故仍 3）
 *
 * stdout 末行恒为单行 JSON `{mode, outcome, reason, …}`；一切人读信息走 stderr，
 * 绝不污染末行（金牌只认末行结构化 JSON）。
 *
 * 已落地：S1 准入门 → S2 确定性重锚 → S3 补丁与证据元组台账 → S4 候选式应用 →
 *   S5 日志式对称事务晋升 → S6 真 replay→真 verdict 复核编排（含对称回滚）→
 *   S7 case 级熔断轮账（lib/heal/breaker.mjs）。
 * 仍未完成的是**整相**：真机两不变量与真机 healed→PASS 实例按 plan §3 观测性申报走
 *   route:human，故零参出口仍诚实报 exit 3，绝不把 hermetic 全绿当整相完成。
 */
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { PROJECT_ROOT, casePaths, isSafeCaseId } from '../lib/paths.mjs';
import { HEAL_REJECT, admitForProposal } from '../lib/heal/admission.mjs';
import { proposeReanchor } from '../lib/heal/reanchor.mjs';
import {
  HealLedgerError, LEDGER_REJECT, commitProposal, driftDirOf, scanUnsealedJournalsAnchored,
} from '../lib/heal/drift-patch.mjs';
import { HealApplyError, applySignedPatch } from '../lib/heal/apply.mjs';
import { HealPromoteError, promoteCandidate } from '../lib/heal/promote.mjs';
import { HealReverifyError, runReverify } from '../lib/heal/reverify.mjs';
import {
  BREAKER_REJECT, HealBreakerError, breakerStatus, recordHealCycle,
} from '../lib/heal/breaker.mjs';

const EXIT = {
  OK: 0, INTERNAL: 1, BREAKER: 2, NOT_IMPL: 3, NO_HEALABLE_STEP: 4,
  PROMOTE_BLOCKED: 6, USAGE: 64, MALFORMED: 65,
};
/** JS Date 可表示区间（±8.64e15 毫秒）；越界的 --ts 落 64（D13 增补）。 */
const MAX_EPOCH_MS = 8640000000000000;

const USAGE = `用法（相5 自愈；四模式通用 --out-dir/--ts，--ts 须为可表示日期的 epoch 毫秒）：
  casey heal <caseId> --verdict <f> --axes <f> --events <f> [--run-history <f>] [--step <id>] --out-dir <d> [--ts <epochMs>]
  casey heal <caseId> --apply    --patch <已签补丁>   --out-dir <d> [--ts <epochMs>]
  casey heal <caseId> --promote  --candidate <候选>   [--patch <已签补丁>] --out-dir <d> [--ts <epochMs>]
  casey heal <caseId> --reverify --receipt <收据>     --out-dir <d> [--ts <epochMs>]
    · --promote 的 --patch 可省：省时由候选/台账关联出已签补丁做绑定链闭合校验。
    · --reverify 在 v1 仅 hermetic：须设 CASEY_HEAL_RUNTIME_SEAM 指向本仓 tests/ 下的运行时
      接缝；无接缝或接缝越界一律 exit 64，真机复核 route:human（GRILL D13 ②）。
退出码：0 成功 / 1 内部错误 / 2 熔断 / 3 该模式未实现 / 4 无一步可自愈 / 6 晋升阻断 / 64 用法 / 65 输入畸形`;

function parseArgs(argv) {
  const opts = {}; const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq >= 0) opts[a.slice(2, eq)] = a.slice(eq + 1);
      else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) opts[a.slice(2)] = argv[++i];
      else opts[a.slice(2)] = true;
    } else pos.push(a);
  }
  return { opts, pos };
}

const note = (s) => process.stderr.write(`${s}\n`);

/** stdout 末行：单行结构化 JSON（plan §3.5 三键形，附加键只作证据不作契约）。 */
function emit(mode, outcome, reason, extra = {}) {
  process.stdout.write(`${JSON.stringify({ mode, outcome, reason, ...extra })}\n`);
}

function fail(code, mode, reason, detail, extra = {}) {
  if (detail) note(`[heal] ${reason}：${detail}`);
  emit(mode, null, reason, extra);
  process.exit(code);
}

/** 用法错：不出结构化 outcome 语义（这是没进业务面的错），仍给末行 JSON 便于机读。 */
function usageError(detail) {
  note(`[heal] 用参错误：${detail}`);
  note(USAGE);
  emit('usage', null, 'HEAL_USAGE_ERROR', { detail });
  process.exit(EXIT.USAGE);
}

const strOpt = (opts, k) => (typeof opts[k] === 'string' && opts[k].length > 0 ? opts[k] : null);
const strOf = (v) => (typeof v === 'string' && v.length > 0 ? v : null);
const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

/**
 * 晋升收据自记的 stepId（熔断幂等键的第二段兜底来源）。
 * 只在复核已跑成后调用——此刻 runReverify 已校验过该字段非空，这里只是取同一事实，
 * 不做第二套校验；取不到一律回 null，由熔断面按「幂等键不可靠」fail-closed 拒记。
 */
function promotedStepIdOf(receiptPath) {
  try {
    return strOf(JSON.parse(readFileSync(receiptPath, 'utf8')).stepId);
  } catch {
    return null;
  }
}

/** 读 JSON 件：缺件/不可读/非法 JSON 一律输入畸形（D7：65），内容绝不回显。 */
function readJsonOrExit(path, label, mode) {
  if (!existsSync(path)) {
    fail(EXIT.MALFORMED, mode, HEAL_REJECT.INPUT_INVALID, `${label} 不在场：${path}`);
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    fail(EXIT.MALFORMED, mode, HEAL_REJECT.INPUT_INVALID, `${label} 不是合法 JSON（内容不回显）：${path}`);
  }
  return null;
}

/** 读 run-history（JSONL）：坏行同样 fail-closed 落畸形面。 */
function readHistoryOrExit(path, mode) {
  if (!path) return null;
  if (!existsSync(path)) {
    fail(EXIT.MALFORMED, mode, HEAL_REJECT.INPUT_INVALID, `run-history 不在场：${path}`);
  }
  const lines = [];
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const t = raw.trim();
    if (!t) continue;
    try { lines.push(JSON.parse(t)); } catch {
      fail(EXIT.MALFORMED, mode, HEAL_REJECT.INPUT_INVALID, `run-history 含非法行（内容不回显）：${path}`);
    }
  }
  return lines;
}

/**
 * 未封 journal 在场 → 一切 heal 子命令 fail-closed（GRILL D5，exit 6）。
 * D13 codex 8：扫描**双锚**——调用方 out-dir 的 drift + 由 caseId 派生的 case 根事务指针目录，
 * 后者是调用方参数动不了的，换 --out-dir 绕不开残留事务。
 */
function guardUnsealedJournal(outDir, caseId, mode) {
  const stale = scanUnsealedJournalsAnchored({
    driftDir: driftDirOf(outDir),
    caseDir: casePaths(caseId).dir,
  });
  if (stale.length) {
    fail(EXIT.PROMOTE_BLOCKED, mode, LEDGER_REJECT.UNSEALED_JOURNAL,
      `发现未封晋升 journal（含回滚中断）：${stale.join(', ')}；须人工处置后方可继续`,
      { journals: stale });
  }
}

/**
 * 熔断前置闸（S7 / GRILL D8）：本 case 一旦跳闸，**一切** heal 子命令一律 exit 2，
 * 直至人工删除轮账复位。轮账破损同样落 2（fail-closed：证不出「还没到 3 轮」就不许继续）。
 */
function guardBreaker(caseId, mode) {
  let st;
  try {
    st = breakerStatus({ caseDir: casePaths(caseId).dir, caseId });
  } catch (e) {
    if (e instanceof HealBreakerError) fail(EXIT.BREAKER, mode, e.reason, e.detail, { caseId });
    throw e;
  }
  if (!st.tripped) return;
  fail(EXIT.BREAKER, mode, BREAKER_REJECT.TRIPPED,
    `本 case 已跳闸（连续 ${st.trip.rounds} 个完整 heal 周期无终局 receipt，空转步 `
    + `${(st.trip.steps || []).join('/')}）；复位姿势 = 人工核查后删除轮账 ${st.statePath}`,
    { caseId, rounds: st.trip.rounds, breakerState: st.statePath, inbox: st.trip.inbox || [] });
}

/** loop 机制根的 inbox（升级留痕的第二落点）；不在场则只写 drift 内 inbox 旁文件。 */
function loopInboxPath() {
  const root = process.env.LOOP_KIT_ROOT ? resolve(process.env.LOOP_KIT_ROOT) : PROJECT_ROOT;
  const p = join(root, 'loop', 'inbox.md');
  return existsSync(p) ? p : null;
}

// ── 提案模式（S1+S2+S3 主链）────────────────────────────────────────────────
function runPropose(caseId, opts) {
  const mode = 'propose';
  const verdictPath = strOpt(opts, 'verdict');
  const axesPath = strOpt(opts, 'axes');
  const eventsPath = strOpt(opts, 'events');
  const outDir = strOpt(opts, 'out-dir');
  const historyPath = strOpt(opts, 'run-history');
  const stepId = opts.step === undefined ? null : strOpt(opts, 'step');
  if (!verdictPath || !axesPath || !eventsPath) usageError('提案模式必填 --verdict / --axes / --events');
  if (opts.step !== undefined && !stepId) usageError('--step 缺值');

  const verdict = readJsonOrExit(verdictPath, 'verdict', mode);
  const axes = readJsonOrExit(axesPath, 'axes', mode);
  const events = readJsonOrExit(eventsPath, 'events', mode);
  const historyLines = readHistoryOrExit(historyPath, mode);

  // 准入门（S1）：四条件 + D12 内容级互证 + 纯语义定位收窄。
  const admitted = admitForProposal({ caseId, verdict, axes, events, historyLines, stepId });
  if (!admitted.ok) {
    if (admitted.kind === 'malformed') {
      fail(EXIT.MALFORMED, mode, admitted.reason, admitted.detail);
    }
    if (admitted.kind === 'usage') usageError(admitted.detail);
    if (admitted.kind === 'case') {
      fail(EXIT.NO_HEALABLE_STEP, mode, admitted.reason, admitted.detail);
    }
    // 逐步全拒：exit 4 + 逐步具名拒因清单（D7 把干净全 PASS 案切成独立 reason）。
    note(`[heal] 无一步可自愈（${admitted.reason}）：`);
    for (const r of admitted.rejections) note(`  - ${r.stepId}：${r.reason}（${r.detail}）`);
    emit(mode, null, admitted.reason, { caseId, rejections: admitted.rejections });
    process.exit(EXIT.NO_HEALABLE_STEP);
  }

  // 重锚（S2）：零 LLM 确定性，写读同形。
  const target = admitted.target;
  const tsToken = strOpt(opts, 'ts') || String(Date.now());
  const proposal = proposeReanchor({
    target, verdictPath, eventsPath, eventsDoc: events, tsToken,
  });
  if (proposal.noop) {
    // D7：等价重锚归「无一步可自愈」语义，落 exit 4 + 具名 reason，绝不产 no-op outcome。
    fail(EXIT.NO_HEALABLE_STEP, mode, proposal.reason, proposal.detail, { caseId, stepId: target.stepId });
  }

  // 补丁 + 证据元组台账（S3）。
  const tuple = {
    verdictSha256: sha256File(verdictPath),
    axesSha256: sha256File(axesPath),
    eventsSha256: sha256File(eventsPath),
  };
  let committed;
  try {
    committed = commitProposal({
      driftDir: driftDirOf(outDir),
      caseId,
      stepId: target.stepId,
      tuple,
      tsToken,
      patch: proposal.patch,
      eventsPath,
      loopInboxPath: loopInboxPath(),
    });
  } catch (e) {
    if (e instanceof HealLedgerError) {
      // 台账锁陈旧/占用、非就地纪律被破坏：本轮无步可安全自愈 → 落 exit 4 具名拒因。
      // （D7 未逐字列举台账层故障码位；按其「4 = 无一步可自愈的唯一编码」自述语义归口，
      //  绝不新造码号，也绝不复用「未实现」的 3。此处如实挂账，见交付说明。）
      fail(EXIT.NO_HEALABLE_STEP, mode, e.reason, e.detail, { caseId, stepId: target.stepId });
    }
    throw e;
  }

  if (committed.outcome === 'escalated') {
    note(`[heal] 同一步第 2 个不同证据元组 → 判 flaky locator，拒新补丁并升级 inbox：${committed.inboxPath}`);
    emit(mode, null, committed.reason, {
      caseId, stepId: target.stepId, inbox: committed.inboxPath, ledger: committed.ledgerPath,
    });
    process.exit(EXIT.NO_HEALABLE_STEP);
  }

  const idempotent = committed.outcome === 'idempotent';
  note(idempotent
    ? `[heal] 同证据元组重调 → 幂等返回既有补丁：${committed.patchPath}`
    : `[heal] 重锚提案已落盘（原 events 字节一字未动）：${committed.patchPath}`);
  note(`[heal] 人签前不应用：补丁 status=proposed、humanSignoff=null；下一步 casey heal ${caseId} --apply --patch <已签补丁>（S4 未实现）`);
  emit(mode, 'proposal-written', null, {
    caseId,
    stepId: target.stepId,
    patch: committed.patchPath,
    ledger: committed.ledgerPath,
    idempotent,
  });
  process.exit(EXIT.OK);
}

// ── 应用模式（S4）：候选式，非就地 ──────────────────────────────────────────
function runApply(caseId, opts) {
  const mode = 'apply';
  const patchPath = strOpt(opts, 'patch');
  const outDir = strOpt(opts, 'out-dir');
  if (!patchPath) usageError('应用模式必填 --patch <已签补丁>');
  const patch = readJsonOrExit(patchPath, '补丁', mode);
  const tsToken = strOpt(opts, 'ts') || String(Date.now());
  let applied;
  try {
    applied = applySignedPatch({ outDir, caseId, patch, tsToken });
  } catch (e) {
    if (e instanceof HealApplyError) {
      // 未签/畸形 → 65（D7 补钉：未签补丁喂 --apply = 契约畸形输入）；等价重锚 → 4（无一步可自愈）。
      fail(e.kind === 'noop' ? EXIT.NO_HEALABLE_STEP : EXIT.MALFORMED, mode, e.reason, e.detail, { caseId });
    }
    throw e;
  }
  note(`[heal] 候选已产出（原 events 一字未动，非就地）：${applied.candidatePath}`);
  note(`[heal] 候选 sha256=${applied.candidateSha256}；下一步：人把 cases/${caseId}/entity-locks.frozen.json 的 eventsSha256 重签到该字节，再 --promote。`);
  emit(mode, 'applied-candidate', null, {
    caseId,
    stepId: applied.stepId,
    candidate: applied.candidatePath,
    candidateSha256: `sha256:${applied.candidateSha256}`,
    eventsSha256: `sha256:${applied.eventsSha256}`,
  });
  process.exit(EXIT.OK);
}

// ── 晋升模式（S5）：日志式对称事务 ──────────────────────────────────────────
function runPromote(caseId, opts) {
  const mode = 'promote';
  const candidatePath = strOpt(opts, 'candidate');
  const outDir = strOpt(opts, 'out-dir');
  if (!candidatePath) usageError('晋升模式必填 --candidate <候选 events>');
  const tsToken = strOpt(opts, 'ts') || String(Date.now());
  // D13 codex 5：已签补丁可显式同传；缺省则由候选/台账关联出来（绑定链闭合在 promote 内做）。
  const patchPathOpt = strOpt(opts, 'patch');
  let promoted;
  try {
    promoted = promoteCandidate({ outDir, caseId, candidatePath, tsToken, patchPathOpt });
  } catch (e) {
    if (e instanceof HealPromoteError) {
      // D14 ②补：基线绑定不可证是**输入畸形**面（65），与复核端同拒因同码位——「晋升前换基线」
      // 与「晋升后换基线」不因发生在哪一侧就换个码；晋升面其余拒因仍是 6（晋升阻断）。
      fail(e.kind === 'malformed' ? EXIT.MALFORMED : EXIT.PROMOTE_BLOCKED, mode, e.reason, e.detail, { caseId });
    }
    throw e;
  }
  note(`[heal] 五步事务晋升完成，journal 已封账：${promoted.journalPath}`);
  emit(mode, 'promoted', null, {
    caseId,
    stepId: promoted.stepId,
    journal: promoted.journalPath,
    receipt: promoted.receiptPath,
    eventsSha256Before: `sha256:${promoted.eventsSha256Before}`,
    eventsSha256After: `sha256:${promoted.eventsSha256After}`,
  });
  process.exit(EXIT.OK);
}

// ── 复核模式（S6）：真 replay → 真 verdict 链 ──────────────────────────────
async function runReverifyMode(caseId, opts) {
  const mode = 'reverify';
  const receiptPath = strOpt(opts, 'receipt');
  const outDir = strOpt(opts, 'out-dir');
  if (!receiptPath) usageError('复核模式必填 --receipt <HealReceipt>');
  const tsToken = strOpt(opts, 'ts') || String(Date.now());
  const seamPath = typeof process.env.CASEY_HEAL_RUNTIME_SEAM === 'string'
    && process.env.CASEY_HEAL_RUNTIME_SEAM.length > 0
    ? process.env.CASEY_HEAL_RUNTIME_SEAM : null;
  let result;
  try {
    result = await runReverify({ outDir, caseId, receiptPath, tsToken, seamPath });
  } catch (e) {
    if (e instanceof HealReverifyError) {
      // D13：hermetic 门禁两拒（无 seam / seam 越界）是**用法**错 → 64，不再混进畸形面 65。
      const code = e.kind === 'blocked' ? EXIT.PROMOTE_BLOCKED
        : e.kind === 'usage' ? EXIT.USAGE : EXIT.MALFORMED;
      fail(code, mode, e.reason, e.detail, { caseId });
    }
    throw e;
  }
  if (result.outcome === 'reverify-routed-human') {
    note('[heal] 未证明可复位/幂等（缺签署 reset-proof.json）→ route:human；本轮不跑复核、不产合成裁定。');
  } else if (result.outcome === 'reverify-failed-rolled-back') {
    note('[heal] 复核未达标准 → 已按 journal 对称回滚（events + 绑定逐件恢复并逐件断言）。');
  } else {
    note('[heal] 复核通过：目标步转 PASS 且全案无非目标步新回归（裁定出自冻结裁判子进程）。');
  }

  // ── S7 熔断计量（GRILL D8 case 级）────────────────────────────────────────
  // 复核收口 = 一个**完整** heal 周期（提案→应用→晋升→复核）走完的唯一时刻，故轮账只在这里记。
  // 幂等键取「caseId | stepId | 本轮所凭的晋升收据字节哈希」三段：同一次晋升事务被重复复核
  // 绝不算两轮，也绝不第二次兑现进展（评审：防「route:human 一次后换 --ts 重放洗连击」）。
  // route:human 分支的 result 不带 targetStep，故 stepId 退回读晋升收据自记的那一个——
  // 那是 runReverify 已校验过非空的同一事实，三段因此恒非空。
  let stepId = null;
  let breaker;
  try {
    stepId = (result.targetStep && strOf(result.targetStep.stepId)) || promotedStepIdOf(receiptPath);
    const cycleKey = createHash('sha256')
      .update(`${caseId}|${stepId ?? ''}|${sha256File(receiptPath)}`).digest('hex');
    breaker = recordHealCycle({
      caseDir: casePaths(caseId).dir,
      caseId,
      stepId,
      tsToken,
      cycleKey,
      outcome: result.outcome,
      driftDir: driftDirOf(outDir),
      loopInboxPath: loopInboxPath(),
    });
  } catch (e) {
    // 记账路径的一切异常都落 2（熔断面 fail-closed），绝不漏成 catch-all 的 1：
    // 「记不上账」与「已跳闸」对下一轮自愈的含义相同——都不许继续。
    const reason = e instanceof HealBreakerError ? e.reason : BREAKER_REJECT.LEDGER_IO;
    const detail = e instanceof HealBreakerError ? e.detail
      : `熔断记账未完成（${(e && (e.code || e.name)) || 'Error'}；详情不回显）`;
    fail(EXIT.BREAKER, mode, reason, detail, { caseId });
  }
  if (breaker.escalationPending) {
    note('[heal] 熔断升级留痕未写成（跳闸态已落盘、不回滚）；须人工补录 inbox 升级行。');
  }
  if (breaker.tripped) {
    // 本轮的复核收据与回滚都已落定（取证绝不因跳闸而丢），只是命令以熔断码收场。
    note(`[heal] 熔断跳闸：同一 case 连续 ${breaker.idleRounds} 个完整 heal 周期无终局 receipt（自愈空转）。`);
    note(`[heal] 本 case 一切 heal 子命令即刻起 exit 2；复位姿势 = 人工核查后删除轮账 ${breaker.statePath}。`);
    emit(mode, null, BREAKER_REJECT.TRIPPED, {
      caseId,
      stepId,
      cycleOutcome: result.outcome,
      receipt: result.receiptPath,
      rounds: breaker.idleRounds,
      breakerState: breaker.statePath,
      inbox: breaker.inbox || [],
    });
    process.exit(EXIT.BREAKER);
  }

  emit(mode, result.outcome, result.reason ?? null, {
    caseId,
    stepId,
    receipt: result.receiptPath,
    ...(result.verdictPath ? { verdict: result.verdictPath } : {}),
    ...(result.route ? { route: result.route } : {}),
  });
  process.exit(EXIT.OK);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    // 零参调用 = 问「相5 现状如何」。S1–S7 机械全链已落地，但**整相**未完成：热路径缺口
    // （plan S0 已证伪，挂账后继契约）与真机两不变量/真机 healed→PASS 实例按 plan §3 观测性
    // 申报走 route:human，故仍诚实报 exit 3，绝不把 hermetic 全绿当整相完成。
    // （bin/casey.mjs 门面把 heal 转发到本文件后，此路径同时兑现已冻邻接金牌
    //  tests/_golden/cli-mcp-face.golden.mjs 对 `casey heal` 零参 exit 3 的钉；该金牌被
    //  loop/prd-mcp-parity.json 的 testChecksums 冻结，实现者只读——见交付说明的计划矛盾条。）
    note('[相5 heal 自愈] 已落地：提案主链 + 候选式应用 + 日志式对称事务晋升 + 真链路复核（含对称回滚）+ case 级熔断。');
    note('[相5 heal 自愈] 整相未完成：热路径缺口已挂账；真机两不变量与真机 healed→PASS 实例 route:human。');
    note(USAGE);
    emit('heal', null, 'HEAL_PHASE_PARTIALLY_IMPLEMENTED', {
      implemented: ['propose', 'apply', 'promote', 'reverify', 'breaker'],
      pending: ['hotpath-reachability', 'real-machine-uat'],
    });
    process.exit(EXIT.NOT_IMPL);
  }

  const { opts, pos } = parseArgs(argv);
  const caseId = pos[0];
  if (!caseId) usageError('缺 <caseId> 位置实参');
  if (!isSafeCaseId(caseId)) usageError('caseId 不安全：仅允许单段目录名，不得含 /、\\、.. 或绝对路径');

  const modes = ['apply', 'promote', 'reverify'].filter((m) => opts[m]);
  if (modes.length > 1) usageError(`--apply/--promote/--reverify 互斥，实得 ${modes.map((m) => `--${m}`).join(' ')}`);
  const mode = modes[0] || 'propose';

  const outDir = strOpt(opts, 'out-dir');
  if (!outDir) usageError('四模式通用必填 --out-dir <目录>');
  if (opts.ts !== undefined) {
    const ts = strOpt(opts, 'ts');
    if (!ts || !/^[0-9]+$/.test(ts)) usageError('--ts 须为 epoch 毫秒数字串（^[0-9]+$）');
    // D13 增补：还须是**可表示日期**——越界的 ts 会让全链的 at/recordedAt 变成 Invalid Date，
    // 那是用法错不是内部错，落 64（数字串合法但日期不可表示，两条判据分开报）。
    const ms = Number(ts);
    if (!Number.isFinite(ms) || Math.abs(ms) > MAX_EPOCH_MS || Number.isNaN(new Date(ms).getTime())) {
      usageError(`--ts=${ts} 不是可表示日期（epoch 毫秒须在 ±${MAX_EPOCH_MS} 内）`);
    }
  }

  // S7 fail-closed 前置闸：本 case 已跳闸时一切 heal 子命令一律拦（先于未封 journal 闸——
  // 熔断是「这条 case 的自愈整体停机」，比单笔事务残留更高一层）。
  guardBreaker(caseId, mode);
  // D5 fail-closed 前置闸：未封 journal 在场时一切 heal 子命令一律拦（含提案）。
  guardUnsealedJournal(outDir, caseId, mode);

  if (mode === 'propose') return runPropose(caseId, opts);
  if (mode === 'apply') return runApply(caseId, opts);
  if (mode === 'promote') return runPromote(caseId, opts);
  return runReverifyMode(caseId, opts);
}

main().catch((e) => {
  // 未预期异常一律 fail-closed：不回显异常原文（可携页面片段/路径，护栏 #7），只出稳定拒因。
  // D7（D13 增补）：catch-all 落 1 = 未预期内部错误，与全仓「1 = 失败/红」图例一致，不漏码。
  note(`[heal] 内部错误（详情不回显）：${e && e.name ? e.name : 'Error'}`);
  emit('heal', null, 'HEAL_INTERNAL_ERROR', {});
  process.exit(EXIT.INTERNAL);
});
