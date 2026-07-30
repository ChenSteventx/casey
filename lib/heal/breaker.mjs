// lib/heal/breaker.mjs —— S7 case 级熔断轮账（IO 层，零 LLM、零浏览器、零网络）。
//
// 语义单一事实源：GRILL D8 v4 + plan S7 逐字。
//   · 计量对象是 **case 级**：同一 caseId 的连续「完整 heal 周期」跨步骤累计；
//   · 一轮 = 一个**走完的**周期（提案 → 应用 → 晋升 → 复核四步走完）且**未落终局 receipt**。
//     纯提案调用**不计轮**——补丁产出后还在等人签，周期没走完（GRILL/评审裁读：纯提案轮
//     不构成 D8 的「完整周期」）；同证据的幂等重调同样不计轮；
//   · 进展只认**终局 receipt**：healed→PASS（outcome=`reverified`）或 route:human
//     （outcome=`reverify-routed-human`）。`reverify-failed-rolled-back` 不是进展——D8 逐字
//     只列了那两种终局，回滚把字节退回原地，什么也没往前推——故它正是「空转一轮」的判据；
//   · 连续 3 轮空转 → 跳闸：exit 2（D7 码表：2 = 熔断跳闸）+ inbox 升级行；跳闸后同 case
//     一切 heal 子命令一律 exit 2，直至**人工复位**。
//
// 复位姿势（唯一）：人工核查后删掉本旁账文件 `cases/<caseId>/.heal-breaker.json`。
//   不提供 `--reset` 子命令——自动复位等于把熔断变成摆设（同晋升锁「绝不自动抢锁」的取舍）。
//
// 与 loop-kit breaker 的关系（诚实注明，不虚标复用）：`loop-kit/bin/breaker.mjs` 记的是
//   **loop 迭代级**全局账——键是「整棵 loop」而不是 caseId、进展判据是 git HEAD 有无新
//   commit、状态单件 `loop/.breaker-state.json`、且须先 `--reset` 开账才认 `--round`。
//   D8 要的是 **case 级、以终局 receipt 为进展判据**的计量：键、进展判据、开账方式三处都不同，
//   薄接会把 heal 的空转记进 loop 的迭代账、污染护栏 #3 的现役语义。故本模块在 heal 内自落
//   case 级轮账，只复用 loop-kit 既有的**升级落点**（LOOP_KIT_ROOT 解析出的 loop/inbox.md）
//   与**退出码约定**（2 = 熔断跳闸），loop-kit 一个字节都不改。此项如实挂账。
//
// 台账锚点（沿用 D13 codex 8 对未封 journal 的同一取舍）：旁账落 **case 根**，不落
//   `--out-dir`——调用方换个 out-dir 就能把熔断计数清零的话，熔断等于不存在。
//
// 双家评审（S7 终修轮）在本模块落地四条，逐条对应的实现点见各函数头注：
//   ① 轮账的读改写全程在 per-case 独占锁 `<caseDir>/.heal-breaker.lock`（`wx`）内完成——
//      复核收口在晋升锁**释放之后**才记账（bin/heal.mjs 的调用位置），故不能靠晋升锁掩护；
//      两个不同晋升收据并发复核若各读各写，后写的会把先写的那一轮抹掉（丢更新 = 熔断计数
//      永远到不了 3）。锁形状与语义照抄 lib/heal/promote-tx.mjs（`wx` + 陈锁具名拒 + 绝不抢锁）。
//   ② 幂等检查**先于**终局分支：同一 cycleKey（= 同一次晋升事务）无论先前被记成空转还是
//      进展，重放一律不动账——否则「route:human 一次后换 `--ts` 反复重放」就能把连击洗掉。
//      已兑现进展的 cycleKey 记进 `progressKeys` 窗口，`lastProgress` 也带 cycleKey。
//   ③ 破损校验逐项做（schemaVersion / artifactKind / caseId / 轮项结构 / tripped 与
//      lastProgress 的类型）；「idleRounds 已满 3 却 tripped 非真」这类不变量破坏**按已跳闸
//      处置**（fail-closed 方向宁跳勿放，不在破损账上判「还没到 3 轮」）。
//   ④ 跳闸持久化次序：**先**原子落跳闸态（rename 成功才算跳闸），**再**写 inbox；inbox 写
//      失败不回滚跳闸态，只标 `escalationPending` 由调用方在 stderr 提示人工补录。记账路径
//      的一切异常一律归 `HealBreakerError`（调用方落 exit 2），绝不漏成未预期内部错误。

import {
  appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync,
  statSync, unlinkSync, writeFileSync, writeSync,
} from 'node:fs';
import { join } from 'node:path';

export const BREAKER_REJECT = {
  TRIPPED: 'HEAL_BREAKER_TRIPPED',
  LEDGER_BROKEN: 'HEAL_BREAKER_LEDGER_BROKEN',
  LEDGER_LOCKED: 'HEAL_BREAKER_LEDGER_LOCKED',
  LEDGER_IO: 'HEAL_BREAKER_LEDGER_IO',
};

/** D8 逐字：连续 3 个完整周期无终局 receipt 即跳闸。 */
export const BREAKER_MAX_IDLE_ROUNDS = 3;

/** 已兑现进展的 cycleKey 记忆窗口（防旧终局重放洗连击；窗口外的更古老终局如实挂账）。 */
export const BREAKER_PROGRESS_MEMORY = 32;

/** 轮账落点：case 根（调用方参数动不了）。 */
export const breakerStatePathOf = (caseDir) => join(caseDir, '.heal-breaker.json');
/** 轮账独占锁落点：同样锚 case 根，与轮账同生共死。 */
export const breakerLockPathOf = (caseDir) => join(caseDir, '.heal-breaker.lock');
/** 升级留痕的 drift 旁文件（plan §3.5 ④ 两选一之一；另一处是 loop 根 inbox.md）。 */
export const breakerInboxPathOf = (driftDir, caseId, ts) =>
  join(driftDir, `${caseId}.${ts}.breaker.inbox.md`);

/** 终局 receipt 两值（D8 的进展判据全集；其余 outcome 一律不算进展）。 */
const TERMINAL_OUTCOMES = new Set(['reverified', 'reverify-routed-human']);
export const isTerminalOutcome = (outcome) => TERMINAL_OUTCOMES.has(String(outcome || ''));

/** 带具名拒因的熔断面异常；调用方一律落 exit 2（熔断面 fail-closed，见 readBreakerState）。 */
export class HealBreakerError extends Error {
  constructor(reason, detail) {
    super(`${reason}: ${detail}`);
    this.reason = reason;
    this.detail = detail;
  }
}

const freshState = (caseId) => ({
  schemaVersion: 1,
  artifactKind: 'heal-breaker-state',
  caseId,
  idleRounds: [],
  lastProgress: null,
  progressKeys: [],
  tripped: null,
});

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const nonEmptyStr = (v) => typeof v === 'string' && v.length > 0;
const isoOf = (ts) => new Date(Number(ts)).toISOString();

/** 原子落盘：同目录 temp + rename（换字节这一刻不可分割，防半写账被下轮读成「才 1 轮」）。 */
function atomicWriteJson(path, doc) {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  try {
    renameSync(tmp, path);
  } catch (e) {
    try { unlinkSync(tmp); } catch { /* 清理失败不改判定 */ }
    throw e;
  }
}

// ── 轮账独占锁（评审 ①）──────────────────────────────────────────────────────
/**
 * 拿到才回；被占用/陈锁一律具名 fail-closed（绝不自动抢锁——抢锁等于把互斥变成摆设）。
 * 语义与 lib/heal/promote-tx.mjs::acquirePromoteLock 同族，但落点独立：记账发生在晋升锁
 * **释放之后**，共用同一把会与复核路径重入打架，故轮账自持一把。
 */
export function acquireBreakerLock(caseDir, { waitMs = 8000, staleMs = 30000 } = {}) {
  const lockPath = breakerLockPathOf(caseDir);
  const deadline = Date.now() + waitMs;
  for (;;) {
    try {
      const fd = openSync(lockPath, 'wx');
      try { writeSync(fd, `${process.pid}@${new Date().toISOString()}\n`); } finally { closeSync(fd); }
      return lockPath;
    } catch (e) {
      if (!e || e.code !== 'EEXIST') {
        throw new HealBreakerError(BREAKER_REJECT.LEDGER_IO,
          `熔断轮账锁 ${lockPath} 下不去（${(e && e.code) || 'Error'}），拒在无互斥保护下改账`);
      }
    }
    let st = null;
    try { st = statSync(lockPath); } catch { st = null; }
    if (st && Date.now() - st.mtimeMs > staleMs) {
      throw new HealBreakerError(BREAKER_REJECT.LEDGER_LOCKED,
        `熔断轮账锁 ${lockPath} 已陈旧（持锁进程疑似异常退出），须人工核查后清除`);
    }
    if (Date.now() > deadline) {
      throw new HealBreakerError(BREAKER_REJECT.LEDGER_LOCKED,
        `熔断轮账锁 ${lockPath} 持续被占用（同 case 另有复核在记账），本轮零改动退出`);
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
  }
}

export function releaseBreakerLock(lockPath) {
  try { unlinkSync(lockPath); } catch { /* 已被清理即视为释放 */ }
}

// ── 破损校验（评审 ③）────────────────────────────────────────────────────────
/** 轮项结构：cycleKey 是账的主键，缺一不可；stepId 允许 null（历史空转轮可能无具名步）。 */
function checkRound(r, i, bad) {
  if (!isObj(r)) return bad(`第 ${i + 1} 个轮项不是对象`);
  if (!nonEmptyStr(r.cycleKey)) return bad(`第 ${i + 1} 个轮项缺 cycleKey（幂等主键）`);
  if (r.stepId !== null && !nonEmptyStr(r.stepId)) return bad(`第 ${i + 1} 个轮项 stepId 形状不合法`);
  if (!nonEmptyStr(r.tsToken)) return bad(`第 ${i + 1} 个轮项缺 tsToken`);
  if (!nonEmptyStr(r.outcome)) return bad(`第 ${i + 1} 个轮项缺 outcome`);
  if (isTerminalOutcome(r.outcome)) return bad(`第 ${i + 1} 个轮项记的是终局 outcome，空转轮里不该有`);
  if (!nonEmptyStr(r.at)) return bad(`第 ${i + 1} 个轮项缺 at`);
  return null;
}

/**
 * 逐项验形。破损一律抛 —— 熔断面 fail-closed：在破损账上「判还没到 3 轮」等于把护栏关掉。
 * 只验形，不判「够不够 3 轮」（那是 tripFromInvariant 的事）。
 */
function assertLedgerShape(doc, path, caseId) {
  const bad = (detail) => {
    throw new HealBreakerError(BREAKER_REJECT.LEDGER_BROKEN,
      `熔断轮账 ${path} ${detail}，拒在破损账上判「还没到 ${BREAKER_MAX_IDLE_ROUNDS} 轮」`
      + '（fail-closed；人工核查后删该件即复位）');
  };
  if (!isObj(doc)) bad('不是 JSON 对象');
  if (doc.schemaVersion !== 1) bad(`schemaVersion=${JSON.stringify(doc.schemaVersion)} 非 1`);
  if (doc.artifactKind !== 'heal-breaker-state') bad('artifactKind 不是 heal-breaker-state');
  if (doc.caseId !== caseId) bad('caseId 与本 case 不一致');
  if (!Array.isArray(doc.idleRounds)) bad('idleRounds 不是数组');
  doc.idleRounds.forEach((r, i) => checkRound(r, i, bad));
  const keys = new Set(doc.idleRounds.map((r) => r.cycleKey));
  if (keys.size !== doc.idleRounds.length) bad('idleRounds 内 cycleKey 重复（同一次晋升被记了两轮）');
  if (doc.progressKeys !== undefined && !Array.isArray(doc.progressKeys)) bad('progressKeys 不是数组');
  if (Array.isArray(doc.progressKeys) && doc.progressKeys.some((k) => !nonEmptyStr(k))) {
    bad('progressKeys 含空键');
  }
  if (doc.lastProgress !== null && !isObj(doc.lastProgress)) bad('lastProgress 既非 null 也非对象');
  if (isObj(doc.lastProgress)) {
    if (!nonEmptyStr(doc.lastProgress.cycleKey)) bad('lastProgress 缺 cycleKey（旧终局重放判别不了）');
    if (!isTerminalOutcome(doc.lastProgress.outcome)) bad('lastProgress.outcome 不是终局值');
  }
  if (doc.tripped !== null && !isObj(doc.tripped)) bad('tripped 既非 null 也非对象');
  if (isObj(doc.tripped)) {
    if (doc.tripped.reason !== BREAKER_REJECT.TRIPPED) bad('tripped.reason 不是 HEAL_BREAKER_TRIPPED');
    if (!Number.isInteger(doc.tripped.rounds) || doc.tripped.rounds < BREAKER_MAX_IDLE_ROUNDS) {
      bad('tripped.rounds 不是 ≥ 阈值的整数');
    }
    if (!Array.isArray(doc.tripped.steps) || !Array.isArray(doc.tripped.inbox)) {
      bad('tripped.steps/inbox 不是数组');
    }
  }
}

/**
 * 不变量：轮项已满阈值就必须已跳闸。破坏者**按已跳闸处置**（不改盘上字节，只在内存里
 * 合成跳闸标记）——「三轮已记却 tripped 非真」要么是账被人动过、要么是上一轮跳闸半途夭折，
 * 两种情形都不该继续自愈（宁跳勿放）。
 */
function tripFromInvariant(doc) {
  if (isObj(doc.tripped) || doc.idleRounds.length < BREAKER_MAX_IDLE_ROUNDS) return doc;
  return {
    ...doc,
    tripped: {
      reason: BREAKER_REJECT.TRIPPED,
      at: null,
      rounds: doc.idleRounds.length,
      steps: doc.idleRounds.map((r) => String(r.stepId ?? '(未具名步)')),
      inbox: [],
      escalationPending: true,
      synthesized: '轮账不变量破坏（轮项已满阈值却未记跳闸态），按已跳闸处置',
    },
  };
}

/**
 * 读轮账。不在场 = 干净开局（回全新态，不落盘）。
 * 形状不可信一律抛；不变量破坏按已跳闸处置。两条路径调用方都落 exit 2。
 */
export function readBreakerState(caseDir, caseId) {
  const p = breakerStatePathOf(caseDir);
  if (!existsSync(p)) return freshState(caseId);
  let doc = null;
  let parsed = false;
  try { doc = JSON.parse(readFileSync(p, 'utf8')); parsed = true; } catch { parsed = false; }
  if (!parsed) {
    throw new HealBreakerError(BREAKER_REJECT.LEDGER_BROKEN,
      `熔断轮账 ${p} 不是合法 JSON（内容不回显），拒在破损账上判「还没到 ${BREAKER_MAX_IDLE_ROUNDS} 轮」`
      + '（fail-closed；人工核查后删该件即复位）');
  }
  assertLedgerShape(doc, p, caseId);
  if (!Array.isArray(doc.progressKeys)) doc.progressKeys = [];
  return tripFromInvariant(doc);
}

/**
 * 前置闸探针：本 case 是否已跳闸。case 根不在场 = 还没有任何 heal 事实 → 干净。
 * 回 { tripped, idleRounds, statePath, trip }。
 */
export function breakerStatus({ caseDir, caseId }) {
  const statePath = breakerStatePathOf(caseDir);
  if (!existsSync(caseDir)) return { tripped: false, idleRounds: 0, statePath, trip: null };
  const state = readBreakerState(caseDir, caseId);
  return {
    tripped: isObj(state.tripped),
    idleRounds: state.idleRounds.length,
    statePath,
    trip: isObj(state.tripped) ? state.tripped : null,
  };
}

/** 升级留痕：drift 旁文件 + loop 根 inbox.md（后者不在场则跳过，绝不代建机制根）。 */
function writeEscalation({ driftDir, caseId, tsToken, loopInboxPath, rounds, steps, statePath }) {
  const written = [];
  const at = isoOf(tsToken);
  if (driftDir) {
    const p = breakerInboxPathOf(driftDir, caseId, tsToken);
    mkdirSync(driftDir, { recursive: true });
    writeFileSync(p, [
      `# heal 熔断跳闸（${BREAKER_REJECT.TRIPPED}）`,
      '',
      `- caseId：${caseId}`,
      `- 跳闸时刻：${at}`,
      `- 连续空转周期数：${rounds}（阈值 ${BREAKER_MAX_IDLE_ROUNDS}）`,
      `- 空转周期落在的步：${steps.join(', ')}`,
      '- 判据：这些周期提案→应用→晋升→复核全走完，但没有任何终局 receipt',
      '  （healed→PASS 或 route:human）——自愈在原地空转。',
      `- 处置：一切 heal 子命令对本 case 一律 exit 2；人工核查后删除轮账 ${statePath} 方可复位。`,
      '',
    ].join('\n'), 'utf8');
    written.push(p);
  }
  if (loopInboxPath && existsSync(loopInboxPath)) {
    appendFileSync(loopInboxPath,
      `\n- heal 熔断跳闸 ${BREAKER_REJECT.TRIPPED}：caseId=${caseId} 连续 ${rounds} 个完整 heal 周期`
      + `（步 ${steps.join('/')}）无终局 receipt，自愈空转，已停并转人工（复位=删 ${statePath}）\n`,
      'utf8');
    written.push(loopInboxPath);
  }
  return written;
}

/**
 * 跳闸落定（评审 ④ 的次序）：先原子落跳闸态、rename 成功才算跳闸；再写 inbox。
 * inbox 写失败**不回滚**跳闸态（少一封信远好过漏一次跳闸），只把 escalationPending 留在账上
 * 并回给调用方去 stderr 提示补录。
 */
function commitTrip({ state, statePath, at, driftDir, caseId, tsToken, loopInboxPath }) {
  const rounds = state.idleRounds.length;
  const steps = state.idleRounds.map((r) => String(r.stepId ?? '(未具名步)'));
  state.tripped = {
    reason: BREAKER_REJECT.TRIPPED, at, rounds, steps, inbox: [], escalationPending: true,
  };
  atomicWriteJson(statePath, state);

  let inbox = [];
  let escalationError = null;
  try {
    inbox = writeEscalation({ driftDir, caseId, tsToken, loopInboxPath, rounds, steps, statePath });
  } catch (e) {
    escalationError = (e && (e.code || e.name)) || 'Error';
  }
  state.tripped.inbox = inbox;
  state.tripped.escalationPending = escalationError !== null;
  if (escalationError) state.tripped.escalationError = escalationError;
  try {
    atomicWriteJson(statePath, state);
  } catch (e) {
    // 跳闸态已在盘上（第一次 rename 已成功），补记 inbox 落点失败不改判定，只如实上报。
    escalationError = escalationError || (e && (e.code || e.name)) || 'Error';
  }
  return {
    tripped: true, idleRounds: rounds, statePath, inbox,
    escalationPending: escalationError !== null,
    ...(escalationError ? { escalationError } : {}),
  };
}

/**
 * 记一次**走完的** heal 周期（S7 主入口；唯一调用点是 CLI 复核模式的收口处）。
 *
 * 入参 outcome 即复核终局；cycleKey 是「同证据幂等」的键（调用方按本轮所凭的晋升事务算，
 * 同一次晋升被重复复核绝不算两轮，也绝不第二次兑现进展）。
 *
 * 回 { tripped, idleRounds, statePath, progress?, idempotent?, inbox?, escalationPending? }。
 * 一切异常一律 HealBreakerError（调用方落 exit 2）——记账路径不许落进「未预期内部错误」。
 */
export function recordHealCycle(args) {
  try {
    return recordHealCycleGuarded(args);
  } catch (e) {
    if (e instanceof HealBreakerError) throw e;
    throw new HealBreakerError(BREAKER_REJECT.LEDGER_IO,
      `熔断轮账读改写未完成（${(e && (e.code || e.name)) || 'Error'}；详情不回显），`
      + '拒在记不上账的情况下继续自愈');
  }
}

function recordHealCycleGuarded({
  caseDir, caseId, stepId, tsToken, cycleKey, outcome, driftDir, loopInboxPath,
  lockWaitMs, lockStaleMs,
}) {
  const statePath = breakerStatePathOf(caseDir);
  if (!existsSync(caseDir)) {
    // case 根不在场就落不下轮账。此路径在现役编排里走不到（复核前置早已要求 case 根在场），
    // 但绝不静默「记不上就算了」——那等于熔断在某些路径下悄悄失效。
    throw new HealBreakerError(BREAKER_REJECT.LEDGER_BROKEN,
      `case 根 ${caseDir} 不在场，熔断轮账无处可落（拒在无账可记的情况下继续自愈）`);
  }
  // 幂等键三段（caseId | stepId | 晋升收据哈希）须全非空：任一段空，两个不同周期就可能撞同键，
  // 「同证据幂等」会退化成「不同证据也算幂等」，熔断计数永远到不了 3（fail-closed 拒记）。
  if (!nonEmptyStr(caseId) || !nonEmptyStr(stepId) || !nonEmptyStr(cycleKey) || !nonEmptyStr(outcome)) {
    throw new HealBreakerError(BREAKER_REJECT.LEDGER_BROKEN,
      '熔断轮账入参不完备（caseId/stepId/cycleKey/outcome 须全非空），拒在幂等键不可靠时记账');
  }

  const lockPath = acquireBreakerLock(caseDir, {
    ...(Number.isFinite(lockWaitMs) ? { waitMs: lockWaitMs } : {}),
    ...(Number.isFinite(lockStaleMs) ? { staleMs: lockStaleMs } : {}),
  });
  try {
    return recordUnderLock({
      statePath, caseDir, caseId, stepId, tsToken, cycleKey, outcome, driftDir, loopInboxPath,
    });
  } finally {
    releaseBreakerLock(lockPath);
  }
}

/** 读改写全程在锁内（评审 ①）：并发的两次复核收口只会串行落账，绝不互相抹掉。 */
function recordUnderLock({
  statePath, caseDir, caseId, stepId, tsToken, cycleKey, outcome, driftDir, loopInboxPath,
}) {
  const state = readBreakerState(caseDir, caseId);
  const at = isoOf(tsToken);
  if (isObj(state.tripped)) {
    // 已跳闸还走到这里 = 前置闸被绕过；照旧 fail-closed 报跳闸，绝不悄悄续记。
    return {
      tripped: true,
      idleRounds: state.idleRounds.length,
      statePath,
      inbox: Array.isArray(state.tripped.inbox) ? state.tripped.inbox : [],
    };
  }

  // 幂等**先于**终局（评审 ②）：同一 cycleKey 记过就一字不动——无论它当初被记成空转还是
  // 兑现过进展。否则「拿一份 route:human 收据换个 --ts 反复重放」就能把连击一遍遍洗回 0，
  // 三轮空转永远凑不齐。已兑现进展的键留在 progressKeys 窗口里（窗口外的更古老终局重放
  // 仍会再兑现一次，如实挂账——实际每 case 的完整周期数远小于窗口）。
  const seenIdle = state.idleRounds.some((r) => isObj(r) && r.cycleKey === cycleKey);
  const seenProgress = (Array.isArray(state.progressKeys) && state.progressKeys.includes(cycleKey))
    || (isObj(state.lastProgress) && state.lastProgress.cycleKey === cycleKey);
  if (seenIdle || seenProgress) {
    return {
      tripped: false,
      idleRounds: state.idleRounds.length,
      statePath,
      idempotent: true,
      ...(seenProgress ? { progress: true } : {}),
    };
  }

  if (isTerminalOutcome(outcome)) {
    // 有进展：连击清零（D8「连续」的字面义），并留一行进展事实供审计。
    state.idleRounds = [];
    state.lastProgress = { cycleKey, stepId, tsToken: String(tsToken), outcome, at };
    state.progressKeys = [...(state.progressKeys || []), cycleKey].slice(-BREAKER_PROGRESS_MEMORY);
    atomicWriteJson(statePath, state);
    return { tripped: false, idleRounds: 0, statePath, progress: true };
  }

  state.idleRounds.push({ cycleKey, stepId, tsToken: String(tsToken), outcome, at });
  if (state.idleRounds.length < BREAKER_MAX_IDLE_ROUNDS) {
    atomicWriteJson(statePath, state);
    return { tripped: false, idleRounds: state.idleRounds.length, statePath };
  }
  return commitTrip({ state, statePath, at, driftDir, caseId, tsToken, loopInboxPath });
}
