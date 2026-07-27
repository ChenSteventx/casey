# zero-shot-observe-admit-step · 学习记录

## 1. 本轮得到的可复用结论

1. authority 必须覆盖“投影出口”，不能只保护最终动作对象。`intentPlan` 如果在
   `mappingFromIntentPlan` 投影时丢失 builder authority，后续再严格也挡不住手造 ready plan。
2. freshness 不是单点检查。可靠动作边界至少需要 admission 时重验、execute 前重验，以及
   `perform` 返回后、铸 receipt 前再次确认原 observation 仍有效。
3. “一次”应绑定观察件 authority，而不是绑定某个 public artifact。否则两个并发请求可以各自铸出
   看似合法的一次性 admission。
4. exact semantic 也不能只靠手算 DOM 事实。最终动作前要让 Playwright 做 hidden-aware 全页 exact
   计数，并把 locator 命中的 `ElementHandle` 与观察期 handle 做物理同节点比较。
5. read-safe 不是由 `effect:"read"` 或用户普通布尔字段推出的。当前自动通道应是确定性窄 allowlist；
   风险或未知目标直接 `route:human`。目标级人工 authority 到位后，再扩大可执行集合。
6. popup fail-closed 与 page topology controller 是两种能力。前者只保证“不在错误页面继续”，后者才
   负责识别 active page、opener 回退、session continuity 与每页取证，不能把拒绝能力描述成接管能力。
7. public observation 是独立的 egress contract。URL 脱敏还不够，title、semantic name、percent-encoded
   pathname 与被过滤 handle 的生命周期都必须一起验证。
8. 临时模块职责不理想不等于应立刻重构。当前 `action-admission` 持有私有 capability sealing，
   在技术闭环前搬动执行和 receipt 铸造会扩大 authority 风险；先冻结能力，再按 admission/execution/
   receipt 三缝重新命名和拆分。
9. `<=600` 是本契约 touched core 的机械约束，不应把仓库历史材料、冻结数据和契约外大模块混成
   本轮失败；但全仓超限清单仍应显式留下，防止债务被遗忘。
10. zero-SUT 证明的是控制流、authority 与 fail-closed，不证明陌生真实页面可用。AI 中台频繁更新，
    因此 current build 与 version-held-out 都要测；医生站和 Hi 小助还要分别覆盖同通道跨站与
    CEF/iframe/shadow/container 差异。

## 2. 对完整 zero-shot SOP 的影响

本轮支持的顺序仍是：

```text
自然语言用例
→ 模糊处 grill
→ 冻结 intent/effect/identity/expected
→ 用原子操作 workflow 完成前置条件
→ known atom 优先
→ fresh PageObservation
→ deterministic exact
→ 确定性零命中时才允许 bounded proposal
→ admission + execute-time revalidation
→ 单动作
→ fresh readback + typed progress
→ 未签 exploration trace
→ 不确定则 route:human
→ 手动录制
→ intake/distill 为原子操作
→ 独立证明 source replay 与 distilled replay
```

手动录制不是“模型失败后的随便点击”。它必须保留前置条件、页面拓扑、身份和预期，先证明 source
recording 可以成功回放，再蒸馏；蒸馏结果还要独立回放，不能用源录制成功替代。

## 3. 下一轮优先级

公共 `PageObservation` 脱敏已经登记、重冻并通过正式 `gate`。后继顺序为：

1. 建目标级人工 confirmation authority，替换普通 `userConfirmed` 布尔值；
2. 建 entity identity 自动派生与 builder authority；
3. 接入 page topology controller，而不是继续扩张 driver 内的隐式页面选择；
4. 建 AI 中台 current/version-held-out、医生站、Hi 小助分层 UAT；
5. 主链稳定后再拆 `action-admission` / execution / receipt seam。

这些后继都不能改变裁判零 LLM：LLM 可以解析、提案和辅助蒸馏，但 PASS、`SUT_DEFECT` 与
`NEEDS_HUMAN` 仍必须来自现役确定性证据链。
