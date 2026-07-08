#!/usr/bin/env node
// 冻结黄金标准（P7 报告第二增量 report-video-block）：顶层 replayVideo + 「回放录像」块（原子操作后、裁定概览前）。
// 自包含合成模型，不动共享 fixture。实现前红（装配器无 replayVideo / 渲染器无块 / schema 未声明）。改本文件 = Test Ratchet 判红。
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const fail = (m) => { console.error(`RED  report-video-block: ${m}`); process.exit(1); };
let checks = 0; const ok = () => { checks++; };

const { assembleReportModel } = await import(`file://${join(ROOT, 'lib', 'report-model.mjs').replace(/\\/g, '/')}`);
const { renderReport } = await import(`file://${join(ROOT, 'lib', 'report.mjs').replace(/\\/g, '/')}`);

const GEN = '2026-07-08T00:00:00.000Z';
const axStep = (over = {}) => ({ stepId: 'atstep_0', intentId: 'intent_0', atom: 'workflow.save', action: { resolution: 'unique' }, postAssertions: [{ kind: 'urlPathname', op: 'startsWith', value: '/ok', actual: '/ok', ok: true, soft: false }], forensics: { lifecycle: { pageerror: [], crashed: false, crashedAtStepId: null }, network: [] }, ...over });
const vStep = (over = {}) => ({ stepId: 'atstep_0', intentId: 'intent_0', atom: 'workflow.save', verdict: 'PASS', reason: null, ...over });
function call(extra = {}) {
  return assembleReportModel({
    caseId: 'tc_vid', channel: 'web',
    verdict: { caseId: 'tc_vid', steps: [vStep()] },
    axes: { caseId: 'tc_vid', steps: [axStep()] },
    observed: null, events: extra.events || null, meta: { generatedAt: GEN, ...(extra.meta || {}) },
    videoMeta: extra.videoMeta || null,
  });
}
const VID = { file: 'run_vid.webm', steps: [{ stepId: 'atstep_0', videoAt: 0 }] };

// ---- C-A 装配器 replayVideo：有 videoMeta → {file}；无 → null ----
{
  const withVid = call({ videoMeta: VID });
  if (!withVid.replayVideo || withVid.replayVideo.file !== 'run_vid.webm') fail('有 videoMeta 时 replayVideo.file 须为该文件名');
  const noVid = call();
  if (noVid.replayVideo !== null) fail('无 videoMeta 时 replayVideo 须 null');
  ok();
}

// ---- C-B schema 声明 replayVideo（object|null）+ 形态硬约束 ----
{
  const schema = JSON.parse(readFileSync(join(ROOT, 'tests', '_golden', 'schemas', 'report-model.schema.json'), 'utf8'));
  const p = schema.properties || {};
  if (!p.replayVideo || JSON.stringify(p.replayVideo.type) !== JSON.stringify(['object', 'null'])) fail('schema replayVideo 须 type [object,null]');
  if (!(p.replayVideo.required || []).includes('file')) fail('schema replayVideo.required 须含 file');
  if (p.replayVideo.additionalProperties !== false) fail('schema replayVideo 须 additionalProperties:false');
  if ((schema.required || []).includes('replayVideo')) fail('replayVideo 须加法可选、不入顶层 required');
  ok();
}

// ---- C-C 渲染顺序（原子操作 → 回放录像 → 裁定概览）+ 自包含相对 src ----
{
  const m = call({ videoMeta: VID, events: { caseId: 'tc_vid', events: [{ stepId: 'atstep_0', action: 'click' }] }, meta: { naturalLanguage: '用例文本' } });
  const { html } = renderReport(m);
  const iAS = html.indexOf('原子操作'), iVid = html.indexOf('回放录像'), iSum = html.indexOf('class="summary"');
  if (!(iAS >= 0 && iVid > iAS && iSum > iVid)) fail('HTML 顺序须 原子操作 → 回放录像 → 裁定概览');
  if (!/<video[^>]*\ssrc="run_vid\.webm"/.test(html)) fail('回放录像块须含相对 src 的可播放 <video>');
  if (/https?:\/\//i.test(html)) fail('回放录像块不得引入 http 外链（自包含）');
  ok();
}

// ---- C-D 无录像明示（replayVideo=null）+ 缺键零行为差 ----
{
  const nullVid = renderReport(call({ meta: { naturalLanguage: 'x' } }));
  if (!nullVid.html.includes('回放录像') || !nullVid.html.includes('无录像')) fail('replayVideo=null 时须产块并标「无录像」不静默');
  const oldModel = JSON.parse(readFileSync(join(ROOT, 'tests', '_golden', 'fixtures', 'seams', 'report-model.fixture.json'), 'utf8'));
  if ('replayVideo' in oldModel) fail('前提失效：共享 fixture 不应带 replayVideo');
  if (renderReport(oldModel).html.includes('回放录像')) fail('旧模型（无 replayVideo 键）不得产回放录像块（零行为差）');
  ok();
}

// ---- C-E JSON 带 replayVideo + MD 有回放录像块 ----
{
  const { markdown, json } = renderReport(call({ videoMeta: VID, meta: { naturalLanguage: 'x' } }));
  const jo = JSON.parse(json);
  if (!jo.replayVideo || jo.replayVideo.file !== 'run_vid.webm') fail('JSON 须带 replayVideo.file');
  if (!markdown.includes('回放录像') || !markdown.includes('[run_vid.webm](run_vid.webm)')) fail('MD 回放录像块须给可点链接 [file](file)（GRILL D4）');
  ok();
}

console.log(`ok   report-video-block: ${checks} 组不变量全过`);
process.exit(0);
