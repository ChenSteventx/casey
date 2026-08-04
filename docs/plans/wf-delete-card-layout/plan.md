# plan —— 删除域卡片布局扩展（`wf-delete-card-layout`）

- 基线：`dev` @ `6f51aaf`；工作树 `../casey-wf-delete-card-layout`；入口分流 `full`。
- 逼问与定案见同目录 `GRILL.md`（本文只写「做什么、怎么验」，不重复论证）。
- 上游事实源：`docs/plans/p9-created-workflow-cleanup-continuity-v3/evidence/shape-probe-20260804.md`（2026-08-04 真机形状实采）与 `docs/plans/admission-stale-green-triage/REAL-MACHINE-SEAMS-20260731.json`（2026-07-31 真机接缝，17 条实删互证）。

## 一 目标

`lib/workflow-delete-domain.mjs` 支持卡片布局的删除入口：悬停目标卡片 → 点更多操作入口（`button.agent-card__more`）→ 在因果浮现的浮层菜单（`div.hr-popup.hr-dropdown`）内取「删除」→ 交回既有确认弹层因果授权链。

## 二 非目标（写死，越界即停手报人）

1. **不碰确认环**：`inspectWorkflowDeleteConfirm` / `performWorkflowDeleteConfirm` / 确认候选集 `['确定','确认']` 零改动（`GRILL.md` §〇 已证「删除」不是合法确认候选且会与回放分流打架）。
2. **不碰多态裁定**：`bin/verdict.mjs` 及任何裁定链零改动（护栏 #15）。
3. **不碰任何 `testChecksums` 冻结断言件**。若既有删除域金牌的断言体挡路 → 停手报人，绝不改冻结件。
4. **不碰 `summarizeDeleteCountAudit`**（三份冻结金牌钉着：`p0-p2-report-delete`、`p3-compile`、`units/p3-compile-unit`）。
5. **不碰真机**：真机验证归 B4 段（`route:human`）。本契约零 SUT、零浏览器、零网络。
6. **不碰 `GRILL.md` §九 那五条相邻缺口**（Enter 不过滤 / `countSelector` 与 `.agent-card` 不同源 / `compile-atoms-agent.mjs:194` 漏导入 / `real-run-trust` 基线红 / `atl_shape0804a` 残留）——如实挂账，另开契约。

## 三 设计

### 3.1 入场判据（表格布局零位移的形式化表述）

`performWorkflowDeleteTrigger` 内，现行直见删除钮路径**逐字保留**；只有它吐 `none`（今天的死胡同）才接管：

```
result = performLockedAction(page, { root, candidateCount: 1, actionText: '删除', rescan })
if (result.resolution === 'none') result = <卡片悬停菜单路径>
```

`unique` / `ambiguous` / `action_failed` 三条全部短路，卡片路径不执行。

### 3.2 卡片路径步序（每步 fail-closed，失败映射见 `GRILL.md` §七）

1. 钉目标卡片根（`ROOT_PIN_ATTR`）+ `rescan` 重扫唯一；
2. `root.hover()`（唯一性锁定之后才准悬停）；
3. 卡片域内数更多操作入口：恰 1 → pin；0 → `none`；>1 → `ambiguous`；异常 → `action_failed`；
4. 快照当前浮层菜单集合（基线）；重验根仍锁定、更多操作入口仍在根内可见；
5. 点更多操作入口；
6. 有界等待因果浮层（3000 ms / 50 ms 轮询），用**已冻结**的 `classifyCausalDialog` 纯函数 + `sameNodeStrict` 选「恰一个新物理浮层」；
7. 重验目标卡片仍唯一锁定（防重渲染换根后误删邻居）；
8. 在该浮层内取精确文本「删除」的菜单项，恰 1 才点（复用 `performLockedAction`，菜单档开）；
9. 收拾（裁定 3，见 §3.2b）：点过更多操作入口且最终未 `unique` 时按 `Escape` 关菜单，结果**具名记录**，绝不改写动作轴；
10. 成功后交回既有 `waitForCausalDialog(page, baselineDialogs)` 确认弹层因果授权链（零改动）。

### 3.2b 收拾动作清单与具名记录（协调方裁定 3）

本契约新增的真实交互只有两个，逐个登记在案，除此之外不得再有：

| 交互 | 何时发生 | 性质 |
|---|---|---|
| `root.hover()` 悬停目标卡片 | 目标卡片唯一锁定之后、数更多操作入口之前 | 只读，浮现入口 |
| `Escape` 关菜单 | 点过更多操作入口**且**最终未 `unique` | 取消语义，只收拾自己开的浮层 |

**`Escape` 失败不得吞。** 返回的动作轴上带具名字段 `menuCleanup`：`'closed'`（收拾动作已完成）/ `'failed'`（收拾抛错，已具名留证）；未点过更多操作入口或路径成功时该字段不出现。`menuCleanup` 在任何取值下都**不参与** `resolution` 判定。

**边界如实申报**：`menuCleanup` 到删除域返回值为止。编译侧 `lib/compile-atoms-run.mjs:155-158` 只取 `resolution` / `candidateCount` / `identityReadback` 三项，回放侧 `lib/replay/history.mjs` 由 `axis.resolution` 派生 `locatorResolution`——两处都是白名单投影，故该字段既不会漏进冻结的 `run-history.schema.json`（`additionalProperties:false`），也**不会自动出现在回放历史里**。要不要让它上到回放历史，是动冻结接缝的独立决策，本契约不做，记 `observability` 的 `route:human`。

### 3.3 菜单浮层选择器

`.hr-popup.hr-dropdown, .hr-dropdown__menu`（带 `hr-dropdown` token，绝不用裸 `.hr-popup`——会误抓 `.hr-popup.hr-select__dropdown` 选择器弹层）。
可见过滤（滤掉真机已知的隐藏副本）+ 物理去重 + **只留最外层**（被别的命中节点包含者剔除，防根/内层同时命中自造 `ambiguous`）。
`DIALOG_SELECTOR` 与本选择器互不相交（逐 token 核过），故菜单不污染确认弹层因果快照。

### 3.4 `pinExactAction` 菜单档（默认关闭）

加默认关闭的开关；三个现有调用点一律不传 → 控件谓词逐字不变。菜单档额外接受 `[role="menuitem"]`、`li`、`class` 含 `hr-dropdown__item` / `hr-dropdown__item-text` 的节点（真机实证：下拉菜单无 `menuitem` 角色、是 `div` 汤）。

**父子同文本必须做包含收敛，不能只靠既有身份去重**：菜单项常见形状是 `div.hr-dropdown__item > span.hr-dropdown__item-text`，两层的 `textContent` 都恰为「删除」，两层又都被菜单档谓词认成控件；既有「走到最近控件祖先 + 身份去重」对这种形状会收出**两个**控件 → 假 `ambiguous`。故菜单档在既有去重之后再加一步归一：命中集内被另一命中节点包含者剔除，**只留最外层**（真实可点的那一层）。互不包含的两个同名菜单项仍判 `ambiguous`，fail-safe 不变。

### 3.4b 更多操作入口谓词

按真机实采两个信号取并集：`class` 含 `agent-card__more`，**或** `title` 属性为「更多操作」。任一命中即算入口（两个信号在实采里同时存在，取并集只增鲁棒、不减严格；仍要求恰一命中才动手）。

### 3.5 `inspectWorkflowDeleteTarget` 计数口径

`deleteButtons` 口径改为「**可达删除面**」= 直见删除钮数 + 更多操作入口数；另加法新增两个纯诊断字段 `directDeleteButtons` / `menuDeleteEntries`。`summarizeDeleteCountAudit` 零改动，其「记录容器数 == 删除目标数」不变量语义不变。
审计环**绝不悬停、绝不开菜单**（编译期只读对账不得有副作用）：`menuDeleteEntries` 按存在性数，可见性由触发环在点击前实证。分工：审计证**基数**，触发证**存在与唯一**，两道都 fail-closed。

**加法字段只作证据投影，不得被下游当权威消费（协调方裁定 2）**：`directDeleteButtons` / `menuDeleteEntries` 只许被人和探针当证据读，任何生产判断（对账、准入、阻断、裁定）一律只认 `deleteButtons` 与 `summarizeDeleteCountAudit` 的结论。这条不靠自觉——验收点 A13 静态扫 `lib/` 与 `bin/`，除删除域自身外出现这两个标识符即判红。

### 3.6 硬约束（实现时逐条自查，全部来自现役冻结金牌）

| 约束 | 来源 |
|---|---|
| `lib/workflow-delete-domain.mjs` 不得出现顶层 `import` → 新辅助件只能内联 | `checksum-drift-closure` C3 |
| 触发函数体内源码顺序：弹层基线快照 < 字面 `performLockedAction(page` < `waitForCausalDialog(page, baselineDialogs)` | `workflow-delete-causal-binding` C4 |
| 空 `expectedName` 仍零页面读取早退 | 同上 C0 |
| 弹层选择器 token 边界四条仍在、裸 `class*=` 两条仍不得出现 | 同上 C0 / `checksum-drift-closure` C2 |
| 源码须仍含 `waitForTargetRecordDomain` 与 `TARGET_RECORD_TIMEOUT_MS` | `real-run-trust`（该金牌基线即红，非本契约引入） |
| 须仍含 `options.searchBoxName \|\| SEARCH_BOX_NAME`；新代码不得出现 `.last(` / `.nth` 全页取钮模式 | `regress-agent-tool-actions` |
| 新增 golden 不得启任何 SUT（启 SUT 闭集须恒为 30） | `hermetic-golden-sut-census` C2 |

### 3.7 统一语言

申报新术语 **因果菜单授权**（Causal Menu Authorization）：只接受由点击目标记录的更多操作入口后恰好新出现的那一个浮层菜单作为删除项取值域；是 `容器归属闸` 在浮层场景的对位物（前者给结构性归属，后者给因果性归属）。

按 ADR-0005 登记 `CONTEXT.md` Casey 核心域表。**登记必须与该词首次进生产件同波落地，不许滞后**（协调方裁定 4）——即写下第一行用到该概念的实现代码的那一波，同波把词条写进 `CONTEXT.md`，并连带跑术语表完整性检查（`node loop-kit/bin/term-lint.mjs --registry`）与全仓漂移扫。本轮只申报，是因为本轮实现面一行未动。

## 四 验收点（可执行规格）

| 编号 | 验收点 | 验收命令 |
|---|---|---|
| A1 | 卡片布局：悬停 → 更多操作 → 菜单「删除」→ 确认弹层因果授权成立 → 出站请求形状为 `POST /ai-manager/process/delete` 且 `body.masProcessId` 命中目标 id | `node tests/_golden/wf-delete-card-layout.zero-sut.golden.mjs` |
| A2 | 表格布局回归：直见删除钮 1 命中时结果与调用序与今天同一，卡片路径不执行 | 同上 |
| A3 | 多卡同名歧义拒：两张卡片同名 → `ambiguous`，零点击 | 同上 |
| A4 | 菜单无「删除」项具名拒：菜单只有 编辑/复制/停用 → `none`，零点击 | 同上 |
| A5 | 菜单档双向钉死：菜单档关时同一菜单夹具命中 0（证明既有三调用点行为不变），开时恰 1 | 同上 |
| A6 | 计数口径：卡片布局 `inspectWorkflowDeleteTarget` 出 `layout:'card'`、`deleteButtons:1`、`directDeleteButtons:0`、`menuDeleteEntries:1`，且 `summarizeDeleteCountAudit` 判 `equal:true`；表格布局三字段与今天同一 | 同上 |
| A7 | 浮层不串味：菜单浮层不被 `DIALOG_SELECTOR` 抓；菜单开着时确认弹层因果授权仍唯一 | 同上 |
| A8 | 隐藏副本与嵌套归一：隐藏菜单副本被滤、根与内层同时命中仍判唯一 | 同上 |
| A12 | 收拾具名记录：点过更多操作入口且失败时 `menuCleanup` 为 `'closed'`；`Escape` 抛错时为 `'failed'` 且 `resolution` 不被改写；未点过入口或成功时该字段不出现 | `node tests/_golden/wf-delete-card-layout.zero-sut.golden.mjs` |
| A13 | 加法字段无下游权威消费者：`lib/` 与 `bin/` 中除删除域自身外，`directDeleteButtons` / `menuDeleteEntries` 零引用 | 同上 |
| A9 | 既有删除域金牌全绿（零位移） | `node tests/_golden/workflow-delete-causal-binding.static.golden.mjs`；`node tests/_golden/checksum-drift-closure.zero-sut.golden.mjs`；`node tests/_golden/p0-p2-report-delete.zero-sut.golden.mjs`；`node tests/_golden/workflow-delete-spec-preflight.static.golden.mjs`；`node tests/_golden/regress-agent-tool-actions.zero-sut.golden.mjs` |
| A10 | 相邻面金牌全绿（含起夹具 SUT 的浏览器面，不许只信分层绿） | `node tests/_golden/p3-compile.golden.mjs`；`node tests/_golden/units/p3-compile-unit.zero-sut.golden.mjs`；`node tests/_golden/agent-delete-zero-window.zero-sut.golden.mjs`；`node tests/_golden/hermetic-golden-sut-census.zero-sut.golden.mjs`；`node tests/_golden/hermetic-golden-prd-reverse-closure.zero-sut.golden.mjs` |
| A11 | 语法与卫生 | `node --check lib/workflow-delete-domain.mjs`；`git diff --check` |

## 五 红基线（`accept` 阶段交付）

`tests/_golden/wf-delete-card-layout.zero-sut.golden.mjs` 零 SUT，自建最小 DOM 模型 + `page` 门面，忠实复现卡片 DOM 形状（`.agent-card` / `button.agent-card__more` / 悬停浮现 `div.hr-popup.hr-dropdown.hr-dropdown--bottom-right` / 菜单四项 / `.hr-dialog` 确认框）与表格 DOM 形状。
替身按**调用链**建模到「被调用的形状」级：`locator()` 的返回值既被 `elementHandles()` 也被 `evaluateAll()` 调；`getByRole().first()` 的返回值还会被 `inputValue()` 调；`handle.evaluate(fn, arg)` 里的 `fn` 真跑，故 `window.getComputedStyle` / `querySelectorAll` / `getBoundingClientRect` / `classList` / `isConnected` / `contains` / `setAttribute` 等逐个兑现。
红证对最终字节实抓，**按退出码判**（不 grep 失败标记串），落 `accept/red-proofs/`。

## 六 回归面（实现波必跑，不许只跑分层绿）

A9 + A10 全部命令。特别点名 `p3-compile.golden.mjs`——它起夹具 SUT 且夹具是表格布局带直见「删除」钮（`tests/fixtures/fake-sut/server.mjs:162-168`），是表格路径的端到端证据，不许跳过。

## 七 `observability`（测不到的维度，显式申报 `route:human`）

1. 真机上「悬停更多操作 → 菜单浮现 → 点删除 → 确认框」整链的真实时序、菜单浮层的真实父节点与真实 `class`、以及删后按名精确计数归零 —— 零 SUT 金牌测不到，B4 段真机 UAT 复核。
2. **因果绑定的残留风险**：卡片布局给的是因果归属而非结构归属。若 SUT 在同一拍为别的卡片弹菜单且旧菜单同时消失，理论上可构造「恰一个新浮层但不属于目标卡片」。机器证不出，真机删前删后计数 + 录屏复核。
3. 菜单项真实 `class` 未逐字实采（`.hr-dropdown__item` 系从同族菜单实采注推得）——故实现按「可见 + 精确文本 + 在菜单域内」定位，`class` 只做控件识别补充白名单；真机复核确认。
4. 合入前异构评审（评审家族 ≠ 实现家族）。
5. `menuCleanup` 只到删除域返回值为止，不上回放历史（两处投影都是白名单，见 §3.2b）。要不要让收拾证据进回放历史，须动冻结的 `run-history.schema.json`（`additionalProperties:false`），是独立决策，本契约不做。

## 七之二 B4 前置检查单（协调方裁定 5：只记账，本契约不实现；B4 preflight 逐条真机核）

| # | 待核事项 | 已知证据 | 不核的后果 |
|---|---|---|---|
| B4-1 | 工作流列表搜索框按 `Enter` 是否过滤 | 2026-07-31 seam-1：填名后按 `Enter`，`.agent-card` 计数逐秒采样 15 秒恒定不动；正确触发是 `.hr-input__suffix .search-icon`（点后 8 秒内收敛到 1 并保持，同轮 34 次搜索无一失手） | 冻结流的 `press Enter` 步不产生过滤，删除后的重搜复验落在未过滤全量列表上 |
| B4-2 | `countSelector` 与真实卡片类是否同源 | `workflow-delete-real-uat` 金牌钉 `'.hr-card.hr-card--bordered:has-text("atl_r1")'`；2026-08-04 实采的卡片根是 `.agent-card` | 若不同源，删后归零断言从 0 数到 0，出假绿（删没删成都判过） |

两条都属冻结件与真机取证面，本契约零触碰。删除域本身不依赖搜索过滤（`recordDomains` 是全页按精确名扫记录容器），故 B4-1 不使本契约的改动失效——它是同一条链上的**独立**第二个坑。

## 八 停止条件

- 冻结断言件挡路 → 停手报人，绝不改冻结件。
- 需要动 `summarizeDeleteCountAudit` 或确认环 → 停手报人。
- 红基线立不起来（新金牌在未改 `lib/` 时不红）→ 停手报人，绝不倒着裁夹具凑裁定。
