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
6. 节点配置抽屉（wf-open-node）：单击 `.lf-node` 节点体 → 详情页出现/更新 `.hr-drawer__content-wrapper`（内含 `.lf-node-drawer__title` 文本 = 该节点 `.lf-node-content` 标题）——registry 真机 SOP「点中心开抽屉」最小复现。锚点 `.lf-node-anchor-hover` 单击不开（连线专属）；连线拖拽 down/up 目标不同元素 → click 事件落共同祖先 overlay、`closest('.lf-node')` 不中 → 不误开（DOM 规范行为，对既有通路零干扰）。抽屉与列表页建单抽屉同类名但异页，画布页域内唯一（回放身份回读干净）。抽屉反面模式（评审 F3/coverage）：由场景控反面考场（replay 的 nav 走 `pathOf` 剥 query 不能用 URL query，故用场景）——`drawernone` 单击节点不开抽屉（「点了不开」反面）、`drawersuperset` 抽屉标题 = 节点名 + `副本`（含 label 子串但非精确，钉身份回读须精确非子串）、`ghostdup`（实现评审 r1 修复新增，codex/pi 双路 MED#1 合法正面）抽屉正常打开且形态与缺省一致，但可见标题之前先挂一个 `display:none` 的同文案隐藏节点（占 DOM 序更早，真机形态如抽屉头部隐藏提示文本/占位副本）——钉「隐藏同文案在前+可见真标题在后」的合法抽屉不得被误拒（可见性判定须遍历全部命中任一可见即纳入，只查首命中会把合法抽屉整个排出域成 fail-closed 假阴）；既有场景一律缺省行为。
7. 冒牌抽屉跨边界反面场景（drawer-lock-hardening，GRILL D7）：详情页画布外（不在 `.lf-canvas-overlay` 域内）另挂第二个可见 `.hr-drawer__content-wrapper`「冒牌抽屉」，复现挂账描述的「另一可见抽屉」（真机形态如同页测试面板/新增抽屉并存）。冒牌抽屉的字段/触发器与真节点抽屉共用构建函数 `buildNodeSelect`，不做特判；场景行为即挂账接缝复现，不为金牌预定裁定倒着裁。相关场景如下（既有场景一律缺省行为、零影响）：
   - `twinfield`：真节点抽屉 `ddempty` 形态（点开但无字段无下拉，仍显示该节点标题）；冒牌抽屉画布外预挂（页面初次渲染即出现，早于真抽屉）、不含节点标题，挂一个同占位符「请输入接口的URL」字段 + 一个「请选择」触发器（可点、可选、值可回读）。
   - `twinboth`：真节点抽屉（点击后出现）与冒牌抽屉（画布外预挂，先于真抽屉出现）各挂一个同占位符字段 + 各一个「请选择」触发器；冒牌抽屉不含节点标题。
   - `twintitle`：单击节点不开抽屉（`drawernone` 半形态复用）；冒牌抽屉画布外预挂、含节点标题精确文本（固定复用面板项名「模型节点」）。
   - `twinlate`：单击节点开真抽屉（`ddempty` 形态：无字段无下拉，显示该节点标题）；与开抽屉的同一次点击事件处理器内，同刻动态挂出第二个含该节点标题精确可见文本的冒牌抽屉（带同占位符字段 + 「请选择」触发器）——点击前不存在（DOM 序晚于真抽屉，因同一处理器内先建真抽屉后建冒牌），钉「点击后才出现的冒牌」。
   - `twinghost`：单击节点不开抽屉（`drawernone` 半形态复用）；冒牌抽屉画布外预挂、含节点标题精确文本（该文本节点自身 `display:none` 隐藏——wrapper 可见、标题文本不可见），并同 `twinfield` 一样挂一个同占位符字段 + 一个「请选择」触发器（不挂字段/触发器则「宽域锁不问标题只问抽屉可见」在本场景会因压根没有字段而巧合吐缺席，不构成红证；补上后宽域锁会真把这唯一字段/触发器当命中）。
   - `twindelay`（实现评审 r1 修复新增，codex HIGH#1 检查后窗口）：单击节点开真抽屉（`ddempty` 形态：无字段无下拉，显示该节点标题）；点击后延时 3000ms 把第二个含该节点标题精确可见文本的冒牌抽屉（带同占位符字段 + 「请选择」触发器）【前插】到真抽屉之前（`insertBefore`，DOM 序更早）——与 `twinlate`（同刻挂出、DOM 序更晚）互补，专钉「域计数通过之后、click/fill 之前」动态前插的 TOCTOU 窗口：惰性重解析的动态 Locator 会在字段/触发器 5s 可见等待里漂移到冒牌抽屉且不重判三态。延时依据：域计数在点击后约 1s 内发生，3000ms 晚于它、早于 5s 等待超时（时基场景；确定性握手版见 `pinclone`）。
   - `pinclone`（实现评审 r2 修复新增，codex r2 HIGH「pin 属性可被页面复制」）：单击节点开真抽屉（`ddempty` 形态）；页面 `MutationObserver` 监听 `data-casey-domain-pin` 属性——真抽屉一被回放/编译门钉上 pin，观察器回调在同一 JS 任务的微任务里同步新建冒牌抽屉（无标题、带同占位符字段 + 「请选择」触发器）、把 pin 值原样复制上去并【前插】到被钉节点之前。以 stamp 动作本身为相位信号 = 显式阶段握手、零时序依赖。钉「按 pin 属性选择器定根且不验物理同一/全页唯一」的实现：冒牌被纳入 pin 根定位、其唯一字段/触发器被当域内唯一而落笔（假绿）；物理句柄绑定 + pin 全页唯一重验后复制即被识破、拒动（fail-closed）。
   - `fieldmove`（实现评审 r3 前置独立审查 HIGH「动作后物理包含未重验」）：真节点抽屉正常打开并含单字段；字段 `focus` 事件把同一物理 `input` 搬到新建的无标题冒牌抽屉。若实现只在动作前验包含、随后一把 `fill` 并从同句柄回读，会真填域外字段且精确回读成立（假绿）；显式 `focus` 后重验物理包含，离域即拒填，字段仍为空。
   - `triggermove`（实现评审 r3 前置独立审查 HIGH「动作后物理包含未重验」）：真节点抽屉正常打开并含单触发器；触发器既有 `click` 监听先打开 teleport 选项浮层，随后监听把同一物理触发器搬到新建的无标题冒牌抽屉。若实现继续点选项并从同句柄回读，会把域外触发器改值且精确回读成立（假绿）；触发器点击后立即重验物理包含，离域即不点选项，值仍为「请选择」。
   - `pinmove`（实现评审 r4 汇裁 A2 HIGH「pin 挂点未校验」）：真节点抽屉 A（含可见标题）挂两个同占位符字段，其一（field2）包在 A 内部无标题、同类名 `.hr-drawer__content-wrapper` 的嵌套子容器 B 里；页面 `MutationObserver` 监听 `data-casey-domain-pin` 属性——真抽屉一被回放/编译门钉上 pin，同一微任务里摘下 A 的 pin、以同值挂到 B（全页始终恰一，以 stamp 为相位信号=显式阶段握手、零时序依赖）。钉「只验域内唯一者物理同一 + pin 全页恰一」的实现：pin 搬到 B 后域计数仍认 A（B 无标题不入域）、pin 全页仍恰一（在 B 上）→ 两闸皆过，`bound.root` 按 pin 定位到 B、候选域 2→1 洗成 unique 假绿；补挂点闸（唯一 pin 承载者须与被钉物理节点 A 同一）后，承载者 B ≠ A → 拒动（fail-closed）。

分工与边界（沿既有条款）：

- 画布交互纯 DOM 零网络——落节点/连线不发任何请求，进不了 `watchNetworkForensics` 取证；wf-add-node/wf-connect-nodes 的裁定证据走 DOM 断言（`.lf-node-content` 文本可见、`.lf-node`/`.lf-edge` 计数）。
- 拖拽监听 `mousedown` 时才挂 document 级 `mousemove`/`mouseup`、`mouseup` 即卸，重渲不累积监听；`nodeSeq` 跨重渲递增，节点 id 不复用；路由切换重渲后画布清零（`data-node-count` 回 `0`）。
- 类名对齐真机接缝：`.lf-graph` / `.lf-canvas-overlay` / `.lf-node` / `.lf-node-content` / `.node-item` / `.lf-node-anchor-hover` / `.lf-edge`；真机 `.lf-node` 是 SVG `<g>`，假 SUT 用 div 复刻类名 + 文本语义这条接缝，不复刻 SVG 标签结构。

## 后端路由 × 场景（10 态，复现 verdict-cases 全八案）

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

## 取证归因怎么靠假 SUT 落地（命门）

- **本步归因**：`确定`/`保存` 按钮 click 触发 fetch POST → CDP initiator 是用户动作栈 → `watchNetworkForensics` 归本步 `attributedStepId=该步`。
- **背景归因**：`/api/auths/poll` 由页面加载即起的 `setInterval` 发 → CDP initiator 是 timer/异步源 + url 命中 `site.json` denylist → 归 `background`/`attributedStepId:null` → 永不背书（背景 401 进不了 verdict，护栏 #14/#15）。
- 假 SUT 只管发 200/401/500/SSE/抛错；**谁发起的、归哪步，全由 `watchNetworkForensics` 经 CDP 判**——这条分工是让命门 hermetic 可验的支点。

## 边界

- 假 SUT 落 `tests/fixtures/fake-sut/`，是测试脚手架不是实现（不进 `lib`/`bin`/`web`）。
- 零外部依赖、只用 node 内置 `http`；只监听 `127.0.0.1`。
- 不含任何真凭据；`site.json` 的 denylist 形态在此用合成值，绝不引真 `site.json`（护栏 #7）。
