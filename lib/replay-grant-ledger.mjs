// 回放授权票据核销台账的文件系统面（plan §3.4）。
// 纯判定在 lib/entity-created-workflow-replay-grant.mjs 的 judgeReplayGrantBatchSession——
// 那一层不碰文件系统、只吃读快照；本层负责读快照与**原子占用**。
//
// 唯一形状（评审 M-new1 收口，不再有 entries[] 数组 / .jsonl 追加 / 临时文件 rename 三套说法）：
//   <ledgerRoot>/<grantNonce>/session.json            ← wx 创建，{ batchToken, occupiedAt }
//   <ledgerRoot>/<grantNonce>/<caseId>.consumed.json  ← wx 创建，一成员一件
//
// 原子原语是 'wx'（O_EXCL，评审 M-new2）：同一文件系统上创建即独占、胜者唯一，
// 不给「先读后写」留窗口——两个进程同时读到空台账时后者会盖掉前者的那种缝在这里不存在。
// 时序是**先记账、再放行**（评审 C1）：占用成功才允许 chromium.launch，落盘失败一律不放行。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { judgeReplayGrantBatchSession } from './entity-created-workflow-replay-grant.mjs';

const SAFE_SEGMENT = /^[A-Za-z0-9_.-]+$/;

function readJsonIfPresent(absPath) {
  try { return JSON.parse(readFileSync(absPath, 'utf8')); } catch { return null; }
}

// 'wx' 的独占发生在「建文件」那一刻，内容是随后写的——两者之间有个窗口，
// 并发的另一进程可能读到空文件。所以「读会话」必须有界重读：
// 建出来了但还没写完 ≠ 会话不存在，更 ≠ 批号不符（那会把并发败者误判成重放）。
// 重读到期仍不可解析就返回 null，由调用方 fail-closed——不放行永远是安全侧。
function readSessionSettled(absPath, attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    if (!existsSync(absPath)) return null;
    const parsed = readJsonIfPresent(absPath);
    if (parsed && typeof parsed.batchToken === 'string') return parsed;
    // 极短忙等（每轮约 1ms）：只在真并发建档的瞬间发生，串行路径一次就命中。
    const until = Date.now() + 1;
    while (Date.now() < until) { /* 让位给写者 */ }
  }
  return null;
}

// 已消费成员的读快照：**只看在场，不解析内容**——同样是为了避开建档与写内容之间的窗口
// （解析失败会把「已占用」误读成「未占用」，那是 fail-open）。
function readConsumedCaseIds(dir, grantCaseIds) {
  return grantCaseIds.filter((caseId) => existsSync(join(dir, `${caseId}.consumed.json`)));
}

// 原子独占创建：成功返回 true；已存在返回 'exists'；其余失败返回 false（一律不放行）。
function createExclusive(absPath, document) {
  try {
    writeFileSync(absPath, `${JSON.stringify(document, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    return true;
  } catch (error) {
    return error && error.code === 'EEXIST' ? 'exists' : false;
  }
}

export function occupyReplayGrantMember({ ledgerRoot, grantNonce, batchToken, caseId, grantCaseIds } = {}) {
  const refuse = (reason) => Object.freeze({ ok: false, allowLaunch: false, reason });
  if (typeof ledgerRoot !== 'string' || !ledgerRoot) return refuse('REPLAY_GRANT_LEDGER_ROOT_INVALID');
  // 路径段安全：nonce 与 caseId 都要进路径，不许出现分隔符或上跳段。
  if (typeof grantNonce !== 'string' || !SAFE_SEGMENT.test(grantNonce)
    || typeof caseId !== 'string' || !SAFE_SEGMENT.test(caseId)) {
    return refuse('REPLAY_GRANT_LEDGER_SEGMENT_INVALID');
  }
  const dir = join(ledgerRoot, grantNonce);
  try { mkdirSync(dir, { recursive: true }); }
  catch { return refuse('REPLAY_GRANT_LEDGER_WRITE_FAILED'); }

  const caseIds = Array.isArray(grantCaseIds) ? grantCaseIds : [];
  const sessionPath = join(dir, 'session.json');

  // ① 先按当前快照判一次（会话是否在场、token 是否同值、成员是否已消费、是否在授权集内）
  const pre = judgeReplayGrantBatchSession({
    grantNonce,
    batchToken,
    caseId,
    grantCaseIds: caseIds,
    sessionSnapshot: readSessionSettled(sessionPath),
    consumedCaseIds: readConsumedCaseIds(dir, caseIds),
  });
  if (!pre.allowLaunch) return refuse(pre.reason);

  // ② 开会话：wx 保证「恰一次」。竞态失败者读回已在场的 session 再判 token 同值。
  if (pre.opensSession) {
    const created = createExclusive(sessionPath, { batchToken, occupiedAt: new Date().toISOString() });
    if (created === false) return refuse('REPLAY_GRANT_LEDGER_WRITE_FAILED');
    if (created === 'exists') {
      const existing = readSessionSettled(sessionPath);
      if (!existing || existing.batchToken !== batchToken) {
        return refuse('REPLAY_GRANT_BATCH_SESSION_MISMATCH');
      }
    }
  }

  // ③ 占用本成员：wx 已在 = 该成员重跑（并发时的败者也走这一支）。
  const claimed = createExclusive(join(dir, `${caseId}.consumed.json`), {
    caseId, batchToken, consumedAt: new Date().toISOString(),
  });
  if (claimed === 'exists') return refuse('REPLAY_GRANT_MEMBER_ALREADY_CONSUMED');
  if (claimed === false) return refuse('REPLAY_GRANT_LEDGER_WRITE_FAILED');

  return Object.freeze({ ok: true, allowLaunch: true, grantNonce, batchToken, caseId });
}
