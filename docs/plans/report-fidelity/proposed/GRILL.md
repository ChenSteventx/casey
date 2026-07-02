# GRILL — report-fidelity（light，三机械决策）

授权：HANDOFF「直接下一步 ①」首推项 + Steven「开工」（2026-07-02 夜）。实证源 = 首份真机报告体检（`runs/tc_catalog_wf_crud/run_1783000971249/`）。无承重分岔，三决策均由既有先例/定理推导：

- **G1 `--expected` 接线口径**：`bin/report-model.mjs` 加可选 `--expected`（读冻结 expected 契约）；签署投影 = 全部断言过 `lib/sign-gate.mjs` 的 `isSigned` 且 `signedAgainstBuild`/`signerId` 均一 → 投影入 meta；任一未签或不均一 → 不投影（报告如实显「未签」，fail-closed 不粉饰）。显式 `--case-meta` 字段优先于 expected 推导（既有投影设计不动）。`casey run` 的装配 stage 恒透传 `--expected`（run 本就必带该参）。原「押后真机 bring-up」取舍注释更新为已兑现。
- **G2 脱敏收窄口径**：`redactScalar` 对「纯路径形态 token」（`^/[A-Za-z0-9_\-./]*$`，不含 `= ? & @ : %`）改走既有 `redactUrlPath` 逐段脱敏，不再整 token 撞 `OPAQUE_BLOB` 长串启发式——32+ 字符纯路径（如 `/heren/aimanagement/process/list`）保可读；路径内敏感段（长串/敏感词/邮箱）仍逐段拦。凭据方向零放松：含 `=`/`%`/`@` 等 kv·编码·邮箱形态一律走原整 token 判。layer3 十二轮硬化的金丝雀全保。
- **G3 actual 回填口径**：`evaluateAssertions` 每条加性回填标量 `actual`（urlPathname→实测 pathname；countChange→`before→after` 字符串；noPageError→归因 pageerror 计数；noErrorEnvelope→归因坏信封计数；streamReplyReceived→流状态码；未实现 kind→null 不硬凑）。装配器 175 行本就吃 `a.actual`（标量约束 + 脱敏既有）；axes 非冻结接缝、字段纯加法。
