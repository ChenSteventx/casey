All checks complete. Here is the review.

---

# 评审报告 · semantic-name-instantiate（单轮）

**范围核验**：HEAD `d3ba2c5`，工作树干净（仅 untracked node_modules）；全量 diff 7 文件 247+2 行，与声明的变更面一致。

## 逐项审计（对照风险清单）

**1. 投影纯度** — PASS。`instantiateEventSemantic` 六态（无占位/缺 ctx/空 ctx/无 semantic/null/undefined）均返回同一引用不抛；含占位且回填有变化才产浅拷贝，其余字段逐位保留；`Object.freeze` 双层冻结场景实测通过（S1 即此用例）。落盘不被改已双重证实：compile 侧 `this.events.push(ev)`（compile-atoms-run.mjs:278）推的是 emit 外层原始 ev（投影只发生在 resolveTarget 局部参数上）；replay 侧 `performActionOnPage` 局部重绑不触调用方。

**2. 回放侧定位构造点逐条枚举**：
- `semanticLocator` 通用路径（replay-actions.mjs:118 投影覆盖）✔
- `doAgentSearchOpen`（agent-search.mjs:9-10）自带 `instantiate(raw, ctx)`，自愈 ✔
- `doSelect`（dropdownUnit）/`doSelectNodeDropdown`（nodeName/text）/`doBindAgent`（nodeName+value 已实例化）/`deleteByName`（固定字面 label + value 已实例化）/`agent-tool-actions`/page-topology 分发与 bridge：不消费 semantic.name ✔
- **`doOpenNode`（workflow-drawer.mjs:247）、`doDragTo`/`doConnectNodes`（canvas.mjs:44,106）、`doSetNodeField` placeholder（workflow-drawer.mjs:433）消费 raw semantic.name，在投影之前分支，未覆盖** ——见 finding 1。

**3. `ev` 重绑下游** — PASS。gate 的 `closeEvent` 虽复制投影后 ev，但门逻辑只读 action/value/atom/targetName；漂移探针 `findEquivalentAffordance(page, event.atom, event.targetName)` 的 targetName 源自 `bin/replay.mjs:373` 的 `hit.event.text`（非 semantic.name）；`doAct` 只读 action/key/value。axes 只含 resolution/candidateCount/identityReadback，零名字字段。产物投影零漂移。

**4. compile 侧对称性** — PASS。press/click/fill/dblclick 通用分支全部经 resolveTarget → 投影覆盖；selectOption 分支消费 dropdownUnit（与 semantic.name 无关）无缺口；nav 无定位；customAct 路径（openNode/addNode/bindAgent）自带已实例化/静态名且编译门 fail-closed。附带收益：`agent.searchOpen`（compile-atoms-agent.mjs:56,95）此前若携模板 openName 同样恒 0 命中（gate 用实例化名过、emit 找字面串），本修复一并治愈。

**5. 安全面（护栏 #7）** — PASS。回填真名只进 Playwright 查询（与 compileWorkflowOpen 既有探针 `getByText(instantiate(params.openName,...))` 同一暴露级）与 gate 内存闭合事件；events/observed/verification/notes/axes/报告均不收该名（notes 只含 stepId/atom/resolution/count）。

**6. 红证/PRD/golden 判别力** — PASS。三文件 sha256 与 PRD 逐字节一致（已实测比对）；我用 `git show 97c0d83:` 姿势在 /tmp 还原三 lib 文件跑金牌，**4/4 红且消息与提交的 red-proof 逐字相同**、exit 1，突变闭环真实；S4 自钉对准两个冻结金牌的 indexOf 字面（B6 `resolveCandidate(page, ev)`、B2 `const cand = await resolveCandidate(page, ev)`），两冻结金牌现跑 7/7、5/5 绿；新金牌 4/4 绿；wf-open 邻接两金牌绿。

## Findings

1. **[Medium] lib/replay-actions.mjs:118（投影位序）· lib/replay-actions/workflow-drawer.mjs:247,433 · lib/replay-actions/canvas.mjs:44,106 —— 专用身份门（doOpenNode / doDragTo / doConnectNodes / doSetNodeField placeholder）消费 raw `semantic.name` 却在投影之前返回，新立的「定位前必须回填」不变式只覆盖通用路径；S4 自钉断言文案「两侧定位入口均先过投影」的覆盖声明强于实际（S4 只钉 resolveCandidate 位序，这三处即使未来漏投也不会红）——若未来配方给节点标题/拖拽源传模板（系统已支持 setNodeField 模板值机制，此路径并非不可能），将复现 B4 同类恒 0 命中。当前无任何流程能把模板送进这三处（compile 侧 openNode/addNode 预检对模板 label 先硬阻断、placeholder 天然静态），且即便到达也 fail-closed（0 命中→none/blocker，绝不假绿），故不升级为 High —— 建议：按同一纯投影模式在这三处门入口各加一行 `ev = instantiateEventSemantic(ev, ctx)`（零签名变更、与既有冻结字面无冲突），并在 S4 补一条钉断言「所有消费 semantic.name 的 replay 定位路径均过投影」（可枚举这三处 + semanticLocator + agent-search 自愈点），使不变式与自钉一致。**

（其余五项风险维度：零 Critical/High/Medium 之外的发现。）

## 验证痕迹
- 新金牌 4/4 exit 0；突变还原 4/4 红 exit 1（/tmp，`git show` 姿势，未触暂存区）
- 冻结金牌 page-topology 7/7、regress-agent-tool-actions 5/5 绿；wf-open-preface-notes / wf-open-search-first exit 0
- PRD 三 sha256 实算比对一致；worktree=HEAD d3ba2c5 干净

IMPLEMENTATION_VERDICT: CHANGES_REQUIRED
