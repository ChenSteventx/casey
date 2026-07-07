# wf-connect-nodes — grill 决策记录（画布连线原子 + addNode 精化收口，full）

> 背景：并发 session（codex 实现）已在共享工作树建成 workflow.connectNodes + 精化 addNode，真机验过
> （0→2 节点、1 边、resolution unique、未保存不污染），但六阶段治理未走：无契约、四棘轮 prd 未重签、
> 无端到端连线金牌。本契约由 Claude 侧补收口——补覆盖、重签、异构评审、留档。Steven 点选「我来补重签 + 收口」。

## D0 评审归属反转（本契约特有）

- 分岔：codex 是 connectNodes 的实现方——评审仍送 codex？
- 定夺：不送 codex（会同族自评，违 [[review-uses-codex]] 的「绝不同族自评」）。异构原则是实现方≠评审方；
  本契约实现方 = codex，故评审方 = Claude 侧（独立对抗子代理，只喂 spec+diff+证据，护栏 #9）。这是异构方向
  的一次反转，不是废除异构——记 audit 说明。

## D1 connectNodes 动作承载：复用 dragTo 不扩枚举（codex 已定，采纳）

- 证据：连线本质是「源锚点拖到目标」——mouse 三段式，与 dragTo 同形；events.schema action 枚举已含 dragTo
  （wf-add-node 建、8 动作），nodeName 字段既有（events.schema:159）可承载目标节点名，ox/oy 承载目标中心
  相对画布的内容坐标（诊断/兜底锚）。复用 dragTo → 零 events.schema/三姊妹 schema 双冻结涟漪。
- 定夺：复用 dragTo 动作，connectNodes event = { action:'dragTo', semantic:{text,fromLabel}, nodeName:toLabel, ox, oy }。

## D2 编译门 ↔ 回放门按原子分发（codex 已定，采纳——是 wf-add-node R1-F2 教训的正确延续）

- 分岔：connectNodes 的 dragTo 回放走既有 doDragTo（源锁 .node-item 面板域）会零命中——连线源是画布 .lf-node、非面板项。
- 证据：wf-add-node R1-F2 定「编译门=回放门、按域锁源」；连线的域是画布节点、addNode 的域是面板项——两域不同。
- 定夺：doDragTo 顶部按 `ev.atom === 'workflow.connectNodes'` 分发到专用 doConnectNodes（源在
  .lf-canvas-overlay 按标签解析节点、找最近 .lf-node-anchor-hover 锚点、拖到目标节点中心）；addNode 分支
  保持 .node-item 域锁（nodeDragSource，R1-F2 不回退）。每原子一扇门、门与编译侧 customAct 同刻。

## D3 身份回读：无 window.lf → 只能断边数增（codex 已定，采纳 + 挂账）

- 证据：纯 DOM 读不到边的 source/target（registry:234 自注），只能断 .lf-edge 计数 +1，断不出「连对哪两个」。
- 定夺：动作成功以 .lf-edge 计数 +1 为身份回读（防「鼠标动了没连上」假 unique）；「连对哪两个」的确定性
  取证挂账 SUT 暴露 window.lf 图对象（与 wf-add-node observability 同款、route:human）。

## D4 addNode 精化：expectedNodeDelta（codex 真机发现，采纳 + 须补 hermetic 覆盖）

- 证据：真机实测「真并行网关开始」一次拖拽生成 start/end 两节点（.lf-node +2）——原 addNode 硬钉 +1 会误判假绿/漏落。
- 定夺：addNode 加 params.expectedNodeDelta（缺省普通节点 +1、真并行网关开始 +2）；registry 同步。
  另 nodeDragSource 改 icon 优先 boundingBox + 开面板后 500ms settle（真机时序）——保持 .node-item 域锁不变。
- 缺口：wf-add-node 金牌 C2/C3 只测 +1 路径（脚本转换）；+2 路径仅真机验——本契约补 fake-sut「真并行网关开始」
  双节点夹具 + hermetic 断 +2（否则 +2 分支可静默回归）。

## D5 覆盖缺口填补（本契约核心增量）

- 现状：connectNodes 仅 wf-add-node C1 注册检查（可编译 + 集 15），零端到端金牌——doConnectNodes 回放分支可静默回归。
- 定夺：新建 tests/_golden/wf-connect-nodes.golden.mjs——端到端：compile 一条 [nav, open, addNode×2, connectNodes]
  flow（fake-sut happy）→ events 含 connectNodes dragTo 步（源语义 fromLabel + nodeName=toLabel + ox/oy）→
  过 events.schema → blockers 空 → replay（doConnectNodes 真跑夹具）→ verdict countChange(.lf-edge) up PASS；
  反面：源/目标节点缺席 none 不连、锚点缺席 action_failed 不假绿、边数不 +1 进 blockers。红先行 = stash doConnectNodes
  回退（源零命中）证红。addNode +2 路径同金牌加一条（真并行网关开始 → .lf-node +2）。

## D6 重签清单（四棘轮 prd + 新金牌 prd）

- 漂移重签：prd-wf-add-node（wf-add-node.golden 集 15）/ prd-flow-bridge（例翻）/ prd-wf-open-smoke（例翻）/
  prd-p5-replay（fake-sut server.mjs 连线夹具 + CONTRACT.md 增补）。
- 新冻：prd-wf-connect-nodes 冻 tests/_golden/wf-connect-nodes.golden.mjs。
- gate 全绿复验。涟漪回归 e2e-chain/p3-compile/seams 零行为差。

## D7 非目标

R9 其余画布原子（openNode/setNodeField/... 逐条另契约）；window.lf 图对象取证（挂账 SUT）；
不动 events.schema/verdict/gate 冻结内核（connectNodes 复用 dragTo 零 schema 改）；不建 cases/ 真用例。
