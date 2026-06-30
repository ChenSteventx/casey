#!/usr/bin/env node
// tests/_golden/p5-replay-coverage.golden.mjs —— P5 回放器 fail-safe 行为的回归锁。
// 背景：codex 异构评审(gpt-5.5 非同族)判 FAIL、10 finding，修复引入了一批 fail-safe 不变量；
//   p5-replay.golden 跑的 10 案不覆盖这些「失败方向」（它走的是 happy/已冻八案）。本文件把修复钉死，
//   防回退到 fail-open。不重跑真回放——只锁两层确定性不变量：
//     (1) 断言轴 evaluateAssertions：证不出 / 未实现 kind 一律 ok:false（护栏 #14）。
//     (2) 动作轴 + 取证 → 已冻 verdict.mjs 四态：action_failed→INDETERMINATE、fallback_first→AMBIGUOUS、
//         归因按本步（背景/别步不背书本步、pageerror 按步不污染）（护栏 #14/#15）。
// 改本文件 = Test Ratchet 判红。
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { evaluateAssertions } from '../../lib/replay-assert.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const VERDICT = join(ROOT, 'bin', 'verdict.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'casey-p5cov-'));

const fails = [];
const ok = (name, cond) => { if (!cond) fails.push(name); };

// 合成单步 axes 喂已冻 verdict.mjs，返回 { verdict, reason }。
let n = 0;
function verdictOf(step) {
  const ax = join(tmp, `cov-${n}.axes.json`);
  const vd = join(tmp, `cov-${n}.verdict.json`);
  n++;
  writeFileSync(ax, JSON.stringify({ caseId: 'tc_cov', steps: [step] }));
  execFileSync(process.execPath, [VERDICT, '--axes', ax, '--out', vd], { stdio: 'pipe' });
  const v = JSON.parse(readFileSync(vd, 'utf8'));
  return v.steps[0];
}
const A1 = (kind, op, value) => [{ kind, op, value, soft: false }];

// ===== (1) 断言轴 fail-safe（finding 7）=====
ok('noErrorToast 未采集 → ok:false', evaluateAssertions(A1('noErrorToast', 'absent'), {})[0].ok === false);
ok('textVisible 未实现 → ok:false', evaluateAssertions(A1('textVisible', 'appears'), {})[0].ok === false);
ok('countChange up 计数 null → ok:false', evaluateAssertions(A1('countChange', 'up', 1), { countBefore: null, countAfter: null })[0].ok === false);
ok('countChange equals 计数 null → ok:false', evaluateAssertions(A1('countChange', 'equals', 0), { countAfter: null })[0].ok === false);
ok('countChange equals 真归零 → ok:true', evaluateAssertions(A1('countChange', 'equals', 0), { countBefore: 1, countAfter: 0 })[0].ok === true);
ok('noPageError 本 intent 有 pageerror → ok:false', evaluateAssertions(A1('noPageError', 'absent'), { pageErrors: [{ attributedStepId: 'atstep_1' }] })[0].ok === false);
ok('noPageError 本 intent 无 pageerror → ok:true', evaluateAssertions(A1('noPageError', 'absent'), { pageErrors: [] })[0].ok === true);
ok('noErrorEnvelope 无 save 记录 → ok:false', evaluateAssertions(A1('noErrorEnvelope', 'envelopeOk'), { netRecords: [] })[0].ok === false);

// ===== (2) 动作轴 + 取证 → verdict 四态（findings 1/2/3/4/5）=====
const hardFail = [{ kind: 'noErrorEnvelope', op: 'envelopeOk', ok: false, soft: false }];
const hardPass = [{ kind: 'noErrorEnvelope', op: 'envelopeOk', ok: true, soft: false }];
const emptyForensics = { network: [], lifecycle: { crashed: false, crashedAtStepId: null, pageerror: [] } };

// finding 3：唯一元素动作失败 → action_failed → ap=false、无 drift → INDETERMINATE（不再谎报 PASS）
let v = verdictOf({ stepId: 's1', intentId: 'i1', atom: 'x', action: { resolution: 'action_failed', identityReadback: { ok: false } }, postAssertions: hardPass, forensics: emptyForensics });
ok('action_failed → NEEDS_HUMAN/INDETERMINATE', v.verdict === 'NEEDS_HUMAN' && v.reason === 'INDETERMINATE');

// finding 2/6：多匹配 → fallback_first → AMBIGUOUS_ACTION（无论断言；且 runner 此分支不点击）
v = verdictOf({ stepId: 's1', intentId: 'i1', atom: 'x', action: { resolution: 'fallback_first', candidateCount: 2 }, postAssertions: hardPass, forensics: emptyForensics });
ok('fallback_first → NEEDS_HUMAN/AMBIGUOUS_ACTION', v.verdict === 'NEEDS_HUMAN' && v.reason === 'AMBIGUOUS_ACTION');

// finding 1/5：背景请求 attributedStepId=null → 不背书（即使 500）：硬断言失败 + 归因 null → 非 SUT_DEFECT
v = verdictOf({ stepId: 's1', intentId: 'i1', atom: 'x', action: { resolution: 'unique' }, postAssertions: hardFail, forensics: { network: [{ url: '/api/x/poll', status: 500, attributedStepId: null, errorEnvelope: { ok: false } }], lifecycle: emptyForensics.lifecycle } });
ok('归因 null 的 500 不背书 → SUT_DEFECT_OR_STALE', v.verdict === 'NEEDS_HUMAN' && v.reason === 'SUT_DEFECT_OR_STALE');

// finding 5：归因对齐本步的 500 → SUT_DEFECT（背书成立）
v = verdictOf({ stepId: 's1', intentId: 'i1', atom: 'x', action: { resolution: 'unique' }, postAssertions: hardFail, forensics: { network: [{ url: '/api/x/save', status: 500, attributedStepId: 's1', errorEnvelope: { ok: false } }], lifecycle: emptyForensics.lifecycle } });
ok('归因本步的 500 → SUT_DEFECT', v.verdict === 'SUT_DEFECT');

// finding 4：pageerror 归因本步 → SUT_DEFECT（lifecycle 背书）
v = verdictOf({ stepId: 's1', intentId: 'i1', atom: 'x', action: { resolution: 'unique' }, postAssertions: hardFail, forensics: { network: [], lifecycle: { crashed: false, crashedAtStepId: null, pageerror: [{ attributedStepId: 's1' }] } } });
ok('pageerror 归因本步 → SUT_DEFECT', v.verdict === 'SUT_DEFECT');

// finding 4：pageerror 归因别步 → 不污染本步（非全局布尔）→ 非 SUT_DEFECT
v = verdictOf({ stepId: 's1', intentId: 'i1', atom: 'x', action: { resolution: 'unique' }, postAssertions: hardFail, forensics: { network: [], lifecycle: { crashed: false, crashedAtStepId: null, pageerror: [{ attributedStepId: 's2' }] } } });
ok('pageerror 归因别步 → 不背书本步(SUT_DEFECT_OR_STALE)', v.verdict === 'NEEDS_HUMAN' && v.reason === 'SUT_DEFECT_OR_STALE');

if (fails.length) {
  for (const f of fails) console.error(`RED  p5-coverage: ${f}`);
  process.exit(1);
}
console.log('ok   p5-replay-coverage: fail-safe 不变量全过（断言证不出→false + action_failed/归因/pageerror 按步）');
process.exit(0);
