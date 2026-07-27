# page-topology-auth-continuity 独立终审

- 复核日期：2026-07-27
- 复核范围：`page-topology-auth-continuity` zero-SUT 契约及必要邻接回归
- 复核方式：只读源码审计、本地合成 golden、PRD dry gate
- 本契约结论：**PASS**

本轮没有修改生产实现。正式 gate 已将本 PRD 推进为 6/6；独立复跑确认测试、冻结 checksum、术语、结构和邻接输出契约均为绿色。

## 1. 本契约验收

| 验收面 | 结果 | 结论 |
|---|---:|---|
| controller | 7/7 | PASS |
| delayed popup / binding-arrival race | 5/5 | PASS |
| session seed / per-page forensics | 5/5 | PASS |
| record/distill topology pipeline | 6/6 | PASS |
| formal replay newpage action | 3/3 | PASS |
| static boundaries | 7/7 | PASS |
| adjacent auth regression | 4/4 | PASS |
| 合计 | 37/37 | PASS |

`node loop-kit/bin/gate.mjs --prd loop/prd-page-topology-auth-continuity.json --dry` 结果：

- 13/13 冻结文件 checksum 匹配；
- 术语检查通过；
- PRD story 为 6/6 `passes:true`；
- 最终输出 `gate: GREEN —— story 6/6 过`。

## 2. binding-arrival opaque token

结论：**PASS**。

录制端对 click/dblclick 的 handoff generation 在 binding 到达时同步冻结，而不是等异步事件队列轮到该 click 后才取边界：

1. `record-bridge` 的 `handleBinding` 先规范化事件并立即调用 `captureHandoffArrival`，随后才把 `processEvent` 排入串行 tail。
2. `captureHandoffArrival` 同步读取活动 page authority，并调用 controller 的 `captureHandoffBoundary`。
3. controller 用冻结的空对象作为 token；真实 boundary 只存于模块私有 `WeakMap`。
4. token 同时绑定 controller state、opener record 和一次性 consumed 状态。clone、forge、跨 controller 使用和重放都会在 DOM 动作前以 `PAGE_HANDOFF_BOUNDARY_INVALID` 拒绝。
5. 新的 binding arrival 会按当前 page-event ordinal 封口前一 generation；`performClick` 只消费 token 所界定的 `(startOrdinal, endOrdinal]` 注册结果。
6. token 只在 `record-bridge` 到 `controller.performClick` 的进程内调用链中传递；没有进入 capture、distill、formal events、日志或报告。

对应合成回归已经覆盖：

- binding 到达后、queued `performClick` 前出现的 popup 不丢失；
- 后一个 click arrival 会封口前一 generation；
- token clone/forge/replay 均拒绝；
- token 路径下 `>1` popup 与 cross-origin 仍然 fail-closed 并收容。

## 3. recorder 与 replay 生产接线

结论：**PASS**。

Recorder：

- `bin/record.mjs` 在创建首个 page 前安装 context 级 binding、init script 与 `context.on("page")`。
- binding 回调进入 `recordBridge.handleBinding`，click/dblclick 使用上述 arrival token 调用 controller `performClick`。
- 唯一同源新页成功 handoff 后只追加安全 `{action:"newpage", path}`；歧义、跨源或注册失败均不任挑页面。

Replay：

- `bin/replay.mjs` 通过 `openReplayTopology` 建立 controller，将其注入 `ctx.pageTopology`，并使用 active-page facade。
- 普通非 nav 动作经 `dispatchActivePageReplayAction`；click/dblclick 由 controller `performClick` 包住真实动作，因此回放侧同样按动作边界识别 0/1/>1 新页。
- formal `newpage` 在 locator 解析前经 `dispatchNewPageReplayAction` 和共享 replay bridge 消费，不触碰旧固定 page。
- source capture 与 distilled formal sequence 共用 topology normalization/consumer；结构事件不序列化 runtime page authority 或 binding-arrival token。
- 每个新页在激活前安装同源 session seed 与 per-page forensics；cross-origin 连续性无法证明时返回稳定失败并路由人工。

录制端需要 arrival token，是因为浏览器 binding 回调与 context page event 可能在队列中交错；回放端直接在真实动作调用前进入 controller `performClick`，无需序列化或伪造该 token。两端最终共用同一个 controller handoff 状态机和结构 `newpage` 消费协议。

## 4. 邻接关键门

| 邻接契约 | 结果 | 结论 |
|---|---:|---|
| cross-platform execution target | 37/37 | PASS |
| output-seal B5 prelaunch | 1/1 | PASS |
| agent-id regression diff | 21/21 | PASS |
| output-seal | 27/27 | PASS |

所有命令退出码均为 0。邻接门确认 page topology 接线没有破坏执行目标 origin、登录前置拒绝、身份观察基线或输出脱敏。

## 5. 文件边界与 diff

本契约涉及的生产接线和 golden 文件均不超过 600 行。较大的生产文件为：

| 文件 | 行数 |
|---|---:|
| `bin/replay.mjs` | 580 |
| `lib/page-topology/controller.mjs` | 549 |
| `lib/page-topology/record-bridge.mjs` | 405 |
| `bin/record.mjs` | 288 |
| `lib/replay-forensics.mjs` | 265 |

其余本契约模块与 golden 均低于上述值；static boundaries 7/7 同时钉住模块存在、依赖边界、薄接线与 600 行上限。`git diff --check` 退出码为 0。

该结论仅针对本契约范围，不扩写为全仓历史文件均不超过 600 行。

## 6. 真实环境核销

真实 AI 中台、医生站、Hi 小助 CEF 与 Windows/macOS/Linux 浏览器行为仍按 PRD `observability` 保持 `route:human`，包括：

- 真实 popup/new tab 与登录连续性；
- cookie/localStorage/sessionStorage 的实际属性及时序；
- 跨 origin SSO；
- popup/opener 关闭组合；
- 真实 per-page CDP/network/pageerror/dialog 取证；
- source replay 与 distilled replay 的独立 fresh-state 实机报告；
- AI 中台更新后的 version-held-out 页面。

这些项目不能由合成 double 冒充已验收；同样，它们是明确留给实机 UAT 的真实性核销，不因尚未执行而否定已经完成的 zero-SUT 契约。

最终结论：`page-topology-auth-continuity` 本契约 **PASS**，真实 SUT UAT 保持 `route:human`。
