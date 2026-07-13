# loop-kit-extract 设计评审逐条处置（codex-sol@max，2026-07-13）

> 汇裁者：fable（与规划方同族——按自评张力护栏，默认采信异构发现，仅凭具体实据反驳）。评审原文：`planreview-codex.md`。修订落点：`../plan.md` 与 `../proposed/GRILL.md`（顶部各记一行修订）。结论：9 条中 8 条采信、1 条（M5）部分采信；无整条证伪。

## H1 `hook-loop-guard` fail-closed 覆盖面不全 —— 采信（代码实证确认）

- 复核实证：`loop-kit/bin/hook-loop-guard.mjs` 的 fail-open（第 70 行 `process.exit(0)`）只护自身 `try` 块；包脚本若语法损坏，exit 1 发生在解析期、任何 `catch` 之前——纯「退出码透传」即 fail-open，与方案自身「只有 2 才拦」约定冲突，codex 判断成立。
- 修订：GRILL D5 重写为全故障域矩阵（三入口 × 合法态透传 / 异常态归一：guard 一律 2、lint 一律 WARN+0、CLI 引导失败 64 + 信号同信号自终 + 正常码原码透传）；C4 从空目录单场景扩为故障族矩阵（plan §3 S3）；route:human #2 扩围披露。

## H2 兄弟约定缺包身份锁、C0 不能当运行前信任根 —— 采信

- 修订：新增 Casey 侧 `loop-kit/kit-lock.json`（**包身份锁**：逐文件 sha256 + 包仓 commit，git 跟踪、随 prd 冻结）与共享引导助手 `loop-kit/lib/boot.mjs`（校验单点，防十份复制）。隐式兄弟解析**每次转发前**全清单校验、失配视同包缺失按 D5 逐入口降级；显式 `LOOP_KIT_PKG` 为操作者逃生口、跳过身份锁（测试与非常规布局所需）。信任根 = Casey git 树内 `shim`+`boot`+`kit-lock`，校验先于任何包代码执行——`gate` 循环信任解除。连带代价（在飞旧分支树被拦）记入 GRILL D9 与 route:human #5；机制本身新增 route:human #6。

## H3 兼容金牌 C0–C6 不足以证行为等价 —— 采信（一处补充语境）

- 修订：① 切换前于提取前 HEAD 录制并冻结**观测基线**（完整 exit code / 规范化 stdout/stderr 全文 / 文件系统差量，命令矩阵 + 四 hook 正常路径），C2 对完整基线比对，废除「关键输出」启发式；② 新增 C7 根语义组，独立作证机械 ROOT 行替换的正确性；③ C5 改单一模板展开 + 逐字比对，废除行数上限/特征串启发式；④ C6 写死三金牌与其 prd 的切换前 git blob SHA 锚；⑤ C1 增逐名 `typeof` 比对。
- 补充语境（不改变采信）：库面行为并非全无覆盖——C6 复跑的 `worktree-baton` 金牌以 `import * as C` 驱 `contract` 多数导出真行为、`term-guard`/`ratchet-reverse-index` 驱其余库面；C1 的行为承担面据此明写为「C2 完整基线 + C6 存量金牌」。

## M1 「无 `node_modules` 可跑」只对同层布局成立 —— 采信

- 修订：GRILL D2 把「包与消费树同层」写成**正式前置条件**（仅主仓与 `contract worktree` 默认落点在保证内）；C3 拆三布局场景：同层默认 / 异地树 + `LOOP_KIT_PKG` / 异地树无覆盖 → D5 安全失败（plan §3 S3）。

## M2 库模式跨树 ESM 缓存污染 + `shim` 永久污染宿主 env —— 采信（代码实证确认）

- 复核实证：七件 ROOT 全部模块级求值（六件 `const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')`，`ratchet.mjs` 第 9 行 `PROJECT_ROOT` 同型），且导出函数以模块级常量作默认参数（`parseRegistry(contextPath = CONTEXT_PATH)`、`buildRatchetIndex(root = PROJECT_ROOT)`）——提取后包模块 URL 全树相同，ESM 缓存首树 ROOT 常驻，codex 判断成立。
- 修订：CLI 模式 env 经 `spawnSync` 选项注入子进程、宿主进程环境零改写；库模式设 env → import → `finally` 恢复；`lib/root.mjs` 导出进程级已解析根探针，`boot` 于 import 后核对、失配抛结构化错误（fail-fast，绝不静默采用他树 ROOT）；C3 增同进程跨树库模式用例。同进程跨树库复用明确不在支持面内。

## M3 `resolveRoot()` 契约不精确 —— 采信

- 修订：显式 env 无效**立即失败**、绝不静默回退；env 与上溯两路径都校验 `loop/config.json` 根标记 + `realpath` 规范化；库函数抛结构化错误、绝不 `process.exit` 终止宿主进程，exit 64 由 Casey 侧引导层在受支持入口给出（受支持入口总先注入有效 ROOT，包内解析失败在受支持路径不可达）；新增 C7 语义组钉死。

## M4 涟漪审计范围过窄 —— 采信（并已补做反查）

- 补做（2026-07-13 本树实测）：本契约全部待改路径（`CLAUDE.md`/`CONTEXT.md`/`docs/HANDOFF.md`/`docs/NEXT-SESSION.md`/`package.json`/`package-lock.json`）对 68 个 prd 反查——`testChecksums` 0 命中；文本提及均为 dimension 散文。另核出两个运行时耦合点（`CONTEXT.md` 受 `--registry` acceptance 活读；`term-guard` 金牌第 122 行 `parseRegistry()` 活读弃用别名名单），属运行时门禁面而非重签面，已记档 plan §0。结论：重签清单仍空，但此结论现在有全路径证据。

## M5 npm 本地路径依赖声明装饰还是生效悬而未决 —— 部分采信

- 采信核心：「二选一、装饰性声明不可接受」成立——D4 解析顺序确实不查 `node_modules`，只加声明不加解析分支即装饰。route:human #4 已收紧为二选一：甲=单出口兄弟约定（plan 默认建议）；乙=加声明则必须成为真实受测解析分支（解析顺序显式加 `node_modules` 步 + 金牌覆盖）并纳入 `package-lock.json` 涟漪复审（本仓有锁文件，实测在案）。
- 反证一处（缩窄「或修正 ADR 表述」分支）：ADR-0008 决策 1 原文「形态沿 autotester ADR-0001 预定……**最终以提取契约 GRILL 定案为准**」——选甲时 GRILL 定案即被 ADR 授权，无需回改 ADR-0008；autotester ADR-0001 的表述归其迁移工作流（D10 非目标）。

## L1 bootstrap 文档写死绝对路径 + guard 拦修复动作未披露 —— 采信

- 修订：plan §1.9——`CLAUDE.md` bootstrap 段拓扑优先（包 = 消费树兄弟目录），`/mnt/d/ctx/heren/loop-kit` 只作当前环境示例；并明示 guard 缺包 fail-closed 会连带拦住修复用的工具调用，恢复动作（clone 包或设 `LOOP_KIT_PKG`）须在 hook 触发范围之外人工完成。route:human #2 披露此代价。
