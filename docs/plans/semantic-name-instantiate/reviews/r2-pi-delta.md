All verification complete. Let me summarize the findings.

## 增量复核 r2 结论

### ① Medium 采纳与上移缺陷面检查

**采纳正确。** 投影 `ev = instantiateEventSemantic(ev, ctx)` 现位于 `performActionOnPage` 内 nav 早退之后、全部动作分支之前（line 94），原下游调用点已删除（全文件仅 1 处调用）。逐行位置实测：

```
nav 早退 4098 < 投影 4611 < selectOption 4653 < dragTo 4727 < agent 门 4790 <
agent.searchOpen 4878 < bindAgent 5097 < openNode 5203 < selectNodeDropdown 5302 <
deleteByName 5421 < setNodeField 6232 < resolveCandidate 6383
```

**三个指定关注点逐一核验，均无新缺陷：**

- **deleteByName label 判定**：compile 侧 emit 的 `semantic.name` 恒为固定字面（`'删除'`、确认弹层实采 `'确定'/'确认'`，compile-atoms-workflow-crud.mjs:333/368），不含 `{{` → `instantiateEventSemantic` 恒等返回同一引用，label 判定与 targetName（走 `ev.value`，投影不触碰）字节级不变。
- **agent 门**：`isAgentToolSpecialAction`/`performAgentToolAction` 全文件零 `semantic` 引用（只消费 action/atom/text/value），投影只改 `semantic.name`，行为面零差。`doAgentSearchOpen` 虽消费 `semantic.name` 但自身已 `instantiate(raw, ctx)` 自愈，先投影后对已实例化串再 instantiate 恒等（ctx 值无嵌套 `{{`）。
- **page-topology 分发**：`dispatchActivePageReplayAction` 在 `performAction` 层于 `performActionOnPage` 之前分发，page-topology 模块零 `semantic` 引用，且 newpage/nav 早退均在投影之前，分发不受影响。B6（newpage 在 resolveCandidate 前）与 B2（agent 专用门在通用路径前）两处冻结字面钉实测仍成立。

**受上移影响的面正是修复意图本身**：doOpenNode / doDragTo / doSetNodeField placeholder（canvas.mjs:44、workflow-drawer.mjs:247/433 消费 `semantic.name` 者）从「拿字面 `{{…}}` 找元素恒 0 命中」变为「拿实例化名定位」——与 B4 根因同向，无冻结金牌钉旧缺陷行为。

**S4 自钉**：五处分支字面全部存在且 `rProj < at` 全过。注：钉未覆盖 `agent.searchOpen`/`deleteByName` 两分支，但前者自愈、后者恒为固定字面，且实际代码中二者仍在投影之后，无功能缺口。

### ② 金牌全绿

| 金牌 | 结果 |
|---|---|
| semantic-name-instantiate.zero-sut（新） | 4/4 全过，sha256 与 PRD testChecksums 一致（90f26d…） |
| page-topology-auth-continuity-boundaries.static | 7/7 全过 |
| regress-agent-tool-actions.zero-sut | 5/5 全过 |
| 邻接 wf-open-preface-notes / wf-open-search-first | 4/4、5/5 全过 |
| term-lint --registry / selftest --tier1 | 全绿 |

工作树与 78d8081 零漂移（仅 node_modules 未跟踪）。

DELTA_VERDICT: APPROVE
