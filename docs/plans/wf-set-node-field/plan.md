# wf-set-node-field — plan（light，Steven 授权本轮自主 draw→freeze→implement）

画布维度第五原子 `workflow.setNodeField`：在已打开的节点配置抽屉里，按 placeholder 填某个文本字段
（如 HTTP 节点 URL：placeholder「请输入接口的URL」），填后精确 value 回读。抽屉族第三原子（前置必先
`workflow.openNode` 开抽屉——registry `lib/atoms-registry.snapshot.json:252` `requires:["节点抽屉已开"]`）。
决策全录 `docs/plans/wf-set-node-field/proposed/GRILL.md`（D1 交互形态 / D3 复用 fill 零冻结 schema /
D4 按原子分发域锁门 + 字段级唯一闸 / D5 填后精确 value 回读 / D8 例翻涟漪）。金牌形态录
`proposed/GOLDEN-TESTPLAN.md`。参照的直接范式 = 画布第四原子 `docs/plans/wf-select-node-dropdown/`，一字不让。

## 0. 车道判定：light

镜像 selectNodeDropdown D2：本契约要加 `doSetNodeField` 专用回放门新分支（`lib/replay-actions.mjs` 按
`ev.atom` 分发），比纯加法原子多一块机制件——加 plan 门便宜，异构评审深度不豁免。故 light。

## 1. 契约本体（纯加法，零冻结 schema 改动）

### 1a. lib/compile-atoms.mjs — compileWorkflowSetNodeField

- 分派表 `COMPILE_ATOM_COMPILERS` 加 `'workflow.setNodeField'` 条目；`COMPILE_KNOWN_ATOMS` 17→18 由键
  派生（不手改 Set、不扩动作枚举——见 D3：复用既有 `fill` 动作 + 既有事件属性 `value`/`nth`/`semantic`，
  `additionalProperties:false` 与 `allOf` 全过，零冻结改动）。
- 预检域锁抽屉字段门（emit 的 customAct 通路不走定位核验，此处自证——镜像 selectNodeDropdown 预检 +
  openNode 源身份门）：域 `.hr-drawer__content-wrapper`（节点配置抽屉，前置 openNode 已开）内
  `getByPlaceholder(placeholder,{exact})` 定位字段；字段级唯一闸（D4）：
  - `count===0` → blocker 硬阻断（fail-closed，缺席，route:human）；
  - 入参**未显式给 nth**：`count>1` → blocker（多匹配 ambiguous 绝不填首项，route:human）；`count===1` → 唯一者；
  - 入参**显式给 nth**：`nth≥count` → blocker（越界）；否则第 `nth` 个（确定性位置消歧，非坐标兜底）。
- `emit({ atom:'workflow.setNodeField', action:'fill', value, semantic:{kind:'label',name:placeholder,exact},
  [nth] }, customAct)`；customAct = `target.fill(instantiate(value,ctx))`（填值内聚在 customAct，镜像
  doSelectNodeDropdown 把两击内聚）。
- 后置核验进 blockers（镜像 selectNodeDropdown/openNode）：**字段 value 回读**——`target.inputValue()`
  **精确等于**实例化后的填入值；证不出 → blocker 硬阻断；过 → notes 落「节点字段已填入（〈placeholder〉=
  〈value〉，value 精确回读过）」证据。编译门与回放门同刻（同域锁 + 同 getByPlaceholder 口径 + 同精确回读）。

### 1b. lib/replay-actions.mjs — doSetNodeField 专用回放门

- `performAction` 分发（在 `doSelectNodeDropdown` 分发行之后、通用路之前，镜像分发位）：
  `ev.action==='fill' && ev.atom==='workflow.setNodeField'` → `doSetNodeField(page, ev, ctx)`。
  **不复用通用 `doAct`/`resolveCandidate`**——占位符锚不是 `semanticLocator` 的 label/text/role 命中口径，
  通用门必兜空或撞别处同名（同 selectNodeDropdown「全页 combobox 门必兜空」缝）。
- placeholder 从 `ev.semantic.name` 取、exact 从 `ev.semantic.exact` 取、value 从 `ev.value` 取、
  nth 从 `ev.nth`（仅显式给才有）取；语义证不出（无 placeholder/value）→ action_failed，不猜。
- 域锁 `.hr-drawer__content-wrapper` 内 `getByPlaceholder(placeholder,{exact})`：缺席守卫（`waitFor`
  try/catch 不抛穿，doOpenNode/doSelectNodeDropdown 先例——抽屉未开/无字段 → 单步降级 none，非崩整轮回放）；
  字段级唯一闸同编译门（未给 nth：count===1 才填、count>1 → ambiguous 绝不填首项；给 nth：nth<count 才填、
  越界 → none）。
- 填值 `target.fill(instantiate(value,ctx))`；**身份回读**（填后）：重读 `target.inputValue()` **精确等于**
  实例化后的填入值（非 `includes` 子串——F1 教训：子串会把「填错值/半填」误判填对）→ 成立 = unique +
  identityReadback ok:true；证不出 = action_failed + ok:false（防「点了没填 / 填错值」两向假绿，护栏 #14）。

### 1c. tests/fixtures/fake-sut/server.mjs — 节点抽屉可填字段纯加法

- `renderCanvas` 内节点抽屉（openNode/selectNodeDropdown 建的 `nodeDrawer`）追加：抽屉里渲一个可填 input
  （`.hr-input`，placeholder「请输入接口的URL」）；填值 → input 的 value = 该值（身份回读地面真值）。追加在
  `buildNodeSelect` 之后、`ddempty` 提前 return 之前不受影响 —— 纯加法、既有 openNode 标题 + selectNodeDropdown
  下拉 + addNode/connectNodes 通路零行为差。
- 反面模式由 fixture 场景控（非 URL query——replay nav 剥 query）：
  - 缺省场景（happy 等）：单字段、`getByPlaceholder` 域内唯一、填后 value = 精确填入值（正路）；
  - `setmulti`（**多匹配**）：抽屉挂两个同占位符 input → 域内 count=2 → 未给 nth 时 ambiguous 绝不填首项，钉字段级唯一闸；
  - `setclash`（**域锁反例**）：详情页在抽屉**外**再挂一个同占位符 input → 全页 count=2 必 ambiguous、
    唯域锁 `.hr-drawer__content-wrapper` 内 count=1 才 unique（selectNodeDropdown ddtwin 的填值版）；
  - 复用 `ddempty`（抽屉开无下拉且无字段）：域内 `getByPlaceholder` count=0 → 编译面预检 blocker（缺席半边）。

## 2. 金牌 tests/_golden/wf-set-node-field.golden.mjs（红先行，镜像 wf-select-node-dropdown 形制）

详见 `proposed/GOLDEN-TESTPLAN.md`。要点：

- C1 setNodeField 可编译 + `COMPILE_KNOWN_ATOMS` 恰 18 + `agent.openToolPicker` 仍不可编译。
- C2 端到端 happy：compile `[nav.workflowManagement, workflow.open, workflow.addNode(HTTP请求),
  workflow.openNode(HTTP请求), workflow.setNodeField(placeholder,value)]` → events 末步 =
  `{atom:workflow.setNodeField, action:fill, value, semantic:{kind:label,name:placeholder,exact}}` →
  过 events.schema（`fill` + `value`/`semantic` 全属既有属性、`allOf` fill 只要求 value）→ blockers 空 +
  compile-report 含字段回读证据 → draft→sign→casey run→verdict 全 intent PASS + setNodeField intent
  动作轴 identityReadback ok:true（**门内精确 value 回读 = 断言字段 value 含期望**）。
  **本金牌钉位**：`setclash` 语境下全页/非域锁 `getByPlaceholder` 门必 ambiguous、唯域锁门过（证回放走
  专用门、编译门=回放门同刻）。setNodeField intent 的每-intent 硬断言由全局取证（noPageError/noErrorEnvelope）
  兜底、PASS 由「动作轴 ap（门内 value 精确回读成立）+ 全局取证无错」共同得出（不抢 openNode 已占的抽屉
  countChange 0→1 通道、不用 value 看不到的 textVisible）。
- C3 fail-closed 族（编译面预检 blocker + 回放面身份门三态）：
  - a 编译面·无字段（ddempty，抽屉开但域内无 input）→ 预检 count=0 → blocker exit 65、零 events、无谎报 acted；
  - b 编译面·多匹配未给 nth（setmulti）→ 预检 count>1 → blocker exit 65 绝不填首项；
  - c 编译面·nth 越界（抽屉 1 字段、nth=1）→ 预检 nth≥count → blocker exit 65；
  - d 回放面·抽屉未开（手编 events）→ `doSetNodeField` 缺席守卫优雅 none 不崩、verdict 不 PASS；
  - e 回放面·多匹配未给 nth（setmulti）→ ambiguous 绝不填首项、candidateCount 恰 2、verdict 不 PASS。
- 红先行：实现前全红（setNodeField 无编译知识 → C1/C2/C3a-c compile 面即红；C3d-e 回放门缺席红；
  `setclash` 非域锁门实锤红）。

## 3. 例翻 + 重签（GRILL D8）

- 六金牌「集 17」→ 18（注释同步）：`flow-bridge.golden:184` / `wf-add-node.golden:113` /
  `wf-connect-nodes.golden:94` / `wf-open-smoke.golden:55` / `wf-open-node.golden:94` /
  `wf-select-node-dropdown.golden:95`。`agent.openToolPicker 不可编译` 断言**不翻**——只翻计数。
- prd 重签（golden checksum 棘轮）：`prd-flow-bridge` / `prd-wf-add-node` / `prd-wf-connect-nodes` /
  `prd-wf-open-smoke` / `prd-wf-open-node` / `prd-wf-select-node-dropdown`（六例翻）+ `prd-p5-replay`
  （夹具 checksum）。**七重签**。
- 新冻 `prd-wf-set-node-field`（wf-set-node-field.golden.mjs）。
- 涟漪回归全绿：e2e-chain / p3-compile / run-history / seams-freeze(-v2) / p5-replay / tier1。
- gate 八 prd 全 GREEN（七重签 + 一新冻）。

## 4. 验收

- 金牌 wf-set-node-field C1–C3e 全绿，且实现前有红先行证据（全红实录）。
- 六例翻金牌 + p5-replay + e2e-chain + p3-compile + tier1 涟漪回归全绿（零行为差）。
- gate 八 prd 全 GREEN：prd-wf-set-node-field 新冻 + 七重签（flow-bridge / wf-add-node / wf-connect-nodes /
  wf-open-smoke / wf-open-node / wf-select-node-dropdown / p5-replay）。
- 异构评审 PASS（Claude 实现 → codex 评，正向归属；主环协调）。

## 5. 非目标 / 挂账

- `workflow.assertNodeFieldValue`（registry `:339` L1 断言）= 另契约：读 value 属性的独立断言 kind +
  采集通道 + 词表 + assert.* 映射；本契约判内核纯编译/回放、绝不碰 verdict/replay 采集，填值正确性由门内
  精确 value 回读守住。挂账贪心序下一契约。
- 真机采样 route:human（与 openNode/selectNodeDropdown observability 合并行程）：抽屉可填字段真实类名/
  placeholder 文本；各节点类型字段清单；多同占位符字段可否弃 nth 走标签锚；本原子解锁哪些 R9 flow。
- 不动 events.schema/verdict/gate 冻结内核；不建 cases/ 真用例；不碰 heal；不动 report-workflow-structure。
