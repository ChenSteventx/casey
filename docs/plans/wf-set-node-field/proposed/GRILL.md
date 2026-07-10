# wf-set-node-field — grill 决策记录（画布第五原子 workflow.setNodeField，light，起草）

> 背景：贪心序画布余量续建。addNode + connectNodes + openNode + selectNodeDropdown 已建
> （`COMPILE_KNOWN_ATOMS` 17），setNodeField 是抽屉族第三原子（前置必先 `workflow.openNode`
> 开抽屉——registry `lib/atoms-registry.snapshot.json:252` `requires:["节点抽屉已开"]`）。骑 openNode
> 建的画布节点抽屉夹具，零冻结 schema 改动。范式 = 画布第四原子 `docs/plans/wf-select-node-dropdown/`
> （plan + proposed/GRILL + GOLDEN-TESTPLAN），一字不让。
>
> **本文件是起草建议**（Steven 已授权本轮自主 draw→freeze→implement），逐条给分岔 + 证据 + 起草倾向。

## D1 交互形态：域锁抽屉内按 placeholder 定位字段 → 填值 → 精确 value 回读（起草建议）

- 证据（registry `lib/atoms-registry.snapshot.json:252`）：「在已打开的节点配置抽屉里，按 placeholder
  填某个文本字段（如 HTTP 节点 URL：placeholder「请输入接口的URL」）」；`params.placeholder`（必填）定位
  input/textarea、`params.value`（必填）填入值、`params.exact`（可选）占位符精确匹配、`params.nth`（可选、
  缺省 0）同占位符多个时取第几个；`post`「该字段被填入值」。
- 起草倾向：单原子 = 域锁 `.hr-drawer__content-wrapper` 内 `getByPlaceholder(placeholder,{exact})` 定位字段
  → 填值（收在一个专用门里，镜像 doSelectNodeDropdown 内聚两击、doOpenNode 内聚单击）+ 后置字段 value
  回读。不带重试启发式（一次填、回读不成如实落轴 fail-closed）。
- 与 selectNodeDropdown 的差异：下拉的选中值落进触发器可见文本（`assert.textVisible` 看得到），本原子的
  填值落进 input/textarea 的 `value` 属性（**非文本节点**，`page.getByText` / `assert.textVisible` 看不到，
  registry `:339` `assertNodeFieldValue` 头注亲述）。故「断言字段 value 含期望」不走 textVisible，走**门内
  精确 value 回读**（`inputValue()` 读 value 属性），由回放门吐 `identityReadback.ok`、金牌按动作轴核（D5）。

## D2 车道：light（起草建议）

- 分岔：先例 openNode / selectNodeDropdown 均走 light（加专用回放门新分支比纯加法多一块机制件）。本契约
  同样加 `doSetNodeField` 专用回放门 + 编译预检门 + 夹具反面场景——同形。
- 起草倾向：light（异构评审深度照旧不豁免）。若认为可退 direct 须先证新回放门无隐性缝——起草不主张退。

## D3 承载动作：复用 `fill`（零冻结 schema 改动）

- 定夺（起草强主张）：语义上这就是「填字段」，最自然是 `action:'fill'`（枚举已含）。查冻结 `events.schema`：
  `allOf` 里 `if action==='fill' then required:['value']`——只强制带 `value`；交互动作 anyOf 里 `fill` 只需
  `semantic|dropdownUnit|text|fieldLabel|role+accessibleName` 之一。全属既有约束，**零冻结 schema 改动**。
- 事件承载（全用既有顶层属性，`additionalProperties:false` 全过）：`value` 载填入值；`semantic:{kind:'label',
  name:placeholder,exact}` 载占位符锚 + 精确开关（满足 fill 的 anyOf、且把 placeholder 与 exact 收在一处，
  镜像 selectNodeDropdown 的 `semantic:{kind:'text',name:'请选择'}` 触发器锚）；`nth`（integer≥0，既在 event
  properties）**仅在入参显式给** 时载下拉下标外的字段下标消歧（见 D4）。
- 注：`semantic.kind` 冻结枚举只有 role/label/text 三选（无 placeholder 槽）。回放门 `doSetNodeField` **不走
  通用 `semanticLocator`**（它按 `ev.atom` 分发在通用路之前拦截），门内直接 `getByPlaceholder`——故 semantic
  是**名义锚 + schema 满足**（同 selectNodeDropdown 的 semantic 名义性），选 `label`（占位符是字段的无障碍
  名/标签提示，最贴近）并在门内注明「读 `ev.semantic.name` 当 placeholder、门用 getByPlaceholder」。

## D4 编译门 ↔ 回放门按原子分发 + 字段级唯一闸（selectNodeDropdown 先例延续）

- 分岔：节点抽屉字段的 fill 若走通用 `doAct`（`resolveCandidate` → `semanticLocator` → getByLabel/getByText/
  getByRole）必失配——占位符锚不是 label/text/role 命中口径，通用门必兜空或撞别处同名。故 `performAction` 顶部
  按 `ev.action==='fill' && ev.atom==='workflow.setNodeField'` 分发专用 `doSetNodeField`（在 selectNodeDropdown
  分发行之后、通用路之前）——域锁 `.hr-drawer__content-wrapper` 内 `getByPlaceholder(placeholder,{exact})`。
- 字段级唯一闸（**fail-safe 核心**，起草强主张，codex HIGH「缺 option 多选项绝不点首项」先例的填值版）：
  - `count===0` → 缺席（编译面 blocker 硬阻断 fail-closed / 回放面 none 单步降级）；
  - **入参未显式给 `nth`**：`count===1` 才填（唯一）；`count>1` → **ambiguous 绝不填首项**（CONTEXT 登记词，
    route:human）——多个同占位符字段没给消歧就替用户猜首项 = fail-open 假绿，违铁律；
  - **入参显式给 `nth`**：确定性位置消歧（像 getByRole 的 nth-index）：`nth<count` 才填第 `nth` 个，
    `nth≥count` → 越界（编译 blocker / 回放 none）。
  这与 selectNodeDropdown 一致：选项/字段是「目标」，唯一或显式消歧才动，多匹配绝不猜。
- 编译侧 customAct 与回放门同刻（同域锁 + 同 getByPlaceholder 口径 + 同精确回读）。

## D5 身份回读：填后 `inputValue()` 精确等于填入值（起草建议）

- 证据：registry `post`「该字段被填入值」。`fill()` 清空后键入 → 填成功则 `inputValue()` **恰等于**填入值。
- 定夺（起草建议）：回读 = 填后重读目标字段 `inputValue()`，**精确等于**填入的（实例化后）值 → 成立 =
  unique + `identityReadback.ok:true`；不等（半填/截断/被改写/根本没填）= action_failed + ok:false。**精确等于**
  而非 `includes`（openNode/selectNodeDropdown F1 精确回读同律：`includes` 会把「value副本」超集误判填对——
  fail-open 假绿）。编译侧后置核验同款进 blockers 硬阻断。
- 金牌怎么断「字段 value 含期望」：门内精确回读吐 `identityReadback.ok`，金牌按**动作轴**核
  （`ax.action.identityReadback.ok===true` + `resolution==='unique'`），镜像 selectNodeDropdown 金牌 ddtwin
  按动作轴核 identityReadback。端到端 verdict 的每-intent 硬断言由全局取证（`noPageError`/`noErrorEnvelope`，
  synthesizeSkeleton 缺省加）兜底——setNodeField intent 的 PASS 由「动作轴 ap（门内精确 value 回读成立）+ 全局
  取证无错」共同得出，填错/半填 → 门 action_failed → ap=false → 绝不 PASS（护栏 #14）。
- 判内核不破：本原子**纯编译/回放**，回读全在门内（`bin/verdict.mjs` 一字不碰、不加断言 kind、不碰
  `bin/replay.mjs` 采集通道）。L1 断言原子 `workflow.assertNodeFieldValue`（registry `:339`，读 value 属性的
  独立断言 kind + 采集通道）是**另契约**（挂 D9 非目标）。

## D6 夹具：fake-sut 节点抽屉可填字段纯加法（复现接缝、不倒裁）

- 定夺（起草建议）：openNode/selectNodeDropdown 建的节点抽屉（`nodeDrawer`：标题 + 「请选择」下拉）追加一个
  可填 input（`class="hr-input"` placeholder「请输入接口的URL」，registry HTTP 节点 URL 字段例）；填值 → input
  的 `value` 改为该值（回读地面真值）。纯加法、既有 openNode 标题通路 + selectNodeDropdown 下拉通路 +
  addNode/connectNodes 通路零行为差（追加在 `buildNodeSelect` 之后、`ddempty` 提前 return 之前不受影响）。
- 反面场景（fixture 场景控，非 URL query——replay 的 nav 剥 query）：
  - `setmulti`（**多匹配**）：抽屉挂两个同占位符「请输入接口的URL」input → 域内 count=2 → 未给 nth 时
    ambiguous 绝不填首项，钉字段级唯一闸（编译面预检 + 回放面身份门）；
  - `setclash`（**域锁反例**，selectNodeDropdown ddtwin 的填值版）：详情页在抽屉**外**再挂一个同占位符
    input → 全页 `getByPlaceholder` count=2 必 ambiguous、唯域锁 `.hr-drawer__content-wrapper` 内 count=1 才
    unique，钉「回放走域锁专用门、非全页门」；
  - 复用 `ddempty`（抽屉开但无下拉**且无字段**）：openNode 开抽屉（registry 前置满足）但域内无 input →
    编译面预检 count=0 blocker（execute 预检的「无字段」半边，钉缺席 fail-closed）。
  夹具行为 = registry 真机 SOP 最小复现，不为金牌预定裁定倒着裁。

## D7 金牌 + 红先行（镜像 wf-select-node-dropdown.golden 覆盖形态）

- 定夺（起草建议）：新建 `tests/_golden/wf-set-node-field.golden.mjs`——C1 可编译 + `COMPILE_KNOWN_ATOMS`
  恰 18 + agent.openToolPicker 仍不可编译；C2 端到端 compile `[nav, open, addNode, openNode, setNodeField]`
  → events 末步 = setNodeField 的 fill（value / semantic label placeholder / 无 nth）→ 过 events.schema →
  blockers 空 + compile-report 含字段回读证据 → draft→sign→casey run→verdict 全 intent PASS + 动作轴
  identityReadback ok；C2-c `setclash` 域锁钉位（全页门 count=2 必 ambiguous、唯域锁门 count=1 unique）；
  C3 fail-closed 族：编译面·无字段（ddempty）count=0 blocker exit 65 / 编译面·多匹配（setmulti）未给 nth →
  ambiguous blocker / 编译面·nth 越界 blocker / 回放面·抽屉未开缺席守卫 none / 回放面·多匹配 ambiguous
  绝不填首项 candidateCount 恰 2。红先行：实现前全红（无编译知识 → C1/C2/C3 编译面即红；无回放门 → C2/C3
  回放面红；`setclash` 非域锁门实锤红）。详见 `proposed/GOLDEN-TESTPLAN.md`。

## D8 例翻涟漪 + 重签清单

- **六**金牌钉「集 17」全翻 18（selectNodeDropdown 那轮翻的五家 + `wf-select-node-dropdown.golden` 自身
  本轮进队第六家）：`flow-bridge.golden:184` / `wf-add-node.golden:113` / `wf-connect-nodes.golden:94` /
  `wf-open-smoke.golden:55` / `wf-open-node.golden:94` / `wf-select-node-dropdown.golden:95`（注释同步 17→18）。
  `agent.openToolPicker 不可编译` 断言**不翻**（长寿继任反例，agent_tool 维度整体压后）——只翻计数。
- fake-sut/server.mjs 夹具改动（可填字段 + `setmulti`/`setclash` 场景）→ `prd-p5-replay` 夹具 checksum 重签
  + 全消费者 golden 复跑。
- prd 重签（golden checksum 棘轮）：`prd-flow-bridge` / `prd-wf-add-node` / `prd-wf-connect-nodes` /
  `prd-wf-open-smoke` / `prd-wf-open-node` / `prd-wf-select-node-dropdown`（六例翻棘轮）+ `prd-p5-replay`
  （夹具 checksum）。**七重签**。
- 新冻 `prd-wf-set-node-field`（wf-set-node-field.golden.mjs）。**一新冻**。
- 涟漪回归全绿：e2e-chain / p3-compile / run-history / seams-freeze(-v2) / p5-replay / tier1。

## D9 非目标 / 挂账

- **`workflow.assertNodeFieldValue`（registry `:339` L1 断言）= 另契约**：读 input/textarea 的 value 属性、
  断言 value 含期望子串——需新增断言 kind（`lib/replay-assert.mjs` IMPLEMENTED_KINDS）+ 采集通道
  （`bin/replay.mjs` 代表步静默点）+ 词表（`bin/check.mjs`）+ assert.* 映射（`lib/assertion-draft.mjs`）。
  本契约**判内核纯编译/回放、绝不碰 verdict/replay 采集**（判内核铁律），故不做；本原子的填值正确性由**门内
  精确 value 回读**（动作轴 identityReadback）确定性守住。挂账贪心序下一契约。
- 真机采样 route:human（与 openNode/selectNodeDropdown observability 合并行程）：① 节点抽屉可填字段真实类名
  与 placeholder 文本（hermetic 用 `.hr-input`/「请输入接口的URL」，真机 HEREN 组件库同族假设待核）；② 各节点
  类型抽屉的字段清单（哪类节点有哪些 placeholder，hermetic 简化为所有节点同抽屉一字段）；③ 多同占位符字段
  真机是否带可区分锚（可否弃 nth 走标签锚，D4 分岔复核）；④ 贪心序本原子解锁哪些 R9 flow。
- 语义精确用别的 action 需触冻结 schema——本契约不碰（D3 定 fill 零冻结路）。
- 不动 events.schema/verdict/gate 冻结内核；不建 cases/ 真用例；不碰 heal；不动 report-workflow-structure
  结构覆盖。
