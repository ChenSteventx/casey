#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  assembleAggregateModel,
  buildArtifactManifest,
  projectCaseNarrative,
  projectVisualReview,
} from '../../lib/report-model.mjs';
import { renderAggregate, renderReport } from '../../lib/report.mjs';

const narrative = projectCaseNarrative({
  preconditions: ['已登录', '具备工作流权限'],
  intents: [{ intentId: 'intent_create', text: '新建工作流' }, { intentId: 'intent_cleanup', text: '删除并确认归零' }],
}, []);
assert.equal(narrative, '前置条件：\n1. 已登录\n2. 具备工作流权限\n测试步骤：\n1. 新建工作流\n2. 删除并确认归零');

const review = projectVisualReview({
  status: 'CONSISTENT', reviewer: 'codex-vision', reviewedAt: '2026-07-15T03:00:00.000Z',
  summary: '关键业务画面与确定性裁定一致。', evidence: [{ file: 'frame-001.png', videoAt: 1.25, note: '创建页' }],
});
assert.equal(review.verdictImpact, 'none');
assert.throws(() => projectVisualReview({ ...review, verdictImpact: 'override' }), /verdictImpact/);

const artifacts = buildArtifactManifest('tc_real', { file: 'video.webm' }, review);
for (const file of ['tc_real.report.html', 'tc_real.report.md', 'tc_real.report.json', 'verdict.json', 'axes.json', 'run-history.jsonl', 'run-metrics.json', 'video.json', 'video.webm', 'visual-review.json']) {
  assert.ok(artifacts.some((a) => a.file === file), `缺附件 ${file}`);
}

const rendered = renderReport({
  caseId: 'tc_real', channel: 'web', generatedAt: '2026-07-15T03:00:00.000Z', naturalLanguage: narrative,
  atomicSteps: [{ seq: 1, kind: 'action', stepId: 'atstep_1', intentId: 'intent_1', describe: 'click' }],
  replayVideo: { file: 'video.webm' }, artifacts, visualReview: review,
  verdictSummary: { PASS: 1, SUT_DEFECT: 0, HARNESS_ERROR: 0, NEEDS_HUMAN: 0 }, steps: [],
}).html;
assert.match(rendered, /stepId <code>atstep_1<\/code>/);
assert.match(rendered, /<h2>附件<\/h2>/);
assert.match(rendered, /href="axes\.json" download/);
assert.match(rendered, /<h2>视觉复核<\/h2>/);
assert.match(rendered, /不参与确定性裁定/);

const aggregate = assembleAggregateModel({
  generatedAt: '2026-07-15T03:00:00.000Z',
  reports: [{ caseId: 'tc_real', reportHref: 'tc_real/tc_real.report.html', verdictSummary: { PASS: 1, SUT_DEFECT: 0, HARNESS_ERROR: 0, NEEDS_HUMAN: 0 }, steps: [] }],
});
assert.match(renderAggregate(aggregate).html, /href="tc_real\/tc_real\.report\.html"/);

console.log('real-report-delivery: 纯函数验收通过');
