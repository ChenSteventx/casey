# plan · entity-identity-spine（C0，串行核地基）

> 母规格 `docs/plans/entity-identity-lastmile/plan.md`（三方共识全景）。本文是 C0 的可执行计划与验收点。
> 车道 full。承重文件 `bin/sign.mjs`、`bin/compile.mjs`、`lib/entity-semantic-lock-preflight.mjs`（channel/observer 注入面）；`lib/compile-atoms.mjs` 仅在武装点涉及、agent 分支逐字不动。

## 业务目标（说人话）

今天「读回真实平台 ID 并喂进身份门」这套机器只对智能体（agent）开了口子，而且是**写死 agent-only**（`bin/sign.mjs:247` 常量 `agent.searchOpen`、`:275-276` 硬校验 `kind==='agent'`）。要让工作流（workflow）等其它对象也能走同一套「读回→签署→回放对签」，必须先把这条硬钉的独木桥**泛化成一张按对象种类查的闭集注册表**——但泛化的当下，智能体那条既有路径必须**一个字节都不变**（它已真机过闸）。C0 只做这层地基泛化，不加任何新对象能力（workflow 读回留给 C2）。

## 逻辑描述

- 现状：`bin/sign.mjs` 把「哪个原子产身份观察行、观察行必须是什么 kind」写死成 agent；`bin/compile.mjs:236-266` 只从 `profile.agents.listApi` 注入 ledger。
- 目标：抽出一张**闭集注册表**，键=`action policy` 声明的原子，值=`{required role → bound kind/provenance → 允许的 observation issuer/atom}`。签署时按注册表校验观察行的**角色、数量、来源、关联 ID 恰好匹配**；不匹配一律 fail-closed 拒（exit 65）。agent 的既有条目在注册表里等价于今天的硬钉语义——故 agent 行为逐字不变。
- 不做：不注册 workflow（C2）、不碰 v2 形式收据链、不加编译器、不改裁定四态。

## 验收点（acceptance，红先行）

1. **闭集准入金牌（zero-SUT）**：一条金牌钉住 8 条准入反例，签署注册表对每条 fail-closed：
   - 伪造 `kind` 与 policy 声明角色不符的观察行 → 拒；
   - 角色数量不匹配（少/多于 requiredRoles）→ 拒；
   - observation 来源（issuer/atom）不在该原子允许集 → 拒；
   - 关联 ID（步序/intentId/stepId）与事件流不对应 → 拒；
   - provenance 缺失或与 bindingMode 不符（existing 须 user-approval、created-in-run 须 platform-readback）→ 拒；
   - 数量恰好但 kind 越界 → 拒；
   - 合法 agent 观察行（今天能过的）→ **仍过**（回归保护）；
   - 无编译器的孤儿策略原子（`agent.removeToolByName`）不被索要 observation → 不误拒。
   红先行判据：泛化落地前，注册表尚不存在，金牌应 RED（当前 agent-only 硬钉无法表达闭集语义）。
2. **agent 行为逐字不变**：`agent-id-readback` 全套金牌复跑字节零漂移——`agent-id-readback.chat-sut.golden.mjs`（C1-C10）、四条 zero-sut（observation/gate/sign-observation/regression-diff）、`entity-ui-wiring.searchopen.golden.mjs`。任一字节漂移即 C0 失败。
3. **不破邻接冻结面**：`prd-agent-id-readback`、`prd-entity-ui-wiring` 相关金牌复跑全绿；`entity-semantic-lock-v2.mjs` 字节仍是 `b7b5a47e`；0/26 红且拒绝原因不漂。

## 交付物

- 红先行金牌（zero-SUT，闭集准入 8 反例）冻结进 `loop/prd-entity-identity-spine.json` testChecksums。
- 实现：`bin/sign.mjs` + `bin/compile.mjs` + `lib/entity-semantic-lock-preflight.mjs` 泛化，agent 分支等价保序。
- 异构评审（codex/pi/grok）+ learn。

## 边界与挂账

- workflow 读回能力=C2，不在 C0。
- 完成语义：C0 hermetic 绿=地基逻辑与 agent 保序已证，**非需求完成**；实机为准（ADR-0009）。
