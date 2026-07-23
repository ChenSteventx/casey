// entity-destructive-continuity-wiring（C3）：把纯守卫 lib/entity-destructive-continuity.mjs 的零 IO 判定
// 接进三处生产路径的适配层（通道相关的胶水，判定本体仍在纯模块、零 LLM）。
//
// 语义边界（务必守，报告不得冒充）：本层只把 C 束目标连续性判定接到 replay 出站拦截 / compile 铸 ref /
// 归零收尾，用 identityObservationRef 的 platformId 做「同一目标」核对，非「消费同一份形式收据」(receiptHash)——
// 后者要唤醒被封死的子系统 A（kernel 设计门 + Steven 人签），本轮结构性关不掉（GRILL D1）。
//
// 三个消费者：
//   installOutboundMutationGuard —— bin/replay.mjs 出站拦截安装器（page.route 处理器委派 runGuardedMutation）。
//   mintDestructiveTargetContinuity —— lib/compile-atoms.mjs 破坏性编译处的铸 ref 适配器（补 profile 指纹/scope/请求关联/步序）。
//   evaluateDestructiveTargetAbsence —— bin/replay.mjs 归零收尾适配器（把 projectIdentityEnvelope 的 rows.id 投成 present platformIds 交 evaluateTargetAbsence）。

import {
  requiresTargetContinuityRef,
  runGuardedMutation,
  mintTargetContinuityObservation,
  evaluateTargetAbsence,
} from './entity-destructive-continuity.mjs';

// route.request() 的 postData 解析成 body（仅 JSON 对象；非 JSON/非对象回 null，交纯决策按无可验 ID fail-closed）。
function parsePostData(postData) {
  if (typeof postData !== 'string' || !postData) return null;
  try {
    const value = JSON.parse(postData);
    return value != null && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function callProbe(fn) {
  return typeof fn === 'function' ? fn() : undefined;
}

// ── 接线 3（replay 出站拦截）：对破坏性 mutation 请求【发出前暂停】→ 提平台 ID → 委派 runGuardedMutation → continue/abort ──
//
// page 是 Playwright Page（page.route 拦截器：请求发出前暂停，与既有 watchNetworkForensics 的 CDP Network 域
// 【被动观察者】分属不同层——Network 域只观测不暂停、Fetch/route 域才拦截暂停，互不注册对方回调，共存不打架；
// 真机层面的共存正确性走 route:human 真机确认）。合成 mock page/route 亦可驱动本安装器（hermetic 金牌用，不起真浏览器）。
//
// send 通道 = route.continue()（真出站放行）。runGuardedMutation 只在请求 url/body 的 platformId 与 ref 一致时
// 才调 send 一次；不一致/无可验 ID 一律零调用（证 SUT 零副作用）→ 本安装器随即 route.abort（请求发出前拦）。
export function installOutboundMutationGuard(page, { atom, ref, urlPattern, onDecision } = {}) {
  if (!requiresTargetContinuityRef(atom)) {
    return { installed: false, reason: 'ATOM_NOT_TARGETING_DESTRUCTIVE' };
  }
  if (!page || typeof page.route !== 'function') {
    return { installed: false, reason: 'PAGE_ROUTE_UNAVAILABLE' };
  }
  if (!ref || typeof ref.platformId !== 'string' || !ref.platformId.trim()) {
    return { installed: false, reason: 'REF_MISSING_PLATFORM_ID' };
  }
  const pattern = typeof urlPattern === 'string' && urlPattern.trim() ? urlPattern : '**/*';
  const handler = async (route) => {
    const request = route && typeof route.request === 'function' ? route.request() : null;
    const built = {
      url: request ? callProbe(request.url) : undefined,
      method: request ? callProbe(request.method) : undefined,
      body: parsePostData(request ? callProbe(request.postData) : undefined),
    };
    // send 只被 runGuardedMutation 在核对通过后调用；这是「请求发出前暂停 + 委派」的唯一放行路径。
    const send = () => (route && typeof route.continue === 'function' ? route.continue() : undefined);
    const decision = runGuardedMutation({ atom, request: built, ref, send });
    try {
      if (decision.ok && decision.released) {
        await decision.response; // route.continue() 的 Promise，放行落定
      } else if (route && typeof route.abort === 'function') {
        await route.abort('blockedbyclient'); // 中止：请求发出前拦，SUT 未改
      }
    } finally {
      if (typeof onDecision === 'function') onDecision(decision);
    }
    return decision;
  };
  page.route(pattern, handler);
  return { installed: true, pattern };
}

// ── 接线 2（compile 铸 ref）：破坏性编译处由 C0 的 identity observation 铸目标连续性 ref。
//
// observation = run.identityObservations 里对应目标的那条（含 platformId/name/code/role/atom/evidenceStepId/
// sourceIntentId/candidateId）；context 补 mintTargetContinuityObservation 索要而 observation 不带的
// profileFingerprint/scope/requestCorrelationId/stepOrder——【非按名再生成预期值】，platformId 恒取自观察。
// 缺观察或缺任一必填 → { ok:false }（fail-closed，编译不武装 ref）。
export function mintDestructiveTargetContinuity(observation, context = {}) {
  if (!observation || typeof observation !== 'object') {
    return { ok: false, reason: 'DESTRUCTIVE_CONTINUITY_OBSERVATION_MISSING' };
  }
  return mintTargetContinuityObservation({
    platformId: observation.platformId,
    name: observation.name,
    code: observation.code,
    role: observation.role,
    atom: observation.atom,
    evidenceStepId: observation.evidenceStepId,
    sourceIntentId: observation.sourceIntentId,
    candidateId: observation.candidateId,
    profileFingerprint: context.profileFingerprint,
    scope: context.scope,
    requestCorrelationId: context.requestCorrelationId,
    stepOrder: context.stepOrder,
  });
}

// ── 接线 3（归零收尾）：把 projectIdentityEnvelope 的 rows（[{id,code,name}]）投成 present platformIds 交
// evaluateTargetAbsence——按 target-ID 稳定窗口 absence-proof 归零，非 name count===0。
// identityRows 缺失/非数组 → 交 evaluateTargetAbsence 的 name-count-only 语义（proven:false）。
export function evaluateDestructiveTargetAbsence({ ref, identityRows, stable } = {}) {
  const presentPlatformIds = Array.isArray(identityRows)
    ? identityRows
      .map((row) => (row && typeof row === 'object' ? row.id : undefined))
      .filter((id) => typeof id === 'string' && id.trim())
    : null;
  const window = presentPlatformIds != null ? { presentPlatformIds, stable: stable === true } : {};
  return evaluateTargetAbsence({ ref, window });
}
