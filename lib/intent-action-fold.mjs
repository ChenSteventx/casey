// intent 内逐事件动作轴 → intent 级代表动作轴。
// 纯函数、fail-safe：任何可执行事件证不出成功，都不能被末事件成功洗掉。

const failedAction = (action = {}) => {
  const out = {
    ...(action && typeof action === 'object' && !Array.isArray(action) ? action : {}),
    resolution: 'action_failed',
    identityReadback: {
    ...(action && action.identityReadback && typeof action.identityReadback === 'object' && !Array.isArray(action.identityReadback)
      ? action.identityReadback
      : {}),
      ok: false,
    },
  };
  // kind:none 是 verdict 的最高优先成功位；失败投影绝不能继续携带它。
  if (out.kind === 'none') delete out.kind;
  return out;
};

const copyAction = (action) => ({ ...action });
const copyFailedAction = (action) => {
  const out = copyAction(action);
  // verdict 的既有识别顺序先看成功回读、再看 resolution；失败折叠必须消毒矛盾的 ok:true，
  // 完整原始证据仍在 eventActions，不在 intent 级 action 继续携假成功位。
  if (out.identityReadback && typeof out.identityReadback === 'object' && out.identityReadback.ok === true) {
    out.identityReadback = { ...out.identityReadback, ok: false };
  }
  if (out.kind === 'none') delete out.kind;
  return out;
};

export function foldIntentAction(eventActions) {
  if (!Array.isArray(eventActions) || eventActions.length === 0) return failedAction();

  let representative = null;
  let pureAssertion = null;
  let ambiguous = null;
  let explicitFailed = null;
  let noneNonDrift = null;
  let noneDrift = null;
  let unknownFailed = null;
  let actionable = 0;

  for (const eventAction of eventActions) {
    const action = eventAction && typeof eventAction === 'object' && !Array.isArray(eventAction)
      ? eventAction.action
      : null;
    if (!action || typeof action !== 'object' || Array.isArray(action)) {
      if (!explicitFailed) explicitFailed = failedAction();
      continue;
    }

    // 合法纯断言轴只有 kind:none；一旦又携动作 resolution/readback 就是自相矛盾，不能借“中性”洗白。
    if (action.kind === 'none') {
      const hasActionSignal = action.resolution !== undefined
        || action.identityReadback !== undefined
        || action.driftProbe !== undefined
        || action.candidateCount !== undefined;
      if (!hasActionSignal) {
        pureAssertion = action;
        continue;
      }
      if (action.resolution === 'ambiguous') {
        if (!ambiguous) ambiguous = action;
      } else if (!explicitFailed) {
        explicitFailed = failedAction(action);
      }
      continue;
    }
    representative = action;
    actionable += 1;

    // 矛盾轴也按失败支：多匹配不能被成功回读洗白；unique+明确失败回读同理。
    if (action.resolution === 'ambiguous') {
      if (!ambiguous) ambiguous = action;
      continue;
    }
    if (action.resolution === 'action_failed') {
      if (!explicitFailed) explicitFailed = action;
      continue;
    }
    if (action.resolution === 'none') {
      const driftExplainsMiss = action.driftProbe && action.driftProbe.sameSignatureUniquePresent === true;
      if (driftExplainsMiss) {
        if (!noneDrift) noneDrift = action;
      } else if (!noneNonDrift) {
        noneNonDrift = action;
      }
      continue;
    }
    if (action.resolution === 'unique' && action.identityReadback && action.identityReadback.ok === false) {
      if (!explicitFailed) explicitFailed = failedAction(action);
      continue;
    }

    const performed = action.resolution === 'unique'
      || (action.identityReadback && action.identityReadback.ok === true);
    if (!performed && !unknownFailed) unknownFailed = action;
  }

  if (ambiguous) return copyFailedAction(ambiguous);
  if (explicitFailed) return copyFailedAction(explicitFailed);
  // HARNESS_ERROR 只在所有未成功事件都被 drift 正向解释时成立；任一普通 miss/未知失败都先路由人。
  if (noneNonDrift) return copyFailedAction(noneNonDrift);
  if (unknownFailed) return copyFailedAction(unknownFailed);
  if (noneDrift) return copyFailedAction(noneDrift);
  if (actionable === 0) return pureAssertion ? copyAction(pureAssertion) : failedAction();
  return representative ? copyAction(representative) : failedAction();
}
