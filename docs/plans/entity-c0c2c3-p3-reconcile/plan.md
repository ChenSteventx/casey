# entity-c0c2c3-p3-reconcile 计划

依据：`proposed/GRILL.md`。目标是在不削弱 C2 source 读回与 C3 破坏性目标连续性门的前提下，让 P3 C5 只验证自己的 `workflow.deleteByName` 入口缺席义务。

## 验收点

1. C5 flow 恰含一条 `workflow.deleteByName`，不得含 `workflow.create` 或其他原子。
2. 删除步保留 `sourceIntentId=intent_cleanup`、恰一 `candidate-wf-main/subject` 绑定与 `atl_{{uniqueName}}` 目标名；`requiredFlowEntityBindings()` 投影恰一条闭合绑定。
3. 同一 C5 flow 在 `certifiableKinds=[]` 时被 `admitCompileDestructiveContinuity()` 以 `COMPILE_DESTRUCTIVE_NO_IDENTITY_CHANNEL` 拒绝，在 `certifiableKinds=['workflow']` 时通过；证明夹具隔离没有绕开 C3 结构准入。
4. `tests/_golden/p3-compile.golden.mjs` 的 C5 改用独立构造件；`FLOW_GOOD` 与其他检查保持原形。
5. 现有 `entity-destructive-continuity-guard.compile-admission.golden.mjs` 复跑通过，证明组合修改不回退 C3 浏览器前门。
6. 既有 owner `loop/prd-p3-compile.json` 记录新的 checksum amendment 并重钉 `p3-compile.golden.mjs` checksum；不得改 `passes`，不得声称未运行的 full golden 通过。
7. 异构评审必须看到完整 worktree 与本计划、C0/C2/C3 契约材料，审查是否弱化任一门、是否遗漏跨契约交互。

## 红先行

先新增 `tests/_golden/p3-compile-c5-fixture-isolation.zero-sut.golden.mjs`。实现前 `tests/_golden/support/p3-compile-c5-flow.mjs` 不存在，命令必须非零退出并明确报告构造件缺席；保存红输出后才添加构造件和改 C5。

## 实现步骤

1. 冻结零 SUT 验收测试与本契约 PRD。
2. 新增纯数据构造件，令零 SUT 金牌转绿。
3. 仅把 P3 C5 的输入从 `FLOW_GOOD + delete` 改为独立删除 flow。
4. 运行零 SUT验收、C3 浏览器前结构准入金牌、语法检查和 `git diff --check`。
5. 用 pi.dev/Grok 内联评审完整 worktree；有实质发现则修复并重跑。
6. 更新 `loop/prd-p3-compile.json` 的 checksum amendment 与 checksum。

## 预计改动

- `docs/plans/entity-c0c2c3-p3-reconcile/proposed/GRILL.md`
- `docs/plans/entity-c0c2c3-p3-reconcile/plan.md`
- `docs/plans/entity-c0c2c3-p3-reconcile/accept/red-baseline.txt`
- `tests/_golden/p3-compile-c5-fixture-isolation.zero-sut.golden.mjs`
- `tests/_golden/support/p3-compile-c5-flow.mjs`
- `tests/_golden/p3-compile.golden.mjs`
- `tests/_golden/entity-destructive-continuity-guard.compile-admission.golden.mjs`
- `loop/prd-entity-c0c2c3-p3-reconcile.json`
- `loop/prd-p3-compile.json`
- `loop/prd-entity-destructive-continuity-guard.json`

## 不可命令化观察

- `p3-compile.golden.mjs` 的 15/15 组合树复跑会启动 fake-SUT；本 session 不运行，登记 `route:human`。
- C2 `workflow.create` 的 source 读回与准入角色重签仍是独立 `route:human`，本轮不假闭合。
- 真机“入口在场 + 已认证 workflow ref + 合法删除”仍是 C2/C3 的真实 UAT 义务，本轮不背书。

## 执行结果

- 红先行：构造件缺席时 exit 1，证据见 `accept/red-baseline.txt`。
- 零 SUT C5 夹具隔离：4/4。
- C3 浏览器前结构准入：首次组合树为 2/3，行为半边已 fail-closed、pipe 诊断为空；修复测试捕获后 3/3，证据见 `accept/c3-driver-red-baseline.txt`。
- 调和 gate：真机执行层 2/2，由 gate 独占写入 `passes:true`。
- P3 owner 与 C3 owner：校验和和术语 dry-run 全绿；没有执行会启动 fake-SUT 的 full `p3-compile`。
- 异构评审：Grok TUI 首轮 `REVISE`，按发现修正后调用 `code-review` skill 复审 `APPROVE`；见 `review/grok-code-review-r2.md`。
