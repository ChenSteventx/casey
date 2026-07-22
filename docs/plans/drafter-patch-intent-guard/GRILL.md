# drafter-patch-intent-guard · GRILL（阶段0）

> 工装缝修单（real-uat-attestation R2 实证挂账）：`bin/draft.mjs` 的 `--patch` 合并对未知 intentId
> **静默新建孤儿 intent**——错位断言被冻进 expected 但回放期永不匹配（表现=冻结面缺该断言、
> 裁定退化只剩全局取证）。UAT 链首版补缝 `intent_open`/`intent_1` 错位即此。

## 决策（均按仓内既有纪律直裁，无 Steven 分岔）

- D1 处置=fail-closed 拒绝（exit 65），不是告警放行：与 draft 既有闸（缺 intentId/非数组均 65）
  同律；孤儿断言无任何合法用途。
- D2 存在性基准=observed 的真实 intent 集（`observed.steps[].intentId` 全集）：skeleton 的
  `draft.intents` 只含已有断言的 intent（UAT 实证 0 断言时为空），不能作基准，否则合法补缝也被拒。
- D3 范围收窄：只封 intentId 存在性这一缝；kind/op 语义仍由既有 `validateDraft` 闸管，不重复造闸。
- D4 金牌钉=红先行：owner 金牌加「错位 intentId 必 65 + 正控合法 intentId 仍过」两检查，
  修前红实证（现行为 exit 0 落盘孤儿）；冻结金牌修改走 owner prd `checksumAmendments` 修单路径。
