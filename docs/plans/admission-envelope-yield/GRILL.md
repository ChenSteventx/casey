# GRILL · admission-envelope-yield（证据定案，承同一已签设计）

方向零新岔口：本契约是 Steven 已签让位设计（收窄版 A + platformId 硬桥接，2026-08-07
两轮点选 + schema 人签）的**第三个消费者接线**——compile 侧基数门（terminal-coverage-yield
已收口）之后，sign 侧准入验证器 `validateObservationAdmission` 依旧不识让位。

1. **拦点实证**：十五跑真产物首次走 sign（史上第一次带让位形产物抵达该门——「从未
   走通过」家族续例），拒 `OBSERVATION_MISSING_ENVELOPE_FOR_OBLIGATION`
   （`lib/entity-observation-registry.mjs:258`，4b 反向覆盖：义务原子 `workflow.open`
   的终端在场而信封整缺）；修过 4b 后 6) 角色计数（`:310`，open 终端 0 行 ≠
   `['source']`）必然接着拦——两处同函数内检、一并接线。
2. **豁免判据（与已签设计逐字同构，四条件全与）**：终端 t 视为让位 iff ①其原子登记
   义务恰 `['source']` ②t 的 click 事件携非空 `yieldedToPlatformId`（十五跑产物实载）
   ③已过前置校验的全部观察行中**恰一条** `kind===boundKind && role==='subject' &&
   platformId===字段值` ④（4b 面）该原子**全部**终端均让位才豁免信封义务——部分让位
   部分不让 → 信封仍必需；（6 面）仅零行且让位的终端跳过角色计数，部分行在场仍拒。
3. **加法门控**：无字段输入行为逐字节同码（terminal-coverage-yield 同款纪律）；
   前置各闸（0-3、4、5、5b）零接触——让位行为只在 4b/6 两处后验环节豁免，孤儿信封、
   邪恶 issuer、五元关联、bindingMode/provenance 判据原样。
4. **非目标**：不动 compile 侧基数门（已收口）；不碰 schema（已签改版）；不改
   sign.mjs 调用面；不裁 replay 段（其 grant/authority 机制另属后续步）。
5. **十六步预期（预登记）**：本契约合入后重跑同一 sign 命令（Steven 已点签、呈件
   五断言不变），预期签署落盘新冻结件；随后 replay 链继续、任何门拒即停如实报。
