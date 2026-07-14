# replay-settle-mount 实现评审料（r1）

契约：`replay-settle-mount`（lane full）｜worktree `/mnt/d/ctx/heren/casey-replay-settle-mount`（分支 `replay-settle-mount`，基于 `dev`）
本文只含 spec 要点 + 完整 diff + 门禁证据，不含实现者推理过程、不含任何凭据。

## 一、GRILL 要点（`docs/plans/replay-settle-mount/proposed/GRILL.md`）

### 根因（主会话勘定，真机证据在案）

真机 `tc_wf_publish_states` 的 `intent_1`（创建工作流后断言 `buttonState` present 发布/保存）判 `NEEDS_HUMAN`（`SUT_DEFECT_OR_STALE`）、`actual=0`，但 1.5 秒后 `atstep_8` 成功唯一点中「发布」按钮——按钮一直在，是回放侧代表步采集抢在单页应用编辑器挂载完成之前。

编译回放两侧不对称：
- 编译侧 `lib/compile-atoms.mjs`：每步动作后走 `quietPoint`（DOM 连续两拍稳定、预算 2500ms、120ms 一拍）才 `capture` 采观测；个别原子另有 `networkidle` 5s 有界前置。
- 回放侧 `bin/replay.mjs`：click 动作静默窗只有 `waitForResponse` 600ms + 固定 150ms + 对话流才有的流等待，代表步（`isLast`）随即采集。创建工作流点「确认」是单页应用路由跳转 + 「页面加载中」异步挂载编辑器（大于 1 秒），约 750ms 窗口早结束，挂载完成前采 `buttonState`，数 0，计时假阴。

裁定与断言评估都没错：`bin/verdict.mjs` 与 `lib/replay-assert.mjs` 拿到的就是采集时刻的事实，错在采集时机。

### D1 修法方向（已拍板）

回放侧在代表步采集断言输入之前，补一个有界静默点，镜像编译侧 `quietPoint`。铁不变量：
1. 静默点纯观察者、有界（预算上界；单页应用背景轮询下 `networkidle` 可能永不达成，照编译侧 catch 兜底，绝不无限等）；
2. 绝不改归因窗/取证因果作用域语义（`attributedStepId` 逻辑零动；静默点跑在归因已关之后，`currentStepId` 此刻为 null）、绝不把背景轮询拖进本步；
3. `bin/verdict.mjs` 字节不动；`lib/replay-assert.mjs` 判定逻辑不动（只让采集时机对）；
4. 缺失/超时 fail-safe：静默点超预算就按现状采（不因静默点本身报错吞步），且至少给到编译期同等的稳定预算（条件预算不小于 2500ms，对齐 `quietPoint`）。

### D2 小固定下限（Steven 2026-07-14 批准并入）

条件轮询开始前垫一个小的固定下限，给单页应用路由切换的首帧渲染一点起步窗，避免条件判据在动作刚落一拍就抢采旧 DOM 的假稳定。定位：这是条件式静默点的前置固定下限，不是每步一律睡几秒；其后仍由条件（在途请求归零 + DOM 两拍稳定）决定何时放行；固定下限绝不承担「等到按钮出现」的职责。金牌须钉两向：即时渲染场景不显著拖慢（回归锁）；延迟挂载场景靠条件而非靠垫等到（垫调 0 仍须条件兜住、不得靠加大固定值凑绿）。M1 取值：250ms。

### D3 静默判据构成

为什么纯 DOM 连续两拍稳定不够：真机形态是「页面加载中」静态占位先渲、编辑器后挂——占位期 DOM 静止不变，两拍判据会在占位上早退报稳定，采集仍抢在挂载前（垫调 0 时金牌必红）。故复合判据为：
- 判据 A（新增，纯观察）：前台在途 API 归零，复用 `watchNetworkForensics` 已有的 `inFlightApi` 集合（只收 XHR/Fetch，denylist 背景轮询天然除外）。
- 判据 B（镜像编译侧）：DOM 连续两拍稳定（`document.body.innerHTML.length` 两拍相等，120ms 一拍）。
- 复合流程：固定下限先垫，轮询循环内每拍同测 A、B，连续两拍 B 相等且两拍 A 归零即放行；预算 2500ms 耗尽后仅在途仍非零才走 `networkidle` 有界兜底一次（2000ms、catch 吞超时）；判据 A 已归零的 DOM 扰动形态直接放行（兜底条件化，避免背景轮询下必烧满超时且无增益）。
- 反方向铁则：判据绝不读 expected，静默点不知道要断什么按钮，只看页面自己说还没稳。

### 残余风险与挂账（观察性，不阻塞）

- 真机 toast 自动消隐窗与采样延后的时序关系：失败方向是假红（`NEEDS_HUMAN`）非假绿，真机复验停站观察。
- script/chunk 型延迟挂载（JS 分包加载）不进 `inFlightApi`（只收 XHR/Fetch），`networkidle` 兜底对带背景轮询的真机不可达——此形态若真机出现按 fail-safe 落 `NEEDS_HUMAN`（假阴方向非假绿），届时再议。
- 「响应结束后 UI 延迟提交」形态：判据 A 在 `loadingFinished` 即归零，提交延迟超过稳定对约两拍缓冲（约 240ms）则在占位上放行——失败方向假红非假绿，已确证真机形态（应答即提交）已覆盖，本轮不做判据侧扩展。

## 二、plan.md 改动摘要（`docs/plans/replay-settle-mount/plan.md`）

1. 新 `lib/replay-settle.mjs`：`settleBeforeCapture(page, { inFlight, floorMs=250, budgetMs=2500, log })` 返回 `{ settled, waitedMs }`；入参非有限非负数一律回缺省；单拍 `page.evaluate` 套 500ms 有界竞速（`evaluate` 永不返回时该拍按不稳定计）；`inFlight()` 抛错则本次静默点内判据 A 降级为不可用、退化为纯判据 B；稳定对不得跨零点。
2. `bin/replay.mjs`：`isLast` 块首接线，静默点先于该块全部代表步采集；整体 try/catch（helper 自身故障照现状采，不吞步）；`inFlight` 传 `forensics.inFlightCount()`；下限/预算读 `REPLAY_SETTLE_FLOOR_MS`/`REPLAY_SETTLE_BUDGET_MS`（缺省 250/2500，测试缝）；等待计入 `rhQuietWait`；代表步 `historyLine` 的 `quietPointReached` 改取 `navOk && settled`，非代表步维持既有 `!!navOk` 口径；`REPLAY_DEBUG` 落 settle 日志行。
3. `lib/replay-forensics.mjs`：返回对象加性暴露 `inFlightCount: () => inFlightApi.size`（既有键零动）。
4. `tests/fixtures/fake-sut/server.mjs`：加 `mountdelay` 场景（静态占位先渲、数据请求驱动延迟挂载、可配 `mountDelayMs`、toast 3000ms 自动消隐）与 `churn` 场景（DOM 持续扰动 + 背景轮询、走时上界考场）。
5. `tests/fixtures/fake-sut/CONTRACT.md`：场景表加两行。
6. 新金牌 `tests/_golden/replay-settle-mount.golden.mjs`：U1-U7 单元向对 `lib/replay-settle.mjs` 动态 import 逐案捕获；I1-I6/W1 驱子进程取行为签名。
7. `CONTEXT.md`：「静默点」词条扩写为跨阶段通用定义。
8. accept 期：新 `loop/prd-replay-settle-mount.json`；重签 `prd-p5-replay`、`prd-replay-nth-visible-hardening`（两 prd 冻 `tests/fixtures/fake-sut/server.mjs`/`CONTRACT.md`）。

### 红先行金牌清单（15 案）

U1 稳定页快速放行；U2a/U2b 永不稳定 fail-safe（在途恒 0/恒 1 两变体）；U3 固定下限可调；U4 `evaluate` 抛错不外抛；U5 `evaluate` 永不返回硬上界；U6 `inFlight()` 抛错降级；U7 稳定对不跨零点；I1 延迟挂载主案（真机同签名红）；I2 垫调 0 条件兜住；I3 即时渲染回归锁；I4 观察者不是许愿机（幽灵按钮）；I5 超预算照采 fail-safe（`mountDelayMs=6000` + `budget=100`）；I6 扰动走时上界回归锁（`churn` 场景）；W1 端到端裁定翻正（`casey run` 对 `mountdelay`）。

### 非目标（明确排除）

`bin/verdict.mjs` 与 `lib/replay-assert.mjs` 任何改动；axes/observed/expected schema 新键；编译侧 `quietPoint` 改动；按断言粒度的期望驱动轮询；加载占位词表判（挂账）；「响应结束后 UI 延迟提交」判据扩展（挂账）；`innerHTML.length` 碰撞边界（挂账，镜像编译侧同判据保持对称）；真机驱动（本契约全程 fake-sut hermetic）。

### 验收标准（plan.md 原文摘录）

1. 新金牌全绿；实现前红案齐 U1-U7/I1/I2/W1，I3/I4/I5/I6 冻结时即绿。
2. 重签两 prd gate 复验 GREEN；`prd-replay-settle-mount` gate GREEN。
3. 回归零行为差：全仓 ratchet 零红 + `casey selftest --tier1` GREEN；受影响金牌族原样绿。
4. 不变量核查：`git diff` 证 `bin/verdict.mjs`、`lib/replay-assert.mjs` 零改动；axes/observed schema 零新键；静默点等待全程 `currentStepId` 为 null。
5. 走时上浮有界：I3 的 settle 行 `waited` < 1500ms；I6 钉扰动最坏上界 `waited` < 4000ms。
6. 记账口径一致：I5 代表步行 `quietPointReached: false`、I3 为 `true`。

## 三、完整实现 diff（`git diff dev...HEAD`，15 文件，1171 行插入 / 24 行删除）

文件列表：
```
 CONTEXT.md                                         |   2 +-
 bin/replay.mjs                                     |  30 +-
 docs/plans/replay-settle-mount/plan.md             |  77 +++++
 docs/plans/replay-settle-mount/proposed/GRILL.md   |  70 +++++
 .../proposed/red/red-before-impl.txt               |  16 +
 .../replay-settle-mount/review/planreview-codex.md | 105 +++++++
 .../review/planreview-material.md                  | 342 +++++++++++++++++++++
 lib/replay-forensics.mjs                           |   3 +
 lib/replay-settle.mjs                              |  93 ++++++
 loop/prd-p5-replay.json                            |   8 +-
 loop/prd-replay-nth-visible-hardening.json         |   6 +-
 loop/prd-replay-settle-mount.json                  |  54 ++++
 tests/_golden/replay-settle-mount.golden.mjs       | 320 +++++++++++++++++++
 tests/fixtures/fake-sut/CONTRACT.md                |   4 +-
 tests/fixtures/fake-sut/server.mjs                 |  65 +++-
 15 files changed, 1171 insertions(+), 24 deletions(-)
```

以下为完整 unified diff（`git -C /mnt/d/ctx/heren/casey-replay-settle-mount diff dev...HEAD`）：

```diff
diff --git a/CONTEXT.md b/CONTEXT.md
index 306ed57..48aead2 100644
--- a/CONTEXT.md
+++ b/CONTEXT.md
@@ -148,7 +148,7 @@
 | 失败指纹 | Failure Fingerprint | 失败记录台账 的可聚类指纹 = sha256(canonicalJSON(fingerprintInputs))，输入只含稳定已模板化字段（channel/verdict/reason/atom/assertionKind/assertionOp/signatureTemplate）；显式排除 caseId/stepId/runId/时间戳/实例名/凭据，故同一失败模式跨用例聚类。零 LLM、可复现、进 golden；聚类粒度 route:human（决策 3.3） | — |
 | 人裁决回填 | Human Resolution | 失败记录台账 条目里由人经签署链路写入的裁决指针（decision/resolvedAt/resolverId/ref）：只读审计引用非执行器，ref 指向权威产物（缺陷单/重签元数据/漂移补丁），绝不复制权威态、绝不改原裁定；decision=drift-healed 仅当 verdict=HARNESS_ERROR 才合法 | — |
 | route:human | 路由人 | 把某项判断/动作显式移交人裁的标注（落 Inbox + 通知，Escalation Path 的标记形态）；Observability 测不到的维度必申报为 route:human | — |
-| 静默点 | Quiet Point | 编译期落观测现状/做后检查前必达的确定性等待条件（networkidle + 无动画 + DOM 稳定 K ms），替代固定睡眠保可复现 | — |
+| 静默点 | Quiet Point | 采集观测现状/落断言输入/做后检查前必达的确定性有界等待条件，替代固定睡眠保可复现（跨阶段通用）。各期判据变体：编译期 DOM 连续两拍稳定（`quietPoint`，`networkidle` 对带背景轮询的单页应用不作判据）；回放代表步在途前台请求归零 + DOM 两拍稳定（稳定对不跨零点、给应答后提交约两拍缓冲），`networkidle` 仅超预算后有界兜底一次（`settleBeforeCapture`）；一律有界、超预算按现状采（fail-safe） | — |
 | LLM-judge | LLM 评分员 | 独立异构家族的语义评分器；判 FAIL 可信、判 PASS 仍人抽检；严格踢出确定性裁判（verdict.mjs）之外，绝不写 passes/verdict | — |
 | `CLI` | 命令行接口 | Command-Line Interface：Casey 的确定性引擎入口 `bin/casey.mjs`；skill 与 MCP 都是它的薄壳 | — |
 | `MCP` | 模型上下文协议 | Model Context Protocol：编辑器/agent 驱动工具的协议；`mcp/casey-server.mjs` 是 CLI 的 MCP 薄壳 | — |
diff --git a/bin/replay.mjs b/bin/replay.mjs
index 57ff1e0..4eff02b 100644
--- a/bin/replay.mjs
+++ b/bin/replay.mjs
@@ -20,6 +20,7 @@ import pw from '@playwright/test';
 import { performAction } from '../lib/replay-actions.mjs';
 import { instantiate } from '../lib/instantiate.mjs';
 import { watchNetworkForensics } from '../lib/replay-forensics.mjs';
+import { settleBeforeCapture } from '../lib/replay-settle.mjs';
 import { evaluateAssertions } from '../lib/replay-assert.mjs';
 import { loadSiteConfig, loadCreds, loginBootstrap } from '../lib/login-bootstrap.mjs';
 import { credentialGate, maskCredentialRoute } from '../lib/cred-gate.mjs';
@@ -75,7 +76,7 @@ const RH_PLACEHOLDER = /^\{\{[A-Za-z0-9_.-]+\}\}$/;
 const RH_INTERACTIVE = new Set(['click', 'dblclick', 'fill', 'selectOption', 'dragTo']); // dragTo 源有定位 → 交互支（wf-add-node）
 const RH_ACTIONS = new Set(['click', 'dblclick', 'fill', 'selectOption', 'press', 'nav', 'newpage', 'dragTo']);
 const RH_LR_ENUM = new Set(['unique', 'none', 'ambiguous', 'fallback_first', 'coord_fallback']); // 冻结枚举透传（codex R1-F2）
-function historyLine(ev, { navOk, navErr, axis, durationMs, caseId }) {
+function historyLine(ev, { navOk, navErr, axis, durationMs, caseId, isLast, settled }) {
   if (!RH_ACTIONS.has(ev.action)) return null; // 冻结枚举外（如纯断言步）不落行
   let locatorResolution = null;
   let result;
@@ -108,7 +109,9 @@ function historyLine(ev, { navOk, navErr, axis, durationMs, caseId }) {
     action: ev.action,
     parameters,
     locatorResolution,
-    quietPointReached: !!navOk,
+    // 代表步（isLast）接静默点结果（replay-settle-mount）：navOk && settled——静默点超时仍记 false
+    //   （schema「false=证据可复现性存疑」口径一致）；非代表步维持既有 !!navOk 口径。值域仍 boolean。
+    quietPointReached: isLast ? (!!navOk && !!settled) : !!navOk,
     durationMs,
     result,
   };
@@ -396,6 +399,7 @@ async function main() {
       // 预导航/上下文恢复期：归因关闭（currentStepId=null），此期请求不系任何步（护栏 #15）。
       state.currentStepId = null;
       const evT0 = Date.now();
+      let reprSettled = false; // 代表步静默点结果（replay-settle-mount）：喂 historyLine 的 quietPointReached
       if (args.videoDir) vSteps.push({ stepId: ev.stepId, videoAt: Math.max(0, evT0 - videoT0) });
       let navOk = true;
       let navErr = null;
@@ -464,6 +468,26 @@ async function main() {
       }
 
       if (isLast) {
+        // 代表步采集前的有界静默点（replay-settle-mount）：镜像编译侧 quietPoint，让 SPA 路由挂载 /
+        //   「页面加载中」占位消失后再采断言输入（intentUrl/intentCount/toast/textHits/buttonHits/buttonSeen/
+        //   reply 同刻性保留）。纯观察者、有界、fail-safe：helper 自身故障照现状采、不吞步；归因此刻已关
+        //   （currentStepId=null），归因语义零动。等待计入 rhQuietWait（诚实记账，不进裁定）。
+        //   下限/预算读 REPLAY_SETTLE_FLOOR_MS/REPLAY_SETTLE_BUDGET_MS（仅测试缝，REPLAY_WATCHDOG_MS 先例，缺省 250/2500）。
+        const settleFloor = Number(process.env.REPLAY_SETTLE_FLOOR_MS);
+        const settleBudget = Number(process.env.REPLAY_SETTLE_BUDGET_MS);
+        const settleT = Date.now();
+        try {
+          const sr = await settleBeforeCapture(page, {
+            inFlight: () => forensics.inFlightCount(),
+            floorMs: Number.isFinite(settleFloor) && settleFloor >= 0 ? settleFloor : undefined,
+            budgetMs: Number.isFinite(settleBudget) && settleBudget > 0 ? settleBudget : undefined,
+            log,
+          });
+          reprSettled = sr.settled;
+          if (DBG) log('settle intent=' + ev.intentId + ' waited=' + sr.waitedMs + ' settled=' + sr.settled);
+        } catch (e) { log('settle helper error (fail-safe, capture as-is): ' + String((e && e.message) || e)); }
+        rhQuietWait += Date.now() - settleT;
+
         intentUrl.set(ev.intentId, pathOf(page.url()));
         const c = intentCount.get(ev.intentId);
         if (c) c.after = await rowCount(page, countSel);
@@ -550,7 +574,7 @@ async function main() {
       }
 
       if (rhOn) {
-        const line = historyLine(ev, { navOk, navErr, axis: ev.action === 'nav' ? null : actionByStep.get(ev.stepId), durationMs: Date.now() - evT0, caseId });
+        const line = historyLine(ev, { navOk, navErr, axis: ev.action === 'nav' ? null : actionByStep.get(ev.stepId), durationMs: Date.now() - evT0, caseId, isLast, settled: reprSettled });
         if (line) rhLines.push(line);
       }
     }
diff --git a/docs/plans/replay-settle-mount/plan.md b/docs/plans/replay-settle-mount/plan.md
new file mode 100644
index 0000000..07e228a
--- /dev/null
+++ b/docs/plans/replay-settle-mount/plan.md
@@ -0,0 +1,77 @@
+# replay-settle-mount — 回放代表步采集前有界静默点（full）
+
+> 设计评审修订（codex-sol@max，2026-07-14）：异构评审 8 findings 逐条裁处并入本文（2 HIGH 采信重设计、4 MED 采信/部分采信、1 LOW 采信、1 MED 采信），处置台账见 `review/planreview-codex.md` 与 `proposed/GRILL.md` 评审修订段。
+
+## 背景
+
+真机 `tc_wf_publish_states` 的 `intent_1`（创建工作流后断言 `buttonState` present 发布/保存）判 `NEEDS_HUMAN`（`SUT_DEFECT_OR_STALE`）、`actual=0`，但 1.5 秒后 `atstep_8` 成功唯一点中「发布」——按钮一直在，是回放侧静默点不够：click 静默窗仅 `waitForResponse` 600ms + 固定 150ms（`bin/replay.mjs` :436/:444），而创建工作流点「确认」是 SPA（单页应用）路由跳转 + 「页面加载中」异步挂载编辑器（>1s），代表步（`isLast`，:466-549）在挂载完成前采 `buttonHits` → 数 0 → 计时假阴。编译侧对称位有 `quietPoint`（`lib/compile-atoms.mjs` :203-214，DOM 连续两拍稳定、预算 2500ms）+ `networkidle` 有界前置（:725），回放侧代表步采集前没有等价静默点。决策全表见 `proposed/GRILL.md`（D1 方向 + D2 固定下限已由 Steven 2026-07-14 拍板；D3 判据构成与 M1-M9 机械决策可否决）。
+
+铁不变量（D1）：静默点纯观察者、有界；归因窗/取证因果作用域语义零动；`bin/verdict.mjs` 字节不动、`lib/replay-assert.mjs` 判定不动；超预算按现状采（fail-safe，不吞步），条件预算 ≥ 编译期同等（2500ms）。
+
+## 改动
+
+1. 新 `lib/replay-settle.mjs`：`settleBeforeCapture(page, { inFlight, floorMs = 250, budgetMs = 2500, log })` → `{ settled, waitedMs }`。流程（评审修订：拍级有界 + 判据 A 降级 + 稳定对不跨零 + 兜底条件化）：入参校验（`floorMs`/`budgetMs` 非有限非负数一律回缺省，绝不让 NaN 拖死循环）→ 先垫 `floorMs`（固定下限，D2/M1）→ 每 120ms 一拍：单拍 `page.evaluate` 采 `document.body.innerHTML.length` 且套 500ms 有界竞速（`lib/replay-forensics.mjs` :8 `withTimeout` 先例——渲染线程卡死或 `evaluate` 永不返回时该拍按不稳定计、预算循环照常复查，绝不悬死等全局看门狗）、同拍读 `inFlight()`（前台在途 API 计数；调用套 try/catch，抛错则本次静默点内判据 A 降级为不可用、退化为纯判据 B（编译侧同构），debug 记一行）→ 连续两拍长度相等且两拍均落在判据 A 归零区间内（稳定对不得跨零点：在途未归零期间的稳定拍不计入稳定对，给「应答后提交」约两拍缓冲）→ `settled: true` 放行；预算耗尽 → 仅当此刻判据 A 仍非零才走 `page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {})` 有界兜底一次（兜底职责=网络尾巴；判据 A 已归零而 DOM 仍变是动画/轮询渲染形态，`networkidle` 不识 denylist、背景轮询下注定烧满 2000ms 且无增益——直接放行）→ `settled: false` 放行（按现状采）。`evaluate` 抛错（导航中执行上下文销毁）不算稳定拍、绝不外抛（fail-safe）。
+2. `bin/replay.mjs`：`isLast` 块首（:466）接线——静默点先于该块全部代表步采集（`intentUrl`/`intentCount.after`/toast/`textHits`/`buttonHits`/`buttonSeen`/reply，同刻性保留）；接线处整体 try/catch（helper 自身故障照现状采、不吞步，等待仍计入）；`inFlight` 传 `() => forensics.inFlightCount()`；下限/预算读 `REPLAY_SETTLE_FLOOR_MS`/`REPLAY_SETTLE_BUDGET_MS`（缺省 250/2500，仅测试缝，`REPLAY_WATCHDOG_MS` 先例）；等待计入 `rhQuietWait`（回放历史诚实记账）；代表步 `historyLine` 的 `quietPointReached` 改取 `navOk && settled`（评审修订：堵「静默点超时仍记达成」的记账口径不一致——schema「false=证据可复现性存疑」正是此义；非代表步维持 `!!navOk` 既有口径；值域仍 boolean，`tests/_golden/schemas/run-history.schema.json` 文件零动、`prd-seams-freeze-v2` 冻结面不碰）；`REPLAY_DEBUG` 落 `settle intent=<id> waited=<ms> settled=<bool>` 日志行（金牌解析）。此处归因已关（`currentStepId` 为 null），归因语义零动；非代表步零新等待。
+3. `lib/replay-forensics.mjs`：返回对象加性暴露 `inFlightCount: () => inFlightApi.size`（既有键零动；denylist 背景轮询本就不进 `inFlightApi`，绝不把本步拖死）。
+4. `tests/fixtures/fake-sut/server.mjs`：+`mountdelay` 场景（M5）——`SCENARIOS` 集 +1；客户端 `renderDetail` 在该场景先渲静态占位「页面加载中」→ `fetch('/api/process/editorData')` → 应答后替换渲染编辑器（保存按钮 + 画布）；后端 +`/api/process/editorData` 路由（延迟可配：`startFakeSut({ mountDelayMs })` 仅 `mountdelay` 场景生效、缺省 800ms——评审修订，I5 须拉长到 6000ms 才真踩到超预算分支）；`mountdelay` 场景下确认按钮的「新增成功」toast 3000ms 后自动消隐（评审修订：典型消隐窗回归锁考场；既有场景 toast 常驻零行为差）。+`churn` 场景（评审修订）：详情页 DOM 每 100ms 追加变长 + 背景轮询每 300ms 一发（轮询 URL 供 denylist 配置）——I6 走时上界考场。既有场景一律同步渲染零行为差。
+5. `tests/fixtures/fake-sut/CONTRACT.md`：场景表 +`mountdelay` 行（占位→延迟挂载（可配 `mountDelayMs`）→替换 + toast 自动消隐 3000ms，回放静默点考场）、+`churn` 行（DOM 持续扰动 + 背景轮询，走时上界考场）。
+6. 新金牌 `tests/_golden/replay-settle-mount.golden.mjs`（红先行清单见下；chromium hermetic，绝不驱真机）。评审修订：金牌对 `lib/replay-settle.mjs` 一律动态 import 逐案捕获（缺模块=U 案各自红签名，绝不因顶层静态 import 整体崩掉遮蔽 I/W 案）；I/W 案不 import 该模块、直接驱 `bin/replay.mjs`/`casey run` 子进程取旧行为红签名；accept 期 U/I/W 各案红输出逐案存证。
+7. `CONTEXT.md`：「静默点」词条扩写为跨阶段通用定义（评审修订：现文限定编译期且判据描述与回放侧不一致）——通用义「采集/后检前必达的确定性有界等待条件，替代固定睡眠保可复现」+ 各期判据变体注明（编译期 DOM 连续两拍稳定；回放代表步在途请求归零 + DOM 两拍稳定，`networkidle` 仅超预算后有界兜底）。无 prd 冻结 `CONTEXT.md`，零新增重签项。
+8. accept 期：新 `loop/prd-replay-settle-mount.json`（冻新金牌 + `tests/fixtures/fake-sut/server.mjs` + `tests/fixtures/fake-sut/CONTRACT.md`）；重签 `prd-p5-replay`、`prd-replay-nth-visible-hardening`（见重签清单）。
+
+## 红先行金牌清单
+
+金牌事件（tmp 自产、`_sign-helper` 签署，wf-publish-states 金牌先例）：`atstep_0` nav 列表页（`intent_0`）→ `atstep_1` 点「新增工作流」→ `atstep_2` 填「工作流名称」→ `atstep_3` 点「确定」（`intent_1` 代表步，镜像真机事故的建流拓扑）。`intent_1` expected：`buttonState` present「保存」+ `textHidden`「页面加载中」+ `textVisible`「新增成功」（评审修订，toast 典型消隐窗回归锁）+ `urlPathname` startsWith `/ai-manager/process/detail`。
+
+- U1 静默点模块·稳定页快速放行：桩 page（长度恒定）+ 在途恒 0 → `settled: true`、`waitedMs` < 800（250 垫 + 两拍 240 + 余量）。修前红（模块不存在，动态 import 逐案捕获）。
+- U2 永不稳定 fail-safe（评审修订拆两变体）：桩 page 长度每拍递增。变体 a（在途恒 0）→ `settled: false`、不抛、`waitedMs` ≥ 预算且总耗时 < 预算+下限+余量、`networkidle` 桩不被调用（判据 A 已归零、兜底条件化跳过）；变体 b（在途恒 1）→ `networkidle` 桩被调用且带有限 `timeout`（绝不无限等）、总耗时有界。修前红。
+- U3 固定下限可调：`floorMs: 300` 稳定页 → `waitedMs` ≥ 300；`floorMs: 0` → `waitedMs` < 300（垫是垫、条件是条件）。修前红。
+- U4 `evaluate` 抛错（导航中上下文销毁）：不外抛、照放行（`settled: false` 或后续拍恢复）。修前红。
+- U5 `evaluate` 永不返回（评审修订新增）：桩 `evaluate` 回永不 resolve 的 Promise → 每拍 500ms 竞速兜住、预算循环照常复查 → `settled: false`、不抛、总耗时 < 预算+单拍竞速+余量（硬时间上界，绝不悬死等看门狗）。修前红。
+- U6 `inFlight()` 抛错（评审修订新增）：桩每次调用即抛 + 稳定页 → 不外抛、判据 A 降级、纯判据 B 照常 `settled: true`。修前红。
+- U7 稳定对不跨零点（评审修订新增）：脚本化桩序列（在途 1,1,0,0…、DOM 长度全程恒定）→ 放行时刻必在第二个归零拍之后（占位期的陈稳定拍不计入稳定对，「应答后提交」拿到约两拍缓冲）。修前红。
+- I1 延迟挂载主案（红先行核心）：`mountdelay` 回放上述事件 → 修前 `buttonState` present「保存」`ok: false`/`actual: 0`（真机事故同签名）、`textHidden`「页面加载中」`ok: false`（占位在场被采到）；修后两者 `ok: true`、`buttonState` `actual` ≥ 1，且 `textVisible`「新增成功」`ok: true`（采集延后约 1s 仍落在 3000ms 典型消隐窗内——延采不丢典型 toast 的回归锁，评审修订）。
+- I2 垫调 0 条件兜住（D2 金牌要求）：同 I1 且 `REPLAY_SETTLE_FLOOR_MS=0` → 修后仍全绿——延迟挂载靠条件（在途请求归零 + 两拍稳定）而非靠垫等到，不得靠加大固定值凑绿。修前红。
+- I3 即时渲染回归锁（冻结时即绿）：`happy` 场景同事件 + `buttonState` present「保存」→ 全绿；`REPLAY_DEBUG` 解析 settle 行：`waited` < 1500ms 且 `settled: true`（早退，不烧满预算——固定下限不显著拖慢）；`--run-history` 代表步行 `quietPointReached: true`（评审修订）。
+- I4 观察者不是许愿机（冻结时即绿）：`mountdelay` + `buttonState` present「幽灵导出」（页面从不出现）→ 修前修后都 `ok: false`/`actual: 0`，且 settle 行 `settled: true`（DOM 稳定即放行采集，静默点绝不承担「等到断言为真」——期望驱动轮询是倒着裁）。
+- I5 超预算照采 fail-safe（冻结时即绿；评审修订整案重设计——原设计缺省 800ms 延迟下挂载在 `networkidle` 兜底窗内完成、`actual` 必 ≥1 与预期矛盾，HIGH 采信）：`mountdelay` 且 `mountDelayMs: 6000` + `REPLAY_SETTLE_BUDGET_MS=100` → 预算耗尽时判据 A 仍在途 → `networkidle` 兜底 2000ms 超时放行 → 采集时刻（约 2.6s）远早于挂载（6s）→ `replay` exit 0、axes 落盘、`buttonState` `ok: false`/`actual: 0`（超预算按现状采，不因静默点报错吞步）；`--run-history` 代表步行 `quietPointReached: false`（超时如实记账，schema「false=证据可复现性存疑」口径一致）。
+- I6 扰动走时上界回归锁（冻结时即绿，评审修订新增）：`churn` 场景（DOM 每 100ms 变长 + 背景轮询 300ms 一发、轮询 URL 入 denylist）→ `replay` exit 0、settle 行 `settled: false`、`waited` < 4000ms（预期约 250 垫 + 2500 预算；判据 A 归零故兜底跳过——`networkidle` 不识 denylist 的 2000ms 燃烧被条件化堵死）；单代表步最坏走时有上界、绝不靠 `REPLAY_WATCHDOG_MS`（120s）收尸。
+- W1 端到端裁定翻正：`casey run` 对 `mountdelay`（缺省 800ms 延迟）→ 修前 `intent_1` 判 `NEEDS_HUMAN`（真机事故端到端同构复现，红）；修后 `intent_1` PASS + 报告三件（html/md/json）落盘——`bin/verdict.mjs` 零改动前提下由采集时机修正翻正。
+
+## touchesFiles
+
+- `docs/plans/replay-settle-mount/proposed/GRILL.md`（本阶段）
+- `docs/plans/replay-settle-mount/plan.md`（本阶段）
+- `lib/replay-settle.mjs`（新，实现）
+- `bin/replay.mjs`（实现接线）
+- `lib/replay-forensics.mjs`（加性 `inFlightCount`）
+- `tests/fixtures/fake-sut/server.mjs`（+`mountdelay`/`churn` 场景）
+- `tests/fixtures/fake-sut/CONTRACT.md`（场景表 +2 行）
+- `CONTEXT.md`（「静默点」词条扩写为跨阶段通用定义，评审修订）
+- `tests/_golden/replay-settle-mount.golden.mjs`（新金牌）
+- `loop/prd-replay-settle-mount.json`（新，accept）
+- `loop/prd-p5-replay.json`（重签 sha256）
+- `loop/prd-replay-nth-visible-hardening.json`（重签 sha256）
+- `loop/active-contract.json`（阶段推进台账）
+
+## 重签清单（accept 期执行，一个不漏）
+
+| prd | 冻结面命中 | 动作 |
+|---|---|---|
+| `loop/prd-p5-replay.json` | `tests/fixtures/fake-sut/server.mjs` + `tests/fixtures/fake-sut/CONTRACT.md` | 两条 sha256 重签 → `gate --prd loop/prd-p5-replay.json` 复验 GREEN |
+| `loop/prd-replay-nth-visible-hardening.json` | `tests/fixtures/fake-sut/server.mjs` | 一条 sha256 重签 → gate 复验 GREEN |
+
+全仓 prd 反向核对已做（70 份 `testChecksums` 遍历）：冻 `fake-sut` 两件的仅上述两份；`bin/replay.mjs`/`lib/replay-forensics.mjs`/`lib/replay-assert.mjs` 无任何 prd 冻结；`tests/fixtures/publish-sut/server.mjs` 本契约不碰（`prd-wf-publish-states`/`prd-wf-history-version` 不重签）。评审修订补核：根 `CONTEXT.md` 无 prd 冻结（`prd-loop-kit-extract` 冻的是 fixture 内同名文件，路径不同）——词条扩写零新增重签；`tests/_golden/schemas/run-history.schema.json` 被 `prd-seams-freeze-v2` 冻结——本契约只改 `quietPointReached` 的取值来源、schema 文件字节不动，不触发重签。
+
+## 非目标
+
+`bin/verdict.mjs` 与 `lib/replay-assert.mjs` 任何改动；axes/observed/expected schema 新键；编译侧 `quietPoint` 改动；按断言粒度的期望驱动轮询（Playwright 自动重试断言那型——破同刻性、方向性倒裁）；加载占位词表判（挂账，真机复验若现 script/chunk 型延迟挂载再议）；「响应结束后 UI 延迟提交」形态的判据扩展（评审修订部分采信：超过约两拍缓冲（约 240ms）的延迟提交是已挂账盲区，失败方向 fail-safe 假红绝非假绿，已确证真机形态（请求驱动 + 应答即提交）I1 已覆盖——判据侧「必须看到归零后 DOM 变化」会假定「应答必改 DOM」、在应答不改 DOM 的页面上烧满预算，恶化最坏走时，本轮不做，见 GRILL D3 残余）；`innerHTML.length` 等长内容变化的碰撞边界（镜像编译侧同判据保持对称，失败方向同上，落账不改判据）；toast 双采快照（挂账观察）；真机驱动（复验停站另账，本契约全程 fake-sut hermetic）。
+
+## 验收
+
+1. 新金牌全绿；实现前红案齐：U1-U7（模块缺失，动态 import 逐案红签名）、I1（`actual=0` 真机同签名）、I2（垫零）、W1（`NEEDS_HUMAN` 端到端复现）——accept 期 `--red-verified` 凭此、各案红输出逐案存证；I3/I4/I5/I6 冻结时即绿（回归保护，wf-publish-states I0 先例）。
+2. 重签两 prd gate 复验 GREEN；`prd-replay-settle-mount` gate GREEN。
+3. 回归零行为差（评审修订：范围收窄为 hermetic 门禁可证面）：全仓 ratchet 零红 + `casey selftest --tier1` GREEN；受影响金牌族原样绿（`p5-replay`/`p5-replay-coverage`/`replay-nth-visible-hardening`/`kinds-harden`/`chiefcomplaint-smoke`/`chief-bringup`/`login-traffic-drop`/`wf-publish-states`/`wf-history-version`/`btn-enable-ops`/wf 画布族/`replay-video`/`video-login-carry`/`replay-login-bootstrap`/`run-history`/`layer3-wiring`/`e2e-chain`）。真机 toast 消隐窗时序上浮是已挂账残余（GRILL）、门禁不可证——I1 以 3000ms 典型窗钉「延采不丢典型 toast」，真机复验停站观察。
+4. 不变量核查：`git diff` 证 `bin/verdict.mjs`、`lib/replay-assert.mjs` 零改动；axes/observed schema 零新键（`run-history.schema.json` 文件字节不动）；静默点等待全程 `currentStepId` 为 null（归因零动）。
+5. 走时上浮有界：I3 的 settle 行 `waited` < 1500ms（即时渲染不显著拖慢）；I6 钉扰动最坏上界（`waited` < 4000ms，兜底条件化生效）；单代表步最坏 ≈ 250 垫 + 2500 预算 +（仅判据 A 未归零时）2000 兜底 ≈ 4.75s，代表步=每 intent 一步、常规用例 intent 数十以内不逼近 `REPLAY_WATCHDOG_MS`（120s）；gate 后台跑轮询收。
+6. 记账口径一致：I5 代表步行 `quietPointReached: false`、I3 为 `true`——静默点超时绝不记成达成。
diff --git a/docs/plans/replay-settle-mount/proposed/GRILL.md b/docs/plans/replay-settle-mount/proposed/GRILL.md
new file mode 100644
index 0000000..d539464
--- /dev/null
+++ b/docs/plans/replay-settle-mount/proposed/GRILL.md
@@ -0,0 +1,70 @@
+# GRILL — replay-settle-mount（full，2026-07-14）
+
+授权：Steven 2026-07-14 主会话点「修」，真机证据在案——`tc_wf_publish_states` 的 `intent_1`（创建工作流后断言 `buttonState` present 发布/保存）判 `NEEDS_HUMAN`（`SUT_DEFECT_OR_STALE`）、`actual=0`，而 1.5 秒后 `atstep_8` 成功唯一点中「发布」按钮——按钮一直在，是回放侧代表步采集抢在 SPA（单页应用）编辑器挂载完成之前。修法方向与小固定下限（200-300ms 区间）均已主会话拍板；本 GRILL 落决策台账 + 规划者机械决策（可否决）。
+
+## 根因（主会话勘定，编译回放两侧不对称）
+
+- 编译侧 `lib/compile-atoms.mjs`：每步动作后走 `quietPoint`（:203-214，DOM 连续两拍稳定、预算 2500ms、120ms 一拍）才 `capture` 采观测；个别原子另有 `networkidle` 5s 有界前置（:725，catch 兜底）。编译期「发布/保存在场」正是在这个静默点之后被采到并人签的。
+- 回放侧 `bin/replay.mjs`：click 动作的静默窗只有 `waitForResponse` 600ms（:436）+ 固定 150ms（:444）+ 对话流才有的流等待（:452-460）；代表步（`isLast`，:466-549）随即采 `intentUrl`/`intentCount`/toast/`textHits`/`buttonHits`/`buttonSeen`/reply。创建工作流点「确认」是 SPA 路由跳转 + 「页面加载中」异步挂载编辑器（>1s），约 750ms 窗口早结束 → 挂载完成前采 `buttonState` → 数 0 → 计时假阴。
+- 裁定与断言评估都没错：`bin/verdict.mjs` 与 `lib/replay-assert.mjs` 拿到的就是「采集时刻的事实」，错在采集时机。
+
+## D1 修法方向（已拍板，勿改大方向）
+
+回放侧在代表步采集断言输入之前，补一个有界静默点，镜像编译侧 `quietPoint`。铁不变量：
+
+1. 静默点纯观察者、有界（预算上界；SPA 背景轮询下 `networkidle` 可能永不达成——照编译侧 catch 兜底，绝不无限等）；
+2. 绝不改归因窗/取证因果作用域语义（`attributedStepId` 逻辑零动；静默点跑在归因已关之后，`currentStepId` 此刻为 null）、绝不把背景轮询拖进本步；
+3. `bin/verdict.mjs` 字节不动；`lib/replay-assert.mjs` 判定逻辑不动（只让采集时机对）；
+4. 缺失/超时 fail-safe：静默点超预算就按现状采（不因静默点本身报错吞步），且至少给到编译期同等的稳定预算（条件预算 ≥2500ms，对齐 `quietPoint`）。
+
+## D2 小固定下限（Steven 2026-07-14 批准并入；具体值由 plan 定）
+
+条件轮询开始前垫一个小的固定下限，给 SPA 路由切换的首帧渲染一点起步窗，避免条件判据在动作刚落一拍就抢采旧 DOM 的假稳定。定位明确：这是条件式静默点的前置固定下限，不是每步一律睡几秒；其后仍由条件（在途请求归零 + DOM 两拍稳定）决定何时放行；固定下限绝不承担「等到按钮出现」的职责（那是条件的活）。金牌须钉两向：即时渲染场景不显著拖慢（回归锁）；延迟挂载场景靠条件而非靠垫等到（垫调 0 仍须条件兜住、不得靠加大固定值凑绿）。取值见 M1：250ms。
+
+## D3 静默判据构成（规划者定，Steven 可否决）
+
+为什么纯「DOM 连续两拍稳定」不够：真机形态是「页面加载中」静态占位先渲、编辑器后挂——占位期 DOM 静止不变，两拍判据会在占位上早退报「稳定」，采集仍抢在挂载前（垫调 0 时金牌必红，D2 的金牌要求逼出这一步）。故复合判据为：
+
+- 判据 A（新增，纯观察）：前台在途 API 归零——复用 `watchNetworkForensics` 已有的 `inFlightApi` 集合（`lib/replay-forensics.mjs` :16/:27：只收 XHR/Fetch，denylist 背景轮询天然除外）。真机编辑器挂载由详情数据请求驱动，「页面加载中」正是这类请求的等待态；请求在途 = 还没到静默点。背景轮询在 denylist 内，绝不把本步拖死。
+- 判据 B（镜像编译侧）：DOM 连续两拍稳定（`document.body.innerHTML.length` 两拍相等、120ms 一拍，逐字镜像 `quietPoint` 判据）。
+- 复合流程：固定下限（M1）先垫 → 轮询循环内每拍同测 A+B，连续两拍 B 相等且两拍 A 归零即放行；预算 2500ms（对齐编译侧）耗尽 → `networkidle` 有界兜底一次（2000ms、catch 吞超时，编译侧 :725 先例；带背景轮询的 SUT 到不了就超时放行）→ 按现状采。
+- 反方向铁则：判据绝不读 expected——静默点不知道要断什么按钮，只看「页面自己说还没稳」（在途请求 / DOM 还在变）。「等到断言为真」那种期望驱动轮询是倒着裁，金牌 I4 钉死此界。
+
+残余（记 observability，真机复验停站观察）：script/chunk 类型的延迟挂载（JS 分包加载）不进 `inFlightApi`（只收 XHR/Fetch），而 `networkidle` 兜底对带背景轮询的真机不可达——此形态若真机出现，按 fail-safe 落 `NEEDS_HUMAN`（假阴方向，绝非假绿），届时再议加法（如加载占位词表判，需人签词表；本轮不做——在途请求判据已覆盖已知真机形态）。
+
+## 机械决策（可否决，未否决即生效）
+
+- M1 固定下限 250ms：Steven 批准区间 200-300 的中点；编译侧 click 后 150ms 出现窗 + `quietPoint` 首拍 120ms 的等效起点约 270ms，回放取 250 近似对称；兼顾低配 WSL/DrvFs 环境首帧余量。稳定页每代表步总开销约 0.5s（250 垫 + 两拍约 240），回归锁金牌钉上界。
+- M2 插入点：`bin/replay.mjs` `isLast` 块首（:466），先于该块全部采集（`intentUrl`/`intentCount.after`/toast/`textHits`/`buttonHits`/`buttonSeen`/reply）——断言输入仍是同一静默点后同一时刻的快照（同刻性保留，`buttonSeen` 活性反证的同刻语义不破）。只代表步走静默点，非代表步零新等待（动作因果作用域 600+150ms 语义零动）；代表步不分动作类型（nav 代表步同样走，`goto` 已 `waitUntil: load`，稳定页开销可忽略）。
+- M3 实现落 `lib/replay-settle.mjs`（新文件，纯函数：吃 page 型对象 + 在途计数函数 + 下限/预算，回 `{ settled, waitedMs }`）——单元金牌用桩验预算/下限/fail-safe，不开浏览器；`bin/replay.mjs` 接线传 `() => forensics.inFlightCount()`。`lib/replay-forensics.mjs` 返回对象加性暴露 `inFlightCount()`（既有键零动，无金牌钉其键集）。
+- M4 测试缝两枚环境变量（`REPLAY_WATCHDOG_MS` 先例，缺省值一字不变）：`REPLAY_SETTLE_FLOOR_MS`（缺省 250；金牌调 0 证「条件兜住不靠垫」）、`REPLAY_SETTLE_BUDGET_MS`（缺省 2500；金牌调小证「超预算照采不吞步」）。
+- M5 夹具场景 `mountdelay`（fake-sut 加法）：`/ai-manager/process/detail` 先渲静态占位「页面加载中」→ 发 `fetch('/api/process/editorData')`（服务端延迟 800ms 应答）→ 应答后替换渲染编辑器（保存按钮 + 画布）。复现真机接缝（数据请求驱动挂载 + 静态占位），不是顺着判据裁夹具——静态占位正是纯两拍判据的反例考场。既有场景一律同步渲染零行为差（`wf-open-smoke` 可点行名加法先例）。
+- M6 观测记账：静默等待计入 `rhQuietWait`（回放历史诚实记账，不进裁定，护栏 #15 不变）；`REPLAY_DEBUG` 下输出 settle 日志行（waited/settled），金牌解析用。axes/observed schema 零新键（`additionalProperties:false` 冻结面不动）。
+- M7 金牌 `tests/_golden/replay-settle-mount.golden.mjs`（红先行清单见 plan）；chromium hermetic，全程 fake-sut，绝不驱真机。
+- M8 重签清单：动 `tests/fixtures/fake-sut/server.mjs`（+ 同目录 `CONTRACT.md` 场景表）→ `prd-p5-replay`（冻两件）与 `prd-replay-nth-visible-hardening`（冻 `server.mjs`）sha256 重签 + 各自 gate 复验 GREEN（wf-publish-states 重签 `prd-seams-freeze` 先例）。
+- M9 术语零新造：「静默点」「代表步」「通道剖面」CONTEXT.md 已注册；「固定下限」「在途请求」是描述短语非新术语；`mountdelay` 是夹具场景代码标识符。
+
+## 残余风险与挂账
+
+- 真机 toast 自动消隐 vs 采样延后约 0.5s：toast 通道断言理论上更接近消隐窗——失败方向是假红（`NEEDS_HUMAN`）非假绿；hermetic 夹具 toast 不消隐零影响；真机复验停站观察，频发再议（如 toast 移静默点前后双采快照的加法）。
+- 全量金牌走时上浮：每代表步约 +0.5s（稳定页），全仓 ratchet 预计上浮数十秒——gate 后台跑轮询收（既有纪律）。
+- script/chunk 型延迟挂载盲区：见 D3 残余。
+
+## 冻结涟漪盘点（accept 红先行逐核）
+
+- `tests/fixtures/fake-sut/server.mjs`：+`mountdelay`（`SCENARIOS` 集 + 客户端 `renderDetail` 分支 + 后端 `/api/process/editorData` 路由）+`churn`（评审修订）——冻它的 `prd-p5-replay`、`prd-replay-nth-visible-hardening` 重签。
+- `tests/fixtures/fake-sut/CONTRACT.md`：场景表 +1 行——`prd-p5-replay` 冻它，随上重签。
+- 消费 fake-sut 的其余金牌（wf-open-node 族、wf-add-node、wf-connect-nodes、wf-open-smoke、kinds-harden、layer3-wiring、run-history、replay-video 等）不冻 `server.mjs`，无需重签；loop 期全量回归证零行为差。
+- `bin/replay.mjs`、`lib/replay-forensics.mjs`、新 `lib/replay-settle.mjs` 均为实现文件，无 prd 冻结。
+- axes/observed/expected schema 零动（M6）；`lib/replay-assert.mjs`、`bin/verdict.mjs` 零字节动（D1 铁不变量）。
+
+## 设计评审修订（codex-sol@max，2026-07-14；8 findings 裁处，plan.md 已同步）
+
+- 拍级硬上界（HIGH 采信，修 D1/M3 落法）：单拍 `page.evaluate` 套 500ms 有界竞速（`lib/replay-forensics.mjs` :8 `withTimeout` 先例）——`evaluate` 永不返回时该拍按不稳定计、预算循环照常复查；`inFlight()` 调用套 try/catch，抛错则判据 A 降级、退化纯判据 B（编译侧同构）；入参非有限非负数回缺省。金牌 +U5（永不返回）/+U6（`inFlight` 抛错）钉死。
+- I5 整案重设计（HIGH 采信）：原设计缺省 800ms 挂载延迟在 `networkidle` 兜底窗内必完成、`actual` 必 ≥1，证不出「超预算照现状采」——夹具挂载延迟改可配（`mountDelayMs`，缺省 800），I5 用 6000ms 拉开采集时刻（约 2.6s）与挂载（6s）的差距。
+- 兜底条件化（MED 采信，修 D3 复合流程）：预算耗尽时仅判据 A 仍非零才走 `networkidle` 有界兜底（职责=网络尾巴）；判据 A 已归零的 DOM 扰动形态直接放行——`networkidle` 不识 Casey denylist、背景轮询下必烧满 2000ms 且无增益，条件化把扰动最坏走时从约 4.75s 压回约 2.75s。金牌 +I6（`churn` 场景走时上界回归锁）。
+- D3 残余追加两条（MED 部分采信，落账不改判据）：①「响应结束→UI 延迟提交」形态——判据 A 在 `loadingFinished` 即归零（`lib/replay-forensics.mjs` :56），提交延迟超过稳定对约两拍缓冲（约 240ms，「稳定对不跨零点」规则给足，金牌 +U7 钉）则在占位上放行；失败方向假红（`NEEDS_HUMAN`）绝非假绿，已确证真机形态（应答即提交）I1 已覆盖，判据侧扩展会假定「应答必改 DOM」恶化最坏走时，词表判照旧挂账。②`innerHTML.length` 等长内容变化误判稳定——镜像编译侧同判据保持对称，失败方向同上。
+- 记账口径（MED 采信，修 M6）：代表步 `historyLine` 的 `quietPointReached` 接线 settle 结果（`navOk && settled`），超时如实记 `false`（schema「false=证据可复现性存疑」口径一致）；非代表步维持既有口径；schema 文件字节不动（`prd-seams-freeze-v2` 冻结面不碰）。
+- M9 更正（MED 采信）：「静默点」词条现文限定编译期、判据描述与回放侧新机制不一致——扩写为跨阶段通用定义 + 各期判据变体，`CONTEXT.md` 入 touchesFiles（无 prd 冻结、零新增重签）。
+- toast 消隐窗（MED 采信，收窄验收措辞）：`mountdelay` 场景 toast 3000ms 自动消隐 + I1 加 `textVisible`「新增成功」典型窗回归锁（延采约 1s 不丢典型 toast）；验收「回归零行为差」范围收窄为 hermetic 门禁可证面，真机消隐窗时序照旧挂账停站观察。
+- 金牌遮蔽（LOW 采信）：金牌对 `lib/replay-settle.mjs` 动态 import 逐案捕获，I/W 案不 import 该模块、驱子进程取旧行为红签名；accept 期红输出逐案存证。
diff --git a/docs/plans/replay-settle-mount/proposed/red/red-before-impl.txt b/docs/plans/replay-settle-mount/proposed/red/red-before-impl.txt
new file mode 100644
index 0000000..d2467ba
--- /dev/null
+++ b/docs/plans/replay-settle-mount/proposed/red/red-before-impl.txt
@@ -0,0 +1,16 @@
+RED  replay-settle-mount: U1 稳定页快速放行：settled true、waitedMs<800（floor 250 + 两拍约 240 + 余量）: Cannot find module '/mnt/d/ctx/heren/casey-replay-settle-mount/lib/replay-settle.mjs' imported from /mnt/d/ctx/heren/casey-replay-settle-mount/tests/_golden/replay-settle-mount.golden.mjs
+RED  replay-settle-mount: U2a 永不稳定 + 在途恒 0：settled false、不抛、waitedMs≥预算、networkidle 桩不被调（兜底条件化跳过）: Cannot find module '/mnt/d/ctx/heren/casey-replay-settle-mount/lib/replay-settle.mjs' imported from /mnt/d/ctx/heren/casey-replay-settle-mount/tests/_golden/replay-settle-mount.golden.mjs
+RED  replay-settle-mount: U2b 永不稳定 + 在途恒 1：networkidle 桩被调且带有限 timeout（绝不无限等）、总耗时有界: Cannot find module '/mnt/d/ctx/heren/casey-replay-settle-mount/lib/replay-settle.mjs' imported from /mnt/d/ctx/heren/casey-replay-settle-mount/tests/_golden/replay-settle-mount.golden.mjs
+RED  replay-settle-mount: U3 固定下限可调：floorMs 300 → waitedMs≥300；floorMs 0 → waitedMs<300（垫是垫、条件是条件）: Cannot find module '/mnt/d/ctx/heren/casey-replay-settle-mount/lib/replay-settle.mjs' imported from /mnt/d/ctx/heren/casey-replay-settle-mount/tests/_golden/replay-settle-mount.golden.mjs
+RED  replay-settle-mount: U4 evaluate 抛错（导航中上下文销毁）：不外抛、照放行（settled false）: Cannot find module '/mnt/d/ctx/heren/casey-replay-settle-mount/lib/replay-settle.mjs' imported from /mnt/d/ctx/heren/casey-replay-settle-mount/tests/_golden/replay-settle-mount.golden.mjs
+RED  replay-settle-mount: U5 evaluate 永不返回：每拍 500ms 竞速兜住、预算循环照常复查、settled false、总耗时硬上界: Cannot find module '/mnt/d/ctx/heren/casey-replay-settle-mount/lib/replay-settle.mjs' imported from /mnt/d/ctx/heren/casey-replay-settle-mount/tests/_golden/replay-settle-mount.golden.mjs
+RED  replay-settle-mount: U6 inFlight() 抛错：不外抛、判据 A 降级、纯判据 B 照常 settled true: Cannot find module '/mnt/d/ctx/heren/casey-replay-settle-mount/lib/replay-settle.mjs' imported from /mnt/d/ctx/heren/casey-replay-settle-mount/tests/_golden/replay-settle-mount.golden.mjs
+RED  replay-settle-mount: U7 稳定对不跨零点：在途 1,1,0,0 + DOM 恒定 → 放行必在第二个归零拍之后（占位陈稳定不计入稳定对）: Cannot find module '/mnt/d/ctx/heren/casey-replay-settle-mount/lib/replay-settle.mjs' imported from /mnt/d/ctx/heren/casey-replay-settle-mount/tests/_golden/replay-settle-mount.golden.mjs
+RED  replay-settle-mount: I1 延迟挂载主案（红先行核心）：mountdelay 采集延后至挂载后 → buttonState present 保存 ok:true/actual≥1、textHidden 页面加载中 ok:true、textVisible 新增成功 ok:true: buttonState present 保存 应 ok:true/actual≥1（挂载后采到），实际 false/0（真机事故同签名 actual=0=红）
+RED  replay-settle-mount: I2 垫调 0 条件兜住：mountdelay + REPLAY_SETTLE_FLOOR_MS=0 → 修后仍全绿（延迟挂载靠条件而非靠垫、不得加大固定值凑绿）: floor=0 时 buttonState present 保存 仍应 ok:true/actual≥1（静态占位期在途 fetch 撑住判据 A），实际 false/0
+RED  replay-settle-mount: I3 即时渲染回归锁（冻结时即绿）：happy 同事件全绿 + settle 行 waited<1500 且 settled:true + 代表步 quietPointReached:true（固定下限不显著拖慢、不烧满预算）: REPLAY_DEBUG 应落 settle 日志行（settle intent=intent_1 waited=.. settled=..）
+RED  replay-settle-mount: I4 观察者不是许愿机（冻结时即绿）：mountdelay + buttonState present 幽灵导出（从不出现）→ 修后 ok:false/actual:0 且 settle settled:true（DOM 稳定即放行，绝不承担「等到断言为真」）: settle 应 settled:true（DOM 稳定即放行、不为幽灵按钮空等），实际 null
+RED  replay-settle-mount: I5 超预算照采 fail-safe（冻结时即绿）：mountDelayMs 6000 + REPLAY_SETTLE_BUDGET_MS=100 → replay exit 0、axes 落盘、buttonState 如实红（ok:false/actual:0）、代表步 quietPointReached:false: 超预算 settle 应 settled:false，实际 null
+RED  replay-settle-mount: I6 扰动走时上界回归锁（冻结时即绿）：churn 场景 → replay exit 0、settle settled:false、waited<4000（判据 A 归零故 networkidle 兜底跳过、绝不靠 REPLAY_WATCHDOG_MS 收尸）: churn（DOM 永不稳定）应 settled:false，实际 null
+RED  replay-settle-mount: W1 端到端裁定翻正：casey run 对 mountdelay → intent_1 PASS + 报告三件落盘（verdict.mjs 零改动前提下纯靠采集时机修正翻正）: intent_1 应 PASS（真机事故端到端翻正），实际 NEEDS_HUMAN（reason=SUT_DEFECT_OR_STALE）
+RED  replay-settle-mount: 0 过 / 15 红
diff --git a/docs/plans/replay-settle-mount/review/planreview-codex.md b/docs/plans/replay-settle-mount/review/planreview-codex.md
new file mode 100644
index 0000000..16feccb
--- /dev/null
+++ b/docs/plans/replay-settle-mount/review/planreview-codex.md
@@ -0,0 +1,105 @@
+# replay-settle-mount plan 阶段异构设计评审（codex）
+
+## 评审元信息
+
+- 契约：`replay-settle-mount`（lane `full`），评审对象 = `plan.md` + `proposed/GRILL.md`（实现前，工作树内尚无 `lib/replay-settle.mjs`/新金牌 `tests/_golden/replay-settle-mount.golden.mjs`/新 prd `loop/prd-replay-settle-mount.json`，`git status --short` 确认评审前后除既有 `docs/plans/replay-settle-mount/`、`node_modules` 外零改动）。
+- 评审者：`gpt-5.6-sol`（codex-cli 0.144.1），`reasoning effort=medium`，`sandbox=read-only`，`--skip-git-repo-check`，工作目录 `/mnt/d/ctx/heren/casey-replay-settle-mount`。session id `019f60d8-9ae7-7b92-bf8a-f474743d55db`。
+- 效力值口径更正：任务指令原写「codex 开 `fast`」，实测 `-c model_reasoning_effort=fast` 被 API 拒绝（`invalid_enum_value`，该 codex-cli/模型的合法枚举为 `none|minimal|low|medium|high|xhigh`，无 `fast` 档）。已就地改用最接近「强度不减、出得快」意图的 `medium`（居中档，非最低档 `low`/`minimal`），驱动员按现场事实纠偏，未静默按原指令硬跑导致整轮失败；此更正已如实计入下方 audit 记录，供指令方核对是否需另行拍板具体档位。
+- 家族：codex（评审家族 ≠实现家族 Claude，符合异构评审铁律）。
+- 评审料：`docs/plans/replay-settle-mount/review/planreview-material.md`（根因段 + 关键裁量 + plan.md 全文 + GRILL.md 全文 + 相关既有代码摘录（`bin/replay.mjs`/`lib/compile-atoms.mjs`/`lib/replay-forensics.mjs`/CONTEXT.md 静默点词条，均标注 read-only 背景）+ 评审指令；不含凭据、不含真机地址）；经核对，评审料内嵌的 `plan.md` 全文与工作树当前 `plan.md` 字节级一致（评审对象即当前版本，非过期快照）。
+- 用量：`tokens used 110,591`。
+- 结论：**非 PASS**（2 HIGH / 4 MED / 1 LOW），建议在 accept/build 前修订 plan 与 GRILL。
+
+---
+
+## 评审原文（verbatim，未改一字）
+
+结论：非 PASS。当前设计有 2 个 HIGH，建议在 accept/build 前修订 plan 与 GRILL。
+
+## HIGH
+
+1. HIGH — D1 / M3 / M4 / M7：静默点没有真正封死硬时间上界
+
+设计只给轮询预算和 `networkidle` 配了超时，但单次 `page.evaluate()` 没有超时；若渲染线程卡死或桩返回永不 resolve 的 Promise，循环预算无法重新检查，只能等全局 120 秒看门狗杀进程，不能按 D1 要求"超预算后照现状采"。此外，`inFlight()` 抛错也未被设计为吞掉，可能直接中断回放。仓内网络取证已有 `Promise.race` 超时先例：`lib/replay-forensics.mjs:7`，但新 helper 设计未采用。`plan.md:11` 只覆盖 `evaluate`"抛错"，U2/U4 也没有"永不返回"与 `inFlight()` 抛错用例。
+
+建议：
+
+- 用绝对 deadline 约束每个 await，包括 floor、evaluate、轮询和 fallback；
+- 校验 `floorMs`/`budgetMs` 必须是有限非负数；
+- helper 内或接线处设总 catch，确保自身故障仍采现状；
+- 加 `evaluate` 永不 resolve、`inFlight()` 抛错、总耗时上界三枚测试。
+
+2. HIGH — D1 / M4 / M5 / M7：I5 与既定流程矛盾，修后大概率无法满足
+
+I5 设置条件预算 100ms，却保留 250ms floor 和随后 2000ms `networkidle` fallback；`mountdelay` 的请求只延迟 800ms。`plan.md:14` `plan.md:31`
+
+典型时序是：
+
+- 原有 save 响应完成，再等 150ms；
+- floor 250ms；
+- 条件预算约 100ms 耗尽；
+- 进入最长 2000ms 的 `networkidle`；
+- 800ms 的 editorData 请求在 fallback 内完成，页面挂载；
+- 最终采到「保存」，断言变成 true，而 I5 要求 `actual:0`。
+
+因此 I5 不能证明"超预算照现状采"，还会阻止新金牌全绿。应改成独立超时场景：floor=0，挂载延迟明确大于"条件预算 + 2000ms fallback + networkidle 静默窗"，或让请求保持在途直到 fallback 超时，然后断言 axes 仍落盘且采到占位现状。
+
+## MED
+
+3. MED — D3 / M5 / M7：A+B 没覆盖"请求结束后、UI 延迟提交"的 SPA 形态
+
+`inFlightApi` 在 CDP `loadingFinished` 时删除：`lib/replay-forensics.mjs:53`。如果响应已经结束，但框架在 300ms 后才提交编辑器，A 已归零，静态占位 DOM 两拍相等，静默点会在编辑器挂载前错误返回 `settled:true`。
+
+现有 `mountdelay` 是"应答后立即替换 DOM"，只证明等待网络请求，未证明等待实际挂载。`GRILL.md:41`
+
+建议增加"响应完成 → 延迟 300–500ms → DOM 替换"的反例。可考虑：若本轮观察到在途请求，则必须看到请求归零后的 DOM 变化，再等待其稳定；仍不读取 expected。
+
+4. MED — D3 / M1 / M7：背景动画/轮询的最坏走时没有集成回归锁
+
+持续改变 DOM 长度会烧满 2500ms；即使轮询 URL 在 Casey denylist 内，Playwright 的 `networkidle` 并不知道该 denylist，仍可能再耗满 2000ms。单代表步最坏约 4.75–4.9 秒，约 25 个代表步就可能撞 120 秒全局看门狗。反之，内容变化但 `innerHTML.length` 不变又可能被误认稳定。
+
+I3 只测静态 `happy`，`waited < 1500ms` 不能回答该风险。`plan.md:29`
+
+应补一个带持续 DOM 扰动和 denylisted 轮询的浏览器用例，钉总耗时上界、正常 exit 和 `settled:false`；并明确这是接受的逐代表步最坏成本还是需要进一步限流。
+
+5. MED — M6：回放历史会把静默点超时错误记成成功
+
+计划只把等待时间计入 `rhQuietWait` 并打 debug 日志，但现有 `quietPointReached` 固定取 `!!navOk`：`replay.mjs:111`。因此新 helper 返回 `settled:false` 时，回放历史和报告仍显示静默点 ✓，与 schema 的"false = 证据可复现性存疑"冲突：`tests/_golden/schemas/run-history.schema.json:126`。
+
+应把代表步的 settle 结果传入 `historyLine`，并加超时后 `quietPointReached:false` 的金牌；或者明确拆分旧字段和新机制，不能仅靠 debug 日志维持事实口径。
+
+6. MED — M9：统一语言定义确实走样
+
+`CONTEXT.md` 把"静默点"限定为"编译期"，且定义包含 `networkidle + 无动画 + DOM 稳定 K ms`：`CONTEXT.md:151`。新机制用于回放期，没有无动画判据，`networkidle` 也只是超时后的 fallback。M9 因"已经登记"而判零新造并不成立。
+
+应把词条改成跨编译/回放通用定义，并说明各阶段允许的确定性判据变体；把 `CONTEXT.md` 加入 `touchesFiles`。当前没有 prd checksum 冻结它，因此不会新增重签项。
+
+7. MED — M2 / M7：toast 已知回归与"回归零行为差"冲突
+
+旧路径可在 click 后约 150ms 采 toast；新路径稳定页也约 0.5 秒，最坏接近 4.75 秒。短暂 toast 可能在采集前消失，使原 PASS 变成 `NEEDS_HUMAN`。GRILL 已挂账，但 hermetic toast 永不消失，所以门禁完全看不到该行为：`GRILL.md:49`。
+
+至少应增加自动消隐 toast 金牌，并由设计明确接受哪种结果；否则验收项"回归零行为差"不可成立。
+
+## LOW
+
+8. LOW — M7：单文件红先行可能被缺失模块遮蔽
+
+U1-U4 以"模块不存在"为修前红，但 I1/I2/W1 又要求拿到具体旧行为红证据。若新金牌顶层静态 import 不存在的 `lib/replay-settle.mjs`，Node 会在运行任何检查前退出，无法证明 `actual=0` 或 `NEEDS_HUMAN`。
+
+应明确使用动态 import 并逐检查捕获，或拆分单元与集成金牌；accept 证据需分别保存 I1/I2/W1 的真实旧输出。
+
+## 核对无发现项
+
+- 归因时序：M2 插入点正确。nav 和非 nav 分支都在 `isLast` 前关闭 `currentStepId`：`replay.mjs:431` `replay.mjs:463`。未发现修改 `attributedStepId` 或把静默等待纳入动作因果作用域的设计风险。
+- 冻结反向索引：按当前计划实际要改的共享夹具，确实只有 `prd-p5-replay` 和 `prd-replay-nth-visible-hardening` 命中，M8 清单无遗漏。
+- 裁判与凭据：未发现引入 LLM 裁判、修改 `verdict.mjs`、修改断言评估或泄漏 `site.json`/真机地址的设计路径。全程 fake-sut hermetic 的边界正确。
+
+---
+
+## 驱动员归档附注（非评审内容，程序性记录）
+
+- 评审全程 `sandbox=read-only`、`--skip-git-repo-check`；评审前后 `git status --short` 对比一致（仅既有 `docs/plans/replay-settle-mount/`、`node_modules` 未跟踪项，评审未产生任何工作树写入）。
+- 效力值纠偏：指令写 `fast`，codex API 无此枚举（合法值 `none|minimal|low|medium|high|xhigh`），首次按字面跑得到 `400 invalid_enum_value` 直接失败（零输出、零副作用）；改用 `medium` 重跑成功。本条据实记录，供指令方核对 `medium` 是否即其「fast」本意，或需另指定档位（如 `low`）。
+- 与本目录同期存在的另一份历史草稿（同一 `planreview-material.md` 评审料、效力值口径为「max」的更早一轮 codex 输出，`loop/audit.jsonl` 中对应更早一条 `ts:2026-07-14T10:15:17.595Z` 记录）与本轮结论方向一致（均为「需修改/非 PASS」，聚焦 D1/D3/M1/M4/M5/M7/M9 一组重叠疑点：预算硬上界不严格、I5 与既定流程时序矛盾、判据 A+B 覆盖不全、术语走样），但具体条目不完全相同（本轮新增 M6 `quietPointReached` 字段口径不一致、M2/M7 toast 已知回归两条本轮独有发现；旧轮 M7 单金牌遮蔽问题在本轮降级为 LOW）。本条为驱动员归档事实陈述，不代评审者调和两轮差异或下判断——两轮均如实计入 `loop/audit.jsonl`，多轮证据留给下一步修订者综合处理。
+- 本条为驱动员归档，不代评审者补充或调和判断；HIGH1/HIGH2 指出的「静默点无硬时间上界（单次 `evaluate` 无超时）、I5 时序设计上不可能触发预期的超预算分支」等，留给下一阶段落地 plan.md/GRILL.md 时按评审原文逐条处理，本归档不做二次验证或裁决。
+- `contract advance review` 阶段锁读取 `loop/audit.jsonl` 中 `slug` 精确匹配 + `kind` 含 `review` + `verdict`/`result` 含 `pass`（大小写不敏感）判定放行；本轮 codex 结论为「非 PASS」，`loop/audit.jsonl` 对应行如实记 `verdict: needs_revision`，不放行 review 阶段推进（如实记账，非误标 fail-open）。
diff --git a/docs/plans/replay-settle-mount/review/planreview-material.md b/docs/plans/replay-settle-mount/review/planreview-material.md
new file mode 100644
index 0000000..92f7a3c
--- /dev/null
+++ b/docs/plans/replay-settle-mount/review/planreview-material.md
@@ -0,0 +1,342 @@
+# replay-settle-mount 设计层评审料（plan 阶段，实现前）
+
+本文件是喂给异构评审者（codex）的评审料，只含 spec（plan + grill）与「已定勿改」的方向声明，不含代码 diff、不含凭据、不含无关文件。评审对象是**设计**（实现尚未开始，工作树内尚无 `lib/replay-settle.mjs`/新金牌/新 prd），目的是在 build 前逮出设计缺陷。
+
+---
+
+## 0. 已定勿改的方向声明（来自任务简报，勿评论该决策本身，只评估其设计落地是否有缺陷）
+
+### 根因（主会话勘定，真机证据在案）
+
+真机跑 `tc_wf_publish_states` 的 `intent_1`（创建工作流后断言 `buttonState` present 发布/保存）判 `NEEDS_HUMAN`（`SUT_DEFECT_OR_STALE`）、`actual=0`，但 1.5 秒后 `atstep_8` 成功唯一点中「发布」按钮——按钮一直在，是回放侧静默点不够。
+
+`bin/replay.mjs` 对 click 动作的静默窗只有：`waitForResponse` 600ms（`saveOrModifyProcessData|streamReply`）+ 固定 150ms + 对话流才有的 stream 等待。创建工作流点「确认」是 SPA（单页应用）路由跳转 + 「页面加载中」异步挂载编辑器（>1s），750ms 窗口早结束，`isLast`（代表步）就在编辑器挂载完成前采 `buttonState` → 数 0。
+
+不对称：编译侧 `lib/compile-atoms.mjs` 的 `quietPoint`（约 :202-215，DOM 连续两拍稳定）+ `networkidle` 5s（约 :725）采观测现状，故编译期发布/保存在场被人签；回放侧代表步（`isLast`，`bin/replay.mjs` 约 :466-499 `buttonState` 采集）采断言前没有等价静默点。
+
+### 修法方向（已定，勿改大方向）
+
+回放侧在代表步（`isLast`）采集断言（`toast`/`textVisible`/`buttonState`/`reply`）之前，补一个有界静默点，镜像编译侧 `quietPoint` 的 DOM 连续两拍稳定 + `networkidle` 有界兜底，让 SPA 路由挂载/「页面加载中」消失后再采。铁不变量：
+
+- 静默点纯观察者、有界（预算上界，SPA 背景轮询下 `networkidle` 可能永不达成——照编译侧 catch 兜底，绝不无限等）；
+- 绝不改归因窗/取证因果作用域语义（`forensics` `attributedStep` 逻辑不动）、绝不把背景轮询拖进本步；
+- 绝不改 `bin/verdict.mjs`、绝不改断言评估逻辑（`lib/replay-assert.mjs` 判定不动，只让采集时机对）；
+- 缺失/超时 fail-safe：静默点超预算就按现状采（不因静默点本身报错吞步），但要保证「至少给到编译期同等的稳定预算」。
+- 小固定下限（Steven 2026-07-14 批准并入）：条件轮询开始前可垫一个小的固定下限（如 200-300ms，具体值 plan 定并给理由），给 SPA 路由切换的首帧渲染一点起步窗、避免条件判据在动作刚落一拍就抢采到旧 DOM 的假稳定。定位明确：这是「条件式静默点的起步垫」，不是「每步 blanket 睡几秒」——固定值要小（毫秒级、编译回放对称若编译侧也有则对齐）、其后仍由条件（DOM 两拍稳定/加载占位消失/目标就位）决定何时放行；固定下限绝不承担「等到按钮出现」的职责（那是条件的活）。金牌须钉：即时渲染场景固定下限不显著拖慢（回归锁）、延迟挂载场景靠条件而非靠垫等到（把垫调 0 仍须条件兜住、不得靠加大固定值凑绿）。
+
+### 必守硬约束
+
+- 裁判零 LLM：`bin/verdict.mjs` 字节不动；`passes` 只 gate 写；`testChecksums` 冻结文件改须重签 sha256。
+- `.auth/site.json` 凭据不进任何输出/日志/提交；真机地址不进代码/文档。本契约用 fake-sut + chromium hermetic 验证，绝不驱真机。
+- 写 md/json 过 term-lint：简体、加粗只给中文、英文反引号、弃用别名不用、新概念先登记 CONTEXT.md。
+
+### 关键裁量（规划者定、可否决，供评审逐条核验设计是否真兑现）
+
+- D3（规划者定、可否决）静默判据必须复合：纯「DOM 连续两拍稳定」在静态「页面加载中」占位上会早退报假稳定（垫调 0 金牌必红），故加判据 A =前台在途 API 归零——复用 `lib/replay-forensics.mjs` 既有 `inFlightApi`（只收 XHR/Fetch，denylist 背景轮询天然除外，绝不把本步拖死），加性暴露 `inFlightCount()`。
+- M1 固定下限取 250ms：Steven 批准区间 200-300 中点；编译侧 click 后 150ms 出现窗 + `quietPoint` 首拍 120ms 等效起点约 270ms 近似对称；稳定页每代表步总开销约 0.5s，I3 回归锁钉上界。
+- M2 插入点 = `isLast` 块首（`bin/replay.mjs` :466）：先于 `intentUrl`/`intentCount`/`toast`/`textHits`/`buttonHits`/`buttonSeen`/`reply` 全部代表步采集，同刻性保留（`buttonSeen` 活性反证语义不破）；只代表步走静默点，非代表步与动作因果作用域（600+150ms）零动。
+- M3 实现落新文件 `lib/replay-settle.mjs` 纯函数（单元金牌用桩不开浏览器）；M4 两枚测试缝 env `REPLAY_SETTLE_FLOOR_MS`/`REPLAY_SETTLE_BUDGET_MS`（缺省 250/2500 一字不变，`REPLAY_WATCHDOG_MS` 先例）。
+- 预算构成：floor 250 → 条件轮询 2500ms（对齐编译侧 `quietPoint`）→ `networkidle` 2000ms 有界 catch 兜底一次 → 按现状采；「至少给到编译期同等稳定预算」满足。
+- 挂账（记 observability、真机复验停站观察）：script/chunk 型延迟挂载不进 `inFlightApi` 且 `networkidle` 对带背景轮询真机不可达——此形态落 `NEEDS_HUMAN` 假阴方向绝非假绿，频发再议加载占位词表判（需人签词表，本轮不做）；真机 toast 自动消隐 vs 采样延后约 0.5s（假红方向，hermetic 零影响）。
+
+评审请聚焦：设计是否真的兑现以上不变量、红先行金牌是否真能钉住对应缺陷（会不会假绿）、重签清单是否漏掉共享冻结文件、是否引入裁判 LLM 化 / 凭据外泄 / 术语走样风险。按 HIGH/MED/LOW 给 findings，逐条对准 GRILL 的 D1-D3/M1-M9 编号；如无发现给 PASS。
+
+---
+
+## 1. plan.md 全文
+
+<details>
+<summary>docs/plans/replay-settle-mount/plan.md</summary>
+
+```markdown
+# replay-settle-mount — 回放代表步采集前有界静默点（full）
+
+## 背景
+
+真机 `tc_wf_publish_states` 的 `intent_1`（创建工作流后断言 `buttonState` present 发布/保存）判 `NEEDS_HUMAN`（`SUT_DEFECT_OR_STALE`）、`actual=0`，但 1.5 秒后 `atstep_8` 成功唯一点中「发布」——按钮一直在，是回放侧静默点不够：click 静默窗仅 `waitForResponse` 600ms + 固定 150ms（`bin/replay.mjs` :436/:444），而创建工作流点「确认」是 SPA（单页应用）路由跳转 + 「页面加载中」异步挂载编辑器（>1s），代表步（`isLast`，:466-549）在挂载完成前采 `buttonHits` → 数 0 → 计时假阴。编译侧对称位有 `quietPoint`（`lib/compile-atoms.mjs` :203-214，DOM 连续两拍稳定、预算 2500ms）+ `networkidle` 有界前置（:725），回放侧代表步采集前没有等价静默点。决策全表见 `proposed/GRILL.md`（D1 方向 + D2 固定下限已由 Steven 2026-07-14 拍板；D3 判据构成与 M1-M9 机械决策可否决）。
+
+铁不变量（D1）：静默点纯观察者、有界；归因窗/取证因果作用域语义零动；`bin/verdict.mjs` 字节不动、`lib/replay-assert.mjs` 判定不动；超预算按现状采（fail-safe，不吞步），条件预算 ≥ 编译期同等（2500ms）。
+
+## 改动
+
+1. 新 `lib/replay-settle.mjs`：`settleBeforeCapture(page, { inFlight, floorMs = 250, budgetMs = 2500, log })` → `{ settled, waitedMs }`。流程：先垫 `floorMs`（固定下限，D2/M1）→ 每 120ms 一拍，单次 `page.evaluate` 采 `document.body.innerHTML.length`、同拍读 `inFlight()`（前台在途 API 计数）→ 连续两拍长度相等且两拍在途归零 → `settled: true` 放行；预算耗尽 → `page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {})` 有界兜底一次 → `settled: false` 放行（按现状采）。`evaluate` 抛错（导航中执行上下文销毁）不算稳定拍、绝不外抛（fail-safe）。
+2. `bin/replay.mjs`：`isLast` 块首（:466）接线——静默点先于该块全部代表步采集（`intentUrl`/`intentCount.after`/toast/`textHits`/`buttonHits`/`buttonSeen`/reply，同刻性保留）；`inFlight` 传 `() => forensics.inFlightCount()`；下限/预算读 `REPLAY_SETTLE_FLOOR_MS`/`REPLAY_SETTLE_BUDGET_MS`（缺省 250/2500，仅测试缝，`REPLAY_WATCHDOG_MS` 先例）；等待计入 `rhQuietWait`（回放历史诚实记账）；`REPLAY_DEBUG` 落 `settle intent=<id> waited=<ms> settled=<bool>` 日志行（金牌解析）。此处归因已关（`currentStepId` 为 null），归因语义零动；非代表步零新等待。
+3. `lib/replay-forensics.mjs`：返回对象加性暴露 `inFlightCount: () => inFlightApi.size`（既有键零动；denylist 背景轮询本就不进 `inFlightApi`，绝不把本步拖死）。
+4. `tests/fixtures/fake-sut/server.mjs`：+`mountdelay` 场景（M5）——`SCENARIOS` 集 +1；客户端 `renderDetail` 在该场景先渲静态占位「页面加载中」→ `fetch('/api/process/editorData')` → 应答后替换渲染编辑器（保存按钮 + 画布）；后端 +`/api/process/editorData` 路由（`mountdelay` 场景延迟 800ms 应答 200）。既有场景一律同步渲染零行为差。
+5. `tests/fixtures/fake-sut/CONTRACT.md`：场景表 +`mountdelay` 行（占位→延迟挂载→替换，回放静默点考场）。
+6. 新金牌 `tests/_golden/replay-settle-mount.golden.mjs`（红先行清单见下；chromium hermetic，绝不驱真机）。
+7. accept 期：新 `loop/prd-replay-settle-mount.json`（冻新金牌 + `tests/fixtures/fake-sut/server.mjs` + `tests/fixtures/fake-sut/CONTRACT.md`）；重签 `prd-p5-replay`、`prd-replay-nth-visible-hardening`（见重签清单）。
+
+## 红先行金牌清单
+
+金牌事件（tmp 自产、`_sign-helper` 签署，wf-publish-states 金牌先例）：`atstep_0` nav 列表页（`intent_0`）→ `atstep_1` 点「新增工作流」→ `atstep_2` 填「工作流名称」→ `atstep_3` 点「确定」（`intent_1` 代表步，镜像真机事故的建流拓扑）。`intent_1` expected：`buttonState` present「保存」+ `textHidden`「页面加载中」+ `urlPathname` startsWith `/ai-manager/process/detail`。
+
+- U1 静默点模块·稳定页快速放行：桩 page（长度恒定）+ 在途恒 0 → `settled: true`、`waitedMs` < 800（250 垫 + 两拍 240 + 余量）。修前红（模块不存在）。
+- U2 永不稳定 fail-safe：桩 page 长度每拍递增 → `settled: false`、不抛、`waitedMs` ≥ 预算；`networkidle` 桩被调用且带有限 `timeout`（绝不无限等）。修前红。
+- U3 固定下限可调：`floorMs: 300` 稳定页 → `waitedMs` ≥ 300；`floorMs: 0` → `waitedMs` < 300（垫是垫、条件是条件）。修前红。
+- U4 `evaluate` 抛错（导航中上下文销毁）：不外抛、照放行（`settled: false` 或后续拍恢复）。修前红。
+- I1 延迟挂载主案（红先行核心）：`mountdelay` 回放上述事件 → 修前 `buttonState` present「保存」`ok: false`/`actual: 0`（真机事故同签名）、`textHidden`「页面加载中」`ok: false`（占位在场被采到）；修后两者 `ok: true`、`buttonState` `actual` ≥ 1。
+- I2 垫调 0 条件兜住（D2 金牌要求）：同 I1 且 `REPLAY_SETTLE_FLOOR_MS=0` → 修后仍全绿——延迟挂载靠条件（在途请求归零 + 两拍稳定）而非靠垫等到，不得靠加大固定值凑绿。修前红。
+- I3 即时渲染回归锁（冻结时即绿）：`happy` 场景同事件 + `buttonState` present「保存」→ 全绿；`REPLAY_DEBUG` 解析 settle 行：`waited` < 1500ms 且 `settled: true`（早退，不烧满预算——固定下限不显著拖慢）。
+- I4 观察者不是许愿机（冻结时即绿）：`mountdelay` + `buttonState` present「幽灵导出」（页面从不出现）→ 修前修后都 `ok: false`/`actual: 0`，且 settle 行 `settled: true`（DOM 稳定即放行采集，静默点绝不承担「等到断言为真」——期望驱动轮询是倒着裁）。
+- I5 超预算照采 fail-safe（冻结时即绿）：`mountdelay` + `REPLAY_SETTLE_BUDGET_MS=100` → `replay` exit 0、axes 落盘、`buttonState` `ok: false`/`actual: 0`（超预算按现状采，不因静默点报错吞步）。
+- W1 端到端裁定翻正：`casey run` 对 `mountdelay` → 修前 `intent_1` 判 `NEEDS_HUMAN`（真机事故端到端同构复现，红）；修后 `intent_1` PASS + 报告三件（html/md/json）落盘——`bin/verdict.mjs` 零改动前提下由采集时机修正翻正。
+
+## touchesFiles
+
+- `docs/plans/replay-settle-mount/proposed/GRILL.md`（本阶段）
+- `docs/plans/replay-settle-mount/plan.md`（本阶段）
+- `lib/replay-settle.mjs`（新，实现）
+- `bin/replay.mjs`（实现接线）
+- `lib/replay-forensics.mjs`（加性 `inFlightCount`）
+- `tests/fixtures/fake-sut/server.mjs`（+`mountdelay` 场景）
+- `tests/fixtures/fake-sut/CONTRACT.md`（场景表 +1 行）
+- `tests/_golden/replay-settle-mount.golden.mjs`（新金牌）
+- `loop/prd-replay-settle-mount.json`（新，accept）
+- `loop/prd-p5-replay.json`（重签 sha256）
+- `loop/prd-replay-nth-visible-hardening.json`（重签 sha256）
+- `loop/active-contract.json`（阶段推进台账）
+
+## 重签清单（accept 期执行，一个不漏）
+
+| prd | 冻结面命中 | 动作 |
+|---|---|---|
+| `loop/prd-p5-replay.json` | `tests/fixtures/fake-sut/server.mjs` + `tests/fixtures/fake-sut/CONTRACT.md` | 两条 sha256 重签 → `gate --prd loop/prd-p5-replay.json` 复验 GREEN |
+| `loop/prd-replay-nth-visible-hardening.json` | `tests/fixtures/fake-sut/server.mjs` | 一条 sha256 重签 → gate 复验 GREEN |
+
+全仓 prd 反向核对已做（70 份 `testChecksums` 遍历）：冻 `fake-sut` 两件的仅上述两份；`bin/replay.mjs`/`lib/replay-forensics.mjs`/`lib/replay-assert.mjs` 无任何 prd 冻结；`tests/fixtures/publish-sut/server.mjs` 本契约不碰（`prd-wf-publish-states`/`prd-wf-history-version` 不重签）。
+
+## 非目标
+
+`bin/verdict.mjs` 与 `lib/replay-assert.mjs` 任何改动；axes/observed/expected schema 新键；编译侧 `quietPoint` 改动；按断言粒度的期望驱动轮询（Playwright 自动重试断言那型——破同刻性、方向性倒裁）；加载占位词表判（挂账，真机复验若现 script/chunk 型延迟挂载再议）；toast 双采快照（挂账观察）；真机驱动（复验停站另账，本契约全程 fake-sut hermetic）。
+
+## 验收
+
+1. 新金牌全绿；实现前红案齐：U1-U4（模块缺失）、I1（`actual=0` 真机同签名）、I2（垫零）、W1（`NEEDS_HUMAN` 端到端复现）——accept 期 `--red-verified` 凭此；I3/I4/I5 冻结时即绿（回归保护，wf-publish-states I0 先例）。
+2. 重签两 prd gate 复验 GREEN；`prd-replay-settle-mount` gate GREEN。
+3. 回归零行为差：全仓 ratchet 零红 + `casey selftest --tier1` GREEN；受影响金牌族原样绿（`p5-replay`/`p5-replay-coverage`/`replay-nth-visible-hardening`/`kinds-harden`/`chiefcomplaint-smoke`/`chief-bringup`/`login-traffic-drop`/`wf-publish-states`/`wf-history-version`/`btn-enable-ops`/wf 画布族/`replay-video`/`video-login-carry`/`replay-login-bootstrap`/`run-history`/`layer3-wiring`/`e2e-chain`）。
+4. 不变量核查：`git diff` 证 `bin/verdict.mjs`、`lib/replay-assert.mjs` 零改动；axes/observed schema 零新键；静默点等待全程 `currentStepId` 为 null（归因零动）。
+5. 走时上浮有界：I3 的 settle 行 `waited` < 1500ms（即时渲染不显著拖慢）；gate 后台跑轮询收。
+```
+
+</details>
+
+---
+
+## 2. GRILL.md 全文（proposed/GRILL.md，含 D1-D3 承重决策 + M1-M9 机械决策 + 反面场景挂账）
+
+<details>
+<summary>docs/plans/replay-settle-mount/proposed/GRILL.md</summary>
+
+```markdown
+# GRILL — replay-settle-mount（full，2026-07-14）
+
+授权：Steven 2026-07-14 主会话点「修」，真机证据在案——`tc_wf_publish_states` 的 `intent_1`（创建工作流后断言 `buttonState` present 发布/保存）判 `NEEDS_HUMAN`（`SUT_DEFECT_OR_STALE`）、`actual=0`，而 1.5 秒后 `atstep_8` 成功唯一点中「发布」按钮——按钮一直在，是回放侧代表步采集抢在 SPA（单页应用）编辑器挂载完成之前。修法方向与小固定下限（200-300ms 区间）均已主会话拍板；本 GRILL 落决策台账 + 规划者机械决策（可否决）。
+
+## 根因（主会话勘定，编译回放两侧不对称）
+
+- 编译侧 `lib/compile-atoms.mjs`：每步动作后走 `quietPoint`（:203-214，DOM 连续两拍稳定、预算 2500ms、120ms 一拍）才 `capture` 采观测；个别原子另有 `networkidle` 5s 有界前置（:725，catch 兜底）。编译期「发布/保存在场」正是在这个静默点之后被采到并人签的。
+- 回放侧 `bin/replay.mjs`：click 动作的静默窗只有 `waitForResponse` 600ms（:436）+ 固定 150ms（:444）+ 对话流才有的流等待（:452-460）；代表步（`isLast`，:466-549）随即采 `intentUrl`/`intentCount`/toast/`textHits`/`buttonHits`/`buttonSeen`/reply。创建工作流点「确认」是 SPA 路由跳转 + 「页面加载中」异步挂载编辑器（>1s），约 750ms 窗口早结束 → 挂载完成前采 `buttonState` → 数 0 → 计时假阴。
+- 裁定与断言评估都没错：`bin/verdict.mjs` 与 `lib/replay-assert.mjs` 拿到的就是「采集时刻的事实」，错在采集时机。
+
+## D1 修法方向（已拍板，勿改大方向）
+
+回放侧在代表步采集断言输入之前，补一个有界静默点，镜像编译侧 `quietPoint`。铁不变量：
+
+1. 静默点纯观察者、有界（预算上界；SPA 背景轮询下 `networkidle` 可能永不达成——照编译侧 catch 兜底，绝不无限等）；
+2. 绝不改归因窗/取证因果作用域语义（`attributedStepId` 逻辑零动；静默点跑在归因已关之后，`currentStepId` 此刻为 null）、绝不把背景轮询拖进本步；
+3. `bin/verdict.mjs` 字节不动；`lib/replay-assert.mjs` 判定逻辑不动（只让采集时机对）；
+4. 缺失/超时 fail-safe：静默点超预算就按现状采（不因静默点本身报错吞步），且至少给到编译期同等的稳定预算（条件预算 ≥2500ms，对齐 `quietPoint`）。
+
+## D2 小固定下限（Steven 2026-07-14 批准并入；具体值由 plan 定）
+
+条件轮询开始前垫一个小的固定下限，给 SPA 路由切换的首帧渲染一点起步窗，避免条件判据在动作刚落一拍就抢采旧 DOM 的假稳定。定位明确：这是条件式静默点的前置固定下限，不是每步一律睡几秒；其后仍由条件（在途请求归零 + DOM 两拍稳定）决定何时放行；固定下限绝不承担「等到按钮出现」的职责（那是条件的活）。金牌须钉两向：即时渲染场景不显著拖慢（回归锁）；延迟挂载场景靠条件而非靠垫等到（垫调 0 仍须条件兜住、不得靠加大固定值凑绿）。取值见 M1：250ms。
+
+## D3 静默判据构成（规划者定，Steven 可否决）
+
+为什么纯「DOM 连续两拍稳定」不够：真机形态是「页面加载中」静态占位先渲、编辑器后挂——占位期 DOM 静止不变，两拍判据会在占位上早退报「稳定」，采集仍抢在挂载前（垫调 0 时金牌必红，D2 的金牌要求逼出这一步）。故复合判据为：
+
+- 判据 A（新增，纯观察）：前台在途 API 归零——复用 `watchNetworkForensics` 已有的 `inFlightApi` 集合（`lib/replay-forensics.mjs` :16/:27：只收 XHR/Fetch，denylist 背景轮询天然除外）。真机编辑器挂载由详情数据请求驱动，「页面加载中」正是这类请求的等待态；请求在途 = 还没到静默点。背景轮询在 denylist 内，绝不把本步拖死。
+- 判据 B（镜像编译侧）：DOM 连续两拍稳定（`document.body.innerHTML.length` 两拍相等、120ms 一拍，逐字镜像 `quietPoint` 判据）。
+- 复合流程：固定下限（M1）先垫 → 轮询循环内每拍同测 A+B，连续两拍 B 相等且两拍 A 归零即放行；预算 2500ms（对齐编译侧）耗尽 → `networkidle` 有界兜底一次（2000ms、catch 吞超时，编译侧 :725 先例；带背景轮询的 SUT 到不了就超时放行）→ 按现状采。
+- 反方向铁则：判据绝不读 expected——静默点不知道要断什么按钮，只看「页面自己说还没稳」（在途请求 / DOM 还在变）。「等到断言为真」那种期望驱动轮询是倒着裁，金牌 I4 钉死此界。
+
+残余（记 observability，真机复验停站观察）：script/chunk 类型的延迟挂载（JS 分包加载）不进 `inFlightApi`（只收 XHR/Fetch），而 `networkidle` 兜底对带背景轮询的真机不可达——此形态若真机出现，按 fail-safe 落 `NEEDS_HUMAN`（假阴方向，绝非假绿），届时再议加法（如加载占位词表判，需人签词表；本轮不做——在途请求判据已覆盖已知真机形态）。
+
+## 机械决策（可否决，未否决即生效）
+
+- M1 固定下限 250ms：Steven 批准区间 200-300 的中点；编译侧 click 后 150ms 出现窗 + `quietPoint` 首拍 120ms 的等效起点约 270ms，回放取 250 近似对称；兼顾低配 WSL/DrvFs 环境首帧余量。稳定页每代表步总开销约 0.5s（250 垫 + 两拍约 240），回归锁金牌钉上界。
+- M2 插入点：`bin/replay.mjs` `isLast` 块首（:466），先于该块全部采集（`intentUrl`/`intentCount.after`/toast/`textHits`/`buttonHits`/`buttonSeen`/reply）——断言输入仍是同一静默点后同一时刻的快照（同刻性保留，`buttonSeen` 活性反证的同刻语义不破）。只代表步走静默点，非代表步零新等待（动作因果作用域 600+150ms 语义零动）；代表步不分动作类型（nav 代表步同样走，`goto` 已 `waitUntil: load`，稳定页开销可忽略）。
+- M3 实现落 `lib/replay-settle.mjs`（新文件，纯函数：吃 page 型对象 + 在途计数函数 + 下限/预算，回 `{ settled, waitedMs }`）——单元金牌用桩验预算/下限/fail-safe，不开浏览器；`bin/replay.mjs` 接线传 `() => forensics.inFlightCount()`。`lib/replay-forensics.mjs` 返回对象加性暴露 `inFlightCount()`（既有键零动，无金牌钉其键集）。
+- M4 测试缝两枚环境变量（`REPLAY_WATCHDOG_MS` 先例，缺省值一字不变）：`REPLAY_SETTLE_FLOOR_MS`（缺省 250；金牌调 0 证「条件兜住不靠垫」）、`REPLAY_SETTLE_BUDGET_MS`（缺省 2500；金牌调小证「超预算照采不吞步」）。
+- M5 夹具场景 `mountdelay`（fake-sut 加法）：`/ai-manager/process/detail` 先渲静态占位「页面加载中」→ 发 `fetch('/api/process/editorData')`（服务端延迟 800ms 应答）→ 应答后替换渲染编辑器（保存按钮 + 画布）。复现真机接缝（数据请求驱动挂载 + 静态占位），不是顺着判据裁夹具——静态占位正是纯两拍判据的反例考场。既有场景一律同步渲染零行为差（`wf-open-smoke` 可点行名加法先例）。
+- M6 观测记账：静默等待计入 `rhQuietWait`（回放历史诚实记账，不进裁定，护栏 #15 不变）；`REPLAY_DEBUG` 下输出 settle 日志行（waited/settled），金牌解析用。axes/observed schema 零新键（`additionalProperties:false` 冻结面不动）。
+- M7 金牌 `tests/_golden/replay-settle-mount.golden.mjs`（红先行清单见 plan）；chromium hermetic，全程 fake-sut，绝不驱真机。
+- M8 重签清单：动 `tests/fixtures/fake-sut/server.mjs`（+ 同目录 `CONTRACT.md` 场景表）→ `prd-p5-replay`（冻两件）与 `prd-replay-nth-visible-hardening`（冻 `server.mjs`）sha256 重签 + 各自 gate 复验 GREEN（wf-publish-states 重签 `prd-seams-freeze` 先例）。
+- M9 术语零新造：「静默点」「代表步」「通道剖面」CONTEXT.md 已注册；「固定下限」「在途请求」是描述短语非新术语；`mountdelay` 是夹具场景代码标识符。
+
+## 残余风险与挂账
+
+- 真机 toast 自动消隐 vs 采样延后约 0.5s：toast 通道断言理论上更接近消隐窗——失败方向是假红（`NEEDS_HUMAN`）非假绿；hermetic 夹具 toast 不消隐零影响；真机复验停站观察，频发再议（如 toast 移静默点前后双采快照的加法）。
+- 全量金牌走时上浮：每代表步约 +0.5s（稳定页），全仓 ratchet 预计上浮数十秒——gate 后台跑轮询收（既有纪律）。
+- script/chunk 型延迟挂载盲区：见 D3 残余。
+
+## 冻结涟漪盘点（accept 红先行逐核）
+
+- `tests/fixtures/fake-sut/server.mjs`：+`mountdelay`（`SCENARIOS` 集 + 客户端 `renderDetail` 分支 + 后端 `/api/process/editorData` 路由）——冻它的 `prd-p5-replay`、`prd-replay-nth-visible-hardening` 重签。
+- `tests/fixtures/fake-sut/CONTRACT.md`：场景表 +1 行——`prd-p5-replay` 冻它，随上重签。
+- 消费 fake-sut 的其余金牌（wf-open-node 族、wf-add-node、wf-connect-nodes、wf-open-smoke、kinds-harden、layer3-wiring、run-history、replay-video 等）不冻 `server.mjs`，无需重签；loop 期全量回归证零行为差。
+- `bin/replay.mjs`、`lib/replay-forensics.mjs`、新 `lib/replay-settle.mjs` 均为实现文件，无 prd 冻结。
+- axes/observed/expected schema 零动（M6）；`lib/replay-assert.mjs`、`bin/verdict.mjs` 零字节动（D1 铁不变量）。
+```
+
+</details>
+
+---
+
+## 3. 相关既有代码摘录（read-only 背景，供评审核对设计描述与代码现状是否相符；非本契约改动内容）
+
+### 3.1 `bin/replay.mjs` 现状（click 动作静默窗 + `isLast` 代表步采集块，本契约拟在此块首插入静默点）
+
+```javascript
+      if (ev.action === 'nav') {
+        // nav 动作轴按 goto 实际成败（不再恒 unique，finding 3）。
+        actionByStep.set(ev.stepId, navOk ? { resolution: 'unique', identityReadback: { ok: true } } : { resolution: 'action_failed', identityReadback: { ok: false } });
+        state.currentStepId = null;
+      } else {
+        // 动作作用域：归因开放，覆盖动作 + 静默期（save/stream 异步在此窗回来）。
+        state.currentStepId = ev.stepId;
+        const respWait = ev.action === 'click'
+          ? page.waitForResponse((r) => /saveOrModifyProcessData|streamReply/.test(r.url()), { timeout: 600 }).catch(() => null)
+          : Promise.resolve(null);
+        const axis = await performAction(page, ev, ctx);
+        actionByStep.set(ev.stepId, axis || { resolution: 'none' });
+        const settleT = Date.now();
+        await respWait;
+        // 给动作的直接异步后果（如 save 响应后随即开的 SSE 流）一点点出现窗，仍归本步——
+        // 这是动作的因果作用域（save→stream），非任意时间窗；背景轮询仍由 denylist 归 null。
+        if (ev.action === 'click') { await new Promise((r) => setTimeout(r, 150)); }
+        // 动态流等待（chiefcomplaint-smoke D2，Steven 拍板；codex R1-F2 + R2 两轮收紧）：
+        // 只等「本步 firingStepId 发起 且 命中 chat 流 URL 域」的 EventSource 走到 finished（或 30s 上界）
+        // ——流是本步动作的直接后果，归因窗随延（因果作用域，非任意时间窗）；背景/他步长流、本步开的
+        // 非对话长流（如面板附带 SSE）都绝不拖本步。配置了 streamUrlPattern 才有域可判；未配置时按
+        // 本步发起判（与 compile 侧对称）。无本步流零行为差（p5/catalog 回归锁背书）。
+        const streamInScope = (u) => !(chatCfg && chatCfg.streamUrlPattern) || String(u).includes(chatCfg.streamUrlPattern);
+        const myStreams = () => forensics.records().filter((r) => r.type === 'EventSource' && r.firingStepId === ev.stepId && streamInScope(r.url));
+        if (myStreams().length > 0) {
+          log('  step stream open, waiting finished ' + ev.stepId);
+          const swT = Date.now();
+          while (Date.now() - swT < 30000 && !myStreams().every((r) => r.streamFinished === true)) {
+            await new Promise((r) => setTimeout(r, 200));
+          }
+          // 网络流结束 ≠ UI 渲染完成（regress 实测）：配置了 chat 通道再等气泡文本 2s 稳定（上界 10s）。
+          if (chatCfg) await waitReplyStable(page, replySelector);
+        }
+        rhQuietWait += Date.now() - settleT;
+        log('  acted ' + ev.stepId + ' resolution=' + (axis && axis.resolution));
+        state.currentStepId = null; // 动作作用域结束，关闭归因
+      }
+
+      if (isLast) {
+        intentUrl.set(ev.intentId, pathOf(page.url()));
+        const c = intentCount.get(ev.intentId);
+        if (c) c.after = await rowCount(page, countSel);
+        // kinds-harden（G3）：代表步静默点现场采——事后卷回评估只吃此刻事实（同 intentUrl/intentCount 范式）。
+        // toast 快照选择器逐字复刻 lib/compile-atoms.mjs 观测采集（编译期作者与回放期消费者同构）。
+        const toasts = await page.evaluate(() => {
+          const out = [];
+          for (const el of document.querySelectorAll('.hr-toast,.hr-message,[role="status"],[role="alert"]')) {
+            const t = (el.textContent || '').trim();
+            if (t) out.push(t);
+          }
+          return [...new Set(out)];
+        }).catch(() => []);
+        intentToasts.set(ev.intentId, toasts);
+        // ...（textHits/buttonHits/buttonSeen/reply 采集逻辑，均在 isLast 块内，本契约插入点之后）
+      }
+```
+
+（此为工作树 read-only 现状代码，供评审核对 M2「插入点 = `isLast` 块首」是否精确、`currentStepId` 是否此刻为 null、动作因果作用域 600+150ms 是否与静默点作用域互不重叠。本契约实现阶段将在 `if (isLast) {` 花括号后、`intentUrl.set(...)` 之前插入 `await settleBeforeCapture(...)` 调用，本材料不含该 diff——diff 尚未产生。）
+
+### 3.2 `lib/compile-atoms.mjs` 现状（`quietPoint`，本契约拟镜像的判据 B）
+
+```javascript
+    // 静默点（确定性条件，替代固定睡眠，ADR-0003）：DOM 连续两拍稳定；networkidle 对带背景轮询的 SPA 永不达成、不作判据。
+    async quietPoint(budgetMs = 2500) {
+      let prev = -1;
+      const t0 = Date.now();
+      while (Date.now() - t0 < budgetMs) {
+        let n = -2;
+        try { n = await this.page.evaluate(() => document.body ? document.body.innerHTML.length : 0); } catch { n = -2; }
+        if (n >= 0 && n === prev) return true;
+        prev = n;
+        await sleep(120);
+      }
+      return false;
+    },
+```
+
+### 3.3 `lib/replay-forensics.mjs` 现状（`inFlightApi` 集合，本契约拟加性暴露 `inFlightCount()`）
+
+```javascript
+export function watchNetworkForensics(cdp, { denylist = [], successField, successValue, currentStep } = {}) {
+  const byReq = new Map();
+  const records = [];
+  const pending = [];
+  let streamOpen = 0;        // 在途 SSE 流计数（finished 前）
+  const settleWaiters = [];  // 等所有流 finished 的 resolver
+  const inFlightApi = new Set(); // 在途前台 API 请求（requestWillBeSent 到 loadingFinished/Failed 之间），drain 据此等齐
+  const isBg = (url) => denylist.some((d) => url.includes(d));
+
+  cdp.on('Network.requestWillBeSent', (e) => {
+    const url = e.request.url;
+    const firing = currentStep ? currentStep() : null;
+    const initiator = (e.initiator && e.initiator.type) || null;
+    const type = e.type || null;
+    if (type === 'EventSource') streamOpen++;
+    if ((type === 'XHR' || type === 'Fetch') && !isBg(url)) inFlightApi.add(e.requestId);
+    const isApi = type === 'XHR' || type === 'Fetch' || type === 'EventSource' || (initiator === 'script' && type !== 'Document');
+    const attributedStepId = isBg(url) || !firing || !isApi ? null : firing;
+    const rec = { requestId: e.requestId, url, method: e.request.method, status: null, ts: e.timestamp, initiator, type, firingStepId: firing, attributedStepId, errorEnvelope: null, streamFinished: undefined, streamStatus: undefined };
+    byReq.set(e.requestId, rec);
+    records.push(rec);
+  });
+
+  cdp.on('Network.responseReceived', (e) => {
+    const rec = byReq.get(e.requestId);
+    if (rec) rec.status = e.response.status;
+  });
+
+  // ...
+  cdp.on('Network.loadingFailed', (e) => { inFlightApi.delete(e.requestId); });
+  cdp.on('Network.loadingFinished', (e) => {
+    // ...
+    inFlightApi.delete(e.requestId);
+  });
+```
+
+注：`inFlightApi` 目前仅内部使用（drain 阶段等在途请求落 `loadingFinished`/`Failed`），本契约拟加一条 `inFlightCount: () => inFlightApi.size` 到 `watchNetworkForensics` 返回对象（加性，既有键零动）。
+
+### 3.4 CONTEXT.md 既有「静默点」词条（供评审核对术语沿用是否走样）
+
+```
+| 静默点 | Quiet Point | 编译期落观测现状/做后检查前必达的确定性等待条件（networkidle + 无动画 + DOM 稳定 K ms），替代固定睡眠保可复现 | — |
+```
+
+注：该词条现文当前限定「编译期」，本契约拟把同一词「静默点」用于回放侧新机制（`settleBeforeCapture`）。plan.md/GRILL.md 正文均称之为「静默点」（如背景段「回放侧代表步采集前没有等价静默点」）。是否需要在 CONTEXT.md 改词条定义为跨阶段通用、或改用另一措辞区分编译期 `quietPoint` 与回放期新机制，未见 plan/GRILL 正文显式处理——请评审核对是否构成术语走样风险。
+
+---
+
+## 4. 评审指令（复述，供评审者对齐输出结构）
+
+审设计——请回答：
+
+1. 静默点有界性是否真封死 SPA 背景轮询下 `networkidle` 永不达成的场景（会不会无限等/拖垮回放）？
+2. 是否误改归因窗与取证因果作用域（`attributedStepId` 逻辑、`currentStepId` 归因开关时序）？
+3. DOM 稳定判据（判据 B）会否被背景动画/轮询搅成永不稳定，进而只能靠 `networkidle` 兜底兜到超时、拖慢每个代表步？
+4. 红先行金牌清单（U1-U4 / I1-I5 / W1）是否真钉住计时假阴缺陷，会不会假绿（例如断言过弱、遗漏关键反面场景、判据 A+B 任一失守时金牌是否真会红）？
+5. 既有即时渲染回归锁（I3）是否够（走时上浮上界是否合理、是否会漏掉「早退但实际仍在挂载」的边界）？
+6. 重签清单（`prd-p5-replay`、`prd-replay-nth-visible-hardening`）是否遗漏了任何共享冻结文件？
+7. 是否存在引入「裁判 LLM 化」的设计风险、凭据外泄风险、术语走样风险（含上文第 3.4 节「静默点」词条编译期限定 vs 回放期沿用的疑问）？
+
+按 HIGH/MED/LOW 分级列 findings，每条对准 GRILL 的 D1-D3 或 M1-M9 编号；给出具体证据引用（行为/字段/场景描述，非泛泛而论）；无发现给 PASS。
diff --git a/lib/replay-forensics.mjs b/lib/replay-forensics.mjs
index 358fbfb..880c67a 100644
--- a/lib/replay-forensics.mjs
+++ b/lib/replay-forensics.mjs
@@ -75,6 +75,9 @@ export function watchNetworkForensics(cdp, { denylist = [], successField, succes
 
   return {
     records: () => records,
+    // 在途前台 API 计数（replay-settle-mount 判据 A 加性暴露）：denylist 背景轮询本就不进 inFlightApi，
+    // 绝不把本步拖死；纯观察者，既有键零动。
+    inFlightCount: () => inFlightApi.size,
     // 等在途 SSE 流走到 finished（静默点 = 流 finished，非 networkidle）。先给 120ms 让流出现（EventSource 在 click handler 异步段才建）。
     awaitStreamsSettled: (ms) => new Promise((resolve) => {
       setTimeout(() => {
diff --git a/lib/replay-settle.mjs b/lib/replay-settle.mjs
new file mode 100644
index 0000000..cac2184
--- /dev/null
+++ b/lib/replay-settle.mjs
@@ -0,0 +1,93 @@
+// settleBeforeCapture —— 回放代表步采集断言前的有界静默点（跨阶段静默点的回放变体，CONTEXT.md）。
+// 镜像编译侧 quietPoint（lib/compile-atoms.mjs :202-214）：让 SPA（单页应用）路由挂载 /「页面加载中」
+// 占位消失后再采断言输入，堵回放侧计时假阴（真机 tc_wf_publish_states intent_1 判 NEEDS_HUMAN/actual=0）。
+//
+// 铁不变量（plan D1）：纯观察者、有界、fail-safe——
+//   · 绝不外抛（helper 自身故障由 bin 侧照现状采）；绝不无限等（每拍 evaluate 套竞速、总走时有预算上界）；
+//   · 超预算按现状采（settled:false 放行，不吞步）；条件预算 ≥ 编译期同等（缺省 2500ms，对齐 quietPoint）；
+//   · 判据绝不读 expected——静默点不知道要断什么按钮，只看「页面自己说还没稳」（在途请求 / DOM 还在变）。
+//
+// 复合判据（plan D3）：
+//   判据 A（在途前台 API 归零，纯观察）：复用 watchNetworkForensics 的 inFlightApi（只收 XHR/Fetch、denylist
+//     背景轮询天然除外）——真机编辑器挂载由详情数据请求驱动，请求在途 = 还没到静默点。
+//   判据 B（镜像编译侧）：document.body.innerHTML.length 连续两拍稳定。
+//   放行条件：连续两拍长度相等【且】两拍均在判据 A 归零区间内（稳定对不跨零点，给「应答后提交」约两拍缓冲）。
+//   兜底（条件化）：预算耗尽时仅在途仍非零才走 networkidle 有界兜底一次（职责=网络尾巴）；判据 A 已归零的
+//     DOM 扰动形态直接放行（networkidle 不识 denylist、背景轮询下必烧满超时且无增益）。
+
+const TICK_MS = 120;       // 一拍间隔（逐字镜像编译侧 quietPoint）
+const EVAL_RACE_MS = 500;  // 单拍 evaluate 有界竞速（lib/replay-forensics.mjs :8 withTimeout 先例）
+const IDLE_MS = 2000;      // networkidle 有界兜底（编译侧 :725 先例，catch 吞超时）
+
+const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
+// 入参校验：非有限非负数一律回缺省，绝不让 NaN 拖死循环（评审：入参非法回缺省）。
+const finiteNonNeg = (v, dflt) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : dflt);
+
+// 单拍 DOM 长度采集，套 EVAL_RACE_MS 有界竞速。evaluate 抛错（导航中上下文销毁）/永不返回 → null
+// （该拍按不稳定计，预算循环照常复查，绝不悬死等全局看门狗）。
+async function tickLen(page) {
+  try {
+    return await Promise.race([
+      Promise.resolve(page.evaluate(() => (document.body ? document.body.innerHTML.length : 0))).catch(() => null),
+      sleep(EVAL_RACE_MS).then(() => null),
+    ]);
+  } catch { return null; }
+}
+
+export async function settleBeforeCapture(page, opts = {}) {
+  const floorMs = finiteNonNeg(opts && opts.floorMs, 250);
+  const budgetMs = finiteNonNeg(opts && opts.budgetMs, 2500);
+  const inFlight = opts && typeof opts.inFlight === 'function' ? opts.inFlight : () => 0;
+  const log = opts && typeof opts.log === 'function' ? opts.log : () => {};
+  const t0 = Date.now();
+
+  // 判据 A 读值：inFlight() 抛错则本次静默点内降级为不可用、退化纯判据 B（编译侧同构，评审：inFlight try/catch）。
+  let aUsable = true;
+  const inFlightZero = () => {
+    if (!aUsable) return true; // 降级：判据 A 恒视作已归零，纯靠判据 B
+    try {
+      const n = inFlight();
+      return typeof n === 'number' && Number.isFinite(n) ? n <= 0 : true;
+    } catch {
+      aUsable = false;
+      log('settle inFlight() threw → degrade to DOM-only');
+      return true;
+    }
+  };
+  const inFlightNonZero = () => {
+    if (!aUsable) return false;
+    try {
+      const n = inFlight();
+      return typeof n === 'number' && Number.isFinite(n) && n > 0;
+    } catch { aUsable = false; return false; }
+  };
+
+  // 固定下限（plan D2/M1）：给 SPA 路由切换首帧一点起步窗，避免动作刚落一拍就抢采旧 DOM 的假稳定。
+  // 定位=条件式静默点的起步垫，绝不承担「等到按钮出现」（那是条件的活）。
+  if (floorMs > 0) await sleep(floorMs);
+
+  let prevLen = null;
+  let prevZero = false;
+  while (Date.now() - t0 < budgetMs) {
+    const len = await tickLen(page);
+    const zero = inFlightZero();
+    // 稳定对：连续两拍长度相等【且】两拍均在归零区间内（不跨零点——占位期在途未归零的稳定拍不计入）。
+    if (len != null && prevLen != null && len === prevLen && zero && prevZero) {
+      const waitedMs = Date.now() - t0;
+      log('settle dom-stable → settled waited=' + waitedMs);
+      return { settled: true, waitedMs };
+    }
+    prevLen = len;
+    prevZero = zero;
+    await sleep(TICK_MS);
+  }
+
+  // 预算耗尽：仅在途仍非零才走 networkidle 有界兜底（职责=网络尾巴）；否则直接放行（扰动形态兜底跳过）。
+  if (inFlightNonZero() && typeof page.waitForLoadState === 'function') {
+    log('settle budget exhausted, inflight>0 → networkidle bottom');
+    try { await page.waitForLoadState('networkidle', { timeout: IDLE_MS }); } catch { /* 超时/无该 API：吞（按现状采）*/ }
+  }
+  const waitedMs = Date.now() - t0;
+  log('settle unsettled → capture as-is waited=' + waitedMs);
+  return { settled: false, waitedMs };
+}
diff --git a/loop/prd-p5-replay.json b/loop/prd-p5-replay.json
index fbc4859..d0e6bae 100644
--- a/loop/prd-p5-replay.json
+++ b/loop/prd-p5-replay.json
@@ -6,8 +6,8 @@
     "tests/_golden/p5-replay.golden.mjs": "8a368f628ba19b0d487744e9e74e873966bb0fc4cb4d6d42e7ce1456ed1529c1",
     "tests/_golden/p5-replay-coverage.golden.mjs": "3e46e9a7fdf6824ed17e3a3c83e406ff55e95a2e5bb279d6bbdb92d67f7e2706",
     "tests/_golden/fixtures/p5/replay-cases.json": "931c708956e6abb0fa2fad0e4ad081b203da884d9a08894dd0828a5e216524b0",
-    "tests/fixtures/fake-sut/server.mjs": "a1c4266905bb6022bc1c8612ca0cc66eb36cad7cfaf6be36c9b8e3c2ce11e00f",
-    "tests/fixtures/fake-sut/CONTRACT.md": "905e0dd72c830ef166f9585eb28587f3b8026b776685824b641026a3658dc598",
+    "tests/fixtures/fake-sut/server.mjs": "5804420e7841788ad342b92eeabc62c782ac9976e272741f05ca9648bb75f1be",
+    "tests/fixtures/fake-sut/CONTRACT.md": "2f634ee49bc840c1b54fbc0d74558816b752d845956426246546061b803f63ac",
     "tests/_golden/fixtures/seams/events.fixture.json": "49545e6efe597c33d9eeaaff65e9f8f9e268e125509533ccf54026a70023dd14"
   },
   "observability": [
@@ -34,7 +34,7 @@
         "node bin/casey.mjs selftest --tier1"
       ],
       "passes": true,
-      "evidence": "gate@2026-07-10T04:38:15.340Z 全部 acceptance exit 0"
+      "evidence": "gate@2026-07-14T14:50:09.604Z 全部 acceptance exit 0"
     },
     {
       "id": "s2-failsafe-coverage",
@@ -44,7 +44,7 @@
         "node tests/_golden/p5-replay-coverage.golden.mjs"
       ],
       "passes": true,
-      "evidence": "gate@2026-07-10T04:38:15.940Z 全部 acceptance exit 0"
+      "evidence": "gate@2026-07-14T14:50:10.462Z 全部 acceptance exit 0"
     }
   ]
 }
diff --git a/loop/prd-replay-nth-visible-hardening.json b/loop/prd-replay-nth-visible-hardening.json
index 36854a9..a1bd34b 100644
--- a/loop/prd-replay-nth-visible-hardening.json
+++ b/loop/prd-replay-nth-visible-hardening.json
@@ -4,7 +4,7 @@
   "specPath": "docs/plans/replay-nth-visible-hardening/plan.md",
   "testChecksums": {
     "tests/_golden/replay-nth-visible-hardening.golden.mjs": "3f447bfe78c1c8abbf819da9abc0d70c36d2a3c7d45681cab73f7aac3b124790",
-    "tests/fixtures/fake-sut/server.mjs": "a1c4266905bb6022bc1c8612ca0cc66eb36cad7cfaf6be36c9b8e3c2ce11e00f"
+    "tests/fixtures/fake-sut/server.mjs": "5804420e7841788ad342b92eeabc62c782ac9976e272741f05ca9648bb75f1be"
   },
   "stories": [
     {
@@ -15,7 +15,7 @@
         "node tests/_golden/replay-nth-visible-hardening.golden.mjs"
       ],
       "passes": true,
-      "evidence": "gate@2026-07-10T05:07:12.178Z 全部 acceptance exit 0"
+      "evidence": "gate@2026-07-14T14:50:52.403Z 全部 acceptance exit 0"
     },
     {
       "id": "s2-resign-and-regression",
@@ -34,7 +34,7 @@
         "node bin/casey.mjs selftest --tier1"
       ],
       "passes": true,
-      "evidence": "gate@2026-07-10T05:16:07.837Z 全部 acceptance exit 0"
+      "evidence": "gate@2026-07-14T15:02:25.772Z 全部 acceptance exit 0"
     }
   ]
 }
diff --git a/loop/prd-replay-settle-mount.json b/loop/prd-replay-settle-mount.json
new file mode 100644
index 0000000..e723138
--- /dev/null
+++ b/loop/prd-replay-settle-mount.json
@@ -0,0 +1,54 @@
+{
+  "schemaVersion": 1,
+  "task": "replay-settle-mount（full）：回放代表步（`isLast`）采集断言输入前补一个有界静默点 `settleBeforeCapture`（新 `lib/replay-settle.mjs`），镜像编译侧 `quietPoint`——让单页应用路由挂载 /「页面加载中」占位消失后再采，堵回放侧计时假阴（真机 `tc_wf_publish_states` 的 `intent_1` 判 `NEEDS_HUMAN`(`SUT_DEFECT_OR_STALE`)/`actual=0`，而 1.5s 后按钮成功点中——按钮一直在、是采集抢在挂载前）。复合判据：判据 A 在途前台请求归零（复用 `watchNetworkForensics` 的 `inFlightApi`，加性暴露 `inFlightCount`；`denylist` 背景轮询天然除外）+ 判据 B DOM 连续两拍稳定（逐字镜像 `quietPoint`），连续两拍相等且两拍均归零（稳定对不跨零点）才放行；固定下限 250ms 起步垫（`REPLAY_SETTLE_FLOOR_MS` 测试缝）+ 预算 2500ms（`REPLAY_SETTLE_BUDGET_MS` 测试缝）耗尽后仅在途仍非零才走 `networkidle` 有界兜底一次（职责=网络尾巴，兜底条件化）。铁不变量：纯观察者、有界、fail-safe（绝不外抛/绝不无限等/超预算按现状采不吞步）；归因语义零动（静默点全程 `currentStepId` 为 null）；`bin/verdict.mjs` 与 `lib/replay-assert.mjs` 字节不动；axes/observed schema 零新键（`run-history.schema.json` 文件字节不动，代表步 `quietPointReached` 只改取值来源为 `navOk && settled`）。夹具加法：`mountdelay`（数据请求驱动的延迟挂载 + 静态占位 + toast 3000ms 自动消隐）与 `churn`（DOM 持续扰动 + 背景轮询）两场景，既有场景零行为差。决策 `docs/plans/replay-settle-mount/plan.md`（改动 1-8，已并入 codex-sol@max 设计评审修订 8 findings）、`proposed/GRILL.md`（D1 方向 / D2 固定下限 / D3 复合判据）。红先行：U1-U7 缺模块红 + I1 `actual=0` 真机同签名红 + I2 垫零红 + W1 `NEEDS_HUMAN` 端到端红（`docs/plans/replay-settle-mount/proposed/red/red-before-impl.txt` 存证）。",
+  "specPath": "docs/plans/replay-settle-mount/plan.md",
+  "testChecksums": {
+    "tests/_golden/replay-settle-mount.golden.mjs": "018884e1c2be4b7ba11a07095e38453b003e550fbcc153b2eabf1cbe803a1ba0",
+    "tests/fixtures/fake-sut/server.mjs": "5804420e7841788ad342b92eeabc62c782ac9976e272741f05ca9648bb75f1be",
+    "tests/fixtures/fake-sut/CONTRACT.md": "2f634ee49bc840c1b54fbc0d74558816b752d845956426246546061b803f63ac"
+  },
+  "observability": [
+    {
+      "dimension": "真机 toast 自动消隐窗 vs 采集延后约 0.5-1s：hermetic 夹具以 3000ms 典型窗钉「延采不丢典型 toast」（I1），真机消隐窗时序上浮门禁不可证——失败方向假红（NEEDS_HUMAN）非假绿，真机复验停站观察，频发再议 toast 移静默点前后双采快照",
+      "route": "human"
+    },
+    {
+      "dimension": "script/chunk 型延迟挂载（JS 分包加载）盲区：不进 inFlightApi（只收 XHR/Fetch）、networkidle 兜底对带背景轮询真机不可达——此形态若真机出现按 fail-safe 落 NEEDS_HUMAN（假阴方向非假绿），届时再议加载占位词表判（需人签词表）",
+      "route": "human"
+    },
+    {
+      "dimension": "「响应结束→UI 延迟提交」形态：判据 A 在 loadingFinished 即归零，提交延迟超过稳定对约两拍缓冲（约 240ms）则在占位上放行——失败方向假红非假绿，已确证真机形态（应答即提交）I1 已覆盖，判据侧扩展会假定「应答必改 DOM」恶化最坏走时，本轮不做（GRILL D3 残余）",
+      "route": "human"
+    }
+  ],
+  "stories": [
+    {
+      "id": "s1-settle-red-golden",
+      "desc": "红先行金牌 replay-settle-mount.golden.mjs：U1-U7 单元向（settleBeforeCapture 桩验——稳定页快速放行 / 永不稳定 fail-safe 两变体 / 固定下限可调 / evaluate 抛错不外抛 / evaluate 永不返回硬上界 / inFlight 抛错降级 / 稳定对不跨零点，动态 import 逐案捕获、缺模块各自红签名）；I1 延迟挂载主案（mountdelay → 修前 buttonState actual=0 真机同签名、修后 ok:true/actual≥1 + textHidden/textVisible 全绿）；I2 垫调 0 条件兜住（REPLAY_SETTLE_FLOOR_MS=0 修后仍绿——靠条件非靠垫）；I3 即时渲染回归锁（happy settle waited<1500/settled:true、quietPointReached:true）；I4 观察者不是许愿机（幽灵按钮 ok:false/settled:true）；I5 超预算照采 fail-safe（mountDelayMs 6000 + budget 100 → exit 0/actual:0/quietPointReached:false）；I6 扰动走时上界（churn settled:false/waited<4000）；W1 端到端裁定翻正（casey run mountdelay → 修前 NEEDS_HUMAN 修后 intent_1 PASS + 报告三件）。verdict.mjs/replay-assert.mjs 字节不动。",
+      "lane": "implementation",
+      "acceptance": [
+        "node tests/_golden/replay-settle-mount.golden.mjs"
+      ],
+      "passes": true,
+      "evidence": "gate@2026-07-14T14:42:27.073Z 全部 acceptance exit 0"
+    },
+    {
+      "id": "s2-regression-and-resign",
+      "desc": "影响面复验零行为差 + 重签涟漪 prd。静默点每代表步约 +0.5s（稳定页），受影响 fake-sut 消费金牌族逐个原样绿（p5-replay/p5-replay-coverage/wf-publish-states/wf-open-smoke/kinds-harden/run-history/replay-nth-visible-hardening/e2e-chain）+ selftest --tier1 绿。重签 prd-p5-replay（server.mjs + CONTRACT.md 两条 sha256）、prd-replay-nth-visible-hardening（server.mjs 一条）各自 gate 复验 GREEN（另跑，见重签台账）。",
+      "lane": "implementation",
+      "acceptance": [
+        "node tests/_golden/p5-replay.golden.mjs",
+        "node tests/_golden/p5-replay-coverage.golden.mjs",
+        "node tests/_golden/wf-publish-states.golden.mjs",
+        "node tests/_golden/wf-open-smoke.golden.mjs",
+        "node tests/_golden/kinds-harden.golden.mjs",
+        "node tests/_golden/run-history.golden.mjs",
+        "node tests/_golden/replay-nth-visible-hardening.golden.mjs",
+        "node tests/_golden/e2e-chain.golden.mjs",
+        "node bin/casey.mjs selftest --tier1"
+      ],
+      "passes": true,
+      "evidence": "gate@2026-07-14T14:47:57.690Z 全部 acceptance exit 0"
+    }
+  ]
+}
diff --git a/tests/_golden/replay-settle-mount.golden.mjs b/tests/_golden/replay-settle-mount.golden.mjs
new file mode 100644
index 0000000..21b3b0c
--- /dev/null
+++ b/tests/_golden/replay-settle-mount.golden.mjs
@@ -0,0 +1,320 @@
+#!/usr/bin/env node
+// 冻结黄金标准（replay-settle-mount · hermetic）：回放代表步采集断言前补有界静默点。
+// 决策依 docs/plans/replay-settle-mount/plan.md（改动 1-8）+ proposed/GRILL.md（D1 方向 / D2 固定下限 /
+//   D3 复合判据 A 在途归零 + B 两拍稳定 / 兜底条件化 / 设计评审修订 codex-sol@max 8 findings）。
+// 根因：真机 tc_wf_publish_states 的 intent_1 判 NEEDS_HUMAN(SUT_DEFECT_OR_STALE)/actual=0，因回放代表步
+//   （isLast）在 SPA 路由挂载/「页面加载中」占位消失前就采 buttonState → 数 0 假阴。修法=采集前镜像编译侧
+//   quietPoint 补有界静默点（floor 垫 + 判据 A 在途归零 + 判据 B DOM 两拍稳定，networkidle 仅超预算后条件兜底）。
+//
+// 红先行（accept 期逐案存证）：U1-U7 对 lib/replay-settle.mjs 动态 import 逐案捕获（缺模块=各自红签名，
+//   绝不因静态 import 整体崩塌遮蔽 I/W）；I1/I2/W1 不 import 该模块、直接驱 bin/replay.mjs / casey run 子进程
+//   取旧行为红签名（I1 actual=0 真机同签名 / I2 垫零红 / W1 NEEDS_HUMAN 端到端）。I3/I4/I5/I6 冻结时即绿
+//   （回归保护，wf-publish-states I0 先例）。铁不变量：bin/verdict.mjs 与 lib/replay-assert.mjs 字节不动。
+// 改本文件 = Test Ratchet 判红。
+import { readFileSync, writeFileSync, existsSync, mkdtempSync, mkdirSync } from 'node:fs';
+import { spawnSync } from 'node:child_process';
+import { resolve, dirname, join } from 'node:path';
+import { fileURLToPath, pathToFileURL } from 'node:url';
+import { tmpdir } from 'node:os';
+import { startFakeSut, FAKE_SITE_DENYLIST } from '../fixtures/fake-sut/server.mjs';
+import { signExpected } from './_sign-helper.mjs';
+
+const HERE = dirname(fileURLToPath(import.meta.url));
+const ROOT = resolve(HERE, '..', '..');
+const REPLAY = join(ROOT, 'bin', 'replay.mjs');
+const CASEY = join(ROOT, 'bin', 'casey.mjs');
+const SETTLE_MOD = join(ROOT, 'lib', 'replay-settle.mjs');
+const tmp = mkdtempSync(join(tmpdir(), 'casey-settle-'));
+const run = (args, opts = {}) => spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 120000, ...opts });
+
+const fails = [];
+let pass = 0;
+async function checkAsync(name, fn) {
+  try { await fn(); pass++; } catch (e) { fails.push(`${name}: ${String(e && (e.stderr || e.message)).slice(-400)}`); }
+}
+
+// ─────────────────────────────────────────────────────────────────────────────
+// U 单元向：settleBeforeCapture 纯函数（桩 page + 桩 inFlight，不开浏览器）。
+//   动态 import 逐案捕获——缺模块=各自红签名（LOW 采信：绝不静态 import 整体崩塌遮蔽 I/W）。
+// ─────────────────────────────────────────────────────────────────────────────
+async function loadSettle() {
+  const m = await import(pathToFileURL(SETTLE_MOD).href + '?t=' + Date.now());
+  if (typeof m.settleBeforeCapture !== 'function') throw new Error('lib/replay-settle.mjs 未导出 settleBeforeCapture');
+  return m.settleBeforeCapture;
+}
+// 桩 page：lenSeq 决定每拍 document.body.innerHTML.length（函数或数组或 'never'/'throw'）。
+function stubPage(lenSpec) {
+  let i = 0;
+  const calls = { evaluate: 0, waitForLoadState: [] };
+  return {
+    _calls: calls,
+    async evaluate() {
+      calls.evaluate++;
+      const k = i++;
+      if (lenSpec === 'never') return new Promise(() => {});           // 永不 resolve（U5）
+      if (lenSpec === 'throw') throw new Error('导航中执行上下文销毁');   // evaluate 抛错（U4）
+      if (typeof lenSpec === 'function') return lenSpec(k);
+      return Array.isArray(lenSpec) ? lenSpec[Math.min(k, lenSpec.length - 1)] : lenSpec;
+    },
+    async waitForLoadState(state, opts) { calls.waitForLoadState.push({ state, opts }); },
+  };
+}
+// 桩 inFlight：常量 / 数组序列（脚本化）/ 抛错。
+function stubInFlight(spec) {
+  let j = 0;
+  return () => {
+    if (spec === 'throw') throw new Error('inFlight boom');
+    if (Array.isArray(spec)) return spec[Math.min(j++, spec.length - 1)];
+    return spec;
+  };
+}
+
+await checkAsync('U1 稳定页快速放行：settled true、waitedMs<800（floor 250 + 两拍约 240 + 余量）', async () => {
+  const settle = await loadSettle();
+  const page = stubPage(4000); // 长度恒定
+  const r = await settle(page, { inFlight: stubInFlight(0) });
+  if (r.settled !== true) throw new Error(`稳定页应 settled:true，实际 ${r.settled}`);
+  if (!(r.waitedMs < 800)) throw new Error(`稳定页应 waitedMs<800（早退），实际 ${r.waitedMs}`);
+});
+
+await checkAsync('U2a 永不稳定 + 在途恒 0：settled false、不抛、waitedMs≥预算、networkidle 桩不被调（兜底条件化跳过）', async () => {
+  const settle = await loadSettle();
+  const page = stubPage((k) => 1000 + k * 7); // 每拍递增，永不稳定
+  const r = await settle(page, { inFlight: stubInFlight(0), floorMs: 100, budgetMs: 600 });
+  if (r.settled !== false) throw new Error(`永不稳定应 settled:false，实际 ${r.settled}`);
+  if (!(r.waitedMs >= 600)) throw new Error(`应 waitedMs≥预算(600)，实际 ${r.waitedMs}`);
+  if (!(r.waitedMs < 600 + 100 + 800)) throw new Error(`总耗时应有界(<预算+下限+余量)，实际 ${r.waitedMs}`);
+  if (page._calls.waitForLoadState.length !== 0) throw new Error('在途已归零应跳过 networkidle 兜底（条件化），实际被调用');
+});
+
+await checkAsync('U2b 永不稳定 + 在途恒 1：networkidle 桩被调且带有限 timeout（绝不无限等）、总耗时有界', async () => {
+  const settle = await loadSettle();
+  const page = stubPage((k) => 1000 + k * 7);
+  const r = await settle(page, { inFlight: stubInFlight(1), floorMs: 100, budgetMs: 600 });
+  if (r.settled !== false) throw new Error(`永不稳定应 settled:false，实际 ${r.settled}`);
+  const wl = page._calls.waitForLoadState;
+  if (wl.length !== 1) throw new Error(`在途非零应走 networkidle 兜底一次，实际 ${wl.length}`);
+  if (wl[0].state !== 'networkidle') throw new Error(`兜底应 networkidle，实际 ${wl[0].state}`);
+  if (!(wl[0].opts && Number.isFinite(wl[0].opts.timeout) && wl[0].opts.timeout > 0)) {
+    throw new Error(`networkidle 必带有限 timeout（绝不无限等），实际 ${JSON.stringify(wl[0].opts)}`);
+  }
+});
+
+await checkAsync('U3 固定下限可调：floorMs 300 → waitedMs≥300；floorMs 0 → waitedMs<300（垫是垫、条件是条件）', async () => {
+  const settle = await loadSettle();
+  const a = await settle(stubPage(4000), { inFlight: stubInFlight(0), floorMs: 300 });
+  if (!(a.settled === true && a.waitedMs >= 300)) throw new Error(`floor 300 稳定页应 settled:true/waitedMs≥300，实际 ${JSON.stringify(a)}`);
+  const b = await settle(stubPage(4000), { inFlight: stubInFlight(0), floorMs: 0 });
+  if (!(b.settled === true && b.waitedMs < 300)) throw new Error(`floor 0 稳定页应 settled:true/waitedMs<300，实际 ${JSON.stringify(b)}`);
+});
+
+await checkAsync('U4 evaluate 抛错（导航中上下文销毁）：不外抛、照放行（settled false）', async () => {
+  const settle = await loadSettle();
+  const r = await settle(stubPage('throw'), { inFlight: stubInFlight(0), floorMs: 50, budgetMs: 500 });
+  if (r.settled !== false) throw new Error(`evaluate 抛错应 settled:false（该拍不稳定），实际 ${r.settled}`);
+  if (typeof r.waitedMs !== 'number') throw new Error('抛错仍须返回 waitedMs（绝不外抛）');
+});
+
+await checkAsync('U5 evaluate 永不返回：每拍 500ms 竞速兜住、预算循环照常复查、settled false、总耗时硬上界', async () => {
+  const settle = await loadSettle();
+  const t0 = Date.now();
+  const r = await settle(stubPage('never'), { inFlight: stubInFlight(0), floorMs: 100, budgetMs: 600 });
+  const elapsed = Date.now() - t0;
+  if (r.settled !== false) throw new Error(`永不返回应 settled:false，实际 ${r.settled}`);
+  if (!(elapsed < 600 + 500 + 700)) throw new Error(`总耗时须有界(<预算+单拍竞速+余量)，实际 ${elapsed}（绝不悬死等看门狗）`);
+});
+
+await checkAsync('U6 inFlight() 抛错：不外抛、判据 A 降级、纯判据 B 照常 settled true', async () => {
+  const settle = await loadSettle();
+  const r = await settle(stubPage(4000), { inFlight: stubInFlight('throw') });
+  if (r.settled !== true) throw new Error(`inFlight 抛错应降级纯判据 B、稳定页仍 settled:true，实际 ${r.settled}`);
+});
+
+await checkAsync('U7 稳定对不跨零点：在途 1,1,0,0 + DOM 恒定 → 放行必在第二个归零拍之后（占位陈稳定不计入稳定对）', async () => {
+  const settle = await loadSettle();
+  const page = stubPage(4000); // 长度全程恒定
+  const r = await settle(page, { inFlight: stubInFlight([1, 1, 0, 0, 0, 0]), floorMs: 50 });
+  if (r.settled !== true) throw new Error(`应最终 settled:true，实际 ${r.settled}`);
+  // evaluate 每拍一次；放行须在第 4 拍（第二个归零拍）——若忽略归零门会在第 2 拍就误判稳定。
+  if (page._calls.evaluate < 4) throw new Error(`放行须在第二个归零拍之后（≥4 拍），实际仅 ${page._calls.evaluate} 拍（稳定对跨了零点=倒退）`);
+});
+
+// ─────────────────────────────────────────────────────────────────────────────
+// I 集成向：驱 bin/replay.mjs 子进程（不 import settle 模块）。建流事件复刻真机建流拓扑。
+// ─────────────────────────────────────────────────────────────────────────────
+const CASE_ID = 'tc_settle_replay';
+function settleEventsDoc() {
+  return {
+    schemaVersion: 2, channel: 'web', caseId: CASE_ID,
+    url: '{{baseUrl}}/ai-manager/process/list', recordedAt: '2026-07-14T00:00:00.000Z', compiledBy: 'golden-fixture', authored: false,
+    events: [
+      { stepId: 'atstep_0', intentId: 'intent_0', atom: 'nav.processList', action: 'nav', url: '{{baseUrl}}/ai-manager/process/list' },
+      { stepId: 'atstep_1', intentId: 'intent_1', atom: 'workflow.openCreate', action: 'click', semantic: { kind: 'role', role: 'button', name: '新增工作流', exact: true }, text: '新增工作流', fallbackCss: '.create-wf' },
+      { stepId: 'atstep_2', intentId: 'intent_1', atom: 'workflow.fillName', action: 'fill', semantic: { kind: 'label', name: '工作流名称' }, fieldLabel: '工作流名称', value: 'atl_settle_wf' },
+      { stepId: 'atstep_3', intentId: 'intent_1', atom: 'workflow.confirmCreate', action: 'click', semantic: { kind: 'role', role: 'button', name: '确定', exact: true }, text: '确定', fallbackCss: '.hr-button--primary' },
+    ],
+  };
+}
+const EVENTS = join(tmp, 'settle-events.json');
+writeFileSync(EVENTS, JSON.stringify(settleEventsDoc(), null, 2));
+const PROFILE = join(tmp, 'profile.json');
+writeFileSync(PROFILE, JSON.stringify({
+  background: FAKE_SITE_DENYLIST, successField: 'status', successValue: 200,
+  routes: { workflowList: '/ai-manager/process/list' },
+}));
+function expDoc(intent1) {
+  return signExpected({
+    caseId: CASE_ID, channel: 'web',
+    intents: [{ intentId: 'intent_0', expected: [] }, { intentId: 'intent_1', expected: intent1 }],
+    globalAssertions: [],
+  });
+}
+const a = (o) => ({ soft: false, ...o });
+// 主案 expected：buttonState present 保存 + textHidden 页面加载中 + textVisible 新增成功 + urlPathname detail。
+const EXP_MAIN = join(tmp, 'exp-main.json');
+writeFileSync(EXP_MAIN, JSON.stringify(expDoc([
+  a({ kind: 'buttonState', op: 'present', value: '保存' }),
+  a({ kind: 'textHidden', op: 'absent', value: '页面加载中' }),
+  a({ kind: 'textVisible', op: 'appears', value: '新增成功' }),
+  a({ kind: 'urlPathname', op: 'startsWith', value: '/ai-manager/process/detail' }),
+])));
+const findPost = (axes, iid) => (axes.steps.find((s) => s.intentId === iid) || {}).postAssertions || [];
+const pick = (post, kind, value) => post.find((x) => x.kind === kind && (value == null || x.value === value));
+const parseSettle = (stderr, iid) => {
+  const m = String(stderr).match(new RegExp('settle intent=' + iid + ' waited=(\\d+) settled=(\\w+)'));
+  return m ? { waited: Number(m[1]), settled: m[2] === 'true' } : null;
+};
+
+await checkAsync('I1 延迟挂载主案（红先行核心）：mountdelay 采集延后至挂载后 → buttonState present 保存 ok:true/actual≥1、textHidden 页面加载中 ok:true、textVisible 新增成功 ok:true', async () => {
+  const srv = await startFakeSut({ scenario: 'mountdelay' }); // 缺省 mountDelayMs 800
+  try {
+    const OUT = join(tmp, 'i1-axes.json');
+    const r = run([REPLAY, '--events', EVENTS, '--sut', srv.url, '--expected', EXP_MAIN, '--profile', PROFILE, '--out', OUT]);
+    if (r.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
+    const axes = JSON.parse(readFileSync(OUT, 'utf8'));
+    const post = findPost(axes, 'intent_1');
+    const bs = pick(post, 'buttonState', '保存');
+    if (!bs || bs.ok !== true || !(Number(bs.actual) >= 1)) throw new Error(`buttonState present 保存 应 ok:true/actual≥1（挂载后采到），实际 ${bs && bs.ok}/${bs && bs.actual}（真机事故同签名 actual=0=红）`);
+    const th = pick(post, 'textHidden', '页面加载中');
+    if (!th || th.ok !== true) throw new Error(`textHidden 页面加载中 应 ok:true（占位已消失），实际 ${th && th.ok}/${th && th.actual}`);
+    const tv = pick(post, 'textVisible', '新增成功');
+    if (!tv || tv.ok !== true) throw new Error(`textVisible 新增成功 应 ok:true（延采约 1s 仍在 3000ms 典型消隐窗内），实际 ${tv && tv.ok}/${tv && tv.actual}`);
+  } finally { await srv.close(); }
+});
+
+await checkAsync('I2 垫调 0 条件兜住：mountdelay + REPLAY_SETTLE_FLOOR_MS=0 → 修后仍全绿（延迟挂载靠条件而非靠垫、不得加大固定值凑绿）', async () => {
+  const srv = await startFakeSut({ scenario: 'mountdelay' });
+  try {
+    const OUT = join(tmp, 'i2-axes.json');
+    const r = run([REPLAY, '--events', EVENTS, '--sut', srv.url, '--expected', EXP_MAIN, '--profile', PROFILE, '--out', OUT],
+      { env: { ...process.env, REPLAY_SETTLE_FLOOR_MS: '0' } });
+    if (r.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r.status}`);
+    const axes = JSON.parse(readFileSync(OUT, 'utf8'));
+    const post = findPost(axes, 'intent_1');
+    const bs = pick(post, 'buttonState', '保存');
+    if (!bs || bs.ok !== true || !(Number(bs.actual) >= 1)) throw new Error(`floor=0 时 buttonState present 保存 仍应 ok:true/actual≥1（静态占位期在途 fetch 撑住判据 A），实际 ${bs && bs.ok}/${bs && bs.actual}`);
+    const th = pick(post, 'textHidden', '页面加载中');
+    if (!th || th.ok !== true) throw new Error(`floor=0 时 textHidden 页面加载中 仍应 ok:true，实际 ${th && th.ok}`);
+  } finally { await srv.close(); }
+});
+
+await checkAsync('I3 即时渲染回归锁（冻结时即绿）：happy 同事件全绿 + settle 行 waited<1500 且 settled:true + 代表步 quietPointReached:true（固定下限不显著拖慢、不烧满预算）', async () => {
+  const srv = await startFakeSut({ scenario: 'happy' });
+  try {
+    const OUT = join(tmp, 'i3-axes.json');
+    const RH = join(tmp, 'i3-rh.jsonl');
+    const r = run([REPLAY, '--events', EVENTS, '--sut', srv.url, '--expected', EXP_MAIN, '--profile', PROFILE, '--out', OUT, '--run-history', RH],
+      { env: { ...process.env, REPLAY_DEBUG: '1' } });
+    if (r.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
+    const axes = JSON.parse(readFileSync(OUT, 'utf8'));
+    const bs = pick(findPost(axes, 'intent_1'), 'buttonState', '保存');
+    if (!bs || bs.ok !== true) throw new Error(`happy 即时渲染 buttonState present 保存 应 ok:true，实际 ${bs && bs.ok}`);
+    const st = parseSettle(r.stderr, 'intent_1');
+    if (!st) throw new Error('REPLAY_DEBUG 应落 settle 日志行（settle intent=intent_1 waited=.. settled=..）');
+    if (st.settled !== true) throw new Error(`即时渲染 settle 应 settled:true，实际 ${st.settled}`);
+    if (!(st.waited < 1500)) throw new Error(`即时渲染 settle waited 应<1500（不烧满预算），实际 ${st.waited}`);
+    const lines = readFileSync(RH, 'utf8').trim().split('\n').map((s) => JSON.parse(s));
+    const repr = lines.find((l) => l.stepId === 'atstep_3');
+    if (!repr || repr.quietPointReached !== true) throw new Error(`代表步 quietPointReached 应 true，实际 ${repr && repr.quietPointReached}`);
+  } finally { await srv.close(); }
+});
+
+await checkAsync('I4 观察者不是许愿机（冻结时即绿）：mountdelay + buttonState present 幽灵导出（从不出现）→ 修后 ok:false/actual:0 且 settle settled:true（DOM 稳定即放行，绝不承担「等到断言为真」）', async () => {
+  const srv = await startFakeSut({ scenario: 'mountdelay' });
+  try {
+    const OUT = join(tmp, 'i4-axes.json');
+    const EXP = join(tmp, 'exp-ghost.json');
+    writeFileSync(EXP, JSON.stringify(expDoc([a({ kind: 'buttonState', op: 'present', value: '幽灵导出' })])));
+    const r = run([REPLAY, '--events', EVENTS, '--sut', srv.url, '--expected', EXP, '--profile', PROFILE, '--out', OUT],
+      { env: { ...process.env, REPLAY_DEBUG: '1' } });
+    if (r.status !== 0) throw new Error(`replay 应 exit 0，实际 ${r.status}`);
+    const axes = JSON.parse(readFileSync(OUT, 'utf8'));
+    const bs = pick(findPost(axes, 'intent_1'), 'buttonState', '幽灵导出');
+    if (!bs || bs.ok !== false || bs.actual !== 0) throw new Error(`幽灵按钮应 ok:false/actual:0（期望驱动轮询=倒着裁，判据绝不读 expected），实际 ${bs && bs.ok}/${bs && bs.actual}`);
+    const st = parseSettle(r.stderr, 'intent_1');
+    if (!st || st.settled !== true) throw new Error(`settle 应 settled:true（DOM 稳定即放行、不为幽灵按钮空等），实际 ${st && st.settled}`);
+  } finally { await srv.close(); }
+});
+
+await checkAsync('I5 超预算照采 fail-safe（冻结时即绿）：mountDelayMs 6000 + REPLAY_SETTLE_BUDGET_MS=100 → replay exit 0、axes 落盘、buttonState 如实红（ok:false/actual:0）、代表步 quietPointReached:false', async () => {
+  const srv = await startFakeSut({ scenario: 'mountdelay', mountDelayMs: 6000 });
+  try {
+    const OUT = join(tmp, 'i5-axes.json');
+    const RH = join(tmp, 'i5-rh.jsonl');
+    const r = run([REPLAY, '--events', EVENTS, '--sut', srv.url, '--expected', EXP_MAIN, '--profile', PROFILE, '--out', OUT, '--run-history', RH],
+      { env: { ...process.env, REPLAY_SETTLE_BUDGET_MS: '100', REPLAY_DEBUG: '1' } });
+    if (r.status !== 0) throw new Error(`超预算仍应 replay exit 0（不因静默点报错吞步），实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
+    if (!existsSync(OUT)) throw new Error('超预算仍应 axes 落盘');
+    const axes = JSON.parse(readFileSync(OUT, 'utf8'));
+    const bs = pick(findPost(axes, 'intent_1'), 'buttonState', '保存');
+    if (!bs || bs.ok !== false || bs.actual !== 0) throw new Error(`超预算按现状采（挂载 6s 未完成）应 ok:false/actual:0，实际 ${bs && bs.ok}/${bs && bs.actual}`);
+    const st = parseSettle(r.stderr, 'intent_1');
+    if (!st || st.settled !== false) throw new Error(`超预算 settle 应 settled:false，实际 ${st && st.settled}`);
+    const lines = readFileSync(RH, 'utf8').trim().split('\n').map((s) => JSON.parse(s));
+    const repr = lines.find((l) => l.stepId === 'atstep_3');
+    if (!repr || repr.quietPointReached !== false) throw new Error(`超时代表步 quietPointReached 应 false（schema「false=证据可复现性存疑」口径一致），实际 ${repr && repr.quietPointReached}`);
+  } finally { await srv.close(); }
+});
+
+await checkAsync('I6 扰动走时上界回归锁（冻结时即绿）：churn 场景 → replay exit 0、settle settled:false、waited<4000（判据 A 归零故 networkidle 兜底跳过、绝不靠 REPLAY_WATCHDOG_MS 收尸）', async () => {
+  const srv = await startFakeSut({ scenario: 'churn' });
+  try {
+    const OUT = join(tmp, 'i6-axes.json');
+    const EXP = join(tmp, 'exp-churn.json');
+    writeFileSync(EXP, JSON.stringify(expDoc([a({ kind: 'urlPathname', op: 'startsWith', value: '/ai-manager/process/detail' })])));
+    const r = run([REPLAY, '--events', EVENTS, '--sut', srv.url, '--expected', EXP, '--profile', PROFILE, '--out', OUT],
+      { env: { ...process.env, REPLAY_DEBUG: '1' } });
+    if (r.status !== 0) throw new Error(`churn 应 replay exit 0，实际 ${r.status}`);
+    const st = parseSettle(r.stderr, 'intent_1');
+    if (!st || st.settled !== false) throw new Error(`churn（DOM 永不稳定）应 settled:false，实际 ${st && st.settled}`);
+    if (!(st.waited < 4000)) throw new Error(`churn settle waited 应<4000（判据 A 归零→兜底条件化跳过 2000ms 燃烧），实际 ${st.waited}`);
+  } finally { await srv.close(); }
+});
+
+// ─────────────────────────────────────────────────────────────────────────────
+// W 接线向：casey run 端到端裁定翻正。
+// ─────────────────────────────────────────────────────────────────────────────
+await checkAsync('W1 端到端裁定翻正：casey run 对 mountdelay → intent_1 PASS + 报告三件落盘（verdict.mjs 零改动前提下纯靠采集时机修正翻正）', async () => {
+  const srv = await startFakeSut({ scenario: 'mountdelay' });
+  try {
+    const runDir = join(tmp, 'w1-run');
+    mkdirSync(runDir, { recursive: true });
+    const r = run([CASEY, 'run', CASE_ID, '--sut', srv.url, '--events', EVENTS, '--expected', EXP_MAIN, '--profile', PROFILE,
+      '--run-dir', runDir, '--generated-at', '2026-07-14T00:00:00.000Z']);
+    if (r.status !== 0) throw new Error(`casey run 应 exit 0，实际 ${r.status}：${(r.stderr || '').slice(-200)}`);
+    const verdict = JSON.parse(readFileSync(join(runDir, 'verdict.json'), 'utf8'));
+    const v = (verdict.steps || []).find((s) => s.intentId === 'intent_1');
+    if (!v || v.verdict !== 'PASS') throw new Error(`intent_1 应 PASS（真机事故端到端翻正），实际 ${v && v.verdict}（reason=${v && v.reason}）`);
+    for (const ext of ['html', 'md', 'json']) {
+      if (!existsSync(join(runDir, `${CASE_ID}.report.${ext}`))) throw new Error(`缺 report.${ext}`);
+    }
+  } finally { await srv.close(); }
+});
+
+if (fails.length) {
+  for (const f of fails) console.error(`RED  replay-settle-mount: ${f}`);
+  console.error(`RED  replay-settle-mount: ${pass} 过 / ${fails.length} 红`);
+  process.exit(1);
+}
+console.log(`ok   replay-settle-mount: ${pass}/${pass} 全过（静默点单元 U1-U7 + 延迟挂载 I1/I2 + 回归锁 I3/I4/I5/I6 + 端到端 W1）`);
+process.exit(0);
diff --git a/tests/fixtures/fake-sut/CONTRACT.md b/tests/fixtures/fake-sut/CONTRACT.md
index b758b0b..ad10dec 100644
--- a/tests/fixtures/fake-sut/CONTRACT.md
+++ b/tests/fixtures/fake-sut/CONTRACT.md
@@ -37,7 +37,7 @@
 - 拖拽监听 `mousedown` 时才挂 document 级 `mousemove`/`mouseup`、`mouseup` 即卸，重渲不累积监听；`nodeSeq` 跨重渲递增，节点 id 不复用；路由切换重渲后画布清零（`data-node-count` 回 `0`）。
 - 类名对齐真机接缝：`.lf-graph` / `.lf-canvas-overlay` / `.lf-node` / `.lf-node-content` / `.node-item` / `.lf-node-anchor-hover` / `.lf-edge`；真机 `.lf-node` 是 SVG `<g>`，假 SUT 用 div 复刻类名 + 文本语义这条接缝，不复刻 SVG 标签结构。
 
-## 后端路由 × 场景（10 态，复现 verdict-cases 全八案）
+## 后端路由 × 场景（前 10 态复现 verdict-cases 全八案；`mountdelay`/`churn` 是回放静默点/走时上界考场，不入八案）
 
 > save 信封一律 `status` 形态：成功 `{status:200}`、软失败 HTTP 200 但 `body.status≠200`（`通道剖面` successField=`status`/successValue=200，复现 ADR-0006/observed-reality 的 Heren 接缝，绝不用旧 `{code}`）。
 
@@ -53,6 +53,8 @@
 | `drift` | 200 `{status:200}` | 200 | 列表只渲目标行 atl_wf_5fa1，脆性 css `.hr-table-row:nth-child(2) .hr-action-delete` 命中空，role=button name=删除 withinRow=atl_wf_5fa1 唯一仍在(count=1) | HARNESS_ERROR |
 | `vanished` | 200 `{status:200}` | 200 | drift 的反面：列表只渲非目标行 atl_目录CRUD_a，脆性 css 同样失配，但目标稳定签名 withinRow=atl_wf_5fa1 已不在(count=0) | NEEDS_HUMAN(INDETERMINATE)；堵漂移信号硬编码成 present:true |
 | `ambiguous` | 200 `{status:200}` | 200 | 渲染两个同名 `保存` 按钮→resolution=fallback_first | NEEDS_HUMAN(AMBIGUOUS_ACTION) |
+| `mountdelay` | 200 `{status:200}` | 200 | 详情页先渲静态占位 `页面加载中` → `fetch /api/process/editorData`（服务端延迟可配 `mountDelayMs` 缺省 800）→ 应答后替换挂载编辑器（保存钮 + 画布）；`新增成功` toast 3000ms 自动消隐 | 回放代表步静默点考场（占位期在途请求撑住复合判据 A，纯两拍判据反例）|
+| `churn` | 200 `{status:200}` | 200 | 编辑器即时挂载后 DOM 每 100ms 追加变长 + 背景轮询 300ms（denylist 内）；两拍稳定永不达成、在途 API 归零 | 走时上界考场（判据 A 归零故 `networkidle` 兜底条件化跳过，最坏走时压回约 2.75s）|
 
 ## 取证归因怎么靠假 SUT 落地（命门）
 
diff --git a/tests/fixtures/fake-sut/server.mjs b/tests/fixtures/fake-sut/server.mjs
index c501b6a..7eafae3 100644
--- a/tests/fixtures/fake-sut/server.mjs
+++ b/tests/fixtures/fake-sut/server.mjs
@@ -26,6 +26,12 @@ const SCENARIOS = new Set([
   // replay-nth-visible-hardening fix#2：抽屉挂一枚 display:none 的隐藏 .hr-select 触发器（占 DOM 序 index 0）+
   //   真·可见触发器——触发器域锁未限可见时误命中隐藏触发器，限 :visible 后只命中可见触发器。
   'ddhidden',
+  // replay-settle-mount：回放代表步采集前有界静默点考场。
+  //   mountdelay：详情页先渲静态占位「页面加载中」→ fetch /api/process/editorData（服务端延迟可配 mountDelayMs
+  //     缺省 800）→ 应答后替换渲染编辑器（保存按钮 + 画布）。复现真机数据请求驱动的 SPA 挂载 + 静态占位
+  //     （占位期 DOM 静止=纯两拍判据反例考场，在途请求撑住复合判据 A）；确认按钮「新增成功」toast 3000ms 自动消隐。
+  //   churn：编辑器即时挂载后 DOM 每 100ms 追加变长 + 背景轮询 300ms（denylist 内）——走时上界考场（判据 A 归零故兜底跳过）。
+  'mountdelay', 'churn',
 ]);
 
 // 背景轮询 denylist 的合成形态（绝不引真 site.json，护栏 #7）：watchNetworkForensics 用它把 /auths/poll 归 background。
@@ -77,6 +83,8 @@ function clientMain() {
   function toast(msg) {
     var t = el('div', { class: 'hr-toast', role: 'status' }, msg);
     document.body.appendChild(t);
+    // mountdelay：复现真机 toast 自动消隐（典型窗 3000ms）——延采不丢典型 toast 的回归锁考场；既有场景 toast 常驻零行为差。
+    if (scenario === 'mountdelay') setTimeout(function () { t.remove(); }, 3000);
   }
   function go(path) { history.pushState({}, '', path); render(); }
 
@@ -151,8 +159,6 @@ function clientMain() {
   function renderDetail() {
     app.innerHTML = '';
     if (scenario === 'pageerror') { throw new Error('注入页面错误（pageerror 场景）'); }
-    // 身份闭环（wf-open-smoke）：经行名打开时渲染被打开名——仅 __OPENED__ 置位才渲，既有通路（抽屉新增→详情）零行为差。
-    if (window.__OPENED__) { app.appendChild(el('div', { class: 'wf-open-title' }, window.__OPENED__)); }
     // drift：保存按钮换 class（录制 fallbackCss button.hr-button.wf-save 失配），但 role=button + name 保存 不变 → 同稳定签名唯一仍在。
     var saveClass = scenario === 'drift' ? 'hr-button wf-save-v2' : 'hr-button wf-save';
     function mkSave() {
@@ -164,12 +170,39 @@ function clientMain() {
       });
       return b;
     }
-    app.appendChild(mkSave());
-    // ambiguous：渲染第二个同名保存按钮 → 语义定位器多匹配 → 通用门 gateAndAct count>1 → resolution=ambiguous
-    //   （CONTEXT.md 第 79 行：多匹配唯一合法字面量=ambiguous；旧写法 fallback_first 在动作轴/裁定链语境已弃用）。
-    if (scenario === 'ambiguous') app.appendChild(mkSave());
-    // 画布通路（wf-add-node）：详情页尾部加法渲染，既有场景无人碰画布零行为差（wf-open-smoke 行名先例）。
-    renderCanvas();
+    // 编辑器挂载（保存按钮 + 画布）——既有场景同步调此挂载，DOM 与旧版逐字一致（零行为差）；
+    //   mountdelay/churn 走各自延迟/扰动分支后再调此挂载（replay-settle-mount 加法）。
+    function mountEditor() {
+      app.innerHTML = '';
+      // 身份闭环（wf-open-smoke）：经行名打开时渲染被打开名——仅 __OPENED__ 置位才渲，既有通路（抽屉新增→详情）零行为差。
+      if (window.__OPENED__) { app.appendChild(el('div', { class: 'wf-open-title' }, window.__OPENED__)); }
+      app.appendChild(mkSave());
+      // ambiguous：渲染第二个同名保存按钮 → 语义定位器多匹配 → 通用门 gateAndAct count>1 → resolution=ambiguous
+      //   （CONTEXT.md 第 79 行：多匹配唯一合法字面量=ambiguous；旧写法 fallback_first 在动作轴/裁定链语境已弃用）。
+      if (scenario === 'ambiguous') app.appendChild(mkSave());
+      // 画布通路（wf-add-node）：详情页尾部加法渲染，既有场景无人碰画布零行为差（wf-open-smoke 行名先例）。
+      renderCanvas();
+    }
+    // mountdelay（replay-settle-mount）：先渲静态占位「页面加载中」→ 数据请求驱动异步挂载编辑器。
+    //   占位期 DOM 静止（纯两拍判据会早退），在途 editorData 请求撑住判据 A——正是复合判据的反例考场。
+    if (scenario === 'mountdelay') {
+      app.appendChild(el('div', { class: 'hr-loading' }, '页面加载中'));
+      fetch('/api/process/editorData').then(function (r) { return r.json(); }).then(function () { mountEditor(); }).catch(function () {});
+      return;
+    }
+    // churn（replay-settle-mount）：编辑器即时挂载后，DOM 每 100ms 追加变长——两拍稳定永不达成、走时上界考场。
+    if (scenario === 'churn') {
+      mountEditor();
+      var grow = 0;
+      setInterval(function () {
+        grow += 1;
+        var pad = '';
+        for (var z = 0; z < grow; z++) pad += '.';
+        app.appendChild(el('div', { class: 'churn-row' }, 'churn-' + grow + pad));
+      }, 100);
+      return;
+    }
+    mountEditor();
   }
 
   // —— 画布通路（wf-add-node，LogicFlow 形态假画布）——
@@ -390,12 +423,18 @@ function pageHtml(scenario) {
     + '</body></html>';
 }
 
-function makeHandler(scenario) {
+function makeHandler(scenario, mountDelayMs = 800) {
   return function handle(req, res) {
     const u = new URL(req.url, 'http://127.0.0.1');
     const p = u.pathname;
     // 后端路由
     if (p === '/api/process/saveOrModifyProcessData' && req.method === 'POST') return saveResponse(res, scenario);
+    // mountdelay：编辑器数据请求，服务端延迟 mountDelayMs 后应答（驱动 SPA 异步挂载；其余场景不发此请求，延迟 0 无副作用）。
+    if (p === '/api/process/editorData') {
+      const delay = scenario === 'mountdelay' ? mountDelayMs : 0;
+      setTimeout(() => json(res, 200, { status: 200, data: { mounted: true } }), delay);
+      return;
+    }
     if (p === '/api/auths/poll') {
       // 背景轮询：background401 与 stale_bg401 回 401（body 用 status 形态、actual=401，复现 observed-reality 的 poll 记录）。
       var poll401 = scenario === 'background401' || scenario === 'stale_bg401';
@@ -417,10 +456,10 @@ function makeHandler(scenario) {
 // 假 SUT 起在【独立子进程】（fork）。关键：golden 用同步 execFileSync 跑 replay 会冻住调用进程的事件循环；
 // 假 SUT 若在同进程内，replay 期间就答不了浏览器请求（goto 卡死）。fork 到独立进程即不受阻塞——
 // 假被测系统本就该是独立进程。行为（8 态路由 + 客户端）一字未改，只把承载进程移出去。
-export function startFakeSut({ scenario = 'happy', port = 0 } = {}) {
+export function startFakeSut({ scenario = 'happy', port = 0, mountDelayMs = 800 } = {}) {
   if (!SCENARIOS.has(scenario)) throw new Error('未知 fixture 场景: ' + scenario + '（合法: ' + [...SCENARIOS].join('/') + '）');
   return new Promise((resolve, reject) => {
-    const child = fork(fileURLToPath(import.meta.url), ['--serve', '--scenario', scenario, '--port', String(port)], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
+    const child = fork(fileURLToPath(import.meta.url), ['--serve', '--scenario', scenario, '--port', String(port), '--mountdelay', String(mountDelayMs)], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
     let settled = false;
     const timer = setTimeout(() => { if (!settled) { settled = true; try { child.kill(); } catch {} reject(new Error('假 SUT 子进程启动超时')); } }, 10000);
     child.once('message', (msg) => {
@@ -449,7 +488,9 @@ function serveMain() {
   const argv = process.argv;
   const scenario = argv[argv.indexOf('--scenario') + 1] || 'happy';
   const port = Number(argv[argv.indexOf('--port') + 1] || 0);
-  const server = http.createServer(makeHandler(scenario));
+  const mdIdx = argv.indexOf('--mountdelay');
+  const mountDelayMs = mdIdx >= 0 && Number.isFinite(Number(argv[mdIdx + 1])) ? Number(argv[mdIdx + 1]) : 800;
+  const server = http.createServer(makeHandler(scenario, mountDelayMs));
   server.listen(port, '127.0.0.1', () => {
     if (process.send) process.send({ ready: true, port: server.address().port });
   });

```

## 四、门禁证据摘录

### `prd-replay-settle-mount` gate（`loop/prd-replay-settle-mount.json`）

- story `s1-settle-red-golden`：`passes: true`，evidence：`gate@2026-07-14T14:42:27.073Z 全部 acceptance exit 0`，acceptance 命令 `node tests/_golden/replay-settle-mount.golden.mjs`（15 金牌案）。
- story `s2-regression-and-resign`：`passes: true`，evidence：`gate@2026-07-14T14:47:57.690Z 全部 acceptance exit 0`，acceptance 含 8 条受影响金牌族 + `node bin/casey.mjs selftest --tier1`。

gate 日志尾部（`/tmp/gate-settle.log`）：
```
ok    ratchet  tests/_golden/replay-settle-mount.golden.mjs
ok    ratchet  tests/fixtures/fake-sut/server.mjs
ok    ratchet  tests/fixtures/fake-sut/CONTRACT.md
ok    term     术语检查通过
ok    s1-settle-red-golden  node tests/_golden/replay-settle-mount.golden.mjs
flip  s1-settle-red-golden  passes: false → true（由 gate 写入）
ok    s2-regression-and-resign  node tests/_golden/p5-replay.golden.mjs
ok    s2-regression-and-resign  node tests/_golden/p5-replay-coverage.golden.mjs
ok    s2-regression-and-resign  node tests/_golden/wf-publish-states.golden.mjs
ok    s2-regression-and-resign  node tests/_golden/wf-open-smoke.golden.mjs
ok    s2-regression-and-resign  node tests/_golden/kinds-harden.golden.mjs
ok    s2-regression-and-resign  node tests/_golden/run-history.golden.mjs
ok    s2-regression-and-resign  node tests/_golden/replay-nth-visible-hardening.golden.mjs
ok    s2-regression-and-resign  node tests/_golden/e2e-chain.golden.mjs
ok    s2-regression-and-resign  node bin/casey.mjs selftest --tier1
flip  s2-regression-and-resign  passes: false → true（由 gate 写入）

gate: GREEN —— story 2/2 过
```

### 重签涟漪 `prd-p5-replay` gate 复验（`/tmp/gate-p5.log`）

```
ok    ratchet  tests/_golden/p5-replay.golden.mjs
ok    ratchet  tests/_golden/p5-replay-coverage.golden.mjs
ok    ratchet  tests/_golden/fixtures/p5/replay-cases.json
ok    ratchet  tests/fixtures/fake-sut/server.mjs
ok    ratchet  tests/fixtures/fake-sut/CONTRACT.md
ok    ratchet  tests/_golden/fixtures/seams/events.fixture.json
ok    term     术语检查通过
ok    s1-replay  node tests/_golden/p5-replay.golden.mjs
ok    s1-replay  node bin/casey.mjs selftest --tier1
ok    s2-failsafe-coverage  node tests/_golden/p5-replay-coverage.golden.mjs

gate: GREEN —— story 2/2 过
```

sha256 重签（`git diff dev...HEAD -- loop/prd-p5-replay.json`）：`tests/fixtures/fake-sut/server.mjs` 与 `tests/fixtures/fake-sut/CONTRACT.md` 两条 testChecksums 更新，evidence 时间戳从 `2026-07-10T04:38:15.*Z` 刷新为 `2026-07-14T14:50:0*.*Z`。

### 重签涟漪 `prd-replay-nth-visible-hardening` gate 复验（`/tmp/gate-nth.log`）

```
ok    ratchet  tests/_golden/replay-nth-visible-hardening.golden.mjs
ok    ratchet  tests/fixtures/fake-sut/server.mjs
ok    term     术语检查通过
ok    s1-three-fixes-red-golden  node tests/_golden/replay-nth-visible-hardening.golden.mjs
ok    s2-resign-and-regression  node tests/_golden/wf-select-node-dropdown.golden.mjs
ok    s2-resign-and-regression  node tests/_golden/p5-replay.golden.mjs
ok    s2-resign-and-regression  node tests/_golden/wf-add-node.golden.mjs
ok    s2-resign-and-regression  node tests/_golden/wf-open-node.golden.mjs
ok    s2-resign-and-regression  node tests/_golden/wf-connect-nodes.golden.mjs
ok    s2-resign-and-regression  node tests/_golden/wf-open-smoke.golden.mjs
ok    s2-resign-and-regression  node tests/_golden/flow-bridge.golden.mjs
ok    s2-resign-and-regression  node tests/_golden/p3-compile.golden.mjs
ok    s2-resign-and-regression  node tests/_golden/e2e-chain.golden.mjs
ok    s2-resign-and-regression  node bin/casey.mjs selftest --tier1

gate: GREEN —— story 2/2 过
```

sha256 重签（`git diff dev...HEAD -- loop/prd-replay-nth-visible-hardening.json`）：`tests/fixtures/fake-sut/server.mjs` 一条 testChecksums 更新，evidence 时间戳从 `2026-07-10T05:0*.*Z` 刷新为 `2026-07-14T14:50:52.403Z` / `2026-07-14T15:02:25.772Z`。

### 全仓 ratchet 与 selftest tier1（契约摘要，主会话在案）

全仓 ratchet verify 71 PRD、194 冻结文件，仅 2 条已知 `cases/*/expected.frozen.json` `FILE_MISSING`（环境缺口，非本契约新增）、零新增漂移。`node bin/casey.mjs selftest --tier1` 在 `prd-replay-settle-mount`、`prd-p5-replay`、`prd-replay-nth-visible-hardening` 三 gate 内各跑一次均 exit 0（见上方三段 gate 日志内 `s1-replay  node bin/casey.mjs selftest --tier1` / `s2-regression-and-resign  node bin/casey.mjs selftest --tier1` / `s2-resign-and-regression  node bin/casey.mjs selftest --tier1` 三行均 `ok`）。

### 红先行存证（`docs/plans/replay-settle-mount/proposed/red/red-before-impl.txt`，摘录）

修前跑金牌：0 过 / 15 红。U1-U7 因模块不存在（`Cannot find module .../lib/replay-settle.mjs`）各自红签名；I1 `buttonState present 保存 应 ok:true/actual≥1，实际 false/0`（真机事故同签名）；I2 垫零同签名；I3-I6 因 settle 未接线各自缺失签名（`settled` 读到 `null`）；W1 `intent_1 应 PASS，实际 NEEDS_HUMAN（reason=SUT_DEFECT_OR_STALE）`（端到端复现真机事故）。

## 五、契约推进状态

`loop/active-contract.json`：`grill.done=true`、`plan.done=true`、`accept.done=true`、`loop.done=true`；`review.done=false`、`learn.done=false`（本轮评审即补 review 阶段的异构冗余料，裁决由评审者本人给出，本文档只备料）。
