# teachin-runtime-authority-bundle-successor — GRILL

> 用户已于 2026-07-17 明确授权本轮 successor（后继契约）按以下边界直接冻结门禁并实现；无待选产品分岔。

1. 运行期就绪不再由四个互不相关的布尔值拼接。一个候选必须同时固定 `rootId`、`contractId`、`adapterId` 与 `issuerId`，并把同一运行发布、驱动和运行上下文签发者收束到同一组内。
2. `available:true` 只属于带摘要冻结自检凭据、且至少一个 lock resource（锁资源）连同 events（事件）与动作身份 policy（策略）通过完整结构验证的同根候选。任意 JSON object（对象）、永远抛错的驱动或返回非法值的签发者均不得只凭“有函数”冒充可用。
3. 若不允许就绪查询执行有副作用的驱动或签发者，则状态明确区分 `published`（已发布但未验证）与 `verified-ready`（由冻结自检凭据背书的已验证就绪）；只有后者 `available:true`。
4. adapter（适配器）、run context（运行上下文）、lock authority（锁权威）、verified handle（已验证句柄）与 runtime capability（运行能力）的模块内状态都携带同一 `rootId/contractId`；跨根笛卡尔组合必须在驱动执行或 `allowAction:true` 前拒绝。
5. 所有公开入口的普通对象快照先用 `node:util/types.isProxy` 拒绝 `Proxy`，不得触发 `getPrototypeOf`、`ownKeys`、`getOwnPropertyDescriptor` 或 `get` trap（陷阱函数）；accessor（取值器）同样零执行并拒绝。
6. production（生产）注册表保持为空，测试 bundle（运行权威测试组）只安装在 `mkdtemp` 临时隔离副本；不接触 SUT、假 SUT、浏览器、服务或网络。
7. 既有 frozen（冻结）测试与 fixture（固定语料）逐字节不改；旧 readiness 四布尔纯决策器检查因契约被取代而如实记录，historical 降权与角色负向继续作为回归保护执行。
