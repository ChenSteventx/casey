# GRILL · credgate-lineage-keys（Steven 裁定定案）

裁定：2026-08-08 当轮会话内点选**门学形状豁免**（三选一：豁免 / 改字段名 / 改日再裁）。
背景裁定链同日：邮件「继续」+ 两裁 kind 泛化 + 重铸票据 c。

1. **缝的本体（第十例「从未走通过」）**：v3 清理取证 `cleanupEvidence()`
   （`lib/entity-created-workflow-continuity-v3.mjs:818` 一带）经
   `projectReplayAxes`（`lib/replay-axes.mjs:129`，`cleanup` 块顶层原样铺开）落
   axes 文本，字段名 `batchToken`/`uniqueNameToken` 含 `token` 子串；
   `credentialGate`（`lib/cred-gate.mjs:44`）对全文做小写包含匹配 →
   `AXES_CREDENTIAL_GATE_REJECTED` → `ReplayFinalizeAbort` → 顶层吞成
   `REPLAY_INTERNAL_ERROR` exit 1。票据 c/d 两跑实证：回放执行链全程走通
   （27.8 秒，登录/18 步/建删/缺席采样均执行），恒死于落盘门。p9 金牌只钉投影
   纯函数，从未把产物文本推过凭据门——相容性缺口。

2. **修形（键感知 + 严格值形状，只动扫描副本）**：
   - 新闭集 `NON_CREDENTIAL_JSON_KEYS = ['batchToken', 'uniqueNameToken']`
     （域定义世系字段，CONTEXT 既有令牌语义；不收任何通配）。
   - 关键词分支扫描前对文本做**键中和**：
     `"<键名>"\s*:\s*(null|"<严格值形状>")` 的**键名**替换为不含关键词的中性标记，
     值原样保留（值仍受关键词与字面量两分支全额扫描）。
   - 严格值形状 = `^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`（与 `--unique-name` 合法域
     同构）；形状不符（走私可疑值）不中和、照拦。
   - **产物字节一字不动**；敏感字面量分支仍扫原文；其余关键词、大小写无关、
     first-hit 语义一字不变。
   - 先例：R1-F5「键感知 + 值形状校验」豁免（`collectSecretLiterals` 的
     role/successField/background）与 `maskCredentialRoute`（路由段 token 误伤）
     ——同族第三例。

3. **安全论证（评审必咬）**：中和只消键名文本；批令牌值若为已收集敏感字面量仍被
   字面量分支拦（扫原文）；值含 `token` 子串仍被关键词分支拦（fail-closed 从紧）；
   非闭集键（如 `accessToken`）零豁免。门无任何「按调用方声明放行」面。

4. **冻结面预期**：`p7-credgate-coverage` 金牌关键词回路不含 `token`
   （只注入 authorization/set-cookie/password/secret/credential）——预期零触碰绿、
   **无须 checksumAmendment**；seams-freeze 家族不钉关键词表。实证后如实记收据；
   若任一转红，停下走改版人签，不擅动冻结件。

5. **非目标**：不动 FORBIDDEN_KEYWORDS 表本体；不改 axes/取证字段名与 tier2 消费链；
   不碰 maskCredentialRoute/stripUrlQuery；不动 compile/report 调用面。

6. **修通预期（预登记）**：合入后铸票据 e（同授权基础，窗口今晚珀斯 23:59:59）
   重跑 replay → 预期 axes 落盘、相 3 真机回放首过或停于下一门如实报 →
   verdict → report。
