// lib/record-distill.mjs -- teach-in distillation (纯函数、零 I/O、零 LLM、可测；闸自身绝不抛)。
// 把「已入账」示教录制包的 events 零 LLM 确定性投影成候选流程（候选 TestCase 骨架 + 候选 mapping + pending +
// 溯源 projection）。v1 全 pending（真机路由跨环境不稳、无可靠静态查表，不臆造脆弱匹配，GRILL D8）；候选非权威，
// 须重走 ingest→compile→draft→sign→人签冻结才算数，绝不直通回放。I/O（读文件/算哈希/lstat/读台账）留 CLI 层。
import { createHash } from 'node:crypto';
import { verifiedTeachInPackageAuthorityFacts } from './entity-semantic-lock-package.mjs';
import { snapshotClosedOptions } from './safe-own-data.mjs';

// TOCTOU 语义核（GRILL D4）：校当前 capture 字节仍匹配 intake 台账 accept 条目的 captureSha256。
// reason 只回类别码，绝不回哈希/脏内容。
export function verifyIntaken(options = {}) {
  let input;
  try { input = snapshotClosedOptions(options, new Set(['caseId', 'ledgerEntries', 'currentSha256'])); }
  catch { return { ok: false, reason: 'UNSAFE_DATA_SHAPE' }; }
  const { caseId, ledgerEntries, currentSha256 } = input;
  const accepts = (Array.isArray(ledgerEntries) ? ledgerEntries : [])
    .filter((e) => e && e.intakeStatus === 'accepted' && String(e.caseId) === String(caseId));
  if (accepts.length === 0) return { ok: false, reason: 'NOT_INTAKEN' };
  if (accepts.some((entry) => !committedTransactionValid(entry))) return { ok: false, reason: 'INTAKE_TRANSACTION_INVALID' };
  const latest = accepts[accepts.length - 1]; // 最新 accept 精确匹配（GRILL D4 签核）
  if (latest.captureSha256 !== currentSha256) return { ok: false, reason: 'CAPTURE_SWAPPED' };
  return { ok: true, reason: null };
}

function committedTransactionValid(entry) {
  const keys = new Set([
    'schemaVersion', 'event', 'intakeStatus', 'caseId', 'intakedAt', 'eventCount', 'reason', 'captureName',
    'captureSha256', 'sidecarSha256', 'manifestSha256', 'observationCount', 'observationSchemaVersion',
    'transactionId', 'transactionState', 'ledgerGeneration', 'transactionSha256',
  ]);
  if (!entry || entry.transactionState !== 'committed'
    || Object.keys(entry).length !== keys.size || Object.keys(entry).some((key) => !keys.has(key))
    || entry.schemaVersion !== 1 || entry.event !== 'intake' || entry.intakeStatus !== 'accepted'
    || entry.reason !== null || entry.captureName !== 'teach-in-capture.json'
    || typeof entry.transactionId !== 'string' || !entry.transactionId
    || !Number.isSafeInteger(entry.ledgerGeneration) || entry.ledgerGeneration < 1
    || typeof entry.transactionSha256 !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(entry.transactionSha256)) return false;
  const payload = { ...entry };
  delete payload.transactionSha256;
  const actual = `sha256:${createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex')}`;
  return actual === entry.transactionSha256;
}

// 三件套 TOCTOU 语义核：只承认 latest accepted 对 capture/sidecar/manifest 当前最终字节与观察元数据
// 的联合精确绑定。保留上面的 verifyIntaken 仅作旧单 capture 契约兼容；新 distill CLI 不再调用它。
export function verifyIntakenPackage(options = {}) {
  try {
    const {
      caseId,
      ledgerEntries,
      packageAuthority,
      currentCaptureSha256,
      currentSidecarSha256,
      currentManifestSha256,
      observationCount,
      observationSchemaVersion,
    } = snapshotClosedOptions(options, new Set([
      'caseId', 'ledgerEntries', 'packageAuthority', 'currentCaptureSha256', 'currentSidecarSha256',
      'currentManifestSha256', 'observationCount', 'observationSchemaVersion',
    ]), { opaqueKeys: new Set(['packageAuthority']) });
    const verifiedPackage = verifiedTeachInPackageAuthorityFacts(packageAuthority);
    if (!verifiedPackage.ok) return { ok: false, reason: verifiedPackage.reason };
    const packageFacts = verifiedPackage.facts;
    if (packageFacts.caseId !== String(caseId)
      || packageFacts.captureSha256 !== currentCaptureSha256
      || packageFacts.sidecarSha256 !== currentSidecarSha256
      || packageFacts.manifestSha256 !== currentManifestSha256
      || packageFacts.observationCount !== observationCount
      || packageFacts.observationSchemaVersion !== observationSchemaVersion) {
      return { ok: false, reason: 'VERIFIED_PACKAGE_FACTS_MISMATCH' };
    }
    const accepts = (Array.isArray(ledgerEntries) ? ledgerEntries : [])
      .filter((entry) => entry && entry.intakeStatus === 'accepted' && String(entry.caseId) === String(caseId));
    if (accepts.length === 0) return { ok: false, reason: 'NOT_INTAKEN' };
    if (accepts.some((entry) => !committedTransactionValid(entry))) {
      return { ok: false, reason: 'INTAKE_TRANSACTION_INVALID' };
    }
    const generations = accepts.map((entry) => entry.ledgerGeneration);
    if (new Set(generations).size !== generations.length
      || generations.some((generation, index) => index > 0 && generation <= generations[index - 1])) {
      return { ok: false, reason: 'INTAKE_GENERATION_INVALID' };
    }
    const latest = accepts[accepts.length - 1];
    if (latest.captureSha256 !== currentCaptureSha256) return { ok: false, reason: 'CAPTURE_SWAPPED' };
    if (latest.sidecarSha256 !== currentSidecarSha256) return { ok: false, reason: 'SIDECAR_SWAPPED' };
    if (latest.manifestSha256 !== currentManifestSha256) return { ok: false, reason: 'MANIFEST_SWAPPED' };
    if (latest.observationCount !== observationCount
      || latest.observationSchemaVersion !== observationSchemaVersion) {
      return { ok: false, reason: 'OBSERVATION_METADATA_SWAPPED' };
    }
    // 这里只返回结构复核结论。accepted authority 只能由 authority-root 的固定路径真实追加事务铸造；
    // plain ledgerEntries 即使逐字段匹配，也不能从本公开纯函数获得能力句柄。
    return { ok: true, reason: null };
  } catch {
    return { ok: false, reason: 'INTAKE_PACKAGE_VERIFICATION_ERROR' };
  }
}

// v1 零 LLM 投影未产候选 atom 的诚实桩语（每步 route:human 的 reason）。
const PENDING_REASON = 'v1 零 LLM 投影未产候选 atom（真机路由跨环境不稳、无可靠静态查表，不臆造脆弱匹配），须人经 CLI 外 LLM 补编译知识 + 断言，重走 compile→draft→人签';
// 事件动作 → 候选步 actionHint 忠实映射（ACTION_HINTS ⊇；press/dblclick 不臆造、省略 actionHint）。
const ACTION_HINT = { click: 'click', fill: 'fill', nav: 'navigate' };

// 零 LLM 确定性投影：字节稳定可复现（同输入产同字节，进金牌真值）。
export function projectCapture(doc) {
  const events = Array.isArray(doc?.events) ? doc.events : [];
  const steps = [];
  const pending = [];
  const projection = [];
  events.forEach((ev, i) => {
    const seq = i + 1;
    const intentId = 'i' + seq;
    const action = ev.action;
    const pathHint = typeof ev.path === 'string' ? ev.path : '/';
    const label = ev.text || ev.fieldLabel || '';
    const intent = [action, label, pathHint].filter(Boolean).join(' ');
    const step = { intentId, intent, route: 'human', reason: PENDING_REASON };
    if (ACTION_HINT[action]) step.actionHint = ACTION_HINT[action]; // click/fill/nav 忠实；press/dblclick 省略
    steps.push(step);
    pending.push({ intentId, eventSeq: seq, action, reason: PENDING_REASON });
    projection.push({ intentId, eventSeq: seq, action, pathHint });
  });
  // 候选 TestCase 严守 parseTestCase 契约：不含 expected（断言归相2）、不含 target（不臆造 startUrl）、
  // source 只 {kind:'json'}（source 键闭合结构上拒 signed/replayReady = 降权载体，GRILL D11）。
  const candidateTestCase = {
    schemaVersion: 1,
    caseId: String(doc?.caseId ?? ''),
    source: { kind: 'json' },
    steps,
    uniquePrefix: 'atl_',
  };
  const candidateMapping = []; // v1 全 pending：不产候选 atom（flow-bridge 形态裸数组）
  return { candidateTestCase, candidateMapping, pending, projection };
}

// 采集忠实闸（GRILL D9，distill 零 LLM L0 新闸）：校候选 mapping 对 capture 溯源忠实——每 mapping atom 有 event
// 证据（intentId ∈ projection）、每 projection event 被 mapping 覆盖或落 pending。fail-closed 全域返回、绝不抛
// （镜像 validateDraft）。对 manifest projection 溯源判、不重算命名（避免命名双源）。
export function validateCaptureFidelity({ mapping, projection, pending } = {}) {
  // 整体 try/catch（异构评审 F3）：任何内部异常（如 mapping 元素 intentId getter 抛）→ fail-closed 全域返回、绝不抛。
  try {
    const problems = [];
    const proj = Array.isArray(projection) ? projection : [];
    const pend = Array.isArray(pending) ? pending : [];
    const safeId = (o) => { try { return o && typeof o === 'object' ? o.intentId : undefined; } catch { return undefined; } };
    const projIds = new Set(proj.map(safeId).filter(Boolean));
    const pendIds = new Set(pend.map(safeId).filter(Boolean));
    if (!Array.isArray(mapping)) return { ok: false, problems: ['MALFORMED_MAPPING: mapping 须为数组'] };
    const coveredIds = new Set();
    mapping.forEach((m, i) => {
      const id = safeId(m);
      if (!id || !projIds.has(id)) problems.push(`NO_CAPTURE_EVIDENCE: mapping[${i}]`); // 凭空 atom（无 event 证据）
      else coveredIds.add(id);
    });
    for (const p of proj) {
      const id = safeId(p);
      if (id && !coveredIds.has(id) && !pendIds.has(id)) problems.push(`UNCOVERED_EVENT: ${id}`); // 漏译（未覆盖又未 pending）
    }
    return { ok: problems.length === 0, problems };
  } catch {
    return { ok: false, problems: ['CAPTURE_FIDELITY_INTERNAL_ERROR'] };
  }
}

export function buildDistillManifest({ caseId, captureSha256, projection, pending, generatedAt = new Date().toISOString() }) {
  return {
    schemaVersion: 1,
    artifactKind: 'distill-candidate',
    caseId: String(caseId),
    captureSha256: typeof captureSha256 === 'string' ? captureSha256 : null,
    generatedAt,
    projection: Array.isArray(projection) ? projection : [],
    pending: Array.isArray(pending) ? pending : [],
    note: '非权威蒸馏候选：须重走 ingest→compile→draft→sign→人签冻结才算数，绝不直通回放；候选 mapping 须经 CLI 外 LLM 补 + 采集忠实闸 + flow-bridge 方入相1。',
  };
}

// capture 字节 sha256（与 bin/intake.mjs 同法：utf8 字符串 update，TOCTOU 绑定口径须两侧一致）。
export function captureSha256Of(rawText) {
  return createHash('sha256').update(String(rawText)).digest('hex');
}
