# Plan — intent-event-fold

> lane: full。目标是封死正式回放中“同一 intent 的前序失败被最后代表步洗成 PASS”的 P0 假绿洞。

## 验收点

1. 纯函数折叠正向：多事件全部成功时，intent 级 `action` 保持成功；混入纯断言 `{kind:'none'}` 不误伤。
2. ambiguous 反向：前事件 ambiguous、末事件 unique 时，折叠结果必须 ambiguous；喂确定性裁判后恰为 `NEEDS_HUMAN/AMBIGUOUS_ACTION`，即真实 cleanup 事故同构红案。
3. action_failed 反向：前事件 action_failed、末事件 unique 时，结果不得 PASS，恰为 `NEEDS_HUMAN/INDETERMINATE`（无 SUT 错误背书）。
4. none 反向：前事件 none、末事件 unique 时不得 PASS；只有全部 miss 都带有效 driftProbe、且无其它普通 miss/未知/更强失败时才按既有树为 `HARNESS_ERROR`。
5. 优先级：ambiguous 压过 action_failed/none；action_failed、普通 none、未知失败均压过 none+drift，防错误终判 harness；矛盾轴一律失败且消毒 intent 级假成功回读。
6. 坏输入：空数组、缺 action、非对象 action 均 fail-safe，不抛、不 PASS；函数不修改输入。
7. 回放接线：真实浏览器 hermetic 场景制造“同 intent 先多匹配、后唯一”时，`axes.eventActions` 保留二事件，intent `action` 为 ambiguous，`verdict.json` 非 PASS；全唯一对照保持 PASS。
8. 报告一致性：由同一 axes/verdict 装配报告不触发一致性门，原子操作仍逐 event 完整呈现。
9. 回归：`p5-replay`、`p5-replay-coverage`、`e2e-chain`、`run-history`、`layer3-wiring`、`report-cleanup-evidence`、`report-fidelity`、`casey selftest --tier1`、ratchet verify 全绿。
10. 不变量：`bin/verdict.mjs`、`lib/report-model.mjs`、冻结 schemas 零字节改动；`git diff --check` 通过。

## 红先行

新增 `tests/_golden/intent-event-fold.golden.mjs`：

- 第一层动态 import 新纯函数；实现前模块缺失即红，逐条钉上验收 1–6。
- 第二层起隔离的最小 HTTP fixture，调用真实 `bin/replay.mjs` + `bin/verdict.mjs`。失败案同 intent 第一步定位两个同名按钮（回放门必须不点击、产 ambiguous），第二步点击唯一按钮；冻结硬断言在末步成立，旧代码会由末步 unique 得到假 PASS。新代码必须折为 ambiguous。
- 正向案两步均唯一，硬断言成立，保持 PASS。
- 报告装配检查逐 event 原子数不丢，并与 verdict 一致。

验红记录要求：旧 HEAD 的集成失败案必须明确观察到 `eventActions[0]=ambiguous`、`action=unique`、`verdict=PASS`，而不是只因模块不存在泛红。

## 实现切片

1. 新增 `lib/intent-action-fold.mjs`，导出纯函数 `foldIntentAction(eventActions)`。
2. `bin/replay.mjs` 每个 intent 只构造一次 `eventActions`，以纯函数产 `action`；删除“verdict 不消费本字段所以会掩盖”的失准注释。
3. 不动裁判和报告镜像；若报告一致性测试红，只修上游 axes 形状或测试，不复制另一套裁定。

## touchesFiles

- `docs/plans/intent-event-fold/proposed/GRILL.md`
- `docs/plans/intent-event-fold/plan.md`
- `lib/intent-action-fold.mjs`
- `bin/replay.mjs`
- `tests/_golden/intent-event-fold.golden.mjs`
- `loop/prd-intent-event-fold.json`
- `loop/active-contract.json`

## 冻结涟漪

新 golden 只由新 PRD 冻结。既有 PRD 没有把 `bin/replay.mjs` 纳入 `testChecksums`；实现改动不要求伪重签既有测试，但所有相关门禁仍须原样复跑。若测试过程中不得不改既有 golden/fixture，先反向枚举所有 checksum 消费者再重签，不静默改。

## 真机 observability

本契约自身不把 fake SUT 当交付完成。与删除域锁 P0 合流后，每条真实 case 必须观察：cleanup `eventActions` 全部成功、后置目标精确数为 0、机器 verdict 全 PASS、录像末段和删除后截图均无目标实体；任一矛盾即停止并出 `NEEDS_HUMAN`/失败报告。
