# GRILL — teachin-cycle-axes-atom

## D0 真机事实

最终主线含 `allStepIds: Set` 修复后，2026-08-03 真机两击均为
`unique / candidateCount=1 / performOk=true`，原 `RAW_AXES_PROJECTION_FAILED`
已越过；同次边车把后继拒付推进为 `VERDICT_EXECUTION_FAILED`。

## D1 根因

resolved mapping 已携 canonical `atom`，但 `planIntentEvents` 聚合时只把 raw event
放入 intent 行。raw event 本身没有 atom；`buildAxesInput` 再投给
`projectReplayAxes` 后，StepAxes 的 `atom` 因此缺席。`bin/verdict.mjs` 能按缺字段
计算，但 frozen CLI adapter 要求裁判产物与输入的 stepId/intentId/atom/顺序严格
绑定，缺 atom 的 JSON 无法通过 exact-key 校验，按设计 fail-closed。

## D2 修复边界

- 只在 resolved mapping 被消费时，把其已验证 `atom` 复制到该 mapping 覆盖的业务
  event 与结构 event 行；不得从 DOM/raw event 猜 atom。
- mapping.atom 缺席或非法时，axes projector 前拒绝；不得输出缺 atom 的 StepAxes。
- 不放宽 verdict CLI adapter 的 exact identity/shape 校验，不改 `bin/verdict.mjs`，
  不改 authority、拒付码或真机行为。

## D3 验收

扩 owner raw-axes 金牌新增 A9：同一 adapter 同时真驱 canonical projector 与
canonical frozen verdict CLI。实现前应稳定得到 `VERDICT_EXECUTION_FAILED`；实现后
应得到 `ok:true`，axes/verdict 中 atom 均为 resolved mapping 的 canonical atom，
verdict 为 PASS，两个生产接缝各恰调用一次。

## D4 完成

红→绿、owner/邻接/P9 gates、异构实现评审都过后合并主树；最终码再次真机两击，
只有 cycle exit 0 与同次 capture/sidecar 成立才闭环。owner checksum amendment 仍需
Steven 明签；新拒付只算新诊断事实。
