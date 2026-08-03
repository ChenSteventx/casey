# GRILL — teachin-cycle-axes-step-set

> 触发：2026-08-03 真机两击已经唯一定位到
> `RAW_AXES_PROJECTION_FAILED`。本契约继续追到生产接缝的确定根因并修复，
> 不把诊断成功冒充闭环成功。

## D0 已证事实

- `raw-axes-adapter.mjs` 的 `buildAxesInput` 把 `allStepIds` 建成数组并调用
  `.push()`；共享生产投影器 `projectReplayAxes` 把同一字段当 `Set` 调
  `.has()`。
- 真机网络记录非空时同步抛出 `TypeError`，被既有 fail-closed 分支归为
  `RAW_AXES_PROJECTION_FAILED`，裁判尚未执行。
- 既有 zero-SUT 金牌使用投影器替身或空网络记录，未穿过这条生产接缝。

## D1 修复边界

只修 producer：`allStepIds: new Set()`，逐步登记由 `.push()` 改 `.add()`。
不放宽共享投影器兼容数组，不改裁判、断言语义、authority、返回形状或拒付码。

## D2 验收与冻结

扩现有 owner 金牌
`tests/_golden/teachin-replayability-raw-axes-adapter.zero-sut.golden.mjs`：
用真实 `projectReplayAxes` 和至少一条带 `firingStepId` 的合成网络记录驱 adapter，
实现前必须稳定得到 `RAW_AXES_PROJECTION_FAILED`；实现后必须投影成功、裁判恰调用
一次、网络记录归因到代表步。另加 producer 传入值确为 `Set` 的断言。

冻结 owner 是 `loop/prd-teachin-replayability-closure.json`。修改既有冻结金牌须
checksum amendment 与 Steven 人签；`passes` 只由 gate 写。

## D3 非目标与完成判据

- 不修 chief 流式成员、mutation 清理链或 P9 文档冲突；它们分契约并行。
- 不运行 fake SUT；验收为纯内存/静态生产接缝。
- 本契约完成需红→绿、owner 与邻接 gate 绿、异构实现评审通过。
- P9 技术闭环还须在最终码上重跑真机两击并得到 cycle exit 0；若推进到新的具名
  拒付，继续按新事实另立窄契约，绝不宣布完成。

## D4 风险

- 合成记录若没有进入 orphan/归因过滤，可能重现不了 `.has()`；测试必须验证网络
  记录确实出现在 axes。
- 只断言 `instanceof Set` 容易变成结构绿；必须同时驱 canonical projector。
- 真机复跑需继续遵守同账户串行、隧道双端就绪与真实目标纪律。
