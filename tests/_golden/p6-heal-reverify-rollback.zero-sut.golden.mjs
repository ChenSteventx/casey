#!/usr/bin/env node
// P6 heal 验收金牌 A3c/A7（真链路复核编排 + 对称回滚 + 复位证明门）。
//
// 覆盖 plan §3 验收表：
//   A3c 绑定齐备 --promote → journal 五步晋升 + HealReceipt；复核走真链路假运行时接缝，
//       目标步 PASS **且全案无非目标步新回归** → outcome=reverified；
//       注入非目标步回归 → FAILED + 对称回滚：journal 登记的全部目标（events + 绑定逐件）
//       恢复后 sha256 断言 = 晋升前、stdout outcome=reverify-failed-rolled-back、exit 0
//   A7  无签署 reset-proof.json → route:human 落 receipt、不产合成 PASS（exit 0
//       outcome=reverify-routed-human）；字段残缺 / caseId 失配 → 拒
//
// 运行时注入（plan §3.5 逐字）：CASEY_HEAL_RUNTIME_SEAM=<module> 指向假运行时模块；
// 本金牌自带的极简接缝在 support/p6-heal-runtime-seam.mjs（形状对齐
// lib/teachin/runtime-bootstrap.mjs 的 seams 概念）。剧本由 CASEY_HEAL_SEAM_SCENARIO 选，
// 那是金牌自己的事、不是生产契约。GRILL D6：合成 verdict 在任何验收路径都不得判 healed→PASS，
// 复核必须是真 replay → 真 verdict 代码路径，本接缝只换「运行时从哪来」。
//
// 本金牌对 plan 未逐字给出者所作的落地解释（与 apply-promote 金牌同一套，不另造）：
//   「重签件就位」= cases/<caseId>/entity-locks.frozen.json 的 eventsSha256 已改签到候选字节。
//   A7 的「拒」退出码 D7 未列举：只钉「非 0 且落在 D7 冻结枚举内 + 不产成功 outcome」。

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SCENARIOS, diffSnapshots, entityLocksFrozen, expectedFrozen, lastJson, makeRunner,
  resetProof, runHeal, scratchDir, sha256File, snapshotTree, writeQuad,
} from './support/p6-heal-fixtures.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SEAM = resolve(HERE, 'support', 'p6-heal-runtime-seam.mjs');
const CASE_ID = 'tc_p6_heal_synth';
const STEPS = SCENARIOS.reverifyChain;
const TS = '1785000000000';
const D7_CODES = new Set([2, 4, 6, 64, 65]);
const SCRATCH = scratchDir('reverify');
const { test, finish, assert } = makeRunner(
  'p6-heal-reverify-rollback',
  () => rmSync(SCRATCH, { recursive: true, force: true }),
);

const shaOf = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const jsonText = (v) => JSON.stringify(v, null, 2) + '\n';
// 跨用例传递「晋升前快照」的小挎包：回滚对称性断言必须拿到同一次晋升的基准。
const SHARED = {};

function deepFind(node, key) {
  if (node == null || typeof node !== 'object') return undefined;
  if (!Array.isArray(node) && Object.prototype.hasOwnProperty.call(node, key)) return node[key];
  for (const v of Array.isArray(node) ? node : Object.values(node)) {
    const hit = deepFind(v, key);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

/** 剧本文件：按可访问名给候选数。缺省 1（全部可解析）。 */
function writeScenario(base, tag, byAccessibleName = {}) {
  const p = join(base, `seam-${tag}.json`);
  writeFileSync(p, jsonText({ defaultCount: 1, byAccessibleName }), 'utf8');
  return p;
}

function prepare(tag) {
  const base = join(SCRATCH, tag);
  const casesDir = join(base, 'cases');
  const caseDir = join(casesDir, CASE_ID);
  const outDir = join(base, 'out');
  mkdirSync(caseDir, { recursive: true });
  const q = writeQuad(caseDir, { caseId: CASE_ID, steps: STEPS });
  const locksPath = join(caseDir, 'entity-locks.frozen.json');
  writeFileSync(locksPath, jsonText(entityLocksFrozen({
    caseId: CASE_ID, steps: STEPS, eventsSha256: shaOf(q.events),
  })), 'utf8');
  writeFileSync(join(caseDir, 'expected.frozen.json'),
    jsonText(expectedFrozen({ caseId: CASE_ID, steps: STEPS })), 'utf8');
  return {
    base, casesDir, caseDir, outDir, q, locksPath,
    driftDir: join(outDir, 'drift'),
    patch: join(outDir, 'drift', `${CASE_ID}.${TS}.patch.json`),
    candidate: join(outDir, 'drift', `${CASE_ID}.${TS}.events.candidate.json`),
    journal: join(outDir, 'drift', `${CASE_ID}.${TS}.promote.journal.json`),
    receipt: join(outDir, 'drift', `${CASE_ID}.${TS}.heal-receipt.json`),
  };
}

function driftList(c) {
  if (!existsSync(c.driftDir)) return [];
  return readdirSync(c.driftDir).sort();
}

/**
 * 走到「已晋升、待复核」：提案 → 人签补丁 → 应用产候选 → 重签绑定到候选 → 晋升。
 * 返回晋升前的 case 目录快照（回滚对称性断言的基准）。
 */
function driveToPromoted(c) {
  const p = runHeal([
    CASE_ID, '--verdict', c.q.verdictPath, '--axes', c.q.axes, '--events', c.q.events,
    '--run-history', c.q.history, '--out-dir', c.outDir, '--ts', TS,
  ], { casesDir: c.casesDir });
  assert(p.code === 0, `前置：提案须 exit 0，实得 ${p.code}\n${p.all.slice(0, 300)}`);
  const patch = JSON.parse(readFileSync(c.patch, 'utf8'));
  patch.humanSignoff = { signedAt: '2026-07-28T12:00:00+08:00', signerId: 'Steven', decision: 'apply' };
  patch.status = 'signed';
  const signedPath = c.patch.replace(/\.patch\.json$/, '.patch.signed.json');
  writeFileSync(signedPath, jsonText(patch), 'utf8');

  const a = runHeal([CASE_ID, '--apply', '--patch', signedPath, '--out-dir', c.outDir, '--ts', TS],
    { casesDir: c.casesDir });
  assert(a.code === 0, `前置：应用须 exit 0，实得 ${a.code}\n${a.all.slice(0, 300)}`);

  writeFileSync(c.locksPath, jsonText(entityLocksFrozen({
    caseId: CASE_ID, steps: STEPS, eventsSha256: shaOf(c.candidate), signedAt: '2026-07-28T12:30:00.000Z',
  })), 'utf8');

  const prePromote = snapshotTree(c.caseDir);
  const pr = runHeal([CASE_ID, '--promote', '--candidate', c.candidate, '--out-dir', c.outDir, '--ts', TS],
    { casesDir: c.casesDir });
  assert(pr.code === 0, `前置：晋升须 exit 0，实得 ${pr.code}\n${pr.all.slice(0, 300)}`);
  assert(existsSync(c.receipt), `前置：晋升须产 HealReceipt；实得 drift/：${driftList(c).join(', ')}`);
  return prePromote;
}

const reverify = (c, scenarioPath) => runHeal(
  [CASE_ID, '--reverify', '--receipt', c.receipt, '--out-dir', c.outDir, '--ts', TS],
  { casesDir: c.casesDir, seam: SEAM, seamScenario: scenarioPath },
);

// ── A3c 正路：目标步 PASS 且全案无非目标步新回归 ────────────────────────────
await test('A3c 完整链 apply→promote→reverify（真链路假运行时接缝）→ exit 0 + outcome=reverified', () => {
  const c = prepare('a3c-happy');
  writeFileSync(join(c.caseDir, 'reset-proof.json'), jsonText(resetProof({ caseId: CASE_ID })), 'utf8');
  driveToPromoted(c);
  const scenario = writeScenario(c.base, 'happy'); // 全部定位可解析 → 目标步修好、非目标步不动
  const res = reverify(c, scenario);
  assert(res.code === 0, `复核通过须 exit 0，实得 ${res.code}\n${res.all.slice(0, 400)}`);
  const j = lastJson(res);
  assert(j != null && j.outcome === 'reverified',
    `outcome 必精确等于 reverified（D7 六值全集），实得 ${JSON.stringify(j?.outcome)}`);
  assert(!JSON.stringify(j).includes('rolled-back'), '复核通过不得同时报回滚');
});

// ── A3c 负路：注入非目标步回归 → FAILED + 对称回滚 ──────────────────────────
await test('A3c 注入非目标步回归 → exit 0 + outcome=reverify-failed-rolled-back', () => {
  const c = prepare('a3c-regress');
  writeFileSync(join(c.caseDir, 'reset-proof.json'), jsonText(resetProof({ caseId: CASE_ID })), 'utf8');
  const prePromote = driveToPromoted(c);
  c._prePromote = prePromote;
  // 掐掉非目标步（atstep_0，可访问名「确定」）的定位：目标步照旧 PASS，但全案出现
  // 「绿 → 非绿」的新回归 → 按 D3 codex delta 的通过标准，复核必须判 FAILED。
  const scenario = writeScenario(c.base, 'regress', { 确定: { count: 0 } });
  const res = reverify(c, scenario);
  assert(res.code === 0,
    `复核失败但回滚成功 = 命令成功（D7：业务失败由 outcome+receipt 承载），须 exit 0，实得 ${res.code}\n${res.all.slice(0, 400)}`);
  const j = lastJson(res);
  assert(j != null && j.outcome === 'reverify-failed-rolled-back',
    `outcome 必精确等于 reverify-failed-rolled-back（D7 六值全集），实得 ${JSON.stringify(j?.outcome)}`);
  SHARED.regress = c;
});

await test('A3c 回滚与晋升对称：journal 登记的全部目标逐件恢复、sha256 = 晋升前', () => {
  const c = SHARED.regress;
  assert(c != null, '前置：非目标步回归用例须已跑过');
  const after = snapshotTree(c.caseDir);
  const d = diffSnapshots(c._prePromote, after);
  assert(d.changed.length === 0 && d.removed.length === 0,
    `对称回滚要求 case 目录逐件恢复到晋升前字节：改 ${d.changed.join(',')} 删 ${d.removed.join(',')}`);
  // 再按 journal 自身登记的目标逐件核 —— 不允许「只恢复 events」的半回滚。
  assert(existsSync(c.journal), 'journal 须在场（回滚过程自身也须入 journal）');
  const journal = JSON.parse(readFileSync(c.journal, 'utf8'));
  const targets = journal.targets || journal.registered || [];
  assert(Array.isArray(targets) && targets.length >= 2,
    `journal 须登记全部将改目标（events + 每个受影响绑定），实得 ${targets.length} 件——不存在只恢复 events 的半回滚`);
  for (const t of targets) {
    const p = t.path || t.file || t.target;
    assert(typeof p === 'string' && existsSync(p), `journal 登记目标须可定位：${JSON.stringify(t)}`);
    const expected = c._prePromote.get(p);
    if (expected === undefined) continue; // out-dir 侧登记目标不在 case 快照内
    assert(sha256File(p) === expected,
      `journal 登记目标 ${p} 回滚后 sha256 须 = 晋升前`);
  }
  const sealed = String(journal.status || journal.sealedAs || '');
  assert(sealed.includes('rolled-back'),
    `回滚须以 rolled-back 状态封账（D5），实得 status=${JSON.stringify(journal.status)}`);
});

// ── A7 无 reset-proof.json → route:human ───────────────────────────────────
await test('A7 无签署 reset-proof.json → exit 0 + outcome=reverify-routed-human + receipt 记 route:human', () => {
  const c = prepare('a7-noproof');
  driveToPromoted(c); // 刻意不铺 reset-proof.json
  assert(!existsSync(join(c.caseDir, 'reset-proof.json')), '前置：本用例不得有复位证明件');
  const res = reverify(c, writeScenario(c.base, 'noproof'));
  assert(res.code === 0, `route:human 是终局而非错误，须 exit 0，实得 ${res.code}\n${res.all.slice(0, 400)}`);
  const j = lastJson(res);
  assert(j != null && j.outcome === 'reverify-routed-human',
    `outcome 必精确等于 reverify-routed-human（D7 六值全集），实得 ${JSON.stringify(j?.outcome)}`);
  const receipts = driftList(c).filter((f) => f.includes('heal-receipt'));
  assert(receipts.length >= 1, '未证明复位须落 receipt 记之（plan S6）');
  const merged = receipts.map((f) => JSON.parse(readFileSync(join(c.driftDir, f), 'utf8')));
  const routed = merged.some((r) => String(deepFind(r, 'route') ?? '') === 'human');
  assert(routed, `receipt 须记 route:human，实得 ${JSON.stringify(merged).slice(0, 300)}`);
  assert(!merged.some((r) => String(deepFind(r, 'verdict') ?? '') === 'PASS'),
    'D6：未证明复位时绝不得产出合成 healed→PASS');
});

await test('A7 调用方布尔自报「已复位」无效 → 仍 route:human', () => {
  const c = prepare('a7-boolean');
  driveToPromoted(c);
  // 布尔/旗标自报：写一个只有布尔的伪证明件，不带 D3 v3 schema 的任何签署字段。
  writeFileSync(join(c.caseDir, 'reset-proof.json'), jsonText({ caseId: CASE_ID, resettable: true }), 'utf8');
  const res = reverify(c, writeScenario(c.base, 'boolean'));
  const j = lastJson(res) || {};
  assert(j.outcome !== 'reverified',
    'D3：调用方任何布尔/旗标自报均无效，绝不得据此判复核通过');
  assert(res.code === 0 ? j.outcome === 'reverify-routed-human' : D7_CODES.has(res.code),
    `布尔自报须落 route:human（exit 0）或落在 D7 冻结拒绝码内，实得 exit ${res.code} / ${JSON.stringify(j.outcome)}`);
});

// ── A7 字段残缺 / caseId 失配 → 拒 ─────────────────────────────────────────
for (const [tag, mutate, why] of [
  ['a7-missingfield', (p) => { delete p.signerId; delete p.signedAt; }, '字段残缺'],
  ['a7-caseidmismatch', (p) => { p.caseId = 'tc_someone_else'; }, 'caseId 失配'],
  ['a7-digestmismatch', (p) => { p.resetPlanDigest = 'sha256:0000'; }, 'resetPlanDigest 失配'],
]) {
  await test(`A7 reset-proof ${why} → 拒（不产成功 outcome、不产合成 PASS）`, () => {
    const c = prepare(tag);
    driveToPromoted(c);
    const proof = resetProof({ caseId: CASE_ID });
    mutate(proof);
    writeFileSync(join(c.caseDir, 'reset-proof.json'), jsonText(proof), 'utf8');
    const res = reverify(c, writeScenario(c.base, tag));
    const j = lastJson(res) || {};
    assert(j.outcome !== 'reverified',
      `${why} 的复位证明件绝不得放行复核通过（D3 v4：一律视为未证明）`);
    assert(res.code !== 0,
      `A7 明确要求${why}走「拒」而非 route:human，须非 0 退出，实得 ${res.code}\n${res.all.slice(0, 300)}`);
    assert(D7_CODES.has(res.code),
      `拒绝码须落在 D7 冻结枚举 {2,4,6,64,65} 内，实得 ${res.code}`);
  });
}

finish();
