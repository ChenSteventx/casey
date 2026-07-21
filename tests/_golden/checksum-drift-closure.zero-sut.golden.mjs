#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildArtifactManifest, projectVisualReview } from '../../lib/report-model.mjs';
import { performWorkflowDeleteTrigger } from '../../lib/workflow-delete-domain.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const schemaPath = join(ROOT, 'tests', '_golden', 'schemas', 'report-model.schema.json');
const deleteSourcePath = join(ROOT, 'lib', 'workflow-delete-domain.mjs');
const deleteGoldenPath = join(ROOT, 'tests', '_golden', 'workflow-delete-causal-binding.static.golden.mjs');
const selfPath = fileURLToPath(import.meta.url);

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

function exactSet(actual, expected, label) {
  assert.deepEqual([...actual].sort(), [...expected].sort(), label);
}

function assertReportExtensions(schema) {
  const top = schema.properties || {};
  const required = schema.required || [];
  assert.ok(!required.includes('artifacts'), 'artifacts 必须是顶层可选字段');
  assert.ok(!required.includes('visualReview'), 'visualReview 必须是顶层可选字段');

  const artifacts = top.artifacts;
  assert.equal(artifacts?.type, 'array');
  assert.equal(artifacts?.items?.type, 'object');
  assert.equal(artifacts?.items?.additionalProperties, false);
  exactSet(artifacts?.items?.required || [], ['kind', 'file', 'label'], 'artifacts item 必填集漂移');
  exactSet(Object.keys(artifacts?.items?.properties || {}), ['kind', 'file', 'label'], 'artifacts item 字段集漂移');
  for (const key of ['kind', 'file', 'label']) assert.equal(artifacts.items.properties[key].type, 'string');

  const visual = top.visualReview;
  assert.deepEqual(visual?.type, ['object', 'null']);
  assert.equal(visual?.additionalProperties, false);
  exactSet(
    visual?.required || [],
    ['status', 'reviewer', 'reviewedAt', 'summary', 'verdictImpact', 'evidence'],
    'visualReview 必填集漂移',
  );
  exactSet(
    Object.keys(visual?.properties || {}),
    ['status', 'reviewer', 'reviewedAt', 'summary', 'verdictImpact', 'evidence'],
    'visualReview 字段集漂移',
  );
  exactSet(
    visual.properties.status.enum || [],
    ['CONSISTENT', 'INCONSISTENT', 'INDETERMINATE'],
    'visualReview.status 三态漂移',
  );
  assert.equal(visual.properties.verdictImpact.const, 'none');
  assert.equal(visual.properties.evidence.type, 'array');
  const evidence = visual.properties.evidence.items;
  assert.equal(evidence?.type, 'object');
  assert.equal(evidence?.additionalProperties, false);
  exactSet(evidence?.required || [], ['file', 'videoAt', 'note'], 'visualReview.evidence 必填集漂移');
  exactSet(Object.keys(evidence?.properties || {}), ['file', 'videoAt', 'note'], 'visualReview.evidence 字段集漂移');
  assert.equal(evidence.properties.videoAt.minimum, 0);
}

const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
const deleteSource = readFileSync(deleteSourcePath, 'utf8');
const deleteGolden = readFileSync(deleteGoldenPath, 'utf8');

await check('C1 报告 schema 冻结 artifacts 与 visualReview 闭合形态', () => {
  assertReportExtensions(schema);
});

await check('C1 schema 负控能逮必填集、裁定影响与闭合属性放宽', () => {
  const missingRequired = structuredClone(schema);
  missingRequired.properties.visualReview.required = missingRequired.properties.visualReview.required.filter((x) => x !== 'verdictImpact');
  assert.throws(() => assertReportExtensions(missingRequired));

  const verdictOverride = structuredClone(schema);
  verdictOverride.properties.visualReview.properties.verdictImpact.const = 'override';
  assert.throws(() => assertReportExtensions(verdictOverride));

  const openArtifacts = structuredClone(schema);
  openArtifacts.properties.artifacts.items.additionalProperties = true;
  assert.throws(() => assertReportExtensions(openArtifacts));
});

await check('C1 生产纯函数投影满足冻结形态且拒绝覆盖裁定', () => {
  const review = projectVisualReview({
    status: 'CONSISTENT',
    reviewer: 'independent-reviewer',
    reviewedAt: '2026-07-21T00:00:00.000Z',
    summary: '视觉证据与确定性输出一致。',
    verdictImpact: 'none',
    evidence: [{ file: 'frame-001.png', videoAt: 1.25, note: null }],
  });
  exactSet(Object.keys(review), ['status', 'reviewer', 'reviewedAt', 'summary', 'verdictImpact', 'evidence'], '生产 visualReview 投影字段漂移');
  assert.equal(review.verdictImpact, 'none');
  exactSet(Object.keys(review.evidence[0]), ['file', 'videoAt', 'note'], '生产 visualReview evidence 字段漂移');
  assert.throws(() => projectVisualReview({ ...review, verdictImpact: 'override' }), /verdictImpact/);

  const artifacts = buildArtifactManifest('tc_checksum_drift', { file: 'run.webm' }, review);
  assert.ok(artifacts.some((item) => item.kind === 'visualReview' && item.file === 'visual-review.json'));
  assert.ok(artifacts.some((item) => item.kind === 'video' && item.file === 'run.webm'));
  for (const item of artifacts) exactSet(Object.keys(item), ['kind', 'file', 'label'], '生产 artifacts item 字段漂移');
});

await check('C2 删除弹层选择器只接受目标 class token 边界', () => {
  for (const token of [
    '[class*="message-box "]',
    '[class$="message-box"]',
    '[class*="popconfirm "]',
    '[class$="popconfirm"]',
  ]) assert.ok(deleteSource.includes(token), `缺选择器 ${token}`);
  assert.ok(!deleteSource.includes("'[class*=\"message-box\"]'"));
  assert.ok(!deleteSource.includes("'[class*=\"popconfirm\"]'"));
});

await check('C2 空 expectedName 零页面读取并 fail-closed', async () => {
  let pageTouched = false;
  const page = new Proxy({}, {
    get() {
      pageTouched = true;
      throw new Error('空 expectedName 不得读取页面');
    },
  });
  const result = await performWorkflowDeleteTrigger(page, '   ');
  assert.equal(pageTouched, false);
  assert.equal(result.resolution, 'action_failed');
  assert.equal(result.candidateCount, 0);
  assert.equal(result.identityReadback?.ok, false);
});

await check('C3 验收闭包保持零 SUT 且现役静态金牌钉住同一语义', () => {
  assert.equal(/^import\s/m.test(deleteSource), false, '删除域模块不得引入顶层依赖副作用');
  const selfSource = readFileSync(selfPath, 'utf8');
  const moduleSpecifiers = [...selfSource.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
  exactSet(moduleSpecifiers, [
    'node:assert/strict',
    'node:fs',
    'node:path',
    'node:url',
    '../../lib/report-model.mjs',
    '../../lib/workflow-delete-domain.mjs',
  ], '新增验收导入闭包漂移');
  assert.equal(/\bimport\s*\(/.test(selfSource), false, '新增验收不得动态导入未审计依赖');
  assert.equal(/node:child_process|from ['"]playwright|node:https?|node:net|\.listen\s*\(|spawnSync|execSync/.test(deleteGolden), false);
  assert.ok(deleteGolden.includes('C0 弹层选择器覆盖多 class 根标记'));
  assert.ok(deleteGolden.includes('C0 删除触发缺少显式 expectedName 时不读页面并 fail-closed'));
});

console.log(`\n${passed}/${passed} checks passed`);
