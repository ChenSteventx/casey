---
name: acceptance-gate
description: 流水线阶段2「门禁制造」工序：读 plan.md 验收点 → 写验收测试（运行验证红/绿基线）→ sha256 冻结 → 生成 loop/prd.json。在 to-plan 之后、开 loop 之前使用。ATDD（验收测试驱动开发）+ Test Ratchet（测试棘轮）的工序化。
---

# acceptance-gate（验收门禁工序）

把散文验收点铸成可执行规格（Executable Specification）并冻结。完成本工序前不得开 loop——没有外部事实源的循环是 token loop（护栏与依据：`loop/GUARDRAILS.md`、`docs/adr/0004`、`docs/decisions/2026-06-12-loop-kit.md`）。

## 输入

阶段 1 产物：`./doc/<工作区>/plan.md`（to-plan 输出，含验收点）。没有它就停下来要求先走 to-plan。

## 工序

1. **提取验收点**：逐条读 plan.md 的验收点，分类：
   - 可命令化 → 进 story 的 `acceptance`（每条都是可运行命令，exit 0 = 过）；
   - 不可命令化（安全/架构/真机人工抽验等）→ 写进 prd.json 的 `observability` 申报（route=human 或 waived），**不许静默丢弃**。
2. **写验收测试**，两类都合法、都要冻结：
   - **新功能验收测试**：实现前必须红——写完立刻运行，贴出失败输出作为"确实红"的证据；如果实现前就绿，说明测试没测到新行为，重写；
   - **回归保护测试**（golden 测试收编存量行为）：冻结时即绿，防实现破坏存量——同样运行并贴出通过证据。
   - golden 测试与 fixture 放 `tests/_golden/`（与录制场景目录分开，便于圈定冻结范围）。
3. **生成契约**：写 `loop/prd.json`（schema 见 `loop/prd.schema.json`）：
   - story 拆分原则：每条 story 的验收命令能独立运行；`passes` 一律初始化 `false`（gate 是唯一写入者）；
   - `testChecksums`：对每个验收测试/golden 存档文件算 sha256 登记（PowerShell：`Get-FileHash -Algorithm SHA256`，或 node crypto）。
4. **验证契约形状**：跑 `node loop-kit/bin/gate.mjs --dry` 确认契约可被门禁消费。
5. **汇报**：列出 ①每条验收点的去向（story / observability）②红测试的失败输出证据 ③checksum 清单。汇报必须指向工具结果，未运行过的不许声称。

## 铁律

- 本工序产出的测试文件自冻结起对实现者只读；改动 = gate 直接红（Test Ratchet，护栏 #1）；
- 术语遵守 `CONTEXT.md` 统一语言（标记约定 + 白名单，ADR-0004）；
- 英文术语首次出现附中文白话解释。
