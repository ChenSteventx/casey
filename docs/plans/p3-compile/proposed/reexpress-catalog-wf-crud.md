# P3 备料草稿一：`catalog_wf_crud` 逐步重表达清单（flow 步 → Casey events）

> 状态：**草稿**，非决策。P3（相1 编译）契约备料，零 baton 产物。所有拿不准处显式标 route:human。
> 真值源：action 枚举以已冻 `tests/_golden/schemas/events.schema.json` 为唯一真值（7 枚举：`click`/`dblclick`/`fill`/`selectOption`/`press`/`nav`/`newpage`）；接缝形状以已冻 fixture `tests/_golden/fixtures/seams/events.fixture.json` 与 `observed-reality.fixture.json` 为准（复现非另造）。
> regress 侧料：`/mnt/d/ctx/heren/regress_autotest/tests/flows/catalog_wf_crud/catalog_wf_crud.flow.json`（7 步、6 原子）+ `tests/_atoms/_atoms.ts` 各原子实现 + `docs/plans/p2-intent-compile/regress-intel.md`（深读情报，行号引用以它为准）。
> 相关决策：ADR-0003（禁纯坐标步、**静默点**替代固定睡眠）、ADR-0006（骑 regress 重表达，LLM 约做五分之一、其余人工移植——本文即人工移植清单）。

## 0. 重表达约定（先立规矩再列表）

1. **意图与事件两层**：一条 `intentId`（用例语义步）裂成 N 个 event（位置式 `atstep_i`），每个 event 回填 `intentId`。本清单按 intent 分组列 event。
2. **断言原子不产 event**：`assert.onPage`、`assert.noErrorToast` 是断言不是动作，events.schema 的 7 枚举里没有 assert——它们折进所在 intent 的 `expected[]`，作为相2（P4 断言草拟）的输入。交接面细节见草稿三 G4。
3. **登录不产 event**（凭据红线，护栏 #7）：把登录表达成 `fill` 事件必然把密码字面量冻进 spec，一律禁止。登录走回放/编译开始前的预备动作（英文惯称 `bootstrap`，白话：把浏览器带到已登录态的开场步；若日后成为正式概念需登记 CONTEXT.md），复用件选择见草稿三 G2。`TestCase.preconditions` 记「已登录」、`target.auth` 记 `ref:site.json`。
4. **条件分支不可重表达**：events 是线性确定性序列，regress 原子里的 if/重试/兜底分支（「有才删」「menuitem 不在就点 last」）本质不可确定性回放。处置原则：编译期真机跑一次把实际走到的分支线性化落盘；本质条件性的步（前置清理）砍除或改由机制兜底，逐条标注。
5. **易变值一律模板化**：实体名 `atl_{{uniqueName}}`（对齐已冻 events fixture 的写法），回放期由 `lib/instantiate.mjs` 回填；同一模板在建/搜/删各步取同一实例值。前缀 `atl_` 来自 `TestCase.uniquePrefix`，经 `lib/compile-gate.mjs` 破坏性硬闸强制（R12 前缀对齐）。
6. **每步静默点**：每个 event 动作后必达静默点（`networkidle` + 无动画 + DOM 稳定 K ms）再采**观测现状**/进下一步；regress 侧的 `waitForTimeout(500/600/1200/1500)` 固定睡眠全部替换、绝不照搬（ADR-0003）。
7. **坐标声明**：本 flow 全程零纯坐标步（画布域原子未用到，R9 不在此条）；`x/y` 字段仅编译期采集当报告元数据，禁作定位依据。regress 侧靠 `.first()`/`.last()`/`.nth()` 消歧的步是本清单的主要雷点，逐条给语义化替代。

## 1. 总览：flow 7 步 → 4 个 intent / 15 个 event

| flow 步 | regress 原子 | 重表达处置 | intent | event 数 |
|---|---|---|---|---|
| 1 | `login` | 不产 event，走登录预备动作（约定 3） | —（precondition） | 0 |
| 2 | `workflow.deleteByName`（前置清理） | **建议砍除**：条件删除不可确定性回放；残留由**保留前缀** + **测试数据清理**纯脚本兜底 + `uniqueGuard` 建名查重。route:human ①（决策见草稿三 G7） | — | 0 |
| 3 | `workflow.create` | 拆 2 个 intent：进列表 + 新增 | intent_0 / intent_1 | 1 + 6 |
| 4 | `assert.onPage` | 无 event，折进 intent_1 `expected[]`（`urlPathname` `matches` `/process/detail`；regress 的 contains 语义映射 matches，见 p2 grill 对账要点） | —（P4 输入） | 0 |
| 5 | `workflow.save` | 1:1 映射 | intent_2 | 1 |
| 6 | `assert.noErrorToast` | 无 event，折进 intent_2 `expected[]`（kind `noErrorToast` 已在 `bin/check.mjs` 词表） | —（P4 输入） | 0 |
| 7 | `workflow.deleteByName`（收尾清理） | 线性化重表达（收尾时实体必存在，条件分支坍缩成确定路径） | intent_3 | 7 |

合计：**15 个 event、4 个 intent**；建议 caseId `tc_catalog_wf_crud`（满足 `^tc_[a-z0-9_]+$`）。

## 2. 逐 event 明细

> 列说明：〔定位〕给语义化候选优先序（`semantic` role+可访问名 > label > text；`fallbackCss`+`nth` 只作回落，不作唯一依据——events.schema 的「禁纯坐标步硬约束」anyOf 必须满足其一）。〔静默点〕为该步动作后必达条件。〔源〕为 regress 实现行号（`_atoms.ts`）。

### intent_0 —— 进入工作流管理列表（源自 `gotoWorkflowList`，`_atoms.ts:78-89`）

| stepId | action | 定位 / 参数 | 静默点 | 备注 |
|---|---|---|---|---|
| atstep_0 | `nav` | `url` = 列表页地址（基址引用 site.json 的 `target.startUrl`，落盘形态见 route:human ②） | networkidle + 列表表格出现 | 首选 `nav` 直达（对齐已冻 events fixture 的 `atstep_0` 形状）；编译期核验 SPA 直达路由可用。回落方案：click 左侧菜单「工作流管理」——regress 用 `getByRole('list')` 作用域 + `.first()` 避面包屑撞名，而 `semantic` 无作用域概念，须编译期验证全局 count===1，验不出则 `fallbackCss` 限定菜单容器 + `nth`，仍歧义则 route:human ③ |

> regress 侧 `DEFAULT_START_URL` 常量（`_atoms.ts:22`）内嵌站点字面量——Casey 侧**绝不复制**该常量，一律引用 site.json 的 `target.startUrl`（护栏 #7）。

### intent_1 —— 新增工作流（`workflow.create`，`_atoms.ts:337-371`）

| stepId | action | 定位 / 参数 | 静默点 | 备注 |
|---|---|---|---|---|
| atstep_1 | `click` | 「新增工作流」下拉触发器。候选：`semantic` {kind:role, role:button, name:新增工作流}；regress 用 `getByText(...).first()`（`:345`，多匹配雷点） | 下拉菜单浮层出现 | 编译期核验触发器真实 role 与唯一性；多匹配→回放**点击身份门**判 ambiguous |
| atstep_2 | `click` | 菜单项。候选：`semantic` {kind:role, role:menuitem, name:新增工作流}（`:347` 的 `getByRole('menuitem')` 语义干净，直接沿用） | 抽屉（`drw` 0→1）出现 | regress 的 else 分支 `getByText(...).last()`（`:349`）是条件兜底，不重表达；编译期若 menuitem 不存在则该路线整体存疑、route:human |
| atstep_3 | `fill` | `fieldLabel`=工作流名称，`semantic` {kind:label, name:工作流名称}；`value`=`atl_{{uniqueName}}`，`uniqueGuard`=true，`required`=true | 回读一致（`robustFill` 语义） | regress 用 xpath 标签锚定（`:352-353`）——Casey 的 label 语义定位即其正名。**唯一性保障**由 `uniqueGuard` 走建名查重 |
| atstep_4 | `fill` | 工作流描述。regress 是裸 `textarea.first()`（`:355-356`，无标签锚定）；Casey 候选：`fieldLabel`=描述类标签（确切文本编译期真机核验）；`value`=固定短文案（非易变，可冻字面量） | 回读一致 | 若真机该 textarea 无可锚定标签/可访问名 → route:human ④（描述为非必填，也可与人确认后砍除本步） |
| atstep_5 | `selectOption` | `dropdownUnit` {fieldLabel:分类, optionText:测试分类, scope:抽屉容器, optionListSelector:选项浮层}（三要素非空，l0_schema 契约） | 选项浮层收起 + 回读 | scope/optionListSelector 的确切选择器以编译期真机 DOM 为准；autotester `lib/paths.mjs` `DEFAULT_SITE.select` 段有现成候选（`.hr-select__list` 等），regress `:359` 另有一组——两边不一致，以真机实采为准 |
| atstep_6 | `click` | 抽屉确认按钮。regress `getByRole('button',{name:'确认'}).last()`（`:362`，**已知 ambiguous 雷点**，p2 grill「仍开放」第 2 条已录）。候选：`semantic` {kind:role, role:button, name:确认} + `fallbackCss` 限定抽屉 footer（参考已冻 fixture 的 `.hr-drawer__footer button.hr-button--primary`）+ `nth` | URL 进 `/process/detail` + networkidle | 编译期必须做到过滤后 count===1，否则回放点击身份门判 ambiguous、永无 PASS。真机核验按钮文本（fixture 写「确定」、regress 写「确认」，二者必有一错——以**观测现状**实采为准）。核验不出唯一 → route:human ⑤ |

> regress `:365-368` 的「1.5 秒后若没进画布就点名字补救」条件分支不重表达：编译期若走到补救分支，说明主路径不稳，整条标 route:human 而非把抖动冻进 spec。进画布的期望由 intent_1 `expected[]` 的 `urlPathname` 承担（吸收 flow 步 4）。

### intent_2 —— 保存工作流（`workflow.save`，`_atoms.ts:323-327`）

| stepId | action | 定位 / 参数 | 静默点 | 备注 |
|---|---|---|---|---|
| atstep_7 | `click` | `semantic` {kind:role, role:button, name:保存}（regress 即 `getByRole`，语义干净，1:1 映射） | 保存请求 `saveOrModifyProcessData` 响应完成 + networkidle | regress 零后置（R1 教科书案例）；Casey 侧后置由 `expected[]` 补齐：`noErrorToast`（吸收 flow 步 6）+ 全局 `noErrorEnvelope`（保存 POST 的**错误信封**是本步唯一权威成功信号，regress-intel 网络面） |

### intent_3 —— 收尾清理删除（`workflow.deleteByName`，`_atoms.ts:820-855`）

| stepId | action | 定位 / 参数 | 静默点 | 备注 |
|---|---|---|---|---|
| atstep_8 | `click` | 左侧菜单「工作流管理」（从画布回列表）。同 atstep_0 备注的菜单定位问题 | URL 回 `/process/list` + networkidle | regress `:82-86` 有「抽屉遮罩挡菜单则按 Esc」条件分支：编译期无遮罩则无事件；回放期若遇遮罩会卡——已知确定性缺口，记录为已知限制 route:human ⑥（可选缓解：本步前加 `press` Escape 恒发一次，但「恒发」改变无遮罩路径的行为，须人拍板） |
| atstep_9 | `fill` | 搜索框：`semantic` {kind:role, role:textbox, name:输入工作流名称或编码进行搜索}（regress `:827` 即 getByRole，干净）；`value`=`atl_{{uniqueName}}`（与 atstep_3 同模板同实例值） | 列表刷新（搜索请求 `queryProcess` 响应）| regress 的 click+fill('')+fill 三连是防御性写法，`fill` 语义本含清空，合并为单 fill |
| atstep_10 | `press` | `key`=Enter（触发搜索，regress `:832`） | 列表刷新 + networkidle | regress 后随 1200ms 固定睡眠（`:833`）→ 静默点替代 |
| atstep_11 | `click` | 行内「删除」。候选：`semantic` {kind:text, name:删除, exact:true}——搜索隔离后全页 count===1 是 regress 的动手前提（`:839`），恰好就是 Casey 点击身份门的「解析目标唯一」条件，语义对齐度最高的一步 | 确认对话框出现 | 编译期核验搜索隔离后确实唯一；不唯一（同前缀残留多行）→ 点击身份门判 ambiguous、fail-safe |
| atstep_12 | `click` | 删除确认按钮。regress `确定 or 确认` 再 `.nth(cc-1)`（`:842-844`，文本二义 + 多匹配双重雷点）。候选：`semantic` {kind:role, role:button, name:以真机实采为准} + 对话框容器 `fallbackCss` | 对话框关闭 + 删除请求 `process/delete` 响应 | 真机核验确切文本与唯一性；核验不出 → route:human ⑦ |
| atstep_13 | `fill` | 重搜：同 atstep_9（同搜索框、同模板值） | 列表刷新 | 重搜是「删后归零」断言的取数前提，属动作不属断言，须留在 events |
| atstep_14 | `press` | `key`=Enter | 列表刷新 + networkidle | 删后归零本身不产 event：intent_3 `expected[]` 记 `countChange` `op=equals` `value=0`（对齐已冻 expected-frozen fixture 同款条目；regress `:849-854` 的 `expect.poll` 归 0 即其原型）。计数口径对账见草稿二 §3 |

## 3. `.first()`/`.last()`/`.nth()` 雷点汇总（题面要求单列）

| regress 位置 | 用法 | 语义化替代 | 兜底 |
|---|---|---|---|
| `_atoms.ts:87` 菜单 | `getByRole('list')` 作用域 + `.first()` | `nav` 直达列表路由（首选，绕开菜单定位） | 全局唯一核验；不唯一 → `fallbackCss` 菜单容器 + `nth` → 仍歧义 route:human ③ |
| `:345` 新增触发器 | `getByText().first()` | role=button + 可访问名 | 编译期唯一性核验 |
| `:349` 菜单项兜底 | `getByText().last()` | 不重表达（主路径 menuitem 已语义干净） | — |
| `:355` 描述 textarea | `locator('textarea').first()` | `fieldLabel` 标签锚定（真机核验标签文本） | route:human ④ |
| `:362` 抽屉确认 | `getByRole('button').last()` | role+name + 抽屉 footer 作用域 css + `nth` | route:human ⑤ |
| `:842-844` 删除确认 | `.or()` + `.nth(cc-1)` | 真机实采确切文本 + 对话框作用域 | route:human ⑦ |

## 4. route:human 清单（7 项）

决策类（需人拍板，上升到草稿三 grill）：
1. **①** 前置清理砍除、残留改机制兜底（保留前缀清扫 + `uniqueGuard`）——见 G7。
2. **②** `events.json` 顶层 `url`/nav `url` 的落盘形态（完整地址会携站点字面量，vs 相对路径 + 运行时 `--sut` 基址拼接）——见 G6。
3. **⑥** 抽屉遮罩 Esc 条件分支的确定性缺口处置（记录已知限制 vs 恒发 Esc）——见 G7。

编译期核验类（唯一一次真机跑内核验，验不出即升级 route:human）：
4. **③** 左菜单点击的全局唯一性（仅当 `nav` 直达不可用时才触发）。
5. **④** 描述 textarea 的标签锚定可行性。
6. **⑤** 抽屉确认按钮文本（确认/确定）与作用域内唯一性——本条不解决则 intent_1 永远 ambiguous、无法 PASS，是重表达成败第一雷。
7. **⑦** 删除确认按钮文本与唯一性。

## 5. 与已冻接缝的对齐自查

- action 全部 ∈ 已冻 7 枚举；`dblclick`/`newpage` 本 flow 未用（零使用，合法）。
- 每个交互 event 至少落一个稳定绑定属性（schema 的 anyOf 硬约束），零纯坐标步。
- `authored` 恒为 false/缺省（P3 硬门：不触 authored 拒绝；消费方为 Casey 自建 `bin/replay.mjs`，schema 注仍保留 autotester 往返语义）。
- `atom` 字段逐 event 回填（`nav.wf`→intent_0 借用 fixture 命名习惯；`wf.create`/`workflow.save`/`workflow.deleteByName` 对账追溯）——atomId 命名与 regress 注册表 id 的对应表由 G3（compile-gate 对接）定。
- `recordedAt` + `events.length` 供指纹（spec 完整性归 gate 检查项，不进棘轮）。
