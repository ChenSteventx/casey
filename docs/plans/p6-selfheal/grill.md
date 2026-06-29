# P6 自愈骨架 grill（light stub）

> light lane：本阶段只压实「确定性骨架」的判据边界，真 L3 重锚/`LLM` 自愈不在本 hermetic 增量、属后续 route:human。
> 内核一字不让：裁判零 `LLM`、fail-safe 不 fail-open、自愈非就地、人签后才应用。

## 被 grill 的关键决策（已拍板）

1. 自愈准入门只对 `HARNESS_ERROR`（过程错误/工装漂移）开闸吗？
   是。`admitForHeal` 只在 `verdictStep.verdict === 'HARNESS_ERROR'` 返回 `admit:true`；`PASS`/`SUT_DEFECT`/`NEEDS_HUMAN` 一律 `admit:false`。
   依据护栏 #13/#14：缺取证不等于工装错，真 bug 表现成「元素不见了」若默认成可自愈就是最危险的假绿（design §10/§4.2）。

2. 漂移补丁就地改 spec 吗？
   绝不。`buildDriftPatch` 只产出旁文件提案（`status:'proposed'`、`humanSignoff:null`、`appliedAt:null`），原 `spec`/`events` 一字不动。
   `canApply` 仅当 `humanSignoff` 非空（带 `signedAt`/`signerId`）且状态允许才返回 `true`——人签后才应用（护栏 #5）。

3. 合法漂移的不变量是什么？
   `stableSignature.before` 必须等值 `after`（重锚到同一稳定元素、只换 locator）；不等即非纯定位漂移、不得自愈、route:human。
   触发取证必引 `verdict=HARNESS_ERROR` + `driftProbe.sameSignatureUniquePresent===true` + `recordedLocatorMiss===true`（正向漂移三证齐备）。

4. 状态机合法迁移？
   `proposed → signed → applied`（人签 `decision:'apply'`）；`proposed/signed → rejected`（`decision:'reject'`）；超阈/被取代 → `superseded`。
   非法跳变（如 `proposed → applied` 跳过 `signed`、或无人签 `applied`）一律拒。

## 不在本增量（deferred / route:human）

- 真 L3 语义梯子重锚（`locatorAfter` 的真实生成）与真实浏览器 agent；
- 真人签 CLI/webui 与签后实际写回 `events.json`；
- 应用后由同一冻结 `verdict.mjs`/`check.mjs` 复核闭环（`postApplyRecheck` 回 `PASS`）；
- 只读漂移探针 `findEquivalentAffordance`（P5 产出，本增量只消费其结果字段）；
- 熔断器每步进展哈希（非一次性漂移升级 inbox）。
