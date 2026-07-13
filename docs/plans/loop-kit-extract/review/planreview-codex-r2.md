# loop-kit-extract round-2 方案评审记录（`kernel` 级设计评审，第二轮）

## 评审元数据

- 评审对象：round-1 处置后的 `docs/plans/loop-kit-extract/proposed/GRILL.md`（D1–D10）+ `plan.md`（骨架与验收点）+ round-1 处置全文（`review/planreview-disposition.md`）+ Steven 2026-07-13 四裁定记录（三者要点见 `docs/plans/loop-kit-extract/review/planreview-material-r2.md`）。
- 评审形态：异构冗余评审（Dissimilar Redundancy）——规划方=Claude（Sonnet 5），评审方=`codex`（评审家族≠规划家族），本轮为第二轮（round-2）。
- 评审方调用：`codex exec --skip-git-repo-check -C /mnt/d/ctx/heren/casey-loop-kit-extract -s read-only -m gpt-5.6-sol -c model_reasoning_effort=max -`，评审料经 stdin 喂入（`< planreview-material-r2.md`），`codex-cli 0.144.1`。
- 护栏 #9：评审料只含 spec/plan 与处置证据，不含凭据、不含规划者内心推理。`-s read-only` 沙箱下 codex 对本 worktree 有只读文件与命令执行权限（无写权限）——本轮 codex 实际做了代码级复核：grep 了 `loop-kit/bin/*.mjs` 相关源码、执行了两段最小 Node 复现脚本验证 M2/H3 的跨树 ROOT 缓存行为、量化测量了 `kit-lock` 逐文件 sha256 校验的实际耗时（`du`/`time sha256sum`/等价 Node 脚本），并跑了 `git status --short`/`git diff --check` 核对本仓状态——不是纯文案复核。
- 运行备注：进程正常产出完整结论并退出（`tokens used 206,749`），无网络/工具异常。

## 结论

`CHANGES REQUIRED`（codex 原文判据）——4 项 `HIGH`、3 项 `MED`、1 项 `LOW`。**round-2 尚未收口**：按 Steven 2026-07-13 裁定（route:human #1「有条件签署，条件 = round-2 codex 设计审收口」），本状态下**实现开工闸不放行**。

## HIGH

- **R2-H1：`boot.mjs` 自身的装载失败仍可绕过 guard 的 `exit 2` 归一。**
  方案把全部降级逻辑集中到 `boot.mjs`，但 C4 只覆盖包目录、目标脚本及子进程故障，没有覆盖 `boot.mjs` 缺失、语法损坏、静态依赖装载失败或锁解析时抛错（`GRILL.md:43`）。若 `shim` 静态 import `boot.mjs`，错误发生在任何处理逻辑执行前，Node `exit 1`；对只认 `exit 2` 为拦截的 guard，这仍是 fail-open。
  收口要求：C5 模板必须在 `shim` 内用最小、内联的 `try { await import(boot) } catch` 边界完成逐入口降级；C4 增加 boot 缺失、boot 语法损坏、锁 JSON 损坏、boot 调用前/中抛错。`shim` 自身字节损坏若被定义为 Casey git 信任根外故障，也应明确排除，不能继续声称「一切引导失败」均归一。

- **R2-H2：`LOOP_KIT_PKG` 把「改定位」与「关闭身份校验」绑在一起，H2 的循环信任只在默认布局下解除。**
  显式路径会直接跳过锁（`GRILL.md:45`）；同时异地树又被规定必须使用该变量（`GRILL.md:24`）。因此一个正常受支持的异地布局可以执行任意未验证 `gate`；假 `gate` 直接 `exit 0` 即恢复 round-1 H2 的循环信任。
  收口要求：`LOOP_KIT_PKG` 只改变包位置，任何位置都按 Casey 的同一 `kit-lock` 校验。C2 的标记包应走测试注入接缝或独立的受测锁，不应迫使生产入口保留无校验通道。

- **R2-H3：单个「进程级已解析根探针」不能证明命中缓存的具体模块持有哪个 ROOT；`finally` 方案也不满足并发环境零泄漏。**（代码实证——codex 跑了最小 Node 复现）
  当前协议是在 import 后读一个共享探针（`GRILL.md:49`）。最小复现：`A/contract → B/term-lint → B/contract` 后，第二次 `contract` 命中树 A 缓存，但探针已被 `term-lint` 更新为树 B；检查通过，导出函数仍锚在树 A——实测 `secondContract=TREE_A, probe=TREE_B, checkPassed=true`。另一并发复现中，两次同树导入都按「保存 env → 设置 → finally 恢复」，初始变量不存在，结束后却残留 `TREE_A`。
  收口要求：在任何目标模块成功求值前，由 `root.mjs` 原子认领单一进程 ROOT，异根立即抛；跨 worktree 的多个 `boot` 实例还需共享的全局串行化机制，或完全取消进程环境突变。C3 应覆盖三个库模块的交错排列、并发导入、env 原先存在/不存在、import 抛错和探针抛错。

- **R2-H4：观测基线仍没有可复现的录制与规范化协议，H3 的假绿空间尚在。**
  C2 只写了「规范化 stdout/stderr 全文」和 `loop/` 文件差量（`GRILL.md:77`），没有规定每案的初始树状态、命令参数、stdin/env、执行顺序、重置方式、规范化白名单及禁止写入范围。现有 `breaker --reset` 会写当前时间（`breaker.mjs:42`），`contract` 输出还含绝对路径和 worktree 实时集合，因此规范化不可避免；规则不冻结就可以过度删除行为差异。只快照 `loop/` 也无法证明 `boot` 没有在其他位置产生副作用。
  收口要求：冻结逐案 manifest、相同 seed 的隔离树、原始输出、字段级规范化规则及规范化器本身；比较整个测试根的路径与字节差量，并断言声明写集之外零变化。还应有反向用例证明语义差异不会被规范化掉。

## MED

- **R2-M1：D5 对普通 CLI 的故障分类自相矛盾。**
  D5 把缺依赖、语法损坏、Node 不兼容列为引导失败（`GRILL.md:54`），但表格又规定所有数值退出码原样透传（`GRILL.md:58`），而 C4 要求这些故障对应 CLI `64`（`plan.md:58`）。语法或传递 import 失败通常只是子进程 `status 1`，无法与合法业务 RED 区分。应明确二选一：普通 CLI 的任意数值码均原码透传；或设计带外诊断协议，禁止靠 stderr 猜测。另需规定 `status === null` 且无 signal/error 的分支。

- **R2-M2：`kit-lock` 的完整清单语义尚未定义。**
  C0 只明确比较 `bin/*.mjs` 与 `lib/root.mjs`（`GRILL.md:75`），但包还含 `package.json`、README 等（`plan.md:31`）。需明确：清单是否与除 `.git` 外的常规文件集合严格相等、是否拒绝额外文件、软链接/特殊文件/大小写碰撞、路径穿越与实际路径越界，以及 commit 字段是否在运行时验证。哈希后再按路径 spawn 还存在检查—执行竞态；若只防协作环境中的偶发漂移，应把该威胁模型写明，否则需执行经验证的快照。

- **R2-M3：`kit-lock` 的冻结顺序与其 package commit 字段冲突。**
  计划先生成并冻结含「包仓 commit」的锁（`plan.md:46`），下一步才建立并提交包仓（`plan.md:47`）——当时 commit 尚不存在；事后补写又会修改已冻结文件。应改为预先可计算的内容/树摘要，把 commit 降为事后出处信息，或重排为两个明确门禁阶段并重新定义 C0 红基线。

## LOW

- **R2-L1：每调用校验的性能断言没有量化证据。**（代码实证——codex 跑了实测计时）
  本树十脚本约 64 KB；一次本机 DrvFS 指示性测量中，空 Node 启动约 0.02 秒，逐文件读取并 SHA-256 约 0.17 秒。一次编辑可能触发多个 hook，成本会叠加。「毫秒级」不足以供 route:human #6 判断，应记录冷/热缓存及完整包清单的测量值和可接受预算；不建议为提速引入会削弱完整性的 mtime 缓存。

## 附注（codex 原文）

D5 对已成功进入包子进程后的 guard 数值码、signal、`spawnSync.error` 归一，以及 C5 逐字模板、C6 blob 锚，修订方向本身成立；上述 findings 不重开既定方向——即本轮四项 `HIGH` 与三项 `MED`/一项 `LOW` 均落在评审指令 (a)（round-1 洞是否真堵死）与 (b)（新增机制是否引入新问题）范围内，未触碰 Steven 已裁定的四个方向性决策本身（薄 `shim` / D8 取甲 / D2 fresh init / D5 加严方向）。

## 处置与去向

本记录是本契约 round-2 的正式异构冗余评审产出（护栏 #9 达成，非同族兜底）。按 Steven 2026-07-13 裁定（route:human #1）：round-2 收口 = 实现开工闸放行的充分条件；本轮结论为 `CHANGES REQUIRED`、4 `HIGH` 未清零，**round-2 未收口，开工闸不放行**。规划方需先对 R2-H1–H4（及 R2-M1–M3/R2-L1）逐条处置修入 GRILL/plan，再由 Steven 判断是否需要 round-3，或在 `HIGH` 清零后视裁定径行开工——本记录不涉及任何实现字节改动，`lib`/`bin`/`loop-kit`/`loop/prd-*.json` 均未触碰。
