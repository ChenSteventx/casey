#!/usr/bin/env node
// CASE_DEFECT 冻结扩充：只用合成 StepAxes 调零 LLM verdict，不启动/连接任何 SUT 或浏览器。
// 改本文件 = Test Ratchet 判红。
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const VERDICT = join(ROOT, 'bin', 'verdict.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'casey-case-defect-'));

const input = {
  caseId: 'tc_case_defect_synth',
  steps: [{
    stepId: 'atstep_0', intentId: 'intent_0', atom: 'workflow.open', phase: 'compile',
    action: { kind: 'click', resolution: 'none', identityReadback: { ok: false }, driftProbe: null, affordanceAbsent: true },
    postAssertions: [{ kind: 'textVisible', op: 'appears', value: '目标入口', actual: 0, ok: false, soft: false }],
    forensics: { lifecycle: { pageerror: [], crashed: false, crashedAtStepId: null }, network: [] },
  }],
};
const axes = join(tmp, 'axes.json');
const out = join(tmp, 'verdict.json');
writeFileSync(axes, JSON.stringify(input));
execFileSync(process.execPath, [VERDICT, '--axes', axes, '--out', out], { stdio: 'pipe' });
const step = JSON.parse(readFileSync(out, 'utf8')).steps?.[0];
if (step?.verdict !== 'NEEDS_HUMAN' || step?.reason !== 'CASE_DEFECT') {
  console.error(`RED  p2-case-defect: 编译期入口可证缺席应 NEEDS_HUMAN/CASE_DEFECT，实际 ${step?.verdict}/${step?.reason}`);
  process.exit(1);
}
if (step.stepId !== 'atstep_0' || step.intentId !== 'intent_0') {
  console.error('RED  p2-case-defect: verdict 未卷回合成 StepAxes 的 stepId/intentId');
  process.exit(1);
}

console.log('ok   p2-case-defect: 合成 axes 钉住 compile + affordanceAbsent:true → NEEDS_HUMAN/CASE_DEFECT');
