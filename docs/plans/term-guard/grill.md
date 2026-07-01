# term-guard — grill（轻车道跳过说明）

> 岔三（已锁 2026-06-29）：第二条起默认轻车道、跳 grill——已冻内核上扩功能、无新承重决策可 grill。

本契约只扩不改冻结内核，符合岔三跳 grill 条件：

- 钩子甲 / 乙落 Casey 侧 `bin/` + `.claude/settings.json`，不改 `loop-kit` 引擎（ADR-0001 字节一致）、不改 `verdict.mjs` 判定树或 StepAxes 形状。
- 只作用于开发输出/文档；产品侧质量接口的同款过滤非本契约。

无「改冻结内核」触发点 → 不升 full。用户本会话已确认「先暂停 model-lane-guard 转这个」，并同意统一语言口径（DDD 作用于开发输出/文档；产品侧过滤走质量接口、唯一硬不变量是不进 `verdict.mjs`）。
