# teachin-admission-side-effect-policy — plan（superseding）

> 本契约追加并取代 `teachin-semantic-lock-admission-authority` 中“由现有 `destructive`/bindings 推断只读”与“现有 bindings 集合即必需集合”的子决定。旧 plan、golden、fixture 与 PRD 保持逐字节不变。

## 1. 目标

身份准入必须先由人签冻结的 atom/action side-effect policy（原子/动作副作用策略）判定真实读写与必需对象角色，再验证 authority（授权能力）。调用者字段、当前恰好出现的 binding 或注册表历史缺省值均不能决定是否绕过身份门。

## 2. 冻结策略与默认方向

- 本契约冻结 `entity-admission-policy.frozen.json`，每项声明 `{atom,effect,requiredRoles}`；`effect` 只允许 `read`、`mutation`、`relation`。
  - **待签换签（admission-policy-facets 契约提请，`signedBy: PENDING_STEVEN`）**：该件升 `schemaVersion:2`，每项另带 `facets`（结构性变更 / 身份钉定角色 / 非实体持久副作用）并补 `unknownFacets`；`effect`/`requiredRoles`/`unknownEffect` 原封保留为派生兼容字段，本节以下条款逐条继续成立。见 `docs/plans/admission-policy-facets/plan.md` 与本 prd 的 `checksumAmendments`。
- 显式 `read` allowlist（只读允许表）才可走只读通道；未知 atom/action 一律按 mutation 阻断，不得猜只读。
- `workflow.addNode`、`workflow.setNodeField`、`workflow.setSwitch`、`workflow.addNodeInputVar`、`agent.removeToolByName` 五个真实写原子必须判 mutation。
- 调用者在 step/event 上填写 `mutation`、`destructive`、`relationWrite` 或增删 `entityBindings`，均不能改变冻结策略的 effect。
- 公共 checker（准入检查器）不得再单独接受调用者布尔 `containsEntityMutation:false` 后直接授权；必须消费同一冻结策略的闭合推导结果。

## 3. 逐 step/event 必需角色

- `requiredFlowEntityBindings` 与 `requiredEventEntityBindings` 的合法空集只代表“全部步骤均在显式 read allowlist 且无对象 binding”。
- 任一 mutation 缺 policy 规定角色、relation 缺 `source` 或 `target`、未知角色、重复角色或多余角色时，推导结果必须是 invalid（非法），不得返回可与合法 `[]` 混淆的空集/子集。
- 两个 mutation 中即使一个已锁，另一个空绑定仍须整份拒绝；不能以“全案至少一个 binding”代替逐步完整性。
- 合法 frozen binding 最终严格绑定 `{stepId,intentId,atom,role,candidateId,lockId,receiptHash}`；exact-set（严格集合）比较只能发生在 policy 完整性通过之后。

## 4. Compile → sign provenance

- compile 必须把 flow step 的 `sourceIntentId` 与 `{candidateId,role}` 逐事件保留进 events；不得在 `compileAtomStep` 解构时丢弃。
- compile 产物仍是未签 provenance（来源信息），不得自带 `lockId`/`receiptHash` 或 `replayReady:true`。
- sign 只有在确认候选并签发 receipt（收据）后，才能在 frozen binding 中补齐 `lockId + receiptHash` 并置 `replayReady:true`；缺任一字段的 frozen artifact 不能进入 replay。
- 零 SUT 门禁允许以纯 projection helper（投影函数）与静态接线证明；真实浏览器事件映射另走可观察性。

## 5. Hostile input（敌对输入）

- side-effect classifier（副作用分类器）与 binding derivation（绑定推导器）的顶层 document、steps/events 数组、step/event、entityBindings 和 binding 在读取任何属性前拒绝 Proxy（代理对象）与 accessor（访问器）。
- 拒绝过程不得触发 trap/getter；classifier 敌对输入按 mutation/fail-closed，derivation 返回明确 invalid，checker 不得把 invalid 当合法空集。

## 6. 验收点

### 可命令化

1. `teachin-admission-side-effect-policy.zero-sut.golden.mjs effects`：五写原子、显式 read allowlist、未知默认 mutation、调用者 flags 不决定、旧布尔只读旁路拒绝。
2. 同一 golden 的 `roles`：flow/events 逐步 required roles；双变更空锁、relation 单端、mutation 空/unknown/multi role 均 invalid；合法 relation 与七字段集合保留。
3. 同一 golden 的 `provenance`：纯 compile projection 保留 `sourceIntentId + candidateId/role`；未签不可 replayReady；sign 后 frozen binding 必含 `lockId + receiptHash`。
4. 同一 golden 的 `hostile`：四层 Proxy/accessor 零 trap，非法推导不等于空集且 checker fail-closed。

测试仅调用纯函数、读取冻结 JSON 与静态源码；禁止子进程、SUT、浏览器、server 和网络。

### 可观察性申报

- `route:human`：五写原子在真实 AI 中台的副作用、对象 kind 与必需 subject/source/target 角色逐项只读核对。
- `route:human`：compile 真机一对多事件时 `sourceIntentId + candidateId/role` 未丢失，sign receipt 与最终 events 同源；每用例录屏、视觉复核、独立 HTML 与附件。
- `route:human`：冻结 side-effect policy 的发布、升级、撤销与 Win PowerShell/WSL/macOS 安装边界；本轮 workspace PRD 仅作测试棘轮索引，不冒充最终发布根。

## 7. 停止条件

- 四分区在 `5d92c9f` 上均真实 RED；不得用缺未来浏览器实现替代现有攻击证据。
- 新 golden 与 policy fixture 全部进独立 PRD 的 `testChecksums`，story `passes:false`，`gate --dry` 可消费。
- 本工序不改 `lib/`、`bin/` 或任何旧 frozen，不启动 SUT、浏览器、server、网络。
