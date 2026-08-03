# plan — teachin-authoring-runtime-profile

## 目标

让 teach-in authoring compile 消费与 source plan 摘要绑定的同一份 channel profile，
并只从 execution-target authority 恢复 runtime/base URL；同时封住工作流列表后置锚
缺席的假成功。

## 生产改动

1. `cycle-plan-generator` 的 same-capture input 私有携带 exact
   `channelProfileBytes`；legacy plan 无 bytes 时保持兼容。
2. `source-plan-authority` 在铸 authority 前验证
   `digest(channelProfileBytes) === channelProfileDigest` 并复制 bytes；source semantic
   completion 将其绑定进一次性 authoring baseline grant。
3. authoring runtime seam 消费 grant 后只向 trusted compile adapter 交 exact profile
   bytes；adapter 解析为闭合 record，并把 profile/routes 交 `createCompileRun`。
4. `createCompileRun` 在 authority 已给、runtime 缺席时用
   `projectExecutionTargetRuntime(authority)` 恢复 runtime；`sut/ctx.baseUrl` 也从同一
   runtime 派生，caller 值不得覆盖 authority。
5. `compileNavWorkflowManagement` 的列表锚缺席/采样失败写 blocker；compile runtime
   发现 blocker 或非 unique/未 acted 时拒绝发布 candidate。

## 验收

- A1 genuine authority 单事实源恢复 runtime 与 base URL；clone/非法 authority 不另铸。
- A2 exact profile route 从 trusted authoring runtime 输入贯穿到
  `createCompileRun × compileFlow`；不同于默认路由。
- A3 same-capture input 保留 exact profile bytes，source plan 摘要不匹配在动作前拒绝。
- A4 列表锚缺席产生 blocker，成功锚才允许 authoring candidate。
- 相关 owner/邻接/P9/Tier-1、drift 与术语检查全绿。
- Grok 或 pi.dev 以内联完整仓库上下文评审实现。
- 主线最终真实两击 cycle exit 0。

## 人工观察

真机路由 HTTP 状态和最终 cycle 退出码属于 route:human 旁证；机器不得把零 SUT
金牌替代真机闭环，也不得代签任何 `PENDING_STEVEN`。
