# GRILL · terminal-coverage-yield（终裁定案，Steven 三点裁定驱动）

裁定链：十四跑单焦点真证（出处链闸真机转绿、剩余红恰基数门一道）→ Steven 终裁
**收窄版 A**（基数门学让位，原 C 案例拆分作废）→ 豁免判据裁 **platformId 硬桥接**
（目标名桥接方案被否）→ M1 schema 挂账按原裁定与本契约**同车处置、一次人签**。

1. **要解的红是什么？** 十四跑（`b4r140807l`）唯一拒因：`workflow.open` 的终端 click
   因观察让位（wf-open-observation-yield 契约，Steven 甲案）不再归档 source 行，
   `checkIdentityObservationCardinality` 反向基数按「恰 requiredRoles 数量」判 0≠1 必拒
   `OBSERVATION_TERMINAL_WITHOUT_MATCHING_OBSERVATION`。两份已裁语义打架：让位（流层）
   vs 注册表无条件 source 义务（成品层）。
2. **为什么 platformId 硬桥接而非目标名桥接？** 让位行从未归档、成品层无其 platformId
   可比——目标名桥接是门内纯重推导但身份锚弱（Steven 否）。硬桥接：让位发生时门内
   已解析的身份（读回门 `resolveDualIdentity` unique 行的 `matched.platformId`）如实
   记进 open 终端 click 事件字段 `yieldedToPlatformId`。该字段是**取证记录不是豁免
   宣告**：字段单独存在绝不豁免，成品门仍自行重推导匹配条件；伪造字段而无匹配行
   照拒。信任模型与既有一致（compile 是观察行本身的可信产方）。
3. **豁免判据（成品门内重推导，四条件全与才豁免）**：①终端 click 观察计数恰为 0
   （「多」永不豁免）；②该原子登记义务恰为 `['source']`（读回义务才可让；subject
   所有权义务绝不豁免）；③click 携非空 `yieldedToPlatformId`；④同产品观察集内**恰一条**
   行满足 `kind === entry.boundKind && role === 'subject' && platformId === 该值`
   ——零条或多条均不豁免（fail-closed，与 C3「同名多条不取 first」同口径）。
4. **schema 同车改版（M1 兑现）**：`events.schema.json` 系 `additionalProperties:false`
   且 `intentId` pattern `^intent_[0-9]+$`——本契约一次改版：pattern 放宽为
   `^intent_[A-Za-z0-9_]+$`（覆盖 authored 号、保 `intent_` 前缀机器可查）+ 事件对象
   新增可选属性 `yieldedToPlatformId`（非空 string）。checksumAmendment + Steven 一次
   人签（其 M1 裁定原文即「十四跑后与基数门修向统一处置、一次人签」）。
5. **改动面**：`lib/entity-observation-registry.mjs`（冻结纯函数反向基数循环加豁免分支，
   加法门控——无新字段的一切既有输入行为逐字节不变）；`lib/compile-atoms-workflow-nav.mjs`
   让位分支（`:186-193`）加盖事件字段；`tests/_golden/schemas/events.schema.json` 改版。
6. **冻结金牌风险面**：`cardinality-reverse` 金牌夹具无新字段 → 行为不变预期绿；
   `wf-open-observation-yield` 金牌若钉了让位场景事件形状可能红 → 走改版举证、与
   schema 同签。全仓扫描单侧串行（本日新纪律）终判。
7. **十五跑预期（预登记）**：exit 0、产全绿成功件（events/observed/draft）——B 段首例
   `tc_catalog_wf_crud` 史上首次全链产件。任何红即停不连跑。
8. **非目标**：不动 H1i/出处链闸/C3 守卫字节；不碰 open 让位判据本体（只加盖字段）；
   不裁后两例处置。
