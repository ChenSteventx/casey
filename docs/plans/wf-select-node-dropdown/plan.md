# wf-select-node-dropdown — plan（light，起草待 grill）

画布维度第四原子 `workflow.selectNodeDropdown`：在已打开的节点配置抽屉里选一个 HEREN select
下拉（点第 `nth` 个「请选择」触发器 → 弹层 `.hr-select-option` 选项 → 选中回读触发器值）。抽屉族
第二原子（前置必先 `workflow.openNode` 开抽屉）。决策全录 `docs/plans/wf-select-node-dropdown/proposed/GRILL.md`
（D1 交互形态 / D3 承载动作复用 click 而非 selectOption 的 schema 铁证 / D4 按原子分发域锁门 /
D5 触发器值回读判据 / D8 例翻涟漪）。金牌形态录 `proposed/GOLDEN-TESTPLAN.md`。

> 本包为**起草草稿**（未 `contract init`、未冻结、未实现）。GRILL 里的定夺是起草建议，标「待
> Steven grill」处仍是开放分岔；真机 DOM 未知处一律挂 route:human。参照的直接范式 = 画布第三原子
> `docs/plans/wf-open-node/`（plan + proposed/GRILL + learn）。

## 0. 车道判定：light（起草建议）

镜像 `wf-open-node` D2：本契约要加 `doSelectNodeDropdown` 专用回放门新分支（`lib/replay-actions.mjs`
按 `ev.atom` 分发），比纯加法原子多一块机制件——加 plan 门便宜，异构评审深度不豁免。故 light（与
openNode 同形）。若 grill 认为可退到 direct，须先证「新回放门无隐性缝」——起草不主张退。

## 1. 契约本体（纯加法，零冻结 schema 改动）

### 1a. lib/compile-atoms.mjs — compileWorkflowSelectNodeDropdown

- 分派表 `COMPILE_ATOM_COMPILERS` 加 `'workflow.selectNodeDropdown'` 条目；`COMPILE_KNOWN_ATOMS`
  16→17 由键派生（不手改 Set、不扩动作枚举——见 D3：复用既有 `click` 动作 + 既有事件属性 `nth`/`text`，
  `additionalProperties:false` 与 `allOf` 全过，零冻结改动）。
- 预检域锁抽屉门（emit 的 customAct 通路不走定位核验，此处自证——镜像 openNode 预检 + addNode 源身份门）：
  域 `.hr-drawer__content-wrapper`（节点配置抽屉，前置 openNode 已开）内定位第 `nth` 个「请选择」触发器
  （`params.nth` 缺省 0）；域内触发器 count 须覆盖 `nth`（`nth < count`），否则 blocker 硬阻断
  （fail-closed，route:human）。**域内唯一才点**的落法见 D4：缺省 `nth=0` 且域内恰 1 个「请选择」→
  唯一者；多「请选择」+ `nth` 显式下标是确定性消歧（非坐标兜底），但这是待 Steven grill 的分岔（见 D4）。
- 触发器箱 + 选项浮层：点触发器 → 限时等可见选项浮层 `.hr-select-option`（作用域限可见弹层，
  防 compile-atoms:715 记录的「选项浮层 teleport 到 body、全局 text 撞列表页」真缝）；给了 `option`
  则浮层内目标选项 **精确/唯一才点**（浮层内 count 恰 1 才点、多匹配 → blocker、缺席 → blocker），
  未给 `option` 则点第一项（`.hr-select-option` 首项）。
- `emit({ atom:'workflow.selectNodeDropdown', action:'click', nth, text:option?,
  semantic:{kind:'text',name:'请选择',exact:true} }, customAct)`；customAct = 点第 `nth` 触发器 →
  点目标选项（两击内聚在 customAct 里，镜像 doOpenNode 把 mouse.click 内聚、doConnectNodes 把拖拽内聚）。
- 后置核验进 blockers（镜像 openNode/connectNodes）：**触发器值回读**——第 `nth` 触发器显示值不再是
  「请选择」，且（给了 option 则）**精确含** option 文本；证不出 → blocker 硬阻断；过 → notes 落
  「节点下拉已选中（〈nth〉/〈option〉）」证据。编译门与回放门同刻（同域锁 + 同浮层作用域 + 同精确回读）。

### 1b. lib/replay-actions.mjs — doSelectNodeDropdown 专用回放门

- `performAction` 分发（在 `doOpenNode` 分发行之后、通用 `doSelect` 之前，镜像 openNode 分发位）：
  `ev.action==='click' && ev.atom==='workflow.selectNodeDropdown'` → `doSelectNodeDropdown`。
  **不复用通用 `doSelect`**——`doSelect` 按 `getByRole('combobox',{name:fieldLabel})` 全页定位，
  节点抽屉「请选择」触发器非 role=combobox-带名（registry：placeholder 触发器 + `.hr-select-option`
  弹层），全页 combobox 门必 count=0 兜空 / 或撞既有分类下拉 → 合法选择回放假失败（同 openNode 的
  「全页门必撞多匹配」两扇门缝、wf-add-node R1-F2 同型）。
- `nth`/`option` 从 `ev.nth`（缺省 0）/ `ev.text` 取；语义证不出（无法定位抽屉/触发器）→ action_failed，不猜。
- 域锁 `.hr-drawer__content-wrapper` 内「请选择」触发器：缺席守卫（`waitFor` try/catch 不抛穿，
  codex R2-F1 先例——抽屉未开/无下拉 → 单步降级 none，非崩整轮回放）；触发器 count 0 或 `nth` 越界 → none。
- 点第 `nth` 触发器 → 限时等可见选项浮层 `.hr-select-option` → 浮层内目标选项：**唯一才点**
  （多匹配 → `ambiguous` 绝不点，统一身份门同律；缺席 → action_failed）；未给 option → 点首项。
- **身份回读**（点后）：重读第 `nth` 触发器显示值——不再是「请选择」且（给了 option 则）**精确含**
  option 文本（`filter({ has: getByText(option,{exact:true}) })` 非子串 `hasText`——openNode F1 教训：
  子串会把「选错项/写错值」误判选对）→ 成立 = unique + identityReadback ok:true；证不出 =
  action_failed + ok:false（防「点了没选中 / 选错项」两向假绿，护栏 #14）。

### 1c. tests/fixtures/fake-sut/server.mjs — 节点抽屉下拉纯加法

- `renderCanvas` 内节点抽屉（现仅渲标题，wf-open-node 加的 `nodeDrawer`）追加：抽屉里渲一个「请选择」
  下拉触发器（`.hr-select`，文本初值「请选择」）+ 点开后可见选项浮层（`.hr-select-option` 数项，
  含 registry SOP 最小复现的选项集）；点选项 → 触发器文本改为该选项 → 身份回读的地面真值。
  纯加法、既有 openNode 标题通路 + addNode/connectNodes 通路零行为差。
- 反面模式由 fixture 场景控（replay 的 nav 走 `pathOf` 剥 query，openNode learn #3 坑——不能用 URL query，
  用场景，既有场景一律缺省行为、零影响）：
  - 缺省场景（happy 等）：单下拉、选项唯一、点选后触发器值 = 精确选项（正路）；
  - `ddmulti`（**多匹配**）：选项浮层里目标选项文本出现两次 → 浮层内 count=2 → ambiguous 绝不点，钉身份门多匹配；
  - `ddabsent`（**目标缺席**）：浮层不含请求的 option → count=0 → action_failed，钉目标缺席；
  - `ddwrong`（**选错项/写错值**）：点了目标选项但触发器值更新成含子串非精确的错值（如 option+「副本」）→
    精确回读拒认 → action_failed，钉「点了但没选对」假绿（openNode drawersuperset 的下拉版、F1 精确回读同律）。
- 域内唯一闸考场（**当时无知识的反例**，见 §2/D8）：`ddtwin` 场景——抽屉挂两个「请选择」触发器、
  且目标选项文本在两浮层各出现一次 → 非域锁/全页 option 门 count=2 必 ambiguous 卡死；唯 `nth` 域锁 +
  可见浮层作用域的 `doSelectNodeDropdown`（域内 count=1）才 unique。这是 +1 原子翻面的反例（对应
  openNode 的「面板开着全页门必 ambiguous、唯域锁门过」）。

## 2. 金牌 tests/_golden/wf-select-node-dropdown.golden.mjs（红先行，镜像 wf-open-node 形制）

详见 `proposed/GOLDEN-TESTPLAN.md`。要点：

- C1 selectNodeDropdown 可编译 + `COMPILE_KNOWN_ATOMS` 恰 17 + `agent.openToolPicker` 仍不可编译
  （继任反例真缝、长寿，agent_tool 维度整体压后）。
- C2 端到端 happy：compile `[nav.workflowManagement, workflow.open, workflow.addNode(宿主节点),
  workflow.openNode(宿主节点), workflow.selectNodeDropdown(option)]` → events 末步 =
  `{atom:workflow.selectNodeDropdown, action:click, nth, text:option, semantic text 请选择}` →
  过 events.schema（复用手写校验器，`click` + `nth`/`text` 全属既有属性、`allOf` 不触发 selectOption 的
  dropdownUnit 强制）→ blockers 空 + compile-report 含触发器回读证据 → draft(+patch)→sign→casey run→
  verdict 全 intent PASS。**本金牌最大钉位**：`ddtwin` 语境下全页/非域锁 option 门必 ambiguous、
  唯域锁门过（证回放走专用门、编译门=回放门同刻）。
  计数通道单选（wf-connect-nodes learn #5 既定约束、openNode 沿用）：selectNodeDropdown intent 用
  `textVisible`（选中 option 文本在抽屉内可见）作硬断言——**不抢** openNode 已占的 countChange 抽屉
  0→1 通道（抽屉此时已开、不再变），每 intent 各一硬断言防 INDETERMINATE。
- C3 fail-closed 族（编译面预检 blocker + 回放面身份门三态）：
  - a 编译面·抽屉未开/无下拉（未 openNode 即 selectNodeDropdown）→ 预检域锁触发器 count=0 →
    blocker 点名证不出、exit 65、零 events、无谎报 acted；
  - b 编译面·`nth` 越界（抽屉 1 下拉、`nth=1`）→ 预检 `nth ≥ count` → blocker exit 65 绝不点；
  - c 回放面·抽屉未开（手编 events）→ `doSelectNodeDropdown` 缺席守卫优雅 none 不崩、verdict 不 PASS；
  - d 回放面·选项多匹配（`ddmulti`）→ ambiguous 绝不点、candidateCount 恰 2、触发器值不变 → verdict 不 PASS；
  - e 回放面·选错项/写错值（`ddwrong`：触发器值含子串非精确）→ 精确回读拒认 action_failed → verdict 不 PASS；
  - f 回放面·目标缺席（`ddabsent`：浮层不含 option）→ action_failed → verdict 不 PASS。
- 红先行：实现前全红（selectNodeDropdown 无编译知识 → C1/C2/C3a-b compile 面即红；C3c-f 回放门缺席红；
  `ddtwin` 非域锁门 fallback/ambiguous 实锤红）。

## 3. 例翻 + 重签（GRILL D8）

- 五金牌「集 16」→ 17（注释同步）：全仓 `grep 'COMPILE_KNOWN_ATOMS.size !== 16'` 恰这五处——
  `flow-bridge.golden:184` / `wf-add-node.golden:113` / `wf-connect-nodes.golden:94`（注 9） /
  `wf-open-smoke.golden:55`（注 52） / `wf-open-node.golden:94`（注 10/91/95）。
  `agent.openToolPicker 不可编译` 断言**不翻**（长寿继任反例，agent_tool 维度整体压后）——只翻计数。
- prd 重签（golden checksum 棘轮）：`prd-flow-bridge` / `prd-wf-add-node` / `prd-wf-connect-nodes` /
  `prd-wf-open-smoke` / `prd-wf-open-node`（openNode 自身 prd 本轮首次因 +1 原子重签）。
- fake-sut/server.mjs 夹具改动（下拉通路 + `ddmulti`/`ddabsent`/`ddwrong`/`ddtwin` 场景）→
  `prd-p5-replay` 夹具 checksum 重签 + 全消费者 golden 复跑。
- 新冻 `prd-wf-select-node-dropdown`（wf-select-node-dropdown.golden.mjs）。
- 涟漪回归全绿：e2e-chain / p3-compile / run-history / seams-freeze(-v2) / p5-replay / tier1。
- gate 七 prd 全 GREEN（六重签 + 一新冻）。

## 4. 验收

- 金牌 wf-select-node-dropdown C1–C3f 全绿，且实现前有红先行证据（全红实录）。
- 五例翻金牌 + p5-replay + e2e-chain + p3-compile + tier1 涟漪回归全绿（零行为差）。
- gate 七 prd 全 GREEN：prd-wf-select-node-dropdown 新冻 + 六重签（flow-bridge / wf-add-node /
  wf-connect-nodes / wf-open-smoke / wf-open-node / p5-replay）。
- codex 异构评审 PASS（Claude 实现 → codex 评，正向归属）。

## 5. 非目标 / 挂账

- `setNodeField`：贪心序下一契约（本原子解锁 9/23 后续 `setNodeField` 再往上）。
- 真机采样 route:human 挂 prd observability（与 wf-add-node/connectNodes/openNode observability 合并行程）：
  ① 节点抽屉「请选择」触发器 + 选项浮层真实类名（hermetic 用 `.hr-select`/`.hr-select-option`，
  真机 HEREN 组件库同族假设待核——openNode 抽屉类名假设同挂账）；② 选后触发器值呈现是否精确含 option
  （D5 回读假设复核）；③ 多下拉抽屉里 `nth` 定位是否够（D4 分岔复核——真机下拉是否带可锚定的区分标签、
  可否弃 `nth` 走标签锚）；④ 贪心序「本原子解锁哪 9 条 R9 flow、第 9 条是哪条、选哪个 option 解锁下一格」
  待真机 flow 目录核。
- 语义精确用 `action:'selectOption'` 需触冻结 schema（扩 dropdownUnit 加 `nth` + 放松 required
  `fieldLabel/optionText`）——本契约不碰（D3 定 click 零冻结路），若日后要另开触 schema 契约。
- registry 选后「输入区按入参自动填充」等下游联动不进本原子（差异记 learn）。
- 不动 events.schema/verdict/gate 冻结内核；不建 cases/ 真用例；不碰 heal；不动 report-workflow-structure
  结构覆盖（selectNodeDropdown 入结构覆盖属 report-spec #11 per-node 细分、另账）。
