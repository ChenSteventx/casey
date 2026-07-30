// 把 resolved/pending 三分结果投影成现役 flow-bridge 直接可吃的 TestCase/mapping 候选。
// 纯核心：零 browser、零 fs、零 network、零 LLM。authored 契约字段只复制不编辑，
// capture-only 输入缺 expected 时保持缺席，绝不补成功断言（设计 §3.3）。

function frozen(value) {
  return Object.freeze(value);
}

function denied(reason) {
  return frozen({ ok: false, reason });
}

function isPlainRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function copyStep(step) {
  const copy = structuredClone(step);
  delete copy.route;
  delete copy.reason;
  return copy;
}

export function projectFlowBridgeCandidate(options = {}) {
  let caseId;
  let resolved;
  let pending;
  let authoredTestCase;
  try {
    if (!options || typeof options !== 'object') return denied('UNSAFE_DATA_SHAPE');
    ({
      caseId, resolved, pending, authoredTestCase,
    } = options);
  } catch {
    return denied('UNSAFE_DATA_SHAPE');
  }
  if (typeof caseId !== 'string' || !caseId) return denied('UNSAFE_DATA_SHAPE');
  if (!Array.isArray(resolved) || !Array.isArray(pending)) return denied('UNSAFE_DATA_SHAPE');
  if (authoredTestCase !== undefined && !isPlainRecord(authoredTestCase)) {
    return denied('UNSAFE_DATA_SHAPE');
  }

  const resolvedByIntent = new Map(resolved.map((unit) => [unit.intentId, unit]));
  const pendingByIntent = new Map(pending.map((item) => [item.intentId, item]));

  const steps = [];
  const authoredIntentIds = new Set();
  if (authoredTestCase && Array.isArray(authoredTestCase.steps)) {
    for (const step of authoredTestCase.steps) {
      if (!isPlainRecord(step) || typeof step.intentId !== 'string' || !step.intentId) {
        return denied('UNSAFE_DATA_SHAPE');
      }
      authoredIntentIds.add(step.intentId);
      const pendingItem = pendingByIntent.get(step.intentId);
      if (resolvedByIntent.has(step.intentId)) {
        // 已被 resolved atom 覆盖的 step 必须删除 route/reason，否则与 mapping 矛盾。
        steps.push(copyStep(step));
        continue;
      }
      if (pendingItem) {
        const copy = copyStep(step);
        copy.route = 'human';
        copy.reason = pendingItem.reason;
        steps.push(copy);
        continue;
      }
      steps.push(structuredClone(step));
    }
  }

  // capture-only 或 authored 未覆盖的单元：补最小 step，不合成 expected/断言。
  for (const unit of resolved) {
    if (authoredIntentIds.has(unit.intentId)) continue;
    steps.push({
      intentId: unit.intentId,
      intent: `示教解析单元 ${unit.intentId}`,
    });
  }
  for (const item of pending) {
    if (authoredIntentIds.has(item.intentId)) continue;
    steps.push({
      intentId: item.intentId,
      intent: `示教待人工单元 ${item.intentId}`,
      route: 'human',
      reason: item.reason,
    });
  }

  const candidateTestCase = {
    schemaVersion: authoredTestCase && authoredTestCase.schemaVersion !== undefined
      ? structuredClone(authoredTestCase.schemaVersion)
      : 1,
    caseId,
  };
  if (authoredTestCase && authoredTestCase.title !== undefined) {
    candidateTestCase.title = structuredClone(authoredTestCase.title);
  }
  if (authoredTestCase && authoredTestCase.preconditions !== undefined) {
    candidateTestCase.preconditions = structuredClone(authoredTestCase.preconditions);
  }
  candidateTestCase.steps = steps;
  if (authoredTestCase && authoredTestCase.globalAssertions !== undefined) {
    candidateTestCase.globalAssertions = structuredClone(authoredTestCase.globalAssertions);
  }
  if (authoredTestCase && authoredTestCase.uniquePrefix !== undefined) {
    candidateTestCase.uniquePrefix = structuredClone(authoredTestCase.uniquePrefix);
  }

  const candidateMapping = resolved.map((unit) => ({
    intentId: unit.intentId,
    atom: unit.atom,
    params: structuredClone(unit.params),
  }));
  const lineagePlan = resolved.map((unit) => ({
    mappingKey: unit.mappingKey,
    sourceIntentId: unit.intentId,
  }));

  return frozen({
    ok: true,
    candidateTestCase,
    candidateMapping,
    lineagePlan,
  });
}
