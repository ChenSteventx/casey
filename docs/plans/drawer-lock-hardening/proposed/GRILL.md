# GRILL — drawer-lock-hardening（画布三原子域锁跨抽屉边界硬化，light）

> 挂账原文：`loop/prd-wf-set-node-field.json` observability 第二条（codex-sol 异构冗余评审 MED#2，
> 2026-07-10 挂账）；候选契约登记 `docs/NEXT-SESSION.md` 下一步 B。
> 凭据：Steven 2026-07-13 在主会话点选本契约开工，范围即挂账原文修法，无新分岔（grill 据此 user-confirmed）。

## 问题（挂账复述，不改写）

`doSetNodeField`（`lib/replay-actions.mjs` 约 :232）与 `compileWorkflowSetNodeField`（`lib/compile-atoms.mjs`
约 :671）的域锁用宽 `.hr-drawer__content-wrapper`——匹配**所有抽屉**而非当前节点配置抽屉。若另一可见抽屉
恰有唯一同 placeholder 字段，域内 `count===1` 会填错抽屉的字段、填后 `inputValue()` 精确回读仍成立 → 假绿。
`openNode`（抽屉身份回读侧）/ `selectNodeDropdown`（触发器域锁侧）/ `setNodeField`（字段域锁侧）三原子
同型设计局限。真机通常单抽屉在场 + 字段级唯一闸 + 精确回读兜底，故 codex 评 MED 非 HIGH——但机制上是
「fail-safe 不 fail-open」的真洞：域锁分辨不出「哪个抽屉」，count===1 命中错抽屉时门会背书 `unique`。

## 范围（做 / 不做）

**做**（Steven 2026-07-13 选定，方向已定勿改）：
- 三原子的**编译门与回放门一起**（两门同刻，wf-add-node R1 铁律）把域锁收窄到当前节点抽屉专属锚；
- fake-sut 加「两个可见抽屉、同 placeholder 字段」反面场景，**红先行**——改前旧域锁下该场景必须暴露
  误命中/假绿（红证），改后须判 `ambiguous` 或域内唯一才动手；
- 波及的既有金牌手编 events 补齐（见 D8）+ 共享冻结文件重签（一个不漏，见 plan.md 重签清单）。

**不做**（挂账与简报明令）：
- `workflow.assertNodeFieldValue`（registry `:339` L1 断言）= 另契约；
- 不碰 `bin/verdict.mjs`（裁判内核零 LLM、裁定语义零改动——本契约只在编译/回放门内收紧 `resolution`
  的产出条件，四态判定树一字不动）；
- 不驱真机（纯 hermetic：fake-sut + chromium）；不碰 `.auth/`、`site.json`、真目标地址；
- 不碰「新增工作流」抽屉一族的既有锚（`compile-atoms.mjs:842/866/871/882`，wf.create 域，非节点抽屉）；
- 不登记新 CONTEXT 术语：域锁收窄是 点击身份门 + 语义定位器 既有概念的实例化（wf-open-node 评审先例
  「双证/域锁是点击身份门实例化、不造词」）；实现期新增 helper 名属代码标识符、非领域新概念。

## 关键决策

### D1 方向定案（Steven 已确认，勿改）

三原子一起收窄、红先行、fail-safe 不 fail-open、hermetic 全程——即上节「做」的四条。此为主会话
2026-07-13 点选开工时的既定方向，本 GRILL 只记录不复议。

### D2 锚点取舍：拒类锚，取「含当前节点标题（精确）的可见抽屉」标题锚

- 分岔：挂账建议 `.lf-node-drawer` 域（类锚）；简报授权按 fake-sut 现有结构与既有代码里的真机观测
  线索做最终取舍。
- 证据盘点：
  1. 真机节点配置抽屉的**容器类名未采样**——wf-open-node GRILL D5 白纸黑字「真机节点配置抽屉的容器
     类名未采样」，且 `prd-wf-set-node-field.json` observability 第一条真机采样（route:human）至今未回；
  2. 全仓 `.lf-node-drawer` 仅存于 fake-sut 的标题元素 `.lf-node-drawer__title`（`tests/fixtures/fake-sut/server.mjs:294`）
     ——是夹具为 wf-open-node 自造的类，**不是真机观测**；
  3. 既有代码里的真机观测线索都是 HEREN 抽屉族类（`lib/compile-atoms.mjs:50` `CHAT_DRAWER_CLOSE` 的
     `.hr-drawer.hr-drawer--right.hr-drawer--open > .hr-drawer__content-wrapper`；registry `agent.create`
     「限定 `.hr-drawer--open` scope」）——只能区分「开着的抽屉」，区分不出「节点抽屉这一种」；
  4. 唯一有真机根据的「节点抽屉专属」特征 = **抽屉里显示该节点标题**：registry `workflow.openNode`
     post「右侧配置抽屉打开」+ 已冻的 openNode 双证回读锚（`replay-actions.mjs:146` /
     `compile-atoms.mjs:560`：`.hr-drawer__content-wrapper` `filter({ has: getByText(label, { exact: true }) })`）。
- 定夺：**当前节点抽屉专属锚 = 「可见的 `.hr-drawer__content-wrapper` 且内含当前节点标题（精确文本）」**，
  即复用 openNode 双证回读的已冻锚原样下沉为三原子共用域锁（加 `:visible` 限定，先例
  replay-nth-visible-hardening fix#2 的可见门）。拒 `.lf-node-drawer` 类锚：真机未采样时往夹具里造容器类
  再锁它 = 夹具倒裁（测试夹具不许倒着裁到预定裁定；已冻接缝是唯一事实源、要复现不要另造），且真机若无
  此类名，三原子将全量 fail-closed 变废原子。标题锚是**身份锚**（锁「这个节点的抽屉」）而非类型锚
  （锁「节点抽屉这类」），严格更强：两个节点抽屉并存的假想场景也分得开。
- 真机假设申报：标题锚承袭 openNode 双证回读的既有真机假设（节点抽屉显示节点标题），**不新增**假设面；
  该假设的真机核验仍走既有 route:human 采样挂账（与 openNode/selectNodeDropdown/setNodeField 合并行程），
  本契约在重签的 prd observability 里保留该行程不动。

### D3 当前节点标题的供给通道：编译期 run 态 + 回放期 `nodeName` 既有冻结字段

- 分岔：select/set 两原子的入参与事件里没有节点标题——从哪拿 label？
- 证据：registry 三原子 `requires:["节点抽屉已开"]`、flow gate 已强制前序必有 `workflow.openNode`
  （wf-set-node-field 金牌 C3a① 实证前置门截 exit 65）；冻结 `events.schema` 的 event properties 已有
  `nodeName`（string，`additionalProperties:false` 白名单内，`workflow.addNode`/`connectNodes` 先例在用）。
- 定夺：编译侧 `compileWorkflowOpenNode` 成功开抽屉后在 run 态记当前节点标题（如 `run.nodeDrawerLabel`，
  后开覆盖先开）；`compileWorkflowSelectNodeDropdown` / `compileWorkflowSetNodeField` 读它作域锁、且把它
  以 `nodeName` 写进 emit 的事件（**零冻结 schema 改动**）；回放侧 `doSelectNodeDropdown` / `doSetNodeField`
  从 `ev.nodeName` 取 label。run 态缺失（理论不可达，flow gate 已截）→ blocker 硬阻断 fail-closed。

### D4 事件缺 `nodeName` 一律 fail-closed，绝不回落宽域锁

- 分岔：旧事件（本次改动前编译的 spec）不带 `nodeName`——回放门是回落旧宽域锁，还是硬阻断？
- 定夺：**硬阻断**（`action_failed`，不填不点）。回落宽域锁 = 假绿洞借「兼容」复活，违「fail-safe 不
  fail-open」。波及面已核：三原子无任何真机已签 spec（hermetic 金牌手编 events 是全部存量，本契约
  一并补 `nodeName` 并重签）；外部旧 spec 若有，落 `NEEDS_HUMAN` 重编译，诚实且可恢复。新金牌加
  负向钉桩锁死此门（防后人加「legacy 回落」削弱）。

### D5 openNode 侧的收窄形态：预点基线归因守卫 + 点后域内恰一

- 分岔：openNode 的域锁（`.lf-canvas-overlay`）本就节点专属，它的洞在**回读侧**——若另一可见抽屉恰含
  节点标题文本，点了没开也回读成立 → 假绿。标题锚对它自身是同义反复，收不住这个洞。
- 定夺：openNode 编译门与回放门同刻加两道：
  1. **预点基线**：单击前先数「可见且含 label（精确）的抽屉」——`count>0` 即无法把点后的抽屉归因于
     本次单击（证不出）→ 回放 `action_failed` / 编译 blocker，绝不背书；
  2. **点后恰一**：回读要求域内恰 1（`>1` 同样证不出归因）。
- 代价申报（fail-safe 方向的收紧）：「同一节点抽屉已开着再重开」这类罕见流会因预点基线落
  `NEEDS_HUMAN`——证不出归因就交人，不假绿；既有夹具与 e2e 流全部是「开前无同标题抽屉」，零行为差。

### D6 抽屉域三态与字段/触发器级既有闸的分层

- 定夺：select/set 两门先过**抽屉域**三态——域内可见含 label 抽屉 `count===0` → `none`/blocker（抽屉
  缺席）；`count>1` → `ambiguous`/blocker（多抽屉证不出归属，回放侧照 setmulti 先例带 `candidateCount`）；
  `count===1` → 以该抽屉为根查字段/触发器，**字段级/触发器级既有闸一字不动**（未给 `nth` 域内
  `count===1` 才动、`count>1` `ambiguous` 绝不动首项、非法 `nth` 硬阻断、越界 `none`、精确回读拒认）。
  既有场景（`setclash`/`setmulti`/`setsuffix`/`ddempty`/`ddtwin`/`ddhidden`/`ddmulti`/`ddabsent`/`ddwrong`）
  在新域锁下判定全部不变（各场景只有节点抽屉一个可见抽屉、且都含节点标题）——涟漪金牌复跑锁零行为差。

### D7 夹具反面场景：三个纯加法场景、复现挂账接缝、不倒裁

- 定夺：fake-sut 详情页加三个场景（场景名实现期定稿并登记 `tests/fixtures/fake-sut/CONTRACT.md`；
  下文用工作名）。冒牌抽屉 = 详情页**画布外**挂的第二个可见 `.hr-drawer__content-wrapper`（复现
  「另一可见抽屉」——真机形态如同页测试面板/新增抽屉并存）：
  1. `twinfield`：节点抽屉正常开但**无** URL 字段、无下拉（ddempty 形态）；冒牌抽屉（不含节点标题）
     有唯一同 placeholder 字段 + 一个「请选择」触发器（可点、可选、值可回读——让旧门走完全程真假绿）。
     钉 setNodeField 与 selectNodeDropdown 的跨抽屉误命中：旧宽域锁 `count===1` 命中冒牌抽屉、填/选后
     回读成立 → `unique` 假绿（红证）；新标题锚域内字段/触发器 `count===0` → `none`/blocker。
  2. `twinboth`：节点抽屉与冒牌抽屉**都**有同 placeholder 字段（各一）。钉「域内唯一才动手」的正面半边：
     旧宽域锁 `count===2` → `ambiguous`；新标题锚锁进节点抽屉 `count===1` → `unique` 真填对、verdict `PASS`。
     （证明收窄不是无脑全关：能证出归属时照常干活。）
  3. `twintitle`：单击节点**不开**抽屉（drawernone 形态）+ 冒牌抽屉含节点标题精确文本。钉 openNode
     回读假绿：旧回读命中冒牌抽屉 → `unique` 假绿（红证）；新预点基线 `count>0` 证不出归因 →
     `action_failed`/blocker。
  - 纪律：纯加法、既有场景零行为差；场景行为 = 挂账描述的接缝复现，不为金牌预定裁定倒着裁
    （冒牌抽屉的字段/触发器行为与真节点抽屉同源共用构建函数，不做特判）。

### D8 金牌形态：新金牌一份 + 三份既有金牌手编 events 补 `nodeName`

- 定夺：新红先行检查集中进新文件 `tests/_golden/drawer-lock-hardening.golden.mjs`（冻进新
  prd-drawer-lock-hardening），不往三个既有金牌里塞新场景；既有金牌只做 D3/D4 强制的最小改——
  手编 select/set 回放 events 补 `nodeName`（`wf-set-node-field` / `wf-select-node-dropdown` /
  `replay-nth-visible-hardening` 三份），可顺带把 C2-a 的编译产物断言加严一条 `nodeName` 钉位（棘轮
  只许加严）。`wf-open-node.golden.mjs` 预期零改动（openNode 事件本就带 label、其场景预点基线恒 0）；
  若实现期意外需动，重签 prd-wf-open-node 并记账。

## 反面场景清单（红先行总表）

| # | 场景 | 旧行为（红证） | 新行为（验收） |
|---|---|---|---|
| 1 | `twinfield` 回放 setNodeField | 宽域锁 count=1 填冒牌抽屉字段、回读成立 → `unique`+`PASS` 假绿 | 标题锚域内字段 count=0 → `none`、verdict 不 `PASS` |
| 2 | `twinfield` 回放 selectNodeDropdown | 宽域锁 count=1 点冒牌触发器、选中回读成立 → `unique`+`PASS` 假绿 | 标题锚域内触发器 count=0 → `none`、verdict 不 `PASS` |
| 3 | `twinfield` 编译 setNodeField / selectNodeDropdown | 预检命中冒牌抽屉 → exit 0 产 events（编译期假绿） | 预检域内 count=0 → blocker exit 65 零 events |
| 4 | `twinboth` 回放 setNodeField | 宽域锁 count=2 → `ambiguous`（干不了活） | 标题锚锁进节点抽屉 count=1 → `unique` 真填对 + `PASS` |
| 5 | `twintitle` 回放 openNode | 回读命中冒牌抽屉 → `unique` 假绿 | 预点基线 count>0 证不出归因 → `action_failed`、不 `PASS` |
| 6 | `twintitle` 编译 openNode | emit 等到冒牌抽屉可见 + 后置核验过 → exit 0 假绿 | 预点基线 blocker exit 65 零 events |
| 7 | happy 回放 select/set 事件缺 `nodeName` | 宽域锁照常 `unique`+`PASS` | 硬阻断 `action_failed`、不 `PASS`（D4 钉桩） |

每条先在旧实现上跑红（断言写新行为、旧代码必败），再动手；改后全绿 + 涟漪金牌零行为差。

## 风险

1. **真机标题锚假设**：承袭 openNode 已冻假设（节点抽屉显示节点标题、精确文本可命中），不新增假设面；
   真机核验走既有 route:human 采样行程（重签 prd 的 observability 保留）。若真机标题带前后缀，openNode
   本就开不出 `unique`——属既有暴露面、非本契约新增。
2. **旧 spec 兼容断崖**：缺 `nodeName` 的旧事件回放一律 `action_failed`（D4）。存量已核尽（仅三份金牌
   手编 events，本契约补齐）；风险余量 = 仓外未知 spec，落 `NEEDS_HUMAN` 可恢复，接受。
3. **重开同节点流收紧**（D5 代价）：`NEEDS_HUMAN` 而非假绿，方向正确；真机若实证「重开」是常见流，
   届时按取证另立契约放门，不预先放松。
4. **共享冻结文件跨契约漂移**（HANDOFF 2026-07-10 教训复发面）：fake-sut `server.mjs` 被
   prd-p5-replay 与 prd-replay-nth-visible-hardening 双冻、`CONTRACT.md` 被 prd-p5-replay 冻——重签
   清单必须一个不漏 + 收尾跑全仓 ratchet 总核（plan.md 验收序含此步）。
5. **金牌运行时长**：新金牌起多轮 chromium + fake-sut，gate 全量十几分钟——后台跑、轮询收结果。
