# 自适应页面执行 subagent 编排计划

> 目标：在最多 4 个并发槽位（根 agent + 3 个 subagent）下，优先闭合可运行技术链，并避免多人同时
> 修改 `replay`、atom registry、统一语言和冻结 schema 等热点。
>
> 权威需求源：
>
> - `docs/runbooks/adaptive-page-execution-sop.md`
> - `docs/plans/zero-shot-page-execution-research/execution-plan.md`

## 1. 编排原则

1. 根 agent 负责接口、acceptance-gate、合并、全量验证和真实 UAT；subagent 不自行合入主线。
2. 每个实现波次分为两个阶段：
   - 根 agent 先写/合入红测试并冻结 checksum；
   - subagent 从同一红基线各开隔离 worktree，只修改分配文件，把自己的红项转绿。
3. 三个 subagent 的 `touchesFiles` 不重叠；发现必须修改公共接口时先停下通知根 agent，不自行扩 scope。
4. agent 只能声明自己切片的完成状态；夹具 GREEN 不得冒充真实 AI 中台闭环。
5. 每个 worktree 有独立 `full` Loop Contract、PRD、red proof、review 和 learn。
6. 每个实现提交必须有配置好的 Grok 只读复审；不探测凭据，不调用 Claude Code。
7. 真实 SUT 只由根 agent 在合拢后执行，使用回环入口；subagent 不访问 `.auth/`、`site.json` 或真实地址。

## 2. 根 agent 独占文件

默认禁止 subagent 修改：

- `bin/casey.mjs`
- `bin/replay.mjs`
- `lib/atoms-registry.snapshot.json`
- `CONTEXT.md`
- `docs/HANDOFF.md`
- `docs/NEXT-SESSION.md`
- `loop/active-contract.json`
- 已冻结的正式 schema/fixtures

确需修改时，由 subagent 提交接口建议和最小 diff，根 agent 在合拢阶段统一实施、重签影响面。

## 3. 每波标准工序

```text
根 agent：冻结接口
→ 根 agent：acceptance-gate 写红测试
→ 验证红基线并冻结 testChecksums
→ 三个 subagent 从同一红基线开 worktree
→ 并行实现，各跑责任测试和局部回归
→ 各自 Grok 只读复审
→ 回传 commit + 测试 + blocker
→ 根 agent 按依赖顺序 cherry-pick
→ 根 agent 跑总 gate、影响面和真实 UAT
→ 只有总门 GREEN 才开始下一波
```

冻结测试不得由实现 agent 为了转绿而修改。若红测试本身有错，必须返回根 agent 重开 acceptance 修订，
不能在实现提交中顺手改断言。

## 4. Wave 1：确定性 intent plan

契约：`intent-plan-known-atom-foundation`

目标：先完成“陌生用例表述 → 已有 atom → authored expected 冻结”，这是最快能运行的确定性闭环。

### Agent A：intent plan 与 recipe

任务名：`intent_plan_core`

独占文件：

- `lib/intent-plan.mjs`
- `lib/intent-recipes.snapshot.json`
- 新增 intent-plan schema 的实现侧辅助文件

交付：

- `buildIntentPlan(...)`
- `mappingFromIntentPlan(...)`
- exact/anchored-template recipe；
- known atom 锁定；
- `KNOWN_ATOM_OVERRIDE`、`KNOWN_RECIPE_AMBIGUOUS`；
- unresolved/grill reason。

禁止：

- fuzzy 猜测；
- 修改 flow-bridge、compile-gate、runtime identity；
- 把平台 ID 写进 DOM locator。

### Agent B：状态机 trace

任务名：`intent_state_trace`

独占文件：

- `lib/compile-gate.mjs`
- 仅属于 state trace 的新增 unit test helper

交付：

- 加法 API `traceStateMachine(...)`；
- 既有 `checkStateMachine` 委托同一实现；
- 每步 before/requires/missing/provides/removes/after；
- 既有 compile-gate golden 零行为漂移。

禁止复制 registry states 或另建第二套状态机。

### Agent C：authored assertion 冻结

任务名：`authored_assertion_freeze`

独占文件：

- `lib/assertion-draft.mjs`
- `bin/draft.mjs`

交付：

- `projectTestCaseAssertions(...)`
- `mergeAssertionSources(...)`
- 内部 `--testcase` 接线；
- authored expected 优先；
- compiler assertion 加法合并；
- unresolved 进 pending；
- 模型 patch 不得删除或覆盖 authored assertion。

禁止改 sign、expected-frozen schema、replay 和 verdict。

### Wave 1 合并顺序

```text
Agent B state trace
→ Agent A intent plan
→ Agent C assertion freeze
→ 根 agent 接 CLI/测试细缝
```

退出门：

- known recipe 唯一命中；
- 模型覆盖 known atom 必拒；
- mapping round-trip 通过现有 flow-bridge；
- TestCase expected 真进入 frozen；
- 同名错平台 ID 仍由现有 identity lock 拒；
- zero-SUT 全绿，现役 flow/draft/sign 回归全绿。

## 5. Wave 2：setup、陌生页观察、人工原始复现

Wave 1 合拢后再冻结三组 schema。

### Agent A：业务前置条件 setup flow

任务名：`setup_flow_receipts`

独占文件：

- `lib/adaptive-execution/setup-flow.mjs`
- `lib/adaptive-execution/setup-receipt.mjs`

交付：

- setup-flow candidate；
- 复用 registry requires/provides 的拓扑编排；
- `ensure` 先检查再建立；
- setup receipt 将实体 ID/状态传给主体 flow；
- 前置失败时主体不得开始。

登录继续走登录预备动作，不做 atom。

### Agent B：PageObserver、catalog 与确定性 resolver

任务名：`page_observer_resolver`

独占文件：

- `lib/zero-shot/page-observer.mjs`
- `lib/zero-shot/affordance-catalog.mjs`
- `lib/zero-shot/deterministic-resolver.mjs`

交付：

- 主 frame observation；
- page-wide unique role/label/text candidates；
- TestCase 值 + 唯一门的零 LLM resolver；
- stable progress projection；
- SSE/轮询页面不依赖严格 network idle。

MVP 不承诺 container-only、iframe、scroll/goBack、视觉坐标。

### Agent C：示教 fresh raw reproduction

任务名：`teachin_raw_reproduction`

独占文件：

- `lib/teachin-raw-replay.mjs`
- `bin/teachin-raw-replay.mjs`
- `bin/record.mjs`

交付：

- 录制浏览器关闭后 fresh context 原始复现；
- capture exact hash；
- nav 只作 checkpoint；
- unique resolution 和路径连续；
- `CLEAN/FAILED` proof；
- capture 始终 `replayReady:false`；
- proof 不含 PASS/verdict/真实 URL。

第一版只测只读或幂等链，不处理 mutation。

### Wave 2 合并顺序

```text
Agent A setup pure core
→ Agent B observation/resolver
→ Agent C raw reproduction
→ 根 agent 统一 CLI 帮助与工件布局
```

退出门：setup 收据可消费、陌生页可确定解析一个动作、人工示教能 fresh reproduce；三者都不产生正式 PASS。

## 6. Wave 3：单步 admission、候选回放、development-only teach-in cycle

> 2026-07-27 排序修订：本节保留历史文件分工，但实际 Wave 3 优先完成 teach-in raw/source replay、
> atom distillation、distilled replay 与正式报告；真实 SUT 至少三份报告经用户明确验收后，才允许
> GitHub technical preview。zero-shot trace canonicalizer/sign/replay 移到 Wave 4，并在完成后重新
> 验证 teach-in 双回放兜底。

### Agent A：action admission 与 progress

任务名：`zero_shot_admission`

独占文件：

- `lib/zero-shot/action-proposal.mjs`
- `lib/zero-shot/action-admission.mjs`
- `lib/zero-shot/progress-verifier.mjs`
- `lib/zero-shot/exploration-trace.mjs`

交付：

- typed proposal；
- 一次一动作；
- current observation/candidate 绑定；
- known-atom dominance；
- effect 取冻结 policy，不采信模型；
- no-progress/identity-pending/ambiguous 明确拒绝。

### Agent B：trace canonicalizer 与签后 replay candidate

任务名：`zero_shot_trace_replay`

独占文件：

- `lib/zero-shot/trace-canonicalizer.mjs`
- `lib/zero-shot/candidate-events-admission.mjs`
- `bin/explore-distill.mjs`

交付：

- exploration trace → candidate events；
- 每步 covered 或 pending；
- 只投影现役 events 能无损表达的动作；
- container/frame 作用域不能保真时 pending；
- generic atomless event 不执行正式实体 mutation；
- candidate 继续走 draft/sign/replay。

### Agent C：development-only teach-in cycle

任务名：`teachin_dev_cycle`

独占文件：

- `bin/teachin-cycle.mjs`
- `lib/record-distill.mjs`
- teach-in roundtrip manifest 模块

交付：

- exact CLEAN raw proof admission；
- resolved candidate；
- mapped intent 删除 route/reason；
- mapped 与 pending 互斥；
- flow-bridge → compile execute → compile verify；
- `developmentOnly:true/promotionReady:false`；
- atom replay 只能叫 `REPLAYABLE`，不能叫 PASS。

### Wave 3 合并顺序

```text
Agent A admission/progress
→ Agent B canonicalizer
→ Agent C teach-in cycle
→ 根 agent 串第一条 AI 中台只读纵向链
```

Wave 3 的发布点改为人工示教双回放：

- 人工录制 source 能在 fresh browser 独立正式回放；
- 蒸馏 atom 能在另一 fresh browser 独立正式回放；
- 至少三份真实 replay → verdict → report 的 Casey 报告已交付；
- 用户明确验收通过；
- GitHub 发布只称 technical preview，不宣称 zero-shot trace 已正式化。

## 7. Wave 4：正式示教双回放与能力沉淀

> 顺序修订后，Wave 4 的主任务先完成 zero-shot candidate → canonical events → sign → fresh replay，
> 再把 Wave 3 人工双回放接成最终兜底并复验。下列正式 intake、等价和 held-out 任务继续有效，但
> 不再早于 Wave 3 用户验收发布门。

### Agent A：正式 record/intake authority

任务名：`teachin_formal_intake`

交付：

- record 生成 identity sidecar、package manifest、driver receipt；
- intake/distill 绑定 raw proof；
- 不放宽现有 formal admission。

### Agent B：双回放等价与 atom 分解

任务名：`dual_replay_atom_distill`

交付：

- source/distilled 独立 artifact role、run namespace 和 identity hash；
- setup/action/assert 分段；
- intent/entity/effect/cleanup 确定性等价；
- 已有 atom 新变体优先，业务效果变化才产候选新 atom。

### Agent C：版本漂移与留出评测

任务名：`drift_holdout_harness`

交付：

- AI 中台 warm replay/cold compile 分报；
- current + version-held-out；
- 医生站 same-channel hidden holdout；
- autonomous/LLM-assisted/human-assisted 分报；
- Hi 小助 CEF 明确后置；
- false heal、false machine final、错实体操作均为 0 的验收统计。

Wave 4 后才考虑 mutation、CEF、iframe、视觉 grounding 和大规模安全强化。

## 8. subagent 回传协议

每个 subagent 最终必须返回：

```text
task:
branch:
worktree:
commit:
base commit:

changed files:
tests:
red baseline:
green result:
regressions:
grok review:

completed:
not completed:
route:human:
cherry-pick order:
```

不得只回复“已完成”。测试必须给退出码和计数；真实 UAT 未运行时必须显式写未运行。

## 9. 冲突与中止规则

- 需要修改根 agent 独占热点：暂停并发消息根 agent；
- 发现 frozen test 错误：不改测试，返回 acceptance 修订请求；
- 发现真实 SUT 行为与计划冲突：保留证据，停止自动修复；
- 出现同名/缺 ID/错 ID：停止，不让 LLM 选择；
- 某 agent 超出切片仍可继续的任务，另立后继，不扩当前 contract；
- 合并后总 gate 失败：回滚该 cherry-pick 或在集成分支修复，不让下一波建立在红基线上。

## 10. 第一轮实际启动建议

第一轮只启动三个 Wave 1 agent：

1. `intent_plan_core`
2. `intent_state_trace`
3. `authored_assertion_freeze`

根 agent 在启动前先完成：

- 建立 `intent-plan-known-atom-foundation` full contract；
- 用 acceptance-gate 冻结三组红测试；
- 固定 intent-plan schema、recipe shape 和 assertion merge order；
- 给三个 agent 同一个红基线 commit。

这样第一轮并行结束即可得到可运行的确定性优先主干，不必等浏览器 agent、正式示教 authority 或跨站评测。
