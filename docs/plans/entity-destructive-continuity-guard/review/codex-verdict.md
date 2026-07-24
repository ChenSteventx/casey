# codex 异构评审记账 — entity-destructive-continuity-guard（C3）

评审家族：codex gpt-5.6-sol（read-only 暴露真 worktree），异构核验 Claude 实现。最深的契约，六轮收敛。

## 逐轮结论（每轮 codex 逮出破坏性目标连续性安全面的真一块）

- R1（round-1）FAIL：拦截死接线 + 缺 ref 放行 fail-open（digest 恒 null→ref 从未铸、replay 按错 stepId 查、wiring seam-mock 假闭合、按名取 first、abort 误报 SUT_DEFECT）。
- R2（round-2）FAIL：核心 v2 缺 ref→fail-CLOSED 门位置对，但 5 洞（v1 旁路、真破坏原子错位、per-intent 非 per-step、unroute 生命周期、abort 漏 pageerror）。
- R3（round-3）FAIL：五洞收（v1 破坏 fail-closed、per-step ref、取 first 已修），但逮出编译期破坏 fail-open（守卫只在 replay，compile 也真执行破坏却无守卫）。
- R5（round-5，7fcde53）FAIL：编译期 channel-less 破坏 fail-closed 半边已关（静态确认门在 chromium.launch 前），p3-compile 重表达判合法（非不通过原因），但逮出跨 kind 绕过（同名 agent 观察给 workflow.deleteByName 铸 ref）+ PRD 过度归因（ref 铸了没被消费、真核需 page.route）。
- R6（round-6，991d581）**PASS**：跨 kind 绕过封口（selectObservationForDestructiveTarget 加 boundKind 硬闸、kind 不符 OBSERVATION_SELECT_NO_MATCHING_KIND、生产恒传 boundKind）+ 半闭口径订正。crosskind 8/8、zero-SUT 25/25，Critical/High/Medium 全无。

## 收敛态（hermetic，全 fail-CLOSED）

replay 期缺 ref→拒执行破坏、按 ref 唯一命中不取 first、abort 因果排除（真 SUT pageerror 仍背书 SUT_DEFECT）、mutation pattern 缺失 fail-closed 不兜 **/*、guardTeardown 移进 finally、v1 破坏拒、编译期破坏两 fail-open 半边（channel-less + 跨 kind）均 fail-closed 关死。gate GREEN 8/8，v2 sha b7b5a47e 未动，NUL=0。

## 编译期 Critical = 半闭（诚实口径，非 over-claim）

- fail-open 半边（channel-less 破坏放行、跨 kind 误铸 ref）→ 已 fail-CLOSED 关死（hermetic 可证）。
- ref 消费 / 出站 platformId 核验半边（合法真删 proceed 的目标核对：铸的 ref 被出站 mutation 请求消费、核对 platformId 一致才放行）→ 本质需真机 page.route 出站拦截 + live 读回，route:human 未闭。

## 残留 route:human

- ref 消费半边（合法真删 proceed）：需真机 page.route + workflow 身份采集通道（C2，workflow kind identityObservation 尚未接线）。
- 真机 page.route 出站拦截真时序正确性；真机破坏性 UAT（delete/update/add-tool 每例过完成闸，ADR-0009）。
- agent.confirmToolPicker 真机 agent platformId 取目标（params 空、当前恒 fail-closed 拒）、removeToolByName 入集须冻结金牌再签。
