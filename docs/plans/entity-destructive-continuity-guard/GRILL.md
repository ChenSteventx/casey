# GRILL · entity-destructive-continuity-guard（C3）

> 三方规划已拷问。母规格 `docs/plans/entity-identity-lastmile/plan.md`。依赖 C0 注册表（55a3bc4）。

## 决策树（已清空）

- **D1 这是「消费同一份形式收据」吗?** 否（codex Q1，实质未共识点已收敛为措辞）。只比 SAME platformId ≠ 消费形式收据（差签发根/授权/provenance/联合五元/TOCTOU 五层）。**C3 是「运行时目标连续性守卫」**，用 `identityObservationRef` **非** receiptHash。「消费同一份形式收据」形式义务本轮**结构性关不掉**（要唤醒被封死的子系统 A）。报告拆开写两种能力，绝不用 C 冒充 A 强度。
- **D2 只做 delete 吗?** 否（codex Q5①）。需求含 update/add-tool；由**统一 side-effect policy 驱动**「破坏性/targeting 原子必须有对应角色 identity observation」——但**限 targeting/破坏性原子**（delete×2 + add-tool 选择），**不全量翻**（全量会炸掉 create/addNode/setNodeField 全部创建修改流，血溅面过大——opus 裁剪）。
- **D3 只看 mutation response 够吗?** 不够（codex Q1④）。必须**拦截暂停 delete/update/add-tool 的 mutation 请求，放行前核对请求 URL/body 里的 platformId**，不同则中止并证明 SUT 未改。只看 response 太晚。
- **D4 孤儿策略项?**（opus 补洞）`agent.removeToolByName` 有 policy 无编译器。策略驱动逻辑**不得假设每个 policy 键都有编译器**，遇无编译器原子不索要 observation。
- **D5 无可验出站 ID?**（codex Q1⑤）若 mutation 请求本身无可验证 ID 且 DOM 无 ID → 结构上不能安全自动化 → route:human。
- **D6 归零?** 收尾按 target-ID 稳定窗口 absence-proof，非 name count===0（codex Q1⑥）。

## 半硬确认
Steven 2026-07-23 确认「C3=连续性守卫非收据消费」措辞、范围限 targeting、回「同意」；grill 用户确认成立。
