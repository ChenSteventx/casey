# Plan — intent-event-fold

> lane: full。目标是封死正式回放中“同一 intent 的前序失败被最后代表步洗成 `PASS`”的 P0 假绿洞。2026-07-16 起验收改为 zero-SUT（零被测系统）回归棘轮，禁止再用 fake-SUT、浏览器或网络证明本内核。

## 验收点

1. 纯函数折叠正向：多事件全部成功时，intent 级 `action` 保持成功；混入纯断言 `{kind:'none'}` 不误伤。
2. ambiguous 反向：前事件 ambiguous、末事件 unique 时，折叠结果必须 ambiguous；喂确定性裁判后恰为 `NEEDS_HUMAN/AMBIGUOUS_ACTION`，即真实 cleanup 事故同构红案。
3. action_failed 反向：前事件 action_failed、末事件 unique 时，结果不得 PASS，恰为 `NEEDS_HUMAN/INDETERMINATE`（无 SUT 错误背书）。
4. none 反向：前事件 none、末事件 unique 时不得 PASS；只有全部 miss 都带有效 driftProbe、且无其它普通 miss/未知/更强失败时才按既有树为 `HARNESS_ERROR`。
5. 优先级：ambiguous 压过 action_failed/none；action_failed、普通 none、未知失败均压过 none+drift，防错误终判 harness；矛盾轴一律失败且消毒 intent 级假成功回读。
6. 坏输入：空数组、缺 action、非对象 action 均 fail-safe，不抛、不 PASS；函数不修改输入。
7. 裁判穿透：用临时 `axes` 文件调用确定性 `bin/verdict.mjs`，钉死 `PASS`、`HARNESS_ERROR` 与两类 `NEEDS_HUMAN` 最终四态；不让单测只停在折叠对象。
8. 回放接线：静态证明 `bin/replay.mjs` 导入并调用 `foldIntentAction(eventActions)`，且继续保留 `eventActions`；本测试不得启动回放器。
9. 安全边界：新测试不得导入 fake-SUT、固定语料服务器、Playwright 或任何网络客户端，不得打开端口，不得访问真实 `SUT`；只允许内存投影与操作系统临时目录。
10. 不变量：`bin/verdict.mjs`、`lib/report-model.mjs`、冻结 schemas 零字节改动；真机完成判据仍由独立业务 `UAT` 核销。

## 回归棘轮说明

新增 `tests/_golden/intent-event-fold.zero-sut.golden.mjs`。它是在实现提交 `3c4647c` 之后补齐的回归保护测试，冻结时应为绿；不冒充实现前红先行，也不声称满足 `ATDD` 红基线。

- 输入使用 2026-07-15 真实 cleanup 事故的脱敏事件投影：`[ambiguous, none, unique]`，不包含目标名称、地址或凭据。
- 折叠结果继续穿透既有零 `LLM` 裁判，临时文件只落操作系统临时目录。
- 静态检查回放接线，但不启动浏览器、回放器、任何服务器或网络连接。
- 旧的未跟踪 `tests/_golden/intent-event-fold.golden.mjs` 会导入 fake-SUT，禁止执行、禁止冻结、禁止提交。

## 实现切片

1. 新增 `lib/intent-action-fold.mjs`，导出纯函数 `foldIntentAction(eventActions)`。
2. `bin/replay.mjs` 每个 intent 只构造一次 `eventActions`，以纯函数产 `action`；删除“verdict 不消费本字段所以会掩盖”的失准注释。
3. 不动裁判和报告镜像；回归测试只读调用既有确定性裁判，不复制另一套裁定。

## touchesFiles

- `docs/plans/intent-event-fold/proposed/GRILL.md`
- `docs/plans/intent-event-fold/plan.md`
- `lib/intent-action-fold.mjs`
- `bin/replay.mjs`
- `tests/_golden/intent-event-fold.zero-sut.golden.mjs`
- `loop/prd-intent-event-fold.json`
- `loop/active-contract.json`

## 冻结涟漪

新 golden 只由新 PRD 冻结。PRD 的唯一自动验收命令就是 zero-SUT 回归测试，`passes` 初始化为 `false`，只能由门禁写入。既有 PRD 没有把 `bin/replay.mjs` 纳入 `testChecksums`；实现改动不要求伪重签既有测试。

## 真机 observability

本契约的 zero-SUT 绿只证明折叠内核与裁判接线，不代表业务完成。与删除域锁 P0 合流后，每条真实 case 必须在联网真实环境观察：cleanup `eventActions` 全部成功、后置目标精确数为 0、机器 verdict 全 `PASS`、录像末段和删除后截图均无目标实体；任一矛盾即停止并出 `NEEDS_HUMAN`/失败报告。
