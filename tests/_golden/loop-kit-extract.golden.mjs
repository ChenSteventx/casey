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
await check('C2', '转发证明：LOOP_KIT_PKG 指向标记包时真转发（锁校验不豁免）', async () => {
  // round-1 实现审 A4 采信：故障注入只动隔离消费树内的 kit-lock.json 拷贝，真实工作树全程只读
  // （不再备份/覆写/恢复真实 loop-kit/kit-lock.json——非原子写在异常退出/并行读取下曾有损坏真信任根的风险）。
  const { buildIsolatedTree, destroyIsolatedTree } = await import(pathToFileURL(RECORD_PATH).href);
  const markerDir = mkdtempSync(join(tmpdir(), 'loop-kit-marker-'));
  const tree = buildIsolatedTree(join(ROOT, 'loop-kit'));
  try {
    mkdirSync(join(markerDir, 'bin'), { recursive: true });
    const sentinelSrc = '#!/usr/bin/env node\nconsole.log("LOOP_KIT_MARKER_SENTINEL");\nprocess.exit(43);\n';
    writeFileSync(join(markerDir, 'bin', 'gate.mjs'), sentinelSrc, 'utf8');
    const markerHash = sha256(readFileSync(join(markerDir, 'bin', 'gate.mjs')));
    const markerLock = { schemaVersion: 1, files: { 'bin/gate.mjs': markerHash } };
    writeFileSync(join(tree, 'loop-kit', 'kit-lock.json'), JSON.stringify(markerLock), 'utf8');

    const r = spawnSync(process.execPath, [join(tree, 'loop-kit', 'bin', 'gate.mjs')], {
      cwd: tree,
      encoding: 'utf8',
      env: { PATH: process.env.PATH, LOOP_KIT_PKG: markerDir },
    });
    assert(
      r.stdout.includes('LOOP_KIT_MARKER_SENTINEL') && r.status === 43,
      `转发未生效（红基线：全量引擎无视 LOOP_KIT_PKG）——实得 status=${r.status} stdout=${JSON.stringify(r.stdout)} stderr=${JSON.stringify(r.stderr)}`
    );
  } finally {
    rmrf(markerDir);
    destroyIsolatedTree(tree);
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

await check('C2', '反向扰动（时间戳类，round-1 实现审 A5）：白名单外的时间戳样式差异不被规范化吞掉', async () => {
  const { normalize } = await import(pathToFileURL(NORMALIZE_PATH).href);
  const rawPath = join(BASELINE_DIR, 'raw', 'gate-dry.json');
  const raw = JSON.parse(readFileSync(rawPath, 'utf8'));
  // 在白名单字段（stdout）之外注入一个形似时间戳的真实差异：正常规范化不应把它变成 <TIMESTAMP>，
  // 且两次规范化结果的这处差异必须仍然存在（比对必判红），证明「字段级白名单」没有退化回全局正则。
  const mutatedRaw = JSON.parse(JSON.stringify(raw));
  mutatedRaw.stdout += '\n业务真实时间戳（非白名单字段，不应被规范化）：2026-01-01T00:00:00.000Z\n';
  const baseNorm = normalize(raw, { treeRoot: null });
  const mutatedNorm = normalize(mutatedRaw, { treeRoot: null });
  assert(
    mutatedNorm.stdout.includes('2026-01-01T00:00:00.000Z'),
    '白名单外（stdout 里的业务时间戳，此处刻意扩到未登记内容）字段中的时间戳被规范化吞掉了——违反字段级白名单'
  );
  let threw = false;
  try {
    compareNormalizedCase(baseNorm, mutatedNorm, 'gate-dry(时间戳类扰动)');
  } catch {
    threw = true;
  }
  assert(threw, '对 stdout 时间戳类真实差异的比较应判红，实际未检出');
});

await check('C2', '字段级白名单（round-1 实现审 A5）：仅 loop/.breaker-state.json 的 startedAt 被替换，同名字段在其它文件里原样保留', async () => {
  const { normalize } = await import(pathToFileURL(NORMALIZE_PATH).href);
  const rawPath = join(BASELINE_DIR, 'raw', 'gate-dry.json');
  const raw = JSON.parse(readFileSync(rawPath, 'utf8'));
  const decoyPath = 'loop/decoy-not-breaker-state.json';
  const decoyContent = '{\n  "startedAt": "2026-07-13T12:57:18.658Z"\n}';
  const mutatedRaw = JSON.parse(JSON.stringify(raw));
  mutatedRaw.tree.contents[decoyPath] = decoyContent;
  const norm = normalize(mutatedRaw, { treeRoot: null });
  assert(
    norm.tree.contents[decoyPath] === decoyContent,
    `白名单按路径精确限定于 loop/.breaker-state.json——同名字段出现在其它文件时不应被替换，实得：${norm.tree.contents[decoyPath]}`
  );
  assert(
    norm.tree.contents['loop/.breaker-state.json'].includes('<TIMESTAMP>'),
    '白名单登记的 loop/.breaker-state.json 自身仍应正常替换'
  );
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
  // 须在独立子进程验证：本 golden 自身的 C1/C2/C6 检查已经过 boot.loadLib 认领过 Casey 树 ROOT；
  // 认领槽是 globalThis[Symbol.for(...)] 键住的进程级单例（round-1 实现审 A1 采信后版本），同进程
  // 继续测会被早前检查的认领状态污染——故每个跨树场景都在独立子进程里从零状态验证。
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
    // 两树同指真包（LOOP_KIT_PKG）——共享包内 lib/root.mjs 同一物理文件（同一模块实例）的场景；
    // 「两树解析到不同物理包目录」的场景由下一个检查覆盖（round-1 实现审 A1：认领槽改为进程级共享后，
    // 两种布局都应正确冲突，此检查钉「同模块实例」这一支）。
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

await check('C3', '同进程跨树（真异包目录，round-1 实现审 A1 核心修复点）：两树各自解析到不同物理包目录仍在求值前认领拦下', () => {
  // 此前的实现（root.mjs 的 claimed 是模块顶层变量）里，这个场景恰恰是防线不在场的地方：两个不同的
  // 物理包目录对 ESM 而言是两个不同的 file:// URL，会各自得到独立的 root.mjs 模块实例、各自独立的
  // claimed——两次认领都成功、零冲突（fable 汇裁独立探针已实测复现）。上一个检查特意让两树共享同一个
  // LOOP_KIT_PKG（同一物理包目录、同一模块实例），因此掩盖了这个故障域；本检查改为两树各自指向两份
  // 内容相同但物理路径不同的包拷贝，专门钉死这条此前不可达的路径。
  assert(existsSync(PKG_DIR), '真包不存在');
  const pkgCopyA = mkdtempSync(join(tmpdir(), 'loop-kit-c3-pkgA-'));
  const pkgCopyB = mkdtempSync(join(tmpdir(), 'loop-kit-c3-pkgB-'));
  rmSync(pkgCopyA, { recursive: true, force: true });
  rmSync(pkgCopyB, { recursive: true, force: true });
  cpSync(PKG_DIR, pkgCopyA, { recursive: true });
  cpSync(PKG_DIR, pkgCopyB, { recursive: true });
  const treeA = mkdtempSync(join(tmpdir(), 'loop-kit-c3-treeA2-'));
  const treeB = mkdtempSync(join(tmpdir(), 'loop-kit-c3-treeB2-'));
  const wrapperPath = join(tmpdir(), `loop-kit-c3-crosstree-diffpkg-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  try {
    for (const t of [treeA, treeB]) {
      mkdirSync(join(t, 'loop'), { recursive: true });
      writeFileSync(join(t, 'loop', 'config.json'), '{}', 'utf8');
      cpSync(join(ROOT, 'loop-kit'), join(t, 'loop-kit'), { recursive: true });
    }
    const wrapperSrc = `import { pathToFileURL } from 'node:url';
process.env.LOOP_KIT_PKG = ${JSON.stringify(pkgCopyA)};
await import(pathToFileURL(${JSON.stringify(join(treeA, 'loop-kit', 'bin', 'contract.mjs'))}).href);
process.env.LOOP_KIT_PKG = ${JSON.stringify(pkgCopyB)};
let threw = null;
try {
  await import(pathToFileURL(${JSON.stringify(join(treeB, 'loop-kit', 'bin', 'term-lint.mjs'))}).href);
} catch (e) { threw = String((e && e.message) || e); }
console.log(JSON.stringify({ threw }));
`;
    writeFileSync(wrapperPath, wrapperSrc, 'utf8');
    const r = spawnSync(process.execPath, [wrapperPath], { encoding: 'utf8', env: { PATH: process.env.PATH } });
    assert(r.status === 0, `跨树探针子进程应正常退出，实得 ${r.status}\nstdout=${r.stdout}\nstderr=${r.stderr}`);
    const out = JSON.parse(r.stdout.trim().split('\n').pop());
    assert(out.threw, '树 A（经 pkgCopyA）先认领后，树 B（经物理上不同的 pkgCopyB，不同 root.mjs 模块实例）的 import 仍应抛结构化错误——实际未抛（认领槽若退化回模块局部变量就会在此处假绿）');
    assert(/认领冲突|RootResolutionError/.test(out.threw), `应为 ROOT 认领冲突结构化错误，实得：${out.threw}`);
  } finally {
    try { unlinkSync(wrapperPath); } catch { /* ignore */ }
    rmrf(treeA);
    rmrf(treeB);
    rmrf(pkgCopyA);
    rmrf(pkgCopyB);
  }
});

await check('C3', '并发导入：Promise.all 同时发起两树 import，认领互斥不因交织而失效', () => {
  // plan §3 S3「并发导入」场景：resolveRoot()/claimAtomic() 全程无 await（同步、不可能在函数中途被
  // 其它微任务打断），故在同一进程内，无论两个 import() 的模块加载阶段如何交织，真正执行认领的那一刻
  // 总是原子的——本检查用 Promise.all（不依次 await）验证：无论谁先谁后，恰好一个成功、另一个抛冲突。
  assert(existsSync(PKG_DIR), '真包不存在');
  const treeA = mkdtempSync(join(tmpdir(), 'loop-kit-c3-concurA-'));
  const treeB = mkdtempSync(join(tmpdir(), 'loop-kit-c3-concurB-'));
  const wrapperPath = join(tmpdir(), `loop-kit-c3-concurrent-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  try {
    for (const t of [treeA, treeB]) {
      mkdirSync(join(t, 'loop'), { recursive: true });
      writeFileSync(join(t, 'loop', 'config.json'), '{}', 'utf8');
      cpSync(join(ROOT, 'loop-kit'), join(t, 'loop-kit'), { recursive: true });
    }
    const wrapperSrc = `import { pathToFileURL } from 'node:url';
const pA = import(pathToFileURL(${JSON.stringify(join(treeA, 'loop-kit', 'bin', 'contract.mjs'))}).href);
const pB = import(pathToFileURL(${JSON.stringify(join(treeB, 'loop-kit', 'bin', 'term-lint.mjs'))}).href);
const [ra, rb] = await Promise.allSettled([pA, pB]);
console.log(JSON.stringify({
  aStatus: ra.status, aReason: ra.status === 'rejected' ? String(ra.reason && ra.reason.message) : null,
  bStatus: rb.status, bReason: rb.status === 'rejected' ? String(rb.reason && rb.reason.message) : null,
}));
`;
    writeFileSync(wrapperPath, wrapperSrc, 'utf8');
    const r = spawnSync(process.execPath, [wrapperPath], {
      encoding: 'utf8',
      env: { PATH: process.env.PATH, LOOP_KIT_PKG: PKG_DIR },
    });
    assert(r.status === 0, `并发导入探针子进程应正常退出，实得 ${r.status}\nstdout=${r.stdout}\nstderr=${r.stderr}`);
    const out = JSON.parse(r.stdout.trim().split('\n').pop());
    const fulfilledCount = [out.aStatus, out.bStatus].filter((s) => s === 'fulfilled').length;
    const rejectedCount = [out.aStatus, out.bStatus].filter((s) => s === 'rejected').length;
    assert(fulfilledCount === 1 && rejectedCount === 1, `并发导入两棵异根树应恰好一存活一冲突，实得 aStatus=${out.aStatus} bStatus=${out.bStatus}`);
    const rejectedReason = out.aStatus === 'rejected' ? out.aReason : out.bReason;
    assert(/认领冲突|RootResolutionError/.test(rejectedReason), `被拒绝一方应为 ROOT 认领冲突结构化错误，实得：${rejectedReason}`);
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
// round-2 实现审 codex LOW 采信：`${dir}.lock.json` 落在 dir 之外（故意，见各处注释），单独 rmrf(dir)
// 不会删到它——多次跑金牌会在 tmpdir 残留多份孤儿锁文件。清理时锁文件路径与 buildMarkerPkg/mkdtempSync
// 生成的 dir 同源拼出，一并回收。
function rmrfWithLock(dir) {
  rmrf(dir);
  try { unlinkSync(`${dir}.lock.json`); } catch { /* ignore */ }
}

// 直接调用 boot 的 runCli/loadLib（不经 shim 文件），用 pkgDirOverride/lockPathOverride 注入故障——
// 这是「测试走独立受测锁注入接缝」的实现方式：生产 shim 从不传这些 override，此路径仅测试可达。
// spawnImpl 同理（round-1 实现审 A2 采信新增）：注入桩替身，确定性制造 spawnSync 的 r.error /
// status===null 等否则无法跨平台稳定复现的返回态——生产 shim 从不传参，走真实 spawnSync。
async function runCliDirect({ kind, script = 'gate.mjs', argv = [], pkgDirOverride, lockPathOverride, spawnImpl }) {
  const boot = await import(pathToFileURL(BOOT_PATH).href + '?c4=' + Math.random());
  return boot.runCli({ script, kind, argv, pkgDirOverride, lockPathOverride, spawnImpl });
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

// round-2 实现审 codex HIGH 采信：只断言退出码（64/2/0）不足以区分 D5 矩阵里判据不同但退出码相同的
// 分支——例如 SPAWN_ERROR 与 NO_STATUS 在 cli/guard/lint 三态下的归一码完全一样，若生产代码误删
// `if (r.error) {...}` 分支、让 r.error 桩落进 status===null 判据（两者都会把 status/signal 设为
// null），退出码断言会照绿而测不出真实分支已经变了。改为额外捕获 degrade() 打到 console.log/error 的
// 诊断文本，用 reasonPattern 断言其确实含该故障类别的判据字样（各 BootError.message 逐类不同），
// 与退出码断言一并做「codes + reason」双重锁定。
async function assertDegradesAllKindsWithReason(name, faultFn, reasonPattern) {
  for (const kind of KINDS) {
    await check('C4', `${name}（kind=${kind} → ${EXPECT_DEGRADE[kind]}，含降级判据文本核验）`, async () => {
      const origLog = console.log;
      const origError = console.error;
      const captured = [];
      console.log = (...args) => { captured.push(args.join(' ')); };
      console.error = (...args) => { captured.push(args.join(' ')); };
      let code;
      try {
        code = await faultFn(kind);
      } finally {
        console.log = origLog;
        console.error = origError;
      }
      assert(code === EXPECT_DEGRADE[kind], `期望 ${EXPECT_DEGRADE[kind]}，实得 ${code}`);
      const text = captured.join('\n');
      assert(
        reasonPattern.test(text),
        `降级判据文本应匹配 ${reasonPattern}（与其它同码故障类别区分），实际捕获输出：${text || '(空，未捕获到任何诊断文本)'}`
      );
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
    rmrfWithLock(dir);
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
    rmrfWithLock(dir);
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
    rmrfWithLock(dir);
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
    rmrfWithLock(dir);
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
    rmrfWithLock(dir);
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
    rmrfWithLock(dir);
  }
});

await check('C4', '信号终止：cli 类经 boot.runCli 以同信号自终（外层包装进程行为级验证，round-1 实现审 A2）', async () => {
  // round-1 实现审 A2 采信：此前的版本只直接 spawnSync selfkill.mjs，全程不经 boot.runCli——只验证了
  // Node 自身的 spawnSync 信号语义，删掉 boot.mjs 里 process.kill(process.pid, r.signal) 那行该用例仍绿。
  // 改为真调用 boot.runCli（无 shim 中间层，直接 import 真实 boot.mjs）驱动一个外层包装进程：boot 内部
  // 对「同信号自终」的 process.kill 调用作用于该包装进程自身，由本测试从外部观察包装进程真的死于同信号。
  const dir = mkdtempSync(join(tmpdir(), 'loop-kit-c4-signal-'));
  const wrapperPath = join(tmpdir(), `loop-kit-c4-signal-wrapper-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  try {
    mkdirSync(join(dir, 'bin'), { recursive: true });
    writeFileSync(join(dir, 'bin', 'selfkill.mjs'), '#!/usr/bin/env node\nprocess.kill(process.pid, "SIGTERM");\nsetTimeout(() => {}, 5000);\n', 'utf8');
    const lock = await lockMatching(dir);
    const lockPath = `${dir}.lock.json`; // 锁文件须落在包目录之外，否则自身被当成「清单外多余文件」
    writeLock(lockPath, lock);
    const wrapperSrc = `import { pathToFileURL } from 'node:url';
const boot = await import(pathToFileURL(${JSON.stringify(BOOT_PATH)}).href);
const code = boot.runCli({ script: 'selfkill.mjs', kind: 'cli', argv: [], pkgDirOverride: ${JSON.stringify(dir)}, lockPathOverride: ${JSON.stringify(lockPath)} });
// 若执行到这里，说明 process.kill 未能真正终止本进程（理论上不应发生）——仍给个可观测退出码兜底。
process.exit(code);
`;
    writeFileSync(wrapperPath, wrapperSrc, 'utf8');
    const r = spawnSync(process.execPath, [wrapperPath], { encoding: 'utf8', timeout: 4000 });
    assert(
      r.signal === 'SIGTERM',
      `boot.runCli 应以子进程收到的同信号（SIGTERM）终止外层包装进程，实得 signal=${r.signal} status=${r.status}\nstdout=${r.stdout}\nstderr=${r.stderr}`
    );
  } finally {
    rmrfWithLock(dir);
    try { unlinkSync(wrapperPath); } catch { /* ignore */ }
  }
});

await check('C4', '信号自终失败兜底码遵循 shell 128+n 语义（桩替换 process.kill，round-1 实现审 A7）', async () => {
  // A7（LOW）：process.kill 自终失败的极端兜底路径此前 return 1，不符 128+n 语义。真实 process.kill
  // 对自身 PID 发送有效信号名几乎不会失败，故用外层包装进程内 monkey-patch process.kill 强制其抛错
  // （只影响该独立子进程，不污染本 golden 测试自身进程）来确定性驱动这条兜底分支。
  const dir = mkdtempSync(join(tmpdir(), 'loop-kit-c4-signalfail-'));
  const wrapperPath = join(tmpdir(), `loop-kit-c4-signalfail-wrapper-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  try {
    mkdirSync(join(dir, 'bin'), { recursive: true });
    writeFileSync(join(dir, 'bin', 'selfkill.mjs'), '#!/usr/bin/env node\nprocess.kill(process.pid, "SIGTERM");\nsetTimeout(() => {}, 5000);\n', 'utf8');
    const lock = await lockMatching(dir);
    const lockPath = `${dir}.lock.json`;
    writeLock(lockPath, lock);
    const wrapperSrc = `import { pathToFileURL } from 'node:url';
const boot = await import(pathToFileURL(${JSON.stringify(BOOT_PATH)}).href);
const realKill = process.kill.bind(process);
process.kill = (pid, signal) => { throw new Error('模拟 process.kill 自终失败'); };
const code = boot.runCli({ script: 'selfkill.mjs', kind: 'cli', argv: [], pkgDirOverride: ${JSON.stringify(dir)}, lockPathOverride: ${JSON.stringify(lockPath)} });
process.kill = realKill;
console.log(JSON.stringify({ code }));
`;
    writeFileSync(wrapperPath, wrapperSrc, 'utf8');
    const r = spawnSync(process.execPath, [wrapperPath], { encoding: 'utf8', timeout: 4000 });
    assert(r.status === 0, `包装进程本身应正常退出（process.kill 桩只影响返回值，不应让包装进程崩溃），实得 status=${r.status} signal=${r.signal}\nstderr=${r.stderr}`);
    const { code } = JSON.parse(r.stdout.trim().split('\n').pop());
    assert(code === 128 + 15, `SIGTERM 自终失败兜底码应为 128+15=143（shell 语义），实得 ${code}`);
  } finally {
    rmrfWithLock(dir);
    try { unlinkSync(wrapperPath); } catch { /* ignore */ }
  }
});

// boot 缺失 / boot 语法损坏 / boot 调用前中抛错：需真动 boot.mjs 本体（信任根内），经真 shim 子进程
// 验证「最小内联 try/catch 边界」。round-1 实现审 A4 采信：故障注入只动隔离消费树内的 boot.mjs 拷贝
// （经 record.mjs 的 buildIsolatedTree 复制真实 loop-kit/ 得到），真实工作树 loop-kit/lib/boot.mjs
// 全程只读——不再对真实文件备份/覆写/还原（非原子写在异常退出/并行读取窗口内曾有损坏真信任根的风险）。
function withSwappedBootInTree(tree, brokenContent, fn) {
  const bootPath = join(tree, 'loop-kit', 'lib', 'boot.mjs');
  const hadBoot = existsSync(bootPath);
  const backup = hadBoot ? readFileSync(bootPath) : null;
  try {
    if (brokenContent === null) { if (hadBoot) unlinkSync(bootPath); }
    else { mkdirSync(dirname(bootPath), { recursive: true }); writeFileSync(bootPath, brokenContent, 'utf8'); }
    return fn();
  } finally {
    if (hadBoot) writeFileSync(bootPath, backup);
    else { try { unlinkSync(bootPath); } catch { /* ignore */ } }
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
    const { buildIsolatedTree, destroyIsolatedTree } = await import(pathToFileURL(RECORD_PATH).href);
    const tree = buildIsolatedTree(join(ROOT, 'loop-kit'));
    try {
      await withSwappedBootInTree(tree, content, () => {
        const tmpContractFile = join(tmpdir(), `loop-kit-c4-contract-${Date.now()}.json`);
        try { unlinkSync(tmpContractFile); } catch { /* ignore */ }
        // guard 案需喂真被守卫的动作（写 lib/ 下文件）且用隔离槽（LOOP_CONTRACT_FILE），
        // 不依赖/不触碰任何工作树真实 loop/active-contract.json（其内容与本检查无关、不应耦合）。
        const guardStdin = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: 'lib/x.mjs' } });
        for (const [script, kind, expect, stdin, env] of [
          ['gate.mjs', 'cli', 64, undefined, {}],
          ['hook-loop-guard.mjs', 'guard', 2, guardStdin, { LOOP_CONTRACT_FILE: tmpContractFile }],
          ['hook-stop.mjs', 'lint', 0, '{}', {}],
        ]) {
          const r = spawnSync(process.execPath, [join(tree, 'loop-kit', 'bin', script)], {
            cwd: tree, encoding: 'utf8', input: stdin, env: { PATH: process.env.PATH, ...env },
          });
          assert(r.status === expect, `${label} → ${script}（${kind}）期望 exit ${expect}，实得 ${r.status}（stderr=${r.stderr}）`);
        }
      });
    } finally {
      destroyIsolatedTree(tree);
    }
  });
}

await check('C4', 'boot 调用前中抛错：shim 最小内联 try/catch 兜住 runCli 内部意外抛出', async () => {
  const gateSrc = readFileSync(join(SHIM_DIR, 'gate.mjs'), 'utf8');
  assert(gateSrc.includes('boot.runCli') && gateSrc.includes('__fallbackDegrade'), 'gate.mjs 现文件未见 shim 模板的 boot.runCli 调用 + 兜底降级结构（红基线：shim 尚未落成）');
  const throwingBoot = 'export function runCli(){ throw new Error("模拟 boot 内部意外抛错"); }\nexport async function loadLib(){ throw new Error("模拟 boot 内部意外抛错"); }\n';
  const { buildIsolatedTree, destroyIsolatedTree } = await import(pathToFileURL(RECORD_PATH).href);
  const tree = buildIsolatedTree(join(ROOT, 'loop-kit'));
  try {
    await withSwappedBootInTree(tree, throwingBoot, () => {
      const r = spawnSync(process.execPath, [join(tree, 'loop-kit', 'bin', 'gate.mjs')], { cwd: tree, encoding: 'utf8', env: { PATH: process.env.PATH } });
      assert(r.status === 64, `boot.runCli 抛错时 shim 应兜住并归一 exit 64（cli 类），实得 ${r.status}（stderr=${r.stderr}）`);
    });
  } finally {
    destroyIsolatedTree(tree);
  }
});

// round-1 实现审 A2 采信：spawnSync 的 r.error（派生失败）与 status===null 且无信号无 error 两态，
// 在真实 OS 上无法跨平台确定性构造（process.execPath 派生自身几乎不会失败；status===null 且无信号
// 无 error 是 Node 文档列出的极端边缘态）。改走桩注入接缝（spawnImpl，仅测试可达、生产零跳过口，
// 与 pkgDirOverride/lockPathOverride 同类）在真实 runCli 代码路径上行为级验证，取代此前的源码字符串断言。
// round-2 实现审 codex HIGH 采信：这两态在 cli/guard/lint 三态下的归一退出码彼此相同（64/2/0）——
// 只断言退出码时，若生产代码误删 `if (r.error) {...}` 分支、让 r.error 桩落进下面的
// `typeof r.status !== 'number'` 判据（两者都会把 status 置为非 number），退出码完全不变、测试仍绿
// （这正是 round-1 要消除的「删掉对应分支测试仍过」）。改用 assertDegradesAllKindsWithReason 额外核验
// degrade() 打到 console 的诊断文本确实含各自专属判据字样，二者互斥、彼此不可混淆。
await assertDegradesAllKindsWithReason(
  'spawnSync 派生失败（r.error，桩注入行为级验证）',
  (kind) => runCliDirect({
    kind,
    pkgDirOverride: EXPECTED_DIR,
    lockPathOverride: KIT_LOCK,
    spawnImpl: () => ({ error: new Error('模拟 spawn 派生失败'), status: null, signal: null }),
  }),
  /SPAWN_ERROR|子进程派生失败/
);

await assertDegradesAllKindsWithReason(
  'status===null 且无信号无 error（桩注入行为级验证，取代源码字符串断言）',
  (kind) => runCliDirect({
    kind,
    pkgDirOverride: EXPECTED_DIR,
    lockPathOverride: KIT_LOCK,
    spawnImpl: () => ({ error: null, status: null, signal: null }),
  }),
  /NO_STATUS|status=null 且无信号无 error/
);

await check('C4', '目标模块 import 抛错：boot.loadLib 原样冒泡该错误（不吞、不误判为其它降级类别）', async () => {
  // plan §3 S3「目标模块 import 抛错」场景：库模式无 exit code 概念，抛错应直接向上冒泡给调用方
  // （由调用方——shim 的 else 分支——决定是否再抛），不应被 boot 自身吞掉或误归类为锁/包故障。
  assert(existsSync(PKG_DIR), '真包不存在（需要真包的 lib/root.mjs 供本测试包借用）');
  const dir = mkdtempSync(join(tmpdir(), 'loop-kit-c4-tgtthrow-'));
  try {
    mkdirSync(join(dir, 'bin'), { recursive: true });
    mkdirSync(join(dir, 'lib'), { recursive: true });
    writeFileSync(join(dir, 'bin', 'throwing.mjs'), "throw new Error('模拟目标模块 import 抛错');\n", 'utf8');
    // boot.loadLib 在 import 目标脚本之前总先 import 包内 lib/root.mjs 完成 ROOT 认领——本测试包也要有它，
    // 否则会在「认领」这一步就先因 lib/root.mjs 缺失而抛 MODULE_NOT_FOUND，测不到「目标脚本 import 抛错」这条分支。
    cpSync(join(PKG_DIR, 'lib', 'root.mjs'), join(dir, 'lib', 'root.mjs'));
    const lock = await lockMatching(dir);
    const lockPath = `${dir}.lock.json`; // 锁文件须落在包目录之外，否则自身被当成「清单外多余文件」
    writeLock(lockPath, lock);
    const boot = await import(pathToFileURL(BOOT_PATH).href + '?c4tgtthrow=' + Math.random());
    let threw = null;
    try {
      await boot.loadLib({ script: 'throwing.mjs', pkgDirOverride: dir, lockPathOverride: lockPath });
    } catch (e) {
      threw = e;
    }
    assert(threw, '目标模块 import 期间抛错应原样冒泡给调用方（库模式无 exit code 概念），不应被吞');
    assert(/模拟目标模块 import 抛错/.test(String(threw && threw.message)), `应原样冒泡目标模块的错误，实得：${threw && threw.message}`);
  } finally {
    rmrfWithLock(dir);
  }
});

await check('C4', '认领 API 抛错：ROOT 认领冲突发生在目标模块 import 之前，目标模块的副作用绝不执行', async () => {
  // plan §3 S3「认领 API 抛错」场景，同时是「求值前认领」顺序的强证据：目标模块若真的被 import 了会
  // 落一个哨兵文件；本检查制造一个真实的跨树 ROOT 冲突（先经真 shim 认领 treeA，再直接调用 boot.loadLib
  // 指向另一个真实 Casey 树 ROOT），断言第二次调用抛出认领冲突错误、且哨兵文件从未被创建过。
  const treeA = mkdtempSync(join(tmpdir(), 'loop-kit-c4-claimthrow-treeA-'));
  const sentinelPkgDir = mkdtempSync(join(tmpdir(), 'loop-kit-c4-claimthrow-pkg-'));
  const sentinelMarkerPath = join(tmpdir(), `loop-kit-c4-claimthrow-marker-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  const wrapperPath = join(tmpdir(), `loop-kit-c4-claimthrow-wrapper-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  const sentinelLockPath = `${sentinelPkgDir}.lock.json`; // 锁文件须落在包目录之外，否则自身被当成「清单外多余文件」
  try {
    assert(existsSync(PKG_DIR), '真包不存在（需要真包的 lib/root.mjs 供本测试包借用）');
    mkdirSync(join(treeA, 'loop'), { recursive: true });
    writeFileSync(join(treeA, 'loop', 'config.json'), '{}', 'utf8');
    cpSync(join(ROOT, 'loop-kit'), join(treeA, 'loop-kit'), { recursive: true });

    mkdirSync(join(sentinelPkgDir, 'bin'), { recursive: true });
    mkdirSync(join(sentinelPkgDir, 'lib'), { recursive: true });
    // 同上一个检查的理由：boot.loadLib 先 import 包内 lib/root.mjs 完成 ROOT 认领，此步骤（预期真的抛出
    // 认领冲突）必须先能成功找到 lib/root.mjs，否则测到的是「模块缺失」而不是「认领冲突」。
    cpSync(join(PKG_DIR, 'lib', 'root.mjs'), join(sentinelPkgDir, 'lib', 'root.mjs'));
    writeFileSync(
      join(sentinelPkgDir, 'bin', 'sentinel.mjs'),
      `import { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(sentinelMarkerPath)}, 'imported', 'utf8');\n`,
      'utf8'
    );
    const { hashTree } = await import(pathToFileURL(HASH_TREE_PATH).href);
    const { files } = hashTree(sentinelPkgDir);
    writeFileSync(sentinelLockPath, JSON.stringify({ schemaVersion: 1, files }), 'utf8');

    const wrapperSrc = `import { pathToFileURL } from 'node:url';
// 先经真 shim（treeA）认领 ROOT=treeA。
await import(pathToFileURL(${JSON.stringify(join(treeA, 'loop-kit', 'bin', 'contract.mjs'))}).href);
const boot = await import(pathToFileURL(${JSON.stringify(BOOT_PATH)}).href);
let threw = null;
try {
  await boot.loadLib({ script: 'sentinel.mjs', pkgDirOverride: ${JSON.stringify(sentinelPkgDir)}, lockPathOverride: ${JSON.stringify(sentinelLockPath)} });
} catch (e) { threw = String(e && e.message); }
console.log(JSON.stringify({ threw }));
`;
    writeFileSync(wrapperPath, wrapperSrc, 'utf8');
    // treeA 的 shim 自身也要能解析到一个通过锁校验的真包——用 LOOP_KIT_PKG 指向真包（其 tmpdir 不是
    // Casey 树的兄弟目录，隐式约定不可达）；boot.loadLib 的第二次调用显式传 pkgDirOverride，不受此环境变量影响。
    const r = spawnSync(process.execPath, [wrapperPath], {
      encoding: 'utf8',
      env: { PATH: process.env.PATH, LOOP_KIT_PKG: PKG_DIR },
    });
    assert(r.status === 0, `包装进程本身应正常退出，实得 ${r.status}\nstdout=${r.stdout}\nstderr=${r.stderr}`);
    const out = JSON.parse(r.stdout.trim().split('\n').pop());
    assert(out.threw, '第二次 loadLib（真实 ROOT 与已认领的 treeA 不同）应抛认领冲突错误，实际未抛');
    assert(/认领冲突|RootResolutionError/.test(out.threw), `应为 ROOT 认领冲突结构化错误，实得：${out.threw}`);
    assert(!existsSync(sentinelMarkerPath), '认领应在目标模块 import 之前失败——目标模块的副作用（哨兵文件）不应被创建，但探测到它存在了');
  } finally {
    rmrf(treeA);
    rmrf(sentinelPkgDir);
    try { unlinkSync(sentinelLockPath); } catch { /* ignore */ }
    try { unlinkSync(sentinelMarkerPath); } catch { /* ignore */ }
    try { unlinkSync(wrapperPath); } catch { /* ignore */ }
  }
});

await check('C4', '特殊字符包路径（空格/#/%）：boot.loadLib 正确 import root.mjs 与目标模块（round-2 实现审 A6 回归测试）', async () => {
  // round-1 A6 修复本身（file://${dir}/ 字符串拼接改 pathToFileURL(join(...))）是对的，但 round-1 未
  // 真正补上「补空格/#/%路径用例」——round-2 实现审 codex MED 指出：若日后有人把 loadLib 退回字符串
  // 拼接 URL，当前金牌仍会全绿。本检查把包放在同时含空格、#、% 的物理路径下，驱动 boot.loadLib 真实
  // import root.mjs 与目标模块，钉死「两者都必须成功」这一行为，防止该退化再次悄悄发生。
  assert(existsSync(PKG_DIR), '真包不存在（需要真包的 lib/root.mjs 供本测试包借用）');
  const specialDir = join(tmpdir(), `loop-kit c4 special #pkg%2Fdir ${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const specialLockPath = `${specialDir}.lock.json`;
  try {
    mkdirSync(join(specialDir, 'bin'), { recursive: true });
    mkdirSync(join(specialDir, 'lib'), { recursive: true });
    cpSync(join(PKG_DIR, 'lib', 'root.mjs'), join(specialDir, 'lib', 'root.mjs'));
    writeFileSync(join(specialDir, 'bin', 'marker.mjs'), 'export const MARKER = "special-path-ok";\n', 'utf8');
    const { hashTree } = await import(pathToFileURL(HASH_TREE_PATH).href);
    const { files } = hashTree(specialDir);
    writeFileSync(specialLockPath, JSON.stringify({ schemaVersion: 1, files }), 'utf8');
    const boot = await import(pathToFileURL(BOOT_PATH).href + '?c4special=' + Math.random());
    const mod = await boot.loadLib({ script: 'marker.mjs', pkgDirOverride: specialDir, lockPathOverride: specialLockPath });
    assert(mod.MARKER === 'special-path-ok', `应正确 import 特殊字符路径下的目标模块，实得 ${JSON.stringify(Object.keys(mod))}`);
  } finally {
    rmrf(specialDir);
    try { unlinkSync(specialLockPath); } catch { /* ignore */ }
  }
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
// round-1 实现审 A1 采信后修订：认领槽从 root.mjs 模块顶层变量改为 globalThis[Symbol.for(...)]
// 进程级共享位置——这是本次修复的核心目的（进程唯一 ROOT 真正跨模块实例成立），但也意味着此前
// 「同一文件用不同 query 串 import 出独立模块实例、从而各自拿到一份新鲜 claimed」的测试隔离手法
// 不再成立：任何两次 import 都会共享同一个 globalThis 槽。C7 每个场景因此改为在独立子进程里跑——
// 子进程有自己的 globalThis，天然互不污染，且不依赖本 golden 进程自身是否已在别处（如 C1/C2）
// 认领过 ROOT。runRootProbe(bodySrc) 是通用探针：把 bodySrc 接到「import 真包的 lib/root.mjs」
// 之后拼成一个临时脚本、spawn 一个全新 Node 进程执行，探针脚本用 console.log(JSON.stringify(...))
// 把结果传回，父进程解析最后一行 JSON 断言。
function runRootProbe(bodySrc) {
  assert(existsSync(PKG_DIR), '真包不存在（红基线：包不存在、无 resolveRoot() 可测）');
  const probePath = join(tmpdir(), `loop-kit-c7-probe-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  const rootUrl = pathToFileURL(join(PKG_DIR, 'lib', 'root.mjs')).href;
  const src = `import { resolveRoot, claimedRoot, RootResolutionError } from ${JSON.stringify(rootUrl)};\n${bodySrc}\n`;
  writeFileSync(probePath, src, 'utf8');
  try {
    return spawnSync(process.execPath, [probePath], { encoding: 'utf8' });
  } finally {
    try { unlinkSync(probePath); } catch { /* ignore */ }
  }
}
function lastJson(stdout) {
  const lines = stdout.trim().split('\n');
  return JSON.parse(lines[lines.length - 1] || '{}');
}
function markerRootDir(base) {
  const d = join(base, 'marker-root');
  mkdirSync(join(d, 'loop'), { recursive: true });
  writeFileSync(join(d, 'loop', 'config.json'), '{}', 'utf8');
  return d;
}

await check('C7', 'env 有效命中：realpath 规范化后返回', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'loop-kit-c7-'));
  try {
    const dirA = markerRootDir(tmp);
    const r = runRootProbe(`
const got = resolveRoot({ envRoot: ${JSON.stringify(dirA)}, cwd: ${JSON.stringify(tmp)} });
console.log(JSON.stringify({ got }));
`);
    assert(r.status === 0, `探针子进程应正常退出，实得 ${r.status}\nstdout=${r.stdout}\nstderr=${r.stderr}`);
    const { got } = lastJson(r.stdout);
    assert(existsSync(got), 'resolveRoot 返回值应是存在的目录');
    assert(got.endsWith('marker-root') || got.includes('marker-root'), `应指向 dirA，实得 ${got}`);
  } finally {
    rmrf(tmp);
  }
});

await check('C7', 'env 无效立即失败，绝不静默回退到 cwd 上溯', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'loop-kit-c7-'));
  try {
    const validCwdRoot = markerRootDir(join(tmp, 'valid-for-cwd'));
    const r = runRootProbe(`
let threw = false, message = '';
try {
  resolveRoot({ envRoot: ${JSON.stringify(join(tmp, 'does-not-exist'))}, cwd: ${JSON.stringify(validCwdRoot)} });
} catch (e) {
  threw = true; message = String(e.message);
}
console.log(JSON.stringify({ threw, message }));
`);
    assert(r.status === 0, `探针子进程应正常退出，实得 ${r.status}\nstderr=${r.stderr}`);
    const { threw, message } = lastJson(r.stdout);
    assert(threw, 'env 无效时应立即抛错，不应静默回退到 cwd 上溯成功返回');
    assert(/RootResolutionError|不存在/.test(message), `应为结构化错误，实得：${message}`);
  } finally {
    rmrf(tmp);
  }
});

await check('C7', '上溯命中根标记：cwd 逐级向上找到 loop/config.json', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'loop-kit-c7-'));
  try {
    const rootDir = markerRootDir(tmp);
    const nested = join(rootDir, 'a', 'b', 'c');
    mkdirSync(nested, { recursive: true });
    // envRoot 传 ''（非 undefined）强制走「缺席」分支——JS 默认参数在显式传 undefined 时仍会取
    // process.env.LOOP_KIT_ROOT，探针子进程若从本 golden 进程继承到该变量，必须显式绕开、不依赖环境干净。
    const r = runRootProbe(`
const got = resolveRoot({ envRoot: '', cwd: ${JSON.stringify(nested)} });
console.log(JSON.stringify({ got }));
`);
    assert(r.status === 0, `探针子进程应正常退出，实得 ${r.status}\nstderr=${r.stderr}`);
    const { got } = lastJson(r.stdout);
    assert(got.includes('marker-root'), `应上溯命中 rootDir，实得 ${got}`);
  } finally {
    rmrf(tmp);
  }
});

await check('C7', '上溯无标记抛结构化错误（不终止宿主进程）', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'loop-kit-c7-noanchor-'));
  try {
    const r = runRootProbe(`
let threw = false, isErrorInstance = false, isRootResolutionError = false, name = '';
try {
  resolveRoot({ envRoot: '', cwd: ${JSON.stringify(tmp)} }); // '' 强制走缺席分支，见上一检查同注
} catch (e) {
  threw = true;
  isErrorInstance = e instanceof Error;
  name = e.name;
  isRootResolutionError = !RootResolutionError || e.name === 'RootResolutionError';
}
console.log(JSON.stringify({ threw, isErrorInstance, isRootResolutionError, name }));
`);
    // 探针进程本身应正常退出（status 0）——这本身就证明 resolveRoot 未调用 process.exit 终止宿主进程。
    assert(r.status === 0, `探针子进程应正常退出（若 resolveRoot 误用 process.exit 终止宿主进程，这里就不会是 0），实得 ${r.status}\nstderr=${r.stderr}`);
    const { threw, isErrorInstance, isRootResolutionError, name } = lastJson(r.stdout);
    assert(threw, '无标记时应抛错，不应返回');
    assert(isErrorInstance, '应是 Error 实例（结构化，非 process.exit）');
    assert(isRootResolutionError, `错误类型应为 RootResolutionError，实得 ${name}`);
  } finally {
    rmrf(tmp);
  }
});

await check('C7', 'realpath 规范化：经软链解析后返回真实路径', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'loop-kit-c7-symlink-'));
  try {
    const realDir = markerRootDir(join(tmp, 'real-target'));
    const linkPath = join(tmp, 'link-to-root');
    symlinkSync(realDir, linkPath, 'dir');
    const r = runRootProbe(`
const got = resolveRoot({ envRoot: ${JSON.stringify(linkPath)}, cwd: ${JSON.stringify(tmp)} });
console.log(JSON.stringify({ got, sameAsLink: got === ${JSON.stringify(linkPath)} }));
`);
    assert(r.status === 0, `探针子进程应正常退出，实得 ${r.status}\nstderr=${r.stderr}`);
    const { got, sameAsLink } = lastJson(r.stdout);
    assert(!sameAsLink, 'resolveRoot 不应原样返回软链路径');
    assert(got.includes('real-target'), `应解析到真实目标，实得 ${got}`);
  } finally {
    rmrf(tmp);
  }
});

await check('C7', '原子认领：首认领成立、同根幂等、异根立即抛、认领后不可变；探针回报认领值', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'loop-kit-c7-claim-'));
  try {
    const dirA = markerRootDir(join(tmp, 'a'));
    const dirB = markerRootDir(join(tmp, 'b'));
    const unrelated = join(tmp, '完全不相关且无标记的路径');
    // 本检查的多步（首认领/幂等/冲突/不可变/省略 envRoot 复用）刻意都在同一个子进程内依次调用
    // resolveRoot——这正是要测的「同进程内」不变量本身，故不拆到更多子进程，只在外层用一个子进程隔离。
    const r = runRootProbe(`
const results = {};
results.initialClaimedNull = claimedRoot() === null;
const first = resolveRoot({ envRoot: ${JSON.stringify(dirA)}, cwd: ${JSON.stringify(tmp)} });
results.probeAfterFirst = claimedRoot() === first;
const again = resolveRoot({ envRoot: ${JSON.stringify(dirA)}, cwd: ${JSON.stringify(tmp)} });
results.idempotent = again === first;
let conflictThrew = false, conflictMsgOk = false;
try {
  resolveRoot({ envRoot: ${JSON.stringify(dirB)}, cwd: ${JSON.stringify(tmp)} });
} catch (e) {
  conflictThrew = true;
  conflictMsgOk = /认领冲突/.test(e.message);
}
results.conflictThrew = conflictThrew;
results.conflictMsgOk = conflictMsgOk;
results.claimUnchangedAfterConflict = claimedRoot() === first;
const viaOmitted = resolveRoot({ envRoot: '', cwd: ${JSON.stringify(unrelated)} });
results.omittedReusesClaim = viaOmitted === first;
console.log(JSON.stringify(results));
`);
    assert(r.status === 0, `探针子进程应正常退出，实得 ${r.status}\nstderr=${r.stderr}`);
    const out = lastJson(r.stdout);
    assert(out.initialClaimedNull, '未认领时探针应返回 null');
    assert(out.probeAfterFirst, '首认领后探针应回报认领值');
    assert(out.idempotent, '同根幂等：重复解析应返回同一值');
    assert(out.conflictThrew, '异根解析应立即抛错');
    assert(out.conflictMsgOk, '异根应抛认领冲突错误（消息应含「认领冲突」）');
    assert(out.claimUnchangedAfterConflict, '认领后不可变：失败的异根尝试不应更新认领值');
    assert(out.omittedReusesClaim, '已认领时省略 envRoot 应直接复用认领值，不依赖 cwd 上溯');
  } finally {
    rmrf(tmp);
  }
});

await check('C7', '槽内容不可信防线：外部预置的无效值不被幂等复用照单全收（round-2 实现审 A1）', () => {
  // codex round-2 实测复现：globalThis[Symbol.for('loop-kit:root:claimed')] = '/preseeded' 后，
  // resolveRoot({envRoot:''}) 旧版会直接返回未经校验的 '/preseeded'。本检查钉死修复后的行为：
  // 复用前重新校验，槽内容不存在/无根标记时立即抛错，不会被当成「已验证过」而照单全收。
  const r = runRootProbe(`
let threw = false, message = '';
globalThis[Symbol.for('loop-kit:root:claimed')] = '/this-path-almost-certainly-does-not-exist-xyz';
try {
  resolveRoot({ envRoot: '', cwd: '/tmp' });
} catch (e) {
  threw = true; message = String(e.message);
}
console.log(JSON.stringify({ threw, message }));
`);
  assert(r.status === 0, `探针子进程应正常退出，实得 ${r.status}\nstderr=${r.stderr}`);
  const { threw, message } = lastJson(r.stdout);
  assert(threw, '外部预置的无效槽值在幂等复用时应被拒绝，不应静默返回');
  assert(/RootResolutionError|不存在/.test(message), `应为结构化错误，实得：${message}`);
});

await check('C7', '认领后不可变：外部直接改写 globalThis 槽会被冻结拒绝（round-2 实现审 A1）', () => {
  // globalThis[Symbol.for(...)] 一旦公开，同进程任何代码都能读写——首次认领后必须冻结该属性，
  // 否则「认领后不可变」只是本模块自身遵守的君子协定，同进程其它代码仍可静默替换认领值。
  const tmp = mkdtempSync(join(tmpdir(), 'loop-kit-c7-freeze-'));
  try {
    const dirA = markerRootDir(tmp);
    const r = runRootProbe(`
const first = resolveRoot({ envRoot: ${JSON.stringify(dirA)}, cwd: ${JSON.stringify(tmp)} });
let tamperThrew = false;
try {
  globalThis[Symbol.for('loop-kit:root:claimed')] = '/tampered-after-claim';
} catch (e) {
  tamperThrew = true;
}
console.log(JSON.stringify({ first, tamperThrew, stillClaimed: claimedRoot() }));
`);
    assert(r.status === 0, `探针子进程应正常退出，实得 ${r.status}\nstderr=${r.stderr}`);
    const out = lastJson(r.stdout);
    assert(out.tamperThrew, '首认领后，同进程其它代码直接改写 globalThis 槽应被冻结拒绝（抛错），实际未抛');
    assert(out.stillClaimed === out.first, `认领值应在改写尝试后保持不变，实得 ${out.stillClaimed}（应为 ${out.first}）`);
  } finally {
    rmrf(tmp);
  }
});

await check('C7', '外部预置合法 ROOT 后再改写另一合法 ROOT：应在首次被信任使用时就地补冻结，不给「两个合法值间来回切换」留窗口（round-2 第二轮实现审 codex HIGH）', () => {
  // codex round-2 第二轮独立探针实测复现的缺口：此前的冻结只挂在「从空槽写入」这一条路径（claimAtomic
  // 的 current===null 分支）上——外部若用普通赋值预置一个已经合法、规范化的 ROOT，resolveRoot 的幂等
  // 复用路径会校验通过并接受它，但从未走到 writeClaimed()，属性仍可写；外部随后可再悄悄换成另一个同样
  // 合法的 ROOT，下次复用又校验通过——同一进程先后「认领」了两个不同的合法值，违反「首次认领后不可变」。
  // 本检查钉死修复：只要某个槽值被首次信任使用（无论是从空槽写入、还是幂等复用一个外部预置的合法值），
  // 该属性此刻起必须已是冻结形态，此后任何改写尝试都应被拒绝。
  const tmp = mkdtempSync(join(tmpdir(), 'loop-kit-c7-preseed-swap-'));
  try {
    const dirA = markerRootDir(join(tmp, 'a'));
    const dirB = markerRootDir(join(tmp, 'b'));
    const r = runRootProbe(`
// 外部普通赋值预置一个合法 ROOT（不经 claimAtomic/writeClaimed）。
globalThis[Symbol.for('loop-kit:root:claimed')] = ${JSON.stringify(dirA)};
const before = Object.getOwnPropertyDescriptor(globalThis, Symbol.for('loop-kit:root:claimed'));
const first = resolveRoot({ envRoot: '', cwd: ${JSON.stringify(tmp)} }); // 幂等复用路径应就地补冻结
const after = Object.getOwnPropertyDescriptor(globalThis, Symbol.for('loop-kit:root:claimed'));
let swapThrew = false;
try {
  globalThis[Symbol.for('loop-kit:root:claimed')] = ${JSON.stringify(dirB)}; // 尝试换成另一个同样合法的 ROOT
} catch (e) {
  swapThrew = true;
}
console.log(JSON.stringify({
  beforeWasWritable: before.writable, first, afterIsFrozen: after.writable === false && after.configurable === false,
  swapThrew, stillClaimed: claimedRoot(),
}));
`);
    assert(r.status === 0, `探针子进程应正常退出，实得 ${r.status}\nstderr=${r.stderr}`);
    const out = lastJson(r.stdout);
    assert(out.beforeWasWritable, '外部普通赋值预置的属性理应是可写的（测试前提校验）');
    assert(out.first.includes('a'), `幂等复用应接受外部预置的合法值 dirA，实得 ${out.first}`);
    assert(out.afterIsFrozen, '幂等复用一个此前未被本模块冻结的合法值后，该属性此刻起应已是冻结形态');
    assert(out.swapThrew, '冻结之后尝试换成另一个同样合法的 ROOT 应被拒绝（抛错），实际未抛——两个合法值之间的静默切换窗口未关闭');
    assert(out.stillClaimed === out.first, `认领值应保持为最初信任使用的那个值，实得 ${out.stillClaimed}（应为 ${out.first}）`);
  } finally {
    rmrf(tmp);
  }
});

await check('C7', '非主线程拒绝：worker_threads 内调用 resolveRoot() 应显式拒绝，不静默各自认领（round-2 实现审 A1）', () => {
  // worker_threads 的每个 Worker 有独立 globalThis，本机制无法跨 Worker 协调认领——codex round-2 用两个
  // Worker 各自成功认领不同 ROOT、零冲突复现了这一点。本仓与消费侧均未使用 worker_threads（已 grep
  // 核验零命中），修复方向是让非主线程调用显式失败，而不是让各 Worker 静默各自认领造成假象。
  assert(existsSync(PKG_DIR), '真包不存在');
  const workerSrc = `import { parentPort } from 'node:worker_threads';
import { pathToFileURL } from 'node:url';
const rootMod = await import(pathToFileURL(${JSON.stringify(join(PKG_DIR, 'lib', 'root.mjs'))}).href);
let threw = null;
try {
  rootMod.resolveRoot({ envRoot: process.env.LOOP_KIT_ROOT || '', cwd: process.cwd() });
} catch (e) {
  threw = String(e && e.message);
}
parentPort.postMessage({ threw });
`;
  const workerPath = join(tmpdir(), `loop-kit-c7-worker-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  const mainSrc = `import { Worker } from 'node:worker_threads';
const w = new Worker(${JSON.stringify(workerPath)});
w.on('message', (msg) => { console.log(JSON.stringify(msg)); w.terminate(); });
w.on('error', (e) => { console.log(JSON.stringify({ workerError: String(e && e.message) })); });
`;
  const mainPath = join(tmpdir(), `loop-kit-c7-worker-main-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(workerPath, workerSrc, 'utf8');
  writeFileSync(mainPath, mainSrc, 'utf8');
  try {
    const r = spawnSync(process.execPath, [mainPath], { encoding: 'utf8' });
    assert(r.status === 0, `外层进程应正常退出，实得 ${r.status}\nstdout=${r.stdout}\nstderr=${r.stderr}`);
    const out = lastJson(r.stdout);
    assert(!out.workerError, `Worker 自身不应崩溃（应是 resolveRoot 内部抛错并被捕获回传），实得 workerError=${out.workerError}`);
    assert(out.threw, 'worker_threads 内调用 resolveRoot() 应抛错拒绝，不应静默返回某个认领值');
    assert(/主线程|worker_threads|isMainThread/.test(out.threw), `应为「仅支持主线程」的结构化错误，实得：${out.threw}`);
  } finally {
    try { unlinkSync(workerPath); } catch { /* ignore */ }
    try { unlinkSync(mainPath); } catch { /* ignore */ }
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
