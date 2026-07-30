// 逐 capture event 的脱敏投影：compound key、业务/结构分工、structural trigger 入账。
// 纯核心：零 browser、零 fs、零 network、零 LLM。投影只保留 recipe 判定必需的已脱敏字段，
// 绝不恢复遮蔽值，也不把 URL、DOM、截图或页面对象带出（护栏 #7）。

import { normalizeTopologyPath } from '../page-topology/topology-events.mjs';

const PROJECTION_STATE = new WeakMap();

// 业务事件：可对应到某个已登记 atom 的人工动作。
const BUSINESS_ACTIONS = new Set(['click', 'dblclick', 'fill', 'press']);
// 结构事件：只记录页面交接与检查点，不建独立业务 step。
const STRUCTURAL_ACTIONS = new Set(['newpage', 'nav']);
// 只有真正可能产生页面交接的动作才可作为 newpage 的 trigger。
const HANDOFF_TRIGGER_ACTIONS = new Set(['click', 'dblclick']);

function frozen(value) {
  return Object.freeze(value);
}

function denied(reason) {
  return frozen({ ok: false, reason });
}

function evidenceOf(event) {
  return frozen({
    semanticTextPresent: typeof event.text === 'string' && event.text.length > 0,
    fieldLabelPresent: typeof event.fieldLabel === 'string' && event.fieldLabel.length > 0,
    selectorPresent: typeof event.selector === 'string' && event.selector.length > 0,
  });
}

// 语义文本只取已过敏感字段筛查的可见标签，供确定性 recipe 判定；绝不带 value。
function semanticTextOf(event) {
  return typeof event.text === 'string' && event.text ? event.text : null;
}

// intentId 只是业务归组标签：mapping 行在场时按行给出的归组名标注，缺席才退回合成序数。
// 这里既不校验 mapping，也不据此改动任何权威事实；保真校验仍在 fidelity 一处收口。
function intentLabelOf(intentIdBySeq, seq, ordinal) {
  const label = intentIdBySeq instanceof Map ? intentIdBySeq.get(seq) : undefined;
  return typeof label === 'string' && label ? label : `i${ordinal}`;
}

export function projectCaptureEvents(options = {}) {
  let capture;
  let intentIdBySeq;
  try {
    if (!options || typeof options !== 'object') return denied('UNSAFE_DATA_SHAPE');
    ({ capture, intentIdBySeq } = options);
  } catch {
    return denied('UNSAFE_DATA_SHAPE');
  }
  if (intentIdBySeq !== undefined && !(intentIdBySeq instanceof Map)) {
    return denied('UNSAFE_DATA_SHAPE');
  }
  if (!capture || typeof capture !== 'object' || Array.isArray(capture)) {
    return denied('UNSAFE_DATA_SHAPE');
  }
  if (!Array.isArray(capture.events) || capture.events.length === 0) {
    return denied('UNSAFE_DATA_SHAPE');
  }
  if (typeof capture.caseId !== 'string' || !capture.caseId) {
    return denied('UNSAFE_DATA_SHAPE');
  }

  const projection = [];
  const keys = new Set();
  const triggersWithHandoff = new Set();
  let previousSeq = 0;
  let businessOrdinal = 0;

  for (const event of capture.events) {
    if (!event || typeof event !== 'object' || Array.isArray(event)) {
      return denied('UNSAFE_DATA_SHAPE');
    }
    if (!Number.isSafeInteger(event.seq) || event.seq <= 0 || event.seq <= previousSeq) {
      return denied('CAPTURE_EVENT_SEQ_INVALID');
    }
    previousSeq = event.seq;
    const action = event.action;
    if (typeof action !== 'string' || !action) return denied('UNSAFE_DATA_SHAPE');
    const compoundKey = `${event.seq}:${action}`;
    if (keys.has(compoundKey)) return denied('CAPTURE_EVENT_KEY_DUPLICATE');
    keys.add(compoundKey);

    const path = normalizeTopologyPath({ value: event.path, format: 'capture' });
    if (!path.ok) return denied('CAPTURE_PATH_INVALID');

    if (BUSINESS_ACTIONS.has(action)) {
      businessOrdinal += 1;
      projection.push(frozen({
        compoundKey,
        intentId: intentLabelOf(intentIdBySeq, event.seq, businessOrdinal),
        eventSeq: event.seq,
        action,
        pathHint: path.path,
        role: 'business',
        semanticText: semanticTextOf(event),
        evidence: evidenceOf(event),
      }));
      continue;
    }

    if (!STRUCTURAL_ACTIONS.has(action)) return denied('UNSAFE_DATA_SHAPE');

    if (action === 'nav') {
      // nav 只是路径检查点：既不建业务 step，也没有 trigger 归属。
      projection.push(frozen({
        compoundKey,
        intentId: null,
        eventSeq: event.seq,
        action,
        pathHint: path.path,
        role: 'structural',
        triggerCompoundKey: null,
      }));
      continue;
    }

    const previous = projection[projection.length - 1];
    if (!previous
      || previous.role !== 'business'
      || !HANDOFF_TRIGGER_ACTIONS.has(previous.action)) {
      return denied('TOPOLOGY_TRIGGER_MISSING');
    }
    if (triggersWithHandoff.has(previous.compoundKey)) {
      return denied('TOPOLOGY_DUPLICATE_HANDOFF');
    }
    triggersWithHandoff.add(previous.compoundKey);
    projection.push(frozen({
      compoundKey,
      intentId: previous.intentId,
      eventSeq: event.seq,
      action,
      pathHint: path.path,
      role: 'structural',
      triggerCompoundKey: previous.compoundKey,
    }));
  }

  const projectionAuthority = frozen(Object.create(null));
  const record = frozen({
    caseId: capture.caseId,
    projection: frozen(projection),
  });
  PROJECTION_STATE.set(projectionAuthority, record);
  return frozen({
    ok: true,
    projectionAuthority,
    projection: record.projection,
    receipt: frozen({
      schemaVersion: 1,
      eventCount: projection.length,
    }),
  });
}

// 只供同进程内层模块读取投影；plain/clone 无权。
export function readProjectionAuthority(projectionAuthority) {
  return projectionAuthority && typeof projectionAuthority === 'object'
    ? PROJECTION_STATE.get(projectionAuthority) || null
    : null;
}

export const PROJECTION_ROLES = frozen({
  BUSINESS_ACTIONS,
  STRUCTURAL_ACTIONS,
  HANDOFF_TRIGGER_ACTIONS,
});
