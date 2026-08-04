// 回放授权票据（created-workflow-replay-grant）：批级一次性票据的起草 / 冻结 / 读回 /
// 批会话纯判定 / 采集面拒跑筛。纯核：无文件系统、浏览器、网络、LLM 访问。
//
// 与 v3 结构授权边（created-workflow-ownership-authority）的分工：
//   结构件签「哪条边可以删」，随五源字节，重编译才重签；
//   本件签「这一批可以跑一次」，每批一签、一次性核销、带人写失效期。
//   两件的 artifactKind 与 authorizedFor 字面量互斥，互不可冒充（plan §3.1）。
//
// 「一次」的准确含义（plan §3.3 批会话协议）：一张票 = 一个批会话 =
//   每个授权成员各恰一次 launch。Tier2 三条变更型是分进程连跑
//   （lib/selftest-tier2-collect.mjs:186 在成员循环内逐个 spawnSync），
//   所以不能是「整票只放行一次」——那样成员②③必被判已核销、整批跑不通。
//   真正的原子性由命令行面的 'wx'（O_EXCL）保证；本模块只出判定，不碰文件系统。

import { createHash } from 'node:crypto';
import { types as utilTypes } from 'node:util';

// 已验票据的不可伪造句柄（同 v3 的 AUTHORITY_STATE 手法）：调用方拿不到内部状态，
// 也造不出「看起来像已验」的对象——controller 只认从这里发出的句柄。
const GRANT_STATE = new WeakMap();

const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;
const HEX32_RE = /^[0-9a-f]{32}$/;
const AUDIENCES = Object.freeze(['test', 'production']);
const CASE_KEYS = Object.freeze(['caseId', 'structuralAuthoritySha256', 'structuralSignature']);
const DRAFT_KEYS = Object.freeze([
  'schemaVersion', 'artifactKind', 'authorizedFor', 'batchId', 'signed',
  'audience', 'notAfter', 'grantNonce', 'cases',
]);
const GRANT_KEYS = Object.freeze([...DRAFT_KEYS, 'signerId', 'signedAt', 'signature']);

export const REPLAY_GRANT_ARTIFACT_KIND = 'created-workflow-replay-grant';
export const REPLAY_GRANT_AUTHORIZED_FOR = 'created-workflow-replay';
const STRUCTURAL_ARTIFACT_KIND = 'created-workflow-ownership-authority';

const frozen = (value) => Object.freeze(value);
const denied = (reason, extra = {}) => frozen({ ok: false, ...extra, reason });
const nonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;

function plainRecord(value) {
  if (value == null || typeof value !== 'object' || Array.isArray(value) || utilTypes.isProxy(value)) return null;
  let descriptors;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return null;
  }
  const out = Object.create(null);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== 'string') return null;
    const descriptor = descriptors[key];
    if (!Object.hasOwn(descriptor, 'value') || descriptor.get || descriptor.set) return null;
    out[key] = descriptor.value;
  }
  return out;
}

function exactKeys(value, keys) {
  const record = plainRecord(value);
  if (!record) return null;
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
    ? record
    : null;
}

function deepFreeze(value, seen = new Set()) {
  if (value == null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value == null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

const digestBytes = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const digestValue = (value) => digestBytes(Buffer.from(JSON.stringify(canonical(value)), 'utf8'));

function copyBytes(value) {
  return Buffer.isBuffer(value) || value instanceof Uint8Array ? Buffer.from(value) : null;
}

function parseJsonBytes(bytes) {
  try { return JSON.parse(bytes.toString('utf8')); } catch { return null; }
}

// ISO 时点：只认可解析且往返一致的字面量，防「2026-13-45」这类被 Date 悄悄归一。
function parseIsoInstant(value) {
  if (!nonEmpty(value)) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

// 结构授权边的最小投影：只取本模块成链要用的两格，不重复 v3 的结构校验
// （结构闭包由 v3 的 reader 负责；这里只证「票据指的就是这份件」）。
function projectStructuralAuthority(authorityBytes) {
  const bytes = copyBytes(authorityBytes);
  if (!bytes || bytes.length === 0) return null;
  const parsed = plainRecord(parseJsonBytes(bytes));
  if (!parsed || parsed.artifactKind !== STRUCTURAL_ARTIFACT_KIND
    || parsed.signed !== true || !nonEmpty(parsed.caseId)
    || !DIGEST_RE.test(parsed.signature || '') || !AUDIENCES.includes(parsed.audience)) return null;
  return {
    caseId: parsed.caseId,
    audience: parsed.audience,
    sha256: digestBytes(bytes),
    signature: parsed.signature,
  };
}

function normalizeCaseRows(value) {
  if (!Array.isArray(value) || value.length === 0) return null;
  const rows = [];
  const seen = new Set();
  for (const raw of value) {
    const row = exactKeys(raw, CASE_KEYS);
    if (!row || !nonEmpty(row.caseId) || seen.has(row.caseId)) return null;
    if (!DIGEST_RE.test(row.structuralAuthoritySha256 || '')
      || !DIGEST_RE.test(row.structuralSignature || '')) return null;
    seen.add(row.caseId);
    rows.push({
      caseId: row.caseId,
      structuralAuthoritySha256: row.structuralAuthoritySha256,
      structuralSignature: row.structuralSignature,
    });
  }
  return rows;
}

function draftShape(value) {
  const draft = exactKeys(value, DRAFT_KEYS);
  if (!draft || draft.schemaVersion !== 1
    || draft.artifactKind !== REPLAY_GRANT_ARTIFACT_KIND
    || draft.authorizedFor !== REPLAY_GRANT_AUTHORIZED_FOR
    || draft.signed !== false || !nonEmpty(draft.batchId)
    || !AUDIENCES.includes(draft.audience)
    || !HEX32_RE.test(draft.grantNonce || '')
    || parseIsoInstant(draft.notAfter) === null) return null;
  const cases = normalizeCaseRows(draft.cases);
  return cases ? { ...draft, cases } : null;
}

function unsignedOf(grant) {
  return Object.fromEntries(Object.entries(grant).filter(([key]) => key !== 'signature'));
}

function grantShape(value) {
  const grant = exactKeys(value, GRANT_KEYS);
  if (!grant || grant.schemaVersion !== 1
    || grant.artifactKind !== REPLAY_GRANT_ARTIFACT_KIND
    || grant.authorizedFor !== REPLAY_GRANT_AUTHORIZED_FOR
    || grant.signed !== true || !nonEmpty(grant.batchId)
    || !AUDIENCES.includes(grant.audience)
    || !HEX32_RE.test(grant.grantNonce || '')
    || parseIsoInstant(grant.notAfter) === null
    || !nonEmpty(grant.signerId) || !nonEmpty(grant.signedAt)
    || !DIGEST_RE.test(grant.signature || '')) return null;
  const cases = normalizeCaseRows(grant.cases);
  if (!cases) return null;
  const normalized = { ...grant, cases };
  return grant.signature === digestValue(unsignedOf(normalized)) ? normalized : null;
}

// ── 起草：从结构件精确字节派生成链摘要（不复述结构闭包）────────────
export function authorCreatedWorkflowReplayGrantDraft(options) {
  const input = plainRecord(options);
  if (!input || !nonEmpty(input.batchId) || !AUDIENCES.includes(input.audience)
    || !HEX32_RE.test(input.grantNonce || '') || parseIsoInstant(input.notAfter) === null) {
    return denied('REPLAY_GRANT_DRAFT_INPUT_INVALID');
  }
  if (!Array.isArray(input.cases) || input.cases.length === 0) {
    return denied('REPLAY_GRANT_DRAFT_CASE_SET_INVALID');
  }
  const cases = [];
  const seen = new Set();
  for (const raw of input.cases) {
    const row = plainRecord(raw);
    if (!row || !nonEmpty(row.caseId) || seen.has(row.caseId)) {
      return denied('REPLAY_GRANT_DRAFT_CASE_SET_INVALID');
    }
    const structural = projectStructuralAuthority(row.authorityBytes);
    if (!structural) return denied('REPLAY_GRANT_STRUCTURAL_AUTHORITY_INVALID');
    if (structural.caseId !== row.caseId) return denied('REPLAY_GRANT_AUTHORITY_CHAIN_MISMATCH');
    // 受众逐字相等的执法点在 readCreatedWorkflowReplayGrant（浏览器前门必经）。
    // 起草期不重复拦：那会让「受众错配的票据」根本造不出来，读回面那条钉就成了空钉
    // ——不可达的断言不是纵深，是假绿（金牌 R12 钉的正是读回面这一层）。
    seen.add(row.caseId);
    cases.push({
      caseId: row.caseId,
      structuralAuthoritySha256: structural.sha256,
      structuralSignature: structural.signature,
    });
  }
  const draft = deepFreeze({
    schemaVersion: 1,
    artifactKind: REPLAY_GRANT_ARTIFACT_KIND,
    authorizedFor: REPLAY_GRANT_AUTHORIZED_FOR,
    batchId: input.batchId,
    signed: false,
    audience: input.audience,
    notAfter: input.notAfter,
    grantNonce: input.grantNonce,
    cases,
  });
  return frozen({ ok: true, draft });
}

// ── 冻结：草案形状复核 + 签署元数据 + 自哈希 ──────────────────────
export function freezeCreatedWorkflowReplayGrant(options) {
  const input = plainRecord(options);
  if (!input || !nonEmpty(input.signerId) || !nonEmpty(input.signedAt)) {
    return denied('REPLAY_GRANT_SIGN_INPUT_INVALID');
  }
  const draft = draftShape(input.draft);
  if (!draft) return denied('REPLAY_GRANT_DRAFT_INVALID');
  const unsigned = {
    ...draft,
    signed: true,
    signerId: input.signerId,
    signedAt: input.signedAt,
  };
  return frozen({ ok: true, grant: deepFreeze({ ...unsigned, signature: digestValue(unsigned) }) });
}

// ── 读回：件种 / 签名 / 过期 / 成链 / 受众，逐条具名拒 ──────────────
export function readCreatedWorkflowReplayGrant(options) {
  const input = plainRecord(options);
  if (!input) return denied('REPLAY_GRANT_READ_INPUT_INVALID');
  // batchId 可选：调用方**知道**自己要哪一批时才给（签署会话、采集层）；
  // bin/replay.mjs 不预知批号，运行期的绑定由台账里的 batchToken 表达（plan §3.3）。
  if (input.batchId !== undefined && !nonEmpty(input.batchId)) return denied('REPLAY_GRANT_READ_INPUT_INVALID');
  const grantBytes = copyBytes(input.grantBytes);
  if (!grantBytes || grantBytes.length === 0) return denied('REPLAY_GRANT_BYTES_INVALID');
  const parsed = parseJsonBytes(grantBytes);
  // 件种不符要在签名校验之前判：结构件冒充票据时拒因必须具名到「件种」，
  // 否则会落到通用的 INVALID，钉不出两件互不可冒充（金牌 R1/R3b）。
  const kindProbe = plainRecord(parsed);
  if (!kindProbe || kindProbe.artifactKind !== REPLAY_GRANT_ARTIFACT_KIND
    || kindProbe.authorizedFor !== REPLAY_GRANT_AUTHORIZED_FOR) {
    return denied('REPLAY_GRANT_ARTIFACT_KIND_INVALID');
  }
  const grant = grantShape(parsed);
  if (!grant) return denied('REPLAY_GRANT_SIGNATURE_INVALID');
  if (input.batchId !== undefined && grant.batchId !== input.batchId) {
    return denied('REPLAY_GRANT_BATCH_ID_MISMATCH');
  }

  // 时钟：生产路径由调用方传主机墙钟（bin 面不接受任何调用方喂时，plan §3.5）。
  const nowMs = input.now === undefined ? Date.now() : parseIsoInstant(input.now);
  if (nowMs === null) return denied('REPLAY_GRANT_CLOCK_INVALID');
  if (nowMs > parseIsoInstant(grant.notAfter)) return denied('REPLAY_GRANT_EXPIRED');

  const supplied = Array.isArray(input.cases) ? input.cases : null;
  if (!supplied || supplied.length === 0) return denied('REPLAY_GRANT_READ_INPUT_INVALID');
  for (const raw of supplied) {
    const row = plainRecord(raw);
    if (!row || !nonEmpty(row.caseId)) return denied('REPLAY_GRANT_READ_INPUT_INVALID');
    const signedRow = grant.cases.find((entry) => entry.caseId === row.caseId);
    if (!signedRow) return denied('REPLAY_GRANT_CASE_NOT_AUTHORIZED');
    const structural = projectStructuralAuthority(row.authorityBytes);
    if (!structural) return denied('REPLAY_GRANT_STRUCTURAL_AUTHORITY_INVALID');
    // 受众错配单列具名拒，不许被链不合吃掉（金牌 R12 两向都钉）。
    if (structural.audience !== grant.audience) return denied('REPLAY_GRANT_AUDIENCE_MISMATCH');
    if (structural.caseId !== row.caseId
      || structural.sha256 !== signedRow.structuralAuthoritySha256
      || structural.signature !== signedRow.structuralSignature) {
      return denied('REPLAY_GRANT_AUTHORITY_CHAIN_MISMATCH');
    }
  }
  const projection = {
    audience: grant.audience,
    grantNonce: grant.grantNonce,
    batchId: grant.batchId,
    notAfter: grant.notAfter,
    caseIds: frozen(grant.cases.map((row) => row.caseId)),
  };
  const handle = frozen(Object.create(null));
  GRANT_STATE.set(handle, deepFreeze({ ...projection }));
  return frozen({ ok: true, handle, ...projection });
}

// 句柄验读：跨模块消费点（v3 controller）用它确认「这张票真过了本模块的读回」，
// 而不是调用方自己拼一个形状像的对象糊弄过去。
export function readReplayGrantHandle(handle) {
  const state = handle == null ? null : GRANT_STATE.get(handle);
  return state || null;
}

// ── 批会话纯判定：吃读快照，不碰文件系统（plan §3.4）──────────────
// 真原子性由命令行面的 'wx' 保证；本函数只回答「这一步该不该放行」。
export function judgeReplayGrantBatchSession(options) {
  const input = plainRecord(options);
  const refuse = (reason) => denied(reason, { allowLaunch: false });
  if (!input || !HEX32_RE.test(input.grantNonce || '') || !nonEmpty(input.batchToken)
    || !nonEmpty(input.caseId) || !Array.isArray(input.grantCaseIds)) {
    return refuse('REPLAY_GRANT_SESSION_INPUT_INVALID');
  }
  // ① 会话在场则 batchToken 必须逐字同值（异值 = 重放或崩溃后换批重跑）
  const snapshot = input.sessionSnapshot == null ? null : plainRecord(input.sessionSnapshot);
  if (input.sessionSnapshot != null && !snapshot) return refuse('REPLAY_GRANT_SESSION_INPUT_INVALID');
  if (snapshot && snapshot.batchToken !== input.batchToken) {
    return refuse('REPLAY_GRANT_BATCH_SESSION_MISMATCH');
  }
  // ② 本成员必须在票据授权成员集内
  if (!input.grantCaseIds.includes(input.caseId)) return refuse('REPLAY_GRANT_CASE_NOT_AUTHORIZED');
  // ③ 本成员在本会话内不得已消费
  const consumed = Array.isArray(input.consumedCaseIds) ? input.consumedCaseIds : [];
  if (consumed.includes(input.caseId)) return refuse('REPLAY_GRANT_MEMBER_ALREADY_CONSUMED');
  return frozen({ ok: true, allowLaunch: true, opensSession: snapshot === null });
}

// ── 采集面拒跑筛：无有效票据即不 spawn，并要求落拒跑回执 ────────────
export function screenTier2ReplayGrant(options) {
  const input = plainRecord(options);
  const member = input ? plainRecord(input.member) : null;
  if (!member || !nonEmpty(member.caseId)) {
    return frozen({ ran: false, refusalReason: 'replay_grant_screen_input_invalid', receiptRequired: true });
  }
  const grantRead = plainRecord(input.grantRead);
  if (!grantRead || grantRead.ok !== true) {
    return frozen({ ran: false, refusalReason: 'replay_grant_absent_or_invalid', receiptRequired: true });
  }
  const caseIds = Array.isArray(grantRead.caseIds) ? grantRead.caseIds : [];
  if (!caseIds.includes(member.caseId)) {
    return frozen({ ran: false, refusalReason: 'replay_grant_case_not_authorized', receiptRequired: true });
  }
  return frozen({ ran: true, refusalReason: null, receiptRequired: false });
}
