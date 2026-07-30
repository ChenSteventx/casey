// lib/heal/promote.mjs —— S5 日志式对称事务晋升 + 对称回滚（IO 层，零 LLM、零浏览器）。
//
// GRILL D5 v4 逐条落地：
//   前置全验（任一不满足**整体拒**，一个字节都不换）：候选可读同 case ∧ 冻结绑定件在场且已签
//   ∧ 绑定的 eventsSha256 已改签到候选精确字节（= 人签绑定候选 sha256 与「重签件就位」在现役
//   产物面上的同一件事，plan §3.5 补钉②）∧ 候选相对现役 events 只动一步（其余字节保序）
//   ∧ 无未封 journal（调用方前置闸已拦，本模块再核一道）。
//
//   五步事务：① 写 journal——登记**全部将改目标**（events + 每个受影响绑定/发布指针）的前后
//   sha256 与逐件预存副本 → ② 重签件就位复核 → ③ events 单 rename 切换 → ④ 绑定发布（同样
//   走 temp+rename，人签字节原样republish，绝不改人签内容）→ ⑤ HealReceipt 落盘封 journal。
//
//   回滚与晋升**对称**：按 journal 逆序恢复**全部**登记目标（events + 绑定逐件），逐件恢复后
//   sha256 断言，回滚过程自身记入 journal 并以 `rolled-back` 状态封账。**不存在只恢复 events
//   的半回滚路径**；恢复期 journal 处于未封态，中断即被 `scanUnsealedJournals` 拦住一切 heal
//   子命令（fail-closed，具名码）。

//   GRILL D13 的 D5 增补（codex 5/6/7/8）在本模块逐条落地：
//     · 绑定链闭合——候选相对现役 events 的恰一差异，必须**正是**已签补丁指定步的定位字段变更，
//       且该补丁在证据元组台账里有对应登记行；缺任一环整体拒（exit 6）。
//     · per-case 独占事务锁（O_EXCL，锚定 case 根）——换 --out-dir 也绕不开。
//     · 锁内切换前重验现役 events sha256 与 journal 登记前哈希一致，不一致零改动中止。
//     · journal ↔ receipt 互绑：journal 封账写 receipt 内容哈希，receipt 写 journal 文件哈希
//       与不可变核哈希（journal 后续会被复核补状态，故另留可现算的核哈希供复核端验）。
//
//   GRILL D14（代码 delta 轮）在本模块落地两条（第①条锁面统一见 lib/heal/promote-tx.mjs）：
//     · ② 基线绑定——开账时把「提案台账登记行的 sha256」与「heal 前基线 verdict 文件的
//       sha256」一并冻进 journal 不可变核（journalCoreSha256 覆盖范围）并写进 receipt；
//       复核端据此重验基线字节未被替换（防「提案后换基线，把非目标步的新回归藏起来」）。
//       ②补：光冻还不够——冻的必须**正是**证据元组里那份 verdict，故前置全验再核一道「台账行
//       evidence.verdictSha256 === 当下基线字节」；晋升前换基线与晋升后换基线同拒因、同畸形面。
//     · ③ 事务产物独占落盘——journal / 逐件预存副本 / receipt 一律 `wx`（见 promote-tx.mjs）。

import { createHash } from 'node:crypto';
import {
  existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { assertSignedContract } from '../sign-gate.mjs';
import { canApply } from '../drift-patch.mjs';
import { casePaths } from '../paths.mjs';
import { applyLocatorToEvent } from './apply.mjs';
import {
  clearJournalPointer, driftDirOf, ledgerPathOf, readLedger, registerJournalPointer,
  scanUnsealedJournalsAnchored,
} from './drift-patch.mjs';
import {
  HealPromoteError, PROMOTE_REJECT, acquirePromoteLock, copyExclusive, discardReservation,
  releasePromoteLock, reserveExclusive, writeExclusive,
} from './promote-tx.mjs';

// 拒因表与异常类的单一事实源在 promote-tx.mjs（晋升与复核共用），这里只做转出。
export { HealPromoteError, PROMOTE_REJECT, promoteLockPathOf } from './promote-tx.mjs';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const nonEmptyStr = (v) => typeof v === 'string' && v.length > 0;
const sha256Of = (buf) => createHash('sha256').update(buf).digest('hex');
/** 去 `sha256:` 前缀取裸十六进制；非字符串一律 null（拿不出哈希 = 证不出绑定）。 */
const bareSha = (v) => (nonEmptyStr(v) ? v.replace(/^sha256:/, '') : null);
/** 基线绑定不可证 → 畸形面 fail-closed（exit 65，与复核端同拒因同码位；晋升面其余拒因仍 6）。 */
const baselineUnbound = (detail) => Object.assign(
  new HealPromoteError(PROMOTE_REJECT.BASELINE_UNBOUND, detail), { kind: 'malformed' });

export const sha256File = (p) => sha256Of(readFileSync(p));
export const journalPathOf = (driftDir, caseId, ts) =>
  join(driftDir, `${caseId}.${ts}.promote.journal.json`);
export const receiptPathOf = (driftDir, caseId, ts) =>
  join(driftDir, `${caseId}.${ts}.heal-receipt.json`);
const backupPathOf = (driftDir, caseId, ts, tag) =>
  join(driftDir, `${caseId}.${ts}.${tag}.backup`);
/** heal 前基线 verdict（复核端的对照底座）：case 根的现役产物名，不另造第二处约定。 */
export const baselineVerdictPathOf = (caseDir) => join(caseDir, 'verdict.json');

const jsonText = (v) => `${JSON.stringify(v, null, 2)}\n`;
const isoOf = (tsToken) => new Date(Number(tsToken)).toISOString();

/** 原子落盘：同目录 temp + rename（同一文件系统，换字节这一刻不可分割）。 */
function atomicWrite(path, bytes) {
  const tmp = join(dirname(path), `.${Date.now()}-${process.pid}.heal.tmp`);
  writeFileSync(tmp, bytes);
  try {
    renameSync(tmp, path);
  } catch (e) {
    try { unlinkSync(tmp); } catch { /* 清理失败不改判定 */ }
    throw e;
  }
}

function readJsonOr(path, reason, label) {
  if (!existsSync(path)) throw new HealPromoteError(reason, `${label} 不在场`);
  try {
    const doc = JSON.parse(readFileSync(path, 'utf8'));
    if (!isObj(doc)) throw new Error('non-object');
    return doc;
  } catch {
    throw new HealPromoteError(reason, `${label} 不是合法 JSON 对象（内容不回显）`);
  }
}

/** journal 读取（回滚要靠它，破损即 fail-closed，绝不猜登记了什么）。 */
export function readJournal(journalPath) {
  const doc = readJsonOr(journalPath, PROMOTE_REJECT.JOURNAL_BROKEN, '晋升 journal');
  if (doc.artifactKind !== 'heal-promote-journal' || !Array.isArray(doc.targets)) {
    throw new HealPromoteError(PROMOTE_REJECT.JOURNAL_BROKEN, 'journal 形状非法（缺 targets）');
  }
  return doc;
}

/** 候选相对现役 events 的差异面：必须恰好一步不同，其余字节保序（D5 逐字）。 */
export function diffSingleStep(currentDoc, candidateDoc) {
  const cur = Array.isArray(currentDoc.events) ? currentDoc.events : null;
  const cand = Array.isArray(candidateDoc.events) ? candidateDoc.events : null;
  if (!cur || !cand || cur.length !== cand.length || cur.length === 0) {
    throw new HealPromoteError(PROMOTE_REJECT.CANDIDATE_SCOPE_INVALID,
      '候选与现役 events 的事件条数不一致（候选不是单步重锚）');
  }
  for (const key of new Set([...Object.keys(currentDoc), ...Object.keys(candidateDoc)])) {
    if (key === 'events') continue;
    if (JSON.stringify(currentDoc[key]) !== JSON.stringify(candidateDoc[key])) {
      throw new HealPromoteError(PROMOTE_REJECT.CANDIDATE_SCOPE_INVALID,
        `候选改动了 events 文档级字段 ${key}（重锚只许换目标步定位）`);
    }
  }
  const changed = [];
  for (let i = 0; i < cur.length; i++) {
    if (cur[i] && cand[i] && cur[i].stepId !== cand[i].stepId) {
      throw new HealPromoteError(PROMOTE_REJECT.CANDIDATE_SCOPE_INVALID,
        `候选第 ${i} 步 stepId 与现役不符（步序不得重排）`);
    }
    if (JSON.stringify(cur[i]) !== JSON.stringify(cand[i])) changed.push(i);
  }
  if (changed.length !== 1) {
    throw new HealPromoteError(PROMOTE_REJECT.CANDIDATE_SCOPE_INVALID,
      `候选与现役 events 有 ${changed.length} 步不同（单步重锚只许恰一步）`);
  }
  const idx = changed[0];
  return { eventIndex: idx, stepId: cand[idx].stepId, intentId: cand[idx].intentId ?? null };
}

// ── journal 不可变核（互绑用）────────────────────────────────────────────────
// journal 在封账后还会被复核补状态（reverified），文件整体哈希会变；故互绑除了记「封账那一刻
// 的文件哈希」外，另记一份**不可变核**哈希——事务事实（登记目标/候选/绑定/开账时刻）永不变，
// 复核端可现算比对，真正做到「换了内容就对不上」。
// D14 ②：`baseline` 进核 —— 提案台账登记行与 heal 前基线 verdict 的字节哈希一旦入核，
// 复核端现算核哈希就能识破「事后换基线/换台账行」这类隐藏新回归的手法。
const JOURNAL_CORE_KEYS = [
  'schemaVersion', 'artifactKind', 'caseId', 'stepId', 'intentId', 'tsToken',
  'openedAt', 'candidate', 'binding', 'baseline', 'targets',
];

export function journalCoreSha256(journal) {
  const core = {};
  for (const k of JOURNAL_CORE_KEYS) core[k] = journal[k] === undefined ? null : journal[k];
  return sha256Of(Buffer.from(JSON.stringify(core), 'utf8'));
}

// ── 绑定链闭合（D13 codex 5）────────────────────────────────────────────────
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** 台账登记的提案补丁（字节须与登记 patchSha256 一致，否则整条登记不可信）。 */
function ledgerProposalPatch(row) {
  const p = typeof row.patchPath === 'string' ? row.patchPath : null;
  if (!p || !existsSync(p)) return null;
  if (typeof row.patchSha256 !== 'string' || sha256File(p) !== row.patchSha256) return null;
  try {
    const doc = JSON.parse(readFileSync(p, 'utf8'));
    return isObj(doc) ? doc : null;
  } catch { return null; }
}

/**
 * 找到本次晋升所凭的**已签补丁**，并证明它挂在台账某条证据元组登记行上。
 * `--patch` 显式同传时只认该件；缺省时在同一 drift 目录内按 caseId/stepId 关联。
 * 回 { patch, row }：row 即那条证据元组登记行（D14 ② 要冻进事务核的就是它的字节哈希）。
 */
function resolveSignedPatch({ driftDir, caseId, target, patchPathOpt, rows }) {
  let files;
  if (nonEmptyStr(patchPathOpt)) {
    files = [resolve(patchPathOpt)];
  } else {
    files = (existsSync(driftDir) ? readdirSync(driftDir) : [])
      .filter((f) => f.startsWith(`${caseId}.`) && /\.patch[^/\\]*\.json$/.test(f))
      .sort()
      .map((f) => join(driftDir, f));
  }
  const proposals = rows.map((row) => ({ row, doc: ledgerProposalPatch(row) })).filter((x) => x.doc);
  if (!proposals.length) {
    throw new HealPromoteError(PROMOTE_REJECT.LINEAGE_UNBOUND,
      '本步在台账里的登记行指不到可信提案补丁（文件缺席或字节与 patchSha256 失配）');
  }
  for (const f of files) {
    let doc = null;
    try { doc = JSON.parse(readFileSync(f, 'utf8')); } catch { continue; }
    if (!isObj(doc) || doc.caseId !== caseId || doc.stepId !== target.stepId) continue;
    if (doc.patchKind !== 'relocate' || !canApply(doc)) continue;
    // 已签件必须与某条台账登记的提案同定位面同底座——这才叫「补丁挂在证据元组上」。
    const bound = proposals.find((p) => sameJson(p.doc.locatorBefore, doc.locatorBefore)
      && sameJson(p.doc.locatorAfter, doc.locatorAfter)
      && sameJson(p.doc.specTarget, doc.specTarget));
    if (bound) return { patch: doc, row: bound.row };
  }
  throw new HealPromoteError(PROMOTE_REJECT.LINEAGE_UNBOUND,
    '找不到「已过人签闸且与台账证据元组登记行同定位面」的补丁（晋升绑定链未闭合）');
}

/**
 * 绑定链闭合主入口：候选与现役 events 的恰一差异，必须**正是**已签补丁指定步的定位字段变更。
 * 校验方式不靠比字段名单，而是拿现役 events 逐字重放一次补丁的 locatorAfter（复用 S4 的同一
 * 纯函数 applyLocatorToEvent），要求逐字节等于候选的那一步——多改一个字节都对不上。
 */
export function assertCandidateBoundToSignedPatch({
  driftDir, caseId, currentDoc, candidateDoc, target, patchPathOpt,
}) {
  // 台账破损（HealLedgerError）在晋升面同样是「绑定链不可证」，就地转成具名晋升阻断——
  // 不让它穿到 catch-all 变成 exit 1 内部错误（那会把可解释的拒付伪装成崩溃）。
  const ledgerPath = ledgerPathOf(driftDir, caseId);
  let all;
  try {
    all = readLedger(ledgerPath);
  } catch (e) {
    throw new HealPromoteError(PROMOTE_REJECT.LINEAGE_UNBOUND,
      `证据元组台账不可读（${e && e.reason ? e.reason : 'ledger unreadable'}），晋升绑定链不可证`);
  }
  const rows = all
    .filter((r) => isObj(r) && r.kind === 'proposal' && r.caseId === caseId && r.stepId === target.stepId);
  if (!rows.length) {
    throw new HealPromoteError(PROMOTE_REJECT.LINEAGE_UNBOUND,
      `台账内无步 ${target.stepId} 的证据元组登记行，晋升无据可凭`);
  }
  const { patch, row } = resolveSignedPatch({ driftDir, caseId, target, patchPathOpt, rows });
  const idx = target.eventIndex;
  const st = isObj(patch.specTarget) ? patch.specTarget : {};
  if (st.eventIndex !== idx) {
    throw new HealPromoteError(PROMOTE_REJECT.DIFF_UNBOUND,
      `候选唯一差异落在第 ${idx} 步，与已签补丁 specTarget.eventIndex 不符`);
  }
  const rebuilt = applyLocatorToEvent(currentDoc.events[idx], patch.locatorAfter);
  if (!sameJson(rebuilt, candidateDoc.events[idx])) {
    throw new HealPromoteError(PROMOTE_REJECT.DIFF_UNBOUND,
      '候选的那一步不等于「现役 events 该步 + 已签补丁 locatorAfter」的逐字重放结果');
  }
  // 台账行的字节哈希按其规范 JSON 文本算（台账逐行写读同形，跨进程可重算）。
  return {
    patch,
    stepId: patch.stepId,
    ledgerPath,
    ledgerRowSha256: sha256Of(Buffer.from(JSON.stringify(row), 'utf8')),
    // D14 ②补：证据元组里那份 verdict 的字节哈希——晋升前置全验据此钉死「基线必须正是它」。
    evidenceVerdictSha256: isObj(row.evidence) ? row.evidence.verdictSha256 : null,
  };
}

/**
 * 前置全验（浏览器/字节都还没动的阶段）。任一不满足抛 HealPromoteError → 调用方 exit 6。
 * 回本次事务的全部事实：候选、events、冻结绑定件与目标步。
 */
export function precheckPromotion({ outDir, caseId, candidatePath, patchPathOpt }) {
  const driftDir = driftDirOf(outDir);
  const stale = scanUnsealedJournalsAnchored({ driftDir, caseDir: casePaths(caseId).dir });
  if (stale.length) {
    throw new HealPromoteError(PROMOTE_REJECT.UNSEALED_JOURNAL,
      `发现未封晋升 journal（含回滚中断）：${stale.join(', ')}`);
  }

  const candidateAbs = resolve(candidatePath);
  const candidateDoc = readJsonOr(candidateAbs, PROMOTE_REJECT.CANDIDATE_INVALID, '候选 events');
  if (candidateDoc.caseId !== caseId) {
    throw new HealPromoteError(PROMOTE_REJECT.CANDIDATE_INVALID,
      '候选 events 的 caseId 与实参不一致（原值不回显）');
  }
  const candidateSha = sha256File(candidateAbs);

  const paths = casePaths(caseId);
  const eventsPath = resolve(paths.events);
  if (!existsSync(eventsPath)) {
    throw new HealPromoteError(PROMOTE_REJECT.CANDIDATE_INVALID, '本 case 的 events 底座不在场');
  }
  const eventsSha = sha256File(eventsPath);
  const currentDoc = readJsonOr(eventsPath, PROMOTE_REJECT.CANDIDATE_INVALID, 'events');

  // 冻结绑定件（受晋升影响的重签面）：人签把它钉在某份 events 字节上，晋升前必须已改签到候选。
  const locksPath = resolve(paths.entityLocks);
  const locks = readJsonOr(locksPath, PROMOTE_REJECT.RESIGN_MISSING, '冻结绑定件 entity-locks.frozen.json');
  if (locks.signed !== true || !nonEmptyStr(locks.signerId) || !nonEmptyStr(locks.signedAt)) {
    throw new HealPromoteError(PROMOTE_REJECT.RESIGN_MISSING,
      '冻结绑定件未签（signed/signerId/signedAt 三件须齐全）');
  }
  const boundSha = typeof locks.eventsSha256 === 'string'
    ? locks.eventsSha256.replace(/^sha256:/, '') : null;
  if (boundSha !== candidateSha) {
    // 两种失配一律晋升阻断，但具名分流：仍钉旧字节=重签缺失；钉别的字节=候选与人签绑定失配。
    throw boundSha === eventsSha
      ? new HealPromoteError(PROMOTE_REJECT.RESIGN_MISSING,
        '冻结绑定件仍钉在 heal 前的旧 events 字节上（重签件未就位）')
      : new HealPromoteError(PROMOTE_REJECT.CANDIDATE_SHA256_MISMATCH,
        '候选 sha256 与人签绑定的字节不一致（候选被改动或绑定指向他物）');
  }

  // 冻结断言契约（同属受影响冻结面）：未签则回放前置闸本就拒算数，晋升没有意义。
  const expectedPath = resolve(paths.expected);
  if (existsSync(expectedPath)) {
    const expectedDoc = readJsonOr(expectedPath, PROMOTE_REJECT.FROZEN_CONTRACT_UNSIGNED, 'expected.frozen.json');
    const signCheck = assertSignedContract(expectedDoc);
    if (!signCheck.ok) {
      throw new HealPromoteError(PROMOTE_REJECT.FROZEN_CONTRACT_UNSIGNED,
        `冻结断言契约未签（${signCheck.problems.length} 项）`);
    }
  }

  // D14 ②：heal 前基线 verdict 是复核端判「非目标步有无新回归」的唯一对照底座；
  // 它不在场就冻不出基线绑定，复核端也就无从证明基线未被替换 —— 整体拒，一个字节都不换。
  const baselinePath = baselineVerdictPathOf(paths.dir);
  if (!existsSync(baselinePath)) {
    throw baselineUnbound('heal 前基线 verdict.json 不在场，冻不出基线绑定（复核端将无从证明基线未被替换）');
  }

  const target = diffSingleStep(currentDoc, candidateDoc);
  // D13 codex 5：晋升绑定链闭合——恰一差异必须正是已签补丁指定步的定位字段变更，
  // 且该补丁在证据元组台账里有登记行。缺任一环整体拒（一个字节都不换）。
  // 闭合后的 stepId 与 target.stepId 恒等（补丁按 stepId 筛出），故不另回一份重复事实。
  const bound = assertCandidateBoundToSignedPatch({
    driftDir, caseId, currentDoc, candidateDoc, target, patchPathOpt,
  });
  // D14 ②补：晋升所用基线必须**正是**证据元组里那份 verdict —— 台账行 evidence.verdictSha256
  // 与当下基线字节不等（或压根没这份哈希）即「晋升前换了基线」，整体拒：零改动、零 journal。
  const baselineSha = sha256File(baselinePath);
  if (bareSha(bound.evidenceVerdictSha256) !== baselineSha) {
    throw baselineUnbound(
      '当下基线 verdict 字节与台账证据元组登记的 verdictSha256 不一致（提案后基线被替换，或登记行缺该哈希）');
  }
  return {
    driftDir,
    baseline: {
      verdictPath: baselinePath,
      verdictSha256: `sha256:${baselineSha}`,
      ledgerPath: bound.ledgerPath,
      ledgerRowSha256: `sha256:${bound.ledgerRowSha256}`,
    },
    caseDir: paths.dir,
    candidatePath: candidateAbs,
    candidateSha,
    candidateBytes: readFileSync(candidateAbs),
    eventsPath,
    eventsSha,
    locksPath,
    locksSha: sha256File(locksPath),
    locksBytes: readFileSync(locksPath),
    locksSignerId: locks.signerId,
    locksSignedAt: locks.signedAt,
    target,
  };
}

/**
 * S5 主入口：五步事务晋升。前置全验已通过才动第一个字节。
 * 回 { journalPath, receiptPath, stepId, eventsSha256Before/After }。
 */
export function promoteCandidate({ outDir, caseId, candidatePath, tsToken, patchPathOpt }) {
  // D13 codex 6：整个「查了再动」的窗口都在 per-case 独占锁内，锁锚定 case 根。
  const lockPath = acquirePromoteLock(casePaths(caseId).dir);
  try {
    return promoteUnderLock({ outDir, caseId, candidatePath, tsToken, patchPathOpt });
  } finally {
    releasePromoteLock(lockPath);
  }
}

function promoteUnderLock({ outDir, caseId, candidatePath, tsToken, patchPathOpt }) {
  const f = precheckPromotion({ outDir, caseId, candidatePath, patchPathOpt });
  const { driftDir } = f;
  // D13 codex 7（前半）：开账前先在锁内确认现役 events 仍是前置全验读到的那份字节。
  // 放在开账前是为了兑现「不一致 → 中止零改动」：此刻既无 journal、也无预存副本，
  // 中止就是真正的一个字节都没动（开账后的同名复核见步骤 ②）。
  if (sha256File(f.eventsPath) !== f.eventsSha) {
    throw new HealPromoteError(PROMOTE_REJECT.EVENTS_MOVED,
      '锁内复核发现现役 events 字节已变（前置全验的读取已过时），零改动中止');
  }
  mkdirSync(driftDir, { recursive: true });
  const journalPath = journalPathOf(driftDir, caseId, tsToken);
  const receiptPath = receiptPathOf(driftDir, caseId, tsToken);
  const at = isoOf(tsToken);

  // D14 ③：先独占预留 journal 落点 —— 同 caseId + out-dir + ts 的第二次晋升在**这里**就撞
  // 碰撞拒：此刻预存副本还没建、目标一个字节都没动，审计链也就不可能被覆写。
  reserveExclusive(journalPath, '晋升 journal');

  // ① 逐件预存副本 + 登记全部将改目标（events + 受影响绑定），随后写开账 journal。
  const eventsBackup = backupPathOf(driftDir, caseId, tsToken, 'events');
  const locksBackup = backupPathOf(driftDir, caseId, tsToken, 'entity-locks');
  try {
    copyExclusive(f.eventsPath, eventsBackup, 'events 预存副本');
    copyExclusive(f.locksPath, locksBackup, '绑定件预存副本');
  } catch (e) {
    // 预留只撤自己刚占的那一位；此刻仍是零目标改动，撤完照常整体拒。
    discardReservation(journalPath);
    throw e;
  }
  const journal = {
    schemaVersion: 1,
    artifactKind: 'heal-promote-journal',
    caseId,
    stepId: f.target.stepId,
    intentId: f.target.intentId,
    tsToken: String(tsToken),
    status: 'open',
    sealed: false,
    openedAt: at,
    sealedAt: null,
    candidate: { path: f.candidatePath, sha256: `sha256:${f.candidateSha}` },
    binding: {
      path: f.locksPath,
      sha256: `sha256:${f.locksSha}`,
      signerId: f.locksSignerId,
      signedAt: f.locksSignedAt,
    },
    // D14 ②：提案台账登记行 + heal 前基线 verdict 的字节哈希，一并冻进不可变核。
    baseline: f.baseline,
    // 顺序即事务顺序；回滚按本数组**逆序**逐件恢复（对称，无半回滚路径）。
    targets: [
      {
        role: 'events',
        path: f.eventsPath,
        sha256Before: `sha256:${f.eventsSha}`,
        sha256After: `sha256:${f.candidateSha}`,
        backup: eventsBackup,
      },
      {
        role: 'entity-locks-frozen',
        path: f.locksPath,
        sha256Before: `sha256:${f.locksSha}`,
        sha256After: `sha256:${f.locksSha}`,
        backup: locksBackup,
      },
    ],
    steps: [{ step: 1, name: 'journal-open', at }],
    rollback: null,
  };
  writeFileSync(journalPath, jsonText(journal), 'utf8');
  // D13 codex 8（前半）：case 根落事务指针 —— 未封 journal 的扫描从此不随 --out-dir 漂移。
  registerJournalPointer(f.caseDir, journalPath);

  const record = (step, name) => {
    journal.steps.push({ step, name, at });
    writeFileSync(journalPath, jsonText(journal), 'utf8');
  };

  try {
    // ② 重签件就位复核（开账后再核一次：开账与换字节之间的窗口不留 TOCTOU）。
    if (sha256File(f.locksPath) !== f.locksSha || sha256File(f.candidatePath) !== f.candidateSha) {
      throw new HealPromoteError(PROMOTE_REJECT.CANDIDATE_SHA256_MISMATCH,
        '开账后候选/绑定件字节发生变化，事务中止');
    }
    // D13 codex 7（后半）：切换前重验现役 events 与 **journal 登记的前哈希** 一致。
    if (sha256File(f.eventsPath) !== journal.targets[0].sha256Before.replace(/^sha256:/, '')) {
      throw new HealPromoteError(PROMOTE_REJECT.EVENTS_MOVED,
        '现役 events 与 journal 登记的前哈希不一致，事务中止');
    }
    record(2, 'resigned-binding-verified');

    // ③ events 单 rename 切换（候选字节整份就位，绝不逐字段改写现役件）。
    atomicWrite(f.eventsPath, f.candidateBytes);
    if (sha256File(f.eventsPath) !== f.candidateSha) {
      throw new HealPromoteError(PROMOTE_REJECT.CANDIDATE_SHA256_MISMATCH,
        'events 切换后字节与候选不符，事务中止');
    }
    record(3, 'events-switched');

    // ④ 绑定发布：人签字节原样 republish（内容一字不改，只把「已生效」这一刻纳入事务窗口）。
    atomicWrite(f.locksPath, f.locksBytes);
    if (sha256File(f.locksPath) !== f.locksSha) {
      throw new HealPromoteError(PROMOTE_REJECT.RESIGN_MISSING,
        '绑定发布后字节与人签件不符，事务中止');
    }
    record(4, 'binding-published');
  } catch (e) {
    // 中途失败即按 journal 对称回滚；回滚成功仍是晋升阻断（exit 6），失败则留未封 journal。
    rollbackJournal({ journalPath, reason: e instanceof HealPromoteError ? e.reason : 'HEAL_PROMOTE_ABORTED', tsToken });
    throw e instanceof HealPromoteError
      ? e
      : new HealPromoteError(PROMOTE_REJECT.JOURNAL_BROKEN, '晋升事务异常中止，已按 journal 对称回滚');
  }

  // ⑤ HealReceipt 落盘 → 封 journal（D13 codex 8 后半：journal ↔ receipt 互绑）。
  const journalSha = sha256File(journalPath);
  const journalCore = journalCoreSha256(journal);
  const receipt = {
    schemaVersion: 1,
    artifactKind: 'heal-receipt',
    kind: 'promote',
    caseId,
    stepId: f.target.stepId,
    intentId: f.target.intentId,
    tsToken: String(tsToken),
    outcome: 'promoted',
    promotedAt: at,
    candidate: { path: f.candidatePath, sha256: `sha256:${f.candidateSha}` },
    events: {
      path: f.eventsPath,
      sha256Before: `sha256:${f.eventsSha}`,
      sha256After: `sha256:${f.candidateSha}`,
    },
    binding: journal.binding,
    // D14 ②：基线绑定同样进 receipt —— 收据自身就带着「复核该拿哪份基线字节对照」的事实。
    baseline: journal.baseline,
    journalPath,
    // receipt 侧记 journal：封账那一刻的文件哈希 + 永不变的事务核哈希（复核端可现算）。
    journalSha256: `sha256:${journalSha}`,
    journalCoreSha256: `sha256:${journalCore}`,
    nextAction: 'casey heal <caseId> --reverify --receipt <本件>（真 replay→真 verdict 链复核）',
  };
  // receipt 同样独占落盘（D14 ③）。此刻目标字节已换，故落点撞车按事务纪律对称回滚后再拒，
  // 绝不留「已换字节但无收据」的半成事务。
  try {
    writeExclusive(receiptPath, jsonText(receipt), 'HealReceipt');
  } catch (e) {
    rollbackJournal({ journalPath, reason: e instanceof HealPromoteError ? e.reason : 'HEAL_PROMOTE_ABORTED', tsToken });
    throw e;
  }
  // journal 侧记 receipt 内容哈希；两侧互指且各自钉死对方字节 —— 换任一件都对不上。
  journal.receiptPath = receiptPath;
  journal.receiptSha256 = `sha256:${sha256File(receiptPath)}`;
  journal.sealedJournalSha256 = `sha256:${journalSha}`;
  journal.journalCoreSha256 = `sha256:${journalCore}`;
  journal.status = 'promoted';
  journal.sealed = true;
  journal.sealedAt = at;
  journal.steps.push({ step: 5, name: 'receipt-sealed', at });
  writeFileSync(journalPath, jsonText(journal), 'utf8');
  clearJournalPointer(f.caseDir, journalPath);

  return {
    journalPath,
    receiptPath,
    stepId: f.target.stepId,
    eventsPath: f.eventsPath,
    eventsSha256Before: f.eventsSha,
    eventsSha256After: f.candidateSha,
  };
}

/**
 * 对称回滚：按 journal 登记的**全部**目标逆序逐件恢复 + 逐件 sha256 断言，
 * 回滚过程自身入 journal 并以 `rolled-back` 封账。任一件恢复不成 → 保持未封（fail-closed）。
 */
export function rollbackJournal({ journalPath, reason, tsToken }) {
  const journal = readJournal(journalPath);
  const at = isoOf(tsToken);
  // 回滚期 journal 重回未封态：case 根同样要挂指针，否则「回滚中断」这一未封态在
  // 换了 --out-dir 的下一次调用里就看不见了（D13 codex 8）。
  const caseDir = nonEmptyStr(journal.caseId) ? casePaths(journal.caseId).dir : null;
  if (caseDir && existsSync(caseDir)) registerJournalPointer(caseDir, journalPath);
  journal.status = 'rolling-back';
  journal.sealed = false;
  journal.rollback = { reason: reason || null, startedAt: at, restored: [], completedAt: null };
  writeFileSync(journalPath, jsonText(journal), 'utf8');

  const targets = journal.targets.slice().reverse();
  for (const t of targets) {
    const path = t && typeof t.path === 'string' ? t.path : null;
    const backup = t && typeof t.backup === 'string' ? t.backup : null;
    const want = typeof t?.sha256Before === 'string' ? t.sha256Before.replace(/^sha256:/, '') : null;
    if (!path || !backup || !want || !existsSync(backup)) {
      throw new HealPromoteError(PROMOTE_REJECT.ROLLBACK_FAILED,
        'journal 登记目标缺 path/backup/sha256Before，无法对称恢复（journal 保持未封）');
    }
    atomicWrite(path, readFileSync(backup));
    const got = sha256File(path);
    if (got !== want) {
      throw new HealPromoteError(PROMOTE_REJECT.ROLLBACK_FAILED,
        '登记目标恢复后 sha256 与晋升前不符（journal 保持未封，转人工）');
    }
    journal.rollback.restored.push({ path, sha256: `sha256:${got}` });
    writeFileSync(journalPath, jsonText(journal), 'utf8');
  }

  journal.rollback.completedAt = at;
  journal.status = 'rolled-back';
  journal.sealed = true;
  journal.sealedAt = at;
  journal.steps = Array.isArray(journal.steps) ? journal.steps : [];
  journal.steps.push({ step: journal.steps.length + 1, name: 'rolled-back-sealed', at });
  writeFileSync(journalPath, jsonText(journal), 'utf8');
  if (caseDir) clearJournalPointer(caseDir, journalPath);
  return { journalPath, restored: journal.rollback.restored };
}

/** 复核通过后给 journal 补终局状态（仍是封账态，只把「已复核」写进账）。 */
export function markJournalReverified({ journalPath, tsToken, receiptPath }) {
  const journal = readJournal(journalPath);
  const at = isoOf(tsToken);
  journal.status = 'reverified';
  journal.sealed = true;
  journal.sealedAt = at;
  journal.reverifyReceiptPath = receiptPath || null;
  journal.steps = Array.isArray(journal.steps) ? journal.steps : [];
  journal.steps.push({ step: journal.steps.length + 1, name: 'reverified-sealed', at });
  writeFileSync(journalPath, jsonText(journal), 'utf8');
  return journalPath;
}
