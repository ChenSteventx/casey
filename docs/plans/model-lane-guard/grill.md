# model-lane-guard — grill（轻车道跳过说明）

> 岔三（已锁 2026-06-29）：第二条起默认轻车道、跳 grill——在已冻内核上扩功能、无新承重决策可 grill。

本辐条只**扩不改**冻结内核，符合岔三跳 grill 条件：

- I1 静态扫 `bin/verdict.mjs` 传递依赖、断言零 LLM/网络客户端——只读，不改 `verdict.mjs` 判定树或 StepAxes 形状。
- I2 读 `loop/config.json` 断言异构不变量——只读。
- hook 接线在 `.claude/settings.json`（Casey 侧），不改 loop-kit 引擎（ADR-0001 字节一致）。

无「改冻结内核」触发点 → 不升 full，grill 按岔三跳过。决策依据见 `HANDOFF.md`「模型分层升级 + 三级兜底」（2026-07-01）。用户已于本会话直接授权本兜底优先完成。
