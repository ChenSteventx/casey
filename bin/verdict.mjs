#!/usr/bin/env node
// bin/verdict.mjs —— 多态裁定（零 LLM、纯确定性）。设计 §4.2 判定树。
//
//   node bin/verdict.mjs --axes <in.json> --out <out.json>
//   in  = { caseId, steps: [ StepAxes ] }   （三轴输入态，见 tests/_golden/fixtures/p2/verdict-cases.json）
//   out = { caseId, steps: [ { stepId, intentId, atom, verdict, reason } ] }
//
// 护栏：#15 裁判零 LLM、与自愈分进程（自愈是下游消费者，绝不反向进入此进程）；
//       #17 按断言种类不可知 —— 只把硬断言的 ok 与上、忽略 soft，绝不 switch on kind；
//       #14 fail-safe 不 fail-open —— 证不出一律 NEEDS_HUMAN(INDETERMINATE)，绝不默认成可自愈或静默 PASS。
// 断言续跑：逐步出裁定，绝不首错即停。
//
// 异构评审加固（2026-06-29）：取证按本步归因（生命周期同 network 规矩）、缺失 action 不当 true、
//   无硬断言不静默 PASS、缺 stepId 不假命中、入参畸形 fail-closed。

import { readFileSync, writeFileSync } from 'node:fs';

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--axes') o.axes = argv[++i];
    else if (argv[i] === '--out') o.out = argv[++i];
  }
  return o;
}

// 点击身份门：从动作原始信号推 actionPerformed ∈ {true, 'ambiguous', false}。
// 解析唯一 或 点击后身份回读成立 → true；多匹配/坐标兜底 → ambiguous；其余 → false。
// 只有显式声明的纯断言步（kind==='none'）才视为 true（无动作可失败，由断言驱动）；
// 缺失/畸形 action 轴 = 无证据，按未做成(false)处理 → 落 fail-safe，绝不当成做对了。
function deriveActionPerformed(action) {
  if (action && action.kind === 'none') return true;
  if (!action || typeof action !== 'object') return false;
  if (action.resolution === 'unique') return true;
  if (action.identityReadback && action.identityReadback.ok === true) return true;
  if (action.resolution === 'fallback_first' || action.resolution === 'coord_fallback') return 'ambiguous';
  return false;
}

// 取证背书：存在归因到本步的 SUT 错误（5xx / 错误信封失败 / pageerror / crash）。
// 一律按本步归因（attributedStepId / crashedAtStepId），非时间窗——背景轮询 401 或全局 pageerror
// 归因到别的步，不翻本步 verdict（护栏 #15）。stepId 缺失时不背书（防 undefined===undefined 假命中）。
function forensicsBacksSutError(forensics, stepId) {
  if (!forensics || stepId == null) return false;
  const lc = forensics.lifecycle || {};
  if (lc.crashed === true && lc.crashedAtStepId === stepId) return true;
  if (Array.isArray(lc.pageerror) && lc.pageerror.some((e) => e && e.attributedStepId === stepId)) return true;
  const net = Array.isArray(forensics.network) ? forensics.network : [];
  return net.some(
    (n) =>
      n &&
      n.attributedStepId != null &&
      n.attributedStepId === stepId &&
      (Number(n.status) >= 500 || (n.errorEnvelope && n.errorEnvelope.ok === false)),
  );
}

// 只读漂移探针信号：同稳定签名的唯一元素仍在（仅 locator 漂移）。
function driftHolds(action) {
  return !!(action && action.driftProbe && action.driftProbe.sameSignatureUniquePresent === true);
}

// §4.2 确定性判定树。
function decide(step) {
  const ap = deriveActionPerformed(step.action);
  const hard = (step.postAssertions || []).filter((a) => a && !a.soft); // soft 不进裁定树
  const backed = forensicsBacksSutError(step.forensics, step.stepId);

  if (ap === 'ambiguous') return { verdict: 'NEEDS_HUMAN', reason: 'AMBIGUOUS_ACTION' };

  if (ap === true) {
    // §2.1：无硬后置断言 → route:human，绝不静默发空 PASS（证不出别终判）。
    if (hard.length === 0) return { verdict: 'NEEDS_HUMAN', reason: 'INDETERMINATE' };
    if (hard.every((a) => a.ok === true)) return { verdict: 'PASS', reason: null };
    if (backed) return { verdict: 'SUT_DEFECT', reason: null };
    return { verdict: 'NEEDS_HUMAN', reason: 'SUT_DEFECT_OR_STALE' };
  }

  // ap === false：这步没做成（含 action 轴缺失）。
  if (backed) return { verdict: 'SUT_DEFECT', reason: null };
  if (driftHolds(step.action)) return { verdict: 'HARNESS_ERROR', reason: null };
  // CASE_DEFECT / AFFORDANCE_ABSENT 只在编译期/人签前 + 入口可证缺席时判（需编译期上下文，
  // S1 合成三轴不提供该信号、无 golden 钉，dead-until-P3/P4）；缺信号则按 fail-safe 落 INDETERMINATE。
  if (step.phase === 'compile' && step.action && step.action.affordanceAbsent === true) {
    return { verdict: 'NEEDS_HUMAN', reason: 'CASE_DEFECT' };
  }
  return { verdict: 'NEEDS_HUMAN', reason: 'INDETERMINATE' };
}

function main() {
  const { axes, out } = parseArgs(process.argv.slice(2));
  if (!axes || !out) {
    console.error('用法: node bin/verdict.mjs --axes <in.json> --out <out.json>');
    process.exit(64);
  }
  let input;
  try {
    input = JSON.parse(readFileSync(axes, 'utf8'));
  } catch (e) {
    console.error(`verdict: 读/解析 axes 失败：${e.message}`);
    process.exit(65); // 坏数据 fail-closed，区别于内部错误的 exit 1
  }
  if (!input || typeof input !== 'object') {
    console.error('verdict: axes 须为对象 { caseId, steps:[...] }');
    process.exit(65);
  }
  const inSteps = Array.isArray(input.steps) ? input.steps : [];
  const steps = inSteps.map((s) => {
    if (!s || typeof s !== 'object') {
      // 畸形步 fail-safe：不静默丢、不假 PASS。
      return { stepId: null, intentId: null, atom: null, verdict: 'NEEDS_HUMAN', reason: 'INDETERMINATE' };
    }
    const d = decide(s);
    return { stepId: s.stepId, intentId: s.intentId, atom: s.atom, verdict: d.verdict, reason: d.reason };
  });
  writeFileSync(out, JSON.stringify({ caseId: input.caseId, steps }, null, 2) + '\n', 'utf8');
}

main();
