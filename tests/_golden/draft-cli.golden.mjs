#!/usr/bin/env node
// 冻结黄金标准（draft-cli · hermetic）：casey draft 薄 CLI——骨架 + 补缝合并 + 闸 + 落草稿。
// 决策依 docs/plans/draft-cli/proposed/GRILL.md（G1–G4 机械决策）；函数层已经 p4-drafter 收口，本 golden 只钉 CLI 面。
// 实现前必红：casey draft 现为 notImplemented 桩（exit 3）。改本文件 = Test Ratchet 判红。
import { readFileSync, writeFileSync, existsSync, mkdtempSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const CASEY = join(ROOT, 'bin', 'casey.mjs');
const OBSERVED_FIXTURE = join(ROOT, 'tests', '_golden', 'fixtures', 'seams', 'observed-reality.fixture.json');
const tmp = mkdtempSync(join(tmpdir(), 'casey-draftcli-'));

const fails = [];
let pass = 0;
function check(name, fn) {
  try { fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-300)}`); }
}
function run(args) {
  return spawnSync(process.execPath, [CASEY, 'draft', ...args], { encoding: 'utf8', timeout: 60000 });
}

// 合成输入：observed 用已冻 seams fixture（caseId=tc_workflow_create_smoke）；compile-report 只需 handoff.assertionAtoms。
const CASE_ID = 'tc_workflow_create_smoke';
const REPORT = join(tmp, 'compile-report.json');
writeFileSync(REPORT, JSON.stringify({
  caseId: CASE_ID,
  handoff: { assertionAtoms: [
    { intentId: 'intent_1', atom: 'assert.onPage', params: { urlIncludes: '/heren/aimanagement/edit' } },
    { intentId: 'intent_1', atom: 'assert.textVisible', params: { text: '新增成功' } },
  ] },
}));
const outDir = join(tmp, 'out');
mkdirSync(outDir, { recursive: true });
const DRAFT = join(outDir, `expected.draft-${CASE_ID}.json`);

// ---------- D1 纯骨架：落草稿 + 卷回 + 全局取证 + soft 语义 ----------
check('D1 纯骨架草拟落盘', () => {
  const r = run([CASE_ID, '--observed', OBSERVED_FIXTURE, '--compile-report', REPORT, '--out-dir', outDir]);
  if (r.status !== 0) throw new Error(`应 exit 0，实际 ${r.status}：${(r.stderr || r.stdout || '').slice(-200)}`);
  if (!existsSync(DRAFT)) throw new Error('草稿未落盘');
  const d = JSON.parse(readFileSync(DRAFT, 'utf8'));
  if (d.caseId !== CASE_ID) throw new Error(`caseId 应卷回 ${CASE_ID}，实际 ${d.caseId}`);
  const gk = new Set((d.globalAssertions || []).map((a) => a.kind));
  for (const k of ['noPageError', 'noErrorEnvelope']) if (!gk.has(k)) throw new Error(`全局取证缺 ${k}`);
  const i1 = (d.intents || []).find((it) => it.intentId === 'intent_1');
  const tv = (i1?.expected || []).find((a) => a.kind === 'textVisible');
  if (!tv || tv.soft === true) throw new Error('textVisible 应在场且已提硬（kinds-harden 后不标 soft）');
  if (!Array.isArray(d.pending)) throw new Error('草稿须带 pending 留痕（可空数组）');
});

// ---------- D2 补缝合并：合法 patch 进草稿 ----------
check('D2 补缝合并', () => {
  const PATCH = join(tmp, 'patch-ok.json');
  writeFileSync(PATCH, JSON.stringify([
    { intentId: 'intent_2', kind: 'textVisible', op: 'appears', value: '生成节点建议' },
    { intentId: 'intent_0', kind: 'urlPathname', op: 'startsWith', value: '/heren/aimanagement/list' },
  ]));
  const r = run([CASE_ID, '--observed', OBSERVED_FIXTURE, '--compile-report', REPORT, '--out-dir', outDir, '--patch', PATCH]);
  if (r.status !== 0) throw new Error(`应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
  const d = JSON.parse(readFileSync(DRAFT, 'utf8'));
  const i2 = (d.intents || []).find((it) => it.intentId === 'intent_2');
  if (!(i2?.expected || []).some((a) => a.kind === 'textVisible' && a.value === '生成节点建议')) throw new Error('补缝断言未合并进草稿');
  const i0 = (d.intents || []).find((it) => it.intentId === 'intent_0');
  if (!(i0?.expected || []).some((a) => a.kind === 'urlPathname' && a.soft !== true)) throw new Error('已实现 kind 补缝应为硬断言');
});

// ---------- D3 违规补缝 fail-closed：闸拒 65 且不落草稿 ----------
check('D3 违规补缝整份拒、不落草稿', () => {
  const dirtyDir = join(tmp, 'out-dirty');
  mkdirSync(dirtyDir, { recursive: true });
  const PATCH_BAD = join(tmp, 'patch-bad.json');
  writeFileSync(PATCH_BAD, JSON.stringify([
    { intentId: 'intent_1', kind: 'inputReadback', op: 'equals', value: 'atl_目录CRUD_1782634443', soft: true },
  ]));
  const r = run([CASE_ID, '--observed', OBSERVED_FIXTURE, '--compile-report', REPORT, '--out-dir', dirtyDir, '--patch', PATCH_BAD]);
  if (r.status !== 65) throw new Error(`违规补缝应 exit 65，实际 ${r.status}`);
  if (existsSync(join(dirtyDir, `expected.draft-${CASE_ID}.json`))) throw new Error('闸拒后不得落草稿（半份草稿比没有更危险）');
  if (!/atl_|problems|违规|字面量/.test(String(r.stderr || ''))) throw new Error('stderr 须给 problems 落点');
});

// ---------- D4 caseId 一致性闸 ----------
check('D4 caseId 不一致拒', () => {
  const r = run(['tc_other', '--observed', OBSERVED_FIXTURE, '--compile-report', REPORT, '--out-dir', outDir]);
  if (r.status !== 65) throw new Error(`caseId 不一致应 exit 65，实际 ${r.status}`);
});

// ---------- D5 缺参 ----------
check('D5 缺参 64', () => {
  const r = run([CASE_ID, '--observed', OBSERVED_FIXTURE]);
  if (r.status !== 64) throw new Error(`缺参应 exit 64，实际 ${r.status}`);
});

// ---------- codex R1 四发现回归锁 ----------
check('D6 compile-report 缺 caseId 拒（R1-F1：证不出一致即拒）', () => {
  const R2F = join(tmp, 'report-nocase.json');
  writeFileSync(R2F, JSON.stringify({ handoff: { assertionAtoms: [] } }));
  const r = run([CASE_ID, '--observed', OBSERVED_FIXTURE, '--compile-report', R2F, '--out-dir', outDir]);
  if (r.status !== 65) throw new Error(`compile-report 缺 caseId 应 exit 65，实际 ${r.status}`);
});

check('D7 caseId 路径字符拒（R1-F2：不得穿越 out-dir）', () => {
  const evil = '../evil';
  const OBS_EVIL = join(tmp, 'observed-evil.json');
  const obs = JSON.parse(readFileSync(OBSERVED_FIXTURE, 'utf8'));
  obs.caseId = evil;
  writeFileSync(OBS_EVIL, JSON.stringify(obs));
  const REP_EVIL = join(tmp, 'report-evil.json');
  writeFileSync(REP_EVIL, JSON.stringify({ caseId: evil, handoff: { assertionAtoms: [] } }));
  const r = run([evil, '--observed', OBS_EVIL, '--compile-report', REP_EVIL, '--out-dir', outDir]);
  if (r.status !== 65) throw new Error(`路径字符 caseId 应 exit 65，实际 ${r.status}`);
  if (existsSync(join(tmp, 'expected.draft-..', 'evil.json')) || existsSync(join(tmp, 'evil.json'))) throw new Error('产物穿越出 out-dir');
});

check('D8 裸 --patch 拒（R1-F3：缺文件值不得静默忽略）', () => {
  const r = run([CASE_ID, '--observed', OBSERVED_FIXTURE, '--compile-report', REPORT, '--out-dir', outDir, '--patch']);
  if (r.status !== 65) throw new Error(`裸 --patch 应 exit 65，实际 ${r.status}`);
});

check('D9 凭据门拦截 exit 1（R1-F4 修正采纳：同 compile 先例，1=凭据门拦）', () => {
  const cleanDir = join(tmp, 'out-cred');
  mkdirSync(cleanDir, { recursive: true });
  const PATCH_CRED = join(tmp, 'patch-cred.json');
  writeFileSync(PATCH_CRED, JSON.stringify([
    { intentId: 'intent_1', kind: 'textVisible', op: 'appears', value: 'password: hunter2 明文' },
  ]));
  const r = run([CASE_ID, '--observed', OBSERVED_FIXTURE, '--compile-report', REPORT, '--out-dir', cleanDir, '--patch', PATCH_CRED]);
  if (r.status !== 1) throw new Error(`凭据门拦截应 exit 1（compile 先例），实际 ${r.status}`);
  if (existsSync(join(cleanDir, `expected.draft-${CASE_ID}.json`))) throw new Error('凭据门拦截后不得落草稿');
});

// ---------- drafter-patch-intent-guard（real-uat R2 实证工装缝）----------
check('D10 补缝 intentId 不存在于 observed → 65 且不落草稿且遮值（错位断言禁止静默成孤儿）', () => {
  const gDir = join(tmp, 'out-ghost');
  mkdirSync(gDir, { recursive: true });
  const PATCH_GHOST = join(tmp, 'patch-ghost.json');
  // 种子 intentId（codex R1-R3：遮值约束也要冻）：违例值绝不许出现在任何输出流——patch 是 LLM/人编
  // 文件、值可携任意内容（output-seal 同律）；诊断靠「存在性闸」定位词 + intents[序号]。
  const SEED = 'SEEDVAL_D10GHOST_x9';
  writeFileSync(PATCH_GHOST, JSON.stringify([
    { intentId: SEED, kind: 'urlPathname', op: 'startsWith', value: '/heren/aimanagement/edit' },
  ]));
  const r = run([CASE_ID, '--observed', OBSERVED_FIXTURE, '--compile-report', REPORT, '--out-dir', gDir, '--patch', PATCH_GHOST]);
  if (r.status !== 65) throw new Error(`错位 intentId 应 exit 65，实际 ${r.status}`);
  if (existsSync(join(gDir, `expected.draft-${CASE_ID}.json`))) throw new Error('错位补缝拒后不得落草稿');
  const out = String(r.stderr || '') + String(r.stdout || '');
  if (out.includes(SEED)) throw new Error('违例 intentId 原值回显（遮值纪律破，output-seal 同律）');
  if (!out.includes('存在性闸')) throw new Error('stderr 缺「存在性闸」定位词（遮值不得降诊断）');
  if (!/intents\[\d+\]/.test(out)) throw new Error('stderr 缺 intents[序号] 定位');
});

check('D11 正控：observed 真实 intent（骨架无断言者）补缝仍成、不误杀合法新建', () => {
  const pDir = join(tmp, 'out-pos');
  mkdirSync(pDir, { recursive: true });
  const PATCH_POS = join(tmp, 'patch-pos.json');
  writeFileSync(PATCH_POS, JSON.stringify([
    { intentId: 'intent_0', kind: 'urlPathname', op: 'startsWith', value: '/heren/aimanagement/list' },
  ]));
  const r = run([CASE_ID, '--observed', OBSERVED_FIXTURE, '--compile-report', REPORT, '--out-dir', pDir, '--patch', PATCH_POS]);
  if (r.status !== 0) throw new Error(`合法 intentId 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-160)}`);
  const d = JSON.parse(readFileSync(join(pDir, `expected.draft-${CASE_ID}.json`), 'utf8'));
  const i0 = (d.intents || []).find((it) => it.intentId === 'intent_0');
  if (!(i0?.expected || []).some((a) => a.kind === 'urlPathname')) throw new Error('合法补缝未挂上');
  for (const it of d.intents || []) if (!['intent_0', 'intent_1', 'intent_2'].includes(it.intentId)) throw new Error(`草稿含 observed 之外的 intent：${it.intentId}`);
});

if (fails.length) {
  for (const f of fails) console.error(`RED  draft-cli: ${f}`);
  console.error(`RED  draft-cli: ${pass} 过 / ${fails.length} 红`);
  process.exit(1);
}
console.log(`ok   draft-cli: ${pass}/${pass} 全过（骨架落盘+补缝合并+违规整份拒+一致性闸+缺参）`);
process.exit(0);
