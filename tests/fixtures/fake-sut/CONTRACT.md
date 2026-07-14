# 假 SUT（fixture server）路由脚本契约

> P5 hermetic 回放的假被测系统。**不是** autotester `web/server.mjs` 那种控制台外壳——那是 spawn CLI 的壳；本件是被 playwright 回放驱动的假 SUT。
> 事实源：已冻 `tests/_golden/fixtures/seams/events.fixture.json`（回放靶子的 DOM/路由）、`observed-reality.fixture.json`（取证归因形态）、`tests/_golden/fixtures/p2/verdict-cases.json`（8 态对应的 StepAxes 信号）。

## 实例化模型（避免共享态竞争）

每条 golden 起一个**自带固定场景**的实例：`startFakeSut({ scenario, port: 0 })` → `{ url, port, close() }`，监听 `127.0.0.1` 临时端口。场景在建实例时定死、回放期不变，故并行/串行都无共享态。

## 假 SUT 的 DOM（对齐 events.fixture）

单页应用，客户端按 `location.pathname` 渲染：

- `/ai-manager/process/list`：`新增工作流` 按钮（`<button>` role=button、class `hr-button create-wf`）+ 工作流列表表格（countChange 的计数源）。
- 点 `新增工作流` → 开抽屉 `.hr-drawer__content-wrapper`（drw=1）：`工作流名称` 输入框（`<input>` role=textbox、关联 `<label>`、placeholder `请输入工作流名称`、required）+ `分类` 自绘下拉（`.hr-select`，选项 `测试分类/业务分类/其它`，浮层 `.hr-select__list`）+ `确定` 按钮（`.hr-drawer__footer .hr-button--primary`）。
- 点 `确定` → POST `/api/process/saveOrModifyProcessData` → 成功则跳 `/ai-manager/process/detail` + 弹 toast `新增成功`。
- `/ai-manager/process/detail`：`保存` 按钮（`hr-button wf-save`）→ 点击发 POST `/api/process/saveOrModifyProcessData`。

## 画布通路（`/ai-manager/process/detail` 尾部加法，全场景渲染；wf-add-node）

> 事实源：真机二号探针实采（2026-07-07，LogicFlow 画布：`添加节点` 钮开面板、`.node-item` 21 项、mouse 三段式拖落 `.lf-node`、单击/双击不落）。

详情页尾部固定渲染假画布（LogicFlow 形态）：`添加节点` 按钮（`<button>` role=button name=`添加节点`、class `lf-add-node-btn`）+ 画布容器 `.lf-graph`（带 `data-node-count`，内含铺满的 `.lf-canvas-overlay`）。既有场景（含 `ambiguous` 双保存钮、`drift` 换 class）无人碰画布 → 零行为差（先例：wf-open-smoke 的可点行名）。`pageerror` 在渲染画布前已抛，不受影响。

六条行为契约：

1. 按钮开面板：点 `添加节点` → 出现 `.node-panel`，内 `.node-item` 恰 21 项；前 4 名为真机实采名（`开始节点`/`结束节点`/`脚本转换`/`模型节点`）+ 第 5 项 `真并行网关开始`（wf-connect-nodes 用其双节点行为），余 16 为合成名凑真机项数（绝不引真机全清单，合成值即可，护栏 #7 同理）。再点收起（toggle）。
2. 拖落节点：mouse 三段式——`mousedown` 在 `.node-item` 上、`mousemove` 位移 ≥ 12px（曼哈顿距离阈值）、`mouseup` 落点在 `.lf-graph` 界内 → `.lf-canvas-overlay` 内新增一个 `.lf-node`（id `lf_node_<seq>`，落点定位），其 `.lf-node-content` 文本 = 面板项节点名。例外：`真并行网关开始` 一次拖拽落两节点（`真并行网关开始` + `真并行网关结束`，`.lf-node` +2，对齐 addNode `expectedNodeDelta=2` 的真机实采）。
3. 点击不落（否定行为，金牌反证用）：单击/双击 `.node-item` 不产生 `.lf-node`；微动（位移 < 12px）或落点出画布界同样不落。机制：位移阈值 + 落点界内双守卫，二者缺一不落。
4. 计数一致：`.lf-node` 的 DOM 实数 = 成功拖落次数（真并行网关开始按 +2）；`.lf-graph[data-node-count]` 每次落节点后按 DOM 实数刷新（golden 双向可数：locator count 与属性值互证）。
5. 连线（wf-connect-nodes）：每个 `.lf-node` 渲 `.lf-node-anchor-hover` 锚点；`mousedown` 锚点 → `mouseup` 落在另一个 `.lf-node`（非自身）→ `.lf-canvas-overlay` 内新增一个 `.lf-edge`。自连（源=目标）或落点非节点 → 不落边（否定行为，连线 fail-closed 反证）。纯 DOM 只断边数增，不携 source/target（连对哪两个的确定性取证挂账真机 window.lf）。
6. 节点配置抽屉（wf-open-node）：单击 `.lf-node` 节点体 → 详情页出现/更新 `.hr-drawer__content-wrapper`（内含 `.lf-node-drawer__title` 文本 = 该节点 `.lf-node-content` 标题）——registry 真机 SOP「点中心开抽屉」最小复现。锚点 `.lf-node-anchor-hover` 单击不开（连线专属）；连线拖拽 down/up 目标不同元素 → click 事件落共同祖先 overlay、`closest('.lf-node')` 不中 → 不误开（DOM 规范行为，对既有通路零干扰）。抽屉与列表页建单抽屉同类名但异页，画布页域内唯一（回放身份回读干净）。抽屉反面模式（评审 F3/coverage）：由场景控反面考场（replay 的 nav 走 `pathOf` 剥 query 不能用 URL query，故用场景）——`drawernone` 单击节点不开抽屉（「点了不开」反面）、`drawersuperset` 抽屉标题 = 节点名 + `副本`（含 label 子串但非精确，钉身份回读须精确非子串）；既有场景一律缺省行为。

分工与边界（沿既有条款）：

- 画布交互纯 DOM 零网络——落节点/连线不发任何请求，进不了 `watchNetworkForensics` 取证；wf-add-node/wf-connect-nodes 的裁定证据走 DOM 断言（`.lf-node-content` 文本可见、`.lf-node`/`.lf-edge` 计数）。
- 拖拽监听 `mousedown` 时才挂 document 级 `mousemove`/`mouseup`、`mouseup` 即卸，重渲不累积监听；`nodeSeq` 跨重渲递增，节点 id 不复用；路由切换重渲后画布清零（`data-node-count` 回 `0`）。
- 类名对齐真机接缝：`.lf-graph` / `.lf-canvas-overlay` / `.lf-node` / `.lf-node-content` / `.node-item` / `.lf-node-anchor-hover` / `.lf-edge`；真机 `.lf-node` 是 SVG `<g>`，假 SUT 用 div 复刻类名 + 文本语义这条接缝，不复刻 SVG 标签结构。

## 后端路由 × 场景（前 10 态复现 verdict-cases 全八案；`mountdelay`/`churn` 是回放静默点/走时上界考场，不入八案）

> save 信封一律 `status` 形态：成功 `{status:200}`、软失败 HTTP 200 但 `body.status≠200`（`通道剖面` successField=`status`/successValue=200，复现 ADR-0006/observed-reality 的 Heren 接缝，绝不用旧 `{code}`）。

| 场景 | save POST | 背景 `/api/auths/poll`（客户端 setInterval 发） | 流式/生命周期 | 目标 verdict（八案）|
|---|---|---|---|---|
| `happy` | 200 `{status:200}` | 200 | — | PASS |
| `inject500` | 500 `{status:500}` | 200 | — | SUT_DEFECT（5xx 归本步背书）|
| `envelope200bad` | 200 `{status:50001}`（HTTP 200 软失败信封）| 200 | — | SUT_DEFECT（错误信封 ok:false 归本步，第二条背书路）|
| `background401` | 200 `{status:200}` | 401 `{status:401}`（timer 发→initiator=background→attributedStepId:null 不归本步）| — | PASS（背景 401 不翻）|
| `stale_bg401` | 200 `{status:200}`（干净）| 401 `{status:401}`（背景归 null）| 客户端 save 成功却不导航（停 /list）→ urlPathname 硬断言失配 | NEEDS_HUMAN(SUT_DEFECT_OR_STALE)；错把 401 归本步则翻 SUT_DEFECT、被 golden 抓 |
| `stream` | 200 `{status:200}` | 200 | SSE `/api/llm/streamReply` 推 N 块后 `finished` | PASS（streamReplyReceived）|
| `pageerror` | 200 `{status:200}` | 200 | 客户端 JS 抛 → lifecycle.pageerror 归本步 | route:human（取证里有，按本步归因）|
| `drift` | 200 `{status:200}` | 200 | 列表只渲目标行 atl_wf_5fa1，脆性 css `.hr-table-row:nth-child(2) .hr-action-delete` 命中空，role=button name=删除 withinRow=atl_wf_5fa1 唯一仍在(count=1) | HARNESS_ERROR |
| `vanished` | 200 `{status:200}` | 200 | drift 的反面：列表只渲非目标行 atl_目录CRUD_a，脆性 css 同样失配，但目标稳定签名 withinRow=atl_wf_5fa1 已不在(count=0) | NEEDS_HUMAN(INDETERMINATE)；堵漂移信号硬编码成 present:true |
| `ambiguous` | 200 `{status:200}` | 200 | 渲染两个同名 `保存` 按钮→resolution=fallback_first | NEEDS_HUMAN(AMBIGUOUS_ACTION) |
| `mountdelay` | 200 `{status:200}` | 200 | 详情页先渲静态占位 `页面加载中` → `fetch /api/process/editorData`（服务端延迟可配 `mountDelayMs` 缺省 800）→ 应答后替换挂载编辑器（保存钮 + 画布）；`新增成功` toast 3000ms 自动消隐 | 回放代表步静默点考场（占位期在途请求撑住复合判据 A，纯两拍判据反例）|
| `churn` | 200 `{status:200}` | 200 | 编辑器即时挂载后 DOM 每 100ms 追加变长 + 背景轮询 300ms（denylist 内）；两拍稳定永不达成、在途 API 归零 | 走时上界考场（判据 A 归零故 `networkidle` 兜底条件化跳过，最坏走时压回约 2.75s）|

## 取证归因怎么靠假 SUT 落地（命门）

- **本步归因**：`确定`/`保存` 按钮 click 触发 fetch POST → CDP initiator 是用户动作栈 → `watchNetworkForensics` 归本步 `attributedStepId=该步`。
- **背景归因**：`/api/auths/poll` 由页面加载即起的 `setInterval` 发 → CDP initiator 是 timer/异步源 + url 命中 `site.json` denylist → 归 `background`/`attributedStepId:null` → 永不背书（背景 401 进不了 verdict，护栏 #14/#15）。
- 假 SUT 只管发 200/401/500/SSE/抛错；**谁发起的、归哪步，全由 `watchNetworkForensics` 经 CDP 判**——这条分工是让命门 hermetic 可验的支点。

## 边界

- 假 SUT 落 `tests/fixtures/fake-sut/`，是测试脚手架不是实现（不进 `lib`/`bin`/`web`）。
- 零外部依赖、只用 node 内置 `http`；只监听 `127.0.0.1`。
- 不含任何真凭据；`site.json` 的 denylist 形态在此用合成值，绝不引真 `site.json`（护栏 #7）。
