// 同一次 raw 物理执行内的逐 event observation：顺序、绑定与一次性 authority。
// 纯核心：零 browser、零 fs、零 network、零 LLM，也不裁定。真实观察由 canonical raw issuer
// 私下绑定的共用 collector 提供；本模块只负责 attribution、顺序门与 authority 铸造。
//
// mapping 此刻尚不存在，所以每个 event 采的是 signed expected 的完整 assertion universe；
// 选哪一条属于哪个 intent 是 resolved 之后的事（runtime-seams-design §4）。

import { createHash } from 'node:crypto';
import { inspectAdmittedRawReplayCapture } from './raw-capture.mjs';
import { inspectCleanRawReplayAuthority } from './raw-proof.mjs';
import {
  captureIntentObservationBaseline,
  captureIntentObservationTerminal,
} from '../replay/intent-observation.mjs';
import { settleBeforeCapture } from '../replay-settle.mjs';
import { normalizeRefusalReason, safeEmit } from './cycle-evidence-context.mjs';

const SESSION_STATE = new WeakMap();
const OBSERVATION_STATE = new WeakMap();

const CREATE_KEYS = [
  'captureAuthority',
  'collector',
  'executionTargetAuthority',
  'expectedBytes',
  'forensics',
  'pageErrors',
  'runExecutionAuthority',
  'state',
];
const BEGIN_KEYS = ['seq', 'sessionAuthority', 'topologyAuthority'];
const FINISH_KEYS = ['actionAxis', 'seq', 'sessionAuthority', 'topologyAuthority'];
const SEAL_KEYS = ['cleanProofAuthority', 'sessionAuthority'];

function frozen(value) {
  return Object.freeze(value);
}

function denied(reason) {
  return frozen({ ok: false, reason });
}

function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.keys(value).sort().join(' ') === [...expected].sort().join(' ');
}

// 取证旁路：观测面拒付照原样通报归因与稳定码，返回值、键集与控制流一字不动。
function reportObservationRefusal(refusalPoint, outcome) {
  safeEmit(refusalPoint, {
    stage: 'source-raw-execute',
    reason: normalizeRefusalReason(outcome?.reason),
  });
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object') return value;
  for (const item of Object.values(value)) deepFreeze(item);
  return Object.freeze(value);
}

// topology 事实只能来自现役 replay topology controller；plain/空对象无法提供活动页 authority。
function usableTopology(topologyAuthority) {
  return !!topologyAuthority && typeof topologyAuthority === 'object'
    && typeof topologyAuthority.activePageAuthority === 'function';
}

function readExpected(bytes) {
  let doc;
  try {
    doc = JSON.parse(bytes.toString('utf8'));
  } catch {
    return null;
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return null;
  if (!Array.isArray(doc.intents)) return null;
  const globalAssertions = Array.isArray(doc.globalAssertions) ? doc.globalAssertions : [];
  const intents = [];
  for (const intent of doc.intents) {
    if (!intent || typeof intent !== 'object' || Array.isArray(intent)) return null;
    if (typeof intent.intentId !== 'string' || !intent.intentId) return null;
    if (!Array.isArray(intent.expected)) return null;
    intents.push({ intentId: intent.intentId, expected: intent.expected });
  }
  // assertion universe = 全部 authored expected + global；此刻不做任何 event→intent 归属。
  const assertionUniverse = deepFreeze(structuredClone([
    ...intents.flatMap((intent) => intent.expected),
    ...globalAssertions,
  ]));
  return {
    caseId: typeof doc.caseId === 'string' ? doc.caseId : null,
    intents: deepFreeze(structuredClone(intents)),
    globalAssertions: deepFreeze(structuredClone(globalAssertions)),
    assertionUniverse,
    chatCfg: doc.chatCfg && typeof doc.chatCfg === 'object' ? deepFreeze(structuredClone(doc.chatCfg)) : null,
  };
}

function collectorInput(record, seq, stepId) {
  return {
    seq,
    stepId,
    assertionUniverse: record.expected.assertionUniverse,
    state: record.state,
    forensics: record.forensics,
    pageErrors: record.pageErrors,
  };
}

function forensicsForStep(record, stepId) {
  let rows;
  try {
    rows = record.forensics?.records?.();
  } catch {
    return [];
  }
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => row && row.attributedStepId === stepId);
}

export function createRawEventObservationSession(options = {}) {
  const outcome = createSessionCore(options);
  if (outcome?.ok !== true) reportObservationRefusal('source-completion.observation', outcome);
  return outcome;
}

function createSessionCore(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    return denied('RAW_OBSERVATION_INPUT_INVALID');
  }
  // 调用方绝不能提交 observations、mapping、axes 或 verdict 事实。
  if (!exactKeys(options, CREATE_KEYS)) return denied('RAW_OBSERVATION_INPUT_INVALID');
  const {
    captureAuthority,
    runExecutionAuthority,
    expectedBytes,
    executionTargetAuthority,
    collector,
    state,
    forensics,
    pageErrors,
  } = options;
  if (!runExecutionAuthority || typeof runExecutionAuthority !== 'object') {
    return denied('RAW_OBSERVATION_INPUT_INVALID');
  }
  if (!executionTargetAuthority || typeof executionTargetAuthority !== 'object') {
    return denied('RAW_OBSERVATION_INPUT_INVALID');
  }
  if (!collector || typeof collector !== 'object'
    || typeof collector.captureBaseline !== 'function'
    || typeof collector.captureTerminal !== 'function') {
    return denied('RAW_OBSERVATION_INPUT_INVALID');
  }
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return denied('RAW_OBSERVATION_INPUT_INVALID');
  }
  if (!forensics || typeof forensics !== 'object') {
    return denied('RAW_OBSERVATION_INPUT_INVALID');
  }
  if (!Array.isArray(pageErrors)) return denied('RAW_OBSERVATION_INPUT_INVALID');
  const bytes = Buffer.isBuffer(expectedBytes) || expectedBytes instanceof Uint8Array
    ? Buffer.from(expectedBytes)
    : null;
  if (!bytes || bytes.length === 0) return denied('RAW_OBSERVATION_INPUT_INVALID');
  // expected 在创建时复制、解析并冻结：调用方随后 mutate 同一 Buffer 无效。
  const expected = readExpected(bytes);
  if (!expected) return denied('RAW_OBSERVATION_INPUT_INVALID');

  const inspected = inspectAdmittedRawReplayCapture({ captureAuthority });
  if (inspected.ok !== true) return denied('RAW_OBSERVATION_INPUT_INVALID');
  const events = inspected.capture.events.map((event) => frozen({
    seq: event.seq,
    action: event.action,
    eventKey: `${event.seq}:${event.action}`,
    stepId: `rawstep_${event.seq}`,
  }));

  const sessionAuthority = frozen(Object.create(null));
  SESSION_STATE.set(sessionAuthority, {
    caseId: inspected.capture.caseId,
    captureAuthority,
    captureSha256: inspected.captureSha256,
    expectedSha256: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
    expected,
    events,
    runExecutionAuthority,
    executionTargetAuthority,
    topologyAuthority: null,
    collector,
    state,
    forensics,
    pageErrors,
    observations: [],
    index: 0,
    open: null,
    poisoned: false,
    sealed: false,
  });
  return frozen({ ok: true, sessionAuthority });
}

function loadSession(sessionAuthority, topologyAuthority) {
  const record = sessionAuthority && typeof sessionAuthority === 'object'
    ? SESSION_STATE.get(sessionAuthority)
    : null;
  if (!record) return { reason: 'RAW_OBSERVATION_AUTHORITY_INVALID' };
  if (!usableTopology(topologyAuthority)) {
    return { reason: 'RAW_OBSERVATION_AUTHORITY_INVALID' };
  }
  if (record.topologyAuthority && record.topologyAuthority !== topologyAuthority) {
    return { reason: 'RAW_OBSERVATION_AUTHORITY_INVALID' };
  }
  if (record.sealed) return { reason: 'RAW_OBSERVATION_AUTHORITY_INVALID' };
  return { record };
}

export async function beginRawEvent(options = {}) {
  const outcome = await beginRawEventCore(options);
  if (outcome?.ok !== true) reportObservationRefusal('observer.begin', outcome);
  return outcome;
}

async function beginRawEventCore(options) {
  if (!exactKeys(options, BEGIN_KEYS)) return denied('RAW_OBSERVATION_INPUT_INVALID');
  const loaded = loadSession(options.sessionAuthority, options.topologyAuthority);
  if (loaded.reason) return denied(loaded.reason);
  const record = loaded.record;
  if (record.poisoned) return denied('RAW_OBSERVATION_SEQUENCE_INVALID');
  if (record.open) return denied('RAW_OBSERVATION_SEQUENCE_INVALID');
  const event = record.events[record.index];
  if (!event || event.seq !== options.seq) {
    return denied('RAW_OBSERVATION_SEQUENCE_INVALID');
  }
  record.topologyAuthority = options.topologyAuthority;
  // begin → terminal 期间 attribution 保持同一 synthetic step：
  // response wait、stream settle、pageerror 与 network 都因此归属本 event。
  record.state.currentStepId = event.stepId;
  let before;
  try {
    before = await record.collector.captureBaseline(collectorInput(record, event.seq, event.stepId));
  } catch {
    record.poisoned = true;
    record.state.currentStepId = null;
    return denied('RAW_OBSERVATION_COLLECTION_FAILED');
  }
  if (!before || typeof before !== 'object' || Array.isArray(before)) {
    record.poisoned = true;
    record.state.currentStepId = null;
    return denied('RAW_OBSERVATION_COLLECTION_FAILED');
  }
  record.open = { event, before: structuredClone(before) };
  return frozen({ ok: true });
}

export async function finishRawEvent(options = {}) {
  const outcome = await finishRawEventCore(options);
  if (outcome?.ok !== true) reportObservationRefusal('observer.finish', outcome);
  return outcome;
}

async function finishRawEventCore(options) {
  if (!exactKeys(options, FINISH_KEYS)) return denied('RAW_OBSERVATION_INPUT_INVALID');
  const loaded = loadSession(options.sessionAuthority, options.topologyAuthority);
  if (loaded.reason) return denied(loaded.reason);
  const record = loaded.record;
  if (record.poisoned) return denied('RAW_OBSERVATION_SEQUENCE_INVALID');
  if (!record.open || record.open.event.seq !== options.seq) {
    return denied('RAW_OBSERVATION_SEQUENCE_INVALID');
  }
  const actionAxis = options.actionAxis;
  if (!actionAxis || typeof actionAxis !== 'object' || Array.isArray(actionAxis)
    || typeof actionAxis.resolution !== 'string') {
    return denied('RAW_OBSERVATION_INPUT_INVALID');
  }
  const event = record.open.event;
  let after;
  try {
    after = await record.collector.captureTerminal({
      ...collectorInput(record, event.seq, event.stepId),
      actionAxis: deepFreeze(structuredClone(actionAxis)),
    });
  } catch {
    record.poisoned = true;
    record.state.currentStepId = null;
    return denied('RAW_OBSERVATION_COLLECTION_FAILED');
  }
  if (!after || typeof after !== 'object' || Array.isArray(after)) {
    record.poisoned = true;
    record.state.currentStepId = null;
    return denied('RAW_OBSERVATION_COLLECTION_FAILED');
  }
  record.observations.push(frozen({
    seq: event.seq,
    eventKey: event.eventKey,
    stepId: event.stepId,
    action: event.action,
    actionAxis: deepFreeze(structuredClone(actionAxis)),
    before: deepFreeze(record.open.before),
    after: deepFreeze(structuredClone(after)),
    forensics: deepFreeze(structuredClone(forensicsForStep(record, event.stepId))),
  }));
  record.open = null;
  record.index += 1;
  // 采完 terminal observation 之后才清 attribution，不在动作后立刻清空。
  record.state.currentStepId = null;
  return frozen({ ok: true });
}

export function sealRawEventObservations(options = {}) {
  const outcome = sealRawEventObservationsCore(options);
  if (outcome?.ok !== true) reportObservationRefusal('source-completion.observation', outcome);
  return outcome;
}

function sealRawEventObservationsCore(options) {
  if (!exactKeys(options, SEAL_KEYS)) return denied('RAW_OBSERVATION_INPUT_INVALID');
  const record = options.sessionAuthority && typeof options.sessionAuthority === 'object'
    ? SESSION_STATE.get(options.sessionAuthority)
    : null;
  if (!record || record.sealed) return denied('RAW_OBSERVATION_AUTHORITY_INVALID');
  if (record.poisoned || record.open || record.observations.length !== record.events.length) {
    return denied('RAW_OBSERVATION_INCOMPLETE');
  }
  // 只有同一次 run 返回的 genuine CLEAN authority 才能封存；先跑完再离线补采不满足 same-run。
  const proof = inspectCleanRawReplayAuthority({
    cleanProofAuthority: options.cleanProofAuthority,
  });
  if (proof.ok !== true || proof.captureSha256 !== record.captureSha256) {
    return denied('RAW_OBSERVATION_AUTHORITY_INVALID');
  }
  const rawObservationAuthority = frozen(Object.create(null));
  OBSERVATION_STATE.set(rawObservationAuthority, {
    consumed: false,
    session: record,
  });
  record.sealed = true;
  return frozen({ ok: true, rawObservationAuthority });
}

// 非消费式验真：只暴露最小元数据，不开放 observation、expected 或动作事实。
export function inspectRawEventObservationAuthority(options = {}) {
  const state = options && typeof options === 'object'
    && options.rawObservationAuthority
    && typeof options.rawObservationAuthority === 'object'
    ? OBSERVATION_STATE.get(options.rawObservationAuthority)
    : null;
  if (!state) return denied('RAW_OBSERVATION_AUTHORITY_INVALID');
  const record = state.session;
  return frozen({
    ok: true,
    captureSha256: record.captureSha256,
    // R10：暴露 caseId 与 expectedSha256 纯摘要，供 raw-axes 非消费预检对齐绑定核——
    // 错绑在消费前即拒，不烧 genuine 一次性 authority；不暴露 expected 内容本身。
    caseId: record.caseId,
    expectedSha256: record.expectedSha256,
    eventSeqs: record.observations.map((row) => row.seq),
    observationCount: record.observations.length,
    runExecutionAuthority: record.runExecutionAuthority,
  });
}

// 一次性内部 consumer：只供 canonical raw axes adapter 在 resolved 之后聚合。
export function consumeRawObservationAuthority(options = {}) {
  const state = options && typeof options === 'object'
    && options.rawObservationAuthority
    && typeof options.rawObservationAuthority === 'object'
    ? OBSERVATION_STATE.get(options.rawObservationAuthority)
    : null;
  if (!state || state.consumed) return denied('RAW_OBSERVATION_AUTHORITY_INVALID');
  state.consumed = true;
  const record = state.session;
  return frozen({
    ok: true,
    projection: frozen({
      caseId: record.caseId,
      captureSha256: record.captureSha256,
      expectedSha256: record.expectedSha256,
      runExecutionAuthority: record.runExecutionAuthority,
      executionTargetAuthority: record.executionTargetAuthority,
      topologyAuthority: record.topologyAuthority,
      expected: frozen({
        intents: record.expected.intents,
        globalAssertions: record.expected.globalAssertions,
      }),
      events: frozen([...record.observations]),
      pageErrors: record.pageErrors,
      records: forensicsRecords(record),
      chatCfg: record.expected.chatCfg,
    }),
  });
}

function forensicsRecords(record) {
  let rows;
  try {
    rows = record.forensics?.records?.();
  } catch {
    return [];
  }
  return Array.isArray(rows) ? rows : [];
}

// 同一次物理 raw 执行的 session 编排：先建 session，再把唯一 eventObserver 闭包接到 raw runner，
// 只有同一调用返回 genuine CLEAN 才 seal。编排层只做装配，本函数不裁定也不产 axes/verdict。
export async function runObservedRawReplay({
  execution, owner, runRawReplay, actionDriver,
}) {
  const state = owner.state || { currentStepId: null };
  const pageErrors = Array.isArray(owner.pageErrors) ? owner.pageErrors : [];
  const forensics = owner.forensics || frozen({
    records: () => [],
    inFlightCount: () => 0,
  });
  const session = createRawEventObservationSession({
    captureAuthority: execution.captureAuthority,
    runExecutionAuthority: execution.runExecutionAuthority,
    expectedBytes: execution.expectedBytes,
    executionTargetAuthority: execution.executionTargetAuthority,
    collector: createCanonicalRawObservationCollector({
      page: owner.page, profile: {}, forensics,
    }),
    state,
    forensics,
    pageErrors,
  });
  if (session.ok !== true) return denied(session.reason);
  const sessionAuthority = session.sessionAuthority;
  const raw = await runRawReplay({
    captureAuthority: execution.captureAuthority,
    freshRuntimeAuthority: execution.freshRuntimeAuthority,
    topologyAuthority: execution.topologyAuthority,
    executionTargetAuthority: execution.executionTargetAuthority,
    actionDriver,
    eventObserver: frozen({
      begin: (input) => beginRawEvent({ ...input, sessionAuthority }),
      finish: (input) => finishRawEvent({ ...input, sessionAuthority }),
    }),
  });
  if (raw?.ok !== true) return denied(raw?.reason || 'RUN_COMPLETION_INVALID');
  const sealed = sealRawEventObservations({
    sessionAuthority, cleanProofAuthority: raw.cleanProofAuthority,
  });
  if (sealed.ok !== true) return denied(sealed.reason);
  return frozen({
    ok: true,
    runExecutionAuthority: execution.runExecutionAuthority,
    runtimeOwnerAuthority: execution.runtimeOwnerAuthority,
    rawObservationAuthority: sealed.rawObservationAuthority,
    artifacts: execution.artifacts,
    rawReplay: frozen({ status: raw.status, cleanProofAuthority: raw.cleanProofAuthority }),
  });
}

// canonical raw issuer 私下绑定的共用 collector：begin 恰调用一次 baseline 原语，
// finish 在动作/settle 之后恰调用一次 terminal 原语。它不选 intent、不裁定，
// 只把同一份 signed expected assertion universe 交给与 formal runner 相同的观察实现。
export function createCanonicalRawObservationCollector({
  page, profile, countSelector, buttons, forensics,
} = {}) {
  const chat = profile?.chat && typeof profile.chat === 'object' ? profile.chat : null;
  const replySelector = (chat && chat.replySelector) || '.hr-chat__text__assistant';
  const replyBaselines = new Map();
  return frozen({
    async captureBaseline({ seq, assertionUniverse }) {
      const baseline = await captureIntentObservationBaseline({
        page, countSelector, chat, replySelector,
      });
      replyBaselines.set(seq, baseline.replyBaseline);
      return { count: baseline.count, assertionCount: assertionUniverse.length };
    },
    async captureTerminal({ seq, assertionUniverse, actionAxis }) {
      // formal 代表步与 raw event 必须在同一条件式静默点之后采 terminal：raw 此刻尚无
      // resolved mapping，不能猜哪一条 event 是 intent tail，故每条都做同一有界观察。
      const settleFloor = Number(process.env.REPLAY_SETTLE_FLOOR_MS);
      const settleBudget = Number(process.env.REPLAY_SETTLE_BUDGET_MS);
      await settleBeforeCapture(page, {
        inFlight: typeof forensics?.inFlightCount === 'function'
          ? () => forensics.inFlightCount()
          : () => 0,
        floorMs: Number.isFinite(settleFloor) && settleFloor >= 0
          ? settleFloor
          : undefined,
        budgetMs: Number.isFinite(settleBudget) && settleBudget > 0
          ? settleBudget
          : undefined,
        profile: profile || {},
        log: () => {},
      });
      const terminal = await captureIntentObservationTerminal({
        page,
        countSelector,
        chat,
        replySelector,
        replyBaseline: replyBaselines.get(seq) ?? null,
        assertions: assertionUniverse,
        buttons,
      });
      return { ...terminal, actionAxis };
    },
  });
}
