#!/usr/bin/env node
// 纯逻辑/CLI-IO 边界检查：不启动浏览器、不连接任何 SUT/fixture、不使用网络。
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const { summarizeDeleteCountAudit } = await import(new URL('../../lib/compile-atoms.mjs', import.meta.url));
const { buildArtifactManifest } = await import(new URL('../../lib/report-model.mjs', import.meta.url));
const { renderReport } = await import(new URL('../../lib/report.mjs', import.meta.url));

const table = summarizeDeleteCountAudit({
  tableRows: 1, targetCards: 0, tableDeleteButtons: 1, targetCardDeleteButtons: null, globalDeleteButtons: 9,
});
assert.equal(table.layout, 'table');
assert.equal(table.equal, true);

const card = summarizeDeleteCountAudit({
  tableRows: 0, targetCards: 1, tableDeleteButtons: null, targetCardDeleteButtons: 1, globalDeleteButtons: 9,
});
assert.equal(card.layout, 'card');
assert.equal(card.equal, true);

const mixed = summarizeDeleteCountAudit({
  tableRows: 1, targetCards: 1, tableDeleteButtons: 1, targetCardDeleteButtons: 1, globalDeleteButtons: 2,
});
assert.equal(mixed.layout, 'mixed');
assert.equal(mixed.recordContainers, null);
assert.equal(mixed.deleteButtons, null);
assert.equal(mixed.equal, false, '表格/卡片混合命中不得任选一种布局假放行');

const absent = summarizeDeleteCountAudit({
  tableRows: 0, targetCards: 0, tableDeleteButtons: null, targetCardDeleteButtons: null, globalDeleteButtons: 0,
});
assert.equal(absent.layout, 'unknown');
assert.equal(absent.equal, false, '未知布局 0:0 不等于已证实的删除域 1:1');

assert.throws(
  () => buildArtifactManifest('tc_safe', { file: '../video.webm' }),
  /videoMeta\.file 须安全相对路径/,
  'manifest 导出面须就地拒绝穿越录像路径',
);
assert.equal(buildArtifactManifest('tc_safe', { file: 'video.webm' }).at(-1).file, 'video.webm');

const baseModel = {
  caseId: 'tc_safe', title: 'safe', channel: 'web', generatedAt: '2026-07-16T00:00:00.000Z',
  signedAgainstBuild: null, verdictSummary: { PASS: 0, SUT_DEFECT: 0, HARNESS_ERROR: 0, NEEDS_HUMAN: 0 },
  steps: [],
};
const hostile = 'https://example.invalid/video.webm';
const rendered = renderReport({
  ...baseModel,
  replayVideo: { file: hostile },
  artifacts: [{ kind: 'video', label: '录像', file: hostile }],
  visualReview: {
    status: 'INDETERMINATE', summary: '路径边界测试', reviewer: 'test', reviewedAt: '2026-07-16T00:00:00.000Z',
    verdictImpact: 'none', evidence: [{ file: hostile, videoAt: null, note: null }],
  },
});
assert.doesNotMatch(rendered.html, /https:\/\/example\.invalid/);
assert.doesNotMatch(rendered.markdown, /https:\/\/example\.invalid/);
assert.doesNotMatch(rendered.json, /https:\/\/example\.invalid/);
assert.match(rendered.html, /录像路径非法/);
assert.match(rendered.markdown, /录像路径非法/);
const renderedJson = JSON.parse(rendered.json);
assert.equal(renderedJson.replayVideo.file, null);
assert.equal(renderedJson.artifacts[0].file, null);
assert.equal(renderedJson.visualReview.evidence[0].file, null);

const hostileHref = renderReport({
  ...baseModel,
  steps: [{
    stepId: 's1', intentId: 'i1', atom: 'x', verdict: 'SUT_DEFECT', reason: 'SUT_ASSERT_FAIL_BACKED',
    postAssertions: [], observed: {}, attachments: { trace: 'javascript:alert(1)', stepPage: '../../step.html' },
    defectTicket: { failedAssertions: [], backingForensics: [], traceRef: 'javascript:alert(1)' },
  }],
});
assert.doesNotMatch(hostileHref.html, /href="javascript:|href="\.\.\//);
assert.match(hostileHref.html, /路径非法/);

const safeRendered = renderReport({ ...baseModel, replayVideo: { file: 'video.webm' } });
assert.match(safeRendered.html, /src="video\.webm"/);
assert.match(safeRendered.markdown, /\[video\.webm\]\(video\.webm\)/);

const scratch = mkdtempSync(join(tmpdir(), 'casey-p2-report-'));
try {
  const badPathDir = join(scratch, 'bad dir');
  mkdirSync(badPathDir);
  writeFileSync(join(badPathDir, 'case.report.json'), '{}\n');
  const badPath = spawnSync(process.execPath, [join(ROOT, 'bin', 'report.mjs'), '--aggregate', scratch], { encoding: 'utf8' });
  assert.equal(badPath.status, 1);
  assert.match(badPath.stderr, /旁车路径非法/);
  assert.doesNotMatch(badPath.stderr, /不是合法 JSON/);

  rmSync(badPathDir, { recursive: true, force: true });
  const badJsonDir = join(scratch, 'safe');
  mkdirSync(badJsonDir);
  writeFileSync(join(badJsonDir, 'case.report.json'), '{');
  const badJson = spawnSync(process.execPath, [join(ROOT, 'bin', 'report.mjs'), '--aggregate', scratch], { encoding: 'utf8' });
  assert.equal(badJson.status, 1);
  assert.match(badJson.stderr, /旁车不是合法 JSON/);
  assert.doesNotMatch(badJson.stderr, /旁车路径非法/);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

console.log('p0-p2-report-delete zero-SUT golden: PASS');
