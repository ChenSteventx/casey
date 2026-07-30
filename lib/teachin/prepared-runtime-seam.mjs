// 已归属 distilled runtime 内 formal replay 的 canonical claim + preflight 接缝。
// 它是 lib/replay/prepared-run.mjs 的两枚生产依赖：
//   inspectClaimedReplayRuntime —— 只核 authority 归属并把本次 run 的 exact 事实装配成
//     现役 event runner / axes projector 的入参；
//   runCanonicalPreflight —— 在任何页面动作之前跑现役签名、profile、workflow delete binding、
//     entity admission、实体锚与 origin admission 诸门，一门不过就零动作。
// 纪律：不 launch、不 login、不关闭 runtime、不裁定；失败一律闭合 {ok:false,reason}，
// 不回显异常原文、地址、会话值或半成品 authority。

import { assertSignedContract } from '../sign-gate.mjs';
import { validateWorkflowDeleteBindings } from '../workflow-delete-spec.mjs';
import { projectReplayAssertion, validateReplayEntityAnchors } from '../replay-entity-anchor.mjs';
import { checkReplayEntityAdmission } from '../entity-semantic-lock-preflight.mjs';
import { normalizeLoadingProfile } from '../replay-settle.mjs';
import { createReplayOriginAdmission } from '../replay/origin-admission.mjs';
import { projectExecutionTargetRuntime } from '../execution-target/runtime.mjs';
import { consumeFreshReplayRuntimeAuthority } from './fresh-runtime.mjs';
import { readRuntimeOwner } from './runtime-owner.mjs';
import { verifyDistilledEntityAdmission } from './entity-lock-verifier.mjs';
import { normalizeRefusalReason, safeEmit } from './cycle-evidence-context.mjs';

const CLAIM_INPUT_KEYS = [
  'runExecutionAuthority',
  'freshRuntimeAuthority',
  'topologyAuthority',
  'runtimeOwnerAuthority',
  'executionTargetAuthority',
];
const PREFLIGHT_INPUT_KEYS = [
  'runExecutionAuthority',
  'runtimeOwnerAuthority',
  'page',
  'execution',
  'eventRunnerInput',
  'axesProjectionInput',
];
const OWNERSHIP_MISMATCH = 'REPLAY_RUNTIME_OWNERSHIP_MISMATCH';
const COMPLETION_INVALID = 'RUN_COMPLETION_INVALID';
const NAMESPACE_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

// canonical issuer 已经开箱的 run execution 只在同进程内暂存一次，供本接缝取用；
// opaque authority 本身仍是唯一钥匙，plain/clone/foreign 取不到任何东西。
const STAGED_EXECUTIONS = new WeakMap();
// preflight 阶段的私有暂存：只有本模块 inspect 产出的入参对象才找得到它的 staged 事实。
const PREFLIGHT_STAGE = new WeakMap();

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

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// 取证旁路：claim 与 preflight 两枚入口各自通报归因与稳定码，判定与返回值一字不动。
function reportSeamRefusal(refusalPoint, outcome) {
  safeEmit(refusalPoint, {
    stage: 'distilled-completion',
    reason: normalizeRefusalReason(outcome?.reason),
  });
}

function parseDocument(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) return null;
  try {
    const document = JSON.parse(bytes.toString('utf8'));
    return isRecord(document) ? document : null;
  } catch {
    return null;
  }
}

// canonical issuer 在开箱 run execution 之后、交 prepared runner 之前暂存一次。
// 一次性：同一 runExecutionAuthority 只能 stage 一次，claim 之后即刻抹掉。
export function stageClaimedReplayExecution({ runExecutionAuthority, execution } = {}) {
  if (!isRecord(runExecutionAuthority) || !isRecord(execution)) return false;
  if (STAGED_EXECUTIONS.has(runExecutionAuthority)) return false;
  STAGED_EXECUTIONS.set(runExecutionAuthority, execution);
  return true;
}

function claimStagedExecution(runExecutionAuthority) {
  if (!isRecord(runExecutionAuthority)) return null;
  const execution = STAGED_EXECUTIONS.get(runExecutionAuthority) || null;
  if (execution) STAGED_EXECUTIONS.delete(runExecutionAuthority);
  return execution;
}

// 逐 intent 事件分组与代表步：与 bin/replay.mjs 同一确定性规则，不按 atom 名或 Set 去重。
function groupEvents(events) {
  const intentOrder = [];
  const intentEvents = new Map();
  for (const event of events) {
    if (!isRecord(event)) return null;
    if (typeof event.stepId !== 'string' || !event.stepId) return null;
    if (typeof event.intentId !== 'string' || !event.intentId) return null;
    if (!intentEvents.has(event.intentId)) {
      intentEvents.set(event.intentId, []);
      intentOrder.push(event.intentId);
    }
    intentEvents.get(event.intentId).push(event);
  }
  if (intentOrder.length === 0) return null;
  const reprStepOf = new Map(intentOrder.map((intentId) => [
    intentId, intentEvents.get(intentId).slice(-1)[0].stepId,
  ]));
  return { intentOrder, intentEvents, reprStepOf };
}

function claimedRuntime(input) {
  if (!exactKeys(input, CLAIM_INPUT_KEYS)) return denied(COMPLETION_INVALID);
  const {
    runExecutionAuthority, freshRuntimeAuthority, topologyAuthority,
    runtimeOwnerAuthority, executionTargetAuthority,
  } = input;
  const execution = claimStagedExecution(runExecutionAuthority);
  if (!execution) return denied(OWNERSHIP_MISMATCH);
  // 五枚 capability 必须与本次 run 已封存的完全同一枚：任何一处换绑都是归属失守。
  if (execution.freshRuntimeAuthority !== freshRuntimeAuthority
    || execution.topologyAuthority !== topologyAuthority
    || execution.runtimeOwnerAuthority !== runtimeOwnerAuthority
    || execution.executionTargetAuthority !== executionTargetAuthority) {
    return denied(OWNERSHIP_MISMATCH);
  }
  const owner = readRuntimeOwner(runtimeOwnerAuthority);
  if (!owner || owner.topologyAuthority !== topologyAuthority
    || owner.executionTargetAuthority !== executionTargetAuthority) {
    return denied(OWNERSHIP_MISMATCH);
  }
  if (typeof execution.runNamespace !== 'string'
    || !NAMESPACE_RE.test(execution.runNamespace)) {
    return denied(COMPLETION_INVALID);
  }
  const eventsDocument = parseDocument(execution.artifacts?.eventsBytes);
  const expectedDocument = parseDocument(execution.expectedBytes);
  if (!eventsDocument || !expectedDocument) return denied(COMPLETION_INVALID);
  const events = Array.isArray(eventsDocument.events) ? eventsDocument.events : null;
  if (!events || events.length === 0) return denied(COMPLETION_INVALID);
  const grouped = groupEvents(events);
  if (!grouped) return denied(COMPLETION_INVALID);
  const runtime = projectExecutionTargetRuntime(executionTargetAuthority);
  if (!runtime) return denied('EXECUTION_TARGET_AUTHORITY_INVALID');
  const caseId = typeof execution.caseId === 'string' && execution.caseId
    ? execution.caseId
    : (eventsDocument.caseId || expectedDocument.caseId);
  if (typeof caseId !== 'string' || !caseId) return denied(COMPLETION_INVALID);
  return frozen({
    ok: true, execution, owner, runtime, caseId,
    eventsDocument, expectedDocument, events, grouped,
    executionTargetAuthority, freshRuntimeAuthority, topologyAuthority,
  });
}

// canonical formal replay 的 profile：read-only-v1 不带通道剖面文件，用现役 loading 归一化的
// 缺省剖面。它只影响 settle/计数选择器缺省，不引入任何目标、host 或凭据知识。
function canonicalProfile() {
  const profile = {};
  normalizeLoadingProfile(profile);
  return profile;
}

function buildInputs(claimed) {
  const {
    grouped, events, caseId, expectedDocument,
  } = claimed;
  const profile = canonicalProfile();
  const state = claimed.owner.state || { currentStepId: null };
  const pageErrors = Array.isArray(claimed.owner.pageErrors)
    ? claimed.owner.pageErrors
    : [];
  const guardAborts = [];
  const forensics = claimed.owner.forensics || frozen({ records: () => [] });
  const ctx = {
    uniqueName: claimed.execution.runNamespace,
    baseUrl: claimed.runtime.browserVisibleBaseUrl,
    profile,
    destructiveContinuityByStep: new Map(),
    admitReplayActionOrigin: createReplayOriginAdmission(claimed.executionTargetAuthority),
    pageTopology: claimed.topologyAuthority,
    executionTargetAuthority: claimed.executionTargetAuthority,
  };
  const expectedByIntent = new Map((expectedDocument.intents || []).map((intent) => [
    intent.intentId,
    (intent.expected || []).map((assertion) => projectReplayAssertion(assertion, ctx)),
  ]));
  const globalAssertions = (expectedDocument.globalAssertions || [])
    .map((assertion) => projectReplayAssertion(assertion, ctx));
  const eventRunnerInput = {
    page: claimed.owner.page,
    execution: frozen({
      authority: claimed.executionTargetAuthority,
      runtime: claimed.runtime,
    }),
    args: frozen({}),
    events,
    intentEvents: grouped.intentEvents,
    reprStepOf: grouped.reprStepOf,
    profile,
    ctx,
    forensics,
    state,
    guardAborts,
    expectedByIntent,
    globalAssertions,
    countSelector: '.hr-table-row',
    buttons: null,
    caseId,
    videoStartedAt: null,
    log: () => {},
    debug: false,
  };
  // records/pageErrors 必须是「投影那一刻」的取证快照：axes 入参用 getter 承载，
  // prepared runner 在 event 跑完后 spread 时才求值，绝不把跑之前的空快照钉死。
  const axesProjectionInput = {
    caseId,
    intentOrder: grouped.intentOrder,
    intentEvents: grouped.intentEvents,
    reprStepOf: grouped.reprStepOf,
    expectedByIntent: eventRunnerInput.expectedByIntent,
    globalAssertions: eventRunnerInput.globalAssertions,
    allStepIds: new Set(events.map((event) => event.stepId)),
    get records() {
      return forensics.records();
    },
    get pageErrors() {
      return pageErrors.slice();
    },
  };
  return { eventRunnerInput, axesProjectionInput, profile, ctx };
}

export function inspectClaimedReplayRuntime(input = {}) {
  const outcome = inspectClaimedReplayRuntimeCore(input);
  if (outcome?.ok !== true) reportSeamRefusal('prepared-runtime.claim', outcome);
  return outcome;
}

function inspectClaimedReplayRuntimeCore(input) {
  const claimed = claimedRuntime(input);
  if (claimed.ok !== true) return claimed;
  const built = buildInputs(claimed);
  // 归属与形状全部成立之后才原子消费 fresh：失败路径一枚 genuine capability 都不烧。
  const consumed = consumeFreshReplayRuntimeAuthority({
    freshRuntimeAuthority: claimed.freshRuntimeAuthority,
    topologyAuthority: claimed.topologyAuthority,
  });
  if (consumed?.ok !== true) {
    return denied(typeof consumed?.reason === 'string' ? consumed.reason : OWNERSHIP_MISMATCH);
  }
  PREFLIGHT_STAGE.set(built.eventRunnerInput, {
    runExecutionAuthority: input.runExecutionAuthority,
    runtimeOwnerAuthority: input.runtimeOwnerAuthority,
    page: claimed.owner.page,
    execution: built.eventRunnerInput.execution,
    axesProjectionInput: built.axesProjectionInput,
    claimed,
    profile: built.profile,
    ctx: built.ctx,
  });
  return frozen({
    ok: true,
    page: claimed.owner.page,
    execution: built.eventRunnerInput.execution,
    eventRunnerInput: built.eventRunnerInput,
    axesProjectionInput: built.axesProjectionInput,
  });
}

// 现役门逐条复用，失败零动作。顺序与 bin/replay.mjs 一致：签名 → case 绑定 → delete binding →
// entity admission → 实体锚 → 断言投影。任一门不过都在 runReplayEvents 之前 fail-closed。
function runProductionGates(stage) {
  const { claimed } = stage;
  const expectedDocument = claimed.expectedDocument;
  const eventsDocument = claimed.eventsDocument;
  const signCheck = assertSignedContract(expectedDocument);
  if (!signCheck.ok) return 'REPLAY_EXPECTED_CONTRACT_UNSIGNED';
  const hasAssertions = (expectedDocument.intents || [])
    .some((intent) => (intent?.expected || []).length > 0)
    || (expectedDocument.globalAssertions || []).length > 0;
  if (hasAssertions && (!expectedDocument.caseId || !eventsDocument.caseId
    || expectedDocument.caseId !== eventsDocument.caseId)) {
    return 'REPLAY_EXPECTED_CASE_BINDING_INVALID';
  }
  const deleteBindings = validateWorkflowDeleteBindings(claimed.events);
  if (!deleteBindings.ok) return 'REPLAY_WORKFLOW_DELETE_BINDING_INVALID';
  let admission;
  try {
    admission = checkReplayEntityAdmission({
      caseId: claimed.caseId,
      eventsBytes: claimed.execution.artifacts.eventsBytes,
      eventsDocument,
    });
  } catch {
    return 'REPLAY_ENTITY_ADMISSION_INVALID';
  }
  if (admission?.ok !== true) {
    const locked = verifyDistilledEntityAdmission({
      caseId: claimed.caseId,
      eventsBytes: claimed.execution.artifacts.eventsBytes,
      handle: claimed.execution.entityLockHandle,
    });
    if (locked?.ok !== true) return 'REPLAY_ENTITY_ADMISSION_INVALID';
  }
  const anchors = validateReplayEntityAnchors({
    events: claimed.events,
    expectedDoc: expectedDocument,
    profile: stage.profile,
    ctx: stage.ctx,
  });
  if (!anchors.ok) return 'REPLAY_ENTITY_ANCHOR_INVALID';
  if (anchors.countSelector != null) {
    stage.eventRunnerCountSelector = anchors.countSelector;
  }
  return null;
}

export async function runCanonicalPreflight(input = {}) {
  const outcome = await runCanonicalPreflightCore(input);
  if (outcome?.ok !== true) reportSeamRefusal('prepared-runtime.preflight', outcome);
  return outcome;
}

async function runCanonicalPreflightCore(input) {
  if (!exactKeys(input, PREFLIGHT_INPUT_KEYS)) return denied(COMPLETION_INVALID);
  const stage = PREFLIGHT_STAGE.get(input.eventRunnerInput) || null;
  if (!stage) return denied(OWNERSHIP_MISMATCH);
  PREFLIGHT_STAGE.delete(input.eventRunnerInput);
  if (stage.runExecutionAuthority !== input.runExecutionAuthority
    || stage.runtimeOwnerAuthority !== input.runtimeOwnerAuthority
    || stage.page !== input.page
    || stage.execution !== input.execution
    || stage.axesProjectionInput !== input.axesProjectionInput) {
    return denied(OWNERSHIP_MISMATCH);
  }
  // owner 必须此刻仍然在线：先前 claim 与真正跑事件之间被关掉的 runtime 不许再跑。
  if (!readRuntimeOwner(input.runtimeOwnerAuthority)) return denied(OWNERSHIP_MISMATCH);
  let failure;
  try {
    failure = runProductionGates(stage);
  } catch {
    return denied(COMPLETION_INVALID);
  }
  if (failure) return denied(failure);
  // 断言只在全部门通过之后投影，投影结果直接写进本次 run 的入参，不接调用方提交。
  const { claimed, ctx } = stage;
  const eventRunnerInput = input.eventRunnerInput;
  // claim 期已按同一份 signed expected 投影过一遍，这里必须整体替换而非追加：
  // 否则 global 断言会被投影两遍，裁判看到的 axes 断言全集就偏离已签断言全集。
  // 两个容器与 axesProjectionInput 共享同一引用，原地清空即可保持共享语义。
  eventRunnerInput.expectedByIntent.clear();
  eventRunnerInput.globalAssertions.length = 0;
  for (const intent of claimed.expectedDocument.intents || []) {
    if (!isRecord(intent) || typeof intent.intentId !== 'string') return denied(COMPLETION_INVALID);
    eventRunnerInput.expectedByIntent.set(
      intent.intentId,
      (intent.expected || []).map((assertion) => projectReplayAssertion(assertion, ctx)),
    );
  }
  for (const assertion of claimed.expectedDocument.globalAssertions || []) {
    eventRunnerInput.globalAssertions.push(projectReplayAssertion(assertion, ctx));
  }
  if (typeof stage.eventRunnerCountSelector === 'string' && stage.eventRunnerCountSelector) {
    eventRunnerInput.countSelector = stage.eventRunnerCountSelector;
  }
  return frozen({
    ok: true,
    eventRunnerInput,
    axesProjectionInput: input.axesProjectionInput,
  });
}

export const canonicalPreparedRuntimeSeam = frozen({
  inspectClaimedReplayRuntime,
  runCanonicalPreflight,
});
