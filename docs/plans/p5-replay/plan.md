# p5-replay — plan（确定性回放 + 取证 + 三轴 + 漂移探针）

## 背景与边界

P5 ★核心：确定性回放已冻 `events.json` → 产三轴 `axes.json` → 喂已冻 `verdict.mjs`。决策见 `grill.md` 7 条 + ADR-0007。裁判零 LLM 不变；只读漂移探针在 P5、写回自愈在 P6；取证按 CDP 真发起方归因、证不出归 null；gate 绿 ≠ 完成（真站 tier-2 走 route:human）。

## 组件（按 ADR-0007 / grill 决策）

1. 回放 runner（基座 A）：消费 events.json，按 intentId 聚合 N 个 event 依序回放；移植 autotester `robust-actions`/`_fixtures` 关键动作（click/fill/selectOption/nav/press）；唯一名移植 `instantiate`（`atl_` 由 compile-gate 注入、回放填 `{{uniqueName}}`）。
2. `watchNetworkForensics`（新建）：CDP `Network` 域取真 initiator → `{url,status,ts,initiator,attributedStepId,errorEnvelope}`；site.json 背景 denylist + 定时器源 → background/null；含糊归 null（fail-safe）。
3. `watchPageLifecycle`（移植）：crash/close/pageerror，按本步归因。
4. StepAxes 产出（按 intent，D3）：每 intent 一条 `axes.json` 项，形态与已冻 `verdict-cases.json` 的 StepAxes 逐字对齐（action/postAssertions/forensics）；`actionPerformed` 由各 event resolution 聚合。
5. 只读漂移探针 `findEquivalentAffordance`：locator miss 时只读查同稳定签名 count===1 → `driftProbe.sameSignatureUniquePresent`，不点不改 spec。
6. hermetic 假 SUT：移植 autotester `web/server.mjs` 的本地 fixture server（静态假 SUT HTML + 可脚本化路由：状态码/信封 body/SSE 流/触发 pageerror）。

## 验收点（命令化 hermetic）

- [命令] 回放 runner 对 fixture server 跑通合成 `events.fixture` 全 intent、无崩溃、产出 `axes.json`。
- [命令] `axes.json` 每条符合已冻 StepAxes 形态（喂 `bin/verdict.mjs --axes axes.json` exit 0、产 verdict.json）。
- [命令] 注入：fixture server 对某 save 路由回 500 + 错误信封 → 该 intent 三轴 forensics 背书本步 → verdict 出 `SUT_DEFECT`。
- [命令] 背景归因：fixture server 起一个 denylist 内的轮询回 401（归别步/background）→ 不背书 → 该 intent verdict 不翻成 SUT_DEFECT（PASS/INDETERMINATE）。
- [命令] 漂移探针：events 的某 locator 在假 SUT 上 miss、但同稳定签名唯一元素在 → `driftProbe.sameSignatureUniquePresent=true` → verdict 出 `HARNESS_ERROR`。
- [命令] 流式：fixture server SSE 路由 → `waitForReplyByStream` 等到 finished()、`streamReplyReceived` 只判回 expectedStatus+finished（body 不进 verdict）。
- [命令] `casey selftest --tier1` 无回归。

## route:human（tier-2，gate 绿≠完成）

- 真 Heren 站回放 `catalog_wf_crud` 全 PASS（需 site.json + 登录态）。
- 对真 save POST 注入 HTTP500 → 真站 verdict 出 `SUT_DEFECT` 而非 HARNESS_ERROR（最关键真机验收）。
- CDP initiator 栈分类在真站流量下的可靠度（ADR-0007 推翻条件）。

## 红基线

各 golden 先写、组件未实现时跑红（缺 runner/forensics/server）→ 落齐转绿。

## 完成判据

gate GREEN（命令化层）+ selftest tier1 无回归；tier-2 真机走 route:human。下游 P6 自愈消费本层 verdict 的 HARNESS_ERROR + drift 接缝。
