#!/usr/bin/env node
// P6 heal 验收金牌（S7 熔断接线，D8 v4 case 级计量）——A5 换签正式件。
// 换签记账：原冻结件夹具把「三次纯提案调用」误当三个完整周期，与 D8「完整 heal 周期」
// 语义互斥（与 A4 冲突，五轮计划评审漏检、金牌铸造期逮出）；Steven 2026-07-29 批准按
// fable 裁读换签（checksumAmendment 见 loop/prd-p6-heal.json），原件字节存档
// tests/_golden/p6-heal-breaker.zero-sut.golden.mjs.pre-a5-amendment.archive.gz。
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  NODE_EXE, ROOT, entityLocksFrozen, expectedFrozen, lastJson, makeLoopRoot,
  makeRunner, resetProof, runHeal, scratchDir, writeQuad,
} from './support/p6-heal-fixtures.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SEAM = resolve(HERE, 'support', 'p6-heal-runtime-seam.mjs');
const CASE_ID = 'tc_p6_heal_synth';
// 首步绿（可访问名「确定」，复核期专供掐断制造非目标步回归）+ 三个确证 HARNESS_ERROR 步。
const STEPS = [
  { stepId: 'atstep_0', intentId: 'intent_0', kind: 'pass', label: '确定' },
  { stepId: 'atstep_1', intentId: 'intent_1', kind: 'harness-error' },
  { stepId: 'atstep_2', intentId: 'intent_2', kind: 'harness-error', targetName: 'atl_wf_p6heal_2' },
  { stepId: 'atstep_3', intentId: 'intent_3', kind: 'harness-error', targetName: 'atl_wf_p6heal_3' },
];
const TARGET_STEPS = ['atstep_1', 'atstep_2', 'atstep_3'];
const SCRATCH = scratchDir('breaker-v2');
const STATE_FILE = '.heal-breaker.json';

// 真件基线：本金牌任何时候都不得改动它们。
const REAL_STATE = join(ROOT, 'loop', '.breaker-state.json');
const REAL_INBOX = join(ROOT, 'loop', 'inbox.md');
const shaOrNull = (p) => (existsSync(p) ? createHash('sha256').update(readFileSync(p)).digest('hex') : null);
const REAL_BEFORE = { state: shaOrNull(REAL_STATE), inbox: shaOrNull(REAL_INBOX) };

const { test, finish, assert } = makeRunner(
  'p6-heal-breaker-v2',
  () => rmSync(SCRATCH, { recursive: true, force: true }),
);

const jsonText = (v) => JSON.stringify(v, null, 2) + '\n';
const shaOf = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

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
  // 复位证明件在场 = 复核真跑起来（D3）；缺件会直接 route:human，那是**终局**（有进展），
  // 空转周期就凑不出来了——A5 路径的前提之一。
  writeFileSync(join(caseDir, 'reset-proof.json'), jsonText(resetProof({ caseId: CASE_ID })), 'utf8');
  const loop = makeLoopRoot(base);
  return { base, casesDir, caseDir, outDir, locksPath, q, loop, driftDir: join(outDir, 'drift') };
}

const proofPathOf = (c) => join(c.caseDir, 'reset-proof.json');
const dropResetProof = (c) => rmSync(proofPathOf(c), { force: true });
const putResetProof = (c) => writeFileSync(proofPathOf(c), jsonText(resetProof({ caseId: CASE_ID })), 'utf8');
const ledgerOf = (c) => JSON.parse(readFileSync(join(c.caseDir, STATE_FILE), 'utf8'));

/** 人重签绑定件到**当下 events 字节**（对称回滚会把绑定件退回它自己那次晋升前的态）。 */
function resignLocksToEvents(c, signedAt) {
  writeFileSync(c.locksPath, jsonText(entityLocksFrozen({
    caseId: CASE_ID, steps: STEPS, eventsSha256: shaOf(c.q.events), signedAt,
  })), 'utf8');
}

/** 纯提案一次（不签、不应用——周期没走完，按 D8 不计轮）。 */
function propose(c, stepId, ts) {
  return runHeal([
    CASE_ID,
    '--verdict', c.q.verdictPath,
    '--axes', c.q.axes,
    '--events', c.q.events,
    '--run-history', c.q.history,
    '--step', stepId,
    '--out-dir', c.outDir,
    '--ts', ts,
  ], { casesDir: c.casesDir, loopKitRoot: c.loop.root });
}

const reverify = (c, receipt, ts, scenario) => runHeal(
  [CASE_ID, '--reverify', '--receipt', receipt, '--out-dir', c.outDir, '--ts', ts],
  { casesDir: c.casesDir, loopKitRoot: c.loop.root, seam: SEAM, seamScenario: scenario },
);

/** 剧本：掐掉非目标绿步「确定」的定位 → 全案出现非目标步新回归 → 复核必判 FAILED。 */
function writeRegressionScenario(c) {
  const p = join(c.base, 'seam-regress.json');
  writeFileSync(p, jsonText({ defaultCount: 1, byAccessibleName: { 确定: { count: 0 } } }), 'utf8');
  return p;
}

/** 剧本：全部定位可解析 → 目标步修好、非目标步不回归 → 复核判通过（终局 reverified）。 */
function writeHappyScenario(c) {
  const p = join(c.base, 'seam-happy.json');
  writeFileSync(p, jsonText({ defaultCount: 1 }), 'utf8');
  return p;
}

const artifactsOf = (c, ts) => ({
  patch: join(c.driftDir, `${CASE_ID}.${ts}.patch.json`),
  signed: join(c.driftDir, `${CASE_ID}.${ts}.patch.signed.json`),
  candidate: join(c.driftDir, `${CASE_ID}.${ts}.events.candidate.json`),
  receipt: join(c.driftDir, `${CASE_ID}.${ts}.heal-receipt.json`),
});

/**
 * 一个**完整** heal 周期：提案 → 人签 → 应用产候选 → 重签绑定到候选 → 晋升 → 复核。
 * 复核终局由剧本决定（回归剧本 → rolled-back 空转；happy 剧本 → reverified 终局；
 * 撤掉复位证明件 → route:human 终局）。回复核那一步的结果，退出码与末行 JSON 由调用方断言。
 */
function fullCycle(c, stepId, ts, scenario) {
  const f = artifactsOf(c, ts);
  const p = propose(c, stepId, ts);
  assert(p.code === 0, `周期前置：步 ${stepId} 提案须 exit 0，实得 ${p.code}\n${p.all.slice(0, 300)}`);

  const patch = JSON.parse(readFileSync(f.patch, 'utf8'));
  patch.humanSignoff = { signedAt: '2026-07-28T12:00:00+08:00', signerId: 'Steven', decision: 'apply' };
  patch.status = 'signed';
  writeFileSync(f.signed, jsonText(patch), 'utf8');

  const a = runHeal([CASE_ID, '--apply', '--patch', f.signed, '--out-dir', c.outDir, '--ts', ts],
    { casesDir: c.casesDir, loopKitRoot: c.loop.root });
  assert(a.code === 0, `周期前置：步 ${stepId} 应用须 exit 0，实得 ${a.code}\n${a.all.slice(0, 300)}`);

  // 人签绑定候选精确 sha256（= plan §3.5 补钉②的「重签件就位」）。
  writeFileSync(c.locksPath, jsonText(entityLocksFrozen({
    caseId: CASE_ID, steps: STEPS, eventsSha256: shaOf(f.candidate), signedAt: '2026-07-28T12:30:00.000Z',
  })), 'utf8');

  const pr = runHeal([
    CASE_ID, '--promote', '--candidate', f.candidate, '--patch', f.signed,
    '--out-dir', c.outDir, '--ts', ts,
  ], { casesDir: c.casesDir, loopKitRoot: c.loop.root });
  assert(pr.code === 0, `周期前置：步 ${stepId} 晋升须 exit 0，实得 ${pr.code}\n${pr.all.slice(0, 400)}`);
  assert(existsSync(f.receipt), `周期前置：步 ${stepId} 晋升须产 HealReceipt`);
  return reverify(c, f.receipt, ts, scenario);
}

function driftList(c) {
  if (!existsSync(c.driftDir)) return [];
  return readdirSync(c.driftDir).sort();
}

// ── A5 三个不同步骤各走一个完整周期 → 第 3 个周期跳闸 ──────────────────────────
await test('A5 同一 case 三个不同步骤各走一个完整周期（复核回滚收尾）→ 第 3 个周期 exit 2 + inbox', () => {
  const c = prepare('a5');
  const scenario = writeRegressionScenario(c);
  const stamps = ['1785000100000', '1785000200000', '1785000300000'];
  const results = TARGET_STEPS.map((stepId, i) => fullCycle(c, stepId, stamps[i], scenario));

  // 前两个周期：空转但未越限——回滚终局不算进展，也还不到 3 轮。
  results.slice(0, 2).forEach((res, i) => {
    assert(res.code === 0,
      `第 ${i + 1} 个周期尚未越限，复核失败但回滚成功 = 命令成功（D7），须 exit 0，实得 ${res.code}\n${res.all.slice(0, 400)}`);
    const j = lastJson(res);
    assert(j != null && j.outcome === 'reverify-failed-rolled-back',
      `第 ${i + 1} 个周期须是一个完整无终局周期（outcome=reverify-failed-rolled-back），实得 ${JSON.stringify(j?.outcome)}`);
  });

  const third = results[2];
  assert(third.code === 2,
    `第 3 个完整周期连续无终局 receipt 须跳闸 exit 2（D7：2=熔断跳闸；D8 case 级计量），实得 ${third.code}\n${third.all.slice(0, 500)}`);
  const j3 = lastJson(third);
  assert(j3 != null && j3.reason === 'HEAL_BREAKER_TRIPPED',
    `跳闸须以具名拒因 HEAL_BREAKER_TRIPPED 收场，实得 ${JSON.stringify(j3)}`);
  assert(j3.outcome == null, '跳闸不是成功命令，末行 JSON 不得报任何成功 outcome');

  // 跳闸态与 inbox 的落盘次序：跳闸态必须已在盘上，且 inbox 留痕与账内登记一致。
  const led = ledgerOf(c);
  assert(led.tripped && led.tripped.reason === 'HEAL_BREAKER_TRIPPED' && led.tripped.rounds === 3,
    `轮账须先落定跳闸态（rename 成功才算跳闸），实得 ${JSON.stringify(led.tripped)}`);
  assert(led.tripped.escalationPending === false && Array.isArray(led.tripped.inbox) && led.tripped.inbox.length >= 1,
    `inbox 写成后须回填落点并清 escalationPending，实得 ${JSON.stringify(led.tripped).slice(0, 200)}`);

  const inbox = readFileSync(c.loop.inbox, 'utf8');
  assert(inbox.includes(CASE_ID),
    `跳闸须在隔离 inbox 留下具名记录（含 caseId=${CASE_ID}），实得：${inbox.slice(0, 300)}`);
  assert(inbox.includes('熔断'), `跳闸的 inbox 行须自述是熔断，实得：${inbox.slice(0, 300)}`);

  // 三个周期确实各走完了全链——否则 A5 路径不可达（补丁/候选/journal/收据都得在）。
  const files = driftList(c);
  for (const [suffix, label] of [
    ['.patch.json', '补丁'], ['.events.candidate.json', '候选'],
    ['.promote.journal.json', '晋升 journal'], ['.heal-receipt.json', '晋升收据'],
  ]) {
    const n = files.filter((f) => f.endsWith(suffix)).length;
    assert(n >= 3, `A5 三个完整周期要求各步都走完全链，${label}须 ≥3 件，实得 ${n}：${files.join(', ')}`);
  }
});

// ── 跳闸后一切 heal 子命令一律 exit 2（四路各一断言；直至人工复位）───────────────
await test('A5 跳闸后同 case 的 propose/apply/promote/reverify 一律 exit 2；删轮账即复位', () => {
  const c = prepare('a5-latch');
  const scenario = writeRegressionScenario(c);
  const stamps = ['1785000500000', '1785000600000', '1785000700000'];
  TARGET_STEPS.forEach((stepId, i) => fullCycle(c, stepId, stamps[i], scenario));
  const last = artifactsOf(c, stamps[2]);

  // 「一切子命令」是逐路兑现的承诺：四条路各钉一次，别只测提案。
  const routes = [
    ['propose', () => propose(c, 'atstep_1', '1785000800000')],
    ['apply', () => runHeal([CASE_ID, '--apply', '--patch', last.signed, '--out-dir', c.outDir, '--ts', '1785000810000'],
      { casesDir: c.casesDir, loopKitRoot: c.loop.root })],
    ['promote', () => runHeal([CASE_ID, '--promote', '--candidate', last.candidate, '--patch', last.signed,
      '--out-dir', c.outDir, '--ts', '1785000820000'], { casesDir: c.casesDir, loopKitRoot: c.loop.root })],
    ['reverify', () => reverify(c, last.receipt, '1785000830000', scenario)],
  ];
  let statePath = join(c.caseDir, STATE_FILE);
  for (const [name, run] of routes) {
    const res = run();
    assert(res.code === 2, `跳闸后同 case 的 --${name} 也须 exit 2，实得 ${res.code}\n${res.all.slice(0, 300)}`);
    const j = lastJson(res);
    assert(j != null && j.reason === 'HEAL_BREAKER_TRIPPED',
      `--${name} 的跳闸拒绝须具名 HEAL_BREAKER_TRIPPED，实得 ${JSON.stringify(j)}`);
    if (typeof j.breakerState === 'string') statePath = j.breakerState;
  }

  // 复位姿势 = 删轮账旁账文件（唯一，人工动手；实现不提供自动复位）。
  assert(existsSync(statePath), `轮账须落在 case 根（换 --out-dir 绕不开），实得 ${statePath}`);
  rmSync(statePath, { force: true });
  const reset = propose(c, 'atstep_1', '1785000900000');
  assert(reset.code !== 2, `删轮账后须解除熔断，实得仍 exit ${reset.code}\n${reset.all.slice(0, 300)}`);
});

// ── 负控：纯提案调用不是完整周期，绝不计轮 ────────────────────────────────────
await test('A5 负控：三次纯提案（三个不同步骤）不构成完整周期 → 不计轮、不跳闸', () => {
  const c = prepare('a5-proposeonly');
  const stamps = ['1785001100000', '1785001200000', '1785001300000'];
  TARGET_STEPS.forEach((stepId, i) => {
    const res = propose(c, stepId, stamps[i]);
    assert(res.code === 0,
      `纯提案轮须 exit 0（补丁产出后在等人签，周期未走完），第 ${i + 1} 次实得 ${res.code}\n${res.all.slice(0, 300)}`);
    const j = lastJson(res);
    assert(j != null && j.outcome === 'proposal-written',
      `第 ${i + 1} 次纯提案的 outcome 须是 proposal-written，实得 ${JSON.stringify(j?.outcome)}`);
  });
  assert(!existsSync(join(c.caseDir, STATE_FILE)),
    'D8：纯提案不构成完整 heal 周期，绝不得记进熔断轮账');
  const inbox = readFileSync(c.loop.inbox, 'utf8');
  assert(!inbox.includes('熔断'), `纯提案不得写熔断记录，实得 inbox：${inbox.slice(0, 200)}`);
});

// ── 负控：终局 receipt 即算进展，连击清零（route:human 与 reverified 两分支各一）──
await test('A5 负控：中途出现 route:human 终局 receipt → 连击清零，后续周期不得立刻跳闸', () => {
  const c = prepare('a5-progress');
  const scenario = writeRegressionScenario(c);
  // 第 1、2 个周期空转（复位证明件在场，复核真跑起来但被非目标回归判败 → 回滚）。
  fullCycle(c, 'atstep_1', '1785002100000', scenario);
  fullCycle(c, 'atstep_2', '1785002200000', scenario);
  assert(ledgerOf(c).idleRounds.length === 2, '前置：须先攒到 2 轮空转');
  // 第 3 个周期：撤掉复位证明件 → 复核 route:human = 终局 receipt = 有进展，须 exit 0 且不跳闸。
  dropResetProof(c);
  const third = fullCycle(c, 'atstep_3', '1785002300000', scenario);
  assert(third.code === 0,
    `route:human 是终局（进展），第 3 个周期须 exit 0 而非跳闸，实得 ${third.code}\n${third.all.slice(0, 400)}`);
  const j = lastJson(third);
  assert(j != null && j.outcome === 'reverify-routed-human',
    `第 3 个周期须落 route:human 终局，实得 ${JSON.stringify(j?.outcome)}`);
  const led = ledgerOf(c);
  assert(led.idleRounds.length === 0 && led.tripped === null,
    `终局须把连击清零，实得 idleRounds=${led.idleRounds.length} tripped=${JSON.stringify(led.tripped)}`);
  const inbox = readFileSync(c.loop.inbox, 'utf8');
  assert(!inbox.includes('熔断'), `有进展就不得跳闸，实得 inbox：${inbox.slice(0, 300)}`);
});

await test('A5 负控：中途出现 reverified（healed→PASS）终局 → 同样清零，不得跳闸', () => {
  const c = prepare('a5-progress-pass');
  const regress = writeRegressionScenario(c);
  fullCycle(c, 'atstep_1', '1785002500000', regress);
  fullCycle(c, 'atstep_2', '1785002600000', regress);
  assert(ledgerOf(c).idleRounds.length === 2, '前置：须先攒到 2 轮空转');
  // 第 3 个周期换 happy 剧本：目标步转 PASS 且无非目标步回归 → 终局 reverified。
  const third = fullCycle(c, 'atstep_3', '1785002700000', writeHappyScenario(c));
  assert(third.code === 0,
    `healed→PASS 是终局（进展），第 3 个周期须 exit 0 而非跳闸，实得 ${third.code}\n${third.all.slice(0, 400)}`);
  const j = lastJson(third);
  assert(j != null && j.outcome === 'reverified',
    `第 3 个周期须落 reverified 终局，实得 ${JSON.stringify(j?.outcome)}`);
  const led = ledgerOf(c);
  assert(led.idleRounds.length === 0 && led.lastProgress && led.lastProgress.outcome === 'reverified',
    `reverified 同样是 D8 的进展判据，须清零并记进展，实得 ${JSON.stringify(led.lastProgress)}`);
  assert(!readFileSync(c.loop.inbox, 'utf8').includes('熔断'), '有进展就不得跳闸');
});

// ── 负控：同 cycleKey 重复复核不计第二轮，旧终局重放不得洗掉连击 ─────────────────
await test('A5 负控：重放同一份晋升收据（只换 --ts）→ 不计第二轮、不再次清零连击', async () => {
  const c = prepare('a5-idem');
  const scenario = writeRegressionScenario(c);
  const tsA = '1785003100000';
  const tsB = '1785003200000';
  const tsReplay = '1785003300000';

  // 周期 A：撤复位证明件 → route:human 终局（拿到一份可被重放的终局收据）。
  dropResetProof(c);
  const a = fullCycle(c, 'atstep_1', tsA, scenario);
  const ja = lastJson(a);
  assert(a.code === 0 && ja != null && ja.outcome === 'reverify-routed-human',
    `前置：周期 A 须落 route:human 终局，实得 exit ${a.code} / ${JSON.stringify(ja?.outcome)}`);

  // 周期 B：铺回复位证明件 → 空转一轮（连击 = 1）。
  putResetProof(c);
  const b = fullCycle(c, 'atstep_2', tsB, scenario);
  assert(b.code === 0 && lastJson(b)?.outcome === 'reverify-failed-rolled-back',
    `前置：周期 B 须空转一轮，实得 exit ${b.code}\n${b.all.slice(0, 300)}`);
  const before = ledgerOf(c);
  assert(before.idleRounds.length === 1, `前置：连击须为 1，实得 ${before.idleRounds.length}`);

  // 周期 B 的对称回滚把绑定件退回它自己的晋升前态 → 人重签到当下 events 字节再重放。
  resignLocksToEvents(c, '2026-07-28T14:00:00.000Z');
  dropResetProof(c);
  const replay = reverify(c, artifactsOf(c, tsA).receipt, tsReplay, scenario);
  assert(replay.code === 0,
    `重放同一份晋升收据仍是一次合法复核（终局），须 exit 0，实得 ${replay.code}\n${replay.all.slice(0, 400)}`);
  assert(lastJson(replay)?.outcome === 'reverify-routed-human',
    `重放须仍落 route:human 终局，实得 ${JSON.stringify(lastJson(replay)?.outcome)}`);

  const after = ledgerOf(c);
  assert(after.idleRounds.length === 1,
    `旧终局重放绝不得把连击洗回 0（否则「route:human 一次后换 --ts 反复重放」= 熔断永不跳闸），`
    + `实得 idleRounds=${after.idleRounds.length}`);
  assert(after.lastProgress != null && after.lastProgress.tsToken === tsA,
    `同 cycleKey 重放须整账一字不动（幂等先于终局），lastProgress 实得 ${JSON.stringify(after.lastProgress)}`);
  // 幂等键三段（caseId|stepId|晋升收据哈希）须全非空：route:human 分支的复核结果不带
  // targetStep，stepId 必须由晋升收据兜底补上，否则同 case 的不同周期可能撞同键。
  assert(after.lastProgress.stepId === 'atstep_1' && typeof after.lastProgress.cycleKey === 'string'
    && after.lastProgress.cycleKey.length === 64,
    `route:human 的进展记录须带具名 stepId 与完整 cycleKey，实得 ${JSON.stringify(after.lastProgress)}`);
  assert(after.tripped === null, '重放不得触发跳闸');
});

// ── 负控：轮账破损 / 不变量被破坏 → 一律 exit 2（fail-closed，宁跳勿放）──────────
await test('A5 负控：轮账破损（tripped 非法）→ 任一 heal 子命令 exit 2', () => {
  const c = prepare('a5-corrupt');
  writeFileSync(join(c.caseDir, STATE_FILE), jsonText({
    schemaVersion: 1,
    artifactKind: 'heal-breaker-state',
    caseId: CASE_ID,
    idleRounds: [],
    lastProgress: null,
    tripped: 'corrupt',
  }), 'utf8');
  const res = propose(c, 'atstep_1', '1785004100000');
  assert(res.code === 2,
    `破损轮账须 fail-closed 落 exit 2（证不出「还没到 3 轮」就不许继续自愈），实得 ${res.code}\n${res.all.slice(0, 300)}`);
  const j = lastJson(res);
  assert(j != null && j.reason === 'HEAL_BREAKER_LEDGER_BROKEN',
    `破损轮账须具名 HEAL_BREAKER_LEDGER_BROKEN，实得 ${JSON.stringify(j)}`);
});

await test('A5 负控：轮账不变量破坏（三轮已记却未记跳闸态）→ 按已跳闸处置 exit 2', () => {
  const c = prepare('a5-invariant');
  const rounds = [1, 2, 3].map((i) => ({
    cycleKey: `cyclekey_${i}`,
    stepId: `atstep_${i}`,
    tsToken: `178500420000${i}`,
    outcome: 'reverify-failed-rolled-back',
    at: `2026-07-28T0${i}:00:00.000Z`,
  }));
  writeFileSync(join(c.caseDir, STATE_FILE), jsonText({
    schemaVersion: 1,
    artifactKind: 'heal-breaker-state',
    caseId: CASE_ID,
    idleRounds: rounds,
    lastProgress: null,
    progressKeys: [],
    tripped: null,
  }), 'utf8');
  const res = propose(c, 'atstep_1', '1785004300000');
  assert(res.code === 2,
    `「已满 3 轮却没跳闸」是不变量破坏，须按已跳闸处置 exit 2，实得 ${res.code}\n${res.all.slice(0, 300)}`);
  const j = lastJson(res);
  assert(j != null && j.reason === 'HEAL_BREAKER_TRIPPED',
    `不变量破坏须按已跳闸具名收场（宁跳勿放），实得 ${JSON.stringify(j)}`);
});

// ── 负控：并发两次复核收口，轮账不得丢更新 ────────────────────────────────────
// 为什么在库面而不在 CLI 面测：复核收口的记账发生在**晋升锁释放之后**（bin/heal.mjs 的
// 调用位置），所以并发窗口就在 recordHealCycle 自己身上；两个子进程压到同一起跑线，正是
// 「两个不同晋升收据并发复核」的最小复现。CLI 面的并发另有晋升锁串行化，测不出这条。
const RECORD_CHILD = join(SCRATCH, 'record-child.mjs');
writeFileSync(RECORD_CHILD, [
  "import { recordHealCycle } from '" + pathToFileURL(join(ROOT, 'lib', 'heal', 'breaker.mjs')).href + "';",
  'const [caseDir, caseId, stepId, cycleKey, startAt, driftDir] = process.argv.slice(2);',
  '// 起跑线：把两个进程的「读改写」压进同一瞬间。',
  'while (Date.now() < Number(startAt)) { /* spin */ }',
  'try {',
  "  const r = recordHealCycle({ caseDir, caseId, stepId, cycleKey, tsToken: String(Date.now()),",
  "    outcome: 'reverify-failed-rolled-back', driftDir });",
  "  process.stdout.write(JSON.stringify(r) + '\\n');",
  '} catch (e) {',
  "  process.stdout.write(JSON.stringify({ err: e.reason }) + '\\n');",
  '  process.exit(2);',
  '}',
].join('\n'), 'utf8');

async function raceRecord(tag, cycleKeys) {
  const caseDir = join(SCRATCH, `race-${tag}`);
  mkdirSync(caseDir, { recursive: true });
  const startAt = String(Date.now() + 800);
  const kids = cycleKeys.map((key, i) => new Promise((res) => {
    const child = spawn(NODE_EXE, [
      RECORD_CHILD, caseDir, CASE_ID, `atstep_${i + 1}`, key, startAt, join(caseDir, 'drift'),
    ], { encoding: 'utf8' });
    let out = '';
    child.stdout.on('data', (d) => { out += String(d); });
    child.on('close', (code) => res({ code, out: out.trim() }));
  }));
  const results = await Promise.all(kids);
  const statePath = join(caseDir, STATE_FILE);
  return {
    results,
    state: existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : null,
  };
}

await test('A5 负控：两个不同晋升收据并发复核 → 两轮都记上（读改写须在锁内，绝不丢更新）', async () => {
  const { results, state } = await raceRecord('diff', ['cyclekey_a', 'cyclekey_b']);
  assert(results.every((r) => r.code === 0),
    `并发两次记账都该记成（互斥是等待不是失败），实得 ${JSON.stringify(results)}`);
  assert(state != null && state.idleRounds.length === 2,
    `并发的两个不同 cycleKey 必须各记一轮（丢更新 = 熔断计数永远到不了 3），`
    + `实得 ${JSON.stringify(state && state.idleRounds)}`);
  assert(new Set(state.idleRounds.map((r) => r.cycleKey)).size === 2, '两轮须是两个不同 cycleKey');
});

await test('A5 负控：同一份晋升收据并发双复核 → 只记一轮（幂等在锁内判）', async () => {
  const { results, state } = await raceRecord('same', ['cyclekey_same', 'cyclekey_same']);
  assert(results.every((r) => r.code === 0), `并发两次记账都该正常返回，实得 ${JSON.stringify(results)}`);
  assert(state != null && state.idleRounds.length === 1,
    `同 cycleKey 并发重复复核只算一轮（D8 同证据幂等），实得 ${JSON.stringify(state && state.idleRounds)}`);
});

// ── 隔离取证：仓内真 breaker 状态与真 inbox 一字未动（冻结件原样保留）──────────
await test('A5 隔离取证：仓内真 loop/.breaker-state.json 与 loop/inbox.md 字节未变', () => {
  assert(shaOrNull(REAL_STATE) === REAL_BEFORE.state,
    '金牌绝不得改动仓内真 breaker 状态文件（熔断状态必须走独立临时 loop 根）');
  assert(shaOrNull(REAL_INBOX) === REAL_BEFORE.inbox,
    '金牌绝不得改动仓内真 loop/inbox.md');
});

finish();
