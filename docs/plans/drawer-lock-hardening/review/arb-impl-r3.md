# 汇裁 r3 —— drawer-lock-hardening 实现审第三轮（双路相左，逐条亲核裁定）

- 汇裁者：fable @ xhigh（Claude 家族）
- 汇裁对象：codex 路 `codex-impl-r3.md`（gpt-5.6-sol @ medium，NEEDS CHANGES，2 HIGH）与 pi 路 `pi-impl-r3.md`（deepseek-v4-pro @ high，PASS）
- 被审实现：commit `1f29740`（r2 findings 加固），工作树 HEAD `d9493b6`
- **自评张力护栏**：被评实现是 Claude 家族产物、汇裁者同族——默认采信异构冗余里严的一方（codex），驳回必须持具体代码反证。本轮两条 HIGH 的代码路径均由汇裁者亲读 `lib/replay-actions.mjs` 与 `lib/compile-atoms.mjs` 逐行核验，不转述任何一路评审的结论。
- 汇裁范围：只做采信/驳回与处置裁定，不改实现、不推进台账。

## 总裁定

**采信 codex 两条 HIGH，维持 NEEDS CHANGES；pi 路 PASS 判为漏报，驳回。需要 r4。**

## 独立核验（亲读代码，逐步走查）

### 核验一：codex HIGH#1（初次域扫描不存物理句柄，身份锚定时刻晚于检查时刻）——成立

代码事实（两门同型）：

1. `nodeDrawerDomain`（`lib/replay-actions.mjs:129-147`、`lib/compile-atoms.mjs:148-166`）扫描循环里对每个候选做标题可见性核验后，压进数组的是 `structural.nth(k)`——惰性 Locator，**不是**当场解析的物理句柄；第 146/165 行原样返回。
2. `pinNodeDrawer`（`lib/replay-actions.mjs:201-218`、`lib/compile-atoms.mjs:218-235`）在拿到扫描结果之后才执行 `rootHandle = await domain[0].elementHandle()`（207/224 行）。这是全链路**唯一**一次身份锚定，发生在扫描完成之后。
3. 此后所有重判（`verifyPinnedNodeDrawer` 的 `sameDomNode`）都以 `rootHandle` 为地面真值。

走查 codex 可复现路径：扫描时唯一合法抽屉 A 通过全部可见性核验 → `nodeDrawerDomain` 返回后、`elementHandle()` 前，页面脚本把 A 原位替换为同标题冒牌 B → `nth(0)` 惰性重解析命中 B，`rootHandle` 从锚定那一刻起就是 B → 盖 pin 盖在 B 上 → 钉后重判：域内唯一者是 B、`sameDomNode(B, rootHandle=B)` 恒真、pin 全页恰一 → `ok`。每一步与 codex 描述一致。后续全部物理同一校验只能证明「一直是 elementHandle 时刻解析到的那个节点」，证不出「就是扫描时检查过的那个节点」——身份连续性保证在原点处开洞，这正是本契约（抗 TOCTOU，检查到使用之间的窗口）要封的缝的同型残留。

血统核对：r2 HIGH 明确要求「初次扫描时即保留物理句柄」，`git show 1f29740` 未改 `nodeDrawerDomain` 返回形态（codex 路驱动员已实核，汇裁者复核 diff 结论一致）。属 r2 HIGH 未闭合子项，严重度维持 HIGH。

汇裁者补充核对（诚实注记）：该窗口对页面脚本同样**不可观测**（扫描是纯读操作，无 DOM 痕迹），攻击者只能靠持续翻搅碰运气命中——但概率性假绿仍是假绿，且 r2 已点名此子项，不构成降级理由。此事实影响的是金牌设计（见处置 A1），不影响采信。

### 核验二：codex HIGH#2（pin 挂点不校验，搬移到无标题嵌套 wrapper 两闸皆过）——成立

代码事实（两门同型）：

1. `verifyPinnedNodeDrawer`（`lib/replay-actions.mjs:186-199`、`lib/compile-atoms.mjs:203-216`）只有两闸：①域内唯一者与 `rootHandle` 物理同一（192-196 行）；②pin 全页恰一（197-198 行，属性选择器 `[data-casey-domain-pin="…"]` 计数）。**没有任何一行**校验「那个唯一的 pin 承载者就是 `rootHandle`」。
2. `bound.root = page.locator('.hr-drawer__content-wrapper[…pin…]')`（`lib/replay-actions.mjs:218`、`lib/compile-atoms.mjs:235`）——后续候选根按 pin 属性全页重解析。
3. 字段/触发器的**计数与 nth 绑定**全以 `bound.root` 为域：回放门 `fields = root.getByPlaceholder(...)`（`lib/replay-actions.mjs:453`）、`triggers = root.locator('.hr-select:visible')`（324 行）；编译门同型（`lib/compile-atoms.mjs:918`、752 行），域内多匹配闸（`fcount > 1 → ambiguous`）在这个域上判。
4. `handleInsideRoot`（`lib/replay-actions.mjs:165-168`）验的是 `rootHandle.contains(el)`——物理包含，嵌套在被钉抽屉**内部**的子 wrapper 里的元素同样通过。

走查 codex 可复现路径（以 setNodeField 为例，四道门同构）：合法抽屉 A 有标题 + 两个同占位符字段，其一包在 A 内部一个无标题、同为 `.hr-drawer__content-wrapper` 的子容器 B 里；页面脚本在 A 被写入 pin 的同一微任务里摘下 A 的 pin 挂到 B（全页始终恰一）→ 钉后重判：域扫描只认 A（B 无标题文本不入域）、`sameDomNode(A, rootHandle=A)` 通过、`pinCount===1`（在 B 上）通过 → `ok`；`bound.root` 解析为 B → 字段计数 2 缩成 1，本应 `ambiguous` 的多匹配闸放行 → `targetHandle` 取自 B 内字段，`handleInsideRoot(字段, rootHandle=A)` 因 B ⊂ A 通过 → `preFill`/`afterFocus`/`afterFill` 重判全过（三闸都验不到挂点）→ 落笔 + 物理句柄精确回读成立 → `unique`。**把本应 ambiguous 的操作洗成 unique 假绿**，违护栏 #14。编译门 `fcount > 1` 闸同样被缩窄的域骗过 → exit 0 产 events。每一步与 codex 描述一致。

金牌覆盖核对：pinclone 夹具是「复制保留原 pin」（`tests/fixtures/fake-sut/server.mjs:502`，复制后全页 pin 计 2），G15a/b 走的是 `pinCount !== 1` 分支；现有 G1–G17 无「pin 从原根移走、全页仍恰一」场景。codex 所述覆盖缺口属实。

### 核验三：pi 路 PASS 为何漏报

- pi 残缝检查第 2 条审的是「pin 复制后又从**原始节点**移除」——其落点假设进了标题域，被 `sameDomNode` 拦下。这条本身没错，但与 codex HIGH#2 的落点（无标题嵌套 wrapper，标题域仍解析回 `rootHandle` 本身）不是同一路径——非结论冲突，是覆盖盲区。
- pi 3.5 节自己摸到了 pin 属性根选择器这条缝，却下了「当前代码中所有写操作和回读均走物理句柄，不存在此路径」的结论——**与代码事实不符**：写操作与回读确实走物理句柄，但字段/触发器的**候选域计数与多匹配闸**以 pin 根定界（`lib/replay-actions.mjs:453`、`lib/compile-atoms.mjs:918`），物理句柄正是从这个被缩窄的域里取出来的。pi 把「句柄口径安全」误推成「定界口径安全」。
- pi 对 HIGH#1 血统子项（初次扫描存句柄）未做核对，其加固对照表把「绑定时保留物理句柄」记为已落，未察觉锚定时刻仍晚于扫描时刻。

## dispositions（逐条采信/驳回）

| 条目 | 来源 | 裁定 | 证据 |
|---|---|---|---|
| HIGH#1 初次扫描不存物理句柄、锚定晚于检查 | codex r3 | **采信**（HIGH，r2 HIGH 未闭合子项） | 汇裁者亲核 `lib/replay-actions.mjs:129-147/201-218`、`lib/compile-atoms.mjs:148-166/218-235`；`1f29740` 未改返回形态；可复现路径逐步走查成立 |
| HIGH#2 pin 挂点不校验、搬移到无标题嵌套 wrapper 两闸皆过、ambiguous 洗成 unique | codex r3（新报） | **采信**（HIGH，假绿向） | 汇裁者亲核 `verifyPinnedNodeDrawer` 两门（replay:186/compile:203）无挂点闸；`bound.root` 按 pin 重解析（replay:218/compile:235）；计数域缩窄走查成立；G15 夹具只覆盖复制不覆盖搬移 |
| 总裁决 PASS | pi r3 | **驳回**（漏报） | 3.5 节「不存在此路径」与 `lib/replay-actions.mjs:453`、`lib/compile-atoms.mjs:918` 的计数定界事实不符；残缝检查第 2 条落点假设未覆盖无标题嵌套 wrapper |
| pi 残缝检查第 2 条（复制后移除原 pin 被 `sameDomNode` 拦） | pi r3 | 采信为**部分覆盖**，不构成对 codex HIGH#2 的反证 | 两路审的是不同 pin 落点，pi 该条结论在其假设内正确 |
| r2 MED（确定性握手 + 动作窗口覆盖）已闭合 | codex r3 + pi r3 双路一致 | **确认闭合** | pinclone 握手（MutationObserver 零时序依赖）+ fieldmove/triggermove 进入动作窗口，双路独立核验一致，无反证 |
| 冻结文件 sha 一致 / 语法通过 / `bin/verdict.mjs` 与 `events.schema.json` 未动 / 句柄 finally 释放 | 双路一致 | **确认** | 无反证 |

## adjudicated（最终待修 findings，r4 输入）

### A1（HIGH，source: codex r3 HIGH#1，血统 r2 HIGH 子项）——初次域扫描即保留物理句柄

位置：`lib/replay-actions.mjs:129-147/201-218`、`lib/compile-atoms.mjs:148-166/218-235`（两门同刻）。

修法方向：

1. `nodeDrawerDomain` 改为**先一次性快照物理句柄**：`const handles = await structural.elementHandles()`（单次解析即快照全体候选），随后的「wrapper 自身可见 + 内含自身可见的精确标题文本」核验**全部通过句柄在页内做**（`handle.evaluate`，可见性判据对齐 Playwright `:visible` 语义：有非空盒且 visibility 未隐藏），不再经任何惰性 Locator 重解析；返回物理句柄数组。快照之后任何替换 → 句柄脱附 → 核验/盖章抛错 → fail-closed，构造上封死「检查过的节点 ≠ 锚定的节点」。
2. `pinNodeDrawer` 直接对 `domain[0]` 句柄盖 pin（删掉 207/224 行的 `elementHandle()` 重解析），`rootHandle` 就是扫描时核验过的那个句柄。
3. `verifyPinnedNodeDrawer` 的 `cur[0]` 已是句柄，直接 `sameDomNode`，删掉 192/209 行的重解析。
4. 句柄生命周期：新增 `disposeDomain(matches)` 统一释放；只用计数的调用方（回放门 `doOpenNode` 基线 263、轮询 273、点后 279；编译门 `compileWorkflowOpenNode` 同段 667/678/685）每次调用后全量释放；`pinNodeDrawer` 非 ok 路径与未选中候选同样释放。

红先行金牌设计（twinswap，接缝级微测）：把 `nodeDrawerDomain` 导出（仅供测试的接缝暴露，两门各自导出、不合并——两门同刻是既有决策）。测试驱动真实页面：扫描 → `page.evaluate` 原位移除真抽屉、插入同标题冒牌 → 尝试把返回的 `domain[0]` 解析到物理节点并与冒牌比对。红证（现行形态）：`domain[0].elementHandle()` 惰性重解析命中冒牌，`sameDomNode(解析结果, 冒牌)` 成立——漂移实锤；绿证（修复后）：`domain[0]` 是脱附句柄，核验/盖章抛错落 fail-closed。诚实边界：整原子级**无页面可观测握手点**（扫描纯读、无 DOM 痕迹），确定性复现只能落在导出接缝上；禁止为凑整原子红证在夹具里埋读探测钩子（不许倒着裁夹具）。修复后 G1–G17 全量保持 GREEN 作为回归面。

### A2（HIGH，source: codex r3 HIGH#2，新报）——verifyPinnedNodeDrawer 补第三闸：pin 恰挂在 rootHandle 上

位置：`lib/replay-actions.mjs:186-199`、`lib/compile-atoms.mjs:203-216`（两门同刻）。

修法方向：在 `pinCount === 1` 通过之后追加**挂点闸**——解析该唯一 pin 承载者的物理句柄，`sameDomNode(承载者, rootHandle)` 不成立 → `action_failed`（承载者句柄 finally 释放）。由于每次落笔（fill/click/选项单击）前都必过 `verifyPinnedNodeDrawer`，此闸封死一切 pin 搬移落点：搬到无标题嵌套 wrapper、搬到域外、任何时刻搬——下一个重判点即拦，`bound.root` 的缩窄域计数没有机会走到落笔。三闸齐备后语义完整：域内唯一者=被钉物理节点（防替换）、pin 全页恰一（防复制）、pin 承载者=被钉物理节点（防搬移）。

红先行金牌设计（pinmove 场景，G18a/b，确定性握手、pinclone 先例同法）：

- 夹具（`tests/fixtures/fake-sut/server.mjs` 新增 scenario `pinmove`）：真抽屉 A（可见标题）含**两个**同占位符字段，其一包在 A 内部无标题、同类名 `.hr-drawer__content-wrapper` 的嵌套子容器 B 里；`MutationObserver` 监听 pin 属性——A 一被钉，同一微任务里摘下 A 的 pin、以同值挂到 B（全页始终恰一，零时序依赖）。
- G18a 回放 setNodeField（不给 nth）：红证（现行 `1f29740`）=候选域缩为 B 内恰 1 → 落笔+精确回读成立返 `unique` 假绿（本应 `ambiguous` count=2）；绿证（修复后）=`action_failed` + 宽域候选快照恰 2 项且全空（零落笔取证）+ verdict 恰 NEEDS_HUMAN/INDETERMINATE。
- G18b 编译 setNodeField：红证=预检多匹配闸被缩窄域骗过、exit 0 产成功 events；绿证=blocker exit 65 + 零 events + notes 无「节点字段已填入」。
- 修复点在两门共享的 `verifyPinnedNodeDrawer`，setNodeField 双门金牌即足以钉住接缝；金牌文件头部 G1–G17 编号注释与 gate 分命令说明（`tests/_golden/drawer-lock-hardening.golden.mjs:1/61`）同步扩到 G18。

## 是否需要 r4

**需要。** 两条 HIGH 均采信（一条 r2 血统未闭合 + 一条新报假绿向），按契约流程进 r4：实现者按 A1/A2 修法落地 + 红先行金牌，修复后重跑异构冗余复核。
