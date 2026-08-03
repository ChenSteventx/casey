// 闭环取证边车（开发期）的纯上下文层：模块级 AsyncLocalStorage 词法边界、
// 旁路通报 safeEmit、固定枚举与封存式收集器。
// 纯层纪律：零 fs、零 network、零 browser、零裁定，也绝不认识落盘面——
// 写盘只在同族 output 件里，纯核心一律只导入本件（依赖闭包由金牌逐条钉）。
// 收集器语义 = 只追加、遇毒整批作废：任一条形状非法就把整批标记为中毒、最终拒写，
// 绝不静默丢单条冒充完整。封存之后迟到的击发只计数，不入档。

import { AsyncLocalStorage } from 'node:async_hooks';

export const CYCLE_EVIDENCE_SCHEMA_VERSION = 1;
export const CYCLE_EVIDENCE_ARTIFACT_KIND = 'cycle-evidence';

// 归因枚举：每个同码生产拒付点一员——本契约的完成语义就是逐点可唯一归因。
// input-shape 三员钉的是三枚 completion 公开导出面的 extraInputs 闭合键校验：
// canonical 编排恒传闭合键，但函数由 dual-replay façade 公开导出、外部调用方可达，
// 故按「公开可达即须逐点归因」补齐，不按「当前录制链不可达」挂账（codex code-r1 M2）。
// resolved 那枚同形同理由，只是拒付码为 SOURCE_SEMANTIC_COMPLETION_INVALID。
export const CYCLE_EVIDENCE_REFUSAL_POINTS = Object.freeze([
  'source-completion.input-shape',
  'source-completion.issuer-throw',
  'source-completion.result-shape',
  'source-completion.artifact',
  'source-completion.raw-status',
  'source-completion.proof',
  'source-completion.observation',
  'resolved-completion.input-shape',
  'resolved-completion.issuer-throw',
  'resolved-completion.result-shape',
  'distilled-completion.input-shape',
  'distilled-completion.issuer-throw',
  'distilled-completion.result-shape',
  'distilled-completion.artifact',
  'observer.begin',
  'observer.finish',
  'raw-runner.event',
  'formal-replay.refusal',
  'prepared-runtime.claim',
  'prepared-runtime.preflight',
  'orchestrator.stage-boundary',
  'raw-axes.projection-denied',
]);

// 阶段枚举：编排核心编号步的归组，供人按闭环时序读边车。
export const CYCLE_EVIDENCE_STAGES = Object.freeze([
  'source-plan',
  'source-runtime-claim',
  'source-raw-execute',
  'source-resolved-completion',
  'source-runtime-close',
  'distilled-seal',
  'pair-finalize',
  'source-receipt',
  'distilled-runtime-prepare',
  'distilled-completion',
  'distilled-receipt',
  'pair-compare',
]);

// 事件白名单：白名单之外一律不许出现，任何一个都是「私有事实经取证通道外泄」。
export const CYCLE_EVIDENCE_EVENT_KEYS = Object.freeze([
  'stage', 'refusalPoint', 'reason', 'errorName',
  'seq', 'action', 'resolution', 'candidateCount', 'performOk',
]);

// 异常名只认内建白名单；未知或安全读取失败一律降格 OtherError。
export const CYCLE_EVIDENCE_ERROR_NAMES = Object.freeze([
  'Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError',
  'EvalError', 'URIError', 'AggregateError', 'OtherError',
]);

// 拒付码闭合枚举：全部取自现役生产件的稳定码，枚举外的自由串一律降格 OTHER_REASON。
export const CYCLE_EVIDENCE_REASONS = Object.freeze([
  'OTHER_REASON',
  'RUN_COMPLETION_INVALID', 'RUN_COMPLETION_BINDING_MISMATCH', 'RUN_COMPLETION_AUTHORITY_INVALID',
  'REPLAY_ISSUER_INVALID', 'RAW_EXECUTION_AUTHORITY_INVALID',
  'SOURCE_SEMANTIC_COMPLETION_INVALID', 'SOURCE_SEMANTIC_BINDING_MISMATCH',
  'SOURCE_SEMANTIC_GRANT_INVALID', 'RESOLVED_PROJECTION_AUTHORITY_INVALID',
  'RAW_CAPTURE_AUTHORITY_INVALID', 'RAW_CAPTURE_INPUT_INVALID', 'RAW_CAPTURE_INVALID',
  'CAPTURE_CASE_MISMATCH', 'CAPTURE_EVENTS_EMPTY', 'CAPTURE_HASH_MISMATCH',
  'CAPTURE_PATH_INVALID', 'CAPTURE_SEQ_DUPLICATE', 'CAPTURE_SEQ_GAP', 'CAPTURE_SEQ_INVALID',
  'CLEAN_PROOF_AUTHORITY_INVALID', 'FRESH_RUNTIME_AUTHORITY_INVALID',
  'FRESH_RUNTIME_WITNESS_INVALID', 'RECORDING_RUNTIME_NOT_CLOSED',
  'REPLAY_RUNTIME_NOT_FRESH', 'REPLAY_RUNTIME_NOT_LIVE',
  'REPLAY_RUNTIME_OWNERSHIP_MISMATCH', 'REPLAY_RUNTIME_REUSED',
  'PATH_CHECKPOINT_MISMATCH', 'PATH_CHECKPOINT_UNAVAILABLE',
  'TOPOLOGY_PATH_MISMATCH', 'TOPOLOGY_CONSUME_FAILED', 'NO_ACTIVE_PAGE',
  'RAW_ACTION_INVALID', 'RAW_NAV_MUST_NOT_GOTO', 'FILL_VALUE_UNAVAILABLE',
  'MASKED_FILL_UNREPLAYABLE', 'SELECTOR_NONE', 'SELECTOR_AMBIGUOUS', 'SELECTOR_UNAVAILABLE',
  'ACTION_FAILED', 'RAW_REPLAY_INTERNAL_ERROR',
  'RAW_OBSERVATION_INPUT_INVALID', 'RAW_OBSERVATION_AUTHORITY_INVALID',
  'RAW_OBSERVATION_SEQUENCE_INVALID', 'RAW_OBSERVATION_INCOMPLETE',
  'RAW_OBSERVATION_COLLECTION_FAILED',
  'RAW_AXES_PROJECTION_INVALID', 'RAW_AXES_PROJECTION_FAILED', 'RAW_AXES_BINDING_MISMATCH',
  'VERDICT_EXECUTION_FAILED', 'EXECUTION_TARGET_AUTHORITY_INVALID',
  'REPLAY_EXPECTED_CONTRACT_UNSIGNED', 'REPLAY_EXPECTED_CASE_BINDING_INVALID',
  'REPLAY_WORKFLOW_DELETE_BINDING_INVALID', 'REPLAY_ENTITY_ADMISSION_INVALID',
  'REPLAY_ENTITY_ANCHOR_INVALID',
  'ORCHESTRATOR_INPUT_INVALID', 'ORCHESTRATOR_STAGE_FAILED',
  'SOURCE_PREPARED_RUNTIME_DISPOSE_FAILED', 'SOURCE_RUNTIME_CLOSE_FAILED',
  'DISTILLED_RUNTIME_CLOSE_FAILED',
]);

// 动作轴两枚闭合词表：逐事件面沿用主循环已有的动作与解析轴，枚举外降格 other。
export const CYCLE_EVIDENCE_ACTIONS = Object.freeze([
  'click', 'dblclick', 'fill', 'press', 'nav', 'newpage', 'other',
]);
export const CYCLE_EVIDENCE_RESOLUTIONS = Object.freeze([
  'unique', 'none', 'ambiguous', 'internal_error', 'action_failed',
  'checkpoint_failed', 'action_invalid', 'topology_failed', 'other',
]);

// 单次 cycle 的事件上限：越界即毒化（宁可整批拒写，也不静默截断冒充完整）。
const MAX_EVENTS = 4096;

const REFUSAL_POINT_SET = new Set(CYCLE_EVIDENCE_REFUSAL_POINTS);
const STAGE_SET = new Set(CYCLE_EVIDENCE_STAGES);
const EVENT_KEY_SET = new Set(CYCLE_EVIDENCE_EVENT_KEYS);
const ERROR_NAME_SET = new Set(CYCLE_EVIDENCE_ERROR_NAMES);
const REASON_SET = new Set(CYCLE_EVIDENCE_REASONS);
const ACTION_SET = new Set(CYCLE_EVIDENCE_ACTIONS);
const RESOLUTION_SET = new Set(CYCLE_EVIDENCE_RESOLUTIONS);

// 收集器只是一枚不透明令牌：真实状态藏在模块私有表里，异物令牌天然取不到任何东西。
const COLLECTOR_STATE = new WeakMap();
const cycleEvidenceStore = new AsyncLocalStorage();

const EMPTY_VIEW = Object.freeze({
  sealed: false, poisoned: false, lateEmitCount: 0, events: Object.freeze([]),
});

function counted(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

// 逐字段类型门：一切串出自固定枚举，数值限非负安全整数，布尔只认真布尔。
function legalField(key, value) {
  switch (key) {
    case 'stage': return STAGE_SET.has(value);
    case 'reason': return REASON_SET.has(value);
    case 'errorName': return ERROR_NAME_SET.has(value);
    case 'action': return ACTION_SET.has(value);
    case 'resolution': return RESOLUTION_SET.has(value);
    case 'seq': return counted(value);
    case 'candidateCount': return counted(value);
    case 'performOk': return typeof value === 'boolean';
    default: return false;
  }
}

// 形状投影：任何一处越界（枚举外归因、白名单外键、类型不符、读取即抛）都返回 null = 毒化整批。
function projectRecord(refusalPoint, payload) {
  try {
    if (!REFUSAL_POINT_SET.has(refusalPoint)) return null;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    const record = { refusalPoint };
    for (const key of Reflect.ownKeys(payload)) {
      if (typeof key !== 'string') return null;
      if (key === 'refusalPoint' || !EVENT_KEY_SET.has(key)) return null;
      const value = Reflect.get(payload, key);
      if (!legalField(key, value)) return null;
      record[key] = value;
    }
    // 阶段是人读边车的时序骨架：缺阶段的通报不算合格取证。
    if (!STAGE_SET.has(record.stage)) return null;
    return Object.freeze(record);
  } catch {
    return null;
  }
}

function readState(collector) {
  try {
    return (collector && typeof collector === 'object'
      ? COLLECTOR_STATE.get(collector) : null) || null;
  } catch {
    return null;
  }
}

function viewOf(state) {
  return Object.freeze({
    sealed: state.sealed === true,
    poisoned: state.poisoned === true,
    lateEmitCount: state.lateEmitCount,
    events: Object.freeze(state.events.slice()),
  });
}

// 铸一枚本次 cycle 专属的收集器；跨 cycle 绝不共享，并发双 cycle 因此天然零串账。
export function createCycleEvidenceCollector() {
  const collector = Object.freeze(Object.create(null));
  COLLECTOR_STATE.set(collector, {
    events: [], poisoned: false, sealed: false, lateEmitCount: 0, snapshot: null,
  });
  return collector;
}

// 词法边界：单次 cycle 整段包在 run 里，返回值原样透传；无词法退出的写法一律不用。
export function runWithCycleEvidence(collector, body) {
  if (typeof body !== 'function') return undefined;
  return cycleEvidenceStore.run(collector, body);
}

// 旁路通报：同步、零返回值、吞异常、不进异步控制流——取证故障绝不回流生产路径。
export function safeEmit(refusalPoint, payload) {
  let state = null;
  try {
    state = readState(cycleEvidenceStore.getStore());
    if (!state) return;
    if (state.sealed === true) {
      state.lateEmitCount += 1;
      return;
    }
    const record = projectRecord(refusalPoint, payload);
    if (record === null || state.events.length >= MAX_EVENTS) {
      state.poisoned = true;
      return;
    }
    state.events.push(record);
  } catch {
    if (state) state.poisoned = true;
  }
}

// 封存：聚合之前调用一次，之后迟到的击发只计数不入档；重复封存幂等。
export function sealCycleEvidence(collector) {
  const state = readState(collector);
  if (!state) return EMPTY_VIEW;
  state.sealed = true;
  if (!state.snapshot) state.snapshot = viewOf(state);
  return state.snapshot;
}

// 非封存读：给诊断与金牌看当下账面（含封存后迟到计数）。
export function inspectCycleEvidence(collector) {
  const state = readState(collector);
  return state ? viewOf(state) : EMPTY_VIEW;
}

// 异常名安全规范化：读取用 Reflect.get 包 try 防抛错 getter，白名单外一律降格 OtherError。
export function normalizeErrorName(thrown) {
  let name;
  try {
    if (!thrown || (typeof thrown !== 'object' && typeof thrown !== 'function')) {
      return 'OtherError';
    }
    name = Reflect.get(thrown, 'name');
  } catch {
    return 'OtherError';
  }
  return typeof name === 'string' && ERROR_NAME_SET.has(name) ? name : 'OtherError';
}

// 三枚降格器：生产点把自由串折成闭合枚举之后才通报，绝不拿自由串直塞取证通道。
export function normalizeRefusalReason(value) {
  return REASON_SET.has(value) ? value : 'OTHER_REASON';
}

export function normalizeActionName(value) {
  return ACTION_SET.has(value) ? value : 'other';
}

export function normalizeResolutionName(value) {
  return RESOLUTION_SET.has(value) ? value : 'other';
}
