# drafter-patch-intent-guard · plan（light，v1）

## 改动面

1. `bin/draft.mjs` 存在性闸：`knownIntents = Set(observed.steps[].intentId)`；草稿 intent ∉ 集合 →
   `exit 65`。【评审 R1 修正两笔】①闸位=validateDraft（词表硬闸）之后、落盘之前——闸序不动
   output-seal F4 冻结面，且连 compile-report 侧造出的 observed 外 intent 同病同封；②错误信息
   **遮值**（初稿「含违例 intentId/非敏感面」作废——patch 是 LLM/人编文件、值可携任意内容，
   output-seal 遮值纪律同律），报「存在性闸」定位词+`intents[序号]`。合法条目行为一字不变。
2. owner 金牌（draft CLI 面）加两检查（红先行）：
   - 负控：patch 携不存在 intentId → 必 exit 65、零落盘；
   - 正控：patch 携 observed 真实 intentId（skeleton 无断言者）→ exit 0 且断言挂上（防把合法
     新建一起误杀）。
3. owner prd `checksumAmendments` 记账重钉金牌 checksum。

## 验收点

- 修前红证：现行 bin 对错位 intentId exit 0 且落盘孤儿 intent（红证文件留档）。
- 修后：新负控/正控绿 + owner 金牌全绿 + gate GREEN + 受影响面复跑退出码 0。【评审 R1 修正】
  受影响面=实际获准执行集：draft-cli、output-seal、caseid-echo-mask、p4-drafter、tier1
  （初稿误列 e2e-chain——该金牌启动 fake-SUT、不属代理可执行面，剔除不补跑）。

## 评审

light 车道：codex（Steven 既裁家族）聚焦审 diff+红证+金牌钉。
