// lib/heal-gate.mjs — 自愈准入门（纯函数、零 LLM、确定性骨架）。
// 自愈是裁判（verdict.mjs）的下游消费者：只读 verdict 步、不反向进入裁判进程（护栏 #15）。
// fail-safe 不 fail-open：只对正向确证的 HARNESS_ERROR（过程错误/工装漂移）开闸；
//   PASS/SUT_DEFECT/NEEDS_HUMAN 一律拒——缺取证 ≠ 工装错（护栏 #13/#14、design §4.2/§10）。
// 入参畸形（非对象/缺 verdict）一律 fail-closed admit:false。真 L3 重锚/LLM 自愈不在此、属后续 route:human。

// 拒绝原因（确定性枚举，供上游路由与报告，不进裁判进程）。
export const HEAL_REFUSE = {
  NOT_A_FAILURE: 'PASS_NO_DRIFT',          // 通过步无漂移可愈
  DEFECT_NOT_DRIFT: 'SUT_DEFECT_NO_HEAL',  // 被测缺陷禁止自愈（最危险假绿的来源）
  ROUTE_HUMAN: 'NEEDS_HUMAN_ROUTE',        // 待人裁决，不自愈
  MALFORMED: 'MALFORMED_VERDICT_STEP',     // 入参畸形 fail-closed
};

const REFUSE_BY_VERDICT = {
  PASS: HEAL_REFUSE.NOT_A_FAILURE,
  SUT_DEFECT: HEAL_REFUSE.DEFECT_NOT_DRIFT,
  NEEDS_HUMAN: HEAL_REFUSE.ROUTE_HUMAN,
};

// admitForHeal(verdictStep) -> { admit:boolean, reason:string }
// verdictStep 形如 verdict.json 的步：{ stepId, intentId, atom, verdict, reason, ... }（caseId/verdictPath 由调用方补）。
export function admitForHeal(verdictStep) {
  if (!verdictStep || typeof verdictStep !== 'object' || Array.isArray(verdictStep)) {
    return { admit: false, reason: HEAL_REFUSE.MALFORMED };
  }
  const v = verdictStep.verdict;
  if (v === 'HARNESS_ERROR') return { admit: true, reason: 'CONFIRMED_HARNESS_DRIFT' };
  if (Object.prototype.hasOwnProperty.call(REFUSE_BY_VERDICT, v)) {
    return { admit: false, reason: REFUSE_BY_VERDICT[v] };
  }
  // 未知/缺失 verdict：catch-all fail-safe（绝不默认成可自愈）。
  return { admit: false, reason: HEAL_REFUSE.MALFORMED };
}
