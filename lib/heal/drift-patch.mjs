// lib/heal/drift-patch.mjs —— S3 补丁落盘 + 证据元组台账（IO 层，零 LLM、零浏览器）。
//
// 与 lib/drift-patch.mjs 的分工：那边是**补丁字节构造纯函数**（P5 落地，产物符合已冻
// schema）；本模块只管**落盘、台账与并发安全**，不碰补丁语义。
//
// 台账键 = 证据元组（GRILL D2）：{caseId, stepId, verdictSha256, axesSha256, eventsSha256}。
//   - 同元组重调 → 幂等返回既有补丁，不产新件、不记新行、不计新漂移；
//   - 同一 {caseId, stepId} 的**不同**元组第 2 次 → 判 flaky locator：升级 inbox + 拒新补丁
//     （HEAL_FLAKY_ESCALATED）；不同步骤各自首漂互不触发；
//   - 台账追加必须原子且读-改-写全程在锁内（O_EXCL 独占锁），杜绝并发双写丢行与
//     「丢 stdout 重试」被误计成新漂移。
//   - 陈锁不偷不抢：超阈即具名 fail-closed（HEAL_LEDGER_LOCK_STALE），由人处置。
//
// 非就地纪律自证（plan S3）：整个提案过程写前写后各算一次原 events 的 sha256，
// 不一致即抛 —— 提案面绝不允许碰原 spec 字节（护栏 #5）。

import { createHash } from 'node:crypto';
import {
  appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync,
  readdirSync, statSync, unlinkSync, writeFileSync, writeSync,
} from 'node:fs';
import { basename, join } from 'node:path';

export const LEDGER_REJECT = {
  FLAKY_ESCALATED: 'HEAL_FLAKY_ESCALATED',
  LOCK_BUSY: 'HEAL_LEDGER_LOCK_BUSY',
  LOCK_STALE: 'HEAL_LEDGER_LOCK_STALE',
  EVENTS_MUTATED: 'HEAL_EVENTS_MUTATED',
  UNSEALED_JOURNAL: 'HEAL_UNSEALED_JOURNAL',
  PATCH_COLLISION: 'HEAL_PATCH_PATH_COLLISION',
  PATCH_LEDGER_UNBOUND: 'HEAL_PATCH_LEDGER_UNBOUND',
};

/** 带具名拒因的台账异常：调用方据 reason 映射退出码与结构化 stdout。 */
export class HealLedgerError extends Error {
  constructor(reason, detail) {
    super(`${reason}: ${detail}`);
    this.reason = reason;
    this.detail = detail;
  }
}

export const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

export const driftDirOf = (outDir) => join(outDir, 'drift');
export const ledgerPathOf = (driftDir, caseId) => join(driftDir, `${caseId}.ledger.jsonl`);
export const lockPathOf = (driftDir, caseId) => join(driftDir, `${caseId}.ledger.lock`);
// 补丁落点。GRILL D13 codex 10 要求「文件名加 stepId 段」，但 plan §3.5 的
// `<caseId>.<ts>.patch.json` 已被冻结金牌 tests/_golden/p6-heal-proposal-ledger.zero-sut
// （第 49/85 行逐字断言该名）钉死，实现者对该断言只读 —— 故 v1 保留冻结名，把
// 「防同 --ts 异步骤互覆」这一实质目的改由下面的 `wx` 独占写 + 幂等命中哈希绑定闭合：
// 同 ts 异步骤第二次落盘会撞 EEXIST 落具名拒因，绝不静默互覆。文件名一项如实挂账。
export const patchPathOf = (driftDir, caseId, ts) => join(driftDir, `${caseId}.${ts}.patch.json`);
export const inboxPathOf = (driftDir, caseId, ts) => join(driftDir, `${caseId}.${ts}.inbox.md`);

/** 证据元组的稳定键串（次序固定，跨进程可比）。 */
export function evidenceTupleKey({ caseId, stepId, verdictSha256, axesSha256, eventsSha256 }) {
  return [caseId, stepId, verdictSha256, axesSha256, eventsSha256].join('|');
}

/** 同步小睡（锁自旋用）：主线程 Atomics.wait，不引 setTimeout 的异步面。 */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * O_EXCL 独占锁：拿到才回，超 waitMs 具名 busy，陈锁（mtime 超 staleMs）具名 stale。
 * 陈锁一律 fail-closed 交人处置——自动抢锁等于把并发保护变成摆设。
 */
function acquireLock(lockPath, { waitMs = 10000, staleMs = 30000 } = {}) {
  const deadline = Date.now() + waitMs;
  for (;;) {
    try {
      const fd = openSync(lockPath, 'wx');
      try { writeSync(fd, `${process.pid}@${new Date().toISOString()}\n`); } finally { closeSync(fd); }
      return;
    } catch (e) {
      if (e && e.code !== 'EEXIST') throw e;
    }
    let st = null;
    try { st = statSync(lockPath); } catch { st = null; }
    if (st && Date.now() - st.mtimeMs > staleMs) {
      throw new HealLedgerError(LEDGER_REJECT.LOCK_STALE, `台账锁 ${lockPath} 已陈旧（持锁进程疑似异常退出），须人工核查后清除`);
    }
    if (Date.now() > deadline) {
      throw new HealLedgerError(LEDGER_REJECT.LOCK_BUSY, `台账锁 ${lockPath} 持续被占用，本轮不产补丁`);
    }
    sleepSync(20);
  }
}

function releaseLock(lockPath) {
  try { unlinkSync(lockPath); } catch { /* 已被清理即视为释放 */ }
}

/** 持锁执行：无论成败都释放锁（绝不留陈锁给下一轮）。 */
export function withLedgerLock(driftDir, caseId, fn, opts) {
  const lockPath = lockPathOf(driftDir, caseId);
  acquireLock(lockPath, opts);
  try { return fn(); } finally { releaseLock(lockPath); }
}

/** 读台账（逐行 JSON；半行/坏行 fail-closed 抛，绝不静默跳过丢证据）。 */
export function readLedger(ledgerPath) {
  if (!existsSync(ledgerPath)) return [];
  const text = readFileSync(ledgerPath, 'utf8');
  const rows = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { rows.push(JSON.parse(t)); } catch {
      throw new HealLedgerError(LEDGER_REJECT.EVENTS_MUTATED, `台账 ${ledgerPath} 含非法行，拒在破损台账上继续`);
    }
  }
  return rows;
}

/**
 * 未封 journal 扫描（GRILL D5：一切 heal 子命令见未封 journal 一律 fail-closed）。
 * 回具名 journal 路径数组；空数组=无残留。
 */
export function scanUnsealedJournals(driftDir) {
  if (!existsSync(driftDir)) return [];
  const out = [];
  for (const f of readdirSync(driftDir)) {
    if (!f.endsWith('.promote.journal.json')) continue;
    const p = join(driftDir, f);
    let doc = null;
    try { doc = JSON.parse(readFileSync(p, 'utf8')); } catch { out.push(p); continue; }
    if (!journalSealed(doc)) out.push(p);
  }
  return out;
}

/** 终局两态：receipt 封账（sealed）与回滚封账（rolled-back）。其余一律视为未封。 */
function journalSealed(doc) {
  const status = String((doc && doc.status) || '');
  return (doc && doc.sealed === true) || status === 'rolled-back';
}

// ── case 根锚（GRILL D13 的 D5 增补：未封 journal 扫描不随调用方 --out-dir 漂移）────
// journal 字节仍落 <out-dir>/drift（plan §3.5 已冻产物路径），但事务开账的同时在 **case 根**
// （由 events 路径派生，见 lib/paths.mjs::casePaths）留一枚指针；封账时清除。这样换 --out-dir
// 也绕不开残留事务：case 根这一锚是调用方参数动不了的。
export const caseJournalDirOf = (caseDir) => join(caseDir, '.heal-journals');
export const journalPointerPathOf = (caseDir, journalPath) =>
  join(caseJournalDirOf(caseDir), `${basename(journalPath)}.pointer`);

/** 开账登记：case 根落指针（内容只有 journal 绝对路径，绝不复制事务内容）。 */
export function registerJournalPointer(caseDir, journalPath) {
  const p = journalPointerPathOf(caseDir, journalPath);
  mkdirSync(caseJournalDirOf(caseDir), { recursive: true });
  writeFileSync(p, `${JSON.stringify({ journalPath, at: new Date().toISOString() })}\n`, 'utf8');
  return p;
}

/** 封账清除：指针在场即删；删不掉不改判定（下轮扫描读到已封 journal 也不会误拦）。 */
export function clearJournalPointer(caseDir, journalPath) {
  try { unlinkSync(journalPointerPathOf(caseDir, journalPath)); } catch { /* 已清即视为清除 */ }
}

/**
 * 双锚未封 journal 扫描（D13）：调用方 out-dir 的 drift 目录 + case 根指针目录。
 * 指针指不到件 / 件读不出 → 一律计入未封（fail-closed，绝不猜事务收没收尾）。
 */
export function scanUnsealedJournalsAnchored({ driftDir, caseDir }) {
  const out = [];
  const seen = new Set();
  const push = (p) => { if (!seen.has(p)) { seen.add(p); out.push(p); } };
  for (const p of scanUnsealedJournals(driftDir)) push(p);
  const reg = caseJournalDirOf(caseDir);
  if (!existsSync(reg)) return out;
  for (const f of readdirSync(reg)) {
    if (!f.endsWith('.pointer')) continue;
    const ptr = join(reg, f);
    let target = null;
    try { target = JSON.parse(readFileSync(ptr, 'utf8')).journalPath; } catch { target = null; }
    if (typeof target !== 'string' || !target || !existsSync(target)) { push(ptr); continue; }
    let doc = null;
    try { doc = JSON.parse(readFileSync(target, 'utf8')); } catch { push(target); continue; }
    if (!journalSealed(doc)) push(target);
  }
  return out;
}

/** 升级留痕：drift 内 inbox 旁文件（plan §3.5 ④ 两选一之一），必带 caseId 具名。 */
function writeInboxSidecar({ driftDir, caseId, stepId, ts, tupleKey, priorTuples }) {
  const p = inboxPathOf(driftDir, caseId, ts);
  const body = [
    `# heal 升级（${LEDGER_REJECT.FLAKY_ESCALATED}）`,
    '',
    `- caseId：${caseId}`,
    `- stepId：${stepId}`,
    `- 本次证据元组：${tupleKey}`,
    `- 已在册元组数：${priorTuples}`,
    '- 结论：同一步第 2 个不同证据元组 = 疑似 flaky locator，拒产新补丁，转人工裁定。',
    '',
  ].join('\n');
  writeFileSync(p, body, 'utf8');
  return p;
}

/** 升级留痕：loop 根 inbox.md（另一选项；loop 目录不在场则跳过，绝不代建机制根）。 */
function appendLoopInbox(loopInboxPath, { caseId, stepId, tupleKey }) {
  if (!loopInboxPath || !existsSync(loopInboxPath)) return null;
  appendFileSync(loopInboxPath, `\n- heal 升级 ${LEDGER_REJECT.FLAKY_ESCALATED}：caseId=${caseId} stepId=${stepId} 证据元组=${tupleKey}（同步骤第 2 个不同元组，拒自动重锚，转人工）\n`, 'utf8');
  return loopInboxPath;
}

/**
 * 补丁独占落盘（GRILL D13 codex 10）：`wx` 打开，落点已被占用即具名拒，
 * 绝不覆盖——同 `--ts` 异步骤互覆在这里变成确定性拒绝而不是静默丢补丁。
 */
function writePatchExclusive(patchPath, text) {
  let fd;
  try {
    fd = openSync(patchPath, 'wx');
  } catch (e) {
    if (e && e.code === 'EEXIST') {
      throw new HealLedgerError(LEDGER_REJECT.PATCH_COLLISION,
        `补丁落点 ${patchPath} 已被占用且不属于本证据元组（同 --ts 异步骤互覆），拒覆盖写`);
    }
    throw e;
  }
  try { writeSync(fd, text); } finally { closeSync(fd); }
}

/**
 * 幂等命中路径的绑定校验（D13 codex 10 后半）：既有补丁文件必须在场且字节哈希与台账行一致。
 * 对不上说明补丁被换过/被别的步覆盖过 —— 具名拒，绝不把陌生字节当「既有补丁」返回。
 */
function assertIdempotentPatchBound(row) {
  const p = typeof row.patchPath === 'string' ? row.patchPath : null;
  if (!p || !existsSync(p)) {
    throw new HealLedgerError(LEDGER_REJECT.PATCH_LEDGER_UNBOUND,
      '台账登记的既有补丁文件已不在场，幂等命中不可兑现（拒返回不存在的补丁）');
  }
  if (typeof row.patchSha256 !== 'string' || !row.patchSha256) {
    throw new HealLedgerError(LEDGER_REJECT.PATCH_LEDGER_UNBOUND,
      '台账行缺 patchSha256，无法验证既有补丁字节与登记一致（拒在不可绑定的台账上幂等返回）');
  }
  if (sha256File(p) !== row.patchSha256) {
    throw new HealLedgerError(LEDGER_REJECT.PATCH_LEDGER_UNBOUND,
      '既有补丁字节与台账登记的 patchSha256 不一致（补丁被改动或被异步骤覆盖）');
  }
}

/**
 * 提交一次提案（S3 主入口）。全程持台账锁：读台账 → 判幂等/升级 → 写补丁 → 追加台账行。
 *
 * 回 { outcome:'proposal-written'|'idempotent', patchPath, ledgerPath }
 *  或 { outcome:'escalated', reason:HEAL_FLAKY_ESCALATED, inboxPath, ledgerPath }
 */
export function commitProposal({
  driftDir, caseId, stepId, tuple, tsToken, patch, eventsPath, loopInboxPath,
}) {
  mkdirSync(driftDir, { recursive: true });
  const ledgerPath = ledgerPathOf(driftDir, caseId);
  const tupleKey = evidenceTupleKey({ caseId, stepId, ...tuple });
  // 非就地自证（一）：动手前的原 events 字节。
  const eventsShaBefore = sha256File(eventsPath);

  const result = withLedgerLock(driftDir, caseId, () => {
    const rows = readLedger(ledgerPath);
    const sameStep = rows.filter((r) => r && r.kind === 'proposal' && r.caseId === caseId && r.stepId === stepId);
    const same = sameStep.find((r) => r.tupleKey === tupleKey);
    if (same) {
      // D2 幂等：同证据重调返回既有补丁，不计新漂移、不动任何字节。
      // D13：先验「既有补丁在场且哈希与台账行一致」，对不上具名拒。
      assertIdempotentPatchBound(same);
      return { outcome: 'idempotent', patchPath: same.patchPath, ledgerPath };
    }
    if (sameStep.length >= 1) {
      // D2 升级：同一 {caseId, stepId} 的第 2 个不同证据元组 = flaky locator，拒新补丁。
      const inboxPath = writeInboxSidecar({
        driftDir, caseId, stepId, ts: tsToken, tupleKey, priorTuples: sameStep.length,
      });
      appendLoopInbox(loopInboxPath, { caseId, stepId, tupleKey });
      appendFileSync(ledgerPath, `${JSON.stringify({
        schemaVersion: 1,
        kind: 'escalation',
        recordedAt: new Date(Number(tsToken)).toISOString(),
        caseId,
        stepId,
        tsToken: String(tsToken),
        evidence: tuple,
        tupleKey,
        reason: LEDGER_REJECT.FLAKY_ESCALATED,
        inboxPath,
      })}\n`, 'utf8');
      return { outcome: 'escalated', reason: LEDGER_REJECT.FLAKY_ESCALATED, inboxPath, ledgerPath };
    }
    const patchPath = patchPathOf(driftDir, caseId, tsToken);
    const patchText = `${JSON.stringify(patch, null, 2)}\n`;
    writePatchExclusive(patchPath, patchText);
    appendFileSync(ledgerPath, `${JSON.stringify({
      schemaVersion: 1,
      kind: 'proposal',
      recordedAt: new Date(Number(tsToken)).toISOString(),
      caseId,
      stepId,
      tsToken: String(tsToken),
      evidence: tuple,
      tupleKey,
      patchPath,
      patchSha256: createHash('sha256').update(Buffer.from(patchText, 'utf8')).digest('hex'),
      outcome: 'proposal-written',
    })}\n`, 'utf8');
    return { outcome: 'proposal-written', patchPath, ledgerPath };
  });

  // 非就地自证（二）：提案全程不得碰原 events 一个字节。
  const eventsShaAfter = sha256File(eventsPath);
  if (eventsShaBefore !== eventsShaAfter) {
    throw new HealLedgerError(
      LEDGER_REJECT.EVENTS_MUTATED,
      '提案过程中原 events 字节发生变化（非就地纪律被破坏），fail-closed',
    );
  }
  return result;
}
