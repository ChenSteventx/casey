# replay-settle-mount — 回放代表步采集前有界静默点（full）

> 设计评审修订（codex-sol@max，2026-07-14）：异构评审 8 findings 逐条裁处并入本文（2 HIGH 采信重设计、4 MED 采信/部分采信、1 LOW 采信、1 MED 采信），处置台账见 `review/planreview-codex.md` 与 `proposed/GRILL.md` 评审修订段。

## 背景

真机 `tc_wf_publish_states` 的 `intent_1`（创建工作流后断言 `buttonState` present 发布/保存）判 `NEEDS_HUMAN`（`SUT_DEFECT_OR_STALE`）、`actual=0`，但 1.5 秒后 `atstep_8` 成功唯一点中「发布」——按钮一直在，是回放侧静默点不够：click 静默窗仅 `waitForResponse` 600ms + 固定 150ms（`bin/replay.mjs` :436/:444），而创建工作流点「确认」是 SPA（单页应用）路由跳转 + 「页面加载中」异步挂载编辑器（>1s），代表步（`isLast`，:466-549）在挂载完成前采 `buttonHits` → 数 0 → 计时假阴。编译侧对称位有 `quietPoint`（`lib/compile-atoms.mjs` :203-214，DOM 连续两拍稳定、预算 2500ms）+ `networkidle` 有界前置（:725），回放侧代表步采集前没有等价静默点。决策全表见 `proposed/GRILL.md`（D1 方向 + D2 固定下限已由 Steven 2026-07-14 拍板；D3 判据构成与 M1-M9 机械决策可否决）。

铁不变量（D1）：静默点纯观察者、有界；归因窗/取证因果作用域语义零动；`bin/verdict.mjs` 字节不动、`lib/replay-assert.mjs` 判定不动；超预算按现状采（fail-safe，不吞步），条件预算 ≥ 编译期同等（2500ms）。

## 改动

1. 新 `lib/replay-settle.mjs`：`settleBeforeCapture(page, { inFlight, floorMs = 250, budgetMs = 2500, log })` → `{ settled, waitedMs }`。流程（评审修订：拍级有界 + 判据 A 降级 + 稳定对不跨零 + 兜底条件化）：入参校验（`floorMs`/`budgetMs` 非有限非负数一律回缺省，绝不让 NaN 拖死循环）→ 先垫 `floorMs`（固定下限，D2/M1）→ 每 120ms 一拍：单拍 `page.evaluate` 采 `document.body.innerHTML.length` 且套 500ms 有界竞速（`lib/replay-forensics.mjs` :8 `withTimeout` 先例——渲染线程卡死或 `evaluate` 永不返回时该拍按不稳定计、预算循环照常复查，绝不悬死等全局看门狗）、同拍读 `inFlight()`（前台在途 API 计数；调用套 try/catch，抛错则本次静默点内判据 A 降级为不可用、退化为纯判据 B（编译侧同构），debug 记一行）→ 连续两拍长度相等且两拍均落在判据 A 归零区间内（稳定对不得跨零点：在途未归零期间的稳定拍不计入稳定对，给「应答后提交」约两拍缓冲）→ `settled: true` 放行；预算耗尽 → 仅当此刻判据 A 仍非零才走 `page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {})` 有界兜底一次（兜底职责=网络尾巴；判据 A 已归零而 DOM 仍变是动画/轮询渲染形态，`networkidle` 不识 denylist、背景轮询下注定烧满 2000ms 且无增益——直接放行）→ `settled: false` 放行（按现状采）。`evaluate` 抛错（导航中执行上下文销毁）不算稳定拍、绝不外抛（fail-safe）。
2. `bin/replay.mjs`：`isLast` 块首（:466）接线——静默点先于该块全部代表步采集（`intentUrl`/`intentCount.after`/toast/`textHits`/`buttonHits`/`buttonSeen`/reply，同刻性保留）；接线处整体 try/catch（helper 自身故障照现状采、不吞步，等待仍计入）；`inFlight` 传 `() => forensics.inFlightCount()`；下限/预算读 `REPLAY_SETTLE_FLOOR_MS`/`REPLAY_SETTLE_BUDGET_MS`（缺省 250/2500，仅测试缝，`REPLAY_WATCHDOG_MS` 先例）；等待计入 `rhQuietWait`（回放历史诚实记账）；代表步 `historyLine` 的 `quietPointReached` 改取 `navOk && settled`（评审修订：堵「静默点超时仍记达成」的记账口径不一致——schema「false=证据可复现性存疑」正是此义；非代表步维持 `!!navOk` 既有口径；值域仍 boolean，`tests/_golden/schemas/run-history.schema.json` 文件零动、`prd-seams-freeze-v2` 冻结面不碰）；`REPLAY_DEBUG` 落 `settle intent=<id> waited=<ms> settled=<bool>` 日志行（金牌解析）。此处归因已关（`currentStepId` 为 null），归因语义零动；非代表步零新等待。
3. `lib/replay-forensics.mjs`：返回对象加性暴露 `inFlightCount: () => inFlightApi.size`（既有键零动；denylist 背景轮询本就不进 `inFlightApi`，绝不把本步拖死）。
4. `tests/fixtures/fake-sut/server.mjs`：+`mountdelay` 场景（M5）——`SCENARIOS` 集 +1；客户端 `renderDetail` 在该场景先渲静态占位「页面加载中」→ `fetch('/api/process/editorData')` → 应答后替换渲染编辑器（保存按钮 + 画布）；后端 +`/api/process/editorData` 路由（延迟可配：`startFakeSut({ mountDelayMs })` 仅 `mountdelay` 场景生效、缺省 800ms——评审修订，I5 须拉长到 6000ms 才真踩到超预算分支）；`mountdelay` 场景下确认按钮的「新增成功」toast 3000ms 后自动消隐（评审修订：典型消隐窗回归锁考场；既有场景 toast 常驻零行为差）。+`churn` 场景（评审修订）：详情页 DOM 每 100ms 追加变长 + 背景轮询每 300ms 一发（轮询 URL 供 denylist 配置）——I6 走时上界考场。既有场景一律同步渲染零行为差。
5. `tests/fixtures/fake-sut/CONTRACT.md`：场景表 +`mountdelay` 行（占位→延迟挂载（可配 `mountDelayMs`）→替换 + toast 自动消隐 3000ms，回放静默点考场）、+`churn` 行（DOM 持续扰动 + 背景轮询，走时上界考场）。
6. 新金牌 `tests/_golden/replay-settle-mount.golden.mjs`（红先行清单见下；chromium hermetic，绝不驱真机）。评审修订：金牌对 `lib/replay-settle.mjs` 一律动态 import 逐案捕获（缺模块=U 案各自红签名，绝不因顶层静态 import 整体崩掉遮蔽 I/W 案）；I/W 案不 import 该模块、直接驱 `bin/replay.mjs`/`casey run` 子进程取旧行为红签名；accept 期 U/I/W 各案红输出逐案存证。
7. `CONTEXT.md`：「静默点」词条扩写为跨阶段通用定义（评审修订：现文限定编译期且判据描述与回放侧不一致）——通用义「采集/后检前必达的确定性有界等待条件，替代固定睡眠保可复现」+ 各期判据变体注明（编译期 DOM 连续两拍稳定；回放代表步在途请求归零 + DOM 两拍稳定，`networkidle` 仅超预算后有界兜底）。无 prd 冻结 `CONTEXT.md`，零新增重签项。
8. accept 期：新 `loop/prd-replay-settle-mount.json`（冻新金牌 + `tests/fixtures/fake-sut/server.mjs` + `tests/fixtures/fake-sut/CONTRACT.md`）；重签 `prd-p5-replay`、`prd-replay-nth-visible-hardening`（见重签清单）。

## 红先行金牌清单

金牌事件（tmp 自产、`_sign-helper` 签署，wf-publish-states 金牌先例）：`atstep_0` nav 列表页（`intent_0`）→ `atstep_1` 点「新增工作流」→ `atstep_2` 填「工作流名称」→ `atstep_3` 点「确定」（`intent_1` 代表步，镜像真机事故的建流拓扑）。`intent_1` expected：`buttonState` present「保存」+ `textHidden`「页面加载中」+ `textVisible`「新增成功」（评审修订，toast 典型消隐窗回归锁）+ `urlPathname` startsWith `/ai-manager/process/detail`。

- U1 静默点模块·稳定页快速放行：桩 page（长度恒定）+ 在途恒 0 → `settled: true`、`waitedMs` < 800（250 垫 + 两拍 240 + 余量）。修前红（模块不存在，动态 import 逐案捕获）。
- U2 永不稳定 fail-safe（评审修订拆两变体）：桩 page 长度每拍递增。变体 a（在途恒 0）→ `settled: false`、不抛、`waitedMs` ≥ 预算且总耗时 < 预算+下限+余量、`networkidle` 桩不被调用（判据 A 已归零、兜底条件化跳过）；变体 b（在途恒 1）→ `networkidle` 桩被调用且带有限 `timeout`（绝不无限等）、总耗时有界。修前红。
- U3 固定下限可调：`floorMs: 300` 稳定页 → `waitedMs` ≥ 300；`floorMs: 0` → `waitedMs` < 300（垫是垫、条件是条件）。修前红。
- U4 `evaluate` 抛错（导航中上下文销毁）：不外抛、照放行（`settled: false` 或后续拍恢复）。修前红。
- U5 `evaluate` 永不返回（评审修订新增）：桩 `evaluate` 回永不 resolve 的 Promise → 每拍 500ms 竞速兜住、预算循环照常复查 → `settled: false`、不抛、总耗时 < 预算+单拍竞速+余量（硬时间上界，绝不悬死等看门狗）。修前红。
- U6 `inFlight()` 抛错（评审修订新增）：桩每次调用即抛 + 稳定页 → 不外抛、判据 A 降级、纯判据 B 照常 `settled: true`。修前红。
- U7 稳定对不跨零点（评审修订新增）：脚本化桩序列（在途 1,1,0,0…、DOM 长度全程恒定）→ 放行时刻必在第二个归零拍之后（占位期的陈稳定拍不计入稳定对，「应答后提交」拿到约两拍缓冲）。修前红。
- I1 延迟挂载主案（红先行核心）：`mountdelay` 回放上述事件 → 修前 `buttonState` present「保存」`ok: false`/`actual: 0`（真机事故同签名）、`textHidden`「页面加载中」`ok: false`（占位在场被采到）；修后两者 `ok: true`、`buttonState` `actual` ≥ 1，且 `textVisible`「新增成功」`ok: true`（采集延后约 1s 仍落在 3000ms 典型消隐窗内——延采不丢典型 toast 的回归锁，评审修订）。
- I2 垫调 0 条件兜住（D2 金牌要求）：同 I1 且 `REPLAY_SETTLE_FLOOR_MS=0` → 修后仍全绿——延迟挂载靠条件（在途请求归零 + 两拍稳定）而非靠垫等到，不得靠加大固定值凑绿。修前红。
- I3 即时渲染回归锁（冻结时即绿）：`happy` 场景同事件 + `buttonState` present「保存」→ 全绿；`REPLAY_DEBUG` 解析 settle 行：`waited` < 1500ms 且 `settled: true`（早退，不烧满预算——固定下限不显著拖慢）；`--run-history` 代表步行 `quietPointReached: true`（评审修订）。
- I4 观察者不是许愿机（冻结时即绿）：`mountdelay` + `buttonState` present「幽灵导出」（页面从不出现）→ 修前修后都 `ok: false`/`actual: 0`，且 settle 行 `settled: true`（DOM 稳定即放行采集，静默点绝不承担「等到断言为真」——期望驱动轮询是倒着裁）。
- I5 超预算照采 fail-safe（冻结时即绿；评审修订整案重设计——原设计缺省 800ms 延迟下挂载在 `networkidle` 兜底窗内完成、`actual` 必 ≥1 与预期矛盾，HIGH 采信）：`mountdelay` 且 `mountDelayMs: 6000` + `REPLAY_SETTLE_BUDGET_MS=100` → 预算耗尽时判据 A 仍在途 → `networkidle` 兜底 2000ms 超时放行 → 采集时刻（约 2.6s）远早于挂载（6s）→ `replay` exit 0、axes 落盘、`buttonState` `ok: false`/`actual: 0`（超预算按现状采，不因静默点报错吞步）；`--run-history` 代表步行 `quietPointReached: false`（超时如实记账，schema「false=证据可复现性存疑」口径一致）。
- I6 扰动走时上界回归锁（冻结时即绿，评审修订新增）：`churn` 场景（DOM 每 100ms 变长 + 背景轮询 300ms 一发、轮询 URL 入 denylist）→ `replay` exit 0、settle 行 `settled: false`、`waited` < 4000ms（预期约 250 垫 + 2500 预算；判据 A 归零故兜底跳过——`networkidle` 不识 denylist 的 2000ms 燃烧被条件化堵死）；单代表步最坏走时有上界、绝不靠 `REPLAY_WATCHDOG_MS`（120s）收尸。
- W1 端到端裁定翻正：`casey run` 对 `mountdelay`（缺省 800ms 延迟）→ 修前 `intent_1` 判 `NEEDS_HUMAN`（真机事故端到端同构复现，红）；修后 `intent_1` PASS + 报告三件（html/md/json）落盘——`bin/verdict.mjs` 零改动前提下由采集时机修正翻正。

## touchesFiles

- `docs/plans/replay-settle-mount/proposed/GRILL.md`（本阶段）
- `docs/plans/replay-settle-mount/plan.md`（本阶段）
- `lib/replay-settle.mjs`（新，实现）
- `bin/replay.mjs`（实现接线）
- `lib/replay-forensics.mjs`（加性 `inFlightCount`）
- `tests/fixtures/fake-sut/server.mjs`（+`mountdelay`/`churn` 场景）
- `tests/fixtures/fake-sut/CONTRACT.md`（场景表 +2 行）
- `CONTEXT.md`（「静默点」词条扩写为跨阶段通用定义，评审修订）
- `tests/_golden/replay-settle-mount.golden.mjs`（新金牌）
- `loop/prd-replay-settle-mount.json`（新，accept）
- `loop/prd-p5-replay.json`（重签 sha256）
- `loop/prd-replay-nth-visible-hardening.json`（重签 sha256）
- `loop/active-contract.json`（阶段推进台账）

## 重签清单（accept 期执行，一个不漏）

| prd | 冻结面命中 | 动作 |
|---|---|---|
| `loop/prd-p5-replay.json` | `tests/fixtures/fake-sut/server.mjs` + `tests/fixtures/fake-sut/CONTRACT.md` | 两条 sha256 重签 → `gate --prd loop/prd-p5-replay.json` 复验 GREEN |
| `loop/prd-replay-nth-visible-hardening.json` | `tests/fixtures/fake-sut/server.mjs` | 一条 sha256 重签 → gate 复验 GREEN |

全仓 prd 反向核对已做（70 份 `testChecksums` 遍历）：冻 `fake-sut` 两件的仅上述两份；`bin/replay.mjs`/`lib/replay-forensics.mjs`/`lib/replay-assert.mjs` 无任何 prd 冻结；`tests/fixtures/publish-sut/server.mjs` 本契约不碰（`prd-wf-publish-states`/`prd-wf-history-version` 不重签）。评审修订补核：根 `CONTEXT.md` 无 prd 冻结（`prd-loop-kit-extract` 冻的是 fixture 内同名文件，路径不同）——词条扩写零新增重签；`tests/_golden/schemas/run-history.schema.json` 被 `prd-seams-freeze-v2` 冻结——本契约只改 `quietPointReached` 的取值来源、schema 文件字节不动，不触发重签。

## 非目标

`bin/verdict.mjs` 与 `lib/replay-assert.mjs` 任何改动；axes/observed/expected schema 新键；编译侧 `quietPoint` 改动；按断言粒度的期望驱动轮询（Playwright 自动重试断言那型——破同刻性、方向性倒裁）；加载占位词表判（挂账，真机复验若现 script/chunk 型延迟挂载再议）；「响应结束后 UI 延迟提交」形态的判据扩展（评审修订部分采信：超过约两拍缓冲（约 240ms）的延迟提交是已挂账盲区，失败方向 fail-safe 假红绝非假绿，已确证真机形态（请求驱动 + 应答即提交）I1 已覆盖——判据侧「必须看到归零后 DOM 变化」会假定「应答必改 DOM」、在应答不改 DOM 的页面上烧满预算，恶化最坏走时，本轮不做，见 GRILL D3 残余）；`innerHTML.length` 等长内容变化的碰撞边界（镜像编译侧同判据保持对称，失败方向同上，落账不改判据）；toast 双采快照（挂账观察）；真机驱动（复验停站另账，本契约全程 fake-sut hermetic）。

## 验收

1. 新金牌全绿；实现前红案齐：U1-U7（模块缺失，动态 import 逐案红签名）、I1（`actual=0` 真机同签名）、I2（垫零）、W1（`NEEDS_HUMAN` 端到端复现）——accept 期 `--red-verified` 凭此、各案红输出逐案存证；I3/I4/I5/I6 冻结时即绿（回归保护，wf-publish-states I0 先例）。
2. 重签两 prd gate 复验 GREEN；`prd-replay-settle-mount` gate GREEN。
3. 回归零行为差（评审修订：范围收窄为 hermetic 门禁可证面）：全仓 ratchet 零红 + `casey selftest --tier1` GREEN；受影响金牌族原样绿（`p5-replay`/`p5-replay-coverage`/`replay-nth-visible-hardening`/`kinds-harden`/`chiefcomplaint-smoke`/`chief-bringup`/`login-traffic-drop`/`wf-publish-states`/`wf-history-version`/`btn-enable-ops`/wf 画布族/`replay-video`/`video-login-carry`/`replay-login-bootstrap`/`run-history`/`layer3-wiring`/`e2e-chain`）。真机 toast 消隐窗时序上浮是已挂账残余（GRILL）、门禁不可证——I1 以 3000ms 典型窗钉「延采不丢典型 toast」，真机复验停站观察。
4. 不变量核查：`git diff` 证 `bin/verdict.mjs`、`lib/replay-assert.mjs` 零改动；axes/observed schema 零新键（`run-history.schema.json` 文件字节不动）；静默点等待全程 `currentStepId` 为 null（归因零动）。
5. 走时上浮有界：I3 的 settle 行 `waited` < 1500ms（即时渲染不显著拖慢）；I6 钉扰动最坏上界（`waited` < 4000ms，兜底条件化生效）；单代表步最坏 ≈ 250 垫 + 2500 预算 +（仅判据 A 未归零时）2000 兜底 ≈ 4.75s，代表步=每 intent 一步。`REPLAY_WATCHDOG_MS`（120s）是整跑单计时器（`bin/replay.mjs` :162-163，一次 `setTimeout`、各出口 `clearTimeout`），故 N 个持续在途代表步的累计上界按 intent 数线性 ≈ N × 4.75s——**约 25 个持续在途代表步以内不逼近 watchdog**（120 ÷ 4.75 ≈ 25.3；超此规模须上调 `REPLAY_WATCHDOG_MS`，或改多 intent 累积走时预算案）。评审修订（A2 采信）：原「数十以内」措辞含 26 个以上、超线性上界，收窄为按 intent 数线性的显式上界式。gate 后台跑轮询收。
6. 记账口径一致：I5 代表步行 `quietPointReached: false`、I3 为 `true`——静默点超时绝不记成达成。
