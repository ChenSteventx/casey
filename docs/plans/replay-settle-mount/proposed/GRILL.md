# GRILL — replay-settle-mount（full，2026-07-14）

授权：Steven 2026-07-14 主会话点「修」，真机证据在案——`tc_wf_publish_states` 的 `intent_1`（创建工作流后断言 `buttonState` present 发布/保存）判 `NEEDS_HUMAN`（`SUT_DEFECT_OR_STALE`）、`actual=0`，而 1.5 秒后 `atstep_8` 成功唯一点中「发布」按钮——按钮一直在，是回放侧代表步采集抢在 SPA（单页应用）编辑器挂载完成之前。修法方向与小固定下限（200-300ms 区间）均已主会话拍板；本 GRILL 落决策台账 + 规划者机械决策（可否决）。

## 根因（主会话勘定，编译回放两侧不对称）

- 编译侧 `lib/compile-atoms.mjs`：每步动作后走 `quietPoint`（:203-214，DOM 连续两拍稳定、预算 2500ms、120ms 一拍）才 `capture` 采观测；个别原子另有 `networkidle` 5s 有界前置（:725，catch 兜底）。编译期「发布/保存在场」正是在这个静默点之后被采到并人签的。
- 回放侧 `bin/replay.mjs`：click 动作的静默窗只有 `waitForResponse` 600ms（:436）+ 固定 150ms（:444）+ 对话流才有的流等待（:452-460）；代表步（`isLast`，:466-549）随即采 `intentUrl`/`intentCount`/toast/`textHits`/`buttonHits`/`buttonSeen`/reply。创建工作流点「确认」是 SPA 路由跳转 + 「页面加载中」异步挂载编辑器（>1s），约 750ms 窗口早结束 → 挂载完成前采 `buttonState` → 数 0 → 计时假阴。
- 裁定与断言评估都没错：`bin/verdict.mjs` 与 `lib/replay-assert.mjs` 拿到的就是「采集时刻的事实」，错在采集时机。

## D1 修法方向（已拍板，勿改大方向）

回放侧在代表步采集断言输入之前，补一个有界静默点，镜像编译侧 `quietPoint`。铁不变量：

1. 静默点纯观察者、有界（预算上界；SPA 背景轮询下 `networkidle` 可能永不达成——照编译侧 catch 兜底，绝不无限等）；
2. 绝不改归因窗/取证因果作用域语义（`attributedStepId` 逻辑零动；静默点跑在归因已关之后，`currentStepId` 此刻为 null）、绝不把背景轮询拖进本步；
3. `bin/verdict.mjs` 字节不动；`lib/replay-assert.mjs` 判定逻辑不动（只让采集时机对）；
4. 缺失/超时 fail-safe：静默点超预算就按现状采（不因静默点本身报错吞步），且至少给到编译期同等的稳定预算（条件预算 ≥2500ms，对齐 `quietPoint`）。

## D2 小固定下限（Steven 2026-07-14 批准并入；具体值由 plan 定）

条件轮询开始前垫一个小的固定下限，给 SPA 路由切换的首帧渲染一点起步窗，避免条件判据在动作刚落一拍就抢采旧 DOM 的假稳定。定位明确：这是条件式静默点的前置固定下限，不是每步一律睡几秒；其后仍由条件（在途请求归零 + DOM 两拍稳定）决定何时放行；固定下限绝不承担「等到按钮出现」的职责（那是条件的活）。金牌须钉两向：即时渲染场景不显著拖慢（回归锁）；延迟挂载场景靠条件而非靠垫等到（垫调 0 仍须条件兜住、不得靠加大固定值凑绿）。取值见 M1：250ms。

## D3 静默判据构成（规划者定，Steven 可否决）

为什么纯「DOM 连续两拍稳定」不够：真机形态是「页面加载中」静态占位先渲、编辑器后挂——占位期 DOM 静止不变，两拍判据会在占位上早退报「稳定」，采集仍抢在挂载前（垫调 0 时金牌必红，D2 的金牌要求逼出这一步）。故复合判据为：

- 判据 A（新增，纯观察）：前台在途 API 归零——复用 `watchNetworkForensics` 已有的 `inFlightApi` 集合（`lib/replay-forensics.mjs` :16/:27：只收 XHR/Fetch，denylist 背景轮询天然除外）。真机编辑器挂载由详情数据请求驱动，「页面加载中」正是这类请求的等待态；请求在途 = 还没到静默点。背景轮询在 denylist 内，绝不把本步拖死。
- 判据 B（镜像编译侧）：DOM 连续两拍稳定（`document.body.innerHTML.length` 两拍相等、120ms 一拍，逐字镜像 `quietPoint` 判据）。
- 复合流程：固定下限（M1）先垫 → 轮询循环内每拍同测 A+B，连续两拍 B 相等且两拍 A 归零即放行；预算 2500ms（对齐编译侧）耗尽 → `networkidle` 有界兜底一次（2000ms、catch 吞超时，编译侧 :725 先例；带背景轮询的 SUT 到不了就超时放行）→ 按现状采。
- 反方向铁则：判据绝不读 expected——静默点不知道要断什么按钮，只看「页面自己说还没稳」（在途请求 / DOM 还在变）。「等到断言为真」那种期望驱动轮询是倒着裁，金牌 I4 钉死此界。

残余（记 observability，真机复验停站观察）：script/chunk 类型的延迟挂载（JS 分包加载）不进 `inFlightApi`（只收 XHR/Fetch），而 `networkidle` 兜底对带背景轮询的真机不可达——此形态若真机出现，按 fail-safe 落 `NEEDS_HUMAN`（假阴方向，绝非假绿），届时再议加法（如加载占位词表判，需人签词表；本轮不做——在途请求判据已覆盖已知真机形态）。

## 机械决策（可否决，未否决即生效）

- M1 固定下限 250ms：Steven 批准区间 200-300 的中点；编译侧 click 后 150ms 出现窗 + `quietPoint` 首拍 120ms 的等效起点约 270ms，回放取 250 近似对称；兼顾低配 WSL/DrvFs 环境首帧余量。稳定页每代表步总开销约 0.5s（250 垫 + 两拍约 240），回归锁金牌钉上界。
- M2 插入点：`bin/replay.mjs` `isLast` 块首（:466），先于该块全部采集（`intentUrl`/`intentCount.after`/toast/`textHits`/`buttonHits`/`buttonSeen`/reply）——断言输入仍是同一静默点后同一时刻的快照（同刻性保留，`buttonSeen` 活性反证的同刻语义不破）。只代表步走静默点，非代表步零新等待（动作因果作用域 600+150ms 语义零动）；代表步不分动作类型（nav 代表步同样走，`goto` 已 `waitUntil: load`，稳定页开销可忽略）。
- M3 实现落 `lib/replay-settle.mjs`（新文件，纯函数：吃 page 型对象 + 在途计数函数 + 下限/预算，回 `{ settled, waitedMs }`）——单元金牌用桩验预算/下限/fail-safe，不开浏览器；`bin/replay.mjs` 接线传 `() => forensics.inFlightCount()`。`lib/replay-forensics.mjs` 返回对象加性暴露 `inFlightCount()`（既有键零动，无金牌钉其键集）。
- M4 测试缝两枚环境变量（`REPLAY_WATCHDOG_MS` 先例，缺省值一字不变）：`REPLAY_SETTLE_FLOOR_MS`（缺省 250；金牌调 0 证「条件兜住不靠垫」）、`REPLAY_SETTLE_BUDGET_MS`（缺省 2500；金牌调小证「超预算照采不吞步」）。
- M5 夹具场景 `mountdelay`（fake-sut 加法）：`/ai-manager/process/detail` 先渲静态占位「页面加载中」→ 发 `fetch('/api/process/editorData')`（服务端延迟 800ms 应答）→ 应答后替换渲染编辑器（保存按钮 + 画布）。复现真机接缝（数据请求驱动挂载 + 静态占位），不是顺着判据裁夹具——静态占位正是纯两拍判据的反例考场。既有场景一律同步渲染零行为差（`wf-open-smoke` 可点行名加法先例）。
- M6 观测记账：静默等待计入 `rhQuietWait`（回放历史诚实记账，不进裁定，护栏 #15 不变）；`REPLAY_DEBUG` 下输出 settle 日志行（waited/settled），金牌解析用。axes/observed schema 零新键（`additionalProperties:false` 冻结面不动）。
- M7 金牌 `tests/_golden/replay-settle-mount.golden.mjs`（红先行清单见 plan）；chromium hermetic，全程 fake-sut，绝不驱真机。
- M8 重签清单：动 `tests/fixtures/fake-sut/server.mjs`（+ 同目录 `CONTRACT.md` 场景表）→ `prd-p5-replay`（冻两件）与 `prd-replay-nth-visible-hardening`（冻 `server.mjs`）sha256 重签 + 各自 gate 复验 GREEN（wf-publish-states 重签 `prd-seams-freeze` 先例）。
- M9 术语零新造：「静默点」「代表步」「通道剖面」CONTEXT.md 已注册；「固定下限」「在途请求」是描述短语非新术语；`mountdelay` 是夹具场景代码标识符。

## 残余风险与挂账

- 真机 toast 自动消隐 vs 采样延后约 0.5s：toast 通道断言理论上更接近消隐窗——失败方向是假红（`NEEDS_HUMAN`）非假绿；hermetic 夹具 toast 不消隐零影响；真机复验停站观察，频发再议（如 toast 移静默点前后双采快照的加法）。
- 全量金牌走时上浮：每代表步约 +0.5s（稳定页），全仓 ratchet 预计上浮数十秒——gate 后台跑轮询收（既有纪律）。
- script/chunk 型延迟挂载盲区：见 D3 残余。

## 冻结涟漪盘点（accept 红先行逐核）

- `tests/fixtures/fake-sut/server.mjs`：+`mountdelay`（`SCENARIOS` 集 + 客户端 `renderDetail` 分支 + 后端 `/api/process/editorData` 路由）+`churn`（评审修订）——冻它的 `prd-p5-replay`、`prd-replay-nth-visible-hardening` 重签。
- `tests/fixtures/fake-sut/CONTRACT.md`：场景表 +1 行——`prd-p5-replay` 冻它，随上重签。
- 消费 fake-sut 的其余金牌（wf-open-node 族、wf-add-node、wf-connect-nodes、wf-open-smoke、kinds-harden、layer3-wiring、run-history、replay-video 等）不冻 `server.mjs`，无需重签；loop 期全量回归证零行为差。
- `bin/replay.mjs`、`lib/replay-forensics.mjs`、新 `lib/replay-settle.mjs` 均为实现文件，无 prd 冻结。
- axes/observed/expected schema 零动（M6）；`lib/replay-assert.mjs`、`bin/verdict.mjs` 零字节动（D1 铁不变量）。

## 设计评审修订（codex-sol@max，2026-07-14；8 findings 裁处，plan.md 已同步）

- 拍级硬上界（HIGH 采信，修 D1/M3 落法）：单拍 `page.evaluate` 套 500ms 有界竞速（`lib/replay-forensics.mjs` :8 `withTimeout` 先例）——`evaluate` 永不返回时该拍按不稳定计、预算循环照常复查；`inFlight()` 调用套 try/catch，抛错则判据 A 降级、退化纯判据 B（编译侧同构）；入参非有限非负数回缺省。金牌 +U5（永不返回）/+U6（`inFlight` 抛错）钉死。
- I5 整案重设计（HIGH 采信）：原设计缺省 800ms 挂载延迟在 `networkidle` 兜底窗内必完成、`actual` 必 ≥1，证不出「超预算照现状采」——夹具挂载延迟改可配（`mountDelayMs`，缺省 800），I5 用 6000ms 拉开采集时刻（约 2.6s）与挂载（6s）的差距。
- 兜底条件化（MED 采信，修 D3 复合流程）：预算耗尽时仅判据 A 仍非零才走 `networkidle` 有界兜底（职责=网络尾巴）；判据 A 已归零的 DOM 扰动形态直接放行——`networkidle` 不识 Casey denylist、背景轮询下必烧满 2000ms 且无增益，条件化把扰动最坏走时从约 4.75s 压回约 2.75s。金牌 +I6（`churn` 场景走时上界回归锁）。
- D3 残余追加两条（MED 部分采信，落账不改判据）：①「响应结束→UI 延迟提交」形态——判据 A 在 `loadingFinished` 即归零（`lib/replay-forensics.mjs` :56），提交延迟超过稳定对约两拍缓冲（约 240ms，「稳定对不跨零点」规则给足，金牌 +U7 钉）则在占位上放行；失败方向假红（`NEEDS_HUMAN`）绝非假绿，已确证真机形态（应答即提交）I1 已覆盖，判据侧扩展会假定「应答必改 DOM」恶化最坏走时，词表判照旧挂账。②`innerHTML.length` 等长内容变化误判稳定——镜像编译侧同判据保持对称，失败方向同上。
- 记账口径（MED 采信，修 M6）：代表步 `historyLine` 的 `quietPointReached` 接线 settle 结果（`navOk && settled`），超时如实记 `false`（schema「false=证据可复现性存疑」口径一致）；非代表步维持既有口径；schema 文件字节不动（`prd-seams-freeze-v2` 冻结面不碰）。
- M9 更正（MED 采信）：「静默点」词条现文限定编译期、判据描述与回放侧新机制不一致——扩写为跨阶段通用定义 + 各期判据变体，`CONTEXT.md` 入 touchesFiles（无 prd 冻结、零新增重签）。
- toast 消隐窗（MED 采信，收窄验收措辞）：`mountdelay` 场景 toast 3000ms 自动消隐 + I1 加 `textVisible`「新增成功」典型窗回归锁（延采约 1s 不丢典型 toast）；验收「回归零行为差」范围收窄为 hermetic 门禁可证面，真机消隐窗时序照旧挂账停站观察。
- 金牌遮蔽（LOW 采信）：金牌对 `lib/replay-settle.mjs` 动态 import 逐案捕获，I/W 案不 import 该模块、驱子进程取旧行为红签名；accept 期红输出逐案存证。
