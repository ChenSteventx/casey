# plan · chief-stream-replylog-import（light）

## 背景与根因

2026-08-03 与 2026-08-04 两轮 chief 真机 compile 均败于第 5 步 `chat.sendAndWait`
（`COMPILE_ATOM_EXECUTION_FAILED`，持久动作证据 `CONFIRMED`——消息已发出、失败在其后）。
只读探针 hermetic 复现坐实根因：`lib/compile-atoms-agent.mjs:342` 使用 `requestLogPath`
回填 `observed[].replyStreamUrl`，但第 9 行 import 清单漏了它（函数在
`lib/compile-atoms-support.mjs:40` 导出）。流取证记录在场时该行必抛 `ReferenceError`；
无流记录时不触发——所以 hermetic 金牌全绿（夹具没有流记录形态），真机必炸。
该抛点同时反证两轮的流请求都真实发起。

## 修法（最小）

`lib/compile-atoms-agent.mjs` 第 9 行 import 清单增加 `requestLogPath` 一词。零行为语义变更
（本就该这么工作）；`requestLogPath` 自带凭据路由打码（`cred-route-mask`），落盘面不变。

## 验收

新金牌 `tests/_golden/chief-stream-replylog-import.zero-sut.golden.mjs` 四钉：
S1 流记录在场不抛且 `replyStreamUrl` 首次落为脱敏 pathname、`replyText` 回填；
S2 无流记录保持 null（回归钉）；S3 持久动作证据两形态保全；S4 import 清单结构钉。
红基线实跑 2/4（S1/S4 红），证据 `accept/red-proofs/replylog-import.red.txt`。

邻接复跑：`compile-execution-failure-seal`（唯一直接消费 compile-atoms-agent 的既有金牌）+
chiefcomplaint 面 `teachin-admission-side-effect-policy` + `term-lint --registry` + `selftest --tier1`。

## 非目标

不动 `chat.sendAndWait` 等待判据与预算；不动流路径常量；不碰任何冻结件。
真机重跑第三次 compile 须 Steven 另行明示（每跑一次多一条真实消息）。
