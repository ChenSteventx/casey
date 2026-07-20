# codex 异构评审请求 R4 — hermetic-golden-zero-sut-lifecycle plan v4

你（gpt-5.6-sol high）R3 认 F4/F6/F7 消解、余 2 条 High（F1/F3 分区闭合矛盾+check 归因、F5 双状态源，`review/codex-plan-review-reply-r3.md`）。Claude 修成 v4（`plan.md`，顶部 v4 标注）。本轮：**逐条核 R3 的 2 条残留是否消解，有无新引入问题，v4 是否可进 accept**。对抗式、不确定判需补证。

## 只读这些 + 核其引用

- `docs/plans/hermetic-golden-zero-sut-lifecycle/plan.md`（v4）
- `review/codex-plan-review-reply-r3.md`（R3 两残留，对照）
- 允许只读核验：`tests/_golden/**`、`loop/prd-*.json`、`bin/verdict.mjs`、`lib/entity-semantic-lock-preflight.mjs`。

## 逐条复核（R3 残留 → v4 修法）

1. **R3-F1/F3（High，闭合公式自相矛盾 + check 归因缺控）**：v4 修——① `matrix.keys === obligations.keys`（全部两类 obligations）；② 收据 successor 带类型 `{kind:'unit-golden'|'uat-case'}`；③ **按 category 分区各自严格等集**（zero-SUT-unit 分区 obligations↔matrix(unit行)↔存活 unit check；fake-sut-behavior 分区 obligations↔matrix(uat行)↔收据(uat-case)↔manifest↔story；收据 unit-golden successor 单独等存活 unit check）；④ detector 加 **check 级 SUT 依赖归因**（数据流 SUT handle/url→哪些 check）+ check-前共享启动/check-内启动/纯 check 位启动前/共享跨多 check 正负控。核：分区公式是否已消矛盾、无缺环漏洞？check 归因用数据流+正负控是否够、不再靠人复核兜底？
2. **R3-F5（High，双状态源 + 永久 pending）**：v4 修——manifest **只存不可变定义+血缘、删 passes/route 运行状态**；`prd-hermetic-retired-uat` successor story 的 `passes` 是**唯一状态源**；定义不可变人签**证据 receipt**（uatCaseId/manifestCaseHash/runEvidenceRef/signer/signedAt/build/conclusion）+ story acceptance 跑确定性**校验器** `uat-receipt-validator.mjs`（仅有效 receipt+命名触发条件才 exit 0，gate 翻 true）作可执行 false→true 迁移门。核：单状态源是否已解双状态？校验器作迁移门是否真防「字段齐全但从未执行」的永久 pending？有无新引入问题？

## 产出

逐条判（消解/仍残留/新引入）+ file:line。总判：**v4 可进 accept，还是仍有阻断项**。若仍有，按严重度列 + 具体修法。诚实划界你没核到的（拟议产物尚未生成，只审设计是否闭合）。
