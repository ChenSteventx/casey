#!/usr/bin/env node
// 冻结黄金标准（S1 核心）：verdict.mjs 的 §4.2 判定树 —— 喂合成三轴(StepAxes 输入态)，逐 case 验四态。
// 契约钉死 bin/verdict.mjs 的 CLI：node bin/verdict.mjs --axes <in.json> --out <out.json>
//   in  = { caseId, steps: [ StepAxes ] }（StepAxes 输入态见 fixtures/p2/verdict-cases.json 的 input.steps）
//   out = { caseId, steps: [ { stepId, intentId, atom, verdict, reason } ] }
// verdict 零 LLM、纯确定性：据 action 原始信号(resolution/identityReadback/driftProbe)按点击身份门推 actionPerformed，
// soft 断言不进裁定树，取证按 attributedStepId 归因（非时间窗）。
// 实现前必须红（bin/verdict.mjs 不存在 → 本测试退非 0）。改本文件 = Test Ratchet 判红。
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const VERDICT = join(ROOT, 'bin', 'verdict.mjs');
const FIX = join(HERE, 'fixtures', 'p2', 'verdict-cases.json');

const fail = (msg) => { console.error(`RED  p2-verdict: ${msg}`); process.exit(1); };

const { cases } = JSON.parse(readFileSync(FIX, 'utf8'));
const tmp = mkdtempSync(join(tmpdir(), 'casey-verdict-'));
let n = 0;

for (const c of cases) {
  const inFile = join(tmp, `${c.name}.in.json`);
  const outFile = join(tmp, `${c.name}.out.json`);
  writeFileSync(inFile, JSON.stringify(c.input));
  try {
    execFileSync(process.execPath, [VERDICT, '--axes', inFile, '--out', outFile], { stdio: 'pipe' });
  } catch (e) {
    fail(`case「${c.name}」: verdict.mjs 执行失败（实现前预期红）：${String(e.stderr || e.message).slice(-300)}`);
  }
  let out;
  try { out = JSON.parse(readFileSync(outFile, 'utf8')); } catch { fail(`case「${c.name}」: 读不到/解析不了 verdict 产物 ${outFile}`); }
  const step = out.steps && out.steps[0];
  if (!step) fail(`case「${c.name}」: verdict.json 缺 steps[0]`);
  if (step.verdict !== c.expect.verdict) fail(`case「${c.name}」(${c.why}): 期望 verdict=${c.expect.verdict}，实际 ${step.verdict}`);
  if (c.expect.reason && step.reason !== c.expect.reason) fail(`case「${c.name}」: 期望 reason=${c.expect.reason}，实际 ${step.reason}`);
  if (step.stepId !== c.input.steps[0].stepId) fail(`case「${c.name}」: stepId 未卷回（期望 ${c.input.steps[0].stepId}，实际 ${step.stepId}）`);
  if (step.intentId !== c.input.steps[0].intentId) fail(`case「${c.name}」: intentId 未卷回（期望 ${c.input.steps[0].intentId}，实际 ${step.intentId}）`);
  n++;
}
console.log(`ok   p2-verdict: ${n}/${cases.length} 四态 case 全中`);
process.exit(0);
