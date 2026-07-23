# plan · entity-destructive-continuity-guard（C3）

> 母规格 `docs/plans/entity-identity-lastmile/plan.md` §3（C3 六条）/§5。车道 full。依赖 C0 注册表 + C2 的 observation 契约（集成次序：compile-atoms/replay-actions 在 C2/C3 间不同函数，调和于集成）。
> 承重文件：`lib/compile-atoms.mjs`（delete/add-tool，与 C2 create/open 不同函数）、`bin/replay.mjs`（出站拦截+归零，与 C1 v1 处理不同区段）、side-effect policy。

## 业务目标（说人话）
删除、更新、加工具这些破坏性操作，今天只靠「按名/计数 + 因果弹层」定位，不绑身份——同名在场就可能删错对象。C3 加一道**运行时目标连续性守卫**:动作携带创建/首读时那条身份观察的引用，破坏性请求真正发出前核对请求里的平台 ID 与引用一致才放行，收尾按同一 ID 确认归零。这不是「消费同一份形式收据」（那要唤醒被封死的内核，本轮做不到），是防误删的连续性保护，报告如实标注强度边界。

## 验收点（acceptance，红先行）
1. **不可覆盖 observation + ref**：创建/首读后生成不可覆盖 observation（绑完整五元+profile 指纹+scope+请求关联+步序）；后续破坏性动作**携带该 ref**，而非再按名生成新预期值。
2. **出站请求前置核对**：拦截暂停 delete/update/add-tool 的 mutation 请求，**放行前核对请求 URL/body 里的 platformId** 与 ref 一致，不同则中止并证明 SUT 未改（红先行：今日只按名/计数，不核出站 ID）。
3. **删前完整可证明扫描**：坏候选/分页不全/相关响应不可关联 → `NEEDS_HUMAN`。
4. **无可验出站 ID → route:human**：mutation 请求本身无可验证 ID 且 DOM 无 ID → 结构上不能安全自动化 → route:human（fail-closed 金牌）。
5. **按 target-ID 归零**：收尾走 target-ID 稳定窗口 absence-proof，非 name count===0。
6. **孤儿策略项不误拒**：`agent.removeToolByName`（有 policy 无编译器）不被索要 observation。
7. **限 targeting/破坏性原子**：统一 side-effect policy 只对 delete/add-tool 等 targeting 原子强制 ref，**不全量翻** create/addNode/setNodeField。
8. **毒化 + 邻接保绿**：delete/add-tool 毒化（同名不得取 first）；v2 sha `b7b5a47e` 未动；不破既有 delete 相关金牌（因果弹层绑定等）。

## 交付物
红先行拦截/fail-closed/归零/毒化金牌冻进 `loop/prd-entity-destructive-continuity-guard.json`；实现连续性守卫（compile-atoms 武装 ref + replay 出站拦截 + 归零按 ID）；异构评审+learn。

## 边界与挂账
「消费同一份形式收据」形式义务 = 唤醒子系统 A（kernel 设计门+Steven 人签），本轮结构性关不掉，报告拆开写。真删/改请求是否携带可验 ID、真机破坏性 UAT = route:human。完成语义：hermetic 绿非完成，实机为准（ADR-0009）。
