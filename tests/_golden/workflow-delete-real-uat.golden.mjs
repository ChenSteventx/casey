#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
if (!root) {
  console.error('用法: workflow-delete-real-uat.golden.mjs <真实 UAT 根目录>');
  process.exit(64);
}

const specs = [
  ['tc_wf_publish_states', 'intent_3', 4],
  ['tc_wf_history_version', 'intent_7', 8],
  ['tc_catalog_wf_crud', 'intent_3', 4],
];
const problems = [];
const read = (file) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { problems.push(`坏件或缺件: ${path.basename(file)}`); return null; }
};

for (const [caseId, cleanupIntent, passCount] of specs) {
  const dir = path.join(root, caseId);
  const verdict = read(path.join(dir, 'verdict.json'));
  const axes = read(path.join(dir, 'axes.json'));
  const report = read(path.join(dir, `${caseId}.report.json`));
  const profile = read(path.join(dir, 'profile.json'));
  if (!verdict || !axes || !report || !profile) continue;

  const vs = verdict.steps || [];
  if (vs.length !== passCount || vs.some((s) => s.verdict !== 'PASS' || s.reason != null)) {
    problems.push(`${caseId}: 确定性 verdict 非 ${passCount}/${passCount} PASS`);
  }
  const cleanup = (axes.steps || []).find((s) => s.intentId === cleanupIntent);
  if (!cleanup) problems.push(`${caseId}: 缺 cleanup intent`);
  else {
    if (!Array.isArray(cleanup.eventActions) || cleanup.eventActions.length !== 7
      || cleanup.eventActions.some((e) => e?.action?.resolution !== 'unique' || e?.action?.identityReadback?.ok !== true)) {
      problems.push(`${caseId}: cleanup 事件未全 unique/身份回读未全成功`);
    }
    const count = (cleanup.postAssertions || []).find((a) => a.kind === 'countChange');
    if (!count || count.op !== 'equals' || count.value !== 0 || count.ok !== true || !String(count.actual).endsWith('→0')) {
      problems.push(`${caseId}: cleanup 精确计数未归零`);
    }
  }

  if (profile.countSelector !== '.hr-card.hr-card--bordered:has-text("atl_r1")') {
    problems.push(`${caseId}: countSelector 未锚真实 replay 实体 atl_r1`);
  }
  if (profile.quiet?.loadingSelector !== '.route-loading-mask') problems.push(`${caseId}: 缺真实加载遮罩`);
  if (typeof report.naturalLanguage !== 'string' || !report.naturalLanguage.trim()) problems.push(`${caseId}: 缺自然语言用例`);
  if (!Array.isArray(report.atomicSteps) || report.atomicSteps.length === 0
    || report.atomicSteps.some((s) => !s.stepId || !s.intentId)) problems.push(`${caseId}: 原子操作缺 stepId/intentId`);
  if (report.replayVideo?.file !== 'video.webm') problems.push(`${caseId}: 缺回放录像引用`);
  if (report.visualReview?.status !== 'CONSISTENT' || report.visualReview?.verdictImpact !== 'none') {
    problems.push(`${caseId}: 视觉复核未完成或影响了 verdict`);
  }
  for (const e of report.visualReview?.evidence || []) {
    if (!fs.existsSync(path.join(dir, e.file))) problems.push(`${caseId}: 视觉证据缺 ${e.file}`);
  }
  for (const a of report.artifacts || []) {
    if (!fs.existsSync(path.join(dir, a.file))) problems.push(`${caseId}: 附件缺 ${a.file}`);
  }
  const htmlPath = path.join(dir, `${caseId}.report.html`);
  let html = '';
  try { html = fs.readFileSync(htmlPath, 'utf8'); } catch { problems.push(`${caseId}: HTML 缺失`); }
  for (const heading of ['测试用例', '原子操作', '回放录像', '附件', '视觉复核', '清理证据']) {
    if (!html.includes(`<h2>${heading}</h2>`)) problems.push(`${caseId}: HTML 缺 ${heading}`);
  }
  try { if (fs.statSync(path.join(dir, 'video.webm')).size <= 0) problems.push(`${caseId}: 录像为空`); }
  catch { problems.push(`${caseId}: 录像缺失`); }
}

const residue = read(path.join(root, 'final-residue-probe.json'));
if (!residue || residue.channel !== 'real-browser-read-only' || residue.target !== 'atl_r1' || residue.targetCount !== 0) {
  problems.push('独立真实浏览器残留探针未证明 atl_r1=0');
}
const aggregate = read(path.join(root, 'index.report.json'));
const links = new Set((aggregate?.groups || []).flatMap((g) => g.cases || []).map((c) => c.reportHref));
for (const [caseId] of specs) {
  if (!links.has(`${caseId}/${caseId}.report.html`)) problems.push(`聚合报告缺 ${caseId} 单例 HTML 链接`);
}

if (problems.length) {
  console.error(`RED workflow-delete-real-uat: ${problems.length} 问题`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('GREEN workflow-delete-real-uat: 3/3 真实用例、16/16 PASS、录像/视觉/独立 HTML/附件/清理证据齐全，atl_r1 残留 0');
