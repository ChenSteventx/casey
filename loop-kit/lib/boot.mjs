#!/usr/bin/env node
// loop-kit/lib/boot.mjs —— Casey 侧共享引导助手（单点）：包定位、身份锁校验、env 注入、
// CLI 转发 / 库模式 re-export、D5 全故障域降级。十个 shim 只调它——校验与降级逻辑绝不复制十份
// （防引导层自身长出会漂的变体）。本文件是提取契约在 Casey 侧唯一新增的非生成态源文件；
// 十个 shim 由单一模板（tests/fixtures/loop-kit-expected/shim-template.mjs）展开生成。
// 详见 docs/plans/loop-kit-extract/plan.md D4/D5、proposed/GRILL.md。
//
// 信任边界：本文件与 shim、kit-lock.json 一起构成信任根（Casey git 树内、被 prd 冻结面钉住）。
// D5 的「一切引导失败」精确化为「信任根之外的一切引导失败」——本文件自身损坏不在归一保证内
// （由 shim 模板的最小内联 try/catch 捕获、同样按 D5 矩阵降级，见 shim-template.mjs）。
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { constants as OS_CONSTANTS } from 'node:os';

// 本文件位于 <tree>/loop-kit/lib/boot.mjs；TREE_ROOT = 消费树根；DEFAULT_PKG_DIR = 静态兄弟约定
// new URL('../../../loop-kit', import.meta.url)（GRILL D4 字面表述，逐字采用）。
const TREE_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const DEFAULT_PKG_DIR = fileURLToPath(new URL('../../../loop-kit', import.meta.url));
const DEFAULT_LOCK_PATH = join(TREE_ROOT, 'loop-kit', 'kit-lock.json');

// D5 降级码：cli=64（spawn 前可侦测引导失败）；guard=2（一律拦，加严）；lint=0（一律放行 + WARN）。
const DEGRADE_CODE = { cli: 64, guard: 2, lint: 0 };

export class BootError extends Error {
  constructor(message, { code = 'BOOT_FAILURE' } = {}) {
    super(message);
    this.name = 'BootError';
    this.code = code;
  }
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

// 全清单枚举（除 .git）：递归列出 dir 下全部常规文件相对路径（posix 分隔）；非常规文件（软链接等）
// 单独收集——严格集合语义下均判失配。与 tests/fixtures/loop-kit-expected/hash-tree.mjs 同算法
// （各自独立实现、互为交叉验证：C0 用 hash-tree.mjs 复算，本文件是运行时校验，两不共享代码但语义对齐）。
function walkPackage(dir) {
  const files = [];
  const irregular = [];
  function walk(cur, relPrefix) {
    let entries;
    try {
      entries = readdirSync(cur, { withFileTypes: true });
    } catch (e) {
      throw new BootError(`包目录不可读：${cur}（${e.message}）`, { code: 'PKG_UNREADABLE' });
    }
    for (const ent of entries) {
      if (ent.name === '.git') continue;
      const abs = join(cur, ent.name);
      const rel = relPrefix ? `${relPrefix}/${ent.name}` : ent.name;
      if (ent.isDirectory()) { walk(abs, rel); continue; }
      if (ent.isFile()) { files.push(rel); continue; }
      irregular.push(rel);
    }
  }
  walk(dir, '');
  return { files: files.sort(), irregular };
}

function resolvePkgDir(pkgDirOverride) {
  if (pkgDirOverride) return resolve(pkgDirOverride);
  const explicit = process.env.LOOP_KIT_PKG;
  if (explicit) return resolve(explicit); // 只改包位置，不豁免下面的锁校验（评审 R2-H2）
  return DEFAULT_PKG_DIR;
}

// 身份锁校验：严格集合相等（缺件/多件/哈希失配/非常规文件均判失配）。锁位置参数化——生产入口
// 零跳过口：十个 shim 生成时只会调用不带 override 的默认路径；override 仅供直接调用本模块的测试使用。
function verifyLock(dir, lockPath) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new BootError(`包目录不存在：${dir}`, { code: 'PKG_MISSING' });
  }
  let lockRaw;
  try {
    lockRaw = readFileSync(lockPath, 'utf8');
  } catch (e) {
    throw new BootError(`身份锁不可读：${lockPath}（${e.message}）`, { code: 'LOCK_CORRUPT' });
  }
  let lock;
  try {
    lock = JSON.parse(lockRaw);
  } catch (e) {
    throw new BootError(`身份锁 JSON 损坏：${lockPath}（${e.message}）`, { code: 'LOCK_CORRUPT' });
  }
  const expected = lock && typeof lock === 'object' && !Array.isArray(lock) ? lock.files : null;
  if (!expected || typeof expected !== 'object' || Array.isArray(expected)) {
    throw new BootError(`身份锁格式非法（缺 files 字段）：${lockPath}`, { code: 'LOCK_CORRUPT' });
  }
  const expectedPaths = Object.keys(expected).sort();
  const { files: actualPaths, irregular } = walkPackage(dir);
  if (irregular.length) {
    throw new BootError(`包内含非常规文件（软链接等），身份锁按严格集合判失配：${irregular.join(', ')}`, { code: 'LOCK_MISMATCH' });
  }
  const expSet = new Set(expectedPaths);
  const actSet = new Set(actualPaths);
  const missing = expectedPaths.filter((p) => !actSet.has(p));
  const extra = actualPaths.filter((p) => !expSet.has(p));
  if (missing.length || extra.length) {
    throw new BootError(
      `包身份锁失配——缺件: [${missing.join(', ')}] 多余: [${extra.join(', ')}]`,
      { code: 'LOCK_MISMATCH' }
    );
  }
  for (const rel of expectedPaths) {
    const abs = join(dir, ...rel.split('/'));
    let actualHash;
    try {
      actualHash = sha256(abs);
    } catch (e) {
      throw new BootError(`包文件不可读：${rel}（${e.message}）`, { code: 'LOCK_MISMATCH' });
    }
    if (actualHash !== expected[rel]) {
      throw new BootError(`包文件哈希失配：${rel}`, { code: 'LOCK_MISMATCH' });
    }
  }
  return dir;
}

function resolveVerifiedPkg({ pkgDirOverride, lockPathOverride } = {}) {
  const dir = resolvePkgDir(pkgDirOverride);
  const lockPath = lockPathOverride ? resolve(lockPathOverride) : DEFAULT_LOCK_PATH;
  return verifyLock(dir, lockPath);
}

function degrade(kind, err, { silent = false } = {}) {
  const code = DEGRADE_CODE[kind] ?? 64;
  const remediation = `补救：确认 ${DEFAULT_PKG_DIR} 存在且与 kit-lock.json 一致（clone/更新包），或设 LOOP_KIT_PKG 指向正确位置。`;
  if (kind === 'lint') {
    if (!silent) console.log(`WARN  loop-kit 引导失败（lint 监督层不阻塞，fail-open）：${err.message}`);
    return 0;
  }
  if (!silent) console.error(`loop-kit shim 引导失败（${err.code}）：${err.message}\n${remediation}`);
  return code;
}

// 信号名 → 数值编号（POSIX，Node os.constants.signals），供下方自终失败兜底码换算 128+n 用。
function signalNumber(signalName) {
  const n = OS_CONSTANTS && OS_CONSTANTS.signals ? OS_CONSTANTS.signals[signalName] : undefined;
  return typeof n === 'number' ? n : null;
}

// ---- CLI 转发 ----
// kind: 'cli'（gate/contract/breaker/term-lint/ratchet/review-deepseek）| 'guard'（hook-loop-guard）|
//       'lint'（hook-stop/hook-posttool/hook-loop-triage）。三类降级语义见 D5 矩阵、plan.md GRILL.md。
// spawnImpl：测试专用注入口（round-1 实现审 A2 采信新增）——默认真实 spawnSync；生产 shim 从不传参，
// 与 pkgDirOverride/lockPathOverride 同类「生产零跳过口、测试唯一可达」的接缝，供确定性制造
// spawnSync 的 r.error / status===null 等否则无法跨平台稳定复现的返回态。
export function runCli({
  script, kind, argv = process.argv.slice(2), pkgDirOverride, lockPathOverride, spawnImpl = spawnSync,
} = {}) {
  let dir;
  try {
    dir = resolveVerifiedPkg({ pkgDirOverride, lockPathOverride });
  } catch (e) {
    return degrade(kind, e);
  }
  const target = join(dir, 'bin', script);
  if (!existsSync(target)) {
    return degrade(kind, new BootError(`包内目标脚本缺失：${script}`, { code: 'TARGET_MISSING' }));
  }
  const r = spawnImpl(process.execPath, [target, ...argv], {
    stdio: 'inherit',
    env: { ...process.env, LOOP_KIT_ROOT: TREE_ROOT },
  });
  if (r.error) {
    return degrade(kind, new BootError(`子进程派生失败：${r.error.message}`, { code: 'SPAWN_ERROR' }));
  }
  if (r.signal) {
    if (kind === 'cli') {
      // 子进程信号终止 → 以同信号自终，保留 shell 128+n 语义（D5 CLI 行）。
      try {
        process.kill(process.pid, r.signal);
      } catch {
        // 若信号未能实际终止本进程（极端环境，如信号名无法投递），兜底码仍遵循 shell 128+n 语义
        // （round-1 实现审 A7 采信：不用普通业务失败码 1，避免与真实业务 RED 混淆）。
        const n = signalNumber(r.signal);
        return n === null ? 1 : 128 + n; // 连编号都查不到时才退回 1（极端兜底之兜底）
      }
      return 1; // 正常路径：process.kill 已成功投递，本进程即将真的被同信号终止，这里的返回值不会被观察到
    }
    return degrade(kind, new BootError(`子进程被信号终止：${r.signal}`, { code: 'SIGNALED' }));
  }
  if (typeof r.status !== 'number') {
    return degrade(kind, new BootError('子进程未产出退出码（status=null 且无信号无 error）', { code: 'NO_STATUS' }));
  }
  if (kind === 'cli') return r.status; // 数值退出码原码透传（含子进程内才暴露的语法损坏等）
  if (r.status === 0 || r.status === 2) return r.status; // guard/lint 合法态原样透传
  return degrade(kind, new BootError(`子进程退出码 ${r.status} 落在合法态（0/2）之外`, { code: 'UNEXPECTED_EXIT' }));
}

// ---- 库模式：动态 import 包内模块 + 求值前原子认领本树 ROOT（评审 R2-H3）----
// 抛错直接向上冒泡——库模式无 exit code 概念，由调用方（shim 的 else 分支）决定是否再抛。
// URL 构造统一走 pathToFileURL（round-1 实现审 A6 采信）——字符串拼接 file://${dir}/ 在 dir 含 # / % /
// 空格等字符时会被误当 URL fragment/转义序列，锁校验通过后仍可能 import 到错误路径。
export async function loadLib({ script, pkgDirOverride, lockPathOverride } = {}) {
  const dir = resolveVerifiedPkg({ pkgDirOverride, lockPathOverride });
  const rootMod = await import(pathToFileURL(join(dir, 'lib', 'root.mjs')).href);
  rootMod.resolveRoot({ envRoot: TREE_ROOT }); // 显式参数认领——目标模块随后裸调用走幂等分支，不依赖 cwd
  return import(pathToFileURL(join(dir, 'bin', script)).href);
}

// 仅供测试探查默认位置（不改变行为，探针性质）。
export function defaults() {
  return { treeRoot: TREE_ROOT, pkgDir: DEFAULT_PKG_DIR, lockPath: DEFAULT_LOCK_PATH };
}
