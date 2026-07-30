// lib/selftest-tier2-judge-smoke.mjs —— tier-2 覆盖矩阵第三面（SUT_DEFECT 面）的生产采集能力
//   （GRILL D1 v3；联审 r1 H1：此前这一面只活在金牌里，现役 tier-2 命令从未行使过）。
// 做两件事，都是「运行时真事实」，不是静态宣称：
//   ① 把冻结三轴反例集逐条喂【现役 bin/verdict.mjs 二进制】，核四态与理由精确——对裁判本体的运行时冒烟；
//   ② 核 manifest 里历史真机先例的产物 hash 绑定（在册签认文书记同 hash，产物在场则字节等值）。
// 不造假缺陷（用户已裁）：本面绝不去真实环境制造 500，只证「通道健在 + 先例在册」。
//
// 反例集来源纪律：只引已冻夹具 `tests/_golden/fixtures/p2/verdict-cases.json`（其 sha256 在
//   `loop/prd-*.json` 的 testChecksums 在册），派生规则与金牌 T8 同构、由金牌 T8b 交叉钉住；
//   绝不在本模块里新造一份反例（第二份必漂移）。
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { PROJECT_ROOT, NODE_EXE } from './paths.mjs';
import { TIER2_FOUR_STATES } from './selftest-tier2.mjs';
import { verifyHistoricalPrecedents } from './selftest-tier2-manifest.mjs';

const FIXTURE_REL = 'tests/_golden/fixtures/p2/verdict-cases.json';
const VERDICT_BIN = join(PROJECT_ROOT, 'bin', 'verdict.mjs');

// 冻结反例集：id / 取自夹具的已冻案 / 派生（三轴反例的两个到达口与错步归因）/ 期望四态与理由。
// 金牌 T8b 按 id + 期望值交叉核本表，防生产侧偷偷放水。
export const TIER2_JUDGE_COUNTEREXAMPLES = Object.freeze([
  Object.freeze({
    id: 'sut_defect_arrival_1', from: 'sut_defect', derive: null,
    expectVerdict: 'SUT_DEFECT', expectReason: null,
    why: '动作做成 + 硬断言失败 + 本步归因 5xx（到达口①）',
  }),
  Object.freeze({
    id: 'sut_defect_arrival_2', from: 'sut_defect', derive: 'arrivalTwo',
    expectVerdict: 'SUT_DEFECT', expectReason: null,
    why: '动作未做成（resolution=none + 回读 false + 无同签名元素）+ 本步归因信封失败（到达口②）',
  }),
  Object.freeze({
    id: 'background_401_not_attributed', from: 'background_401_not_attributed', derive: null,
    expectVerdict: 'PASS', expectReason: null,
    why: '背景 401 归别步 → 不翻本步',
  }),
  Object.freeze({
    id: 'misattributed_5xx', from: 'sut_defect', derive: 'misattributed',
    expectVerdict: 'NEEDS_HUMAN', expectReason: 'SUT_DEFECT_OR_STALE',
    why: '5xx 归因到别的步 → 不得背书本步、不冒充缺陷',
  }),
  Object.freeze({
    id: 'catch_all_indeterminate', from: 'indeterminate', derive: null,
    expectVerdict: 'NEEDS_HUMAN', expectReason: 'INDETERMINATE',
    why: '无漂移信号无取证 → catch-all fail-safe',
  }),
  Object.freeze({
    id: 'ambiguous_action', from: 'ambiguous_action', derive: null,
    expectVerdict: 'NEEDS_HUMAN', expectReason: 'AMBIGUOUS_ACTION',
    why: '多匹配 → 绝不记缺陷',
  }),
  Object.freeze({
    id: 'harness_error_drift', from: 'harness_error', derive: null,
    expectVerdict: 'HARNESS_ERROR', expectReason: null,
    why: '正向漂移确证 → 可自愈',
  }),
  Object.freeze({
    id: 'pass', from: 'pass', derive: null,
    expectVerdict: 'PASS', expectReason: null,
    why: '全过 → PASS',
  }),
]);

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

// 冻结期望的精确比较（联审 r2 H1 残口）：期望理由为 null 时，实际必须【也没有理由】——
//   原来只在 expectReason 为真值时比，等于给五条空理由案开了后门：它们冒出任意理由都算过。
// 纯函数、独立导出，金牌可直接驱动（不必真跑二进制就能钉死比较语义）。
export function matchesFrozenExpectation(spec, actualVerdict, actualReason) {
  const s = spec && typeof spec === 'object' ? spec : {};
  if (!TIER2_FOUR_STATES.includes(actualVerdict)) return false;
  if (actualVerdict !== s.expectVerdict) return false;
  const expected = s.expectReason == null ? null : s.expectReason;
  const actual = typeof actualReason === 'string' && actualReason.length ? actualReason : null;
  return expected === actual;
}

// 夹具字节须在册（从任一 loop/prd-*.json 的 testChecksums 查，代码不写死字面量）。
function frozenFixtureChecksum() {
  const loopDir = join(PROJECT_ROOT, 'loop');
  let names = [];
  try { names = readdirSync(loopDir).filter((f) => f.startsWith('prd-') && f.endsWith('.json')); } catch { return null; }
  for (const name of names) {
    try {
      const prd = JSON.parse(readFileSync(join(loopDir, name), 'utf8'));
      const v = (prd.testChecksums || {})[FIXTURE_REL];
      if (typeof v === 'string') return v;
    } catch { /* 下一个 */ }
  }
  return null;
}

// 派生：与金牌 T8 同构（引已冻接缝再定点改一处，不倒着裁）。
function applyDerivation(kind, input) {
  if (kind === 'arrivalTwo') {
    input.steps[0].action = {
      kind: 'click', resolution: 'none',
      identityReadback: { ok: false },
      driftProbe: { sameSignatureUniquePresent: false },
    };
    input.steps[0].forensics.network[0].status = 200;
    input.steps[0].forensics.network[0].errorEnvelope = { field: 'status', expected: 200, actual: 500, ok: false };
    return input;
  }
  if (kind === 'misattributed') {
    input.steps[0].forensics.network[0].attributedStepId = 'atstep_99';
    return input;
  }
  return input;
}

// 运行时冒烟：真调现役裁判二进制。返回结构直接喂纯层 judgeTier2JudgeChannelSmoke。
export function collectTier2JudgeSmoke(manifest) {
  const fixtureAbs = join(PROJECT_ROOT, FIXTURE_REL);
  const precedents = verifyHistoricalPrecedents(manifest);
  const base = {
    ran: false, fixtureChecksumOk: false, cases: [], statesProduced: [], precedents,
    problems: [],
  };
  if (!existsSync(fixtureAbs)) return { ...base, problems: ['冻结反例集夹具不在场'] };
  const bytes = readFileSync(fixtureAbs);
  const frozen = frozenFixtureChecksum();
  const digest = sha256(bytes);
  const fixtureChecksumOk = typeof frozen === 'string' && frozen === digest;
  const problems = [];
  if (typeof frozen !== 'string') problems.push('反例集夹具未冻入任何契约 testChecksums');
  else if (!fixtureChecksumOk) problems.push('反例集夹具字节已漂移（与在册冻结值失配）');
  if (!existsSync(VERDICT_BIN)) return { ...base, fixtureChecksumOk, problems: [...problems, '裁判二进制不在场'] };

  let fixture;
  try { fixture = JSON.parse(bytes.toString('utf8')); }
  catch { return { ...base, fixtureChecksumOk, problems: [...problems, '反例集夹具不是合法 JSON'] }; }
  const frozenCase = (name) => {
    const found = (Array.isArray(fixture.cases) ? fixture.cases : []).find((c) => c && c.name === name);
    return found ? structuredClone(found.input) : null;
  };

  const tmp = mkdtempSync(join(tmpdir(), 'casey-tier2-judge-'));
  const cases = [];
  const statesProduced = new Set();
  try {
    for (const spec of TIER2_JUDGE_COUNTEREXAMPLES) {
      const input = frozenCase(spec.from);
      if (!input) {
        cases.push({ ...toCaseShape(spec), ok: false, actualVerdict: null, actualReason: null, problem: '夹具缺该已冻案' });
        continue;
      }
      const axesFile = join(tmp, `${spec.id}.in.json`);
      const outFile = join(tmp, `${spec.id}.out.json`);
      writeFileSync(axesFile, JSON.stringify(applyDerivation(spec.derive, input)), 'utf8');
      const child = spawnSync(NODE_EXE, [VERDICT_BIN, '--axes', axesFile, '--out', outFile], {
        cwd: PROJECT_ROOT, encoding: 'utf8', timeout: 60000,
      });
      if (child.status !== 0 || !existsSync(outFile)) {
        cases.push({ ...toCaseShape(spec), ok: false, actualVerdict: null, actualReason: null, problem: `裁判二进制非零退出（${child.status}）或零产物` });
        continue;
      }
      let out;
      try { out = JSON.parse(readFileSync(outFile, 'utf8')); }
      catch { cases.push({ ...toCaseShape(spec), ok: false, actualVerdict: null, actualReason: null, problem: '裁判产物不是合法 JSON' }); continue; }
      const step = out && Array.isArray(out.steps) ? out.steps[0] : null;
      const actualVerdict = step && typeof step.verdict === 'string' ? step.verdict : null;
      const actualReason = step && typeof step.reason === 'string' ? step.reason : null;
      if (actualVerdict) statesProduced.add(actualVerdict);
      const ok = matchesFrozenExpectation(spec, actualVerdict, actualReason);
      cases.push({ ...toCaseShape(spec), ok, actualVerdict, actualReason, problem: ok ? null : '与冻结期望不符（四态与理由都精确比）' });
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  return {
    ran: true,
    fixtureChecksumOk,
    fixtureDigest: digest,
    cases,
    statesProduced: [...statesProduced],
    precedents,
    problems,
  };
}

function toCaseShape(spec) {
  return { id: spec.id, expectVerdict: spec.expectVerdict, expectReason: spec.expectReason, why: spec.why };
}
