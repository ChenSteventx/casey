#!/usr/bin/env node
// 冻结黄金标准（P7 报告第四增量 report-workflow-structure）：顶层 workflowStructure + 「工作流画布结构」块
// （据画布构造原子 addNode/connectNodes/openNode 判结构覆盖 + 空/半成警示，report-spec #11）。
// 自包含合成模型，不动共享 fixture。实现前红。改本文件 = Test Ratchet 判红。
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const fail = (m) => { console.error(`RED  report-workflow-structure: ${m}`); process.exit(1); };
let checks = 0; const ok = () => { checks++; };

const { assembleReportModel } = await import(`file://${join(ROOT, 'lib', 'report-model.mjs').replace(/\\/g, '/')}`);
const { renderReport } = await import(`file://${join(ROOT, 'lib', 'report.mjs').replace(/\\/g, '/')}`);

const GEN = '2026-07-08T00:00:00.000Z';
// PASS 步 = action unique + 1 过断言；NEEDS_HUMAN 步 = action unique + 无 hard 断言（expectedVerdict INDETERMINATE）。
function canvasStep(stepId, atom, verdict = 'PASS') {
  const intentId = `i_${stepId}`;
  const v = { stepId, intentId, atom, verdict, reason: verdict === 'PASS' ? null : 'INDETERMINATE' };
  const a = {
    stepId, intentId, atom, action: { resolution: 'unique' },
    forensics: { lifecycle: { pageerror: [], crashed: false, crashedAtStepId: null }, network: [] },
    postAssertions: verdict === 'PASS' ? [{ kind: 'textVisible', op: 'contains', value: 'ok', actual: 'ok', ok: true, soft: false }] : [],
  };
  return { v, a };
}
function call(vs, as) {
  return assembleReportModel({ caseId: 'tc_ws', channel: 'web', verdict: { caseId: 'tc_ws', steps: vs }, axes: { caseId: 'tc_ws', steps: as }, observed: null, events: null, meta: { generatedAt: GEN } });
}

// ---- C-A 装配器 workflowStructure ----
{
  // 三画布原子全 PASS → structureComplete
  const a = canvasStep('atstep_0', 'workflow.addNode'), c = canvasStep('atstep_1', 'workflow.connectNodes'), o = canvasStep('atstep_2', 'workflow.openNode');
  const full = call([a.v, c.v, o.v], [a.a, c.a, o.a]).workflowStructure;
  if (!full || full.hasNodes !== true || full.hasConnection !== true || full.hasNodeConfig !== true || full.structureComplete !== true) fail('三画布原子全 PASS → structureComplete=true');
  // 缺 connectNodes（不在场）→ hasConnection=false、structureComplete=false
  const miss = call([a.v, o.v], [a.a, o.a]).workflowStructure;
  if (!miss || miss.hasConnection !== false || miss.structureComplete !== false || miss.hasNodes !== true || miss.hasNodeConfig !== true) fail('缺 connectNodes → hasConnection/structureComplete false，其余 true');
  // 孤立 addNode 步非 PASS → hasNodes=false（败步不算证）
  const bad = canvasStep('atstep_0', 'workflow.addNode', 'NEEDS_HUMAN');
  const badWs = call([bad.v], [bad.a]).workflowStructure;
  if (!badWs || badWs.hasNodes !== false) fail('addNode 步非 PASS → hasNodes false（败步不算证）');
  // 无画布构造原子 → null
  const pub = canvasStep('atstep_0', 'workflow.publish');
  if (call([pub.v], [pub.a]).workflowStructure !== null) fail('无画布构造原子 → workflowStructure null');
  // L1 去重：两 addNode（先败后过）→ hasNodes true（存在一个 PASS 即可，非首匹配语义）
  const badN = canvasStep('atstep_0', 'workflow.addNode', 'NEEDS_HUMAN'), goodN = canvasStep('atstep_1', 'workflow.addNode');
  const dup = call([badN.v, goodN.v], [badN.a, goodN.a]).workflowStructure;
  if (!dup || dup.hasNodes !== true) fail('两 addNode 先败后过 → hasNodes true（∃ PASS，去重非首匹配）');
  // L2/F5 三类各自 PASS 判独立：addNode PASS + connectNodes 非PASS + openNode 非PASS → 仅 hasNodes true
  const cBad = canvasStep('atstep_1', 'workflow.connectNodes', 'NEEDS_HUMAN'), oBad = canvasStep('atstep_2', 'workflow.openNode', 'NEEDS_HUMAN');
  const mixed = call([a.v, cBad.v, oBad.v], [a.a, cBad.a, oBad.a]).workflowStructure;
  if (!mixed || mixed.hasNodes !== true || mixed.hasConnection !== false || mixed.hasNodeConfig !== false || mixed.structureComplete !== false) fail('addNode PASS + 连线/配置非PASS → 仅 hasNodes true，其余 false（三类判独立）');
  ok();
}

// ---- C-B schema ----
{
  const schema = JSON.parse(readFileSync(join(ROOT, 'tests', '_golden', 'schemas', 'report-model.schema.json'), 'utf8'));
  const p = schema.properties || {};
  if (!p.workflowStructure || JSON.stringify(p.workflowStructure.type) !== JSON.stringify(['object', 'null'])) fail('schema workflowStructure 须 type [object,null]');
  const req = p.workflowStructure.required || [];
  for (const k of ['hasNodes', 'hasConnection', 'hasNodeConfig', 'structureComplete']) if (!req.includes(k)) fail(`schema workflowStructure.required 须含 ${k}`);
  if (p.workflowStructure.additionalProperties !== false) fail('schema workflowStructure 须 additionalProperties:false');
  if ((schema.required || []).includes('workflowStructure')) fail('workflowStructure 须加法可选、不入顶层 required');
  ok();
}

// ---- C-C 渲染：位置 + 逐类 ✓/✗ + 完整/不完整文案两向 ----
{
  const a = canvasStep('atstep_0', 'workflow.addNode'), c = canvasStep('atstep_1', 'workflow.connectNodes'), o = canvasStep('atstep_2', 'workflow.openNode');
  const { html, markdown } = renderReport(call([a.v, c.v, o.v], [a.a, c.a, o.a]));
  if (!html.includes('工作流画布结构')) fail('HTML 缺「工作流画布结构」块');
  // 位置：裁定概览 → 工作流画布结构 → 分组步骤
  const iSum = html.indexOf('class="summary"'), iWS = html.indexOf('工作流画布结构'), iStep = html.indexOf('data-step-id=');
  if (iStep < 0) fail('前提：测试模型含步骤，HTML 须有 data-step-id 容器');
  if (!(iSum >= 0 && iWS > iSum && iStep > iWS)) fail('HTML 顺序须 裁定概览 → 工作流画布结构 → 分组步骤');
  // 逐类 ✓/✗ 真渲染（防 glyph 倒置，评审 F1）——全 PASS 三类皆 ✓
  if (!html.includes('节点：✓') || !html.includes('连线：✓') || !html.includes('节点配置：✓')) fail('全 PASS 三类须各渲 ✓');
  // 完整案：OK 结论在场 且 警示缺席（评审 F2）
  if (!html.includes('均已验证通过') || html.includes('不得算满足验收')) fail('structureComplete 时须 OK 结论在场、警示缺席（HTML）');
  // MD：块在场 + 位置（评审 F3）+ OK 结论
  if (!markdown.includes('## 工作流画布结构')) fail('MD 缺「工作流画布结构」块');
  const mSum = markdown.indexOf('裁定概览'), mWS = markdown.indexOf('## 工作流画布结构'), mGroup = markdown.indexOf('## 通过');
  if (mGroup < 0) fail('前提：测试模型含通过步，MD 须有分组标题');
  if (!(mSum >= 0 && mWS > mSum && mWS < mGroup)) fail('MD 顺序须 裁定概览 → 工作流画布结构 → 分组步骤');
  if (!markdown.includes('均已验证通过') || markdown.includes('不得算满足验收')) fail('structureComplete 时须 OK 结论在场、警示缺席（MD）');
  // 不完整案：警示在场 且 OK 结论缺席；逐类 ✗ 真渲染
  const inc = renderReport(call([a.v, o.v], [a.a, o.a]));
  if (!inc.html.includes('不得算满足验收') || inc.html.includes('均已验证通过')) fail('结构不完整时须警示在场、OK 结论缺席（HTML）');
  if (!inc.html.includes('连线：✗') || !inc.html.includes('节点：✓')) fail('不完整案逐类 ✓/✗ 须真渲染（连线 ✗、节点 ✓）');
  if (!inc.markdown.includes('不得算满足验收') || inc.markdown.includes('均已验证通过')) fail('结构不完整时须警示在场、OK 结论缺席（MD）');
  ok();
}

// ---- C-D 缺席零行为差：null（非画布用例）/ 无键旧模型 → HTML+MD 均不产块 ----
{
  const pub = canvasStep('atstep_0', 'workflow.publish');
  const nullOut = renderReport(call([pub.v], [pub.a]));
  if (nullOut.html.includes('工作流画布结构') || nullOut.markdown.includes('工作流画布结构')) fail('workflowStructure=null 不得产块（HTML/MD）');
  const oldModel = JSON.parse(readFileSync(join(ROOT, 'tests', '_golden', 'fixtures', 'seams', 'report-model.fixture.json'), 'utf8'));
  if ('workflowStructure' in oldModel) fail('前提失效：共享 fixture 不应带 workflowStructure');
  const oldOut = renderReport(oldModel);
  if (oldOut.html.includes('工作流画布结构') || oldOut.markdown.includes('工作流画布结构')) fail('旧模型（无键）不得产块（HTML/MD 零行为差）');
  ok();
}

// ---- C-E JSON 带 workflowStructure 全形态（四布尔投影不丢，评审 F6）----
{
  const a = canvasStep('atstep_0', 'workflow.addNode'), c = canvasStep('atstep_1', 'workflow.connectNodes'), o = canvasStep('atstep_2', 'workflow.openNode');
  const jo = JSON.parse(renderReport(call([a.v, c.v, o.v], [a.a, c.a, o.a])).json);
  const w = jo.workflowStructure;
  if (!w || w.hasNodes !== true || w.hasConnection !== true || w.hasNodeConfig !== true || w.structureComplete !== true) fail('JSON workflowStructure 须带四布尔全形态（全 PASS 皆 true）');
  // 不完整投影：三布尔仍在、structureComplete false
  const inc = JSON.parse(renderReport(call([a.v, o.v], [a.a, o.a])).json).workflowStructure;
  if (!inc || inc.hasConnection !== false || inc.structureComplete !== false || inc.hasNodes !== true) fail('JSON 不完整投影须保三布尔（hasConnection false / structureComplete false / hasNodes true）');
  ok();
}

console.log(`ok   report-workflow-structure: ${checks} 组不变量全过`);
process.exit(0);
