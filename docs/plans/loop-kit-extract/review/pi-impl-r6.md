# loop-kit-extract 实现审记录（r2 第五次跑，`pi`）

## 评审元数据

- 评审对象：同 `codex-impl-r6.md`——`loop-kit-extract` 契约 round-2 第四次跑发现处置后的复核，
  评审料 `docs/plans/loop-kit-extract/review/material-impl-r6.md`。
- 评审形态：异构冗余评审——实现方 = Claude（Sonnet 5），评审方 = `pi`（`deepseek/deepseek-v4-pro`，
  评审家族≠实现家族）。
- 评审方调用：`pi -p --no-session --no-tools --thinking high --model deepseek/deepseek-v4-pro
  @docs/plans/loop-kit-extract/review/material-impl-r6.md "<评审指令，指向料文件『0. 评审指令』一节>"`，
  `pi` 版本 `0.80.3`。首次调用即产出完整结果，无需重跑。
- 护栏 #9：同一份评审料，只含 spec、历史发现摘要、本轮处置说明、累积 diff、门禁证据，不含凭据、
  不含实现者内心推理。`--no-tools` 保证 `pi` 只基于料文件内容判断。

## 结论（原文）

**PASS**——本轮两条发现已妥善处置，累积最终版本已达到合理收敛状态，进一步收紧的边际收益低，
当前状态可冻结。

## 逐条复核（`pi` 原文摘录）

- **`node:vm` `Context` 边界（`HIGH`）：处置合理，无需运行时防护。** 对比 `worker_threads`：其有
  `isMainThread` 可靠运行时判据故做运行时拒绝；`node:vm` 每个 `Context` 中 `isMainThread` 恒为
  `true`，Node 无对等可靠判据。启发式防护不可靠：文档已评估 `process`/`Buffer` 注入对象启发式
  方案会被有意注入这些对象的 `Context` 绕过，「不采用」判断正确。默认不可达：复现需
  `--experimental-vm-modules` 显式旗标，本仓和消费侧所有默认调用路径均不携带，`grep` 核验零使用。
  前提已毁灭边界意义：构造该场景需要攻击者已在同进程内拥有任意代码执行能力，此时同进程本身已不是
  可信边界。文档化位置准确：语义 6 收窄表述并新增专节，留有明确的未来重评窗口。综上「纯文档化」
  是成本与风险最平衡的合理处置。
- **`C7` 断言过宽（`LOW`）：已妥善修复。** 两处 `out.first.includes('a')` 已改为
  `out.first === realpathSync.native(dirA)` 精确比对，`marker-root` 目录名自身含字母 `a` 导致的
  假绿风险已消除，无精度退化。
- **通读 `root.mjs`/`boot.mjs` 积累最终版本独立再评估**：`worker_threads` 由 `isMainThread` 显式
  拒绝；`node:vm` 已文档化边界并注明重评义务；槽内容不可信与冻结窗口（`writeClaimed`/
  `revalidateClaimed`/`adoptAndFreezeIfNeeded`，含 `claimAtomic` 同值分支）已堵死来回切换窗口；
  并发导入竞态（`resolveRoot()` 全路径无 `await`，认领过程原子）已由 `C3` `Promise.all` 验证；
  `boot.mjs` 的信号兜底码、`spawnImpl` 双态验证、特殊字符路径防退化、`loadLib` 抛错冒泡均确认到位。
  **未发现其它高危缺口**，整体防护面已接近合理饱和。
- **门禁证据与冻结纪律**：`gate` GREEN（5/5）、`golden` 73/73 GREEN、`selftest --tier1` 全链路
  GREEN、`ratchet verify` 2 项既有缺口与本契约无关；凭据/目标地址未出现在任何 diff 中。

## 驱动员核验备注（非评审判断，供归档交叉参考）

本轮 `codex` 与 `pi` 首次在同一评审料上双双判 `PASS`——round-2 双路复核连续 5 次跑（第一至五次跑）
后首次收敛。距上一轮（第四次跑）codex 指出的治理缺口（`node:vm` 范围收窄未同步进权威契约）已由
实现方处置：`plan.md`/`GRILL.md` 补入完整范围表述+交叉引用、新增 route:human #7 与对应 §7 挂账
条目、`prd` `observability` 补记录、`root.mjs` 语义 4 补交叉引用消除内部表述不一致。
