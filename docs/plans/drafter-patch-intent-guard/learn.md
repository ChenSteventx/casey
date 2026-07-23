# drafter-patch-intent-guard · learn（阶段 5 沉淀）

> 状态：六阶段全 done；codex 两轮评审 R2 终判 PASS（R1 三 Medium 全采信）。

## 交付结果

bin/draft.mjs --patch 存在性闸：错位 intentId 不再静默新建孤儿 intent（fail-closed 65、遮值报序号）；
金牌 D10 负控（红先行+遮值反向断言）+D11 正控（合法新建不误杀）；owner prd 两笔修单账。

## 教训

1. **闸序即冻结面**：新闸插在词表硬闸前会抢答 output-seal F4 的冻结期望——先探受影响金牌把闸位
   放在既有闸之后，同缝零涟漪（本单实证：闸移后 output-seal 27/27 回绿）。
2. **遮值约束本身要入冻**：只在实现里遮值、金牌不冻它，回归回显测不出——种子值+输出流反向断言
   是唯一钉法（codex R1-R3）。
3. **plan 与实现分叉要当场订正**：初稿「intentId 非敏感」被实现推翻后 plan 未跟——评审逮账实矛盾；
   plan 是权威，实现改向即回写修正注记。
4. 验收清单先核可执行面：误列 fake-SUT 金牌（e2e-chain）= 给自己挖不可兑现的账。
