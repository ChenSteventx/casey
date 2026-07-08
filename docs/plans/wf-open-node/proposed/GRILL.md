# wf-open-node — grill 决策记录（画布维度第三原子 workflow.openNode，light）

> 背景：R9 画布余量续建（HANDOFF「下一步」B 线，Steven 点选）。addNode + connectNodes 已建
> （COMPILE_KNOWN_ATOMS 15），openNode 是抽屉族原子（setNodeField/selectNodeDropdown/...）的
> 共同前置——registry 下游六条原子的 desc 都写「需先 workflow.openNode」。骑本 session 画布/
> 连线夹具，零冻结 schema 改动。

## D1 交互形态：单击节点中心（事实源冲突，Steven 拍板）

- 分岔：registry 在册条目（lib/atoms-registry.snapshot.json:197，autotester 真机 SOP、下游抽屉族
  原子全靠它跑通过）说「按节点标题定位 .lf-node → 点中心 → 等抽屉打开，点空重点一次」——单击；
  HANDOFF/NEXT-SESSION 文字写「双击开抽屉」——查无探针实证（wf-add-node 两发探针只测面板项、
  没测节点体），且 LogicFlow 默认双击是进节点文本编辑态、若平台未自定义会误触。
- 定夺（Steven 拍板 2026-07-07）：单击节点中心，registry 真机 SOP 为准；HANDOFF「双击」按笔误
  处理。不带「点空重点一次」重试启发式——单击一次 + 后置核验抽屉开，不开如实落轴 fail-closed
  （真机 bring-up 若证伪单击，改一行动作即可；重试逻辑等真机证据再议）。

## D2 车道：light（Steven 拍板）

- 分岔：HANDOFF:282 预判 direct/light 均可（先例 wf-history-version/wf-open-smoke 纯加法原子走
  direct）。但本契约要加 doOpenNode 专用回放门新分支（lib/replay-actions.mjs 按 ev.atom 分发），
  比 wf-history-version（纯既有动作）多一块机制件。
- 定夺：light——加 plan 门便宜；异构评审深度照旧不豁免。

## D3 动作承载：click 已在枚举，零冻结改动

- 证据：events.schema action 枚举已含 click/dblclick（8 动作）；openNode 单击语义就是 click，
  semantic:{kind:'text', name:label, exact:true} 承载节点标题、atom:'workflow.openNode' 供回放门分发。
- 定夺：event = { action:'click', semantic:{text,label}, atom:'workflow.openNode' }。不扩
  events.schema/三姊妹 schema，双冻结零涟漪。

## D4 编译门 ↔ 回放门按原子分发（connectNodes 先例延续）

- 分岔：openNode 的 click 若走统一身份门（全页 semanticLocator getByText）必撞多匹配——节点标题
  （如「开始」「智能体」）同时活在左面板 .node-item 与画布 .lf-node-content，全页 text-exact
  count≥2 → ambiguous 卡死合法回放（wf-add-node R1-F2 同型缝）。
- 定夺：performAction 顶部按 `ev.atom === 'workflow.openNode'` 分发专用 doOpenNode——域锁
  .lf-canvas-overlay 内 getByText(label, exact) → closest .lf-node → 点节点中心。域内计数
  恰 1 才点（统一身份门同律：多匹配 ambiguous 绝不点、缺席 none + 缺席守卫不抛穿——nodeBoxByLabel
  的 waitFor 守卫先例 codex R2-F1）；编译侧 customAct 与回放门同刻（同域锁 + 同唯一性闸）。
  注意：现 nodeBoxByLabel 用 .first() 无唯一性闸（connectNodes 既定形态、不动）；openNode 新门
  自带域内唯一闸、不复用 .first() 写法。

## D5 身份回读：抽屉可见 + 内含节点标题双证

- 证据：registry post =「右侧配置抽屉打开」；真机节点配置抽屉的容器类名未采样（wf-add-node 四项
  观测 route:human 未含此项），但 HEREN 组件库抽屉族 fake-sut 已采 .hr-drawer__content-wrapper
  （新增工作流表单用，真机同库）；registry 下游原子 desc 见 .hr-cascader/.request-params-item/
  .text-input-area 均活在抽屉内。
- 定夺：回读 = 单击后限时等 .hr-drawer__content-wrapper 可见且内含节点标题文本（双证：开了、
  且开的是这个节点）——防「点了没开」与「开的是别的抽屉」两向假绿；证不出 → action_failed/
  identityReadback ok:false 如实落轴。编译侧后置核验同款进 run.blockers 硬阻断。真机抽屉类名
  + 标题呈现是否含节点名——挂 observability route:human（合并行程顺带采样）。

## D6 夹具：fake-sut 节点抽屉纯加法（复现接缝、不倒裁）

- 定夺：canvas 编辑器页加「单击 .lf-node → 右侧出现 .hr-drawer__content-wrapper 带该节点标题」
  通路（镜像真机 SOP 行为）；纯加法、既有 addNode/connectNodes 通路零动。夹具行为 = registry
  真机 SOP 的最小复现，不为金牌预定裁定倒着裁。

## D7 金牌 + 红先行（镜像 wf-connect-nodes 覆盖形态）

- 定夺：新建 tests/_golden/wf-open-node.golden.mjs——C1 openNode 可编译 + 集恰 16 +
  agent.openToolPicker 仍不可编译；C2 端到端 compile [nav, open, addNode, openNode] →
  events 过 schema → replay 真跑夹具 → 抽屉回读 unique → verdict PASS；C3 fail-closed 族：
  节点缺席 none 不点、域内多匹配 ambiguous 不点、抽屉不开 action_failed 不假绿（识别缺口教训：
  「原子建成」的验收 = compile→replay→verdict 端到端金牌，不是注册了）。红先行：实现前全红。

## D8 例翻涟漪 + 重签清单

- 四金牌钉「集 15」全翻 16：flow-bridge.golden:184 / wf-add-node.golden:113 /
  wf-connect-nodes.golden:94 / wf-open-smoke.golden:55 → 各 prd 棘轮重签。
- fake-sut/server.mjs 夹具改动 → prd-p5-replay 夹具 checksum 重签 + 全消费者 golden 复跑。
- 新冻 prd-wf-open-node。共五重签 + 一新冻，gate 全绿复验；涟漪回归 e2e-chain/p3-compile/tier1。

## D9 非目标

setNodeField/selectNodeDropdown（贪心序下一契约，+selectNodeDropdown 解锁 9/23）；真机抽屉
类名/单击行为复核（route:human 挂 observability）；不动 events.schema/verdict/gate 冻结内核；
不建 cases/ 真用例；不碰 heal。
