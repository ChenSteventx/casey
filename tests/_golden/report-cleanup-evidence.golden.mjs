#!/usr/bin/env node
// 冻结黄金标准（P7 报告第三增量 report-cleanup-evidence）：顶层 cleanupEvidence + 「清理证据」块
// （surface countChange 断言的删除前后命中数，report-spec #9）。自包含合成模型，不动共享 fixture。
// 实现前红（装配器无 cleanupEvidence / 渲染器无块 / schema 未声明）。改本文件 = Test Ratchet 判红。
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const fail = (m) => { console.error(`RED  report-cleanup-evidence: ${m}`); process.exit(1); };
let checks = 0; const ok = () => { checks++; };

const { assembleReportModel } = await import(`file://${join(ROOT, 'lib', 'report-model.mjs').replace(/\\/g, '/')}`);
const { renderReport } = await import(`file://${join(ROOT, 'lib', 'report.mjs').replace(/\\/g, '/')}`);

const GEN = '2026-07-08T00:00:00.000Z';
const CC = { kind: 'countChange', op: 'equals', value: '0', actual: '3→0', ok: true, soft: false };
const axStep = (over = {}) => ({ stepId: 'atstep_0', intentId: 'intent_0', atom: 'workflow.delete', action: { resolution: 'unique' }, postAssertions: [{ kind: 'urlPathname', op: 'startsWith', value: '/ok', actual: '/ok', ok: true, soft: false }], forensics: { lifecycle: { pageerror: [], crashed: false, crashedAtStepId: null }, network: [] }, ...over });
const vStep = (over = {}) => ({ stepId: 'atstep_0', intentId: 'intent_0', atom: 'workflow.delete', verdict: 'PASS', reason: null, ...over });
function call(vSteps, aSteps, extra = {}) {
  return assembleReportModel({ caseId: 'tc_cln', channel: 'web', verdict: { caseId: 'tc_cln', steps: vSteps }, axes: { caseId: 'tc_cln', steps: aSteps }, observed: null, events: null, meta: { generatedAt: GEN, ...(extra.meta || {}) } });
}

// ---- C-A 装配器 cleanupEvidence：含 countChange 步收该条；无则 [] ----
{
  const withCC = call([vStep()], [axStep({ postAssertions: [CC] })]);
  const ce = withCC.cleanupEvidence;
  if (!Array.isArray(ce) || ce.length !== 1) fail('含 countChange 步应收 1 条 cleanupEvidence');
  if (ce[0].stepId !== 'atstep_0' || ce[0].op !== 'equals' || ce[0].actual !== '3→0') fail('cleanupEvidence 条目须携 stepId/op/actual(删前→删后)');
  if (!('intentId' in ce[0]) || !('value' in ce[0])) fail('cleanupEvidence 条目须含 intentId/value');
  const noCC = call([vStep()], [axStep()]);
  if (!Array.isArray(noCC.cleanupEvidence) || noCC.cleanupEvidence.length !== 0) fail('无 countChange 时 cleanupEvidence 须 []');
  ok();
}

// ---- C-B schema 声明 cleanupEvidence + item 形态 ----
{
  const schema = JSON.parse(readFileSync(join(ROOT, 'tests', '_golden', 'schemas', 'report-model.schema.json'), 'utf8'));
  const p = schema.properties || {};
  if (!p.cleanupEvidence || p.cleanupEvidence.type !== 'array' || !p.cleanupEvidence.items) fail('schema cleanupEvidence 须 array + items');
  const itreq = p.cleanupEvidence.items.required || [];
  for (const k of ['stepId', 'op']) if (!itreq.includes(k)) fail(`schema cleanupEvidence.items.required 须含 ${k}`);
  if (p.cleanupEvidence.items.additionalProperties !== false) fail('schema cleanupEvidence.items 须 additionalProperties:false');
  if ((schema.required || []).includes('cleanupEvidence')) fail('cleanupEvidence 须加法可选、不入顶层 required');
  ok();
}

// ---- C-C 渲染 + 顺序（裁定概览 → 清理证据 → 分组步骤）----
{
  const { html, markdown } = renderReport(call([vStep()], [axStep({ postAssertions: [CC] })]));
  if (!html.includes('清理证据') || !html.includes('3→0')) fail('HTML 缺「清理证据」块或删前后命中数');
  const iSum = html.indexOf('class="summary"'), iCE = html.indexOf('清理证据'), iStep = html.indexOf('data-step-id=');
  if (iStep < 0) fail('前提：测试模型含步骤，HTML 须有 data-step-id 容器（评审 F2）');
  if (!(iSum >= 0 && iCE > iSum && iStep > iCE)) fail('HTML 顺序须 裁定概览 → 清理证据 → 分组步骤');
  if (!markdown.includes('清理证据') || !markdown.includes('3→0')) fail('MD 缺「清理证据」块');
  const mSum = markdown.indexOf('裁定概览'), mCE = markdown.indexOf('## 清理证据'), mGroup = markdown.indexOf('## 通过');
  if (mGroup < 0) fail('前提：测试模型含通过步，MD 须有分组标题（评审 F1）');
  if (!(mSum >= 0 && mCE > mSum && mCE < mGroup)) fail('MD 顺序须 裁定概览 → 清理证据 → 分组步骤');
  ok();
}

// ---- C-D 缺席零行为差：空 cleanupEvidence / 无键旧模型 → 不产块 ----
{
  const emptyOut = renderReport(call([vStep()], [axStep()]));
  if (emptyOut.html.includes('清理证据') || emptyOut.markdown.includes('清理证据')) fail('空 cleanupEvidence 不得产块（HTML/MD，评审 F3）');
  const oldModel = JSON.parse(readFileSync(join(ROOT, 'tests', '_golden', 'fixtures', 'seams', 'report-model.fixture.json'), 'utf8'));
  if ('cleanupEvidence' in oldModel) fail('前提失效：共享 fixture 不应带 cleanupEvidence');
  const oldOut = renderReport(oldModel);
  if (oldOut.html.includes('清理证据') || oldOut.markdown.includes('清理证据')) fail('旧模型（无键）不得产块（HTML/MD 零行为差）');
  ok();
}

// ---- C-E JSON 带 cleanupEvidence ----
{
  const jo = JSON.parse(renderReport(call([vStep()], [axStep({ postAssertions: [CC] })])).json);
  if (!Array.isArray(jo.cleanupEvidence) || jo.cleanupEvidence[0].actual !== '3→0') fail('JSON 须带 cleanupEvidence（actual 3→0）');
  ok();
}

console.log(`ok   report-cleanup-evidence: ${checks} 组不变量全过`);
process.exit(0);
