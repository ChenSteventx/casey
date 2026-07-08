#!/usr/bin/env node
// 冻结黄金标准（P7 报告首增量 report-nl-atomic）：report-model 装配器产 naturalLanguage + atomicSteps，
// 渲染器 HTML/MD/JSON 出「测试用例」「原子操作」块（位于裁定概览之前）。自包含合成模型，不动共享 fixture。
// 实现前红（装配器无字段 / 渲染器无块 / schema 未声明）。改本文件 = Test Ratchet 判红。
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const fail = (m) => { console.error(`RED  report-nl-atomic: ${m}`); process.exit(1); };
let checks = 0; const ok = () => { checks++; };

const { assembleReportModel } = await import(`file://${join(ROOT, 'lib', 'report-model.mjs').replace(/\\/g, '/')}`);
const { renderReport } = await import(`file://${join(ROOT, 'lib', 'report.mjs').replace(/\\/g, '/')}`);

const GEN = '2026-07-08T00:00:00.000Z';
// 默认带一条过断言 + resolution unique → expectedVerdict 复算 PASS，与 vStep 默认 PASS 一致（镜像 report-fidelity 助手）。
const axStep = (over = {}) => ({ stepId: 'atstep_0', intentId: 'intent_0', atom: 'workflow.save', action: { resolution: 'unique' }, postAssertions: [{ kind: 'urlPathname', op: 'startsWith', value: '/ok', actual: '/ok', ok: true, soft: false }], forensics: { lifecycle: { pageerror: [], crashed: false, crashedAtStepId: null }, network: [] }, ...over });
const vStep = (over = {}) => ({ stepId: 'atstep_0', intentId: 'intent_0', atom: 'workflow.save', verdict: 'PASS', reason: null, ...over });
function call(vSteps, aSteps, extra = {}) {
  return assembleReportModel({
    caseId: 'tc_nla', channel: 'web',
    verdict: { caseId: 'tc_nla', steps: vSteps },
    axes: { caseId: 'tc_nla', steps: aSteps },
    observed: null, events: extra.events || null, meta: { generatedAt: GEN, ...(extra.meta || {}) },
  });
}

// ---- C-A atomicSteps 派生：动作 + 断言各一条、seq 连续从 1、挂 stepId/intentId ----
{
  const v = [vStep({ stepId: 'atstep_0', intentId: 'intent_0' }), vStep({ stepId: 'atstep_1', intentId: 'intent_1' })];
  const a = [
    axStep({ stepId: 'atstep_0', intentId: 'intent_0', postAssertions: [{ kind: 'textVisible', op: 'contains', value: '新增', actual: '新增', ok: true, soft: false }] }),
    axStep({ stepId: 'atstep_1', intentId: 'intent_1', postAssertions: [{ kind: 'urlPathname', op: 'startsWith', value: '/list', actual: '/list', ok: true, soft: false }, { kind: 'textVisible', op: 'contains', value: '保存', actual: '保存', ok: true, soft: false }] }),
  ];
  const events = { caseId: 'tc_nla', events: [{ stepId: 'atstep_0', action: 'click' }] };
  const m = call(v, a, { events });
  const as = m.atomicSteps;
  if (!Array.isArray(as)) fail('装配器须产 atomicSteps 数组');
  if (as.length !== 4) fail(`atomicSteps 应 4 条（1 动作+3 断言），实得 ${as.length}`);
  if (!as.every((x, i) => x.seq === i + 1)) fail('atomicSteps.seq 须从 1 连续');
  if (as[0].kind !== 'action' || as[0].describe !== 'click') fail('首条须为 action click');
  if (as.slice(1).some((x) => x.kind !== 'assertion')) fail('其余须为 assertion');
  if (as.some((x) => typeof x.stepId !== 'string' || !('intentId' in x) || typeof x.describe !== 'string')) fail('每条须挂 stepId + intentId + describe');
  if (as[0].stepId !== 'atstep_0' || as[3].stepId !== 'atstep_1') fail('atomicSteps 须按步序挂 stepId');
  ok();
}

// ---- C-B naturalLanguage：meta 优先 / intentText 合成 / 皆缺 null ----
{
  const explicit = call([vStep()], [axStep()], { meta: { naturalLanguage: '把历史版本用例跑一遍出报告' } });
  if (explicit.naturalLanguage !== '把历史版本用例跑一遍出报告') fail('meta.naturalLanguage 须优先原样');
  const synth = call(
    [vStep({ intentId: 'intent_0' }), vStep({ stepId: 'atstep_1', intentId: 'intent_1' })],
    [axStep({ intentId: 'intent_0' }), axStep({ stepId: 'atstep_1', intentId: 'intent_1' })],
    { meta: { intentTextByIntent: { intent_0: '点击新增工作流', intent_1: '断言列表出现该项' } } },
  );
  if (typeof synth.naturalLanguage !== 'string' || !synth.naturalLanguage.includes('点击新增工作流') || !synth.naturalLanguage.includes('断言列表出现该项')) fail('缺 meta.naturalLanguage 时须由 intentText 合成');
  const none = call([vStep()], [axStep()]);
  if (none.naturalLanguage !== null) fail('meta/intentText 皆缺时 naturalLanguage 须 null');
  ok();
}

// ---- C-C 冻结 schema 加法放行两字段 + item 形态硬约束（回指契约完整；评审 F2/F5）----
{
  const schema = JSON.parse(readFileSync(join(ROOT, 'tests', '_golden', 'schemas', 'report-model.schema.json'), 'utf8'));
  const p = schema.properties || {};
  if (!p.naturalLanguage || JSON.stringify(p.naturalLanguage.type) !== JSON.stringify(['string', 'null'])) fail('schema naturalLanguage 须 type [string,null]');
  if (!p.atomicSteps || p.atomicSteps.type !== 'array' || !p.atomicSteps.items) fail('schema atomicSteps 须 array + items');
  const itreq = p.atomicSteps.items.required || [];
  for (const k of ['seq', 'kind', 'stepId', 'intentId', 'describe']) if (!itreq.includes(k)) fail(`schema atomicSteps.items.required 须含 ${k}（每条回指须挂 stepId/intentId）`);
  if (p.atomicSteps.items.additionalProperties !== false) fail('schema atomicSteps.items 须 additionalProperties:false');
  const topReq = schema.required || [];
  if (topReq.includes('naturalLanguage') || topReq.includes('atomicSteps')) fail('两字段须加法可选、不得入顶层 required（旧模型/夹具不破）');
  ok();
}

// ---- C-D 渲染：HTML/MD 出「测试用例」「原子操作」块且在裁定概览前；JSON 带两字段；null 明示 ----
{
  const v = [vStep({ intentId: 'intent_0' })];
  const a = [axStep({ intentId: 'intent_0', postAssertions: [{ kind: 'textVisible', op: 'contains', value: '新增', actual: '新增', ok: true, soft: false }] })];
  const events = { caseId: 'tc_nla', events: [{ stepId: 'atstep_0', action: 'click' }] };
  const m = call(v, a, { events, meta: { naturalLanguage: '跑历史版本用例出报告' } });
  const { html, markdown, json } = renderReport(m);
  if (!html.includes('测试用例') || !html.includes('跑历史版本用例出报告')) fail('HTML 缺「测试用例」块或自然语言文本');
  if (!html.includes('原子操作')) fail('HTML 缺「原子操作」块');
  const iNL = html.indexOf('测试用例'), iAS = html.indexOf('原子操作'), iSum = html.indexOf('class="summary"');
  if (!(iNL >= 0 && iAS > iNL && iSum > iAS)) fail('HTML 顺序须 测试用例 → 原子操作 → 裁定概览(summary)');
  if (!markdown.includes('测试用例') || !markdown.includes('跑历史版本用例出报告')) fail('MD 缺「测试用例」块');
  if (!markdown.includes('原子操作')) fail('MD 缺「原子操作」块');
  const jo = JSON.parse(json);
  if (jo.naturalLanguage !== '跑历史版本用例出报告') fail('JSON 缺 naturalLanguage');
  if (!Array.isArray(jo.atomicSteps) || jo.atomicSteps.length < 1) fail('JSON 缺 atomicSteps');
  const { html: h2 } = renderReport(call([vStep()], [axStep()]));
  if (!h2.includes('未提供自然语言用例')) fail('naturalLanguage=null 时须显式占位不静默');
  ok();
}

// ---- C-E atomicSteps.describe 脱敏（护栏 #7）----
{
  const m = call([vStep()], [axStep({ postAssertions: [{ kind: 'textVisible', op: 'contains', value: 'token=SECRET123', actual: 'token=SECRET123', ok: true, soft: false }] })]);
  if (/SECRET123/.test(JSON.stringify(m.atomicSteps))) fail('atomicSteps.describe 须脱敏（token=SECRET123 不得原样）');
  ok();
}

// ---- C-F 空 atomicSteps 不产块（D5；评审 F4）；非空产块 ----
{
  const m = call([vStep()], [axStep()], { meta: { naturalLanguage: '仅用例文本' } });
  if (!Array.isArray(m.atomicSteps) || m.atomicSteps.length === 0) fail('前提：m 应有非空 atomicSteps');
  const empty = renderReport({ ...m, atomicSteps: [] });
  if (empty.html.includes('原子操作')) fail('空 atomicSteps 不得产 HTML「原子操作」块');
  if (empty.markdown.includes('## 原子操作')) fail('空 atomicSteps 不得产 MD「原子操作」块');
  if (!empty.html.includes('仅用例文本')) fail('naturalLanguage 非空仍须产「测试用例」块（与 atomicSteps 空各判）');
  const full = renderReport(m);
  if (!full.html.includes('原子操作')) fail('非空 atomicSteps 须产块');
  ok();
}

// ---- 缺席零行为差：不含两字段的旧模型（共享 fixture）渲染不产新块 ----
{
  const oldModel = JSON.parse(readFileSync(join(ROOT, 'tests', '_golden', 'fixtures', 'seams', 'report-model.fixture.json'), 'utf8'));
  if ('naturalLanguage' in oldModel || 'atomicSteps' in oldModel) fail('前提失效：共享 fixture 不应带新字段');
  const { html } = renderReport(oldModel);
  if (html.includes('原子操作') || html.includes('未提供自然语言用例')) fail('旧模型（无字段）渲染不得产新块（零行为差）');
  ok();
}

console.log(`ok   report-nl-atomic: ${checks} 组不变量全过`);
process.exit(0);
