#!/usr/bin/env node
// 冻结黄金标准（track-F 回归锁）：bin/verdict.mjs 的 fail-safe 覆盖缺口 —— 真异构评审(codex gpt-5.5)
// 引出的 C1/C2 归因边界 + B1/B2/B3 新 fail-safe 行为。自包含：cases 内联、合成三轴(StepAxes 输入态)，
// 逐 case spawn `node bin/verdict.mjs --axes <in> --out <out>` 验四态 / 退出码。零外部依赖。
//
// 钉死行为（改 verdict.mjs 回退任一即红）：
//   C1 归因辨别：动作做成 + 硬断言失败 + 5xx 归因到「别步」→ NEEDS_HUMAN(SUT_DEFECT_OR_STALE)，非 SUT_DEFECT。
//   C2 取证背书边界：crash 归因本步 → SUT_DEFECT；pageerror 归因别步 → 不背书；缺 stepId → 不背书。
//   B1 非布尔 soft 不静默降级：失败硬断言 soft 设成非布尔 truthy(如 1) → 仍当硬断言、verdict ≠ PASS。
//   B2 漂移正向证据：无 resolution==='none' 但有 driftProbe → INDETERMINATE(非 HARNESS_ERROR)；
//      有 resolution==='none' + 探针 → HARNESS_ERROR。
//   B3 入参 fail-closed：steps 非数组 → exit 65；steps 空数组 → exit 65。
// 改本文件 = Test Ratchet 判红。
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const VERDICT = join(ROOT, 'bin', 'verdict.mjs');
const fail = (m) => { console.error(`RED  p2-verdict-coverage: ${m}`); process.exit(1); };

// 一步合成 StepAxes 工厂：默认动作做成(resolution=unique)、一条失败的硬断言、取证干净。
const baseStep = (over = {}) => ({
  stepId: 'atstep_0', intentId: 'intent_0', atom: 'workflow.save',
  action: { kind: 'click', resolution: 'unique', identityReadback: null, driftProbe: null },
  postAssertions: [{ kind: 'urlPathname', op: 'startsWith', value: '/a', actual: '/b', ok: false, soft: false }],
  forensics: { lifecycle: { pageerror: [], crashed: false }, network: [] },
  ...over,
});

const cases = [
  {
    name: 'C1_attributed_to_other_step',
    why: '动作做成 + 硬断言失败 + 5xx 归因到别步 → SUT_DEFECT_OR_STALE(非 SUT_DEFECT)',
    input: { caseId: 'tc', steps: [baseStep({
      stepId: 'atstep_1',
      forensics: { lifecycle: { pageerror: [], crashed: false }, network: [
        { url: '/x', status: 500, initiator: 'background', attributedStepId: 'atstep_0',
          errorEnvelope: { field: 'status', expected: 200, actual: 500, ok: false } },
      ] },
    })] },
    expect: { verdict: 'NEEDS_HUMAN', reason: 'SUT_DEFECT_OR_STALE' },
  },
  {
    name: 'C2_crash_this_step_backs_sut',
    why: 'crash 归因本步 → SUT_DEFECT（取证背书终判）',
    input: { caseId: 'tc', steps: [baseStep({
      forensics: { lifecycle: { pageerror: [], crashed: true, crashedAtStepId: 'atstep_0' }, network: [] },
    })] },
    expect: { verdict: 'SUT_DEFECT', reason: null },
  },
  {
    name: 'C2_pageerror_other_step_no_backing',
    why: 'pageerror 归因别步 → 不背书 → SUT_DEFECT_OR_STALE',
    input: { caseId: 'tc', steps: [baseStep({
      stepId: 'atstep_1',
      forensics: { lifecycle: { pageerror: [{ attributedStepId: 'atstep_0', message: 'boom' }], crashed: false }, network: [] },
    })] },
    expect: { verdict: 'NEEDS_HUMAN', reason: 'SUT_DEFECT_OR_STALE' },
  },
  {
    name: 'C2_missing_stepId_no_backing',
    why: '缺 stepId → 取证不背书（防 undefined===undefined 假命中）→ SUT_DEFECT_OR_STALE',
    input: { caseId: 'tc', steps: [(() => { const s = baseStep(); delete s.stepId; s.forensics = { lifecycle: { pageerror: [], crashed: false }, network: [
      { url: '/x', status: 500, initiator: 'self', attributedStepId: 'atstep_0',
        errorEnvelope: { field: 'status', expected: 200, actual: 500, ok: false } },
    ] }; return s; })()] },
    expect: { verdict: 'NEEDS_HUMAN', reason: 'SUT_DEFECT_OR_STALE' },
  },
  {
    name: 'B1_nonbool_truthy_soft_not_downgraded',
    why: '失败硬断言 soft=非布尔 truthy(1) → 仍当硬断言 → verdict ≠ PASS',
    input: { caseId: 'tc', steps: [baseStep({
      postAssertions: [{ kind: 'urlPathname', op: 'startsWith', value: '/a', actual: '/b', ok: false, soft: 1 }],
    })] },
    expect: { verdict: 'NEEDS_HUMAN', reason: 'SUT_DEFECT_OR_STALE', notVerdict: 'PASS' },
  },
  {
    name: 'B2_drift_probe_without_miss_evidence',
    why: '无 resolution===none 但有 driftProbe 命中 → INDETERMINATE(非 HARNESS_ERROR)',
    input: { caseId: 'tc', steps: [baseStep({
      action: { kind: 'click', resolution: 'missing', identityReadback: { ok: false }, driftProbe: { sameSignatureUniquePresent: true } },
    })] },
    expect: { verdict: 'NEEDS_HUMAN', reason: 'INDETERMINATE', notVerdict: 'HARNESS_ERROR' },
  },
  {
    name: 'B2_drift_with_miss_evidence',
    why: 'resolution===none 正向 miss 证据 + 探针命中 → HARNESS_ERROR(可自愈)',
    input: { caseId: 'tc', steps: [baseStep({
      action: { kind: 'click', resolution: 'none', identityReadback: { ok: false }, driftProbe: { sameSignatureUniquePresent: true } },
    })] },
    expect: { verdict: 'HARNESS_ERROR', reason: null },
  },
  {
    name: 'B3_steps_not_array',
    why: 'steps 非数组 → 坏数据 fail-closed exit 65',
    input: { caseId: 'tc', steps: { not: 'an array' } },
    expectExit: 65,
  },
  {
    name: 'B3_steps_empty_array',
    why: 'steps 空数组 → 坏数据 fail-closed exit 65',
    input: { caseId: 'tc', steps: [] },
    expectExit: 65,
  },
];

const tmp = mkdtempSync(join(tmpdir(), 'casey-verdict-cov-'));
let n = 0;
for (const c of cases) {
  const inFile = join(tmp, `${c.name}.in.json`);
  const outFile = join(tmp, `${c.name}.out.json`);
  writeFileSync(inFile, JSON.stringify(c.input));
  let threw = null;
  try {
    execFileSync(process.execPath, [VERDICT, '--axes', inFile, '--out', outFile], { stdio: 'pipe' });
  } catch (e) { threw = e; }

  if (c.expectExit !== undefined) {
    if (!threw) fail(`case「${c.name}」(${c.why}): 期望 exit ${c.expectExit} 却成功退出`);
    if (threw.status !== c.expectExit) fail(`case「${c.name}」: 期望 exit ${c.expectExit}，实际 ${threw.status}`);
    n++;
    continue;
  }

  if (threw) fail(`case「${c.name}」(${c.why}): verdict.mjs 意外失败：${String(threw.stderr || threw.message).slice(-300)}`);
  let out;
  try { out = JSON.parse(readFileSync(outFile, 'utf8')); } catch { fail(`case「${c.name}」: 读不到/解析不了 verdict 产物`); }
  const step = out.steps && out.steps[0];
  if (!step) fail(`case「${c.name}」: verdict.json 缺 steps[0]`);
  if (step.verdict !== c.expect.verdict) fail(`case「${c.name}」(${c.why}): 期望 verdict=${c.expect.verdict}，实际 ${step.verdict}`);
  if (c.expect.notVerdict && step.verdict === c.expect.notVerdict) fail(`case「${c.name}」: verdict 不应是 ${c.expect.notVerdict}（静默降级/误判）`);
  if (c.expect.reason !== undefined && step.reason !== c.expect.reason) fail(`case「${c.name}」: 期望 reason=${c.expect.reason}，实际 ${step.reason}`);
  n++;
}
console.log(`ok   p2-verdict-coverage: ${n}/${cases.length} fail-safe 覆盖 case 全中`);
process.exit(0);
