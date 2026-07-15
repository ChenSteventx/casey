// CEF 回放规格确定性字段闸。与 tests/_golden/schemas/cef-replay-spec.schema.json 同刻；
// 返回固定问题码，不回显 selector/value/key/地址等输入内容。
export const CEF_ACTIONS = Object.freeze(['click', 'dblclick', 'fill', 'press']);

const ACTION_SET = new Set(CEF_ACTIONS);
const TOP_KEYS = new Set(['schemaVersion', 'channel', 'caseId', 'recordedAt', 'authored', 'startPath', 'events']);
const COMMON_EVENT_KEYS = new Set(['stepId', 'intentId', 'action', 'path', 'selector']);
const ID_STEP = /^atstep_[0-9]+$/;
const ID_INTENT = /^intent_[0-9]+$/;
const ID_CASE = /^tc_[a-z0-9_]+$/;

const object = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const nonempty = (v) => typeof v === 'string' && v.trim().length > 0;
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const pathOnly = (value) => typeof value === 'string'
  && value.startsWith('/')
  && !value.startsWith('//')
  && !value.includes('\\')
  && !value.includes('#')
  && !value.includes('://')
  && !/%(?:25)*3a%(?:25)*2f%(?:25)*2f/i.test(value);

export function validateCefEvent(event) {
  const problems = [];
  if (!object(event)) return { ok: false, problems: ['event.type'] };
  const action = event.action;
  const allowed = new Set(COMMON_EVENT_KEYS);
  if (action === 'fill') allowed.add('value');
  if (action === 'press') allowed.add('key');
  for (const key of Object.keys(event)) if (!allowed.has(key)) problems.push('event.unknown_field');
  if (!ID_STEP.test(event.stepId || '')) problems.push('event.step_id');
  if (!ID_INTENT.test(event.intentId || '')) problems.push('event.intent_id');
  if (!ACTION_SET.has(action)) problems.push('event.action');
  if (!pathOnly(event.path)) problems.push('event.path');
  if (!nonempty(event.selector)) problems.push('event.selector');
  if (action === 'fill' && typeof event.value !== 'string') problems.push('event.value');
  if (action !== 'fill' && Object.prototype.hasOwnProperty.call(event, 'value')) problems.push('event.value_forbidden');
  if (action === 'press' && !nonempty(event.key)) problems.push('event.key');
  if (action !== 'press' && Object.prototype.hasOwnProperty.call(event, 'key')) problems.push('event.key_forbidden');
  return { ok: problems.length === 0, problems };
}

export function validateCefReplaySpec(doc) {
  const problems = [];
  if (!object(doc)) return { ok: false, problems: ['spec.type'] };
  for (const key of Object.keys(doc)) if (!TOP_KEYS.has(key)) problems.push('spec.unknown_field');
  if (doc.schemaVersion !== 1) problems.push('spec.schema_version');
  if (doc.channel !== 'cef') problems.push('spec.channel');
  if (!ID_CASE.test(doc.caseId || '')) problems.push('spec.case_id');
  if (doc.authored !== false) problems.push('spec.authored');
  // Date.parse 还接受 01/02/2026 等实现相关写法，宽于 schema 的 date-time。
  // 运行期门必须至少钉 RFC3339 形状，避免 schema 绿、运行期又接受另一份规格。
  if (!nonempty(doc.recordedAt) || !RFC3339.test(doc.recordedAt) || Number.isNaN(Date.parse(doc.recordedAt))) problems.push('spec.recorded_at');
  if (!pathOnly(doc.startPath)) problems.push('spec.start_path');
  if (!Array.isArray(doc.events) || doc.events.length === 0) {
    problems.push('spec.events');
  } else {
    const seen = new Set();
    for (const event of doc.events) {
      const checked = validateCefEvent(event);
      for (const problem of checked.problems) problems.push(problem);
      if (object(event) && typeof event.stepId === 'string') {
        if (seen.has(event.stepId)) problems.push('event.step_id_duplicate');
        seen.add(event.stepId);
      }
    }
  }
  return { ok: problems.length === 0, problems };
}
