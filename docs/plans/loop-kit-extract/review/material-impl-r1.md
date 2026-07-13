# loop-kit-extract 实现审评审料（r1）

> 用途：喂给异构冗余实现审（`codex` / `pi`）。只含 spec、diff、门禁证据；不含实现者推理、不含凭据。
> 契约：`loop-kit-extract`（`full` 车道、`kernel` 级加严）。Casey 树 `/mnt/d/ctx/heren/casey-loop-kit-extract`
> （分支 `loop-kit-extract`，HEAD `31e71de`，父提交 `f9f9019`，`dev` 基线 `0e7c415`）。包仓
> `/mnt/d/ctx/heren/loop-kit`（fresh git init，首提交 `0f34cc0`，出处 `casey@f9f9019`）。
> 设计唯一事实源：`docs/plans/loop-kit-extract/plan.md` + `proposed/GRILL.md`（已过两轮 codex 异构设计审 +
> Steven 有条件签字，条件已满足）。本审是设计落地后的**实现**审，不重开设计讨论。

---

## 0. 评审指令（原样转发）

kernel 级实现审——重点打：`shim`/`boot`/`root` 三件对设计的忠实度（D5 全故障域矩阵每格真实现了吗）、
`ROOT` 原子认领有无残留环境突变或缓存绕过、`kit-lock` 校验有无 TOCTOU 或可跳过通道（`LOOP_KIT_PKG` 是否真不
豁免校验）、金牌是否真能证伪（C2 基线规范化有没有把真差异洗掉）、冻结纪律（`passes` 谁写的、checksum 全吗）、
幂等与半份写盘、凭据外泄、术语违例；按 HIGH/MED/LOW 列 findings（文件+行+问题+建议），无发现给 PASS。

---

## 1. GRILL/plan 决策要点摘录

### 1.1 车道与授权

- `full` 车道 + `kernel` 级加严（ADR-0008 决策 4）：双设计审 + 异构冗余实现审 + 全仓门禁 + Steven 人签。
- route:human 四裁定（Steven 2026-07-13）：
  1. 实现开工闸——**有条件签署**，条件 = round-2 codex 设计审收口（已满足）。
  2. D5 降级加严——**加严接受**：`hook-loop-guard` 的 `shim` 对合法态 0/2 之外一切引导失败与子进程异常态一律归一
     `exit 2` 拦（对既有「hook 自身故障不阻塞」约定的定向加严）。
  3. D2 包仓历史——**取 fresh `git init`**，不携两仓历史，出处以 SHA 记包 `README.md`。
  4. D8 依赖声明——**取甲**：单出口只走兄弟约定，`package.json` 不加 `"loop-kit": "file:../loop-kit"`。
  - route:human #5（跨仓棘轮机制形态）、#6（R2-L1 性能预算）本轮机器已记录现状但仍待续裁，不阻塞本次收口。

### 1.2 D4 —— `shim` 协议与 ROOT 解析（唯一语义改动面，逐字摘录）

> 包内新增 `lib/root.mjs`，单点 `resolveRoot()`：`LOOP_KIT_ROOT` 在场则必须有效——目录存在 + 含
> `loop/config.json` 根标记 + `realpath` 规范化，无效**立即失败**、绝不静默回退；变量缺席才自 `process.cwd()`
> 逐级上溯找根标记（同样校验 + 规范化）；两路皆空抛**结构化错误**——库函数绝不 `process.exit` 终止宿主进程。
> 解析成功即在 `lib/root.mjs` 内**原子认领**进程唯一 ROOT（首次认领后进程内不可变、同根幂等；库模式由 `boot`
> 在目标模块求值前经显式 API 认领），此后任何解析或认领出异根**立即抛**结构化错误——绝不静默采用他树 ROOT、
> 绝不更新认领值；另导出探针 = 认领值的只读查询口（评审 R2-H3 采信，取代「import 后核对探针」——codex 复现
> 证明后者在交错导入下探针被后续导入刷新、缓存命中模块的实际锚定树不可证）。

> Casey 侧新增共享引导助手 `loop-kit/lib/boot.mjs`：包定位、**包身份锁**校验、env 注入、转发与降级逻辑单点收
> 此一处，十个 `shim` 只调它。`shim` 模板内以最小内联 `try/catch` 边界包住对 `boot` 的动态 import 与调用：
> `boot` 缺失、语法损坏、依赖装载失败、锁解析抛错等一切 `boot` 侧故障均被边界捕获、按 D5 逐入口降级——降级逻辑
> 集中到 `boot` 不等于 `boot` 自身故障可以绕过矩阵（评审 R2-H1 采信）。信任边界明示：`shim` 自身字节损坏在归一
> 保证之外——`shim` 是信任根一员，由 Casey git 树与本 prd 冻结面护，无法由自身兜底。

> `shim`：包定位 `LOOP_KIT_PKG` 环境变量（显式定位口——只改包位置、**不豁免校验**；评审 R2-H2 采信：任何受
> 支持布局都不存在无校验通道）→ 静态兄弟约定 `new URL('../../../loop-kit', import.meta.url)`。**两路一体**：
> 每次转发前对 `kit-lock.json` 全清单 sha256 校验，失配视同包缺失按 D5 逐入口降级；默认锁 = Casey 树内
> `loop-kit/kit-lock.json`，测试走**独立受测锁注入接缝**（`boot` 的锁文件位置参数化，生产入口零跳过口）。

> 包身份锁：`kit-lock.json` 记包**全清单**——除 `.git` 外全部常规文件的路径 + sha256，语义 = **严格集合相等**：
> 清单件缺失、哈希失配、清单外多余文件、软链接等非常规文件均判失配；路径经规范化并限界包根之内。锁**纯内容
> 寻址**、可自期望存档预计算，不含包仓 commit——commit 降为事后出处信息，只记包 `README.md`、运行时不校验
> （评审 R2-M3 采信）。威胁模型明示（评审 R2-M2 采信）：锁防**漂移与误配**，不防校验后毫秒窗口内的主动替换
> （检查—执行竞态单人本机场景记档接受，不做执行时快照）。

> ROOT 注入：以 `shim` 自身位置为准。CLI 模式经 `spawnSync` 的 env 选项注入子进程，**宿主进程环境零改写**；
> 库模式**零环境突变**（评审 R2-H3 采信，废除 round-1「设 env → 动态 import → `finally` 恢复」——codex 并发
> 复现证明交错导入下 `finally` 恢复仍残留污染值）：`boot` 先 import 包 `lib/root.mjs`、经显式 API 原子认领本
> 树 ROOT（认领即校验），认领成功才动态 import 目标模块，宿主 `process.env` 全程一字不动。

> **同进程跨树防线**（评审 M2 + R2-H3 采信收严）：包模块 URL 全树相同、ESM 缓存首树 ROOT 常驻，防线立在
> **求值前原子认领**而非 import 后核对——树 B 的 `boot` 在动态 import 前认领 ROOT=B，与已认领的树 A 异根即抛
> 结构化错误，缓存命中与否都到不了「静默采用树 A ROOT」。

### 1.3 D5 —— fail-safe 降级矩阵（全故障域，逐字摘录）

> 故障面 = **信任根之外的完整引导失败域**——包目录缺失、身份锁失配（含包文件损坏与清单外文件）、目标脚本
> 缺失/不可读、`boot` 自身缺失/语法损坏/依赖装载失败/锁解析抛错、`spawnSync` 报 error、子进程信号终止、
> `status === null` 且无信号无 error、子进程意外退出码。分类按**侦测点**划界（评审 R2-M1 采信）：
> spawn/import 前可确定性侦测的引导失败逐入口归一；子进程一经派生，其数值退出码对普通 CLI 一律原码透传——
> 语法损坏、Node 不兼容等只在子进程内暴露的故障对 CLI 表现为原码（exit 1 等），**代价记档**：受支持路径上包
> 文件损坏已被锁校验前置拦截，残余暴露面 = 锁本身冻错或 Node 环境不兼容。`shim` 自身损坏在信任根内、不在本
> 矩阵保证内。

| 入口 | 合法态 | 全部引导失败与异常态 |
|---|---|---|
| CLI `shim`（`gate`/`contract`/`breaker`/`term-lint`/`ratchet`/`review-deepseek`） | 子进程任何正常退出码**原码透传** | spawn 前可侦测的引导失败 → `exit 64` + stderr 补救提示；子进程一经派生，任何数值退出码原码透传（含子进程内才暴露的语法损坏 `exit 1`）；子进程信号终止 → 以同信号自终 |
| `hook-loop-guard` `shim` | 0（放行）/ 2（拦）原样透传 | **其余一切**一律归一 `exit 2` 拦 + stderr 说明（route:human #2 定向加严接受） |
| `hook-stop`/`hook-posttool`/`hook-loop-triage` `shim` | 0 / 2 原样透传 | **其余一切**一律一行 `WARN` + `exit 0`（ADR-0005 fail-open 立场） |

### 1.4 验收点 S1–S4（story 划分，冻进 prd，逐字摘录）

- **S1 包保真与根语义（C0+C1+C7）**：红=包不存在；绿=C0 包内除 `.git` 外全清单对期望存档逐文件 sha256 相等且
  集合严格相等，且期望存档/`kit-lock.json`/真包三方一致；C1 经 `shim` import 的 `contract`/`term-lint`/`ratchet`
  导出名集合对提取前快照（18/3/4 名）deepEq 且逐名 `typeof` 相等；C7 `resolveRoot()` 语义组（env 有效命中 /
  env 无效立即失败不回退 / 上溯命中根标记 / 上溯无标记抛结构化错误 / `realpath` 规范化 / 原子认领 / 探针）。
- **S2 切换等价（C2+C5）**：红=提取前全量引擎无视 `LOOP_KIT_PKG`、文件非 `shim` 模板形状；绿=标记包证明真转发
  （校验不豁免）+ 全命令矩阵对切换前冻结的观测基线比对（exit code + 规范化 stdout/stderr 全文 + 整个测试根路
  径与字节差量，声明写集之外零变化）+ 反向扰动用例；C5 十件 `shim` 由单一模板 + 每件参数展开生成，金牌对展开
  结果逐字比对。
- **S3 布局、降级与跨树（C3+C4）**：红=提取前无降级协议；绿=三布局场景（同层默认/异地树+显式`LOOP_KIT_PKG`/
  异地树无覆盖按 D5 安全失败）+ 跨树防线（求值前认领拦下，绝不静默采用他树 ROOT）+ C4 故障族矩阵逐入口断言。
- **S4 存量零重签（C6，非回归钉）**：三金牌与其 prd 零字节改动（写死切换前 git blob SHA、断言当前字节等于该
  锚）、经 `shim` 复跑照绿；全仓 gate 复验 GREEN。红基线豁免：本 story 守「既有绿不许变红」，无先红语义。

### 1.5 挂账（R2-L1，未阻塞）

> 每调用对 `kit-lock.json` 全清单 sha256 校验的性能预算未量化收口。codex round-2 实测指示值：本树十脚本约
> 64 KB，DrvFs 冷态下空 Node 启动约 0.02 秒、逐文件读取并 sha256 约 0.17 秒，一次编辑可能触发多个 hook、成本
> 叠加。实现期未补冷/热缓存与完整包全清单实测数据；**禁止**为提速引入削弱完整性的 `mtime` 缓存。route:human
> #6 待 Steven 续裁，现状（无缓存、每调用全量 sha256）按 D5 加严裁定原样生效。

---

## 2. 变更文件清单（`git diff dev...HEAD --stat`，Casey 树）

```
 CLAUDE.md                                          |   6 +
 CONTEXT.md                                         |   5 +-
 docs/HANDOFF.md                                    |  15 +
 docs/NEXT-SESSION.md                               |  24 +-
 docs/plans/loop-kit-extract/plan.md                |  90 +++
 docs/plans/loop-kit-extract/proposed/GRILL.md      | 108 ++++
 docs/plans/loop-kit-extract/review/*.md            | (5 份既往设计审归档，本轮不重开)
 loop-kit/bin/breaker.mjs                           | 113 +---  （全量引擎 → shim，净减）
 loop-kit/bin/contract.mjs                          | 388 +++--------
 loop-kit/bin/gate.mjs                              | 136 +---
 loop-kit/bin/hook-loop-guard.mjs                   |  93 +--
 loop-kit/bin/hook-loop-triage.mjs                  |  52 +-
 loop-kit/bin/hook-posttool.mjs                     |  58 +-
 loop-kit/bin/hook-stop.mjs                         |  66 +-
 loop-kit/bin/ratchet.mjs                           | 319 ++-------
 loop-kit/bin/review-deepseek.mjs                   |  96 +--
 loop-kit/bin/term-lint.mjs                         | 178 ++----
 loop-kit/kit-lock.json                             |  18 +   （新增，全文见 §3.4）
 loop-kit/lib/boot.mjs                              | 189 ++++++ （新增，全文见 §3.1）
 loop/prd-loop-kit-extract.json                     | 174 +++++ （新增，全文见附件/task 上下文）
 tests/_golden/loop-kit-extract.golden.mjs          | 711 +++++++++++++++++++++ （新增，全文见 §4）
 tests/fixtures/loop-kit-expected/**                | 81 个文件（期望包存档13 + shim-template + hash-tree
                                                       + baseline 26 案 raw/normalized/fixture/commands/
                                                       normalize/record，多为数据/记录产物，关键逻辑件见 §5）
 99 files changed, 6573 insertions(+), 1136 deletions(-)
```

**十个 `shim` 的性质**：十个 `loop-kit/bin/*.mjs` 均从「全量引擎实现」整体替换为「薄转发层」（净行数大幅减
少）。十件字节形状完全由 `tests/fixtures/loop-kit-expected/shim-template.mjs` 的 `renderShim()` + `SHIM_PARAMS`
参数表决定，彼此间只在 `script`/`kind`/`libNames` 三参数上有差异（见 §3.3）。因此本料只贴一份代表性 `shim`
全文（`gate.mjs`，无库导出、`kind=cli`），其余九份的实际内容见 Casey 树 `loop-kit/bin/*.mjs`，逐字比对逻辑见
`tests/_golden/loop-kit-extract.golden.mjs` C5 分组（§4 已含全文）。

包仓（`/mnt/d/ctx/heren/loop-kit`）首提交 `0f34cc0`，13 个文件（`fresh git init`，无历史）：

```
README.md
bin/breaker.mjs
bin/contract.mjs
bin/gate.mjs
bin/hook-loop-guard.mjs
bin/hook-loop-triage.mjs
bin/hook-posttool.mjs
bin/hook-stop.mjs
bin/ratchet.mjs
bin/review-deepseek.mjs
bin/term-lint.mjs
lib/root.mjs      （唯一新增逻辑面，全文见 §3.2）
package.json
```

包内 `bin/*.mjs` 十脚本内容 = Casey 树 `tests/fixtures/loop-kit-expected/package/bin/*.mjs` 逐字节相等（由
金牌 C0 断言 + `kit-lock.json` sha256 钉死，本料不重复贴出十份全文，避免与设计既定的「机械 ROOT 行替换、逐
字节照搬」重复；如需核对某一份，Casey 树对应期望存档路径已在 §2 文件清单中）。

---

## 3. 关键实现全文

### 3.1 `loop-kit/lib/boot.mjs`（Casey 侧，全文，189 行）

```javascript
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
import { fileURLToPath } from 'node:url';

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

// ---- CLI 转发 ----
// kind: 'cli'（gate/contract/breaker/term-lint/ratchet/review-deepseek）| 'guard'（hook-loop-guard）|
//       'lint'（hook-stop/hook-posttool/hook-loop-triage）。三类降级语义见 D5 矩阵、plan.md GRILL.md。
export function runCli({ script, kind, argv = process.argv.slice(2), pkgDirOverride, lockPathOverride } = {}) {
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
  const r = spawnSync(process.execPath, [target, ...argv], {
    stdio: 'inherit',
    env: { ...process.env, LOOP_KIT_ROOT: TREE_ROOT },
  });
  if (r.error) {
    return degrade(kind, new BootError(`子进程派生失败：${r.error.message}`, { code: 'SPAWN_ERROR' }));
  }
  if (r.signal) {
    if (kind === 'cli') {
      // 子进程信号终止 → 以同信号自终，保留 shell 128+n 语义（D5 CLI 行）。
      try { process.kill(process.pid, r.signal); } catch { /* ignore */ }
      return 1; // 若信号未能实际终止本进程（极端环境），仍给一个非零兜底码
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
export async function loadLib({ script, pkgDirOverride, lockPathOverride } = {}) {
  const dir = resolveVerifiedPkg({ pkgDirOverride, lockPathOverride });
  const rootMod = await import(new URL('lib/root.mjs', `file://${dir}/`).href);
  rootMod.resolveRoot({ envRoot: TREE_ROOT }); // 显式参数认领——目标模块随后裸调用走幂等分支，不依赖 cwd
  return import(new URL(`bin/${script}`, `file://${dir}/`).href);
}

// 仅供测试探查默认位置（不改变行为，探针性质）。
export function defaults() {
  return { treeRoot: TREE_ROOT, pkgDir: DEFAULT_PKG_DIR, lockPath: DEFAULT_LOCK_PATH };
}
```

### 3.2 `lib/root.mjs`（包仓内，全文，93 行）

```javascript
#!/usr/bin/env node
// lib/root.mjs — loop-kit 包内 ROOT 解析与原子认领单点（提取后包内唯一新增逻辑面，GRILL D4）。
//
// 语义（评审 M2/M3/R2-H3 收严后版本）：
//   1. LOOP_KIT_ROOT（显式参数 envRoot，缺省读同名环境变量）在场则必须有效——目录存在 + 含
//      loop/config.json 根标记 + realpath 规范化；无效立即失败，绝不静默回退到 cwd 上溯。
//   2. envRoot 缺席时：若本进程已认领过 ROOT，直接复用认领值（幂等，不重复上溯）；否则自 cwd
//      （缺省 process.cwd()）逐级上溯找根标记，同样校验 + 规范化。
//   3. 两路皆空/皆无效 → 抛结构化 RootResolutionError；本函数绝不 process.exit 终止宿主进程——
//      受支持入口（Casey 侧 shim/boot）总先注入有效 ROOT，本函数在受支持路径不会失败。
//   4. 解析成功即原子认领进程唯一 ROOT：首次认领后不可变、同根幂等；异根立即抛、绝不静默采用
//      他树 ROOT、绝不更新认领值。库模式下 boot 在目标模块求值前以显式 envRoot 参数调用本函数完成
//      认领；随后目标模块自身的裸调用（走 2 的幂等分支）取得同一值，不依赖 cwd 恰好匹配。
//   5. claimedRoot() 是认领值的只读探针；未认领返回 null。
import { existsSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export class RootResolutionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RootResolutionError';
  }
}

let claimed = null; // 进程唯一认领值（realpath 规范化后的绝对路径字符串）；null=未认领

function hasRootMarker(dir) {
  return existsSync(join(dir, 'loop', 'config.json'));
}

function validate(dir, sourceLabel) {
  const abs = resolve(String(dir));
  if (!existsSync(abs)) {
    throw new RootResolutionError(`${sourceLabel} 指向的目录不存在：${abs}`);
  }
  if (!hasRootMarker(abs)) {
    throw new RootResolutionError(`${sourceLabel} 指向的目录缺根标记 loop/config.json：${abs}`);
  }
  try {
    return realpathSync.native(abs);
  } catch (e) {
    throw new RootResolutionError(`${sourceLabel} 指向的目录 realpath 失败：${abs}（${e.message}）`);
  }
}

function upwardSearch(startCwd) {
  let cur = resolve(String(startCwd));
  for (;;) {
    if (hasRootMarker(cur)) {
      try {
        return realpathSync.native(cur);
      } catch (e) {
        throw new RootResolutionError(`上溯命中的根标记目录 realpath 失败：${cur}（${e.message}）`);
      }
    }
    const parent = dirname(cur);
    if (parent === cur) return null;
    cur = parent;
  }
}

function claimAtomic(candidate) {
  if (claimed === null) {
    claimed = candidate;
    return claimed;
  }
  if (claimed !== candidate) {
    throw new RootResolutionError(
      `ROOT 认领冲突：进程已认领「${claimed}」，此次解析得「${candidate}」——同进程跨树不支持，绝不静默采用其一`
    );
  }
  return claimed;
}

// 单点解析 + 原子认领。envRoot 缺省读 process.env.LOOP_KIT_ROOT；cwd 缺省读 process.cwd()。
// 显式传参（boot 库模式用法）与缺省裸调用（CLI 转发子进程 / 受支持路径外的直接调用）共用同一函数、同一原子性。
export function resolveRoot({ envRoot = process.env.LOOP_KIT_ROOT, cwd = process.cwd() } = {}) {
  if (envRoot !== undefined && envRoot !== '') {
    return claimAtomic(validate(envRoot, 'LOOP_KIT_ROOT'));
  }
  if (claimed !== null) return claimed; // 已认领：幂等直接复用，不重复上溯（同进程库模式的核心防线）
  const found = upwardSearch(cwd);
  if (!found) {
    throw new RootResolutionError(`未设 LOOP_KIT_ROOT，且从 ${resolve(String(cwd))} 上溯未找到根标记 loop/config.json`);
  }
  return claimAtomic(found);
}

// 只读探针：查询本进程已认领的 ROOT；未认领返回 null。
export function claimedRoot() {
  return claimed;
}
```

### 3.3 代表性 `shim`（`loop-kit/bin/gate.mjs`，Casey 树，全文）+ 模板/参数表

```javascript
#!/usr/bin/env node
// loop-kit/bin/gate.mjs —— 薄转发层（shim，由单一模板生成，勿手改；真实现在独立包 loop-kit，兄弟目录
// 或 LOOP_KIT_PKG 显式指向）。全部包定位/身份锁校验/env 注入/降级逻辑单点收在 loop-kit/lib/boot.mjs，
// 本文件只调它，并以最小内联 try/catch 兜住 boot 自身故障（评审 R2-H1）。
// 模板源：tests/fixtures/loop-kit-expected/shim-template.mjs（C5 金牌逐字比对钉死展开结果，勿分叉手改）。
// 详见 docs/plans/loop-kit-extract/plan.md D4/D5、proposed/GRILL.md。
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __self = fileURLToPath(import.meta.url);
const isMain = process.argv[1] ? resolve(process.argv[1]) === __self : false;
const __DEGRADE = { cli: 64, guard: 2, lint: 0 };
function __fallbackDegrade(kind, err) {
  const code = __DEGRADE[kind] ?? 64;
  if (kind === 'lint') {
    console.log(`WARN  loop-kit 引导失败（lint 监督层不阻塞）：${err && err.message}`);
    return 0;
  }
  console.error(`loop-kit shim 引导失败：${err && err.message}\n补救：确认 ../../loop-kit（或 LOOP_KIT_PKG 指向的包）存在且完整，或修复 loop-kit/lib/boot.mjs。`);
  return code;
}

let __boot, __bootError;
try {
  __boot = await import('../lib/boot.mjs');
} catch (e) {
  __bootError = e;
}

if (isMain) {
  if (__bootError) {
    process.exitCode = __fallbackDegrade("cli", __bootError);
  } else {
    try {
      process.exitCode = __boot.runCli({ script: "gate.mjs", kind: "cli" });
    } catch (e) {
      process.exitCode = __fallbackDegrade("cli", e);
    }
  }
}
```

模板 `renderShim({script, kind, libNames})`（`tests/fixtures/loop-kit-expected/shim-template.mjs`，
生成与 C5 校验共用同一函数）额外分支——当 `libNames.length > 0` 时插入：

```javascript
export let <name1>;
export let <name2>;
...
if (!isMain) {
  if (__bootError) throw __bootError;
  const __lib = await __boot.loadLib({ script: "<script>" });
  <name1> = __lib.<name1>;
  ...
}
```

十件参数登记表（唯一事实源，生成脚本与 C5 金牌都从这里取）：

```javascript
export const SHIM_PARAMS = [
  { script: 'breaker.mjs', kind: 'cli', libNames: [] },
  { script: 'contract.mjs', kind: 'cli', libNames: [
      'STAGES', 'touchesImpl', 'initContract', 'canAdvance', 'advanceStage', 'doneThrough',
      'checkAction', 'gitSub', 'bashAction', 'stripPathspec', 'commitArgs', 'actionFromTool',
      'isValidSlug', 'defaultWorktreePath', 'parseWorktreePorcelain', 'describeBaton', 'slugTaken',
      'isPathInsideRepo' ] },
  { script: 'gate.mjs', kind: 'cli', libNames: [] },
  { script: 'hook-loop-guard.mjs', kind: 'guard', libNames: [] },
  { script: 'hook-loop-triage.mjs', kind: 'lint', libNames: [] },
  { script: 'hook-posttool.mjs', kind: 'lint', libNames: [] },
  { script: 'hook-stop.mjs', kind: 'lint', libNames: [] },
  { script: 'ratchet.mjs', kind: 'cli', libNames: ['normalizeRepoPath', 'buildRatchetIndex', 'verifyRatchet', 'findAffectedPrds'] },
  { script: 'review-deepseek.mjs', kind: 'cli', libNames: [] },
  { script: 'term-lint.mjs', kind: 'cli', libNames: ['parseRegistry', 'scanText', 'lintFiles'] },
];
```

### 3.4 `loop-kit/kit-lock.json`（Casey 树，全文）

```json
{
  "schemaVersion": 1,
  "files": {
    "README.md": "73324a00ce15b52552fd4a867d731f45ff926a7dff716f6c17830037bf9d2963",
    "bin/breaker.mjs": "361f4735d7023e7bd4d8dbb8ab1269d584f11572cfe109b34b18df0c7cdce83b",
    "bin/contract.mjs": "3a27cf86109633c2379936ddd6a25aec5e977172f38a042667a66c445106e7af",
    "bin/gate.mjs": "e55569206fdd8f8f28c0a66a8c704d13c60486a53dda27d21fa41856dac13bb4",
    "bin/hook-loop-guard.mjs": "ce1dc94fa4ab5e29fc2e3263e12e0f9f8510811c5e922ac8efb3f1a7a548c560",
    "bin/hook-loop-triage.mjs": "cf621f4cd554182290b1905a07764a0e9c7b4611e978d4bb8ea6e1040f750819",
    "bin/hook-posttool.mjs": "2c09f3014f0bc42cc9b5452377acba9aa9f8c566a4e4902cbc05fcfedd9bbcde",
    "bin/hook-stop.mjs": "087090a4f4eceed831adc07112ae499b5e804236943f6bf5806585302d5673b5",
    "bin/ratchet.mjs": "bc0389a1b6951154af961520d728eeaf06a31b9da7d4072ac7731297b7c70f3b",
    "bin/review-deepseek.mjs": "11ed6d0aa25d650004f545febe31ebaa2ee018d33b979da72476d58ce2a36e09",
    "bin/term-lint.mjs": "802b71d7ca27c8db2ff91bc5f1108e1ded6d233ebfe89021824ec57d14554cf0",
    "lib/root.mjs": "512dc7f82a1f56817dbf79e93c3a245c06e6be85c2213d6e11922938cb40c9a1",
    "package.json": "1f435d74bae0b8db750cdd85033b3364b6431212d3b24702c7e4f6a0cf1b1279"
  }
}
```

已核验：以上 13 个 sha256 值均以 `sha256sum` 独立重算包仓 `/mnt/d/ctx/heren/loop-kit` 内对应文件核对，逐一
相等（本料准备过程中现场复算，非引用实现者说法）。

### 3.5 包 `README.md`（全文）

```markdown
# loop-kit

可复用 loop engineering 工具箱：契约（Loop Contract）/ 质量门禁（Quality Gate）/ 熔断器（Circuit Breaker）/
统一语言强制（term-lint）/ Test Ratchet 反向索引 的确定性内核。以确定性退出码为唯一真相：默认 FAIL，凭证据翻绿。

## 出处

本包由 `loop-kit-extract` 契约从 casey 仓提取为独立包（`docs/adr/0008-loop-kit-extraction.md`，2026-07-13 拍板路线①）：

- 提取源：casey 仓 `HEAD=f9f9019`（`loop-kit/bin/` 十脚本原地拷贝，`contract.mjs`/`ratchet.mjs` 以 casey 版为准）。
- 提取前，`breaker.mjs`/`gate.mjs`/`hook-loop-guard.mjs`/`hook-loop-triage.mjs`/`hook-posttool.mjs`/`hook-stop.mjs`/
  `review-deepseek.mjs`/`term-lint.mjs` 八份脚本与 autotester 仓同名文件逐字节 `cmp` 一致（对齐基线）；
  `contract.mjs` 已分叉（本包取 casey 版，含 `worktree` baton 全套）；`ratchet.mjs` 为 casey 独有件。
- 本仓 `fresh git init`，不携 casey/autotester 两仓历史（route:human #3，Steven 2026-07-13 裁定）。

## 双消费者

- **casey**（`docs/adr/0001-reuse-loop-kit.md`）：`loop-kit/bin/*.mjs` 十件原地换同名薄转发层（`shim`），经
  `loop-kit/lib/boot.mjs`（casey 侧新增引导助手）定位本包、校验 `kit-lock.json` 包身份锁、转发 CLI/库调用。
- `autotester`（`docs/adr/0001-loop-kit-incubation.md`，孵化源仓）：待其自身迁移工作流对齐本包（非本契约范围）。

## 分发形态

**拓扑优先，不是绝对路径**：本包与各消费树天然是**兄弟目录**——`../<消费仓目录名>` 平级、`../loop-kit` 平级。
消费树默认按此静态兄弟约定直解析本包（零安装、零 `node_modules` 依赖）；非常规布局（异地 clone、任意路径
worktree）须由消费侧显式设 `LOOP_KIT_PKG` 指向本包实际位置。npm 本地路径依赖（`file:../loop-kit`）是
autotester ADR-0001 预定的第二出口，本次提取契约未采用（route:human #4，Steven 2026-07-13 裁定：取甲，
不加依赖声明）——如后续确需该出口，由另一契约评估。

`/mnt/d/ctx/heren/loop-kit` 只是当前环境下的一个实例位置，不是本包必须坐落的绝对路径。

## 布局

（bin/ 十脚本 + lib/root.mjs + package.json，见 §2 文件清单）

## 凭据边界

`review-deepseek.mjs` 读取的 DeepSeek key 位于消费侧 `~/.loop-kit/config.json`（仓外），本包自身不含任何凭据、
不读写 `.auth/` 或 `site.json`。
```

---

## 4. 兼容性金牌全文（`tests/_golden/loop-kit-extract.golden.mjs`，C0–C7，711 行）

> 红先行：本文件在包/协议落成前逐条验红（C0/C2/C4/C5/C7 见各自红基线摘录于代码注释中；C6 全程照绿）；
> 落成后逐条转绿，冻进 `loop/prd-loop-kit-extract.json` 的 `testChecksums`
> （`f2b61c9ef8a012c42e6e88a02a7d71132718023c22fc92da40a513bb397d6dd4`）。

```javascript
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
```

---

## 5. 观测基线支撑代码（C2 关键逻辑，全文）

### 5.1 `tests/fixtures/loop-kit-expected/baseline/record.mjs`（隔离树驱动，全文）

```javascript
#!/usr/bin/env node
// record.mjs —— 切换前观测基线的共享驱动（plan.md D7 C2、GRILL D4/D5 R2-H4）。
// 被两处复用：① 本次录制（一次性，冻结 raw/ + normalized/）；② C2 金牌的实时复跑（post-switch，
// 用现树 loop-kit/ 内容重跑同一命令矩阵，与冻结 normalized/ 比对）。两处必须共用同一驱动逻辑，
// 否则「录制协议」与「复跑协议」各自漂移即失去比对意义。
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, readdirSync, rmSync, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const FIXTURE_DIR = join(HERE, 'fixture');
export const COMMANDS_PATH = join(HERE, 'commands.json');

export function loadCommands() {
  return JSON.parse(readFileSync(COMMANDS_PATH, 'utf8'));
}

// 建隔离测试树：mkdtemp + 递归拷贝夹具 + 把「当前 loop-kit 源」（bin/ 及可能的 lib/、kit-lock.json）
// 铺进 <tree>/loop-kit/——保证「脚本自身位置=树根」的锚定语义在隔离树内继续成立（切换前/后均然）。
export function buildIsolatedTree(loopKitSourceDir, { baseDir = tmpdir() } = {}) {
  const tree = mkdtempSync(join(baseDir, 'loop-kit-baseline-'));
  cpSync(FIXTURE_DIR, tree, { recursive: true });
  mkdirSync(join(tree, 'loop-kit'), { recursive: true });
  cpSync(loopKitSourceDir, join(tree, 'loop-kit'), { recursive: true });
  return tree;
}

export function destroyIsolatedTree(tree) {
  try { rmSync(tree, { recursive: true, force: true }); } catch { /* ignore */ }
}

function applyResets(tree, resets) {
  for (const r of resets || []) {
    if (r.op === 'rm') {
      try { unlinkSync(join(tree, r.path)); } catch { /* 不存在即忽略——重置是幂等的 */ }
    }
  }
}

function substitutePlaceholders(text, tree) {
  if (typeof text !== 'string') return text;
  return text.split('{{TREE_ROOT}}').join(tree);
}

// 全清单快照：hashes 覆盖树内全部文件（含 loop-kit/，捕捉 boot 在树内任何位置的意外副作用）；
// contents 只收 loop-kit/ 之外的文件全文（loop-kit/ 引擎件不预期自变，全文快照对空间无意义）。
export function snapshotTree(tree) {
  const hashes = {};
  const contents = {};
  function walk(cur, relPrefix) {
    for (const ent of readdirSync(cur, { withFileTypes: true })) {
      if (ent.name === '.git') continue;
      const abs = join(cur, ent.name);
      const rel = relPrefix ? `${relPrefix}/${ent.name}` : ent.name;
      if (ent.isDirectory()) { walk(abs, rel); continue; }
      if (!ent.isFile()) continue;
      const buf = readFileSync(abs);
      hashes[rel] = createHash('sha256').update(buf).digest('hex');
      if (!rel.startsWith('loop-kit/')) contents[rel] = buf.toString('utf8');
    }
  }
  walk(tree, '');
  return { hashes, contents };
}

// 单案执行：cwd 固定树根；env 只含 PATH + case.env（值相对树根解析为绝对路径）+ 调用方额外覆盖
// （如 LOOP_KIT_PKG，供 C2 转发证明/后续复跑注入）；stdin 支持 {{TREE_ROOT}} 占位替换。
export function runCase(tree, caseDef, { extraEnv = {} } = {}) {
  applyResets(tree, caseDef.reset);
  const script = join(tree, 'loop-kit', 'bin', caseDef.script);
  const args = caseDef.args || [];
  const env = { PATH: process.env.PATH };
  for (const [k, v] of Object.entries(caseDef.env || {})) {
    env[k] = resolve(tree, v);
  }
  Object.assign(env, extraEnv);
  const input = caseDef.stdin !== undefined ? substitutePlaceholders(caseDef.stdin, tree) : undefined;
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd: tree,
    env,
    input,
    encoding: 'utf8',
  });
  const snapshot = snapshotTree(tree);
  return {
    caseId: caseDef.id,
    exitCode: r.status,
    signal: r.signal,
    error: r.error ? String(r.error.message) : null,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    tree: snapshot,
  };
}

export function runAllCases(tree, cases, opts = {}) {
  const out = [];
  for (const c of cases) out.push(runCase(tree, c, opts));
  return out;
}
```

### 5.2 `tests/fixtures/loop-kit-expected/baseline/normalize.mjs`（规范化器，全文，自身入 prd 冻结面）

```javascript
#!/usr/bin/env node
// normalize.mjs —— 观测基线规范化器（自身入 prd 冻结面，plan.md D7 C2）。
// 字段级白名单：只替换两类逐一登记的易变值——① 隔离树自身绝对根路径 → <TREE_ROOT>；
// ② ISO 8601 时间戳（如 breaker --reset 写入 .breaker-state.json 的 startedAt）→ <TIMESTAMP>。
// 白名单之外一字不动；反向扰动用例（证明本规范化不吞真实差异）见 tests/_golden/loop-kit-extract.golden.mjs C2。
const TIMESTAMP_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g;

export function normalize(raw, { treeRoot }) {
  let text = JSON.stringify(raw);
  if (treeRoot) text = text.split(treeRoot).join('<TREE_ROOT>');
  text = text.replace(TIMESTAMP_RE, '<TIMESTAMP>');
  return JSON.parse(text);
}
```

### 5.3 `tests/fixtures/loop-kit-expected/hash-tree.mjs`（全清单哈希器，全文）

```javascript
#!/usr/bin/env node
// hash-tree.mjs —— 包全清单哈希器（除 .git 外全部常规文件，递归，posix 相对路径排序）。
// 被 kit-lock.json 生成与 loop-kit-extract.golden.mjs 的 C0/C4 共用，防「生成」与「校验」各自长出一套算法。
// 非常规文件（软链接、设备文件等）单独收集于 irregular——按严格集合语义应判失配，不计入 files。
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function hashTree(dir) {
  const files = {};
  const irregular = [];
  function walk(cur, relPrefix) {
    const entries = readdirSync(cur, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name === '.git') continue;
      const abs = join(cur, ent.name);
      const rel = relPrefix ? `${relPrefix}/${ent.name}` : ent.name;
      if (ent.isDirectory()) { walk(abs, rel); continue; }
      if (ent.isFile()) {
        files[rel] = createHash('sha256').update(readFileSync(abs)).digest('hex');
        continue;
      }
      irregular.push(rel);
    }
  }
  walk(dir, '');
  return { files, irregular, paths: Object.keys(files).sort() };
}
```

### 5.4 观测基线命令矩阵清单（`commands.json`，26 案，schemaVersion 1）

命令次序即执行次序；`env` 是相对夹具根的覆盖（`LOOP_CONTRACT_FILE` 等隔离槽）；`reset` 是案前重置步骤；
`stdin` 支持 `{{TREE_ROOT}}` 占位替换为隔离树绝对根；`cwd` 固定为隔离树根。26 案覆盖：`term-lint`
（`--registry`/`--file` 干净与违例/`--stdin`）、`breaker`（`--reset`/`--round` 正常与带错误）、`gate --dry`、
`ratchet index`、`contract`（`init`/`show`/`check write-prd` 前后态/`advance grill`/`advance plan`/`list`
非 git 仓降级）、四 hook（`hook-loop-triage` 命中/未命中、`hook-loop-guard` 放行/无 contract 拦/未过 accept
拦、`hook-posttool` 干净/违例、`hook-stop` 干净/违例）。原始输出（`raw/`）与规范化输出（`normalized/`）逐案
并存，各 26 个 JSON 文件（本料不逐一贴出，均已冻进 `loop/prd-loop-kit-extract.json` 的 `testChecksums`）。

---

## 6. 红先行证据摘录（来自本契约交付记录，非引用实现者当场推理）

> `tests/_golden/loop-kit-extract.golden.mjs`（C0–C7，55 检查）落地前逐条验红：
> - C0 红=包不存在；
> - C2 红=转发证明「全量引擎无视 `LOOP_KIT_PKG`」（标记包子进程从未被真正调用，老代码走自身内联逻辑）；
> - C3 红=异地布局/跨树部分场景（老代码无 `LOOP_KIT_PKG` 支持、无跨树冲突检测）；
> - C4 红=全部故障族（无降级协议，老代码要么直接崩溃要么静默继续）；
> - C5 红=现文件非 `shim`（现文件是全量引擎源码，逐字比对模板展开结果必不相等）；
> - C1（API 面）与 C6（三存量金牌非回归）依设计全程照绿（无先红语义，C6 明确记档「守既有绿」）。
> `contract advance accept --red-verified` 之后才动 `loop-kit/bin` 字节；建成后 55/55 转绿。

工程纪律记档（同批交接文档）：「提取类契约红先行验红须先备份原实现字节，待金牌与红证落定后再生成新实现，防
『验红』环节被自己提前生成的实现悄悄跳过」——已作为本契约与后续同类契约的准则记入交接文档。

---

## 7. gate / 复验证据摘录

### 7.1 本 prd gate（`node loop-kit/bin/gate.mjs --prd loop/prd-loop-kit-extract.json`）—— GREEN 5/5

| story | acceptance | evidence（`passes` 字段，gate.mjs 独占写入） |
|---|---|---|
| s1-package-fidelity-and-root-semantics（C0+C1+C7） | `node tests/_golden/loop-kit-extract.golden.mjs --group C0,C1,C7` | `gate@2026-07-13T13:59:55.638Z` 全部 acceptance exit 0 |
| s2-switch-equivalence（C2+C5） | `--group C2,C5` | `gate@2026-07-13T14:00:07.546Z` exit 0 |
| s3-layout-degrade-cross-tree（C3+C4） | `--group C3,C4` | `gate@2026-07-13T14:00:16.234Z` exit 0 |
| s4-legacy-zero-resign（C6） | `--group C6` | `gate@2026-07-13T14:00:57.087Z` exit 0 |
| s5-tier1-regression | `node bin/casey.mjs selftest --tier1` | `gate@2026-07-13T14:00:59.891Z` exit 0 |

`passes` 全部为 `gate.mjs` 独占写入（本料未手改该字段）；prd 完整 JSON 见 §附/Casey 树
`loop/prd-loop-kit-extract.json`（含 `testChecksums` 与 `observability` 五条记档，见下）。

### 7.2 tier1 自检（`node bin/casey.mjs selftest --tier1`）—— GREEN

五项独立跑通：统一语言注册表完整性 / 弃用别名黑名单方向判红 / 熔断器可清零 / 质量门禁消费 1-story 契约翻绿 /
裁判零 LLM（`verdict-purity-guard`，闭包无 LLM/网络客户端）。

### 7.3 全量复验（四项）

1. 本 prd gate → GREEN 5/5（同 §7.1）。
2. `node loop-kit/bin/ratchet.mjs verify` → 69 PRD / 189 冻结文件 / 2 问题，两问题均记档为与本契约无关的既有
   缺口（`cases/tc_wf_history_version`、`cases/tc_wf_publish_states` 的 `expected.frozen.json` 属未入库真机
   运行产物，早于本契约 commit `24865f4`，本树从未真机跑过这两条用例）——**零新增问题**。
3. C6 三存量金牌 git blob sha1 逐一核验等于切换前锚（`worktree-baton ac282b2...`/`term-guard eaad943...`/
   `ratchet-reverse-index 0213b0f...` 及其三 prd 全部相符），经 `shim` 独立复跑：`term-guard` exit 0、
   `ratchet-reverse-index` exit 0（8/8 GREEN）、`worktree-baton` exit 1（与切换前该文件在本 worktree 的实测
   复跑结果完全一致——该退出码源于金牌自身一条与「活动 contract slug 恰为 `worktree-baton`」耦合的既有断言
   G6，本树活动 slug 是 `loop-kit-extract`、与本契约切换动作无关，非回归；已冻结为
   `tests/fixtures/loop-kit-expected/baseline/c6-rerun-anchor.json` 供机器比对）。
4. `prd-loop-kit-extract.json` 的 `observability` 字段完整记档五条：全仓 ratchet 两条既有缺口（`waived`）、
   R2-L1 性能债（`human`，待 Steven 续裁）、C0 跨仓棘轮机制形态确认（`machine`）、C3/C4 覆盖范围务实取舍
   （`waived`）、C6 锚点选择口径说明（`waived`）——原文见 §附/Casey 树 `loop/prd-loop-kit-extract.json`。

### 7.4 提交信息

- Casey 树 `31e71de`——「loop-kit-extract 切换收口：loop-kit 提取独立包 + Casey 侧十 shim + gate GREEN
  （P0-3）」：十 shim 改写 + 新增 `loop-kit/lib/boot.mjs`、`loop-kit/kit-lock.json`、
  `loop/prd-loop-kit-extract.json`、`tests/_golden/loop-kit-extract.golden.mjs`、
  `tests/fixtures/loop-kit-expected/**`（81 文件）+ `CLAUDE.md`/`CONTEXT.md`/`docs/HANDOFF.md`/
  `docs/NEXT-SESSION.md` 文档同步，99 files changed（单提交、显式路径，父提交 `f9f9019`）。
- 包仓 `/mnt/d/ctx/heren/loop-kit` 首提交 `0f34cc0`——「loop-kit 独立包首提交：提取自 casey@f9f9019」：
  `fresh git init`（无历史），十脚本（8 份字节一致件 + Casey 版 `contract.mjs` + Casey 独有 `ratchet.mjs`）+
  新增 `lib/root.mjs` + `package.json` + `README.md`，13 files。

---

## 8. 审查者请特别关注（承接 §0 指令，非结论、供审查落点参考）

1. **D5 矩阵完整性**：`loop-kit/lib/boot.mjs` 的 `runCli()`（§3.1）是否真覆盖 §1.3 表格全部行——尤其
   `r.error`（`spawnSync` 报 error）与 `status === null` 且无信号无 error 两态是否有独立分支（后者据交付记录
   为「源码级断言，非行为级复现」，见 golden C4 尾部）。
2. **`kit-lock` 校验时序**：`resolveVerifiedPkg()` 先 `verifyLock` 再返回 `dir`，`runCli`/`loadLib` 均先调用它
   再动作——确认校验确实先于任何包代码执行（含子进程 spawn 与动态 import 两条路径）。`LOOP_KIT_PKG` 只改
   `resolvePkgDir()` 返回值，不改 `verifyLock` 是否被调用——确认无分支能绕过。
3. **ROOT 原子认领**：`lib/root.mjs` 的 `claimed` 是模块级单例（无参数化隔离）——同进程内多次 import 同一 URL
   会复用同一模块实例；跨树冲突检测依赖「两树 shim 使用同一份包代码（`LOOP_KIT_PKG` 指向同一目录）时模块缓存
   键相同」这一前提，若两树各自解析到不同的包目录（无显式 `LOOP_KIT_PKG` 覆盖、各走各的兄弟约定）,ESM 模块
   缓存键因绝对路径不同而不同，`claimed` 会是各自独立的实例——C3 金牌的跨树用例中特意让两树都设
   `LOOP_KIT_PKG` 指向同一真包目录以复现冲突，这一前提假设是否已在设计与实现两侧被清楚记档、是否覆盖了「两
   树各自兄弟约定解析到不同包」这一更常见场景下的行为（该场景下二者互不感知、各自独立认领，是否仍是预期
   安全行为）。
4. **C2 规范化白名单**：`normalize.mjs` 只替换 `<TREE_ROOT>` 与 ISO 时间戳两类值——是否存在其他环境相关但未
   登记的易变字段（如临时目录内的随机后缀、进程 pid、`os.hostname()` 等）本该白名单化却未做，从而让基线比
   对在其他机器上失真或被迫依赖"恰好一致"的偶然性。
5. **冻结纪律**：`passes` 字段是否只由 `gate.mjs` 写入（`loop/prd-loop-kit-extract.json` 未见手工痕迹）；
   `testChecksums` 是否覆盖全部应冻结件（尤其 `loop-kit/kit-lock.json` 本身、`shim-template.mjs`、`boot.mjs`
   是否都在清单内——见 §附 prd 全文）。
6. **凭据边界**：`review-deepseek.mjs` 的凭据路径（`~/.loop-kit/config.json`，仓外）是否在 `shim`/`boot` 改造
   中保持不变、未被本次改动波及。
7. **术语纪律**：本次新增文档（`plan.md`/`GRILL.md`/`CLAUDE.md`/`CONTEXT.md` 增量）是否有繁体字、加粗英文、
   弃用别名误用。
