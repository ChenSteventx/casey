# zero-shot-observe-admit-step · S2 收口评审

> 评审日期：2026-07-27
> 结论：行为主链的高风险缺口与公共 `PageObservation` 脱敏均已修复并重冻；
> 正式 `gate` 于 2026-07-27 全部通过。本结论仍不替代真实 SUT UAT。

## 1. 评审边界

本次只评审 S2 的 observe → admit → execute → progress 单步技术闭环，以及为满足
`<=600` 行边界而拆分的 S1 setup 核心。候选动作和探索轨迹始终
`signed:false/replayReady:false`；正式 replay、verdict、entity identity 与生产 UAT 不在本契约内。

判断遵循两条边界：

1. 能由 builder authority、全页 exact、物理节点重验和闭集策略确定的事实，直接走确定性代码；
2. 证据不足时只拒绝或 `route:human`，不让 LLM 补权限、补身份或裁定测试结论。

## 2. 已修复 finding

| finding | 已落机制 | 可执行证据 |
|---|---|---|
| mapping authority 绕过 | `mappingFromIntentPlan` 先验证 `buildIntentPlan` 原对象 authority 与未改写内容；手造、clone、spread、改写 plan 不再能投影 mapping | R5；resolver/contract B3；完整门 16/16 |
| admission/execute 间 TOCTOU | admission 绑定原 `observationAuthority`；执行消费后检查它仍是同 driver 最新观察件，并在 `perform` 前重新 `resolveCatalogTarget`，重验 exact 语义与同一物理节点 | R4、R6；action/progress C3；authority/runner E6、E7 |
| 同 observation 并发 admission | `ADMISSION_RESERVATIONS` 以原 observation authority 做进程内 reservation；并发双铸至多一枚成功 | R7；authority/runner E8 |
| `perform` pending 时提前签后证据 | `perform` 返回后、铸 action receipt 前再次检查原 observation authority；动作事实可能已发生但 lineage 失效时拒绝，不签 receipt、不重试 | R6；authority/runner E9 |
| caller 自报只读即可执行 | proposal 与 admission 共用纯确定性 read-safe 窄闭集：只允许明确只读语义的 link；非 link、风险语义和未知语义都 fail-closed；`effect:"read"`、`userConfirmed:true` 不被提升为目标级授权 | R8；authority/runner E10、E11 |
| Playwright exact/handle/popup 边界 | 丢弃、超预算、bind 失败与异常路径释放 handle；候选事实覆盖 ARIA hidden、submit value、button image alt、多 token role；终检使用 Playwright exact hidden-aware 全页计数并比对同一 `ElementHandle`；popup、新 page、原页关闭或 page 集合变化均 fail-closed | R9；Playwright hardening H1-H4，4/4 |

以上是“机制已落并有针对性对抗”的结论，不等于整份契约已经完成冻结。特别是 read-safe
只是一条自动执行窄通道，不是对任意链接无副作用的证明；未落入明确 allowlist 的目标必须
`route:human`。

本轮最终复跑结果为：page observer 8/8、resolver/contract 16/16、action/progress 12/12、
authority/runner 11/11、Playwright hardening 4/4、static boundaries 5/5，全部 exit 0。

## 3. 公共 observation 脱敏已冻结

工作树中已经存在 `public-observation-redaction.mjs` 及独立 zero-SUT 门，当前可证明：

- 敏感 title 被清空；
- pathname 按 segment 使用稳定占位，不公开 host/query/hash；
- email、凭据词和长 opaque identifier 不进入 public semantic name；
- 被过滤候选的物理 handle 会释放，保留 handle 仍由 authority 生命周期释放；
- 安全文本保持可用于确定性 exact 匹配。

独立门实现前真实 0/2，修复后 2/2。`public-observation-redaction.mjs`、独立门与
`read-safe-target.mjs` 均已进入 plan/touches、静态核心清单、R10/R11 红证和 checksum。
正式 `gate` 的 20 个冻结项全部匹配，六个 story 全部由 gate 写为 `passes:true`。
任何 public observation 泄漏或脱敏后语义不唯一仍必须 fail-closed。

## 4. 架构裁定：先保持 capability sealing

当前 `action-admission.mjs` 同时承担 admission、一次性消费、执行前重验、`perform` 和 action receipt
铸造；`step-executor.mjs` 只是薄 façade。从命名和职责看，这确实存在倒置，长期会增加变更耦合。

本轮不在技术闭环前重构，理由不是“现状足够整洁”，而是 authority 目前依靠模块私有 `WeakMap`
封住 driver、handle、lineage 与 receipt 铸造权。此时搬动执行职责容易扩大 capability 出口，且不会
增加当前验收能力。

后继应在既有对抗全绿后做命名与接缝拆分：

1. admission 只负责验证并铸一次性执行许可；
2. execution seam 只消费许可、重验并调用 driver；
3. receipt authority 只在动作事实和 post-perform freshness 均成立后铸造；
4. 私有 capability 不得进入 public JSON，也不得由 clone/forge 恢复。

## 5. 规模与依赖证据

### 5.1 S1/S2 touched core

2026-07-27 对当前工作树逐文件计数：

| 层 | 文件与行数 |
|---|---|
| S1 | `setup-receipt` 489；`setup-flow` 371；`setup-barrier` 197；`setup-main-admission` 166；`setup-receipt-shape` 105；`intent-plan` 400 |
| S2 | `playwright-page-driver` 376；`affordance-catalog` 264；`action-admission` 255；`step-contract` 203；`affordance-authority` 176；`deterministic-resolver` 160；`action-proposal` 158；`page-observer` 127；`single-step-runner` 110；`progress-verifier` 88；`read-safe-target` 67；`public-observation-redaction` 58；`exploration-trace` 52；`step-executor` 12 |

20 个节点全部 `<=600`。独立导入图扫描得到 34 条内部边、`cycles: []`；现有
`adaptive-module-boundaries` 门为 5/5，并同时证明纯模块没有反向导入 Playwright、IO、网络或正式
replay/verdict 执行面。

### 5.2 全仓既有 `>600` 清单

扫描口径为当前工作树中的 `*.mjs/*.js/*.ts/*.json/*.md/*.txt`，排除 `.git`、`node_modules` 和二进制。
下列文件均不属于本契约 touched core，因此不阻断本契约的逐文件 `<=600` 门；其中冻结数据、fixture
和历史评审材料也不应伪装成可直接拆分的生产模块债。

生产代码：

```text
1894 lib/compile-atoms.mjs
1582 lib/entity-semantic-lock-v2.mjs
1062 bin/replay.mjs
 959 lib/teachin-observation-authority-root.mjs
 954 lib/entity-semantic-lock-preflight.mjs
 857 lib/replay-actions.mjs
 639 lib/report.mjs
```

测试、schema 与冻结数据：

```text
6637 tests/_golden/fixtures/hermetic-golden-retired/source-obligations.json
3481 tests/_golden/fixtures/hermetic-golden-retired/subsumption-matrix.json
3405 tests/_golden/fixtures/hermetic-golden-retired/isolated-browser-obligations.json
1311 tests/_golden/loop-kit-extract.golden.mjs
1069 lib/atoms-registry.snapshot.json
1005 tests/_golden/entity-identity-spine.admission-registry.zero-sut.golden.mjs
 983 tests/_golden/gen-prompts.golden.mjs
 910 tests/_golden/drawer-lock-hardening.golden.mjs
 769 tests/_golden/schemas/report-model.schema.json
 748 tests/fixtures/fake-sut/server.mjs
 667 tests/_golden/teachin-observation-safe-case-lease-v2.zero-sut.golden.mjs
 652 tests/_golden/schemas/failure-ledger-entry.schema.json
 627 tests/_golden/seams-freeze-v2.golden.mjs
 621 tests/_golden/agent-id-regression-diff.zero-sut.golden.mjs
```

文档与历史评审证据：

```text
5049 docs/plans/drawer-lock-hardening/review/codex-impl-r4-raw.txt
3297 docs/plans/drawer-lock-hardening/review/codex-impl-r5-raw.txt
2591 docs/plans/drawer-lock-hardening/review/codex-impl-r6-raw.txt
2431 docs/plans/gen-prompts/review/material-r1.md
2383 docs/plans/drawer-lock-hardening/review/material-impl-r3.md
1797 docs/plans/loop-kit-extract/review/material-impl-r6.md
1746 docs/plans/loop-kit-extract/review/material-impl-r5.md
1712 docs/plans/loop-kit-extract/review/material-impl-r4.md
1647 docs/plans/loop-kit-extract/review/material-impl-r3.md
1626 docs/plans/drawer-lock-hardening/review/material-impl-r1.md
1620 docs/plans/replay-settle-mount/review/material-impl-r1.md
1600 docs/plans/loop-kit-extract/review/material-impl-r1.md
1598 docs/plans/drawer-lock-hardening/review/material-r1.md
1374 docs/plans/loop-kit-extract/review/material-impl-r2.md
1025 docs/HANDOFF.md
 805 docs/plans/flow-bridge-golden-refit/accept/execution-account.json
 741 docs/plans/drawer-lock-hardening/review/material-impl-r2.md
 683 docs/plans/loop-dual-profile-reform/PROPOSAL.md
 667 docs/plans/gen-prompts/review/material-r2.md
 624 docs/plans/zero-shot-page-execution-research/plan.md
```

## 6. 明确后继债

1. 目标级人工 confirmation authority：`userConfirmed:true` 仍是普通布尔字段。后继收据必须绑定
   case、intent、observation、affordance、action、effect 与 expected，且 clone/forge 不授权。
2. entity identity 自动派生：当前 `identityAdmission.required:true` 只能 fail-close。后继需从页面事实
   自动派生并由 builder authority 铸造 `kind + name + code + platformId + scope` 身份证据；它与
   `affordanceId` 必须继续分门。
3. page topology controller：当前 Playwright driver 只会在 popup/new page/原页关闭时拒绝，尚不会
   选择正确 active page、维持 opener authority 或证明登录态连续。该能力由
   `page-topology-auth-continuity` 后继契约承接。
4. 真实 UAT：zero-SUT 不能替代 AI 中台 current build、AI 中台 version-held-out、医生站
   site-held-out 与 Hi 小助 CEF/iframe/shadow/container 场景。它们必须分别验证 freshness、SSE settle、
   hidden duplicate、登录连续性和正确活动页；证不出时 `route:human`。

## 7. 收口出口

S2 的 zero-SUT 契约已经满足收口条件：20 个冻结项 checksum 全匹配，六个 story 正式 `gate`
全部通过，七组针对性行为门全部 exit 0。下一步可以推进 review/learn 并提交本契约实现。
本文不构成真实 SUT 测试报告中的 PASS；AI 中台、医生站、Hi 小助与 page topology 仍按第 6 节
执行后继契约和实机 UAT。
