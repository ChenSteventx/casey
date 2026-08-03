// lib/replay-axes.mjs —— 相3 浏览器后三轴投影（纯函数）。从 bin/replay.mjs 逐字搬移
// （agent-id-readback codex R2-H6 / sol 五面构造 ③）：把「采集完毕的证据 → axes 字节」这段
// 确定性投影抽成生产共用纯函数，bin/replay.mjs 与零 SUT 差分棘轮金牌消费同一实现——
// 冻结面因此能在零浏览器下驱动真实生产代码，不再手造投影副本。
// 纪律：本模块零 IO、零浏览器、零裁定（裁判在 bin/verdict.mjs，护栏 #15）；输入是回放期收集的
// 证据结构，输出是 axes 全文文本（含末尾换行），凭据兜底门与落盘仍在 bin/replay.mjs。
import { evaluateAssertions } from './replay-assert.mjs';
import { maskCredentialRoute } from './cred-gate.mjs';
import { foldIntentAction } from './intent-action-fold.mjs';

// 归因到本步的记录归一到 intent 代表步（verdict 按 ===StepAxes.stepId 背书，须对齐，finding 5）；其余归 null。
// url 投影两道卫生（cred-route-mask + login-traffic-drop G3）：剥 host 只留 pathname+search
// （目标地址只活在 site.json、绝不进任何输出——真机基址字面撞门实证；query 保留仍受门拦）+
// 凭据路由名打码。报告装配下游同源受益。
// blob: 等非 http(s)/ws(s) scheme 的 pathname 内嵌完整 origin（codex 实证 blob:http://host/uuid）——
// 一律脱敏占位；解析不了且非 / 开头同罪（:// 零容忍，宁失细节不漏 host）。
const toPathQuery = (u) => {
  const s = String(u);
  try {
    const x = new URL(s);
    if (!['http:', 'https:', 'ws:', 'wss:'].includes(x.protocol)) return '<redacted:non-http-url>';
    const out = x.pathname + x.search;
    // 代理型路径可自嵌完整 URL（/proxy/http://host/x）——:// 零容忍到输出侧（codex R2 纵深）。
    return out.includes('://') ? '<redacted:non-http-url>' : out;
  } catch {
    // //host/x 协议相对引用也走私 host（codex R2）：仅放行单斜杠起始的纯路径。
    return s.startsWith('/') && !s.startsWith('//') && !s.includes('://') ? s : '<redacted:non-http-url>';
  }
};
const projUrl = (u) => maskCredentialRoute(toPathQuery(u));

const PAGE_ERROR_CLASSES = [
  'AggregateError',
  'EvalError',
  'InternalError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'TypeError',
  'URIError',
  'Error',
];
function projectPageErrorMessage(value) {
  if (typeof value !== 'string') return undefined;
  const message = value.slice(0, 200);
  const errorClass = PAGE_ERROR_CLASSES.find((name) => (
    message === name || message.startsWith(`${name}:`)
  )) || 'Error';
  // 浏览器异常自由文本可能用 URL、host:port、协议相对地址或产品私有写法携带
  // 规范目标；纯投影层没有 authority 可做可靠逐值 scrub。保留类别/数量/归因，
  // 一律丢弃自由文本，避免靠不完备正则猜“这次像不像地址”。
  return `${errorClass}: <redacted:pageerror>`;
}

export function projectReplayAxes({
  caseId, records, intentOrder, intentEvents, reprStepOf, actionByStep, pageErrors,
  intentCount, expectedByIntent, globalAssertions, intentUrl, intentToasts, intentTextHits,
  intentButtonHits, intentButtonSeen, intentButtonDisabledHits, intentReply,
  intentInputReadback, chatCfg, allStepIds,
  cleanupEvidence = null,
}) {
  const projectNet = (r, reprStepId) => ({
    url: projUrl(r.url), status: r.status, ts: r.ts, initiator: r.initiator,
    attributedStepId: r.attributedStepId != null ? reprStepId : null,
    errorEnvelope: r.errorEnvelope, streamFinished: r.streamFinished, streamStatus: r.streamStatus,
  });

  const steps = intentOrder.map((iid) => {
    const es = intentEvents.get(iid);
    const reprStepId = reprStepOf.get(iid);
    const eventActions = es.map((e) => ({ stepId: e.stepId, action: actionByStep.get(e.stepId) || { resolution: 'none' } }));
    const stepIds = new Set(es.map((e) => e.stepId));
    const net = records.filter((r) => r.firingStepId != null && stepIds.has(r.firingStepId)).map((r) => projectNet(r, reprStepId));
    const pe = pageErrors
      .filter((p) => p.attributedStepId != null && stepIds.has(p.attributedStepId))
      .map((p) => {
        const projected = { attributedStepId: reprStepId };
        const message = projectPageErrorMessage(p.message);
        if (message !== undefined) projected.message = message;
        return projected;
      });
    const cnt = intentCount.get(iid) || {};
    const post = evaluateAssertions([...(expectedByIntent.get(iid) || []), ...globalAssertions], {
      urlPath: intentUrl.get(iid),
      netRecords: net,
      countBefore: cnt.before, countAfter: cnt.after,
      pageErrors: pe,
      toastTexts: intentToasts.get(iid),  // kinds-harden：缺采集即 undefined → 证不出
      textHits: intentTextHits.get(iid),
      buttonHits: intentButtonHits.get(iid), // wf-publish-states：缺采集即 undefined → 证不出
      buttonSeen: intentButtonSeen.get(iid), // 同刻通道活性（absent 反证前提）；缺采集即 undefined → 证不出
      buttonDisabledHits: intentButtonDisabledHits.get(iid), // btn-enable-ops：缺采集即 undefined → enabled/disabled 证不出
      replyText: intentReply.get(iid),    // chiefcomplaint-smoke：缺采集即 undefined → 证不出
      inputReadback: intentInputReadback.get(iid), // 脚本/字段值：只认 setNodeField 同一物理字段动作回读
      streamUrlPattern: chatCfg ? chatCfg.streamUrlPattern : undefined,
    });
    return {
      stepId: reprStepId,
      intentId: iid,
      atom: es.slice(-1)[0].atom,
      // verdict 仍只消费 intent 级 action；这里先对逐 event 轴 fail-safe 折叠，前序失败不得被末事件洗白。
      action: foldIntentAction(eventActions),
      // 完整逐 event 证据继续原样外露，供 compile --verify、报告原子操作和人工诊断消费。
      eventActions,
      postAssertions: post,
      forensics: { network: net, lifecycle: { crashed: false, crashedAtStepId: null, pageerror: pe } },
    };
  });

  // 孤儿网络记录（首事件前/无步发起）并进首 intent，归因仍 null，确保 allNet 可见。
  const orphan = records.filter((r) => r.firingStepId == null || !allStepIds.has(r.firingStepId))
    .map((r) => ({ url: projUrl(r.url), status: r.status, ts: r.ts, initiator: r.initiator, attributedStepId: null, errorEnvelope: r.errorEnvelope, streamFinished: r.streamFinished, streamStatus: r.streamStatus }));
  if (orphan.length && steps.length) steps[0].forensics.network.push(...orphan);

  if (cleanupEvidence && typeof cleanupEvidence === 'object') {
    const cleanupStep = steps.find((step) => step.atom === 'workflow.deleteByName');
    if (cleanupStep) {
      cleanupStep.postAssertions.push({
        kind: 'destructiveContinuity',
        op: 'stableTargetAbsence',
        value: '3 samples / 3000ms',
        actual: `${cleanupEvidence.sampleCount || 0} samples / ${cleanupEvidence.windowMs || 0}ms`,
        soft: false,
        ok: cleanupEvidence.cleanupSatisfied === true,
      });
    }
  }

  return JSON.stringify({
    caseId,
    ...(cleanupEvidence ? { cleanup: cleanupEvidence } : {}),
    steps,
  }, null, 2) + '\n';
}
