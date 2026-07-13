# loop 双 profile 改革——中文决策与取代摘要（2026-07-13）

> 本文是 `PROPOSAL.md`（英文规范设计源）的中文决策记录，按其 §12 与 P0-1 要求产出。本文只作决策与术语对照，**不是**第二设计源：任何条款与 `PROPOSAL.md` 冲突时以后者为准（其 §0 批准记录为最高依据）。

## 一、批准了什么（Steven，2026-07-13）

1. 反转旧决策 ①：B/C 两个在制契约（`drawer-lock-hardening` / `gen-prompts`）**延后**，先以 P0-2 冻结 checkpoint 原样保全进各自分支，待新 loop 通过自托管验证与接管演练后按 P1 恢复完成——是延后不是取消。
2. 反转旧决策 ③：采纳 16 节点**持久工作流状态**（每 worktree 一份 `loop/state.json`，经 §4.4 有界切换成为唯一可写工作流真相；六阶段台账降为只读投影）。
3. `docs/plans/loop-dual-profile-reform/PROPOSAL.md` 自此为**唯一**活动改革设计源；`docs/plans/loop-ddd-overhaul/DESIGN.md` 与 `docs/plans/loop-orchestration-reform/NEXT-SESSION-PROPOSAL.md` 已标 `SUPERSEDED`，只作历史输入。

未被反转、继续有效的旧决策：护栏 #18 不推翻（无共享池/无自动合并队列、合并冲突人裁）；强制层改动一律 `kernel` 车道治理；默认 2 个限界上下文；backlog 项 drop/archive 须 Steven 确认。

## 二、评审链（全程只读、逐条对码）

- Fable 架构审：`PASS WITH REQUIRED CHANGES`（HIGH-1 治理取代记账 + MED-1..5，全部已并入提案文本）；§2.1 自审 14 行零条被代码证伪。
- Fable 聚焦复核：四项收窄全接受。
- codex 事实更正：`countChange` 自托管候选被当前代码证伪（`profile.countSelector` 已于 `dbc0d0d` 落地）——终态 `ACCEPT WITH FACTUAL CORRECTION`；P0-9 候选改为启动时按实时代码/测试/PRD/audit/git 历史选定。
- 完整处置账：`FABLE-REVIEW-DISPOSITION.md`。

## 三、术语对照（均已登记 `CONTEXT.md` loop-kit 通用子域）

| 英文（提案用词） | 登记术语 |
|---|---|
| execution profile | `Execution Profile`（执行剖面） |
| durable workflow state / `state.json` | `Durable Workflow State`（持久工作流状态） |
| ownership lease | `Ownership Lease`（所有权租约） |
| kernel lane | `kernel` 车道 |
| review receipt | `Review Receipt`（评审收据） |
| readiness view | `Readiness View`（就绪视图） |
| fitness function | `Fitness Function`（适应度函数） |

## 四、铁律重申（改革全程一字不让）

裁判零 LLM（`verdict.mjs` 不动）；fail-safe 不 fail-open；`passes` 只有 gate 写；冻结 checksum 只走既有 sign 流程；`testChecksums` 是 Published Language 与写侧唯一源、反向索引只是只读派生投影；凭据不进任何输出/日志/提交/报告；gate 绿 ≠ 完成、真机 UAT 人签不可替代。
