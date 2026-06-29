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

## 后端路由 × 场景（8 态）

| 场景 | save POST | 背景 `/api/auths/poll`（客户端 setInterval 发） | 流式/生命周期 | 目标 verdict |
|---|---|---|---|---|
| `happy` | 200 `{code:0}` | 200 | — | PASS |
| `inject500` | 500 `{code:1,message}` | 200 | — | SUT_DEFECT（5xx 归本步背书）|
| `envelope200bad` | 200 `{code:1}`（HTTP 200 软失败信封）| 200 | — | SUT_DEFECT（错误信封归本步）|
| `background401` | 200 `{code:0}` | **401**（timer 发→initiator=background→不归本步）| — | PASS（背景 401 不翻）|
| `stream` | 200 `{code:0}` | 200 | SSE `/api/llm/streamReply` 推 N 块后 `finished` | PASS（streamReplyReceived）|
| `pageerror` | 200 `{code:0}` | 200 | 客户端 JS 抛 → lifecycle.pageerror 归本步 | route:human（取证里有，按本步归因）|
| `drift` | 200 `{code:0}` | 200 | 复刻 drift-patch.fixture：列表只渲 atl_wf_5fa1 在首位，录制脆性 css `.hr-table-row:nth-child(2) .hr-action-delete` 命中空，而 role=button name=删除 withinRow=atl_wf_5fa1 唯一仍在 | HARNESS_ERROR |
| `ambiguous` | 200 `{code:0}` | 200 | 渲染两个同名 `保存` 按钮→resolution=fallback_first | NEEDS_HUMAN(AMBIGUOUS_ACTION) |

## 取证归因怎么靠假 SUT 落地（命门）

- **本步归因**：`确定`/`保存` 按钮 click 触发 fetch POST → CDP initiator 是用户动作栈 → `watchNetworkForensics` 归本步 `attributedStepId=该步`。
- **背景归因**：`/api/auths/poll` 由页面加载即起的 `setInterval` 发 → CDP initiator 是 timer/异步源 + url 命中 `site.json` denylist → 归 `background`/`attributedStepId:null` → 永不背书（背景 401 进不了 verdict，护栏 #14/#15）。
- 假 SUT 只管发 200/401/500/SSE/抛错；**谁发起的、归哪步，全由 `watchNetworkForensics` 经 CDP 判**——这条分工是让命门 hermetic 可验的支点。

## 边界

- 假 SUT 落 `tests/fixtures/fake-sut/`，是测试脚手架不是实现（不进 `lib`/`bin`/`web`）。
- 零外部依赖、只用 node 内置 `http`；只监听 `127.0.0.1`。
- 不含任何真凭据；`site.json` 的 denylist 形态在此用合成值，绝不引真 `site.json`（护栏 #7）。
