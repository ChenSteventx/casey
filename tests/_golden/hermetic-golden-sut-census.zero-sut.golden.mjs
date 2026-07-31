#!/usr/bin/env node
// hermetic golden SUT census：只静态读源码，绝不 import/执行被扫描 golden、fixture SUT 或浏览器。
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const GOLDEN_DIR = join(ROOT, 'tests', '_golden');
const DETECTOR = join(GOLDEN_DIR, 'support', 'sut-startup-closure.mjs');
const FIXTURE_ROOT = join(GOLDEN_DIR, 'fixtures', 'hermetic-golden-sut-census');

const EXPECTED_REPO_CLOSURE = [
  // 2026-07-31 闭集 27 → 30（Steven 裁定二之①，契约 isolated-golden-acceptance-revocation）：
  // 下列三枚 2026-07-22 新落的启夹具 SUT 金牌未进 2026-07-20 重裁，本次只把扫描事实钉进闭集，
  // 不代表它们已被判入隔离态——三枚补进隔离义务账一节须人裁（见本 prd observability）。
  'tests/_golden/agent-id-readback.chat-sut.golden.mjs',
  'tests/_golden/btn-enable-ops.golden.mjs',
  'tests/_golden/chiefcomplaint-smoke.golden.mjs',
  'tests/_golden/drawer-lock-hardening.golden.mjs',
  'tests/_golden/e2e-chain.golden.mjs',
  'tests/_golden/entity-ui-wiring.bindagent-replay.golden.mjs',
  'tests/_golden/entity-ui-wiring.searchopen.golden.mjs',
  'tests/_golden/kinds-harden.golden.mjs',
  'tests/_golden/layer3-wiring.golden.mjs',
  'tests/_golden/p2-sign.golden.mjs',
  'tests/_golden/p3-compile.golden.mjs',
  'tests/_golden/p5-replay.golden.mjs',
  'tests/_golden/plan-debt-sweep.golden.mjs',
  'tests/_golden/regress-promptset.golden.mjs',
  'tests/_golden/replay-login-bootstrap.golden.mjs',
  'tests/_golden/replay-nth-visible-hardening.golden.mjs',
  'tests/_golden/replay-settle-mount.golden.mjs',
  'tests/_golden/replay-video.golden.mjs',
  'tests/_golden/report-diagnostics.golden.mjs',
  'tests/_golden/run-convention.golden.mjs',
  'tests/_golden/run-history.golden.mjs',
  'tests/_golden/video-login-carry.golden.mjs',
  'tests/_golden/wf-add-node.golden.mjs',
  'tests/_golden/wf-connect-nodes.golden.mjs',
  'tests/_golden/wf-history-version.golden.mjs',
  'tests/_golden/wf-open-node.golden.mjs',
  'tests/_golden/wf-open-smoke.golden.mjs',
  'tests/_golden/wf-publish-states.golden.mjs',
  'tests/_golden/wf-select-node-dropdown.golden.mjs',
  'tests/_golden/wf-set-node-field.golden.mjs',
].sort();

const REPO_NEGATIVES = [
  'tests/_golden/admission-audience-wiring.golden.mjs',
  'tests/_golden/cli-mcp-face.golden.mjs',
  'tests/_golden/output-seal.golden.mjs',
  'tests/_golden/record-capture.golden.mjs',
];

const FIXTURE_ENTRIES = [
  'positive/direct-fixture.entry.mjs',
  'positive/reexport-fixture.entry.mjs',
  'positive/dynamic-fixture.entry.mjs',
  'positive/dynamic-destructure-fixture.entry.mjs',
  'positive/direct-listener.entry.mjs',
  'positive/playwright-launch.entry.mjs',
  'positive/sut-cli-connect.entry.mjs',
  'positive/sut-cli-direct-executable.entry.mjs',
  'positive/sut-cli-array.entry.mjs',
  'positive/sut-cli-multipush.entry.mjs',
  'positive/sut-cli-casey-spread.entry.mjs',
  'negative/from-events.negative.mjs',
  'negative/import-sentinel.negative.mjs',
  'negative/playwright-import-only.negative.mjs',
  'negative/preflight-sentinel.negative.mjs',
  'negative/string-only.negative.mjs',
  'negative/unused-fixture-import.negative.mjs',
].map((p) => join(FIXTURE_ROOT, p));

const EXPECTED_FIXTURE_CLOSURE = [
  'positive/direct-fixture.entry.mjs',
  'positive/direct-listener.entry.mjs',
  'positive/dynamic-destructure-fixture.entry.mjs',
  'positive/dynamic-fixture.entry.mjs',
  'positive/playwright-launch.entry.mjs',
  'positive/reexport-fixture.entry.mjs',
  'positive/sut-cli-array.entry.mjs',
  'positive/sut-cli-casey-spread.entry.mjs',
  'positive/sut-cli-connect.entry.mjs',
  'positive/sut-cli-direct-executable.entry.mjs',
  'positive/sut-cli-multipush.entry.mjs',
].sort();

let passed = 0;
const failures = [];
async function check(name, fn) {
  try { await fn(); passed += 1; console.log(`ok   ${name}`); }
  catch (error) { failures.push(`${name}: ${error.message}`); console.error(`FAIL ${name}: ${error.message}`); }
}
const sorted = (xs) => [...xs].sort();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

let scanSutStartupClosure = null;
await check('C1 detector 导出纯静态 scanSutStartupClosure API', async () => {
  let detector;
  try { detector = await import(`file://${DETECTOR.replace(/\\/g, '/')}`); }
  catch (error) { throw new Error(`缺 detector 模块或不可加载：${error.code || error.message}`); }
  if (typeof detector.scanSutStartupClosure !== 'function') throw new Error('缺 scanSutStartupClosure 导出函数');
  scanSutStartupClosure = detector.scanSutStartupClosure;
});

async function scan(args) {
  if (!scanSutStartupClosure) throw new Error('detector API 缺席，无法证明闭集');
  const result = await scanSutStartupClosure(args);
  if (!Array.isArray(result)) throw new Error('scanSutStartupClosure 必须返回 entry 数组');
  for (const entry of result) {
    if (!entry || typeof entry.goldenPath !== 'string' || !Array.isArray(entry.reasons) || entry.reasons.length === 0) {
      throw new Error(`坏 detector entry：${JSON.stringify(entry)}`);
    }
    for (const reason of entry.reasons) {
      if (!reason || typeof reason.kind !== 'string'
        || !reason.sourceSpan || !Number.isInteger(reason.sourceSpan.startLine)
        || !Number.isInteger(reason.sourceSpan.endLine)
        || reason.sourceSpan.startLine < 1 || reason.sourceSpan.endLine < reason.sourceSpan.startLine) {
        throw new Error(`坏 reason/sourceSpan：${JSON.stringify(reason)}`);
      }
    }
  }
  return result;
}

let repoEntries = null;
await check('C2 当前仓全部 golden 的 SUT 启动/连接文件闭集恰为 30', async () => {
  const entries = readdirSync(GOLDEN_DIR)
    .filter((name) => name.endsWith('.golden.mjs'))
    .map((name) => join(GOLDEN_DIR, name));
  repoEntries = await scan({ root: ROOT, entries });
  const actual = sorted(repoEntries.map((entry) => entry.goldenPath));
  if (!same(actual, EXPECTED_REPO_CLOSURE)) {
    throw new Error(`闭集漂移\nexpected=${JSON.stringify(EXPECTED_REPO_CLOSURE)}\nactual=${JSON.stringify(actual)}`);
  }
});

await check('C3 run-history 双 fixture 与 replay-video 自建 listener 均有带行号原因', async () => {
  if (!repoEntries) throw new Error('仓闭集未产出');
  const byPath = new Map(repoEntries.map((entry) => [entry.goldenPath, entry]));
  const history = byPath.get('tests/_golden/run-history.golden.mjs');
  const fixtures = sorted(history?.reasons.filter((r) => r.kind === 'fixture-start').map((r) => r.fixture) || []);
  if (!same(fixtures, ['fake-sut', 'login-sut'])) throw new Error(`run-history fixture 原因不全：${JSON.stringify(fixtures)}`);
  const video = byPath.get('tests/_golden/replay-video.golden.mjs');
  if (!video?.reasons.some((r) => r.kind === 'direct-listener')) throw new Error('replay-video 自建 listener 未命中');
});

await check('C4 --sut 字符串、前置早退与 record --from-events 不得误入闭集', async () => {
  if (!repoEntries) throw new Error('仓闭集未产出');
  const actual = new Set(repoEntries.map((entry) => entry.goldenPath));
  const leaked = REPO_NEGATIVES.filter((path) => actual.has(path));
  if (leaked.length) throw new Error(`负控误报：${leaked.join(', ')}`);
});

await check('C5 detector fixture 正负闭集、间接 import 与效果路径均精确', async () => {
  const result = await scan({ root: FIXTURE_ROOT, entries: FIXTURE_ENTRIES });
  const actual = sorted(result.map((entry) => entry.goldenPath));
  if (!same(actual, EXPECTED_FIXTURE_CLOSURE)) {
    throw new Error(`detector fixture 闭集漂移\nexpected=${JSON.stringify(EXPECTED_FIXTURE_CLOSURE)}\nactual=${JSON.stringify(actual)}`);
  }
  const byPath = new Map(result.map((entry) => [entry.goldenPath, entry]));
  const expectedKinds = new Map([
    ['positive/direct-fixture.entry.mjs', 'fixture-start'],
    ['positive/reexport-fixture.entry.mjs', 'fixture-start'],
    ['positive/dynamic-fixture.entry.mjs', 'fixture-start'],
    ['positive/dynamic-destructure-fixture.entry.mjs', 'fixture-start'],
    ['positive/direct-listener.entry.mjs', 'direct-listener'],
    ['positive/playwright-launch.entry.mjs', 'browser-launch'],
    ['positive/sut-cli-connect.entry.mjs', 'sut-cli-connect'],
    ['positive/sut-cli-direct-executable.entry.mjs', 'sut-cli-connect'],
    ['positive/sut-cli-array.entry.mjs', 'sut-cli-connect'],
    ['positive/sut-cli-multipush.entry.mjs', 'sut-cli-connect'],
    ['positive/sut-cli-casey-spread.entry.mjs', 'sut-cli-connect'],
  ]);
  for (const [path, kind] of expectedKinds) {
    if (!byPath.get(path)?.reasons.some((reason) => reason.kind === kind)) throw new Error(`${path} 缺 ${kind} 原因`);
  }
});

if (failures.length) {
  console.error(`\nhermetic golden SUT census: ${passed} passed, ${failures.length} failed`);
  process.exit(1);
}
console.log(`\nhermetic golden SUT census: ${passed}/5 passed`);
