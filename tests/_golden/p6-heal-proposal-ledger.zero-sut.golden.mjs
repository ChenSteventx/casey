#!/usr/bin/env node
// P6 heal 验收金牌 A2/A4（确定性重锚提案 + 证据元组台账）。
//
// 覆盖 plan §3 验收表：
//   A2 确证 HARNESS_ERROR → 补丁落盘、原 events sha256 不变；锚形状 = 回放消费形（D9 对照断言）
//   A4 同证据元组重调 → 幂等返回既有补丁；同一 {caseId,stepId} 不同元组第 2 次 → 升级 + 拒；
//      并发双进程同时提案 → 一成功一幂等、台账无丢行；异步骤各自首漂 → 互不触发升级
//
// 冻结依据：
//   - 产物路径 plan §3.5：<out-dir>/drift/<caseId>.<ts>.patch.json、<caseId>.ledger.jsonl；
//     <ts> 由 --ts 显式注入（金牌确定性）。
//   - outcome 字面 GRILL D7 六值全集；proposal 成功 = exit 0 + outcome=proposal-written。
//   - 锚形状对照已冻接缝 tests/_golden/schemas/drift-patch.schema.json 与
//     tests/_golden/fixtures/seams/drift-patch.fixture.json（D9「写读同形」：照抄现役消费形，
//     不发明新形状；withinRow 语境必须保留在锚里）。
//   - 升级拒的退出码取 D7「4 = 准入全拒，『无一步可自愈』的唯一编码」——同一步被升级即该步不可
//     自愈，单步处理（D11）下全案无步可愈，故落 4；D7 未逐字列举升级一项，此为按其自述语义推导。
//
// 纪律：spawn 真二进制，只认退出码 + 产物字节；临时产物落一次性目录，跑完清理。

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import {
  CASEY_CLI, NODE_EXE, SCENARIOS, TARGET_NAME, VOCAB_ATOM,
  lastJson, makeRunner, makeLoopRoot, runHeal, scratchDir, writeQuad,
} from './support/p6-heal-fixtures.mjs';
import { canonicalSignature } from '../../lib/drift-probe.mjs';

const CASE_ID = 'tc_p6_heal_synth';
const TS = '1785000000000';
const TS2 = '1785000111000';
const OUTCOMES = new Set([
  'proposal-written', 'applied-candidate', 'promoted',
  'reverified', 'reverify-routed-human', 'reverify-failed-rolled-back',
]);
const SCRATCH = scratchDir('proposal');
const CASES_DIR = join(SCRATCH, 'cases');
const LOOP = makeLoopRoot(SCRATCH);
const { test, finish, assert } = makeRunner(
  'p6-heal-proposal-ledger',
  () => rmSync(SCRATCH, { recursive: true, force: true }),
);

const shaOf = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const outDir = (tag) => join(SCRATCH, 'out', tag);
const driftDir = (tag) => join(outDir(tag), 'drift');
const patchPath = (tag, ts = TS) => join(driftDir(tag), `${CASE_ID}.${ts}.patch.json`);
const ledgerPath = (tag) => join(driftDir(tag), `${CASE_ID}.ledger.jsonl`);

function listDrift(tag) {
  if (!existsSync(driftDir(tag))) return [];
  return readdirSync(driftDir(tag)).sort();
}
function ledgerLines(tag) {
  if (!existsSync(ledgerPath(tag))) return [];
  return readFileSync(ledgerPath(tag), 'utf8').split('\n').filter((l) => l.trim());
}
function quad(tag, steps) {
  return writeQuad(join(SCRATCH, 'quad', tag), { caseId: CASE_ID, steps });
}
function proposeArgs(q, tag, ts = TS, extra = []) {
  return [
    CASE_ID,
    '--verdict', q.verdictPath,
    '--axes', q.axes,
    '--events', q.events,
    '--run-history', q.history,
    '--out-dir', outDir(tag),
    '--ts', ts,
    ...extra,
  ];
}
function propose(q, tag, ts = TS, extra = []) {
  return runHeal(proposeArgs(q, tag, ts, extra), { casesDir: CASES_DIR, loopKitRoot: LOOP.root });
}
function assertProposalWritten(res, tag, ts = TS) {
  assert(res.code === 0, `提案成功须 exit 0（D7），实得 ${res.code}\n${res.all.slice(0, 400)}`);
  const j = lastJson(res);
  assert(j != null, `stdout 末行须为单行 JSON（plan §3.5）：${JSON.stringify(res.stdout.slice(-200))}`);
  assert(j.outcome === 'proposal-written',
    `outcome 必精确等于 proposal-written（D7 六值全集），实得 ${JSON.stringify(j.outcome)}`);
  assert(existsSync(patchPath(tag, ts)),
    `补丁须落 ${CASE_ID}.${ts}.patch.json（plan §3.5，<ts> 由 --ts 注入）；实得 drift/：${listDrift(tag).join(', ')}`);
  return j;
}

// ── A2 确证 HARNESS_ERROR → 提案落盘 + 原 events 不动 + 锚为回放消费形 ────────
await test('A2 确证 HE 案 → exit 0 + outcome=proposal-written + 补丁落盘（--ts 确定性名）', () => {
  const tag = 'a2';
  const q = quad(tag, SCENARIOS.confirmedHarnessError);
  assert(q.verdict.steps.some((s) => s.verdict === 'HARNESS_ERROR'),
    '夹具自检：本案须含真裁判判出的 HARNESS_ERROR 步');
  const before = shaOf(q.events);
  const res = propose(q, tag);
  assertProposalWritten(res, tag);
  assert(shaOf(q.events) === before,
    'A2：写补丁前后原 events 字节 sha256 必须一字不变（非就地，护栏 #5）');
});

await test('A2 补丁 proposed 锚含 role/name/withinRow（D9 写读同形，对照已冻 drift-patch 接缝）', () => {
  const tag = 'a2';
  assert(existsSync(patchPath(tag)), '前置：A2 补丁须已落盘');
  const patch = JSON.parse(readFileSync(patchPath(tag), 'utf8'));
  assert(patch.status === 'proposed', `刚产出的补丁须 status=proposed，实得 ${JSON.stringify(patch.status)}`);
  assert(patch.humanSignoff === null, 'proposed 态 humanSignoff 须 null（人签前原 spec 一字不动）');
  assert(patch.caseId === CASE_ID && patch.stepId === 'atstep_1',
    `补丁须锚在目标步：实得 ${patch.caseId}/${patch.stepId}`);
  // 锚 = 回放器实际消费的定位形状（lib/replay-actions.mjs semanticLocator：role + accessibleName），
  // 且 withinRow 语境必须保留（GRILL D9）。
  const after = patch.locatorAfter || {};
  assert(after.strategy === 'role', `locatorAfter.strategy 须 role（重锚升语义策略、不得退化 coord），实得 ${JSON.stringify(after.strategy)}`);
  assert(after.role === 'button', `locatorAfter.role 须 button，实得 ${JSON.stringify(after.role)}`);
  assert(after.accessibleName === '删除', `locatorAfter.accessibleName 须「删除」，实得 ${JSON.stringify(after.accessibleName)}`);
  assert(typeof after.within === 'string' && after.within.includes(TARGET_NAME),
    `locatorAfter.within 须保留 withinRow 语境（含 ${TARGET_NAME}），实得 ${JSON.stringify(after.within)}`);
  const canonical = canonicalSignature(VOCAB_ATOM, TARGET_NAME);
  assert(patch.stableSignature && patch.stableSignature.canonical === canonical,
    `stableSignature.canonical 须等于探针规范签名 ${canonical}，实得 ${JSON.stringify(patch.stableSignature?.canonical)}`);
  assert(JSON.stringify(patch.stableSignature.before) === JSON.stringify(patch.stableSignature.after),
    'stableSignature.before 须 === after（签名变即非纯定位漂移，不得自愈）');
  const te = patch.triggerEvidence || {};
  assert(te.verdictRef && te.verdictRef.verdict === 'HARNESS_ERROR',
    'triggerEvidence.verdictRef.verdict 须 HARNESS_ERROR（自愈只消费裁定，护栏 #15）');
  assert(te.recordedLocatorMiss === true, '缺 recordedLocatorMiss===true 正向 miss 证据');
  assert(te.driftProbe && te.driftProbe.sameSignatureUniquePresent === true,
    '缺 driftProbe.sameSignatureUniquePresent===true 正向漂移证据（护栏 #13）');
});

await test('A2 台账以证据元组为键：三哈希齐备且与输入件字节吻合（D2）', () => {
  const tag = 'a2';
  const lines = ledgerLines(tag);
  assert(lines.length === 1, `首次提案后台账须恰好 1 行，实得 ${lines.length} 行`);
  const row = JSON.parse(lines[0]);
  const q = { events: join(SCRATCH, 'quad', tag, 'events.json'), axes: join(SCRATCH, 'quad', tag, 'axes.json'), verdictPath: join(SCRATCH, 'quad', tag, 'verdict.json') };
  const text = JSON.stringify(row);
  assert(text.includes(shaOf(q.verdictPath)), '台账行须含 verdictSha256（D2 证据元组）');
  assert(text.includes(shaOf(q.axes)), '台账行须含 axesSha256（D2 证据元组）');
  assert(text.includes(shaOf(q.events)), '台账行须含 eventsSha256（D2 证据元组）');
  assert(text.includes(CASE_ID) && text.includes('atstep_1'), '台账行须含 caseId 与 stepId（D2 证据元组）');
});

// ── A4 幂等：同证据元组重调 ─────────────────────────────────────────────────
await test('A4 同证据元组重调 → 幂等（同一补丁路径、台账不加新行、无升级）', () => {
  const tag = 'a4-idem';
  const q = quad(tag, SCENARIOS.confirmedHarnessError);
  const first = propose(q, tag);
  assertProposalWritten(first, tag);
  const filesAfterFirst = listDrift(tag);
  const patchSha = shaOf(patchPath(tag));

  // 同一证据、同一 --ts 重调：幂等返回既有补丁，不产新件、不记新行、不升级。
  const second = propose(q, tag);
  assert(second.code === 0, `同证据重调须幂等成功 exit 0，实得 ${second.code}\n${second.all.slice(0, 300)}`);
  const j2 = lastJson(second);
  assert(j2 != null && OUTCOMES.has(j2.outcome),
    `幂等重调的 outcome 须落在 D7 六值全集内（无 no-op 值），实得 ${JSON.stringify(j2?.outcome)}`);
  assert(!JSON.stringify(j2).includes('HEAL_FLAKY_ESCALATED'),
    'D2：同证据重调不计新漂移，绝不触发升级');
  assert(JSON.stringify(listDrift(tag)) === JSON.stringify(filesAfterFirst),
    `幂等重调不得新增/删除任何 drift 产物：前 ${filesAfterFirst.join(',')} / 后 ${listDrift(tag).join(',')}`);
  assert(shaOf(patchPath(tag)) === patchSha, '幂等重调不得改写既有补丁字节');
  assert(ledgerLines(tag).length === 1, `幂等重调后台账仍须 1 行，实得 ${ledgerLines(tag).length}`);
});

// ── A4 升级：同一 {caseId, stepId} 第 2 个不同元组 ───────────────────────────
await test('A4 同步骤第 2 个不同证据元组 → 拒 + reason 含 HEAL_FLAKY_ESCALATED + inbox 升级行', () => {
  const tag = 'a4-escalate';
  const q1 = quad(`${tag}-1`, SCENARIOS.confirmedHarnessError);
  assertProposalWritten(propose(q1, tag, TS), tag, TS);

  // 同一步（atstep_1）再漂一次，但证据元组不同（目标行名变 → events/axes/verdict 三哈希全变）。
  const q2 = writeQuad(join(SCRATCH, 'quad', `${tag}-2`), {
    caseId: CASE_ID,
    steps: [
      { stepId: 'atstep_0', intentId: 'intent_0', kind: 'pass' },
      { stepId: 'atstep_1', intentId: 'intent_1', kind: 'harness-error', targetName: 'atl_wf_p6heal_drift2' },
    ],
  });
  assert(shaOf(q2.events) !== shaOf(q1.events), '夹具自检：第 2 次证据元组必须与第 1 次不同');

  const inboxBefore = readFileSync(LOOP.inbox, 'utf8');
  const filesBefore = listDrift(tag);
  const res = propose(q2, tag, TS2);
  assert(res.code === 4,
    `同步骤第 2 个不同元组须拒——按 D7「4 = 无一步可自愈的唯一编码」，实得 ${res.code}\n${res.all.slice(0, 400)}`);
  assert(JSON.stringify(lastJson(res) || {}).includes('HEAL_FLAKY_ESCALATED'),
    `拒因须具名 HEAL_FLAKY_ESCALATED（plan S3）：${res.stdout.slice(-300)}`);
  assert(!existsSync(patchPath(tag, TS2)),
    '升级路径必须拒新补丁（plan S3：inbox 升级 + 拒新补丁）');
  const inboxAfter = readFileSync(LOOP.inbox, 'utf8');
  const extra = listDrift(tag).filter((f) => !filesBefore.includes(f));
  const inboxGrew = inboxAfter.length > inboxBefore.length && inboxAfter.includes(CASE_ID);
  const sideInbox = extra.some((f) => f.includes('inbox'));
  assert(inboxGrew || sideInbox,
    `升级须在 inbox 留下具名升级行（caseId=${CASE_ID}）；inbox 未增长且 drift/ 无 inbox 旁文件`);
});

// ── A4 并发：双进程同证据同时提案 ───────────────────────────────────────────
await test('A4 并发双进程同证据提案 → 一成功一幂等、台账行数正确无丢行', async () => {
  const tag = 'a4-concurrent';
  const q = quad(tag, SCENARIOS.confirmedHarnessError);
  mkdirSync(driftDir(tag), { recursive: true });
  const args = proposeArgs(q, tag);
  const spawnOne = () => new Promise((resolve) => {
    const child = spawn(NODE_EXE, [CASEY_CLI, 'heal', ...args], {
      cwd: process.cwd(),
      env: { ...process.env, AT_CASES_DIR: CASES_DIR, LOOP_KIT_ROOT: LOOP.root },
      encoding: 'utf8',
    });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr, all: stdout + stderr }));
  });
  const [a, b] = await Promise.all([spawnOne(), spawnOne()]);
  assert(a.code === 0 && b.code === 0,
    `并发两进程都须 exit 0（一写一幂等），实得 ${a.code}/${b.code}\n${a.all.slice(0, 250)}\n${b.all.slice(0, 250)}`);
  const outcomes = [lastJson(a), lastJson(b)].map((j) => j && j.outcome);
  assert(outcomes.every((o) => OUTCOMES.has(o)),
    `并发两进程 outcome 都须落在 D7 六值全集内，实得 ${JSON.stringify(outcomes)}`);
  assert(outcomes.includes('proposal-written'),
    `并发至少一方须报 proposal-written，实得 ${JSON.stringify(outcomes)}`);
  const patches = listDrift(tag).filter((f) => f.endsWith('.patch.json'));
  assert(patches.length === 1, `并发只应产 1 份补丁（同证据幂等），实得 ${patches.join(', ')}`);
  assert(ledgerLines(tag).length === 1,
    `并发后台账须恰好 1 行（O_EXCL 锁内读改写，杜绝双写丢行），实得 ${ledgerLines(tag).length}`);
  for (const line of ledgerLines(tag)) {
    let ok = true;
    try { JSON.parse(line); } catch { ok = false; }
    assert(ok, `台账行须逐行合法 JSON（原子 append，无半行残留）：${line.slice(0, 120)}`);
  }
});

// ── A4 异步骤各自首漂互不触发升级 ───────────────────────────────────────────
await test('A4 不同步骤各自首漂 → 都出补丁、互不触发升级', () => {
  const tag = 'a4-multistep';
  const q = quad(tag, SCENARIOS.threeHarnessErrorSteps);
  const targets = ['atstep_1', 'atstep_2', 'atstep_3'];
  const stamps = ['1785000200000', '1785000300000', '1785000400000'];
  targets.forEach((stepId, i) => {
    // 单步处理（D11）：--step 显式指定，一次调用只处理一个步。
    const res = propose(q, tag, stamps[i], ['--step', stepId]);
    assertProposalWritten(res, tag, stamps[i]);
    assert(!JSON.stringify(lastJson(res)).includes('HEAL_FLAKY_ESCALATED'),
      `步 ${stepId} 是本步首漂，不得因别的步已有补丁而升级（plan S3：不同步骤各自首漂不互相触发）`);
  });
  const patches = listDrift(tag).filter((f) => f.endsWith('.patch.json'));
  assert(patches.length === 3, `三个不同步骤各自首漂须各出一份补丁，实得 ${patches.join(', ')}`);
  assert(ledgerLines(tag).length === 3, `台账须 3 行（每步一条），实得 ${ledgerLines(tag).length}`);
});

finish();
