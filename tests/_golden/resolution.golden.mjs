#!/usr/bin/env node
// tests/_golden/resolution.golden.mjs —— resolution 词表统一（多匹配收敛到 ambiguous）的红先行金牌。
// 背景：三门 emitters 曾对「多匹配（点没点对存疑）」各说各话——编译门 multi / 回放通用门 fallback_first /
//   openNode 门 ambiguous；裁判 verdict.mjs 只认 fallback_first/coord_fallback、不认 ambiguous——于是 openNode
//   说的 ambiguous 落 return false → fail-safe 兜底、reason 泛化成 INDETERMINATE，CONTEXT 已登记的精确词
//   AMBIGUOUS_ACTION 反被裁判丢弃；coord_fallback 在识别端是无门吐的死枝。本契约把裁判链（点击身份门 →
//   动作轴 resolution → verdict.mjs）上的多匹配字面量收敛到 CONTEXT 登记词 ambiguous、让裁判与 report-model
//   认它、删裁判识别端的幽灵 coord_fallback。
// 最危险红线（fail-safe 不破）：多匹配恒 NEEDS_HUMAN/AMBIGUOUS_ACTION——绝不因收敛翻成 PASS 或 SUT_DEFECT。
//   decide() 的 ap==='ambiguous' 短路（verdict.mjs :79）先于 ap===true 的 PASS 支与 backed→SUT_DEFECT 支；
//   本契约只改「谁被认成 ap ambiguous」、不动短路顺序。A2/A3/A4 三向钉死。
// 双镜像：verdict.mjs（源真理）⋈ report-model.mjs expectedVerdict（只读复算镜像）——经 assembleReportModel
//   的 verdict⋈axes 一致性门同判（护栏 #14/#15）；改识别端只改一处 = 一致性门 fail-closed 抛。A5 看门狗。
// 收敛完备：源码级断言 emitters 不再吐 'multi'/'fallback_first' 作动作轴值、识别端无 coord_fallback/'fallback_first'。
// 不 rig：注入的是「门已解析的 resolution 字面量」喂真 verdict.mjs 子进程（复现 p5-replay-coverage verdictOf 先例），
//   非倒着裁定；fail-safe 复现 decide() 短路顺序的既有接缝、不手写假裁定蒙混。
// 改本文件 = Test Ratchet 判红。
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { assembleReportModel } from '../../lib/report-model.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const VERDICT = join(ROOT, 'bin', 'verdict.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'casey-resolution-'));

const fails = [];
const ok = (name, cond) => { if (!cond) fails.push(name); };

// 合成单步 axes 喂真 verdict.mjs 子进程，返回 { verdict, reason }（零 LLM、复现真裁判接缝）。
let n = 0;
function verdictOf(step) {
  const ax = join(tmp, `res-${n}.axes.json`);
  const vd = join(tmp, `res-${n}.verdict.json`);
  n++;
  writeFileSync(ax, JSON.stringify({ caseId: 'tc_res', steps: [step] }));
  execFileSync(process.execPath, [VERDICT, '--axes', ax, '--out', vd], { stdio: 'pipe' });
  return JSON.parse(readFileSync(vd, 'utf8')).steps[0];
}

const emptyForensics = { network: [], lifecycle: { crashed: false, crashedAtStepId: null, pageerror: [] } };
const hardPass = [{ kind: 'noErrorEnvelope', op: 'envelopeOk', ok: true, soft: false }];
const hardFail = [{ kind: 'noErrorEnvelope', op: 'envelopeOk', ok: false, soft: false }];
const back5xx = (stepId) => ({ network: [{ url: '/api/x/save', status: 500, attributedStepId: stepId, errorEnvelope: { ok: false } }], lifecycle: { crashed: false, crashedAtStepId: null, pageerror: [] } });

// 合成 StepAxes：默认 stepId=s1（背书归因锚），多匹配态注入门已解析的 resolution:'ambiguous'（openNode/收敛后三门同词）。
const step = (over = {}) => ({ stepId: 's1', intentId: 'i1', atom: 'x', action: { resolution: 'ambiguous', candidateCount: 2, identityReadback: { ok: false } }, postAssertions: [], forensics: emptyForensics, ...over });

// ── A1 根因回归：ambiguous → AMBIGUOUS_ACTION ──
// 收敛前 verdict.mjs 识别端不认 resolution==='ambiguous' → 落 return false → fail-safe INDETERMINATE（红基线）；
// 收敛后识别端认它 → 提精到 AMBIGUOUS_ACTION（doOpenNode 说的词终于被裁判听见）。
let v = verdictOf(step({ postAssertions: [] }));
ok('A1 ambiguous → NEEDS_HUMAN/AMBIGUOUS_ACTION（根因回归）', v.verdict === 'NEEDS_HUMAN' && v.reason === 'AMBIGUOUS_ACTION');

// ── A2 fail-safe 不破 · 多匹配 + 全过硬断言 ≠ PASS（最危险红线）──
// 证 ap==='ambiguous' 短路先于 ap===true 的 hard.every(ok)→PASS——点没点对存疑时断言全过也不许判 PASS。
v = verdictOf(step({ postAssertions: [hardPass[0], { kind: 'urlPathname', op: 'startsWith', value: '/ok', actual: '/ok', ok: true, soft: false }] }));
ok('A2 ambiguous + 全过硬断言 仍 AMBIGUOUS_ACTION、绝不 PASS', v.verdict === 'NEEDS_HUMAN' && v.reason === 'AMBIGUOUS_ACTION' && v.verdict !== 'PASS');

// ── A3 fail-safe 不破 · 多匹配 + 本步 5xx 背书 ≠ SUT_DEFECT ──
// 证歧义短路先于 backed→SUT_DEFECT——点没点对都存疑，5xx 也不足以坐实 SUT 缺陷。
v = verdictOf(step({ postAssertions: hardFail, forensics: back5xx('s1') }));
ok('A3 ambiguous + 本步 5xx 背书 仍 AMBIGUOUS_ACTION、绝不 SUT_DEFECT', v.verdict === 'NEEDS_HUMAN' && v.reason === 'AMBIGUOUS_ACTION' && v.verdict !== 'SUT_DEFECT');

// ── A4 fail-safe 不破 · 多匹配 + 无硬断言仍 AMBIGUOUS_ACTION（非 ap===true 无断言那条 INDETERMINATE）──
// 歧义比「无断言可判」更早短路：区分 ambiguous(:79) 与 ap===true && hard.length===0(:83) 两条都 NEEDS_HUMAN 但 reason 不同。
v = verdictOf(step({ postAssertions: [] }));
ok('A4 ambiguous + 无硬断言 = AMBIGUOUS_ACTION（歧义比无断言更早短路）', v.verdict === 'NEEDS_HUMAN' && v.reason === 'AMBIGUOUS_ACTION');

// ── A5 双镜像同判：verdict.mjs 源真理 ⋈ report-model.mjs expectedVerdict（一致性门放行）──
// 喂 verdict.mjs 实产的 {verdict,reason} + 同一 axes 给 assembleReportModel 的 verdict⋈axes 一致性门；
// report-model 镜像复算不一致即 fail-closed 抛（护栏 #14/#15）——只改识别端一处会被这条断言当场逮住。
function mirrorAgrees(axStep) {
  const vs = verdictOf(axStep);
  try {
    assembleReportModel({
      caseId: 'tc_res', channel: 'web',
      verdict: { caseId: 'tc_res', steps: [{ stepId: axStep.stepId, intentId: axStep.intentId, atom: axStep.atom, verdict: vs.verdict, reason: vs.reason }] },
      axes: { caseId: 'tc_res', steps: [axStep] },
      meta: { generatedAt: '2026-07-09T00:00:00.000Z' },
    });
    return true;
  } catch { return false; }
}
ok('A5a 双镜像同判 · ambiguous 无断言（verdict.mjs ⋈ report-model 一致性门放行）', mirrorAgrees(step({ postAssertions: [] })));
ok('A5b 双镜像同判 · ambiguous + 5xx 背书（歧义短路两镜像同判）', mirrorAgrees(step({ postAssertions: hardFail, forensics: back5xx('s1') })));

// ── A6 收敛完备（源码级）：emitters 不再吐旧字面量、识别端无幽灵 ──
// 只扫「作 resolution 值的带引号字面量」——注释/日志里的历史提及不带引号，不误伤（GOLDEN-TESTPLAN A6）。
const compileSrc = readFileSync(join(ROOT, 'lib', 'compile-atoms.mjs'), 'utf8');
const replaySrc = readFileSync(join(ROOT, 'lib', 'replay-actions.mjs'), 'utf8');
const verdictSrc = readFileSync(VERDICT, 'utf8');
const modelSrc = readFileSync(join(ROOT, 'lib', 'report-model.mjs'), 'utf8');
ok('A6a compile-atoms 多匹配分支不再吐 "multi"（收敛到 ambiguous）', !/['"]multi['"]/.test(compileSrc));
ok('A6b replay-actions 通用门不再吐 "fallback_first"（收敛到 ambiguous）', !/['"]fallback_first['"]/.test(replaySrc));
ok('A6c verdict.mjs 识别端删幽灵：无 "coord_fallback" / 无 "fallback_first" 作比较字面量（只认 ambiguous）', !/['"]coord_fallback['"]/.test(verdictSrc) && !/['"]fallback_first['"]/.test(verdictSrc));
ok('A6d report-model.mjs 镜像识别端同删：无 "coord_fallback" / 无 "fallback_first" 作比较字面量', !/['"]coord_fallback['"]/.test(modelSrc) && !/['"]fallback_first['"]/.test(modelSrc));

// ── A7 非多匹配态零回归（本契约只碰多匹配识别，其余分支一字未动）──
ok('A7a unique + 全过硬断言 → PASS', (v = verdictOf(step({ action: { resolution: 'unique' }, postAssertions: hardPass }))).verdict === 'PASS');
ok('A7b unique + 失败硬断言 + 本步 5xx → SUT_DEFECT', (v = verdictOf(step({ action: { resolution: 'unique' }, postAssertions: hardFail, forensics: back5xx('s1') }))).verdict === 'SUT_DEFECT');
ok('A7c none + 漂移探针命中 → HARNESS_ERROR', (v = verdictOf(step({ action: { resolution: 'none', driftProbe: { sameSignatureUniquePresent: true } }, postAssertions: [] }))).verdict === 'HARNESS_ERROR');
ok('A7d none + 无探针 → NEEDS_HUMAN/INDETERMINATE', (v = verdictOf(step({ action: { resolution: 'none' }, postAssertions: [] }))).verdict === 'NEEDS_HUMAN' && v.reason === 'INDETERMINATE');
ok('A7e action_failed → NEEDS_HUMAN/INDETERMINATE', (v = verdictOf(step({ action: { resolution: 'action_failed', identityReadback: { ok: false } }, postAssertions: [] }))).verdict === 'NEEDS_HUMAN' && v.reason === 'INDETERMINATE');

if (fails.length) {
  for (const f of fails) console.error(`RED  resolution: ${f}`);
  process.exit(1);
}
console.log('ok   resolution: 多匹配收敛 ambiguous 全过（根因 AMBIGUOUS_ACTION + fail-safe 三向不破 + 双镜像同判 + 收敛完备 + 非多匹配零回归）');
process.exit(0);
