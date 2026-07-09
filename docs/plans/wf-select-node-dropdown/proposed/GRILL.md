# wf-select-node-dropdown — grill 决策记录（画布第四原子 workflow.selectNodeDropdown，light，起草）

> 背景：R9 画布余量续建（NEXT-SESSION「下一步」D 线 / HANDOFF:326）。addNode + connectNodes + openNode
> 已建（`COMPILE_KNOWN_ATOMS` 16），selectNodeDropdown 是抽屉族第二原子（前置必先 `workflow.openNode`
> 开抽屉——registry `requires:["节点抽屉已开"]`）。骑 openNode 建的画布节点抽屉夹具，零冻结 schema 改动。
> 贪心序：本原子解锁 9/23 条 R9 flow（wf-add-node/learn.md:30、HANDOFF:326）。
>
> **本文件是起草建议**（未经 Steven grill），逐条给分岔 + 证据 + 起草倾向；标「待拍板」处仍开放。

## D1 交互形态：域锁抽屉内点「请选择」触发器 → 选浮层项 → 回读触发器值（起草建议）

- 证据（registry `lib/atoms-registry.snapshot.json:319`，autotester 真机 SOP、下游数据库/知识库节点靠它
  跑通）：「点第 `nth` 个『请选择』触发器 → 弹层 `.hr-select-option` 选项」；`params.nth`（0 起、缺省 0）
  选第几个下拉、`params.option`（子串、缺省第一项）选哪项；`post`「该下拉已选中含 option 的项」。
- 起草倾向：单原子 = 两击内聚（点触发器 + 点选项，收在一个专用门里，镜像 doOpenNode 内聚 mouse.click、
  doConnectNodes 内聚拖拽）+ 后置触发器值回读。不带重试启发式（一次点、回读不成如实落轴 fail-closed）。
- 待拍板：`option` registry 语义是**子串**匹配，但 openNode F1 教训是「回读须精确、子串假绿」。起草折中——
  **点选项**可容子串（registry 语义）但须浮层内该匹配唯一（多匹配 ambiguous 绝不点）；**身份回读**须
  **精确含** option（`getByText(option,{exact:true})`）。这个「点松回读紧」是否可接受，Steven 定。

## D2 车道：light（起草建议）

- 分岔：先例 openNode 走 light（加 doOpenNode 专用回放门新分支比纯加法多一块机制件）。本契约同样加
  `doSelectNodeDropdown` 专用回放门 + 编译预检门 + 夹具反面场景——同形。
- 起草倾向：light（异构评审深度照旧不豁免）。若认为可退 direct 须先证新回放门无隐性缝——起草不主张退。

## D3 承载动作：复用 `click` 而非 `selectOption`（schema 铁证，零冻结改动）

- 分岔：语义上这是「选下拉」，最自然是 `action:'selectOption'`（枚举已含、通用 `doSelect` 已在跑
  `workflow.create` 的分类下拉）。但查冻结 `events.schema` 有硬约束：
  - `allOf` 条件式 `if action==='selectOption' then required:['dropdownUnit']`——selectOption 事件
    **强制**带 `dropdownUnit`；
  - `dropdownUnit` 定义 `additionalProperties:false` + `required:['fieldLabel','optionText','scope']`——
    **无 `nth` 槽**、且 `fieldLabel`/`optionText` 必填。
  - 节点下拉是 `nth` 定位（无 fieldLabel）+ option 可缺省（非必填）——与 dropdownUnit 的 required 三元
    直接冲突，且 `nth` 塞不进（additionalProperties:false 拒）。走 selectOption 就得**改冻结 schema**
    （扩 dropdownUnit +nth、放松 required）= 涟漪全金牌校验器 + 违「纯加法别扩枚举」姿态。
- 定夺（起草强主张）：**复用 `action:'click'`**（openNode「复用 click 零冻结」先例）。事件承载用**既有
  顶层属性**：`nth`（type integer≥0、既在 event properties）载下拉下标、`text` 载 option 文本、
  `semantic:{kind:'text',name:'请选择'}` 载触发器锚。全属既有属性 → `additionalProperties:false` 过、
  `allOf` 里 click 分支只要求 anyOf[semantic/text/...]（`semantic`+`text` 满足）→ **零冻结 schema 改动**。
  两击语义收在 `doSelectNodeDropdown` 门内（如 doOpenNode 把「单击开抽屉」收在门内）。
- 注：`nth` 现描述是「fallbackCss 命中多个时的下标消歧」——本原子把它当「抽屉内第几个下拉」用是语义
  微扩（同属「下标消歧」大类，未改类型/未加属性）。若 Steven 认为语义漂移不可接受，退路 = 触 schema
  契约扩 dropdownUnit（挂 §5 非目标）。**这是待拍板项**。

## D4 编译门 ↔ 回放门按原子分发 + 域内唯一闸（openNode 先例延续）

- 分岔：节点下拉的 click 若走通用 `doSelect`（`getByRole('combobox',{name:fieldLabel})`）必失配——
  HEREN 节点抽屉「请选择」触发器非 role=combobox-带名，全页 combobox 门 count=0 兜空、或撞既有「新增
  工作流」抽屉的分类 combobox → 合法选择回放假失败（openNode 全页门必撞多匹配、wf-add-node R1-F2 同型缝）。
- 定夺（起草建议）：`performAction` 顶部按 `ev.atom==='workflow.selectNodeDropdown'` 分发专用
  `doSelectNodeDropdown`（在 doOpenNode 分发行后、通用 doSelect 前）——域锁 `.hr-drawer__content-wrapper`
  内定位第 `nth`「请选择」触发器 → 点 → 可见浮层 `.hr-select-option` 内目标选项唯一才点 → 触发器值回读。
  编译侧 customAct 与回放门同刻（同域锁 + 同浮层作用域 + 同精确回读）。
- 待拍板（真机 DOM 未知，最关键开放项）：**「域内唯一才点」与 `nth` 定位的张力**。ADR-0007 身份门要
  「解析目标唯一 OR 点后回读成立」。单下拉抽屉（缺省 `nth=0`、域内恰 1「请选择」）天然唯一——干净。
  但多下拉抽屉（registry 例：数据库节点选库 + 或有它下拉）`nth` 是**确定性位置消歧**（非坐标兜底）。
  这算不算「唯一才点」？两条路：
  - 路 A（起草倾向、hermetic 走这条）：`nth` 是合法确定性消歧（像 getByRole 的 nth-index），身份靠**点后
    触发器值回读**兜底真相；金牌 happy 用单下拉抽屉（域内唯一）保干净，多下拉留 `ddtwin` 当反例钉位。
  - 路 B（更严）：多下拉时拒 `nth`、要求带可区分标签的锚（真机下拉多半有「数据库」「重排模型」等 label）。
  真机下拉是否带可锚定区分标签 = route:human 复核后定；起草落路 A 但明标此为 Steven grill 首要项。

## D5 身份回读：触发器值改「请选择」→ 精确含 option 双证（起草建议）

- 证据：registry `post`「该下拉已选中含 option 的项」；真机选后触发器值变「分类 / 工具」(selectMcpTool)
  或「〈选项〉」——值改动是选中的地面真值。openNode 抽屉容器类名真机未采样（挂 route:human），
  下拉触发器/浮层类名同未采（hermetic 用 `.hr-select`/`.hr-select-option`，真机 HEREN 同库假设待核）。
- 定夺（起草建议）：回读 = 点选项后重读第 `nth` 触发器显示值——① 不再是「请选择」（选了）且 ② 给了 option
  则 `filter({ has: getByText(option,{exact:true}) })` **精确含**（选的是这项、非选错/写错）——双证防
  「点了没选中」「选错项/写错值」两向假绿（openNode drawersuperset 子串假绿的下拉版、F1 精确回读同律）。
  证不出 → action_failed / identityReadback ok:false 如实落轴。编译侧后置核验同款进 blockers 硬阻断。
  真机触发器值呈现是否精确含 option → 挂 observability route:human（合并行程顺带采样）。

## D6 夹具：fake-sut 节点抽屉下拉纯加法（复现接缝、不倒裁）

- 定夺（起草建议）：openNode 加的 `nodeDrawer`（现仅渲标题）追加：抽屉里渲「请选择」触发器
  （`.hr-select`）+ 点开可见选项浮层（`.hr-select-option` 数项）；点选项 → 触发器文本改为该选项
  （registry SOP 最小复现）。纯加法、既有 openNode 标题通路 + addNode/connectNodes 通路零动。
- 反面场景（fixture 场景控，非 URL query——openNode learn #3 坑）：`ddmulti`（选项文本浮层内出现两次→
  多匹配）/ `ddabsent`（浮层不含 option→目标缺席）/ `ddwrong`（点了但触发器值更成含子串非精确的错值→
  选错项）/ `ddtwin`（抽屉挂两「请选择」+ 目标选项两浮层各现一次→非域锁门必 ambiguous 的当时无知识反例）。
  夹具行为 = registry 真机 SOP 最小复现，不为金牌预定裁定倒着裁。

## D7 金牌 + 红先行（镜像 wf-open-node 覆盖形态）

- 定夺（起草建议）：新建 `tests/_golden/wf-select-node-dropdown.golden.mjs`——C1 可编译 + 集恰 17 +
  agent.openToolPicker 仍不可编译；C2 端到端 compile `[nav, open, addNode, openNode, selectNodeDropdown]`
  → events 过 schema → replay 真跑夹具 → 触发器回读 unique → verdict 全 PASS（`ddtwin` 钉两扇门）；
  C3 fail-closed 族：抽屉未开/无下拉 none 不点、`nth` 越界 blocker、选项多匹配 ambiguous 不点、
  选错项精确回读拒认、目标缺席 action_failed。红先行：实现前全红。详见 `proposed/GOLDEN-TESTPLAN.md`。

## D8 例翻涟漪 + 重签清单

- **五**金牌钉「集 16」全翻 17（openNode 那轮翻的是四家，本轮 `wf-open-node.golden` 自身也进队第五家）：
  flow-bridge.golden:184 / wf-add-node.golden:113 / wf-connect-nodes.golden:94 / wf-open-smoke.golden:55 /
  wf-open-node.golden:94 → 各 prd 棘轮重签。`agent.openToolPicker 不可编译`断言**不翻**（长寿反例、只翻计数）。
- fake-sut/server.mjs 夹具改动 → prd-p5-replay 夹具 checksum 重签 + 全消费者 golden 复跑。
- 新冻 prd-wf-select-node-dropdown。共**六重签 + 一新冻**，gate 全绿复验；涟漪回归 e2e-chain/p3-compile/tier1。

## D9 非目标

`setNodeField`（贪心序下一契约）；真机触发器/浮层类名 + `nth` 定位够不够 + 选后值精确含 option
（route:human 挂 observability）；语义精确用 selectOption 需触冻结 schema（另契约）；registry 选后「输入区
自动填充」下游联动不进本原子；不动 events.schema/verdict/gate 冻结内核；不建 cases/ 真用例；不碰 heal；
不动 report-workflow-structure 结构覆盖（另账 report-spec #11）。
