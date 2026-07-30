#!/usr/bin/env node
// teachin-clear-fill-admission s3 全量复跑器（护栏 #19 机制化）：52 枚受影响金牌按真实
// 退出码逐一核对期望；既红者（改前基线采样，与本修接缝无关）额外做失败签名稳定性核对。
// 零 LLM、确定性、顺序执行（drvfs 上并行会相互拖慢误超时）。期望表=改前基线
// review/baseline-pre-change.txt 冻结快照；任何偏离（新回归/既红签名漂移/既红转绿）都红。
// 既红转绿也算偏离：那说明有人动了别的接缝，须重采基线而不是静默吃掉。

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const TAG = 'clear-fill-sweep';

// 期望绿（exit 0）—— 44 枚基线绿 + 本契约新金牌。
const EXPECT_GREEN = [
  'tests/_golden/teachin-replayability-action-authority.zero-sut.golden.mjs',
  'tests/_golden/teachin-replayability-adjacent.zero-sut.golden.mjs',
  'tests/_golden/teachin-replayability-atom-roundtrip.zero-sut.golden.mjs',
  'tests/_golden/teachin-replayability-boundaries.static.golden.mjs',
  'tests/_golden/teachin-replayability-capture-fresh.zero-sut.golden.mjs',
  'tests/_golden/teachin-replayability-clean-proof.zero-sut.golden.mjs',
  'tests/_golden/teachin-replayability-compile-runtime-adapter.zero-sut.golden.mjs',
  'tests/_golden/teachin-replayability-cycle-entry.zero-sut.golden.mjs',
  'tests/_golden/teachin-replayability-cycle-plan.static.golden.mjs',
  'tests/_golden/teachin-replayability-entity-verification.zero-sut.golden.mjs',
  'tests/_golden/teachin-replayability-equivalence-completion.zero-sut.golden.mjs',
  'tests/_golden/teachin-replayability-equivalence-core.zero-sut.golden.mjs',
  'tests/_golden/teachin-replayability-equivalence-evidence.zero-sut.golden.mjs',
  'tests/_golden/teachin-replayability-equivalence-integrity-authority.zero-sut.golden.mjs',
  'tests/_golden/teachin-replayability-equivalence-integrity-semantics.zero-sut.golden.mjs',
  'tests/_golden/teachin-replayability-equivalence-production-boundary.static.golden.mjs',
  'tests/_golden/teachin-replayability-equivalence-reset.zero-sut.golden.mjs',
  'tests/_golden/teachin-replayability-equivalence-resolved-completion.zero-sut.golden.mjs',
  'tests/_golden/teachin-replayability-equivalence-sequence.zero-sut.golden.mjs',
  'tests/_golden/teachin-replayability-orchestrator-wiring.static.golden.mjs',
  'tests/_golden/teachin-replayability-orchestrator.zero-sut.golden.mjs',
  'tests/_golden/teachin-replayability-prepared-run.zero-sut.golden.mjs',
  'tests/_golden/teachin-replayability-raw-actions.zero-sut.golden.mjs',
  'tests/_golden/teachin-replayability-raw-axes-adapter.zero-sut.golden.mjs',
  'tests/_golden/teachin-replayability-raw-event-observation.zero-sut.golden.mjs',
  'tests/_golden/teachin-replayability-raw-output-seal.zero-sut.golden.mjs',
  'tests/_golden/teachin-replayability-raw-runner.zero-sut.golden.mjs',
  'tests/_golden/teachin-replayability-resolved-authority-coverage.zero-sut.golden.mjs',
  'tests/_golden/teachin-replayability-resolved-projection.zero-sut.golden.mjs',
  'tests/_golden/teachin-replayability-review-hardening.zero-sut.golden.mjs',
  'tests/_golden/teachin-replayability-runtime-bootstrap.zero-sut.golden.mjs',
  'tests/_golden/teachin-replayability-runtime-cycle-adapter.zero-sut.golden.mjs',
  'tests/_golden/teachin-replayability-verdict-cli-adapter.zero-sut.golden.mjs',
  'tests/_golden/teachin-observation-authority-root.zero-sut.golden.mjs',
  'tests/_golden/teachin-observation-sidecar.zero-sut.golden.mjs',
  'tests/_golden/teachin-intake-swap-race.zero-sut.golden.mjs',
  'tests/_golden/record-distill.golden.mjs',
  'tests/_golden/record-intake.golden.mjs',
  'tests/_golden/cli-mcp-face.golden.mjs',
  'tests/_golden/teachin-cycle-alias-args.static.golden.mjs',
  'tests/_golden/record-capture.golden.mjs',
  'tests/_golden/observation-identity-contract-closure.zero-sut.golden.mjs',
  'tests/_golden/page-topology-auth-continuity-adjacent-regression.zero-sut.golden.mjs',
  'tests/_golden/page-topology-auth-continuity-pipeline.zero-sut.golden.mjs',
  'tests/_golden/teachin-clear-fill-admission.zero-sut.golden.mjs',
];

// 既红期望（改前基线 2026-07-29 采样；exit 码 + 稳定签名子串二重核对）。
const EXPECT_RED = [
  ['tests/_golden/teachin-observation-authority-hardening.zero-sut.golden.mjs', 1,
    'ACCEPTED_AUTHORITY_NOT_MINTED:INTAKE_TRANSACTION_INVALID'],
  ['tests/_golden/teachin-observation-driver-provenance.zero-sut.golden.mjs', 1,
    'CAPTURE_PATH_NOT_CANONICAL'],
  ['tests/_golden/teachin-observation-safe-case-lease-v2.zero-sut.golden.mjs', 1,
    'CASE_LEASE_PREEXISTING'],
  ['tests/_golden/teachin-observation-sidecar-hardening.zero-sut.golden.mjs', 1,
    'EXPECTED_BINDING_NOT_AUTHORITY'],
  ['tests/_golden/observation-cli-authority-wiring.zero-sut.golden.mjs', 1,
    'CASE_LEASE_PREEXISTING'],
  ['tests/_golden/teachin-observation-driver-canonical-root.zero-sut.golden.mjs', 78,
    'SECURITY_REVOKED'],
  ['tests/_golden/teachin-observation-transaction-root.zero-sut.golden.mjs', 78,
    'SECURITY_REVOKED'],
];

function runGolden(file) {
  const result = spawnSync(process.execPath, [resolve(ROOT, file)], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const code = result.signal ? 124 : (typeof result.status === 'number' ? result.status : 125);
  return { code, output: `${result.stdout || ''}\n${result.stderr || ''}` };
}

// 分片：gate 对单条 acceptance 有 5 分钟看门狗（commandTimeoutMs 默认 300000），全量约
// 14 分钟必被掐。`--part k/4` 按全序号轮转取片（i % parts === k-1），重活（e2e/崩溃既红）
// 自然摊开，每片实测远低于看门狗；四片并集=全集、两两不交，gate 四条 acceptance 合成全量。
// 无参数=全量（人工用）。
function parsePart() {
  const i = process.argv.indexOf('--part');
  if (i < 0) return null;
  const m = /^([1-9]\d*)\/([1-9]\d*)$/.exec(process.argv[i + 1] || '');
  if (!m) {
    console.error(`${TAG}: --part 参数须形如 k/m`);
    process.exit(64);
  }
  const part = Number(m[1]);
  const parts = Number(m[2]);
  if (part > parts) {
    console.error(`${TAG}: --part ${part}/${parts} 越界`);
    process.exit(64);
  }
  return { part, parts };
}

const PART = parsePart();
const inPart = (index) => !PART || index % PART.parts === PART.part - 1;

const failures = [];
let done = 0;
const combined = [
  ...EXPECT_GREEN.map((file) => ({ file, kind: 'green' })),
  ...EXPECT_RED.map(([file, code, signature]) => ({ file, kind: 'red', code, signature })),
];
const selected = combined.filter((_, index) => inPart(index));
const total = selected.length;
const label = PART ? `${TAG} part ${PART.part}/${PART.parts}` : TAG;

for (const entry of selected.filter((e) => e.kind === 'green').map((e) => e.file)) {
  const file = entry;
  const { code } = runGolden(file);
  done += 1;
  if (code === 0) {
    console.log(`ok   ${label} [${done}/${total}] exit=0 ${file}`);
  } else {
    failures.push(`${file}: 期望 exit 0 实得 ${code}`);
    console.error(`RED  ${label} [${done}/${total}] exit=${code}（期望 0）${file}`);
  }
}

for (const { file, code: expectCode, signature } of selected.filter((e) => e.kind === 'red')) {
  const { code, output } = runGolden(file);
  done += 1;
  if (code !== expectCode) {
    failures.push(`${file}: 既红期望 exit ${expectCode} 实得 ${code}（既红转绿/变码=基线漂移，须重采不许静默吃）`);
    console.error(`RED  ${label} [${done}/${total}] exit=${code}（既红期望 ${expectCode}）${file}`);
  } else if (!output.includes(signature)) {
    failures.push(`${file}: 既红签名漂移（未见 ${signature}）`);
    console.error(`RED  ${label} [${done}/${total}] 签名漂移 ${file}`);
  } else {
    console.log(`ok   ${label} [${done}/${total}] 既红稳定 exit=${expectCode} ${file}`);
  }
}

if (failures.length) {
  console.error(`\n${label}: ${total - failures.length}/${total} 符合期望，${failures.length} 偏离`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`\n${label}: ${total}/${total} 全部符合期望`);
