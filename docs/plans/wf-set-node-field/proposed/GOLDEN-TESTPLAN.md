# wf-set-node-field — 金牌测试计划（镜像 wf-select-node-dropdown.golden 头注形制）

目标金牌：`tests/_golden/wf-set-node-field.golden.mjs`（画布节点抽屉可填字段原子端到端红金牌）。
决策源 `proposed/GRILL.md`（D1 交互 / D3 复用 fill 零冻结 / D4 按原子分发域锁门 + 字段级唯一闸 /
D5 填后精确 value 回读 / D7 金牌形态）+ `plan.md` 验收 C1–C3e。范式 = `tests/_golden/wf-select-node-dropdown.golden.mjs`。

## 承载与零冻结论证（放金牌头注）

setNodeField 复用 `events.action=fill`（**零 schema 涟漪**，见 D3）：
`event = {atom:workflow.setNodeField, action:fill, value, semantic:{kind:label,name:placeholder,exact}}`。
回放门按 `ev.atom` 分发到 `doSetNodeField`（域锁 `.hr-drawer__content-wrapper` 内 `getByPlaceholder`
+ 字段级唯一闸唯一/显式 nth 消歧才填 + 填后 `inputValue()` 精确等于填入值）——与通用 `doAct` 是两扇门：
占位符锚不是 `semanticLocator` 的 label/text/role 命中口径，通用门必兜空/撞别处同名。冻结 schema 的
`allOf` 对 `fill` 只要求 `value`；semantic 满足交互动作 anyOf——零冻结 schema 改动。

## value 非文本节点：断言口径与 selectNodeDropdown 的关键差异

selectNodeDropdown 选中值落进触发器可见文本，金牌用 `textVisible(OPT)` 做每-intent 硬断言。setNodeField
填值落进 input 的 `value` 属性——`page.getByText` / `assert.textVisible` **看不到**（registry `:339`
`assertNodeFieldValue` 亲述）。故本金牌**不用 textVisible 断填值**：
- 填值正确性由**门内精确 value 回读**（`doSetNodeField` 吐 `identityReadback.ok`）确定性守住，金牌按
  **动作轴**核（`ax.action.identityReadback.ok===true` + `resolution==='unique'`），镜像 selectNodeDropdown
  金牌 ddtwin 按动作轴核 identityReadback；
- 端到端 verdict 的 setNodeField intent 每-intent 硬断言由**全局取证**（`noPageError`/`noErrorEnvelope`，
  synthesizeSkeleton 缺省加、per-intent 合入）兜底：PASS = 动作轴 ap（门内 value 精确回读成立）+ 全局取证
  无错；填错/半填 → 门 action_failed → ap=false → 绝不 PASS（护栏 #14）。
- 判内核纯编译/回放：不新增断言 kind、不碰 `bin/verdict.mjs`、不碰 `bin/replay.mjs` 采集通道（L1 断言
  `assertNodeFieldValue` = 另契约）。

## 夹具（tests/fixtures/fake-sut/server.mjs 纯加法）

节点抽屉（openNode/selectNodeDropdown 建的 `nodeDrawer`）追加可填 input（`.hr-input` placeholder
「请输入接口的URL」）；填值 → input value = 该值（身份回读地面真值）。反面场景（fixture 场景控，非 URL query）：

| 场景 | 抽屉字段行为 | 钉的缝 |
|---|---|---|
| happy（缺省） | 单字段、域内唯一、填后 value = 精确填入值 | 正路 unique |
| `setmulti` | 抽屉挂两个同占位符 input | 多匹配未给 nth → ambiguous 绝不填首项（编译预检 + 回放身份门） |
| `setclash` | 详情页抽屉**外**再挂一个同占位符 input | 域锁反例：全页 getByPlaceholder count=2 必 ambiguous、唯域锁门 count=1 unique |
| `ddempty`（复用） | 抽屉开但无下拉且无字段 | 编译面预检域内 count=0 → blocker（缺席半边） |

## 通道剖面（非凭据）

`profile = { background: FAKE_SITE_DENYLIST, successField:'status', successValue:200,
countSelector:'.hr-drawer__content-wrapper' }`——countSelector 沿用 openNode（抽屉 0→1 归 openNode intent）。
**setNodeField intent 不抢 countChange 通道**（抽屉此时已开、不再变），也不用 value 看不到的 textVisible；
其 PASS 由动作轴 ap（门内 value 精确回读）+ 全局取证 noPageError/noErrorEnvelope 得出。

## 常量草案（金牌骨架用）

- `CASE_ID = 'tc_wf_set_node_field'`
- `OPEN_NAME = 'atl_目录CRUD_a'`（fake-sut happy 列表既有行、点开进详情=画布页，沿用 openNode/dropdown）
- `NODE = 'HTTP请求'`（fake-sut `NODE_TYPES` 内、registry「请输入接口的URL」= HTTP 节点 URL 字段的宿主；
  hermetic 夹具给该宿主抽屉渲可填字段即可，真机宿主字段清单 route:human）
- `PLACEHOLDER = '请输入接口的URL'`、`VALUE = 'https://api.example.com/notify'`（回读精确等于）
- `nth`：happy 不给（单字段严格唯一）；C3c 用越界 nth=1；setmulti 不给 → ambiguous。

## 用例清单

### C1 编译原子集加法 + 例翻反例
- setNodeField 可编译；`COMPILE_KNOWN_ATOMS.size` 恰 **18**（setNodeField +1）；`agent.openToolPicker` 仍
  不可编译（长寿反例）；`nonsense.x` 不可编译。红先行：实现前 size===17、isCompilableAtom 假 → 本例红。

### C2 端到端开抽屉填字段（fake-sut happy）
- C2-a compile 全程：compile `[nav, open, addNode(NODE), openNode(NODE), setNodeField({placeholder,value})]`
  → events 末步 = `{atom:setNodeField, action:fill, value:VALUE, semantic:{kind:label,name:PLACEHOLDER,exact:...}}`
  → 过 events.schema（`fill` + value/semantic 全属既有属性、`allOf` fill 只要求 value、无越权属性）→ blockers
  空 + compile-report 含「节点字段已填入」回读证据。末步不载 nth（单字段严格唯一）、不带 dropdownUnit。
- C2-b 端到端裁定：draft(+patch：nav 补 urlPathname、openNode 补 countChange up 抽屉 0→1、addNode 用
  textVisible、open 用 onPage) → sign → casey run → verdict 全 intent PASS。setNodeField intent 无每-intent
  assert.* 折入（value 看不到、不硬凑 textVisible）→ 其 PASS 由动作轴 ap + 全局取证得出；额外核
  `ax.action.identityReadback.ok===true`（门内 value 精确回读 = 断言字段 value 含期望）。
- C2-c `setclash` 域锁钉位（对应 selectNodeDropdown ddtwin）：详情页抽屉外再挂同占位符 input → 全页
  `getByPlaceholder` count=2 必 ambiguous，唯域锁 `doSetNodeField`（`.hr-drawer__content-wrapper` 内 count=1）
  才 unique 填入 → 动作轴 resolution unique + candidateCount 1 + identityReadback ok + verdict PASS（证回放走
  专用域锁门、编译门=回放门同刻）。

### C3 fail-closed 族
- **a 编译面·无字段**（ddempty：抽屉开但域内无 input）→ 预检域锁 `getByPlaceholder` count=0 → blocker
  点名 setNodeField/count=0、exit 65、零 events、无谎报 acted（customAct 通路不走 emit 定位核验、自证）。
- **b 编译面·多匹配未给 nth**（setmulti：两同占位符字段、入参不给 nth）→ 预检 count>1 且无 nth → blocker
  点名多匹配/ambiguous、exit 65 绝不填首项、零 events。
- **c 编译面·nth 越界**（抽屉 1 字段、nth=1）→ 预检 nth≥count → blocker 点名越界、exit 65、零 events。
- **d 回放面·抽屉未开**（手编 events 无 addNode/openNode）→ `doSetNodeField` 缺席守卫（`waitFor` 抛不得
  穿出）优雅 none 不崩 → verdict 不 PASS。
- **e 回放面·多匹配未给 nth**（setmulti，手编 events 末步不载 nth）→ 域内 count=2 → ambiguous 绝不填首项、
  candidateCount 恰 2、identityReadback 非 ok → verdict 不 PASS（fail-open 假绿红证：修前误填首项返 unique）。
- 编译面「填了但没填对」后置回读 blocker 与门内精确回读同源，但 compile 走 SPA go() 不携反面参、其孤立红证
  需真机——covered-by-symmetry（回放门精确回读）+ customAct 回读 fail-closed，挂 route:human。

## 红先行预期（实现前跑金牌）
- C1 红（size===17、setNodeField isCompilableAtom 假）。
- C2-a/C2-b/C2-c 红（无编译知识、无回放门；setclash 非域锁门实锤）。
- C3a/C3b/C3c compile 面红（无预检门）。
- C3d/C3e 回放面红（无 doSetNodeField 门）。
- 实现后全绿即收口。

## 例翻 + 重签（与 plan §3 一致）
- 六金牌「集 17」→ 18：flow-bridge:184 / wf-add-node:113 / wf-connect-nodes:94 / wf-open-smoke:55 /
  wf-open-node:94 / wf-select-node-dropdown:95（`agent.openToolPicker 不可编译`不翻、只翻计数）。
- 七 prd 重签（六例翻棘轮 + p5-replay 夹具 checksum）+ 新冻 prd-wf-set-node-field。
- 涟漪回归全绿：e2e-chain / p3-compile / run-history / seams-freeze(-v2) / p5-replay / tier1。
