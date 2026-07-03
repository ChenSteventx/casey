# GRILL — cred-route-mask（direct，机械决策）

授权：Steven 在场拍板「源头打码（推荐）」（2026-07-03，真机停站②凭据门误伤处置三选一）。误伤实证：真机发送期应用自取临时凭据的路由名 `/ai-manager/auths/getTempTokenForApi` 字面含 `token`，凭据兜底门关键词扫描按设计 fail-closed 拒写 `observed`——拦的是路由字面非凭据值（值在响应体、本就不落盘）。

机械决策三条：

- **G1 打码位置 = 落盘投影处，门零弱化**：`lib/cred-gate.mjs` 新增 `maskCredentialRoute(url)`（路径段命中 `FORBIDDEN_KEYWORDS` → `<redacted:cred-route>`，其余段保留、query/hash 原样不动——query 携凭据仍由门拦，fail-closed 方向不变）；消费点 = `compile-atoms` 的 `requestLogPath`（observed）+ `bin/replay.mjs` 的 `projectNet`/孤儿投影（axes，报告下游同源受益）。`credentialGate` 本体一字不改。
- **G2 夹具保真升级**：chat-sut 发送时序补真机同款「先取临时凭据再开流」调用，使 hermetic 考场端到端覆盖打码链路（compile C2 观测 + replay I1 轴侧）；stale 场景（死发送）不加。
- **G3 无凭据关键词路由零行为差**：p5/catalog 夹具路由不含关键词，投影原样——既有冻结 golden 回归锁背书。
