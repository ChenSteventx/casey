# plan · entity-workflow-source-readback（C2）

> 母规格 `docs/plans/entity-identity-lastmile/plan.md` §3/§5。车道 full。依赖 C0 注册表。
> 承重文件：`lib/entity-observation-registry.mjs`（加 workflow 条目=数据）、`bin/compile.mjs`（workflows.listApi 注入，与 C1 同区→集成调和）、`lib/compile-atoms.mjs`（workflow create/open 武装，与 C3 不同函数）。

## 业务目标（说人话）
工作流对象也要「名称+编号/ID 联合定位」，且工作流绑智能体时 source（工作流）与 target（智能体）**两边各自独立锁定**。今天读回真实平台 ID 只对智能体开了口子；C2 把这套对称地给工作流 source 侧——注册工作流为可读回种类、从工作流列表接口信封读回其 ID、创建后按平台读回取 ID。

## 验收点（acceptance，红先行）
1. **注册 workflow kind**：`ENTITY_OBSERVATION_REGISTRY` 加 workflow 相关条目（数据驱动，C0 已备形状）；`ENTITY_KIND_COMPILE_CHANNELS` 加 `workflow→{profileKey:'workflows'}`。
2. **workflows.listApi 注入**：`bin/compile.mjs` 按注册表遍历时，workflow 通道从 `profile.workflows.listApi` 注入 ledger（镜像 agents.listApi）；声明不全 fail-closed exit 65。
3. **compileWorkflowCreate/Open 武装 source 读回**：创建/打开工作流后武装 `pendingIdentityObservation`（source 侧，created-in-run→platform-readback）；join 到 source binding。
4. **sign 白名单泛化落地（闭集）**：workflow source 观察行经注册表校验通过；伪造 `kind:'workflow'` 但角色/来源/关联/provenance 不匹配 → fail-closed 拒（红先行：C0 注册表已拒 workflow，因未注册；C2 注册后合法过、伪造仍拒）。
5. **workflow-list hermetic fixture**：仿 chat-sut 的 workflow listApi 信封 fixture（回 19 位纯数字 workflow ID、DOM 卡）。
6. **workflow 毒化 + 完备性金牌**：重复同名工作流不得取 first；`total>records.length`/cursor 未尽/错 scope 不得证 SAME/absent。
7. **双锁邻接保绿/amend**：`entity-ui-wiring.bindagent-lockchain`/`bindagent-replay` 复跑；C2 武装 source 读回后若行为变 → checksumAmendments 重签（既有 codex 四轮 PASS 冻结，改动须复评审）。v2 sha `b7b5a47e` 未动。

## 交付物
红先行 workflow 读回/闭集/毒化/完备性金牌 + fixture 冻进 `loop/prd-entity-workflow-source-readback.json`；实现注册表 workflow 条目+compile 通道+create/open 武装+sign 泛化落地；异构评审+learn。

## 边界与挂账
真 `recordsPath`/`totalPath`、抽屉真实类名、source/target 双锁真机 UAT、同名敌意真机 = route:human（先采不猜）。完成语义：hermetic 绿非完成，实机为准（ADR-0009）。
