# GRILL — chiefcomplaint-smoke（full，实质 grill，2026-07-03 Steven 逐条拍板）

授权：NEXT-SESSION「下一步 B」+ Steven 顺序拍板「a 然后 b 然后 c」+ 车道拍板「升 full 走全链」。飞轮第二条移植：流式 chat 用例首次全程吃现成命令面（compile→draft→人签→run），泛化性第一考。源材料：`regress_autotest` 的 `chiefcomplaint_smoke.flow.json` 十步 + `_atoms.ts` 实现知识（后台侦察已挖全，选择器/路由/流参数见 plan）。

## D1 断言 kind 范围（Steven 拍板：顺手实现 reply 系）

`IMPLEMENTED_KINDS` 7→10：`replyContains`（contains）、`replyMatches`（matches）、`textHidden`（absent）。词表与 `expected-frozen` 双 enum 已冻含全部 15 种——零改（G-seam 复核过）。`streamReplyReceived` 已实现但 URL 谓词写死 `/streamReply/`（真机流接口是 `/ai-api/tester/agent/stream`）：普化为「`profile.chat.streamUrlPattern` 命中 或 legacy `/streamReply/` 命中」——加法兼容，p5 冻结 golden 原样绿背书。

## D2 回放流等待（Steven 拍板：动态探测）

- 本步动作作用域内若开了 EventSource（`replay-forensics` 的 `streamOpen` 计数已有），该步静默点延长为「流 finished 或有界超时 30s」+ 回复气泡 2s 稳定；无流用例零行为差（catalog 回归锁背书）。
- 归因窗随延：流是本步动作的直接后果，归本步正当（既有 save→SSE 因果窗先例，非任意时间窗，护栏 #15 论证不变）。
- 看门狗 75s→120s（同 `compile` 先例）；`fail-safe` 语义不变（超时仍强退非零）。
- 真机流耗时证据：1.4–3.9s（regress 报告 annotation），30s 上界余量充分。

## D3 chat 输入触发（Steven 拍板：keydown 触发垫）

regress 实测 `fill()` 不触发 keydown、发送按钮保持 disabled，必须逐字符敲键；但已冻 events 枚举（七种，`additionalProperties:false`）无 pressSequentially。编译知识产三 event：`fill(全文)` + `press(Space)` + `press(Backspace)`——value 已在、keydown 已发、终文本不变，全在冻结枚举内、确定性可复放。编译期真机验证按钮真 enable；验不过回头升级方案（改冻结枚举加 action，涉 schema 重签 + 下游姊妹接缝连锁，本轮不做）。

## D4 负向断言映射（Steven 拍板：textHidden 页面域，终抉在人签）

源 flow `assert.bubble mustNotInclude:[操作失败]` 推荐映射 `textHidden(操作失败, absent)`：代表步静默点全视图命中数为 0 才过——气泡属页面文本，覆盖面更宽（气泡+toast+正文），复用 `textHits` 采集通道。`replyMatches` 负向环视作备选（严格气泡域但可读性差）。终抉在 Steven 人签 expected 时。

## D5 reply 正文采集口径（双侧同构）

- 通道 = DOM 气泡：`replySelector`（缺省 `.hr-chat__text__assistant`）取 `.last()` 的 innerText；SSE body 不捕获（`getResponseBody` 对流式可能永不 resolve、拖死 drain——既有注释红线；「流式 = 一条网络记录 + 一个断言」判断不变，回复内容走 DOM）。
- `replySelector`/`streamUrlPattern` 进通道剖面 `profile.chat` 段（非凭据：类名+路径段；同 profile 既有定位）。
- 编译侧：chat 步执行后采 replyText + replyStreamUrl（路径段剥 host/query）回填 observed（schema 字段已在、原恒 null）。
- 回放侧：代表步静默点采 replyText 入评估上下文（新键，同 `toastTexts`/`textHits` 范式）；`textHits` 采集循环扩到 `textHidden` 断言值（原只采 `textVisible`）。

## D6 编译知识五原子 + 输入面放宽

- 授编译知识：`nav.agentManagement`（用 `getByRole('list')` 限定修正版——regress 裸 `getByText` 真机挂过，面包屑同名 strict 撞）、`agent.searchOpen`（搜索框 role=textbox 定名 + fill + press Enter + 点 openName）、`agent.openTestPanel`（「测试」按钮 + 消息框探针；regress 的「点空重点一次」自愈不搬——回放器守卫不抛、点击身份门管）、`chat.sendAndWait`（D3 垫 + 发送箭头 fallbackCss `.hr-icon.hr-icon-arrow-up`）、`chat.closeTestPanel`（抽屉关闭链 fallbackCss）。`evidence.capture`/`final` 不移植（casey 证据链内建；final 返回列表非必需意图）。
- `bin/compile.mjs` routes 校验放宽：`workflowList` 不再必填，改「routes 所有值须 `/` 开头」（加法兼容 catalog）。
- TestCase：`tc_chiefcomplaint_smoke`，chat 无破坏性原子（不建实体），`uniquePrefix` 按硬闸要求仍非空占位。

## D7 冻结涟漪盘点（accept 红先行逐核）

- `kinds-harden.golden` U1 钉死 `IMPLEMENTED_KINDS.size===7`——7→10 必翻红，补冻涟漪（D2 生命周期既定，同先例换钉法：断言「≥7 且含 textVisible/noErrorToast、不含 buttonState」或按新集合重钉）。
- 其余冻结 golden 以 `buttonState`/`switchState` 作未实现范例（kinds-harden 轮已换）——`textHidden`/`replyContains`/`replyMatches` 若仍被哪份 golden 当未实现范例引用，accept 期跑出来逐个补冻。
- p5 两份冻结 golden：流谓词 legacy 兼容 + 无流零行为差 → 原样绿。
- 术语：零新造词（流 finished 属「静默点」既有定义实例；「回放历史」等均已登记）。
