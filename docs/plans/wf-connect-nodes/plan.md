# wf-connect-nodes — 画布连线原子 + addNode 精化收口（full）

## 背景

并发 session（codex 实现）已建成 workflow.connectNodes + 精化 addNode（expectedNodeDelta），真机验过但六阶段
未走。本契约补收口：填端到端覆盖、重签四棘轮 prd、异构评审（评审归属反转：codex 实现 → Claude 评审）。
决策全录 proposed/GRILL.md（D0 评审反转 / D1 复用 dragTo / D2 按原子分发门 / D3 边数身份回读 / D4 addNode
expectedNodeDelta / D5 覆盖缺口 / D6 重签清单）。

## 已在工作树的 codex 改动（本契约合法化 + 评审对象）

1. `lib/compile-atoms.mjs`：分派表 +`workflow.connectNodes`（集 14→15）；`compileWorkflowConnectNodes`（复用
   dragTo、.lf-edge +1 身份回读）；共享辅助 `canvasBox` / `nodeDragSource` / `workflowNodeBox` /
   `dragConnectByLabels` / `exactTextRe`；`compileWorkflowAddNode` 精化（expectedNodeDelta：真并行网关开始 +2；
   nodeDragSource icon 优先 box + 开面板 500ms settle；emit 加 nodeName 字段——events.schema:159 既有属性零涟漪）。
2. `lib/replay-actions.mjs`：`doDragTo` 顶部按 `ev.atom==='workflow.connectNodes'` 分发 `doConnectNodes`
   （源在 .lf-canvas-overlay 按标签解析、.lf-node-anchor-hover 最近锚点、拖目标、.lf-edge 增身份回读）；
   addNode 分支重构 nodeDragSource（.node-item 域锁保 R1-F2）+ canvasBox 优先 .lf-canvas-overlay + steps 20 + settle。
3. `lib/atoms-registry.snapshot.json`：workflow.addNode +expectedNodeDelta 参数 + post 描述改（快照非冻结面，零重签）。
4. `tests/fixtures/fake-sut/server.mjs`：画布连线通路纯加法（每节点 .lf-node-anchor-hover + beginEdge mousedown→
   拖到另一 .lf-node 落 .lf-edge）；prd-p5-replay 重签。
5. `tests/_golden/{flow-bridge,wf-open-smoke,wf-add-node}.golden.mjs`：例翻集 14→15（connectNodes 入正例集/反例
   仍 agent.openToolPicker）；prd-flow-bridge / prd-wf-open-smoke / prd-wf-add-node 重签。

## 本契约新增（填覆盖缺口）

6. `tests/fixtures/fake-sut/server.mjs`：加「真并行网关开始」面板项——单次拖拽落 2 个 .lf-node（覆盖 addNode +2 路径）。
7. `tests/_golden/wf-connect-nodes.golden.mjs`（新，红先行）：端到端连线 + addNode +2。
8. `tests/fixtures/fake-sut/CONTRACT.md`：连线通路 + 双节点行为契约增补。

## 验收（红金牌 tests/_golden/wf-connect-nodes.golden.mjs + loop/prd-wf-connect-nodes.json）

- C1 connectNodes 可编译 + `COMPILE_KNOWN_ATOMS` 恰 15（与 wf-add-node C1 一致，防漂移）。
- C2 端到端连线（fake-sut happy）：compile [nav, open, addNode×2, connectNodes] → events 含 connectNodes dragTo 步
  （semantic fromLabel + nodeName=toLabel + ox/oy 有限数）→ 过 events.schema → blockers 空 → replay（doConnectNodes
  真跑夹具）→ verdict countChange(.lf-edge) up PASS。
- C3 fail-closed 反面：源/目标节点缺席 → doConnectNodes none/action_failed 不假绿、verdict 不 PASS；
  锚点缺席 → action_failed；连线后 .lf-edge 不 +1 → 编译期 blockers 硬阻断 65 零 events。
- C4 addNode +2 路径：真并行网关开始 → .lf-node +2 后置核验过、blockers 空；普通节点仍 +1（回归不破 R1-F1/F2/F4f）。
- 涟漪：四漂移 prd 重签 + gate 复验 GREEN；wf-add-node/flow-bridge/wf-open-smoke/p5-replay/e2e-chain/p3-compile/
  seams 零行为差 + tier1。
- observability（route:human）：window.lf 图对象口挂账（连对哪两个的确定性取证）+ 真机锚点类名/时序漂移复核。

## 非目标

见 GRILL D7（R9 其余画布原子 / window.lf 取证 / 不动 events.schema-verdict-gate 冻结内核 / 不建 cases/）。
