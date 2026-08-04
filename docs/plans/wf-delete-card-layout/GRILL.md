# GRILL —— 删除域卡片布局扩展（`wf-delete-card-layout`）

基线：`dev` @ `6f51aaf`。工作树 `../casey-wf-delete-card-layout`，`baton` = 本树 `loop/active-contract.json`。

本文只做逼问与定案，不写实现。每个分岔给「我的定案 + 理由 + 反对意见 + 残留风险」。
末尾「须人裁」一节是我不敢自己拍的。

---

## 〇 事实底座（先把「已实证」和「我推的」分开）

### 已实证（真机、有出处，不再怀疑）

| 事实 | 出处 |
|---|---|
| 工作流列表现为卡片布局，卡片根含 `.agent-card` | 2026-08-04 形状实采 `docs/plans/p9-created-workflow-cleanup-continuity-v3/evidence/shape-probe-20260804.md` |
| 卡片内唯一动作控件 `button.agent-card__more`（`title` = 更多操作），悬停浮现菜单，点击亦可浮现 | 同上 §3 |
| 菜单节点 `div.hr-popup.hr-dropdown.hr-dropdown--bottom-right`，`z-index` 5500 | 同上 §3 |
| 菜单固定四项：编辑 / 复制 / 删除 / 停用；已发布态与未发布态完全一致 | 2026-07-31 `docs/plans/admission-stale-green-triage/REAL-MACHINE-SEAMS-20260731.json` seam-3（17 条实删，`menuLabels` 逐条读到同一组） |
| 现行 `pinExactAction` 在卡片布局命中 0，`performWorkflowDeleteTrigger` 出 `resolution:none` | 2026-08-04 实采 §2（仓内探针复跑：目标卡片唯一、`deleteButtons: 0`） |
| 删除确认弹层 `.hr-dialog.hr-dialog__modal-warning`，页脚 `.hr-dialog__footer` 两个可见钮：取消 / 确认；**全页无「确定」** | 2026-07-31 seam-2（同轮 17 条删除全走这条） |
| 新建工作流抽屉 `.dialog-concent` 内另有一个**不可见**同名「确认」钮 | 2026-07-31 seam-2 caveat |
| 出站删除请求：`POST /ai-manager/process/delete`，`bodyKeys ["masProcessId"]`，`idLocations ["body.masProcessId"]` | 2026-08-04 实采 §4（发出前 abort，`mutationSent:false`） |
| 智能体卡片同形：`article.agent-card` + `.agent-card__more` + 浮层菜单取「删除」 | `docs/plans/real-uat-attestation/scripts/cleanup-agents.mjs:39-46`（真机清理脚本，已跑通） |
| 下拉菜单项**无** `menuitem` 角色，是 `div` 汤，且存在隐藏副本多份 | `lib/compile-atoms-workflow-crud.mjs:25-27`（2026-07-02 实采注） |

### 我推的（未实证，本契约按 fail-closed 处理，不当事实用）

- 菜单项的具体 `class`（`.hr-dropdown__item` / `.hr-dropdown__item-text`）是从「新增工作流」菜单的实采注推的同族形状，**删除菜单项本身没逐字实采过**。→ 实现不许写死单一 `class`，须按「可见 + 精确文本 + 在菜单域内」定位，`class` 只做控件识别的补充白名单。
- 菜单浮层是否挂在 `document.body`（脱离卡片）——形状实采只给了 `z-index` 5500 与 `--bottom-right` 修饰类，强烈暗示脱离，但没给父节点。→ 实现两种都得对（不假设菜单是卡片的后代，也不假设一定不是）。

### 与任务书不一致的一处（必须纠正）

任务书写「确认框按钮文本在 确定/确认/删除 候选内命中」。**「删除」不成立，且加进去有害**：

1. 无任何实采支持确认钮文本是「删除」；2026-07-31 实采明确是「确认」，且同轮 17 条全通。
2. 「确认」已在现行候选集 `['确定','确认']` 内 —— **确认环根本不需要改**。
3. 若把「删除」加进确认候选，`lib/replay-actions.mjs:105-107` 与 `lib/agent-tool-actions.mjs:383-391` 都按 `text/label === '删除'` 分流到**触发**，`'确定'|'确认'` 分流到**确认**；确认候选新增「删除」会造出一个语义二义的标签——同一个字面量既是触发又是确认，回放侧无法分流。这是破坏性动作上的真歧义，不能引入。

→ **定案：确认环零改动。** 本契约只碰触发环。

---

## 一 主分岔：怎么把「点菜单里的删除」和「目标卡片」绑死

表格布局里，删除钮是记录容器的**后代**——`点击身份门` + `容器归属闸` 给的是**结构性**保证：点中的控件物理地长在目标行里。

卡片布局里删除项在脱离的浮层里，结构性保证**没有了**。这是本契约的核心风险，不是实现细节。

### 候选方案

| 方案 | 做法 | 判 |
|---|---|---|
| A 文本兜底 | 全页找可见的、文本恰为「删除」的菜单项，点它 | **拒**。等于回到「全页取控件」，与既有纪律正面冲突；`regress-agent-tool-actions` 金牌明文禁「全页最后一个确认按钮」同族模式 |
| B 锚点几何 | 按菜单浮层相对卡片的坐标推归属 | **拒**。坐标兜底在本仓是 `AMBIGUOUS_ACTION` 的来源，不是证据 |
| C 因果授权 | 快照点击前的菜单浮层集合 → 点该卡片的更多操作钮 → 只接受**恰好一个新出现的物理浮层** → 只在该浮层内取「删除」 | **取**。与既有 `classifyCausalDialog`（确认弹层因果授权）是同一条纪律，纯函数已冻结可复用 |

**定案：C。** 并补三道加固（缺一即 fail-closed）：

1. 菜单浮层必须是**恰一个新物理节点**（复用已冻结的 `classifyCausalDialog`，同一个纯函数、同一套物理身份比较）。多个新浮层 → `ambiguous`。
2. 更多操作钮必须在**目标卡片域内**恰一命中（沿用 `ROOT_PIN_ATTR` 钉根 + `rescan` 重扫唯一 + pin 后重验），即「打开菜单这一击」本身仍受结构性容器保证。
3. 菜单浮出**之后**、点「删除」**之前**，再验一次目标卡片仍被唯一锁住（防框架重渲染换掉卡片后，菜单还开着就误删邻居）。

**残留风险（必须写进 `observability`，`route:human`）**：C 给的是因果绑定，不是结构绑定。若 SUT 在同一拍里为**别的**卡片也弹了一个菜单且旧菜单同时消失，理论上可构造出「恰一个新浮层但不属于目标卡片」。机器测不到，只能靠真机复核（B4 段：删前删后按名精确计数 + 录屏）。这一条我不掩盖。

---

## 二 `pinExactAction` 动不动？

菜单项是无角色 `div` 汤。现行 `isControl` 只认 `button` / `a` / `role=button` / `hr-button` 类，`div.hr-dropdown__item` 一个都不认 → 走上去到 `domain` 停住 → `controls.length === 0` → `none`。所以不加菜单项识别，方案 C 也点不着。

| 选项 | 判 |
|---|---|
| 直接放宽共享 `isControl`（加 `.hr-dropdown__item` 等） | **拒**。`pinExactAction` 同时服务表格删除钮、确认弹层「确定/确认」两条现役破坏性路径。放宽共享谓词 = 在两条已签路径上动手，违反「表格布局既有行为一字不得变」 |
| 另写一份菜单专用的 pin 函数 | 可，但与 `pinExactAction` 重复约 25 行 `norm`/`visible` 逻辑，两份会漂 |
| 给 `pinExactAction` 加**默认关闭**的菜单档开关，调用方显式开 | **取** |

**定案：加默认关闭的开关。** 现有三个调用点（表格删除、确认发现、审计计数）一律不传 → 谓词逐字不变、行为可证同一。金牌**双向**钉死：菜单档关时同一菜单夹具命中 0，开时恰 1。

菜单档谓词（加法，不改原有分支）：额外接受 `[role="menuitem"]`、`li`、`class` 含 `hr-dropdown__item` 或 `hr-dropdown__item-text` 的节点。

**这里我第一版写错了，红金牌夹具设计时当场逮到**：我原以为父子同文本会「走到最近控件祖先」后收敛成同一个节点。不成立——现行算法是 `let control = node; while (control !== domain && !isControl(control)) control = control.parentElement;`，节点**自己**是控件时原地停住。`div.hr-dropdown__item > span.hr-dropdown__item-text` 两层 `textContent` 都是「删除」、两层都被菜单档认成控件 → 收出**两个**控件 → 假 `ambiguous`，功能直接不通。

→ 补一步包含收敛：命中集内被另一命中节点包含者剔除，**只留最外层**（真实可点的那一层，且点它在真浏览器里等价）。互不包含的两个同名菜单项仍判 `ambiguous`，fail-safe 一寸没让。这条写进 `plan.md` §3.4 并进金牌夹具（嵌套两层同文本 → 必须收敛成恰 1）。

---

## 三 菜单浮层选择器：怎么选才不自造歧义

- `DIALOG_SELECTOR` 现集**不匹配** `.hr-popup.hr-dropdown`（逐 token 核过：`hr-dialog` / `role=dialog` / `role=alertdialog` / `hr-message-box` / `message-box ` / `popconfirm` 全不沾）。故菜单不会污染确认弹层的因果快照。**这条要进金牌**，不能只写在文档里。
- 反向：菜单选择器绝不能用裸 `.hr-popup`——`.hr-popup.hr-select__dropdown`（选择器弹层，`lib/agent-tool-compile.mjs:59` 在用）会被误抓。定为带 `hr-dropdown` token 的两条：`.hr-popup.hr-dropdown` 与 `.hr-dropdown__menu`。
- **嵌套自造歧义**：若浮层根是 `.hr-popup.hr-dropdown` 而其内层还有 `.hr-dropdown__menu`，两条同时命中 → 2 个「新浮层」→ 假 `ambiguous`。→ 归一：物理去重后**只留最外层**（被别的命中节点包含者剔除）。两个真正互不包含的浮层仍判 `ambiguous`，fail-safe 不变。
- 隐藏副本（2026-07-02 实采：菜单有隐藏多份）由既有 `visible()` 谓词滤掉。**这条也要进金牌夹具**。

---

## 四 悬停：算不算对 SUT 动手

`.agent-card__more` 很可能 `display:none` 到悬停才出。真机清理脚本（`cleanup-agents.mjs:41`）就是先 `card.hover()` 再点。

- 悬停是纯读性交互（不改业务对象、不发非读请求），与「破坏性动作」不同档；但它确实是一次真实交互，**只允许发生在目标卡片已唯一锁定之后**。
- 顺序定死：钉根 → 重扫唯一 → `hover` 卡片 → 数更多操作钮 → 恰 1 才 pin → 重验 → 点。
- `hover` 抛错 → `action_failed`，绝不硬点。

**定案：允许悬停，但排在唯一性锁定之后。**

---

## 五 `deleteButtons` 计数口径（任务书点名要在 GRILL 里论证的二选一）

现状链条：`inspectWorkflowDeleteTarget.deleteButtons` → `auditDeleteCount` → `summarizeDeleteCountAudit` → 「记录容器数 == 删除目标数」才准继续破坏性删除。今天卡片布局出 1:0 → `equal:false` → 编译期硬阻断。

| 选项 | 做法 | 代价 |
|---|---|---|
| 甲：新增字段表达 | `deleteButtons` 保持「直见删除钮」，另加 `menuDeleteEntries`，并改 `summarizeDeleteCountAudit` 消费新字段 | `summarizeDeleteCountAudit` 被**三份冻结金牌**钉着（`p0-p2-report-delete`、`p3-compile`、`units/p3-compile-unit`，分属三个 `prd`）。改它的派生逻辑要动三处冻结面，风险与本契约收益不成比例 |
| 乙：`deleteButtons` 改口径为「可达删除面」 | `deleteButtons` = 直见删除钮数 + 更多操作入口数；`summarizeDeleteCountAudit` **零改动**；同时**加法**新增 `directDeleteButtons` / `menuDeleteEntries` 两个纯诊断字段留证 | 口径变了要说清：它数的是「这条记录有几个可达删除入口」，不是「有几个写着删除二字的钮」 |

**定案：乙。** 理由三条：

1. 汇总器要证的不变量本来就是「一条记录 ↔ 一个删除入口」的**基数**恒等，不是字面量统计。卡片布局里那个入口就是更多操作钮。口径改成「可达删除面」后，不变量语义反而更准。
2. 三份冻结金牌全部只对 `summarizeDeleteCountAudit` 这个纯函数喂字面量断言，乙不碰它 → 冻结面零触碰（护栏：`testChecksums` 冻结件对实现者只读）。
3. 甲的「不变量弱化」担心在乙里由**分工**补上：审计只证基数，「菜单里到底有没有删除项」由触发环在点击前证——菜单内「删除」命中 0 就 `none`、多命中就 `ambiguous`，编译期照样硬阻断。两道都 fail-closed，没有 fail-open 缝。

**配套定案：审计环绝不悬停、绝不开菜单。** 审计是编译期只读对账，开菜单是有副作用的交互，且菜单是瞬态的。故 `menuDeleteEntries` 按**存在性**数（容器可见 + 容器内 `.agent-card__more` 节点存在），不要求该钮当前可见；可见性由触发环在点击前实证。这一分工要原样写进代码注释和 `plan.md`，不许后人误读成「审计放行了不可见的钮」。

（反对意见记录：存在性计数对「钮存在但永不可见」的病态形状是弱的。我认为可接受——那种形状触发环必然 `action_failed`，破坏性动作仍不发生。）

---

## 六 卡片路径的入场判据：怎么保证表格布局一字不动

**定案：只在现行路径吐出 `none` 时才进卡片路径。**

```
result = performLockedAction(page, { root, actionText: '删除', ... })   // 逐字不变
if (result.resolution === 'none') result = <卡片悬停菜单路径>
```

- 表格布局（直见删除钮 1 命中）→ `unique`，卡片路径**根本不执行**，调用参数、顺序、返回值全部同一。
- 多命中 → `ambiguous`，短路，不进卡片路径（多命中是既有的具名拒，卡片路径不许给它开后门）。
- `action_failed` → 短路。
- `none` 是今天的死胡同，只有它被接管。**新路径只吃旧路径已经放弃的分支**，这是「一字不得变」最强的形式化表述。
- 若某条记录既有直见删除钮又有更多操作钮：直见优先（保表格语义），同时审计口径会数出 2 ≠ 1 记录容器 → 编译期 `equal:false` 硬阻断。两侧自洽。

**冻结金牌的静态约束（实现时必须满足，已逐条核过 `workflow-delete-causal-binding.static.golden.mjs`）**：

- C4 要求在 `performWorkflowDeleteTrigger` 函数体内，源码顺序 `baselineDialogs = await dialogDomains(page)` < `performLockedAction(page` < `waitForCausalDialog(page, baselineDialogs)`。
  → 弹层基线快照必须仍在**任何点击之前**取（这也正是语义上对的：菜单浮出前就固定弹层基线）；且函数体内必须**保留**字面 `performLockedAction(page` 调用（表格路径原地保留即满足）。
- C0 空 `expectedName` 零页面读取：新逻辑一律排在该早退之后。
- `checksum-drift-closure` C3：`lib/workflow-delete-domain.mjs` **不得出现顶层 `import`**（`/^import\s/m` 必须为 false）。→ 卡片路径的一切辅助件**只能内联在本模块**，不许拆新文件再 `import` 回来。这条我差点踩。
- `real-run-trust`：源码须仍含 `waitForTargetRecordDomain` 与 `TARGET_RECORD_TIMEOUT_MS`。（注：该金牌**基线即红**，`exit=1`，非本契约引入，见 §九。）
- `regress-agent-tool-actions`：本模块须仍含 `options.searchBoxName || SEARCH_BOX_NAME`；`lib/agent-tool-actions.mjs` 不得出现 `.last(` / `.nth` 全页取钮模式。新代码同样不许用。

---

## 七 失败分类表（卡片路径每一步映到哪个 `resolution`）

| 情形 | 出 | 理由 |
|---|---|---|
| 卡片域内更多操作钮 0 命中（悬停后） | `none` | 入口缺席，与旧路径同族 |
| 更多操作钮 >1 命中 | `ambiguous` | 具名拒，绝不取 first |
| 悬停/点击抛错、pin 写不进、重验失配 | `action_failed` | 与既有 `performLockedAction` 同族 |
| 点更多操作后无新浮层（超时 3000 ms） | `none` | 菜单没出来，等同入口缺席 |
| 点更多操作后 >1 个新浮层 | `ambiguous` | 因果授权不唯一 |
| 物理身份比较器抛错 | `action_failed` | 同 `classifyCausalDialog` 既有分支 |
| 菜单内「删除」0 命中（例如只有 编辑/复制/停用） | `none` | 任务书点名要的具名拒 |
| 菜单内「删除」>1 命中 | `ambiguous` | 具名拒 |
| 菜单浮出后目标卡片不再唯一锁定 | `action_failed` | 重渲染换根，绝不误删邻居 |

零 `first()`、零坐标兜底、零「取最后一个」。全部 fail-closed。

---

## 八 菜单开着没点成，要不要收拾

失败后菜单可能仍浮着，遮挡后续步。

- **定案（协调方已裁：接受，附加「失败不得吞」）：尽力关闭（按 `Escape`），绝不允许收拾动作改写动作轴。**
- 与既有 `dispose` / `clearPin` 的清理纪律（源码注释原话「清理不得覆盖动作轴」）同族，但**不照抄它们的裸 `catch`**：收拾结果落具名字段 `menuCleanup`（`'closed'` / `'failed'`），失败留证不消失，只是不参与 `resolution` 判定。
- 反对意见（保留在案）：按 `Escape` 也是一次真实交互。我认为可接受——它是取消语义、只关自己开的浮层，且删除链此时已判失败。退路是「不收拾」，代价是回放侧残留浮层连累后续步定位，两害相权选收拾。

---

## 九 本契约**不**碰的相邻缺口（查到了，如实挂账，不夹带）

1. **搜索框按 Enter 不过滤**（2026-07-31 seam-1）：真机上填名后按 Enter，`.agent-card` 计数 15 秒恒定不动；正确触发是 `.hr-input__suffix .search-icon`。冻结流 `atstep_11 press Enter` 照今天真机跑不产生过滤。删除域本身**不依赖**过滤（`recordDomains` 是全页按精确名扫记录容器），故本契约的改动不因它失效；但 B4 重编译链上这一步是**独立的第二个坑**。
2. **`countSelector` 用的是 `.hr-card.hr-card--bordered`**（`workflow-delete-real-uat` 金牌钉着 `'.hr-card.hr-card--bordered:has-text("atl_r1")'`），而今天的卡片是 `.agent-card`。若两者不同源，删后归零断言可能从 0 数到 0 出假绿。属冻结件 + 真机取证面，本契约不动。
3. `lib/compile-atoms-agent.mjs:194` 调 `inspectWorkflowDeleteConfirm` 但该模块**未 import 该标识符**（模块内既无导入也无本地定义），`agent.delete` 编译路径命中该分支会抛 `ReferenceError`。与 `01e965f` 修的是同一类拆文件漏导入。**不在本契约范围**（碰它要动 `lib/`，且属另一条原子链），如实上报。
4. `tests/_golden/real-run-trust.zero-sut.golden.mjs` 基线即红（`exit=1`），非本契约引入，`loop/prd-agent-id-readback.json:186` 有账。
5. 形状实采残留对象 `atl_shape0804a` 仍在真机，清理义务在 B4 段。

---

## 十 统一语言

新概念一个：**因果菜单授权**（Causal Menu Authorization）——「只接受由点击目标记录的更多操作入口后恰好新出现的那一个浮层菜单作为删除项的取值域」。它是既有 `容器归属闸` 在浮层场景下的对位物：容器归属闸给结构性归属，因果菜单授权给因果性归属。

按 ADR-0005，造词须先登记 `CONTEXT.md`。**定案：`plan.md` 里申报登记，实现波次落地时同步写 `CONTEXT.md`（Casey 核心域表）。** 本轮只申报不写表——`CONTEXT.md` 被九个 `prd` 的 `testChecksums` 引着，改它属加严面，要连带跑术语表完整性检查与全仓漂移扫，放实现波做。

---

## 十一 零 SUT 金牌怎么保真到「被调用的形状」级

被测函数全程只经这些外部面（逐个从 `lib/workflow-delete-domain.mjs` 里数出来的，替身必须条条兑现）：

- `page.getByRole('textbox', { name, exact })` → `.count()`、`.first().inputValue()`
- `page.locator(sel)` → `.elementHandles()`、`.evaluateAll(fn, arg)`
- `page.waitForTimeout(ms)`、`page.evaluate(fn)`
- `handle.evaluate(fn, arg)`（fn 在替身里**真跑**，故须提供 `window.getComputedStyle`、`node.querySelectorAll`、`getBoundingClientRect`、`classList`、`isConnected`、`contains`、`setAttribute`/`getAttribute`/`removeAttribute`、`parentElement`、`tagName`、`textContent`）
- `handle.hover()`、`handle.click({ timeout })`、`handle.dispose()`

仓内**无** `jsdom` 一类依赖，且零 SUT 金牌不许引外部依赖（`hermetic-golden-sut-census` 扫全仓 golden 的启 SUT 闭集，必须恰为 30 不漂）。→ 替身是自建的最小 DOM 模型 + 一个 `page` 门面，纯进程内、零网络、零子进程、零浏览器。

近例教训按住：`.first()` 的返回值还会被继续调 `.inputValue()`；`.locator()` 的返回值既被调 `.elementHandles()` 也被调 `.evaluateAll()`。替身按**调用链**建模，不按单次调用建模。

---

## 十二 须人裁 —— 已裁定（协调方 2026-08-04 回，逐条落 `plan.md`）

| # | 问的事 | 裁定 | 落点 |
|---|---|---|---|
| 1 | 确认环不改（§〇 纠正任务书的「删除」候选） | **准**。标签分流二义的理由成立，17 条实删互证是权威证据 | `plan.md` §二 非目标 1 |
| 2 | `deleteButtons` 口径改「可达删除面」（§五 乙） | **准**。附加条件：加法字段只作证据投影，**不得被下游当权威消费**（评审会核） | `plan.md` §3.5 + 验收点 A13（静态扫 `lib`、`bin` 零引用） |
| 3 | 失败后按 `Escape` 收拾菜单（§八） | **接受**。附加条件：写进交互清单，且 `Escape` 失败**不得吞**——具名记录 | `plan.md` §3.2b 交互清单 + `menuCleanup` 具名字段 + 验收点 A12 |
| 4 | `CONTEXT.md` 登记「因果菜单授权」放实现波（§十） | **同意本轮只申报**。附加条件：登记必须与该词首次进生产件**同波**落地，不许滞后（ADR-0005） | `plan.md` §3.7 |
| 5 | §九 三条相邻缺口怎么排 | `compile-atoms-agent.mjs:194` 漏导入已由协调方实证并另派 `light` 契约修，本契约不管；seam-1 与 `countSelector` 陈旧风险**只记账**，B4 preflight 逐条真机核；主树基线双红与 `atl_` 残留已在总账 | `plan.md` §七之二 B4 前置检查单 |

裁定 3 的一处实现边界（我查过才写的，不是假设）：`menuCleanup` 到删除域返回值为止。编译侧 `lib/compile-atoms-run.mjs:155-158` 只取 `resolution` / `candidateCount` / `identityReadback`，回放侧 `lib/replay/history.mjs` 只由 `axis.resolution` 派生 `locatorResolution`——两处都是白名单投影。好处是该字段不会漏进冻结的 `run-history.schema.json`（`additionalProperties:false`）；代价是它也不会自动出现在回放历史里。要不要让它上去是动冻结接缝的独立决策，本契约不做，已记 `observability` 第 5 条。
