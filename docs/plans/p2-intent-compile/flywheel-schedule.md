# 飞轮排期表（regress 38 条 flow 维度归类 + 移植预算 + S1 通用性反检）

> 2026-06-29 产出。来源：8 agent 并行精读 `D:\ctx\heren\regress_autotest` 的 38 条 flow + `atoms.registry`。对应 `docs/FLYWHEEL.md` 的「可选先做」。
> 结论先行：**五个维度全部加法式**——没有任何维度逼迫现在拓宽 `StepAxes` 顶层三轴（岔一坐实，护栏第十七条站得住）；但冻结前要锁三处字段级加法（见末节）。

## 维度归类 + 移植预算

| 维度 | flow 数 | 新增 distinct 原子 | 新增断言 kind | 累计原子 | 通用性 |
|---|---|---|---|---|---|
| `dom_crud` | 4 | 12 | 1（`buttonState`） | 12 | additive |
| `chat_streaming` | 2 | 18 | 2（`streamReplyReceived`/`replyNotError`） | 26 | additive |
| `publish_blocked` | 4 | 7 | 1（`buttonState`） | 29 | additive |
| `canvas_node` | 20 | 22 | 8 | 44 | additive |
| `agent_tool` | 8 | 21 | 5 | 54 | additive |

排期顺序（已锁，岔二）：`dom_crud`（catalog，装轴承，正做）→ `chat_streaming` → `publish_blocked` → `canvas_node`（压最后）。

## R9 坐标污染（route:human，不可早碰）

23 条纯坐标/无锚 flow：`canvas_node` 全 20 条 + 发布侧 3 条（`publish_blocked`/`test_blocked`/`wf_test_incomplete_published`）。一律标 route:human，画布维度压最后当 R9 探针。

## 第二条移植建议：`chiefcomplaint_smoke`

不碰 `agent_tool_e2e`（要 14 新原子 + deepseek-v3/三方 MCP 双 stale 依赖）。`chiefcomplaint_smoke` 是两条流式 flow 里唯一「纯真流式」基线——8 个新原子、零 R9，用最低成本把流式取证通路装上，正好证伪/证实 `chat_streaming` 的「纯加法」判断，再决定是否吞 `agent_tool_e2e`。

## 冻结前要锁的三处字段级加法（不动轴的形状）

`StepAxes` 三轴顶层不变，但下列字段级加法要在冻结前预留好，供后续维度纯加法接入：

1. `forensics.network[]` 项支持流式/SSE 响应体捕获（拦 `/ai-api/tester/agent/stream` 的 SSE body）——`chat_streaming` 与 `canvas` 的 trialRun（气泡稳定轮询 vs 流拦截两类信号）共用。
2. `postAssertions[].kind` 枚举随移植增长（`buttonState`/`textHidden`/`switchState`/`countEquals` 等）——只加 `check.mjs` + 加 golden。
3. `canvas_node` 的 `connectNodes` 预留一个可选 `forensics` 图拓扑快照字段（`window.lf`），补「连对哪两个节点」纯 DOM 读不到的缺口。

> 这三处都是字段级、加法式，不构成新顶层轴——印证护栏第十七条。第一处（`network[]` 支持 SSE body）与早先「流式 = 一条网络记录 + 一个断言」的判断一致。

## 对当前 loop（S1）的直接影响

S1 实现 `verdict.mjs`/`forensics.mjs`/`StepAxes` 时，按上列三处字段级加法**预留好形状**（不实现 chat/canvas 的具体逻辑），这样第二条 `chiefcomplaint_smoke` 接上去是纯加法、不重开 accept。
