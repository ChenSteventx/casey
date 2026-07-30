#!/usr/bin/env node
// M4 求值时机运行时侧证（codex code-r5）：证明「调用落在 span 内」≠「调用落在回调体内」。
//
// 实参位的 IIFE 形态在语法上完全合法、计数纪律全过、调用也确实写在
// runWithCycleEvidence(…) 的实参词法范围内——但它是**实参**，求值发生在
// runWithCycleEvidence 被调用之前，也就是进入 als.run 之前，于是收集器一条都收不到。
// 本探针不碰静态文本，直接拿现役取证上下文件跑两种形态，量收集器实收事件数。
// 零 SUT、零 fs、零 network。

import {
  createCycleEvidenceCollector, runWithCycleEvidence, safeEmit, sealCycleEvidence,
} from '../../../../lib/teachin/cycle-evidence-context.mjs';

// 闭环替身：只做一件事——在自己被执行的那一刻往取证通道发一条。
function cycleBodyDouble() {
  safeEmit('source-completion.issuer-throw', {
    stage: 'source-raw-execute',
    reason: 'RUN_COMPLETION_INVALID',
    errorName: 'TypeError',
  });
  return 'CYCLE_RESULT';
}

// 自然形态（现役 bin/record.mjs 的写法）：闭环调用在零参箭头的函数体内，
// 于是它在 als.run 之内才求值。
function naturalForm() {
  const collector = createCycleEvidenceCollector();
  const returned = runWithCycleEvidence(collector, () => (
    cycleBodyDouble()
  ));
  return { returned, snapshot: sealCycleEvidence(collector) };
}

// codex code-r5 反例：实参位 IIFE。闭环调用是 IIFE 的实参，
// 求值在 runWithCycleEvidence 被调用之前完成——词法上仍在 span 内，语义上已在边界外。
function iifeArgumentForm() {
  const collector = createCycleEvidenceCollector();
  const returned = runWithCycleEvidence(collector, ((started) => () => started)(cycleBodyDouble()));
  return { returned, snapshot: sealCycleEvidence(collector) };
}

// 逗号表达式/第三实参变体：同样在 span 内、同样在边界外求值。
function trailingArgumentForm() {
  const collector = createCycleEvidenceCollector();
  const returned = runWithCycleEvidence(collector, () => 0, cycleBodyDouble());
  return { returned, snapshot: sealCycleEvidence(collector) };
}

// codex code-r6 反例的语义面：影子包裹把 runWithCycleEvidence 换成一枚同名替身，
// 回调照样被执行、返回值照样正确，但从未进过 als.run——取证收集器一条都收不到。
// （静态面上它靠 \u 转义把同一标识符写成两套字节躲过计数纪律，那一条由金牌 C7 ⑤ 封死。）
function shadowWrapperForm() {
  const collector = createCycleEvidenceCollector();
  const shadowedRunWithCycleEvidence = (unusedCollector, body) => body();
  const returned = shadowedRunWithCycleEvidence(collector, () => (
    cycleBodyDouble()
  ));
  return { returned, snapshot: sealCycleEvidence(collector) };
}

// codex code-r7 反例的语义面：普通别名改写——`import { safeEmit as runWithCycleEvidence }`。
// 不用任何转义，调用点一个字节不改，但拿到的是同模块另一个导出：
// safeEmit(refusalPoint, payload) 收下两个实参、把回调当成载荷丢掉，回调一次都不被调用。
function aliasedSubstituteForm() {
  const collector = createCycleEvidenceCollector();
  let bodyCalls = 0;
  // 这就是别名改写之后调用点实际拿到的那个函数。
  const aliasedRunWithCycleEvidence = safeEmit;
  const returned = aliasedRunWithCycleEvidence(collector, () => {
    bodyCalls += 1;
    return cycleBodyDouble();
  });
  return { returned, bodyCalls, snapshot: sealCycleEvidence(collector) };
}

const natural = naturalForm();
const iife = iifeArgumentForm();
const trailing = trailingArgumentForm();
const shadow = shadowWrapperForm();
const aliased = aliasedSubstituteForm();

const measured = {
  naturalForm: {
    eventCount: natural.snapshot.events.length,
    refusalPoints: natural.snapshot.events.map((row) => row.refusalPoint),
  },
  iifeArgumentForm: {
    eventCount: iife.snapshot.events.length,
    refusalPoints: iife.snapshot.events.map((row) => row.refusalPoint),
  },
  trailingArgumentForm: {
    eventCount: trailing.snapshot.events.length,
    refusalPoints: trailing.snapshot.events.map((row) => row.refusalPoint),
  },
  shadowWrapperForm: {
    eventCount: shadow.snapshot.events.length,
    refusalPoints: shadow.snapshot.events.map((row) => row.refusalPoint),
    // 返回值照样对——所以「闭环跑通了」这件事根本证不出「取证边界在场」。
    returnedSameAsNatural: shadow.returned === natural.returned,
  },
  aliasedSubstituteForm: {
    eventCount: aliased.snapshot.events.length,
    refusalPoints: aliased.snapshot.events.map((row) => row.refusalPoint),
    bodyCalls: aliased.bodyCalls,
    returned: aliased.returned === undefined ? 'undefined' : String(aliased.returned),
  },
};

console.log(JSON.stringify(measured, null, 2));

if (measured.naturalForm.eventCount !== 1) {
  console.error('PROBE_RED: 自然形态没收到事件——对照物本身就不成立');
  process.exit(1);
}
if (measured.iifeArgumentForm.eventCount !== 0) {
  console.error('PROBE_RED: 实参位 IIFE 竟收到了事件——codex code-r5 的语义判据复现不出来');
  process.exit(1);
}
if (measured.trailingArgumentForm.eventCount !== 0) {
  console.error('PROBE_RED: 尾随实参形态竟收到了事件——变体判据复现不出来');
  process.exit(1);
}
if (measured.shadowWrapperForm.eventCount !== 0
  || measured.shadowWrapperForm.returnedSameAsNatural !== true) {
  console.error('PROBE_RED: 影子包裹形态的语义判据复现不出来（应当返回值相同但零事件）');
  process.exit(1);
}
if (measured.aliasedSubstituteForm.eventCount !== 0
  || measured.aliasedSubstituteForm.bodyCalls !== 0) {
  console.error('PROBE_RED: 别名改写形态的语义判据复现不出来（应当 bodyCalls=0 且零事件）');
  process.exit(1);
}
console.log('PROBE_GREEN: 自然形态 eventCount=1；实参位 IIFE、尾随实参、影子包裹、别名改写均 eventCount=0'
  + '（影子包裹连返回值都与自然形态相同；别名改写更狠，bodyCalls=0 回调压根没跑）'
  + '——「在 span 内」「闭环跑通了」都证不出取证边界在场，'
  + 'C7 的刚性模板、\\u 禁令与裸具名导入钉分别钉的就是这几道缝');
