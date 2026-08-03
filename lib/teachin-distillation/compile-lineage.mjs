// 只观察现役 compile 的 step/event 边界：mappingKey → sourceIntentId → stepId[] 的精确回链。
// 不执行动作、不生成 locator、不解释 atom、不复制编译器。
// 纯核心：零 browser、零 fs、零 network、零 LLM。

const LINEAGE_ROW_KEYS = ['mappingKey', 'sourceIntentId', 'stepIds'];

function frozen(value) {
  return Object.freeze(value);
}

function denied() {
  return frozen({ ok: false, reason: 'COMPILE_LINEAGE_MISMATCH' });
}

function isPlainRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function validateCompileLineage(options = {}) {
  let lineagePlan;
  let compileLineage;
  let compiledEvents;
  try {
    if (!options || typeof options !== 'object') return denied();
    ({ lineagePlan, compileLineage, compiledEvents } = options);
  } catch {
    return denied();
  }
  if (!Array.isArray(lineagePlan) || !Array.isArray(compileLineage)) return denied();
  if (!Array.isArray(compiledEvents)) return denied();
  if (compileLineage.length !== lineagePlan.length) return denied();

  const planByKey = new Map(lineagePlan.map((row) => [row.mappingKey, row]));
  const eventStepIds = new Map();
  for (const event of compiledEvents) {
    if (!isPlainRecord(event)) return denied();
    if (typeof event.stepId !== 'string' || !event.stepId) return denied();
    if (eventStepIds.has(event.stepId)) return denied();
    eventStepIds.set(event.stepId, event);
  }

  const seenKeys = new Set();
  const claimedStepIds = new Set();
  for (const row of compileLineage) {
    if (!isPlainRecord(row)) return denied();
    if (Object.keys(row).sort().join(',') !== LINEAGE_ROW_KEYS.join(',')) return denied();
    const plan = planByKey.get(row.mappingKey);
    if (!plan) return denied();
    if (seenKeys.has(row.mappingKey)) return denied();
    seenKeys.add(row.mappingKey);
    if (row.sourceIntentId !== plan.sourceIntentId) return denied();
    if (!Array.isArray(row.stepIds) || row.stepIds.length === 0) return denied();
    for (const stepId of row.stepIds) {
      if (typeof stepId !== 'string' || !stepId) return denied();
      const event = eventStepIds.get(stepId);
      if (!event || event.intentId !== row.sourceIntentId) return denied();
      // 同一 stepId 不得跨 mapping 重复入账。
      if (claimedStepIds.has(stepId)) return denied();
      claimedStepIds.add(stepId);
    }
  }
  if (seenKeys.size !== planByKey.size) return denied();
  // 每个已编译事件都必须被恰好一条 lineage 入账，杜绝未归属事件。
  if (claimedStepIds.size !== eventStepIds.size) return denied();

  return frozen({ ok: true, reason: null });
}
