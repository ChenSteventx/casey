# replay-settle-mount 设计层评审料（plan 阶段，实现前）

本文件是喂给异构评审者（codex）的评审料，只含 spec（plan + grill）与「已定勿改」的方向声明，不含代码 diff、不含凭据、不含无关文件。评审对象是**设计**（实现尚未开始，工作树内尚无 `lib/replay-settle.mjs`/新金牌/新 prd），目的是在 build 前逮出设计缺陷。

---

## 0. 已定勿改的方向声明（来自任务简报，勿评论该决策本身，只评估其设计落地是否有缺陷）

### 根因（主会话勘定，真机证据在案）

真机跑 `tc_wf_publish_states` 的 `intent_1`（创建工作流后断言 `buttonState` present 发布/保存）判 `NEEDS_HUMAN`（`SUT_DEFECT_OR_STALE`）、`actual=0`，但 1.5 秒后 `atstep_8` 成功唯一点中「发布」按钮——按钮一直在，是回放侧静默点不够。

`bin/replay.mjs` 对 click 动作的静默窗只有：`waitForResponse` 600ms（`saveOrModifyProcessData|streamReply`）+ 固定 150ms + 对话流才有的 stream 等待。创建工作流点「确认」是 SPA（单页应用）路由跳转 + 「页面加载中」异步挂载编辑器（>1s），750ms 窗口早结束，`isLast`（代表步）就在编辑器挂载完成前采 `buttonState` → 数 0。

不对称：编译侧 `lib/compile-atoms.mjs` 的 `quietPoint`（约 :202-215，DOM 连续两拍稳定）+ `networkidle` 5s（约 :725）采观测现状，故编译期发布/保存在场被人签；回放侧代表步（`isLast`，`bin/replay.mjs` 约 :466-499 `buttonState` 采集）采断言前没有等价静默点。

### 修法方向（已定，勿改大方向）

回放侧在代表步（`isLast`）采集断言（`toast`/`textVisible`/`buttonState`/`reply`）之前，补一个有界静默点，镜像编译侧 `quietPoint` 的 DOM 连续两拍稳定 + `networkidle` 有界兜底，让 SPA 路由挂载/「页面加载中」消失后再采。铁不变量：

- 静默点纯观察者、有界（预算上界，SPA 背景轮询下 `networkidle` 可能永不达成——照编译侧 catch 兜底，绝不无限等）；
- 绝不改归因窗/取证因果作用域语义（`forensics` `attributedStep` 逻辑不动）、绝不把背景轮询拖进本步；
- 绝不改 `bin/verdict.mjs`、绝不改断言评估逻辑（`lib/replay-assert.mjs` 判定不动，只让采集时机对）；
- 缺失/超时 fail-safe：静默点超预算就按现状采（不因静默点本身报错吞步），但要保证「至少给到编译期同等的稳定预算」。
- 小固定下限（Steven 2026-07-14 批准并入）：条件轮询开始前可垫一个小的固定下限（如 200-300ms，具体值 plan 定并给理由），给 SPA 路由切换的首帧渲染一点起步窗、避免条件判据在动作刚落一拍就抢采到旧 DOM 的假稳定。定位明确：这是「条件式静默点的起步垫」，不是「每步 blanket 睡几秒」——固定值要小（毫秒级、编译回放对称若编译侧也有则对齐）、其后仍由条件（DOM 两拍稳定/加载占位消失/目标就位）决定何时放行；固定下限绝不承担「等到按钮出现」的职责（那是条件的活）。金牌须钉：即时渲染场景固定下限不显著拖慢（回归锁）、延迟挂载场景靠条件而非靠垫等到（把垫调 0 仍须条件兜住、不得靠加大固定值凑绿）。

### 必守硬约束

- 裁判零 LLM：`bin/verdict.mjs` 字节不动；`passes` 只 gate 写；`testChecksums` 冻结文件改须重签 sha256。
- `.auth/site.json` 凭据不进任何输出/日志/提交；真机地址不进代码/文档。本契约用 fake-sut + chromium hermetic 验证，绝不驱真机。
- 写 md/json 过 term-lint：简体、加粗只给中文、英文反引号、弃用别名不用、新概念先登记 CONTEXT.md。

### 关键裁量（规划者定、可否决，供评审逐条核验设计是否真兑现）

- D3（规划者定、可否决）静默判据必须复合：纯「DOM 连续两拍稳定」在静态「页面加载中」占位上会早退报假稳定（垫调 0 金牌必红），故加判据 A =前台在途 API 归零——复用 `lib/replay-forensics.mjs` 既有 `inFlightApi`（只收 XHR/Fetch，denylist 背景轮询天然除外，绝不把本步拖死），加性暴露 `inFlightCount()`。
- M1 固定下限取 250ms：Steven 批准区间 200-300 中点；编译侧 click 后 150ms 出现窗 + `quietPoint` 首拍 120ms 等效起点约 270ms 近似对称；稳定页每代表步总开销约 0.5s，I3 回归锁钉上界。
- M2 插入点 = `isLast` 块首（`bin/replay.mjs` :466）：先于 `intentUrl`/`intentCount`/`toast`/`textHits`/`buttonHits`/`buttonSeen`/`reply` 全部代表步采集，同刻性保留（`buttonSeen` 活性反证语义不破）；只代表步走静默点，非代表步与动作因果作用域（600+150ms）零动。
- M3 实现落新文件 `lib/replay-settle.mjs` 纯函数（单元金牌用桩不开浏览器）；M4 两枚测试缝 env `REPLAY_SETTLE_FLOOR_MS`/`REPLAY_SETTLE_BUDGET_MS`（缺省 250/2500 一字不变，`REPLAY_WATCHDOG_MS` 先例）。
- 预算构成：floor 250 → 条件轮询 2500ms（对齐编译侧 `quietPoint`）→ `networkidle` 2000ms 有界 catch 兜底一次 → 按现状采；「至少给到编译期同等稳定预算」满足。
- 挂账（记 observability、真机复验停站观察）：script/chunk 型延迟挂载不进 `inFlightApi` 且 `networkidle` 对带背景轮询真机不可达——此形态落 `NEEDS_HUMAN` 假阴方向绝非假绿，频发再议加载占位词表判（需人签词表，本轮不做）；真机 toast 自动消隐 vs 采样延后约 0.5s（假红方向，hermetic 零影响）。

评审请聚焦：设计是否真的兑现以上不变量、红先行金牌是否真能钉住对应缺陷（会不会假绿）、重签清单是否漏掉共享冻结文件、是否引入裁判 LLM 化 / 凭据外泄 / 术语走样风险。按 HIGH/MED/LOW 给 findings，逐条对准 GRILL 的 D1-D3/M1-M9 编号；如无发现给 PASS。

---

## 1. plan.md 全文

<details>
<summary>docs/plans/replay-settle-mount/plan.md</summary>

```markdown
# replay-settle-mount — 回放代表步采集前有界静默点（full）

## 背景

真机 `tc_wf_publish_states` 的 `intent_1`（创建工作流后断言 `buttonState` present 发布/保存）判 `NEEDS_HUMAN`（`SUT_DEFECT_OR_STALE`）、`actual=0`，但 1.5 秒后 `atstep_8` 成功唯一点中「发布」——按钮一直在，是回放侧静默点不够：click 静默窗仅 `waitForResponse` 600ms + 固定 150ms（`bin/replay.mjs` :436/:444），而创建工作流点「确认」是 SPA（单页应用）路由跳转 + 「页面加载中」异步挂载编辑器（>1s），代表步（`isLast`，:466-549）在挂载完成前采 `buttonHits` → 数 0 → 计时假阴。编译侧对称位有 `quietPoint`（`lib/compile-atoms.mjs` :203-214，DOM 连续两拍稳定、预算 2500ms）+ `networkidle` 有界前置（:725），回放侧代表步采集前没有等价静默点。决策全表见 `proposed/GRILL.md`（D1 方向 + D2 固定下限已由 Steven 2026-07-14 拍板；D3 判据构成与 M1-M9 机械决策可否决）。

铁不变量（D1）：静默点纯观察者、有界；归因窗/取证因果作用域语义零动；`bin/verdict.mjs` 字节不动、`lib/replay-assert.mjs` 判定不动；超预算按现状采（fail-safe，不吞步），条件预算 ≥ 编译期同等（2500ms）。

## 改动

1. 新 `lib/replay-settle.mjs`：`settleBeforeCapture(page, { inFlight, floorMs = 250, budgetMs = 2500, log })` → `{ settled, waitedMs }`。流程：先垫 `floorMs`（固定下限，D2/M1）→ 每 120ms 一拍，单次 `page.evaluate` 采 `document.body.innerHTML.length`、同拍读 `inFlight()`（前台在途 API 计数）→ 连续两拍长度相等且两拍在途归零 → `settled: true` 放行；预算耗尽 → `page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {})` 有界兜底一次 → `settled: false` 放行（按现状采）。`evaluate` 抛错（导航中执行上下文销毁）不算稳定拍、绝不外抛（fail-safe）。
2. `bin/replay.mjs`：`isLast` 块首（:466）接线——静默点先于该块全部代表步采集（`intentUrl`/`intentCount.after`/toast/`textHits`/`buttonHits`/`buttonSeen`/reply，同刻性保留）；`inFlight` 传 `() => forensics.inFlightCount()`；下限/预算读 `REPLAY_SETTLE_FLOOR_MS`/`REPLAY_SETTLE_BUDGET_MS`（缺省 250/2500，仅测试缝，`REPLAY_WATCHDOG_MS` 先例）；等待计入 `rhQuietWait`（回放历史诚实记账）；`REPLAY_DEBUG` 落 `settle intent=<id> waited=<ms> settled=<bool>` 日志行（金牌解析）。此处归因已关（`currentStepId` 为 null），归因语义零动；非代表步零新等待。
3. `lib/replay-forensics.mjs`：返回对象加性暴露 `inFlightCount: () => inFlightApi.size`（既有键零动；denylist 背景轮询本就不进 `inFlightApi`，绝不把本步拖死）。
4. `tests/fixtures/fake-sut/server.mjs`：+`mountdelay` 场景（M5）——`SCENARIOS` 集 +1；客户端 `renderDetail` 在该场景先渲静态占位「页面加载中」→ `fetch('/api/process/editorData')` → 应答后替换渲染编辑器（保存按钮 + 画布）；后端 +`/api/process/editorData` 路由（`mountdelay` 场景延迟 800ms 应答 200）。既有场景一律同步渲染零行为差。
5. `tests/fixtures/fake-sut/CONTRACT.md`：场景表 +`mountdelay` 行（占位→延迟挂载→替换，回放静默点考场）。
6. 新金牌 `tests/_golden/replay-settle-mount.golden.mjs`（红先行清单见下；chromium hermetic，绝不驱真机）。
7. accept 期：新 `loop/prd-replay-settle-mount.json`（冻新金牌 + `tests/fixtures/fake-sut/server.mjs` + `tests/fixtures/fake-sut/CONTRACT.md`）；重签 `prd-p5-replay`、`prd-replay-nth-visible-hardening`（见重签清单）。

## 红先行金牌清单

金牌事件（tmp 自产、`_sign-helper` 签署，wf-publish-states 金牌先例）：`atstep_0` nav 列表页（`intent_0`）→ `atstep_1` 点「新增工作流」→ `atstep_2` 填「工作流名称」→ `atstep_3` 点「确定」（`intent_1` 代表步，镜像真机事故的建流拓扑）。`intent_1` expected：`buttonState` present「保存」+ `textHidden`「页面加载中」+ `urlPathname` startsWith `/ai-manager/process/detail`。

- U1 静默点模块·稳定页快速放行：桩 page（长度恒定）+ 在途恒 0 → `settled: true`、`waitedMs` < 800（250 垫 + 两拍 240 + 余量）。修前红（模块不存在）。
- U2 永不稳定 fail-safe：桩 page 长度每拍递增 → `settled: false`、不抛、`waitedMs` ≥ 预算；`networkidle` 桩被调用且带有限 `timeout`（绝不无限等）。修前红。
- U3 固定下限可调：`floorMs: 300` 稳定页 → `waitedMs` ≥ 300；`floorMs: 0` → `waitedMs` < 300（垫是垫、条件是条件）。修前红。
- U4 `evaluate` 抛错（导航中上下文销毁）：不外抛、照放行（`settled: false` 或后续拍恢复）。修前红。
- I1 延迟挂载主案（红先行核心）：`mountdelay` 回放上述事件 → 修前 `buttonState` present「保存」`ok: false`/`actual: 0`（真机事故同签名）、`textHidden`「页面加载中」`ok: false`（占位在场被采到）；修后两者 `ok: true`、`buttonState` `actual` ≥ 1。
- I2 垫调 0 条件兜住（D2 金牌要求）：同 I1 且 `REPLAY_SETTLE_FLOOR_MS=0` → 修后仍全绿——延迟挂载靠条件（在途请求归零 + 两拍稳定）而非靠垫等到，不得靠加大固定值凑绿。修前红。
- I3 即时渲染回归锁（冻结时即绿）：`happy` 场景同事件 + `buttonState` present「保存」→ 全绿；`REPLAY_DEBUG` 解析 settle 行：`waited` < 1500ms 且 `settled: true`（早退，不烧满预算——固定下限不显著拖慢）。
- I4 观察者不是许愿机（冻结时即绿）：`mountdelay` + `buttonState` present「幽灵导出」（页面从不出现）→ 修前修后都 `ok: false`/`actual: 0`，且 settle 行 `settled: true`（DOM 稳定即放行采集，静默点绝不承担「等到断言为真」——期望驱动轮询是倒着裁）。
- I5 超预算照采 fail-safe（冻结时即绿）：`mountdelay` + `REPLAY_SETTLE_BUDGET_MS=100` → `replay` exit 0、axes 落盘、`buttonState` `ok: false`/`actual: 0`（超预算按现状采，不因静默点报错吞步）。
- W1 端到端裁定翻正：`casey run` 对 `mountdelay` → 修前 `intent_1` 判 `NEEDS_HUMAN`（真机事故端到端同构复现，红）；修后 `intent_1` PASS + 报告三件（html/md/json）落盘——`bin/verdict.mjs` 零改动前提下由采集时机修正翻正。

## touchesFiles

- `docs/plans/replay-settle-mount/proposed/GRILL.md`（本阶段）
- `docs/plans/replay-settle-mount/plan.md`（本阶段）
- `lib/replay-settle.mjs`（新，实现）
- `bin/replay.mjs`（实现接线）
- `lib/replay-forensics.mjs`（加性 `inFlightCount`）
- `tests/fixtures/fake-sut/server.mjs`（+`mountdelay` 场景）
- `tests/fixtures/fake-sut/CONTRACT.md`（场景表 +1 行）
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

全仓 prd 反向核对已做（70 份 `testChecksums` 遍历）：冻 `fake-sut` 两件的仅上述两份；`bin/replay.mjs`/`lib/replay-forensics.mjs`/`lib/replay-assert.mjs` 无任何 prd 冻结；`tests/fixtures/publish-sut/server.mjs` 本契约不碰（`prd-wf-publish-states`/`prd-wf-history-version` 不重签）。

## 非目标

`bin/verdict.mjs` 与 `lib/replay-assert.mjs` 任何改动；axes/observed/expected schema 新键；编译侧 `quietPoint` 改动；按断言粒度的期望驱动轮询（Playwright 自动重试断言那型——破同刻性、方向性倒裁）；加载占位词表判（挂账，真机复验若现 script/chunk 型延迟挂载再议）；toast 双采快照（挂账观察）；真机驱动（复验停站另账，本契约全程 fake-sut hermetic）。

## 验收

1. 新金牌全绿；实现前红案齐：U1-U4（模块缺失）、I1（`actual=0` 真机同签名）、I2（垫零）、W1（`NEEDS_HUMAN` 端到端复现）——accept 期 `--red-verified` 凭此；I3/I4/I5 冻结时即绿（回归保护，wf-publish-states I0 先例）。
2. 重签两 prd gate 复验 GREEN；`prd-replay-settle-mount` gate GREEN。
3. 回归零行为差：全仓 ratchet 零红 + `casey selftest --tier1` GREEN；受影响金牌族原样绿（`p5-replay`/`p5-replay-coverage`/`replay-nth-visible-hardening`/`kinds-harden`/`chiefcomplaint-smoke`/`chief-bringup`/`login-traffic-drop`/`wf-publish-states`/`wf-history-version`/`btn-enable-ops`/wf 画布族/`replay-video`/`video-login-carry`/`replay-login-bootstrap`/`run-history`/`layer3-wiring`/`e2e-chain`）。
4. 不变量核查：`git diff` 证 `bin/verdict.mjs`、`lib/replay-assert.mjs` 零改动；axes/observed schema 零新键；静默点等待全程 `currentStepId` 为 null（归因零动）。
5. 走时上浮有界：I3 的 settle 行 `waited` < 1500ms（即时渲染不显著拖慢）；gate 后台跑轮询收。
```

</details>

---

## 2. GRILL.md 全文（proposed/GRILL.md，含 D1-D3 承重决策 + M1-M9 机械决策 + 反面场景挂账）

<details>
<summary>docs/plans/replay-settle-mount/proposed/GRILL.md</summary>

```markdown
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

- `tests/fixtures/fake-sut/server.mjs`：+`mountdelay`（`SCENARIOS` 集 + 客户端 `renderDetail` 分支 + 后端 `/api/process/editorData` 路由）——冻它的 `prd-p5-replay`、`prd-replay-nth-visible-hardening` 重签。
- `tests/fixtures/fake-sut/CONTRACT.md`：场景表 +1 行——`prd-p5-replay` 冻它，随上重签。
- 消费 fake-sut 的其余金牌（wf-open-node 族、wf-add-node、wf-connect-nodes、wf-open-smoke、kinds-harden、layer3-wiring、run-history、replay-video 等）不冻 `server.mjs`，无需重签；loop 期全量回归证零行为差。
- `bin/replay.mjs`、`lib/replay-forensics.mjs`、新 `lib/replay-settle.mjs` 均为实现文件，无 prd 冻结。
- axes/observed/expected schema 零动（M6）；`lib/replay-assert.mjs`、`bin/verdict.mjs` 零字节动（D1 铁不变量）。
```

</details>

---

## 3. 相关既有代码摘录（read-only 背景，供评审核对设计描述与代码现状是否相符；非本契约改动内容）

### 3.1 `bin/replay.mjs` 现状（click 动作静默窗 + `isLast` 代表步采集块，本契约拟在此块首插入静默点）

```javascript
      if (ev.action === 'nav') {
        // nav 动作轴按 goto 实际成败（不再恒 unique，finding 3）。
        actionByStep.set(ev.stepId, navOk ? { resolution: 'unique', identityReadback: { ok: true } } : { resolution: 'action_failed', identityReadback: { ok: false } });
        state.currentStepId = null;
      } else {
        // 动作作用域：归因开放，覆盖动作 + 静默期（save/stream 异步在此窗回来）。
        state.currentStepId = ev.stepId;
        const respWait = ev.action === 'click'
          ? page.waitForResponse((r) => /saveOrModifyProcessData|streamReply/.test(r.url()), { timeout: 600 }).catch(() => null)
          : Promise.resolve(null);
        const axis = await performAction(page, ev, ctx);
        actionByStep.set(ev.stepId, axis || { resolution: 'none' });
        const settleT = Date.now();
        await respWait;
        // 给动作的直接异步后果（如 save 响应后随即开的 SSE 流）一点点出现窗，仍归本步——
        // 这是动作的因果作用域（save→stream），非任意时间窗；背景轮询仍由 denylist 归 null。
        if (ev.action === 'click') { await new Promise((r) => setTimeout(r, 150)); }
        // 动态流等待（chiefcomplaint-smoke D2，Steven 拍板；codex R1-F2 + R2 两轮收紧）：
        // 只等「本步 firingStepId 发起 且 命中 chat 流 URL 域」的 EventSource 走到 finished（或 30s 上界）
        // ——流是本步动作的直接后果，归因窗随延（因果作用域，非任意时间窗）；背景/他步长流、本步开的
        // 非对话长流（如面板附带 SSE）都绝不拖本步。配置了 streamUrlPattern 才有域可判；未配置时按
        // 本步发起判（与 compile 侧对称）。无本步流零行为差（p5/catalog 回归锁背书）。
        const streamInScope = (u) => !(chatCfg && chatCfg.streamUrlPattern) || String(u).includes(chatCfg.streamUrlPattern);
        const myStreams = () => forensics.records().filter((r) => r.type === 'EventSource' && r.firingStepId === ev.stepId && streamInScope(r.url));
        if (myStreams().length > 0) {
          log('  step stream open, waiting finished ' + ev.stepId);
          const swT = Date.now();
          while (Date.now() - swT < 30000 && !myStreams().every((r) => r.streamFinished === true)) {
            await new Promise((r) => setTimeout(r, 200));
          }
          // 网络流结束 ≠ UI 渲染完成（regress 实测）：配置了 chat 通道再等气泡文本 2s 稳定（上界 10s）。
          if (chatCfg) await waitReplyStable(page, replySelector);
        }
        rhQuietWait += Date.now() - settleT;
        log('  acted ' + ev.stepId + ' resolution=' + (axis && axis.resolution));
        state.currentStepId = null; // 动作作用域结束，关闭归因
      }

      if (isLast) {
        intentUrl.set(ev.intentId, pathOf(page.url()));
        const c = intentCount.get(ev.intentId);
        if (c) c.after = await rowCount(page, countSel);
        // kinds-harden（G3）：代表步静默点现场采——事后卷回评估只吃此刻事实（同 intentUrl/intentCount 范式）。
        // toast 快照选择器逐字复刻 lib/compile-atoms.mjs 观测采集（编译期作者与回放期消费者同构）。
        const toasts = await page.evaluate(() => {
          const out = [];
          for (const el of document.querySelectorAll('.hr-toast,.hr-message,[role="status"],[role="alert"]')) {
            const t = (el.textContent || '').trim();
            if (t) out.push(t);
          }
          return [...new Set(out)];
        }).catch(() => []);
        intentToasts.set(ev.intentId, toasts);
        // ...（textHits/buttonHits/buttonSeen/reply 采集逻辑，均在 isLast 块内，本契约插入点之后）
      }
```

（此为工作树 read-only 现状代码，供评审核对 M2「插入点 = `isLast` 块首」是否精确、`currentStepId` 是否此刻为 null、动作因果作用域 600+150ms 是否与静默点作用域互不重叠。本契约实现阶段将在 `if (isLast) {` 花括号后、`intentUrl.set(...)` 之前插入 `await settleBeforeCapture(...)` 调用，本材料不含该 diff——diff 尚未产生。）

### 3.2 `lib/compile-atoms.mjs` 现状（`quietPoint`，本契约拟镜像的判据 B）

```javascript
    // 静默点（确定性条件，替代固定睡眠，ADR-0003）：DOM 连续两拍稳定；networkidle 对带背景轮询的 SPA 永不达成、不作判据。
    async quietPoint(budgetMs = 2500) {
      let prev = -1;
      const t0 = Date.now();
      while (Date.now() - t0 < budgetMs) {
        let n = -2;
        try { n = await this.page.evaluate(() => document.body ? document.body.innerHTML.length : 0); } catch { n = -2; }
        if (n >= 0 && n === prev) return true;
        prev = n;
        await sleep(120);
      }
      return false;
    },
```

### 3.3 `lib/replay-forensics.mjs` 现状（`inFlightApi` 集合，本契约拟加性暴露 `inFlightCount()`）

```javascript
export function watchNetworkForensics(cdp, { denylist = [], successField, successValue, currentStep } = {}) {
  const byReq = new Map();
  const records = [];
  const pending = [];
  let streamOpen = 0;        // 在途 SSE 流计数（finished 前）
  const settleWaiters = [];  // 等所有流 finished 的 resolver
  const inFlightApi = new Set(); // 在途前台 API 请求（requestWillBeSent 到 loadingFinished/Failed 之间），drain 据此等齐
  const isBg = (url) => denylist.some((d) => url.includes(d));

  cdp.on('Network.requestWillBeSent', (e) => {
    const url = e.request.url;
    const firing = currentStep ? currentStep() : null;
    const initiator = (e.initiator && e.initiator.type) || null;
    const type = e.type || null;
    if (type === 'EventSource') streamOpen++;
    if ((type === 'XHR' || type === 'Fetch') && !isBg(url)) inFlightApi.add(e.requestId);
    const isApi = type === 'XHR' || type === 'Fetch' || type === 'EventSource' || (initiator === 'script' && type !== 'Document');
    const attributedStepId = isBg(url) || !firing || !isApi ? null : firing;
    const rec = { requestId: e.requestId, url, method: e.request.method, status: null, ts: e.timestamp, initiator, type, firingStepId: firing, attributedStepId, errorEnvelope: null, streamFinished: undefined, streamStatus: undefined };
    byReq.set(e.requestId, rec);
    records.push(rec);
  });

  cdp.on('Network.responseReceived', (e) => {
    const rec = byReq.get(e.requestId);
    if (rec) rec.status = e.response.status;
  });

  // ...
  cdp.on('Network.loadingFailed', (e) => { inFlightApi.delete(e.requestId); });
  cdp.on('Network.loadingFinished', (e) => {
    // ...
    inFlightApi.delete(e.requestId);
  });
```

注：`inFlightApi` 目前仅内部使用（drain 阶段等在途请求落 `loadingFinished`/`Failed`），本契约拟加一条 `inFlightCount: () => inFlightApi.size` 到 `watchNetworkForensics` 返回对象（加性，既有键零动）。

### 3.4 CONTEXT.md 既有「静默点」词条（供评审核对术语沿用是否走样）

```
| 静默点 | Quiet Point | 编译期落观测现状/做后检查前必达的确定性等待条件（networkidle + 无动画 + DOM 稳定 K ms），替代固定睡眠保可复现 | — |
```

注：该词条现文当前限定「编译期」，本契约拟把同一词「静默点」用于回放侧新机制（`settleBeforeCapture`）。plan.md/GRILL.md 正文均称之为「静默点」（如背景段「回放侧代表步采集前没有等价静默点」）。是否需要在 CONTEXT.md 改词条定义为跨阶段通用、或改用另一措辞区分编译期 `quietPoint` 与回放期新机制，未见 plan/GRILL 正文显式处理——请评审核对是否构成术语走样风险。

---

## 4. 评审指令（复述，供评审者对齐输出结构）

审设计——请回答：

1. 静默点有界性是否真封死 SPA 背景轮询下 `networkidle` 永不达成的场景（会不会无限等/拖垮回放）？
2. 是否误改归因窗与取证因果作用域（`attributedStepId` 逻辑、`currentStepId` 归因开关时序）？
3. DOM 稳定判据（判据 B）会否被背景动画/轮询搅成永不稳定，进而只能靠 `networkidle` 兜底兜到超时、拖慢每个代表步？
4. 红先行金牌清单（U1-U4 / I1-I5 / W1）是否真钉住计时假阴缺陷，会不会假绿（例如断言过弱、遗漏关键反面场景、判据 A+B 任一失守时金牌是否真会红）？
5. 既有即时渲染回归锁（I3）是否够（走时上浮上界是否合理、是否会漏掉「早退但实际仍在挂载」的边界）？
6. 重签清单（`prd-p5-replay`、`prd-replay-nth-visible-hardening`）是否遗漏了任何共享冻结文件？
7. 是否存在引入「裁判 LLM 化」的设计风险、凭据外泄风险、术语走样风险（含上文第 3.4 节「静默点」词条编译期限定 vs 回放期沿用的疑问）？

按 HIGH/MED/LOW 分级列 findings，每条对准 GRILL 的 D1-D3 或 M1-M9 编号；给出具体证据引用（行为/字段/场景描述，非泛泛而论）；无发现给 PASS。
