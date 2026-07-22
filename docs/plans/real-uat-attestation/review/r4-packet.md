你是 Casey 仓 real-uat-attestation 契约的异构评审员（R3 终判 FAIL 仅余 B PARTIAL 两洞：V6 未锁 visual-review.json/HTML/MD 交付面、V4 未钉 503 字面；A/C/D 你已判 FIXED）。本轮 R4 只核 B 两洞封口，不重审其余。工作目录 /mnt/d/ctx/heren/casey（只读）。

【材料】你的 R3 结论 docs/plans/real-uat-attestation/review/codex-review-r3.log；封口提交 git show HEAD（金牌 V6/V4 两处修改）。

【处置】V6 交付面全锁：解析 visual-review.json 源件（状态=期望值且与 report-model 全等；回放①摘要必含「操作失败」）+ report.json visualReview.status 核值 + HTML/MD 按渲染中文状态词逐面核（回放①必含「画面与裁定不一致」；回放②必含「画面与裁定一致」且必不含「画面与裁定不一致」——含式子串歧义已处理）。V4 钉 st===503 严格等（500/502/504 混入即红）。金牌 6/6、gate GREEN。

【输出要求】对 B 裁定 FIXED / PARTIAL / NOT-FIXED（新洞给 文件:行号 与级别）；最后单独一行终判：PASS 或 FAIL。
