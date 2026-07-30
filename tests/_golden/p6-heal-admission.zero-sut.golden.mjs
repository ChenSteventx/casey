#!/usr/bin/env node
// P6 heal 验收金牌 A1/A6/A8（准入门 + 血缘互证 fail-closed）。
//
// 覆盖 plan §3 验收表：
//   A1 喂 SUT_DEFECT/NEEDS_HUMAN 步 → 准入拒、无补丁、exit 4 + 逐步具名拒因
//   A8 喂全绿 verdict（干净案）→ exit 4 + reason=NO_HARNESS_ERROR_STEPS、零产物
//   A6 词表外原子/证据残缺/互证失配 → 具名拒因 fail-closed；
//      定位含未投影字段（fallbackCss）→ 拒 HEAL_LINEAGE_UNVERIFIABLE；
//      纯语义定位 A/B 步集失配 → 拒 HEAL_INPUT_PAIR_MISMATCH
//   GRILL D7 冻结码表：4=准入全拒（「无一步可自愈」的唯一编码）；65=输入畸形。
//
// 纪律：spawn 真二进制 `node bin/casey.mjs heal ...`，只认退出码 + 产物字节 + stdout 末行
// 结构化 JSON（plan §3.5 三键 {mode,outcome,reason}）；具名拒因只在末行结构化 JSON 内核对，
// 不在自由散文里 grep。四件套由 support/p6-heal-fixtures.mjs 用现役生产投影合成，verdict 一律
// 由真 bin/verdict.mjs 跑出——绝不倒着裁到预定裁定。
// 临时产物落本金牌自建的一次性目录，跑完清理；零浏览器、零网络、零真 SUT、不读凭据。

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SCENARIOS, jsonMentions, lastJson, makeRunner, runHeal, scratchDir, writeQuad,
} from './support/p6-heal-fixtures.mjs';

const CASE_ID = 'tc_p6_heal_synth';
const TS = '1785000000000';
const SCRATCH = scratchDir('admission');
const CASES_DIR = join(SCRATCH, 'cases');
const { test, finish, assert } = makeRunner(
  'p6-heal-admission',
  () => rmSync(SCRATCH, { recursive: true, force: true }),
);

const outDir = (tag) => join(SCRATCH, 'out', tag);
const shaOf = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

function driftFiles(tag) {
  const d = join(outDir(tag), 'drift');
  if (!existsSync(d)) return [];
  return readdirSync(d);
}

function quad(tag, steps) {
  return writeQuad(join(SCRATCH, 'quad', tag), { caseId: CASE_ID, steps });
}

function proposeArgs(q, tag) {
  return [
    CASE_ID,
    '--verdict', q.verdictPath,
    '--axes', q.axes,
    '--events', q.events,
    '--run-history', q.history,
    '--out-dir', outDir(tag),
    '--ts', TS,
  ];
}

// 准入拒绝路径的共同不变量：exit 4 + 末行结构化 JSON 齐三键 + drift 目录零产物。
function assertRejected(res, tag) {
  assert(res.code === 4, `期望 exit 4（准入全拒，D7 冻结码表），实得 ${res.code}\n${res.all.slice(0, 400)}`);
  const j = lastJson(res);
  assert(j != null, `stdout 末行须为单行 JSON（plan §3.5），实得：${JSON.stringify(res.stdout.slice(-200))}`);
  for (const k of ['mode', 'outcome', 'reason']) {
    assert(k in j, `stdout 末行 JSON 缺键「${k}」（plan §3.5 三键形）：${JSON.stringify(j)}`);
  }
  const files = driftFiles(tag);
  assert(files.length === 0, `准入拒必须零产物（A1「无补丁」/A8「零产物」），实得 drift/：${files.join(', ')}`);
  return j;
}

// ── A1 逐步全拒案：SUT_DEFECT + NEEDS_HUMAN，零 HARNESS_ERROR 步 ─────────────
await test('A1 SUT_DEFECT/NEEDS_HUMAN 案 → exit 4 + 逐步具名拒因 + 无补丁', () => {
  const tag = 'a1';
  const q = quad(tag, SCENARIOS.defectAndHuman);
  // 前置自证：真裁判确实给出了 SUT_DEFECT 与 NEEDS_HUMAN，夹具没被裁到别处。
  const kinds = q.verdict.steps.map((s) => s.verdict);
  assert(kinds.includes('SUT_DEFECT') && kinds.includes('NEEDS_HUMAN'),
    `夹具自检：真裁判须产出 SUT_DEFECT + NEEDS_HUMAN，实得 ${kinds.join('/')}`);
  const res = runHeal(proposeArgs(q, tag), { casesDir: CASES_DIR });
  const j = assertRejected(res, tag);
  for (const step of q.verdict.steps) {
    assert(JSON.stringify(j).includes(step.stepId),
      `逐步具名拒因须点名步 ${step.stepId}：${JSON.stringify(j)}`);
  }
  assert(jsonMentions(res, 'HEAL_VERDICT_NOT_HARNESS_ERROR'),
    `非 HARNESS_ERROR 步须具名拒因 HEAL_VERDICT_NOT_HARNESS_ERROR（plan S1）：${JSON.stringify(j)}`);
  assert(j.reason !== 'NO_HARNESS_ERROR_STEPS',
    'D7 切开了两种 exit 4：逐步全拒案走具名拒因清单，不得复用干净全 PASS 案的 NO_HARNESS_ERROR_STEPS');
});

// ── A8 干净全绿案 ───────────────────────────────────────────────────────────
await test('A8 全绿 verdict（干净案）→ exit 4 + reason=NO_HARNESS_ERROR_STEPS + 零产物', () => {
  const tag = 'a8';
  const q = quad(tag, SCENARIOS.allGreen);
  assert(q.verdict.steps.every((s) => s.verdict === 'PASS'), '夹具自检：干净案须全 PASS');
  const res = runHeal(proposeArgs(q, tag), { casesDir: CASES_DIR });
  const j = assertRejected(res, tag);
  assert(j.reason === 'NO_HARNESS_ERROR_STEPS',
    `A8 reason 必精确等于 NO_HARNESS_ERROR_STEPS（GRILL D7 字面），实得 ${JSON.stringify(j.reason)}`);
});

// ── A6 负控一：定位含 run-history 未投影字段 ────────────────────────────────
await test('A6 定位含 fallbackCss（未投影字段）→ exit 4 + HEAL_LINEAGE_UNVERIFIABLE', () => {
  const tag = 'a6-fallbackcss';
  const q = quad(tag, SCENARIOS.fallbackCssLocated);
  assert(q.verdict.steps.some((s) => s.verdict === 'HARNESS_ERROR'),
    '夹具自检：目标步须确为 HARNESS_ERROR——拒因必须来自 D12 血缘收窄，而非「本来就不该自愈」');
  const res = runHeal(proposeArgs(q, tag), { casesDir: CASES_DIR });
  assertRejected(res, tag);
  assert(jsonMentions(res, 'HEAL_LINEAGE_UNVERIFIABLE'),
    `D12 v4.1：定位含未投影字段必拒 HEAL_LINEAGE_UNVERIFIABLE（fail-closed，不猜）：${res.stdout.slice(-300)}`);
});

// ── A6 负控二：纯语义定位 A/B 混件、步集失配 ────────────────────────────────
await test('A6 A/B 混件（纯语义定位、步集失配）→ exit 4 + HEAL_INPUT_PAIR_MISMATCH', () => {
  const tag = 'a6-pair';
  const a = quad('a6-pair-A', SCENARIOS.pairA);
  const b = quad('a6-pair-B', SCENARIOS.pairB);
  assert(a.verdict.steps.length !== b.verdict.steps.length,
    '夹具自检：A/B 步集必须不同，否则测不到失配');
  // 混装：verdict 取 A 侧，三轴/events/run-history 取 B 侧——两侧都是纯语义定位，
  // 分辨只能靠 D12 的内容级互证（verdict↔axes 全步集/caseId 精确一致 + 逐字段对账）。
  const res = runHeal([
    CASE_ID,
    '--verdict', a.verdictPath,
    '--axes', b.axes,
    '--events', b.events,
    '--run-history', b.history,
    '--out-dir', outDir(tag),
    '--ts', TS,
  ], { casesDir: CASES_DIR });
  assertRejected(res, tag);
  assert(jsonMentions(res, 'HEAL_INPUT_PAIR_MISMATCH'),
    `A/B 混件须拒 HEAL_INPUT_PAIR_MISMATCH（plan S1）：${res.stdout.slice(-300)}`);
});

// ── A6 负控三：词表外原子 ───────────────────────────────────────────────────
await test('A6 词表外原子（三轴自报正向探针）→ exit 4 + DRIFT_VOCABULARY_UNSUPPORTED', () => {
  const tag = 'a6-vocab';
  const q = quad(tag, SCENARIOS.outOfVocabularyClaimed);
  assert(q.verdict.steps.some((s) => s.verdict === 'HARNESS_ERROR'),
    '夹具自检：目标步须确为 HARNESS_ERROR——词表拦截须由准入门独立做出，不能指望裁判代劳');
  const res = runHeal(proposeArgs(q, tag), { casesDir: CASES_DIR });
  assertRejected(res, tag);
  assert(jsonMentions(res, 'DRIFT_VOCABULARY_UNSUPPORTED'),
    `词表外原子须拒 DRIFT_VOCABULARY_UNSUPPORTED（plan S1 / GRILL D4）：${res.stdout.slice(-300)}`);
});

// ── A6 负控四：正向证据残缺（规范签名空）────────────────────────────────────
await test('A6 探针 matchedSignature 空 → exit 4 + HEAL_NO_POSITIVE_DRIFT_EVIDENCE', () => {
  const tag = 'a6-noevidence';
  const q = quad(tag, SCENARIOS.blankSignature);
  assert(q.verdict.steps.some((s) => s.verdict === 'HARNESS_ERROR'),
    '夹具自检：目标步须确为 HARNESS_ERROR——现役 driftHolds 只看布尔，签名空由准入门补拦');
  const res = runHeal(proposeArgs(q, tag), { casesDir: CASES_DIR });
  assertRejected(res, tag);
  assert(jsonMentions(res, 'HEAL_NO_POSITIVE_DRIFT_EVIDENCE'),
    `matchedSignature 非空是 S1 放行条件之一，缺则拒 HEAL_NO_POSITIVE_DRIFT_EVIDENCE：${res.stdout.slice(-300)}`);
});

// ── 输入畸形 fail-closed（D7：65）──────────────────────────────────────────
for (const [tag, which] of [['malformed-verdict', 'verdict'], ['malformed-events', 'events']]) {
  await test(`畸形输入（${which}.json 非合法 JSON）→ exit 65 + 零产物`, () => {
    const q = quad(tag, SCENARIOS.confirmedHarnessError);
    const broken = join(SCRATCH, 'quad', tag, `${which}.broken.json`);
    writeFileSync(broken, '{ 这不是合法 JSON', 'utf8');
    const res = runHeal([
      CASE_ID,
      '--verdict', which === 'verdict' ? broken : q.verdictPath,
      '--axes', q.axes,
      '--events', which === 'events' ? broken : q.events,
      '--run-history', q.history,
      '--out-dir', outDir(tag),
      '--ts', TS,
    ], { casesDir: CASES_DIR });
    assert(res.code === 65, `输入畸形须 exit 65（D7 冻结码表），实得 ${res.code}\n${res.all.slice(0, 400)}`);
    assert(driftFiles(tag).length === 0, '畸形输入路径不得落任何产物');
  });
}

// ── 拒付面对输入零写入 ──────────────────────────────────────────────────────
await test('准入拒绝路径对输入四件套零写入（原 events/axes/verdict 字节不变）', () => {
  const tag = 'readonly';
  const q = quad(tag, SCENARIOS.defectAndHuman);
  const before = [q.events, q.axes, q.verdictPath, q.history].map(shaOf);
  runHeal(proposeArgs(q, tag), { casesDir: CASES_DIR });
  const after = [q.events, q.axes, q.verdictPath, q.history].map(shaOf);
  assert(before.join() === after.join(), '准入拒绝不得改写任何输入件字节（非就地纪律）');
});

finish();
