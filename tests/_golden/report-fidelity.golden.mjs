#!/usr/bin/env node
// 冻结黄金标准（report-fidelity · hermetic）：报告保真度三修——路径保真 / actual 回填 / --expected 签署投影。
// 决策依 docs/plans/report-fidelity/proposed/GRILL.md（G1–G3 机械决策，Steven「开工」授权）；实证源 = 首份真机报告体检。
// 实现前必红：F1a 纯路径整段 [redacted]（OPAQUE_BLOB 误伤）/ F2a actual 未回填 / F3a --expected 未接。
// 改本文件 = Test Ratchet 判红。
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { assembleReportModel } from '../../lib/report-model.mjs';
import { evaluateAssertions } from '../../lib/replay-assert.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const RM = join(ROOT, 'bin', 'report-model.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'casey-repfid-'));
const GEN = '2026-07-02T00:00:00.000Z';

const fails = [];
let pass = 0;
function check(name, fn) {
  try { fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-300)}`); }
}

// 冻结形状最小复现（同 layer3-wiring-coverage 范式）。
function axStep(over = {}) {
  return {
    stepId: 'atstep_0', intentId: 'intent_0', atom: 'workflow.save',
    action: { resolution: 'unique' },
    postAssertions: [{ kind: 'urlPathname', op: 'startsWith', value: '/ok', actual: '/ok', ok: true, soft: false }],
    forensics: { lifecycle: { pageerror: [], crashed: false, crashedAtStepId: null }, network: [] },
    ...over,
  };
}
function vStep(over = {}) {
  return { stepId: 'atstep_0', intentId: 'intent_0', atom: 'workflow.save', verdict: 'PASS', reason: null, ...over };
}
function call(vSteps, aSteps, extra = {}) {
  return assembleReportModel({
    caseId: 'tc_fid', channel: 'web',
    verdict: { caseId: 'tc_fid', steps: vSteps },
    axes: { caseId: 'tc_fid', steps: aSteps },
    observed: null, events: null, meta: { generatedAt: GEN }, ...extra,
  });
}
const paWith = (value, actual) => axStep({ postAssertions: [{ kind: 'urlPathname', op: 'startsWith', value, actual, ok: true, soft: false }] });

// ---------- F1 路径保真三向（G2：纯路径转逐段脱敏，凭据方向零放松） ----------
const LONGPATH = '/heren/aimanagement/process/list'; // 34 字符纯路径——OPAQUE_BLOB 误伤靶
check('F1a 纯路径期望值保可读（32+ 字符不再整段 redacted）', () => {
  const pa = call([vStep()], [paWith(LONGPATH, LONGPATH)]).steps[0].postAssertions[0];
  if (pa.value !== LONGPATH) throw new Error(`期望值失真：${pa.value}`);
  if (pa.actual !== LONGPATH) throw new Error(`实际值失真：${pa.actual}`);
});
check('F1b 凭据形态仍拦（token=/长串带 = 不走路径旁路）', () => {
  const pa = call([vStep()], [paWith('/ok', 'token=SECRET123&x=1')]).steps[0].postAssertions[0];
  if (/SECRET123|token=/.test(String(pa.actual))) throw new Error(`凭据形态泄漏：${pa.actual}`);
});
check('F1c 路径内长串段仍逐段拦（守卫不塌）', () => {
  const blobPath = '/x/' + 'A'.repeat(40) + '/y';
  const pa = call([vStep()], [paWith(blobPath, blobPath)]).steps[0].postAssertions[0];
  if (String(pa.value).includes('A'.repeat(40))) throw new Error(`路径内长串段未拦：${pa.value}`);
  if (!String(pa.value).includes('[redacted]')) throw new Error('长串段应替 [redacted]');
  if (!String(pa.value).startsWith('/x/')) throw new Error('非敏感段应保留');
});

// ---------- F2 actual 回填（G3 口径；未实现 kind 恒 null 不硬凑） ----------
check('F2a urlPathname 回填实测 pathname', () => {
  const ea = evaluateAssertions([{ kind: 'urlPathname', op: 'startsWith', value: '/ok' }], { urlPath: '/ok/sub' })[0];
  if (ea.actual !== '/ok/sub') throw new Error(`actual 应 /ok/sub，实际 ${JSON.stringify(ea.actual)}`);
  if (ea.ok !== true) throw new Error('ok 判定不得受回填影响');
});
check('F2b 未实现 kind actual 恒 null', () => {
  const ea = evaluateAssertions([{ kind: 'textVisible', op: 'appears', value: 'x' }], {})[0];
  if (ea.actual !== null) throw new Error(`未实现 kind actual 应 null，实际 ${JSON.stringify(ea.actual)}`);
  if (ea.ok !== false) throw new Error('未实现 kind 仍须 ok:false（fail-safe 不变）');
});
check('F2c noErrorEnvelope 回填归因坏信封计数', () => {
  const bad = evaluateAssertions([{ kind: 'noErrorEnvelope', op: 'envelopeOk' }], { netRecords: [{ url: '/api/x', errorEnvelope: { ok: false } }] })[0];
  if (bad.actual !== 1 || bad.ok !== false) throw new Error(`坏信封计数应 1/ok:false，实际 ${bad.actual}/${bad.ok}`);
  const none = evaluateAssertions([{ kind: 'noErrorEnvelope', op: 'envelopeOk' }], { netRecords: [] })[0];
  if (none.actual !== 0 || none.ok !== true) throw new Error(`零坏信封应 0/ok:true，实际 ${none.actual}/${none.ok}`);
});
check('F2d noPageError 回填归因计数 / countChange 回填 before→after', () => {
  const pe = evaluateAssertions([{ kind: 'noPageError', op: 'absent' }], { pageErrors: [{ attributedStepId: 'atstep_0' }] })[0];
  if (pe.actual !== 1 || pe.ok !== false) throw new Error(`pageerror 计数应 1/false，实际 ${pe.actual}/${pe.ok}`);
  const cc = evaluateAssertions([{ kind: 'countChange', op: 'up', value: 2 }], { countBefore: 1, countAfter: 3 })[0];
  if (cc.actual !== '1→3' || cc.ok !== true) throw new Error(`countChange actual 应 1→3/true，实际 ${cc.actual}/${cc.ok}`);
});

// ---------- F3 --expected 签署投影三向（G1：全签且均一才投影，fail-closed 不粉饰） ----------
const W = (name, obj) => { const f = join(tmp, name); writeFileSync(f, JSON.stringify(obj)); return f; };
const VERDICT_F = W('verdict.json', { caseId: 'tc_fid', steps: [vStep()] });
const AXES_F = W('axes.json', { caseId: 'tc_fid', steps: [axStep()] });
const SIGN = { signedAt: '2026-07-02T00:00:00.000Z', signedAgainstBuild: '1.1.2', signerId: 'Steven' };
const expDoc = (assertions) => ({ caseId: 'tc_fid', channel: 'web', intents: [{ intentId: 'intent_0', expected: assertions }], globalAssertions: [] });
function runRM(expFile, extraArgs = []) {
  const out = join(tmp, `m-${Math.random().toString(36).slice(2)}.json`);
  const r = spawnSync(process.execPath, [RM, '--verdict', VERDICT_F, '--axes', AXES_F, '--out', out, '--generated-at', GEN, ...(expFile ? ['--expected', expFile] : []), ...extraArgs], { encoding: 'utf8', timeout: 60000 });
  if (r.status !== 0) throw new Error(`report-model 非零退出（${r.status}）：${(r.stderr || '').slice(-200)}`);
  return JSON.parse(readFileSync(out, 'utf8'));
}
check('F3a 全签均一 → meta 投影签署字段', () => {
  const m = runRM(W('exp-signed.json', expDoc([{ kind: 'urlPathname', op: 'startsWith', value: '/ok', ...SIGN }])));
  if (m.signedAgainstBuild !== '1.1.2') throw new Error(`期望版本应 1.1.2，实际 ${JSON.stringify(m.signedAgainstBuild)}`);
  if (m.signerId !== 'Steven') throw new Error(`签署人应 Steven，实际 ${JSON.stringify(m.signerId)}`);
});
check('F3b 未签 → 不投影（如实「未签」）', () => {
  const m = runRM(W('exp-unsigned.json', expDoc([{ kind: 'urlPathname', op: 'startsWith', value: '/ok' }])));
  if (m.signedAgainstBuild != null) throw new Error('未签不得投影期望版本');
});
check('F3c 混签 → 不投影（fail-closed 不粉饰）', () => {
  const m = runRM(W('exp-mixed.json', expDoc([
    { kind: 'urlPathname', op: 'startsWith', value: '/ok', ...SIGN },
    { kind: 'noPageError', op: 'absent', ...SIGN, signedAgainstBuild: '1.1.3' },
  ])));
  if (m.signedAgainstBuild != null) throw new Error('混签不得投影期望版本');
});
check('F3e 部分混签不得部分投影（R1-F1：联合均一才投影）', () => {
  // 版本均一但签署人混签 → 两字段都不得投影（不许挑均一的那半粉饰）：
  const m1 = runRM(W('exp-mixed-signer.json', expDoc([
    { kind: 'urlPathname', op: 'startsWith', value: '/ok', ...SIGN },
    { kind: 'noPageError', op: 'absent', ...SIGN, signerId: 'someone-else' },
  ])));
  if (m1.signedAgainstBuild != null || m1.signerId != null) throw new Error(`签署人混签仍投影：build=${JSON.stringify(m1.signedAgainstBuild)} signer=${JSON.stringify(m1.signerId)}`);
  // 签署人均一但版本混签 → 同样全不投影：
  const m2 = runRM(W('exp-mixed-build2.json', expDoc([
    { kind: 'urlPathname', op: 'startsWith', value: '/ok', ...SIGN },
    { kind: 'noPageError', op: 'absent', ...SIGN, signedAgainstBuild: '1.1.3' },
  ])));
  if (m2.signedAgainstBuild != null || m2.signerId != null) throw new Error(`版本混签仍投影：build=${JSON.stringify(m2.signedAgainstBuild)} signer=${JSON.stringify(m2.signerId)}`);
});

check('F3d case-meta 显式优先于 expected 推导', () => {
  const cm = W('case-meta.json', { signedAgainstBuild: '9.9.9' });
  const m = runRM(W('exp-signed2.json', expDoc([{ kind: 'urlPathname', op: 'startsWith', value: '/ok', ...SIGN }])), ['--case-meta', cm]);
  if (m.signedAgainstBuild !== '9.9.9') throw new Error(`case-meta 应优先，实际 ${JSON.stringify(m.signedAgainstBuild)}`);
});

check('F3f 跨源拼合禁（R2-F1）：显式版本 ≠ expected 元组 → 不补签署人', () => {
  const cm = W('case-meta-forge.json', { signedAgainstBuild: '9.9.9' });
  const m = runRM(W('exp-signed3.json', expDoc([{ kind: 'urlPathname', op: 'startsWith', value: '/ok', ...SIGN }])), ['--case-meta', cm]);
  if (m.signedAgainstBuild !== '9.9.9') throw new Error('case-meta 显式版本应保留');
  if (m.signerId != null) throw new Error(`拼出了两源都未背书的元组：Steven 签 9.9.9（signerId=${JSON.stringify(m.signerId)}）`);
});
check('F3g 显式半与 expected 吻合 → 可补缺的另一半（防过度拒绝）', () => {
  const cm = W('case-meta-match.json', { signedAgainstBuild: '1.1.2' });
  const m = runRM(W('exp-signed4.json', expDoc([{ kind: 'urlPathname', op: 'startsWith', value: '/ok', ...SIGN }])), ['--case-meta', cm]);
  if (m.signedAgainstBuild !== '1.1.2') throw new Error('显式版本应保留');
  if (m.signerId !== 'Steven') throw new Error(`显式版本与 expected 元组吻合时应补签署人，实际 ${JSON.stringify(m.signerId)}`);
});

if (fails.length) {
  for (const f of fails) console.error(`RED  report-fidelity: ${f}`);
  console.error(`RED  report-fidelity: ${pass} 过 / ${fails.length} 红`);
  process.exit(1);
}
console.log(`ok   report-fidelity: ${pass}/${pass} 全过（路径保真三向+actual 回填四口径+签署投影四向）`);
process.exit(0);
