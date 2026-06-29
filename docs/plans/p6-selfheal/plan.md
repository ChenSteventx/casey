# P6 自愈骨架落地计划（确定性增量）

消费已冻接缝：`verdict.json` 的 `HARNESS_ERROR` 步 + drift-patch 接缝
（`tests/_golden/schemas/drift-patch.schema.json` + `tests/_golden/fixtures/seams/drift-patch.fixture.json`）。
判据：design §9.5（非就地自愈 + 人签 + spec 指纹）+ 护栏 #5/#13/#14。

本增量是【确定性骨架】：纯函数 + 可 golden、不碰已冻内核（`verdict.mjs`/`check.mjs`/`compile-gate.mjs`/`forensics.mjs`）。
真 L3 重锚/`LLM` 自愈不在此、属后续 route:human。

## 交付物

1. `lib/heal-gate.mjs`：纯函数 `admitForHeal(verdictStep) -> { admit, reason }`。
   只对 `verdictStep.verdict === 'HARNESS_ERROR'` 开闸（`admit:true`）；`PASS`/`SUT_DEFECT`/`NEEDS_HUMAN` 一律拒（`admit:false`）。
2. `lib/drift-patch.mjs`：
   - `buildDriftPatch({verdictStep, driftProbe, locatorBefore, locatorAfter, stableSignature, tsToken}) -> patch`：
     产出符合 drift-patch 接缝的 `proposed` 补丁（`before===after` 等值不变量、`triggerEvidence` 引 `verdict=HARNESS_ERROR` + `driftProbe.sameSignatureUniquePresent`、`humanSignoff:null`、`status:'proposed'`、`appliedAt:null`）。
   - `canApply(patch) -> boolean`：仅当 `humanSignoff` 非空（`signedAt`/`signerId`）且状态允许才 `true`（非就地：人签后才应用）。
   - `nextStatus(from, event) ` 状态机：`proposed→signed→applied` 合法迁移校验，非法跳变拒。
3. golden `tests/_golden/p6-selfheal.golden.mjs`（自包含、无 ajv，沿项目 hermetic 习惯）。
4. `loop/prd-p6-selfheal.json`（schemaVersion 1、`acceptance=node tests/_golden/p6-selfheal.golden.mjs`、`passes:false`、`testChecksums` 冻 golden + drift-patch fixture）。

## 流程与逻辑

归一→红基线→实现→绿→冻结：golden 先写、`lib` 未实现跑红 → 实现纯函数 → 绿 → 写 prd 冻 sha256 → gate。

## 验收点

- 验收命令：`node tests/_golden/p6-selfheal.golden.mjs`（exit 0 即过；gate 唯一写 `passes`）。
- 逐态 fail-safe：`admitForHeal` 对 `HARNESS_ERROR` 步 `admit:true`、对其余三态 `admit:false`。
- `buildDriftPatch` 产物过 drift-patch 接缝关键不变量：签名 `before===after`、引 `HARNESS_ERROR`、`proposed` 态 `humanSignoff:null`/`appliedAt:null`。
- `canApply` 对 `proposed`（未签）为 `false`、对带 `humanSignoff`（`apply`）的 `signed` 为 `true`（人签后才应用）。
- 状态机：非法跳变（跳过 `signed`、无人签 `applied`）被拒。

## 可观测性申报（gate 测不到、route:human）

- 真 L3 语义梯子重锚（`locatorAfter` 真实生成）与真实浏览器 agent —— route:human。
- 真人签门（CLI/webui）与签后写回 `events.json` —— route:human。
- 应用后同一冻结 `verdict.mjs`/`check.mjs` 复核闭环（`postApplyRecheck` 回 `PASS`）—— route:human。
- 熔断器每步进展哈希、非一次性漂移升级 inbox —— route:human。
