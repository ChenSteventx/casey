# wf-select-node-dropdown — 金牌测试计划（起草，镜像 wf-open-node.golden 头注形制）

目标金牌：`tests/_golden/wf-select-node-dropdown.golden.mjs`（画布节点抽屉下拉原子端到端红金牌）。
决策源 `proposed/GRILL.md`（D1 交互 / D3 复用 click 零冻结的 schema 铁证 / D4 按原子分发域锁门 /
D5 触发器值精确回读 / D7 金牌形态）+ `plan.md` 验收 C1–C3f。范式 = `tests/_golden/wf-open-node.golden.mjs`。

## 承载与零冻结论证（放金牌头注）

selectNodeDropdown 复用 `events.action=click`（**零 schema 涟漪**，见 D3）：
`event = {atom:workflow.selectNodeDropdown, action:click, nth, text:option, semantic:{kind:text,name:请选择,exact:true}}`。
回放门按 `ev.atom` 分发到 `doSelectNodeDropdown`（域锁 `.hr-drawer__content-wrapper` + 第 `nth`「请选择」
触发器 + 可见浮层 `.hr-select-option` 内选项唯一才点 + 触发器值精确回读）——与通用 `doSelect` 是两扇门：
节点抽屉「请选择」触发器非 role=combobox-带名，全页 combobox 门必兜空/撞既有分类下拉（wf-add-node R1-F2
同型缝）。**不走 `selectOption`**：冻结 schema 的 `allOf` 强制 selectOption 带 `dropdownUnit`，而
`dropdownUnit`（additionalProperties:false、required fieldLabel/optionText/scope）无 `nth` 槽——走它要改
冻结 schema，违纯加法姿态。

## 夹具（tests/fixtures/fake-sut/server.mjs 纯加法）

节点抽屉（openNode 加的 `nodeDrawer`）追加「请选择」下拉 + `.hr-select-option` 选项浮层；点选项 →
触发器文本改为选项（身份回读地面真值）。反面场景（fixture 场景控，非 URL query）：

| 场景 | 抽屉下拉行为 | 钉的缝 |
|---|---|---|
| happy（缺省） | 单下拉、选项唯一、选后触发器值 = 精确选项 | 正路 unique |
| `ddmulti` | 目标选项文本在浮层出现两次 | 选项多匹配 → ambiguous 绝不点 |
| `ddabsent` | 浮层不含请求的 option | 目标缺席 → action_failed |
| `ddwrong` | 点了目标项但触发器值更成「option+副本」（含子串非精确） | 选错项/写错值 → 精确回读拒认 action_failed（F1 下拉版） |
| `ddtwin` | 抽屉挂两「请选择」+ 目标选项两浮层各现一次 | 当时无知识反例：非域锁 option 门 count=2 必 ambiguous、唯 nth 域锁门过 |

## 通道剖面（非凭据）

`profile = { background: FAKE_SITE_DENYLIST, successField:'status', successValue:200,
countSelector:'.hr-drawer__content-wrapper' }`——countSelector 沿用 openNode（抽屉 0→1 归 openNode intent）。
**selectNodeDropdown intent 不抢 countChange 通道**（抽屉此时已开、不再变，wf-connect-nodes learn #5
单计数通道约束），改用 `textVisible`（选中 option 文本在抽屉内可见）作硬断言。

## 用例清单

### C1 编译原子集加法 + 例翻反例
- selectNodeDropdown 可编译；`COMPILE_KNOWN_ATOMS.size` 恰 **17**（selectNodeDropdown +1）；
  `agent.openToolPicker` 仍不可编译（继任反例真缝、长寿——agent_tool 维度整体压后）；
  `nonsense.x` 不可编译。
- 红先行：实现前 selectNodeDropdown 不在分派表 → 本例红（size===16、isCompilableAtom 假）。

### C2 端到端开抽屉选下拉（fake-sut happy）
- C2-a compile 全程：compile `[nav.workflowManagement, workflow.open, workflow.addNode(NODE),
  workflow.openNode(NODE), workflow.selectNodeDropdown({option:OPT})]` → events 末步 =
  `{atom:workflow.selectNodeDropdown, action:'click', nth:0, text:OPT, semantic:{kind:'text',name:'请选择',exact:true}}`
  → 过 events.schema（`click` + `nth`/`text` 全属既有属性、additionalProperties 与 allOf 全过、
  不触发 selectOption 的 dropdownUnit 强制）→ blockers 空 + compile-report 含触发器值回读证据。
- C2-b 端到端裁定：draft(+patch：selectNodeDropdown intent 补 `textVisible(OPT)` 硬断言、openNode intent
  补 countChange up 抽屉 0→1、addNode 用 textVisible、nav 用 urlPathname）→ sign → casey run → verdict
  全 intent 全 PASS。
  **本金牌最大钉位**（对应 openNode「面板开着全页门必 ambiguous」）：`ddtwin` 语境下抽屉两「请选择」+
  目标选项两浮层各现一次 → 非域锁/全页 option 门 count=2 必 ambiguous 拒点；唯域锁 `doSelectNodeDropdown`
  （`nth` 域 + 可见浮层作用域 count=1）才 unique 选中。C2 全 PASS 即证回放走专用门（编译门=回放门按
  `ev.atom` 分发、D4）。

### C3 fail-closed 族
- **a 编译面·抽屉未开/无下拉**（未 openNode 即 selectNodeDropdown）→ 预检域锁「请选择」触发器 count=0 →
  blocker 点名证不出（须其自身签名「抽屉域内 count=0」，非兜底路径也含「证不出」——评审 coverage 隔离）、
  exit 65、零 events、无谎报 acted（customAct 通路不走 emit 定位核验、自证）。
- **b 编译面·`nth` 越界**（抽屉 1 下拉、`nth=1`）→ 预检 `nth ≥ 触发器 count` → blocker exit 65 绝不点。
- **c 回放面·抽屉未开**（手编 events）→ `doSelectNodeDropdown` 缺席守卫（`waitFor` 抛不得穿出、
  codex R2-F1 先例）优雅 none 不崩、verdict 不 PASS。
- **d 回放面·选项多匹配**（`ddmulti`，手编 events）→ 浮层内目标选项 count=2 → ambiguous 绝不点、
  candidateCount 恰 2、触发器值不变（不 textVisible）→ verdict 不 PASS。
- **e 回放面·选错项/写错值**（`ddwrong`：触发器值更成含子串非精确的错值）→ 身份回读须精确
  （`filter({ has: getByText(OPT,{exact:true}) })`）→ 拒认 action_failed（评审 F1 下拉版：子串 hasText 会把
  「OPT副本」误判「选对了」）→ verdict 不 PASS。
- **f 回放面·目标缺席**（`ddabsent`：浮层不含 OPT）→ 等选项超时 / count=0 → action_failed（不假 unique）
  → verdict 不 PASS。
- 编译面「选了但没选中」后置回读 blocker 与 e/f 同源，但 compile 走 SPA go() 不携反面参、其孤立红证需
  真机——covered-by-symmetry（回放 e/f）+ customAct 回读 fail-closed，挂 route:human。

## 红先行预期（实现前跑金牌）
- C1 红（size===16、selectNodeDropdown isCompilableAtom 假）。
- C2-a/C2-b 红（无编译知识、无回放门）。
- C3a/C3b compile 面红（无预检门）。
- C3c-f 回放面红（无 doSelectNodeDropdown 门）。
- `ddtwin` 非域锁门 fallback/ambiguous count=2 实锤红。
- 实现后全绿即收口。

## 例翻 + 重签（与 plan §3 一致）
- 五金牌「集 16」→ 17：flow-bridge:184 / wf-add-node:113 / wf-connect-nodes:94 / wf-open-smoke:55 /
  wf-open-node:94（`agent.openToolPicker 不可编译`不翻、只翻计数）。
- 六 prd 重签（五例翻棘轮 + p5-replay 夹具 checksum）+ 新冻 prd-wf-select-node-dropdown。
- 涟漪回归全绿：e2e-chain / p3-compile / run-history / seams-freeze(-v2) / p5-replay / tier1。

## 常量草案（金牌骨架用）
- `CASE_ID = 'tc_wf_select_node_dropdown'`
- `OPEN_NAME = 'atl_目录CRUD_a'`（fake-sut happy 列表既有行、点开进详情=画布页，沿用 openNode）
- `NODE`：宿主节点名——起草取一个 fake-sut `NODE_TYPES` 内、抽屉挂下拉的类型（真机 registry 例是
  数据库节点/知识库检索；hermetic 夹具给该宿主抽屉渲「请选择」下拉即可）。真机宿主节点抽屉字段清单
  route:human 复核。
- `OPT`：选项文本（子串匹配点、精确回读）。
- `nth = 0`（缺省，happy 单下拉；`ddtwin`/C3b 用多下拉/越界）。
