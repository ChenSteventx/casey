# sign — grill 决策记录（相2 人签门，full）

## 背景

`bin/draft.mjs` 产 `expected.draft-<caseId>.json`（未签草稿，含 `pending[]` 留痕），明确「人签冻结不在本 CLI」。
相2 sign 补上这道门：盖 `signedAt/signedAgainstBuild/signerId`（ADR-0004 §3-4）→ 产符合
`expected-frozen.schema.json` 的冻结契约 → checksum 冻进 prd 的 `testChecksums`（仅断言文件，护栏 #5）→
把「未签→裁定拒算数」fail-closed 接进回放链路。`lib/sign-gate.mjs` 的读侧门（`isSigned`/
`assertSignedContract`）已建（P4 冻结），本相是它的签发端 + 接线端。

## D1 未签闸落点（真岔，Steven 拍板）

**接进 `bin/replay.mjs` 前置闸**（读完 expectedDoc 后、开浏览器前 `assertSignedContract(expectedDoc)`
非 ok 则 exit 65 fail-closed）。一处收口 direct-replay + casey run 两条路、无绕过后门（护栏 #14）。
备选「只在 casey run 编排器加闸」保 replay sign-agnostic，但留 direct-replay 后门——否。

**知情选择**：空断言契约 `assertSignedContract` vacuously ok（video-login-carry 等空 expected 不受影响）；
但**所有喂非空未签断言给 replay 的金牌都会被拦**——实测 7 个：`p5-replay`/`layer3-wiring`（回放内核）+
`chiefcomplaint-smoke`/`kinds-harden`/`replay-video`/`wf-history-version`/`wf-publish-states`（飞轮）+
`scripts/sample-report.mjs` 工具。Steven 拿到真实爆炸半径（~7 金牌补签 + 每个 replay 单测耦合人签）
仍选无后门。**故这些金牌的 inline expected 全部补签**——这也让它们从「测未签契约」转成「测真实
已签契约回放」，语义更贴近真机。

## D2 pending 处置（护栏取向：非空拒签，别静默丢）

默认 `pending[]` 非空 → exit 65 拒签（人不该对还有未映射意图的契约背书；静默丢 = 抹掉 route:human
信号）。`--force` 放行但**留痕**：pending 写独立旁车 `expected.frozen.<caseId>.pending.json`（frozen 因
`additionalProperties:false` 不能内嵌 pending），签署人显式承认。

## D3 expectedVerdict（写不写、谁给值）

schema 可选、draft 不产。它是**人签时的期望多态裁定基线**：由 `--verdict-baseline <f>`（intentId→
{verdict,reason}）人给值，逐 intent 盖上并强制 fail-safe 不变量（终判 reason=null；NEEDS_HUMAN 须带
reason 子类）。缺 baseline 则**不造**——**绝不由 CLI 从断言反推 expectedVerdict**（倒着裁禁区，
[[dont-rig-fixtures-reproduce-frozen-seams]]）。

## D4 重签 / 期望版本化（ADR-0004 §4）

`--against-build` 每次必给；已存在 frozen 且 build 不同须带 `--resign`，先把旧 frozen 归档
（`archive/expected.frozen.<caseId>.<oldBuild>.<ts>.json`，旧期望归档不销毁）再覆写、更新 testChecksums
到新 sha + 新 signedAgainstBuild。无 `--resign` 而 frozen 已存在 → 拒覆写（anti-clobber）。**重签绝不
自动记缺陷**（有意改版走 NEEDS_HUMAN→人重签，不触 failure-ledger）。

## D4.1 防篡改分层（codex R3-F2 边界说明）

replay 的 caseId 双向绑定（非空契约两侧 caseId 必在且等）是**轻量防误接**——挡「用 A 的签名跑 B 的
events」「删 caseId 绕过」。但**手改已签 frozen 顶层 caseId 去匹配 B**这类 transplant，replay 层测不出
（replay 拿的是 --expected 文件、不持 prd、验不了 checksum）。这是**分层防御**、非缺陷：真正的防篡改是
frozen 的 **checksum 冻结**（改任何字段→sha 变→gate Test Ratchet 红）+ 人签门——那是 gate/authoring 层
的职责。replay 是「可信、已签、已 checksum 冻结契约的确定性执行器」，不承担防篡改；让 replay 校 prd
checksum = 越权耦合（改所有调用方 CLI 契约）。故不扩 replay，记此边界。绕过路径（直调 replay 跑手改 frozen、
且旁路 gate）在威胁模型外（operator 可信；冻结防的是漂移+审计，非恶意 operator 直接投毒）。

## D5 checksum 冻结边界（护栏 #5）

只 `expected.frozen.json` 进 `testChecksums` + 设 `expectedFrozenPath`；spec/events 绝不进 testChecksums。
sign 是 testChecksums 的新写入者（合法：`passes` 只 gate 写，testChecksums 由冻结者写），不碰 gate.mjs
校验逻辑。

## D6 非目标

- 真人签身份核验 / 交互式签名（route:human）——本相只做确定性字段写 + 闸接线，`--signer` 当可信输入。
- 不碰 verdict.mjs 判定树、不给 verdict 加 expected/sign 入参（保 L0 零 LLM，护栏 #15；verdict 仍只吃 axes）。
- 不产/不发明断言内容、不反推 expectedVerdict。
- 不改 gate.mjs 校验器、不冻 spec/events。
- 不做真站真机 UAT（gate 绿 ≠ 完成）。

## 涟漪清单（D1 知情选择的落地面）

碰 `bin/replay.mjs`（加未签闸）→ 7 金牌 + 1 工具补签 + 各自 prd 重签重跑：
`p5-replay` / `layer3-wiring` / `chiefcomplaint-smoke` / `kinds-harden` / `replay-video` /
`wf-history-version` / `wf-publish-states` / `scripts/sample-report.mjs`。用共享测试 helper
`signExpected()` 深盖签署字段减 churn。每个动过的金牌重签其 prd testChecksums + gate 复验 GREEN。
