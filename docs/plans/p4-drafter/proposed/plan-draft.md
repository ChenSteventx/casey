# 落地计划（草稿）：P4 断言草拟器（slug: `p4-drafter`，lane 待定）

> 配套：`GRILL.md`（本目录，三决策 + 拟定）、`docs/plans/p4-freeze/`（冻结+人签骨架 done）、design §5 / §2.1。
> **状态：草稿。未 `contract init`、未 accept、未占 baton。** 落地待主 baton 空。

## 范围与非目标

范围（确定性、可 golden、消费已冻接缝）：
- 确定性合成断言骨架：`assert.*` 原子留痕 + `观测现状` → typed `expected[]` 骨架 + 全局取证 + 模板化 lint。
- LLM 补缝的**零 LLM 校验闸**：草稿过 `kind`/`op`/模板化/字面量 fail-closed 准入。
- 未实现 kind 冻成 `soft` 的确定性承载（复用 `soft` + 重签，不碰冻结内核）。

非目标（本期不做）：
- LLM 补缝的语义质量与覆盖度 —— `route:human` 语义抽检。
- 真人签 UX —— `route:human`，design §11 项 1。
- 10 种未实现 kind 的 `replay-assert` 实现 —— 并行加法轨（护栏 #17）。
- 不改冻结内核（`verdict.mjs`/`check.mjs`/`forensics.mjs`）与已冻 seams（`expected-frozen` schema 除非走 seams 补冻）。

## Story S1：确定性合成断言骨架（零 LLM 可 golden）

流程：`lib/assertion-draft.mjs`（拟名）纯函数 `synthesizeSkeleton(observed, assertionAtoms) -> expectedDraft`：`assert.*` 查表映射 + 全局取证默认加 + `观测现状` 值模板化/剥 ID。
逻辑：零 LLM、确定性、不发明 kind（越界由 `check.mjs` 词表硬闸拦）；无干净信号的步不硬凑、标 `route:human`。
验收点（对 `observed-reality.fixture.json`）：
- [命令] 合成骨架 `kind`/`op` 落词表、逐 `intent` 卷回 `intentId`、全局取证在场。
- [命令] `观测现状` 里 `atl_`/实体 ID 值被模板化/剥尾（不冻字面量）。

## Story S2：LLM 补缝的零 LLM 校验闸（可 golden）

流程：`validateDraft(expectedDraft) -> { ok, problems }`：逐条校 `kind` 在词表 / `op` 合法 / `equals` 不含 ID·`atl_` / `uniqueName` 已模板化。
逻辑：fail-closed（护栏 #14）；LLM 补缝本身 `route:human`，本闸只确定性校「草稿合规」。
验收点：
- [命令] 违规草稿（词表外 `kind` / `equals` 含 `atl_` / 未模板化 `uniqueName`）→ `ok:false`、`problems` 非空。
- [命令] 合规草稿 → `ok:true`。

## Story S3：pendingImpl 承载（复用 soft + 重签）

流程：草拟器把「未落在 `replay-assert` 已实现集」的 kind 标 `soft`；`已实现 kind` 清单由 `replay-assert` 导出、供草拟器判。
逻辑：不碰 schema、不碰 `verdict.mjs`；`soft` 已有语义（进报告不进裁定）承载「暂不硬裁定」；补实现后走重签（新 `signedAt`/`signedAgainstBuild`）提 `hard`。
验收点：
- [命令] 未实现 kind 被标 `soft`、`verdict` 不纳入硬 AND（复用已冻 `verdict.mjs` 行为，合成 StepAxes 验）。

## route:human / deferred 汇总

- [🧑] LLM 补缝语义质量与覆盖度。
- [🧑] 12/15 kind 接缝对齐（走 seams 补冻 or 收 `check.mjs`）。
- [🧑] 真人签 UX。
- [🧑] 10 种 kind 的 `replay-assert` 实现 + 重签提 `hard`。

## 立即下一步（落地时，占 baton）

1. 定 12/15 kind 接缝（route:human 拍板）+ 定 lane。
2. acceptance-gate：按验收点写红 golden（对合成 `observed` fixture）、跑验红、sha256 冻、生成 `loop/prd-p4-drafter.json`。
3. `contract init p4-drafter` → loop 实现 `lib/assertion-draft.mjs` → gate 绿。
4. 异构评审（codex 非同族）→ learn。
