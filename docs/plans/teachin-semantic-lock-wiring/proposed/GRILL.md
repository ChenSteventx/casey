# teachin-semantic-lock-wiring — GRILL

## 用户确认

Steven 已确认：手动示教结束后必须后处理出本次涉及的业务对象；回放前重新获取当前对象并比较，确认仍是同一对象才允许继续。后处理结果还必须与录制时对象逐项比较。允许并行开发，并要求弱 agent 场景有结构化兜底。

## 承接事实

- `teachin-semantic-lock` 已交付业务对象身份收据、候选解析、精确比较和显式身份迁移的纯函数内核。
- 本契约只冻结 `record → distill → compile → sign → replay` 接线，不重复实现同一性算法。
- 所有验收均为零 SUT 静态或纯函数测试；不得启动浏览器、网络、fake 或 fixture。

## 决策

1. `record` 只写未签的 `identity-observations.json`，其内容为闭合白名单；capture 仅引用旁车文件名、sha256 和观察数量。
2. `distill` 校验 capture 与观察旁车哈希链，输出 identity candidates 与 `pending`；候选不是权威身份，不能直通回放。
3. `compile` 以真实 events 原始字节生成 `entity-locks.draft.json`，保留 `intentId`，并把对象角色映射到 `{stepId,intentId,atom,role}`。
4. `sign` 是 `entity-locks.frozen.json` 唯一签发面；冻结锁绑定完整 `eventsSha256`、签署元数据、身份收据和全部对象角色。
5. `replay` 在启动浏览器前完成结构、events hash、签名和 binding 覆盖门；任一失败时 `allowBrowserLaunch:false`。
6. 登录后做一次 live rebind（重新读取并绑定当前对象）；每个 mutation、删除确认和关系写之前再次读取并比较，防止检查后对象被替换。
7. 关系写同时锁 source 与 target；任一不是 `SAME`，整个动作零点击。
8. 所有非 `SAME` 结果必须返回闭合 `reason + nextAction`，不得 `.first()`、`nth()`、名称单锚、猜编号或静默降级。
9. LLM/视觉只可提供 candidate 或解释差异，不得签发冻结锁、改变比较结果或参与 verdict。

## 非目标

- 不实现真实 workflow/agent adapter。
- 不运行、连接或读取任何 fake/fixture SUT。
- 不改 `verdict.mjs`，不把锁门结果翻译成 `PASS`。
- 不在本契约内做真机 UAT；真机维度显式 `route:human`。
