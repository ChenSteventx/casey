# Claude Code fable xhigh 实现评审 r1（2026-07-15）

结论：核心 PASS、无 HIGH、3 MEDIUM。三项全部采信并修复：

1. 矛盾失败轴若仍携 `identityReadback.ok:true`，既有 verdict 会先按成功回读判真，可能再度 PASS。修为 intent 级失败 action 消毒成功位为 false；原始 evidence 留在 `eventActions`；新增折叠→verdict 集成钉。
2. 多个 `none` 中若首个带 drift、后一个普通 miss，旧折叠会错终判 `HARNESS_ERROR`。修为普通 miss/未知失败优先于 drift miss，只有所有 miss 均被正向 drift 解释时才允许 harness 终判；新增正反 verdict 集成钉。
3. 尾随 `{kind:'none'}` 会覆盖最后真实动作证据。修为纯断言中性且不占真实 representative；只有全纯断言才返回 kind none；U2 改为尾随纯断言反例。

评审残余：必须与 `workflow.deleteByName` P0 合流后串行重跑三条真机清理链；hermetic 不替代真机结论。

## fable xhigh r2 复审追加处置

r2 确认上面三项均已成立，另报 1 MEDIUM：矛盾失败轴若残留 `kind:'none'`，verdict 会在读取 resolution 前直接当成功。采信：`failedAction` 与 `copyFailedAction` 对失败投影删除该假成功位；U11/U12 从折叠层断言升级为折叠→verdict 集成钉，分别锁 `AMBIGUOUS_ACTION` 与 `INDETERMINATE`。

处置后验证：`intent-event-fold` 16/16；完整 PRD gate 8 条 acceptance 全绿并由 gate 重翻 `passes:true`；全仓 ratchet verify 为 73 PRD / 196 冻结文件 / 0 问题。r2 最小复现已由升级后的 U11/U12 直接覆盖。
