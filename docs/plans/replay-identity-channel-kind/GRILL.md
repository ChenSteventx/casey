# GRILL · replay-identity-channel-kind（Steven 裁定定案）

裁定：2026-08-08 当轮会话内点选两裁——①②通道解析取**锁行 atom 反查注册表**、
③双证消费面取**控制器覆盖步豁免**；同日 Steven 邮件裁定「继续」双重确认
（信 id `msg_59-uDO48H1U9bv-hq9iuTcQvzjgXq6BL5PXA6LEy0bmL_w`，发件地址已核验在案，
珀斯 11:09）。

1. **缝的本体**：`bin/replay.mjs:144-153` 只认 `profile.agents` 置
   `identityChannelCfg`/`identityProfileDigest`；`:294` 门要求「v2 锁携身份观察 ⇒
   `agents.listApi` 已声明」。本案（`tc_catalog_wf_crud`）锁携 workflow 观察行
   （1 行：atom=`workflow.create`、role=subject、evidenceStepId=`atstep_7`）、剖面
   声明 `workflows.listApi` → 浏览器前拒。C2 已在 compile 侧泛化
   （`bin/compile.mjs:230-255` 按 `ENTITY_KIND_COMPILE_CHANNELS` 闭集遍历 + 多 kind
   声明 fail-closed），replay 侧从未接线——「从未走通过」家族第九例。五次尝试全
   fail-closed 零启动零残留（日志 `~/casey-recovery-20260807/replay16*.log`）。

2. **勘察修正前提（两点，交接文档未载、会改契约面形状）**：
   - v2 锁行**无 kind 字段**（实测行键 name/code/platformId/sourceIntentId/
     candidateId/role/atom/evidenceStepId）——「按锁行 kind」不能字面落地，kind 须由
     行 atom 反查 `ENTITY_OBSERVATION_REGISTRY` 闭集推导（`workflow.create` 已登记，
     `lib/entity-observation-registry.mjs:48`）。
   - `identityExpectedByStep` 全仓唯一消费者是 `lib/replay-actions/agent-search.mjs:19`
     （按 `ev.stepId` 取行、仅 `agent.searchOpen` 路径触发）——「agent 专用逻辑误触
     workflow 行」结构上不发生（键是 stepId、路径有 atom 门）。真矛盾在反面：
     created-in-run 的 `workflow.create` 行，回放重建实体、平台号必新，对编译轮签的
     platformId 做点击前双证**结构上永不可能通过**；该步连续性已由 v3
     created-workflow 控制器接管。

3. **修形（两裁落地）**：
   - ①② 通道解析与数字段：锁行 atom 经注册表闭集推导 kind → 按
     `ENTITY_KIND_COMPILE_CHANNELS` 取对应剖面段（agent→`agents`、
     workflow→`workflows`）→ 用同函数 `parseAgentIdentityProfile` 解析并同源重算
     digest，与锁顶层 `identityProfileDigest` 比对（sign 侧按该段算，同源同算即
     逐字节同）。注册表外 atom、行 kind 混装（镜像 C2 单通道约束）、对应剖面段
     缺失或非法、digest 错配——一律浏览器前具名 exit 65。
   - ③ 双证消费面：`identityExpectedByStep` 构建时排除已被 created-workflow
     控制器覆盖的步（豁免判据=该行 evidenceStepId 所指事件的 intentId+atom 命中
     `createdWorkflowCovered`，是 v3 权威覆盖面、绝非标记自报）；全部行被排除则
     不建期望映射、不建身份账本。**非覆盖 workflow 行（消费面不存在）→ 具名
     fail-closed 拒**，绝不带着不可兑现的签署期望启动浏览器。agent 行既有路径
     零行为差。
   - 门序：先锁级两门（通道解析+数字段——行在即门在，不因覆盖豁免而跳过，
     剖面只是适配器、不得降级新签用例），后行级豁免排除。

4. **冻结面/零回归预期**：agent 家族既有金牌（agent-id-readback 系）零触碰绿——
   agent 单 kind 锁经注册表推导仍解析 `agents` 段、同 digest 同期望映射，字节行为
   等价。

5. **非目标**：不建 workflow 点击前双证消费面（对签语义未裁，非覆盖行 fail-closed
   停即诚实边界）；不动 compile/sign 侧；不改锁件模式（不给 v2 行补 kind 字段）；
   不碰 v3 destructiveContinuity 重建块判据与破坏性准入门。

6. **修通预期（预登记）**：合入后重跑 replay（票据 `b4replay0808b` 现役、失效
   2026-08-08T23:59:59+08:00 珀斯，过期重铸并披露）→ 相 3 真机回放首过或停于
   下一门如实报。
