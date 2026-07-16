# CLAUDE.md

**Casey（测易）** —— LLM 驱动的「文本用例 → 测试报告」自动化测试系统。一段文本用例（excel/json/txt/自由文本）→ LLM 编译成确定性可回放 spec → 确定性回放（录屏 + 抓输出）→ 零 LLM 多态裁定出严格结论 → 自包含测试报告。三处统一标识符 `casey`：CLI `bin/casey.mjs`、skill `casey`、MCP server `casey`。

复用 autotester 的 **loop-kit**（loop engineering 工具箱）作为第二消费者（ADR-0001）。Casey 是 autotester（人录、机回放、零 LLM）的「翻面」：输入端改 LLM，但「确定性是默认、LLM 是手术刀、完成是退出码、裁判零 LLM」的内核一字不让。

## 必读顺序

1. `CONTEXT.md` —— 统一语言注册表：**所有概念命名以它为准**，弃用别名列是黑名单；
2. `docs/design/txt2testreport-design.md` —— 端到端设计（v0.2，已并入 4 路红队修订）；
3. `docs/plans/bootstrap/plan.md` —— 落地计划（P0–P9 里程碑）；
4. `loop/GUARDRAILS.md` —— 护栏清单，逐条有效（1–12 迁移，13–16 Casey 新增）。

## Bootstrap（`loop-kit` 兄弟目录）

`loop-kit` 已提取为独立包（ADR-0008）：Casey 与 autotester 双消费者。拓扑关系优先于绝对路径——包是消费树的**兄弟目录**独立仓（`../loop-kit` 与 `../<本仓目录名>` 平级），任何机器、任何 OS 同构；`/mnt/d/ctx/heren/loop-kit` 只是当前环境下的一个实例位置，不是必须坐落的路径。新机器 bootstrap：把包 clone 到消费树的兄弟目录；非同层布局须显式设 `LOOP_KIT_PKG` 指向实际位置（只改包位置，不豁免身份锁校验）。

注意：`hook-loop-guard` 遇包缺失或身份锁（`kit-lock.json`）失配会 fail-closed（拦，见护栏与 D5 降级矩阵），这会连带拦住用来修复现场的工具调用本身——恢复动作（clone 包或设 `LOOP_KIT_PKG`）须在 hook 触发范围之外（人工终端等）完成，不能指望在被拦的同一回合里用工具调用修。

## 硬规则（由机制强制，不是建议）

- 双 hook 在 `.claude/settings.json` 生效：回合输出与写入的 md/json 都会被 `loop-kit/bin/term-lint.mjs` 扫描，术语违例与繁体字会被拦截（ADR-0005）。新概念先查既有学科术语，造词必须先登记 CONTEXT.md；英文术语首次出现附中文白话解释。
- 阶段互锁：实现编辑/提交前必须先 `contract init` 声明入口分流；缺上一阶段交付物时 `hook-loop-guard` 拦截（护栏 #11）。
- `loop/prd-<slug>.json` 的 `passes` 字段只有 `loop-kit/bin/gate.mjs` 有权写入；`testChecksums` 冻结的断言文件对实现者只读。
- **裁判零 LLM**：多态裁定由 `bin/verdict.mjs`（零 LLM）出，自愈（LLM）是其下游消费者，不得进裁判进程（护栏 #15）。
- **fail-safe 不 fail-open**：机器只终判 `PASS` 与有取证背书的 `SUT_DEFECT`；证不出的一律 `NEEDS_HUMAN`（护栏 #14）。自愈只对确证 `HARNESS_ERROR` 开闸（护栏 #13）。
- `.auth/` 与 `site.json` 是凭据，内容不得进任何输出、日志、提交、报告。

## 常用命令

```
node loop-kit/bin/term-lint.mjs --registry              # 术语表完整性检查
node loop-kit/bin/breaker.mjs --reset                   # 熔断器清零（loop 开始时）
node loop-kit/bin/gate.mjs --prd loop/prd-<slug>.json   # 质量门禁（确定性裁判，唯一写 passes）
node loop-kit/bin/contract.mjs init <slug> --lane <direct|light|full> --reason "<一句理由>"
node bin/casey.mjs selftest --tier1                     # 链路自检（hermetic，零外部依赖）
```

业务命令（ingest/compile/sign/replay/verdict/report）见 `bin/casey.mjs --help` 与 README；当前实现进度见计划 P0–P9。

## 开发工作法（准则，非机制强制）

- **长链条走确定性编排**：起 subagent 前先估链条长度。短活/单步——直接派 `Agent` 或自己做；长链/多阶段（多契约并行落地 + 逐个异构评审 + 分波合并这类）——走 ultracode 模式（`Workflow` 工具编排：`pipeline` 各契约 + 并行评审 + 对抗式核验 findings + 循环到干），别手派一堆 `Agent` 自己盯完成再手接下一步。已在跑的手派 `Agent` 不为切换而杀重来（浪费），从下一个编排步（某波收口 / 下一波落地）起改走 `Workflow`。（Steven 2026-07-09 定。）
- 配套既有准则：可并行的活优先 `fan-out` 子代理；碰 `lib`/`bin` 的真并行走 `worktree`（护栏 #18）；异构评审家族≠实现家族（`codex` 评 Claude 实现）。
- **Claude Code 额度纪律**：评审先跑确定性检查，再用 `pi.dev` 的 `deepseek-v4-pro` high 清普通问题；Claude Code 只审已收敛的高风险小差异。每次只开一个进程，输入必须限定基线、文件白名单、风险清单与现成证据；禁止全仓漫游、派生子代理和无上限续跑。首轮只报 `Critical`/`High`/`Medium`，复审只看已确认 finding 的修复 hunks。额度不可用时，不反复探测；有 Steven 明确授权可由 `pi.dev` 代审，否则诚实挂账。详细操作见 `docs/runbooks/review-model-budget.md`。

## 决策档案

- `docs/adr/` —— 难逆转决策（复用 loop-kit / 多态裁定 fail-safe / 编译再回放 / 断言冻结人签 / 统一语言强制）；
- `docs/design/`、`docs/plans/` —— 端到端设计与里程碑计划。

## git 分支

`master`（稳定主干）/ `dev`（日常开发，默认工作分支）/ `test`（提测/真机 UAT）。
