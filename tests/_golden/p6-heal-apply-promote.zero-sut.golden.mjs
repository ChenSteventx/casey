#!/usr/bin/env node
// P6 heal 验收金牌 A3a/A3b（候选式应用 + 日志式事务晋升的负控面）。
//
// 覆盖 plan §3 验收表：
//   A3a 未签补丁 --apply 拒；已签 → 候选旁文件产出、原 events 不变、候选 sha256 输出
//   A3b 候选篡改（sha256 失配）--promote 拒；重签缺失 → 拒 exit 6、无任何文件被换；
//       未封 journal 残留 → 一切 heal 子命令 fail-closed
//
// 冻结依据与本金牌所作的落地解释（plan/GRILL 未逐字给出者，在此冻结，实现须迎合）：
//   - 退出码 GRILL D7：6 = 晋升阻断（重签缺失 / 候选 sha256 失配 / 未封 journal）——逐字。
//   - 「人签绑定候选精确 sha256」（D5）与「受影响冻结绑定重签件就位」（S5）在现役产物面上
//     是同一件事：cases/<caseId>/entity-locks.frozen.json 的 eventsSha256 把冻结绑定钉在某份
//     events 字节上（真产物实测形状）。故「重签件就位」= 该锁的 eventsSha256 已改签到候选字节，
//     「重签缺失」= 该锁仍指向 heal 前的旧 events。不另造新签署件。
//   - 未签补丁 --apply 的具体退出码 D7 未列举：本金牌只钉「非 0 且落在 D7 冻结枚举内 +
//     具名 HEAL_PATCH_UNSIGNED + 零候选产出」，不发明码号。
//
// 纪律：spawn 真二进制，只认退出码 + 产物字节；目录快照逐字节对照「无任何文件被替换」。

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SCENARIOS, diffSnapshots, entityLocksFrozen, expectedFrozen, lastJson,
  makeRunner, runHeal, scratchDir, snapshotTree, writeQuad,
} from './support/p6-heal-fixtures.mjs';

const CASE_ID = 'tc_p6_heal_synth';
const TS = '1785000000000';
const D7_CODES = new Set([2, 4, 6, 64, 65]);
const SCRATCH = scratchDir('applypromote');
const { test, finish, assert } = makeRunner(
  'p6-heal-apply-promote',
  () => rmSync(SCRATCH, { recursive: true, force: true }),
);

const shaOf = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const jsonText = (v) => JSON.stringify(v, null, 2) + '\n';

/** 每个用例一套独立的 cases 根 + out-dir，互不串味。 */
function prepare(tag, steps = SCENARIOS.confirmedHarnessError) {
  const base = join(SCRATCH, tag);
  const casesDir = join(base, 'cases');
  const caseDir = join(casesDir, CASE_ID);
  const outDir = join(base, 'out');
  mkdirSync(caseDir, { recursive: true });
  const q = writeQuad(caseDir, { caseId: CASE_ID, steps });
  const eventsSha = shaOf(q.events);
  const locksPath = join(caseDir, 'entity-locks.frozen.json');
  writeFileSync(locksPath, jsonText(entityLocksFrozen({ caseId: CASE_ID, steps, eventsSha256: eventsSha })), 'utf8');
  writeFileSync(join(caseDir, 'expected.frozen.json'), jsonText(expectedFrozen({ caseId: CASE_ID, steps })), 'utf8');
  return {
    base, casesDir, caseDir, outDir, q, locksPath, eventsSha,
    driftDir: join(outDir, 'drift'),
    patch: join(outDir, 'drift', `${CASE_ID}.${TS}.patch.json`),
    candidate: join(outDir, 'drift', `${CASE_ID}.${TS}.events.candidate.json`),
    journal: join(outDir, 'drift', `${CASE_ID}.${TS}.promote.journal.json`),
  };
}

function propose(c) {
  return runHeal([
    CASE_ID,
    '--verdict', c.q.verdictPath,
    '--axes', c.q.axes,
    '--events', c.q.events,
    '--run-history', c.q.history,
    '--out-dir', c.outDir,
    '--ts', TS,
  ], { casesDir: c.casesDir });
}

const applyPatch = (c, patchPath) => runHeal(
  [CASE_ID, '--apply', '--patch', patchPath, '--out-dir', c.outDir, '--ts', TS],
  { casesDir: c.casesDir },
);
const promote = (c, candidatePath) => runHeal(
  [CASE_ID, '--promote', '--candidate', candidatePath, '--out-dir', c.outDir, '--ts', TS],
  { casesDir: c.casesDir },
);

function driftList(c) {
  if (!existsSync(c.driftDir)) return [];
  return readdirSync(c.driftDir).sort();
}

/** 人签补丁：填 signerId/signedAt/decision 并推进 status（对齐已冻 drift-patch 状态机）。 */
function signPatch(patchPath) {
  const patch = JSON.parse(readFileSync(patchPath, 'utf8'));
  patch.humanSignoff = { signedAt: '2026-07-28T12:00:00+08:00', signerId: 'Steven', decision: 'apply' };
  patch.status = 'signed';
  const signedPath = patchPath.replace(/\.patch\.json$/, '.patch.signed.json');
  writeFileSync(signedPath, jsonText(patch), 'utf8');
  return signedPath;
}

/** 重签：把冻结绑定改签到候选字节（= D5 的「人签绑定候选精确 sha256」）。 */
function resignLocksTo(c, targetPath, steps = SCENARIOS.confirmedHarnessError) {
  writeFileSync(c.locksPath, jsonText(entityLocksFrozen({
    caseId: CASE_ID, steps, eventsSha256: shaOf(targetPath), signedAt: '2026-07-28T12:30:00.000Z',
  })), 'utf8');
}

// ── A3a 未签补丁 --apply 必拒 ───────────────────────────────────────────────
await test('A3a 未签补丁 --apply → 拒 + 具名 HEAL_PATCH_UNSIGNED + 零候选产出', () => {
  const c = prepare('a3a-unsigned');
  const p = propose(c);
  assert(p.code === 0, `前置：提案须成功 exit 0，实得 ${p.code}\n${p.all.slice(0, 300)}`);
  assert(existsSync(c.patch), '前置：补丁须落盘');
  const res = applyPatch(c, c.patch); // 直接喂 proposed（未签）补丁
  assert(res.code !== 0, '未签补丁 --apply 绝不能成功（非就地 + 人签门，护栏 #5）');
  assert(D7_CODES.has(res.code),
    `拒绝码须落在 D7 冻结枚举 {2,4,6,64,65} 内，实得 ${res.code}\n${res.all.slice(0, 300)}`);
  assert(JSON.stringify(lastJson(res) || {}).includes('HEAL_PATCH_UNSIGNED'),
    `拒因须具名 HEAL_PATCH_UNSIGNED（plan S4）：${res.stdout.slice(-300)}`);
  assert(!existsSync(c.candidate), '未签路径不得产出候选旁文件');
});

// ── A3a 已签补丁 --apply → 候选旁文件 ───────────────────────────────────────
await test('A3a 已签补丁 --apply → exit 0 + outcome=applied-candidate + 候选旁文件 + 原 events 不动', () => {
  const c = prepare('a3a-signed');
  assert(propose(c).code === 0, '前置：提案须成功');
  const signed = signPatch(c.patch);
  const before = shaOf(c.q.events);
  const res = applyPatch(c, signed);
  assert(res.code === 0, `已签补丁 --apply 须 exit 0，实得 ${res.code}\n${res.all.slice(0, 400)}`);
  const j = lastJson(res);
  assert(j != null && j.outcome === 'applied-candidate',
    `outcome 必精确等于 applied-candidate（D7 六值全集），实得 ${JSON.stringify(j?.outcome)}`);
  assert(existsSync(c.candidate),
    `候选须落 ${CASE_ID}.${TS}.events.candidate.json（plan §3.5）；实得 drift/：${driftList(c).join(', ')}`);
  assert(shaOf(c.q.events) === before,
    'A3a：应用只产候选旁文件，原 events 字节必须一字不动（**不存在就地改写路径**，D5）');
  assert(res.stdout.includes(shaOf(c.candidate)),
    'A3a：候选 sha256 须输出（供人签绑定候选精确字节，D5）');
});

// ── A3b 候选篡改一字节 → --promote 拒 exit 6 且无文件被换 ────────────────────
await test('A3b 篡改候选一字节 --promote → exit 6 + 目录内无文件被替换', () => {
  const c = prepare('a3b-tamper');
  assert(propose(c).code === 0, '前置：提案须成功');
  const signed = signPatch(c.patch);
  assert(applyPatch(c, signed).code === 0, '前置：应用须成功产出候选');
  // 先按未篡改的候选重签（重签件就位），再篡改候选——只剩「候选 sha256 与人签绑定失配」一个变量。
  resignLocksTo(c, c.candidate);
  const raw = readFileSync(c.candidate, 'utf8');
  writeFileSync(c.candidate, raw.replace('atl_wf_p6heal', 'atl_wf_p6heaX'), 'utf8');
  assert(shaOf(c.candidate) !== undefined, '前置：候选须可读');

  const before = snapshotTree(c.caseDir);
  const res = promote(c, c.candidate);
  assert(res.code === 6,
    `候选 sha256 失配须 exit 6（D7：晋升阻断），实得 ${res.code}\n${res.all.slice(0, 400)}`);
  const d = diffSnapshots(before, snapshotTree(c.caseDir));
  assert(d.changed.length === 0 && d.removed.length === 0 && d.added.length === 0,
    `晋升阻断时 case 目录内不得有任何文件被替换/新增/删除：改 ${d.changed.join(',')} 删 ${d.removed.join(',')} 增 ${d.added.join(',')}`);
});

// ── A3b 重签缺失 → --promote 拒 exit 6 且无文件被换 ─────────────────────────
await test('A3b 重签缺失（冻结绑定仍指向旧 events）--promote → exit 6 + 无文件被替换', () => {
  const c = prepare('a3b-noresign');
  assert(propose(c).code === 0, '前置：提案须成功');
  const signed = signPatch(c.patch);
  assert(applyPatch(c, signed).code === 0, '前置：应用须成功产出候选');
  // 刻意不重签：entity-locks.frozen.json 的 eventsSha256 仍是 heal 前的旧 events 字节。
  const locks = JSON.parse(readFileSync(c.locksPath, 'utf8'));
  assert(locks.eventsSha256 === `sha256:${c.eventsSha}`, '前置：冻结绑定须仍钉在旧 events 上');
  const before = snapshotTree(c.caseDir);
  const res = promote(c, c.candidate);
  assert(res.code === 6,
    `重签缺失须 exit 6（D7：晋升阻断），实得 ${res.code}\n${res.all.slice(0, 400)}`);
  const d = diffSnapshots(before, snapshotTree(c.caseDir));
  assert(d.changed.length === 0 && d.removed.length === 0 && d.added.length === 0,
    `重签缺失时不得替换任何文件：改 ${d.changed.join(',')} 删 ${d.removed.join(',')} 增 ${d.added.join(',')}`);
});

// ── A3b 未封 journal 残留 → 一切 heal 子命令 fail-closed ────────────────────
await test('A3b 手工放一个未封 journal → 提案/应用/晋升三子命令一律 fail-closed exit 6', () => {
  const c = prepare('a3b-journal');
  assert(propose(c).code === 0, '前置：提案须成功（此时尚无 journal）');
  const signed = signPatch(c.patch);
  assert(applyPatch(c, signed).code === 0, '前置：应用须成功');
  resignLocksTo(c, c.candidate);

  // 未封 journal：登记了目标但没有终局封账（既非 receipt 封，也非 rolled-back 封）。
  mkdirSync(c.driftDir, { recursive: true });
  writeFileSync(c.journal, jsonText({
    schemaVersion: 1,
    artifactKind: 'heal-promote-journal',
    caseId: CASE_ID,
    stepId: 'atstep_1',
    tsToken: TS,
    status: 'open',
    sealed: false,
    targets: [{
      path: c.q.events,
      sha256Before: `sha256:${c.eventsSha}`,
      sha256After: `sha256:${shaOf(c.candidate)}`,
      backup: null,
    }],
  }), 'utf8');

  const before = snapshotTree(c.caseDir);
  const probes = [
    ['提案', propose(c)],
    ['应用', applyPatch(c, signed)],
    ['晋升', promote(c, c.candidate)],
  ];
  for (const [label, res] of probes) {
    assert(res.code === 6,
      `未封 journal 在场时「${label}」须 fail-closed exit 6（D5/D7），实得 ${res.code}\n${res.all.slice(0, 250)}`);
  }
  const d = diffSnapshots(before, snapshotTree(c.caseDir));
  assert(d.changed.length === 0 && d.removed.length === 0 && d.added.length === 0,
    `未封 journal 拦截期间不得动 case 目录任何字节：改 ${d.changed.join(',')} 删 ${d.removed.join(',')} 增 ${d.added.join(',')}`);
});

// ── 晋升正路：绑定齐备 → 五步事务 + journal + HealReceipt ───────────────────
await test('A3b 正路：候选未篡改 + 重签件就位 → exit 0 + outcome=promoted + journal 封账 + events 换成候选字节', () => {
  const c = prepare('a3b-happy');
  assert(propose(c).code === 0, '前置：提案须成功');
  const signed = signPatch(c.patch);
  assert(applyPatch(c, signed).code === 0, '前置：应用须成功');
  const candidateSha = shaOf(c.candidate);
  resignLocksTo(c, c.candidate);

  const res = promote(c, c.candidate);
  assert(res.code === 0, `绑定齐备的晋升须 exit 0，实得 ${res.code}\n${res.all.slice(0, 400)}`);
  const j = lastJson(res);
  assert(j != null && j.outcome === 'promoted',
    `outcome 必精确等于 promoted（D7 六值全集），实得 ${JSON.stringify(j?.outcome)}`);
  assert(shaOf(c.q.events) === candidateSha,
    'events 须由单 rename 切换成候选字节（D5 第三步）');
  assert(existsSync(c.journal),
    `晋升须留下 ${CASE_ID}.${TS}.promote.journal.json（plan §3.5）；实得 drift/：${driftList(c).join(', ')}`);
  const journal = JSON.parse(readFileSync(c.journal, 'utf8'));
  const targets = journal.targets || journal.registered || [];
  assert(Array.isArray(targets) && targets.length >= 1,
    'journal 须登记全部将被修改目标（events + 每个受影响绑定/发布指针），实得空');
  const text = JSON.stringify(journal);
  assert(text.includes(c.eventsSha) && text.includes(candidateSha),
    'journal 须记全部登记目标的前后 sha256（D5 逐件预存 + 前后哈希）');
  const receipt = driftList(c).filter((f) => f.includes('heal-receipt'));
  assert(receipt.length === 1,
    `晋升须以 HealReceipt 封 journal（plan §3.5 <caseId>.<ts>.heal-receipt.json）；实得 drift/：${driftList(c).join(', ')}`);
});

finish();
