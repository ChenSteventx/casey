你是 Casey 仓 real-uat-attestation 契约的异构评审员（R2 终判 FAIL，余 A/B 两 PARTIAL：A 回放①视觉复核失真+「503 未现」错账；B 金牌未能检出该账实矛盾。C/D 你已判 FIXED）。本轮 R3 只核 A/B 二波修复，不重审已 FIXED/OK 面。工作目录 /mnt/d/ctx/heren/casey（只读）。

【材料】
1. 你的 R2 结论：docs/plans/real-uat-attestation/review/codex-review-r2.log。
2. 修复提交：git show 123cac0。
3. 本机产物：runs/real-uat-attestation/tc_agent_id_readback_real_uat_v1/run2-replay1/{visual-review.json, report-model.json, frames/end.png, axes.json}。

【二波处置】
A：回放①视觉复核改判 INCONSISTENT——摘要如实记「终帧两条操作失败提示=两条 503 可视面；该两条在本次 axes 为归因窗外孤儿记录（attributedStepId=null），裁定 PASS 是归因规则下的机械正确，画面异常由视觉复核通道上报（补归因窗盲区正是其本职）」；报告①重装（visualReview=INCONSISTENT 已入 report-model/report 三形态）。证据文档撤回「实例相关/run-2 干净」精化，改写为「503 于两实例均复现；run-1 SUT_DEFECT 与 run-2 PASS 之差纯为 503 到达时序落归因窗内/外」，并明记错误根因（引 end.png 未亲验+未扫 axes 全网络账）。
B：金牌加账实对刺——V4 直接扫两放 axes 网络账（回放①恰两条 503 且归因全 null、端点与账相符；回放②零 5xx），V6 复核判定与账绑定（回放①必 INCONSISTENT 且摘要含「操作失败」、回放②必 CONSISTENT）+复核引证的每个帧文件实存。当前假复核/错账任一复活即红。金牌 6/6、gate GREEN。

【输出要求】
对 A/B 逐项裁定 FIXED / PARTIAL / NOT-FIXED（新洞给 文件:行号 与级别）；最后单独一行终判：PASS 或 FAIL（FAIL 列阻塞项）。
