#!/usr/bin/env node
// 冻结黄金标准（layer3-wiring 覆盖锁 · 装配器 fail-safe / 凭据 / schema 合法性）：
// 补 layer3-wiring.golden.mjs（只走 happy/inject500 主路径）不覆盖的失败方向——
// 装配器对「输入缺失/异常/敏感值」的 fail-closed 与凭据红线（护栏 #7/#14），以及缺陷单最小证据闭合。
// 由 codex 异构评审 FAIL（9 发现）逐条采信去修后钉红，方向锚 F1-F7；
// 第 3 轮残留续钉：F3 标量脱敏(N4)、F5 剩余自守(N5/N6/E7/E8/E9/A1)、语义洞 ap===false 前置(D4 修夹具+D6)。
// 第 4 轮 codex 高危续钉：verdict⋈axes 一致性门(C1/C2/C2b/C3，闭假绿+ambiguous)、断言值脱敏(L1/L2)、url 路径段脱敏(U1)、
//   真 date-time 范围(E10)、id/label 类型收敛(S1/S2)。
// 第 4 轮复审续钉：join 完整性/防漏报(J3)、caseId 同源(K1/K1b)、SUT 自由文本脱敏(FT1-4)、url percent-encoding decode 脱敏(FT5)。
// 第 5 轮续钉：scalar percent-decode(FT7)、caseId 严格已提供校验(K1c)。
// 收敛到现实凭据形状（用户裁决）：脱敏只覆盖 URL/文本里的 token 串/邮箱/长不透明串 + percent-decode（现实中台会遇到的），
//   刻意不追多词短语(api key/session id) 与 本地化 PII(SSN/身份证/手机号)——非本中台会吐的内容，真凭据由下游 report.mjs credentialGate 按 site.json 字面量兜底。
// 纯函数直测 assembleReportModel（合成 StepAxes/verdict 复现冻结形状、非倒裁）。
// 改本文件 = Test Ratchet 判红。实现前跑 → 红（无守卫/无生命周期背书/URL 泄漏 query）；建齐 → 绿。
import { assembleReportModel } from '../../lib/report-model.mjs';

const GEN = '2026-07-01T00:00:00.000Z';
const fails = [];
let pass = 0;

// 冻结 StepAxes 形状最小复现（stepId/intentId/atom/action/postAssertions/forensics 三轴）。
function axStep(over = {}) {
  return {
    stepId: 'atstep_0', intentId: 'intent_0', atom: 'workflow.save',
    action: { resolution: 'unique' },
    postAssertions: [{ kind: 'urlPathname', op: 'startsWith', value: '/ok', actual: '/ok', ok: true, soft: false }],
    forensics: { lifecycle: { pageerror: [], crashed: false, crashedAtStepId: null }, network: [] },
    ...over,
  };
}
// 冻结 verdict.json step 形状（stepId/intentId/atom/verdict/reason）。
function vStep(over = {}) {
  return { stepId: 'atstep_0', intentId: 'intent_0', atom: 'workflow.save', verdict: 'PASS', reason: null, ...over };
}
function call(vSteps, aSteps, extra = {}) {
  return assembleReportModel({
    caseId: 'tc_cov', channel: 'web',
    verdict: { caseId: 'tc_cov', steps: vSteps },
    axes: { caseId: 'tc_cov', steps: aSteps },
    observed: null, events: null, meta: { generatedAt: GEN }, ...extra,
  });
}
function expectThrow(name, fn) {
  try { fn(); fails.push(`${name}: 期望 fail-closed 抛错、实际未抛（fail-open）`); }
  catch { pass++; }
}
function expectOk(name, fn) {
  try { fn(); pass++; }
  catch (e) { fails.push(`${name}: 期望不抛、实际抛了 ${e && e.message}`); }
}

// ── 正向基线（防守卫过严把合法输入误伤）────────────────────────
expectOk('P0 合法 PASS 装配、无 defectTicket', () => {
  const m = call([vStep()], [axStep()]);
  if (m.steps[0].defectTicket != null) throw new Error('PASS 步不应有 defectTicket');
  if (m.verdictSummary.PASS !== 1) throw new Error('verdictSummary.PASS 计数错');
  if (m.steps.length !== 1) throw new Error('steps 数错');
});
expectOk('R1 NEEDS_HUMAN(INDETERMINATE) 合法放行、无 defectTicket（axes 复算一致：ap=true 无硬断言）', () => {
  const m = call([vStep({ verdict: 'NEEDS_HUMAN', reason: 'INDETERMINATE' })], [axStep({ postAssertions: [] })]);
  if (m.steps[0].defectTicket != null) throw new Error('NEEDS_HUMAN 不应有 defectTicket');
});

// ── C verdict⋈axes 一致性门（第 4 轮 codex：装配器复算 decide 比对，不一致 fail-closed；只比对不重裁定，护栏 #14/#15）──
const passButFailed = axStep({ postAssertions: [{ kind: 'x', op: 'y', value: 'a', actual: 'b', ok: false, soft: false }] }); // ap=true + 失败硬断言 + 无背书 → 复算 NEEDS_HUMAN(SUT_DEFECT_OR_STALE)
expectThrow('C1 verdict=PASS 但 axes 有失败硬断言(复算非 PASS) → fail-closed 抛（假绿闭合，High）', () => call([vStep({ verdict: 'PASS' })], [passButFailed]));
const ambig = axStep({ action: { resolution: 'fallback_first' } }); // ap=ambiguous → 复算 NEEDS_HUMAN(AMBIGUOUS_ACTION)
expectThrow('C2 verdict=PASS 但动作 ambiguous(复算 AMBIGUOUS_ACTION) → fail-closed 抛（与裁判不一致，High）', () => call([vStep({ verdict: 'PASS' })], [ambig]));
expectOk('C2b verdict=NEEDS_HUMAN(AMBIGUOUS_ACTION) 与 ambiguous 动作一致 → 放行（反误伤）', () => {
  const m = call([vStep({ verdict: 'NEEDS_HUMAN', reason: 'AMBIGUOUS_ACTION' })], [ambig]);
  if (m.steps[0].verdict !== 'NEEDS_HUMAN' || m.steps[0].defectTicket != null) throw new Error('应载 NEEDS_HUMAN 无 defectTicket');
});
const driftAx = axStep({ action: { resolution: 'none', driftProbe: { sameSignatureUniquePresent: true } }, postAssertions: [] }); // ap=false + driftHolds → 复算 HARNESS_ERROR
expectOk('C3 verdict=HARNESS_ERROR 与 axes 漂移证据一致 → 放行、无 defectTicket（反误伤）', () => {
  const m = call([vStep({ verdict: 'HARNESS_ERROR', reason: null })], [driftAx]);
  if (m.steps[0].defectTicket != null) throw new Error('HARNESS_ERROR 不应有 defectTicket');
  if (m.verdictSummary.HARNESS_ERROR !== 1) throw new Error('HARNESS_ERROR 计数错');
});

// ── F1/F2 缺陷单最小证据闭合 + 生命周期背书（与 verdict.mjs forensicsBacksSutError 同源）──
const netDefect = axStep({
  postAssertions: [{ kind: 'noErrorEnvelope', op: 'envelopeOk', value: 'status==200', actual: 'status==500', ok: false, soft: false }],
  forensics: { lifecycle: { pageerror: [], crashed: false, crashedAtStepId: null }, network: [{ url: 'http://sut/api/save', status: 500, initiator: 'atstep_0', attributedStepId: 'atstep_0' }] },
});
expectOk('D1 SUT_DEFECT 网络 500 背书 → 缺陷单 ≥1 断言 + ≥1 背书', () => {
  const dt = call([vStep({ verdict: 'SUT_DEFECT' })], [netDefect]).steps[0].defectTicket;
  if (!dt || dt.failedAssertions.length < 1 || dt.backingForensics.length < 1) throw new Error('缺陷单空');
  if (!dt.backingForensics.some((f) => f.status === 500)) throw new Error('缺归因本步 500 背书');
});
const peDefect = axStep({
  postAssertions: [{ kind: 'urlPathname', op: 'startsWith', value: '/ok', actual: '/nope', ok: false, soft: false }],
  forensics: { lifecycle: { pageerror: [{ message: 'boom', attributedStepId: 'atstep_0' }], crashed: false, crashedAtStepId: null }, network: [] },
});
expectOk('D2 SUT_DEFECT 仅 pageerror 生命周期背书 → backing 非空（F2）', () => {
  const dt = call([vStep({ verdict: 'SUT_DEFECT' })], [peDefect]).steps[0].defectTicket;
  if (!dt || dt.backingForensics.length < 1) throw new Error('生命周期背书缺失 → 空 backing 违反 schema minItems:1');
  if (!dt.backingForensics.every((f) => f.attributedStepId === 'atstep_0')) throw new Error('backing 未归因本步');
});
const crDefect = axStep({
  postAssertions: [{ kind: 'urlPathname', op: 'startsWith', value: '/ok', actual: '/nope', ok: false, soft: false }],
  forensics: { lifecycle: { pageerror: [], crashed: true, crashedAtStepId: 'atstep_0' }, network: [] },
});
expectOk('D3 SUT_DEFECT 仅 crash 生命周期背书 → backing 非空（F2）', () => {
  const dt = call([vStep({ verdict: 'SUT_DEFECT' })], [crDefect]).steps[0].defectTicket;
  if (!dt || dt.backingForensics.length < 1) throw new Error('crash 背书缺失');
});
const actionFail = axStep({
  action: { resolution: 'none' }, // 动作确未达成(ap===false，locator 未命中)——才是「无失败硬断言→合成 actionPerformed」的合法前提；ap===false + 5xx 背书 = verdict.mjs 可复现的 SUT_DEFECT
  postAssertions: [],
  forensics: { lifecycle: { pageerror: [], crashed: false, crashedAtStepId: null }, network: [{ url: 'http://sut/api', status: 503, initiator: 'atstep_0', attributedStepId: 'atstep_0' }] },
});
expectOk('D4 SUT_DEFECT 动作未达成(ap=false)无失败断言 → 合成 actionPerformed 断言 ≥1（F1）', () => {
  const dt = call([vStep({ verdict: 'SUT_DEFECT' })], [actionFail]).steps[0].defectTicket;
  if (dt.failedAssertions.length < 1) throw new Error('failedAssertions 应合成 ≥1');
  if (!dt.failedAssertions.some((a) => a.kind === 'actionPerformed' && a.actual === false)) throw new Error('应合成 actionPerformed=false');
  if (dt.backingForensics.length < 1) throw new Error('backing 应 ≥1');
});
// 语义洞（codex 第 3 轮方向）：故意构造 verdict.mjs 不可能产的态（ap=true + 无失败硬断言却判 SUT_DEFECT）——
// verdict.mjs 该态出 PASS/INDETERMINATE、绝不出 SUT_DEFECT；装配器须拒绝凭空合成 actionPerformed=false（无证据失败断言）→ fail-closed。
const apTrueNoFail = axStep({
  action: { resolution: 'unique' }, // 动作已执行(ap=true)
  postAssertions: [], // 无失败硬断言
  forensics: { lifecycle: { pageerror: [], crashed: false, crashedAtStepId: null }, network: [{ url: 'http://sut/api', status: 500, initiator: 'atstep_0', attributedStepId: 'atstep_0' }] },
});
expectThrow('D6 SUT_DEFECT 但动作已执行(ap=true)且无失败硬断言 → fail-closed 抛（语义洞：绝不凭空合成 actionPerformed=false）', () => call([vStep({ verdict: 'SUT_DEFECT' })], [apTrueNoFail]));
const noBacking = axStep({
  postAssertions: [{ kind: 'x', op: 'y', value: 'a', actual: 'b', ok: false, soft: false }],
  forensics: { lifecycle: { pageerror: [], crashed: false, crashedAtStepId: null }, network: [] },
});
expectThrow('D5 SUT_DEFECT 但 axes 无任何背书 → fail-closed 抛（F1，产物不一致）', () => call([vStep({ verdict: 'SUT_DEFECT' })], [noBacking]));

// ── F3 凭据红线：URL 剥 query/hash、信封值收敛标量 ─────────────
const urlToken = axStep({
  forensics: { lifecycle: { pageerror: [], crashed: false, crashedAtStepId: null }, network: [{ url: 'https://sut/api/save?token=SECRET123&email=a@b.com#frag', status: 200, initiator: 'atstep_0', attributedStepId: 'atstep_0' }] },
});
expectOk('N1 网络取证 URL 剥 query/hash（F3 凭据）', () => {
  const u = call([vStep()], [urlToken]).steps[0].forensics.network[0].url;
  if (/token|SECRET123|email|[?#]/.test(u)) throw new Error('URL 泄漏 query/hash: ' + u);
});
const url500Token = axStep({
  postAssertions: [{ kind: 'x', op: 'y', value: 'a', actual: 'b', ok: false, soft: false }],
  forensics: { lifecycle: { pageerror: [], crashed: false, crashedAtStepId: null }, network: [{ url: 'https://sut/api/save?token=SECRET123', status: 500, initiator: 'atstep_0', attributedStepId: 'atstep_0' }] },
});
expectOk('N2 缺陷单 backing URL 剥 query（F3）', () => {
  const u = call([vStep({ verdict: 'SUT_DEFECT' })], [url500Token]).steps[0].defectTicket.backingForensics[0].url;
  if (/token|SECRET123|[?#]/.test(u)) throw new Error('缺陷单 backing URL 泄漏: ' + u);
});
const envObj = axStep({
  forensics: { lifecycle: { pageerror: [], crashed: false, crashedAtStepId: null }, network: [{ url: 'https://sut/api', status: 200, initiator: 'atstep_0', attributedStepId: 'atstep_0', errorEnvelope: { field: 'status', expected: 200, actual: { token: 'SECRET', body: 'leak' }, ok: false } }] },
});
expectOk('N3 信封 actual 为对象 → 收敛标量/redaction（F3）', () => {
  const ee = call([vStep()], [envObj]).steps[0].forensics.network[0].errorEnvelope;
  if (ee.actual && typeof ee.actual === 'object') throw new Error('信封 actual 未收敛为标量');
  if (JSON.stringify(ee).includes('SECRET')) throw new Error('信封泄漏 SECRET');
});
const envScalarToken = axStep({
  forensics: { lifecycle: { pageerror: [], crashed: false, crashedAtStepId: null }, network: [{ url: 'https://sut/api', status: 200, initiator: 'atstep_0', attributedStepId: 'atstep_0', errorEnvelope: { field: 'status', expected: 'status==200', actual: 'token=SECRET123&email=a@b.com', ok: false } }] },
});
expectOk('N4 信封 actual 标量字符串夹带 token=&email= → 脱敏（F3 残留：标量也脱敏）', () => {
  const ee = call([vStep()], [envScalarToken]).steps[0].forensics.network[0].errorEnvelope;
  const s = JSON.stringify(ee);
  if (/SECRET123|token=|email|a@b\.com/.test(s)) throw new Error('标量信封值泄漏敏感串: ' + s);
  if (ee.expected !== 'status==200') throw new Error('非敏感标量 expected 被误伤脱敏');
});

// ── F5 残留 schema 自守：status 整数 / errorEnvelope.field 字符串 ────────
const nonIntStatus = axStep({
  forensics: { lifecycle: { pageerror: [], crashed: false, crashedAtStepId: null }, network: [{ url: 'http://sut/api', status: 200.5, initiator: 'atstep_0', attributedStepId: 'atstep_0' }] },
});
expectOk('N5 network.status 非整数(浮点) → 收敛 null（schema integer|null，F5）', () => {
  const st = call([vStep()], [nonIntStatus]).steps[0].forensics.network[0];
  if (st.status !== null) throw new Error('非整数 status 应收敛 null，实为 ' + st.status);
});
const envFieldNull = axStep({
  forensics: { lifecycle: { pageerror: [], crashed: false, crashedAtStepId: null }, network: [{ url: 'http://sut/api', status: 200, initiator: 'atstep_0', attributedStepId: 'atstep_0', errorEnvelope: { field: null, expected: 200, actual: 500, ok: false } }] },
});
expectOk('N6 errorEnvelope.field 非字符串 → 不产非法信封(收敛 null)（F5）', () => {
  const ee = call([vStep()], [envFieldNull]).steps[0].forensics.network[0].errorEnvelope;
  if (ee !== null) throw new Error('field 非字符串信封应收敛 null，实为 ' + JSON.stringify(ee));
});
// postAssertion / 缺陷单失败断言 的 value/actual 标量也脱敏（第 4 轮 codex High：原来只脱敏信封值）。
const postLeak = axStep({ postAssertions: [{ kind: 'urlPathname', op: 'startsWith', value: '/ok', actual: 'token=SECRET123&x=1', ok: true, soft: false }] });
expectOk('L1 postAssertion.actual 标量夹带 token= → 脱敏（护栏 #7，断言值也脱敏）', () => {
  const pa = call([vStep()], [postLeak]).steps[0].postAssertions[0];
  if (/SECRET123|token=/.test(JSON.stringify(pa))) throw new Error('postAssertion 泄漏敏感串: ' + JSON.stringify(pa));
});
const dtLeak = axStep({
  postAssertions: [{ kind: 'noErrorEnvelope', op: 'envelopeOk', value: 'status==200', actual: 'token=SECRET999', ok: false, soft: false }],
  forensics: { lifecycle: { pageerror: [], crashed: false, crashedAtStepId: null }, network: [{ url: 'http://sut/api', status: 500, initiator: 'atstep_0', attributedStepId: 'atstep_0' }] },
});
expectOk('L2 缺陷单 failedAssertions.actual 夹带 token= → 脱敏（护栏 #7）', () => {
  const dt = call([vStep({ verdict: 'SUT_DEFECT' })], [dtLeak]).steps[0].defectTicket;
  if (/SECRET999|token=/.test(JSON.stringify(dt.failedAssertions))) throw new Error('缺陷单断言泄漏敏感串');
});
const urlPathEmail = axStep({
  forensics: { lifecycle: { pageerror: [], crashed: false, crashedAtStepId: null }, network: [{ url: 'https://sut/user/a@b.com/profile', status: 200, initiator: 'atstep_0', attributedStepId: 'atstep_0' }] },
});
expectOk('U1 网络 url 路径段夹带邮箱 → 段级脱敏（护栏 #7，非仅剥 query）', () => {
  const u = call([vStep()], [urlPathEmail]).steps[0].forensics.network[0].url;
  if (/a@b\.com/.test(u)) throw new Error('url 路径泄漏邮箱: ' + u);
});

// ── F4 join 一致性：verdict 步须唯一映射 axes 步 + axes 全消费（双射）─────────────
expectThrow('J1 verdict 步无对应 axes 步 → fail-closed 抛（F4）', () => call([vStep({ stepId: 'atstep_9' })], [axStep({ stepId: 'atstep_0' })]));
expectThrow('J2 axes stepId 重复 → fail-closed 抛（F4）', () => call([vStep()], [axStep(), axStep()]));
expectThrow('J3 axes 多出未裁定步(verdict 漏掉失败步) → fail-closed 抛（第 4 轮 High：join 完整性/防漏报假绿）', () => call([vStep()], [axStep(), axStep({ stepId: 'atstep_1', intentId: 'intent_1' })]));

// ── F5/F6 schema 合法性守卫（无 ajv、装配器自守）─────────────
expectThrow('E1 未知 verdict 枚举 → 抛（F6）', () => call([vStep({ verdict: 'BROKEN' })], [axStep()]));
expectThrow('E2 verdict.steps 空 → 抛（F5，steps minItems:1）', () => call([], []));
expectThrow('E3 非法 channel → 抛（F5）', () => assembleReportModel({ caseId: 'tc', channel: 'mobile', verdict: { steps: [vStep()] }, axes: { steps: [axStep()] }, meta: { generatedAt: GEN } }));
expectThrow('E4 caseId 缺失/非字符串 → 抛（F5）', () => assembleReportModel({ channel: 'web', verdict: { steps: [vStep()] }, axes: { steps: [axStep()] }, meta: { generatedAt: GEN } }));
expectThrow('E5 终判态带非 null reason → 抛（F5）', () => call([vStep({ verdict: 'PASS', reason: 'INDETERMINATE' })], [axStep()]));
expectThrow('E6 NEEDS_HUMAN 无合法 reason 子类 → 抛（F5）', () => call([vStep({ verdict: 'NEEDS_HUMAN', reason: null })], [axStep()]));
expectThrow('E7 generatedAt 非 date-time → 抛（F5，schema format date-time）', () => assembleReportModel({ caseId: 'tc', channel: 'web', verdict: { steps: [vStep()] }, axes: { steps: [axStep()] }, meta: { generatedAt: '2026-07-01 not-iso' } }));
expectThrow('E8 meta.passes 非布尔 → 抛（F5，schema boolean|null）', () => call([vStep()], [axStep()], { meta: { generatedAt: GEN, passes: 'yes' } }));
expectThrow('E9 meta.title 非字符串 → 抛（F5）', () => call([vStep()], [axStep()], { meta: { generatedAt: GEN, title: 123 } }));
expectThrow('E10 generatedAt 形状合规但日期非法(月99/时99) → 抛（F5，真 date-time 范围，第 4 轮）', () => assembleReportModel({ caseId: 'tc', channel: 'web', verdict: { steps: [vStep()] }, axes: { steps: [axStep()] }, meta: { generatedAt: '2026-99-99T99:99:99Z' } }));
expectThrow('K1 caseId 与 verdict.caseId 不同源 → fail-closed 抛（第 4 轮 Medium：防跨 case 拼装）', () => assembleReportModel({ caseId: 'A', channel: 'web', verdict: { caseId: 'B', steps: [vStep()] }, axes: { caseId: 'B', steps: [axStep()] }, meta: { generatedAt: GEN } }));
expectOk('K1b caseId 全同源 → 放行（反误伤）', () => assembleReportModel({ caseId: 'X', channel: 'web', verdict: { caseId: 'X', steps: [vStep()] }, axes: { caseId: 'X', steps: [axStep()] }, meta: { generatedAt: GEN } }));
expectThrow('K1c observed.caseId 已提供但非字符串(123) → fail-closed 抛（第 5 轮：畸形已提供来源不放过）', () => assembleReportModel({ caseId: 'tc', channel: 'web', verdict: { steps: [vStep()] }, axes: { steps: [axStep()] }, observed: { caseId: 123, steps: [] }, meta: { generatedAt: GEN } }));
expectOk('E7b meta.passes=false 合法放行（反误伤）', () => {
  const m = call([vStep()], [axStep()], { meta: { generatedAt: GEN, passes: false } });
  if (m.passes !== false) throw new Error('合法 passes=false 应保留');
});

// ── F7 布尔严格：postAssertion.ok/soft 须布尔（防 !! 静默改写观测语义）──
expectThrow('B1 postAssertion.soft 缺失（非布尔）→ 抛（F7）', () => call([vStep()], [axStep({ postAssertions: [{ kind: 'x', op: 'y', value: 'a', actual: 'b', ok: true }] })]));
expectThrow('B2 postAssertion.value 为对象（非标量）→ 抛（F5）', () => call([vStep()], [axStep({ postAssertions: [{ kind: 'x', op: 'y', value: { a: 1 }, actual: 'b', ok: true, soft: false }] })]));

// ── F5 残留：events.action 非字符串 → 不产非法 action.kind ────────────
expectOk('A1 events.action 非字符串(对象) → 丢弃该动作投影、绝不产非法 action.kind（F5）', () => {
  const m = assembleReportModel({ caseId: 'tc', channel: 'web', verdict: { steps: [vStep()] }, axes: { steps: [axStep()] }, events: { events: [{ stepId: 'atstep_0', action: { kind: 'x' } }] }, meta: { generatedAt: GEN } });
  const st = m.steps[0];
  if (st.action != null && typeof st.action.kind !== 'string') throw new Error('action.kind 非字符串（非法 schema）');
});
expectOk('A1b events.action 合法字符串 → 正常投影 action.kind（反误伤）', () => {
  const m = assembleReportModel({ caseId: 'tc', channel: 'web', verdict: { steps: [vStep()] }, axes: { steps: [axStep()] }, events: { events: [{ stepId: 'atstep_0', action: 'click' }] }, meta: { generatedAt: GEN } });
  if (!m.steps[0].action || m.steps[0].action.kind !== 'click') throw new Error('合法 action 应投影 kind=click');
});

// ── F5 扩展 schema 类型收敛（第 4 轮 codex Medium：id/label 类字段 string|null、字符串数组）────
expectOk('S1 verdict.intentId 非字符串(数字) → 收敛 null（schema string|null）', () => {
  const m = call([vStep({ intentId: 123 })], [axStep()]);
  if (m.steps[0].intentId !== null) throw new Error('非字符串 intentId 应收敛 null，实为 ' + m.steps[0].intentId);
});
expectOk('S2 observed.cleanTitles 非数组 / toastTexts 含非字符串 → 收敛 string[]（schema）', () => {
  const m = assembleReportModel({ caseId: 'tc', channel: 'web', verdict: { steps: [vStep()] }, axes: { steps: [axStep()] }, observed: { steps: [{ stepId: 'atstep_0', cleanTitles: 'not-array', toastTexts: [1, 'ok', 2] }] }, meta: { generatedAt: GEN } });
  const o = m.steps[0].observed;
  if (!Array.isArray(o.cleanTitles) || o.cleanTitles.length !== 0) throw new Error('cleanTitles 非数组应收敛 []');
  if (JSON.stringify(o.toastTexts) !== JSON.stringify(['ok'])) throw new Error('toastTexts 应只留字符串项');
});

// ── FT SUT 自由文本凭据/PII 脱敏（第 4 轮 codex High：observed.*/pageerror.message；含 percent-encoding）────
expectOk('FT1 observed.toastTexts 夹带 token= → 逐项脱敏、保非敏感项（护栏 #7）', () => {
  const m = assembleReportModel({ caseId: 'tc', channel: 'web', verdict: { steps: [vStep()] }, axes: { steps: [axStep()] }, observed: { steps: [{ stepId: 'atstep_0', toastTexts: ['保存成功', 'token=SECRET42'] }] }, meta: { generatedAt: GEN } });
  const s = JSON.stringify(m.steps[0].observed.toastTexts);
  if (/SECRET42|token=/.test(s)) throw new Error('toast 泄漏敏感串: ' + s);
  if (!/保存成功/.test(s)) throw new Error('非敏感 toast 被误伤');
});
expectOk('FT2 observed.replyText 正文夹带邮箱 → token 级脱敏(保正文)（护栏 #7）', () => {
  const m = assembleReportModel({ caseId: 'tc', channel: 'web', verdict: { steps: [vStep()] }, axes: { steps: [axStep()] }, observed: { steps: [{ stepId: 'atstep_0', replyText: '您的账号是 alice@corp.com 已创建' }] }, meta: { generatedAt: GEN } });
  const r = m.steps[0].observed.replyText;
  if (/alice@corp\.com/.test(r)) throw new Error('replyText 泄漏邮箱: ' + r);
  if (!/已创建/.test(r)) throw new Error('正文被过度脱敏');
});
const peLeak = axStep({ forensics: { lifecycle: { pageerror: [{ message: 'request failed Bearer AbCdEf0123456789AbCdEf0123456789xyzTOK for user', attributedStepId: 'atstep_0' }], crashed: false, crashedAtStepId: null }, network: [] } });
expectOk('FT3 pageerror.message 含 Bearer 长 token → 关键词+长串脱敏、保正文（护栏 #7 现实形状）', () => {
  const pe = call([vStep()], [peLeak]).steps[0].forensics.lifecycle.pageerror[0];
  if (/Bearer|AbCdEf0123456789/.test(JSON.stringify(pe))) throw new Error('pageerror 泄漏 bearer token: ' + JSON.stringify(pe));
  if (!/request|failed|user/.test(JSON.stringify(pe))) throw new Error('非敏感正文被误伤');
});
expectOk('FT4 observed.urlPathnameAfter 夹带邮箱路径段 → 段级脱敏（护栏 #7）', () => {
  const m = assembleReportModel({ caseId: 'tc', channel: 'web', verdict: { steps: [vStep()] }, axes: { steps: [axStep()] }, observed: { steps: [{ stepId: 'atstep_0', urlPathnameAfter: '/user/a@b.com/profile' }] }, meta: { generatedAt: GEN } });
  const u = m.steps[0].observed.urlPathnameAfter;
  if (/a@b\.com/.test(u)) throw new Error('urlPathnameAfter 泄漏邮箱: ' + u);
});
const urlPct = axStep({ forensics: { lifecycle: { pageerror: [], crashed: false, crashedAtStepId: null }, network: [{ url: 'https://sut/user/a%40b.com/x', status: 200, initiator: 'atstep_0', attributedStepId: 'atstep_0' }] } });
expectOk('FT5 url 路径 percent-encoded 邮箱(a%40b.com) → decode 后脱敏（第 4 轮 Medium）', () => {
  const u = call([vStep()], [urlPct]).steps[0].forensics.network[0].url;
  if (/a%40b\.com|a@b\.com/.test(u)) throw new Error('percent-encoded 邮箱漏脱敏: ' + u);
});
const urlKeyVal = axStep({ forensics: { lifecycle: { pageerror: [], crashed: false, crashedAtStepId: null }, network: [{ url: 'https://sut/api/session/S0meL0ngOpaqueSessionId0123456789abcd/x', status: 200, initiator: 'atstep_0', attributedStepId: 'atstep_0' }] } });
expectOk('FT6 url 路径 /session/<长id> → 敏感 key 段与长 id 段脱敏（护栏 #7 现实形状）', () => {
  const u = call([vStep()], [urlKeyVal]).steps[0].forensics.network[0].url;
  if (/session|S0meL0ngOpaque/.test(u)) throw new Error('url 路径敏感段漏脱敏: ' + u);
  if (!/\/api\//.test(u)) throw new Error('非敏感段被误伤');
});
expectOk('FT7 replyText percent-encoded 邮箱(alice%40corp.com) → decode 后脱敏（第 5 轮 Medium）', () => {
  const m = assembleReportModel({ caseId: 'tc', channel: 'web', verdict: { steps: [vStep()] }, axes: { steps: [axStep()] }, observed: { steps: [{ stepId: 'atstep_0', replyText: '账号 alice%40corp.com 已创建' }] }, meta: { generatedAt: GEN } });
  const r = m.steps[0].observed.replyText;
  if (/alice%40corp\.com|alice@corp\.com/.test(r)) throw new Error('percent-encoded 邮箱漏脱敏: ' + r);
  if (!/已创建/.test(r)) throw new Error('正文被过度脱敏');
});

if (fails.length) {
  for (const f of fails) console.error(`RED  layer3-wiring-coverage: ${f}`);
  process.exit(1);
}
console.log(`ok   layer3-wiring-coverage: ${pass} 检查全过（装配器 fail-safe/凭据/schema 合法性 + 缺陷单证据闭合 + 生命周期背书）`);
process.exit(0);
