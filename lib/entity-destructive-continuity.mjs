// entity-destructive-continuity（C3）：运行时目标连续性守卫（纯函数、零 IO、通道无关、零 LLM）。
//
// 语义边界（务必守，报告不得冒充）：C3 用 identityObservationRef 的 platformId 做「同一目标」核对，
// 【非】「消费同一份形式收据」(receiptHash)——后者要唤醒被封死的子系统 A（kernel 设计门 + Steven 人签），
// 本轮结构性关不掉（GRILL D1）。本模块只证 C 束目标连续性（防误删的目标连续性），绝不冒充 A 束的
// 签发根/授权/provenance/联合五元/TOCTOU 五层。v2 形式收据链字节仍冻（b7b5a47e，本轮不碰）、裁定四态不改。
//
// 8 个导出纯函数迎合金牌 tests/_golden/entity-destructive-continuity-guard.zero-sut.golden.mjs 的冻结契约。

// 破坏性/targeting 原子表：真正发出「对某个已识别目标实体的破坏性/持久化 mutation」的原子索要连续性 ref。
// codex round-2 High「真破坏原子错位」收口：picker.selectFirstTool 只是勾选（本地 checkbox、零出站），真正把工具
// 持久化到当前智能体的是 agent.confirmToolPicker——本轮把它补进表内（真持久化面受连续性门保护）。selectFirstTool
// 保留在表内（冗余但 fail-closed 安全：过度护一个 checkbox 不开口子；移除它须改 round-2 冻结金牌 = ADR-0004 重签、走人）。
//
// 【域判断·集合边界】(依据写进本轮 domainJudgments)：本门用 identityObservationRef 的 platformId 核对「破坏性出站
// mutation 是否打在同一目标实体上」，故只对【出站 mutation 携目标实体 id、且同名碰撞可致误伤】的原子有意义：
//   · agent.delete / workflow.deleteByName —— 按名从列表选目标删，同名即误删，连续性门最关键（已在表）。
//   · agent.confirmToolPicker —— 把工具持久化进当前智能体（出站携 agent id），真持久化面（本轮补入）。
// 【故意不纳入】(fail-closed 但非全量翻，避免误拒合法流+越域血溅)：
//   · agent.create / workflow.create —— 建【新】实体，无前序目标可核连续性；纳入会让 create 出站无 id 被守卫 abort、
//     且身份锁下 create 流在准入恒被拒（p3-compile FLOW_GOOD 的 create/save 实证会被误拒 exit 65）——是误拒非防护。
//   · agent.save / agent.publish / workflow.save / workflow.publish —— 对【当前上下文】实体存/发，该步不按名重选目标、
//     无同名误伤面；且 p3-compile 等既有 v1 锁回放含 save，纳入会大面积误拒既有绿金牌（血溅面过大、无安全增益）。
//   · agent.removeToolByName —— 真破坏面、语义上宜护，但 round-2 冻结金牌（zero-sut v6a / wiring w4·static / round2 A4）
//     硬断言其【不】索要 ref（GRILL D4 孤儿判定）。纳入即破三处人签冻结金牌 → 属 ADR-0004 重签事件（route:human），
//     本轮不擅改生产集以免让本契约 gate 依赖未签再录；已如实记 proposed 再基线 + 挂 route:human。
const TARGETING_DESTRUCTIVE_ATOMS = new Set([
  'workflow.deleteByName',
  'agent.delete',
  'picker.selectFirstTool',
  'agent.confirmToolPicker',
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

// ── Critical-1 ③ 生产准入（fail-closed，浏览器前）：身份锁在力时，events 里每个 targeting/破坏性原子的意图
// 必须能解析到已【认证】的目标连续性 ref；解析不出即拒执行（不放行破坏动作）。resolvedRefIntents 来自
// 已认证冻结件持久化的连续性件（破坏链身份采集补齐属 C2/C3 集成，其真机形态走 route:human——当前 hermetic
// 无采集件即恒空 → 破坏性原子恒被拒，这正是 fail-CLOSED 默认，非 fail-open「跳过守卫后照跑」）。
// 只据【认证】来源判 proceed（绝不据未认证锁自报的 ref 放行，防伪造绕闸）。
export function admitDestructiveTargetContinuity(options) {
  const refuse = (reason, extra) => frozen({ ok: false, ...extra, reason });
  if (!isObject(options)) return refuse('DESTRUCTIVE_ADMISSION_OPTIONS_INVALID');
  const { events } = options;
  if (!Array.isArray(events)) return refuse('DESTRUCTIVE_ADMISSION_EVENTS_INVALID');

  // 授权粒度 = 逐破坏步（codex round-2 High「per-intent 非 per-step」收口）：每个破坏步核【它自己那一步 stepId】
  // 是否解析到已认证 ref，绝不因同 intent 里另一步有 ref 就放行本步。生产 replay 传入 resolvedRefByStep =
  // Map<破坏步 stepId, 已认证 ref>（hermetic 恒空 → 恒拒；真机采集补齐才非空，走 route:human）。
  const byStepSrc = options.resolvedRefByStep;
  const usePerStep = byStepSrc != null;
  const stepRefs = byStepSrc instanceof Map ? byStepSrc
    : (usePerStep && isObject(byStepSrc) ? new Map(Object.entries(byStepSrc)) : new Map());

  // 遗留 per-intent 入口仅供 round-2 冻结金牌（A2 锁死 resolvedRefIntents:Set 语义）兼容；生产已迁 per-step，
  // 不再走此路。彻底移除 per-intent 入口＝改 round2 冻结金牌，属 ADR-0004 重签事件（已挂 route:human）。
  const intentSrc = options.resolvedRefIntents;
  const resolvedIntents = intentSrc instanceof Set ? intentSrc : (Array.isArray(intentSrc) ? new Set(intentSrc) : new Set());

  for (const ev of events) {
    if (!isObject(ev) || !requiresTargetContinuityRef(ev.atom)) continue;
    if (!nonEmptyString(ev.intentId)) {
      return refuse('DESTRUCTIVE_ADMISSION_ATOM_MISSING_INTENT', { atom: ev.atom, stepId: nonEmptyString(ev.stepId) ? ev.stepId : null });
    }
    if (usePerStep) {
      // per-step 主路：本破坏步 stepId 必须解析到带 platformId 的已认证 ref，否则拒（每步核自己那一步）。
      if (!nonEmptyString(ev.stepId)) {
        return refuse('DESTRUCTIVE_ADMISSION_ATOM_MISSING_STEP', { atom: ev.atom, intentId: ev.intentId, stepId: null });
      }
      const ref = stepRefs.get(ev.stepId);
      if (!isObject(ref) || !nonEmptyString(ref.platformId)) {
        return refuse('DESTRUCTIVE_ADMISSION_NO_SIGNED_CONTINUITY_REF', { atom: ev.atom, intentId: ev.intentId, stepId: ev.stepId });
      }
    } else if (!resolvedIntents.has(ev.intentId)) {
      // 遗留 per-intent 路（仅 round-2 冻结金牌驱动）。
      return refuse('DESTRUCTIVE_ADMISSION_NO_SIGNED_CONTINUITY_REF', {
        atom: ev.atom, intentId: ev.intentId, stepId: nonEmptyString(ev.stepId) ? ev.stepId : null,
      });
    }
  }
  return frozen({ ok: true });
}

// ── High-2 编译侧目标观察选取（同名不取 first）：按目标名唯一命中带 platformId 的观察；0 或 >1 命中即不武装
// （fail-closed，绝不取 first）——把「同名不取 first」的立身之本落到 compile 铸 ref 的选取处，不只按 name find 首条。
export function selectObservationForDestructiveTarget(options) {
  const abstain = (reason) => frozen({ ok: false, reason });
  if (!isObject(options)) return abstain('OBSERVATION_SELECT_OPTIONS_INVALID');
  const { observations, targetName } = options;
  if (!nonEmptyString(targetName)) return abstain('OBSERVATION_SELECT_TARGET_NAME_INVALID');
  if (!Array.isArray(observations)) return abstain('OBSERVATION_SELECT_OBSERVATIONS_INVALID');
  const matches = observations.filter(
    (row) => isObject(row) && nonEmptyString(row.platformId) && row.name === targetName,
  );
  if (matches.length !== 1) return abstain(matches.length === 0 ? 'OBSERVATION_SELECT_NO_MATCH' : 'OBSERVATION_SELECT_AMBIGUOUS_SAME_NAME');
  return frozen({ ok: true, observation: matches[0] });
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

// ── High-4 纵深（codex round-2「abort 漏成 pageerror」收口）：守卫 abort 的因果排除（纯函数、零 IO、hermetic 可证）──
// route.abort() 会让页面侧未处理请求异常触发全局 pageerror；那是【工装主动中止】的因果后果、非 SUT 缺陷，绝不得进
// axes.forensics.lifecycle.pageerror 去背书 SUT_DEFECT。本函数按「pageerror 的归因步是否发生过守卫 abort」把 pageErrors
// 一分为二：kept（可进 axes、可背书裁定）/ excluded（守卫 abort 步的 pageerror，只落诊断通道、绝不背书裁定）。
// fail-closed 方向：守卫 abort 步上，机器在无真浏览器时无法干净区分「abort 因果 pageerror」与「真 SUT pageerror」，
// 故该步一律【不以 pageerror 背书 SUT_DEFECT】→ 退到 fail-safe（该步后置断言证不出即 NEEDS_HUMAN），绝不误报 SUT_DEFECT
// （NEEDS_HUMAN 是安全侧，绝不把真缺陷洗成 PASS）。真 abort 链的逐请求因果确认需真浏览器 = route:human；本「按步排除」
// 逻辑纯确定、hermetic 可证。hermetic 下守卫从不安装（guardAborts 恒空）→ excluded 恒空 → 对既有回放零行为差。
export function partitionGuardAbortPageErrors(options) {
  const pageErrors = isObject(options) && Array.isArray(options.pageErrors) ? options.pageErrors : [];
  const guardAborts = isObject(options) && Array.isArray(options.guardAborts) ? options.guardAborts : [];
  const abortedSteps = new Set();
  for (const a of guardAborts) {
    if (isObject(a) && nonEmptyString(a.attributedStepId)) abortedSteps.add(a.attributedStepId);
  }
  const kept = [];
  const excluded = [];
  for (const pe of pageErrors) {
    const stepId = isObject(pe) ? pe.attributedStepId : null;
    if (nonEmptyString(stepId) && abortedSteps.has(stepId)) excluded.push(pe);
    else kept.push(pe);
  }
  return frozen({ kept: frozen(kept), excluded: frozen(excluded) });
}
