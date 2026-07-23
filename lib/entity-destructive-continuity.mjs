// entity-destructive-continuity（C3）：运行时目标连续性守卫（纯函数、零 IO、通道无关、零 LLM）。
//
// 语义边界（务必守，报告不得冒充）：C3 用 identityObservationRef 的 platformId 做「同一目标」核对，
// 【非】「消费同一份形式收据」(receiptHash)——后者要唤醒被封死的子系统 A（kernel 设计门 + Steven 人签），
// 本轮结构性关不掉（GRILL D1）。本模块只证 C 束目标连续性（防误删的目标连续性），绝不冒充 A 束的
// 签发根/授权/provenance/联合五元/TOCTOU 五层。v2 形式收据链字节仍冻（b7b5a47e，本轮不碰）、裁定四态不改。
//
// 8 个导出纯函数迎合金牌 tests/_golden/entity-destructive-continuity-guard.zero-sut.golden.mjs 的冻结契约。

// 破坏性/targeting 原子表（限 targeting，不全量翻——GRILL D2）：只有这三个索要连续性 ref。
// 孤儿 agent.removeToolByName（有 side-effect policy、无编译器/无观察通道）不在表内（GRILL D4 不误拒）。
const TARGETING_DESTRUCTIVE_ATOMS = new Set([
  'workflow.deleteByName',
  'agent.delete',
  'picker.selectFirstTool',
]);

// mint 铸造的连续性观察必带字段：完整五元 + platformId/name/code + 指纹 + scope + 请求关联。
const REQUIRED_STRING_FIELDS = [
  'platformId', 'name', 'code',
  'role', 'atom', 'evidenceStepId', 'sourceIntentId', 'candidateId',
  'profileFingerprint', 'scope', 'requestCorrelationId',
];

const frozen = (value) => Object.freeze(value);
const isObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value);
const nonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

// 从请求 url 的查询串提取可验平台 ID（id / platformId 键）。{{baseUrl}} 占位符非合法 URL，故手工解析查询串。
function idsFromUrl(url) {
  const out = [];
  if (typeof url !== 'string') return out;
  const q = url.indexOf('?');
  if (q === -1) return out;
  for (const pair of url.slice(q + 1).split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    let key;
    let value;
    try {
      key = decodeURIComponent(pair.slice(0, eq));
      value = decodeURIComponent(pair.slice(eq + 1));
    } catch {
      continue; // 畸形转义：视作无可验 ID（fail-closed）。
    }
    if ((key === 'id' || key === 'platformId') && nonEmptyString(value)) out.push(value);
  }
  return out;
}

// 从请求 body 提取可验平台 ID（顶层 id / platformId）。
function idsFromBody(body) {
  const out = [];
  if (!isObject(body)) return out;
  for (const key of ['id', 'platformId']) {
    const value = body[key];
    if (nonEmptyString(value)) out.push(value);
    else if (typeof value === 'number' && Number.isFinite(value)) out.push(String(value));
  }
  return out;
}

function outboundIds(request) {
  if (!isObject(request)) return [];
  return [...idsFromUrl(request.url), ...idsFromBody(request.body)];
}

// ── 验收点 6/7 + r0：限 targeting/破坏性原子索要连续性 ref ─────────────────────────────
export function requiresTargetContinuityRef(atom) {
  return typeof atom === 'string' && TARGETING_DESTRUCTIVE_ATOMS.has(atom);
}

// ── 验收点 1：不可覆盖 observation（铸造深冻结 ref、绑全字段，缺任一即拒）────────────────
export function mintTargetContinuityObservation(input) {
  if (!isObject(input)) {
    return frozen({ ok: false, reason: 'CONTINUITY_OBSERVATION_INPUT_INVALID' });
  }
  for (const field of REQUIRED_STRING_FIELDS) {
    if (!nonEmptyString(input[field])) {
      return frozen({ ok: false, reason: `CONTINUITY_OBSERVATION_MISSING_${field}` });
    }
  }
  if (!Number.isInteger(input.stepOrder) || input.stepOrder < 0) {
    return frozen({ ok: false, reason: 'CONTINUITY_OBSERVATION_STEP_ORDER_INVALID' });
  }
  const ref = { stepOrder: input.stepOrder };
  for (const field of REQUIRED_STRING_FIELDS) ref[field] = input[field];
  return frozen({ ok: true, ref: frozen(ref) });
}

// ── 验收点 1（后半）：破坏性动作携 ref 取 platformId，绝不按 name 再生成；缺 platformId fail-closed ──
export function resolveDestructiveTarget(options) {
  const ref = isObject(options) ? options.ref : undefined;
  const platformId = isObject(ref) ? ref.platformId : undefined;
  if (!nonEmptyString(platformId)) {
    return frozen({ ok: false, reason: 'DESTRUCTIVE_TARGET_REF_MISSING_PLATFORM_ID' });
  }
  return frozen({ ok: true, targetId: platformId });
}

// ── 验收点 2：出站请求前置核对——放行前核 url/body 的 platformId 与 ref 一致才调 send（不一致/无可验即中止且零调用）──
export function runGuardedMutation(options) {
  const abort = (reason) => frozen({ ok: false, aborted: true, released: false, reason, mutated: false });
  if (!isObject(options)) return abort('GUARDED_MUTATION_OPTIONS_INVALID');
  const { atom, request, ref, send } = options;
  const targetId = isObject(ref) ? ref.platformId : undefined;
  if (!nonEmptyString(targetId)) return abort('GUARDED_MUTATION_REF_MISSING_PLATFORM_ID');
  if (atom !== undefined && !requiresTargetContinuityRef(atom)) return abort('GUARDED_MUTATION_ATOM_NOT_TARGETING');
  if (!isObject(request)) return abort('GUARDED_MUTATION_REQUEST_INVALID');
  if (typeof send !== 'function') return abort('GUARDED_MUTATION_SEND_MISSING');
  const present = outboundIds(request);
  // 请求发出前拦：无可验 ID → fail-closed 中止（send 零调用）。
  if (present.length === 0) return abort('GUARDED_MUTATION_NO_VERIFIABLE_OUTBOUND_ID');
  // 任一出站 ID 与 ref 不符 → 中止（send 零调用，证 SUT 零副作用；只看 response 太晚）。
  if (present.some((id) => id !== targetId)) return abort('GUARDED_MUTATION_OUTBOUND_ID_MISMATCH');
  // 全部一致才放行，调注入出站通道恰一次。
  const response = send(request);
  return frozen({ ok: true, released: true, targetId, response });
}

// ── 验收点 3：删前完整可证明扫描——坏候选/分页不全/相关响应不可关联 → NEEDS_HUMAN（fail-closed）──
export function classifyPreDeleteScan(options) {
  const needsHuman = (reason) => frozen({ verdict: 'NEEDS_HUMAN', reason });
  if (!isObject(options)) return needsHuman('PRE_DELETE_SCAN_OPTIONS_INVALID');
  const { candidates, paginationComplete, correlatable } = options;
  if (paginationComplete !== true) return needsHuman('PRE_DELETE_SCAN_PAGINATION_INCOMPLETE');
  if (correlatable !== true) return needsHuman('PRE_DELETE_SCAN_RESPONSE_NOT_CORRELATABLE');
  if (!Array.isArray(candidates) || candidates.length === 0) return needsHuman('PRE_DELETE_SCAN_CANDIDATES_INVALID');
  for (const candidate of candidates) {
    if (!isObject(candidate) || !nonEmptyString(candidate.platformId)) {
      return needsHuman('PRE_DELETE_SCAN_CANDIDATE_MISSING_PLATFORM_ID');
    }
  }
  return frozen({ verdict: 'PROCEED', reason: null });
}

// ── 验收点 4：无可验出站 ID 且 DOM 无 ID → route:human（结构上不能安全自动化，fail-closed）──
export function routeOutboundIdentifiability(options) {
  const request = isObject(options) ? options.request : undefined;
  const domId = isObject(options) ? options.domId : undefined;
  const hasRequestId = outboundIds(request).length > 0;
  const hasDomId = nonEmptyString(domId);
  if (hasRequestId || hasDomId) return frozen({ route: 'proceed' });
  return frozen({ route: 'human', reason: 'OUTBOUND_NO_VERIFIABLE_IDENTIFIABILITY', failClosed: true });
}

// ── 验收点 5：按 target-ID 稳定窗口 absence-proof（非 name count===0）──────────────────────
export function evaluateTargetAbsence(options) {
  const ref = isObject(options) ? options.ref : undefined;
  const window = isObject(options) ? options.window : undefined;
  const targetId = isObject(ref) ? ref.platformId : undefined;
  const base = { mode: 'target-id-absence', targetId: nonEmptyString(targetId) ? targetId : null };
  const unproven = (reason) => frozen({ proven: false, ...base, reason });
  if (!nonEmptyString(targetId)) return unproven('TARGET_ABSENCE_REF_MISSING_PLATFORM_ID');
  if (!isObject(window)) return unproven('TARGET_ABSENCE_WINDOW_INVALID');
  // name-count-only 窗口（无 presentPlatformIds）永远不据 count===0 判归零。
  if (!Array.isArray(window.presentPlatformIds)) return unproven('TARGET_ABSENCE_NO_PRESENT_PLATFORM_IDS_WINDOW');
  if (window.stable !== true) return unproven('TARGET_ABSENCE_WINDOW_NOT_STABLE');
  if (window.presentPlatformIds.includes(targetId)) return unproven('TARGET_STILL_PRESENT');
  return frozen({ proven: true, ...base, reason: null });
}

// ── 验收点 8：delete/add-tool 同名毒化——按 ref.platformId 唯一命中、绝不取 first（0 或 >1 命中即中止）──
export function selectDestructiveCandidateByRef(options) {
  const abort = (reason) => frozen({ ok: false, aborted: true, reason });
  const ref = isObject(options) ? options.ref : undefined;
  const candidates = isObject(options) ? options.candidates : undefined;
  const targetId = isObject(ref) ? ref.platformId : undefined;
  if (!nonEmptyString(targetId)) return abort('SELECT_CANDIDATE_REF_MISSING_PLATFORM_ID');
  if (!Array.isArray(candidates)) return abort('SELECT_CANDIDATE_CANDIDATES_INVALID');
  const matches = candidates.filter(
    (candidate) => isObject(candidate) && typeof candidate.platformId === 'string' && candidate.platformId === targetId,
  );
  if (matches.length !== 1) return abort('SELECT_CANDIDATE_NOT_UNIQUE_BY_REF');
  const hit = matches[0];
  return frozen({ ok: true, candidateId: hit.candidateId, platformId: hit.platformId });
}
