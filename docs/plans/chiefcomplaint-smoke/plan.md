# chiefcomplaint-smoke — 飞轮第二条移植：流式 chat 全命令面（full）

## 背景

飞轮第二条（既定排期 `chat_streaming` 首发）：把 `regress_autotest` 的 `chiefcomplaint_smoke`（登录→智能体管理→搜索打开「互联网问诊-主诉」→开测试面板→发主诉→等 LLM 流式回复→断言无错→关面板）移植到 casey，首次全程吃现成命令面 `compile`→`draft`→人签→`run`——流水线泛化性第一考。决策全表见 `proposed/GRILL.md`（D1–D7，Steven 逐条拍板：reply 系 kind 顺手实现 / 动态流等待 / keydown 触发垫 / textHidden 页面域推荐映射）。

源侧实现知识（已挖全，`regress_autotest`）：五原子选择器与路由（智能体列表 `/agent/list`、详情 `/agent/detail`）、流接口路径段 `/ai-api/tester/agent/stream`、气泡 `.hr-chat__text__assistant`、发送箭头 `.hr-icon.hr-icon-arrow-up`、真机流耗时 1.4–3.9s、`fill()` 不触发 keydown 的按钮 disabled 实测、`nav.agentManagement` 裸 `getByText` 真机挂档（须 `getByRole('list')` 限定）。

## 改动

1. `lib/replay-assert.mjs`（D1）：`IMPLEMENTED_KINDS` 7→10——`replyContains`（contains：replyText 含 value，actual=replyText 截断）、`replyMatches`（matches：RegExp(value).test(replyText)，actual 同）、`textHidden`（absent：textHits[value]===0 才过，actual=命中数）；三者缺上下文一律 `ok:false`/`actual:null`（证不出）。`streamReplyReceived` URL 谓词普化：`streamUrlPattern` 上下文键命中 或 legacy `/streamReply/` 命中（加法兼容）。
2. `bin/replay.mjs`（D2/D5）：
   - 读 `profile.chat` 段（`streamUrlPattern`/`replySelector`，均可缺省）；
   - 动态流等待：动作步归因窗内若 `streamOpen`>0（forensics 计数），等 `awaitStreamsSettled(30000)`；配置了 `replySelector` 时再等气泡 innerText 2s 稳定（上界 10s）；无流步零行为差；
   - 代表步静默点采 `replyText`（`replySelector` last innerText）入评估上下文；`textHits` 采集循环扩到 `textHidden` 断言值；上下文加 `replyText`/`streamUrlPattern` 两键；
   - 看门狗 75s→120s（同 `compile` 先例）；
   - 回放历史（上一契约产物）自然覆盖：流等待计入该步 `durationMs` 与 `quietPointWaitMs`。
3. `lib/replay-forensics.mjs`：暴露 `openStreams()` 计数（加法，供 2 的动态探测）。
4. `lib/compile-atoms.mjs`（D6）：五原子编译知识——`nav.agentManagement`（list 限定点击 + 搜索框可见后置）、`agent.searchOpen`（fill+Enter+点 openName+「测试」按钮后置）、`agent.openTestPanel`（点「测试」+消息框探针，不搬「重点自愈」）、`chat.sendAndWait`（keydown 垫三 event：fill+Space+Backspace，点发送箭头，流等待+气泡稳定，采 replyText/replyStreamUrl 回填 observed 原 null 字段）、`chat.closeTestPanel`（抽屉关闭 fallbackCss）。`assert.*` 折进所在 intent（既有法）。
5. `bin/compile.mjs`（D6 修正）：核实 `routes.workflowList` 本就可选（present 才形状校验）——无需放宽，零改；`profile.chat` 段 compile 不消费、只 replay 读，同样零改。
6. 新假 SUT 夹具 `tests/fixtures/chat-sut/server.mjs`（fork 模式，复刻 login-sut 进程教训）：`/agent/list` 假列表（侧栏 list「智能体管理」+搜索框+结果项）→ `/agent/detail` 假详情（「测试」按钮→抽屉：消息框 placeholder 请输入消息 + 发送箭头 keydown 前 disabled + SSE 端点分片吐固定回复 + 气泡 `.hr-chat__text__assistant` 渐进渲染 + 关闭钮）。錨定 D3 垫、流等待、reply 采集三机制的可红先行考场。
7. 新 golden `tests/_golden/chiefcomplaint-smoke.golden.mjs`（红先行）：
   - U 单元向：三 kind 正/反/证不出三向（evaluateAssertions 直调）+ `IMPLEMENTED_KINDS` 计数与成员 + 流谓词普化两向（profile 模式命中 / legacy 兼容）；
   - I 集成向（chat-sut）：keydown 垫后按钮真 enable 且发送成功 / 流等待真置 `streamFinished`（600ms 因果窗必不够、必须等到）/ `replyText` 采到且 `replyContains` 真过真败 / `textHidden` 命中真败未命中真过 / 无 chat 配置回放零行为差（catalog 型事件流原样）；
   - W 接线向：`casey run` 对 chat-sut 端到端绿 + 报告产出 + 回放历史流步 `durationMs` 覆盖流等待。
8. 涟漪补冻（D7）：`kinds-harden.golden` U1 的 `size===7` 重钉（改「含 7 种既有 + 新三种、不含 `buttonState`/`switchState`」），其 prd 补冻；accept 期全量跑既有 golden 逐个核涟漪。
9. 真机件（`cases/tc_chiefcomplaint_smoke/`，gitignored）：手写规范 TestCase（intents 五段：nav/open/panel/send/close）、flow 草稿（LLM=CLI 外产）、profile（chat 段 + background 实采后定）——route:human 流程：闸段→Steven confirm→`--execute` 真机→`casey draft`→Steven 人签→`casey run`。

## 非目标

`echo_default_on`/`agent_tool_e2e`（飞轮后续条目）；SSE body 网络层捕获（D5 钉死 DOM 通道）；改冻结 events 枚举（D3 垫绕开；垫真机验不过再开新契约升级）；`assert.bubble` 的 mustInclude 正向映射进本用例签署集（真机 LLM 输出非确定，正向断言人签时酌情）；报告消费侧呈现 replyText（P7 后续）；`ingest` 命令化（相0 仍手写 TestCase，P2 learn 挂账不变）。

## 验收

新 golden 全绿（实现前红：三 kind 走 default 分支、chat-sut 集成流等待未建必红）；`kinds-harden.golden` 重钉后绿 + 其 prd 补冻 gate 复验；回归锁 `p5-replay`/`p5-replay-coverage`/`layer3-wiring`/`run-history` + `selftest --tier1` 原样绿；gate GREEN。真机 route:human 四停站（confirm/execute 过目/人签/报告过目）挂 observability，人不在场只挂账绝不代签。
