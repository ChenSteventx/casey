// lib/report-model.mjs —— 报表模型装配器（相6 报告的上游一步，零 LLM 纯函数）。
// 把 verdict.json（多态裁定）⋈ StepAxes（axes.json 三轴）⋈ 观测现状 ⋈ 事件动作 join 成符合
// 已冻 report-model.schema.json 的只读报告数据源；渲染器（report.mjs）只读它、不二次推断。
// 不改任何冻结内核；defectTicket（缺陷单）仅 SUT_DEFECT 步产（正反两向）。凭据红线：只投影非凭据字段。
// report-model.schema 处处 additionalProperties:false —— 故 StepAxes 的富字段（ts/streamFinished/streamStatus 等）
// 必须投影删去，不能直传。

// StepAxes.forensics.network 单条 → report-model networkForensic（删 ts/streamFinished/streamStatus）
function projectNet(n) {
  return {
    url: n.url,
    status: n.status != null ? n.status : null,
    initiator: n.initiator != null ? n.initiator : null,
    attributedStepId: n.attributedStepId != null ? n.attributedStepId : null,
    errorEnvelope: n.errorEnvelope
      ? { field: n.errorEnvelope.field, expected: n.errorEnvelope.expected, actual: n.errorEnvelope.actual, ok: !!n.errorEnvelope.ok }
      : null,
  };
}

function projectLifecycle(lc) {
  const l = lc || {};
  return {
    pageerror: (l.pageerror || []).map((p) => ({ message: p.message, attributedStepId: p.attributedStepId != null ? p.attributedStepId : null })),
    crashed: !!l.crashed,
    crashedAtStepId: l.crashedAtStepId != null ? l.crashedAtStepId : null,
  };
}

// postAssertions 与冻结 StepAxes.postAssertions 同形，仍显式挑字段防上游多带
function projectPost(a) {
  return {
    kind: a.kind,
    op: a.op,
    value: a.value !== undefined ? a.value : null,
    actual: a.actual !== undefined ? a.actual : null,
    ok: !!a.ok,
    soft: !!a.soft,
  };
}

function projectObserved(o) {
  return {
    urlPathnameAfter: o.urlPathnameAfter != null ? o.urlPathnameAfter : null,
    cleanTitles: o.cleanTitles || [],
    toastTexts: o.toastTexts || [],
    replyText: o.replyText != null ? o.replyText : null,
    replyStreamUrl: o.replyStreamUrl != null ? o.replyStreamUrl : null,
  };
}

// 缺陷单：失败硬断言 + 归因本步的背书取证（5xx / 错误信封失败）。仅 SUT_DEFECT 步调用。
function buildDefectTicket(ax) {
  const post = (ax && ax.postAssertions) || [];
  const failedAssertions = post
    .filter((a) => a.ok === false && a.soft !== true)
    .map((a) => ({ kind: a.kind, op: a.op, value: a.value !== undefined ? a.value : null, actual: a.actual !== undefined ? a.actual : null }));
  const net = (ax && ax.forensics && ax.forensics.network) || [];
  const backingForensics = net
    .filter((n) => n.attributedStepId != null && ax && n.attributedStepId === ax.stepId
      && ((typeof n.status === 'number' && n.status >= 500) || (n.errorEnvelope && n.errorEnvelope.ok === false)))
    .map((n) => ({ url: n.url, status: n.status != null ? n.status : null, attributedStepId: n.attributedStepId }));
  return { failedAssertions, backingForensics, videoAt: null, traceRef: null };
}

/**
 * 装配 report-model（符合 report-model.schema.json）。
 * @param {object} p
 * @param {string} p.caseId
 * @param {string} [p.channel] web|cef|arbitrary（默认 web）
 * @param {object} p.verdict  verdict.json = { caseId, steps:[{stepId,intentId,atom,verdict,reason}] }
 * @param {object} p.axes     axes.json    = { caseId, steps:[StepAxes] }
 * @param {object|null} [p.observed]  观测现状（可选，按 stepId/intentId 切片投影）
 * @param {object|null} [p.events]     events.json（可选，供动作轴投影 action.kind 动作动词）
 * @param {object} [p.meta]    { generatedAt, title?, signedAgainstBuild?, signerId?, passes?, intentTextByIntent? }
 */
export function assembleReportModel({ caseId, channel, verdict, axes, observed = null, events = null, meta = {} }) {
  if (!verdict || !Array.isArray(verdict.steps)) throw new Error('assembleReportModel: verdict.steps 缺失/非数组');
  if (!axes || !Array.isArray(axes.steps)) throw new Error('assembleReportModel: axes.steps 缺失/非数组');
  if (!meta.generatedAt) throw new Error('assembleReportModel: meta.generatedAt 必填（report-model.schema required + date-time）');

  const cid = caseId || verdict.caseId || axes.caseId;
  const axByStep = new Map(axes.steps.map((s) => [s.stepId, s]));
  const obsByStep = new Map();
  const obsByIntent = new Map();
  for (const os of (observed && observed.steps) || []) {
    if (os.stepId != null) obsByStep.set(os.stepId, os);
    if (os.intentId != null) obsByIntent.set(os.intentId, os);
  }
  const verbByStep = new Map();
  for (const ev of (events && events.events) || []) {
    if (ev.stepId != null && ev.action != null) verbByStep.set(ev.stepId, ev.action);
  }
  const intentTextByIntent = meta.intentTextByIntent || {};

  const summary = { PASS: 0, SUT_DEFECT: 0, HARNESS_ERROR: 0, NEEDS_HUMAN: 0 };
  const steps = verdict.steps.map((vs) => {
    const ax = axByStep.get(vs.stepId) || null;
    const obs = (vs.stepId != null && obsByStep.get(vs.stepId)) || (vs.intentId != null && obsByIntent.get(vs.intentId)) || null;
    const verb = verbByStep.get(vs.stepId) || null;
    if (summary[vs.verdict] !== undefined) summary[vs.verdict] += 1;

    const step = {
      stepId: vs.stepId != null ? vs.stepId : null,
      intentId: vs.intentId != null ? vs.intentId : null,
      atom: vs.atom != null ? vs.atom : (ax && ax.atom != null ? ax.atom : null),
      verdict: vs.verdict,
      reason: vs.reason !== undefined ? vs.reason : null,
      postAssertions: ((ax && ax.postAssertions) || []).map(projectPost),
    };
    const intentText = intentTextByIntent[vs.intentId];
    if (intentText != null) step.intentText = intentText;
    if (verb != null) step.action = { kind: verb, describe: null, resolution: (ax && ax.action && ax.action.resolution != null) ? ax.action.resolution : null };
    if (ax) step.forensics = { lifecycle: projectLifecycle(ax.forensics && ax.forensics.lifecycle), network: ((ax.forensics && ax.forensics.network) || []).map(projectNet) };
    if (obs) step.observed = projectObserved(obs);
    step.defectTicket = vs.verdict === 'SUT_DEFECT' ? buildDefectTicket(ax || { stepId: vs.stepId }) : null;
    return step;
  });

  const model = {
    schemaVersion: 1,
    caseId: cid,
    channel: channel || 'web',
    generatedAt: meta.generatedAt,
    verdictSummary: summary,
    steps,
    signedAgainstBuild: meta.signedAgainstBuild != null ? meta.signedAgainstBuild : null,
    signerId: meta.signerId != null ? meta.signerId : null,
    passes: meta.passes != null ? meta.passes : null,
  };
  if (meta.title != null) model.title = meta.title;
  return model;
}
