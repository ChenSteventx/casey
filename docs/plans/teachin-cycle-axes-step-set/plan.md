# plan — teachin-cycle-axes-step-set

## 1. 目标

修复 source resolved completion 到共享 axes projector 的 `allStepIds` 容器协议
失配，使含真实网络记录的 canonical raw-axes 路径越过投影并进入冻结裁判。

## 2. 生产改动

在 `lib/teachin/raw-axes-adapter.mjs` 的 `buildAxesInput` 内只改两处：

1. `allStepIds` 从数组改成 `Set`；
2. 逐事件登记从 `.push(stepId)` 改成 `.add(stepId)`。

明确不改 `lib/replay-axes.mjs`、`bin/verdict.mjs`、拒付码、authority 与任何
浏览器/SUT 行为。

## 3. 可执行验收

### A1 新功能红→绿

扩 `tests/_golden/teachin-replayability-raw-axes-adapter.zero-sut.golden.mjs`，
以真实 `projectReplayAxes` 驱 adapter，并提交一条已归属业务步的合成网络记录。
断言：

- producer 交给 projector 的 `allStepIds` 是 `Set`；
- 网络记录在 axes 中恰归因到代表步；
- frozen verdict adapter 恰调用一次；
- adapter 返回 `ok:true`，而不是 `RAW_AXES_PROJECTION_FAILED`。

实现前运行必须 exit 1，并保存红基线；实现后 exit 0。

### A2 回归面

- raw-axes owner 金牌全绿；
- `teachin-cycle-evidence`、`teachin-replayability-adjacent`、
  `teachin-raw-actionability` 与 P9 tier-2 zero-SUT 金牌全绿；
- owner gate、cycle-evidence owner gate 与 P9 owner gate 全绿；
- tier1、术语检查、全仓 checksum drift 扫描零回归。

### A3 真机（route:human）

在上述代码、冻结、评审全部完成后，按同账户串行纪律重跑
`tc_wf_list_smoke` 两击 cycle。完成条件是 cycle 本身 exit 0 并有同次边车/产物；
仅越过 `RAW_AXES_PROJECTION_FAILED` 但出现后继拒付，记为新诊断事实而非通过。

### A4 人签（route:human）

Steven 对 owner 金牌 checksum amendment 明签；签前不得把本契约或 P9 标完成。

## 4. 评审

计划与实现均交 Grok 或 pi.dev（DeepSeek V4 Flash）以内联、完整仓上下文评审。
实现评审重点：生产接缝是否真实越过、测试是否避免空 records 假绿、修复是否保持
裁判与返回协议零行为扩张。
