# plan · wf-open-readback-requery（light）

## 背景与根因（B4 十跑诊断实证）

十跑（令牌 `b4r100806h`，全链路 1m17.5s）证明语义名回填修已生效：0 步非 unique，
`workflow.open` 前奏容器命中 4ms、锚定命中 3ms，click 步 unique+acted。新阻断在下一层：
source 读回双证门裁定 `action_failed（envelope-empty）`，fail-closed 不产 events，exit 65。

`envelope-empty` = 账本结算后武装事务内**零归属请求**（`agent-identity-observation.mjs:136`）。
归属判据要求请求的查询回声恰等武装时冻结的期望串（`:78`）。三层叠加使该门在现役配置下
结构性不可满足：

1. **事务时机反了**：`compileWorkflowOpen` 现序是 click → `waitForURL /process/detail` →
   才调 `armWorkflowSourceReadback`（`compile-atoms-workflow-nav.mjs:155-167`）。详情页上
   既无列表卡片 DOM（`.agent-card`）供物理双锚，也不会自发带期望回声的列表查询。
2. **重查触发缺失**：`armWorkflowSourceReadback` 仅当 `profile.workflows.searchBox` 声明时
   才主动触发带回声重查——全仓无一 profile 声明过它；未声明分支依赖的「既有列表查询回声」
   被回声判据排除，必然空。
3. **死路径姿势错**：声明分支 emit 的是 fill+Enter；seam-1 真机已证 Enter 不过滤、
   放大镜才过滤。

十跑是这扇门真机首次执行（一至九跑全部停在更早层），与语义名模板缺陷同族：
「该配置从未走通过」。

## 修法（丙路线·扫描读回，Steven 2026-08-06 grill 定案；未声明身份通道路径零漂移）

grill 曾摆两路：乙（信封，镜像 agent.searchOpen 的 UI 搜索+CDP 捕获——但 workflow 列表
UI 搜索的查询参数名从未真机证实，赌错烧十一跑）与丙（扫描，镜像 workflow.create 真机
已通的 `fetchCreatedWorkflowListScan` 页面语境直取列表 API——v3 已审模式、零未证假设、
零新回放事件）。定案丙；乙的 UI 真流量纯度属取证轴诉求，对点击前身份预核非必需。

只动 `compileWorkflowOpen` 的**声明身份通道分支**（`run.identityLedger` 在且
`profile.workflows.listApi` 声明）；未声明路径（wiring 金牌 H2 场景域）字节零漂移。
声明分支重构为（前奏/锚定/容器归属闸原样保留在前）：

1. **点击前**列表页语境扫描读回：`fetchCreatedWorkflowListScan(run.page, { profile,
   entityName: 实例化名 })`，沿用 create 侧 0/500/1500ms 三试与完整性判据
   （`scan.complete !== true` 不出行集）；
2. 物理双锚 `resolveAgentCardTarget`（profile `itemContainer`/`cardFields`，列表页语境）；
3. 双证裁定复用冻结纯函数 `resolveDualIdentity`：扫描行集投影为信封等价输入
   （`{ status:'ok', rows, total }`，行已是 `{id, code, name}` 投影），DOM 面喂卡片双锚——
   裁定语义（完整性先决/同名计数/联合判据）一字不改；
4. 非 unique → `identityGateOutcome` + blockers 硬阻断 fail-closed **不点**
   （比现序更严：未证对象不点开）；扫描不可得（fetch 失败/不完整）同样 fail-closed；
5. 过门后句柄内点击（TOCTOU 重验 `clickAgentCardWithin`，镜像 agent `:93-111`；事件形状
   仍为 click + semantic text，回放面零新形状零新事件）→ `waitForURL /process/detail`；
6. `run.pendingIdentityObservation = { matched, evidenceStepId: click 步 id, kind: 'workflow',
   sourcePath }`（保留现返回形状，compileFlow 归档消费面不变）。

`armWorkflowSourceReadback` 原函数体（信封路线）随重构退役；工作流身份账本接线
（`bin/compile.mjs:310`）不拆除、只不再被 open 消费——拆除与否留评审议（非目标）。

## 验收（金牌红先行）

新金牌 `wf-open-readback-requery.zero-sut.golden.mjs`（mock 页驱真实 `compileFlow`，
零浏览器零网络零 SUT）：

- S1 时序钉：声明分支读回+双证发生在 click **前**（扫描恰 1 + DOM 双锚过 → 才有
  click event），`evidenceStepId` 恰等 click 步 id、观察形状 `{matched, evidenceStepId,
  kind:'workflow', sourcePath}` 全档；
- S2 fail-closed 钉：扫描零命中/不完整 → `action_failed` 入 blockers + **零 click event**
  （不点未证对象）+ compileFlow 中止；
- S3 裁定同门钉：双证走 `resolveDualIdentity` 且信封等价输入携完整行集
  （同名多行 → ambiguous、码不等 → action_failed，抽两例证裁定语义未被旁路）；
- S4 零漂移钉：未声明路径（`identityLedger: null`）events 序列与基线逐位同。

红基线实抓（现实现 S1/S2/S3 必红、S4 绿）；突变闭环（`git show` 姿势还原）；
**全仓金牌扫描**（碰定位/强制层邻接，护栏 #19）与 `8d0e6e3` 基线逐个双态对比——
已录基线：`entity-workflow-source-readback.arming.static` 既存红 0/7（门面拆分陈旧族）、
`entity-ui-wiring.searchopen` 既存红 10/11（同族），改后须**基线同码**；其余接缝金牌
（wiring/cardinality-reverse/search-first/preface-notes/post-nav/sleep-import/bindagent-replay）
基线绿须保持绿。

真机兑现（完成闸，ADR-0009）：合入 dev 后 B4 十一跑（新 `atl_` 长名令牌）——预期 open 步
读回三方全等、链路首次推进到 `assert.onPage(detail)` 与删除步。

## 非目标

- 不动 agent 侧 `compileAgentSearchOpen` 与账本层 `agent-identity-observation.mjs`；
- 不动 create 侧 `readCreatedWorkflowIdentity` 与 `fetchCreatedWorkflowListScan` 本体
  （只消费，不改语义；若签名不适配 open 需薄适配层，落 open 侧不回改 create 侧）；
- 不修两个既存陈旧红金牌（门面拆分族，挂账另立 owner）；
- 不拆工作流身份账本接线（open 不再消费即可，拆除留评审议）；
- 不动回放侧与裁判（零新事件形状、零新事件）；
- 不动 `profile.json` 与任何冻结件（零数据变更、零 checksumAmendment）。
