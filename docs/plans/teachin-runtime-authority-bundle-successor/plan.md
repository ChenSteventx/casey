# teachin-runtime-authority-bundle-successor — plan（full）

> 本契约接续 `teachin-runtime-readiness-successor`，修复其异构审查确认的两项 `HIGH`。旧 plan、golden、fixture 与 PRD 保持逐字节不变；新门禁使用临时隔离模块安装测试 bundle，production 注册表继续为空。

## 1. 已核事实

1. 当前 `readEntityRuntimeReadiness` 分别把“存在一个函数形状的 driver（驱动）”“存在一个可读 JSON object 的 runtime publication（运行发布）”“存在一个函数形状的 issuer（签发者）”归约成四个独立布尔值。互不相关或不可执行的根仍可拼出 `available:true`。
2. 当前运行上下文只记 `issuerId`，adapter 只记 `adapterId`，lock authority、verified handle 与 runtime capability 之间没有共同 `rootId/contractId`。来自不同根的 issuer、driver 与 publication 可形成笛卡尔组合，且框架不能在 driver 执行前证明同源。
3. `closedObject` 虽不执行普通 accessor，却会对调用者 `Proxy` 执行 `getPrototypeOf`、`ownKeys` 与 `getOwnPropertyDescriptor` traps。旧测试只安装 `get` trap，未覆盖真实反射路径。
4. production 的 driver、issuer 与 publication 表当前全部为空；当前可诚实证明的是 `route:'human'` 的故障关闭，不能用测试函数补生产正向根。

## 2. 目标

### 2.1 单一同根运行权威组

- 一个候选组必须固定同一组 `rootId`、`contractId`、`adapterId`、`issuerId`，并同时绑定一个 module-private（模块私有）driver、issuer 与 runtime publication。
- runtime publication 必须声明相同标识符，包含非空 lock resources、动作身份 policy 与摘要冻结的 health proof（健康自检凭据）。
- health proof 必须绑定组标识、driver/issuer 实现摘要、一个具体 `lockSetKey`、case、events 摘要、lock 摘要及 policy 摘要。就绪检查读取冻结字节后真实执行 `parseEventsDocument → parseLockSet → parseActionPolicyDocument → verifyRequiredActionRoles`；`{}` 或仅“是 JSON object”不得通过。
- 不执行 driver/issuer 做在线探测。候选存在但冻结自检凭据缺失、失配或完整结构验证失败时状态为 `published`、`available:false`；只有冻结自检凭据全部自守通过时为 `verified-ready`、`available:true`。空 production 表保持 `unpublished`、`route:'human'`。
- 公共纯决策器只归一化一个同根候选的单一状态，不再接收四个独立布尔根；production 查询只消费模块内候选。

### 2.2 同根能力传播与前置拒绝

- `RUN_CONTEXT_STATE`、`RUNTIME_ADAPTER_STATE`、`LOCK_AUTHORITY_STATE`、`HANDLE_STATE` 与 `RUNTIME_CAPABILITY_STATE` 全部携带同一 `rootId/contractId`。
- adapter 与 run context 不同根或不同 contract 时，`readEntityRuntimeCapability` 在调用 driver 前返回稳定的 `ENTITY_RUNTIME_AUTHORITY_ROOT_MISMATCH`。
- runtime capability 与 verified handle 不同根或不同 contract 时，`evaluateEntityAction` 与 `createRunSuccessorProof` 在 `allowAction:true` 或 successor 处理前以同一稳定原因拒绝。
- 同根固定语料必须仍能建立 authority、runtime-authorized handle、adapter、run context 与 capability，并得到一次真实 `SAME`；这只是纯模块测试 bundle，不代表真实 SUT 完成。

### 2.3 Proxy 与隔离边界

- `closedObject` 家族在任何对象反射前用 `node:util/types.isProxy` 拒绝 Proxy；公开纯决策器、adapter 创建和 issuer 签发入口的所有 Proxy traps 均零执行。
- 普通 accessor 通过 descriptor（描述符）识别并拒绝，getter 零执行。
- 新 golden 只在 `mkdtemp` 根复制 `lib/`、安装 release resources 与测试 bundle；production 源文件、发布表及注册表逐字节不改，结束后清理临时根。

## 3. 验收点

### 可命令化

1. `bundle-readiness`：production 空表明确 `unpublished/route:human`；隔离同根 bundle 带完整冻结 health proof 时为 `verified-ready/available:true`；`{}` lock、永远抛错 driver、返回非法值 issuer 与 proof/实现摘要不一致时只能 `published/available:false`；公共纯决策器不再接受四布尔拼根。
2. `root-coherence`：同根 authority→handle→adapter→run context→capability 得到 `SAME`；adapter/run context 跨根组合在 driver 计数增加前拒绝；capability/handle 跨根组合在 `allowAction:true` 与 successor 前拒绝；错误 contract 选择不能取得 adapter 或 run context。
3. `proxy-and-regression`：Proxy 的四类 traps 与普通 getter 均零执行并拒绝；production 表静态无测试路径；既有 successor 的 historical handle 降权与四组角色负向金牌继续通过。

### 可观察性申报

- `route:human`：真实 driver 与 issuer 的发布流程生成 health proof、实现摘要、签署/保管边界及撤销机制；本轮零 SUT 门禁只验证冻结凭据消费，不代替真实发布仪式。
- `route:human`：真实 SUT 同次运行内用同根 driver/issuer/publication 得到 `SAME` 和同源 successor，并附录屏、视觉复核、独立 HTML 与附件。
- `route:human`：旧 `teachin-runtime-readiness-successor` 的 `readiness-roots` 四布尔纯决策器断言被本契约取代，旧 frozen 不修改；其 `historical-and-roles` 部分继续由新 PRD 作为回归保护执行。旧 `teachin-semantic-lock-runtime-authority` 的 `3/9` 结构性红仍待独立迁移或退役。

## 4. 非目标与停止条件

- 不向 production 注册表加入测试 bundle、测试 driver、测试 issuer、测试 publication 或测试固定语料。
- 不启动或连接 SUT、假 SUT、浏览器、服务或网络；只执行静态、纯函数、文件摘要与临时隔离模块金牌。
- 不修改任何既有 frozen 测试、fixture 或 PRD。新验收实现前必须真实 RED；冻结后实现者只读，PRD 的 `passes/evidence` 只允许 gate 回写。
- 不把冻结 health proof 描述成在线存活探测；运行时环境漂移、撤销与真实发布生命周期继续 `route:human`。
