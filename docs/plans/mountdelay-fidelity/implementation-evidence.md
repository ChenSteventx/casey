# mountdelay-fidelity 实现证据

2026-07-20 完成最小实现：

- `lib/replay-settle.mjs` 新增 `profile.loading` 严格归一化、DOM/占位同刻快照，以及所有模式均不弱于三拍的静止窗；配置态还须连续证实占位消失，探测异常保持 unsettled。
- `bin/replay.mjs` 在浏览器启动前校验 loading 形状，并把非凭据 `profile` 传给静默点。
- `CONTEXT.md` 补齐通道剖面的 loading 配置口径。
- 未修改、未运行任何已隔离 fake-SUT 金牌或浏览器场景；未修改共享 fake-SUT、裁判、断言评估器和生命周期清单。

确定性证据：

- 新验收：`mountdelay-fidelity: 4/4 passed`。
- 既有存活单元：`replay-settle-mount unit: 9/9 passed`。
- 质量门禁：`gate: GREEN —— story 3/3 过`。
- `normalizeLoadingProfile` 正负控：缺配置、selector、text 三个正控通过；空配置、错数组、空 selector、错 text、未知字段五类反控均拒绝。
- `node --check`（两个改动模块）与 `git diff --check` 通过。

Grok R1 的两条有效 fail-safe finding 已先补 0/2 红锁再修复：配置态 number-only 结果
改为 unknown；配置态放行同样要求至少三拍。临时 Grok 审查包为通过凭据闸排除了
`CONTEXT.md`，因此其“统一语言未登记”finding 只对临时包成立；真实交付提交已包含登记。

浏览器 DOM 因果链、真实 profile 注入与 flaky 消除仍按 PRD observability 路由人，不在上述证据中冒充完成。
