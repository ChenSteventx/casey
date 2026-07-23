你是 Casey 仓 drafter-patch-intent-guard 契约的异构评审员（R1 终判 FAIL：R3 遮值金牌缺口 Medium、R4 plan 遮值口径矛盾 Medium+验收账不实 Medium；R1/R2 闸正确性与遮值实现你已判 OK）。本轮 R2 只核三 Medium 修复。工作目录 /mnt/d/ctx/heren/casey（只读）。

【材料】你的 R1 结论 docs/plans/drafter-patch-intent-guard/review/codex-review-r1.log；修复提交 git show HEAD。

【处置】①D10 遮值入冻：种子 intentId SEEDVAL_D10GHOST_x9、stderr+stdout 合流反向断言（原值出现即红）、「存在性闸」定位词+intents[序号] 必在——遮值回归自此测得出；②plan §改动面 1 修正：初稿「含违例 intentId/非敏感面」作废、改遮值口径+闸位记账；③plan §验收点修正：受影响面改为实际获准执行集（draft-cli/output-seal/caseid-echo-mask/p4-drafter/tier1），剔除误列的 e2e-chain（fake-SUT 金牌、代理不可执行）且不补跑。现成证据：draft-cli 12 检查全过、output-seal 27/27、双 gate GREEN、owner prd 第二笔 checksumAmendments 入账。

【输出要求】对三 Medium 逐项裁定 FIXED / PARTIAL / NOT-FIXED（新洞给 文件:行号 与级别）；最后单独一行终判：PASS 或 FAIL。
