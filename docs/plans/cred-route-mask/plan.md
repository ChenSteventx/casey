# cred-route-mask — 凭据路由名源头打码（direct）

## 改动

1. `lib/cred-gate.mjs`：新增导出 `maskCredentialRoute(url)`——路径段命中禁字段关键词替换 `<redacted:cred-route>`；query/hash 原样（携凭据仍被门拦）。`credentialGate`/`FORBIDDEN_KEYWORDS` 零改。
2. `lib/compile-atoms.mjs`：`requestLogPath` 输出过 mask（observed requestLog）。
3. `bin/replay.mjs`：`projectNet` 与孤儿投影的 `url` 过 mask（axes；报告装配下游同源受益）。
4. `tests/fixtures/chat-sut/server.mjs`：非 stale 场景发送先 `fetch` 凭据关键词路由（真机同款时序），服务端回 `{status:200}`。
5. 新 golden `tests/_golden/cred-route-mask.golden.mjs`（红先行）：mask 单元三向（命中段替换/干净路径原样/大小写不敏感）+ 门配对（打码后过门、原样被拦）；`chiefcomplaint-smoke.golden` 补两钉（C2 observed 打码痕迹 + I1 axes 全文无原始路由名）→ 双 prd 补冻。

## 验收

新 golden 全绿（实现前红：夹具带 token 路由后 compile C2 被门拦 exit 1）；chiefcomplaint golden 11/11；p5 两冻结 + layer3 + run-history 回归锁；gate GREEN；真机编译复跑过门落四件套（route:human 顺手核）。
