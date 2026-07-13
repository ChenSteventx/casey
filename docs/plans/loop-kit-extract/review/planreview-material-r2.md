# loop-kit-extract round-2 方案评审备料

> 本文件是喂给本轮异构冗余评审（Dissimilar Redundancy，规划方=Claude，评审方=`codex`，评审家族≠规划家族）的输入。按护栏 #9：评审料只含 spec/plan 与处置证据，不含任何凭据、不含规划者的内心推理过程。以下依次是评审指令、round-1 处置全文、Steven 四裁定记录、本轮修订 diff 要点。

## 评审指令（round-2）

本轮是 `kernel` 级设计评审的第二轮（round-2）——round-1 的 9 条发现（3 `HIGH` / 5 `MED` / 1 `LOW`）已逐条处置并修入 `GRILL.md`/`plan.md`（8 条采信、1 条部分采信，见下方处置全文）。本轮**只审两件事**，不重审 round-1 已成立的结论、不重开已定案的方向性决策：

(a) **处置是否真把 round-1 的洞堵死**——尤其复核三项 `HIGH`：
   - H1 `hook-loop-guard` fail-closed 覆盖面：修订后的全故障域矩阵（D5）是否真覆盖了 spawnSync 启动失败/目标缺失损坏/依赖缺失/语法错误/信号终止/`status === null`/意外退出码等全部态，还是堵了一半、留了新缝隙；
   - H2 `kit-lock` 信任根：`kit-lock.json` + `boot.mjs` 共享引导层构造的信任根，是否真解除了「负责校验的 `gate` 自己来自未验证包」的循环信任，校验时序（先于任何包代码执行）与信任根边界（Casey git 树内 `shim`+`boot`+`kit-lock`）是否严实；
   - H3 完整观测基线：切换前观测基线（完整 exit code / 规范化 stdout・stderr 全文 / 文件系统差量）+ C7 根语义组 + C5 逐字模板比对，是否真能证明行为等价、不再有「假绿」空间。

(b) **修订新增机制本身是否引入新问题**——重点检查以下新增/加严机制是否引入新的 fail-open、循环信任、不可实现或不可证伪的金牌断言：
   - `kit-lock.json` 每次转发前全清单 sha256 校验（性能/正确性/绕过路径）；
   - `boot.mjs` 共享引导层（单点校验逻辑本身的正确性、失败模式）；
   - C7 根语义组（`resolveRoot()` 语义用例是否完备、是否可判定）；
   - 切换前冻结基线（`baseline/` 目录）的录制协议与比对协议是否可实现、是否可能产生不稳定/不可复现的比对；
   - M2 env 注入与恢复协议（`spawnSync` env 选项注入子进程 + 库模式 `finally` 恢复 + 探针核对）是否真正做到「宿主进程环境零改写」「同进程跨树绝不静默采用他树 ROOT」，有无遗漏的异常路径（如 import 抛错时 `finally` 是否仍执行、探针本身的失败态）。

**已定案、不重开**：薄 `shim` 转发层方向（D3 选①）、D8 取甲（不加 npm 本地路径依赖）、D2 取 fresh `git init`、D5 加严本身（fail-closed 归一 exit 2 这个方向）——这些已由 Steven 2026-07-13 裁定，round-2 不复议方向本身，只审其**技术实现是否可靠**（如 D5 落地的故障域矩阵是否有遗漏态，可以审；「要不要加严」这个方向性问题，不可再审）。

请按 `HIGH`/`MED`/`LOW` 分级列出发现（findings）；若确无发现，给出 `PASS`。

## round-1 处置全文（`review/planreview-disposition.md`）

```markdown
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
```

## Steven 2026-07-13 四裁定记录

本轮设计评审前，Steven 于主会话 `AskUserQuestion` 点选、已落盘（`git log` commit `7574055`）：

1. **总签字（route:human #1）**：设计整体签字成立，实现开工条件 = 本轮 round-2 codex 设计审收口——round-2 通过（`PASS` 或 findings 清零）后即视为完成 kernel 级人签，不必再回 Steven 二次签字；round-2 若仍有 `HIGH`，开工闸不放行。
2. **D8 依赖声明（route:human #4）**：取甲——casey `package.json` 不加 `"loop-kit": "file:../loop-kit"` 本地路径依赖，本契约单出口只走兄弟目录约定；乙案（npm 本地路径依赖作为真实受测解析分支）标弃、不入本契约实现范围。
3. **D5 降级加严（route:human #2）**：加严接受——`hook-loop-guard` 的 `shim` 对合法态 0/2 之外的一切引导失败与子进程异常态一律归一 exit 2 拦；代价条款照录：新 clone 忘配包会被拦到配好为止、在飞旧分支树在包升级后未同步 `kit-lock` 会被锁拦、修复动作须在 hook 触发范围之外人工完成。
4. **D2 包仓历史（route:human #3）**：取 fresh `git init`——包仓不携两仓历史，出处以 SHA 记入包 `README.md`。

route:human #5（C0 跨仓棘轮形态）与 #6（运行时包身份锁的每调用校验成本与拦截行为）不在本轮裁定范围，仍待续裁；round-2 评审若涉及这两点的技术可靠性仍可审，但其「是否接受」的方向性问题不在本轮范围内。

## 本轮修订 diff 要点（`git diff 4ff8748..HEAD -- docs/plans/loop-kit-extract/plan.md docs/plans/loop-kit-extract/proposed/GRILL.md`）

以下 diff 覆盖 round-1 后的全部修订，含四裁定标记：

```diff
diff --git a/docs/plans/loop-kit-extract/plan.md b/docs/plans/loop-kit-extract/plan.md
index 62cbf39..b98b767 100644
--- a/docs/plans/loop-kit-extract/plan.md
+++ b/docs/plans/loop-kit-extract/plan.md
@@ -2,3 +2,5 @@
 
-> baton 已立于本 worktree（lane full）。决策全集见 `docs/plans/loop-kit-extract/proposed/GRILL.md`（D1–D10）；本文是计划骨架 + 验收点。实现开工前置：Steven 对本设计的 kernel 级人签（未签不动任何实现字节）。
+> 设计评审修订（codex-sol@max，2026-07-13）：异构冗余设计评审 9 条发现（3 `HIGH` / 5 `MED` / 1 `LOW`，`docs/plans/loop-kit-extract/review/planreview-codex.md`）已逐条裁定——8 条采信修入本文与 GRILL.md，1 条（M5）部分采信；逐条处置与反证见 `docs/plans/loop-kit-extract/review/planreview-disposition.md`。
+> baton 已立于本 worktree（lane full）。决策全集见 `docs/plans/loop-kit-extract/proposed/GRILL.md`（D1–D10）；本文是计划骨架 + 验收点。实现开工前置：Steven 对本设计的 kernel 级人签（未签不动任何实现字节）。route:human #1 已裁定（Steven 2026-07-13）：**有条件签署**，条件 = 本轮 round-2 codex 设计审收口——round-2 未收口前仍不动任何实现字节。
+> Steven 2026-07-13 四裁定汇总（各处标记见 GRILL.md 与本文 §4）：① route:human #1 有条件签署（条件=round-2）；② route:human #4（D8）取甲；③ route:human #2（D5）加严接受；④ route:human #3（D2）取 fresh `git init`。route:human #5/#6 不在本轮裁定范围。
 > 决策依据：ADR-0008（路线①立即提取，已定不翻）、`docs/plans/loop-dual-profile-reform/PROPOSAL.md` §12.1/§13/§14、Casey ADR-0001（分界线与数据契约锚定原则继续有效）、autotester ADR-0001（分发形态：独立仓 + npm 本地路径依赖 + 个人 skill 编排层）。
@@ -18,2 +20,3 @@
 - `testChecksums` 勘定：全仓 68 个 prd 无一冻结 `loop-kit/bin` 文件（脚本核验 0 命中）——原地替换为 `shim` 不触任何既有棘轮；`gate` 以 `cwd=ROOT` 执行 acceptance，树内相对路径命令语义不变。
+- 涟漪反查扩面（评审 M4 采信，2026-07-13 本树实测）：对本契约**全部待改路径**——`CLAUDE.md`/`CONTEXT.md`/`docs/HANDOFF.md`/`docs/NEXT-SESSION.md`/`package.json`/`package-lock.json`——反查 68 个 prd 的 `testChecksums` 与 acceptance 命令：`testChecksums` 0 命中；文本提及（`prd-distribution`/`prd-plan-debt-sweep`/`prd-casey-demo` 等 8 份）均为 dimension 散文、不构成冻结面。两个运行时耦合点记档：① `CONTEXT.md` 被 `prd-p2-intent-compile` 的 `term-lint --registry` acceptance 活读——登记新词是运行时门禁面（写坏即红），不是重签面；② `tests/_golden/term-guard.golden.mjs` 第 122 行 `parseRegistry()` 活读 `CONTEXT.md` 的弃用别名名单——新增词条不删既有条目、C6 复跑兜底。**重签清单仍为空**，且此结论现在有全路径反查证据、不再只覆盖 `loop-kit/bin` 字面路径。
 - CLI 主模式判据：`contract`/`term-lint`/`ratchet` 以 `argv[1]` 对齐自身路径判 CLI——`shim` 主模式必须 spawn 包内脚本，不能纯 re-export（GRILL 背景，金牌 C2 钉转发证明）。
@@ -26,3 +29,3 @@ A. 包仓侧（`/mnt/d/ctx/heren/loop-kit`，新独立 git 仓，fresh init）
 1. `bin/` 十脚本迁入，字节保真：唯一允许差异 = ROOT 锚定行换 `resolveRoot()`（涉及 `breaker`/`contract`/`gate`/`hook-loop-guard`/`hook-posttool`/`term-lint`/`ratchet` 七件）；`hook-stop`/`hook-loop-triage`/`review-deepseek` 逐字节照搬。`contract.mjs` 以 Casey 版为准（含 `worktree` baton 全套）；`ratchet.mjs` Casey 独有件入包。CLI 尾块（`isMain` 判据）零改动。
-2. `lib/root.mjs`（新，全案唯一新逻辑）：`resolveRoot()` 单点——`LOOP_KIT_ROOT` 环境变量（目录存在校验）→ 自 `process.cwd()` 上溯找 `loop/config.json` → stderr 补救 + exit 64。
+2. `lib/root.mjs`（新，包内唯一新逻辑，契约按评审 M2/M3 收严）：`resolveRoot()` 单点——`LOOP_KIT_ROOT` 在场则必须有效（目录存在 + 含 `loop/config.json` 根标记 + `realpath` 规范化），无效**立即失败**、绝不静默回退；变量缺席才自 `process.cwd()` 上溯找根标记（同样校验 + 规范化）；两路皆空抛**结构化错误**——库函数绝不 `process.exit` 终止宿主进程，exit 64 + stderr 补救提示由 Casey 侧引导层在受支持入口给出（受支持入口总先注入有效 ROOT，包内解析失败在受支持路径不可达）。另导出**进程级已解析根探针**（只读查询口），供消费侧核对 ESM 缓存中包模块实际锚定的树。
 3. `package.json`（name `loop-kit`、private、`type: module`、engines node>=22.12、零依赖）+ `README.md`（出处 SHA、双消费者、ADR-0008 与 autotester ADR-0001 指针、兄弟目录布局约定）。
@@ -31,8 +34,9 @@ B. Casey 侧（单提交切换点，GRILL D9）
 
-4. `loop-kit/bin/*.mjs` 十件原地换同名 `shim`（GRILL D4 协议：包定位 `LOOP_KIT_PKG` → 兄弟约定；ROOT 无条件注入自锚；主模式 spawn 退出码透传；库模式显式名单 re-export，`contract` 18 名 / `term-lint` 3 名 / `ratchet` 4 名；GRILL D5 降级矩阵）。
-5. `tests/fixtures/loop-kit-expected/`：期望包内容存档（对提取前 HEAD 十脚本机械替换 ROOT 行 + `lib/root.mjs` 期望件；人审 diff 后随 prd 冻结；惰性数据绝不执行）。
-6. `tests/_golden/loop-kit-extract.golden.mjs`：C0–C6（见 §3）。
-7. `loop/prd-loop-kit-extract.json`：冻结金牌 + 期望存档 checksum；stories 见 §3。
-8. `CLAUDE.md` 新增 bootstrap 一段（包为兄弟目录独立包、新机器先 clone；常用命令不变）+ `CONTEXT.md`（`loop-kit` 词条白话解释更新、`shim` 词条登记，§6）。
-9. `docs/HANDOFF.md`、`docs/NEXT-SESSION.md` 刷新（文档先于 dev 提交）。
+4. `loop-kit/bin/*.mjs` 十件原地换同名 `shim` + 新增共享引导助手 `loop-kit/lib/boot.mjs`（Casey 侧新文件：包定位、身份锁校验、env 注入、转发与降级逻辑**单点化**，十个 `shim` 只调它，防十份复制各自漂）。协议按 GRILL D4/D5（评审 H1/H2/M2 采信后版本）：包定位 `LOOP_KIT_PKG`（显式逃生口，跳过身份锁）→ 兄弟约定（隐式路径，**每次转发前**对 `kit-lock.json` 全清单 sha256 校验，失配视同包缺失按 D5 逐入口降级）；CLI 主模式 `spawnSync` 转发、`LOOP_KIT_ROOT` 经 `spawnSync` 的 env 选项注入子进程，**绝不改写宿主进程环境**；库模式设 env → 动态 import → `finally` 恢复，import 后以 `lib/root.mjs` 探针核对包模块实际 ROOT、失配抛结构化错误（同进程跨树绝不静默采用他树 ROOT）；库模式显式名单 re-export（`contract` 18 名 / `term-lint` 3 名 / `ratchet` 4 名）；退出码按 D5 全故障域矩阵归一。
+5. `loop-kit/kit-lock.json`（**包身份锁**，git 跟踪，评审 H2 采信新增）：记包每文件 sha256 + 包仓 commit。信任根 = Casey git 树内的 `shim` + `boot` + `kit-lock`（全部被本 prd 冻结面钉住），校验发生在转发层、先于任何包代码执行——`gate` 自证的循环信任由此解除。包任何改动必先更新期望存档 + `kit-lock` + 重签本 prd（跨仓棘轮一并覆盖，route:human #5）。
+6. `tests/fixtures/loop-kit-expected/`：期望包内容存档（对提取前 HEAD 十脚本机械替换 ROOT 行 + `lib/root.mjs` 期望件；人审 diff 后随 prd 冻结；惰性数据绝不执行）+ `baseline/` **切换前观测基线**（评审 H3 采信新增：于提取前 HEAD 录制命令矩阵与四 hook 正常路径的完整 exit code、规范化 stdout/stderr 全文、文件系统差量；C2 的比对锚）。
+7. `tests/_golden/loop-kit-extract.golden.mjs`：C0–C7（见 §3）。
+8. `loop/prd-loop-kit-extract.json`：冻结金牌 + 期望存档/`kit-lock`/基线 checksum；stories 见 §3。
+9. `CLAUDE.md` 新增 bootstrap 一段（评审 L1 采信：先写拓扑关系——包是消费树的**兄弟目录**独立包，任何机器任何 OS 同构；`/mnt/d/ctx/heren/loop-kit` 只作当前环境示例；并注明 `hook-loop-guard` 缺包 fail-closed 会连带拦住修复用的工具调用，恢复动作——clone 包或设 `LOOP_KIT_PKG`——须在 hook 触发范围之外人工完成）+ `CONTEXT.md`（`loop-kit` 词条白话解释更新、`shim`/`kit-lock` 词条登记，§6）。
+10. `docs/HANDOFF.md`、`docs/NEXT-SESSION.md` 刷新（文档先于 dev 提交）。
 
@@ -41,5 +45,5 @@ B. Casey 侧（单提交切换点，GRILL D9）
 0. 前置：Steven kernel 级设计人签（对 GRILL + 本 plan 整体）。未签不进下一步。
-1. accept 阶段（本树）：生成期望存档（§1.5）+ 写金牌（§1.6）→ 跑**红基线**（C0 红=包不存在；C2 转发证明红=全量引擎无视 `LOOP_KIT_PKG`；C4 红=无降级协议；C5 红=现文件非 `shim`；C6 照绿=非回归钉）→ 建 `loop/prd-loop-kit-extract.json` 冻结 → `contract advance accept --red-verified`。
-2. 落包仓（§1.1–1.3）：casey 树零改动，旧 in-repo 拷贝仍唯一生效源；包首提交后 C0/C1 转绿。
-3. Casey 侧单提交切换（§1.4–1.9 同一提交）：C2–C5 转绿。
+1. accept 阶段（本树）：于提取前 HEAD 录制**切换前观测基线** + 生成期望存档与 `kit-lock.json`（§1.5–1.6）+ 写金牌（§1.7）→ 跑**红基线**（C0 红=包不存在；C2 转发证明红=全量引擎无视 `LOOP_KIT_PKG`；C4 红=无降级协议；C5 红=现文件非 `shim`；C7 红=包不存在、无 `resolveRoot()` 可测；C6 照绿=非回归钉）→ 建 `loop/prd-loop-kit-extract.json` 冻结 → `contract advance accept --red-verified`。
+2. 落包仓（§1.1–1.3）：casey 树零改动，旧 in-repo 拷贝仍唯一生效源；包首提交后 C0/C1/C7 转绿。
+3. Casey 侧单提交切换（§1.4–1.10 同一提交）：C2–C5 转绿。
 4. 全仓复验：`node loop-kit/bin/gate.mjs --prd loop/prd-loop-kit-extract.json` 全绿；三份存量金牌所属 prd 的 gate 复跑 GREEN；`node loop-kit/bin/ratchet.mjs index` 复验；`node bin/casey.mjs selftest --tier1` 无回归。
@@ -51,16 +55,17 @@ story 划分与红/绿判据：
 
-- S1 包保真（C0+C1）：**红** = 包不存在；**绿** = 包内 `bin/*.mjs` + `lib/root.mjs` 对期望存档逐文件 sha256 相等，且经 `shim` import 的 `contract`/`term-lint`/`ratchet` 导出名集合对提取前快照（18/3/4 名）deepEq。C0 兼作跨仓棘轮：日后任何包改动必先改期望存档 + 重签本 prd。
-- S2 切换等价（C2+C5）：**红** = 提取前全量引擎无视 `LOOP_KIT_PKG`（转发证明不成立）、文件非 `shim` 模板形状；**绿** = 标记包证明真转发 + `gate --dry`/`contract init·advance·check·show·list`/`breaker --reset·--round`/`term-lint --registry·--file·--stdin`/`ratchet index` 逐命令 exit code 与关键输出对钉死期望相等 + 十件匹配 `shim` 模板（行数上限、必含转发标志、不含引擎特征串）。
-- S3 新树与降级（C3+C4）：**红** = 提取前无降级协议（模拟包缺失时不出 D5 矩阵行为）；**绿** = 临时 git `worktree`（无 `node_modules`）内 `hook-loop-guard` 互锁与 `gate`/`contract` 行为与主树等价、跨树派生时 ROOT 以被执行 `shim` 位置自锚（树 B baton 落树 B）+ 包缺失矩阵逐格命中（CLI exit 64 补救提示 / `hook-loop-guard` exit 2 / lint 三 hook exit 0+WARN）。
-- S4 存量零重签（C6，非回归钉）：`worktree-baton`/`term-guard`/`ratchet-reverse-index` 三金牌与其 prd **零字节改动**、经 `shim` 复跑照绿；全仓 gate 复验 GREEN。红基线豁免：本 story 守「既有绿不许变红」，无「先红」语义，豁免理由随 prd 记档。
+- S1 包保真与根语义（C0+C1+C7）：**红** = 包不存在；**绿** = C0 包内 `bin/*.mjs` + `lib/root.mjs` 对期望存档逐文件 sha256 相等，且期望存档、`kit-lock.json`、真包**三方一致**（评审 H2）；C1 经 `shim` import 的 `contract`/`term-lint`/`ratchet` 导出名集合对提取前快照（18/3/4 名）deepEq **且逐名 `typeof` 相等**（行为面由 C2 完整基线 + C6 存量金牌复跑承担，评审 H3）；C7 `resolveRoot()` 语义组（评审 M3）：env 有效命中 / env 无效**立即失败不回退** / 上溯命中根标记 / 上溯无标记抛结构化错误（不终止宿主进程）/ `realpath` 规范化 / 探针回报实际锚定树。C0 兼作跨仓棘轮：日后任何包改动必先改期望存档 + `kit-lock` + 重签本 prd。
+- S2 切换等价（C2+C5）：**红** = 提取前全量引擎无视 `LOOP_KIT_PKG`（转发证明不成立）、文件非 `shim` 模板形状；**绿** = 标记包证明真转发 + `gate --dry`/`contract init·advance·check·show·list`/`breaker --reset·--round`/`term-lint --registry·--file·--stdin`/`ratchet index` 及四 hook 正常路径（合成 stdin JSON）逐条对**切换前冻结的观测基线**比对：exit code + 规范化 stdout/stderr **全文** + 文件系统差量（`loop/` 运行态产物字节），废除「关键输出」启发式（评审 H3）；C5 十件 `shim` 由**单一模板 + 每件参数**展开生成，金牌对展开结果**逐字比对**，废除行数上限/特征串启发式（评审 H3）。
+- S3 布局、降级与跨树（C3+C4）：**红** = 提取前无降级协议（模拟包缺失时不出 D5 矩阵行为）；**绿** = C3 三布局场景（评审 M1）：① 同层默认布局（临时 git `worktree`、无 `node_modules`）内 `hook-loop-guard` 互锁与 `gate`/`contract` 行为与主树等价；② 异地树 + 显式 `LOOP_KIT_PKG` 可跑；③ 异地树无覆盖 → 按 D5 安全失败。跨树两态（评审 M2）：CLI 派生时 ROOT 以被执行 `shim` 位置自锚（树 B baton 落树 B）；同进程先 import 树 A `shim` 再 import 树 B `shim` → 结构化错误（绝不静默采用树 A 的 ROOT）。C4 从空目录单场景扩为**故障族矩阵**（评审 H1）：缺包目录 / 身份锁失配（伪造漂移包）/ 缺目标脚本 / 语法损坏脚本 / 信号终止 / `spawnSync` 报 error / 意外退出码，逐入口断言 D5 归一（CLI 64 或同信号自终 / `hook-loop-guard` 一律 2 / lint 三 hook 一律 WARN+0）；本环境（DrvFs）不可确定性复现的权限类，以引导层单元桩钉协议并记档豁免。
+- S4 存量零重签（C6，非回归钉）：`worktree-baton`/`term-guard`/`ratchet-reverse-index` 三金牌与其 prd **零字节改动**、经 `shim` 复跑照绿；金牌内写死三金牌与其 prd 的**切换前 git blob SHA**，断言当前字节等于该锚——「零字节改动」有独立基线可证、不只「跑绿」（评审 H3）；全仓 gate 复验 GREEN。红基线豁免：本 story 守「既有绿不许变红」，无「先红」语义，豁免理由随 prd 记档。
 
-验收命令在 acceptance 冻结时定稿，形如：`node tests/_golden/loop-kit-extract.golden.mjs`（内分 C0–C6 checks）；`node loop-kit/bin/gate.mjs --prd loop/prd-loop-kit-extract.json`。
+验收命令在 acceptance 冻结时定稿，形如：`node tests/_golden/loop-kit-extract.golden.mjs`（内分 C0–C7 checks）；`node loop-kit/bin/gate.mjs --prd loop/prd-loop-kit-extract.json`。
 
-## 4. route:human（须 Steven 拍板）
+## 4. route:human（须 Steven 拍板；1–4 已由 Steven 2026-07-13 裁定，5–6 待续裁）
 
-1. **实现开工闸**：对 GRILL D1–D10 + 本 plan 的 kernel 级设计人签（双设计审后）。
-2. **D5 降级加严**：`hook-loop-guard` 在包缺失时 fail-closed（exit 2 拦）——对既有「hook 自身故障不阻塞」约定的定向加严；代价是忘配包的新 clone 会被拦到配好为止。
-3. **D2 包仓历史**：fresh `git init` 不携两仓历史，出处以 SHA 记包 `README.md`。
-4. **D8 依赖声明**：casey `package.json` 是否加 `"loop-kit": "file:../loop-kit"`（兑现 ADR 预定形态 vs 实际解析走兄弟约定、声明近乎装饰）。
-5. **C0 跨仓棘轮形态**：包字节 pin 进 Casey 期望存档 = 未来每刀包改动（含 autotester 侧发起）都触 Casey 重签——ADR-0008 已认「兼容金牌负担前置」，此处确认其机制形态。
+1. **实现开工闸**——Steven 2026-07-13 裁定：**有条件签署**，条件 = 本轮 round-2 codex 设计审收口。对 GRILL D1–D10 + 本 plan 的 kernel 级设计人签在 round-2 收口后即完成；round-2 未收口前不进 accept、不动任何实现字节。
+2. **D5 降级加严（评审 H1 采信后扩围）**——Steven 2026-07-13 裁定：**加严接受**，代价条款照录：`hook-loop-guard` 的 `shim` 对合法态 0/2 之外的**一切**引导失败与子进程异常态——包缺失、身份锁失配、目标脚本缺失/不可读、解析期崩溃（exit 1）、Node 不兼容、信号终止、`spawnSync` 报 error——一律归一 exit 2 拦。这是对既有「hook 自身故障不阻塞」约定的定向加严；代价一：忘配包的新 clone 被拦到配好为止；代价二：guard fail-closed 会连带拦住修复用的工具调用，恢复须在 hook 触发范围之外人工完成（`CLAUDE.md` bootstrap 段明示）。
+3. **D2 包仓历史**——Steven 2026-07-13 裁定：**取 fresh git init**，不携两仓历史，出处以 SHA 记包 `README.md`。
+4. **D8 依赖声明（评审 M5 采信后收紧为二选一，装饰性声明不可接受）**——Steven 2026-07-13 裁定：**取甲**——本契约单出口、只走兄弟约定，`package.json` 不加 `"loop-kit": "file:../loop-kit"`（ADR-0008 决策 1 原文「最终以提取契约 GRILL 定案为准」，本裁定即完成该定案、无需回改 ADR）；乙案（加声明并使其成为真实受测解析分支、纳入 `package-lock.json` 涟漪复审）标弃，不入本契约实现范围。
+5. **C0 跨仓棘轮形态**：包字节 pin 进 Casey 期望存档 + `kit-lock.json` = 未来每刀包改动（含 autotester 侧发起）都触 Casey 存档与 `kit-lock` 更新 + prd 重签——ADR-0008 已认「兼容金牌负担前置」，此处确认其机制形态。连带后果（D9）：包升级后，未同步 `kit-lock` 的在飞旧分支树会被身份锁按 D5 降级拦下，补救 = 合并 dev 或显式 `LOOP_KIT_PKG`。
+6. **运行时包身份锁（评审 H2 采信新增机制）**：隐式兄弟解析在每次转发前对 `kit-lock.json` 全清单 sha256 校验（毫秒级、每次 hook/CLI 调用都发生），失配视同包缺失逐入口降级；显式 `LOOP_KIT_PKG` 为操作者逃生口、跳过身份锁。确认接受这层每调用校验成本与拦截行为。
 
@@ -76,3 +81,5 @@ story 划分与红/绿判据：
 
-- `shim`（垫片）：只做包定位、ROOT 注入与命令/导出转发的薄层，零业务逻辑；提取后 in-repo `loop-kit/bin/*.mjs` 的形态；其模板形状由兼容金牌钉死，防转发层长出第三变体。
-- `loop-kit` 既有词条白话解释更新：「孵化于 autotester `loop-kit/` 目录」→「已提取为独立包（ADR-0008），Casey 与 autotester 双消费者；分发 = 兄弟目录直解析 + npm 本地路径依赖」。
+- `shim`（垫片）：只做包定位、ROOT 注入与命令/导出转发的薄层，零业务逻辑（校验与降级逻辑单点收在 `loop-kit/lib/boot.mjs` 引导助手，`shim` 只调它）；提取后 in-repo `loop-kit/bin/*.mjs` 的形态；由单一模板展开生成、金牌逐字比对钉死，防转发层长出第三变体。
+- `kit-lock`（**包身份锁**）：Casey 侧 git 跟踪的包内容清单（逐文件 sha256 + 包仓 commit），隐式解析每次转发前校验，失配按降级矩阵处置；Casey→包方向的版本锁，与包 `README.md` 记出处 SHA 的反向出处相区分。
+- **观测基线**：切换前于旧引擎录制的规范化行为存档（完整 exit code / stdout / stderr / 文件系统差量），行为等价断言的比对锚——既有学科词（golden master 范式），登记取其本仓专义。
+- `loop-kit` 既有词条白话解释更新：「孵化于 autotester `loop-kit/` 目录」→「已提取为独立包（ADR-0008），Casey 与 autotester 双消费者；分发 = 兄弟目录直解析（正式前置条件：包与消费树同层）；npm 本地路径依赖出口按 route:human #4 已裁定取甲、本契约不采用」。
diff --git a/docs/plans/loop-kit-extract/proposed/GRILL.md b/docs/plans/loop-kit-extract/proposed/GRILL.md
index e230876..379c40c 100644
--- a/docs/plans/loop-kit-extract/proposed/GRILL.md
+++ b/docs/plans/loop-kit-extract/proposed/GRILL.md
@@ -2,3 +2,5 @@
 
+> 设计评审修订（codex-sol@max，2026-07-13）：D2/D4/D5/D7/D8/D9 已按异构冗余设计评审 9 条发现修订（8 条采信、1 条部分采信），逐条处置见 `../review/planreview-disposition.md`。
 > baton 已立于本 worktree（lane full，理由见台账）；本文与 `plan.md` 是 grill/plan 两阶段交付物。授权凭据：Steven 2026-07-13 主会话点选路线① + ADR-0008 已接受。实现开工另被 kernel 级设计人签门阻断——本轮只规划，不动任何实现字节。
+> Steven 2026-07-13 四裁定（本轮 AskUserQuestion 点选落盘，逐处标记）：① route:human #1 总签字 = **有条件签署**，条件 = 本轮 round-2 codex 设计审收口；② route:human #4（D8）取甲，不加 npm 本地路径依赖声明；③ route:human #2（D5）**加严接受**，代价条款照录；④ route:human #3（D2）取 fresh `git init`。route:human #5/#6 不在本轮裁定范围、仍待续裁。
 > 事实源：`docs/adr/0008-loop-kit-extraction.md`（路线①已定，本文不翻案）、`docs/plans/loop-dual-profile-reform/PROPOSAL.md` §12.1/§13/§14、Casey `docs/adr/0001-reuse-loop-kit.md`、autotester `docs/adr/0001-loop-kit-incubation.md`（预定分发形态）、`loop-kit/bin/` 十脚本头注、`.claude/settings.json`、全仓 grep 勘定（清单见 `plan.md` §0）。
@@ -16,3 +18,3 @@
 - full 车道 + kernel 级加严约定（ADR-0008 决策 4，`resolution` 契约先例）：双设计审 + 异构冗余实现审 + 全仓门禁 + Steven 人签；`kernel` 车道机制建成前以 full 承载。
-- 本 baton 以此立（laneReason 记档）。grill/plan 由本轮交付；accept 起的每一步以 Steven 对本设计的人签为前置（route:human #1）。
+- 本 baton 以此立（laneReason 记档）。grill/plan 由本轮交付；accept 起的每一步以 Steven 对本设计的人签为前置——route:human #1 已裁定（Steven 2026-07-13）：**有条件签署**，条件 = 本轮 round-2 codex 设计审收口；round-2 未收口前不得进 accept。
 
@@ -21,5 +23,6 @@
 - 落点：`/mnt/d/ctx/heren/loop-kit`，独立 git 仓（ADR-0008 默认落点 + autotester ADR-0001 预定形态）。它与 casey 主仓、各并行 `worktree` 天然同层——`contract worktree` 的默认落点就是兄弟目录 `../<仓名>-<slug>`（`contract.mjs` 实证），这是 D4 兄弟目录解析成立的结构前提。
-- 新仓 fresh `git init`、不搬两仓历史；出处以 SHA 记入包 `README.md`（提取自 casey@切换点 SHA；8 份与 autotester 字节一致件的对齐基线一并记档）。（route:human #3）
+- **同层是正式前置条件，不是普遍保证**（评审 M1 采信）：「新树零安装可跑」只对主仓与 `contract worktree` 默认落点成立；任意路径 `git worktree add`、IDE 建树、异地 clone 不在保证内——异地树必须显式设 `LOOP_KIT_PKG`，两无则按 D5 安全失败。三种布局各有金牌用例（C3）。文档表述一律拓扑优先（包 = 消费树兄弟目录），绝对路径只作当前环境示例（评审 L1 采信）。
+- 新仓 fresh `git init`、不搬两仓历史；出处以 SHA 记入包 `README.md`（提取自 casey@切换点 SHA；8 份与 autotester 字节一致件的对齐基线一并记档）。route:human #3 已裁定（Steven 2026-07-13）：**取 fresh git init**，包仓不携两仓历史。
 - 包 `package.json`：name `loop-kit`、`private: true`、`type: module`、engines node>=22.12、零第三方依赖（内核「零依赖、纯 node」纪律不变）。
-- 分发双出口（autotester ADR-0001 决策 3）：npm 本地路径依赖（`file:../loop-kit`，声明层，route:human #4）+ 兄弟目录直解析（实际生效层，见 D4——新 `worktree` 无 `node_modules` 也零安装可跑）。「个人 skill 编排层」这第二出口不在本契约（D10）。
+- 分发双出口（autotester ADR-0001 决策 3）：npm 本地路径依赖（`file:../loop-kit`，声明层，route:human #4，裁定见 D8——本契约取单出口、不加此依赖声明）+ 兄弟目录直解析（实际生效层，见 D4——新 `worktree` 无 `node_modules` 也零安装可跑，本契约唯一生效出口）。「个人 skill 编排层」这第二出口不在本契约（D10）。
 - 凭据仍走 `~/.loop-kit/`（仓外），一字不动。
@@ -38,19 +41,23 @@
 
-- 包内新增 `lib/root.mjs`，单点 `resolveRoot()`：`LOOP_KIT_ROOT` 环境变量（含目录存在校验）→ 自 `process.cwd()` 逐级上溯找 `loop/config.json` 标记 → 都无则 stderr 补救提示 + exit 64（对齐 `gate` 既有「用法/契约缺失」退出码语义）。含 ROOT 锚定的七件（`breaker`/`contract`/`gate`/`hook-loop-guard`/`hook-posttool`/`term-lint`/`ratchet`）换用它；`hook-stop`/`hook-loop-triage`/`review-deepseek` 无 ROOT 锚定、逐字节照搬。
-- `shim`（每件十余行、零业务逻辑，模板形状被金牌 C5 钉死）：
-  - 包定位：`LOOP_KIT_PKG` 环境变量（测试与非常规布局的显式逃生口）→ 静态兄弟约定 `new URL('../../../loop-kit', import.meta.url)`。因各 `worktree` 与包同层，任何新树零安装即解析成功。
-  - ROOT 注入：以 `shim` 自身位置**无条件覆盖**写 `LOOP_KIT_ROOT`（= `shim` 的 `../..`）——语义与今日位置锚定逐字等价、每树自锚。无条件覆盖是防跨树污染：树 A 的进程派生跑树 B 的 `shim` 时，绝不许树 B 继承树 A 的 ROOT（金牌 C3 钉死）。
-  - CLI 主模式（`argv[1]` 是 `shim` 自身）：`spawnSync(node, [包内同名脚本, ...argv], stdio 继承)`，退出码透传、stdin/stdout/stderr 原样流经（hook 的 stdin JSON 协议不受影响）。
-  - 库模式（被 import）：动态 import 包内模块 + 显式名单 re-export——`contract` 18 名、`term-lint` 3 名（`parseRegistry`/`scanText`/`lintFiles`）、`ratchet` 4 名；名单被金牌 C1 对提取前快照 deepEq 钉死，漂一个名即红。其余七件无库消费者，`shim` 只做 CLI 主模式。
+- 包内新增 `lib/root.mjs`，单点 `resolveRoot()`（契约按评审 M2/M3 收严）：`LOOP_KIT_ROOT` 在场则必须有效——目录存在 + 含 `loop/config.json` 根标记 + `realpath` 规范化，无效**立即失败**、绝不静默回退；变量缺席才自 `process.cwd()` 逐级上溯找根标记（同样校验 + 规范化）；两路皆空抛**结构化错误**——库函数绝不 `process.exit` 终止宿主进程，exit 64 + stderr 补救提示（对齐 `gate` 既有「用法/契约缺失」退出码语义）由 Casey 侧引导层在受支持入口给出，且受支持入口总先注入有效 ROOT、包内解析失败在受支持路径不可达。另导出**进程级已解析根探针**（只读查询口），供消费侧核对 ESM 缓存中包模块实际锚定的树。含 ROOT 锚定的七件（`breaker`/`contract`/`gate`/`hook-loop-guard`/`hook-posttool`/`term-lint`/`ratchet`）换用它；`hook-stop`/`hook-loop-triage`/`review-deepseek` 无 ROOT 锚定、逐字节照搬。
+- Casey 侧新增共享引导助手 `loop-kit/lib/boot.mjs`（评审 H2/M2 采信）：包定位、**包身份锁**校验、env 注入、转发与降级逻辑单点收此一处，十个 `shim` 只调它——校验逻辑绝不复制十份（防引导层自身长出会漂的变体）。
+- `shim`（每件薄转发、零业务逻辑，由单一模板 + 每件参数展开生成，金牌 C5 逐字比对钉死）：
+  - 包定位：`LOOP_KIT_PKG` 环境变量（测试与非常规布局的**显式逃生口**，操作者自担信任，跳过身份锁）→ 静态兄弟约定 `new URL('../../../loop-kit', import.meta.url)`（隐式路径，**每次转发前**对 `loop-kit/kit-lock.json` 全清单 sha256 校验，失配视同包缺失按 D5 逐入口降级）。因各 `worktree` 与包同层（正式前置条件，D2），符合布局的新树零安装即解析成功。
+  - 包身份锁（评审 H2 采信）：`kit-lock.json` 记包每文件 sha256 + 包仓 commit，git 跟踪、随本 prd 冻结。信任根 = Casey git 树内的 `shim` + `boot` + `kit-lock`，校验发生在转发层、先于任何包代码执行——兄弟仓切分支/带脏改动/落旧版本都在执行前被判死，「负责校验的 `gate` 自己来自未验证包」的循环信任解除。包 `README.md` 记出处 SHA 是反向出处，二者并存、职责不同。
+  - ROOT 注入：以 `shim` 自身位置为准（= `shim` 的 `../..`）——语义与今日位置锚定逐字等价、每树自锚。CLI 模式经 `spawnSync` 的 env 选项注入子进程（对子进程等效于无条件覆盖，防树 A 进程派生跑树 B `shim` 时继承树 A 的 ROOT），**宿主进程环境零改写**；库模式设 env → 动态 import → `finally` 恢复，绝不永久污染调用者 `process.env`（评审 M2 采信）。
+  - CLI 主模式（`argv[1]` 是 `shim` 自身）：`spawnSync(node, [包内同名脚本, ...argv], stdio 继承)`，stdin/stdout/stderr 原样流经（hook 的 stdin JSON 协议不受影响）；退出码按 D5 全故障域矩阵处置（合法码原码透传、引导失败归一）。
+  - 库模式（被 import）：动态 import 包内模块 + 显式名单 re-export——`contract` 18 名、`term-lint` 3 名（`parseRegistry`/`scanText`/`lintFiles`）、`ratchet` 4 名；名单被金牌 C1 对提取前快照 deepEq 钉死，漂一个名即红。**同进程跨树防线**（评审 M2 采信）：包模块 URL 全树相同、ESM 缓存首树 ROOT 常驻（七件的 ROOT 均模块级求值，实证见处置记录），故 import 后以 `lib/root.mjs` 探针核对包模块实际锚定树，失配抛结构化错误——fail-fast，绝不静默采用他树 ROOT；同进程跨树库复用不在支持面内，金牌 C3 钉此错误行为。其余七件无库消费者，`shim` 只做 CLI 主模式。
 - `LOOP_CONTRACT_FILE` 既有覆盖口、`loop/` 运行态（baton/熔断态 gitignored 每树一份）语义一律不动（护栏 #18 不触）。
 
-## D5 fail-safe 降级矩阵（包缺失时，逐格冻进金牌 C4）
+## D5 fail-safe 降级矩阵（全故障域，逐格冻进金牌 C4）
 
-| 入口 | 行为 | 理由 |
-|---|---|---|
-| CLI `shim`（`gate`/`contract`/`breaker`/`term-lint`/`ratchet`/`review-deepseek`） | exit 64 + stderr 补救提示（clone 包到兄弟目录，或设 `LOOP_KIT_PKG`） | 与门禁「默认 FAIL、凭证据翻绿」同族：引擎证不出在场就不给任何绿 |
-| `hook-loop-guard` `shim` | exit 2 拦 | 包缺失是可确定性判死的环境错误，不是意外异常：若沿用 fail-open，新 clone 忘配包 = 阶段互锁静默失守（护栏 #11 掉牙、冻结面裸奔）。这是对「hook 自身故障不阻塞」既有约定的一次**定向加严**（route:human #2） |
-| `hook-stop`/`hook-posttool`/`hook-loop-triage` `shim` | exit 0 + 一行 WARN | 沿用 ADR-0005 已文档化立场：lint 监督层永不阻塞正常工作（fail-open 仅限 lint/hook，护栏语义原文） |
+评审 H1 采信：故障面从「包路径缺失」单态扩为**完整引导失败域**——包目录缺失、身份锁失配、目标脚本缺失/不可读、传递依赖缺失、脚本语法损坏、Node 不兼容、`spawnSync` 报 error、子进程信号终止（`status === null`）、子进程意外退出码。实证：包脚本解析期损坏 exit 1 发生在其任何 `catch` 之前（今日 `hook-loop-guard` 的 fail-open 只护自身 `try` 块内），纯「退出码透传」即 fail-open。
 
-包内脚本自身的既有 fail-open/fail-closed 语义（各头注约定）一律不动；上表只约束 `shim` 在「包解析失败」这一新增故障面的行为。
+| 入口 | 合法态 | 全部引导失败与异常态 | 理由 |
+|---|---|---|---|
+| CLI `shim`（`gate`/`contract`/`breaker`/`term-lint`/`ratchet`/`review-deepseek`） | 子进程任何正常退出码**原码透传**（`gate` 的 RED、`term-lint` 的违例码等语义不折损） | 引导失败（缺包/锁失配/缺目标/`spawnSync` error）→ exit 64 + stderr 补救提示（clone 包到兄弟目录，或设 `LOOP_KIT_PKG`）；子进程信号终止 → 以同信号自终（保留 shell `128+n` 语义） | 与门禁「默认 FAIL、凭证据翻绿」同族：引擎证不出在场就不给任何绿；正常码透传保「逐命令等价」 |
+| `hook-loop-guard` `shim` | 0（放行）/ 2（拦）原样透传 | **其余一切**（含子进程 exit 1 崩溃、信号、`status === null`、`spawnSync` error、缺包、锁失配、缺目标、损坏脚本）一律归一 exit 2 拦 + stderr 说明 | 这些全是可确定性判死的环境错误，不是意外异常：若沿用 fail-open，新 clone 忘配包或包漂移 = 阶段互锁静默失守（护栏 #11 掉牙、冻结面裸奔）。对「hook 自身故障不阻塞」既有约定的**定向加严**（route:human #2，含扩围）；route:human #2 已裁定（Steven 2026-07-13）：**加严接受**——代价条款照录（新 clone 拦到配好为止、在飞旧树被锁拦、修复须在 hook 触发范围之外人工完成） |
+| `hook-stop`/`hook-posttool`/`hook-loop-triage` `shim` | 0 / 2 原样透传 | **其余一切**（同上各态）一律一行 WARN + exit 0 | 沿用 ADR-0005 已文档化立场：lint 监督层永不阻塞正常工作（fail-open 仅限 lint/hook，护栏语义原文） |
+
+包内脚本自身的既有 fail-open/fail-closed 语义（各头注约定）一律不动；上表只约束 Casey 侧 `shim`/`boot` 引导层在「包解析/校验/派生失败」这一新增故障面的行为。金牌 C4 按故障族逐入口断言（plan §3 S3）；本环境（DrvFs）不可确定性复现的权限类，以引导层单元桩钉协议并记档豁免。
 
@@ -65,11 +72,12 @@
 
-新金牌 `tests/_golden/loop-kit-extract.golden.mjs` + 期望存档 `tests/fixtures/loop-kit-expected/`。期望存档 = 预期包内容：对提取前 HEAD 十脚本做机械 ROOT 行替换后的存档，人审 diff 后随 prd 冻结——这是 Golden Test 的「人工确认过的存档」范式，惰性数据、绝不执行，不构成第三变体。
+新金牌 `tests/_golden/loop-kit-extract.golden.mjs` + 期望存档 `tests/fixtures/loop-kit-expected/`（含 `baseline/` 切换前观测基线）。期望存档 = 预期包内容：对提取前 HEAD 十脚本做机械 ROOT 行替换后的存档，人审 diff 后随 prd 冻结——这是 Golden Test 的「人工确认过的存档」范式，惰性数据、绝不执行，不构成第三变体。评审 H3 采信后总纲：机械替换本身的正确性由 C7 根语义组独立作证 + C2 完整基线行为比对双重覆盖，启发式断言（关键输出/行数上限/特征串）全部废除、换成完整比对。
 
-- C0 搬运保真 + 跨仓棘轮：包内 `bin/*.mjs` 与 `lib/root.mjs` 对期望存档逐文件 sha256 相等。红：包不存在。绿：包落成。此 pin 兼作跨仓兼容棘轮：日后任何包改动（含 autotester 侧发起的）必先改 Casey 期望存档 + 重签 `prd-loop-kit-extract`——ADR-0008 已认的「兼容金牌负担前置」的机制形态（route:human #5）。
-- C1 API 面 deepEq：经 `shim` 动态 import 的 `contract`/`term-lint`/`ratchet` 导出名集合，对提取前 in-repo 快照（18/3/4 名，写死在金牌里）deepEq。红：包缺失或名单漂移。
-- C2 转发证明 + 全命令行为等价：先以 `LOOP_KIT_PKG` 指向测试标记包证明 `shim` 真转发（提取前的全量引擎无视该变量 → 红基线）；再经真包跑 `gate --dry` / `contract init·advance·check·show·list` / `breaker --reset·--round` / `term-lint --registry·--file·--stdin` / `ratchet index`，exit code + 关键输出对钉死期望逐条相等。
-- C3 无 `node_modules` 新树：临时 git `worktree`（确保无 `node_modules`，复用 worktree-baton 金牌的真接缝驱动范式）内跑 `hook-loop-guard` 互锁（合成 PreToolUse stdin JSON）与 `gate`/`contract`，行为与主树等价；并断言跨树派生时 `LOOP_KIT_ROOT` 以被执行 `shim` 的位置为准（树 B 的 baton 写进树 B，绝不写树 A）。
-- C4 降级矩阵：`LOOP_KIT_PKG` 指向空目录模拟包缺失——逐入口断言 D5 表（CLI 64 / guard 2 / lint 0+WARN）。红：提取前无降级协议。
-- C5 `shim` 零逻辑：十个 `shim` 匹配模板形状（行数上限 + 必含转发与注入标志 + 不含引擎特征串），杀 `shim` 层第三变体。红：现文件是全量引擎。
-- C6 存量零重签（非回归钉）：三份冻结金牌（`worktree-baton`/`term-guard`/`ratchet-reverse-index`）与其 prd 零字节改动、经 `shim` 复跑照绿；全仓 gate 复验 GREEN + `ratchet index` 复验。此项无红基线（守既有绿），豁免理由记档于 plan §3。
+- C0 搬运保真 + 三方一致 + 跨仓棘轮：包内 `bin/*.mjs` 与 `lib/root.mjs` 对期望存档逐文件 sha256 相等，且期望存档、`kit-lock.json`、真包**三方一致**。红：包不存在。绿：包落成。此 pin 兼作跨仓兼容棘轮：日后任何包改动（含 autotester 侧发起的）必先改 Casey 期望存档 + `kit-lock` + 重签 `prd-loop-kit-extract`——ADR-0008 已认的「兼容金牌负担前置」的机制形态（route:human #5）。
+- C1 API 面 deepEq：经 `shim` 动态 import 的 `contract`/`term-lint`/`ratchet` 导出名集合，对提取前 in-repo 快照（18/3/4 名，写死在金牌里）deepEq，且**逐名 `typeof` 相等**；行为面由 C2 完整基线（CLI 与 hook 全入口）+ C6 存量金牌复跑（`worktree-baton` 金牌 `import * as C` 驱 `contract` 多数导出真行为、`term-guard`/`ratchet-reverse-index` 驱其余库面）承担。红：包缺失或名单/类型漂移。
+- C2 转发证明 + 完整观测基线等价：先以 `LOOP_KIT_PKG` 指向测试标记包证明 `shim` 真转发（提取前的全量引擎无视该变量 → 红基线）；再经真包跑 `gate --dry` / `contract init·advance·check·show·list` / `breaker --reset·--round` / `term-lint --registry·--file·--stdin` / `ratchet index` + 四 hook 正常路径（合成 stdin JSON，含 guard 放行/拦两态），逐条对**切换前冻结的观测基线**比对：exit code + 规范化 stdout/stderr 全文 + 文件系统差量（`loop/` 运行态产物字节）。基线于提取前 HEAD 录制、随 prd 冻结（评审 H3 采信，废除「关键输出」启发式）。
+- C3 布局与跨树：三布局场景（评审 M1 采信）——① 同层默认布局：临时 git `worktree`（确保无 `node_modules`，复用 worktree-baton 金牌的真接缝驱动范式）内跑 `hook-loop-guard` 互锁（合成 PreToolUse stdin JSON）与 `gate`/`contract`，行为与主树等价；② 异地树 + 显式 `LOOP_KIT_PKG` 可跑；③ 异地树无覆盖 → 按 D5 安全失败。跨树两态（评审 M2 采信）——CLI 派生：树 B 的 baton 写进树 B，绝不写树 A；库模式：同进程先 import 树 A `shim` 再 import 树 B `shim` 得结构化错误，绝不静默采用树 A 的 ROOT。
+- C4 故障族矩阵：缺包目录 / 身份锁失配（伪造漂移包）/ 缺目标脚本 / 语法损坏脚本 / 信号终止 / `spawnSync` 报 error / 意外退出码，逐故障 × 逐入口断言 D5 表（CLI 64 或同信号自终 / guard 一律 2 / lint 一律 WARN+0）；DrvFs 不可确定性复现的权限类以引导层单元桩钉协议。红：提取前无降级协议。
+- C5 `shim` 模板逐字比对：十个 `shim` 由单一模板 + 每件参数（脚本名/库名单）展开生成，金牌对展开结果**逐字比对**（评审 H3 采信，废除行数上限/特征串启发式），杀 `shim` 层第三变体；`loop-kit/lib/boot.mjs` 一并入本 prd 冻结面。红：现文件是全量引擎。
+- C6 存量零重签（非回归钉）：三份冻结金牌（`worktree-baton`/`term-guard`/`ratchet-reverse-index`）与其 prd 零字节改动——金牌内写死其**切换前 git blob SHA**、断言当前字节等于该锚（评审 H3 采信：独立基线可证，不只「跑绿」）——且经 `shim` 复跑照绿；全仓 gate 复验 GREEN + `ratchet index` 复验。此项无红基线（守既有绿），豁免理由记档于 plan §3。
+- C7 根语义组（评审 M3 采信新增）：`resolveRoot()` 独立语义用例——env 有效命中 / env 无效**立即失败不回退** / 上溯命中根标记 / 上溯无标记抛结构化错误（不终止宿主进程）/ `realpath` 规范化 / 探针回报实际锚定树。红：包不存在。
 
@@ -79,4 +87,5 @@
 - `CLAUDE.md`：常用命令零改动；新增一段「`loop-kit` 已提取为兄弟目录独立包（ADR-0008），新机器 bootstrap 需先把包 clone 到 `/mnt/d/ctx/heren/loop-kit`」。**归本契约收尾**、不另开小契约——一段纯文档不值一个 baton，且与切换同提交才不出现文档与事实脱节窗口。
-- prd acceptance 涟漪 grep 全量（证据见 plan §0）：`prd-p2-intent-compile`（2 条 `term-lint` 命令）、`prd-ratchet-reverse-index`（1 条 `ratchet index` 命令）——路径经 `shim` 原样生效，命令零改动；`prd-model-lane-guard` 仅 dimension 散文提及、无命令。**重签清单为空。**
-- `loop/config.json` 的 `review.fallbackRunner` 路径不变；`package.json` scripts 三条不变；是否在 casey `package.json` 增加 `"loop-kit": "file:../loop-kit"` 依赖声明（兑现 ADR 预定形态 vs 实际解析已走兄弟约定、声明近乎装饰）——route:human #4。
+- prd acceptance 涟漪 grep 全量（证据见 plan §0）：`prd-p2-intent-compile`（2 条 `term-lint` 命令）、`prd-ratchet-reverse-index`（1 条 `ratchet index` 命令）——路径经 `shim` 原样生效，命令零改动；`prd-model-lane-guard` 仅 dimension 散文提及、无命令。
+- 涟漪反查扩面（评审 M4 采信，2026-07-13 实测）：本契约全部待改路径（`CLAUDE.md`/`CONTEXT.md`/`docs/HANDOFF.md`/`docs/NEXT-SESSION.md`/`package.json`/`package-lock.json`）对 68 个 prd 的 `testChecksums` 与 acceptance 反查 0 冻结命中；`CONTEXT.md` 的 `--registry` 运行时门禁与 `term-guard` 金牌活读弃用别名名单两个耦合点记档（详见 plan §0）。**重签清单为空**（全路径反查证据在案）。
+- `loop/config.json` 的 `review.fallbackRunner` 路径不变；`package.json` scripts 三条不变。依赖声明按评审 M5 采信后收紧为**二选一、装饰性声明不可接受**——route:human #4 已裁定（Steven 2026-07-13）：**取甲**，casey `package.json` 不加 `"loop-kit": "file:../loop-kit"` 本地路径依赖、本契约单出口只走兄弟目录约定（ADR-0008 决策 1 原文「最终以提取契约 GRILL 定案为准」，本裁定即完成该定案、无需回改 ADR）；乙案（加声明并使其成为真实受测解析分支，纳入 `package-lock.json` 涟漪复审）标弃，不入本契约实现范围——如后续确需 npm 本地路径依赖出口，另立契约评估。
 - `CONTEXT.md`：更新 `loop-kit` 词条白话解释（提取已发生、指 ADR-0008）+ 登记 `shim` 新词（四列制，见 plan §6）；随切换提交落，先于任何使用。
@@ -88,2 +97,3 @@
 - 在飞并行树：其分支仍带旧引擎、位置锚定自洽照跑；合并进 dev 时若 `loop-kit/bin` 冲突（罕见，内核文件极少被功能契约触碰）按护栏 #18 合并纪律 route:human。
+- 身份锁的跨树后果（评审 H2 采信的连带代价，随 route:human #5 一并确认）：切换后，包再升级时未同步 `kit-lock` 的在飞旧分支树会被身份锁按 D5 降级拦下——这是防漂移的预期行为，补救 = 合并 dev 取新 `kit-lock`，或显式 `LOOP_KIT_PKG` 指向匹配版本。
 
```
