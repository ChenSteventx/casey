// resolved raw observations → 现役 replay axes 投影 → frozen 裁判子进程桥。
// 本模块不裁定：既不复制断言求值，也不写任何四态判断；只做确定性聚合与首错停止。
// 两枚 authority 都是一次性；mapping 未验证前不得投影 axes（runtime-seams-design §5）。

import { projectReplayAxes } from '../replay-axes.mjs';
import { canonicalVerdictCliAdapter } from './verdict-cli-adapter.mjs';
import { projectReadOnlySemanticEvidence } from './read-only-obligations.mjs';
import {
  normalizeErrorName, normalizeRefusalReason, safeEmit,
} from './cycle-evidence-context.mjs';

const INPUT_KEYS = ['rawObservationAuthority', 'resolvedProjectionAuthority'];
const DEPENDENCY_KEYS = [
  'consumeRawObservationAuthority',
  'consumeResolvedProjectionAuthority',
  'projectReplayAxes',
  'verdictAdapter',
];

function frozen(value) {
  return Object.freeze(value);
}

// 取证旁路：formal 相拒付照原样通报归因与稳定码，判定与返回值一字不动。
function reportFormalRefusal(reason, thrown) {
  const row = { stage: 'distilled-completion', reason: normalizeRefusalReason(reason) };
  safeEmit('formal-replay.refusal', thrown === undefined
    ? row
    : { ...row, errorName: normalizeErrorName(thrown) });
}

function denied(reason) {
  return frozen({ ok: false, reason });
}

const PROJECTION_REFUSAL_REASONS = new Set([
  'RAW_AXES_PROJECTION_INVALID',
  'RAW_OBSERVATION_AUTHORITY_INVALID',
  'RESOLVED_PROJECTION_AUTHORITY_INVALID',
  'RAW_AXES_BINDING_MISMATCH',
  'RAW_AXES_PROJECTION_FAILED',
  'VERDICT_EXECUTION_FAILED',
]);

// projectAndVerify 的生产者局部通报：取证 reason 只认本接缝六码，返回仍原样透传。
function reportProjectionDenied(reason) {
  safeEmit('raw-axes.projection-denied', {
    stage: 'source-resolved-completion',
    reason: PROJECTION_REFUSAL_REASONS.has(reason) ? reason : 'OTHER_REASON',
  });
  return denied(reason);
}

function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.keys(value).sort().join(' ') === [...expected].sort().join(' ');
}

function usableProjection(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

// 注入 judge 只有返回闭合判决文档才可被序列化成 verdict bytes：逐步必须带 intent/step identity
// 与 canonical 四态之一。本模块仍不裁定——只拒绝把任意对象冒充判决。
const VERDICT_STATES = new Set(['PASS', 'SUT_DEFECT', 'HARNESS_ERROR', 'NEEDS_HUMAN']);

function closedVerdictDocument(value) {
  if (!usableProjection(value) || !Array.isArray(value.steps) || value.steps.length === 0) {
    return false;
  }
  return value.steps.every((step) => {
    if (!usableProjection(step)) return false;
    const identity = typeof step.intentId === 'string' && step.intentId
      ? step.intentId
      : step.stepId;
    if (typeof identity !== 'string' || !identity) return false;
    if (!VERDICT_STATES.has(step.verdict)) return false;
    return step.reason === null || typeof step.reason === 'string';
  });
}

// 两份 authority-bound projection 必须 exact 匹配 case/capture/expected 绑定，
// 且 resolved 不得留 pending：任何一项不成立都在 projector 之前 fail-closed。
function bindingsAgree(raw, resolved) {
  if (!usableProjection(raw) || !usableProjection(resolved)) return false;
  if (typeof raw.caseId !== 'string' || raw.caseId !== resolved.caseId) return false;
  if (typeof raw.captureSha256 !== 'string'
    || raw.captureSha256 !== resolved.captureSha256) return false;
  if (typeof raw.expectedSha256 !== 'string'
    || raw.expectedSha256 !== resolved.expectedSha256) return false;
  if (!Array.isArray(resolved.pending) || resolved.pending.length > 0) return false;
  if (!Array.isArray(resolved.resolved) || resolved.resolved.length === 0) return false;
  if (!Array.isArray(raw.events) || raw.events.length === 0) return false;
  return true;
}

// 逐 event 聚合计划：evidence 顺序不去重，structural newpage 按已验证 trigger lineage 归位。
function planIntentEvents(raw, resolved) {
  const bySeq = new Map();
  for (const event of raw.events) {
    if (!event || !Number.isSafeInteger(event.seq) || bySeq.has(event.seq)) return null;
    bySeq.set(event.seq, event);
  }
  const structural = Array.isArray(resolved.structural) ? resolved.structural : [];
  const structuralByTrigger = new Map();
  const structuralSeqs = new Set();
  for (const row of structural) {
    if (!row || !Number.isSafeInteger(row.eventSeq) || !Number.isSafeInteger(row.triggerEventSeq)) {
      return null;
    }
    const event = bySeq.get(row.eventSeq);
    if (!event || event.eventKey !== row.compoundKey) return null;
    if (structuralSeqs.has(row.eventSeq)) return null;
    structuralSeqs.add(row.eventSeq);
    const bucket = structuralByTrigger.get(row.triggerEventSeq) || [];
    bucket.push(row.eventSeq);
    structuralByTrigger.set(row.triggerEventSeq, bucket);
  }

  const intentOrder = [];
  const intentEvents = new Map();
  const businessTail = new Map();
  const usedSeqs = new Set();
  for (const mapping of resolved.resolved) {
    if (!mapping || typeof mapping.intentId !== 'string' || !mapping.intentId) return null;
    if (!Array.isArray(mapping.evidenceEventSeqs) || mapping.evidenceEventSeqs.length === 0) {
      return null;
    }
    if (!intentEvents.has(mapping.intentId)) {
      intentOrder.push(mapping.intentId);
      intentEvents.set(mapping.intentId, []);
    }
    const rows = intentEvents.get(mapping.intentId);
    for (const seq of mapping.evidenceEventSeqs) {
      const event = bySeq.get(seq);
      if (!event || usedSeqs.has(seq) || structuralSeqs.has(seq)) return null;
      usedSeqs.add(seq);
      rows.push(event);
      businessTail.set(mapping.intentId, event);
      for (const childSeq of (structuralByTrigger.get(seq) || []).sort((a, b) => a - b)) {
        if (usedSeqs.has(childSeq)) return null;
        usedSeqs.add(childSeq);
        rows.push(bySeq.get(childSeq));
      }
    }
  }
  // eventSeq 必须全覆盖且不重复；未闭合 structural trigger 同样 fail-closed。
  if (usedSeqs.size !== raw.events.length) return null;
  for (const seq of structuralSeqs) if (!usedSeqs.has(seq)) return null;
  return { intentOrder, intentEvents, businessTail };
}

function expectedByIntentOf(raw, intentOrder) {
  const map = new Map();
  const intents = Array.isArray(raw.expected?.intents) ? raw.expected.intents : [];
  for (const intentId of intentOrder) {
    const authored = intents.find((row) => row?.intentId === intentId);
    if (!authored || !Array.isArray(authored.expected)) return null;
    map.set(intentId, authored.expected);
  }
  return map;
}

// before 取该 intent 首个 event 的 baseline，terminal 证据取末个 event 的 after。
function buildAxesInput(raw, plan) {
  const expectedByIntent = expectedByIntentOf(raw, plan.intentOrder);
  if (!expectedByIntent) return null;
  const input = {
    caseId: raw.caseId,
    records: Array.isArray(raw.records) ? raw.records : [],
    pageErrors: Array.isArray(raw.pageErrors) ? raw.pageErrors : [],
    intentOrder: plan.intentOrder,
    intentEvents: new Map(),
    reprStepOf: new Map(),
    actionByStep: new Map(),
    intentCount: new Map(),
    expectedByIntent,
    globalAssertions: Array.isArray(raw.expected?.globalAssertions)
      ? raw.expected.globalAssertions : [],
    intentUrl: new Map(),
    intentToasts: new Map(),
    intentTextHits: new Map(),
    intentButtonHits: new Map(),
    intentButtonSeen: new Map(),
    intentButtonDisabledHits: new Map(),
    intentReply: new Map(),
    intentInputReadback: new Map(),
    chatCfg: raw.chatCfg ?? null,
    allStepIds: new Set(),
  };
  for (const intentId of plan.intentOrder) {
    const rows = plan.intentEvents.get(intentId);
    if (!rows || rows.length === 0) return null;
    const first = rows[0];
    const last = rows[rows.length - 1];
    const tail = plan.businessTail.get(intentId) || last;
    input.intentEvents.set(intentId, rows.map((row) => ({
      stepId: row.stepId,
      action: row.action,
      seq: row.seq,
    })));
    input.reprStepOf.set(intentId, tail.stepId);
    for (const row of rows) {
      input.actionByStep.set(row.stepId, row.actionAxis || { resolution: 'none' });
      input.allStepIds.add(row.stepId);
    }
    input.intentCount.set(intentId, {
      before: first.before?.count,
      after: last.after?.count,
    });
    input.intentUrl.set(intentId, last.after?.path);
    input.intentToasts.set(intentId, last.after?.toasts);
    input.intentTextHits.set(intentId, last.after?.textHits);
    input.intentButtonHits.set(intentId, last.after?.buttonHits);
    input.intentButtonSeen.set(intentId, last.after?.buttonSeen);
    input.intentButtonDisabledHits.set(intentId, last.after?.buttonDisabledHits);
    input.intentInputReadback.set(intentId, last.after?.inputReadback);
    input.intentReply.set(intentId, last.after?.reply);
  }
  return input;
}

// evidence 只能由 authority-bound projection 与裁判产物确定性导出，不含 URL、locator 或页面原值。
function projectEvidence(raw, plan, axesBytes, verdictBytes) {
  const projected = projectReadOnlySemanticEvidence({
    expectedDocument: {
      intents: raw.expected.intents,
      globalAssertions: raw.expected.globalAssertions,
    },
    intentOrder: plan.intentOrder,
    axesBytes,
    verdictBytes,
    eventSeqsByIntent: new Map(plan.intentOrder.map((intentId) => [
      intentId,
      plan.intentEvents.get(intentId).map((row) => row.seq),
    ])),
  });
  if (projected) return projected;

  // 旧的 zero-SUT 注入 projector 只给最小 verdict，不带 canonical postAssertions。
  // 这里保留最小、不可冒充完整 receipt 的桥接投影；生产链下游仍会按 signed
  // obligations 校验全部 predicate/effect/cleanup，缺任一项都会 fail-closed。
  let verdict;
  try {
    verdict = JSON.parse(verdictBytes.toString('utf8'));
  } catch {
    return null;
  }
  if (!Array.isArray(verdict?.steps)) return null;
  const byIntent = new Map(verdict.steps.map((step) => [
    step?.intentId || step?.stepId,
    step,
  ]));
  const intents = [];
  for (const intentId of plan.intentOrder) {
    const step = byIntent.get(intentId);
    const reason = step?.reason === undefined ? null : step.reason;
    if (!step || !VERDICT_STATES.has(step.verdict)
      || (reason !== null && typeof reason !== 'string')) return null;
    intents.push({
      intentId,
      eventSeqs: plan.intentEvents.get(intentId).map((row) => row.seq),
      verdict: step.verdict,
      reason,
    });
  }
  return frozen({ intents });
}

// 非消费式预检：两枚 inspector 都在场才生效（缺席时保持原有行为，由 consumer 自行验真）。
// 只比对能在不消费前提下取到的绑定事实，不读 observation、expected 或动作事实。
function inspectBinding(dependencies, input) {
  const inspectRaw = dependencies.inspectRawObservationAuthority;
  const inspectResolved = dependencies.inspectResolvedProjectionAuthority;
  if (typeof inspectRaw !== 'function' || typeof inspectResolved !== 'function') return null;
  let raw;
  let resolved;
  try {
    raw = inspectRaw({ rawObservationAuthority: input.rawObservationAuthority });
  } catch {
    return 'RAW_OBSERVATION_AUTHORITY_INVALID';
  }
  if (raw?.ok !== true) {
    return typeof raw?.reason === 'string' ? raw.reason : 'RAW_OBSERVATION_AUTHORITY_INVALID';
  }
  try {
    resolved = inspectResolved({ resolvedProjectionAuthority: input.resolvedProjectionAuthority });
  } catch {
    return 'RESOLVED_PROJECTION_AUTHORITY_INVALID';
  }
  if (resolved?.ok !== true) {
    return typeof resolved?.reason === 'string'
      ? resolved.reason : 'RESOLVED_PROJECTION_AUTHORITY_INVALID';
  }
  if (typeof raw.captureSha256 !== 'string' || raw.captureSha256 !== resolved.captureSha256) {
    return 'RAW_AXES_BINDING_MISMATCH';
  }
  // R10：预检对齐消费后 bindingsAgree 的全部绑定条件——caseId 与 expectedSha256 错绑
  // 也在非消费阶段拒绝，不烧 genuine 一次性 authority。
  if (typeof raw.caseId !== 'string' || raw.caseId !== resolved.caseId) {
    return 'RAW_AXES_BINDING_MISMATCH';
  }
  if (typeof raw.expectedSha256 !== 'string' || raw.expectedSha256 !== resolved.expectedSha256) {
    return 'RAW_AXES_BINDING_MISMATCH';
  }
  if (!Number.isSafeInteger(raw.observationCount) || raw.observationCount <= 0) {
    return 'RAW_AXES_BINDING_MISMATCH';
  }
  if (resolved.pendingCount !== 0 || !(resolved.resolvedCount > 0)) {
    return 'RAW_AXES_BINDING_MISMATCH';
  }
  return null;
}

export function createRawAxesAdapter(dependencies = {}) {
  const usable = !!dependencies && typeof dependencies === 'object'
    && DEPENDENCY_KEYS.every((name) => dependencies[name] !== undefined)
    && typeof dependencies.consumeRawObservationAuthority === 'function'
    && typeof dependencies.consumeResolvedProjectionAuthority === 'function'
    && typeof dependencies.projectReplayAxes === 'function'
    && typeof dependencies.verdictAdapter?.runFrozenVerdict === 'function';
  return frozen({
    async projectAndVerify(input) {
      if (!usable) return reportProjectionDenied('RAW_AXES_PROJECTION_INVALID');
      // 调用方不得提交 expected、mapping、artifacts、axes、verdict、evidence 或 judge 事实。
      if (!exactKeys(input, INPUT_KEYS)) return reportProjectionDenied('RAW_AXES_PROJECTION_INVALID');

      // 双消费之前先做非消费式绑定预检：capture 绑定不符或 resolved 仍有 pending 时，
      // 两枚 genuine one-shot authority 一个都不许被烧掉（探针/错绑不吃 genuine）。
      const preflight = inspectBinding(dependencies, input);
      if (preflight) return reportProjectionDenied(preflight);

      let rawConsumed;
      try {
        rawConsumed = dependencies.consumeRawObservationAuthority({
          rawObservationAuthority: input.rawObservationAuthority,
        });
      } catch {
        return reportProjectionDenied('RAW_OBSERVATION_AUTHORITY_INVALID');
      }
      if (rawConsumed?.ok !== true || !usableProjection(rawConsumed.projection)) {
        return reportProjectionDenied(typeof rawConsumed?.reason === 'string'
          ? rawConsumed.reason : 'RAW_OBSERVATION_AUTHORITY_INVALID');
      }
      let resolvedConsumed;
      try {
        resolvedConsumed = dependencies.consumeResolvedProjectionAuthority({
          resolvedProjectionAuthority: input.resolvedProjectionAuthority,
        });
      } catch {
        return reportProjectionDenied('RESOLVED_PROJECTION_AUTHORITY_INVALID');
      }
      if (resolvedConsumed?.ok !== true || !usableProjection(resolvedConsumed.projection)) {
        return reportProjectionDenied(typeof resolvedConsumed?.reason === 'string'
          ? resolvedConsumed.reason : 'RESOLVED_PROJECTION_AUTHORITY_INVALID');
      }

      const raw = rawConsumed.projection;
      const resolved = resolvedConsumed.projection;
      if (!bindingsAgree(raw, resolved)) return reportProjectionDenied('RAW_AXES_BINDING_MISMATCH');
      const plan = planIntentEvents(raw, resolved);
      if (!plan) return reportProjectionDenied('RAW_AXES_BINDING_MISMATCH');
      const axesInput = buildAxesInput(raw, plan);
      if (!axesInput) return reportProjectionDenied('RAW_AXES_BINDING_MISMATCH');

      let axesText;
      try {
        axesText = dependencies.projectReplayAxes(axesInput);
      } catch {
        return reportProjectionDenied('RAW_AXES_PROJECTION_FAILED');
      }
      if (typeof axesText !== 'string' || !axesText) {
        return reportProjectionDenied('RAW_AXES_PROJECTION_FAILED');
      }
      // 投影结果只做 UTF-8 bytes 化，不在本地重写 axes。
      const axesBytes = Buffer.from(axesText, 'utf8');

      let judged;
      try {
        judged = await dependencies.verdictAdapter.runFrozenVerdict({ axesBytes });
      } catch {
        return reportProjectionDenied('VERDICT_EXECUTION_FAILED');
      }
      if (judged?.ok !== true || !Buffer.isBuffer(judged.verdictBytes)) {
        return reportProjectionDenied('VERDICT_EXECUTION_FAILED');
      }
      const evidence = projectEvidence(raw, plan, axesBytes, judged.verdictBytes);
      if (!evidence) return reportProjectionDenied('VERDICT_EXECUTION_FAILED');
      return frozen({
        ok: true,
        rawObservationAuthority: input.rawObservationAuthority,
        resolvedProjectionAuthority: input.resolvedProjectionAuthority,
        axesBytes,
        verdictBytes: judged.verdictBytes,
        evidence,
      });
    },
  });
}

// 逐 role 的 axes/verdict 接缝：canonical 走现役 projector 与 frozen judge 桥；
// zero-SUT 装配注入现役接缝替身时，其 axes 投影文档同样只做 UTF-8 bytes 化，本模块不改写。
export function createRoleAxesSeam({ role, projectAxes, runVerdict } = {}) {
  const project = typeof projectAxes === 'function' ? projectAxes : null;
  const judge = typeof runVerdict === 'function' ? runVerdict : null;
  return frozen({
    projectReplayAxes(input) {
      if (!project) return projectReplayAxes(input);
      const projection = project({ role, axes: input });
      return typeof projection === 'string' ? projection : JSON.stringify(projection);
    },
    evidenceOf: semanticEvidenceOf,
    // distilled formal 相：在已归属 runtime 内跑现役 replay，再投 axes 并只经 frozen judge 桥裁定。
    // 本函数不 launch、不关闭、不裁定，也不接受 caller 提交的 axes/verdict/evidence。
    async sealFormalRun({ runExecutionAuthority, execution, runFormalReplay }) {
      if (typeof runFormalReplay !== 'function') {
        reportFormalRefusal('RUN_COMPLETION_INVALID');
        return denied('RUN_COMPLETION_INVALID');
      }
      let replayed;
      try {
        replayed = await runFormalReplay({
          runExecutionAuthority,
          freshRuntimeAuthority: execution.freshRuntimeAuthority,
          topologyAuthority: execution.topologyAuthority,
          runtimeOwnerAuthority: execution.runtimeOwnerAuthority,
          executionTargetAuthority: execution.executionTargetAuthority,
        });
      } catch (error) {
        reportFormalRefusal('RUN_COMPLETION_INVALID', error);
        return denied('RUN_COMPLETION_INVALID');
      }
      if (replayed?.ok !== true) {
        reportFormalRefusal(typeof replayed?.reason === 'string'
          ? replayed.reason : 'RUN_COMPLETION_INVALID');
        return denied(typeof replayed?.reason === 'string'
          ? replayed.reason : 'RUN_COMPLETION_INVALID');
      }
      let axesBytes = Buffer.isBuffer(replayed.axesBytes) ? replayed.axesBytes : null;
      if (!axesBytes) {
        let axesText;
        try {
          axesText = await this.projectReplayAxes({ evidence: replayed.evidence });
        } catch (error) {
          reportFormalRefusal('RAW_AXES_PROJECTION_FAILED', error);
          return denied('RAW_AXES_PROJECTION_FAILED');
        }
        if (typeof axesText !== 'string' || !axesText) {
          reportFormalRefusal('RAW_AXES_PROJECTION_FAILED');
          return denied('RAW_AXES_PROJECTION_FAILED');
        }
        axesBytes = Buffer.from(axesText, 'utf8');
      }
      let judged;
      try {
        judged = await this.verdictAdapter.runFrozenVerdict({ axesBytes });
      } catch (error) {
        reportFormalRefusal('VERDICT_EXECUTION_FAILED', error);
        return denied('VERDICT_EXECUTION_FAILED');
      }
      if (judged?.ok !== true || !Buffer.isBuffer(judged.verdictBytes)) {
        reportFormalRefusal('VERDICT_EXECUTION_FAILED');
        return denied('VERDICT_EXECUTION_FAILED');
      }
      let semanticEvidence = null;
      try {
        const expectedDocument = JSON.parse(execution.expectedBytes.toString('utf8'));
        semanticEvidence = projectReadOnlySemanticEvidence({
          expectedDocument,
          intentOrder: (expectedDocument.intents || []).map((intent) => intent.intentId),
          axesBytes,
          verdictBytes: judged.verdictBytes,
        });
      } catch {
        semanticEvidence = null;
      }
      // 注入的 role projector/judge 可把既有测试 evidence 封在 axes 中；canonical
      // 路径绝不采用这一退路，必须从 expected + axes + verdict 重新确定性投影。
      if (!semanticEvidence && project && judge) {
        semanticEvidence = semanticEvidenceOf(axesBytes, replayed.evidence);
      }
      if (!semanticEvidence) {
        reportFormalRefusal('RUN_COMPLETION_INVALID');
        return denied('RUN_COMPLETION_INVALID');
      }
      return frozen({
        ok: true,
        runExecutionAuthority,
        runtimeOwnerAuthority: execution.runtimeOwnerAuthority,
        artifacts: execution.artifacts,
        axesBytes,
        verdictBytes: judged.verdictBytes,
        evidence: semanticEvidenceOf(axesBytes, semanticEvidence),
      });
    },
    verdictAdapter: frozen({
      async runFrozenVerdict({ axesBytes }) {
        if (!judge) return canonicalVerdictCliAdapter.runFrozenVerdict({ axesBytes });
        const judged = await judge({ role, axesBytes });
        if (judged === null || judged === undefined) return denied('VERDICT_EXECUTION_FAILED');
        if (Buffer.isBuffer(judged)) return frozen({ ok: true, verdictBytes: judged });
        if (Buffer.isBuffer(judged.verdictBytes)) {
          return frozen({ ok: true, verdictBytes: judged.verdictBytes });
        }
        // 非 Buffer 返回不再被无条件 JSON 化成「判决字节」：必须先是闭合判决文档
        // （逐步带 intent/step identity 与 canonical 四态之一），否则任意对象都能洗成 ok。
        if (!closedVerdictDocument(judged)) return denied('VERDICT_EXECUTION_FAILED');
        return frozen({
          ok: true,
          verdictBytes: Buffer.from(JSON.stringify(judged), 'utf8'),
        });
      },
    }),
  });
}

// axes 文档若自带确定性 evidence 投影，语义证据只能从这份 axes 产物里读出；
// 现役 axes 文本没有该字段时退回 adapter 由 verdict 导出的最小 evidence。调用方无从提交。
export function semanticEvidenceOf(axesBytes, fallback) {
  let doc;
  try {
    doc = JSON.parse(axesBytes.toString('utf8'));
  } catch {
    return fallback;
  }
  return usableProjection(doc) && usableProjection(doc.evidence) ? doc.evidence : fallback;
}

// canonical 接缝：现役 axes 投影与 frozen 裁判桥在此静态绑定并真实调用。
// 两枚 authority 的 canonical consumer 由 runtime-cycle assembler 在其模块齐备后接上，
// 本模块不代持也不伪造它们。
export const canonicalRawAxesSeams = Object.freeze({
  projectReplayAxes: (input) => projectReplayAxes(input),
  verdictAdapter: Object.freeze({
    runFrozenVerdict: (input) => canonicalVerdictCliAdapter.runFrozenVerdict(input),
  }),
});
