// lib/heal/reverify.mjs —— S6 晋升后复核编排（零 LLM；裁定由冻结裁判出，本模块只编排）。
//
// GRILL D6「healed→PASS 权威」：复核只认**真 replay → 真 verdict 链**产出的 verdict.json。
//   · 回放半边（现役共用身份门 / 语义定位 / 只读漂移探针 / 观察原语 / 三轴投影）在
//     `lib/heal/reverify-replay.mjs`，逐条来源见该模块头注；
//   · 裁定走现役冻结裁判子进程边界 `lib/teachin/verdict-cli-adapter.mjs`（带冻结锚校验）。
//   本模块**绝不合成 verdict 字节**，也绝不在证不出时替裁判下结论（护栏 #14/#15）。
//
// 运行时来源（GRILL D13 ②「复核 v1 收缩为 hermetic 专用」）：`CASEY_HEAL_RUNTIME_SEAM=<module>`
// 必须在场，且**解析后的绝对路径必须落在本仓 `tests/` 目录下**（越界拒载）。生产调用（无 seam）
// 一律 `exit 64` + 具名说明「v1 复核仅 hermetic，真机复核 route:human」——与 S0 热路径证伪、
// D3 变更型 route:human 自洽，不留「复核绿冒充真机等价」的窗口。
// **裁定语义不受该变量影响**，它只决定「运行时从哪来」。
//
// D13 ③：本模块的复核编排定性为「hermetic 弱回放模拟」，不宣称与正式回放同姿势装配；
// 故复核**不得多读生产回放不读的键**——`within` 在复核侧一个字都不消费（它只作为候选文件里的
// 前向兼容注记与人签绑定的字节差存在，见 lib/heal/apply.mjs）。正式同装配复核挂账后继契约。
//
// 复核准入（D3 v4）：签署 `cases/<caseId>/reset-proof.json` 验真才准整案重放——
//   无件 = 合法未证明 → route:human（receipt 记之，命令仍成功）；
//   字段残缺 / caseId·resetPlanDigest·sutBuildDigest 失配 = 可疑输入 → 拒（畸形面 fail-closed）。
//   调用方任何布尔/旗标自报一律无效。签署真实性沿现役人签信任模型，不虚标防伪强度（ADR-0010）。
//
// 通过标准（D3 codex delta）：目标步转 `PASS` **且**对照 heal 前基线 verdict 全案无任何
// 非目标步「绿 → 非绿」新回归；违反即 FAILED → 按 journal 对称回滚（S5 同一实现）。
//
// GRILL D14（代码 delta 轮）在本模块落地两条：
//   · ① 锁面统一：复核**及其回滚路径**在进入编排前先拿与晋升同一把 per-case 独占锁
//     （lib/heal/promote-tx.mjs 单一实现），晋升-复核-回滚全程互斥；拿不到锁沿用晋升面
//     既有锁拒因语义具名拒（不另造第二套词表）。
//   · ② 基线绑定：跑复核前先验当下基线 verdict 字节的 sha256 与 journal 不可变核记的一致，
//     不一致即「提案后基线被替换」（非目标步的新回归会因此被藏起来）→ 具名拒 exit 65。
//     纪律是**先验哈希再用**：验过的那一份字节直接拿来当对照底座，不再二次读盘。

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalVerdictCliAdapter } from '../teachin/verdict-cli-adapter.mjs';
import { assertSignedContract } from '../sign-gate.mjs';
import { replayPromotedSpec } from './reverify-replay.mjs';
import { PROJECT_ROOT, casePaths } from '../paths.mjs';
import { driftDirOf, sha256File } from './drift-patch.mjs';
import {
  baselineVerdictPathOf, journalCoreSha256, markJournalReverified, readJournal, rollbackJournal,
} from './promote.mjs';
import {
  HealPromoteError, acquirePromoteLock, releasePromoteLock, writeExclusive,
} from './promote-tx.mjs';

export const REVERIFY_REJECT = {
  RECEIPT_INVALID: 'HEAL_RECEIPT_INVALID',
  PROMOTION_NOT_IN_FORCE: 'HEAL_PROMOTION_NOT_IN_FORCE',
  FROZEN_CONTRACT_UNSIGNED: 'HEAL_FROZEN_CONTRACT_UNSIGNED',
  RESET_PROOF_ABSENT: 'HEAL_RESET_PROOF_ABSENT',
  RESET_PROOF_INVALID: 'HEAL_RESET_PROOF_INVALID',
  RUNTIME_UNAVAILABLE: 'HEAL_REVERIFY_RUNTIME_UNAVAILABLE',
  REPLAY_FAILED: 'HEAL_REVERIFY_REPLAY_FAILED',
  VERDICT_FAILED: 'HEAL_REVERIFY_VERDICT_FAILED',
  BASELINE_MISSING: 'HEAL_BASELINE_VERDICT_MISSING',
  BASELINE_UNBOUND: 'HEAL_BASELINE_VERDICT_UNBOUND',
  HERMETIC_ONLY: 'HEAL_REVERIFY_HERMETIC_ONLY',
  SEAM_OUT_OF_TREE: 'HEAL_REVERIFY_SEAM_OUT_OF_TREE',
  JOURNAL_RECEIPT_UNBOUND: 'HEAL_JOURNAL_RECEIPT_UNBOUND',
};

/** kind：'malformed'（65）/ 'blocked'（6）/ 'usage'（64）。route:human 与复核失败不走本异常。 */
export class HealReverifyError extends Error {
  constructor(reason, detail, kind = 'malformed') {
    super(`${reason}: ${detail}`);
    this.reason = reason;
    this.detail = detail;
    this.kind = kind;
  }
}

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const nonEmptyStr = (v) => typeof v === 'string' && v.length > 0;
const jsonText = (v) => `${JSON.stringify(v, null, 2)}\n`;
const isoOf = (ts) => new Date(Number(ts)).toISOString();
const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export const reverifyReceiptPathOf = (driftDir, caseId, ts) =>
  join(driftDir, `${caseId}.${ts}.reverify.heal-receipt.json`);

function readJsonOr(path, reason, label, kind = 'malformed') {
  if (!existsSync(path)) throw new HealReverifyError(reason, `${label} 不在场`, kind);
  try {
    const doc = JSON.parse(readFileSync(path, 'utf8'));
    if (!isObj(doc)) throw new Error('non-object');
    return doc;
  } catch {
    throw new HealReverifyError(reason, `${label} 不是合法 JSON 对象（内容不回显）`, kind);
  }
}

// ── 复位证明门（D3 v4）────────────────────────────────────────────────────────
/**
 * 回 { present:false } —— 无件（合法未证明 → route:human）；
 *    { present:true, ok:true } —— 验真通过；
 *    抛 HealReverifyError —— 字段残缺 / caseId·digest 失配（可疑输入，fail-closed）。
 * 只做确定性字段校验：签名密码学威胁面按 ADR-0010 后置，不虚标防伪强度。
 */
export function admitResetProof({ caseId, proofPath }) {
  if (!existsSync(proofPath)) return { present: false };
  const proof = readJsonOr(proofPath, REVERIFY_REJECT.RESET_PROOF_INVALID, 'reset-proof.json');
  const bad = (detail) => {
    throw new HealReverifyError(REVERIFY_REJECT.RESET_PROOF_INVALID, detail);
  };
  if (proof.caseId !== caseId) bad('reset-proof.caseId 与本 case 不一致（原值不回显）');
  for (const key of ['resetPlanDigest', 'sutBuildDigest']) {
    if (!nonEmptyStr(proof[key])) bad(`reset-proof 缺 ${key}`);
    if (!DIGEST_RE.test(proof[key])) bad(`reset-proof.${key} 不是 sha256:<64 位十六进制> 摘要`);
  }
  if (!nonEmptyStr(proof.signerId)) bad('reset-proof 缺 signerId（人签责任落点）');
  if (!nonEmptyStr(proof.signedAt) || !ISO_RE.test(proof.signedAt)) {
    bad('reset-proof 缺 signedAt 或非 ISO 8601');
  }
  if (!nonEmptyStr(proof.statement)) bad('reset-proof 缺 statement（可复位/幂等的书面陈述）');
  return { present: true, ok: true, signerId: proof.signerId, signedAt: proof.signedAt };
}

// ── 运行时来源（可注入接缝）──────────────────────────────────────────────────
function pickOpenRuntime(mod) {
  if (typeof mod?.openRuntime === 'function') return mod.openRuntime;
  if (typeof mod?.createRuntimeBootstrap === 'function') {
    const built = mod.createRuntimeBootstrap({});
    if (typeof built?.openRuntime === 'function') return built.openRuntime;
  }
  if (typeof mod?.default?.openRuntime === 'function') return mod.default.openRuntime;
  return null;
}

/**
 * hermetic 专用门（D13 ②）。回接缝的绝对路径；两种不合格一律 kind='usage' → exit 64：
 *   · 无 seam = 生产调用 —— v1 复核只做 hermetic，真机复核 route:human；
 *   · seam 解析后越出本仓 tests/ —— 拒载（门禁形与冻结金牌兼容：金牌 seam 即在 tests/ 下）。
 * 路径判定按目录前缀比较（`tests` + 分隔符），杜绝 `tests-evil/` 这类同前缀旁目录蒙混。
 */
export function admitReverifySeam({ seamPath }) {
  if (!nonEmptyStr(seamPath)) {
    throw new HealReverifyError(REVERIFY_REJECT.HERMETIC_ONLY,
      'v1 复核仅 hermetic：须经 CASEY_HEAL_RUNTIME_SEAM 注入本仓 tests/ 下的运行时接缝；'
      + '真机复核在 v1 一律 route:human（GRILL D13 ②，与 S0 热路径证伪、D3 变更型自洽）',
      'usage');
  }
  // 先解析真实路径再判门禁：只比 resolve() 的话，tests/ 下挂一枚指向仓外的符号链接就能绕过。
  // 门禁基准同样取真实路径（仓自身若落在链接下，两边一起归一才比得准）。
  let abs = resolve(seamPath);
  try { abs = realpathSync(abs); } catch { /* 件不在场：留 resolve 值，后面的加载会闭合拒 */ }
  let root = PROJECT_ROOT;
  try { root = realpathSync(PROJECT_ROOT); } catch { /* 仓根不可解析时退回原值 */ }
  const gate = join(root, 'tests') + sep;
  if (!abs.startsWith(gate)) {
    throw new HealReverifyError(REVERIFY_REJECT.SEAM_OUT_OF_TREE,
      'CASEY_HEAL_RUNTIME_SEAM 解析后的绝对路径不在本仓 tests/ 目录下，拒载（路径不回显）',
      'usage');
  }
  return abs;
}

/** 打开复核运行时：只认过门禁的 hermetic 接缝，生产真浏览器链路在 v1 不接。 */
export async function openReverifyRuntime({ seamPath }) {
  const abs = admitReverifySeam({ seamPath });
  let mod;
  try {
    mod = await import(pathToFileURL(abs).href);
  } catch {
    throw new HealReverifyError(REVERIFY_REJECT.RUNTIME_UNAVAILABLE, '复核运行时接缝模块不可加载');
  }
  const open = pickOpenRuntime(mod);
  if (!open) {
    throw new HealReverifyError(REVERIFY_REJECT.RUNTIME_UNAVAILABLE, '接缝模块未导出 openRuntime');
  }
  const opened = await open({ role: 'distilled', executionTargetAuthority: null });
  if (opened?.ok !== true || !isObj(opened.runtime)) {
    throw new HealReverifyError(REVERIFY_REJECT.RUNTIME_UNAVAILABLE, '接缝运行时未开成');
  }
  return opened.runtime;
}

async function closeRuntime(runtime) {
  for (const owner of [runtime?.context, runtime?.browser]) {
    try { await owner?.close?.(); } catch { /* 关闭失败不改判定 */ }
  }
}

// ── 通过标准（D3 codex delta）────────────────────────────────────────────────
/** 目标步 PASS ∧ 全案无非目标步「绿→非绿」新回归。 */
export function judgeReverification({ baseline, current, stepId }) {
  const before = new Map((baseline.steps || []).map((s) => [s.stepId, s.verdict]));
  const after = new Map((current.steps || []).map((s) => [s.stepId, s.verdict]));
  const targetBefore = before.get(stepId) ?? null;
  const targetAfter = after.get(stepId) ?? null;
  const regressions = [];
  for (const [sid, was] of before) {
    if (sid === stepId) continue;
    const now = after.has(sid) ? after.get(sid) : null;
    if (was === 'PASS' && now !== 'PASS') regressions.push({ stepId: sid, before: was, after: now });
  }
  return {
    passed: targetAfter === 'PASS' && regressions.length === 0,
    targetStep: { stepId, before: targetBefore, after: targetAfter },
    regressions,
  };
}

// ── journal ↔ receipt 互绑（D13 codex 8）──────────────────────────────────────
const bareSha = (v) => (typeof v === 'string' ? v.replace(/^sha256:/, '') : null);

/** 任一面对不上 → 畸形面 fail-closed（exit 65）：不在无绑定的账上跑回滚。 */
export function assertJournalReceiptBound({ journal, receipt, receiptPath }) {
  const bad = (detail) => {
    throw new HealReverifyError(REVERIFY_REJECT.JOURNAL_RECEIPT_UNBOUND, detail);
  };
  const rj = bareSha(receipt.journalSha256);
  const rc = bareSha(receipt.journalCoreSha256);
  const jr = bareSha(journal.receiptSha256);
  if (!rj || !rc || !jr) bad('journal/receipt 缺互绑哈希字段（journalSha256/journalCoreSha256/receiptSha256）');
  if (rj !== bareSha(journal.sealedJournalSha256)) {
    bad('receipt 记的封账 journal 哈希与 journal 自记的不一致');
  }
  if (rc !== journalCoreSha256(journal)) {
    bad('receipt 记的事务核哈希与现役 journal 现算的核哈希不一致（journal 内容被改）');
  }
  if (jr !== sha256File(receiptPath)) {
    bad('journal 记的 receipt 内容哈希与 receipt 文件实际字节不一致（收据被改）');
  }
}

// ── 基线绑定复验（D14 ②）──────────────────────────────────────────────────────
/**
 * 先验哈希再用：读一次基线 verdict 字节 → 比 journal 不可变核冻的哈希 → 才拿来当对照底座。
 * 无绑定 / 件缺席 / 字节被换一律畸形面 fail-closed（exit 65），绝不在可疑基线上判「无新回归」。
 */
export function admitBaselineVerdict({ journal, baselinePath }) {
  const want = bareSha(journal?.baseline?.verdictSha256);
  if (!want) {
    throw new HealReverifyError(REVERIFY_REJECT.BASELINE_UNBOUND,
      'journal 不可变核未冻结基线 verdict 绑定，拒在无绑定的基线上判「有无非目标步新回归」');
  }
  if (!existsSync(baselinePath)) {
    throw new HealReverifyError(REVERIFY_REJECT.BASELINE_MISSING, 'heal 前基线 verdict.json 不在场');
  }
  const bytes = readFileSync(baselinePath);
  if (createHash('sha256').update(bytes).digest('hex') !== want) {
    throw new HealReverifyError(REVERIFY_REJECT.BASELINE_UNBOUND,
      '基线 verdict 当下字节与晋升时冻进 journal 核的绑定不一致（提案后基线被替换），拒复核');
  }
  try {
    const doc = JSON.parse(bytes.toString('utf8'));
    if (!isObj(doc)) throw new Error('non-object');
    return doc;
  } catch {
    throw new HealReverifyError(REVERIFY_REJECT.BASELINE_MISSING,
      'heal 前基线 verdict.json 不是合法 JSON 对象（内容不回显）');
  }
}

// ── 编排主入口 ───────────────────────────────────────────────────────────────
/**
 * 回 { outcome, exitCode:0, receiptPath, ... }：
 *   'reverified' / 'reverify-routed-human' / 'reverify-failed-rolled-back'（D7 六值全集之三）。
 * 拒绝路径抛 HealReverifyError（kind → 65/6）。
 */
export async function runReverify({ outDir, caseId, receiptPath, tsToken, seamPath }) {
  // D13 ②：hermetic 门禁是**第一道**闸——生产调用（无 seam）连收据都不该读，直接 exit 64
  // 具名说明「v1 复核仅 hermetic，真机复核 route:human」，不留任何走到裁定面的路径。
  const admittedSeam = admitReverifySeam({ seamPath });
  // D14 ①：过了用法闸才进编排，进编排前先拿与晋升同一把 per-case 独占锁；
  // 复核内的回滚也在这把锁里跑完（rollbackJournal 自身不再取锁，故无重入）。
  const lockPath = acquireReverifyLock(casePaths(caseId).dir);
  try {
    return await runReverifyUnderLock({
      outDir, caseId, receiptPath, tsToken, admittedSeam,
    });
  } finally {
    releasePromoteLock(lockPath);
  }
}

/** 锁面统一：拿不到锁沿用晋升面既有拒因语义（LOCK_BUSY/LOCK_STALE/LOCK_UNAVAILABLE）→ exit 6。 */
function acquireReverifyLock(caseDir) {
  try {
    return acquirePromoteLock(caseDir);
  } catch (e) {
    if (e instanceof HealPromoteError) throw new HealReverifyError(e.reason, e.detail, 'blocked');
    throw e;
  }
}

async function runReverifyUnderLock({ outDir, caseId, receiptPath, tsToken, admittedSeam }) {
  const driftDir = driftDirOf(outDir);
  mkdirSync(driftDir, { recursive: true });
  const at = isoOf(tsToken);
  const receipt = readJsonOr(resolve(receiptPath), REVERIFY_REJECT.RECEIPT_INVALID, 'HealReceipt');
  if (receipt.artifactKind !== 'heal-receipt' || receipt.caseId !== caseId
    || receipt.outcome !== 'promoted' || !nonEmptyStr(receipt.stepId)
    || !nonEmptyStr(receipt.journalPath)) {
    throw new HealReverifyError(REVERIFY_REJECT.RECEIPT_INVALID,
      'HealReceipt 不是本 case 的已晋升收据（artifactKind/caseId/outcome/stepId/journalPath 须齐全）');
  }
  const journalPath = resolve(receipt.journalPath);
  const journal = readJournal(journalPath);
  if (journal.status !== 'promoted' || journal.sealed !== true) {
    throw new HealReverifyError(REVERIFY_REJECT.PROMOTION_NOT_IN_FORCE,
      `晋升不在力（journal.status=${JSON.stringify(journal.status)}），无可复核之事`, 'blocked');
  }
  // D13 codex 8：journal 是本轮**回滚的唯一权威**，动它之前先验它与 receipt 互绑一致。
  // 三面全对才算数：receipt 记的封账文件哈希 ↔ journal 自记的同一值；receipt 记的事务核哈希
  // ↔ 由现役 journal 现算的核哈希；journal 记的 receipt 内容哈希 ↔ receipt 文件实际字节。
  assertJournalReceiptBound({ journal, receipt, receiptPath: resolve(receiptPath) });

  // 先验冻结件签署权威（D6：防拿伪造冻结件复核）。
  const paths = casePaths(caseId);
  // D14 ②：跑复核**之前**先验基线字节仍是晋升时冻的那一份；验过的字节直接留作对照底座。
  const baselinePath = baselineVerdictPathOf(paths.dir);
  const baseline = admitBaselineVerdict({ journal, baselinePath });
  const eventsPath = resolve(paths.events);
  const eventsDoc = readJsonOr(eventsPath, REVERIFY_REJECT.RECEIPT_INVALID, 'events');
  const expectedDoc = readJsonOr(resolve(paths.expected), REVERIFY_REJECT.FROZEN_CONTRACT_UNSIGNED, 'expected.frozen.json');
  const signCheck = assertSignedContract(expectedDoc);
  if (!signCheck.ok) {
    throw new HealReverifyError(REVERIFY_REJECT.FROZEN_CONTRACT_UNSIGNED,
      `冻结断言契约未签（${signCheck.problems.length} 项），拒算数`);
  }
  const locks = readJsonOr(resolve(paths.entityLocks), REVERIFY_REJECT.PROMOTION_NOT_IN_FORCE, '冻结绑定件');
  const boundSha = typeof locks.eventsSha256 === 'string' ? locks.eventsSha256.replace(/^sha256:/, '') : null;
  if (locks.signed !== true || !nonEmptyStr(locks.signerId) || boundSha !== sha256File(eventsPath)) {
    throw new HealReverifyError(REVERIFY_REJECT.PROMOTION_NOT_IN_FORCE,
      '冻结绑定件未签或未钉在现役 events 字节上，拒在无权威绑定下复核', 'blocked');
  }

  // D14 ③：复核收据同属事务产物，一律 `wx` 独占落盘 —— 同 ts 重跑撞落点即具名拒，
  // 已记在册的 route:human / 回滚终局绝不会被后一轮悄悄覆写。
  const emitReceipt = (body) => {
    const p = reverifyReceiptPathOf(driftDir, caseId, tsToken);
    const text = jsonText({
      schemaVersion: 1,
      artifactKind: 'heal-receipt',
      kind: 'reverify',
      caseId,
      stepId: receipt.stepId,
      tsToken: String(tsToken),
      at,
      promoteReceiptPath: resolve(receiptPath),
      journalPath,
      ...body,
    });
    try {
      writeExclusive(p, text, '复核 HealReceipt');
    } catch (e) {
      if (e instanceof HealPromoteError) throw new HealReverifyError(e.reason, e.detail, 'blocked');
      throw e;
    }
    return p;
  };

  // 复核准入：签署复位证明件（D3 v4）。
  const proof = admitResetProof({ caseId, proofPath: join(paths.dir, 'reset-proof.json') });
  if (proof.present !== true) {
    const p = emitReceipt({
      outcome: 'reverify-routed-human',
      route: 'human',
      reason: REVERIFY_REJECT.RESET_PROOF_ABSENT,
      note: '未证明本用例可复位/幂等，整案重放不安全；本轮不跑复核、不产任何合成裁定（D3/D6）。',
    });
    return { outcome: 'reverify-routed-human', receiptPath: p, route: 'human' };
  }

  // 真 replay → 真 verdict（运行时只来自已过门禁的 hermetic 接缝）。
  const runtime = await openReverifyRuntime({ seamPath: admittedSeam });
  let axesText;
  try {
    axesText = await replayPromotedSpec({ runtime, caseId, eventsDoc, expectedDoc });
  } catch {
    await closeRuntime(runtime);
    throw new HealReverifyError(REVERIFY_REJECT.REPLAY_FAILED,
      '复核回放未跑完（详情不回显，护栏 #7）；不产任何裁定', 'blocked');
  }
  await closeRuntime(runtime);
  if (typeof axesText !== 'string' || !axesText) {
    throw new HealReverifyError(REVERIFY_REJECT.REPLAY_FAILED, '复核回放未产出三轴', 'blocked');
  }
  const axesPath = join(driftDir, `${caseId}.${tsToken}.reverify.axes.json`);
  writeFileSync(axesPath, axesText, 'utf8');

  const judged = await canonicalVerdictCliAdapter.runFrozenVerdict({
    axesBytes: Buffer.from(axesText, 'utf8'),
  });
  if (judged?.ok !== true) {
    throw new HealReverifyError(REVERIFY_REJECT.VERDICT_FAILED,
      `冻结裁判未出裁定（${judged?.reason || 'unknown'}）；绝不以合成裁定代替`, 'blocked');
  }
  const newVerdictPath = join(driftDir, `${caseId}.${tsToken}.reverify.verdict.json`);
  writeFileSync(newVerdictPath, judged.verdictBytes);
  const current = JSON.parse(judged.verdictBytes.toString('utf8'));

  // 基线已在跑复核前验过哈希并读进内存（D14 ②「先验哈希再用」），此处不再回读届时字节。
  const outcome = judgeReverification({ baseline, current, stepId: receipt.stepId });

  if (outcome.passed) {
    const p = emitReceipt({
      outcome: 'reverified',
      route: null,
      targetStep: outcome.targetStep,
      regressions: [],
      axesPath,
      newVerdictPath,
      baselineVerdictPath: baselinePath,
      resetProof: { signerId: proof.signerId, signedAt: proof.signedAt },
      note: '目标步已转 PASS 且全案无非目标步新回归；裁定由冻结裁判子进程出，非合成。',
    });
    markJournalReverified({ journalPath, tsToken, receiptPath: p });
    return { outcome: 'reverified', receiptPath: p, verdictPath: newVerdictPath, targetStep: outcome.targetStep };
  }

  // FAILED → 按 journal 对称回滚（events + 绑定逐件恢复 + 逐件 sha256 断言 + rolled-back 封账）。
  const rolled = rollbackJournal({
    journalPath, reason: 'HEAL_REVERIFY_FAILED', tsToken,
  });
  const p = emitReceipt({
    outcome: 'reverify-failed-rolled-back',
    route: 'human',
    reason: 'HEAL_REVERIFY_FAILED',
    targetStep: outcome.targetStep,
    regressions: outcome.regressions,
    axesPath,
    newVerdictPath,
    baselineVerdictPath: baselinePath,
    rollback: { journalPath, restored: rolled.restored },
    note: '复核未达标准（目标步未转 PASS 或出现非目标步新回归），已按 journal 对称回滚；转人工。',
  });
  return {
    outcome: 'reverify-failed-rolled-back',
    receiptPath: p,
    verdictPath: newVerdictPath,
    targetStep: outcome.targetStep,
    regressions: outcome.regressions,
  };
}
