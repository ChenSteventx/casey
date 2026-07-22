# drafter-patch-intent-guard · plan（light，v1）

## 改动面

1. `bin/draft.mjs` `--patch` 合并段：合并前构造 `knownIntents = Set(observed.steps[].intentId)`；
   补缝条目 intentId ∉ 集合 → `exit 65`（错误信息含违例 intentId——步标识符非敏感面）；
   合法条目行为一字不变（含挂到 skeleton 尚无断言的 intent 上的合法新建）。
2. owner 金牌（draft CLI 面）加两检查（红先行）：
   - 负控：patch 携不存在 intentId → 必 exit 65、零落盘；
   - 正控：patch 携 observed 真实 intentId（skeleton 无断言者）→ exit 0 且断言挂上（防把合法
     新建一起误杀）。
3. owner prd `checksumAmendments` 记账重钉金牌 checksum。

## 验收点

- 修前红证：现行 bin 对错位 intentId exit 0 且落盘孤儿 intent（红证文件留档）。
- 修后：新负控/正控绿 + owner 金牌全绿 + gate GREEN + 受影响面（p4-drafter/draft-cli/e2e-chain
  等吃 drafter 的 zero-SUT 金牌）复跑退出码 0。

## 评审

light 车道：codex（Steven 既裁家族）聚焦审 diff+红证+金牌钉。
