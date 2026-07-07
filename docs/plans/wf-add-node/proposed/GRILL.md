# wf-add-node — grill 决策记录（画布维度首原子 workflow.addNode，full）

> 授权链：Steven 点单——画布维度首原子 `workflow.addNode` 编译知识建成，解锁 R9 坐标 flow
> （23 条 R9 flow 中 `addNode` 出现于全部 23 条，docs/plans/p2-intent-compile/flywheel-schedule.md:18-20）。
> full 车道理由：动双冻结（`events.schema` 动作枚举 + 动作词汇表镜像）+ 回放器新动作分支 + 例翻涟漪 + 设计条款修订。

## 背景（真机二号探针，2026-07-07 隧道在场实测，探针工作流自建自删）

- 画布 = LogicFlow 形态，主 frame 无 iframe；类名实采：`lf-graph` / `lf-canvas-overlay` / `lf-drag-able` /
  `lf-grid` / `lf-tool-overlay` / `lf-menu` / `lf-snapline` / `mcp-tool-flow__body` / `graph`。
- 「添加节点」按钮 `getByRole` button name=添加节点 count=1；点开面板 `.node-item` 21 项，全文本实采：
  开始节点/结束节点/HTTP请求/SSE流式请求/变量映射/排他网关/并行网关/真并行网关开始/真并行网关结束/脚本转换/
  模型节点/知识库检索/重排序/数据库节点/MCP工具/智能体/工作流/变量聚合/文档提取/缓存读取/缓存写入/人工介入。
- 甲案死刑：面板项「结束节点」单击、双击均不落节点（`.lf-node` 计数 0→0→0）。
- 乙案成立：`mouse.down` → `move`(steps:12) → 300ms → `up` 拖「脚本转换」到视口 (0.62w, 0.5h) 后
  `lf-node` / `lf-node-default` / `lf-node-content` / `lf-anchor` / `lf-outline-node` 类名出现、「脚本转换」文本命中 1→2。
- `window.lf` 不存在（globals 仅 `__VUE__`）——`connectNodes` 拓扑取证无图对象口（lib/atoms-registry.snapshot.json:229
  自注 + flywheel-schedule.md:32 预留），挂账 SUT 配合；`addNode` 取证只靠 DOM 计数 + 网络切片。

## D1 动作类新增与双冻结重签授权

- 分岔：新增 `dragTo` 动作类（乙案）vs 既有动作组合（甲案 click/dblclick）vs 维持画布拖拽 route:human。
- 证据：甲案真机死刑（上节）；`events.schema` action 枚举已冻七动作
  （tests/_golden/schemas/events.schema.json:86-94，prd-seams-freeze.json:7 checksum），其 :95 描述明文
  「画布 drag/connect 等本质不可复现步走 route:human、不入此 spec」；动作词汇表镜像已冻
  （tests/_golden/schemas/action-vocabulary.schema.json:61-70 枚举 + :39 `maxItems` 镜像枚举长度，
  prd-seams-freeze-v2.json:8 checksum），其 :70 钉死棘轮路径「新增动作 = 改已冻 events.schema 枚举 +
  驱动 + golden 的棘轮事件」。
- 涟漪清单（显式棘轮事件，一次重冻全走）：
  1. tests/_golden/schemas/events.schema.json —— action 枚举 +`dragTo`、:95 描述修订（同 D2 条款口径）、
     `allOf` 补 `dragTo` 条件分支（落点参数必填，:184-227 先例）；
  2. tests/_golden/schemas/run-history.schema.json —— action 枚举镜像 + `locatorResolution` 分支归位
     （`dragTo` 源有定位 → 入 click/dblclick/fill/selectOption 的 string 分支，seams-freeze-v2.golden.mjs:544-545 校验）；
  3. tests/_golden/schemas/action-vocabulary.schema.json —— 枚举 + `maxItems` 7→8（v2 golden :555-559 全等比对）；
  4. tests/_golden/schemas/channel-driver.schema.json —— `actionSpace` 枚举镜像（v2 golden :33 注记的三处全等之一）;
  5. tests/_golden/fixtures/seams-v2/action-vocabulary.fixture.json —— 新增 `dragTo` 治理条目
     （v2 golden :367 要求 fixture 覆盖全枚举）；channel-driver.fixture 的 `actionSpace` 同步；
  6. tests/_golden/seams-freeze.golden.mjs:55-57 —— 稳定定位字段名单加 `dragTo`（源必须有语义定位，禁纯坐标）；
  7. bin/replay.mjs:72 `RH_ACTIONS` 集合 + lib/replay-actions.mjs 动作分支（D3）；
  8. CONTEXT.md:62 动作词汇表词条括号内枚举串同步（术语表投影，防 term-lint 漂移）；
  9. loop/prd-seams-freeze.json 与 loop/prd-seams-freeze-v2.json `testChecksums` 重冻重签。
- 定夺：Steven 已拍板——走乙案新增 `dragTo`（甲案证伪），双冻结重冻重签已授权。

## D2 落点参数形态与「禁纯坐标步」条款修订

- 分岔：落点参数形态——(a) 画布容器相对 `offsetX`/`offsetY`（registry x/y 语义直译，600/280 缺省）
  vs (b) 视口比例（探针实测用 0.62w/0.5h）。
- 证据：registry `workflow.addNode` 参数 x/y 语义「相对画布左上角，缺省 600/280，x≥600 避左侧面板、
  间距≥350 防重叠」（lib/atoms-registry.snapshot.json:176-185、:164）；events.schema 既有 `ox`/`oy` 字段
  （tests/_golden/schemas/events.schema.json:171-176，autotester 遗产、无语义描述）可承载容器相对落点——
  零新增字段；`x`/`y` 字段描述已钉死「仅非定位兜底元数据、禁作唯一定位」（:164-167）不可挪用语义。
- 取向：倾向 (a) 容器相对 offset——落点是内容参数（「把节点放到画布哪里」是用例语义，非定位兜底），
  相对画布容器不随视口尺寸/录屏分辨率漂移，registry 语义直译零翻译损耗；(b) 视口比例随窗口大小漂移、
  伤确定性回放。承载字段复用 `ox`/`oy` 并在重冻时补语义描述（「`dragTo` 落点：相对画布容器左上角的内容参数」）。
- 设计条款修订草案（docs/design/txt2testreport-design.md:135，Steven 已拍板修订留痕，文案随 grill confirm 定稿）：
  原文尾句「禁止纯坐标步（authoring agent 非人手光标，无录制坐标）；本质不可复现步（画布拖拽等）标 route:human」
  改为「禁止纯坐标步语义不变（定位必须走稳定属性，坐标绝不作定位依据）；画布拖拽经 `dragTo` 动作类封装为
  确定性动作——源经语义定位器 + 点击身份门定位，落点坐标是内容参数而非定位兜底；无法封装的本质不可复现步
  仍标 route:human（2026-07-07 真机二号探针实证修订，wf-add-node GRILL D2）」。events.schema:95 描述同口径改。
- 定夺：条款修订已拍板（草案如上）；落点参数形态 Steven 已拍板（2026-07-07 点选）——(a) 画布容器相对
  `offsetX`/`offsetY`，承载复用既有 `ox`/`oy` 字段并重冻时补语义描述。

## D3 回放器 dragTo 分支（身份门怎么套）

- 分岔：源与落点各过什么门；失败语义怎么落轴。
- 证据：统一点击身份门 count===1 才动作、多匹配绝不执行变更动作（lib/replay-actions.mjs:3、:46-60；
  CONTEXT.md:75）；`doAct` 守卫不抛、未知动作如实回 false（:63-72，现状 `dragTo` 会落 `action_failed`
  不假绿）；`nav` 之外动作统一走 `performAction`（bin/replay.mjs:392-397），归因窗开在动作 + 因果作用域
  （:398-402）。
- 取向（本 GRILL 钉死）：
  · 源（面板项 `.node-item` 文本）过身份门——语义定位 count===1 才拖，多匹配/缺席照 :46-60 既有三态落轴；
  · 落点不做身份门——它是内容参数非定位（D2），但画布容器（`.lf-graph`）须 count===1 且 boundingBox 可取，
    取不出 = 证不出 → 如实回 false（fail-safe，绝不谎报 `actionPerformed`）；
  · 动作本体 = `mouse.down` → `move`(steps:12) → 300ms → `up`（真机实证时序照搬）；守卫不抛、失败回 false；
  · `dragTo` 归因窗沿用 click 的因果作用域惯例（bin/replay.mjs:393-402），网络切片如实归因；
  · 接线位：lib/replay-actions.mjs `doAct` 加 `dragTo` 分支 + bin/replay.mjs:72 `RH_ACTIONS` 补名。
- 定夺：随乙案已拍板；分支细节按本条取向进 plan（grill confirm 收口）。

## D4 compileWorkflowAddNode 三轴

- 分岔：编译知识形态与三轴各走什么通道。
- 动作轴（取向）：条件步线性化开面板（「添加节点」按钮 role=button count=1 真机已实证；面板已开则跳过，
  镜像 workflow.create 下拉菜单线性化先例 lib/compile-atoms.mjs:448-462）→ `dragTo` 本体经 `run.emit` 的
  `customAct` 通路执行（lib/compile-atoms.mjs:180-182，emit 自动走定位核验/静默点/采集全生命周期
  :169-238）→ 后置核验 `.lf-node` 计数 +1，核验不过进 `run.blockers` 硬阻断（:113，`executeMode` 据此
  fail-closed 不产成功产物——镜像 workflow.open 容器归属闸先例 :333-352）。
- 断言轴（分岔）：`countChange` kind 已实现（lib/replay-assert.mjs:11、:56-66；op 见 bin/check.mjs:15），
  但回放计数通道钉死 `.hr-table-row`（bin/replay.mjs:134-137 `rowCount`）——画布用例数不到 `.lf-node`。
  两路：(a) 通道剖面加计数选择器（profile 非冻结面，加法零碰冻结）vs (b) `countChange` 带 selector 参数
  （碰 expected-frozen.schema:68 与断言词汇表冻结面）。取向 (a)：profile 加 `countSelector`，缺省
  `.hr-table-row` 零行为差；(b) 涟漪大且 LLM 自由发明 selector 违断言词汇表纪律（CONTEXT.md:61）。
- 取证轴（定夺照探针）：DOM 计数 + `requestLog` 网络切片如实归因（落节点是前端画布状态、未必发请求——
  切片可为空，如实记录不虚构）；`window.lf` 缺席 → 图拓扑取证证不出，挂账 SUT 配合暴露图对象口
  （flywheel-schedule.md:32 预留、registry:229 自注），prd `observability` 记 route:human。
- 定夺：三轴形态按本条取向进 plan；断言轴 (a)/(b) 随 grill confirm 定（取向 (a)）。

## D5 例翻目标与 prd 重签清单

- 分岔：flow-bridge/wf-open-smoke 两金牌拿 `workflow.addNode` 当「册内无编译知识」反例——知识建成后例翻，
  反例换谁：(a) `agent.openToolPicker` / `picker.selectFirstTool`（agent_tool 维度，长寿候选）vs
  (b) `workflow.optimizeVersion`（画布维度）。
- 证据：翻转位三处——flow-bridge.golden C5 反例本体（tests/_golden/flow-bridge.golden.mjs:90-98）、
  C14 不可编译名单 + 集恰 13（:179-185，翻后 13→14）、C15 篡改探针用 `addNode`（:187-197）；
  wf-open-smoke.golden C1 集恰 13（tests/_golden/wf-open-smoke.golden.mjs:51-56，翻后 13→14）。
  候选都在册：`agent.openToolPicker`（registry:608）、`picker.selectFirstTool`（:657）、
  `workflow.optimizeVersion`（:474）。agent_tool 维度整体压后（要 14 新原子 + deepseek-v3/三方 MCP 双
  stale 依赖，flywheel-schedule.md:24）→ (a) 长寿；(b) 属画布维度本身，`addNode` 建成后按 R9 排期很快
  轮到 → 短寿再翻、又一轮涟漪。
- 取向：(a) `agent.openToolPicker`（agent_tool 维度里 `requires` 链最浅的入口原子，反例语义直白）。
- prd 重签清单（定夺照既定授权）：loop/prd-flow-bridge.json:6 与 loop/prd-wf-open-smoke.json:6 两处
  golden checksum 重冻重签；prd-caseid-echo-mask.json:31 / prd-cli-mcp-face.json:33 /
  prd-handover-pack.json:31 / prd-ingest.json:36 仅 acceptance 引用两金牌、无 checksum，不重签、gate 复验即可。
- 定夺：例翻反例目标 Steven 已拍板（2026-07-07 点选）——(a) `agent.openToolPicker`；重签清单如上定。

## D6 fake-sut 画布夹具

- 分岔：真 LogicFlow 依赖 vs 纯 DOM mouse 三段式监听。
- 证据：fake-sut 详情页现状只有「保存」钮（tests/fixtures/fake-sut/server.mjs:144-167 `renderDetail`）；
  夹具零第三方依赖是 hermetic 底线（selftest tier1 零外部依赖）；真机类名已实采（背景节）。
- 取向（定夺照点单）：纯 DOM——detail 页加「添加节点」按钮 + `.node-item` 面板 + 画布容器
  （类名对齐真机 `lf-graph`），容器监听 `mousedown`/`mousemove`/`mouseup` 三段式落 `.lf-node` div
  （子结构含 `.lf-node-content` 与节点名文本，喂后置核验与 `countSelector` 计数），不上真 LogicFlow；
  既有场景（happy/drift/ambiguous/...）零行为差。共享夹具已被 prd-p5-replay 冻结
  （loop/prd-p5-replay.json testChecksums 含 server.mjs）→ 重冻重签，wf-open-smoke GRILL D2 同款先例。
- 定夺：纯 DOM 定；夹具落点判定只认「up 时落在容器内」即可（不仿真吸附/网格，别过拟合真 SUT）。

## D7 hermetic 验收与真机验收分界

- 分岔：金牌管到哪、真机停站挂哪。
- 取向（定夺照 wf-open-smoke D4/D5 先例）：
  · hermetic 金牌走全程——`addNode` 可编译 + 集 13→14（例翻联动）、compile 全程 events
    含 `dragTo` 步钉死、blockers 空、sign → replay（`dragTo` 分支真跑夹具）→ verdict 全 PASS；
    反面用例：源面板项多匹配/缺席不拖、画布容器缺席回 false、`.lf-node` 计数不 +1 进 blockers。
  · 真机四停站照例 route:human 挂 prd `observability`：① 21 面板项文本随版本漂移；② `lf-node` 族类名
    漂移；③ 拖拽时序（steps:12 + 300ms）在真机负载下的稳定性；④ `window.lf` 图对象口挂账 SUT 配合。
    可与既有真机合并行程（HANDOFF 首推）一次清账。
- 定夺：按本条取向定。

## D8 21 节点名枚举进注册表/参数校验

- 分岔：`nodeName` 白名单枚举校验 vs 自由文本 + 身份门 fail-closed 兜底。
- 证据：registry `nodeName` desc 所列 21 名已与真机漂移——registry 有「真并行网关」「中断节点」
  （lib/atoms-registry.snapshot.json:169），真机实采是「真并行网关开始」「真并行网关结束」「人工介入」：
  白名单会拒真机真实存在的节点名、放行已消失的名；compile-gate 参数校验只做必填/类型/未声明键
  （lib/compile-gate.mjs:49-56），无枚举校验机制可挂；面板项文本 text-is count===1 的身份门本身就是
  运行时白名单——名对才拖、名错缺席不 acted（真机证不出兜底，fail-closed 不假绿）。
- 取向：自由文本 + 身份门兜底，不建静态枚举校验；registry `nodeName` desc 修到真机实采 21 名当文档指引
  （snapshot 非冻结面，prd-p3-compile 仅 story desc 提及、无 checksum，改动零重签）。
- 定夺：按取向定（随 grill confirm 收口）。

## D9 契约范围

- 分岔：仅 `workflow.addNode` vs `addNode`+`workflow.openNode` 连做。
- 证据：`openNode` 在册（registry:192-208，label 必填、provides 节点抽屉已开）且是纯 click 类动作——
  不需要新动作类；但它依赖画布上已有节点，夹具与真机验证天然骑 `addNode` 产物；本契约已背双冻结重签 +
  例翻涟漪 + 设计条款修订，full 车道已重。
- 取向：仅 `addNode` 收窄本契约——冻结面改动越少越好核；`openNode` 顺延下一契约（direct/light 车道即可，
  骑本契约建成的画布夹具，零冻结改动）。
- 定夺：Steven 已拍板（2026-07-07 点选）——仅 `addNode` 收窄。

## D10 非目标

`workflow.connectNodes`（拓扑取证无口，`window.lf` 挂账 SUT，flywheel-schedule.md:32）；R9 其余 22 条 flow
的编译知识（逐条另契约）；节点配置抽屉族原子（`setNodeField`/`selectNodeOption`/... 需先 `openNode`）；
不动 verdict.mjs/gate.mjs 冻结内核；不建 cases/ 真用例文件（gitignored，真机行程时产）。
