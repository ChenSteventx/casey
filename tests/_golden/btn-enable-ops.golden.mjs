// btn-enable-ops.golden.mjs —— buttonState enabled/disabled 双 op（btn-enable-ops，full）红金牌。
// 实现前全红：词表拒 enabled（C1）、评估证不出（C2）、mapAtom 落 pending（C3）、回放无禁用态采集（C4）、
// disabledClass 形状闸不存在（C5）。判据（Steven 签，GRILL D1）：disabled 属性 ∨ aria-disabled="true" ∨
// profile.buttons.disabledClass 类名补判（显式开口——不配类名则类名禁用的钮按可用计，语义钉死在 C4b）。
// 语义（D3，fail-safe）：enabled = hits>0 ∧ disabled=0；disabled = hits>0 ∧ disabled===hits；
// 混合态/零命中/缺采集一律不判真；actual 复合标量 hits=N,disabled=M。
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { startPublishSut } from '../fixtures/publish-sut/server.mjs';
import { signExpected } from './_sign-helper.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CHECK = join(ROOT, 'bin', 'check.mjs');
const REPLAY = join(ROOT, 'bin', 'replay.mjs');
const tmp = mkdtempSync(join(tmpdir(), 'casey-btn-enable-'));

const fails = [];
let pass = 0;
async function checkAsync(name, fn) { try { await fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-400)}`); } }
function run(args) { return spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 120000 }); }
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const writeJson = (p, o) => { writeFileSync(p, JSON.stringify(o, null, 2) + '\n'); return p; };
const vocab = (kind, op) => run([CHECK, '--kind', kind, '--op', op, '--value', 'x', '--validate-only']).status;

// ---------- C1 词表 ----------
await checkAsync('C1 词表：enabled/disabled 过 validate-only；present/absent 照旧；未收 op 仍拒', async () => {
  for (const op of ['present', 'absent', 'enabled', 'disabled']) {
    if (vocab('buttonState', op) !== 0) throw new Error(`buttonState ${op} 应合法（exit 0），实际 ${vocab('buttonState', op)}`);
  }
  if (vocab('buttonState', 'startsWith') === 0) throw new Error('buttonState startsWith 应仍拒（词表封闭）');
});

// ---------- C2 评估语义矩阵（单元级，直调 replay-assert） ----------
await checkAsync('C2 评估矩阵：全禁判 disabled / 全可用判 enabled / 混合双否 / 零命中双否 / 缺采集证不出 / actual 复合', async () => {
  const ra = await import(`file://${join(ROOT, 'lib', 'replay-assert.mjs').replace(/\\/g, '/')}`);
  const one = (op, value, collected) => ra.evaluateAssertions([{ kind: 'buttonState', op, value, soft: false }], collected)[0];
  const allDis = { buttonHits: { 导出: 2 }, buttonSeen: 5, buttonDisabledHits: { 导出: 2 } };
  if (one('disabled', '导出', allDis).ok !== true) throw new Error('全禁应判 disabled true');
  if (one('enabled', '导出', allDis).ok !== false) throw new Error('全禁不得判 enabled');
  const allEn = { buttonHits: { 保存: 1 }, buttonSeen: 5, buttonDisabledHits: { 保存: 0 } };
  if (one('enabled', '保存', allEn).ok !== true) throw new Error('全可用应判 enabled true');
  if (one('disabled', '保存', allEn).ok !== false) throw new Error('全可用不得判 disabled');
  const mixed = { buttonHits: { 发布: 2 }, buttonSeen: 5, buttonDisabledHits: { 发布: 1 } };
  if (one('enabled', '发布', mixed).ok !== false || one('disabled', '发布', mixed).ok !== false) throw new Error('混合态双 op 均不判真（fail-safe）');
  const zero = { buttonHits: { 幽灵: 0 }, buttonSeen: 5, buttonDisabledHits: { 幽灵: 0 } };
  if (one('enabled', '幽灵', zero).ok !== false || one('disabled', '幽灵', zero).ok !== false) throw new Error('零命中双 op 均不判真（不在场谈不上状态）');
  const noCap = { buttonHits: { 导出: 1 }, buttonSeen: 5 };
  const r = one('disabled', '导出', noCap);
  if (r.ok !== false || r.actual !== null) throw new Error(`缺 buttonDisabledHits 应证不出（ok:false actual:null），实际 ${JSON.stringify(r)}`);
  const withActual = one('disabled', '导出', allDis);
  if (withActual.actual !== 'hits=2,disabled=2') throw new Error(`actual 应复合标量 hits=2,disabled=2，实际 ${withActual.actual}`);
  // codex R1-F1：证据异常（NaN/负数/非整数）绝不 fail-open——NaN<=0 为假、若放行会判 enabled 真。
  const nanHits = { buttonHits: { 幽灵: NaN }, buttonSeen: 5, buttonDisabledHits: { 幽灵: 0 } };
  if (one('enabled', '幽灵', nanHits).ok !== false) throw new Error('hits=NaN 不得判 enabled（证据异常 fail-safe）');
  const badDis = { buttonHits: { 导出: 1 }, buttonSeen: 5, buttonDisabledHits: { 导出: -1 } };
  if (one('disabled', '导出', badDis).ok !== false) throw new Error('disabledHits 负数不得判真（证据异常 fail-safe）');
  // codex R2-F1 回归锁：dis>hits 采集不变量破坏态——双 op 皆否（防后人把 dis===hits 改宽成 dis>=hits）。
  const overDis = { buttonHits: { 导出: 1 }, buttonSeen: 5, buttonDisabledHits: { 导出: 2 } };
  if (one('disabled', '导出', overDis).ok !== false || one('enabled', '导出', overDis).ok !== false) throw new Error('dis>hits 异常态双 op 均不得判真');
});

// ---------- C3 mapAtom 翻转 ----------
await checkAsync('C3 草拟映射：state enabled/disabled 翻硬映射非 pending；present 照旧', async () => {
  const ad = await import(`file://${join(ROOT, 'lib', 'assertion-draft.mjs').replace(/\\/g, '/')}`);
  const observed = { caseId: 'tc_x', steps: [{ intentId: 'intent_1', urlPathnameAfter: '/a/b' }] };
  const atoms = [
    { intentId: 'intent_1', atom: 'assert.buttonState', params: { name: '导出', state: 'disabled' } },
    { intentId: 'intent_1', atom: 'assert.buttonState', params: { name: '保存', state: 'enabled' } },
    { intentId: 'intent_1', atom: 'assert.buttonState', params: { name: '发布', state: 'present' } },
  ];
  const d = ad.synthesizeSkeleton(observed, atoms);
  const exp = (d.intents.find((i) => i.intentId === 'intent_1') || {}).expected || [];
  for (const [op, val] of [['disabled', '导出'], ['enabled', '保存'], ['present', '发布']]) {
    if (!exp.some((a) => a.kind === 'buttonState' && a.op === op && a.value === val)) throw new Error(`state ${op} 应硬映射进骨架，实际 expected=${JSON.stringify(exp)} pending=${JSON.stringify(d.pending)}`);
  }
  if ((d.pending || []).some((p) => p.atom === 'assert.buttonState')) throw new Error('enabled/disabled 不得再落 pending（翻转）');
});

// ---------- C4 采集端到端（真回放打 disabledBtn 场景） ----------
const sut = await startPublishSut({ scenario: 'disabledBtn' });
try {
  const EVENTS = writeJson(join(tmp, 'events.json'), {
    schemaVersion: 2, channel: 'web', caseId: 'tc_btn_enable', url: '{{baseUrl}}/ai-manager/process/detail',
    recordedAt: '2026-07-07T00:00:00.000Z', compiledBy: 'golden', authored: false,
    events: [{ stepId: 'atstep_0', intentId: 'intent_0', atom: 'nav.detail', action: 'nav', url: '{{baseUrl}}/ai-manager/process/detail' }],
  });
  const mkExpected = (asserts) => writeJson(join(tmp, `expected-${Math.abs(asserts.length)}-${asserts[0].op}-${asserts[0].value}.json`), signExpected({
    caseId: 'tc_btn_enable', channel: 'web',
    intents: [{ intentId: 'intent_0', expected: asserts.map((a) => ({ kind: 'buttonState', soft: false, ...a })) }],
    globalAssertions: [],
  }));
  const PROF_FULL = writeJson(join(tmp, 'profile-full.json'), { background: [], successField: 'status', successValue: 200, buttons: { extraSelector: '.editor-btn', disabledClass: 'hr-button--disabled' } });
  const PROF_NOCLS = writeJson(join(tmp, 'profile-nocls.json'), { background: [], successField: 'status', successValue: 200, buttons: { extraSelector: '.editor-btn' } });
  const replayTo = (expectedFile, prof, outName) => {
    const out = join(tmp, outName);
    const r = run([REPLAY, '--events', EVENTS, '--sut', sut.url, '--expected', expectedFile, '--profile', prof, '--out', out]);
    return { r, out };
  };
  await checkAsync('C4a 采集三路：属性/aria/类名判禁、enabled 对照全过；axes 加性字段在场', async () => {
    const exp = mkExpected([
      { op: 'disabled', value: '导出' },      // <button disabled>
      { op: 'disabled', value: '新建版本' },  // aria-disabled="true"
      { op: 'disabled', value: '发布审核' },  // div + hr-button--disabled 类（吃 disabledClass 补判）
      { op: 'enabled', value: '保存' },       // 可用对照
    ]);
    const { r, out } = replayTo(exp, PROF_FULL, 'axes-full.json');
    if (r.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
    const step = readJson(out).steps.find((s) => s.intentId === 'intent_0');
    const bad = (step.postAssertions || []).filter((a) => a.ok !== true);
    if (bad.length) throw new Error(`四断言应全真，败者 ${JSON.stringify(bad.map((a) => ({ op: a.op, value: a.value, ok: a.ok, actual: a.actual })))}`);
  });
  await checkAsync('C4b 类名补判是显式开口：不配 disabledClass 则类名禁用钮按可用计（判据钉死）', async () => {
    const exp = mkExpected([{ op: 'enabled', value: '发布审核' }]);
    const { r, out } = replayTo(exp, PROF_NOCLS, 'axes-nocls.json');
    if (r.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r.status}`);
    const a = readJson(out).steps[0].postAssertions[0];
    if (a.ok !== true) throw new Error(`不配 disabledClass 时类名禁用钮应按可用计（签过的显式开口语义），实际 ${JSON.stringify(a)}`);
  });
  await checkAsync('C4c 无 profile.buttons（role 单通道）：真按钮属性禁用照判、可用对照照判（codex R1-F2）', async () => {
    const PROF_NOBTN = writeJson(join(tmp, 'profile-nobtn.json'), { background: [], successField: 'status', successValue: 200 });
    const exp = mkExpected([{ op: 'disabled', value: '导出' }, { op: 'enabled', value: '保存' }]);
    const { r, out } = replayTo(exp, PROF_NOBTN, 'axes-nobtn.json');
    if (r.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r.status}`);
    const bad = readJson(out).steps[0].postAssertions.filter((a) => a.ok !== true);
    if (bad.length) throw new Error(`role 单通道两断言应全真（extraDisN 缺省 0 非缺采集），败者 ${JSON.stringify(bad)}`);
  });
  await checkAsync('C5 profile 形状：disabledClass 空串 exit 65；首尾空白类名存 trim 值照常工作（codex R1-F4）', async () => {
    const badProf = writeJson(join(tmp, 'profile-bad.json'), { background: [], successField: 'status', successValue: 200, buttons: { extraSelector: '.editor-btn', disabledClass: '' } });
    const exp = mkExpected([{ op: 'enabled', value: '保存' }]);
    const { r } = replayTo(exp, badProf, 'axes-bad.json');
    if (r.status !== 65) throw new Error(`disabledClass 空串应 exit 65（形状闸），实际 ${r.status}`);
    // 空白垫类名：classList.contains 对含空白 token 会抛 → 若存原值则整名缺采集（静默降级）；须存 trim 值。
    const padProf = writeJson(join(tmp, 'profile-pad.json'), { background: [], successField: 'status', successValue: 200, buttons: { extraSelector: '.editor-btn', disabledClass: '  hr-button--disabled  ' } });
    const exp2 = mkExpected([{ op: 'disabled', value: '发布审核' }]);
    const { r: r2, out } = replayTo(exp2, padProf, 'axes-pad.json');
    if (r2.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r2.status}`);
    const a = readJson(out).steps[0].postAssertions[0];
    if (a.ok !== true) throw new Error(`空白垫 disabledClass 应 trim 后照常判禁，实际 ${JSON.stringify(a)}`);
  });
} finally {
  await sut.close();
}

console.log(`btn-enable-ops golden: ${pass} 过 / ${fails.length} 败`);
if (fails.length) { for (const f of fails) console.error('  FAIL ' + f); process.exit(1); }
