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

// ── P9 v3：删除后的同一 target-ID 稳定缺席证明 ──────────────────────────────
// 吃按时间排序的完整 listApi 扫描样本；不接受 nameCount 代替逐样本 platform IDs，
// 也不把单次缺席或瞬时连拍冒充稳定窗口。结果只投影计数/时长与安全原因码，不复制真实 ID。
export function evaluateStableTargetAbsence(options) {
  const fail = (reason, sampleCount = 0, windowMs = null) => frozen({
    proven: false,
    cleanupSatisfied: false,
    mode: 'stable-target-id-absence',
    sampleCount,
    windowMs,
    reason,
  });
  if (!isObject(options)) return fail('STABLE_TARGET_ABSENCE_OPTIONS_INVALID');

  const targetId = isObject(options.ref) ? options.ref.platformId : undefined;
  if (!nonEmptyString(targetId)) return fail('STABLE_TARGET_ABSENCE_REF_MISSING_PLATFORM_ID');

  const samples = options.samples;
  if (!Array.isArray(samples)) return fail('STABLE_TARGET_ABSENCE_SAMPLES_INVALID');
  const sampleCount = samples.length;
  // 调用方可要求更严，但不能把 P9 的 3000ms / 3 样本最低线调低。
  const minWindowMs = options.minWindowMs;
  const minCompleteSamples = options.minCompleteSamples;
  if (!Number.isFinite(minWindowMs) || minWindowMs < 3000) {
    return fail('STABLE_TARGET_ABSENCE_MIN_WINDOW_INVALID', sampleCount);
  }
  if (!Number.isInteger(minCompleteSamples) || minCompleteSamples < 3) {
    return fail('STABLE_TARGET_ABSENCE_MIN_SAMPLES_INVALID', sampleCount);
  }
  if (sampleCount < minCompleteSamples) {
    return fail('STABLE_TARGET_ABSENCE_SAMPLE_COUNT_INSUFFICIENT', sampleCount);
  }

  let previousAt = null;
  for (const sample of samples) {
    if (!isObject(sample) || !Number.isFinite(sample.observedAtMs) || sample.observedAtMs < 0) {
      return fail('STABLE_TARGET_ABSENCE_SAMPLE_TIME_INVALID', sampleCount);
    }
    if (previousAt !== null && sample.observedAtMs <= previousAt) {
      return fail('STABLE_TARGET_ABSENCE_SAMPLE_TIME_NOT_STRICTLY_MONOTONIC', sampleCount);
    }
    previousAt = sample.observedAtMs;
    if (sample.scanComplete !== true) {
      return fail('STABLE_TARGET_ABSENCE_SCAN_INCOMPLETE', sampleCount);
    }
    if (sample.correlatable !== true) {
      return fail('STABLE_TARGET_ABSENCE_SAMPLE_NOT_CORRELATABLE', sampleCount);
    }
    if (!Array.isArray(sample.presentPlatformIds)
      || sample.presentPlatformIds.some((id) => !nonEmptyString(id))) {
      return fail('STABLE_TARGET_ABSENCE_PRESENT_PLATFORM_IDS_INVALID', sampleCount);
    }
    if (sample.presentPlatformIds.includes(targetId)) {
      return fail('STABLE_TARGET_ABSENCE_TARGET_REAPPEARED', sampleCount);
    }
  }

  const windowMs = samples[sampleCount - 1].observedAtMs - samples[0].observedAtMs;
  if (windowMs < minWindowMs) {
    return fail('STABLE_TARGET_ABSENCE_WINDOW_INSUFFICIENT', sampleCount, windowMs);
  }
  return frozen({
    proven: true,
    cleanupSatisfied: true,
    mode: 'stable-target-id-absence',
    sampleCount,
    windowMs,
    reason: null,
  });
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

// ── Critical（codex round-3）+ Steven 2026-07-24 裁定 (A)：compile 期破坏性目标连续性【浏览器前】结构准入 ──
// 与 replay 浏览器前 admitDestructiveTargetContinuity 一脉：compile 真执行破坏/定向原子【之前】，若 flow 里某破坏
// 原子的目标实体 kind 在剖面【没有声明可核实身份通道】（channel-less/v1），则结构上无从核对「同一目标」→ 拒执行破坏
// 动作（fail-closed，浏览器前 exit 65、不 performAction 破坏步）。channel-agnostic：本纯函数只据原子名判 kind，
// 「哪个 kind 有身份通道」由调用方读剖面算好传入 certifiableKinds（保本模块零 IO、通道无关）。
// 注意：本门只关【结构可核实性】（有无身份通道）；某破坏步是否真拿到已认证 ref 属运行期逐步守卫
// （armDestructiveTargetContinuity 铸不出即硬阻断），二者叠成完整 fail-closed，缺一即漏（本门过、运行期仍把关）。
export function destructiveTargetKind(atom) {
  if (typeof atom !== 'string') return null;
  if (atom.startsWith('workflow.')) return 'workflow';
  if (atom.startsWith('agent.') || atom.startsWith('picker.')) return 'agent';
  return null;
}

export function admitCompileDestructiveContinuity(options) {
  const refuse = (reason, extra) => frozen({ ok: false, ...extra, reason });
  if (!isObject(options)) return refuse('COMPILE_DESTRUCTIVE_ADMISSION_OPTIONS_INVALID');
  const { flowSteps } = options;
  if (!Array.isArray(flowSteps)) return refuse('COMPILE_DESTRUCTIVE_ADMISSION_FLOW_INVALID');
  const src = options.certifiableKinds;
  const certifiable = src instanceof Set ? src : (Array.isArray(src) ? new Set(src) : new Set());
  for (const step of flowSteps) {
    const atom = isObject(step) ? step.atom : undefined;
    if (!requiresTargetContinuityRef(atom)) continue;
    const kind = destructiveTargetKind(atom);
    if (kind == null) return refuse('COMPILE_DESTRUCTIVE_ATOM_KIND_UNKNOWN', { atom });
    // channel-less/v1（该 kind 无良构身份通道声明）→ 结构上不可核实目标连续性 → 恒拒，不豁免。
    if (!certifiable.has(kind)) return refuse('COMPILE_DESTRUCTIVE_NO_IDENTITY_CHANNEL', { atom, kind });
  }
  return frozen({ ok: true });
}

// ── High-2 编译侧目标观察选取（同名不取 first）：按目标名唯一命中带 platformId 的观察；0 或 >1 命中即不武装
// （fail-closed，绝不取 first）——把「同名不取 first」的立身之本落到 compile 铸 ref 的选取处，不只按 name find 首条。
// ── codex round-5 Critical【跨 kind 绕过】收口：新增可选 boundKind（破坏原子的目标实体 kind——workflow.deleteByName→
// workflow、agent.delete/agent.confirmToolPicker/picker.selectFirstTool→agent，由调用方 destructiveTargetKind 算出）。
// 传 boundKind 即【跨 kind 硬闸】：同名但 observation.kind 与 boundKind 不符的观察绝不入选、更不得铸 ref——否则同时声明
// agent+workflow 双通道时，同名 agent 观察能给 workflow.deleteByName（boundKind=workflow）铸 ref → 触发错目标真删，且
// compile 无出站门抓不到（真 fail-open）。有同名带 platformId 命中却无一条 kind 相符 → NO_MATCHING_KIND（fail-closed，
// 可诊断、区别于纯无名命中）。省略 boundKind（null/undefined）只保 round-2 冻结金牌 B 段的无 kind 直驱旧语义；
// 生产 armDestructiveTargetContinuity 恒按 destructiveTargetKind(atom) 传 boundKind，跨 kind 铸 ref 路径在生产处关死。
export function selectObservationForDestructiveTarget(options) {
  const abstain = (reason) => frozen({ ok: false, reason });
  if (!isObject(options)) return abstain('OBSERVATION_SELECT_OPTIONS_INVALID');
  const { observations, targetName } = options;
  if (!nonEmptyString(targetName)) return abstain('OBSERVATION_SELECT_TARGET_NAME_INVALID');
  if (!Array.isArray(observations)) return abstain('OBSERVATION_SELECT_OBSERVATIONS_INVALID');
  const boundKind = options.boundKind;
  const kindScoped = nonEmptyString(boundKind);
  const nameMatches = observations.filter(
    (row) => isObject(row) && nonEmptyString(row.platformId) && row.name === targetName,
  );
  // 跨 kind 硬闸：boundKind 提供时，同名命中还须 observation.kind === boundKind，kind 不符者剔出候选（绝不铸错目标 ref）。
  const matches = kindScoped ? nameMatches.filter((row) => row.kind === boundKind) : nameMatches;
  if (matches.length !== 1) {
    // 有同名带 platformId 命中、但 kind 全不符 → 具名 NO_MATCHING_KIND（跨 kind 拒），区别于纯粹无同名命中。
    if (kindScoped && matches.length === 0 && nameMatches.length > 0) return abstain('OBSERVATION_SELECT_NO_MATCHING_KIND');
    return abstain(matches.length === 0 ? 'OBSERVATION_SELECT_NO_MATCH' : 'OBSERVATION_SELECT_AMBIGUOUS_SAME_NAME');
  }
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

// route.abort('blockedbyclient') 在 Chromium 侧的确定性 net 层签名：这些标记只由【工装主动中止】产生，真 SUT
// 的应用级异常（TypeError/ReferenceError/自定义错误文案）本质不产生它们。故它们是「守卫 abort 因果」的高精度指纹。
const GUARD_ABORT_NET_MARKERS = Object.freeze([
  'ERR_BLOCKED_BY_CLIENT', 'BLOCKED_BY_CLIENT', 'blockedbyclient', 'ERR_ABORTED',
]);

// codex round-3 High「abort 排除不是因果排除、而是按 step 全吞」收口：某步只要出现一次 guard abort，旧实现把该步
// 【全部】pageerror（含独立真 SUT pageerror）一律排除（实跑 kept=0，吞真缺陷）。本判据改为【逐 pageerror 因果】——
// 一条 pageerror 只有在【它自己就是守卫 abort 的因果后果】时才排除：其 message 携中止请求的 url（route:human 真机采集
// 补齐 guardAborts[].abortedRequestUrl 时的精确锚），或携 route.abort('blockedbyclient') 的 net 层签名标记（守卫独有、
// 真 SUT 应用异常不产生）。message 与中止签名/url 均不符的 pageerror（如同一步里真 SUT 的 TypeError）→ kept，仍背书
// SUT_DEFECT（不吞真缺陷）。fail-safe 方向不变：被排除的只是【可证工装中止所致】那条，绝不因步内有一次 abort 就
// 连坐真缺陷。残留不可 hermetic 关的边界（应用把 abort 包成不带 net 标记的自定义错误 → 逐请求 pageerror↔request 精确
// 归因需真浏览器 request handle）= route:human。hermetic 下守卫从不安装（guardAborts 恒空）→ 无排除 → 对既有回放零行为差。
function isGuardAbortCausedPageError(message, abortedUrls) {
  const text = typeof message === 'string' ? message : '';
  if (!text) return false;
  if (abortedUrls) { for (const url of abortedUrls) { if (nonEmptyString(url) && text.includes(url)) return true; } }
  for (const marker of GUARD_ABORT_NET_MARKERS) { if (text.includes(marker)) return true; }
  return false;
}

export function partitionGuardAbortPageErrors(options) {
  const pageErrors = isObject(options) && Array.isArray(options.pageErrors) ? options.pageErrors : [];
  const guardAborts = isObject(options) && Array.isArray(options.guardAborts) ? options.guardAborts : [];
  const abortedSteps = new Set();
  const abortedUrlsByStep = new Map(); // stepId → Set(中止请求 url)（route:human 真机采集补齐；hermetic 常态空 Set）
  for (const a of guardAborts) {
    if (!isObject(a) || !nonEmptyString(a.attributedStepId)) continue;
    abortedSteps.add(a.attributedStepId);
    if (nonEmptyString(a.abortedRequestUrl)) {
      if (!abortedUrlsByStep.has(a.attributedStepId)) abortedUrlsByStep.set(a.attributedStepId, new Set());
      abortedUrlsByStep.get(a.attributedStepId).add(a.abortedRequestUrl);
    }
  }
  const kept = [];
  const excluded = [];
  for (const pe of pageErrors) {
    const stepId = isObject(pe) ? pe.attributedStepId : null;
    const message = isObject(pe) ? pe.message : null;
    // 逐 pageerror 因果：仅当【归因步发生过守卫 abort】且【本条 message 可证是该中止的因果后果】才排除；
    // 否则（他步、或同步但非中止签名的真 SUT 缺陷）一律 kept。
    if (nonEmptyString(stepId) && abortedSteps.has(stepId)
        && isGuardAbortCausedPageError(message, abortedUrlsByStep.get(stepId))) {
      excluded.push(pe);
    } else {
      kept.push(pe);
    }
  }
  return frozen({ kept: frozen(kept), excluded: frozen(excluded) });
}
