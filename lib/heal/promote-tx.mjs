// lib/heal/promote-tx.mjs —— 晋升事务的互斥面与独占落盘面（IO 原语，零 LLM、零浏览器）。
//
// 从 lib/heal/promote.mjs 抽出，晋升（S5）与复核/回滚（S6）共用同一份实现 —— GRILL D14 三补
// 里的「同一把锁」与「同一套独占落盘」若各写一份，就等于两套语义，锁面统一无从谈起。
//
//   ① per-case 独占锁 `<caseDir>/.heal-promote.lock`（`wx`，锚定 case 根，换 --out-dir 绕不开）：
//      晋升、复核、复核内的回滚**共用同一把**，三者不可交错；拿不到锁一律具名 fail-closed，
//      绝不自动抢锁（自动抢锁等于把互斥保护变成摆设）。
//   ② 事务产物独占落盘：journal、逐件预存副本、receipt 一律 `wx`（副本走 COPYFILE_EXCL）。
//      事务标识不可复用这一目的**不靠随机后缀**实现 —— `--ts` 是金牌注入的确定性实参，
//      加随机后缀就破确定性；故改由「落点已被占用即具名碰撞拒」把不可覆写做成机制：
//      同 caseId + out-dir + ts 的第二次晋升在**动任何目标之前**就撞拒，审计链不可覆写。
//
// 本模块只管互斥与字节落点，不碰事务语义（登记什么、怎么回滚仍归 promote.mjs）。

import {
  closeSync, constants, copyFileSync, existsSync, openSync, statSync, unlinkSync, writeSync,
} from 'node:fs';
import { join } from 'node:path';

export const PROMOTE_REJECT = {
  CANDIDATE_INVALID: 'HEAL_CANDIDATE_INVALID',
  CANDIDATE_SHA256_MISMATCH: 'HEAL_CANDIDATE_SHA256_MISMATCH',
  CANDIDATE_SCOPE_INVALID: 'HEAL_CANDIDATE_SCOPE_INVALID',
  RESIGN_MISSING: 'HEAL_RESIGN_MISSING',
  FROZEN_CONTRACT_UNSIGNED: 'HEAL_FROZEN_CONTRACT_UNSIGNED',
  UNSEALED_JOURNAL: 'HEAL_UNSEALED_JOURNAL',
  JOURNAL_BROKEN: 'HEAL_JOURNAL_BROKEN',
  ROLLBACK_FAILED: 'HEAL_ROLLBACK_FAILED',
  LINEAGE_UNBOUND: 'HEAL_PROMOTE_LINEAGE_UNBOUND',
  DIFF_UNBOUND: 'HEAL_CANDIDATE_DIFF_UNBOUND',
  LOCK_BUSY: 'HEAL_PROMOTE_LOCK_BUSY',
  LOCK_STALE: 'HEAL_PROMOTE_LOCK_STALE',
  LOCK_UNAVAILABLE: 'HEAL_PROMOTE_LOCK_UNAVAILABLE',
  EVENTS_MOVED: 'HEAL_EVENTS_MOVED_UNDER_LOCK',
  BASELINE_UNBOUND: 'HEAL_BASELINE_VERDICT_UNBOUND',
  ARTIFACT_COLLISION: 'HEAL_TX_ARTIFACT_COLLISION',
};

/** 带具名拒因的晋升异常；晋升面一律落 exit 6（D7：晋升阻断）。 */
export class HealPromoteError extends Error {
  constructor(reason, detail) {
    super(`${reason}: ${detail}`);
    this.reason = reason;
    this.detail = detail;
  }
}

export const promoteLockPathOf = (caseDir) => join(caseDir, '.heal-promote.lock');

/**
 * 拿到才回；被占用/陈锁一律具名 fail-closed（绝不自动抢锁）。
 * 晋升与复核调同一函数、同一落点 —— 「同一把锁」这件事在代码面只有一处实现。
 */
export function acquirePromoteLock(caseDir, { waitMs = 8000, staleMs = 30000 } = {}) {
  if (!existsSync(caseDir)) {
    throw new HealPromoteError(PROMOTE_REJECT.LOCK_UNAVAILABLE,
      `case 根 ${caseDir} 不在场，事务锁无处可下（本轮零改动退出）`);
  }
  const lockPath = promoteLockPathOf(caseDir);
  const deadline = Date.now() + waitMs;
  for (;;) {
    try {
      const fd = openSync(lockPath, 'wx');
      try { writeSync(fd, `${process.pid}@${new Date().toISOString()}\n`); } finally { closeSync(fd); }
      return lockPath;
    } catch (e) {
      if (e instanceof HealPromoteError) throw e;
      if (e && e.code !== 'EEXIST') throw e;
    }
    let st = null;
    try { st = statSync(lockPath); } catch { st = null; }
    if (st && Date.now() - st.mtimeMs > staleMs) {
      throw new HealPromoteError(PROMOTE_REJECT.LOCK_STALE,
        `事务锁 ${lockPath} 已陈旧（持锁进程疑似异常退出），须人工核查后清除`);
    }
    if (Date.now() > deadline) {
      throw new HealPromoteError(PROMOTE_REJECT.LOCK_BUSY,
        `事务锁 ${lockPath} 持续被占用（同 case 另有晋升/复核在跑），本轮零改动退出`);
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20);
  }
}

export function releasePromoteLock(lockPath) {
  try { unlinkSync(lockPath); } catch { /* 已被清理即视为释放 */ }
}

const collision = (label, path) => new HealPromoteError(PROMOTE_REJECT.ARTIFACT_COLLISION,
  `${label}落点 ${path} 已被占用（同 caseId + out-dir + --ts 的事务标识不可复用），拒覆写审计链`);

/** 独占预留落点：`wx` 占位即回，落点已在场 → 具名碰撞拒（此刻一个目标字节都还没动）。 */
export function reserveExclusive(path, label) {
  let fd;
  try { fd = openSync(path, 'wx'); } catch (e) {
    if (e && e.code === 'EEXIST') throw collision(label, path);
    throw e;
  }
  closeSync(fd);
  return path;
}

/** 独占写：预留与落字节一步到位（receipt 用）。 */
export function writeExclusive(path, text, label) {
  let fd;
  try { fd = openSync(path, 'wx'); } catch (e) {
    if (e && e.code === 'EEXIST') throw collision(label, path);
    throw e;
  }
  try { writeSync(fd, text); } finally { closeSync(fd); }
  return path;
}

/** 独占复制（逐件预存副本）：COPYFILE_EXCL —— 副本已在场即碰撞拒，绝不盖掉旧事务的取证。 */
export function copyExclusive(src, dest, label) {
  try {
    copyFileSync(src, dest, constants.COPYFILE_EXCL);
  } catch (e) {
    if (e && e.code === 'EEXIST') throw collision(label, dest);
    throw e;
  }
  return dest;
}

/** 撤销本事务自己占的位（只在同一次调用里用；绝不清别人的落点）。 */
export function discardReservation(path) {
  try { unlinkSync(path); } catch { /* 已不在场即视为撤销 */ }
}
