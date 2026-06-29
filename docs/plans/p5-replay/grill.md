# p5-replay — grill（确定性回放 + 取证 + 三轴 + 漂移探针）

> full 车道 grill 阶段。2026-06-29 与用户逐条 grill 拍板；难逆转两条落 ADR-0007。

## 边界（不动的前提）

- 裁判零 LLM、verdict.mjs 已冻（护栏 #15）：回放只产三轴 `axes.json`，verdict 独立 node 消费、不进回放进程。
- 只读漂移探针在 P5、写回自愈在 P6（拆循环依赖，design §P5/§P6）。
- 消费已冻接缝：`events.json` / `observed-reality` / `StepAxes` / `verdict.json` / `expected.frozen.json`（seams-freeze 已冻）。
- gate 绿 ≠ 完成（护栏 #16）：真站回放 + 注入故障出 SUT_DEFECT 是 route:human tier-2。

## 决策树（7 条，逐条 grill 拍定）

1. **回放运行时基座 = A 采纳 @playwright/test**（ADR-0007）。回放生成 `.spec.ts` 跑 playwright test，复用 autotester `robust-actions`/`_fixtures`/`watchPageLifecycle`/`waitForReplyByStream`；写 `axes.json` 给 verdict.mjs。耦合只锁回放层。
2. **取证归因 = CDP 真发起方 + site.json 背景 denylist + 证不出归 null**（ADR-0007，fail-safe 命门）。null 永不背书，背景 401 进不了 verdict。
3. **三轴裁定单元 = intent**。回放按 intentId 聚合 N 个 event、依序回放、到 intent 静默点查该 intent 的 `expected[]` → postAssertions；`actionPerformed` 由各 event resolution 聚合（全唯一→true / 任一兜底→ambiguous / 终态没点中→false）；forensics 收该 intent 期间归因请求；每 intent 出一条 StepAxes（stepId=终态 event 的 stepId、intentId=该 intent）。
4. **hermetic 假 SUT = 本地 fixture server**（移植 autotester `web/server.mjs`）：静态假 SUT HTML + 可脚本化路由（状态码/信封 body/SSE 流/触发 pageerror），一处覆盖 XHR 5xx/401/信封 + 流式 + 生命周期。
5. **流式静默点**：移植 `waitForReplyByStream`；流式步静默点 = 流 `finished()`（非 networkidle）；`streamReplyReceived` 只判匹配响应回 expectedStatus + finished，body/duration 不进 verdict（§4.4）。
6. **漂移探针 `findEquivalentAffordance`**：只读查同稳定签名（`role+accessibleName` + 行/scope，对齐 drift-patch `stableSignature.canonical`）、count===1 → `sameSignatureUniquePresent=true`；不点、不改 spec。
7. **唯一名实例化**：移植 `_data_runner` 的 `instantiate`；`atl_` Reserved Prefix 由 compile-gate `uniquePrefix` 注入进冻结 event 值，回放只填 `{{uniqueName}}`；`uniqueGuard` 走建名查重。

## 待 plan/accept 细化

- axes.json 的精确落盘格式（应与已冻 StepAxes 形态逐字对齐，回放产出即 verdict 输入）。
- fixture server 的路由脚本契约（覆盖 8 态所需的 XHR/SSE/pageerror 组合）。
- CDP initiator 栈分类的具体判据 + denylist 在 site.json 的字段。
- robust-actions/_fixtures 从 autotester 的移植清单（哪些直拷、哪些改）。
