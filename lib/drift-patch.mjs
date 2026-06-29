// lib/drift-patch.mjs — 非就地漂移补丁（纯函数、确定性骨架）。
// 自愈对单步确证 HARNESS_ERROR 的重锚【提案】：落 drift/<caseId>.<ts>.patch 旁文件，
//   原 spec/events 一字不动、照常回放，直到人签后才应用，应用后由同一冻结 L0 checker 复核（护栏 #5、design §9.5）。
// 产物符合 tests/_golden/schemas/drift-patch.schema.json。真 L3 重锚（locatorAfter 真实生成）/真人签写回/签后复核闭环不在此、属后续 route:human。
import { admitForHeal } from './heal-gate.mjs';

// 应用状态机：proposed(自愈刚写,未签) → signed(人签 apply,待写入) → applied(已写入并复核)；
//   reject→rejected；超阈/被取代→superseded。终态无出边。
const TRANSITIONS = {
  proposed: { sign: 'signed', reject: 'rejected', supersede: 'superseded' },
  signed: { apply: 'applied', reject: 'rejected', supersede: 'superseded' },
  applied: {},
  rejected: {},
  superseded: {},
};

// nextStatus(from, event) -> string；非法迁移（跳过 signed / 终态再迁 / 未知事件）抛错。
export function nextStatus(from, event) {
  const to = TRANSITIONS[from] && TRANSITIONS[from][event];
  if (!to) throw new Error(`drift-patch: 非法状态迁移 ${from} --${event}--> （proposed→signed→applied 才合法）`);
  return to;
}

// 人签是否完整：非空对象 + signedAt + signerId + decision∈{apply,reject}。
function signoffComplete(ho) {
  return !!ho && typeof ho === 'object'
    && typeof ho.signedAt === 'string' && ho.signedAt.length > 0
    && typeof ho.signerId === 'string' && ho.signerId.length > 0
    && (ho.decision === 'apply' || ho.decision === 'reject');
}

// canApply(patch) -> boolean：仅当人签完整(signedAt/signerId) 且 decision=apply 且 status=signed（可应用态）才 true。
// 非就地铁律：人签后才应用；proposed(未签)/已 applied/驳回 一律 false（护栏 #5）。
export function canApply(patch) {
  if (!patch || typeof patch !== 'object') return false;
  if (patch.status !== 'signed') return false;          // 只在「人签 apply、待写入」态可应用
  if (!signoffComplete(patch.humanSignoff)) return false;
  return patch.humanSignoff.decision === 'apply';
}

const stepIndex = (stepId) => {
  const m = /^atstep_([0-9]+)$/.exec(String(stepId || ''));
  if (!m) throw new Error(`drift-patch: stepId 须为 atstep_i（实为 ${stepId}）`);
  return Number(m[1]);
};

// buildDriftPatch(...) -> patch（proposed 态）。输入全取自上游事实，自愈不二次推断裁定（护栏 #15）。
export function buildDriftPatch({ verdictStep, driftProbe, locatorBefore, locatorAfter, stableSignature, tsToken }) {
  // 1) 准入门：只对确证 HARNESS_ERROR 步建补丁（缺确证不建，护栏 #13）。
  const gate = admitForHeal(verdictStep);
  if (!gate.admit) throw new Error(`drift-patch: 仅对确证 HARNESS_ERROR 步建补丁（准入门拒：${gate.reason}）`);

  // 2) 必需上游事实校验。
  if (!verdictStep.caseId || !verdictStep.verdictPath) throw new Error('drift-patch: verdictStep 须带 caseId/verdictPath（verdictRef 背书出处）');
  if (!stableSignature || !stableSignature.canonical || !stableSignature.before || !stableSignature.after) {
    throw new Error('drift-patch: 缺 stableSignature.canonical/before/after');
  }
  // 3) 合法漂移不变量：稳定签名 before === after（重锚同一稳定元素，只换 locator）。
  if (JSON.stringify(stableSignature.before) !== JSON.stringify(stableSignature.after)) {
    throw new Error('drift-patch: stableSignature.before 须 === after（签名变即非纯定位漂移，route:human 不自愈）');
  }
  // 4) 正向漂移探针：同稳定签名唯一元素仍在（否则不是工装漂移）。
  if (!driftProbe || driftProbe.sameSignatureUniquePresent !== true) {
    throw new Error('drift-patch: 缺 driftProbe.sameSignatureUniquePresent===true（同稳定签名唯一元素仍在）');
  }
  // 5) 重锚不得退化到坐标兜底。
  if (!locatorAfter || locatorAfter.strategy === 'coord') {
    throw new Error('drift-patch: locatorAfter 须为语义策略、不得退化为 coord');
  }
  if (!/^[0-9]+$/.test(String(tsToken))) throw new Error('drift-patch: tsToken 须 epoch 毫秒串（^[0-9]+$）');

  const eventIndex = stepIndex(verdictStep.stepId);
  const generatedAt = new Date(Number(tsToken)).toISOString(); // 由 tsToken 派生 → 确定性、与文件名 <ts> 同一时点

  // 漂移探针字段按白名单回填（不夹带越界键）。
  const probe = { sameSignatureUniquePresent: true };
  if (Number.isInteger(driftProbe.candidateCount)) probe.candidateCount = driftProbe.candidateCount;
  if (typeof driftProbe.matchedSignature === 'string') probe.matchedSignature = driftProbe.matchedSignature;

  const patch = {
    schemaVersion: 1,
    patchKind: 'relocate',
    caseId: verdictStep.caseId,
    stepId: verdictStep.stepId,
    intentId: verdictStep.intentId,
    generatedAt,
    tsToken: String(tsToken),
    specTarget: {
      eventsPath: `runs/${verdictStep.caseId}/events.json`,
      eventIndex,
    },
    locatorBefore,
    locatorAfter,
    stableSignature,
    triggerEvidence: {
      verdictRef: {
        verdictPath: verdictStep.verdictPath,
        caseId: verdictStep.caseId,
        stepId: verdictStep.stepId,
        verdict: 'HARNESS_ERROR',
        reason: verdictStep.reason == null ? null : verdictStep.reason,
      },
      recordedLocatorMiss: true,
      driftProbe: probe,
      driftCount: 1,
      escalated: false,
    },
    humanSignoff: null,
    status: 'proposed',
    appliedAt: null,
    postApplyRecheck: null,
    audit: [{ ts: generatedAt, from: null, to: 'proposed', by: 'self-heal(L3)' }],
  };
  // 可选字段仅在上游给出时回填（兑现 schema additionalProperties:false：不夹带空键）。
  if (typeof verdictStep.atom === 'string') patch.atom = verdictStep.atom;
  if (['web', 'cef', 'arbitrary'].includes(verdictStep.channel)) patch.channel = verdictStep.channel;

  return patch;
}
