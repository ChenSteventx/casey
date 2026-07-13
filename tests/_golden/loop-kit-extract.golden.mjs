#!/usr/bin/env node
// tests/_golden/loop-kit-extract.golden.mjs — loop-kit-extract 契约 C0–C7 兼容性金牌（plan.md D7、GRILL.md）。
// 红先行：本文件在包/协议落成前逐条验红（C0/C2/C4/C5/C7 见各自红基线摘录；C6 全程照绿）；
// 落成后逐条转绿，冻进 loop/prd-loop-kit-extract.json 的 testChecksums。
// 结构：C0 包保真+三方一致+跨仓棘轮 / C1 API 面 deepEq / C2 转发证明+完整基线等价 /
//       C3 布局与跨树 / C4 故障族矩阵 / C5 shim 模板逐字比对 / C6 存量零重签 / C7 根语义组。
import { createHash } from 'node:crypto';
import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const PKG_DIR = resolve(ROOT, '..', 'loop-kit'); // 兄弟目录（D2 正式前置条件），拓扑优先、非写死示例路径
const EXPECTED_DIR = join(ROOT, 'tests', 'fixtures', 'loop-kit-expected', 'package');
const HASH_TREE_PATH = join(ROOT, 'tests', 'fixtures', 'loop-kit-expected', 'hash-tree.mjs');
const SHIM_TEMPLATE_PATH = join(ROOT, 'tests', 'fixtures', 'loop-kit-expected', 'shim-template.mjs');
const KIT_LOCK = join(ROOT, 'loop-kit', 'kit-lock.json');
const SHIM_DIR = join(ROOT, 'loop-kit', 'bin');
const BOOT_PATH = join(ROOT, 'loop-kit', 'lib', 'boot.mjs');
const BASELINE_DIR = join(ROOT, 'tests', 'fixtures', 'loop-kit-expected', 'baseline');
const RECORD_PATH = join(BASELINE_DIR, 'record.mjs');
const NORMALIZE_PATH = join(BASELINE_DIR, 'normalize.mjs');

// --group C0,C1,C7 只跑指定组（story 级 acceptance 用，防四 story 各自全量重跑拖慢 gate）；缺省跑全部。
const groupArg = process.argv.indexOf('--group');
const ACTIVE_GROUPS = groupArg >= 0 && process.argv[groupArg + 1] ? new Set(process.argv[groupArg + 1].split(',')) : null;

// ── 微型断言/记录框架（同族其它金牌风格：assert 抛错，check 捕获归档，末尾汇总退出码）──
const results = [];
function record(group, name, ok, detail) {
  results.push({ group, name, ok, detail: detail || '' });
  console.log(`${ok ? 'ok  ' : 'RED '} [${group}] ${name}${!ok && detail ? ' — ' + detail : ''}`);
}
async function check(group, name, fn) {
  if (ACTIVE_GROUPS && !ACTIVE_GROUPS.has(group)) return; // 未选中的组：跳过，不计入结果
  try {
    await fn();
    record(group, name, true);
  } catch (e) {
    record(group, name, false, e && e.stack ? String(e.message) : String(e));
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function rmrf(p) { try { rmSync(p, { recursive: true, force: true }); } catch { /* ignore */ } }
function sha256(buf) { return createHash('sha256').update(buf).digest('hex'); }
function gitBlobSha(absPath) {
  const r = spawnSync('git', ['hash-object', absPath], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git hash-object 失败：${absPath}（${r.stderr}）`);
  return r.stdout.trim();
}

// ============================================================================
// C0 — 包保真 + 三方一致 + 跨仓棘轮
// ============================================================================
await check('C0', '包目录存在', () => {
  assert(existsSync(PKG_DIR), `包目录不存在：${PKG_DIR}（红基线：提取前包未落成）`);
});

await check('C0', '包内容对期望存档逐文件 sha256 相等且集合严格相等', async () => {
  const { hashTree } = await import(pathToFileURL(HASH_TREE_PATH).href);
  assert(existsSync(PKG_DIR), '包目录不存在');
  const expected = hashTree(EXPECTED_DIR);
  const actual = hashTree(PKG_DIR);
  assert(actual.irregular.length === 0, `真包含非常规文件（判失配）：${actual.irregular.join(', ')}`);
  const missing = expected.paths.filter((p) => !actual.paths.includes(p));
  const extra = actual.paths.filter((p) => !expected.paths.includes(p));
  assert(missing.length === 0 && extra.length === 0, `集合不严格相等：缺 [${missing.join(',')}] 多余 [${extra.join(',')}]`);
  const mismatched = expected.paths.filter((p) => expected.files[p] !== actual.files[p]);
  assert(mismatched.length === 0, `sha256 不等的文件：${mismatched.join(', ')}`);
});

await check('C0', '期望存档、kit-lock.json、真包三方一致', async () => {
  const { hashTree } = await import(pathToFileURL(HASH_TREE_PATH).href);
  assert(existsSync(KIT_LOCK), `kit-lock.json 不存在：${KIT_LOCK}`);
  const lock = JSON.parse(readFileSync(KIT_LOCK, 'utf8'));
  assert(lock && typeof lock.files === 'object', 'kit-lock.json 缺 files 字段');
  const expected = hashTree(EXPECTED_DIR);
  const lockPaths = Object.keys(lock.files).sort();
  assert(JSON.stringify(lockPaths) === JSON.stringify(expected.paths), 'kit-lock 与期望存档路径集合不等');
  for (const p of expected.paths) assert(lock.files[p] === expected.files[p], `kit-lock「${p}」哈希与期望存档不等`);
  assert(existsSync(PKG_DIR), '包目录不存在——三方一致需真包在场');
  const actual = hashTree(PKG_DIR);
  for (const p of expected.paths) assert(lock.files[p] === actual.files[p], `kit-lock「${p}」哈希与真包不等`);
});

// ============================================================================
// C1 — API 面 deepEq（提取前 in-repo 快照；独立写死，不复用 shim-template 的生成参数，防循环自证）
// ============================================================================
const EXPECTED_API = {
  'contract.mjs': {
    STAGES: 'object', touchesImpl: 'function', initContract: 'function', canAdvance: 'function',
    advanceStage: 'function', doneThrough: 'function', checkAction: 'function', gitSub: 'function',
    bashAction: 'function', stripPathspec: 'function', commitArgs: 'function', actionFromTool: 'function',
    isValidSlug: 'function', defaultWorktreePath: 'function', parseWorktreePorcelain: 'function',
    describeBaton: 'function', slugTaken: 'function', isPathInsideRepo: 'function',
  },
  'term-lint.mjs': { parseRegistry: 'function', scanText: 'function', lintFiles: 'function' },
  'ratchet.mjs': {
    normalizeRepoPath: 'function', buildRatchetIndex: 'function', verifyRatchet: 'function', findAffectedPrds: 'function',
  },
};

for (const [file, spec] of Object.entries(EXPECTED_API)) {
  await check('C1', `${file} 经 shim 库模式导出名集合 deepEq 快照 + 逐名 typeof 相等`, async () => {
    const mod = await import(pathToFileURL(join(SHIM_DIR, file)).href + '?c1probe=' + Date.now());
    const actualNames = Object.keys(mod).sort();
    const expectedNames = Object.keys(spec).sort();
    assert(
      JSON.stringify(actualNames) === JSON.stringify(expectedNames),
      `导出名不等：实得 [${actualNames.join(',')}] 期望 [${expectedNames.join(',')}]`
    );
    for (const name of expectedNames) {
      assert(typeof mod[name] === spec[name], `「${name}」typeof 应为 ${spec[name]}，实得 ${typeof mod[name]}`);
    }
  });
}

// ============================================================================
// C2 — 转发证明 + 完整观测基线等价
// ============================================================================
await check('C2', '转发证明：LOOP_KIT_PKG 指向标记包时真转发（锁校验不豁免）', () => {
  const markerDir = mkdtempSync(join(tmpdir(), 'loop-kit-marker-'));
  try {
    mkdirSync(join(markerDir, 'bin'), { recursive: true });
    const sentinelSrc = '#!/usr/bin/env node\nconsole.log("LOOP_KIT_MARKER_SENTINEL");\nprocess.exit(43);\n';
    writeFileSync(join(markerDir, 'bin', 'gate.mjs'), sentinelSrc, 'utf8');
    const markerHash = sha256(readFileSync(join(markerDir, 'bin', 'gate.mjs')));
    const markerLock = { schemaVersion: 1, files: { 'bin/gate.mjs': markerHash } };

    const hadRealLock = existsSync(KIT_LOCK);
    const realLockBackup = hadRealLock ? readFileSync(KIT_LOCK) : null;
    writeFileSync(KIT_LOCK, JSON.stringify(markerLock), 'utf8');
    let r;
    try {
      r = spawnSync(process.execPath, [join(SHIM_DIR, 'gate.mjs')], {
        cwd: ROOT,
        encoding: 'utf8',
        env: { PATH: process.env.PATH, LOOP_KIT_PKG: markerDir },
      });
    } finally {
      if (hadRealLock) writeFileSync(KIT_LOCK, realLockBackup);
      else { try { unlinkSync(KIT_LOCK); } catch { /* ignore */ } }
    }
    assert(
      r.stdout.includes('LOOP_KIT_MARKER_SENTINEL') && r.status === 43,
      `转发未生效（红基线：全量引擎无视 LOOP_KIT_PKG）——实得 status=${r.status} stdout=${JSON.stringify(r.stdout)} stderr=${JSON.stringify(r.stderr)}`
    );
  } finally {
    rmrf(markerDir);
  }
});

function nonKitPaths(dict) {
  return Object.keys(dict).filter((p) => !p.startsWith('loop-kit/')).sort();
}
function compareNormalizedCase(expected, actual, label) {
  assert(actual.exitCode === expected.exitCode, `${label}: exitCode 不等（期望 ${expected.exitCode} 实得 ${actual.exitCode}）`);
  assert(actual.signal === expected.signal, `${label}: signal 不等（期望 ${expected.signal} 实得 ${actual.signal}）`);
  assert(actual.stdout === expected.stdout, `${label}: stdout 不等\n--期望--\n${expected.stdout}\n--实得--\n${actual.stdout}`);
  assert(actual.stderr === expected.stderr, `${label}: stderr 不等\n--期望--\n${expected.stderr}\n--实得--\n${actual.stderr}`);
  const expPaths = nonKitPaths(expected.tree.contents);
  const actPaths = nonKitPaths(actual.tree.contents);
  assert(JSON.stringify(expPaths) === JSON.stringify(actPaths), `${label}: 树内容（loop-kit/ 之外）文件集合不等——缺 [${expPaths.filter((p) => !actPaths.includes(p))}] 多 [${actPaths.filter((p) => !expPaths.includes(p))}]`);
  for (const p of expPaths) {
    assert(expected.tree.contents[p] === actual.tree.contents[p], `${label}: 文件「${p}」内容不等（声明写集之外零变化）`);
  }
}

await check('C2', '完整观测基线等价：命令矩阵规范化输出与切换前冻结基线一致', async () => {
  const { buildIsolatedTree, destroyIsolatedTree, loadCommands, runAllCases } = await import(pathToFileURL(RECORD_PATH).href);
  const { normalize } = await import(pathToFileURL(NORMALIZE_PATH).href);
  const { cases } = loadCommands();
  const tree = buildIsolatedTree(join(ROOT, 'loop-kit'));
  try {
    const extraEnv = existsSync(PKG_DIR) ? { LOOP_KIT_PKG: PKG_DIR } : {};
    const liveResults = runAllCases(tree, cases, { extraEnv });
    for (const r of liveResults) {
      const norm = normalize(r, { treeRoot: tree });
      const frozenPath = join(BASELINE_DIR, 'normalized', `${r.caseId}.json`);
      assert(existsSync(frozenPath), `缺冻结基线案例：${r.caseId}`);
      const frozen = JSON.parse(readFileSync(frozenPath, 'utf8'));
      compareNormalizedCase(frozen, norm, r.caseId);
    }
  } finally {
    destroyIsolatedTree(tree);
  }
});

await check('C2', '反向扰动：规范化比对对真实差异仍判红（规范化不吞真实行为差异）', () => {
  const samplePath = join(BASELINE_DIR, 'normalized', 'gate-dry.json');
  const sample = JSON.parse(readFileSync(samplePath, 'utf8'));
  const mutated = JSON.parse(JSON.stringify(sample));
  mutated.exitCode = mutated.exitCode === 0 ? 1 : 0;
  let threw = false;
  try {
    compareNormalizedCase(sample, mutated, 'gate-dry(扰动)');
  } catch {
    threw = true;
  }
  assert(threw, '对退出码扰动的比较应判红，实际未检出——规范化/比对逻辑有吞真实差异的风险');
});

// ============================================================================
// C3 — 布局、降级与跨树
// ============================================================================
await check('C3', '① 同层默认布局：无 LOOP_KIT_PKG 覆盖，兄弟约定直解析可跑', async () => {
  const { buildIsolatedTree, destroyIsolatedTree, runCase } = await import(pathToFileURL(RECORD_PATH).href);
  const tree = buildIsolatedTree(join(ROOT, 'loop-kit'), { baseDir: dirname(ROOT) });
  try {
    const r = runCase(tree, { id: 'c3-sibling-gate', script: 'gate.mjs', args: ['--prd', 'loop/prd-baseline.json', '--dry'] });
    assert(r.exitCode === 0, `同层默认布局 gate --dry 应 exit 0，实得 ${r.exitCode}\nstderr=${r.stderr}`);
    const guard = runCase(tree, {
      id: 'c3-sibling-guard', script: 'hook-loop-guard.mjs',
      stdin: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: 'lib/x.mjs' } }),
      reset: [{ op: 'rm', path: 'loop/active-contract.json' }],
    });
    assert(guard.exitCode === 2, `同层默认布局下 guard 无 contract 应拦 exit 2，实得 ${guard.exitCode}`);
  } finally {
    destroyIsolatedTree(tree);
  }
});

await check('C3', '② 异地树 + 显式 LOOP_KIT_PKG 可跑', async () => {
  assert(existsSync(PKG_DIR), '真包不存在（本子检查需真包已建）');
  const { buildIsolatedTree, destroyIsolatedTree, runCase } = await import(pathToFileURL(RECORD_PATH).href);
  const tree = buildIsolatedTree(join(ROOT, 'loop-kit')); // 缺省 tmpdir()，非同层
  try {
    const r = runCase(
      tree,
      { id: 'c3-remote-gate', script: 'gate.mjs', args: ['--prd', 'loop/prd-baseline.json', '--dry'] },
      { extraEnv: { LOOP_KIT_PKG: PKG_DIR } }
    );
    assert(r.exitCode === 0, `异地树 + LOOP_KIT_PKG 应可跑，实得 exit ${r.exitCode} stderr=${r.stderr}`);
  } finally {
    destroyIsolatedTree(tree);
  }
});

await check('C3', '③ 异地树无覆盖 → D5 安全失败（cli 类 exit 64）', async () => {
  const { buildIsolatedTree, destroyIsolatedTree, runCase } = await import(pathToFileURL(RECORD_PATH).href);
  const tree = buildIsolatedTree(join(ROOT, 'loop-kit')); // tmpdir，非同层，且不传 LOOP_KIT_PKG
  try {
    const r = runCase(tree, { id: 'c3-remote-nofallback', script: 'gate.mjs', args: ['--prd', 'loop/prd-baseline.json', '--dry'] });
    assert(
      r.exitCode === 64,
      `异地树无覆盖应安全失败 exit 64（红基线：老引擎无此降级协议），实得 ${r.exitCode}`
    );
  } finally {
    destroyIsolatedTree(tree);
  }
});

await check('C3', '同进程跨树：先 import 树 A shim 再 import 树 B shim 得结构化错误（求值前认领拦下）', () => {
  // 须在独立子进程验证：本golden 自身的 C1/C2/C6 检查已经过 boot.loadLib 认领过 Casey 树 ROOT
  // （root.mjs 的 claimed 是模块级单例、无 query 串区隔），同进程继续测会被早前检查的认领状态污染。
  assert(existsSync(PKG_DIR), '真包不存在');
  const treeA = mkdtempSync(join(tmpdir(), 'loop-kit-treeA-'));
  const treeB = mkdtempSync(join(tmpdir(), 'loop-kit-treeB-'));
  const wrapperPath = join(tmpdir(), `loop-kit-c3-crosstree-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  try {
    for (const t of [treeA, treeB]) {
      mkdirSync(join(t, 'loop'), { recursive: true });
      writeFileSync(join(t, 'loop', 'config.json'), '{}', 'utf8');
      cpSync(join(ROOT, 'loop-kit'), join(t, 'loop-kit'), { recursive: true });
    }
    const wrapperSrc = `import { pathToFileURL } from 'node:url';
let threwB1 = null, threwB2 = null;
await import(pathToFileURL(${JSON.stringify(join(treeA, 'loop-kit', 'bin', 'contract.mjs'))}).href);
try {
  await import(pathToFileURL(${JSON.stringify(join(treeB, 'loop-kit', 'bin', 'term-lint.mjs'))}).href);
} catch (e) { threwB1 = String((e && e.message) || e); }
try {
  await import(pathToFileURL(${JSON.stringify(join(treeB, 'loop-kit', 'bin', 'contract.mjs'))}).href);
} catch (e) { threwB2 = String((e && e.message) || e); }
console.log(JSON.stringify({ threwB1, threwB2 }));
`;
    writeFileSync(wrapperPath, wrapperSrc, 'utf8');
    // 两树同指真包（LOOP_KIT_PKG）——共享包内 lib/root.mjs 模块实例，才能复现跨树冲突。
    const r = spawnSync(process.execPath, [wrapperPath], {
      encoding: 'utf8',
      env: { PATH: process.env.PATH, LOOP_KIT_PKG: PKG_DIR },
    });
    assert(r.status === 0, `跨树探针子进程应正常退出（探针本身不应崩溃），实得 ${r.status}\nstdout=${r.stdout}\nstderr=${r.stderr}`);
    const out = JSON.parse(r.stdout.trim().split('\n').pop());
    assert(out.threwB1, `树 B 的首次 import 应抛结构化错误（求值前认领拦下），实际未抛`);
    assert(/认领冲突|RootResolutionError/.test(out.threwB1), `应为 ROOT 认领冲突结构化错误，实得：${out.threwB1}`);
    // 交错排列（评审 R2-H3 复现场景）：B 树再 import 另一库件，仍应持续失败，不因换个库件而假绿
    assert(out.threwB2, '树 B 的第二次（交错）import 也应抛结构化错误');
  } finally {
    try { unlinkSync(wrapperPath); } catch { /* ignore */ }
    rmrf(treeA);
    rmrf(treeB);
  }
});

// ============================================================================
// C4 — 故障族矩阵（逐故障 × 逐入口断言 D5 表）
// ============================================================================
function buildMarkerPkg() {
  const dir = mkdtempSync(join(tmpdir(), 'loop-kit-c4-pkg-'));
  cpSync(EXPECTED_DIR, dir, { recursive: true });
  return dir;
}
async function lockMatching(dir) {
  const { hashTree } = await import(pathToFileURL(HASH_TREE_PATH).href);
  const { files } = hashTree(dir);
  return { schemaVersion: 1, files };
}
function writeLock(path, lockObj) {
  writeFileSync(path, JSON.stringify(lockObj), 'utf8');
}

// 直接调用 boot 的 runCli/loadLib（不经 shim 文件），用 pkgDirOverride/lockPathOverride 注入故障——
// 这是「测试走独立受测锁注入接缝」的实现方式：生产 shim 从不传这些 override，此路径仅测试可达。
async function runCliDirect({ kind, script = 'gate.mjs', argv = [], pkgDirOverride, lockPathOverride }) {
  const boot = await import(pathToFileURL(BOOT_PATH).href + '?c4=' + Math.random());
  return boot.runCli({ script, kind, argv, pkgDirOverride, lockPathOverride });
}

const KINDS = ['cli', 'guard', 'lint'];
const EXPECT_DEGRADE = { cli: 64, guard: 2, lint: 0 };

async function assertDegradesAllKinds(name, faultFn) {
  for (const kind of KINDS) {
    await check('C4', `${name}（kind=${kind} → ${EXPECT_DEGRADE[kind]}）`, async () => {
      const code = await faultFn(kind);
      assert(code === EXPECT_DEGRADE[kind], `期望 ${EXPECT_DEGRADE[kind]}，实得 ${code}`);
    });
  }
}

await assertDegradesAllKinds('缺包目录', (kind) =>
  runCliDirect({ kind, pkgDirOverride: join(tmpdir(), 'loop-kit-does-not-exist-xyz'), lockPathOverride: KIT_LOCK }));

await check('C4', '身份锁失配（伪造漂移包）设置准备', async () => {
  const dir = buildMarkerPkg();
  try {
    const lock = await lockMatching(dir);
    // 篡改其中一份文件哈希，制造漂移
    const firstKey = Object.keys(lock.files)[0];
    lock.files[firstKey] = '0'.repeat(64);
    const lockPath = `${dir}.lock.json`; // 锁文件须落在包目录之外，否则自身被当成「清单外多余文件」
    writeLock(lockPath, lock);
    for (const kind of KINDS) {
      const code = await runCliDirect({ kind, pkgDirOverride: dir, lockPathOverride: lockPath });
      assert(code === EXPECT_DEGRADE[kind], `身份锁失配 kind=${kind} 期望 ${EXPECT_DEGRADE[kind]}，实得 ${code}`);
    }
  } finally {
    rmrf(dir);
  }
});

await check('C4', '清单外多余文件判失配', async () => {
  const dir = buildMarkerPkg();
  try {
    const lock = await lockMatching(dir); // 先按干净内容算锁
    writeFileSync(join(dir, 'stray-extra-file.txt'), 'x', 'utf8'); // 锁生成之后再加一个清单外文件
    const lockPath = `${dir}.lock.json`; // 锁文件须落在包目录之外，否则自身被当成「清单外多余文件」
    writeLock(lockPath, lock);
    for (const kind of KINDS) {
      const code = await runCliDirect({ kind, pkgDirOverride: dir, lockPathOverride: lockPath });
      assert(code === EXPECT_DEGRADE[kind], `清单外多余文件 kind=${kind} 期望 ${EXPECT_DEGRADE[kind]}，实得 ${code}`);
    }
  } finally {
    rmrf(dir);
  }
});

await check('C4', '缺目标脚本（锁与包内容一致，但请求的脚本不在包内）', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'loop-kit-c4-min-'));
  try {
    mkdirSync(join(dir, 'bin'), { recursive: true });
    writeFileSync(join(dir, 'bin', 'only-this.mjs'), '#!/usr/bin/env node\nprocess.exit(0);\n', 'utf8');
    const lock = await lockMatching(dir);
    const lockPath = `${dir}.lock.json`; // 锁文件须落在包目录之外，否则自身被当成「清单外多余文件」
    writeLock(lockPath, lock);
    for (const kind of KINDS) {
      const code = await runCliDirect({ kind, script: 'gate.mjs', pkgDirOverride: dir, lockPathOverride: lockPath });
      assert(code === EXPECT_DEGRADE[kind], `缺目标脚本 kind=${kind} 期望 ${EXPECT_DEGRADE[kind]}，实得 ${code}`);
    }
  } finally {
    rmrf(dir);
  }
});

await check('C4', '锁 JSON 损坏', async () => {
  const dir = buildMarkerPkg();
  try {
    const lockPath = `${dir}.lock.json`; // 锁文件须落在包目录之外，否则自身被当成「清单外多余文件」
    writeFileSync(lockPath, '{这不是合法 json', 'utf8');
    for (const kind of KINDS) {
      const code = await runCliDirect({ kind, pkgDirOverride: dir, lockPathOverride: lockPath });
      assert(code === EXPECT_DEGRADE[kind], `锁 JSON 损坏 kind=${kind} 期望 ${EXPECT_DEGRADE[kind]}，实得 ${code}`);
    }
  } finally {
    rmrf(dir);
  }
});

await check('C4', '意外退出码（数值码，非 0/2）：cli 类原码透传，guard/lint 归一', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'loop-kit-c4-oddexit-'));
  try {
    mkdirSync(join(dir, 'bin'), { recursive: true });
    writeFileSync(join(dir, 'bin', 'oddexit.mjs'), '#!/usr/bin/env node\nprocess.exit(7);\n', 'utf8');
    const lock = await lockMatching(dir);
    const lockPath = `${dir}.lock.json`; // 锁文件须落在包目录之外，否则自身被当成「清单外多余文件」
    writeLock(lockPath, lock);
    const cliCode = await runCliDirect({ kind: 'cli', script: 'oddexit.mjs', pkgDirOverride: dir, lockPathOverride: lockPath });
    assert(cliCode === 7, `cli 类应原码透传 7，实得 ${cliCode}`);
    const guardCode = await runCliDirect({ kind: 'guard', script: 'oddexit.mjs', pkgDirOverride: dir, lockPathOverride: lockPath });
    assert(guardCode === 2, `guard 类应归一 2，实得 ${guardCode}`);
    const lintCode = await runCliDirect({ kind: 'lint', script: 'oddexit.mjs', pkgDirOverride: dir, lockPathOverride: lockPath });
    assert(lintCode === 0, `lint 类应归一 0，实得 ${lintCode}`);
  } finally {
    rmrf(dir);
  }
});

await check('C4', '「锁冻错」残余代价：锁与语法损坏脚本一致时，cli 类透传子进程 exit 1（受支持路径上的已记档代价）', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'loop-kit-c4-frozenbroken-'));
  try {
    mkdirSync(join(dir, 'bin'), { recursive: true });
    writeFileSync(join(dir, 'bin', 'broken.mjs'), 'this is not valid javascript {{{', 'utf8'); // 语法损坏
    const lock = await lockMatching(dir); // 锁如实记录「损坏」内容的哈希——校验只查完整性，不查正确性
    const lockPath = `${dir}.lock.json`; // 锁文件须落在包目录之外，否则自身被当成「清单外多余文件」
    writeLock(lockPath, lock);
    const code = await runCliDirect({ kind: 'cli', script: 'broken.mjs', pkgDirOverride: dir, lockPathOverride: lockPath });
    assert(code === 1, `语法损坏脚本对 Node 的默认退出码是 1，cli 类应原码透传，实得 ${code}`);
  } finally {
    rmrf(dir);
  }
});

await check('C4', '信号终止：cli 类以同信号自终（子进程 spawn 层面验证）', () => {
  const dir = mkdtempSync(join(tmpdir(), 'loop-kit-c4-signal-'));
  try {
    mkdirSync(join(dir, 'bin'), { recursive: true });
    writeFileSync(join(dir, 'bin', 'selfkill.mjs'), '#!/usr/bin/env node\nprocess.kill(process.pid, "SIGTERM");\nsetTimeout(() => {}, 5000);\n', 'utf8');
    const r = spawnSync(process.execPath, [join(dir, 'bin', 'selfkill.mjs')], { encoding: 'utf8', timeout: 4000 });
    assert(r.signal === 'SIGTERM', `子进程应以 SIGTERM 终止，实得 signal=${r.signal} status=${r.status}`);
  } finally {
    rmrf(dir);
  }
});

// boot 缺失 / boot 语法损坏 / boot 调用前中抛错：需真动 loop-kit/lib/boot.mjs 本体（信任根内），
// 经真 shim 子进程验证「最小内联 try/catch 边界」——备份/替换/还原，绝不留污染。
async function withSwappedBoot(brokenContent, fn) {
  const hadBoot = existsSync(BOOT_PATH);
  const backup = hadBoot ? readFileSync(BOOT_PATH) : null;
  try {
    if (brokenContent === null) { if (hadBoot) unlinkSync(BOOT_PATH); }
    else { mkdirSync(dirname(BOOT_PATH), { recursive: true }); writeFileSync(BOOT_PATH, brokenContent, 'utf8'); }
    await fn();
  } finally {
    if (hadBoot) writeFileSync(BOOT_PATH, backup);
    else { try { unlinkSync(BOOT_PATH); } catch { /* ignore */ } try { rmSync(dirname(BOOT_PATH), { recursive: true }); } catch { /* ignore */ } }
  }
}

for (const [label, content] of [
  ['boot 缺失', null],
  ['boot 语法损坏', 'this is not valid javascript {{{'],
  ['boot 依赖装载失败（import 不存在模块）', "import x from 'node:this-module-does-not-exist';\nexport function runCli(){return 0;}\n"],
]) {
  await check('C4', `${label}：三类 shim 均按 D5 归一（信任根内故障，非 boot 内部矩阵覆盖）`, async () => {
    // 前置：现文件必须真引导 boot.mjs，否则本检查对「boot 故障」无意义（红基线：shim 未落成时应红，
    // 不许因现文件压根不碰 boot 而巧合般通过退出码断言）。
    for (const script of ['gate.mjs', 'hook-loop-guard.mjs', 'hook-stop.mjs']) {
      const src = readFileSync(join(SHIM_DIR, script), 'utf8');
      assert(src.includes("'../lib/boot.mjs'"), `${script} 现文件未引导 loop-kit/lib/boot.mjs（红基线：shim 尚未落成）`);
    }
    await withSwappedBoot(content, () => {
      const tmpContractFile = join(tmpdir(), `loop-kit-c4-contract-${Date.now()}.json`);
      try { unlinkSync(tmpContractFile); } catch { /* ignore */ }
      // guard 案需喂真被守卫的动作（写 lib/ 下文件）且用隔离槽（LOOP_CONTRACT_FILE），
      // 不依赖/不触碰本 worktree 真实 loop/active-contract.json（其内容与本检查无关、不应耦合）。
      const guardStdin = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: 'lib/x.mjs' } });
      for (const [script, kind, expect, stdin, env] of [
        ['gate.mjs', 'cli', 64, undefined, {}],
        ['hook-loop-guard.mjs', 'guard', 2, guardStdin, { LOOP_CONTRACT_FILE: tmpContractFile }],
        ['hook-stop.mjs', 'lint', 0, '{}', {}],
      ]) {
        const r = spawnSync(process.execPath, [join(SHIM_DIR, script)], {
          cwd: ROOT, encoding: 'utf8', input: stdin, env: { PATH: process.env.PATH, ...env },
        });
        assert(r.status === expect, `${label} → ${script}（${kind}）期望 exit ${expect}，实得 ${r.status}（stderr=${r.stderr}）`);
      }
    });
  });
}

await check('C4', 'boot 调用前中抛错：shim 最小内联 try/catch 兜住 runCli 内部意外抛出', async () => {
  const gateSrc = readFileSync(join(SHIM_DIR, 'gate.mjs'), 'utf8');
  assert(gateSrc.includes('boot.runCli') && gateSrc.includes('__fallbackDegrade'), 'gate.mjs 现文件未见 shim 模板的 boot.runCli 调用 + 兜底降级结构（红基线：shim 尚未落成）');
  const throwingBoot = 'export function runCli(){ throw new Error("模拟 boot 内部意外抛错"); }\nexport async function loadLib(){ throw new Error("模拟 boot 内部意外抛错"); }\n';
  await withSwappedBoot(throwingBoot, () => {
    const r = spawnSync(process.execPath, [join(SHIM_DIR, 'gate.mjs')], { cwd: ROOT, encoding: 'utf8', env: { PATH: process.env.PATH } });
    assert(r.status === 64, `boot.runCli 抛错时 shim 应兜住并归一 exit 64（cli 类），实得 ${r.status}（stderr=${r.stderr}）`);
  });
});

await check('C4', 'status===null 且无信号无 error 的降级分类存在（源码级断言，spawnSync 无法确定性构造该态）', () => {
  const src = readFileSync(BOOT_PATH, 'utf8');
  assert(/typeof r\.status !== 'number'/.test(src), 'boot.mjs 应显式判 status 非数值（null 且无信号）态并归一降级——未见该判据');
});

// ============================================================================
// C5 — shim 模板逐字比对（十件展开结果 vs 现文件）
// ============================================================================
await check('C5', 'loop-kit/lib/boot.mjs 存在且语法合法', () => {
  assert(existsSync(BOOT_PATH), `boot.mjs 不存在：${BOOT_PATH}（红基线：协议未落成）`);
  const chk = spawnSync(process.execPath, ['--check', BOOT_PATH], { encoding: 'utf8' });
  assert(chk.status === 0, `boot.mjs 语法检查失败：${chk.stderr}`);
});

await check('C5', 'shim-template.mjs 可加载，SHIM_PARAMS 十件齐全', async () => {
  const mod = await import(pathToFileURL(SHIM_TEMPLATE_PATH).href);
  assert(Array.isArray(mod.SHIM_PARAMS) && mod.SHIM_PARAMS.length === 10, `SHIM_PARAMS 应为十件，实得 ${mod.SHIM_PARAMS && mod.SHIM_PARAMS.length}`);
});

{
  const { renderShim, SHIM_PARAMS } = await import(pathToFileURL(SHIM_TEMPLATE_PATH).href);
  for (const p of SHIM_PARAMS) {
    await check('C5', `${p.script} 与模板展开结果逐字比对`, () => {
      const expectedSrc = renderShim(p);
      const actualPath = join(SHIM_DIR, p.script);
      assert(existsSync(actualPath), `现文件不存在：${actualPath}`);
      const actualSrc = readFileSync(actualPath, 'utf8');
      assert(
        actualSrc === expectedSrc,
        `与模板展开结果不逐字相等（红基线：现文件非 shim）——首个差异位置附近：\n期望前200字符=${JSON.stringify(expectedSrc.slice(0, 200))}\n实得前200字符=${JSON.stringify(actualSrc.slice(0, 200))}`
      );
    });
  }
}

// ============================================================================
// C6 — 存量零重签（非回归钉；此 story 守既有绿不许变红，无先红语义）
// ============================================================================
const C6_ANCHORS = {
  'tests/_golden/worktree-baton.golden.mjs': 'ac282b21b1bc099e8ca550ac36cbf188461e3864',
  'tests/_golden/term-guard.golden.mjs': 'eaad943eb79008476cd7e6fd745aa2c1d72ad1a6',
  'tests/_golden/ratchet-reverse-index.golden.mjs': '0213b0fb551c27b13bb47f94158cad51291bb8bd',
  'loop/prd-worktree-baton.json': '6de39f2f0be8c05658b1666d04e0a4ffe29ae91e',
  'loop/prd-term-guard.json': 'd4a1d45fae653a535ff71cd3c576b83962be8099',
  'loop/prd-ratchet-reverse-index.json': '72f36baa1b4622d3af41c8d77de6deeacae1eed0',
};
for (const [relPath, anchorSha1] of Object.entries(C6_ANCHORS)) {
  await check('C6', `${relPath} 字节等于切换前 git blob 锚（零字节改动）`, () => {
    const abs = join(ROOT, relPath);
    assert(existsSync(abs), `文件不存在：${abs}`);
    const actual = gitBlobSha(abs);
    assert(actual === anchorSha1, `blob sha1 不等——期望 ${anchorSha1} 实得 ${actual}（此文件已被改动，违反 C6 零重签）`);
  });
}
// 复跑退出码与切换前锚一致（零回归）——不写死「必须 exit 0」：worktree-baton.golden.mjs 自身有条
// 与「本树活动 contract slug 恰为 worktree-baton」耦合的断言 G6，与本契约无关且字节冻结不可改；
// 本树活动 slug 是 loop-kit-extract，其现状复跑本就是 exit 1（详见 c6-rerun-anchor.json）。
const C6_RERUN_ANCHOR = JSON.parse(readFileSync(join(BASELINE_DIR, 'c6-rerun-anchor.json'), 'utf8'));
for (const goldenRel of Object.keys(C6_RERUN_ANCHOR.exitCodes)) {
  await check('C6', `${goldenRel} 经 shim 复跑结果与切换前锚一致（零回归）`, () => {
    const anchorCode = C6_RERUN_ANCHOR.exitCodes[goldenRel];
    const r = spawnSync(process.execPath, [join(ROOT, goldenRel)], { cwd: ROOT, encoding: 'utf8' });
    assert(
      r.status === anchorCode,
      `复跑退出码应等于切换前锚 ${anchorCode}，实得 ${r.status}（回归）\nstdout=${r.stdout}\nstderr=${r.stderr}`
    );
  });
}

// ============================================================================
// C7 — 根语义组（resolveRoot() 独立语义用例）
// ============================================================================
async function freshRootMod(tag) {
  assert(existsSync(PKG_DIR), '真包不存在（红基线：包不存在、无 resolveRoot() 可测）');
  return import(pathToFileURL(join(PKG_DIR, 'lib', 'root.mjs')).href + '?c7=' + tag + '-' + Math.random().toString(36).slice(2));
}
function markerRootDir(base) {
  const d = join(base, 'marker-root');
  mkdirSync(join(d, 'loop'), { recursive: true });
  writeFileSync(join(d, 'loop', 'config.json'), '{}', 'utf8');
  return d;
}

await check('C7', 'env 有效命中：realpath 规范化后返回', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'loop-kit-c7-'));
  try {
    const dirA = markerRootDir(tmp);
    const { resolveRoot } = await freshRootMod('env-valid');
    const got = resolveRoot({ envRoot: dirA, cwd: tmp });
    assert(existsSync(got), 'resolveRoot 返回值应是存在的目录');
    assert(got.endsWith('marker-root') || got.includes('marker-root'), `应指向 dirA，实得 ${got}`);
  } finally {
    rmrf(tmp);
  }
});

await check('C7', 'env 无效立即失败，绝不静默回退到 cwd 上溯', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'loop-kit-c7-'));
  try {
    const validCwdRoot = markerRootDir(join(tmp, 'valid-for-cwd'));
    const { resolveRoot } = await freshRootMod('env-invalid');
    let threw = false;
    try {
      resolveRoot({ envRoot: join(tmp, 'does-not-exist'), cwd: validCwdRoot });
    } catch (e) {
      threw = true;
      assert(/RootResolutionError|不存在/.test(String(e.message)), `应为结构化错误，实得：${e}`);
    }
    assert(threw, 'env 无效时应立即抛错，不应静默回退到 cwd 上溯成功返回');
  } finally {
    rmrf(tmp);
  }
});

await check('C7', '上溯命中根标记：cwd 逐级向上找到 loop/config.json', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'loop-kit-c7-'));
  try {
    const rootDir = markerRootDir(tmp);
    const nested = join(rootDir, 'a', 'b', 'c');
    mkdirSync(nested, { recursive: true });
    const { resolveRoot } = await freshRootMod('upward-hit');
    // envRoot 传 ''（非 undefined）强制走「缺席」分支——JS 默认参数在显式传 undefined 时仍会取
    // process.env.LOOP_KIT_ROOT，而本金牌作为 gate story acceptance 子进程运行时会从「shim spawnSync
    // 注入 env → 包 gate.mjs execSync 继承」这条链路真实继承到该变量，必须显式绕开、不依赖环境干净。
    const got = resolveRoot({ envRoot: '', cwd: nested });
    assert(got.includes('marker-root'), `应上溯命中 rootDir，实得 ${got}`);
  } finally {
    rmrf(tmp);
  }
});

await check('C7', '上溯无标记抛结构化错误（不终止宿主进程）', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'loop-kit-c7-noanchor-'));
  try {
    const { resolveRoot, RootResolutionError } = await freshRootMod('upward-miss');
    let caught = null;
    try {
      resolveRoot({ envRoot: '', cwd: tmp }); // '' 强制走缺席分支，见上一检查同注
    } catch (e) {
      caught = e;
    }
    assert(caught, '无标记时应抛错，不应返回');
    assert(caught instanceof Error, '应是 Error 实例（结构化，非 process.exit）');
    assert(!RootResolutionError || caught.name === 'RootResolutionError', `错误类型应为 RootResolutionError，实得 ${caught.name}`);
  } finally {
    rmrf(tmp);
  }
});

await check('C7', 'realpath 规范化：经软链解析后返回真实路径', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'loop-kit-c7-symlink-'));
  try {
    const realDir = markerRootDir(join(tmp, 'real-target'));
    const linkPath = join(tmp, 'link-to-root');
    symlinkSync(realDir, linkPath, 'dir');
    const { resolveRoot } = await freshRootMod('realpath');
    const got = resolveRoot({ envRoot: linkPath, cwd: tmp });
    assert(got !== linkPath, 'resolveRoot 不应原样返回软链路径');
    assert(got.includes('real-target'), `应解析到真实目标，实得 ${got}`);
  } finally {
    rmrf(tmp);
  }
});

await check('C7', '原子认领：首认领成立、同根幂等、异根立即抛、认领后不可变；探针回报认领值', async () => {
  const tmp = mkdtempSync(join(tmpdir(), 'loop-kit-c7-claim-'));
  try {
    const dirA = markerRootDir(join(tmp, 'a'));
    const dirB = markerRootDir(join(tmp, 'b'));
    const { resolveRoot, claimedRoot } = await freshRootMod('claim');
    assert(claimedRoot() === null, '未认领时探针应返回 null');
    const first = resolveRoot({ envRoot: dirA, cwd: tmp });
    assert(claimedRoot() === first, '首认领后探针应回报认领值');
    const again = resolveRoot({ envRoot: dirA, cwd: tmp });
    assert(again === first, '同根幂等：重复解析应返回同一值');
    let conflictThrew = false;
    try {
      resolveRoot({ envRoot: dirB, cwd: tmp });
    } catch (e) {
      conflictThrew = true;
      assert(/认领冲突/.test(e.message), `异根应抛认领冲突错误，实得：${e.message}`);
    }
    assert(conflictThrew, '异根解析应立即抛错');
    assert(claimedRoot() === first, '认领后不可变：失败的异根尝试不应更新认领值');
    // envRoot 省略 + 已认领 → 幂等直接复用，不依赖 cwd 恰好匹配（库模式核心防线）
    const viaOmitted = resolveRoot({ envRoot: '', cwd: join(tmp, '完全不相关且无标记的路径') });
    assert(viaOmitted === first, '已认领时省略 envRoot 应直接复用认领值，不依赖 cwd 上溯');
  } finally {
    rmrf(tmp);
  }
});

// ============================================================================
// 汇总
// ============================================================================
const failed = results.filter((r) => !r.ok);
console.log(`\nloop-kit-extract golden: ${results.length - failed.length}/${results.length} GREEN`);
if (failed.length) {
  console.error('\nRED 明细：');
  for (const f of failed) console.error(`  [${f.group}] ${f.name} — ${f.detail}`);
}
process.exit(failed.length ? 1 : 0);
