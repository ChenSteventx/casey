# drawer-lock-hardening 方案评审备料

> 本文件是喂给异构冗余评审（规划方=Claude Sonnet 5，评审方=`codex`，评审家族≠规划家族）的**唯一输入**。按护栏 #9：评审料只含 spec/plan 与门禁证据，不含任何凭据、不含规划者的内心推理过程。以下依次是评审指令、关键设计裁量清单、`GRILL.md` 全文、`plan.md` 全文。

## 评审指令

这是画布三原子（`workflow.openNode` / `workflow.selectNodeDropdown` / `workflow.setNodeField`）域锁跨抽屉边界硬化的 `light` 车道设计评审——本轮只评审方案本身（`GRILL.md` 决策 D1–D8 + `plan.md` 落地步骤与验收点），尚未动任何实现字节（`accept`/`loop` 均未开始）。挂账缘由：`codex-sol` 异构冗余评审 `MED#2`（2026-07-10）指出 `doSetNodeField`（`lib/replay-actions.mjs` 约 :232）与 `compileWorkflowSetNodeField`（`lib/compile-atoms.mjs` 约 :671）的域锁用宽 `.hr-drawer__content-wrapper`——匹配所有抽屉而非当前节点配置抽屉，若另一可见抽屉恰有唯一同 `placeholder` 字段，域内 `count===1` 会填错抽屉的字段、精确回读仍成立，构成假绿（`openNode`/`selectNodeDropdown`/`setNodeField` 三原子同型设计局限）。请重点核查：

1. **锚点选择是否会漏判或误判命中**：`D2` 拒挂账建议的 `.lf-node-drawer` 类锚（理由：全仓该类仅存于测试夹具自造的标题元素，非真机观测），改取「可见的 `.hr-drawer__content-wrapper` 且内含当前节点标题精确文本」的标题锚（复用 `openNode` 已冻双证回读锚下沉为三原子共用域锁）——这一锚点取舍逻辑是否站得住，是否存在会漏判（该锁该拦的没拦住）或误判（不该拦的却拦住）的场景；
2. **`fail-closed` 边界是否留有 `fail-open` 缝**：`D4` 定夺事件缺 `nodeName` 一律硬阻断 `action_failed`、绝不回落宽域锁；`D5` 定夺 `openNode` 侧加预点基线归因守卫 + 点后域内恰一——这两处收紧是否完整覆盖了所有需要 `fail-closed` 的路径，是否有遗漏分支仍可能悄悄放行（`fail-open`）；
3. **红先行金牌是否真能钉住缺陷**：`G1`–`G7`（`GRILL.md` 反面场景总表）是否真能在旧实现上验红、在新实现上验绿，是否存在「金牌通过但缺陷仍在」的假绿空间（例如断言强度不够、场景构造未覆盖真实接缝）；
4. **重签清单是否漏共享冻结文件**：`plan.md` §「预计重签 checksum 的 prd 清单」列了 4 份 prd（`prd-wf-set-node-field` / `prd-wf-select-node-dropdown` / `prd-replay-nth-visible-hardening` / `prd-p5-replay`，后两者共享冻结 `tests/fixtures/fake-sut/server.mjs`），`prd-wf-open-node` 判定预期零改动不重签——这份清单是否完整，是否有其它 prd 的 `testChecksums` 冻了本契约会触碰的文件而被漏排除；
5. **是否引入裁判 LLM 化 / 凭据外泄 / 术语违例风险**：本契约声明不碰 `bin/verdict.mjs` 四态判定树、纯 hermetic（不驱真机）、不登记新 `CONTEXT.md` 术语（域锁收窄视为「点击身份门 + 语义定位器」既有概念的实例化）——这些声明是否站得住、方案设计是否有暗中触碰这些边界的地方；
6. **DDD 统一语言是否走样**：术语使用是否与 `CONTEXT.md` 既有登记一致、是否有新造词未登记却已在使用。

请按 `HIGH`/`MED`/`LOW` 分级列出发现（findings），对准上述关键设计裁量逐条打；若确无发现，给出 `PASS`。

## 关键设计裁量清单（简报要点）

1. **D1 方向定案**（Steven 2026-07-13，勿复议）：三原子的编译门与回放门同刻收窄、红先行、fail-safe 不 fail-open、纯 hermetic（不驱真机、不碰 `.auth/`/`site.json`）。
2. **D2 锚点取舍**：拒挂账建议的 `.lf-node-drawer` 类锚——真机节点配置抽屉的容器类名未采样（`wf-open-node` 既有 `GRILL.md` D5 白纸黑字记录），全仓 `.lf-node-drawer` 仅存在于测试夹具自造的标题元素 `.lf-node-drawer__title`（`tests/fixtures/fake-sut/server.mjs`），并非真机观测；锁一个只在夹具里存在的类等于测试夹具倒着裁到预定裁定。改取「可见的 `.hr-drawer__content-wrapper` 且内含当前节点标题（精确文本）」的标题锚，即 `openNode` 原子已冻的双证回读锚（`replay-actions.mjs` 约 :146、`compile-atoms.mjs` 约 :560：`.hr-drawer__content-wrapper` `filter({ has: getByText(label, { exact: true }) })`）原样下沉为三原子共用域锁，另加 `:visible` 可见门（先例 `replay-nth-visible-hardening` 契约的可见门用法）。不新增真机假设面：该标题锚的真机核验仍走既有 `route:human` 采样挂账（与 `openNode`/`selectNodeDropdown`/`setNodeField` 合并行程，行程本身在本契约重签的 prd 里保留不动）。
3. **D3 `nodeName` 供给通道**：`compileWorkflowOpenNode` 编译成功打开抽屉后，在编译期 `run` 态记下当前节点标题（后开覆盖先开）；`compileWorkflowSelectNodeDropdown` / `compileWorkflowSetNodeField` 读取该 `run` 态作标题锚域锁，并把标题以 `nodeName` 写进 `emit` 的事件——`nodeName` 是 events schema 里已冻结的字段（`additionalProperties:false` 白名单内、`workflow.addNode`/`connectNodes` 先例已在用），零 schema 改动；回放侧 `doSelectNodeDropdown` / `doSetNodeField` 从 `ev.nodeName` 取标题。
4. **D4 缺 `nodeName` 一律 `fail-closed`**：事件缺 `nodeName` 时回放门硬阻断 `action_failed`，绝不回落宽域锁——回落 = 假绿洞借「兼容」复活，违反 fail-safe 不 fail-open。存量已核尽：三原子当前无任何真机已签 spec，仅三份金牌的手编 events 是全部存量，本契约一并补齐 `nodeName` 并重签；仓外若有未知旧 spec，回放会落 `NEEDS_HUMAN` 重新编译（诚实且可恢复）。新金牌 `G7` 负向钉桩，防后人加「legacy 回落」削弱此门。
5. **D5 `openNode` 侧收窄形态**：预点基线（单击前先数「可见且含节点标题（精确）的抽屉」`count>0` 即证不出归因、阻断，绝不背书）+ 点后域内恰一（`>1` 同样证不出归因）。申报代价：重开同一节点抽屉这类罕见流会因预点基线落 `NEEDS_HUMAN` 而非假绿；既有夹具与端到端流全部是「开前无同标题抽屉」的形态，判定零行为差。
6. **D6 抽屉域三态分层**：`select`/`set` 两原子先过抽屉域三态——域内可见含标题抽屉 `count===0` 归 `none`/阻断（抽屉缺席）；`count>1` 归 `ambiguous`/阻断（多抽屉证不出归属，回放侧带 `candidateCount`）；`count===1` 才以该抽屉为根，交给字段级/触发器级既有闸判定（既有闸一字不动）。既有九个场景（`setclash`/`setmulti`/`setsuffix`/`ddempty`/`ddtwin`/`ddhidden`/`ddmulti`/`ddabsent`/`ddwrong`）在新域锁下判定应全部不变（各场景只有节点抽屉一个可见抽屉、且都含节点标题）——涟漪金牌复跑需锁零行为差。
7. **D7 三个反面夹具场景**（纯加法，工作名 `twinfield`/`twinboth`/`twintitle`）：冒牌抽屉 = 详情页画布外挂的第二个可见 `.hr-drawer__content-wrapper`（复现挂账描述的「另一可见抽屉」），字段/触发器与真节点抽屉共用构建函数、不特判，不为预定裁定倒着裁。`twinfield` 钉跨抽屉误命中的反面（旧宽域锁假绿）；`twinboth` 钉「域内唯一才动手」的正面半边（收窄后不是无脑全关）；`twintitle` 钉 `openNode` 开错抽屉的归因假绿。既有场景零行为差。
8. **D8 金牌形态**：新红先行检查集中进新文件 `tests/_golden/drawer-lock-hardening.golden.mjs`（冻进新 `loop/prd-drawer-lock-hardening.json`），不塞进既有金牌；三份既有金牌（`wf-set-node-field` / `wf-select-node-dropdown` / `replay-nth-visible-hardening`）只做最小补 `nodeName` + 编译产物 `nodeName` 钉位加严一条（棘轮只许加严）；`wf-open-node.golden.mjs` 预期零改动，若实现期被迫动则重签记账。
9. **不做边界**：`workflow.assertNodeFieldValue`（挂账明确另契约）；不碰 `bin/verdict.mjs` 四态判定树（裁判内核零 LLM、裁定语义零改动）；不碰 `wf.create` 的抽屉族锚（`compile-atoms.mjs` 约 :842/:866/:871/:882，属新增工作流抽屉一族，非节点配置抽屉）；不驱真机（纯 hermetic：`fake-sut` + `chromium`）；不登记新 `CONTEXT.md` 术语（域锁收窄视为既有概念「点击身份门」+「语义定位器」的实例化，先例 `wf-open-node` 评审已确认「双证/域锁是点击身份门实例化、不造词」）。

## 佐证事实（本契约备料时独立核对，非规划者内心推理）

- `lib/replay-actions.mjs` 现有函数行号（`grep` 实测）：`doOpenNode` 起于 127 行、`doSelectNodeDropdown` 起于 162 行、`doSetNodeField` 起于 219 行；`doSetNodeField` 内域锁 `page.locator('.hr-drawer__content-wrapper').getByPlaceholder(placeholder, { exact })` 在约 232 行。
- `lib/compile-atoms.mjs` 现有函数行号：`compileWorkflowOpenNode` 起于 542 行（域锁 `.lf-canvas-overlay`，画布域非抽屉域，是节点本身的域锁，非本契约收紧对象）、`compileWorkflowSetNodeField` 起于 651 行（域锁 `.hr-drawer__content-wrapper` 在约 671 行，即挂账指名的宽域锁）。
- events schema（`tests/_golden/schemas/events.schema.json`）事件对象属性里已含顶层字段 `"nodeName": { "type": "string" }`（约 399 行，`additionalProperties:false` 白名单内）——证实 D3「零 schema 改动」的前提成立；当前手编金牌（`wf-set-node-field.golden.mjs`/`wf-select-node-dropdown.golden.mjs`/`replay-nth-visible-hardening.golden.mjs`）里 `nodeName` 仅出现在 `workflow.addNode` 事件，`select`/`set` 事件尚未带 `nodeName`（证实这是待补的改动面、非虚构缺口）。
- 全仓 `grep -rn "lf-node-drawer"` 命中仅 `tests/fixtures/fake-sut/server.mjs`（夹具生成的 `.lf-node-drawer__title` 标题元素）与 `tests/fixtures/fake-sut/CONTRACT.md`（对该标题元素的场景登记说明）——证实 D2「该类仅存在于夹具自造、非真机观测」的判断有实据。
- `loop/prd-wf-set-node-field.json` 的 `observability` 字段现存两条：第一条真机采样（`route:human`）标注仍未回（节点抽屉真机容器类名/字段清单/多同占位符字段真机锚点均未采样）；第二条即本契约挂账原文（`codex-sol` 异构冗余评审 `MED#2`，2026-07-10）。两者证实 D2 引用的「真机未采样」与「挂账原文」均非杜撰。
- 4 份拟重签 prd 的 `testChecksums` 键（`node -e` 实读 JSON 核对）：`prd-wf-set-node-field.json` 冻 `tests/_golden/wf-set-node-field.golden.mjs`；`prd-wf-select-node-dropdown.json` 冻 `tests/_golden/wf-select-node-dropdown.golden.mjs`；`prd-replay-nth-visible-hardening.json` 冻 `tests/_golden/replay-nth-visible-hardening.golden.mjs` + `tests/fixtures/fake-sut/server.mjs`（双冻）；`prd-p5-replay.json` 冻 `tests/_golden/p5-replay.golden.mjs`/`p5-replay-coverage.golden.mjs`/`fixtures/p5/replay-cases.json`/`fake-sut/server.mjs`/`fake-sut/CONTRACT.md`/`fixtures/seams/events.fixture.json`（`server.mjs`/`CONTRACT.md` 双冻）；`prd-wf-open-node.json` 只冻 `tests/_golden/wf-open-node.golden.mjs`（未冻其它本契约会碰的文件，故不在重签清单内符合预期）。
- `run` 态编排对象（`createCompileRun`，`lib/compile-atoms.mjs` 约 177 行起）现有 `mark()`/`rollback(m)` 两个方法，但只回滚 `events`/`observed`/`verification`/`stepN`/`intentN`/`lastIntentId` 六个字段；全仓唯一调用处是 `compileWorkflowDelete`（与本契约三原子无关的收尾清理原子）。若 D3 新增的「当前节点标题」`run` 态字段将来被纳入某处 `mark`/`rollback` 包裹的重试逻辑，该字段不在回滚清单内，可能残留跨越回滚边界的陈旧值——现状是三原子本身不触 `mark`/`rollback`，仅供评审参考潜在后续风险面。

## `GRILL.md` 全文

```markdown
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

```

## `plan.md` 全文

```markdown
# PLAN — drawer-lock-hardening（画布三原子域锁跨抽屉边界硬化，light）

> 决策全录 `docs/plans/drawer-lock-hardening/proposed/GRILL.md`（D1 方向定案 / D2 标题锚取舍 /
> D3 `nodeName` 供给通道 / D4 缺 `nodeName` fail-closed / D5 openNode 预点基线 / D6 抽屉域三态分层 /
> D7 三夹具场景 / D8 金牌形态）。本文只排落地步骤与验收，不复议决策。

## 落地步骤

1. **夹具先行**（红证的考场）：`tests/fixtures/fake-sut/server.mjs` 加三场景（GRILL D7 工作名
   `twinfield` / `twinboth` / `twintitle`，实现期定稿）——详情页画布外挂第二个可见
   `.hr-drawer__content-wrapper` 冒牌抽屉，字段/触发器与节点抽屉共用构建函数不特判；既有场景零行为差。
   同步登记 `tests/fixtures/fake-sut/CONTRACT.md`。
2. **新金牌红先行**：写 `tests/_golden/drawer-lock-hardening.golden.mjs`（下方金牌清单 G1–G7），在
   **旧实现**上跑——G1–G7 必须逐条红（红证留存运行输出），accept 阶段以 `--red-verified` 收口并
   sha256 冻进新 `loop/prd-drawer-lock-hardening.json`。
3. **回放门收窄**（`lib/replay-actions.mjs`）：抽新 helper（可见 `.hr-drawer__content-wrapper` +
   `filter has getByText(label,{exact:true})` 标题锚）；`doSetNodeField` / `doSelectNodeDropdown` 过
   抽屉域三态（0→`none`、>1→`ambiguous`、1→字段/触发器级既有闸不动），label 取 `ev.nodeName`、缺失
   硬阻断 `action_failed`（D4）；`doOpenNode` 加预点基线 + 点后域内恰一（D5）。
4. **编译门同刻**（`lib/compile-atoms.mjs`）：`compileWorkflowOpenNode` 成功后落 run 态当前节点标题 +
   自身预点基线/点后恰一 blocker；`compileWorkflowSelectNodeDropdown` / `compileWorkflowSetNodeField`
   读 run 态作标题锚域锁（三态 blocker）+ emit 事件带 `nodeName`（既有冻结 schema 字段，零 schema 改动）。
5. **既有金牌最小补齐**（D8）：`wf-set-node-field` / `wf-select-node-dropdown` /
   `replay-nth-visible-hardening` 三份金牌的手编 select/set 回放 events 补 `nodeName`；C2-a 编译产物
   断言各加严一条 `nodeName` 钉位（棘轮只加严）。`wf-open-node.golden.mjs` 预期零改动。
6. **重签**：下方重签清单四份 prd 的对应 testChecksums 键重算 sha256；新金牌冻进新 prd。
7. **验收命令序**全绿（后台跑 gate，轮询收结果）+ 全仓 ratchet 总核零漂移。

## touchesFiles

- `lib/replay-actions.mjs`（doOpenNode / doSelectNodeDropdown / doSetNodeField + 标题锚 helper）
- `lib/compile-atoms.mjs`（compileWorkflowOpenNode / SelectNodeDropdown / SetNodeField + run 态 + emit `nodeName`）
- `tests/fixtures/fake-sut/server.mjs`（三反面场景纯加法）
- `tests/fixtures/fake-sut/CONTRACT.md`（场景登记）
- `tests/_golden/drawer-lock-hardening.golden.mjs`（新，红先行金牌）
- `tests/_golden/wf-set-node-field.golden.mjs`（手编 events 补 `nodeName` + 钉位加严）
- `tests/_golden/wf-select-node-dropdown.golden.mjs`（同上）
- `tests/_golden/replay-nth-visible-hardening.golden.mjs`（同上）
- `loop/prd-drawer-lock-hardening.json`（新 prd；`passes` 只由 gate 写）
- `loop/prd-wf-set-node-field.json` / `loop/prd-wf-select-node-dropdown.json` /
  `loop/prd-replay-nth-visible-hardening.json` / `loop/prd-p5-replay.json`（重签）
- `docs/plans/drawer-lock-hardening/`（本目录文档）

不碰：`bin/verdict.mjs`（裁判内核）、`tests/_golden/schemas/events.schema.json`（冻结 schema 零改动）、
`compile-atoms.mjs` 的 wf.create 抽屉锚（:842/:866/:871/:882）、`.auth/`、`site.json`。

## 红先行金牌清单（每条：钉什么 + 先怎么验红）

新金牌 `tests/_golden/drawer-lock-hardening.golden.mjs`（沿用 p5-replay 形制手编 events +
compileFlowCase 助手；对照 GRILL 反面场景总表）：

- **G1 回放·setNodeField 跨抽屉误命中**：`twinfield` 手编 events（setup + set 事件带 `nodeName`）→
  断言 `resolution==='none'` + verdict 不 `PASS`。验红：旧宽域锁 count=1 真填冒牌抽屉字段、回读成立 →
  `unique`+`PASS`，断言必败（挂账假绿实锤）。
- **G2 回放·selectNodeDropdown 跨抽屉误命中**：`twinfield` 手编 events（select 事件带 `nodeName`）→
  断言 `resolution==='none'` + 不 `PASS`。验红：旧门点冒牌触发器选中回读成立 → `unique`+`PASS` 必败。
- **G3 编译·两原子跨抽屉误命中**：`twinfield` 上 compile flow（nav→open→addNode→openNode→set 或
  select）→ 断言 execute 预检 blocker exit 65 + 零 events + blocker 点名域内 count=0。验红：旧编译门
  命中冒牌抽屉 exit 0 产 events，断言必败。
- **G4 回放·twinboth 域内唯一才动手（正面半边）**：两抽屉各一同 placeholder 字段 → 断言
  `resolution==='unique'` + `candidateCount===1` + `identityReadback.ok===true` + verdict `PASS`。验红：
  旧宽域锁 count=2 → `ambiguous`，断言必败（证明收窄后能证出归属时照常干活、不是无脑全关）。
- **G5 回放·openNode 开错抽屉归因**：`twintitle`（点了不开 + 冒牌抽屉含节点标题）→ 断言
  `resolution==='action_failed'` + `identityReadback.ok` 非 true + 不 `PASS`。验红：旧回读命中冒牌抽屉 →
  `unique` 假绿必败。
- **G6 编译·openNode 预点基线**：`twintitle` 上 compile flow 到 openNode → 断言 blocker exit 65 +
  零 events + blocker 点名预点基线证不出归因。验红：旧编译门等到冒牌抽屉可见、后置核验过 → exit 0 必败。
- **G7 回放·缺 `nodeName` fail-closed 钉桩**：happy 场景手编 set 与 select 事件**不带** `nodeName` →
  断言 `resolution==='action_failed'` + 不 `PASS`（D4：绝不回落宽域锁）。验红：旧门无此字段要求照常
  `unique`+`PASS` 必败；此桩同时锁死后人加 legacy 回落。

既有金牌补齐后的复跑（非新红，但属验收面）：三份补 `nodeName` 金牌 + `wf-open-node` +
涟漪族全绿、既有场景判定零行为差（GRILL D6 断言）。

## 预计重签 checksum 的 prd 清单

用 node 遍历 `loop/prd-*.json` 的 `testChecksums` 对 touchesFiles 求交（2026-07-13 实扫结果，一个不漏）：

| prd | 命中的冻结键 | 重签原因 |
|---|---|---|
| `loop/prd-wf-set-node-field.json` | `tests/_golden/wf-set-node-field.golden.mjs` | 手编 events 补 `nodeName` + 钉位加严 |
| `loop/prd-wf-select-node-dropdown.json` | `tests/_golden/wf-select-node-dropdown.golden.mjs` | 同上 |
| `loop/prd-replay-nth-visible-hardening.json` | `tests/_golden/replay-nth-visible-hardening.golden.mjs` + `tests/fixtures/fake-sut/server.mjs` | 金牌补 `nodeName`；夹具加场景（双冻文件） |
| `loop/prd-p5-replay.json` | `tests/fixtures/fake-sut/server.mjs` + `tests/fixtures/fake-sut/CONTRACT.md` | 夹具加场景 + 场景登记（双冻文件） |

条件项：`loop/prd-wf-open-node.json`（冻 `tests/_golden/wf-open-node.golden.mjs`）——预期零改动不重签；
实现期若被迫动它，重签并在提交说明记账。`lib/*.mjs` 两实现文件未被任何 prd 冻结（实扫确认）。
另注：`loop/prd-flow-bridge.json` / `loop/prd-report-workflow-structure.json` 虽引用三原子字样，其冻结
金牌不回放抽屉原子、`COMPILE_KNOWN_ATOMS` 恒 18 不变，零改动零重签（涟漪复跑守住）。

## 验收命令序

红证（实现前，accept 阶段）：

```
node tests/_golden/drawer-lock-hardening.golden.mjs        # 必须 G1–G7 逐条红（留输出作红证）
```

实现后（gate 慢，后台跑逐个收）：

```
node loop-kit/bin/breaker.mjs --reset
node tests/_golden/drawer-lock-hardening.golden.mjs        # 新金牌全绿
node tests/_golden/wf-set-node-field.golden.mjs            # 补 nodeName 后全绿
node tests/_golden/wf-select-node-dropdown.golden.mjs
node tests/_golden/replay-nth-visible-hardening.golden.mjs
node tests/_golden/wf-open-node.golden.mjs                 # 零改动复跑（预点基线零行为差）
node tests/_golden/wf-add-node.golden.mjs                  # 画布族涟漪
node tests/_golden/wf-connect-nodes.golden.mjs
node tests/_golden/wf-open-smoke.golden.mjs
node tests/_golden/flow-bridge.golden.mjs
node tests/_golden/p5-replay.golden.mjs                    # 夹具双冻回归
node tests/_golden/p5-replay-coverage.golden.mjs
node tests/_golden/e2e-chain.golden.mjs                    # 全链零行为差
node tests/_golden/report-workflow-structure.golden.mjs    # 集 18 不变 + 结构块零行为差
node bin/casey.mjs selftest --tier1                        # 裁判零 LLM 链路自检
node loop-kit/bin/gate.mjs --prd loop/prd-drawer-lock-hardening.json
node loop-kit/bin/gate.mjs --prd loop/prd-wf-set-node-field.json
node loop-kit/bin/gate.mjs --prd loop/prd-wf-select-node-dropdown.json
node loop-kit/bin/gate.mjs --prd loop/prd-replay-nth-visible-hardening.json
node loop-kit/bin/gate.mjs --prd loop/prd-p5-replay.json
```

收尾（合并前，HANDOFF 教训）：全仓 ratchet 总核——node 遍历每份 `loop/prd-*.json` 的
`testChecksums` 对实际文件 sha256 逐键比对，必须全 MATCH（逮跨契约共享冻结文件漏签）。

## 提交纪律

- 只列显式路径（上方 touchesFiles + 本目录文档），绝不 `add -A`；不带 `loop/prd-selftest.json` 时间戳漂移。
- 重签的 sha256 变更在提交说明里逐 prd 记账（冻结文件对实现者只读、重签走记账例外）。
- 异构冗余评审：本实现属 Claude 家族 → review 阶段派 codex（评审家族≠实现家族）。

```
