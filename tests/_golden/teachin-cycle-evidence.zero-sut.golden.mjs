#!/usr/bin/env node
// teachin-cycle-evidence —— 闭环取证边车（开发期）的红先行金牌。
// 判据唯一来源：docs/plans/teachin-cycle-evidence/GRILL.md（D1-D5）与 plan.md（v3 语义）。
//
// 零 SUT：纯内存直调 + 合成收集器直击 safeEmit + 临时目录原子写；
//   零 browser、零 network、零 LLM、零真实凭据、零真实地址、零 git 写。
//   活体段（真跑闭环）的零行为差与真因唯一归因由 plan §3 的 A4（Steven 重录）承接，不进本金牌。
//
// 本金牌冻结的两个纯层模块（D1 拆分，实现前均不存在）：
//   · lib/teachin/cycle-evidence-context.mjs —— 纯：模块级 AsyncLocalStorage 词法边界
//       + safeEmit + 固定枚举 + 封存式收集器；零 node:fs 且零 import output 件（纯核心只许导入它）；
//   · lib/teachin/cycle-evidence-output.mjs  —— 四层闸 + 全量 digest 派生文件名 + 原子写
//       + 读取方 readCycleEvidence；全仓 import 站点仅 bin/record.mjs
//       （防传递依赖把写盘拖进双回放纯核心）。
//
// 真实链路（plan v3 §1）：bin/casey.mjs → bin/teachin-cycle.mjs（薄别名）→ bin/record.mjs
//   → lib/teachin/replayability-cycle-entry.mjs → lib/teachin/dual-replay-orchestrator.mjs
//   （生产 façade，纯委托、零拒付语义、本契约明确不改）→ dual-replay-orchestrator-core.mjs
//   → runtime adapter → raw-event-observation.mjs → raw-replay-runner.mjs。
//
// 延迟消费（同 p9-tier2 金牌的 T0 做法，如实标注）：import 失败不立刻 process.exit(1)，
//   否则「修前应绿」的既有面（E5 基线、E9 反向闭包扫描）跑不到、红绿分布无法如实记账。
//   改为：记一条硬红（T0）+ 各纯层钉逐条红，既有面照跑，整体仍 exit 1。
//
// 修前预期：绝大多数红（两模块缺席）；少数既有面绿——
//   E5-b（无观测上下文的双跑基线自等）、E9-c（当前无任何件导入 output 模块，闭包反向面暂真）、
//   E9-f（façade 纯委托）、E0-b（既有生产件在场且拒付码未漂移）。
//
// 术语对照（v3 定案后残留的措辞，如实标注、按 v3 写）：
//   · GRILL D1 首句与 E6 标题仍留 v2 的 evidenceSink / 「sink 中毒钉」字样，同段正文已定案
//     改 AsyncLocalStorage；本金牌按 v3 把 E6 重表达为「敌意/异物收集器 + 抛错 getter 载荷」
//     ——safeEmit 一律吞、闭环结论与基线全等。
//   · GRILL D4 已收敛为绑定单判、明写 recordedAt 仅供人读；本金牌反向钉「recordedAt 不参与判定」。
//   · plan §1.1 把读取方写成 readCycleEvidence(captureSha256)，未写目录从何而来。
//     hermetic 金牌不得依赖进程级全局取证目录，故本金牌冻结显式二参形态
//     readCycleEvidence(captureSha256, { outDir })；若实现要留缺省目录，多一个可选参数无碍。

import {
  readFileSync, existsSync, readdirSync, mkdtempSync, rmSync, rmdirSync,
  writeFileSync, mkdirSync, symlinkSync, unlinkSync,
} from 'node:fs';
import { deepStrictEqual } from 'node:assert/strict';
import { resolve, dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const TAG = 'teachin-cycle-evidence';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

// ══════════════════════════════════════════════════════════════════════
// 凭据闸隔离根（codex code-r1 M5）
//
// 本金牌的传递依赖 screenCycleEvidenceText → credentialGate → collectSecretLiterals
// 会按 lib/paths.mjs 的 PROJECT_ROOT 去找 .auth/credentials.json 与 site.json——
// 也就是说「本金牌一字不读凭据」在真仓里本来是假的，而且只扫本文件字面量根本证不出来。
//
// 机制化（不改任何生产件形状、也绝不给凭据源加可注入口——那等于给门开后门）：
// 本金牌先把自己重启进一枚隔离根：<tmp>/…-iso/ 下 lib、bin、tests、node_modules 都是
// 指向真仓同名目录的符号链接（Windows 走 junction），.auth/credentials.json 与 site.json
// 是合成夹具；子进程带 --preserve-symlinks(-main) 起，于是 paths.mjs 解析出的
// PROJECT_ROOT 落在隔离根内，凭据源恒为合成夹具，真仓凭据件连候选路径都不是。
// 子进程另带一枚 fs 访问探针（--require），把每一次读盘路径记进 globalThis 供 E4c 核。
// ══════════════════════════════════════════════════════════════════════

const ISOLATION_ROOT_ENV = 'CASEY_CYCLE_EVIDENCE_ISOLATION_ROOT';
const REAL_ROOT_ENV = 'CASEY_CYCLE_EVIDENCE_REAL_ROOT';
const FS_PROBE_GLOBAL = '__caseyCycleEvidenceFsProbe';
// 隔离根里的合成凭据夹具字面量：合成假值，绝不取自 .auth/ 或 site.json。
const ISOLATED_FIXTURE_SECRET = 'FAKE_ISOLATED_FIXTURE_LITERAL_zzz9';

const FS_ACCESS_PROBE_SOURCE = `// 读盘访问探针（金牌自用，随隔离根一起生成于临时目录）：
// 只记路径、不记内容；同步 API 与 promises 面都补，供金牌核「凭据源读取全落隔离根内」。
const fs = require('node:fs');
const records = [];
globalThis.${FS_PROBE_GLOBAL} = records;
function wrap(host, name) {
  const original = host[name];
  if (typeof original !== 'function') return;
  host[name] = function patched(target, ...rest) {
    try { records.push({ api: name, path: String(target) }); } catch { /* 探针绝不回流 */ }
    return original.call(this, target, ...rest);
  };
}
for (const name of ['readFileSync', 'existsSync', 'openSync', 'statSync', 'readFile', 'open', 'createReadStream']) {
  wrap(fs, name);
}
for (const name of ['readFile', 'open', 'stat']) wrap(fs.promises, name);
`;

function dropIsolationLink(path) {
  try {
    unlinkSync(path);
    return;
  } catch { /* Windows 目录 junction 不吃 unlink，走 rmdir */ }
  try {
    rmdirSync(path);
  } catch { /* 清不掉就留给系统清临时目录：绝不对隔离根递归删（链接指向真仓） */ }
}

if (!process.env[ISOLATION_ROOT_ENV]) {
  const isolationRoot = mkdtempSync(join(tmpdir(), 'casey-cycle-evidence-iso-'));
  const linked = [];
  let prepareFailure = null;
  try {
    mkdirSync(join(isolationRoot, '.auth'), { recursive: true });
    writeFileSync(join(isolationRoot, '.auth', 'credentials.json'), `${JSON.stringify({
      username: ISOLATED_FIXTURE_SECRET,
      password: `${ISOLATED_FIXTURE_SECRET}_pw`,
    }, null, 2)}\n`, 'utf8');
    writeFileSync(join(isolationRoot, 'site.json'), `${JSON.stringify({
      baseUrl: `${ISOLATED_FIXTURE_SECRET}_base`,
    }, null, 2)}\n`, 'utf8');
    writeFileSync(join(isolationRoot, 'fs-access-probe.cjs'), FS_ACCESS_PROBE_SOURCE, 'utf8');
    for (const name of ['lib', 'bin', 'tests', 'node_modules']) {
      const target = join(ROOT, name);
      if (!existsSync(target)) continue;
      symlinkSync(target, join(isolationRoot, name), 'junction');
      linked.push(join(isolationRoot, name));
    }
  } catch (error) {
    prepareFailure = String(error?.message || error).slice(-300);
  }
  if (prepareFailure) {
    // fail-closed：造不出隔离根就别退回真仓跑——那正是 codex code-r1 M5 判的那条假声明。
    console.error(`RED  ${TAG}: 凭据闸隔离根搭建失败（拒绝退回真仓运行）：${prepareFailure}`);
    for (const link of linked) dropIsolationLink(link);
    process.exit(1);
  }
  const child = spawnSync(process.execPath, [
    '--require', join(isolationRoot, 'fs-access-probe.cjs'),
    '--preserve-symlinks',
    '--preserve-symlinks-main',
    join(isolationRoot, 'tests', '_golden', 'teachin-cycle-evidence.zero-sut.golden.mjs'),
  ], {
    stdio: 'inherit',
    env: {
      ...process.env,
      [ISOLATION_ROOT_ENV]: isolationRoot,
      [REAL_ROOT_ENV]: ROOT,
    },
  });
  for (const link of linked) dropIsolationLink(link);
  for (const name of ['fs-access-probe.cjs', 'site.json', join('.auth', 'credentials.json')]) {
    try { unlinkSync(join(isolationRoot, name)); } catch { /* 留给系统清 */ }
  }
  try { rmdirSync(join(isolationRoot, '.auth')); } catch { /* 同上 */ }
  try { rmdirSync(isolationRoot); } catch { /* 同上 */ }
  process.exit(child.status === null ? 1 : child.status);
}

const ISOLATION_ROOT = process.env[ISOLATION_ROOT_ENV];
const REAL_ROOT = process.env[REAL_ROOT_ENV] || '';

const failures = [];
let passed = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`ok   ${TAG}: ${name}`);
  } catch (error) {
    failures.push(`${name}: ${String(error?.message || error).slice(-900)}`);
    console.error(`RED  ${TAG}: ${name}: ${String(error?.message || error).slice(-900)}`);
  }
}

function sameShape(actual, expected, message) {
  try {
    deepStrictEqual(actual, expected);
  } catch {
    throw new Error(`${message}：实得 ${JSON.stringify(actual)} vs 期望 ${JSON.stringify(expected)}`);
  }
}

// —— 延迟导入两个纯层模块（缺席 → T0 硬红，各纯层钉逐条红，整体仍 exit 1）——

let contextApi = null;
let contextImportError = null;
try {
  contextApi = await import('../../lib/teachin/cycle-evidence-context.mjs');
} catch (error) {
  contextImportError = error;
}
let outputApi = null;
let outputImportError = null;
try {
  outputApi = await import('../../lib/teachin/cycle-evidence-output.mjs');
} catch (error) {
  outputImportError = error;
}

function ctx() {
  if (!contextApi) {
    throw new Error(`纯层 lib/teachin/cycle-evidence-context.mjs 导入失败（实现模块尚未落地）：${String(contextImportError?.message || contextImportError).slice(-200)}`);
  }
  return contextApi;
}
function out() {
  if (!outputApi) {
    throw new Error(`纯层 lib/teachin/cycle-evidence-output.mjs 导入失败（实现模块尚未落地）：${String(outputImportError?.message || outputImportError).slice(-200)}`);
  }
  return outputApi;
}

// —— 既有生产面（本契约「一个字节不动」的对照物）——

let entryApi = null;
let entryImportError = null;
try {
  entryApi = await import('../../lib/teachin/replayability-cycle-entry.mjs');
} catch (error) {
  entryImportError = error;
}

// 公开导出面（lib/dual-replay/index.mjs）与零 SUT 双回放 harness：
// codex code-r1 M2/M4 要求「真实生产点」而非合成替身作证——两者让本金牌能直接驱动
// 现役 completion 的可达拒付分支，不再靠 synthCatchSite 之类的形状替身。
let dualApi = null;
let dualImportError = null;
try {
  dualApi = await import('../../lib/dual-replay/index.mjs');
} catch (error) {
  dualImportError = error;
}
let harness = null;
let harnessImportError = null;
try {
  harness = await import('./support/teachin-replayability-equivalence-harness.mjs');
} catch (error) {
  harnessImportError = error;
}

// ══════════════════════════════════════════════════════════════════════
// 冻结清单（实现须为超集且闭合；全部串出自固定枚举，D3）
// ══════════════════════════════════════════════════════════════════════

// D2 归因枚举：每个同码生产拒付点一员（A4 的完成语义 = 逐点可唯一归因）。
// 来源逐条可回指：
//   lib/dual-replay/replay-completion.mjs
//     executeAuthorizedSourceReplay 七分支 —— extraInputs 闭合键 / issuer catch / exactKeys+ok
//       / artifactDigests+artifactsAgree / rawReplay.status!=CLEAN
//       / inspectCleanRawReplayAuthority / inspectRawEventObservationAuthority
//     completeResolvedSourceReplay 同码组 —— extraInputs 闭合键 / issuer catch / 结果形状与绑定
//     completeAuthorizedReplay 同码组 —— extraInputs 闭合键 / issuer catch / 结果形状
//       / artifacts 与 axes-verdict 字节
//   三枚 input-shape 归因（codex code-r1 M2 补签）：extraInputs 分支虽在 canonical 编排下
//     恒传闭合键而不可达，但三枚 completion 由 lib/dual-replay/index.mjs 公开导出、
//     外部调用方可直达，故按「公开可达即须逐点归因」补进枚举，不按「录制链不可达」挂账。
//     三枚同形，只是 resolved 那枚拒付码为 SOURCE_SEMANTIC_COMPLETION_INVALID。
//   lib/teachin/raw-replay-runner.mjs —— observer.begin / observer.finish（现无 catch，只通报不改控制流）+ 逐事件面
//   lib/teachin/raw-axes-adapter.mjs —— formal replay（sealFormalRun / projectAndVerify）
//   lib/teachin/prepared-runtime-seam.mjs —— inspectClaimedReplayRuntime / runCanonicalPreflight
//   lib/teachin/dual-replay-orchestrator-core.mjs —— 阶段边界
// 注（文档缺口，正签前请确认）：plan v3 只写「prepared-runtime 各分支」，未逐分支命名；
//   本金牌按其两个导出入口收敛为 claim / preflight 两员。
const REQUIRED_REFUSAL_POINTS = Object.freeze([
  'source-completion.input-shape',
  'source-completion.issuer-throw',
  'source-completion.result-shape',
  'source-completion.artifact',
  'source-completion.raw-status',
  'source-completion.proof',
  'source-completion.observation',
  'resolved-completion.input-shape',
  'resolved-completion.issuer-throw',
  'resolved-completion.result-shape',
  'distilled-completion.input-shape',
  'distilled-completion.issuer-throw',
  'distilled-completion.result-shape',
  'distilled-completion.artifact',
  'observer.begin',
  'observer.finish',
  'raw-runner.event',
  'formal-replay.refusal',
  'prepared-runtime.claim',
  'prepared-runtime.preflight',
  'orchestrator.stage-boundary',
]);

// 阶段枚举：dual-replay-orchestrator-core 编号步 1–14 的归组。
// 注（文档缺口）：GRILL D4 只说边车顶层带 stages，未逐项命名；本清单为按生产件推导的冻结值。
const REQUIRED_STAGES = Object.freeze([
  'source-plan',
  'source-runtime-claim',
  'source-raw-execute',
  'source-resolved-completion',
  'source-runtime-close',
  'distilled-seal',
  'pair-finalize',
  'source-receipt',
  'distilled-runtime-prepare',
  'distilled-completion',
  'distilled-receipt',
  'pair-compare',
]);

// 逐事件面沿用 raw runner 的动作轴字段（D2）+ 归因/阶段/拒付码/异常名。
const REQUIRED_EVENT_KEYS = Object.freeze([
  'stage', 'refusalPoint', 'reason', 'errorName',
  'seq', 'action', 'resolution', 'candidateCount', 'performOk',
]);
// 白名单之外一律不许出现：任何一个都是「私有事实经取证通道外泄」。
const BANNED_EVENT_KEYS = Object.freeze([
  'message', 'stack', 'error', 'cause', 'payload', 'value', 'url', 'href',
  'selector', 'path', 'text', 'fieldLabel', 'captureBytes', 'headers', 'env',
]);

// D3：异常名只认内建白名单，未知或安全读取失败一律降格 OtherError。
const REQUIRED_ERROR_NAMES = Object.freeze([
  'Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError',
  'EvalError', 'URIError', 'AggregateError', 'OtherError',
]);

// D4：三码闭合。
const REQUIRED_REJECTION_CODES = Object.freeze([
  'EVIDENCE_SCHEMA_REJECTED', 'EVIDENCE_CREDENTIAL_REJECTED', 'EVIDENCE_WRITE_FAILED',
]);

// D4：边车顶层 exact-key。
const REQUIRED_DOCUMENT_KEYS = Object.freeze([
  'schemaVersion', 'artifactKind', 'captureSha256', 'recordedAt', 'stages', 'events',
]);

const CAPTURE_A = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
const CAPTURE_B = 'f0e1d2c3b4a59687786958473625140f0e1d2c3b4a59687786958473625140fe';
const CAPTURE_C = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
// D4 v3 终修钉：两枚完整 digest 的前 12 位相同——12 位派生（48 位命名空间）会撞成同一目标，
// 全量派生才零碰撞。CAPTURE_A_TWIN 与 CAPTURE_A 前 12 位逐字符相同、第 13 位起分叉。
const CAPTURE_A_TWIN = `${CAPTURE_A.slice(0, 12)}${'f'.repeat(52)}`;
const RECORDED_AT = '2026-07-29T12:00:00.000Z';

// E4b 注入夹具：全部为合成假串与保留域名，绝不取自 .auth/ 或 site.json（本金牌一字不读）。
const FAKE_CREDENTIAL_FIXTURES = Object.freeze([
  ['env 凭据串（禁字段关键词 secret）', 'FAKE_SECRET_abc123'],
  ['授权头形态（禁字段关键词 bearer ）', 'Bearer FAKE_TOKEN_xyz789'],
  ['cookie 形态（禁字段关键词 cookie）', 'set-cookie: FAKE_SESSION_zzz'],
  ['裸 URL（内嵌 scheme）', 'https://example.invalid/x'],
  ['编码变体（%3a%2f%2f 走私）', 'https%3A%2F%2Fexample.invalid%2Fx'],
  ['协议相对地址', '//example.invalid/x'],
]);

// —— 通用小工具 ——

function sidecarNames(dir) {
  try {
    return readdirSync(dir).filter((name) => name.startsWith('cycle-evidence')).sort();
  } catch {
    return [];
  }
}

// 「先闸后盘」（D4 v3 终修）验收面：拒付时目录必须一件不留——含临时件、点文件、残件。
function allNames(dir) {
  try {
    return readdirSync(dir).sort();
  } catch {
    return [];
  }
}

function captureConsole(fn) {
  const chunks = [];
  const outWrite = process.stdout.write;
  const errWrite = process.stderr.write;
  process.stdout.write = (chunk) => { chunks.push(`out:${String(chunk)}`); return true; };
  process.stderr.write = (chunk) => { chunks.push(`err:${String(chunk)}`); return true; };
  const restore = () => { process.stdout.write = outWrite; process.stderr.write = errWrite; };
  let value;
  try {
    value = fn();
  } catch (error) {
    restore();
    throw error;
  }
  if (value && typeof value.then === 'function') {
    return value.then((resolved) => { restore(); return { value: resolved, chunks }; },
      (error) => { restore(); throw error; });
  }
  restore();
  return Promise.resolve({ value, chunks });
}

function walkSources(dir, prefix, acc) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    const rel = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) walkSources(abs, rel, acc);
    else if (entry.isFile() && entry.name.endsWith('.mjs')) acc.push(rel);
  }
  return acc;
}

const tmpRoot = mkdtempSync(join(tmpdir(), 'casey-cycle-evidence-'));

try {

// ══════════════════════════════════════════════════════════════════════
// T0 / E0 冻结面在场
// ══════════════════════════════════════════════════════════════════════

await check('T0 纯层两模块在场且 API 形态正确（缺席即整体红）', () => {
  const c = ctx();
  const o = out();
  for (const name of [
    'createCycleEvidenceCollector', 'runWithCycleEvidence', 'safeEmit',
    'sealCycleEvidence', 'inspectCycleEvidence', 'normalizeErrorName',
  ]) {
    assert(typeof c[name] === 'function', `cycle-evidence-context 缺 frozen API ${name}`);
  }
  // 读取方归属在 output 件（plan v3 §1.1 codex r3 H4 收口）：context 件不得代持读取方，
  // 否则纯核心经 context 就能摸到落盘面，D1 的拆分理由被架空。
  assert(typeof c.readCycleEvidence !== 'function',
    'readCycleEvidence 属 output 件，context 件不得导出同名读取方（防拆分被架空）');
  for (const name of [
    'cycleEvidenceFileName', 'buildCycleEvidenceDocument', 'screenCycleEvidenceDocument',
    'screenCycleEvidenceText', 'writeCycleEvidenceSidecar', 'readCycleEvidence',
  ]) {
    assert(typeof o[name] === 'function', `cycle-evidence-output 缺 frozen API ${name}`);
  }
});

await check('E0a 枚举闭合：refusalPoint / stage / event 键 / 异常名 / 拒付码 / 顶层键', () => {
  const c = ctx();
  const o = out();
  const closed = [
    ['CYCLE_EVIDENCE_REFUSAL_POINTS', c.CYCLE_EVIDENCE_REFUSAL_POINTS, REQUIRED_REFUSAL_POINTS],
    ['CYCLE_EVIDENCE_STAGES', c.CYCLE_EVIDENCE_STAGES, REQUIRED_STAGES],
    ['CYCLE_EVIDENCE_EVENT_KEYS', c.CYCLE_EVIDENCE_EVENT_KEYS, REQUIRED_EVENT_KEYS],
    ['CYCLE_EVIDENCE_ERROR_NAMES', c.CYCLE_EVIDENCE_ERROR_NAMES, REQUIRED_ERROR_NAMES],
    ['CYCLE_EVIDENCE_REJECTION_CODES', o.CYCLE_EVIDENCE_REJECTION_CODES, REQUIRED_REJECTION_CODES],
    ['CYCLE_EVIDENCE_DOCUMENT_KEYS', o.CYCLE_EVIDENCE_DOCUMENT_KEYS, REQUIRED_DOCUMENT_KEYS],
  ];
  for (const [name, actual, required] of closed) {
    assert(Array.isArray(actual) && actual.length > 0, `缺 frozen 常量 ${name}（须非空数组）`);
    assert(Object.isFrozen(actual), `${name} 须冻结（Object.freeze）`);
    assert(new Set(actual).size === actual.length, `${name} 不得有重复项`);
    for (const member of required) {
      assert(actual.includes(member), `${name} 缺成员「${member}」`);
    }
  }
  assert(c.CYCLE_EVIDENCE_ARTIFACT_KIND === 'cycle-evidence',
    `artifactKind 须为 cycle-evidence，实得 ${c.CYCLE_EVIDENCE_ARTIFACT_KIND}`);
  assert(Number.isSafeInteger(c.CYCLE_EVIDENCE_SCHEMA_VERSION) && c.CYCLE_EVIDENCE_SCHEMA_VERSION >= 1,
    `schemaVersion 须为安全整数，实得 ${c.CYCLE_EVIDENCE_SCHEMA_VERSION}`);
  for (const banned of BANNED_EVENT_KEYS) {
    assert(!c.CYCLE_EVIDENCE_EVENT_KEYS.includes(banned),
      `事件白名单不得含私有事实键「${banned}」`);
  }
});

await check('E0b 既有生产件在场且同码拒付分支未漂移（修前应绿的横切锚点）', () => {
  assert(!entryImportError, `既有入口 lib/teachin/replayability-cycle-entry.mjs 导入失败：${String(entryImportError?.message || entryImportError).slice(-200)}`);
  assert(typeof entryApi.runRecordedTeachinReplayabilityCycle === 'function',
    '缺既有入口 runRecordedTeachinReplayabilityCycle');
  const completion = readFileSync(resolve(ROOT, 'lib/dual-replay/replay-completion.mjs'), 'utf8');
  // 六分支同码：本契约要挖穿的正是「同码多分支 + catch 吞真因」。
  const invalidHits = completion.match(/denied\('RUN_COMPLETION_INVALID'\)/g) || [];
  assert(invalidHits.length >= 6,
    `replay-completion 的 RUN_COMPLETION_INVALID 同码分支数应 >= 6，实得 ${invalidHits.length}`);
  // 换签（codex code-r1 M1）：原钉钉的是取证落地前的 `catch { return denied(...) }` 字面量；
  // 通报改为同步写进 catch 内之后字面量必然变。新钉逐字节钉住三处新形态——
  // catch 绑异常 → 同步 safeEmit（只带阶段/闭合拒付码/规范化异常名）→ 原样 return 原拒付。
  // 逐字节而非模糊匹配：这三块字节就是「不多一次 await、不多一枚包裹帧」的唯一凭据。
  const SWALLOW_LITERALS = [
    ['source issuer-throw', `  } catch (error) {
    safeEmit('source-completion.issuer-throw', {
      stage: RAW_STAGE,
      reason: 'RUN_COMPLETION_INVALID',
      errorName: normalizeErrorName(error),
    });
    return denied('RUN_COMPLETION_INVALID');
  }`],
    ['resolved issuer-throw', `  } catch (error) {
    safeEmit('resolved-completion.issuer-throw', {
      stage: RESOLVED_STAGE,
      reason: 'SOURCE_SEMANTIC_COMPLETION_INVALID',
      errorName: normalizeErrorName(error),
    });
    return denied('SOURCE_SEMANTIC_COMPLETION_INVALID');
  }`],
    ['distilled issuer-throw', `  } catch (error) {
    safeEmit('distilled-completion.issuer-throw', {
      stage: DISTILLED_STAGE,
      reason: 'RUN_COMPLETION_INVALID',
      errorName: normalizeErrorName(error),
    });
    return denied('RUN_COMPLETION_INVALID');
  }`],
  ];
  for (const [label, literal] of SWALLOW_LITERALS) {
    assert(completion.includes(literal),
      `replay-completion 的 ${label} 吞异常位必须逐字节为「catch 绑异常 → 同步 safeEmit → 原样 return 原拒付」`);
  }
  // 反 rig（codex code-r1 M1 原判）：任何包裹函数都会多一枚异常栈帧与一代微任务。
  assert(!/\breportedCall\b/.test(completion),
    'issuer 调用不得再套 async 包裹函数（多一次 await = 多一代微任务 + 多一枚栈帧，控制流不再等价）');
  for (const literal of [
    'result = await trustedRawReplayIssuer.executeAndVerify({ runExecutionAuthority });',
    'result = await trustedReplayIssuer.executeAndVerify({ runExecutionAuthority });',
  ]) {
    assert(completion.includes(literal),
      `issuer 必须在原 try 内被直接 await：缺「${literal}」`);
  }
  const runner = readFileSync(resolve(ROOT, 'lib/teachin/raw-replay-runner.mjs'), 'utf8');
  assert(/observer\.begin\(/.test(runner) && /observer\.finish\(/.test(runner),
    'raw-replay-runner 须仍有 observer begin/finish 两个发射位');
});

// ══════════════════════════════════════════════════════════════════════
// E1 形状：白名单键闭合、未知键 → 整批毒化（append-or-poison）
// ══════════════════════════════════════════════════════════════════════

function legalPayload(overrides = {}) {
  return {
    stage: 'source-raw-execute',
    reason: 'RUN_COMPLETION_INVALID',
    errorName: 'TypeError',
    seq: 3,
    action: 'click',
    resolution: 'unique',
    candidateCount: 1,
    performOk: false,
    ...overrides,
  };
}

function collectOne(refusalPoint, payload) {
  const { createCycleEvidenceCollector, runWithCycleEvidence, safeEmit, sealCycleEvidence } = ctx();
  const collector = createCycleEvidenceCollector();
  runWithCycleEvidence(collector, () => {
    safeEmit(refusalPoint, payload);
  });
  return sealCycleEvidence(collector);
}

await check('E1 合法载荷入档且键集恰为白名单子集', () => {
  const snapshot = collectOne('source-completion.issuer-throw', legalPayload());
  assert(snapshot && snapshot.poisoned === false, `合法载荷不得毒化：${JSON.stringify(snapshot)}`);
  assert(Array.isArray(snapshot.events) && snapshot.events.length === 1,
    `合法载荷须恰一条入档：${JSON.stringify(snapshot.events)}`);
  const record = snapshot.events[0];
  assert(record.refusalPoint === 'source-completion.issuer-throw',
    `归因须原样记录：${JSON.stringify(record)}`);
  for (const key of Object.keys(record)) {
    assert(REQUIRED_EVENT_KEYS.includes(key), `事件出现白名单外键「${key}」：${JSON.stringify(record)}`);
  }
});

const SHAPE_HOLES = [
  ['未知键走私', legalPayload({ message: '真因原文不许进档' })],
  ['异常原文走私（stack）', legalPayload({ stack: 'at foo (bar.mjs:1:1)' })],
  ['枚举外 stage', legalPayload({ stage: 'zzz-not-a-stage' })],
  ['枚举外 reason', legalPayload({ reason: 'ZZZ_FREE_STRING' })],
  ['枚举外 errorName（未经降格直塞）', legalPayload({ errorName: 'EvilCustomError' })],
  ['seq 非安全整数', legalPayload({ seq: 2 ** 60 })],
  ['seq 非数值', legalPayload({ seq: '3' })],
  ['candidateCount 负数', legalPayload({ candidateCount: -1 })],
  ['performOk 非布尔（truthy 串）', legalPayload({ performOk: 'true' })],
  ['action 非串', legalPayload({ action: { evil: 1 } })],
  ['嵌套对象走私', legalPayload({ resolution: { nested: 'x' } })],
];

for (const [label, payload] of SHAPE_HOLES) {
  await check(`E1 形状击穿：${label} → 整批毒化且拒写`, () => {
    const { createCycleEvidenceCollector, runWithCycleEvidence, safeEmit, sealCycleEvidence } = ctx();
    const { buildCycleEvidenceDocument } = out();
    const collector = createCycleEvidenceCollector();
    runWithCycleEvidence(collector, () => {
      safeEmit('observer.begin', legalPayload({ seq: 1 }));
      safeEmit('source-completion.result-shape', payload);
      safeEmit('observer.finish', legalPayload({ seq: 1 }));
    });
    const snapshot = sealCycleEvidence(collector);
    assert(snapshot.poisoned === true,
      `${label} 必须把整批标记为中毒（绝不静默丢单条冒充完整）：${JSON.stringify(snapshot)}`);
    const built = buildCycleEvidenceDocument({
      snapshot, captureSha256: CAPTURE_A, recordedAt: RECORDED_AT,
    });
    assert(built?.ok === false && built.reason === 'EVIDENCE_SCHEMA_REJECTED',
      `中毒批次须拒付 EVIDENCE_SCHEMA_REJECTED：${JSON.stringify(built)}`);
  });
}

await check('E1 枚举外 refusalPoint 直击 → 整批毒化（归因面同样闭合）', () => {
  const snapshot = collectOne('zzz.not-a-point', legalPayload());
  assert(snapshot.poisoned === true,
    `枚举外归因点必须毒化整批：${JSON.stringify(snapshot)}`);
});

await check('E1 safeEmit 契约：同步、零返回值、吞异常、不进异步控制流（R4 钉）', () => {
  const { createCycleEvidenceCollector, runWithCycleEvidence, safeEmit } = ctx();
  const collector = createCycleEvidenceCollector();
  runWithCycleEvidence(collector, () => {
    const returned = safeEmit('observer.begin', legalPayload({ seq: 1 }));
    assert(returned === undefined, `safeEmit 必须零返回值，实得 ${JSON.stringify(returned)}`);
    assert(!(returned && typeof returned.then === 'function'), 'safeEmit 不得返回 thenable');
  });
  const src = readFileSync(resolve(ROOT, 'lib/teachin/cycle-evidence-context.mjs'), 'utf8');
  assert(!/\basync\s+function\s+safeEmit\b/.test(src), 'safeEmit 不得是 async 函数');
  // 只截 safeEmit 函数体（起点到下一处顶格 }）判：同步契约、不 await、不进 Promise 链（R4）。
  const start = src.indexOf('function safeEmit');
  assert(start >= 0, 'cycle-evidence-context 须以具名 function 定义 safeEmit（便于逐字节复核同步契约）');
  const end = src.indexOf('\n}', start);
  const body = src.slice(start, end < 0 ? src.length : end);
  for (const forbidden of [/\bawait\b/, /\.then\s*\(/, /new\s+Promise\b/, /queueMicrotask\s*\(/, /setTimeout\s*\(/]) {
    assert(!forbidden.test(body), `safeEmit 函数体命中异步扩散形态 ${forbidden}：${body.slice(0, 200)}`);
  }
  assert(/try\s*\{/.test(body), 'safeEmit 须整体吞异常（try 包裹），绝不许把取证故障抛回生产路径');
});

// ══════════════════════════════════════════════════════════════════════
// E2 吞异常路 ×3：source issuer-throw / resolved / distilled 各合成一例
//    → 只记 {refusalPoint, errorName}，无 message；主结论原样
// ══════════════════════════════════════════════════════════════════════

// 合成「同码生产点」替身：形状与 replay-completion 三处 catch 一致——
// 吞掉异常、返回闭合拒付、不回显原文。取证只是旁路通报，不改任何返回。
function synthCatchSite(refusalPoint, stage, thrower) {
  const { safeEmit, normalizeErrorName } = ctx();
  try {
    thrower();
    return Object.freeze({ ok: false, reason: 'UNREACHABLE' });
  } catch (error) {
    safeEmit(refusalPoint, { stage, reason: 'RUN_COMPLETION_INVALID', errorName: normalizeErrorName(error) });
    return Object.freeze({ ok: false, reason: 'RUN_COMPLETION_INVALID' });
  }
}

const SWALLOW_SITES = [
  ['source issuer-throw', 'source-completion.issuer-throw', 'source-raw-execute'],
  ['resolved issuer-throw', 'resolved-completion.issuer-throw', 'source-resolved-completion'],
  ['distilled issuer-throw', 'distilled-completion.issuer-throw', 'distilled-completion'],
];

for (const [label, refusalPoint, stage] of SWALLOW_SITES) {
  await check(`E2 吞异常路：${label} → 记 {refusalPoint, errorName}、无 message、主结论原样`, () => {
    const { createCycleEvidenceCollector, runWithCycleEvidence, sealCycleEvidence } = ctx();
    // 异常 message 里塞一条绝不许外泄的合成假串（与 E4b 同源夹具）。
    const thrower = () => { throw new TypeError('FAKE_SECRET_abc123 @ https://example.invalid/x'); };
    const collector = createCycleEvidenceCollector();
    let observed;
    runWithCycleEvidence(collector, () => { observed = synthCatchSite(refusalPoint, stage, thrower); });
    const bare = synthCatchSite(refusalPoint, stage, thrower);
    sameShape(observed, bare, `${label} 的主结论必须与无观测上下文时一字不差`);

    const snapshot = sealCycleEvidence(collector);
    assert(snapshot.poisoned === false, `${label} 合法通报不得毒化：${JSON.stringify(snapshot)}`);
    assert(snapshot.events.length === 1, `${label} 须恰一条入档：${JSON.stringify(snapshot.events)}`);
    const record = snapshot.events[0];
    assert(record.refusalPoint === refusalPoint, `${label} 归因失准：${JSON.stringify(record)}`);
    assert(record.errorName === 'TypeError', `${label} 异常名须规范化为 TypeError：${JSON.stringify(record)}`);
    const text = JSON.stringify(snapshot);
    assert(!text.includes('FAKE_SECRET'), `${label} 异常原文不得随通报外泄：${text.slice(-200)}`);
    assert(!text.includes('example.invalid'), `${label} 地址不得随通报外泄：${text.slice(-200)}`);
    assert(!('message' in record), `${label} 不得记 message：${JSON.stringify(record)}`);
  });
}

// ── E2 真实生产路径（codex code-r1 M4 补钉）──────────────────────────
// 上面三例走的是形状替身 synthCatchSite；替身逮不到「生产件把通报接错、或在通报位
// 多套一层包裹改了时序」这类回归。本钉不合成任何拒付点，直接用零 SUT harness 铸出
// genuine source run authority，让现役 executeAuthorizedSourceReplay 真跑进 issuer
// 吞异常位，再断言观测上下文里收到对应归因成员。
function realThrowIssuer() {
  return {
    kind: 'raw',
    // 同步抛：多一层 async 包裹就会多一枚栈帧与一代微任务（codex code-r1 M1 的两轴）。
    executeAndVerify() {
      throw new TypeError('FAKE_SECRET_abc123 @ https://example.invalid/x');
    },
  };
}

async function runRealSourceThrow(tag, collector) {
  const { runWithCycleEvidence } = ctx();
  const built = await harness.buildHappy(tag, { stopBeforeSourceExecution: true });
  const call = () => harness.api.executeAuthorizedSourceReplay({
    runAuthority: built.sourceRun.authority,
    trustedRawReplayIssuer: realThrowIssuer(),
  });
  const result = collector === null ? await call() : await runWithCycleEvidence(collector, call);
  await built.adapter.closeReplayRuntimeOwners({
    runtimeOwnerAuthority: built.sourceFresh.runtimeOwnerAuthority,
  });
  return result;
}

await check('E2 真实生产路径：现役 source completion 的 issuer 吞异常位真通报（零 SUT，不经合成替身）', async () => {
  assert(!harnessImportError && harness?.ready,
    `零 SUT 双回放 harness 不可用：${String(harnessImportError?.message || harness?.loadFailure || '').slice(-200)}`);
  const { createCycleEvidenceCollector, sealCycleEvidence } = ctx();
  const collector = createCycleEvidenceCollector();
  const observed = await runRealSourceThrow('cycle_evidence_real_throw', collector);
  const plain = await runRealSourceThrow('cycle_evidence_real_throw_plain', null);
  sameShape(observed, plain, '观测上下文不得改变现役 completion 的返回');
  assert(observed?.ok === false && observed.reason === 'RUN_COMPLETION_INVALID',
    `现役 completion 的 issuer 抛错须仍诚实吞成闭合拒付：${JSON.stringify(observed)}`);

  const snapshot = sealCycleEvidence(collector);
  assert(snapshot.poisoned === false, `真实通报不得毒化：${JSON.stringify(snapshot)}`);
  assert(snapshot.events.length === 1,
    `真实吞异常位须恰一条入档：${JSON.stringify(snapshot.events)}`);
  const record = snapshot.events[0];
  assert(record.refusalPoint === 'source-completion.issuer-throw',
    `真实归因失准：${JSON.stringify(record)}`);
  assert(record.stage === 'source-raw-execute', `真实阶段失准：${JSON.stringify(record)}`);
  assert(record.reason === 'RUN_COMPLETION_INVALID', `真实拒付码失准：${JSON.stringify(record)}`);
  assert(record.errorName === 'TypeError', `真实异常名须规范化：${JSON.stringify(record)}`);
  assert(!('message' in record), `真实通报不得记 message：${JSON.stringify(record)}`);
  const text = JSON.stringify(snapshot);
  assert(!text.includes('FAKE_SECRET') && !text.includes('example.invalid'),
    `真实通报不得外带异常原文或地址：${text.slice(-200)}`);
});

// ══════════════════════════════════════════════════════════════════════
// E3 发射点矩阵：refusalPoint 枚举逐成员至少一例合成击发、逐点唯一归因（A4）
// ══════════════════════════════════════════════════════════════════════

await check('E3 发射点矩阵：枚举逐成员击发且互不串位', () => {
  const { CYCLE_EVIDENCE_REFUSAL_POINTS } = ctx();
  const seen = new Set();
  for (const point of CYCLE_EVIDENCE_REFUSAL_POINTS) {
    const snapshot = collectOne(point, legalPayload());
    assert(snapshot.poisoned === false, `发射点「${point}」合法击发不得毒化：${JSON.stringify(snapshot)}`);
    assert(snapshot.events.length === 1, `发射点「${point}」须恰一条入档：${JSON.stringify(snapshot.events)}`);
    assert(snapshot.events[0].refusalPoint === point,
      `发射点「${point}」归因串位：${JSON.stringify(snapshot.events[0])}`);
    seen.add(snapshot.events[0].refusalPoint);
  }
  assert(seen.size === CYCLE_EVIDENCE_REFUSAL_POINTS.length,
    `逐点归因须彼此可区分，实得 ${seen.size}/${CYCLE_EVIDENCE_REFUSAL_POINTS.length}`);
  for (const required of REQUIRED_REFUSAL_POINTS) {
    assert(seen.has(required), `矩阵缺生产拒付点「${required}」`);
  }
});

// ── E3 真实分支钉（codex code-r1 M2 补签）────────────────────────────
// extraInputs 闭合键校验虽在 canonical 编排下不可达，但函数由 lib/dual-replay/index.mjs
// 公开导出、外部调用方可直达；A4 是「逐生产点唯一归因」，公开可达就得归因。
// 本组不合成任何替身：直调公开导出、传畸形 extraInputs，断言归因成员、拒付码与事件数。
// 三枚 completion 同形同理由（resolved 那枚拒付码不同），逐枚一钉，不留同形分支不归因。
const PUBLIC_INPUT_SHAPE_BRANCHES = [
  ['executeAuthorizedSourceReplay', 'source-completion.input-shape', 'source-raw-execute',
    'RUN_COMPLETION_INVALID',
    { runAuthority: null, trustedRawReplayIssuer: null, smuggledExtraInput: 1 }],
  ['completeResolvedSourceReplay', 'resolved-completion.input-shape', 'source-resolved-completion',
    'SOURCE_SEMANTIC_COMPLETION_INVALID',
    {
      rawExecutionAuthority: null,
      sourceSemanticGrant: null,
      trustedResolvedSourceIssuer: null,
      smuggledExtraInput: 1,
    }],
  ['completeAuthorizedReplay', 'distilled-completion.input-shape', 'distilled-completion',
    'RUN_COMPLETION_INVALID',
    { runAuthority: null, trustedReplayIssuer: null, smuggledExtraInput: 1 }],
];

for (const [name, point, stage, reason, malformed] of PUBLIC_INPUT_SHAPE_BRANCHES) {
  await check(`E3 真实分支：公开导出 ${name} 的 extraInputs 拒付 → 唯一归因 ${point}`, async () => {
    assert(!dualImportError && typeof dualApi?.[name] === 'function',
      `dual-replay façade 缺公开导出 ${name}：${String(dualImportError?.message || '').slice(-200)}`);
    const { createCycleEvidenceCollector, runWithCycleEvidence, sealCycleEvidence } = ctx();
    const collector = createCycleEvidenceCollector();
    const observed = await runWithCycleEvidence(collector, () => dualApi[name](malformed));
    const plain = await dualApi[name](malformed);
    sameShape(observed, plain, `${name} 的 extraInputs 拒付不得因观测上下文而改变`);
    assert(observed?.ok === false && observed.reason === reason,
      `${name} 的 extraInputs 分支须拒付 ${reason}：${JSON.stringify(observed)}`);
    const snapshot = sealCycleEvidence(collector);
    assert(snapshot.poisoned === false, `${name} 真实分支通报不得毒化：${JSON.stringify(snapshot)}`);
    // 事件数正是 codex 对抗实测的那一枚判据：修前两路均 eventCount=0（零通报）。
    assert(snapshot.events.length === 1,
      `${name} 的 extraInputs 分支须恰通报一条（codex 实测修前为 0）：${JSON.stringify(snapshot.events)}`);
    const row = snapshot.events[0];
    assert(row.refusalPoint === point, `${name} 归因失准：${JSON.stringify(row)}`);
    assert(row.stage === stage, `${name} 阶段失准：${JSON.stringify(row)}`);
    assert(row.reason === reason, `${name} 拒付码失准：${JSON.stringify(row)}`);
    assert(!('errorName' in row), `extraInputs 分支不涉异常，不得记 errorName：${JSON.stringify(row)}`);
  });
}

await check('E3 三枚 input-shape 归因互不串位（同批直调三个公开导出）', async () => {
  assert(!dualImportError, `dual-replay façade 导入失败：${String(dualImportError?.message || '').slice(-200)}`);
  const { createCycleEvidenceCollector, runWithCycleEvidence, sealCycleEvidence } = ctx();
  const collector = createCycleEvidenceCollector();
  await runWithCycleEvidence(collector, async () => {
    for (const [name, , , , malformed] of PUBLIC_INPUT_SHAPE_BRANCHES) {
      await dualApi[name](malformed);
    }
  });
  const snapshot = sealCycleEvidence(collector);
  sameShape(snapshot.events.map((row) => row.refusalPoint),
    PUBLIC_INPUT_SHAPE_BRANCHES.map(([, point]) => point),
    '三枚 input-shape 归因必须逐点唯一、按击发次序只追加');
});

await check('E3 同批多点：一次 cycle 内全枚举击发后仍逐点唯一可读', () => {
  const { createCycleEvidenceCollector, runWithCycleEvidence, safeEmit, sealCycleEvidence, CYCLE_EVIDENCE_REFUSAL_POINTS } = ctx();
  const collector = createCycleEvidenceCollector();
  runWithCycleEvidence(collector, () => {
    CYCLE_EVIDENCE_REFUSAL_POINTS.forEach((point, index) => {
      safeEmit(point, legalPayload({ seq: index + 1 }));
    });
  });
  const snapshot = sealCycleEvidence(collector);
  assert(snapshot.poisoned === false, `全枚举击发不得毒化：${JSON.stringify(snapshot).slice(-300)}`);
  assert(snapshot.events.length === CYCLE_EVIDENCE_REFUSAL_POINTS.length,
    `全枚举击发须逐条只追加不去重，实得 ${snapshot.events.length}`);
  sameShape(snapshot.events.map((row) => row.refusalPoint), [...CYCLE_EVIDENCE_REFUSAL_POINTS],
    '只追加语义须保留击发次序');
});

// ══════════════════════════════════════════════════════════════════════
// E4a 异常名安全规范化组：任意 name / getter 抛错 → 降格 OtherError 并「成功记录」
// ══════════════════════════════════════════════════════════════════════

function hostileNameError() {
  return { get name() { throw new Error('getter 反制'); } };
}
function frozenNameless() {
  return Object.create(null);
}

const ERROR_NAME_CASES = [
  ['内建 TypeError', new TypeError('x'), 'TypeError'],
  ['内建 RangeError', new RangeError('x'), 'RangeError'],
  ['内建 SyntaxError', new SyntaxError('x'), 'SyntaxError'],
  ['自定义 name（白名单外）', Object.assign(new Error('x'), { name: 'EvilCustomError' }), 'OtherError'],
  ['name 为凭据串形态', Object.assign(new Error('x'), { name: 'FAKE_SECRET_abc123' }), 'OtherError'],
  ['name 为地址形态', Object.assign(new Error('x'), { name: 'https://example.invalid/x' }), 'OtherError'],
  ['name 非串（数值）', Object.assign(new Error('x'), { name: 42 }), 'OtherError'],
  ['name getter 抛错', hostileNameError(), 'OtherError'],
  ['无原型裸对象', frozenNameless(), 'OtherError'],
  ['抛出 null', null, 'OtherError'],
  ['抛出裸串', 'boom', 'OtherError'],
  ['抛出 Proxy（任意读抛错）', new Proxy({}, { get() { throw new Error('trap'); } }), 'OtherError'],
];

for (const [label, thrown, expected] of ERROR_NAME_CASES) {
  await check(`E4a 异常名规范化：${label} → ${expected}（成功记录，不拒写）`, () => {
    const { normalizeErrorName, createCycleEvidenceCollector, runWithCycleEvidence, safeEmit, sealCycleEvidence } = ctx();
    const { buildCycleEvidenceDocument, screenCycleEvidenceDocument } = out();
    const name = normalizeErrorName(thrown);
    assert(name === expected, `${label} 应规范化为 ${expected}，实得 ${JSON.stringify(name)}`);
    assert(REQUIRED_ERROR_NAMES.includes(name), `${label} 规范化结果须在白名单内：${name}`);
    const collector = createCycleEvidenceCollector();
    runWithCycleEvidence(collector, () => {
      safeEmit('source-completion.issuer-throw', {
        stage: 'source-raw-execute', reason: 'RUN_COMPLETION_INVALID', errorName: name,
      });
    });
    const snapshot = sealCycleEvidence(collector);
    assert(snapshot.poisoned === false, `${label} 规范化后必须成功记录、绝不毒化：${JSON.stringify(snapshot)}`);
    const built = buildCycleEvidenceDocument({
      snapshot, captureSha256: CAPTURE_A, recordedAt: RECORDED_AT,
    });
    assert(built?.ok === true, `${label} 规范化后应可成档：${JSON.stringify(built)}`);
    const screened = screenCycleEvidenceDocument(built.document);
    assert(screened?.ok === true, `${label} 规范化后应过四层闸：${JSON.stringify(screened)}`);
  });
}

// ══════════════════════════════════════════════════════════════════════
// E4b 凭据/URL 注入组：整文拒写 EVIDENCE_CREDENTIAL_REJECTED（与 E4a 预期分开）
// ══════════════════════════════════════════════════════════════════════

for (const [label, poison] of FAKE_CREDENTIAL_FIXTURES) {
  await check(`E4b 末门整文扫描：${label} → EVIDENCE_CREDENTIAL_REJECTED`, () => {
    const { screenCycleEvidenceText } = out();
    const text = JSON.stringify({
      schemaVersion: 1, artifactKind: 'cycle-evidence',
      captureSha256: CAPTURE_A, recordedAt: RECORDED_AT,
      stages: [], events: [{ refusalPoint: 'observer.begin', stage: 'source-raw-execute', errorName: poison }],
    });
    const screened = screenCycleEvidenceText(text);
    assert(screened?.ok === false && screened.reason === 'EVIDENCE_CREDENTIAL_REJECTED',
      `${label} 必须被末门整文拒付：${JSON.stringify(screened)}`);
  });
}

await check('E4b 文档级注入：过不了闸且一个字节都不落盘', () => {
  const { screenCycleEvidenceDocument, writeCycleEvidenceSidecar, CYCLE_EVIDENCE_REJECTION_CODES } = out();
  const dir = join(tmpRoot, 'e4b-doc');
  mkdirSync(dir, { recursive: true });
  for (const [label, poison] of FAKE_CREDENTIAL_FIXTURES) {
    const document = {
      schemaVersion: 1,
      artifactKind: 'cycle-evidence',
      captureSha256: CAPTURE_A,
      recordedAt: RECORDED_AT,
      stages: [{ stage: 'source-raw-execute', reason: 'RUN_COMPLETION_INVALID' }],
      events: [{
        refusalPoint: 'source-completion.issuer-throw',
        stage: 'source-raw-execute',
        reason: 'RUN_COMPLETION_INVALID',
        errorName: poison,
      }],
    };
    const screened = screenCycleEvidenceDocument(document);
    assert(screened?.ok === false, `${label} 必须过不了闸：${JSON.stringify(screened)}`);
    // 早层（exact-key / 类型 / 地址形态）先命中也算 fail-closed 方向正确；
    // 关键是绝不放行、且拒付码限于三码闭合（末门严格判在上一条钉）。
    assert(CYCLE_EVIDENCE_REJECTION_CODES.includes(screened.reason),
      `${label} 拒付码须落在三码闭合内：${JSON.stringify(screened)}`);
    const written = writeCycleEvidenceSidecar({ outDir: dir, document });
    assert(written?.ok === false, `${label} 拒付后不得落盘：${JSON.stringify(written)}`);
    // 先闸后盘（D4 v3 终修）：闸在内存内序列化之后、写临时文件之前，
    // 凭据拒写路径必须零临时件零目标写入——目录逐次都得干干净净。
    sameShape(allNames(dir), [], `${label} 拒写时目录必须一件不留（含临时件）`);
  }
});

await check('E4b 本金牌自身零真值：夹具全为合成假串与保留域名', () => {
  const self = readFileSync(resolve(HERE, 'teachin-cycle-evidence.zero-sut.golden.mjs'), 'utf8');
  for (const [, poison] of FAKE_CREDENTIAL_FIXTURES) {
    assert(/FAKE_|example\.invalid/.test(poison),
      `注入夹具必须显式为合成假值（合成假凭据串 + 保留域名）：${poison}`);
  }
  // 字面量扫描只管本文件的直接读盘，管不住传递依赖——「零真实凭据读取」由 E4c 机制化承接。
  assert(!/readFileSync\([^)]*\.auth/.test(self), '本金牌不得直接读取 .auth/ 下任何文件');
  assert(!/readFileSync\([^)]*creds/.test(self), '本金牌不得直接读取凭据文件');
});

// ── E4c 凭据闸隔离根：传递依赖零真实凭据读取（codex code-r1 M5）───────
// 原自证钉只扫本金牌文件里的 readFileSync 字面量，而真实链路是
// screenCycleEvidenceText → credentialGate → collectSecretLiterals：传递依赖会去读
// PROJECT_ROOT 下的 .auth/credentials.json 与 site.json。本钉不再靠扫字面量声明，
// 改用三重机制证据：①凭据源路径解析进隔离根；②合成夹具字面量真被闸吃到（正控）
// 且干净整文仍放行（负控，证明闸没被瘫成恒拒）；③读盘探针逐条核路径。
await check('E4c 凭据闸隔离根：凭据源解析进隔离根，真仓凭据件零读取（机制证明）', async () => {
  const { screenCycleEvidenceText } = out();
  assert(typeof ISOLATION_ROOT === 'string' && ISOLATION_ROOT.length > 0,
    '本金牌必须跑在隔离根子进程内（父进程负责重启，见文件抬头）');
  assert(REAL_ROOT && REAL_ROOT !== ISOLATION_ROOT, '隔离根必须与真仓根不同');
  assert(ROOT === ISOLATION_ROOT,
    `本金牌自身必须由隔离根路径加载：ROOT=${ROOT}`);

  // ① 凭据源路径：由现役 lib/paths.mjs 解析，必须整体落在隔离根内。
  const paths = await import('../../lib/paths.mjs');
  assert(paths.PROJECT_ROOT === ISOLATION_ROOT,
    `凭据源根必须解析进隔离根：${paths.PROJECT_ROOT}`);
  for (const [label, value] of [['AUTH_DIR', paths.AUTH_DIR], ['CREDS_FILE', paths.CREDS_FILE]]) {
    assert(value.startsWith(ISOLATION_ROOT + sep),
      `${label} 必须落在隔离根内：${value}`);
    assert(!value.startsWith(REAL_ROOT + sep),
      `${label} 绝不许指向真仓凭据面：${value}`);
  }

  // ② 正控：合成夹具字面量必须真被凭据闸吃到——证明闸接的就是隔离根里的夹具，
  //    不是被架空成恒 ok 的空门。负控：不含夹具字面量的干净整文仍须放行。
  const poisonedText = JSON.stringify({
    schemaVersion: 1, artifactKind: 'cycle-evidence',
    captureSha256: CAPTURE_A, recordedAt: RECORDED_AT,
    stages: [], events: [{ refusalPoint: 'observer.begin', errorName: ISOLATED_FIXTURE_SECRET }],
  });
  const poisoned = screenCycleEvidenceText(poisonedText);
  assert(poisoned?.ok === false && poisoned.reason === 'EVIDENCE_CREDENTIAL_REJECTED',
    `隔离根夹具字面量必须被凭据闸整文拒付（否则闸没真接上夹具）：${JSON.stringify(poisoned)}`);
  const cleanText = JSON.stringify({
    schemaVersion: 1, artifactKind: 'cycle-evidence',
    captureSha256: CAPTURE_A, recordedAt: RECORDED_AT,
    stages: [], events: [{ refusalPoint: 'observer.begin', errorName: 'TypeError' }],
  });
  const clean = screenCycleEvidenceText(cleanText);
  assert(clean?.ok === true,
    `干净整文必须仍放行（闸不得被瘫成恒拒，否则 E4b 那组拒付全是假绿）：${JSON.stringify(clean)}`);

  // ③ 读盘探针：凭据源候选路径逐条核——全在隔离根内，真仓 .auth/site.json 一次不碰。
  const probed = globalThis[FS_PROBE_GLOBAL];
  assert(Array.isArray(probed) && probed.length > 0,
    '读盘探针未装上（隔离根子进程须带 --require 探针启动）');
  const credentialLike = probed.filter((row) => /(?:^|[\\/])(?:credentials\.json|site\.json)$/
    .test(row.path) || /[\\/]\.auth[\\/]/.test(row.path));
  assert(credentialLike.length > 0,
    '探针没记到任何凭据源候选读取——说明本钉没真踩到 credentialGate 的取字面量路径');
  for (const row of credentialLike) {
    assert(row.path.startsWith(ISOLATION_ROOT + sep),
      `凭据源读取逃出隔离根：${row.api} ${row.path}`);
  }
  const realAuthDir = `${REAL_ROOT}${sep}.auth${sep}`;
  const realSite = `${REAL_ROOT}${sep}site.json`;
  for (const row of probed) {
    assert(!row.path.startsWith(realAuthDir) && row.path !== realSite,
      `传递依赖读到了真仓凭据件：${row.api} ${row.path}`);
  }
});

// ══════════════════════════════════════════════════════════════════════
// E5 缺省零行为差：同输入双跑闭环入口（带/不带观测上下文）
//    零 SUT 下走 replayability-cycle-entry 的入参校验拒付路（CYCLE_ENTRY_INPUT_INVALID）；
//    活体段的零行为差由 plan §3 A4 真机重录承接（本金牌如实标注，不冒充覆盖）。
// ══════════════════════════════════════════════════════════════════════

function recordingDoubles(stats, { mismatchedPair = false } = {}) {
  const browser = {
    on: (...args) => { stats.push(`browser.on:${args[0]}`); },
    close: async () => { stats.push('browser.close'); },
    isConnected: () => { stats.push('browser.isConnected'); return true; },
  };
  const other = { on() {}, close() {}, isConnected() { return true; } };
  const context = {
    on: (...args) => { stats.push(`context.on:${args[0]}`); },
    close: async () => { stats.push('context.close'); },
    browser: () => { stats.push('context.browser'); return mismatchedPair ? other : browser; },
  };
  return { browser, context };
}

function badEntryInput(stats, options) {
  const { browser, context } = recordingDoubles(stats, options);
  return {
    caseId: 'tc_cycle_evidence_probe',
    captureBytes: Buffer.from('{"schemaVersion":1}', 'utf8'),
    recordingBrowser: browser,
    recordingContext: context,
    // cycleInput 键集不闭合 → validCycleInput 判假 → CYCLE_ENTRY_INPUT_INVALID
    cycleInput: { sourcePlan: {}, executionTargetAuthority: {}, projection: {} },
  };
}

async function runEntryProbe(options) {
  const stats = [];
  const captured = await captureConsole(async () => {
    const result = await entryApi.runRecordedTeachinReplayabilityCycle(badEntryInput(stats, options));
    // 非空控制台面：把闭合结论回显，双跑逐字节比对才非空转。
    console.error(`probe: ${JSON.stringify(result)}`);
    return result;
  });
  return { result: captured.value, chunks: captured.chunks, stats };
}

const ENTRY_VARIANTS = [
  ['录制句柄对不匹配', { mismatchedPair: true }],
  ['cycleInput 键集不闭合', { mismatchedPair: false }],
];

for (const [label, options] of ENTRY_VARIANTS) {
  await check(`E5b 双跑基线自等（无观测上下文，修前应绿）：${label}`, async () => {
    assert(!entryImportError, `既有入口导入失败：${String(entryImportError?.message || entryImportError).slice(-200)}`);
    const first = await runEntryProbe(options);
    const second = await runEntryProbe(options);
    assert(first.result?.ok === false && first.result.reason === 'CYCLE_ENTRY_INPUT_INVALID',
      `入参校验路应拒付 CYCLE_ENTRY_INPUT_INVALID：${JSON.stringify(first.result)}`);
    sameShape(second.result, first.result, `${label} 同输入双跑返回须深等`);
    sameShape(second.stats, first.stats, `${label} 同输入双跑句柄调用/关闭次数须相等`);
    sameShape(second.chunks, first.chunks, `${label} 同输入双跑控制台输出须全等`);
    assert(first.chunks.length > 0, '控制台对照面不得空转（须有可比字节）');
    assert(first.stats.length > 0, '句柄调用对照面不得空转（须真触到录制句柄）');
  });

  await check(`E5 零行为差：带/不带观测上下文全等 + 零边车副作用：${label}`, async () => {
    const { createCycleEvidenceCollector, runWithCycleEvidence, sealCycleEvidence } = ctx();
    const dir = join(tmpRoot, 'e5-sidecar');
    mkdirSync(dir, { recursive: true });
    const before = sidecarNames(dir);
    const rootBefore = sidecarNames(ROOT);

    const plain = await runEntryProbe(options);
    const collector = createCycleEvidenceCollector();
    const observed = await runWithCycleEvidence(collector, () => runEntryProbe(options));

    sameShape(observed.result, plain.result, `${label} 观测上下文不得改变闭环返回`);
    sameShape(observed.stats, plain.stats, `${label} 观测上下文不得改变句柄调用/关闭次数`);
    sameShape(observed.chunks, plain.chunks, `${label} 观测上下文不得改变控制台输出`);
    const snapshot = sealCycleEvidence(collector);
    assert(snapshot && Array.isArray(snapshot.events),
      `封存须出闭合快照：${JSON.stringify(snapshot)}`);
    sameShape(sidecarNames(dir), before, `${label} 缺省路径不得落任何边车文件`);
    sameShape(sidecarNames(ROOT), rootBefore, `${label} 缺省路径不得往仓库根落边车文件`);
  });
}

// ── E5c 更深路径的零行为差（codex code-r1 M4 补钉）──────────────────
// 上面的 E5 只到入口入参校验（CYCLE_ENTRY_INPUT_INVALID），够不到真实通报路径。
// 本钉用零 SUT harness 把双跑推进到现役 source completion 真正发射通报的那一层：
// 返回深等 + issuer 调用次数相等 + 控制台输出全等 + 零边车副作用。
// 仍如实标注：带真实浏览器的活体段零行为差由 plan §3 的 A4 真机重录承接，本金牌不冒充覆盖。
async function deepCompletionProbe(tag, collector) {
  const { runWithCycleEvidence } = ctx();
  const built = await harness.buildHappy(tag, { stopBeforeSourceExecution: true });
  const stats = [];
  const issuer = {
    kind: 'raw',
    executeAndVerify() {
      stats.push('issuer.executeAndVerify');
      throw new TypeError('FAKE_SECRET_abc123 @ https://example.invalid/x');
    },
  };
  const captured = await captureConsole(async () => {
    const call = () => harness.api.executeAuthorizedSourceReplay({
      runAuthority: built.sourceRun.authority,
      trustedRawReplayIssuer: issuer,
    });
    const result = collector === null ? await call() : await runWithCycleEvidence(collector, call);
    console.error(`deep-probe: ${JSON.stringify(result)}`);
    return result;
  });
  stats.push('owners.close');
  await built.adapter.closeReplayRuntimeOwners({
    runtimeOwnerAuthority: built.sourceFresh.runtimeOwnerAuthority,
  });
  return { result: captured.value, chunks: captured.chunks, stats };
}

await check('E5c 零行为差（更深路径，零 SUT）：现役 source completion 带/不带观测上下文全等', async () => {
  assert(!harnessImportError && harness?.ready,
    `零 SUT 双回放 harness 不可用：${String(harnessImportError?.message || harness?.loadFailure || '').slice(-200)}`);
  const { createCycleEvidenceCollector, sealCycleEvidence } = ctx();
  const dir = join(tmpRoot, 'e5c-sidecar');
  mkdirSync(dir, { recursive: true });
  const before = sidecarNames(dir);
  const rootBefore = sidecarNames(ROOT);

  const plain = await deepCompletionProbe('cycle_evidence_deep_plain', null);
  const collector = createCycleEvidenceCollector();
  const observed = await deepCompletionProbe('cycle_evidence_deep_observed', collector);

  sameShape(observed.result, plain.result, '观测上下文不得改变现役 completion 的返回');
  sameShape(observed.stats, plain.stats, '观测上下文不得改变 issuer 调用/关闭次数');
  sameShape(observed.chunks, plain.chunks, '观测上下文不得改变控制台输出');
  assert(plain.chunks.length > 0, '控制台对照面不得空转');
  const snapshot = sealCycleEvidence(collector);
  assert(snapshot.events.length === 1
    && snapshot.events[0].refusalPoint === 'source-completion.issuer-throw',
  `更深路径双跑须真踩到通报位：${JSON.stringify(snapshot.events)}`);
  sameShape(sidecarNames(dir), before, '缺省路径不得落任何边车文件');
  sameShape(sidecarNames(ROOT), rootBefore, '缺省路径不得往仓库根落边车文件');
});

// ══════════════════════════════════════════════════════════════════════
// E6 收集器中毒钉（v3 重表达 v2 的「sink 中毒」）：
//    观测上下文内的敌意/异物收集器与抛错 getter 载荷 → 发射点全部吞掉、结论与基线全等
// ══════════════════════════════════════════════════════════════════════

const HOSTILE_COLLECTORS = [
  ['异物对象（非本模块铸造）', () => ({})],
  ['任意读即抛的 Proxy', () => new Proxy({}, {
    get() { throw new Error('trap'); },
    has() { throw new Error('trap'); },
    ownKeys() { throw new Error('trap'); },
  })],
  ['null', () => null],
  ['冻结裸对象', () => Object.freeze(Object.create(null))],
];

for (const [label, make] of HOSTILE_COLLECTORS) {
  await check(`E6 收集器中毒：${label} → safeEmit 全吞、闭环结论与基线全等`, async () => {
    const { runWithCycleEvidence, safeEmit, CYCLE_EVIDENCE_REFUSAL_POINTS } = ctx();
    const baseline = await runEntryProbe({ mismatchedPair: true });
    const observed = await runWithCycleEvidence(make(), async () => {
      for (const point of CYCLE_EVIDENCE_REFUSAL_POINTS) safeEmit(point, legalPayload());
      return runEntryProbe({ mismatchedPair: true });
    });
    sameShape(observed.result, baseline.result, `${label} 不得改变闭环结论`);
    sameShape(observed.chunks, baseline.chunks, `${label} 不得改变控制台输出`);
    sameShape(observed.stats, baseline.stats, `${label} 不得改变句柄调用次数`);
  });
}

await check('E6 抛错 getter 载荷：safeEmit 不抛、整批毒化、结论不变', async () => {
  const { createCycleEvidenceCollector, runWithCycleEvidence, safeEmit, sealCycleEvidence } = ctx();
  const baseline = await runEntryProbe({ mismatchedPair: true });
  const collector = createCycleEvidenceCollector();
  const observed = await runWithCycleEvidence(collector, async () => {
    safeEmit('observer.begin', legalPayload({ seq: 1 }));
    safeEmit('source-completion.proof', {
      stage: 'source-raw-execute',
      get reason() { throw new Error('getter 反制'); },
    });
    return runEntryProbe({ mismatchedPair: true });
  });
  sameShape(observed.result, baseline.result, '抛错 getter 载荷不得改变闭环结论');
  const snapshot = sealCycleEvidence(collector);
  assert(snapshot.poisoned === true,
    `安全读取失败的载荷必须毒化整批（绝不静默丢单条冒充完整）：${JSON.stringify(snapshot)}`);
});

await check('E6 观测上下文外击发：不抛、不入任何档', () => {
  const { safeEmit, createCycleEvidenceCollector, sealCycleEvidence } = ctx();
  const collector = createCycleEvidenceCollector();
  safeEmit('observer.begin', legalPayload({ seq: 1 }));
  const snapshot = sealCycleEvidence(collector);
  sameShape(snapshot.events, [], '词法边界之外的击发绝不许串进任何收集器');
});

// ══════════════════════════════════════════════════════════════════════
// E7 身份绑定：digest 派生文件名 + 绑定单判（v2 的时间双判措辞作废）
//
// 威胁模型（GRILL D4，codex code-r1 M3 收窄后的口径）：边车是开发期诊断件，
//   落点就是本次 run 可写的 out-dir。本组钉的是「误放/残留的旧档不被当成本次证据」：
//   文件名按全量 digest 派生 + 读取方用顶层 captureSha256 复核内文。
//   明确不钉「同一可写目录内的蓄意篡改」——协调改名与改内文顶层摘要确实能冒充，
//   但同一把写权限连 capture 本体都能改，那要靠可信收据/manifest 链，属后继契约。
// ══════════════════════════════════════════════════════════════════════

function buildDoc(captureSha256, recordedAt = RECORDED_AT) {
  const { createCycleEvidenceCollector, runWithCycleEvidence, safeEmit, sealCycleEvidence } = ctx();
  const { buildCycleEvidenceDocument } = out();
  const collector = createCycleEvidenceCollector();
  runWithCycleEvidence(collector, () => {
    safeEmit('observer.begin', legalPayload({ seq: 1 }));
    safeEmit('source-completion.raw-status', legalPayload({ seq: 1 }));
  });
  const built = buildCycleEvidenceDocument({
    snapshot: sealCycleEvidence(collector), captureSha256, recordedAt,
  });
  assert(built?.ok === true, `成档失败：${JSON.stringify(built)}`);
  return built.document;
}

await check('E7 文件名按完整 digest 派生：cycle-evidence.<captureSha256 全量>.json', () => {
  const { cycleEvidenceFileName } = out();
  assert(cycleEvidenceFileName(CAPTURE_A) === `cycle-evidence.${CAPTURE_A}.json`,
    `文件名须按全量 digest 派生（12 位仅 48 位命名空间不够）：${cycleEvidenceFileName(CAPTURE_A)}`);
  assert(cycleEvidenceFileName(CAPTURE_A) !== cycleEvidenceFileName(CAPTURE_B),
    '异 capture 的文件名必须天然不碰撞');
  for (const bad of ['', 'nothex', CAPTURE_A.slice(0, 12), `${CAPTURE_A}ff`, '../etc/passwd',
    `${CAPTURE_A.slice(0, 63)}/`, CAPTURE_A.toUpperCase(), null, 7, {}]) {
    let derived = null;
    try { derived = cycleEvidenceFileName(bad); } catch { derived = null; }
    assert(derived === null, `非法 captureSha256「${String(bad)}」不得派生出文件名：${String(derived)}`);
  }
});

await check('E7 前 12 位相同的两枚完整 digest → 不同目标文件（D4 v3 终修钉）', () => {
  const { cycleEvidenceFileName, writeCycleEvidenceSidecar, readCycleEvidence } = out();
  assert(CAPTURE_A.slice(0, 12) === CAPTURE_A_TWIN.slice(0, 12) && CAPTURE_A !== CAPTURE_A_TWIN,
    '夹具自证：两枚 digest 前 12 位须相同、全量须不同');
  assert(cycleEvidenceFileName(CAPTURE_A) !== cycleEvidenceFileName(CAPTURE_A_TWIN),
    '前 12 位相同的两枚 digest 绝不许派生成同一目标文件（12 位派生会撞）');
  const dir = join(tmpRoot, 'e7-twin');
  mkdirSync(dir, { recursive: true });
  assert(writeCycleEvidenceSidecar({ outDir: dir, document: buildDoc(CAPTURE_A) })?.ok === true,
    'A 档应落盘');
  assert(writeCycleEvidenceSidecar({ outDir: dir, document: buildDoc(CAPTURE_A_TWIN) })?.ok === true,
    'A-twin 档应落盘');
  assert(sidecarNames(dir).length === 2,
    `两枚同前缀 digest 须落成两个文件，实得 ${JSON.stringify(sidecarNames(dir))}`);
  const readA = readCycleEvidence(CAPTURE_A, { outDir: dir });
  const readTwin = readCycleEvidence(CAPTURE_A_TWIN, { outDir: dir });
  assert(readA?.ok === true && readA.document.captureSha256 === CAPTURE_A,
    `读取方须按全量 digest 定位到 A：${JSON.stringify(readA)}`);
  assert(readTwin?.ok === true && readTwin.document.captureSha256 === CAPTURE_A_TWIN,
    `读取方须按全量 digest 定位到 A-twin：${JSON.stringify(readTwin)}`);
});

await check('E7 绑定单判：两个不同 capture 的档并存，读取方只认匹配者', () => {
  const { writeCycleEvidenceSidecar, readCycleEvidence, cycleEvidenceFileName } = out();
  const dir = join(tmpRoot, 'e7-binding');
  mkdirSync(dir, { recursive: true });
  const docA = buildDoc(CAPTURE_A, '2026-07-01T00:00:00.000Z');
  const docB = buildDoc(CAPTURE_B, '2026-07-29T12:00:00.000Z');
  const wroteA = writeCycleEvidenceSidecar({ outDir: dir, document: docA });
  const wroteB = writeCycleEvidenceSidecar({ outDir: dir, document: docB });
  assert(wroteA?.ok === true && wroteB?.ok === true,
    `两份合格边车都应落盘：${JSON.stringify({ wroteA, wroteB })}`);
  sameShape(sidecarNames(dir), [cycleEvidenceFileName(CAPTURE_A), cycleEvidenceFileName(CAPTURE_B)].sort(),
    '落盘文件名须按全量 digest 派生且互不覆盖');

  const readA = readCycleEvidence(CAPTURE_A, { outDir: dir });
  assert(readA?.ok === true && readA.document.captureSha256 === CAPTURE_A,
    `读取须只认本 capture 的档：${JSON.stringify(readA)}`);
  // 绑定单判：recordedAt 更旧的 A 档仍被本 capture 认领——时间不参与判定（v2 时间双判作废）。
  assert(readA.document.recordedAt === '2026-07-01T00:00:00.000Z',
    `recordedAt 仅供人读，绝不参与绑定判定：${JSON.stringify(readA.document)}`);

  const readC = readCycleEvidence(CAPTURE_C, { outDir: dir });
  assert(readC?.ok === false && !readC.document,
    `无匹配 digest 时绝不许冒认既有旧档：${JSON.stringify(readC)}`);
});

// 只钉「单侧改名」这一路：文件名改成本次 digest、内文仍是旧档身份 → 复核拒认。
// 协调双改（改名 + 同步改内文顶层摘要）不在威胁模型内，见本段抬头。
await check('E7 改名冒充：文件名 digest 对但内文 captureSha256 不对 → 读取方复核拒认', () => {
  const { readCycleEvidence, cycleEvidenceFileName } = out();
  const dir = join(tmpRoot, 'e7-rename');
  mkdirSync(dir, { recursive: true });
  const docB = buildDoc(CAPTURE_B);
  writeFileSync(join(dir, cycleEvidenceFileName(CAPTURE_A)), `${JSON.stringify(docB, null, 2)}\n`, 'utf8');
  const read = readCycleEvidence(CAPTURE_A, { outDir: dir });
  assert(read?.ok === false && !read.document,
    `内文绑定失配的改名件必须被顶层 captureSha256 复核拦下：${JSON.stringify(read)}`);
});

await check('E7 拒写不触既有目标：旧档在场 + 本次拒写 → 旧档字节原样、不被误认', () => {
  const { writeCycleEvidenceSidecar, readCycleEvidence, cycleEvidenceFileName } = out();
  const dir = join(tmpRoot, 'e7-refuse');
  mkdirSync(dir, { recursive: true });
  const docA = buildDoc(CAPTURE_A);
  assert(writeCycleEvidenceSidecar({ outDir: dir, document: docA })?.ok === true, '基线档应落盘');
  const target = join(dir, cycleEvidenceFileName(CAPTURE_A));
  const beforeBytes = readFileSync(target);
  const beforeNames = allNames(dir);

  // 同 capture 的一份不合格档（凭据命中）——四层闸拒付，绝不触碰既有目标。
  const poisoned = { ...docA, events: [{ ...docA.events[0], errorName: 'FAKE_SECRET_abc123' }] };
  const refused = writeCycleEvidenceSidecar({ outDir: dir, document: poisoned });
  assert(refused?.ok === false, `不合格档必须拒写：${JSON.stringify(refused)}`);
  assert(REQUIRED_REJECTION_CODES.includes(refused.reason),
    `拒写码须落在三码闭合内：${JSON.stringify(refused)}`);
  assert(readFileSync(target).equals(beforeBytes), '拒写路径绝不许触碰既有目标文件字节');
  sameShape(allNames(dir), beforeNames, '拒写路径只清临时件，不得留残件、不得多出文件');

  // 另一 capture 的拒写：旧档仍在，但绝不被新 capture 误认。
  const foreign = { ...buildDoc(CAPTURE_B), events: [{ ...docA.events[0], errorName: 'FAKE_SECRET_abc123' }] };
  const refusedB = writeCycleEvidenceSidecar({ outDir: dir, document: foreign });
  assert(refusedB?.ok === false, `异 capture 的不合格档同样拒写：${JSON.stringify(refusedB)}`);
  const readB = readCycleEvidence(CAPTURE_B, { outDir: dir });
  assert(readB?.ok === false && !readB.document,
    `本次拒写后旧档绝不许被当作本次证据：${JSON.stringify(readB)}`);
});

await check('E7 写盘失败：只清临时件、绝不触目标，报 EVIDENCE_WRITE_FAILED', () => {
  const { writeCycleEvidenceSidecar } = out();
  const missing = join(tmpRoot, 'e7-absent', 'deeper', 'still-absent');
  const result = writeCycleEvidenceSidecar({ outDir: missing, document: buildDoc(CAPTURE_A) });
  assert(result?.ok === false && result.reason === 'EVIDENCE_WRITE_FAILED',
    `不可写目录须报 EVIDENCE_WRITE_FAILED：${JSON.stringify(result)}`);
  assert(!existsSync(missing), '写盘失败不得凭空造出目录');
});

await check('E7 顶层形状：exact-key 闭合 + artifactKind 绑定', () => {
  const { screenCycleEvidenceDocument } = out();
  const document = buildDoc(CAPTURE_A);
  sameShape(Object.keys(document).sort(), [...REQUIRED_DOCUMENT_KEYS].sort(),
    '边车顶层键集必须 exact 闭合');
  assert(document.artifactKind === 'cycle-evidence',
    `artifactKind 漂移：${document.artifactKind}`);
  for (const [label, mutate] of [
    ['多一个顶层键', (d) => { d.extra = 1; }],
    ['少一个顶层键', (d) => { delete d.recordedAt; }],
    ['artifactKind 换绑', (d) => { d.artifactKind = 'teach-in-capture'; }],
    ['captureSha256 非 64 位十六进制', (d) => { d.captureSha256 = 'nothex'; }],
    ['events 非数组', (d) => { d.events = { evil: 1 }; }],
  ]) {
    const bad = JSON.parse(JSON.stringify(document));
    mutate(bad);
    const screened = screenCycleEvidenceDocument(bad);
    assert(screened?.ok === false && screened.reason === 'EVIDENCE_SCHEMA_REJECTED',
      `${label} 须被首层闸拒付 EVIDENCE_SCHEMA_REJECTED：${JSON.stringify(screened)}`);
  }
});

// ══════════════════════════════════════════════════════════════════════
// E8 并发双 cycle 零串账（v3 弃 enterWith 的直接理由）+ 封存后只计数
// ══════════════════════════════════════════════════════════════════════

await check('E8 并发双 als.run 各自收集、零串账', async () => {
  const { createCycleEvidenceCollector, runWithCycleEvidence, safeEmit, sealCycleEvidence } = ctx();
  const tick = () => new Promise((done) => { setImmediate(done); });
  const a = createCycleEvidenceCollector();
  const b = createCycleEvidenceCollector();
  const runA = runWithCycleEvidence(a, async () => {
    safeEmit('observer.begin', legalPayload({ seq: 11 }));
    await tick();
    safeEmit('observer.finish', legalPayload({ seq: 11 }));
    await tick();
    safeEmit('source-completion.proof', legalPayload({ seq: 11 }));
    return 'A';
  });
  const runB = runWithCycleEvidence(b, async () => {
    await tick();
    safeEmit('prepared-runtime.claim', legalPayload({ seq: 22 }));
    await tick();
    safeEmit('orchestrator.stage-boundary', legalPayload({ seq: 22 }));
    return 'B';
  });
  const [ra, rb] = await Promise.all([runA, runB]);
  assert(ra === 'A' && rb === 'B', `词法包裹须原样透传返回值：${JSON.stringify([ra, rb])}`);
  const snapA = sealCycleEvidence(a);
  const snapB = sealCycleEvidence(b);
  sameShape(snapA.events.map((row) => row.refusalPoint),
    ['observer.begin', 'observer.finish', 'source-completion.proof'],
    'A 收集器不得收到 B 的事件');
  sameShape(snapB.events.map((row) => row.refusalPoint),
    ['prepared-runtime.claim', 'orchestrator.stage-boundary'],
    'B 收集器不得收到 A 的事件');
  assert(snapA.events.every((row) => row.seq === 11), `A 串账：${JSON.stringify(snapA.events)}`);
  assert(snapB.events.every((row) => row.seq === 22), `B 串账：${JSON.stringify(snapB.events)}`);
});

await check('E8 封存后迟到击发：只计数、不入档（迟到异步任务零串账）', async () => {
  const { createCycleEvidenceCollector, runWithCycleEvidence, safeEmit, sealCycleEvidence, inspectCycleEvidence } = ctx();
  const collector = createCycleEvidenceCollector();
  let late = null;
  await runWithCycleEvidence(collector, async () => {
    safeEmit('observer.begin', legalPayload({ seq: 1 }));
    // 迟到异步任务：cycle 词法边界内起、边界外才落地。
    late = new Promise((done) => {
      setTimeout(() => {
        safeEmit('observer.finish', legalPayload({ seq: 1 }));
        done();
      }, 5);
    });
  });
  const sealed = sealCycleEvidence(collector);
  assert(sealed.events.length === 1, `封存时须只含边界内已落地事件：${JSON.stringify(sealed.events)}`);
  await late;
  const after = inspectCycleEvidence(collector);
  assert(after.events.length === 1,
    `封存后迟到击发绝不许入档：${JSON.stringify(after.events)}`);
  assert(Number.isSafeInteger(after.lateEmitCount) && after.lateEmitCount >= 1,
    `封存后迟到击发须只计数（lateEmitCount >= 1）：${JSON.stringify(after)}`);
  assert(after.sealed === true, `封存标记须可读：${JSON.stringify(after)}`);
});

await check('E8 重复封存幂等：不得二次改写既有快照', () => {
  const { createCycleEvidenceCollector, runWithCycleEvidence, safeEmit, sealCycleEvidence } = ctx();
  const collector = createCycleEvidenceCollector();
  runWithCycleEvidence(collector, () => { safeEmit('observer.begin', legalPayload({ seq: 1 })); });
  const first = sealCycleEvidence(collector);
  const second = sealCycleEvidence(collector);
  sameShape(second.events, first.events, '重复封存不得改写快照');
});

// ══════════════════════════════════════════════════════════════════════
// E9 依赖闭包三钉（GRILL D5 E9 / plan §2）：
//   ① context 件源零 node:fs 且零 import output 件（堵 context→output→fs 传递链）；
//   ② output 件全仓 import 站点仅 bin/record.mjs（全仓扫描，堵旁门导入）；
//   ③ 各纯核心件取证相关 import 只指向 context 件。
// ══════════════════════════════════════════════════════════════════════

const CONTEXT_REL = 'lib/teachin/cycle-evidence-context.mjs';
const OUTPUT_REL = 'lib/teachin/cycle-evidence-output.mjs';
// 纯核心：一旦经传递依赖把写盘拖进来，双回放纯核心的「零 fs」不变量即失守。
// 逐件对应 plan §1.3 的 safeEmit 落点 + §1.4 明确不改但在链路上的两件。
const PURE_CORE_RELS = Object.freeze([
  'lib/dual-replay/replay-completion.mjs',
  'lib/teachin/raw-replay-runner.mjs',
  'lib/teachin/raw-event-observation.mjs',
  'lib/teachin/raw-axes-adapter.mjs',
  'lib/teachin/prepared-runtime-seam.mjs',
  'lib/teachin/dual-replay-orchestrator-core.mjs',
  'lib/teachin/dual-replay-orchestrator.mjs',
  'lib/teachin/replayability-cycle-entry.mjs',
]);
// plan §1.3：这几件必须真接上通报点（修前无 import 即红，属预期）。
const EMITTING_RELS = Object.freeze([
  'lib/dual-replay/replay-completion.mjs',
  'lib/teachin/raw-replay-runner.mjs',
  'lib/teachin/raw-event-observation.mjs',
  'lib/teachin/raw-axes-adapter.mjs',
  'lib/teachin/prepared-runtime-seam.mjs',
  'lib/teachin/dual-replay-orchestrator-core.mjs',
]);

await check('E9a-① 纯上下文件零 node:fs、零 I/O 家族、零 import output 件', () => {
  const abs = resolve(ROOT, CONTEXT_REL);
  assert(existsSync(abs), `缺 ${CONTEXT_REL}（实现模块尚未落地）`);
  const src = readFileSync(abs, 'utf8');
  for (const forbidden of [
    /from\s+['"]node:(?:fs|fs\/promises|child_process|http|https|net|tls|dgram|worker_threads)['"]/,
    /\bimport\s*\(\s*['"]node:(?:fs|child_process)/,
    /require\s*\(\s*['"]node:?fs/,
    /from\s+['"]@playwright\//,
  ]) {
    assert(!forbidden.test(src), `${CONTEXT_REL} 命中禁用依赖 ${forbidden}`);
  }
  // 传递链的关键一环：context 自己去 import output，纯核心就经 context 间接吃到写盘。
  assert(!/cycle-evidence-output/.test(src),
    `${CONTEXT_REL} 不得 import output 件（否则 context→output→fs 传递链把写盘拖进纯核心）`);
  assert(/node:async_hooks/.test(src),
    `${CONTEXT_REL} 须用 node:async_hooks 的 AsyncLocalStorage（D1 定案）`);
  assert(!/\benterWith\s*\(/.test(src),
    `${CONTEXT_REL} 不得用 enterWith（无词法退出、迟到异步任务会串账，v3 已弃）`);
  assert(/\.run\s*\(/.test(src), `${CONTEXT_REL} 须用 als.run 的词法边界`);
});

await check('E9b-② output 件全仓 import 站点恰为 bin/record.mjs', () => {
  // 全仓扫描（tests 也扫）：旁门导入无论落在哪层都算失守；本金牌自身按文件名豁免。
  const scanned = [
    ...walkSources(resolve(ROOT, 'lib'), 'lib', []),
    ...walkSources(resolve(ROOT, 'bin'), 'bin', []),
    ...walkSources(resolve(ROOT, 'tests'), 'tests', []),
  ];
  const importers = scanned.filter((rel) => {
    if (rel === OUTPUT_REL) return false;
    if (rel.endsWith('teachin-cycle-evidence.zero-sut.golden.mjs')) return false;
    const src = readFileSync(resolve(ROOT, rel), 'utf8');
    return /cycle-evidence-output/.test(src);
  }).sort();
  sameShape(importers, ['bin/record.mjs'],
    'cycle-evidence-output 全仓 import 站点只许 bin/record.mjs（修前无导入方即红，属预期）');
});

await check('E9c-③ 各纯核心件取证 import 只指向 context 件', () => {
  for (const rel of PURE_CORE_RELS) {
    const src = readFileSync(resolve(ROOT, rel), 'utf8');
    assert(!/cycle-evidence-output/.test(src),
      `${rel} 不得导入 cycle-evidence-output（写盘绝不许进纯核心）`);
    const evidenceImports = (src.match(/from\s+['"][^'"]*cycle-evidence[^'"]*['"]/g) || [])
      .map((row) => row.replace(/^from\s+['"]|['"]$/g, ''));
    for (const spec of evidenceImports) {
      assert(/cycle-evidence-context\.mjs$/.test(spec),
        `${rel} 的取证相关导入只许指向 context 件，实得「${spec}」`);
    }
  }
  for (const rel of EMITTING_RELS) {
    const src = readFileSync(resolve(ROOT, rel), 'utf8');
    assert(/cycle-evidence-context/.test(src),
      `${rel} 是 plan §1.3 的 safeEmit 落点，须导入 context 件（修前无此导入即红，属预期）`);
    assert(/safeEmit\s*\(/.test(src), `${rel} 须真调 safeEmit 通报，不得只导入不发射`);
  }
});

await check('E9f 生产 façade 纯委托：dual-replay-orchestrator.mjs 零取证语义（明确不改）', () => {
  const rel = 'lib/teachin/dual-replay-orchestrator.mjs';
  const src = readFileSync(resolve(ROOT, rel), 'utf8');
  assert(/dual-replay-orchestrator-core\.mjs/.test(src),
    `${rel} 须仍是通向 core 的那一跳（真实链路多一跳生产 façade）`);
  assert(!/cycle-evidence/.test(src),
    `${rel} 是纯委托 façade、零拒付语义，不得沾任何取证面（plan §1.4 明确不改）`);
  const entry = readFileSync(resolve(ROOT, 'lib/teachin/replayability-cycle-entry.mjs'), 'utf8');
  assert(/dual-replay-orchestrator\.mjs/.test(entry),
    '入口件须仍经生产 façade 一跳进 core（链路形状不得被本契约改写）');
});

await check('E9d bin/record.mjs 用词法边界包裹单次 cycle 且聚合前封存', () => {
  const src = readFileSync(resolve(ROOT, 'bin/record.mjs'), 'utf8');
  assert(/cycle-evidence-context/.test(src), 'bin/record.mjs 须引纯上下文件（收集器 + 词法边界）');
  assert(/cycle-evidence-output/.test(src), 'bin/record.mjs 须引落盘件（四层闸 + 原子写）');
  assert(/runWithCycleEvidence\s*\(/.test(src),
    'bin/record.mjs 须以 runWithCycleEvidence 词法包裹单次 cycle');
  assert(/sealCycleEvidence\s*\(/.test(src), 'bin/record.mjs 须在聚合前封存收集器');
  assert(!/enterWith/.test(src), 'bin/record.mjs 不得用 enterWith');
  for (const code of REQUIRED_REJECTION_CODES) {
    assert(src.includes(code), `bin/record.mjs 须能报三码之一「${code}」（请求取证而未产合格边车时非零）`);
  }
});

await check('E9e 生产件行数纪律（新件与被改件逐个严格小于 600 行）', () => {
  const violations = [];
  for (const rel of [CONTEXT_REL, OUTPUT_REL, ...PURE_CORE_RELS, 'bin/record.mjs',
    'lib/teachin/raw-axes-adapter.mjs', 'lib/teachin/prepared-runtime-seam.mjs']) {
    const abs = resolve(ROOT, rel);
    if (!existsSync(abs)) { violations.push(`${rel}:缺席`); continue; }
    const lines = readFileSync(abs, 'utf8').split(/\r?\n/).length;
    if (lines >= 600) violations.push(`${rel}:${lines}`);
  }
  assert(violations.length === 0, `超行或缺件：${violations.join(', ')}`);
});

} finally {
  rmSync(tmpRoot, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`\n${TAG}: ${passed} passed, ${failures.length} failed`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`\n${TAG}: ${passed} passed, 0 failed`);
